"""RAG v2 — 본문 풍부 발췌 검증.

OPENAI_API_KEY 가 환경에 있어야 동작.
없으면 'OpenAI 클라이언트 생성 실패' 로 자연 스킵.
"""
import sys, os
sys.path.insert(0, ".")

import rag_retriever as rr

print("=" * 70)
print("RAG v2 검증 — 본문 풍부 발췌가 실제로 나오는지")
print("=" * 70)

print(f"\n· DB 경로: {rr.DB_PATH} (exists={rr.DB_PATH.exists()})")
print(f"· OPENAI_API_KEY 환경: {'있음' if os.environ.get('OPENAI_API_KEY') else '없음'}")
print(f"· rr.is_available(): {rr.is_available()}")

if not rr.is_available():
    print("\n[skip] is_available()=False — 키 없거나 DB 없음")
    sys.exit(0)

# 가짜 RFP 분석 (festival 도메인)
fake_rfp = {
    "title": "2026 부산 청년 페스티벌 운영 위탁",
    "project_domain_label": "축제·행사",
    "target_audience": "20~30대 청년, 가족 단위 관람객",
    "key_requirements": [
        "안전 매뉴얼 기상 단계별 대응",
        "홍보 D-90 ~ D+30 통합 로드맵",
        "부스 운영 30개 이상 + 동선 분리",
    ],
    "evaluation_criteria": [
        {"item": "운영 전문성", "weight": "30점"},
        {"item": "홍보 계획", "weight": "20점"},
    ],
}

query = rr.build_query_from_rfp(fake_rfp)
print(f"\n· build_query_from_rfp(): {query!r}")

print("\n--- retrieve_style_hints (top_k=12, excerpt_chars=800, excerpt_count=8) ---")
hints = rr.retrieve_style_hints(query, top_k=12, excerpt_chars=800, excerpt_count=8)
if not hints:
    print("[fail] hints=None")
    sys.exit(1)

print(f"  hits_count: {hints['hits_count']}")
print(f"  avg_chunk_chars: {hints['avg_chunk_chars']}")
print(f"  visual_top: {hints['visual_top']}")
print(f"  ending_top: {hints['ending_top']}")
print(f"  sample_excerpts 개수: {len(hints['sample_excerpts'])}")
print(f"  발췌 1번 길이: {len(hints['sample_excerpts'][0]['preview']) if hints['sample_excerpts'] else 0}자")

print("\n--- format_hints_for_prompt 실제 출력 (앞 4000자) ---")
block = rr.format_hints_for_prompt(hints)
print(f"  전체 길이: {len(block)}자")
print(block[:4000])
print("..." if len(block) > 4000 else "")

# 핵심 검증
print("\n=" * 35)
print("=== 검증 ===")
print("=" * 70)

assert hints["hits_count"] >= 1, "hits 없음"
assert len(hints["sample_excerpts"]) >= 1, "발췌 없음"

# 발췌 길이가 v1 (120자) 보다 훨씬 길어야 함
ex1_len = len(hints["sample_excerpts"][0]["preview"])
print(f"  발췌 1번 길이 {ex1_len}자  (v1 은 120자, v2 는 600+자 이상)")
assert ex1_len > 200, f"발췌가 너무 짧음 ({ex1_len}자) — v1 코드가 그대로 동작 중"

# 시스템 프롬프트 블록에 강제 문구 들어갔는지
assert "발췌" in block, "format_hints 에 '발췌' 단어 없음"
assert "★★★ 강제 준수 사항 ★★★" in block, "강제 문구 없음"
assert "베끼지 말고 톤만 흡수" not in block, "이전 'v1 약화 문구' 가 아직 남아있음"

print("  OK · 발췌 길이 v1 대비 대폭 확장")
print("  OK · '강제 준수 사항' 들어감")
print("  OK · 'v1 약화 문구' 제거됨")

print("\n전체 PASS — 새 제안서 생성 시 RAG 본문이 풍부하게 시스템 프롬프트에 inline 됨.")
