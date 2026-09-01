/**
 * Phase 2 — Subscription Routes (/api/v1/subscriptions)
 *
 * GET /me — current subscription and calculated entitlements.
 * No real payment integration in Phase 2.
 */
import { Router, Response } from 'express';
import { subscriptionRepository } from '../../repositories/subscriptionRepository';
import { memberRepository, companyRepository } from '../../repositories/companyRepository';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { notFound } from '../../utils/errors';
import { computeEntitlements } from '../../utils/permissions';

const router = Router();

router.get('/me',
  authenticate,
  (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const memberships = memberRepository.findByUserId(req.user!.uid);
      const primaryCompanyId = req.user!.companyId || memberships[0]?.companyId || '';
      if (!primaryCompanyId) throw notFound('No active company membership');

      const subscription = subscriptionRepository.findByCompanyId(primaryCompanyId);
      if (!subscription) throw notFound('No subscription found for this company');

      // Calculate entitlements server-side
      const entitlements = computeEntitlements(req.user!.role, req.user!.tier);

      res.json({
        data: {
          subscription,
          tier: req.user!.tier,
          status: subscription.status,
          entitlements,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
        note: 'Payment gateway integration is out of scope for Phase 2.',
      });
    } catch (err) { next(err); }
  }
);

export { router as subscriptionsRouter };
