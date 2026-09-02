/**
 * Phase 2 — Material Repository
 *
 * Material identity is separate from pricing.
 * Seeded from DEFAULT_MARKET_RATES on first access.
 */
import { memoryStore } from './store';
import { Material, PaginatedResult } from '../types';
import { generateId } from '../utils/crypto';
import { buildMaterialsFromRates } from './seed';
import { isDatabaseAvailable } from '../db/client';
import * as drizzleRepo from './drizzleMaterialRepository';

const COLLECTION = 'materials';

export interface MaterialFilters {
  trade?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  isOfficial?: boolean;
  companyId?: string;
}

export interface IMaterialRepository {
  ensureSeeded(): void;
  findById(id: string): Promise<Material | undefined> | Material | undefined;
  findByCode(code: string): Promise<Material | undefined> | Material | undefined;
  list(filters: MaterialFilters): Promise<PaginatedResult<Material>> | PaginatedResult<Material>;
  create(data: Partial<Material>): Promise<Material> | Material;
  update(id: string, patch: Partial<Material>): Promise<Material> | Material;
  softDelete(id: string): Promise<void> | void;
  count(): number;
}

class MemoryMaterialRepository implements IMaterialRepository {
  private get map() {
    return memoryStore.getCollection(COLLECTION, `server/data/${COLLECTION}.json`);
  }

  ensureSeeded(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[KONSTRIVO] Material repository: in-memory seeding is not allowed in production. Implement Drizzle/Postgres repository.');
    }
    if (this.map.size === 0) {
      const { materials } = buildMaterialsFromRates();
      for (const m of materials) {
        this.map.set(m.id, m);
      }
      memoryStore.saveCollection(COLLECTION);
    }
  }

  findById(id: string): Material | undefined {
    this.ensureSeeded();
    const m = this.map.get(id);
    if (!m || (m as Material).isDeleted) return undefined;
    return m as Material;
  }

  findByCode(code: string): Material | undefined {
    this.ensureSeeded();
    for (const m of this.map.values()) {
      const mat = m as Material;
      if (mat.code === code && !mat.isDeleted) return mat;
    }
    return undefined;
  }

  list(filters: MaterialFilters): PaginatedResult<Material> {
    this.ensureSeeded();
    const all = Array.from(this.map.values()) as Material[];
    let filtered = all.filter(m => !m.isDeleted);

    if (filters.isOfficial !== undefined) {
      filtered = filtered.filter(m => m.isOfficial === filters.isOfficial);
    }
    if (filters.companyId) {
      filtered = filtered.filter(m => m.companyId === filters.companyId);
    }
    if (filters.trade) {
      filtered = filtered.filter(m => m.trade === filters.trade);
    }
    if (filters.category) {
      filtered = filtered.filter(m => m.category === filters.category || m.trade === filters.category);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(m =>
        m.nameFr.toLowerCase().includes(q) ||
        m.nameAr.toLowerCase().includes(q) ||
        m.nameDerja.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q)
      );
    }

    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 20;
    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, page, limit, total };
  }

  create(data: Partial<Material>): Material {
    this.ensureSeeded();
    const now = new Date().toISOString();
    const material: Material = {
      id: data.id || generateId(),
      code: data.code || data.id || generateId(),
      trade: data.trade || '',
      category: data.category || data.trade || '',
      nameFr: data.nameFr || '',
      nameAr: data.nameAr || '',
      nameDerja: data.nameDerja || '',
      baseUnit: data.baseUnit || 'unit',
      isOfficial: data.isOfficial ?? false,
      companyId: data.companyId ?? null,
      technicalSpecs: data.technicalSpecs,
      imageUrl: data.imageUrl,
      standardNorm: data.standardNorm,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    };
    this.map.set(material.id, material);
    memoryStore.saveCollection(COLLECTION);
    return material;
  }

  update(id: string, patch: Partial<Material>): Material {
    this.ensureSeeded();
    const existing = this.map.get(id) as Material;
    if (!existing) throw new Error('Material not found');
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString(), version: existing.version + 1 };
    this.map.set(id, updated);
    memoryStore.saveCollection(COLLECTION);
    return updated;
  }

  softDelete(id: string): void {
    this.ensureSeeded();
    const existing = this.map.get(id) as Material;
    if (!existing) return;
    existing.isDeleted = true;
    existing.deletedAt = new Date().toISOString();
    existing.updatedAt = new Date().toISOString();
    this.map.set(id, existing);
    memoryStore.saveCollection(COLLECTION);
  }

  count(): number {
    this.ensureSeeded();
    return Array.from(this.map.values()).filter(m => !(m as Material).isDeleted).length;
  }
}

class HybridMaterialRepository implements IMaterialRepository {
  private memory = new MemoryMaterialRepository();
  async ensureSeeded(): Promise<void> { return this.memory.ensureSeeded(); }
  async findById(id: string) { if (await isDatabaseAvailable()) return await drizzleRepo.findMaterialById(id); return this.memory.findById(id); }
  async findByCode(code: string) { if (await isDatabaseAvailable()) return await drizzleRepo.findMaterialByCode(code); return this.memory.findByCode(code); }
  async list(filters: MaterialFilters) { if (await isDatabaseAvailable()) return await drizzleRepo.listMaterials(filters); return this.memory.list(filters); }
  async create(data: Partial<Material>) { if (await isDatabaseAvailable()) return await drizzleRepo.createMaterial(data); return this.memory.create(data); }
  async update(id: string, patch: Partial<Material>) { if (await isDatabaseAvailable()) return await drizzleRepo.updateMaterial(id, patch); return this.memory.update(id, patch); }
  async softDelete(id: string) { if (await isDatabaseAvailable()) return await drizzleRepo.softDeleteMaterial(id); return this.memory.softDelete(id); }
  count(): number { return this.memory.count(); }
}

export const materialRepository: IMaterialRepository = new HybridMaterialRepository();
