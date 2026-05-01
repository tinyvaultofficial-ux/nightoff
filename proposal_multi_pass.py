"""Multi-pass 제안서 생성 — Outline → 슬라이드별 도형 JSON → 병합.

설계 의도:
  Single-pass 한계:
    - max_tokens=16000 토큰을 30 슬라이드로 나누면 슬라이드당 ~530 토큰
    - AI 가 토큰 절약 모드 → 빈약한 본문
  Multi-pass 해법:
    - Phase 1: 가벼운 outline 호출 1번 (~5k 토큰)
    - Phase 2: 슬라이드마다 16k 토큰 풀로 도형 JSON 호출 (병렬)
    - Phase 3: 병합 → generate_from_shape_json 그대로 호출
  이러면 슬라이드당 도형 50~80개 빽빽하게 가능.

병렬 처리:
  asyncio.gather() 로 5장씩 묶어서 호출 (Anthropic rate limit 고려).
  실패 슬라이드는 placeholder 슬라이드로 대체 (전체 실패 X).

진행률:
  orchestrate() 가 async generator → SSE 로 실시간 yield.

비용 예상 (Sonnet 4):
  - Phase 1: ~$0.03 (outline)
  - Phase 2: 슬라이드 30장 × ~$0.02 = ~$0.60
  - 합계: ~$0.65 (single-pass ~$0.05 의 13배)
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional

log = logging.getLogger("multi_pass")

# ─── Phase 1: Outline 시스템 프롬프트 ────────────────────────────────────────
OUTLINE_SYSTEM_PROMPT = """너는 한국 B2G 공공입찰 제안서의 **목차·구조 설계 전문가** 다.

지금 단계는 슬라이드 도형은 그리지 않고, **전체 슬라이드 구성 outline 만 짠다**.
실제 도형 그리기는 다음 단계에서 슬라이드마다 별도 호출이 진행된다.

[너의 임무]
1. RFP / 발주처 정보 / RAG 학습 결과를 종합해서
2. **5부 구조 + 표지 + 목차 + 챕터 divider + 마무리** 가 다 들어간 outline 짠다
3. 각 슬라이드의 section 명, 거버닝 메시지(짧게), 핵심 메시지(짧게) 리스트 출력

[5부 구조 — 도메인 무관 고정]
   Ⅰ. 제안 개요     (제안 배경 / 과업 범위 / 제안의 특징·장점 / 컨셉)
   Ⅱ. 일반 부문     (제안사 일반 현황 / 조직 / 유사 사업 실적)
   Ⅲ. 사업 수행 부문 (수행 전략 / 세부 프로그램)
   Ⅳ. 도메인별 변형 (홍보 계획 / 확산 전략 / 참여 전략 / 성과 확산 등)
   Ⅴ. 도메인별 변형 (사업 관리 / 운영 관리 / 품질 관리 / 리스크 관리 등)
   + 표지 (1장) / 목차 (1장) / 챕터 divider (5장) / 마무리·감사합니다 (1장)

[목표 분량]
- RFP 에 페이지 수가 명시되면 그대로
- 명시 없으면 25~40 슬라이드 (총괄 페이지 + 표지·목차·divider·마무리 포함)

[거버닝 메시지 원칙]
- 25자 이내, 명사형 문어체
- ⚠ em-dash(—) / hyphen(-) 으로 명사 나열 / 콜론(:) / 슬래시(/) 절대 금지
- 콤마(,) 와 × 기호는 OK

[색감]
- 모든 슬라이드 흑백 고정. 컬러 액센트 X (초안 단계).

[출력 형식 — JSON 한 가지]
출력 시작 = `{`, 끝 = `}`. 다른 텍스트·설명·코드펜스 모두 금지.

```json
{
  "title": "발주처명 + 사업명 + 정성 제안서",
  "domain": "festival|forum|exhibition|education|sports|campaign|tourism|rnd|welfare|other",
  "slide_width": 13.33,
  "slide_height": 7.5,
  "total_slides": 28,
  "outline": [
    {
      "page": 1,
      "section": "표지",
      "governing": "거버닝 메시지 (25자 이내)",
      "key_msgs": ["핵심 메시지 1", "핵심 메시지 2", "핵심 메시지 3"],
      "viz_hint": "표지 - 좌측 검은바 + 큰 헤드라인 + 우측 KPI 2~3개"
    },
    {
      "page": 2,
      "section": "목차",
      "governing": "CONTENTS",
      "key_msgs": ["Ⅰ. 제안 개요", "Ⅱ. 일반 부문", ...],
      "viz_hint": "목차 - 번호 매긴 큰 텍스트 5부"
    },
    {
      "page": 3,
      "section": "Ⅰ. 제안 개요 (챕터 divider)",
      "governing": "Ⅰ. 제안 개요",
      "key_msgs": ["챕터 한 줄 요약"],
      "viz_hint": "거대 챕터 번호 200pt + 챕터명"
    },
    {
      "page": 4,
      "section": "Ⅰ.1 추진 배경",
      "governing": "거버닝 메시지",
      "key_msgs": ["RFP 에서 도출한 배경 1", "배경 2", "배경 3"],
      "viz_hint": "comparison(AS-IS/TO-BE) 또는 stat(KPI 3~4개)"
    },
    ...
  ]
}
```

[규칙]
- outline 의 항목 수 = total_slides 와 일치
- key_msgs 는 슬라이드별 핵심 메시지 3~5개 (아직 본문 풀어 쓰지 말고 짧게)
- viz_hint 는 다음 단계에서 도형 JSON 그릴 때의 힌트 (간단히)
- 표지 / 목차 / 챕터 divider 5장 / 마무리 1장은 반드시 포함
"""


# ─── Phase 2: 슬라이드별 시스템 프롬프트 ──────────────────────────────────────
SLIDE_SYSTEM_PROMPT = """너는 SOOZOO 톤의 흑백 제안서 슬라이드 디자이너 + 카피라이터다.

지금 단계는 **이 한 슬라이드 1장만** 도형 JSON 으로 그린다. 다른 슬라이드는 신경 X.
이 슬라이드에 16k 토큰 다 써도 되니까 **빽빽하게, 디테일하게, 풍부하게** 채워라.

[★★★ 본문 분량 — 절대 강제 ★★★]
- 한 슬라이드의 텍스트 박스 총 글자수 합계: **최소 600자, 권장 800~1500자**
- 텍스트 박스 개수: **최소 8개, 권장 15~30개**
- 도형 총 개수: **15~50개** (표·카드·플로우·KPI 같이 풍부)
- 추상 형용사("혁신적·효율적·다양한·우수한") 슬라이드당 0개 — 발견 시 폐기 후 재작성
- 수치는 **무조건 단위까지** (㎡ · m · m/s · ㎍/㎥ · 명 · 원 · % · °C · MB · Gbps · 회 · dB · lux 등)

[색감 — 절대 흑백]
허용 색상 6개만:
  · #1A1A1A (검정)  · #444 (본문)   · #666 (소제목)
  · #999 (메타)     · #DDD (구분선) · #FFFFFF (배경·반전)
컬러 hex 1개라도 들어가면 슬라이드 전체 폐기.
강조 = 검정 fill 박스 + 흰 텍스트 (반전) 또는 굵기 weight 800~900.

[도형 6 종 — 인치 좌표]
  ① rect    {x, y, w, h, fill, stroke?, stroke_width?, radius?}
  ② text    {x, y, w, h, text, size(pt), weight(100~900), color, align, valign?, italic?}
  ③ line    {x1, y1, x2, y2, color, width}
  ④ arrow   {x1, y1, x2, y2, color, width}
  ⑤ circle  {x, y, w, h, fill, stroke?, stroke_width?}
  ⑥ image   {x, y, w, h, hint}  (회색 placeholder 자동 처리)

[캔버스]
- slide_width / slide_height 는 너에게 주어진 값 그대로 사용
- 모든 도형 좌표는 캔버스 안 (0 ≤ x+w ≤ slide_width, 0 ≤ y+h ≤ slide_height)

[푸터 일관성 — 모든 슬라이드 공통]
- y=7.4 (또는 슬라이드 높이의 ~99%) 에 가로 구분선 #DDD
- 좌하단: 회사명 + section 명 (9pt #999)
- 우하단: "현재페이지 / 전체페이지" (9pt #999)

[레이아웃 패턴 가이드]
표지: 좌 검은 바(0.4×전체높이) + 큰 헤드라인 36~60pt + 부제 + 우측 KPI 2~3개
목차: 번호(Ⅰ~Ⅴ) 60pt + 항목명 24pt + 한 줄 요약 12pt — 5행
챕터 divider: 거대 번호 (Ⅰ) 180~220pt 가운데 + 챕터명 32pt + 한 줄 14pt
KPI 페이지: 큰 숫자 (80~120pt) × 3~4개 카드, 라벨·부연 설명 함께
표 페이지: rect 로 셀 그리고 text 채우기. 행 6~10, 열 4~6
플로우: 박스/원 + 잇는 line + 끝 arrow. 단계 5~7개
비교 (AS-IS/TO-BE): 좌우 박스 + 가운데 화살표, 각 박스 5~7행
조직도: 최상위 박스 + 선 + 하위 박스 3~5개, 각 박스 = 직책 + 경력
타임라인: 가로축 D-90~D+30, 세로축 활동, 막대로 기간

[거버닝 메시지 원칙]
- 25자 이내, 명사형 문어체
- ⚠ em-dash(—) / hyphen(-) 명사 나열 / 콜론(:) / 슬래시(/) 절대 금지
- 콤마(,) 와 × 기호는 OK

[★ AI 사투리 제거 ★]
RAG 학습한 과거 우리 회사 제안서 본문이 시스템 메시지에 inline 됨. 그 톤·디테일·구조 그대로 흉내.
일반 GPT 가 쓰는 두루뭉술한 표현 절대 금지:
- ❌ "효과적인 운영", "다양한 프로그램", "혁신적인 접근"
- ✅ "운영 본부장 단독 권한 — 회의 절차 생략", "강수량 시간당 30mm 이상 → 경계 발령"

[출력 형식 — 한 슬라이드 JSON 만]
출력 시작 = `{`, 끝 = `}`. 다른 텍스트·설명·코드펜스 모두 금지.

```json
{
  "section": "Ⅰ.1 추진 배경",
  "shapes": [
    {"type": "text", "x": 0.5, "y": 0.3, "w": 4, "h": 0.4,
     "text": "Ⅰ. 제안 개요  ·  1. 추진 배경", "size": 10, "color": "#999"},
    {"type": "text", "x": 0.5, "y": 0.8, "w": 12, "h": 1.2,
     "text": "거버닝 메시지", "size": 32, "weight": 800, "color": "#1A1A1A"},
    {"type": "text", "x": 0.5, "y": 2.0, "w": 12, "h": 0.4,
     "text": "부제 한 줄", "size": 14, "weight": 500, "color": "#444"},
    ... (텍스트 박스 15~30개, 도형 총 15~50개) ...
    {"type": "line", "x1": 0.4, "y1": 7.4, "x2": 12.93, "y2": 7.4, "color": "#DDD"},
    {"type": "text", "x": 0.5, "y": 7.45, "w": 6, "h": 0.3,
     "text": "회사명  ·  추진 배경", "size": 9, "color": "#999"},
    {"type": "text", "x": 7, "y": 7.45, "w": 5.93, "h": 0.3,
     "text": "4 / 28", "size": 9, "color": "#999", "align": "right"}
  ]
}
```

[규칙]
- 출력은 **한 슬라이드의 도형 JSON 한 개**. 이 슬라이드 외 다른 슬라이드 절대 출력 X.
- 첫 글자 = `{`, 끝 글자 = `}`.
- 도형 수 / 텍스트 분량 위 강제 기준 충족.
"""


# ─── 타입 ────────────────────────────────────────────────────────────────────
@dataclass
class OutlineItem:
    page: int
    section: str
    governing: str = ""
    key_msgs: list[str] = field(default_factory=list)
    viz_hint: str = ""


@dataclass
class OutlineResult:
    title: str
    domain: str
    slide_width: float
    slide_height: float
    total_slides: int
    outline: list[OutlineItem]


@dataclass
class SlideResult:
    page: int
    section: str
    shapes: list[dict] = field(default_factory=list)
    error: str = ""


# ─── 유틸 ─────────────────────────────────────────────────────────────────────
def _strip_codefence(s: str) -> str:
    s = s.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _parse_json_safely(s: str) -> Optional[dict]:
    s = _strip_codefence(s)
    try:
        return json.loads(s)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", s)
        if not m:
            return None
        try:
            return json.loads(m.group(0))
        except Exception:
            return None


def _call_anthropic_sync(client, system: str, user: str, max_tokens: int = 8000, model: str = "") -> str:
    """동기 Anthropic 호출 (asyncio.to_thread 로 감싸 사용)."""
    import os
    model = model or os.environ.get("MODEL", "") or "claude-sonnet-4-5-20250514"
    resp = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    parts = []
    for b in resp.content or []:
        btype = getattr(b, "type", None) if not isinstance(b, dict) else b.get("type")
        if btype == "text":
            text = getattr(b, "text", None) if not isinstance(b, dict) else b.get("text")
            if text:
                parts.append(str(text))
    return "".join(parts).strip()


# ─── Phase 1: Outline 생성 ────────────────────────────────────────────────────
async def generate_outline(
    client,
    rfp_block: str,
    rag_block: str,
    intel_block: str,
    extra_block: str = "",
    model: str = "",
) -> OutlineResult:
    """Phase 1: 가벼운 호출 1번으로 outline 짠다."""
    user_parts = [rfp_block]
    if rag_block:
        user_parts.append(rag_block)
    if intel_block:
        user_parts.append(intel_block)
    if extra_block:
        user_parts.append(extra_block)
    user_parts.append("\n위 정보를 바탕으로 outline JSON 을 출력해라.")
    user = "\n\n".join(user_parts)

    raw = await asyncio.to_thread(
        _call_anthropic_sync, client, OUTLINE_SYSTEM_PROMPT, user, 8000, model,
    )
    parsed = _parse_json_safely(raw)
    if not parsed or not isinstance(parsed.get("outline"), list):
        raise RuntimeError(f"Outline 파싱 실패. raw 앞 200자: {raw[:200]}")

    items = []
    for it in parsed["outline"]:
        if not isinstance(it, dict):
            continue
        items.append(OutlineItem(
            page=int(it.get("page", len(items) + 1)),
            section=str(it.get("section", "")).strip(),
            governing=str(it.get("governing", "")).strip(),
            key_msgs=[str(m).strip() for m in (it.get("key_msgs") or []) if m],
            viz_hint=str(it.get("viz_hint", "")).strip(),
        ))

    return OutlineResult(
        title=str(parsed.get("title", "")).strip(),
        domain=str(parsed.get("domain", "other")).strip(),
        slide_width=float(parsed.get("slide_width") or 13.33),
        slide_height=float(parsed.get("slide_height") or 7.5),
        total_slides=int(parsed.get("total_slides") or len(items)),
        outline=items,
    )


# ─── Phase 2: 슬라이드별 도형 JSON ───────────────────────────────────────────
def _build_slide_user_prompt(
    item: OutlineItem,
    outline_summary: str,
    rag_per_slide_block: str,
    canvas: tuple[float, float],
    company_name: str,
    total_slides: int,
) -> str:
    parts = [
        f"[슬라이드 캔버스] slide_width={canvas[0]}, slide_height={canvas[1]}",
        f"[회사명] {company_name or '회사명'}",
        f"[전체 슬라이드 수] {total_slides}",
        f"[현재 슬라이드 페이지] {item.page} / {total_slides}",
        f"[섹션] {item.section}",
        f"[거버닝 메시지] {item.governing}",
        f"[핵심 메시지 (이걸 본문으로 풀어서 빽빽하게 채워라)] {' / '.join(item.key_msgs)}",
        f"[시각화 힌트] {item.viz_hint}",
        "",
        "[전체 outline 요약 — breadcrumb 일관성 유지용]",
        outline_summary,
    ]
    if rag_per_slide_block:
        parts.append("")
        parts.append(rag_per_slide_block)
    parts.append("")
    parts.append("위 정보를 바탕으로 이 한 슬라이드의 도형 JSON 을 출력해라.")
    parts.append(f"출력 = {{ \"section\": \"{item.section}\", \"shapes\": [...] }}")
    return "\n".join(parts)


async def generate_one_slide(
    client,
    item: OutlineItem,
    outline_summary: str,
    rag_per_slide_block: str,
    canvas: tuple[float, float],
    company_name: str,
    total_slides: int,
    model: str = "",
) -> SlideResult:
    user = _build_slide_user_prompt(
        item, outline_summary, rag_per_slide_block, canvas, company_name, total_slides,
    )
    try:
        raw = await asyncio.to_thread(
            _call_anthropic_sync, client, SLIDE_SYSTEM_PROMPT, user, 16000, model,
        )
        parsed = _parse_json_safely(raw)
        if not parsed or not isinstance(parsed.get("shapes"), list):
            return SlideResult(page=item.page, section=item.section,
                              error=f"파싱 실패. raw 앞 200자: {raw[:200]}")
        return SlideResult(
            page=item.page,
            section=str(parsed.get("section", item.section)),
            shapes=parsed["shapes"],
        )
    except Exception as e:
        return SlideResult(page=item.page, section=item.section, error=str(e)[:200])


# ─── Phase 2 병렬 실행 ────────────────────────────────────────────────────────
async def generate_slides_parallel(
    client,
    outline: OutlineResult,
    rag_for_slide,  # callable: (item) -> str (RAG block)
    company_name: str,
    concurrency: int = 5,
    model: str = "",
) -> AsyncIterator[SlideResult]:
    """슬라이드들을 동시 N 개씩 병렬 호출하면서, 끝나는 대로 yield."""
    outline_summary = "\n".join(
        f"  p{it.page}. {it.section}: {it.governing}" for it in outline.outline
    )
    canvas = (outline.slide_width, outline.slide_height)

    sem = asyncio.Semaphore(concurrency)

    async def _bound(item: OutlineItem) -> SlideResult:
        async with sem:
            rag_block = ""
            try:
                rag_block = rag_for_slide(item) or ""
            except Exception as e:
                log.warning("slide RAG 블록 생성 실패 (p%d): %s", item.page, e)
            return await generate_one_slide(
                client, item, outline_summary, rag_block, canvas, company_name,
                outline.total_slides, model,
            )

    tasks = [asyncio.create_task(_bound(it)) for it in outline.outline]
    for coro in asyncio.as_completed(tasks):
        yield await coro


# ─── Phase 3: 병합 + 진행률 SSE ──────────────────────────────────────────────
async def orchestrate(
    *,
    client,
    rfp_block: str,
    rag_block_global: str,
    rag_for_slide,  # callable
    intel_block: str = "",
    extra_block: str = "",
    company_name: str = "",
    concurrency: int = 5,
    model: str = "",
) -> AsyncIterator[dict]:
    """전체 파이프라인 실행. dict 이벤트 stream 으로 yield.

    이벤트 종류:
      {"type":"phase","phase":"outline","message":"목차 작성 중..."}
      {"type":"outline_done","total_slides":N,"title":"...","outline":[...]}
      {"type":"slide_done","page":i,"section":"...","ok":true,"error":"..."}
      {"type":"merge","message":"병합 중..."}
      {"type":"done","payload":{title,domain,slide_width,slide_height,slides:[...]}}
      {"type":"error","error":"..."}
    """
    t0 = time.time()
    yield {"type": "phase", "phase": "outline", "message": "목차 / 슬라이드 구성 작성 중..."}

    try:
        outline = await generate_outline(client, rfp_block, rag_block_global, intel_block, extra_block, model)
    except Exception as e:
        yield {"type": "error", "error": f"outline 실패: {e}"}
        return

    yield {
        "type": "outline_done",
        "total_slides": outline.total_slides,
        "title": outline.title,
        "domain": outline.domain,
        "outline": [
            {"page": it.page, "section": it.section, "governing": it.governing}
            for it in outline.outline
        ],
        "elapsed_sec": round(time.time() - t0, 1),
    }

    yield {"type": "phase", "phase": "slides", "message": f"슬라이드 {outline.total_slides}장 병렬 작성 중 (동시 {concurrency}개)..."}

    slides: dict[int, SlideResult] = {}
    done_count = 0
    async for sr in generate_slides_parallel(
        client, outline, rag_for_slide, company_name, concurrency, model,
    ):
        slides[sr.page] = sr
        done_count += 1
        yield {
            "type": "slide_done",
            "page": sr.page,
            "section": sr.section,
            "ok": not bool(sr.error),
            "error": sr.error,
            "shapes_count": len(sr.shapes),
            "progress": done_count,
            "total": outline.total_slides,
        }

    yield {"type": "phase", "phase": "merge", "message": "도형 JSON 병합 중..."}

    # 페이지 순서대로 정렬
    ordered = sorted(slides.values(), key=lambda s: s.page)
    final_slides = []
    for sr in ordered:
        if sr.error or not sr.shapes:
            # 빈 슬라이드 placeholder (전체 실패 막기)
            final_slides.append({
                "section": sr.section,
                "shapes": [
                    {"type": "text", "x": 1, "y": 3, "w": 11, "h": 1,
                     "text": f"[페이지 {sr.page} 작성 실패 — 다시 생성해주세요]",
                     "size": 18, "color": "#999"},
                ],
            })
        else:
            final_slides.append({"section": sr.section, "shapes": sr.shapes})

    payload = {
        "title": outline.title,
        "domain": outline.domain,
        "slide_width": outline.slide_width,
        "slide_height": outline.slide_height,
        "slides": final_slides,
    }

    yield {
        "type": "done",
        "payload": payload,
        "elapsed_sec": round(time.time() - t0, 1),
        "ok_slides": sum(1 for s in slides.values() if not s.error),
        "total": outline.total_slides,
    }
