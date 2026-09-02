import { getDatabase } from '../db/client';
import { syncOperations } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export async function pullSync(filter: any) {
  const db = await getDatabase();
  if (!db) return [];
  let rows = await db.select().from(syncOperations);
  rows = rows.filter((r: any) => r.syncStatus !== 'deleted');
  if (filter.since) rows = rows.filter((r: any) => r.serverTimestamp > filter.since);
  if (filter.entityTypes && filter.entityTypes.length > 0) rows = rows.filter((r: any) => filter.entityTypes.includes(r.entityType));
  return rows.sort((a: any, b: any) => a.serverTimestamp.localeCompare(b.serverTimestamp));
}

export async function pushSync(userId: string, clientId: string, ops: any[]) {
  const db = await getDatabase();
  if (!db) throw new Error('Database not available');
  const applied: any[] = [];
  const conflicts: any[] = [];
  const now = new Date().toISOString();

  for (const op of ops) {
    const existingAll = await db.select().from(syncOperations).where(sql`${syncOperations.entityType} = ${op.entityType} AND ${syncOperations.entityId} = ${op.entityId}`);
    let cur = existingAll.length > 0 ? existingAll.sort((a: any, b: any) => b.serverTimestamp.localeCompare(a.serverTimestamp))[0] : null;
    if (cur && cur.serverVersion > op.clientVersion) {
      conflicts.push({ id: cur.id, entityId: op.entityId, clientVersion: op.clientVersion, serverVersion: cur.serverVersion, serverTimestamp: cur.serverTimestamp });
      continue;
    }

    const [inserted] = await db.insert(syncOperations).values({
      userId,
      clientId,
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      clientVersion: op.clientVersion,
      serverVersion: (op.clientVersion || 0) + 1,
      clientTimestamp: op.clientTimestamp,
      serverTimestamp: now,
      syncStatus: 'applied',
      payload: JSON.stringify(op.payload),
    }).returning();

    applied.push({ id: inserted.id, entityId: inserted.entityId, serverVersion: inserted.serverVersion, serverTimestamp: inserted.serverTimestamp });
  }

  return { applied, conflicts };
}

export async function findSyncByEntity(entityType: string, entityId: string) {
  const db = await getDatabase();
  if (!db) return undefined;
  const rows = await db.select().from(syncOperations).where(sql`${syncOperations.entityType} = ${entityType} AND ${syncOperations.entityId} = ${entityId}`);
  const sorted = rows.sort((a: any, b: any) => b.serverTimestamp.localeCompare(a.serverTimestamp));
  return sorted[0];
}
