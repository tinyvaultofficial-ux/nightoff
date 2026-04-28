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


def replace_text_in_slide(slide, content: dict) -> dict:
    """AUTO 모드 텍스트 치환.

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

    # 3. 텍스트 치환 (지정된 슬라이드만)
    replaced_total = 0
    errors_total = []
    for slide_idx, content in content_per_slide.items():
        if slide_idx >= len(slides):
            log.warning("슬라이드 %d 인덱스 초과 (전체 %d)", slide_idx, len(slides))
            continue
        slide = slides[slide_idx]
        try:
            r = replace_text_in_slide(slide, content)
            replaced_total += r["replaced"]
            errors_total.extend([f"slide{slide_idx}: {e}" for e in r["errors"]])
        except Exception as e:
            log.exception("슬라이드 %d 치환 실패: %s", slide_idx, e)
            errors_total.append(f"slide{slide_idx}: {e}")

    # 4. keep_indices 지정 시 그 외 삭제
    if keep_indices is None:
        keep_indices = sorted(content_per_slide.keys())
    if keep_indices:
        remove_slides_keep(prs, keep_indices)

    # 5. 저장
    prs.save(str(output_path))

    final_count = len(prs.slides)
    log.info("저장 · %d 슬라이드 / %d 치환 / %d 에러",
             final_count, replaced_total, len(errors_total))

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


def find_master_template(domain: Optional[str] = None) -> Optional[Path]:
    """분야에 맞는 마스터 PPTX 파일 찾기.
    현재는 단일 마스터 (dmz_default.pptx) 반환. 차후 분야별 매핑 확장.
    """
    base = Path(__file__).parent / "master_templates"
    if not base.is_dir():
        return None
    # 분야별 매핑 (향후 확장)
    # festival/forum/exhibition/... → 각 마스터 파일
    default = base / "dmz_default.pptx"
    if default.exists():
        return default
    # 기타 PPTX 파일 중 첫 번째
    for f in base.glob("*.pptx"):
        return f
    return None
