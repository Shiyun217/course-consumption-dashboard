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
  assert.equal(JSON.stringify(result.data).includes('student_id'), false);

  const publicRead = await worker.fetch(new Request('https://worker.example/api/fixed-plan/latest'), env);
  assert.equal(publicRead.status, 200);
  assert.equal(publicRead.headers.get('Access-Control-Allow-Origin'), '*');
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
