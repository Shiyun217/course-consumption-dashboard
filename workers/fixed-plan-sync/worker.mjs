const DATA_KEY = 'latest';
const FAVORITES_DATA_KEY = 'favorites-latest';
const MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_ORIGINS = new Set([
  'https://shiyun217.github.io',
  'http://127.0.0.1:8000',
  'http://localhost:8000',
]);
const TARGETS = { overall: 0.65, CC: 0.28, SS: 0.32, LP: 0.21 };
const GROUPS = {
  CC: ['GZ-CC01小组', 'GZ-CC06小组', 'GZ-CC07小组', 'GZ-CC09小组', 'GZ-CC11小组', 'GZ-CC14小组'],
  SS: ['BJ-JWSS01小组', 'BJ-JWSS02小组', 'BJ-JWSS04小组', 'BJ-JWSS07小组', 'GZ-SS01小组', 'GZ-SS04小组'],
  LP: ['HK-GZLP01小组', 'HK-GZLP02小组'],
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function corsOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function corsHeaders(request, publicRead = false) {
  const origin = corsOrigin(request);
  if (publicRead) return { 'Access-Control-Allow-Origin': '*' };
  return origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function secretsMatch(provided, expected) {
  if (!provided || !expected) return false;
  const [left, right] = await Promise.all([digest(provided), digest(expected)]);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

function safeString(value, label, maxLength = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw new Error(`${label}格式不正确`);
  return value.trim();
}

function safeRate(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label}必须在0到1之间`);
  return value;
}

function optionalRate(value, label) {
  return value == null ? null : safeRate(value, label);
}

function safeCount(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 5_000_000) throw new Error(`${label}必须是有效人数`);
  return value;
}

function favoriteTarget(role, baseline) {
  return role === 'LP' ? 250 : baseline < 150 ? 150 : 250;
}

function optionalCount(value, label) {
  return value == null ? null : safeCount(value, label);
}

function sanitizeFavoritesPayload(input, previous) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('收藏汇总格式不正确');
  const dataDate = safeString(input.dataDate, '数据日期', 10);
  if (!/^20\d{2}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(dataDate)) throw new Error('数据日期格式应为YYYY-MM-DD');
  if (previous?.dataDate && dataDate < previous.dataDate) throw new Error(`数据日期早于当前公共版本（${previous.dataDate}）`);
  if (!Array.isArray(input.employees) || input.employees.length < 1 || input.employees.length > 1000) throw new Error('员工汇总数量不正确');
  const sameDate = previous?.dataDate === dataDate;
  const previousEmployees = new Map((previous?.employees || []).map(row => [String(row.id), row]));
  const ids = new Set();
  const employees = input.employees.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`第${index + 1}名员工格式不正确`);
    const id = safeString(String(row.id || ''), `第${index + 1}名员工ID`, 40);
    if (ids.has(id)) throw new Error(`员工ID重复：${id}`);
    ids.add(id);
    const role = safeString(row.role, `${id}端口`, 2).toUpperCase();
    if (!['CC', 'SS', 'LP'].includes(role)) throw new Error(`${id}端口不正确`);
    const account = safeString(row.account, `${id}员工账号`, 100);
    const group = safeString(row.group, `${id}当前小组`, 100);
    const favorites = safeCount(row.favorites, `${id}当前收藏数量`);
    const prior = previousEmployees.get(id);
    if (prior && prior.role !== role) throw new Error(`${id}端口不能从${prior.role}变更为${role}`);
    const target = prior ? safeCount(prior.target, `${id}固定目标`) : favoriteTarget(role, favorites);
    const previousFavorites = sameDate ? optionalCount(prior?.previousFavorites, `${id}昨日收藏数量`) : prior ? safeCount(prior.favorites, `${id}上次收藏数量`) : null;
    return { role, id, account, group, name: null, target, favorites, previousFavorites };
  });
  for (const role of ['CC', 'SS', 'LP']) if (!employees.some(row => row.role === role)) throw new Error(`员工汇总缺少${role}端口`);
  return {
    schemaVersion: 1,
    dataDate,
    comparisonDate: sameDate ? previous?.comparisonDate || null : previous?.dataDate || null,
    sourceName: safeString(input.sourceName || '原始CSV', '文件名', 180),
    sourceRows: safeCount(input.sourceRows, '源文件行数'),
    uniquePairCount: safeCount(input.uniquePairCount, '去重收藏关系数'),
    duplicatePairCount: safeCount(input.duplicatePairCount || 0, '重复收藏关系数'),
    employees,
    publishedAt: new Date().toISOString(),
  };
}

async function handleFavoritesRequest(request, env) {
  if (request.method === 'OPTIONS') {
    const origin = corsOrigin(request);
    if (!origin) return json({ error: 'Origin not allowed' }, 403);
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Favorites-Key', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } });
  }
  if (request.method === 'GET') {
    const data = await env.FIXED_PLAN_DATA.get(FAVORITES_DATA_KEY, 'json');
    return data ? json(data, 200, corsHeaders(request, true)) : json({ error: 'No shared data yet' }, 404, corsHeaders(request, true));
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, OPTIONS' });
  const origin = corsOrigin(request);
  if (!origin) return json({ error: 'Origin not allowed' }, 403);
  if (!(await secretsMatch(request.headers.get('X-Favorites-Key') || '', env.PUBLISH_SECRET || ''))) return json({ error: '发布口令不正确' }, 401, corsHeaders(request));
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_BODY_BYTES * 2) return json({ error: '员工汇总超过大小限制' }, 413, corsHeaders(request));
  try {
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).length > MAX_BODY_BYTES * 2) throw new Error('员工汇总超过大小限制');
    const input = JSON.parse(bodyText);
    const previous = await env.FIXED_PLAN_DATA.get(FAVORITES_DATA_KEY, 'json');
    const data = sanitizeFavoritesPayload(input, previous);
    await env.FIXED_PLAN_DATA.put(FAVORITES_DATA_KEY, JSON.stringify(data));
    return json({ ok: true, data }, 200, corsHeaders(request));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '员工汇总校验失败' }, 400, corsHeaders(request));
  }
}

function priorMetric(previous, key) {
  return previous?.metrics?.find(metric => metric.key === key) || null;
}

function sanitizePayload(input, previous) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('汇总数据格式不正确');
  const sourceAsOf = safeString(input.source_as_of, '数据日期', 10);
  if (!/^20\d{2}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(sourceAsOf)) throw new Error('数据日期格式应为YYYY-MM-DD');
  if (previous?.source_as_of && sourceAsOf < previous.source_as_of) throw new Error(`数据日期早于当前公共版本（${previous.source_as_of}）`);
  if (!Array.isArray(input.metrics) || !Array.isArray(input.groups)) throw new Error('缺少指标或小组汇总');

  const sameDate = previous?.source_as_of === sourceAsOf;
  const inputComparison = typeof input.comparison_as_of === 'string' && /^20\d{2}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(input.comparison_as_of) ? input.comparison_as_of : null;
  const comparisonAsOf = sameDate ? previous?.comparison_as_of || inputComparison : previous?.source_as_of || inputComparison;
  const groupMap = new Map(input.groups.map(row => [`${row?.port}|${row?.group}`, row]));
  const groups = [];
  const totals = [];

  for (const port of ['CC', 'SS', 'LP']) {
    let newTotal = 0;
    let fixedTotal = 0;
    for (const group of GROUPS[port]) {
      const row = groupMap.get(`${port}|${group}`);
      if (!row) throw new Error(`缺少${group}汇总`);
      const newStudents = safeCount(row.new_students, `${group}新生数`);
      const fixedStudents = safeCount(row.fixed_students, `${group}固定人数`);
      if (fixedStudents > newStudents) throw new Error(`${group}固定人数不能大于新生数`);
      const rate = newStudents ? fixedStudents / newStudents : 0;
      groups.push({
        port,
        group,
        new_students: newStudents,
        fixed_students: fixedStudents,
        rate,
        target: TARGETS[port],
        gap_students: Math.max(0, Math.round(newStudents * TARGETS[port]) - fixedStudents),
      });
      newTotal += newStudents;
      fixedTotal += fixedStudents;
    }
    totals.push({
      port,
      group: `${port}总计`,
      new_students: newTotal,
      fixed_students: fixedTotal,
      rate: newTotal ? fixedTotal / newTotal : 0,
      target: TARGETS[port],
      gap_students: Math.max(0, Math.round(newTotal * TARGETS[port]) - fixedTotal),
    });
  }

  const metricMap = new Map(input.metrics.map(metric => [metric?.key, metric]));
  const overallInput = metricMap.get('overall');
  if (!overallInput) throw new Error('缺少整体固定计划绑定率');
  const overallNew = safeCount(overallInput.new_students, '整体新生数');
  const overallFixed = safeCount(overallInput.fixed_students, '整体固定人数');
  if (overallFixed > overallNew) throw new Error('整体固定人数不能大于新生数');
  const metrics = [];
  for (const key of ['overall', 'CC', 'SS', 'LP']) {
    const previousMetric = priorMetric(previous, key);
    const incomingMetric = metricMap.get(key);
    const incomingYesterday = optionalRate(incomingMetric?.yesterday_rate, `${key}上次固定率`);
    const incomingLastMonth = optionalRate(incomingMetric?.last_month_same_period_rate, `${key}上月同期固定率`);
    const yesterdayRate = sameDate ? previousMetric?.yesterday_rate ?? incomingYesterday : previousMetric?.rate ?? incomingYesterday;
    const lastMonthRate = previousMetric?.last_month_same_period_rate ?? incomingLastMonth;
    if (key === 'overall') {
      metrics.push({
        key,
        label: '整体固定计划绑定率',
        source: safeString(overallInput.source || `${sourceAsOf.slice(5).replace('-', '')}明细口径`, '整体指标来源', 80),
        rate: safeRate(overallInput.rate, '整体固定率'),
        target: TARGETS.overall,
        fixed_students: overallFixed,
        new_students: overallNew,
        yesterday_rate: yesterdayRate,
        last_month_same_period_rate: lastMonthRate,
      });
      continue;
    }
    const total = totals.find(row => row.port === key);
    metrics.push({
      key,
      label: `${key}固定计划绑定率`,
      source: `${sourceAsOf.slice(5).replace('-', '')}明细口径`,
      rate: total.rate,
      target: TARGETS[key],
      fixed_students: total.fixed_students,
      new_students: total.new_students,
      yesterday_rate: yesterdayRate,
      last_month_same_period_rate: lastMonthRate,
    });
  }

  return {
    source_as_of: sourceAsOf,
    comparison_as_of: comparisonAsOf,
    comparison_label: comparisonAsOf ? `较上次（${comparisonAsOf.slice(5)}）` : '较上次',
    period: safeString(input.period, '统计周期', 60),
    scope_note: '端口及小组数据按滚动双月新生口径；同一学员在同一端口仅计1人。',
    metrics,
    groups,
    totals,
    published_at: new Date().toISOString(),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/favorites/latest') return handleFavoritesRequest(request, env);
    if (url.pathname !== '/api/fixed-plan/latest') return json({ error: 'Not found' }, 404);

    if (request.method === 'OPTIONS') {
      const origin = corsOrigin(request);
      if (!origin) return json({ error: 'Origin not allowed' }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Fixed-Plan-Key',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }

    if (request.method === 'GET') {
      const data = await env.FIXED_PLAN_DATA.get(DATA_KEY, 'json');
      return data ? json(data, 200, corsHeaders(request, true)) : json({ error: 'No shared data yet' }, 404, corsHeaders(request, true));
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, OPTIONS' });
    const origin = corsOrigin(request);
    if (!origin) return json({ error: 'Origin not allowed' }, 403);
    if (!(await secretsMatch(request.headers.get('X-Fixed-Plan-Key') || '', env.PUBLISH_SECRET || ''))) {
      return json({ error: '发布口令不正确' }, 401, corsHeaders(request));
    }
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > MAX_BODY_BYTES) return json({ error: '汇总数据超过大小限制' }, 413, corsHeaders(request));

    try {
      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).length > MAX_BODY_BYTES) throw new Error('汇总数据超过大小限制');
      const input = JSON.parse(bodyText);
      const previous = await env.FIXED_PLAN_DATA.get(DATA_KEY, 'json');
      const data = sanitizePayload(input, previous);
      await env.FIXED_PLAN_DATA.put(DATA_KEY, JSON.stringify(data));
      return json({ ok: true, data }, 200, corsHeaders(request));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : '汇总数据校验失败' }, 400, corsHeaders(request));
    }
  },
};
