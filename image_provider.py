"""image_provider — 2D 키비주얼 프롬프트 빌드 + (미래) Nano Banana Pro 호출.

Spec KeyVisual-1 (원스톱 첫 조각).
독립 모듈. 아직 어디서도 import·사용하지 않는다 (신설 단계).

[설계 원칙]
- build_keyvisual_prompt: 순수 함수 (LLM 미사용, 크레딧 0). 결정론적.
- generate_keyvisual: 현재 dry_run 만 지원 — Gemini API 호출 X (키 없음).
  실제 호출은 GEMINI_API_KEY 확보 + google-genai 설치 후 별도 커밋.
- color_utils.derive_palette 와 같은 재료 재활용 (strategy dict + rfp_analysis dict).

[프롬프트 규칙 (user 결정 반영)]
- 배경 비주얼만: no text / no letters / no typography 명시 (텍스트는 PPTX에서 얹음)
- 인물 기본 없음: no people. 특정 domain (welfare/campaign/sports) 만 abstract silhouette 허용
- 색 톤: derive_palette 결과 (navy/green/slate) → 팔레트 서술로 변환
- 여백: "상단 30%, 중앙 calm" — 텍스트 오버레이 자리 확보
- 종횡비 명시 (16:9)
- domain별 스타일 분기 (proposal_multi_pass.py DOMAIN_TONE_MATRIX 정합)
- 아트디렉터 브리프 형식: SCENE / STYLE / LIGHTING / COMPOSITION / COLOR / MOOD / STRICT CONSTRAINTS

[출력 형식]
Nano Banana Pro (Gemini 2.5 Flash Image) 는 자연어 브리프 잘 처리.
영어 프롬프트 (색·스타일 어휘가 영어 학습 데이터 풍부).
"""
from __future__ import annotations

from typing import Optional


# ─── domain별 시각 스타일 매트릭스 (아트디렉터 브리프 재료) ─────────
# 각 domain 에 대해:
#   scene   : 주요 시각 요소 (배경 elements)
#   style   : 아트 스타일
#   lighting: 조명 성격
#   mood    : 분위기 서술
#   allow_silhouette: True 시 인물 실루엣 허용 (얼굴/디테일 없이 abstract only)
_DOMAIN_VISUAL: dict[str, dict] = {
    "festival": {
        "scene": "warm abstract festival atmosphere with subtle organic elements — "
                 "soft floating light particles, gentle depth, delicate natural motifs",
        "style": "contemporary editorial poster illustration, sophisticated minimalist composition",
        "lighting": "warm golden-hour ambient light with soft gradients, cinematic atmosphere",
        "mood": "celebratory, warm, community-oriented, refined",
        "allow_silhouette": False,
    },
    "forum": {
        "scene": "sophisticated abstract geometric composition, clean grid structure, "
                 "subtle depth with layered planes",
        "style": "premium editorial poster design, refined corporate aesthetic",
        "lighting": "cool professional ambient light, soft directional highlights",
        "mood": "authoritative, intellectual, globally-minded, precise",
        "allow_silhouette": False,
    },
    "education": {
        "scene": "bright open composition with subtle knowledge symbols "
                 "(abstract books, soft light rays, gentle upward flow)",
        "style": "contemporary editorial illustration, clean structured aesthetic",
        "lighting": "warm inviting daylight, soft even illumination",
        "mood": "hopeful, growth-oriented, welcoming, focused",
        "allow_silhouette": False,
    },
    "sports": {
        "scene": "dynamic diagonal composition with subtle motion elements — "
                 "abstract streaks, energy trails, layered movement",
        "style": "high-energy sports poster design, bold graphic composition",
        "lighting": "high-contrast dramatic lighting, sharp directional highlights",
        "mood": "energetic, powerful, competitive, motivational",
        "allow_silhouette": True,   # 스포츠는 abstract 인물 실루엣 허용
    },
    "exhibition": {
        "scene": "sleek modern composition with subtle industry motifs — "
                 "abstract geometric patterns, refined product-shelf hint",
        "style": "premium B2B trade show poster, corporate high-end aesthetic",
        "lighting": "clean modern studio lighting, controlled highlights",
        "mood": "professional, opportunity-oriented, business-forward, polished",
        "allow_silhouette": False,
    },
    "display": {
        "scene": "elegant curated composition with artistic gradient depth, "
                 "subtle exhibition-space atmosphere",
        "style": "museum-quality poster design, gallery editorial aesthetic",
        "lighting": "soft museum spotlighting, refined tonal contrast",
        "mood": "contemplative, refined, culturally elevated, timeless",
        "allow_silhouette": False,
    },
    "campaign": {
        "scene": "warm human community atmosphere with abstract connecting shapes — "
                 "gentle interlocking forms, circular flow, hopeful gradients",
        "style": "public campaign poster design, humanist editorial aesthetic",
        "lighting": "warm hopeful daylight, soft ambient glow",
        "mood": "hopeful, participatory, community-driven, warm",
        "allow_silhouette": True,   # 캠페인은 시민 실루엣 허용
    },
    "tourism": {
        "scene": "scenic natural landscape hints with atmospheric depth — "
                 "distant horizons, soft layered terrain, evocative depth",
        "style": "premium travel poster design, editorial landscape aesthetic",
        "lighting": "golden-hour atmospheric lighting, cinematic haze",
        "mood": "inviting, aspirational, place-rooted, atmospheric",
        "allow_silhouette": False,
    },
    "rnd": {
        "scene": "futuristic technological composition with subtle network motifs — "
                 "abstract nodes, data-flow lines, layered depth",
        "style": "high-tech R&D poster design, precise technical aesthetic",
        "lighting": "cool technological lighting, precise directional glow",
        "mood": "innovative, precise, forward-looking, technological",
        "allow_silhouette": False,
    },
    "welfare": {
        "scene": "warm caring atmosphere with abstract connecting shapes — "
                 "gentle protective forms, soft interlocking curves",
        "style": "warm humanist poster design, editorial care aesthetic",
        "lighting": "soft hopeful daylight, warm protective glow",
        "mood": "caring, hopeful, dignified, warm",
        "allow_silhouette": True,   # 복지는 세대 실루엣 허용
    },
    "other": {
        "scene": "sophisticated abstract composition with balanced negative space, "
                 "subtle textural depth",
        "style": "premium editorial poster design, minimalist aesthetic",
        "lighting": "balanced ambient lighting, refined tonal range",
        "mood": "professional, refined, versatile, timeless",
        "allow_silhouette": False,
    },
}


# ─── 팔레트 이름 → 색 서술 (derive_palette 결과 연동) ─────────────
_PALETTE_DESCRIPTION: dict[str, str] = {
    "navy": "deep navy blue tones with cool professional atmosphere, subtle cool highlights",
    "green": "deep forest green with natural earthy accents, organic natural feel",
    "slate": "sophisticated slate gray with subtle warm neutrals, refined understated tone",
    # 기본 팔레트 (color_mode off 시 fallback)
    "light": "sophisticated neutral tones with soft warm accents, clean editorial palette",
    "dark":  "deep charcoal tones with cool moonlight accents, cinematic dark palette",
}


def _resolve_domain(rfp_analysis: Optional[dict]) -> str:
    """RFP 에서 project_domain 이름 조회 (소문자). 미정의/미매칭 시 'other'."""
    if not isinstance(rfp_analysis, dict):
        return "other"
    domain = str(rfp_analysis.get("project_domain") or "").strip().lower()
    if domain in _DOMAIN_VISUAL:
        return domain
    # domain_label 에서 역추론 (한국어 라벨)
    label = str(rfp_analysis.get("project_domain_label") or "")
    hints = [
        ("festival", ("축제", "페스티벌", "기념식")),
        ("forum",    ("포럼", "컨퍼런스", "심포지엄", "국제회의")),
        ("education",("교육", "연수", "아카데미", "워크숍")),
        ("sports",   ("대회", "경기", "체육", "선수권", "리그")),
        ("exhibition",("박람회", "산업전", "엑스포", "상담회")),
        ("display",  ("전시", "박물관", "미술관")),
        ("campaign", ("캠페인", "홍보", "인식개선")),
        ("tourism",  ("관광", "여행", "지역브랜딩")),
        ("rnd",      ("R&D", "연구", "기술개발", "용역연구")),
        ("welfare",  ("복지", "돌봄", "노인", "청소년", "장애인")),
    ]
    for name, kws in hints:
        for kw in kws:
            if kw in label:
                return name
    return "other"


def _resolve_palette(strategy: Optional[dict], rfp_analysis: Optional[dict]) -> tuple[str, str]:
    """derive_palette 재사용 (색 자동 선택). 반환 (palette_name, 매칭 키워드)."""
    try:
        from color_utils import derive_palette
        return derive_palette(strategy=strategy, rfp_analysis=rfp_analysis)
    except Exception:
        return ("slate", "")


def build_keyvisual_prompt(strategy: Optional[dict] = None,
                           rfp_analysis: Optional[dict] = None,
                           aspect_ratio: str = "3:4") -> str:
    """제안 내용 → 2D 키비주얼 세로 포스터 배경 프롬프트 (아트디렉터 브리프, 영어).

    Args:
        strategy: {"concept","target","needs","pillars",...} or None
        rfp_analysis: {"project_domain","project_domain_label","project_tone_hint",
                       "target_audience","title","summary",...} or None
        aspect_ratio: 종횡비 (기본 "3:4" 세로 포스터 — 제안서 세로 포스터 자리 정합).
            지원 예: "3:4"(포스터), "2:3"(더 길쭉), "9:16"(모바일), "16:9"(가로 배너).

    Returns:
        영어 프롬프트 문자열 (Nano Banana Pro / Gemini image 정합).

    ★ 순수 함수, 결정론적, LLM/API 호출 0. 재입력 시 동일 출력.
    """
    domain = _resolve_domain(rfp_analysis)
    visual = _DOMAIN_VISUAL[domain]
    palette, _ = _resolve_palette(strategy, rfp_analysis)
    palette_desc = _PALETTE_DESCRIPTION.get(palette, _PALETTE_DESCRIPTION["slate"])

    # tone_hint (선택) — 프롬프트 mood 보강용 (한국어라 인용은 최소)
    tone_hint = ""
    if isinstance(rfp_analysis, dict):
        th = str(rfp_analysis.get("project_tone_hint") or "").strip()
        if th and len(th) < 100:
            tone_hint = th[:80]

    # 인물 정책
    if visual["allow_silhouette"]:
        people_rule = (
            "- NO detailed people, NO faces, NO recognizable figures. "
            "Abstract silhouettes only if essential (blurred, no facial features)."
        )
    else:
        people_rule = "- NO people, NO faces, NO figures at all."

    # 세로/가로 비율 판정 — COMPOSITION 문구 자동 조정
    is_portrait = aspect_ratio in ("2:3", "3:4", "4:5", "9:16") or aspect_ratio.startswith(("2:", "3:", "4:", "9:"))
    if is_portrait:
        composition = (
            "COMPOSITION: Vertical poster format. Intentionally leave the upper 40% as calm, "
            "uncluttered negative space for the main title/slogan text overlay. "
            "Visual weight concentrated in the lower 60% (bottom edge or lower-center). "
            "This is a proposal key visual poster where the title will be typeset "
            "separately in PowerPoint above the imagery."
        )
        constraint_composition = (
            "- The upper 40% (top area) must remain calm and uncluttered — "
            "reserved for large title/slogan text overlay added separately in PowerPoint."
        )
    else:
        composition = (
            "COMPOSITION: Horizontal format. Intentionally leave the upper 30% and center area as calm, "
            "uncluttered negative space suitable for large title text overlay. "
            "Visual weight concentrated in lower portion or edges."
        )
        constraint_composition = (
            "- The upper 30% and center must remain calm and uncluttered — "
            "this space will be reserved for text overlay added separately in PowerPoint."
        )

    # 아트디렉터 브리프 조립
    lines = [
        f"Aspect ratio {aspect_ratio}. Key visual poster background image "
        f"for a Korean B2G proposal ({domain} category).",
        "",
        f"SCENE: {visual['scene']}.",
        f"STYLE: {visual['style']}.",
        f"LIGHTING: {visual['lighting']}.",
        f"COLOR PALETTE: {palette_desc}.",
        f"MOOD: {visual['mood']}.",
        composition,
    ]
    if tone_hint:
        lines.append(f"CLIENT TONE REFERENCE: '{tone_hint}' (interpret as visual mood only).")

    lines.extend([
        "",
        "STRICT CONSTRAINTS (must obey):",
        "- Absolutely NO text, NO letters, NO typography, NO words, NO written characters of any kind in the image.",
        people_rule,
        "- NO logos, NO watermarks, NO signage, NO readable symbols.",
        constraint_composition,
        "- Background image only. Composition should feel like a finished poster background awaiting typography.",
    ])
    return "\n".join(lines)


# ─── Spec KeyVisual-3 (실험) — 풀 포스터 프롬프트 (텍스트 포함) ──────
# 기존 build_keyvisual_prompt (배경-only) 는 무접촉. 이 함수는 실험용 별도.
# 목적: Nano Banana Pro 계열이 한글 텍스트를 얹은 완성형 B2G 포스터를 만들 수
#   있는지 정직하게 확인. 성공하면 옵션 1 (엔진이 텍스트까지) / 실패하면 옵션 2
#   (엔진은 배경만, 텍스트는 PPTX에서 얹음, 기존 방식) 를 유지.
def build_full_poster_prompt(strategy: Optional[dict] = None,
                             rfp_analysis: Optional[dict] = None,
                             aspect_ratio: str = "3:4",
                             *,
                             event_title: str = "",
                             slogan: str = "",
                             date_place: str = "",
                             programs: Optional[list] = None,
                             credits_line: str = "") -> str:
    """실험용 — 여러 한글 텍스트 블록이 얹힌 완성형 포스터 프롬프트.

    Args:
        event_title: 큰 제목 (예: "2026 서울 업사이클 페스티벌")
        slogan: 슬로건 중간 강조 (예: strategy.concept 활용)
        date_place: 날짜·장소 한 줄 (예: "2026.10.15-17 · 서울숲 일대")
        programs: 프로그램 항목 리스트 (예: ["업사이클 마켓","공방","자원순환 토크"])
        credits_line: 하단 크레딧 (예: "주최 서울시 · 주관 서울문화재단")
    나머지 인자는 build_keyvisual_prompt 정합.

    Returns:
        한글 텍스트 위계·폰트 명시된 영어 브리프.
    """
    domain = _resolve_domain(rfp_analysis)
    visual = _DOMAIN_VISUAL[domain]
    palette, _ = _resolve_palette(strategy, rfp_analysis)
    palette_desc = _PALETTE_DESCRIPTION.get(palette, _PALETTE_DESCRIPTION["slate"])

    # 프로그램 3개까지만 (포스터 균형)
    programs = [p.strip() for p in (programs or []) if isinstance(p, str) and p.strip()][:3]

    lines = [
        f"Aspect ratio {aspect_ratio}. **Complete Korean B2G event poster** "
        f"({domain} category) — final composition with all text typography rendered in the image.",
        "",
        f"BACKGROUND SCENE: {visual['scene']}.",
        f"BACKGROUND STYLE: {visual['style']}.",
        f"LIGHTING: {visual['lighting']}.",
        f"COLOR PALETTE: {palette_desc}.",
        f"MOOD: {visual['mood']}.",
        "",
        "★★★ TEXT TYPOGRAPHY (must render precisely, Korean sans-serif — think Noto Sans KR / Pretendard):",
        "",
    ]

    # 위계 있는 텍스트 블록 (top→bottom)
    if event_title:
        lines.append(f'- HEADER (top area, very large bold Korean sans-serif, high contrast against background):')
        lines.append(f'  "{event_title}"')
    if slogan:
        lines.append(f'- SLOGAN (upper-middle, medium size, elegant Korean sans-serif, semi-bold):')
        lines.append(f'  "{slogan}"')
    if date_place:
        lines.append(f'- DATE & VENUE (middle, small clean Korean sans-serif, single line):')
        lines.append(f'  "{date_place}"')
    if programs:
        prog_str = " · ".join(programs)
        lines.append(f'- PROGRAM LIST (lower area, small Korean sans-serif, single line):')
        lines.append(f'  "{prog_str}"')
    if credits_line:
        lines.append(f'- CREDITS (bottom, very small Korean sans-serif, subtle):')
        lines.append(f'  "{credits_line}"')

    lines.extend([
        "",
        "COMPOSITION: Vertical poster layout. Text typography arranged top-to-bottom in hierarchy above. "
        "Background imagery framing text — decorative elements at bottom edges leaving room for text stack. "
        "Overall balance like a professionally designed event poster.",
        "",
        "STRICT REQUIREMENTS:",
        "- Language: Korean (한국어) — all text rendered accurately in Korean characters.",
        "- Every Korean character must be legible, correctly spelled, and precisely as written above.",
        "- Text hierarchy visible: title >> slogan > date/venue > program > credits.",
        "- NO people, NO faces, NO photographic figures.",
        "- NO extra text beyond what is specified above (no random Korean words, no fake logos).",
        "- Do NOT invent or hallucinate additional text — only the exact strings quoted above.",
    ])
    return "\n".join(lines)


# ─── 자체 env 로더 (main.py 전역 무접촉 — 격리) ──────────────
# main.py 는 python-dotenv 미사용. image_provider.py 만 .env.local 자체 파싱.
# 값 로그 출력 절대 X.
def _load_gemini_key_from_env() -> str:
    """GEMINI_API_KEY 조회. 우선순위: os.environ > .env.local 파일 (자체 파싱)."""
    import os as _os
    key = (_os.environ.get('GEMINI_API_KEY') or '').strip()
    if key:
        return key
    # .env.local 자체 파싱 (image_provider.py 위치 기준)
    from pathlib import Path
    env_path = Path(__file__).parent / '.env.local'
    if not env_path.exists():
        return ''
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                s = line.rstrip('\r\n').strip()
                if s.startswith('GEMINI_API_KEY='):
                    v = s.split('=', 1)[1].strip()
                    if len(v) >= 2 and v[0] in ('"', "'") and v[-1] == v[0]:
                        v = v[1:-1]
                    return v
    except Exception:
        return ''
    return ''


# ─── 실제 Gemini 호출 (Nano Banana Pro) ───────────────────
# 모델 = models/nano-banana-pro-preview (2026 새 auth key로 접근 확인됨).
# google-genai SDK 사용 (신규 통합 SDK, 2024~2025 표준).
# 실패 케이스: 인증(401/403) / 결제(429/403 billing) / 네트워크 / 안전 필터 —
#   모두 예외 잡아 None + 명확한 에러 메시지 반환 (크래시 X).
def generate_keyvisual(prompt: str,
                       *,
                       dry_run: bool = True,
                       aspect_ratio: str = "3:4",
                       model_name: str = "models/nano-banana-pro-preview") -> Optional[bytes]:
    """Nano Banana Pro 호출로 배경 이미지 bytes 반환.

    Args:
        prompt: build_keyvisual_prompt 결과.
        dry_run: True → API 호출 X, None 반환 (안전 기본값).
        aspect_ratio: 종횡비 (프롬프트에 이미 명시됐지만 config에도 전달 시도).
        model_name: Gemini 모델 id. 기본 = Nano Banana Pro.

    Returns:
        성공: 이미지 bytes (PNG/JPEG, 응답 mime_type 에 따라).
        dry_run 또는 실패: None. 실패 시 에러 메시지는 raise 대신 print.
    """
    if dry_run:
        return None

    # 1. 키 로드
    api_key = _load_gemini_key_from_env()
    if not api_key:
        print("[generate_keyvisual] 실패: GEMINI_API_KEY 미로드 (.env.local 또는 os.environ 확인)")
        return None

    # 2. SDK import
    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError as e:
        print(f"[generate_keyvisual] 실패: google-genai SDK 미설치 → pip install google-genai ({e})")
        return None

    # 3. 클라이언트 + 호출 (★ timeout 4분 = 무한대기 방지)
    try:
        client = genai.Client(
            api_key=api_key,
            http_options=genai_types.HttpOptions(timeout=240000),  # 240000ms = 4분
        )
    except Exception as e:
        # 예외 메시지에 키 노출 방지
        msg = str(e).replace(api_key, '<KEY_REDACTED>')
        print(f"[generate_keyvisual] 실패: 클라이언트 초기화 - {msg}")
        return None

    try:
        # 이미지 응답 요청 — response_modalities=IMAGE + aspect_ratio (세로 포스터)
        resp = client.models.generate_content(
            model=model_name,
            contents=[prompt],
            config=genai_types.GenerateContentConfig(
                response_modalities=['IMAGE'],
                image_config=genai_types.ImageConfig(aspect_ratio=aspect_ratio),
            ),
        )
    except Exception as e:
        msg = str(e).replace(api_key, '<KEY_REDACTED>') if api_key in str(e) else str(e)
        # 흔한 실패 패턴 힌트 안내
        lower = msg.lower()
        if 'billing' in lower or 'quota' in lower or 'paid' in lower or 'payment' in lower:
            hint = " ★ 결제/유료 티어 필요 가능성 (Gemini image 는 유료 티어 필수일 수 있음)"
        elif 'permission' in lower or 'access' in lower or '403' in msg:
            hint = " ★ 권한/접근 문제 (모델 접근권한·리전 확인)"
        elif 'auth' in lower or '401' in msg:
            hint = " ★ 인증 실패 (키 값 확인)"
        elif 'safety' in lower or 'blocked' in lower:
            hint = " ★ 안전 필터 차단 (프롬프트 내용 재검토)"
        elif 'network' in lower or 'connect' in lower or 'timeout' in lower or 'deadline' in lower or 'unavailable' in lower or '503' in msg:
            hint = " ★ 네트워크/서버 timeout (4분 초과 or 503 UNAVAILABLE — preview 모델 일시 장애 가능)"
        else:
            hint = ""
        print(f"[generate_keyvisual] 실패: 호출 예외 - {msg[:500]}{hint}")
        return None

    # 4. 응답에서 이미지 bytes 추출
    try:
        candidates = getattr(resp, 'candidates', None) or []
        if not candidates:
            print(f"[generate_keyvisual] 실패: 응답에 candidates 없음. finish_reason={getattr(resp, 'prompt_feedback', '(unknown)')}")
            return None
        content = getattr(candidates[0], 'content', None)
        parts = getattr(content, 'parts', None) or []
        for part in parts:
            inline = getattr(part, 'inline_data', None)
            if inline is not None:
                data = getattr(inline, 'data', None)
                if data:
                    # data 는 bytes 또는 base64 str (SDK 버전에 따라)
                    if isinstance(data, (bytes, bytearray)):
                        return bytes(data)
                    if isinstance(data, str):
                        import base64
                        return base64.b64decode(data)
        # 이미지 파트 없음 → 텍스트 응답일 가능성
        text_parts = [getattr(p, 'text', '') for p in parts if getattr(p, 'text', '')]
        combined = ' | '.join(text_parts)[:300]
        print(f"[generate_keyvisual] 실패: 응답에 이미지 없음. 텍스트 파트: {combined!r}")
        return None
    except Exception as e:
        print(f"[generate_keyvisual] 실패: 응답 파싱 - {e}")
        return None


# ═══════════════════════════════════════════════════════
# 자체 검증 (모듈 직접 실행 시 여러 사업 샘플 프롬프트 출력)
# ═══════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    samples = [
        ("업사이클 페스티벌 (축제 · green)", {
            "rfp": {
                "title": "2026 서울 업사이클 페스티벌",
                "summary": "재활용 문화 확산을 위한 시민 참여형 축제",
                "project_domain": "festival",
                "project_domain_label": "축제·행사",
                "project_tone_hint": "친환경 시민 참여, 감성·체험형",
                "target_audience": "일반 시민, 가족 단위",
            },
            "strategy": {
                "strategy": "지속가능한 지역 상생 축제로의 전환",
                "concept": "일상에 스며드는 업사이클",
                "target": "환경 감수성 있는 3040 가족",
                "needs": "가족과 함께 체험하는 친환경 경험",
                "pillars": ["자원순환 체험", "지역 협업", "세대 통합"],
            },
        }),
        ("스마트시티 AI 국제포럼 (포럼 · navy)", {
            "rfp": {
                "title": "2026 스마트시티 AI 국제 컨퍼런스",
                "summary": "AI 기술 담론과 국제 어젠다 설정",
                "project_domain": "forum",
                "project_domain_label": "포럼·컨퍼런스",
                "project_tone_hint": "국제 지적 권위, 어젠다 설정형",
                "target_audience": "국제 연사, 정책 리더, 학계",
            },
            "strategy": {
                "concept": "AI 특이점 담론의 국제 확장",
                "pillars": ["기술 리더십", "국제 연대", "미래 어젠다"],
            },
        }),
        ("지역 문화축제 (축제 · slate 폴백)", {
            "rfp": {
                "title": "2026 마포 지역 문화축제",
                "summary": "지역 주민 참여형 문화 행사",
                "project_domain": "festival",
                "project_domain_label": "축제·행사",
                "project_tone_hint": "지역 밀착, 세대 통합",
                "target_audience": "지역 주민",
            },
            "strategy": {
                "concept": "마포다움을 잇는 문화 여정",
                "pillars": ["지역 정체성", "세대 통합", "생활 밀착"],
            },
        }),
        ("산업 전시회 (exhibition · navy)", {
            "rfp": {
                "title": "2026 스마트제조 산업 박람회",
                "summary": "B2B 바이어 매칭 및 기술 전시",
                "project_domain": "exhibition",
                "project_domain_label": "박람회·전시",
                "project_tone_hint": "정량 성과·바이어 유치 중심",
                "target_audience": "B2B 바이어, 산업계",
            },
            "strategy": {
                "concept": "스마트제조 기술의 글로벌 상담 플랫폼",
                "pillars": ["바이어 매칭", "기술 전시", "네트워킹"],
            },
        }),
        ("청년 취업박람회 (education · slate)", {
            "rfp": {
                "title": "2026 청년 취업 아카데미",
                "summary": "청년 취업 역량 강화 교육 프로그램",
                "project_domain": "education",
                "project_domain_label": "교육·연수",
                "project_tone_hint": "성장 지향, 실용적",
                "target_audience": "20~30대 취준생",
            },
            "strategy": {
                "concept": "실무형 청년 역량 여정",
                "pillars": ["실무 교육", "네트워킹", "취업 연계"],
            },
        }),
        ("탄소중립 캠페인 (campaign · green, 실루엣 허용)", {
            "rfp": {
                "title": "2026 시민 탄소중립 캠페인",
                "summary": "시민 참여형 저탄소 실천 캠페인",
                "project_domain": "campaign",
                "project_domain_label": "공공캠페인·시민참여",
                "project_tone_hint": "시민 주도, 공동체 참여",
                "target_audience": "일반 시민, 청소년",
            },
            "strategy": {
                "concept": "일상 속 저탄소 실천 확산",
                "pillars": ["시민 참여", "일상 실천", "지역 확산"],
            },
        }),
        ("장애인 스포츠 대회 (sports · slate, 실루엣 허용)", {
            "rfp": {
                "title": "2026 전국 장애인 체육대회",
                "summary": "장애인 스포츠 통합 대회",
                "project_domain": "sports",
                "project_domain_label": "대회·경기",
                "project_tone_hint": "역동적, 통합적",
                "target_audience": "장애인 선수, 시민",
            },
            "strategy": {
                "concept": "함께 뛰는 스포츠 통합의 여정",
                "pillars": ["통합", "역량 발현", "지역 응원"],
            },
        }),
    ]

    print(f"=== {len(samples)}개 사업 샘플 프롬프트 ===\n")
    for label, data in samples:
        p = build_keyvisual_prompt(strategy=data["strategy"], rfp_analysis=data["rfp"])
        print(f"─── {label} ──────────────────────────────────────────────")
        print(p)
        print()

    # dry_run 검증
    assert generate_keyvisual("test prompt", dry_run=True) is None
    print("─── generate_keyvisual(dry_run=True) → None (호출 안 함, 스텁 OK) ───")

    # ═══════════════════════════════════════════════════════
    # 실제 Nano Banana Pro 호출 (첫 1장, 실 크레딧)
    # ═══════════════════════════════════════════════════════
    print()
    print("═" * 60)
    print("첫 1장 실 생성 시도 (Nano Banana Pro, 실 크레딧)")
    print("샘플: 업사이클 페스티벌 (festival · green)")
    print("═" * 60)

    # 첫 샘플 = 업사이클 페스티벌 (green) — 이미 프롬프트 위에서 생성됨
    first_sample = samples[0][1]
    real_prompt = build_keyvisual_prompt(
        strategy=first_sample["strategy"],
        rfp_analysis=first_sample["rfp"],
    )

    img_bytes = generate_keyvisual(real_prompt, dry_run=False)

    if img_bytes:
        # PNG 저장 (같은 폴더)
        from pathlib import Path
        out_dir = Path(__file__).parent / "_experiments"
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / "keyvisual_upcycle_festival_3x4.png"
        try:
            with open(out_path, "wb") as f:
                f.write(img_bytes)
            print(f"\n★ 성공 — 이미지 저장됨:\n  {out_path}")
            print(f"  크기: {len(img_bytes):,} bytes")
        except Exception as e:
            print(f"\n★ 이미지 생성 성공했으나 저장 실패: {e}")
    else:
        print("\n★ 실 생성 실패 (위 [generate_keyvisual] 로그 확인)")

    # ═══════════════════════════════════════════════════════
    # Spec KeyVisual-3 (실험) — 풀 포스터 (한글 텍스트 포함)
    # ═══════════════════════════════════════════════════════
    print()
    print("═" * 60)
    print("풀 포스터 실험 (한글 텍스트 포함, 정직 테스트)")
    print("═" * 60)

    full_prompt = build_full_poster_prompt(
        strategy=first_sample["strategy"],
        rfp_analysis=first_sample["rfp"],
        aspect_ratio="3:4",
        event_title="2026 서울 업사이클 페스티벌",
        slogan="일상에 스며드는 순환",
        date_place="2026.10.15-17 · 서울숲 일대",
        programs=["업사이클 마켓", "자원순환 공방", "지속가능 토크"],
        credits_line="주최 서울특별시 · 주관 서울문화재단",
    )
    print("─── 풀 포스터 프롬프트 ───")
    print(full_prompt)
    print()

    full_bytes = generate_keyvisual(full_prompt, dry_run=False, aspect_ratio="3:4")

    if full_bytes:
        out_full = out_dir / "keyvisual_upcycle_full_poster_3x4.png"
        with open(out_full, "wb") as f:
            f.write(full_bytes)
        print(f"\n★ 풀 포스터 성공:\n  {out_full}\n  크기: {len(full_bytes):,} bytes")
    else:
        print("\n★ 풀 포스터 실패 (위 [generate_keyvisual] 로그 확인)")
