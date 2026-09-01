/**
 * Phase 2 — Supplier Import Tests
 */
import { apiRequest } from './setup';
import { test, assertEq, ok, ctx } from './run';

let importId = '';

export async function runSupplierTests() {
  console.log('\n📥 Supplier Import Tests\n');

  await test('valid CSV upload creates import with SHA-256', async () => {
    const csvContent = 'Reference,Designation,Categorie,Unite,Prix_HT_TND\r\nPLA-TEST-001,Test Plaque,placo,unit,31.500\r\nPLA-TEST-002,Test Rail,placo,unit,7.800';
    const boundary = '----FormBoundary7MA4YWxkTrZu0gW';
    const rawBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="catalogue_test.csv"',
      'Content-Type: text/csv',
      '',
      csvContent,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await apiRequest(ctx.server!.baseUrl, 'POST', '/api/v1/suppliers/upload', {
      token: ctx.proToken,
      rawBody,
      contentType: `multipart/form-data; boundary=${boundary}`,
    });
    assertEq(res.status, 201);
    ok(res.body.data.id);
    ok(res.body.data.fileSha256, 'SHA-256 hash must be computed');
    assertEq(res.body.data.status, 'PENDING_APPROVAL');
    importId = res.body.data.id;
  });

  await test('import status retrievable by owner', async () => {
    const res = await apiRequest(ctx.server!.baseUrl, 'GET', `/api/v1/suppliers/imports/${importId}`, {
      token: ctx.proToken,
    });
    assertEq(res.status, 200);
    ok(['UPLOADED', 'PARSED', 'PENDING_APPROVAL'].includes(res.body.data.status));
  });

  await test('non-admin without SUPPLIER_IMPORT_APPROVE blocked → 403', async () => {
    const res = await apiRequest(ctx.server!.baseUrl, 'POST', `/api/v1/suppliers/imports/${importId}/approve`, {
      token: ctx.freeToken,
    });
    assertEq(res.status, 403);
  });

  await test('approval by admin works and does NOT mutate official catalog', async () => {
    const materialsRes = await apiRequest(ctx.server!.baseUrl, 'GET', '/api/v1/materials?trade=placo&limit=1');
    const matId = materialsRes.body.data[0]?.id;
    const priceBefore = await apiRequest(
      ctx.server!.baseUrl, 'GET',
      `/api/v1/prices?materialId=${matId}&source=OFFICIAL_DEFAULT`
    );
    const beforePrice = priceBefore.body.data[0]?.price;

    const approveRes = await apiRequest(ctx.server!.baseUrl, 'POST', `/api/v1/suppliers/imports/${importId}/approve`, {
      token: ctx.adminToken,
    });
    assertEq(approveRes.status, 200);

    const priceAfter = await apiRequest(
      ctx.server!.baseUrl, 'GET',
      `/api/v1/prices?materialId=${matId}&source=OFFICIAL_DEFAULT`
    );
    assertEq(priceAfter.body.data[0]?.price, beforePrice, 'official price must be UNCHANGED');
  });

  await test('upload rejects non-multipart/non-csv content type → 415', async () => {
    const res = await apiRequest(ctx.server!.baseUrl, 'POST', '/api/v1/suppliers/upload', {
      token: ctx.proToken,
      rawBody: 'not a csv file at all just text',
      contentType: 'application/octet-stream',
    });
    ok([400, 415].includes(res.status), `expected 400 or 415, got ${res.status}`);
  });
}
