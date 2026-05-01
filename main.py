"""
NightOff - 제안서 작성 전문가를 위한 AI 어시스턴트
FastAPI + SQLite + Anthropic Claude (streaming)
"""
from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
import traceback
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Generator, Optional

import anthropic
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# RAG (선택적) — rag_kb.db + OPENAI_API_KEY 가 있을 때만 동작
try:
    import rag_retriever  # type: ignore
except Exception as _rag_imp_err:  # pragma: no cover
    rag_retriever = None  # type: ignore

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("nightoff")

# Max file size for uploads (50MB)
MAX_UPLOAD_SIZE = 50 * 1024 * 1024
ALLOWED_UPLOAD_EXTS = {".pdf", ".doc", ".docx", ".txt", ".md", ".hwp", ".hwpx"}

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "proposal.db"
UPLOADS_DIR = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

MODEL_DEFAULT = "claude-sonnet-4-5-20250929"
MODEL_FAST = "claude-haiku-4-5-20251001"


# ---------------------------------------------------------------------------
# DB helpers — SQLite(로컬) / PostgreSQL(운영) 자동 스위치
# DATABASE_URL 이 설정돼 있으면 PostgreSQL, 없으면 로컬 SQLite 파일 사용
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
USE_PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))

if USE_PG:
    import psycopg
    from psycopg.rows import dict_row
    # Railway 구형 스킴 'postgres://' → psycopg 3도 허용하지만 명시적으로 정규화
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]


def _adapt_sql(sql: str) -> str:
    """SQLite → PostgreSQL SQL 변환. 로컬 모드면 그대로 반환."""
    if not USE_PG:
        return sql
    # PRAGMA 제거 (PG 미지원)
    sql = re.sub(r"PRAGMA [^;]+;", "", sql, flags=re.IGNORECASE)
    # datetime('now','localtime') → KST 시각 텍스트
    dt_repl = "TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')"
    sql = re.sub(r"datetime\(\s*'now'\s*,\s*'localtime'\s*\)", dt_repl, sql, flags=re.IGNORECASE)
    # ? 플레이스홀더 → %s (이 프로젝트 쿼리는 문자열 안에 ? 미사용, 안전)
    sql = sql.replace("?", "%s")
    # CHECK 제약 (id = 1) 같은 것도 PG에서 동작하므로 그대로 둠
    return sql


def _split_sql(script: str):
    """세미콜론으로 다중 구문 분리 (단순 분리 — 우리 DDL은 문자열 리터럴에 ; 없음)"""
    for stmt in script.split(";"):
        s = stmt.strip()
        if s:
            yield s


class _PgConnWrapper:
    """sqlite3.Connection 인터페이스를 흉내내는 얇은 어댑터 (psycopg 3)."""
    def __init__(self, conn):
        self.conn = conn
    def execute(self, sql, params=()):
        cur = self.conn.cursor()
        cur.execute(_adapt_sql(sql), params)
        return cur  # psycopg 커서는 fetchone/fetchall/rowcount 지원
    def executescript(self, script):
        cur = self.conn.cursor()
        for stmt in _split_sql(_adapt_sql(script)):
            cur.execute(stmt)
    def commit(self):
        self.conn.commit()
    def rollback(self):
        self.conn.rollback()
    def close(self):
        self.conn.close()


@contextmanager
def get_db():
    if USE_PG:
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        wrapper = _PgConnWrapper(conn)
        try:
            yield wrapper
            wrapper.commit()
        except Exception:
            wrapper.rollback()
            raise
        finally:
            wrapper.close()
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        # ⚠ SQLite 는 기본값으로 외래키를 강제하지 않음 — CASCADE 가 동작하려면
        # 매 connection 마다 PRAGMA 를 켜줘야 함.
        conn.execute("PRAGMA foreign_keys = ON")
        # 약간의 성능 — WAL 모드 + 적당한 캐시 (성능 최적화)
        try:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            conn.execute("PRAGMA cache_size = -8000")  # ~8MB
        except sqlite3.OperationalError:
            pass
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def init_db() -> None:
    with get_db() as db:
        db.executescript("""
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS clients (
                id           TEXT PRIMARY KEY,
                name         TEXT NOT NULL,
                industry     TEXT DEFAULT '',
                manager      TEXT DEFAULT '',
                memo         TEXT DEFAULT '',
                created_at   TEXT DEFAULT (datetime('now','localtime')),
                updated_at   TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id         TEXT PRIMARY KEY,
                client_id  TEXT NOT NULL,
                title      TEXT DEFAULT '새 대화',
                ended      INTEGER DEFAULT 0,
                outcome    TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now','localtime')),
                updated_at TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS messages (
                id              TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role            TEXT NOT NULL,
                content         TEXT,
                created_at      TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS nuance_memories (
                id         TEXT PRIMARY KEY,
                client_id  TEXT NOT NULL,
                category   TEXT DEFAULT '맥락',
                content    TEXT NOT NULL,
                tags       TEXT DEFAULT '[]',
                created_at TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS references_lib (
                id           TEXT PRIMARY KEY,
                client_id    TEXT NOT NULL,
                filename     TEXT NOT NULL,
                filepath     TEXT NOT NULL,
                filetype     TEXT DEFAULT '',
                filesize     INTEGER DEFAULT 0,
                summary      TEXT DEFAULT '',
                created_at   TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS rfp_docs (
                id             TEXT PRIMARY KEY,
                client_id      TEXT NOT NULL UNIQUE,
                filename       TEXT NOT NULL,
                filepath       TEXT NOT NULL,
                raw_text       TEXT DEFAULT '',
                analysis_json  TEXT DEFAULT '{}',
                created_at     TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            -- 다중 RFP 파일 (과업지시서 / 제안요청서 / 기타 역할별)
            CREATE TABLE IF NOT EXISTS rfp_files (
                id             TEXT PRIMARY KEY,
                client_id      TEXT NOT NULL,
                filename       TEXT NOT NULL,
                filepath       TEXT NOT NULL,
                role           TEXT DEFAULT '기타',
                raw_text       TEXT DEFAULT '',
                created_at     TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_rfpf_client ON rfp_files(client_id);

            -- 통합 분석 결과 캐시
            CREATE TABLE IF NOT EXISTS rfp_aggregated (
                client_id      TEXT PRIMARY KEY,
                analysis_json  TEXT DEFAULT '{}',
                updated_at     TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            -- 발주처 성향 (RFP + 대화에서 추출된 인사이트 축적)
            CREATE TABLE IF NOT EXISTS client_profiles (
                client_id        TEXT PRIMARY KEY,
                keywords         TEXT DEFAULT '[]',
                high_weight_items TEXT DEFAULT '[]',
                recurring_reqs   TEXT DEFAULT '[]',
                insights         TEXT DEFAULT '[]',
                sample_count     INTEGER DEFAULT 0,
                updated_at       TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            -- 우리 회사 DNA (글로벌, 단일 레코드)
            CREATE TABLE IF NOT EXISTS company_dna (
                id                INTEGER PRIMARY KEY CHECK (id = 1),
                signature_phrases TEXT DEFAULT '[]',
                strength_keywords TEXT DEFAULT '[]',
                strategy_patterns TEXT DEFAULT '[]',
                tone_style        TEXT DEFAULT '',
                sample_count      INTEGER DEFAULT 0,
                updated_at        TEXT DEFAULT (datetime('now','localtime'))
            );

            -- 이메일 기반 간편 가입 (비밀번호 없음)
            CREATE TABLE IF NOT EXISTS users (
                id          TEXT PRIMARY KEY,
                email       TEXT UNIQUE NOT NULL,
                company     TEXT DEFAULT '',
                last_login  TEXT,
                created_at  TEXT DEFAULT (datetime('now','localtime'))
            );

            -- 발주처별 우리 회사 강점 (RFP 과업 성격에 맞춰 사용자가 선택)
            CREATE TABLE IF NOT EXISTS client_strengths (
                client_id    TEXT PRIMARY KEY,
                category     TEXT NOT NULL DEFAULT '',
                capabilities TEXT NOT NULL DEFAULT '[]',
                updated_at   TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            -- 발주처 들여다보기 — RFP 업로드 시 자동 수집된 발주처 기본정보/이력/성향
            CREATE TABLE IF NOT EXISTS client_intel (
                client_id     TEXT PRIMARY KEY,
                intel_json    TEXT DEFAULT '{}',
                updated_at    TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_conv_client ON conversations(client_id);
            CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_nuance_client ON nuance_memories(client_id);
            CREATE INDEX IF NOT EXISTS idx_ref_client ON references_lib(client_id);

            -- 성능 인덱스 (item 10) — 자주 쓰는 정렬/필터 가속
            CREATE INDEX IF NOT EXISTS idx_msg_conv_created ON messages(conversation_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_conv_outcome    ON conversations(outcome);
            CREATE INDEX IF NOT EXISTS idx_conv_updated    ON conversations(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_msg_created     ON messages(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_clients_updated ON clients(updated_at DESC);
        """)

        # 구버전 competitors 테이블 흔적 제거 (있으면)
        try:
            db.execute("DROP TABLE IF EXISTS competitors")
        except Exception as e:
            log.warning("competitors drop 스킵: %s", e)
        # 구버전 our_strengths (전사 단위) 테이블 제거 — 발주처별로 옮겼음
        try:
            db.execute("DROP TABLE IF EXISTS our_strengths")
        except Exception as e:
            log.warning("our_strengths drop 스킵: %s", e)

        # 컬럼 자동 마이그레이션은 init_db 끝나고 _migrate_db() 가 일괄 처리.

        # One-time migration: 기존 rfp_docs → rfp_files (role=제안요청서)
        # 고아 레코드(client 삭제됨)는 건너뜀
        try:
            old_rows = db.execute("SELECT * FROM rfp_docs").fetchall()
            for r in old_rows:
                client_exists = db.execute("SELECT id FROM clients WHERE id=?", (r["client_id"],)).fetchone()
                if not client_exists:
                    continue
                exists = db.execute("SELECT id FROM rfp_files WHERE id=?", (r["id"],)).fetchone()
                if exists:
                    continue
                try:
                    db.execute(
                        "INSERT INTO rfp_files(id,client_id,filename,filepath,role,raw_text,created_at) "
                        "VALUES(?,?,?,?,?,?,?)",
                        (r["id"], r["client_id"], r["filename"], r["filepath"],
                         "제안요청서", r["raw_text"], r["created_at"]),
                    )
                    agg = db.execute("SELECT client_id FROM rfp_aggregated WHERE client_id=?", (r["client_id"],)).fetchone()
                    if not agg:
                        db.execute(
                            "INSERT INTO rfp_aggregated(client_id,analysis_json) VALUES(?,?)",
                            (r["client_id"], r["analysis_json"] or "{}"),
                        )
                except sqlite3.IntegrityError:
                    log.warning("마이그레이션 스킵 (FK): rfp_docs row %s", r["id"])
                    continue
        except sqlite3.OperationalError:
            pass


# ── 누락된 컬럼 자동 추가 (멱등) — SQLite + PostgreSQL 양쪽 동작 ─────
# CREATE TABLE IF NOT EXISTS 만으로는 기존 테이블에 컬럼 추가 못 하므로
# 새 컬럼이 추가될 때마다 여기에 한 줄씩 등록하면 운영 DB 자동 마이그레이션.
COLUMN_MIGRATIONS: list[tuple[str, str, str]] = [
    # (table, column, ddl_type_with_default)
    ("conversations", "outcome",          "TEXT DEFAULT ''"),
    ("conversations", "pptx_path",        "TEXT DEFAULT ''"),    # 마지막 PPTX 다운로드 경로
    ("conversations", "pptx_updated_at",  "TEXT DEFAULT ''"),    # PPTX 생성 시각
    # 발주처(공고기관) — RFP 분석에서 자동 추출. 과업명(name)과 분리.
    # 들여다보기 검색은 이 컬럼만 사용 (과업명은 검색에 영향 X)
    ("clients",       "organization",     "TEXT DEFAULT ''"),
]


def _existing_columns(db, table: str) -> set[str]:
    """SQLite 와 PostgreSQL 양쪽에서 동작하는 컬럼 목록 조회."""
    if USE_PG:
        try:
            rows = db.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name=%s",
                (table,),
            ).fetchall()
            return {r["column_name"] for r in rows}
        except Exception as e:
            log.warning("PG 컬럼 조회 실패 (%s): %s", table, e)
            return set()
    # SQLite — PRAGMA 는 _adapt_sql 영향 안 받게 raw connection 사용
    try:
        # get_db() 의 wrapper 가 _adapt_sql 적용하므로, PRAGMA 는 raw conn 으로
        raw = getattr(db, "conn", None) or db
        cur = raw.execute(f"PRAGMA table_info({table})")
        rows = cur.fetchall()
        # SQLite Row: index 1 이 name
        names: set[str] = set()
        for r in rows:
            try:
                names.add(r["name"])
            except (TypeError, IndexError, KeyError):
                try:
                    names.add(r[1])
                except Exception:
                    pass
        return names
    except Exception as e:
        log.warning("SQLite 컬럼 조회 실패 (%s): %s", table, e)
        return set()


def _migrate_db() -> dict:
    """누락된 컬럼을 ALTER TABLE 로 추가. 각 마이그레이션 개별 try/except.
    반환: {"added": [...], "skipped": [...], "failed": [...]}
    """
    added: list[str] = []
    skipped: list[str] = []
    failed: list[str] = []
    with get_db() as db:
        for table, col, ddl in COLUMN_MIGRATIONS:
            try:
                cols = _existing_columns(db, table)
                if col in cols:
                    skipped.append(f"{table}.{col} (이미 존재)")
                    continue
                db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")
                added.append(f"{table}.{col}")
                log.info("마이그레이션 성공: %s.%s ADD %s", table, col, ddl)
            except Exception as e:
                msg = str(e).lower()
                # 이미 존재한다는 류의 에러는 정상 — skipped 로 분류
                if "already exists" in msg or "duplicate column" in msg:
                    skipped.append(f"{table}.{col} (이미 존재)")
                else:
                    failed.append(f"{table}.{col}: {str(e)[:120]}")
                    log.exception("마이그레이션 실패: %s.%s", table, col)
    return {"added": added, "skipped": skipped, "failed": failed}


def get_setting(key: str, default: str = "") -> str:
    with get_db() as db:
        row = db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with get_db() as db:
        db.execute(
            "INSERT INTO settings(key,value) VALUES(?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )


def get_api_key() -> str:
    """Railway 등 운영 환경에서는 환경변수 ANTHROPIC_API_KEY 를 우선 사용.
    env 값이 없을 때만 DB(settings 테이블)에서 읽어온다.
    이렇게 해야 재배포/DB 초기화 시에도 키가 살아있음."""
    env_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if env_key:
        return env_key
    return get_setting("anthropic_api_key", "")


def get_api_key_source() -> str:
    """'env' / 'db' / '' 중 하나 — 현재 사용 중인 키의 출처."""
    if os.environ.get("ANTHROPIC_API_KEY", "").strip():
        return "env"
    if get_setting("anthropic_api_key", ""):
        return "db"
    return ""


def require_client() -> anthropic.Anthropic:
    key = get_api_key()
    if not key:
        raise HTTPException(status_code=400, detail="API 키가 설정되지 않았습니다. 좌하단 설정에서 등록해주세요.")
    return anthropic.Anthropic(api_key=key, timeout=60.0, max_retries=2)


def translate_anthropic_error(exc: Exception) -> str:
    """Anthropic SDK 예외를 사용자용 친절 메시지로 변환."""
    name = type(exc).__name__
    msg = str(exc) or ""
    if isinstance(exc, anthropic.AuthenticationError):
        return "API 키가 올바르지 않아요. 좌하단 설정에서 다시 확인해 주세요."
    if isinstance(exc, anthropic.RateLimitError):
        return "요청이 많아 잠시 대기가 필요해요. 1~2분 뒤 다시 시도해 주세요."
    if isinstance(exc, anthropic.APITimeoutError):
        return "AI 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요."
    if isinstance(exc, anthropic.APIConnectionError):
        return "Anthropic 서버와 연결할 수 없어요. 인터넷 연결을 확인해 주세요."
    if isinstance(exc, anthropic.BadRequestError):
        low = msg.lower()
        # 크레딧/결제 이슈 — Anthropic에서 400으로 내려옴
        if "credit balance" in low or "credit_balance" in low or "billing" in low or "insufficient" in low:
            return "Anthropic 크레딧 잔액이 부족해요. console.anthropic.com의 Plans & Billing에서 결제 수단을 확인하거나 크레딧을 충전해 주세요."
        if "organization" in low and ("disabled" in low or "suspended" in low):
            return "Anthropic 조직 계정이 비활성화 상태예요. Anthropic 콘솔에서 상태를 확인해 주세요."
        # 길이 초과 등
        if "max_tokens" in low or "too long" in low or "context" in low:
            return "요청이 너무 길어요. 대화를 나눠서 다시 시도하거나 파일을 줄여 주세요."
        if "api key" in low or "api_key" in low:
            return "API 키가 유효하지 않아요. 좌하단 설정에서 새 키로 교체해 주세요."
        # 마지막 fallback — 원본 메시지 뒷부분을 힌트로 제공
        short = msg[:120]
        return f"요청을 처리할 수 없어요. ({short})"
    if isinstance(exc, anthropic.InternalServerError):
        return "Anthropic 서버에 일시적 문제가 생겼어요. 잠시 후 다시 시도해 주세요."
    if isinstance(exc, anthropic.APIStatusError):
        return f"AI 서비스 오류: {getattr(exc, 'status_code', '')}. 잠시 후 다시 시도해 주세요."
    # fallback
    if "timeout" in msg.lower():
        return "시간이 초과되었어요. 잠시 후 다시 시도해 주세요."
    return "잠시 문제가 생겼어요. 다시 시도해 주세요."


# ---------------------------------------------------------------------------
# File text extraction
# ---------------------------------------------------------------------------
def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            pages_text = []
            for p in reader.pages:
                try:
                    t = p.extract_text() or ""
                except Exception:
                    t = ""
                pages_text.append(t)
            full = "\n\n".join(pages_text).strip()
            if not full:
                return "[PDF 본문 추출 실패 — 스캔 이미지 기반 PDF일 수 있어요. 텍스트 변환 후 다시 업로드해 주세요.]"
            return full
        if suffix == ".docx":
            from docx import Document
            doc = Document(str(path))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            if not text:
                return "[Word 문서 본문 추출 실패 — 빈 문서일 수 있어요.]"
            return text
        if suffix == ".doc":
            # python-docx는 구형 .doc 미지원 — 명확한 안내
            return "[구형 .doc 형식은 지원하지 않아요. .docx 로 저장 후 업로드해 주세요.]"
        if suffix in (".txt", ".md"):
            return path.read_text(encoding="utf-8", errors="ignore")
        if suffix in (".hwp", ".hwpx"):
            # HWP 텍스트 추출 시도 — olefile 기반, 실패 시 명확한 안내
            try:
                return _extract_hwp_text(path)
            except Exception as e:
                log.warning("HWP 추출 실패: %s", e)
                return ("[HWP 파일 텍스트 자동 추출이 지원되지 않아요. "
                        "한글 프로그램에서 PDF 또는 Word(.docx) 로 변환 후 업로드해 주세요.]")
    except Exception as e:
        log.exception("파일 텍스트 추출 실패 — %s", path)
        return f"[파일 텍스트 추출 실패: {type(e).__name__}]"
    return ""


def _extract_hwp_text(path: Path) -> str:
    """최소 HWP 텍스트 추출 — olefile 우회. 대부분 깨끗하진 않지만 키워드는 잡힘."""
    try:
        import zipfile
        # .hwpx 는 zip 기반
        if path.suffix.lower() == ".hwpx":
            with zipfile.ZipFile(path) as zf:
                texts = []
                for n in zf.namelist():
                    if n.endswith(".xml") and "/Contents/" in n.replace("\\", "/"):
                        try:
                            raw = zf.read(n).decode("utf-8", errors="ignore")
                            # XML 태그 제거
                            import re as _re
                            text = _re.sub(r"<[^>]+>", " ", raw)
                            texts.append(text)
                        except Exception:
                            continue
                joined = " ".join(texts)
                joined = re.sub(r"\s+", " ", joined).strip()
                if len(joined) > 100:
                    return joined[:40000]
    except Exception:
        pass
    return "[HWP 파일 텍스트 자동 추출이 지원되지 않아요. PDF 또는 Word(.docx) 로 변환 후 업로드해 주세요.]"


def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f}{unit}" if unit != "B" else f"{n}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


async def read_and_validate_upload(file: UploadFile, *, allowed_exts: set = None) -> bytes:
    """업로드 파일을 읽고 크기·확장자 검증. 실패 시 HTTPException."""
    if not file or not file.filename:
        raise HTTPException(400, "파일이 없어요. 파일을 선택해서 다시 업로드해 주세요.")
    suffix = Path(file.filename).suffix.lower()
    if allowed_exts and suffix not in allowed_exts:
        exts = ", ".join(sorted(allowed_exts))
        raise HTTPException(400, f"지원하지 않는 파일 형식이에요. 지원 형식: {exts}")
    try:
        content = await file.read()
    except Exception as e:
        log.exception("파일 읽기 실패")
        raise HTTPException(400, "파일을 읽는 중 문제가 생겼어요. 다시 시도해 주세요.") from e
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(400, f"파일이 너무 커요. 최대 {MAX_UPLOAD_SIZE // (1024*1024)}MB까지 업로드할 수 있어요.")
    if len(content) == 0:
        raise HTTPException(400, "빈 파일이에요. 내용이 있는 파일을 올려주세요.")
    return content


# ---------------------------------------------------------------------------
# Anthropic web_search 도구 정의 — 채팅·발주처 들여다보기에서 공통 사용
# ---------------------------------------------------------------------------
WEB_SEARCH_TOOL = {"type": "web_search_20250305", "name": "web_search", "max_uses": 5}


def _extract_text_from_resp(resp) -> str:
    """Anthropic messages.create 응답에서 text 블록만 골라 결합.
    web_search / tool_use / server_tool_use 블록이 섞여 있어도 안전하게 처리."""
    if resp is None:
        return ""
    parts: list[str] = []
    content = getattr(resp, "content", None) or []
    for b in content:
        # block 이 객체 또는 dict 둘 다 가능 — 양쪽 호환
        btype = getattr(b, "type", None) if not isinstance(b, dict) else b.get("type")
        if btype == "text":
            text = getattr(b, "text", None) if not isinstance(b, dict) else b.get("text")
            if text:
                parts.append(str(text))
    return "".join(parts).strip()


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------
PROPOSAL_SYSTEM_PROMPT = """너는 사용자의 "제안서 수주 도우미" 다.
한국 B2G 공공입찰 정성 제안서를 사용자와 함께 만든다. 친근하고 차분한 톤으로,
딱딱한 격식체 대신 자연스러운 구어체를 섞어 쓴다.

[출력 모드 — 단 하나]
사용자가 제안서 생성을 요청하면 **도형 JSON** 만 출력한다 (HTML / 마커 / 자연어 설명 X).
시스템이 이 도형 JSON 을 PPTX 로 변환한다. 도형 JSON 스키마는 본 프롬프트 하단 [도형 JSON 모드] 절에 명시.

[페이지 완결성 — 절대 원칙]
모든 시각화·문장·표·이미지는 **반드시 한 슬라이드 안에 완결**되게 기획.
- 한 슬라이드에 너무 많이 욱여넣지 말 것. 넘칠 듯하면 다음 슬라이드로 분리.
- 표·카드·리스트가 잘리거나 다음 슬라이드로 흘러넘치는 구성 금지.
- "이어서 다음 페이지 참조" 같은 흐름 금지 — 각 슬라이드는 그 자체로 완결된 메시지.

[목차 협의 흐름]
- RFP 에 목차가 명시된 경우 그 목차를 그대로 따를 것.
- RFP 에 목차가 없으면:
  1) 제안서 생성 요청을 받은 직후 AI 가 목차 초안을 먼저 제안하고,
  2) 사용자에게 "이 목차대로 진행할까요? YES / 또는 직접 수정" 을 묻는다.
  3) 사용자가 YES 또는 수정안을 주기 전까지 절대 도형 JSON 본문을 출력하지 않는다.
- 목차 설계 시:
  · RFP 의 평가기준·요구사항·목차 3중 매핑 (각 섹션이 어떤 평가항목을 어떤 요구사항으로 답하는지)
  · 배점 가중치에 비례해 페이지 배분 (예: 30점 항목 3슬라이드, 10점 항목 1슬라이드)
- 이미 이전 턴에서 사용자가 목차 승인 ("YES" / "진행해" / "이대로") 했으면 즉시 도형 JSON 생성.

[페이지 수]
- RFP 에 페이지 수 명시 → 반드시 그대로
- 명시 없으면 평가 배점 총합 / 평균 밀도 기반으로 AI 가 자율 결정 (보통 25~40 슬라이드)

[컬러 — ★ 절대 흑백 ★ 단 한 색의 액센트도 금지]
- 사용 가능 색상은 다음 6 개 흑백·회색뿐:
  · #1A1A1A (메인 검정)  · #444 (본문 다크그레이)  · #666 (소제목)
  · #999 (메타·푸터)     · #DDD (연한 구분선)       · #FFFFFF (배경·반전 텍스트)
- 컬러 (오렌지·블루·레드·그린·골드 등) 절대 사용 금지 — 단 1 개 hex 라도 들어가면 슬라이드 전체 폐기
- 강조 표현은 자유 선택: **굵기 (weight 800~900)** / 폰트 사이즈 차이 / 단색 강조 박스 / 충분한 여백.
  특정 모티브 (반전 박스 등) 강제 X.
- 사용자 의도: 초안 단계 = 내용/레이아웃 완성. 색감은 디자이너가 수주 후 채움. 지금 색 들어가면 어정쩡.

[슬라이드 구조 — 모든 슬라이드 공통 4 구역]
1) 좌상단: breadcrumb (작은 폰트, 9~10pt #999)
2) 상단: 거버닝 메시지 — 크고 굵게, **반드시 명사형 문어체**
   나쁜 예: "탄소중립 정책과 생태관광 트렌드 속에서 부산 남구가 제시하는 지속가능한 축제 모델"
   좋은 예: "탄소중립 × 아동친화 × 생태관광, 세 가지를 잡는 축제 설계"
          "무중단 전환으로 완성하는 연 99.97% 가동률"

   ⚠⚠⚠ 거버닝 메시지에 절대 사용 금지 (AI 티 패턴) ⚠⚠⚠
   - **em-dash(—) 절대 금지**: "탄소중립 — 청년 — 미래", "혁신 — 도약" 류 X
   - **hyphen(-) 으로 명사 나열 금지**: "안전 - 신뢰 - 지속" X
   - **en-dash(–) 사용 금지** (마감 D-7 같은 시각 표시 외)
   - **콜론(:) 으로 부제 다는 패턴 금지**: "혁신: 새로운 도약" X
   - **슬래시(/) 나열 금지**: "안전/신뢰/지속" X (단, 비율 표기 99.97%/24h 같은 건 OK)

   ✅ 권장 표현 방식:
   - 조사 활용: "청년이 만드는 도시의 다음 페이지"
   - 한 호흡 문장: "한 번의 행사로 1만 명의 일상이 바뀌는 설계"
   - 콤마(,) 는 OK: "탄소중립, 아동친화, 생태관광까지 잡는 축제"
   - × 기호 OK (병치 강조용): "안전 × 신뢰 × 지속의 운영 체계"
   - "~을 만드는", "~로 완성하는", "~까지 닿는" 류 자연스러운 한국어 연결어미

3) 중단: 내용 성격에 따라 매 슬라이드마다 다른 레이아웃 (도형 패턴 가이드 참조)
4) 하단: 푸터 (가로선 + 섹션명 + 페이지번호)

[내용 원칙 — 절대 준수]
- RFP 본문 단순 복붙 금지
- 추상적 형용사 금지: "우수한/탁월한/적절한/다양한/혁신적/효율적/체계적" 등 → 구체 수치·실명·사례로 교체
  "우수한 운영 능력" ❌ → "연 평균 시민 참여 12 만 명, 만족도 4.7/5.0" ✅
- 슬라이드 여백은 적게 — 관련 실적·수치·유사 기관 사례로 빽빽하게 채운다
- 수치는 단위까지 명시 (원·%·건·시간·㎡·명·회·m/s·㎍/㎥·°C·MB·Gbps·dB·lux 등)
- 나머지 구성은 AI 자율이되, 위 원칙 중 하나라도 어기면 해당 슬라이드 폐기 후 재작성.

[스타일 적용 우선순위 — 이중 레이어]
제안서 스타일은 두 층으로 결정한다:

  ┌─────────────────────────────────────────────┐
  │ LAYER 1  고정 원칙 (도메인 무관 항상 유지)       │
  │   · 5 부 구조 / 슬라이드 breadcrumb              │
  │   · 숫자·단위 극도 상세 (스펙 원칙)              │
  │   · 흑백 6 색 강제                                │
  │   · 제안사 소개 포맷 (N 년 경력·학력·실적)        │
  ├─────────────────────────────────────────────┤
  │ LAYER 2  가변 톤 (RFP 도메인별 자동 전환)         │
  │   · 거버닝 메시지 톤·어미                         │
  │   · 카피 분위기·어휘 색채                         │
  │   · 표지·헤드라인·요약 문장 레지스터              │
  │   · 도메인별 필수·변형 슬라이드                   │
  └─────────────────────────────────────────────┘

**사용자 레퍼런스 스타일 가이드가 있으면 그것이 LAYER 2 보다 우선.**
없을 때만 LAYER 2 의 "도메인 매트릭스" 를 자동 적용.

═══════════════════════════════════════════════════
LAYER 1 — 고정 원칙 (항상 유지)
═══════════════════════════════════════════════════

▸ 5 부 구조 — 모든 정성 제안서 기본 골격
   Ⅰ. 제안 개요     (제안 배경 / 과업 범위 / 제안의 특징·장점 / 컨셉 제안)
   Ⅱ. 일반 부문     (제안사 일반 현황 / 조직 및 인원 / 유사 사업 실적)
   Ⅲ. 사업 수행 부문 (사업 수행 전략 / 세부 프로그램)
   Ⅳ. (도메인별 적정 명칭 — 예: 홍보 계획 / 확산 전략 / 참여 전략 / 성과 확산)
   Ⅴ. (도메인별 적정 명칭 — 예: 사업 관리 / 운영 관리 / 품질 관리 / 리스크 관리)
   + 표지 / 목차 (CONTENTS) / 챕터 divider 5 장 / 마무리 (감사합니다 — 마지막 슬라이드. 부록 X)
   Ⅳ·Ⅴ 이름은 도메인에 맞게 조정 — 구조 자체는 유지.

▸ 슬라이드 breadcrumb 필수
   슬라이드 좌상단에 "Ⅲ. 사업 수행 부문 · 2. 세부 프로그램 · 2.1 무대 프로그램" 형식의 텍스트 박스.

▸ 본문 = 숫자·규격 극도 상세 (전 도메인 공통 원칙)
   단위 (㎡ · m · nit · mm · m/s · ㎍/㎥ · 명 · 원 · % · °C · MB · Gbps · 건 · 명/시간) 까지 명시.
   추상 형용사 ("뛰어난", "최고의") 금지. 정량으로만 말할 것.

▸ 제안사 소개 포맷 (Ⅱ. 일반 부문)
   · 개인 카드: 이름 / 직함 / N 년 경력 / 과거 소속 / 학력 / 담당 프로젝트
   · 조직도 + 업체 인력 현황 표 (구분/핵심 역량/인원/비고)
   · 실적 = 이름 병렬 나열 / 수치 자랑 포인트

═══════════════════════════════════════════════════
LAYER 2 — 도메인별 톤 매트릭스 (RFP 성격에 따라 자동 전환)
═══════════════════════════════════════════════════

RFP 분석에서 project_domain / project_tone_hint / target_audience 가 제공된다.
그 값에 맞게 아래 매트릭스 중 하나를 **전체 문서 톤으로 고정** 한다.

┌─── festival  ── 축제·행사·기념식 ──────────────────
│ 거버닝 어미: "~ 구조 / ~ 설계 / ~ 여정 / ~ 경험 / ~ 확립"
│ 카피 톤: 시적·감성, 체험·기억·몰입 강조, 이미지적 메타포
│ 어휘: 참여, 몰입, 기억, 순간, 여정, 빛, 발견, 연결, 공명, 울림
│ 레지스터: 문장을 짧고 운율감 있게. 체언종결·쉼표 활용.
│ 거버닝 예시:
│   "작은 빛을 지키는 모든 행동이 축제 프로그램으로 설계됩니다"
│   "관람을 넘어 기억으로 남는, 감각 중심 체험 구조"
│   "도심 속 생태 가치를 세대가 함께 발견하는 여정 설계"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 홍보 계획  /  Ⅴ. 사업 관리 부문
│ 필수 페이지(필수 3장): 안전 비상 매뉴얼 / 기상 단계 조치 / 인력 배치표
│ 홍보 로드맵: D-60→D+30 4단계 (인지→관심→행동→확산)
│
┌─── forum ── 포럼·컨퍼런스·심포지엄·국제회의 ─────────
│ 거버닝 어미: "~ 플랫폼 / ~ 담론 / ~ 의제 / ~ 체계 / ~ 연대 / ~ 거버넌스"
│ 카피 톤: 지적·권위, 의제 설정·글로벌 시각 강조
│ 어휘: 담론, 통찰, 의제, 연대, 리더십, 어젠다, 싱크탱크, 트랙, 키노트, 이니셔티브
│ 레지스터: 문장 완결성 강조. 명확한 정의·주장·근거.
│ 거버닝 예시:
│   "동아시아 기후 의제를 한국이 주도하는 연간 담론 플랫폼 구축"
│   "전문가·정책·시민을 교차시키는 3-tier 세션 설계"
│   "단발 행사가 아닌 연속적 네트워크로 전환되는 거버넌스 체계"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 참여·확산 계획  /  Ⅴ. 운영 관리 부문
│ 필수 페이지: 연사 섭외·레퍼런스 / 세션 트랙 구조 / 네트워킹 운영 /
│             의전·VIP·통역 / 인력 배치표
│ 홍보 로드맵: D-90→D+60 (티저·연사 공개·등록·현장·기록 5단계)
│
┌─── education ── 교육·연수·컨설팅·아카데미 ────────────
│ 거버닝 어미: "~ 모델 / ~ 방법론 / ~ 커리큘럼 / ~ 역량 / ~ 체계 / ~ 고도화"
│ 카피 톤: 논리·객관, 성과·역량·진단 강조
│ 어휘: 역량, 성취, 평가, 커리큘럼, 모듈, 진단, 맞춤형, 실습, 고도화, 이수율
│ 레지스터: 원인·결과 구조. 숫자 근거 우선.
│ 거버닝 예시:
│   "진단→설계→학습→평가의 4단계 역량 고도화 모델"
│   "직무별 맞춤 커리큘럼과 사후 성취도 추적 체계"
│   "실습 70% 중심의 집중 몰입형 교육 방법론 확립"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 학습자 모집·확산  /  Ⅴ. 품질 관리 부문
│ 필수 페이지: 커리큘럼 설계 / 평가 체계 / 강사진 프로필 / 학습환경·플랫폼 /
│             만족도·성취도 추적 체계
│
┌─── sports ── 체육·대회·경기 ──────────────────────
│ 거버닝 어미: "~ 시스템 / ~ 운영 / ~ 대응 / ~ 프로세스 / ~ 기준 / ~ 체계"
│ 카피 톤: 역동·정밀, 스피드·정확성·안전 강조
│ 어휘: 대회, 기록, 진행, 경기, 심판, 운영, 순위, 기량, 중계, 판정, 타임라인
│ 레지스터: 단문. 규정 기반. 숫자와 시간 단위.
│ 거버닝 예시:
│   "경기 진행·판정·기록이 동시에 정확히 흐르는 3중 운영 시스템"
│   "선수·관중·심판 각각의 동선 완전 분리 안전 체계"
│   "기상·부상·경기 중단 3분 내 의사결정 대응 프로세스"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 관중·홍보 계획  /  Ⅴ. 경기·운영 관리
│ 필수 페이지: 경기 운영 규정 / 심판·의무 배치 / 관중·선수 동선 분리 /
│             기상·부상 대응 매뉴얼 / 기록·중계 체계
│
┌─── exhibition ── 박람회·전시·산업전·B2B ──────────────
│ 거버닝 어미: "~ 허브 / ~ 생태계 / ~ 플랫폼 / ~ 네트워크 / ~ 확장 / ~ 매칭"
│ 카피 톤: 규모·성과, 바이어 매칭·거래 성사 강조
│ 어휘: 바이어, 매칭, 상담, 참가기업, 성과, 확장, 생태계, MOU, 수출, 거래
│ 레지스터: 숫자 중심. 참가사·상담 건수·예상 성과 정량 명시.
│ 거버닝 예시:
│   "국내외 바이어 500사 × 참가기업 200사 = 연 10,000건 매칭 허브"
│   "전시 이후에도 상담이 이어지는 6개월 지속 상담 플랫폼"
│   "부스 운영·B2B 매칭·수출 성사를 한 흐름으로 연결한 생태계"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 참가기업·바이어 유치  /  Ⅴ. 운영·사후관리
│ 필수 페이지: 부스 배치도 / 참가기업 유치 전략 / 바이어 매칭 운영 /
│             전시 동선·VIP 의전 / 사후 성과 추적
│
┌─── campaign ── 공공캠페인·시민참여·인식개선 ────────────
│ 거버닝 어미: "~ 확산 / ~ 실천 / ~ 참여 / ~ 인식 / ~ 공동체 / ~ 연대"
│ 카피 톤: 가치·사회적, 공감·공동체·행동 변화 강조
│ 어휘: 실천, 공동체, 인식, 변화, 연대, 시민, 함께, 우리, 일상, 습관
│ 레지스터: 1인칭 복수("우리"), 일상 언어. 공감 → 행동 전환.
│ 거버닝 예시:
│   "앎에서 실천으로, 일상에 스며드는 탄소중립 행동 확산 구조"
│   "시민이 캠페인 대상이 아닌 생산자가 되는 공동체 참여 설계"
│   "온·오프라인 경계 없는 360° 인식 전환 여정"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 확산 전략  /  Ⅴ. 운영·모니터링 부문
│ 필수 페이지: 타깃 세그먼트 / 메시지·크리에이티브 / 채널 전략 /
│             참여 유도 메커니즘 / 효과 측정 지표
│
┌─── tourism ── 관광·지역·도시브랜딩 ─────────────────
│ 거버닝 어미: "~ 재해석 / ~ 체험 / ~ 여정 / ~ 브랜딩 / ~ 활성화 / ~ 매력화"
│ 카피 톤: 발견·매력, 장소성·정체성 강조, 내러티브
│ 어휘: 장소, 여정, 매력, 고유성, 콘텐츠, 체류, 재방문, 스토리, 큐레이션, 루트
│ 레지스터: 감성·심미. 장소의 고유한 정체성 언어.
│ 거버닝 예시:
│   "지역의 일상이 콘텐츠가 되는 5-루트 체류형 관광 재해석"
│   "보는 관광을 넘어 머무는 경험으로 가는 체류·재방문 유도 여정 설계"
│   "주민·생산자·방문객이 함께 완성하는 장소 브랜딩 체계"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 홍보·유치 계획  /  Ⅴ. 운영·지역연계 부문
│ 필수 페이지: 지역 자원 맵핑 / 콘텐츠 큐레이션 / 체류·재방문 유도 /
│             지역 파트너 네트워크 / 성과 지표
│
┌─── rnd ── R&D·연구·기술개발·용역연구 ──────────────
│ 거버닝 어미: "~ 방법론 / ~ 모델 / ~ 고도화 / ~ 최적화 / ~ 체계 / ~ 검증"
│ 카피 톤: 논리·기술, 근거·방법론·재현성 강조
│ 어휘: 방법론, 검증, 고도화, 분석, 모델, 가설, 정량, 데이터, 실험, 베이스라인
│ 레지스터: 논문·보고서 톤. 단정보다 근거·수치.
│ 거버닝 예시:
│   "데이터 → 특성 추출 → 모델링 → 검증의 4단 방법론 고도화"
│   "베이스라인 대비 정량 성능 개선을 입증하는 실험 체계"
│   "재현 가능한 분석 파이프라인과 결과물 산출 체계 구축"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 결과 활용 계획  /  Ⅴ. 품질·일정 관리
│ 필수 페이지: 연구 방법론 / 데이터 수집·분석 설계 / 실험 설계·베이스라인 /
│             결과물 산출 계획 / 검증·재현성 체계
│
┌─── welfare ── 복지·돌봄·사회서비스 ────────────────
│ 거버닝 어미: "~ 지원체계 / ~ 돌봄 / ~ 지속가능성 / ~ 참여 / ~ 연대 / ~ 자립"
│ 카피 톤: 온정·신뢰, 돌봄·포용·존엄 강조
│ 어휘: 돌봄, 지원, 동반, 연계, 포용, 맞춤형, 지속가능, 존엄, 자립, 일상
│ 레지스터: 따뜻한 존대. 당사자 존엄을 우선 언어로.
│ 거버닝 예시:
│   "일상에서 자립까지, 단계별 맞춤형 돌봄 지원체계"
│   "당사자가 선택하고 설계하는 참여형 복지 서비스 모델"
│   "지역사회·가족·기관이 함께 지속하는 돌봄 연대 체계"
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 이용자·가족 소통  /  Ⅴ. 품질·안전 관리
│ 필수 페이지: 서비스 대상·세그먼트 / 사례 관리 프로세스 / 종사자 배치·교육 /
│             안전·개인정보 관리 / 만족도·지속성 측정
│
┌─── other ── (위에 해당 없음) ──────────────────────
│ 거버닝 어미: "~ 방안 / ~ 전략 / ~ 체계 / ~ 구축"
│ 카피 톤: 담백·전문, RFP 어조를 그대로 반영
│ 레지스터: 공식 중립. 업계 표준 비즈니스 문체.
│ 변형 Ⅳ·Ⅴ:     Ⅳ. 추진 전략  /  Ⅴ. 사업 관리 부문
└─────────────────────────────────────────────────

[톤 전환 메커니즘 — 반드시 준수]
1. RFP 분석의 project_domain 값을 읽어 해당 도메인의 어미·어휘·레지스터를 전체 문서에 일관 적용.
2. project_tone_hint 가 추가 특성(예: "아동 중심", "국제·영문 병기", "정량 성과 중심")을 알려주면 그 특성을 덧붙여 반영.
3. target_audience 에 따라 인칭·존대 수위 조정
   (시민·공익 → 1인칭 복수 / B2B → 3인칭 중립 / 학계 → 객관 서술).
4. **숫자 원칙·레이아웃 선택·5부 구조·breadcrumb 는 도메인과 무관하게 동일하게 유지**.
5. project_domain="other" 인 경우: LAYER 2 를 "other" 로 처리하고 RFP 원문의 문체를 그대로 따름.

[제안사 소개 문구 예시 (도메인별 헤드라인 변환)]
festival:     "분야별 N년 경력의 DIRECTOR들이 축제의 모든 순간을 설계합니다"
forum:        "글로벌 어젠다를 운영해 온 분야별 N년 경력의 전문가 집단"
education:    "분야별 N년 경력의 교육 설계자들이 함께합니다"
sports:       "분야별 N년 경력, 국내외 대회 운영 전문 PM 체계"
exhibition:   "바이어 네트워크를 보유한 분야별 N년 경력의 전시 운영 전문가"
campaign:     "시민과 함께 변화를 만들어 온 분야별 N년 경력의 캠페인 파트너"
tourism:      "지역의 고유성을 읽어 온 분야별 N년 경력의 장소 기획자"
rnd:          "분야별 N년 경력, 정량 검증 기반 연구·개발 팀"
welfare:      "분야별 N년 경력, 현장 중심 복지 서비스 설계자 집단"
other:        "분야별 N년 경력의 전문가들이 함께합니다"


[금지 요약]
- 코드블록(```, ~~~, 인라인 `) 사용 금지
- 제안서 본문 바깥의 설명문·요약·목차 텍스트 출력 금지
- RFP 복붙·추상 형용사·여백 방치 금지


═══════════════════════════════════════════════════
⚠⚠⚠ 도형 JSON 모드 — 출력 형식 ⚠⚠⚠
═══════════════════════════════════════════════════

위의 모든 정책 (5 부 구조 / em-dash 금지 / 도메인 매트릭스 / 흑백 6 색) 을 100% 따르되,
**최종 출력 형식은 반드시 다음 도형 JSON 한 가지** — HTML / 마커 / 자연어 설명 절대 금지.

당신이 슬라이드마다 필요한 도형 (사각형·원·선·화살표·텍스트박스·이미지) 을
**좌표 단위 (인치) 로 직접 배치** 하고, 시스템은 그 도형 정의를 그대로 PPTX 로 그린다.

```json
{
  "title": "발주처명 + 사업명 + 정성 제안서",
  "domain": "festival|forum|exhibition|education|sports|campaign|tourism|rnd|welfare|other",
  "slide_width": 11.69,
  "slide_height": 8.27,
  "slides": [
    {
      "section": "표지|목차|사업이해|추진전략|수행조직|일정|예산|프로그램|홍보|안전관리|기대효과|마무리",
      "shapes": [
        {"type": "rect", "x": 0, "y": 0, "w": 0.4, "h": 7.5, "fill": "#1A1A1A"},
        {"type": "text", "x": 0.8, "y": 1.5, "w": 8, "h": 2.5,
         "text": "거버닝 메시지\n(한 줄 또는 두 줄)",
         "size": 48, "weight": 900, "color": "#1A1A1A",
         "font_family": "Paperlogy", "align": "left"},
        {"type": "line", "x1": 0.8, "y1": 5.0, "x2": 4.0, "y2": 5.0,
         "color": "#1A1A1A", "width": 2},
        {"type": "circle", "x": 9.5, "y": 1.5, "w": 0.7, "h": 0.7, "fill": "#1A1A1A"},
        {"type": "arrow", "x1": 1.7, "y1": 4.0, "x2": 11.0, "y2": 4.0,
         "color": "#1A1A1A", "width": 1.5},
        {"type": "image", "x": 5, "y": 2, "w": 4, "h": 3, "hint": "행사장 이미지"}
      ]
    }
  ]
}
```

[도형 타입 — 6 가지만]
**좌표 단위는 모두 인치 (inch).** slide_width=11.69, slide_height=8.27 이 표준 (A4 가로 강제).

  ① rect    — 사각형 (배경 바 / 카드 박스 / 색면)
     필드: x, y, w, h, fill (예 "#1A1A1A"), stroke (선택), stroke_width (선택), radius (선택, 라운드)
  ② text    — 텍스트 박스 (한국어, 줄바꿈은 \\n)
     필드: x, y, w, h, text, size (포인트), weight (100~900), color,
           font_family (선택, 미지정 시 코드가 "Paperlogy" 강제),
           align (left|center|right), valign (top|middle|bottom, 선택), italic (선택, true/false)
  ③ line    — 직선 (구분선)
     필드: x1, y1, x2, y2, color, width (포인트, 1~3 권장)
  ④ arrow   — 화살표 (프로세스 흐름)
     필드: x1, y1, x2, y2, color, width
  ⑤ circle  — 원 (단계 번호 / 포인트)
     필드: x, y, w, h, fill, stroke (선택), stroke_width (선택)  · w=h 로 정원
  ⑥ image   — 외부 이미지 자리 (운영 환경에서 회색 박스로 placeholder 처리)
     필드: x, y, w, h, hint (이미지 설명 — 추후 실제 이미지로 대체)

[필드 기본값 / 단위]
- 모든 좌표·크기 = 인치 (소수점 OK)
- size = 폰트 포인트 (정수). 거버닝 36~60, 부제 14~18, 본문 11~14, 메타 9~10.
- color: "#RRGGBB" 또는 짧은 표기 "#000". 이름 ("black") 안 됨. 흑백 6 색만 허용.
- align: 미지정 시 left, valign 미지정 시 top.
- font_family: 미지정 시 코드가 "Paperlogy" 강제 (한국어 본문 / 헤드라인 모두 동일).
- 배경은 기본 흰색 — 색 배경 깔고 싶으면 슬라이드 전체 크기 rect 를 첫 도형으로 (단 흑백 6 색만).

[weight 9 단계 매핑 — 코드가 Paperlogy 의 9 weight 별 폰트로 자동 매핑]
weight 값을 다음 9 단계 중 하나로 지정. 코드 (`pptx_generator._add_text`) 가 이 값을 받아
Paperlogy-1Thin ~ Paperlogy-9Black 폰트로 매핑한다.

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
- 거버닝 메시지: weight 800~900
- 부제: 500~600
- 본문: 400~500
- 메타·푸터·캡션: 300~400
- KPI 거대 숫자 (80~120pt): 900

[슬라이드 캔버스 — A4 가로 강제]
- 표준 (강제): slide_width=11.69, slide_height=8.27 (A4 가로 — 한국 B2G 공공입찰 인쇄 표준)
- 16:9 (13.33×7.5) 같은 PT 발표용 비율은 RFP 가 명시적으로 요청한 경우만.
- 모든 도형은 캔버스 안에 들어와야 함 (0 ≤ x+w ≤ slide_width, 0 ≤ y+h ≤ slide_height).

[레이아웃 디자인 원칙 — 흑백 정보 구조 · 초안 단계]
당신은 카피라이터이자 정보 구조 설계자다. 미적 시그니처 (좌측 컬러바 / italic 캡션 /
take-away 강조 박스 같은) 는 디자이너 영역이므로 강제하지 않는다.
대신 **정보 구조** (폰트 위계 · 그리드 · 카드 구획 · 여백) 는 일관 유지한다.

▸ ★ 완전 흑백 + 회색만 ★ — 컬러 액센트 절대 사용 금지
   - 주 컬러: #1A1A1A (거의 검정), #FFFFFF (배경)
   - 보조: #444 (본문), #666 (소제목), #999 (메타·푸터), #DDD (구분선·연한 박스)
   - 강조 표현은 다음 중 자유 선택: ① 굵기 (weight 800~900), ② 폰트 사이즈 차이,
     ③ 단색 강조 박스, ④ 충분한 여백. 특정 모티브 (예: 검정 fill + 흰 텍스트 반전) 강제 X.
   - ⚠ 오렌지·블루·레드·그린 등 ANY 컬러 hex 금지. 도형 fill / 텍스트 color 모두.
   - 사용자 의도: "초안 = 내용/레이아웃 완벽, 색감은 디자이너가 나중에 채움"
   - 색감 들어가면 어정쩡해서 오히려 망함. 흑백이 더 강력한 시각 임팩트.

▸ 큰 헤드라인 + 짧은 본문 + 풍부한 여백
   - 거버닝 메시지: 36~60pt, weight 800~900
   - 부제: 14~18pt, weight 500~600, color #444
   - 본문: 11~14pt, color #444 또는 #666
   - 메타/캡션: 9~10pt, color #999

▸ 좌측 정렬 우선 (한국어 가독성)
   - 표지·챕터 표지만 가운데 정렬 가끔 OK
   - 카드/그리드는 왼쪽 위부터 흐르게

▸ 정보 위치 표시 (단순하게 · 위치 자율)
   - 챕터 표시 (breadcrumb): 작은 폰트 9~10pt #999 weight 300~400. 좌상단 권장이지만 자율.
   - 페이지 번호: 작은 폰트 #999. 위치는 자율 (우하단 또는 우상단).
   - 섹션명 표시: 필요시 작은 폰트로. 모든 슬라이드에 강제 X. (회사명은 본문 inject 금지 — 청렴제)
   - 가로 구분선·좌측 컬러바·하단 take-away 박스 같은 미적 모티브는 강제 X.
     (디자이너가 받아서 추가/변경할 여백을 남긴다)

[페이지 수 / 분량]
- 슬라이드 수: 최소 8 장, 권장 20~40 장 (RFP 분량에 따라)
- 슬라이드별 도형 수 (★ SOOZOO 벤치마크 기준 ★):
  · 콘텐츠 슬라이드 (배경·기획·사업 내용·전략·일정·예산 등): **30~70 개** (평균 48 목표)
  · 표지·챕터 표지·마무리 슬라이드: **15~30 개**
  · 헐거운 슬라이드 (도형 5~10 개) = 60 점. 빽빽한 정보 시각화 (도형 30+) = 80 점.
  · "사각형 3 개 + 선 2 개" 식의 헐거운 슬라이드 절대 금지.
- 표지 / 목차 / 5 개 챕터 divider / 챕터별 5~7 장 본문 / 마무리 (감사합니다 — 본문에 포함)

[5부 구조 — shapes 안에 텍스트로 반영]
   Ⅰ. 제안 개요  /  Ⅱ. 일반 부문  /  Ⅲ. 사업 수행 부문
   Ⅳ. (도메인별 변형)  /  Ⅴ. (도메인별 변형)
   + 표지 / 목차 / 마무리 (감사합니다 — 마지막 슬라이드. 부록 X)
- 챕터 시작 직전 divider 슬라이드 1장: 거대 번호 "Ⅰ" 200pt + 챕터명 36pt + 한 줄 요약 14pt

[거버닝 메시지 — 절대 원칙 재확인]
- 길이: 25 자 이내, 명사형 문어체
- ⚠⚠⚠ em-dash(—) / hyphen(-) 으로 명사 나열 / 콜론(:) 으로 부제 / 슬래시(/) 나열 절대 금지
- 콤마(,) 와 × 기호는 OK
- 좋은 예: "탄소중립, 아동친화, 생태관광까지 잡는 축제 설계"
- 나쁜 예: "탄소중립 — 아동친화 — 생태관광" (em-dash 나열)

[본문 글투 — 거버닝과 같은 원칙. 본문에도 모두 적용]
거버닝뿐 아니라 **모든 텍스트 박스 본문** 에 같은 원칙 적용.

⚠ 기호 남용 금지 (거버닝과 동일 — 본문에도 적용)
- em-dash(—), 콜론(:), 슬래시(/) 로 명사 나열 금지.
- 한 슬라이드의 모든 텍스트 박스를 합쳐서 em-dash·콜론 등 0~1 회 이내.

⚠ 추상 형용사 빈도 — 슬라이드당 2 개 미만
- 금지 단어 (등장 시 폐기 · 재작성):
  · "혁신적", "효율적", "다양한", "체계적", "탁월한", "우수한", "적절한", "최고의", "뛰어난"
  · "지속가능한", "통합적인", "전략적인", "유기적인" (도메인 어휘로 흔히 위장됨 — 구체화 필요)
- 대안: 구체 수치 · 고유명사 · 단계 / 행동 명시.
  "효율적 운영" ❌ → "현장 PM 1 인 + 본부장 3 인 단독 의사결정 체계, 회의 절차 생략" ✅

⚠ 영어 직역 어조 회피
- "~ 할 수 있습니다", "~ 하는 것이 좋습니다", "~ 하도록 합니다" → 명사형 종결로 교체
  "운영할 수 있습니다" ❌ → "운영" / "운영 체계" ✅
- "synergy", "leverage", "engagement", "implementation" 같은 영어 외래어 / 콩글리시 금지.
  꼭 필요하면 한국어 + 괄호 영문 (예: "거버넌스(governance)").

⚠ 번호 매김 강박 금지
- 모든 본문을 1, 2, 3, 4 / 가나다라 / ①②③ 로 만드는 패턴 금지.
- 슬라이드당 번호 매김 도입은 step·timeline·process 같은 명백한 시각 블록 1 개에만.
- 그 외 본문은 짧은 문장·명사형 라벨로.

⚠ 메타 멘트 금지 (자기 해설형 문장)
- "이는 매우 중요한 점입니다" / "이러한 방식은 ~ 에 도움이 됩니다" / "다음과 같이 구성됩니다" 류 금지.
- 모든 문장이 **사실·수치·행동** 만 담고 있어야.

⚠ "~ 을(를) 통해" 남발 금지 — 한 슬라이드 1 회만
- 대안: "~ 로", "~ 에서", "~ (으)로 완성하는".

⚠ 수치는 단위까지 — 예외 없음
- "12 만 명" / "연 15 회" / "총 사업비 8 억 5 천만 원" / "강수량 30mm/h" / "풍속 12m/s".
- 단위 없는 숫자만 단독 등장 금지 (단 페이지 번호 / KPI 거대 숫자는 예외).

[AI 사투리 제거 — RAG 학습 결과 반영]
시스템은 수백 건의 실제 공공 제안서를 학습했다. **이 분야에서 자연스러운 워딩**:
- "~ 체계 구축", "~ 운영 모델", "~ 추진 방안", "~ 거버넌스" (비즈니스 명사형)
- "본 제안에서는", "당사는", "발주처의 ~ 에 부응하여"
- RAG 가 inline 으로 박은 발췌 본문의 **분량·수치 디테일·구조** 를 그대로 흉내. 단 발주처명·금액·고유명사는 베끼지 말 것.

[콘텐츠 유형별 권장 시각 구조]

콘텐츠의 본질에 맞는 구조를 선택하라. 단순 박스 나열을 모든 슬라이드에 반복하지 마라.

1) AS-IS / TO-BE 비교 — 점층적 전환
   좌우 2 단 분할. 좌측 현재 상태, 우측 미래 상태.
   가운데에 화살표 또는 → 기호로 전환 표시.
   큰 숫자/통계 강조로 전환 임팩트 표현.
   적용: 문제 진단 → 해결안, 변화 전후, 갭 분석

2) 3-4 카드 동등 비교
   가로 등분. 각 카드 헤더 + 본문 + 결론.
   카드 사이 시각적 구분 (단순 여백 또는 얇은 선).
   적용: 차별점 3 가지, 핵심 가치 3-4 개, 평행한 분류

3) 단계별 프로세스 (가로 흐름)
   가로 흐름. 단계 5-7 개. 각 단계 박스 + 화살표 연결.
   핵심 단계 하나만 굵은 테두리로 강조 가능.
   적용: 사업 추진 절차, 운영 프로세스, 이벤트 진행 순서

4) 수직 타임라인 (점진적 단계)
   좌측 단계명/시간 + 우측 상세. 점/선으로 단계 연결.
   단계 4-6 개 권장. 시간 흐름이 명확한 콘텐츠.
   적용: 일정 계획, 단계별 마일스톤, 기간별 추진

5) 2x2 매트릭스 / 사분면
   2 축 분류. 각 사분면에 텍스트. 중앙에 핵심 결론 가능.
   적용: SWOT, 자사/경쟁사 강약점, 포지셔닝

6) Before / After 점층 카드
   카드 안에 Before 영역 → 화살표 → After 영역.
   여러 항목을 동시에 비교 가능.
   적용: 도입 효과, 성과 비교, 개선 사례

7) 그리드 (인물/사례 나열)
   2x3 또는 2x4 그리드. 각 셀에 이름/제목 + 설명.
   적용: 팀원 소개, 유사 실적, 사례 모음, 자문위원

8) 표지 / 챕터 표지
   큰 헤드라인 (Paperlogy 9 Black, 50pt+).
   부제 (Paperlogy 4 Regular). 발주처/사업명/날짜 정도.
   적용: 표지, 각 챕터 첫 페이지, 마무리 메시지

9) 정량 데이터 강조 (큰 숫자)
   큰 숫자 (Paperlogy 9 Black, 80pt+) + 라벨 + 보조 설명.
   1-3 개 핵심 수치를 시각적 임팩트로 표현.
   적용: 통계, 성과, KPI, 시장 규모

10) 핵심 메시지 단일
    슬라이드 중앙에 짧은 메시지 (1-2 줄).
    여백 충분. 전체 슬라이드를 메시지가 지배.
    적용: 챕터 마지막, 핵심 선언, 강조하고 싶은 한 문장

[적용 원칙]
- 콘텐츠 본질이 패턴을 선택한다. 미적 다양성 추구가 아니다.
- 30 슬라이드면 위 10 가지 중 최소 6-7 개를 다양하게 활용하라.
- 같은 패턴 연속 3 장 이상 반복 금지.
- 정보가 평행한 비교면 2/3, 흐름이면 4/5, 전환이면 1/6, 강조면 9/10.
- 패턴이 안 맞으면 박스 나열로 회귀 금지. 위 카탈로그 외 다른 구조도 가능.
  단 "단순 N 개 박스 가로 나열" 만 반복하지 마라.

[도형 조합으로 다양한 시각 표현 만들기]

도형 종류는 단순해도 된다 (rect / text / line / arrow / circle / image 6 종).
다양성은 도형의 **"조합"** 에서 나온다. SOOZOO 같은 우수 흑백 제안서가
사각형 70% + 선 28% + 원 2% 만으로 모든 시각 패턴을 만든다.

조합 예시 (각 패턴별 도형 수 권장):

1) 벤다이어그램 (3 원 겹침)
   - circle 3 개를 부분 겹치게 배치
   - 각 원에 라벨 텍스트
   - 겹침 영역에 결론 라벨
   - 도형 수: 7~10 개 (강조용 단순 슬라이드)

2) 점층 타임라인 (4 단계)
   - rect 4 개 가로 배치 (단계 박스)
   - line 3 개로 연결 (단계 사이)
   - arrow 1 개 (전체 흐름 표시)
   - 각 단계 위 text 라벨, 아래 text 설명
   - 도형 수: 20~25 개

3) 매트릭스 (2x2)
   - rect 4 개 격자 배치 (사분면)
   - line 2 개 (가로/세로 축)
   - text 2 개 (축 라벨)
   - 각 사분면 안 text 3~4 개 (상세)
   - 도형 수: 25~35 개

4) 프로세스 다이어그램 (5 단계)
   - rect 5 개 단계 박스
   - arrow 4 개 단계 사이 연결
   - 각 박스 안 번호 (text) + 단계명 (text) + 설명 (text)
   - 핵심 단계 1 개에 굵은 테두리 강조 (rect 추가)
   - 도형 수: 30~40 개

5) Before / After 비교
   - rect 2 개 큰 박스 (좌 Before / 우 After)
   - 각 박스 안 rect 3~4 개 (소항목)
   - arrow 1~2 개 (전환 표시)
   - text 다수 (라벨, 수치, 설명)
   - 도형 수: 35~45 개

6) 정량 데이터 강조 (큰 숫자 + 보조)
   - text 1~3 개 거대 숫자 (Paperlogy 9 Black, 80pt+)
   - rect 박스로 숫자 영역 구획
   - line 으로 숫자와 라벨 분리
   - text 다수 (라벨, 단위, 보조 설명, 출처)
   - 도형 수: 15~25 개

7) 카드 그리드 (3x2 또는 2x4)
   - rect 6~8 개 카드
   - 각 카드 안 rect (헤더 강조)
   - 각 카드 안 text 3~4 개 (제목, 본문, 결론)
   - 도형 수: 40~55 개

[조합 원칙]
- 콘텐츠 본질에 맞는 패턴을 선택한 후, 그 패턴의 도형 수가 30~70 개 범위에
  들어오도록 상세 정보를 충분히 시각화하라.
- "사각형 3 개 + 선 2 개" 식의 헐거운 슬라이드는 60 점이다.
- "30 개 사각형 + 15 개 선 + 텍스트 다수" 식의 고밀도가 80 점이다.
- 도형이 많아도 정렬·정보 위계가 깔끔하면 산만하지 않다. **헐거운 것이 산만한 것이다.**

[도형 검증 자가 점검 — 슬라이드 작성 후 반드시 확인 — 12 항목]
1. 모든 좌표가 캔버스 안 (0 ≤ x+w ≤ slide_width, 0 ≤ y+h ≤ slide_height) 인가?
2. 텍스트 박스 size · weight 가 권장 범위 안 (size 9~120, weight 100~900) 인가?
3. 거버닝 메시지에 금지 기호 (— · / : 단일 사용) 0 개인가?
4. 페이지 번호 표시 있는가? (위치는 자율, 단 30 슬라이드 중 일관된 위치)
5. 한 슬라이드 도형 수: 콘텐츠 30~70 개 (평균 48 목표), 표지·챕터·마무리 15~30 개 범위인가?
   (헐거운 슬라이드 = 60 점. SOOZOO 벤치마크 = 슬라이드당 평균 48 도형.)
6. 본문 글자수 합계 600~1500 자 범위인가? (표지·divider 는 예외 — 짧아도 OK)
7. 흑백 6 색 (#1A1A1A / #444 / #666 / #999 / #DDD / #FFFFFF) 외 hex 0 개인가?
8. 거버닝 + 본문 모두에서 em-dash · 콜론 · 슬래시 명사 나열 0 개인가?
9. 추상 형용사 ("혁신적·효율적·다양한·체계적·탁월한·우수한") 슬라이드당 2 개 미만인가?
10. 수치 단위 누락 0 개인가? (단위 없는 숫자가 페이지번호·KPI 거대숫자 외에 등장 X)
11. 레이아웃 패턴 다양성: 같은 패턴 연속 3 장 이상 반복 0 건인가?
    위 10 가지 패턴 중 최소 6 개 이상 활용했는가? (30 슬라이드 기준)
12. 도형 조합 다양성: 같은 도형 종류를 단순 반복했는가, 조합으로 시각 패턴을 만들었는가?
    예: "사각형 5 개 가로 나열" = 60 점.
        "사각형 5 개 + 선 4 개 연결 + 라벨 텍스트 다수 + 강조 박스" = 80 점.
→ 하나라도 어기면 해당 슬라이드 **즉시 폐기 · 재작성**.

═══════════════════════════════════════════════════
[채팅 응답 — 두 모드]

A) 일반 대화 (제안서 요청 아님): 자연어로 친근하게 응답. JSON 출력 X.
B) 제안서 생성 요청 ("제안서 써줘", "이 RFP 로 제안서 만들어" 등):
   → 출력 = 위 도형 JSON 한 가지만. 어떤 자연어 설명도 앞뒤에 붙이지 X.
   → 출력 시작 첫 글자 = `{`, 끝 글자 = `}`.
   → 코드펜스(```json) 도 붙이지 말 것 — 시스템이 알아서 파싱.

⚠ 채팅에서 사용자가 한 페이지만 수정 요청 시 → JSON 의 해당 slide 만 다시 출력하거나
   전체 JSON 다시 출력 (둘 다 OK).
⚠ 만약 분석할 RFP 가 부족해 슬라이드 못 만들면 → 도형 JSON 이 아닌 자연어로
   "RFP 정보가 부족해요. 어떤 부분 채워주실래요?" 같은 안내.
⚠ 사용자 채팅 응답에서 'HTML', '<div>', 'CSS', 'placeholder', 'marker' 등 기술 용어 등장 금지.
   사용자가 받는 것은 .pptx 파일이고, 시스템이 도형 JSON 을 PPTX 로 변환합니다.
"""


CHAT_SYSTEM_PROMPT = """NightOff 의 기획 파트너다.
한국 공공 입찰 정성 제안서 도메인의 전략 수립을 다룬다.

[채팅의 용도]
이 채팅은 정보 조회가 아니라 같이 판단하는 자리다.
- "차별화 포인트 어디로 잡지?" 같은 전략 판단
- "발주처가 진짜 원하는 게 뭘까?" 같은 행간 읽기
- "경쟁사가 어떻게 들어올까?" 같은 시뮬레이션
- "Winning theme 한 줄로 정리하면?" 같은 메시지 정제

[별도 기능과의 분리 — 채팅에서 시도하지 마라]
다음 작업은 채팅 모드에서 처리하지 않는다. 사용자가 채팅에서 요청하면 해당 기능을 안내:

- **제안서 생성** (전체 PPTX 작성) → "✨ 제안서 생성 버튼을 눌러주세요."
- **RFP 분석** → "RFP 업로드 화면에서 자동 분석됩니다. 결과를 같이 다뤄봅시다."
- **자체 검증 / 점수 시뮬레이션** → "🔍 자체 검증 버튼을 눌러주세요. Compliance + Red Team 통합 분석이 떠요."
- **발주처 들여다보기** → "발주처 들여다보기 메뉴가 별도로 있어요. 결과 보고 같이 정리하시죠."
- **입찰 히스토리** → "발주처 상세 페이지의 대화 히스토리에서 보세요. 결과를 같이 살펴보시죠."

[응답 톤]
- 짧고 본질적. 한 응답은 보통 3~7 줄, 깊이 다뤄도 15 줄 이내.
- **답을 정해주기보다 사용자 사고를 자극** 한다. 단 "어떻게 생각하세요?" 같은 약한 질문 남발 금지.
- 본인 분석·직감을 먼저 제시 → 사용자 반응 기다림.
- 추측은 "추측인데", 확신은 "이건 확실히" 명시. 모르는 것은 "확인 필요" 솔직히.

[글투 — PROPOSAL_SYSTEM_PROMPT 의 핵심 계승]
- em-dash (—), 콜론 (:) 으로 명사 나열 금지
- 슬래시 (/) 나열 금지 (단 비율 표기 99.97%/24h 같은 건 OK)
- 추상 형용사 (혁신적·효율적·다양한·체계적·탁월한·우수한·통합적인·전략적인) 금지
- 영어 직역 어조 ("~ 할 수 있습니다", "~ 하는 것이 좋습니다") 회피 — 단 격식체 자체는 OK
- 메타 멘트 ("이는 매우 중요한 점입니다", "다음과 같은 이유로") 금지
- 영어 외래어 (synergy, leverage, engagement) 금지
- 번호 매김 강박 금지 (모든 답을 1·2·3 으로 만들지 말 것)
- 수치는 단위까지 ("12 만 명", "연 15 회", "총 사업비 8 억 5 천만 원")

[도메인 컨텍스트]
사용자가 작업 중인 RFP / 발주처 / 사업명이 본 시스템 프롬프트에 별도 inject 된다.
그 컨텍스트를 적극 활용 — 발주처명·사업명·평가 기준·요구사항 모두 정확히 인지.
domain 정보가 함께 들어오면 그 도메인의 어미·어휘·톤도 자연스럽게 반영.

[출력 형식]
**순수 텍스트 대화만.** 도형 JSON / HTML / `<div>` / 마크업 / 코드블록 절대 출력 X.
긴 목록이 필요하면 한국어 줄바꿈 + 짧은 불릿 (·) 정도. 표 마크다운도 X.

[모르는 것]
함부로 단정하지 말고 같이 사고. RFP / 발주처 정보가 부족하면
"RFP 어떤 부분 더 보여줄 수 있어요?" 같은 짧은 추가 질문.
"""


RFP_ANALYSIS_PROMPT = """당신은 공공/민간 입찰 RFP·과업지시서·공고문 분석 전문가입니다.
아래 1개 이상의 문서가 제공됩니다. 각 문서 앞에 [ROLE: 공고문|과업지시서|제안요청서|기타] 표기가 있습니다.

역할별 핵심 정보(여러 문서가 모두 있으면 통합 판단):
- 공고문     → 사업 개요 / 예산(추정가) / 전체 일정 / 입찰 자격 요건 / 참가 방법 / 공고기관
- 과업지시서 → 사업 내용 / 수행 범위 / 주요 과업 / 산출물 / 제약사항 / 요구 기술
- 제안요청서 → 제안서 형태(가로/세로) / 배점 기준 / 페이지 수 제한 / 제출 형식 /
             PT 일정 / 평가 방식 / 마감일
- 기타 → 보조 자료로 활용

역할이 중복 제공하는 정보(예: 예산·마감일)는 제안요청서 > 공고문 > 과업지시서 순으로 우선.

orientation 엄격 규칙:
- 본문에 "가로", "landscape", "A4 가로" 명시 → "landscape"
- 본문에 "세로", "portrait", "A4 세로" 명시 → "portrait"
- 언급이 전혀 없거나 모호하면 반드시 "landscape" (디폴트)
- 페이지 비율·이미지 배치 느낌 같은 추측 근거 사용 금지. 원문 명시만 판단 근거.

출력 스키마 (JSON만, 다른 텍스트 금지):
{
  "title": "사업/과업명",
  "organization": "발주처(공고기관) — 가장 큰 조직 단위만 추출. 본부·과·팀·실 같은 하위 부서는 제외하고 재단/협회/부/처/청/시/군/구/공사/대학/기관 단위까지만. 추출 불가능하면 빈 문자열. 예시: '문화체육관광부', '한국관광공사', '서울특별시', '한국콘텐츠진흥원', '국립중앙박물관'. 잘못된 예: '서울시 한강사업본부' → '서울특별시', '문체부 콘텐츠정책관실' → '문화체육관광부'",
  "client_type": "공공|대기업|민간|스타트업",
  "project_domain": "festival|forum|education|sports|exhibition|campaign|tourism|rnd|welfare|other",
  "project_domain_label": "도메인 한국어 라벨 (예: '축제·행사', '포럼·컨퍼런스', '박람회·전시' 등)",
  "project_tone_hint": "RFP 본문·분위기에서 읽히는 톤 특성 한 줄 (예: '아동 가족 중심, 감성·체험형', '국제·지적 권위, 어젠다 설정형', '정량 성과·바이어 유치 중심')",
  "target_audience": "주요 참여자/청중 (예: '아동 가족', '국제 연사·학계', 'B2B 바이어', '일반 시민', '선수·심판', '학생·교사')",
  "deadline": "YYYY-MM-DD 또는 빈 문자열",
  "budget": "예산(원 단위 표기)",
  "orientation": "landscape|portrait",
  "page_limit": 숫자 또는 null,
  "submission_format": "제출 형식 설명",
  "key_requirements": ["핵심 요구사항 5-8개 (과업 + 제안 요구사항 통합)"],
  "evaluation_criteria": [{"item": "평가항목", "weight": "배점"}],
  "deliverables": ["산출물 목록"],
  "pt_schedule": "PT/심사 일정 텍스트",
  "risk_points": ["리스크/주의사항 3-5개"],
  "summary": "전체 3문장 요약"
}

project_domain 판단 기준 (본문 키워드·어휘 우선):
- festival: 축제·페스티벌·기념식·개막식·폐막식·주간행사
- forum: 포럼·컨퍼런스·심포지엄·정상회의·국제회의·학술대회
- education: 교육·연수·아카데미·워크숍·컨설팅·직무훈련·커리큘럼
- sports: 대회·경기·선수권·체육·올림픽·리그·마라톤·토너먼트
- exhibition: 박람회·전시회·산업전·엑스포·B2B 상담회
- campaign: 공공 캠페인·시민참여·인식개선·홍보·공익
- tourism: 관광·여행·지역브랜딩·도시마케팅·DMO
- rnd: R&D·연구·기술개발·용역연구·분석·모델 개발
- welfare: 복지·돌봄·노인·청소년·장애인·사회서비스
- other: 위에 해당 안 되면 (명확히 모를 때만)
복합 성격이면 **가장 중심이 되는 한 개만** 선택. 불확실하면 other.

문서:
---
{RFP_TEXT}
---

JSON:"""


REFERENCE_SUMMARY_PROMPT = """아래 문서를 제안서 작성의 스타일 레퍼런스로 분석하세요.
나중에 AI 가 비슷한 제안서를 쓸 때 그대로 흉내낼 수 있도록 **구체적 스타일 신호** 를 추출합니다.

JSON 스키마 (모든 필드 채울 것):
{
  "summary": "한 줄 요약 (80자 이내)",
  "reusable_patterns": ["재활용 가능한 메시지/표현 패턴 3~5개"],
  "structure": {
    "total_pages": 숫자 (대략),
    "section_hierarchy": ["Ⅰ. 제안 개요", "Ⅱ. 일반 부문", ...]  (로마자 대단원 + 소단원),
    "breadcrumb_pattern": "페이지 상단에 드러나는 위치 표기 형식 (예: 'Ⅲ. 사업 수행 부문 2. 세부 프로그램 _2.1')",
    "cover_format": "표지 구성 요소 (제목/등록번호/회사/대표/날짜 등)"
  },
  "tone": {
    "governing_message": "거버닝 메시지 톤 특징 (예: '시적·감성 1줄, 어미는 ...구조 / ...설계 / ...확립')",
    "body_style":        "본문 스타일 (예: '숫자·규격 극도로 상세, 단위까지 명시')",
    "sample_governing":  ["실제 관찰된 거버닝 메시지 예시 3개"]
  },
  "visual_blocks": ["자주 쓰는 시각화 블록 이름들 (예: '3~4 전략 카드 그리드', 'STEP 1→2→3 프로세스', 'D-일정 간트', '단계별 임계치 조치표', '타깃×메시지×채널 매트릭스', '상세 매뉴얼 표')"],
  "must_have_pages": ["꼭 포함하는 페이지 이름들 (예: '안전 비상 매뉴얼', '기상 단계 조치', '인력 배치표', '홍보 4단계 로드맵', '조직도/실적', '감사합니다')"],
  "numeric_density": "숫자·규격의 사용 밀도 (low/medium/high) + 관찰 예시 (예: '562㎡, 7m×4m, P3.9, 5,000 nit')",
  "signature_elements": ["고유 브랜딩 요소 (예: 캐릭터 IP, 전용 슬로건, N년 경력 강조, 자사 실적 리스트 포맷)"]
}

JSON만 출력. 모른다/관찰 안 됨인 필드는 null 또는 빈 배열.

문서:
---
{DOC_TEXT}
---

JSON:"""


CLIENT_PROFILE_PROMPT = """이 발주처의 "프로파일"을 업데이트하세요.
- 기존 프로파일이 있으면 새 정보를 누적(중복 제거, 더 정확한 버전으로 교체).
- RFP 분석 + 최근 대화를 함께 읽고 공통된 패턴을 추출.

기존 프로파일(JSON):
{EXISTING}

RFP 분석(JSON):
{RFP}

최근 대화:
{CONV}

JSON 스키마(JSON만 출력, 다른 텍스트 금지):
{
  "keywords": ["이 발주처가 자주 쓰거나 중요시하는 키워드 10개 이내"],
  "high_weight_items": ["높은 배점이 매겨지는 평가 항목 6개 이내"],
  "recurring_reqs": ["반복되는 요구사항 6개 이내"],
  "insights": ["발주처 특성·성향 한 줄 요약 5개 이내"]
}
JSON:"""


COMPANY_DNA_PROMPT = """우리 회사가 과거에 만든 제안서/레퍼런스 요약들을 보고,
이 회사만의 DNA(고유한 문체·강점·전략 구조)를 추출하세요.

기존 DNA(누적 중):
{EXISTING}

추가 레퍼런스 요약:
{SUMMARIES}

JSON 스키마(JSON만 출력):
{
  "signature_phrases": ["자주 등장하는 표현·어구 8개 이내"],
  "strength_keywords": ["강점으로 내세우는 키워드 8개 이내"],
  "strategy_patterns": ["주로 쓰는 전략 구조 설명 3~5개"],
  "tone_style": "이 회사 특유의 톤앤매너 한 문장"
}
JSON:"""


NUANCE_SUMMARY_PROMPT = """아래 대화를 기반으로, 이 발주처와의 이후 대화에 이어갈 수 있도록
핵심 맥락·뉘앙스·선호·금지사항을 뽑아내세요.

JSON 배열 스키마(0~6개 항목):
[
  {"category": "선호사항|의사결정자|예산|기술환경|경쟁상황|톤앤매너|금지사항|맥락",
   "content": "한 문장으로 기억할 내용",
   "tags": ["태그1", "태그2"]}
]
이미 알려진 일반 사실(ex. 회사 개요)은 제외하고, 이 대화에서만 얻을 수 있는 뉘앙스 위주로.
JSON 배열만 출력.

대화:
---
{DIALOG}
---

JSON:"""


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(title="NightOff")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


from fastapi.exceptions import RequestValidationError


@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    """HTTPException은 detail을 그대로 — 개발자가 명시적으로 사용자용 메시지를 넣음."""
    return JSONResponse({"error": exc.detail, "status": exc.status_code}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Pydantic/FastAPI 검증 실패 — 첫 필드 에러를 친절 메시지로."""
    errs = exc.errors() or []
    if errs:
        first = errs[0]
        loc = ".".join(str(p) for p in first.get("loc", []) if p not in ("body", "query"))
        msg = first.get("msg") or "형식이 올바르지 않습니다"
        if "required" in msg.lower():
            friendly = f"필수 항목이 비어 있어요: {loc or '요청 데이터'}"
        elif "too long" in msg.lower() or "length" in msg.lower():
            friendly = f"입력 길이가 허용 범위를 벗어났어요: {loc}"
        else:
            friendly = f"입력을 확인해 주세요 ({loc}: {msg})"
    else:
        friendly = "요청 형식이 올바르지 않아요."
    log.info("Validation error on %s: %s", request.url.path, errs)
    return JSONResponse({"error": friendly, "status": 422}, status_code=422)


_INIT_DB_RECOVERY_ATTEMPTED = False


@app.exception_handler(sqlite3.OperationalError)
async def sqlite_op_handler(request: Request, exc: sqlite3.OperationalError):
    """SQLite OperationalError 자가복구.
    'no such table' / 'no such column' 에러면 startup 의 init_db 가 실패한 상태일 가능성 큼
    → 1회 자동 재초기화 시도 후 사용자에게 안내.
    """
    global _INIT_DB_RECOVERY_ATTEMPTED
    err_msg = str(exc).lower()
    schema_missing = ("no such table" in err_msg or "no such column" in err_msg)

    log.exception("[DB OperationalError] %s %s | schema_missing=%s",
                  request.method, request.url.path, schema_missing)

    if schema_missing and not _INIT_DB_RECOVERY_ATTEMPTED:
        _INIT_DB_RECOVERY_ATTEMPTED = True
        log.warning("DB 스키마 누락 감지 — init_db + _migrate_db 자가복구 시도")
        try:
            init_db()
            mig = _migrate_db()
            log.info("자가복구 완료 · added=%s · failed=%s", mig.get("added"), mig.get("failed"))
            return JSONResponse(
                {"error": "DB 초기화를 방금 마쳤어요. 같은 동작을 한 번 더 시도해 주세요 🙏",
                 "status": 503, "recovered": True,
                 "migrations_added": mig.get("added", [])},
                status_code=503,
            )
        except Exception as e2:
            log.exception("init_db/_migrate_db 재시도 실패: %s", e2)

    return JSONResponse(
        {"error": "데이터를 저장하는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
         "status": 500, "detail": str(exc)[:200]},
        status_code=500,
    )


@app.exception_handler(sqlite3.IntegrityError)
async def sqlite_int_handler(request: Request, exc: sqlite3.IntegrityError):
    log.warning("[DB IntegrityError] %s %s — %s", request.method, request.url.path, exc)
    return JSONResponse(
        {"error": "이미 존재하거나 형식이 맞지 않는 데이터예요.", "status": 400},
        status_code=400,
    )


@app.exception_handler(Exception)
async def global_exc_handler(request: Request, exc: Exception):
    """예상치 못한 모든 예외 — 내부 스택트레이스는 로그로, 사용자에게는 친절 메시지."""
    log.error("[Unhandled] %s %s\n%s", request.method, request.url.path, traceback.format_exc())
    # Anthropic SDK 예외는 친절히 번역
    if isinstance(exc, anthropic.APIError):
        return JSONResponse({"error": translate_anthropic_error(exc), "status": 502}, status_code=502)
    return JSONResponse(
        {"error": "잠시 문제가 생겼어요. 다시 시도해 주세요.", "status": 500},
        status_code=500,
    )


@app.on_event("startup")
def _startup() -> None:
    """startup 단계는 절대 raise 하지 말 것.
    init_db() 또는 키 조회가 실패해도 / 는 응답해야 healthcheck 통과 → 후속 디버깅 가능.
    """
    log.info("=== NightOff startup 시작 ===")
    log.info("DATABASE_URL set? %s · USE_PG=%s · DB_PATH=%s", bool(DATABASE_URL), USE_PG, DB_PATH)
    try:
        init_db()
        log.info("init_db OK")
    except Exception as e:
        log.exception("init_db 실패 — DB 의존 기능은 비활성, / 는 계속 응답: %s", e)
    # 컬럼 자동 마이그레이션 (init_db 가 raise 했어도 별도로 시도)
    try:
        result = _migrate_db()
        if result["added"]:
            log.info("DB 마이그레이션 added: %s", result["added"])
        if result["skipped"]:
            log.info("DB 마이그레이션 skipped: %s", result["skipped"])
        if result["failed"]:
            log.warning("DB 마이그레이션 failed: %s", result["failed"])
    except Exception as e:
        log.exception("DB 마이그레이션 자체 실패 (무시): %s", e)
    # 키 출처 로깅 (실패해도 startup 종료 안 함)
    try:
        src = get_api_key_source()
        if src == "env":
            env_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
            tail = env_key[-4:] if len(env_key) >= 4 else "****"
            log.info("ANTHROPIC_API_KEY source = ENV · ···%s", tail)
        elif src == "db":
            log.info("ANTHROPIC_API_KEY source = DB (settings 테이블)")
        else:
            log.info("ANTHROPIC_API_KEY source = NONE")
    except Exception as e:
        log.warning("API key source 조회 실패 (무시): %s", e)
    # R2 마스터 템플릿 + RAG DB 동기화 (실패해도 startup 종료 안 함)
    try:
        import r2_storage
        r2_storage.sync_master_templates()
    except Exception as e:
        log.warning("R2 sync 실패 (무시 — 로컬 master_templates/ 만 사용): %s", e)
    try:
        import r2_storage
        rag_result = r2_storage.sync_rag_db()
        if rag_result.get("downloaded") or rag_result.get("skipped"):
            log.info("RAG DB sync OK (size=%.1fMB, downloaded=%s)",
                     rag_result.get("size_mb", 0), rag_result.get("downloaded", False))
        elif rag_result.get("error"):
            log.info("RAG DB sync skip: %s", rag_result["error"])
    except Exception as e:
        log.warning("RAG DB sync 실패 (무시 — RAG 비활성 모드로): %s", e)
    log.info("=== NightOff server ready (uvicorn 응답 시작) ===")


# ---------- Static ----------
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.middleware("http")
async def no_cache_static(request, call_next):
    """개발 편의: static 자원은 절대 캐시하지 않음."""
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


from fastapi.responses import HTMLResponse


def _render_index() -> str:
    """index.html을 읽어 static 자원 URL에 시작 시점 타임스탬프 쿼리를 박아 반환 — 캐시 회피."""
    v = str(int(datetime.now().timestamp()))
    html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    html = html.replace('href="/static/style.css"', f'href="/static/style.css?v={v}"')
    html = html.replace('src="/static/app.js"', f'src="/static/app.js?v={v}"')
    return html


@app.get("/")
def index():
    return HTMLResponse(_render_index())


# ---- 헬스체크 전용 ---- DB / 정적 / 외부 의존 모두 회피 (Railway healthcheckPath)
@app.get("/healthz")
def healthz():
    """가벼운 healthcheck — 의존성 0. 컨테이너가 살아만 있으면 200.
    build_id 로 어느 코드가 deploy 됐는지 확인 가능 (디버깅용).
    """
    return JSONResponse({
        "ok": True,
        "service": "nightoff",
        "build_id": "2026-04-29-html-mystery-fix",
        "pptx_route_handler": "api_proposals_pptx",
        "pptx_required_field": "conversation_id",
    })


@app.get("/api/diag/fonts")
def diag_fonts():
    """한글 폰트 + Paperlogy 설치 상태 진단 — Railway deploy 후 검증."""
    import subprocess
    out = {
        "ok": False,
        "korean_fonts": [],
        "paperlogy_installed": False,
        "paperlogy_files": [],
        "all_count": 0,
        "stderr": "",
    }
    try:
        # 한국어 폰트만
        r = subprocess.run(
            ["fc-list", ":lang=ko"],
            capture_output=True, timeout=10,
        )
        ko = r.stdout.decode("utf-8", errors="replace").strip()
        out["korean_fonts"] = [l.split(":")[0].strip() for l in ko.split("\n") if l.strip()][:30]
        # Paperlogy 설치 검출
        r_pl = subprocess.run(
            ["fc-list", ":family=Paperlogy"],
            capture_output=True, timeout=10,
        )
        pl = r_pl.stdout.decode("utf-8", errors="replace").strip()
        if pl:
            out["paperlogy_installed"] = True
            out["paperlogy_files"] = [l.split(":")[0].strip() for l in pl.split("\n") if l.strip()][:15]
        # 전체 폰트 수
        r2 = subprocess.run(["fc-list"], capture_output=True, timeout=10)
        all_lines = r2.stdout.decode("utf-8", errors="replace").strip().split("\n")
        out["all_count"] = len([l for l in all_lines if l.strip()])
        out["ok"] = len(out["korean_fonts"]) > 0
    except Exception as e:
        out["stderr"] = f"{type(e).__name__}: {e}"
    return JSONResponse(out)


@app.get("/api/r2/status")
def r2_status():
    """R2 연결 + 캐시 상태 진단."""
    try:
        import r2_storage
        return JSONResponse(r2_storage.status())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/diag/rag")
def diag_rag():
    """RAG 동작 상태 진단 — Railway deploy 후 RAG 활성 여부 확인."""
    out = {
        "available": False,
        "openai_key_present": bool(os.environ.get("OPENAI_API_KEY", "").strip()),
        "rag_db_exists": False,
        "rag_db_path": "",
        "rag_db_size_mb": 0,
        "chunk_count": 0,
    }
    try:
        from pathlib import Path as _P
        # rag_retriever 의 DB_PATH 동일 경로
        db_path = _P(__file__).parent / "rag_kb.db"
        out["rag_db_path"] = str(db_path)
        if db_path.exists():
            out["rag_db_exists"] = True
            out["rag_db_size_mb"] = round(db_path.stat().st_size / 1024 / 1024, 1)
            try:
                import sqlite3
                db = sqlite3.connect(str(db_path))
                out["chunk_count"] = db.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
                db.close()
            except Exception as e:
                out["chunk_query_error"] = str(e)[:120]
        try:
            import rag_retriever
            out["available"] = rag_retriever.is_available()
        except Exception as e:
            out["import_error"] = str(e)[:120]
    except Exception as e:
        out["error"] = str(e)[:120]
    return JSONResponse(out)


@app.post("/api/r2/sync")
def r2_sync():
    """수동 R2 재동기화 (관리자용)."""
    try:
        import r2_storage
        result = r2_storage.sync_master_templates()
        # Path 객체는 str 로 변환해서 직렬화
        if result.get("default") is not None:
            result["default"] = str(result["default"])
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/favicon.ico")
def favicon():
    return JSONResponse({}, status_code=204)


@app.get("/client/{rest:path}")
def spa_fallback_client(rest: str):
    """SPA routing fallback — 발주처 상세/수정/채팅 URL 직접 접근 허용."""
    return HTMLResponse(_render_index())


# ---------- Models ----------
class SettingsIn(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None


class ClientIn(BaseModel):
    name: str
    industry: str = ""
    manager: str = ""
    memo: str = ""


class ChatIn(BaseModel):
    message: str




# ---------- Settings ----------
@app.get("/api/settings")
def api_settings_get():
    key = get_api_key()
    source = get_api_key_source()
    masked = ""
    if key:
        masked = f"{key[:10]}...{key[-4:]}" if len(key) > 16 else "********"
    return {
        "has_key": bool(key),
        "masked_key": masked,
        "source": source,  # 'env' | 'db' | ''
        "env_active": source == "env",
        "model": get_setting("model", MODEL_DEFAULT),
    }


@app.post("/api/settings")
def api_settings_set(body: SettingsIn):
    # ⚠ 핵심 가드: Railway 환경변수가 활성 상태면 DB 키 쓰기 자체를 거부.
    # 이 가드가 없으면 env 가 살아있는데 DB 가 옆에서 누적되고,
    # env 가 풀리는 순간 DB 가 자동으로 선두에 서서 예측 불가능한 키가 적용됨.
    env_active = bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())
    if body.api_key is not None and body.api_key.strip():
        if env_active:
            # 정중하게 거부 — 환경변수가 우선이라는 사실을 클라이언트에 명시
            raise HTTPException(
                status_code=409,
                detail="Railway 환경변수 ANTHROPIC_API_KEY 가 활성 상태입니다. 환경변수가 항상 우선이며, "
                       "DB 키는 환경변수가 비어있을 때만 폴백으로 사용됩니다. 키를 바꾸려면 Railway Variables 에서 수정하세요.",
            )
        set_setting("anthropic_api_key", body.api_key.strip())
    elif body.api_key is not None and not body.api_key.strip():
        # 빈 값으로 명시 저장 시도 — env 활성이면 무의미하므로 그냥 무시 (no-op)
        if not env_active:
            set_setting("anthropic_api_key", "")
    if body.model:
        set_setting("model", body.model.strip())
    return api_settings_get()


@app.post("/api/settings/test")
def api_settings_test():
    """현재 저장된 API 키로 최소 요청을 보내 유효성·크레딧 상태를 진단."""
    key = get_api_key()
    if not key:
        return {"ok": False, "stage": "no_key", "message": "API 키가 설정되지 않았어요. 저장 후 다시 시도해 주세요."}

    # 키 마스킹된 끝 4자리 + 모델
    tail = key[-4:] if len(key) >= 4 else "****"
    model = get_setting("model", MODEL_DEFAULT)
    try:
        client = anthropic.Anthropic(api_key=key, timeout=15.0, max_retries=0)
        resp = client.messages.create(
            model=model,
            max_tokens=16,
            messages=[{"role": "user", "content": "ping"}],
        )
        usage = getattr(resp, "usage", None)
        return {
            "ok": True,
            "stage": "success",
            "message": f"정상 연결 ✅ — 모델 {model} · 키 끝자리 ···{tail}",
            "model": model,
            "input_tokens": getattr(usage, "input_tokens", None),
            "output_tokens": getattr(usage, "output_tokens", None),
        }
    except anthropic.AuthenticationError as e:
        log.warning("API 키 테스트 — AuthenticationError: %s", e)
        return {
            "ok": False, "stage": "auth", "key_tail": tail,
            "message": "API 키가 유효하지 않아요. console.anthropic.com에서 키를 재생성한 뒤 저장해 주세요.",
        }
    except anthropic.BadRequestError as e:
        msg = str(e)
        low = msg.lower()
        if "credit balance" in low or "insufficient" in low:
            return {
                "ok": False, "stage": "credit", "key_tail": tail, "model": model,
                "message": (
                    "이 API 키에 연결된 Organization에 잔액이 없어요. 자주 헷갈리는 점:\n"
                    "• Claude.ai Pro/Max 구독은 API 크레딧을 포함하지 않습니다.\n"
                    "• 여러 Organization이 있다면, 크레딧 충전은 **API 키가 속한 조직**에서 해야 합니다.\n"
                    "확인: console.anthropic.com → 우측 상단 조직 전환 드롭다운에서 해당 조직 선택 → Plans & Billing → Auto reload 설정 권장."
                ),
                "raw": msg[:240],
            }
        if "disabled" in low or "suspended" in low:
            return {"ok": False, "stage": "disabled", "key_tail": tail,
                    "message": "이 API 키가 속한 조직이 비활성화된 상태예요. Anthropic 콘솔에서 상태를 확인해 주세요.",
                    "raw": msg[:240]}
        return {"ok": False, "stage": "bad_request", "key_tail": tail,
                "message": "요청이 거부됐어요. 원본 메시지를 확인해 주세요.", "raw": msg[:240]}
    except anthropic.APIConnectionError:
        return {"ok": False, "stage": "network",
                "message": "Anthropic 서버에 접속할 수 없어요. 네트워크를 확인해 주세요."}
    except anthropic.APIStatusError as e:
        return {"ok": False, "stage": "status", "key_tail": tail,
                "message": f"API가 {getattr(e, 'status_code', '')} 를 반환했어요.",
                "raw": str(e)[:240]}
    except Exception as e:
        log.exception("API 키 테스트 실패")
        return {"ok": False, "stage": "unknown", "key_tail": tail,
                "message": "진단 중 알 수 없는 오류", "raw": str(e)[:240]}


# ---------- Stats ----------
@app.get("/api/stats")
def api_stats():
    with get_db() as db:
        total_clients = db.execute("SELECT COUNT(*) c FROM clients").fetchone()["c"]
        total_convs = db.execute("SELECT COUNT(*) c FROM conversations").fetchone()["c"]
        active_convs = db.execute("SELECT COUNT(*) c FROM conversations WHERE ended=0").fetchone()["c"]
        total_msgs = db.execute("SELECT COUNT(*) c FROM messages").fetchone()["c"]
        rfps = db.execute("SELECT COUNT(DISTINCT client_id) c FROM rfp_files").fetchone()["c"]
        # 이번 달 시작
        month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%S")
        month_activity = db.execute(
            "SELECT COUNT(*) c FROM messages WHERE created_at >= ?", (month_start,)
        ).fetchone()["c"]
        # 대화 1건 = 제안서 1건으로 단순 집계
        total_proposals = db.execute(
            "SELECT COUNT(DISTINCT conversation_id) c FROM messages WHERE role='assistant' "
            "AND content LIKE '%class=\"proposal\"%'"
        ).fetchone()["c"]
    # 승패 집계
    with get_db() as db:
        outcomes = db.execute(
            "SELECT outcome, COUNT(*) c FROM conversations WHERE outcome IN ('won','lost','in_progress') GROUP BY outcome"
        ).fetchall()
    wins = next((o["c"] for o in outcomes if o["outcome"] == "won"), 0)
    losses = next((o["c"] for o in outcomes if o["outcome"] == "lost"), 0)
    in_progress = next((o["c"] for o in outcomes if o["outcome"] == "in_progress"), 0)
    total_decided = wins + losses
    win_rate = round(wins / total_decided * 100) if total_decided else None

    return {
        "total_clients": total_clients,
        "total_proposals": total_proposals,
        "total_conversations": total_convs,
        "active_conversations": active_convs,
        "total_messages": total_msgs,
        "month_activity": month_activity,
        "rfp_count": rfps,
        "wins": wins,
        "losses": losses,
        "in_progress": in_progress,
        "win_rate": win_rate,
    }


@app.get("/api/activity")
def api_activity(limit: int = 12):
    """최근 활동 피드 — 발주처 등록 / RFP 업로드 / 대화·제안서 생성."""
    events: list[dict] = []
    with get_db() as db:
        # 발주처 등록
        for r in db.execute("SELECT id,name,created_at FROM clients ORDER BY created_at DESC LIMIT 10").fetchall():
            events.append({
                "type": "client_created",
                "client_id": r["id"],
                "title": f"{r['name']} 발주처 등록",
                "at": r["created_at"],
                "icon": "building",
            })
        # RFP 업로드
        for r in db.execute(
            "SELECT rf.filename, rf.role, rf.created_at, c.id cid, c.name cname "
            "FROM rfp_files rf JOIN clients c ON c.id=rf.client_id ORDER BY rf.created_at DESC LIMIT 10"
        ).fetchall():
            events.append({
                "type": "rfp_uploaded",
                "client_id": r["cid"],
                "title": f"{r['cname']} · {r['role']} 업로드",
                "at": r["created_at"],
                "icon": "fileSearch",
            })
        # 대화 / 제안서 생성
        for r in db.execute(
            "SELECT cv.id, cv.title, cv.updated_at, cv.client_id cid, c.name cname, "
            "  (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=cv.id AND m.role='assistant' "
            "   AND m.content LIKE '%class=\"proposal\"%') proposal_count "
            "FROM conversations cv JOIN clients c ON c.id=cv.client_id "
            "ORDER BY cv.updated_at DESC LIMIT 10"
        ).fetchall():
            if r["proposal_count"] > 0:
                events.append({
                    "type": "proposal_generated",
                    "client_id": r["cid"],
                    "conv_id": r["id"],
                    "title": f"{r['cname']} 제안서 생성 완료",
                    "at": r["updated_at"],
                    "icon": "file",
                })
            else:
                events.append({
                    "type": "conversation",
                    "client_id": r["cid"],
                    "conv_id": r["id"],
                    "title": f"{r['cname']} · {r['title']}",
                    "at": r["updated_at"],
                    "icon": "msg",
                })
    # 시간 내림차순 정렬 후 limit
    events.sort(key=lambda e: e["at"] or "", reverse=True)
    return events[:limit]


# ---------- Clients ----------
@app.get("/api/clients")
def api_clients_list():
    with get_db() as db:
        rows = db.execute("""
            SELECT c.*,
              (SELECT COUNT(*) FROM conversations cv WHERE cv.client_id=c.id) conv_count,
              (SELECT MAX(created_at) FROM conversations cv WHERE cv.client_id=c.id) last_conv,
              (SELECT COUNT(*) FROM rfp_files r WHERE r.client_id=c.id) has_rfp,
              (SELECT COUNT(*) FROM nuance_memories n WHERE n.client_id=c.id) memory_count,
              (SELECT analysis_json FROM rfp_aggregated WHERE client_id=c.id) rfp_analysis_json
            FROM clients c
            ORDER BY c.updated_at DESC
        """).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        # RFP 분석에서 deadline 추출 → 발주처 카드 D-day 배지에서 사용
        analysis_json = d.pop("rfp_analysis_json", None)
        deadline = ""
        if analysis_json:
            try:
                a = json.loads(analysis_json)
                deadline = (a.get("deadline") or "").strip() if isinstance(a, dict) else ""
            except Exception:
                deadline = ""
        d["deadline"] = deadline
        out.append(d)
    return out


@app.post("/api/clients")
def api_clients_create(body: ClientIn):
    cid = uuid.uuid4().hex[:12]
    with get_db() as db:
        db.execute(
            "INSERT INTO clients(id,name,industry,manager,memo) VALUES(?,?,?,?,?)",
            (cid, body.name, body.industry, body.manager, body.memo),
        )
    return {"id": cid}


@app.get("/api/clients/{cid}")
def api_clients_get(cid: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM clients WHERE id=?", (cid,)).fetchone()
        if not row:
            raise HTTPException(404, "발주처를 찾을 수 없습니다.")
        return dict(row)


@app.patch("/api/clients/{cid}")
def api_clients_update(cid: str, body: ClientIn):
    with get_db() as db:
        cur = db.execute(
            "UPDATE clients SET name=?, industry=?, manager=?, memo=?, "
            "updated_at=datetime('now','localtime') WHERE id=?",
            (body.name, body.industry, body.manager, body.memo, cid),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "발주처를 찾을 수 없습니다.")
    return {"ok": True}


@app.delete("/api/clients/{cid}")
def api_clients_delete(cid: str):
    with get_db() as db:
        db.execute("DELETE FROM clients WHERE id=?", (cid,))
    return {"ok": True}


# ---------- Conversations ----------
@app.get("/api/clients/{cid}/conversations")
def api_convs_list(cid: str):
    with get_db() as db:
        rows = db.execute("""
            SELECT cv.*,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=cv.id) msg_count,
              (SELECT content FROM messages m WHERE m.conversation_id=cv.id
                AND m.role='user' ORDER BY m.created_at ASC LIMIT 1) preview
            FROM conversations cv
            WHERE cv.client_id=?
            ORDER BY cv.updated_at DESC
        """, (cid,)).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/clients/{cid}/conversations")
def api_convs_create(cid: str):
    with get_db() as db:
        row = db.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone()
        if not row:
            raise HTTPException(404, "발주처를 찾을 수 없습니다.")
        conv_id = uuid.uuid4().hex[:12]
        db.execute("INSERT INTO conversations(id,client_id) VALUES(?,?)", (conv_id, cid))
    return {"id": conv_id}


@app.get("/api/conversations/{conv_id}")
def api_conv_get(conv_id: str):
    with get_db() as db:
        conv = db.execute("SELECT * FROM conversations WHERE id=?", (conv_id,)).fetchone()
        if not conv:
            raise HTTPException(404, "대화를 찾을 수 없습니다.")
        msgs = db.execute(
            "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC",
            (conv_id,),
        ).fetchall()
        client = db.execute("SELECT * FROM clients WHERE id=?", (conv["client_id"],)).fetchone()
    return {
        "conversation": dict(conv),
        "messages": [dict(m) for m in msgs],
        "client": dict(client) if client else None,
        "rfp_analysis": _get_rfp_aggregated(conv["client_id"]) or None,
    }


@app.delete("/api/conversations/{conv_id}")
def api_conv_delete(conv_id: str):
    with get_db() as db:
        db.execute("DELETE FROM conversations WHERE id=?", (conv_id,))
    return {"ok": True}


@app.post("/api/conversations/{conv_id}/end")
def api_conv_end(conv_id: str):
    """대화 종료 시 Claude에게 뉘앙스 요약 요청 후 nuance_memories에 저장."""
    with get_db() as db:
        conv = db.execute("SELECT * FROM conversations WHERE id=?", (conv_id,)).fetchone()
        if not conv:
            raise HTTPException(404, "대화를 찾을 수 없습니다.")
        msgs = db.execute(
            "SELECT role,content FROM messages WHERE conversation_id=? ORDER BY created_at",
            (conv_id,),
        ).fetchall()

    if not msgs:
        with get_db() as db:
            db.execute("UPDATE conversations SET ended=1 WHERE id=?", (conv_id,))
        return {"ok": True, "memories_added": 0}

    dialog = "\n\n".join(f"[{m['role']}] {m['content']}" for m in msgs if m["content"])

    try:
        client = require_client()
        prompt = NUANCE_SUMMARY_PROMPT.replace("{DIALOG}", dialog[:20000])
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        # Strip accidental code fences
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        memories = json.loads(raw)
    except Exception as e:
        memories = []
        err = str(e)
    else:
        err = None

    added = 0
    with get_db() as db:
        for m in memories or []:
            db.execute(
                "INSERT INTO nuance_memories(id,client_id,category,content,tags) "
                "VALUES(?,?,?,?,?)",
                (
                    uuid.uuid4().hex[:12],
                    conv["client_id"],
                    (m.get("category") or "맥락")[:30],
                    (m.get("content") or "").strip(),
                    json.dumps(m.get("tags") or [], ensure_ascii=False),
                ),
            )
            added += 1
        db.execute("UPDATE conversations SET ended=1 WHERE id=?", (conv_id,))
    return {"ok": True, "memories_added": added, "error": err}


# ---------- Streaming chat ----------
def _get_rfp_aggregated(client_id: str) -> Optional[dict]:
    """통합 분석 결과 (rfp_aggregated 우선, 없으면 구 rfp_docs fallback)."""
    with get_db() as db:
        row = db.execute("SELECT analysis_json FROM rfp_aggregated WHERE client_id=?", (client_id,)).fetchone()
        if row and row["analysis_json"]:
            try:
                return json.loads(row["analysis_json"])
            except Exception:
                pass
        # 구 테이블 fallback
        old = db.execute("SELECT analysis_json FROM rfp_docs WHERE client_id=?", (client_id,)).fetchone()
        if old and old["analysis_json"]:
            try:
                return json.loads(old["analysis_json"])
            except Exception:
                pass
    return None


def _format_client_block(client) -> str:
    """발주처 정보 블록 (PROPOSAL + CHAT 공용).

    clients 테이블 row 1건 → '[현재 발주처]' 시작 멀티라인 텍스트.
    organization (사용자 입력 발주 기관명) 명시 노출 — 이전 PROPOSAL inline
    코드의 누락 정합성 패치. 빈 컬럼은 그 줄 통째 생략. organization 미입력 시
    '(미입력)' 표기로 안내 트리거. 빈 client (None) 안전망 포함.
    """
    if not client:
        return ""
    lines = ["[현재 발주처]"]
    org = (client["organization"] or "").strip()
    lines.append(f"- 발주 기관: {org or '(미입력)'}")
    lines.append(f"- 별명: {client['name']}")
    for key, label in (("industry", "업종"), ("manager", "담당자"), ("memo", "메모")):
        v = (client[key] or "").strip()
        if v:
            if key == "memo":
                v = v[:200]
            lines.append(f"- {label}: {v}")
    return "\n".join(lines)


def _format_chat_block_rfp_summary(rfp_analysis: Optional[dict]) -> str:
    """블록 #2 RFP 분석 핵심 필드 요약 (CHAT 용).

    PROPOSAL 흐름의 전체 JSON dump (~2,034자) 와 달리 13 핵심 필드만,
    한국어 라벨 + 불릿 + 각 필드 cap 적용. organization 은 #1 [현재 발주처]
    블록에서 노출되므로 본 블록에서 생략. 빈 필드는 그 줄 통째 생략.
    """
    if not rfp_analysis:
        return ""

    lines: list[str] = []

    def _add(label: str, value):
        """단일 값 + 라벨 inject. 빈 값이면 줄 추가 X."""
        if value is None:
            return
        s = str(value).strip()
        if s:
            lines.append(f"- {label}: {s}")

    # 1. 사업명
    _add("사업명", (rfp_analysis.get("title") or "").strip())

    # 2. 도메인 (한글 라벨)
    _add("도메인", (rfp_analysis.get("project_domain_label") or "").strip())

    # 3. 톤 힌트 (100자 cap)
    tone_hint = (rfp_analysis.get("project_tone_hint") or "").strip()[:100]
    _add("톤 힌트", tone_hint)

    # 4. 청중
    _add("청중", (rfp_analysis.get("target_audience") or "").strip())

    # 5. 마감
    _add("마감", (rfp_analysis.get("deadline") or "").strip())

    # 6. 예산
    _add("예산", (rfp_analysis.get("budget") or "").strip())

    # 7. 평가 기준 — 한 줄 요약 (라벨 약화 + "점" 중복 제거)
    ec = rfp_analysis.get("evaluation_criteria") or []
    if isinstance(ec, list) and ec:
        try:
            parts: list[str] = []
            for c in ec[:5]:
                if not isinstance(c, dict):
                    continue
                item = str(c.get("item") or "").strip()
                weight = str(c.get("weight") or "").strip()
                if not item:
                    continue
                # 라벨 약화: "기술능력평가(정량적 평가)" → "기술능력평가(정량)"
                item_short = re.sub(
                    r"\((정량적 평가|정성적 평가|정량평가|정성평가)\)",
                    lambda m: "(정량)" if "정량" in m.group(1) else "(정성)",
                    item,
                )
                parts.append(f"{item_short} {weight}".strip())
            if parts:
                lines.append("- 평가 기준: " + " / ".join(parts))
        except Exception:
            pass

    # 8. 핵심 요구사항 — 5개, 80자 cap
    kr = rfp_analysis.get("key_requirements") or []
    if isinstance(kr, list) and kr:
        items = [str(r).strip()[:80] for r in kr[:5] if r]
        if items:
            lines.append("- 핵심 요구사항:")
            for it in items:
                lines.append(f"  · {it}")

    # 9. 리스크 — 3개, 80자 cap
    rp = rfp_analysis.get("risk_points") or []
    if isinstance(rp, list) and rp:
        items = [str(r).strip()[:80] for r in rp[:3] if r]
        if items:
            lines.append("- 리스크:")
            for it in items:
                lines.append(f"  · {it}")

    # 10. 산출물 — 5개, 50자 cap
    dl = rfp_analysis.get("deliverables") or []
    if isinstance(dl, list) and dl:
        items = [str(r).strip()[:50] for r in dl[:5] if r]
        if items:
            lines.append("- 산출물: " + " / ".join(items))

    # 11. PT 일정 — 120자 cap
    pt = (rfp_analysis.get("pt_schedule") or "").strip()[:120]
    _add("PT 일정", pt)

    # 12. 제출 방법 — 120자 cap
    sf = (rfp_analysis.get("submission_format") or "").strip()[:120]
    _add("제출 방법", sf)

    # 13. 한 줄 요약 — 300자 cap
    summary = (rfp_analysis.get("summary") or "").strip()[:300]
    _add("한 줄 요약", summary)

    if not lines:
        return ""

    return "[RFP 분석]\n" + "\n".join(lines)


def _format_chat_block_domain_tone(rfp_analysis: Optional[dict]) -> str:
    """블록 #4 도메인 톤 (CHAT 용).

    multi-pass 의 _format_domain_tone 과 같은 DOMAIN_TONE_MATRIX 참조.
    단 마지막 가이드 줄 (도형 JSON / 5부 구조 / 흑백 6색 강제) 제거 — CHAT 무관.
    빈 입력 (rfp_analysis None / project_domain 없음) → 빈 문자열 (블록 통째 생략).
    multi-pass 와 다른 점: domain 미상이면 'other' 폴백 X — 채팅에선 컨텍스트 없는
    상태가 명확해야 AI 가 사용자에게 도메인 질문 트리거 가능.
    """
    if not rfp_analysis:
        return ""

    domain = (rfp_analysis.get("project_domain") or "").strip().lower()
    if not domain:
        return ""

    # 모듈 전역 dict 재사용 (proposal_multi_pass 의 정체성 매트릭스)
    from proposal_multi_pass import DOMAIN_TONE_MATRIX

    entry = DOMAIN_TONE_MATRIX.get(domain) or DOMAIN_TONE_MATRIX.get("other")
    if not entry:
        return ""

    label = entry.get("label", domain)
    lines = [f"[도메인 톤 — {domain} ({label})]"]
    if entry.get("endings"):
        lines.append(f"  거버닝 어미: {entry['endings']}")
    if entry.get("tone"):
        lines.append(f"  카피 톤: {entry['tone']}")
    if entry.get("vocab"):
        lines.append(f"  어휘: {entry['vocab']}")
    if entry.get("register"):
        lines.append(f"  레지스터: {entry['register']}")
    if entry.get("examples"):
        lines.append("  거버닝 예시:")
        for ex in entry["examples"][:3]:
            lines.append(f"    · {ex}")

    # CHAT 용 마지막 가이드 (multi-pass 의 도형 JSON 강제 멘션 제거)
    lines.append("  → 어미·어휘·레지스터를 위 매트릭스에 일관 적용해 답변.")

    return "\n".join(lines)


def _format_chat_block_outcomes(won_rows, lost_rows) -> str:
    """블록 #13 승패 기록 (CHAT 용).

    PROPOSAL 흐름과 동일한 형식 (title 만, 5개 LIMIT, ✅/❌ 라벨).
    won/lost 양쪽 빈 시 또는 모든 title 빈 시 빈 문자열 반환 (블록 통째 생략).
    """
    if not won_rows and not lost_rows:
        return ""

    def _join_titles(rows) -> str:
        if not rows:
            return ""
        return ", ".join(
            (r["title"] or "").strip()
            for r in rows
            if r and (r["title"] or "").strip()
        )

    lines = []
    won_titles = _join_titles(won_rows)
    if won_titles:
        lines.append(f"✅ 승리 사례: {won_titles}")
    lost_titles = _join_titles(lost_rows)
    if lost_titles:
        lines.append(f"❌ 패배 사례: {lost_titles}")

    if not lines:
        return ""

    return "[승패 기록 — 승리 패턴 우선 반영, 패배 원인 회피]\n" + "\n".join(lines)


def _format_chat_block_profile(profile_row) -> str:
    """블록 #11 발주처 성향 프로필 (CHAT 용).

    client_profiles 테이블 1행 → 4 list (keywords / high_weight_items /
    recurring_reqs / insights) + sample_count.

    PROPOSAL 흐름의 json.dumps(indent=2) (~2,000자) 와 달리 한국어 라벨 +
    불릿 + 각 list LIMIT/cap 적용. sample_count < 5 시 신뢰도 안내 노출.
    빈 입력 / 모든 list 빈 시 빈 문자열 (블록 통째 생략).
    """
    if not profile_row:
        return ""

    def _safe_json_list(field_name: str) -> list:
        try:
            v = json.loads(profile_row[field_name] or "[]")
            return v if isinstance(v, list) else []
        except Exception:
            return []

    keywords = _safe_json_list("keywords")
    high_weight = _safe_json_list("high_weight_items")
    recurring = _safe_json_list("recurring_reqs")
    insights = _safe_json_list("insights")

    if not (keywords or high_weight or recurring or insights):
        return ""

    try:
        sample_count = int(profile_row["sample_count"] or 0)
    except (KeyError, TypeError, ValueError):
        sample_count = 0

    lines = ["[발주처 성향 — 축적된 인사이트]"]

    # keywords — 5개 LIMIT, 30자 cap, 단일 줄 join
    if keywords:
        kws = [str(k).strip()[:30] for k in keywords[:5] if k]
        kws = [k for k in kws if k]
        if kws:
            lines.append("- 단골 키워드: " + ", ".join(kws))

    # high_weight_items — 3개 LIMIT, 60자 cap, 불릿
    if high_weight:
        items = [str(h).strip()[:60] for h in high_weight[:3] if h]
        items = [it for it in items if it]
        if items:
            lines.append("- 고배점·핵심 평가:")
            for it in items:
                lines.append(f"  · {it}")

    # recurring_reqs — 3개 LIMIT, 60자 cap, 불릿
    if recurring:
        items = [str(r).strip()[:60] for r in recurring[:3] if r]
        items = [it for it in items if it]
        if items:
            lines.append("- 반복 요구사항:")
            for it in items:
                lines.append(f"  · {it}")

    # insights — 3개 LIMIT, 80자 cap, 불릿
    if insights:
        items = [str(i).strip()[:80] for i in insights[:3] if i]
        items = [it for it in items if it]
        if items:
            lines.append("- 발주처 성향:")
            for it in items:
                lines.append(f"  · {it}")

    # 헤더 외 실제 inject 줄이 없으면 통째 생략
    if len(lines) <= 1:
        return ""

    # sample_count 임계값 5 미만 시 신뢰도 안내 (마지막 줄)
    if sample_count < 5:
        lines.append(f"(분석 샘플 {sample_count}건 — 신뢰도 참고용)")

    return "\n".join(lines)


def _format_chat_block_memories(memories) -> str:
    """블록 #9 뉘앙스 메모리 (CHAT 용).

    nuance_memories 테이블 row list (PROPOSAL 30개 LIMIT → CHAT 10개로 약화).
    한국어 라벨 + 불릿 + 시간순 (PROPOSAL 패턴 정합).
    content 50자 cap. 카테고리 빈값 시 [기타] 폴백. tags 무시.

    빈 입력 / 모든 row content 빈 시 빈 문자열 (블록 통째 생략).
    """
    if not memories:
        return ""

    lines = []
    for m in memories[:10]:
        if not m:
            continue
        try:
            content = (m["content"] or "").strip()[:50]
        except (KeyError, IndexError, TypeError):
            content = ""
        if not content:
            continue
        try:
            category = (m["category"] or "").strip() or "기타"
        except (KeyError, IndexError, TypeError):
            category = "기타"
        lines.append(f"- [{category}] {content}")

    if not lines:
        return ""

    return "[대화 기억(뉘앙스) — 최근 10개]\n" + "\n".join(lines)


def _format_chat_block_refs(refs) -> str:
    """블록 #8 레퍼런스 스타일 가이드 (CHAT 용).

    references_lib row list (PROPOSAL 의 무 LIMIT → CHAT 3개로 약화).
    summary JSON 분기 / 평문 분기 둘 다 처리. JSON 은 4 핵심 필드만 압축.

    PROPOSAL 의 도형 JSON 모드 강제 표현 ("그대로 흉내내 새 제안서에 적용") 제거.
    CHAT 은 토론 컨텍스트로 자연 활용.

    빈 입력 / 모든 row 빈 summary → 빈 문자열 (블록 통째 생략).
    """
    if not refs:
        return ""

    def _extract_json_summary(parsed: dict) -> list[str]:
        """JSON summary parsed dict → CHAT inject 라인들 (핵심 4 필드만)."""
        block: list[str] = []
        if parsed.get("summary"):
            block.append(f"  요약: {str(parsed['summary'])[:120]}")
        tone = parsed.get("tone")
        if isinstance(tone, dict):
            if tone.get("governing_message"):
                block.append(f"  거버닝 톤: {str(tone['governing_message'])[:80]}")
            samples = tone.get("sample_governing")
            if isinstance(samples, list) and samples:
                joined = " | ".join(str(s).strip()[:60] for s in samples[:2] if s)
                if joined:
                    block.append(f"  거버닝 메시지 예시: {joined}")
        patterns = parsed.get("reusable_patterns")
        if isinstance(patterns, list) and patterns:
            joined = " / ".join(str(p).strip()[:50] for p in patterns[:3] if p)
            if joined:
                block.append(f"  재활용 패턴: {joined}")
        return block

    parts: list[str] = []
    for r in refs[:3]:
        if not r:
            continue
        try:
            filename = (r["filename"] or "").strip()
        except (KeyError, IndexError, TypeError):
            filename = ""
        try:
            s = (r["summary"] or "").strip()
        except (KeyError, IndexError, TypeError):
            s = ""
        if not filename and not s:
            continue

        ref_lines = [f"◆ {filename or '(파일명 없음)'}"]
        if s.startswith("{"):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, dict):
                    extracted = _extract_json_summary(parsed)
                    if extracted:
                        ref_lines.extend(extracted)
                    else:
                        ref_lines.append(f"  요약: {s[:100]}")
                else:
                    ref_lines.append(f"  요약: {s[:100]}")
            except Exception:
                ref_lines.append(f"  요약: {s[:100]}")
        elif s:
            ref_lines.append(f"  요약: {s[:100]}")

        if len(ref_lines) > 1:
            parts.extend(ref_lines)

    if not parts:
        return ""

    return "[레퍼런스 스타일 가이드 — 최근 3개]\n" + "\n".join(parts)


def _format_chat_block_intel(intel_row) -> str:
    """블록 #10 발주처 들여다보기 (CHAT 용).

    client_intel.intel_json 의 6 필드 (summary / basic_info / event_history /
    tendency / key_people / communication_tips) 압축 inject.

    PROPOSAL 의 json.dumps(indent=2) (~960자) 와 달리 한국어 라벨 + 불릿 +
    카테고리당 LIMIT/cap 적용. basic_info.official_name 은 #1 발주처 블록과
    중복 회피로 생략.

    intel.error 키 있으면 빈 문자열 (intel 수집 실패 케이스).
    """
    if not intel_row:
        return ""
    try:
        intel = json.loads(intel_row["intel_json"] or "{}")
    except Exception:
        intel = {}
    if not intel or not isinstance(intel, dict) or intel.get("error"):
        return ""

    def _format_intel_list(label: str, items, n: int, cap: int) -> list[str]:
        if not isinstance(items, list) or not items:
            return []
        cleaned = [str(x).strip()[:cap] for x in items[:n] if x]
        cleaned = [x for x in cleaned if x]
        if not cleaned:
            return []
        out = [f"- {label}:"]
        for x in cleaned:
            out.append(f"  · {x}")
        return out

    lines = ["[발주처 들여다보기]"]

    # basic_info (inline, official_name 생략 — #1 발주처 블록 중복 회피)
    bi = intel.get("basic_info")
    if isinstance(bi, dict):
        bi_parts: list[str] = []
        for k in ("type", "main_role"):
            v = (bi.get(k) or "").strip()[:80]
            if v:
                bi_parts.append(v)
        web = (bi.get("website") or "").strip()
        if web:
            bi_parts.append(web)
        if bi_parts:
            lines.append("- 기본 정보: " + " · ".join(bi_parts))

    # summary (160자)
    summary = (intel.get("summary") or "").strip()[:160]
    if summary:
        lines.append(f"- 한 줄 요약: {summary}")

    # 4 list inner helper
    lines.extend(_format_intel_list("과거 행사", intel.get("event_history"), 2, 50))
    lines.extend(_format_intel_list("성향", intel.get("tendency"), 3, 50))
    lines.extend(_format_intel_list("핵심 인물", intel.get("key_people"), 2, 30))
    lines.extend(_format_intel_list("커뮤니케이션 팁", intel.get("communication_tips"), 3, 60))

    if len(lines) <= 1:
        return ""
    return "\n".join(lines)


def _build_chat_system_prompt(client_id: str) -> str:
    """채팅용 시스템 프롬프트.

    CHAT_SYSTEM_PROMPT 정적 본문 (기획 파트너 정체성) +
    8 inject 블록 (#1 client / #2 RFP / #4 도메인 톤 / #8 refs / #9 memories /
    #10 intel / #11 profile / #13 outcomes).

    PROPOSAL/SLIDE 흐름과 분리 — 도형 JSON / RAG / 캔버스 / 색감 가이드 없음.
    api_chat (자연어 채팅) 전용. 캐시 X (PROPOSAL 패턴과 일관).
    """
    # DB 조회 (PROPOSAL 패턴 동일 — 9건)
    with get_db() as db:
        client = db.execute("SELECT * FROM clients WHERE id=?", (client_id,)).fetchone()
        refs = db.execute(
            "SELECT id, filename, summary FROM references_lib WHERE client_id=? ORDER BY created_at",
            (client_id,),
        ).fetchall()
        memories = db.execute(
            "SELECT category, content, tags FROM nuance_memories WHERE client_id=? ORDER BY created_at DESC LIMIT 30",
            (client_id,),
        ).fetchall()
        intel_row = db.execute(
            "SELECT intel_json FROM client_intel WHERE client_id=?",
            (client_id,),
        ).fetchone()
        profile_row = db.execute(
            "SELECT * FROM client_profiles WHERE client_id=?",
            (client_id,),
        ).fetchone()
        won_rows = db.execute(
            "SELECT title FROM conversations WHERE client_id=? AND outcome='won' ORDER BY updated_at DESC LIMIT 5",
            (client_id,),
        ).fetchall()
        lost_rows = db.execute(
            "SELECT title FROM conversations WHERE client_id=? AND outcome='lost' ORDER BY updated_at DESC LIMIT 5",
            (client_id,),
        ).fetchall()
    rfp_analysis = _get_rfp_aggregated(client_id)

    parts = [CHAT_SYSTEM_PROMPT]

    if (block := _format_client_block(client)):
        parts.append(block)
    if (block := _format_chat_block_rfp_summary(rfp_analysis)):
        parts.append(block)
    if (block := _format_chat_block_domain_tone(rfp_analysis)):
        parts.append(block)
    if (block := _format_chat_block_refs(refs)):
        parts.append(block)
    if (block := _format_chat_block_memories(memories)):
        parts.append(block)
    if (block := _format_chat_block_intel(intel_row)):
        parts.append(block)
    if (block := _format_chat_block_profile(profile_row)):
        parts.append(block)
    if (block := _format_chat_block_outcomes(won_rows, lost_rows)):
        parts.append(block)

    return "\n\n".join(parts)


def _build_system_prompt(client_id: str) -> str:
    """RFP 분석, 뉘앙스, 레퍼런스를 시스템 프롬프트에 주입."""
    with get_db() as db:
        client = db.execute("SELECT * FROM clients WHERE id=?", (client_id,)).fetchone()
        refs = db.execute(
            "SELECT filename,summary FROM references_lib WHERE client_id=? ORDER BY created_at",
            (client_id,),
        ).fetchall()
        memories = db.execute(
            "SELECT category,content,tags FROM nuance_memories WHERE client_id=? ORDER BY created_at DESC LIMIT 30",
            (client_id,),
        ).fetchall()

    parts = [PROPOSAL_SYSTEM_PROMPT, ""]

    if (block := _format_client_block(client)):
        parts.append(block)

    rfp_analysis = _get_rfp_aggregated(client_id)
    # 에러 블록(실제 정보 없음) 은 시스템 프롬프트에 주입하지 않음
    rfp_has_real_data = bool(rfp_analysis) and any(rfp_analysis.get(k) for k in (
        "title", "key_requirements", "evaluation_criteria", "deliverables",
        "summary", "project_domain", "budget", "deadline",
    ))
    if rfp_analysis and rfp_has_real_data:
        # orientation 기본값 강제 주입
        if not rfp_analysis.get("orientation"):
            rfp_analysis["orientation"] = "landscape"
        parts.append("[RFP 분석]\n" + json.dumps(rfp_analysis, ensure_ascii=False, indent=2))
        # 도형 JSON 모드: orientation → slide_width/slide_height 매핑
        if rfp_analysis["orientation"] == "portrait":
            parts.append("[⚠ 캔버스 방향] 도형 JSON 의 slide_width=8.27, slide_height=11.69 (A4 세로). "
                         "모든 도형 좌표·크기를 이 캔버스 안에 맞게 배치.")
        else:
            parts.append("[⚠ 캔버스 방향] 도형 JSON 의 slide_width=11.69, slide_height=8.27 (A4 가로 — 한국 B2G 표준). "
                         "RFP 가 16:9 PT 발표용 등을 명시한 경우만 다른 비율 사용.")

        # 도메인 톤 시그널 — LAYER 2 매트릭스 자동 발동
        domain = (rfp_analysis.get("project_domain") or "other").strip().lower()
        domain_label = rfp_analysis.get("project_domain_label") or ""
        tone_hint = rfp_analysis.get("project_tone_hint") or ""
        audience = rfp_analysis.get("target_audience") or ""
        valid_domains = {"festival","forum","education","sports","exhibition",
                         "campaign","tourism","rnd","welfare","other"}
        if domain not in valid_domains:
            domain = "other"
        tone_signal = [
            f"[⚠ 톤 고정 — RFP 도메인 분석 결과]",
            f"project_domain = \"{domain}\"" + (f"  ({domain_label})" if domain_label else ""),
        ]
        if tone_hint:
            tone_signal.append(f"project_tone_hint = \"{tone_hint}\"")
        if audience:
            tone_signal.append(f"target_audience = \"{audience}\"")
        tone_signal.append(
            f"\n→ PROPOSAL_SYSTEM_PROMPT 의 LAYER 2 도메인 매트릭스 중 **{domain}** 블록의 "
            "어미·어휘·레지스터·거버닝 예시·필수 페이지·Ⅳ·Ⅴ 명칭을 그대로 적용.\n"
            "LAYER 1 고정 원칙(5부 구조·숫자 상세·15종 시각화·breadcrumb·제안사 소개)은 "
            "도메인과 무관하게 동일 유지.\n"
            "레퍼런스 스타일 가이드가 함께 있으면 그 가이드가 LAYER 2 보다 우선."
        )
        # ⚠ 도메인별 색감 가이드 제거 (사용자 의도)
        # 초안 단계 = 완전 흑백 고정. 도메인은 "톤·어휘·레지스터" 만 영향, 색은 영향 X.
        tone_signal.append(
            "\n[⚠ 색감 — 절대 흑백 고정]\n"
            "  도형 fill / 텍스트 color 는 반드시 다음 5색 중에서만 선택:\n"
            "  · #1A1A1A (메인 검정)  · #444 (본문)  · #666 (소제목)\n"
            "  · #999 (메타·푸터)     · #DDD (연한 구분선·박스)  · #FFFFFF (배경·반전 텍스트)\n"
            "  → 도메인이 festival/forum/sports 어느 것이든 색은 동일. 톤만 어미·어휘로 차별화.\n"
            "  → 컬러 액센트(오렌지·블루·레드 등) 단 1개라도 들어가면 슬라이드 전체 폐기."
        )
        parts.append("\n".join(tone_signal))

        # ── RAG v2: 과거 제안서 본문 풍부 주입 ──
        # 이전엔 통계만 들어가서 "그냥 Claude 결과" 와 차이 없음 → v2 부터 본문 발췌 8개 × 800자 inline
        # rag_kb.db + OPENAI_API_KEY 가 있을 때만 동작 (둘 중 하나라도 없으면 자연 스킵)
        try:
            if rag_retriever is not None and rag_retriever.is_available():
                rag_query = rag_retriever.build_query_from_rfp(rfp_analysis)
                if rag_query:
                    rag_hints = rag_retriever.retrieve_style_hints(
                        rag_query, top_k=12, excerpt_chars=800, excerpt_count=8,
                    )
                    if rag_hints:
                        rag_block = rag_retriever.format_hints_for_prompt(rag_hints)
                        if rag_block:
                            parts.append(rag_block)
                            ex_total = sum(
                                ex.get("char_count", 0)
                                for ex in rag_hints.get("sample_excerpts", [])
                            )
                            log.info(
                                "RAG hints injected · hits=%d · 발췌=%d개 · 총 %d자 · "
                                "visuals=%s · endings=%s",
                                rag_hints["hits_count"],
                                len(rag_hints.get("sample_excerpts", [])),
                                ex_total,
                                [v[0] for v in rag_hints["visual_top"][:3]],
                                [e[0] for e in rag_hints["ending_top"][:3]],
                            )
        except Exception as _rag_err:
            log.warning("RAG hint 주입 실패 (무시): %s", _rag_err)

    # 발주처별 사용자 지정 포인트 컬러 (없으면 AI 선택)
    accent_override = get_setting(f"accent:{client_id}", "")
    if accent_override:
        parts.append(f"[⚠ 필수 준수] data-accent=\"{accent_override}\" — 발주처 지정 포인트 컬러. 이 값을 그대로 사용.")

    if refs:
        # summary 는 JSON 또는 평문 — 두 형식을 각각 처리해 "스타일 가이드" 블록 구성
        style_blocks = []
        plain_lines = []
        for r in refs:
            s = (r["summary"] or "").strip()
            if not s:
                continue
            parsed = None
            # JSON 인 경우 (새 REFERENCE_SUMMARY_PROMPT 결과물) → 스타일 가이드
            if s.startswith("{"):
                try:
                    parsed = json.loads(s)
                except Exception:
                    parsed = None
            if parsed and isinstance(parsed, dict) and ("structure" in parsed or "tone" in parsed):
                # 스타일 신호 블록 — 파일별
                block = [f"◆ 레퍼런스: {r['filename']}"]
                if parsed.get("summary"):
                    block.append(f"  요약: {parsed['summary']}")
                if isinstance(parsed.get("structure"), dict):
                    st = parsed["structure"]
                    if st.get("section_hierarchy"):
                        block.append(f"  목차: {' / '.join(st['section_hierarchy'][:12])}")
                    if st.get("breadcrumb_pattern"):
                        block.append(f"  breadcrumb 형식: {st['breadcrumb_pattern']}")
                    if st.get("cover_format"):
                        block.append(f"  표지 구성: {st['cover_format']}")
                    if st.get("total_pages"):
                        block.append(f"  대략 페이지 수: {st['total_pages']}")
                if isinstance(parsed.get("tone"), dict):
                    tn = parsed["tone"]
                    if tn.get("governing_message"):
                        block.append(f"  거버닝 톤: {tn['governing_message']}")
                    if tn.get("body_style"):
                        block.append(f"  본문 스타일: {tn['body_style']}")
                    if tn.get("sample_governing"):
                        block.append(f"  거버닝 메시지 예시: {' | '.join(tn['sample_governing'][:3])}")
                if parsed.get("visual_blocks"):
                    block.append(f"  시각 블록: {', '.join(parsed['visual_blocks'][:10])}")
                if parsed.get("must_have_pages"):
                    block.append(f"  필수 페이지: {', '.join(parsed['must_have_pages'][:10])}")
                if parsed.get("numeric_density"):
                    block.append(f"  숫자 밀도: {parsed['numeric_density']}")
                if parsed.get("signature_elements"):
                    block.append(f"  브랜딩 요소: {', '.join(parsed['signature_elements'][:6])}")
                if parsed.get("reusable_patterns"):
                    block.append(f"  재활용 패턴: {' / '.join(parsed['reusable_patterns'][:5])}")
                style_blocks.append("\n".join(block))
            else:
                # 구버전 평문 요약
                plain_lines.append(f"- {r['filename']}: {s}")

        if style_blocks:
            parts.append(
                "[레퍼런스 스타일 가이드 — 아래 스타일을 기본 프리셋보다 우선 반영]\n"
                "사용자가 업로드한 과거 제안서에서 관찰된 실제 스타일 신호다. "
                "structure / tone / visual_blocks / must_have_pages / numeric_density / signature_elements 를 "
                "그대로 흉내내 새 제안서에 적용한다.\n\n"
                + "\n\n".join(style_blocks)
            )
        if plain_lines:
            parts.append("[레퍼런스 라이브러리 — 보조 패턴]\n" + "\n".join(plain_lines))

    if memories:
        lines = [f"- [{m['category']}] {m['content']}" for m in memories]
        parts.append("[대화 기억(뉘앙스)]\n" + "\n".join(lines))

    # [제거됨] 우리 회사의 강점 주입 — 추상적 신호라 제안서 품질에 역효과 → 의도적 제외

    # 발주처 들여다보기 (자동 수집된 정보) — 있으면 주입
    with get_db() as db:
        intel_row = db.execute("SELECT intel_json FROM client_intel WHERE client_id=?", (client_id,)).fetchone()
    if intel_row:
        try:
            intel = json.loads(intel_row["intel_json"] or "{}")
        except Exception:
            intel = {}
        if intel and not intel.get("error"):
            parts.append("[발주처 들여다보기]\n" + json.dumps(intel, ensure_ascii=False, indent=2))

    # 발주처 성향 주입
    with get_db() as db:
        profile_row = db.execute("SELECT * FROM client_profiles WHERE client_id=?", (client_id,)).fetchone()
        # company DNA inject 제거 — NightOff 멀티 사용자 도구 정체성 정합
        # 승률 / 승리 사례 패턴
        won_rows = db.execute(
            "SELECT title FROM conversations WHERE client_id=? AND outcome='won' ORDER BY updated_at DESC LIMIT 5",
            (client_id,),
        ).fetchall()
        lost_rows = db.execute(
            "SELECT title FROM conversations WHERE client_id=? AND outcome='lost' ORDER BY updated_at DESC LIMIT 5",
            (client_id,),
        ).fetchall()

    if profile_row:
        try:
            p = {
                "keywords": json.loads(profile_row["keywords"] or "[]"),
                "high_weight_items": json.loads(profile_row["high_weight_items"] or "[]"),
                "recurring_reqs": json.loads(profile_row["recurring_reqs"] or "[]"),
                "insights": json.loads(profile_row["insights"] or "[]"),
            }
            parts.append("[발주처 성향 — 축적된 인사이트]\n" + json.dumps(p, ensure_ascii=False, indent=2))
        except Exception:
            pass

    if won_rows or lost_rows:
        lines = []
        if won_rows:
            lines.append("✅ 승리 사례: " + ", ".join(r["title"] for r in won_rows))
        if lost_rows:
            lines.append("❌ 패배 사례: " + ", ".join(r["title"] for r in lost_rows))
        parts.append("[승패 기록 — 승리 패턴 우선 반영, 패배 원인 회피]\n" + "\n".join(lines))

    # [마스터 슬롯 가이드] — DEPRECATED (도형 JSON 모드에서는 사용 안 함)
    # placeholder/master 매핑 모드 폴백 시에만 의미가 있어 주입 비활성화.
    # 환경변수 ENABLE_MASTER_SLOT_GUIDE=1 일 때만 (legacy 디버그용) 주입.
    try:
        import pptx_generator as _pg
        master_path = _pg.find_master_template() if os.environ.get("ENABLE_MASTER_SLOT_GUIDE") == "1" else None
        if master_path and master_path.exists():
            slots = _master_slot_cache_get(master_path)
            if slots:
                # 마커가 있는 슬라이드가 있을 때만 주입 (placeholder 모드 마스터)
                has_markers = any(s.get("markers") for s in slots)
                if has_markers:
                    guide_text = _pg.format_slot_guide_for_prompt(slots)
                    if guide_text:
                        parts.append(guide_text)
    except Exception as e:
        log.warning("마스터 슬롯 가이드 주입 실패 (무시): %s", e)

    return "\n\n".join(parts)


# 마스터 슬롯 추출 캐시 — mtime 기반 invalidation
_MASTER_SLOT_CACHE: dict[str, tuple[float, list[dict]]] = {}


def _master_slot_cache_get(master_path) -> list[dict]:
    """마스터 슬롯 가이드 — mtime 캐시. 마스터 안 바뀌면 1회만 추출."""
    import pptx_generator as _pg
    key = str(master_path)
    try:
        mtime = master_path.stat().st_mtime
    except Exception:
        mtime = 0
    cached = _MASTER_SLOT_CACHE.get(key)
    if cached and cached[0] == mtime:
        return cached[1]
    slots = _pg.extract_master_slot_guide(master_path)
    _MASTER_SLOT_CACHE[key] = (mtime, slots)
    log.info("마스터 슬롯 추출 · %s · 슬라이드 %d (마커 있는 %d)",
             master_path.name, len(slots),
             sum(1 for s in slots if s.get("markers")))
    return slots


@app.post("/api/conversations/{conv_id}/chat")
def api_chat(conv_id: str, body: ChatIn):
    with get_db() as db:
        conv = db.execute("SELECT * FROM conversations WHERE id=?", (conv_id,)).fetchone()
        if not conv:
            raise HTTPException(404, "대화를 찾을 수 없습니다.")
        client_id = conv["client_id"]

        # 사용자 메시지 저장
        user_msg_id = uuid.uuid4().hex[:12]
        db.execute(
            "INSERT INTO messages(id,conversation_id,role,content) VALUES(?,?,?,?)",
            (user_msg_id, conv_id, "user", body.message),
        )
        # 대화 제목이 기본값이면 첫 메시지에서 파생
        if conv["title"] == "새 대화":
            new_title = body.message.strip().split("\n")[0][:40] or "새 대화"
            db.execute("UPDATE conversations SET title=?, updated_at=datetime('now','localtime') WHERE id=?",
                       (new_title, conv_id))
        else:
            db.execute("UPDATE conversations SET updated_at=datetime('now','localtime') WHERE id=?", (conv_id,))

        # 전체 히스토리 가져와 Claude 호출
        hist = db.execute(
            "SELECT role,content FROM messages WHERE conversation_id=? ORDER BY created_at",
            (conv_id,),
        ).fetchall()

    # 자연어 채팅 = 전략 토론 모드 → CHAT_SYSTEM_PROMPT 사용 (PROPOSAL 분리)
    system_prompt = _build_chat_system_prompt(client_id)
    messages = [{"role": m["role"], "content": m["content"]} for m in hist if m["content"]]

    try:
        client = require_client()
    except HTTPException as e:
        def err_stream():
            yield f"data: {json.dumps({'type':'error','error':e.detail})}\n\n"
        return StreamingResponse(err_stream(), media_type="text/event-stream")

    def stream():
        assistant_id = uuid.uuid4().hex[:12]
        yield f"data: {json.dumps({'type':'start','message_id':assistant_id})}\n\n"
        full_text = ""
        try:
            # [중요] 채팅 본문 생성에는 web_search 도구 미사용
            # — 사용자 의도: '발주처 들여다보기는 분리. 본문 생성에 영향 X'
            # — web_search 결과의 <cite index="..."> 태그가 JSON 본문에 박히는 것 방지
            with client.messages.stream(
                model=get_setting("model", MODEL_DEFAULT),
                max_tokens=16000,
                system=system_prompt,
                messages=messages,
            ) as s:
                for chunk in s.text_stream:
                    full_text += chunk
                    yield f"data: {json.dumps({'type':'delta','text':chunk})}\n\n"
            yield f"data: {json.dumps({'type':'done'})}\n\n"
        except anthropic.APIError as e:
            log.warning("스트리밍 Anthropic 오류: %s", e)
            msg = translate_anthropic_error(e)
            yield f"data: {json.dumps({'type':'error','error':msg})}\n\n"
        except Exception as e:
            log.exception("스트리밍 예외")
            yield f"data: {json.dumps({'type':'error','error':'잠시 문제가 생겼어요. 다시 시도해 주세요.'})}\n\n"
        finally:
            with get_db() as db:
                db.execute(
                    "INSERT INTO messages(id,conversation_id,role,content) VALUES(?,?,?,?)",
                    (assistant_id, conv_id, "assistant", full_text),
                )

    return StreamingResponse(stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Multi-pass 제안서 생성 — Outline → 슬라이드별 도형 JSON → 병합
# ---------------------------------------------------------------------------
@app.post("/api/conversations/{conv_id}/proposals/generate")
async def api_proposals_generate_multipass(conv_id: str):
    """
    Multi-pass 제안서 생성. SSE 로 진행률 실시간 push.

    흐름:
      1. RFP / RAG / 발주처 인텔 모아서 system block 들 만들기
      2. proposal_multi_pass.orchestrate() 호출
      3. 각 이벤트를 SSE 로 yield
      4. 완료시 도형 JSON 을 messages 에 assistant 메시지로 저장
         → 사용자가 PPTX 다운로드 누르면 기존 api_proposals_pptx 가 그대로 처리

    UI 측: SSE 받으면서 "목차 작성 중 → 슬라이드 1/28 ... → 병합 → 완료" 표시.
    """
    import asyncio as _asyncio
    import proposal_multi_pass as mp

    with get_db() as db:
        conv = db.execute("SELECT * FROM conversations WHERE id=?", (conv_id,)).fetchone()
        if not conv:
            raise HTTPException(404, "대화를 찾을 수 없습니다.")
        client_id = conv["client_id"]
    # company_name inject 제거 (한국 공공입찰 청렴제 — 본문 회사명 등장 비정상)

    # RFP 분석 결과만 추출 — multi-pass orchestrator 가 자체 OUTLINE/SLIDE 프롬프트 사용
    # (이전 system_full = _build_system_prompt(...) 호출 dead code 제거)
    rfp_analysis = _get_rfp_aggregated(client_id)

    # RAG global 블록 (Phase 1 outline 호출용)
    rag_block_global = ""
    try:
        if rag_retriever is not None and rag_retriever.is_available():
            rfp_query = rag_retriever.build_query_from_rfp(rfp_analysis or {})
            if rfp_query:
                hints = rag_retriever.retrieve_style_hints(
                    rfp_query, top_k=12, excerpt_chars=800, excerpt_count=8,
                )
                if hints:
                    rag_block_global = rag_retriever.format_hints_for_prompt(hints)
    except Exception as e:
        log.warning("multi-pass: RAG global 블록 실패 (무시): %s", e)

    # 슬라이드별 RAG 블록 생성 callback
    def _rag_for_slide(item: mp.OutlineItem) -> str:
        if not (rag_retriever is not None and rag_retriever.is_available()):
            return ""
        try:
            domain_label = (rfp_analysis or {}).get("project_domain_label", "")
            q = rag_retriever.build_query_from_slide(
                section=item.section,
                key_msgs=item.key_msgs,
                domain_label=domain_label,
                governing=item.governing,
            )
            if not q:
                return ""
            # 슬라이드별 검색은 chunk 적게·길게 (한 슬라이드에 너무 많이 박지 X)
            hints = rag_retriever.retrieve_style_hints(
                q, top_k=8, excerpt_chars=900, excerpt_count=4,
            )
            if not hints:
                return ""
            return rag_retriever.format_hints_for_prompt(hints)
        except Exception as e:
            log.warning("multi-pass: 슬라이드 RAG 실패 (p%d): %s", item.page, e)
            return ""

    # RFP 본문 블록 (Phase 1 user prompt 에 들어감)
    rfp_block = "[RFP 분석]\n" + json.dumps(rfp_analysis or {}, ensure_ascii=False, indent=2)

    # 발주처 인텔
    intel_block = ""
    try:
        with get_db() as db:
            intel_row = db.execute(
                "SELECT intel_json FROM client_intel WHERE client_id=?",
                (client_id,),
            ).fetchone()
        if intel_row:
            intel_obj = json.loads(intel_row["intel_json"] or "{}")
            if intel_obj and not intel_obj.get("error"):
                intel_block = "[발주처 들여다보기]\n" + json.dumps(intel_obj, ensure_ascii=False, indent=2)
    except Exception:
        intel_block = ""

    # 사용자 메시지 저장 ("제안서 만들어줘" 명시 메시지로)
    user_msg_id = uuid.uuid4().hex[:12]
    with get_db() as db:
        db.execute(
            "INSERT INTO messages(id,conversation_id,role,content) VALUES(?,?,?,?)",
            (user_msg_id, conv_id, "user", "[multi-pass 제안서 생성 요청]"),
        )

    try:
        client = require_client()
    except HTTPException as e:
        async def err_stream():
            yield f"data: {json.dumps({'type':'error','error':e.detail})}\n\n"
        return StreamingResponse(err_stream(), media_type="text/event-stream")

    model = get_setting("model", MODEL_DEFAULT)

    async def stream():
        assistant_id = uuid.uuid4().hex[:12]
        yield f"data: {json.dumps({'type':'start','message_id':assistant_id})}\n\n"
        final_payload = None
        try:
            async for ev in mp.orchestrate(
                client=client,
                rfp_block=rfp_block,
                rag_block_global=rag_block_global,
                rag_for_slide=_rag_for_slide,
                intel_block=intel_block,
                extra_block="",
                concurrency=5,
                model=model,
            ):
                if ev.get("type") == "done":
                    final_payload = ev.get("payload")
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except Exception as e:
            log.exception("multi-pass 예외")
            yield f"data: {json.dumps({'type':'error','error':str(e)[:200]})}\n\n"
            return
        finally:
            # 완성된 도형 JSON 을 assistant 메시지로 저장 (api_proposals_pptx 가 읽음)
            if final_payload:
                try:
                    with get_db() as db:
                        db.execute(
                            "INSERT INTO messages(id,conversation_id,role,content) VALUES(?,?,?,?)",
                            (assistant_id, conv_id, "assistant",
                             json.dumps(final_payload, ensure_ascii=False)),
                        )
                except Exception as e:
                    log.warning("multi-pass: assistant 메시지 저장 실패: %s", e)

    return StreamingResponse(stream(), media_type="text/event-stream")


# ---------- RFP (multi-file, role-aware) ----------
VALID_ROLES = {"공고문", "과업지시서", "제안요청서", "기타"}


def _run_rfp_aggregate(cid: str) -> dict:
    """현재 client의 rfp_files 전체를 role과 함께 하나의 프롬프트로 묶어 분석."""
    with get_db() as db:
        files = db.execute(
            "SELECT role,filename,raw_text FROM rfp_files WHERE client_id=? ORDER BY created_at",
            (cid,),
        ).fetchall()
    if not files:
        with get_db() as db:
            db.execute("DELETE FROM rfp_aggregated WHERE client_id=?", (cid,))
        return {}

    # 역할별 텍스트 조합 (공고문 → 과업지시서 → 제안요청서 → 기타 순서)
    role_order = {"공고문": 0, "과업지시서": 1, "제안요청서": 2, "기타": 3}
    sorted_files = sorted(files, key=lambda f: role_order.get(f["role"], 4))
    parts = []
    total_len = 0
    LIMIT = 45000  # 안전 토큰 버짓
    for f in sorted_files:
        header = f"[ROLE: {f['role']} — FILE: {f['filename']}]"
        body = (f["raw_text"] or "").strip()
        remaining = LIMIT - total_len - len(header) - 10
        if remaining <= 200:
            break
        body = body[:remaining]
        parts.append(f"{header}\n{body}")
        total_len += len(header) + len(body) + 10
    combined = "\n\n\n".join(parts) or "(본문 추출 실패)"

    analysis: dict = {}
    try:
        client = require_client()
        prompt = RFP_ANALYSIS_PROMPT.replace("{RFP_TEXT}", combined)
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        if not raw:
            raise ValueError("AI가 빈 응답을 반환했어요 — 파일 본문 추출 실패 또는 토큰 한도 초과일 수 있어요.")
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        analysis = json.loads(raw)
    except anthropic.APIError as e:
        log.warning("RFP 통합 분석 Anthropic 오류: %s", e)
        analysis = {"error": translate_anthropic_error(e)}
    except json.JSONDecodeError as e:
        log.warning("RFP 통합 분석 JSON 파싱 실패: %s · 원본 앞 200자: %s", e, (raw or "")[:200])
        analysis = {"error": "AI 응답을 이해하지 못했어요 (JSON 파싱 실패). 다시 시도해 주세요."}
    except ValueError as e:
        log.warning("RFP 통합 분석 값 오류: %s", e)
        analysis = {"error": str(e)}
    except Exception as e:
        log.exception("RFP 통합 분석 예외")
        analysis = {"error": f"RFP 분석 중 문제가 생겼어요 ({type(e).__name__}: {str(e)[:100]})"}

    # orientation 기본값 강제 — 명시 없으면 무조건 landscape
    if not analysis.get("orientation") or analysis.get("orientation") not in ("landscape", "portrait"):
        analysis["orientation"] = "landscape"

    # 에러만 있는 분석(실제 정보 없음)은 DB 저장 시 기존 좋은 분석을 덮어쓰지 않도록 가드.
    # 실제 정보 한 가지라도 있어야 저장 — 실패 시엔 메모리에서만 반환하고 DB 는 그대로.
    has_real_data = any(analysis.get(k) for k in (
        "title", "key_requirements", "evaluation_criteria", "deliverables",
        "summary", "project_domain", "budget", "deadline",
    ))
    if has_real_data:
        with get_db() as db:
            db.execute(
                "INSERT INTO rfp_aggregated(client_id,analysis_json,updated_at) VALUES(?,?,datetime('now','localtime')) "
                "ON CONFLICT(client_id) DO UPDATE SET analysis_json=excluded.analysis_json, updated_at=excluded.updated_at",
                (cid, json.dumps(analysis, ensure_ascii=False)),
            )
            # 발주처(공고기관) 자동 추출 → clients.organization 에 저장
            # — 들여다보기 검색은 이 값만 사용 (과업명 영향 X)
            org = (analysis.get("organization") or "").strip()
            # 의심값 사전 차단 (test/sample/예시 등)
            _SUSPICIOUS_ORG = {"test", "TEST", "테스트", "샘플", "sample", "SAMPLE",
                               "예시", "example", "TBD", "tbd", "n/a", "N/A",
                               "발주처", "공고기관", "기관명", "-", "--", ".", ".."}
            if org in _SUSPICIOUS_ORG or len(org.strip(".-_ ")) < 2:
                log.warning("RFP 분석 organization 의심값 무시 · client=%s · org=%r", cid[:12], org)
                org = ""
            if org and len(org) >= 2:
                try:
                    db.execute("UPDATE clients SET organization=? WHERE id=?", (org, cid))
                    log.info("발주처 자동 추출 · client=%s · org=%r", cid[:12], org)
                except Exception as e:
                    log.warning("clients.organization 저장 실패 (무시): %s", e)
            else:
                log.info("발주처 자동 추출 실패/공백 · client=%s · raw=%r",
                         cid[:12], analysis.get("organization"))

    # 프로파일 자동 업데이트 (best-effort, 실패해도 RFP 분석은 유지)
    try:
        _rebuild_client_profile(cid, rfp_analysis=analysis)
    except Exception as e:
        log.warning("프로파일 자동 업데이트 실패: %s", e)

    return analysis


def _rebuild_client_profile(cid: str, rfp_analysis: Optional[dict] = None) -> dict:
    """RFP 분석 + 최근 대화 + 기존 프로파일 → 누적 프로파일."""
    with get_db() as db:
        existing_row = db.execute("SELECT * FROM client_profiles WHERE client_id=?", (cid,)).fetchone()
        existing = {}
        if existing_row:
            for k in ("keywords", "high_weight_items", "recurring_reqs", "insights"):
                try: existing[k] = json.loads(existing_row[k] or "[]")
                except Exception: existing[k] = []
        msgs = db.execute(
            "SELECT role,content FROM messages m "
            "JOIN conversations cv ON cv.id=m.conversation_id WHERE cv.client_id=? "
            "ORDER BY m.created_at DESC LIMIT 50",
            (cid,),
        ).fetchall()
        rfp_json = rfp_analysis
        if rfp_json is None:
            row = db.execute("SELECT analysis_json FROM rfp_aggregated WHERE client_id=?", (cid,)).fetchone()
            if row:
                try: rfp_json = json.loads(row["analysis_json"] or "{}")
                except Exception: rfp_json = {}

    conv_text = "\n".join(f"[{m['role']}] {m['content'][:200]}" for m in msgs if m["content"])[:6000]
    rfp_text = json.dumps(rfp_json or {}, ensure_ascii=False)[:4000]
    existing_text = json.dumps(existing or {}, ensure_ascii=False)[:2000]

    if not conv_text and not (rfp_json or {}).get("key_requirements"):
        return {}

    try:
        client = require_client()
        prompt = (CLIENT_PROFILE_PROMPT
                  .replace("{EXISTING}", existing_text or "{}")
                  .replace("{RFP}", rfp_text or "{}")
                  .replace("{CONV}", conv_text or "(대화 없음)"))
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
    except Exception as e:
        log.warning("프로파일 추출 실패: %s", e)
        return existing

    with get_db() as db:
        db.execute(
            "INSERT INTO client_profiles(client_id,keywords,high_weight_items,recurring_reqs,insights,sample_count,updated_at) "
            "VALUES(?,?,?,?,?,COALESCE((SELECT sample_count FROM client_profiles WHERE client_id=?), 0) + 1, datetime('now','localtime')) "
            "ON CONFLICT(client_id) DO UPDATE SET "
            "keywords=excluded.keywords, high_weight_items=excluded.high_weight_items, "
            "recurring_reqs=excluded.recurring_reqs, insights=excluded.insights, "
            "sample_count=client_profiles.sample_count + 1, updated_at=excluded.updated_at",
            (cid,
             json.dumps(data.get("keywords") or [], ensure_ascii=False),
             json.dumps(data.get("high_weight_items") or [], ensure_ascii=False),
             json.dumps(data.get("recurring_reqs") or [], ensure_ascii=False),
             json.dumps(data.get("insights") or [], ensure_ascii=False),
             cid),
        )
    return data


def _rebuild_company_dna() -> dict:
    """모든 발주처의 레퍼런스 요약을 통합해 회사 DNA 추출."""
    with get_db() as db:
        refs = db.execute(
            "SELECT filename,summary FROM references_lib WHERE summary != '' ORDER BY created_at DESC LIMIT 30"
        ).fetchall()
        existing_row = db.execute("SELECT * FROM company_dna WHERE id=1").fetchone()
        existing = {}
        if existing_row:
            for k in ("signature_phrases", "strength_keywords", "strategy_patterns"):
                try: existing[k] = json.loads(existing_row[k] or "[]")
                except Exception: existing[k] = []
            existing["tone_style"] = existing_row["tone_style"] or ""

    if not refs:
        with get_db() as db:
            db.execute("DELETE FROM company_dna WHERE id=1")
        return {}

    # summary 컬럼은 새 포맷이면 JSON, 구 포맷이면 평문.
    # DNA 추출 프롬프트에는 사람이 읽을 수 있는 요약만 추려서 넣는다.
    summary_lines: list[str] = []
    for r in refs:
        s = (r["summary"] or "").strip()
        if not s:
            continue
        plain = s
        if s.startswith("{"):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, dict):
                    bits = []
                    if parsed.get("summary"):
                        bits.append(parsed["summary"])
                    patterns = parsed.get("reusable_patterns") or []
                    if patterns:
                        bits.append("패턴: " + " / ".join(patterns[:3]))
                    sigs = parsed.get("signature_elements") or []
                    if sigs:
                        bits.append("브랜딩: " + ", ".join(sigs[:4]))
                    plain = " | ".join(bits) or s[:200]
            except Exception:
                plain = s[:200]
        summary_lines.append(f"- {r['filename']}: {plain}")
    summaries_text = "\n".join(summary_lines)[:8000]
    if not summaries_text:
        with get_db() as db:
            db.execute("DELETE FROM company_dna WHERE id=1")
        return {}
    try:
        client = require_client()
        prompt = (COMPANY_DNA_PROMPT
                  .replace("{EXISTING}", json.dumps(existing, ensure_ascii=False) or "{}")
                  .replace("{SUMMARIES}", summaries_text))
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
    except Exception as e:
        log.warning("회사 DNA 추출 실패: %s", e)
        return existing

    with get_db() as db:
        db.execute(
            "INSERT INTO company_dna(id,signature_phrases,strength_keywords,strategy_patterns,tone_style,sample_count,updated_at) "
            "VALUES(1,?,?,?,?,?,datetime('now','localtime')) "
            "ON CONFLICT(id) DO UPDATE SET "
            "signature_phrases=excluded.signature_phrases, strength_keywords=excluded.strength_keywords, "
            "strategy_patterns=excluded.strategy_patterns, tone_style=excluded.tone_style, "
            "sample_count=excluded.sample_count, updated_at=excluded.updated_at",
            (json.dumps(data.get("signature_phrases") or [], ensure_ascii=False),
             json.dumps(data.get("strength_keywords") or [], ensure_ascii=False),
             json.dumps(data.get("strategy_patterns") or [], ensure_ascii=False),
             data.get("tone_style") or "",
             len(refs)),
        )
    return data


async def _save_rfp_file(cid: str, file: UploadFile, role: str) -> dict:
    content = await read_and_validate_upload(file, allowed_exts=ALLOWED_UPLOAD_EXTS)
    safe_name = re.sub(r"[^\w\.\-가-힣]", "_", file.filename or "rfp")
    save_path = UPLOADS_DIR / f"{cid}_rfp_{uuid.uuid4().hex[:6]}_{safe_name}"
    try:
        save_path.write_bytes(content)
    except OSError as e:
        log.exception("RFP 파일 저장 실패")
        raise HTTPException(500, "파일을 저장하지 못했어요. 디스크 상태를 확인해 주세요.") from e
    text = extract_text(save_path)[:40000]
    fid = uuid.uuid4().hex[:12]
    with get_db() as db:
        db.execute(
            "INSERT INTO rfp_files(id,client_id,filename,filepath,role,raw_text) VALUES(?,?,?,?,?,?)",
            (fid, cid, file.filename or safe_name, str(save_path),
             role if role in VALID_ROLES else "기타", text),
        )
    return {"id": fid, "filename": file.filename or safe_name, "role": role, "filesize": len(content)}


@app.post("/api/clients/{cid}/rfp")
async def api_rfp_upload_single(cid: str, file: UploadFile = File(...), role: str = Form("기타")):
    """단일 파일 업로드 (기존 호환). role 없으면 기타."""
    with get_db() as db:
        c = db.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone()
        if not c:
            raise HTTPException(404, "발주처를 찾을 수 없습니다.")
    info = await _save_rfp_file(cid, file, role)
    # 갈래 1: 과업 분석
    analysis = _run_rfp_aggregate(cid)
    # 갈래 2: 발주처 들여다보기 자동 수집 (실패해도 분석은 유지)
    intel = {}
    try:
        intel = _run_client_intel(cid)
    except Exception as e:
        log.warning("발주처 정보 자동 수집 실패: %s", e)
        intel = {"error": str(e)[:200]}
    return {"ok": True, "file": info, "analysis": analysis, "intel": intel}


@app.post("/api/clients/{cid}/rfp/upload")
async def api_rfp_upload_multi(
    cid: str,
    files: list[UploadFile] = File(...),
    roles: str = Form("[]"),
):
    """여러 파일 동시 업로드. roles는 JSON 배열 문자열 (각 파일의 역할)."""
    with get_db() as db:
        c = db.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone()
        if not c:
            raise HTTPException(404, "발주처를 찾을 수 없습니다.")

    try:
        role_list = json.loads(roles) if roles else []
    except Exception:
        role_list = []

    saved = []
    for idx, f in enumerate(files):
        role = role_list[idx] if idx < len(role_list) else "기타"
        info = await _save_rfp_file(cid, f, role)
        saved.append(info)

    # 갈래 1: 과업 분석 (기존 RFP 분석)
    analysis = _run_rfp_aggregate(cid)
    # 갈래 2: 발주처 들여다보기 — 자동 수집 (실패해도 RFP 분석은 유지)
    intel = {}
    try:
        intel = _run_client_intel(cid)
    except Exception as e:
        log.warning("발주처 정보 자동 수집 실패: %s", e)
        intel = {"error": str(e)[:200]}
    return {"ok": True, "files": saved, "analysis": analysis, "intel": intel}


@app.get("/api/clients/{cid}/rfp")
def api_rfp_get(cid: str):
    with get_db() as db:
        files = db.execute(
            "SELECT id,filename,role,created_at FROM rfp_files WHERE client_id=? ORDER BY created_at",
            (cid,),
        ).fetchall()
        agg_row = db.execute("SELECT analysis_json FROM rfp_aggregated WHERE client_id=?", (cid,)).fetchone()
    if not files:
        return {"has_rfp": False, "files": [], "analysis": {}}
    analysis = {}
    if agg_row and agg_row["analysis_json"]:
        try:
            analysis = json.loads(agg_row["analysis_json"])
        except Exception:
            pass
    return {
        "has_rfp": True,
        "files": [dict(f) for f in files],
        "analysis": analysis,
    }


class RfpRoleUpdate(BaseModel):
    role: str


@app.patch("/api/clients/{cid}/rfp/files/{fid}")
def api_rfp_update_role(cid: str, fid: str, body: RfpRoleUpdate):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, f"역할은 {', '.join(VALID_ROLES)} 중 하나여야 해요.")
    with get_db() as db:
        cur = db.execute("UPDATE rfp_files SET role=? WHERE id=? AND client_id=?",
                         (body.role, fid, cid))
        if cur.rowcount == 0:
            raise HTTPException(404, "파일을 찾을 수 없습니다.")
    analysis = _run_rfp_aggregate(cid)
    # 역할 변경 후에도 발주처 들여다보기 갱신 (RFP 제목 등이 바뀔 수 있음)
    intel = {}
    try:
        intel = _run_client_intel(cid)
    except Exception as e:
        log.warning("발주처 정보 자동 수집 실패 (PATCH): %s", e)
        intel = {"error": str(e)[:200]}
    return {"ok": True, "analysis": analysis, "intel": intel}


@app.delete("/api/clients/{cid}/rfp/files/{fid}")
def api_rfp_delete_file(cid: str, fid: str):
    with get_db() as db:
        row = db.execute("SELECT filepath FROM rfp_files WHERE id=? AND client_id=?", (fid, cid)).fetchone()
        if not row:
            raise HTTPException(404, "파일을 찾을 수 없습니다.")
        if row["filepath"]:
            try:
                Path(row["filepath"]).unlink(missing_ok=True)
            except Exception:
                pass
        db.execute("DELETE FROM rfp_files WHERE id=? AND client_id=?", (fid, cid))
    analysis = _run_rfp_aggregate(cid)
    return {"ok": True, "analysis": analysis}


@app.delete("/api/clients/{cid}/rfp")
def api_rfp_delete_all(cid: str):
    with get_db() as db:
        rows = db.execute("SELECT filepath FROM rfp_files WHERE client_id=?", (cid,)).fetchall()
        for r in rows:
            if r["filepath"]:
                try:
                    Path(r["filepath"]).unlink(missing_ok=True)
                except Exception:
                    pass
        db.execute("DELETE FROM rfp_files WHERE client_id=?", (cid,))
        db.execute("DELETE FROM rfp_aggregated WHERE client_id=?", (cid,))
        # 구 테이블 정리
        old = db.execute("SELECT filepath FROM rfp_docs WHERE client_id=?", (cid,)).fetchone()
        if old and old["filepath"]:
            try:
                Path(old["filepath"]).unlink(missing_ok=True)
            except Exception:
                pass
        db.execute("DELETE FROM rfp_docs WHERE client_id=?", (cid,))
    return {"ok": True}


# ---------- Reference Library ----------
@app.get("/api/clients/{cid}/references")
def api_refs_list(cid: str):
    with get_db() as db:
        rows = db.execute(
            "SELECT id,filename,filetype,filesize,summary,created_at FROM references_lib "
            "WHERE client_id=? ORDER BY created_at DESC",
            (cid,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/clients/{cid}/references")
async def api_refs_upload(cid: str, file: UploadFile = File(...)):
    with get_db() as db:
        c = db.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone()
        if not c:
            raise HTTPException(404, "발주처를 찾을 수 없습니다.")

    content = await read_and_validate_upload(file, allowed_exts=ALLOWED_UPLOAD_EXTS)
    safe_name = re.sub(r"[^\w\.\-가-힣]", "_", file.filename or "ref")
    save_path = UPLOADS_DIR / f"{cid}_ref_{uuid.uuid4().hex[:6]}_{safe_name}"
    try:
        save_path.write_bytes(content)
    except OSError as e:
        log.exception("레퍼런스 파일 저장 실패")
        raise HTTPException(500, "파일을 저장하지 못했어요. 디스크 상태를 확인해 주세요.") from e

    text = extract_text(save_path)[:20000]

    # 레퍼런스 스타일 분석 — JSON 전체를 저장하여 _build_system_prompt 에서 구조적으로 재사용
    summary = ""
    try:
        client = require_client()
        prompt = REFERENCE_SUMMARY_PROMPT.replace("{DOC_TEXT}", text or "(추출 실패)")
        # 스타일 신호가 많아 3~4KB 정도 필요 — max_tokens 넉넉히
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=3500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        # JSON 유효성 검증만 하고 원문 그대로 저장
        data = json.loads(raw)
        summary = json.dumps(data, ensure_ascii=False)  # DB 에 compact JSON 저장
    except HTTPException:
        raise
    except Exception as e:
        # 분석 실패 시 짧은 플레인 메시지 저장
        summary = f"자동 요약 실패 ({e})"

    ref_id = uuid.uuid4().hex[:12]
    with get_db() as db:
        db.execute(
            "INSERT INTO references_lib(id,client_id,filename,filepath,filetype,filesize,summary) "
            "VALUES(?,?,?,?,?,?,?)",
            (
                ref_id, cid, file.filename or safe_name, str(save_path),
                (save_path.suffix.lstrip(".").upper() or "FILE"),
                len(content), summary,
            ),
        )

    # 회사 DNA 자동 업데이트 (best-effort)
    try:
        _rebuild_company_dna()
    except Exception as e:
        log.warning("DNA 자동 업데이트 실패: %s", e)

    return {"ok": True, "id": ref_id, "summary": summary, "filesize_h": human_size(len(content))}


@app.delete("/api/references/{ref_id}")
def api_ref_delete(ref_id: str):
    with get_db() as db:
        row = db.execute("SELECT filepath FROM references_lib WHERE id=?", (ref_id,)).fetchone()
        if row and row["filepath"]:
            try:
                Path(row["filepath"]).unlink(missing_ok=True)
            except Exception:
                pass
        db.execute("DELETE FROM references_lib WHERE id=?", (ref_id,))
    # DNA 재구성 (파일 삭제 반영)
    try:
        _rebuild_company_dna()
    except Exception:
        pass
    return {"ok": True}


# ---------- Client Profile + Company DNA + Outcome endpoints ----------
@app.get("/api/clients/{cid}/profile")
def api_client_profile_get(cid: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM client_profiles WHERE client_id=?", (cid,)).fetchone()
        # 승률 계산 — 이 발주처 대화 중 won/lost 기준
        outcomes = db.execute(
            "SELECT outcome, COUNT(*) c FROM conversations WHERE client_id=? AND outcome IN ('won','lost') GROUP BY outcome",
            (cid,),
        ).fetchall()
    win = next((o["c"] for o in outcomes if o["outcome"] == "won"), 0)
    lose = next((o["c"] for o in outcomes if o["outcome"] == "lost"), 0)
    total = win + lose
    if not row:
        return {"exists": False, "win": win, "lose": lose, "win_rate": None}
    data = {
        "exists": True,
        "keywords": json.loads(row["keywords"] or "[]"),
        "high_weight_items": json.loads(row["high_weight_items"] or "[]"),
        "recurring_reqs": json.loads(row["recurring_reqs"] or "[]"),
        "insights": json.loads(row["insights"] or "[]"),
        "sample_count": row["sample_count"],
        "updated_at": row["updated_at"],
        "win": win,
        "lose": lose,
        "win_rate": round(win / total * 100) if total else None,
    }
    return data


@app.post("/api/clients/{cid}/profile/rebuild")
def api_client_profile_rebuild(cid: str):
    data = _rebuild_client_profile(cid)
    return {"ok": True, "data": data}


@app.get("/api/company-dna")
def api_company_dna_get():
    with get_db() as db:
        row = db.execute("SELECT * FROM company_dna WHERE id=1").fetchone()
        ref_count = db.execute("SELECT COUNT(*) c FROM references_lib").fetchone()["c"]
    if not row:
        return {"exists": False, "ref_count": ref_count}
    return {
        "exists": True,
        "signature_phrases": json.loads(row["signature_phrases"] or "[]"),
        "strength_keywords": json.loads(row["strength_keywords"] or "[]"),
        "strategy_patterns": json.loads(row["strategy_patterns"] or "[]"),
        "tone_style": row["tone_style"],
        "sample_count": row["sample_count"],
        "updated_at": row["updated_at"],
        "ref_count": ref_count,
    }


@app.post("/api/company-dna/rebuild")
def api_company_dna_rebuild():
    data = _rebuild_company_dna()
    return {"ok": True, "data": data}


class OutcomeIn(BaseModel):
    outcome: str


@app.patch("/api/conversations/{conv_id}/outcome")
def api_conv_outcome(conv_id: str, body: OutcomeIn):
    valid = {"", "in_progress", "won", "lost"}
    if body.outcome not in valid:
        raise HTTPException(400, "상태는 (빈값/in_progress/won/lost) 중 하나여야 해요.")
    with get_db() as db:
        cur = db.execute("UPDATE conversations SET outcome=?, updated_at=datetime('now','localtime') WHERE id=?",
                         (body.outcome, conv_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "대화를 찾을 수 없습니다.")
    return {"ok": True, "outcome": body.outcome}


# ---------- Users / 간편 가입 (이메일만) ----------
class SignupIn(BaseModel):
    email: str
    company: str = ""


@app.post("/api/signup")
def api_signup(body: SignupIn):
    email = body.email.strip().lower()
    if "@" not in email or len(email) < 5:
        raise HTTPException(400, "이메일 형식을 확인해 주세요.")
    company = body.company.strip()
    with get_db() as db:
        row = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
        if row:
            db.execute("UPDATE users SET last_login=datetime('now','localtime') WHERE email=?", (email,))
            return {"ok": True, "returning": True, "email": email}
        uid = uuid.uuid4().hex[:12]
        db.execute(
            "INSERT INTO users(id,email,company,last_login) VALUES(?,?,?,datetime('now','localtime'))",
            (uid, email, company),
        )
    return {"ok": True, "returning": False, "email": email, "id": uid}


# ---------- 산출내역서 생성 ----------
BUDGET_TABLE_PROMPT = """당신은 용역/행사 분야 산출내역서(Cost Breakdown) 작성 전문가입니다.
아래 제안서/RFP 컨텍스트를 분석해서 과업 성격에 맞는 대분류를 자동 설정하고,
각 대분류별 세부 항목을 업계 평균 시세 기반으로 작성하세요.

컨텍스트:
---
{CONTEXT}
---

고정 양식 (열): 구분 → 항목 → 세부내역 → 단가 → 수량 → 단위 → 기간 → 투입율 → 금액 → 비고

JSON 스키마 (금액·단가는 원 단위 정수):
{
  "title": "사업/용역 명칭",
  "categories": [
    {
      "name": "대분류 (AI 자동 설정 — 예: 기획/컨셉, 무대/음향/조명, 홍보·마케팅,
              운영·진행 인건비, 디자인/영상, 시스템 구축, 예비비 등)",
      "items": [
        {
          "item": "항목명 (예: 메인 무대 설치)",
          "spec": "세부내역 (예: 6m×10m LED 백월, 프레임 포함)",
          "unit_price": 3000000,
          "qty": 1,
          "unit": "식",
          "period": "2일",
          "utilization": 100,
          "amount": 3000000,
          "note": ""
        }
      ]
    }
  ]
}

규칙:
- 대분류는 과업 성격에 맞춰 3~7개 자동 설정. 단순 복붙 금지.
- 각 대분류별 세부 항목 4~12개. 전체 합산 항목 25~60개 사이.
- unit_price(단가)는 한국 업계 평균 시세 기반 — 예:
  * 메인 무대 4×8m 3,000,000원
  * 기본 음향 시스템 2,500,000원
  * LED 월 1㎡당 80,000원
  * 진행 PD 1일 500,000원
  * 기획팀 투입(AD/기획자) 월 4,500,000원
  * 스크립트/콘티 제작 1,500,000원
  * SNS 광고 1개월 3,000,000원
  * 예비비(총액 3~5%) 별도 카테고리
- utilization(투입율)은 % 단위 정수, 기본 100. 부분 투입 시 50/30/70 등.
- amount = unit_price * qty * (utilization / 100)  — 반올림 정수
- period는 "1일", "3개월", "-" 등 자연어 허용 (계산에 영향 없음)
- note에는 산출 근거·특이사항 짧게
- 소계·일반관리비(소계합×8%)·대행료((소계합+일반관리비)×10%)·합계·VAT(10%)는
  프론트에서 자동 계산하므로 출력할 필요 없음

JSON만 출력. 설명문·코드블록 금지."""


class BudgetRequest(BaseModel):
    conversation_id: str


@app.post("/api/budget/generate")
def api_budget_generate(body: BudgetRequest):
    """대화의 최근 제안서 + RFP 분석을 토대로 산출내역서 생성."""
    with get_db() as db:
        conv = db.execute("SELECT * FROM conversations WHERE id=?", (body.conversation_id,)).fetchone()
        if not conv:
            raise HTTPException(404, "대화를 찾을 수 없습니다.")
        client_id = conv["client_id"]
        last_msg = db.execute(
            "SELECT content FROM messages WHERE conversation_id=? AND role='assistant' "
            "ORDER BY created_at DESC LIMIT 1",
            (body.conversation_id,),
        ).fetchone()

    rfp = _get_rfp_aggregated(client_id) or {}
    proposal_html = last_msg["content"] if last_msg else ""
    # HTML 태그 제거한 텍스트 요약 (간단)
    proposal_text = re.sub(r"<[^>]+>", " ", proposal_html)
    proposal_text = re.sub(r"\s+", " ", proposal_text)[:8000]

    ctx = f"""사업명: {rfp.get('title', '')}
예산: {rfp.get('budget', '')}
요구사항: {json.dumps(rfp.get('key_requirements', []), ensure_ascii=False)}

제안서 본문 요약:
{proposal_text}"""

    try:
        client = require_client()
        prompt = BUDGET_TABLE_PROMPT.replace("{CONTEXT}", ctx)
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=8000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
    except anthropic.APIError as e:
        raise HTTPException(502, translate_anthropic_error(e))
    except json.JSONDecodeError:
        raise HTTPException(502, "산출내역서 AI 응답을 이해하지 못했어요. 다시 시도해 주세요.")
    return data


# ---------- PPTX 미리보기 (PNG 슬라이드 캐러셀) ----------
@app.get("/api/proposals/{conv_id}/preview")
def api_proposals_preview(conv_id: str, regen: int = 0):
    """저장된 PPTX 의 PNG 미리보기.
    LibreOffice 로 PPTX → PDF → 페이지별 PNG 변환 후 URL 리스트 반환.
    PNG 가 이미 있으면 재사용 (regen=1 이면 강제 재생성).
    """
    with get_db() as db:
        cv = db.execute(
            "SELECT pptx_path FROM conversations WHERE id=?", (conv_id,)
        ).fetchone()
    if not cv or not cv["pptx_path"]:
        # PPTX 가 아직 없음 — 클라이언트가 먼저 PPTX 생성하라
        return JSONResponse(
            {"slides": [], "status": "no_pptx",
             "message": "제안서가 아직 생성되지 않았어요. PPTX 다운로드 버튼을 먼저 눌러 생성해 주세요."},
            status_code=200,
        )

    # PPTX 디스크 경로 (URL 의 /static/ 을 STATIC_DIR 로 변환)
    pptx_url = cv["pptx_path"]
    pptx_disk = STATIC_DIR / pptx_url.replace("/static/", "", 1)
    if not pptx_disk.exists():
        return JSONResponse(
            {"slides": [], "status": "pptx_missing",
             "message": "저장된 PPTX 파일을 찾지 못했어요."},
            status_code=200,
        )

    preview_dir = STATIC_DIR / "exports" / "preview" / conv_id
    existing = sorted(preview_dir.glob("slide_*.png")) if preview_dir.exists() else []

    # 캐시 — PNG 가 있고 PPTX 보다 새것이면 재사용
    if not regen and existing and pptx_disk.stat().st_mtime <= existing[0].stat().st_mtime:
        slides = [
            {"idx": i + 1, "url": f"/static/exports/preview/{conv_id}/{p.name}"}
            for i, p in enumerate(existing)
        ]
        return {"slides": slides, "status": "cached", "count": len(slides)}

    # 새로 변환
    try:
        import pptx_generator
        # 기존 캐시 정리
        if preview_dir.exists():
            import shutil as _sh
            _sh.rmtree(preview_dir, ignore_errors=True)
        # [C8] width 1280 → 960 — 변환 시간 ~13%↓ · 파일 사이즈 ~37%↓
        # (사이드패널 표시폭 ~700px 기준 충분히 선명)
        pngs = pptx_generator.pptx_to_png_previews(
            pptx_disk, preview_dir, width=960, timeout_sec=120,
        )
        if not pngs:
            return JSONResponse(
                {"slides": [], "status": "convert_failed",
                 "message": "미리보기 생성 실패 — LibreOffice 미설치 또는 변환 오류."},
                status_code=200,
            )
        slides = [
            {"idx": i + 1, "url": f"/static/exports/preview/{conv_id}/{p.name}"}
            for i, p in enumerate(pngs)
        ]
        return {"slides": slides, "status": "generated", "count": len(slides)}
    except Exception as e:
        log.exception("미리보기 생성 예외: %s", e)
        return JSONResponse(
            {"slides": [], "status": "error", "message": f"미리보기 생성 중 오류: {str(e)[:120]}"},
            status_code=200,
        )


# ---------- 포인트 컬러 관리 ----------
class AccentIn(BaseModel):
    accent: str


@app.patch("/api/clients/{cid}/accent")
def api_client_accent(cid: str, body: AccentIn):
    """발주처별 제안서 포인트 컬러 저장 (#RRGGBB)."""
    color = body.accent.strip()
    if not re.match(r"^#[0-9a-fA-F]{6}$", color):
        raise HTTPException(400, "#RRGGBB 형식의 색상을 입력해 주세요.")
    set_setting(f"accent:{cid}", color)
    return {"ok": True, "accent": color}


@app.get("/api/clients/{cid}/accent")
def api_client_accent_get(cid: str):
    c = get_setting(f"accent:{cid}", "")
    return {"accent": c or None}



# ---------- Nuance Memory ----------
@app.get("/api/clients/{cid}/memories")
def api_mem_list(cid: str):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM nuance_memories WHERE client_id=? ORDER BY created_at DESC",
            (cid,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["tags"] = json.loads(d["tags"] or "[]")
        out.append(d)
    return out


@app.delete("/api/memories/{mem_id}")
def api_mem_delete(mem_id: str):
    with get_db() as db:
        db.execute("DELETE FROM nuance_memories WHERE id=?", (mem_id,))
    return {"ok": True}


# ---------------------------------------------------------------------------
# [DEPRECATED] 우리 회사의 강점은? — 기능 완전 제거됨
# 사유: 추상적 신호라 제안서 본문에 녹이면 "혁신적인/최적의" 류 빈말 증가 역효과.
# 의도적 분리 유지. 이전 클라이언트 호환을 위해 GET API 만 stub 으로 남기고
# 카탈로그/POST/시스템프롬프트 주입은 모두 제거.
# DB 테이블(client_strengths) 은 데이터 보존 위해 유지 (수동 쿼리 가능).
# ---------------------------------------------------------------------------


@app.get("/api/strengths/catalog")
def api_strengths_catalog():
    """[DEPRECATED] 강점 기능 제거됨. 빈 카탈로그 반환."""
    return {"catalog": [], "deprecated": True}


@app.get("/api/clients/{cid}/strengths")
def api_client_strengths_get(cid: str):
    """[DEPRECATED] 강점 기능 제거됨. 빈 응답."""
    return {
        "category": "", "capabilities": [], "updated_at": None,
        "suggested_category": "", "project_domain": "",
        "project_domain_label": "", "has_rfp": False, "deprecated": True,
    }



# ---------------------------------------------------------------------------
# 발주처 들여다보기 👀 (RFP 업로드 시 자동 수집)
# ---------------------------------------------------------------------------
CLIENT_INTEL_PROMPT = """발주처에 대한 공개 정보를 web_search 도구로 조사해 정리하세요.
사용자가 발주처와 더 효과적으로 소통할 수 있도록 실용적이고 구체적인 정보를 추출합니다.

발주처: {CLIENT_NAME}
업종/유형: {CLIENT_TYPE}
RFP 사업명: {PROJECT_TITLE}

JSON 스키마(JSON만 출력):
{
  "basic_info": {
    "official_name": "공식 기관명/회사명",
    "type": "공공기관|지자체|공기업|민간기업 등",
    "main_role": "주요 역할/소관 분야 (한 문장)",
    "website": "공식 사이트 URL (없으면 빈 문자열)"
  },
  "event_history": ["과거 진행한 유사 행사·사업 5개 이내 (각 25자 이내)"],
  "tendency": ["성향/선호 패턴 5개 이내 — 키워드·톤·우선순위 (각 30자 이내)"],
  "key_people": ["주요 인물·담당자 정보 3개 이내 (각 30자 이내, 알 수 있을 때만)"],
  "communication_tips": ["이 발주처와 소통할 때 유용한 팁 3~5개 (각 40자 이내)"],
  "summary": "이 발주처를 한 문단(3문장 이내)으로 요약"
}
모르는 필드는 빈 배열/빈 문자열. 추측 금지, 검색 결과 기반.
JSON만 출력, 다른 설명 없음.

JSON:"""


def _run_client_intel(cid: str) -> dict:
    """발주처 정보 자동 수집 — Claude + web_search 활용.

    [중요] 검색에는 RFP 에서 추출된 organization 만 사용.
    과업명(client.name) 은 검색에 영향 X — 사용자가 짧거나 모호한 과업명을 넣어도
    엉뚱한 결과가 나오지 않도록 의도적으로 분리.

    실패 케이스를 명확히 분류해 사용자에게 의미있는 에러 메시지를 돌려줌.
    """
    with get_db() as db:
        client = db.execute("SELECT * FROM clients WHERE id=?", (cid,)).fetchone()
    if not client:
        return {}
    rfp = _get_rfp_aggregated(cid) or {}
    project_title = rfp.get("title", "")

    # 발주처 결정: clients.organization (RFP 추출) 우선
    organization = ""
    try:
        organization = (client["organization"] or "").strip()
    except (KeyError, IndexError):
        organization = ""
    # 폴백: RFP analysis 의 organization 도 시도 (저장 직후 race)
    if not organization:
        organization = (rfp.get("organization") or "").strip()

    # 발주처 추출 실패 → 들여다보기 비활성 (과업명으로 검색하지 않음)
    if not organization or len(organization) < 2:
        return {
            "error": "RFP 에서 발주처를 추출하지 못했어요. "
                     "RFP(공고문/제안요청서)를 업로드해 주세요. "
                     "이미 올렸다면 RFP 에 발주처 정보가 명확히 적혀있는지 확인해 주세요."
        }
    # 의심값 차단 — 'test', '예시', 'sample', '..', '-' 등 의미없는 값이 추출된 경우
    SUSPICIOUS = {"test", "TEST", "테스트", "샘플", "sample", "SAMPLE",
                  "예시", "example", "TBD", "tbd", "n/a", "N/A",
                  "발주처", "공고기관", "기관명", "-", "--", ".", ".."}
    if organization in SUSPICIOUS or len(organization.strip(".-_ ")) < 2:
        log.warning("발주처 들여다보기 의심값 차단 · org=%r", organization)
        return {
            "error": f"추출된 발주처가 검색에 부적합해요 ('{organization}'). "
                     "RFP 본문에 발주처 정보가 명확히 적혀있는지 확인해 주세요."
        }

    prompt = (CLIENT_INTEL_PROMPT
              .replace("{CLIENT_NAME}", organization)
              .replace("{CLIENT_TYPE}", client["industry"] or "")
              .replace("{PROJECT_TITLE}", project_title))

    log.info("발주처 들여다보기 시작 · org=%r · project=%r", organization[:40], project_title[:40])

    intel: dict = {}
    raw_text = ""
    stop_reason = None
    try:
        api_client = require_client()
        # max_tokens 4000 — web_search 결과 + JSON 둘 다 충분히 담기게 (이전 2500 부족 가능)
        resp = api_client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
            tools=[WEB_SEARCH_TOOL],
        )
        stop_reason = getattr(resp, "stop_reason", None)
        raw_text = _extract_text_from_resp(resp)
        log.info("발주처 들여다보기 응답 · stop_reason=%s · text_len=%d", stop_reason, len(raw_text))

        if not raw_text.strip():
            return {"error": "Claude 응답이 비어있어요 (web_search 검색 결과를 못 찾았을 가능성)"}

        # JSON 추출 — 코드펜스 제거 + 첫 { ~ 마지막 } 매칭으로 강건하게
        cleaned = raw_text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        # 자연어 문장 + JSON 섞여있으면 첫 { ~ 마지막 } 추출
        json_match = re.search(r"\{[\s\S]*\}", cleaned)
        if json_match:
            cleaned = json_match.group(0)
        else:
            # AI 가 평문으로 거절 응답한 케이스 — JSON 파싱 시도 자체를 건너뛰고 친절 안내
            refusal_keywords = ("죄송", "특정할 수 없", "확인할 수 없", "찾을 수 없", "구체적인")
            is_refusal = any(k in raw_text for k in refusal_keywords)
            if is_refusal:
                log.warning("발주처 들여다보기 평문 거절 응답: %r", raw_text[:200])
                return {
                    "error": "AI 가 발주처를 특정하지 못했어요. "
                             "RFP 에 발주처가 명확히 적혀있는지 확인해 주세요. "
                             f"(추출된 발주처: '{organization}')"
                }
        intel = json.loads(cleaned)
        if not isinstance(intel, dict):
            return {"error": "응답 형식이 dict 가 아니에요"}

    except json.JSONDecodeError as e:
        # max_tokens 잘림이면 "Unterminated string" / "Expecting value" 등
        log.warning("발주처 들여다보기 JSON 파싱 실패: %s · stop_reason=%s · text=%r",
                    e, stop_reason, raw_text[:200])
        if stop_reason == "max_tokens":
            err_msg = "응답이 잘렸어요 (max_tokens 부족) — 다시 시도하면 보통 성공해요"
        else:
            # raw_text 의 첫 80자도 함께 보여주기 (디버깅 도움)
            preview = raw_text.strip()[:80].replace("\n", " ")
            err_msg = f"AI 응답 형식 오류 — 응답 일부: '{preview}…'"
        intel = {"error": err_msg}

    except anthropic.AuthenticationError:
        intel = {"error": "Anthropic API 키가 유효하지 않아요. 좌하단 설정에서 키를 다시 확인해 주세요."}
    except anthropic.RateLimitError:
        intel = {"error": "Anthropic API 호출 한도 초과 — 잠시 후 다시 시도해 주세요."}
    except anthropic.BadRequestError as e:
        msg = str(e)
        if "credit balance" in msg.lower() or "billing" in msg.lower():
            intel = {"error": "Anthropic 크레딧 잔액 부족 — console.anthropic.com 에서 확인"}
        elif "web_search" in msg.lower() or "tool" in msg.lower():
            intel = {"error": f"web_search 도구 사용 불가 — 모델/플랜 확인 필요 ({str(e)[:80]})"}
        else:
            intel = {"error": f"요청 형식 오류: {str(e)[:100]}"}
    except (anthropic.APIConnectionError, anthropic.APITimeoutError):
        intel = {"error": "Anthropic 서버와 통신 실패 — 네트워크 또는 API 일시 장애"}
    except Exception as e:
        log.exception("발주처 들여다보기 예외 · client=%s", client["name"])
        intel = {"error": f"자동 수집 실패 ({type(e).__name__}: {str(e)[:80]})"}

    # 정상 응답인데 모든 필드가 비어있는 경우 — 검색 결과 부재로 분류
    if "error" not in intel:
        has_any = bool(
            (intel.get("basic_info") or {}).get("official_name")
            or (intel.get("basic_info") or {}).get("main_role")
            or intel.get("event_history")
            or intel.get("tendency")
            or intel.get("communication_tips")
            or intel.get("summary")
        )
        if not has_any:
            # 검색어는 organization 이지 client.name 이 아님 (이전 버그 수정)
            intel["error"] = (
                "발주처 정보를 거의 찾지 못했어요. "
                f"발주처가 정확한지 확인해 보세요 (검색어: '{organization}'). "
                "RFP 분석을 다시 돌리면 더 정확한 발주처가 추출될 수 있어요."
            )

    with get_db() as db:
        db.execute(
            "INSERT INTO client_intel(client_id,intel_json,updated_at) "
            "VALUES(?,?,datetime('now','localtime')) "
            "ON CONFLICT(client_id) DO UPDATE SET "
            "intel_json=excluded.intel_json, updated_at=excluded.updated_at",
            (cid, json.dumps(intel, ensure_ascii=False)),
        )
    if "error" in intel:
        log.warning("발주처 들여다보기 결과 = error: %s", intel["error"])
    else:
        log.info("발주처 들여다보기 성공 · official_name=%r · history=%d · tips=%d",
                 (intel.get("basic_info") or {}).get("official_name", "")[:30],
                 len(intel.get("event_history") or []),
                 len(intel.get("communication_tips") or []))
    return intel


@app.get("/api/clients/{cid}/intel")
def api_client_intel_get(cid: str):
    with get_db() as db:
        row = db.execute("SELECT intel_json,updated_at FROM client_intel WHERE client_id=?", (cid,)).fetchone()
    if not row:
        return {"intel": {}, "updated_at": None}
    try:
        intel = json.loads(row["intel_json"] or "{}")
    except Exception:
        intel = {}
    return {"intel": intel, "updated_at": row["updated_at"]}


@app.post("/api/clients/{cid}/intel/rebuild")
def api_client_intel_rebuild(cid: str):
    with get_db() as db:
        c = db.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone()
        if not c:
            raise HTTPException(404, "발주처를 찾을 수 없습니다.")
    intel = _run_client_intel(cid)
    return {"intel": intel}


# ---------------------------------------------------------------------------
# 제안서 PPTX 변환 — Claude 가 만든 제안서 HTML → 슬라이드 파일 (.pptx)
# ---------------------------------------------------------------------------
class PptxExportIn(BaseModel):
    conversation_id: str


def _safe_filename(s: str, default: str = "제안서") -> str:
    """파일명 안전화 — 운영체제 금지 문자 제거 + 길이 제한."""
    s = (s or default).strip()
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', s)
    s = re.sub(r'\s+', '_', s)
    return (s[:60] if s else default) or default


def _extract_pages_from_html(html: str) -> list[dict]:
    """제안서 HTML 에서 page-by-page 콘텐츠 추출 — 마스터 PPTX 치환에 사용.

    각 page → {"section": str, "거버닝": str, "소제목": str, "본문": [str, ...], "summary": str}
    """
    pages = []
    page_iter = re.finditer(
        r'<div class="proposal-page[^"]*"([^>]*)>([\s\S]*?)(?=<div class="proposal-page|</div>\s*$)',
        html,
    )

    def strip(t: str) -> str:
        t = re.sub(r"<br\s*/?>", "\n", t or "", flags=re.I)
        t = re.sub(r"<[^>]+>", "", t)
        t = (t.replace("&nbsp;", " ").replace("&amp;", "&")
              .replace("&lt;", "<").replace("&gt;", ">")
              .replace("&quot;", '"').replace("&#39;", "'"))
        return re.sub(r"\s+", " ", t).strip()

    for m in page_iter:
        attrs = m.group(1) or ""
        body_html = m.group(2) or ""
        m_section = re.search(r'data-section=["\']([^"\']+)', attrs)
        section = m_section.group(1).strip() if m_section else ""
        # 거버닝
        m_gov = re.search(r'<[^>]+class="[^"]*page-governing[^"]*"[^>]*>([\s\S]*?)</[^>]+>', body_html)
        governing = strip(m_gov.group(1)) if m_gov else ""
        # 요약
        m_sum = re.search(r'<[^>]+class="[^"]*page-summary[^"]*"[^>]*>([\s\S]*?)</[^>]+>', body_html)
        summary = strip(m_sum.group(1)) if m_sum else ""
        # 본문 — governing/summary 제외하고 li 들 추출
        body_wo = body_html
        if m_gov: body_wo = body_wo.replace(m_gov.group(0), "")
        if m_sum: body_wo = body_wo.replace(m_sum.group(0), "")
        # li 또는 p 단위로 분리
        body_blocks = []
        for li in re.finditer(r"<li[^>]*>([\s\S]*?)</li>", body_wo):
            t = strip(li.group(1))
            if t:
                body_blocks.append(t[:120])
        if not body_blocks:
            # li 없으면 p 단위
            for p in re.finditer(r"<p[^>]*>([\s\S]*?)</p>", body_wo):
                t = strip(p.group(1))
                if t:
                    body_blocks.append(t[:120])
        # 소제목 — h2/h3 또는 viz-card-title 첫 번째
        m_h = re.search(r"<(h[2-4]|[^>]*class=\"[^\"]*viz-(?:card-title|step-title)[^\"]*\")[^>]*>([\s\S]*?)</[^>]+>", body_wo)
        subtitle = strip(m_h.group(2)) if m_h else ""

        pages.append({
            "section": section,
            "거버닝": governing,
            "소제목": subtitle,
            "본문": body_blocks[:6],
            "summary": summary,
        })
    return pages


def _build_pptx_from_pages(pages: list[dict], title: str, output_path: Path,
                            accent_hex: str = "6B46E5") -> int:
    """폴백 — pages list (JSON 또는 HTML 추출 결과) → PPTX 직접 그리기.
    pages 형식: [{"section":..., "거버닝":..., "소제목":..., "본문":[...], "summary":..., "viz_type":...}]
    """
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.enum.text import PP_ALIGN
    from pptx.dml.color import RGBColor

    accent_rgb = RGBColor.from_string(accent_hex.lstrip("#") if accent_hex else "6B46E5")
    prs = Presentation()
    prs.slide_width = Inches(11.69)
    prs.slide_height = Inches(8.27)
    blank_layout = prs.slide_layouts[6]
    if not pages:
        raise HTTPException(500, "제안서 슬라이드가 없어요.")

    # 표지
    cover = prs.slides.add_slide(blank_layout)
    tx = cover.shapes.add_textbox(Inches(1.0), Inches(3.2), Inches(9.69), Inches(2.0)).text_frame
    tx.word_wrap = True
    p = tx.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = title
    run.font.size = Pt(36)
    run.font.bold = True
    run.font.color.rgb = accent_rgb

    for page in pages:
        slide = prs.slides.add_slide(blank_layout)
        if page["section"]:
            tb = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(8), Inches(0.4)).text_frame
            r = tb.paragraphs[0].add_run()
            r.text = page["section"]
            r.font.size = Pt(10); r.font.color.rgb = accent_rgb; r.font.bold = True
        if page["거버닝"]:
            tb = slide.shapes.add_textbox(Inches(0.5), Inches(0.85), Inches(10.5), Inches(1.3)).text_frame
            tb.word_wrap = True
            r = tb.paragraphs[0].add_run()
            r.text = page["거버닝"]
            r.font.size = Pt(24); r.font.bold = True
        if page["본문"]:
            tb = slide.shapes.add_textbox(Inches(0.5), Inches(2.3), Inches(10.5), Inches(5.0)).text_frame
            tb.word_wrap = True
            for line in page["본문"]:
                pa = tb.add_paragraph() if tb.paragraphs[0].text else tb.paragraphs[0]
                r = pa.add_run()
                r.text = line[:200]
                r.font.size = Pt(11)
        if page["summary"]:
            tb = slide.shapes.add_textbox(Inches(0.5), Inches(7.4), Inches(10.5), Inches(0.6)).text_frame
            r = tb.paragraphs[0].add_run()
            r.text = "💡 " + page["summary"]
            r.font.size = Pt(12); r.font.bold = True
            r.font.color.rgb = accent_rgb

    prs.save(str(output_path))
    return len(prs.slides)


@app.post("/api/proposals/pptx")
def api_proposals_pptx(body: PptxExportIn):
    """대화의 최신 제안서 → .pptx (마스터 템플릿 우선, 없으면 폴백).
    파일명: '{발주처명}_제안서.pptx', /static/exports/ 영구 보관.
    """
    try:
        from pptx import Presentation
    except ImportError:
        raise HTTPException(500, "python-pptx 가 설치돼 있지 않아요. requirements.txt 를 확인해 주세요.")

    with get_db() as db:
        # JSON 또는 HTML 형식 제안서 메시지 찾기 (둘 다 지원)
        # [중요] LIKE '%"slides"%' — 코드펜스(```json\n{...})·평문 prefix·깔끔한 JSON
        #        모두 매칭. 이전 '{%"slides"%' 패턴은 첫 글자가 { 여야만 매칭되는
        #        버그가 있었음 (AI 가 ```json 으로 시작하면 못 찾아 404)
        msg = db.execute(
            "SELECT content FROM messages "
            "WHERE conversation_id=? AND role='assistant' "
            "AND (content LIKE '%\"slides\"%' "
            "     OR content LIKE '%<div class=\"proposal\"%') "
            "ORDER BY created_at DESC LIMIT 1",
            (body.conversation_id,),
        ).fetchone()
        # 발주처명 가져오기 (파일명용)
        cli_row = db.execute(
            "SELECT c.name FROM clients c "
            "JOIN conversations cv ON cv.client_id=c.id "
            "WHERE cv.id=?",
            (body.conversation_id,),
        ).fetchone()
        client_name = (cli_row["name"] if cli_row else "") or "제안서"
    if not msg:
        raise HTTPException(404, "이 대화에 제안서가 없어요. 먼저 제안서를 생성해 주세요.")

    raw_content = msg["content"]
    # [방어] AI 가 web_search 인용 <cite index="..."> 태그를 본문에 박는 케이스 방지
    # — JSON 본문 안에 들어가면 슬라이드에 그대로 노출되어 흉함
    raw_content = re.sub(r"<cite[^>]*>", "", raw_content)
    raw_content = re.sub(r"</cite>", "", raw_content)
    # JSON 우선 파싱 — 응답이 JSON 이면 슬라이드 데이터 직접 사용
    proposal_json = None
    try:
        cleaned = raw_content.strip()
        # 코드펜스 제거
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        # 첫 { 부터 마지막 } 까지 추출
        json_match = re.search(r"\{[\s\S]*\}", cleaned)
        if json_match:
            parsed = json.loads(json_match.group(0))
            if isinstance(parsed, dict) and isinstance(parsed.get("slides"), list):
                proposal_json = parsed
    except Exception:
        proposal_json = None

    html = raw_content if proposal_json is None else ""

    # 출력 경로
    out_dir = STATIC_DIR / "exports"
    out_dir.mkdir(exist_ok=True)
    safe_client = _safe_filename(client_name)
    download_name = f"{safe_client}_제안서.pptx"
    disk_fname = f"{safe_client}_{body.conversation_id[:8]}.pptx"
    out_path = out_dir / disk_fname

    # 슬라이드 데이터 준비 — JSON 우선, HTML fallback
    if proposal_json is not None:
        log.info("PPTX 생성: JSON 입력 (slides=%d)", len(proposal_json.get("slides", [])))
        pages = []
        for s in proposal_json["slides"]:
            if not isinstance(s, dict):
                continue
            본문 = s.get("본문") or s.get("body") or []
            if isinstance(본문, str):
                본문 = [본문]
            pages.append({
                "section": s.get("section", ""),
                "거버닝": s.get("거버닝") or s.get("governing") or "",
                "소제목": s.get("소제목") or s.get("subtitle") or "",
                "본문": [str(b)[:120] for b in 본문][:6],
                "summary": s.get("summary", ""),
                "viz_type": s.get("viz_type", ""),
            })
        title_for_cover = proposal_json.get("title") or (client_name + " 정성 제안서")
    else:
        log.info("PPTX 생성: HTML 입력 (legacy)")
        pages = _extract_pages_from_html(html)
        title_for_cover = client_name + " 정성 제안서"

    if not pages:
        raise HTTPException(500, "제안서 슬라이드 데이터를 추출하지 못했어요.")

    # 0. 도형 JSON 모드 자동 감지 — slides[*].shapes 가 있으면 자유 레이아웃 모드
    is_shape_mode = False
    if proposal_json is not None:
        for s in proposal_json.get("slides", []):
            if isinstance(s, dict) and isinstance(s.get("shapes"), list) and s["shapes"]:
                is_shape_mode = True
                break

    if is_shape_mode:
        log.info("PPTX 생성: 도형 JSON 모드 (slides=%d)", len(proposal_json.get("slides", [])))
        try:
            import pptx_generator
            shape_result = pptx_generator.generate_from_shape_json(proposal_json, out_path)
            slide_count = shape_result.get("slide_count", 0)
            errors = shape_result.get("errors") or []
            if errors:
                log.warning("도형 모드 렌더 경고 %d 건: %s", len(errors), errors[:3])
            # conversations 에 PPTX 경로 기록
            try:
                with get_db() as db:
                    db.execute(
                        "UPDATE conversations SET pptx_path=?, pptx_updated_at=datetime('now','localtime') "
                        "WHERE id=?",
                        (f"/static/exports/{disk_fname}", body.conversation_id),
                    )
            except Exception as e:
                log.warning("conversations.pptx_path 기록 실패 (무시): %s", e)
            return {
                "url": f"/static/exports/{disk_fname}",
                "filename": download_name,
                "page_count": slide_count,
                "mode": "shape",
                "render_errors": errors[:5],
            }
        except Exception as e:
            log.exception("도형 모드 실패 — placeholder/fallback 으로 전환: %s", e)
            # fallthrough → 기존 모드 시도

    # 1. 마스터 템플릿 우선 시도
    used_master = False
    slide_count = 0
    try:
        import pptx_generator
        master = pptx_generator.find_master_template()
        if master and master.exists():
            log.info("마스터 모드 (%s, pages=%d)", master.name, len(pages))
            # 발주처/회사명 — placeholder 모드에서 동적 필드로 사용
            organization = ""
            try:
                with get_db() as db_:
                    cli_org = db_.execute(
                        "SELECT organization FROM clients c "
                        "JOIN conversations cv ON cv.client_id=c.id WHERE cv.id=?",
                        (body.conversation_id,),
                    ).fetchone()
                    organization = (cli_org["organization"] if cli_org else "") or ""
            except Exception:
                organization = ""

            def _build_slide_content(page: dict, is_cover: bool = False) -> dict:
                """Placeholder 모드 + AUTO 모드 둘 다 호환되는 content 빌드.
                - AUTO 모드는 거버닝/소제목/본문 (list) 만 사용
                - Placeholder 모드는 본문_1, 본문_2, ... + 동적 필드 (회사명, 발주처) 사용
                """
                본문_list = page.get("본문") or []
                if is_cover:
                    본문_list = [client_name] + 본문_list[:3]
                c = {
                    # AUTO 모드용 (legacy)
                    "거버닝": page.get("거버닝") or (title_for_cover if is_cover else ""),
                    "소제목": page.get("소제목") or page.get("section") or "",
                    "본문": 본문_list,
                    "summary": page.get("summary", ""),
                    # Placeholder 모드용 — 본문 list 를 본문_1, 본문_2, ... 로 펼침
                    "title": title_for_cover,
                    "section": page.get("section", ""),
                    "회사명": client_name,  # 표지/푸터용
                    "발주처": organization,  # 표지/페이지 마커용
                }
                # 본문_1 ~ 본문_N
                for i, b in enumerate(본문_list, 1):
                    c[f"본문_{i}"] = str(b)
                return c

            content_per_slide = {}
            # 표지 — 마스터 0번
            content_per_slide[0] = _build_slide_content(pages[0] if pages else {}, is_cover=True)
            # 본문 — 마스터 1번부터
            for idx, page in enumerate(pages, 1):
                if idx >= 90:
                    break
                content_per_slide[idx] = _build_slide_content(page, is_cover=False)
            keep = list(content_per_slide.keys())
            result = pptx_generator.generate_from_master(
                master_path=master,
                content_per_slide=content_per_slide,
                output_path=out_path,
                keep_indices=keep,
            )
            slide_count = result["slide_count"]
            used_master = True
            log.info("마스터 모드 성공 · %d 슬라이드 / %d 치환 / size %.1fMB",
                     slide_count, result["replaced_total"],
                     (result.get("media_gc") or {}).get("size_after_mb", 0))
    except Exception as e:
        log.exception("마스터 모드 실패 — 폴백으로 전환: %s", e)
        used_master = False

    # 2. 폴백 — 마스터 못 쓸 때 직접 PPTX 그리기 (JSON pages 또는 HTML)
    if not used_master:
        log.info("PPTX 생성: 폴백 모드")
        slide_count = _build_pptx_from_pages(pages, title_for_cover, out_path)

    # 3. conversations 에 PPTX 경로 기록
    try:
        with get_db() as db:
            db.execute(
                "UPDATE conversations SET pptx_path=?, pptx_updated_at=datetime('now','localtime') "
                "WHERE id=?",
                (f"/static/exports/{disk_fname}", body.conversation_id),
            )
    except Exception as e:
        log.warning("conversations.pptx_path 기록 실패 (무시): %s", e)

    return {
        "url": f"/static/exports/{disk_fname}",
        "filename": download_name,
        "page_count": slide_count,
        "mode": "master" if used_master else "fallback",
    }


# ---------------------------------------------------------------------------
# 🎤 PT 연습 — 발표 큐시트 + 예상 Q&A 생성
# ---------------------------------------------------------------------------
PT_SCRIPT_PROMPT = """다음 제안서를 발표할 때 쓸 큐시트(스크립트)를 만들어 주세요.
발표 시간: 총 {DURATION_MIN}분.

각 슬라이드별로:
- 시간 배분 (시작 시각 ~ 끝 시각)
- 핵심 멘트 (실제 발표할 자연스러운 한국어 문장)
- 강조 포인트 (1~2개)

JSON 스키마(JSON만 출력):
{
  "total_min": {DURATION_MIN},
  "intro_tip": "발표 시작 직전 마음가짐 한 줄",
  "slides": [
    {
      "page": 1,
      "section": "표지",
      "time_range": "00:00 ~ 00:30",
      "duration_sec": 30,
      "script": "안녕하십니까. ...",
      "highlights": ["...", "..."]
    }
  ],
  "closing_tip": "마무리 멘트 가이드 한 줄"
}

제안서 본문 요약:
---
{PROPOSAL_TEXT}
---

JSON:"""


PT_QA_PROMPT = """평가위원 입장에서 다음 제안서·RFP 를 보고 PT 발표 후 예상 질문 5~8개를 만들어 주세요.
질문은 평가위원이 실제로 자주 묻는 카테고리(차별화 / 리스크 / 예산 / 일정 / 사후관리 / 비교우위) 에서 골고루.
각 질문에 모범답변(우리 회사 입장) 도 함께 제시.

JSON 스키마(JSON만 출력):
{
  "questions": [
    {
      "category": "차별화",
      "question": "...",
      "model_answer": "...",
      "tip": "답변 시 강조하면 좋은 포인트"
    }
  ]
}

RFP 분석:
{RFP_TEXT}

제안서 본문 요약:
{PROPOSAL_TEXT}

JSON:"""


# ---------------------------------------------------------------------------
# 🔍 제안서 자체 검증 (Compliance + Red Team) — 부록 슬라이드 대체
# ---------------------------------------------------------------------------
PROPOSAL_AUDIT_PROMPT = """당신은 한국 B2G 공공입찰 제안서 *셀프 검증* 전문가입니다.
제안서 작성자가 *놓친 RFP 요구사항* 과 *평가위원 시각의 예상 점수* 를 동시에 분석합니다.

핵심 원칙:
- 추측 금지. RFP 와 제안서 본문 근거로만 판단.
- 누락된 요구사항은 *RFP 의 어느 항목* 인지 명시.
- Red Team 점수는 평가 기준별 배점에 근거.

JSON 스키마 (JSON만 출력, 다른 텍스트 금지):
{
  "compliance": {
    "total_required": 15,
    "covered": 12,
    "coverage_pct": 80,
    "covered_items": [
      {"req": "안전관리 계획", "where": "슬라이드 12 안전관리"},
      {"req": "운영 인력 배치", "where": "슬라이드 8 조직"}
    ],
    "missing_items": [
      {"req": "비상 연락망", "rfp_section": "2.3", "weight": "5점", "advice": "안전관리 페이지에 추가 권장"},
      {"req": "직접생산증명서", "rfp_section": "1.1", "weight": "자격", "advice": "부록에 첨부 필요"}
    ]
  },
  "red_team": {
    "expected_score": 78,
    "max_score": 100,
    "by_criterion": [
      {"item": "기획 적정성", "weight": 30, "expected": 25, "reason": "거버닝 명확하지만 차별화 약함"},
      {"item": "사업 수행 능력", "weight": 30, "expected": 24, "reason": "조직 안정적, 일정 모호"},
      {"item": "안전관리", "weight": 20, "expected": 15, "reason": "비상 연락망 누락"},
      {"item": "예산 적정성", "weight": 20, "expected": 14, "reason": "단가 근거 부족"}
    ],
    "strengths": [
      "거버닝 메시지 명확 (페이지 5)",
      "정량 수치 풍부 (안전관리 페이지)"
    ],
    "weaknesses": [
      "일정 마일스톤 모호",
      "차별화 포인트 약함",
      "비상 대응 시나리오 부재"
    ],
    "improvement_priority": [
      {"item": "비상 연락망 추가", "expected_gain": "+5", "advice": "안전관리 슬라이드에 표 형식으로"},
      {"item": "차별화 강화", "expected_gain": "+3", "advice": "경쟁사 대비 우위 한 페이지 추가"}
    ]
  },
  "summary": "전체 한 줄 평 — 100자 이내"
}

[RFP 분석]
{RFP_TEXT}

[제안서 JSON]
{PROPOSAL_JSON}

JSON:"""


def _get_proposal_json_for_conv(conversation_id: str) -> Optional[dict]:
    """대화의 최신 제안서 JSON 응답 → dict (audit/검증용)."""
    with get_db() as db:
        row = db.execute(
            "SELECT content FROM messages "
            "WHERE conversation_id=? AND role='assistant' "
            "AND content LIKE '%\"slides\"%' "
            "ORDER BY created_at DESC LIMIT 1",
            (conversation_id,),
        ).fetchone()
    if not row or not row["content"]:
        return None
    raw = row["content"]
    # cite 태그 제거 (web_search 잔재 방어)
    raw = re.sub(r"<cite[^>]*>", "", raw)
    raw = re.sub(r"</cite>", "", raw)
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if not m:
        return None
    try:
        parsed = json.loads(m.group(0))
        if isinstance(parsed, dict) and isinstance(parsed.get("slides"), list):
            return parsed
    except json.JSONDecodeError:
        pass
    return None


class AuditIn(BaseModel):
    conversation_id: str


@app.post("/api/proposals/audit")
def api_proposals_audit(body: AuditIn):
    """🔍 자체 검증 — Compliance + Red Team 통합 분석.

    동작:
      1. RFP 분석 결과 (요구사항/배점) 가져옴
      2. 제안서 JSON 가져옴
      3. Claude 에 audit 프롬프트 → JSON 결과
      4. compliance (커버리지) + red_team (예상 점수) 반환
    """
    # 1. 제안서 JSON
    proposal = _get_proposal_json_for_conv(body.conversation_id)
    if not proposal:
        raise HTTPException(404, "이 대화에 제안서가 없어요. 먼저 제안서를 생성해 주세요.")

    # 2. RFP 분석 (client_id 통해)
    with get_db() as db:
        cv = db.execute(
            "SELECT client_id FROM conversations WHERE id=?",
            (body.conversation_id,),
        ).fetchone()
    if not cv:
        raise HTTPException(404, "대화를 찾을 수 없어요.")
    rfp_json = _get_rfp_aggregated(cv["client_id"]) or {}
    if not rfp_json or rfp_json.get("error"):
        raise HTTPException(
            400,
            "RFP 분석 결과가 없어요. RFP 를 먼저 업로드/분석해 주세요. "
            "(검증은 RFP 요구사항을 기준으로 점검합니다)",
        )

    # 3. 프롬프트 만들기 — 토큰 예산 관리
    rfp_text = json.dumps(rfp_json, ensure_ascii=False)[:8000]
    proposal_text = json.dumps(proposal, ensure_ascii=False)[:12000]
    prompt = (
        PROPOSAL_AUDIT_PROMPT
        .replace("{RFP_TEXT}", rfp_text)
        .replace("{PROPOSAL_JSON}", proposal_text)
    )

    # 4. Claude 호출
    try:
        client = require_client()
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        if not raw.strip():
            raise HTTPException(502, "AI 응답이 비어있어요. 다시 시도해 주세요.")
        # JSON 추출
        cleaned = raw.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        json_match = re.search(r"\{[\s\S]*\}", cleaned)
        if not json_match:
            raise HTTPException(502, "AI 응답에서 JSON 을 찾지 못했어요.")
        result = json.loads(json_match.group(0))
    except anthropic.APIError as e:
        raise HTTPException(502, translate_anthropic_error(e))
    except json.JSONDecodeError as e:
        log.warning("audit JSON 파싱 실패: %s · 원본: %s", e, raw[:300])
        raise HTTPException(502, "검증 결과를 이해하지 못했어요. 다시 시도해 주세요.")

    # 5. 결과 검증 (필수 필드 체크)
    if not isinstance(result, dict):
        raise HTTPException(502, "검증 결과 형식 오류")
    result.setdefault("compliance", {})
    result.setdefault("red_team", {})
    result.setdefault("summary", "")
    return result


def _get_proposal_text_for_conv(conversation_id: str) -> str:
    """대화의 최신 제안서 HTML → 일반 텍스트 요약."""
    with get_db() as db:
        row = db.execute(
            "SELECT content FROM messages "
            "WHERE conversation_id=? AND role='assistant' "
            "AND content LIKE '%proposal%' "
            "ORDER BY created_at DESC LIMIT 1",
            (conversation_id,),
        ).fetchone()
    if not row or not row["content"]:
        return ""
    text = re.sub(r"<[^>]+>", " ", row["content"])
    text = re.sub(r"\s+", " ", text).strip()
    return text[:8000]


class PtScriptIn(BaseModel):
    conversation_id: str
    duration_min: int = 10  # 5 / 10 / 15


@app.post("/api/proposals/script")
def api_pt_script(body: PtScriptIn):
    """발표 큐시트 생성."""
    proposal_text = _get_proposal_text_for_conv(body.conversation_id)
    if not proposal_text:
        raise HTTPException(404, "이 대화에서 작성된 제안서를 찾지 못했어요.")
    duration = max(3, min(60, int(body.duration_min or 10)))
    prompt = (PT_SCRIPT_PROMPT
              .replace("{DURATION_MIN}", str(duration))
              .replace("{PROPOSAL_TEXT}", proposal_text))
    try:
        client = require_client()
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
    except anthropic.APIError as e:
        raise HTTPException(502, translate_anthropic_error(e))
    except json.JSONDecodeError:
        raise HTTPException(502, "큐시트 생성 응답을 이해하지 못했어요. 다시 시도해 주세요.")
    return data


class PtQaIn(BaseModel):
    conversation_id: str


@app.post("/api/proposals/qa")
def api_pt_qa(body: PtQaIn):
    """예상 Q&A 생성."""
    proposal_text = _get_proposal_text_for_conv(body.conversation_id)
    if not proposal_text:
        raise HTTPException(404, "이 대화에서 작성된 제안서를 찾지 못했어요.")
    # client_id 추출 → RFP 분석 함께 주입
    with get_db() as db:
        row = db.execute(
            "SELECT client_id FROM conversations WHERE id=?",
            (body.conversation_id,),
        ).fetchone()
    rfp_text = ""
    if row:
        rfp_json = _get_rfp_aggregated(row["client_id"]) or {}
        rfp_text = json.dumps(rfp_json, ensure_ascii=False)[:3000]

    prompt = (PT_QA_PROMPT
              .replace("{RFP_TEXT}", rfp_text or "(RFP 분석 없음)")
              .replace("{PROPOSAL_TEXT}", proposal_text))
    try:
        client = require_client()
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _extract_text_from_resp(resp)
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
    except anthropic.APIError as e:
        raise HTTPException(502, translate_anthropic_error(e))
    except json.JSONDecodeError:
        raise HTTPException(502, "Q&A 생성 응답을 이해하지 못했어요. 다시 시도해 주세요.")
    return data


if __name__ == "__main__":
    import uvicorn
    init_db()
    uvicorn.run(app, host="127.0.0.1", port=8000)
