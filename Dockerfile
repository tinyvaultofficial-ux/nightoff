# ============================================================================
# Spec D-Build-DockerfileTransition — Microsoft Playwright 이미지 베이스 전환
#
# 배경: Railway nixpacks 환경에서 Playwright chromium 4회 시도 모두 실패.
#   D-Fix-ChromiumInstall / SharedLibs / SharedLibs-2 / NixSymlink /
#   NixSymlink-2 / NixOSPlaywrightDriver / PlaywrightDriverPath 누적.
# 근본 해결: chromium + system deps 가 사전 포함된 Microsoft 공식 이미지 사용.
#
# 베이스: mcr.microsoft.com/playwright/python:v1.60.0-noble
#   · Ubuntu 24.04 noble (Python 3.12 default = 운영 사용 버전과 정합)
#   · Playwright 1.60.0 (requirements.txt 와 정합)
#   · chromium + firefox + webkit + system deps (libnss/libgbm/libatk 등) 사전 포함
#   · pptx_generator.py 의 p.chromium.executable_path 자동 인식 → 코드 수정 0
#
# 운영 코드 무수정: main.py / proposal_multi_pass.py / pptx_generator.py /
#                  rag_*.py / rag_kb.db / requirements*.txt 모두 그대로.
# ============================================================================

FROM mcr.microsoft.com/playwright/python:v1.60.0-noble

# ── 1. 시스템 의존성 (LibreOffice + 한글 폰트) ─────────────────────────
# Playwright 이미지에 LibreOffice·한글 폰트는 없음 → apt 로 추가 설치.
# fonts-noto-cjk / fonts-nanum = nixpacks 의 noto-fonts-cjk-sans / nanum 1:1 대체.
# coreutils 는 베이스에 있지만 명시 (nixpacks 와 정합).
# DEBIAN_FRONTEND=noninteractive = apt 가 prompt 없이 진행.
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice \
        fontconfig \
        fonts-noto-cjk \
        fonts-nanum \
        coreutils && \
    rm -rf /var/lib/apt/lists/*

# ── 2. venv 생성 + 환경변수 ────────────────────────────────────────────
# nixpacks 의 /opt/venv 위치와 일관 유지 (Procfile / railway.toml startCommand 와 정합).
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# ── 3. Python 의존성 설치 (레이어 캐싱 최적화) ─────────────────────────
# requirements*.txt 먼저 COPY → pip install → 그 후 코드 COPY.
# 코드 변경 시 pip install 레이어 캐시 유지 (빌드 시간 단축).
COPY requirements.txt requirements-rag.txt ./
RUN /opt/venv/bin/pip install --upgrade pip && \
    /opt/venv/bin/pip install -r requirements.txt
# RAG 의존성 (옵셔널) — 설치 실패해도 빌드 통과 (rag_retriever 가 graceful skip).
RUN /opt/venv/bin/pip install -r requirements-rag.txt || \
    echo 'RAG deps install failed — RAG 비활성화 모드로 진행'

# ── 4. Paperlogy 폰트 시스템 등록 (LibreOffice 가 PPTX 변환 시 인식) ──
# COPY 가 destination 디렉토리 자동 생성. wildcard 매칭으로 ttf 만 복사.
COPY static/fonts/Paperlogy-*.ttf /usr/share/fonts/truetype/paperlogy/
RUN fc-cache -f

# ── 5. 운영 코드 전체 복사 ────────────────────────────────────────────
# .dockerignore 가 _experiments/, .git/, 백업 DB, __pycache__ 등 제외.
COPY . /app

# ── 6. Playwright chromium — 베이스 이미지 사전 포함 ──────────────────
# 'playwright install chromium' / PLAYWRIGHT_BROWSERS_PATH 설정 불필요.
# Playwright python API 가 /ms-playwright/chromium-XXXX/chrome-linux/chrome 자동 인식.
# pptx_generator.py:2508 의 p.chromium.executable_path 그대로 작동.

# ── 7. 포트 + 시작 ────────────────────────────────────────────────────
# Railway 가 ${PORT} 환경변수 동적 주입 → shell 형식 CMD 필수 (exec 형식이면 무시됨).
# /healthz 엔드포인트 = railway.toml 의 healthcheckPath.
EXPOSE 8000
CMD /opt/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
