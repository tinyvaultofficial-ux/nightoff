"""템플릿 로더 — 절대경로로 template_*.html을 읽는다 (chdir 불필요).
운영 이식 시 PATH1_TEMPLATE_DIR 환경변수로 위치 지정. 기본 = 이 파일 옆 ../templates."""
import os, functools

TEMPLATE_DIR = os.environ.get(
    "PATH1_TEMPLATE_DIR",
    os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates"))
)

@functools.lru_cache(maxsize=64)
def load(name):
    """template 파일명(name) → 내용. 캐시됨(같은 템플릿 반복 읽기 방지)."""
    path = os.path.join(TEMPLATE_DIR, name)
    with open(path, encoding="utf-8") as f:
        return f.read()
