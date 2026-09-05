import { getDatabase } from '../db/client';
import { materials } from '../db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

export async function findMaterialById(id: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  const res = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  return res[0];
}

export async function findMaterialByCode(code: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  const res = await db.select().from(materials).where(eq(materials.code, code)).limit(1);
  return res[0];
}

/**
 * Step 5 — Idempotent upsert of an OFFICIAL material by its legacy `code`
 * (e.g. `plaque_ba13_standard`). Official materials have company_id IS NULL.
 * Re-running with the same code updates the existing row — never duplicates.
 */
export async function upsertMaterialByCode(data: {
  code: string;
  trade: string;
  category: string;
  nameFr: string;
  nameAr?: string | null;
  nameDerja?: string | null;
  baseUnit: string;
  technicalSpecs?: string | null;
}) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(materials)
    .where(and(eq(materials.code, data.code), isNull(materials.companyId)))
    .limit(1);
  if (existing[0]) {
    const [updated] = await db.update(materials).set({
      trade: data.trade,
      category: data.category,
      nameFr: data.nameFr,
      nameAr: data.nameAr ?? null,
      nameDerja: data.nameDerja ?? null,
      baseUnit: data.baseUnit,
      technicalSpecs: data.technicalSpecs ?? null,
      isOfficial: true,
      updatedAt: new Date(),
    }).where(eq(materials.id, existing[0].id)).returning();
    return updated;
  }
  const [inserted] = await db.insert(materials).values({
    code: data.code,
    trade: data.trade,
    category: data.category,
    nameFr: data.nameFr,
    nameAr: data.nameAr ?? null,
    nameDerja: data.nameDerja ?? null,
    baseUnit: data.baseUnit,
    isOfficial: true,
    companyId: null,
    technicalSpecs: data.technicalSpecs ?? null,
  }).returning();
  return inserted;
}

export async function listMaterials({ trade, category, search, page = 1, limit = 20 }: any) {
  const db = await getDatabase();
  if (!db) return { data: [], page, limit, total: 0 };
  let q = db.select().from(materials).where(eq(materials.isDeleted, false));
  if (trade) q = q.where(eq(materials.trade, trade));
  if (category) q = q.where(eq(materials.category, category));
  if (search) q = q.where(sql`${materials.nameFr} ILIKE ${`%${search}%`}`);
  const all = await q;
  const total = all.length;
  const start = (page - 1) * limit;
  const data = all.slice(start, start + limit);
  return { data, page, limit, total };
}

export async function createMaterial(data: any) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  const [inserted] = await db.insert(materials).values(data).returning();
  return inserted;
}

export async function updateMaterial(id: string, patch: any) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  const [updated] = await db.update(materials).set(patch).where(eq(materials.id, id)).returning();
  return updated;
}

export async function softDeleteMaterial(id: string) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  await db.update(materials).set({ isDeleted: true }).where(eq(materials.id, id));
}
