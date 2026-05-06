"""
NightOff 법률 영역 페이지 빌드 — 1회 사용 영역.

마크다운 본문 영역 (_legal_terms.md / _legal_privacy.md) → HTML 변환 →
static/terms.html / static/privacy.html 영역 저장.

custom 변환 함수 영역 — 본문 영역의 마크다운 패턴만 처리:
- # / ## / ### 헤딩 영역
- **bold** 영역
- [text](url) 링크 영역
- 빈 줄 영역으로 단락 영역 분리
- "- item" / "1. item" 영역 = ul / ol
- "| ... |" 영역 = 테이블
- "---" 영역 = hr
- 인덴트 영역 (공백 3 개) = 중첩 list 영역

실행: python _build_legal_pages.py
"""

import re
import html
from pathlib import Path

REPO = Path(__file__).parent
STATIC = REPO / "static"

# ─── 마크다운 → HTML 변환 영역 ──────────────────────────────────────────────


def _inline(text: str) -> str:
    """인라인 영역 변환 — escape → bold → link 순서."""
    # HTML escape 영역 우선
    text = html.escape(text, quote=False)
    # **bold** 영역 → <strong>
    text = re.sub(r"\*\*([^*\n]+?)\*\*", r"<strong>\1</strong>", text)
    # [text](url) 링크 영역 → <a>
    def _link(m):
        label = m.group(1)
        url = m.group(2)
        # url 영역도 escape (다만 따옴표 내에 들어가므로 quote 영역만)
        url_safe = url.replace('"', "&quot;")
        return f'<a href="{url_safe}" target="_blank" rel="noopener">{label}</a>'
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", _link, text)
    return text


def _is_table_row(line: str) -> bool:
    s = line.strip()
    return s.startswith("|") and s.endswith("|") and s.count("|") >= 2


def _is_table_separator(line: str) -> bool:
    s = line.strip()
    if not _is_table_row(s):
        return False
    cells = [c.strip() for c in s.strip("|").split("|")]
    return all(re.match(r"^:?-+:?$", c) for c in cells if c)


def _flush_list(out: list, stack: list):
    """list stack 영역 닫기."""
    while stack:
        out.append(f"</{stack.pop()}>")


def md_to_html(md: str) -> str:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    list_stack: list[str] = []  # ['ul', 'ol', ...] 영역 nest 영역
    list_indents: list[int] = []  # 각 list 영역 indent 영역
    para_lines: list[str] = []
    in_table = False
    table_rows: list[list[str]] = []
    table_header_done = False

    def flush_para():
        if para_lines:
            joined = " ".join(para_lines).strip()
            if joined:
                out.append(f"<p>{_inline(joined)}</p>")
            para_lines.clear()

    def flush_table():
        nonlocal in_table, table_header_done
        if table_rows:
            out.append('<div class="legal-table-wrap"><table class="legal-table">')
            # 첫 행 영역 = header
            header = table_rows[0]
            out.append("<thead><tr>")
            for c in header:
                out.append(f"<th>{_inline(c.strip())}</th>")
            out.append("</tr></thead>")
            if len(table_rows) > 1:
                out.append("<tbody>")
                for row in table_rows[1:]:
                    out.append("<tr>")
                    for c in row:
                        out.append(f"<td>{_inline(c.strip())}</td>")
                    out.append("</tr>")
                out.append("</tbody>")
            out.append("</table></div>")
        table_rows.clear()
        in_table = False
        table_header_done = False

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # 빈 줄 영역 — 단락 영역 / list 영역 / table 영역 닫기
        if not stripped:
            flush_para()
            _flush_list(out, list_stack)
            list_indents.clear()
            if in_table:
                flush_table()
            i += 1
            continue

        # 테이블 영역
        if _is_table_row(stripped):
            flush_para()
            _flush_list(out, list_stack)
            list_indents.clear()
            # 분리 행 영역 = skip
            if _is_table_separator(stripped):
                i += 1
                continue
            cells = [c for c in stripped.strip("|").split("|")]
            table_rows.append(cells)
            in_table = True
            i += 1
            continue
        elif in_table:
            flush_table()

        # 헤딩 영역
        m = re.match(r"^(#{1,6})\s+(.+?)\s*$", stripped)
        if m:
            flush_para()
            _flush_list(out, list_stack)
            list_indents.clear()
            level = len(m.group(1))
            text = m.group(2)
            out.append(f"<h{level}>{_inline(text)}</h{level}>")
            i += 1
            continue

        # hr 영역 — "---", "***", "___" (3개 이상)
        if re.match(r"^([-*_])\1{2,}\s*$", stripped):
            flush_para()
            _flush_list(out, list_stack)
            list_indents.clear()
            out.append("<hr/>")
            i += 1
            continue

        # list 영역 — "- " / "1. " (인덴트 영역 0/3)
        # indent 영역 = 라인 시작 공백 영역 갯수
        indent = len(line) - len(line.lstrip(" "))
        # ul 영역 ("- ", "* ", "+ ")
        ul_m = re.match(r"^[-*+]\s+(.+?)\s*$", stripped)
        ol_m = re.match(r"^(\d+)\.\s+(.+?)\s*$", stripped)
        if ul_m or ol_m:
            flush_para()
            tag = "ul" if ul_m else "ol"
            text = ul_m.group(1) if ul_m else ol_m.group(2)
            # nest 영역 결정
            while list_indents and indent < list_indents[-1]:
                _flush_list(out[-1:] if False else out, [list_stack.pop()])
                list_indents.pop()
            if not list_stack or indent > (list_indents[-1] if list_indents else -1):
                # 신규 list 영역 시작
                # 다만 같은 indent 영역인데 다른 tag 영역 시작 시 = 이전 닫고 새로
                if list_stack and indent == (list_indents[-1] if list_indents else -1):
                    _flush_list(out, [list_stack.pop()])
                    list_indents.pop()
                out.append(f"<{tag}>")
                list_stack.append(tag)
                list_indents.append(indent)
            elif list_stack[-1] != tag and indent == list_indents[-1]:
                # 같은 indent 영역 다른 tag 영역
                _flush_list(out, [list_stack.pop()])
                list_indents.pop()
                out.append(f"<{tag}>")
                list_stack.append(tag)
                list_indents.append(indent)
            out.append(f"<li>{_inline(text)}</li>")
            i += 1
            continue

        # 일반 단락 영역
        # list 영역 안 영역이라면 list 영역 닫기
        if list_stack:
            _flush_list(out, list_stack)
            list_indents.clear()
        para_lines.append(stripped)
        i += 1

    flush_para()
    _flush_list(out, list_stack)
    if in_table:
        flush_table()
    return "\n".join(out)


# ─── HTML 템플릿 영역 (login.html 패턴 정합) ────────────────────────────────

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} · NightOff</title>
  <link rel="icon" type="image/svg+xml" href="/static/favicon.svg" />
  <link rel="preload" as="font" href="/static/fonts/Paperlogy-9Black.ttf" type="font/ttf" crossorigin />
  <link rel="preload" as="font" href="/static/fonts/Paperlogy-5Medium.ttf" type="font/ttf" crossorigin />
  <link rel="preload" as="font" href="/static/fonts/Paperlogy-4Regular.ttf" type="font/ttf" crossorigin />
  <link rel="stylesheet" href="/static/style.css" />
  <style>
    body {{ background: #FAFAFA; font-family: 'Paperlogy', sans-serif; color: #1A1A1A; }}
    .legal-shell {{ min-height: 100vh; display: flex; flex-direction: column; }}
    .legal-header {{
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 24px;
      background: #fff; border-bottom: 1px solid #EEE;
    }}
    .legal-brand {{
      font-weight: 900; font-size: 22px; color: #1A1A1A;
      letter-spacing: -0.5px; text-decoration: none;
    }}
    .legal-back {{
      font-size: 13.5px; font-weight: 500; color: #666;
      text-decoration: none; padding: 8px 14px; border-radius: 6px;
      transition: background .15s ease, color .15s ease;
    }}
    .legal-back:hover {{ background: #F0F0F0; color: #1A1A1A; }}
    .legal-main {{
      flex: 1;
      max-width: 800px; width: 100%; margin: 0 auto;
      padding: 48px 32px 60px;
    }}
    .legal-main h1 {{
      font-size: 28px; font-weight: 900; margin: 0 0 24px;
      letter-spacing: -0.5px; color: #1A1A1A;
    }}
    .legal-main h2 {{
      font-size: 19px; font-weight: 700; margin: 36px 0 14px;
      color: #1A1A1A; letter-spacing: -0.3px;
    }}
    .legal-main h3 {{
      font-size: 15.5px; font-weight: 600; margin: 22px 0 10px;
      color: #1A1A1A;
    }}
    .legal-main p {{
      font-size: 14.5px; line-height: 1.75;
      color: #333; margin: 0 0 14px; word-break: keep-all;
    }}
    .legal-main strong {{ font-weight: 600; color: #1A1A1A; }}
    .legal-main ul, .legal-main ol {{
      font-size: 14.5px; line-height: 1.85;
      color: #333; padding-left: 22px; margin: 0 0 16px;
    }}
    .legal-main ul li, .legal-main ol li {{ margin-bottom: 4px; word-break: keep-all; }}
    .legal-main ul ul, .legal-main ol ul, .legal-main ul ol {{
      margin: 6px 0 6px;
    }}
    .legal-main a {{
      color: #6B46E5; text-decoration: underline; text-underline-offset: 2px;
    }}
    .legal-main a:hover {{ color: #5A38D1; }}
    .legal-main hr {{
      border: 0; border-top: 1px solid #DDD;
      margin: 32px 0;
    }}
    .legal-table-wrap {{ overflow-x: auto; margin: 14px 0 18px; }}
    .legal-table {{
      width: 100%; border-collapse: collapse;
      font-size: 13px; line-height: 1.55;
    }}
    .legal-table th, .legal-table td {{
      border: 1px solid #DDD; padding: 9px 12px;
      text-align: left; vertical-align: top; word-break: keep-all;
    }}
    .legal-table th {{
      background: #F5F5F5; font-weight: 600; color: #1A1A1A;
    }}
    .legal-footer {{
      background: #fff; border-top: 1px solid #EEE;
      padding: 24px 32px; font-size: 12.5px; color: #666;
      text-align: center; line-height: 1.7;
    }}
    .legal-footer .lf-row {{ margin-bottom: 4px; }}
    .legal-footer .lf-row span + span {{ margin-left: 6px; padding-left: 6px; border-left: 1px solid #DDD; }}
    .legal-footer a {{ color: #6B46E5; text-decoration: none; }}
    .legal-footer a:hover {{ text-decoration: underline; }}
    @media (max-width: 600px) {{
      .legal-header {{ padding: 14px 16px; }}
      .legal-brand {{ font-size: 18px; }}
      .legal-main {{ padding: 32px 18px 48px; }}
      .legal-main h1 {{ font-size: 22px; }}
      .legal-main h2 {{ font-size: 17px; }}
      .legal-main h3 {{ font-size: 14.5px; }}
      .legal-footer {{ padding: 18px 16px; font-size: 11.5px; }}
      .legal-footer .lf-row span + span {{ margin-left: 4px; padding-left: 4px; }}
    }}
  </style>
</head>
<body>
  <div class="legal-shell">
    <header class="legal-header">
      <a class="legal-brand" href="/">NightOff</a>
      <a class="legal-back" href="/">← 홈으로</a>
    </header>
    <main class="legal-main">
{body}
    </main>
    <footer class="legal-footer">
      <div class="lf-row">
        <span>NightOff by 크리워스</span>
        <span>대표 이창원</span>
        <span>사업자번호 806-10-03267</span>
      </div>
      <div class="lf-row">
        <span>서울특별시 관악구 조원로33길 30, 400호</span>
        <span>문의 <a href="mailto:lcw0411@hanmail.net">lcw0411@hanmail.net</a></span>
      </div>
      <div class="lf-row">
        <a href="/terms">이용약관</a>
        <a href="/privacy">개인정보처리방침</a>
      </div>
    </footer>
  </div>
</body>
</html>
"""


def build(md_path: Path, html_path: Path, title: str):
    md = md_path.read_text(encoding="utf-8")
    body_html = md_to_html(md)
    out = HTML_TEMPLATE.format(title=title, body=body_html)
    html_path.write_text(out, encoding="utf-8")
    print(f"OK · {md_path.name} -> {html_path.name} ({len(out):,} bytes)")


if __name__ == "__main__":
    build(REPO / "_legal_terms.md",   STATIC / "terms.html",   "이용약관")
    build(REPO / "_legal_privacy.md", STATIC / "privacy.html", "개인정보처리방침")
    print("done")
