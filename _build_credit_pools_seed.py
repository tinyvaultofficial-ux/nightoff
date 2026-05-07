#!/usr/bin/env python3
"""크레딧 풀 영역 빌드 스크립트 — 정답 평문 → HMAC-SHA256 hash 인라인 영역.

흐름:
  1. _credit_data_input/quiz_pool.md   파싱 → 50문제 + alt 답안 영역
  2. _credit_data_input/fortune_pool.md 파싱 → 50개 운세 영역
  3. CREDIT_QUIZ_SALT 영역 영역 (.env.local 영역) → HMAC-SHA256 영역 정답 hash
  4. data/credit_pools_seed.py 생성 (질문 평문 + answer_hashes 인라인 / 운세 hash)

운세 영역 영역 영역:
  운세는 게임 영역 비밀 X 다만 "Q3 영역 영역도 보호" 결정 영역 정합 → 운세 영역 영역
  message_hash 영역 보관 X (사용자가 운세 영역 영역 노출 영역 본질 영역).
  → 운세 = 평문 인라인 영역 (안전 — 정답 영역 영역 영역).
  → 다만 = "(a) 운세도 보호" 영역 = "정답 영역 영역 같이 영역 영역 (gitignore + DB)" 영역 정합.

실제 영역 = 운세 영역 영역 영역 BinFile 인라인 영역 영역 영역, raw md 파일 영역
영역 보존 (.gitignore) + DB seed 영역 평문 영역 (DB 영역 운영 영역만 영역 영역
영역 보호). 정답 영역 영역 영역 hash 영역 노출 영역 (평문 영역 X).

사용:
  python _build_credit_pools_seed.py
"""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# .env.local 영역 SALT 영역 (dev 환경 영역 영역)
def _load_env_local():
    env_path = Path(".env.local")
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v

_load_env_local()

SALT = os.environ.get("CREDIT_QUIZ_SALT", "").strip()
if not SALT:
    print("ERROR: CREDIT_QUIZ_SALT 영역 .env.local 영역 영역 X")
    print("  → .env.local 영역 'CREDIT_QUIZ_SALT=...' 줄 영역")
    sys.exit(1)

INPUT_DIR = Path("_credit_data_input")
OUTPUT_DIR = Path("data")
OUTPUT_FILE = OUTPUT_DIR / "credit_pools_seed.py"

QUIZ_FILE = INPUT_DIR / "quiz_pool.md"
FORTUNE_FILE = INPUT_DIR / "fortune_pool.md"


def normalize_answer(s: str) -> str:
    """대소문자 / 공백 / 탭 / 전각공백 영역 무시."""
    return s.lower().replace(" ", "").replace("\t", "").replace("　", "")


def hash_answer(answer: str) -> str:
    """HMAC-SHA256(SALT, normalize(answer)) → 64 hex chars."""
    n = normalize_answer(answer)
    return hmac.new(
        SALT.encode("utf-8"),
        n.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def split_alt_answers(raw: str) -> list[str]:
    """정답 raw → alt 영역 풀어 영역.

    "Request For Proposal"        → ["Request For Proposal"]
    "90 (또는 92, 94)"            → ["90", "92", "94"]
    "부가세 (또는 부가가치세)"     → ["부가세", "부가가치세"]
    "12 (또는 12시)"              → ["12", "12시"]
    """
    raw = raw.strip()
    if "(" not in raw:
        return [raw]
    main = raw[: raw.index("(")].strip()
    paren_close = raw.rindex(")")
    paren = raw[raw.index("(") + 1 : paren_close]
    # "또는 92, 94" / "또는 부가가치세" / "또는 인허가" / "또는 12시"
    paren = paren.replace("또는", "").strip()
    alts = [a.strip() for a in paren.split(",") if a.strip()]
    out = [main] + alts
    # 빈 영역 제거 / 중복 제거 (순서 보존)
    seen = set()
    uniq = []
    for x in out:
        if x and x not in seen:
            seen.add(x)
            uniq.append(x)
    return uniq


def parse_quiz_pool(text: str) -> list[dict]:
    """quiz_pool.md 영역 파싱 → [{id, question, answer_hashes}].

    포맷:
      1. Q. RFP는 무엇의 약자일까요? (영문 풀네임)
      A: Request For Proposal

      2. Q. 입찰 평가에서 ... 약 몇 % 일까요? (10단위 숫자)
      A: 90 (또는 92, 94)
    """
    quizzes = []
    # 정규식 — 영역 번호 + Q + ... + A 영역 영역
    pattern = re.compile(
        r"^(\d+)\.\s*Q\.\s*(.+?)\n\s*A:\s*(.+?)$",
        re.MULTILINE,
    )
    for m in pattern.finditer(text):
        qid = int(m.group(1))
        question = m.group(2).strip()
        answer_raw = m.group(3).strip()
        alts = split_alt_answers(answer_raw)
        hashes = [hash_answer(a) for a in alts]
        quizzes.append({
            "id": qid,
            "question": question,
            "answer_hashes": hashes,
            "answer_count": len(alts),  # debug — 실제 alt 개수
        })
    return quizzes


def parse_fortune_pool(text: str) -> list[dict]:
    """fortune_pool.md 영역 파싱 → [{id, message}].

    포맷:
      1. 오늘은 ... 기회가 될 수 있어요.

      2. 직감을 따르세요. ...
    """
    fortunes = []
    # 영역 번호 + 메시지 (다음 빈 줄 또는 다음 번호 직전까지)
    pattern = re.compile(
        r"^(\d+)\.\s+(.+?)(?=\n\n\d+\.|\n\n---|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    for m in pattern.finditer(text):
        fid = int(m.group(1))
        message = m.group(2).strip()
        # 줄바꿈 영역 단일 공백 영역 정합 (3-4줄 영역 단일 줄로 보존 가능)
        message = re.sub(r"\s+", " ", message).strip()
        fortunes.append({
            "id": fid,
            "message": message,
        })
    return fortunes


def main():
    # ── 입력 파일 검증 ──
    if not QUIZ_FILE.exists():
        print(f"ERROR: {QUIZ_FILE} not found")
        sys.exit(1)
    if not FORTUNE_FILE.exists():
        print(f"ERROR: {FORTUNE_FILE} not found")
        sys.exit(1)

    quiz_text = QUIZ_FILE.read_text(encoding="utf-8")
    fortune_text = FORTUNE_FILE.read_text(encoding="utf-8")

    print(f"=== 크레딧 풀 빌드 시작 ===")
    print(f"  SALT 길이: {len(SALT)} chars")
    print(f"  quiz file: {QUIZ_FILE}")
    print(f"  fortune file: {FORTUNE_FILE}")
    print()

    # ── 파싱 ──
    quizzes = parse_quiz_pool(quiz_text)
    fortunes = parse_fortune_pool(fortune_text)

    print(f"  파싱 결과:")
    print(f"    퀴즈: {len(quizzes)}개")
    print(f"    운세: {len(fortunes)}개")

    if len(quizzes) != 50:
        print(f"  ⚠️  퀴즈 개수가 50개가 아님 — 파싱 사고 가능성")
    if len(fortunes) != 50:
        print(f"  ⚠️  운세 개수가 50개가 아님 — 파싱 사고 가능성")

    # ── 통계 ──
    total_alts = sum(q["answer_count"] for q in quizzes)
    multi_alt = sum(1 for q in quizzes if q["answer_count"] > 1)
    print(f"    총 정답 hash: {total_alts}개 (alt 포함)")
    print(f"    multi-alt 문제: {multi_alt}개")
    print()

    # ── data/ 디렉토리 영역 ──
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ── credit_pools_seed.py 생성 ──
    # 정답 hash 인라인 (질문 평문 OK, hash만 노출)
    out_lines = []
    out_lines.append('"""크레딧 풀 시드 데이터 — 정답 hash 인라인.\n')
    out_lines.append("자동 생성 — _build_credit_pools_seed.py 실행 결과.\n")
    out_lines.append("정답 평문 = .gitignore (_credit_data_input/) 별도 보관.\n")
    out_lines.append("hash = HMAC-SHA256(CREDIT_QUIZ_SALT, normalize(answer)).\n")
    out_lines.append('"""\n')
    out_lines.append("from __future__ import annotations\n\n")

    # 퀴즈 풀
    out_lines.append("# ─── QUIZ_POOL: 50문제 ─────────────────────────────────\n")
    out_lines.append("# {id, question(평문), answer_hashes(alt 포함 배열)}\n")
    out_lines.append("QUIZ_POOL: list[dict] = [\n")
    for q in quizzes:
        out_lines.append("    {\n")
        out_lines.append(f"        \"id\": {q['id']},\n")
        # 질문 안에 따옴표 / 백슬래시 처리
        question_safe = q["question"].replace("\\", "\\\\").replace("\"", "\\\"")
        out_lines.append(f"        \"question\": \"{question_safe}\",\n")
        out_lines.append("        \"answer_hashes\": [\n")
        for h in q["answer_hashes"]:
            out_lines.append(f"            \"{h}\",\n")
        out_lines.append("        ],\n")
        out_lines.append("    },\n")
    out_lines.append("]\n\n")

    # 운세 풀
    out_lines.append("# ─── FORTUNE_POOL: 50개 ────────────────────────────────\n")
    out_lines.append("# {id, message(평문)}\n")
    out_lines.append("# Note: 운세 = 비밀 X 다만 일관성 / DB 시드 정합 영역 평문 보관.\n")
    out_lines.append("# 평문 노출 OK — 게임 콘텐츠 영역 (정답 hash와 영역 영역).\n")
    out_lines.append("FORTUNE_POOL: list[dict] = [\n")
    for f in fortunes:
        out_lines.append("    {\n")
        out_lines.append(f"        \"id\": {f['id']},\n")
        msg_safe = f["message"].replace("\\", "\\\\").replace("\"", "\\\"")
        out_lines.append(f"        \"message\": \"{msg_safe}\",\n")
        out_lines.append("    },\n")
    out_lines.append("]\n")

    OUTPUT_FILE.write_text("".join(out_lines), encoding="utf-8")
    out_size = OUTPUT_FILE.stat().st_size
    print(f"  생성: {OUTPUT_FILE}  ({out_size:,} bytes)")
    print()
    print(f"=== 완료 ===")
    print(f"  → 다음 단계: data/credit_pools_seed.py 영역 git commit OK (hash만 노출, 정답 평문 X)")


if __name__ == "__main__":
    main()
