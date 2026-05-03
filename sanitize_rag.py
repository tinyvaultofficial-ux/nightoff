#!/usr/bin/env python3
"""RAG DB sanitize — 회사명 / 인명+직급 / 전화 / 이메일 / 자사 실적 마스킹.

dry-run mode default. --apply 옵션 시 실제 DB 변경 + 백업 + embedded=0 reset.
"""
import sqlite3, re, json, sys, random, shutil, datetime
from collections import Counter
from pathlib import Path

DB_PATH = Path("rag_kb.db")

# ─── 회사명 14개 (정규식 — 단어경계 + 영문/한글 변형) ───
# v2: 자동 추출 list 중 자사 leak 직접 증거 있는 2개 추가 (이엔씨커뮤니케이션스, 케이알씨지)
COMPANY_PATTERNS = [
    r"미디컴",
    r"마인즈그라운드",
    r"에이앤디자인",
    r"아이엠전시문화",
    r"어반플레이", r"URBANPLAY",
    r"디렉터즈",
    r"디노마드", r"\bDNMD\b",
    r"에이엑스", r"AXcorp\.?", r"\bAX\b",
    r"모츠", r"\bMOTZ\b",
    r"헤럴드",
    r"유니원",
    r"청청콘",
    r"이엔씨커뮤니케이션스",
    r"케이알씨지",
]
COMPANY_RE = re.compile("|".join(COMPANY_PATTERNS))

# ─── 자사 직급 어휘 ───
# v2: "대표" 별도 분리 (지역+대표 false positive 회피), 8개 추가, 사원 제외
# 콘텐츠 인명 (감독/가수/배우/강사/MC) 는 list 외라 보존됨
JOB_TITLES = [
    "PM", "팀장", "이사", "본부장", "수석", "차장", "부장", "과장", "매니저",
    "대리", "실장", "주임", "부사장", "전무", "상무", "사장", "회장",
]
NAME_BEFORE_JOB = re.compile(rf"[가-힣]{{2,4}}\s*(?:{'|'.join(JOB_TITLES)})\b")
NAME_AFTER_JOB = re.compile(rf"\b(?:{'|'.join(JOB_TITLES)})\s+[가-힣]{{2,4}}\b")

# ─── "대표" P3 정밀 매칭 (일반 명사 충돌 회피) ───
# 패턴 1: "대표이사" 단독 (명확한 자사 직급)
# 패턴 2: "대표" + 이름 (예: "대표 김철수")
# 패턴 3: 이름 + "대표이사" (예: "김철수 대표이사")
# → "아시아 대표 / 한국 대표 / 업계 대표 / 세계 대표" 같은 일반 표현 모두 보존
DAEPYO_RE = re.compile(
    r"대표이사"                       # 단독
    r"|대표\s+[가-힣]{2,4}\b"         # 대표 + 이름
    r"|[가-힣]{2,4}\s+대표이사\b"     # 이름 + 대표이사
)

# ─── 전화번호 (한국 형식 — 02/0XX 지역번호 + 휴대폰 01X) ───
PHONE_RE = re.compile(r"\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b")

# ─── 이메일 ───
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

# ─── 자사 실적 패턴 (chunk 안 자사명 [회사] 등장 시에만 적용) ───
PERFORM_RE = re.compile(r"\d+\s*(?:건|회|년)\s*(?:실적|수행|연속|진행|경험|운영|기획)")

# ─── sanitize 함수 ───
def sanitize(text):
    stats = Counter()
    company_hits = Counter()

    def repl_company(m):
        company_hits[m.group(0)] += 1
        stats["company"] += 1
        return "[회사]"
    text = COMPANY_RE.sub(repl_company, text)

    # v3: 인명+직급 / 대표 sanitize SKIP
    # 사용자 결정 (E2) — 회사명 sanitize 되면 인명 단독으로는 식별 불가, 사용자는 가명으로 인지.
    # OCR 띄어쓰기 누락 텍스트의 false positive 회피 (예: "박람회총괄PM" → "박[담당자]")
    # NAME_BEFORE_JOB / NAME_AFTER_JOB / DAEPYO_RE 정의는 코드 위쪽에 남겨두지만 호출 X
    # (향후 한국 성씨 list 등 정밀화 시 재활성화 가능)

    def repl_phone(m):
        stats["phone"] += 1
        return "[연락처]"
    text = PHONE_RE.sub(repl_phone, text)

    def repl_email(m):
        stats["email"] += 1
        return "[이메일]"
    text = EMAIL_RE.sub(repl_email, text)

    # 자사 실적 — chunk 안 [회사] placeholder 등장 시에만
    if "[회사]" in text:
        def repl_perform(m):
            stats["perform"] += 1
            return "[다수 실적]"
        text = PERFORM_RE.sub(repl_perform, text)

    return text, stats, company_hits


def main():
    apply_mode = "--apply" in sys.argv
    sample_n = 100  # before/after 출력 개수 — v2 검수용 확장

    if not DB_PATH.exists():
        print(f"❌ {DB_PATH} 없음")
        sys.exit(1)

    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row

    print(f"=== RAG sanitize {'APPLY' if apply_mode else 'DRY-RUN'} ===")

    rows = db.execute("SELECT rowid, chunk_id, filename, text FROM chunks").fetchall()
    print(f"  total chunks: {len(rows)}")

    total_stats = Counter()
    company_total = Counter()
    changed_payloads = []  # (rowid, new_text)
    samples_changed = []   # (chunk_id, before, after)

    for r in rows:
        new_text, st, ch = sanitize(r["text"])
        if new_text != r["text"]:
            changed_payloads.append((r["rowid"], new_text))
            samples_changed.append((r["chunk_id"], r["text"], new_text))
        for k, v in st.items():
            total_stats[k] += v
        for k, v in ch.items():
            company_total[k] += v

    chunks_changed = len(changed_payloads)
    print(f"  chunks changed: {chunks_changed} ({chunks_changed * 100.0 / max(1, len(rows)):.1f}%)")

    # random sample
    random.seed(42)
    if len(samples_changed) > sample_n:
        samples_changed = random.sample(samples_changed, sample_n)

    # 보고서 파일
    import io
    out = io.StringIO()
    out.write(f"# RAG sanitize {'APPLY' if apply_mode else 'DRY-RUN'} report\n\n")
    out.write(f"total chunks: {len(rows)}\n")
    out.write(f"chunks changed: {chunks_changed} ({chunks_changed * 100.0 / max(1, len(rows)):.1f}%)\n\n")

    out.write("## 변경 통계 (회수)\n")
    out.write(f"  company  : {total_stats['company']:>6}\n")
    out.write(f"  name_job : {total_stats['name_job']:>6}\n")
    out.write(f"  daepyo   : {total_stats['daepyo']:>6}\n")
    out.write(f"  phone    : {total_stats['phone']:>6}\n")
    out.write(f"  email    : {total_stats['email']:>6}\n")
    out.write(f"  perform  : {total_stats['perform']:>6}\n\n")

    out.write("## 회사명 매칭 분포\n")
    for name, cnt in company_total.most_common():
        out.write(f"  {cnt:>5}  {name}\n")
    out.write("\n")

    out.write(f"## random {sample_n} sample (before → after, 각 600자 cap)\n\n")
    for cid, before, after in samples_changed:
        out.write(f"--- {cid} ---\n")
        out.write(f"[BEFORE]\n{before[:600]}\n\n")
        out.write(f"[AFTER]\n{after[:600]}\n\n")
        out.write("=" * 60 + "\n\n")

    report_path = Path("_rag_sanitize_dryrun.txt" if not apply_mode else "_rag_sanitize_apply.txt")
    report_path.write_text(out.getvalue(), encoding="utf-8")
    print(f"  report: {report_path} ({len(out.getvalue())} chars)")

    if not apply_mode:
        print("\n  [DRY-RUN] DB 변경 없음. 실제 적용은 --apply 플래그.")
        return

    # ─── APPLY MODE — 백업 + UPDATE + embedded=0 ───
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M")
    backup_path = Path(f"{DB_PATH}.backup-{ts}")
    print(f"\n  백업: {backup_path}")
    shutil.copy2(DB_PATH, backup_path)

    print(f"  UPDATE chunks SET text=? WHERE rowid=? - {chunks_changed} rows")
    cur = db.cursor()
    cur.executemany("UPDATE chunks SET text=?, embedded=0 WHERE rowid=?",
                    [(t, rid) for rid, t in changed_payloads])
    db.commit()
    print(f"  rows affected: {cur.rowcount}")
    print(f"  note: vec_chunks (embedding) unchanged. embedded=0 reset only. Re-embed = separate batch.")


if __name__ == "__main__":
    main()
