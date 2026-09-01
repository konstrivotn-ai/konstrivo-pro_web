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
  findById(id: string): Material | undefined;
  findByCode(code: string): Material | undefined;
  list(filters: MaterialFilters): PaginatedResult<Material>;
  create(data: Partial<Material>): Material;
  update(id: string, patch: Partial<Material>): Material;
  softDelete(id: string): void;
  count(): number;
}

class MemoryMaterialRepository implements IMaterialRepository {
  private get map() {
    return memoryStore.getCollection(COLLECTION, `server/data/${COLLECTION}.json`);
  }

  ensureSeeded(): void {
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

export const materialRepository: IMaterialRepository = new MemoryMaterialRepository();
