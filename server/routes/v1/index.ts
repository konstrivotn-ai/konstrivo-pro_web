/**
 * Phase 2 — /api/v1 Router
 *
 * Mounts all Phase 2 sub-routers under /api/v1.
 */
import { Router } from 'express';
import { authRouter, meRouter } from './auth';
import { materialsRouter } from './materials';
import { pricesRouter } from './prices';
import { devisRouter } from './devis';
import { suppliersRouter } from './suppliers';
import { artisansRouter } from './artisans';
import { projectsRouter } from './projects';
import { subscriptionsRouter } from './subscriptions';
import { syncRouter } from './sync';
import { errorHandler } from '../../middleware/errorHandler';
import { config } from '../../config';

export function setupV1Router(): Router {
  const router = Router();

  // API metadata / discovery
  router.get('/', (_req, res) => {
    res.json({
      name: 'KONSTRIVO API',
      version: 'v1',
      phase: 2,
      environment: config.nodeEnv,
      database: config.databaseUrl ? 'postgresql' : 'in-memory',
      endpoints: [
        'POST   /api/v1/auth/register',
        'POST   /api/v1/auth/login',
        'POST   /api/v1/auth/refresh',
        'POST   /api/v1/auth/logout',
        'GET    /api/v1/users/me',
        'GET    /api/v1/materials',
        'GET    /api/v1/materials/:id',
        'GET    /api/v1/prices',
        'GET    /api/v1/prices/sources',
        'POST   /api/v1/prices/custom',
        'GET    /api/v1/devis',
        'POST   /api/v1/devis',
        'GET    /api/v1/devis/:id',
        'PUT    /api/v1/devis/:id',
        'DELETE /api/v1/devis/:id',
        'POST   /api/v1/suppliers/upload',
        'GET    /api/v1/suppliers/imports/:id',
        'POST   /api/v1/suppliers/imports/:id/approve',
        'GET    /api/v1/artisans',
        'GET    /api/v1/projects',
        'GET    /api/v1/projects/:id',
        'GET    /api/v1/artisans/:id',
        'GET    /api/v1/subscriptions/me',
        'POST   /api/v1/sync/pull',
        'POST   /api/v1/sync/push',
      ],
    });
  });

  // Mount sub-routers
  router.use('/auth', authRouter);
  router.use('/users', meRouter);
  router.use('/materials', materialsRouter);
  router.use('/prices', pricesRouter);
  router.use('/devis', devisRouter);
  router.use('/suppliers', suppliersRouter);
  router.use('/artisans', artisansRouter);
  router.use('/projects', projectsRouter);
  router.use('/subscriptions', subscriptionsRouter);
  router.use('/sync', syncRouter);

  // Central error handler for /api/v1
  router.use(errorHandler);

  return router;
}
