window.LP_CORE_OVERVIEW_DATA = {
  asOf: "2026-08-30",
  period: "2026年8月",
  metrics: [
    { id: "upgrade", name: "升舱率", value: 0.223, yesterday: null, lastMonthSameDay: null, target: 0.27, source: "BI / 港澳LP看板 / 升舱率", note: "LP汇总行升舱率" },
    { id: "courseOverall", name: "课耗（整体预计完课率）", value: 0.7989, yesterday: null, lastMonthSameDay: null, target: 0.85, source: "BI / 港澳LP看板 / 课耗", note: "LP小组汇总行预计达标率" },
    { id: "courseNew", name: "课耗（新生预计完课率）", value: 0.8547, yesterday: null, lastMonthSameDay: null, target: 0.88, source: "BI / 港澳LP看板 / 课耗", note: "LP小组-新生课耗汇总行预计达标率" },
    { id: "fixedPlan", name: "固定计划绑定率", value: 0.4598, yesterday: null, lastMonthSameDay: null, target: 0.55, source: "BI / 港澳LP看板 / 固定计划", note: "LP小组汇总行固定占比" },
    { id: "iur", name: "IUR占比", value: 485 / 1023, yesterday: null, lastMonthSameDay: null, target: 0.40, source: "飞书 / HKLP2026学员管理表", note: "202606：V列非空数字485人 / 学员1023人" },
    { id: "groupRate", name: "建群率", target: null, source: "飞书 / HKLP2026学员管理表", note: "K列为WA、企微或微信计入已建群；分别按M0和M1学员数计算",
      segments: [
        { label: "M0 · 202608", value: (43 + 341 + 4) / 562, yesterday: null, lastMonthSameDay: null, target: 0.85 },
        { label: "M1 · 202607", value: (88 + 626 + 6) / 791, yesterday: null, lastMonthSameDay: null, target: 0.90 }
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
        { group: "HK-GZLP01小组", students: 650, upgrades: 145, rate: 0.223, target: 0.27, orderGap: -2, yesterdayOrders: 7, lastMonthGap: null },
        { group: "HK-GZLP02小组", students: 372, upgrades: 83, rate: 0.223, target: 0.27, orderGap: -1, yesterdayOrders: 3, lastMonthGap: null },
        { group: "LP合计", students: 1022, upgrades: 228, rate: 0.223, target: 0.27, orderGap: -3, yesterdayOrders: 8, lastMonthGap: null, total: true }
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
        { group: "HK-GZLP01小组", students: 2854, target: 0.85, forecastRate: 0.7933, stageRate: 0.6868, avgLessons: 14.5, goodStudents: 1107, goodRate: 0.3879, activeStudents: 2566, activeRate: 0.8991 },
        { group: "HK-GZLP02小组", students: 1637, target: 0.85, forecastRate: 0.8088, stageRate: 0.7117, avgLessons: 14.6, goodStudents: 642, goodRate: 0.3922, activeStudents: 1477, activeRate: 0.9023 },
        { group: "LP合计", students: 4491, target: 0.85, forecastRate: 0.7989, stageRate: 0.6958, avgLessons: 14.6, goodStudents: 1749, goodRate: 0.3894, activeStudents: 4043, activeRate: 0.9002, total: true }
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
        { group: "HK-GZLP01小组", students: 1154, target: 0.85, forecastRate: 0.8501, stageRate: 0.7686, avgLessons: 15.9, goodStudents: 568, goodRate: 0.4922, activeStudents: 1073, activeRate: 0.9298 },
        { group: "HK-GZLP02小组", students: 656, target: 0.85, forecastRate: 0.8628, stageRate: 0.7896, avgLessons: 16.2, goodStudents: 328, goodRate: 0.5000, activeStudents: 615, activeRate: 0.9375 },
        { group: "LP合计", students: 1810, target: 0.85, forecastRate: 0.8547, stageRate: 0.7762, avgLessons: 16.0, goodStudents: 896, goodRate: 0.4950, activeStudents: 1688, activeRate: 0.9326, total: true }
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
        { group: "HK-GZLP01小组", students: 826, target: 0.55, boundStudents: 389, bindingRate: 0.4709, threeTeacherRate: 0.1913 },
        { group: "HK-GZLP02小组", students: 468, target: 0.55, boundStudents: 206, bindingRate: 0.4402, threeTeacherRate: 0.1282 },
        { group: "LP合计", students: 1294, target: 0.55, boundStudents: 595, bindingRate: 0.4598, threeTeacherRate: 0.1685, total: true }
      ]
    }
  ]
};
