"""
RAG 5단계: 검색 검증
- 쿼리 텍스트 → text-embedding-3-large 임베딩
- sqlite-vec 의 vec_chunks 에서 코사인 거리로 top-K 검색
- chunks 메타와 join 해서 출력
"""
import json
import os
import sqlite3
import struct
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

DB_PATH = Path("rag_kb.db")
EMBED_MODEL = "text-embedding-3-large"
EMBED_DIM = 3072


def open_db():
    db = sqlite3.connect(str(DB_PATH))
    db.enable_load_extension(True)
    import sqlite_vec
    sqlite_vec.load(db)
    db.enable_load_extension(False)
    return db


def embed_query(client, text: str) -> bytes:
    resp = client.embeddings.create(model=EMBED_MODEL, input=[text])
    emb = resp.data[0].embedding
    return struct.pack(f"{EMBED_DIM}f", *emb)


def search(db, qbytes: bytes, k: int = 5) -> list[dict]:
    """sqlite-vec KNN — distance 작을수록 가까움."""
    rows = db.execute(
        """
        SELECT v.rowid, v.distance,
               c.chunk_id, c.filename, c.pages, c.text,
               c.ending_hits, c.visual_hits, c.section_hints, c.char_count
        FROM vec_chunks v
        JOIN chunks c ON c.rowid = v.rowid
        WHERE v.embedding MATCH ?
          AND k = ?
        ORDER BY v.distance
        """,
        (qbytes, k),
    ).fetchall()
    out = []
    for r in rows:
        rid, dist, chunk_id, filename, pages, text, eh, vh, sh, cc = r
        # vec0 의 distance 는 L2(유클리드) 가 기본 — 코사인 유사도로 변환은 별도지만
        # OpenAI 임베딩은 unit-norm 이므로 L2² = 2(1 - cos), cos ≈ 1 - L2²/2
        cos_sim = 1.0 - (dist * dist) / 2.0
        out.append({
            "chunk_id": chunk_id,
            "filename": filename,
            "pages": json.loads(pages),
            "text": text,
            "char_count": cc,
            "ending_hits": json.loads(eh),
            "visual_hits": json.loads(vh),
            "section_hints": json.loads(sh),
            "distance": dist,
            "cos_sim": cos_sim,
        })
    return out


def main():
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("❌ OPENAI_API_KEY 환경변수가 필요해요.")
        sys.exit(1)
    if not DB_PATH.exists():
        print("❌ rag_kb.db 가 없어요. rag_build.py 먼저 실행하세요.")
        sys.exit(1)

    queries = [
        "체험형 부스 운영 방안",
        "안전 관리 매뉴얼",
        "홍보 전략 수립",
        "행사 추진 일정",
        "운영 인력 조직도",
        "예산 집행 계획",
        "사업 추진 배경",
        "성과 측정 지표",
    ]

    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    db = open_db()

    report = []
    report.append("RAG 5단계 검색 검증 리포트")
    report.append("=" * 70)
    report.append("")

    for q in queries:
        print(f"\n=== Q: {q} ===")
        qb = embed_query(client, q)
        results = search(db, qb, k=5)
        report.append(f"## Q: {q}")
        for i, r in enumerate(results, 1):
            preview = r["text"][:90].replace("\n", " ")
            line = (
                f"  [{i}] cos={r['cos_sim']:.3f} "
                f"({r['filename'][:30]} p{r['pages']}) "
                f"V={','.join(r['visual_hits'][:3]) or '-'} "
                f"E={','.join(r['ending_hits'][:3]) or '-'}"
            )
            print(line)
            print(f"      → {preview}")
            report.append(line)
            report.append(f"      → {preview}")
        report.append("")

    Path("_rag_search_report.txt").write_text("\n".join(report), encoding="utf-8")
    print(f"\n=== 리포트: _rag_search_report.txt ===")


if __name__ == "__main__":
    main()
