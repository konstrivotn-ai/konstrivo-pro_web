/**
 * Phase 2 — Test Infrastructure
 *
 * Starts the Express app on an ephemeral port and exposes
 * helpers for making authenticated API requests.
 */
import http from 'http';
import express from 'express';
import { setupV1Router } from '../server/routes/v1';
import { authenticate } from '../server/middleware/auth';
import { createAiEstimatorHandler } from '../server';
import { createLimiter } from '../server/middleware/rateLimit';
import { getDatabase } from '../server/db/client';
import { isSafeDevelopmentDatabase } from '../server/config';

// Exported test hook to capture what would be sent to the AI provider.
export let lastAiRequest: any = null;

export function resetLastAiRequest() {
  lastAiRequest = null;
}

export function getLastAiRequest() {
  return lastAiRequest;
}

export interface TestServer {
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * Clean PostgreSQL tables before running tests to ensure test isolation.
 * Only identity/transactional tables are truncated — the catalog
 * (materials/prices) is served from MemoryStore in tests and seeded
 * independently, so it must NOT be wiped here.
 */
async function cleanupDatabase() {
  // Ensure we do NOT run destructive cleanup against non-test/production DBs.
  const db = await getDatabase();
  if (!db) return;

  const explicitConfirm = process.env.TEST_DB_CONFIRM === '1' || process.env.TEST_DB_CONFIRM === 'true';
  if (!explicitConfirm) {
    // Require an explicit confirmation environment variable before allowing
    // any destructive cleanup, regardless of whether the DB appears local.
    throw new Error('[KONSTRIVO-TEST] Aborting destructive cleanup: TEST_DB_CONFIRM must be set to 1 to allow TRUNCATE/cleanup (DANGEROUS).');
  }

  try {
    const { sql } = await import('drizzle-orm');
    // All table names verified against server/db/schema/*.
    await db.execute(sql.raw(
      'TRUNCATE TABLE idempotency_keys, sync_operations, supplier_catalog_items, ' +
      'supplier_catalog_imports, artisan_profiles, devis_items, devis, ' +
      'subscriptions, company_members, companies, users CASCADE'
    ));
  } catch (err) {
    console.warn('[KONSTRIVO-TEST] Database cleanup failed/skipped:', err instanceof Error ? err.message : err);
  }
}

export async function startTestServer(opts?: { enableRateLimits?: boolean, testLimits?: any }): Promise<TestServer> {
  // Clean database before starting tests
  await cleanupDatabase();
  
  // Optionally enable test-mode rate limits and inject test-specific limits
  const prevTestEnable = process.env.TEST_ENABLE_RATE_LIMITS;
  const prevEnv: Record<string, string | undefined> = {};
  if (opts?.enableRateLimits) {
    process.env.TEST_ENABLE_RATE_LIMITS = '1';
  }
  if (opts?.testLimits) {
    const mapping: Record<string, string[]> = {
      login: ['RATE_LIMIT_LOGIN_MAX', 'RATE_LIMIT_LOGIN_WINDOW_MS'],
      register: ['RATE_LIMIT_REGISTER_MAX', 'RATE_LIMIT_REGISTER_WINDOW_MS'],
      refresh: ['RATE_LIMIT_REFRESH_MAX', 'RATE_LIMIT_REFRESH_WINDOW_MS'],
      aiEstimator: ['RATE_LIMIT_AI_MAX', 'RATE_LIMIT_AI_WINDOW_MS'],
    };
    for (const key of Object.keys(opts.testLimits)) {
      const envKeys = mapping[key] || [];
      const val = opts.testLimits[key];
      if (envKeys[0] && val.max !== undefined) { prevEnv[envKeys[0]] = process.env[envKeys[0]]; process.env[envKeys[0]] = String(val.max); }
      if (envKeys[1] && val.windowMs !== undefined) { prevEnv[envKeys[1]] = process.env[envKeys[1]]; process.env[envKeys[1]] = String(val.windowMs); }
    }
  }

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  const v1Router = setupV1Router();
  app.use('/api/v1', v1Router);

  // Simple health for testing
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Mount production AI estimator handler but inject a fake AI client to avoid external calls
  const fakeAiClient = {
    models: {
      generateContent: async ({ model, contents, config }: any) => {
        // capture the call for tests (stringifyable)
        lastAiRequest = { model, contents, config };
        return { text: 'stub' };
      }
    }
  };

  // Use the real production handler code but with injected fake client for tests
  const aiLimiter = createLimiter('aiEstimator', opts?.testLimits?.aiEstimator, !!opts?.enableRateLimits);
  app.post('/api/ai-estimator', authenticate, aiLimiter as any, createAiEstimatorHandler(fakeAiClient));

  // Additional test-only route to exercise the production handler without an injected client
  // This allows asserting 503 when GEMINI_API_KEY is missing.
  app.post('/api/ai-estimator-prod-check', createAiEstimatorHandler());

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      // Expose the test server port to the process so rate limiter keying
      // can use a stable per-server identifier instead of per-connection
      // socket ports which may vary across requests.
      const prevServerPort = process.env.TEST_SERVER_PORT;
      process.env.TEST_SERVER_PORT = String(addr.port);
      resolve({
        port: addr.port,
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise<void>((res2) => server.close(() => {
          // Restore previous env values
          if (prevServerPort === undefined) delete process.env.TEST_SERVER_PORT; else process.env.TEST_SERVER_PORT = prevServerPort;
          if (opts?.enableRateLimits) {
            if (prevTestEnable === undefined) delete process.env.TEST_ENABLE_RATE_LIMITS; else process.env.TEST_ENABLE_RATE_LIMITS = prevTestEnable;
          }
          if (opts?.testLimits) {
            for (const k of Object.keys(prevEnv)) {
              const v = prevEnv[k];
              if (v === undefined) delete process.env[k]; else process.env[k] = v;
            }
          }
          res2();
        })),
      });
    });
  });
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

export async function apiRequest(
  baseUrl: string,
  method: string,
  path: string,
  options?: {
    body?: any;
    token?: string;
    idempotencyKey?: string;
    rawBody?: Buffer | string;
    contentType?: string;
  }
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}${path}`;
    const parsedUrl = new URL(url);
    const isRaw = !!options?.rawBody;

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          ...(isRaw && options?.contentType ? { 'Content-Type': options.contentType } : {}),
          ...(!isRaw && options?.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
          // Ensure deterministic client identity for rate-limit tests
          'X-Forwarded-For': '127.0.0.1',
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          let body: any = data;
          try {
            if (data.length > 0) body = JSON.parse(data);
          } catch { /* keep as string */ }
          resolve({ status: res.statusCode || 0, body, headers: res.headers as Record<string, string> });
        });
      }
    );

    req.on('error', reject);

    if (options?.rawBody) {
      req.end(options.rawBody);
    } else if (options?.body !== undefined) {
      req.end(JSON.stringify(options.body));
    } else {
      req.end();
    }
  });
}
