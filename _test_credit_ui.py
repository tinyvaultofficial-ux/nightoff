"""오늘의 무료 크레딧 UI 정적 검증 — _test_auth.py 패턴 정합.

DOM 의존 X (Python에선 어려움) — 정적 검증만:
  - dead code (fake-ad 잔존) 검증
  - 신규 함수 정의 검증
  - endpoint 호출 매핑 검증
  - CSS 클래스 정의 + 정렬 정합 검증
  - JS brace 정합 검증

회귀 보호용. 백엔드 endpoint round-trip 검증은 _test_credit.py 별도.

사용:
  python _test_credit_ui.py
"""
from __future__ import annotations

import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

JS = open("static/app.js", encoding="utf-8").read()
CSS = open("static/style.css", encoding="utf-8").read()

_passed = 0
_failed = 0


def assert_true(label: str, cond: bool):
    global _passed, _failed
    if cond:
        print(f"  PASS  {label}")
        _passed += 1
    else:
        print(f"  FAIL  {label}")
        _failed += 1


# ─── 1. JS — fake-ad dead code 제거 ─────────────────────────────────────
print("\n=== 1. JS — fake-ad dead code 제거 ===")
# 함수 / 데이터 / DOM 클래스 — 모두 제거되어야 함 (주석 안 텍스트는 OK).
for pat in ("FAKE_AD_LINES", "renderFakeAdBanner",
            "fake-ad-headline", "fake-ad-body", "fake-ad-cta", "fake-ad-close"):
    # 주석/문자열 컨텍스트가 아닌 식별자 형태 검증
    occurrences = [
        line for line in JS.splitlines()
        if pat in line and not line.lstrip().startswith("//")
    ]
    assert_true(f"{pat} 식별자 잔존 X", len(occurrences) == 0)


# ─── 2. JS — daily-credit 신규 함수 ────────────────────────────────────
print("\n=== 2. JS — daily-credit 함수 정의 ===")
for fn in ("renderDailyCreditCard", "renderCreditQuizSlide",
           "renderCreditLottoSlide", "renderCreditFortuneSlide"):
    assert_true(f"function {fn} 정의", bool(re.search(rf"function {fn}\(", JS)))


# ─── 3. JS — rightCol 교체 ─────────────────────────────────────────────
print("\n=== 3. JS — rightCol 호출 교체 ===")
assert_true(
    "rightCol.appendChild(renderDailyCreditCard())",
    "rightCol.appendChild(renderDailyCreditCard())" in JS,
)
# 구 함수 호출은 완전 제거
no_old_call = not re.search(r"rightCol\.appendChild\(renderFakeAdBanner\(\)\)", JS)
assert_true("renderFakeAdBanner() 호출 제거", no_old_call)


# ─── 4. JS — endpoint 호출 매핑 ────────────────────────────────────────
print("\n=== 4. JS — endpoint 호출 매핑 ===")
endpoints = [
    "/api/credit/quiz/today", "/api/credit/quiz/check",
    "/api/credit/lotto/today", "/api/credit/lotto/draw",
    "/api/credit/fortune", "/api/credit/balance",
]
for ep in endpoints:
    assert_true(f"endpoint {ep}", ep in JS)


# ─── 5. JS — 핵심 흐름 검증 ────────────────────────────────────────────
print("\n=== 5. JS — 핵심 흐름 ===")
assert_true("5초 자동 롤링 (setInterval 5000)", bool(re.search(r"setInterval\(.*?,\s*5000\s*\)", JS, re.DOTALL)))
assert_true("호버 정지 — mouseenter listener", 'addEventListener("mouseenter"' in JS)
assert_true("호버 resume — mouseleave listener", 'addEventListener("mouseleave"' in JS)
assert_true("DOM 제거 시 cleanup (document.body.contains)", "document.body.contains(card)" in JS)
assert_true("Enter 키 정합 (퀴즈)", '"Enter"' in JS and "submitBtn.click()" in JS)
assert_true("슬롯머신 spinning class toggle", '"spinning"' in JS)
assert_true("슬롯머신 ~2초 (count > 24, 80ms 인터벌)", "count > 24" in JS)
assert_true("응답 후 1.2초 정착", "1200" in JS)


# ─── 6. JS — 1일 1회 가드 후 UI 비활성 ──────────────────────────────────
print("\n=== 6. JS — 1일 1회 가드 후 비활성 ===")
assert_true("input.disabled = true", "input.disabled = true" in JS)
assert_true("submitBtn.disabled = true", "submitBtn.disabled = true" in JS)
assert_true("내일 다시 도전! 텍스트", "내일 다시 도전!" in JS)


# ─── 7. JS — renderDailyCreditCard brace 정합 ──────────────────────────
print("\n=== 7. JS — renderDailyCreditCard brace 정합 ===")
fn_block = re.search(r"function renderDailyCreditCard\(\) \{(.+?)^}", JS, re.DOTALL | re.MULTILINE)
assert_true("renderDailyCreditCard 함수 본문 추출", fn_block is not None)
if fn_block:
    body = fn_block.group(1)
    assert_true(f"brace 정합 ({{{body.count('{')} = }}{body.count('}')})",
                body.count("{") == body.count("}"))


# ─── 8. CSS — daily-credit 클래스 정의 ─────────────────────────────────
print("\n=== 8. CSS — daily-credit 클래스 정의 ===")
expected_classes = [
    ".daily-credit", ".daily-credit-head", ".daily-credit-title",
    ".daily-credit-chip", ".daily-credit-sub", ".daily-credit-slides",
    ".credit-slide", ".credit-slide-label", ".credit-slide-headline",
    ".credit-slide-input", ".credit-slide-submit", ".credit-slide-result",
    ".credit-lotto-balls", ".credit-lotto-ball", ".credit-lotto-winning-row",
    ".credit-lotto-winning-ball", ".credit-fortune-message",
    ".daily-credit-nav", ".daily-credit-arrow", ".daily-credit-dots",
    ".daily-credit-dot", ".daily-credit-footer",
]
for cls in expected_classes:
    assert_true(f"{cls} 정의", cls in CSS)


# ─── 9. CSS — fake-ad dead style 제거 ──────────────────────────────────
print("\n=== 9. CSS — fake-ad dead style 제거 ===")
# CSS 셀렉터 안 .fake-ad 매칭 — 주석 X
fake_ad_selectors = re.findall(r"^\.fake-ad[\w\-]*\s*[,\{]", CSS, re.MULTILINE)
assert_true(f"fake-ad CSS 셀렉터 0건 ({len(fake_ad_selectors)})", len(fake_ad_selectors) == 0)


# ─── 10. CSS — 정렬 정합 (좌측 끝줄 정합) ──────────────────────────────
print("\n=== 10. CSS — 정렬 정합 ===")
assert_true(
    ".dashboard-side-col > .daily-credit flex 1 1 auto",
    ".dashboard-side-col > .daily-credit" in CSS and "flex: 1 1 auto" in CSS,
)
assert_true(
    ".credit-slide absolute inset:0",
    ".credit-slide {" in CSS and "inset: 0" in CSS,
)
assert_true(
    ".credit-slide.active opacity:1",
    ".credit-slide.active {" in CSS,
)


# ─── 11. CSS — 슬롯머신 keyframe ────────────────────────────────────────
print("\n=== 11. CSS — lotto-spin keyframe ===")
assert_true("@keyframes lotto-spin", "@keyframes lotto-spin" in CSS)
assert_true(".credit-lotto-ball.spinning animation",
            ".credit-lotto-ball.spinning" in CSS and "animation: lotto-spin" in CSS)


# ─── 결과 ────────────────────────────────────────────────────────────────
total = _passed + _failed
print()
print(f"=== 결과: {_passed}/{total} PASS  ({_failed} FAIL) ===")
sys.exit(0 if _failed == 0 else 1)
