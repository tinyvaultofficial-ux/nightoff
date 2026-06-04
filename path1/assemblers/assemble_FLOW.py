"""흐름 단계 조립기 (3~4단계, 원 사이 화살표 연결)."""
from _tpl import load
import html as html_lib

def _esc(s):
    return html_lib.escape(str(s))

SLIDE_W = 1123

def _render_steps(steps):
    n = len(steps)
    if n < 3 or n > 4:
        raise ValueError(f"흐름 템플릿은 단계 3~4개만 받습니다 (받은 개수: {n}).")
    diam = {3: 200, 4: 168}[n]
    arrow_w = 60                              # 화살표가 차지할 가로 폭
    margin = 70
    # 원 n개 + 화살표 (n-1)개가 가로로 늘어섬
    total = diam * n + arrow_w * (n - 1)
    start_x = (SLIDE_W - total) / 2           # 전체를 가로 중앙
    circle_top = 300

    out = []
    x = start_x
    for i, s in enumerate(steps):
        # --- 단계 번호 (원 위) ---
        out.append(f'<div class="flow-no" style="left:{x:.0f}px; '
                   f'top:{circle_top-30:.0f}px; width:{diam}px;">STEP {i+1}</div>')
        # --- 원 ---
        out.append(f'<div class="flow-circle" style="left:{x:.0f}px; '
                   f'top:{circle_top}px; width:{diam}px; height:{diam}px;"></div>')
        # --- 키워드 (원 안 중앙) ---
        out.append(f'<div class="flow-kw" style="left:{x:.0f}px; '
                   f'top:{circle_top+diam*0.4:.0f}px; width:{diam}px;">{_esc(s.get("keyword",""))}</div>')
        # --- 설명 (원 아래) ---
        out.append(f'<div class="flow-desc" style="left:{x-10:.0f}px; '
                   f'top:{circle_top+diam+20:.0f}px; width:{diam+20}px;">{_esc(s.get("desc",""))}</div>')
        # --- 화살표 (마지막 원 뒤엔 안 붙임) ---
        if i < n - 1:
            ax = x + diam
            out.append(f'<div class="flow-arrow" style="left:{ax:.0f}px; '
                       f'top:{circle_top+diam/2-22:.0f}px; width:{arrow_w}px;">&#9654;</div>')
        x += diam + arrow_w
    return "\n  ".join(out)

def assemble_FLOW(data):
    tpl = load("template_FLOW.html")
    mapping = {
        "{{eyebrow}}":   _esc(data.get("eyebrow", "")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b", "")),
        "{{chapter}}":   _esc(data.get("chapter", "[ 골격 FLOW · 단계 흐름 ]")),
        "{{head}}":      _esc(data.get("head", "")),
        "{{sub}}":       _esc(data.get("sub", "")),
        "{{steps}}":     _render_steps(data.get("steps", [])),
        "{{foot}}":      _esc(data.get("foot", "")),
        "{{glabel}}":    _esc(data.get("glabel", "골격 FLOW — 단계 흐름 연결")),
        "{{pagenum}}":   _esc(data.get("pagenum", "")),
    }
    for k, v in mapping.items():
        tpl = tpl.replace(k, v)
    return tpl


if __name__ == "__main__":
    import json
    samples = json.load(open("samples_FLOW.json", encoding="utf-8"))
    for i, s in enumerate(samples, 1):
        out = assemble_FLOW(s)
        fname = f"out_FLOW_{i}.html"
        open(fname, "w", encoding="utf-8").write(out)
        print(f"[OK] {fname}  (단계 {len(s.get('steps',[]))}개, {s.get('head')})")
