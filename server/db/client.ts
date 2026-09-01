// @ts-nocheck
/**
 * Phase 3 — Database Client (Drizzle + PostgreSQL)
 *
 * Safe bootstrap:
 *   DATABASE_URL exists  →  PostgreSQL via Drizzle
 *   DATABASE_URL missing →  null (caller falls back to in-memory repos)
 *
 * Production: if the database is required but unavailable, fail CLEARLY.
 */
import { config } from '../config';

let dbInstance: any = null;
let dbInitPromise: Promise<any> | null = null;

/**
 * Lazily initialise the Drizzle client.
 * Returns null when DATABASE_URL is not configured (dev fallback mode).
 * Throws clearly in production if configured but connection fails.
 */
export async function getDatabase(): Promise<any | null> {
  if (!config.databaseUrl) {
    return null; // Phase 2 in-memory mode
  }

  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      const { drizzle } = await import('drizzle-orm/postgres-js');
      const postgres = (await import('postgres')).default;
      const schema = await import('./schema/index');

      const client = postgres(config.databaseUrl!, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      // Verify connectivity
      await client`SELECT 1`;

      dbInstance = drizzle(client, { schema });
      console.log('[KONSTRIVO] ✅ PostgreSQL connected via Drizzle');
      return dbInstance;
    } catch (err) {
      const msg = `[KONSTRIVO] ❌ PostgreSQL connection failed: ${err instanceof Error ? err.message : err}`;
      if (config.isProduction) {
        throw new Error(msg); // Fail clearly in production
      }
      console.warn(msg);
      console.warn('[KONSTRIVO] Falling back to in-memory repositories.');
      return null;
    }
  })();

  return dbInitPromise;
}

/** Check whether the database is currently available. */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    return !!(await getDatabase());
  } catch {
    return false;
  }
}
