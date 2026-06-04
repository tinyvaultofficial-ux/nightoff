"""G12 조직도(트리) 조립기 (팀 2~4개 적응)."""
from _tpl import load
import html as html_lib
def _esc(s): return html_lib.escape(str(s))
def _ml(v):
    if isinstance(v,list): return "<br>".join(_esc(x) for x in v)
    return _esc(v)

SLIDE_W = 1123
TEAM_W = 280
TOP_H = 60
TEAM_H = 56
TASK_H = 90

def _render_tree(data):
    teams = data.get("teams", [])
    n = len(teams)
    if n < 2 or n > 4:
        raise ValueError(f"G12는 팀 2~4개만 받습니다 (받은 개수: {n}).")
    margin = 60
    usable = SLIDE_W - margin*2
    # 팀 x좌표 균등 배치
    if n == 1:
        xs = [(SLIDE_W-TEAM_W)/2]
    else:
        gap = (usable - TEAM_W*n)/(n-1)
        xs = [margin + i*(TEAM_W+gap) for i in range(n)]
    centers = [x + TEAM_W/2 for x in xs]
    top_x = (SLIDE_W - TEAM_W)/2
    top_center = SLIDE_W/2
    top_y = 250
    team_y = 380
    task_y = team_y + TEAM_H + 14

    out = []
    # 세로선/가로선을 진짜 박스(width/height>=1 + 배경)로 그린다.
    # 변환기는 border-left(width:0) 세로선을 못 잡으므로, 얇은 회색 박스로 대체.
    def vbar(x, y, h):
        return (f'<div style="position:absolute; left:{x:.0f}px; top:{y:.0f}px; '
                f'width:1px; height:{h:.0f}px; background:#999999;"></div>')
    def hbar(x, y, w):
        return (f'<div style="position:absolute; left:{x:.0f}px; top:{y:.0f}px; '
                f'width:{w:.0f}px; height:1px; background:#999999;"></div>')

    # 총괄
    out.append(f'<div class="org-top" style="left:{top_x:.0f}px; top:{top_y}px; width:{TEAM_W}px; height:{TOP_H}px; line-height:{TOP_H}px;">{_esc(data.get("top",""))}</div>')
    # 총괄 → 가로 분배선까지 세로선
    hline_y = 350
    out.append(vbar(top_center, top_y+TOP_H, hline_y-(top_y+TOP_H)))
    # 가로 분배선 (양 끝 팀 중심 잇기)
    hx1, hx2 = centers[0], centers[-1]
    out.append(hbar(hx1, hline_y, hx2-hx1))
    # 각 팀: 분배선 → 팀박스 세로선 + 팀 + 업무
    for i, t in enumerate(teams):
        cx = centers[i]
        out.append(vbar(cx, hline_y, team_y-hline_y))
        out.append(f'<div class="org-team" style="left:{xs[i]:.0f}px; top:{team_y}px; width:{TEAM_W}px; height:{TEAM_H}px; line-height:{TEAM_H}px;">{_esc(t.get("name",""))}</div>')
        out.append(f'<div class="org-task" style="left:{xs[i]:.0f}px; top:{task_y}px; width:{TEAM_W}px; height:{TASK_H}px;">{_ml(t.get("task",""))}</div>')
    # 하단 보조 밴드
    if data.get("band"):
        out.append(f'<div class="org-band" style="left:60px; top:600px;">{_esc(data.get("band"))}</div>')
    return "\n".join(out)

def assemble_G12(data):
    tpl = load("template_G12.html")
    m = {
        "{{eyebrow}}": _esc(data.get("eyebrow","")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b","")),
        "{{chapter}}": _esc(data.get("chapter","[ 골격 G12 · 조직도 ]")),
        "{{gov_main}}": _esc(data.get("gov_main","")),
        "{{gov_sub}}": _esc(data.get("gov_sub","")),
        "{{tree}}": _render_tree(data),
        "{{glabel}}": _esc(data.get("glabel","골격 G12 — 조직도 트리")),
        "{{pagenum}}": _esc(data.get("pagenum","")),
    }
    for k,v in m.items(): tpl = tpl.replace(k,v)
    return tpl

if __name__ == "__main__":
    import json
    for i,s in enumerate(json.load(open("samples_G12.json",encoding="utf-8")),1):
        open(f"out_G12_{i}.html","w",encoding="utf-8").write(assemble_G12(s))
        print(f"[OK] out_G12_{i}.html (팀 {len(s.get('teams',[]))}개)")
