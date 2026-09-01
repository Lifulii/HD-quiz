"""Parse the PDF question bank into structured JSON.

Usage: python tools/extract_questions.py
Output: data/questions_raw.json
"""
import json
import re
import sys
from pathlib import Path

import pypdf

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "中国华电集团有限公司青年理论知识网络学习竞赛题库（第二期）.pdf"
OUT = ROOT / "data" / "questions_raw.json"

TYPE_MAP = {"单选题": "single", "多选题": "multi", "判断题": "judge"}


def extract_full_text() -> str:
    reader = pypdf.PdfReader(str(PDF))
    chunks = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return "\n".join(chunks)


def clean_text(text: str) -> str:
    # Remove page markers like "- 1 -".
    text = re.sub(r"—\s*\d+\s*—", "", text)
    return text


def find_appendix_start(text: str) -> int:
    """Locate the appendix (reference material) so it is excluded."""
    matches = list(re.finditer(r"附录[：:]\s*学习培训参考资料", text))
    return matches[-1].start() if matches else len(text)


def split_sections(text: str):
    """Yield (part_name, type_key, expected_count, section_text)."""
    part_re = re.compile(r"第([一二三四五六七])部分[：:]\s*(\S+)")
    type_re = re.compile(r"([一二三])[、.](单选题|多选题|判断题)[（(]共?\s*(\d+)\s*题[)）]")

    body_start = None
    for m in part_re.finditer(text):
        tail = text[m.end(): m.end() + 60]
        if re.match(r"\s*一[、.]单选题[（(]共\s*\d+\s*题[)）]", tail):
            body_start = m.start()
            break
    if body_start is None:
        raise RuntimeError("could not locate question body start")

    body = text[body_start:find_appendix_start(text)]

    events = []
    for m in part_re.finditer(body):
        events.append((m.start(), "part", m.group(2), None))
    for m in type_re.finditer(body):
        events.append((m.start(), "type", m.group(2), int(m.group(3))))
    events.sort(key=lambda e: e[0])

    current_part = None
    for i, (pos, kind, name, count) in enumerate(events):
        end = events[i + 1][0] if i + 1 < len(events) else len(body)
        if kind == "part":
            current_part = name.strip()
        else:
            yield current_part, TYPE_MAP[name], count, body[pos:end]


def parse_questions(section_text: str):
    """Split a section into (num, raw_text) chunks using sequential numbering.

    Question numbers must appear in order 1..N so that decimals such as
    "85.1-2024" or "43.9%" inside stems/options are not mistaken for marks.
    """
    m = re.search(r"[)）]", section_text)
    content = section_text[m.end():] if m else section_text
    marks = []
    pos = 0
    next_num = 1
    while True:
        pat = re.compile(r"(?<![\d.])(" + str(next_num) + r")[.、]")
        mm = pat.search(content, pos)
        if not mm:
            break
        marks.append(mm)
        pos = mm.end()
        next_num += 1
    questions = []
    for i, mark in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(content)
        questions.append((int(mark.group(1)), content[mark.end():end]))
    return questions


OPTION_RE = re.compile(r"([A-J])[.、]")


def parse_one(num: int, raw: str, qtype: str):
    ans_m = re.search(r"答案[：:]\s*([A-J]+|正确|错误|对|错)", raw)
    if not ans_m:
        return None
    answer_raw = ans_m.group(1)
    body = raw[: ans_m.start()]
    body = re.sub(r"\s+", "", body)

    if qtype == "judge":
        answer = "A" if answer_raw in ("正确", "对", "A") else "B"
        return {"num": num, "stem": body, "options": ["正确", "错误"], "answer": answer}

    opt_marks = list(OPTION_RE.finditer(body))
    if len(opt_marks) < 2:
        return None
    stem = body[: opt_marks[0].start()]
    options = []
    for i, om in enumerate(opt_marks):
        end = opt_marks[i + 1].start() if i + 1 < len(opt_marks) else len(body)
        options.append(body[om.end():end])
    letters = [om.group(1) for om in opt_marks]
    if letters != [chr(ord("A") + i) for i in range(len(letters))]:
        return None
    if qtype == "single" and len(answer_raw) != 1:
        return None
    if qtype == "multi" and len(answer_raw) < 2:
        return None
    for ch in answer_raw:
        if ch not in letters:
            return None
    return {"num": num, "stem": stem, "options": options, "answer": answer_raw}


def main():
    text = clean_text(extract_full_text())
    all_questions = []
    errors = []
    for part, qtype, expected, section in split_sections(text):
        parsed = parse_questions(section)
        got = []
        for num, raw in parsed:
            q = parse_one(num, raw, qtype)
            if q is None:
                errors.append(f"{part}/{qtype}/#{num}: parse failed: {raw[:80]!r}")
                continue
            q["part"] = part
            q["type"] = qtype
            got.append(q)
        if len(got) != expected:
            errors.append(f"{part}/{qtype}: expected {expected}, got {len(got)}")
        all_questions.extend(got)

    for i, q in enumerate(all_questions, 1):
        q["id"] = i

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(all_questions, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"total questions: {len(all_questions)}")
    from collections import Counter

    print(Counter((q["part"], q["type"]) for q in all_questions))
    if errors:
        print("ERRORS:")
        for e in errors[:40]:
            print(" -", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
