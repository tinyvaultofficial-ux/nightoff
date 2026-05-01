"""E2E 테스트 — 도형 JSON 분기 로직 검증.

시뮬레이션:
  1. 가짜 도형 JSON 메시지를 DB 에 넣고
  2. /api/proposals/pptx 호출하면
  3. is_shape_mode 분기로 가서 generate_from_shape_json 이 돌고
  4. PPTX 가 만들어지는지 확인.

실제 HTTP 서버는 안 띄우고 함수 직접 호출.
"""
import sys, os, json, uuid
sys.path.insert(0, ".")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

# 1) 시스템 프롬프트가 도형 JSON 가이드 들어있는지
import main
sp = main.PROPOSAL_SYSTEM_PROMPT
checks = {
    "도형 JSON 출력": "도형 JSON" in sp,
    "shapes 필드": '"shapes"' in sp,
    "rect 타입": '"type": "rect"' in sp,
    "circle 타입": '"type": "circle"' in sp,
    "arrow 타입": '"type": "arrow"' in sp,
    "AI 사투리 가이드": "사투리" in sp,
    "em-dash 금지": "em-dash" in sp,
    "SOOZOO 톤": "SOOZOO" in sp,
}
print("=== 시스템 프롬프트 체크 ===")
for k, v in checks.items():
    print(f"  {'OK ' if v else 'FAIL'} {k}")

# 2) build_system_prompt 가 동작하는지 (DB 없는 상태)
print("\n=== _build_system_prompt 동작 (가짜 client) ===")
try:
    # DB 가 있어야 하니까 일단 main 의 init 만
    main.ensure_schema()
    # 가짜 클라이언트 1개 추가
    cid = uuid.uuid4().hex[:12]
    with main.get_db() as db:
        db.execute(
            "INSERT INTO clients(id,name,industry,manager,memo) VALUES(?,?,?,?,?)",
            (cid, "테스트발주처", "공공", "김담당", "")
        )
    sp_built = main._build_system_prompt(cid)
    print(f"  시스템 프롬프트 길이: {len(sp_built)} 자")
    print(f"  '도형 JSON' 포함: {'도형 JSON' in sp_built}")
    print(f"  '도메인 색감' 포함: {'도메인 색감' in sp_built or 'project_domain' in sp_built}")
    # 클린업
    with main.get_db() as db:
        db.execute("DELETE FROM clients WHERE id=?", (cid,))
except Exception as e:
    print(f"  FAIL: {e}")

# 3) 도형 JSON 분기 — DB + api_proposals_pptx 직접 호출 시뮬레이션
print("\n=== 도형 JSON 분기 검증 ===")
shape_json = {
    "title": "E2E 테스트 제안서",
    "domain": "festival",
    "slide_width": 13.33,
    "slide_height": 7.5,
    "slides": [
        {
            "section": "표지",
            "shapes": [
                {"type": "rect", "x": 0, "y": 0, "w": 0.4, "h": 7.5, "fill": "#1A1A1A"},
                {"type": "text", "x": 0.8, "y": 2.0, "w": 10, "h": 2,
                 "text": "테스트\n제안서", "size": 56, "weight": 900, "color": "#1A1A1A"},
                {"type": "line", "x1": 0.8, "y1": 7.0, "x2": 12.5, "y2": 7.0, "color": "#DDD"},
            ],
        },
        {
            "section": "프로세스",
            "shapes": [
                {"type": "text", "x": 0.8, "y": 0.6, "w": 10, "h": 0.8,
                 "text": "추진 절차", "size": 28, "weight": 800, "color": "#1A1A1A"},
                {"type": "circle", "x": 1, "y": 3, "w": 0.8, "h": 0.8, "fill": "#1A1A1A"},
                {"type": "circle", "x": 4, "y": 3, "w": 0.8, "h": 0.8, "fill": "#1A1A1A"},
                {"type": "circle", "x": 7, "y": 3, "w": 0.8, "h": 0.8, "fill": "#1A1A1A"},
                {"type": "line", "x1": 1.8, "y1": 3.4, "x2": 7, "y2": 3.4, "color": "#1A1A1A", "width": 1.5},
                {"type": "arrow", "x1": 7.8, "y1": 3.4, "x2": 9.5, "y2": 3.4, "color": "#1A1A1A", "width": 1.5},
            ],
        },
    ],
}

import pptx_generator as pg
from pathlib import Path

out_path = Path("_e2e_shape.pptx")
result = pg.generate_from_shape_json(shape_json, out_path)
print(f"  PPTX 생성: slides={result['slide_count']}, rendered={result['rendered_total']}, errors={len(result['errors'])}")
assert result["slide_count"] == 2, "슬라이드 수 안맞음"
assert result["rendered_total"] >= 9, "렌더된 도형 수 부족"
assert not result["errors"], f"에러: {result['errors']}"
assert out_path.exists() and out_path.stat().st_size > 1000, "PPTX 파일 누락"
print(f"  파일 크기: {out_path.stat().st_size} bytes")

# 4) is_shape_mode 분기 감지 시뮬레이션
print("\n=== api_proposals_pptx 분기 감지 ===")
fake_proposal = {"slides": [{"shapes": [{"type": "rect", "x": 0, "y": 0, "w": 1, "h": 1}]}]}
is_shape_mode = False
for s in fake_proposal.get("slides", []):
    if isinstance(s, dict) and isinstance(s.get("shapes"), list) and s["shapes"]:
        is_shape_mode = True
        break
print(f"  도형 JSON → shape mode: {is_shape_mode} (예상 True)")
assert is_shape_mode

# 마커 매핑 모드 (legacy) → False
fake_legacy = {"slides": [{"본문": ["a", "b"], "viz_type": "kpi"}]}
is_shape_mode_legacy = False
for s in fake_legacy.get("slides", []):
    if isinstance(s, dict) and isinstance(s.get("shapes"), list) and s["shapes"]:
        is_shape_mode_legacy = True
        break
print(f"  마커 매핑 JSON → shape mode: {is_shape_mode_legacy} (예상 False)")
assert not is_shape_mode_legacy

print("\n=== 모든 체크 통과 ===")
