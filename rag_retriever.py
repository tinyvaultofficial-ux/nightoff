"""
RAG 6단계: NightOff 시스템 프롬프트에 주입할 스타일 힌트 추출 모듈.

설계 원칙:
- rag_kb.db (SQLite + sqlite-vec) 가 있을 때만 동작
- OPENAI_API_KEY 가 있을 때만 동작 (Anthropic 키와 별개)
- 둘 중 하나라도 없으면 None 반환 — NightOff 는 정상 동작 (RAG 블록만 생략)
- 청크 원문은 절대 그대로 주입 X (콘텐츠 학습 위험)
  → visual_hits / ending_hits / section_hints 집계 + 짧은 발췌 1~2개만
- 메모리 캐시 (쿼리 텍스트 해시 → 임베딩) 로 OpenAI 호출 최소화

사용법:
    from rag_retriever import retrieve_style_hints, format_hints_for_prompt, is_available

    if is_available():
        hints = retrieve_style_hints("축제 운영 안전 관리 홍보 계획", top_k=8)
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


def retrieve_style_hints(query: str, top_k: int = 8) -> dict | None:
    """
    질의(통상 RFP 도메인+요구사항 합성) 에 대해 top-K 청크를 가져와
    스타일 신호를 집계해 반환.

    반환 dict:
        {
            "query": str,
            "hits_count": int,
            "avg_chunk_chars": int,
            "visual_top": [(label_ko, count), ...],
            "ending_top": [(label_ko, count), ...],
            "sample_section_hints": [str, ...],
            "sample_excerpts": [
                {"filename": str, "pages": [int], "preview": str(<=120자)}, ...
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

    # 발췌 — 상위 2~3개 청크의 앞 100자 (콘텐츠 통째 X, 톤 시그널만)
    excerpts = []
    for h in hits[:3]:
        preview = h["text"][:120].replace("\n", " ").strip()
        excerpts.append({
            "filename": h["filename"][:40],
            "pages": h["pages"][:3],
            "preview": preview,
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
    """retrieve_style_hints 의 결과 → 시스템 프롬프트용 텍스트 블록."""
    if not hints:
        return ""
    lines = [
        "[크리스 회사 RAG 학습 — 17개 과거 제안서에서 도출된 스타일 신호]",
        "발주처/사업명/금액 등 \"내용\"은 학습 대상이 아니다. 아래는 \"문체·시각화·구조\" 만 통계로 추출한 신호.",
        "이 신호를 새 제안서에도 자연스럽게 흉내내라. 단, 발췌 본문을 그대로 베끼지 말고 톤만 흡수.",
        "",
        f"· 검색 쿼리: {hints['query'][:120]}",
        f"· 평균 청크 길이: {hints['avg_chunk_chars']}자  (즉, 한 슬라이드 본문은 ~{hints['avg_chunk_chars']}자가 자연스러운 분량)",
    ]
    if hints["visual_top"]:
        vt = ", ".join(f"{lbl}({cnt})" for lbl, cnt in hints["visual_top"])
        lines.append(f"· 즐겨 쓰는 시각화: {vt}")
    if hints["ending_top"]:
        et = ", ".join(f"{lbl}({cnt})" for lbl, cnt in hints["ending_top"])
        lines.append(f"· 즐겨 쓰는 명사형 어미: {et} → 거버닝/소제목 끝맺음에 적극 활용")
    if hints["sample_section_hints"]:
        sh = " / ".join(hints["sample_section_hints"][:5])
        lines.append(f"· 자주 등장한 소제목 패턴: {sh}")
    if hints["sample_excerpts"]:
        lines.append("")
        lines.append("· 톤 발췌 (참고용 — 베끼지 말고 톤만 흡수):")
        for ex in hints["sample_excerpts"]:
            lines.append(f"   – ({ex['filename']} p{ex['pages']}, sim={ex['cos_sim']}) {ex['preview']}")
    lines.append("")
    lines.append("→ 위 신호를 우리 제안서 본문/소제목/거버닝 메시지에 자연스럽게 반영. "
                 "단 [레퍼런스 스타일 가이드] 블록이 있으면 그쪽이 우선.")
    return "\n".join(lines)
