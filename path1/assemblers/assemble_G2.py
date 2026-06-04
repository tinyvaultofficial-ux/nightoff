"""G2 좌우 2열 대비 조립기 (2~5행 적응)."""
from _tpl import load
import html as html_lib
def _esc(s): return html_lib.escape(str(s))

def _render_rows(left, right):
    nl, nr = len(left), len(right)
    n = max(nl, nr)
    if n < 2 or n > 5:
        raise ValueError(f"G2는 행 2~5개만 받습니다 (받은 개수: {n}).")
    area_top, area_h = 300, 420
    row_h = 76
    block = n * row_h
    start = area_top + max(0, (area_h - block)//2)
    out = [f'<div class="col-vline" style="left:561px; top:300px; height:420px;"></div>']
    for i in range(n):
        y = start + i * row_h
        if i < nl:
            out.append(f'<div class="chip" style="left:95px; top:{y}px;">{_esc(left[i].get("label",""))}</div>')
            out.append(f'<div class="row-desc" style="left:270px; top:{y+2}px;">{_esc(left[i].get("desc",""))}</div>')
        if i < nr:
            out.append(f'<div class="chip-o" style="left:613px; top:{y}px;">{_esc(right[i].get("label",""))}</div>')
            out.append(f'<div class="row-desc" style="left:788px; top:{y+2}px;">{_esc(right[i].get("desc",""))}</div>')
    return "\n  ".join(out)

def assemble_G2(data):
    tpl = load("template_G2.html")
    m = {
        "{{eyebrow}}": _esc(data.get("eyebrow","")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b","")),
        "{{chapter}}": _esc(data.get("chapter","[ 골격 G2 · 좌우 대비 ]")),
        "{{gov_main}}": _esc(data.get("gov_main","")),
        "{{gov_sub}}": _esc(data.get("gov_sub","")),
        "{{left_title}}": _esc(data.get("left_title","")),
        "{{right_title}}": _esc(data.get("right_title","")),
        "{{rows}}": _render_rows(data.get("left",[]), data.get("right",[])),
        "{{glabel}}": _esc(data.get("glabel","골격 G2 — 좌우 대비 2열")),
        "{{pagenum}}": _esc(data.get("pagenum","")),
    }
    for k,v in m.items(): tpl = tpl.replace(k,v)
    return tpl

if __name__ == "__main__":
    import json
    for i,s in enumerate(json.load(open("samples_G2.json", encoding="utf-8")),1):
        open(f"out_G2_{i}.html","w",encoding="utf-8").write(assemble_G2(s))
        print(f"[OK] out_G2_{i}.html (좌 {len(s.get('left',[]))}행 / 우 {len(s.get('right',[]))}행)")
