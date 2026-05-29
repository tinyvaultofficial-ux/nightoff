"""
NightOff PPTX Generator — 마스터 템플릿 기반 제안서 생성

핵심 철학:
  1. 마스터 PPTX (사람이 만든 잘 만든 제안서) 를 통째로 파일 복사
  2. 그 사본의 텍스트만 새 내용으로 치환 (배경/도형/표/차트/이미지/시각화 100% 보존)
  3. 사용 안 하는 슬라이드는 삭제
  4. 결과 = 사람이 만든 것처럼 보이는 PPTX

핵심 함수:
  - generate_from_master(master_path, content_per_slide, output_path, keep_indices)
  - extract_text_zones(slide) — AUTO 모드 텍스트 영역 식별
  - replace_text_in_slide(slide, content) — AUTO 모드 텍스트 치환

content_per_slide 형식:
  {
    0: {"거버닝": "...", "소제목": "...", "본문": ["...", "..."]},
    3: {"거버닝": "...", "본문": [...]},
    ...
  }
"""
from __future__ import annotations
import shutil
import logging
from copy import deepcopy
from pathlib import Path
from typing import Optional

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor

log = logging.getLogger("pptx_gen")


# ─── Paperlogy weight 9 단계 매핑 ──────────────────────────────────────────────
# 도형 JSON 의 weight (100~900) 값을 받아 PowerPoint 의 typeface 명으로 매핑.
# 폰트 이름은 ttf internal Family Name (nameID 1) — Windows PowerPoint /
# LibreOffice 가 표준으로 매칭하는 형식. PostScript name (Paperlogy-1Thin)
# 이 아닌 Family Name (Paperlogy 1 Thin, 스페이스 포함) 으로 정확히 박아야
# 폰트 매칭 실패 시 기본 폰트 (맑은 고딕 등) 로 폴백되지 않는다.
WEIGHT_FONT_MAP: dict[int, str] = {
    100: "Paperlogy 1 Thin",
    200: "Paperlogy 2 ExtraLight",
    300: "Paperlogy 3 Light",
    400: "Paperlogy 4 Regular",
    500: "Paperlogy 5 Medium",
    600: "Paperlogy 6 SemiBold",
    700: "Paperlogy 7 Bold",
    800: "Paperlogy 8 ExtraBold",
    900: "Paperlogy 9 Black",
}
DEFAULT_FONT_FAMILY = WEIGHT_FONT_MAP[400]  # "Paperlogy 4 Regular"


def _normalize_weight(weight) -> int:
    """임의 weight 값 → 가장 가까운 100 단위 (100~900) 로 정규화.

    안전성 ↑:
    - float 입력 안전 (예: 400.5 → 400)
    - 영역 외 값 clamp (예: 1000 → 900, 50 → 100)
    - None / 잘못된 형식 → 400 (Regular fallback)
    """
    if weight is None or weight == "":
        return 400
    try:
        w = int(float(weight))
    except (TypeError, ValueError):
        return 400
    # 100~900 범위 clamp 영역 round
    w = max(100, min(900, w))
    return round(w / 100) * 100


def _resolve_font(font_family, weight) -> str:
    """font_family 명시 시 우선, 미지정 시 weight 기반 자동 매핑.

    fallback 강화 (가설 A fix):
    - font_family 명시 + "Paperlogy" 시작 → WEIGHT_FONT_MAP 표준 형식 강제 정규화
      (AI 가 prompt 예시 따라 "Paperlogy 9Black" (스페이스 없음) 명시해도
       표준 형식 "Paperlogy 9 Black" (스페이스 있음) 으로 정상 매핑 — ttf
       Family Name 매칭 실패로 시스템 fallback 되던 사고 차단)
    - font_family 명시 + 다른 폰트 (사용자 의도) → 그대로 사용 (호환성 유지)
    - 미지정 → weight 기반 자동 매핑
    - weight 매핑 X → DEFAULT (Paperlogy 4 Regular)
    """
    if font_family:
        f = str(font_family).strip()
        # Paperlogy 변형 명시 시 → WEIGHT_FONT_MAP 표준 형식 강제
        if f.lower().startswith("paperlogy"):
            return WEIGHT_FONT_MAP.get(_normalize_weight(weight), DEFAULT_FONT_FAMILY)
        return f  # 다른 폰트 명시 (사용자 의도) → 그대로
    norm_weight = _normalize_weight(weight)
    return WEIGHT_FONT_MAP.get(norm_weight, DEFAULT_FONT_FAMILY)


# ─── AUTO 모드 텍스트 영역 식별 ───────────────────────────────

def _run_size_pt(run) -> float:
    """run 의 폰트 크기 pt 단위 (없으면 기본 12)."""
    try:
        if run.font.size is not None:
            return float(run.font.size.pt)
    except Exception:
        pass
    return 12.0


def extract_text_zones(slide) -> dict:
    """슬라이드의 모든 text run 을 폰트 크기로 분류.

    반환:
      {
        "all_runs":    [{"run", "size", "text", "shape_name"}, ...],
        "largest_size": float,
        "second_size": float,
        "candidates":  {"거버닝": [...], "소제목": [...], "본문": [...]}
      }
    """
    runs = []
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        for para in shape.text_frame.paragraphs:
            for run in para.runs:
                txt = (run.text or "").strip()
                if not txt:
                    continue
                runs.append({
                    "run": run, "size": _run_size_pt(run),
                    "text": txt, "shape_name": shape.name,
                })
    if not runs:
        return {"all_runs": [], "largest_size": 0, "second_size": 0,
                "candidates": {"거버닝": [], "소제목": [], "본문": []}}

    # 폰트 크기 내림차순 정렬
    sorted_by_size = sorted(runs, key=lambda x: -x["size"])
    largest = sorted_by_size[0]["size"]

    # 두 번째 크기 (가장 큰 폰트와 다른 첫 번째)
    second = next((r["size"] for r in sorted_by_size if r["size"] < largest), largest)

    # 카테고리별 후보
    candidates = {"거버닝": [], "소제목": [], "본문": []}
    for r in runs:
        if r["size"] == largest and len(r["text"]) >= 3:
            candidates["거버닝"].append(r)
        elif r["size"] == second and len(r["text"]) >= 3:
            candidates["소제목"].append(r)
        else:
            candidates["본문"].append(r)

    return {
        "all_runs": runs,
        "largest_size": largest,
        "second_size": second,
        "candidates": candidates,
    }


# ─── 텍스트 안전 치환 (폰트 스타일 유지) ─────────────────────

def _replace_run_text(run, new_text: str):
    """run 의 텍스트만 교체. 폰트 스타일(size/bold/color) 유지."""
    try:
        run.text = new_text
    except Exception as e:
        log.warning("run.text 치환 실패: %s", e)


def _replace_text_frame_simple(text_frame, new_text: str):
    """text_frame 의 모든 텍스트를 단일 텍스트로 교체.
    첫 paragraph 의 첫 run 폰트만 살리고 나머지 다 제거.
    """
    if not text_frame.paragraphs:
        return
    first_p = text_frame.paragraphs[0]
    if not first_p.runs:
        # run 없으면 paragraph 의 text 만 교체
        first_p.text = new_text
        return
    # 추가 paragraph 제거
    p_elements = text_frame._txBody.findall(
        ".//{http://schemas.openxmlformats.org/drawingml/2006/main}p")
    for p in p_elements[1:]:
        try:
            p.getparent().remove(p)
        except Exception:
            pass
    # 첫 paragraph 의 추가 run 제거
    runs_to_remove = list(first_p.runs)[1:]
    for r in runs_to_remove:
        try:
            r._r.getparent().remove(r._r)
        except Exception:
            pass
    # 첫 run 의 텍스트만 변경
    first_p.runs[0].text = new_text


def _clear_text_frame(text_frame):
    """text_frame 의 모든 paragraph + run 의 텍스트를 비움 (폰트 스타일은 유지).
    첫 paragraph 의 첫 run 만 남기고 나머지 모두 제거. 첫 run 의 text 도 ""."""
    if not text_frame or not text_frame.paragraphs:
        return
    NS_A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    # 추가 paragraph 모두 제거
    p_elements = text_frame._txBody.findall(f".//{NS_A}p")
    for p in p_elements[1:]:
        try:
            p.getparent().remove(p)
        except Exception:
            pass
    # 첫 paragraph 의 추가 run 제거
    first_p = text_frame.paragraphs[0]
    if first_p.runs:
        runs_to_remove = list(first_p.runs)[1:]
        for r in runs_to_remove:
            try:
                r._r.getparent().remove(r._r)
            except Exception:
                pass
        # 첫 run 의 텍스트 비움
        try:
            first_p.runs[0].text = ""
        except Exception:
            pass
    else:
        # run 없는 paragraph — 그냥 text 비움
        try:
            first_p.text = ""
        except Exception:
            pass


def _frame_max_font_size(text_frame) -> float:
    """text_frame 안의 최대 폰트 사이즈 (pt). 비어있으면 0."""
    max_sz = 0.0
    for p in text_frame.paragraphs:
        for r in p.runs:
            if (r.text or "").strip():
                max_sz = max(max_sz, _run_size_pt(r))
    return max_sz


def fill_slide_clearing_master(slide, content: dict) -> dict:
    """[옵션 A 핵심] 마스터의 모든 텍스트를 비우고 AI 콘텐츠로 채움.

    매핑 전략 (폰트 사이즈 내림차순):
      - 가장 큰 사이즈 frame    → 거버닝 (governing)
      - 두 번째 큰 frame        → 소제목 (subtitle)
      - 그 외 frame들           → 본문 (body) 항목 순서대로 분배
      - AI 콘텐츠 부족 시       → 빈 문자열 (디자인만 남김. 짬뽕 방지)

    기존 replace_text_in_slide 와의 차이:
      - 기존: 큰 글자만 치환, 본문 박스는 마스터 원본 그대로 (= 짬뽕)
      - 신규: 모든 frame 비우고 AI 콘텐츠로 정확히 매핑 (= 깨끗)

    content 형식:
      {"거버닝": "...", "소제목": "...", "본문": ["...", "..."], "summary": "..."}
    """
    # 1. 슬라이드의 모든 text_frame 수집 + 폰트 사이즈
    frames = []
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        tf = shape.text_frame
        # 비어있는 frame 도 일단 포함 (디자인 자리 표시일 수 있음)
        frames.append({
            "shape": shape,
            "tf": tf,
            "size": _frame_max_font_size(tf),
            "had_text": bool(tf.text and tf.text.strip()),
        })

    if not frames:
        return {"replaced": 0, "cleared": 0, "errors": ["no text frames"]}

    # 2. 사이즈 내림차순 정렬 — 큰 글자가 거버닝/소제목 후보
    frames.sort(key=lambda f: -f["size"])

    # 3. 모든 frame 의 텍스트 비우기 (마스터 원본 잔재 0)
    cleared = 0
    for f in frames:
        if f["had_text"]:
            try:
                _clear_text_frame(f["tf"])
                cleared += 1
            except Exception as e:
                log.warning("frame clear 실패 (shape=%s): %s", f["shape"].name, e)

    # 4. AI 콘텐츠 정리
    governing = (content.get("거버닝") or "").strip() if content else ""
    subtitle = (content.get("소제목") or "").strip() if content else ""
    body_raw = content.get("본문") if content else None
    if isinstance(body_raw, str):
        body = [body_raw.strip()] if body_raw.strip() else []
    elif isinstance(body_raw, list):
        body = [str(b).strip() for b in body_raw if str(b).strip()]
    else:
        body = []
    summary = (content.get("summary") or "").strip() if content else ""

    # 5. 매핑 — 사이즈 내림차순 frame 들에 콘텐츠 채움
    # had_text 가 True 인 frame 만 채움 (디자인 전용 빈 frame 은 그대로)
    fillable = [f for f in frames if f["had_text"]]

    replaced = 0
    fill_idx = 0

    # 5-a. 거버닝 → 가장 큰 frame
    if fill_idx < len(fillable) and governing:
        try:
            _replace_text_frame_simple(fillable[fill_idx]["tf"], governing)
            replaced += 1
        except Exception as e:
            log.warning("거버닝 채움 실패: %s", e)
        fill_idx += 1

    # 5-b. 소제목 → 다음 frame
    if fill_idx < len(fillable) and subtitle:
        try:
            _replace_text_frame_simple(fillable[fill_idx]["tf"], subtitle)
            replaced += 1
        except Exception as e:
            log.warning("소제목 채움 실패: %s", e)
        fill_idx += 1

    # 5-c. 본문 → 남은 frame 들에 순서대로
    body_idx = 0
    while fill_idx < len(fillable) and body_idx < len(body):
        try:
            _replace_text_frame_simple(fillable[fill_idx]["tf"], body[body_idx])
            replaced += 1
        except Exception as e:
            log.warning("본문 [%d] 채움 실패: %s", body_idx, e)
        body_idx += 1
        fill_idx += 1

    # 5-d. summary 있으면 다음 frame 에
    if fill_idx < len(fillable) and summary:
        try:
            _replace_text_frame_simple(fillable[fill_idx]["tf"], "💡 " + summary)
            replaced += 1
        except Exception as e:
            log.warning("summary 채움 실패: %s", e)
        fill_idx += 1

    # 5-e. 본문 항목이 frame 보다 많이 남았으면 — 마지막 frame 에 합쳐서
    if body_idx < len(body) and fill_idx > 0:
        leftover = body[body_idx:]
        # 마지막으로 채운 frame 의 텍스트 뒤에 줄바꿈으로 추가
        try:
            last_tf = fillable[fill_idx - 1]["tf"]
            current = last_tf.text or ""
            combined = current + "\n" + "\n".join(leftover)
            _replace_text_frame_simple(last_tf, combined)
        except Exception as e:
            log.warning("leftover 합침 실패: %s", e)

    # fill_idx 부터 끝까지의 frame 은 비어있는 채로 둠 (마스터 디자인만 남김)
    return {
        "replaced": replaced,
        "cleared": cleared,
        "frames_total": len(frames),
        "frames_fillable": len(fillable),
        "errors": [],
    }


################################################################################
# Placeholder 모드 — 마커 기반 정확 매핑 (NightOff 정석 모드)
#
# 마스터 PPTX 안에 디자이너가 박은 마커:
#   {{거버닝}}              — 단순. max 미명시
#   {{거버닝|max:25}}       — 글자수 명시
#   {{본문_1|max:50}}       — 인덱스 + max
#   {{이미지_1|hint:콜센터}} — 이미지 자리 (코드는 비움 + hint 메타로 보관)
#   {{회사명}} {{발주처}}    — 동적 필드 (런타임에 채움)
#
# 동작 원칙:
#   - 마커 있는 자리만 치환 (마커 없는 박스는 절대 안 건드림)
#   - 마스터 디자인 100% 보존
#   - 같은 마커가 여러 곳이면 모두 같은 값으로 치환
################################################################################

import re

PLACEHOLDER_RE = re.compile(
    r"\{\{\s*(?P<key>[\w가-힣]+(?:_\d+)?)"
    r"(?:\s*\|\s*max\s*:\s*(?P<max>\d+))?"
    r"(?:\s*\|\s*hint\s*:\s*(?P<hint>[^}|]+))?"
    r"\s*\}\}"
)


def parse_placeholder(match: "re.Match") -> dict:
    """{{...}} 매치를 dict 로 변환."""
    return {
        "raw": match.group(0),
        "key": match.group("key"),
        "max": int(match.group("max")) if match.group("max") else None,
        "hint": match.group("hint").strip() if match.group("hint") else None,
    }


def find_placeholders_in_text(text: str) -> list[dict]:
    """문자열 안 모든 {{...}} 마커 추출."""
    return [parse_placeholder(m) for m in PLACEHOLDER_RE.finditer(text or "")]


def has_any_placeholder(prs) -> bool:
    """프레젠테이션 전체에 {{...}} 마커가 하나라도 있는지."""
    for slide in prs.slides:
        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            if PLACEHOLDER_RE.search(shape.text_frame.text or ""):
                return True
    return False


def collect_placeholders_in_slide(slide) -> list[dict]:
    """슬라이드의 모든 마커 수집 — 분석/검증/디버깅용.

    반환: [{"shape_name", "key", "max", "hint", "raw"}, ...]
    """
    out = []
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        text = shape.text_frame.text or ""
        for m in PLACEHOLDER_RE.finditer(text):
            ph = parse_placeholder(m)
            ph["shape_name"] = shape.name
            out.append(ph)
    return out


def _truncate(text: str, max_len: int | None) -> str:
    """글자수 제한 — 넘으면 '…' 으로 자름."""
    if max_len is None or len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _is_image_marker(key: str) -> bool:
    """이미지 placeholder 키인지 ('이미지', '이미지_1', 'image_2' 등)."""
    if not key:
        return False
    k = key.lower()
    return key.startswith("이미지") or k.startswith("image")


def _resolve_placeholder_value(ph: dict, content: dict) -> str:
    """placeholder 매치를 실제 채울 텍스트로 변환.

    우선순위:
      1. content[key] 가 있으면 그걸로 (AI 가 동적 결정)
      2. 이미지 마커면 hint 기반 안내 ("🖼 콜센터_여성")
         → 사용자가 PowerPoint 에서 박스 더블클릭 → 이미지 삽입
      3. 그 외엔 빈 문자열 (마스터 디자인만 남김)
    """
    key = ph["key"]
    if key in content and content[key] is not None:
        return _truncate(str(content[key]), ph["max"])
    if _is_image_marker(key):
        hint = ph.get("hint") or "이미지 추가"
        return f"🖼 {hint}"
    return ""


def _replace_placeholders_in_text_frame(text_frame, content: dict) -> dict:
    """text_frame 안의 모든 {{...}} 마커를 content 값으로 치환.

    동작:
      - 각 paragraph 의 각 run 의 텍스트에서 {{...}} 패턴 찾음
      - run.text 에 마커가 *완전히* 들어있으면 그 안에서 치환 (가장 흔한 케이스)
      - run 경계로 마커가 잘려있으면 paragraph.text 통째로 처리 (폴백)

    content:
      {"거버닝": "...", "본문_1": "...", "회사명": "...", ...}

    반환:
      {"replaced": int, "missing_keys": [...], "preserved_keys": [...]}
    """
    result = {"replaced": 0, "missing_keys": [], "preserved_keys": []}

    if not text_frame.paragraphs:
        return result

    # 각 paragraph 별로 처리
    for para in text_frame.paragraphs:
        # 1단계: run 단위 치환 시도 (run 안에 마커가 완전히 있는 경우)
        for run in para.runs:
            new_text = run.text or ""
            matches = list(PLACEHOLDER_RE.finditer(new_text))
            if not matches:
                continue
            # 뒤에서부터 치환 (offset 안 꼬이게)
            for m in reversed(matches):
                ph = parse_placeholder(m)
                key = ph["key"]
                val = _resolve_placeholder_value(ph, content)
                new_text = new_text[: m.start()] + val + new_text[m.end():]
                # 통계
                if key in content and content[key] is not None:
                    result["replaced"] += 1
                elif _is_image_marker(key):
                    result["replaced"] += 1  # 이미지도 치환된 것으로 카운트
                elif key not in result["missing_keys"]:
                    result["missing_keys"].append(key)
            try:
                run.text = new_text
            except Exception as e:
                log.warning("run.text 치환 실패: %s", e)

        # 2단계: paragraph 전체 텍스트에 여전히 마커 남아있으면 (run 경계 잘림)
        # paragraph.text 통째로 대체. 단 첫 run 의 스타일만 살아남음 — 트레이드오프
        full = para.text or ""
        if PLACEHOLDER_RE.search(full):
            new_full = full
            for m in reversed(list(PLACEHOLDER_RE.finditer(full))):
                ph = parse_placeholder(m)
                key = ph["key"]
                val = _resolve_placeholder_value(ph, content)
                new_full = new_full[: m.start()] + val + new_full[m.end():]
                if key in content and content[key] is not None:
                    result["replaced"] += 1
                elif _is_image_marker(key):
                    result["replaced"] += 1
                elif key not in result["missing_keys"]:
                    result["missing_keys"].append(key)
            # paragraph 의 run 들을 비우고 첫 run 에 새 텍스트
            if para.runs:
                first_run = para.runs[0]
                # 추가 run 제거
                for r in list(para.runs)[1:]:
                    try:
                        r._r.getparent().remove(r._r)
                    except Exception:
                        pass
                try:
                    first_run.text = new_full
                except Exception:
                    pass
            else:
                try:
                    para.text = new_full
                except Exception:
                    pass

    return result


def auto_inject_markers(
    master_path: "str | Path",
    output_path: "str | Path",
    *,
    dry_run: bool = False,
) -> dict:
    """[옵션 A] 빈 텍스트 박스를 가진 마스터 PPTX 에 자동으로 마커 텍스트 박기.

    크리스가 만든 페이퍼템플릿_1 같은 *빈 박스 + 디자인* 형태의 마스터를
    *자동으로* placeholder 모드 마스터로 변환.

    분류 알고리즘 (휴리스틱):
      1. 푸터 분리: y >= sh*0.85 + h <= 0.6  → 무시 (페이지 번호)
      2. 큰 가로 박스 (w >= sw*0.6 + 슬라이드 상단 50%) → 거버닝 후보
      3. 면적 기준 정렬:
         - 가장 큰 박스 → 거버닝 (이미 거버닝 후보 있으면 그걸로)
         - 두 번째 큰 박스 → 소제목 (높이가 작고 폭이 큰 경우만)
      4. 나머지 박스 → 본문_N (위→아래, 좌→우 정렬)
      5. 모든 박스 면적이 비슷하면 (예: cards layout) → 거버닝 X, 모두 본문_N

    Args:
      master_path: 입력 PPTX (빈 박스 형태)
      output_path: 출력 PPTX (마커 박힌 버전)
      dry_run: True 면 분석만 하고 저장 안 함

    Returns:
      {"slides": [{"idx", "markers_added": [{"shape_name", "marker", "x", "y", "w", "h"}]}],
       "total_markers": int}
    """
    from pptx import Presentation as _P
    p = Path(master_path)
    out = Path(output_path)
    prs = _P(str(p))
    sw_in = prs.slide_width / 914400
    sh_in = prs.slide_height / 914400

    report = {"slides": [], "total_markers": 0}

    for slide_idx, slide in enumerate(prs.slides):
        # 빈 텍스트 박스 수집 + z-order 인덱스 (앞쪽 = 뒤. 배경 식별용)
        empty_boxes = []
        all_shapes_list = list(slide.shapes)
        for z_idx, shape in enumerate(all_shapes_list):
            if not shape.has_text_frame:
                continue
            tf = shape.text_frame
            if (tf.text or "").strip():
                continue  # 이미 텍스트 있으면 안 건드림
            x = (shape.left or 0) / 914400
            y = (shape.top or 0) / 914400
            w = (shape.width or 0) / 914400
            h = (shape.height or 0) / 914400
            empty_boxes.append({
                "shape": shape, "tf": tf, "name": shape.name, "z": z_idx,
                "x": x, "y": y, "w": w, "h": h,
                "area": w * h,
                "marker": None,
            })

        if not empty_boxes:
            report["slides"].append({"idx": slide_idx, "markers_added": []})
            continue

        # 1. 디자인 요소 식별 (마커 박지 않음)
        # 단, 빈 텍스트 박스가 적은 슬라이드 (≤3개) 는 디자인 분류 안 함
        # — 표지처럼 큰 박스 1~2개가 *진짜 텍스트 자리* 인 경우 보호
        protect_all = (len(empty_boxes) <= 3)
        for b in empty_boxes:
            if protect_all:
                # 적은 박스 슬라이드 — 분류 X, 모두 텍스트 자리로
                # 단 너무 얇은 strip 은 그래도 디자인 (헤어라인 등)
                if b["h"] < 0.15:
                    b["marker"] = "_design"
                continue
            # 일반 슬라이드 (박스 4개 이상)
            # 1-a. 배경 박스 — 슬라이드 전체 크기 + z-order 0~2 (맨 뒤)
            is_full_size = (b["w"] >= sw_in * 0.93 and b["h"] >= sh_in * 0.93)
            is_back_layer = (b["z"] <= 2)
            if is_full_size and is_back_layer:
                b["marker"] = "_background"
                continue
            # 1-b. 너무 좁고 긴 strip (예: 좌측 세로 띠 1.4x8.3)
            is_vertical_strip = (b["w"] < 1.5 and b["h"] >= sh_in * 0.7)
            is_horizontal_strip = (b["h"] < 0.25 and b["w"] >= sw_in * 0.5)
            if is_vertical_strip or is_horizontal_strip:
                b["marker"] = "_design"
                continue
            # 1-c. 너무 작음 (디자인 dot 또는 빈 셀)
            if b["area"] < 0.25:
                b["marker"] = "_tiny"
                continue

        # 2. 푸터 분리 (하단 + 작은 높이) — h 임계값 0.6→1.0 완화
        footer_y = sh_in * 0.85
        for b in empty_boxes:
            if b["marker"] is None and b["y"] >= footer_y and b["h"] <= 1.0:
                b["marker"] = "_footer"

        candidates = [b for b in empty_boxes if b["marker"] is None]
        if not candidates:
            report["slides"].append({"idx": slide_idx, "markers_added": []})
            continue

        # 1-d. 거대 박스 (배경 디자인) 추가 식별:
        # 가장 큰 박스의 면적 > 다른 박스 면적 합 → 배경 가능성 (거버닝 후보 X)
        # protect_all (박스 ≤3개 슬라이드) 은 면제
        if not protect_all and len(candidates) >= 4:
            cands_sorted_tmp = sorted(candidates, key=lambda b: -b["area"])
            biggest = cands_sorted_tmp[0]
            other_total = sum(b["area"] for b in cands_sorted_tmp[1:])
            if biggest["area"] > other_total * 1.2:
                biggest["marker"] = "_design"
                candidates = [b for b in candidates if b is not biggest]

        # 2. 거버닝 후보 — 상단 50% + 가로 60% 이상 + 면적 큼
        cands_sorted = sorted(candidates, key=lambda b: -b["area"])
        top_half_y = sh_in * 0.5

        # 면적 분포 분석 — 모든 박스가 비슷한 크기면 cards layout (거버닝 X)
        max_area = cands_sorted[0]["area"]
        similar_count = sum(1 for b in candidates if b["area"] >= max_area * 0.7)
        is_cards_layout = (similar_count >= 4 and len(candidates) >= 4)

        governing_box = None
        subtitle_box = None
        if not is_cards_layout:
            # 거버닝: 가장 큰 박스 + 상단 + 가로 큰 것
            for b in cands_sorted:
                if b["w"] >= sw_in * 0.4 and b["y"] <= top_half_y + 1.0:
                    governing_box = b
                    b["marker"] = "거버닝"
                    break
            # 그 외 가장 큰 박스 (2번째) — 거버닝 면적의 70% 이하 + 상단 가까움 → 소제목
            if governing_box:
                for b in cands_sorted:
                    if b is governing_box or b["marker"]:
                        continue
                    # 소제목 = 거버닝보다 작고 + 폭은 적당히 + 위쪽
                    if (b["area"] < governing_box["area"] * 0.7
                        and b["w"] >= sw_in * 0.3
                        and b["y"] <= top_half_y + 1.5):
                        subtitle_box = b
                        b["marker"] = "소제목"
                        break

        # 3. 본문 (위→아래, 좌→우)
        body_candidates = [b for b in candidates if b["marker"] is None]
        body_candidates.sort(key=lambda b: (round(b["y"], 1), round(b["x"], 1)))
        for i, b in enumerate(body_candidates, 1):
            b["marker"] = f"본문_{i}"

        # 4. 마커 박기 (dry_run 이면 skip)
        # underscore prefix (_background, _design, _tiny, _footer) 는 모두 skip
        slide_report = {"idx": slide_idx, "markers_added": []}
        for b in empty_boxes:
            if not b["marker"] or b["marker"].startswith("_"):
                continue
            marker_text = "{{" + b["marker"] + "}}"
            if not dry_run:
                tf = b["tf"]
                if tf.paragraphs:
                    para = tf.paragraphs[0]
                    if para.runs:
                        # 첫 run 의 텍스트만 변경
                        para.runs[0].text = marker_text
                    else:
                        # run 없는 빈 paragraph — 새 run 만들기
                        try:
                            para.text = marker_text
                        except Exception:
                            try:
                                tf.text = marker_text
                            except Exception:
                                pass
                else:
                    try:
                        tf.text = marker_text
                    except Exception:
                        pass
            slide_report["markers_added"].append({
                "shape_name": b["name"],
                "marker": b["marker"],
                "x": round(b["x"], 1), "y": round(b["y"], 1),
                "w": round(b["w"], 1), "h": round(b["h"], 1),
            })
            report["total_markers"] += 1
        report["slides"].append(slide_report)

    if not dry_run:
        out.parent.mkdir(parents=True, exist_ok=True)
        prs.save(str(out))

    return report


def extract_master_slot_guide(master_path: "str | Path") -> list[dict]:
    """마스터 PPTX 를 스캔해서 슬라이드별 마커 목록 추출.

    AI 호출 시 시스템 프롬프트에 주입 → AI 가 마스터 슬롯 개수에 맞춰 콘텐츠 짬.
    (콘텐츠 N개 vs 슬롯 M개 mismatch 방지)

    반환:
      [
        {
          "idx": 0,
          "markers": [
            {"key": "거버닝", "max": 25, "hint": None},
            {"key": "회사명", "max": None, "hint": None},
          ],
          "body_count": 0,        # 본문_N 개수 (UI 표시용)
          "image_count": 0,       # 이미지_N 개수
          "section_hint": "표지",  # 섹션 추정 (마스터 노트 또는 첫 텍스트 기반)
        },
        ...
      ]
    """
    from pptx import Presentation as _P
    p = Path(master_path)
    if not p.exists():
        return []
    try:
        prs = _P(str(p))
    except Exception as e:
        log.warning("마스터 슬롯 추출 실패: %s", e)
        return []

    out: list[dict] = []
    for idx, slide in enumerate(prs.slides):
        markers: list[dict] = []
        seen_keys: set[str] = set()
        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            text = shape.text_frame.text or ""
            for m in PLACEHOLDER_RE.finditer(text):
                ph = parse_placeholder(m)
                # 같은 key 중복은 1번만 (같은 마커가 여러 자리에 있어도)
                if ph["key"] in seen_keys:
                    continue
                seen_keys.add(ph["key"])
                markers.append({
                    "key": ph["key"],
                    "max": ph["max"],
                    "hint": ph["hint"],
                })

        # 본문/이미지 개수 카운트
        body_count = sum(1 for m in markers if m["key"].startswith("본문_") or m["key"] == "본문")
        image_count = sum(1 for m in markers if m["key"].startswith("이미지_") or m["key"] == "이미지")

        # 섹션 추정 — 슬라이드 노트 (presenter notes) 우선, 없으면 ""
        section_hint = ""
        try:
            if slide.has_notes_slide:
                notes = slide.notes_slide.notes_text_frame.text or ""
                # "section: ..." 형태 또는 첫 줄
                m_sec = re.search(r"section\s*:\s*(\S[^\n]+)", notes)
                if m_sec:
                    section_hint = m_sec.group(1).strip()[:30]
                elif notes.strip():
                    section_hint = notes.strip().split("\n")[0][:30]
        except Exception:
            pass

        out.append({
            "idx": idx,
            "markers": markers,
            "body_count": body_count,
            "image_count": image_count,
            "section_hint": section_hint,
        })
    return out


def format_slot_guide_for_prompt(slots: list[dict]) -> str:
    """추출된 슬롯 가이드를 AI 프롬프트에 주입할 텍스트로 변환.

    예시 출력:
      [마스터 슬라이드 슬롯 가이드]
      슬라이드 0 (표지): 거버닝, 소제목, 회사명
      슬라이드 1 (사업이해): 거버닝, 본문_1, 본문_2, 본문_3 (본문 3개)
      슬라이드 2: 거버닝, 본문_1, 본문_2, 본문_3, 본문_4, 이미지_1 (본문 4개 + 이미지)
      ...
    """
    if not slots:
        return ""
    lines = ["[마스터 슬라이드 슬롯 가이드 — 자동 추출]"]
    for s in slots:
        if not s["markers"]:
            continue  # 마커 없는 슬라이드는 가이드 안 만듦
        marker_keys = [m["key"] for m in s["markers"]]
        # 글자수 제한도 표시 (있으면)
        marker_strs = []
        for m in s["markers"]:
            if m["max"]:
                marker_strs.append(f"{m['key']}(max:{m['max']})")
            else:
                marker_strs.append(m["key"])
        section_part = f" ({s['section_hint']})" if s["section_hint"] else ""
        suffix_parts = []
        if s["body_count"]:
            suffix_parts.append(f"본문 {s['body_count']}개")
        if s["image_count"]:
            suffix_parts.append(f"이미지 {s['image_count']}개")
        suffix = f" — {' + '.join(suffix_parts)}" if suffix_parts else ""
        lines.append(f"  슬라이드 {s['idx']}{section_part}: {', '.join(marker_strs)}{suffix}")

    lines.append("")
    lines.append("⚠ 규칙: 위 슬롯 개수 정확히 맞춰서 콘텐츠 작성. 슬롯 부족하면 다른 슬라이드로 분산. 본문 개수 어기지 말 것.")
    return "\n".join(lines)


def fill_slide_with_placeholders(slide, content: dict) -> dict:
    """[Placeholder 모드 — 슬라이드 단위] 마커 있는 자리만 치환.

    마스터 디자인 100% 보존. 마커 없는 박스는 손대지 않음.

    content:
      {"거버닝": "...", "본문_1": "...", "회사명": "...", ...}

    반환:
      {"replaced": int, "missing_keys": [...], "frames_processed": int}
    """
    total = {"replaced": 0, "missing_keys": [], "frames_processed": 0}
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        # 마커가 하나라도 있는 frame 만 처리 (성능 + 안전)
        if not PLACEHOLDER_RE.search(shape.text_frame.text or ""):
            continue
        r = _replace_placeholders_in_text_frame(shape.text_frame, content)
        total["replaced"] += r["replaced"]
        total["frames_processed"] += 1
        for k in r["missing_keys"]:
            if k not in total["missing_keys"]:
                total["missing_keys"].append(k)
    return total


def replace_text_in_slide(slide, content: dict) -> dict:
    """[LEGACY] 기존 AUTO 모드 텍스트 치환 — 큰 글자만 치환.

    ⚠ 이 함수는 마스터의 작은 텍스트(본문, 서브헤더)를 그대로 둠 → 짬뽕 발생.
    신규 코드는 fill_slide_clearing_master() 사용.

    content 형식:
      {"거버닝": "...", "소제목": "...", "본문": ["...", "..."]}

    반환:
      {"replaced": int, "skipped": int, "errors": [...]}
    """
    zones = extract_text_zones(slide)
    if not zones["all_runs"]:
        return {"replaced": 0, "skipped": 0, "errors": ["no text runs"]}

    result = {"replaced": 0, "skipped": 0, "errors": []}
    candidates = zones["candidates"]

    # 거버닝 — 가장 큰 폰트 첫 번째 run 의 텍스트 박스 통째 교체
    if "거버닝" in content and candidates["거버닝"]:
        first = candidates["거버닝"][0]
        try:
            tf = first["run"]._r.getparent().getparent()  # txBody 의 parent (sp)
            # 해당 shape 찾기
            for shape in slide.shapes:
                if not shape.has_text_frame:
                    continue
                for p in shape.text_frame.paragraphs:
                    for r in p.runs:
                        if r is first["run"]:
                            _replace_text_frame_simple(shape.text_frame, content["거버닝"])
                            result["replaced"] += 1
                            break
        except Exception as e:
            result["errors"].append(f"거버닝: {e}")

    # 소제목 — 두 번째 크기 첫 번째 run
    if "소제목" in content and candidates["소제목"]:
        first = candidates["소제목"][0]
        try:
            for shape in slide.shapes:
                if not shape.has_text_frame:
                    continue
                for p in shape.text_frame.paragraphs:
                    for r in p.runs:
                        if r is first["run"]:
                            _replace_text_frame_simple(shape.text_frame, content["소제목"])
                            result["replaced"] += 1
                            break
        except Exception as e:
            result["errors"].append(f"소제목: {e}")

    # 본문 — 본문 후보 run 들의 텍스트박스에 순서대로 교체
    if "본문" in content and candidates["본문"]:
        body_texts = content["본문"] if isinstance(content["본문"], list) else [content["본문"]]
        # 본문 텍스트박스 모음 (shape 단위, 중복 제거)
        seen_shape_ids = set()
        body_shapes = []
        for r in candidates["본문"]:
            for shape in slide.shapes:
                if not shape.has_text_frame:
                    continue
                # run 이 이 shape 에 속하는지 체크
                if r["run"]._r in [run._r for p in shape.text_frame.paragraphs for run in p.runs]:
                    sid = id(shape)
                    if sid not in seen_shape_ids:
                        seen_shape_ids.add(sid)
                        body_shapes.append(shape)
                    break
        for shape, txt in zip(body_shapes, body_texts):
            try:
                _replace_text_frame_simple(shape.text_frame, txt)
                result["replaced"] += 1
            except Exception as e:
                result["errors"].append(f"본문: {e}")

    return result


# ─── 슬라이드 삭제 (인덱스 기반) ─────────────────────────────

def remove_slides_keep(prs: Presentation, keep_indices: list[int]):
    """keep_indices 에 없는 슬라이드 모두 삭제."""
    keep_set = set(keep_indices)
    xml_slides = prs.slides._sldIdLst
    slide_id_elements = list(xml_slides)
    # 뒤에서부터 삭제 (인덱스 안 꼬이게)
    for idx in range(len(slide_id_elements) - 1, -1, -1):
        if idx not in keep_set:
            try:
                xml_slides.remove(slide_id_elements[idx])
            except Exception as e:
                log.warning("슬라이드 %d 삭제 실패: %s", idx, e)


# ─── 미디어 garbage collection (PPTX 사이즈 축소) ────────────

import zipfile
import shutil as _shutil
import xml.etree.ElementTree as ET


def garbage_collect_media(pptx_path: str | Path) -> dict:
    """PPTX 안의 사용 안 하는 미디어 (이미지/동영상) 제거.

    PPTX = ZIP. 슬라이드 삭제 후엔 ppt/media/ 안 일부 파일이 더 이상
    어떤 슬라이드에도 참조 안 됨. 이걸 ZIP 에서 빼서 사이즈 축소.

    참조 추적:
      - ppt/slides/_rels/slideN.xml.rels 안의 Target → ppt/media/imageX.*
      - 살아있는 슬라이드들이 참조하는 미디어만 keep
    """
    pptx_path = Path(pptx_path)
    if not pptx_path.exists():
        raise FileNotFoundError(pptx_path)

    tmp_path = pptx_path.with_suffix(".tmp.pptx")
    used_media: set[str] = set()
    live_slide_xml: set[str] = set()      # ppt/slides/slideN.xml — 살아있는 것만
    live_slide_rel: set[str] = set()      # ppt/slides/_rels/slideN.xml.rels — 살아있는 것만

    # 0. presentation.xml 의 sldIdLst → 살아있는 r:id 들 → presentation.xml.rels 의 Target 매핑
    NS_R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    NS_P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
    NS_PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"

    with zipfile.ZipFile(pptx_path, "r") as zin:
        all_names = set(zin.namelist())
        live_rids: set[str] = set()
        # 1단계 — presentation.xml 의 sldIdLst 안 sldId 의 r:id
        try:
            with zin.open("ppt/presentation.xml") as f:
                pres_root = ET.fromstring(f.read())
            for sld_id in pres_root.iter(f"{NS_P}sldId"):
                rid = sld_id.attrib.get(f"{NS_R}id")
                if rid:
                    live_rids.add(rid)
        except Exception as e:
            log.warning("presentation.xml 파싱 실패: %s", e)

        # 2단계 — presentation.xml.rels 에서 r:id → Target 매핑 (살아있는 r:id 만)
        try:
            with zin.open("ppt/_rels/presentation.xml.rels") as f:
                rels_root = ET.fromstring(f.read())
            for el in rels_root.iter(f"{NS_PKG}Relationship"):
                rel_id = el.attrib.get("Id", "")
                target = el.attrib.get("Target", "")
                if rel_id in live_rids and target.startswith("slides/slide"):
                    full = "ppt/" + target  # "ppt/slides/slide1.xml"
                    live_slide_xml.add(full)
                    rel_name = "ppt/slides/_rels/" + target.split("/")[-1] + ".rels"
                    live_slide_rel.add(rel_name)
        except Exception as e:
            log.warning("presentation.xml.rels 파싱 실패: %s", e)

        # 폴백 — 살아있는 슬라이드 못 찾으면 모든 슬라이드 keep
        if not live_slide_xml:
            log.warning("살아있는 슬라이드 추적 실패 — 전체 keep")
            live_slide_xml = {n for n in all_names
                              if n.startswith("ppt/slides/slide") and n.endswith(".xml")}
            live_slide_rel = {n for n in all_names
                              if n.startswith("ppt/slides/_rels/") and n.endswith(".xml.rels")}

    log.info("살아있는 슬라이드: %d (xml) / %d (rel)", len(live_slide_xml), len(live_slide_rel))

    # 1차 스캔 — 살아있는 슬라이드의 rel 들만 참조하는 media 파일 수집
    with zipfile.ZipFile(pptx_path, "r") as zin:
        for rel_name in sorted(live_slide_rel):
            if rel_name not in all_names:
                continue
            try:
                with zin.open(rel_name) as f:
                    content = f.read()
                # XML 파싱 — Target 속성이 미디어 가리키는 것 수집
                try:
                    root = ET.fromstring(content)
                    for el in root.iter():
                        target = el.attrib.get("Target", "")
                        if "media/" in target:
                            # 상대경로 → 절대 zip path
                            # 예: "../media/image1.jpg" → "ppt/media/image1.jpg"
                            media_name = target.split("media/")[-1]
                            used_media.add(f"ppt/media/{media_name}")
                except ET.ParseError:
                    pass
            except Exception as e:
                log.warning("rel 스캔 실패 %s: %s", rel_name, e)

        # slideLayout / slideMaster 의 rels 도 추가 (테마 이미지)
        for rel_name in [n for n in all_names
                         if (n.startswith("ppt/slideLayouts/_rels/")
                             or n.startswith("ppt/slideMasters/_rels/")
                             or n.startswith("ppt/theme/_rels/"))
                         and n.endswith(".xml.rels")]:
            try:
                with zin.open(rel_name) as f:
                    content = f.read()
                try:
                    root = ET.fromstring(content)
                    for el in root.iter():
                        target = el.attrib.get("Target", "")
                        if "media/" in target:
                            media_name = target.split("media/")[-1]
                            used_media.add(f"ppt/media/{media_name}")
                except ET.ParseError:
                    pass
            except Exception:
                pass

    # 2차 — keep 할 미디어 + 살아있는 슬라이드 XML/rel 만 남기고 ZIP 다시 쓰기
    removed_media = []
    removed_slides = []
    kept_media = []
    with zipfile.ZipFile(pptx_path, "r") as zin:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                name = item.filename
                # 죽은 슬라이드 XML 제거
                if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                    if live_slide_xml and name not in live_slide_xml:
                        removed_slides.append(name)
                        continue
                # 죽은 슬라이드 .rels 제거
                if name.startswith("ppt/slides/_rels/") and name.endswith(".xml.rels"):
                    if live_slide_rel and name not in live_slide_rel:
                        removed_slides.append(name)
                        continue
                # 미디어 GC
                if name.startswith("ppt/media/"):
                    if name in used_media:
                        zout.writestr(item, zin.read(name))
                        kept_media.append(name)
                    else:
                        removed_media.append(name)
                        continue
                else:
                    zout.writestr(item, zin.read(name))

    # 원본을 GC된 사본으로 교체
    orig_size = pptx_path.stat().st_size
    _shutil.move(str(tmp_path), str(pptx_path))
    new_size = pptx_path.stat().st_size

    log.info("GC · 미디어 제거 %d, 슬라이드 제거 %d · %.1fMB → %.1fMB (%.0f%% ↓)",
             len(removed_media), len(removed_slides),
             orig_size / 1024 / 1024, new_size / 1024 / 1024,
             100 * (1 - new_size / orig_size) if orig_size else 0)

    return {
        "media_removed": len(removed_media),
        "media_kept": len(kept_media),
        "slides_removed": len(removed_slides),
        "size_before_mb": round(orig_size / 1024 / 1024, 1),
        "size_after_mb": round(new_size / 1024 / 1024, 1),
        "size_reduction_pct": round(100 * (1 - new_size / orig_size), 1) if orig_size else 0,
    }


# ─── 메인 함수 ──────────────────────────────────────────────

def generate_from_master(
    master_path: str | Path,
    content_per_slide: dict[int, dict],
    output_path: str | Path,
    keep_indices: Optional[list[int]] = None,
) -> dict:
    """마스터 PPTX 기반 새 제안서 생성.

    Args:
      master_path: 마스터 PPTX 파일 경로
      content_per_slide: {slide_idx: {"거버닝": ..., "소제목": ..., "본문": [...]}, ...}
      output_path: 결과 PPTX 저장 경로
      keep_indices: 유지할 슬라이드 인덱스 (None 이면 content_per_slide 의 키만 유지)

    Returns:
      {"slide_count": int, "replaced_total": int, "errors": [...]}
    """
    master_path = Path(master_path)
    output_path = Path(output_path)
    if not master_path.exists():
        raise FileNotFoundError(f"마스터 PPTX 없음: {master_path}")

    # 1. 마스터 통째 파일 복사 (이미지/도형/차트/표/시각화 100% 보존)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(master_path, output_path)

    # 2. 사본 열기
    prs = Presentation(str(output_path))
    slides = list(prs.slides)
    log.info("마스터 로드 · %d 슬라이드", len(slides))

    # 3. 텍스트 치환 — 마스터에 placeholder 마커 있으면 placeholder 모드, 없으면 AUTO 모드
    #    placeholder 모드: {{거버닝|max:25}} 같은 마커만 정확히 치환 (디자인 100% 보존)
    #    AUTO 모드:        모든 텍스트 비우고 사이즈 매핑으로 채움 (legacy, 짬뽕 가능)
    use_placeholder_mode = has_any_placeholder(prs)
    log.info("렌더 모드: %s", "PLACEHOLDER" if use_placeholder_mode else "AUTO")

    replaced_total = 0
    cleared_total = 0
    missing_keys_total: set[str] = set()
    errors_total = []
    for slide_idx, content in content_per_slide.items():
        if slide_idx >= len(slides):
            log.warning("슬라이드 %d 인덱스 초과 (전체 %d)", slide_idx, len(slides))
            continue
        slide = slides[slide_idx]
        try:
            if use_placeholder_mode:
                r = fill_slide_with_placeholders(slide, content)
                replaced_total += r["replaced"]
                missing_keys_total.update(r.get("missing_keys", []))
            else:
                r = fill_slide_clearing_master(slide, content)
                replaced_total += r["replaced"]
                cleared_total += r.get("cleared", 0)
                errors_total.extend([f"slide{slide_idx}: {e}" for e in r.get("errors", [])])
        except Exception as e:
            log.exception("슬라이드 %d 치환 실패: %s", slide_idx, e)
            errors_total.append(f"slide{slide_idx}: {e}")

    # 3-b. content 가 지정되지 않은 슬라이드 (keep_indices 에는 있지만 content_per_slide 에 없는)
    #      AUTO 모드: 모든 텍스트 비움 (마스터 원본 잔재 방지)
    #      placeholder 모드: 손대지 않음 (마커 없으면 자연히 안 건드림)
    if keep_indices is not None and not use_placeholder_mode:
        for idx in keep_indices:
            if idx in content_per_slide:
                continue
            if idx >= len(slides):
                continue
            slide = slides[idx]
            try:
                r = fill_slide_clearing_master(slide, {})
                cleared_total += r.get("cleared", 0)
            except Exception as e:
                log.warning("슬라이드 %d 빈값 처리 실패: %s", idx, e)

    # 4. keep_indices 지정 시 그 외 삭제
    if keep_indices is None:
        keep_indices = sorted(content_per_slide.keys())
    if keep_indices:
        remove_slides_keep(prs, keep_indices)

    # 5. 저장
    prs.save(str(output_path))

    final_count = len(prs.slides)
    if use_placeholder_mode:
        log.info("저장 · %d 슬라이드 / 마커 치환 %d · 누락키 %d · 에러 %d",
                 final_count, replaced_total, len(missing_keys_total), len(errors_total))
        if missing_keys_total:
            log.info("누락된 마커 키 (마스터엔 있는데 content 에 없음): %s",
                     sorted(missing_keys_total)[:20])
    else:
        log.info("저장 · %d 슬라이드 / 치환 %d · 비움 %d · 에러 %d",
                 final_count, replaced_total, cleared_total, len(errors_total))

    # 6. 미디어 garbage collection — 사용 안 하는 이미지/동영상 제거 (사이즈 축소)
    gc_result = {}
    try:
        gc_result = garbage_collect_media(output_path)
    except Exception as e:
        log.warning("미디어 GC 실패 (무시): %s", e)

    return {
        "slide_count": final_count,
        "replaced_total": replaced_total,
        "errors": errors_total[:10],
        "output_path": str(output_path),
        "media_gc": gc_result,
    }


# ─── PPTX → PNG 미리보기 변환 ────────────────────────────────

LIBREOFFICE_CANDIDATES = [
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "soffice",
]


def _find_soffice() -> Optional[str]:
    """LibreOffice 실행파일 자동 탐색."""
    import subprocess as sp
    for c in LIBREOFFICE_CANDIDATES:
        p = Path(c)
        if p.exists():
            return str(p)
        try:
            r = sp.run([c, "--version"], capture_output=True, timeout=5)
            if r.returncode == 0:
                return c
        except Exception:
            continue
    return None


def pptx_to_png_previews(
    pptx_path: str | Path,
    out_dir: str | Path,
    *,
    width: int = 1280,
    timeout_sec: int = 90,
) -> list[Path]:
    """PPTX → PDF (LibreOffice) → 페이지별 PNG (pypdfium2).

    Args:
      pptx_path: 입력 PPTX
      out_dir: PNG 저장 디렉토리 — slide_01.png, slide_02.png, ...
      width: PNG 가로 픽셀 (높이는 종횡비 유지)
      timeout_sec: LibreOffice 변환 타임아웃

    Returns:
      생성된 PNG 경로 리스트 (slide_idx 순)
    """
    import subprocess as sp
    import tempfile

    pptx_path = Path(pptx_path)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    soffice = _find_soffice()
    if not soffice:
        log.warning("LibreOffice 못 찾음 — PNG 미리보기 생성 불가")
        return []

    # 1. PPTX → PDF (LibreOffice headless)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        # 임시 user-profile (다른 soffice 인스턴스와 충돌 방지)
        profile_dir = tmp_dir / "profile"
        profile_dir.mkdir()
        cmd = [
            soffice, "--headless", "--norestore", "--nologo", "--nofirststartwizard",
            f"-env:UserInstallation=file:///{str(profile_dir).replace(chr(92), '/')}",
            "--convert-to", "pdf",
            "--outdir", str(tmp_dir),
            str(pptx_path),
        ]
        try:
            r = sp.run(cmd, capture_output=True, timeout=timeout_sec)
            if r.returncode != 0:
                log.warning("LibreOffice PDF 변환 실패: %s",
                            r.stderr.decode("utf-8", errors="replace")[:200])
                return []
        except sp.TimeoutExpired:
            log.warning("LibreOffice PDF 변환 타임아웃 (%ds)", timeout_sec)
            try:
                sp.run(["taskkill", "/F", "/IM", "soffice.bin"],
                       capture_output=True, timeout=10)
            except Exception:
                pass
            return []

        pdf_files = list(tmp_dir.glob("*.pdf"))
        if not pdf_files:
            log.warning("PDF 출력 못 찾음")
            return []
        pdf_path = pdf_files[0]

        # 2. PDF → PNG 페이지별 (pypdfium2)
        try:
            import pypdfium2 as pdfium
        except ImportError:
            log.warning("pypdfium2 미설치 — pip install pypdfium2")
            return []

        png_paths: list[Path] = []
        try:
            pdf = pdfium.PdfDocument(str(pdf_path))
            n_pages = len(pdf)
            for i in range(n_pages):
                page = pdf[i]
                # 1280px 너비 기준 scale 계산 (PDF 1pt = 1/72인치)
                pdf_w_pt = page.get_width()
                scale = width / pdf_w_pt if pdf_w_pt else 2.0
                bitmap = page.render(scale=scale)
                pil = bitmap.to_pil()
                out_path = out_dir / f"slide_{i+1:02d}.png"
                # JPEG 가 PNG 보다 작지만 미리보기는 PNG 가 무손실
                pil.save(out_path, "PNG", optimize=True)
                png_paths.append(out_path)
            pdf.close()
        except Exception as e:
            log.exception("PDF → PNG 변환 실패: %s", e)
            return []

    log.info("PNG 미리보기 생성 · %d 슬라이드 → %s", len(png_paths), out_dir)
    return png_paths


def find_master_template(domain: Optional[str] = None) -> Optional[Path]:
    """분야에 맞는 마스터 PPTX 파일 찾기.

    조회 순서 (placeholder 모드 우선):
      1. master_templates/paperlogy_default.pptx (auto_inject_markers 적용된 placeholder 마스터)
      2. master_templates/dmz_default.pptx (legacy, AUTO 모드 fallback)
      3. master_templates/ 안의 첫 *.pptx
      4. R2_LOCAL_CACHE_DIR 환경변수가 가리키는 디렉토리

    차후 domain 별 매핑 확장 예정.
    """
    import os
    candidates: list[Path] = []
    base = Path(__file__).parent / "master_templates"
    if base.is_dir():
        # 1. placeholder 마스터 우선 (paperlogy_default 또는 *_placeholder)
        candidates.append(base / "paperlogy_default.pptx")
        # 그 외 *_placeholder.pptx 패턴
        candidates.extend(sorted(base.glob("*_placeholder.pptx")))
        # 2. legacy 마스터 (AUTO 모드)
        candidates.append(base / "dmz_default.pptx")
        # 3. 그 외 모든 pptx
        candidates.extend(sorted(base.glob("*.pptx")))
    cache_env = os.environ.get("R2_LOCAL_CACHE_DIR")
    if cache_env:
        cache = Path(cache_env)
        if cache.is_dir():
            candidates.append(cache / "paperlogy_default.pptx")
            candidates.append(cache / "dmz_default.pptx")
            candidates.extend(sorted(cache.glob("*.pptx")))
    seen: set[str] = set()
    for c in candidates:
        if str(c) in seen:
            continue
        seen.add(str(c))
        if c.exists() and c.stat().st_size > 0:
            return c
    return None


################################################################################
# 🎨 도형 JSON 모드 — Claude 가 layout 자유 결정 → 원시 도형 그리기
#
# 마스터 PPTX 와 무관. AI 가 슬라이드별로 도형 + 위치 + 텍스트 자유롭게 정함.
# 우리 코드는 *원시 도형 그리기 함수* 만 제공 (rect/text/line/circle/arrow/image)
# 입력 형식: 도형 JSON 스펙
################################################################################

from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR, MSO_AUTO_SIZE
from pptx.oxml.ns import qn


def _hex_to_rgb(hex_color):
    """#RRGGBB → RGBColor (잘못된 입력은 검정으로 폴백)."""
    if not hex_color:
        return RGBColor(0, 0, 0)
    h = str(hex_color).lstrip("#").strip()
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return RGBColor(0, 0, 0)
    try:
        return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except ValueError:
        return RGBColor(0, 0, 0)


def _set_no_fill(shape) -> None:
    """투명 채움."""
    try:
        shape.fill.background()
    except Exception:
        pass


def _set_no_line(shape) -> None:
    """테두리 없음."""
    try:
        shape.line.fill.background()
    except Exception:
        pass


def _add_rect(slide, x, y, w, h, *, fill="#FFFFFF", stroke=None, stroke_width=None, radius=None):
    """사각형 (옵션: rounded, 테두리, 채움)."""
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(
        shape_type, Inches(x), Inches(y), Inches(w), Inches(h)
    )
    if fill:
        shape.fill.solid()
        shape.fill.fore_color.rgb = _hex_to_rgb(fill)
    else:
        _set_no_fill(shape)
    if stroke:
        shape.line.color.rgb = _hex_to_rgb(stroke)
        if stroke_width:
            shape.line.width = Pt(float(stroke_width))
    else:
        _set_no_line(shape)
    return shape


def _add_text(slide, x, y, w, h, text, *,
              size=14, weight=400, color="#1A1A1A",
              align="left", valign="top",
              font_family=None, italic=False):
    """텍스트 박스. 줄바꿈 \\n 으로 멀티라인 지원."""
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    try:
        tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_SHAPE_FIT  # D-Fix-AutoSize: 텍스트가 박스 넘치면 폰트 자동 축소 (넘침 방지)
    except Exception:
        pass
    tf.margin_left = Inches(0.04)
    tf.margin_right = Inches(0.04)
    tf.margin_top = Inches(0.04)     # Phase 4 — 본문 시각 여백 ↑ (옵션 1)
    tf.margin_bottom = Inches(0.04)  # Phase 4 — 본문 시각 여백 ↑ (옵션 1)
    valign_map = {
        "top": MSO_ANCHOR.TOP,
        "middle": MSO_ANCHOR.MIDDLE,
        "center": MSO_ANCHOR.MIDDLE,
        "bottom": MSO_ANCHOR.BOTTOM,
    }
    try:
        tf.vertical_anchor = valign_map.get(str(valign).lower(), MSO_ANCHOR.TOP)
    except Exception:
        pass

    align_map = {
        "left": PP_ALIGN.LEFT,
        "center": PP_ALIGN.CENTER,
        "right": PP_ALIGN.RIGHT,
        "justify": PP_ALIGN.JUSTIFY,
    }

    lines = (text or "").split("\n")
    # weight 기반 자동 폰트 매핑 (font_family 명시 시 그것이 우선)
    target_font = _resolve_font(font_family, weight)
    # 안전망: target_font 가 빈 문자열 / None 으로 새어 나올 경우 DEFAULT 강제
    if not target_font or not str(target_font).strip():
        target_font = DEFAULT_FONT_FAMILY
    weight_norm = _normalize_weight(weight)

    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = 1.15  # Phase 4 — 본문 시각 여백 ↑ (옵션 1, 모든 paragraph)
        try:
            p.alignment = align_map.get(str(align).lower(), PP_ALIGN.LEFT)
        except Exception:
            pass
        run = p.add_run()
        run.text = line
        try:
            run.font.size = Pt(float(size))
        except Exception:
            run.font.size = Pt(14)
        # PowerPoint 호환 bool bold 유지 (weight 600 이상이면 True)
        # — 매핑된 폰트가 이미 굵기 표현하지만 PowerPoint 기본 렌더링 호환용
        run.font.bold = weight_norm >= 600
        if italic:
            run.font.italic = True
        run.font.color.rgb = _hex_to_rgb(color)
        # 폰트 매핑: font_family 명시 우선 → weight 자동 매핑 (Paperlogy 9 단계)
        try:
            run.font.name = target_font
        except Exception:
            pass
    return box


def _add_line(slide, x1, y1, x2, y2, *, color="#1A1A1A", width=1.0):
    """직선 (커넥터)."""
    line = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT,
        Inches(x1), Inches(y1), Inches(x2), Inches(y2),
    )
    line.line.color.rgb = _hex_to_rgb(color)
    try:
        line.line.width = Pt(float(width))
    except Exception:
        line.line.width = Pt(1)
    return line


def _add_arrow(slide, x1, y1, x2, y2, *, color="#1A1A1A", width=1.5):
    """화살표 — 직선 + tail 끝에 삼각형."""
    line = slide.shapes.add_connector(
        MSO_CONNECTOR.STRAIGHT,
        Inches(x1), Inches(y1), Inches(x2), Inches(y2),
    )
    line.line.color.rgb = _hex_to_rgb(color)
    try:
        line.line.width = Pt(float(width))
    except Exception:
        line.line.width = Pt(1.5)
    # XML 직접 조작 — tail 에 화살촉 추가
    try:
        ln = line.line._get_or_add_ln()
        # 기존 헤드/테일 제거
        for tag in ("a:headEnd", "a:tailEnd"):
            existing = ln.find(qn(tag))
            if existing is not None:
                ln.remove(existing)
        from lxml import etree
        head_end = etree.SubElement(ln, qn("a:headEnd"))
        head_end.set("type", "none")
        tail_end = etree.SubElement(ln, qn("a:tailEnd"))
        tail_end.set("type", "triangle")
        tail_end.set("w", "med")
        tail_end.set("len", "med")
    except Exception as e:
        log.warning("화살촉 추가 실패 (선만 표시): %s", e)
    return line


def _add_circle(slide, x, y, w, h, *, fill="#000000", stroke=None, stroke_width=None):
    """원/타원."""
    shape = slide.shapes.add_shape(
        MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(w), Inches(h)
    )
    if fill:
        shape.fill.solid()
        shape.fill.fore_color.rgb = _hex_to_rgb(fill)
    else:
        _set_no_fill(shape)
    if stroke:
        shape.line.color.rgb = _hex_to_rgb(stroke)
        if stroke_width:
            shape.line.width = Pt(float(stroke_width))
    else:
        _set_no_line(shape)
    return shape


def _add_image_placeholder(slide, x, y, w, h, hint="이미지 추가"):
    """이미지 자리 — 회색 박스 + 안내. 사용자가 PowerPoint 에서 더블클릭으로 이미지 삽입."""
    box = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h)
    )
    box.fill.solid()
    box.fill.fore_color.rgb = RGBColor(0xEC, 0xEC, 0xEC)
    box.line.color.rgb = RGBColor(0xCC, 0xCC, 0xCC)
    box.line.width = Pt(0.75)
    tf = box.text_frame
    tf.word_wrap = True
    try:
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    except Exception:
        pass
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = "🖼  " + str(hint)
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
    run.font.italic = True
    return box


# ============================================================
# Spec D-Fix-11a Stage A (5/19) — 신규 도형 헬퍼 5종
# 시각화 다양성 영역 확장: chevron / pentagon / callout / block_arrow / star
# ⚠ Stage A 만 적용 시 효과 0 — LLM 영역 신규 type 출력 X (시스템 프롬프트 무변경).
# ⚠ Stage B 영역 (시스템 프롬프트 안내) 진입 전 안전 영역 확보 단계.
# 패턴 정합: _add_rect (fill/stroke) + _add_image_placeholder (text_frame 영역).
# ============================================================

def _add_shape_with_text(slide, mso_shape_type, x, y, w, h, *,
                          fill="#FFFFFF", stroke=None, stroke_width=None,
                          text=None, text_color="#1A1A1A", text_size=12,
                          text_weight=400, text_align="center"):
    """내부 헬퍼 — 신규 도형 5종 영역 공통 본문 (DRY 영역).

    fill / stroke 영역 = _add_rect 패턴 정확 정합.
    텍스트 영역 = _add_image_placeholder 패턴 + _add_text 정렬 정합.
    """
    shape = slide.shapes.add_shape(
        mso_shape_type, Inches(x), Inches(y), Inches(w), Inches(h),
    )
    # fill / stroke (_add_rect 패턴)
    if fill:
        shape.fill.solid()
        shape.fill.fore_color.rgb = _hex_to_rgb(fill)
    else:
        _set_no_fill(shape)
    if stroke:
        shape.line.color.rgb = _hex_to_rgb(stroke)
        if stroke_width:
            shape.line.width = Pt(float(stroke_width))
    else:
        _set_no_line(shape)
    # 텍스트 영역 (옵션, _add_image_placeholder 패턴 + _add_text 정렬)
    if text:
        tf = shape.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.04)
        tf.margin_right = Inches(0.04)
        try:
            tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        except Exception:
            pass
        p = tf.paragraphs[0]
        align_map = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}
        try:
            p.alignment = align_map.get(str(text_align).lower(), PP_ALIGN.CENTER)
        except Exception:
            pass
        target_font = _resolve_font(None, text_weight) or DEFAULT_FONT_FAMILY
        weight_norm = _normalize_weight(text_weight)
        run = p.add_run()
        run.text = str(text)
        try:
            run.font.size = Pt(float(text_size))
        except Exception:
            run.font.size = Pt(12)
        run.font.bold = weight_norm >= 600
        run.font.color.rgb = _hex_to_rgb(text_color)
        try:
            run.font.name = target_font
        except Exception:
            pass
    return shape


def _add_chevron(slide, x, y, w, h, *, fill="#FFFFFF", stroke=None, stroke_width=None,
                 text=None, text_color="#1A1A1A", text_size=12, text_weight=400, text_align="center"):
    """CHEVRON 도형 (프로세스 단계 영역). 텍스트는 도형 안 가운데 정렬."""
    return _add_shape_with_text(
        slide, MSO_SHAPE.CHEVRON, x, y, w, h,
        fill=fill, stroke=stroke, stroke_width=stroke_width,
        text=text, text_color=text_color, text_size=text_size,
        text_weight=text_weight, text_align=text_align,
    )


def _add_pentagon(slide, x, y, w, h, *, fill="#FFFFFF", stroke=None, stroke_width=None,
                  text=None, text_color="#1A1A1A", text_size=12, text_weight=400, text_align="center"):
    """PENTAGON 도형 (Phase / 단계 영역). 텍스트는 도형 안 가운데 정렬."""
    return _add_shape_with_text(
        slide, MSO_SHAPE.PENTAGON, x, y, w, h,
        fill=fill, stroke=stroke, stroke_width=stroke_width,
        text=text, text_color=text_color, text_size=text_size,
        text_weight=text_weight, text_align=text_align,
    )


def _add_callout(slide, x, y, w, h, *, fill="#FFFFFF", stroke="#1A1A1A", stroke_width=1.0,
                 text=None, text_color="#1A1A1A", text_size=12, text_weight=400, text_align="center"):
    """RECTANGULAR_CALLOUT 도형 (말풍선 / 핵심 메시지 강조).

    기본 stroke = #1A1A1A — 말풍선 영역 본질 (테두리 있음).
    """
    return _add_shape_with_text(
        slide, MSO_SHAPE.RECTANGULAR_CALLOUT, x, y, w, h,
        fill=fill, stroke=stroke, stroke_width=stroke_width,
        text=text, text_color=text_color, text_size=text_size,
        text_weight=text_weight, text_align=text_align,
    )


def _add_block_arrow(slide, x, y, w, h, *, fill="#1A1A1A", stroke=None, stroke_width=None,
                     text=None, text_color="#FFFFFF", text_size=12, text_weight=400, text_align="center"):
    """RIGHT_ARROW 도형 (굵은 화살표 — line/arrow 영역 보다 시각 ↑).

    기본 fill = #1A1A1A / text_color = #FFFFFF — 검은 화살표 + 흰 글자 본질.
    """
    return _add_shape_with_text(
        slide, MSO_SHAPE.RIGHT_ARROW, x, y, w, h,
        fill=fill, stroke=stroke, stroke_width=stroke_width,
        text=text, text_color=text_color, text_size=text_size,
        text_weight=text_weight, text_align=text_align,
    )


def _add_star(slide, x, y, w, h, *, fill="#1A1A1A", stroke=None, stroke_width=None,
              text=None, text_color="#FFFFFF", text_size=14, text_weight=700, text_align="center"):
    """STAR_5_POINT 도형 (차별화 / 강조 포인트).

    기본 text_weight=700 / text_size=14 — 별 영역 강조 본질.
    """
    return _add_shape_with_text(
        slide, MSO_SHAPE.STAR_5_POINT, x, y, w, h,
        fill=fill, stroke=stroke, stroke_width=stroke_width,
        text=text, text_color=text_color, text_size=text_size,
        text_weight=text_weight, text_align=text_align,
    )


def render_shape_to_slide(slide, shape_def):
    """단일 도형 스펙(JSON) → 슬라이드에 그림.

    지원 type:
      [기존] rect, text, line, arrow, circle/ellipse/oval, image/image_placeholder
      [Stage A (5/19) 신규] chevron, pentagon, callout, block_arrow, star
    실패 시 None 반환 (다른 도형 렌더링은 계속됨).
    """
    if not isinstance(shape_def, dict):
        return None
    t = str(shape_def.get("type", "")).lower().strip()
    try:
        if t in ("rect", "rectangle"):
            return _add_rect(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 1)), float(shape_def.get("h", 1)),
                fill=shape_def.get("fill"),
                stroke=shape_def.get("stroke"),
                stroke_width=shape_def.get("stroke_width"),
                radius=shape_def.get("radius"),
            )
        if t == "text":
            # Spec D-Fix-GovColorRemove-1 — 거버닝 파랑(#1E40AF) 강제 휴리스틱 제거.
            # AI 가 SLIDE_SYSTEM_PROMPT 의 흑백 6색 규칙으로 출력하니 그 색 그대로 사용.
            return _add_text(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 5)), float(shape_def.get("h", 1)),
                str(shape_def.get("text", "")),
                size=float(shape_def.get("size", 14)),
                weight=int(shape_def.get("weight", 400)),
                color=str(shape_def.get("color", "#1A1A1A")),
                align=str(shape_def.get("align", "left")),
                valign=str(shape_def.get("valign", "top")),
                font_family=shape_def.get("font_family"),
                italic=bool(shape_def.get("italic", False)),
            )
        if t == "line":
            return _add_line(
                slide,
                float(shape_def.get("x1", 0)), float(shape_def.get("y1", 0)),
                float(shape_def.get("x2", 1)), float(shape_def.get("y2", 0)),
                color=str(shape_def.get("color", "#1A1A1A")),
                width=float(shape_def.get("width", 1.0)),
            )
        if t == "arrow":
            return _add_arrow(
                slide,
                float(shape_def.get("x1", 0)), float(shape_def.get("y1", 0)),
                float(shape_def.get("x2", 1)), float(shape_def.get("y2", 0)),
                color=str(shape_def.get("color", "#1A1A1A")),
                width=float(shape_def.get("width", 1.5)),
            )
        if t in ("circle", "ellipse", "oval"):
            return _add_circle(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 1)), float(shape_def.get("h", 1)),
                fill=str(shape_def.get("fill", "#000000")),
                stroke=shape_def.get("stroke"),
                stroke_width=shape_def.get("stroke_width"),
            )
        if t in ("image", "image_placeholder"):
            return _add_image_placeholder(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 4)), float(shape_def.get("h", 3)),
                hint=str(shape_def.get("hint", "이미지 추가")),
            )
        # Spec D-Fix-11a Stage A (5/19) — 신규 도형 5종 분기
        # ⚠ 효과 0 (의도된 안전 — LLM 영역 본 type 출력 X, Stage B 영역 안내 추가 후 활성).
        if t in ("chevron", "process_step"):
            return _add_chevron(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 1)), float(shape_def.get("h", 0.5)),
                fill=shape_def.get("fill", "#FFFFFF"),
                stroke=shape_def.get("stroke"),
                stroke_width=shape_def.get("stroke_width"),
                text=shape_def.get("text"),
                text_color=str(shape_def.get("text_color", "#1A1A1A")),
                text_size=float(shape_def.get("text_size", 12)),
                text_weight=int(shape_def.get("text_weight", 400)),
                text_align=str(shape_def.get("text_align", "center")),
            )
        if t in ("pentagon", "step"):
            return _add_pentagon(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 1)), float(shape_def.get("h", 0.8)),
                fill=shape_def.get("fill", "#FFFFFF"),
                stroke=shape_def.get("stroke"),
                stroke_width=shape_def.get("stroke_width"),
                text=shape_def.get("text"),
                text_color=str(shape_def.get("text_color", "#1A1A1A")),
                text_size=float(shape_def.get("text_size", 12)),
                text_weight=int(shape_def.get("text_weight", 400)),
                text_align=str(shape_def.get("text_align", "center")),
            )
        if t in ("callout", "rect_callout"):
            return _add_callout(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 3)), float(shape_def.get("h", 1)),
                fill=shape_def.get("fill", "#FFFFFF"),
                stroke=shape_def.get("stroke", "#1A1A1A"),
                stroke_width=float(shape_def.get("stroke_width", 1.0)),
                text=shape_def.get("text"),
                text_color=str(shape_def.get("text_color", "#1A1A1A")),
                text_size=float(shape_def.get("text_size", 12)),
                text_weight=int(shape_def.get("text_weight", 400)),
                text_align=str(shape_def.get("text_align", "center")),
            )
        if t in ("block_arrow", "right_arrow"):
            return _add_block_arrow(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 2)), float(shape_def.get("h", 0.5)),
                fill=shape_def.get("fill", "#1A1A1A"),
                stroke=shape_def.get("stroke"),
                stroke_width=shape_def.get("stroke_width"),
                text=shape_def.get("text"),
                text_color=str(shape_def.get("text_color", "#FFFFFF")),
                text_size=float(shape_def.get("text_size", 12)),
                text_weight=int(shape_def.get("text_weight", 400)),
                text_align=str(shape_def.get("text_align", "center")),
            )
        if t in ("star", "star_5_point"):
            return _add_star(
                slide,
                float(shape_def.get("x", 0)), float(shape_def.get("y", 0)),
                float(shape_def.get("w", 1)), float(shape_def.get("h", 1)),
                fill=shape_def.get("fill", "#1A1A1A"),
                stroke=shape_def.get("stroke"),
                stroke_width=shape_def.get("stroke_width"),
                text=shape_def.get("text"),
                text_color=str(shape_def.get("text_color", "#FFFFFF")),
                text_size=float(shape_def.get("text_size", 14)),
                text_weight=int(shape_def.get("text_weight", 700)),
                text_align=str(shape_def.get("text_align", "center")),
            )
    except Exception as e:
        log.warning("도형 렌더링 실패 (type=%s): %s", t, e)
    return None


def _build_preset_quantitative_emphasis(slide_data: dict) -> list:
    """Spec D-Fix-Preset1 — 정량 강조(큰 숫자) 레이아웃 프리셋.

    slide_data["metrics"] = [{"value": "50억", "label": "총 예산"}, ...] (1~3개).
    반환 = render_shape_to_slide 가 처리하는 JSON 도형 리스트 (type/x/y/w/h/text/...).
    형식 오류 / 데이터 없음 시 빈 리스트 (호출부 try/except 와 별개 안전망).

    좌표 설계 (A4 가로 11.69 × 8.27 인치):
      · 상단 분리선 y=2.5 (강조)
      · 큰 숫자 1~3개: y=2.8~5.0, size 90~120pt, 중앙·균등 배치
      · 라벨: 숫자 바로 아래 y=5.1, 18pt, 회색
    """
    metrics = slide_data.get("metrics") or []
    if not isinstance(metrics, list) or not metrics:
        return []
    valid: list = []
    for m in metrics:
        if not isinstance(m, dict):
            continue
        v = str(m.get("value", "")).strip()
        lab = str(m.get("label", "")).strip()
        if v:
            valid.append((v, lab))
        if len(valid) >= 3:
            break
    if not valid:
        return []

    n = len(valid)
    if n == 1:
        positions = [(4.0, 3.7, 120)]
    elif n == 2:
        positions = [(1.3, 4.4, 100), (6.0, 4.4, 100)]
    else:  # 3
        positions = [(0.9, 3.3, 90), (4.2, 3.3, 90), (7.5, 3.3, 90)]

    shapes: list = [{
        "type": "line",
        "x1": 0.9, "y1": 2.5, "x2": 10.8, "y2": 2.5,
        "color": "#1A1A1A", "width": 1.5,
    }]
    for (x, w, size), (val, lab) in zip(positions, valid):
        shapes.append({
            "type": "text",
            "x": x, "y": 2.8, "w": w, "h": 2.2,
            "text": val,
            "size": size, "weight": 900, "color": "#1A1A1A",
            "align": "center", "valign": "middle",
        })
        if lab:
            shapes.append({
                "type": "text",
                "x": x, "y": 5.1, "w": w, "h": 0.6,
                "text": lab,
                "size": 18, "weight": 500, "color": "#666",
                "align": "center", "valign": "top",
            })
    return shapes


def _build_preset_horizontal_process(slide_data: dict) -> list:
    """Spec D-Fix-Preset2 — 가로 프로세스(추진 절차/운영 흐름) 레이아웃 프리셋.

    slide_data["steps"] = [{"label": "분석", "desc": "현황 진단" (선택)}, ...] (3~7개).
    반환 = render_shape_to_slide 가 처리하는 JSON 도형 리스트 (chevron + 선택 desc text).
    형식 오류 / 데이터 없음 / 단계 수 3~7 밖 → 빈 리스트 (호출부 try/except 와 별개 안전망).

    좌표 설계 (A4 가로 11.69 × 8.27 / 좌우 여백 0.9 / 본문 폭 9.89):
      · chevron 가로 균등 배치 (단계 수에 따라 box_w 자동 계산)
      · gap = 0.1 (n<=5) / 0.05 (n=6~7)
      · box_y = 3.5 / box_h = 1.2
      · 통일 흰 fill + 검정 stroke 1.5pt + label 14pt 700weight
      · desc 있으면 chevron 아래 11pt 회색 (y=4.9, h=1.3)

    ⚠ chevron 은 auto_size 미적용 (텍스트 박스 전용) — label 짧게 강제 권장
       (3단계 5~10자 / 5단계 4~6자 / 7단계 2~4자).
    """
    steps = slide_data.get("steps") or []
    if not isinstance(steps, list):
        return []
    valid: list = []
    for s in steps:
        if not isinstance(s, dict):
            continue
        label = str(s.get("label", "")).strip()
        desc = str(s.get("desc", "")).strip()
        if label:
            valid.append((label, desc))
    n = len(valid)
    if n < 3 or n > 7:
        return []

    margin = 0.9
    gap = 0.1 if n <= 5 else 0.05
    inner_w = 11.69 - 2 * margin
    box_w = (inner_w - gap * (n - 1)) / n
    box_h = 1.2
    box_y = 3.5

    shapes: list = []
    for i, (label, desc) in enumerate(valid):
        x = margin + i * (box_w + gap)
        shapes.append({
            "type": "chevron",
            "x": x, "y": box_y, "w": box_w, "h": box_h,
            "fill": "#FFFFFF",
            "stroke": "#1A1A1A",
            "stroke_width": 1.5,
            "text": label,
            "text_color": "#1A1A1A",
            "text_size": 14,
            "text_weight": 700,
            "text_align": "center",
        })
        if desc:
            shapes.append({
                "type": "text",
                "x": x, "y": 4.9, "w": box_w, "h": 1.3,
                "text": desc,
                "size": 11, "weight": 400, "color": "#666",
                "align": "center", "valign": "top",
            })
    return shapes


def _build_preset_two_column(slide_data: dict) -> list:
    """Spec D-Fix-Preset3 — 2분할(AS-IS/TO-BE / 현재→개선 / 문제→해결) 레이아웃 프리셋.

    slide_data["columns"] = [
      {"title": "AS-IS", "items": ["현재 상태 1", "현재 상태 2", ...]},
      {"title": "TO-BE", "items": ["개선 결과 1", "개선 결과 2", ...]}
    ] (정확히 2개 / 좌=AS-IS / 우=TO-BE).
    반환 = render_shape_to_slide 가 처리하는 JSON 도형 리스트
           (좌우 rect + 제목 text + 항목 text + 중앙 block_arrow).
    형식 오류 / columns 2개 아님 / 빈 데이터 → 빈 리스트 (호출부 try/except 와 별개 안전망).

    좌표 설계 (A4 가로 11.69 × 8.27 / 좌우 여백 0.9 / 본문 폭 9.89):
      · 중앙 화살표 자리 1.0 / panel_w = (9.89 - 1.0) / 2 = 4.445
      · 좌 패널 x=0.9 / 우 패널 x=6.345 / panel_y=2.8 / panel_h=4.0
      · 좌 = 흰 fill + 회색 stroke (#999) / 우 = 흰 fill + 검정 stroke (#1A1A1A 강조)
      · 제목 18pt 700w / 항목 13pt 400w (auto_size 적용 — 넘침 방지)
      · 중앙 block_arrow (x=5.35 y=4.4 w=1.0 h=0.8 / 검정 fill + 흰 글자 "→")
    """
    columns = slide_data.get("columns") or []
    if not isinstance(columns, list) or len(columns) != 2:
        return []
    parsed: list = []
    for c in columns:
        if not isinstance(c, dict):
            return []
        title = str(c.get("title", "")).strip()
        items_raw = c.get("items") or []
        if not isinstance(items_raw, list):
            items_raw = []
        items = [str(i).strip() for i in items_raw if str(i).strip()]
        parsed.append((title, items))
    if not any(t or its for t, its in parsed):
        return []

    margin = 0.9
    center_gap = 1.0
    panel_w = (11.69 - 2 * margin - center_gap) / 2
    panel_h = 4.0
    panel_y = 2.8
    left_x = margin
    right_x = margin + panel_w + center_gap

    shapes: list = []
    panel_styles = [
        {"x": left_x,  "stroke": "#999999", "stroke_width": 1.0},
        {"x": right_x, "stroke": "#1A1A1A", "stroke_width": 1.5},
    ]
    for (title, items), style in zip(parsed, panel_styles):
        x = style["x"]
        # 패널 사각형
        shapes.append({
            "type": "rect",
            "x": x, "y": panel_y, "w": panel_w, "h": panel_h,
            "fill": "#FFFFFF",
            "stroke": style["stroke"],
            "stroke_width": style["stroke_width"],
        })
        # 제목
        if title:
            shapes.append({
                "type": "text",
                "x": x + 0.2, "y": panel_y + 0.15, "w": panel_w - 0.4, "h": 0.5,
                "text": title,
                "size": 18, "weight": 700, "color": "#1A1A1A",
                "align": "left", "valign": "top",
            })
        # 항목 리스트 (한 텍스트 박스에 줄바꿈 — auto_size 자동 적용)
        if items:
            body = "\n".join("· " + it for it in items)
            shapes.append({
                "type": "text",
                "x": x + 0.2, "y": panel_y + 0.85, "w": panel_w - 0.4, "h": panel_h - 1.05,
                "text": body,
                "size": 13, "weight": 400, "color": "#1A1A1A",
                "align": "left", "valign": "top",
            })

    # 중앙 block_arrow (좌 → 우 전환)
    shapes.append({
        "type": "block_arrow",
        "x": left_x + panel_w + 0.05, "y": panel_y + (panel_h - 0.8) / 2,
        "w": center_gap - 0.1, "h": 0.8,
        "fill": "#1A1A1A",
        "text": "→",
        "text_color": "#FFFFFF",
        "text_size": 20,
        "text_weight": 700,
    })
    return shapes


def _build_preset_narrative(slide_data: dict) -> list:
    """Spec D-Fix-Preset4 — 내러티브 흐름형(시장분석·인사이트·논리 전개) 레이아웃 프리셋.

    도식 없이 텍스트 위계로 흐름을 보여주는 단순 3슬롯 구조.
    slide_data["quote"]      = "큰 인용 문구"               (필수)
    slide_data["flow"]       = ["흐름 설명1", "흐름 설명2", ...] (선택 / 1~3개)
    slide_data["conclusion"] = "결론 강조 문구"             (선택)
    반환 = render_shape_to_slide 가 처리하는 JSON 도형 리스트
           (인용 text + 흐름 text 1~3 + 결론 rect + 결론 text).
    quote 없음 / 모든 슬롯 빈 값 → 빈 리스트 (호출부 try/except 와 별개 안전망).

    좌표 설계 (A4 가로 11.69 × 8.27 / 좌우 여백 0.9 / 본문 폭 9.89):
      · 인용 (필수)   : x=0.9 y=1.8 w=9.89 h=1.6 / 30pt 700w 검정 center
      · 흐름 (1~3개) : x=0.9 w=9.89 h=0.7 / 15pt 400w #555 center
                       y = 3.8, 4.7, 5.6 (각 0.9 간격)
      · 결론 (선택)  : rect x=2.4 y=6.5 w=6.89 h=0.9 흰 fill 검정 stroke 1.5pt
                       + text 같은 자리 19pt 700w center
      · 모든 텍스트 _add_text 거침 → auto_size 자동 적용 (넘침 방지).

    Spec D-Fix-Preset5 — style 분기 추가:
      · "quote" (기본) → 인용 + 흐름 + 결론 (아래 로직 / D-Fix-Preset4 보존)
      · "declaration" → 큰 선언 + 근거 2~3개
      · "qa"          → 질문 + 답변 1~3
      · "emphasis"    → 소제목 + 본문 + 핵심 강조
      · "contrast"    → "A가 아니라 B" 대비
    """
    style = str(slide_data.get("style", "quote")).strip().lower()
    if style == "declaration":
        return _narrative_declaration(slide_data)
    if style == "qa":
        return _narrative_qa(slide_data)
    if style == "emphasis":
        return _narrative_emphasis(slide_data)
    if style == "contrast":
        return _narrative_contrast(slide_data)
    # style == "quote" 또는 미지정 → 기존 로직 그대로 (D-Fix-Preset4 보존)
    quote = str(slide_data.get("quote", "")).strip()
    flow_raw = slide_data.get("flow") or []
    if not isinstance(flow_raw, list):
        flow_raw = []
    flow = [str(f).strip() for f in flow_raw if str(f).strip()][:3]
    conclusion = str(slide_data.get("conclusion", "")).strip()

    if not quote:
        return []

    shapes: list = []
    # 큰 인용 (필수)
    shapes.append({
        "type": "text",
        "x": 0.9, "y": 1.8, "w": 9.89, "h": 1.6,
        "text": quote,
        "size": 30, "weight": 700, "color": "#1A1A1A",
        "align": "center", "valign": "middle",
    })
    # 흐름 설명 (선택 / 최대 3개)
    for i, line in enumerate(flow):
        shapes.append({
            "type": "text",
            "x": 0.9, "y": 3.8 + i * 0.9, "w": 9.89, "h": 0.7,
            "text": line,
            "size": 15, "weight": 400, "color": "#555555",
            "align": "center", "valign": "middle",
        })
    # 결론 강조 박스 (선택)
    if conclusion:
        shapes.append({
            "type": "rect",
            "x": 2.4, "y": 6.5, "w": 6.89, "h": 0.9,
            "fill": "#FFFFFF",
            "stroke": "#1A1A1A",
            "stroke_width": 1.5,
        })
        shapes.append({
            "type": "text",
            "x": 2.4, "y": 6.5, "w": 6.89, "h": 0.9,
            "text": conclusion,
            "size": 19, "weight": 700, "color": "#1A1A1A",
            "align": "center", "valign": "middle",
        })
    return shapes


def _narrative_declaration(slide_data: dict) -> list:
    """D-Fix-Preset5 narrative style=declaration — 큰 선언 + 근거 2~3개."""
    declaration = str(slide_data.get("declaration", "")).strip()
    grounds_raw = slide_data.get("grounds") or []
    if not isinstance(grounds_raw, list):
        grounds_raw = []
    grounds = [str(g).strip() for g in grounds_raw if str(g).strip()][:3]
    if not declaration:
        return []
    shapes: list = [{
        "type": "text",
        "x": 0.9, "y": 2.0, "w": 9.89, "h": 1.8,
        "text": declaration,
        "size": 32, "weight": 700, "color": "#1A1A1A",
        "align": "center", "valign": "middle",
    }]
    for i, g in enumerate(grounds):
        shapes.append({
            "type": "text",
            "x": 0.9, "y": 4.4 + i * 1.0, "w": 9.89, "h": 0.8,
            "text": g,
            "size": 16, "weight": 400, "color": "#444444",
            "align": "center", "valign": "middle",
        })
    return shapes


def _narrative_qa(slide_data: dict) -> list:
    """D-Fix-Preset5 narrative style=qa — 질문 + 답변 1~3."""
    question = str(slide_data.get("question", "")).strip()
    answers_raw = slide_data.get("answers") or []
    if not isinstance(answers_raw, list):
        answers_raw = []
    answers = [str(a).strip() for a in answers_raw if str(a).strip()][:3]
    if not question:
        return []
    shapes: list = [{
        "type": "text",
        "x": 0.9, "y": 2.0, "w": 9.89, "h": 1.4,
        "text": "Q. " + question,
        "size": 28, "weight": 700, "color": "#1A1A1A",
        "align": "center", "valign": "middle",
    }]
    for i, a in enumerate(answers):
        shapes.append({
            "type": "text",
            "x": 0.9, "y": 4.0 + i * 0.9, "w": 9.89, "h": 0.8,
            "text": a,
            "size": 16, "weight": 400, "color": "#444444",
            "align": "center", "valign": "middle",
        })
    return shapes


def _narrative_emphasis(slide_data: dict) -> list:
    """D-Fix-Preset5 narrative style=emphasis — 소제목 + 본문 + 핵심 강조."""
    subtitle = str(slide_data.get("subtitle", "")).strip()
    body = str(slide_data.get("body", "")).strip()
    highlight = str(slide_data.get("highlight", "")).strip()
    if not (subtitle or body or highlight):
        return []
    shapes: list = []
    if subtitle:
        shapes.append({
            "type": "text",
            "x": 0.9, "y": 1.6, "w": 9.89, "h": 0.8,
            "text": subtitle,
            "size": 18, "weight": 700, "color": "#666666",
            "align": "center", "valign": "middle",
        })
    if body:
        shapes.append({
            "type": "text",
            "x": 0.9, "y": 2.6, "w": 9.89, "h": 2.5,
            "text": body,
            "size": 15, "weight": 400, "color": "#333333",
            "align": "center", "valign": "top",
        })
    if highlight:
        shapes.append({
            "type": "text",
            "x": 0.9, "y": 5.5, "w": 9.89, "h": 1.0,
            "text": highlight,
            "size": 24, "weight": 700, "color": "#1A1A1A",
            "align": "center", "valign": "middle",
        })
    return shapes


def _narrative_contrast(slide_data: dict) -> list:
    """D-Fix-Preset5 narrative style=contrast — 'A가 아니라 B' 대비."""
    not_this = str(slide_data.get("not_this", "")).strip()
    but_this = str(slide_data.get("but_this", "")).strip()
    if not but_this:
        return []
    shapes: list = []
    if not_this:
        shapes.append({
            "type": "text",
            "x": 0.9, "y": 2.8, "w": 9.89, "h": 1.0,
            "text": not_this,
            "size": 22, "weight": 400, "color": "#999999",
            "align": "center", "valign": "middle",
        })
    shapes.append({
        "type": "text",
        "x": 0.9, "y": 4.2, "w": 9.89, "h": 1.6,
        "text": but_this,
        "size": 34, "weight": 700, "color": "#1A1A1A",
        "align": "center", "valign": "middle",
    })
    return shapes


def generate_from_shape_json(json_data, output_path):
    """도형 JSON → PPTX (마스터 무관, AI 가 layout 자유 결정 모드).

    json_data 형식:
      {
        "title": "...",
        "slide_width": 11.69,       # 옵션 (inch). 기본 A4 가로 (한국 B2G 표준)
        "slide_height": 8.27,       # 옵션
        "slides": [
          {
            "section": "표지",
            "shapes": [
              {"type": "rect", "x": 0, "y": 0, "w": 0.5, "h": 8.3, "fill": "#000"},
              {"type": "text", "x": 1, "y": 2, "w": 6, "h": 1.5,
               "text": "수주", "size": 80, "weight": 900},
              ...
            ]
          },
          ...
        ]
      }
    """
    if not isinstance(json_data, dict):
        raise ValueError("json_data 가 dict 가 아님")
    slides_data = json_data.get("slides")
    if not isinstance(slides_data, list) or not slides_data:
        raise ValueError("slides 배열 비어있거나 list 아님")

    # 기본값 A4 가로 (11.69×8.27, 인치) — 한국 B2G 공공입찰 표준 인쇄 비율.
    # 시스템 프롬프트 / OUTLINE / SLIDE 모두 동일 기본값으로 정합.
    sw = float(json_data.get("slide_width", 11.69))
    sh = float(json_data.get("slide_height", 8.27))

    prs = Presentation()
    prs.slide_width = Inches(sw)
    prs.slide_height = Inches(sh)
    blank_layout = prs.slide_layouts[6]

    rendered_total = 0
    errors_total = []
    for slide_idx, slide_data in enumerate(slides_data):
        if not isinstance(slide_data, dict):
            errors_total.append("slide" + str(slide_idx) + ": not a dict")
            prs.slides.add_slide(blank_layout)
            continue
        slide = prs.slides.add_slide(blank_layout)
        # Spec D-Fix-Preset1 — 옵트인 레이아웃 프리셋 (preset 키 없으면 현행 / 실패 시 AI 좌표 fallback)
        preset_name = slide_data.get("preset")
        if preset_name == "quantitative":
            try:
                preset_shapes = _build_preset_quantitative_emphasis(slide_data)
                shapes = preset_shapes + (slide_data.get("shapes") or [])
            except Exception:
                shapes = slide_data.get("shapes", [])
        elif preset_name == "process":
            try:
                preset_shapes = _build_preset_horizontal_process(slide_data)
                shapes = preset_shapes + (slide_data.get("shapes") or [])
            except Exception:
                shapes = slide_data.get("shapes", [])
        elif preset_name == "two_column":
            try:
                preset_shapes = _build_preset_two_column(slide_data)
                shapes = preset_shapes + (slide_data.get("shapes") or [])
            except Exception:
                shapes = slide_data.get("shapes", [])
        elif preset_name == "narrative":
            try:
                preset_shapes = _build_preset_narrative(slide_data)
                shapes = preset_shapes + (slide_data.get("shapes") or [])
            except Exception:
                shapes = slide_data.get("shapes", [])
        else:
            shapes = slide_data.get("shapes", [])
        if not isinstance(shapes, list):
            errors_total.append("slide" + str(slide_idx) + ": shapes not list")
            continue
        for shape_idx, shape_def in enumerate(shapes):
            try:
                result = render_shape_to_slide(slide, shape_def)
                if result is not None:
                    rendered_total += 1
            except Exception as e:
                errors_total.append(
                    "slide" + str(slide_idx) + ":shape" + str(shape_idx) +
                    ": " + type(e).__name__ + ": " + str(e)
                )

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(output_path))

    log.info("도형 JSON 모드 · 슬라이드 %d / 도형 %d 렌더 / 에러 %d",
             len(slides_data), rendered_total, len(errors_total))

    return {
        "slide_count": len(slides_data),
        "rendered_total": rendered_total,
        "errors": errors_total[:10],
        "output_path": str(output_path),
        "size_mb": round(output_path.stat().st_size / 1024 / 1024, 2),
    }
