import { createApp } from '../server';
import { bootstrapAdmin } from '../server/bootstrap';

// Cache the app across invocations (serverless warm reuse).
let cachedApp: any = null;
let bootstrapPromise: Promise<void> | null = null;

const ensureApp = async () => {
  if (!cachedApp) {
    cachedApp = await createApp();
    // Ensure the admin user exists on the first (cold) invocation.
    // Idempotent: skips if admin already present. Safe for every cold start.
    if (!bootstrapPromise) bootstrapPromise = bootstrapAdmin().catch(err => {
      console.error('[KONSTRIVO] bootstrapAdmin failed:', err?.message || err);
    });
    await bootstrapPromise;
  }
  return cachedApp;
};

export default async function handler(req: any, res: any) {
  const app = await ensureApp();
  return app(req, res);
}
