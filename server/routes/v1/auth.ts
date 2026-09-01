/**
 * Phase 2 + Phase 1.1 — Auth Routes (/api/v1/auth)
 *
 * POST /register  — create user + company + membership + token
 * POST /login     — verify credentials, return user + company + token
 * POST /refresh   — rotate access token from a valid refresh token
 */
import { Router, Response } from 'express';
import { userRepository } from '../../repositories/userRepository';
import { companyRepository, memberRepository } from '../../repositories/companyRepository';
import { subscriptionRepository } from '../../repositories/subscriptionRepository';
import { hashPassword, comparePassword, signJWT, verifyJWT, decodeJWT } from '../../utils/crypto';
import { computeEntitlements, ROLE_DEFAULT_TIER } from '../../utils/permissions';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { validateBody, isValidEmail, isValidPassword } from '../../utils/validation';
import {
  badRequest, unauthorized, conflict, forbidden, validationError,
} from '../../utils/errors';
import { User, Company, UserRole, UserTier } from '../../types';
import { config } from '../../config';
import { setRefreshCookie, clearRefreshCookie, getCookie, REFRESH_COOKIE_NAME } from '../../utils/cookies';
import { createLimiter } from '../../middleware/rateLimit';

const router = Router();
const meRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────

/** Strip passwordHash before returning a user in API responses. */
function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  const { passwordHash, ...safe } = user;
  return safe;
}

function buildToken(user: User, companyId: string) {
  const tier = ROLE_DEFAULT_TIER[user.role] || 'FREE' as UserTier;
  const entitlements = computeEntitlements(user.role, tier);
  const token = signJWT(
    { uid: user.id, companyId, role: user.role, tier, entitlements },
    config.jwtSecret,
    config.jwtExpiresInSeconds,
  );
  const refreshToken = signJWT(
    { uid: user.id, companyId, role: user.role, tier, entitlements, typ: 'refresh' },
    config.jwtSecret,
    config.jwtRefreshExpiresInSeconds,
  );
  return { token, refreshToken };
}

// ── POST /register ────────────────────────────────────────────────────────

router.post('/register', createLimiter('register'), validateBody([
  { field: 'email', label: 'Email', required: true, type: 'string', max: 254 },
  { field: 'password', label: 'Password', required: true, type: 'string', min: 8, max: 128 },
  { field: 'fullName', label: 'Full name', required: true, type: 'string', min: 2, max: 200 },
]), async (req, res, next) => {
  try {
    const { email, password, fullName, phone, companyName } = req.body || {};

    if (!isValidEmail(email)) throw badRequest('Invalid email format');
    if (!isValidPassword(password)) throw badRequest('Password must be at least 8 characters');

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw conflict('An account with this email already exists');
    }

    const requestedRole = req.body?.role as UserRole;
    const publicRoles: UserRole[] = ['particulier', 'artisan', 'fournisseur', 'ingenieur', 'client', 'contractor', 'vendor', 'engineer'];
    
    // SECURITY FIX: Explicitly reject admin role in public registration
    if (requestedRole === 'admin') {
      throw validationError('Admin registration is not allowed. Contact system administrator.');
    }
    
    const role: UserRole = publicRoles.includes(requestedRole) ? requestedRole : 'artisan';
    const tier = ROLE_DEFAULT_TIER[role] || 'FREE' as UserTier;

    const passwordHash = await hashPassword(password);
    const user = await userRepository.create({
      email: normalizedEmail,
      passwordHash,
      fullName,
      phone: phone || '',
      role,
      tier,
      status: 'active',
    });

    const company = await companyRepository.create({
      legalName: companyName || fullName + "'s Company",
      tradeName: companyName || undefined,
      countryCode: 'TN',
      currencyCode: 'TND',
      status: 'active',
    });

    await memberRepository.create(user.id, company.id, role, tier, computeEntitlements(role, tier));

    // Phase 2 contract: every new company starts with a default subscription.
    subscriptionRepository.create(company.id, tier);

    const { token, refreshToken } = buildToken(user, company.id);
    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      user: sanitizeUser(user),
      company,
      token,
      refreshToken,
    });
  } catch (err) { next(err); }
});

// ── POST /login ───────────────────────────────────────────────────────────

router.post('/login', createLimiter('login'), validateBody([
  { field: 'email', label: 'Email', required: true, type: 'string', max: 254 },
  { field: 'password', label: 'Password', required: true, type: 'string', min: 1, max: 128 },
]), async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = email.toLowerCase().trim();

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) throw unauthorized('Invalid email or password');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw unauthorized('Invalid email or password');

    if (user.status === 'suspended') throw forbidden('Account is suspended');

    const memberships = await memberRepository.findByUserId(user.id);
    const companyId = memberships[0]?.companyId || '';

    const { token, refreshToken } = buildToken(user, companyId);
    setRefreshCookie(res, refreshToken);

    res.json({
      user: sanitizeUser(user),
      company: companyId ? await companyRepository.findById(companyId) : null,
      token,
      refreshToken,
    });
  } catch (err) { next(err); }
});

// ── POST /refresh ─────────────────────────────────────────────────────────

router.post('/refresh', createLimiter('refresh'), async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.substring(7)
      : req.body?.refreshToken;

    if (!token) {
      token = getCookie(req, REFRESH_COOKIE_NAME);
    }

    if (!token) throw unauthorized('Refresh token required');

    const claims = verifyJWT(token, config.jwtSecret);
    if (!claims) throw unauthorized('Invalid or expired refresh token');

    const user = await userRepository.findById(claims.uid);
    if (!user) throw unauthorized('User no longer exists');
    if (user.status === 'suspended') throw forbidden('Account is suspended');

    const memberships = await memberRepository.findByUserId(user.id);
    const companyId = claims.companyId || memberships[0]?.companyId || '';

    if (companyId) {
      const membership = await memberRepository.findMembership(user.id, companyId);
      if (!membership) throw forbidden('No active company membership');
    }

    const { token: newToken, refreshToken } = buildToken(user, companyId);
    setRefreshCookie(res, refreshToken);
    res.json({ token: newToken, refreshToken });
  } catch (err) { next(err); }
});

// ── POST /logout ────────────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  clearRefreshCookie(res);
  res.json({ ok: true });
});

// ── GET /users/me ─────────────────────────────────────────────────────────

meRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await userRepository.findById(req.user!.uid);
    if (!user) throw unauthorized('User not found');

    const memberships = await memberRepository.findByUserId(user.id);
    const primaryCompanyId = req.user!.companyId || memberships[0]?.companyId || '';
    const company = primaryCompanyId ? await companyRepository.findById(primaryCompanyId) : undefined;
    const subscription = primaryCompanyId ? subscriptionRepository.findByCompanyId(primaryCompanyId) : undefined;

    res.json({
      user: sanitizeUser(user),
      company: company || null,
      subscription: subscription || null,
      entitlements: req.user!.entitlements,
    });
  } catch (err) { next(err); }
});

export { router as authRouter, meRouter };
