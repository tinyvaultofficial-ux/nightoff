#!/usr/bin/env python3
"""Sanitize 후 embedded=0 인 chunks 만 재임베딩.

기존 vec_chunks rowid 의 embedding 을 DELETE + INSERT 로 갱신.
완료 시 embedded=1 마킹.

사용:
  python3 reembed_sanitized.py             # dry-run (개수만)
  python3 reembed_sanitized.py --apply     # 실제 호출 + DB 갱신
"""
import sqlite3, sys, time, struct, os
from pathlib import Path

DB_PATH = Path("rag_kb.db")
EMBED_MODEL = "text-embedding-3-large"
EMBED_DIM = 3072
BATCH_SIZE = 50  # rag_build.py 는 64. 안전하게 50.


def main():
    apply_mode = "--apply" in sys.argv

    if not DB_PATH.exists():
        print(f"ERROR: {DB_PATH} not found")
        sys.exit(1)

    db = sqlite3.connect(str(DB_PATH))
    db.enable_load_extension(True)
    try:
        import sqlite_vec
        sqlite_vec.load(db)
    except Exception as e:
        print(f"ERROR: sqlite_vec load failed: {e}")
        sys.exit(1)
    db.enable_load_extension(False)
    db.row_factory = sqlite3.Row

    # 대상 chunks (embedded=0)
    rows = db.execute("SELECT rowid, chunk_id, text FROM chunks WHERE embedded=0 ORDER BY rowid").fetchall()
    n = len(rows)
    print(f"=== Re-embed {'APPLY' if apply_mode else 'DRY-RUN'} ===")
    print(f"  target chunks (embedded=0): {n}")
    if n == 0:
        print("  nothing to do.")
        return

    # 비용 추정 — text-embedding-3-large = $0.13 / 1M tokens
    avg_chars = sum(len(r["text"]) for r in rows) / n
    est_tokens = sum(len(r["text"]) for r in rows) // 3  # rough KO ratio
    est_cost = est_tokens * 0.13 / 1_000_000
    print(f"  avg text len: {avg_chars:.0f} chars")
    print(f"  est tokens: ~{est_tokens:,}")
    print(f"  est cost: ~${est_cost:.4f}")

    if not apply_mode:
        print("  [DRY-RUN] no API call. use --apply to execute.")
        return

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("ERROR: OPENAI_API_KEY env var not set")
        sys.exit(1)

    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    print(f"\n  calling {EMBED_MODEL} ({EMBED_DIM} dim) ...")
    t0 = time.time()
    succeeded = 0
    failed = 0
    for i in range(0, n, BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        texts = [r["text"] for r in batch]
        try:
            resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
            for j, item in enumerate(resp.data):
                rid = batch[j]["rowid"]
                emb_bytes = struct.pack(f"{EMBED_DIM}f", *item.embedding)
                # vec0 update via DELETE + INSERT (rowid match)
                db.execute("DELETE FROM vec_chunks WHERE rowid=?", (rid,))
                db.execute("INSERT INTO vec_chunks(rowid, embedding) VALUES(?, ?)", (rid, emb_bytes))
                db.execute("UPDATE chunks SET embedded=1 WHERE rowid=?", (rid,))
                succeeded += 1
            db.commit()
            elapsed = time.time() - t0
            print(f"  [{i + len(batch):4d}/{n}] ok ({elapsed:.1f}s)")
        except Exception as e:
            print(f"  batch {i} failed: {str(e)[:120]}")
            failed += len(batch)

    print(f"\n  succeeded: {succeeded}, failed: {failed}")
    print(f"  elapsed: {time.time() - t0:.1f}s")

    # 검증
    emb1 = db.execute("SELECT COUNT(*) FROM chunks WHERE embedded=1").fetchone()[0]
    emb0 = db.execute("SELECT COUNT(*) FROM chunks WHERE embedded=0").fetchone()[0]
    print(f"  post-state: embedded=1: {emb1}, embedded=0: {emb0}")


if __name__ == "__main__":
    main()
