"""
RAG 4단계: 청킹 → 임베딩 → SQLite + sqlite-vec 저장

흐름:
1) _rag_extracted/*.txt 파일들을 페이지 단위로 읽고
2) 400~600 자 청크로 묶기 (페이지 작으면 합치고 / 크면 분할)
3) 각 청크에 메타데이터 부여 (filename, pages, section_hints, visual_hits, ending_hits)
4) OpenAI text-embedding-3-large 로 임베딩 (3072 dim)
5) SQLite + sqlite-vec 에 저장 (rag_kb.db)

산출물:
- rag_kb.db          (SQLite + vec0 가상테이블 / chunks 테이블)
- _rag_chunks.json   (청크 디버그용 / 임베딩 전 단계)
- _rag_build_report.txt
"""
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

EXTRACT_DIR = Path("_rag_extracted")
CHUNKS_JSON = Path("_rag_chunks.json")
DB_PATH = Path("rag_kb.db")
REPORT_PATH = Path("_rag_build_report.txt")

# 청킹 파라미터
TARGET_MIN = 400
TARGET_MAX = 600
TARGET_HARD_MAX = 900   # 한 페이지가 너무 크면 분할

EMBED_MODEL = "text-embedding-3-large"
EMBED_DIM = 3072
BATCH_SIZE = 64   # OpenAI 임베딩 배치


# ─── 메타데이터 추출용 정규식 (rag_style.py 와 같은 키워드) ───
ENDING_PATTERNS = {
    "전략": r"\S{2,}\s*전략\b",
    "시스템": r"\S{2,}\s*시스템\b",
    "체계": r"\S{2,}\s*체계\b",
    "방안": r"\S{2,}\s*방안\b",
    "플랫폼": r"\S{2,}\s*플랫폼\b",
    "경험": r"\S{2,}\s*경험\b",
    "설계": r"\S{2,}\s*설계\b",
    "프로세스": r"\S{2,}\s*프로세스\b",
    "매뉴얼": r"\S{2,}\s*매뉴얼\b",
    "구조": r"\S{2,}\s*구조\b",
}

VISUAL_PATTERNS = {
    "step_flow":   r"\bSTEP\s*\d+\b|\d+단계\b|단계\s*\d+",
    "timeline":    r"\b(타임라인|TIME\s*LINE|로드맵|D-?\d+|D[+]\d+)\b",
    "table":       r"\b(구분|항목|세부내용|비고)\s*[:│|]",
    "comparison":  r"\b(AS[\s-]?IS|TO[\s-]?BE|Before|After|비교|대비)\b",
    "org":         r"\b(조직도|총괄|PM|디렉터|운영진|인력\s*구성)\b",
    "budget":      r"\b(예산|산출\s*내역|단가|총\s*사업비|VAT)\b",
    "safety":      r"\b(안전\s*관리|비상\s*매뉴얼|위기\s*대응|보험|응급)\b",
    "stat_emph":   r"\d+\.?\d*\s*%|\b\d{2,}\s*(?:점|건|개|곳|명|회|일|개월|년)\b",
    "bullet":      r"^\s*[●◆■◇○•\-\*✓☑]\s+",
    "arrow":       r"→|⇒|⇨",
}

SECTION_NAME_RE = re.compile(
    r"(?:Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ|Ⅷ|Ⅸ|Ⅹ|\d{1,2}|[가나다라마바사아])\s*[\.\)]\s*([가-힣A-Za-z][^\n]{1,30})"
)


def extract_meta(text: str) -> dict:
    """청크 텍스트에서 메타데이터 추출."""
    meta = {
        "ending_hits": [],
        "visual_hits": [],
        "section_hints": [],
        "char_count": len(text),
    }
    for label, pat in ENDING_PATTERNS.items():
        if re.search(pat, text):
            meta["ending_hits"].append(label)
    for label, pat in VISUAL_PATTERNS.items():
        flags = re.M if "^" in pat else 0
        if re.search(pat, text, flags=flags):
            meta["visual_hits"].append(label)
    # 섹션명 후보 (앞부분에서)
    for m in SECTION_NAME_RE.finditer(text[:600]):
        name = m.group(0).strip()
        if 3 < len(name) < 40 and name not in meta["section_hints"]:
            meta["section_hints"].append(name)
        if len(meta["section_hints"]) >= 3:
            break
    return meta


def split_long_text(text: str, max_chars: int = TARGET_HARD_MAX) -> list[str]:
    """긴 페이지를 문장 단위로 자르되 max_chars 안에 맞춤."""
    if len(text) <= max_chars:
        return [text]
    parts = []
    buf = ""
    # 한국어 문장 단위 분리
    sentences = re.split(r"(?<=[.!?…])\s+|\n{2,}", text)
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(buf) + len(s) + 1 <= max_chars:
            buf = (buf + " " + s) if buf else s
        else:
            if buf:
                parts.append(buf)
            # 한 문장이 max_chars 초과 시 강제 분할
            if len(s) > max_chars:
                for i in range(0, len(s), max_chars):
                    parts.append(s[i:i + max_chars])
                buf = ""
            else:
                buf = s
    if buf:
        parts.append(buf)
    return parts


def chunk_file(filepath: Path) -> list[dict]:
    """추출된 텍스트 파일 → 청크 리스트."""
    raw = filepath.read_text(encoding="utf-8")

    # 페이지 분리
    page_re = re.compile(r"=====\s*PAGE\s+(\d+)\s*=====")
    parts = page_re.split(raw)
    # parts[0] 은 헤더 (메타라인) — 버림
    pages = []
    for i in range(1, len(parts), 2):
        page_num = int(parts[i])
        text = parts[i + 1].strip() if i + 1 < len(parts) else ""
        # NOTES 분리 — 본문에서 제외 (학습 대상 X)
        text = re.sub(r"\[NOTES\][\s\S]*?(?=\n=====|\Z)", "", text).strip()
        if text:
            pages.append({"page": page_num, "text": text})

    # 청킹: 작은 페이지는 합치고 / 큰 페이지는 분할
    chunks = []
    buf_pages = []
    buf_text = ""
    chunk_idx = 0

    def flush():
        nonlocal buf_text, buf_pages, chunk_idx
        if buf_text.strip():
            chunks.append({
                "chunk_id": f"{filepath.stem}__{chunk_idx:04d}",
                "filename": filepath.stem,
                "pages": buf_pages.copy(),
                "text": buf_text.strip(),
                "char_count": len(buf_text.strip()),
            })
            chunk_idx += 1
        buf_pages.clear()
        buf_text = ""

    for p in pages:
        ptext = p["text"]
        # 한 페이지가 hard max 넘으면 분할
        if len(ptext) > TARGET_HARD_MAX:
            # 먼저 버퍼 flush
            if buf_text:
                flush()
            for sub in split_long_text(ptext, TARGET_HARD_MAX):
                chunks.append({
                    "chunk_id": f"{filepath.stem}__{chunk_idx:04d}",
                    "filename": filepath.stem,
                    "pages": [p["page"]],
                    "text": sub.strip(),
                    "char_count": len(sub.strip()),
                })
                chunk_idx += 1
            continue
        # 누적 시 max 초과면 flush
        if buf_text and len(buf_text) + len(ptext) + 2 > TARGET_MAX:
            flush()
        buf_text = (buf_text + "\n\n" + ptext).strip() if buf_text else ptext
        buf_pages.append(p["page"])
        # min 도달 + 다음 페이지 합치면 max 넘는다 → flush
        if len(buf_text) >= TARGET_MIN:
            flush()
    if buf_text:
        flush()

    # 메타데이터 부여
    for c in chunks:
        c.update(extract_meta(c["text"]))
    return chunks


def setup_db():
    """SQLite + sqlite-vec 가상 테이블 + chunks 메타 테이블 초기화."""
    if DB_PATH.exists():
        DB_PATH.unlink()
    db = sqlite3.connect(str(DB_PATH))
    db.enable_load_extension(True)
    import sqlite_vec
    sqlite_vec.load(db)
    db.enable_load_extension(False)

    # 메타 테이블
    db.executescript(f"""
        CREATE TABLE chunks (
            rowid       INTEGER PRIMARY KEY,
            chunk_id    TEXT UNIQUE NOT NULL,
            filename    TEXT NOT NULL,
            pages       TEXT NOT NULL,           -- JSON 배열
            text        TEXT NOT NULL,
            char_count  INTEGER NOT NULL,
            ending_hits TEXT DEFAULT '[]',       -- JSON 배열
            visual_hits TEXT DEFAULT '[]',       -- JSON 배열
            section_hints TEXT DEFAULT '[]',     -- JSON 배열
            embedded    INTEGER DEFAULT 0
        );
        CREATE INDEX idx_chunks_filename ON chunks(filename);

        CREATE VIRTUAL TABLE vec_chunks USING vec0(
            embedding float[{EMBED_DIM}]
        );
    """)
    db.commit()
    return db


def main():
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("❌ OPENAI_API_KEY 환경변수가 비어있어요.")
        sys.exit(1)

    files = sorted(EXTRACT_DIR.glob("*.txt"))
    if not files:
        print("❌ _rag_extracted/ 가 비어있어요. rag_extract.py 먼저 실행하세요.")
        sys.exit(1)

    print(f"=== 4단계: 청킹 + 임베딩 + DB 저장 ===")
    print(f"  대상 파일: {len(files)}개")
    print(f"  임베딩 모델: {EMBED_MODEL} ({EMBED_DIM} dim)")
    print(f"  청크 길이: {TARGET_MIN}~{TARGET_MAX} 자")
    print()

    # 1) 청킹
    all_chunks = []
    for f in files:
        cks = chunk_file(f)
        all_chunks.extend(cks)
        print(f"  [chunk] {f.stem[:60]} -> {len(cks)} chunks")

    print(f"\n총 청크: {len(all_chunks)}개")
    avg_len = sum(c["char_count"] for c in all_chunks) / len(all_chunks)
    print(f"평균 청크 길이: {avg_len:.0f}자")

    # 디버그용 JSON
    CHUNKS_JSON.write_text(
        json.dumps(all_chunks, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"청크 JSON 저장: {CHUNKS_JSON}")

    # 2) 임베딩
    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    print(f"\n=== 임베딩 시작 ({EMBED_MODEL}) ===")
    embeddings = []
    t0 = time.time()
    for i in range(0, len(all_chunks), BATCH_SIZE):
        batch = all_chunks[i:i + BATCH_SIZE]
        texts = [c["text"] for c in batch]
        try:
            resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
            for j, item in enumerate(resp.data):
                embeddings.append(item.embedding)
            elapsed = time.time() - t0
            print(f"  [{i + len(batch):4d}/{len(all_chunks)}] 진행 ({elapsed:.1f}s)")
        except Exception as e:
            print(f"  ❌ 배치 {i} 실패: {e}")
            for _ in batch:
                embeddings.append(None)

    valid = [e for e in embeddings if e is not None]
    print(f"\n임베딩 성공: {len(valid)}/{len(all_chunks)} (실패 {len(all_chunks)-len(valid)})")

    # 3) DB 저장
    print(f"\n=== DB 저장 (sqlite-vec) ===")
    db = setup_db()
    inserted = 0
    skipped = 0
    import struct
    for chunk, emb in zip(all_chunks, embeddings):
        if emb is None:
            skipped += 1
            continue
        cur = db.execute(
            """INSERT INTO chunks(chunk_id,filename,pages,text,char_count,
                                  ending_hits,visual_hits,section_hints,embedded)
               VALUES(?,?,?,?,?,?,?,?,1)""",
            (chunk["chunk_id"], chunk["filename"], json.dumps(chunk["pages"]),
             chunk["text"], chunk["char_count"],
             json.dumps(chunk.get("ending_hits", []), ensure_ascii=False),
             json.dumps(chunk.get("visual_hits", []), ensure_ascii=False),
             json.dumps(chunk.get("section_hints", []), ensure_ascii=False)),
        )
        rid = cur.lastrowid
        # vec0 에는 float[3072] 바이너리로 저장
        emb_bytes = struct.pack(f"{EMBED_DIM}f", *emb)
        db.execute("INSERT INTO vec_chunks(rowid, embedding) VALUES(?, ?)", (rid, emb_bytes))
        inserted += 1
    db.commit()
    db.close()

    print(f"  DB 저장 완료: {DB_PATH} ({DB_PATH.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"  청크: {inserted} 건 / 스킵 {skipped} 건")

    # 4) 보고서
    files_per_chunks = {}
    for c in all_chunks:
        files_per_chunks.setdefault(c["filename"], 0)
        files_per_chunks[c["filename"]] += 1
    lines = [
        f"RAG 4단계 빌드 리포트",
        "=" * 60,
        f"임베딩 모델   : {EMBED_MODEL} ({EMBED_DIM} dim)",
        f"전체 청크 수   : {len(all_chunks)}",
        f"임베딩 성공    : {len(valid)} / {len(all_chunks)}",
        f"DB 저장 완료   : {inserted} 건  (skipped: {skipped})",
        f"DB 파일        : {DB_PATH} ({DB_PATH.stat().st_size / 1024 / 1024:.1f} MB)",
        f"평균 청크 길이 : {avg_len:.0f} 자",
        "",
        "파일별 청크 수:",
    ]
    for fn, cnt in sorted(files_per_chunks.items(), key=lambda x: -x[1]):
        lines.append(f"  {cnt:3d}  {fn}")
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n  보고서: {REPORT_PATH}")
    print(f"\n=== 4단계 완료 ===")


if __name__ == "__main__":
    main()
