"""Auth (JWT + bcrypt + policy + DB flow) mock test - Commit 2 검증.

DB 부작용 회피 위해 임시 invite_code 1개 생성 → register → login → me 검증 후 cleanup.
실제 Anthropic / OpenAI 호출 X.

사용:
  JWT_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(48))") python3 _test_auth.py
"""
import os
import sys
import uuid
import sqlite3

# JWT_SECRET 자동 설정 (테스트용 - 실제 운영에서는 Railway env)
if not os.environ.get("JWT_SECRET"):
    os.environ["JWT_SECRET"] = "test-secret-" + uuid.uuid4().hex * 2  # 64+ chars

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# init_db + migrate (멱등)
main.init_db()
main._migrate_db()

client = TestClient(main.app)

# ─── Helpers ────────────────────────────────────────────────────────────────
def _seed_invite_code(code="TEST-1234"):
    with main.get_db() as db:
        db.execute("DELETE FROM invite_codes WHERE code=?", (code,))
        db.execute(
            "INSERT INTO invite_codes(code, created_by, note) VALUES(?, 'test-admin', 'mock test')",
            (code,),
        )
    return code


def _cleanup_user(email):
    with main.get_db() as db:
        db.execute("DELETE FROM users WHERE email=?", (email,))


def _cleanup_code(code):
    with main.get_db() as db:
        db.execute("DELETE FROM invite_codes WHERE code=?", (code,))


# ─── 1. Password policy ─────────────────────────────────────────────────────
print("=== 1. Password policy ===")
assert main._PASSWORD_POLICY_RE.match("Abc12345"),    "fail: 정상 8자+영문+숫자"
assert main._PASSWORD_POLICY_RE.match("Pass1234"),    "fail: 정상"
assert not main._PASSWORD_POLICY_RE.match("abc12"),   "fail: 5자 (8자 미만)"
assert not main._PASSWORD_POLICY_RE.match("abcdefgh"), "fail: 영문만"
assert not main._PASSWORD_POLICY_RE.match("12345678"), "fail: 숫자만"
print("  policy regex OK")

# ─── 2. bcrypt round-trip ───────────────────────────────────────────────────
print("=== 2. bcrypt hash/check ===")
import bcrypt
pw = "Test1234"
h = bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=main.BCRYPT_ROUNDS))
assert bcrypt.checkpw(pw.encode(), h), "fail: bcrypt round-trip"
assert not bcrypt.checkpw(b"WrongPass", h), "fail: wrong pw"
print(f"  bcrypt rounds={main.BCRYPT_ROUNDS}, round-trip OK")

# ─── 3. JWT encode/decode ───────────────────────────────────────────────────
print("=== 3. JWT encode/decode ===")
uid = "test-uid-123"
tok = main.encode_jwt(uid)
assert main.decode_jwt(tok) == uid, "fail: JWT round-trip"
assert main.decode_jwt("invalid.token.xxx") is None, "fail: invalid token"
print(f"  JWT encode/decode OK")

# ─── 4. /api/auth/register - 정상 흐름 ──────────────────────────────────────
print("=== 4. /api/auth/register normal flow ===")
test_email = f"test-{uuid.uuid4().hex[:6]}@example.com"
code = _seed_invite_code(f"TEST-{uuid.uuid4().hex[:6]}")
try:
    r = client.post("/api/auth/register", json={
        "email": test_email,
        "password": "Test1234",
        "invite_code": code,
        "company": "Test Co",
    })
    assert r.status_code == 200, f"fail: register {r.status_code} {r.text}"
    body = r.json()
    assert "token" in body and "user" in body
    assert body["user"]["email"] == test_email
    assert body["user"]["role"] == "user"
    print(f"  register OK - uid={body['user']['id']}")

    # 토큰 디코드 검증
    decoded_uid = main.decode_jwt(body["token"])
    assert decoded_uid == body["user"]["id"]
    print("  token round-trip OK")

    # invite code 사용 처리 확인
    with main.get_db() as db:
        ic = db.execute("SELECT used_by FROM invite_codes WHERE code=?", (code,)).fetchone()
    assert ic and ic["used_by"] == body["user"]["id"], "fail: invite code not marked used"
    print("  invite code marked used OK")

    saved_uid = body["user"]["id"]
    saved_token = body["token"]
finally:
    pass  # cleanup at end

# ─── 5. /api/auth/register - 정책 위반 ──────────────────────────────────────
print("=== 5. /api/auth/register password policy violation ===")
code2 = _seed_invite_code(f"TEST-{uuid.uuid4().hex[:6]}")
r = client.post("/api/auth/register", json={
    "email": f"weak-{uuid.uuid4().hex[:4]}@example.com",
    "password": "weakpass",  # 영문만, 숫자 없음
    "invite_code": code2,
})
assert r.status_code == 400, f"fail: expected 400, got {r.status_code}"
print(f"  policy violation -> 400 OK")
_cleanup_code(code2)

# ─── 6. /api/auth/register - 무효 invite_code ──────────────────────────────
print("=== 6. /api/auth/register invalid invite ===")
r = client.post("/api/auth/register", json={
    "email": f"noinvite-{uuid.uuid4().hex[:4]}@example.com",
    "password": "Test1234",
    "invite_code": "NONEXISTENT-XXXX",
})
assert r.status_code == 410, f"fail: expected 410, got {r.status_code}"
print("  invalid invite -> 410 OK")

# ─── 7. /api/auth/register - 사용된 invite_code ────────────────────────────
print("=== 7. /api/auth/register used invite ===")
r = client.post("/api/auth/register", json={
    "email": f"reuse-{uuid.uuid4().hex[:4]}@example.com",
    "password": "Test1234",
    "invite_code": code,  # 위 #4 에서 사용됨
})
assert r.status_code == 410, f"fail: expected 410, got {r.status_code}"
print("  used invite -> 410 OK")

# ─── 8. /api/auth/login - 정상 흐름 ─────────────────────────────────────────
print("=== 8. /api/auth/login normal ===")
r = client.post("/api/auth/login", json={
    "email": test_email,
    "password": "Test1234",
})
assert r.status_code == 200, f"fail: login {r.status_code} {r.text}"
body = r.json()
assert body["user"]["email"] == test_email
print(f"  login OK")

login_token = body["token"]

# ─── 9. /api/auth/login - 비밀번호 불일치 ──────────────────────────────────
print("=== 9. /api/auth/login wrong password ===")
r = client.post("/api/auth/login", json={
    "email": test_email,
    "password": "WrongPass123",
})
assert r.status_code == 401, f"fail: expected 401, got {r.status_code}"
print("  wrong pw -> 401 OK")

# ─── 10. /api/auth/login - 존재하지 않는 이메일 ────────────────────────────
print("=== 10. /api/auth/login no user ===")
r = client.post("/api/auth/login", json={
    "email": "nobody@nowhere.example",
    "password": "Test1234",
})
assert r.status_code == 401, f"fail: expected 401, got {r.status_code}"
print("  no user -> 401 (보안: 구분 X) OK")

# ─── 11. /api/auth/me - 인증 정상 ──────────────────────────────────────────
print("=== 11. /api/auth/me with valid token ===")
r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login_token}"})
assert r.status_code == 200, f"fail: me {r.status_code} {r.text}"
body = r.json()
assert body["user"]["email"] == test_email
print(f"  me OK - {body['user']}")

# ─── 12. /api/auth/me - 토큰 없음 ──────────────────────────────────────────
print("=== 12. /api/auth/me no token ===")
r = client.get("/api/auth/me")
assert r.status_code == 401
print("  no token -> 401 OK")

# ─── 13. /api/auth/me - invalid token ──────────────────────────────────────
print("=== 13. /api/auth/me invalid token ===")
r = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.xxx"})
assert r.status_code == 401
print("  invalid token -> 401 OK")

# ─── 14. /api/auth/logout ──────────────────────────────────────────────────
print("=== 14. /api/auth/logout ===")
r = client.post("/api/auth/logout")
assert r.status_code == 200
print("  logout (stateless) OK")

# ─── 15. /api/signup deprecation ───────────────────────────────────────────
print("=== 15. /api/signup deprecation ===")
r = client.post("/api/signup", json={"email": "x@y.com", "company": "X"})
assert r.status_code == 410, f"fail: expected 410, got {r.status_code}"
print("  deprecated -> 410 Gone OK")

# ─── Cleanup ───────────────────────────────────────────────────────────────
_cleanup_user(test_email)
_cleanup_code(code)

print()
print("[OK] ALL AUTH TESTS PASSED")
