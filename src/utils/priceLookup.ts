import { MaterialRate } from '../types';
import { DEFAULT_MARKET_RATES } from '../data/marketRates';

/**
 * Step 5 — Material ID bridge.
 *
 * The Calculator looks up prices by the LEGACY slug (e.g. `plaque_ba13_standard`)
 * that it hardcodes. PostgreSQL stores that slug in `materials.code` while
 * `materials.id` is a UUID. The prices API now returns `code` alongside each
 * price (server-side JOIN), so the lookup key is `code` when present.
 *
 * `priceKey` falls back to `materialId` so the SAME logic also works against
 * the in-memory repository (dev mode), where `materialId` IS the legacy slug
 * and no `code` field exists. One function, both paths.
 */
export function priceKey(p: { code?: string | null; materialId?: string | null }): string {
  return p.code ?? p.materialId ?? '';
}
/**
 * Step 5b — Canonical catalog code ↔ calculator business ID (PLACO / PLÂTRE ONLY).
 *
 * The production PostgreSQL price catalog identifies PLACO materials with
 * canonical hyphenated `materials.code` values (e.g. `plaque-ba13-standard-3m`,
 * `fourrure-f47`), while the Calculator and DEFAULT_MARKET_RATES look prices up
 * by the legacy underscore business IDs (e.g. `plaque_ba13_standard`,
 * `fourrure`). The prices API returns the canonical `code` verbatim, so
 * `buildPriceMap` expands every canonical code into the business id(s) the
 * calculator actually resolves (`priceKeysFor`).
 *
 * STRICT SCOPE:
 *  - This table maps IDENTIFIERS ONLY — it never carries or invents prices.
 *  - Codes WITHOUT an alias keep their raw key: every other trade (carrelage,
 *    peinture, ...), every other market (FR, MY, SA, ...) and the memory/dev
 *    path (where `materialId` already IS the legacy slug) are untouched.
 *  - No DB schema, API contract, auth or calculation-formula change.
 */
export const CANONICAL_PLACO_CODE_ALIASES: Record<string, string | string[]> = {
  // ── Plaques de plâtre / ciment ────────────────────────────────────────────
  'plaque-ba13-standard-3m': 'plaque_ba13_standard',   // BA13 1.20×3.00m
  'plaque-ba13-standard-2m5': 'plaque_ba13_standard',  // BA13 1.20×2.50m (single BA13 rate; plate size is a calculator input, not a separate rate)
  'plaque-ba13-hydro': 'plaque_ba13_hydrofuge',
  'plaque-ba13-coupe-feu': 'plaque_ba13_coupe_feu',
  'plaque-ciment': ['plaque_aquapanel_ciment', 'plaque_aquapanel_exterieur'], // outdoor cement board slots (NOT the distinct interior tile-backer rate)
  // ── Ossature métallique ───────────────────────────────────────────────────
  'rail-48': 'rail_48',
  'rail-70': 'rail_70',
  'montant-48': 'montant_48',
  'montant-70': 'montant_70',
  'fourrure-f47': 'fourrure',
  'corniere-3m': ['corniere_rive_L', 'corniere_angle'], // same 3m L-profile slot in plafond démontable / faux plafond / caisson
  // ── Grille plafond démontable ─────────────────────────────────────────────
  'porteur-t24': 'porteur_3600',
  'entretoise-t24-1.20': 'entretoise_1200',
  'entretoise-t24-0.60': 'entretoise_600',
  'dalle-60x60': 'dalle_vinyl_60x60',
  // ── Finition / fixations / isolation ──────────────────────────────────────
  'bande-joint': 'bande_a_joint_90m',
  'bande-arm': 'bande_a_joint_90m',                    // joint tape slot (paper / armée share the single calculator slot)
  'enduit-25kg': 'enduit_joint_25kg',
  'enduit-colle-25': 'colle_gypse_25kg',
  'vis-placo-1000': 'vis_placo_25',
  'vis-trpf-1000': 'vis_trpf',
  'vis-ciment-1000': 'vis_aquapanel',
  'laine-verre-12': 'laine_de_verre_50mm',
};

// Additional, minimal non-PLACO aliases discovered during audit.
// These map a canonical hyphenated `materials.code` to the legacy calculator
// id the calculators actually look up. Only add explicit mappings where a
// semantic & dimensional match exists (no price invention).
export const CANONICAL_ADDITIONAL_ALIASES: Record<string, string | string[]> = {
  // Plinthes used by the Carrelage calculator map to the canonical MDF plinthes
  // row (2.4m pieces) in DEFAULT_MARKET_RATES.
  'plinthes-mdf-decor-2-4m': 'plinthes_carrelage',
};

/**
 * Expand a server-side price key into the business id(s) the Calculator looks
 * up. Keys without a canonical alias pass through unchanged.
 */
export function priceKeysFor(key: string): string[] {
  const alias = CANONICAL_PLACO_CODE_ALIASES[key];
  if (alias) return Array.isArray(alias) ? alias : [alias];
  const alias2 = CANONICAL_ADDITIONAL_ALIASES[key];
  if (alias2) return Array.isArray(alias2) ? alias2 : [alias2];

  // Generic, safe fallback for non-PLACO trades:
  // Only transform hyphenated canonical keys to underscores when the
  // resulting legacy slug exists in the in-code catalog or appears as a
  // target alias for PLACO. This avoids converting unrelated hyphenated
  // identifiers (UUIDs, opaque external ids, etc.).
  if (key.includes('-')) {
    const candidate = key.replace(/-/g, '_');
    const knownIds = new Set(DEFAULT_MARKET_RATES.map(r => r.id));
    // collect alias targets from the explicit PLACO alias table
    const aliasTargets = new Set<string>();
    for (const v of Object.values(CANONICAL_PLACO_CODE_ALIASES)) {
      if (Array.isArray(v)) for (const s of v) aliasTargets.add(s);
      else aliasTargets.add(v);
    }
    if (knownIds.has(candidate) || aliasTargets.has(candidate)) return [candidate];
  }

  return [key];
}

/**
 * Price + trade info resolved from the normalized server price list.
 *
 * Phase D — carries the authoritative trade relationship (tradeId + trade code)
 * so the frontend can resolve dynamic-trade materials correctly instead of
 * hardcoding `category: 'placo'`.
 */
export interface ResolvedPrice {
  price: number;
  trade: string | null;
  tradeId: string | null;
}

/**
 * Build a `Map<legacySlug, number>` from the normalized server price list.
 *
 * Selection rules (unchanged business logic, just keyed by legacy slug):
 *  - candidates: `isCurrent === true` OR effective window covers `now`
 *  - tiebreak: newest `updatedAt`, then highest `version`
 *
 * Pure function — no React, no DB — so it is unit-testable in isolation.
 *
 * NOTE: This is the backward-compatible form. Use `buildPriceMapWithTrade` when
 * you also need the authoritative trade relationship (Phase D dynamic trades).
 */
export function buildPriceMap(serverPrices: any[]): Map<string, number> {
  // Backward-compatible form: strip trade info, keep only price.
  const withTrade = buildPriceMapWithTrade(serverPrices);
  const result = new Map<string, number>();
  for (const [key, resolved] of withTrade.entries()) {
    result.set(key, resolved.price);
  }
  return result;
}

/**
 * Phase D — build a `Map<legacySlug, ResolvedPrice>` from the normalized
 * server price list. Carries the authoritative trade relationship so
 * `mergeRates` can assign the correct category to dynamic-trade materials.
 *
 * Selection rules are identical to `buildPriceMap`.
 */
export function buildPriceMapWithTrade(serverPrices: any[]): Map<string, ResolvedPrice> {
  const now = Date.now();
  const byKey = new Map<string, any[]>();
  for (const p of serverPrices) {
    if (!p) continue;
    const key = priceKey(p);
    if (!key) continue;
    // Step 5b — canonical PLACO catalog codes expand to the calculator's
    // business id(s); everything else keeps its raw key (unchanged behavior).
    for (const k of priceKeysFor(key)) {
      const arr = byKey.get(k) || [];
      arr.push(p);
      byKey.set(k, arr);
    }
  }

  const priceMap = new Map<string, ResolvedPrice>();
  for (const [key, entries] of byKey.entries()) {
    const candidates = entries.filter((p: any) => {
      if (p.isCurrent) return true;
      try {
        const from = p.effectiveFrom ? Date.parse(p.effectiveFrom) : NaN;
        const to = p.effectiveTo ? Date.parse(p.effectiveTo) : NaN;
        if (!isNaN(from) && (isNaN(to) || now <= to) && now >= from) return true;
      } catch {}
      return false;
    });
    if (candidates.length === 0) continue;
    candidates.sort((a: any, b: any) => {
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : (a.createdAt ? Date.parse(a.createdAt) : 0);
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : (b.createdAt ? Date.parse(b.createdAt) : 0);
      if (ta !== tb) return tb - ta;
      const va = typeof a.version === 'number' ? a.version : parseInt(a.version || '0', 10) || 0;
      const vb = typeof b.version === 'number' ? b.version : parseInt(b.version || '0', 10) || 0;
      return vb - va;
    });
    const chosen = candidates[0];
    if (chosen && typeof chosen.price === 'number') {
      priceMap.set(key, {
        price: chosen.price,
        trade: chosen.trade ?? null,
        tradeId: chosen.tradeId ?? null,
      });
    }
  }
  return priceMap;
}

/**
 * Merge a server price map into the local `rates` array (Step 3 priority:
 * a valid server price for a slug ALWAYS wins over the cached value for the
 * same slug; server-only slugs are appended so they stay visible).
 *
 * Phase D — server-only materials now receive their ACTUAL trade (from the
 * `ResolvedPrice.trade` / `tradeId`) instead of a hardcoded `category: 'placo'`.
 * This fixes the critical bug where database-sourced dynamic-trade materials
 * were mis-categorized and invisible to the generic calculator.
 *
 * Pure function — unit-testable.
 */
export function mergeRates(prev: MaterialRate[], priceMap: Map<string, ResolvedPrice>): MaterialRate[] {
  if (priceMap.size === 0) return prev;
  const prevById = new Map(prev.map(r => [r.id, r]));
  const updated: MaterialRate[] = [];
  for (const r of prev) {
    if (priceMap.has(r.id)) {
      updated.push({ ...r, unitPriceTnd: priceMap.get(r.id)!.price });
    } else {
      updated.push(r);
    }
  }
  for (const [key, resolved] of priceMap.entries()) {
    if (!prevById.has(key)) {
      // Phase D — use the authoritative trade from the server price row.
      // Falls back to the legacy `trade` code, then to a neutral 'dynamic'
      // category only if no trade info is available at all.
      const tradeCategory = resolved.trade ?? 'dynamic';
      updated.push({
        id: key,
        category: tradeCategory,
        nameFr: `Server price (${tradeCategory})`,
        nameAr: '',
        nameDerja: '',
        unit: 'unit',
        unitPriceTnd: resolved.price,
        defaultPriceTnd: resolved.price,
      });
    }
  }
  return updated;
}