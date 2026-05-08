"""Multi-pass orchestrator 단위 테스트.

Anthropic 호출을 mock 으로 대체해서 흐름·병합·SSE 이벤트만 검증.
"""
import asyncio, json, sys
sys.path.insert(0, ".")

import proposal_multi_pass as mp


# ─── Mock Anthropic client ────────────────────────────────────────────────────
class MockMsg:
    def __init__(self, text):
        self.content = [type("Block", (), {"type": "text", "text": text})()]


class MockMessages:
    def __init__(self, parent):
        self.parent = parent

    def create(self, *, model, max_tokens, system, messages):
        # system 의 첫 100자로 phase 구분
        if "outline" in system[:200] or "outline" in system.lower()[:500]:
            # Outline phase
            text = json.dumps({
                "title": "테스트 제안서",
                "domain": "festival",
                "slide_width": 13.33,
                "slide_height": 7.5,
                "total_slides": 4,
                "outline": [
                    # 1차-2 영역 정합 — governing → governing_main / governing_sub 분리
                    {"page": 1, "section": "표지", "governing_main": "테스트 표지", "governing_sub": [],
                     "key_msgs": ["메시지1", "메시지2"], "viz_hint": "표지"},
                    {"page": 2, "section": "목차", "governing_main": "CONTENTS", "governing_sub": [],
                     "key_msgs": ["I", "II", "III"], "viz_hint": "목차"},
                    {"page": 3, "section": "Ⅰ.1 추진배경", "governing_main": "추진 배경 거버닝",
                     "governing_sub": ["행사기간 2026.10.17", "참여 5만 명"],
                     "key_msgs": ["배경1", "배경2", "배경3"], "viz_hint": "AS-IS/TO-BE 비교"},
                    {"page": 4, "section": "마무리", "governing_main": "감사합니다", "governing_sub": [],
                     "key_msgs": ["연락처"], "viz_hint": "마무리"},
                ],
            }, ensure_ascii=False)
        else:
            # Slide phase — user 메시지에서 page 추출
            user_text = messages[0]["content"] if messages else ""
            import re
            pm = re.search(r"\[현재 슬라이드 페이지\]\s*(\d+)", user_text)
            section_m = re.search(r"\[섹션\]\s*(\S.*?)(?:\n|$)", user_text)
            page = int(pm.group(1)) if pm else 0
            section = section_m.group(1).strip() if section_m else f"p{page}"
            text = json.dumps({
                "section": section,
                "shapes": [
                    {"type": "rect", "x": 0, "y": 0, "w": 0.4, "h": 7.5, "fill": "#1A1A1A"},
                    {"type": "text", "x": 0.8, "y": 1, "w": 10, "h": 1,
                     "text": f"슬라이드 {page} · {section}", "size": 32, "weight": 800, "color": "#1A1A1A"},
                    {"type": "text", "x": 0.8, "y": 2.5, "w": 10, "h": 0.5,
                     "text": "본문 내용 빽빽하게 채움", "size": 12, "color": "#444"},
                ] * 5,  # 도형 15개
            }, ensure_ascii=False)
        return MockMsg(text)


class MockClient:
    def __init__(self):
        self.messages = MockMessages(self)


# ─── 테스트 실행 ──────────────────────────────────────────────────────────────
async def main():
    client = MockClient()
    events = []

    async for ev in mp.orchestrate(
        client=client,
        rfp_block="[RFP 분석]\n{...}",
        rag_block_global="[RAG global hint]",
        rag_for_slide=lambda item: f"[RAG for p{item.page}]",
        intel_block="",
        concurrency=2,  # 2개씩 병렬
    ):
        events.append(ev)
        # 진행률 출력
        if ev["type"] == "phase":
            print(f"[phase] {ev['phase']} · {ev['message']}")
        elif ev["type"] == "outline_done":
            print(f"[outline_done] total={ev['total_slides']} · title={ev['title']} · elapsed={ev['elapsed_sec']}초")
            for o in ev["outline"]:
                print(f"   p{o['page']}. {o['section']} | {o['governing']}")
        elif ev["type"] == "slide_done":
            mark = "OK " if ev["ok"] else "FAIL"
            print(f"[slide_done] {mark} p{ev['page']} ({ev['shapes_count']} 도형) · {ev['section']} · 진행 {ev['progress']}/{ev['total']}")
        elif ev["type"] == "done":
            print(f"[done] {ev['ok_slides']}/{ev['total']} 슬라이드 성공 · {ev['elapsed_sec']}초")
            print(f"   payload.title={ev['payload']['title']}")
            print(f"   payload.slides 수={len(ev['payload']['slides'])}")

    # 검증
    types_seen = [e["type"] for e in events]
    assert "phase" in types_seen
    assert "outline_done" in types_seen
    slide_dones = [e for e in events if e["type"] == "slide_done"]
    assert len(slide_dones) == 4, f"slide_done 수 = {len(slide_dones)}"
    assert all(e["ok"] for e in slide_dones), "실패 슬라이드 있음"
    done_ev = [e for e in events if e["type"] == "done"][0]
    payload = done_ev["payload"]
    assert payload["title"] == "테스트 제안서"
    assert len(payload["slides"]) == 4
    assert payload["slide_width"] == 13.33

    # 페이지 순서 보장 (병렬이라도 정렬됨)
    sections = [s["section"] for s in payload["slides"]]
    assert sections == ["표지", "목차", "Ⅰ.1 추진배경", "마무리"], f"순서 어긋남: {sections}"

    # 각 슬라이드 도형 수
    for s in payload["slides"]:
        assert len(s["shapes"]) >= 5, f"{s['section']} 도형 부족 ({len(s['shapes'])})"

    # 실제 PPTX 그려봐서 errors 없는지
    import pptx_generator as pg
    from pathlib import Path
    out = Path("_multi_pass_test.pptx")
    result = pg.generate_from_shape_json(payload, out)
    print(f"\n[render] PPTX 생성 OK · slides={result['slide_count']} · 도형 {result['rendered_total']} · errors={len(result['errors'])}")
    assert result["slide_count"] == 4
    assert not result["errors"]

    print("\n전체 PASS")


asyncio.run(main())
