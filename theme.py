"""theme — 라이트/다크 테마 색 토큰 정의.

Spec D-Build-ThemeFoundation (1-a 단계).
이 모듈은 "정의만" 한다. 이번 단계에서는 어디서도 import·사용하지 않는다.
1-b 이후 단계에서 pptx_generator / proposal_multi_pass 가 import 해 사용.

[토큰 의미]
  · BG         — 슬라이드 전체 배경
  · FG         — 본문/헤드라인 글씨 (배경 대비 색)
  · FG_SUB     — 부차 텍스트
  · FG_META    — 메타/캡션 (eyebrow, 페이지번호 등)
  · LINE       — 구분선/테두리
  · PANEL_FILL — split/asymmetric 의 "강조 면" 채움색.
                 배경과 반대로 부각되는 면 — 라이트=검정면 / 다크=흰면.
  · PANEL_FG   — 강조 면 위 글씨색. 항상 PANEL_FILL 의 반대.
                 라이트(검정면)=흰글씨 / 다크(흰면)=검정글씨.
  · ACCENT     — 형광 강조 (다크에서만 의미 — 후속 단계용).

[★ 핵심 — PANEL 의미]
PANEL 은 "배경과 반대되는 면"이다.
  · 라이트 바탕(흰) → 검정 면이 부각 → PANEL_FILL=#1A1A1A / PANEL_FG=#FFFFFF
  · 다크 바탕(검정) → 흰 면이 부각 → PANEL_FILL=#FFFFFF / PANEL_FG=#1A1A1A
PANEL_FG 는 항상 면색의 반대(흰면→검정글씨, 검정면→흰글씨).

[★ 라이트 팔레트는 현재 코드 색과 정확히 일치]
1-b 단계에서 토큰 교체 시 라이트는 동작 무변경이어야 하므로
현재 하드코딩된 흑백 6색(#1A1A1A / #444 / #666 / #999 / #DDD / #FFFFFF)을 그대로 반영.
"""

THEMES: dict[str, dict[str, str]] = {
    "light": {
        # 라이트 테마 = 현재 운영 색 (전환 시 무변경 보장)
        "BG":          "#FFFFFF",   # 슬라이드 흰 바탕
        "FG":          "#1A1A1A",   # 본문·헤드라인 검정
        "FG_SUB":      "#444444",   # 부차 텍스트
        "FG_META":     "#999999",   # 메타·캡션·페이지번호 회색
        "LINE":        "#DDDDDD",   # 구분선·테두리 연회색
        "PANEL_FILL":  "#1A1A1A",   # 검정 면 (split/asymmetric 강조 면)
        "PANEL_FG":    "#FFFFFF",   # 검정 면 위 흰 글씨
        "ACCENT":      "#1A1A1A",   # 라이트에선 별도 강조색 없음(검정으로 fallback)
    },
    "dark": {
        # 다크 테마 = 검정 바탕 + 흰 글씨 + 형광 강조
        "BG":          "#0A0A0A",   # 슬라이드 검정 바탕(완전 #000 보다 약간 들뜸)
        "FG":          "#FFFFFF",   # 본문·헤드라인 흰
        "FG_SUB":      "#DDDDDD",   # 부차 텍스트 연한 회색
        "FG_META":     "#888888",   # 메타·캡션 중간 회색(다크 위에서 살짝 옅게)
        "LINE":        "#2A2A2A",   # 구분선·테두리 (검정 위에서 보이는 어두운 선)
        "PANEL_FILL":  "#FFFFFF",   # 흰 면 (다크 바탕에서 강조)
        "PANEL_FG":    "#1A1A1A",   # 흰 면 위 검정 글씨
        "ACCENT":      "#A78BFA",   # 브랜드 보라 강조 (다크 테마 시그니처)
    },
}


def get_theme(name: str = "light") -> dict:
    """이름으로 팔레트 dict 조회. 미정의 이름이면 라이트 fallback."""
    return THEMES.get(name, THEMES["light"])
