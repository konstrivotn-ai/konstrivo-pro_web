// @ts-nocheck
/**
 * Phase 3 — Drizzle Schema: materials, price_sources, material_prices, package_definitions
 * Requires: npm install drizzle-orm postgres
 */
import { pgTable, uuid, varchar, text, boolean, integer, numeric, timestamp, date, bigint, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './identity';

export const materials = pgTable('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 100 }).notNull(),
  trade: varchar('trade', { length: 50 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  nameFr: text('name_fr').notNull(),
  nameAr: text('name_ar'),
  nameDerja: text('name_derja'),
  baseUnit: varchar('base_unit', { length: 20 }).notNull().default('unit'),
  isOfficial: boolean('is_official').notNull().default(true),
  companyId: uuid('company_id').references(() => companies.id),
  technicalSpecs: text('technical_specs'),
  imageUrl: text('image_url'),
  standardNorm: varchar('standard_norm', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  uqMaterial: uniqueIndex('uq_material_code').on(table.code, table.companyId),
  idxMaterialsTrade: index('idx_materials_trade').on(table.trade),
  idxMaterialsCategory: index('idx_materials_category').on(table.category),
  idxMaterialsCompany: index('idx_materials_company').on(table.companyId),
}));

export const priceSources = pgTable('price_sources', {
  code: varchar('code', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  isVerified: boolean('is_verified').notNull().default(true),
  priorityWeight: integer('priority_weight').notNull().default(50),
});

/** NUMERIC(12,3) for monetary values — never FLOAT. */
export const materialPrices = pgTable('material_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').notNull().references(() => materials.id),
  sourceCode: varchar('source_code', { length: 50 }).notNull().references(() => priceSources.code),
  countryCode: varchar('country_code', { length: 5 }).notNull().default('TN'),
  currencyCode: varchar('currency_code', { length: 5 }).notNull().default('TND'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 3 }).notNull(),
  companyId: uuid('company_id').references(() => companies.id),
  supplierId: uuid('supplier_id'),
  isCurrent: boolean('is_current').notNull().default(true),
  effectiveFrom: date('effective_from').notNull().defaultNow(),
  effectiveTo: date('effective_to'),
  packageDefinitionId: uuid('package_definition_id'),
  packagePrice: numeric('package_price', { precision: 12, scale: 3 }),
  supplierCatalogItemId: uuid('supplier_catalog_item_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
}, (table) => ({
  idxMaterial: index('idx_prices_material').on(table.materialId),
  idxCurrent: index('idx_prices_is_current').on(table.isCurrent),
  idxPricesCountry: index('idx_prices_country').on(table.countryCode),
  idxPricesCurrency: index('idx_prices_currency').on(table.currencyCode),
  idxPricesCompany: index('idx_prices_company').on(table.companyId),
  idxPricesSupplier: index('idx_prices_supplier').on(table.supplierId),
  idxPricesEffectiveFrom: index('idx_prices_effective_from').on(table.effectiveFrom),
}));

/**
 * package_definitions — mirrors server/db/migrations/0001_initial.sql exactly.
 * Supports package-aware price lookup (material_prices.package_definition_id).
 * FK: material_id → materials.id
 */
export const packageDefinitions = pgTable('package_definitions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  materialId: uuid('material_id').notNull().references(() => materials.id),
  packageType: varchar('package_type', { length: 20 }).notNull().default('unit'),
  unitsPerPackage: numeric('units_per_package', { precision: 12, scale: 3 }).notNull().default('1'),
  allowPartial: boolean('allow_partial').notNull().default(false),
  barcode: varchar('barcode', { length: 50 }),
  packageDimensions: varchar('package_dimensions', { length: 100 }),
  packageWeightKg: numeric('package_weight_kg', { precision: 10, scale: 3 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
});
