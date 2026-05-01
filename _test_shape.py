"""도형 JSON 모드 단위 테스트 — SOOZOO 톤 모방."""
import sys
sys.path.insert(0, ".")
import pptx_generator as pg
from pathlib import Path
import shutil

test_json = {
    "title": "테스트 PPTX",
    "slide_width": 11.7,
    "slide_height": 8.3,
    "slides": [
        # 슬라이드 0 — 커버 (좌 메인 + 우 KPI 3개) — SOOZOO 톤
        {
            "section": "표지",
            "shapes": [
                # 좌측 검은 바
                {"type": "rect", "x": 0, "y": 0, "w": 0.4, "h": 8.3, "fill": "#000000"},
                # 큰 헤드라인
                {"type": "text", "x": 0.8, "y": 1.5, "w": 6.5, "h": 4,
                 "text": "수주\n에이전트 AI\n서비스소개서",
                 "size": 60, "weight": 900, "color": "#1A1A1A", "align": "left"},
                # 구분선
                {"type": "line", "x1": 0.8, "y1": 6.0, "x2": 4.0, "y2": 6.0,
                 "color": "#1A1A1A", "width": 2},
                # 부제
                {"type": "text", "x": 0.8, "y": 6.3, "w": 6, "h": 1,
                 "text": "RFP 분석부터 발표 Q&A까지",
                 "size": 16, "weight": 600, "color": "#444"},
                # 우측 KPI 1
                {"type": "text", "x": 8.5, "y": 1.5, "w": 2.5, "h": 1.5,
                 "text": "7", "size": 80, "weight": 900, "color": "#1A1A1A", "align": "right"},
                {"type": "text", "x": 8.5, "y": 3.1, "w": 2.5, "h": 0.4,
                 "text": "단계  ·  AI 파이프라인",
                 "size": 11, "color": "#666", "align": "right"},
                {"type": "line", "x1": 8.5, "y1": 3.6, "x2": 11.0, "y2": 3.6, "color": "#DDD"},
                # KPI 2
                {"type": "text", "x": 8.5, "y": 4.0, "w": 2.5, "h": 1.5,
                 "text": "28", "size": 80, "weight": 900, "color": "#1A1A1A", "align": "right"},
                {"type": "text", "x": 8.5, "y": 5.6, "w": 2.5, "h": 0.4,
                 "text": "개  ·  AI 에이전트",
                 "size": 11, "color": "#666", "align": "right"},
                # 푸터
                {"type": "line", "x1": 0.4, "y1": 7.9, "x2": 11.3, "y2": 7.9, "color": "#DDD"},
                {"type": "text", "x": 0.8, "y": 7.95, "w": 4, "h": 0.3,
                 "text": "NIGHTOFF", "size": 9, "color": "#999", "weight": 600},
                {"type": "text", "x": 7.0, "y": 7.95, "w": 4, "h": 0.3,
                 "text": "01 / 02", "size": 9, "color": "#999", "align": "right"},
            ],
        },
        # 슬라이드 1 — 5단 가로 타임라인
        {
            "section": "프로세스",
            "shapes": [
                {"type": "text", "x": 0.8, "y": 0.6, "w": 10, "h": 0.7,
                 "text": "서비스 프로세스 — 고객사 입장에서 어떻게 진행되는가",
                 "size": 24, "weight": 800, "color": "#1A1A1A"},
                {"type": "text", "x": 0.8, "y": 1.3, "w": 10, "h": 0.4,
                 "text": "당신은 수행에 집중, 기회 발굴과 수주는 저희가",
                 "size": 12, "color": "#666", "italic": True},
                # 5개 동그라미 + 텍스트
                # 단계 1
                {"type": "circle", "x": 1.0, "y": 3.5, "w": 0.7, "h": 0.7, "fill": "#000"},
                {"type": "text", "x": 1.0, "y": 3.5, "w": 0.7, "h": 0.7,
                 "text": "1", "size": 14, "color": "#FFF", "weight": 700,
                 "align": "center", "valign": "middle"},
                {"type": "text", "x": 0.4, "y": 2.5, "w": 1.9, "h": 0.5,
                 "text": "RFP 공유", "size": 14, "weight": 700, "align": "center"},
                {"type": "text", "x": 0.4, "y": 4.4, "w": 1.9, "h": 0.4,
                 "text": "수 초", "size": 11, "color": "#666", "align": "center"},
                # 단계 2
                {"type": "circle", "x": 3.2, "y": 3.5, "w": 0.7, "h": 0.7, "fill": "#000"},
                {"type": "text", "x": 3.2, "y": 3.5, "w": 0.7, "h": 0.7,
                 "text": "2", "size": 14, "color": "#FFF", "weight": 700,
                 "align": "center", "valign": "middle"},
                {"type": "text", "x": 2.6, "y": 2.5, "w": 1.9, "h": 0.5,
                 "text": "자동 분석", "size": 14, "weight": 700, "align": "center"},
                {"type": "text", "x": 2.6, "y": 4.4, "w": 1.9, "h": 0.4,
                 "text": "수 시간", "size": 11, "color": "#666", "align": "center"},
                # 단계 3
                {"type": "circle", "x": 5.4, "y": 3.5, "w": 0.7, "h": 0.7, "fill": "#000"},
                {"type": "text", "x": 5.4, "y": 3.5, "w": 0.7, "h": 0.7,
                 "text": "3", "size": 14, "color": "#FFF", "weight": 700,
                 "align": "center", "valign": "middle"},
                {"type": "text", "x": 4.8, "y": 2.5, "w": 1.9, "h": 0.5,
                 "text": "전략 확인", "size": 14, "weight": 700, "align": "center"},
                {"type": "text", "x": 4.8, "y": 4.4, "w": 1.9, "h": 0.4,
                 "text": "30분", "size": 11, "color": "#666", "align": "center"},
                # 단계 4
                {"type": "circle", "x": 7.6, "y": 3.5, "w": 0.7, "h": 0.7, "fill": "#000"},
                {"type": "text", "x": 7.6, "y": 3.5, "w": 0.7, "h": 0.7,
                 "text": "4", "size": 14, "color": "#FFF", "weight": 700,
                 "align": "center", "valign": "middle"},
                {"type": "text", "x": 7.0, "y": 2.5, "w": 1.9, "h": 0.5,
                 "text": "초안 검토", "size": 14, "weight": 700, "align": "center"},
                {"type": "text", "x": 7.0, "y": 4.4, "w": 1.9, "h": 0.4,
                 "text": "1~2일", "size": 11, "color": "#666", "align": "center"},
                # 단계 5
                {"type": "circle", "x": 9.8, "y": 3.5, "w": 0.7, "h": 0.7, "fill": "#000"},
                {"type": "text", "x": 9.8, "y": 3.5, "w": 0.7, "h": 0.7,
                 "text": "5", "size": 14, "color": "#FFF", "weight": 700,
                 "align": "center", "valign": "middle"},
                {"type": "text", "x": 9.2, "y": 2.5, "w": 1.9, "h": 0.5,
                 "text": "납품", "size": 14, "weight": 700, "align": "center"},
                {"type": "text", "x": 9.2, "y": 4.4, "w": 1.9, "h": 0.4,
                 "text": "D-Day", "size": 11, "color": "#666", "align": "center"},
                # 5개 동그라미 잇는 가로선
                {"type": "line", "x1": 1.7, "y1": 3.85, "x2": 9.8, "y2": 3.85,
                 "color": "#000", "width": 1.5},
                # 끝에 화살표
                {"type": "arrow", "x1": 9.8, "y1": 3.85, "x2": 11.0, "y2": 3.85,
                 "color": "#000", "width": 1.5},
                # 푸터
                {"type": "line", "x1": 0.4, "y1": 7.9, "x2": 11.3, "y2": 7.9, "color": "#DDD"},
                {"type": "text", "x": 0.8, "y": 7.95, "w": 4, "h": 0.3,
                 "text": "NIGHTOFF", "size": 9, "color": "#999", "weight": 600},
                {"type": "text", "x": 7.0, "y": 7.95, "w": 4, "h": 0.3,
                 "text": "02 / 02", "size": 9, "color": "#999", "align": "right"},
            ],
        },
    ],
}

out = Path("_shape_test.pptx")
result = pg.generate_from_shape_json(test_json, out)
print(f"PPTX 생성: {result}")
print()

preview = Path("_shape_preview")
if preview.exists():
    shutil.rmtree(preview)
preview.mkdir()
pngs = pg.pptx_to_png_previews(out, preview, width=1200, timeout_sec=120)
print(f"PNG: {len(pngs)} 장")
for p in pngs:
    print(f"  {p.name} {p.stat().st_size // 1024} KB")
