"""Credit endpoints (퀴즈 / 운세 / 로또) 단위 + 라운드트립 테스트.

Step 4 정식화 — _test_auth.py 패턴 정합.
  - 순수 함수 단위 테스트 (normalize / hash / seed / rank)
  - 헬퍼 함수 round-trip (lazy-create / record / rate-limit)
  - HTTP 라운드트립 (FastAPI TestClient)
  - JWT 발급 후 endpoint 6개 호출 + 1일 1회 / rate limit / 정답 매칭 검증

DB 부작용 회피: 테스트 user 삽입 → cleanup. Anthropic / OpenAI 호출 X.

사용:
  python _test_credit.py
  (CREDIT_QUIZ_SALT 는 .env.local 영역 자동 로드 / JWT_SECRET 도 자동 fallback.)
"""
from __future__ import annotations

import os
import sys
import uuid
import json
import re

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ─── env 로드 (CREDIT_QUIZ_SALT / JWT_SECRET fallback) ──────────────────────
if os.path.exists(".env.local"):
    for line in open(".env.local", encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        if k and k not in os.environ:
            os.environ[k] = v.strip().strip('"').strip("'")

if not os.environ.get("JWT_SECRET"):
    os.environ["JWT_SECRET"] = "test-secret-" + uuid.uuid4().hex * 2  # 64+ chars

if not os.environ.get("CREDIT_QUIZ_SALT"):
    print("FATAL: CREDIT_QUIZ_SALT 환경변수 영역 영역 X (.env.local 영역 영역).")
    sys.exit(2)

# DATABASE_URL 영역 SQLite forced (테스트 = 로컬 DB)
os.environ.pop("DATABASE_URL", None)

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

main.init_db()
main._migrate_db()
main._seed_credit_pools()

client = TestClient(main.app)

# ─── 카운터 ─────────────────────────────────────────────────────────────────
_passed = 0
_failed = 0


def assert_eq(label: str, actual, expected):
    global _passed, _failed
    ok = actual == expected
    if ok:
        print(f"  PASS  {label}")
        _passed += 1
    else:
        print(f"  FAIL  {label}  · expected={expected!r}  actual={actual!r}")
        _failed += 1


def assert_true(label: str, cond: bool):
    global _passed, _failed
    if cond:
        print(f"  PASS  {label}")
        _passed += 1
    else:
        print(f"  FAIL  {label}")
        _failed += 1


# ─── 1. 순수 함수 단위 테스트 ──────────────────────────────────────────────
print("\n=== 1. 순수 함수 단위 테스트 ===")

# 1-1. normalize_credit_answer
print("\n1-1. _normalize_credit_answer")
assert_eq("대소문자", main._normalize_credit_answer("PowerPoint"), "powerpoint")
assert_eq("공백 제거", main._normalize_credit_answer("부가 가치세"), "부가가치세")
assert_eq("탭 제거", main._normalize_credit_answer("ab\tcd"), "abcd")
assert_eq("전각공백 제거", main._normalize_credit_answer("a　b"), "ab")
assert_eq("앞뒤 공백 + 대소문자", main._normalize_credit_answer(" Apple "), "apple")

# 1-2. hash_credit_answer (HMAC 결정성)
print("\n1-2. _hash_credit_answer (결정성 + normalize 정합)")
salt = os.environ["CREDIT_QUIZ_SALT"]
h1 = main._hash_credit_answer("Test", salt)
h2 = main._hash_credit_answer("Test", salt)
h3 = main._hash_credit_answer("test", salt)  # normalize 영역 동일
h4 = main._hash_credit_answer("TEST", salt)
assert_eq("64 hex chars", len(h1), 64)
assert_eq("결정성 (같은 입력 = 같은 해시)", h1, h2)
assert_eq("normalize 정합 (Test=test)", h1, h3)
assert_eq("normalize 정합 (Test=TEST)", h1, h4)

# 1-3. seed_pick (일관성)
print("\n1-3. _seed_pick (date+user_id 시드 고정)")
p1 = main._seed_pick("2026-05-07", "user-A", 50)
p2 = main._seed_pick("2026-05-07", "user-A", 50)
p3 = main._seed_pick("2026-05-08", "user-A", 50)
assert_eq("같은 (date, user) = 같은 결과", p1, p2)
assert_true("날짜 다르면 다른 결과 (높은 확률)", p1 != p3)
assert_true("범위 1-50", 1 <= p1 <= 50)

# 1-4. _lotto_rank (lotto_spec.md 정합)
print("\n1-4. _lotto_rank")
WIN = [1, 2, 3, 4, 5, 6]; BONUS = 7
assert_eq("1등 (6개)", main._lotto_rank([1, 2, 3, 4, 5, 6], WIN, BONUS), 1)
assert_eq("2등 (5+보너스)", main._lotto_rank([1, 2, 3, 4, 5, 7], WIN, BONUS), 2)
assert_eq("3등 (5개)", main._lotto_rank([1, 2, 3, 4, 5, 9], WIN, BONUS), 3)
assert_eq("4등 (4개)", main._lotto_rank([1, 2, 3, 4, 9, 10], WIN, BONUS), 4)
assert_eq("5등 (3개)", main._lotto_rank([1, 2, 3, 9, 10, 11], WIN, BONUS), 5)
assert_eq("꽝 (2개)", main._lotto_rank([1, 2, 9, 10, 11, 12], WIN, BONUS), 0)
assert_eq("꽝 (0개)", main._lotto_rank([8, 9, 10, 11, 12, 13], WIN, BONUS), 0)

# 1-5. _today_kst_str (포맷)
print("\n1-5. _today_kst_str")
t = main._today_kst_str()
assert_true("YYYY-MM-DD 포맷", bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", t)))


# ─── 2. _get_or_create_lotto (lazy create + 멱등) ───────────────────────────
print("\n=== 2. _get_or_create_lotto ===")

with main.get_db() as db:
    db.execute("DELETE FROM credit_lotto_daily WHERE date_kst=?", ("2099-12-31",))

l1 = main._get_or_create_lotto("2099-12-31")
l2 = main._get_or_create_lotto("2099-12-31")
assert_eq("멱등 — 두 번째 호출 같은 결과", l1, l2)
assert_eq("numbers 6개", len(l1["numbers"]), 6)
assert_true("numbers 1-45 범위", all(1 <= n <= 45 for n in l1["numbers"]))
assert_true("numbers 오름차순", l1["numbers"] == sorted(l1["numbers"]))
assert_true("bonus 1-45", 1 <= l1["bonus"] <= 45)
assert_true("bonus ∉ numbers", l1["bonus"] not in l1["numbers"])

with main.get_db() as db:
    db.execute("DELETE FROM credit_lotto_daily WHERE date_kst=?", ("2099-12-31",))


# ─── 3. _credit_record_attempt (UNIQUE 가드) ────────────────────────────────
print("\n=== 3. _credit_record_attempt UNIQUE 가드 ===")

UID_R = "test-rec-" + uuid.uuid4().hex[:8]
with main.get_db() as db:
    db.execute(
        "INSERT INTO users(id, email, password_hash, role, is_active, credit_count) VALUES(?,?,?,?,?,?)",
        (UID_R, UID_R + "@t.t", "f", "user", 1, 0),
    )

today = main._today_kst_str()
ok1 = main._credit_record_attempt(UID_R, "quiz", today, {"correct": True}, 1)
ok2 = main._credit_record_attempt(UID_R, "quiz", today, {"correct": False}, 0)
assert_eq("첫 INSERT 성공", ok1, True)
assert_eq("두 번째 INSERT — UNIQUE 차단 → False", ok2, False)
with main.get_db() as db:
    row = db.execute("SELECT credit_count FROM users WHERE id=?", (UID_R,)).fetchone()
assert_eq("credit_count 누적 +1 (첫 시도만)", int(row["credit_count"]), 1)

with main.get_db() as db:
    db.execute("DELETE FROM credit_attempts WHERE user_id=?", (UID_R,))
    db.execute("DELETE FROM users WHERE id=?", (UID_R,))


# ─── 4. HTTP 라운드트립 — FastAPI TestClient + JWT ──────────────────────────
print("\n=== 4. HTTP 라운드트립 (TestClient + JWT) ===")

import jwt as _jwt
from datetime import datetime, timedelta, timezone

UID_H = "test-http-" + uuid.uuid4().hex[:8]
EMAIL_H = UID_H + "@test.local"
with main.get_db() as db:
    db.execute(
        "INSERT INTO users(id, email, password_hash, role, is_active, credit_count) VALUES(?,?,?,?,?,?)",
        (UID_H, EMAIL_H, "fake", "user", 1, 0),
    )
exp = datetime.now(timezone.utc) + timedelta(days=1)
token = _jwt.encode(
    {"sub": UID_H, "email": EMAIL_H, "role": "user", "exp": exp},
    os.environ["JWT_SECRET"],
    algorithm="HS256",
)
HEADERS = {"Authorization": f"Bearer {token}"}

# 4-1. quiz/today
r = client.get("/api/credit/quiz/today", headers=HEADERS)
assert_eq("quiz/today HTTP 200", r.status_code, 200)
qb = r.json()
assert_true("quiz_id 1-50", 1 <= qb["quiz_id"] <= 50)
assert_eq("attempted=False (미시도)", qb["attempted"], False)

# 4-2. quiz/check 오답
r = client.post("/api/credit/quiz/check", headers=HEADERS, json={"answer": "wrong-deliberate"})
assert_eq("quiz/check 오답 HTTP 200", r.status_code, 200)
b = r.json()
assert_eq("correct=False", b["correct"], False)
assert_eq("credits_earned=0", b["credits_earned"], 0)

# 4-3. quiz/check 1일 1회 가드
r = client.post("/api/credit/quiz/check", headers=HEADERS, json={"answer": "again"})
assert_eq("quiz/check 1일 1회 HTTP 200", r.status_code, 200)
assert_eq("already_attempted=True", r.json().get("already_attempted"), True)

# 4-4. quiz/check 빈 답 → 422
r = client.post("/api/credit/quiz/check", headers=HEADERS, json={"answer": ""})
assert_eq("quiz/check 빈 답 422", r.status_code, 422)

# 4-5. lotto/today 미시도
r = client.get("/api/credit/lotto/today", headers=HEADERS)
assert_eq("lotto/today HTTP 200", r.status_code, 200)
assert_eq("attempted=False", r.json()["attempted"], False)

# 4-6. lotto/draw
r = client.post("/api/credit/lotto/draw", headers=HEADERS)
assert_eq("lotto/draw HTTP 200", r.status_code, 200)
b = r.json()
rr = b["result"]
assert_true("user_numbers 6개", len(rr["user_numbers"]) == 6)
assert_true("rank 0-5", rr["rank"] in (0, 1, 2, 3, 4, 5))

# 4-7. Rate limit (3초 안 재시도 → 429)
r = client.post("/api/credit/lotto/draw", headers=HEADERS)
assert_eq("lotto/draw rate limit 429", r.status_code, 429)

# 4-8. lotto/draw 1일 1회 (rate limit 우회 영역 제거)
main._CREDIT_RATE_LIMIT.pop(UID_H, None)
r = client.post("/api/credit/lotto/draw", headers=HEADERS)
assert_eq("lotto/draw 1일 1회 200", r.status_code, 200)
assert_eq("already_attempted=True", r.json().get("already_attempted"), True)

# 4-9. fortune (시드 고정)
r1 = client.get("/api/credit/fortune", headers=HEADERS)
r2 = client.get("/api/credit/fortune", headers=HEADERS)
assert_eq("fortune HTTP 200", r1.status_code, 200)
assert_eq("시드 고정 — 같은 fortune_id", r1.json()["fortune_id"], r2.json()["fortune_id"])
assert_true("fortune_id 1-50", 1 <= r1.json()["fortune_id"] <= 50)

# 4-10. balance
r = client.get("/api/credit/balance", headers=HEADERS)
assert_eq("balance HTTP 200", r.status_code, 200)
b = r.json()
assert_eq("today.quiz=True", b["today"]["quiz"], True)
assert_eq("today.lotto=True", b["today"]["lotto"], True)
assert_eq("stats.quiz=1", b["stats"]["quiz"], 1)
assert_eq("stats.lotto=1", b["stats"]["lotto"], 1)

# 4-11. 인증 없이 호출 → 401
r = client.get("/api/credit/quiz/today")  # no headers
assert_eq("인증 없음 401", r.status_code, 401)

# 4-12. 정답 매칭 (별도 user)
print("\n4-12. 정답 매칭 round-trip")
UID_C = "test-correct-" + uuid.uuid4().hex[:8]
EMAIL_C = UID_C + "@t.t"
with main.get_db() as db:
    db.execute(
        "INSERT INTO users(id, email, password_hash, role, is_active, credit_count) VALUES(?,?,?,?,?,?)",
        (UID_C, EMAIL_C, "f", "user", 1, 0),
    )
exp_c = datetime.now(timezone.utc) + timedelta(days=1)
token_c = _jwt.encode(
    {"sub": UID_C, "email": EMAIL_C, "role": "user", "exp": exp_c},
    os.environ["JWT_SECRET"],
    algorithm="HS256",
)
H_C = {"Authorization": f"Bearer {token_c}"}

r = client.get("/api/credit/quiz/today", headers=H_C)
qid = r.json()["quiz_id"]
raw = open("_credit_data_input/quiz_pool.md", encoding="utf-8").read()
m = re.search(r"^" + str(qid) + r"\.\s*Q\.\s*.+?\n\s*A:\s*(.+?)$", raw, re.MULTILINE)
if m:
    main_answer = m.group(1).strip().split("(")[0].strip()
    r = client.post("/api/credit/quiz/check", headers=H_C, json={"answer": main_answer})
    b = r.json()
    assert_eq("정답 → correct=True", b["correct"], True)
    assert_eq("credits_earned=1", b["credits_earned"], 1)
    assert_eq("total_credits=1", b["total_credits"], 1)
else:
    print(f"  WARN  qid {qid} raw md 매칭 X — 풀 파일 점검 필요")

with main.get_db() as db:
    db.execute("DELETE FROM credit_attempts WHERE user_id=?", (UID_C,))
    db.execute("DELETE FROM users WHERE id=?", (UID_C,))

# ─── cleanup ─────────────────────────────────────────────────────────────────
with main.get_db() as db:
    db.execute("DELETE FROM credit_attempts WHERE user_id=?", (UID_H,))
    db.execute("DELETE FROM users WHERE id=?", (UID_H,))


# ─── 결과 ────────────────────────────────────────────────────────────────────
total = _passed + _failed
print()
print(f"=== 결과: {_passed}/{total} PASS  ({_failed} FAIL) ===")
sys.exit(0 if _failed == 0 else 1)
