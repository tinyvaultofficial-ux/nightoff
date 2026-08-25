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
        "ACCENT":      "#6B46E5",   # 브랜드 primary 보라 — 웹 UI --primary 정합, 흰 배경 대비 확보
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

    # ─── Spec Color-Utils-2 — 화이트 베이스 컬러 팔레트 3종 (add-only) ───
    # 실험(_sim_contrast_safe_experiment.py, 8/8 WCAG 통과) 검증 색 그대로 이식.
    # 설계 원칙:
    #   · 화이트 베이스 유지 (BG=#FFFFFF / FG=#1A1A1A / 6색 회색 계열 = light 정합)
    #   · 강조 면·강조 텍스트만 팔레트 색 (온통 색칠 X)
    #   · PANEL_FILL / ACCENT = 실험의 "짙은 bg 색" (흰 배경 대비 WCAG AAA)
    #   · PANEL_FG = 흰 (짙은 팔레트 색 위 흰 글씨)
    # 이 팔레트들은 get_theme(name) 자동 확장 대상. 어디서도 아직 참조 X (신설 단계).
    "navy": {
        # 딥네이비 강조 — 실험 g1_A 대비비 11.4:1 (WCAG AAA)
        "BG":          "#FFFFFF",   # 흰 바탕 (light 정합)
        "FG":          "#1A1A1A",   # 본문·헤드라인 먹
        "FG_SUB":      "#444444",   # 부차 진회색
        "FG_META":     "#999999",   # 메타·캡션 옅은 회색
        "LINE":        "#DDDDDD",   # 구분선·테두리 연회색
        "PANEL_FILL":  "#1F3B5C",   # 딥네이비 강조 면 (검정 대신)
        "PANEL_FG":    "#FFFFFF",   # 딥네이비 면 위 흰 글씨
        "ACCENT":      "#1F3B5C",   # 거버닝/강조 = 딥네이비 (흰 배경 위 대비 11.4:1)
        # ─── Spec Color-Multilayer (add-only) — 입체 색감용 신규 토큰 5종 ───
        # 실험(_sim_multilayer_palette.py) 검증 색 그대로 이식. 흑백 프리셋의
        # 옅은/중간 자리(#F5F5F5/#DDDDDD/#EEEEEE 등)를 이 팔레트 계열 틴트로
        # 매핑하면 "딥네이비 점 하나" → 다층 색감 (특히 conclusion_cards/
        # numbered_columns 처럼 층 많은 프리셋에서 뚜렷).
        "MID":         "#4A5F7F",   # 서브 강조 (기존 stroke=#999999 자리) — 대비 6.5:1
        "SOFT":        "#6E82A0",   # 아주 부드러운 강조 (배경 큰 숫자=#EEEEEE 자리) — 3.9:1 시각 앵커
        "TINT":        "#EDF0F5",   # 카드 배경 (기존 fill=#F5F5F5 자리) — 본문 대비 15.2:1
        "TINT_STRONG": "#D6DEEB",   # 조금 진한 틴트 (기존 fill=#E8E8E8 자리) — 본문 대비 12.9:1
        "TINT_STROKE": "#B8C4D6",   # 옅은 stroke (기존 stroke=#DDDDDD 자리)
    },
    "green": {
        # 딥그린 강조 — 실험 g4_A 대비비 10.0:1 (WCAG AAA)
        "BG":          "#FFFFFF",
        "FG":          "#1A1A1A",
        "FG_SUB":      "#444444",
        "FG_META":     "#999999",
        "LINE":        "#DDDDDD",
        "PANEL_FILL":  "#1E4A3A",   # 딥그린 강조 면
        "PANEL_FG":    "#FFFFFF",   # 딥그린 면 위 흰 글씨
        "ACCENT":      "#1E4A3A",   # 거버닝/강조 = 딥그린 (흰 배경 위 대비 10.0:1)
        # Spec Color-Multilayer — 신규 5토큰 (실험 검증 색)
        "MID":         "#4B7562",
        "SOFT":        "#7A9686",
        "TINT":        "#EEF3F0",
        "TINT_STRONG": "#D5E3DC",
        "TINT_STROKE": "#B8CFC4",
    },
    "slate": {
        # 슬레이트 강조 — 실험 g2_A 대비비 12.5:1 (WCAG AAA)
        "BG":          "#FFFFFF",
        "FG":          "#1A1A1A",
        "FG_SUB":      "#444444",
        "FG_META":     "#999999",
        "LINE":        "#DDDDDD",
        "PANEL_FILL":  "#2C3442",   # 슬레이트 강조 면
        "PANEL_FG":    "#FFFFFF",   # 슬레이트 면 위 흰 글씨
        "ACCENT":      "#2C3442",   # 거버닝/강조 = 슬레이트 (흰 배경 위 대비 12.5:1)
        # Spec Color-Multilayer — 신규 5토큰 (실험 검증 색)
        "MID":         "#525C6E",
        "SOFT":        "#7C8595",
        "TINT":        "#EEF0F3",
        "TINT_STRONG": "#D8DBE1",
        "TINT_STROKE": "#BABEC6",
    },
}


def get_theme(name: str = "light") -> dict:
    """이름으로 팔레트 dict 조회. 미정의 이름이면 라이트 fallback."""
    return THEMES.get(name, THEMES["light"])
