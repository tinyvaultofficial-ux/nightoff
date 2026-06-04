"""G1 인터뷰 카드 그리드 조립기 (3~6개 적응)."""
from _tpl import load
import html as html_lib
def _esc(s): return html_lib.escape(str(s))

def _render_cards(cards):
    n = len(cards)
    if n < 3 or n > 6:
        raise ValueError(f"G1은 인터뷰 3~6개만 받습니다 (받은 개수: {n}).")
    cols = 3 if n > 3 else n
    col_x = {0: 120, 1: 444, 2: 768}          # 원본 3열 x좌표
    row_y = [300, 470]                          # 상/하단 y
    # 아바타/이름 위치(원본 패턴 유지: 상단줄은 좌측 위, 하단줄은 우측 위 — 단순화해 좌측 통일)
    out = []
    for i, c in enumerate(cards):
        row = i // cols
        col = i % cols
        x = col_x[col]
        y = row_y[row] if row < 2 else row_y[1]
        out.append(f'<div class="iv-bubble" style="left:{x}px; top:{y}px;"></div>')
        out.append(f'<div class="iv-bubble-t" style="left:{x+10}px; top:{y+10}px;">{_esc(c.get("comment",""))}</div>')
        out.append(f'<div class="iv-avatar" style="left:{x-42}px; top:{y+16}px;"></div>')
        out.append(f'<div class="iv-name" style="left:{x-54}px; top:{y+104}px;">{_esc(c.get("name",""))}</div>')
    return "\n  ".join(out)

def assemble_G1(data):
    tpl = load("template_G1.html")
    m = {
        "{{eyebrow}}": _esc(data.get("eyebrow","")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b","")),
        "{{chapter}}": _esc(data.get("chapter","[ 골격 G1 · 인터뷰 카드 ]")),
        "{{gov_main}}": _esc(data.get("gov_main","")),
        "{{gov_sub}}": _esc(data.get("gov_sub","")),
        "{{band_title}}": _esc(data.get("band_title","")),
        "{{cards}}": _render_cards(data.get("cards",[])),
        "{{glabel}}": _esc(data.get("glabel","골격 G1 — 인터뷰 카드 그리드")),
        "{{pagenum}}": _esc(data.get("pagenum","")),
    }
    for k,v in m.items(): tpl = tpl.replace(k,v)
    return tpl

if __name__ == "__main__":
    import json
    for i,s in enumerate(json.load(open("samples_G1.json", encoding="utf-8")),1):
        open(f"out_G1_{i}.html","w",encoding="utf-8").write(assemble_G1(s))
        print(f"[OK] out_G1_{i}.html (카드 {len(s.get('cards',[]))}개)")
