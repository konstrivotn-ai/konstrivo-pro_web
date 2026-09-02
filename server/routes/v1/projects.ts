/**
 * Phase 3 — Projects Routes (/api/v1/projects)
 *
 * Drizzle-backed PostgreSQL repository.
 * Public read endpoints + authenticated create/update/delete.
 */
import { Router, Response } from 'express';
import {
  listProjects,
  findProjectById,
  createProject,
  updateProject,
  softDeleteProject,
} from '../../repositories/drizzleProjectsRepository';
import { optionalAuth, authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { parseIntParam } from '../../utils/validation';
import { notFound, badRequest } from '../../utils/errors';

const router = Router();

// Public endpoints may accept an optional token
router.use(optionalAuth);

router.get('/', async (req, res, next) => {
  try {
    const result = await listProjects({
      search: req.query.search as string | undefined,
      region: req.query.region as string | undefined,
      companyId: req.query.companyId as string | undefined,
      status: req.query.status as string | undefined,
      page: parseIntParam(req.query.page, 1),
      limit: parseIntParam(req.query.limit, 50),
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const p = await findProjectById(req.params.id);
    if (!p) throw notFound(`Project '${req.params.id}' not found`);
    res.json({ data: p });
  } catch (err) { next(err); }
});

// Mutations require authentication
router.post('/', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name) throw badRequest('name is required');
    if (!body.companyId) throw badRequest('companyId is required');
    const created = await createProject({
      ...body,
      managerUserId: req.user?.uid,
    });
    res.status(201).json({ data: created });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const existing = await findProjectById(req.params.id);
    if (!existing) throw notFound(`Project '${req.params.id}' not found`);
    const patched = await updateProject(req.params.id, req.body || {}, req.body?.version);
    res.json({ data: patched });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const existing = await findProjectById(req.params.id);
    if (!existing) throw notFound(`Project '${req.params.id}' not found`);
    await softDeleteProject(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

export { router as projectsRouter };
