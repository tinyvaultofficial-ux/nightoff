"""Auth coverage check - main.py 의 모든 @app endpoint 가 인증 적용됐는지 검증.

용도: Commit 4 sub-commits 마다 누락 endpoint 식별. CI 에 통합 가능.
"""
import re
import sys
from pathlib import Path

# 인증 면제 endpoint (URL pattern 또는 prefix)
AUTH_EXEMPT_PATTERNS = [
    r"^/$",
    r"^/healthz$",
    r"^/favicon\.ico$",
    r"^/static/",
    r"^/client/",          # SPA route fallback
    r"^/api/auth/",         # auth 자체
    r"^/api/signup$",       # deprecated (410)
]

# 4-1 시점: clients endpoints 만 인증 적용 검증
SUB_COMMIT_4_1 = [
    "GET    /api/clients",
    "POST   /api/clients",
    "GET    /api/clients/{cid}",
    "PATCH  /api/clients/{cid}",
    "DELETE /api/clients/{cid}",
]


def parse_endpoints(main_py: Path):
    """main.py 에서 @app.{get,post,...} decorator + 다음 함수 정의 추출.
    return: [(method, path, func_name, has_auth, line_no), ...]
    """
    src = main_py.read_text(encoding="utf-8")
    lines = src.split("\n")
    endpoints = []
    deco_re = re.compile(r'^@app\.(get|post|put|patch|delete)\(\s*"([^"]+)"')
    # nested paren 포함 매칭 (Depends(get_current_user) 같은 default arg 처리)
    func_re = re.compile(r"^(?:async\s+)?def\s+(\w+)\s*\((.*)\)\s*(?:->\s*[^:]+)?:", re.DOTALL)

    i = 0
    while i < len(lines):
        m = deco_re.match(lines[i])
        if m:
            method = m.group(1).upper()
            path = m.group(2)
            # decorator 다음 정의 찾기 (multi-line 가능)
            j = i + 1
            buf = ""
            while j < len(lines) and j < i + 30:
                buf += lines[j] + "\n"
                if "):" in buf or ") ->" in buf:
                    fm = func_re.match(buf)
                    if fm:
                        func_name = fm.group(1)
                        args = fm.group(2)
                        has_auth = "Depends(get_current_user)" in args or "Depends(require_admin)" in args
                        endpoints.append((method, path, func_name, has_auth, i + 1))
                    break
                j += 1
        i += 1
    return endpoints


def is_exempt(path):
    return any(re.match(p, path) for p in AUTH_EXEMPT_PATTERNS)


def main():
    repo = Path(__file__).parent
    endpoints = parse_endpoints(repo / "main.py")

    print(f"=== Total @app endpoints: {len(endpoints)} ===\n")

    exempt = [e for e in endpoints if is_exempt(e[1])]
    protected = [e for e in endpoints if e[3] and not is_exempt(e[1])]
    unprotected = [e for e in endpoints if not e[3] and not is_exempt(e[1])]

    print(f"[exempt]      {len(exempt):>3} endpoints (인증 면제 - / / /healthz / /api/auth/* 등)")
    print(f"[protected]   {len(protected):>3} endpoints (Depends(get_current_user) or require_admin 적용)")
    print(f"[unprotected] {len(unprotected):>3} endpoints (인증 미적용 - Commit 4 처리 대상)")
    print()

    print("=== protected (4-1 진행 후) ===")
    for m, p, fn, _, ln in protected:
        print(f"  L{ln:<5} {m:<7} {p}  ({fn})")
    print()

    print("=== unprotected (Commit 4-2/4-3/4-4 대기) ===")
    for m, p, fn, _, ln in unprotected:
        print(f"  L{ln:<5} {m:<7} {p}  ({fn})")
    print()

    # 4-1 + 4-2 검증
    print("=== 4-1 + 4-2 verification ===")
    expected_4_1 = {
        ("GET", "/api/clients"),
        ("POST", "/api/clients"),
        ("GET", "/api/clients/{cid}"),
        ("PATCH", "/api/clients/{cid}"),
        ("DELETE", "/api/clients/{cid}"),
    }
    expected_4_2 = {
        ("GET", "/api/clients/{cid}/conversations"),
        ("POST", "/api/clients/{cid}/conversations"),
        ("POST", "/api/clients/{cid}/rfp"),
        ("POST", "/api/clients/{cid}/rfp/upload"),
        ("GET", "/api/clients/{cid}/rfp"),
        ("PATCH", "/api/clients/{cid}/rfp/files/{fid}"),
        ("DELETE", "/api/clients/{cid}/rfp/files/{fid}"),
        ("DELETE", "/api/clients/{cid}/rfp"),
        ("GET", "/api/clients/{cid}/references"),
        ("POST", "/api/clients/{cid}/references"),
        ("DELETE", "/api/references/{ref_id}"),
        ("GET", "/api/clients/{cid}/profile"),
        ("POST", "/api/clients/{cid}/profile/rebuild"),
        ("GET", "/api/strengths/catalog"),
        ("GET", "/api/clients/{cid}/strengths"),
        ("GET", "/api/clients/{cid}/memories"),
        ("DELETE", "/api/memories/{mem_id}"),
        ("GET", "/api/clients/{cid}/intel"),
        ("POST", "/api/clients/{cid}/intel/rebuild"),
        ("PATCH", "/api/clients/{cid}/accent"),
        ("GET", "/api/clients/{cid}/accent"),
    }
    actual_protected = {(m, p) for m, p, _, _, _ in protected}
    missing_4_1 = expected_4_1 - actual_protected
    missing_4_2 = expected_4_2 - actual_protected
    if missing_4_1:
        print(f"  [FAIL 4-1] missing: {missing_4_1}")
        sys.exit(1)
    print(f"  [OK 4-1] all {len(expected_4_1)} clients endpoints protected")
    if missing_4_2:
        print(f"  [FAIL 4-2] missing: {missing_4_2}")
        sys.exit(1)
    print(f"  [OK 4-2] all {len(expected_4_2)} clients-nested endpoints protected")

    expected_4_3 = {
        ("GET", "/api/conversations/{conv_id}"),
        ("DELETE", "/api/conversations/{conv_id}"),
        ("POST", "/api/conversations/{conv_id}/end"),
        ("PATCH", "/api/conversations/{conv_id}/outcome"),
        ("POST", "/api/conversations/{conv_id}/chat"),
        ("POST", "/api/conversations/{conv_id}/proposals/generate"),
        ("GET", "/api/proposals/{conv_id}/preview"),
        ("POST", "/api/proposals/pptx"),
        ("POST", "/api/proposals/audit"),
        ("POST", "/api/proposals/script"),
        ("POST", "/api/proposals/qa"),
        ("POST", "/api/budget/generate"),
    }
    missing_4_3 = expected_4_3 - actual_protected
    if missing_4_3:
        print(f"  [FAIL 4-3] missing: {missing_4_3}")
        sys.exit(1)
    print(f"  [OK 4-3] all {len(expected_4_3)} conversation-based endpoints protected")


if __name__ == "__main__":
    main()
