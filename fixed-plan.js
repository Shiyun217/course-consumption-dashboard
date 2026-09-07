(function () {
  const fp = window.FIXED_PLAN_DATA;
  if (!fp) return;

  const overall = fp.overall_binding_rates || [];
  const operatorRows = fp.operator_monthly || [];
  const operators = fp.operators || [];
  const userData = window.FIXED_PLAN_USER_DATA;
  const ticketData = window.FIXED_PLAN_TICKET_DATA;
  const m01AllData = window.FIXED_PLAN_M01_ALL_DATA;
  let latestData = window.FIXED_PLAN_LATEST_DATA;
  const colors = { CC: '#2f7f75', SS: '#4169a1', LP: '#d38b2c', student: '#a05a80', other: '#7d8796' };
  const lifecycleColors = { M0: '#2f7f75', M1: '#4169a1', M2plus: '#d38b2c', total: '#17365d' };
  let fixedTab = 'latest';

  const pct = (value, digits = 1) => `${(Number(value || 0) * 100).toFixed(digits)}%`;
  const num = value => Number(value || 0).toLocaleString('zh-CN');
  const pp = (value, digits = 1) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(digits)}pp`;
  const monthLabel = value => value.replace('-', '.').slice(2);
  const mean = values => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

  function navMarkup() {
    return `<div class="fp-subnav" role="tablist" aria-label="固定计划分析维度">
      <button class="fp-tab ${fixedTab === 'latest' ? 'active' : ''}" data-fp-tab="latest">M0-1固定计划绑定-最新</button>
      <button class="fp-tab ${fixedTab === 'm01' ? 'active' : ''}" data-fp-tab="m01">M0-1固定计划绑定（历史）</button>
      <button class="fp-tab ${fixedTab === 'm01all' ? 'active' : ''}" data-fp-tab="m01all">M0-1固定计划绑定（不去重）</button>
      <button class="fp-tab ${fixedTab === 'user' ? 'active' : ''}" data-fp-tab="user">历史固定计划绑定（用户维度）</button>
      <button class="fp-tab ${fixedTab === 'ticket' ? 'active' : ''}" data-fp-tab="ticket">历史固定计划绑定（工单维度）</button>
    </div>`;
  }

  function latestComparison(value, baseline, emptyLabel) {
    if (baseline == null) return `<span class="fp-latest-na"><b>--</b><small>${emptyLabel}</small></span>`;
    const delta = value - baseline;
    return `<span class="${delta >= 0 ? 'is-positive' : 'is-negative'}"><b>${pp(delta, 2)}</b><small>基准 ${pct(baseline, 2)}</small></span>`;
  }

  function latestKpiCard(metric) {
    const gap = metric.rate - metric.target;
    const progress = Math.min(metric.rate / metric.target, 1) * 100;
    const color = metric.key === 'overall' ? '#2463a8' : colors[metric.key];
    return `<article class="fp-latest-kpi" style="--metric-color:${color}">
      <div class="fp-latest-kpi-head"><div><span>${metric.label}</span><small>${metric.source}</small></div><i aria-hidden="true"></i></div>
      <div class="fp-latest-value">${pct(metric.rate, 2)}</div>
      <div class="fp-latest-progress" aria-label="目标达成进度"><span style="width:${progress}%"></span><i style="left:${Math.min(progress, 98)}%"></i></div>
      <div class="fp-latest-target"><span>目标 ${pct(metric.target, 0)}</span><b class="${gap >= 0 ? 'is-positive' : 'is-negative'}">差 ${pp(gap, 2)}</b></div>
      <div class="fp-latest-compare"><div><label>${latestData.comparison_label || '较昨日'}</label>${latestComparison(metric.rate, metric.yesterday_rate, '暂无对比快照')}</div><div><label>较上月同期</label>${latestComparison(metric.rate, metric.last_month_same_period_rate, '暂无同日快照')}</div></div>
      <div class="fp-latest-count">已固定 <b>${num(metric.fixed_students)}</b> / 新生 <b>${num(metric.new_students)}</b></div>
    </article>`;
  }

  function latestStatus(row) {
    const gap = row.target - row.rate;
    if (gap <= .02) return ['接近目标', 'near'];
    if (gap <= .06) return ['重点跟进', 'watch'];
    return ['优先补齐', 'risk'];
  }

  function latestGroupRows(port) {
    const rows = latestData.groups.filter(row => row.port === port);
    const total = latestData.totals.find(row => row.port === port);
    return `${rows.map(row => {
      const status = latestStatus(row);
      return `<tr><td><b>${row.group}</b></td><td>${num(row.new_students)}</td><td>${num(row.fixed_students)}</td><td><div class="fp-rate-cell"><b>${pct(row.rate, 2)}</b><span><i style="width:${Math.min(row.rate / row.target, 1) * 100}%"></i></span></div></td><td>${pct(row.target, 0)}</td><td><strong>${num(row.gap_students)}</strong></td><td><span class="fp-status ${status[1]}">${status[0]}</span></td></tr>`;
    }).join('')}<tr class="fp-latest-total"><td><b>${total.group}</b></td><td>${num(total.new_students)}</td><td>${num(total.fixed_students)}</td><td><b>${pct(total.rate, 2)}</b></td><td><b>${pct(total.target, 0)}</b></td><td><strong>${num(total.gap_students)}</strong></td><td><span class="fp-status ${latestStatus(total)[1]}">${latestStatus(total)[0]}</span></td></tr>`;
  }

  function renderLatest() {
    if (!latestData) return renderEmpty('M0-1固定计划绑定-最新');
    const metrics = Object.fromEntries(latestData.metrics.map(item => [item.key, item]));
    const ccTop = latestData.groups.filter(row => row.port === 'CC').sort((a,b) => b.gap_students-a.gap_students)[0];
    const ssNear = latestData.groups.filter(row => row.port === 'SS').sort((a,b) => a.gap_students-b.gap_students).slice(0,2);
    const ssGap = latestData.groups.filter(row => row.port === 'SS').sort((a,b) => b.gap_students-a.gap_students)[0];
    const lpGap = latestData.totals.find(row => row.port === 'LP');
    return `${navMarkup()}<section class="fp-latest-hero"><div><div class="kicker">LATEST FIXED PLAN PULSE</div><h1>M0-1固定计划绑定-最新</h1><p>聚焦当前整体进度、三端口目标差距与14个固定小组的补齐优先级</p></div><div class="fp-latest-hero-side"><div class="fp-latest-date"><span>数据更新</span><b>${latestData.source_as_of}</b><small>${latestData.period}</small></div><div class="fp-latest-hero-actions"><button class="fp-import-primary" id="openFixedImport" type="button"><span aria-hidden="true">↑</span> 更新数据</button><button class="fp-import-secondary" id="downloadFixedResult" type="button"><span aria-hidden="true">↓</span> 下载统计结果</button></div></div></section>
      <section class="fp-latest-overview" aria-label="核心固定计划指标">${latestData.metrics.map(latestKpiCard).join('')}</section>
      <div class="fp-latest-source-note"><b>对比说明：</b>整体与 CC / SS / LP 均已按 ${latestData.source_as_of} 明细口径更新；对比值为 ${latestData.comparison_as_of || '上一快照'} 按相同新生范围重算结果。上月同期因当前数据源未提供历史快照，暂不展示差值。</div>
      <section class="panel fp-latest-groups" id="latestGroupSection"><div class="panel-head"><div><div class="panel-title">14个固定小组目标进度</div><div class="panel-sub">固定率 = 该组固定学员数 / 该组${latestData.period}；固定差额按目标人数四舍五入后计算</div></div><span class="fp-latest-scope">仅统计指定14组</span></div><div class="table-wrap"><table class="fp-latest-table"><thead><tr><th>组别</th><th>新生数</th><th>固定人数</th><th>固定率</th><th>目标</th><th>固定差额</th><th>状态</th></tr></thead><tbody><tr class="fp-port-divider"><td colspan="7"><span class="cc">CC</span> 目标 ${pct(metrics.CC.target,0)}</td></tr>${latestGroupRows('CC')}<tr class="fp-port-divider"><td colspan="7"><span class="ss">SS</span> 目标 ${pct(metrics.SS.target,0)}</td></tr>${latestGroupRows('SS')}<tr class="fp-port-divider"><td colspan="7"><span class="lp">LP</span> 目标 ${pct(metrics.LP.target,0)}</td></tr>${latestGroupRows('LP')}</tbody></table></div></section>
      <section class="fp-latest-analysis" id="latestAnalysis"><article class="summary"><span>当前判断</span><h2>整体距离${pct(metrics.overall.target,0)}目标仍差 ${pp(metrics.overall.rate-metrics.overall.target,2).replace('-','')}</h2><p>整体固定率为${pct(metrics.overall.rate,2)}。三端口中SS当前${pct(metrics.SS.rate,2)}最接近目标，CC的绝对补齐人数最多，LP需要在两个小组同步推进。</p><div class="fp-analysis-pills"><span>CC ${latestData.comparison_label || '较昨日'} ${pp(metrics.CC.rate-metrics.CC.yesterday_rate,2)}</span><span>SS ${latestData.comparison_label || '较昨日'} ${pp(metrics.SS.rate-metrics.SS.yesterday_rate,2)}</span><span>LP ${latestData.comparison_label || '较昨日'} ${pp(metrics.LP.rate-metrics.LP.yesterday_rate,2)}</span></div></article>
      <article><span>优先级 P0</span><b>先抓 ${ccTop.group} 与 ${ssGap.group}</b><p>${ccTop.group}还差${num(ccTop.gap_students)}人，是单组最大缺口；${ssGap.group}还差${num(ssGap.gap_students)}人。两组合计补齐${num(ccTop.gap_students+ssGap.gap_students)}人，可最快压缩总缺口。</p></article>
      <article><span>快速达标</span><b>${ssNear.map(row=>row.group).join('、')}</b><p>两个小组距离32%目标分别还差${ssNear.map(row=>num(row.gap_students)).join('、')}人，合计${num(ssNear.reduce((sum,row)=>sum+row.gap_students,0))}人。先在日清单中闭环，可形成可复制的SS达标动作，再迁移到其他SS组。</p></article>
      <article><span>LP动作</span><b>两组共同补齐 ${num(lpGap.gap_students)} 人</b><p>LP各小组缺口为${latestData.groups.filter(row=>row.port==='LP').map(row=>`${row.group.replace('HK-GZ','')} ${num(row.gap_students)}人`).join('、')}。建议按未固定新生清单每日分批触达，分别设置日目标并在次日复核绑定结果。</p></article></section>
      <section class="panel fp-latest-actions"><div class="panel-head"><div><div class="panel-title">建议执行节奏</div><div class="panel-sub">把月度差额转成可以每天追踪的动作</div></div></div><div class="panel-body"><div class="fp-action-grid"><div><em>01</em><b>每日锁定未固定新生</b><p>按组输出“新生但未固定”名单，优先处理CC14、GZ-SS01及两组LP；当天触达、次日核验。</p></div><div><em>02</em><b>复制临近达标组打法</b><p>复盘BJ-JWSS01与BJ-JWSS02的触达时间、话术和协同节点，形成SS统一动作模板。</p></div><div><em>03</em><b>分开管理覆盖率与端口贡献</b><p>整体固定率用于看最终覆盖；CC、SS、LP指标用于看责任贡献，避免把跨端口动作直接相加当作整体覆盖。</p></div></div></div></section>`;
  }

  function lineChart(rows, options = {}) {
    const { series = [{ key: 'rate', label: '整体固定率', color: '#17365d' }], min = 0, max = 0.6, showEveryValue = false, valueDigits = 1, target = null, chartWidth = 1160, chartHeight = 350, preserveAspect = false, className = '' } = options;
    const w = chartWidth, h = chartHeight, left = 52, right = 24, top = showEveryValue ? 44 : 24, bottom = 50;
    const x = index => left + index * (w - left - right) / Math.max(rows.length - 1, 1);
    const y = value => top + (max - value) * (h - top - bottom) / (max - min);
    const step = max <= .4 ? .05 : .1;
    const gridValues = [];
    for (let value = min; value <= max + .0001; value += step) gridValues.push(value);
    const grid = gridValues.map(value => `<g><line x1="${left}" y1="${y(value)}" x2="${w-right}" y2="${y(value)}" stroke="#e5e9ef"/><text x="8" y="${y(value)+4}" fill="#667085" font-size="11">${pct(value,0)}</text></g>`).join('');
    const targetLine = target == null ? '' : `<g><line x1="${left}" y1="${y(target)}" x2="${w-right}" y2="${y(target)}" stroke="#b54708" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${w-right}" y="${y(target)-7}" text-anchor="end" fill="#b54708" font-size="11">目标 ${pct(target,0)}</text></g>`;
    const xLabels = rows.map((row, index) => `<text x="${x(index)}" y="${h-17}" text-anchor="middle" fill="#667085" font-size="10">${monthLabel(row.month)}</text>`).join('');
    const lines = series.map(item => {
      const points = rows.map((row, index) => ({ index, value: item.get ? item.get(row) : row[item.key] }));
      const path = points.map(point => `${point.index ? 'L' : 'M'}${x(point.index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
      const dots = points.map(point => `<circle cx="${x(point.index)}" cy="${y(point.value)}" r="3.5" fill="${item.color}"><title>${rows[point.index].month} ${item.label} ${pct(point.value)}</title></circle>`).join('');
      const values = showEveryValue ? points.map((point, index) => `<text x="${x(point.index)}" y="${Math.max(y(point.value)-10-(index%2)*12,13)}" text-anchor="middle" fill="${item.color}" font-size="10" font-weight="700">${pct(point.value,valueDigits)}</text>`).join('') : '';
      return `<path d="${path}" fill="none" stroke="${item.color}" stroke-width="2.5"/>${dots}${values}`;
    }).join('');
    return `<svg class="fp-chart ${className}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${preserveAspect ? 'xMidYMid meet' : 'none'}" role="img" aria-label="${options.ariaLabel || '月度趋势图'}">${grid}${targetLine}${lines}${xLabels}</svg>`;
  }

  function operatorLegend() {
    return `<div class="fp-legend">${operators.map(op => `<span><i style="background:${colors[op]}"></i>${op}</span>`).join('')}</div>`;
  }

  function operatorTable() {
    const rows = operatorRows.map(row => `<tr><td><b>${row.month}</b></td><td>${num(row.new_students)}</td>${operators.map(op => `<td>${pct(row.rates[op])}</td>`).join('')}<td><b>${pct(row.binding_rate)}</b></td></tr>`).join('');
    return `<div class="table-wrap fp-operator-table-wrap"><table class="fp-operator-table"><thead><tr><th>统计月</th><th>新生数</th>${operators.map(op => `<th>${op}</th>`).join('')}<th>合计固定率</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function targetBlock() {
    const baseline = fp.target.baseline;
    const recommended = fp.target.recommended;
    const residual = baseline.student + baseline.other;
    const targetSum = recommended.CC + recommended.SS + recommended.LP + residual;
    const rows = ['CC','SS','LP'].map(op => `<article class="fp-target-card"><div class="fp-target-head"><span>${op}</span><b>${pct(recommended[op],0)}</b></div><div class="fp-target-track"><span style="width:${Math.min(baseline[op]/recommended[op],1)*100}%;background:${colors[op]}"></span></div><div class="fp-target-meta"><span>当前 ${pct(baseline[op])}</span><strong>需提升 ${pp(recommended[op]-baseline[op])}</strong></div></article>`).join('');
    return `<section class="panel fp-section" id="fpTarget"><div class="panel-head"><div><div class="panel-title">65%目标拆解</div><div class="panel-sub">以2026年7月端口表现为当前基线，固定率分母均为滚动双月新生数</div></div><span class="fp-goal-chip">目标 65%</span></div><div class="panel-body">
      <div class="fp-target-summary"><div><span>当前整体固定率</span><b>${pct(baseline.total)}</b></div><div><span>目标差距</span><b>${pp(fp.target.total-baseline.total)}</b></div><div><span>student + other维持</span><b>${pct(residual)}</b></div><div><span>建议目标合计</span><b>${pct(targetSum)}</b></div></div>
      <div class="fp-target-grid">${rows}</div>
      <div class="fp-target-rationale"><b>建议目标：CC 23% / SS 20% / LP 17%</b><p>7月 student 与 other 合计贡献${pct(residual)}，若保持不变，三大端口合计需要达到约59.1%。按7月三大端口贡献结构精确分摊约为 CC 22.6%、SS 20.3%、LP 16.2%；转为便于管理且带缓冲的整数目标23% / 20% / 17%，整体预计达到${pct(targetSum)}，高于65%目标约${pp(targetSum-fp.target.total)}。其中CC需提升${pp(recommended.CC-baseline.CC)}，SS需提升${pp(recommended.SS-baseline.SS)}，LP需提升${pp(recommended.LP-baseline.LP)}；LP虽在3月达到22.0%，但7月已回落至11.7%，应优先恢复3-4月的有效动作。</p></div>
    </div></section>`;
  }

  function userLifecycleChart(rows) {
    const stages = ['M0','M1','M2plus','total'];
    const labels = { M0: 'M0', M1: 'M1', M2plus: 'M2+', total: 'Total' };
    const w = 1680, h = 430, left = 55, right = 20, top = 32, bottom = 62, max = .8;
    const plotWidth = w - left - right;
    const groupWidth = plotWidth / rows.length;
    const barWidth = 15;
    const gap = 4;
    const y = value => top + (max - value) * (h - top - bottom) / max;
    const grid = Array.from({length: 9}, (_, i) => i / 10).map(value => `<g><line x1="${left}" y1="${y(value)}" x2="${w-right}" y2="${y(value)}" stroke="#e5e9ef"/><text x="8" y="${y(value)+4}" fill="#667085" font-size="11">${pct(value,0)}</text></g>`).join('');
    const bars = rows.map((row, rowIndex) => {
      const start = left + rowIndex * groupWidth + (groupWidth - (barWidth * 4 + gap * 3)) / 2;
      const items = stages.map((stage, stageIndex) => {
        const item = row[stage];
        const mature = stage === 'M0' || (stage === 'M1' && row.maturity.M1) || (stage === 'M2plus' && row.maturity.M2plus) || (stage === 'total' && row.maturity.M2plus);
        const x = start + stageIndex * (barWidth + gap);
        const height = Math.max(h - bottom - y(item.rate), 0);
        return `<g opacity="${mature ? 1 : .38}"><rect x="${x}" y="${y(item.rate)}" width="${barWidth}" height="${height}" rx="2" fill="${lifecycleColors[stage]}"><title>${row.cohort} ${labels[stage]} ${pct(item.rate)}（${num(item.count)}人）${mature ? '' : '，观察期未成熟'}</title></rect><text x="${x+barWidth/2}" y="${Math.max(y(item.rate)-5,11)}" text-anchor="middle" fill="${lifecycleColors[stage]}" font-size="8.5" font-weight="700">${pct(item.rate)}</text></g>`;
      }).join('');
      return `${items}<text x="${left + rowIndex * groupWidth + groupWidth/2}" y="${h-23}" text-anchor="middle" fill="#667085" font-size="10">${monthLabel(row.cohort)}</text>`;
    }).join('');
    return `<svg class="fp-user-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="2025年2月至2026年7月首单学员M0、M1、M2+及累计固定率柱状图">${grid}${bars}</svg>`;
  }

  function userLifecycleLegend() {
    return `<div class="fp-legend"><span><i style="background:${lifecycleColors.M0}"></i>M0</span><span><i style="background:${lifecycleColors.M1}"></i>M1</span><span><i style="background:${lifecycleColors.M2plus}"></i>M2+</span><span><i style="background:${lifecycleColors.total}"></i>Total</span><span class="fp-muted-legend">浅色 = 观察期未成熟</span></div>`;
  }

  function userLifecycleTable(rows) {
    const cell = (row, stage) => {
      const mature = stage === 'M0' || row.maturity[stage];
      return `<td class="${mature ? '' : 'is-immature'}"><b>${pct(row[stage].rate)}</b><small>${num(row[stage].count)}人${mature ? '' : ' · 观察中'}</small></td>`;
    };
    return `<div class="table-wrap fp-user-table-wrap"><table class="fp-user-table"><thead><tr><th>首单月</th><th>新生数</th><th>M0</th><th>M1</th><th>M2+</th><th>Total</th></tr></thead><tbody>${rows.map(row => `<tr><td><b>${row.cohort}</b></td><td>${num(row.new_students)}</td>${cell(row,'M0')}${cell(row,'M1')}${cell(row,'M2plus')}<td class="${row.maturity.M2plus ? '' : 'is-immature'}"><b>${pct(row.total.rate)}</b><small>${num(row.total.count)}人${row.maturity.M2plus ? '' : ' · 当前累计'}</small></td></tr>`).join('')}</tbody></table></div>`;
  }

  function userPortChart(rows, ports) {
    const stages = ['M0','M1','M2plus'];
    const labels = { M0: 'M0', M1: 'M1', M2plus: 'M2+' };
    const w = 1680, h = 430, left = 55, right = 20, top = 32, bottom = 62, max = .6;
    const plotWidth = w - left - right;
    const groupWidth = plotWidth / rows.length;
    const barWidth = 21;
    const gap = 6;
    const y = value => top + (max - value) * (h - top - bottom) / max;
    const grid = Array.from({length: 7}, (_, i) => i / 10).map(value => `<g><line x1="${left}" y1="${y(value)}" x2="${w-right}" y2="${y(value)}" stroke="#e5e9ef"/><text x="8" y="${y(value)+4}" fill="#667085" font-size="11">${pct(value,0)}</text></g>`).join('');
    const bars = rows.map((row, rowIndex) => {
      const start = left + rowIndex * groupWidth + (groupWidth - (barWidth * 3 + gap * 2)) / 2;
      const stageBars = stages.map((stage, stageIndex) => {
        const mature = stage === 'M0' || row.maturity[stage];
        const x = start + stageIndex * (barWidth + gap);
        let cumulative = 0;
        const segments = ports.map(port => {
          const value = row[stage].ports[port].rate;
          const bottomValue = cumulative;
          cumulative += value;
          return `<rect x="${x}" y="${y(cumulative)}" width="${barWidth}" height="${Math.max(y(bottomValue)-y(cumulative),0)}" fill="${colors[port]}"><title>${row.cohort} ${labels[stage]} ${port} ${pct(value)}（${num(row[stage].ports[port].count)}人）${mature ? '' : '，观察期未成熟'}</title></rect>`;
        }).join('');
        return `<g opacity="${mature ? 1 : .38}">${segments}<text x="${x+barWidth/2}" y="${Math.max(y(row[stage].rate)-6,11)}" text-anchor="middle" fill="#344054" font-size="8.5" font-weight="700">${pct(row[stage].rate)}</text></g>`;
      }).join('');
      return `${stageBars}<text x="${left + rowIndex * groupWidth + groupWidth/2}" y="${h-23}" text-anchor="middle" fill="#667085" font-size="10">${monthLabel(row.cohort)}</text>`;
    }).join('');
    return `<svg class="fp-user-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="2025年2月至2026年7月各生命周期首次固定操作人贡献率堆叠柱状图">${grid}${bars}</svg>`;
  }

  function userPortTable(rows, ports) {
    const stages = ['M0','M1','M2plus'];
    return `<div class="table-wrap fp-user-port-table-wrap"><table class="fp-user-port-table"><thead><tr><th>首单月</th><th>生命周期</th>${ports.map(port => `<th>${port}</th>`).join('')}<th>阶段固定率</th></tr></thead><tbody>${rows.map(row => stages.map((stage,index) => { const mature = stage === 'M0' || row.maturity[stage]; return `<tr class="${mature ? '' : 'is-immature'}">${index === 0 ? `<td rowspan="3"><b>${row.cohort}</b><small>${num(row.new_students)}名新生</small></td>` : ''}<td><b>${stage === 'M2plus' ? 'M2+' : stage}</b>${mature ? '' : '<small>观察中</small>'}</td>${ports.map(port => `<td>${pct(row[stage].ports[port].rate)}<small>${num(row[stage].ports[port].count)}人</small></td>`).join('')}<td><b>${pct(row[stage].rate)}</b><small>${num(row[stage].count)}人</small></td></tr>`; }).join('')).join('')}</tbody></table></div>`;
  }

  function ticketLifecycleChart(rows) {
    const stages = ['M0','M1','M2plus','total'];
    const labels = { M0: 'M0', M1: 'M1', M2plus: 'M2+', total: 'Total' };
    const w = 1680, h = 470, left = 64, right = 20, top = 34, bottom = 62;
    const rawMax = Math.max(...rows.flatMap(row => stages.map(stage => row[stage].rate)));
    const max = Math.ceil(rawMax / .5) * .5;
    const plotWidth = w - left - right;
    const groupWidth = plotWidth / rows.length;
    const barWidth = 15;
    const gap = 4;
    const y = value => top + (max - value) * (h - top - bottom) / max;
    const step = max > 4 ? 1 : .5;
    const grid = Array.from({length: Math.floor(max/step)+1}, (_,i) => i*step).map(value => `<g><line x1="${left}" y1="${y(value)}" x2="${w-right}" y2="${y(value)}" stroke="#e5e9ef"/><text x="8" y="${y(value)+4}" fill="#667085" font-size="11">${pct(value,0)}</text></g>`).join('');
    const bars = rows.map((row,rowIndex) => {
      const start = left + rowIndex*groupWidth + (groupWidth-(barWidth*4+gap*3))/2;
      const items = stages.map((stage,stageIndex) => {
        const item = row[stage];
        const mature = stage === 'M0' || (stage === 'M1' && row.maturity.M1) || (stage === 'M2plus' && row.maturity.M2plus) || (stage === 'total' && row.maturity.M2plus);
        const x = start + stageIndex*(barWidth+gap);
        const height = Math.max(h-bottom-y(item.rate),0);
        return `<g opacity="${mature ? 1 : .38}"><rect x="${x}" y="${y(item.rate)}" width="${barWidth}" height="${height}" rx="2" fill="${lifecycleColors[stage]}"><title>${row.cohort} ${labels[stage]} 工单率${pct(item.rate)}（${num(item.count)}单）${mature ? '' : '，观察期未成熟'}</title></rect><text x="${x+barWidth/2}" y="${Math.max(y(item.rate)-5,11)}" text-anchor="middle" fill="${lifecycleColors[stage]}" font-size="8" font-weight="700">${pct(item.rate,0)}</text></g>`;
      }).join('');
      return `${items}<text x="${left+rowIndex*groupWidth+groupWidth/2}" y="${h-23}" text-anchor="middle" fill="#667085" font-size="10">${monthLabel(row.cohort)}</text>`;
    }).join('');
    return `<svg class="fp-user-chart fp-ticket-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="2025年2月至2026年7月首单学员M0、M1、M2+及累计工单率柱状图">${grid}${bars}</svg>`;
  }

  function ticketLifecycleTable(rows) {
    const cell = (row,stage) => { const mature = stage === 'M0' || row.maturity[stage]; return `<td class="${mature ? '' : 'is-immature'}"><b>${pct(row[stage].rate)}</b><small>${num(row[stage].count)}单${mature ? '' : ' · 观察中'}</small></td>`; };
    return `<div class="table-wrap fp-user-table-wrap"><table class="fp-user-table"><thead><tr><th>首单月</th><th>新生数</th><th>M0工单率</th><th>M1工单率</th><th>M2+工单率</th><th>Total工单率</th></tr></thead><tbody>${rows.map(row => `<tr><td><b>${row.cohort}</b></td><td>${num(row.new_students)}</td>${cell(row,'M0')}${cell(row,'M1')}${cell(row,'M2plus')}<td class="${row.maturity.M2plus ? '' : 'is-immature'}"><b>${pct(row.total.rate)}</b><small>${num(row.total.count)}单${row.maturity.M2plus ? '' : ' · 当前累计'}</small></td></tr>`).join('')}</tbody></table></div>`;
  }

  function ticketPortChart(rows,ports) {
    const stages = ['M0','M1','M2plus'];
    const labels = { M0:'M0', M1:'M1', M2plus:'M2+' };
    const w=1680,h=470,left=64,right=20,top=34,bottom=62;
    const rawMax=Math.max(...rows.flatMap(row=>stages.map(stage=>row[stage].rate)));
    const max=Math.ceil(rawMax/.5)*.5;
    const plotWidth=w-left-right,groupWidth=plotWidth/rows.length,barWidth=21,gap=6;
    const y=value=>top+(max-value)*(h-top-bottom)/max;
    const step=max>3 ? .5 : .25;
    const grid=Array.from({length:Math.floor(max/step)+1},(_,i)=>i*step).map(value=>`<g><line x1="${left}" y1="${y(value)}" x2="${w-right}" y2="${y(value)}" stroke="#e5e9ef"/><text x="8" y="${y(value)+4}" fill="#667085" font-size="11">${pct(value,0)}</text></g>`).join('');
    const bars=rows.map((row,rowIndex)=>{const start=left+rowIndex*groupWidth+(groupWidth-(barWidth*3+gap*2))/2;const stageBars=stages.map((stage,stageIndex)=>{const mature=stage==='M0'||row.maturity[stage];const x=start+stageIndex*(barWidth+gap);let cumulative=0;const segments=ports.map(port=>{const value=row[stage].ports[port].rate;const bottomValue=cumulative;cumulative+=value;return `<rect x="${x}" y="${y(cumulative)}" width="${barWidth}" height="${Math.max(y(bottomValue)-y(cumulative),0)}" fill="${colors[port]}"><title>${row.cohort} ${labels[stage]} ${port}工单率${pct(value)}（${num(row[stage].ports[port].count)}单）${mature?'':'，观察期未成熟'}</title></rect>`;}).join('');return `<g opacity="${mature?1:.38}">${segments}<text x="${x+barWidth/2}" y="${Math.max(y(row[stage].rate)-6,11)}" text-anchor="middle" fill="#344054" font-size="8" font-weight="700">${pct(row[stage].rate,0)}</text></g>`;}).join('');return `${stageBars}<text x="${left+rowIndex*groupWidth+groupWidth/2}" y="${h-23}" text-anchor="middle" fill="#667085" font-size="10">${monthLabel(row.cohort)}</text>`;}).join('');
    return `<svg class="fp-user-chart fp-ticket-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="2025年2月至2026年7月各生命周期首次固定操作人工单贡献率堆叠柱状图">${grid}${bars}</svg>`;
  }

  function ticketPortTable(rows,ports) {
    const stages=['M0','M1','M2plus'];
    return `<div class="table-wrap fp-user-port-table-wrap"><table class="fp-user-port-table"><thead><tr><th>首单月</th><th>生命周期</th>${ports.map(port=>`<th>${port}</th>`).join('')}<th>阶段工单率</th></tr></thead><tbody>${rows.map(row=>stages.map((stage,index)=>{const mature=stage==='M0'||row.maturity[stage];return `<tr class="${mature?'':'is-immature'}">${index===0?`<td rowspan="3"><b>${row.cohort}</b><small>${num(row.new_students)}名新生</small></td>`:''}<td><b>${stage==='M2plus'?'M2+':stage}</b>${mature?'':'<small>观察中</small>'}</td>${ports.map(port=>`<td>${pct(row[stage].ports[port].rate)}<small>${num(row[stage].ports[port].count)}单</small></td>`).join('')}<td><b>${pct(row[stage].rate)}</b><small>${num(row[stage].count)}单</small></td></tr>`;}).join('')).join('')}</tbody></table></div>`;
  }

  function renderM01() {
    const overall2025 = overall.filter(row => row.month.startsWith('2025'));
    const overall2026H1 = overall.filter(row => row.month >= '2026-01' && row.month <= '2026-06');
    const avg2025 = mean(overall2025.map(row => row.rate));
    const avg2026H1 = mean(overall2026H1.map(row => row.rate));
    const peak = overall.reduce((best, row) => !best || row.rate > best.rate ? row : best, null);
    const trough = overall.reduce((low, row) => !low || row.rate < low.rate ? row : low, null);
    const latest = overall[overall.length - 1];
    const latestOperator = operatorRows[operatorRows.length - 1];
    const target = fp.target.recommended;
    const operatorSeries = operators.map(op => ({ key: op, label: op, color: colors[op], get: row => row.rates[op] }));

    return `${navMarkup()}<section class="fp-hero"><div><div class="kicker">FIXED PLAN PERFORMANCE · HISTORY</div><h1>M0-1固定计划绑定（历史）</h1><p class="subtitle">整体趋势使用业务确认口径；端口分析按滚动双月新生 cohort 与全历史首次绑定口径计算</p></div><div class="fp-scope"><div class="fp-scope-row"><span>整体趋势</span><b>2025-01 至 2026-07</b></div><div class="fp-scope-row"><span>端口分析</span><b>2025-02 至 2026-07</b></div><div class="fp-scope-row"><span>端口分母</span><b>当月滚动双月新生数</b></div></div></section>
      <section class="fp-kpis"><div class="fp-kpi"><div class="fp-kpi-label"><span>2025月均固定率</span><span>12个月</span></div><div class="fp-kpi-value">${pct(avg2025)}</div><div class="fp-kpi-meta">整体固定计划绑定率的月度简单平均</div></div><div class="fp-kpi"><div class="fp-kpi-label"><span>2026年1-6月均值</span><span>成熟月份</span></div><div class="fp-kpi-value">${pct(avg2026H1)}</div><div class="fp-kpi-meta">较2025月均 ${pp(avg2026H1-avg2025)}</div></div><div class="fp-kpi"><div class="fp-kpi-label"><span>最高月份</span><span>${peak.month}</span></div><div class="fp-kpi-value">${pct(peak.rate)}</div><div class="fp-kpi-meta">历史高点仍低于65%目标 ${pp(peak.rate-.65)}</div></div><div class="fp-kpi"><div class="fp-kpi-label"><span>最新月份</span><span>${latest.month}</span></div><div class="fp-kpi-value">${pct(latest.rate,2)}</div><div class="fp-kpi-meta">较2026年5月高点回落，需关注连续性</div></div></section>
      <section class="fp-trend-layout"><div class="panel fp-trend-panel"><div class="panel-head"><div><div class="panel-title">整体固定计划绑定率趋势</div><div class="panel-sub">2025-01 至 2026-07，每个点均展示月度固定率；虚线为65%目标</div></div></div><div class="panel-body">${lineChart(overall,{min:.2,max:.7,showEveryValue:true,valueDigits:2,target:.65,chartWidth:920,chartHeight:460,preserveAspect:true,className:'fp-overall-chart',ariaLabel:'2025年1月至2026年7月整体固定计划绑定率'})}</div></div>
      <aside class="fp-trend-insights" aria-label="整体趋势分析"><article class="fp-insight"><span>阶段改善</span><b>2026上半年高于2025</b><p>2026年1-6月月均${pct(avg2026H1)}，较2025年月均${pct(avg2025)}提升${pp(avg2026H1-avg2025)}，但改善主要集中在3-5月，尚未形成稳定平台。</p></article><article class="fp-insight"><span>波动风险</span><b>${peak.month}冲高后回落</b><p>最高点${pct(peak.rate)}出现在${peak.month}；6月降至46.8%，7月进一步到42.91%。需要把高点动作固化为月内节点机制，而非依赖阶段性冲刺。</p></article><article class="fp-insight"><span>历史低点</span><b>${trough.month}仅${pct(trough.rate)}</b><p>2025年初从25.0%快速修复，但2025年7-8月与2026年1-2月仍出现低谷，说明淡旺季、责任切换和补漏节奏需要纳入固定SOP。</p></article></aside></section>
      <section class="panel fp-section" id="operatorSection"><div class="panel-head"><div><div class="panel-title">M0-1首次固定操作人固定率趋势</div><div class="panel-sub">端口固定率 = 该端口首次固定学员数 / 当月新生数；各端口合计等于整体固定率</div></div>${operatorLegend()}</div><div class="panel-body">${lineChart(operatorRows,{series:operatorSeries,min:0,max:.35,ariaLabel:'2025年2月至2026年7月各端口首次固定率趋势'})}</div>${operatorTable()}</section>
      <section class="fp-analysis-grid"><article><span>CC：7月仍是最大端口</span><b>${pct(latestOperator.rates.CC)} / 目标 ${pct(target.CC,0)}</b><p>7月CC固定率16.4%，与6月16.6%基本持平，仍是三大端口中贡献最高的一端。要达到23%管理目标，需要提升${pp(target.CC-latestOperator.rates.CC)}，承担最大的绝对增量。</p></article><article><span>SS：7月小幅回升</span><b>${pct(latestOperator.rates.SS)} / 目标 ${pct(target.SS,0)}</b><p>7月SS固定率14.7%，较6月14.3%提升${pp(latestOperator.rates.SS-operatorRows[operatorRows.length-2].rates.SS)}。建议把20%作为稳定底线，当前仍需提升${pp(target.SS-latestOperator.rates.SS)}。</p></article><article><span>LP：优先恢复有效机制</span><b>${pct(latestOperator.rates.LP)} / 目标 ${pct(target.LP,0)}</b><p>LP从3月22.0%连续回落，6月12.2%、7月11.7%。17%目标低于其历史高点，但较7月仍需提升${pp(target.LP-latestOperator.rates.LP)}，重点是恢复3-4月动作而非继续压高指标。</p></article><article><span>student / other：保留辅助贡献</span><b>${pct(latestOperator.rates.student + latestOperator.rates.other)}基线</b><p>7月student为4.5%、other为1.4%，合计5.9%。目标拆解假设两者维持当前贡献，不把65%的主要增量压力转移给这两个辅助端口。</p></article></section>
      ${targetBlock()}`;
  }

  function m01AllTable(rows, ports) {
    return `<div class="table-wrap fp-operator-table-wrap"><table class="fp-operator-table fp-m01all-table"><thead><tr><th>统计月</th><th>新生数</th>${ports.map(port=>`<th>${port}</th>`).join('')}<th>端口率之和</th><th>跨端口重复</th><th>去重整体固定率</th></tr></thead><tbody>${rows.map(row=>`<tr><td><b>${row.month}</b></td><td>${num(row.new_students)}</td>${ports.map(port=>`<td>${pct(row.rates[port])}<small>${num(row.port_counts[port])}人</small></td>`).join('')}<td><b>${pct(row.touch_sum_rate)}</b><small>${num(row.touch_sum)}次端口触达</small></td><td>${pct(row.overlap_rate)}<small>${num(row.overlap_touches)}次重复</small></td><td><b>${pct(row.binding_rate)}</b><small>${num(row.bound_students)}人</small></td></tr>`).join('')}</tbody></table></div>`;
  }

  function m01AllTargetBlock(data) {
    const baseline=data.target.baseline,recommended=data.target.recommended,exact=data.target.exact;
    const targetTouchSum=Object.values(recommended).reduce((sum,value)=>sum+value,0);
    const currentMajorSum=baseline.CC+baseline.SS+baseline.LP;
    const cards=['CC','SS','LP'].map(port=>`<article class="fp-target-card"><div class="fp-target-head"><span>${port}</span><b>${pct(recommended[port],0)}</b></div><div class="fp-target-track"><span style="width:${Math.min(baseline[port]/recommended[port],1)*100}%;background:${colors[port]}"></span></div><div class="fp-target-meta"><span>7月 ${pct(baseline[port])}</span><strong>需提升 ${pp(recommended[port]-baseline[port])}</strong></div></article>`).join('');
    return `<section class="panel fp-section" id="fpAllTarget"><div class="panel-head"><div><div class="panel-title">去重65%目标 → 不去重目标拆解</div><div class="panel-sub">先按7月去重转化效率反推不去重目标，再按CC、SS、LP当前贡献结构分摊</div></div><span class="fp-goal-chip">去重目标 65%</span></div><div class="panel-body"><div class="fp-target-summary"><div><span>7月去重覆盖</span><b>${pct(baseline.total)}</b></div><div><span>7月不去重固定率</span><b>${pct(baseline.touch_sum)}</b></div><div><span>反推不去重目标</span><b>${pct(data.target.required_touch_sum)}</b></div><div><span>预计去重覆盖</span><b>${pct(data.target.estimated_total)}</b></div></div><div class="fp-target-grid">${cards}</div><div class="fp-target-rationale"><b>建议目标：CC 33% / SS 38% / LP 25% = 96%</b><p>7月去重覆盖${pct(baseline.total)}、不去重固定率${pct(baseline.touch_sum)}，对应去重转化效率${pct(baseline.union_efficiency)}。若该效率保持不变，要实现去重覆盖65%，不去重固定率需达到约${pct(data.target.required_touch_sum)}。按7月CC、SS、LP当前贡献结构精确分摊约为CC ${pct(exact.CC)}、SS ${pct(exact.SS)}、LP ${pct(exact.LP)}；取带缓冲的整数目标33% / 38% / 25%，三端合计${pct(targetTouchSum)}，预计对应去重覆盖${pct(data.target.estimated_total)}。对应CC需提升${pp(recommended.CC-baseline.CC)}、SS需提升${pp(recommended.SS-baseline.SS)}、LP需提升${pp(recommended.LP-baseline.LP)}；student与other作为额外贡献，不计入三端目标。</p></div></div></section>`;
  }

  function renderM01All() {
    if(!m01AllData) return renderEmpty('M0-1固定计划绑定（不去重）');
    const rows=m01AllData.rows,ports=m01AllData.ports,latest=rows[rows.length-1],previous=rows[rows.length-2];
    const peak=rows.reduce((best,row)=>row.binding_rate>best.binding_rate?row:best,rows[0]);
    const series=ports.map(port=>({key:port,label:port,color:colors[port],get:row=>row.rates[port]}));
    const coverageSeries=[{key:'touch_sum_rate',label:'不去重固定率',color:'#17365d'},{key:'binding_rate',label:'去重覆盖参考',color:'#7d8796'}];
    return `${navMarkup()}<section class="fp-hero"><div><div class="kicker">M0-1 ALL PORT TOUCHES</div><h1>M0-1固定计划绑定（不去重）</h1><p class="subtitle">同一学员在同一端口多次操作只计1人；跨端口操作分别计入各端口，整体覆盖人数仍按学员去重</p></div><div class="fp-scope"><div class="fp-scope-row"><span>统计范围</span><b>2025-02 至 2026-07</b></div><div class="fp-scope-row"><span>统计窗口</span><b>当月 + 上月</b></div><div class="fp-scope-row"><span>端口分母</span><b>滚动双月新生数</b></div></div></section>
      <div class="fp-note"><b>阅读提示：</b>本看板的不去重固定率 = CC + SS + LP + student + other端口率。同一学员可跨端口重复贡献，因此该指标会高于去重覆盖率；同一学员在同一端口无论操作多少次只计1人。</div>
      <section class="fp-kpis"><div class="fp-kpi"><div class="fp-kpi-label"><span>7月不去重固定率</span><span>${num(latest.touch_sum)}次触达</span></div><div class="fp-kpi-value">${pct(latest.touch_sum_rate)}</div><div class="fp-kpi-meta">五端口触达率之和，已高于65%目标${pp(latest.touch_sum_rate-.65)}</div></div><div class="fp-kpi"><div class="fp-kpi-label"><span>7月去重覆盖参考</span><span>${num(latest.bound_students)}人</span></div><div class="fp-kpi-value">${pct(latest.binding_rate)}</div><div class="fp-kpi-meta">同一学员跨端口只计1人</div></div><div class="fp-kpi"><div class="fp-kpi-label"><span>7月跨端口重复</span><span>${num(latest.overlap_touches)}次</span></div><div class="fp-kpi-value">${pct(latest.overlap_rate)}</div><div class="fp-kpi-meta">不去重固定率减去去重覆盖率</div></div><div class="fp-kpi"><div class="fp-kpi-label"><span>历史最高不去重固定率</span><span>${rows.reduce((best,row)=>row.touch_sum_rate>best.touch_sum_rate?row:best,rows[0]).month}</span></div><div class="fp-kpi-value">${pct(Math.max(...rows.map(row=>row.touch_sum_rate)))}</div><div class="fp-kpi-meta">端口协同触达强度的历史高点</div></div></section>
      <section class="panel fp-section"><div class="panel-head"><div><div class="panel-title">不去重固定率与去重覆盖参考</div><div class="panel-sub">深色线为五端口率之和并用于衡量65%目标；灰线为去重学员覆盖率</div></div></div><div class="panel-body">${lineChart(rows,{series:coverageSeries,min:.3,max:.9,showEveryValue:true,valueDigits:1,target:.65,ariaLabel:'2025年2月至2026年7月不去重固定率与去重覆盖参考趋势'})}</div></section>
      <section class="panel fp-section" id="operatorAllSection"><div class="panel-head"><div><div class="panel-title">M0-1各端口触达率趋势</div><div class="panel-sub">端口触达率 = 该端口在M0-1出现过绑定动作的学员数 / 滚动双月新生数；学员×端口仅计1次</div></div>${operatorLegend()}</div><div class="panel-body">${lineChart(rows,{series,min:0,max:.4,ariaLabel:'2025年2月至2026年7月M0-1不去重端口触达率趋势'})}</div>${m01AllTable(rows,ports)}</section>
      <section class="fp-analysis-grid"><article><span>不去重目标</span><b>去重65%需约${pct(m01AllData.target.required_touch_sum)}</b><p>7月不去重固定率${pct(latest.touch_sum_rate)}，按当前转化效率反推仍需提升${pp(m01AllData.target.required_touch_sum-latest.touch_sum_rate)}。</p></article><article><span>端口触达</span><b>SS ${pct(latest.rates.SS)}最高</b><p>7月CC ${pct(latest.rates.CC)}、SS ${pct(latest.rates.SS)}、LP ${pct(latest.rates.LP)}；对应管理目标为33%、38%、25%。</p></article><article><span>重复触达</span><b>${pct(latest.overlap_rate)}来自跨端口重叠</b><p>7月${num(latest.bound_students)}名固定学员产生${num(latest.touch_sum)}次端口触达，额外${num(latest.overlap_touches)}次来自同一学员被多个端口操作。</p></article><article><span>管理结论</span><b>三端目标合计96%</b><p>CC需提升${pp(.33-latest.rates.CC)}、SS需提升${pp(.38-latest.rates.SS)}、LP需提升${pp(.25-latest.rates.LP)}。同时需维持当前端口重叠效率，才能支撑去重覆盖65%。</p></article></section>
      ${m01AllTargetBlock(m01AllData)}`;
  }

  function renderUser() {
    if (!userData) return renderEmpty('历史固定计划绑定（用户维度）');
    const rows = userData.rows;
    const ports = userData.ports;
    const matureRows = rows.filter(row => row.maturity.M2plus);
    const matureStudents = matureRows.reduce((sum,row) => sum + row.new_students, 0);
    const matureCount = stage => matureRows.reduce((sum,row) => sum + row[stage].count, 0);
    const matureRate = stage => matureCount(stage) / matureStudents;
    const matureTotal = ['M0','M1','M2plus'].reduce((sum,stage) => sum + matureCount(stage), 0);
    const portCount = (stage,port) => matureRows.reduce((sum,row) => sum + row[stage].ports[port].count, 0);
    const stageShare = stage => matureCount(stage) / matureTotal;
    const portStageShare = (stage,port) => portCount(stage,port) / matureCount(stage);
    const feb26 = rows.find(row => row.cohort === '2026-02');
    const latest = rows[rows.length - 1];
    return `${navMarkup()}<section class="fp-hero fp-user-hero"><div><div class="kicker">USER LIFECYCLE VIEW</div><h1>历史固定计划绑定（用户维度）</h1><p class="subtitle">按首单 cohort 观察学员首次固定发生在 M0、M1 或 M2+；每位学员仅保留全历史最早绑定记录</p></div><div class="fp-scope"><div class="fp-scope-row"><span>首单范围</span><b>2025-02 至 2026-07</b></div><div class="fp-scope-row"><span>统计分母</span><b>各首单月新生数</b></div><div class="fp-scope-row"><span>已进入M2+</span><b>2025-02 至 2026-05</b></div></div></section>
      <section class="panel fp-section" id="userLifecycleSection"><div class="panel-head"><div><div class="panel-title">首单 cohort 生命周期固定率</div><div class="panel-sub">每个首单月四根柱：M0、M1、M2+及截至数据截止日的Total</div></div>${userLifecycleLegend()}</div><div class="panel-body fp-user-chart-scroll">${userLifecycleChart(rows)}</div>${userLifecycleTable(rows)}</section>
      <section class="fp-user-insights"><article><span>固定高峰</span><b>M0是最关键窗口</b><p>在已进入M2+观察窗口的2025-02至2026-05 cohort 中，M0固定率${pct(matureRate('M0'))}，贡献了全部固定学员的${pct(stageShare('M0'))}；M1与M2+分别贡献${pct(stageShare('M1'))}和${pct(stageShare('M2plus'))}。</p></article><article><span>特殊 cohort</span><b>2026-02的M1达到${pct(feb26.M1.rate)}</b><p>该批学员M0仅${pct(feb26.M0.rate)}，但次月由LP ${pct(feb26.M1.ports.LP.rate)}、CC ${pct(feb26.M1.ports.CC.rate)}和student ${pct(feb26.M1.ports.student.rate)}共同补回，说明M1补漏可以显著改变最终结果。</p></article><article><span>观察期提醒</span><b>2026-06与07不能直接比较Total</b><p>2026-06尚未进入M2+，2026-07只观察到M0；不同cohort的M2+累计时长也不同，分析长期固定时应结合观察时长，不能把尚未发生的M1/M2+当作0%评价。</p></article></section>
      <section class="panel fp-section" id="userPortSection"><div class="panel-head"><div><div class="panel-title">生命周期 × 首次固定操作人贡献</div><div class="panel-sub">每个端口占比的分母均为对应首单月新生数；每根柱内各端口之和等于该生命周期固定率</div></div>${operatorLegend()}</div><div class="panel-body fp-user-chart-scroll">${userPortChart(rows,ports)}</div>${userPortTable(rows,ports)}</section>
      <section class="fp-analysis-grid fp-user-analysis"><article><span>M0：团队端口主导</span><b>SS贡献最高</b><p>已进入M2+ cohort 的M0中，SS占M0固定人数${pct(portStageShare('M0','SS'))}，CC占${pct(portStageShare('M0','CC'))}，LP占${pct(portStageShare('M0','LP'))}。首单当月应以三大团队端口的前置绑定为核心。</p></article><article><span>M1：团队补漏仍有效</span><b>SS + LP贡献${pct(portStageShare('M1','SS')+portStageShare('M1','LP'))}</b><p>M1阶段SS占${pct(portStageShare('M1','SS'))}、LP占${pct(portStageShare('M1','LP'))}，student提升至${pct(portStageShare('M1','student'))}。建议在首单后第1个月设置未固定名单回收机制。</p></article><article><span>M2+：用户自助成为主力</span><b>student占${pct(portStageShare('M2plus','student'))}</b><p>M2+固定中student贡献超过一半，SS贡献${pct(portStageShare('M2plus','SS'))}；CC与LP合计仅${pct(portStageShare('M2plus','CC')+portStageShare('M2plus','LP'))}。越往后，团队主动固定能力明显减弱。</p></article><article><span>管理结论</span><b>前置M0，抓牢M1</b><p>优先把固定动作压到M0，M1用于集中补漏；M2+更适合作为用户自助和长期提醒通道。考核时应分开看M0即时能力与M1补回能力，而不是只看最终累计。</p></article></section>
      <div class="fp-note">口径说明：付费表X列确定首单月份，绑定表按学员ID仅保留B列最早固定记录，并以Y列归类首次操作人。最早固定早于首单的${num(userData.quality.pre_pay_first_bindings_excluded)}名学员不纳入M0/M1/M2+；两表首单月份冲突为${num(userData.quality.binding_pay_month_mismatches)}。</div>`;
  }

  function renderTicket() {
    if (!ticketData) return renderEmpty('历史固定计划绑定（工单维度）');
    const rows=ticketData.rows, ports=ticketData.ports, aggregate=ticketData.aggregate;
    const stageShare=stage=>aggregate[stage].count/aggregate.total.count;
    const portStageShare=(stage,port)=>aggregate[stage].ports[port].count/aggregate[stage].count;
    const peakM0=rows.reduce((best,row)=>row.M0.rate>best.M0.rate?row:best,rows[0]);
    const peakM1=rows.filter(row=>row.maturity.M1).reduce((best,row)=>row.M1.rate>best.M1.rate?row:best,rows[0]);
    const latest=rows[rows.length-1];
    return `${navMarkup()}<section class="fp-hero fp-user-hero"><div><div class="kicker">DAILY TICKET LIFECYCLE VIEW</div><h1>历史固定计划绑定（工单维度）</h1><p class="subtitle">按首单 cohort 统计全部绑定工单；同一学员同一天仅保留绑定时间最早的一条，不同日期可重复计入</p></div><div class="fp-scope"><div class="fp-scope-row"><span>首单范围</span><b>2025-02 至 2026-07</b></div><div class="fp-scope-row"><span>统计分母</span><b>各首单月新生数</b></div><div class="fp-scope-row"><span>指标含义</span><b>工单数 / 新生数</b></div></div></section>
      <div class="fp-note fp-ticket-note"><b>阅读提示：</b>同一学员可在不同日期产生多张工单，因此工单率允许超过100%；M2+与Total是截至2026-07的累计值，老cohort拥有更长观察期。</div>
      <section class="panel fp-section" id="ticketLifecycleSection"><div class="panel-head"><div><div class="panel-title">首单 cohort 生命周期工单率</div><div class="panel-sub">每个首单月四根柱：M0、M1、M2+及Total；所有指标分母均为该首单月新生数</div></div>${userLifecycleLegend()}</div><div class="panel-body fp-user-chart-scroll">${ticketLifecycleChart(rows)}</div>${ticketLifecycleTable(rows)}</section>
      <section class="fp-user-insights"><article><span>工单次数最多</span><b>M2+累计占${pct(stageShare('M2plus'))}</b><p>已进入M2+的cohort共${num(aggregate.total.count)}张工单，其中M2+累计${num(aggregate.M2plus.count)}张，占${pct(stageShare('M2plus'))}。但M2+包含多个自然月，不能与M0/M1单月效率直接横比。</p></article><article><span>单月窗口对比</span><b>M1 ${pct(aggregate.M1.rate)}，高于M0</b><p>M0工单率${pct(aggregate.M0.rate)}，M1为${pct(aggregate.M1.rate)}，M1高${pp(aggregate.M1.rate-aggregate.M0.rate)}。说明首单次月仍是高频调整和补绑定窗口。</p></article><article><span>高峰 cohort</span><b>${peakM1.cohort} M1接近1单/人</b><p>${peakM0.cohort}的M0工单率最高，为${pct(peakM0.M0.rate)}；${peakM1.cohort}的M1达到${pct(peakM1.M1.rate)}。2026-07目前只观察到M0，工单率为${pct(latest.M0.rate)}。</p></article></section>
      <section class="panel fp-section" id="ticketPortSection"><div class="panel-head"><div><div class="panel-title">生命周期 × 操作端口工单贡献</div><div class="panel-sub">每个端口工单率 = 该端口每日唯一工单数 / 对应首单月新生数；堆叠合计等于阶段工单率</div></div>${operatorLegend()}</div><div class="panel-body fp-user-chart-scroll">${ticketPortChart(rows,ports)}</div>${ticketPortTable(rows,ports)}</section>
      <section class="fp-analysis-grid fp-user-analysis"><article><span>M0：团队端口主导</span><b>SS占${pct(portStageShare('M0','SS'))}</b><p>M0工单中SS占${pct(portStageShare('M0','SS'))}，CC占${pct(portStageShare('M0','CC'))}，LP占${pct(portStageShare('M0','LP'))}。三大团队端口合计${pct(portStageShare('M0','SS')+portStageShare('M0','CC')+portStageShare('M0','LP'))}，首单当月以人工前置绑定为主。</p></article><article><span>M1：端口更加分散</span><b>SS仍是第一贡献端</b><p>M1中SS占${pct(portStageShare('M1','SS'))}，student与other分别升至${pct(portStageShare('M1','student'))}和${pct(portStageShare('M1','other'))}。次月既有团队补漏，也出现更多学员自助及其他操作。</p></article><article><span>M2+：other成为最大来源</span><b>other占${pct(portStageShare('M2plus','other'))}</b><p>M2+累计工单中other占${pct(portStageShare('M2plus','other'))}，SS占${pct(portStageShare('M2plus','SS'))}，student占${pct(portStageShare('M2plus','student'))}。长期工单更多来自非CC/SS/LP端口和学员自助。</p></article><article><span>管理结论</span><b>区分首次绑定与重复工单</b><p>用户维度适合衡量覆盖率，工单维度反映后续调整频次。M1的单月工单率高于M0，建议重点排查次月改绑、补绑原因；M2+则结合观察时长和other明细分析，不宜直接作为固定覆盖率。</p></article></section>
      <div class="fp-note">口径说明：绑定表按“学员ID + 自然日”去重，同一天仅保留B列绑定时间最早记录，并按该记录Y列归类端口。共从${num(ticketData.quality.valid_binding_rows)}条有效记录中剔除${num(ticketData.quality.same_day_duplicate_rows_removed)}条同日重复记录；首单前${num(ticketData.quality.pre_pay_daily_tickets_excluded)}张工单不纳入M0/M1/M2+。</div>`;
  }

  function renderEmpty(label) {
    return `${navMarkup()}<section class="panel"><div class="fp-empty"><div><b>${label}</b><p>版块已建立，等待对应历史数据口径接入。</p></div></div></section>`;
  }

  function bindFixedTabs() {
    document.querySelectorAll('[data-fp-tab]').forEach(button => { button.onclick = () => { fixedTab = button.dataset.fpTab; renderFixedPlan(); }; });
  }

  function setFixedToolbar() {
    const update = document.querySelector('.tools > span');
    if (update) update.textContent = `更新：${fixedTab === 'latest' && latestData ? latestData.source_as_of : fp.source_as_of}`;
    const filter = document.getElementById('filterBtn');
    const ai = document.getElementById('aiBtn');
    const scope = document.getElementById('scopeBtn');
    const importButton = document.getElementById('importBtn');
    if (filter) filter.onclick = () => document.getElementById(fixedTab === 'latest' ? 'latestGroupSection' : fixedTab === 'm01all' ? 'operatorAllSection' : 'operatorSection')?.scrollIntoView({ behavior: 'smooth' });
    if (ai) ai.onclick = () => document.getElementById(fixedTab === 'latest' ? 'latestAnalysis' : fixedTab === 'm01all' ? 'fpAllTarget' : 'fpTarget')?.scrollIntoView({ behavior: 'smooth' });
    if (scope) scope.onclick = () => alert(fixedTab === 'latest' ? `最新口径：端口及14个小组仅统计${latestData.period}；同一学员在同一端口仅计1人。整体固定率按有效绑定学员去重计算，端口固定率分母为对应端口双月新生数。` : fixedTab === 'm01all' ? '不去重端口口径：统计月M纳入首单月份和绑定月份均为M-1或M的学员；同一学员在同一端口多次只计1人，跨端口分别计入；整体固定人数仍按学员去重，分母为滚动双月新生数。' : '整体趋势：使用业务确认的2501-2607固定计划绑定率。端口分析：统计月M纳入首单月份为M-1或M的去重学员；全历史首次绑定月份也在M-1至M时计入，操作人取最早绑定记录Y列；端口固定率分母为当月滚动双月新生数。');
    if (importButton) importButton.onclick = fixedTab === 'latest' && window.FixedPlanImporter ? window.FixedPlanImporter.open : () => alert('历史版块使用已确认的历史数据源，不在每日上传入口中更新。');
  }

  function setCourseToolbar() {
    const update = document.querySelector('.tools > span');
    if (update) update.textContent = `更新：${DATA.currentDate}`;
    const filter = document.getElementById('filterBtn');
    const ai = document.getElementById('aiBtn');
    const scope = document.getElementById('scopeBtn');
    const importButton = document.getElementById('importBtn');
    if (filter) filter.onclick = () => document.getElementById('filters')?.scrollIntoView({ behavior: 'smooth' });
    if (ai) ai.onclick = () => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' });
    if (scope) scope.onclick = () => alert('口径：先按课耗考核规则筛选，再保留核心 6 个 SS 小组。');
    if (importButton) importButton.onclick = () => alert('将每日原始表放入 D:/codex数据/课耗 后运行更新脚本即可。');
  }

  function renderFixedPlan() {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-dashboard-view="fixed"]')?.classList.add('active');
    const crumb = document.querySelector('.crumb span:last-child');
    if (crumb) crumb.textContent = '固定计划';
    setFixedToolbar();
    const content = document.getElementById('content');
    if (!content) return;
    content.innerHTML = fixedTab === 'latest' ? renderLatest() : fixedTab === 'm01' ? renderM01() : fixedTab === 'm01all' ? renderM01All() : fixedTab === 'user' ? renderUser() : renderTicket();
    bindFixedTabs();
    window.FixedPlanImporter?.bindPageActions();
  }

  window.addEventListener('fixed-plan-data-updated', event => {
    latestData = event.detail || window.FIXED_PLAN_LATEST_DATA;
    fixedTab = 'latest';
    renderFixedPlan();
  });

  const nav = document.querySelector('.nav');
  if (!nav) return;
  const existing = Array.from(nav.querySelectorAll('.nav-item'));
  existing.forEach((item,index) => { item.dataset.dashboardView = ['course','lp','subject'][index] || `view-${index}`; });
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.dataset.dashboardView = 'fixed';
  button.innerHTML = '<span class="nav-ico">▤</span><span class="nav-text">固定计划</span>';
  nav.appendChild(button);
  button.onclick = renderFixedPlan;
  if (existing[0]) existing[0].onclick = () => {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    existing[0].classList.add('active');
    const crumb = document.querySelector('.crumb span:last-child');
    if (crumb) crumb.textContent = TEXT.nav1;
    setCourseToolbar();
    renderMain();
  };
})();
