"""Spec Opus55-Prep — 호출부별 effort · max_tokens · 거절(refusal) 판정을 한 곳에서 관리.

★ 플래그 MODEL_EFFORT_ENABLED (기본 False).
  · OFF  → effort_kwargs() = {} · max_tokens() = 호출부 기존 값 → 요청 내용이 지금과 바이트 동일.
  · ON   → 모델이 5.5 계열(claude-*-5-5)일 때만 effort 를 보낸다.
           4.8 등 다른 모델이면 OFF 와 똑같다 (나중에 4.8 로 되돌려도 지금과 완전히 같게).
★ 운영 SDK 가 anthropic==0.52.0 이라 messages.create 에 output_config 인자가 없다
  → extra_body 로 보낸다 (2026-10-15 실측: 5.5 가 extra_body 의 output_config.effort 를 받음).
★ 5.5 는 thinking 을 끌 수 없다 — 생각의 양은 effort 로만 조절한다.
  effort 를 안 보내면 5.5 는 medium 으로 돈다 (4.8 은 thinking 꺼짐 + effort high).
"""
from __future__ import annotations

import re

MODEL_EFFORT_ENABLED = True

# 5.5 계열 모델 — opus / sonnet / haiku 5.5. (4.x · 5 · fable 등은 해당 없음)
_EFFORT_MODEL_RE = re.compile(r"^claude-(?:opus|sonnet|haiku)-5-5(?:$|[-@])")

# ─── 호출부 → effort (한 곳에서 관리) ─────────────────────────────────────────
#   low    : 짧고 형식이 정해진 작은 기능 · 응답 속도가 중요한 곳
#   medium : 결과가 뒤 단계 전체의 바탕이 되거나, 빠뜨림을 찾는 판단이 필요한 곳
EFFORT_BY_SITE = {
    # 생성 파이프라인 (proposal_multi_pass.py) — user 확정
    "strategy": "medium",            # 대전략·콘셉트 — 덱 전체의 축
    "outline": "medium",             # 목차 — 덱 뼈대 (프리셋 배정·장 구성)
    "slide": "low",                  # 슬라이드 ×N — 비용 −24% · 속도 2배 (시험 B)
    "path1_enrich": "low",           # HTML 모드(관리자 토글) 칸 채우기 — 2000 상한
    # main.py
    "preflight": "low",              # 생성 전 1토큰 확인
    "settings_test": "low",          # 관리자 키 테스트 (16토큰)
    "chat": "low",                   # 전략 대화 — 첫 글자까지 기다림이 짧아야 함
    "rfp_aggregate": "medium",       # RFP 분석 — 모든 단계의 바탕
    "company_dna": "low",            # 회사 DNA — 짧은 JSON (1500)
    "refs_summary": "low",           # 참고자료 요약 — 정해진 JSON (3500)
    "company_docs_extract": "low",   # 모델 고정(Haiku 4.5) → 5.5 아니라 실제로는 안 나감
    "budget": "medium",              # 산출내역서 — 금액 산정·합계 맞추기
    "client_intel": "low",           # 발주처 들여다보기 — 짧은 JSON + 웹검색 (4000)
    "research": "medium",            # 과업 리서치 — 목차·슬라이드 근거로 주입됨
    "submission_docs": "low",        # 모델 고정(Sonnet 4.6) → 실제로는 안 나감
    "audit": "medium",               # 제안서 점검 — 빠진 요구사항 찾기
    "pt_script": "low",              # PT 대본 — 정해진 JSON
    "pt_qa": "low",                  # PT 예상 Q&A — 정해진 JSON
}

# ─── 5.5 + 플래그 ON 일 때만 쓰는 max_tokens (OFF 거나 다른 모델이면 호출부 기존 값) ───
#   thinking 토큰이 max_tokens 안에 포함되므로, 실측에서 상한 대비 70% 를 넘은 곳만 올린다.
#   2026-10-15 실측 (5.5 · 위 effort · test88 입력) — 출력 토큰 / 기존 상한 (그중 thinking):
MAX_TOKENS_55 = {
    "budget": 20000,          # 8000 / 8000 잘림 (thinking 6,841) — JSON 미완성 → 실패
    "audit": 12000,           # 4000 / 4000 잘림 (thinking 2,764) — 실패
    "pt_script": 10000,       # 4000 / 4000 잘림 (thinking 0 — 본문만으로 초과) — 실패
    "pt_qa": 10000,           # 4000 / 4000 잘림 (thinking 0) — 실패
    "rfp_aggregate": 20000,   # 11,466 / 12000 = 96% (thinking 1,702)
    "research": 10000,        # 4,441 / 6000 = 74% (thinking 1,677, 웹검색 5회)
}


def effort_on(model: str) -> bool:
    """플래그 ON + 5.5 계열 모델일 때만 True."""
    return bool(MODEL_EFFORT_ENABLED and _EFFORT_MODEL_RE.match(str(model or "")))


def effort_kwargs(site: str, model: str) -> dict:
    """messages.create / stream 에 펼쳐 넣을 추가 인자. 해당 없으면 {} (요청 무변화)."""
    if not effort_on(model):
        return {}
    effort = EFFORT_BY_SITE.get(site)
    if not effort:
        return {}
    return {"extra_body": {"output_config": {"effort": effort}}}


def max_tokens(site: str, model: str, default: int) -> int:
    """호출부 max_tokens. 플래그 ON + 5.5 이고 표에 있을 때만 바꾼다."""
    if not effort_on(model):
        return default
    return MAX_TOKENS_55.get(site, default)


def refusal_of(resp, model: str = "") -> "str | None":
    """플래그 ON + 5.5 응답이 안전 분류기 거절(stop_reason=refusal)이면 분류명(없으면 'unknown').

    해당 없으면 None — 호출부는 지금과 똑같이 진행한다.
    """
    if not effort_on(model or getattr(resp, "model", "")):
        return None
    if getattr(resp, "stop_reason", None) != "refusal":
        return None
    details = getattr(resp, "stop_details", None)
    if details is None:
        details = (getattr(resp, "model_extra", None) or {}).get("stop_details")
    category = details.get("category") if isinstance(details, dict) else getattr(details, "category", None)
    return str(category or "unknown")


class ModelRefusal(RuntimeError):
    """5.5 안전 분류기가 요청을 거절함 — 같은 요청을 다시 보내도 결과가 같으므로 재시도하지 않는다."""

    def __init__(self, site: str, category: str):
        self.site = site
        self.category = category
        super().__init__(f"AI 안전 기준에 걸려 생성이 거절됐어요 (단계: {site} · 분류: {category})")
