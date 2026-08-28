import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "outputs" / "course_history_20260810" / "history_analysis.json"
TARGET = ROOT / "course-history-data.js"


data = json.loads(SOURCE.read_text(encoding="utf-8"))
TARGET.write_text(
    "window.COURSE_HISTORY_DATA = "
    + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    + ";\n",
    encoding="utf-8",
)
print(TARGET)
