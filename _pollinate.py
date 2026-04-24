#!/usr/bin/env python
"""pollinations.ai 로 제안서 2페이지 이미지 생성 테스트."""
import urllib.parse, urllib.request, concurrent.futures, time, os

OUT_DIR = "pollinations_test"
os.makedirs(OUT_DIR, exist_ok=True)

COVER_PROMPT = """Ultra-high-quality A4 landscape proposal cover page, 1920x1080, dark navy blue gradient background from top-left (#0A1B3D) to bottom-right (#1E3A6E), subtle geometric line patterns overlay, premium professional look.

Top-left corner: small uppercase letter-spaced text "COVER" in gold color.

Center-top: huge bold Korean text "경주 과학축전 × 체험 중심 × 안전 무사고" in three parts separated by gold × symbols, pure white color, very large typography, centered.

Center below: "2026 제24회 경북과학축전 행사대행 용역 제안서" medium white text, regular weight, centered.

Bottom-center: "주식회사 디렉터즈 | 2026.05" smaller white text, clean sans-serif.

Thin horizontal gold accent line below the governing message, subtle gold decorative element top-right corner.

Style: Korean government B2G proposal cover, corporate premium, cinematic, clean minimalist, strong typography hierarchy, readable Korean Hangul, presentation-grade quality, 16:9 landscape."""

BODY_PROMPT = """Ultra-high-quality A4 landscape proposal body page, 1920x1080, clean white background with subtle light gray grid.

Top-left: small text "I. 제안 개요" in light gray, uppercase letter-spacing.

Upper center: large bold Korean governing message "과학 대중화 × 체험 중심 설계 × 안전 무사고, 경북과학축전이 원하는 세 가지" in dark navy, with gold/orange underline accent.

Middle: 3-column card grid layout, rounded corners, white cards with gold border and soft drop shadow:
Card 01 left: gold circle icon "01", title "과학 대중화" bold navy, bullets "자체개발 체험 20종 이상" and "초등학생 50% 이상"
Card 02 middle: gold circle "02", title "체험 중심 설계", bullets "관람형 탈피" and "참여형 몰입 콘텐츠"
Card 03 right: gold circle "03", title "안전 무사고", bullets "중대재해처벌법 준수" and "보험 의무 가입"

Bottom: dark navy rounded pill banner with gold left border, text "발주처가 원하는 세 가지를 동시에 완성하는 설계" in white.

Style: Korean B2G government proposal, premium corporate, clean minimalist, strong typography hierarchy, proper Korean Hangul characters, A4 landscape 16:9, presentation-grade quality."""


def fetch(label, prompt, idx):
    q = urllib.parse.quote(prompt)[:1200]  # pollinations URL 한계 고려
    url = f"https://image.pollinations.ai/prompt/{q}?width=1920&height=1080&nologo=true&seed={idx*7+1}"
    out = f"{OUT_DIR}/{label}.png"
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NightOff-Test/1.0"})
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
        with open(out, "wb") as f:
            f.write(data)
        size_kb = len(data) // 1024
        return {"label": label, "ok": True, "path": out, "size_kb": size_kb, "elapsed": round(time.time() - t0, 1)}
    except Exception as e:
        return {"label": label, "ok": False, "error": str(e)[:200], "elapsed": round(time.time() - t0, 1)}


print("pollinations.ai image generation (2 pages, parallel) ...")
print(f"  URL prompt max 1200 chars (truncated if longer)")
print()

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
    futs = {
        ex.submit(fetch, "cover", COVER_PROMPT, 1): "cover",
        ex.submit(fetch, "body", BODY_PROMPT, 2): "body",
    }
    for f in concurrent.futures.as_completed(futs):
        r = f.result()
        if r["ok"]:
            print(f"  OK  {r['label']:6s}  {r['size_kb']:5d} KB  {r['elapsed']:5.1f}s  -> {r['path']}")
        else:
            print(f"  FAIL {r['label']:6s}  {r['elapsed']:5.1f}s  {r['error']}")
