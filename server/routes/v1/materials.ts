/**
 * Phase 2 — Materials Routes (/api/v1/materials)
 *
 * GET /materials      — paginated list with trade/category/search filters
 * GET /materials/:id  — single material
 *
 * Prices are NOT attached to the canonical Material entity.
 */
import { Router, Response } from 'express';
import { materialRepository } from '../../repositories/materialRepository';
import { optionalAuth } from '../../middleware/auth';
import { parseIntParam } from '../../utils/validation';
import { notFound } from '../../utils/errors';

const router = Router();

router.use(optionalAuth);

// ── GET / ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const page = parseIntParam(req.query.page, 1);
    const limit = parseIntParam(req.query.limit, 20);
    const result = await (materialRepository as any).list({
      trade: req.query.trade as string | undefined,
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      page,
      limit,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /:id ──────────────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const material = await (materialRepository as any).findById(req.params.id);
    if (!material) throw notFound(`Material '${req.params.id}' not found`);
    res.json({ data: material });
  } catch (err) { next(err); }
});

export { router as materialsRouter };
