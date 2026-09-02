import { getDatabase } from '../db/client';
import { devis, devisItems, idempotencyKeys } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

async function generateDevisNumber(db: any) {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const rows = await db.select({ devisNumber: devis.devisNumber }).from(devis).where(sql`${devis.devisNumber} LIKE ${`${prefix}%`}`);
  let maxNum = 0;
  for (const r of rows) {
    const match = r.devisNumber?.match(/DEV-\d{4}-(\d+)/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return `${prefix}${String(maxNum + 1).padStart(5, '0')}`;
}

export async function findDevisById(id: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  const d = await db.select().from(devis).where(eq(devis.id, id)).limit(1);
  if (!d || d.length === 0) return undefined;
  const items = await db.select().from(devisItems).where(eq(devisItems.devisId, id));
  return { ...d[0], items };
}

export async function listDevis(filters: any) {
  const db = await getDatabase();
  if (!db) return { data: [], page: filters.page || 1, limit: filters.limit || 20, total: 0 };
  let q = db.select().from(devis).where(eq(devis.isDeleted, false));
  if (filters.companyId) q = q.where(eq(devis.companyId, filters.companyId));
  if (filters.status) q = q.where(eq(devis.status, filters.status));
  if (filters.search) q = q.where(sql`${devis.clientName} ILIKE ${`%${filters.search}%`} OR ${devis.projectTitle} ILIKE ${`%${filters.search}%`} OR ${devis.reference} ILIKE ${`%${filters.search}%`} OR ${devis.devisNumber} ILIKE ${`%${filters.search}%`}`);
  const all = await q;
  all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = all.length;
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const start = (page - 1) * limit;
  const data = all.slice(start, start + limit);
  return { data, page, limit, total };
}

export async function createDevis(input: any) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  const tx = await db.transaction();
  try {
    const devisNumber = await generateDevisNumber(db);
    const now = new Date();
    const [inserted] = await tx.insert(devis).values({
      companyId: input.companyId,
      createdByUserId: input.createdByUserId,
      devisNumber,
      reference: input.reference || devisNumber,
      date: input.date,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientAddress: input.clientAddress,
      projectTitle: input.projectTitle,
      country: input.country,
      currency: input.currency,
      region: input.region,
      totalMaterialsCostTnd: input.totalMaterialsCostTnd,
      totalLaborCostTnd: input.totalLaborCostTnd,
      taxRatePercent: input.tvaPercent,
      taxAmountTnd: input.tvaAmount,
      grandTotalTnd: input.grandTotal,
      status: input.status || 'draft',
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    }).returning();

    const items = input.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await tx.insert(devisItems).values({
        devisId: inserted.id,
        lineNumber: i + 1,
        materialId: it.materialId,
        trade: it.trade,
        title: it.title,
        descriptionSnapshot: it.descriptionSnapshot,
        unit: it.unit,
        exactCalculatedQuantity: it.exactCalculatedQuantity,
        wasteIncludedQuantity: it.wasteIncludedQuantity,
        billableQuantity: it.billableQuantity,
        unitPriceAppliedTnd: it.unitPriceAppliedTnd,
        totalPriceTnd: it.totalPriceTnd,
        isCustomAdded: it.isCustomAdded,
        packageDetailsSnapshot: it.packageDetailsSnapshot,
        supplierReference: it.supplierReference,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    }

    // Idempotency: store idempotency key if provided
    if (input.idempotencyKey) {
      await tx.insert(idempotencyKeys).values({ key: input.idempotencyKey, entityType: 'devis', entityId: inserted.id, responseSnapshot: JSON.stringify({ id: inserted.id }) }).returning();
    }

    await tx.commit();
    return findDevisById(inserted.id);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function updateDevis(id: string, patch: any, expectedVersion?: number) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  const existing = await db.select().from(devis).where(eq(devis.id, id)).limit(1);
  if (!existing || existing.length === 0) throw new Error('Devis not found');
  const cur = existing[0];
  if (expectedVersion !== undefined && Number(expectedVersion) !== Number(cur.version)) {
    const err: any = new Error(`Version conflict: expected ${expectedVersion}, server has ${cur.version}`);
    err.statusCode = 409; err.code = 'CONFLICT'; throw err;
  }
  const [updated] = await db.update(devis).set({ ...patch, updatedAt: new Date(), version: (cur.version || 1) + 1 }).where(eq(devis.id, id)).returning();
  return findDevisById(updated.id);
}

export async function softDeleteDevis(id: string) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  await db.update(devis).set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() }).where(eq(devis.id, id));
}

export async function findDevisByIdempotencyKey(key: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  const rows = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key)).limit(1);
  if (!rows || rows.length === 0) return undefined;
  const entry = rows[0];
  const d = await findDevisById(entry.entityId);
  return d;
}

export async function storeIdempotencyKey(key: string, devisId: string) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  await db.insert(idempotencyKeys).values({ key, entityType: 'devis', entityId: devisId, responseSnapshot: JSON.stringify({ id: devisId }) });
}
