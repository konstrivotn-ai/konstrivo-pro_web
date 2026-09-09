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

### Test Execution Status
- **Tests Executed in This Audit:** Not executed in this audit.
- **Note:** Tests require `TEST_DATABASE_URL` environment variable for PostgreSQL integration tests.

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
   - Test execution not verified in this audit

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
**Audit Type:** Documentation Only
**Code Changes:** None

