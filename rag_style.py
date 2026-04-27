"""
RAG 3단계: 스타일 패턴 추출
17개 파일에서 다음 4가지를 통계로 잡아내 _rag_style_guide.md / .json 으로 저장:

1) 섹션 구성 패턴 — 자주 쓰는 대단원·소단원 마커, 등장 순서
2) 문체와 표현       — 자주 쓰는 거버닝 어미, 문장 길이, n-gram
3) 시각화 패턴       — 표/차트/STEP/타임라인/단계 등 키워드 빈도 + 섹션 매칭
4) 페이지 밀도       — 페이지당 글자 수 / 줄 수 분포
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

EXTRACT_DIR = Path("_rag_extracted")
OUT_JSON = Path("_rag_style.json")
OUT_MD = Path("_rag_style_guide.md")

# ─── 섹션 마커 정규식 ───
ROMAN_RE      = re.compile(r"^\s*([Ⅰ-Ⅹ])\.?\s*([^\n]{0,40})", re.M)         # Ⅰ. 제안 개요
ROMAN_PARENS  = re.compile(r"^\s*\(([Ⅰ-Ⅹ])\)\s*([^\n]{0,40})", re.M)
NUM_DOT       = re.compile(r"^\s*(\d{1,2})\.\s+([가-힣A-Za-z][^\n]{1,40})", re.M)  # 1. 제안 배경
NUM_DOT_DOT   = re.compile(r"^\s*(\d{1,2}\.\d{1,2})\.?\s*([^\n]{0,40})", re.M)  # 2.1 / 2.1.
GA_NA         = re.compile(r"^\s*([가-힣])\.\s+([가-힣][^\n]{1,40})", re.M)  # 가. 추진 배경
JE_JANG       = re.compile(r"^\s*제\s*(\d{1,2})\s*[장절부]\s+([^\n]{0,40})", re.M)  # 제1장
PART          = re.compile(r"^\s*PART\s*(\d{1,2})\.?\s*([^\n]{0,40})", re.M | re.I)
CONTENTS_LBL  = re.compile(r"\b(CONTENTS|목\s*차|목차|차\s*례|INDEX)\b", re.I)

# ─── 거버닝 메시지 어미 (자주 쓰일 만한 패턴) ───
ENDING_PATTERNS = {
    "~ 구조":       re.compile(r"\S{2,}\s*구조\b"),
    "~ 설계":       re.compile(r"\S{2,}\s*설계\b"),
    "~ 확립":       re.compile(r"\S{2,}\s*확립\b"),
    "~ 체계":       re.compile(r"\S{2,}\s*체계\b"),
    "~ 방안":       re.compile(r"\S{2,}\s*방안\b"),
    "~ 전략":       re.compile(r"\S{2,}\s*전략\b"),
    "~ 모델":       re.compile(r"\S{2,}\s*모델\b"),
    "~ 플랫폼":     re.compile(r"\S{2,}\s*플랫폼\b"),
    "~ 시스템":     re.compile(r"\S{2,}\s*시스템\b"),
    "~ 프로세스":   re.compile(r"\S{2,}\s*프로세스\b"),
    "~ 메커니즘":   re.compile(r"\S{2,}\s*메커니즘\b"),
    "~ 거버넌스":   re.compile(r"\S{2,}\s*거버넌스\b"),
    "~ 매뉴얼":     re.compile(r"\S{2,}\s*매뉴얼\b"),
    "~ 로드맵":     re.compile(r"\S{2,}\s*로드맵\b"),
    "~ 솔루션":     re.compile(r"\S{2,}\s*솔루션\b"),
    "~ 허브":       re.compile(r"\S{2,}\s*허브\b"),
    "~ 생태계":     re.compile(r"\S{2,}\s*생태계\b"),
    "~ 네트워크":   re.compile(r"\S{2,}\s*네트워크\b"),
    "~ 경험":       re.compile(r"\S{2,}\s*경험\b"),
    "~ 여정":       re.compile(r"\S{2,}\s*여정\b"),
}

# ─── 시각화 키워드 ───
VISUAL_KEYWORDS = {
    "STEP 플로우":       re.compile(r"\bSTEP\s*\d+\b|단계\s*\d+|\d+단계\b"),
    "타임라인":          re.compile(r"\b(타임라인|TIME\s*LINE|로드맵|D-?\d+|D[+]\d+|\d{4}\.\d{1,2}\.\d{1,2})"),
    "표(table)":         re.compile(r"\b(구분|항목|세부내용|비고|단가|수량|단위|일정)\s*[:│|]"),
    "비교 / 매트릭스":   re.compile(r"\b(AS[\s-]?IS|TO[\s-]?BE|Before|After|비교|대비)\b"),
    "조직도 / 인력":     re.compile(r"\b(조직도|총괄|PM|디렉터|운영진|인력\s*구성)\b"),
    "예산 / 산출내역":   re.compile(r"\b(예산|산출\s*내역|단가|총\s*사업비|VAT)\b"),
    "안전 / 매뉴얼":     re.compile(r"\b(안전\s*관리|비상\s*매뉴얼|위기\s*대응|보험|응급)\b"),
    "퍼센트 / 통계":     re.compile(r"\d+\.?\d*\s*%"),
    "불릿 / 체크":       re.compile(r"^\s*[●◆■◇○•\-\*✓☑]\s+", re.M),
    "강조 (●/▶/▷)":     re.compile(r"[●▶▷◀◁]"),
    "STEP n→m 화살표":   re.compile(r"→|⇒|⇨"),
    "수치 강조 (큰 숫자)": re.compile(r"\b\d{2,3}\s*(?:점|건|개|곳|명|회|시간|분|일|개월|년|만원|억원)\b"),
    "이미지/사진 캡션":  re.compile(r"\[(?:사진|이미지|그림|도식|도표|레이아웃)\s*\d*\]"),
}

# ─── n-gram 빈도 분석을 위한 자주 쓰일 만한 비즈니스 표현 ───
BIZ_PHRASES = [
    "검증된", "최적화", "고도화", "차별화", "선제적", "체계적", "단계적", "지속가능",
    "맞춤형", "전문성", "전담", "통합", "연계", "협업", "확산", "축적",
    "RFP 요구사항", "발주처", "발주기관", "수주", "용역", "정성제안서",
    "안전관리", "리스크 관리", "운영 매뉴얼", "사업 추진",
    "전사", "전 과정", "운영 노하우",
    "ZERO", "100%", "365일",
]

# 디렉터즈/디노마드 같은 자기 회사 시그니처
SIGNATURE_KEYWORDS = ["디렉터즈", "디노마드", "어반플레이", "AXcorp"]


def find_section_markers(text: str) -> dict:
    """텍스트에서 섹션 마커 추출 (한 파일 내)."""
    result = {
        "roman_chapters": [m.group(0).strip()[:40] for m in ROMAN_RE.finditer(text)][:30],
        "num_dot":         [m.group(0).strip()[:40] for m in NUM_DOT.finditer(text)][:50],
        "num_dot_dot":     [m.group(0).strip()[:40] for m in NUM_DOT_DOT.finditer(text)][:50],
        "ga_na":           [m.group(0).strip()[:40] for m in GA_NA.finditer(text)][:30],
        "je_jang":         [m.group(0).strip()[:40] for m in JE_JANG.finditer(text)][:20],
        "part":            [m.group(0).strip()[:40] for m in PART.finditer(text)][:20],
        "contents_label":  bool(CONTENTS_LBL.search(text)),
    }
    # 어떤 마커가 메인으로 쓰였는지 (가장 많이 등장한 형식)
    counts = {
        "roman": len(result["roman_chapters"]),
        "num_dot": len(result["num_dot"]),
        "num_dot_dot": len(result["num_dot_dot"]),
        "ga_na": len(result["ga_na"]),
        "je_jang": len(result["je_jang"]),
        "part": len(result["part"]),
    }
    main_style = max(counts, key=counts.get) if any(counts.values()) else "none"
    result["main_marker_style"] = main_style
    result["marker_counts"] = counts
    return result


def find_endings(text: str) -> Counter:
    """거버닝 어미 패턴 빈도."""
    cnt = Counter()
    for label, pat in ENDING_PATTERNS.items():
        cnt[label] = len(pat.findall(text))
    return cnt


def find_visuals(text: str) -> Counter:
    """시각화 키워드 빈도."""
    cnt = Counter()
    for label, pat in VISUAL_KEYWORDS.items():
        cnt[label] = len(pat.findall(text))
    return cnt


def find_biz_phrases(text: str) -> Counter:
    cnt = Counter()
    for ph in BIZ_PHRASES:
        cnt[ph] = text.count(ph)
    return cnt


def page_density(text: str) -> dict:
    """페이지별 글자 수 분포."""
    pages = re.split(r"=====\s*PAGE\s+\d+\s*=====", text)[1:]  # 첫 split 이전은 메타
    per_page_chars = [len(p.strip()) for p in pages]
    if not per_page_chars:
        return {}
    sorted_chars = sorted(per_page_chars)
    n = len(sorted_chars)
    median = sorted_chars[n // 2]
    avg = sum(per_page_chars) / n
    return {
        "page_count": n,
        "avg_chars_per_page": int(avg),
        "median_chars_per_page": median,
        "min_chars": min(per_page_chars),
        "max_chars": max(per_page_chars),
    }


def sentence_stats(text: str) -> dict:
    """문장 길이 분포."""
    # 한국어 문장 분리 (단순) — 마침표/느낌표/물음표 + 줄바꿈
    sentences = re.split(r"[.!?…]\s+|\n{2,}", text)
    sentences = [s.strip() for s in sentences if 5 <= len(s.strip()) <= 300]
    if not sentences:
        return {}
    lengths = [len(s) for s in sentences]
    lengths.sort()
    return {
        "sample_count": len(lengths),
        "avg_length": int(sum(lengths) / len(lengths)),
        "median_length": lengths[len(lengths) // 2],
        "p25": lengths[len(lengths) // 4],
        "p75": lengths[3 * len(lengths) // 4],
    }


def main():
    files = sorted(EXTRACT_DIR.glob("*.txt"))
    if not files:
        print("❌ _rag_extracted/ 가 비어있습니다. 먼저 rag_extract.py 를 실행하세요.")
        sys.exit(1)

    aggregated = {
        "files_analyzed": len(files),
        "total_chars": 0,
        "total_pages": 0,
        "main_marker_styles": Counter(),
        "ending_counts": Counter(),
        "visual_counts": Counter(),
        "biz_phrases": Counter(),
        "signature_hits": Counter(),
        "page_density_avg": [],
        "sentence_avg": [],
        "files_detail": [],
    }

    for fp in files:
        text = fp.read_text(encoding="utf-8")
        chars = len(text)
        sections = find_section_markers(text)
        endings = find_endings(text)
        visuals = find_visuals(text)
        biz = find_biz_phrases(text)
        density = page_density(text)
        sent = sentence_stats(text)

        aggregated["total_chars"] += chars
        aggregated["total_pages"] += density.get("page_count", 0)
        aggregated["main_marker_styles"][sections["main_marker_style"]] += 1
        aggregated["ending_counts"].update(endings)
        aggregated["visual_counts"].update(visuals)
        aggregated["biz_phrases"].update(biz)
        for k in SIGNATURE_KEYWORDS:
            aggregated["signature_hits"][k] += text.count(k)
        if density:
            aggregated["page_density_avg"].append(density["avg_chars_per_page"])
        if sent:
            aggregated["sentence_avg"].append(sent["avg_length"])

        aggregated["files_detail"].append({
            "filename": fp.stem,
            "chars": chars,
            "pages": density.get("page_count", 0),
            "main_marker": sections["main_marker_style"],
            "marker_counts": sections["marker_counts"],
            "top_5_visuals": dict(visuals.most_common(5)),
            "top_5_endings":  dict(endings.most_common(5)),
            "page_density": density,
            "sentence_stats": sent,
            "sample_chapters": sections["roman_chapters"][:8],
            "sample_sub_sections": sections["num_dot_dot"][:8],
        })

    # 종합 통계
    aggregated["overall_avg_chars_per_page"] = (
        int(sum(aggregated["page_density_avg"]) / len(aggregated["page_density_avg"]))
        if aggregated["page_density_avg"] else 0
    )
    aggregated["overall_avg_sentence_length"] = (
        int(sum(aggregated["sentence_avg"]) / len(aggregated["sentence_avg"]))
        if aggregated["sentence_avg"] else 0
    )
    # Counter → dict (top N)
    aggregated["main_marker_styles"] = dict(aggregated["main_marker_styles"].most_common())
    aggregated["ending_counts"] = dict(aggregated["ending_counts"].most_common(20))
    aggregated["visual_counts"] = dict(aggregated["visual_counts"].most_common(20))
    aggregated["biz_phrases"] = {k: v for k, v in aggregated["biz_phrases"].most_common(30) if v > 0}
    aggregated["signature_hits"] = {k: v for k, v in aggregated["signature_hits"].items() if v > 0}

    # JSON 저장
    OUT_JSON.write_text(json.dumps(aggregated, ensure_ascii=False, indent=2), encoding="utf-8")

    # 사람이 읽을 마크다운 리포트
    md = []
    md.append(f"# 📚 크리스 회사 제안서 스타일 가이드\n")
    md.append(f"_{aggregated['files_analyzed']}개 파일 분석 · 총 {aggregated['total_pages']:,} 페이지 · {aggregated['total_chars']:,} 글자_\n")

    md.append("\n## 🏗 섹션 구성 패턴\n")
    md.append("**주요 마커 스타일 분포** (어떤 번호 체계를 메인으로 쓰는지):\n")
    for style, cnt in aggregated["main_marker_styles"].items():
        md.append(f"- `{style}`: {cnt}개 파일")
    md.append("")
    md.append("→ Ⅰ. Ⅱ. Ⅲ. (로마자 대단원) + 1. 1.1. (소단원) 조합이 한국 정성제안서 표준 패턴")

    md.append("\n## ✍️ 거버닝 메시지 어미 패턴 (TOP 10)\n")
    md.append("| 어미 | 등장 횟수 |")
    md.append("|---|---|")
    for label, cnt in list(aggregated["ending_counts"].items())[:10]:
        md.append(f"| {label} | {cnt:,} |")

    md.append("\n## 🎨 시각화 키워드 빈도 (TOP 10)\n")
    md.append("어떤 시각화 요소가 자주 쓰이는지:\n")
    md.append("| 시각화 | 등장 횟수 |")
    md.append("|---|---|")
    for label, cnt in list(aggregated["visual_counts"].items())[:10]:
        md.append(f"| {label} | {cnt:,} |")

    md.append("\n## 💼 자주 쓰는 비즈니스 표현 (TOP 15)\n")
    md.append("| 표현 | 횟수 |")
    md.append("|---|---|")
    for ph, cnt in list(aggregated["biz_phrases"].items())[:15]:
        md.append(f"| {ph} | {cnt} |")

    md.append("\n## 🏢 자기 회사 시그니처\n")
    if aggregated["signature_hits"]:
        for k, v in aggregated["signature_hits"].items():
            md.append(f"- **{k}**: {v}회 등장")
    else:
        md.append("(없음)")

    md.append("\n## 📊 페이지 밀도 / 문장 길이\n")
    md.append(f"- 평균 페이지당 글자 수: **{aggregated['overall_avg_chars_per_page']:,}자**")
    md.append(f"- 평균 문장 길이: **{aggregated['overall_avg_sentence_length']}자**")
    md.append(f"- 총 분석 페이지: **{aggregated['total_pages']:,}p**")

    md.append("\n## 📁 파일별 상세\n")
    for fd in aggregated["files_detail"]:
        md.append(f"\n### {fd['filename']}")
        md.append(f"- {fd['pages']}p · {fd['chars']:,}자 · 메인 마커: `{fd['main_marker']}`")
        if fd["sample_chapters"]:
            md.append(f"- 발견된 대단원: " + " · ".join(f"`{c}`" for c in fd["sample_chapters"][:5]))
        if fd["top_5_visuals"]:
            top_v = ", ".join(f"{k}({v})" for k, v in fd["top_5_visuals"].items() if v)
            if top_v: md.append(f"- 자주 쓴 시각화: {top_v}")
        if fd["top_5_endings"]:
            top_e = ", ".join(f"{k}({v})" for k, v in fd["top_5_endings"].items() if v)
            if top_e: md.append(f"- 어미 분포: {top_e}")

    OUT_MD.write_text("\n".join(md), encoding="utf-8")

    print(f"\n=== 3단계 분석 완료 ===")
    print(f"  JSON: {OUT_JSON} ({OUT_JSON.stat().st_size:,} bytes)")
    print(f"  MD  : {OUT_MD}   ({OUT_MD.stat().st_size:,} bytes)")
    print(f"\n주요 발견:")
    print(f"  · 메인 섹션 마커: {list(aggregated['main_marker_styles'].keys())[:3]}")
    print(f"  · 페이지당 평균: {aggregated['overall_avg_chars_per_page']}자")
    print(f"  · 평균 문장 길이: {aggregated['overall_avg_sentence_length']}자")
    print(f"  · 자주 쓰는 어미 TOP3: {list(aggregated['ending_counts'].keys())[:3]}")
    print(f"  · 자주 쓰는 시각화 TOP3: {list(aggregated['visual_counts'].keys())[:3]}")


if __name__ == "__main__":
    main()
