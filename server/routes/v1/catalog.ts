import { Router, Response } from 'express';
import express from 'express';
import { authenticate, requireEntitlement, AuthenticatedRequest } from '../../middleware/auth';
import { createLimiter } from '../../middleware/rateLimit';
import { getPriceSourceSpec } from '../../priceSources/connector';
import { runSaudiGastatUpdate } from '../../priceSources/saudiPipeline';
import { validateBody, roundMoney } from '../../utils/validation';
import { badRequest, payloadTooLarge, unsupportedMediaType, internalError } from '../../utils/errors';
import { getDatabase } from '../../db/client';
import { config } from '../../config';
import { getBoundary, parseMultipart, isValidFileType, MultipartFile } from '../../utils/multipart';
import { parseCsv } from '../../utils/csv';
import { OFFICIAL_TRADES } from '../../repositories/tradeRepository';
import { upsertMaterialByCode, findOfficialMaterialByCode } from '../../repositories/drizzleMaterialRepository';
import {
  upsertOfficialPrice,
  submitPendingPriceUpdate,
  listPendingPriceUpdates,
  approvePendingPriceUpdate,
} from '../../repositories/drizzlePriceRepository';

const router = Router();
const priceUpdateLimiter = createLimiter('default', { max: 5, windowMs: 15 * 60 * 1000 });

// Step 16 — Protected Price Update HTTP Endpoint
// Auth: JWT + CATALOG_OFFICIAL_MANAGE entitlement + X-Price-Update-Token header.
router.post('/admin/price-update/run',
  priceUpdateLimiter,
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const tokenHeader = req.headers['x-price-update-token'];
      const secret = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
      const expectedSecret = process.env.PRICE_UPDATE_CRON_SECRET;
      if (!secret || !expectedSecret || secret !== expectedSecret) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const sourceCode = typeof req.body?.sourceCode === 'string' ? req.body.sourceCode : undefined;
      if (!sourceCode) {
        return res.status(400).json({ error: 'Invalid or missing sourceCode' });
      }

      const spec = getPriceSourceSpec(sourceCode);
      if (!spec || !spec.enabled) {
        return res.status(501).json({ error: `Source '${sourceCode}' not registered or not implemented` });
      }

      if (sourceCode === 'SOURCE_SA_GASTAT') {
        const rows = await loadOfficialSaudiFile();
        if (!rows || rows.length === 0) {
          return res.status(501).json({
            sourceCode,
            market: 'SA',
            currency: 'SAR',
            submitted: 0,
            rejected: 0,
            errors: ['GASTAT data source not available: no official file uploaded. Upload GASTAT CSV/Excel manually or wait for official data feed.'],
          });
        }

        const result = await runSaudiGastatUpdate(rows);
        return res.json({
          sourceCode,
          market: 'SA',
          currency: 'SAR',
          submitted: result.submitted,
          rejected: result.rejected,
          errors: result.errors,
        });
      }

      return res.status(501).json({
        error: `No orchestration registered for source '${sourceCode}'`,
      });
    } catch (err) {
      next(err);
    }
  }
);

async function loadOfficialSaudiFile(): Promise<any[]> {
  return [];
}

/**
 * Step 5 — Official Catalog Management (/api/v1/catalog)
 *
 * POST /catalog/upsert — idempotently create or update an OFFICIAL material
 * together with its OFFICIAL_DEFAULT current price. Requires the
 * CATALOG_OFFICIAL_MANAGE entitlement (admin / ENTERPRISE).
 *
 * Official prices are public (company_id = NULL) and never touch
 * company-specific CUSTOM or supplier prices.
 */

router.post('/upsert',
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  validateBody([
    { field: 'code', label: 'Material Code', required: true, type: 'string' },
    { field: 'price', label: 'Price', required: true, type: 'number', min: 0 },
    { field: 'nameFr', label: 'Name (FR)', required: true, type: 'string' },
  ]),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const { code, price, nameFr, nameAr, nameDerja, trade, category, unit, currencyCode, countryCode, effectiveFrom, technicalSpecs } = req.body || {};

      if (price < 0) throw badRequest('Price must be >= 0');

      const material = await upsertMaterialByCode({
        code,
        trade: trade || category || 'placo',
        category: category || trade || 'placo',
        nameFr,
        nameAr: nameAr || null,
        nameDerja: nameDerja || null,
        baseUnit: unit || 'unit',
        technicalSpecs: technicalSpecs || null,
      });

      const priceRow = await upsertOfficialPrice({
        materialCode: code,
        price: roundMoney(price),
        currencyCode,
        countryCode,
        effectiveFrom,
      });

      res.status(200).json({ data: { material, price: priceRow } });
    } catch (err) { next(err); }
  }
);

// ── Phase A — Admin bulk CSV import (transactional) ─────────────────────────
// POST /catalog/import-csv
//
// Replaces the old browser-side CSV parsing + N×POST /catalog/upsert flow:
//   - The Admin UI uploads the RAW file; ALL parsing, validation and
//     persistence happen HERE, server-side.
//   - Accepts multipart/form-data (file part "file") OR a raw text/csv body.
//   - Only .csv is accepted in Phase A (no Excel yet).
//   - EVERY row is validated BEFORE any database write; if ANY row is invalid
//     the import is aborted with 400 and NOTHING is written (all-or-nothing).
//   - All material/price writes run inside ONE database transaction; any
//     unexpected database failure rolls the WHOLE batch back.
//   - Unknown trade codes are REFUSED with a clear error — never coerced to
//     'placo', never auto-created (dynamic trades are Phase B).
//
// Reuses the existing building blocks (no schema change):
//   multipart validation (utils/multipart + config limits), the shared CSV
//   parser (utils/csv), the Step 5 official upserts (upsertMaterialByCode +
//   upsertOfficialPrice) and the CATALOG_OFFICIAL_MANAGE entitlement.

const IMPORT_CSV_MAX_ROWS = 1000;

/** Canonical import columns → accepted (normalized) header aliases. */
const IMPORT_CSV_COLUMNS: Record<string, string[]> = {
  reference: ['reference', 'reference_code', 'code', 'ref', 'sku'],
  nameFr: ['nom_materiau', 'nom', 'name', 'name_fr', 'designation', 'libelle'],
  trade: ['categorie', 'category', 'trade', 'trade_code', 'categorie_metier', 'metier'],
  price: ['prix_tnd_ht', 'prix_ht_tnd', 'prix_tnd', 'prix_ht', 'prix', 'price', 'price_tnd', 'unit_price'],
  unit: ['unite', 'unit', 'unite_mesure', 'base_unit'],
  note: ['note_technique', 'note', 'notes', 'technical_specs', 'specs'],
  nameAr: ['nom_arabe', 'name_ar', 'arabe'],
};
const IMPORT_CSV_REQUIRED_COLUMNS = ['reference', 'nameFr', 'trade', 'price'];
const IMPORT_CSV_ALLOWED_TRADES = OFFICIAL_TRADES.map((t) => t.code);

/** Normalize a header cell: strip accents, lowercase, collapse spaces. */
function normalizeCsvHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Accepts "31,5" / "31.5" / "1 500,25" — returns null when not numeric. */
function parseImportPrice(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(/,/g, '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

router.post('/import-csv',
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  express.raw({ type: ['multipart/form-data', 'text/csv'], limit: '10mb' }),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const contentType = String(req.headers['content-type'] || '');
      const isMultipart = contentType.toLowerCase().startsWith('multipart/form-data');

      // ── 1) Extract the CSV payload (multipart file part OR raw text/csv body)
      let csvRaw: Buffer | null = null;
      let fileName = 'import.csv';
      let formCountryCode: string | undefined;
      let formCurrencyCode: string | undefined;

      if (isMultipart) {
        const boundary = getBoundary(contentType);
        if (!boundary) throw badRequest('Missing multipart boundary');
        const fields = parseMultipart(req.body as Buffer, boundary);
        const file = fields.find((f): f is MultipartFile => 'buffer' in f && !!(f as MultipartFile).buffer);
        if (!file) throw badRequest('No CSV file uploaded. Provide a file part named "file".');
        // Same upload validation rules as the existing upload middleware.
        if (file.size > config.maxUploadBytes) {
          throw payloadTooLarge(`File too large. Max size: ${config.maxUploadBytes} bytes`);
        }
        if (!isValidFileType(file.filename, file.contentType, config.allowedUploadMime)) {
          throw unsupportedMediaType(`File type not allowed: ${file.filename}`);
        }
        if (!file.filename || !file.filename.toLowerCase().endsWith('.csv')) {
          throw unsupportedMediaType(`Only .csv files are supported in Phase A (no Excel yet). Got: ${file.filename || 'unnamed'}`);
        }
        csvRaw = file.buffer;
        fileName = file.filename;
        for (const f of fields) {
          if ('buffer' in f) continue;
          if (f.name === 'countryCode') formCountryCode = f.value;
          if (f.name === 'currencyCode') formCurrencyCode = f.value;
        }
      } else if (Buffer.isBuffer(req.body) && (req.body as Buffer).length > 0) {
        if (!contentType.toLowerCase().includes('csv')) {
          throw unsupportedMediaType(`Unsupported media type: ${contentType || 'none'}. Use multipart/form-data or text/csv.`);
        }
        csvRaw = req.body as Buffer;
      }

      if (!csvRaw || csvRaw.length === 0) {
        throw badRequest('No CSV file uploaded. Provide a multipart file part named "file" or a raw text/csv body.');
      }

      // ── 2) One market + one currency for the WHOLE file (TN/TND home default)
      const importCountry = (formCountryCode || (req.query.countryCode as string | undefined) || 'TN').trim().toUpperCase();
      const importCurrency = (formCurrencyCode || (req.query.currencyCode as string | undefined) || 'TND').trim().toUpperCase();
      if (!/^[A-Z]{2,3}$/.test(importCountry)) throw badRequest(`Invalid countryCode: '${importCountry}'`);
      if (!/^[A-Z]{3}$/.test(importCurrency)) throw badRequest(`Invalid currencyCode: '${importCurrency}'`);

      // ── 3) Parse with the SHARED parser (; , or tab — quoted fields supported)
      const csvContent = csvRaw.toString('utf8').replace(/^\uFEFF/, '');
      const rows = parseCsv(csvContent);
      if (rows.length === 0) throw badRequest('CSV file is empty or has no header row.');

      // Map the file's headers onto the canonical import columns.
      const headerMap: Record<string, string> = {};
      for (const header of Object.keys(rows[0])) {
        const normalized = normalizeCsvHeader(header);
        for (const [canonical, aliases] of Object.entries(IMPORT_CSV_COLUMNS)) {
          if (aliases.includes(normalized)) { headerMap[canonical] = header; break; }
        }
      }
      const missingColumns = IMPORT_CSV_REQUIRED_COLUMNS.filter((c) => !headerMap[c]);
      if (missingColumns.length > 0) {
        throw badRequest(
          `CSV header is missing required column(s): ${missingColumns.join(', ')}. ` +
          'Expected headers: Reference;Nom_Materiau;Categorie;Unite;Prix_TND_HT;Note_Technique;Nom_Arabe'
        );
      }
      if (rows.length > IMPORT_CSV_MAX_ROWS) {
        throw badRequest(`Too many rows (${rows.length}). Maximum ${IMPORT_CSV_MAX_ROWS} rows per import.`);
      }

      // ── 4) Validate EVERY row BEFORE touching the database (all-or-nothing)
      const failed: Array<{ row: number; reference: string; reason: string }> = [];
      const valid: Array<{ row: number; reference: string; nameFr: string; trade: string; price: number; unit: string; nameAr?: string; note?: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // 1-based data rows, +1 for the header line
        const reference = String(row[headerMap.reference] ?? '').trim();
        const nameFr = String(row[headerMap.nameFr] ?? '').trim();
        const tradeRaw = String(row[headerMap.trade] ?? '').trim();
        const priceRaw = String(row[headerMap.price] ?? '').trim();
        const unitRaw = headerMap.unit ? String(row[headerMap.unit] ?? '').trim() : '';
        const nameAr = headerMap.nameAr ? String(row[headerMap.nameAr] ?? '').trim() : '';
        const note = headerMap.note ? String(row[headerMap.note] ?? '').trim() : '';
        const fail = (reason: string) => failed.push({ row: rowNumber, reference, reason });

        if (!reference) { fail('Missing Reference (stable material code).'); continue; }
        if (reference.length > 100) { fail(`Reference too long (${reference.length} > 100 characters).`); continue; }
        if (!nameFr) { fail('Missing Nom_Materiau (material name).'); continue; }
        const trade = tradeRaw.toLowerCase();
        if (!trade) { fail('Missing Categorie (trade).'); continue; }
        if (!IMPORT_CSV_ALLOWED_TRADES.includes(trade)) {
          fail(`Unknown trade '${tradeRaw}'. Creating new trades via import is not supported yet (Phase B). Allowed trades: ${IMPORT_CSV_ALLOWED_TRADES.join(', ')}.`);
          continue;
        }
        const price = parseImportPrice(priceRaw);
        if (price === null) { fail(`Invalid price '${priceRaw}'.`); continue; }
        if (price < 0) { fail(`Price must be >= 0 (got ${price}).`); continue; }
        const unit = unitRaw || 'unit';
        if (unit.length > 20) { fail(`Unit too long (${unit.length} > 20 characters).`); continue; }

        valid.push({ row: rowNumber, reference, nameFr, trade, price, unit, nameAr: nameAr || undefined, note: note || undefined });
      }

      if (failed.length > 0) {
        // Nothing has been written — validation ran before any database access,
        // which IS the full-rollback guarantee for invalid files.
        return res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: `Import aborted: ${failed.length} invalid row(s). No data was written (all-or-nothing import).`,
          },
          data: { fileName, totalRows: rows.length, committed: false, imported: 0, updated: 0, failed },
        });
      }

      // ── 5) ONE transaction: every material/price write commits or rolls back
      const db = await getDatabase();
      if (!db) { next(internalError('Database not available')); return; }

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
              currencyCode: importCurrency,
              countryCode: importCountry,
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
        return res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: `Import failed and was fully rolled back: ${txErr?.message || txErr}`,
          },
          data: {
            fileName,
            totalRows: rows.length,
            committed: false,
            imported: 0,
            updated: 0,
            failed: valid.map((item) => ({ row: item.row, reference: item.reference, reason: 'Rolled back: database error during the transaction.' })),
          },
        });
      }

      return res.status(200).json({
        data: {
          fileName,
          totalRows: rows.length,
          committed: true,
          imported,
          updated,
          failed: [],
          results,
          countryCode: importCountry,
          currencyCode: importCurrency,
        },
      });
    } catch (err) { next(err); }
  }
);

// ── Price Update Foundation (Step 8) ────────────────────────────────────────
// Incoming Price Update → Pending → Admin Review → Official Current Price.
// All endpoints require the SAME existing CATALOG_OFFICIAL_MANAGE entitlement.
// No schema change, no auth change, no company-price access.

// GET /catalog/price-updates/pending — list pending (unapproved) updates.
router.get('/price-updates/pending',
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const result = await listPendingPriceUpdates({
        countryCode: req.query.countryCode as string | undefined,
        currencyCode: req.query.currencyCode as string | undefined,
      });
      res.json(result);
    } catch (err) { next(err); }
  }
);

// POST /catalog/price-updates — record an incoming price update as PENDING
// (source=SUPPLIER_SUBMITTED, is_current=false). Always idempotent.
router.post('/price-updates',
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  validateBody([
    { field: 'materialCode', label: 'Material Code', required: true, type: 'string' },
    { field: 'price', label: 'Price', required: true, type: 'number', min: 0 },
  ]),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const { materialCode, price, currencyCode, countryCode, supplierId, effectiveFrom, notes } = req.body || {};
      if (price < 0) throw badRequest('Price must be >= 0');
      const row = await submitPendingPriceUpdate({
        materialCode,
        price: roundMoney(price),
        currencyCode,
        countryCode,
        supplierId,
        effectiveFrom,
        notes,
      });
      res.status(201).json({ data: row });
    } catch (err) { next(err); }
  }
);

// POST /catalog/price-updates/:id/approve — promote the pending row to the
// approved official current price FOR ITS OWN market/currency only.
router.post('/price-updates/:id/approve',
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const row = await approvePendingPriceUpdate(req.params.id);
      res.json({ data: row });
    } catch (err) { next(err); }
  }
);

export { router as catalogRouter };