"""
템플릿 선택기 (selector).
핵심 통찰: 템플릿은 '내용이 무슨 주제냐'가 아니라 '내용이 어떤 형태(shape)냐'로 결정된다.

  - 숫자 성과/지표가 3~5개          → KPI   (원형 숫자 강조)
  - 병렬적인 개념/축이 2~4개        → SEG   (명도 분할)
  - 순차적인 단계/흐름이 3~4개      → FLOW  (화살표 연결)

이 selector 는 두 가지로 쓰인다:
  1) LLM 지시서의 '판단 규칙' 원문 (아래 RULE_TEXT)
  2) LLM이 고른 걸 코드가 교차검증하거나, LLM 없이 규칙 기반으로 1차 후보를 뽑을 때

LLM 없이 단독 테스트 가능.
"""

# === LLM 지시서에 그대로 들어갈 판단 규칙 (사람이 읽는 버전) ===
RULE_TEXT = """\
[템플릿 선택 규칙]
당신은 제안서 슬라이드 1개의 내용을 받아, 아래 3개 템플릿 중 가장 맞는 것을 고른다.
'내용의 형태'를 보고 판단한다. 주제가 아니라 구조를 본다.

1) KPI — 정량 성과/목표 숫자를 강조할 때.
   조건: 핵심 숫자 지표가 3~5개. 각 지표는 [라벨 + 숫자값(+증감률)] 형태.
   예: 관람객 374만명, 매출 20억원 같은 성과 나열.

2) SEG — 병렬적인 개념·축·키워드를 나란히 보여줄 때.
   조건: 대등한 항목이 2~4개. 각 항목은 [키워드 + 한 줄 부제/설명] 형태.
   순서나 흐름이 없고, 서로 대등하면 SEG.
   예: 서울/광화문광장/빛초롱축제 같은 세 축.

3) FLOW — 순차적인 단계·과정·흐름을 보여줄 때.
   조건: 단계가 3~4개이고, 앞→뒤 순서가 의미 있음.
   예: 기획→준비→운영→성과 같은 진행 단계.

어느 것에도 안 맞으면 (지표가 6개 이상이거나, 항목이 1~2개뿐이거나,
표/지도/자유 배치가 필요하면) template 을 "NONE" 으로 두라.
그러면 시스템이 안전한 기본 형식(도형 모드)으로 처리한다.
"""

def suggest_template(content):
    """
    내용 구조 힌트(dict)를 받아 규칙 기반으로 템플릿 후보를 제안.
    content 예: {"kind": "metrics", "count": 4} 또는
                {"kind": "parallel", "count": 3} / {"kind": "sequence", "count": 4}
    실제 운영에선 LLM이 이 판단을 하고, 이 함수는 '교차검증'에 쓰인다.
    """
    kind = content.get("kind")
    n = content.get("count", 0)

    if kind == "metrics" and 3 <= n <= 5:
        return "KPI", f"정량 지표 {n}개 → KPI"
    if kind == "parallel" and 2 <= n <= 4:
        return "SEG", f"병렬 개념 {n}개 → SEG"
    if kind == "sequence" and 3 <= n <= 4:
        return "FLOW", f"순차 단계 {n}개 → FLOW"

    # 경계 밖 → fallback
    reasons = {
        "metrics": f"지표 {n}개는 KPI 범위(3~5) 밖",
        "parallel": f"병렬 {n}개는 SEG 범위(2~4) 밖",
        "sequence": f"단계 {n}개는 FLOW 범위(3~4) 밖",
    }
    return "NONE", reasons.get(kind, f"알 수 없는 형태 '{kind}'") + " → 도형 모드 fallback"


def cross_check(llm_choice, content):
    """LLM이 고른 template 과 규칙 기반 제안이 일치하는지 교차검증."""
    rule_choice, reason = suggest_template(content)
    agree = (llm_choice == rule_choice)
    return {
        "llm": llm_choice,
        "rule": rule_choice,
        "agree": agree,
        "reason": reason,
        # 불일치 시 정책: 규칙이 NONE 이면 fallback 우선(안전), 그 외엔 규칙을 신뢰
        "final": llm_choice if agree else rule_choice,
    }


if __name__ == "__main__":
    import json
    print(RULE_TEXT)
    print("=" * 70)
    cases = json.load(open("selector_cases.json", encoding="utf-8"))
    for c in cases:
        desc = c["desc"]
        content = c["content"]
        llm = c.get("llm_choice")
        if llm is None:
            tpl, reason = suggest_template(content)
            print(f"  [{desc}]\n      규칙 제안: {tpl}  ({reason})")
        else:
            r = cross_check(llm, content)
            mark = "✅일치" if r["agree"] else "⚠️불일치→교정"
            print(f"  [{desc}]\n      LLM={r['llm']} / 규칙={r['rule']} → {mark} / 최종={r['final']}")
