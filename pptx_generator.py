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
from pptx.util import Pt
from pptx.dml.color import RGBColor

log = logging.getLogger("pptx_gen")


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
                if key in content and content[key] is not None:
                    val = _truncate(str(content[key]), ph["max"])
                    new_text = new_text[: m.start()] + val + new_text[m.end():]
                    result["replaced"] += 1
                else:
                    # content 에 키 없음 — 빈 문자열로 대체 (마커 자체는 제거)
                    new_text = new_text[: m.start()] + "" + new_text[m.end():]
                    if key not in result["missing_keys"]:
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
                if key in content and content[key] is not None:
                    val = _truncate(str(content[key]), ph["max"])
                    new_full = new_full[: m.start()] + val + new_full[m.end():]
                    result["replaced"] += 1
                else:
                    new_full = new_full[: m.start()] + "" + new_full[m.end():]
                    if key not in result["missing_keys"]:
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

    조회 순서:
      1. master_templates/dmz_default.pptx (R2 sync 가 만든 alias 또는 로컬 기본)
      2. master_templates/ 안의 첫 *.pptx (R2 다운로드된 임의 파일)
      3. R2_LOCAL_CACHE_DIR 환경변수가 가리키는 디렉토리의 첫 *.pptx

    차후 domain 별 매핑 확장 예정.
    """
    import os
    candidates: list[Path] = []
    base = Path(__file__).parent / "master_templates"
    if base.is_dir():
        candidates.append(base / "dmz_default.pptx")
        candidates.extend(sorted(base.glob("*.pptx")))
    cache_env = os.environ.get("R2_LOCAL_CACHE_DIR")
    if cache_env:
        cache = Path(cache_env)
        if cache.is_dir():
            candidates.append(cache / "dmz_default.pptx")
            candidates.extend(sorted(cache.glob("*.pptx")))
    for c in candidates:
        if c.exists() and c.stat().st_size > 0:
            return c
    return None
