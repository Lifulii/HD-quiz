"""Merge raw questions with AI-written explanations into the app data file.

Usage: python tools/build_questions.py
Output: data/questions.js (window.QUESTION_BANK) and data/questions.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "questions_raw.json"
EXP_DIR = ROOT / "data" / "explanations"
OUT_JS = ROOT / "data" / "questions.js"
OUT_JSON = ROOT / "data" / "questions.json"


def apply_fixups(questions):
    """Manual fixups for PDF text extraction glitches."""
    for q in questions:
        if q["id"] == 217:
            assert q["options"] == ["上级团组织", "党支部", "基层党委D同级党组织"]
            q["options"] = ["上级团组织", "党支部", "基层党委", "同级党组织"]
        elif q["id"] == 236:
            q["options"] = [o[:-2] if o.endswith("正确") else o for o in q["options"]]
            assert q["options"][-1] == "常态化发展"
    return questions


def main():
    questions = json.loads(RAW.read_text(encoding="utf-8"))
    questions = apply_fixups(questions)

    explanations = {}
    for f in sorted(EXP_DIR.glob("batch_*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        for k, v in data.items():
            explanations[int(k)] = v

    errors = []
    for q in questions:
        exp = explanations.get(q["id"])
        if not exp:
            errors.append(f"id {q['id']}: missing explanation")
            continue
        if not exp.get("explanation") or not exp.get("mnemonic"):
            errors.append(f"id {q['id']}: empty explanation/mnemonic")
        q["explanation"] = exp["explanation"].strip()
        q["mnemonic"] = exp["mnemonic"].strip()

    extra = set(explanations) - {q["id"] for q in questions}
    if extra:
        errors.append(f"orphan explanation ids: {sorted(extra)}")

    assert len(questions) == 580, len(questions)
    for q in questions:
        assert q["options"], q["id"]
        if q["type"] == "judge":
            assert q["options"] == ["正确", "错误"], q["id"]
            assert q["answer"] in ("A", "B"), q["id"]
        else:
            for ch in q["answer"]:
                idx = ord(ch) - 65
                assert 0 <= idx < len(q["options"]), (q["id"], q["answer"])

    if errors:
        print("ERRORS:")
        for e in errors[:50]:
            print(" -", e)
        sys.exit(1)

    js = "window.QUESTION_BANK = " + json.dumps(questions, ensure_ascii=False) + ";\n"
    OUT_JS.write_text(js, encoding="utf-8")
    OUT_JSON.write_text(json.dumps(questions, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK: {len(questions)} questions -> {OUT_JS.name}, {OUT_JSON.name}")
    print(f"questions.js size: {OUT_JS.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
