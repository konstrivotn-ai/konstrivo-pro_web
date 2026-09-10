# KONSTRIVO — Project State

## Audit Information

- **Audit Date:** 2026-09-09
- **Git Branch:** main
- **Git Commit:** 81d7204ad3e2ffde985ad23cc5e1140e3a5f2ae9
- **Git Verification:** Branch + HEAD commit confirmed read-only from `.git/HEAD` and `.git/packed-refs` (git CLI unavailable in the audit session)
- **Audit Type:** Documentation Only (No Code Changes)

---

## System Status

### Android
- **Status:** Not present in this repository
- **Note:** Android application is a separate codebase
- **API Compatibility:** Backend API designed for Android compatibility

### Web (Frontend)
- **Status:** ✅ Implemented
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS 4
- **Components:** 20+ React components
- **Pages/Tabs:** 13 tab components (Home, Calculator, Projects, Directory/Marketplace, Maintenance, Rates, Devis, Knowledge, About, Contact, AI Assistant, Settings, Services) + 8 modals
- **State Management:** React Hooks + Context
- **API Client:** Custom fetch wrapper with JWT auth

### Backend
- **Status:** ✅ Implemented
- **Framework:** Express.js 4 + TypeScript
- **API Version:** v1 (`/api/v1`)
- **Authentication:** JWT (access + refresh tokens)
- **Middleware:** CORS, Security Headers, Rate Limiting, Auth
- **Routes:** 12+ route modules
- **Services:** Auth, Catalog Import, Password Reset, AI Estimator

### Database
- **Status:** ✅ Implemented (PostgreSQL + Drizzle)
- **Tables:** 20 tables (see Database Schema below)
- **Migrations:** Drizzle Kit
- **Schema Files:** 5 schema modules (identity, catalog, devis, operations, password_reset_tokens)

---

## API Endpoints (v1)

### Authentication
- POST `/api/v1/auth/register` — User registration
- POST `/api/v1/auth/login` — User login
- POST `/api/v1/auth/refresh` — Token refresh
- POST `/api/v1/auth/logout` — User logout
- POST `/api/v1/auth/forgot` — Password reset request
- POST `/api/v1/auth/reset` — Password reset

### Users
- GET `/api/v1/users/me` — Current user profile

### Materials
- GET `/api/v1/materials` — List materials
- GET `/api/v1/materials/:id` — Get material details

### Trades
- GET `/api/v1/trades` — List trades
- GET `/api/v1/trades/:id` — Get trade details
- GET `/api/v1/trades/:id/services` — Services for a trade

### Prices
- GET `/api/v1/prices` — List prices
- GET `/api/v1/prices/sources` — List price sources
- POST `/api/v1/prices/custom` — Create custom price

### Devis
- GET `/api/v1/devis` — List devis
- POST `/api/v1/devis` — Create devis
- GET `/api/v1/devis/:id` — Get devis details
- PUT `/api/v1/devis/:id` — Update devis
- DELETE `/api/v1/devis/:id` — Delete devis

### Suppliers
- POST `/api/v1/suppliers/upload` — Upload catalog
- GET `/api/v1/suppliers/imports/:id` — Get import details
- POST `/api/v1/suppliers/imports/:id/approve` — Approve import

### Catalog
- POST `/api/v1/catalog/preview` — Preview catalog import
- POST `/api/v1/catalog/import` — Import catalog (CSV/XLSX transactional)
- POST `/api/v1/catalog/import-csv` — Legacy CSV import
- POST `/api/v1/catalog/upsert` — Upsert catalog item
- GET `/api/v1/catalog/price-updates/pending` — List pending price updates
- POST `/api/v1/catalog/price-updates` — Submit price update
- POST `/api/v1/catalog/price-updates/:id/approve` — Approve price update
- POST `/api/v1/catalog/admin/price-update/run` — Run price update pipeline (protected, requires X-Price-Update-Token header)

### Artisans
- GET `/api/v1/artisans` — List artisans
- GET `/api/v1/artisans/:id` — Get artisan details

### Projects
- GET `/api/v1/projects` — List projects
- POST `/api/v1/projects` — Create project
- GET `/api/v1/projects/:id` — Get project details
- PUT `/api/v1/projects/:id` — Update project
- DELETE `/api/v1/projects/:id` — Delete project

### Subscriptions
- GET `/api/v1/subscriptions/me` — Current subscription

### Sync
- POST `/api/v1/sync/pull` — Pull sync
- POST `/api/v1/sync/push` — Push sync

### Machine
- Mounted at `/api/v1/machine` (`server/routes/v1/machine.ts`) — endpoints not enumerated in API discovery. Needs Verification.

**Endpoint count note:** The `GET /api/v1/` discovery response lists 26 endpoints; additional handlers exist (catalog import/upsert/price-update-run, trades services, machine, sync). Exact total: Needs Verification.

---

## Tests

### Test Files (non-exhaustive — identified during audit)
- `tests/run.ts` — Main test runner
- `tests/setup.ts` — Shared test server harness
- `tests/runPhaseC.ts` — Focused Phase C runner
- `tests/auth.test.ts` — Authentication tests
- `tests/materials.test.ts` — Material tests
- `tests/devis.test.ts` — Devis tests
- `tests/suppliers.test.ts` — Supplier tests
- `tests/sync.test.ts` — Sync tests
- `tests/catalogImportCsv.test.ts` — CSV import tests
- `tests/catalogImportPhaseC.test.ts` — Phase C import tests
- `tests/trades_phase2a.test.ts` — Trade Phase 2A tests
- `tests/trades_phase2b.test.ts` — Trade Phase 2B tests
- `tests/trades_phaseB.test.ts` — Trade Phase B tests
- `tests/price_normalization.test.ts` — Price normalization tests
- `tests/priceUpdateEndpoint.test.ts` — Price update tests
- `tests/password_reset_repository.test.ts` — Password reset repository tests
- `tests/password_reset_service.test.ts` — Password reset service tests
- `tests/api_auth_forgot_reset.test.ts` — Auth forgot/reset API tests
- `tests/reset_password_page.test.ts` — Reset password page tests
- `tests/bootstrap.test.ts` — Bootstrap tests
- `tests/test_database_config.test.ts` — Database config tests
- `tests/drizzle_user_update.test.ts` — Drizzle user update tests
- `tests/directory.test.ts` — Directory tests
- `tests/ai.test.ts` — AI tests
- `tests/rate_limit.test.ts` — Rate limit tests
- `tests/cors.test.ts` — CORS tests
- `tests/security_headers.test.ts` — Security headers tests
- `tests/catalogUploadModal.test.ts` — CatalogUploadModal frontend Smart Mapping / CSV / Excel validation tests (added 2026-09-09, frontend-only)

### Test Execution Status
- **Tests Executed in This Audit:** Not executed in this audit.
- **Note:** Tests require `TEST_DATABASE_URL` environment variable for PostgreSQL integration tests.
- **2026-09-09 (catalog import fix session):** `tests/catalogUploadModal.test.ts` executed via `npx tsx` → **9/9 PASS** (simple CSV, Master CSV with price not in last column, `;`-delimited, UTF-8 BOM, missing price column → explicit error, invalid-row reporting, French decimal parsing, supplier alias mapping, TSV + quoted commas).
- **2026-09-09:** `npx tsc --noEmit` → exit 0; `npx vite build` → success.
- **2026-09-09:** `npm test` (`tsx tests/run.ts`) aborts at startup **before any test executes**: `PostgreSQL integration tests require NODE_ENV=test` (`tests/setup.ts:43`) — pre-existing environmental requirement, unrelated to the frontend fix.
- **2026-09-09 (new-materials fix session):** `catalogUploadModal.test.ts` → **15/15 PASS** (6 new `applyParsedCatalog` tests: update / add / mixed / idempotent re-import / within-file duplicates / unit + id safety). `npx tsx tests/phaseD.test.ts` → all PASS. `npx tsc --noEmit` → exit 0. `npx vite build` → exit 0.
- **2026-09-10 (Smart Mapping UI fix session):** ⚠️ **Needs Verification (agent session).** The agent session terminal returned exit 1 with NO output for every command (including `echo` and `git --version`), so `npx tsc --noEmit`, `npx tsx tests/catalogUploadModal.test.ts` and `npm run build` could not be executed by the agent. External verification run reported: tsc PASS, build PASS, suite **20/21** — single FAIL was `canonicalHeaderKey('Matériau code', headers) → 'material_code'` ("accents normalized"): **wrong test expectation, not a canonicalization defect** — accent-stripping yields `materiau_code`, and "Matériau" ≠ "material" as words, so no generic accent/case/spacing canonicalizer can (or should) equate them. Test corrected (test-only, no production change): genuine accent-only variants now assert conversion to the EXACT accented row-record keys (`'reference' → 'Référence'`, `'\uFEFFDESIGNATION' → 'Désignation'`, `'prix  ht' → 'Prix_HT'`) plus a guard that distinct words are never fuzzy-matched (`'Matériau code' → ''`). Re-run of the three commands pending → expected 21/21 + PASS.

---

## Builds

### Build Configuration
- **Frontend Build:** Vite (`vite build`)
- **Backend Build:** esbuild (`esbuild server.ts --bundle`)
- **Output:** `dist/` directory

### Build Status
- **Builds Executed in This Audit:** Not executed in this audit.

---

## Feature Status

### Implemented ✅
- [x] Material quantity calculator
- [x] Devis generation
- [x] Project management
- [x] Artisan directory
- [x] Marketplace
- [x] Maintenance services
- [x] AI assistant
- [x] User authentication (JWT)
- [x] Multi-currency support
- [x] API v1 endpoints
- [x] PostgreSQL database
- [x] Drizzle ORM integration
- [x] Catalog import (CSV/XLSX)
- [x] Price update workflow
- [x] Sync operations
- [x] Password reset flow

### In Progress 🔄
- [ ] Supplier catalog Drizzle backend (currently memory-only in dev)
- [ ] Advanced analytics
- [ ] Mobile app integration

### Planned 📋
- [ ] Android application
- [ ] iOS application
- [ ] Advanced reporting
- [ ] Payment integration
- [ ] Real-time chat
- [ ] WebSocket implementation

---

## Known Issues

1. **Secrets Management**
   - JWT_SECRET needs rotation for production
   - DATABASE_URL password rotation needed
   - ADMIN_PASSWORD should be removed from .env

2. **CORS Configuration**
   - CORS_ALLOWED_ORIGINS environment variable needs configuration
   - Production domain testing required

3. **Test Suite**
   - Requires TEST_DATABASE_URL for PostgreSQL integration tests
   - `npm test` aborts at startup with `PostgreSQL integration tests require NODE_ENV=test` (`tests/setup.ts:43`) — confirmed 2026-09-09; crash occurs before any test executes (pre-existing, unrelated to frontend code)

4. **Production Validation**
   - All endpoints need verification with production database
   - Offline sync workflow needs testing
   - Android client compatibility needs validation

---

## Requires Decision

1. **Secrets Rotation** — When to rotate production secrets?
2. **CORS Domains** — Which domains to allow in production?
3. **Test Database** — Separate test database configuration?
4. **Migration Strategy** — When to apply pending migrations?

---

## Needs Verification

1. **WebSocket Implementation** — Status unknown, needs code verification
2. **Email Delivery** — Resend API integration status
3. **Production Deployment** — Current deployment status
4. **Android API Compatibility** — Actual mobile client testing results
5. **Test Results** — Actual test execution results
6. **OpenAPI Definition** — No OpenAPI specification file found in the repository; the API contract lives in code (`server/routes/v1/index.ts` discovery + route modules)
7. **Machine Router Endpoints** — `/api/v1/machine` is mounted but its endpoints are not enumerated in API discovery
8. **Git Working Tree State** — Branch (`main`) and HEAD commit (`81d7204…`) confirmed read-only from `.git/HEAD` + `.git/packed-refs`; the working tree could not be enumerated (git CLI unavailable). Observation: local `main` (`81d7204…`) differs from `origin/main` (`2028863…`) — unpushed commits or a stale remote ref. Run `git status` manually before the next task.
9. **Older Audit Claims** — `FINAL_PRODUCTION_AUDIT.md` (2026-09-01) claims "15 core tables" and production readiness; the schema files now define 20 tables — the older audit predates schema additions and was not re-verified

---

## Recent Changes
### 2026-09-10 — Fix: Smart Mapping UI in CatalogUploadModal (frontend-only) — ⚠️ Needs Verification
- **Root cause:** `CatalogUploadModal.tsx` had NO user-visible Smart Mapping step — `resolveMapping()` ran inside `processRows()` into a transient variable, the mapping was never stored in state, and `buildParsedItems()` consumed that invisible mapping. With no shared value space between the mapping state (`appliedMapping`), the Select `value` and the option values (`optionsForField`), any mapping UI mixed value spaces (canonical keys vs raw CSV headers) and displayed `— Non mappé —` even when detection/parsing were correct.
- **Fix (frontend-only, same component):** one canonical value space — the EXACT header key used by the parsed row records — now shared by `appliedMapping` state, every `<select value>` and every `optionsForField()` option value:
  - `MAPPING_FIELDS` — UI field registry: Référence matériau, Désignation matériau, Catégorie, Métier, Unité, Prix HT, Taux TVA, Devise, Source/Fournisseur. NO "Métier (code)" row: the local `trade` field accepts trade labels by design, so a `trade` column maps legitimately to « Métier » and nothing pretends to consume a trade code.
  - `optionsForField(headers)` — option values = exact row-record header keys.
  - `canonicalHeaderKey(raw, headers)` — converts auto-detection values (BOM-prefixed / differently cased / accented / spaced raw headers) to the exact row key; '' when unmatched.
  - `buildAppliedMapping(headers, autoMapping, userMapping)` — auto-detection fills untouched fields; manual choices ALWAYS win and are never overwritten (`''` = explicit un-mapping); an override pointing at a column absent from the current file falls back to auto-detection; optional fields absent from the CSV stay '' (→ `— Non mappé —`).
  - New state `parsedRows` / `parsedHeaders` / `appliedMapping` / `userMapping`; a visible Smart Mapping panel (one Select per field) renders above the preview; every mapping change re-runs `buildParsedItems()` live; `handleApply()` re-parses with the exact displayed `appliedMapping` before `applyParsedCatalog()`.
  - Status message now reports `N ligne(s) à importer`; a missing price column no longer blocks the mapping UI — it prompts the user to map « Prix HT » manually.
- `tests/catalogUploadModal.test.ts` — 6 regression tests added (15 → 21): canonical field labels/order, option-value space, 40-row ALU CSV auto-selection (no "Non mappé" for detected fields), optional absent field stays unmapped, raw/BOM header canonicalization, manual-choice precedence, and the same-`appliedMapping`-drives-`buildParsedItems()` confirm flow (40 ALU lignes à importer, ALU-001…ALU-040 added, re-import idempotent).
- `ColumnMapping` is now exported (type-only import used by the test suite; additive, no contract change).
- **Status:** ⚠️ **Needs Verification** — `npx tsc --noEmit`, `npx tsx tests/catalogUploadModal.test.ts`, `npx vite build` and the manual `konstrivo_aluminium_test.csv` check could NOT be executed in this session (terminal/tooling shell returned exit 1 with no output for every command, including `echo`/`git --version`). No API/server/DB/RatesTab/ServicesTab/calculator/CSV-parser changes were made.


### 2026-09-09 — Fix: Import Catalogue Fournisseur (Web Frontend Only)
- **Scope:** Frontend-only repair of the supplier catalogue import modal. No DB, schema, API, model, or calculation-engine changes; no completed phase touched.
- `src/App.tsx` — RatesTab button "Importer Catalogue Fournisseur (CSV/Excel)" now opens `CatalogUploadModal` via `setShowCatalogModal(true)` (was opening the supplier dashboard modal). `SupplierDashboardModal` remains used by `LivePriceIndexWidget`.
- `src/components/CatalogUploadModal.tsx` — Rewritten import pipeline:
  - Header-name based **Smart Mapping** (accent-insensitive) covering the official Master CSV columns (`material_code, material_name, category, trade, unit, price_ht, tva_rate, currency, source, effective_from, effective_to, observed_at, status`) plus supplier variants (`designation/produit`, `reference/ref/code`, `categorie`, `metier`, `unite`, `prix_ht/prix_ht_tnd/price`, `tva`, `devise`, `fournisseur`…).
  - Price is read **only** from the mapped price column — never from the last column (fixes Master CSV where trailing columns are `effective_to/observed_at/status`).
  - CSV: auto delimiter detection (`,` `;` tab), UTF-8 BOM stripping, quoted commas / escaped quotes / quoted newlines; no fixed column order.
  - Excel: real `.xlsx/.xls` support via new `xlsx` dependency (`file.arrayBuffer()` — not `readAsText()`; first worksheet → rows/objects → same mapping/validation pipeline). `accept=".csv,.txt,.tsv,.xlsx,.xls"`.
  - Validation: `material_name` + `unit` required; `price_ht` numeric > 0; TVA falls back to the UI-selected rate; currency falls back to `TND`; invalid rows reported per-row with row number and reason; missing price column produces an explicit error message listing detected columns. No silent imports, no crashes.
  - Preview before Apply: rows read / valid / error counts + designation, unit, TVA, old/new Price HT, Price TTC, matched (Lié) vs new article.
  - `onApplyCatalog(updatedRates)` contract, existing matching logic and calculation behavior preserved unchanged.
- `package.json` / `package-lock.json` — Added dependency `xlsx@^0.18.5`.
- `tests/catalogUploadModal.test.ts` — New frontend suite (9 tests; all passing — see Test Execution Status).
- **Status:** Implemented & verified (tsc clean, 9/9 frontend tests, vite build OK). Full `npm test` suite remains blocked by the pre-existing `NODE_ENV=test` requirement (see Known Issues §3).

### 2026-09-09 — Fix: Supplier Catalogue Import now ADDS new materials on Apply
- **Root cause:** `handleApply()` in `CatalogUploadModal.tsx` only mapped over the existing `rates` array — imported materials recognized as "Nouvel article" (e.g. ALU-001…ALU-040) were silently dropped after Enregistrer. The old matching was also many-to-many (`nameFr.includes()`), which could overwrite several rates with one item's price.
- **Fix (frontend-only, same component):** new exported pure helper `applyParsedCatalog(rates, items, opts)`:
  - Result = existing rates + updated matches + newly added articles; existing rates never removed or replaced; input array not mutated.
  - Matching order: (a) `material_code` ↔ existing id via slug normalization (`slugifyMaterialId`), (b) preview-matched rate id, (c) normalized name with category preference. One-to-one enforcement + signature dedup ⇒ re-importing the same file is idempotent (no duplicates).
  - New articles get a complete `MaterialRate`: `id` = slug(material_code) (unique + deterministic; falls back to slug(name+category)), `category` = file category/trade (free string per Phase D), `unit` mapped safely into the allowed union via `mapImportedUnit` (unknown → `unit`, no blind casts), `unitPriceTnd` = `defaultPriceTnd` = imported HT price, `nameAr`/`nameDerja` fall back to `nameFr`, `note` carries supplier + import date (+ currency when ≠ TND).
- `handleApply()` now delegates to `applyParsedCatalog` and reports updated / added / duplicate counts.
- New materials appear immediately in Outils → Tarifs: RatesTab renders the whole `rates` array under the default "Tous" filter, and the `onApplyCatalog` → `handleBulkUpdateRates` → `setRates` flow is unchanged.
- **ServicesTab status:** unchanged (no architecture change). `ServicesTab.tsx` does NOT consume `rates` at all — it renders a static in-component `servicesList` (8 marketing service cards). That is why imported materials never appear there; this is by design, not a regression.
- Tests: `tests/catalogUploadModal.test.ts` extended 9 → **15 tests, all passing** (existing updated without mutation / new article added with full shape / mixed file / re-import idempotency / within-file duplicates / unit-union mapping + stable ids). `npx tsx tests/phaseD.test.ts` → all PASS (calculation engine untouched). `tsc --noEmit` exit 0; `vite build` exit 0.

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| users | User accounts |
| companies | Company profiles |
| company_members | User-company memberships |
| subscriptions | Company subscriptions |
| materials | Material catalog |
| material_prices | Material pricing |
| price_sources | Price source definitions |
| trades | Trade categories (Métiers) |
| trade_services | Services per trade |
| package_definitions | Package configurations |
| devis | Quotes/Devis |
| devis_items | Quote line items |
| suppliers | Supplier profiles |
| supplier_catalog_imports | Supplier catalog imports |
| supplier_catalog_items | Supplier catalog items |
| artisan_profiles | Artisan profiles |
| sync_operations | Sync operations |
| idempotency_keys | Idempotency keys |
| projects | Construction projects |
| password_reset_tokens | Password reset tokens |

---

**Last Updated:** 2026-09-09
**Audit Type:** Documentation Only (original audit) + frontend catalog-import fixes documented same day (see Recent Changes)
**Code Changes:** 2026-09-09 — `src/App.tsx`, `src/components/CatalogUploadModal.tsx` (import pipeline + apply/add-new-materials), `package.json` (+`xlsx` dep), `package-lock.json`, `tests/catalogUploadModal.test.ts` (new, 15 tests), `PROJECT_STATE.md` (documentation)

