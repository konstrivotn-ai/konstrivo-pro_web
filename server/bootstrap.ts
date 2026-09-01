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

import { config } from './config';
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
    const db = await getDatabase();
    if (!db) {
      console.warn('[KONSTRIVO] Admin bootstrap: PostgreSQL not available (set DATABASE_URL)');
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