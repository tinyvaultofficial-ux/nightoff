"""KPI 원형 조립기 (3~5개 적응, 6개 이상 거부)."""
from _tpl import load
import html as html_lib

def _esc(s):
    return html_lib.escape(str(s))

SLIDE_W = 1123
AREA_TOP = 240       # 원이 놓이는 배경 영역 상단
AREA_H = 420         # 배경 영역 높이

def _render_circles(metrics):
    n = len(metrics)
    if n < 3 or n > 5:
        raise ValueError(f"KPI 템플릿은 지표 3~5개만 받습니다 (받은 개수: {n}). "
                         f"다른 개수는 다른 템플릿을 쓰세요.")
    # 개수에 따라 원 지름 조정: 적을수록 크게
    diam = {3: 230, 4: 200, 5: 168}[n]
    # 가로 균등 배치: 양 끝 여백 + 원들 사이 균등 간격
    margin = 80
    usable = SLIDE_W - margin * 2
    gap = (usable - diam * n) / (n - 1) if n > 1 else 0
    # 원의 세로 위치: 배경 영역 안에서 중앙
    circle_top = AREA_TOP + (AREA_H - diam) // 2 + 10

    out = []
    for i, m in enumerate(metrics):
        cx = margin + i * (diam + gap)          # 원 왼쪽 x
        center_x = cx + diam / 2
        # --- 증감률 + 화살표 (원 위) ---
        out.append(f'<div class="kpi-delta" style="left:{cx:.0f}px; '
                   f'top:{circle_top-58:.0f}px; width:{diam}px;">{_esc(m.get("delta",""))}</div>')
        out.append(f'<div class="kpi-arrow" style="left:{cx:.0f}px; '
                   f'top:{circle_top-36:.0f}px; width:{diam}px;">▼</div>')
        # --- 원 ---
        out.append(f'<div class="kpi-circle" style="left:{cx:.0f}px; '
                   f'top:{circle_top}px; width:{diam}px; height:{diam}px;"></div>')
        # --- 라벨 (원 안 위쪽) ---
        out.append(f'<div class="kpi-label" style="left:{cx:.0f}px; '
                   f'top:{circle_top+diam*0.28:.0f}px; width:{diam}px;">{_esc(m.get("label",""))}</div>')
        # --- 큰 숫자 (원 안 중앙) ---
        vsize = {3: 46, 4: 40, 5: 34}[n]
        out.append(f'<div class="kpi-value" style="left:{cx:.0f}px; '
                   f'top:{circle_top+diam*0.44:.0f}px; width:{diam}px; '
                   f'font-size:{vsize}px;">{_esc(m.get("value",""))}</div>')
        # --- 부연 (원 아래) ---
        out.append(f'<div class="kpi-note" style="left:{cx:.0f}px; '
                   f'top:{circle_top+diam+14:.0f}px; width:{diam}px;">{_esc(m.get("note",""))}</div>')
    return "\n  ".join(out)

def assemble_KPI(data):
    tpl = load("template_KPI.html")
    mapping = {
        "{{eyebrow}}":   _esc(data.get("eyebrow", "")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b", "")),
        "{{chapter}}":   _esc(data.get("chapter", "[ 골격 KPI · 정량 성과 ]")),
        "{{head_sub}}":  _esc(data.get("head_sub", "")),
        "{{head_main}}": _esc(data.get("head_main", "")),
        "{{circles}}":   _render_circles(data.get("metrics", [])),
        "{{foot}}":      _esc(data.get("foot", "")),
        "{{glabel}}":    _esc(data.get("glabel", "골격 KPI — 정량 성과 원형 강조")),
        "{{pagenum}}":   _esc(data.get("pagenum", "")),
    }
    for k, v in mapping.items():
        tpl = tpl.replace(k, v)
    return tpl


if __name__ == "__main__":
    import json
    samples = json.load(open("samples_KPI.json", encoding="utf-8"))
    for i, s in enumerate(samples, 1):
        out = assemble_KPI(s)
        fname = f"out_KPI_{i}.html"
        open(fname, "w", encoding="utf-8").write(out)
        print(f"[OK] {fname}  (지표 {len(s.get('metrics',[]))}개, {s.get('head_main')})")
