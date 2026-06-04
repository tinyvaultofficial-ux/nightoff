"""G4(카테고리+항목) / G5(키포인트+3채널) / G6(인용 강조) 조립기."""
from _tpl import load
import html as html_lib
def _esc(s): return html_lib.escape(str(s))

# ===== G6 인용 강조 (개수 적응 없음) =====
def assemble_G6(data):
    tpl = load("template_G6.html")
    body = data.get("body","")
    if isinstance(body, list):
        body = "<br>".join(_esc(x) for x in body)
    else:
        body = _esc(body)
    m = {
        "{{eyebrow}}": _esc(data.get("eyebrow","")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b","")),
        "{{chapter}}": _esc(data.get("chapter","[ 골격 G6 · 인용 강조 ]")),
        "{{faint}}": _esc(data.get("faint","")),
        "{{head}}": _esc(data.get("head","")),
        "{{body}}": body,
        "{{quote}}": _esc(data.get("quote","")),
        "{{glabel}}": _esc(data.get("glabel","골격 G6 — 인용 강조형")),
        "{{pagenum}}": _esc(data.get("pagenum","")),
    }
    for k,v in m.items(): tpl = tpl.replace(k,v)
    return tpl

# ===== G4 카테고리+항목 (카테고리 2~4개 적응, 각 항목 가변) =====
def assemble_G4(data):
    cats = data.get("categories", [])
    n = len(cats)
    if n < 2 or n > 4:
        raise ValueError(f"G4는 카테고리 2~4개만 받습니다 (받은 개수: {n}).")
    area_top, area_h = 250, 470
    block_h = area_h / n
    out = []
    for ci, cat in enumerate(cats):
        by = area_top + ci * block_h
        # 카테고리 박스 (블록 높이의 70%, 세로 중앙)
        box_h = min(120, block_h - 20)
        box_top = by + (block_h - box_h) / 2
        # 박스 라벨 줄바꿈 허용
        label = _esc(cat.get("label","")).replace(" ", "<br>") if len(cat.get("label",""))>4 else _esc(cat.get("label",""))
        out.append(f'<div class="cat-box" style="left:60px; top:{box_top:.0f}px; height:{box_h:.0f}px; line-height:{box_h:.0f}px;">{label}</div>')
        # 항목들 (1~3개)
        items = cat.get("items", [])[:3]
        ih = box_h / max(len(items),1)
        for ii, it in enumerate(items):
            iy = box_top + ii * (box_h/max(len(items),1))
            out.append(f'<div class="cat-arrow" style="left:250px; top:{iy+6:.0f}px;">&rsaquo;</div>')
            out.append(f'<div class="cat-item-t" style="left:270px; top:{iy:.0f}px; width:760px;">{_esc(it.get("title",""))}</div>')
            out.append(f'<div class="cat-item-d" style="left:270px; top:{iy+24:.0f}px; width:760px;">{_esc(it.get("desc",""))}</div>')
    tpl = load("template_G4.html")
    m = {
        "{{eyebrow}}": _esc(data.get("eyebrow","")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b","")),
        "{{chapter}}": _esc(data.get("chapter","[ 골격 G4 · 카테고리+항목 ]")),
        "{{gov_main}}": _esc(data.get("gov_main","")),
        "{{gov_sub}}": _esc(data.get("gov_sub","")),
        "{{blocks}}": "\n  ".join(out),
        "{{glabel}}": _esc(data.get("glabel","골격 G4 — 카테고리+항목")),
        "{{pagenum}}": _esc(data.get("pagenum","")),
    }
    for k,v in m.items(): tpl = tpl.replace(k,v)
    return tpl

# ===== G5 키포인트+3채널 (채널 고정 3, 타깃 가변) =====
def assemble_G5(data):
    channels = data.get("channels", [])[:3]
    if len(channels) != 3:
        raise ValueError(f"G5는 채널 정확히 3개를 받습니다 (받은 개수: {len(channels)}).")
    ch_x = [37, 411, 785]       # 채널 제목 x
    pill_x = [87, 461, 835]     # 타깃 칩 x
    out = []
    # 세로 구분선 2개
    out.append('<div class="ch-vline" style="left:374px; top:510px;"></div>')
    out.append('<div class="ch-vline" style="left:748px; top:510px;"></div>')
    for ci, ch in enumerate(channels):
        out.append(f'<div class="ch-ttl" style="left:{ch_x[ci]}px; top:520px;">{_esc(ch.get("name",""))}</div>')
        for ti, t in enumerate(ch.get("targets", [])[:3]):
            out.append(f'<div class="ch-pill" style="left:{pill_x[ci]}px; top:{560+ti*48}px;">{_esc(t)}</div>')
    tpl = load("template_G5.html")
    m = {
        "{{eyebrow}}": _esc(data.get("eyebrow","")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b","")),
        "{{chapter}}": _esc(data.get("chapter","[ 골격 G5 · 키포인트+3채널 ]")),
        "{{gov_main}}": _esc(data.get("gov_main","")),
        "{{gov_sub}}": _esc(data.get("gov_sub","")),
        "{{kp_center}}": _esc(data.get("kp_center","")),
        "{{kp_left}}": _esc(data.get("kp_left","")),
        "{{kp_right}}": _esc(data.get("kp_right","")),
        "{{channel_sub}}": _esc(data.get("channel_sub","홍보 매체별 타깃 맞춤 전략")),
        "{{channels}}": "\n  ".join(out),
        "{{glabel}}": _esc(data.get("glabel","골격 G5 — 키포인트+3채널")),
        "{{pagenum}}": _esc(data.get("pagenum","")),
    }
    for k,v in m.items(): tpl = tpl.replace(k,v)
    return tpl


if __name__ == "__main__":
    import json
    data = json.load(open("samples_G456.json", encoding="utf-8"))
    open("out_G6_1.html","w",encoding="utf-8").write(assemble_G6(data["G6"]))
    open("out_G4_1.html","w",encoding="utf-8").write(assemble_G4(data["G4"]))
    open("out_G5_1.html","w",encoding="utf-8").write(assemble_G5(data["G5"]))
    print("[OK] G6, G4, G5 생성")
