import { Router, Response } from 'express';
import { authenticate, requireEntitlement, AuthenticatedRequest } from '../../middleware/auth';
import { createLimiter } from '../../middleware/rateLimit';
import { getPriceSourceSpec } from '../../priceSources/connector';
import { runSaudiGastatUpdate } from '../../priceSources/saudiPipeline';
import { validateBody, roundMoney } from '../../utils/validation';
import { badRequest } from '../../utils/errors';
import { upsertMaterialByCode } from '../../repositories/drizzleMaterialRepository';
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