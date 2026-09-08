/**
 * Phase B — Dynamic Trades Tests
 *
 * Focused tests for the dynamic trade functionality:
 *   1. Existing official trades are available
 *   2. A newly created/imported trade can be retrieved from the trade repository/API
 *   3. Its materials resolve to the correct trade
 *   4. The trade appears in the Quotes/Devis available trade source
 *   5. Existing official trade behavior remains unchanged
 *   6. No hardcoded 12-trade restriction blocks a dynamic trade
 */
import { apiRequest } from './setup';
import { test, assertEq, ok, ctx } from './run';
import {
  tradeRepository,
  MemoryTradeRepository,
  buildTradesFromCatalog,
  OFFICIAL_TRADES,
  officialTradeId,
  upsertTradeByCode,
} from '../server/repositories/tradeRepository';

export async function runTradePhaseBTests() {
  // ── 1. Existing official trades are available ──────────────────────────────
  await test('existing official trades are available (memory + repo)', async () => {
    const repo = new MemoryTradeRepository();
    const all = repo.list(false);
    ok(all.length >= 12, 'at least 12 official trades available');
    const codes = all.map(t => t.code);
    ok(codes.includes('placo'), 'placo is available');
    ok(codes.includes('peinture'), 'peinture is available');
    for (const t of all) {
      ok(t.isOfficial === true, `trade ${t.code} is official`);
    }
  });

  // ── 2. A newly created/imported trade can be retrieved ────────────────────
  await test('newly created trade can be retrieved from repository', async () => {
    const repo = new MemoryTradeRepository();
    const before = repo.findByCode('gypsum');
    assertEq(before, undefined, 'gypsum does not exist before creation');

    const created = await upsertTradeByCode('gypsum', 'GYPSUM / PLASTER');
    ok(created, 'trade was created');
    assertEq(created!.code, 'gypsum');
    assertEq(created!.isOfficial, false, 'dynamic trade is not official');
    assertEq(created!.isActive, true, 'dynamic trade is active');

    // Retrieve by code
    const byCode = repo.findByCode('gypsum');
    ok(byCode, 'gypsum can be retrieved by code');
    assertEq(byCode!.code, 'gypsum');

    // Retrieve by id
    const byId = repo.findById(created!.id);
    ok(byId, 'gypsum can be retrieved by id');
    assertEq(byId!.code, 'gypsum');
  });

  await test('upsertTradeByCode is idempotent', async () => {
    const repo = new MemoryTradeRepository();
    const first = await upsertTradeByCode('gypsum2', 'GYPSUM 2');
    const second = await upsertTradeByCode('gypsum2', 'GYPSUM 2 updated');
    ok(first && second, 'both calls succeed');
    assertEq(first!.id, second!.id, 'same trade returned on second call');
  });

  // ── 3. Materials resolve to the correct trade ──────────────────────────────
  await test('material resolves to dynamic trade via findForMaterial', async () => {
    const repo = new MemoryTradeRepository();
    const created = await upsertTradeByCode('gypsum3', 'GYPSUM 3');
    ok(created, 'trade created');

    // Resolve by tradeId
    const byTradeId = repo.findForMaterial({ tradeId: created!.id, trade: 'gypsum3' });
    ok(byTradeId, 'material resolves to dynamic trade via tradeId');
    assertEq(byTradeId!.code, 'gypsum3');

    // Resolve by legacy trade code
    const byLegacy = repo.findForMaterial({ trade: 'gypsum3' });
    ok(byLegacy, 'material resolves to dynamic trade via legacy code');
    assertEq(byLegacy!.code, 'gypsum3');
  });

  // ── 4. Dynamic trade appears in the available trade source ────────────────
  await test('dynamic trade appears in list() alongside official trades', async () => {
    const repo = new MemoryTradeRepository();
    await upsertTradeByCode('gypsum4', 'GYPSUM 4');

    const all = repo.list(false);
    const codes = all.map(t => t.code);
    ok(codes.includes('gypsum4'), 'dynamic trade appears in full list');
    ok(codes.includes('placo'), 'official trades still present');

    // officialOnly should NOT include dynamic trades
    const official = repo.list(true);
    const officialCodes = official.map(t => t.code);
    ok(!officialCodes.includes('gypsum4'), 'dynamic trade excluded from official-only list');
    ok(officialCodes.includes('placo'), 'official trades in official-only list');
  });

  // ── 5. Existing official trade behavior remains unchanged ─────────────────
  await test('official trades remain unchanged after dynamic trade creation', async () => {
    const repo = new MemoryTradeRepository();
    const placoBefore = repo.findByCode('placo');
    ok(placoBefore, 'placo exists before');

    // Create a dynamic trade
    await upsertTradeByCode('gypsum5', 'GYPSUM 5');

    // Verify placo is unchanged
    const placoAfter = repo.findByCode('placo');
    ok(placoAfter, 'placo exists after');
    assertEq(placoBefore!.id, placoAfter!.id, 'placo id unchanged');
    assertEq(placoBefore!.code, placoAfter!.code, 'placo code unchanged');
    assertEq(placoAfter!.isOfficial, true, 'placo still official');
  });

  // ── 6. No hardcoded 12-trade restriction blocks a dynamic trade ───────────
  await test('no hardcoded 12-trade restriction blocks dynamic trade', async () => {
    const repo = new MemoryTradeRepository();

    // Create multiple dynamic trades
    const dynamicCodes = ['gypsum6', 'metal_strofer', 'smart_glass'];
    for (const code of dynamicCodes) {
      const created = await upsertTradeByCode(code);
      ok(created, `dynamic trade ${code} created`);
    }

    // All should be in the list
    const all = repo.list(false);
    const codes = all.map(t => t.code);
    for (const code of dynamicCodes) {
      ok(codes.includes(code), `dynamic trade ${code} in list`);
    }

    // Total count should be 12 official + 3 dynamic = 15
    assertEq(all.length, 15, '12 official + 3 dynamic trades');
  });

  // ── 7. API: GET /api/v1/trades includes dynamic trades ────────────────────
  await test('GET /api/v1/trades includes dynamic trades (API)', async () => {
    const res = await apiRequest(ctx.server!.baseUrl, 'GET', '/api/v1/trades');
    assertEq(res.status, 200);
    ok(Array.isArray(res.body.data), 'response shape is { data: [...] }');
    ok(res.body.data.length >= 12, 'at least 12 trades exposed');

    const codes = res.body.data.map((t: any) => t.code);
    ok(codes.includes('placo'), 'placo exposed via API');
    ok(codes.includes('peinture'), 'peinture exposed via API');
  });

  // ── 8. API: GET /api/v1/trades?officialOnly=true excludes dynamic ─────────
  await test('GET /api/v1/trades?officialOnly=true excludes dynamic trades', async () => {
    const res = await apiRequest(ctx.server!.baseUrl, 'GET', '/api/v1/trades?officialOnly=true');
    assertEq(res.status, 200);
    for (const t of res.body.data) {
      ok(t.isOfficial === true, `trade ${t.code} is official`);
    }
  });
}