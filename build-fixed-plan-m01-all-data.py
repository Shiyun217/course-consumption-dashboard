import json
import os
from collections import defaultdict
from datetime import date, datetime

from openpyxl import load_workbook


BIND_PATH = os.environ["FP_BIND"]
PAY_PATH = os.environ["FP_PAY"]
BASE_DIR = os.path.dirname(__file__)
JSON_OUTPUT = os.path.join(BASE_DIR, "fixed-plan-m01-all-data.json")
JS_OUTPUT = os.path.join(BASE_DIR, "fixed-plan-m01-all-data.js")
START_MONTH = "2025-02"
END_MONTH = "2026-07"
PORTS = ("CC", "SS", "LP", "student", "other")


def normalize_id(value):
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def to_datetime(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    if isinstance(value, str) and value.strip():
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"):
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                pass
    return None


def month_key(value):
    parsed = to_datetime(value)
    return parsed.strftime("%Y-%m") if parsed else None


def month_index(value):
    year, month = map(int, value.split("-"))
    return year * 12 + month


def month_from_index(value):
    year, offset = divmod(value - 1, 12)
    return f"{year:04d}-{offset + 1:02d}"


def month_range(start, end):
    return [month_from_index(value) for value in range(month_index(start), month_index(end) + 1)]


def normalize_port(value):
    lowered = str(value or "").strip().lower()
    if lowered in ("cc", "ss", "lp"):
        return lowered.upper()
    if lowered == "student":
        return "student"
    return "other"


def rate(count, denominator):
    return count / denominator if denominator else 0


def load_pay_students():
    workbook = load_workbook(PAY_PATH, read_only=True, data_only=True)
    sheet = workbook.active
    headers = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True))
    positions = {name: index for index, name in enumerate(headers)}
    students = {}
    for row in sheet.iter_rows(min_row=2, values_only=True):
        student_id = normalize_id(row[positions["stdt_id"]])
        pay_date = to_datetime(row[positions["first_1v1_nml_pay_date"]])
        if not student_id or not pay_date:
            continue
        current = students.get(student_id)
        if current is None or pay_date < current:
            students[student_id] = pay_date
    return students


def load_binding_touches():
    workbook = load_workbook(BIND_PATH, read_only=True, data_only=True)
    sheet = workbook.active
    headers = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True))
    positions = {name: index for index, name in enumerate(headers)}
    touches_by_month = defaultdict(lambda: defaultdict(set))
    valid_rows = 0
    for row in sheet.iter_rows(min_row=2, values_only=True):
        student_id = normalize_id(row[positions["b.student_id"]])
        binding_month = month_key(row[positions["固定绑定时间"]])
        if not student_id or not binding_month:
            continue
        valid_rows += 1
        touches_by_month[binding_month][normalize_port(row[positions["bind_operator_type"]])].add(student_id)
    return touches_by_month, valid_rows


pay_students = load_pay_students()
touches_by_month, valid_binding_rows = load_binding_touches()
pay_by_month = defaultdict(set)
for student_id, pay_date in pay_students.items():
    pay_by_month[month_key(pay_date)].add(student_id)

rows = []
for report_month in month_range(START_MONTH, END_MONTH):
    previous_month = month_from_index(month_index(report_month) - 1)
    eligible = pay_by_month[previous_month] | pay_by_month[report_month]
    port_students = {}
    for port in PORTS:
        touched = touches_by_month[previous_month][port] | touches_by_month[report_month][port]
        port_students[port] = eligible & touched
    union_students = set().union(*port_students.values())
    touch_sum = sum(len(values) for values in port_students.values())
    multi_port_students = sum(1 for student_id in union_students if sum(student_id in port_students[port] for port in PORTS) > 1)
    denominator = len(eligible)
    rows.append({
        "month": report_month,
        "new_students": denominator,
        "bound_students": len(union_students),
        "binding_rate": rate(len(union_students), denominator),
        "port_counts": {port: len(port_students[port]) for port in PORTS},
        "rates": {port: rate(len(port_students[port]), denominator) for port in PORTS},
        "touch_sum": touch_sum,
        "touch_sum_rate": rate(touch_sum, denominator),
        "overlap_touches": touch_sum - len(union_students),
        "overlap_rate": rate(touch_sum - len(union_students), denominator),
        "multi_port_students": multi_port_students,
        "multi_port_student_rate": rate(multi_port_students, denominator),
        "union_efficiency": rate(len(union_students), touch_sum),
    })

latest = rows[-1]
target_total = 0.65
auxiliary_rate = latest["rates"]["student"] + latest["rates"]["other"]
major_rate = latest["rates"]["CC"] + latest["rates"]["SS"] + latest["rates"]["LP"]
required_touch_sum = target_total / latest["union_efficiency"]
required_major_sum = required_touch_sum
exact = {
    port: required_major_sum * latest["rates"][port] / major_rate
    for port in ("CC", "SS", "LP")
}
rounded = {"CC": 0.33, "SS": 0.38, "LP": 0.25}
rounded_touch_sum = sum(rounded.values())
estimated_total = rounded_touch_sum * latest["union_efficiency"]

result = {
    "source_as_of": "2026-07-31",
    "range": {"start": START_MONTH, "end": END_MONTH},
    "ports": list(PORTS),
    "rows": rows,
    "target": {
        "total": target_total,
        "baseline_period": latest["month"],
        "baseline": {**latest["rates"], "total": latest["binding_rate"], "touch_sum": latest["touch_sum_rate"], "union_efficiency": latest["union_efficiency"]},
        "exact": exact,
        "recommended": rounded,
        "auxiliary_rate": auxiliary_rate,
        "required_touch_sum": required_touch_sum,
        "recommended_touch_sum": rounded_touch_sum,
        "estimated_total": estimated_total,
    },
    "quality": {
        "valid_binding_rows": valid_binding_rows,
        "pay_students": len(pay_students),
        "latest_touch_sum": latest["touch_sum"],
        "latest_bound_students": latest["bound_students"],
        "latest_overlap_touches": latest["overlap_touches"],
    },
}

with open(JSON_OUTPUT, "w", encoding="utf-8") as handle:
    json.dump(result, handle, ensure_ascii=False, indent=2)
with open(JS_OUTPUT, "w", encoding="utf-8") as handle:
    handle.write("window.FIXED_PLAN_M01_ALL_DATA = ")
    json.dump(result, handle, ensure_ascii=False, separators=(",", ":"))
    handle.write(";\n")

print(json.dumps(result, ensure_ascii=False, indent=2))
