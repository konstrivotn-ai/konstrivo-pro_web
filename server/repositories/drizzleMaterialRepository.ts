import { getDatabase } from '../db/client';
import { materials } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

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
