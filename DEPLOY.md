# NightOff — Railway 배포 가이드

## 개요
- 기본 서버: FastAPI + Uvicorn
- DB: `DATABASE_URL` 이 있으면 PostgreSQL, 없으면 로컬 SQLite 파일(`proposal.db`)
- 정적 파일: `/static` 경로로 서빙
- 업로드 파일: `uploads/` (로컬 디스크 — Railway 기본 스토리지는 ephemeral)

## 사전 준비
- Railway 계정: https://railway.app
- GitHub 레포: https://github.com/tinyvaultofficial-ux/nightoff 연결

## 배포 단계

### 1. Railway 프로젝트 생성
1. Railway 대시보드 → **New Project** → **Deploy from GitHub repo**
2. `tinyvaultofficial-ux/nightoff` 선택
3. Railway가 자동으로 `nixpacks.toml` + `requirements.txt` 감지해 빌드

### 2. PostgreSQL 데이터베이스 추가
1. 프로젝트 대시보드 → **New** → **Database** → **Add PostgreSQL**
2. 생성된 PostgreSQL 서비스 클릭 → **Variables** 탭
3. `DATABASE_URL` 복사
4. NightOff 서비스의 **Variables** 탭에서 `DATABASE_URL` 변수 추가
   - 또는 Railway의 **Reference Variables** 기능으로 `${{Postgres.DATABASE_URL}}` 자동 참조

### 3. 환경 변수 설정 (선택)
NightOff 서비스 → **Variables** 탭에서 추가:
- `ANTHROPIC_API_KEY` (사용자가 UI에서 직접 입력 가능 — 생략해도 됨)
- `PORT` — Railway가 자동 주입하므로 건드릴 필요 없음

### 4. 도메인 연결
1. NightOff 서비스 → **Settings** → **Networking** → **Generate Domain**
2. 기본 `*.up.railway.app` 도메인 생성. 커스텀 도메인도 연결 가능.

### 5. 배포
- `main` 브랜치에 push → Railway가 자동 배포
- 로그는 Railway 대시보드의 **Deployments** 탭에서 실시간 확인

## 로컬 개발
```bash
# SQLite 로컬 모드 — DATABASE_URL 없이 실행
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## PostgreSQL 로컬 테스트 (선택)
```bash
docker run -d --name ng-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
export DATABASE_URL="postgresql://postgres:dev@localhost:5432/postgres"
python -m uvicorn main:app --reload --port 8000
```

## 제약 사항

### Ephemeral Filesystem
Railway의 기본 스토리지는 재배포/재시작 시 초기화됩니다.
`uploads/` 에 저장된 RFP·레퍼런스 파일은 재배포 후 사라집니다.

**영구 저장이 필요하면:**
1. Railway **Volumes** 기능 활성화 (유료) — `/app/uploads` 경로 마운트
2. 또는 S3/R2/Cloudinary 같은 외부 스토리지로 이전 (코드 수정 필요)

### API 키 관리
API 키는 `settings` 테이블에 저장됩니다.
- 배포 환경: 최초 접속 후 좌하단 설정 아이콘에서 직접 입력
- 또는 `ANTHROPIC_API_KEY` 환경 변수로 지정 (DB 저장보다 우선)

## 스키마 자동 마이그레이션
`main.py` 의 `init_db()` 는 서버 시작 시 호출되어:
- PG에서 미존재 테이블은 자동 생성
- 기존 테이블은 `CREATE TABLE IF NOT EXISTS` 로 유지
- `conversations.outcome` 같은 추가 컬럼은 `ALTER TABLE` 로 자동 추가
- 구 `rfp_docs` → 신 `rfp_files` 마이그레이션도 자동 수행
