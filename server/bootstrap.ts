// @ts-nocheck
/**
 * Phase 1.1 — Admin Bootstrap
 * 
 * Creates the first admin user from environment variables.
 * Safe to run on every startup - skips if admin already exists.
 * 
 * Required env vars:
 *   ADMIN_EMAIL     — admin email address
 *   ADMIN_PASSWORD  — admin password (min 8 chars)
 * 
 * Security:
 *   - Never logs the password
 *   - Only creates one admin (idempotent)
 *   - Only works when DATABASE_URL is configured
 */

import { loadConfig } from './config';
import { hashPassword } from './utils/crypto';
import { drizzleUserRepository } from './repositories/drizzleUserRepository';
import { drizzleCompanyRepository } from './repositories/drizzleCompanyRepository';
import { getDatabase } from './db/client';

export async function bootstrapAdmin(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Skip if env vars not configured
  if (!adminEmail || !adminPassword) {
    console.log('[KONSTRIVO] Admin bootstrap: ADMIN_EMAIL/ADMIN_PASSWORD not set, skipping');
    return;
  }

  // Validate password length
  if (adminPassword.length < 8) {
    console.error('[KONSTRIVO] Admin bootstrap: ADMIN_PASSWORD must be at least 8 characters');
    return;
  }

  try {
    // Re-load configuration at call time so tests can simulate different
    // environments by mutating process.env before invoking this function.
    const cfg = loadConfig();
    const db = await getDatabase();
    if (!db) {
      console.warn('[KONSTRIVO] Admin bootstrap: PostgreSQL not available (set DATABASE_URL)');
      return;
    }
    // In production, require an explicit opt-in to allow bootstrapping an admin
    // from environment variables. This prevents accidental or insecure admin
    // creation when the app is deployed. Tests and development keep the
    // original behavior (no extra flag required).
    if (cfg.isProduction) {
      const allowBootstrap = process.env.ADMIN_BOOTSTRAP === '1';
      if (!allowBootstrap) {
        console.warn('[KONSTRIVO] Admin bootstrap: disabled in production unless ADMIN_BOOTSTRAP=1 is set');
        return;
      }
      // Additional safety: disallow bootstrapping against non-local databases
      // unless explicitly allowed. This helps prevent accidental bootstrap on
      // managed production databases.
      const dbUrl = (cfg.databaseUrl || '').toLowerCase();
      const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', 'host.docker.internal'];
      // Recognize a local DB by host regardless of NODE_ENV; only treat as
      // non-local/remote when the DB URL does not contain a local host.
      const isLocalDb = localHosts.some(h => dbUrl.includes(h));
      if (!isLocalDb) {
        const explicitAllow = process.env.ADMIN_BOOTSTRAP_FORCE === '1';
        if (!explicitAllow) {
          console.warn('[KONSTRIVO] Admin bootstrap: refusing to bootstrap on a non-local production database. Set ADMIN_BOOTSTRAP_FORCE=1 to override.');
          return;
        }
      }
    }

    // In production, require a stronger admin password (prevent weak defaults).
    if (cfg.isProduction && adminPassword.length < 16) {
      console.error('[KONSTRIVO] Admin bootstrap: ADMIN_PASSWORD must be at least 16 characters in production');
      return;
    }

    // Check if admin already exists
    const existingAdmin = await drizzleUserRepository.findByEmail(adminEmail);
    if (existingAdmin) {
      console.log(`[KONSTRIVO] Admin bootstrap: admin user already exists (${adminEmail})`);
      return;
    }

    // Create admin user
    const adminUser = await drizzleUserRepository.create({
      email: adminEmail.toLowerCase().trim(),
      fullName: 'System Administrator',
      phone: '',
      passwordHash: hashPassword(adminPassword),
      role: 'admin',
      status: 'active',
    });

    // Create admin company
    const adminCompany = await drizzleCompanyRepository.create({
      legalName: 'KONSTRIVO Admin',
      tradeName: 'Admin',
      status: 'active',
    });

    console.log(`[KONSTRIVO] ✅ Admin bootstrap: created admin user (${adminEmail})`);
    console.log(`[KONSTRIVO] Admin bootstrap: created admin company (${adminCompany.id})`);
  } catch (err) {
    console.error('[KONSTRIVO] Admin bootstrap failed:', err instanceof Error ? err.message : err);
  }
}