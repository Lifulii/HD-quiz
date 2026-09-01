"""Scan parsed questions for options with glued letters or trailing judge words."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
qs = json.loads((ROOT / "data" / "questions_raw.json").read_text(encoding="utf-8"))

for q in qs:
    if q["type"] == "judge":
        continue
    for o in q["options"]:
        if re.search(r"[A-J][一-鿿“《]", o):
            print(q["id"], "GLUE", repr(o))
        if o.endswith("正确") or o.endswith("错误"):
            print(q["id"], "TAIL", repr(o))
print("scan done")
