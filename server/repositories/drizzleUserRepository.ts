// @ts-nocheck
/**
 * Phase 1.1 — Drizzle PostgreSQL User Repository
 * 
 * Real PostgreSQL persistence for Users, replacing MemoryStore.
 * Uses the same IUserRepository interface for compatibility.
 */
import { eq, and, isNull, or } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { users, companies, companyMembers } from '../db/schema/identity';
import { IUserRepository, User } from './userRepository';
import { hashPassword } from '../utils/crypto';

export class DrizzleUserRepository implements IUserRepository {
  private async db() {
    const database = await getDatabase();
    if (!database) throw new Error('PostgreSQL not available');
    return database;
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'version'>): Promise<User> {
    const db = await this.db();
    const result = await db.insert(users).values({
      email: data.email,
      fullName: data.fullName,
      phone: data.phone || '',
      passwordHash: data.passwordHash,
      globalRole: data.role || 'artisan',
      status: data.status || 'active',
      avatarUrl: data.avatarUrl || null,
      region: data.region || null,
      tier: data.tier || 'FREE',
    }).returning();
    
    const row = result[0];
    return this.mapRowToUser(row);
  }

  async findById(id: string): Promise<User | undefined> {
    const db = await this.db();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] ? this.mapRowToUser(result[0]) : undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const db = await this.db();
    const result = await db.select().from(users).where(
      and(eq(users.email, email), isNull(users.deletedAt))
    ).limit(1);
    return result[0] ? this.mapRowToUser(result[0]) : undefined;
  }

  async findByEmailIncludingDeleted(email: string): Promise<User | undefined> {
    const db = await this.db();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] ? this.mapRowToUser(result[0]) : undefined;
  }

  async setStatus(id: string, status: string): Promise<void> {
    const db = await this.db();
    await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id));
  }

  async softDelete(id: string): Promise<void> {
    const db = await this.db();
    await db.update(users).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, id));
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      phone: row.phone || '',
      passwordHash: row.passwordHash,
      role: row.globalRole || 'artisan',
      tier: row.tier || 'FREE',
      status: row.status || 'active',
      avatarUrl: row.avatarUrl || '',
      region: row.region || '',
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
      isDeleted: !!row.deletedAt,
      version: row.version || 1,
    };
  }
}

export const drizzleUserRepository = new DrizzleUserRepository();
