import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker from './worker.mjs';

class MemoryKv {
  constructor() { this.values = new Map(); }
  async get(key, type) {
    const value = this.values.get(key);
    if (value == null) return null;
    return type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.values.set(key, value); }
}

async function fixture() {
  const source = await readFile(new URL('../../fixed-plan-latest-data.js', import.meta.url), 'utf8');
  return JSON.parse(source.match(/=\s*([\s\S]*);\s*$/)[1]);
}

function request(method, body, key = 'correct-key', origin = 'https://shiyun217.github.io') {
  return new Request('https://worker.example/api/fixed-plan/latest', {
    method,
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'X-Fixed-Plan-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function exportRequest(method, body, options = {}) {
  const {
    key = 'correct-key',
    origin = 'https://shiyun217.github.io',
    filename = '固定计划统计结果.xlsx',
    sourceAsOf = '2026-09-04',
  } = options;
  return new Request('https://worker.example/api/fixed-plan/export', {
    method,
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } : {}),
      ...(key ? { 'X-Fixed-Plan-Key': key } : {}),
      ...(body ? { 'X-Fixed-Plan-Filename': encodeURIComponent(filename), 'X-Fixed-Plan-Source-As-Of': sourceAsOf } : {}),
    },
    body,
  });
}

function favoritesRequest(method, body, key = 'correct-key', origin = 'https://shiyun217.github.io') {
  return new Request('https://worker.example/api/favorites/latest', {
    method,
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'X-Favorites-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function favoritesFixture(date, counts) {
  return {
    schemaVersion: 1,
    dataDate: date,
    sourceName: `favorites_${date.replaceAll('-', '')}.csv`,
    sourceRows: Object.values(counts).reduce((sum, value) => sum + value, 0),
    uniquePairCount: Object.values(counts).reduce((sum, value) => sum + value, 0),
    duplicatePairCount: 0,
    employees: [
      { id: '1', account: 'cc-low', role: 'CC', group: 'CC组', favorites: counts.ccLow, target: 999 },
      { id: '2', account: 'ss-edge', role: 'SS', group: 'SS组', favorites: counts.ssEdge, target: 999 },
      { id: '3', account: 'lp-user', role: 'LP', group: 'LP组', favorites: counts.lp, target: 999 },
    ],
  };
}

test('publishes sanitized aggregates and exposes them publicly', async () => {
  const env = { FIXED_PLAN_DATA: new MemoryKv(), PUBLISH_SECRET: 'correct-key' };
  const empty = await worker.fetch(request('GET'), env);
  assert.equal(empty.status, 404);

  const denied = await worker.fetch(request('POST', await fixture(), 'wrong-key'), env);
  assert.equal(denied.status, 401);

  const published = await worker.fetch(request('POST', await fixture()), env);
  assert.equal(published.status, 200);
  const result = await published.json();
  assert.equal(result.data.groups.length, 14);
  assert.equal(result.data.metrics.length, 4);
  assert.equal(result.data.metrics.find(item => item.key === 'overall').rate, 0.451);
  assert.deepEqual(result.data.metrics.map(item => item.target), [0.60, 0.29, 0.31, 0.16]);
  assert.deepEqual(result.data.totals.map(item => item.gap_students), [62, 61, 27]);
  assert.equal(result.data.metrics.find(item => item.key === 'overall').yesterday_rate, 0.41702127659574467);
  assert.equal(result.data.comparison_as_of, '2026-09-01');
  assert.equal(JSON.stringify(result.data).includes('student_id'), false);

  const publicRead = await worker.fetch(new Request('https://worker.example/api/fixed-plan/latest'), env);
  assert.equal(publicRead.status, 200);
  assert.equal(publicRead.headers.get('Access-Control-Allow-Origin'), '*');
});

test('applies current targets when reading a legacy stored snapshot', async () => {
  const env = { FIXED_PLAN_DATA: new MemoryKv(), PUBLISH_SECRET: 'correct-key' };
  const legacy = await fixture();
  await env.FIXED_PLAN_DATA.put('latest', JSON.stringify(legacy));

  const response = await worker.fetch(request('GET'), env);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.metrics.map(item => item.target), [0.60, 0.29, 0.31, 0.16]);
  assert.deepEqual(data.groups.filter(item => item.port === 'LP').map(item => item.gap_students), [19, 8]);
  assert.deepEqual(data.totals.map(item => item.gap_students), [62, 61, 27]);
});

test('rejects unknown origins and older snapshots', async () => {
  const env = { FIXED_PLAN_DATA: new MemoryKv(), PUBLISH_SECRET: 'correct-key' };
  const data = await fixture();
  const unknownOrigin = await worker.fetch(request('POST', data, 'correct-key', 'https://example.com'), env);
  assert.equal(unknownOrigin.status, 403);

  assert.equal((await worker.fetch(request('POST', data), env)).status, 200);
  data.source_as_of = '2026-09-03';
  const rollback = await worker.fetch(request('POST', data), env);
  assert.equal(rollback.status, 400);
  assert.match((await rollback.json()).error, /早于当前公共版本/);
});

test('stores and downloads a password-protected Excel export', async () => {
  const env = { FIXED_PLAN_DATA: new MemoryKv(), PUBLISH_SECRET: 'correct-key' };
  assert.equal((await worker.fetch(request('POST', await fixture()), env)).status, 200);
  const file = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

  const deniedUpload = await worker.fetch(exportRequest('POST', file, { key: 'wrong-key' }), env);
  assert.equal(deniedUpload.status, 401);

  const mismatch = await worker.fetch(exportRequest('POST', file, { sourceAsOf: '2026-09-03' }), env);
  assert.equal(mismatch.status, 400);
  assert.match((await mismatch.json()).error, /日期与最新公共看板不一致/);

  const uploaded = await worker.fetch(exportRequest('POST', file), env);
  assert.equal(uploaded.status, 200);
  assert.equal((await uploaded.json()).data.size, file.byteLength);

  const deniedDownload = await worker.fetch(exportRequest('GET', null, { key: 'wrong-key' }), env);
  assert.equal(deniedDownload.status, 401);

  const downloaded = await worker.fetch(exportRequest('GET'), env);
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get('X-Fixed-Plan-Filename'), encodeURIComponent('固定计划统计结果.xlsx'));
  assert.equal(downloaded.headers.get('X-Fixed-Plan-Source-As-Of'), '2026-09-04');
  assert.match(downloaded.headers.get('Content-Disposition'), /attachment/);
  assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), file);
});

test('locks favorites targets and carries the prior day forward', async () => {
  const env = { FIXED_PLAN_DATA: new MemoryKv(), PUBLISH_SECRET: 'correct-key' };
  const baseline = favoritesFixture('2026-09-07', { ccLow: 130, ssEdge: 150, lp: 320 });
  const first = await worker.fetch(favoritesRequest('POST', baseline), env);
  assert.equal(first.status, 200);
  const firstData = (await first.json()).data;
  assert.deepEqual(firstData.employees.map(row => row.target), [150, 250, 250]);
  assert.deepEqual(firstData.employees.map(row => row.previousFavorites), [null, null, null]);

  const next = favoritesFixture('2026-09-08', { ccLow: 160, ssEdge: 170, lp: 330 });
  const second = await worker.fetch(favoritesRequest('POST', next), env);
  assert.equal(second.status, 200);
  const secondData = (await second.json()).data;
  assert.deepEqual(secondData.employees.map(row => row.target), [150, 250, 250]);
  assert.deepEqual(secondData.employees.map(row => row.previousFavorites), [130, 150, 320]);
  assert.equal(secondData.comparisonDate, '2026-09-07');

  next.employees[0].favorites = 165;
  const sameDay = await worker.fetch(favoritesRequest('POST', next), env);
  const sameDayData = (await sameDay.json()).data;
  assert.equal(sameDayData.employees[0].target, 150);
  assert.equal(sameDayData.employees[0].previousFavorites, 130);
});
