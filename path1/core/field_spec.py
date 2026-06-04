"""
field_spec — path1 골격별 '칸 cap' 정의 + LLM 풍성화 결과 병합(cap 강제).

방향 B(내용 풍성화): adapter가 칸 구조를 만든 뒤, LLM이 각 칸을 cap 안에서 풍성하게 채운다.
이 모듈은 (1) 골격별 칸 cap을 한 곳에 정의(_PATH1_FIELD_SPEC) (2) LLM 출력을 cap 슬라이싱+
키 차단으로 안전하게 병합(merge_with_cap)한다.

cap 값은 adapter.py 변환 함수의 슬라이싱([:14] 등)에서 추출했다. adapter와 cap이 어긋나면
adapter가 한 번 더 자르므로 손실은 없지만, LLM에게 정확한 cap을 알려야 풍성화가 정밀해진다.

★ 주력 3종(G4/G7/G10)부터. 검증 후 15종으로 확장.
"""

# 골격별 칸 스펙.
#  - 평칸: {"max": N, "kind": "..."}  (N자 이내)
#  - 리스트칸: {"list": True, "min_n": .., "max_n": .., "shape": {칸: spec}}
#     · shape 안의 값이 정수면 그 자릿수, [{"max":N},{"max":M}]면 줄 단위 cap
_PATH1_FIELD_SPEC = {
    "G10": {  # 카드 그리드 — 동등한 N개 평면 나열
        "gov_main": {"max": 40, "kind": "governing"},
        "cards": {"list": True, "min_n": 2, "max_n": 6,
                  "shape": {"title": 14, "desc": [14, 14]}},
    },
    "G4": {  # 카테고리+항목 — 대분류 아래 세부
        "gov_main": {"max": 40, "kind": "governing"},
        "categories": {"list": True, "min_n": 2, "max_n": 4,
                       "shape": {"label": 8,
                                 "items": {"list": True, "min_n": 1, "max_n": 1,
                                           "shape": {"title": 14, "desc": 24}}}},
    },
    "G7": {  # 4분할 명도 — 정확히 4개 권장
        "segments": {"list": True, "min_n": 2, "max_n": 4,
                     "shape": {"label": 7, "title": 10, "desc": [14, 14]}},
    },
}


def _slice(v, n):
    return (str(v) if v is not None else "")[:n]


def _apply_shape(item, shape):
    """리스트 원소 1개(item dict)에 shape 규칙 적용 → cap 슬라이싱된 dict."""
    if not isinstance(item, dict):
        return {}
    out = {}
    for key, rule in shape.items():
        v = item.get(key)
        if isinstance(rule, int):                      # 단순 자릿수
            out[key] = _slice(v, rule)
        elif isinstance(rule, list):                   # 줄 단위 cap (예: desc [14,14])
            lines = v if isinstance(v, list) else [v]
            out[key] = [_slice(lines[i] if i < len(lines) else "", rule[i])
                        for i in range(len(rule))]
        elif isinstance(rule, dict) and rule.get("list"):   # 중첩 리스트(G4 items)
            sub = v if isinstance(v, list) else []
            sub = sub[:rule["max_n"]]
            out[key] = [_apply_shape(x, rule["shape"]) for x in sub]
        elif isinstance(rule, dict) and "max" in rule:
            out[key] = _slice(v, rule["max"])
        else:
            out[key] = v
    return out


def merge_with_cap(orig, new, tpl):
    """LLM 출력(new)의 텍스트 칸을 orig(adapted)에 덮어쓰되,
    spec에 정의된 키만 + cap 슬라이싱 + 리스트 max_n 차단. spec 없으면 orig 그대로."""
    spec = _PATH1_FIELD_SPEC.get(tpl)
    if not spec or not isinstance(new, dict):
        return orig
    out = dict(orig)
    for key, meta in spec.items():
        if key not in new:                  # LLM이 누락 → 원본 유지
            continue
        v = new[key]
        if isinstance(meta, dict) and meta.get("list"):
            lst = v if isinstance(v, list) else []
            lst = lst[:meta["max_n"]]
            out[key] = [_apply_shape(x, meta["shape"]) for x in lst]
        elif isinstance(meta, dict) and "max" in meta:
            out[key] = _slice(v, meta["max"])
    return out


def has_spec(tpl):
    return tpl in _PATH1_FIELD_SPEC
