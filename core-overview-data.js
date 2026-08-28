window.LP_CORE_OVERVIEW_DATA = {
  asOf: "2026-08-28",
  period: "2026年8月",
  metrics: [
    { id: "upgrade", name: "升舱率", value: 0.209, yesterday: null, lastMonthSameDay: null, target: 0.27, source: "BI / 港澳LP看板 / 升舱率", note: "LP汇总行升舱率" },
    { id: "courseOverall", name: "课耗（整体预计完课率）", value: 0.7631, yesterday: null, lastMonthSameDay: null, target: 0.85, source: "BI / 港澳LP看板 / 课耗", note: "LP小组汇总行预计达标率" },
    { id: "courseNew", name: "课耗（新生预计完课率）", value: 0.8215, yesterday: null, lastMonthSameDay: null, target: 0.88, source: "BI / 港澳LP看板 / 课耗", note: "LP小组-新生课耗汇总行预计达标率" },
    { id: "fixedPlan", name: "固定计划绑定率", value: 0.4551, yesterday: null, lastMonthSameDay: null, target: 0.55, source: "BI / 港澳LP看板 / 固定计划", note: "LP小组汇总行固定占比" },
    { id: "iur", name: "IUR占比", value: 479 / 1023, yesterday: null, lastMonthSameDay: null, target: 0.40, source: "飞书 / HKLP2026学员管理表", note: "202606：V列非空数字479人 / 学员1023人" },
    { id: "groupRate", name: "建群率", target: null, source: "飞书 / HKLP2026学员管理表", note: "K列为WA、企微或微信计入已建群；分别按M0和M1学员数计算",
      segments: [
        { label: "M0 · 202608", value: (41 + 312 + 4) / 539, yesterday: null, lastMonthSameDay: null, target: 0.85 },
        { label: "M1 · 202607", value: (90 + 623 + 6) / 791, yesterday: null, lastMonthSameDay: null, target: 0.90 }
      ] }
  ],
  details: [
    {
      id: "upgrade",
      title: "升舱率",
      label: "LP小组",
      source: "BI / 港澳LP看板 / 升舱率",
      note: "环比上月同期差距暂未由BI表提供。",
      columns: [
        { key: "group", label: "LP小组", type: "group" },
        { key: "students", label: "学员数", type: "number" },
        { key: "upgrades", label: "升舱数", type: "number" },
        { key: "rate", label: "当前升舱率", type: "percent" },
        { key: "target", label: "升舱率目标", type: "percent" },
        { key: "orderGap", label: "目标单量差距", type: "number" },
        { key: "yesterdayOrders", label: "昨日升舱单量", type: "number" },
        { key: "lastMonthGap", label: "环比上月同期差距", type: "pp" }
      ],
      rows: [
        { group: "HK-GZLP01小组", students: 650, upgrades: 135, rate: 0.208, target: 0.27, orderGap: 8, yesterdayOrders: 4, lastMonthGap: null },
        { group: "HK-GZLP02小组", students: 372, upgrades: 79, rate: 0.212, target: 0.27, orderGap: 3, yesterdayOrders: 1, lastMonthGap: null },
        { group: "LP合计", students: 1022, upgrades: 214, rate: 0.209, target: 0.27, orderGap: 11, yesterdayOrders: 5, lastMonthGap: null, total: true }
      ]
    },
    {
      id: "courseOverall",
      title: "课耗 · 整体",
      label: "LP小组",
      source: "BI / 港澳LP看板 / LP小组",
      note: "过程性高课耗占比对应BI阶段达标率；人均课量对应BI人均课耗。",
      columns: [
        { key: "group", label: "LP小组", type: "group" },
        { key: "students", label: "考核学员数", type: "number" },
        { key: "target", label: "LP课耗标", type: "percent" },
        { key: "forecastRate", label: "预计完课率", type: "percent" },
        { key: "stageRate", label: "过程性高课耗占比", type: "percent" },
        { key: "avgLessons", label: "人均课量", type: "decimal" },
        { key: "goodStudents", label: "好学生数", type: "number" },
        { key: "goodRate", label: "好学生率", type: "percent" },
        { key: "activeStudents", label: "在读学员数", type: "number" },
        { key: "activeRate", label: "在读率", type: "percent" }
      ],
      rows: [
        { group: "HK-GZLP01小组", students: 2854, target: 0.85, forecastRate: 0.7554, stageRate: 0.6976, avgLessons: 13.6, goodStudents: 967, goodRate: 0.3388, activeStudents: 2493, activeRate: 0.8735 },
        { group: "HK-GZLP02小组", students: 1637, target: 0.85, forecastRate: 0.7764, stageRate: 0.7263, avgLessons: 13.7, goodStudents: 566, goodRate: 0.3458, activeStudents: 1454, activeRate: 0.8882 },
        { group: "LP合计", students: 4491, target: 0.85, forecastRate: 0.7631, stageRate: 0.7081, avgLessons: 13.6, goodStudents: 1533, goodRate: 0.3413, activeStudents: 3947, activeRate: 0.8789, total: true }
      ]
    },
    {
      id: "courseNew",
      title: "课耗 · 新生",
      label: "LP小组",
      source: "BI / 港澳LP看板 / LP小组-新生课耗",
      note: "过程性高课耗占比对应BI阶段达标率；人均课量对应BI人均课耗。",
      columns: [
        { key: "group", label: "LP小组", type: "group" },
        { key: "students", label: "考核学员数", type: "number" },
        { key: "target", label: "LP课耗标", type: "percent" },
        { key: "forecastRate", label: "预计完课率", type: "percent" },
        { key: "stageRate", label: "过程性高课耗占比", type: "percent" },
        { key: "avgLessons", label: "人均课量", type: "decimal" },
        { key: "goodStudents", label: "好学生数", type: "number" },
        { key: "goodRate", label: "好学生率", type: "percent" },
        { key: "activeStudents", label: "在读学员数", type: "number" },
        { key: "activeRate", label: "在读率", type: "percent" }
      ],
      rows: [
        { group: "HK-GZLP01小组", students: 1154, target: 0.85, forecastRate: 0.8154, stageRate: 0.7782, avgLessons: 14.9, goodStudents: 505, goodRate: 0.4376, activeStudents: 1057, activeRate: 0.9159 },
        { group: "HK-GZLP02小组", students: 656, target: 0.85, forecastRate: 0.8323, stageRate: 0.8049, avgLessons: 15.2, goodStudents: 289, goodRate: 0.4405, activeStudents: 611, activeRate: 0.9314 },
        { group: "LP合计", students: 1810, target: 0.85, forecastRate: 0.8215, stageRate: 0.7878, avgLessons: 15.0, goodStudents: 794, goodRate: 0.4387, activeStudents: 1668, activeRate: 0.9215, total: true }
      ]
    },
    {
      id: "fixedPlan",
      title: "固定计划绑定率",
      label: "LP小组",
      source: "BI / 港澳LP看板 / 固定计划",
      note: "考核学员数对应BI学员数；绑定固定计划学员数对应BI是否绑定。",
      columns: [
        { key: "group", label: "LP小组", type: "group" },
        { key: "students", label: "考核学员数", type: "number" },
        { key: "target", label: "固定计划目标", type: "percent" },
        { key: "boundStudents", label: "绑定固定计划学员数", type: "number" },
        { key: "bindingRate", label: "固定计划占比", type: "percent" },
        { key: "threeTeacherRate", label: "绑定外教超过3个占比", type: "percent" }
      ],
      rows: [
        { group: "HK-GZLP01小组", students: 797, target: 0.55, boundStudents: 376, bindingRate: 0.4718, threeTeacherRate: 0.1844 },
        { group: "HK-GZLP02小组", students: 451, target: 0.55, boundStudents: 192, bindingRate: 0.4257, threeTeacherRate: 0.1153 },
        { group: "LP合计", students: 1248, target: 0.55, boundStudents: 568, bindingRate: 0.4551, threeTeacherRate: 0.1595, total: true }
      ]
    }
  ]
};
