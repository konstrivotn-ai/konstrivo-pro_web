/**
 * KONSTRIVO — Central Website API client (Phase 1 auth foundation)
 *
 * Security posture:
 *  - The access (JWT) token lives ONLY in JS module memory (never in
 *    localStorage / sessionStorage), so it does not survive a tab close.
 *  - The refresh token lives in an HttpOnly + SameSite=Strict (+ Secure in
 *    production) cookie set by the server (see server/utils/cookies.ts).
 *  - On a 401 the client silently rotates the access token via the refresh
 *    cookie, then retries the original request once.
 *
 * Uses the native Fetch API + `credentials: 'include'` so the browser
 * automatically sends the HttpOnly refresh cookie for same-origin /api/v1 calls.
 * The SPA is served by the same Express origin, so no CORS preflight dance is
 * needed for the auth flow.
 */
import type { UserProfile, UserRole, CountryCode } from '../types';

const BASE = '/api/v1';

// ── In-memory access token (never persisted to Web Storage) ────────────────
let accessToken: string | null = null;
type Listener = () => void;
const listeners = new Set<Listener>();

export const getAccessToken = (): string | null => accessToken;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((l) => l());
}

export function onAuthChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Use the HttpOnly refresh cookie to obtain a fresh access token. */
async function silentRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data: { token?: string } = await res.json().catch(() => ({}));
    if (data.token) {
      setAccessToken(data.token);
      return data.token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * fetch wrapper that attaches the in-memory access token and transparently
 * retries once on 401 after a silent refresh.
 */
async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      res = await fetch(input, { ...init, headers, credentials: 'include' });
    }
  }
  return res;
}

// ── Backend user/company shapes (server returns these, sanitized) ──────────
interface BackendUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  status: string;
  region?: string;
  country?: CountryCode;
  licenseNumber?: string;
  matriculeFiscale?: string;
  avatarUrl?: string;
  createdAt?: string;
}
interface BackendCompany {
  legalName?: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  taxId?: string;
}

function mapUserToProfile(
  user: BackendUser,
  company: BackendCompany | null | undefined,
): UserProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    company: company?.legalName,
    companyName: company?.legalName,
    region: user.region || 'Tunis Grand',
    country: (user.country as CountryCode) || 'TN',
    matriculeFiscale: user.matriculeFiscale,
    taxNumber: user.matriculeFiscale,
    licenseNumber: user.licenseNumber,
    avatarUrl: user.avatarUrl,
    avatar: user.avatarUrl,
    isVerified: user.status === 'active',
    createdAt: user.createdAt,
  };
}

interface AuthResponse {
  user: BackendUser;
  company: BackendCompany | null;
  token: string;
  refreshToken: string;
}

export interface LoginInput { email: string; password: string; }
export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  companyName?: string;
  role?: UserRole;
  region?: string;
  country?: CountryCode;
  matriculeFiscale?: string;
  licenseNumber?: string;
}

export async function login(input: LoginInput): Promise<UserProfile> {
  const res = await apiFetch(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || 'Échec de la connexion');
  }
  const data: AuthResponse = await res.json();
  setAccessToken(data.token);
  return mapUserToProfile(data.user, data.company);
}

export async function register(input: RegisterInput): Promise<UserProfile> {
  const res = await apiFetch(`${BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || "Échec de l'inscription");
  }
  const data: AuthResponse = await res.json();
  setAccessToken(data.token);
  return mapUserToProfile(data.user, data.company);
}

/**
 * Restore a session on page load using the HttpOnly refresh cookie.
 * Returns the server-validated profile (or null when not authenticated).
 */
export async function restoreSession(): Promise<UserProfile | null> {
  const res = await apiFetch(`${BASE}/users/me`, { method: 'GET' });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({})) as {
    user: BackendUser;
    company?: BackendCompany | null;
  };
  return mapUserToProfile(data.user, data.company ?? null);
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    /* ignore network errors on logout */
  }
  setAccessToken(null);
}

// ---------------- Devis API (minimal client wrappers) --------------------
export async function listDevis(opts?: { page?: number; limit?: number; status?: string; search?: string }) {
  const q = new URLSearchParams();
  if (opts?.page) q.set('page', String(opts.page));
  if (opts?.limit) q.set('limit', String(opts.limit));
  if (opts?.status) q.set('status', opts.status);
  if (opts?.search) q.set('search', opts.search);
  const url = `${BASE}/devis${q.toString() ? '?' + q.toString() : ''}`;
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to list devis');
  return await res.json().catch(() => ({ data: [], page: 1, limit: 20, total: 0 }));
}

export async function createDevis(body: any, idempotencyKey?: string) {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await apiFetch(`${BASE}/devis`, { method: 'POST', body: JSON.stringify(body), headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || 'Failed to create devis');
  }
  const data = await res.json();
  return data.data || data;
}

export async function updateDevis(id: string, body: any) {
  const res = await apiFetch(`${BASE}/devis/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || 'Failed to update devis');
  }
  const data = await res.json();
  return data.data || data;
}

export async function deleteDevis(id: string) {
  const res = await apiFetch(`${BASE}/devis/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || 'Failed to delete devis');
  }
  return;
}
