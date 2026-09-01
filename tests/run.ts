/**
 * Phase 2 — Test Runner
 *
 * Executes the full test suite: Auth, Authorization, Materials, Prices,
 * Devis, Supplier imports, and Sync.
 *
 * Usage: npm test   (or)   tsx tests/run.ts
 */
import { strictEqual, ok as assertOk } from 'assert';
import { startTestServer, apiRequest, TestServer } from './setup';
import { memoryStore } from '../server/repositories/store';

let passed = 0;
let failed = 0;
const failures: string[] = [];

export async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (err: any) {
    failed++;
    const msg = `  FAIL ${name}\n       ${err?.message || err}`;
    failures.push(msg);
    console.log(msg);
  }
}

export function assertEq(actual: any, expected: any, message?: string) {
  strictEqual(actual, expected, message);
}

export function ok(value: any, message?: string) {
  assertOk(value, message);
}

// Shared test context
export interface TestCtx {
  server: TestServer;
  freeToken: string;
  proToken: string;
  adminToken: string;
  freeCompanyId: string;
  proCompanyId: string;
  adminCompanyId: string;
}

export const ctx: Partial<TestCtx> = {};

async function main() {
  memoryStore.resetAll();
  const server = await startTestServer();
  ctx.server = server;

  console.log('\n═══════════════════════════════════════════');
  console.log(' KONSTRIVO PHASE 2 — API TEST SUITE');
  console.log(` Server on ${server.baseUrl}`);
  console.log('═══════════════════════════════════════════\n');

  const { runAuthTests } = await import('./auth.test');
  const { runMaterialPriceTests } = await import('./materials.test');
  const { runDevisTests } = await import('./devis.test');
  const { runSupplierTests } = await import('./suppliers.test');
  const { runSyncTests } = await import('./sync.test');
  const { runDirectoryTests } = await import('./directory.test');

  await runAuthTests();
  await runMaterialPriceTests();
  await runDevisTests();
  await runSupplierTests();
  await runSyncTests();
  await runDirectoryTests();

  console.log('\n═══════════════════════════════════════════');
  console.log(` RESULTS: ✅ ${passed} passed | ❌ ${failed} failed`);
  console.log('═══════════════════════════════════════════\n');

  if (failures.length > 0) {
    console.log('FAILED TESTS:');
    failures.forEach(f => console.log(f));
    console.log('');
  }

  await server.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[KONSTRIVO] Test runner crashed:', err);
  process.exit(1);
});
