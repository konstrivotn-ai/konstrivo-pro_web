/**
 * Phase 2 — Shared In-Memory Store with JSON File Persistence
 *
 * This is the Phase 2 persistence adapter.
 * Phase 3 will replace this with a Drizzle repository behind the same interface.
 *
 * Data is kept in memory and periodically (or on write) persisted to JSON files
 * in server/data/. This is separate from the frontend's localStorage.
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class MemoryStore {
  private static instance: MemoryStore;
  private stores: Map<string, Map<string, any>> = new Map();
  private persistenceKeys: Map<string, string> = new Map(); // collection name → file path

  private constructor() {}

  static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  /** Get (or create) the in-memory Map for a collection. Optionally loads from JSON. */
  getCollection(name: string, filePath: string): Map<string, any> {
    if (!this.stores.has(name)) {
      this.stores.set(name, new Map<string, any>());
      this.persistenceKeys.set(name, filePath);
      // Load from JSON if file exists
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            const map = this.stores.get(name)!;
            for (const item of data) {
              if (item && item.id) {
                map.set(item.id, item);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[KONSTRIVO] Failed to load ${name} from ${filePath}:`, e);
      }
    }
    return this.stores.get(name)!;
  }

  /** Save a collection to its JSON file. */
  saveCollection(name: string): void {
    const map = this.stores.get(name);
    if (!map) return;
    const filePath = this.persistenceKeys.get(name);
    if (!filePath) return;
    try {
      const data = Array.from(map.values());
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn(`[KONSTRIVO] Failed to save ${name} to ${filePath}:`, e);
    }
  }

  /** Clear a collection from memory and disk (for testing). */
  clearCollection(name: string): void {
    const map = this.stores.get(name);
    if (map) {
      map.clear();
    }
    const filePath = this.persistenceKeys.get(name);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) { /* ignore */ }
    }
  }

  /** Reset all collections (for testing). Also wipes persisted JSON files. */
  resetAll(): void {
    for (const [name, filePath] of this.persistenceKeys) {
      const map = this.stores.get(name);
      if (map) map.clear();
    }
    this.stores.clear();
    this.persistenceKeys.clear();
    // Remove ALL persisted collection files so stale data never leaks between runs.
    try {
      const files = fs.readdirSync(DATA_DIR);
      for (const f of files) {
        if (f.endsWith('.json')) {
          try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }
  }
}

export const memoryStore = MemoryStore.getInstance();
