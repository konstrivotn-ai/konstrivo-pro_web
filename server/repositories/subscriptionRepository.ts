/**
 * Phase 2 — Subscription Repository
 */
import { memoryStore } from './store';
import { Subscription, UserTier } from '../types';
import { generateId } from '../utils/crypto';

const COLLECTION = 'subscriptions';

export interface ISubscriptionRepository {
  findByCompanyId(companyId: string): Subscription | undefined;
  create(companyId: string, tier: UserTier): Subscription;
  update(id: string, patch: Partial<Subscription>): Subscription;
}

class MemorySubscriptionRepository implements ISubscriptionRepository {
  private get map() {
    return memoryStore.getCollection(COLLECTION, `server/data/${COLLECTION}.json`);
  }

  findByCompanyId(companyId: string): Subscription | undefined {
    for (const s of this.map.values()) {
      if ((s as Subscription).companyId === companyId) return s as Subscription;
    }
    return undefined;
  }

  create(companyId: string, tier: UserTier): Subscription {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const sub: Subscription = {
      id: generateId(),
      companyId,
      tier,
      status: 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      version: 1,
    };
    // Replace existing subscription for this company
    for (const [key, val] of this.map.entries()) {
      if ((val as Subscription).companyId === companyId) {
        this.map.delete(key);
      }
    }
    this.map.set(sub.id, sub);
    memoryStore.saveCollection(COLLECTION);
    return sub;
  }

  update(id: string, patch: Partial<Subscription>): Subscription {
    const existing = this.map.get(id) as Subscription;
    if (!existing) throw new Error('Subscription not found');
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString(), version: existing.version + 1 };
    this.map.set(id, updated);
    memoryStore.saveCollection(COLLECTION);
    return updated;
  }
}

export const subscriptionRepository: ISubscriptionRepository = new MemorySubscriptionRepository();
