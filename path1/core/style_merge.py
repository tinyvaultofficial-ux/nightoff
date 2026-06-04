"""
style_merge v2 — 규칙({ }) 단위 병합. 스코프 안 씀(부작용 없음).
v1(줄 단위) 버그: CSS 규칙을 줄로 쪼개 섞음 → 도형 누락.
스코프 버전 버그: .scope * 가 우선순위 바꿔 KPI 숫자/G7 밴드 깨짐.
v2: 규칙 단위 파싱 → 같은 selector 1개만(마지막 우선) → 스코프 없음.
전제: selector 충돌 없어야 함(.seg-desc 흰색은 seg-desc-w로 분리 완료).
"""
import re

def _parse_rules(css):
    rules = []
    for m in re.finditer(r'([^{}]+)\{([^}]*)\}', css):
        sel = m.group(1).strip()
        body = re.sub(r'\s+', ' ', m.group(2).strip())
        if sel:
            rules.append((sel, body))
    return rules

def merge_deck(slides_html):
    merged = {}; order = []; body_parts = []; conflicts = []
    for sk, html in slides_html:
        css_m = re.search(r'<style>(.*?)</style>', html, re.S)
        css = css_m.group(1) if css_m else ""
        for sel, body in _parse_rules(css):
            if sel in merged and merged[sel] != body:
                conflicts.append((sel, sk))
            if sel not in merged:
                order.append(sel)
            merged[sel] = body
        sm = re.search(r'<div class="slide">.*?</div>\s*(?=</body>)', html, re.S)
        if sm:
            body_parts.append(sm.group(0))
    css_out = "\n".join(f"{sel} {{ {merged[sel]} }}" for sel in order)
    deck = ('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">'
            '<style>\n' + css_out + '\n</style></head><body>\n'
            + "\n".join(body_parts) + '\n</body></html>')
    return deck, conflicts

if __name__ == "__main__":
    import sys, json, os
    sys.path.insert(0, "core" if os.path.isdir("core") else ".")
    import adapter, dispatch
    items = json.load(open("outline_items_15.json", encoding="utf-8"))
    slides = []
    for it in items:
        a = adapter.adapt_item(it); html = dispatch.build(a)
        if html: slides.append((a["template"], html))
    deck, conflicts = merge_deck(slides)
    open("full_deck_v2.html", "w", encoding="utf-8").write(deck)
    print(f"병합 슬라이드: {len(slides)}장")
    print(f"selector 충돌: {len(conflicts)}개")
    for sel, sk in conflicts: print(f"  WARN {sel} (in {sk})")
