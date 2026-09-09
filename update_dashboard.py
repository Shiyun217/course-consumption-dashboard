import argparse
import json
import math
import re
from calendar import monthrange
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import openpyxl


CORE_GROUPS = [
    "BJ-JWSS01小组",
    "BJ-JWSS02小组",
    "BJ-JWSS04小组",
    "BJ-JWSS07小组",
    "GZ-SS01小组",
    "GZ-SS04小组",
]
FORMULA_INCLUDED_GROUPS = [*CORE_GROUPS, "GZ-SS03小组"]
STAGE_TARGETS = [
    {"day": 11, "target": 0.27},
    {"day": 17, "target": 0.45},
    {"day": 24, "target": 0.55},
    {"day": 31, "target": 0.66},
]
HISTORICAL_DISTRIBUTION_MONTHS = [
    "2501", "2502", "2503", "2504", "2505", "2506", "2507", "2508", "2509", "2510",
    "2511", "2512", "2601", "2602", "2603", "2604", "2605", "2606", "2607", "2608",
]
HISTORICAL_DISTRIBUTION_BUCKETS = [
    {"label": ">=15", "values": [0.2982, 0.3395, 0.3999, 0.3743, 0.3741, 0.3611, 0.3999, 0.3837, 0.3628, 0.3322, 0.3119, 0.3267, 0.3306, 0.2516, 0.3321, 0.3091, 0.3176, 0.3230, 0.3542, 0.3498]},
    {"label": "12<=x<15", "values": [0.2349, 0.2244, 0.2292, 0.2450, 0.2475, 0.2530, 0.2402, 0.2423, 0.2713, 0.2737, 0.2861, 0.3002, 0.3118, 0.3038, 0.3250, 0.3329, 0.3250, 0.3372, 0.3317, 0.3365]},
    {"label": "10<=x<12", "values": [0.1258, 0.1107, 0.1050, 0.1069, 0.1040, 0.1106, 0.0987, 0.0937, 0.0985, 0.1018, 0.1009, 0.0992, 0.0904, 0.1058, 0.0940, 0.1063, 0.0970, 0.0988, 0.0840, 0.0815]},
    {"label": "8<=x<10", "values": [0.0722, 0.0655, 0.0488, 0.0547, 0.0519, 0.0519, 0.0473, 0.0462, 0.0567, 0.0561, 0.0574, 0.0527, 0.0502, 0.0615, 0.0465, 0.0506, 0.0480, 0.0452, 0.0430, 0.0418]},
    {"label": "0<x<8", "values": [0.1509, 0.1450, 0.1162, 0.1194, 0.1188, 0.1188, 0.1132, 0.1132, 0.1170, 0.1325, 0.1405, 0.1244, 0.1229, 0.1650, 0.1126, 0.1113, 0.1140, 0.1096, 0.1033, 0.0934]},
    {"label": "x=0", "values": [0.1180, 0.1152, 0.1011, 0.0890, 0.1040, 0.1040, 0.1000, 0.1210, 0.0930, 0.1047, 0.1030, 0.0960, 0.0940, 0.1122, 0.0890, 0.0830, 0.0910, 0.0900, 0.0830, 0.0970]},
]
HISTORICAL_AVG_COMPLETION = {
    "months": HISTORICAL_DISTRIBUTION_MONTHS,
    "values": [
        10.7334, 10.8909, 11.8686, 11.6095, 11.6787, 11.5761, 12.3370, 12.0261, 11.8916, 11.3197,
        11.0966, 11.4964, 11.6286, 10.4880, 11.6537, 11.2705, 11.4885, 11.8806, 12.7408, 12.6807,
    ],
}
LIFECYCLE_COLUMNS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12", "M12+", "overall"]
LIFECYCLE_PERFORMANCE = [
    {"month": "2501", "values": [0.5644, 0.5527, 0.5304, 0.4697, 0.4429, 0.4379, 0.4225, 0.4044, 0.3804, 0.3759, 0.3812, 0.3933, 0.4710, 0.4592]},
    {"month": "2502", "values": [0.7704, 0.6516, 0.5932, 0.5759, 0.5451, 0.5327, 0.5152, 0.4893, 0.4942, 0.4668, 0.4301, 0.4440, 0.5378, 0.5360]},
    {"month": "2503", "values": [0.8267, 0.7312, 0.7218, 0.6478, 0.6566, 0.6257, 0.5855, 0.5696, 0.5296, 0.5510, 0.5278, 0.5362, 0.6104, 0.6146]},
    {"month": "2504", "values": [0.7634, 0.7288, 0.6505, 0.6161, 0.5764, 0.5751, 0.5842, 0.5217, 0.5217, 0.5286, 0.5313, 0.4814, 0.5881, 0.5899]},
    {"month": "2505", "values": [0.8245, 0.7430, 0.6997, 0.6314, 0.6286, 0.5803, 0.6014, 0.5778, 0.5237, 0.5187, 0.5296, 0.5278, 0.5792, 0.5947]},
    {"month": "2506", "values": [0.7978, 0.7245, 0.6509, 0.5930, 0.5766, 0.5343, 0.5354, 0.5383, 0.5268, 0.5074, 0.5250, 0.5424, 0.5742, 0.5794]},
    {"month": "2507", "values": [0.8409, 0.7672, 0.6971, 0.6533, 0.6060, 0.5573, 0.5598, 0.5531, 0.5773, 0.5223, 0.4799, 0.5533, 0.6144, 0.6188]},
    {"month": "2508", "values": [0.8405, 0.7694, 0.7129, 0.6901, 0.6133, 0.5394, 0.5082, 0.5419, 0.4971, 0.4928, 0.4873, 0.5242, 0.5548, 0.5796]},
    {"month": "2509", "values": [0.8176, 0.7279, 0.7333, 0.6647, 0.6349, 0.5830, 0.5689, 0.5000, 0.5337, 0.5031, 0.5442, 0.4991, 0.5479, 0.5774]},
    {"month": "2510", "values": [0.8472, 0.7517, 0.6583, 0.6514, 0.6280, 0.6466, 0.5513, 0.4991, 0.4586, 0.4697, 0.4730, 0.5120, 0.5147, 0.5544]},
    {"month": "2511", "values": [0.8458, 0.8085, 0.6968, 0.6442, 0.6447, 0.5967, 0.5705, 0.5249, 0.4904, 0.4704, 0.4581, 0.4649, 0.4949, 0.5425]},
    {"month": "2512", "values": [0.8320, 0.7796, 0.7586, 0.6768, 0.6531, 0.6503, 0.6245, 0.5929, 0.5527, 0.5191, 0.5087, 0.5038, 0.5307, 0.5804]},
    {"month": "2601", "values": [0.8458, 0.8400, 0.7759, 0.7416, 0.7055, 0.6771, 0.6329, 0.6044, 0.6142, 0.5634, 0.5054, 0.5240, 0.5530, 0.6032]},
    {"month": "2602", "values": [0.7211, 0.7188, 0.6840, 0.6124, 0.5660, 0.5744, 0.5382, 0.4936, 0.4806, 0.4447, 0.4444, 0.3976, 0.4851, 0.5110]},
    {"month": "2603", "values": [0.8369, 0.8006, 0.7815, 0.7861, 0.7336, 0.7174, 0.6502, 0.6058, 0.5742, 0.5953, 0.6036, 0.5689, 0.5623, 0.6218]},
    {"month": "2604", "values": [0.8716, 0.8199, 0.7895, 0.7345, 0.7327, 0.6870, 0.6573, 0.5813, 0.5597, 0.5576, 0.5644, 0.5512, 0.5623, 0.6039]},
    {"month": "2605", "values": [0.8934, 0.8558, 0.7922, 0.7887, 0.7377, 0.7264, 0.6547, 0.6530, 0.6008, 0.5769, 0.5583, 0.5561, 0.5671, 0.6305]},
    {"month": "2606", "values": [0.8848, 0.8172, 0.7988, 0.7275, 0.7505, 0.7098, 0.6718, 0.6302, 0.6320, 0.5900, 0.5441, 0.5694, 0.5691, 0.6360]},
    {"month": "2607", "values": [0.9005, 0.8387, 0.8088, 0.7686, 0.7139, 0.7253, 0.6554, 0.6804, 0.6091, 0.6229, 0.6221, 0.5945, 0.6122, 0.6740]},
    {"month": "2608", "values": [None, 0.9132, 0.8577, 0.8306, 0.7900, 0.7500, 0.7309, 0.7025, 0.6786, 0.6579, 0.6395, 0.6387, 0.6275, 0.6863]},
]


DEFAULT_SOURCE = Path(
    "C:/Users/guoshiyun/Downloads/DS\u4efb\u52a1-\u6e2f\u6fb3SS\u670d\u52a1\u6807\u53ef\u89c1\u5ea6\u5b66\u5458\u660e\u7ec6_2026-07-26-\u7ed3\u679c.xlsx"
)
DEFAULT_SOURCE_DIR = Path("D:/codex\u6570\u636e/\u8bfe\u8017")
DEFAULT_FORMULA = Path("D:/\u8bfe\u8017\u76f8\u5173/\u8bfe\u8017\u516c\u5f0f.xlsx")
DEFAULT_FOLLOWUP = Path("D:/\u8bfe\u8017\u76f8\u5173/SS\u5b66\u5458\u8bfe\u8017\u8ddf\u8fdb\u8868-2026-7-26.xlsx")
DEFAULT_HISTORY = Path(__file__).with_name("history.json")
DEFAULT_OUTPUT = Path(__file__).with_name("ss-course-consumption-dashboard.html")
WORKBOOK_SEARCH_DIRS = [
    Path.home() / "Desktop",
    Path("D:/codex\u6570\u636e/\u8bfe\u8017"),
    Path("D:/\u8bfe\u8017\u76f8\u5173"),
]
TOKI_IMAGE = Path(__file__).with_name("assets") / "toki-assistant.png"


def clean_number(value, default=0):
    if value is None or value == "":
        return default
    try:
        if isinstance(value, str):
            value = value.strip().replace(",", "")
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_ratio(numerator, denominator):
    return numerator / denominator if denominator else 0


def round_float(value, digits=6):
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return round(value, digits)
    return value


def parse_report_date(source_path):
    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", source_path.name)
    if match:
        return datetime(*map(int, match.groups())).date() - timedelta(days=1)
    return datetime.now().date() - timedelta(days=1)


def discover_latest_source(source_dir):
    candidates = discover_source_candidates(source_dir)
    if not candidates:
        return DEFAULT_SOURCE
    return candidates[-1]


def discover_source_candidates(source_dir):
    if not source_dir.exists():
        return [DEFAULT_SOURCE] if DEFAULT_SOURCE.exists() else []
    candidates = [
        path for path in source_dir.glob("*.xlsx")
        if "SS" in path.name
        and "\u5b66\u5458\u660e\u7ec6" in path.name
        and re.search(r"\d{4}-\d{2}-\d{2}", path.name)
        and not path.name.startswith("~$")
    ]
    return sorted(candidates, key=lambda path: (parse_report_date(path), path.stat().st_mtime, path.name))


def discover_latest_workbook(name_parts, fallback=None, search_dirs=None):
    search_dirs = search_dirs or WORKBOOK_SEARCH_DIRS
    candidates = []
    for folder in search_dirs:
        if not folder.exists():
            continue
        for path in folder.glob("*.xlsx"):
            if path.name.startswith("~$"):
                continue
            if all(part in path.name for part in name_parts):
                candidates.append(path)
    if not candidates:
        return fallback
    return max(candidates, key=lambda path: path.stat().st_mtime)


def discover_latest_followup():
    candidates = []
    for folder in WORKBOOK_SEARCH_DIRS:
        if not folder.exists():
            continue
        candidates.extend([
            path for path in folder.glob("*.xlsx")
            if path.name.startswith("SS") and not path.name.startswith("~$")
        ])
    return max(candidates, key=lambda path: path.stat().st_mtime) if candidates else DEFAULT_FOLLOWUP


def discover_latest_war_report():
    candidates = []
    report_label = "课耗战报"
    for folder in WORKBOOK_SEARCH_DIRS:
        if not folder.exists():
            continue
        candidates.extend([
            path for path in folder.glob("*.xlsx")
            if path.name.startswith(report_label) and not path.name.startswith("~$")
        ])
    return max(candidates, key=lambda path: path.stat().st_mtime) if candidates else None


def load_history(path):
    if not path.exists():
        return {"groups": [], "people": [], "overall": []}
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    data.setdefault("groups", [])
    data.setdefault("people", [])
    data.setdefault("overall", [])
    return data


def save_history(path, history):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(history, file, ensure_ascii=False, indent=2)


def upsert_history(history, kind, rows, date_text, preserve_existing=False):
    if kind == "groups":
        key_fields = ["date", "group"]
    elif kind == "people":
        key_fields = ["date", "ss"]
    else:
        key_fields = ["date"]
    existing = {
        tuple(row.get(field) for field in key_fields): index
        for index, row in enumerate(history[kind])
    }
    for row in rows:
        record = {**row} if date_text is None else {"date": date_text, **row}
        key = tuple(record.get(field) for field in key_fields)
        if key in existing:
            if preserve_existing:
                current = history[kind][existing[key]]
                history[kind][existing[key]] = {
                    **record,
                    **{field: value for field, value in current.items() if value is not None},
                }
                continue
            if kind == "overall":
                history[kind][existing[key]] = {**history[kind][existing[key]], **record}
            else:
                history[kind][existing[key]] = record
        else:
            history[kind].append(record)
            existing[key] = len(history[kind]) - 1
    history[kind].sort(key=lambda item: (item.get("date", ""), item.get("group", ""), item.get("ss", "")))


def merge_overall_history_by_date(history):
    merged = {}
    for row in history.get("overall", []):
        row_date = row.get("date")
        if not row_date:
            continue
        merged[row_date] = {**merged.get(row_date, {}), **row}
    history["overall"] = sorted(merged.values(), key=lambda item: item.get("date", ""))


def optional_number(value):
    if value is None:
        return None
    if isinstance(value, str) and value.strip() in {"", "/", "-"}:
        return None
    return clean_number(value)


def seed_history_from_followup(path, history):
    if not path.exists():
        return
    workbook = openpyxl.load_workbook(path, read_only=False, data_only=True)
    group_sheet = workbook["SS\u5c0f\u7ec4"]
    current_label = str(group_sheet["I4"].value)
    previous_label = str(group_sheet["H4"].value)
    year = 2026

    def label_to_date(label):
        month, day = str(label).split(".")
        return f"{year}-{int(month):02d}-{int(float(day)):02d}"

    previous_date = label_to_date(previous_label)
    current_date = label_to_date(current_label)
    trusted_dates = {previous_date, current_date}
    history["groups"] = [
        row for row in history["groups"]
        if not (row.get("date") in trusted_dates and row.get("group") in CORE_GROUPS)
    ]
    history["people"] = [
        row for row in history["people"]
        if not (row.get("date") in trusted_dates and row.get("group") in CORE_GROUPS)
    ]

    current_group_counts = {}
    for row in range(4, 10):
        group = group_sheet.cell(row, 1).value
        if group in CORE_GROUPS:
            current_group_counts[group] = {
                "assessed": int(clean_number(group_sheet.cell(row, 2).value)),
                "qualified": int(clean_number(group_sheet.cell(row, 3).value)),
            }

    previous_group_rows = []
    current_group_rows = []
    for row in range(5, 11):
        group = group_sheet.cell(row, 7).value
        if group not in CORE_GROUPS:
            continue
        total = current_group_counts[group]["assessed"]
        current_ok = current_group_counts[group]["qualified"]
        current_rate = clean_number(group_sheet.cell(row, 9).value)
        previous_rate = clean_number(group_sheet.cell(row, 8).value)
        previous_ok = round(total * previous_rate)
        previous_group_rows.append(
            {"group": group, "assessed": total, "qualified": previous_ok, "rate": round_float(previous_rate)}
        )
        current_group_rows.append(
            {"group": group, "assessed": total, "qualified": current_ok, "rate": round_float(current_rate)}
        )
    upsert_history(history, "groups", previous_group_rows, previous_date)
    upsert_history(history, "groups", current_group_rows, current_date)

    person_sheet = workbook["SS\u4e2a\u4eba"] if "SS\u4e2a\u4eba" in workbook.sheetnames else workbook["ss\u660e\u7ec6"]
    previous_person_rows = []
    current_person_rows = []

    if person_sheet.title == "SS\u4e2a\u4eba":
        row_iter = person_sheet.iter_rows(min_row=4, min_col=5, max_col=14, values_only=True)
        for row in row_iter:
            group, ss = row[0], row[1]
            if not ss or group not in CORE_GROUPS:
                continue
            total = int(clean_number(row[2]))
            current_ok = int(clean_number(row[3]))
            current_rate = optional_number(row[5])
            previous_rate = optional_number(row[6])
            if current_rate is None:
                continue
            if previous_rate is not None:
                previous_person_rows.append(
                    {"group": group, "ss": ss, "assessed": total, "qualified": round(total * previous_rate), "rate": round_float(previous_rate)}
                )
            current_person_rows.append(
                {"group": group, "ss": ss, "assessed": total, "qualified": current_ok, "rate": round_float(current_rate)}
            )
    else:
        for row in person_sheet.iter_rows(min_row=2, values_only=True):
            if not row or not row[1] or row[0] not in CORE_GROUPS:
                continue
            group, ss = row[0], row[1]
            total = int(clean_number(row[2]))
            current_ok = int(clean_number(row[3]))
            current_rate = optional_number(row[5])
            previous_rate = optional_number(row[6])
            if current_rate is None:
                continue
            if previous_rate is not None:
                previous_person_rows.append(
                    {"group": group, "ss": ss, "assessed": total, "qualified": round(total * previous_rate), "rate": round_float(previous_rate)}
                )
            current_person_rows.append(
                {"group": group, "ss": ss, "assessed": total, "qualified": current_ok, "rate": round_float(current_rate)}
            )

    upsert_history(history, "people", previous_person_rows, previous_date)
    upsert_history(history, "people", current_person_rows, current_date)
    if "\u5b66\u5458\u660e\u7ec6" in workbook.sheetnames:
        detail_sheet = workbook["\u5b66\u5458\u660e\u7ec6"]
        report_dt = datetime.strptime(current_date, "%Y-%m-%d").date()
        month_progress = report_dt.day / monthrange(report_dt.year, report_dt.month)[1]
        core_count = 0
        core_completed_total = 0
        process_high_count = 0
        good_student_denominator = 0
        good_student_count = 0
        blank_streak = 0
        for row in detail_sheet.iter_rows(min_row=2, max_col=13, values_only=True):
            student_id = row[0]
            if student_id is None:
                blank_streak += 1
                if blank_streak >= 100:
                    break
                continue
            blank_streak = 0
            group = row[3]
            low_min = clean_number(row[6])
            completed = clean_number(row[8])
            target = 12 if low_min == 0 else low_min
            if group in FORMULA_INCLUDED_GROUPS:
                good_student_denominator += 1
                good_student_count += 1 if completed >= 15 else 0
            if group not in CORE_GROUPS:
                continue
            core_count += 1
            core_completed_total += completed
            process_high_count += 1 if completed >= target * month_progress else 0
        if core_count:
            upsert_history(history, "overall", [{
                "completion_rate": round_float(safe_ratio(
                    sum(row["qualified"] for row in current_group_rows),
                    sum(row["assessed"] for row in current_group_rows),
                )),
                "avg_consumption": round_float(core_completed_total / core_count, 4),
                "process_high_ratio": round_float(safe_ratio(process_high_count, core_count), 6),
                "good_student_rate": round_float(safe_ratio(good_student_count, good_student_denominator), 6),
            }], current_date)
    workbook.close()


def read_formula_overall_metrics(path):
    if not path or not path.exists():
        return None
    workbook = openpyxl.load_workbook(path, read_only=False, data_only=True)
    sheet = workbook["\u8bfe\u8017\u6218\u62a5"]
    metrics = {
        "avg_consumption": round_float(clean_number(sheet["F10"].value), 4),
        "process_high_ratio": round_float(clean_number(sheet["H10"].value), 6),
    }
    workbook.close()
    return metrics


def read_war_report_overall_metrics(path):
    if not path or not path.exists():
        return None
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    report_sheet = "\u8bfe\u8017\u6218\u62a5"
    overall_label = "\u6e2f\u6fb3\u6574\u4f53"
    if report_sheet not in workbook.sheetnames:
        workbook.close()
        return None
    sheet = workbook[report_sheet]
    metrics = None
    for row in sheet.iter_rows(min_row=1, max_col=14, values_only=True):
        if len(row) > 1 and row[1] == overall_label:
            metrics = {
                "avg_consumption": round_float(clean_number(row[5]), 4),
                "good_student_rate": round_float(clean_number(row[9]), 6),
                "process_high_ratio": round_float(clean_number(row[11]), 6),
            }
            break
    workbook.close()
    return metrics


def read_source_summary(path, report_date):
    workbook = openpyxl.load_workbook(path, read_only=False, data_only=True)
    sheet = workbook.active
    headers = [cell.value for cell in next(sheet.iter_rows(min_row=1, max_row=1, max_col=64))]
    normalized_headers = [str(value).strip() if value is not None else "" for value in headers]
    index = {name: position for position, name in enumerate(normalized_headers)}

    required = [
        "学员id",
        "首付时间",
        "当前SS",
        "当前SS小组",
        "当前套餐低消次数要求",
        "月初剩余课时量",
        "当月完课量",
        "当月已约未上课次",
    ]
    missing = [name for name in required if name not in index]
    if missing:
        raise ValueError(f"数据源缺少字段: {', '.join(missing)}")

    group_stats = {group: {"group": group, "assessed": 0, "qualified": 0} for group in CORE_GROUPS}
    person_stats = defaultdict(lambda: {"assessed": 0, "qualified": 0, "group": "", "ss": ""})
    eligible_total = 0
    good_student_denominator = 0
    good_student_count = 0
    core_completed_total = 0
    process_high_count = 0
    zero_consumption_count = 0
    days_in_month = monthrange(report_date.year, report_date.month)[1]
    month_progress = report_date.day / days_in_month
    excluded_core = defaultdict(int)

    for row in sheet.iter_rows(min_row=2, max_col=64, values_only=True):
        student_id = row[index["学员id"]]
        if student_id is None:
            continue
        low_min = clean_number(row[index["当前套餐低消次数要求"]])
        month_begin_left = clean_number(row[index["月初剩余课时量"]])
        is_assessed = (low_min == 0 and month_begin_left >= 12) or (low_min > 0 and month_begin_left >= low_min)
        if not is_assessed:
            continue

        eligible_total += 1
        group = row[index["当前SS小组"]]
        completed = clean_number(row[index["当月完课量"]])
        if group in FORMULA_INCLUDED_GROUPS:
            good_student_denominator += 1
            good_student_count += 1 if completed >= 15 else 0

        if group not in CORE_GROUPS:
            excluded_core[group or "空白"] += 1
            continue

        ss = row[index["当前SS"]] or "空白"
        booked = clean_number(row[index["当月已约未上课次"]])
        expected = completed + booked
        target = 12 if low_min == 0 else low_min
        qualified = 1 if expected >= target else 0
        core_completed_total += completed
        process_high_count += 1 if completed >= target * month_progress else 0
        zero_consumption_count += 1 if completed == 0 else 0

        group_stats[group]["assessed"] += 1
        group_stats[group]["qualified"] += qualified

        person_key = (group, ss)
        person_stats[person_key]["group"] = group
        person_stats[person_key]["ss"] = ss
        person_stats[person_key]["assessed"] += 1
        person_stats[person_key]["qualified"] += qualified

    workbook.close()

    group_rows = []
    for group in CORE_GROUPS:
        item = group_stats[group]
        item["rate"] = round_float(safe_ratio(item["qualified"], item["assessed"]))
        group_rows.append(item)

    people_rows = []
    for item in person_stats.values():
        item["rate"] = round_float(safe_ratio(item["qualified"], item["assessed"]))
        people_rows.append(dict(item))
    people_rows.sort(key=lambda item: (-item["rate"], item["group"], item["ss"]))

    core_rows_assessed = sum(row["assessed"] for row in group_rows)
    upsert_payload = {"date": report_date.isoformat(), "groups": group_rows, "people": people_rows}
    diagnostics = {
        "source_rows_assessed": eligible_total,
        "core_rows_assessed": core_rows_assessed,
        "good_student_count": good_student_count,
        "good_student_denominator": good_student_denominator,
        "good_student_rate": round_float(safe_ratio(good_student_count, core_rows_assessed)),
        "avg_consumption": round_float(safe_ratio(core_completed_total, core_rows_assessed), 4),
        "process_high_ratio": round_float(safe_ratio(process_high_count, core_rows_assessed), 6),
        "zero_consumption_ratio": round_float(safe_ratio(zero_consumption_count, core_rows_assessed), 6),
        "zero_consumption_count": zero_consumption_count,
        "process_high_count": process_high_count,
        "excluded_groups": dict(excluded_core),
    }
    return upsert_payload, diagnostics


def latest_date(history, kind):
    dates = sorted({row["date"] for row in history[kind]})
    return dates[-1] if dates else None


def previous_date(history, kind, current_date):
    dates = sorted({row["date"] for row in history[kind] if row["date"] < current_date})
    return dates[-1] if dates else None


def stage_target_for_date(date_text):
    current = datetime.strptime(date_text, "%Y-%m-%d").date() if isinstance(date_text, str) else date_text
    for milestone in STAGE_TARGETS:
        if current.day <= milestone["day"]:
            return milestone["target"]
    return STAGE_TARGETS[-1]["target"]


def stage_target_label(date_text):
    current = datetime.strptime(date_text, "%Y-%m-%d").date() if isinstance(date_text, str) else date_text
    label_suffix = "\u53f7\u9636\u6bb5\u76ee\u6807"
    for milestone in STAGE_TARGETS:
        if current.day <= milestone["day"]:
            return f"{milestone['day']}{label_suffix} {milestone['target'] * 100:.0f}%"
    milestone = STAGE_TARGETS[-1]
    return f"{milestone['day']}{label_suffix} {milestone['target'] * 100:.0f}%"


def same_day_previous_month(date_text):
    current = datetime.strptime(date_text, "%Y-%m-%d").date()
    year = current.year
    month = current.month - 1
    if month == 0:
        year -= 1
        month = 12
    day = min(current.day, monthrange(year, month)[1])
    return f"{year}-{month:02d}-{day:02d}"


def seed_month_benchmarks(history):
    legacy_seed_fields = {
        "completion_rate",
        "avg_consumption",
        "process_high_ratio",
        "good_student_rate",
        "high_consumption_ratio",
        "zero_consumption_ratio",
        "zero_consumption_count",
    }
    source_dates = {row.get("date") for row in history.get("groups", [])}
    cleaned_overall = []
    for row in history.get("overall", []):
        row_date = row.get("date", "")
        if row_date.startswith("2026-08-") and row_date not in source_dates:
            cleaned = {field: value for field, value in row.items() if field not in legacy_seed_fields}
            if any(field != "date" for field in cleaned):
                cleaned_overall.append(cleaned)
            continue
        cleaned_overall.append(row)
    history["overall"] = cleaned_overall
    merge_overall_history_by_date(history)

    july_completion = [
        0.0701, 0.0816, 0.0950, 0.1110, 0.1340, 0.1600, 0.1823, 0.2021,
        0.2238, 0.2500, 0.2770, 0.3146, 0.3507, 0.3836, 0.4122, 0.4373,
        0.4490, 0.4635, 0.4758, 0.4913, 0.5028, 0.5130, 0.5223, 0.5333,
        0.5486, 0.5701, 0.5866, 0.6013, 0.6198, 0.6406, 0.6678,
    ]
    july_high_ratio = {
        8: 0.4211, 9: 0.4702, 10: 0.5280, 11: 0.4370, 12: 0.4810,
        13: 0.4244, 14: 0.4825, 15: 0.5154, 16: 0.4730, 17: 0.49,
        18: 0.4460, 19: 0.4506, 20: 0.5096, 21: 0.4518, 22: 0.5022,
        23: 0.5245, 24: 0.4910, 25: 0.5020, 26: 0.4599, 27: 0.4908,
        28: 0.5447, 29: 0.4855, 30: 0.5590, 31: 0.6678,
    }
    july_avg = {
        6: 2.2, 8: 3.2, 9: 3.7, 10: 4.0, 11: 4.4, 12: 4.7, 13: 5.2,
        14: 5.6, 15: 6.2, 16: 6.5, 17: 6.9, 18: 7.2, 19: 7.5,
        20: 8.0, 21: 8.4, 22: 8.9, 23: 9.3, 24: 9.7, 25: 10.1,
        26: 10.4, 27: 10.9, 28: 11.3, 29: 11.8, 30: 12.3, 31: 12.7,
    }
    july_process_high_ratio = {
        8: 0.0468, 9: 0.0741, 10: 0.1060, 11: 0.1330, 12: 0.1624,
        13: 0.2138, 14: 0.2675, 15: 0.3218, 16: 0.3730, 17: 0.4260,
        18: 0.4630, 19: 0.4943, 20: 0.5478, 21: 0.5936, 22: 0.6289,
        23: 0.6636, 24: 0.6910, 25: 0.7130, 26: 0.7346, 27: 0.7584,
        28: 0.7771, 29: 0.7929, 30: 0.8050, 31: 0.8129,
    }
    good_rates = {
        "2026-05": [
            0.0, 0.0, 0.0, 0.0001, 0.0002, 0.0004, 0.0007, 0.0015,
            0.0023, 0.0033, 0.0043, 0.0052, 0.0066, 0.0092, 0.0130,
            0.0168, 0.0227, 0.0294, 0.0363, 0.0447, 0.0567, 0.0679,
            0.0791, 0.0919, 0.1093, 0.1299, 0.1571, 0.1901, 0.2235,
            0.2628, 0.3176,
        ],
        "2026-06": [
            0.0, 0.0, 0.0, 0.0001, 0.0004, 0.0007, 0.0008, 0.0014,
            0.0025, 0.0042, 0.0061, 0.0073, 0.0090, 0.0106, 0.0176,
            0.0226, 0.0305, 0.0374, 0.0458, 0.0540, 0.0615, 0.0750,
            0.0905, 0.1119, 0.1396, 0.1630, 0.1856, 0.2138, 0.2549,
            0.3184, None,
        ],
        "2026-07": [
            0.0, 0.0, 0.0001, 0.0002, 0.0004, 0.0007, 0.0016, 0.0029,
            0.0049, 0.0077, 0.0099, 0.0123, 0.0159, 0.0209, 0.0297,
            0.0389, 0.0390, 0.0580, 0.0655, 0.0777, 0.0936, 0.1118,
            0.1309, 0.1510, 0.1670, 0.1839, 0.2102, 0.2377, 0.2684,
            0.3058, 0.3542,
        ],
        "2026-08": [
            0.0, 0.0, 0.0, 0.0001, 0.0010, 0.0018, 0.0024, 0.0052,
            0.0078, 0.0104, 0.0132, 0.0189,
        ],
    }
    benchmarks = [
        {
            "date": "2026-06-27",
            "completion_rate": 0.5478,
            "avg_consumption": 10.5,
            "process_high_ratio": 0.487,
            "good_student_rate": 0.1856,
        },
        {
            "date": "2026-06-28",
            "completion_rate": 0.5745,
            "avg_consumption": 10.1,
            "process_high_ratio": 0.333,
            "good_student_rate": 0.2138,
        },
        {
            "date": "2026-06-29",
            "completion_rate": 0.5991,
            "good_student_rate": 0.2549,
        },
        {
            "date": "2026-06-30",
            "completion_rate": 0.6314,
            "avg_consumption": 11.9,
            "process_high_ratio": 0.631,
            "good_student_rate": 0.3184,
        },
    ]
    for day, value in enumerate(july_completion, start=1):
        benchmarks.append({"date": f"2026-07-{day:02d}", "completion_rate": value})
    for day, value in july_high_ratio.items():
        benchmarks.append({"date": f"2026-07-{day:02d}", "high_consumption_ratio": value})
    for day, value in july_avg.items():
        benchmarks.append({"date": f"2026-07-{day:02d}", "avg_consumption": value})
    for day, value in july_process_high_ratio.items():
        benchmarks.append({"date": f"2026-07-{day:02d}", "process_high_ratio": value})
    for month, values in good_rates.items():
        for day, value in enumerate(values, start=1):
            if value is not None:
                benchmarks.append({"date": f"{month}-{day:02d}", "good_student_rate": value})
    upsert_history(history, "overall", benchmarks, None, preserve_existing=True)
    merge_overall_history_by_date(history)


def build_dashboard_data(history, diagnostics, report_date):
    current_date = latest_date(history, "groups") or report_date.isoformat()
    prior_date = previous_date(history, "groups", current_date)
    target = stage_target_for_date(current_date)

    groups_current = [row for row in history["groups"] if row["date"] == current_date and row["group"] in CORE_GROUPS]
    groups_prior = {row["group"]: row for row in history["groups"] if row["date"] == prior_date} if prior_date else {}
    people_current = [row for row in history["people"] if row["date"] == current_date and row["group"] in CORE_GROUPS]
    people_prior = {row["ss"]: row for row in history["people"] if row["date"] == prior_date} if prior_date else {}

    group_rows = []
    for row in groups_current:
        prior = groups_prior.get(row["group"], {})
        current_rate = row["rate"]
        prior_rate = prior.get("rate")
        lift = current_rate - prior_rate if prior_rate is not None else None
        gap_rate = target - current_rate
        group_rows.append(
            {
                **row,
                "prior_rate": round_float(prior_rate),
                "lift": round_float(lift),
                "gap_rate": round_float(gap_rate),
                "gap_students": round_float(row["assessed"] * gap_rate, 2),
            }
        )

    totals = {
        "group": "总计",
        "assessed": sum(row["assessed"] for row in group_rows),
        "qualified": sum(row["qualified"] for row in group_rows),
    }
    totals["rate"] = round_float(safe_ratio(totals["qualified"], totals["assessed"]))
    prior_total_assessed = sum(row["assessed"] for row in groups_prior.values() if row.get("group") in CORE_GROUPS)
    prior_total_qualified = sum(row["qualified"] for row in groups_prior.values() if row.get("group") in CORE_GROUPS)
    totals["prior_rate"] = round_float(safe_ratio(prior_total_qualified, prior_total_assessed)) if prior_total_assessed else None
    totals["lift"] = round_float(totals["rate"] - totals["prior_rate"]) if totals["prior_rate"] is not None else None
    totals["gap_rate"] = round_float(target - totals["rate"])
    totals["gap_students"] = round_float(totals["assessed"] * totals["gap_rate"], 2)
    group_rows.append(totals)

    person_rows = []
    for row in people_current:
        prior = people_prior.get(row["ss"], {})
        current_rate = row["rate"]
        prior_rate = prior.get("rate")
        lift = current_rate - prior_rate if prior_rate is not None else None
        gap_rate = target - current_rate
        person_rows.append(
            {
                **row,
                "prior_rate": round_float(prior_rate),
                "lift": round_float(lift),
                "lift_students": round_float(row["assessed"] * lift, 2) if lift is not None else None,
                "gap_rate": round_float(gap_rate),
                "gap_students": round_float(row["assessed"] * gap_rate, 2),
            }
        )
    person_rows.sort(key=lambda item: (-item["rate"], item["group"], item["ss"]))

    trend = []
    for date in sorted({row["date"] for row in history["groups"]}):
        rows = [row for row in history["groups"] if row["date"] == date and row["group"] in CORE_GROUPS]
        assessed = sum(row["assessed"] for row in rows)
        qualified = sum(row["qualified"] for row in rows)
        trend.append({"date": date, "rate": round_float(safe_ratio(qualified, assessed)), "assessed": assessed})

    last_month_date = same_day_previous_month(current_date)
    overall_current = next((row for row in history["overall"] if row["date"] == current_date), {})
    overall_prior = next((row for row in history["overall"] if row["date"] == prior_date), {}) if prior_date else {}
    overall_last_month = next((row for row in history["overall"] if row["date"] == last_month_date), {})
    last_month_groups = [row for row in history["groups"] if row["date"] == last_month_date and row["group"] in CORE_GROUPS]
    last_month_assessed = sum(row["assessed"] for row in last_month_groups)
    last_month_qualified = sum(row["qualified"] for row in last_month_groups)
    last_month_completion = round_float(safe_ratio(last_month_qualified, last_month_assessed)) if last_month_assessed else round_float(overall_last_month.get("completion_rate"), 6)
    completion_rate = {
        "current": totals["rate"],
        "prior": totals["prior_rate"],
        "last_month": last_month_completion,
    }
    completion_rate["delta"] = round_float(completion_rate["current"] - completion_rate["prior"], 6) if completion_rate["current"] is not None and completion_rate["prior"] is not None else None
    completion_rate["last_month_delta"] = round_float(completion_rate["current"] - completion_rate["last_month"], 6) if completion_rate["current"] is not None and completion_rate["last_month"] is not None else None
    overall_metrics = {
        "avg_consumption": {
            "current": round_float(overall_current.get("avg_consumption"), 4),
            "prior": round_float(overall_prior.get("avg_consumption"), 4),
            "last_month": round_float(overall_last_month.get("avg_consumption"), 4),
        },
        "process_high_ratio": {
            "current": round_float(overall_current.get("process_high_ratio"), 6),
            "prior": round_float(overall_prior.get("process_high_ratio"), 6),
            "last_month": round_float(
                overall_last_month.get("high_consumption_ratio", overall_last_month.get("process_high_ratio")),
                6,
            ),
        },
        "good_student_rate": {
            "current": round_float(overall_current.get("good_student_rate"), 6),
            "prior": round_float(overall_prior.get("good_student_rate"), 6),
            "last_month": round_float(overall_last_month.get("good_student_rate"), 6),
        },
        "zero_consumption_ratio": {
            "current": round_float(overall_current.get("zero_consumption_ratio"), 6),
            "prior": round_float(overall_prior.get("zero_consumption_ratio"), 6),
            "last_month": round_float(overall_last_month.get("zero_consumption_ratio"), 6),
        },
    }
    for item in overall_metrics.values():
        current = item["current"]
        prior = item["prior"]
        last_month = item["last_month"]
        item["delta"] = round_float(current - prior, 6) if current is not None and prior is not None else None
        item["last_month_delta"] = round_float(current - last_month, 6) if current is not None and last_month is not None else None

    return {
        "currentDate": current_date,
        "priorDate": prior_date,
        "lastMonthDate": last_month_date,
        "target": target,
        "targetLabel": stage_target_label(current_date),
        "targetMilestones": STAGE_TARGETS,
        "completionRate": completion_rate,
        "overallMetrics": overall_metrics,
        "groupRows": group_rows,
        "personRows": person_rows,
        "trend": trend,
        "historicalAnalysis": {
            "distribution": {
                "months": HISTORICAL_DISTRIBUTION_MONTHS,
                "buckets": HISTORICAL_DISTRIBUTION_BUCKETS,
            },
            "avgCompletion": HISTORICAL_AVG_COMPLETION,
            "lifecycle": {
                "columns": LIFECYCLE_COLUMNS,
                "rows": LIFECYCLE_PERFORMANCE,
            },
        },
        "diagnostics": diagnostics,
    }


def pct(value):
    return "" if value is None else f"{value * 100:.2f}%"


def number(value):
    if value is None:
        return ""
    if isinstance(value, float) and not value.is_integer():
        return f"{value:.2f}"
    return f"{int(value):,}"


def render_html(data, output_path):
    payload = json.dumps(data, ensure_ascii=False)
    html = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>51Talk 学科运营智能驾驶舱</title>
  <link rel="stylesheet" href="fixed-plan.css?v=20260909-import-fix">
  <link rel="stylesheet" href="course-history.css">
  <link rel="stylesheet" href="core-overview.css">
  <link rel="stylesheet" href="dashboard-large-type.css?v=20260826">
  <style>
    :root {
      --bg: #eaf4ff;
      --surface: #ffffff;
      --surface-2: #f6fbff;
      --surface-3: #e8f1fb;
      --line: #d6e6f7;
      --line-strong: #bfd5ef;
      --text: #2c3c55;
      --muted: #71839c;
      --subtle: #9aaec7;
      --brand: #2f7dda;
      --brand-2: #7db3ee;
      --green: #2e9570;
      --green-bg: #e2f4ed;
      --orange: #b87a20;
      --orange-bg: #fff3d7;
      --red: #c65463;
      --red-bg: #ffeff2;
      --blue-bg: #e7f2ff;
      --pink: #e45f9a;
      --pink-bg: #fff0f7;
      --radius-lg: 18px;
      --radius-md: 16px;
      --radius-sm: 8px;
      --shadow: 0 18px 38px rgba(75, 126, 184, .11);
      --nav-w: 232px;
      --toolbar-h: 68px;
      --font: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at 12% 0%, rgba(255,255,255,.92), rgba(255,255,255,0) 34%),
        linear-gradient(180deg,#e3f1ff 0%,#f3f9ff 38%,#eef7ff 100%);
      font-family: var(--font);
      font-size: 14px;
    }
    button, input, select { font: inherit; }
    .layout { min-height: 100vh; padding-left: var(--nav-w); transition: padding-left .22s ease; }
    .sidebar {
      position: fixed; inset: 0 auto 0 0; z-index: 20;
      width: var(--nav-w); background: #111f35; color: rgba(255,255,255,.82);
      border-right: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column;
      transition: width .22s ease;
    }
    .brand { height: 76px; padding: 18px 18px 14px; border-bottom: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; gap: 12px; }
    .brand-mark { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg,#fff,#d8e5ff); color: var(--brand); display: grid; place-items: center; font-weight: 850; }
    .brand-title { font-weight: 760; color: #fff; letter-spacing: -.02em; }
    .brand-sub { margin-top: 3px; font-size: 12px; color: rgba(255,255,255,.54); }
    .nav { padding: 16px 12px; display: grid; gap: 6px; }
    .nav-item { border: 0; width: 100%; height: 42px; padding: 0 12px; border-radius: 10px; background: transparent; color: rgba(255,255,255,.68); display: flex; align-items: center; gap: 10px; cursor: pointer; text-align: left; }
    .nav-item:hover { background: rgba(255,255,255,.07); color: #fff; }
    .nav-item.active { background: #fff; color: var(--brand); font-weight: 720; }
    .nav-ico { width: 20px; text-align: center; font-size: 16px; }
    .nav-footer { margin-top: auto; padding: 14px; border-top: 1px solid rgba(255,255,255,.08); }
    .collapse-btn { width: 100%; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); color: rgba(255,255,255,.82); height: 36px; border-radius: 10px; cursor: pointer; }
    body.nav-collapsed { --nav-w: 76px; }
    body.nav-collapsed .brand-copy, body.nav-collapsed .nav-text, body.nav-collapsed .collapse-text { display: none; }
    body.nav-collapsed .brand { justify-content: center; padding-left: 0; padding-right: 0; }
    body.nav-collapsed .nav-item { justify-content: center; padding: 0; }
    .main { min-width: 0; }
    .toolbar {
      position: sticky; top: 0; z-index: 10; height: var(--toolbar-h); background: rgba(234,244,255,.86);
      backdrop-filter: blur(14px); border-bottom: 1px solid rgba(191,213,239,.76); display: flex; align-items: center; justify-content: space-between;
      padding: 0 28px;
    }
    .crumb { display: flex; align-items: center; gap: 8px; font-weight: 720; color: var(--brand); }
    .crumb span:last-child { color: var(--text); }
    .tools { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; }
    .btn { height: 36px; border: 1px solid var(--line); background: var(--surface); color: var(--text); border-radius: 9px; padding: 0 12px; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
    .btn:hover { border-color: var(--line-strong); background: var(--surface-2); }
    .content { padding: 22px 28px 36px; max-width: 1780px; margin: 0 auto; }
    .section-card { margin-top: 16px; padding: 22px 24px 26px; background: rgba(255,255,255,.82); border: 1px solid rgba(214,230,247,.92); border-radius: 22px; box-shadow: var(--shadow); }
    .section-card:first-child { margin-top: 0; }
    .section-head { min-height: 58px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .section-index { width: 42px; height: 42px; border-radius: 10px; background: linear-gradient(180deg,#eff7ff,#d9ebff); border: 1px solid #bfd9f6; color: var(--brand); display: grid; place-items: center; font-weight: 850; }
    .section-title-wrap { display: flex; align-items: center; gap: 14px; }
    .section-title { margin: 0; font-size: 26px; line-height: 1.05; letter-spacing: -.04em; color: var(--text); }
    .section-sub { margin-top: 6px; color: var(--muted); font-size: 13px; }
    .section-mark { color: #a2b2c7; font-size: 12px; letter-spacing: .14em; font-weight: 850; text-transform: uppercase; }
    .hero { display: block; min-height: unset; padding: 0; background: transparent; border: 0; border-radius: 0; box-shadow: none; }
    .kicker { color: var(--brand-2); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 6px 0 6px; font-size: 34px; line-height: 1.08; letter-spacing: -.04em; }
    .subtitle { margin: 0; color: var(--muted); }
    .date-card { min-width: 260px; padding: 14px; border-radius: 12px; background: rgba(246,251,255,.92); border: 1px solid var(--line); display: grid; gap: 8px; }
    .date-row { display: flex; justify-content: space-between; gap: 20px; font-size: 13px; }
    .date-row b { color: var(--text); }
    .insight-strip { margin-top: 16px; display: grid; grid-template-columns: 1.1fr 1fr 1fr; gap: 12px; }
    .insight-card { min-height: 96px; padding: 14px 16px; background: linear-gradient(180deg,#f9fcff,#eef7ff); border: 1px solid var(--line); border-radius: var(--radius-md); display: grid; align-content: start; gap: 8px; }
    .insight-card .label { color: var(--muted); font-size: 12px; font-weight: 760; }
    .insight-card strong { font-size: 16px; color: var(--text); }
    .insight-card p { margin: 0; color: var(--muted); line-height: 1.55; font-size: 13px; }
    .kpis { display: grid; grid-template-columns: minmax(420px,1.7fr) repeat(4,minmax(160px,.72fr)); gap: 14px; }
    .kpi { min-height: 166px; padding: 16px; background: rgba(255,255,255,.78); border: 1px solid var(--line); border-radius: var(--radius-md); display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 10px 24px rgba(68,117,171,.07); }
    .kpi.kpi-primary { min-height: 178px; padding: 18px 20px; background: linear-gradient(135deg,#f8fcff 0%,#e7f3ff 100%); }
    .kpi-primary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: end; }
    .kpi-primary-metric span { display: block; color: var(--muted); font-size: 12px; font-weight: 760; margin-bottom: 8px; }
    .kpi-primary-metric b { font-size: 46px; line-height: 1; letter-spacing: -.055em; color: var(--brand); }
    .kpi-primary-metric.secondary b { color: var(--text); }
    .kpi-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: var(--muted); font-size: 13px; font-weight: 720; }
    .kpi-icon { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: var(--blue-bg); color: var(--brand); }
    .kpi-value { font-size: 34px; line-height: .95; letter-spacing: -.055em; font-weight: 780; color: var(--text); }
    .kpi-meta { display: grid; gap: 6px; color: var(--muted); font-size: 12px; }
    .kpi-meta-row { display: flex; justify-content: space-between; gap: 10px; }
    .delta-up { color: var(--green); font-weight: 760; }
    .delta-down { color: var(--red); font-weight: 760; }
    .progress { height: 5px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
    .progress span { display: block; height: 100%; background: linear-gradient(90deg,var(--brand-2),var(--brand)); border-radius: inherit; }
    .grid-2 { margin-top: 16px; display: grid; grid-template-columns: minmax(0,1.15fr) minmax(380px,.85fr); gap: 14px; }
    .panel { background: rgba(255,255,255,.78); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: 0 10px 24px rgba(68,117,171,.07); overflow: hidden; }
    .panel-head { min-height: 56px; padding: 14px 16px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .panel-title { font-size: 20px; font-weight: 760; letter-spacing: -.03em; }
    .panel-sub { color: var(--muted); font-size: 12px; }
    .panel-body { padding: 16px; }
    .chart-svg { width: 100%; height: 280px; display: block; }
    .bars { display: grid; gap: 12px; }
    .bar-row { display: grid; grid-template-columns: 112px minmax(0,1fr) 58px; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; padding: 3px 0; }
    .bar-row:hover .bar-track { background: #e9eef6; }
    .bar-track { height: 12px; background: var(--surface-3); border-radius: 999px; position: relative; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--brand-2); border-radius: inherit; }
    .avg-line, .target-line { position: absolute; top: -4px; width: 2px; height: 20px; background: var(--orange); opacity: .9; }
    .target-line { background: var(--green); }
    .risk { color: var(--red); }
    .history-grid { margin-top: 16px; display: grid; grid-template-columns: minmax(0,1fr) minmax(420px,.95fr); gap: 14px; }
    .history-summary { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; margin-bottom: 14px; }
    .history-summary-item { padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface-2); }
    .history-summary-item span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .history-summary-item b { font-size: 20px; color: var(--brand); }
    .stacked-chart { display: grid; grid-template-columns: repeat(20,minmax(34px,1fr)); align-items: end; gap: 8px; min-width: 820px; height: 260px; padding: 8px 0 0; }
    .stack-month { display: grid; grid-template-rows: 1fr 22px; gap: 6px; height: 100%; text-align: center; color: var(--muted); font-size: 11px; }
    .stack-bar { align-self: end; height: 220px; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; border-radius: 8px 8px 4px 4px; background: var(--surface-3); border: 1px solid var(--line); }
    .stack-segment { min-height: 1px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,.92); font-size: 10px; font-weight: 760; line-height: 1; text-shadow: 0 1px 2px rgba(0,0,0,.28); }
    .stack-segment.is-light { color: #2e3440; text-shadow: none; }
    .dist-legend { margin-top: 12px; display: flex; gap: 10px 14px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
    .legend-dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; margin-right: 6px; vertical-align: -1px; }
    .avg-chart { display: grid; grid-template-columns: repeat(9,minmax(70px,1fr)); align-items: end; gap: 12px; min-width: 780px; height: 250px; padding: 16px 4px 0; border-bottom: 1px solid var(--line); }
    .avg-bar-item { height: 100%; display: grid; grid-template-rows: 22px 1fr 24px; align-items: end; text-align: center; color: var(--muted); font-size: 12px; }
    .avg-value { color: var(--brand); font-weight: 760; align-self: start; }
    .avg-bar { width: 52%; margin: 0 auto; border-radius: 10px 10px 3px 3px; background: linear-gradient(180deg,#152b52,#5a759d); min-height: 18px; }
    .avg-bar.is-latest { background: linear-gradient(180deg,#20a36b,#9adbb9); box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
    .avg-bar.is-yoy { background: linear-gradient(180deg,#6b7280,#c9ced6); }
    .heatmap-wrap { overflow-x: auto; }
    .heatmap { min-width: 980px; border-collapse: separate; border-spacing: 0; }
    .heatmap th, .heatmap td { height: 38px; padding: 0 8px; text-align: center; font-size: 12px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); white-space: nowrap; }
    .heatmap th { cursor: default; background: var(--surface-2); }
    .heatmap td:first-child, .heatmap th:first-child { position: sticky; left: 0; z-index: 1; background: var(--surface-2); font-weight: 760; }
    .strategy-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; }
    .strategy-card { padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface-2); display: grid; gap: 7px; }
    .strategy-card b { color: var(--brand); }
    .strategy-card p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
    .analysis-block { padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface-2); display: grid; gap: 10px; }
    .analysis-block h3 { margin: 0; font-size: 16px; }
    .analysis-list { margin: 0; padding-left: 18px; color: var(--text); font-size: 13px; line-height: 1.75; }
    .analysis-list li::marker { color: var(--brand); }
    .filter-row { margin-top: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .filter-row input, .filter-row select { height: 36px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); padding: 0 10px; min-width: 180px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 980px; }
    th { height: 44px; padding: 0 12px; text-align: left; background: #f2f8ff; color: var(--muted); font-size: 12px; font-weight: 760; border-bottom: 1px solid var(--line); white-space: nowrap; cursor: pointer; }
    td { height: 60px; padding: 0 12px; border-bottom: 1px solid var(--line); color: var(--text); white-space: nowrap; }
    tbody tr:hover td { background: #f7fbff; }
    .total-row td { background: #eaf6f4; font-weight: 760; border-top: 1px solid var(--line-strong); }
    .value-strong { font-size: 18px; font-weight: 820; color: var(--brand); }
    .muted { color: var(--muted); }
    .tag { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 7px; font-size: 12px; font-weight: 700; border: 1px solid transparent; }
    .tag-ok { color: var(--green); background: var(--green-bg); border-color: #c8eadb; }
    .tag-warn { color: var(--orange); background: var(--orange-bg); border-color: #ffe0b2; }
    .tag-risk { color: var(--red); background: var(--red-bg); border-color: #ffd4d4; }
    .tag-neutral { color: var(--brand); background: var(--blue-bg); border-color: #d7e7ff; }
    .detail-row td { height: auto; padding: 12px; background: #fbfcfe; }
    .mini-people { display: flex; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
    .recommendations { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
    .rec { padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface-2); display: grid; gap: 8px; }
    .priority { width: fit-content; }
    .footer-note { margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.6; }
    @media (max-width: 1200px) { .kpis { grid-template-columns: repeat(2,minmax(0,1fr)); } .kpi-primary { grid-column: 1 / -1; } .grid-2,.history-grid { grid-template-columns: 1fr; } .insight-strip { grid-template-columns: 1fr; } .strategy-grid,.history-summary { grid-template-columns: repeat(2,minmax(0,1fr)); } }
    @media (max-width: 860px) { body { --nav-w: 76px; } .brand-copy,.nav-text,.collapse-text { display:none; } .toolbar { padding: 0 16px; } .content { padding: 16px; } .hero { grid-template-columns: 1fr; } .tools .btn span { display:none; } }
  </style>
</head>
<body>
<div id="app"></div>
<script>
const DATA = __PAYLOAD__;
const TEXT = {
  nav1:"\u8bfe\u8017\u770b\u677f", nav2:"LP \u770b\u677f", nav3:"\u5b66\u79d1\u770b\u677f",
  title:"\u8bfe\u8017\u8fd0\u8425\u9a7e\u9a76\u8231", subtitle:"\u8bfe\u8017\u8d8b\u52bf\u3001\u76ee\u6807\u8fbe\u6210\u4e0e\u5c0f\u7ec4\u98ce\u9669\u76d1\u63a7",
  brand:"51Talk", brandSub:"\u5b66\u79d1\u8fd0\u8425\u9a7e\u9a76\u8231"
};
const target = DATA.target || 0.66;
let groupSort = { key: 'rate', dir: 'desc' };
let selectedGroup = 'all';
let expandedGroup = null;
function pct(v,d=2){ return v===null||v===undefined||Number.isNaN(v)?'\u6682\u65e0':(v*100).toFixed(d)+'%'; }
function pct1(v){ return pct(v,1); }
function num(v,d=0){ return v===null||v===undefined||Number.isNaN(v)?'\u6682\u65e0':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:d,minimumFractionDigits:d}); }
function signedPct(v,d=2){ if(v===null||v===undefined) return '\u6682\u65e0'; return (v>=0?'+':'')+pct(v,d); }
function signedNum(v,d=2){ if(v===null||v===undefined) return '\u6682\u65e0'; return (v>=0?'+':'')+num(v,d); }
function cls(v){ return v>=0?'delta-up':'delta-down'; }
function esc(v){ return String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function groups(){ return DATA.groupRows.filter(r=>r.group!=='\u603b\u8ba1'); }
function total(){ return DATA.groupRows.find(r=>r.group==='\u603b\u8ba1') || {}; }
function currentTarget(){ return DATA.target || target || .66; }
function status(row){ const t=currentTarget(); if(row.rate>=t) return ['\u5df2\u8fbe\u6807','tag-ok']; if(row.rate>=t-.02) return ['\u63a5\u8fd1\u76ee\u6807','tag-neutral']; if(row.rate>=Math.max(0,t-.06)) return ['\u5f85\u63d0\u5347','tag-warn']; return ['\u91cd\u70b9\u8ddf\u8fdb','tag-risk']; }
function riskLevel(row){ const t=currentTarget(); if(row.rate>=t) return ['\u4f4e','tag-ok']; if(row.rate>=t-.02) return ['\u4e2d','tag-neutral']; if(row.rate>=Math.max(0,t-.06)) return ['\u9ad8','tag-warn']; return ['\u7d27\u6025','tag-risk']; }
function metricCard(name, value, type, metric, icon, goalText){
  const formatter = type==='num' ? (v=>num(v,2)) : (v=>pct(v, type==='pct1'?1:2));
  const deltaFormatter = type==='num' ? (v=>signedNum(v,2)) : (v=>signedPct(v,2));
  const progressValue = type==='num' ? Math.min((value||0)/13,1) : Math.min(value||0,1);
  return `<section class="kpi"><div class="kpi-head"><span>${name}</span><span class="kpi-icon">${icon}</span></div><div><div class="kpi-value">${formatter(value)}</div><div class="progress"><span style="width:${Math.max(0,progressValue)*100}%"></span></div></div><div class="kpi-meta"><div class="kpi-meta-row"><span>\u6628\u65e5 ${formatter(metric.prior)}</span><b class="${cls(metric.delta)}">${deltaFormatter(metric.delta)}</b></div><div class="kpi-meta-row"><span>\u4e0a\u6708\u540c\u65e5 ${formatter(metric.last_month)}</span><b class="${cls(metric.last_month_delta)}">${deltaFormatter(metric.last_month_delta)}</b></div><div class="kpi-meta-row"><span>${goalText}</span></div></div></section>`;
}
function primaryKpiCard(){
  const c=DATA.completionRate, t=total();
  const completionWidth=Math.max(0,Math.min((c.current||0)*100,100));
  return `<section class="kpi kpi-primary"><div class="kpi-head"><span>\u9884\u8ba1\u5b8c\u8bfe\u7387</span><span class="kpi-icon">\u25c9</span></div><div class="kpi-primary-grid"><div class="kpi-primary-metric"><span>\u9884\u8ba1\u5b8c\u8bfe\u7387</span><b>${pct(c.current)}</b></div><div class="kpi-primary-metric secondary"><span>\u8ddd ${DATA.targetLabel||'\u9636\u6bb5\u76ee\u6807'}</span><b>${pct(t.gap_rate)}</b></div></div><div class="progress"><span style="width:${completionWidth}%"></span></div><div class="kpi-meta"><div class="kpi-meta-row"><span>\u6628\u65e5 ${pct(c.prior)}</span><b class="${cls(c.delta)}">${signedPct(c.delta)}</b></div><div class="kpi-meta-row"><span>\u4e0a\u6708\u540c\u65e5 ${pct(c.last_month)}</span><b class="${cls(c.last_month_delta)}">${signedPct(c.last_month_delta)}</b></div></div></section>`;
}
function buildInsights(){
  const t=total(), gs=groups();
  const stageLabel=DATA.targetLabel || `\u9636\u6bb5\u76ee\u6807 ${pct(currentTarget())}`;
  const best=gs.slice().sort((a,b)=>b.rate-a.rate)[0]||{};
  const fastest=gs.slice().sort((a,b)=>(b.lift??-9)-(a.lift??-9))[0]||{};
  const weakest=gs.slice().sort((a,b)=>a.rate-b.rate)[0]||{};
  const below=gs.filter(g=>g.rate < t.rate).map(g=>g.group).slice(0,2).join('\u3001') || '\u6682\u65e0';
  const gapStudents=Math.max(t.gap_students||0,0);
  return {best,fastest,weakest,below,stageLabel,
    core:`\u5f53\u524d\u9884\u8ba1\u5b8c\u8bfe\u7387 ${pct(t.rate)}\uff0c\u8f83\u6628\u65e5 ${signedPct(t.lift)}\uff1b\u5bf9\u7167${stageLabel}\uff0c${gapStudents>0?`\u8fd8\u5dee\u7ea6 ${num(gapStudents,0)} \u4eba`:'\u5df2\u8d85\u8fc7\u9636\u6bb5\u76ee\u6807'}\u3002`,
    bright:`${best.group||'-'} \u5f53\u524d\u6700\u9ad8 ${pct(best.rate)}\uff1b${fastest.group||'-'} \u65e5\u73af\u6bd4\u63d0\u5347\u6700\u5feb ${signedPct(fastest.lift)}\uff0c\u5efa\u8bae\u6c89\u6dc0\u4e3a\u6807\u6746\u52a8\u4f5c\u3002`,
    risk:`${weakest.group||'-'} \u5f53\u524d ${pct(weakest.rate)}\uff0c\u4f4e\u4e8e\u6574\u4f53\u6c34\u5e73\u7684\u5c0f\u7ec4\uff1a${below}\u3002\u7ed3\u5408\u5468\u62a5\u65b9\u5411\uff0c\u4f18\u5148\u770b\u56fa\u5b9a\u8ba1\u5212\u30010\u8bfe\u8017\u548c\u95ed\u73af\u8ddf\u8fdb\u3002`
  };
}
function renderShell(){
  const d=DATA;
  document.getElementById('app').innerHTML = `<aside class="sidebar"><div class="brand"><div class="brand-mark">51</div><div class="brand-copy"><div class="brand-title">${TEXT.brand}</div><div class="brand-sub">${TEXT.brandSub}</div></div></div><nav class="nav"><button class="nav-item active"><span class="nav-ico">\u25cf</span><span class="nav-text">${TEXT.nav1}</span></button><button class="nav-item"><span class="nav-ico">\u25cb</span><span class="nav-text">${TEXT.nav2}</span></button><button class="nav-item"><span class="nav-ico">\u25cb</span><span class="nav-text">${TEXT.nav3}</span></button></nav><div class="nav-footer"><button class="collapse-btn" id="collapseNav">\u2039 <span class="collapse-text">\u6298\u53e0\u5bfc\u822a</span></button></div></aside><div class="layout"><main class="main"><div class="toolbar"><div class="crumb"><span>\u5b66\u79d1\u8fd0\u8425\u9a7e\u9a76\u8231</span><span>/</span><span>${TEXT.nav1}</span></div><div class="tools"><span>\u66f4\u65b0\uff1a${d.currentDate}</span><button class="btn" id="refreshBtn">\u21bb <span>\u5237\u65b0</span></button><button class="btn" id="filterBtn">\u2315 <span>\u7b5b\u9009</span></button><button class="btn" id="importBtn">\u2191 <span>\u5bfc\u5165</span></button><button class="btn" id="aiBtn">AI <span>\u6d1e\u5bdf</span></button><button class="btn" id="scopeBtn">\u24d8 <span>\u7edf\u8ba1\u53e3\u5f84</span></button></div></div><div class="content" id="content"></div></main></div>`;
  document.getElementById('collapseNav').onclick=()=>document.body.classList.toggle('nav-collapsed');
  document.getElementById('refreshBtn').onclick=()=>location.reload();
  document.getElementById('filterBtn').onclick=()=>document.getElementById('filters').scrollIntoView({behavior:'smooth'});
  document.getElementById('aiBtn').onclick=()=>document.getElementById('recommendations').scrollIntoView({behavior:'smooth'});
  document.getElementById('scopeBtn').onclick=()=>alert('\u53e3\u5f84\uff1a\u5148\u6309\u8bfe\u8017\u8003\u6838\u89c4\u5219\u7b5b\u9009\uff0c\u518d\u4fdd\u7559\u6838\u5fc3 6 \u4e2a SS \u5c0f\u7ec4\uff1b\u9ad8\u8bfe\u8017\u6309\u6708\u8fdb\u5ea6\u8ba1\u7b97\uff0c\u597d\u5b66\u751f\u7387\u6309\u5f53\u6708\u5b8c\u8bfe\u91cf\u8fbe\u5230\u9608\u503c\u8ba1\u7b97\u3002');
  document.getElementById('importBtn').onclick=()=>alert('实习生更新流程：1）将每日课耗源表放入 D:/codex数据/课耗；2）在仓库目录运行 scripts/update-course-dashboard.ps1；3）脚本会自动更新历史数据并推送看板。注意：仓库是公开的，不要把含学员明细的原始 Excel 上传到 GitHub。详细说明见 docs/intern-course-update-guide.md。');
}
function renderHero(){
  const d=DATA, t=total(), ins=buildInsights();
  return `<section class="section-card"><div class="section-head"><div class="section-title-wrap"><div class="section-index">01</div><div><h2 class="section-title">\u8bfe\u8017\u8fd0\u8425\u603b\u89c8</h2><div class="section-sub">\u4ec5\u5c55\u793a\u6e2f\u6fb3 SS \u00b7 \u5f53\u6708\u8fc7\u7a0b\u6307\u6807\u4e0e\u4e0a\u6708\u540c\u65e5\u5bf9\u6bd4</div></div></div><div class="section-mark">COURSE COMMAND</div></div><div class="hero"><div class="date-card"><div class="date-row"><span>\u5f53\u524d\u65e5\u671f</span><b>${d.currentDate}</b></div><div class="date-row"><span>\u5bf9\u6bd4\u65e5\u671f</span><b>${d.priorDate||'-'}</b></div><div class="date-row"><span>\u4e0a\u6708\u540c\u65e5</span><b>${d.lastMonthDate||'-'}</b></div></div></div><section class="insight-strip"><div class="insight-card"><div class="label">\u6838\u5fc3\u7ed3\u8bba</div><strong>${pct(t.rate)} / ${signedPct(t.lift)}</strong><p>${ins.core}</p></div><div class="insight-card"><div class="label">\u8868\u73b0\u4eae\u70b9</div><strong>${ins.best.group||'-'}</strong><p>${ins.bright}</p></div><div class="insight-card"><div class="label">\u9996\u8981\u98ce\u9669</div><strong>${ins.weakest.group||'-'}</strong><p>${ins.risk}</p></div></section></section>`;
}
function renderKpis(){
  const c=DATA.completionRate, m=DATA.overallMetrics, t=total();
  return `<section class="section-card"><div class="section-head"><div class="section-title-wrap"><div class="section-index">02</div><div><h2 class="section-title">\u6838\u5fc3 KPI \u533a</h2><div class="section-sub">\u4e3b\u6307\u6807\u653e\u5927\uff0c\u8f85\u52a9\u6307\u6807\u7d27\u51d1\u5bf9\u6bd4</div></div></div><div class="section-mark">KPI MONITOR</div></div><section class="kpis">${primaryKpiCard()}${metricCard('\u8fc7\u7a0b\u6027\u9ad8\u8bfe\u8017\u5360\u6bd4', m.process_high_ratio.current, 'pct', m.process_high_ratio, '\u25a6', '\u8fc7\u7a0b\u6027\u5148\u884c\u6307\u6807')}${metricCard('\u4eba\u5747\u8bfe\u8017', m.avg_consumption.current, 'num', m.avg_consumption, '\u25b5', '\u53c2\u8003\u503c 12')}${metricCard('0\u8bfe\u8017\u5360\u6bd4', m.zero_consumption_ratio.current, 'pct', m.zero_consumption_ratio, '\u25cb', '\u8003\u6838\u5b66\u5458\u4e2d\u5b8c\u8bfe\u91cf\u4e3a0')}${metricCard('\u597d\u5b66\u751f\u7387', m.good_student_rate.current, 'pct1', m.good_student_rate, '\u2605', '\u9ad8\u8d28\u91cf\u5b66\u5458\u589e\u957f')}</section></section>`;
}
function renderTrendChart(){
  const rows=(DATA.trend||[]).slice(-30); const w=760,h=280,pad=34;
  const vals=rows.map(r=>r.rate).concat([target]); const min=Math.max(0,Math.min(...vals)-.04), max=Math.min(1,Math.max(...vals)+.04);
  const x=i=>pad+(rows.length<=1?0:i*(w-pad*2)/(rows.length-1)); const y=v=>h-pad-((v-min)/(max-min))*(h-pad*2);
  const path=rows.map((r,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(r.rate).toFixed(1)).join(' ');
  const targetY=y(target);
  const dots=rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.rate)}" r="3" fill="#152b52"><title>${r.date} ${pct(r.rate)}</title></circle>`).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="${pad}" y1="${targetY}" x2="${w-pad}" y2="${targetY}" stroke="#168a5b" stroke-dasharray="6 6"/><text x="${w-pad-72}" y="${targetY-8}" fill="#168a5b" font-size="12">${pct(target,0)} target</text><path d="${path}" fill="none" stroke="#152b52" stroke-width="3"/>${dots}<text x="${pad}" y="${h-8}" fill="#667085" font-size="12">${rows[0]?.date||''}</text><text x="${w-pad-80}" y="${h-8}" fill="#667085" font-size="12">${rows[rows.length-1]?.date||''}</text></svg>`;
}
function renderBars(){
  const t=total(); const sorted=groups().slice().sort((a,b)=>b.rate-a.rate);
  return `<div class="bars">${sorted.map(g=>`<div class="bar-row" data-group="${g.group}"><b>${g.group.replace('\u5c0f\u7ec4','')}</b><div class="bar-track"><span class="bar-fill" style="width:${Math.min(g.rate,1)*100}%"></span><i class="avg-line" style="left:${Math.min(t.rate,1)*100}%"></i><i class="target-line" style="left:${target*100}%"></i></div><span class="${g.rate<target?'risk':''}">${pct(g.rate)}</span></div>`).join('')}</div>`;
}
function renderAnalysis(){
  return `<section class="grid-2"><div class="panel"><div class="panel-head"><div><div class="panel-title">\u9884\u8ba1\u5b8c\u8bfe\u7387\u8d8b\u52bf</div><div class="panel-sub">\u6700\u8fd1 30 \u5929 / ${DATA.targetLabel||'\u9636\u6bb5\u76ee\u6807'}\u7ebf</div></div></div><div class="panel-body">${renderTrendChart()}</div></div><div class="panel"><div class="panel-head"><div><div class="panel-title">SS \u5c0f\u7ec4\u8868\u73b0\u6392\u540d</div><div class="panel-sub">\u6a2a\u5411\u6761\u5f62\u56fe\uff0c\u53ef\u70b9\u51fb\u8054\u52a8\u8868\u683c</div></div></div><div class="panel-body">${renderBars()}</div></div></section>`;
}
function historyData(){ return DATA.historicalAnalysis || {distribution:{months:[],buckets:[]}, avgCompletion:{months:[],values:[]}, lifecycle:{columns:[],rows:[]}}; }
function distBucket(label){ return historyData().distribution.buckets.find(b=>b.label===label) || {values:[]}; }
function latestDistributionSummary(){
  const d=historyData().distribution, i=d.months.length-1, p=i-1, yoy=d.months.indexOf('2507');
  const val=(label,idx)=>distBucket(label).values[idx]||0;
  const highAt=idx=>val('>=15',idx)+val('12<=x<15',idx);
  const lowAt=idx=>val('0<x<8',idx)+val('x=0',idx);
  const midAt=idx=>val('10<=x<12',idx)+val('8<=x<10',idx);
  const current={high:highAt(i), low:lowAt(i), middle:midAt(i), top15:val('>=15',i), zero:val('x=0',i), activeLow:val('0<x<8',i)};
  const mom={high:highAt(p), low:lowAt(p), middle:midAt(p), top15:val('>=15',p), zero:val('x=0',p), activeLow:val('0<x<8',p)};
  const yoyData={high:highAt(yoy), low:lowAt(yoy), middle:midAt(yoy), top15:val('>=15',yoy), zero:val('x=0',yoy), activeLow:val('0<x<8',yoy)};
  return {month:d.months[i], prior:d.months[p], yoyMonth:d.months[yoy], ...current, highDelta:current.high-mom.high, zeroDelta:current.zero-mom.zero, top15Delta:current.top15-mom.top15, yoyHighDelta:current.high-yoyData.high, yoyZeroDelta:current.zero-yoyData.zero, yoyTop15Delta:current.top15-yoyData.top15, yoyLowDelta:current.low-yoyData.low, priorData:mom, yoyData};
}
function latestAvgSummary(){
  const a=historyData().avgCompletion || {months:[],values:[]};
  const i=a.months.length-1, p=i-1, yoy=a.months.indexOf('2507');
  const current=a.values[i], prior=a.values[p], yoyValue=a.values[yoy];
  const allRows=a.months.map((m,idx)=>({month:m,value:a.values[idx]}));
  const recent=[allRows[yoy], ...allRows.slice(-8)].filter(Boolean);
  return {month:a.months[i], prior:a.months[p], yoyMonth:a.months[yoy], current, priorValue:prior, yoyValue, delta:current-prior, yoyDelta:current-yoyValue, recent};
}
function latestLifecycleSummary(){
  const l=historyData().lifecycle, row=l.rows[l.rows.length-1]||{values:[]}, prior=l.rows[l.rows.length-2]||{values:[]}, yoy=l.rows.find(r=>r.month==='2507')||{values:[]};
  const cols=l.columns.slice(0,-1);
  const cells=cols.map((c,i)=>({col:c, value:row.values[i]}));
  const priorCells=cols.map((c,i)=>({col:c, value:prior.values[i]}));
  const yoyCells=cols.map((c,i)=>({col:c, value:yoy.values[i]}));
  const validCells=cells.filter(c=>c.value!==null&&c.value!==undefined);
  const weakest=validCells.slice().sort((a,b)=>a.value-b.value)[0]||{};
  const strongest=validCells.slice().sort((a,b)=>b.value-a.value)[0]||{};
  const avgOf=(source,names)=>{ const selected=source.filter(c=>names.includes(c.col)&&c.value!==null&&c.value!==undefined); return selected.reduce((s,c)=>s+c.value,0)/(selected.length||1); };
  const early=avgOf(cells,['M1','M2','M3']), mid=avgOf(cells,['M4','M5','M6','M7','M8']), mature=avgOf(cells,['M9','M10','M11','M12','M12+']);
  const priorEarly=avgOf(priorCells,['M1','M2','M3']), priorMature=avgOf(priorCells,['M9','M10','M11','M12','M12+']);
  const yoyEarly=avgOf(yoyCells,['M1','M2','M3']), yoyMature=avgOf(yoyCells,['M9','M10','M11','M12','M12+']);
  const overall=row.values[l.columns.length-1], priorOverall=prior.values[l.columns.length-1], yoyOverall=yoy.values[l.columns.length-1];
  return {month:row.month, prior:prior.month, yoyMonth:yoy.month, weakest, strongest, early, mid, mature, priorEarly, priorMature, yoyEarly, yoyMature, overall, priorOverall, yoyOverall, overallDelta:overall-priorOverall, yoyOverallDelta:overall-yoyOverall, earlyDelta:early-priorEarly, matureDelta:mature-priorMature, yoyEarlyDelta:early-yoyEarly, yoyMatureDelta:mature-yoyMature};
}
function renderDistributionChart(){
  const d=historyData().distribution;
  const colors=['#168a5b','#69bd83','#d9cf61','#f0b35b','#ef8a5b','#d95d5d'];
  const bars=d.months.map((m,i)=>`<div class="stack-month"><div class="stack-bar">${d.buckets.map((b,bi)=>{ const v=b.values[i]||0; return `<span class="stack-segment ${bi>=2?'is-light':''}" style="height:${v*100}%;background:${colors[bi]}" title="${esc(m)} ${esc(b.label)} ${pct(v,2)}">${v>=.08?pct(v,0):''}</span>`; }).join('')}</div><span>${esc(m)}</span></div>`).join('');
  const legend=d.buckets.map((b,i)=>`<span><i class="legend-dot" style="background:${colors[i]}"></i>${esc(b.label)}</span>`).join('');
  return `<div class="table-wrap"><div class="stacked-chart">${bars}</div></div><div class="dist-legend">${legend}</div>`;
}
function heatColor(value){
  if(value===null||value===undefined) return '#f3f4f6';
  const min=.37, max=.91, t=Math.max(0,Math.min(1,(value-min)/(max-min)));
  const mix=(a,b,p)=>Math.round(a+(b-a)*p);
  const low=[232,102,102], mid=[246,224,92], high=[104,190,91];
  const p=t<.5?t*2:(t-.5)*2;
  const from=t<.5?low:mid, to=t<.5?mid:high;
  const r=mix(from[0],to[0],p), g=mix(from[1],to[1],p), b=mix(from[2],to[2],p);
  return `rgb(${r},${g},${b})`;
}
function renderLifecycleHeatmap(){
  const l=historyData().lifecycle;
  const head=`<tr><th>\u6708\u4efd</th>${l.columns.map(c=>`<th>${c==='overall'?'\u6574\u4f53\u9ad8\u8bfe\u8017\u8fbe\u6210':c}</th>`).join('')}</tr>`;
  const body=l.rows.map((r,ri)=>`<tr>${[`<td>${r.month}</td>`,...r.values.map((v,ci)=>`<td style="background:${heatColor(v)};font-weight:${ri===l.rows.length-1||ci===l.columns.length-1?'760':'520'}">${v===null||v===undefined?'-':pct(v,2)}</td>`)].join('')}</tr>`).join('');
  return `<div class="heatmap-wrap"><table class="heatmap"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
function renderAvgCompletionChart(){
  const a=latestAvgSummary();
  const rows=a.recent || [];
  const max=Math.max(...rows.map(r=>r.value), 13), min=Math.min(...rows.map(r=>r.value), 10);
  const bars=rows.map(r=>{ const height=18+((r.value-min)/(max-min||1))*78; const isLatest=r.month===a.month, isYoy=r.month===a.yoyMonth; return `<div class="avg-bar-item"><div class="avg-value">${num(r.value,2)}</div><div class="avg-bar ${isLatest?'is-latest':isYoy?'is-yoy':''}" style="height:${height}%"></div><span>${esc(r.month)}</span></div>`; }).join('');
  return `<div class="avg-chart">${bars}</div><div class="dist-legend"><span><i class="legend-dot" style="background:#168a5b"></i>${a.month} 8月实际</span><span><i class="legend-dot" style="background:#152b52"></i>近月人均完课量</span></div>`;
}
function renderHistoryInsights(){
  const dist=latestDistributionSummary(), life=latestLifecycleSummary(), avg=latestAvgSummary();
  return `<div class="history-summary"><div class="history-summary-item"><span>\u9ad8\u8bfe\u8017\u5c42\u5360\u6bd4\uff08>=12\uff09</span><b>${pct(dist.high)}</b><div class="${cls(dist.highDelta)}">\u8f83 ${dist.prior} ${signedPct(dist.highDelta)}</div></div><div class="history-summary-item"><span>\u540c\u671f\u4eba\u5747\u5b8c\u8bfe\u91cf</span><b>${num(avg.current,2)}</b><div class="${cls(avg.yoyDelta)}">\u8f83 ${avg.yoyMonth} ${avg.yoyDelta>=0?'+':''}${num(avg.yoyDelta,2)}</div></div><div class="history-summary-item"><span>0\u8bfe\u8017\u5360\u6bd4</span><b>${pct(dist.zero)}</b><div class="${cls(-dist.zeroDelta)}">\u8f83 ${dist.prior} ${signedPct(dist.zeroDelta)}</div></div><div class="history-summary-item"><span>\u751f\u547d\u5468\u671f\u6574\u4f53\u8fbe\u6210</span><b>${pct(life.overall)}</b><div class="${cls(life.overallDelta)}">\u8f83 ${life.prior} ${signedPct(life.overallDelta)}</div></div></div>`;
}
function renderDistributionAnalysis(){
  const d=latestDistributionSummary();
  return `<div class="analysis-block"><h3>\u4e00\u3001\u8bfe\u8017\u533a\u95f4\u7ed3\u6784\u5206\u6790</h3><ul class="analysis-list"><li><b>8\u6708\u5b9e\u9645\u7ed3\u6784\uff1a</b>${d.month} \u9ad8\u8bfe\u8017\u5c42\uff08>=12\uff09\u5360\u6bd4 ${pct(d.high)}\uff0c\u5176\u4e2d >=15 \u9876\u90e8\u5c42 ${pct(d.top15)}\uff0c12-15 \u4e2d\u9ad8\u8bfe\u8017\u5c42 ${pct(d.high-d.top15)}\uff1b0\u8bfe\u8017 ${pct(d.zero)}\uff0c0-8\u8bfe\u8017\u542b0\u8bfe\u8017\u5408\u8ba1 ${pct(d.low)}\u3002\u8fd9\u8bf4\u660e 8\u6708\u5df2\u7ecf\u5b88\u4f4f\u9ad8\u8bfe\u8017\u57fa\u672c\u76d8\uff0c\u4f46\u672a\u542f\u52a8\u548c\u4f4e\u8bfe\u8017\u6c60\u4ecd\u7136\u662f\u62d6\u4f4e\u6700\u7ec8\u5b8c\u8bfe\u7387\u7684\u5173\u952e\u98ce\u9669\u3002</li><li><b>\u5bf9\u6bd4 7\u6708\uff08${d.prior}\uff09\uff1a</b>>=12 \u9ad8\u8bfe\u8017\u5c42 ${signedPct(d.highDelta)}\uff0c\u57fa\u672c\u6301\u5e73\uff1b>=15 \u9876\u90e8\u5c42 ${signedPct(d.top15Delta)}\uff0c12-15 \u4e2d\u9ad8\u5c42\u8865\u4f4d\uff1b0\u8bfe\u8017 ${signedPct(d.zeroDelta)}\u3002\u7ed3\u8bba\uff1a8\u6708\u4e0d\u662f\u201c\u9ad8\u8bfe\u8017\u4eba\u7fa4\u5927\u5e45\u6269\u5f20\u201d\uff0c\u800c\u662f\u201c\u9ad8\u8bfe\u8017\u5927\u76d8\u7a33\u4f4f\uff0c\u9876\u90e8\u5411\u4e2d\u9ad8\u5c42\u8fc1\u79fb\u201d\u3002\u5bf9\u8001\u677f\u6c47\u62a5\u65f6\u53ef\u4ee5\u76f4\u63a5\u8bf4\uff1a\u76ee\u6807\u8fbe\u6210\u80fd\u529b\u8fd8\u5728\uff0c\u4f46\u8bfe\u8017\u8d28\u91cf\u6ca1\u6709\u6bd47\u6708\u66f4\u5c16\uff0c\u9700\u8981\u628a 12-15 \u5b66\u5458\u518d\u63a8\u4e00\u6b65\u3002</li><li><b>\u5bf9\u6bd4 25\u5e747\u6708\uff08${d.yoyMonth}\uff09\uff1a</b>>=12 \u9ad8\u8bfe\u8017\u5c42 ${signedPct(d.yoyHighDelta)}\uff0c0-8\u4f4e\u8bfe\u8017\u6c60 ${signedPct(d.yoyLowDelta)}\uff0c0\u8bfe\u8017 ${signedPct(d.yoyZeroDelta)}\uff0c\u4f46 >=15 \u9876\u90e8\u5c42 ${signedPct(d.yoyTop15Delta)}\u3002\u7ed3\u8bba\uff1a\u540c\u6bd4\u770b\uff0c\u4eca\u5e74\u7684\u4f4e\u8bfe\u8017\u63a7\u5236\u66f4\u597d\uff0c\u9ad8\u8bfe\u8017\u5e95\u76d8\u66f4\u539a\uff1b\u4f46\u8d85\u9ad8\u8bfe\u8017\u5b66\u5458\u6bd4\u53bb\u5e74\u5c11\uff0c\u8bf4\u660e\u4eca\u5e74\u66f4\u50cf\u201c\u5e7f\u8986\u76d6\u8fbe\u6210\u201d\uff0c\u800c\u4e0d\u662f\u201c\u5c16\u5b50\u5b66\u5458\u62c9\u52a8\u201d\u3002</li><li><b>\u52a8\u4f5c\u65b9\u6848\uff1a</b>\u7b2c\u4e00\uff0c\u628a 10-12 \u548c 12-15 \u4e24\u4e2a\u4e34\u754c\u5c42\u5206\u5f00\u7ba1\uff1a10-12 \u8ffd\u52a012\u8282\u8fbe\u6807\uff0c12-15 \u8ffd\u52a015\u8282\u9ad8\u8d28\u91cf\u6807\u6746\uff1b\u7b2c\u4e8c\uff0c0\u8bfe\u8017\u5b66\u5458\u5355\u72ec\u5efa\u6c60\uff0c\u6309\u672a\u7ea6\u8bfe\u3001\u5bb6\u957f\u65e0\u54cd\u5e94\u3001\u8ba1\u5212\u65ad\u6863\u4e09\u7c7b\u62c6\u89e3\u8ddf\u8fdb\uff1b\u7b2c\u4e09\uff0c>=15 \u5b66\u5458\u505a\u6807\u6746\u6848\u4f8b\u548c\u5c0f\u7ec4\u590d\u76d8\uff0c\u8ba9\u4f18\u79c0 SS \u7684\u9884\u7ea6\u8282\u594f\u3001\u5bb6\u957f\u8bdd\u672f\u548c\u6fc0\u52b1\u70b9\u53d8\u6210\u53ef\u590d\u5236\u52a8\u4f5c\u3002</li></ul></div>`;
}
function renderAvgCompletionAnalysis(){
  const a=latestAvgSummary();
  return `<div class="analysis-block"><h3>\u4e8c\u3001\u540c\u671f\u4eba\u5747\u5b8c\u8bfe\u91cf\u5206\u6790</h3><ul class="analysis-list"><li><b>8\u6708\u7ed3\u679c\uff1a</b>${a.month} \u4eba\u5747\u5b8c\u8bfe\u91cf ${num(a.current,2)} \u8282\uff0c\u5bf9\u6bd4 7\u6708 ${num(a.priorValue,2)} \u8282\uff0c\u53d8\u5316 ${a.delta>=0?'+':''}${num(a.delta,2)} \u8282\uff1b\u5bf9\u6bd4 25\u5e747\u6708 ${num(a.yoyValue,2)} \u8282\uff0c\u63d0\u5347 ${a.yoyDelta>=0?'+':''}${num(a.yoyDelta,2)} \u8282\u3002</li><li><b>\u7ba1\u7406\u7ed3\u8bba\uff1a</b>8\u6708\u4eba\u5747\u5b8c\u8bfe\u91cf\u548c7\u6708\u57fa\u672c\u6301\u5e73\uff0c\u8bf4\u660e\u6574\u4f53\u8bfe\u8017\u80fd\u529b\u6ca1\u6709\u5931\u901f\uff1b\u4f46\u5728 0\u8bfe\u8017\u5360\u6bd4\u4e0a\u5347\u7684\u60c5\u51b5\u4e0b\uff0c\u4eba\u5747\u503c\u80fd\u7a33\u4f4f\uff0c\u610f\u5473\u7740\u5df2\u5f00\u52a8\u5b66\u5458\u7684\u4e0a\u8bfe\u5f3a\u5ea6\u5728\u6258\u4f4f\u5927\u76d8\u3002</li><li><b>\u5bf9\u8001\u677f\u6c47\u62a5\u53ef\u8bb2\uff1a</b>\u4eca\u5e74 8\u6708\u6bd425\u5e747\u6708\u9ad8 ${num(a.yoyDelta,2)} \u8282\uff0c\u8bf4\u660e\u8bfe\u8017\u8fd0\u8425\u5df2\u7ecf\u4ece\u201c\u8986\u76d6\u5b66\u5458\u201d\u8fdb\u9636\u5230\u201c\u63d0\u5347\u5355\u4f4d\u5b66\u5458\u5b8c\u8bfe\u5f3a\u5ea6\u201d\uff1b\u4e0b\u4e00\u6b65\u4e0d\u662f\u5355\u7eaf\u62c9\u5927\u76d8\u6d3b\u52a8\uff0c\u800c\u662f\u964d\u4f4e 0\u8bfe\u8017\u5e76\u628a\u4e2d\u9ad8\u5c42\u63a8\u5230 15 \u8282\u4ee5\u4e0a\u3002</li><li><b>\u52a8\u4f5c\u65b9\u6848\uff1a</b>\u6bcf\u6708\u4e0a\u65ec\u5efa\u7acb\u201c0\u8bfe\u8017\u542f\u52a8\u7387\u201d\u65e5\u76d1\u63a7\uff0c\u4e2d\u65ec\u628a 8-12 \u8282\u5b66\u5458\u4f5c\u4e3a\u51b2\u523a\u540d\u5355\uff0c\u4e0b\u65ec\u5bf9 12-15 \u8282\u505a\u9ad8\u8bfe\u8017\u51b2\u523a\uff1b\u8fd9\u6837\u624d\u80fd\u540c\u65f6\u62c9\u9ad8\u4eba\u5747\u8bfe\u8017\u548c\u9ad8\u8bfe\u8017\u5360\u6bd4\u3002</li></ul></div>`;
}
function renderLifecycleAnalysis(){
  const l=latestLifecycleSummary();
  return `<div class="analysis-block"><h3>\u4e09\u3001\u751f\u547d\u5468\u671f\u8bfe\u8017\u8868\u73b0\u5206\u6790</h3><ul class="analysis-list"><li><b>8\u6708\u5b9e\u9645\u8868\u73b0\uff1a</b>${l.month} \u751f\u547d\u5468\u671f\u6574\u4f53\u9ad8\u8bfe\u8017\u8fbe\u6210 ${pct(l.overall)}\uff0c\u6700\u5f3a\u4e3a ${l.strongest.col} ${pct(l.strongest.value)}\uff0c\u6700\u5f31\u4e3a ${l.weakest.col} ${pct(l.weakest.value)}\u3002M2-M4 \u5df2\u7ecf\u5168\u90e8\u8d85\u8fc7 83%\uff0c\u8bf4\u660e\u65b0\u751f\u542f\u52a8\u8d28\u91cf\u5f88\u5f3a\uff1bM10-M12+ \u57fa\u672c\u843d\u5728 63%-66% \u9644\u8fd1\uff0c\u662f\u4e0b\u4e2a\u6708\u6700\u5e94\u4f18\u5148\u76ef\u7684\u4eba\u7fa4\u3002</li><li><b>\u5bf9\u6bd4 7\u6708\uff08${l.prior}\uff09\uff1a</b>\u6574\u4f53 ${signedPct(l.overallDelta)}\uff0cM1-M3 \u65b0\u751f\u671f ${signedPct(l.earlyDelta)}\uff0cM9-M12+ \u6210\u719f\u671f ${signedPct(l.matureDelta)}\u3002\u7ed3\u8bba\uff1a8\u6708\u6574\u4f53\u6bd47\u6708\u66f4\u9ad8\uff0c\u4e3b\u8981\u4ef7\u503c\u5728\u65b0\u751f\u548c\u4e2d\u524d\u6bb5\u7684\u8bfe\u8017\u8d28\u91cf\u63d0\u5347\uff1b\u4f46\u6210\u719f\u671f\u63d0\u5347\u5e45\u5ea6\u6709\u9650\uff0c\u9700\u8981\u5355\u72ec\u4ece\u201c\u7eed\u8bfe\u610f\u613f\u3001\u7ea6\u8bfe\u60ef\u6027\u3001\u5bb6\u957f\u4f53\u611f\u201d\u4e09\u4e2a\u65b9\u5411\u62c6\u89e3\u3002</li><li><b>\u5bf9\u6bd4 25\u5e747\u6708\uff08${l.yoyMonth}\uff09\uff1a</b>\u6574\u4f53 ${signedPct(l.yoyOverallDelta)}\uff0cM1-M3 \u65b0\u751f\u671f ${signedPct(l.yoyEarlyDelta)}\uff0cM9-M12+ \u6210\u719f\u671f ${signedPct(l.yoyMatureDelta)}\u3002\u7ed3\u8bba\uff1a\u540c\u6bd4\u770b\uff0c\u4eca\u5e74\u751f\u547d\u5468\u671f\u5927\u76d8\u660e\u663e\u66f4\u5f3a\uff0c\u5c24\u5176\u524d\u4e2d\u671f\u5b66\u5458\u7684\u8bfe\u8017\u5df2\u7ecf\u88ab\u62c9\u5230\u8f83\u9ad8\u6c34\u4f4d\uff1b\u98ce\u9669\u5728\u4e8e M11/M12/M12+ \u8001\u751f\u540e\u6bb5\u4ecd\u7136\u4f4e\u4e8e66%\u76ee\u6807\u7ebf\uff0c\u5bb9\u6613\u5728\u6708\u5e95\u6210\u4e3a\u62d6\u540e\u817f\u4eba\u7fa4\u3002</li><li><b>\u52a8\u4f5c\u65b9\u6848\uff1a</b>\u56fa\u5b9a\u8ba1\u5212\u53ea\u9002\u5408\u653e\u5728\u65b0\u751f\u671f\uff0c\u56e0\u6b64 M2-M4 \u8981\u628a\u56fa\u5b9a\u8ba1\u5212\u7684\u8986\u76d6\u548c\u6267\u884c\u7a33\u4f4f\uff1bM5-M9 \u8981\u505a\u8282\u70b9\u8ffd\u8e2a\uff0c\u9632\u6b62\u4ece\u9ad8\u4f4d\u56de\u843d\uff1bM10-M12+ \u4e0d\u5efa\u8bae\u518d\u4ee5\u56fa\u5b9a\u8ba1\u5212\u4e3a\u4e3b\u6293\u624b\uff0c\u5efa\u8bae\u5728 SCRM \u5355\u72ec\u5efa\u7acb\u201c\u6210\u719f\u671f\u4f4e\u8bfe\u8017\u201d\u5206\u7ec4\uff0c\u4e0b\u4e2a\u6708\u8ba9 SS \u6309\u65ad\u6863\u9884\u7ea6\u3001\u5bb6\u957f\u4f53\u611f\u3001\u5b66\u5458\u5174\u8da3\u8870\u51cf\u4e09\u7c7b\u8fdb\u884c\u8ddf\u8fdb\u548c\u5524\u9192\u3002</li></ul></div>`;
}
function renderLayerStrategies(){
  const dist=latestDistributionSummary(), life=latestLifecycleSummary();
  const cards=[
    ['\u9ad8\u8bfe\u8017\u7a33\u5b9a\u5c42', '>=12\u8bfe\u8017\u5b66\u5458', `\u5f53\u524d\u5360\u6bd4 ${pct(dist.high)}\uff0c\u7ee7\u7eed\u505a\u8bfe\u8017\u82f1\u96c4\u699c\u3001\u6848\u4f8b\u5916\u5316\u548c\u9636\u6bb5\u6fc0\u52b1\uff0c\u9632\u6b62\u9ad8\u8bfe\u8017\u5b66\u5458\u56de\u843d\u3002`],
    ['\u4e34\u754c\u51b2\u523a\u5c42', '10-12\u8bfe\u8017\u5b66\u5458', `\u5f53\u524d\u4e2d\u95f4\u5c42\u5360\u6bd4 ${pct(dist.middle)}\uff0c\u5efa\u8bae\u6309\u8ddd12\u8282\u5dee\u8ddd\u3001\u8fd1\u671f\u9884\u7ea6\u6b21\u6570\u3001\u5bb6\u957f\u54cd\u5e94\u60c5\u51b5\u505a\u4f18\u5148\u7ea7\uff0c\u628a\u4e34\u754c\u5b66\u5458\u63a8\u5230 12 \u8282\u4ee5\u4e0a\u3002`],
    ['\u98ce\u9669\u62c9\u52a8\u5c42', '0-8\u8bfe\u8017\u5b66\u5458', `0\u8bfe\u8017 ${pct(dist.zero)}\uff0c0-8\u4f4e\u8bfe\u8017+\u672a\u5f00\u52a8\u5408\u8ba1 ${pct(dist.low)}\uff1bSS \u9700\u6309\u672a\u7ea6\u8bfe\u3001\u8ba1\u5212\u65ad\u6863\u3001\u5bb6\u957f\u65e0\u54cd\u5e94\u4e09\u7c7b\u62c6\u89e3\u8ddf\u8fdb\u3002`],
    ['\u751f\u547d\u5468\u671f\u5c42', `${life.weakest.col || 'M12'}\u91cd\u70b9\u5173\u6ce8`, `${life.month} \u6700\u5f31\u751f\u547d\u5468\u671f\u4e3a ${life.weakest.col || '-'}\uff08${pct(life.weakest.value)}\uff09\uff0c\u5efa\u8bae\u5728 SCRM \u91cc\u5355\u72ec\u5efa\u7ec4\uff0c\u4e0b\u4e2a\u6708\u8ba9SS\u91cd\u70b9\u5173\u6ce8\u548c\u5524\u9192\u3002`],
  ];
  return `<div class="strategy-grid">${cards.map(c=>`<div class="strategy-card"><b>${c[0]}</b><span class="tag tag-neutral">${c[1]}</span><p>${c[2]}</p></div>`).join('')}</div>`;
}
function renderHistoricalAnalysis(){
  const dist=latestDistributionSummary(), life=latestLifecycleSummary(), avg=latestAvgSummary();
  return `<section class="panel" id="historyAnalysis"><div class="panel-head"><div><div class="panel-title">\u5386\u53f2\u8bfe\u8017\u7ed3\u6784\u4e0e\u751f\u547d\u5468\u671f\u5206\u6790</div><div class="panel-sub">\u9875\u9762\u6700\u540e\u7684\u6838\u5fc3\u590d\u76d8\u677f\u5757\uff1a\u805a\u7126 8\u6708\u5b9e\u9645\uff0c\u5bf9\u6bd4 7\u6708\u548c25\u5e747\u6708</div></div></div><div class="panel-body">${renderHistoryInsights()}<section><div class="panel-title" style="font-size:16px;margin-bottom:4px">\u4e0d\u540c\u8bfe\u8017\u533a\u95f4\u5360\u6bd4</div><div class="panel-sub" style="margin-bottom:10px">${dist.month} \u9ad8\u8bfe\u8017\u5c42 ${pct(dist.high)}\uff0c0\u8bfe\u8017 ${pct(dist.zero)}\uff1b\u6bcf\u4e2a\u6708\u4efd\u7684\u4e3b\u8981\u533a\u95f4\u5df2\u76f4\u63a5\u6807\u6ce8\u5360\u6bd4</div>${renderDistributionChart()}</section><div style="height:14px"></div>${renderDistributionAnalysis()}<div style="height:18px"></div><section><div class="panel-title" style="font-size:16px;margin-bottom:4px">\u540c\u671f\u4eba\u5747\u5b8c\u8bfe\u91cf</div><div class="panel-sub" style="margin-bottom:10px">${avg.month} \u4eba\u5747 ${num(avg.current,2)} \u8282\uff0c\u8f83 ${avg.prior} ${avg.delta>=0?'+':''}${num(avg.delta,2)} \u8282\uff0c\u8f83 ${avg.yoyMonth} ${avg.yoyDelta>=0?'+':''}${num(avg.yoyDelta,2)} \u8282</div><div class="table-wrap">${renderAvgCompletionChart()}</div></section><div style="height:14px"></div>${renderAvgCompletionAnalysis()}<div style="height:18px"></div><section><div class="panel-title" style="font-size:16px;margin-bottom:4px">\u4e0d\u540c\u751f\u547d\u5468\u671f\u8bfe\u8017\u8868\u73b0</div><div class="panel-sub" style="margin-bottom:10px">${life.month} \u6574\u4f53 ${pct(life.overall)}\uff0c\u6700\u5f3a ${life.strongest.col} ${pct(life.strongest.value)}\uff0c\u6700\u5f31 ${life.weakest.col} ${pct(life.weakest.value)}\uff1b\u70ed\u529b\u56fe\u6bcf\u4e2a\u683c\u5b50\u5747\u5c55\u793a\u5177\u4f53\u6570\u503c</div>${renderLifecycleHeatmap()}</section><div style="height:14px"></div>${renderLifecycleAnalysis()}<div style="height:14px"></div>${renderLayerStrategies()}</div></section>`;
}
function sortGroups(rows){
  return rows.slice().sort((a,b)=>{ const av=a[groupSort.key]??0, bv=b[groupSort.key]??0; return groupSort.dir==='asc'?av-bv:bv-av; });
}
function renderGroupTable(){
  const rows=sortGroups(groups()); const t=total();
  const body=rows.map(r=>{ const st=status(r), rk=riskLevel(r); const topPeople=DATA.personRows.filter(p=>p.group===r.group).slice(0,6); return `<tr data-group="${r.group}"><td><b>${r.group}</b></td><td class="muted">${pct(r.prior_rate)}</td><td><span class="value-strong">${pct(r.rate)}</span></td><td class="${cls(r.lift)}">${signedPct(r.lift)}</td><td>${signedPct(-r.gap_rate)}</td><td>${num(Math.max(r.gap_students,0),0)}</td><td><span class="tag ${rk[1]}">${rk[0]}</span></td><td><span class="tag ${st[1]}">${st[0]}</span></td><td><button class="btn row-toggle" data-group="${r.group}">\u5c55\u5f00</button></td></tr>${expandedGroup===r.group?`<tr class="detail-row"><td colspan="9"><div class="mini-people">${topPeople.map(p=>`<span>${p.ss} \u00b7 ${pct(p.rate)}</span>`).join('')}</div></td></tr>`:''}`; }).join('');
  const totalRow=`<tr class="total-row"><td>\u603b\u8ba1</td><td>${pct(t.prior_rate)}</td><td>${pct(t.rate)}</td><td class="${cls(t.lift)}">${signedPct(t.lift)}</td><td>${signedPct(-t.gap_rate)}</td><td>${num(Math.max(t.gap_students,0),0)}</td><td colspan="3">\u6838\u5fc3 6 \u4e2a SS \u5c0f\u7ec4\u6c47\u603b</td></tr>`;
  return `<section class="section-card" id="groupPanel"><div class="section-head"><div class="section-title-wrap"><div class="section-index">03</div><div><h2 class="section-title">\u5c0f\u7ec4\u6c47\u603b</h2><div class="section-sub">\u5f53\u6708\u8bfe\u8017\u8fdb\u5ea6 \u00b7 \u5c0f\u7ec4\u76ee\u6807\u5dee\u8ddd \u00b7 \u70b9\u51fb\u5c55\u5f00\u5173\u952e SS</div></div></div><div class="section-mark">TEAM SUMMARY</div></div><div class="table-wrap"><table><thead><tr>${['SS \u5c0f\u7ec4','\u6628\u65e5\u9884\u8ba1\u5b8c\u8bfe\u7387','\u5f53\u524d\u9884\u8ba1\u5b8c\u8bfe\u7387','\u65e5\u73af\u6bd4','\u8ddd\u76ee\u6807\u5dee\u503c','\u98ce\u9669\u5b66\u5458\u6570','\u98ce\u9669\u7b49\u7ea7','\u8fd0\u8425\u72b6\u6001','\u64cd\u4f5c'].map((h,i)=>`<th data-sort="${['group','prior_rate','rate','lift','gap_rate','gap_students','rate','rate',''][i]}">${h}</th>`).join('')}</tr></thead><tbody>${body}${totalRow}</tbody></table></div></section>`;
}
function renderPersonTable(){
  const opts=['all',...groups().map(g=>g.group)];
  const current=selectedGroup;
  let rows=DATA.personRows.filter(r=>current==='all'||r.group===current);
  const term=(document.getElementById('personSearch')?.value||'').toLowerCase(); if(term) rows=rows.filter(r=>String(r.ss).toLowerCase().includes(term));
  rows=rows.slice().sort((a,b)=>(b.rate??0)-(a.rate??0)).slice(0,80);
  return `<section class="section-card"><div class="section-head" id="filters"><div class="section-title-wrap"><div class="section-index">04</div><div><h2 class="section-title">\u4e2a\u4eba\u660e\u7ec6\u98ce\u9669\u8868</h2><div class="section-sub">\u6309\u5f53\u524d\u9884\u8ba1\u5b8c\u8bfe\u7387\u6392\u5e8f \u00b7 \u805a\u7126 SS \u4e2a\u4eba\u5dee\u8ddd\u548c\u5f85\u8ddf\u8fdb\u5b66\u5458</div></div></div><div class="section-mark">RISK DETAIL</div></div><div class="filter-row"><select id="groupFilter">${opts.map(o=>`<option value="${o}" ${o===current?'selected':''}>${o==='all'?'\u5168\u90e8\u5c0f\u7ec4':o}</option>`).join('')}</select><input id="personSearch" placeholder="\u641c\u7d22 SS" value="${term}"></div><div class="table-wrap"><table><thead><tr><th>TOP</th><th>SS \u5c0f\u7ec4</th><th>SS</th><th>\u8003\u6838\u5b66\u5458</th><th>\u5f53\u524d\u9884\u8ba1\u5b8c\u8bfe\u7387</th><th>\u65e5\u73af\u6bd4</th><th>\u8ddd\u76ee\u6807\u5dee\u503c</th><th>\u79bb\u8fbe\u6807\u76f8\u5dee\u5b66\u5458\u6570</th><th>\u72b6\u6001</th></tr></thead><tbody>${rows.map((r,i)=>{const st=status(r); return `<tr><td>${i+1}</td><td>${r.group}</td><td><b>${r.ss}</b></td><td>${num(r.assessed,0)}</td><td><span class="value-strong">${pct(r.rate)}</span></td><td class="${cls(r.lift)}">${signedPct(r.lift)}</td><td class="${cls(-r.gap_rate)}">${signedPct(-r.gap_rate)}</td><td>${num(Math.max(r.gap_students,0),0)}</td><td><span class="tag ${st[1]}">${st[0]}</span></td></tr>`;}).join('')}</tbody></table></div></section>`;
}
function renderRecommendations(){
  const ins=buildInsights(); const t=total(); const weak=ins.weakest, fast=ins.fastest;
  const m=DATA.overallMetrics || {};
  const processDelta=m.process_high_ratio?.delta;
  const goodDelta=m.good_student_rate?.delta;
  const weakGap=Math.max(weak.gap_students||0,0);
  const stage=DATA.targetLabel || `\u9636\u6bb5\u76ee\u6807 ${pct(currentTarget())}`;
  const recs=[];
  recs.push(['P0','\u9501\u5b9a\u9636\u6bb5\u76ee\u6807\u7f3a\u53e3\uff0c\u5efa\u7acb\u5c0f\u7ec4\u65e5\u95ed\u73af', weak.group || '\u4f4e\u4e8e\u6574\u4f53\u5c0f\u7ec4', `${weak.group||'-'} \u5f53\u524d ${pct(weak.rate)}\uff0c\u5bf9\u7167${stage}${weakGap>0?`\u8fd8\u5dee ${num(weakGap,0)} \u4eba`:'\u5df2\u8fc7\u7ebf\u4f46\u4ecd\u9700\u7a33\u4f4f'}\uff1b\u5efa\u8bae\u5f53\u5929\u62c6\u5230SS\u4e2a\u4eba\uff0c\u4f18\u5148\u8ddf\u8fdb\u4e34\u754c\u5b66\u5458\u548c0\u8bfe\u8017\u5b66\u5458\u3002`]);
  recs.push(['P0','\u5f31\u52bf\u5c0f\u7ec4\u4e13\u9879\uff1a\u56fa\u5b9a\u8ba1\u5212 + \u8ddf\u8fdb\u95ed\u73af', weak.group || '\u91cd\u70b9\u5c0f\u7ec4', `\u53c2\u8003\u5468\u62a5\uff0c\u56fa\u5b9a\u8ba1\u5212\u662f8\u6708\u8bfe\u8017\u4e3b\u6293\u624b\uff1b\u68c0\u67e5${weak.group||'-'}\u662f\u5426\u6709\u660e\u786e\u62c9\u52a8\u529e\u6cd5\u3001\u662f\u5426\u5b8c\u6210\u8ddf\u8fdb\u95ed\u73af\u3002`]);
  recs.push(['P1','\u590d\u76d8\u6807\u6746\u52a8\u4f5c\u5e76\u505a\u5185\u90e8\u6269\u6563', fast.group || '\u63d0\u5347\u6700\u5feb\u5c0f\u7ec4', `${fast.group||'-'} \u65e5\u73af\u6bd4 ${signedPct(fast.lift)}\uff1b\u5efa\u8bae\u4ea7\u51fa\u201c\u8bfe\u8017\u82f1\u96c4\u699c/\u5206\u4eab\u4f1a\u201d\u7d20\u6750\uff0c\u590d\u76d8\u9884\u7ea6\u3001\u56fa\u5b9a\u8ba1\u5212\u548c\u5bb6\u957f\u6c9f\u901a\u52a8\u4f5c\u3002`]);
  if (processDelta !== null && processDelta !== undefined && processDelta < 0) {
    recs[2]=['P1','\u8fc7\u7a0b\u6027\u9ad8\u8bfe\u8017\u56de\u843d\u9884\u8b66', '\u4f4e\u8bfe\u8017\u4e0e\u4e34\u754c\u5b66\u5458', `\u8fc7\u7a0b\u6027\u9ad8\u8bfe\u8017\u8f83\u6628\u65e5 ${signedPct(processDelta)}\uff0c\u5efa\u8bae\u7528\u5916\u573a\u6d3b\u52a8+\u5185\u573a\u6848\u4f8b\u523a\u6fc0\u4e0a\u8bfe\u79ef\u6781\u6027\uff0c\u5e76\u8865\u9f50\u672c\u5468\u9884\u7ea6\u3002`];
  } else if (goodDelta !== null && goodDelta !== undefined && goodDelta > 0) {
    recs[2]=['P1','\u6c89\u6dc0\u597d\u5b66\u751f\u6848\u4f8b\uff0c\u5f3a\u5316\u6210\u679c\u5916\u5316', '\u597d\u5b66\u751f/\u9ad8\u8bfe\u8017\u5b66\u5458', `\u597d\u5b66\u751f\u7387\u8f83\u6628\u65e5 ${signedPct(goodDelta)}\uff0c\u5efa\u8bae\u6536\u96c6\u9ad8\u8bfe\u8017\u5b66\u5458\u6848\u4f8b\uff0c\u8ba9\u66f4\u591a\u7528\u6237\u770b\u5230\u591a\u4e0a\u8bfe\u7684\u4ef7\u503c\u3002`];
  }
  return `<section class="panel" id="recommendations"><div class="panel-head"><div><div class="panel-title">\u4eca\u65e5\u8fd0\u8425\u5efa\u8bae</div><div class="panel-sub">\u7ed3\u5408\u5f53\u65e5\u6570\u636e + \u5468\u62a5\u65b9\u5411\u52a8\u6001\u751f\u6210</div></div></div><div class="panel-body"><div class="recommendations">${recs.slice(0,3).map(r=>`<div class="rec"><span class="tag ${r[0]==='P0'?'tag-risk':'tag-warn'} priority">${r[0]}</span><b>${r[1]}</b><span class="muted">${r[2]}</span><p class="footer-note">${r[3]}</p></div>`).join('')}</div></div></section>`;
}
function bindInteractions(){
  document.querySelectorAll('[data-sort]').forEach(th=>th.onclick=()=>{ const key=th.dataset.sort; if(!key) return; groupSort={key,dir:groupSort.key===key&&groupSort.dir==='desc'?'asc':'desc'}; renderMain(); });
  document.querySelectorAll('.row-toggle').forEach(btn=>btn.onclick=(e)=>{ expandedGroup=expandedGroup===btn.dataset.group?null:btn.dataset.group; selectedGroup=btn.dataset.group; renderMain(); });
  document.querySelectorAll('.bar-row').forEach(row=>row.onclick=()=>{ selectedGroup=row.dataset.group; document.getElementById('filters')?.scrollIntoView({behavior:'smooth'}); renderMain(); });
  const gf=document.getElementById('groupFilter'); if(gf) gf.onchange=e=>{ selectedGroup=e.target.value; renderMain(); };
  const ps=document.getElementById('personSearch'); if(ps) ps.oninput=()=>renderMain();
}
function renderMain(){
  document.getElementById('content').innerHTML = renderHero()+renderKpis()+renderGroupTable()+renderPersonTable()+`<div style="height:16px"></div>`+renderAnalysis()+`<div style="height:16px"></div>`+renderRecommendations()+`<div style="height:16px"></div>`+renderHistoricalAnalysis()+`<div class="footer-note">\u6570\u636e\u6e90\uff1a\u6838\u5fc3 6 \u4e2a SS \u5c0f\u7ec4\uff0c\u672c\u6b21\u6e90\u8868\u8003\u6838\u5b66\u5458 ${num(DATA.diagnostics.source_rows_assessed,0)} \u4eba\uff0c\u6838\u5fc3 6 \u7ec4 ${num(DATA.diagnostics.core_rows_assessed,0)} \u4eba\u3002</div>`;
  bindInteractions();
}
renderShell(); renderMain();
</script>
<script src="fixed-plan-data.js?v=20260909-import-fix"></script>
<script src="fixed-plan-latest-data.js?v=20260909-import-fix"></script>
<script src="fixed-plan-m01-all-data.js?v=20260813"></script>
<script src="fixed-plan-user-data.js?v=20260813"></script>
<script src="fixed-plan-ticket-data.js?v=20260813"></script>
<script src="vendor/xlsx.full.min.js?v=0.20.3"></script>
<script src="fixed-plan-sync-config.js?v=20260909-import-fix"></script>
<script src="fixed-plan-import.js?v=20260909-import-fix"></script>
<script src="fixed-plan.js?v=20260909-import-fix"></script>
<script src="course-history-data.js?v=20260904-history2608b"></script>
<script src="course-history.js?v=20260904-history2608b"></script>
<script src="core-overview-data.js?v=20260825"></script>
<script src="core-overview.js?v=20260825"></script>
</body>
</html>
"""
    html = html.replace("__PAYLOAD__", payload)
    output_path.write_text(html, encoding="utf-8")

def main():
    parser = argparse.ArgumentParser(description="Build SS course consumption HTML dashboard.")
    parser.add_argument("--source", type=Path, default=None)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--formula", type=Path, default=DEFAULT_FORMULA)
    parser.add_argument("--followup", type=Path, default=None)
    parser.add_argument("--war-report", type=Path, default=None)
    parser.add_argument("--history", type=Path, default=DEFAULT_HISTORY)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--seed-followup", action="store_true")
    parser.add_argument("--refresh-all", action="store_true", help="Reprocess all discovered source files.")
    args = parser.parse_args()

    source_paths = [args.source] if args.source else discover_source_candidates(args.source_dir)
    if not source_paths:
        source_paths = [discover_latest_source(args.source_dir)]
    followup_path = args.followup or discover_latest_followup()
    war_report_path = args.war_report or discover_latest_war_report()
    history = load_history(args.history)
    seed_month_benchmarks(history)
    if not args.source and not args.refresh_all:
        group_dates = {row["date"] for row in history["groups"]}
        overall_dates = {row["date"] for row in history["overall"]}
        missing_paths = [
            path for path in source_paths
            if parse_report_date(path).isoformat() not in group_dates
            or parse_report_date(path).isoformat() not in overall_dates
        ]
        source_paths = missing_paths or [discover_latest_source(args.source_dir)]

    latest_source_path = None
    latest_report_date = None
    latest_diagnostics = None
    latest_overall_metrics = None
    processed_sources = []
    for source_path in source_paths:
        if not source_path or not source_path.exists():
            continue
        report_date = parse_report_date(source_path)
        source_payload, diagnostics = read_source_summary(source_path, report_date)
        upsert_history(history, "groups", source_payload["groups"], source_payload["date"])
        upsert_history(history, "people", source_payload["people"], source_payload["date"])
        overall_metrics = {
            "completion_rate": safe_ratio(
                sum(row["qualified"] for row in source_payload["groups"]),
                sum(row["assessed"] for row in source_payload["groups"]),
            ),
            "avg_consumption": diagnostics.get("avg_consumption"),
            "process_high_ratio": diagnostics.get("process_high_ratio"),
            "good_student_rate": diagnostics.get("good_student_rate"),
            "zero_consumption_ratio": diagnostics.get("zero_consumption_ratio"),
            "zero_consumption_count": diagnostics.get("zero_consumption_count"),
        }
        if not all(value is not None for value in overall_metrics.values()):
            overall_metrics = read_war_report_overall_metrics(war_report_path)
        if not overall_metrics:
            overall_metrics = read_formula_overall_metrics(args.formula)
        if overall_metrics and "good_student_rate" not in overall_metrics:
            overall_metrics["good_student_rate"] = diagnostics["good_student_rate"]
        if overall_metrics:
            upsert_history(history, "overall", [overall_metrics], source_payload["date"])
        latest_source_path = source_path
        latest_report_date = report_date
        latest_diagnostics = diagnostics
        latest_overall_metrics = overall_metrics
        processed_sources.append(str(source_path))

    if followup_path and followup_path.exists():
        seed_history_from_followup(followup_path, history)

    save_history(args.history, history)

    source_path = latest_source_path or discover_latest_source(args.source_dir)
    report_date = latest_report_date or parse_report_date(source_path)
    diagnostics = latest_diagnostics or {"source_rows_assessed": 0, "core_rows_assessed": 0, "excluded_groups": {}}
    overall_metrics = latest_overall_metrics
    dashboard_data = build_dashboard_data(history, diagnostics, report_date)
    render_html(dashboard_data, args.output)

    print(json.dumps({
        "output": str(args.output),
        "history": str(args.history),
        "source": str(source_path),
        "processedSources": processed_sources,
        "followup": str(followup_path) if followup_path else None,
        "warReport": str(war_report_path) if war_report_path else None,
        "currentDate": dashboard_data["currentDate"],
        "priorDate": dashboard_data["priorDate"],
        "sourceRowsAssessed": diagnostics["source_rows_assessed"],
        "coreRowsAssessed": diagnostics["core_rows_assessed"],
        "avgConsumption": overall_metrics.get("avg_consumption") if overall_metrics else None,
        "processHighRatio": overall_metrics.get("process_high_ratio") if overall_metrics else None,
        "goodStudentRate": overall_metrics.get("good_student_rate") if overall_metrics else None,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
