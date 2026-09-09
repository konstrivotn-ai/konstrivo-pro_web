/**
 * Phase 2A — Trade Repository (Drizzle/PostgreSQL)
 *
 * Read-only access to the `trades` registry, mirroring the
 * `drizzleMaterialRepository` conventions. The `trades` table and the
 * `materials.trade_id` foreign key already exist (Phase 1 migration 0003);
 * this module provides the lookup layer on top of that relationship.
 */
import { getDatabase } from '../db/client';
import { trades } from '../db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Phase B — Create a trade by code if it does not already exist.
 *
 * Used by the CSV import flow so that a newly imported trade (e.g. `gypsum`)
 * is persisted in the `trades` table and becomes immediately available through
 * the existing trade repository/API. Official trades are never modified.
 *
 * Returns the existing row if the code is already present (idempotent).
 */
export async function upsertTradeByCode(code: string, label?: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  const existing = await findTradeByCode(code);
  if (existing) return existing;
  const inserted = await db.insert(trades).values({
    code,
    labelFr: label || code,
    labelAr: null,
    labelDerja: null,
    icon: null,
    sortOrder: 999,
    isActive: true,
    isOfficial: false,
  }).returning();
  return inserted?.[0];
}

/**
 * A canonical lowercase/uppercase hyphenated UUID (matching PostgreSQL's
 * `uuid` type). Guarding the column value here avoids passing an arbitrary
 * non-UUID string into `WHERE id = ...`, which would otherwise raise a
 * PostgreSQL `22P02` (invalid text representation for uuid) instead of
 * returning an empty result set.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function findTradeById(id: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  if (!isUuid(id)) return undefined;
  const res = await db.select().from(trades).where(eq(trades.id, id)).limit(1);
  return res[0];
}

export async function findTradeByCode(code: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  const res = await db.select().from(trades).where(eq(trades.code, code)).limit(1);
  return res[0];
}

export async function listTrades(opts: { officialOnly?: boolean; includeInactive?: boolean } = {}) {
  const { officialOnly = false, includeInactive = false } = opts;
  const db = await getDatabase();
  if (!db) return [];
  const conditions: any[] = [];
  if (officialOnly) conditions.push(eq(trades.isOfficial, true));
  if (!includeInactive) conditions.push(eq(trades.isActive, true));
  const q = conditions.length > 0 ? db.select().from(trades).where(and(...conditions)) : db.select().from(trades);
  return await q;
}