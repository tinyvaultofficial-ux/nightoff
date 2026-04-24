#!/usr/bin/env python
"""PDF 제안서 텍스트 추출 + 구조 분석."""
import sys
from pypdf import PdfReader
from pathlib import Path

src = Path(r"C:\Users\00\Downloads\NAVER WORKS\[정성제안서]2024 도서관의 날 · 도서관 주간 운영_디노마드_최종.pdf")
r = PdfReader(str(src))
n = len(r.pages)
print(f"=== 파일 정보 ===")
print(f"파일: {src.name}")
print(f"총 페이지: {n}")
print(f"메타: {dict(r.metadata) if r.metadata else 'none'}")
print()

# 모든 페이지 텍스트 추출 → 파일 저장 (크기 고려)
out = Path("_pdf_text.txt")
pages_text = []
for i, pg in enumerate(r.pages, 1):
    try:
        t = pg.extract_text() or ""
    except Exception as e:
        t = f"[EXTRACT ERROR: {e}]"
    pages_text.append(t)

# 파일로 저장
with out.open("w", encoding="utf-8") as f:
    for i, t in enumerate(pages_text, 1):
        f.write(f"\n{'='*70}\n=== PAGE {i} / {n} ===\n{'='*70}\n")
        f.write(t)
        f.write("\n")
print(f"텍스트 저장: {out} ({out.stat().st_size // 1024} KB)")
print()

# 첫 3페이지 미리보기
print("=== 첫 3페이지 미리보기 ===")
for i in range(min(3, n)):
    print(f"\n--- PAGE {i+1} ---")
    print(pages_text[i][:500])
