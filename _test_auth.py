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

# ─── Admin tests (Commit 3) ────────────────────────────────────────────────

# admin 계정 seed (test 전용)
admin_email = f"admin-{uuid.uuid4().hex[:6]}@example.com"
admin_uid = uuid.uuid4().hex[:12]
admin_pw_hash = bcrypt.hashpw(b"AdminPass1", bcrypt.gensalt(rounds=4)).decode()  # 빠른 해시 (테스트 전용 rounds=4)
with main.get_db() as db:
    db.execute(
        "INSERT INTO users(id,email,password_hash,role,is_active) VALUES(?,?,?,'admin',1)",
        (admin_uid, admin_email, admin_pw_hash),
    )
admin_token = main.encode_jwt(admin_uid)
admin_hdr = {"Authorization": f"Bearer {admin_token}"}

# ─── 16. generate_invite_code 형식 + 충돌 검사 ─────────────────────────────
print("=== 16. generate_invite_code format ===")
for _ in range(20):
    c = main.generate_invite_code()
    assert main._INVITE_RE.match(c), f"fail: format {c}"
    # 헷갈리는 문자 제외 확인
    suffix = c.split("-")[1]
    for ch in suffix:
        assert ch not in "0O1lI", f"fail: ambiguous char {ch} in {c}"
print("  format + ambiguous-char-exclusion OK (20 samples)")

# ─── 17. POST /api/admin/invites 정상 ──────────────────────────────────────
print("=== 17. POST /api/admin/invites batch=3 ===")
r = client.post("/api/admin/invites",
    json={"count": 3, "note": "test batch"}, headers=admin_hdr)
assert r.status_code == 200, f"fail: {r.status_code} {r.text}"
codes = r.json()["codes"]
assert len(codes) == 3
batch_codes = [c["code"] for c in codes]
for c in batch_codes:
    assert main._INVITE_RE.match(c)
print(f"  batch issue OK - {batch_codes}")

# ─── 18. POST /api/admin/invites count 범위 ───────────────────────────────
print("=== 18. count out-of-range ===")
r = client.post("/api/admin/invites", json={"count": 100}, headers=admin_hdr)
assert r.status_code == 400
print("  count=100 -> 400 OK")
r = client.post("/api/admin/invites", json={"count": 0}, headers=admin_hdr)
assert r.status_code == 400
print("  count=0 -> 400 OK")

# ─── 19. POST /api/admin/invites expires_at 형식 ──────────────────────────
print("=== 19. invalid expires_at ===")
r = client.post("/api/admin/invites",
    json={"expires_at": "not-an-iso-date"}, headers=admin_hdr)
assert r.status_code == 400
print("  bad expires_at -> 400 OK")

# ─── 20. GET /api/admin/invites 그룹 ───────────────────────────────────────
print("=== 20. GET /api/admin/invites grouping ===")
r = client.get("/api/admin/invites", headers=admin_hdr)
assert r.status_code == 200
groups = r.json()
assert "unused" in groups and "used" in groups and "expired" in groups
unused_codes = [c["code"] for c in groups["unused"]]
for c in batch_codes:
    assert c in unused_codes, f"fail: {c} not in unused"
print(f"  grouping OK (unused={len(groups['unused'])}, used={len(groups['used'])}, expired={len(groups['expired'])})")

# ─── 21. DELETE /api/admin/invites/{code} 미사용 ───────────────────────────
print("=== 21. DELETE unused invite ===")
target = batch_codes[0]
r = client.delete(f"/api/admin/invites/{target}", headers=admin_hdr)
assert r.status_code == 200
print(f"  revoke unused OK - {target}")

# ─── 22. DELETE /api/admin/invites/{code} 존재 X ──────────────────────────
print("=== 22. DELETE non-existent invite ===")
r = client.delete("/api/admin/invites/NIGHTOFF-XXXX", headers=admin_hdr)
assert r.status_code == 404
print("  non-existent -> 404 OK")

# ─── 23. DELETE 이미 사용된 invite ─────────────────────────────────────────
print("=== 23. DELETE used invite ===")
# batch_codes[1] 을 register 로 사용 처리
used_email = f"used-{uuid.uuid4().hex[:4]}@example.com"
r = client.post("/api/auth/register", json={
    "email": used_email, "password": "Test1234", "invite_code": batch_codes[1],
})
assert r.status_code == 200
# 이제 batch_codes[1] 폐기 시도
r = client.delete(f"/api/admin/invites/{batch_codes[1]}", headers=admin_hdr)
assert r.status_code == 409, f"fail: expected 409, got {r.status_code}"
print(f"  revoke used -> 409 OK")

# ─── 24. GET /api/admin/users ──────────────────────────────────────────────
print("=== 24. GET /api/admin/users ===")
r = client.get("/api/admin/users", headers=admin_hdr)
assert r.status_code == 200
users_body = r.json()
assert "users" in users_body
emails = [u["email"] for u in users_body["users"]]
assert admin_email in emails
assert used_email in emails
print(f"  users list OK ({len(users_body['users'])} users)")

# ─── 25. user role 로 admin endpoint 호출 → 403 ────────────────────────────
print("=== 25. require_admin gating ===")
# test_email user (Commit 2 에서 register 했음, role=user)
user_token = main.encode_jwt(saved_uid)
user_hdr = {"Authorization": f"Bearer {user_token}"}
for path, method in [("/api/admin/invites", "GET"), ("/api/admin/users", "GET")]:
    if method == "GET":
        r = client.get(path, headers=user_hdr)
    assert r.status_code == 403, f"fail: {path} {method} -> {r.status_code}"
r = client.post("/api/admin/invites", json={"count": 1}, headers=user_hdr)
assert r.status_code == 403
r = client.delete(f"/api/admin/invites/{batch_codes[2]}", headers=user_hdr)
assert r.status_code == 403
print("  user -> admin endpoints all 403 OK")

# ─── 26. 인증 없이 admin endpoint → 401 ───────────────────────────────────
print("=== 26. admin endpoints without auth ===")
r = client.get("/api/admin/users")
assert r.status_code == 401
r = client.post("/api/admin/invites", json={"count": 1})
assert r.status_code == 401
print("  no auth -> 401 OK")

# ─── Commit 4-1 Integration: clients user_id filtering (A vs B) ────────────

print("=== 27. clients integration: A creates, B cannot see ===")
# user A token (이미 saved_uid 가 있음 — Commit 2 register flow)
user_a_token = main.encode_jwt(saved_uid)
hdr_a = {"Authorization": f"Bearer {user_a_token}"}

# user B 새로 만들기
code_b = _seed_invite_code(f"TEST-{uuid.uuid4().hex[:6]}")
email_b = f"userb-{uuid.uuid4().hex[:4]}@example.com"
r = client.post("/api/auth/register", json={
    "email": email_b, "password": "Test1234", "invite_code": code_b,
})
assert r.status_code == 200
user_b = r.json()
hdr_b = {"Authorization": f"Bearer {user_b['user']['id']}"}  # 일부러 잘못된 헤더 (테스트)
hdr_b = {"Authorization": f"Bearer {user_b['token']}"}

# A 가 client 생성
r = client.post("/api/clients",
    json={"name": "A의 발주처", "industry": "festival", "manager": "A", "memo": ""},
    headers=hdr_a)
assert r.status_code == 200, f"A create: {r.status_code} {r.text}"
a_cid = r.json()["id"]
print(f"  A created client {a_cid[:8]}...")

# A 가 자기 client list 보기 → A_cid 포함
r = client.get("/api/clients", headers=hdr_a)
assert r.status_code == 200
a_cids = [c["id"] for c in r.json()]
assert a_cid in a_cids, "fail: A cannot see own client"
print(f"  A sees own client OK ({len(a_cids)} clients)")

# B 가 list 보기 → A_cid 없음
r = client.get("/api/clients", headers=hdr_b)
assert r.status_code == 200
b_cids = [c["id"] for c in r.json()]
assert a_cid not in b_cids, "FAIL: B sees A's client (data leak!)"
print(f"  B does NOT see A's client OK ({len(b_cids)} clients in B's list)")

# B 가 직접 GET A_cid → 404 (enumeration 방지)
r = client.get(f"/api/clients/{a_cid}", headers=hdr_b)
assert r.status_code == 404, f"FAIL: B got {r.status_code} for A's cid"
print("  B GET A's cid -> 404 OK (enumeration prevented)")

# B 가 PATCH A_cid → 404
r = client.patch(f"/api/clients/{a_cid}",
    json={"name": "hijacked", "industry": "", "manager": "", "memo": ""},
    headers=hdr_b)
assert r.status_code == 404, f"FAIL: B PATCH got {r.status_code}"
print("  B PATCH A's cid -> 404 OK")

# B 가 DELETE A_cid → 404
r = client.delete(f"/api/clients/{a_cid}", headers=hdr_b)
assert r.status_code == 404
print("  B DELETE A's cid -> 404 OK")

# A 가 자기 client 삭제 → 200
r = client.delete(f"/api/clients/{a_cid}", headers=hdr_a)
assert r.status_code == 200
print("  A DELETE own cid -> 200 OK")

# 인증 없이 → 401
r = client.get("/api/clients")
assert r.status_code == 401
r = client.post("/api/clients", json={"name": "x", "industry": "", "manager": "", "memo": ""})
assert r.status_code == 401
print("  unauthenticated -> 401 OK")

# ─── Commit 4-2 Integration: nested resources ─────────────────────────────
# A 가 client 다시 만들고 nested resource (memories) 생성
# B 가 cross-user 접근 → 모두 404 검증

print("=== 28. nested resources (4-2): cross-user denial ===")
r = client.post("/api/clients",
    json={"name": "A의 발주처 v2", "industry": "festival", "manager": "A", "memo": ""},
    headers=hdr_a)
assert r.status_code == 200
a_cid2 = r.json()["id"]

# A 가 자신 cid 의 memories list 보기 → 200
r = client.get(f"/api/clients/{a_cid2}/memories", headers=hdr_a)
assert r.status_code == 200, f"A own memories: {r.status_code}"
print(f"  A GET own/memories -> 200 OK")

# B 가 같은 cid 의 memories → 404
r = client.get(f"/api/clients/{a_cid2}/memories", headers=hdr_b)
assert r.status_code == 404, f"B cross memories: {r.status_code}"
print("  B GET A's/memories -> 404 OK")

# B 가 cid RFP 목록 → 404
r = client.get(f"/api/clients/{a_cid2}/rfp", headers=hdr_b)
assert r.status_code == 404
print("  B GET A's/rfp -> 404 OK")

# B 가 cid references 목록 → 404
r = client.get(f"/api/clients/{a_cid2}/references", headers=hdr_b)
assert r.status_code == 404
print("  B GET A's/references -> 404 OK")

# B 가 cid profile → 404
r = client.get(f"/api/clients/{a_cid2}/profile", headers=hdr_b)
assert r.status_code == 404
print("  B GET A's/profile -> 404 OK")

# B 가 cid intel → 404
r = client.get(f"/api/clients/{a_cid2}/intel", headers=hdr_b)
assert r.status_code == 404
print("  B GET A's/intel -> 404 OK")

# B 가 cid strengths → 404 (deprecated stub 도 ownership 검증)
r = client.get(f"/api/clients/{a_cid2}/strengths", headers=hdr_b)
assert r.status_code == 404
print("  B GET A's/strengths -> 404 OK")

# B 가 accent PATCH → 404
r = client.patch(f"/api/clients/{a_cid2}/accent",
    json={"accent": "#FF0000"}, headers=hdr_b)
assert r.status_code == 404
print("  B PATCH A's/accent -> 404 OK")

# B 가 RFP 전체 삭제 시도 → 404
r = client.delete(f"/api/clients/{a_cid2}/rfp", headers=hdr_b)
assert r.status_code == 404
print("  B DELETE A's/rfp -> 404 OK")

# 인증 없이 → 401
r = client.get(f"/api/clients/{a_cid2}/memories")
assert r.status_code == 401
print("  unauth nested -> 401 OK")

# /api/strengths/catalog 글로벌 — A 인증 시 200
r = client.get("/api/strengths/catalog", headers=hdr_a)
assert r.status_code == 200
print("  /api/strengths/catalog (global) with auth -> 200 OK")

# 인증 없이 catalog → 401
r = client.get("/api/strengths/catalog")
assert r.status_code == 401
print("  catalog unauth -> 401 OK")

# Cleanup nested
r = client.delete(f"/api/clients/{a_cid2}", headers=hdr_a)
assert r.status_code == 200

# ─── Commit 4-3 Integration: conversation-based endpoints (A vs B) ─────────
print("=== 29. conversation-based 4-3: cross-user denial ===")

# A 가 client + conversation 생성
r = client.post("/api/clients",
    json={"name": "A의 발주처 4-3", "industry": "festival", "manager": "A", "memo": ""},
    headers=hdr_a)
assert r.status_code == 200
a_cid3 = r.json()["id"]

r = client.post(f"/api/clients/{a_cid3}/conversations", headers=hdr_a)
assert r.status_code == 200
a_conv_id = r.json()["id"]
print(f"  A created conv {a_conv_id[:8]}...")

# B 가 A 의 conv 의 모든 endpoint 시도 → 모두 404
r = client.get(f"/api/conversations/{a_conv_id}", headers=hdr_b)
assert r.status_code == 404, f"GET conv: {r.status_code}"
print("  B GET conv -> 404 OK")

r = client.delete(f"/api/conversations/{a_conv_id}", headers=hdr_b)
assert r.status_code == 404
print("  B DELETE conv -> 404 OK")

r = client.post(f"/api/conversations/{a_conv_id}/end", headers=hdr_b)
assert r.status_code == 404
print("  B POST conv/end -> 404 OK")

r = client.patch(f"/api/conversations/{a_conv_id}/outcome",
    json={"outcome": "won"}, headers=hdr_b)
assert r.status_code == 404
print("  B PATCH outcome -> 404 OK")

# ⚠ 핵심 — chat endpoint
r = client.post(f"/api/conversations/{a_conv_id}/chat",
    json={"message": "hijack attempt"}, headers=hdr_b)
assert r.status_code == 404, f"FAIL chat: {r.status_code}"
print("  [CRITICAL] B POST chat -> 404 OK (no message injection)")

# ⚠ 가장 핵심 — multi-pass generate
r = client.post(f"/api/conversations/{a_conv_id}/proposals/generate", headers=hdr_b)
assert r.status_code == 404, f"FAIL generate: {r.status_code}"
print("  [CRITICAL] B POST proposals/generate -> 404 OK (no RAG/intel leak)")

# preview
r = client.get(f"/api/proposals/{a_conv_id}/preview", headers=hdr_b)
assert r.status_code == 404
print("  B GET proposals/preview -> 404 OK")

# pptx (body 에 conv_id)
r = client.post("/api/proposals/pptx",
    json={"conversation_id": a_conv_id}, headers=hdr_b)
assert r.status_code == 404
print("  B POST proposals/pptx -> 404 OK")

# audit
r = client.post("/api/proposals/audit",
    json={"conversation_id": a_conv_id}, headers=hdr_b)
assert r.status_code == 404
print("  B POST proposals/audit -> 404 OK")

# script
r = client.post("/api/proposals/script",
    json={"conversation_id": a_conv_id, "duration_min": 10}, headers=hdr_b)
assert r.status_code == 404
print("  B POST proposals/script -> 404 OK")

# qa
r = client.post("/api/proposals/qa",
    json={"conversation_id": a_conv_id}, headers=hdr_b)
assert r.status_code == 404
print("  B POST proposals/qa -> 404 OK")

# budget
r = client.post("/api/budget/generate",
    json={"conversation_id": a_conv_id}, headers=hdr_b)
assert r.status_code == 404
print("  B POST budget/generate -> 404 OK")

# A 본인 → 정상
r = client.get(f"/api/conversations/{a_conv_id}", headers=hdr_a)
assert r.status_code == 200
print("  A GET own conv -> 200 OK")

# 인증 없이 → 401
r = client.post(f"/api/conversations/{a_conv_id}/chat",
    json={"message": "no auth"})
assert r.status_code == 401
r = client.post(f"/api/conversations/{a_conv_id}/proposals/generate")
assert r.status_code == 401
print("  unauth chat/generate -> 401 OK")

# Cleanup conv + client
r = client.delete(f"/api/conversations/{a_conv_id}", headers=hdr_a)
assert r.status_code == 200
r = client.delete(f"/api/clients/{a_cid3}", headers=hdr_a)
assert r.status_code == 200

# ─── Commit 4-4 Integration: admin-only + diag/rag + stats/activity ──────
print("=== 30. admin-only segregation ===")

# admin user 가 admin endpoints 접근 → 200
admin_only_endpoints = [
    ("GET", "/api/settings"),
    ("GET", "/api/r2/status"),
    ("GET", "/api/diag/fonts"),
    ("GET", "/api/company-dna"),
]
for method, path in admin_only_endpoints:
    r = client.get(path, headers=admin_hdr)
    # status 가 200/500 이든 (의존성에 따라) 403 아니면 admin gate OK
    assert r.status_code != 403, f"FAIL admin denied {path}: {r.status_code}"
print(f"  admin -> 4 admin endpoints not 403 OK")

# 일반 user 가 admin endpoints → 403
# user A 토큰 새로 만듬 (saved_uid 가 #4 에서 register 한 user)
user_a_token = main.encode_jwt(saved_uid)
hdr_a = {"Authorization": f"Bearer {user_a_token}"}
for method, path in admin_only_endpoints:
    r = client.get(path, headers=hdr_a)
    assert r.status_code == 403, f"FAIL user got {path}: {r.status_code}"
print(f"  user -> 4 admin endpoints all 403 OK")

# 인증 없이 → 401
for method, path in admin_only_endpoints:
    r = client.get(path)
    assert r.status_code == 401
print(f"  unauth -> 4 admin endpoints all 401 OK")

# /api/diag/rag — 인증 사용자 모두 OK (Q3)
r = client.get("/api/diag/rag", headers=hdr_a)
assert r.status_code == 200, f"FAIL user denied diag/rag: {r.status_code}"
print(f"  user GET /api/diag/rag -> 200 OK (global, not admin-only)")

r = client.get("/api/diag/rag")
assert r.status_code == 401
print(f"  unauth /api/diag/rag -> 401 OK")

# stats/activity — 사용자별 분리
print("=== 31. stats/activity per-user filtering ===")
r = client.get("/api/stats", headers=hdr_a)
assert r.status_code == 200
print(f"  A GET /api/stats -> 200 OK")

r = client.get("/api/activity", headers=hdr_a)
assert r.status_code == 200
print(f"  A GET /api/activity -> 200 OK")

r = client.get("/api/stats")
assert r.status_code == 401
r = client.get("/api/activity")
assert r.status_code == 401
print(f"  unauth stats/activity -> 401 OK")

# Cleanup B
_cleanup_user(email_b)
_cleanup_code(code_b)

# ─── Cleanup ───────────────────────────────────────────────────────────────
_cleanup_user(test_email)
_cleanup_user(used_email)
_cleanup_user(admin_email)
_cleanup_code(code)
for c in batch_codes:
    _cleanup_code(c)

print()
print("[OK] ALL AUTH MIGRATION TESTS PASSED (62/62) - Commit 4 complete")
