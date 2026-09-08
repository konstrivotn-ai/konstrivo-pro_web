/**
 * Phase 2B — Trade Registry Routes (/api/v1/trades)
 *
 * Read-only exposure of the Phase 2A trade registry:
 *   GET /trades      — list trades (?officialOnly=true restricts to official trades)
 *   GET /trades/:id  — single trade by id (404 for unknown or invalid ids)
 *
 * Data-access layer: the Phase 2A `tradeRepository` (hybrid memory/Drizzle),
 * consumed exactly as-is. Trades are immutable registry data — there are
 * deliberately NO write operations (no POST/PUT/PATCH/DELETE).
 */
import { Router, Response } from 'express';
import { tradeRepository } from '../../repositories/tradeRepository';
import { optionalAuth } from '../../middleware/auth';
import { notFound } from '../../utils/errors';

const router = Router();

router.use(optionalAuth);

// ── GET / ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const officialOnly = req.query.officialOnly === 'true';
    const trades = await tradeRepository.list(officialOnly);
    res.json({ data: trades });
  } catch (err) { next(err); }
});

// ── GET /:id ──────────────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const trade = await tradeRepository.findById(req.params.id);
    if (!trade) throw notFound(`Trade '${req.params.id}' not found`);
    res.json({ data: trade });
  } catch (err) { next(err); }
});

export { router as tradesRouter };