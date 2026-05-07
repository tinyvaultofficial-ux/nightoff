#!/usr/bin/env python3
"""RAG 익명화 — chunks.text 영역에서 회사명 / 전화 / 이메일 영역 마스킹.

5/3 영역 sanitize 패턴 정합. 변경된 chunks 영역 = embedded=0 영역 마킹 →
reembed_sanitized.py 영역 영역 재임베딩 영역.

사용법:
  python rag_sanitize.py                  # dry-run (디폴트, 보고서만)
  python rag_sanitize.py --apply          # 실제 변경 + embedded=0 마킹
  python rag_sanitize.py --prefix=D5      # 특정 prefix 영역만 (chunk_id 영역)

마스킹 패턴:
  회사    → [회사]    (회사명 20개 + 변형 패턴)
  전화    → [전화]    (010-/02-/지역번호 등)
  이메일  → [이메일]  (표준 RFC 영역)

산출물:
  _rag_sanitize_dryrun.txt    (dry-run 영역)
  _rag_sanitize_apply.txt     (apply 영역)
"""
from __future__ import annotations
import argparse
import random
import re
import sqlite3
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

DB_PATH = Path("rag_kb.db")

# ─── 회사명 영역 (5/3 영역 18 + 신규 영역 KBSN / 북앤컬처 = 20개) ───
# 매칭 영역 우선순위: 긴 영역 영역 먼저 (짧은 영역 영역 = 부분 매칭 영역 위험)
COMPANIES = [
    "이엔씨커뮤니케이션스",  # 가장 긴 영역 우선
    "마인즈그라운드",
    "아이엠전시문화",
    "에이앤디자인",
    "URBANPLAY",
    "어반플레이",
    "디렉터즈",
    "케이알씨지",
    "북앤컬처",
    "AXcorp.",
    "에이엑스",
    "KBSN",
    "디노마드",
    "헤럴드",
    "DNMD",
    "MOTZ",
    "모츠",
    "유니원",
    "청청콘",
    "미디컴",
]

# 회사 영역 매칭 영역 — (주) / ㈜ / 주식회사 / 컨소시엄 결합 영역 + 단순 영역
def _build_company_patterns():
    """회사명 영역 영역 변형 영역 패턴 영역 (긴 영역 영역 우선 매칭)."""
    pats = []
    for name in COMPANIES:
        esc = re.escape(name)
        # (주) / ㈜ / 주식회사 / 컨소시엄 영역 결합 영역
        pats.append((re.compile(rf"주식회사\s*{esc}"), "[회사]"))
        pats.append((re.compile(rf"\(주\)\s*{esc}"), "[회사]"))
        pats.append((re.compile(rf"㈜\s*{esc}"), "[회사]"))
        pats.append((re.compile(rf"{esc}\s*\(주\)"), "[회사]"))
        pats.append((re.compile(rf"{esc}\s*㈜"), "[회사]"))
        pats.append((re.compile(rf"{esc}\s*컨소시엄"), "[회사] 컨소시엄"))
    # 단순 회사명 영역 (대표자 영역 / 일반사항 영역에 등장 영역 — 컨텍스트 X 매칭)
    # 짧은 영역 ("MOTZ" 영역 = 영문 단어 영역) = 단어 경계 강제 영역 (부분 매칭 위험 회피)
    for name in COMPANIES:
        esc = re.escape(name)
        # 한글 이름 영역 = 단어 경계 X — 한글 영역 단어 경계 영역 정규식 영역 동작 영역 X 정합 영역
        # 대신 영역 = 앞/뒤 영역 영역 = 한글 영역 X 또는 줄 시작/끝 영역
        if re.match(r"^[A-Za-z\.]+$", name):
            # 영문 영역 = \b 단어 경계 영역
            pats.append((re.compile(rf"\b{esc}\b"), "[회사]"))
        else:
            # 한글 영역 = 단순 영역 매칭 (앞/뒤 한글 영역 영역 = 다른 영역 단어 영역 영역 위험 영역 — 다만 = 회사명 영역 = 보통 영역 단독 영역 등장 영역)
            pats.append((re.compile(esc), "[회사]"))
    return pats


COMPANY_PATTERNS = _build_company_patterns()

# 전화 영역 패턴
PHONE_PATTERNS = [
    re.compile(r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b"),  # 휴대폰 영역
    re.compile(r"\b0[2-9]\d?[-\s]?\d{3,4}[-\s]?\d{4}\b"),   # 지역번호 영역
    re.compile(r"\b\(0[2-9]\d?\)\s*\d{3,4}[-\s]?\d{4}\b"), # (02) 1234-5678 영역
    re.compile(r"\b15\d{2}[-\s]?\d{4}\b"),                  # 1588-XXXX / 1577-XXXX 영역
]

# 이메일 영역 패턴 (RFC 5322 영역 단순화 영역)
EMAIL_PATTERN = re.compile(r"\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b")


def sanitize_text(text: str) -> tuple[str, dict]:
    """text 영역 sanitize 영역 → (변경 후 영역, 카운트 영역).

    카운트 영역 = {company: int, phone: int, email: int, hits: {회사명: int}}.
    """
    counts = {"company": 0, "phone": 0, "email": 0, "hits": {}}
    out = text

    # 회사 영역 매칭 영역 — 긴 영역 영역 우선 영역 (이미 영역 정렬 영역)
    for pat, repl in COMPANY_PATTERNS:
        # 매칭 영역 = 회사명 영역 추출 영역 (보고용)
        matches = pat.findall(out)
        if matches:
            n = len(matches)
            counts["company"] += n
            # 회사명 영역 추출 영역 — 패턴 영역에서 영역 raw 영역
            for name in COMPANIES:
                if name in pat.pattern or re.escape(name) in pat.pattern:
                    counts["hits"][name] = counts["hits"].get(name, 0) + n
                    break
        out = pat.sub(repl, out)

    # 전화 영역
    for pat in PHONE_PATTERNS:
        n = len(pat.findall(out))
        counts["phone"] += n
        out = pat.sub("[전화]", out)

    # 이메일 영역
    n = len(EMAIL_PATTERN.findall(out))
    counts["email"] += n
    out = EMAIL_PATTERN.sub("[이메일]", out)

    return out, counts


def main():
    parser = argparse.ArgumentParser(description="RAG chunks 영역 익명화 (회사명 / 전화 / 이메일)")
    parser.add_argument("--apply", action="store_true",
                        help="실제 변경 + embedded=0 영역 마킹 (디폴트 = dry-run)")
    parser.add_argument("--prefix", type=str, default="",
                        help="chunk_id prefix 영역 필터 (예: D5). 비어 있으면 전체.")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"ERROR: {DB_PATH} not found")
        sys.exit(1)

    apply_mode = args.apply
    mode_str = "APPLY" if apply_mode else "DRY-RUN"
    out_path = Path("_rag_sanitize_apply.txt" if apply_mode else "_rag_sanitize_dryrun.txt")

    print(f"=== RAG sanitize {mode_str} ===")
    print(f"  DB:        {DB_PATH}")
    print(f"  prefix:    {args.prefix or '(all)'}")
    print(f"  output:    {out_path}")
    print()

    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row

    # 대상 chunks 영역
    if args.prefix:
        rows = db.execute(
            "SELECT rowid, chunk_id, text FROM chunks WHERE chunk_id LIKE ? ORDER BY rowid",
            (f"{args.prefix}__%",),
        ).fetchall()
    else:
        rows = db.execute("SELECT rowid, chunk_id, text FROM chunks ORDER BY rowid").fetchall()

    n_total = len(rows)
    print(f"  대상 chunks: {n_total:,}")
    if n_total == 0:
        print("  nothing to do.")
        return

    # 변경 영역 처리
    total_counts = {"company": 0, "phone": 0, "email": 0}
    company_hits: dict[str, int] = {}
    changed_rows: list[tuple] = []  # (rowid, before, after, counts)

    for r in rows:
        before = r["text"] or ""
        after, c = sanitize_text(before)
        if after != before:
            changed_rows.append((r["rowid"], r["chunk_id"], before, after, c))
            total_counts["company"] += c["company"]
            total_counts["phone"] += c["phone"]
            total_counts["email"] += c["email"]
            for name, n in c["hits"].items():
                company_hits[name] = company_hits.get(name, 0) + n

    n_changed = len(changed_rows)
    pct = n_changed * 100 / n_total if n_total else 0
    print(f"  변경 chunks: {n_changed:,} ({pct:.1f}%)")
    print(f"  - company: {total_counts['company']}")
    print(f"  - phone:   {total_counts['phone']}")
    print(f"  - email:   {total_counts['email']}")
    print()
    print(f"  회사명 매칭 분포:")
    for name, n in sorted(company_hits.items(), key=lambda x: -x[1]):
        print(f"    {n:>5}  {name}")

    # 보고서 영역 생성
    report_lines = []
    report_lines.append(f"# RAG sanitize {mode_str} report\n")
    report_lines.append(f"target chunks: {n_total}")
    report_lines.append(f"prefix filter: {args.prefix or '(all)'}")
    report_lines.append(f"chunks changed: {n_changed} ({pct:.1f}%)\n")
    report_lines.append("## 변경 통계 (회수)")
    report_lines.append(f"  company  :  {total_counts['company']:>5}")
    report_lines.append(f"  phone    :  {total_counts['phone']:>5}")
    report_lines.append(f"  email    :  {total_counts['email']:>5}\n")
    report_lines.append("## 회사명 매칭 분포")
    for name, n in sorted(company_hits.items(), key=lambda x: -x[1]):
        report_lines.append(f"    {n:>5}  {name}")
    report_lines.append("")

    # random 100 sample (before → after)
    sample_n = min(100, n_changed)
    samples = random.sample(changed_rows, sample_n) if sample_n > 0 else []
    report_lines.append(f"## random {sample_n} sample (before → after, 각 600자 cap)\n")
    for rid, cid, before, after, c in samples:
        report_lines.append(f"--- {cid} ---")
        report_lines.append(f"[BEFORE]\n{before[:600]}\n")
        report_lines.append(f"[AFTER]\n{after[:600]}\n")
        report_lines.append("")

    out_path.write_text("\n".join(report_lines), encoding="utf-8")
    print()
    print(f"  보고서: {out_path}")

    if not apply_mode:
        print()
        print("  [DRY-RUN] DB 영역 변경 X. --apply 영역 영역 실제 적용.")
        return

    # ── APPLY: DB UPDATE + embedded=0 마킹 ──
    print()
    print(f"  [APPLY] DB 영역 변경 영역 시작...")
    for rid, cid, before, after, c in changed_rows:
        db.execute("UPDATE chunks SET text=?, embedded=0 WHERE rowid=?", (after, rid))
    db.commit()
    print(f"  {n_changed:,} chunks 영역 UPDATE 완료 (embedded=0 영역 마킹).")
    print()

    # 검증
    e1 = db.execute("SELECT COUNT(*) FROM chunks WHERE embedded=1").fetchone()[0]
    e0 = db.execute("SELECT COUNT(*) FROM chunks WHERE embedded=0").fetchone()[0]
    print(f"  post-state: embedded=1: {e1:,}, embedded=0: {e0:,}")
    print(f"  → 다음 단계: python reembed_sanitized.py --apply")


if __name__ == "__main__":
    main()
