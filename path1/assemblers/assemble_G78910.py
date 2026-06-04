"""G7(4분할명도) / G8(컨셉선언) / G9(N원형축) / G10(카드그리드) 조립기."""
from _tpl import load
import html as html_lib
def _esc(s): return html_lib.escape(str(s))
def _multiline(v):
    if isinstance(v, list): return "<br>".join(_esc(x) for x in v)
    return _esc(v)

SLIDE_W = 1123

# ===== G7 4분할 명도 (밴드 2~4개 적응) =====
SHADES = {2:["#1A1A1A","#666666"],3:["#1A1A1A","#444444","#777777"],4:["#1A1A1A","#444444","#666666","#999999"]}
def assemble_G7(data):
    segs = data.get("segments",[])
    n=len(segs)
    if n<2 or n>4: raise ValueError(f"G7은 밴드 2~4개만 (받은:{n})")
    shades=SHADES[n]; w=SLIDE_W/n; out=[]
    for i,s in enumerate(segs):
        x=i*w; band_top=130; band_h=120
        out.append(f'<div style="position:absolute; left:{x:.0f}px; top:{band_top}px; width:{w:.0f}px; height:{band_h}px; background:{shades[i]};"></div>')
        out.append(f'<div class="band-en" style="left:{x:.0f}px; top:{band_top+48}px; width:{w:.0f}px; color:#FFFFFF;">{_esc(s.get("label",""))}</div>')
        if i>0:
            out.append(f'<div class="seg-vline" style="left:{x:.0f}px; top:320px; height:340px;"></div>')
        out.append(f'<div class="seg-title" style="left:{x:.0f}px; top:420px; width:{w:.0f}px;">{_esc(s.get("title",""))}</div>')
        out.append(f'<div class="seg-desc" style="left:{x+20:.0f}px; top:460px; width:{w-40:.0f}px;">{_multiline(s.get("desc",""))}</div>')
    tpl=load("template_G7.html")
    for k,v in {"{{eyebrow}}":_esc(data.get("eyebrow","")),"{{eyebrow_b}}":_esc(data.get("eyebrow_b","")),
                "{{chapter}}":_esc(data.get("chapter","[ 골격 G7 · 4분할 명도 ]")),"{{bands}}":"\n".join(out),
                "{{glabel}}":_esc(data.get("glabel","골격 G7 — 4분할 명도 위계")),"{{pagenum}}":_esc(data.get("pagenum",""))}.items():
        tpl=tpl.replace(k,v)
    return tpl

# ===== G8 중앙 컨셉 선언 (고정) =====
def assemble_G8(data):
    tpl=load("template_G8.html")
    for k,v in {"{{eyebrow}}":_esc(data.get("eyebrow","")),"{{eyebrow_b}}":_esc(data.get("eyebrow_b","")),
                "{{chapter}}":_esc(data.get("chapter","[ 골격 G8 · 컨셉 선언 ]")),"{{tag}}":_esc(data.get("tag","컨셉")),
                "{{concept}}":_esc(data.get("concept","")),"{{slogan}}":_esc(data.get("slogan","")),
                "{{line}}":_esc(data.get("line","")),"{{body}}":_multiline(data.get("body","")),
                "{{glabel}}":_esc(data.get("glabel","골격 G8 — 중앙 컨셉 선언")),"{{pagenum}}":_esc(data.get("pagenum",""))}.items():
        tpl=tpl.replace(k,v)
    return tpl

# ===== G9 N원형 축 (원 2~4개, 사이 화살표) =====
def assemble_G9(data):
    axes=data.get("axes",[])
    n=len(axes)
    if n<2 or n>4: raise ValueError(f"G9는 축 2~4개만 (받은:{n})")
    diam={2:250,3:230,4:190}[n]; arrow_w=55
    total=diam*n+arrow_w*(n-1); start=(SLIDE_W-total)/2; top=300
    out=[]; x=start
    for i,a in enumerate(axes):
        out.append(f'<div class="nc-axis" style="left:{x:.0f}px; top:{top+45:.0f}px; width:{diam}px;">축 {i+1:02d}</div>')
        out.append(f'<div class="nc-circle" style="left:{x:.0f}px; top:{top}px; width:{diam}px; height:{diam}px;"></div>')
        out.append(f'<div class="nc-key" style="left:{x:.0f}px; top:{top+diam*0.45:.0f}px; width:{diam}px;">{_esc(a.get("keyword",""))}</div>')
        out.append(f'<div class="nc-desc" style="left:{x-20:.0f}px; top:{top+diam+20:.0f}px; width:{diam+40}px;">{_multiline(a.get("desc",""))}</div>')
        if i<n-1:
            ax=x+diam
            out.append(f'<div class="nc-arrow" style="left:{ax:.0f}px; top:{top+diam/2-18:.0f}px; width:{arrow_w}px;">&rsaquo;</div>')
        x+=diam+arrow_w
    tpl=load("template_G9.html")
    for k,v in {"{{eyebrow}}":_esc(data.get("eyebrow","")),"{{eyebrow_b}}":_esc(data.get("eyebrow_b","")),
                "{{chapter}}":_esc(data.get("chapter","[ 골격 G9 · N원형 축 ]")),"{{gov_main}}":_esc(data.get("gov_main","")),
                "{{gov_sub}}":_esc(data.get("gov_sub","")),"{{circles}}":"\n".join(out),
                "{{glabel}}":_esc(data.get("glabel","골격 G9 — N원형 축")),"{{pagenum}}":_esc(data.get("pagenum",""))}.items():
        tpl=tpl.replace(k,v)
    return tpl

# ===== G10 카드 그리드 (2~6개, 3열) =====
def assemble_G10(data):
    cards=data.get("cards",[])
    n=len(cards)
    if n<2 or n>6: raise ValueError(f"G10은 카드 2~6개만 (받은:{n})")
    cols=min(n,3); cw=300; gap=(SLIDE_W-120-cw*cols)/max(cols-1,1) if cols>1 else 0
    ch=150; rgap=30; out=[]
    for i,c in enumerate(cards):
        col=i%cols; row=i//cols
        x=60+col*(cw+gap); y=250+row*(ch+rgap)
        out.append(f'<div class="cg-card" style="left:{x:.0f}px; top:{y}px; width:{cw}px; height:{ch}px;"></div>')
        out.append(f'<div class="cg-no" style="left:{x+20:.0f}px; top:{y+12}px; width:60px;">{i+1:02d}</div>')
        out.append(f'<div class="cg-title" style="left:{x+20:.0f}px; top:{y+62}px; width:{cw-40}px;">{_esc(c.get("title",""))}</div>')
        out.append(f'<div class="cg-desc" style="left:{x+20:.0f}px; top:{y+96}px; width:{cw-40}px;">{_multiline(c.get("desc",""))}</div>')
    tpl=load("template_G10.html")
    for k,v in {"{{eyebrow}}":_esc(data.get("eyebrow","")),"{{eyebrow_b}}":_esc(data.get("eyebrow_b","")),
                "{{chapter}}":_esc(data.get("chapter","[ 골격 G10 · 카드 그리드 ]")),"{{gov_main}}":_esc(data.get("gov_main","")),
                "{{gov_sub}}":_esc(data.get("gov_sub","")),"{{cards}}":"\n".join(out),
                "{{glabel}}":_esc(data.get("glabel","골격 G10 — 카드 그리드")),"{{pagenum}}":_esc(data.get("pagenum",""))}.items():
        tpl=tpl.replace(k,v)
    return tpl

if __name__=="__main__":
    import json
    d=json.load(open("samples_G78910.json",encoding="utf-8"))
    open("out_G7_1.html","w",encoding="utf-8").write(assemble_G7(d["G7"]))
    open("out_G8_1.html","w",encoding="utf-8").write(assemble_G8(d["G8"]))
    open("out_G9_1.html","w",encoding="utf-8").write(assemble_G9(d["G9"]))
    open("out_G10_1.html","w",encoding="utf-8").write(assemble_G10(d["G10"]))
    print("[OK] G7,G8,G9,G10 생성")
