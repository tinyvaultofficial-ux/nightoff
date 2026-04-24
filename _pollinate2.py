#!/usr/bin/env python
"""본문 이미지만 짧은 프롬프트로 재시도."""
import urllib.parse, urllib.request, time, os

OUT_DIR = "pollinations_test"
os.makedirs(OUT_DIR, exist_ok=True)

BODY_PROMPT = """A4 landscape proposal page, white background with thin grid.
Top-left small gray text: "I. 제안 개요".
Center bold navy headline: "과학 대중화 × 체험 중심 설계 × 안전 무사고, 경북과학축전이 원하는 세 가지", gold × symbols, gold underline.
Three white cards in row with rounded corners, gold border, drop shadow:
Card 01: gold circle "01", bold navy "과학 대중화", bullets "자체개발 체험 20종 이상", "초등학생 50% 이상"
Card 02: gold circle "02", bold navy "체험 중심 설계", bullets "관람형 탈피", "참여형 몰입 콘텐츠"
Card 03: gold circle "03", bold navy "안전 무사고", bullets "중대재해처벌법 준수", "보험 의무 가입"
Bottom navy pill banner gold left border, white text "발주처가 원하는 세 가지를 동시에 완성하는 설계".
Korean B2G government proposal, premium corporate, clean minimalist, readable Korean Hangul, 16:9 landscape, 1920x1080."""

q = urllib.parse.quote(BODY_PROMPT)
print(f"prompt chars: {len(BODY_PROMPT)}  encoded: {len(q)}")
url = f"https://image.pollinations.ai/prompt/{q}?width=1920&height=1080&nologo=true&seed=14"
out = f"{OUT_DIR}/body.png"

t0 = time.time()
try:
    req = urllib.request.Request(url, headers={"User-Agent": "NightOff-Test/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = r.read()
    with open(out, "wb") as f:
        f.write(data)
    print(f"OK  body  {len(data)//1024} KB  {round(time.time()-t0, 1)}s  -> {out}")
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='ignore')[:500]
    print(f"FAIL HTTP {e.code}: {body}")
except Exception as e:
    print(f"FAIL {e}")
