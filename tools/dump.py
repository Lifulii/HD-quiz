"""Print a compact view of parsed questions for a given id range.

Usage: python tools/dump.py START END
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
qs = json.loads((ROOT / "data" / "questions_raw.json").read_text(encoding="utf-8"))

start, end = int(sys.argv[1]), int(sys.argv[2])
for q in qs:
    if start <= q["id"] <= end:
        opts = "|".join(q["options"])
        print(f"{q['id']}[{q['type']}:{q['answer']}] {q['stem']} || {opts}")
