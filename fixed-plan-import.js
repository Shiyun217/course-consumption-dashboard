(function () {
  'use strict';

  const STORAGE_KEY = 'fixed-plan-latest-upload-v2';
  const DB_NAME = 'fixed-plan-dashboard-files';
  const DB_STORE = 'exports';
  const EXPORT_KEY = 'latest-statistics';
  const TARGETS = { cc: 0.28, ss: 0.32, lp: 0.21 };
  const GROUPS = {
    cc: ['GZ-CC01小组', 'GZ-CC06小组', 'GZ-CC07小组', 'GZ-CC09小组', 'GZ-CC11小组', 'GZ-CC14小组'],
    ss: ['BJ-JWSS01小组', 'BJ-JWSS02小组', 'BJ-JWSS04小组', 'BJ-JWSS07小组', 'GZ-SS01小组', 'GZ-SS04小组'],
    lp: ['HK-GZLP01小组', 'HK-GZLP02小组'],
  };
  const FIXED_REQUIRED = ['student_id', 'bind_add_time', 'bind_operator_name', 'bind_operator_group_type', 'unbind_time'];
  const PAYMENT_REQUIRED = ['stdt_id', 'first_1v1_nml_pay_date', 'last_cc_group_name', 'last_ss_group_name', 'last_lp_group_name'];
  const SYNC_ENDPOINT = String(window.FIXED_PLAN_SYNC_CONFIG?.endpoint || '').replace(/\/$/, '');
  const state = { fixed: null, payment: null, busy: false, exportReady: false, exportName: '', priorData: window.FIXED_PLAN_LATEST_DATA || null };

  function restoreSavedDashboard() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.metrics) && Array.isArray(saved.groups)) {
        window.FIXED_PLAN_LATEST_DATA = saved;
        state.priorData = saved;
      }
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async function loadSharedDashboard() {
    if (!SYNC_ENDPOINT) return;
    try {
      const response = await fetch(SYNC_ENDPOINT, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (response.status === 404) return;
      if (!response.ok) throw new Error(`共享数据读取失败（${response.status}）`);
      const shared = await response.json();
      if (!shared || !Array.isArray(shared.metrics) || !Array.isArray(shared.groups)) throw new Error('共享数据格式不正确');
      window.FIXED_PLAN_LATEST_DATA = shared;
      state.priorData = shared;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shared));
      window.dispatchEvent(new CustomEvent('fixed-plan-data-updated', { detail: shared }));
    } catch (error) {
      console.warn('固定计划共享数据暂时不可用，已使用最近缓存。', error);
    }
  }

  async function publishSharedDashboard(payload, publishKey) {
    if (!SYNC_ENDPOINT) throw new Error('公共同步服务尚未配置。');
    const response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Fixed-Plan-Key': publishKey,
      },
      body: JSON.stringify(payload),
    });
    let result = null;
    try { result = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(result?.error || `公共看板发布失败（${response.status}）`);
    if (!result?.data) throw new Error('后台未返回已发布的数据。');
    return result.data;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getCachedExport() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, 'readonly');
      const request = transaction.objectStore(DB_STORE).get(EXPORT_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  }

  async function setCachedExport(value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put(value, EXPORT_KEY);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  const text = value => String(value == null ? '' : value).trim();
  const normalizeId = value => {
    if (value == null || value === '') return '';
    if (typeof value === 'number' && Number.isInteger(value)) return String(value);
    return text(value).replace(/\.0$/, '');
  };
  const dateOnly = value => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
    if (typeof value === 'number' && window.XLSX) {
      const parts = XLSX.SSF.parse_date_code(value);
      if (parts) return new Date(parts.y, parts.m - 1, parts.d, 12);
    }
    const match = text(value).replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return null;
    const result = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    return Number.isNaN(result.getTime()) ? null : result;
  };
  const monthKey = value => {
    const date = dateOnly(value);
    return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
  };
  const isoDate = value => {
    const date = dateOnly(value);
    return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
  };
  const priorMonth = key => {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const dateFromFileName = (fileName, year) => {
    const match = text(fileName).match(/_(\d{3,4})(?:_|\.|$)/);
    if (!match) return '';
    const code = match[1].padStart(4, '0');
    const month = Number(code.slice(0, 2));
    const day = Number(code.slice(2, 4));
    const candidate = new Date(year, month - 1, day, 12);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return '';
    return `${year}-${code.slice(0, 2)}-${code.slice(2, 4)}`;
  };
  const pct = value => `${(Number(value || 0) * 100).toFixed(2)}%`;
  const escapeHtml = value => text(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  function headerIndex(headers) {
    return Object.fromEntries(headers.map((value, index) => [text(value).replace(/^\uFEFF/, ''), index]));
  }

  async function parseFile(file, required) {
    if (!window.XLSX) throw new Error('Excel 解析组件未加载，请刷新页面后重试。');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false });
    if (!rows.length) throw new Error('工作簿第一个 sheet 没有数据。');
    const headers = rows[0].map(value => text(value).replace(/^\uFEFF/, ''));
    const index = headerIndex(headers);
    const missing = required.filter(name => index[name] == null);
    if (missing.length) throw new Error(`缺少字段：${missing.join('、')}`);
    return { file, headers, index, rows: rows.slice(1) };
  }

  function setFileStatus(kind, mode, message) {
    const target = document.querySelector(`[data-file-status="${kind}"]`);
    if (!target) return;
    target.className = `fp-upload-file-status ${mode || ''}`;
    target.textContent = message;
  }

  async function handleFile(kind, file) {
    const required = kind === 'fixed' ? FIXED_REQUIRED : PAYMENT_REQUIRED;
    if (!file) return;
    setFileStatus(kind, 'checking', '正在读取并校验字段...');
    updateRunButton();
    try {
      const parsed = await parseFile(file, required);
      state[kind] = parsed;
      setFileStatus(kind, 'valid', `校验通过 · ${parsed.rows.length.toLocaleString('zh-CN')} 条 · ${file.name}`);
    } catch (error) {
      state[kind] = null;
      setFileStatus(kind, 'invalid', error.message || '文件读取失败');
    }
    updateScopePreview();
    updateRunButton();
  }

  function latestPaymentMonth() {
    if (!state.payment) return '';
    const col = state.payment.index.first_1v1_nml_pay_date;
    let latest = '';
    for (const row of state.payment.rows) {
      const key = monthKey(row[col]);
      if (key > latest) latest = key;
    }
    return latest;
  }

  function updateScopePreview() {
    const scope = document.getElementById('fpUploadScope');
    if (!scope) return;
    const latest = latestPaymentMonth();
    scope.textContent = latest ? `${priorMonth(latest).slice(5)}月 + ${latest.slice(5)}月新生` : '等待付费明细校验';
  }

  function updateRunButton() {
    const button = document.getElementById('fpRunImport');
    const publishKey = text(document.getElementById('fpPublishKey')?.value);
    if (button) button.disabled = state.busy || !state.fixed || !state.payment || !publishKey || !SYNC_ENDPOINT;
  }

  function mostCommon(counter) {
    let selected = '';
    let max = -1;
    for (const [key, count] of counter) {
      if (count > max) { selected = key; max = count; }
    }
    return selected;
  }

  function analyzeFiles() {
    const fixed = state.fixed;
    const payment = state.payment;
    const latestMonth = latestPaymentMonth();
    if (!latestMonth) throw new Error('付费明细中未找到有效首单日期。');
    const scopeMonths = [priorMonth(latestMonth), latestMonth];
    const scope = new Set(scopeMonths);
    const fi = fixed.index;
    const pi = payment.index;
    const studentBindings = new Map();
    const activeFixedIds = new Set();
    let sourceAsOf = '';

    for (const row of fixed.rows) {
      const sid = normalizeId(row[fi.student_id]);
      if (!sid) continue;
      const bindDate = isoDate(row[fi.bind_add_time]);
      if (bindDate > sourceAsOf) sourceAsOf = bindDate;
      if (row[fi.unbind_time] == null || text(row[fi.unbind_time]) === '') activeFixedIds.add(sid);
      if (!studentBindings.has(sid)) studentBindings.set(sid, { cc: [], ss: [], lp: [] });
      const port = text(row[fi.bind_operator_group_type]).toLowerCase();
      const name = text(row[fi.bind_operator_name]);
      if (studentBindings.get(sid)[port] && name && !studentBindings.get(sid)[port].includes(name)) studentBindings.get(sid)[port].push(name);
    }
    sourceAsOf = dateFromFileName(fixed.file.name, Number(latestMonth.slice(0, 4))) || sourceAsOf;

    const payById = new Map();
    const studentGroupCounts = new Map();
    const newGroupIds = Object.fromEntries(Object.entries(GROUPS).map(([port, groups]) => [port, Object.fromEntries(groups.map(group => [group, new Set()]))]));
    const overallScopeIds = new Set();
    for (const sid of studentBindings.keys()) studentGroupCounts.set(sid, { cc: new Map(), ss: new Map(), lp: new Map() });

    for (const row of payment.rows) {
      const sid = normalizeId(row[pi.stdt_id]);
      if (!sid) continue;
      const payDate = dateOnly(row[pi.first_1v1_nml_pay_date]);
      if (!payById.has(sid)) payById.set(sid, payDate);
      const groups = {
        cc: text(row[pi.last_cc_group_name]),
        ss: text(row[pi.last_ss_group_name]),
        lp: text(row[pi.last_lp_group_name]),
      };
      if (studentGroupCounts.has(sid)) {
        for (const port of Object.keys(GROUPS)) {
          if (!groups[port]) continue;
          const counts = studentGroupCounts.get(sid)[port];
          counts.set(groups[port], (counts.get(groups[port]) || 0) + 1);
        }
      }
      if (scope.has(monthKey(payDate))) {
        if (GROUPS.lp.includes(groups.lp)) overallScopeIds.add(sid);
        for (const port of Object.keys(GROUPS)) {
          if (newGroupIds[port][groups[port]]) newGroupIds[port][groups[port]].add(sid);
        }
      }
    }

    const summaryRows = [];
    for (const [sid, names] of studentBindings) {
      if (!scope.has(monthKey(payById.get(sid)))) continue;
      const item = { student_id: sid };
      for (const port of Object.keys(GROUPS)) {
        item[`${port}_name`] = names[port].join('、');
        item[`${port}_group`] = names[port].length ? mostCommon(studentGroupCounts.get(sid)[port]) : '';
      }
      summaryRows.push(item);
    }

    const fixedGroupCounts = Object.fromEntries(Object.entries(GROUPS).map(([port, groups]) => [port, Object.fromEntries(groups.map(group => [group, 0]))]));
    for (const item of summaryRows) {
      for (const port of Object.keys(GROUPS)) {
        if (item[`${port}_name`] && fixedGroupCounts[port][item[`${port}_group`]] != null) fixedGroupCounts[port][item[`${port}_group`]] += 1;
      }
    }

    const newGroupCounts = Object.fromEntries(Object.entries(newGroupIds).map(([port, values]) => [port, Object.fromEntries(Object.entries(values).map(([group, ids]) => [group, ids.size]))]));
    const totals = {};
    for (const port of Object.keys(GROUPS)) {
      const newStudents = Object.values(newGroupCounts[port]).reduce((sum, value) => sum + value, 0);
      const fixedStudents = Object.values(fixedGroupCounts[port]).reduce((sum, value) => sum + value, 0);
      totals[port] = { newStudents, fixedStudents, rate: newStudents ? fixedStudents / newStudents : 0 };
    }
    const overallNewStudents = overallScopeIds.size;
    const overallFixedStudents = [...overallScopeIds].filter(sid => activeFixedIds.has(sid)).length;
    const calculatedOverallRate = overallNewStudents ? overallFixedStudents / overallNewStudents : 0;
    const overrideRaw = text(document.getElementById('fpOverallOverride')?.value);
    const override = overrideRaw === '' ? null : Number(overrideRaw) / 100;
    if (override != null && (!Number.isFinite(override) || override < 0 || override > 1)) throw new Error('整体固定率请输入 0 到 100 之间的数字。');
    const overallRate = override == null ? calculatedOverallRate : override;
    const prior = state.priorData || window.FIXED_PLAN_LATEST_DATA || null;
    const sameDate = prior && prior.source_as_of === sourceAsOf;
    const baselineFor = key => {
      const metric = prior?.metrics?.find(item => item.key === key);
      return sameDate ? metric?.yesterday_rate ?? null : metric?.rate ?? null;
    };
    const comparisonAsOf = sameDate ? prior?.comparison_as_of || null : prior?.source_as_of || null;
    const sourceCode = sourceAsOf ? `${sourceAsOf.slice(5, 7)}${sourceAsOf.slice(8, 10)}` : '上传';
    const metrics = [{
      key: 'overall', label: '整体固定计划绑定率', source: override == null ? `${sourceCode}明细有效绑定口径` : `${sourceCode}业务确认值`,
      rate: overallRate, target: 0.65, fixed_students: overallFixedStudents, new_students: overallNewStudents,
      yesterday_rate: baselineFor('overall'), last_month_same_period_rate: prior?.metrics?.find(item => item.key === 'overall')?.last_month_same_period_rate ?? null,
    }];
    for (const port of ['cc', 'ss', 'lp']) {
      const key = port.toUpperCase();
      metrics.push({
        key, label: `${key}固定计划绑定率`, source: `${sourceCode}明细口径`, rate: totals[port].rate, target: TARGETS[port],
        fixed_students: totals[port].fixedStudents, new_students: totals[port].newStudents,
        yesterday_rate: baselineFor(key), last_month_same_period_rate: prior?.metrics?.find(item => item.key === key)?.last_month_same_period_rate ?? null,
      });
    }
    const groups = [];
    const totalRows = [];
    for (const port of ['cc', 'ss', 'lp']) {
      for (const group of GROUPS[port]) {
        const newStudents = newGroupCounts[port][group] || 0;
        const fixedStudents = fixedGroupCounts[port][group] || 0;
        groups.push({ port: port.toUpperCase(), group, new_students: newStudents, fixed_students: fixedStudents, rate: newStudents ? fixedStudents / newStudents : 0, target: TARGETS[port], gap_students: Math.max(0, Math.round(newStudents * TARGETS[port]) - fixedStudents) });
      }
      totalRows.push({ port: port.toUpperCase(), group: `${port.toUpperCase()}总计`, new_students: totals[port].newStudents, fixed_students: totals[port].fixedStudents, rate: totals[port].rate, target: TARGETS[port], gap_students: Math.max(0, Math.round(totals[port].newStudents * TARGETS[port]) - totals[port].fixedStudents) });
    }
    const payload = {
      source_as_of: sourceAsOf || new Date().toISOString().slice(0, 10),
      comparison_as_of: comparisonAsOf,
      comparison_label: comparisonAsOf ? `较上次（${comparisonAsOf.slice(5)}）` : '较上次',
      period: `${Number(scopeMonths[0].slice(5))}月 + ${Number(scopeMonths[1].slice(5))}月新生`,
      scope_note: '端口及小组数据按滚动双月新生口径；同一学员在同一端口仅计1人。',
      metrics, groups, totals: totalRows,
    };
    return { payload, summaryRows, payById, fixedGroupCounts, newGroupCounts, calculatedOverallRate, scopeMonths };
  }

  function applySheetFormats(workbook, analysis) {
    const detail = workbook.Sheets['固定计划绑定人明细'];
    const people = workbook.Sheets['绑定人员汇总'];
    const summary = workbook.Sheets['汇总'];
    detail['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, ...Array(Math.max(0, state.fixed.headers.length - 3)).fill({ wch: 13 })];
    detail['!autofilter'] = { ref: detail['!ref'] };
    people['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 24 }];
    people['!autofilter'] = { ref: people['!ref'] };
    summary['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
    const detailRange = XLSX.utils.decode_range(detail['!ref']);
    for (let row = 1; row <= detailRange.e.r; row += 1) {
      const bindCell = detail[XLSX.utils.encode_cell({ r: row, c: 0 })];
      const payCell = detail[XLSX.utils.encode_cell({ r: row, c: 2 })];
      if (bindCell) bindCell.z = 'yyyy-mm-dd';
      if (payCell) payCell.z = 'yyyy-mm-dd';
    }
    for (let row = 1; row <= 17; row += 1) {
      const rate = summary[XLSX.utils.encode_cell({ r: row, c: 3 })];
      const target = summary[XLSX.utils.encode_cell({ r: row, c: 4 })];
      if (rate) rate.z = '0.00%';
      if (target) target.z = '0%';
    }
  }

  async function createExport(analysis) {
    const fixed = state.fixed;
    const fi = fixed.index;
    const headers = ['绑定时间', '学员ID', '首单时间', ...fixed.headers.slice(3)];
    const detailRows = [headers];
    for (const row of fixed.rows) {
      const sid = normalizeId(row[fi.student_id]);
      detailRows.push([dateOnly(row[fi.bind_add_time]), sid, analysis.payById.get(sid) || null, ...row.slice(3)]);
    }
    const peopleRows = [['学员ID', 'CC名字', 'CC组别', 'SS名字', 'SS组别', 'LP名字', 'LP组别']];
    for (const row of analysis.summaryRows) peopleRows.push([row.student_id, row.cc_name, row.cc_group, row.ss_name, row.ss_group, row.lp_name, row.lp_group]);
    const summaryRows = [['组别', '新生数', '固定绑定人数', '固定绑定率', '目标', '固定差额']];
    const rowMeta = [];
    let excelRow = 2;
    for (const port of ['cc', 'ss', 'lp']) {
      const startRow = excelRow;
      for (const group of GROUPS[port]) {
        const newStudents = analysis.newGroupCounts[port][group] || 0;
        const fixedStudents = analysis.fixedGroupCounts[port][group] || 0;
        summaryRows.push([group, newStudents, fixedStudents, newStudents ? fixedStudents / newStudents : 0, TARGETS[port], newStudents * TARGETS[port] - fixedStudents]);
        rowMeta.push({ row: excelRow, type: 'group' });
        excelRow += 1;
      }
      const endRow = excelRow - 1;
      const newTotal = GROUPS[port].reduce((sum, group) => sum + (analysis.newGroupCounts[port][group] || 0), 0);
      const fixedTotal = GROUPS[port].reduce((sum, group) => sum + (analysis.fixedGroupCounts[port][group] || 0), 0);
      summaryRows.push([`${port.toUpperCase()}总计`, newTotal, fixedTotal, newTotal ? fixedTotal / newTotal : 0, TARGETS[port], newTotal * TARGETS[port] - fixedTotal]);
      rowMeta.push({ row: excelRow, type: 'total', startRow, endRow });
      excelRow += 1;
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(detailRows, { cellDates: true }), '固定计划绑定人明细');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(peopleRows), '绑定人员汇总');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), '汇总');
    const summary = workbook.Sheets['汇总'];
    for (const meta of rowMeta) {
      const row = meta.row;
      if (meta.type === 'group') {
        summary[`D${row}`] = { t: 'n', v: summaryRows[row - 1][3], f: `IFERROR(C${row}/B${row},0)`, z: '0.00%' };
        summary[`F${row}`] = { t: 'n', v: summaryRows[row - 1][5], f: `B${row}*E${row}-C${row}` };
      } else {
        summary[`B${row}`] = { t: 'n', v: summaryRows[row - 1][1], f: `SUM(B${meta.startRow}:B${meta.endRow})` };
        summary[`C${row}`] = { t: 'n', v: summaryRows[row - 1][2], f: `SUM(C${meta.startRow}:C${meta.endRow})` };
        summary[`D${row}`] = { t: 'n', v: summaryRows[row - 1][3], f: `IFERROR(C${row}/B${row},0)`, z: '0.00%' };
        summary[`F${row}`] = { t: 'n', v: summaryRows[row - 1][5], f: `B${row}*E${row}-C${row}` };
      }
    }
    applySheetFormats(workbook, analysis);
    const array = XLSX.write(workbook, { type: 'array', bookType: 'xlsx', compression: true, cellStyles: true });
    const base = fixed.file.name.replace(/\.xlsx?$/i, '');
    return { blob: new Blob([array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name: `${base}_统计结果.xlsx` };
  }

  function setProgress(mode, title, detail) {
    const box = document.getElementById('fpImportProgress');
    if (!box) return;
    box.className = `fp-import-progress ${mode || ''}`;
    box.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(detail)}</span>`;
  }

  async function runImport() {
    if (state.busy || !state.fixed || !state.payment) return;
    const publishKey = text(document.getElementById('fpPublishKey')?.value);
    if (!publishKey) {
      setProgress('error', '请输入发布口令', '口令只用于本次发布，不会保存在浏览器中。');
      return;
    }
    state.busy = true;
    updateRunButton();
    setProgress('working', '正在计算数据', '正在按双月新生口径计算 14 个组，请稍候...');
    try {
      await new Promise(resolve => setTimeout(resolve, 40));
      const analysis = analyzeFiles();
      setProgress('working', '正在生成统计结果', '源表仍保留在本机，正在生成三个 sheet 的统计结果文件...');
      await new Promise(resolve => setTimeout(resolve, 40));
      const exported = await createExport(analysis);
      await setCachedExport({ blob: exported.blob, name: exported.name, sourceAsOf: analysis.payload.source_as_of, savedAt: Date.now() });
      state.exportReady = true;
      state.exportName = exported.name;
      bindPageActions();
      setProgress('working', '正在发布公共看板', '仅发送不含姓名和学员ID的汇总指标，请稍候...');
      const published = await publishSharedDashboard(analysis.payload, publishKey);
      window.FIXED_PLAN_LATEST_DATA = published;
      state.priorData = published;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(published));
      window.dispatchEvent(new CustomEvent('fixed-plan-data-updated', { detail: published }));
      setProgress('success', '公共看板已更新', `${published.period} · 整体明细计算 ${pct(analysis.calculatedOverallRate)} · 已生成 ${exported.name}`);
    } catch (error) {
      console.error(error);
      setProgress('error', '处理失败', error.message || '请检查文件后重试。');
    } finally {
      state.busy = false;
      updateRunButton();
    }
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function downloadExport() {
    try {
      const cached = await getCachedExport();
      if (!cached?.blob) {
        openModal();
        setProgress('error', '暂无可下载文件', '请先选择当天两份源表并完成更新。');
        return;
      }
      triggerDownload(cached.blob, cached.name || '固定计划绑定人明细_统计结果.xlsx');
    } catch (error) {
      openModal();
      setProgress('error', '下载失败', error.message || '请重新上传并生成统计结果。');
    }
  }

  function modalMarkup() {
    return `<div class="fp-import-modal" id="fpImportModal" hidden>
      <div class="fp-import-backdrop" data-close-fixed-import></div>
      <section class="fp-import-dialog" role="dialog" aria-modal="true" aria-labelledby="fpImportTitle">
        <header class="fp-import-head"><div><span>每日数据更新</span><h2 id="fpImportTitle">更新固定计划看板</h2><p>源表只在当前浏览器中处理；后台仅接收不含姓名和学员ID的汇总指标。</p></div><button class="fp-import-close" type="button" data-close-fixed-import aria-label="关闭">×</button></header>
        <div class="fp-import-body">
          <div class="fp-upload-grid">
            <label class="fp-upload-file"><input id="fpFixedFile" type="file" accept=".xlsx,.xls"><span class="fp-upload-file-icon">01</span><b>固定计划绑定人明细</b><small>选择当天原始固定明细</small><em data-file-status="fixed">未选择文件</em></label>
            <label class="fp-upload-file"><input id="fpPaymentFile" type="file" accept=".xlsx,.xls"><span class="fp-upload-file-icon">02</span><b>学员付费明细</b><small>用于匹配首单时间和端口组别</small><em data-file-status="payment">未选择文件</em></label>
          </div>
          <div class="fp-import-settings">
            <div><label>自动统计范围</label><b id="fpUploadScope">等待付费明细校验</b><small>以付费表中最新首单月份为本月，并自动纳入上月。</small></div>
            <div><label for="fpOverallOverride">整体固定率（可选）</label><div class="fp-percent-input"><input id="fpOverallOverride" type="number" min="0" max="100" step="0.01" placeholder="按明细自动计算"><span>%</span></div><small>若业务平台有最终确认值可填写；留空则使用明细计算值。</small></div>
          </div>
          <div class="fp-publish-setting"><div><label for="fpPublishKey">公共看板发布口令</label><input id="fpPublishKey" type="password" autocomplete="off" placeholder="输入实习生更新口令"><small>口令仅在点击发布时发送，不写入网页、不保存在浏览器中。</small></div><span class="fp-sync-badge ${SYNC_ENDPOINT ? 'ready' : 'offline'}">${SYNC_ENDPOINT ? '公共同步已连接' : '公共同步待配置'}</span></div>
          <div class="fp-import-progress" id="fpImportProgress"><b>等待上传</b><span>两份文件校验通过后即可更新看板。</span></div>
        </div>
        <footer class="fp-import-footer"><button class="fp-import-secondary" type="button" id="fpModalDownload">下载已有统计结果</button><button class="fp-import-primary" type="button" id="fpRunImport" disabled>发布并更新公共看板</button></footer>
      </section>
    </div>`;
  }

  function ensureModal() {
    if (document.getElementById('fpImportModal')) return;
    document.body.insertAdjacentHTML('beforeend', modalMarkup());
    document.getElementById('fpFixedFile').addEventListener('change', event => handleFile('fixed', event.target.files[0]));
    document.getElementById('fpPaymentFile').addEventListener('change', event => handleFile('payment', event.target.files[0]));
    document.getElementById('fpPublishKey').addEventListener('input', updateRunButton);
    document.getElementById('fpRunImport').addEventListener('click', runImport);
    document.getElementById('fpModalDownload').addEventListener('click', downloadExport);
    document.querySelectorAll('[data-close-fixed-import]').forEach(element => element.addEventListener('click', closeModal));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
  }

  function openModal() {
    ensureModal();
    const modal = document.getElementById('fpImportModal');
    modal.hidden = false;
    document.body.classList.add('fp-import-open');
    setTimeout(() => document.getElementById('fpFixedFile')?.focus(), 0);
  }

  function closeModal() {
    const modal = document.getElementById('fpImportModal');
    if (!modal || state.busy) return;
    modal.hidden = true;
    document.body.classList.remove('fp-import-open');
  }

  function bindPageActions() {
    const openButton = document.getElementById('openFixedImport');
    const downloadButton = document.getElementById('downloadFixedResult');
    if (openButton) openButton.onclick = openModal;
    if (downloadButton) {
      downloadButton.onclick = downloadExport;
      downloadButton.disabled = !state.exportReady;
      downloadButton.title = state.exportReady ? `下载 ${state.exportName}` : '首次使用请先上传两份源表';
    }
    const modalDownload = document.getElementById('fpModalDownload');
    if (modalDownload) modalDownload.disabled = !state.exportReady;
  }

  restoreSavedDashboard();
  ensureModal();
  loadSharedDashboard();
  getCachedExport().then(cached => {
    state.exportReady = Boolean(cached?.blob);
    state.exportName = cached?.name || '';
    bindPageActions();
  }).catch(() => {});

  window.FixedPlanImporter = { open: openModal, download: downloadExport, bindPageActions };
})();
