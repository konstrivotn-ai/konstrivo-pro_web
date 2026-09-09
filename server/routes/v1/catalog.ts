import { Router, Response } from 'express';
import express from 'express';
import { authenticate, requireEntitlement, AuthenticatedRequest } from '../../middleware/auth';
import { createLimiter } from '../../middleware/rateLimit';
import { getPriceSourceSpec } from '../../priceSources/connector';
import { runSaudiGastatUpdate } from '../../priceSources/saudiPipeline';
import { validateBody, roundMoney } from '../../utils/validation';
import { badRequest, payloadTooLarge, unsupportedMediaType } from '../../utils/errors';
import { config } from '../../config';
import { getBoundary, parseMultipart, isValidFileType, MultipartFile } from '../../utils/multipart';
import { parseCsv } from '../../utils/csv';
import { parseXlsxToRows } from '../../utils/xlsx';
import {
  IMPORT_MAX_ROWS,
  resolveMapping,
  normalizeAndValidateRows,
  commitValidRows,
  type ValidImportRow,
  type FailedRow,
} from '../../services/catalogImport';
import {
  upsertOfficialPrice,
  submitPendingPriceUpdate,
  listPendingPriceUpdates,
  approvePendingPriceUpdate,
} from '../../repositories/drizzlePriceRepository';
import { upsertMaterialByCode } from '../../repositories/drizzleMaterialRepository';

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

// ── Phase A + B + C — Admin bulk catalog import (transactional) ──────────────
// POST /catalog/import-csv   (Phase A — CSV only, contract UNCHANGED)
// POST /catalog/preview      (Phase C — CSV + XLSX, mapping + preview, no write)
// POST /catalog/import       (Phase C — CSV + XLSX, mapping + transactional write)
//
// ALL parsing, validation and persistence happen SERVER-SIDE:
//   - Accepts multipart/form-data (file part "file") OR a raw body
//     (text/csv for CSV, application/vnd.openxmlformats-...sheet for XLSX).
//   - CSV and XLSX go through the SAME pipeline (services/catalogImport.ts):
//     Parser → Column Detection → Smart Mapping → Canonical Normalization →
//     Validation → ONE transaction (materials + official prices).
//   - EVERY row is validated BEFORE any database write; if ANY row is invalid
//     the import is aborted with 400 and NOTHING is written (all-or-nothing).
//   - Unknown trade codes are auto-created as dynamic (non-official) trades
//     so newly imported trades become immediately available in the trade
//     selection UI without a hardcoded TypeScript/React entry (Phase B).
//
// Reuses the existing building blocks (no schema change):
//   multipart validation (utils/multipart + config limits), the shared CSV
//   parser (utils/csv), the safe XLSX reader (utils/xlsx), the Step 5
//   official upserts and the CATALOG_OFFICIAL_MANAGE entitlement.

/** Raw-body content types accepted by the import endpoints. */
const IMPORT_RAW_TYPES = [
  'multipart/form-data',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

interface ExtractedUpload {
  buffer: Buffer;
  fileName: string;
  fileType: 'csv' | 'xlsx';
  countryCode: string;
  currencyCode: string;
}

interface ParsedImportFile {
  fileType: 'csv' | 'xlsx';
  sheetName?: string;
  headerRowNumber?: number;
  headers: string[];
  rows: Array<Record<string, string>>;
}

/**
 * Extract + validate the uploaded file from a multipart form or a raw body.
 * Keeps every Phase A protection: upload size limit, allowed MIME types,
 * extension whitelist. When `csvOnly` is set (Phase A endpoint) only .csv is
 * accepted, with the exact Phase A error messages.
 */
function extractImportUpload(
  req: AuthenticatedRequest,
  opts: { csvOnly: boolean }
): ExtractedUpload {
  const contentType = String(req.headers['content-type'] || '');
  const isMultipart = contentType.toLowerCase().startsWith('multipart/form-data');

  let fileRaw: Buffer | null = null;
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
    const lowerName = (file.filename || '').toLowerCase();
    if (opts.csvOnly && !lowerName.endsWith('.csv')) {
      throw unsupportedMediaType(`Only .csv files are supported in Phase A (no Excel yet). Got: ${file.filename || 'unnamed'}`);
    }
    if (!opts.csvOnly && !lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      throw unsupportedMediaType(`Only .csv and .xlsx files are supported. Got: ${file.filename || 'unnamed'}`);
    }
    if (lowerName.endsWith('.xls')) {
      // Legacy binary Excel format — deliberately unsupported (BIFF is not a
      // safe OOXML zip; it is NOT parsed by utils/xlsx).
      throw unsupportedMediaType(`Legacy .xls is not supported. Re-save the file as .xlsx. Got: ${file.filename}`);
    }
    fileRaw = file.buffer;
    fileName = file.filename || 'import.csv';
    for (const f of fields) {
      if ('buffer' in f) continue;
      if (f.name === 'countryCode') formCountryCode = f.value;
      if (f.name === 'currencyCode') formCurrencyCode = f.value;
    }
  } else if (Buffer.isBuffer(req.body) && (req.body as Buffer).length > 0) {
    const isCsv = contentType.toLowerCase().includes('csv');
    const isXlsx = contentType.toLowerCase().includes('spreadsheetml') || contentType.toLowerCase().includes('octet-stream');
    if (opts.csvOnly && !isCsv) {
      throw unsupportedMediaType(`Unsupported media type: ${contentType || 'none'}. Use multipart/form-data or text/csv.`);
    }
    if (!opts.csvOnly && !isCsv && !isXlsx) {
      throw unsupportedMediaType(`Unsupported media type: ${contentType || 'none'}. Use multipart/form-data, text/csv or the .xlsx MIME type.`);
    }
    fileRaw = req.body as Buffer;
    fileName = isCsv ? 'import.csv' : 'import.xlsx';
  }

  if (!fileRaw || fileRaw.length === 0) {
    throw badRequest('No CSV file uploaded. Provide a multipart file part named "file" or a raw text/csv body.');
  }

  // ── One market + one currency for the WHOLE file (TN/TND home default) ───
  const countryCode = (formCountryCode || (req.query.countryCode as string | undefined) || 'TN').trim().toUpperCase();
  const currencyCode = (formCurrencyCode || (req.query.currencyCode as string | undefined) || 'TND').trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(countryCode)) throw badRequest(`Invalid countryCode: '${countryCode}'`);
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw badRequest(`Invalid currencyCode: '${currencyCode}'`);

  return {
    buffer: fileRaw,
    fileName,
    fileType: fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv',
    countryCode,
    currencyCode,
  };
}

/**
 * Parse an extracted upload into raw rows keyed by RAW header text.
 * CSV uses the shared parser (headers = first line, Phase A behaviour);
 * XLSX uses the safe ExcelJS reader (headers detected in the first rows).
 */
async function parseImportFile(upload: ExtractedUpload): Promise<ParsedImportFile> {
  if (upload.fileType === 'xlsx') {
    // parseXlsxToRows never throws; structural problems come back as { ok: false }.
    const parsed = await parseXlsxToRows(upload.buffer);
    if ('error' in parsed) throw badRequest(parsed.error);
    return {
      fileType: 'xlsx',
      sheetName: parsed.sheetName,
      headerRowNumber: parsed.headerRowNumber,
      headers: parsed.headers,
      rows: parsed.rows,
    };
  }
  const csvContent = upload.buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(csvContent);
  if (rows.length === 0) throw badRequest('CSV file is empty or has no header row.');
  return {
    fileType: 'csv',
    headers: Object.keys(rows[0]),
    rows,
  };
}

/** Read the optional Smart-Mapping override (multipart field or ?mapping= query). */
function extractMappingOverride(req: AuthenticatedRequest): Record<string, string> | undefined {
  let raw: string | undefined;
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.toLowerCase().startsWith('multipart/form-data')) {
    const boundary = getBoundary(contentType);
    if (boundary) {
      const fields = parseMultipart(req.body as Buffer, boundary);
      const field = fields.find((f) => f.name === 'mapping' && !('buffer' in f));
      if (field) raw = field.value;
    }
  }
  if (!raw) {
    const q = req.query.mapping;
    if (typeof q === 'string' && q !== '') raw = q;
  }
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const mapping: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) mapping[k] = String(v);
      return mapping;
    }
    throw new Error('not an object');
  } catch {
    throw badRequest("Invalid 'mapping' payload: expected a JSON object of { canonicalField: sourceColumn }.");
  }
}

// ── Shared pipeline runner (parse → smart mapping → validate) ────────────────
// NO database write happens here. Used by the Phase A CSV import, the
// Phase C preview and the Phase C import.

interface PipelineRun {
  upload: ExtractedUpload;
  parsed: ParsedImportFile;
  mapping: ReturnType<typeof resolveMapping>;
  valid: ValidImportRow[];
  failed: FailedRow[];
}

async function runImportPipeline(
  req: AuthenticatedRequest,
  opts: { csvOnly: boolean; mappingOverride?: Record<string, string> }
): Promise<PipelineRun> {
  const upload = extractImportUpload(req, opts);
  const parsed = await parseImportFile(upload);
  const mapping = resolveMapping(parsed.headers, parsed.rows[0], opts.mappingOverride);
  const { valid, failed } = normalizeAndValidateRows(parsed.rows, mapping.appliedMapping, {
    countryCode: upload.countryCode,
    currencyCode: upload.currencyCode,
  });
  return { upload, parsed, mapping, valid, failed };
}

/** All-or-nothing guard shared by /import-csv and /import. */
function invalidRowsResponse(res: Response, run: PipelineRun) {
  // Nothing has been written — validation ran before any database access,
  // which IS the full-rollback guarantee for invalid files.
  return res.status(400).json({
    error: {
      code: 'BAD_REQUEST',
      message: `Import aborted: ${run.failed.length} invalid row(s). No data was written (all-or-nothing import).`,
    },
    data: {
      fileName: run.upload.fileName,
      totalRows: run.parsed.rows.length,
      committed: false,
      imported: 0,
      updated: 0,
      failed: run.failed,
    },
  });
}

router.post('/import-csv',
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  express.raw({ type: ['multipart/form-data', 'text/csv'], limit: '10mb' }),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      // ── 1) Extract, parse, smart-map and validate the file (CSV only —
      //       the Phase A endpoint keeps its .csv-only contract).
      const run = await runImportPipeline(req, { csvOnly: true });

      // Required columns must be resolvable from the file headers.
      if (run.mapping.unmappedRequired.length > 0) {
        throw badRequest(
          `CSV header is missing required column(s): ${run.mapping.unmappedRequired.join(', ')}. ` +
          'Expected headers: Reference;Nom_Materiau;Categorie;Unite;Prix_TND_HT;Note_Technique;Nom_Arabe'
        );
      }
      if (run.parsed.rows.length > IMPORT_MAX_ROWS) {
        throw badRequest(`Too many rows (${run.parsed.rows.length}). Maximum ${IMPORT_MAX_ROWS} rows per import.`);
      }

      // ── 2) Validate EVERY row BEFORE touching the database (all-or-nothing)
      if (run.failed.length > 0) { return invalidRowsResponse(res, run); }

      // ── 3) Commit: dynamic trades (Phase B) + ONE transaction (materials +
      //       official prices). Any database failure rolls the WHOLE batch back.
      const commit = await commitValidRows(run.valid, {
        countryCode: run.upload.countryCode,
        currencyCode: run.upload.currencyCode,
      });
      // `in` narrowing (the project compiles without strictNullChecks).
      if ('message' in commit) {
        return res.status(500).json({
          error: { code: 'INTERNAL_ERROR', message: commit.message },
          data: {
            fileName: run.upload.fileName,
            totalRows: run.parsed.rows.length,
            committed: false,
            imported: 0,
            updated: 0,
            failed: commit.failedRows,
          },
        });
      }

      return res.status(200).json({
        data: {
          fileName: run.upload.fileName,
          totalRows: run.parsed.rows.length,
          committed: true,
          imported: commit.imported,
          updated: commit.updated,
          failed: [],
          results: commit.results,
          countryCode: run.upload.countryCode,
          currencyCode: run.upload.currencyCode,
        },
      });
    } catch (err) { next(err); }
  }
);

// ── Phase C — Smart Mapping preview (NO database write) ─────────────────────
// POST /catalog/preview
//
// Accepts .csv or .xlsx (multipart "file" part, optional "mapping" field with
// a JSON object { canonicalField: sourceColumn }) and returns the full
// mapping/preview/validation report WITHOUT touching the database:
//   { detectedColumns, suggestedMapping, appliedMapping, unmappedRequired,
//     totalRows, sampleRows, validCount, rejectedCount, rejected, canImport }
router.post('/preview',
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  express.raw({ type: IMPORT_RAW_TYPES, limit: '10mb' }),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const mappingOverride = extractMappingOverride(req);
      const run = await runImportPipeline(req, { csvOnly: false, mappingOverride });

      if (run.mapping.mappingErrors.length > 0) {
        throw badRequest(`Invalid mapping: ${run.mapping.mappingErrors.join('; ')}`);
      }
      if (run.parsed.rows.length > IMPORT_MAX_ROWS) {
        throw badRequest(`Too many rows (${run.parsed.rows.length}). Maximum ${IMPORT_MAX_ROWS} rows per import.`);
      }

      // First 5 normalized rows in the canonical field shape (preview only).
      const sampleRows = run.valid.slice(0, 5).map((item) => ({
        row: item.row,
        material_code: item.reference,
        material_name: item.nameFr,
        trade_code: item.trade,
        ...(item.tradeLabel ? { trade_name: item.tradeLabel } : {}),
        unit: item.unit,
        price_ht: item.price,
        ...(item.tvaRate !== undefined ? { tva_rate: item.tvaRate } : {}),
        currency: run.upload.currencyCode,
        market: run.upload.countryCode,
        source: 'OFFICIAL_DEFAULT',
      }));

      return res.json({
        data: {
          fileName: run.upload.fileName,
          fileType: run.upload.fileType,
          sheetName: run.parsed.sheetName,
          headerRowNumber: run.parsed.headerRowNumber,
          // Canonical field registry (display metadata for the Admin UI).
          fields: [
            { key: 'material_code', label: 'Référence matériau (code stable)', required: true },
            { key: 'material_name', label: 'Désignation matériau', required: true },
            { key: 'trade_code', label: 'Métier (code)', required: true },
            { key: 'price_ht', label: 'Prix HT', required: true },
            { key: 'trade_name', label: 'Métier (libellé)', required: false },
            { key: 'unit', label: 'Unité', required: false },
            { key: 'tva_rate', label: 'Taux TVA', required: false },
            { key: 'currency', label: 'Devise', required: false },
            { key: 'market', label: 'Marché (pays)', required: false },
            { key: 'name_ar', label: 'Nom (AR)', required: false },
            { key: 'note', label: 'Note technique', required: false },
          ],
          detectedColumns: run.mapping.detectedColumns,
          suggestedMapping: run.mapping.suggestedMapping,
          appliedMapping: run.mapping.appliedMapping,
          mappingErrors: run.mapping.mappingErrors,
          unmappedRequired: run.mapping.unmappedRequired,
          totalRows: run.parsed.rows.length,
          sampleRows,
          validCount: run.valid.length,
          rowsToImport: run.valid.length,
          rejectedCount: run.failed.length,
          rejected: run.failed.slice(0, 50),
          canImport:
            run.mapping.unmappedRequired.length === 0 &&
            run.mapping.mappingErrors.length === 0 &&
            run.failed.length === 0 &&
            run.parsed.rows.length > 0,
          countryCode: run.upload.countryCode,
          currencyCode: run.upload.currencyCode,
          source: 'OFFICIAL_DEFAULT',
        },
      });
    } catch (err) { next(err); }
  }
);

// ── Phase C — Smart Mapping import (CSV + XLSX, transactional) ──────────────
// POST /catalog/import
//
// Same pipeline as /preview, but commits through the EXISTING Phase A
// transactional mechanism (dynamic trades + ONE transaction). Import is
// REFUSED (400, nothing written) until every required field is mapped and
// every row validates.
router.post('/import',
  authenticate,
  requireEntitlement('CATALOG_OFFICIAL_MANAGE'),
  express.raw({ type: IMPORT_RAW_TYPES, limit: '10mb' }),
  async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const mappingOverride = extractMappingOverride(req);
      const run = await runImportPipeline(req, { csvOnly: false, mappingOverride });

      if (run.mapping.mappingErrors.length > 0) {
        throw badRequest(`Invalid mapping: ${run.mapping.mappingErrors.join('; ')}`);
      }
      // Import is blocked until all required fields are mapped.
      if (run.mapping.unmappedRequired.length > 0) {
        throw badRequest(
          `Import blocked: required field(s) not mapped: ${run.mapping.unmappedRequired.join(', ')}. ` +
          'Map every required field in the Smart Mapping step before importing.'
        );
      }
      if (run.parsed.rows.length > IMPORT_MAX_ROWS) {
        throw badRequest(`Too many rows (${run.parsed.rows.length}). Maximum ${IMPORT_MAX_ROWS} rows per import.`);
      }
      if (run.parsed.rows.length === 0) {
        throw badRequest('The file contains no data rows to import.');
      }
      if (run.failed.length > 0) { return invalidRowsResponse(res, run); }

      const commit = await commitValidRows(run.valid, {
        countryCode: run.upload.countryCode,
        currencyCode: run.upload.currencyCode,
      });
      // `in` narrowing (the project compiles without strictNullChecks).
      if ('message' in commit) {
        return res.status(500).json({
          error: { code: 'INTERNAL_ERROR', message: commit.message },
          data: {
            fileName: run.upload.fileName,
            totalRows: run.parsed.rows.length,
            committed: false,
            imported: 0,
            updated: 0,
            failed: commit.failedRows,
          },
        });
      }

      return res.status(200).json({
        data: {
          fileName: run.upload.fileName,
          fileType: run.upload.fileType,
          totalRows: run.parsed.rows.length,
          committed: true,
          imported: commit.imported,
          updated: commit.updated,
          failed: [],
          results: commit.results,
          countryCode: run.upload.countryCode,
          currencyCode: run.upload.currencyCode,
          mapping: run.mapping.appliedMapping,
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