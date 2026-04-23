"""
BidPick - 제안서 작성 전문가를 위한 AI 어시스턴트
FastAPI + SQLite + Anthropic Claude (streaming)
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Generator, Optional

import anthropic
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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
# DB helpers
# ---------------------------------------------------------------------------
@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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

            CREATE TABLE IF NOT EXISTS competitors (
                id           TEXT PRIMARY KEY,
                client_id    TEXT NOT NULL,
                name         TEXT NOT NULL,
                analysis     TEXT DEFAULT '',
                strengths    TEXT DEFAULT '[]',
                weaknesses   TEXT DEFAULT '[]',
                differentiator TEXT DEFAULT '',
                created_at   TEXT DEFAULT (datetime('now','localtime')),
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_conv_client ON conversations(client_id);
            CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_nuance_client ON nuance_memories(client_id);
            CREATE INDEX IF NOT EXISTS idx_ref_client ON references_lib(client_id);
            CREATE INDEX IF NOT EXISTS idx_comp_client ON competitors(client_id);
        """)


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
    return get_setting("anthropic_api_key", "") or os.environ.get("ANTHROPIC_API_KEY", "")


def require_client() -> anthropic.Anthropic:
    key = get_api_key()
    if not key:
        raise HTTPException(status_code=400, detail="API 키가 설정되지 않았습니다. 좌하단 설정에서 등록해주세요.")
    return anthropic.Anthropic(api_key=key)


# ---------------------------------------------------------------------------
# File text extraction
# ---------------------------------------------------------------------------
def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    try:
        if suffix == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            return "\n\n".join((p.extract_text() or "") for p in reader.pages)
        if suffix in (".docx", ".doc"):
            from docx import Document
            doc = Document(str(path))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        if suffix in (".txt", ".md"):
            return path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        return f"[파일 텍스트 추출 실패: {e}]"
    return ""


def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f}{unit}" if unit != "B" else f"{n}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------
PROPOSAL_SYSTEM_PROMPT = """당신은 대한민국 최고 수준의 제안서 작성 전문가이자 크리에이티브 디렉터입니다.
BidPick의 AI 엔진으로, 발주처를 설득하는 제안서를 한국어로 작성합니다.

[작성 원칙]
1. RFP를 단순 재각색하지 않고 독창적 전략과 차별화 포인트를 반드시 담는다.
2. 경쟁사 분석을 반영해 "왜 우리가 선택받아야 하는가"를 서사 중심으로 전개한다.
3. RFP에서 발주처 성격(공공기관/민간기업/대기업/스타트업)을 자동 판별해 톤앤매너를 맞춘다.
   - 공공기관: 신뢰성/공공성/절차 준수 강조
   - 대기업: 규모/안정성/ROI 중심
   - 스타트업: 속도/유연성/임팩트 중심
4. 주어진 레퍼런스 라이브러리의 패턴(문체, 구조, 접근법)을 학습해 새 제안서에 반영한다.
5. 대화 기억(nuance)에 담긴 클라이언트 선호·맥락을 반드시 반영한다.

[출력 모드 판별]
사용자가 "제안서 작성", "초안 만들어", "페이지 구성해", "전체 제안서", "1페이지", "구성안" 등
제안서 생성을 명확히 요청하면 ▣제안서 모드로, 그 외에는 일반 대화(plain text)로 응답한다.

[제안서 모드 출력 형식 — 반드시 이 형식만 사용]
제안서 전체를 아래 HTML 구조로 감싸서 출력한다. 코드블록(```) 금지. 실제 HTML 태그만 출력.

<div class="proposal" data-orientation="landscape|portrait" data-title="제안서 제목" data-client-type="공공|대기업|민간|스타트업" data-page-limit="숫자 또는 빈값">
  <div class="proposal-page" data-section="섹션명" data-keyword="google image search keyword (영문 소문자)">
    <div class="page-section-name">섹션명(작게, 상단좌측)</div>
    <div class="page-governing">거버닝 메시지 — 한 문장, 크고 굵게</div>
    <div class="page-content">
      <!-- 페이지마다 중단 레이아웃을 다양하게 설계 -->
    </div>
    <div class="page-summary">핵심 요약 한 줄 강조</div>
  </div>
  <!-- page를 내용 분량에 따라 6~15개 생성 -->
</div>

[시각화 블록 — 반드시 내용에 맞는 블록을 조합해 사용]
(모든 페이지는 반드시 1개 이상의 시각화 요소를 포함한다. 텍스트 문단만으로 구성 금지)

- 카드 그리드(전략/구조 설명):
  <div class="card-grid cols-3"><div class="card"><div class="card-title">..</div><div class="card-body">..</div></div>...</div>

- 스텝 플로우(단계적 절차):
  <div class="step-flow"><div class="step"><div class="step-num">01</div><div class="step-title">..</div><div class="step-desc">..</div></div>...</div>

- 화살표 흐름도(프로세스/변화):
  <div class="arrow-flow"><div class="flow-node">현재</div><span class="flow-arrow">→</span><div class="flow-node">중간</div><span class="flow-arrow">→</span><div class="flow-node">최종</div></div>

- 숫자 리스트(순서있는 포인트):
  <ol class="num-list"><li><b>제목</b><span>설명</span></li>...</ol>

- 비교 표(항목별 비교/정리):
  <table class="compare-table"><thead><tr><th>항목</th><th>A안</th><th>B안</th></tr></thead><tbody>...</tbody></table>

- 좌우 2단 비교(대비 강조):
  <div class="two-col"><div class="col"><h4 class="col-title">기존 방식</h4><p>..</p></div><div class="col"><h4 class="col-title">제안 방식</h4><p>..</p></div></div>

- 진행바 리스트(수치/역량 비교):
  <div class="progress-list">
    <div class="pl-item"><span class="pl-label">클라우드 전문성</span><span class="pl-pct">95%</span><div class="pl-bar"><span style="width:95%"></span></div></div>
    <div class="pl-item"><span class="pl-label">..</span><span class="pl-pct">70%</span><div class="pl-bar"><span style="width:70%"></span></div></div>
  </div>

- 도넛 차트(비율 강조, SVG 필수):
  <div class="donut-grid"><div class="donut">
    <svg viewBox="0 0 42 42"><circle class="donut-bg" cx="21" cy="21" r="15.915" fill="transparent" stroke-width="3.5"/><circle class="donut-fg" cx="21" cy="21" r="15.915" fill="transparent" stroke-width="3.5" stroke-dasharray="75 25" stroke-dashoffset="25" transform="rotate(-90 21 21)"/></svg>
    <div><div class="donut-text-big">75%</div><div class="donut-text-label">고객 만족</div></div>
  </div>...</div>
  (stroke-dasharray의 첫 숫자 = 퍼센트, 두번째 = 100-퍼센트)

- 벤다이어그램(교집합/관계):
  <div class="venn">
    <div class="venn-circle venn-a">기술 역량</div>
    <div class="venn-circle venn-b">산업 이해</div>
    <div class="venn-overlap-label">우리의 차별점</div>
  </div>

- 배지/태그(핵심 키워드):
  <div class="p-tag-group"><span class="p-badge">키워드1</span><span class="p-badge p-badge-filled">중요</span>...</div>

- 전략 박스(전략 포인트 강조):
  <div class="strategy-grid"><div class="strategy-box"><div class="sb-label">STRATEGY 01</div><h3 class="sb-title">..</h3><p class="sb-body">..</p></div>...</div>

- 강조 통계(큰 숫자 하나):
  <div class="stat-highlight"><div class="stat-big">35%</div><div class="stat-label">비용 절감</div></div>

- 큰 숫자 섹션 구분(섹션 전환 페이지):
  <div class="divider-intro"><div class="divider-num">02</div><div class="divider-title">전략 개요</div></div>

- 타임라인(일정/추진 계획):
  <div class="timeline"><div class="tl-item"><div class="tl-date">Phase 1</div><div class="tl-body">..</div></div>...</div>

- 인용 콜아웃(고객 메시지/주장):
  <div class="quote-callout">"..."</div>

- 이미지 영역(사진 삽입 자리):
  <div class="img-placeholder">이미지: 설명</div>

[내용별 시각화 매핑 가이드]
- 비교/정리 → 비교 표(compare-table) 또는 좌우 2단(two-col)
- 관계/교집합 → 벤다이어그램(venn)
- 프로세스/단계 → 스텝 플로우(step-flow) 또는 화살표 흐름도(arrow-flow)
- 수치/비율 → 진행바 리스트(progress-list) 또는 도넛 차트(donut)
- 핵심 키워드 → 배지/태그(p-badge)
- 전략/구조 → 전략 박스(strategy-box, strategy-grid) 또는 카드 그리드

[디자인 원칙 — 반드시 준수, 위반 시 폐기]
- 완전 흑백 제안서: 어떤 색상도 사용하지 말 것(포인트 컬러 포함 금지).
- 색상은 오직 검정(#111827), 회색(#4b5563, #6b7280), 연회색(#d1d5db, #e5e7eb), 흰색(#ffffff)만 사용.
- 인라인 style 속성에서 color / background-color / fill / stroke 지정 금지(도넛의 stroke-dasharray 등 구조 수치만 허용).
- 강조는 굵기·크기·테두리·간격·레이아웃으로만 준다.
- 섹션 구분 페이지는 큰 숫자(01~)나 굵은 기호로 임팩트를 준다(divider-intro).
- 디자이너가 나중에 색상을 입힐 흑백 뼈대를 제공하는 것이 목적.

[페이지 구성 원칙]
- 섹션 순서 예시: 표지 → 프로젝트 이해 → 발주처 인사이트 → 핵심 전략/컨셉 → 실행 방안 → 차별화 포인트 → 추진 일정 → 기대 효과 → 수행 조직 → 맺음말.
- 표지(첫 페이지)는 거버닝 메시지를 가장 크게, 섹션명은 "COVER" 또는 생략.
- 각 페이지의 data-keyword는 해당 페이지 내용을 대표하는 영문 구글 이미지 검색 키워드.
- 페이지 수 제한(data-page-limit)이 RFP에 명시되면 반드시 준수.

[제안서 형식 자동 판별]
- 기본값: landscape (A4 가로).
- RFP에 "세로", "portrait", "A4 세로" 명시 시 portrait.
- 페이지 수 제한 명시 시 data-page-limit에 숫자 기입.

[금지]
- 코드블록(```) 사용 금지. HTML만 직접 출력.
- 일반 대화 모드에서는 <div class="proposal">를 절대 출력하지 말 것.
- 제안서 모드에서 설명문(예: "다음은 제안서입니다")을 앞뒤에 덧붙이지 말고 즉시 <div class="proposal">로 시작.
"""


RFP_ANALYSIS_PROMPT = """당신은 RFP(제안요청서) 분석 전문가입니다.
아래 RFP 원문을 읽고 핵심 정보를 JSON으로 추출하세요. JSON 외의 어떤 텍스트도 출력하지 마세요.

추출 스키마:
{
  "title": "사업/과업명",
  "client_type": "공공|대기업|민간|스타트업",
  "deadline": "YYYY-MM-DD 또는 빈 문자열",
  "budget": "예산(원 단위 표기)",
  "orientation": "landscape|portrait",
  "page_limit": 숫자 또는 null,
  "submission_format": "제출 형식 설명",
  "key_requirements": ["핵심 요구사항 5-8개"],
  "evaluation_criteria": [{"item": "평가항목", "weight": "배점"}],
  "risk_points": ["리스크/주의사항 3-5개"],
  "summary": "전체 3문장 요약"
}

RFP 원문:
---
{RFP_TEXT}
---

JSON:"""


REFERENCE_SUMMARY_PROMPT = """아래 문서를 제안서 작성의 레퍼런스로 활용할 수 있도록 요약하세요.
문체·구조·핵심 메시지·숫자 등 제안서에 재활용할 만한 패턴 중심으로 5문장 이내.
JSON 스키마:
{"summary": "요약문", "reusable_patterns": ["패턴1", "패턴2", "패턴3"]}
JSON만 출력.

문서:
---
{DOC_TEXT}
---

JSON:"""


COMPETITOR_ANALYSIS_PROMPT = """다음 기업을 제안 경쟁사로 분석하세요. 인포그래픽용 5줄 이내 요약.
JSON 스키마:
{
  "strengths": ["강점 3개 이내 (각 12자 이내)"],
  "weaknesses": ["약점 3개 이내 (각 12자 이내)"],
  "differentiator": "우리가 이길 차별화 포인트 (한 문장, 25자 이내)",
  "summary": "종합 분석 (2문장, 총 80자 이내)"
}
JSON만 출력.

경쟁사명: {COMPANY}
추가 컨텍스트: {CONTEXT}

JSON:"""


NUANCE_SUMMARY_PROMPT = """아래 대화를 기반으로, 이 클라이언트와의 이후 대화에 이어갈 수 있도록
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
app = FastAPI(title="BidPick")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


# ---------- Static ----------
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index():
    return FileResponse(str(STATIC_DIR / "index.html"))


@app.get("/favicon.ico")
def favicon():
    return JSONResponse({}, status_code=204)


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


class CompetitorIn(BaseModel):
    name: str
    context: str = ""


# ---------- Settings ----------
@app.get("/api/settings")
def api_settings_get():
    key = get_api_key()
    masked = ""
    if key:
        masked = f"{key[:10]}...{key[-4:]}" if len(key) > 16 else "********"
    return {
        "has_key": bool(key),
        "masked_key": masked,
        "model": get_setting("model", MODEL_DEFAULT),
    }


@app.post("/api/settings")
def api_settings_set(body: SettingsIn):
    if body.api_key is not None:
        set_setting("anthropic_api_key", body.api_key.strip())
    if body.model:
        set_setting("model", body.model.strip())
    return api_settings_get()


# ---------- Stats ----------
@app.get("/api/stats")
def api_stats():
    with get_db() as db:
        total_clients = db.execute("SELECT COUNT(*) c FROM clients").fetchone()["c"]
        active_convs = db.execute("SELECT COUNT(*) c FROM conversations WHERE ended=0").fetchone()["c"]
        total_msgs = db.execute("SELECT COUNT(*) c FROM messages").fetchone()["c"]
        rfps = db.execute("SELECT COUNT(*) c FROM rfp_docs").fetchone()["c"]
    return {
        "total_clients": total_clients,
        "active_conversations": active_convs,
        "total_messages": total_msgs,
        "rfp_count": rfps,
    }


# ---------- Clients ----------
@app.get("/api/clients")
def api_clients_list():
    with get_db() as db:
        rows = db.execute("""
            SELECT c.*,
              (SELECT COUNT(*) FROM conversations cv WHERE cv.client_id=c.id) conv_count,
              (SELECT MAX(created_at) FROM conversations cv WHERE cv.client_id=c.id) last_conv,
              (SELECT COUNT(*) FROM rfp_docs r WHERE r.client_id=c.id) has_rfp,
              (SELECT COUNT(*) FROM nuance_memories n WHERE n.client_id=c.id) memory_count
            FROM clients c
            ORDER BY c.updated_at DESC
        """).fetchall()
    return [dict(r) for r in rows]


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
            raise HTTPException(404, "클라이언트를 찾을 수 없습니다.")
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
            raise HTTPException(404, "클라이언트를 찾을 수 없습니다.")
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
            raise HTTPException(404, "클라이언트를 찾을 수 없습니다.")
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
        rfp = db.execute("SELECT * FROM rfp_docs WHERE client_id=?", (conv["client_id"],)).fetchone()
    return {
        "conversation": dict(conv),
        "messages": [dict(m) for m in msgs],
        "client": dict(client) if client else None,
        "rfp_analysis": json.loads(rfp["analysis_json"]) if rfp else None,
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
        raw = resp.content[0].text.strip()
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
def _build_system_prompt(client_id: str) -> str:
    """RFP 분석, 경쟁사, 뉘앙스, 레퍼런스를 시스템 프롬프트에 주입."""
    with get_db() as db:
        client = db.execute("SELECT * FROM clients WHERE id=?", (client_id,)).fetchone()
        rfp = db.execute("SELECT * FROM rfp_docs WHERE client_id=?", (client_id,)).fetchone()
        refs = db.execute(
            "SELECT filename,summary FROM references_lib WHERE client_id=? ORDER BY created_at",
            (client_id,),
        ).fetchall()
        comps = db.execute(
            "SELECT name,analysis,strengths,weaknesses,differentiator FROM competitors WHERE client_id=?",
            (client_id,),
        ).fetchall()
        memories = db.execute(
            "SELECT category,content,tags FROM nuance_memories WHERE client_id=? ORDER BY created_at DESC LIMIT 30",
            (client_id,),
        ).fetchall()

    parts = [PROPOSAL_SYSTEM_PROMPT, ""]

    if client:
        parts.append(f"[현재 클라이언트]\n- 이름: {client['name']}\n- 업종: {client['industry']}\n- 담당자: {client['manager']}\n- 메모: {client['memo']}")

    if rfp and rfp["analysis_json"]:
        try:
            a = json.loads(rfp["analysis_json"])
            parts.append("[RFP 분석]\n" + json.dumps(a, ensure_ascii=False, indent=2))
        except Exception:
            pass

    if refs:
        ref_str = "\n".join(f"- {r['filename']}: {r['summary']}" for r in refs if r["summary"])
        if ref_str:
            parts.append(f"[레퍼런스 라이브러리 — 패턴 반영]\n{ref_str}")

    if comps:
        lines = []
        for c in comps:
            s = json.loads(c["strengths"] or "[]")
            w = json.loads(c["weaknesses"] or "[]")
            lines.append(f"- {c['name']}: 강점={s}, 약점={w}, 차별화={c['differentiator']}")
        parts.append("[경쟁사 분석]\n" + "\n".join(lines))

    if memories:
        lines = [f"- [{m['category']}] {m['content']}" for m in memories]
        parts.append("[대화 기억(뉘앙스)]\n" + "\n".join(lines))

    return "\n\n".join(parts)


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

    system_prompt = _build_system_prompt(client_id)
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
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','error':str(e)})}\n\n"
        finally:
            with get_db() as db:
                db.execute(
                    "INSERT INTO messages(id,conversation_id,role,content) VALUES(?,?,?,?)",
                    (assistant_id, conv_id, "assistant", full_text),
                )

    return StreamingResponse(stream(), media_type="text/event-stream")


# ---------- RFP ----------
@app.post("/api/clients/{cid}/rfp")
async def api_rfp_upload(cid: str, file: UploadFile = File(...)):
    with get_db() as db:
        c = db.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone()
        if not c:
            raise HTTPException(404, "클라이언트를 찾을 수 없습니다.")

    safe_name = re.sub(r"[^\w\.\-가-힣]", "_", file.filename or "rfp")
    save_path = UPLOADS_DIR / f"{cid}_rfp_{uuid.uuid4().hex[:6]}_{safe_name}"
    content = await file.read()
    save_path.write_bytes(content)

    text = extract_text(save_path)[:30000]

    # Claude 분석
    analysis = {}
    try:
        client = require_client()
        prompt = RFP_ANALYSIS_PROMPT.replace("{RFP_TEXT}", text or "(본문 추출 실패)")
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        analysis = json.loads(raw)
    except HTTPException:
        raise
    except Exception as e:
        analysis = {"error": f"분석 실패: {e}", "summary": text[:500]}

    with get_db() as db:
        db.execute("DELETE FROM rfp_docs WHERE client_id=?", (cid,))
        db.execute(
            "INSERT INTO rfp_docs(id,client_id,filename,filepath,raw_text,analysis_json) "
            "VALUES(?,?,?,?,?,?)",
            (
                uuid.uuid4().hex[:12],
                cid,
                file.filename or safe_name,
                str(save_path),
                text,
                json.dumps(analysis, ensure_ascii=False),
            ),
        )

    return {"ok": True, "analysis": analysis, "filename": file.filename}


@app.get("/api/clients/{cid}/rfp")
def api_rfp_get(cid: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM rfp_docs WHERE client_id=?", (cid,)).fetchone()
    if not row:
        return {"has_rfp": False}
    analysis = {}
    try:
        analysis = json.loads(row["analysis_json"])
    except Exception:
        pass
    return {
        "has_rfp": True,
        "filename": row["filename"],
        "created_at": row["created_at"],
        "analysis": analysis,
    }


@app.delete("/api/clients/{cid}/rfp")
def api_rfp_delete(cid: str):
    with get_db() as db:
        row = db.execute("SELECT filepath FROM rfp_docs WHERE client_id=?", (cid,)).fetchone()
        if row and row["filepath"]:
            try:
                Path(row["filepath"]).unlink(missing_ok=True)
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
            raise HTTPException(404, "클라이언트를 찾을 수 없습니다.")

    safe_name = re.sub(r"[^\w\.\-가-힣]", "_", file.filename or "ref")
    save_path = UPLOADS_DIR / f"{cid}_ref_{uuid.uuid4().hex[:6]}_{safe_name}"
    content = await file.read()
    save_path.write_bytes(content)

    text = extract_text(save_path)[:20000]

    summary = ""
    try:
        client = require_client()
        prompt = REFERENCE_SUMMARY_PROMPT.replace("{DOC_TEXT}", text or "(추출 실패)")
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        summary = data.get("summary", "")
        patterns = data.get("reusable_patterns", [])
        if patterns:
            summary += " | 패턴: " + ", ".join(patterns[:3])
    except HTTPException:
        raise
    except Exception as e:
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
    return {"ok": True}


# ---------- Competitors ----------
@app.get("/api/clients/{cid}/competitors")
def api_comp_list(cid: str):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM competitors WHERE client_id=? ORDER BY created_at DESC", (cid,)
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["strengths"] = json.loads(d["strengths"] or "[]")
        d["weaknesses"] = json.loads(d["weaknesses"] or "[]")
        out.append(d)
    return out


@app.post("/api/clients/{cid}/competitors")
def api_comp_add(cid: str, body: CompetitorIn):
    with get_db() as db:
        c = db.execute("SELECT id FROM clients WHERE id=?", (cid,)).fetchone()
        if not c:
            raise HTTPException(404, "클라이언트를 찾을 수 없습니다.")

    try:
        client = require_client()
        prompt = (COMPETITOR_ANALYSIS_PROMPT
                  .replace("{COMPANY}", body.name)
                  .replace("{CONTEXT}", body.context or "(없음)"))
        resp = client.messages.create(
            model=get_setting("model", MODEL_DEFAULT),
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
    except HTTPException:
        raise
    except Exception as e:
        data = {
            "strengths": [], "weaknesses": [], "differentiator": "",
            "summary": f"분석 실패: {e}",
        }

    cid_new = uuid.uuid4().hex[:12]
    with get_db() as db:
        db.execute(
            "INSERT INTO competitors(id,client_id,name,analysis,strengths,weaknesses,differentiator) "
            "VALUES(?,?,?,?,?,?,?)",
            (
                cid_new, cid, body.name, data.get("summary", ""),
                json.dumps(data.get("strengths") or [], ensure_ascii=False),
                json.dumps(data.get("weaknesses") or [], ensure_ascii=False),
                data.get("differentiator", ""),
            ),
        )
    return {"ok": True, "id": cid_new, "data": data}


@app.delete("/api/competitors/{comp_id}")
def api_comp_delete(comp_id: str):
    with get_db() as db:
        db.execute("DELETE FROM competitors WHERE id=?", (comp_id,))
    return {"ok": True}


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


if __name__ == "__main__":
    import uvicorn
    init_db()
    uvicorn.run(app, host="127.0.0.1", port=8000)
