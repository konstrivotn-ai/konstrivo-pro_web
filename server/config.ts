/**
 * Phase 2 + Phase 3 — Environment Configuration
 *
 * Reads configuration from environment variables.
 * Safe defaults are provided so the application never crashes
 * during local frontend development when no database is configured.
 */
import 'dotenv/config';

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  // JWT
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  jwtRefreshExpiresInSeconds: number;
  // Password hashing
  scryptSaltLen: number;
  scryptKeyLen: number;
  scryptN: number;
  // File upload
  maxUploadBytes: number;
  allowedUploadMime: Set<string>;
  // Database (Phase 3)
  databaseUrl: string | undefined;
  testDatabaseUrl: string | undefined;
  // Public app URL used to build password-reset links.
  publicAppUrl: string | undefined;
  // Rate limiting (basic)
  rateLimitMax: number;
  rateLimitWindowMs: number;
}

const ONE_DAY_SECONDS = 86400;

export function loadConfig(): ServerConfig {
  const jwtSecret = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || jwtSecret === 'dev-only-insecure-secret-change-me') {
      // Fail CLOSED in production: an unconfigured or known JWT secret would
      // allow anyone to forge tokens. Auth-foundation safety guard (Phase 0).
      throw new Error(
        '[KONSTRIVO] FATAL: JWT_SECRET is not configured in production. ' +
        'Refusing to start with an insecure token secret.'
      );
    }
    // Additional strength check: require a reasonably long secret in production.
    // Recommend a 32-byte random secret (e.g. `openssl rand -hex 32`).
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      throw new Error(
        '[KONSTRIVO] FATAL: JWT_SECRET appears too short or weak for production. ' +
        'Provide a strong secret (recommend: 32+ characters or 32 random bytes hex).' 
      );
    }
  } else if (!process.env.JWT_SECRET) {
    console.warn('[KONSTRIVO] WARNING: JWT_SECRET not set — using insecure dev default. NEVER use in production.');
  }

  const databaseUrl = process.env.DATABASE_URL || undefined;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || undefined;

  if (process.env.NODE_ENV === 'production') {
    // In production we require a configured DATABASE_URL; refuse to run in
    // memory/mock mode to avoid accidentally exposing seeded demo data.
    if (!databaseUrl) {
      throw new Error('[KONSTRIVO] FATAL: DATABASE_URL must be configured in production. Refusing to start in memory mode.');
    }
  }

  if (process.env.NODE_ENV === 'test') {
    if (!testDatabaseUrl) {
      throw new Error('[KONSTRIVO-TEST] TEST_DATABASE_URL is required for PostgreSQL integration tests.');
    }
    if (databaseUrl && testDatabaseUrl === databaseUrl) {
      throw new Error('[KONSTRIVO-TEST] TEST_DATABASE_URL must be different from DATABASE_URL.');
    }
  }

  if (databaseUrl && process.env.NODE_ENV === 'development') {
    console.log('[KONSTRIVO] DATABASE_URL detected — PostgreSQL mode enabled.');
  }

  const effectiveDatabaseUrl = process.env.NODE_ENV === 'test' ? testDatabaseUrl : databaseUrl;

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    jwtSecret,
    jwtExpiresInSeconds: parseInt(process.env.JWT_EXPIRES_IN || '3600', 10), // 1 hour
    jwtRefreshExpiresInSeconds: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || String(ONE_DAY_SECONDS * 7), 10), // 7 days
    scryptSaltLen: 16,
    scryptKeyLen: 32,
    scryptN: 16384,
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES || String(5 * 1024 * 1024), 10), // 5 MB
    allowedUploadMime: new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
    databaseUrl: effectiveDatabaseUrl,
    testDatabaseUrl,
    publicAppUrl: getPublicAppUrl(),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  };
}

export const config: ServerConfig = loadConfig();

/**
 * Returns true only when NODE_ENV === 'production'. Read at call time (not
 * cached) so behaviour always reflects the *current* environment, including
 * during tests that simulate production.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Returns the validated public application URL (trailing slashes stripped)
 * used to build password-reset links, or `undefined` when it is unset or
 * invalid.
 *
 * SECURITY:
 * - The value is read from the server environment ONLY; it is never taken from
 *   any HTTP input (body/query/header/cookie) or from the frontend.
 * - Only absolute http(s) URLs with a host are accepted; anything else (e.g.
 *   `not-a-url`, `ftp://...`) returns `undefined`.
 * - This helper NEVER falls back to localhost. Callers decide how to react to
 *   `undefined`; in production the forgot-password route simply skips the
 *   email so no localhost/accent reset link is ever sent.
 */
export function getPublicAppUrl(): string | undefined {
  const raw = process.env.PUBLIC_APP_URL;
  if (!raw) return undefined;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return undefined;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return undefined;
  if (!u.hostname) return undefined;
  return raw.replace(/\/+$/, '');
}

export function hasDatabase(): boolean {
  return !!config.databaseUrl;
}

/**
 * Returns true only when we are in an environment we can confidently
 * identify as a development database.
 * This guards against accidentally connecting to production.
 */
export function isSafeDevelopmentDatabase(): boolean {
  if (!config.databaseUrl) return false;
  const url = config.databaseUrl.toLowerCase();
  // Allow common local dev hosts
  const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', 'host.docker.internal'];
  return localHosts.some(h => url.includes(h)) && config.nodeEnv !== 'production';
}
