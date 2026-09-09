/**
 * Phase 2A — Trade Repository
 *
 * Independent, dynamic trade (métier) registry. The 12 canonical official
 * trades are seeded on first access (memory mode) so the lookup is usable
 * without a database; when PostgreSQL is available the hybrid repository
 * reads from the `trades` table.
 *
 * Read-only by design: only the operations the current architecture needs
 * (official trades, lookup by code/id, and Material↔Trade resolution).
 *
 * Material↔Trade integration:
 *   `findForMaterial({ tradeId, trade })` resolves a material's trade using
 *   the existing `materials.trade_id` Drizzle relationship, falling back to
 *   the legacy `material.trade` code when no tradeId is present. This keeps
 *   all existing material list/search/filter queries unchanged and never
 *   adds new fields to the Material API contract.
 */
import { memoryStore } from './store';
import { Trade } from '../types';
import * as drizzleRepo from './drizzleTradeRepository';
import { isDatabaseAvailable } from '../db/client';

const COLLECTION = 'trades';

/** Deterministic identity so in-memory trades are addressable across repos. */
export function officialTradeId(code: string): string {
  return `trade_${code}`;
}

/**
 * The 12 canonical official trades. `code` values match the existing
 * `TradeCategory` union in src/types.ts (kept in sync with the catalog seed).
 */
export const OFFICIAL_TRADES: Array<{
  code: string;
  labelFr: string;
  labelAr?: string;
  labelDerja?: string;
  icon?: string;
  sortOrder: number;
}> = [
  { code: 'placo', labelFr: 'PLACO / PLÂTRE', labelAr: 'جبس وبلاطور', labelDerja: 'جبس وبلاطور', icon: 'Layers', sortOrder: 1 },
  { code: 'peinture', labelFr: 'PEINTURE', labelAr: 'دهان وطلاء', labelDerja: 'دهان', icon: 'Paintbrush', sortOrder: 2 },
  { code: 'carrelage', labelFr: 'CARRELAGE', labelAr: 'تبليط وسيراميك', labelDerja: 'زربيعة', icon: 'Grid3x3', sortOrder: 3 },
  { code: 'maconnerie', labelFr: 'MAÇONNERIE', labelAr: 'بناء بالأجر', labelDerja: 'بناء', icon: 'BrickWall', sortOrder: 4 },
  { code: 'plomberie', labelFr: 'PLOMBERIE', labelAr: 'سباكية', labelDerja: 'سباكية', icon: 'Droplets', sortOrder: 5 },
  { code: 'electricite', labelFr: 'ÉLECTRICITÉ', labelAr: 'كهرباء', labelDerja: 'كهرباء', icon: 'Zap', sortOrder: 6 },
  { code: 'etancheite', labelFr: 'ÉTANCHÉITÉ', labelAr: 'عزل مائي', labelDerja: 'عزل ماء', icon: 'ShieldCheck', sortOrder: 7 },
  { code: 'isolation', labelFr: 'ISOLATION', labelAr: 'عزل حراري', labelDerja: 'عزل حرارة', icon: 'Thermometer', sortOrder: 8 },
  { code: 'menuiserie', labelFr: 'MENUISERIE', labelAr: 'نجارة', labelDerja: 'نجارة', icon: 'Hammer', sortOrder: 9 },
  { code: 'sols', labelFr: 'REVÊTEMENTS DE SOL', labelAr: 'أرضيات', labelDerja: 'أرضيات', icon: 'LayoutGrid', sortOrder: 10 },
  { code: 'facade', labelFr: 'FAÇADE & EXTÉRIEUR', labelAr: 'واجهات خارجية', labelDerja: 'واجهات', icon: 'Building2', sortOrder: 11 },
  { code: 'demolition', labelFr: 'DÉMOLITION', labelAr: 'هدم وإزالة', labelDerja: 'هدم', icon: 'Trash2', sortOrder: 12 },
];
const now = () => new Date().toISOString();

/** Build the canonical official Trade entities (memory seed). */
export function buildTradesFromCatalog(): Trade[] {
  const timestamp = now();
  return OFFICIAL_TRADES.map((t) => ({
    id: officialTradeId(t.code),
    code: t.code,
    labelFr: t.labelFr,
    labelAr: t.labelAr,
    labelDerja: t.labelDerja,
    icon: t.icon,
    sortOrder: t.sortOrder,
    isActive: true,
    isOfficial: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

export interface ITradeRepository {
  ensureSeeded(): void;
  findById(id: string): Promise<Trade | undefined> | Trade | undefined;
  findByCode(code: string): Promise<Trade | undefined> | Trade | undefined;
  list(officialOnly?: boolean): Promise<Trade[]> | Trade[];
  findForMaterial(material: { tradeId?: string | null; trade?: string }): Promise<Trade | undefined> | Trade | undefined;
  count(): number;
}
class MemoryTradeRepository implements ITradeRepository {
  private get map() {
    return memoryStore.getCollection(COLLECTION, `server/data/${COLLECTION}.json`);
  }

  ensureSeeded(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[KONSTRIVO] Trade repository: in-memory seeding is not allowed in production. Implement Drizzle/Postgres repository.');
    }
    if (this.map.size === 0) {
      for (const t of buildTradesFromCatalog()) this.map.set(t.id, t);
      memoryStore.saveCollection(COLLECTION);
    }
  }

  findById(id: string): Trade | undefined {
    this.ensureSeeded();
    const t = this.map.get(id);
    return t as Trade | undefined;
  }

  findByCode(code: string): Trade | undefined {
    this.ensureSeeded();
    for (const t of this.map.values()) {
      if ((t as Trade).code === code) return t as Trade;
    }
    return undefined;
  }

  list(officialOnly = false): Trade[] {
    this.ensureSeeded();
    const all = Array.from(this.map.values()) as Trade[];
    return officialOnly ? all.filter((t) => t.isOfficial) : all;
  }

  findForMaterial(material: { tradeId?: string | null; trade?: string }): Trade | undefined {
    this.ensureSeeded();
    if (material.tradeId) {
      const byId = this.findById(material.tradeId);
      if (byId) return byId;
    }
    if (material.trade) return this.findByCode(material.trade);
    return undefined;
  }

  count(): number {
    this.ensureSeeded();
    return this.list(false).length;
  }
}

/**
 * Returns true when PostgreSQL is genuinely reachable.
 * NOTE: NODE_ENV (including NODE_ENV=test) NEVER forces memory mode.
 * The ONLY signal is real Drizzle/PostgreSQL availability.
 */
async function isPgAvailable(): Promise<boolean> {
  return await isDatabaseAvailable();
}

/**
 * Mirror a PostgreSQL trade row into the in-memory collection so that
 * synchronous MemoryTradeRepository reads (used directly by some
 * repository-level tests) can also see dynamically created trades.
 * Official trades are never modified; dynamic trades stay non-official.
 */
function mirrorDbTradeToMemory(dbTrade: any): void {
  if (!dbTrade || !dbTrade.code) return;
  try {
    const map = memoryStore.getCollection(COLLECTION, `server/data/${COLLECTION}.json`);
    // De-duplicate: drop stale non-official memory placeholders with the same
    // code but a different id (e.g. `trade_gypsum` vs the real UUID row),
    // so findByCode/list stay consistent and counts don't inflate.
    // Official trades are never touched.
    for (const [key, val] of Array.from(map.entries())) {
      const t = val as Trade;
      if (t && (t as any).code === dbTrade.code && (t as any).id !== dbTrade.id && !(t as any).isOfficial) {
        map.delete(key);
      }
    }
    const toIso = (v: any) => (v instanceof Date ? v.toISOString() : (typeof v === 'string' ? v : now()));
    const mirrored: Trade = {
      id: dbTrade.id,
      code: dbTrade.code,
      labelFr: dbTrade.labelFr ?? dbTrade.code,
      labelAr: dbTrade.labelAr ?? undefined,
      labelDerja: dbTrade.labelDerja ?? undefined,
      icon: dbTrade.icon ?? undefined,
      sortOrder: dbTrade.sortOrder ?? 999,
      isActive: dbTrade.isActive ?? true,
      // Never promote a dynamic trade to official via the mirror.
      isOfficial: dbTrade.isOfficial ?? false,
      createdAt: toIso(dbTrade.createdAt),
      updatedAt: toIso(dbTrade.updatedAt),
    } as Trade;
    map.set(mirrored.id, mirrored);
    memoryStore.saveCollection(COLLECTION);
  } catch {
    // Mirroring is best-effort; the PostgreSQL row remains the source of truth.
  }
}

class HybridTradeRepository implements ITradeRepository {
  private memory = new MemoryTradeRepository();

  async ensureSeeded(): Promise<void> { return this.memory.ensureSeeded(); }

  async findById(id: string) {
    // Use Drizzle/PostgreSQL whenever genuinely available — including
    // NODE_ENV=test. Memory/canonical data is ONLY a fallback when
    // PostgreSQL is genuinely unavailable.
    if (await isPgAvailable()) {
      const row = await drizzleRepo.findTradeById(id);
      if (row) {
        mirrorDbTradeToMemory(row);
        return row;
      }
      return undefined;
    }
    return this.memory.findById(id);
  }

  async findByCode(code: string) {
    // Use Drizzle/PostgreSQL whenever genuinely available — including
    // NODE_ENV=test. Memory/canonical data is ONLY a fallback when
    // PostgreSQL is genuinely unavailable.
    if (await isPgAvailable()) {
      const row = await drizzleRepo.findTradeByCode(code);
      if (row) {
        mirrorDbTradeToMemory(row);
        return row;
      }
      return undefined;
    }
    return this.memory.findByCode(code);
  }

  async list(officialOnly = false) {
    // No "12 trades only" restriction: return every matching PostgreSQL row
    // (official + dynamic). officialOnly still filters to official trades.
    if (await isPgAvailable()) return await drizzleRepo.listTrades({ officialOnly });
    return this.memory.list(officialOnly);
  }

  async findForMaterial(material: { tradeId?: string | null; trade?: string }) {
    if (await isPgAvailable()) {
      // Resolve via material.tradeId first, only then fall back to the
      // legacy material.trade code for backward compatibility.
      if (material.tradeId) {
        const byId = await drizzleRepo.findTradeById(material.tradeId);
        if (byId) {
          mirrorDbTradeToMemory(byId);
          return byId;
        }
      }
      if (material.trade) {
        const byCode = await drizzleRepo.findTradeByCode(material.trade);
        if (byCode) mirrorDbTradeToMemory(byCode);
        return byCode;
      }
      return undefined;
    }
    return this.memory.findForMaterial(material);
  }

  count(): number {
    return this.memory.count();
  }
}

export { MemoryTradeRepository };

/**
 * Phase B — Create a trade by code if it does not already exist.
 *
 * Delegates to the Drizzle repository when PostgreSQL is available, otherwise
 * creates the trade in the in-memory store. Official trades are never modified.
 * Idempotent: returns the existing trade if the code is already present.
 */
export async function upsertTradeByCode(code: string, label?: string) {
  // PostgreSQL is used whenever genuinely available — including NODE_ENV=test.
  // NODE_ENV NEVER forces memory mode; memory stays purely as a fallback.
  if (await isPgAvailable()) {
    const row = await drizzleRepo.upsertTradeByCode(code, label);
    if (row) mirrorDbTradeToMemory(row);
    return row;
  }
  // Memory mode (PostgreSQL genuinely unavailable only)
  const existing = await tradeRepository.findByCode(code);
  if (existing) return existing;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[KONSTRIVO] Trade repository: in-memory trade creation is not allowed in production.');
  }
  const timestamp = now();
  const newTrade: Trade = {
    id: `trade_${code}`,
    code,
    labelFr: label || code,
    labelAr: undefined,
    labelDerja: undefined,
    icon: undefined,
    sortOrder: 999,
    isActive: true,
    isOfficial: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const map = memoryStore.getCollection(COLLECTION, `server/data/${COLLECTION}.json`);
  map.set(newTrade.id, newTrade);
  memoryStore.saveCollection(COLLECTION);
  return newTrade;
}

export const tradeRepository: ITradeRepository = new HybridTradeRepository();