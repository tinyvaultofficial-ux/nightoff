"""3분할 명도 조립기 (2~4칸 적응)."""
from _tpl import load
import html as html_lib

def _esc(s):
    return html_lib.escape(str(s))

SLIDE_W = 1123
SEG_TOP = 210            # 칸 시작 y
SEG_H = 500              # 칸 높이

# 칸 개수별 명도 팔레트 (흑백 6색 안에서). 칸마다 또렷이 구분.
PALETTE = {
    2: ["#1A1A1A", "#666666"],
    3: ["#1A1A1A", "#444444", "#666666"],
    4: ["#1A1A1A", "#333333", "#555555", "#777777"],
}

def _render_segments(segs):
    n = len(segs)
    if n < 2 or n > 4:
        raise ValueError(f"3분할 템플릿은 칸 2~4개만 받습니다 (받은 개수: {n}).")
    shades = PALETTE[n]
    margin = 60
    gap = 12
    usable = SLIDE_W - margin * 2 - gap * (n - 1)
    seg_w = usable / n

    out = []
    for i, s in enumerate(segs):
        x = margin + i * (seg_w + gap)
        shade = shades[i]
        cx = x                                  # 칸 왼쪽
        # --- 칸 배경 ---
        out.append(f'<div class="seg" style="left:{x:.0f}px; top:{SEG_TOP}px; '
                   f'width:{seg_w:.0f}px; height:{SEG_H}px; background:{shade};"></div>')
        # --- 사진 placeholder 안내 (칸 상단, 옅게) ---
        out.append(f'<div class="seg-ph-label" style="left:{x:.0f}px; '
                   f'top:{SEG_TOP+24}px; width:{seg_w:.0f}px;">[ 이미지 자리 ]</div>')
        # --- 큰 키워드 (칸 중앙 위) ---
        out.append(f'<div class="seg-kw" style="left:{x:.0f}px; '
                   f'top:{SEG_TOP+200}px; width:{seg_w:.0f}px;">{_esc(s.get("keyword",""))}</div>')
        # --- 영문 부제 띠 (흰 띠 + 어두운 글자, 반전 강조) ---
        band_y = SEG_TOP + 260
        out.append(f'<div class="seg-band-bg" style="left:{x:.0f}px; top:{band_y}px; '
                   f'width:{seg_w:.0f}px; height:32px;"></div>')
        out.append(f'<div class="seg-band-d" style="left:{x:.0f}px; top:{band_y+5}px; '
                   f'width:{seg_w:.0f}px;">{_esc(s.get("subtitle",""))}</div>')
        # --- 설명 (칸 하단) ---
        out.append(f'<div class="seg-desc-w" style="left:{x+16:.0f}px; top:{band_y+60}px; '
                   f'width:{seg_w-32:.0f}px;">{_esc(s.get("desc",""))}</div>')
    return "\n  ".join(out)

def assemble_SEG(data):
    tpl = load("template_SEG.html")
    mapping = {
        "{{eyebrow}}":   _esc(data.get("eyebrow", "")),
        "{{eyebrow_b}}": _esc(data.get("eyebrow_b", "")),
        "{{chapter}}":   _esc(data.get("chapter", "[ 골격 SEG · 명도 분할 ]")),
        "{{gov_main}}":  _esc(data.get("gov_main", "")),
        "{{gov_sub}}":   _esc(data.get("gov_sub", "")),
        "{{segments}}":  _render_segments(data.get("segments", [])),
        "{{glabel}}":    _esc(data.get("glabel", "골격 SEG — 명도 분할 키워드")),
        "{{pagenum}}":   _esc(data.get("pagenum", "")),
    }
    for k, v in mapping.items():
        tpl = tpl.replace(k, v)
    return tpl


if __name__ == "__main__":
    import json
    samples = json.load(open("samples_SEG.json", encoding="utf-8"))
    for i, s in enumerate(samples, 1):
        out = assemble_SEG(s)
        fname = f"out_SEG_{i}.html"
        open(fname, "w", encoding="utf-8").write(out)
        print(f"[OK] {fname}  (칸 {len(s.get('segments',[]))}개, {s.get('gov_main')})")
