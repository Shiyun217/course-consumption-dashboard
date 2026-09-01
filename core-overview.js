(function () {
  const overview = window.LP_CORE_OVERVIEW_DATA;
  if (!overview) return;

  const pct = value => value == null ? "--" : (value * 100).toFixed(2).replace(/\.00$/, "") + "%";
  const pp = value => value == null ? "待数据源" : (value >= 0 ? "+" : "") + (value * 100).toFixed(2).replace(/\.00$/, "") + "pp";
  const deltaClass = value => value == null ? "core-neutral" : value >= 0 ? "core-positive" : "core-negative";
  const progress = (value, target) => value == null || !target ? 0 : Math.min(value / target * 100, 100);

  function compare(label, value) {
    return '<div class="core-compare"><span>' + label + '</span><b class="' + deltaClass(value) + '">' + pp(value) + '</b></div>';
  }

  function segmentCard(segment) {
    const targetGap = segment.value == null ? null : segment.value - segment.target;
    const yesterdayDelta = segment.value == null || segment.yesterday == null ? null : segment.value - segment.yesterday;
    const monthDelta = segment.value == null || segment.lastMonthSameDay == null ? null : segment.value - segment.lastMonthSameDay;
    return '<div class="core-segment">' +
      '<div class="core-segment-label">' + segment.label + ' · 目标 ' + pct(segment.target) + '</div>' +
      '<div class="core-segment-value ' + (segment.value == null ? "core-neutral" : "") + '">' + pct(segment.value) + '</div>' +
      '<div class="core-segment-stats">' +
        '<div class="core-segment-meta"><span>较昨日</span><b class="' + deltaClass(yesterdayDelta) + '">' + pp(yesterdayDelta) + '</b></div>' +
        '<div class="core-segment-meta"><span>较上月同期</span><b class="' + deltaClass(monthDelta) + '">' + pp(monthDelta) + '</b></div>' +
        '<div class="core-segment-meta"><span>距目标</span><b class="' + deltaClass(targetGap) + '">' + pp(targetGap) + '</b></div>' +
      '</div>' +
      '<div class="core-progress"><span style="width:' + progress(segment.value, segment.target) + '%"></span></div></div>';
  }

  function metricCard(metric) {
    const isSegmented = Array.isArray(metric.segments);
    const targetGap = metric.value == null || metric.target == null ? null : metric.value - metric.target;
    const yesterdayDelta = metric.value == null || metric.yesterday == null ? null : metric.value - metric.yesterday;
    const monthDelta = metric.value == null || metric.lastMonthSameDay == null ? null : metric.value - metric.lastMonthSameDay;
    const hasValue = isSegmented ? metric.segments.some(item => item.value != null) : metric.value != null;
    const onTarget = isSegmented
      ? metric.segments.every(item => item.value != null && item.value >= item.target)
      : metric.value != null && metric.value >= metric.target;
    const body = isSegmented
      ? '<div class="core-segments">' + metric.segments.map(segmentCard).join("") + '</div>'
      : '<div class="core-value ' + (metric.value == null ? "is-empty" : "") + '">' + pct(metric.value) + '</div>' +
        '<div class="core-comparisons">' + compare("较昨日", yesterdayDelta) + compare("较上月同期", monthDelta) + compare("距目标", targetGap) + '</div>' +
        '<div class="core-progress"><span style="width:' + progress(metric.value, metric.target) + '%"></span></div>';
    return '<article class="core-card core-card--' + metric.id + " " + (hasValue ? "" : "is-missing") + " " + (onTarget ? "is-on-target" : "") + '">' +
      '<div class="core-card-head"><div class="core-card-title">' + metric.name + '</div><span class="core-card-target">' +
      (isSegmented ? "双周期" : "目标 " + pct(metric.target)) + '</span></div>' + body +
      '<div class="core-card-footer"><b>' + metric.source + '</b><span>' + metric.note + '</span></div></article>';
  }

  function detailValue(value, type) {
    if (value == null) return '<span class="core-detail-missing" title="BI数据源暂未提供">--</span>';
    if (type === "percent") return (value * 100).toFixed(2).replace(/\.00$/, "") + "%";
    if (type === "pp") return (value >= 0 ? "+" : "") + (value * 100).toFixed(2).replace(/\.00$/, "") + "pp";
    if (type === "number") return Number(value).toLocaleString("zh-CN");
    if (type === "decimal") return Number(value).toFixed(1);
    return String(value);
  }

  function detailSection(section, index) {
    const head = section.columns.map(column => '<th>' + column.label + '</th>').join("");
    const body = section.rows.map(row => '<tr class="' + (row.total ? "is-total" : "") + '">' +
      section.columns.map(column => '<td class="core-detail-cell--' + column.type + '">' +
        (column.type === "group" && !row.total
          ? '<span class="core-group-chip">' + detailValue(row[column.key], column.type) + '</span>'
          : detailValue(row[column.key], column.type)) + '</td>').join("") + '</tr>').join("");
    return '<section class="core-detail-section core-detail--' + section.id + '" id="detail-' + section.id + '">' +
      '<div class="core-detail-head"><div><span class="core-detail-index">' + String(index + 1).padStart(2, "0") + '</span>' +
      '<h2>' + section.title + '</h2><p>' + section.label + '</p></div><span class="core-detail-count">' +
      (section.rows.length - 1) + ' 条明细</span></div>' +
      '<div class="core-detail-table-wrap"><table class="core-detail-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="core-detail-foot"><b>' + section.source + '</b><span>' + section.note + '</span></div></section>';
  }

  function detailDashboard() {
    const details = overview.details || [];
    if (!details.length) return "";
    return '<section class="core-detail-dashboard"><div class="core-detail-title"><div><span>LP PERFORMANCE BREAKDOWN</span><h2>核心指标明细</h2></div>' +
      '<nav class="core-detail-nav" aria-label="LP核心指标明细">' + details.map(section => '<a href="#detail-' + section.id + '" class="core-detail-link core-detail-link--' + section.id + '">' + section.title + '</a>').join("") + '</nav></div>' +
      details.map(detailSection).join("") + '</section>';
  }

  function analysisDashboard() {
    const metric = id => overview.metrics.find(item => item.id === id);
    const detail = id => overview.details.find(item => item.id === id);
    const total = id => detail(id)?.rows.find(row => row.total);
    const row = (id, group) => detail(id)?.rows.find(item => item.group === group);
    const upgrade = metric("upgrade");
    const courseOverall = metric("courseOverall");
    const courseNew = metric("courseNew");
    const fixedPlan = metric("fixedPlan");
    const iur = metric("iur");
    const groupRate = metric("groupRate");
    const m0 = groupRate.segments[0];
    const m1 = groupRate.segments[1];
    const tracked = [upgrade, courseOverall, courseNew, fixedPlan, iur, m0, m1];
    const achieved = tracked.filter(item => item.value >= item.target).length;
    const near = tracked.filter(item => item.value < item.target && item.value >= item.target - 0.01).length;
    const largestGap = tracked.slice().sort((a, b) => (a.value - a.target) - (b.value - b.target))[0];
    const upgradeTotal = total("upgrade");
    const upgrade01 = row("upgrade", "HK-GZLP01小组");
    const upgrade02 = row("upgrade", "HK-GZLP02小组");
    const overall01 = row("courseOverall", "HK-GZLP01小组");
    const overall02 = row("courseOverall", "HK-GZLP02小组");
    const new01 = row("courseNew", "HK-GZLP01小组");
    const new02 = row("courseNew", "HK-GZLP02小组");
    const fixed01 = row("fixedPlan", "HK-GZLP01小组");
    const fixed02 = row("fixedPlan", "HK-GZLP02小组");
    const analysisCards = [
      '<article class="core-analysis-card is-growth"><span>增长转化</span><h3>升舱与固定计划均未达标</h3><p>升舱率<strong>' + pct(upgrade.value) + '</strong>，距27%目标' + pp(upgrade.value - upgrade.target) + '；固定计划<strong>' + pct(fixedPlan.value) + '</strong>，距55%目标' + pp(fixedPlan.value - fixedPlan.target) + '。BI阶段目标单量差距为' + upgradeTotal.orderGap + '单，固定计划以HK-GZLP02小组' + pct(fixed02.bindingRate) + '为主要短板。</p></article>',
      '<article class="core-analysis-card is-course"><span>课耗质量</span><h3>新生优于整体，存量学员承接偏弱</h3><p>整体预计完课率<strong>' + pct(courseOverall.value) + '</strong>，距目标' + pp(courseOverall.value - courseOverall.target) + '；新生为<strong>' + pct(courseNew.value) + '</strong>，距目标' + pp(courseNew.value - courseNew.target) + '。HK-GZLP01小组整体课耗' + pct(overall01.forecastRate) + '，低于02小组' + pct(overall02.forecastRate) + '，且承载' + overall01.students.toLocaleString("zh-CN") + '名考核学员，应优先改善。</p></article>',
      '<article class="core-analysis-card is-service"><span>用户承接</span><h3>IUR已达标，M0建群是最大缺口</h3><p>IUR为<strong>' + pct(iur.value) + '</strong>，高于40%目标' + pp(iur.value - iur.target) + '；M1建群率' + pct(m1.value) + '，仅差' + pp(m1.value - m1.target) + '。M0建群率只有<strong>' + pct(m0.value) + '</strong>，距85%目标' + pp(m0.value - m0.target) + '，是当前最优先的承接问题。</p></article>'
    ].join("");
    const actions = [
      ["P0", "补齐M0建群", "建立本月未建群名单，按LP分配到人；首付后24小时完成拉群，当日未完成的次日晨会逐人关闭。", "M0建群率 " + pct(m0.value) + " -> 85%"],
      ["P0", "继续提升升舱转化", "当前BI阶段目标单量差距：HK-GZLP01小组" + upgrade01.orderGap + "单、HK-GZLP02小组" + upgrade02.orderGap + "单；继续跟进高意向、临近升舱门槛及昨日未转化学员，冲刺27%月目标。", "升舱率 " + pct(upgrade.value) + " -> 27%"],
      ["P0", "提升整体课耗", "优先治理HK-GZLP01小组：按0课耗、预约断档、固定计划未绑定三类分池，补齐未来四周排课并做每日闭环。", "01小组预计完课率 " + pct(overall01.forecastRate) + " -> 85%"],
      ["P1", "补固定计划短板", "先抓HK-GZLP02小组，将高频上课时段转为固定计划；对未绑定学员逐一确认固定时段，并同步提升绑定3个以上外教的覆盖。", "02小组固定计划 " + pct(fixed02.bindingRate) + " -> 55%"],
      ["P1", "固化新生早期动作", "复用02小组新生阶段达标率" + pct(new02.stageRate) + "的有效做法，在01小组强化首周排课、次周补约和固定计划绑定。", "01小组新生预计完课率 " + pct(new01.forecastRate) + " -> 88%"],
      ["保持", "守住IUR和M1", "IUR继续按月检查有效记录覆盖；M1建群保持逐日清尾，避免临近90%目标时回落。", "IUR >= 40%，M1建群 >= 90%"]
    ];
    const actionRows = actions.map(action => '<div class="core-action-row"><span class="core-action-priority ' + (action[0] === "P0" ? "is-p0" : action[0] === "P1" ? "is-p1" : "is-hold") + '">' + action[0] + '</span><b>' + action[1] + '</b><p>' + action[2] + '</p><strong>' + action[3] + '</strong></div>').join("");
    return '<section class="core-analysis" id="lpAnalysis"><div class="core-analysis-head"><div><span>LP OPERATING REVIEW</span><h2>LP经营分析</h2><p>基于' + overview.asOf + '核心指标及小组明细</p></div><div class="core-analysis-status"><div><span>达标</span><b>' + achieved + ' / 7</b></div><div><span>接近目标</span><b>' + near + '项</b></div><div><span>最大缺口</span><b>' + pp(largestGap.value - largestGap.target) + '</b></div></div></div>' +
      '<div class="core-analysis-grid">' + analysisCards + '</div>' +
      '<div class="core-action-head"><div><span>ACTION PRIORITIES</span><h3>下一步动作</h3></div><p>先处理承接与转化，再改善课耗和固定计划</p></div>' +
      '<div class="core-action-list">' + actionRows + '</div></section>';
  }

  function setToolbar() {
    const update = document.querySelector(".tools > span");
    if (update) update.textContent = "数据截止：" + overview.asOf;
    const filter = document.getElementById("filterBtn");
    const ai = document.getElementById("aiBtn");
    const scope = document.getElementById("scopeBtn");
    const importButton = document.getElementById("importBtn");
    if (filter) filter.onclick = () => document.getElementById("coreMetrics")?.scrollIntoView({ behavior: "smooth" });
    if (ai) ai.onclick = () => document.getElementById("lpAnalysis")?.scrollIntoView({ behavior: "smooth" });
    if (scope) scope.onclick = () => alert("比较口径：较昨日 = 当前值 - 昨日值；较上月同期 = 当前值 - 上月同日值；距目标 = 当前值 - 8月目标。IUR取上两个月，建群率分别看本月M0与上月M1。");
    if (importButton) importButton.onclick = () => alert("LP看板读取BI平台及HKLP2026学员管理表。当前未登录的数据项保持空白，不使用估算值。");
  }

  function renderLpDashboard() {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelector('[data-dashboard-view="lp"]')?.classList.add("active");
    const crumb = document.querySelector(".crumb span:last-child");
    if (crumb) crumb.textContent = "LP 看板";
    setToolbar();
    document.getElementById("content").innerHTML =
      '<section class="core-hero"><div><div class="core-kicker">LP OPERATIONS COMMAND</div><h1>LP 看板</h1><p>升舱、课耗、固定计划、IUR 与建群效率集中监控</p></div>' +
      '<div class="core-date"><span>统计月</span><b>' + overview.period + '</b><span>数据截止 ' + overview.asOf + '</span></div></section>' +
      '<section class="core-grid" id="coreMetrics">' + overview.metrics.map(metricCard).join("") + '</section>' + detailDashboard() + analysisDashboard();
  }

  const nav = document.querySelector(".nav");
  if (!nav) return;
  const lpButton = document.querySelector('[data-dashboard-view="lp"]') || nav.querySelectorAll(".nav-item")[1];
  if (lpButton) {
    lpButton.dataset.dashboardView = "lp";
    lpButton.onclick = renderLpDashboard;
  }
  window.renderLpDashboard = renderLpDashboard;
})();
