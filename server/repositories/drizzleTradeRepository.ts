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
import { eq } from 'drizzle-orm';

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
  let q = db.select().from(trades);
  if (officialOnly) q = q.where(eq(trades.isOfficial, true));
  if (!includeInactive) q = q.where(eq(trades.isActive, true));
  return await q;
}