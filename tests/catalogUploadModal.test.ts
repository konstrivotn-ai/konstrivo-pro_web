/**
 * CatalogUploadModal — Smart Mapping / CSV parsing / validation unit tests.
 *
 * These tests import the pure helpers of src/components/CatalogUploadModal.tsx
 * (parseCsvContent, resolveMapping, buildParsedItems, parseImportPrice) and
 * cover the required scenarios:
 *   1. Plain CSV (supplier-style headers)
 *   2. Master CSV (price_ht NOT in the last column; trailing effective_to /
 *      observed_at / status must never be read as the price)
 *   3. Semicolon-separated CSV
 *   4. CSV with a UTF-8 BOM
 *   5. CSV without a price column → mapping must miss price_ht (the UI then
 *      shows the clear error; here we assert the mapping contract)
 *   6. Row validation reasons (missing name / unit, invalid price…)
 *
 * Run: npx tsx tests/catalogUploadModal.test.ts
 */
import { strictEqual, ok as assertOk } from 'assert';
import {
  parseCsvContent,
  resolveMapping,
  buildParsedItems,
  parseImportPrice
} from '../src/components/CatalogUploadModal';
import type { MaterialRate } from '../src/types';

const EMPTY_RATES: MaterialRate[] = [];
const HT19 = { taxMode: 'ht' as const, tvaRate: 19, rates: EMPTY_RATES };

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (err: any) {
    failed++;
    const msg = `  FAIL ${name}\n       ${err?.message || err}`;
    failures.push(msg);
    console.log(msg);
  }
}

function mappingOfCsv(content: string) {
  const rows = parseCsvContent(content);
  return resolveMapping(rows.length > 0 ? Object.keys(rows[0]) : []);
}

console.log('\n📥 CatalogUploadModal — Smart Mapping & CSV Validation Tests\n');

// ── 1) Plain simple CSV (supplier classic headers) ──────────────────────────
test('simple CSV with supplier headers parses and maps price_ht', () => {
  const csv = `Reference,Designation,Categorie,Unite,Prix_HT_TND
PLA-BA13-STD,Plaque de plâtre BA13 Standard 1.2x2.5m,placo,unit,31.500`;
  const rows = parseCsvContent(csv);
  strictEqual(rows.length, 1);
  const mapping = resolveMapping(Object.keys(rows[0]));
  strictEqual(mapping.material_code, 'Reference');
  strictEqual(mapping.material_name, 'Designation');
  strictEqual(mapping.category, 'Categorie');
  strictEqual(mapping.unit, 'Unite');
  strictEqual(mapping.price_ht, 'Prix_HT_TND');

  const { items, errors } = buildParsedItems(rows, mapping, HT19);
  strictEqual(errors.length, 0);
  strictEqual(items.length, 1);
  strictEqual(items[0].newPriceTnd, 31.5);
  strictEqual(items[0].tvaRate, 19); // default TVA from UI when file has none
  strictEqual(items[0].currency, 'TND'); // default currency
  strictEqual(items[0].unit, 'unit');
});

// ── 2) Master CSV — price_ht NOT in the last column ──────────────────────────
test('Master CSV: price_ht honored even though it is not the last column', () => {
  const csv = `material_code,material_name,category,trade,unit,price_ht,tva_rate,currency,source,effective_from,effective_to,observed_at,status
PLA-BA13-STD,Plaque de plâtre BA13 Standard 1.2x2.5m,placo,placo,unit,31.500,19,TND,Comptoir BTP,2026-01-01,2027-01-01,2026-09-01,active`;
  const rows = parseCsvContent(csv);
  strictEqual(rows.length, 1);
  const mapping = resolveMapping(Object.keys(rows[0]));
  strictEqual(mapping.price_ht, 'price_ht');

  const { items, errors } = buildParsedItems(rows, mapping, HT19);
  strictEqual(errors.length, 0);
  strictEqual(items[0].nameFr, 'Plaque de plâtre BA13 Standard 1.2x2.5m');
  strictEqual(items[0].newPriceTnd, 31.5, 'price must come from price_ht, not from effective_to/observed_at/status');
  strictEqual(items[0].tvaRate, 19, 'tva_rate read from its own column');
  strictEqual(items[0].unitPriceTtc, 37.485, 'TTC = HT × 1.19');
  strictEqual(items[0].unit, 'unit');
});

// ── 3) Semicolon-separated CSV ───────────────────────────────────────────────
test('semicolon-delimited CSV (French supplier format)', () => {
  const csv = `Référence;Désignation;Unité;Prix HT;TVA
REF-1;Plaque BA13;unit;12,5;19`;
  const rows = parseCsvContent(csv);
  strictEqual(rows.length, 1);
  const mapping = resolveMapping(Object.keys(rows[0]));
  strictEqual(mapping.material_code, 'Référence');
  strictEqual(mapping.material_name, 'Désignation');
  strictEqual(mapping.unit, 'Unité');
  strictEqual(mapping.price_ht, 'Prix HT');
  strictEqual(mapping.tva_rate, 'TVA');

  const { items, errors } = buildParsedItems(rows, mapping, HT19);
  strictEqual(errors.length, 0);
  strictEqual(items[0].newPriceTnd, 12.5, '"12,5" normalized to 12.5');
  strictEqual(items[0].tvaRate, 19, 'file TVA wins over UI default');
});

// ── 4) UTF-8 BOM CSV ─────────────────────────────────────────────────────────
test('CSV with UTF-8 BOM is parsed (BOM stripped from first header)', () => {
  const csv = '\uFEFFmaterial_code,material_name,unit,price_ht\nC1,Tuyau PVC,ml,4.200';
  const rows = parseCsvContent(csv);
  strictEqual(rows.length, 1);
  const mapping = resolveMapping(Object.keys(rows[0]));
  strictEqual(mapping.material_code, 'material_code');
  strictEqual(mapping.price_ht, 'price_ht');
  const { items, errors } = buildParsedItems(rows, mapping, HT19);
  strictEqual(errors.length, 0);
  strictEqual(items[0].newPriceTnd, 4.2);
});

// ── 5) CSV without a price column → mapping must NOT fabricate a price ───────
test('CSV without a price column produces NO price mapping (clear error in UI)', () => {
  const csv = `material_code,material_name,unit
C1,Tuyau PVC,ml`;
  const rows = parseCsvContent(csv);
  const mapping = resolveMapping(Object.keys(rows[0]));
  strictEqual(typeof mapping.price_ht, 'undefined', 'price_ht must remain unmapped');
  strictEqual(mapping.material_name, 'material_name');

  // The UI surfaces this via processRows(): "Aucune colonne de prix reconnue…".
  // Here we assert treat-nothing-as-price: NO item is ever produced, and every
  // row lands in errors with a missing-price reason.
  const { items, errors } = buildParsedItems(rows, mapping, HT19);
  strictEqual(items.length, 0);
  assertOk(errors.length >= 1, 'rows rejected: status/observed_at are never interpreted as price');
  assertOk(errors[0].reason.includes('Prix HT'), 'clear missing-price reason');
});

// ── 6) Row validation reasons ────────────────────────────────────────────────
test('invalid rows are reported with a clear reason, valid ones kept', () => {
  const csv = `material_code,material_name,unit,price_ht
C1,Bonne ligne,unit,10
C2,,unit,10
C3,Sans unité,,10
C4,Prix zéro,unit,0
C5,Prix Négatif,unit,-5
C6,Prix texte,unit,abc
C7,Bonne ligne 2,ml,3`;
  const rows = parseCsvContent(csv);
  strictEqual(rows.length, 7);
  const mapping = resolveMapping(Object.keys(rows[0]));
  const { items, errors } = buildParsedItems(rows, mapping, HT19);
  strictEqual(items.length, 2, 'rows C1 and C7 are valid');
  strictEqual(errors.length, 5);
  assertOk(errors.some((e) => e.row === 3 && e.reason.includes('material_name')), 'missing name reason');
  assertOk(errors.some((e) => e.row === 4 && e.reason.includes('Unité')), 'missing unit reason');
  assertOk(errors.some((e) => e.row === 5 && e.reason.includes('> 0')), 'zero price reason');
  assertOk(errors.some((e) => e.row === 7 && e.reason.includes('> 0')), 'non-numeric price reason');
});

// ── 7) Price / TVA number normalization ──────────────────────────────────────
test('price parser handles French decimal comma, spaces and thousands', () => {
  strictEqual(parseImportPrice('31,50'), 31.5);
  strictEqual(parseImportPrice('1 500,25'), 1500.25);
  strictEqual(parseImportPrice('12.5'), 12.5);
  strictEqual(parseImportPrice('0'), 0);
  strictEqual(parseImportPrice('abc'), null);
  strictEqual(parseImportPrice(''), null);
});

// ── 8) Supplier aliases (liste de la spec) — no fixed column order ───────────
test('supplier alias variants (ref/code, produit, devise, fournisseur…) are mapped', () => {
  const csv = `code;produit;unit;fournisseur;devise;prix_ht;status;observed_at
A1;Tube PVC;ml;Quincaillerie X;TND;5.000;active;2026-09-01`;
  const rows = parseCsvContent(csv);
  const mapping = resolveMapping(Object.keys(rows[0]));
  strictEqual(mapping.material_code, 'code');
  strictEqual(mapping.material_name, 'produit');
  strictEqual(mapping.unit, 'unit');
  strictEqual(mapping.source, 'fournisseur');
  strictEqual(mapping.currency, 'devise');
  strictEqual(mapping.price_ht, 'prix_ht');

  const { items, errors } = buildParsedItems(rows, mapping, HT19);
  strictEqual(errors.length, 0);
  strictEqual(items[0].newPriceTnd, 5, 'prix_ht used even though status/observed_at come after');
});

// ── 9) Tab-separated + quoted comma value ────────────────────────────────────
test('tab-separated CSV and quoted value containing a comma are kept intact', () => {
  const csv = 'material_code\tmaterial_name\tunit\tprice_ht\nT1\t"Vis, clous et chevilles, boîte"\tboite\t9.900';
  const rows = parseCsvContent(csv);
  strictEqual(rows.length, 1);
  strictEqual(rows[0].material_name, 'Vis, clous et chevilles, boîte', 'quoted comma preserved');
  const mapping = resolveMapping(Object.keys(rows[0]));
  const { items, errors } = buildParsedItems(rows, mapping, HT19);
  strictEqual(errors.length, 0);
  strictEqual(items[0].newPriceTnd, 9.9);
});

console.log('\n═══════════════════════════════════════════');
console.log(` CatalogUploadModal: ✅ ${passed} passed | ❌ ${failed} failed`);
console.log('═══════════════════════════════════════════\n');
if (failures.length > 0) {
  console.log('FAILED TESTS:');
  failures.forEach((f) => console.log(f));
  console.log('');
}
process.exit(failed > 0 ? 1 : 0);