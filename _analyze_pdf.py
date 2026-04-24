#!/usr/bin/env python
"""추출된 텍스트에서 의미 있는 페이지만 뽑아서 구조 분석 — 출력 파일로."""
import re
from pathlib import Path

raw = Path("_pdf_text.txt").read_text(encoding="utf-8")

# 페이지 분리: "\n=== PAGE N / M ===\n" 로 split
parts = re.split(r'\n=+\n=== PAGE (\d+) / \d+ ===\n=+\n', raw)
# parts[0] is preamble, then pairs of (num, text)
pages = []
for i in range(1, len(parts), 2):
    num = int(parts[i])
    text = parts[i+1] if i+1 < len(parts) else ""
    pages.append((num, text.strip()))

out = Path("_pdf_report.txt")
with out.open("w", encoding="utf-8") as f:
    f.write(f"추출된 페이지 수: {len(pages)}\n")
    # 길이 분포
    lengths = [(n, len(t)) for n, t in pages]
    long_p   = [(n, l) for n, l in lengths if l > 100]
    med_p    = [(n, l) for n, l in lengths if 10 < l <= 100]
    empty_p  = [n for n, l in lengths if l <= 10]
    f.write(f"  긴 (>100자): {len(long_p)}개 → {[n for n,_ in long_p]}\n")
    f.write(f"  중 (10~100자): {len(med_p)}개\n")
    f.write(f"  빈: {len(empty_p)}개\n\n")

    f.write("=" * 70 + "\n")
    f.write("중간 길이 페이지 (섹션/목차 힌트)\n")
    f.write("=" * 70 + "\n")
    for n, l in med_p:
        text = next(t for num, t in pages if num == n)
        one = re.sub(r'\s+', ' ', text).strip()
        f.write(f"P{n:2d} ({l:3d}자): {one[:200]}\n")

    f.write("\n" + "=" * 70 + "\n")
    f.write("긴 텍스트 페이지 — 전문\n")
    f.write("=" * 70 + "\n")
    for n, l in long_p:
        text = next(t for num, t in pages if num == n)
        f.write(f"\n{'─'*70}\n")
        f.write(f"PAGE {n} ({l} chars)\n")
        f.write('─' * 70 + "\n")
        f.write(text[:3000])
        f.write("\n")

print(f"Report saved: {out} ({out.stat().st_size} bytes)")
