(function () {
  const history = window.COURSE_HISTORY_DATA;
  const dailyRender = window.renderMain;
  if (!history || typeof dailyRender !== 'function') return;

  let project = 'daily';
  let lifecycleMetric = 'high_rate';
  const distColors = ['#168a5b', '#5fba7d', '#d8c85c', '#efb256', '#e78155', '#c94f4f'];
  const distLabels = ['15节及以上', '12-14节', '10-11节', '8-9节', '1-7节', '0节'];

  const pctH = (value, digits = 1) => value == null ? '-' : `${(value * 100).toFixed(digits)}%`;
  const numH = (value, digits = 2) => value == null ? '-' : Number(value).toFixed(digits);
  const ppH = value => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}pp`;
  const monthLabel = value => `${value.slice(0, 2)}.${value.slice(2)}`;

  function projectTabs() {
    return `<div class="course-project-tabs" role="tablist" aria-label="课耗运营子项目">
      <button class="course-project-tab ${project === 'daily' ? 'active' : ''}" data-course-project="daily">每日数据更新</button>
      <button class="course-project-tab ${project === 'history' ? 'active' : ''}" data-course-project="history">历史数据分析</button>
    </div>`;
  }

  function bindProjectTabs() {
    document.querySelectorAll('[data-course-project]').forEach(button => {
      button.onclick = () => {
        project = button.dataset.courseProject;
        renderMain();
      };
    });
  }

  function restoreDailyToolbar() {
    const update = document.querySelector('.tools > span');
    if (update) update.textContent = `更新：${DATA.currentDate}`;
    const filter = document.getElementById('filterBtn');
    const ai = document.getElementById('aiBtn');
    const scope = document.getElementById('scopeBtn');
    const importButton = document.getElementById('importBtn');
    if (filter) filter.onclick = () => document.getElementById('filters')?.scrollIntoView({ behavior: 'smooth' });
    if (ai) ai.onclick = () => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' });
    if (scope) scope.onclick = () => alert('日常口径：先按课耗考核规则筛选，再保留核心6个SS小组；高课耗按月进度计算。');
    if (importButton) importButton.onclick = () => alert('将每日原始表放入 D:/codex数据/课耗 后运行更新脚本即可。');
  }

  function setHistoryToolbar() {
    const update = document.querySelector('.tools > span');
    if (update) update.textContent = '分析范围：2025-01 至 2026-08';
    const filter = document.getElementById('filterBtn');
    const ai = document.getElementById('aiBtn');
    const scope = document.getElementById('scopeBtn');
    const importButton = document.getElementById('importBtn');
    if (filter) filter.onclick = () => document.getElementById('lifecycleAnalysis')?.scrollIntoView({ behavior: 'smooth' });
    if (ai) ai.onclick = () => document.getElementById('historyActions')?.scrollIntoView({ behavior: 'smooth' });
    if (scope) scope.onclick = () => alert('生命周期口径：M1为首单次月；M12+单格汇总月差大于12个月的可观测记录，底部均值每个非空cohort只按该cohort学员数计一次。同月同学员重复记录的完课量求和、达标取最大值；未来月份显示“-”且不参与均值。');
    if (importButton) importButton.onclick = () => alert('数据源：付费明细.xlsx、25年1月-26年8月完课量数据汇总.xlsx。当前历史数据已补入2501-2608共20个月观察值。');
  }

  function distributionChart() {
    const w = 1080, h = 330, left = 42, right = 14, top = 18, bottom = 42;
    const plotH = h - top - bottom;
    const step = (w - left - right) / history.months.length;
    const barW = Math.max(22, step * .62);
    let bars = '';
    history.months.forEach((month, i) => {
      let cursor = top + plotH;
      [...history.distribution.buckets].map((bucket, b) => ({ bucket, b })).reverse().forEach(({ bucket, b }) => {
        const value = bucket.values[i] || 0;
        const height = value * plotH;
        cursor -= height;
        const x = left + i * step + (step - barW) / 2;
        const textColor = b < 2 ? '#ffffff' : '#172033';
        bars += `<rect x="${x}" y="${cursor}" width="${barW}" height="${Math.max(height, .5)}" fill="${distColors[b]}"><title>${month} ${distLabels[b]}: ${pctH(value)}</title></rect>`;
        if (height >= 11) bars += `<text x="${x + barW / 2}" y="${cursor + height / 2 + 3}" text-anchor="middle" fill="${textColor}" font-size="8" font-weight="700">${(value * 100).toFixed(0)}%</text>`;
      });
      bars += `<text x="${left + i * step + step / 2}" y="${h - 15}" text-anchor="middle" fill="#667085" font-size="10">${monthLabel(month)}</text>`;
    });
    const grid = [0, .25, .5, .75, 1].map(v => {
      const y = top + plotH * (1 - v);
      return `<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="#e4e8ee"/><text x="4" y="${y+4}" fill="#667085" font-size="10">${pctH(v,0)}</text>`;
    }).join('');
    return `<div class="history-chart-scroll"><svg class="history-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="不同课耗区间占比">${grid}${bars}</svg></div>
      <div class="history-legend">${history.distribution.buckets.map((bucket, i) => `<span><i style="background:${distColors[i]}"></i>${distLabels[i]}</span>`).join('')}</div>`;
  }

  function completionChart() {
    const rows25 = history.monthly_summary.filter(row => row.month >= '2501' && row.month <= '2508');
    const rows26 = history.monthly_summary.filter(row => row.month >= '2601' && row.month <= '2608');
    const w = 920, h = 330, left = 44, right = 14, top = 30, bottom = 44;
    const max = 14, plotH = h - top - bottom, step = (w - left - right) / 8, barW = 34, gap = 5;
    const y = value => top + (max - value) * plotH / max;
    const grid = [0, 4, 8, 12, 14].map(v => `<line x1="${left}" y1="${y(v)}" x2="${w-right}" y2="${y(v)}" stroke="#e4e8ee"/><text x="8" y="${y(v)+4}" fill="#667085" font-size="10">${v}</text>`).join('');
    const bars = rows25.map((row25, i) => {
      const row26 = rows26[i];
      const center = left + i * step + step / 2;
      const x25 = center - barW - gap / 2;
      const x26 = center + gap / 2;
      const bar = (row, x, fill) => `<rect x="${x}" y="${y(row.avg_completion)}" width="${barW}" height="${h-bottom-y(row.avg_completion)}" rx="2" fill="${fill}"><title>${row.month}: ${numH(row.avg_completion)}节</title></rect><text x="${x + barW / 2}" y="${y(row.avg_completion) - 6}" text-anchor="middle" fill="#172033" font-size="10" font-weight="700">${numH(row.avg_completion)}</text>`;
      return `${bar(row25, x25, '#4169a1')}${bar(row26, x26, '#2f7f75')}<text x="${center}" y="${h-15}" text-anchor="middle" fill="#667085" font-size="10">${i + 1}月</text>`;
    }).join('');
    return `<div class="history-chart-scroll"><svg class="history-chart history-chart-compact" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="1-8月同期人均完课量">${grid}${bars}</svg></div><div class="history-legend"><span><i style="background:#4169a1"></i>2025同期</span><span><i style="background:#2f7f75"></i>2026同期</span></div>`;
  }

  function completionPeriodComparison() {
    const c = history.comparisons;
    const rows25 = history.monthly_summary.filter(row => row.month >= '2501' && row.month <= '2508');
    const rows26 = history.monthly_summary.filter(row => row.month >= '2601' && row.month <= '2608');
    const lift = c.avg_completion_2026_same_period - c.avg_completion_2025_jan_aug;
    const relativeLift = lift / c.avg_completion_2025_jan_aug;
    const betterMonths = rows26.map((row, i) => row.avg_completion > rows25[i].avg_completion ? `${i + 1}月` : null).filter(Boolean);
    const highLift = c.high_rate_2026_same_period - c.high_rate_2025_jan_aug;
    return `<div class="period-compare-grid"><article><span>2025年1-8月均值</span><b>${numH(c.avg_completion_2025_jan_aug)}节</b><p>同期高课耗达成率${pctH(c.high_rate_2025_jan_aug)}</p></article><article><span>2026年1-8月均值</span><b>${numH(c.avg_completion_2026_same_period)}节</b><p>同期高课耗达成率${pctH(c.high_rate_2026_same_period)}</p></article><article class="period-compare-result"><span>同期变化</span><b>+${numH(lift)}节 / +${(relativeLift * 100).toFixed(1)}%</b><p>${betterMonths.join('、')}共${betterMonths.length}/8个月高于去年同期；高课耗率提升${ppH(highLift)}，明显快于真实课量。</p></article></div>`;
  }

  function packageChart() {
    const rows = history.monthly_summary;
    const w = 920, h = 255, left = 40, right = 12, top = 18, bottom = 38;
    const x = i => left + i * (w - left - right) / (rows.length - 1);
    const y = v => top + (1 - v) * (h - top - bottom);
    const line = key => rows.map((row, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(row[key]).toFixed(1)}`).join(' ');
    const grid = [.25, .5, .75, 1].map(v => `<line x1="${left}" y1="${y(v)}" x2="${w-right}" y2="${y(v)}" stroke="#e4e8ee"/><text x="2" y="${y(v)+4}" fill="#667085" font-size="10">${pctH(v,0)}</text>`).join('');
    const labels = rows.map((row, i) => (i % 2 === 0 || i === rows.length - 1) ? `<text x="${x(i)}" y="${h-12}" text-anchor="middle" fill="#667085" font-size="10">${monthLabel(row.month)}</text>` : '').join('');
    return `<svg class="history-chart" style="height:255px;min-width:820px" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}<path d="${line('package_15_share')}" fill="none" stroke="#b86614" stroke-width="3"/><path d="${line('low_consumption_package_share')}" fill="none" stroke="#2f7f75" stroke-width="3"/>${labels}</svg>
      <div class="history-legend"><span><i style="background:#b86614"></i>15节套餐</span><span><i style="background:#2f7f75"></i>12节及以下套餐</span></div>`;
  }

  function heatColor(value, metric) {
    if (value == null) return '';
    const normalized = metric === 'high_rate' ? Math.max(0, Math.min(1, (value - .4) / .5)) : Math.max(0, Math.min(1, (value - 8) / 9));
    const low = [239, 171, 164], mid = [244, 211, 118], high = [101, 185, 143];
    const start = normalized <= .5 ? low : mid;
    const end = normalized <= .5 ? mid : high;
    const ratio = normalized <= .5 ? normalized * 2 : (normalized - .5) * 2;
    const rgb = start.map((channel, index) => Math.round(channel + (end[index] - channel) * ratio));
    return `rgb(${rgb.join(',')})`;
  }

  function weightedLifecycle(metric, yearPrefix = '') {
    const metricRows = history.lifecycle[metric];
    const cohortRows = history.lifecycle.matched_counts;
    return history.lifecycle.columns.map((_, columnIndex) => {
      let numerator = 0, denominator = 0;
      metricRows.forEach((row, rowIndex) => {
        const value = row.values[columnIndex];
        if ((!yearPrefix || row.cohort.startsWith(yearPrefix)) && value != null) {
          const cohortStudents = cohortRows[rowIndex].cohort_students;
          numerator += value * cohortStudents;
          denominator += cohortStudents;
        }
      });
      return { value: denominator ? numerator / denominator : null, count: denominator };
    });
  }

  function weightedLifecycleOverall(metric, yearPrefix = '') {
    const stages = weightedLifecycle(metric, yearPrefix);
    const numerator = stages.reduce((sum, stage) => sum + (stage.value == null ? 0 : stage.value * stage.count), 0);
    const denominator = stages.reduce((sum, stage) => sum + stage.count, 0);
    return { value: denominator ? numerator / denominator : null, count: denominator };
  }

  function lifecycleMonthSnapshot(observationMonth, metric) {
    const metricRows = history.lifecycle[metric];
    const countRows = history.lifecycle.matched_counts;
    const findRow = (rows, cohort) => rows.find(row => row.cohort === cohort);
    const year = Number(observationMonth.slice(0, 2));
    const month = Number(observationMonth.slice(2));
    return history.lifecycle.columns.slice(0, 12).map((stage, stageIndex) => {
      const totalMonths = year * 12 + month - stageIndex - 1;
      const cohortYear = Math.floor((totalMonths - 1) / 12);
      const cohortMonth = ((totalMonths - 1) % 12) + 1;
      const cohort = `${String(cohortYear).padStart(2, '0')}${String(cohortMonth).padStart(2, '0')}`;
      const row = findRow(metricRows, cohort);
      const countRow = findRow(countRows, cohort);
      return {
        stage,
        cohort,
        value: row ? row.values[stageIndex] : null,
        count: countRow ? countRow.values[stageIndex] : 0,
      };
    });
  }

  const rangeText = (values, formatter) => {
    const valid = values.filter(value => value != null);
    if (!valid.length) return '-';
    return `${formatter(Math.min(...valid))}-${formatter(Math.max(...valid)).replace('+', '')}`;
  };

  function lifecycleInsights() {
    const aug26 = lifecycleMonthSnapshot('2608', lifecycleMetric);
    const jul26 = lifecycleMonthSnapshot('2607', lifecycleMetric);
    const aug25 = lifecycleMonthSnapshot('2508', lifecycleMetric);
    const diff = (left, right, index) => left[index].value != null && right[index].value != null ? left[index].value - right[index].value : null;
    if (lifecycleMetric === 'high_rate') {
      const earlyYoY = [0, 1, 2, 3, 4, 5, 6].map(index => diff(aug26, aug25, index));
      const earlyMoM = [0, 1, 2, 3, 4, 5, 6].map(index => diff(aug26, jul26, index));
      const lateStages = [9, 10, 11].map(index => `${aug26[index].stage}${pctH(aug26[index].value)}`).join('、');
      return `<div class="lifecycle-analysis-grid"><article><span>8月新生启动明显走强</span><b>M1 ${pctH(aug26[0].value)}，环比${ppH(diff(aug26, jul26, 0))}</b><p>8月新增观察的2607 cohort在M1达${pctH(aug26[0].value)}，较7月2606 cohort高${ppH(diff(aug26, jul26, 0))}，较去年8月2507 cohort高${ppH(diff(aug26, aug25, 0))}；说明8月首月激活、排课承接比7月和去年同期都更强。</p></article><article><span>8月M2-M7全段抬升</span><b>同比提升${rangeText(earlyYoY, ppH)}</b><p>M2-M7分别为${pctH(aug26[1].value)}、${pctH(aug26[2].value)}、${pctH(aug26[3].value)}、${pctH(aug26[4].value)}、${pctH(aug26[5].value)}、${pctH(aug26[6].value)}；较7月同阶段整体提升${rangeText(earlyMoM, ppH)}，早期优势不是单点，而是从新生到M7持续扩散。</p></article><article><span>8月风险集中在后段老生</span><b>${lateStages}低于/贴近66%</b><p>8月M8为${pctH(aug26[7].value)}、M9为${pctH(aug26[8].value)}，但M10-M12仍在66%目标线附近或以下。固定计划只能在新生期完成，后段学员建议在SCRM按M10-M12与低课耗标签分组，下月由SS重点做预约恢复、断课召回和稳定时段维护。</p></article></div>`;
    }
    const earlyYoY = [0, 1, 2, 3].map(index => diff(aug26, aug25, index));
    const lateMoM = [8, 9, 10, 11].map(index => diff(aug26, jul26, index));
    const lateMin = Math.min(...lateMoM);
    const lateMax = Math.max(...lateMoM);
    return `<div class="lifecycle-analysis-grid"><article><span>8月M1课量拉升最明显</span><b>M1 ${numH(aug26[0].value)}节，环比+${numH(diff(aug26, jul26, 0))}节</b><p>2607 cohort首月人均${numH(aug26[0].value)}节，较7月2606 cohort提升${numH(diff(aug26, jul26, 0))}节，较去年8月2507 cohort提升${numH(diff(aug26, aug25, 0))}节；高课耗率同步走高，说明不是只靠套餐门槛，而是首月真实完课强度提高。</p></article><article><span>8月早期课量优势延续到M4</span><b>M1-M4同比+${rangeText(earlyYoY, value => numH(value))}节</b><p>8月M2为${numH(aug26[1].value)}节、M3为${numH(aug26[2].value)}节、M4为${numH(aug26[3].value)}节，均高于去年8月同生命周期；重点要把2607、2606、2605 cohort的强启动动作沉淀成标准化SOP。</p></article><article><span>8月后段课量仍有回落</span><b>M9-M12环比最低${numH(lateMin)}节，最高+${numH(lateMax)}节</b><p>8月M10-M12人均仅${numH(aug26[9].value)}、${numH(aug26[10].value)}、${numH(aug26[11].value)}节，虽高课耗率贴近目标，但真实课量低于早期阶段。建议对M9+学员建立“下月可上课时段+剩余课量+近两周预约”清单，由SS按优先级做召回和补约。</p></article></div>`;
  }

  function lifecycleTable() {
    const rows = history.lifecycle[lifecycleMetric];
    const metricLabel = lifecycleMetric === 'high_rate' ? '高课耗达成' : '人均课量';
    const formatter = lifecycleMetric === 'high_rate' ? value => pctH(value) : value => numH(value);
    const body = rows.map(row => `<tr><td>${row.cohort}</td>${row.values.map(value => value == null ? '<td class="is-missing">-</td>' : `<td style="background:${heatColor(value, lifecycleMetric)}"><b>${formatter(value)}</b></td>`).join('')}<td style="background:#eef2f7"><b>${formatter(row.overall)}</b></td></tr>`).join('');
    const stageAverage = weightedLifecycle(lifecycleMetric);
    const overallAverage = weightedLifecycleOverall(lifecycleMetric);
    const averageRow = `<tr class="lifecycle-average-row"><td>非空加权均值</td>${stageAverage.map(stage => `<td><b>${formatter(stage.value)}</b><small>n=${stage.count.toLocaleString('zh-CN')}</small></td>`).join('')}<td><b>${formatter(overallAverage.value)}</b><small>n=${overallAverage.count.toLocaleString('zh-CN')}</small></td></tr>`;
    return `<div class="heat-legend"><span>低</span><i></i><span>中</span><i></i><span>高</span></div><div class="lifecycle-wrap"><table class="lifecycle-table"><thead><tr><th>首单月</th>${history.lifecycle.columns.map(column => `<th>${column}</th>`).join('')}<th>可观测整体</th></tr></thead><tbody>${body}${averageRow}</tbody></table></div>
      <div class="lifecycle-note">${metricLabel}按首单 cohort 与生命周期阶段匹配。最后一行只纳入热力表中有值的 cohort：高课耗按各非空 cohort 的达成率×cohort 学员数加权，人均课量按各非空 cohort 的人均课量×cohort 学员数加权；“-”同时排除分子和分母。M1是首单次月；M12+每个非空 cohort 只按该 cohort 学员数计一次。</div>${lifecycleInsights()}`;
  }

  function lifecycleNodeAnalysis() {
    const high25 = weightedLifecycle('high_rate', '25');
    const high26 = weightedLifecycle('high_rate', '26');
    const avg25 = weightedLifecycle('avg_completion', '25');
    const avg26 = weightedLifecycle('avg_completion', '26');
    const highAll = weightedLifecycle('high_rate');
    const avgAll = weightedLifecycle('avg_completion');
    const highOverall = weightedLifecycleOverall('high_rate');
    const avgOverall = weightedLifecycleOverall('avg_completion');
    const stages = [
      ['M1-M2', '习惯建立', '固定计划覆盖、未来4周排课、首周未约与取消当日补位'],
      ['M3', '首个预警点', '检查未来14天预约、取消率和固定计划失效，形成风险学员池'],
      ['M4-M6', '重点防滑落', '连续两周低课耗、预约断档分因跟进，补约与改约必须闭环'],
      ['M7-M9', '老生唤醒', '结合家长反馈、可上课时段和历史偏好，优化固定时段并做阶段复盘'],
      ['M10-M12+', '续费联动', '联动剩余课量与续费窗口，按活跃度分层制定长期排课计划'],
    ];
    return `<section class="panel history-section lifecycle-node-panel"><div class="panel-head"><div><div class="panel-title">生命周期平均轨迹、衰减节点与运营动作</div><div class="panel-sub">平均轨迹与热力表最后一行一致，仅按各阶段非空 cohort 的学员数加权</div></div></div>
      <div class="panel-body"><div class="lifecycle-average-insights"><article><span>高课耗加权轨迹</span><b>M1 ${pctH(highAll[0].value)} → M12 ${pctH(highAll[11].value)}</b><p>M3为${pctH(highAll[2].value)}、M6为${pctH(highAll[5].value)}、M9为${pctH(highAll[8].value)}；M1到M12累计下降${((highAll[0].value-highAll[11].value)*100).toFixed(1)}pp，M1-M3是下降最快的阶段。</p></article><article><span>人均课量加权轨迹</span><b>M1 ${numH(avgAll[0].value)}节 → M12 ${numH(avgAll[11].value)}节</b><p>M3为${numH(avgAll[2].value)}节、M6为${numH(avgAll[5].value)}节、M9为${numH(avgAll[8].value)}节；M1到M12下降${numH(avgAll[0].value-avgAll[11].value)}节（${((avgAll[0].value-avgAll[11].value)/avgAll[0].value*100).toFixed(1)}%），M3-M6降幅最大。</p></article><article><span>非空观察单元均值</span><b>${pctH(highOverall.value)} / ${numH(avgOverall.value)}节</b><p>合计${highOverall.count.toLocaleString('zh-CN')}个 cohort-阶段加权样本；空白格不补0且不进入分母，因此反映的是已有数据 cohort 的实际表现。</p></article><article><span>M12+出现回升</span><b>${pctH(highAll[12].value)} / ${numH(avgAll[12].value)}节</b><p>较M12分别变化${ppH(highAll[12].value-highAll[11].value)}和${numH(avgAll[12].value-avgAll[11].value)}节；M12+每个非空 cohort 仅计一次，回升说明长期留存样本表现较稳定，但仍需结合样本规模解读。</p></article></div><div class="lifecycle-node-wrap"><table class="lifecycle-node-table"><thead><tr><th>指标</th><th>从哪里开始衰减</th><th>关键分节点</th><th>运营判断</th></tr></thead><tbody>
        <tr><td><b>高课耗占比</b></td><td><strong>2025：M1→M2</strong><br>${pctH(high25[0].value)}→${pctH(high25[1].value)}（-${((high25[0].value-high25[1].value)*100).toFixed(1)}pp）<br><strong>2026：M1→M2</strong><br>${pctH(high26[0].value)}→${pctH(high26[1].value)}（-${((high26[0].value-high26[1].value)*100).toFixed(1)}pp）</td><td><strong>M3首个预警：</strong>2025为${pctH(high25[2].value)}，2026为${pctH(high26[2].value)}<br><strong>M4-M6持续滑落：</strong>2026由${pctH(high26[3].value)}降至${pctH(high26[5].value)}<br><strong>M9后趋稳：</strong>加权均值由M9的${pctH(highAll[8].value)}到M12的${pctH(highAll[11].value)}</td><td>M1即开始监控未达标学员；M3结束前完成风险筛查；M4-M6专项防滑落；M7以后把断课召回和持续排课作为同一目标。</td></tr>
        <tr><td><b>人均课量</b></td><td><strong>2025：M1→M2</strong><br>${numH(avg25[0].value)}→${numH(avg25[1].value)}节（-${numH(avg25[0].value-avg25[1].value)}节）<br><strong>2026：M2→M3</strong><br>${numH(avg26[1].value)}→${numH(avg26[2].value)}节（-${numH(avg26[1].value-avg26[2].value)}节）</td><td><strong>M2是2026峰值：</strong>${numH(avg26[1].value)}节<br><strong>M3→M4明显断点：</strong>${numH(avg26[2].value)}→${numH(avg26[3].value)}节<br><strong>M6以后持续走低：</strong>全量M6为${numH(avgAll[5].value)}节、M9为${numH(avgAll[8].value)}节、M12为${numH(avgAll[11].value)}节</td><td>先用未来4周排课保证课量，再以M3为触发点干预预约断档；M4-M6追补约闭环；M7以后同时管理断课召回、剩余课量和续费节奏。</td></tr>
      </tbody></table></div>
      <div class="lifecycle-stage-grid">${stages.map(([month, title, action]) => `<article><span>${month}</span><b>${title}</b><p>${action}</p></article>`).join('')}</div>
      <div class="lifecycle-sample-warning"><b>解读提醒：</b>最后一行及本区分析直接按热力表非空格加权；空白 cohort 不进入分子和分母，M12+每个 cohort 只计一次。2026 M6仅覆盖已有该阶段数据的${high26[5].count.toLocaleString('zh-CN')}名学员，后段结论需随月份滚动复核。</div></div></section>`;
  }

  function highConsumptionDrivers() {
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const correlation = (left, right) => {
      const leftMean = mean(left);
      const rightMean = mean(right);
      const numerator = left.reduce((sum, value, i) => sum + (value - leftMean) * (right[i] - rightMean), 0);
      const leftVariance = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
      const rightVariance = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0);
      return numerator / Math.sqrt(leftVariance * rightVariance);
    };
    const samePeriod = values => ({ y25: mean(values.slice(0, 8)), y26: mean(values.slice(12, 20)) });
    const packages = Object.fromEntries(history.package_mix.series.map(series => [series.label, samePeriod(series.values)]));
    const distribution = Object.fromEntries(history.distribution.buckets.map(bucket => [bucket.label, samePeriod(bucket.values)]));
    const c = history.comparisons;
    const highLift = c.high_rate_2026_same_period - c.high_rate_2025_jan_aug;
    const avgLiftRate = (c.avg_completion_2026_same_period - c.avg_completion_2025_jan_aug) / c.avg_completion_2025_jan_aug;
    const completed12Lift = (distribution['>=15'].y26 + distribution['12<=x<15'].y26) - (distribution['>=15'].y25 + distribution['12<=x<15'].y25);
    const high25 = weightedLifecycle('high_rate', '25');
    const high26 = weightedLifecycle('high_rate', '26');
    const avg25 = weightedLifecycle('avg_completion', '25');
    const avg26 = weightedLifecycle('avg_completion', '26');
    const highStageLift = high26.slice(0, 6).map((stage, i) => stage.value - high25[i].value);
    const avgStageLift = avg26.slice(0, 6).map((stage, i) => stage.value - avg25[i].value);
    const rows25 = history.monthly_summary.filter(row => row.month >= '2501' && row.month <= '2508');
    const rows26 = history.monthly_summary.filter(row => row.month >= '2601' && row.month <= '2608');
    const betterHighMonths = rows26.map((row, i) => row.high_rate > rows25[i].high_rate ? `${i + 1}月` : null).filter(Boolean);
    const highDeltas = rows26.map((row, i) => row.high_rate - rows25[i].high_rate);
    const avgDeltas = rows26.map((row, i) => row.avg_completion - rows25[i].avg_completion);
    const packageDeltas = rows26.map((row, i) => row.package_12_share - rows25[i].package_12_share);
    const highAvgCorrelation = correlation(highDeltas, avgDeltas);
    const highPackageCorrelation = correlation(highDeltas, packageDeltas);
    return `<div class="driver-verdict"><span>综合判断</span><b>新生早期排课与激活质量提升是主因，套餐迁移是放大因素</b><p>2026年1-8月高课耗率提升${ppH(highLift)}，同期实际完成12节及以上占比提升${ppH(completed12Lift)}，两者方向和幅度接近；可比生命周期的人均课量也全面领先，更支持真实运营改善。</p></div>
      <div class="driver-evidence-list"><article class="is-positive"><span>主因 · 可比生命周期改善</span><b>M1-M6高课耗同比高${(Math.min(...highStageLift)*100).toFixed(1)}-${(Math.max(...highStageLift)*100).toFixed(1)}pp</b><p>更关键的是不受达标门槛影响的人均课量：2026 cohort M1-M6比2025高${Math.min(...avgStageLift).toFixed(2)}-${Math.max(...avgStageLift).toFixed(2)}节，M2提升${avgStageLift[1].toFixed(2)}节、M3提升${avgStageLift[2].toFixed(2)}节，说明新生排课、激活和早期承接质量更好。</p></article>
      <article class="is-primary"><span>核心验证 · 同期月度波动</span><b>高课耗变化与人均课量变化相关系数${highAvgCorrelation.toFixed(2)}</b><p>八个月同比变化中，高课耗与实际人均课量高度同向；与12节套餐占比变化的相关系数仅${highPackageCorrelation.toFixed(2)}。该检验仅有7个月，用于判断方向而非做因果估计；套餐迁移每月持续扩大，但高课耗2-4月仍同比下降，说明套餐变化不能单独解释结果。</p></article>
      <article class="is-structure"><span>结果验证 · 真实完课结构</span><b>完成12节及以上占比提升${ppH(completed12Lift)}</b><p>0课耗占比由${pctH(distribution['x=0'].y25)}降至${pctH(distribution['x=0'].y26)}；12-14节占比提升${ppH(distribution['12<=x<15'].y26 - distribution['12<=x<15'].y25)}，抵消15节以上下降${ppH(distribution['>=15'].y26 - distribution['>=15'].y25)}后，仍形成${ppH(completed12Lift)}的净增长，反映更多学员跨过了实际12节线。</p></article>
      <article class="is-risk"><span>放大因素与边界 · 套餐结构</span><b>12节套餐${pctH(packages['12'].y25)} → ${pctH(packages['12'].y26)}</b><p>门槛下降会放大达标率，可能解释高课耗率涨幅快于整体人均课量，也可能解释5月“达标率升、课量降”的背离。但当前套餐占比是月度汇总，未与学员达标结果逐人匹配，不能把它定为主因；${betterHighMonths.join('、')}共${betterHighMonths.length}/8个月高于去年，M3后防滑落仍是下一阶段重点。</p></article></div>`;
  }

  function historyActions() {
    const rows = [
      ['P0', 'M1-M3新生提频', '新生与首三月学员', '将固定计划覆盖、首周预约、次周补约拆成日/周动作；单独追踪M1-M3达标率与人均课量，避免只看全盘。', 'M1-M3达标率、人均课量、0课耗率'],
      ['P0', '达标率与实际课量双轨管理', '所有在读学员', '管理层看板同时保留“套餐门槛达标率”和“人均完课量/固定12节率”，防止套餐门槛下降掩盖真实运营效果。', '达标率、人均课量、固定12节率'],
      ['P1', 'M4-M8防滑落', '进入稳定期的学员', '在M4开始识别预约断档、连续两周低课耗和固定计划失效学员，按原因分池跟进。', 'M4-M8环比、断档率、补约完成率'],
      ['P1', '临界学员冲刺', '距套餐门槛1-2节学员', '月中开始滚动识别临界学员，优先完成补约与改约闭环，并按SS/LP/CC责任链复盘。', '临界转化率、取消改约率'],
      ['P1', 'M9+老生唤醒', 'M9及以后学员', '按M9-M12与M12+拆分老生池，结合续费节点、剩余课量和历史上课时段制定唤醒策略。', '唤醒率、恢复上课率、续费转化'],
      ['P2', '数据质量治理', '数据与运营团队', '修复2507空ID，并明确2603-2605重复记录的业务来源；在入仓层固化同月同学员聚合规则。', '空ID数、重复ID数、口径差异'],
    ];
    return `<section class="panel history-section" id="historyActions"><div class="panel-head"><div><div class="panel-title">下一步运营动作</div><div class="panel-sub">按优先级、目标人群、动作和复盘指标形成老板可追踪的执行清单</div></div></div><div class="table-wrap"><table class="action-table"><thead><tr><th>优先级</th><th>专项</th><th>目标人群</th><th>核心动作</th><th>复盘指标</th></tr></thead><tbody>${rows.map(row => `<tr><td><span class="tag ${row[0] === 'P0' ? 'tag-risk' : row[0] === 'P1' ? 'tag-warn' : 'tag-neutral'}">${row[0]}</span></td><td><b>${row[1]}</b></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function renderHistory() {
    const c = history.comparisons;
    const avgLift = c.avg_completion_2026_same_period - c.avg_completion_2025_jan_aug;
    const highLift = c.high_rate_2026_same_period - c.high_rate_2025_jan_aug;
    const packageLift = c.low_package_share_2026_same_period - c.low_package_share_2025_jan_aug;
    const content = document.getElementById('content');
    content.innerHTML = `${projectTabs()}
      <section class="history-hero"><div><div class="kicker">COURSE CONSUMPTION REVIEW</div><h1>课耗历史数据分析</h1><p class="subtitle">从月度结构、首单cohort生命周期与套餐门槛三层拆解2025-01至2026-08的课耗表现</p></div><div class="history-scope"><div class="history-scope-row"><span>首单cohort</span><b>2501-2607</b></div><div class="history-scope-row"><span>观察月份</span><b>2501-2608（20个月）</b></div><div class="history-scope-row"><span>生命周期</span><b>M1-M12 / M12+</b></div><div class="history-scope-row"><span>核心判断</span><b>真实课量提升 + 达标门槛结构变化</b></div></div></section>
      <section class="history-kpis"><div class="history-kpi"><div class="history-kpi-label"><span>2026人均完课量</span><span>1-8月同期</span></div><div class="history-kpi-value">${numH(c.avg_completion_2026_same_period)}</div><div class="history-kpi-meta">2025年1-8月为${numH(c.avg_completion_2025_jan_aug)}，同比提升${numH(avgLift)}节（${(avgLift/c.avg_completion_2025_jan_aug*100).toFixed(1)}%）</div></div><div class="history-kpi"><div class="history-kpi-label"><span>2026高课耗达成</span><span>1-8月同期</span></div><div class="history-kpi-value">${pctH(c.high_rate_2026_same_period)}</div><div class="history-kpi-meta">较2025年1-8月${pctH(c.high_rate_2025_jan_aug)}提升${ppH(highLift)}</div></div><div class="history-kpi"><div class="history-kpi-label"><span>低消套餐占比</span><span>1-8月同期</span></div><div class="history-kpi-value">${pctH(c.low_package_share_2026_same_period)}</div><div class="history-kpi-meta">较2025年1-8月${pctH(c.low_package_share_2025_jan_aug)}提升${ppH(packageLift)}</div></div><div class="history-kpi"><div class="history-kpi-label"><span>覆盖cohort学员</span><span>去重ID</span></div><div class="history-kpi-value">${history.diagnostics.paid_cohort_students.toLocaleString('zh-CN')}</div><div class="history-kpi-meta">付费明细X列首单日期在2501-2608范围内</div></div></section>
      <section class="panel history-section"><div class="panel-head"><div><div class="panel-title">不同课耗区间占比分析</div><div class="panel-sub">按每个月sheet的完课量分层，100%堆叠展示结构变化</div></div></div><div class="panel-body">${distributionChart()}</div></section>
      <section class="history-grid-2 history-section"><div class="panel"><div class="panel-head"><div><div class="panel-title">1-8月同期人均完课量</div><div class="panel-sub">同一月份并排比较2025与2026；柱顶展示具体课量</div></div></div><div class="panel-body">${completionChart()}${completionPeriodComparison()}</div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">趋势判断</div><div class="panel-sub">区分实际课量与达标门槛</div></div></div><div class="panel-body history-callouts"><div class="history-callout good"><b>同期实际课量小幅改善</b><p>2026年1-8月人均${numH(c.avg_completion_2026_same_period)}节，较2025同期${numH(c.avg_completion_2025_jan_aug)}节提升${numH(avgLift)}节（${(avgLift/c.avg_completion_2025_jan_aug*100).toFixed(1)}%）。1月、6月、7月、8月高于去年同期，2-5月仍有波动。</p></div><div class="history-callout"><b>新cohort早期质量更好</b><p>非空样本加权生命周期中，2026 cohort 的M1达标率${pctH(weightedLifecycle('high_rate','26')[0].value)}、人均${numH(weightedLifecycle('avg_completion','26')[0].value)}节，分别高于2025 cohort 的${pctH(weightedLifecycle('high_rate','25')[0].value)}和${numH(weightedLifecycle('avg_completion','25')[0].value)}节；M2-M6也保持领先。</p></div><div class="history-callout warn"><b>达标率涨幅仍大于实际课量</b><p>同期高课耗达成提升${ppH(highLift)}，而人均课量仅提升${(avgLift/c.avg_completion_2025_jan_aug*100).toFixed(1)}%。必须同步观察套餐门槛变化，不能把全部提升归因于运营。</p></div></div></div></section>
      <section class="panel history-section" id="lifecycleAnalysis"><div class="panel-head"><div><div class="panel-title">不同用户生命周期的课耗分布</div><div class="panel-sub">纵轴为首单月份，横轴为M1-M12+；红色偏低、黄色居中、绿色偏高</div></div><div class="history-metric-switch"><button class="${lifecycleMetric === 'high_rate' ? 'active' : ''}" data-lifecycle-metric="high_rate">高课耗达成</button><button class="${lifecycleMetric === 'avg_completion' ? 'active' : ''}" data-lifecycle-metric="avg_completion">人均课量</button></div></div><div class="panel-body">${lifecycleTable()}</div></section>
      ${lifecycleNodeAnalysis()}
      <section class="history-grid-2 history-section"><div class="panel"><div class="panel-head"><div><div class="panel-title">套餐结构变化（放大因素）</div><div class="panel-sub">港澳1-8月同期：用于解释门槛效应，不单独作为主因</div></div></div><div class="panel-body history-chart-scroll">${packageChart()}</div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">港澳26年高课耗占比为何高于25年</div><div class="panel-sub">同期61.3% vs 57.2%；主看真实课量与可比生命周期改善</div></div></div><div class="panel-body">${highConsumptionDrivers()}</div></div></section>
      <section class="panel history-section"><div class="panel-head"><div><div class="panel-title">老板汇报结论</div><div class="panel-sub">建议按“结果、主因、风险”三句话呈现</div></div></div><div class="panel-body driver-grid"><article class="driver-card"><span class="driver-tag">结果</span><h3>高课耗率提升4.1pp，实际完成12节以上同步提升3.3pp</h3><p>2026年1-8月高课耗率为<strong>${pctH(c.high_rate_2026_same_period)}</strong>，高于2025同期<strong>${pctH(c.high_rate_2025_jan_aug)}</strong>；0课耗占比下降1.3pp，真实完课结构也在改善。</p></article><article class="driver-card"><span class="driver-tag">主因</span><h3>2026新生早期排课和激活质量更好</h3><p>非空样本加权生命周期中，2026 cohort M1-M6高课耗与人均课量均高于2025 cohort；八个月高课耗同比变化与人均课量变化高度同向。</p></article><article class="driver-card"><span class="driver-tag">风险</span><h3>套餐迁移会放大达标率，老生断课仍未解决</h3><p>套餐结构是放大因素而非当前证据下的主因；非空样本加权高课耗到M9、M12为${pctH(weightedLifecycle('high_rate')[8].value)}和${pctH(weightedLifecycle('high_rate')[11].value)}，需重点治理生命周期中段的持续衰减。</p></article></div></section>
      ${historyActions()}
      <div class="history-quality"><b>数据质量与口径：</b>2507 sheet 有1,223条空ID记录，保留在月度总体图中但无法进入生命周期匹配；2603-2605共2,001条重复学员记录，生命周期按同月同学员聚合（完课量求和、达标取最大值）。付费明细与完课sheet的首付月份在有效匹配记录中无差异。</div>`;
    bindProjectTabs();
    document.querySelectorAll('[data-lifecycle-metric]').forEach(button => {
      button.onclick = () => { lifecycleMetric = button.dataset.lifecycleMetric; renderHistory(); };
    });
    setHistoryToolbar();
  }

  function renderCourseMain() {
    const crumb = document.querySelector('.crumb span:last-child');
    if (crumb) crumb.textContent = TEXT.nav1;
    if (project === 'history') {
      renderHistory();
      return;
    }
    dailyRender();
    document.getElementById('content')?.insertAdjacentHTML('afterbegin', projectTabs());
    bindProjectTabs();
    restoreDailyToolbar();
  }

  window.renderMain = renderCourseMain;
  renderCourseMain();
})();
