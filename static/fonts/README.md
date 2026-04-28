# NightOff 폰트 자체 호스팅

이 폴더에 폰트 파일(.woff2 우선, .otf/.ttf fallback)을 넣으면 자체 호스팅됩니다.
Railway 배포 시에도 정적 자원으로 같이 올라가서 운영 환경에서도 사용 가능.

## 필요한 폰트

### 1. Paperlogy (한국 무료, OFL 라이선스)
- 출처: https://github.com/innovationacademy-kr/Paperlogy
- 거버닝 메시지·헤드라인용
- 다운로드 후 다음 파일 이름으로 이 폴더에 넣기:
  - `Paperlogy-4Regular.woff2`
  - `Paperlogy-7Bold.woff2`
  - `Paperlogy-8ExtraBold.woff2`

### 2. Presentation (한국, 무료/유료 확인 필요)
- 본문용 (제안서 슬라이드 안 본문 텍스트)
- 다운로드 후 다음 파일 이름으로 이 폴더에 넣기:
  - `Presentation-Regular.woff2`
  - `Presentation-Medium.woff2`
  - `Presentation-Bold.woff2`

> Presentation 폰트는 라이선스 확인 후 사용하세요.
> 무료 대체로는 Pretendard 또는 Gowun Dodum 사용 가능 (이미 CDN 로드됨).

## fallback 동작
폰트 파일이 없어도 시스템은 정상 동작합니다 — CDN 의 Paperlogy + Gowun Dodum +
Pretendard 가 안전망. 자체 호스팅은 옵션.

## 폰트 적용 위치 (style.css)
- `.proposal-page .page-governing` → Paperlogy Bold 28~32pt
- `.proposal-page h1, h2, h3` → Paperlogy Regular 18~20pt
- `.proposal-page p, .proposal-body` → Presentation Regular 14~16pt
