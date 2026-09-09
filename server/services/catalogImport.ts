/**
 * Phase C — Shared Smart-Mapping Catalog Import Pipeline
 *
 * ONE pipeline used by ALL catalog import entry points:
 *
 *   CSV (.csv)  ─┐
 *   XLSX (.xlsx) ─┤→ Parser → Column Detection → Smart Mapping →
 *                 │   Canonical Normalization → Validation →
 *                 └─ Existing catalog commit (trades + materials + prices)
 *
 * - Extracted from the Phase A `POST /catalog/import-csv` route so the CSV
 *   endpoint, the Phase C preview and the Phase C import all run the SAME
 *   business logic (no duplication).
 * - The external HTTP contract of the Phase A endpoint is UNCHANGED: the
 *   alias table below is a SUPERSET of the Phase A aliases and the row
 *   validation messages are byte-identical.
 * - Mapping is GENERIC: header suggestions come from a canonical field
 *   registry (aliases + keywords), never from a hardcoded supplier list.
 * - Canonical internal fields (Phase C):
 *     material_code*, material_name*, trade_code*, price_ht*,
 *     trade_name, unit, tva_rate, currency, market, source
 *   (* = required). `source` is always OFFICIAL_DEFAULT in this pipeline.
 *   `currency` / `market` default to the file-level parameters (existing
 *   Phase A behaviour); when mapped, per-row values must match them.
 */
import { getDatabase } from '../db/client';
import { roundMoney } from '../utils/validation';
import { upsertTradeByCode } from '../repositories/tradeRepository';
import { upsertMaterialByCode, findOfficialMaterialByCode } from '../repositories/drizzleMaterialRepository';
import { upsertOfficialPrice } from '../repositories/drizzlePriceRepository';

// ── Limits ───────────────────────────────────────────────────────────────────
export const IMPORT_MAX_ROWS = 1000;

// ── Canonical field registry ────────────────────────────────────────────────
// `aliases` are exact matches on the NORMALIZED header (accents stripped,
// lowercase, spaces→underscores). `keywords` drive the generic suggestion
// fallback for supplier files whose headers are not known aliases.
export interface CanonicalFieldDef {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
  keywords: string[];
  /** Fixed value that cannot be mapped from a column (e.g. source). */
  fixedValue?: string;
}

export const CANONICAL_FIELDS: CanonicalFieldDef[] = [
  {
    key: 'material_code',
    label: 'Référence matériau (code stable)',
    required: true,
    aliases: ['material_code', 'code_materiau', 'reference', 'reference_code', 'code', 'ref', 'sku', 'article', 'code_article', 'code_produit', 'item_code', 'product_code'],
    keywords: ['reference', 'code', 'ref', 'sku', 'article', 'produit', 'product', 'item'],
  },
  {
    key: 'material_name',
    label: 'Désignation matériau',
    required: true,
    aliases: ['material_name', 'nom_materiau', 'nom', 'name', 'name_fr', 'designation', 'libelle', 'description', 'nom_produit', 'produit'],
    keywords: ['designation', 'nom', 'name', 'libelle', 'label', 'description', 'materiau', 'material', 'produit'],
  },
  {
    key: 'trade_code',
    label: 'Métier (code)',
    required: true,
    aliases: ['trade_code', 'trade', 'categorie', 'category', 'categorie_metier', 'metier', 'famille', 'rayon', 'famille_produit'],
    keywords: ['categorie', 'category', 'trade', 'metier', 'famille', 'rayon', 'groupe', 'activite'],
  },
  {
    key: 'price_ht',
    label: 'Prix HT',
    required: true,
    aliases: ['price_ht', 'prix_ht', 'prix_tnd_ht', 'prix_ht_tnd', 'prix_tnd', 'prix', 'price', 'price_tnd', 'unit_price', 'prix_unitaire', 'pu_ht', 'montant'],
    keywords: ['prix', 'price', 'ht', 'unitaire', 'montant', 'tarif'],
  },
  {
    key: 'trade_name',
    label: 'Métier (libellé) — optionnel',
    required: false,
    aliases: ['trade_name', 'nom_metier', 'libelle_metier', 'metier_libelle', 'trade_label'],
    keywords: ['metier', 'trade', 'libelle', 'nom', 'label'],
  },
  {
    key: 'unit',
    label: 'Unité — optionnel',
    required: false,
    aliases: ['unit', 'unite', 'unite_mesure', 'base_unit', 'mesure', 'uom'],
    keywords: ['unite', 'unit', 'mesure', 'uom'],
  },
  {
    key: 'tva_rate',
    label: 'Taux TVA — optionnel',
    required: false,
    aliases: ['tva_rate', 'taux_tva', 'tva', 'vat', 'tax'],
    keywords: ['tva', 'vat', 'tax', 'taux'],
  },
  {
    key: 'currency',
    label: 'Devise — optionnel',
    required: false,
    aliases: ['currency', 'devise', 'monnaie', 'currency_code', 'code_devise'],
    keywords: ['currency', 'devise', 'monnaie'],
  },
  {
    key: 'market',
    label: 'Marché (pays) — optionnel',
    required: false,
    aliases: ['market', 'marche', 'pays', 'country', 'country_code', 'code_pays'],
    keywords: ['market', 'marche', 'pays', 'country'],
  },
  {
    key: 'name_ar',
    label: 'Nom (AR) — optionnel',
    required: false,
    aliases: ['name_ar', 'nom_arabe', 'arabe', 'designation_arabe'],
    keywords: ['arabe', 'arabic', 'ar'],
  },
  {
    key: 'note',
    label: 'Note technique — optionnel',
    required: false,
    aliases: ['note_technique', 'note', 'notes', 'technical_specs', 'specs', 'specification'],
    keywords: ['note', 'spec', 'technique', 'description_detail'],
  },
];

export const REQUIRED_FIELD_KEYS = CANONICAL_FIELDS.filter((f) => f.required).map((f) => f.key);
/** `source` is fixed by the official-price pipeline — never file-mapped. */
export const FIXED_SOURCE = 'OFFICIAL_DEFAULT';
// ── Normalizers (byte-identical to the Phase A helpers) ─────────────────────

/** Normalize a header cell: strip accents, lowercase, collapse spaces/underscores. */
export function normalizeHeader(header: string): string {
  return String(header ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Accepts "31,5" / "31.5" / "1 500,25" — returns null when not numeric. */
export function parseImportPrice(raw: string): number | null {
  const cleaned = String(raw ?? '').trim().replace(/\s/g, '').replace(/,/g, '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Accepts "19" / "19,0" / "7" — returns null when not a valid rate (0..100). */
function parseTvaRate(raw: string): number | null {
  const value = parseImportPrice(raw);
  if (value === null) return null;
  if (value < 0 || value > 100) return null;
  return value;
}

// ── Smart Mapping: detection + suggestion + resolution ──────────────────────

export interface DetectedColumn {
  source: string;
  sample: string;
}

export interface MappingResolution {
  /** Detected columns with one sample value (for the Admin UI). */
  detectedColumns: DetectedColumn[];
  /** Generic suggestion (canonical key → source header). */
  suggestedMapping: Record<string, string>;
  /** Final mapping actually applied (suggestion + Admin overrides). */
  appliedMapping: Record<string, string>;
  /** Errors in the Admin-provided mapping (unknown header/field). */
  mappingErrors: string[];
  /** Required canonical fields without any mapped column. */
  unmappedRequired: string[];
}

/** Split a normalized header into tokens ("prix_unitaire_ht" → [prix, unitaire, ht]). */
function headerTokens(normalizedHeader: string): string[] {
  return normalizedHeader.split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Generic keyword scoring: exact alias match beats keywords; keyword matches
 * are deterministic (field registry order breaks ties). This is NOT a
 * supplier-specific table — it works for any external file.
 */
function scoreHeaderForField(field: CanonicalFieldDef, normalizedHeader: string): number {
  if (field.aliases.includes(normalizedHeader)) return 1000;
  const tokens = headerTokens(normalizedHeader);
  const joined = tokens.join('_');
  let score = 0;
  for (const kw of field.keywords) {
    if (tokens.includes(kw)) score += 2;
    else if (joined.includes(kw)) score += 1;
  }
  return score;
}

/**
 * Detect columns, build the generic suggestion and apply (optional) Admin
 * overrides. Pure function — no database, no I/O.
 *
 * @param headers         raw header texts, in file order
 * @param sampleRow       first data row (for samples), may be undefined
 * @param mappingOverride Admin mapping: canonical key → source header text
 */
export function resolveMapping(
  headers: string[],
  sampleRow: Record<string, string> | undefined,
  mappingOverride?: Record<string, string> | null
): MappingResolution {
  const detectedColumns: DetectedColumn[] = headers.map((h) => ({
    source: h,
    sample: String(sampleRow?.[h] ?? '').slice(0, 60),
  }));

  // ── Suggestion: best-scoring header per canonical field (each header used once)
  const used = new Set<string>();
  const suggestedMapping: Record<string, string> = {};
  for (const field of CANONICAL_FIELDS) {
    let best: { header: string; score: number } | null = null;
    for (const header of headers) {
      if (used.has(header)) continue;
      const score = scoreHeaderForField(field, normalizeHeader(header));
      if (score > 0 && (!best || score > best.score)) {
        best = { header, score };
      }
    }
    if (best) {
      suggestedMapping[field.key] = best.header;
      used.add(best.header);
    }
  }

  // ── Apply the Admin override (validate it, fall back to the suggestion) ──
  const appliedMapping: Record<string, string> = { ...suggestedMapping };
  const mappingErrors: string[] = [];
  const knownKeys = new Set(CANONICAL_FIELDS.map((f) => f.key));
  const headerSet = new Set(headers);

  if (mappingOverride && typeof mappingOverride === 'object') {
    for (const [canonicalKey, sourceHeader] of Object.entries(mappingOverride)) {
      if (!knownKeys.has(canonicalKey)) {
        mappingErrors.push(`Unknown field in mapping: '${canonicalKey}'`);
        continue;
      }
      if (sourceHeader === '' || sourceHeader === null || sourceHeader === undefined) {
        // Explicit un-mapping of an optional field is allowed.
        if (CANONICAL_FIELDS.find((f) => f.key === canonicalKey)?.required) {
          mappingErrors.push(`Required field '${canonicalKey}' cannot be un-mapped`);
          continue;
        }
        delete appliedMapping[canonicalKey];
        continue;
      }
      if (!headerSet.has(String(sourceHeader))) {
        mappingErrors.push(`Mapping for '${canonicalKey}' points to a column that does not exist: '${sourceHeader}'`);
        continue;
      }
      appliedMapping[canonicalKey] = String(sourceHeader);
    }
  }

  const unmappedRequired = REQUIRED_FIELD_KEYS.filter((key) => !appliedMapping[key]);

  return { detectedColumns, suggestedMapping, appliedMapping, mappingErrors, unmappedRequired };
}

// ── Row normalization + validation (before ANY database write) ──────────────

export interface ValidImportRow {
  row: number;
  reference: string;
  nameFr: string;
  trade: string;
  tradeLabel?: string;
  price: number;
  unit: string;
  nameAr?: string;
  note?: string;
  tvaRate?: number;
}

export interface FailedRow {
  row: number;
  reference: string;
  reason: string;
}

export interface NormalizationResult {
  valid: ValidImportRow[];
  failed: FailedRow[];
}

/**
 * Normalize raw file rows (keyed by RAW header text) using the applied
 * mapping and validate EVERY row. Mirrors the Phase A validation messages
 * exactly; adds TVA/currency/market checks for the newly mapped fields.
 */
export function normalizeAndValidateRows(
  rows: Array<Record<string, string>>,
  mapping: Record<string, string>,
  fileParams: { countryCode: string; currencyCode: string }
): NormalizationResult {
  const valid: ValidImportRow[] = [];
  const failed: FailedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // 1-based data rows, +1 for the header line
    const pick = (key: string): string => {
      const header = mapping[key];
      if (!header) return '';
      return String(row[header] ?? '').trim();
    };
    const reference = pick('material_code');
    const nameFr = pick('material_name');
    const tradeRaw = pick('trade_code');
    const priceRaw = pick('price_ht');
    const unitRaw = pick('unit');
    const nameAr = pick('name_ar');
    const note = pick('note');
    const tradeLabelRaw = pick('trade_name');
    const tvaRaw = pick('tva_rate');
    const currencyRaw = pick('currency');
    const marketRaw = pick('market');
    const fail = (reason: string) => failed.push({ row: rowNumber, reference, reason });

    if (!reference) { fail('Missing Reference (stable material code).'); continue; }
    if (reference.length > 100) { fail(`Reference too long (${reference.length} > 100 characters).`); continue; }
    if (!nameFr) { fail('Missing Nom_Materiau (material name).'); continue; }
    const trade = tradeRaw.toLowerCase();
    if (!trade) { fail('Missing Categorie (trade).'); continue; }
    const price = parseImportPrice(priceRaw);
    if (price === null) { fail(`Invalid price '${priceRaw}'.`); continue; }
    if (price < 0) { fail(`Price must be >= 0 (got ${price}).`); continue; }
    const unit = unitRaw || 'unit';
    if (unit.length > 20) { fail(`Unit too long (${unit.length} > 20 characters).`); continue; }

    // ── Phase C — optional mapped fields ────────────────────────────────────
    let tvaRate: number | undefined;
    if (mapping.tva_rate && tvaRaw !== '') {
      const tva = parseTvaRate(tvaRaw);
      if (tva === null) { fail(`Invalid TVA rate '${tvaRaw}' (must be a number between 0 and 100).`); continue; }
      tvaRate = tva;
    }
    if (mapping.currency && currencyRaw !== '') {
      const cur = currencyRaw.toUpperCase();
      if (!/^[A-Z]{3}$/.test(cur)) { fail(`Invalid currency '${currencyRaw}' (expected a 3-letter ISO code).`); continue; }
      if (cur !== fileParams.currencyCode.toUpperCase()) { fail(`Currency '${currencyRaw}' does not match the import currency ${fileParams.currencyCode}. One currency per file.`); continue; }
    }
    if (mapping.market && marketRaw !== '') {
      const mk = marketRaw.toUpperCase();
      if (!/^[A-Z]{2,3}$/.test(mk)) { fail(`Invalid market '${marketRaw}' (expected a country code).`); continue; }
      if (mk !== fileParams.countryCode.toUpperCase()) { fail(`Market '${marketRaw}' does not match the import market ${fileParams.countryCode}. One market per file.`); continue; }
    }

    valid.push({
      row: rowNumber,
      reference,
      nameFr,
      trade,
      tradeLabel: tradeLabelRaw || undefined,
      price,
      unit,
      nameAr: nameAr || undefined,
      note: note || undefined,
      tvaRate,
    });
  }

  return { valid, failed };
}

// ── Commit (Phase A transactional flow, shared by CSV + XLSX import) ────────

export interface CommitSuccess {
  ok: true;
  imported: number;
  updated: number;
  results: Array<{ row: number; reference: string; status: 'imported' | 'updated' }>;
}

export interface CommitFailure {
  ok: false;
  message: string;
  /** Rows to report in the `data.failed` array of the HTTP response. */
  failedRows: FailedRow[];
}

/**
 * Persist validated rows EXACTLY like the Phase A import:
 *   1. Ensure all trades exist (Phase B — dynamic, is_official=false).
 *   2. ONE transaction: material + official price upserts commit or roll
 *      back together.
 * Never called for rows that failed validation — all-or-nothing is enforced
 * by the caller BEFORE this function runs.
 */
export async function commitValidRows(
  valid: ValidImportRow[],
  fileParams: { countryCode: string; currencyCode: string }
): Promise<CommitSuccess | CommitFailure> {
  // ── 1) Ensure all trades exist (Phase B — dynamic trade creation) ────────
  const uniqueTrades = [...new Set(valid.map((item) => item.trade))];
  const tradeIdByCode = new Map<string, string>();
  for (const tradeCode of uniqueTrades) {
    try {
      const trade = await upsertTradeByCode(tradeCode, valid.find((i) => i.trade === tradeCode)?.tradeLabel);
      if (trade?.id) tradeIdByCode.set(tradeCode, trade.id);
    } catch (tradeErr: any) {
      return {
        ok: false,
        message: `Failed to create trade '${tradeCode}': ${tradeErr?.message || tradeErr}`,
        failedRows: [],
      };
    }
  }

  // ── 2) ONE transaction: every material/price write commits or rolls back ─
  const db = await getDatabase();
  if (!db) {
    return { ok: false, message: 'Database not available', failedRows: [] };
  }

  const results: Array<{ row: number; reference: string; status: 'imported' | 'updated' }> = [];
  let imported = 0;
  let updated = 0;

  try {
    await db.transaction(async (tx: any) => {
      for (const item of valid) {
        const existing = await findOfficialMaterialByCode(item.reference, tx);
        await upsertMaterialByCode({
          code: item.reference,
          trade: item.trade,
          category: item.trade,
          nameFr: item.nameFr,
          nameAr: item.nameAr ?? null,
          nameDerja: null,
          baseUnit: item.unit,
          technicalSpecs: item.note ?? null,
        }, tx);
        await upsertOfficialPrice({
          materialCode: item.reference,
          price: roundMoney(item.price),
          currencyCode: fileParams.currencyCode,
          countryCode: fileParams.countryCode,
        }, tx);
        if (existing) {
          updated++;
          results.push({ row: item.row, reference: item.reference, status: 'updated' });
        } else {
          imported++;
          results.push({ row: item.row, reference: item.reference, status: 'imported' });
        }
      }
    });
  } catch (txErr: any) {
    // Drizzle already rolled the transaction back — nothing persisted.
    return {
      ok: false,
      message: `Import failed and was fully rolled back: ${txErr?.message || txErr}`,
      failedRows: valid.map((item) => ({ row: item.row, reference: item.reference, reason: 'Rolled back: database error during the transaction.' })),
    };
  }

  return { ok: true, imported, updated, results };
}