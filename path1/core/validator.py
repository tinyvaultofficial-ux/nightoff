"""
강 3 안전판 (validator).
LLM이 뱉은 JSON을 받아 검증한다. 핵심 원칙:
  - LLM은 '제안'만 한다. 코드가 '최종 결정'한다.
  - 틀에 안 맞으면 (a) 자동 교정 가능하면 교정, (b) 불가능하면 거부 사유 반환.
  - 거부된 슬라이드는 호출부가 도형 모드로 fallback 시킬 수 있다 (안전망).
이 파일은 LLM 없이도 단독 테스트 가능 (가짜 JSON 넣어서).
"""

# 템플릿별 규칙: 어떤 필드가 필요하고, 반복 요소는 몇 개까지 허용하나.
TEMPLATE_RULES = {
    "KPI": {
        "list_field": "metrics",
        "min": 3, "max": 5,
        "item_required": ["label", "value"],     # delta/note 는 선택
        "text_caps": {"label": 8, "value": 8},    # 글자수 상한(원 안에 들어가야)
    },
    "SEG": {
        "list_field": "segments",
        "min": 2, "max": 4,
        "item_required": ["keyword", "subtitle"],
        "text_caps": {"keyword": 7, "subtitle": 24},
    },
    "FLOW": {
        "list_field": "steps",
        "min": 3, "max": 4,
        "item_required": ["keyword"],
        "text_caps": {"keyword": 12},
    },
}

class ValidationResult:
    def __init__(self, ok, data=None, reason="", repaired=False, notes=None):
        self.ok = ok            # True=쓸 수 있음, False=거부(fallback 필요)
        self.data = data        # 검증/교정된 데이터
        self.reason = reason    # 거부 사유
        self.repaired = repaired
        self.notes = notes or []  # 교정 내역(투명성)

    def __repr__(self):
        s = "OK" if self.ok else "REJECT"
        extra = " [교정됨]" if self.repaired else ""
        return f"<{s}{extra} reason='{self.reason}' notes={self.notes}>"


def validate_slide(slide_json):
    """LLM이 뱉은 슬라이드 1개 JSON을 검증."""
    notes = []

    # 1) 템플릿 ID 존재 + 화이트리스트
    tpl = slide_json.get("template")
    if tpl not in TEMPLATE_RULES:
        return ValidationResult(
            False, reason=f"알 수 없는 템플릿 '{tpl}' (허용: {list(TEMPLATE_RULES)})")
    rule = TEMPLATE_RULES[tpl]

    # 2) 반복 요소 리스트 존재 + 개수 범위
    items = slide_json.get(rule["list_field"])
    if not isinstance(items, list):
        return ValidationResult(
            False, reason=f"'{rule['list_field']}' 리스트가 없음 (template={tpl})")

    n = len(items)
    if n < rule["min"]:
        return ValidationResult(
            False, reason=f"{tpl}: 요소 {n}개 < 최소 {rule['min']}개. 다른 템플릿 필요.")
    if n > rule["max"]:
        # 자동 교정: 상위 max개만 사용 (LLM이 중요도순 정렬했다고 가정)
        items = items[:rule["max"]]
        notes.append(f"{tpl}: 요소 {n}개 → 상위 {rule['max']}개로 자름")

    # 3) 각 요소의 필수 필드 + 글자수 상한
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            return ValidationResult(False, reason=f"{tpl}: 요소[{i}]가 객체가 아님")
        for req in rule["item_required"]:
            if not str(it.get(req, "")).strip():
                return ValidationResult(
                    False, reason=f"{tpl}: 요소[{i}] 필수필드 '{req}' 비어있음")
        # 글자수 상한 초과 → 자동 교정(잘라내고 … 안 붙임, 그냥 자름은 위험하니 표시만)
        for field, cap in rule["text_caps"].items():
            v = str(it.get(field, ""))
            if len(v) > cap:
                notes.append(f"{tpl}: 요소[{i}] '{field}' {len(v)}자 > 상한 {cap}자 (넘침 주의)")

    # 통과
    repaired = bool(notes)
    out = dict(slide_json)
    out[rule["list_field"]] = items
    return ValidationResult(True, data=out, repaired=repaired, notes=notes)


def validate_deck(deck_json):
    """슬라이드 배열 전체 검증. 각 슬라이드별 결과 + 통계 반환."""
    results = []
    for idx, sj in enumerate(deck_json):
        r = validate_slide(sj)
        results.append((idx, sj.get("template", "?"), r))
    ok = sum(1 for _,_,r in results if r.ok)
    rej = sum(1 for _,_,r in results if not r.ok)
    rep = sum(1 for _,_,r in results if r.ok and r.repaired)
    return results, {"total": len(results), "ok": ok, "rejected": rej, "repaired": rep}


if __name__ == "__main__":
    import json
    cases = json.load(open("llm_cases.json", encoding="utf-8"))
    print("=" * 70)
    for name, deck in cases.items():
        print(f"\n### 케이스: {name}")
        results, stats = validate_deck(deck)
        print(f"  통계: 총 {stats['total']} / 통과 {stats['ok']} / 거부 {stats['rejected']} / 교정 {stats['repaired']}")
        for idx, tpl, r in results:
            mark = "✅" if r.ok else "❌"
            line = f"  {mark} 슬라이드[{idx}] template={tpl}"
            if r.reason: line += f" — {r.reason}"
            if r.notes: line += f" | 교정: {r.notes}"
            print(line)
