"""G13 풀 배경 인용형 조립기.
보여주신 캡쳐(국가유산진흥원 제안서)처럼 배경 위 텍스트 위계.
배경은 placeholder(어두운 기본), 색 강조 대신 굵기 강조(흑백 6색 원칙).
개수 적응 없음 — 텍스트 위계만.
"""
from _tpl import load
import html as html_lib
import re
def _esc(s): return html_lib.escape(str(s))

def _emphasize(text):
    """**마커는 제거하고 일반 텍스트로. (변환기가 div 내 부분 강조<span>를 못 읽으므로)
    부분 강조는 길1 변환기의 구조적 한계 — 한 div = 한 스타일."""
    out = _esc(text)
    out = re.sub(r'\*\*(.+?)\*\*', r'\1', out)   # ** 마커만 제거, 강조는 포기
    return out

def assemble_G13(data):
    tpl = load("template_G13.html")
    quote = data.get("quote","")
    if isinstance(quote, list):
        quote = "<br>".join(_esc(x) for x in quote)
    else:
        quote = _esc(quote)
    foot = data.get("foot","")
    if isinstance(foot, list):
        foot = "<br>".join(_emphasize(x) for x in foot)
    else:
        foot = _emphasize(foot)
    m = {
        "{{eyebrow}}": _esc(data.get("eyebrow","")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b","")),
        "{{chapter}}": _esc(data.get("chapter","[ 골격 G13 · 풀 배경 인용 ]")),
        "{{quote}}": quote,
        "{{source}}": _esc(data.get("source","")),
        "{{foot}}": foot,
        "{{glabel}}": _esc(data.get("glabel","골격 G13 — 풀 배경 인용형")),
        "{{pagenum}}": _esc(data.get("pagenum","")),
    }
    for k,v in m.items(): tpl = tpl.replace(k,v)
    return tpl

if __name__ == "__main__":
    import json
    for i,s in enumerate(json.load(open("samples_G13.json",encoding="utf-8")),1):
        open(f"out_G13_{i}.html","w",encoding="utf-8").write(assemble_G13(s))
        print(f"[OK] out_G13_{i}.html")
