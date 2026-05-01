"""
RAG 6단계: NightOff 시스템 프롬프트에 주입할 스타일 힌트 + 본문 발췌 모듈.

설계 원칙 (v2 — 본문 통째 주입 모드):
- rag_kb.db (SQLite + sqlite-vec) 가 있을 때만 동작
- OPENAI_API_KEY 가 있을 때만 동작 (Anthropic 키와 별개)
- 둘 중 하나라도 없으면 None 반환 — NightOff 는 정상 동작 (RAG 블록만 생략)
- 학습 데이터 = 사용자 자기 회사 자산 → 본문을 풍부하게 그대로 inline 주입.
  AI 가 "톤만 흡수" 가 아니라 "디테일·수치·구조까지 흉내" 내도록 유도.
- 청크 8~12개 × 600~800자씩 → AI 가 진짜 분량감을 학습.
- 메모리 캐시 (쿼리 텍스트 해시 → 임베딩) 로 OpenAI 호출 최소화

사용법:
    from rag_retriever import retrieve_style_hints, format_hints_for_prompt, is_available

    if is_available():
        hints = retrieve_style_hints("축제 운영 안전 관리 홍보 계획", top_k=12)
        if hints:
            block = format_hints_for_prompt(hints)
            # block 을 시스템 프롬프트에 append
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import sqlite3
import struct
import threading
from collections import Counter
from pathlib import Path

log = logging.getLogger("rag")

DB_PATH = Path("rag_kb.db")
EMBED_MODEL = "text-embedding-3-large"
EMBED_DIM = 3072

# 모듈 전역 상태
_DB_LOCK = threading.Lock()
_DB: sqlite3.Connection | None = None
_OPENAI_CLIENT = None
# 쿼리 임베딩 캐시 (LRU 가벼운 버전)
_QUERY_CACHE: dict[str, bytes] = {}
_QUERY_CACHE_MAX = 256


def is_available() -> bool:
    """RAG 가 사용 가능한 환경인가? (DB 존재 + 키 존재)"""
    return DB_PATH.exists() and bool(os.environ.get("OPENAI_API_KEY", "").strip())


def _get_db() -> sqlite3.Connection | None:
    """sqlite-vec 로딩된 DB 핸들 (싱글턴)."""
    global _DB
    if _DB is not None:
        return _DB
    if not DB_PATH.exists():
        return None
    try:
        db = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        db.enable_load_extension(True)
        import sqlite_vec
        sqlite_vec.load(db)
        db.enable_load_extension(False)
        _DB = db
        return db
    except Exception as e:
        log.warning("rag DB 로드 실패: %s", e)
        return None


def _get_openai_client():
    """OpenAI 클라이언트 (싱글턴)."""
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is not None:
        return _OPENAI_CLIENT
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from openai import OpenAI
        _OPENAI_CLIENT = OpenAI(api_key=api_key)
        return _OPENAI_CLIENT
    except Exception as e:
        log.warning("OpenAI 클라이언트 생성 실패: %s", e)
        return None


def _embed(text: str) -> bytes | None:
    """쿼리 임베딩 (캐시 적용)."""
    text = text.strip()
    if not text:
        return None
    key = hashlib.sha1(text.encode("utf-8")).hexdigest()
    if key in _QUERY_CACHE:
        return _QUERY_CACHE[key]
    client = _get_openai_client()
    if client is None:
        return None
    try:
        resp = client.embeddings.create(model=EMBED_MODEL, input=[text])
        emb = resp.data[0].embedding
        b = struct.pack(f"{EMBED_DIM}f", *emb)
        # 캐시 크기 제한
        if len(_QUERY_CACHE) >= _QUERY_CACHE_MAX:
            # 가장 오래된 키 하나 제거 (FIFO)
            try:
                _QUERY_CACHE.pop(next(iter(_QUERY_CACHE)))
            except StopIteration:
                pass
        _QUERY_CACHE[key] = b
        return b
    except Exception as e:
        log.warning("임베딩 실패 (query=%r): %s", text[:50], e)
        return None


def _search(qbytes: bytes, top_k: int = 8) -> list[dict]:
    """vec_chunks 에서 KNN 검색 후 chunks 메타와 join."""
    db = _get_db()
    if db is None:
        return []
    with _DB_LOCK:
        try:
            rows = db.execute(
                """
                SELECT v.distance,
                       c.chunk_id, c.filename, c.pages, c.text,
                       c.ending_hits, c.visual_hits, c.section_hints, c.char_count
                FROM vec_chunks v
                JOIN chunks c ON c.rowid = v.rowid
                WHERE v.embedding MATCH ?
                  AND k = ?
                ORDER BY v.distance
                """,
                (qbytes, top_k),
            ).fetchall()
        except Exception as e:
            log.warning("vec 검색 실패: %s", e)
            return []
    out = []
    for r in rows:
        dist, chunk_id, filename, pages_json, text, eh, vh, sh, cc = r
        # OpenAI 임베딩은 unit-norm → cos = 1 - L2²/2
        cos_sim = 1.0 - (dist * dist) / 2.0
        out.append({
            "chunk_id": chunk_id,
            "filename": filename,
            "pages": json.loads(pages_json),
            "text": text,
            "char_count": cc,
            "ending_hits": json.loads(eh),
            "visual_hits": json.loads(vh),
            "section_hints": json.loads(sh),
            "cos_sim": cos_sim,
        })
    return out


# ─── 시각화 라벨 한글 매핑 (프롬프트 가독성) ───
VISUAL_LABEL_KO = {
    "step_flow":   "STEP/단계 플로우",
    "timeline":    "타임라인/로드맵",
    "table":       "표(구분/항목/세부내용)",
    "comparison":  "AS-IS / TO-BE 비교",
    "org":         "조직도/PM/디렉터 구성",
    "budget":      "예산/산출내역/단가표",
    "safety":      "안전·비상 매뉴얼",
    "stat_emph":   "숫자 강조 (%, 점, 건, 명)",
    "bullet":      "불릿 리스트 (●◆■)",
    "arrow":       "화살표 흐름 (→ ⇒)",
}

ENDING_LABEL_KO = {
    "전략": "~ 전략",
    "시스템": "~ 시스템",
    "체계": "~ 체계",
    "방안": "~ 방안",
    "플랫폼": "~ 플랫폼",
    "경험": "~ 경험",
    "설계": "~ 설계",
    "프로세스": "~ 프로세스",
    "매뉴얼": "~ 매뉴얼",
    "구조": "~ 구조",
}


def retrieve_style_hints(
    query: str,
    top_k: int = 12,
    excerpt_chars: int = 800,
    excerpt_count: int = 8,
) -> dict | None:
    """
    질의(통상 RFP 도메인+요구사항 합성) 에 대해 top-K 청크를 가져와
    **본문 풍부 발췌 + 스타일 통계** 를 동시 반환.

    Args:
        query: 검색 쿼리 (RFP 도메인+요구사항 합성)
        top_k: 검색해 올 청크 수 (통계 집계용)
        excerpt_chars: 각 발췌의 최대 글자수 (이전 120자 → 800자로 풀림)
        excerpt_count: 시스템 프롬프트에 inline 박을 발췌 수 (이전 3개 → 8개)

    반환 dict:
        {
            "query": str,
            "hits_count": int,
            "avg_chunk_chars": int,
            "visual_top": [(label_ko, count), ...],
            "ending_top": [(label_ko, count), ...],
            "sample_section_hints": [str, ...],
            "sample_excerpts": [
                {"filename": str, "pages": [int], "preview": str(<= excerpt_chars), "cos_sim": float}, ...
            ],
        }
    """
    if not is_available():
        return None
    qb = _embed(query)
    if qb is None:
        return None
    hits = _search(qb, top_k=top_k)
    if not hits:
        return None

    # 메타 집계
    vis_counter: Counter[str] = Counter()
    end_counter: Counter[str] = Counter()
    section_pool: list[str] = []
    char_total = 0
    for h in hits:
        for v in h["visual_hits"]:
            vis_counter[v] += 1
        for e in h["ending_hits"]:
            end_counter[e] += 1
        for s in h["section_hints"]:
            if s not in section_pool:
                section_pool.append(s)
        char_total += h["char_count"]

    avg_chars = char_total // max(1, len(hits))

    visual_top = [(VISUAL_LABEL_KO.get(k, k), c) for k, c in vis_counter.most_common(5)]
    ending_top = [(ENDING_LABEL_KO.get(k, k), c) for k, c in end_counter.most_common(5)]

    # 본문 발췌 — 길게, 많이.
    # 이전엔 120자 짜리 미리보기 3개였음 → 800자 짜리 8개로 확장.
    # AI 가 "이 정도 디테일·수치·구조" 를 직접 보고 흉내내야 차별화 발생.
    excerpts = []
    for h in hits[:excerpt_count]:
        text = (h["text"] or "").strip()
        # 너무 짧은 청크는 통째, 길면 잘라서
        if len(text) > excerpt_chars:
            text = text[:excerpt_chars].rstrip() + "…"
        # 줄바꿈은 유지 (구조 신호) — 단 3 개 이상 연속 줄바꿈만 정리
        import re as _re
        text = _re.sub(r"\n{3,}", "\n\n", text)
        excerpts.append({
            "filename": h["filename"][:40],
            "pages": h["pages"][:3],
            "preview": text,
            "char_count": h.get("char_count", 0),
            "cos_sim": round(h["cos_sim"], 3),
        })

    return {
        "query": query,
        "hits_count": len(hits),
        "avg_chunk_chars": avg_chars,
        "visual_top": visual_top,
        "ending_top": ending_top,
        "sample_section_hints": section_pool[:6],
        "sample_excerpts": excerpts,
    }


def build_query_from_slide(
    section: str,
    key_msgs: list[str] | None,
    domain_label: str = "",
    governing: str = "",
) -> str:
    """슬라이드 1장용 RAG 검색 쿼리.

    Multi-pass 모드에서 각 슬라이드를 그릴 때, 그 슬라이드 주제로만
    좁혀서 retrieve 해서 진짜 관련 chunk 만 inline 시키기 위한 helper.

    예시:
      section="안전 관리", key_msgs=["기상 단계별 대응", "비상 대응 매뉴얼"],
      domain_label="축제·행사"
      → "축제·행사 · 안전 관리 · 기상 단계별 대응 · 비상 대응 매뉴얼"
    """
    parts: list[str] = []
    if domain_label:
        parts.append(str(domain_label)[:30])
    if section:
        parts.append(str(section)[:50])
    if governing:
        parts.append(str(governing)[:60])
    if key_msgs:
        for m in key_msgs[:4]:
            if isinstance(m, str) and m.strip():
                parts.append(m.strip()[:50])
    query = " · ".join(p for p in parts if p)
    return query[:300]


def build_query_from_rfp(rfp_analysis: dict) -> str:
    """RFP 분석 dict → 합성 쿼리 1개.

    `project_domain_label`, `target_audience`, `key_requirements`(상위 3),
    `evaluation_criteria`(상위 2) 를 짧게 합쳐 검색 쿼리로 만듦.
    """
    if not rfp_analysis:
        return ""
    parts: list[str] = []
    if rfp_analysis.get("project_domain_label"):
        parts.append(str(rfp_analysis["project_domain_label"])[:40])
    if rfp_analysis.get("target_audience"):
        parts.append(str(rfp_analysis["target_audience"])[:40])
    reqs = rfp_analysis.get("key_requirements") or []
    if isinstance(reqs, list):
        for r in reqs[:3]:
            if isinstance(r, str):
                parts.append(r[:40])
            elif isinstance(r, dict):
                v = r.get("title") or r.get("name") or r.get("requirement") or ""
                if v:
                    parts.append(str(v)[:40])
    crit = rfp_analysis.get("evaluation_criteria") or []
    if isinstance(crit, list):
        for c in crit[:2]:
            if isinstance(c, str):
                parts.append(c[:40])
            elif isinstance(c, dict):
                v = c.get("name") or c.get("criterion") or c.get("title") or ""
                if v:
                    parts.append(str(v)[:40])
    if rfp_analysis.get("title"):
        # 본 제목은 마지막 — 도메인/요구사항이 더 일반적이라 우선
        parts.append(str(rfp_analysis["title"])[:60])
    query = " · ".join(p.strip() for p in parts if p and p.strip())
    return query[:400]


def format_hints_for_prompt(hints: dict) -> str:
    """retrieve_style_hints 의 결과 → 시스템 프롬프트용 텍스트 블록.

    v2: "톤만 흡수" → "디테일·수치·구조 그대로 흉내" 모드.
    사용자 자기 회사 자산이므로 발췌 본문을 풍부하게 inline 박고
    AI 가 그 밀도·수치 디테일·문장 구조까지 흉내내도록 강제 지시.
    """
    if not hints:
        return ""
    lines = [
        "═══════════════════════════════════════════════════",
        "[⚠ 매우 중요 — 우리 회사 RAG 학습 결과: 과거 수주 제안서 본문 발췌]",
        "═══════════════════════════════════════════════════",
        "",
        "아래는 **우리 회사가 실제로 작성·제출한 과거 제안서** 의 본문이다.",
        "발주처·사업·금액은 다르지만 **문장 밀도, 수치 디테일, 표·카드 구조, 어휘** 는",
        "이 회사가 실제로 수주에 성공한 작법이다. 새 제안서도 **같은 밀도·디테일·구조** 로 써라.",
        "",
        "★★★ 강제 준수 사항 ★★★",
        "1. 새 제안서의 슬라이드 본문은 아래 발췌와 **같은 정도로 빽빽** 해야 한다.",
        "   추상 형용사(혁신적·효율적·다양한)로 채우지 말고 아래처럼 구체적 수치·실명·단계로 채워라.",
        "2. 아래 발췌의 **문장 구조·표 패턴·카드 구성** 을 그대로 흉내내라.",
        "   (예: '4단계 매뉴얼: 평시→주의→경계→위험' / '연 12만 명 × 만족도 4.7/5.0' / 'D-90→D+30')",
        "3. 수치는 무조건 **단위까지** (㎡, 명, 원, %, 시간, 회, dB, lux, m/s 등).",
        "4. 발주처명·금액·사람 이름 같은 고유명사는 베끼지 말고, **구조와 디테일만** 새 제안서에 적용.",
        "5. 한 슬라이드 본문이 너무 짧으면(추상적·뼈만) **즉시 폐기 후 재작성** — 아래 발췌 수준으로 확장.",
        "",
        f"· 검색 쿼리: {hints['query'][:120]}",
        f"· 매칭된 청크 수: {hints['hits_count']} 개 · 평균 청크 길이: {hints['avg_chunk_chars']}자",
        f"  → **새 제안서 슬라이드 1장당 본문 텍스트 총량은 최소 {max(400, hints['avg_chunk_chars'] // 2)}자 이상** 으로 채워라.",
    ]
    if hints["visual_top"]:
        vt = ", ".join(f"{lbl}({cnt}회)" for lbl, cnt in hints["visual_top"])
        lines.append(f"· 우리 회사 단골 시각화: {vt}")
        lines.append("  → 도형 JSON 의 카드/표/플로우 패턴 짤 때 이 종류를 우선 사용.")
    if hints["ending_top"]:
        et = ", ".join(f"{lbl}({cnt}회)" for lbl, cnt in hints["ending_top"])
        lines.append(f"· 우리 회사 단골 명사형 어미: {et}")
        lines.append("  → 거버닝/소제목 끝맺음에 적극 활용 (이 회사 톤이 살아남).")
    if hints["sample_section_hints"]:
        sh = " / ".join(hints["sample_section_hints"][:5])
        lines.append(f"· 자주 등장한 소제목 패턴: {sh}")

    # 본문 발췌 — 풍부하게 inline. 이게 진짜 차별화의 핵심.
    if hints["sample_excerpts"]:
        lines.append("")
        lines.append("─────────────────────────────────────────────────────")
        lines.append("◆ 우리 회사 과거 제안서 본문 발췌 (이 정도 밀도·디테일로 새 제안서 작성)")
        lines.append("─────────────────────────────────────────────────────")
        for i, ex in enumerate(hints["sample_excerpts"], 1):
            lines.append("")
            lines.append(f"【발췌 {i}】 출처: {ex['filename']} p{ex['pages']} (관련도 {ex['cos_sim']}, 원문 {ex.get('char_count', 0)}자)")
            lines.append(ex["preview"])
        lines.append("")
        lines.append("─────────────────────────────────────────────────────")
        lines.append("위 발췌의 **수치 디테일 / 단계 구분 / 표 행 수 / 카드 개수 / 문장 길이** 그대로 흉내.")
        lines.append("형식만 흉내 X — **본문 분량과 구체성도 같은 수준** 까지 끌어올려라.")
        lines.append("─────────────────────────────────────────────────────")
    lines.append("")
    lines.append("→ 위 신호와 발췌를 새 제안서 본문에 적극 반영. "
                 "[레퍼런스 스타일 가이드] 블록이 있으면 그쪽이 우선.")
    return "\n".join(lines)
