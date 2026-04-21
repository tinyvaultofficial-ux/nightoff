"""
BidPick - Korean Proposal Assistant Backend
FastAPI + SQLite (no ORM) + Anthropic SDK (streaming)
"""

from __future__ import annotations

import json
import os
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Generator, List, Optional

import anthropic
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import sqlite3

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
DB_PATH = Path(__file__).parent / "proposal.db"
UPLOADS_DIR = Path(__file__).parent / "uploads"
STATIC_DIR = Path(__file__).parent / "static"

UPLOADS_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

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
                id                  TEXT PRIMARY KEY,
                name                TEXT NOT NULL,
                company             TEXT DEFAULT '',
                description         TEXT DEFAULT '',
                nuance_summary      TEXT DEFAULT '',
                nuance_updated_at   TEXT,
                rfp_filename        TEXT DEFAULT '',
                rfp_analysis        TEXT DEFAULT '',
                rfp_uploaded_at     TEXT,
                competitor_analysis TEXT DEFAULT '',
                created_at          TEXT DEFAULT (datetime('now','localtime')),
                updated_at          TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id         TEXT PRIMARY KEY,
                client_id  TEXT NOT NULL,
                title      TEXT DEFAULT '새 대화',
                ended_at   TEXT,
                created_at TEXT,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS messages (
                id              TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role            TEXT NOT NULL,
                content         TEXT,
                created_at      TEXT,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS refs (
                id              TEXT PRIMARY KEY,
                client_id       TEXT NOT NULL,
                filename        TEXT,
                stored_filename TEXT,
                file_ext        TEXT,
                file_type       TEXT,
                memo            TEXT DEFAULT '',
                analysis        TEXT DEFAULT '',
                created_at      TEXT,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );
        """)


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row) if row else {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SettingsBody(BaseModel):
    data: dict


class ClientBody(BaseModel):
    name: str
    company: Optional[str] = ""
    description: Optional[str] = ""


class ConvBody(BaseModel):
    title: Optional[str] = "새 대화"


class MsgBody(BaseModel):
    content: str
    reference_ids: List[str] = Field(default_factory=list)


class CompetitorBody(BaseModel):
    competitor_analysis: Optional[str] = ""


class CompetitorAnalyzeBody(BaseModel):
    companies: List[str] = Field(default_factory=list)


class RefMemoBody(BaseModel):
    memo: Optional[str] = ""


# ---------------------------------------------------------------------------
# API key helper
# ---------------------------------------------------------------------------

def get_api_key() -> str:
    with get_db() as db:
        row = db.execute("SELECT value FROM settings WHERE key = 'api_key'").fetchone()
    if row and row["value"]:
        return row["value"]
    env_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if env_key:
        return env_key
    raise HTTPException(status_code=400, detail="Anthropic API 키가 설정되지 않았습니다.")


# ---------------------------------------------------------------------------
# File text extraction
# ---------------------------------------------------------------------------

def extract_text(filename: str, data: bytes) -> str:
    ext = Path(filename).suffix.lower()
    try:
        if ext == ".pdf":
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(data))
            parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    parts.append(text)
            return "\n".join(parts)[:60000]
        elif ext in (".docx",):
            import io
            import docx
            doc = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs)[:60000]
        elif ext in (".txt", ".md"):
            return data.decode("utf-8", errors="ignore")[:60000]
        else:
            return data.decode("utf-8", errors="ignore")[:60000]
    except Exception as e:
        return f"[파일 텍스트 추출 실패: {e}]"


def extract_pdf_text_short(data: bytes) -> str:
    try:
        import io
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
        return "\n".join(parts)[:15000]
    except Exception as e:
        return f"[PDF 텍스트 추출 실패: {e}]"


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

REF_ANALYSIS_PROMPT = """당신은 제안서 전략 전문가입니다.
첨부된 참고 자료를 분석하여 다음 관점에서 핵심 인사이트를 추출하세요:
1. 제안서 작성에 활용 가능한 핵심 메시지 및 차별화 포인트
2. 경쟁사 대비 우위 요소
3. 고객 니즈 및 페인포인트
4. 전략적 활용 방안
분석 결과를 간결하고 실용적으로 작성하세요."""

LAYOUT_CSS = """/* A4 Layout — BidPick (흑백 전용) */
*, *::before, *::after {{
  box-sizing: border-box;
  color: inherit;
}}
body {{
  margin: 0;
  font-family: 'SUIT', 'Apple SD Gothic Neo', sans-serif;
  background: #fff;
  color: #111;
}}
a {{ color: #333; }}
/* 컬러 강제 흑백 오버라이드 */
[style*="color:#"] {{ color: inherit !important; }}
[style*="background:#0"] {{ background: #f5f5f5 !important; }}
[style*="background:#1"] {{ background: #111 !important; }}
[style*="background:#7"] {{ background: #555 !important; }}
[style*="background:rgb"] {{ background: #f5f5f5 !important; }}
.a4-page {{
  width: {width}mm;
  min-height: {height}mm;
  padding: {pad_tb}mm {pad_lr}mm;
  position: relative;
  overflow: hidden;
  background: #ffffff;
  page-break-after: always;
  display: flex;
  flex-direction: column;
  color: #111;
}}
.section-label {{
  position: absolute;
  top: 8mm;
  left: {pad_lr}mm;
  font-size: 9pt;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  border-bottom: 1px solid #ddd;
  padding-bottom: 1mm;
}}
.page-heading {{
  margin-top: 10mm;
  margin-bottom: 6mm;
}}
.page-subtitle {{
  font-size: 10pt;
  color: #666;
  margin-bottom: 2mm;
  font-weight: 500;
}}
.governing-msg {{
  font-size: 22pt;
  font-weight: 800;
  line-height: 1.2;
  color: #000;
  letter-spacing: -0.02em;
}}
.page-content {{
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4mm;
  color: #222;
}}
/* 공통 콘텐츠 요소 흑백 */
.page-content h1,.page-content h2,.page-content h3 {{ color: #111; }}
.page-content p,.page-content li,.page-content td {{ color: #333; }}
.page-content table {{ border-collapse: collapse; width: 100%; }}
.page-content th {{ background: #f0f0f0; color: #111; font-weight:700; padding:3mm 4mm; border:1px solid #ddd; }}
.page-content td {{ padding:2.5mm 4mm; border:1px solid #e5e5e5; }}
.page-content tr:nth-child(even) {{ background: #fafafa; }}
.page-content .highlight, .page-content .accent, .page-content .color {{ color: #111 !important; background: #f5f5f5 !important; }}
.page-content .badge, .page-content .tag, .page-content .chip {{ background: #ebebeb !important; color: #333 !important; border:1px solid #ddd !important; }}
.page-content .card, .page-content .box {{ background: #fafafa !important; border:1px solid #e0e0e0 !important; }}
/* 진행률/수치 시각화 흑백 */
.bar-fill {{ background: #333 !important; }}
.progress-bar {{ background: #e5e5e5 !important; }}
.icon-circle {{ background: #ebebeb !important; color: #333 !important; }}
.summary-bar {{
  margin-left: -{pad_lr}mm;
  margin-right: -{pad_lr}mm;
  margin-bottom: -{pad_tb}mm;
  padding: 5mm {pad_lr}mm;
  background: #111111;
  color: #ffffff;
  font-size: 9pt;
  line-height: 1.6;
  display: flex;
  gap: 8mm;
  align-items: flex-start;
}}
.summary-bar * {{ color: #fff !important; }}
.img-hint {{
  font-size: 8pt;
  color: #bbb;
  font-style: italic;
  margin-top: 2mm;
}}"""


def build_system_prompt(client: dict, refs: Optional[list] = None) -> str:
    # Parse RFP analysis
    rfp_analysis = client.get("rfp_analysis", "") or ""
    rfp_data = {}
    if rfp_analysis:
        try:
            rfp_data = json.loads(rfp_analysis)
        except Exception:
            rfp_data = {}

    fmt = rfp_data.get("format", {}) or {}
    orientation = fmt.get("orientation", "landscape").lower()
    page_limit = fmt.get("page_limit", None)

    if orientation == "portrait":
        width, height = 210, 297
        pad_tb, pad_lr = 18, 22
    else:
        width, height = 297, 210
        pad_tb, pad_lr = 13, 20

    layout_css = LAYOUT_CSS.format(
        width=width, height=height,
        pad_tb=pad_tb, pad_lr=pad_lr
    )

    # Client info
    client_section = f"""## 고객 정보
- 고객명: {client.get('name', '')}
- 회사명: {client.get('company', '')}
- 설명: {client.get('description', '')}"""

    # RFP section
    rfp_section = ""
    if rfp_data:
        rfp_section = f"""
## RFP 분석
```json
{json.dumps(rfp_data, ensure_ascii=False, indent=2)}
```"""

    # Competitor section
    competitor_analysis = client.get("competitor_analysis", "") or ""
    competitor_section = ""
    if competitor_analysis:
        competitor_section = f"""
## 경쟁사 분석
{competitor_analysis}"""

    # Nuance section
    nuance_summary = client.get("nuance_summary", "") or ""
    nuance_section = ""
    if nuance_summary:
        nuance_section = f"""
## 고객 성향 및 누적 인사이트
{nuance_summary}"""

    # References section
    refs_section = ""
    if refs:
        ref_parts = []
        for r in refs:
            analysis = r.get("analysis", "") or ""
            memo = r.get("memo", "") or ""
            filename = r.get("filename", "")
            if analysis or memo:
                ref_parts.append(
                    f"### 참고자료: {filename}\n"
                    + (f"메모: {memo}\n" if memo else "")
                    + (f"분석:\n{analysis}" if analysis else "")
                )
        if ref_parts:
            refs_section = "\n## 참고자료 인사이트\n" + "\n\n".join(ref_parts)

    page_limit_instruction = ""
    if page_limit:
        page_limit_instruction = f"\n- 총 슬라이드 수는 {page_limit}페이지 이내로 작성하세요."

    system = f"""당신은 대한민국 최고의 제안서 전략가이자 카피라이터입니다.
고객의 RFP와 상황을 깊이 이해하고, 차별화된 제안서를 HTML 형식으로 작성합니다.

{client_section}{rfp_section}{competitor_section}{nuance_section}{refs_section}

## 제안서 작성 원칙
1. RFP 내용을 단순 반복하지 마세요 — 해석하고 전략화하세요.
2. "왜 우리인가"에 집중한 차별화 포인트를 부각하세요.
3. 고객의 진짜 니즈와 페인포인트를 꿰뚫는 메시지를 담으세요.
4. 경쟁사와 명확히 구분되는 우리만의 강점을 강조하세요.
5. 모든 주장은 구체적인 수치, 사례, 근거로 뒷받침하세요.
6. 절대 중단 금지 — 반드시 완성된 제안서를 끝까지 작성하세요.{page_limit_instruction}

## ⚠️ 색상 제한 (흑백 전용)
- 배경: 반드시 흰색(#fff, #fafafa, #f5f5f5) 계열만 사용
- 텍스트: 검정(#000, #111, #222)과 회색(#333, #444, #555, #666, #888, #999) 계열만 사용
- 포인트/강조: 진한 회색(#333) 또는 검정(#111)만 허용
- 하단 summary-bar: 배경 #111, 텍스트 #fff (유일하게 허용되는 검정 배경)
- 파란색, 빨간색, 초록색, 주황색, 보라색 등 모든 채도 있는 컬러 절대 사용 금지
- inline style에서 color, background-color 지정 시 반드시 흑백 계열만 사용

## HTML 출력 형식
제안서는 반드시 ```html 코드블록 안에 작성하세요.
각 슬라이드는 <div class="a4-page"> 구조를 사용하세요.

### 슬라이드 구조 (각 .a4-page 내부):
```
<div class="a4-page">
  <div class="section-label">섹션명</div>
  <div class="page-heading">
    <div class="page-subtitle">부제목</div>
    <div class="governing-msg">핵심 메시지 (크고 굵게)</div>
  </div>
  <div class="page-content">
    <!-- 본문 내용 (유연한 중간 영역) -->
  </div>
  <div class="summary-bar">
    <!-- 전체 폭 다크 하단 바 (블리드) — 핵심 요약 -->
  </div>
  <div class="img-hint">이미지 검색 키워드: ...</div>
</div>
```

### 레이아웃 CSS (이미 제공됨):
```css
{layout_css}
```

페이지 크기: {width}×{height}mm ({"가로" if orientation == "landscape" else "세로"} A4)
여백: 상하 {pad_tb}mm, 좌우 {pad_lr}mm
"""
    return system


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="BidPick API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files if directory exists and has content
if STATIC_DIR.exists():
    try:
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Settings endpoints
# ---------------------------------------------------------------------------

@app.get("/api/settings")
def get_settings():
    with get_db() as db:
        rows = db.execute("SELECT key, value FROM settings").fetchall()
    result = {r["key"]: r["value"] for r in rows}
    # Mask API key
    if "api_key" in result and result["api_key"]:
        key_val = result["api_key"]
        result["api_key"] = "****" + key_val[-4:] if len(key_val) > 4 else "****"
    return result


@app.post("/api/settings")
def save_settings(body: SettingsBody):
    with get_db() as db:
        for k, v in body.data.items():
            db.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (k, v)
            )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/api/dashboard")
def get_dashboard():
    with get_db() as db:
        total_clients = db.execute("SELECT COUNT(*) as c FROM clients").fetchone()["c"]

        active_proposals = db.execute(
            "SELECT COUNT(DISTINCT id) as c FROM conversations WHERE ended_at IS NULL"
        ).fetchone()["c"]

        now_dt = datetime.now()
        month_start = now_dt.strftime("%Y-%m-01")
        this_month_conversations = db.execute(
            "SELECT COUNT(*) as c FROM conversations WHERE created_at >= ?",
            (month_start,)
        ).fetchone()["c"]

        recent_client_row = db.execute(
            "SELECT * FROM clients ORDER BY updated_at DESC LIMIT 1"
        ).fetchone()
        recent_client = row_to_dict(recent_client_row) if recent_client_row else None

    return {
        "total_clients": total_clients,
        "active_proposals": active_proposals,
        "this_month_conversations": this_month_conversations,
        "recent_client": recent_client,
    }


# ---------------------------------------------------------------------------
# Clients endpoints
# ---------------------------------------------------------------------------

@app.get("/api/clients")
def list_clients():
    with get_db() as db:
        rows = db.execute("""
            SELECT
                c.*,
                COUNT(cv.id) as conversation_count,
                SUM(CASE WHEN cv.ended_at IS NULL THEN 1 ELSE 0 END) as active_conversation_count,
                MAX(cv.created_at) as last_conversation_at
            FROM clients c
            LEFT JOIN conversations cv ON cv.client_id = c.id
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        """).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/clients")
def create_client(body: ClientBody):
    cid = str(uuid.uuid4())
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as db:
        db.execute(
            "INSERT INTO clients (id, name, company, description, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (cid, body.name, body.company or "", body.description or "", now, now)
        )
        row = db.execute("SELECT * FROM clients WHERE id = ?", (cid,)).fetchone()
    return row_to_dict(row)


@app.get("/api/clients/{client_id}")
def get_client(client_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다.")
    return row_to_dict(row)


@app.put("/api/clients/{client_id}")
def update_client(client_id: str, body: ClientBody):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as db:
        db.execute(
            "UPDATE clients SET name=?, company=?, description=?, updated_at=? WHERE id=?",
            (body.name, body.company or "", body.description or "", now, client_id)
        )
        row = db.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다.")
    return row_to_dict(row)


@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str):
    # Collect stored filenames before deletion
    with get_db() as db:
        ref_rows = db.execute(
            "SELECT stored_filename FROM refs WHERE client_id = ?", (client_id,)
        ).fetchall()
        stored_files = [r["stored_filename"] for r in ref_rows if r["stored_filename"]]

        client_row = db.execute(
            "SELECT rfp_filename FROM clients WHERE id = ?", (client_id,)
        ).fetchone()
        if client_row and client_row["rfp_filename"]:
            stored_files.append(client_row["rfp_filename"])

        db.execute("DELETE FROM clients WHERE id = ?", (client_id,))

    # Delete files after DB deletion
    for fname in stored_files:
        fpath = UPLOADS_DIR / fname
        if fpath.exists():
            try:
                fpath.unlink()
            except Exception:
                pass

    return {"ok": True}


# ---------------------------------------------------------------------------
# Conversations endpoints
# ---------------------------------------------------------------------------

@app.get("/api/clients/{client_id}/conversations")
def list_conversations(client_id: str):
    with get_db() as db:
        rows = db.execute("""
            SELECT cv.*, COUNT(m.id) as message_count
            FROM conversations cv
            LEFT JOIN messages m ON m.conversation_id = cv.id
            WHERE cv.client_id = ?
            GROUP BY cv.id
            ORDER BY cv.created_at DESC
        """, (client_id,)).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/clients/{client_id}/conversations")
def create_conversation(client_id: str, body: ConvBody):
    with get_db() as db:
        client_row = db.execute("SELECT id FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not client_row:
            raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다.")

        cid = str(uuid.uuid4())
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db.execute(
            "INSERT INTO conversations (id, client_id, title, created_at) VALUES (?, ?, ?, ?)",
            (cid, client_id, body.title or "새 대화", now)
        )
        row = db.execute("SELECT * FROM conversations WHERE id = ?", (cid,)).fetchone()
    return row_to_dict(row)


@app.get("/api/conversations/{conv_id}")
def get_conversation(conv_id: str):
    with get_db() as db:
        conv_row = db.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        if not conv_row:
            raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다.")
        conv = dict(conv_row)

        msg_rows = db.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_id,)
        ).fetchall()
        conv["messages"] = [dict(r) for r in msg_rows]

        client_row = db.execute("SELECT * FROM clients WHERE id = ?", (conv["client_id"],)).fetchone()
        conv["client"] = row_to_dict(client_row) if client_row else {}

    return conv


@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    with get_db() as db:
        db.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
    return {"ok": True}


@app.post("/api/conversations/{conv_id}/end")
def end_conversation(conv_id: str):
    """End conversation and generate nuance summary via Claude."""
    with get_db() as db:
        conv_row = db.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        if not conv_row:
            raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다.")
        conv = dict(conv_row)

        msg_rows = db.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_id,)
        ).fetchall()
        messages = [dict(r) for r in msg_rows]

        client_row = db.execute("SELECT * FROM clients WHERE id = ?", (conv["client_id"],)).fetchone()
        client = row_to_dict(client_row) if client_row else {}
        old_nuance = client.get("nuance_summary", "") or ""

    if not messages:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with get_db() as db:
            db.execute("UPDATE conversations SET ended_at=? WHERE id=?", (now, conv_id))
        return {"ok": True, "nuance_summary": old_nuance}

    # Build conversation history for summarization
    history_text = "\n".join(
        f"[{m['role']}] {m['content'][:500]}" for m in messages
    )

    nuance_prompt = f"""다음은 제안서 작성 AI와 고객 담당자 간의 대화입니다.
이 대화에서 고객의 성향, 선호, 특이사항, 반복되는 피드백을 분석하여
향후 제안서 작성에 활용할 수 있는 핵심 인사이트를 간결하게 정리하세요.

기존 누적 인사이트:
{old_nuance}

이번 대화:
{history_text}

위 내용을 종합하여 고객 성향 요약을 업데이트하세요. 기존 인사이트와 새 내용을 통합하되,
중복은 제거하고 핵심만 남기세요. 500자 이내로 작성하세요."""

    api_key = get_api_key()
    claude = anthropic.Anthropic(api_key=api_key)

    try:
        response = claude.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2048,
            messages=[{"role": "user", "content": nuance_prompt}]
        )
        nuance_text = response.content[0].text if response.content else old_nuance
    except Exception:
        nuance_text = old_nuance

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as db:
        db.execute("UPDATE conversations SET ended_at=? WHERE id=?", (now, conv_id))
        db.execute(
            "UPDATE clients SET nuance_summary=?, nuance_updated_at=?, updated_at=? WHERE id=?",
            (nuance_text, now, now, conv["client_id"])
        )

    return {"ok": True, "nuance_summary": nuance_text}


# ---------------------------------------------------------------------------
# Messages / SSE streaming endpoint
# ---------------------------------------------------------------------------

@app.post("/api/conversations/{conv_id}/messages")
def send_message(conv_id: str, body: MsgBody):
    """Stream Claude response via SSE."""

    with get_db() as db:
        conv_row = db.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,)).fetchone()
        if not conv_row:
            raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다.")
        conv = dict(conv_row)

        client_row = db.execute("SELECT * FROM clients WHERE id = ?", (conv["client_id"],)).fetchone()
        client = row_to_dict(client_row) if client_row else {}

        # Get history
        msg_rows = db.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conv_id,)
        ).fetchall()
        history = [dict(r) for r in msg_rows]

        # Get client refs for system prompt
        ref_rows = db.execute(
            "SELECT * FROM refs WHERE client_id = ?", (conv["client_id"],)
        ).fetchall()
        all_refs = [dict(r) for r in ref_rows]

        # Get selected reference files content
        selected_refs = []
        if body.reference_ids:
            for rid in body.reference_ids:
                ref_row = db.execute("SELECT * FROM refs WHERE id = ?", (rid,)).fetchone()
                if ref_row:
                    selected_refs.append(dict(ref_row))

    # Build user message with ref content
    user_content = body.content
    if selected_refs:
        ref_texts = []
        for ref in selected_refs:
            stored = ref.get("stored_filename", "")
            fname = ref.get("filename", stored)
            if stored:
                fpath = UPLOADS_DIR / stored
                if fpath.exists():
                    data = fpath.read_bytes()
                    ext = Path(stored).suffix.lower()
                    if ext == ".pdf":
                        text = extract_pdf_text_short(data)
                    else:
                        text = extract_text(fname, data)[:15000]
                    ref_texts.append(f"[참고자료: {fname}]\n{text}")
        if ref_texts:
            user_content = user_content + "\n\n" + "\n\n---\n\n".join(ref_texts)

    # Build message list for Claude
    claude_messages = []
    for m in history:
        claude_messages.append({"role": m["role"], "content": m["content"]})
    claude_messages.append({"role": "user", "content": user_content})

    # Save user message
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    user_msg_id = str(uuid.uuid4())
    with get_db() as db:
        db.execute(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?,?,?,?,?)",
            (user_msg_id, conv_id, "user", body.content, now)
        )

    system_prompt = build_system_prompt(client, all_refs)
    api_key = get_api_key()
    client_id_for_update = conv["client_id"]

    def stream_generator():
        claude = anthropic.Anthropic(api_key=api_key)
        assistant_msg_id = str(uuid.uuid4())
        full_text = ""

        try:
            with claude.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=32000,
                system=system_prompt,
                messages=claude_messages,
            ) as stream:
                for text_chunk in stream.text_stream:
                    full_text += text_chunk
                    payload = json.dumps({"type": "text", "text": text_chunk}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"

        except Exception as e:
            err_payload = json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"

        finally:
            if full_text:
                save_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                try:
                    with get_db() as db:
                        db.execute(
                            "INSERT INTO messages (id, conversation_id, role, content, created_at) "
                            "VALUES (?,?,?,?,?)",
                            (assistant_msg_id, conv_id, "assistant", full_text, save_now)
                        )
                        db.execute(
                            "UPDATE clients SET updated_at=? WHERE id=?",
                            (save_now, client_id_for_update)
                        )
                except Exception:
                    pass

            done_payload = json.dumps({"type": "done", "message_id": assistant_msg_id}, ensure_ascii=False)
            yield f"data: {done_payload}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# References endpoints
# ---------------------------------------------------------------------------

@app.get("/api/clients/{client_id}/references")
def list_references(client_id: str):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM refs WHERE client_id = ? ORDER BY created_at DESC",
            (client_id,)
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/clients/{client_id}/references")
async def upload_reference(
    client_id: str,
    file: UploadFile = File(...),
    memo: str = Form(default=""),
):
    with get_db() as db:
        client_row = db.execute("SELECT id FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not client_row:
            raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다.")

    data = await file.read()
    original_name = file.filename or "unknown"
    ext = Path(original_name).suffix.lower()
    stored_name = f"{uuid.uuid4()}{ext}"
    fpath = UPLOADS_DIR / stored_name
    fpath.write_bytes(data)

    # Determine file type
    if ext == ".pdf":
        file_type = "pdf"
    elif ext in (".docx", ".doc"):
        file_type = "document"
    elif ext in (".txt", ".md"):
        file_type = "text"
    elif ext in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        file_type = "image"
    else:
        file_type = "other"

    rid = str(uuid.uuid4())
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as db:
        db.execute(
            "INSERT INTO refs (id, client_id, filename, stored_filename, file_ext, file_type, memo, created_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (rid, client_id, original_name, stored_name, ext, file_type, memo, now)
        )
        row = db.execute("SELECT * FROM refs WHERE id = ?", (rid,)).fetchone()
    return row_to_dict(row)


@app.put("/api/references/{ref_id}")
def update_reference(ref_id: str, body: RefMemoBody):
    with get_db() as db:
        row = db.execute("SELECT id FROM refs WHERE id = ?", (ref_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="참고자료를 찾을 수 없습니다.")
        db.execute("UPDATE refs SET memo=? WHERE id=?", (body.memo or "", ref_id))
        row = db.execute("SELECT * FROM refs WHERE id = ?", (ref_id,)).fetchone()
    return row_to_dict(row)


@app.delete("/api/references/{ref_id}")
def delete_reference(ref_id: str):
    with get_db() as db:
        row = db.execute("SELECT stored_filename FROM refs WHERE id = ?", (ref_id,)).fetchone()
        stored = row["stored_filename"] if row else None
        db.execute("DELETE FROM refs WHERE id = ?", (ref_id,))

    # File cleanup after DB deletion
    if stored:
        fpath = UPLOADS_DIR / stored
        if fpath.exists():
            try:
                fpath.unlink()
            except Exception:
                pass

    return {"ok": True}


@app.post("/api/references/{ref_id}/analyze")
def analyze_reference(ref_id: str):
    """SSE streaming analysis of a reference file."""
    with get_db() as db:
        row = db.execute("SELECT * FROM refs WHERE id = ?", (ref_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="참고자료를 찾을 수 없습니다.")
        ref = dict(row)

    stored = ref.get("stored_filename", "")
    fname = ref.get("filename", stored)
    if not stored:
        raise HTTPException(status_code=400, detail="파일이 없습니다.")

    fpath = UPLOADS_DIR / stored
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    data = fpath.read_bytes()
    text = extract_text(fname, data)
    memo = ref.get("memo", "") or ""

    prompt = f"""{REF_ANALYSIS_PROMPT}

파일명: {fname}
{f"메모: {memo}" if memo else ""}

파일 내용:
{text}"""

    api_key = get_api_key()

    def stream_generator():
        claude = anthropic.Anthropic(api_key=api_key)
        full_text = ""

        try:
            with claude.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for chunk in stream.text_stream:
                    full_text += chunk
                    payload = json.dumps({"type": "text", "text": chunk}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"

        except Exception as e:
            # Save partial on error
            if full_text:
                try:
                    with get_db() as db:
                        db.execute("UPDATE refs SET analysis=? WHERE id=?", (full_text, ref_id))
                except Exception:
                    pass
            err_payload = json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"
            return

        # Save completed analysis
        try:
            with get_db() as db:
                db.execute("UPDATE refs SET analysis=? WHERE id=?", (full_text, ref_id))
        except Exception:
            pass

        done_payload = json.dumps({"type": "done"}, ensure_ascii=False)
        yield f"data: {done_payload}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/references/{ref_id}/file")
def get_reference_file(ref_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM refs WHERE id = ?", (ref_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="참고자료를 찾을 수 없습니다.")
    ref = dict(row)
    stored = ref.get("stored_filename", "")
    if not stored:
        raise HTTPException(status_code=404, detail="파일이 없습니다.")
    fpath = UPLOADS_DIR / stored
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return FileResponse(
        path=str(fpath),
        filename=ref.get("filename", stored),
        media_type="application/octet-stream",
    )


# ---------------------------------------------------------------------------
# RFP endpoints
# ---------------------------------------------------------------------------

@app.post("/api/clients/{client_id}/rfp")
async def upload_rfp(client_id: str, file: UploadFile = File(...)):
    """Upload RFP and synchronously analyze with Claude."""
    with get_db() as db:
        client_row = db.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not client_row:
            raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다.")
        client = dict(client_row)

    # Remove old RFP file
    old_rfp = client.get("rfp_filename", "") or ""
    if old_rfp:
        old_path = UPLOADS_DIR / old_rfp
        if old_path.exists():
            try:
                old_path.unlink()
            except Exception:
                pass

    data = await file.read()
    original_name = file.filename or "rfp"
    ext = Path(original_name).suffix.lower()
    stored_name = f"rfp_{uuid.uuid4()}{ext}"
    fpath = UPLOADS_DIR / stored_name
    fpath.write_bytes(data)

    text = extract_text(original_name, data)

    rfp_prompt = f"""다음 RFP(제안요청서) 문서를 분석하여 아래 JSON 형식으로 정확하게 응답하세요.
반드시 유효한 JSON만 출력하세요. 설명이나 마크다운 없이 JSON 객체만 반환하세요.

{{
  "name": "사업명",
  "client": "발주처",
  "purpose": "사업 목적 (2-3문장)",
  "budget": "예산",
  "deadline": "제안서 제출 기한",
  "duration": "사업 기간",
  "requirements": ["주요 요구사항1", "주요 요구사항2"],
  "evaluation": ["평가 기준1 (배점)", "평가 기준2 (배점)"],
  "qualifications": ["자격 요건1", "자격 요건2"],
  "documents": ["필요 서류1", "필요 서류2"],
  "warnings": ["주의사항1", "주의사항2"],
  "strategy": "수주 전략 제언 (3-5문장)",
  "format": {{
    "orientation": "landscape 또는 portrait",
    "page_limit": null,
    "page_size": "A4"
  }}
}}

RFP 내용:
{text}"""

    api_key = get_api_key()
    claude = anthropic.Anthropic(api_key=api_key)

    fallback_analysis = json.dumps({
        "name": original_name,
        "client": "",
        "purpose": "",
        "budget": "",
        "deadline": "",
        "duration": "",
        "requirements": [],
        "evaluation": [],
        "qualifications": [],
        "documents": [],
        "warnings": [],
        "strategy": "",
        "format": {"orientation": "landscape", "page_limit": None, "page_size": "A4"}
    }, ensure_ascii=False)

    try:
        response = claude.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2048,
            messages=[{"role": "user", "content": rfp_prompt}]
        )
        analysis_text = response.content[0].text if response.content else ""
        analysis_text = analysis_text.strip()
        # Strip markdown fences if present
        if analysis_text.startswith("```"):
            lines = analysis_text.split("\n")
            inner = []
            for i, line in enumerate(lines):
                if i == 0:
                    continue
                if line.strip() == "```":
                    break
                inner.append(line)
            analysis_text = "\n".join(inner)
        # Validate JSON
        json.loads(analysis_text)
    except json.JSONDecodeError:
        analysis_text = fallback_analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RFP 분석 실패: {str(e)}")

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as db:
        db.execute(
            "UPDATE clients SET rfp_filename=?, rfp_analysis=?, rfp_uploaded_at=?, updated_at=? WHERE id=?",
            (stored_name, analysis_text, now, now, client_id)
        )
        row = db.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    return row_to_dict(row)


@app.delete("/api/clients/{client_id}/rfp")
def delete_rfp(client_id: str):
    with get_db() as db:
        row = db.execute("SELECT rfp_filename FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다.")
        stored = row["rfp_filename"] or ""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db.execute(
            "UPDATE clients SET rfp_filename='', rfp_analysis='', rfp_uploaded_at=NULL, updated_at=? WHERE id=?",
            (now, client_id)
        )

    if stored:
        fpath = UPLOADS_DIR / stored
        if fpath.exists():
            try:
                fpath.unlink()
            except Exception:
                pass

    return {"ok": True}


# ---------------------------------------------------------------------------
# Competitor endpoints
# ---------------------------------------------------------------------------

@app.put("/api/clients/{client_id}/competitor")
def update_competitor(client_id: str, body: CompetitorBody):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as db:
        row = db.execute("SELECT id FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다.")
        db.execute(
            "UPDATE clients SET competitor_analysis=?, updated_at=? WHERE id=?",
            (body.competitor_analysis or "", now, client_id)
        )
        updated = db.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
    return row_to_dict(updated)


@app.post("/api/clients/{client_id}/competitor/analyze")
def analyze_competitor(client_id: str, body: CompetitorAnalyzeBody):
    """SSE streaming competitor analysis."""
    with get_db() as db:
        client_row = db.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not client_row:
            raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다.")
        client = dict(client_row)

    companies = body.companies or []
    if not companies:
        raise HTTPException(status_code=400, detail="분석할 경쟁사를 입력하세요.")

    rfp_analysis = client.get("rfp_analysis", "") or ""
    rfp_context = ""
    if rfp_analysis:
        try:
            rfp_data = json.loads(rfp_analysis)
            rfp_context = f"\nRFP 사업명: {rfp_data.get('name', '')}\n사업 목적: {rfp_data.get('purpose', '')}"
        except Exception:
            pass

    companies_str = ", ".join(companies)
    prompt = f"""다음 경쟁사들을 분석하여 제안서 전략에 활용할 수 있는 정보를 JSON 배열로 반환하세요.
반드시 유효한 JSON 배열만 출력하세요. 설명이나 마크다운 없이 JSON 배열만 반환하세요.
{rfp_context}

경쟁사 목록: {companies_str}

형식:
[
  {{
    "name": "회사명",
    "strengths": ["강점1", "강점2"],
    "weaknesses": ["약점1", "약점2"],
    "diff": "우리가 이 경쟁사 대비 차별화할 수 있는 핵심 전략 (2-3문장)"
  }}
]"""

    api_key = get_api_key()

    def stream_generator():
        claude = anthropic.Anthropic(api_key=api_key)
        full_text = ""

        try:
            with claude.messages.stream(
                model="claude-sonnet-4-5",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for chunk in stream.text_stream:
                    full_text += chunk
                    payload = json.dumps({"type": "text", "text": chunk}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"

        except Exception as e:
            # Save partial on error
            if full_text:
                try:
                    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    with get_db() as db:
                        db.execute(
                            "UPDATE clients SET competitor_analysis=?, updated_at=? WHERE id=?",
                            (full_text, now, client_id)
                        )
                except Exception:
                    pass
            err_payload = json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"
            return

        # Save completed analysis — strip markdown fences if present
        try:
            clean_text = full_text.strip()
            if clean_text.startswith("```"):
                lines = clean_text.split("\n")
                inner = []
                for i, line in enumerate(lines):
                    if i == 0:
                        continue
                    if line.strip() == "```":
                        break
                    inner.append(line)
                clean_text = "\n".join(inner)
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with get_db() as db:
                db.execute(
                    "UPDATE clients SET competitor_analysis=?, updated_at=? WHERE id=?",
                    (clean_text, now, client_id)
                )
        except Exception:
            pass

        done_payload = json.dumps({"type": "done"}, ensure_ascii=False)
        yield f"data: {done_payload}\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# SPA fallback
# ---------------------------------------------------------------------------

@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return HTMLResponse(
        content="<html><body><h1>BidPick API</h1><p>Frontend not found.</p></body></html>",
        status_code=200,
    )


# ---------------------------------------------------------------------------
# Init DB at module level
# ---------------------------------------------------------------------------

init_db()
