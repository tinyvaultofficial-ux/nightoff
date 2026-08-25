"""color_utils — 대비 보장 색 유틸 (순수 함수 모듈).

Spec Color-Utils-1 (컬러화 이식 1단계).
독립 모듈. 어디서도 import·사용하지 않는다 (신설 단계).
후속 단계에서 theme.py / pptx_generator.py 가 필요 시 import.

[설계 원칙]
- 순수 함수만 (외부 상태·부작용·전역 캐시 없음)
- 입력·출력 hex 문자열로 통일 ("#RRGGBB") — 제품 코드 색 표기 정합
- 정규화 관대: "#fff", "#FFFFFF", "fff", "FFFFFF" 모두 허용
- PIL 의존은 지연 import (색 계산만 쓸 때 PIL 없어도 동작)
- 실패 시 예외 없이 관대 폴백 (잘못된 hex → 검정 취급)

[제공 함수]
- normalize_hex(hex_or_short) -> str
- hex_to_rgb(hex_str)         -> tuple[int, int, int]
- rgb_to_hex(rgb)             -> str
- rel_luminance(hex_or_rgb)   -> float  (WCAG 상대 휘도, 0.0~1.0)
- contrast_ratio(fg, bg)      -> float  (WCAG 대비비, 1.0~21.0)
- pick_fg(bg, options=..., threshold=4.5) -> str  (대비 통과 fg 자동 선택)
- blend(base, overlay, alpha) -> str  (alpha 블렌드; 오버레이 위 실효 배경 계산용)
- img_avg_luminance(path)     -> (rgb_tuple, luminance)  (PIL 지연 import)

[WCAG 기준값]
- AA:  4.5:1 (본문 텍스트 최소)
- AAA: 7.0:1 (강화 기준)
- AA-Large (18pt+ / 14pt bold+): 3.0:1
"""
from __future__ import annotations

from typing import Iterable, Optional


# ─── 기본 색 (fallback 후보) ─────────────────────────────
BLACK = "#1A1A1A"        # 순수 #000 대신 살짝 들뜬 검정 (제품 정합)
WHITE = "#FFFFFF"
NEAR_WHITE = "#FEFEFE"   # 검정 배경 위 흰 텍스트에 살짝 부드럽게

# ─── WCAG 기준 상수 ──────────────────────────────────────
WCAG_AA = 4.5            # 본문 텍스트 최소 대비비
WCAG_AAA = 7.0           # 강화 기준
WCAG_AA_LARGE = 3.0      # 18pt 이상 or 14pt bold 이상


# ─── hex 정규화·변환 ─────────────────────────────────────
def normalize_hex(hex_str: str) -> str:
    """hex 정규화: 접두 # 강제, 대문자, 6자리 풀어쓰기.

    허용 입력: "#fff", "fff", "#FFF", "FFFFFF", "#ffffff", "#FfFfFf"
    실패 시 (잘못된 길이·비-hex 문자): 검정(#1A1A1A) 반환 (관대 폴백).
    """
    if not isinstance(hex_str, str) or not hex_str:
        return BLACK
    h = hex_str.strip().lstrip('#').upper()
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    if len(h) != 6:
        return BLACK
    try:
        int(h, 16)
    except ValueError:
        return BLACK
    return "#" + h


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    """hex → (r, g, b). normalize_hex 를 거치므로 대소문/길이 무관."""
    h = normalize_hex(hex_str).lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def rgb_to_hex(rgb: Iterable[int]) -> str:
    """(r, g, b) → "#RRGGBB". 각 채널 0~255 clamp."""
    r, g, b = (max(0, min(255, int(c))) for c in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


# ─── WCAG 상대 휘도·대비비 ─────────────────────────────
def _channel_linear(c_255: int) -> float:
    """sRGB 채널 값(0~255) → 선형 채널 (WCAG 정의)."""
    c = c_255 / 255.0
    if c <= 0.03928:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def rel_luminance(color) -> float:
    """WCAG 상대 휘도 (0.0 ~ 1.0).

    입력: hex 문자열("#RRGGBB") 또는 (r, g, b) 튜플 모두 허용.
    """
    if isinstance(color, str):
        r, g, b = hex_to_rgb(color)
    else:
        r, g, b = (int(c) for c in color)
    return 0.2126 * _channel_linear(r) + 0.7152 * _channel_linear(g) + 0.0722 * _channel_linear(b)


def contrast_ratio(fg, bg) -> float:
    """WCAG 대비비 (1.0 ~ 21.0). 인자 순서 무관 (대칭).

    입력: 각각 hex 문자열 또는 (r, g, b) 튜플.
    """
    l1 = rel_luminance(fg)
    l2 = rel_luminance(bg)
    lighter, darker = (l1, l2) if l1 >= l2 else (l2, l1)
    return (lighter + 0.05) / (darker + 0.05)


# ─── 대비 통과 fg 자동 선택 ─────────────────────────────
def pick_fg(bg,
            options: Optional[Iterable[str]] = None,
            threshold: float = WCAG_AA) -> str:
    """배경색에 대해 대비비 threshold 이상인 fg 를 options 중 대비 최댓값으로 선택.

    Args:
        bg: 배경색 (hex str 또는 rgb tuple).
        options: 후보 fg hex 리스트. 기본 = [NEAR_WHITE, BLACK] (2후보).
        threshold: WCAG 대비비 최소 (기본 4.5 = AA).

    Returns:
        선택된 fg hex.
        · 후보 중 threshold 통과하는 것 중 대비 최댓값 반환.
        · 아무도 통과 못하면 대비 최댓값 반환 (관대 폴백 — 최선의 것 반환).
    """
    if options is None:
        options = [NEAR_WHITE, BLACK]
    bg_hex = normalize_hex(bg) if isinstance(bg, str) else rgb_to_hex(bg)
    scored = [(opt, contrast_ratio(opt, bg_hex)) for opt in options]
    passing = [(o, r) for o, r in scored if r >= threshold]
    pool = passing if passing else scored
    best = max(pool, key=lambda x: x[1])
    return normalize_hex(best[0])


# ─── 색 블렌드 (오버레이 실효 배경 계산) ─────────────────
def blend(base, overlay, alpha: float) -> str:
    """base 위에 overlay 를 alpha 로 얹었을 때 실효색.

    alpha 는 0.0(overlay 완전 투명) ~ 1.0(overlay 완전 불투명).
    입력·출력 hex 문자열 (내부 rgb 변환).

    예: blend("#3F5478", "#000000", 0.55)
        → 55% 검정 오버레이 얹은 실효 배경 hex
        → pick_fg 에 이 결과를 넘기면 오버레이 후 대비 자동 결정.
    """
    a = max(0.0, min(1.0, float(alpha)))
    br, bg, bb = hex_to_rgb(base) if isinstance(base, str) else tuple(base)
    or_, og, ob = hex_to_rgb(overlay) if isinstance(overlay, str) else tuple(overlay)
    return rgb_to_hex((
        br * (1 - a) + or_ * a,
        bg * (1 - a) + og * a,
        bb * (1 - a) + ob * a,
    ))


# ─── 이미지 평균 luminance (PIL 지연 import) ────────────
def img_avg_luminance(path: str, sample_size: int = 100):
    """이미지 평균 픽셀 → (avg_hex, luminance).

    PIL(Pillow) 을 지연 import — 이 함수를 실제로 호출할 때만 필요.
    파일 없음 / PIL 미설치 / 열기 실패 시 (BLACK, 0.0) 반환.
    """
    try:
        from PIL import Image  # 지연 import
    except Exception:
        return (BLACK, 0.0)
    try:
        img = Image.open(path).convert('RGB').resize((sample_size, sample_size))
    except Exception:
        return (BLACK, 0.0)
    px = list(img.getdata())
    if not px:
        return (BLACK, 0.0)
    n = len(px)
    avg = (
        sum(c[0] for c in px) // n,
        sum(c[1] for c in px) // n,
        sum(c[2] for c in px) // n,
    )
    return (rgb_to_hex(avg), rel_luminance(avg))


# ─── 편의: 오버레이 위 fg 자동 결정 한 방 헬퍼 ──────────
def pick_fg_over(base, overlay, alpha: float, **kwargs) -> str:
    """오버레이 얹은 배경 위 fg 자동 결정.

    equivalent to: pick_fg(blend(base, overlay, alpha), **kwargs)
    """
    return pick_fg(blend(base, overlay, alpha), **kwargs)


# ─── Spec Color-Derive (add-only) — 사업 성격 → 팔레트 자동 매핑 ─────
# 결정론적 키워드 매핑 (LLM 미사용, 크레딧 0).
# "정교할 필요 없음, 사용자가 색감 참고하라고 주는 시작점" 수준.
# 사용자가 admin/UI 에서 다른 색으로 교체 자유 — 자동 선택은 첫 제안일 뿐.
#
# 매핑 규칙:
#   green: 친환경·생태·업사이클·탄소중립·지속가능·그린·환경·자원순환·재활용
#   navy : 스마트·AI·디지털·ICT·미래·테크·혁신·기술·데이터·플랫폼
#   slate: 그 외 (문화·복지·행정·일반 행사 등) — 기본 폴백
# 우선순위: green > navy > slate (환경 키워드가 있으면 우선 배정)
#
# 검색 대상 텍스트: RFP title/summary + strategy strategy/concept/rationale/target/needs/pillars
#   ★ RFP 분석 dict 는 선택 (없어도 strategy 만으로 판단 가능)
#
# 반환: ("navy"|"green"|"slate", matched_keyword)
#   · 매칭 발견 시: (color, 매칭된 키워드)
#   · 매칭 실패 시: ("slate", "") — 안전 폴백
_DERIVE_KEYWORDS: dict[str, tuple[str, ...]] = {
    # 우선순위 dict 순서 보장 (Python 3.7+)
    "green": (
        "친환경", "생태", "업사이클", "탄소중립", "지속가능", "그린",
        "환경", "자원순환", "재활용", "저탄소", "친환경성", "에코",
        "기후", "저감", "녹색", "탈탄소", "제로웨이스트",
    ),
    "navy": (
        "스마트", "AI", "인공지능", "디지털", "ICT", "미래", "테크",
        "혁신", "기술", "데이터", "플랫폼", "메타버스", "블록체인",
        "IoT", "빅데이터", "R&D", "연구개발", "특이점", "지능형",
    ),
}
_DERIVE_DEFAULT = "slate"


def derive_palette(strategy=None, rfp_analysis=None) -> tuple[str, str]:
    """사업 성격 → 팔레트 자동 매핑 (결정론적, 크레딧 0).

    Args:
        strategy: dict — {"strategy","concept","rationale","target","needs","pillars":[...]}
            or None. generate_strategy 반환값.
        rfp_analysis: dict — {"title","summary","project_domain_label",...}
            or None. RFP 분석 결과.

    Returns:
        (theme_name, matched_keyword) — theme_name in {"navy","green","slate"}.
        매칭 실패 시 ("slate", "") 안전 폴백.

    검색 대상: rfp title/summary/domain + strategy 6개 필드 텍스트 이어붙여
      키워드 부분 문자열 검색 (대소문 유지 — 한글 위주).
    """
    parts: list[str] = []
    # RFP 분석에서 텍스트 추출
    if isinstance(rfp_analysis, dict):
        for k in ("title", "summary", "project_domain_label",
                  "project_tone_hint", "target_audience"):
            v = rfp_analysis.get(k)
            if isinstance(v, str) and v.strip():
                parts.append(v)
        # key_requirements 도 리스트로 올 수 있음 — 문자열 결합
        reqs = rfp_analysis.get("key_requirements") or []
        if isinstance(reqs, list):
            for r in reqs[:5]:
                if isinstance(r, str):
                    parts.append(r)
    # strategy 에서 텍스트 추출
    if isinstance(strategy, dict):
        for k in ("strategy", "concept", "rationale", "target", "needs"):
            v = strategy.get(k)
            if isinstance(v, str) and v.strip():
                parts.append(v)
        pillars = strategy.get("pillars") or []
        if isinstance(pillars, list):
            for p in pillars:
                if isinstance(p, (str, int, float)):
                    parts.append(str(p))

    haystack = " ".join(parts)
    if not haystack.strip():
        return (_DERIVE_DEFAULT, "")

    # 우선순위 dict 순회 (green 먼저 → navy → 폴백)
    for palette, keywords in _DERIVE_KEYWORDS.items():
        for kw in keywords:
            if kw in haystack:
                return (palette, kw)
    return (_DERIVE_DEFAULT, "")


# ═══════════════════════════════════════════════════════
# 자체 검증 (모듈 직접 실행 시 assert)
# ═══════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    # ── 1. normalize_hex 관대 폴백 ──────────────────
    assert normalize_hex("#fff") == "#FFFFFF"
    assert normalize_hex("fff") == "#FFFFFF"
    assert normalize_hex("#FfFfFf") == "#FFFFFF"
    assert normalize_hex("#1A1A1A") == "#1A1A1A"
    assert normalize_hex("garbage") == BLACK      # 관대 폴백
    assert normalize_hex("") == BLACK
    assert normalize_hex(None) == BLACK           # type: ignore[arg-type]
    print("[1] normalize_hex 정규화·폴백 OK")

    # ── 2. hex ↔ rgb 왕복 ───────────────────────────
    assert hex_to_rgb("#0A1F44") == (10, 31, 68)
    assert rgb_to_hex((10, 31, 68)) == "#0A1F44"
    assert rgb_to_hex((300, -5, 128)) == "#FF0080"   # clamp
    print("[2] hex/rgb 변환·clamp OK")

    # ── 3. rel_luminance 감각값 ────────────────────
    assert 0.0 <= rel_luminance("#000000") < 0.01
    assert 0.99 <= rel_luminance("#FFFFFF") <= 1.0
    lum_navy = rel_luminance("#0A1F44")
    lum_sand = rel_luminance("#F5E6C8")
    assert lum_navy < 0.1, f"navy luminance too high: {lum_navy}"
    assert lum_sand > 0.7, f"sand luminance too low: {lum_sand}"
    print(f"[3] rel_luminance: navy={lum_navy:.3f} sand={lum_sand:.3f} OK")

    # ── 4. contrast_ratio ──────────────────────────
    # 흑백 최대 대비 = 21:1
    assert abs(contrast_ratio("#FFFFFF", "#000000") - 21.0) < 0.01
    # 실험 리포트 값과 대략 일치 확인 (g1_A navy: bg=(31,59,92)→11.4:1)
    r_navy = contrast_ratio("#FFFFFF", "#1F3B5C")
    assert 10.5 <= r_navy <= 12.5, f"navy 대비 실험값과 편차 큼: {r_navy}"
    # 밝은 sand + 검정 fg (실험 g3_A: 15.3:1)
    r_sand = contrast_ratio("#1A1A1A", "#F5F0E6")
    assert 14.0 <= r_sand <= 16.0, f"sand 대비 실험값과 편차 큼: {r_sand}"
    print(f"[4] contrast_ratio: navy(흰/navy)={r_navy:.1f}:1  sand(검정/sand)={r_sand:.1f}:1 OK")

    # ── 5. pick_fg 자동 선택 ───────────────────────
    # 어두운 navy → 흰 계열 선택
    assert pick_fg("#0A1F44") == NEAR_WHITE
    assert pick_fg("#1F3B5C") == NEAR_WHITE
    assert pick_fg("#1E4A3A") == NEAR_WHITE    # green
    # 밝은 sand → 검정 계열
    assert pick_fg("#F5E6C8") == BLACK
    assert pick_fg("#F5F0E6") == BLACK
    # 회색 중간 경계도 대비 큰 쪽으로 (관대 폴백)
    mid = pick_fg("#808080")
    assert mid in (NEAR_WHITE, BLACK)
    # 사용자 지정 후보로 accent 색 추가도 가능
    alt = pick_fg("#0A1F44", options=[NEAR_WHITE, "#FFD700", BLACK])
    assert alt in (NEAR_WHITE, "#FFD700")   # 어두운 배경엔 흰 or 골드 선택
    print(f"[5] pick_fg: navy→{pick_fg('#0A1F44')}  sand→{pick_fg('#F5E6C8')}  회색중간→{mid} OK")

    # ── 6. WCAG 기준 판정 통과 여부 (실험 리포트 정합) ─
    # 실험 결과: 8/8 모두 4.5:1 이상 → 이 이식본도 같은 판정
    cases = [
        ("#1F3B5C", NEAR_WHITE, 10.5),   # g1_A navy
        ("#1E4A3A", NEAR_WHITE, 8.0),    # g4_A green (실험 10.0, 라운딩)
        ("#2C3442", NEAR_WHITE, 10.0),   # g2_A slate
        ("#F5F0E6", BLACK,      14.0),   # g3_A sand
    ]
    for bg, fg, min_ratio in cases:
        r = contrast_ratio(fg, bg)
        assert r >= min_ratio, f"{bg} vs {fg} = {r:.1f}:1 (기대 ≥ {min_ratio})"
        assert r >= WCAG_AA, f"WCAG AA 미달: {bg} vs {fg} = {r:.1f}:1"
    print(f"[6] WCAG AA(4.5:1) 기준 판정 실험 4케이스 통과 OK")

    # ── 7. blend + pick_fg_over (오버레이 실효 배경) ──
    # 실험: 배경 이미지 (48,53,68 근처) + 검정 오버레이 55% → 어두운 배경 → 흰 fg
    eff = blend("#3F5478", "#000000", 0.55)
    assert pick_fg(eff) == NEAR_WHITE
    # 한 방 헬퍼도 동일
    assert pick_fg_over("#3F5478", "#000000", 0.55) == NEAR_WHITE
    # 밝은 배경 + 흰 오버레이 30% → 여전히 밝음 → 검정 fg
    eff2 = blend("#F5E6C8", "#FFFFFF", 0.30)
    assert pick_fg(eff2) == BLACK
    print(f"[7] blend + pick_fg_over: 어두운 오버레이→흰, 밝은 오버레이→검정 OK")

    # ── 8. img_avg_luminance 관대 폴백 (파일 없음) ──
    fake = img_avg_luminance("__does_not_exist__.jpg")
    assert fake == (BLACK, 0.0), f"파일 없음 폴백 실패: {fake}"
    print("[8] img_avg_luminance 파일 없음 관대 폴백 OK")

    print()
    print("=== ALL 8 CHECKS PASSED ===")
