/**
 * Phase 2 — Price Repository
 *
 * Pricing is SEPARATE from Material identity.
 * Seeded from DEFAULT_MARKET_RATES on first access.
 */
import { memoryStore } from './store';
import { config } from '../config';
import { MaterialPrice, PaginatedResult, PriceSource } from '../types';
import { generateId } from '../utils/crypto';
import { buildMaterialsFromRates, PRICE_SOURCES } from './seed';
import { isDatabaseAvailable } from '../db/client';
import * as drizzleRepo from './drizzlePriceRepository';

const COLLECTION = 'material_prices';

export interface PriceFilters {
  materialId?: string;
  currency?: string;
  source?: PriceSource;
  market?: string;
  effectiveDate?: string;
  page?: number;
  limit?: number;
}

export interface IPriceRepository {
  ensureSeeded(): void | Promise<void>;
  findById(id: string): Promise<MaterialPrice | undefined> | MaterialPrice | undefined;
  list(filters: PriceFilters): Promise<PaginatedResult<MaterialPrice>> | PaginatedResult<MaterialPrice>;
  getCurrentPrice(materialId: string, currency?: string, market?: string): Promise<MaterialPrice | undefined> | MaterialPrice | undefined;
  create(data: Partial<MaterialPrice>): Promise<MaterialPrice> | MaterialPrice;
  update(id: string, patch: Partial<MaterialPrice>): Promise<MaterialPrice> | MaterialPrice;
  softDelete(id: string): Promise<void> | void;
  getPriceSources(): Promise<typeof PRICE_SOURCES> | typeof PRICE_SOURCES;
}

class MemoryPriceRepository implements IPriceRepository {
  private get map() {
    return memoryStore.getCollection(COLLECTION, `server/data/${COLLECTION}.json`);
  }

  ensureSeeded(): void {
    if (config.isProduction) {
      throw new Error('[KONSTRIVO] Price repository: in-memory seeding is not allowed in production. Implement Drizzle/Postgres repository.');
    }
    if (this.map.size === 0) {
      const { prices } = buildMaterialsFromRates();
      for (const p of prices) {
        this.map.set(p.id, p);
      }
      memoryStore.saveCollection(COLLECTION);
    }
  }

  findById(id: string): MaterialPrice | undefined {
    this.ensureSeeded();
    const p = this.map.get(id);
    if (!p || (p as MaterialPrice).isDeleted) return undefined;
    return p as MaterialPrice;
  }

  list(filters: PriceFilters): PaginatedResult<MaterialPrice> {
    this.ensureSeeded();
    const all = Array.from(this.map.values()) as MaterialPrice[];
    let filtered = all.filter(p => !p.isDeleted);

    if (filters.materialId) {
      filtered = filtered.filter(p => p.materialId === filters.materialId);
    }
    if (filters.currency) {
      filtered = filtered.filter(p => p.currency === filters.currency);
    }
    if (filters.source) {
      filtered = filtered.filter(p => p.source === filters.source);
    }
    if (filters.market) {
      filtered = filtered.filter(p => p.market === filters.market);
    }
    if (filters.effectiveDate) {
      const d = filters.effectiveDate;
      filtered = filtered.filter(p => {
        const from = p.effectiveFrom;
        const to = p.effectiveTo;
        return from <= d && (!to || to >= d);
      });
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 20;
    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, page, limit, total };
  }

  getCurrentPrice(materialId: string, currency = 'TND', market = 'tn'): MaterialPrice | undefined {
    this.ensureSeeded();
    for (const p of this.map.values()) {
      const price = p as MaterialPrice;
      if (
        price.materialId === materialId &&
        !price.isDeleted &&
        price.isCurrent &&
        price.currency === currency &&
        price.market === market
      ) {
        return price;
      }
    }
    return undefined;
  }

  create(data: Partial<MaterialPrice>): MaterialPrice {
    this.ensureSeeded();
    const now = new Date().toISOString();
    // If marked as current, deactivate other current prices for the same material
    if (data.isCurrent && data.materialId) {
      for (const p of this.map.values()) {
        const price = p as MaterialPrice;
        if (price.materialId === data.materialId && price.isCurrent && !price.isDeleted) {
          price.isCurrent = false;
          price.effectiveTo = new Date().toISOString().slice(0, 10);
          price.updatedAt = now;
          this.map.set(price.id, price);
        }
      }
    }
    const price: MaterialPrice = {
      id: generateId(),
      materialId: data.materialId || '',
      price: data.price ?? 0,
      currency: data.currency || 'TND',
      source: data.source || 'CUSTOM',
      market: data.market || 'tn',
      countryCode: data.countryCode || 'TN',
      supplierId: data.supplierId,
      companyId: data.companyId,
      isCurrent: data.isCurrent ?? true,
      effectiveFrom: data.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: data.effectiveTo,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };
    this.map.set(price.id, price);
    memoryStore.saveCollection(COLLECTION);
    return price;
  }

  update(id: string, patch: Partial<MaterialPrice>): MaterialPrice {
    this.ensureSeeded();
    const existing = this.map.get(id) as MaterialPrice;
    if (!existing) throw new Error('Price not found');
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString(), version: existing.version + 1 };
    this.map.set(id, updated);
    memoryStore.saveCollection(COLLECTION);
    return updated;
  }

  softDelete(id: string): void {
    this.ensureSeeded();
    const existing = this.map.get(id) as MaterialPrice;
    if (!existing) return;
    existing.isDeleted = true;
    existing.updatedAt = new Date().toISOString();
    this.map.set(id, existing);
    memoryStore.saveCollection(COLLECTION);
  }

  getPriceSources() {
    return [...PRICE_SOURCES];
  }
}

class HybridPriceRepository implements IPriceRepository {
  private memory = new MemoryPriceRepository();
  async ensureSeeded() { return this.memory.ensureSeeded(); }
  async findById(id: string) { if (await isDatabaseAvailable()) return await drizzleRepo.findPriceById(id); return this.memory.findById(id); }
  async list(filters: PriceFilters) { if (await isDatabaseAvailable()) return await drizzleRepo.listPrices(filters); return this.memory.list(filters); }
  async getCurrentPrice(materialId: string, currency?: string, market?: string) { if (await isDatabaseAvailable()) return await drizzleRepo.getCurrentPrice(materialId, currency, market); return this.memory.getCurrentPrice(materialId, currency, market); }
  async create(data: Partial<MaterialPrice>) { if (await isDatabaseAvailable()) return await drizzleRepo.createPrice(data); return this.memory.create(data); }
  async update(id: string, patch: Partial<MaterialPrice>) { if (await isDatabaseAvailable()) return await drizzleRepo.updatePrice(id, patch); return this.memory.update(id, patch); }
  async softDelete(id: string) { if (await isDatabaseAvailable()) return await drizzleRepo.updatePrice(id, { isDeleted: true }); return this.memory.softDelete(id); }
  async getPriceSources() { if (await isDatabaseAvailable()) return await drizzleRepo.getPriceSources(); return this.memory.getPriceSources(); }
}

export const priceRepository: IPriceRepository = new HybridPriceRepository();
