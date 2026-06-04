"""G14 비대칭 2분할 조립기 (좌: 텍스트, 우: 이미지 placeholder).
좌측 본문은 문단 단위로 쌓음. 각 문단 = {head(강조 한 줄, 선택), text}.
부분 강조 불가(변환기 한계)라, 강조는 '문단의 head를 굵은 별도 줄'로 표현.
"""
from _tpl import load
import html as html_lib
def _esc(s): return html_lib.escape(str(s))
def _ml(v):
    if isinstance(v,list): return "<br>".join(_esc(x) for x in v)
    return _esc(v)

def _render_body(paras):
    n = len(paras)
    if n < 1 or n > 4:
        raise ValueError(f"G14 본문 문단 1~4개만 (받은:{n})")
    y = 300
    out = []
    for p in paras:
        head = p.get("head","")
        text = p.get("text","")
        if head:
            # 강조 제목 한 줄 (굵게) — div 통째 한 스타일이라 변환기 안전
            out.append(f'<div style="position:absolute; left:60px; top:{y}px; width:520px; '
                       f'font-family:\'Paperlogy 7 Bold\'; font-weight:bold; font-size:17px; '
                       f'color:#1A1A1A; line-height:1.6;">{_ml(head)}</div>')
            y += 34
        if text:
            # 본문 (줄 수에 따라 높이 차지)
            lines = text if isinstance(text,list) else [text]
            out.append(f'<div class="lt-body" style="top:{y}px;">{_ml(text)}</div>')
            y += 30 * (len(lines) if isinstance(text,list) else 1) + 24
        else:
            y += 12
    return "\n".join(out)

def assemble_G14(data):
    tpl = load("template_G14.html")
    m = {
        "{{eyebrow}}": _esc(data.get("eyebrow","")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b","")),
        "{{chapter}}": _esc(data.get("chapter","[ 골격 G14 · 비대칭 2분할 ]")),
        "{{tag}}": _esc(data.get("tag","")),
        "{{head}}": _ml(data.get("head","")),
        "{{body_blocks}}": _render_body(data.get("paragraphs",[])),
        "{{glabel}}": _esc(data.get("glabel","골격 G14 — 비대칭 2분할 (좌 텍스트·우 이미지)")),
        "{{pagenum}}": _esc(data.get("pagenum","")),
    }
    for k,v in m.items(): tpl = tpl.replace(k,v)
    return tpl

if __name__ == "__main__":
    import json
    for i,s in enumerate(json.load(open("samples_G14.json",encoding="utf-8")),1):
        open(f"out_G14_{i}.html","w",encoding="utf-8").write(assemble_G14(s))
        print(f"[OK] out_G14_{i}.html (문단 {len(s.get('paragraphs',[]))}개)")
