"""
shapes_to_html — 도형 모드 결과(shapes JSON 리스트)를 .slide div HTML로 변환.

배경: HTML 모드에서 path1 fallback이 발생하면 도형 모드 LLM이 shapes를 생성하는데,
통합 빌더가 sr.html만 보고 sr.shapes를 폐기 → 빈 페이지. (D-Check-EmptySlideRootCause)
해결(옵션 D): fallback 슬라이드의 shapes를 이 함수로 HTML로 변환해 sr.html에 채움.
→ 통합 빌더가 "html 있네" 하고 정상 처리. 통합 빌더·도형 모드 무수정.

좌표 단위: shapes는 인치(Inches). HTML은 px. 변환 = 인치 × 96.
캔버스 기본 = 11.69 × 8.27 인치(A4 가로) ≈ 1123 × 794 px.

지원 type: rect/text/line/arrow/circle(ellipse,oval)/image(placeholder)
          + Stage A(chevron/pentagon/callout/block_arrow/star) → 박스로 단순화.
일반 LLM 출력은 rect/text가 대부분이라 충실도 손실 거의 없음.
"""
import html as _html

PX = 96.0  # 인치 → px

# weight → Paperlogy variant 매핑 (pptx_generator.WEIGHT_FONT_MAP과 동일).
# 도형 모드는 _resolve_font(weight)로 이 매핑을 PPTX에 직접 박는데,
# shapes_to_html이 이걸 안 박으면 굵기 위계가 사라진다(거버닝/본문 구분 소실).
_PAPERLOGY = {
    100: "Paperlogy 1 Thin", 200: "Paperlogy 2 ExtraLight", 300: "Paperlogy 3 Light",
    400: "Paperlogy 4 Regular", 500: "Paperlogy 5 Medium", 600: "Paperlogy 6 SemiBold",
    700: "Paperlogy 7 Bold", 800: "Paperlogy 8 ExtraBold", 900: "Paperlogy 9 Black",
}

def _paperlogy_for(weight):
    try:
        w = max(100, min(900, round(int(weight) / 100) * 100))
    except Exception:
        w = 400
    return _PAPERLOGY.get(w, "Paperlogy 4 Regular")

def _esc(s):
    return _html.escape(str(s))

def _color(c, default=None):
    if not c:
        return default
    c = str(c).strip()
    return c if c.startswith("#") else ("#" + c if len(c) in (3, 6) and all(ch in "0123456789abcdefABCDEF" for ch in c) else c)

def _align_css(a):
    a = str(a or "left").lower()
    return a if a in ("left", "center", "right", "justify") else "left"

def _box_style(sd, default_fill=None):
    """rect/circle 공통 박스 스타일(좌표·배경·테두리)."""
    x = float(sd.get("x", 0)) * PX
    y = float(sd.get("y", 0)) * PX
    w = float(sd.get("w", 1)) * PX
    h = float(sd.get("h", 1)) * PX
    parts = [f"position:absolute", f"left:{x:.0f}px", f"top:{y:.0f}px",
             f"width:{w:.0f}px", f"height:{h:.0f}px"]
    fill = _color(sd.get("fill"), default_fill)
    if fill and str(fill).lower() not in ("none", "transparent"):
        parts.append(f"background:{fill}")
    stroke = _color(sd.get("stroke"))
    if stroke:
        sw = sd.get("stroke_width") or 1
        try:
            sw = float(sw)
        except Exception:
            sw = 1.0
        parts.append(f"border:{max(sw,1):.0f}px solid {stroke}")
    radius = sd.get("radius")
    if radius:
        try:
            parts.append(f"border-radius:{float(radius)*PX:.0f}px")
        except Exception:
            pass
    return parts

def _one(sd):
    """단일 도형 → HTML div 문자열(또는 빈 문자열)."""
    if not isinstance(sd, dict):
        return ""
    t = str(sd.get("type", "")).lower().strip()

    if t in ("rect", "rectangle"):
        return f'<div style="{";".join(_box_style(sd))}"></div>'

    if t == "text":
        x = float(sd.get("x", 0)) * PX
        y = float(sd.get("y", 0)) * PX
        w = float(sd.get("w", 5)) * PX
        h = float(sd.get("h", 1)) * PX
        size = float(sd.get("size", 14))      # pt
        weight = int(sd.get("weight", 400))
        color = _color(sd.get("color"), "#1A1A1A")
        align = _align_css(sd.get("align"))
        valign = str(sd.get("valign", "top")).lower()
        # valign: flex로 세로 정렬
        jc = {"top": "flex-start", "middle": "center", "bottom": "flex-end"}.get(valign, "flex-start")
        italic = "italic" if sd.get("italic") else "normal"
        font_family = _paperlogy_for(weight)
        valign_cls = {"middle": "s2h-vmid", "center": "s2h-vmid", "bottom": "s2h-vbot"}.get(valign, "")
        txt = _esc(sd.get("text", "")).replace("\n", "<br>")
        style = (f"position:absolute;left:{x:.0f}px;top:{y:.0f}px;width:{w:.0f}px;height:{h:.0f}px;"
                 f"font-family:'{font_family}';font-size:{size:.0f}pt;font-weight:{weight};color:{color};text-align:{align};"
                 f"font-style:{italic};overflow:hidden;word-break:keep-all;"
                 f"display:flex;flex-direction:column;justify-content:{jc};"
                 f"{'align-items:center;' if align=='center' else ('align-items:flex-end;' if align=='right' else '')}")
        cls_attr = f' class="{valign_cls}"' if valign_cls else ""
        return f'<div{cls_attr} style="{style}">{txt}</div>'

    if t == "line":
        x1 = float(sd.get("x1", 0)) * PX
        y1 = float(sd.get("y1", 0)) * PX
        x2 = float(sd.get("x2", 1)) * PX
        y2 = float(sd.get("y2", 0)) * PX
        color = _color(sd.get("color"), "#1A1A1A")
        w = float(sd.get("width", 1.0))
        left = min(x1, x2); top = min(y1, y2)
        length = max(abs(x2 - x1), abs(y2 - y1), 1)
        if abs(x2 - x1) >= abs(y2 - y1):  # 가로선
            return f'<div style="position:absolute;left:{left:.0f}px;top:{top:.0f}px;width:{length:.0f}px;height:{max(w,1):.0f}px;background:{color};"></div>'
        else:  # 세로선
            return f'<div style="position:absolute;left:{left:.0f}px;top:{top:.0f}px;width:{max(w,1):.0f}px;height:{length:.0f}px;background:{color};"></div>'

    if t == "arrow":
        # 화살표 → 선 + ">" 텍스트로 단순화
        x2 = float(sd.get("x2", 1)) * PX
        y2 = float(sd.get("y2", 0)) * PX
        color = _color(sd.get("color"), "#999999")
        return f'<div style="position:absolute;left:{x2-16:.0f}px;top:{y2-12:.0f}px;width:24px;height:24px;font-size:18pt;color:{color};text-align:center;">&#9656;</div>'

    if t in ("circle", "ellipse", "oval"):
        parts = _box_style(sd, default_fill="#000000")
        parts.append("border-radius:50%")
        return f'<div style="{";".join(parts)}"></div>'

    if t in ("image", "image_placeholder"):
        x = float(sd.get("x", 0)) * PX
        y = float(sd.get("y", 0)) * PX
        w = float(sd.get("w", 4)) * PX
        h = float(sd.get("h", 3)) * PX
        hint = _esc(sd.get("hint", "이미지 추가"))
        return (f'<div style="position:absolute;left:{x:.0f}px;top:{y:.0f}px;width:{w:.0f}px;height:{h:.0f}px;'
                f'background:#F4F4F4;border:1px dashed #999;display:flex;align-items:center;justify-content:center;'
                f'font-size:11pt;color:#999;">{hint}</div>')

    # Stage A 5종(chevron/pentagon/callout/block_arrow/star) → 박스 + 텍스트로 단순화
    if t in ("chevron", "process_step", "pentagon", "step", "callout", "block_arrow", "star"):
        parts = _box_style(sd, default_fill="#FFFFFF")
        box = f'<div style="{";".join(parts)}"></div>'
        txt = sd.get("text")
        if txt:
            x = float(sd.get("x", 0)) * PX
            y = float(sd.get("y", 0)) * PX
            w = float(sd.get("w", 1)) * PX
            h = float(sd.get("h", 0.5)) * PX
            tc = _color(sd.get("text_color"), "#1A1A1A")
            ts = float(sd.get("text_size", 12))
            tw = int(sd.get("text_weight", 400))
            ta = _align_css(sd.get("text_align") or "center")
            tf_family = _paperlogy_for(tw)
            label = (f'<div style="position:absolute;left:{x:.0f}px;top:{y:.0f}px;width:{w:.0f}px;height:{h:.0f}px;'
                     f"font-family:'{tf_family}';font-size:{ts:.0f}pt;font-weight:{tw};color:{tc};text-align:{ta};"
                     f'display:flex;align-items:center;justify-content:center;">{_esc(txt)}</div>')
            return box + label
        return box

    return ""  # 미지원 type은 건너뜀

def shapes_to_html_slide(shapes, canvas=None):
    """shapes 리스트 → 완전한 .slide div 1장(통합 빌더가 추출하는 형식)."""
    if not isinstance(shapes, list):
        return ""
    divs = [d for d in (_one(s) for s in shapes) if d]
    inner = "\n".join(divs)
    return f'<div class="slide">\n{inner}\n</div>'
