"""
dispatch — 어댑터가 정한 template 키로 해당 조립기를 호출하는 진입점.

흐름: OutlineItem → adapter.adapt_item() → {template, ...필드}
      → dispatch.build(adapted) → 완성 HTML 1장

운영 이식 시: 이 파일이 "조립 경로의 단일 입구"다.
generate_one_slide의 HTML 모드 분기에서 이걸 부르면 된다.

경로 (환경변수로 조정 가능):
  PATH1_ASSEMBLER_DIR : 조립기(assemble_*.py) 위치. 기본 = 이 파일 옆 ../assemblers
  PATH1_TEMPLATE_DIR  : 템플릿(template_*.html) 위치. 기본 = 이 파일 옆 ../templates
조립기는 template_*.html을 _tpl.load()로 절대경로에서 읽는다(chdir 안 씀, 동시성 안전).
"""
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
# 묶음 구조(core/ + assemblers/ + templates/) 기준 기본 경로. 운영 이식 시 환경변수로 덮어쓰기.
ASSEMBLER_DIR = os.environ.get("PATH1_ASSEMBLER_DIR",
                               os.path.normpath(os.path.join(_HERE, "..", "assemblers")))
TEMPLATE_DIR = os.environ.get("PATH1_TEMPLATE_DIR",
                              os.path.normpath(os.path.join(_HERE, "..", "templates")))

def _load_assemblers():
    """조립기 모듈들을 로드해 {template_key: 함수} 맵 반환."""
    import importlib.util, sys
    # 조립기들이 'from _tpl import load'를 쓰므로 ASSEMBLER_DIR을 import 경로에 추가
    if ASSEMBLER_DIR not in sys.path:
        sys.path.insert(0, ASSEMBLER_DIR)
    def load(name, fname):
        spec = importlib.util.spec_from_file_location(name, os.path.join(ASSEMBLER_DIR, fname))
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
    aKPI=load("aKPI","assemble_KPI.py"); aSEG=load("aSEG","assemble_SEG.py")
    aFLOW=load("aFLOW","assemble_FLOW.py"); aG1=load("aG1","assemble_G1.py")
    aG2=load("aG2","assemble_G2.py"); a456=load("a456","assemble_G456.py")
    a78910=load("a78910","assemble_G78910.py"); aG12=load("aG12","assemble_G12.py")
    aG13=load("aG13","assemble_G13.py"); aG14=load("aG14","assemble_G14.py")
    return {
        "KPI":aKPI.assemble_KPI, "SEG":aSEG.assemble_SEG, "FLOW":aFLOW.assemble_FLOW,
        "G1":aG1.assemble_G1, "G2":aG2.assemble_G2,
        "G4":a456.assemble_G4, "G5":a456.assemble_G5, "G6":a456.assemble_G6,
        "G7":a78910.assemble_G7, "G8":a78910.assemble_G8,
        "G9":a78910.assemble_G9, "G10":a78910.assemble_G10,
        "G12":aG12.assemble_G12, "G13":aG13.assemble_G13, "G14":aG14.assemble_G14,
    }

_ASSEMBLERS = None

def build(adapted):
    """adapted dict(template 포함) → 완성 HTML. template=NONE이면 None 반환(=fallback 신호)."""
    global _ASSEMBLERS
    tpl = adapted.get("template", "NONE")
    if tpl == "NONE":
        return None
    if _ASSEMBLERS is None:
        _ASSEMBLERS = _load_assemblers()
    fn = _ASSEMBLERS.get(tpl)
    if fn is None:
        return None
    # 조립기가 _tpl.load()로 절대경로 템플릿을 읽으므로 chdir 불필요(운영 동시성 안전).
    return fn(adapted)

# 지원하는 template 키 목록(검증/문서용)
SUPPORTED = ["KPI","SEG","FLOW","G1","G2","G4","G5","G6","G7","G8","G9","G10","G12","G13","G14"]
# 의도적 미지원(fallback): G3(인물 사진+프로필 — OutlineItem 텍스트만으론 부적합)
