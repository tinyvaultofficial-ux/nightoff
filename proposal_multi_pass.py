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


# ─── 도메인 톤 매트릭스 (PROPOSAL_SYSTEM_PROMPT 의 LAYER 2 발췌) ─────────────
# Phase 2 슬라이드별 호출 시 outline.domain 값에 따라 해당 도메인의 톤 가이드를
# user prompt 에 동적 inline. PROPOSAL_SYSTEM_PROMPT 의 LAYER 2 와 동일 source 유지.
DOMAIN_TONE_MATRIX: dict[str, dict] = {
    "festival": {
        "label": "축제·행사·기념식",
        "endings": "~ 구조 / ~ 설계 / ~ 여정 / ~ 경험 / ~ 확립",
        "tone": "시적·감성, 체험·기억·몰입 강조, 이미지적 메타포",
        "vocab": "참여, 몰입, 기억, 순간, 여정, 빛, 발견, 연결, 공명, 울림",
        "register": "문장을 짧고 운율감 있게. 체언종결·쉼표 활용.",
        "examples": [
            "작은 빛을 지키는 모든 행동이 축제 프로그램으로 설계됩니다",
            "관람을 넘어 기억으로 남는, 감각 중심 체험 구조",
            "도심 속 생태 가치를 세대가 함께 발견하는 여정 설계",
        ],
        "sec45": "Ⅳ. 홍보 계획  /  Ⅴ. 사업 관리 부문",
        "must_pages": "안전 비상 매뉴얼 / 기상 단계 조치 / 인력 배치표",
    },
    "forum": {
        "label": "포럼·컨퍼런스·심포지엄·국제회의",
        "endings": "~ 플랫폼 / ~ 담론 / ~ 의제 / ~ 체계 / ~ 연대 / ~ 거버넌스",
        "tone": "지적·권위, 의제 설정·글로벌 시각 강조",
        "vocab": "담론, 통찰, 의제, 연대, 리더십, 어젠다, 싱크탱크, 트랙, 키노트, 이니셔티브",
        "register": "문장 완결성 강조. 명확한 정의·주장·근거.",
        "examples": [
            "동아시아 기후 의제를 한국이 주도하는 연간 담론 플랫폼 구축",
            "전문가·정책·시민을 교차시키는 3-tier 세션 설계",
            "단발 행사가 아닌 연속적 네트워크로 전환되는 거버넌스 체계",
        ],
        "sec45": "Ⅳ. 참여·확산 계획  /  Ⅴ. 운영 관리 부문",
        "must_pages": "연사 섭외·레퍼런스 / 세션 트랙 구조 / 네트워킹 운영 / 의전·VIP·통역 / 인력 배치표",
    },
    "education": {
        "label": "교육·연수·컨설팅·아카데미",
        "endings": "~ 모델 / ~ 방법론 / ~ 커리큘럼 / ~ 역량 / ~ 체계 / ~ 고도화",
        "tone": "논리·객관, 성과·역량·진단 강조",
        "vocab": "역량, 성취, 평가, 커리큘럼, 모듈, 진단, 맞춤형, 실습, 고도화, 이수율",
        "register": "원인·결과 구조. 숫자 근거 우선.",
        "examples": [
            "진단→설계→학습→평가의 4단계 역량 고도화 모델",
            "직무별 맞춤 커리큘럼과 사후 성취도 추적 체계",
            "실습 70% 중심의 집중 몰입형 교육 방법론 확립",
        ],
        "sec45": "Ⅳ. 학습자 모집·확산  /  Ⅴ. 품질 관리 부문",
        "must_pages": "커리큘럼 설계 / 평가 체계 / 강사진 프로필 / 학습환경·플랫폼 / 만족도·성취도 추적 체계",
    },
    "sports": {
        "label": "체육·대회·경기",
        "endings": "~ 시스템 / ~ 운영 / ~ 대응 / ~ 프로세스 / ~ 기준 / ~ 체계",
        "tone": "역동·정밀, 스피드·정확성·안전 강조",
        "vocab": "대회, 기록, 진행, 경기, 심판, 운영, 순위, 기량, 중계, 판정, 타임라인",
        "register": "단문. 규정 기반. 숫자와 시간 단위.",
        "examples": [
            "경기 진행·판정·기록이 동시에 정확히 흐르는 3중 운영 시스템",
            "선수·관중·심판 각각의 동선 완전 분리 안전 체계",
            "기상·부상·경기 중단 3분 내 의사결정 대응 프로세스",
        ],
        "sec45": "Ⅳ. 관중·홍보 계획  /  Ⅴ. 경기·운영 관리",
        "must_pages": "경기 운영 규정 / 심판·의무 배치 / 관중·선수 동선 분리 / 기상·부상 대응 매뉴얼 / 기록·중계 체계",
    },
    "exhibition": {
        "label": "박람회·전시·산업전·B2B",
        "endings": "~ 허브 / ~ 생태계 / ~ 플랫폼 / ~ 네트워크 / ~ 확장 / ~ 매칭",
        "tone": "규모·성과, 바이어 매칭·거래 성사 강조",
        "vocab": "바이어, 매칭, 상담, 참가기업, 성과, 확장, 생태계, MOU, 수출, 거래",
        "register": "숫자 중심. 참가사·상담 건수·예상 성과 정량 명시.",
        "examples": [
            "국내외 바이어 500사 × 참가기업 200사 = 연 10,000건 매칭 허브",
            "전시 이후에도 상담이 이어지는 6개월 지속 상담 플랫폼",
            "부스 운영·B2B 매칭·수출 성사를 한 흐름으로 연결한 생태계",
        ],
        "sec45": "Ⅳ. 참가기업·바이어 유치  /  Ⅴ. 운영·사후관리",
        "must_pages": "부스 배치도 / 참가기업 유치 전략 / 바이어 매칭 운영 / 전시 동선·VIP 의전 / 사후 성과 추적",
    },
    "campaign": {
        "label": "공공캠페인·시민참여·인식개선",
        "endings": "~ 확산 / ~ 실천 / ~ 참여 / ~ 인식 / ~ 공동체 / ~ 연대",
        "tone": "가치·사회적, 공감·공동체·행동 변화 강조",
        "vocab": "실천, 공동체, 인식, 변화, 연대, 시민, 함께, 우리, 일상, 습관",
        "register": "1인칭 복수('우리'), 일상 언어. 공감 → 행동 전환.",
        "examples": [
            "앎에서 실천으로, 일상에 스며드는 탄소중립 행동 확산 구조",
            "시민이 캠페인 대상이 아닌 생산자가 되는 공동체 참여 설계",
            "온·오프라인 경계 없는 360° 인식 전환 여정",
        ],
        "sec45": "Ⅳ. 확산 전략  /  Ⅴ. 운영·모니터링 부문",
        "must_pages": "타깃 세그먼트 / 메시지·크리에이티브 / 채널 전략 / 참여 유도 메커니즘 / 효과 측정 지표",
    },
    "tourism": {
        "label": "관광·지역·도시브랜딩",
        "endings": "~ 재해석 / ~ 체험 / ~ 여정 / ~ 브랜딩 / ~ 활성화 / ~ 매력화",
        "tone": "발견·매력, 장소성·정체성 강조, 내러티브",
        "vocab": "장소, 여정, 매력, 고유성, 콘텐츠, 체류, 재방문, 스토리, 큐레이션, 루트",
        "register": "감성·심미. 장소의 고유한 정체성 언어.",
        "examples": [
            "지역의 일상이 콘텐츠가 되는 5-루트 체류형 관광 재해석",
            "보는 관광을 넘어 머무는 경험으로 가는 체류·재방문 유도 여정 설계",
            "주민·생산자·방문객이 함께 완성하는 장소 브랜딩 체계",
        ],
        "sec45": "Ⅳ. 홍보·유치 계획  /  Ⅴ. 운영·지역연계 부문",
        "must_pages": "지역 자원 맵핑 / 콘텐츠 큐레이션 / 체류·재방문 유도 / 지역 파트너 네트워크 / 성과 지표",
    },
    "rnd": {
        "label": "R&D·연구·기술개발·용역연구",
        "endings": "~ 방법론 / ~ 모델 / ~ 고도화 / ~ 최적화 / ~ 체계 / ~ 검증",
        "tone": "논리·기술, 근거·방법론·재현성 강조",
        "vocab": "방법론, 검증, 고도화, 분석, 모델, 가설, 정량, 데이터, 실험, 베이스라인",
        "register": "논문·보고서 톤. 단정보다 근거·수치.",
        "examples": [
            "데이터 → 특성 추출 → 모델링 → 검증의 4단 방법론 고도화",
            "베이스라인 대비 정량 성능 개선을 입증하는 실험 체계",
            "재현 가능한 분석 파이프라인과 결과물 산출 체계 구축",
        ],
        "sec45": "Ⅳ. 결과 활용 계획  /  Ⅴ. 품질·일정 관리",
        "must_pages": "연구 방법론 / 데이터 수집·분석 설계 / 실험 설계·베이스라인 / 결과물 산출 계획 / 검증·재현성 체계",
    },
    "welfare": {
        "label": "복지·돌봄·사회서비스",
        "endings": "~ 지원체계 / ~ 돌봄 / ~ 지속가능성 / ~ 참여 / ~ 연대 / ~ 자립",
        "tone": "온정·신뢰, 돌봄·포용·존엄 강조",
        "vocab": "돌봄, 지원, 동반, 연계, 포용, 맞춤형, 지속가능, 존엄, 자립, 일상",
        "register": "따뜻한 존대. 당사자 존엄을 우선 언어로.",
        "examples": [
            "일상에서 자립까지, 단계별 맞춤형 돌봄 지원체계",
            "당사자가 선택하고 설계하는 참여형 복지 서비스 모델",
            "지역사회·가족·기관이 함께 지속하는 돌봄 연대 체계",
        ],
        "sec45": "Ⅳ. 이용자·가족 소통  /  Ⅴ. 품질·안전 관리",
        "must_pages": "서비스 대상·세그먼트 / 사례 관리 프로세스 / 종사자 배치·교육 / 안전·개인정보 관리 / 만족도·지속성 측정",
    },
    "other": {
        "label": "기타 (위에 해당 없음)",
        "endings": "~ 방안 / ~ 전략 / ~ 체계 / ~ 구축",
        "tone": "담백·전문, RFP 어조를 그대로 반영",
        "vocab": "(RFP 본문 어휘에 맞춰 자연스럽게)",
        "register": "공식 중립. 업계 표준 비즈니스 문체.",
        "examples": [],
        "sec45": "Ⅳ. 추진 전략  /  Ⅴ. 사업 관리 부문",
        "must_pages": "(RFP 요구사항에 맞춰 결정)",
    },
}


def _format_domain_tone(domain: str) -> str:
    """outline.domain 값을 받아 해당 도메인 톤 가이드를 user prompt 용 텍스트로 변환."""
    d = DOMAIN_TONE_MATRIX.get(domain, DOMAIN_TONE_MATRIX["other"])
    lines = [
        f"[도메인 톤 — {domain} ({d['label']})]",
        f"  거버닝 어미: {d['endings']}",
        f"  카피 톤: {d['tone']}",
        f"  어휘: {d['vocab']}",
        f"  레지스터: {d['register']}",
    ]
    if d["examples"]:
        lines.append("  거버닝 예시:")
        for ex in d["examples"]:
            lines.append(f"    · {ex}")
    lines.append(f"  Ⅳ·Ⅴ 명칭: {d['sec45']}")
    lines.append(f"  도메인 필수 페이지: {d['must_pages']}")
    lines.append(
        "  → 거버닝/소제목 어미·어휘·레지스터를 위 매트릭스에 일관 적용. "
        "단 흑백 6 색·5 부 구조·숫자 단위 원칙은 도메인 무관 동일 유지."
    )
    return "\n".join(lines)


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
  "slide_width": 11.69,
  "slide_height": 8.27,
  "total_slides": 28,
  "outline": [
    {
      "page": 1,
      "section": "표지",
      "governing": "거버닝 메시지 (25자 이내)",
      "key_msgs": ["핵심 메시지 1", "핵심 메시지 2", "핵심 메시지 3"],
      "viz_hint": "표지 - 큰 헤드라인 + 부제 + 발주처/사업명/날짜"
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
SLIDE_SYSTEM_PROMPT = """너는 흑백 제안서 슬라이드의 정보 구조 설계자 + 카피라이터다.
미적 시그니처 (좌측 컬러바 / italic 캡션 / take-away 강조 박스 같은) 는 디자이너 영역이므로
강제하지 않는다. 정보 구조 (폰트 위계 · 그리드 · 카드 구획 · 여백) 는 일관 유지한다.

지금 단계는 **이 한 슬라이드 1 장만** 도형 JSON 으로 그린다. 다른 슬라이드는 신경 X.
이 슬라이드에 16k 토큰 다 써도 되니까 **빽빽하게, 디테일하게, 풍부하게** 채워라.

[★★★ 본문 분량 — 절대 강제 ★★★]
- 한 슬라이드의 텍스트 박스 총 글자수 합계: **최소 600 자, 권장 800~1500 자** (표지·divider 는 예외 — 짧아도 OK)
- 텍스트 박스 개수: **최소 12 개, 권장 20~40 개** (SOOZOO 벤치마크 기준)
- 도형 총 개수 (★ SOOZOO 벤치마크 ★):
  · 콘텐츠 슬라이드 (배경·기획·내용·전략 등): **30~70 개** (평균 48 목표)
  · 표지·챕터 표지·마무리 슬라이드: **15~30 개**
  · 헐거운 슬라이드 (도형 5~10) = 60 점. 빽빽한 시각화 (도형 30+) = 80 점.
  · "사각형 3 개 + 선 2 개" 식 절대 금지.
- 추상 형용사 ("혁신적·효율적·다양한·체계적·탁월한·우수한") 슬라이드당 2 개 미만 — 발견 시 폐기 후 재작성
- 수치는 **무조건 단위까지** (㎡ · m · m/s · ㎍/㎥ · 명 · 원 · % · °C · MB · Gbps · 회 · dB · lux 등)

[색감 — 절대 흑백 6 색]
허용 색상은 다음 6 개뿐:
  · #1A1A1A (메인 검정)  · #444 (본문)   · #666 (소제목)
  · #999 (메타·캡션)     · #DDD (구분선) · #FFFFFF (배경)
컬러 hex (오렌지·블루·레드·그린 등) 1 개라도 들어가면 슬라이드 전체 폐기.
강조 표현은 자유 선택: 굵기 (weight 800~900) / 폰트 사이즈 / 단색 강조 박스 / 충분한 여백.
특정 모티브 (예: 검정 fill + 흰 텍스트 반전) 강제 X.

[도형 6 종 — 인치 좌표]
  ① rect    {x, y, w, h, fill, stroke?, stroke_width?, radius?}
  ② text    {x, y, w, h, text, size(pt), weight(100~900), color,
             font_family (선택, 미지정 시 코드가 "Paperlogy" 강제),
             align, valign?, italic?}
  ③ line    {x1, y1, x2, y2, color, width}
  ④ arrow   {x1, y1, x2, y2, color, width}
  ⑤ circle  {x, y, w, h, fill, stroke?, stroke_width?}
  ⑥ image   {x, y, w, h, hint}  (회색 placeholder 자동 처리)

[weight 9 단계 매핑 — 코드가 Paperlogy 의 9 weight 별 폰트로 자동 매핑]
weight 값을 다음 9 단계 중 하나로 지정. 코드가 Paperlogy-1Thin ~ Paperlogy-9Black 으로 매핑.

  100  Thin         — 매우 가는 메타 (사용 거의 X)
  200  ExtraLight   — 캡션·부속 라벨
  300  Light        — 메타·부연·캡션 (#999 메타 텍스트 등)
  400  Regular      — 일반 본문 (디폴트)
  500  Medium       — 본문 강조·소제목
  600  SemiBold     — 소제목·라벨 강조
  700  Bold         — 작은 헤드라인·표 헤더
  800  ExtraBold    — 큰 헤드라인 (거버닝 메시지)
  900  Black        — 표지·KPI 거대 숫자·5 부 챕터 번호 (60pt+)

권장:
- 거버닝: weight 800~900
- 부제: 500~600
- 본문: 400~500
- 메타·푸터·캡션: 300~400
- KPI 거대 숫자 (80~120pt): 900

[캔버스 — A4 가로 강제]
- slide_width=11.69, slide_height=8.27 (A4 가로 — 한국 B2G 인쇄 표준) — user prompt 에 주어진 값 그대로 사용
- 모든 도형 좌표는 캔버스 안 (0 ≤ x+w ≤ slide_width, 0 ≤ y+h ≤ slide_height)
- 16:9 같은 PT 발표 비율은 RFP 가 명시적으로 요청한 경우만

[정보 위치 표시 — 단순하게 · 위치 자율]
- 챕터 표시 (breadcrumb): 9~10pt #999 weight 300~400. 좌상단 권장이지만 자율.
- 페이지 번호: 작은 폰트 #999. 위치는 자율 (우하단 또는 우상단). 30 슬라이드 일관 위치.
- 섹션명 표시는 필요시만. 모든 슬라이드 강제 X. (회사명은 본문 inject 금지 — 청렴제)
- 가로 구분선·좌측 컬러바·하단 take-away 박스 같은 미적 모티브는 강제 X.
  (디자이너가 받아서 추가/변경할 여백을 남긴다)

[거버닝 메시지 원칙]
- 25 자 이내, 명사형 문어체
- ⚠⚠⚠ em-dash(—) / hyphen(-) 명사 나열 / 콜론(:) / 슬래시(/) 절대 금지
- 콤마(,) 와 × 기호는 OK

[본문 글투 — 거버닝과 같은 원칙. 본문에도 모두 적용]
거버닝뿐 아니라 **모든 텍스트 박스 본문** 에 같은 원칙 적용.

⚠ 기호 남용 금지 — em-dash · 콜론 · 슬래시 명사 나열 본문에도 0~1 회 이내.

⚠ 추상 형용사 빈도 — 슬라이드당 2 개 미만
- 금지 단어: "혁신적·효율적·다양한·체계적·탁월한·우수한·적절한·최고의·뛰어난·지속가능한·통합적인·전략적인·유기적인"
- 대안: 구체 수치·고유명사·단계/행동.
  "효율적 운영" ❌ → "현장 PM 1 인 + 본부장 3 인 단독 의사결정 체계, 회의 절차 생략" ✅

⚠ 영어 직역 어조 회피
- "~ 할 수 있습니다", "~ 하는 것이 좋습니다", "~ 하도록 합니다" → 명사형 종결로 교체.
  "운영할 수 있습니다" ❌ → "운영 체계" ✅
- "synergy", "leverage", "engagement", "implementation" 같은 콩글리시 금지.

⚠ 번호 매김 강박 금지 — 모든 본문을 1, 2, 3, 4 / ①②③ 로 만드는 패턴 금지.
- 슬라이드당 번호 매김은 step·timeline·process 같은 명백한 시각 블록 1 개에만.

⚠ 메타 멘트 금지 — "이는 매우 중요한 점입니다" / "이러한 방식은 ~ 에 도움이 됩니다" 류 금지.
- 모든 문장이 **사실·수치·행동** 만.

⚠ "~ 을 통해" 남발 금지 — 한 슬라이드 1 회만.

⚠ 수치는 단위까지 — "12 만 명" / "연 15 회" / "총 사업비 8 억 5 천만 원" / "강수량 30mm/h" / "풍속 12m/s".

[★ AI 사투리 제거 — RAG 학습 결과 반영]
RAG 학습한 과거 우리 회사 제안서 본문이 시스템 메시지에 inline 된다. **그 톤·디테일·구조 그대로 흉내**.
- ❌ "효과적인 운영", "다양한 프로그램", "혁신적인 접근"
- ✅ "운영 본부장 단독 권한, 회의 절차 생략", "강수량 시간당 30mm 이상 시 경계 발령"

[콘텐츠 유형별 권장 시각 구조 — 패턴 카탈로그]

콘텐츠 본질에 맞는 구조를 선택하라. 단순 박스 나열을 모든 슬라이드에 반복하지 마라.

1) AS-IS / TO-BE 비교 — 좌우 2 단 + 가운데 화살표. 적용: 문제→해결, 변화 전후
2) 3-4 카드 동등 비교 — 가로 등분, 카드 = 헤더 + 본문 + 결론. 적용: 차별점, 평행 분류
3) 단계별 프로세스 (가로 흐름) — 단계 5-7 개, 박스 + 화살표. 적용: 추진 절차, 운영 흐름
4) 수직 타임라인 — 좌측 시간/단계 + 우측 상세, 단계 4-6 개. 적용: 일정, 마일스톤
5) 2x2 매트릭스 / 사분면 — 2 축 분류, 사분면별 텍스트. 적용: SWOT, 포지셔닝
6) Before / After 점층 카드 — 카드 안 Before → After. 적용: 도입 효과, 개선 사례
7) 그리드 (인물/사례 나열) — 2x3 또는 2x4. 적용: 팀원, 유사 실적, 사례
8) 표지 / 챕터 표지 — 큰 헤드라인 (Black 50pt+) + 부제. 적용: 표지, 챕터 첫 페이지
9) 정량 데이터 강조 — 큰 숫자 (Black 80pt+) + 라벨. 적용: 통계, 성과, KPI
10) 핵심 메시지 단일 — 슬라이드 중앙 짧은 메시지, 충분한 여백. 적용: 챕터 마지막, 강조 선언

[적용 원칙]
- 콘텐츠 본질이 패턴을 선택. 미적 다양성 추구 X.
- 같은 패턴 연속 3 장 이상 반복 금지.
- 정보가 평행한 비교면 2/3, 흐름이면 4/5, 전환이면 1/6, 강조면 9/10.
- 패턴 안 맞으면 박스 나열로 회귀 금지. 카탈로그 외 다른 구조도 가능.

[도형 조합으로 다양한 시각 표현 만들기]
도형 종류는 단순해도 된다 (rect / text / line / arrow / circle 5 종 + image).
다양성은 도형 **조합** 에서 나온다. SOOZOO 가 사각형 70% + 선 28% + 원 2% 만으로 모든 패턴 표현.

조합 예시 (각 패턴별 도형 수 권장):
1) 벤다이어그램 (3 원 겹침): circle 3 + 라벨 text + 결론 text → 7~10 개 (강조용 단순)
2) 점층 타임라인 (4 단계): rect 4 + line 3 + arrow 1 + 라벨 text 다수 → 20~25 개
3) 매트릭스 (2x2): rect 4 + line 2 (축) + 축 라벨 text 2 + 사분면 text 다수 → 25~35 개
4) 프로세스 (5 단계): rect 5 + arrow 4 + 단계별 text 3 (번호+제목+설명) + 강조 rect → 30~40 개
5) Before/After: rect 2 (큰 박스) + 각 박스 안 rect 3~4 + arrow 1~2 + text 다수 → 35~45 개
6) 정량 강조 (큰 숫자): text 1~3 (거대 숫자) + rect 영역 구획 + line 분리 + 라벨 text 다수 → 15~25 개
7) 카드 그리드 (3x2 또는 2x4): rect 6~8 (카드) + 각 카드 안 rect (헤더) + text 3~4 → 40~55 개

[조합 원칙]
- 패턴 선택 후 도형 수 30~70 범위 들어오게 상세 정보 충분히 시각화.
- "사각형 3 + 선 2" = 60 점. "사각형 30 + 선 15 + 텍스트 다수" = 80 점.
- 도형 많아도 정렬·위계 깔끔하면 산만 X. **헐거운 것이 산만한 것이다.**

[도형 검증 자가 점검 — 슬라이드 작성 후 반드시 확인 — 12 항목]
1. 모든 좌표가 캔버스 안 (0 ≤ x+w ≤ slide_width, 0 ≤ y+h ≤ slide_height) 인가?
2. 텍스트 박스 size · weight 가 권장 범위 (size 9~120, weight 100~900) 인가?
3. 거버닝 메시지에 금지 기호 (— · / : 단일 사용) 0 개인가?
4. 페이지 번호 표시 있는가? (위치는 자율, 단 30 슬라이드 중 일관된 위치)
5. 도형 수: 콘텐츠 30~70 (평균 48 목표), 표지·챕터·마무리 15~30 범위인가?
   (헐거운 슬라이드 = 60 점. SOOZOO 평균 48 도형 기준.)
6. 본문 글자수 합계 600~1500 자 범위인가? (표지·divider 는 예외)
7. 흑백 6 색 (#1A1A1A / #444 / #666 / #999 / #DDD / #FFFFFF) 외 hex 0 개인가?
8. 거버닝 + 본문 모두에서 em-dash · 콜론 · 슬래시 명사 나열 0 개인가?
9. 추상 형용사 ("혁신적·효율적·다양한·체계적·탁월한·우수한") 슬라이드당 2 개 미만인가?
10. 수치 단위 누락 0 개인가? (단위 없는 숫자는 페이지번호·KPI 거대숫자 외 0)
11. 레이아웃 패턴 다양성: 위 10 가지 패턴 중 본 슬라이드에 적합한 것을 선택했는가?
    (이 슬라이드만 만들지만 전체 30 슬라이드 중 최소 6 가지 패턴 활용 의도 충족)
12. 도형 조합 다양성: 같은 도형 종류 단순 반복했는가, 조합으로 시각 패턴을 만들었는가?
    예: "사각형 5 개 가로 나열" = 60 점.
        "사각형 5 + 선 4 연결 + 라벨 다수 + 강조 박스" = 80 점.
→ 하나라도 어기면 해당 슬라이드 **즉시 폐기 · 재작성**.

[출력 형식 — 한 슬라이드 JSON 만]
출력 시작 = `{`, 끝 = `}`. 다른 텍스트·설명·코드펜스 모두 금지.

```json
{
  "section": "Ⅰ.1 추진 배경",
  "shapes": [
    {"type": "text", "x": 0.5, "y": 0.3, "w": 6, "h": 0.4,
     "text": "Ⅰ. 제안 개요  ·  1. 추진 배경", "size": 10, "weight": 300, "color": "#999"},
    {"type": "text", "x": 0.5, "y": 0.8, "w": 10.5, "h": 1.2,
     "text": "거버닝 메시지", "size": 32, "weight": 800, "color": "#1A1A1A"},
    {"type": "text", "x": 0.5, "y": 2.0, "w": 10.5, "h": 0.4,
     "text": "부제 한 줄", "size": 14, "weight": 500, "color": "#444"},
    ... (콘텐츠 슬라이드: 텍스트 박스 20~40 개, 도형 총 30~70 개. SOOZOO 평균 48) ...
    {"type": "text", "x": 10.5, "y": 7.95, "w": 1.0, "h": 0.25,
     "text": "4 / 28", "size": 9, "weight": 300, "color": "#999", "align": "right"}
  ]
}
```
(주의: 좌표는 A4 가로 11.69×8.27 캔버스 안. 가로 구분선 / 풀 푸터 같은 모티브는 강제 X.
 페이지 번호 외 추가 모티브는 슬라이드 본질이 요구할 때만.
 회사명은 본문에 inject 금지 — 청렴제 / 회사 소개 페이지 1회 외 등장 비정상.)

[규칙]
- 출력은 **한 슬라이드의 도형 JSON 한 개**. 이 슬라이드 외 다른 슬라이드 절대 출력 X.
- 첫 글자 = `{`, 끝 글자 = `}`.
- 도형 수 / 텍스트 분량 위 강제 기준 충족.
- user prompt 에 [도메인 톤 — ...] 블록이 inline 되어 있으면 그 매트릭스의 어미·어휘·레지스터 반드시 적용.
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
    model = model or os.environ.get("MODEL", "") or "claude-sonnet-4-5-20250929"
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
        slide_width=float(parsed.get("slide_width") or 11.69),
        slide_height=float(parsed.get("slide_height") or 8.27),
        total_slides=int(parsed.get("total_slides") or len(items)),
        outline=items,
    )


# ─── Phase 2: 슬라이드별 도형 JSON ───────────────────────────────────────────
def _build_slide_user_prompt(
    item: OutlineItem,
    outline_summary: str,
    rag_per_slide_block: str,
    canvas: tuple[float, float],
    total_slides: int,
    domain: str = "other",
) -> str:
    # 본인 회사명 inject 제거 (한국 공공입찰 청렴제 — 회사명 본문 등장 비정상)
    parts = [
        f"[슬라이드 캔버스] slide_width={canvas[0]}, slide_height={canvas[1]}",
        f"[전체 슬라이드 수] {total_slides}",
        f"[현재 슬라이드 페이지] {item.page} / {total_slides}",
        f"[섹션] {item.section}",
        f"[거버닝 메시지] {item.governing}",
        f"[핵심 메시지 (이걸 본문으로 풀어서 빽빽하게 채워라)] {' / '.join(item.key_msgs)}",
        f"[시각화 힌트] {item.viz_hint}",
        "",
        # 도메인 톤 매트릭스 inline (LAYER 2 발췌) — outline.domain 값에 따라 동적
        _format_domain_tone(domain),
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
    total_slides: int,
    model: str = "",
    domain: str = "other",
) -> SlideResult:
    user = _build_slide_user_prompt(
        item, outline_summary, rag_per_slide_block, canvas, total_slides,
        domain=domain,
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
                client, item, outline_summary, rag_block, canvas,
                outline.total_slides, model,
                domain=outline.domain,
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
        client, outline, rag_for_slide, concurrency, model,
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
