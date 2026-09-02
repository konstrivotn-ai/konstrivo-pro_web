import { getDatabase } from '../db/client';
import { materialPrices, priceSources } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function findPriceById(id: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  const res = await db.select().from(materialPrices).where(eq(materialPrices.id, id)).limit(1);
  return res[0];
}

export async function listPrices(filters: any) {
  const db = await getDatabase();
  if (!db) return { data: [], page: filters.page || 1, limit: filters.limit || 20, total: 0 };
  let q = db.select().from(materialPrices).where(eq(materialPrices.isDeleted, false));
  if (filters.materialId) q = q.where(eq(materialPrices.materialId, filters.materialId));
  if (filters.currency) q = q.where(eq(materialPrices.currencyCode, filters.currency));
  if (filters.source) q = q.where(eq(materialPrices.sourceCode, filters.source));
  if (filters.market) q = q.where(eq(materialPrices.countryCode, filters.market));
  const all = await q;
  const total = all.length;
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const start = (page - 1) * limit;
  const data = all.slice(start, start + limit);
  return { data, page, limit, total };
}

export async function getPriceSources() {
  const db = await getDatabase();
  if (!db) return [];
  const res = await db.select().from(priceSources);
  return res;
}

export async function createPrice(data: any) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  const [inserted] = await db.insert(materialPrices).values({
    materialId: data.materialId,
    sourceCode: data.source,
    countryCode: data.countryCode || 'TN',
    currencyCode: data.currency || 'TND',
    unitPrice: data.price,
    companyId: data.companyId,
    supplierId: data.supplierId,
    isCurrent: data.isCurrent ?? true,
    effectiveFrom: data.effectiveFrom,
    notes: data.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    isDeleted: false,
  }).returning();
  return inserted;
}

export async function updatePrice(id: string, patch: any) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  const [updated] = await db.update(materialPrices).set(patch).where(eq(materialPrices.id, id)).returning();
  return updated;
}

export async function getCurrentPrice(materialId: string, currency = 'TND', market = 'tn') {
  const db = await getDatabase();
  if (!db) return undefined;
  const res = await db.select().from(materialPrices).where(and(eq(materialPrices.materialId, materialId), eq(materialPrices.isCurrent, true), eq(materialPrices.currencyCode, currency), eq(materialPrices.countryCode, market))).limit(1);
  return res[0];
}
