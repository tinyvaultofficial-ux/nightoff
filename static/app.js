// NightOff — SPA client
// Router + views + streaming chat + proposal renderer

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v != null) el.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
};

// ---------- Icons (lucide SVG paths) ----------
const ICO = {
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M15 3.13a4 4 0 0 1 0 7.75"/>`,
  folder: `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  plus: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  msg: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  activity: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`,
  trending: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
  file: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
  fileSearch: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="10.5" cy="14.5" r="2.5"/><line x1="12.5" y1="16.5" x2="14.5" y2="18.5"/>`,
  upload: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`,
  building: `<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  chevronR: `<polyline points="9 18 15 12 9 6"/>`,
  chevronD: `<polyline points="6 9 12 15 18 9"/>`,
  arrowL: `<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>`,
  edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>`,
  trash: `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  brain: `<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>`,
  send: `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`,
  paperclip: `<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>`,
  x: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  search: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  check: `<polyline points="20 6 9 17 4 12"/>`,
  alert: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  printer: `<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>`,
  save: `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>`,
  eye: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  logout: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
};

// "야근 OFF · 퇴근 동료" 시그니처 일러스트 — 빈 상태 / 성공 모먼트에 사용
const SVG_ILLUST = {
  // 노을 + 책상 (빈 발주처 목록 / 시작 모먼트)
  sunset: `<svg viewBox="0 0 240 160" width="240" height="160" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sunsetSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFCB77"/>
        <stop offset="60%" stop-color="#FF8E5C"/>
        <stop offset="100%" stop-color="#FFB4A2"/>
      </linearGradient>
      <linearGradient id="sunsetGround" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E9D5B7"/>
        <stop offset="100%" stop-color="#FAF8F5"/>
      </linearGradient>
    </defs>
    <!-- 하늘 -->
    <rect x="0" y="0" width="240" height="100" fill="url(#sunsetSky)" rx="12"/>
    <!-- 해 -->
    <circle cx="180" cy="70" r="22" fill="#fff" opacity="0.95"/>
    <circle cx="180" cy="70" r="22" fill="#FFEEE0" opacity="0.6"/>
    <!-- 산 실루엣 -->
    <path d="M 0 100 L 50 70 L 90 90 L 130 60 L 180 95 L 240 80 L 240 100 Z" fill="#6B46E5" opacity="0.55"/>
    <!-- 지면 -->
    <rect x="0" y="100" width="240" height="60" fill="url(#sunsetGround)"/>
    <!-- 책상 + 노트북 (퇴근 직전 책상) -->
    <rect x="80" y="118" width="80" height="3" rx="1.5" fill="#3C342B" opacity="0.85"/>
    <rect x="100" y="105" width="40" height="14" rx="2" fill="#fff" stroke="#3C342B" stroke-width="1.5" opacity="0.95"/>
    <rect x="103" y="108" width="34" height="8" rx="1" fill="#6B46E5" opacity="0.2"/>
    <!-- 커피잔 -->
    <rect x="155" y="111" width="9" height="8" rx="1" fill="#fff" stroke="#3C342B" stroke-width="1"/>
    <path d="M 164 113 q 4 0 4 3" stroke="#3C342B" stroke-width="1" fill="none"/>
    <!-- 김 -->
    <path d="M 158 108 q 1 -2 0 -4 q 1 -2 0 -4" stroke="#A89E91" stroke-width="1" fill="none" opacity="0.7"/>
  </svg>`,

  // 집 (성공 모먼트 / 완성 후)
  home: `<svg viewBox="0 0 240 160" width="240" height="160" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="homeSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFE8DA"/>
        <stop offset="100%" stop-color="#FAF8F5"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="240" height="160" fill="url(#homeSky)" rx="12"/>
    <!-- 별 -->
    <circle cx="40" cy="30" r="2" fill="#FFCB77"/>
    <circle cx="200" cy="40" r="1.5" fill="#FF8E5C"/>
    <circle cx="180" cy="20" r="1" fill="#FFCB77"/>
    <!-- 집 -->
    <path d="M 80 90 L 120 60 L 160 90 L 160 130 L 80 130 Z" fill="#fff" stroke="#3C342B" stroke-width="1.8"/>
    <path d="M 75 92 L 120 56 L 165 92" stroke="#FF8E5C" stroke-width="2" fill="none"/>
    <!-- 굴뚝 -->
    <rect x="135" y="62" width="8" height="14" fill="#3C342B" opacity="0.85"/>
    <!-- 창 -->
    <rect x="92" y="100" width="20" height="20" rx="2" fill="#FFCB77"/>
    <line x1="102" y1="100" x2="102" y2="120" stroke="#3C342B" stroke-width="1"/>
    <line x1="92" y1="110" x2="112" y2="110" stroke="#3C342B" stroke-width="1"/>
    <!-- 문 -->
    <rect x="128" y="105" width="16" height="25" rx="1" fill="#6B46E5" opacity="0.85"/>
    <circle cx="141" cy="118" r="1" fill="#FFCB77"/>
    <!-- 길 -->
    <path d="M 100 130 Q 120 145 140 130" stroke="#3C342B" stroke-width="1" stroke-dasharray="3 3" fill="none" opacity="0.4"/>
  </svg>`,

  // 시계 (마감 / 진행중)
  clock: `<svg viewBox="0 0 240 160" width="240" height="160" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="clockBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFF3DD"/>
        <stop offset="100%" stop-color="#FAF8F5"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="240" height="160" fill="url(#clockBg)" rx="12"/>
    <!-- 시계 본체 -->
    <circle cx="120" cy="80" r="48" fill="#fff" stroke="#3C342B" stroke-width="2.5"/>
    <!-- 5:30 표시 (퇴근 시간) -->
    <line x1="120" y1="80" x2="120" y2="48" stroke="#3C342B" stroke-width="3" stroke-linecap="round"/>
    <line x1="120" y1="80" x2="143" y2="92" stroke="#FF8E5C" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="120" cy="80" r="4" fill="#3C342B"/>
    <!-- 12 / 3 / 6 / 9 표시 -->
    <text x="120" y="58" text-anchor="middle" font-size="9" font-weight="700" fill="#3C342B">12</text>
    <text x="158" y="84" text-anchor="middle" font-size="9" font-weight="700" fill="#3C342B">3</text>
    <text x="120" y="110" text-anchor="middle" font-size="9" font-weight="700" fill="#3C342B">6</text>
    <text x="82" y="84" text-anchor="middle" font-size="9" font-weight="700" fill="#3C342B">9</text>
    <!-- 알람 종 (양옆) -->
    <path d="M 78 38 L 88 48" stroke="#3C342B" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 162 38 L 152 48" stroke="#3C342B" stroke-width="2.5" stroke-linecap="round"/>
    <!-- '퇴근!' 말풍선 -->
    <rect x="160" y="118" width="60" height="22" rx="11" fill="#FF8E5C"/>
    <text x="190" y="133" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">퇴근! 🏡</text>
    <path d="M 168 130 L 162 138 L 175 132 Z" fill="#FF8E5C"/>
  </svg>`,
};

function icon(name, size = 18) {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[name] || ""}</svg>`;
  const span = document.createElement("span");
  span.style.display = "inline-flex";
  span.innerHTML = svg;
  return span;
}

// ---------- API ----------
// 중앙 에러 번역 — 네트워크 실패, 서버 JSON 에러, 시간 초과를 친절 메시지로
async function _parseErrorResponse(r) {
  let body;
  try {
    const text = await r.text();
    try { body = JSON.parse(text); } catch { body = { error: text }; }
  } catch { body = {}; }
  let msg = body.error || body.detail || r.statusText || "알 수 없는 오류";
  // FastAPI HTTPException detail 영역 dict 영역 영역 (예: Phase 3 quota 영역 detail).
  // detail = {error, code, quota_remaining, ...} 영역 영역 → 친절 메시지 영역 변환.
  if (msg && typeof msg === "object") {
    const code = msg.code || "";
    if (code === "QUOTA_EXCEEDED") {
      msg = (msg.error || "이달 할당량 소진") + " — 다음 달 1일 리셋";
    } else {
      msg = msg.error || msg.message || JSON.stringify(msg);
    }
  }
  // 이미 친절 메시지면 그대로, 스택트레이스 같으면 일반화
  if (typeof msg === "string" && /Traceback|Exception|at [A-Z]|<!DOCTYPE/i.test(msg)) {
    return `잠시 문제가 생겼어요 (${r.status}). 다시 시도해 주세요.`;
  }
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}

// ---------- Auth — JWT localStorage helpers (묶음 N Commit 5) ----------
const AUTH_TOKEN_KEY = "nightoff_jwt";
// 인증 면제 페이지 — 미가입 방문자가 접근 가능 (랜딩 노출용 / + /landing 포함)
// Spec D-Fix-22 Stage A: "/preview" 추가 — 비회원 둘러보기 모드.
const AUTH_PUBLIC_PAGES = new Set(["/", "/landing", "/login.html", "/register.html", "/preview"]);

function getToken() { return localStorage.getItem(AUTH_TOKEN_KEY) || ""; }
function clearToken() { localStorage.removeItem(AUTH_TOKEN_KEY); }

// 비회원 둘러보기 모드 판별 (Spec D-Fix-22 Stage A)
function isGuestMode() {
  return location.pathname === "/preview" && !getToken();
}

function redirectToLogin(force = false) {
  // force=true: 명시적 로그아웃 등 — 공개 페이지 가드 우회. 디폴트=false (기존 호출처 동작 보존).
  if (!force && AUTH_PUBLIC_PAGES.has(location.pathname)) return;  // 이미 공개 페이지
  location.href = "/login.html";
}

async function _call(method, path, { body, form, signal, timeoutMs = 60000 } = {}) {
  const ctrl = new AbortController();
  const signals = [ctrl.signal];
  if (signal) signals.push(signal);
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  // [디버그 강화] 요청 정보 로깅 — 422 나오면 어느 path 인지 즉시 알 수 있게
  const debugBody = body !== undefined ? JSON.stringify(body) : null;
  try {
    const init = { method, signal: ctrl.signal, headers: {} };
    // JWT Authorization header 자동 추가 (auth endpoints 도 OK — 토큰 있으면 첨부)
    const tok = getToken();
    if (tok) init.headers["Authorization"] = `Bearer ${tok}`;
    if (form) {
      init.body = form;
    } else if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = body ? JSON.stringify(body) : null;
    }
    const r = await fetch(path, init);
    if (!r.ok) {
      // 401 → 토큰 만료/무효 → 로그인 페이지로 redirect
      // 단, /api/auth/login 같은 인증 endpoint 의 401 은 로그인 실패 (UI 가 처리)
      if (r.status === 401 && !path.startsWith("/api/auth/")) {
        clearToken();
        redirectToLogin();
        // redirect 직전이라도 caller 가 throw 받도록 error 진행
      }
      // 영역 응답 영역 영역 영역 — _parseErrorResponse 영역 텍스트 영역 영역 + raw body 영역 추출
      // (Phase 3 quota 영역 err.code 영역 영역 영역 영역 영역).
      const rawText = await r.clone().text();
      let rawBody = null;
      try { rawBody = JSON.parse(rawText); } catch {}
      const msg = await _parseErrorResponse(r);
      console.warn(
        `[API ERROR] ${method} ${path}\n` +
        `  status: ${r.status}\n` +
        `  body sent: ${debugBody}\n` +
        `  msg: ${msg}`
      );
      const err = new Error(msg);
      err.status = r.status;
      err.path = path;
      err.method = method;
      // detail dict 영역 code 영역 → err.code (caller 영역 분기 가능, 예: "QUOTA_EXCEEDED")
      const detail = rawBody && rawBody.detail;
      if (detail && typeof detail === "object" && detail.code) {
        err.code = detail.code;
        err.quotaRemaining = detail.quota_remaining;
      }
      throw err;
    }
    const ct = r.headers.get("content-type") || "";
    return ct.includes("application/json") ? r.json() : r.text();
  } catch (e) {
    if (e.name === "AbortError" || String(e.message).includes("timeout")) {
      throw new Error("응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.");
    }
    if (e instanceof TypeError && /fetch|Failed|Network/i.test(e.message)) {
      throw new Error("서버와 연결할 수 없어요. 네트워크 상태를 확인해 주세요.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const api = {
  get:   (p, opts)       => _call("GET",    p, opts),
  post:  (p, body, opts) => _call("POST",   p, { ...opts, body: body ?? null }),
  patch: (p, body, opts) => _call("PATCH",  p, { ...opts, body }),
  del:   (p, opts)       => _call("DELETE", p, opts),
  upload(path, file, { timeoutMs = 120000 } = {}) {
    const fd = new FormData();
    fd.append("file", file);
    return _call("POST", path, { form: fd, timeoutMs });
  },
};

// ─── Phase 4 (Step 3) — quota UI 실시간 갱신 helper ─────────────────────────
// 차감 후 페이지 새로고침 X — window.__nightoff_user.quota 직접 mutate + DOM 갱신.
// 페이지 기반 크레딧 시스템 (1페이지 = 100 크레딧, 월 25,000 크레딧 = 약 250페이지).
// 대화는 무제한 — UI 에 "무제한 ∞" 라벨만, 차감 없음.
//
// args:
//   kind: "proposal" (제안서 차감) | "all" (전체 다시 그리기)
//   pages: kind="proposal" 일 때 차감할 페이지 수 (1 페이지 = 100 크레딧 차감)
const CREDITS_PER_PAGE = 100;  // Step 2-A: 단위 단순화 (1p = 100 크레딧)
function refreshQuotaUI(kind, pages) {
  const u = window.__nightoff_user;
  if (!u || !u.quota) return;
  const q = u.quota;

  // 제안서 차감 (페이지 × 100 크레딧). underflow 시 0 클램프.
  if (kind === "proposal" && typeof pages === "number" && pages > 0) {
    q.proposal_remaining = Math.max(0, q.proposal_remaining - (pages * CREDITS_PER_PAGE));
  }

  // 사이드바 표시 갱신 — 제안서 row 만 (대화 항목 사용자 노출 X).
  const propPagesNow = Math.floor((q.proposal_remaining || 0) / CREDITS_PER_PAGE);
  const propVal = document.getElementById("sidebar-proposal-quota");
  if (propVal) {
    propVal.textContent =
      `${(q.proposal_remaining).toLocaleString("ko-KR")} / ${(q.proposal_total).toLocaleString("ko-KR")} (≈${propPagesNow}p)`;
  }
  // 사이드바 row 의 quota-empty 클래스 (제안서 크레딧 < 1페이지 분 = 400 미만이면 강조)
  const propRow = document.getElementById("sidebar-proposal-row");
  if (propRow) propRow.classList.toggle("quota-empty", q.proposal_remaining < CREDITS_PER_PAGE);

  // ✨ 제안서 버튼 — badge + disabled
  const propBtn = document.getElementById("sparkle-generate-btn");
  const propBadge = document.getElementById("proposal-quota-badge");
  if (propBadge) {
    propBadge.textContent = `${propPagesNow}p`;
    propBadge.classList.toggle("quota-exhausted", q.proposal_remaining < CREDITS_PER_PAGE);
  }
  if (propBtn) {
    const exhausted = q.proposal_remaining < CREDITS_PER_PAGE;
    propBtn.classList.toggle("btn-quota-disabled", exhausted);
    if (exhausted) {
      propBtn.setAttribute("disabled", "");
      propBtn.setAttribute("title", "제안서 크레딧이 1페이지(100) 미만이에요 — 다음 달 1일 리셋");
    } else {
      propBtn.removeAttribute("disabled");
      propBtn.setAttribute(
        "title",
        `남은 크레딧: ${(q.proposal_remaining).toLocaleString("ko-KR")} (≈${propPagesNow}페이지)`
      );
    }
  }

  // 대화 textarea — 무제한이라 항상 enable + 기본 안내
  const ta = document.getElementById("message-input");
  if (ta) {
    ta.disabled = false;
    ta.placeholder = "메시지를 입력하세요… (Shift+Enter 줄바꿈, Enter 전송)";
  }
}

// 프론트 언핸들드 에러 — 콘솔에 남기고 사용자에겐 토스트
window.addEventListener("error", (e) => {
  console.error("[error]", e.message, e.filename, e.lineno);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
});

// ---------- Toast ----------
function toast(msg, kind = "", duration = 2800) {
  const el = h("div", { class: `toast ${kind}` }, msg);
  $("#toast-root").appendChild(el);
  setTimeout(() => el.remove(), duration);
}

const WITTY_LINES = [
  "밤새지 말자고 만들었습니다",
  "RFP 복붙이 너무 많다…",
  "개찰결과 뜨면 대표자 이름부터 확인하시죠?",
  "애매하게 썼으면 전화는 잘 받아주세요, 공뭔님들",
];

// 로딩 오버레이 — 중앙 카드 + 배경 투명(클릭만 차단) + 실무 단계만 회전 (위트문구 삭제)
function showFullscreenLoader(steps) {
  document.querySelectorAll(".fs-loader-backdrop").forEach((el) => el.remove());

  const safeSteps = (steps && steps.length) ? steps : [{ emoji: "✨", text: "잠시만요…" }];
  // backdrop = 클릭/스크롤 차단용 투명 레이어. 어두운 필터 X.
  const backdrop = h("div", { class: "fs-loader-backdrop fs-loader-clear" });
  const messageEl = h("div", { class: "fs-message-text" }, `${safeSteps[0].emoji} ${safeSteps[0].text}`);
  const content = h("div", { class: "fs-loader-content fs-loader-card" }, [
    h("div", { class: "fs-spinner" }),
    messageEl,
  ]);
  backdrop.appendChild(content);
  backdrop.addEventListener("click", (e) => e.stopPropagation());
  backdrop.addEventListener("mousedown", (e) => e.preventDefault());
  // wheel + touchmove 도 막아서 스크롤 차단
  backdrop.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  backdrop.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  document.body.appendChild(backdrop);
  document.body.classList.add("fs-loader-active");

  // 실무 단계만 회전 (위트 문구 제거 — 신뢰감 우선)
  let stepIdx = 0;
  const rotate = () => {
    if (safeSteps.length <= 1) return;
    messageEl.classList.add("fade-out");
    setTimeout(() => {
      stepIdx = (stepIdx + 1) % safeSteps.length;
      messageEl.textContent = `${safeSteps[stepIdx].emoji} ${safeSteps[stepIdx].text}`;
      messageEl.classList.remove("fade-out");
    }, 280);
  };
  const timer = setInterval(rotate, 2400);

  let closed = false;
  const handle = {
    setStep(emoji, text) {
      messageEl.classList.add("fade-out");
      setTimeout(() => {
        messageEl.textContent = `${emoji} ${text}`;
        messageEl.classList.remove("fade-out");
      }, 220);
    },
    finish(emoji = "✅", text = "완료!", delayMs = 700) {
      if (closed) return;
      clearInterval(timer);
      messageEl.classList.remove("fade-out");
      messageEl.textContent = `${emoji} ${text}`;
      setTimeout(() => handle.stop(), delayMs);
    },
    stop() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      backdrop.classList.add("closing");
      setTimeout(() => {
        backdrop.remove();
        if (!document.querySelector(".fs-loader-backdrop")) {
          document.body.classList.remove("fs-loader-active");
        }
      }, 240);
    },
  };
  return handle;
}

const LOADER_STEPS = {
  rfp: [
    { emoji: "👀", text: "RFP 꼼꼼히 읽고 있어요" },
    { emoji: "📋", text: "과업 내용 정리 중이에요" },
    { emoji: "📊", text: "평가 기준 파악 중이에요" },
    { emoji: "🔍", text: "발주처 정보 찾아오는 중이에요" },
  ],
  reference: [
    { emoji: "📂", text: "파일 읽고 있어요" },
    { emoji: "🧠", text: "내용 분석 중이에요" },
  ],
  proposal: [
    { emoji: "📋", text: "요구사항 확인 중이에요" },
    { emoji: "✍️", text: "목차 잡고 있어요" },
    { emoji: "🚀", text: "제안서 작성 중이에요" },
  ],
  search: [
    { emoji: "🌐", text: "웹에서 정보 찾고 있어요" },
  ],
};

// ---------- Router ----------
const routes = [
  { re: /^\/$/, handler: renderRootRoute },
  { re: /^\/landing$/, handler: renderLanding },
  // Spec D-Fix-22 Stage A: 비회원 둘러보기 모드
  { re: /^\/preview$/, handler: renderGuestDashboard },
  { re: /^\/client\/guest-(\d+)$/, handler: async (m) => {
    // 가짜 과업 클릭 — URL 을 /preview 로 복귀 후 견본 모달 노출
    const idx = parseInt(m[1], 10) - 1;
    history.replaceState({}, "", "/preview");
    await renderGuestDashboard();
    const sample = (typeof SAMPLE_POOL !== "undefined" && SAMPLE_POOL[idx]) ? SAMPLE_POOL[idx] : null;
    if (sample && typeof openSampleModal === "function") openSampleModal(sample);
  }},
  { re: /^\/dashboard$/, handler: renderDashboard },
  { re: /^\/client\/new$/, handler: () => renderClientForm("create") },
  { re: /^\/client\/([^/]+)\/edit$/, handler: (m) => renderClientForm("edit", m[1]) },
  { re: /^\/client\/([^/]+)\/chat\/([^/]+)$/, handler: (m) => renderChat(m[1], m[2]) },
  { re: /^\/client\/([^/]+)$/, handler: (m) => renderClientDetail(m[1]) },
];

function navigate(path) {
  history.pushState({}, "", path);
  route();
}
function route() {
  const path = location.pathname;
  // 우측 패널 (right-panel-off) 토글은 Spec 5 (5/16) 폐기 — 우측 사이드바 자체 제거됨.
  // 랜딩 페이지 이전 상태도 초기화 (랜딩 진입 시 다시 추가됨)
  document.body.classList.remove("landing-fullscreen");
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      r.handler(m);
      return;
    }
  }
  renderRootRoute();
}

// 루트("/") 진입 시 — 랜딩을 본 적 있는 사용자는 바로 대시보드, 아니면 랜딩
function renderRootRoute() {
  const seen = localStorage.getItem("nightoff.landing_seen") === "1";
  if (seen) return renderDashboard();
  return renderLanding();
}
window.addEventListener("popstate", route);
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a) {
    e.preventDefault();
    navigate(a.getAttribute("href"));
  }
});

// ---------- Sidebar ----------
// 일반 SaaS 패턴 정합 (Linear / Notion / Vercel 등):
//   상단 = 로고 (홈 복귀)
//   상단 액션 = "+ 새 과업" 버튼 (항상 노출)
//   📊 Stats 영역 = 한 줄 1개 (4줄, 작은 폰트)
//   본문 = 과업 목록 (스크롤, URL 매칭 = 보라 액센트)
//   하단 = 설정 / 로그아웃
//
// 데이터 영역: caller 가 미리 fetch 해서 넘기면 재요청 X (renderDashboard 등).
// 미전달 시 자체 fetch (renderClientDetail / renderChat / renderClientForm 호출 케이스).
async function renderSidebar(active = "clients", currentClientId = null, preloadedClients = null, preloadedStats = null) {
  let clients = preloadedClients;
  if (!Array.isArray(clients)) {
    try { clients = await api.get("/api/clients"); } catch { clients = []; }
  }
  let stats = preloadedStats;
  if (!stats || typeof stats !== "object") {
    try { stats = await api.get("/api/stats"); } catch { stats = {}; }
  }
  // Stats 4줄 영역 — 사이드바 작은 텍스트 영역 (한 줄 1개, 라벨/값 분리)
  const winRate = (stats.win_rate === null || stats.win_rate === undefined) ? "—" : `${stats.win_rate}%`;
  const winLossLabel = `${stats.wins ?? 0}승 ${stats.losses ?? 0}패`;
  const statsRows = [
    { label: "등록한 과업", value: `${stats.total_clients ?? 0}개` },
    { label: "작성한 제안서", value: `${stats.total_proposals ?? 0}건` },
    { label: "이번 달 활동", value: `${stats.month_activity ?? 0}회` },
    { label: `수주율 (${winLossLabel})`, value: winRate },
  ];

  const tasksListEl = h("div", { class: "sidebar-tasks-list" });
  if (!clients.length) {
    tasksListEl.appendChild(h("p", { class: "sidebar-tasks-empty" }, "아직 과업이 없어요 🌙"));
  } else {
    clients.forEach((c) => {
      const dday = calcDday(c.deadline);
      const isActive = currentClientId === c.id;
      const children = [
        h("span", { class: "sidebar-task-name", title: c.name || "과업" }, c.name || "과업"),
      ];
      if (dday !== null && dday !== undefined) {
        const urgent = dday >= 0 && dday <= 2;
        const past = dday < 0;
        const label = past ? "마감" : (dday === 0 ? "D-day" : `D-${dday}`);
        children.push(h("span", {
          class: "sidebar-task-dday" + (urgent ? " urgent" : "") + (past ? " past" : ""),
        }, label));
      }
      tasksListEl.appendChild(h("button", {
        class: "sidebar-task-item" + (isActive ? " active" : ""),
        onclick: () => navigate(`/client/${c.id}`),
        title: c.name || "",
      }, children));
    });
  }

  const side = h("aside", { class: "sidebar" }, [
    // 상단 — 로고 (홈 복귀)
    h("div", { class: "sidebar-logo", role: "button", tabindex: "0", title: "메인으로", onclick: () => navigate("/"), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/"); } } }, [
      h("img", { class: "sidebar-logo-img", src: "/static/logo.png", alt: "NightOff" }),
    ]),
    // 상단 액션 — "+ 새 과업" (항상 노출, Spec D-Fix-22 Stage B 비회원 분기)
    h("div", { class: "sidebar-top-actions" }, [
      h("button", {
        class: "sidebar-new-task-btn",
        onclick: () => {
          if (isGuestMode()) {
            showSignupRequiredModal({ message: "새 과업은 회원가입 후 만들 수 있어요." });
            return;
          }
          navigate("/client/new");
        },
        html: `${iconHtml("plus", 16)}<span>새 과업</span>`,
      }),
    ]),
    // 📊 Stats 영역 — 4줄, 사이드바 안 작은 텍스트 영역 (메인에서 이동됨)
    h("div", { class: "sidebar-stats" },
      statsRows.map((s) => h("div", { class: "sidebar-stats-row" }, [
        h("span", { class: "sidebar-stats-label" }, s.label),
        h("span", { class: "sidebar-stats-value" }, s.value),
      ]))
    ),
    // 본문 — 과업 목록 (스크롤)
    h("nav", { class: "sidebar-nav" }, [tasksListEl]),
    // 하단 — 사용자 정보 / 설정 / 로그아웃
    // Spec D-Fix-22 Stage B: 비회원이면 둘러보기 라벨 + 로그인/회원가입 버튼만 노출.
    h("div", { class: "sidebar-footer" }, isGuestMode() ? [
      h("div", { class: "sidebar-footer-guest-label" }, [
        h("span", { class: "sidebar-footer-guest-emoji" }, "👀"),
        h("span", {}, "둘러보기 모드"),
      ]),
      h("div", { class: "sidebar-footer-guest-cta" }, [
        h("button", {
          class: "btn btn-ghost btn-sm",
          onclick: () => location.href = "/login.html",
        }, "로그인"),
        h("button", {
          class: "btn btn-primary btn-sm",
          onclick: () => location.href = "/register.html",
        }, "회원가입"),
      ]),
    ] : [
      // 사용자 정보 한 줄 — 정적 (클릭/hover X). __nightoff_user 미캐시 시 숨김 (방어적).
      ...((window.__nightoff_user && window.__nightoff_user.email) ? [
        h("div", {
          class: "sidebar-footer-user",
          title: window.__nightoff_user.email,
        }, [
          h("span", { class: "sidebar-footer-user-icon", html: iconHtml("user", 14) }),
          h("span", { class: "sidebar-footer-user-email" }, window.__nightoff_user.email),
        ]),
      ] : []),
      // Phase 4 (Step 3) — 페이지 기반 크레딧 표시. 1 페이지 = 100 크레딧.
      // 대화 quota 항목은 사용자에게 노출 X (메시지 무제한 — 내부 정책, 마케팅 금지).
      // id 그대로 유지 → refreshQuotaUI() 가 동적 갱신.
      ...((window.__nightoff_user && window.__nightoff_user.quota) ? [
        (function () {
          const q = window.__nightoff_user.quota;
          // CREDITS_PER_PAGE (L284 module-level 정의, Step 2-A: 1p = 100 크레딧) 활용
          const propPagesNow = Math.floor((q.proposal_remaining || 0) / CREDITS_PER_PAGE);
          const propLow = q.proposal_remaining < CREDITS_PER_PAGE;

          const children = [
            h("div", {
              id: "sidebar-proposal-row",
              class: "quota-row" + (propLow ? " quota-empty" : ""),
            }, [
              h("span", { class: "quota-label" }, "📋 제안서"),
              h("span", { id: "sidebar-proposal-quota", class: "quota-value",
                title: `${(q.proposal_remaining).toLocaleString("ko-KR")} ÷ 400 = ${propPagesNow}페이지` },
                `${(q.proposal_remaining).toLocaleString("ko-KR")} / ${(q.proposal_total).toLocaleString("ko-KR")} (≈${propPagesNow}p)`),
            ]),
          ];

          return h("div", {
            id: "sidebar-quota-wrap",
            class: "sidebar-footer-quota",
            title: "이달 사용 현황 (다음 달 1일 리셋)",
          }, children);
        })(),
      ] : []),
      // Spec D-Fix-10 (5/19) — 어드민/일반 분기:
      //   어드민 (role==="admin") → 기존 설정 모달 (openSettings, settings-modal)
      //   일반 사용자             → 마이페이지 링크 (/account.html, frontend role 첫 사용 사례)
      // 본 fix 없으면 일반 사용자는 설정 버튼 클릭해도 /api/settings 403 → 모달 안 뜸 → 회원 탈퇴 진입 영역 막힘.
      (function () {
        const u = window.__nightoff_user || {};
        const isAdmin = u.role === "admin";
        if (isAdmin) {
          return h("button", {
            class: "sidebar-footer-btn",
            onclick: () => { if (typeof openSettings === "function") openSettings(); },
            title: "설정",
          }, [
            h("span", { class: "sidebar-footer-btn-icon", html: iconHtml("settings", 16) }),
            h("span", {}, "설정"),
          ]);
        }
        // Spec D-Fix-22 Stage B: 비회원이면 회원가입 유도 모달 (a → button 변경).
        return h("button", {
          class: "sidebar-footer-btn",
          title: "마이페이지",
          onclick: () => {
            if (isGuestMode()) {
              showSignupRequiredModal({ message: "마이페이지는 회원가입 후 사용할 수 있어요." });
              return;
            }
            location.href = "/account.html";
          },
        }, [
          h("span", { class: "sidebar-footer-btn-icon", html: iconHtml("user", 16) }),
          h("span", {}, "마이페이지"),
        ]);
      })(),
      h("button", {
        class: "sidebar-footer-btn sidebar-footer-btn-logout",
        onclick: () => {
          clearToken();
          toast("로그아웃 되었습니다", "ok", 1500);
          setTimeout(() => redirectToLogin(true), 400);
        },
        title: "로그아웃",
      }, [
        h("span", { class: "sidebar-footer-btn-icon", html: iconHtml("logout", 16) }),
        h("span", {}, "로그아웃"),
      ]),
    ]),
  ]);
  // 'active' 인자는 향후 다른 메뉴 추가 대비 (현재는 과업 목록 단일).
  void active;
  return side;
}
function iconHtml(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO[name] || ""}</svg>`;
}

// ---------- Utilities ----------
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(s) {
  if (!s) return "-";
  return s.replace("T", " ").split(".")[0].replace(/-/g, ".");
}
function fmtSize(bytes) {
  const u = ["B","KB","MB","GB"]; let i = 0;
  while (bytes >= 1024 && i < 3) { bytes /= 1024; i++; }
  return `${bytes.toFixed(i ? 1 : 0)}${u[i]}`;
}

// ---------- Landing Page (첫 진입 시) ----------
function renderLanding() {
  const root = $("#app-root");
  if (!root) return;
  root.innerHTML = "";
  // 사이드바 없는 풀스크린 랜딩 — 우측 패널/햄버거/푸터 모두 숨김
  root.classList.add("landing-active");
  document.body.classList.add("landing-fullscreen");

  const wrap = h("div", { class: "landing-wrap" });
  root.appendChild(wrap);

  // ── Top Nav (인증 상태에 따라 동적)
  const _isAuthed = !!getToken();
  wrap.appendChild(h("nav", { class: "landing-nav" }, [
    h("div", { class: "landing-nav-inner" }, [
      h("img", { class: "landing-logo", src: "/static/logo.png", alt: "NightOff" }),
      h("button", {
        class: "btn btn-ghost",
        onclick: () => {
          if (_isAuthed) {
            localStorage.setItem("nightoff.landing_seen", "1");
            root.classList.remove("landing-active");
            navigate("/dashboard");
          } else {
            location.href = "/login.html";
          }
        },
      }, _isAuthed ? "대시보드 →" : "로그인"),
    ]),
  ]));

  // ── Hero
  wrap.appendChild(h("section", { class: "landing-hero" }, [
    h("div", { class: "landing-hero-inner" }, [
      h("img", { class: "landing-hero-logo", src: "/static/logo.png", alt: "NightOff" }),
      h("h1", { class: "landing-hero-title" }, "밤새지 말자고 만들었습니다"),
      h("p", { class: "landing-hero-sub" },
        "기획자가 만든, 기획자만을 위한 제안서 AI"),
      // Spec D-Fix-27 Stage A: Hero [지금 시작하기 ✨] 제거 — 사용자 강제 스크롤
      // → 비교 섹션 인지 유도 + sticky CTA Stage B 에서 즉시 가입 진입로 보완
      // [둘러보기] 유지 — 부담 낮은 진입로 (D-Fix-22 Stage A)
      h("div", { class: "landing-hero-cta-group" }, [
        h("button", {
          class: "btn btn-ghost landing-cta-btn landing-cta-btn-secondary",
          onclick: () => navigate("/preview"),
        }, "👀 둘러보기"),
      ]),
    ]),
  ]));

  // ── 비교 섹션 (Spec D-Fix-27 Stage A + Stage B)
  // 다른 LLM 과의 차이점을 랜딩 전면에 박기. "어 같은 RFP 인데 진짜 다르네" 인지 유도.
  // Stage B: 도구 이름 마스킹 처리 + 클로드 → 감마AI 교체 (실제 캡처 매칭).
  const COMPARE_HEADERS = ["젠OOO", "챗OOO", "감OO", "NightOff"];
  const COMPARE_ROWS = [
    { item: "풀 컬러 디자인", values: ["✅", "⚠️", "✅", "❌"],
      nightoffNote: "흑백 초안 (70%)" },
    { item: "구체적 표현", values: ["❌", "❌", "❌", "✅"] },
    { item: "편집 가능한 PPTX", values: ["💰", "❌", "✅", "✅"] },
    { item: "RFP 심층 분석", values: ["⚠️", "❌", "❌", "✅"] },
    { item: "국내 제안서 표준 형식", values: ["❌", "❌", "❌", "✅"] },
    { item: "맞춤형 산출내역서", values: ["❌", "❌", "❌", "✅"] },
    { item: "제안서 자체 검증", values: ["❌", "❌", "❌", "✅"] },
  ];

  wrap.appendChild(h("section", { class: "landing-compare" }, [
    h("div", { class: "landing-compare-inner" }, [
      h("h2", { class: "landing-compare-title" },
        "제안요청서(RFP)를 넣고, 실제 제안서를 뽑아봤어요."),
      h("p", { class: "landing-compare-lead" },
        "AI는 텍스트·구조에 집중하고, 디자이너가 컬러·이미지로 마무리해요."),

      // 캡처 갤러리 — 좌 3 (다른 LLM 모자이크) + 우 1 (NightOff 큰)
      // Stage B: placeholder → 실제 캡처 4장 (도구 이름 마스킹).
      h("div", { class: "landing-compare-gallery" }, [
        h("div", { class: "landing-compare-others" }, [
          h("div", { class: "lc-capture lc-capture-small" }, [
            h("div", { class: "lc-capture-label" }, "젠OOO"),
            h("img", {
              src: "/static/img/compare/genspark.png",
              alt: "젠OOO 결과물",
              class: "lc-capture-img",
              loading: "lazy",
            }),
          ]),
          h("div", { class: "lc-capture lc-capture-small" }, [
            h("div", { class: "lc-capture-label" }, "챗OOO"),
            h("img", {
              src: "/static/img/compare/chatgpt.png",
              alt: "챗OOO 결과물",
              class: "lc-capture-img",
              loading: "lazy",
            }),
          ]),
          h("div", { class: "lc-capture lc-capture-small" }, [
            h("div", { class: "lc-capture-label" }, "감OO"),
            h("img", {
              src: "/static/img/compare/gamma.png",
              alt: "감OO 결과물",
              class: "lc-capture-img",
              loading: "lazy",
            }),
          ]),
        ]),
        h("div", { class: "landing-compare-nightoff" }, [
          h("div", { class: "lc-capture lc-capture-large" }, [
            h("div", { class: "lc-capture-label lc-capture-label-strong" }, "NightOff"),
            h("img", {
              src: "/static/img/compare/nightoff.png",
              alt: "NightOff 결과물",
              class: "lc-capture-img",
              loading: "lazy",
            }),
          ]),
        ]),
      ]),

      // 비교 표 — 7 행 × 5 컬럼 (D-Fix-21 가격 표 패턴 정합)
      h("div", { class: "compare-table" }, [
        // 헤더 행
        h("div", { class: "ct-cell ct-header ct-row-label" }, ""),
        ...COMPARE_HEADERS.map((header, i) => h("div", {
          class: `ct-cell ct-header ${i === 3 ? "ct-nightoff ct-nightoff-header" : ""}`,
        }, header)),
        // 본문 행들
        ...COMPARE_ROWS.flatMap(row => [
          h("div", { class: "ct-cell ct-row-label" }, row.item),
          ...row.values.map((v, i) => h("div", {
            class: `ct-cell ${i === 3 ? "ct-nightoff" : ""}`,
          }, [
            h("span", { class: "ct-mark" }, v),
            (i === 3 && row.nightoffNote)
              ? h("span", { class: "ct-note" }, row.nightoffNote)
              : null,
          ].filter(Boolean))),
        ]),
      ]),
    ]),
  ]));

  // ── 신뢰 배지 섹션
  const trustItems = [
    { emoji: "✅", text: "기획자가 만든, 기획자를 위한 도구예요" },
    { emoji: "✅", text: "수백 건의 실제 수주 제안서를 학습했어요" },
    { emoji: "✅", text: "경쟁입찰 제안의 언어를 알아요" },
    { emoji: "✅", text: "RFP 넣으면 바로 시작해요" },
  ];
  wrap.appendChild(h("section", { class: "landing-trust" }, [
    h("div", { class: "landing-trust-inner" }, [
      h("div", { class: "landing-section-eyebrow" }, "WHY NIGHTOFF"),
      h("h2", { class: "landing-section-title" }, "왜 NightOff 인가요?"),
      h("p", { class: "landing-section-lead" }, "기획자의 밤을 지키는 4가지 약속"),
      h("div", { class: "landing-trust-grid" },
        trustItems.map((t) => h("div", { class: "landing-trust-item" }, [
          h("span", { class: "landing-trust-emoji" }, t.emoji),
          h("span", { class: "landing-trust-text" }, t.text),
        ]))
      ),
    ]),
  ]));

  // ── 핵심 기능 3가지
  const features = [
    { emoji: "👀", title: "발주처 들여다보기", desc: "RFP를 넣으면 발주처 정보와 과업 내용을 자동으로 파악해요" },
    { emoji: "📚", title: "고품질 제안서 학습", desc: "수많은 과거 제안서로 학습한 글투·시각화 패턴이 자동 반영돼요" },
    { emoji: "📊", title: "입찰 활동 히스토리", desc: "수주/탈락 결과를 기록하면 나의 입찰 활동을 한눈에 볼 수 있어요" },
  ];
  wrap.appendChild(h("section", { class: "landing-features" }, [
    h("div", { class: "landing-features-inner" }, [
      h("div", { class: "landing-section-eyebrow accent" }, "CORE FEATURES"),
      h("h2", { class: "landing-section-title" }, "핵심 기능 3가지"),
      h("p", { class: "landing-section-lead" }, "RFP 한 장이면, 시작도 마무리도 NightOff 가 도와요"),
      h("div", { class: "landing-features-grid" },
        features.map((f, i) => h("div", { class: "landing-feature-card" }, [
          h("div", { class: "landing-feature-num" }, String(i + 1).padStart(2, "0")),
          h("div", { class: "landing-feature-emoji" }, f.emoji),
          h("h3", { class: "landing-feature-title" }, f.title),
          h("p", { class: "landing-feature-desc" }, f.desc),
        ]))
      ),
    ]),
  ]));

  // ── 가격 (Spec D-Fix-21: 3 티어 비교 표)
  const TIERS = [
    { name: "스타터", en: "Starter", emoji: "🌱",
      promo: "15만원", regular: "20만원", unit: "10만원",
      proposals: "2건", best: false },
    { name: "프로", en: "Pro", emoji: "🚀",
      promo: "36만원", regular: "47.5만원", unit: "9.5만원",
      proposals: "5건", best: true },
    { name: "비즈니스", en: "Business", emoji: "💎",
      promo: "70만원", regular: "90만원", unit: "9만원",
      proposals: "10건", best: false },
  ];
  const FEATURES = [
    { label: "RFP 분석" },
    { label: "산출내역서" },
    { label: "자체 검증" },
    { label: "발주처 분석" },
  ];

  wrap.appendChild(h("section", { class: "landing-pricing" }, [
    h("div", { class: "landing-pricing-inner" }, [
      h("div", { class: "landing-section-eyebrow accent" }, "PRICING"),
      h("h2", { class: "landing-section-title" }, "가격"),
      h("p", { class: "landing-section-lead" }, "🔒 가입 시 1년 가격 락인"),

      h("div", { class: "landing-pricing-table" }, [
        // 헤더 행
        h("div", { class: "pt-cell pt-row-label pt-header" }, ""),
        ...TIERS.map(t => h("div", {
          class: `pt-cell pt-header pt-plan ${t.best ? "pt-best" : ""}`,
        }, [
          t.best ? h("span", { class: "pt-best-badge" }, "BEST") : null,
          h("div", { class: "pt-plan-emoji" }, t.emoji),
          h("h3", { class: "pt-plan-name" }, [
            h("span", { class: "pt-plan-name-ko" }, t.name),
            h("span", { class: "pt-plan-name-en" }, t.en),
          ]),
        ])),

        // 가격 행 (취소선 정가 + 런칭가)
        h("div", { class: "pt-cell pt-row-label" }, "월 요금"),
        ...TIERS.map(t => h("div", { class: `pt-cell ${t.best ? "pt-best" : ""}` }, [
          h("div", { class: "pt-price-row" }, [
            h("s", { class: "pt-price-regular" }, t.regular),
            h("span", { class: "pt-price-promo" }, [
              h("strong", { class: "pt-price-amount" }, t.promo),
              h("span", { class: "pt-price-per" }, "/월"),
            ]),
          ]),
        ])),

        // 사용량 행
        h("div", { class: "pt-cell pt-row-label" }, "월 제안서"),
        ...TIERS.map(t => h("div", { class: `pt-cell ${t.best ? "pt-best" : ""}` }, [
          h("span", { class: "pt-usage-amount" }, t.proposals),
          h("span", { class: "pt-usage-meta" }, "(50매 기준)"),
        ])),

        // 단가 행
        h("div", { class: "pt-cell pt-row-label" }, "제안서 단가"),
        ...TIERS.map(t => h("div", { class: `pt-cell ${t.best ? "pt-best" : ""}` }, [
          h("span", { class: "pt-unit-amount" }, `${t.unit}/건`),
          h("span", { class: "pt-unit-meta" }, "(정가 기준)"),
        ])),

        // 기능 행 4개
        ...FEATURES.flatMap(f => [
          h("div", { class: "pt-cell pt-row-label pt-feature-label" }, f.label),
          ...TIERS.map(t => h("div", {
            class: `pt-cell pt-feature ${t.best ? "pt-best" : ""}`,
          }, "✅")),
        ]),

        // CTA 행
        h("div", { class: "pt-cell pt-row-label" }, ""),
        ...TIERS.map(t => h("div", {
          class: `pt-cell pt-cta-cell ${t.best ? "pt-best" : ""}`,
        }, [
          h("button", {
            class: `btn ${t.best ? "btn-primary" : "btn-ghost"} pt-cta-btn`,
            onclick: showSubscribeComingSoonModal,
          }, "시작하기"),
        ])),
      ]),
    ]),
  ]));

  // ── 푸터 CTA
  wrap.appendChild(h("section", { class: "landing-bottom-cta" }, [
    h("h2", { class: "landing-bottom-title" }, "오늘은 정시 퇴근하실래요? ☕"),
    h("p", { class: "landing-bottom-sub" }, "RFP 한 장이면 충분해요. 함께 시작해봐요."),
    h("button", {
      class: "btn btn-primary landing-cta-btn",
      onclick: () => {
        if (getToken()) {
          localStorage.setItem("nightoff.landing_seen", "1");
          root.classList.remove("landing-active");
          navigate("/dashboard");
        } else {
          location.href = "/register.html";
        }
      },
      html: `<span>지금 시작하기 ✨</span>`,
    }),
  ]));

  // ── 푸터 (Spec D-Fix-20: 사업자 정보 추가)
  wrap.appendChild(h("footer", { class: "landing-footer" }, [
    h("div", { class: "landing-footer-row" }, [
      h("a", { href: "/terms" }, "이용약관"),
      h("span", { class: "lf-sep" }, "·"),
      h("a", { href: "/privacy" }, "개인정보처리방침"),
      h("span", { class: "lf-sep" }, "·"),
      h("a", { href: "mailto:awc@creworth.com" }, "문의하기"),
    ]),
    h("div", { class: "landing-footer-row landing-footer-info" },
      "NightOff by 크리워스 · 대표 이창원 · 사업자번호 806-10-03267"),
    h("div", { class: "landing-footer-row landing-footer-info" },
      "서울시 관악구 조원로33길 30, 400호 · 이메일 awc@creworth.com"),
    h("div", { class: "landing-footer-row landing-footer-tag" },
      "수주를 진심으로 기원합니다 🙏"),
  ]));

  // ── sticky CTA (Spec D-Fix-27 Stage B)
  // Hero [지금 시작하기 ✨] 제거 (Stage A) 보완 — 하단 가로 바로 즉시 가입 진입로.
  wrap.appendChild(h("div", { class: "landing-sticky-cta-spacer" }));   // 푸터 가림 안전망
  wrap.appendChild(h("div", { class: "landing-sticky-cta" }, [
    h("button", {
      class: "landing-sticky-cta-btn",
      onclick: () => {
        if (getToken()) {
          localStorage.setItem("nightoff.landing_seen", "1");
          root.classList.remove("landing-active");
          navigate("/dashboard");
        } else {
          location.href = "/register.html";
        }
      },
      html: `<span>지금 시작하기 ✨</span>`,
    }),
  ]));
}

// ── 채팅 첫 진입 안내 모달 ─────────────────────────────────────────────────
// 모달 패턴 (.beta-notice-* CSS 클래스 재사용 — 채팅 안내 전용 인프라).
// "다시 보지 않기" → POST /api/me/dismiss-chat-intro (계정 단위 영구).
// 꿀팁 클릭 → 채팅 입력창 (textarea) 자동 입력 + 모달 닫기 (전송은 사용자 Enter).
function showChatIntroNotice(taElement) {
  if (document.querySelector(".chat-intro-overlay")) return;

  const TIPS = [
    "이번 과업의 핵심사항은 뭐야?",
    "목차는 어떻게 꾸릴까?",
    "차별화 포인트 3개만 뽑아줘",
  ];

  const close = (dismissForever = false) => {
    if (dismissForever) {
      // 비동기 — 응답 안 기다리고 즉시 닫기 (UX 영역). 실패해도 다음 진입 시 또 노출, 영구 dismissal X.
      api.post("/api/me/dismiss-chat-intro", {}).catch(() => {});
    }
    overlay.classList.add("fade-out");
    setTimeout(() => overlay.remove(), 240);
    document.removeEventListener("keydown", onEsc);
  };

  const overlay = h("div", {
    class: "beta-notice-overlay chat-intro-overlay",
    onclick: (ev) => { if (ev.target === overlay) close(false); },
  });
  const modal = h("div", { class: "beta-notice-modal" });
  overlay.appendChild(modal);

  // 닫기 ✕
  modal.appendChild(h("button", {
    class: "beta-notice-close", "aria-label": "닫기",
    onclick: () => close(false),
  }, "✕"));

  // 헤더
  modal.appendChild(h("h2", { class: "beta-notice-title" }, "💬 NightOff 시작하기"));

  // 섹션 1 — 꿀팁 3개 (클릭 시 채팅 입력창 자동 입력)
  const tipsSection = h("div", { class: "beta-notice-section bn-good" }, [
    h("h3", { class: "beta-notice-section-title" }, "💡 똑똑하게 이용하는 꿀팁"),
    h("p", { class: "beta-notice-paragraph chat-intro-tip-hint" },
      "원하는 꿀팁을 클릭하면 입력창에 자동으로 들어가요. Enter 로 전송!"),
  ]);
  const tipsList = h("div", { class: "chat-intro-tips" });
  TIPS.forEach((tip) => {
    tipsList.appendChild(h("button", {
      class: "chat-intro-tip-btn",
      onclick: () => {
        if (taElement) {
          taElement.value = tip;
          // input 이벤트 트리거 — 자동 높이 + 전송 버튼 활성화
          taElement.dispatchEvent(new Event("input", { bubbles: true }));
          taElement.focus();
        }
        close(false);
      },
    }, tip));
  });
  tipsSection.appendChild(tipsList);
  modal.appendChild(tipsSection);

  // 섹션 2 — 폰트 안내 + 다운로드
  modal.appendChild(h("div", { class: "beta-notice-section bn-soon" }, [
    h("h3", { class: "beta-notice-section-title" }, "🎨 폰트 안내"),
    h("p", { class: "beta-notice-paragraph" },
      "NightOff 가 만드는 제안서는 '페이퍼로지(Paperlogy)' 폰트를 사용해요. PC 에 페이퍼로지가 없으면 다른 폰트로 자동 대체되어 정렬이 살짝 어긋날 수 있어요."),
    h("p", { class: "beta-notice-paragraph" },
      "더 깔끔한 결과물을 보고 싶다면, 무료 폰트인 페이퍼로지를 설치해 주세요."),
    h("a", {
      class: "chat-intro-font-btn",
      href: "/static/fonts/Paperlogy.zip",
      download: "Paperlogy.zip",
      onclick: () => {
        // 다운로드는 진행하되 모달은 닫지 않음 (사용자가 안내 영역 더 볼 수 있게)
      },
    }, "📥 페이퍼로지 다운로드 (.zip)"),
  ]));

  // 액션 버튼
  modal.appendChild(h("div", { class: "beta-notice-actions" }, [
    h("button", {
      class: "beta-notice-btn-secondary",
      onclick: () => close(true),
    }, "다시 보지 않기"),
    h("button", {
      class: "beta-notice-btn-primary",
      onclick: () => close(false),
    }, "확인"),
  ]));

  document.body.appendChild(overlay);
  const onEsc = (e) => { if (e.key === "Escape") close(false); };
  document.addEventListener("keydown", onEsc);
}

// ── 대시보드 첫 진입 안내 모달 (Spec D-Fix-7, 5/18) ────────────────────────
// 1회성 / 계정 단위 영구 dismissed (DB: users.dashboard_intro_dismissed).
// chat-intro 패턴 정확 복제. NightOff 차별화 6가지 + 솔직한 70% 완성도 안내.
async function showDashboardIntroModal() {
  // 1. 상태 체크 (계정 단위 dismissed 영구 저장)
  try {
    const res = await api.get("/api/me/dashboard-intro-status");
    if (res && res.dismissed) return;
  } catch (e) {
    return;  // 에러 시 모달 미노출 (안전)
  }
  // 2. 중복 방지
  if (document.querySelector(".dashboard-intro-backdrop")) return;

  // 3. CTA — dismiss + 닫기
  const onDismiss = async () => {
    try {
      await api.post("/api/me/dismiss-dashboard-intro", {});
    } catch (e) {
      // 에러 시도 모달은 닫기 (UX 흐름 유지)
    }
    backdrop.classList.add("dashboard-intro-fadeout");
    setTimeout(() => backdrop.remove(), 300);
  };

  // 4. 모달 DOM
  const backdrop = h("div", { class: "dashboard-intro-backdrop" }, [
    h("div", { class: "dashboard-intro-modal" }, [
      // 헤더
      h("div", { class: "dashboard-intro-head" }, [
        h("h1", { class: "dashboard-intro-title" }, "👋 NightOff에 오신 걸 환영해요"),
        h("p", { class: "dashboard-intro-subtitle" },
          "NightOff는 우리나라 B2G와 B2B 입찰 제안서를 전문으로 만드는 AI예요."),
        h("p", { class: "dashboard-intro-subtitle" },
          "범용 AI들과는 다른 방식으로 일해요."),
      ]),
      // 본문 (스크롤)
      h("div", { class: "dashboard-intro-body" }, [
        // 차별화 6가지
        h("section", { class: "dashboard-intro-section" }, [
          h("h2", { class: "dashboard-intro-section-title" }, "✨ NightOff가 다른 이유"),
          h("div", { class: "dashboard-intro-item" }, [
            h("h3", { class: "dashboard-intro-item-title" }, "1. 현장 기획자가 직접 만들었어요"),
            h("p", { class: "dashboard-intro-item-desc" },
              "수많은 제안서를 직접 써본 기획자가 설계한 서비스예요. " +
              "평가위원이 어디를 보는지, 발주처가 무엇을 원하는지, " +
              "실제 현장의 감각으로 만들어요."),
          ]),
          h("div", { class: "dashboard-intro-item" }, [
            h("h3", { class: "dashboard-intro-item-title" }, "2. AI 특유의 말투가 없어요"),
            h("p", { class: "dashboard-intro-item-desc" },
              "범용 AI가 쓰는 어색한 번역체나 군더더기 표현을 걷어내고, " +
              "실제 제안서에서 쓰이는 한국어 문체로 만들어요."),
          ]),
          h("div", { class: "dashboard-intro-item" }, [
            h("h3", { class: "dashboard-intro-item-title" }, "3. 일반론이 아닌 우리나라 입찰 시각"),
            h("p", { class: "dashboard-intro-item-desc" },
              "범용 AI는 글로벌 비즈니스 관점에서 제안서를 써요. " +
              "NightOff는 우리나라 평가위원이 보는 관점에서 기획해요. " +
              "RFP를 받으면 평가표 배점부터 분석해서, 어디에 힘을 줘야 하는지 판단해요."),
          ]),
          h("div", { class: "dashboard-intro-item" }, [
            h("h3", { class: "dashboard-intro-item-title" }, "4. 채팅에서 나눈 전략이 제안서에 그대로 담겨요"),
            h("p", { class: "dashboard-intro-item-desc" },
              "\"프로그램 기획 12페이지로 확장해줘\" 같은 합의가 자동 반영돼요. " +
              "단순 자동 생성이 아니라, 같이 만드는 도구예요."),
          ]),
          h("div", { class: "dashboard-intro-item" }, [
            h("h3", { class: "dashboard-intro-item-title" }, "5. 산출내역서 자동 작성"),
            h("p", { class: "dashboard-intro-item-desc" },
              "인력·장비·예산을 제안서 기반으로 즉시 산출해요. 별도로 다시 만들 필요 없어요."),
          ]),
          h("div", { class: "dashboard-intro-item" }, [
            h("h3", { class: "dashboard-intro-item-title" }, "6. 자체 검증으로 평가위원 시각 체크"),
            h("p", { class: "dashboard-intro-item-desc" },
              "낙찰 제외 조항 누락, 배점 균형까지 검토해요."),
          ]),
        ]),
        // 솔직한 부분
        h("section", { class: "dashboard-intro-section dashboard-intro-section--honest" }, [
          h("h2", { class: "dashboard-intro-section-title" },
            "🌙 아직 부족한 점 (NightOff가 나아갈 길이에요)"),
          h("p", { class: "dashboard-intro-honest-lead" },
            "NightOff는 70% 완성도의 초안을 만드는 도구예요."),
          h("ul", { class: "dashboard-intro-honest-list" }, [
            h("li", {}, "디자인은 흑백 기반이고, 도형과 텍스트로 구성되어 있어요."),
            h("li", {}, "일부 페이지는 정렬이 아직 매끄럽지 않아 툭 튀어나가거나 겹쳐보일 수 있어요."),
            h("li", {}, "오류 시 재시도해 주세요."),
          ]),
          h("p", { class: "dashboard-intro-honest-foot" },
            "기획적으로는 자신있지만, 남은 30%는 PPT 디자이너나 " +
            "감각 있는 기획자가 마무리하는 방식으로 설계되어 있어요."),
          h("p", { class: "dashboard-intro-honest-foot" },
            "기획에 쓰던 밤샘 시간을 줄이고, " +
            "디자인 다듬는 시간만 남기는 게 NightOff의 목표예요."),
          h("p", { class: "dashboard-intro-honest-foot" },
            "딥리서치 + 다중 검증 시스템 작동으로 RFP 분석부터 자체 검증까지 " +
            "각 작업당 수 분이 소요됩니다. 정확성과 전문성을 위한 시간이에요."),
        ]),
      ]),
      // CTA
      h("div", { class: "dashboard-intro-cta-bar" }, [
        h("button", {
          class: "dashboard-intro-cta-btn",
          onclick: onDismiss,
        }, "하루 동안 안 보기"),
      ]),
    ]),
  ]);

  document.body.appendChild(backdrop);
}

// ---------- Dashboard ----------
// ── renderHeroBanner (옛 1 메인 + 3 서브 카드) 은 Spec 6 (5/16) 폐기.
//    교체: renderCoreFeatures5 (NightOff 핵심 기능 5 카드, 가운데 강조 영역).
//    Spec 7 (히어로 배너 5 슬라이드 신규, 5 카드 위 영역) 완료 — renderHero5Slides.

// 🌙 히어로 배너 5 슬라이드 (대시보드 최상단) — Spec 7 (5/16)
// 자동 롤링 5초 + 도트 네비 + 호버 일시정지.
// 메모리 안전: document.body.contains(section) 체크 → 페이지 이동 시 자동 cleanup.
const HERO_5_SLIDES = [
  {
    id: "slide-1",
    badge: { label: "국내 최초", emoji: "🔥" },
    title: "국내 최초 B2G / B2B 제안 자동화,",
    titleBrand: "NightOff !!",
    description: "수백 건의 입찰 제안서를 학습한 AI가\nRFP 한 장으로 100페이지 제안서까지 한 번에.\n밤새 야근하던 그 시간, 이제 다른 일에 써요.",
    tone: "purple-blue",
    illustration: "🏆",
    accentDetail: "stars",
    imageUrl: "/static/hero/slide-1-first.png",   // Spec C-6 (5/18): 최초
  },
  {
    id: "slide-2",
    badge: { label: "곧 출시", emoji: "🚧" },
    title: "2D + 3D 디자인 패키지, 곧 출시!",
    titleBrand: null,
    description: "행사장 조감도? 부스 배치도?\n이제 AI가 알아서 그려드려요.\n디자이너 없이도 평가위원이 놀랄 비주얼이 완성됩니다.",
    tone: "pink",
    illustration: "🎨",
    accentDetail: "squares",
    imageUrl: "/static/hero/slide-3-design.png",  // Spec C-6 (5/18): 디자인
  },
  {
    id: "slide-3",
    badge: { label: "곧 출시", emoji: "🚧" },
    title: "발표 전날, AI 평가위원과 모의 PT!",
    titleBrand: null,
    description: "\"이 부분에서 이런 질문이 나올 거예요\"\n\"이 슬라이드는 좀 더 단호하게 설명해주세요\"\n실전 같은 리허설로 자신감을 채워드려요.",
    tone: "amber",
    illustration: "🎤",
    accentDetail: "wave",
    imageUrl: "/static/hero/slide-2-pt.png",      // Spec C-6 (5/18): 발표/PT
  },
  {
    id: "slide-4",
    badge: { label: "곧 출시", emoji: "🚧" },
    title: "우리 회사만의 강점, AI가 찾아드려요",
    titleBrand: null,
    description: "수주 이력만 넣으면 분석 끝.\n\"이 발주처는 이 강점에 약해요\"\n숨겨진 우리만의 차별점을 발견하세요.",
    tone: "green",
    illustration: "📈",
    accentDetail: "chart",
    imageUrl: "/static/hero/slide-5-strength.png", // Spec C-6 (5/18): 강점
  },
  {
    id: "slide-5",
    badge: { label: "곧 출시", emoji: "🚧" },
    title: "발주처 담당자의 취향까지 읽어드려요",
    titleBrand: null,
    description: "RFP가 쌓일수록 AI는 더 똑똑해져요.\n\"이 발주처는 디테일을 좋아해요\"\n\"이번 담당자는 실용성을 봐요\" 같은 인사이트가 늘어납니다.",
    tone: "purple",
    illustration: "👁️",
    accentDetail: "constellation",
    imageUrl: "/static/hero/slide-4-client.png",  // Spec C-6 (5/18): 담당자 취향
  },
];

// 액센트 디테일 SVG (inline) — 5 슬라이드별 다른 영역
function _hero5AccentSvg(kind) {
  switch (kind) {
    case "stars":
      // 별빛 — 작은 원 6개 산점
      return `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="20" cy="22" r="1.6" fill="rgba(255,255,255,0.55)"/>
        <circle cx="55" cy="14" r="2.2" fill="rgba(255,255,255,0.75)"/>
        <circle cx="92" cy="38" r="1.3" fill="rgba(255,255,255,0.4)"/>
        <circle cx="138" cy="20" r="1.8" fill="rgba(255,255,255,0.65)"/>
        <circle cx="172" cy="55" r="2.4" fill="rgba(255,255,255,0.85)"/>
        <circle cx="40" cy="75" r="1.5" fill="rgba(255,255,255,0.5)"/>
      </svg>`;
    case "squares":
      // 사각형 — 회전 사각형 4개
      return `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="20" y="20" width="14" height="14" fill="none" stroke="rgba(212,83,126,0.4)" stroke-width="1.4" transform="rotate(15 27 27)"/>
        <rect x="70" y="55" width="10" height="10" fill="none" stroke="rgba(212,83,126,0.55)" stroke-width="1.4" transform="rotate(-20 75 60)"/>
        <rect x="120" y="18" width="18" height="18" fill="none" stroke="rgba(212,83,126,0.35)" stroke-width="1.4" transform="rotate(25 129 27)"/>
        <rect x="160" y="62" width="12" height="12" fill="none" stroke="rgba(212,83,126,0.5)" stroke-width="1.4" transform="rotate(-10 166 68)"/>
      </svg>`;
    case "wave":
      // 음성파 — 진폭 파형
      return `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M0 60 Q 20 35, 40 60 T 80 60 T 120 60 T 160 60 T 200 60" fill="none" stroke="rgba(239,159,39,0.45)" stroke-width="1.8"/>
        <path d="M0 75 Q 20 55, 40 75 T 80 75 T 120 75 T 160 75 T 200 75" fill="none" stroke="rgba(239,159,39,0.3)" stroke-width="1.4"/>
      </svg>`;
    case "chart":
      // SVG 차트 — 막대 5개 (오름차순)
      return `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="20"  y="68" width="14" height="22" fill="rgba(29,158,117,0.45)" rx="2"/>
        <rect x="50"  y="55" width="14" height="35" fill="rgba(29,158,117,0.55)" rx="2"/>
        <rect x="80"  y="42" width="14" height="48" fill="rgba(29,158,117,0.65)" rx="2"/>
        <rect x="110" y="30" width="14" height="60" fill="rgba(29,158,117,0.75)" rx="2"/>
        <rect x="140" y="18" width="14" height="72" fill="rgba(29,158,117,0.85)" rx="2"/>
        <path d="M27 68 L57 55 L87 42 L117 30 L147 18" fill="none" stroke="rgba(250,199,117,0.6)" stroke-width="1.6" stroke-dasharray="3 3"/>
      </svg>`;
    case "constellation":
      // 별자리 — 별 + 연결선
      return `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <line x1="25" y1="30" x2="60" y2="55" stroke="rgba(155,127,232,0.3)" stroke-width="1"/>
        <line x1="60" y1="55" x2="105" y2="40" stroke="rgba(155,127,232,0.3)" stroke-width="1"/>
        <line x1="105" y1="40" x2="150" y2="68" stroke="rgba(155,127,232,0.3)" stroke-width="1"/>
        <line x1="150" y1="68" x2="178" y2="25" stroke="rgba(155,127,232,0.3)" stroke-width="1"/>
        <circle cx="25"  cy="30" r="2.4" fill="rgba(255,255,255,0.85)"/>
        <circle cx="60"  cy="55" r="2.0" fill="rgba(255,255,255,0.7)"/>
        <circle cx="105" cy="40" r="2.6" fill="rgba(255,255,255,0.9)"/>
        <circle cx="150" cy="68" r="1.8" fill="rgba(255,255,255,0.65)"/>
        <circle cx="178" cy="25" r="2.2" fill="rgba(255,255,255,0.8)"/>
      </svg>`;
    default:
      return "";
  }
}

function renderHero5Slides() {
  const section = h("section", { class: "hero-5" });
  const slideEls = [];
  const dotEls = [];

  // 5 슬라이드 DOM 생성 (absolute stack, 첫 슬라이드 active).
  // Spec C-6 (5/18): imageUrl 영역 안 inline background-image 적용 (5장 각각 다른 이미지).
  HERO_5_SLIDES.forEach((s, i) => {
    const slide = h("div", {
      class: "hero-5-slide" + (i === 0 ? " active" : ""),
      "data-tone": s.tone,
      "data-slide-id": s.id,
      style: s.imageUrl ? `background-image: url('${s.imageUrl}');` : "",
    }, [
      // subtle 그리드 패턴 + radial glow (배경 디테일) — Spec C-6 (5/18) CSS display:none 처리
      h("div", { class: "hero-5-grid-pattern" }),
      h("div", { class: "hero-5-radial-glow" }),
      // 액센트 디테일 (별빛 / 사각형 / 음성파 / 차트 / 별자리)
      h("div", { class: "hero-5-accent-detail", "data-accent": s.accentDetail, html: _hero5AccentSvg(s.accentDetail) }),
      // 좌측 텍스트 영역
      h("div", { class: "hero-5-slide-content" }, [
        h("span", { class: "hero-5-badge" }, [
          h("span", { class: "hero-5-badge-emoji" }, s.badge.emoji),
          h("span", {}, s.badge.label),
        ]),
        h("h2", { class: "hero-5-title" }, [
          document.createTextNode(s.title),
          s.titleBrand ? h("span", { class: "hero-5-title-brand" }, [
            document.createTextNode(" "),
            document.createTextNode(s.titleBrand),
          ]) : null,
        ]),
        h("p", { class: "hero-5-description" }, s.description),
      ]),
      // 우상단 일러스트 카드 — Spec C-6 (5/18) CSS display:none 처리
      h("div", { class: "hero-5-illustration" }, s.illustration),
    ]);
    section.appendChild(slide);
    slideEls.push(slide);
  });

  // 도트 네비 (5 dots, 우측 하단)
  const dotsWrap = h("div", { class: "hero-5-dots" });
  HERO_5_SLIDES.forEach((s, i) => {
    const dot = h("button", {
      class: "hero-5-dot" + (i === 0 ? " active" : ""),
      "aria-label": `슬라이드 ${i + 1}로 이동`,
      type: "button",
    });
    dotsWrap.appendChild(dot);
    dotEls.push(dot);
  });
  section.appendChild(dotsWrap);

  // 상태 — 클로저 영역 (모듈 변수 X)
  let idx = 0;
  let hovered = false;

  function activateSlide(nextIdx) {
    if (nextIdx === idx || nextIdx < 0 || nextIdx >= HERO_5_SLIDES.length) return;
    slideEls[idx].classList.remove("active");
    dotEls[idx].classList.remove("active");
    idx = nextIdx;
    slideEls[idx].classList.add("active");
    dotEls[idx].classList.add("active");
  }

  // 도트 클릭 영역
  dotEls.forEach((dot, i) => {
    dot.addEventListener("click", () => activateSlide(i));
  });

  // 호버 일시정지 영역 (newsWidget 패턴 정합)
  section.addEventListener("mouseenter", () => { hovered = true; });
  section.addEventListener("mouseleave", () => { hovered = false; });

  // 자동 롤링 5초 + 메모리 안전 (document.body.contains 자동 cleanup)
  const timer = setInterval(() => {
    if (!document.body.contains(section)) {
      clearInterval(timer);
      return;
    }
    if (hovered) return;
    activateSlide((idx + 1) % HERO_5_SLIDES.length);
  }, 5000);

  return section;
}

// 🌙 NightOff 핵심 기능 5 카드 (대시보드 최상단) — 가운데 강조 (다크 그라데이션 + 엠버 보더 + 배지)
const CORE_FEATURES_5 = [
  { emoji: "📄", title: "RFP\n자동 분석",         tone: "purple", featured: false },
  { emoji: "👀", title: "발주처\n들여다보기",      tone: "blue",   featured: false },
  { emoji: "✨", title: "제안서 초안\n자동 생성",  tone: "amber",  featured: true  },
  { emoji: "💰", title: "산출내역서\n자동 생성",   tone: "green",  featured: false },
  { emoji: "🔍", title: "자체 제안서\n리뷰",       tone: "pink",   featured: false },
];

function renderCoreFeatures5() {
  const section = h("section", { class: "features-5" });

  // 헤더 — "NightOff 주요 기능 5가지" (Spec 8 (5/16): featured 배지 "⭐ 핵심 기능"과 명확 차별화)
  section.appendChild(h("div", { class: "features-5-header" }, [
    h("h2", { class: "features-5-title" }, "NightOff 주요 기능 5가지"),
    h("p", { class: "features-5-subtitle" }, "RFP 한 장이면, 시작부터 마무리까지 NightOff 가 도와요"),
  ]));

  // 5-열 grid
  const grid = h("div", { class: "features-5-grid" });
  CORE_FEATURES_5.forEach((f) => {
    const card = h("div", {
      class: "feature-5-card" + (f.featured ? " featured" : ""),
      "data-tone": f.tone,
    }, [
      // Spec C-2 (5/18): featured 카드 우상단 "핵심" 작은 배지 (5중 → 2중 강조 영역)
      f.featured ? h("span", { class: "feature-5-card-badge" }, "핵심") : null,
      h("div", { class: "feature-5-card-icon" }, f.emoji),
      h("h4", { class: "feature-5-card-title" }, f.title),
    ]);
    grid.appendChild(card);
  });
  section.appendChild(grid);
  return section;
}

// ===== 산출내역서 (B2G 표준 12 컬럼 양식) =====
// 컬럼: 구분(cat) → 항목 → 소항목 → 산출근거 → 단가 → 수량 → 단위(개체) → 기간 → 단위(주기) → 투입율 → 제출금액 → 비고
// 일반관리비 = 7% (이전 8% → 사용자 결정 변경)
// 투입율 = 분수 영역 (0~1, 인건비 = 0.1/0.3 등 / 외 = 1)
const BUDGET_COLS = [
  { key: "item",         label: "항목",       width: "10%", align: "left" },
  { key: "subitem",      label: "소항목",     width: "8%",  align: "left" },
  { key: "spec",         label: "산출근거",   width: "18%", align: "left" },
  { key: "unit_price",   label: "단가",       width: "9%",  align: "right", num: true },
  { key: "qty",          label: "수량",       width: "5%",  align: "right", num: true },
  { key: "unit",         label: "단위",       width: "5%",  align: "center" },
  { key: "period_qty",   label: "기간",       width: "5%",  align: "right", num: true },
  { key: "period_unit",  label: "단위",       width: "6%",  align: "center" },
  { key: "utilization",  label: "투입율",     width: "6%",  align: "right", num: true, frac: true },
  { key: "amount",       label: "제출금액",   width: "11%", align: "right", num: true, bold: true },
  { key: "note",         label: "비고",       width: "10%", align: "left" },
];

function _n(v) { const n = Number(String(v).replace(/[^\d.-]/g, "")); return isFinite(n) ? n : 0; }
function _fmt(n) { return (Number(n) || 0).toLocaleString("ko-KR"); }

// 기본 투찰율 영역 — 사용자 영역 변경 가능 (90~100%, 0.1 step)
// 기본 투찰율 — B2G 표준 (RFP 예산 대비 청구 비율).
// main.py:DEFAULT_BID_RATE 와 sync. 92-95% 권장 / 안전 영역 82-88% / 적극 영역 96-98%.
const DEFAULT_BID_RATE = 0.95;

function recalcBudget(data) {
  let subtotalSum = 0;
  (data.categories || []).forEach((cat) => {
    cat.subtotal = 0;
    (cat.items || []).forEach((it) => {
      const up = _n(it.unit_price);
      const qty = _n(it.qty);
      const periodQty = _n(it.period_qty);
      let util = _n(it.utilization);
      // 안전 영역: util > 1.5 = 잘못된 % 표기 영역 → 100 으로 나눔
      if (util > 1.5) util = util / 100;
      if (util <= 0) util = 1;
      const periodMult = periodQty > 0 ? periodQty : 1;
      // amount = unit_price × qty × period_qty × utilization
      it.amount = Math.round(up * qty * periodMult * util);
      cat.subtotal += it.amount;
    });
    subtotalSum += cat.subtotal;
  });
  data.subtotal_sum = subtotalSum;
  data.admin_fee   = Math.round(subtotalSum * 0.07);            // 일반관리비 7%
  data.agency_fee  = Math.round((subtotalSum + data.admin_fee) * 0.10);  // 대행료 10%
  data.total       = subtotalSum + data.admin_fee + data.agency_fee;
  data.vat         = Math.round(data.total * 0.10);
  data.grand_total = data.total + data.vat;                     // 총합계 (VAT 포함)
  // 투찰율 적용 — B2G 표준 정합 (RFP 예산 대비 청구 비율).
  // bid_price = budget_limit × bid_rate (RFP 예산 명시 시 직접 계산).
  // RFP 예산 미명시 시 fallback — grand_total × bid_rate (구 흐름 호환).
  // cap 0.82~0.98 — slider 정합 (UI 영역 외 변경 시 fallback).
  if (typeof data.bid_rate !== "number" || data.bid_rate < 0.82 || data.bid_rate > 0.98) {
    data.bid_rate = DEFAULT_BID_RATE;
  }
  // 투찰가 = budget_limit × 투찰율 → 만원 절사 (= 견적금액 / 청구액)
  const budgetLimit = Number(data.budget_limit) || 0;
  if (budgetLimit > 0) {
    data.bid_price = Math.floor(budgetLimit * data.bid_rate / 10000) * 10000;
  } else {
    // fallback — RFP 예산 미명시 시 (예: AI 분석 영역 budget X) 구 흐름 영역 호환
    data.bid_price = Math.floor(data.grand_total * data.bid_rate / 10000) * 10000;
  }
  return data;
}

// ===== 📋 입찰참가자격 카드 (인라인, 발주처 상세 페이지 영역) =====
// 5 카테고리 영역 세로 스택. RFP 분석 카드 직후 별도 카드 영역.
// 데이터 source: GET /api/clients/{cid}/rfp 의 analysis.qualifications 영역.
// (별도 fetch X — RFP 분석 결과 영역 안에 포함)
async function renderQualificationsSection(cid) {
  const rfp = await api.get(`/api/clients/${cid}/rfp`).catch(() => ({ analysis: {} }));
  const quals = (rfp && rfp.analysis && rfp.analysis.qualifications) || null;

  // 자격 데이터 영역 X — RFP 미분석 / 모든 카테고리 빈 영역 = 카드 자체 숨김
  const hasAnyQual = quals && Object.values(quals).some((v) => Array.isArray(v) && v.length > 0);
  if (!hasAnyQual) {
    // 빈 fragment 영역 반환 — renderClientDetail 영역에서 stack 영역에 append 해도 무영향
    return document.createDocumentFragment();
  }

  const SECTIONS = [
    { key: "legal",       label: "법적 자격", icon: "⚖️" },
    { key: "financial",   label: "재무 자격", icon: "💰" },
    { key: "performance", label: "실적 자격", icon: "📊" },
    { key: "personnel",   label: "인력 자격", icon: "👥" },
    { key: "other",       label: "기타", icon: "📝" },
  ];

  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon" }, "📋"),
      h("div", {}, [
        h("h3", { class: "card-title" }, "입찰참가자격"),
        h("p", { class: "card-subtitle" },
          "RFP 분석 결과 영역. 우리 회사가 참여 가능한지 빠르게 확인하세요."),
      ]),
    ]),
  ]));

  const body = h("div", { class: "card-body qual-list" });
  SECTIONS.forEach((sec) => {
    const items = (quals && Array.isArray(quals[sec.key])) ? quals[sec.key] : [];
    const section = h("div", { class: "qual-section" }, [
      h("div", { class: "qual-section-head" }, [
        h("span", { class: "qual-section-icon" }, sec.icon),
        h("span", { class: "qual-section-label" }, sec.label),
      ]),
    ]);
    if (items.length > 0) {
      const ul = h("ul", { class: "qual-section-items" });
      items.forEach((it) => {
        ul.appendChild(h("li", {}, String(it).trim()));
      });
      section.appendChild(ul);
    } else {
      section.appendChild(h("p", { class: "qual-section-empty" }, "RFP 에 명시 없음"));
    }
    body.appendChild(section);
  });
  card.appendChild(body);
  return card;
}


// ===== 🎉 구독하기 "곧 출시 예정" 모달 (Spec D-Fix-20) =====
// 랜딩 가격 섹션 영역 "구독하기" 버튼 → 결제 시스템 통합 전 안내 모달.
// 결제 시스템 통합 후 본 모달 → 실제 결제 흐름 교체 예정.
function showSubscribeComingSoonModal() {
  const backdrop = h("div", {
    class: "modal-backdrop",
    onclick: (e) => { if (e.target === backdrop) backdrop.remove(); },
  });
  const modal = h("div", { class: "modal" });
  modal.appendChild(h("div", { class: "modal-header" }, [
    h("h3", {}, "🎉 곧 출시 예정"),
    h("button", {
      class: "icon-btn",
      "aria-label": "닫기",
      onclick: () => backdrop.remove(),
    }, "✕"),
  ]));
  modal.appendChild(h("div", { class: "modal-body" }, [
    h("p", {}, "결제 시스템 준비 중입니다."),
    h("p", { class: "muted small" }, "출시 시 가입하신 이메일로 안내드릴게요."),
  ]));
  modal.appendChild(h("div", { class: "modal-footer" }, [
    h("button", {
      class: "btn btn-primary",
      onclick: () => backdrop.remove(),
    }, "확인"),
  ]));
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}


// ===== 🌙 비회원 회원가입 유도 모달 (Spec D-Fix-22 Stage B) =====
// 비회원이 회원 전용 기능 (새 과업·마이페이지·견본 CTA 등) 클릭 시 노출.
// opts.message 로 진입점마다 안내 문구 커스터마이즈 가능.
function showSignupRequiredModal(opts = {}) {
  const backdrop = h("div", {
    class: "modal-backdrop",
    onclick: (e) => { if (e.target === backdrop) backdrop.remove(); },
  });
  const modal = h("div", { class: "modal modal-signup-required" });
  modal.appendChild(h("div", { class: "modal-header" }, [
    h("h3", {}, "🌙 회원가입 후 사용 가능"),
    h("button", {
      class: "icon-btn",
      "aria-label": "닫기",
      onclick: () => backdrop.remove(),
    }, "✕"),
  ]));
  modal.appendChild(h("div", { class: "modal-body" }, [
    h("p", {}, opts.message || "이 기능은 회원가입 후 사용할 수 있어요."),
    h("p", { class: "muted small" }, "5초 만에 시작하기 ✨"),
  ]));
  modal.appendChild(h("div", { class: "modal-footer" }, [
    h("button", {
      class: "btn btn-ghost",
      onclick: () => backdrop.remove(),
    }, "다음에"),
    h("button", {
      class: "btn btn-primary",
      onclick: () => location.href = "/register.html",
    }, "지금 가입하기"),
  ]));
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}


// ===== 🔍 자체 검증 모달 (Compliance + Red Team) =====
async function openAuditModal(convId) {
  const backdrop = h("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === backdrop) backdrop.remove(); } });
  const modal = h("div", { class: "modal audit-modal" });
  modal.appendChild(h("div", { class: "modal-header" }, [
    h("div", {}, [
      h("h3", {}, "🔍 자체 검증"),
      h("p", { class: "small muted", style: "margin: 4px 0 0;" },
        "RFP 요구사항 누락·평가위원 시각의 예상 점수를 동시에 점검"),
    ]),
    h("button", { class: "icon-btn", onclick: () => backdrop.remove(), html: iconHtml("x", 18) }),
  ]));
  const body = h("div", { class: "modal-body audit-body" });
  modal.appendChild(body);

  // 로딩 상태
  body.appendChild(h("div", { class: "audit-loading" }, [
    h("div", { class: "fs-spinner", style: "margin: 0 auto 16px;" }),
    h("p", { class: "muted small", style: "text-align:center; margin:0;" },
      "RFP 와 제안서를 비교 분석하고 있어요…"),
    h("p", { class: "muted small", style: "text-align:center; margin: 6px 0 0;" },
      "AI 가 평가위원처럼 체크해요. 30~60초 걸려요."),
  ]));
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  let result;
  try {
    result = await api.post("/api/proposals/audit",
      { conversation_id: convId },
      { timeoutMs: 120000 });
  } catch (e) {
    body.innerHTML = "";
    body.appendChild(h("div", { class: "audit-error" }, [
      h("div", { style: "text-align:center; font-size:36px;" }, "⚠"),
      h("p", { style: "text-align:center; font-weight:700; margin:8px 0 4px;" },
        "검증 실행 실패"),
      h("p", { class: "muted small", style: "text-align:center; margin:0;" },
        e.message || String(e)),
    ]));
    return;
  }

  body.innerHTML = "";
  renderAuditResult(body, result);
}

function renderAuditResult(body, result) {
  const compliance = result.compliance || {};
  const redTeam = result.red_team || {};
  const summary = result.summary || "";

  // ── 요약 ──
  if (summary) {
    body.appendChild(h("div", { class: "audit-summary" }, [
      h("p", {}, summary),
    ]));
  }

  // ── Compliance ──
  const compSec = h("section", { class: "audit-section" });
  const total = compliance.total_required || 0;
  const covered = compliance.covered || 0;
  const pct = compliance.coverage_pct || (total ? Math.round(covered / total * 100) : 0);
  compSec.appendChild(h("div", { class: "audit-section-head" }, [
    h("h4", {}, "✅ 컴플라이언스 체크"),
    h("p", { class: "small muted" }, `RFP 요구사항 ${covered}/${total} 반영 (${pct}%)`),
  ]));
  // 진행률 바
  compSec.appendChild(h("div", { class: "audit-progress-wrap" }, [
    h("div", { class: "audit-progress-bar", style: `width: ${Math.min(100, Math.max(0, pct))}%;` }),
  ]));

  // 빠진 항목 (먼저 — 사용자 액션 우선)
  if (Array.isArray(compliance.missing_items) && compliance.missing_items.length) {
    const missing = h("div", { class: "audit-block missing" });
    missing.appendChild(h("p", { class: "audit-block-label" }, `🔴 빠진 항목 (${compliance.missing_items.length})`));
    const ul = h("ul", { class: "audit-list" });
    compliance.missing_items.forEach((it) => {
      const li = h("li", {}, [
        h("strong", {}, it.req || it.requirement || "요구사항"),
        it.weight ? h("span", { class: "audit-tag" }, it.weight) : null,
        it.rfp_section ? h("span", { class: "audit-tag" }, `RFP ${it.rfp_section}`) : null,
        it.advice ? h("p", { class: "audit-advice" }, "💡 " + it.advice) : null,
      ]);
      ul.appendChild(li);
    });
    missing.appendChild(ul);
    compSec.appendChild(missing);
  }

  // 반영된 항목 (접힘으로)
  if (Array.isArray(compliance.covered_items) && compliance.covered_items.length) {
    const details = h("details", { class: "audit-block covered" });
    details.appendChild(h("summary", { class: "audit-block-label" },
      `🟢 반영된 항목 (${compliance.covered_items.length}) — 클릭으로 펼침`));
    const ul = h("ul", { class: "audit-list small" });
    compliance.covered_items.forEach((it) => {
      ul.appendChild(h("li", {}, [
        h("span", {}, it.req || it.requirement || "—"),
        it.where ? h("span", { class: "audit-where" }, it.where) : null,
      ]));
    });
    details.appendChild(ul);
    compSec.appendChild(details);
  }
  body.appendChild(compSec);

  // ── Red Team ──
  const rtSec = h("section", { class: "audit-section" });
  const expected = redTeam.expected_score || 0;
  const max = redTeam.max_score || 100;
  rtSec.appendChild(h("div", { class: "audit-section-head" }, [
    h("h4", {}, "⚠ Red Team 예상 점수"),
    h("p", { class: "audit-score" }, [
      h("span", { class: "audit-score-num" }, String(expected)),
      h("span", { class: "audit-score-max" }, ` / ${max}`),
    ]),
  ]));

  // 평가 기준별 점수 (있으면)
  if (Array.isArray(redTeam.by_criterion) && redTeam.by_criterion.length) {
    const grid = h("div", { class: "audit-criterion-grid" });
    redTeam.by_criterion.forEach((c) => {
      const w = c.weight || 0;
      const e = c.expected || 0;
      const ratio = w ? Math.round(e / w * 100) : 0;
      grid.appendChild(h("div", { class: "audit-criterion" }, [
        h("p", { class: "audit-crit-name" }, c.item || "—"),
        h("p", { class: "audit-crit-score" }, [
          h("strong", {}, `${e}`),
          h("span", { class: "muted small" }, `/${w}`),
        ]),
        h("div", { class: "audit-crit-bar" }, [
          h("div", { class: "audit-crit-bar-fill", style: `width: ${Math.min(100, ratio)}%;` }),
        ]),
        c.reason ? h("p", { class: "audit-crit-reason small muted" }, c.reason) : null,
      ]));
    });
    rtSec.appendChild(grid);
  }

  // 강점 / 약점
  const sw = h("div", { class: "audit-sw-grid" });
  if (Array.isArray(redTeam.strengths) && redTeam.strengths.length) {
    const block = h("div", { class: "audit-sw audit-strengths" });
    block.appendChild(h("p", { class: "audit-block-label" }, "💪 강점"));
    const ul = h("ul", { class: "audit-list small" });
    redTeam.strengths.forEach((s) => ul.appendChild(h("li", {}, s)));
    block.appendChild(ul);
    sw.appendChild(block);
  }
  if (Array.isArray(redTeam.weaknesses) && redTeam.weaknesses.length) {
    const block = h("div", { class: "audit-sw audit-weaknesses" });
    block.appendChild(h("p", { class: "audit-block-label" }, "👎 약점"));
    const ul = h("ul", { class: "audit-list small" });
    redTeam.weaknesses.forEach((s) => ul.appendChild(h("li", {}, s)));
    block.appendChild(ul);
    sw.appendChild(block);
  }
  if (sw.children.length) rtSec.appendChild(sw);

  // 개선 우선순위
  if (Array.isArray(redTeam.improvement_priority) && redTeam.improvement_priority.length) {
    const block = h("div", { class: "audit-block improvement" });
    block.appendChild(h("p", { class: "audit-block-label" }, "💡 개선 우선순위"));
    const ul = h("ul", { class: "audit-list" });
    redTeam.improvement_priority.forEach((it) => {
      ul.appendChild(h("li", {}, [
        h("strong", {}, it.item || "—"),
        it.expected_gain ? h("span", { class: "audit-tag gain" }, it.expected_gain) : null,
        it.advice ? h("p", { class: "audit-advice" }, it.advice) : null,
      ]));
    });
    block.appendChild(ul);
    rtSec.appendChild(block);
  }
  body.appendChild(rtSec);
}


async function openBudgetModal(convId) {
  const backdrop = h("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === backdrop) backdrop.remove(); } });
  const modal = h("div", { class: "modal budget-modal" });
  modal.appendChild(h("div", { class: "modal-header" }, [
    h("h3", {}, "산출내역서"),
    h("button", { class: "icon-btn", onclick: () => backdrop.remove(), html: iconHtml("x", 18) }),
  ]));
  const body = h("div", { class: "modal-body budget-body" });
  modal.appendChild(body);
  const footer = h("div", { class: "modal-footer" });
  modal.appendChild(footer);

  body.appendChild(h("div", { style: "padding: 40px; text-align: center; color: var(--fg-2);" }, [
    h("div", { class: "loading-dots", style: "display: inline-flex; gap: 4px; margin-bottom: 10px;" }, [h("span"), h("span"), h("span")]),
    h("div", {}, "AI가 제안서를 분석하고 업계 평균 시세로 산출내역을 작성하고 있어요…"),
  ]));
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  let data;
  try {
    data = await api.post("/api/budget/generate", { conversation_id: convId }, { timeoutMs: 180000 });
  } catch (e) {
    body.innerHTML = "";
    body.appendChild(h("div", { style: "padding: 40px; color: var(--danger); text-align: center;" }, e.message || "생성 실패"));
    return;
  }
  if (!data.categories && data.sections) {
    // 구 스키마 호환
    data.categories = data.sections.map((s) => ({
      name: s.name,
      items: (s.items || []).map((it) => ({
        item: it.name || it.item, spec: it.spec, unit_price: it.unit_price,
        qty: it.qty, unit: it.unit, period: it.period || "-", utilization: 100,
        amount: it.amount, note: it.note,
      })),
    }));
  }
  recalcBudget(data);
  renderBudget(body, footer, data, backdrop);
  // 백엔드 영역에서 자동 조정 영역 발생 시 = toast 안내 영역
  // (예산 영역 초과 영역 → 비례 영역 ↓ 영역 자동 적용됨)
  if (data.auto_adjusted) {
    const limit = Number(data.budget_limit) || 0;
    const limitFmt = limit > 0 ? `₩${limit.toLocaleString("ko-KR")}` : "총 예산";
    toast(`총 예산 (${limitFmt}) 안에 들어가도록 자동 조정됐어요. 항목 단가를 검토해 주세요.`, "", 6000);
  }
}

function renderBudget(body, footer, data, backdrop) {
  body.innerHTML = "";
  footer.innerHTML = "";

  // 제목 (편집 가능)
  const titleEl = h("input", {
    class: "budget-title", value: data.title || "산출내역서",
    placeholder: "사업/용역 명칭",
    oninput: (e) => { data.title = e.target.value; },
  });
  body.appendChild(titleEl);

  // 테이블
  const table = h("table", { class: "budget-fixed-table" });
  const colgroup = h("colgroup", {}, [
    h("col", { style: "width: 13%;" }),
    ...BUDGET_COLS.map((c) => h("col", { style: `width: ${c.width};` })),
  ]);
  table.appendChild(colgroup);
  table.appendChild(h("thead", {}, h("tr", {}, [
    h("th", {}, "구분"),
    ...BUDGET_COLS.map((c) => h("th", { style: `text-align: ${c.align};` }, c.label)),
  ])));

  const tbody = h("tbody");
  table.appendChild(tbody);
  body.appendChild(table);

  const summary = h("div", { class: "budget-summary" });
  body.appendChild(summary);

  const rerenderRows = () => {
    tbody.innerHTML = "";
    (data.categories || []).forEach((cat, ci) => {
      const rowCount = (cat.items || []).length || 1;
      // 항목들
      (cat.items || []).forEach((it, ii) => {
        const tr = h("tr");
        if (ii === 0) {
          const catCell = h("td", {
            class: "budget-cat-cell",
            rowspan: String(rowCount + 1), // +1 for 소계 row
            contenteditable: "true",
            oninput: (e) => { cat.name = e.target.innerText; },
          }, cat.name || "");
          tr.appendChild(catCell);
        }
        BUDGET_COLS.forEach((col) => {
          const td = h("td", {
            class: "budget-cell " + (col.num ? "num" : ""),
            style: `text-align: ${col.align};` + (col.bold ? " font-weight: 700;" : ""),
            contenteditable: col.key === "amount" ? "false" : "true",
            onblur: (e) => {
              const raw = e.target.innerText.trim();
              if (col.num) it[col.key] = _n(raw);
              else it[col.key] = raw;
              recalcBudget(data);
              rerenderSummary();
              if (["unit_price", "qty", "utilization"].includes(col.key)) {
                // amount 셀만 업데이트
                const rowEl = e.target.closest("tr");
                const amtIdx = BUDGET_COLS.findIndex((c) => c.key === "amount");
                // amount cell은 구분 셀 존재 여부에 따라 오프셋 조정 필요
                const cells = rowEl.querySelectorAll("td");
                // 첫 행일 때만 rowspan 셀이 맨 앞에 있음
                const catCellOffset = ii === 0 ? 1 : 0;
                const amtCell = cells[catCellOffset + amtIdx];
                if (amtCell) amtCell.innerText = _fmt(it.amount);
                // 소계도 업데이트
                const subEl = tbody.querySelector(`[data-sub-idx="${ci}"]`);
                if (subEl) subEl.innerText = _fmt(cat.subtotal) + "원";
              }
            },
          }, col.key === "amount" ? _fmt(it.amount) :
             col.num ? (it[col.key] != null ? String(it[col.key]) : "0") :
             (it[col.key] || ""));
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      // 소계 행
      const subTr = h("tr", { class: "budget-sub-row" });
      subTr.appendChild(h("td", { colspan: String(BUDGET_COLS.length - 1), style: "text-align: right; font-weight: 600;" }, "소계"));
      subTr.appendChild(h("td", {
        "data-sub-idx": String(ci),
        style: "text-align: right; font-weight: 700; color: var(--primary);",
      }, _fmt(cat.subtotal) + "원"));
      subTr.appendChild(h("td"));  // 비고
      tbody.appendChild(subTr);
    });
  };

  const rerenderSummary = () => {
    summary.innerHTML = "";
    // 새 흐름 (3단계 — 투찰율 영역 도입):
    //   소계합 → 일반관리비 → 대행료 → 합계 → 부가세 → 총합계
    //   → 투찰율 (사용자 입력, 슬라이더+숫자) → 투찰가 (= 견적금액 영역)
    const rows = [
      { label: "소계 합", value: data.subtotal_sum },
      { label: "일반관리비 (소계합 × 7%)", value: data.admin_fee },
      { label: "대행료 ((소계합+일반관리비) × 10%)", value: data.agency_fee },
      { label: "합계", value: data.total, strong: true },
      { label: "부가세 (합계 × 10%)", value: data.vat },
      { label: "총합계 (VAT 포함)", value: data.grand_total, strong: true },
    ];
    rows.forEach((r) => {
      summary.appendChild(h("div", { class: "budget-sum-row " + (r.accent ? "accent" : "") }, [
        h("div", { class: "sum-label" }, r.label),
        h("div", { class: "sum-value" + (r.strong ? " strong" : ""), }, _fmt(r.value) + "원"),
      ]));
    });

    // ─── 투찰율 (B2G 표준 — RFP 예산 대비 청구 비율) — 슬라이더 + 숫자 결합 ───
    const rate = (data.bid_rate || DEFAULT_BID_RATE);
    const ratePct = (rate * 100).toFixed(1);  // "90.0"

    const slider = h("input", {
      type: "range", min: "82", max: "98", step: "0.1",
      value: ratePct,
      class: "bid-rate-slider",
    });
    const numberInput = h("input", {
      type: "number", min: "82", max: "98", step: "0.1",
      value: ratePct,
      class: "bid-rate-number",
    });

    const onChange = (newPct) => {
      // 82~98 clamp (B2G 표준 92-95% 영역 + 영업 전략 영역 82-88% 여유 + 적극 영역 96-98%)
      const v = Math.max(82, Math.min(98, Number(newPct) || 90));
      data.bid_rate = v / 100;
      slider.value = v.toFixed(1);
      numberInput.value = v.toFixed(1);
      recalcBudget(data);
      rerenderSummary();
    };
    slider.addEventListener("input", (e) => onChange(e.target.value));
    numberInput.addEventListener("change", (e) => onChange(e.target.value));

    const rateRow = h("div", { class: "budget-sum-row bid-rate-row" }, [
      h("div", { class: "sum-label" }, "투찰율 (RFP 예산 대비)"),
      h("div", { class: "bid-rate-controls" }, [
        slider,
        numberInput,
        h("span", { class: "bid-rate-pct-suffix" }, "%"),
      ]),
    ]);
    summary.appendChild(rateRow);

    // ─── 투찰가 (= 견적금액 영역, 만원 절사) — 노랑 강조 ───
    summary.appendChild(h("div", { class: "budget-sum-row huge accent bid-price-row" }, [
      h("div", { class: "sum-label" }, "투찰가 (만원 절사)"),
      h("div", { class: "sum-value strong" }, _fmt(data.bid_price) + "원"),
    ]));
  };

  rerenderRows();
  rerenderSummary();

  // 푸터 버튼
  footer.appendChild(h("button", { class: "btn btn-ghost", onclick: () => backdrop.remove() }, "닫기"));
  footer.appendChild(h("button", {
    class: "btn btn-outline",
    html: `${iconHtml("printer", 14)}<span>PDF / 인쇄</span>`,
    onclick: () => printBudget(data),
  }));
  footer.appendChild(h("button", {
    class: "btn btn-primary",
    html: `${iconHtml("save", 14)}<span>엑셀 다운로드 (.xlsx)</span>`,
    onclick: () => downloadBudgetXlsx(data),
  }));
}

// .xlsx 다운로드 — 백엔드 영역 openpyxl (B2G 표준 양식 영역)
async function downloadBudgetXlsx(data) {
  const bidRate = (typeof data.bid_rate === "number" && data.bid_rate >= 0.5 && data.bid_rate <= 1)
    ? data.bid_rate : DEFAULT_BID_RATE;
  const bidPrice = Number(data.bid_price) || 0;
  const koreanText = _korean_amount(bidPrice);
  const today = new Date().toISOString().slice(0, 10);
  const reqBody = {
    title: data.title || "산출내역서",
    organization: data.organization || (data._rfp && data._rfp.organization) || "",
    project_name: data.title || "",
    quote_date: today,
    bid_rate: bidRate,
    bid_price: bidPrice,
    bid_price_text: `일금 ${koreanText}정 (₩${bidPrice.toLocaleString("ko-KR")}) / VAT포함`,
    categories: data.categories || [],
  };
  try {
    const r = await fetch("/api/budget/xlsx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`,
      },
      body: JSON.stringify(reqBody),
    });
    if (r.status === 401) { clearToken(); redirectToLogin(); return; }
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || "엑셀 다운로드 실패");
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `산출내역서_${(data.title || "제안").replace(/\s+/g, "_")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast(e.message || "엑셀 다운로드 실패", "error");
  }
}

// ---------- 🔐 PPTX 인증 다운로드 helper (Phase 5 Phase 2 Step 1) ----------
// 배경: /api/proposals/{conv_id}/download 는 Bearer 인증 필수.
// anchor click → 브라우저 native navigation → Authorization 헤더 미부착 → 401.
// 본 helper 는 fetch + Bearer + Blob + ObjectURL + anchor click 패턴으로 우회.
// (downloadBudgetXlsx 와 동일 패턴 일반화. _call() 우회 — _call() 은 binary 미지원.)
//
// args:
//   url               — PPTX 다운로드 URL (예: /api/proposals/{conv_id}/download)
//   fallbackFilename  — Content-Disposition 미파싱 시 사용 (기본 'proposal.pptx')
// returns: true (성공) / false (실패 — toast 로 사용자 안내까지 완료)
async function downloadPptxAuthenticated(url, fallbackFilename = "proposal.pptx") {
  const tok = getToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), 60000);
  let objectUrl = null;
  try {
    const headers = {};
    // _call() 패턴 일관 — 토큰 없으면 헤더 미부착 (서버가 401 응답 → 아래 분기에서 redirect)
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
    const r = await fetch(url, { method: "GET", headers, signal: ctrl.signal });

    if (r.status === 401) {
      // _call() 의 401 처리 동일 패턴
      clearToken();
      redirectToLogin();
      return false;
    }
    if (!r.ok) {
      // detail.code 추출 시도 (api_proposals_download 의 PPTX_NOT_GENERATED / PPTX_FILE_MISSING / INVALID_PATH 등)
      let code = null;
      try { const j = await r.json(); code = j && j.detail && j.detail.code; } catch {}
      if (r.status === 404) {
        if (code === "PPTX_NOT_GENERATED") toast("제안서가 아직 생성되지 않았어요. 먼저 생성해 주세요.", "error");
        else if (code === "PPTX_FILE_MISSING") toast("저장된 제안서 파일을 찾지 못했어요. 다시 생성해 주세요.", "error");
        else toast("제안서를 찾을 수 없어요.", "error");
      } else if (r.status === 400) {
        toast("잘못된 다운로드 요청입니다.", "error");
      } else {
        toast(`다운로드 실패 (HTTP ${r.status})`, "error");
      }
      return false;
    }

    // Content-Disposition 파싱 — RFC 5987 (filename*=UTF-8'') 우선, filename= fallback
    const cd = r.headers.get("Content-Disposition") || "";
    let filename = fallbackFilename;
    const m5987 = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (m5987) {
      try { filename = decodeURIComponent(m5987[1].trim()); } catch {}
    } else {
      const mPlain = cd.match(/filename="?([^";]+)"?/i);
      if (mPlain) filename = mPlain[1].trim();
    }

    const blob = await r.blob();
    objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 진단서 권장 — 즉시 revoke 시 일부 브라우저에서 다운로드 시작 전 URL 무효화 가능성 회피 (5초 지연)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    return true;
  } catch (e) {
    if (e.name === "AbortError" || String(e.message || "").includes("timeout")) {
      toast("다운로드 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.", "error");
    } else if (e instanceof TypeError && /fetch|Failed|Network/i.test(e.message || "")) {
      toast("서버와 연결할 수 없어요. 네트워크 상태를 확인해 주세요.", "error");
    } else {
      toast("PPTX 다운로드 실패: " + (e.message || e), "error");
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 📄 부분 페이지 재생성 모달 (Sub-step D-1 + D-2) ----------
// 채팅 헤더 "📄 페이지 재생성" 버튼 → 본 모달 열림 → 페이지 번호 입력/선택 → endpoint 호출.
// NightOff 설계 철학 준수: 패턴 매칭 ❌, AI 안내 + 명시 버튼 ✅
// (app.js:4438-4440 의 옛 isProposalRequest 제거 이력 참조 — 키워드 매칭은 오트리거 위험).
//
// D-2: outline 배열 전달 시 페이지 list (페이지 번호 + 섹션 이름) 표시 → 클릭 선택 + input sync.
// outline null (옛 conv / 풀 생성 안 됨) → list 영역 hidden, input 만 표시 (D-1 fallback).
//
// args:
//   convId — 대화 ID
//   totalSlides — 현재 제안서 페이지 수 (data.conversation.last_proposal_pages). null 가능.
//   outline — proposal_outline 배열 [{page, section, governing_main, ...}, ...]. null 가능.
async function openRegeneratePageModal(convId, totalSlides, outline) {
  const backdrop = h("div", {
    class: "modal-backdrop",
    onclick: (e) => { if (e.target === backdrop) backdrop.remove(); },
  });
  const modal = h("div", { class: "modal", style: "max-width: 480px;" });

  // 헤더
  modal.appendChild(h("div", { class: "modal-header" }, [
    h("h3", {}, "📄 페이지 재생성"),
    h("button", {
      class: "icon-btn",
      onclick: () => backdrop.remove(),
      html: iconHtml("x", 18),
    }),
  ]));

  // 본문
  const body = h("div", { class: "modal-body" });
  body.appendChild(h("p", { class: "muted small", style: "margin: 0 0 16px; line-height: 1.5;" },
    `재생성할 페이지 번호를 입력해주세요. 1페이지당 100 크레딧이 차감돼요.${totalSlides ? ` (현재 제안서: 총 ${totalSlides}페이지)` : ""}`));

  const inputAttrs = {
    type: "number",
    min: "1",
    placeholder: "예: 14",
    style: "width: 100%; padding: 10px 12px; font-size: 14px; border: 1px solid #DDD; border-radius: 6px; box-sizing: border-box; font-family: inherit;",
  };
  if (totalSlides) inputAttrs.max = String(totalSlides);
  const input = h("input", inputAttrs);
  body.appendChild(input);

  // Sub-step D-2 — outline list (페이지 + 섹션 이름 클릭 선택)
  // outline 있을 때만 렌더. 없으면 D-1 처럼 input 만 사용.
  let outlineListEl = null;
  if (Array.isArray(outline) && outline.length > 0) {
    body.appendChild(h("p", { class: "muted small", style: "margin: 12px 0 6px;" }, "또는 아래 페이지에서 선택"));
    outlineListEl = h("div", {
      style: "max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 4px; background: #fff;",
    });
    // 아이템 렌더 — 한 줄에 "페이지번호. 섹션 이름" 형식, 클릭 시 input sync + 시각 강조.
    outline.forEach((it) => {
      if (!it || typeof it.page !== "number") return;
      const section = (it.section || "").toString();
      const itemEl = h("div", {
        style: "padding: 6px 10px; cursor: pointer; border-radius: 4px; font-size: 13px; line-height: 1.5;",
        title: it.governing_main || section || `${it.page}페이지`,
      }, `${it.page}. ${section || "(섹션 없음)"}`);
      itemEl.dataset.page = String(it.page);
      itemEl.addEventListener("mouseenter", () => {
        if (!itemEl.classList.contains("regen-selected")) {
          itemEl.style.background = "var(--bg-2)";
        }
      });
      itemEl.addEventListener("mouseleave", () => {
        if (!itemEl.classList.contains("regen-selected")) {
          itemEl.style.background = "";
        }
      });
      itemEl.addEventListener("click", () => {
        input.value = String(it.page);
        syncSelection(it.page);
      });
      outlineListEl.appendChild(itemEl);
    });
    body.appendChild(outlineListEl);
  }

  // input ↔ list sync — input 입력 시 list 강조 변경, list 클릭 시 input 변경 (위 onclick).
  function syncSelection(page) {
    if (!outlineListEl) return;
    outlineListEl.querySelectorAll("[data-page]").forEach((el) => {
      const isSelected = parseInt(el.dataset.page, 10) === page;
      el.classList.toggle("regen-selected", isSelected);
      el.style.background = isSelected ? "var(--primary-soft)" : "";
      el.style.color = isSelected ? "var(--primary, #1A1A1A)" : "";
      el.style.fontWeight = isSelected ? "600" : "";
    });
  }
  input.addEventListener("input", () => {
    const p = parseInt(input.value, 10);
    if (!isNaN(p)) syncSelection(p);
  });

  // 상태 / 결과 / 에러 영역 (초기 hidden)
  const statusEl = h("div", { style: "margin-top: 16px; display: none; padding: 10px 12px; background: var(--bg-2); border-radius: 6px; font-size: 13px;" });
  const resultEl = h("div", { style: "margin-top: 16px; display: none;" });
  const errorEl = h("div", { style: "margin-top: 12px; display: none; color: var(--danger); font-size: 13px; padding: 8px 10px; background: #FDEDEC; border-left: 3px solid #C0392B; border-radius: 4px;" });
  body.appendChild(statusEl);
  body.appendChild(resultEl);
  body.appendChild(errorEl);
  modal.appendChild(body);

  // Footer
  const regenBtn = h("button", { class: "btn btn-primary" }, "재생성");
  const closeBtn = h("button", { class: "btn btn-ghost", onclick: () => backdrop.remove() }, "닫기");
  modal.appendChild(h("div", { class: "modal-footer" }, [closeBtn, regenBtn]));

  // 친화 에러 메시지 매핑
  function friendlyError(status, data) {
    const detail = data && data.detail;
    const code = (detail && typeof detail === "object") ? detail.code : null;
    const messages = {
      INVALID_PAGE: "페이지는 1 이상이어야 해요.",
      PAGE_OUT_OF_RANGE: totalSlides
        ? `이 제안서는 ${totalSlides}페이지까지 있어요. 다른 번호를 입력해주세요.`
        : "페이지 범위를 초과했어요. 페이지 번호를 다시 확인해주세요.",
      OUTLINE_MISSING: "이 제안서는 부분 재생성을 지원하지 않는 옛 버전이에요. ✨ 제안서 생성 버튼으로 전체 재생성해주세요.",
      QUOTA_EXCEEDED: "크레딧이 부족해요 (1페이지 재생성에 100 크레딧 필요). 결제 후 다시 시도해주세요.",
      PROPOSAL_NOT_FOUND: "제안서 데이터가 없어요. 먼저 ✨ 제안서 생성 버튼을 눌러주세요.",
    };
    if (code && messages[code]) return messages[code];
    if (typeof detail === "string") return detail;
    if (typeof (detail && detail.error) === "string") return detail.error;
    return `재생성에 실패했어요. (HTTP ${status}) 잠시 후 다시 시도해주세요.`;
  }

  function showError(msg) {
    errorEl.textContent = `❌ ${msg}`;
    errorEl.style.display = "block";
  }
  function clearError() {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }

  // 재생성 클릭 핸들러
  regenBtn.addEventListener("click", async () => {
    clearError();
    const page = parseInt(input.value, 10);
    if (!page || page < 1) {
      showError("페이지 번호를 입력해주세요 (1 이상).");
      return;
    }
    if (totalSlides && page > totalSlides) {
      showError(`이 제안서는 ${totalSlides}페이지까지 있어요.`);
      return;
    }

    // UI 잠금 — 중복 호출 방지
    regenBtn.disabled = true;
    closeBtn.disabled = true;
    input.disabled = true;
    resultEl.style.display = "none";
    statusEl.innerHTML = `<span class="loading-dots" style="display:inline-flex; gap:4px; margin-right:6px;"><span></span><span></span><span></span></span><span>${page}페이지 재생성 중… (약 1분 소요)</span>`;
    statusEl.style.display = "block";

    const start = Date.now();
    try {
      const r = await fetch(`/api/conversations/${convId}/proposals/regenerate-page`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ page }),
      });
      const data = await r.json().catch(() => ({}));

      if (r.ok) {
        const elapsedSec = (typeof data.elapsed_sec === "number")
          ? data.elapsed_sec.toFixed(1)
          : ((Date.now() - start) / 1000).toFixed(1);
        statusEl.style.display = "none";
        resultEl.innerHTML = "";
        resultEl.appendChild(h("div", { style: "padding: 12px 14px; background: var(--primary-soft); border-radius: 8px; line-height: 1.6;" }, [
          h("div", { style: "font-weight: 600; margin-bottom: 4px;" }, `✅ ${data.page}페이지 재생성 완료 (${elapsedSec}초)`),
          data.section ? h("div", { class: "muted small" }, `섹션: ${data.section}`) : null,
          typeof data.credits_remaining === "number"
            ? h("div", { class: "muted small", style: "margin-top: 4px;" }, `크레딧 잔량: ${data.credits_remaining.toLocaleString("ko-KR")}`)
            : null,
        ]));
        const dlBtn = h("button", {
          class: "btn btn-primary",
          style: "margin-top: 12px; width: 100%;",
          html: "📄 새 PPTX 다운로드",
          onclick: () => {
            downloadPptxAuthenticated(data.url, data.filename || "proposal.pptx");
          },
        });
        resultEl.appendChild(dlBtn);
        resultEl.style.display = "block";
        // 사이드바 크레딧 즉시 갱신 (1페이지 차감 = 100 크레딧)
        try { refreshQuotaUI("proposal", 1); } catch (e) { console.warn("refreshQuotaUI 실패:", e); }
        // 다음 재생성 가능하도록 UI 재활성화
        regenBtn.textContent = "다시 재생성";
        regenBtn.disabled = false;
        closeBtn.disabled = false;
        input.disabled = false;
        input.value = "";
      } else {
        statusEl.style.display = "none";
        showError(friendlyError(r.status, data));
        regenBtn.disabled = false;
        closeBtn.disabled = false;
        input.disabled = false;
      }
    } catch (e) {
      statusEl.style.display = "none";
      showError("서버와 연결할 수 없어요. 네트워크 상태를 확인해주세요.");
      regenBtn.disabled = false;
      closeBtn.disabled = false;
      input.disabled = false;
    }
  });

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  setTimeout(() => input.focus(), 100);
}


// 한국어 금액 표기 영역 — '1억2천5백만' 형태 (간소: 억/만 단위)
function _korean_amount(n) {
  if (!n) return "영원";
  const eok = Math.floor(n / 100000000);
  const rest = n % 100000000;
  const man = Math.floor(rest / 10000);
  const won = rest % 10000;
  const parts = [];
  if (eok) parts.push(`${eok}억`);
  if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
  if (won) parts.push(`${won.toLocaleString("ko-KR")}`);
  return (parts.join("") || "영") + "원";
}

function printBudget(data) {
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) { toast("팝업이 차단됐어요. 팝업 허용 후 다시 시도해주세요.", "error"); return; }
  const rowHtml = (data.categories || []).map((cat) => {
    const rc = (cat.items || []).length;
    const items = (cat.items || []).map((it, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${rc + 1}" class="cat">${escapeHtml(cat.name || "")}</td>` : ""}
        <td>${escapeHtml(it.item || "")}</td>
        <td>${escapeHtml(it.subitem || "")}</td>
        <td>${escapeHtml(it.spec || "")}</td>
        <td class="num">${_fmt(it.unit_price)}</td>
        <td class="num">${_fmt(it.qty)}</td>
        <td class="c">${escapeHtml(it.unit || "")}</td>
        <td class="num">${_fmt(it.period_qty || "")}</td>
        <td class="c">${escapeHtml(it.period_unit || "")}</td>
        <td class="num">${(typeof it.utilization === "number" ? it.utilization.toFixed(2) : (it.utilization || ""))}</td>
        <td class="num bold">${_fmt(it.amount)}</td>
        <td>${escapeHtml(it.note || "")}</td>
      </tr>`).join("");
    const sub = `<tr class="sub"><td colspan="10" class="r">소계</td><td class="num bold accent">${_fmt(cat.subtotal)}원</td><td></td></tr>`;
    return items + sub;
  }).join("");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>산출내역서 · ${escapeHtml(data.title || "")}</title>
<style>
body{font-family:Pretendard,sans-serif;padding:24px;color:#111;font-size:12px;}
h1{font-size:22px;margin:0 0 16px;letter-spacing:-0.02em;}
table{width:100%;border-collapse:collapse;}
th,td{border:1px solid #d4d4d8;padding:6px 8px;vertical-align:middle;}
th{background:#f4f4f5;font-size:11px;font-weight:700;}
td.num{text-align:right;}
td.c{text-align:center;}
td.r{text-align:right;}
td.bold{font-weight:700;}
td.accent{color:#6b46e5;}
td.cat{background:#faf5ff;font-weight:600;}
tr.sub{background:#fafafa;}
.summary{margin-top:20px;border-top:2px solid #111;padding-top:14px;}
.summary-row{display:flex;justify-content:space-between;padding:4px 12px;font-size:13px;}
.summary-row.huge{font-size:16px;font-weight:700;color:#6b46e5;border-top:1px solid #d4d4d8;margin-top:6px;padding-top:10px;}
.summary-row.accent .val{color:#6b46e5;font-weight:700;}
@media print{body{padding:12mm;} @page{size:A4;margin:10mm;}}
</style></head><body>
<h1>산출내역서 · ${escapeHtml(data.title || "")}</h1>
<table>
<colgroup><col style="width:8%"/><col style="width:8%"/><col style="width:7%"/><col style="width:18%"/><col style="width:9%"/><col style="width:5%"/><col style="width:5%"/><col style="width:5%"/><col style="width:6%"/><col style="width:6%"/><col style="width:11%"/><col style="width:8%"/></colgroup>
<thead><tr>
<th>구분</th><th>항목</th><th>소항목</th><th>산출근거</th><th>단가</th><th>수량</th><th>단위</th><th>기간</th><th>단위</th><th>투입율</th><th>제출금액</th><th>비고</th>
</tr></thead>
<tbody>${rowHtml}</tbody>
</table>
<div class="summary">
<div class="summary-row"><span>소계 합</span><span class="val">${_fmt(data.subtotal_sum)}원</span></div>
<div class="summary-row"><span>일반관리비 (소계합 × 7%)</span><span class="val">${_fmt(data.admin_fee)}원</span></div>
<div class="summary-row"><span>대행료 ((소계합+관리비) × 10%)</span><span class="val">${_fmt(data.agency_fee)}원</span></div>
<div class="summary-row"><span><b>합계</b></span><span class="val"><b>${_fmt(data.total)}원</b></span></div>
<div class="summary-row"><span>부가세 (합계 × 10%)</span><span class="val">${_fmt(data.vat)}원</span></div>
<div class="summary-row"><span><b>총합계 (VAT 포함)</b></span><span class="val"><b>${_fmt(data.grand_total)}원</b></span></div>
<div class="summary-row"><span>투찰율</span><span class="val">${((data.bid_rate || DEFAULT_BID_RATE) * 100).toFixed(1)}%</span></div>
<div class="summary-row huge accent"><span>투찰가 (만원 절사)</span><span class="val">${_fmt(data.bid_price)}원</span></div>
</div>
<script>setTimeout(()=>window.print(),300);</script>
</body></html>`);
  w.document.close();
}

async function openCompanyDnaModal() {
  const dna = await api.get("/api/company-dna").catch(() => ({ exists: false, ref_count: 0 }));

  const backdrop = h("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === backdrop) backdrop.remove(); } });
  const modal = h("div", { class: "modal", style: "max-width: 640px;" });
  modal.appendChild(h("div", { class: "modal-header" }, [
    h("h3", {}, "우리 회사 DNA"),
    h("button", { class: "icon-btn", onclick: () => backdrop.remove(), html: iconHtml("x", 18) }),
  ]));

  const body = h("div", { class: "modal-body" });
  if (!dna.exists) {
    body.appendChild(h("div", { class: "onboarding-hint" }, [
      h("span", { class: "ob-emoji" }, "📂"),
      h("div", {}, [
        h("p", { class: "ob-title" }, "RFP 만 넣어도 수많은 과거 제안서로 학습한 글투·시각화가 자동 반영돼요"),
        h("p", { class: "ob-desc" }, "발주처를 추가하고 RFP를 업로드하면 과업 분석과 발주처 들여다보기가 자동으로 진행됩니다. 대화로 본문을 다듬는 동안 RAG 가 적절한 시각화 블록을 추천해 드려요."),
      ]),
    ]));
  } else {
    const kwGroup = (label, items, cls) => items && items.length ? h("div", { style: "margin-top: 14px;" }, [
      h("p", { class: "small muted", style: "margin: 0 0 6px; font-weight: 500;" }, label),
      h("div", { class: "flex-row", style: "flex-wrap: wrap; gap: 6px;" },
        items.map((x) => h("span", { class: "badge " + cls }, x))),
    ]) : null;

    body.appendChild(h("div", { class: "small muted" }, `레퍼런스 ${dna.sample_count || dna.ref_count}건 기반 · ${relativeTime(dna.updated_at)} 업데이트`));
    if (dna.tone_style) body.appendChild(h("div", { style: "margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: var(--primary-soft); color: var(--primary); font-size: 14px; line-height: 1.5;" },
      [h("strong", {}, "톤앤매너 · "), document.createTextNode(dna.tone_style)]));
    [
      kwGroup("자주 쓰는 표현", dna.signature_phrases, "badge-primary"),
      kwGroup("강점 키워드", dna.strength_keywords, "badge-success"),
    ].filter(Boolean).forEach((el) => body.appendChild(el));
    if (dna.strategy_patterns?.length) {
      body.appendChild(h("div", { style: "margin-top: 14px;" }, [
        h("p", { class: "small muted", style: "margin: 0 0 8px; font-weight: 500;" }, "주로 쓰는 전략 구조"),
        h("ul", { style: "list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;" },
          dna.strategy_patterns.map((sp) => h("li", { style: "padding: 10px 12px; background: var(--bg-2); border-radius: 8px; font-size: 13px;" }, sp))),
      ]));
    }
  }
  modal.appendChild(body);
  modal.appendChild(h("div", { class: "modal-footer" }, [
    h("button", { class: "btn btn-ghost", onclick: () => backdrop.remove() }, "닫기"),
    h("button", { class: "btn btn-primary", onclick: async () => {
      const loader = showFullscreenLoader(LOADER_STEPS.reference);
      try {
        await api.post("/api/company-dna/rebuild");
        loader.finish("✅", "재학습 완료!", 600);
        setTimeout(() => { backdrop.remove(); openCompanyDnaModal(); }, 800);
      } catch (e) { loader.stop(); toast(e.message || "재학습 실패", "error"); }
    } }, "지금 재학습"),
  ]));
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

function relativeTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

async function renderDashboard() {
  const root = $("#app-root");
  if (!root) return;  // SPA 라우트 밖 호출 방어
  root.innerHTML = "";

  const [statsR, clientsR, activityR, dnaR] = await Promise.all([
    api.get("/api/stats").catch(() => ({})),
    api.get("/api/clients").catch(() => []),
    api.get("/api/activity").catch(() => []),
    api.get("/api/company-dna").catch(() => ({ exists: false, ref_count: 0 })),
  ]);
  // 방어적 정규화 — 서버 응답이 예상 타입 아니어도 크래시 안 나게
  const stats = (statsR && typeof statsR === "object" && !Array.isArray(statsR)) ? statsR : {};
  const clients = Array.isArray(clientsR) ? clientsR : [];
  const activity = Array.isArray(activityR) ? activityR : [];
  const dna = (dnaR && typeof dnaR === "object" && !Array.isArray(dnaR)) ? dnaR : { exists: false, ref_count: 0 };

  // 사이드바 — clients + stats 모두 preload 전달 (재요청 X).
  // Stats 4개 영역은 사이드바로 이동됨 (메인 영역 정리).
  root.appendChild(await renderSidebar("clients", null, clients, stats));

  const main = h("main", { class: "main" });
  root.appendChild(main);

  // Spec C-4 (5/18): 헤더 미니멀화 — h1 시간대별 메시지만, p 제거.
  //   "대시보드" 워딩 폐기 + p 부제 제거. getTimeBasedGreeting() 함수 본문 무변경.
  main.appendChild(h("header", { class: "main-header" }, [
    h("div", {}, [
      h("h1", {}, getTimeBasedGreeting()),
    ]),
    // "+ 새 과업" 버튼은 사이드바 상단으로 단일화됨 (이중 진입점 제거).
  ]));

  const content = h("div", { class: "main-content" });
  main.appendChild(content);

  // ── 최상단 (1): 히어로 배너 5 슬라이드 자동 롤링 (Spec 7 — 5/16)
  content.appendChild(renderHero5Slides());

  // ── 최상단 (2): NightOff 핵심 기능 5 카드 (Spec 6 — 옛 renderHeroBanner 영역 교체)
  content.appendChild(renderCoreFeatures5());

  // ── Stats 4개 영역 → 사이드바로 이동됨. 자리 = 업계 뉴스 가로 롤링 위젯.
  content.appendChild(renderNewsWidget());

  // ── 중단: 큰 CTA — 과업이 없을 때만 노출 (있으면 사이드바·상단 버튼으로 추가)
  if (clients.length === 0) {
    content.appendChild(h("section", { class: "dashboard-cta-section" }, [
      h("button", {
        class: "btn btn-primary dashboard-mega-cta",
        onclick: () => navigate("/client/new"),
        html: `${iconHtml("plus", 26)}<span>새 과업 등록하기 ✨</span>`,
      }),
      h("p", { class: "dashboard-cta-sub" }, "과업 정보를 입력하고 RFP 부터 차근차근 시작해보세요 😊"),
    ]));
  }

  // ── 하단: 좌(나라장터 마감 임박 공고 위젯) / 우(오늘의 팁 + 가짜 광고)
  const twoCol = h("div", { class: "dashboard-two-col" });
  content.appendChild(twoCol);

  // [좌] 마감 임박 공고 위젯 — 비동기 로딩 (위젯 자체가 fetch + 롤링 관리)
  const leftCol = h("section");
  leftCol.appendChild(renderClosingNoticesWidget());
  twoCol.appendChild(leftCol);

  // [우] 사이드 카드 영역 — Spec C-3 (5/18): 샘플 위젯 신규 추가.
  //      PDF 자산 (sample-1.pdf) 업로드 후 자동 작동. 데이터 placeholder.
  const rightCol = h("aside", { class: "dashboard-side-col" });
  const sampleWidget = renderSampleWidget();
  if (sampleWidget) rightCol.appendChild(sampleWidget);
  twoCol.appendChild(rightCol);

  // 핵심 기능 5 카드는 최상단으로 옮겨졌고 (renderCoreFeatures5, Spec 6)
  // 푸터는 글로벌 푸터(#global-footer)로 일원화 — 대시보드 자체 푸터 제거

  // Spec D-Fix-7 (5/18) — 대시보드 첫 진입 안내 모달 (1회성, dismissed 영구 저장)
  // Spec D-Fix-22 Stage B: 비회원이면 호출 X (안전망 — 함수 자체도 401 catch 로 자연 차단).
  setTimeout(() => {
    if (isGuestMode()) return;
    showDashboardIntroModal();
  }, 500);
}


// ─── 비회원 둘러보기 대시보드 (Spec D-Fix-22 Stage A) ────────────────────
// 가짜 데이터로 회원 대시보드 화면을 그대로 미러링.
// API 호출 0 — 모든 데이터는 정적 상수에서 가져옴.
// 진입 모달 호출 X (회원 전용).
// 사용자 행동 분기 (새 과업·채팅·업로드 등) 는 Stage B 에서 추가 예정.

// 가짜 사이드바 과업 — id "guest-N" 클릭 시 라우터가 견본 모달로 매핑.
const GUEST_CLIENTS = [
  { id: "guest-1", name: "2026 강남구 청년 축제", deadline: "" },
  { id: "guest-2", name: "서울시 신년 문화행사", deadline: "" },
];
// 가짜 사이드바 통계 (renderSidebar 가 읽는 필드 정합).
const GUEST_STATS = {
  total_clients: 2,
  total_proposals: 2,
  month_activity: 1,
  wins: 1,
  losses: 0,
  win_rate: 100,
};
// 가짜 마감 임박 (custom 위젯 — 실제 closing-notices API 우회).
const GUEST_DEADLINES = [
  { title: "2026 종로구 시민 페스티벌", agency: "종로구청", dDay: 3 },
  { title: "강북구 청소년 행사", agency: "강북구청", dDay: 7 },
];

// 비회원 상단 배너 (Spec D-Fix-22 Stage B) — sticky / 그라데이션 / 회원가입 CTA
function renderGuestBanner() {
  return h("div", { class: "guest-banner" }, [
    h("div", { class: "guest-banner-inner" }, [
      h("span", { class: "guest-banner-icon" }, "👀"),
      h("span", { class: "guest-banner-text" },
        "둘러보기 모드 · 회원가입하면 직접 사용 가능"),
      h("button", {
        class: "guest-banner-cta",
        onclick: () => location.href = "/register.html",
      }, "지금 가입하기"),
    ]),
  ]);
}

async function renderGuestDashboard() {
  const root = $("#app-root");
  if (!root) return;
  root.innerHTML = "";
  document.body.classList.remove("landing-fullscreen");

  // 상단 배너 (Spec D-Fix-22 Stage B)
  root.appendChild(renderGuestBanner());

  // 사이드바 — preloaded 가짜 데이터 전달 (API 호출 0)
  root.appendChild(await renderSidebar("clients", null, GUEST_CLIENTS, GUEST_STATS));

  const main = h("main", { class: "main" });
  root.appendChild(main);

  // 헤더 — 시간대별 인사 그대로
  main.appendChild(h("header", { class: "main-header" }, [
    h("div", {}, [
      h("h1", {}, getTimeBasedGreeting()),
    ]),
  ]));

  const content = h("div", { class: "main-content" });
  main.appendChild(content);

  // 히어로 배너 5 슬라이드 (정적)
  content.appendChild(renderHero5Slides());

  // 핵심 기능 5 카드 (정적)
  content.appendChild(renderCoreFeatures5());

  // 뉴스 위젯은 API 호출 의존 — 비회원에서는 생략 (Stage B 에서 검토).

  // 하단: 좌 (마감 임박 가짜) / 우 (견본 위젯 — 정적)
  const twoCol = h("div", { class: "dashboard-two-col" });
  content.appendChild(twoCol);

  // [좌] 마감 임박 — GUEST_DEADLINES 로 간단 카드 리스트.
  const leftCol = h("section");
  leftCol.appendChild(renderGuestClosingNotices());
  twoCol.appendChild(leftCol);

  // [우] 견본 위젯 — 그대로 (정적 PDF)
  const rightCol = h("aside", { class: "dashboard-side-col" });
  const sampleWidget = renderSampleWidget();
  if (sampleWidget) rightCol.appendChild(sampleWidget);
  twoCol.appendChild(rightCol);

  // 비회원 진입 모달 호출 X (Spec D-Fix-7 회원 전용 — Stage B 명시 분기는 별도)
}

// 비회원 전용 마감 임박 카드 (Spec D-Fix-22 Stage A) — 실제 위젯과 디자인 정합.
function renderGuestClosingNotices() {
  const wrap = h("div", { class: "card closing-widget" });
  wrap.appendChild(h("div", { class: "closing-widget-head" }, [
    h("span", { class: "closing-widget-icon" }, "🚨"),
    h("h2", { class: "closing-widget-title" }, "D-7 마감임박 공고, NightOff로 도전하세요!"),
  ]));
  const body = h("div", { class: "closing-widget-body" });
  wrap.appendChild(body);
  const list = h("div", { class: "closing-card-list" });
  GUEST_DEADLINES.forEach((n) => {
    const card = h("div", { class: "closing-card" }, [
      h("div", { class: "closing-card-head" }, [
        h("span", { class: "closing-card-dday" }, `D-${n.dDay}`),
        h("span", { class: "closing-card-agency" }, n.agency),
      ]),
      h("p", { class: "closing-card-title" }, n.title),
    ]);
    list.appendChild(card);
  });
  body.appendChild(list);
  return wrap;
}

// 시간대별 인사 (item 11-C)
function getTimeBasedGreeting() {
  const h = new Date().getHours();
  // "야근 OFF · 퇴근 동료" 톤 — 일찍 끝내고 집에 가게 응원
  if (h >= 2 && h < 5)   return "💤 이미 너무 늦었어요. 한 줄만 더 쓰고 자요";
  if (h >= 5 && h < 9)   return "☕ 일찍 시작하셨네요. 오늘은 정시 퇴근해봐요";
  if (h >= 9 && h < 12)  return "☀️ 오늘은 6시에 끝낼 수 있을까요?";
  if (h >= 12 && h < 14) return "🍙 점심은 챙겨 드셨나요?";
  if (h >= 14 && h < 17) return "✏️ 집중하기 딱 좋은 시간이에요";
  if (h >= 17 && h < 19) return "🌅 슬슬 마무리하고 들어가요";
  if (h >= 19 && h < 22) return "🏡 오늘은 이쯤하고 집에 갈까요?";
  return "🌙 야근은 그만! 내일 또 봐요";
}


// ── 오늘의 팁 (PROPOSAL_TIPS + renderTodayTipCard) 은 Spec 4-A (5/16) 폐기.


// ── 오늘의 무료 크레딧 (renderDailyCreditCard + renderCreditQuizSlide /
//    renderCreditLottoSlide / renderCreditFortuneSlide) 은 Spec 4-B (5/16) 폐기.
//    DB 테이블 + users.credit_count 컬럼 은 데이터 보존을 위해 유지.

// 마감일 문자열 → D-day 계산 (RFP 분석에서 가져온 deadline 처리)
// 입력 예: "2026-05-08" / "2026.05.08" / "2026/05/08" / "2026년 5월 8일"
function calcDday(deadlineStr) {
  if (!deadlineStr) return null;
  let m = String(deadlineStr).match(/(\d{4})[\.\-\/년]\s*(\d{1,2})[\.\-\/월]\s*(\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const target = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function ddayBadge(diff) {
  if (diff == null) return null;
  let cls = "dday-far", label = `D-${diff}`;
  if (diff < 0)         { cls = "dday-past"; label = `마감 +${Math.abs(diff)}d`; }
  else if (diff === 0)  { cls = "dday-today"; label = "D-day"; }
  else if (diff <= 2)   cls = "dday-urgent";
  else if (diff <= 6)   cls = "dday-soon";
  else if (diff <= 14)  cls = "dday-mid";
  return h("span", { class: `dday-badge ${cls}`, title: `마감까지 ${diff}일` }, label);
}

// ---------- 📰 업계 뉴스 한 줄 롤링 위젯 (네이버 검색창 영역 패턴) ----------
// 데이터 source: GET /api/dashboard/news (백엔드 캐시 1시간, 구글 뉴스 RSS 통합)
// 표시 영역: 한 줄 (높이 ~44px), 한 번에 1개 뉴스 노출 + fade 전환
// 인터랙션: 6초마다 다음 뉴스로 fade-cross, 좌우 화살표 (수동), hover 시 자동 롤링 정지,
//          카드 클릭 = 새 탭 (target="_blank" + rel="noopener noreferrer")
function renderNewsWidget() {
  const ROLL_MS = 6000;        // 5~7 초 영역 안 (사용자 명시)
  const FADE_MS = 350;         // 300~500ms 영역 안 (사용자 명시)

  const wrap = h("section", { class: "news-widget" });
  const icon = h("span", { class: "news-widget-icon" }, "📰");
  const linkEl = h("a", {
    class: "news-widget-link",
    href: "#",
    target: "_blank",
    rel: "noopener noreferrer",
  }, "뉴스를 불러오는 중…");
  // 좌우 화살표 — 수동 전환 (자동 롤링 reset)
  const prevBtn = h("button", {
    class: "news-widget-arrow",
    "aria-label": "이전",
    type: "button",
  }, "‹");
  const nextBtn = h("button", {
    class: "news-widget-arrow",
    "aria-label": "다음",
    type: "button",
  }, "›");

  wrap.appendChild(icon);
  wrap.appendChild(linkEl);
  wrap.appendChild(prevBtn);
  wrap.appendChild(nextBtn);

  let news = [];
  let idx = 0;
  let rollTimer = null;
  let hovered = false;
  let busy = false;  // fade 영역 중복 트리거 방지

  function applyItem(n) {
    if (n && n.url) {
      linkEl.setAttribute("href", n.url);
      linkEl.classList.remove("disabled");
    } else {
      linkEl.setAttribute("href", "#");
      linkEl.classList.add("disabled");
    }
    linkEl.title = n ? n.title || "" : "";
    linkEl.innerHTML = "";
    linkEl.appendChild(h("span", { class: "news-widget-text-title" }, (n && n.title) || ""));
    if (n && (n.source || n.pub_date)) {
      linkEl.appendChild(h("span", { class: "news-widget-text-sep" }, "·"));
      linkEl.appendChild(h("span", { class: "news-widget-text-meta" },
        [n.source, n.pub_date].filter(Boolean).join(" · ")));
    }
  }

  function fadeTo(nextIdx) {
    if (busy || !news.length) return;
    if (nextIdx === idx) return;
    busy = true;
    linkEl.classList.add("fading");
    setTimeout(() => {
      idx = ((nextIdx % news.length) + news.length) % news.length;
      applyItem(news[idx]);
      // 다음 frame 에서 fade-in
      requestAnimationFrame(() => {
        linkEl.classList.remove("fading");
        busy = false;
      });
    }, FADE_MS);
  }

  function startRoll() {
    if (rollTimer) clearInterval(rollTimer);
    if (news.length <= 1) return;
    rollTimer = setInterval(() => {
      if (hovered) return;
      fadeTo(idx + 1);
    }, ROLL_MS);
  }
  function resetRoll() {
    if (rollTimer) clearInterval(rollTimer);
    startRoll();
  }

  prevBtn.addEventListener("click", (e) => {
    e.preventDefault();
    fadeTo(idx - 1);
    resetRoll();
  });
  nextBtn.addEventListener("click", (e) => {
    e.preventDefault();
    fadeTo(idx + 1);
    resetRoll();
  });
  // url 없으면 클릭 무력화 (보안 + UX)
  linkEl.addEventListener("click", (e) => {
    if (linkEl.classList.contains("disabled")) e.preventDefault();
  });

  // hover 정지 (자연스러운 UX)
  wrap.addEventListener("mouseenter", () => { hovered = true; });
  wrap.addEventListener("mouseleave", () => { hovered = false; });

  function showEmpty() {
    wrap.classList.add("news-widget-static");
    icon.textContent = "📰";
    linkEl.removeAttribute("href");
    linkEl.classList.add("disabled");
    linkEl.innerHTML = "";
    linkEl.appendChild(h("span", { class: "news-widget-text-title" }, "새 뉴스가 없어요"));
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }
  function showError() {
    wrap.classList.add("news-widget-static");
    icon.textContent = "📰";
    linkEl.removeAttribute("href");
    linkEl.classList.add("disabled");
    linkEl.innerHTML = "";
    linkEl.appendChild(h("span", { class: "news-widget-text-title" }, "뉴스를 불러올 수 없어요"));
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  }

  api.get("/api/dashboard/news").then((res) => {
    if (!res || res.error) { showError(); return; }
    news = Array.isArray(res.news) ? res.news : [];
    if (news.length === 0) { showEmpty(); return; }
    idx = 0;
    applyItem(news[0]);
    if (news.length <= 1) {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
    }
    startRoll();
  }).catch(() => showError());

  return wrap;
}


// ---------- 📡 마감 임박 공고 위젯 (대시보드 메인 영역) ----------
// 데이터 source: GET /api/dashboard/closing-notices (백엔드 캐시 1시간)
// 표시 영역: 5개 묶음 + 7초 자동 롤링 + 좌우 화살표 + 도트 인디케이터
// 인터랙션: 카드 클릭 = 새 탭 (target="_blank" + rel="noopener noreferrer")
//          hover 시 자동 롤링 정지, "전체 보기" → 모달
// ⚠ 키워드 6개 영역 = 백엔드 전담, 사용자 노출 X
function renderClosingNoticesWidget() {
  const PAGE_SIZE = 5;
  const ROLL_MS = 7000;

  const wrap = h("div", { class: "card closing-widget" });
  // 헤더
  wrap.appendChild(h("div", { class: "closing-widget-head" }, [
    h("span", { class: "closing-widget-icon" }, "🚨"),
    h("h2", { class: "closing-widget-title" }, "D-7 마감임박 공고, NightOff로 도전하세요!"),
  ]));
  // 본문 (로딩 / 에러 / 빈 / 카드 list)
  const body = h("div", { class: "closing-widget-body" });
  wrap.appendChild(body);
  // 푸터 (도트 인디케이터 + 좌우 화살표 + 전체 보기)
  const footer = h("div", { class: "closing-widget-footer" });
  wrap.appendChild(footer);

  // 초기 로딩
  body.appendChild(h("p", { class: "closing-widget-loading" }, "공고를 불러오는 중…"));

  let notices = [];
  let pageIdx = 0;
  let totalPages = 1;
  let rollTimer = null;
  let hovered = false;

  function startRoll() {
    if (rollTimer) clearInterval(rollTimer);
    if (totalPages <= 1) return;  // 1 페이지 이하 = 롤링 X
    rollTimer = setInterval(() => {
      if (hovered) return;
      pageIdx = (pageIdx + 1) % totalPages;
      renderPage();
    }, ROLL_MS);
  }
  function stopRoll() {
    if (rollTimer) { clearInterval(rollTimer); rollTimer = null; }
  }

  function renderPage() {
    const start = pageIdx * PAGE_SIZE;
    const slice = notices.slice(start, start + PAGE_SIZE);
    body.innerHTML = "";
    const list = h("div", { class: "closing-card-list" });
    slice.forEach((n) => list.appendChild(renderClosingCard(n)));
    body.appendChild(list);
    // 도트 인디케이터 갱신
    const dotsEl = footer.querySelector(".closing-widget-dots");
    if (dotsEl) {
      dotsEl.innerHTML = "";
      for (let i = 0; i < totalPages; i++) {
        const dot = h("button", {
          class: "closing-widget-dot" + (i === pageIdx ? " active" : ""),
          "aria-label": `페이지 ${i + 1}`,
          onclick: () => { pageIdx = i; renderPage(); },
        });
        dotsEl.appendChild(dot);
      }
    }
  }

  function renderEmpty() {
    body.innerHTML = "";
    body.appendChild(h("div", { class: "closing-widget-empty" }, [
      h("div", { class: "closing-widget-empty-icon" }, "📭"),
      h("p", { class: "closing-widget-empty-msg" }, "오늘은 마감 임박 공고가 없어요"),
      h("p", { class: "closing-widget-empty-sub" }, "내일 다시 들러주세요"),
    ]));
  }
  function renderError(msg) {
    body.innerHTML = "";
    body.appendChild(h("div", { class: "closing-widget-empty" }, [
      h("div", { class: "closing-widget-empty-icon" }, "⚠️"),
      h("p", { class: "closing-widget-empty-msg" }, "잠시 정보를 가져올 수 없어요"),
      h("p", { class: "closing-widget-empty-sub" }, msg || "잠시 후 다시 시도해 주세요"),
    ]));
  }

  // hover → 자동 롤링 정지
  wrap.addEventListener("mouseenter", () => { hovered = true; });
  wrap.addEventListener("mouseleave", () => { hovered = false; });

  // 데이터 로드 + 렌더 (비동기)
  api.get("/api/dashboard/closing-notices").then((res) => {
    if (!res || res.error) {
      renderError(res?.error);
      return;
    }
    notices = Array.isArray(res.notices) ? res.notices : [];
    if (notices.length === 0) {
      renderEmpty();
      return;
    }
    totalPages = Math.ceil(notices.length / PAGE_SIZE);
    pageIdx = 0;
    // 푸터 재구성 (좌화살표 + 도트 + 우화살표 + 전체보기)
    footer.innerHTML = "";
    if (totalPages > 1) {
      footer.appendChild(h("button", {
        class: "closing-widget-arrow",
        "aria-label": "이전 페이지",
        onclick: () => { pageIdx = (pageIdx - 1 + totalPages) % totalPages; renderPage(); },
      }, "‹"));
      footer.appendChild(h("div", { class: "closing-widget-dots" }));
      footer.appendChild(h("button", {
        class: "closing-widget-arrow",
        "aria-label": "다음 페이지",
        onclick: () => { pageIdx = (pageIdx + 1) % totalPages; renderPage(); },
      }, "›"));
    }
    footer.appendChild(h("button", {
      class: "closing-widget-all-link",
      onclick: () => openClosingNoticesModal(notices),
    }, `전체 보기 (총 ${notices.length}건)`));
    renderPage();
    startRoll();
  }).catch((e) => {
    renderError(e?.message);
  });

  return wrap;
}

// Spec C-3 (5/18) 신규 — 금액 포맷팅 helper (raw 숫자 → "409,090,909원")
function formatBudget(raw) {
  if (!raw) return null;
  const num = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  if (isNaN(num) || num === 0) return null;
  return `${num.toLocaleString()}원`;
}

function renderClosingCard(n) {
  const dday = Number(n.d_day);
  const urgent = dday >= 0 && dday <= 2;
  // Spec C-3 (5/18): D-day 직관 표기 (오늘/내일/모레/N일)
  let ddayLabel;
  if (dday === 0) ddayLabel = "오늘";
  else if (dday === 1) ddayLabel = "내일";
  else if (dday === 2) ddayLabel = "모레";
  else ddayLabel = `${dday}일`;
  const budgetText = formatBudget(n.budget);
  // ⚠ 카드 클릭 = 새 탭 (target="_blank" + rel="noopener noreferrer")
  const a = h("a", {
    class: "closing-card",
    href: n.url || "#",
    target: "_blank",
    rel: "noopener noreferrer",
  }, [
    h("span", { class: "closing-card-dday" + (urgent ? " urgent" : "") }, ddayLabel),
    h("div", { class: "closing-card-info" }, [
      h("p", { class: "closing-card-title", title: n.title || "" }, n.title || "(제목 없음)"),
      h("p", { class: "closing-card-meta" }, [
        h("span", { class: "closing-card-agency" }, n.agency || "발주기관 미상"),
        budgetText ? h("span", { class: "closing-card-sep" }, "·") : null,
        budgetText ? h("span", { class: "closing-card-budget" }, budgetText) : null,
      ]),
    ]),
    h("span", { class: "closing-card-cta" }, "›"),
  ]);
  // url 없으면 클릭 막기 (보안 + UX)
  if (!n.url) {
    a.addEventListener("click", (e) => e.preventDefault());
    a.classList.add("disabled");
  }
  return a;
}

// "전체 보기" 모달 — 모든 D-7 공고 list (세로 스크롤)
function openClosingNoticesModal(notices) {
  // 기존 모달 제거 (중복 방지)
  document.querySelectorAll(".closing-modal-backdrop").forEach((el) => el.remove());

  const list = h("div", { class: "closing-modal-list" });
  (notices || []).forEach((n) => list.appendChild(renderClosingCard(n)));

  const close = () => {
    backdrop.classList.add("closing-modal-closing");
    setTimeout(() => backdrop.remove(), 180);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  const backdrop = h("div", {
    class: "closing-modal-backdrop",
    onclick: (e) => { if (e.target === backdrop) close(); },
  }, [
    h("div", { class: "closing-modal" }, [
      h("div", { class: "closing-modal-head" }, [
        h("h3", { class: "closing-modal-title" }, "📡 D-7 마감 임박 공고 전체"),
        h("button", { class: "closing-modal-close", "aria-label": "닫기", onclick: close }, "×"),
      ]),
      h("div", { class: "closing-modal-meta" }, `총 ${(notices || []).length}건`),
      list,
    ]),
  ]);
  document.body.appendChild(backdrop);
  document.addEventListener("keydown", onKey);
}


// ---------- 📑 샘플 위젯 (Spec C-3 / C-5 톤 / D-Fix-4 실 데이터 / D-Fix-5 자동 롤링) ----------
// 대시보드 우측 35% 영역. SAMPLE_POOL 영역 데이터 자동 롤링 (6초) + 도트 네비.
// 데이터: 실 데이터 2건 (112의 날 기념식 / 세계유산축전).
// 클릭: openSampleModal → PDF iframe 미리보기 + sticky CTA bar (/client/new).
// hover: 자동 롤링 일시정지 (Hero / 마감 임박 패턴 정합).
const SAMPLE_POOL = [
  {
    id: "sample-1",
    title: "112의 날 기념식",
    agency: "경찰청",
    domain: "행사",
    budget: 0,
    pdfUrl: "/static/samples/sample-1-police-112.pdf",
    thumbnailUrl: "/static/samples/sample-1-police-112-thumb.png",
  },
  {
    id: "sample-2",
    title: "세계유산축전 기념행사",
    agency: "국가유산진흥원",
    domain: "행사",
    budget: 0,
    pdfUrl: "/static/samples/sample-2-heritage.pdf",
    thumbnailUrl: "/static/samples/sample-2-heritage-thumb.png",
  },
];

function renderSampleWidget() {
  if (!SAMPLE_POOL.length) return null;

  // Spec D-Fix-5: 클로저 상태 (Hero 자동 롤링 패턴 정합)
  let idx = 0;
  let hovered = false;

  // 카드 DOM (참조 보관 — 동적 갱신 대상)
  const cardEl = h("button", { class: "sample-card" }, []);

  // 카드 영역 갱신 함수 — idx 기반 SAMPLE_POOL 영역 sample 적용
  function renderCard() {
    const sample = SAMPLE_POOL[idx];
    if (!sample) return;

    // meta children (agency + domain + budget)
    const metaChildren = [
      h("span", {}, sample.agency),
    ];
    if (sample.domain) {
      metaChildren.push(h("span", { class: "sep" }, "·"));
      metaChildren.push(h("span", {}, sample.domain));
    }
    const budgetText = formatBudget(sample.budget);
    if (budgetText) {
      metaChildren.push(h("span", { class: "sep" }, "·"));
      metaChildren.push(h("span", {}, budgetText));
    }

    // thumbnail children (img 또는 CSS fallback)
    const thumbnailChildren = sample.thumbnailUrl
      ? [h("img", { src: sample.thumbnailUrl, alt: sample.title })]
      : [
          h("p", { class: "sample-card-thumbnail-title" }, sample.title),
          h("p", { class: "sample-card-thumbnail-agency" }, sample.agency),
        ];

    // 카드 children 영역 교체
    cardEl.innerHTML = "";
    cardEl.appendChild(h("div", { class: "sample-card-thumbnail" }, thumbnailChildren));
    cardEl.appendChild(h("div", { class: "sample-card-info" }, [
      h("h4", { class: "sample-card-title-text" }, sample.title),
      h("p", { class: "sample-card-meta" }, metaChildren),
      h("p", { class: "sample-card-cta" }, "전체보기 →"),
    ]));
    // onclick — closure idx 영역 참조 (activateSample 영역 갱신됨)
    cardEl.onclick = () => openSampleModal(SAMPLE_POOL[idx]);
  }

  // 도트 영역 (1건 시 hide — Hero 패턴 정합)
  const showDots = SAMPLE_POOL.length > 1;
  const dotEls = showDots
    ? SAMPLE_POOL.map((_, i) => h("button", {
        class: "sample-widget-dot" + (i === 0 ? " active" : ""),
        "aria-label": `샘플 ${i + 1}`,
        type: "button",
      }))
    : [];

  // activateSample 함수 (Hero activateSlide 패턴 정합)
  function activateSample(nextIdx) {
    if (nextIdx === idx || nextIdx < 0 || nextIdx >= SAMPLE_POOL.length) return;
    if (showDots) {
      dotEls[idx].classList.remove("active");
      dotEls[nextIdx].classList.add("active");
    }
    idx = nextIdx;
    renderCard();
  }

  // 도트 클릭 핸들러
  dotEls.forEach((dot, i) => {
    dot.addEventListener("click", () => activateSample(i));
  });

  // widget root
  const widget = h("div", { class: "sample-widget" }, [
    h("div", { class: "sample-widget-head" }, [
      h("span", { class: "sample-widget-icon" }, "📑"),
      h("div", { class: "sample-widget-title-wrap" }, [
        h("h2", { class: "sample-widget-title" }, "제안서 샘플"),
      ]),
      h("span", { class: "sample-widget-badge" }, "FREE"),
    ]),
    cardEl,
    showDots
      ? h("div", { class: "sample-widget-nav" }, [
          h("div", { class: "sample-widget-dots" }, dotEls),
        ])
      : null,
    h("div", { class: "sample-widget-footer" }, [
      h("p", { class: "sample-widget-footer-hint" },
        "실제 수주 제안서로 NightOff 품질을 확인하세요"),
    ]),
  ].filter(Boolean));

  // 초기 카드 렌더
  renderCard();

  // hover 일시정지 (Hero / 마감 임박 패턴 정합)
  widget.addEventListener("mouseenter", () => { hovered = true; });
  widget.addEventListener("mouseleave", () => { hovered = false; });

  // 자동 롤링 6초 + 메모리 안전 (document.body.contains 자동 cleanup — Hero 패턴 정합)
  if (showDots) {
    const timer = setInterval(() => {
      if (!document.body.contains(widget)) {
        clearInterval(timer);
        return;
      }
      if (hovered) return;
      activateSample((idx + 1) % SAMPLE_POOL.length);
    }, 6000);
  }

  return widget;
}

function openSampleModal(sample) {
  // 기존 모달 제거 (중복 방지)
  document.querySelectorAll(".sample-modal-backdrop").forEach((el) => el.remove());

  const backdrop = h("div", { class: "sample-modal-backdrop" });

  const close = () => {
    document.removeEventListener("keydown", onEsc);
    backdrop.remove();
  };
  const onEsc = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onEsc);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  const subtitle = [sample.agency, sample.domain].filter(Boolean).join(" · ");

  const modal = h("div", { class: "sample-modal" }, [
    h("div", { class: "sample-modal-head" }, [
      h("div", { class: "sample-modal-head-info" }, [
        h("h3", { class: "sample-modal-title" }, sample.title),
        h("p", { class: "sample-modal-subtitle" }, subtitle),
      ]),
      h("button", {
        class: "sample-modal-close",
        "aria-label": "닫기",
        onclick: close,
      }, "×"),
    ]),
    h("div", { class: "sample-modal-body" }, [
      h("iframe", {
        class: "sample-modal-pdf",
        src: `${sample.pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`,
        title: sample.title,
      }),
    ]),
    h("div", { class: "sample-modal-cta-bar" }, [
      h("p", { class: "sample-modal-cta-text" },
        "이런 제안서, 직접 만들어보세요"),
      h("button", {
        class: "sample-modal-cta-btn",
        // Spec D-Fix-22 Stage B: 비회원이면 회원가입 유도 모달.
        onclick: () => {
          close();
          if (isGuestMode()) {
            showSignupRequiredModal({ message: "새 과업은 회원가입 후 만들 수 있어요." });
            return;
          }
          navigate("/client/new");
        },
      }, "새 과업 시작 →"),
    ]),
  ]);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}


// ---------- Client Form ----------
const INDUSTRIES = [
  "중앙행정기관",
  "지방자치단체",
  "공공기관/공기업",
  "교육기관",
  "문화/예술기관",
  "의료/복지기관",
  "국방/안보기관",
  "기타 공공기관",
  "민간기업(B2B)",
];

// 과업명 placeholder — 입찰 풀네임 형태 (등록할 때마다 다른 예시 노출)
const TASK_NAME_EXAMPLES = [
  "2026 DMZ OPEN 국제음악제 기획·운영 용역",
  "2026 만석거 새빛축제 행사대행 용역",
  "2026 안전문화 캠페인 기획·홍보 용역",
  "2026 국립중앙박물관 어린이 체험전시 운영 용역",
  "2026 서울시 한강 봄꽃축제 통합 운영 용역",
  "2026 한국관광공사 K-콘텐츠 해외 홍보 용역",
  "2026 부산국제영화제 시민참여 프로그램 운영",
  "2026 한국콘텐츠진흥원 신진 크리에이터 육성사업",
];

async function renderClientForm(mode, id = null) {
  const root = $("#app-root");
  root.innerHTML = "";
  // edit 모드 = 해당 과업이 사이드바에서 active. create 모드 = active 없음.
  root.appendChild(await renderSidebar("clients", mode === "edit" ? id : null));
  const main = h("main", { class: "main" });
  root.appendChild(main);
  main.appendChild(h("header", { class: "main-header" }, [
    h("div", {}, [
      h("h1", {}, mode === "create" ? "새 과업 추가" : "과업 수정"),
      h("p", {}, "과업 기본 정보를 입력하세요"),
    ]),
  ]));

  let data = { name: "", industry: "", manager: "", memo: "" };
  if (mode === "edit" && id) {
    try { data = await api.get(`/api/clients/${id}`); } catch (e) { toast("과업을 불러올 수 없습니다", "error"); return; }
  }

  const form = h("form", {}, [
    h("div", { class: "card", style: "padding: 28px; max-width: 720px;" }, [
      h("div", { class: "row-gap-18" }, [
        h("div", { class: "field" }, [
          h("label", {}, [document.createTextNode("과업명 "), h("span", { style: "color: var(--danger);" }, "*")]),
          h("input", { class: "input", id: "fld-name", value: data.name,
            placeholder: `예: ${TASK_NAME_EXAMPLES[Math.floor(Math.random() * TASK_NAME_EXAMPLES.length)]}` }),
        ]),
        h("div", { class: "field" }, [
          h("label", {}, [document.createTextNode("업종 "), h("span", { style: "color: var(--danger);" }, "*")]),
          (() => {
            const sel = h("select", { class: "select", id: "fld-industry" }, [
              h("option", { value: "" }, "선택하세요"),
              ...INDUSTRIES.map((i) => h("option", { value: i, ...(i === data.industry ? { selected: "" } : {}) }, i)),
            ]);
            return sel;
          })(),
        ]),
        h("div", { class: "field" }, [
          h("label", {}, "담당자"),
          h("input", { class: "input", id: "fld-manager", value: data.manager, placeholder: "예: 김상무" }),
        ]),
        h("div", { class: "field" }, [
          h("label", {}, "메모"),
          h("textarea", { class: "textarea", id: "fld-memo", placeholder: "추가 메모" }, data.memo),
        ]),
      ]),
      h("div", { class: "flex-row", style: "justify-content: flex-end; gap: 8px; margin-top: 24px;" }, [
        h("button", { type: "button", class: "btn btn-ghost", onclick: () => history.back() }, "취소"),
        h("button", {
          type: "button", class: "btn btn-primary",
          onclick: async () => {
            const body = {
              name: $("#fld-name").value.trim(),
              industry: $("#fld-industry").value,
              manager: $("#fld-manager").value.trim(),
              memo: $("#fld-memo").value.trim(),
            };
            if (!body.name) { toast("과업명을 입력하세요", "error"); return; }
            if (!body.industry) { toast("업종을 선택하세요", "error"); return; }
            try {
              if (mode === "create") {
                const r = await api.post("/api/clients", body);
                toast("과업이 추가되었습니다", "success");
                navigate(`/client/${r.id}`);
              } else {
                await api.patch(`/api/clients/${id}`, body);
                toast("수정되었습니다", "success");
                navigate(`/client/${id}`);
              }
            } catch (e) { toast(String(e.message || e), "error"); }
          },
        }, mode === "create" ? "추가" : "저장"),
      ]),
    ]),
  ]);

  const content = h("div", { class: "main-content" }, form);
  main.appendChild(content);
}

// ---------- Client Detail ----------
async function renderClientDetail(cid) {
  const root = $("#app-root");
  root.innerHTML = "";
  // 현재 보고 있는 과업 = 사이드바에서 active 표시 (보라 액센트).
  root.appendChild(await renderSidebar("clients", cid));
  const main = h("main", { class: "main" });
  root.appendChild(main);

  let client = null;
  try {
    client = await api.get(`/api/clients/${cid}`);
  } catch (e) {
    console.error("[renderClientDetail] api/clients/:cid failed:", e);
    // 진짜 404 만 "찾을 수 없음" → 홈으로 이동.
    // 그 외 (5xx, timeout, 네트워크) 는 일시적일 수 있어 인플레이스 재시도 UI 제공.
    if (e?.status === 404) {
      toast("과업을 찾을 수 없습니다", "error");
      navigate("/");
      return;
    }
    // 인플레이스 에러 카드 + 재시도 버튼
    main.appendChild(h("div", {
      style: "padding: 60px 28px; text-align: center; max-width: 640px; margin: 0 auto;",
    }, [
      h("h2", { style: "margin: 0 0 8px; font-size: 18px; font-weight: 700;" }, "과업 정보를 불러오지 못했어요"),
      h("p", { class: "muted small", style: "margin: 0 0 16px;" }, e?.message || String(e)),
      h("div", { style: "display: flex; gap: 10px; justify-content: center;" }, [
        h("button", { class: "btn btn-primary", onclick: () => renderClientDetail(cid) }, "다시 시도"),
        h("button", { class: "btn btn-outline", onclick: () => navigate("/") }, "홈으로"),
      ]),
    ]));
    return;
  }

  main.appendChild(h("header", { class: "main-header" }, [
    h("div", {}, [
      h("h1", {}, client.name),
      h("p", {}, client.industry || "업종 미지정"),
    ]),
    h("div", { class: "flex-row", style: "gap: 8px;" }, [
      h("button", { class: "btn btn-outline", onclick: () => navigate(`/client/${cid}/edit`), html: `${iconHtml("edit", 16)}<span>수정</span>` }),
      h("button", {
        class: "btn btn-danger", html: `${iconHtml("trash", 16)}<span>삭제</span>`,
        onclick: async () => {
          if (!confirm(`${client.name}을(를) 삭제하시겠습니까?\n모든 대화, RFP, 레퍼런스가 함께 삭제됩니다.`)) return;
          await api.del(`/api/clients/${cid}`);
          toast("삭제되었습니다", "success");
          navigate("/");
        },
      }),
    ]),
  ]));

  const content = h("div", { class: "main-content", style: "max-width: 1100px;" });
  main.appendChild(content);

  content.appendChild(h("a", { class: "back-link", href: "/", "data-link": "" }, [
    icon("arrowL", 14), document.createTextNode("과업 목록으로"),
  ]));

  const stack = h("div", { class: "row-gap-18" });
  content.appendChild(stack);

  // 화면 순서:
  //  1️⃣ RFP 분석 (필수 첫 단계)
  //  2️⃣ 📋 입찰참가자격 (RFP 분석 결과 영역 — 자격 데이터 있을 때만 노출)
  //  3️⃣ 발주처 들여다보기 👀 (RFP 분석 후 자동 채워짐)
  //  4️⃣ ✨ 대화 시작 + 🎤 PT 연습 + 🔍 자체 검증 (Task Actions)
  //  📋 대화 기록
  // ── 대화 기억 (renderMemorySection / nuance_memories) 은 Spec 1 (5/16) 폐기 — Intel/RFP 가 커버
  // ── 과업 성향 (renderProfileSection / client_profiles) 은 Spec 2 (5/16) 폐기 — Intel/RFP 가 충분
  const [rfpSec, qualSec, intelSec, historySec] = await Promise.all([
    renderRfpSection(cid),
    renderQualificationsSection(cid),
    renderClientIntelSection(cid, client),
    renderConvHistorySection(cid),
  ]);
  stack.appendChild(rfpSec);
  stack.appendChild(qualSec);
  stack.appendChild(intelSec);

  // 4️⃣ — 핵심 CTA 묶음 (대화 시작 + PT 연습 + 자체 검증)
  stack.appendChild(await renderTaskActionsSection(cid));

  // 📋 대화 기록 (하단)
  stack.appendChild(historySec);
}

// ---------- 핵심 CTA: 대화 시작 + PT 연습 ----------
async function renderTaskActionsSection(cid) {
  // 제안서 1건 이상 작성됐는지 확인 — PT 연습 활성화 조건
  let hasProposal = false;
  try {
    const convs = await api.get(`/api/clients/${cid}/conversations`);
    hasProposal = Array.isArray(convs) && convs.some((c) => (c.msg_count ?? 0) > 1);
  } catch {}

  const startConv = async () => {
    try {
      const r = await api.post(`/api/clients/${cid}/conversations`);
      navigate(`/client/${cid}/chat/${r.id}`);
    } catch (e) { toast(String(e.message || e), "error"); }
  };

  const card = h("section", { class: "task-actions-card" }, [
    h("div", { class: "task-actions-row" }, [
      // 4️⃣ 대화 시작 — 보라 큰 강조 버튼
      h("button", {
        class: "btn btn-primary task-action-cta task-action-primary",
        onclick: startConv,
        html: `<span class="ta-emoji">✨</span><div class="ta-text"><div class="ta-title">대화 시작하기</div><div class="ta-sub">AI 와 함께 제안서 초안을 만들어요</div></div>`,
      }),
      // 5️⃣ PT 연습 — 제안서 완성 후 활성화 (큐시트 + Q&A 모달)
      h("button", {
        class: "btn btn-outline task-action-cta task-action-secondary" + (hasProposal ? "" : " disabled-soft"),
        disabled: !hasProposal,
        title: hasProposal ? "PT 발표 연습을 시작합니다" : "제안서를 먼저 완성하면 활성화돼요",
        onclick: async () => {
          if (!hasProposal) { toast("제안서를 먼저 완성해 주세요 🙂", ""); return; }
          // 가장 최신 대화 ID 가져와서 PT 모달 오픈
          try {
            const convs = await api.get(`/api/clients/${cid}/conversations`);
            const target = (Array.isArray(convs) ? convs : []).find((c) => (c.msg_count ?? 0) > 1);
            if (!target) { toast("작성된 제안서를 찾지 못했어요", "error"); return; }
            openPtPracticeModal(target.id);
          } catch (e) { toast("대화를 불러올 수 없어요", "error"); }
        },
        html: `<span class="ta-emoji">🎤</span><div class="ta-text"><div class="ta-title">PT 연습하기</div><div class="ta-sub">${hasProposal ? "발표 큐시트 · 예상 Q&A" : "제안서 완성 후 활성화"}</div></div>`,
      }),
      // 6️⃣ 자체 검증 — 제안서 완성 후 활성화 (Compliance + Red Team 모달)
      // NightOff 핵심 차별화 영역. AI 가 평가위원처럼 RFP 매핑 + 예상 점수 분석.
      h("button", {
        class: "btn btn-outline task-action-cta task-action-secondary" + (hasProposal ? "" : " disabled-soft"),
        disabled: !hasProposal,
        title: hasProposal ? "AI 가 평가위원처럼 점검합니다 (30~60초)" : "제안서를 먼저 완성하면 활성화돼요",
        onclick: async () => {
          if (!hasProposal) { toast("제안서를 먼저 완성해 주세요 🙂", ""); return; }
          try {
            const convs = await api.get(`/api/clients/${cid}/conversations`);
            const target = (Array.isArray(convs) ? convs : []).find((c) => (c.msg_count ?? 0) > 1);
            if (!target) { toast("작성된 제안서를 찾지 못했어요", "error"); return; }
            openAuditModal(target.id);
          } catch (e) { toast("대화를 불러올 수 없어요", "error"); }
        },
        html: `<span class="ta-emoji">🔍</span><div class="ta-text"><div class="ta-title">자체 검증</div><div class="ta-sub">${hasProposal ? "Compliance + Red Team 점검" : "제안서 완성 후 활성화"}</div></div>`,
      }),
    ]),
  ]);
  return card;
}


// ---------- 🖼 PPTX PNG 미리보기 모달 — 제거됨 (Phase 5 Step 4) ----------
// 호출처(/chat 화면 "🖼 미리보기" 버튼) 가 함께 제거됨 → 사용 0 으로 dead code.


// ---------- 🎤 PT 연습 모달 (큐시트 + 예상 Q&A 두 탭) ----------
function openPtPracticeModal(convId) {
  const backdrop = h("div", { class: "modal-backdrop pt-modal-backdrop" });
  const modal = h("div", { class: "modal pt-modal" });

  // 헤더
  modal.appendChild(h("div", { class: "modal-header" }, [
    h("h3", {}, "🎤 PT 연습"),
    h("button", { class: "icon-btn", onclick: () => backdrop.remove(), "aria-label": "닫기",
      html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` }),
  ]));

  // 탭
  const tabs = h("div", { class: "pt-tabs" }, [
    h("button", { class: "pt-tab active", "data-tab": "script" }, "📝 발표 큐시트"),
    h("button", { class: "pt-tab", "data-tab": "qa" }, "❓ 예상 Q&A"),
  ]);
  modal.appendChild(tabs);

  // 발표 시간 셀렉터 (큐시트 탭에서만)
  const durationRow = h("div", { class: "pt-duration-row" }, [
    h("label", { class: "small muted" }, "발표 시간"),
    h("select", { class: "select", id: "pt-duration" }, [
      h("option", { value: "5" }, "5분"),
      h("option", { value: "10", selected: "" }, "10분"),
      h("option", { value: "15" }, "15분"),
      h("option", { value: "20" }, "20분"),
    ]),
    h("button", { class: "btn btn-primary btn-sm", id: "pt-script-gen" }, "큐시트 만들기"),
  ]);
  modal.appendChild(durationRow);

  const body = h("div", { class: "modal-body pt-body" });
  modal.appendChild(body);

  // 탭 전환
  let currentTab = "script";
  const renderTab = async () => {
    body.innerHTML = '<div class="muted small" style="text-align:center; padding:30px;">선택한 탭을 보려면 위에서 액션을 시작해 주세요</div>';
    durationRow.style.display = currentTab === "script" ? "" : "none";
  };
  tabs.querySelectorAll(".pt-tab").forEach((t) => {
    t.addEventListener("click", () => {
      tabs.querySelectorAll(".pt-tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      currentTab = t.getAttribute("data-tab");
      renderTab();
      if (currentTab === "qa") generateQa();
    });
  });

  // 큐시트 생성
  durationRow.querySelector("#pt-script-gen").addEventListener("click", async () => {
    const duration = parseInt(durationRow.querySelector("#pt-duration").value, 10) || 10;
    body.innerHTML = '<div class="muted small" style="text-align:center; padding:30px;">🌙 큐시트 생성 중…</div>';
    try {
      const r = await api.post("/api/proposals/script", { conversation_id: convId, duration_min: duration }, { timeoutMs: 120000 });
      body.innerHTML = "";
      if (r.intro_tip) body.appendChild(h("div", { class: "pt-tip" }, "💡 " + r.intro_tip));
      (r.slides || []).forEach((s) => {
        body.appendChild(h("div", { class: "pt-slide-card" }, [
          h("div", { class: "pt-slide-head" }, [
            h("span", { class: "pt-slide-num" }, `Slide ${s.page}`),
            h("span", { class: "pt-slide-section" }, s.section || ""),
            h("span", { class: "pt-slide-time" }, s.time_range || `${s.duration_sec}초`),
          ]),
          h("p", { class: "pt-slide-script" }, s.script || ""),
          ...(Array.isArray(s.highlights) && s.highlights.length
              ? [h("div", { class: "pt-slide-highlights" },
                   s.highlights.map((hl) => h("span", { class: "pt-hl-pill" }, hl)))]
              : []),
        ]));
      });
      if (r.closing_tip) body.appendChild(h("div", { class: "pt-tip" }, "🎯 " + r.closing_tip));
    } catch (e) {
      body.innerHTML = "";
      body.appendChild(h("p", { class: "muted small", style: "text-align:center; padding:30px;" },
        "큐시트 생성 실패: " + (e.message || e)));
    }
  });

  // Q&A 생성
  let qaLoaded = false;
  async function generateQa() {
    if (qaLoaded) return;
    body.innerHTML = '<div class="muted small" style="text-align:center; padding:30px;">🌙 예상 질문 생성 중…</div>';
    try {
      const r = await api.post("/api/proposals/qa", { conversation_id: convId }, { timeoutMs: 120000 });
      body.innerHTML = "";
      (r.questions || []).forEach((q, i) => {
        const card = h("div", { class: "pt-qa-card" }, [
          h("div", { class: "pt-qa-head" }, [
            h("span", { class: "pt-qa-cat" }, q.category || ""),
            h("span", { class: "pt-qa-num" }, `Q${i + 1}`),
          ]),
          h("p", { class: "pt-qa-question" }, q.question || ""),
          h("details", { class: "pt-qa-answer" }, [
            h("summary", {}, "💬 모범답변 보기"),
            h("p", { class: "pt-qa-answer-text" }, q.model_answer || ""),
            ...(q.tip ? [h("p", { class: "pt-qa-tip" }, "🎯 " + q.tip)] : []),
          ]),
        ]);
        body.appendChild(card);
      });
      qaLoaded = true;
    } catch (e) {
      body.innerHTML = "";
      body.appendChild(h("p", { class: "muted small", style: "text-align:center; padding:30px;" },
        "Q&A 생성 실패: " + (e.message || e)));
    }
  }

  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.remove(); });
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

// ---------- 수주/탈락 Outcome ----------
const OUTCOME_META = {
  "":            { label: "⏳ 결과 입력",  cls: "outcome-none" },
  "in_progress": { label: "⏳ 진행중",     cls: "outcome-inprogress" },
  "won":         { label: "🏆 수주",       cls: "outcome-won" },
  "lost":        { label: "❌ 탈락",       cls: "outcome-lost" },
};
const OUTCOME_OPTIONS = ["in_progress", "won", "lost", ""];

function outcomeChip(cv, cid) {
  const current = cv.outcome || "";
  const meta = OUTCOME_META[current] || OUTCOME_META[""];
  const wrap = h("div", { class: "outcome-wrap" });
  const chip = h("button", {
    class: `outcome-chip ${meta.cls}`,
    onclick: (e) => { e.stopPropagation(); menu.classList.toggle("open"); },
  }, meta.label);
  const menu = h("div", { class: "outcome-menu" });
  OUTCOME_OPTIONS.forEach((op) => {
    const m = OUTCOME_META[op];
    menu.appendChild(h("button", {
      class: `outcome-menu-item ${m.cls}`,
      onclick: async (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        try {
          await api.patch(`/api/conversations/${cv.id}/outcome`, { outcome: op });
          toast(op ? `상태: ${m.label.replace(" 🏆","")}` : "상태 해제됨", "success");
          renderClientDetail(cid);
        } catch (e) { toast(e.message || "상태 변경 실패", "error"); }
      },
    }, op ? m.label : "상태 해제"));
  });
  wrap.appendChild(chip);
  wrap.appendChild(menu);
  document.addEventListener("click", () => menu.classList.remove("open"), { once: true });
  return wrap;
}

// ---------- Conversation History ----------
async function renderConvHistorySection(cid) {
  const convs = await api.get(`/api/clients/${cid}/conversations`).catch(() => []);
  const card = h("div", { class: "card" });

  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: iconHtml("msg", 18) }),
      h("div", {}, [
        h("h3", { class: "card-title" }, "대화 히스토리"),
        h("p", { class: "card-subtitle" }, `총 ${convs.length}개의 대화`),
      ]),
    ]),
  ]));

  const body = h("div", { class: "card-body" });
  card.appendChild(body);

  // 중복 큰 버튼 제거 — 상단 task-actions-card 의 ✨ 대화 시작하기로 일원화

  if (!convs.length) {
    body.appendChild(h("div", { class: "empty-state", style: "padding: 24px 12px;" }, [
      h("div", { class: "empty-illust empty-illust-sm", html: SVG_ILLUST.clock }),
      h("p", { class: "muted small", style: "margin: 8px 0 0;" },
        "아직 대화가 없어요 · 위 ✨ 대화 시작하기로 첫 페이지를 열어볼까요?"),
    ]));
    return card;
  }

  convs.forEach((cv) => {
    // 저장된 PPTX 가 있으면 다운로드 + "저장된 제안서 보기" 버튼
    const hasPptx = !!(cv.pptx_path);
    const actionBtns = [];
    if (hasPptx) {
      actionBtns.push(h("button", {
        class: "btn btn-tiny btn-outline",
        title: "저장된 제안서 다운로드",
        html: `${iconHtml("file", 12)}<span>PPTX</span>`,
        onclick: (e) => {
          e.stopPropagation();
          // Phase 5 Phase 2 Step 2 — anchor click 우회 (Bearer 헤더 부착 위해 helper 경유)
          downloadPptxAuthenticated(cv.pptx_path, "proposal.pptx");
        },
      }));
      actionBtns.push(h("button", {
        class: "btn btn-tiny btn-ghost",
        title: "저장된 제안서 다시 열람",
        html: `${iconHtml("eye", 12)}<span>제안서</span>`,
        onclick: (e) => {
          e.stopPropagation();
          navigate(`/client/${cid}/chat/${cv.id}`);
        },
      }));
    }
    actionBtns.push(h("button", {
      class: "icon-btn", title: "삭제", html: iconHtml("trash", 16),
      onclick: async (e) => {
        e.stopPropagation();
        if (!confirm("이 대화를 삭제하시겠습니까?")) return;
        await api.del(`/api/conversations/${cv.id}`);
        toast("삭제되었습니다", "success");
        renderClientDetail(cid);
      },
    }));

    const item = h("div", { class: "conv-item" }, [
      h("div", { class: "conv-main", onclick: () => navigate(`/client/${cid}/chat/${cv.id}`) }, [
        h("div", { class: "flex-row", style: "gap: 8px; align-items: center; flex-wrap: wrap;" }, [
          h("h4", { style: "margin: 0; flex: 1; min-width: 0;" }, cv.title),
          hasPptx ? h("span", { class: "badge badge-success", title: "저장된 제안서가 있어요" }, "💾 보관됨") : null,
        ]),
        cv.preview ? h("p", { class: "conv-preview" }, cv.preview) : null,
        h("div", { class: "conv-meta" }, [
          h("span", { class: "flex-row", html: `${iconHtml("calendar", 12)}<span>${fmtDate(cv.created_at)}</span>` }),
          h("span", { class: "flex-row", html: `${iconHtml("msg", 12)}<span>${cv.msg_count || 0}개 메시지</span>` }),
          cv.ended ? h("span", { class: "badge badge-muted" }, "종료됨") : null,
          outcomeChip(cv, cid),
        ]),
      ]),
      h("div", { class: "conv-actions" }, actionBtns),
    ]);
    body.appendChild(item);
  });

  return card;
}

// ---------- 발주처 들여다보기 👀 ----------
async function renderClientIntelSection(cid, clientObj = null) {
  const r = await api.get(`/api/clients/${cid}/intel`).catch(() => ({ intel: {}, updated_at: null }));
  const intel = r?.intel || {};
  // RFP 에서 추출된 발주처(공고기관). 과업명(client.name) 과 분리된 별도 필드.
  const organization = (clientObj && clientObj.organization) ? String(clientObj.organization).trim() : "";
  const hasRfp = !!(clientObj && clientObj.has_rfp);

  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: iconHtml("eye", 18) }),
      h("div", { style: "flex:1; min-width:0;" }, [
        h("h3", { class: "card-title" }, "발주처 들여다보기 👀"),
        h("p", { class: "card-subtitle" },
          organization
            ? `RFP 에서 추출한 발주처: ${organization}`
            : "RFP 를 넣으면 발주처 정보와 과업 내용을 자동으로 파악해요"),
      ]),
      // organization 있으면 작은 배지로도 강조
      organization ? h("span", { class: "intel-org-badge", title: "RFP 에서 자동 추출된 발주처" },
        `🏛 ${organization}`) : null,
    ]),
  ]));

  const body = h("div", { class: "card-body row-gap-12" });
  card.appendChild(body);

  // 인라인 재시도 버튼 — 에러 메시지 옆에 작게
  const inlineRetry = (label = "다시 시도") => h("button", {
    class: "btn btn-outline btn-tiny",
    html: `${iconHtml("refresh", 12) || "↻"}<span>${label}</span>`,
    onclick: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = "조회 중…";
      try {
        await api.post(`/api/clients/${cid}/intel/rebuild`, {}, { timeoutMs: 120000 });
        renderClientDetail(cid);
      } catch (err) {
        toast("조회 실패: " + (err.message || err), "error");
        btn.disabled = false; btn.textContent = label;
      }
    },
  });

  // [구조 강화] organization 이 비어있으면 들여다보기 비활성 — 과업명 검색 사고 방지
  if (!organization) {
    body.appendChild(h("div", { class: "intel-disabled-row" }, [
      h("span", { class: "intel-disabled-emoji" }, "🔒"),
      h("div", { style: "flex: 1; min-width: 0;" }, [
        h("p", { class: "intel-disabled-title" },
          hasRfp
            ? "RFP 에서 발주처를 추출하지 못했어요"
            : "RFP 를 먼저 업로드해 주세요"),
        h("p", { class: "muted small", style: "margin: 4px 0 0;" },
          hasRfp
            ? "RFP 에 발주처(공고기관) 정보가 명확히 적혀있는지 확인해 주세요. RFP 분석을 다시 돌리면 추출이 시도돼요."
            : "발주처 들여다보기는 RFP 에 적힌 발주처(공고기관)만 사용해요. 과업명은 검색에 영향을 주지 않아요."),
      ]),
    ]));
    return card;
  }

  if (!intel || Object.keys(intel).length === 0 || intel.error) {
    if (intel?.error) {
      // 에러 시에만 재시도 버튼 노출
      body.appendChild(h("div", { class: "intel-error-row" }, [
        h("div", { class: "intel-error-msg" }, [
          h("span", { class: "intel-error-badge" }, "⚠"),
          h("span", { class: "muted small" }, intel.error),
        ]),
        inlineRetry("다시 시도"),
      ]));
    } else {
      body.appendChild(h("div", { class: "muted small", style: "padding: 12px 4px;" },
        `'${organization}' 정보를 자동으로 조회 중이에요. 잠시 후 다시 확인해 주세요.`));
    }
    return card;
  }

  // 정상 응답이지만 일부 필드 없을 수 있음 — 채워진 필드만 카운트해서 사용자에게 알림
  const filledCount = [
    (intel.basic_info || {}).official_name || (intel.basic_info || {}).main_role,
    Array.isArray(intel.event_history) && intel.event_history.length,
    Array.isArray(intel.tendency) && intel.tendency.length,
    Array.isArray(intel.communication_tips) && intel.communication_tips.length,
    intel.summary,
  ].filter(Boolean).length;
  body.appendChild(h("div", { class: "intel-status-row" }, [
    h("span", { class: "intel-status-dot" }),
    h("span", { class: "small muted" }, `자동 수집 완료 · 채워진 항목 ${filledCount}/5`),
  ]));

  // 기본 정보
  const bi = intel.basic_info || {};
  if (bi.official_name || bi.main_role) {
    const block = h("div", { class: "intel-block" });
    block.appendChild(h("div", { class: "intel-label" }, "📋 기본 정보"));
    if (bi.official_name) block.appendChild(h("p", { style: "margin: 2px 0; font-weight: 600;" }, bi.official_name));
    if (bi.type) block.appendChild(h("p", { class: "small muted", style: "margin: 2px 0;" }, bi.type));
    if (bi.main_role) block.appendChild(h("p", { class: "small", style: "margin: 4px 0; line-height: 1.55;" }, bi.main_role));
    if (bi.website) block.appendChild(h("a", { href: bi.website, target: "_blank", rel: "noopener", class: "small" }, bi.website));
    body.appendChild(block);
  }

  // 행사 이력
  if (Array.isArray(intel.event_history) && intel.event_history.length) {
    const block = h("div", { class: "intel-block" });
    block.appendChild(h("div", { class: "intel-label" }, "📅 과거 행사·사업 이력"));
    const ul = h("ul", { class: "intel-list" });
    intel.event_history.forEach((e) => ul.appendChild(h("li", {}, e)));
    block.appendChild(ul);
    body.appendChild(block);
  }

  // 성향
  if (Array.isArray(intel.tendency) && intel.tendency.length) {
    const block = h("div", { class: "intel-block" });
    block.appendChild(h("div", { class: "intel-label" }, "🎯 성향·선호 패턴"));
    const tags = h("div", { class: "intel-tags" });
    intel.tendency.forEach((t) => tags.appendChild(h("span", { class: "intel-tag" }, t)));
    block.appendChild(tags);
    body.appendChild(block);
  }

  // 소통 팁
  if (Array.isArray(intel.communication_tips) && intel.communication_tips.length) {
    const block = h("div", { class: "intel-block" });
    block.appendChild(h("div", { class: "intel-label" }, "💬 소통 팁"));
    const ul = h("ul", { class: "intel-list" });
    intel.communication_tips.forEach((t) => ul.appendChild(h("li", {}, t)));
    block.appendChild(ul);
    body.appendChild(block);
  }

  // 요약
  if (intel.summary) {
    body.appendChild(h("div", { class: "intel-summary" }, intel.summary));
  }

  return card;
}

// ---------- RFP Analysis ----------
const ROLE_LABELS = ["공고문", "과업지시서", "제안요청서", "기타"];

async function renderRfpSection(cid) {
  const rfp = await api.get(`/api/clients/${cid}/rfp`).catch(() => ({ has_rfp: false, files: [], analysis: {} }));
  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: iconHtml("fileSearch", 18) }),
      h("div", {}, [
        h("h3", { class: "card-title" }, "RFP 분석"),
        h("p", { class: "card-subtitle" }, "공고문 · 과업지시서 · 제안요청서를 한꺼번에 올릴 수 있어요 (나라장터 분리 입찰 대응)"),
      ]),
    ]),
  ]));

  const body = h("div", { class: "card-body row-gap-14" });
  card.appendChild(body);

  const input = h("input", { type: "file", style: "display: none;", multiple: "", accept: ".pdf,.doc,.docx,.txt,.hwp,.hwpx" });
  input.addEventListener("change", async () => {
    if (input.files.length) openRoleModal(Array.from(input.files));
    input.value = "";
  });
  body.appendChild(input);

  // 업로드 가이드 — 권장 3종 체크리스트 (있으면 좋아요)
  const haveRoles = new Set((rfp.files || []).map((f) => f.role));
  const guide = h("div", { class: "rfp-upload-guide" }, [
    h("p", { class: "rfp-upload-guide-title" }, "있는 파일을 모두 올려주세요. 파일이 많을수록 분석이 정확해져요 😊"),
    h("p", { class: "rfp-upload-guide-sub" }, "공고문 하나만 있어도 분석은 시작돼요. 권장 3종은 아래 체크리스트로 확인하세요."),
    h("div", { class: "rfp-upload-checklist" }, [
      h("span", { class: haveRoles.has("공고문") ? "done" : "" }, "공고문"),
      h("span", { class: haveRoles.has("과업지시서") ? "done" : "" }, "과업지시서"),
      h("span", { class: haveRoles.has("제안요청서") ? "done" : "" }, "제안요청서"),
    ]),
  ]);
  body.appendChild(guide);

  const drop = h("div", { class: "drop-area", onclick: () => input.click() }, [
    h("div", { class: "drop-icon", html: iconHtml("upload", 22) }),
    h("p", { class: "drop-title" }, (rfp.files && rfp.files.length) ? "RFP 파일 추가 업로드" : "RFP 파일 업로드 (여러 개 가능)"),
    h("p", { class: "drop-hint" }, "PDF / Word 지원 — 드롭 또는 클릭, 여러 파일 선택 가능"),
  ]);
  ["dragenter","dragover"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragover"); }));
  ["dragleave","drop"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("dragover"); }));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) openRoleModal(Array.from(e.dataTransfer.files));
  });
  body.appendChild(drop);
  body.appendChild(h("p", { class: "small muted hwp-notice" },
    "HWP 파일은 PDF로 변환 후 업로드해주세요 😊"));

  // Role assignment modal + upload flow
  function openRoleModal(files) {
    const backdrop = h("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === backdrop) backdrop.remove(); } });
    const modal = h("div", { class: "modal", style: "max-width: 560px;" });
    modal.appendChild(h("div", { class: "modal-header" }, [
      h("h3", {}, `업로드할 파일 ${files.length}개`),
      h("button", { class: "icon-btn", onclick: () => backdrop.remove(), html: iconHtml("x", 18) }),
    ]));

    const roleSelects = [];
    const filesList = h("div", { style: "display: flex; flex-direction: column; gap: 10px;" });
    files.forEach((f) => {
      const autoRole = guessRole(f.name);
      const select = h("select", { class: "select" },
        ROLE_LABELS.map((r) => h("option", { value: r, ...(r === autoRole ? { selected: "" } : {}) }, r))
      );
      roleSelects.push(select);
      filesList.appendChild(h("div", { class: "file-row", style: "align-items: center; gap: 10px;" }, [
        h("div", { class: "left", style: "flex: 1; min-width: 0;" }, [
          h("div", { class: "file-icon", html: iconHtml("file", 16) }),
          h("div", { style: "flex: 1; min-width: 0;" }, [
            h("p", { class: "file-name" }, f.name),
            h("p", { class: "file-sub" }, fmtSize(f.size)),
          ]),
        ]),
        h("div", { style: "min-width: 140px;" }, select),
      ]));
    });

    modal.appendChild(h("div", { class: "modal-body" }, [
      h("p", { class: "small muted", style: "margin: 0 0 10px;" }, "각 파일의 역할을 선택해 주세요. 역할에 따라 AI가 추출하는 정보가 달라져요."),
      filesList,
    ]));

    modal.appendChild(h("div", { class: "modal-footer" }, [
      h("button", { class: "btn btn-ghost", onclick: () => backdrop.remove() }, "취소"),
      h("button", { class: "btn btn-primary", onclick: async () => {
        const roles = roleSelects.map((s) => s.value);
        backdrop.remove();
        await doMultiUpload(files, roles);
      } }, "업로드 & 분석"),
    ]));

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  function guessRole(name) {
    const n = (name || "").toLowerCase();
    if (/공고문|공고|announcement|notice|입찰공고/.test(n)) return "공고문";
    if (/과업|task|사업계획|지시서/.test(n)) return "과업지시서";
    if (/제안요청|제안서|rfp/.test(n)) return "제안요청서";
    return "기타";
  }

  async function doMultiUpload(files, roles) {
    const loader = showFullscreenLoader(LOADER_STEPS.rfp);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("roles", JSON.stringify(roles));
      const r = await fetch(`/api/clients/${cid}/rfp/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${getToken()}` },
        body: fd,
      });
      if (r.status === 401) { clearToken(); redirectToLogin(); throw new Error("인증이 만료됐어요."); }
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(err.error || "업로드 실패");
      }
      const result = await r.json();
      if (result?.analysis?.error) {
        loader.finish("⚠️", "업로드 완료 · 분석 실패", 900);
        toast(result.analysis.error, "error");
      } else {
        loader.finish("✅", "분석 완료!", 700);
      }
      // 자격 영역은 발주처 상세 페이지 (renderClientDetail) 의 인라인 카드 영역에서 노출.
      // 모달 영역 hook 제거됨 (3f0b051 영역 → 인라인 카드 변경).
      setTimeout(() => renderClientDetail(cid), 1100);
    } catch (e) {
      loader.stop();
      toast(e.message || "업로드 실패", "error");
    }
  }

  // 파일 리스트 (여러 파일 UI)
  if (rfp.files && rfp.files.length) {
    const fileListCard = h("div", { class: "card", style: "padding: 14px 18px; border: 1px solid var(--border); box-shadow: none;" });
    body.appendChild(fileListCard);
    fileListCard.appendChild(h("div", { class: "flex-between", style: "margin-bottom: 10px;" }, [
      h("h4", { style: "margin: 0; font-size: 14px; font-weight: 700;" }, `업로드된 파일 ${rfp.files.length}개`),
      h("span", { class: "small muted" }, "역할을 바꾸면 자동으로 다시 분석합니다"),
    ]));
    rfp.files.forEach((f) => {
      const roleSel = h("select", { class: "select", style: "height: 34px; font-size: 13px; width: 140px;" },
        ROLE_LABELS.map((r) => h("option", { value: r, ...(r === f.role ? { selected: "" } : {}) }, r))
      );
      roleSel.addEventListener("change", async () => {
        const loader = showFullscreenLoader(LOADER_STEPS.rfp);
        try {
          await api.patch(`/api/clients/${cid}/rfp/files/${f.id}`, { role: roleSel.value });
          loader.finish("✅", "재분석 완료!", 600);
          setTimeout(() => renderClientDetail(cid), 700);
        } catch (e) {
          loader.stop();
          toast(e.message || "역할 변경 실패", "error");
        }
      });
      fileListCard.appendChild(h("div", { class: "file-row", style: "margin-top: 6px;" }, [
        h("div", { class: "left" }, [
          h("div", { class: "file-icon", html: iconHtml("file", 16) }),
          h("div", { style: "min-width: 0; flex: 1;" }, [
            h("p", { class: "file-name" }, f.filename),
            h("p", { class: "file-sub" }, fmtDate(f.created_at)),
          ]),
        ]),
        h("div", { class: "flex-row", style: "gap: 8px;" }, [
          roleSel,
          h("button", {
            class: "icon-btn", title: "삭제", html: iconHtml("x", 16),
            onclick: async () => {
              if (!confirm(`"${f.filename}"을 삭제하시겠습니까?`)) return;
              try {
                await api.del(`/api/clients/${cid}/rfp/files/${f.id}`);
                renderClientDetail(cid);
              } catch (e) { toast(e.message || "삭제 실패", "error"); }
            },
          }),
        ]),
      ]));
    });
  }

  if (rfp.files && rfp.files.length && rfp.analysis && Object.keys(rfp.analysis).length) {
    const a = rfp.analysis;
    const hasAnalysisError = !!a.error;

    // 분석 실패 시 명확한 에러 배너 + 재분석 버튼
    if (hasAnalysisError) {
      const errBanner = h("div", {
        class: "card",
        style: "padding: 16px 18px; border: 1.5px solid var(--danger); background: var(--danger-soft); box-shadow: none;"
      }, [
        h("div", { class: "flex-between" }, [
          h("div", { class: "flex-row", style: "gap: 10px; align-items: flex-start;" }, [
            h("span", { style: "font-size: 20px;" }, "⚠️"),
            h("div", {}, [
              h("p", { style: "margin: 0 0 4px; font-weight: 700; color: var(--danger);" }, "RFP 분석이 완료되지 않았어요"),
              h("p", { style: "margin: 0; font-size: 13px; color: var(--fg); line-height: 1.5;" }, a.error),
            ]),
          ]),
          h("button", {
            class: "btn btn-outline",
            style: "flex-shrink: 0;",
            onclick: async () => {
              const loader = showFullscreenLoader(LOADER_STEPS.rfp);
              try {
                const firstFile = rfp.files[0];
                await api.patch(`/api/clients/${cid}/rfp/files/${firstFile.id}`, { role: firstFile.role });
                loader.finish("✅", "재분석 완료!", 600);
                setTimeout(() => renderClientDetail(cid), 700);
              } catch (e) {
                loader.stop();
                toast(e.message || "재분석 실패", "error");
              }
            },
            html: `${iconHtml("trending", 14)}<span>다시 분석</span>`,
          }),
        ]),
      ]);
      body.appendChild(errBanner);
      return card;  // 에러 상태에서는 빈 분석 카드를 보여주지 않음
    }

    const result = h("div", { class: "card", style: "padding: 20px; border: 1px solid var(--border); box-shadow: none;" });
    body.appendChild(result);

    result.appendChild(h("div", { class: "flex-between" }, [
      h("div", {}, [
        h("h4", { style: "margin: 0 0 4px; font-size: 16px; font-weight: 600;" }, a.title || "RFP 통합 분석"),
        h("p", { class: "small muted", style: "margin: 0;" }, `파일 ${rfp.files.length}개 통합 분석`),
      ]),
      h("div", { class: "flex-row", style: "gap: 6px;" }, [
        h("span", { class: "badge badge-success", html: `${iconHtml("check", 12)}<span>분석 완료</span>` }),
        h("button", {
          class: "icon-btn", title: "전체 RFP 삭제", html: iconHtml("trash", 16),
          onclick: async () => {
            if (!confirm("업로드된 모든 RFP 파일을 삭제하시겠습니까?")) return;
            await api.del(`/api/clients/${cid}/rfp`);
            toast("삭제되었습니다", "success");
            renderClientDetail(cid);
          },
        }),
      ]),
    ]));

    // ── (상단) 배지 3개 — 마감일 / 예산 / 형식
    const formatLabel = (a.orientation === "portrait" ? "A4 세로" : "A4 가로")
                       + (a.page_limit ? ` · ${a.page_limit}p` : "");
    result.appendChild(h("div", { class: "rfp-badges", style: "margin-top: 16px;" }, [
      h("div", { class: "rfp-badge" }, [
        h("span", { style: "font-size:18px;" }, "📅"),
        h("div", {}, [
          h("div", { class: "rfp-badge-label" }, "마감일"),
          h("div", { class: "rfp-badge-value" }, a.deadline || "미명시"),
        ]),
      ]),
      h("div", { class: "rfp-badge" }, [
        h("span", { style: "font-size:18px;" }, "💰"),
        h("div", {}, [
          h("div", { class: "rfp-badge-label" }, "예상 예산"),
          h("div", { class: "rfp-badge-value" }, a.budget || "미명시"),
        ]),
      ]),
      h("div", { class: "rfp-badge" }, [
        h("span", { style: "font-size:18px;" }, "📐"),
        h("div", {}, [
          h("div", { class: "rfp-badge-label" }, "제안서 형식"),
          h("div", { class: "rfp-badge-value" }, formatLabel),
        ]),
      ]),
    ]));

    // ── (중단) 평가 배점 (풀폭) → 그 아래 요구사항 (풀폭) — 1열 스택으로 가독성 ↑
    const middleGrid = h("div", { class: "rfp-grid-stack" });

    // 좌: 평가 기준 배점 — 부모 카드 2열 grid + 자식 들여쓰기 + 가로 막대
    if (a.evaluation_criteria?.length) {
      const crit = [...a.evaluation_criteria].map((ec) => {
        const m = String(ec.weight || "").match(/(\d+(?:\.\d+)?)/);
        return { item: ec.item || "", weight: m ? parseFloat(m[1]) : 0, raw: ec.weight };
      }).filter((c) => c.item);
      const chart = buildScoreBarChart(crit);
      middleGrid.appendChild(h("div", { class: "rfp-radar-wrap" }, [
        h("p", { class: "rfp-radar-title" }, `📊 평가 기준 배점 (총 ${crit.length}개 항목)`),
        chart,
      ]));
    } else {
      middleGrid.appendChild(h("div", { class: "rfp-radar-wrap" }, [
        h("p", { class: "rfp-radar-title" }, "📊 평가 기준 배점"),
        h("p", { class: "small muted", style: "margin: 8px 0;" }, "평가 기준 정보를 추출하지 못했어요."),
      ]));
    }

    // 우: 주요 요구사항 체크리스트
    if (a.key_requirements?.length) {
      const checklist = h("ul", { class: "rfp-checklist" },
        a.key_requirements.map((r) => h("li", {}, r)));
      middleGrid.appendChild(h("div", { class: "rfp-checklist-wrap" }, [
        h("p", { class: "rfp-radar-title" }, `✅ 주요 요구사항 (${a.key_requirements.length}개)`),
        checklist,
      ]));
    } else {
      middleGrid.appendChild(h("div", { class: "rfp-checklist-wrap" }, [
        h("p", { class: "rfp-radar-title" }, "✅ 주요 요구사항"),
        h("p", { class: "small muted", style: "margin: 8px 0;" }, "요구사항을 추출하지 못했어요."),
      ]));
    }
    result.appendChild(middleGrid);

    // ── (하단) 리스크 / 주의사항 경고 배지
    if (a.risk_points?.length) {
      result.appendChild(h("div", { class: "rfp-risks" }, [
        h("p", { class: "rfp-risks-title" },
          [document.createTextNode("⚠️ 리스크 / 주의사항")]),
        h("ul", {}, a.risk_points.map((p) => h("li", {}, p))),
      ]));
    }

    // 요약 (전체 한 줄)
    if (a.summary) {
      result.appendChild(h("div", {
        style: "margin-top: 14px; padding: 12px 14px; background: var(--primary-soft); " +
               "border-left: 4px solid var(--primary); border-radius: 8px; " +
               "font-size: 14px; color: var(--fg); line-height: 1.6; font-style: italic;"
      }, a.summary));
    }
  }

  return card;
}

// ---------- 평가 기준 배점 (가로 막대 차트) ----------
// 부모-자식 관계 자동 추출(자식은 "- " "· " "ㅇ " "○ " 등 prefix), 부모는 점수 큰 순 정렬,
// 카드 2열 grid, 자식은 부모 아래 들여쓰기. 13개 등 모든 항목 표시 (제한 없음).
function buildScoreBarChart(items) {
  const wrap = h("div", { class: "score-chart-wrap" });
  if (!items || items.length === 0) {
    wrap.appendChild(h("p", { class: "small muted" }, "평가 기준 정보가 없어요."));
    return wrap;
  }

  // ── 1) 부모/자식 분리: 이름 앞 prefix 로 판별
  const CHILD_PREFIX_RE = /^\s*[-·•◦∙ㅇ○]\s+/;
  const stripPrefix = (s) => String(s || "").replace(CHILD_PREFIX_RE, "").trim();
  const isChild = (s) => CHILD_PREFIX_RE.test(String(s || ""));

  // 평면 배열을 순서대로 훑어 부모 그룹으로 묶음
  const groups = [];   // [{parent: {item, weight, raw}, children: [...]}]
  let curParent = null;
  for (const it of items) {
    if (isChild(it.item)) {
      const child = { ...it, item: stripPrefix(it.item) };
      if (!curParent) {
        // 부모 없이 자식 먼저 — 가상 부모 생성
        curParent = { parent: { item: "기타", weight: 0, raw: "" }, children: [] };
        groups.push(curParent);
      }
      curParent.children.push(child);
    } else {
      curParent = { parent: { ...it }, children: [] };
      groups.push(curParent);
    }
  }

  // ── 2) 부모는 점수 큰 순으로 정렬 (자식 순서는 원본 유지)
  groups.sort((a, b) => (b.parent.weight || 0) - (a.parent.weight || 0));

  // 각 그룹별 자식 정규화 max (부모 안에서만 비교)
  const maxParentW = Math.max(1, ...groups.map((g) => g.parent.weight || 0));

  // ── 3) 부모 카드 2열 grid 렌더
  const grid = h("div", { class: "score-grid" });
  groups.forEach((g) => {
    const card = h("div", { class: "score-card" });

    // 부모 헤더 — 큰 막대
    const parentRow = h("div", { class: "score-row score-row-parent" });
    parentRow.appendChild(h("div", { class: "score-name" }, g.parent.item));
    const pBarBox = h("div", { class: "score-bar-box" });
    const pBarFill = h("div", { class: "score-bar-fill score-bar-parent" });
    const pRatio = (g.parent.weight || 0) / maxParentW;
    pBarFill.style.width = `${Math.max(2, pRatio * 100)}%`;
    pBarBox.appendChild(pBarFill);
    parentRow.appendChild(pBarBox);
    parentRow.appendChild(h("div", { class: "score-weight score-weight-parent" },
      g.parent.raw || `${g.parent.weight}점`));
    card.appendChild(parentRow);

    // 자식 행들 — 부모 아래 들여쓰기 + 얇은 막대
    if (g.children.length) {
      const childMaxW = Math.max(1, ...g.children.map((c) => c.weight || 0));
      const childList = h("div", { class: "score-children" });
      g.children.forEach((c) => {
        const row = h("div", { class: "score-row score-row-child" });
        row.appendChild(h("div", { class: "score-name score-name-child" }, c.item));
        const barBox = h("div", { class: "score-bar-box" });
        const barFill = h("div", { class: "score-bar-fill score-bar-child" });
        const ratio = (c.weight || 0) / childMaxW;
        barFill.style.width = `${Math.max(3, ratio * 100)}%`;
        barBox.appendChild(barFill);
        row.appendChild(barBox);
        row.appendChild(h("div", { class: "score-weight score-weight-child" },
          c.raw || `${c.weight}점`));
        childList.appendChild(row);
      });
      card.appendChild(childList);
    }
    grid.appendChild(card);
  });
  wrap.appendChild(grid);

  // 합계 footer
  const total = groups.reduce((s, g) => s + (g.parent.weight || 0), 0);
  if (total > 0) {
    // 자식이 있는 케이스 (계층 구조) 와 평면 리스트 케이스를 구분해 자연스럽게 표기
    const hasChildren = groups.some((g) => g.children && g.children.length > 0);
    const label = hasChildren
      ? `합계 ${total}점 · 대분류 ${groups.length}개 / 세부 ${items.length}개`
      : `합계 ${total}점 · 평가 항목 ${items.length}개`;
    wrap.appendChild(h("p", { class: "score-total small muted" }, label));
  }
  return wrap;
}

// ---------- Chat Screen ----------
async function renderChat(cid, convId) {
  const root = $("#app-root");
  root.innerHTML = "";
  // 우측 패널 (right-panel-off) 토글은 Spec 5 (5/16) 폐기 — 우측 사이드바 자체 제거됨.

  let data = null;
  try {
    data = await api.get(`/api/conversations/${convId}`);
  } catch (e) {
    if (e?.status === 404) {
      toast("대화를 찾을 수 없습니다", "error");
    } else {
      toast(`대화 로드 실패: ${e?.message || e}`, "error");
      console.error("[renderChat] api/conversations/:id failed:", e);
    }
    navigate(`/client/${cid}`);
    return;
  }

  // 채팅 중인 과업 = 사이드바에서 active 표시.
  root.appendChild(await renderSidebar("clients", cid));

  // 좌우 분할 컨테이너 — 좌: 대화 / 우: 제안서 미리보기 (제안서 생성 시 자동 노출)
  const splitWrap = h("main", { class: "chat-split-wrap" });
  root.appendChild(splitWrap);

  const shell = h("section", { class: "chat-shell" });
  splitWrap.appendChild(shell);

  // 우측 사이드 패널 — 처음엔 숨김. 제안서 HTML 감지 시 활성화
  const sidePanel = h("aside", { class: "proposal-side-panel hidden" });
  splitWrap.appendChild(sidePanel);

  // 슬라이드쇼 상태 — splitWrap scope 에 보관
  let slideIdx = 0;        // 현재 보고 있는 슬라이드
  let totalSlides = 0;
  let liveFollow = true;   // 사용자가 직접 ◀▶ 누르기 전엔 자동 라이브 따라가기

  // 사이드 패널 활성화 — 슬라이드쇼 모드 (item 13)
  function activateSidePanel(propEl, isFinal) {
    splitWrap.classList.add("split-active");
    sidePanel.classList.remove("hidden");

    if (!propEl) return;
    const slides = Array.from(propEl.querySelectorAll(".proposal-page"));
    totalSlides = slides.length;
    if (totalSlides === 0) return;

    // 첫 진입이면 마지막 슬라이드(라이브 따라가기) 또는 1번부터
    if (liveFollow) {
      slideIdx = isFinal ? 0 : totalSlides - 1;
    }
    // 슬라이드 인덱스 보호
    if (slideIdx >= totalSlides) slideIdx = totalSlides - 1;
    if (slideIdx < 0) slideIdx = 0;

    sidePanel.innerHTML = "";

    // 헤더 — 라벨 + 제목 + 인디케이터 + 닫기
    sidePanel.appendChild(h("div", { class: "side-panel-head" }, [
      h("div", { class: "sp-head-left" }, [
        h("p", { class: "side-panel-label" }, isFinal ? "✅ 미리보기" : "⏳ 작성 중"),
        h("p", { class: "side-panel-title" }, propEl.getAttribute("data-title") || "제안서"),
      ]),
      h("div", { class: "sp-head-right" }, [
        h("span", { class: "sp-page-indicator" }, `${slideIdx + 1} / ${totalSlides}`),
        h("button", {
          class: "icon-btn",
          title: "사이드 패널 닫기",
          html: iconHtml("x", 18),
          onclick: () => {
            splitWrap.classList.remove("split-active");
            sidePanel.classList.add("hidden");
          },
        }),
      ]),
    ]));

    // 무대 — 한 슬라이드만 풀 디스플레이
    const stage = h("div", { class: "side-panel-stage slideshow-stage" });
    const currentSlide = slides[slideIdx].cloneNode(true);
    currentSlide.classList.add("side-panel-mode");
    currentSlide.querySelectorAll(".keyword-row, .image-credit").forEach((e) => e.remove());
    stage.appendChild(currentSlide);
    sidePanel.appendChild(stage);

    // 하단 컨트롤 — ◀ ●●●○○○○○○○ ▶
    const goTo = (newIdx, fromUser = false) => {
      if (fromUser) liveFollow = false;
      slideIdx = Math.max(0, Math.min(totalSlides - 1, newIdx));
      activateSidePanel(propEl, isFinal);
    };
    const prevBtn = h("button", {
      class: "sp-nav-btn", disabled: slideIdx === 0,
      title: "이전 (←)",
      onclick: () => goTo(slideIdx - 1, true),
      html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    });
    const nextBtn = h("button", {
      class: "sp-nav-btn", disabled: slideIdx === totalSlides - 1,
      title: "다음 (→)",
      onclick: () => goTo(slideIdx + 1, true),
      html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    });
    const dotsRow = h("div", { class: "sp-dots" });
    slides.forEach((_, i) => {
      dotsRow.appendChild(h("span", {
        class: "sp-dot" + (i === slideIdx ? " active" : ""),
        title: `${i + 1} 페이지`,
        onclick: () => goTo(i, true),
      }));
    });
    // 라이브 모드 토글 — 사용자가 ◀▶ 직접 눌러서 liveFollow=false 인 경우 복귀 옵션
    const liveBtn = h("button", {
      class: "sp-live-btn" + (liveFollow ? " active" : ""),
      title: liveFollow ? "라이브 따라가기 ON" : "라이브 따라가기 OFF — 클릭 시 최신으로 점프",
      onclick: () => {
        liveFollow = !liveFollow;
        if (liveFollow) goTo(totalSlides - 1, false);
        else activateSidePanel(propEl, isFinal);
      },
    }, liveFollow ? "🔴 LIVE" : "📌 고정");

    sidePanel.appendChild(h("div", { class: "side-panel-controls" }, [
      prevBtn,
      h("div", { style: "flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;" }, [
        dotsRow,
        liveBtn,
      ]),
      nextBtn,
    ]));
  }

  // 키보드 ← → 단축키
  const onKey = (e) => {
    if (sidePanel.classList.contains("hidden")) return;
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === "ArrowLeft" && slideIdx > 0) {
      liveFollow = false;
      const propEl = document.querySelector(".proposal-hidden .proposal");
      if (propEl) {
        slideIdx--;
        activateSidePanel(propEl, false);
      }
    } else if (e.key === "ArrowRight" && slideIdx < totalSlides - 1) {
      liveFollow = false;
      const propEl = document.querySelector(".proposal-hidden .proposal");
      if (propEl) {
        slideIdx++;
        activateSidePanel(propEl, false);
      }
    }
  };
  document.addEventListener("keydown", onKey);

  // 글로벌 노출 — renderAssistant 가 호출 (HTML 모드용)
  shell._activateSidePanel = activateSidePanel;

  // ────────────────────────────────────────────────────────────
  // [Phase 3-D + B7] PNG 모드 사이드패널 — JSON 흐름의 우측 미리보기
  // state: 'preparing' | 'building' | 'rendering' | 'ready' | 'error'
  // ────────────────────────────────────────────────────────────
  let pngSlideIdx = 0;
  function setSidePanelPng(state, payload = {}) {
    splitWrap.classList.add("split-active");
    sidePanel.classList.remove("hidden");
    sidePanel.innerHTML = "";

    const stateLabels = {
      preparing: { emoji: "✨", text: "제안서 구조를 설계하고 있어요…" },
      building:  { emoji: "🔨", text: "PPTX 로 변환하고 있어요…" },
      rendering: { emoji: "🖼", text: "슬라이드 미리보기를 만들고 있어요…" },
      ready:     { emoji: "✅", text: "제안서가 완성됐어요" },
      error:     { emoji: "⚠️", text: payload.error || "미리보기를 만들지 못했어요" },
    };
    const label = stateLabels[state] || stateLabels.preparing;
    const isReady = state === "ready" && Array.isArray(payload.slides) && payload.slides.length > 0;

    // 헤더
    sidePanel.appendChild(h("div", { class: "side-panel-head" }, [
      h("div", { class: "sp-head-left" }, [
        h("p", { class: "side-panel-label" }, `${label.emoji} ${isReady ? "미리보기" : "작성 중"}`),
        h("p", { class: "side-panel-title" },
          isReady ? `${payload.slides.length} 장의 슬라이드` : label.text),
      ]),
      h("div", { class: "sp-head-right" }, [
        isReady ? h("span", { class: "sp-page-indicator" },
          `${pngSlideIdx + 1} / ${payload.slides.length}`) : null,
        h("button", {
          class: "icon-btn",
          title: "사이드 패널 닫기",
          html: iconHtml("x", 18),
          onclick: () => {
            splitWrap.classList.remove("split-active");
            sidePanel.classList.add("hidden");
          },
        }),
      ]),
    ]));

    // 본문 — state 별로 다른 UI
    const stage = h("div", { class: "side-panel-stage png-stage" });
    if (isReady) {
      // 큰 슬라이드 PNG
      if (pngSlideIdx >= payload.slides.length) pngSlideIdx = payload.slides.length - 1;
      if (pngSlideIdx < 0) pngSlideIdx = 0;
      const cur = payload.slides[pngSlideIdx];
      stage.appendChild(h("div", { class: "png-slide-frame" }, [
        h("img", { class: "png-slide-img", src: cur.url + "?t=" + Date.now(), alt: `슬라이드 ${pngSlideIdx + 1}` }),
      ]));
    } else if (state === "error") {
      stage.appendChild(h("div", { class: "png-stage-error" }, [
        h("div", { class: "png-stage-emoji" }, "⚠️"),
        h("p", {}, label.text),
      ]));
    } else {
      // 작업 중 — 큰 placeholder + 단계 표시
      stage.appendChild(h("div", { class: "png-stage-placeholder" }, [
        h("div", { class: "png-placeholder-emoji" }, label.emoji),
        h("div", { class: "png-placeholder-spinner" }),
        h("p", { class: "png-placeholder-text" }, label.text),
        // 단계 progress
        h("div", { class: "png-stage-steps" }, [
          h("span", { class: "step" + (state === "preparing" ? " active" : (["building","rendering","ready"].includes(state) ? " done" : "")) }, "1. 설계"),
          h("span", { class: "step-arrow" }, "→"),
          h("span", { class: "step" + (state === "building" ? " active" : (["rendering","ready"].includes(state) ? " done" : "")) }, "2. 변환"),
          h("span", { class: "step-arrow" }, "→"),
          h("span", { class: "step" + (state === "rendering" ? " active" : (state === "ready" ? " done" : "")) }, "3. 미리보기"),
        ]),
      ]));
    }
    sidePanel.appendChild(stage);

    // 컨트롤 — ready 일 때만
    if (isReady) {
      const slides = payload.slides;
      const goTo = (i) => {
        pngSlideIdx = Math.max(0, Math.min(slides.length - 1, i));
        setSidePanelPng("ready", payload);
      };
      const prevBtn = h("button", {
        class: "sp-nav-btn", disabled: pngSlideIdx === 0,
        title: "이전 (←)", onclick: () => goTo(pngSlideIdx - 1),
        html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
      });
      const nextBtn = h("button", {
        class: "sp-nav-btn", disabled: pngSlideIdx === slides.length - 1,
        title: "다음 (→)", onclick: () => goTo(pngSlideIdx + 1),
        html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
      });
      // 썸네일 스트립
      const strip = h("div", { class: "png-thumb-strip" },
        slides.map((s, i) => h("img", {
          class: "png-thumb" + (i === pngSlideIdx ? " active" : ""),
          src: s.url + "?t=" + Date.now(),
          title: `슬라이드 ${i + 1}`,
          onclick: () => goTo(i),
        }))
      );
      // 다운로드 버튼
      const dlBtn = payload.pptxUrl ? h("a", {
        class: "btn btn-primary sp-download-btn",
        href: payload.pptxUrl,
        download: "",
        html: `<span>⬇ PPTX 다운로드</span>`,
      }) : null;

      sidePanel.appendChild(h("div", { class: "side-panel-controls png-controls" }, [
        prevBtn, strip, nextBtn,
      ]));
      if (dlBtn) sidePanel.appendChild(h("div", { class: "sp-download-row" }, [dlBtn]));
    }
  }
  // 글로벌 노출 — 채팅 스트리밍 핸들러가 호출
  shell._setSidePanelPng = setSidePanelPng;

  // Detect context injection flags
  // Spec 1 (5/16) 폐기: memory inject 제거 → injected.memory + 호출 제거
  const injected = {
    rfp: !!data.rfp_analysis,
    refs: false,
  };
  try {
    const r = await api.get(`/api/clients/${cid}/references`); injected.refs = r.length > 0;
  } catch {}

  const pageLimit = data.rfp_analysis?.page_limit;

  // Header
  const header = h("header", { class: "chat-header" }, [
    h("div", { class: "left" }, [
      h("button", {
        class: "icon-btn", html: iconHtml("arrowL", 20),
        onclick: () => navigate(`/client/${cid}`),
      }),
      h("div", { style: "height: 24px; width: 1px; background: var(--border);" }),
      h("div", {}, [
        h("p", { class: "client-name" }, data.client.name),
        h("h1", { class: "chat-title" }, data.conversation.title),
      ]),
    ]),
    h("div", { class: "flex-row", style: "gap: 12px;" }, [
      pageLimit ? h("span", { class: "page-limit-badge" }, `최대 ${pageLimit}페이지`) : null,
      h("div", { class: "context-badges" }, [
        injected.rfp ? h("span", { class: "badge badge-primary" }, "RFP") : null,
        injected.refs ? h("span", { class: "badge badge-primary" }, "레퍼런스") : null,
      ]),
      // 포인트 컬러 피커
      h("label", {
        class: "accent-picker", title: "과업 포인트 컬러",
      }, [
        h("span", { class: "accent-dot" }),
        h("input", {
          type: "color",
          value: "#6b46e5",
          onchange: async (e) => {
            const v = e.target.value;
            try {
              await api.patch(`/api/clients/${cid}/accent`, { accent: v });
              toast("포인트 컬러가 적용되었습니다", "success");
              // 현재 렌더된 제안서에도 즉시 반영
              document.querySelectorAll(".proposal").forEach((el) => el.style.setProperty("--proposal-accent", v));
            } catch (err) { toast(err.message || "컬러 적용 실패", "error"); }
          },
        }),
      ]),
      // ✨ 제안서 생성 (multi-pass) — Phase 4 (Step 3) 페이지 기반 크레딧 표시
      (function () {
        const q = (window.__nightoff_user && window.__nightoff_user.quota) || null;
        const propRemain = q ? q.proposal_remaining : null;
        // CREDITS_PER_PAGE (L284 module-level 정의, Step 2-A: 1p = 100 크레딧) 활용
        const propPagesNow = q ? Math.floor((propRemain || 0) / CREDITS_PER_PAGE) : 0;
        const exhausted = q && propRemain < CREDITS_PER_PAGE;  // 1 페이지 분 미만이면 disabled
        const badgeHtml = q
          ? `<span id="proposal-quota-badge" class="btn-quota-badge${exhausted ? " quota-exhausted" : ""}">${propPagesNow}p</span>`
          : "";
        const labelHtml = `<span style="margin-right:4px;">✨</span><span>제안서 생성</span>${badgeHtml}`;
        return h("button", {
          id: "sparkle-generate-btn",
          class: "btn btn-primary sparkle-generate-btn" + (exhausted ? " btn-quota-disabled" : ""),
          html: labelHtml,
          title: exhausted
            ? "제안서 크레딧이 1페이지(100) 미만 — 다음 달 1일 리셋"
            : (q ? `남은 크레딧: ${(propRemain).toLocaleString("ko-KR")} (≈${propPagesNow}페이지)` : "제안서 생성"),
          disabled: exhausted ? "" : null,
          onclick: async () => {
          // Phase 4 (Step 3) — 1 페이지 분(100 크레딧) 미만이면 거부. window.__nightoff_user.quota 직접 참조.
          const liveQ = (window.__nightoff_user && window.__nightoff_user.quota) || null;
          if (liveQ && liveQ.proposal_remaining < CREDITS_PER_PAGE) {
            toast("제안서 크레딧이 부족해요 (1페이지 = 100 크레딧) — 다음 달 1일 리셋", "error", 5000);
            return;
          }
          // Step 2 — 페이지 선택 모달 표시 → 사용자 선택 후 콜백에서 실제 생성 진행
          // pageLimit (line 4196) 전달 — 모달이 권장 배지 동적 매핑 + 초과 경고
          showProposalPageSelectionModal((selectedPages) => {
            // 채팅 input 영역에 진행률 표시 — 가짜 user 메시지로 시각화
            const msgs = document.getElementById("chat-messages") || document.querySelector(".chat-messages");
            if (!msgs) { toast("채팅 영역을 못 찾았어요", "error"); return; }
            const userBubble = h("div", { class: "msg-row user" }, [
              h("div", { class: "msg-body" }, [
                h("div", { class: "msg-bubble" }, `✨ 제안서 생성 (${selectedPages}페이지)`),
              ]),
            ]);
            msgs.appendChild(userBubble);
            // 5초 toast — 작업 시간 + 페이지 이동 경고
            toast(`${selectedPages}페이지 생성 시작 — 5~10분 소요. 페이지 이동·새로고침 X`, "", 5000);
            const asstEl = msgElement("assistant", "", new Date().toISOString());
            msgs.appendChild(asstEl);
            const bubble = asstEl.querySelector(".msg-bubble");
            bubble.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
            const progress = createStreamProgress();
            asstEl.querySelector(".msg-body").insertBefore(progress.el, bubble);
            const body = msgs.parentElement || document.body;
            (async () => {
              try {
                await runMultiPassProposal({ convId, pages: selectedPages, asstEl, bubble, progress, body, msgs });
              } catch (e) {
                console.error("multi-pass 실패:", e);
                // 실패 시 inline 재시도 버튼 — history 보존 (사용자 결정 Q4 옵션 a)
                bubble.innerHTML =
                  `<div style="color:var(--danger); margin-bottom:8px;">❌ ${escapeHtml(e.message || String(e))}</div>` +
                  `<button class="mp-retry-btn" type="button">🔄 다시 시도</button>`;
                const retryBtn = bubble.querySelector(".mp-retry-btn");
                if (retryBtn) retryBtn.addEventListener("click", (ev) => {
                  ev.preventDefault();
                  const sparkle = Array.from(document.querySelectorAll("button.btn-primary"))
                    .find((b) => b.textContent.includes("제안서 생성"));
                  if (sparkle) sparkle.click();
                  else toast("✨ 버튼을 다시 눌러주세요", "error");
                });
                progress.finish(false);
              }
            })();
          }, pageLimit);
        },
      });
      })(),
      // PPTX 다운로드 버튼 — 재진입 시 (multi-pass 완료된 conversation) 활성.
      // 활성화 판별: data.conversation.pptx_path 존재 시.
      // ⚠ multi-pass 직후엔 bubble 영역 inline ⬇ PPTX 다운로드 영역 별도 — 본 헤더 버튼은
      //   재진입 / 새로고침 시 영역 다운로드 흐름 보존용 (기존 사고 fix).
      // 산출내역서 패턴 동일: 항상 렌더링 (id) + 초기 display 가드 + __nightoff_enableProposalButtons 글로벌 갱신.
      // → multi-pass 완료 직후 재진입 없이도 버튼 표시 (stale 사고 fix).
      (function () {
        const hasPptx = !!(data.conversation && data.conversation.pptx_path);
        return h("button", {
          id: "header-pptx-download-btn",
          class: "btn pptx-dl-btn active",
          title: "저장된 제안서 다운로드",
          style: "text-decoration:none;" + (hasPptx ? "" : " display:none;"),
          html: `<span style="margin-right:4px;">⬇</span><span>제안서 다운로드</span>`,
          onclick: () => {
            // data.conversation.pptx_path 는 글로벌 함수가 mutate (closure 활용)
            downloadPptxAuthenticated(data.conversation && data.conversation.pptx_path, "proposal.pptx");
          },
        });
      })(),
      // 산출내역서 버튼 — 조건부 활성화 (제안서 생성 후만 클릭 가능).
      // 시각 영역 (사용자 명시):
      //   활성화 = 흰 배경 + 보라 outline + 보라 텍스트 + 💰 (✨ 버튼과 동등 사이즈)
      //   비활성화 = 흰 배경 + 회색 outline + 회색 텍스트 + cursor not-allowed
      //   hover (비활성화 시) = toast "제안서를 먼저 생성해 주세요" — 5초 throttle
      // 활성화 판별: data.conversation.pptx_path. multi-pass 완료 시 동적 enable.
      (function () {
        const hasPptx = !!(data.conversation && data.conversation.pptx_path);
        let lastHoverToastAt = 0;
        const btn = h("button", {
          class: "btn budget-btn" + (hasPptx ? " active" : " disabled"),
          html: `<span style="margin-right:4px;">💰</span><span>산출내역서</span>`,
          title: hasPptx ? "산출내역서 생성" : "제안서 생성 후 사용 가능해요",
          onclick: () => {
            if (btn.classList.contains("disabled")) {
              // 클릭 영역도 toast (hover 영역 X 사용자 영역 안전망)
              const now = Date.now();
              if (now - lastHoverToastAt > 4000) {
                toast("제안서를 먼저 생성해 주세요 (✨ 버튼)", "", 3500);
                lastHoverToastAt = now;
              }
              return;
            }
            openBudgetModal(convId);
          },
        });
        // 비활성화 영역 hover toast — mouseenter 영역, 5초 throttle 영역
        btn.addEventListener("mouseenter", () => {
          if (!btn.classList.contains("disabled")) return;
          const now = Date.now();
          if (now - lastHoverToastAt < 5000) return;
          lastHoverToastAt = now;
          toast("제안서를 먼저 생성해 주세요 (✨ 버튼)", "", 3500);
        });
        // 채팅 헤더 3 버튼 (PPTX 다운로드 / 페이지 재생성 / 자체 검증) stale 사고 fix.
        // multi-pass 완료 직후 재진입 없이도 버튼 표시 — 산출내역서 패턴 동일.
        // closure 안 data 객체 mutate → onclick 안 stale 값 참조 사고 차단.
        // (runMultiPassProposal 영역에서 PPTX 변환 완료 후 호출, 멱등 — 두 번 호출 안전)
        window.__nightoff_enableProposalButtons = (pptxPath, lastProposalPages, proposalOutline) => {
          // closure 안 data 객체 mutate — 3 버튼 onclick 의 stale 값 차단
          if (data.conversation) {
            data.conversation.pptx_path = pptxPath || data.conversation.pptx_path;
            if (typeof lastProposalPages === "number") {
              data.conversation.last_proposal_pages = lastProposalPages;
            }
          }
          if (Array.isArray(proposalOutline)) {
            data.proposal_outline = proposalOutline;
          }
          // 3 버튼 display 토글 (산출내역서는 별도 패턴이라 무관)
          ["header-pptx-download-btn", "header-regen-page-btn", "header-audit-btn"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = "";
          });
        };

        // multi-pass 완료 시 동적 enable — window 영역 hook 통해 외부에서 호출 가능.
        // (runMultiPassProposal 영역에서 PPTX 변환 완료 후 호출, 멱등 — 두 번 호출 안전)
        window.__nightoff_enableBudgetBtn = () => {
          const wasDisabled = btn.classList.contains("disabled");
          btn.classList.remove("disabled");
          btn.classList.add("active");
          btn.setAttribute("title", "산출내역서 생성");
          // 첫 활성화에만 — 펄스 애니메이션 + toast 안내 1회 (사용자 주목도 강화)
          if (wasDisabled) {
            btn.classList.add("just-enabled");
            setTimeout(() => btn.classList.remove("just-enabled"), 3100);  // 1.5s × 2 + 100ms buffer
            try {
              const SHOWN_KEY = "nightoff.budget_toast_shown_v1";
              if (!localStorage.getItem(SHOWN_KEY)) {
                toast("✨ 제안서 생성 완료. 💰 산출내역서도 함께 만들어 보세요", "ok", 4000);
                localStorage.setItem(SHOWN_KEY, "1");
              }
            } catch {}
          }
        };
        return btn;
      })(),
      // 📄 페이지 재생성 버튼 (Sub-step D-1 + D-2) — multi-pass 완료된 conv 에서만 활성.
      // 클릭 → openRegeneratePageModal (line 1607+) → endpoint 호출 → 새 PPTX 다운로드.
      // D-2: outline 배열 전달 → 모달이 페이지 list 표시 (페이지 + 섹션 클릭 선택).
      // NightOff 설계 철학: 패턴 매칭 ❌, AI 안내 + 명시 버튼 ✅ (app.js:4438-4440 이력 준수).
      // stale 사고 fix: 항상 렌더링 (id) + 초기 display 가드 + __nightoff_enableProposalButtons 글로벌 갱신.
      (function () {
        const hasPptx = !!(data.conversation && data.conversation.pptx_path);
        return h("button", {
          id: "header-regen-page-btn",
          class: "btn btn-outline",
          style: "text-decoration:none;" + (hasPptx ? "" : " display:none;"),
          title: "특정 페이지만 다시 만들기 (1페이지 = 100 크레딧)",
          html: `<span style="margin-right:4px;">📄</span><span>페이지 재생성</span>`,
          onclick: () => {
            // totalSlides / outline 은 data 객체 closure 참조 — 글로벌 함수가 mutate
            const totalSlides = parseInt((data.conversation && data.conversation.last_proposal_pages) || 0, 10) || null;
            const outline = Array.isArray(data.proposal_outline) ? data.proposal_outline : null;
            openRegeneratePageModal(convId, totalSlides, outline);
          },
        });
      })(),
      // 🔍 자체 검증 버튼 — 제안서 완성된 conv 에서만 활성.
      // 클릭 → openAuditModal (line 1042+) → /api/proposals/audit 호출 → Compliance + Red Team 결과 모달.
      // NightOff 핵심 차별화 영역. CHAT_SYSTEM_PROMPT L1177 안내와 정합.
      // stale 사고 fix: 항상 렌더링 (id) + 초기 display 가드 + __nightoff_enableProposalButtons 글로벌 갱신.
      (function () {
        const hasPptx = !!(data.conversation && data.conversation.pptx_path);
        return h("button", {
          id: "header-audit-btn",
          class: "btn btn-outline",
          style: "text-decoration:none;" + (hasPptx ? "" : " display:none;"),
          title: "AI 가 평가위원처럼 점검합니다 (30~60초) — Compliance + Red Team",
          html: `<span style="margin-right:4px;">🔍</span><span>자체 검증</span>`,
          onclick: () => {
            openAuditModal(convId);
          },
        });
      })(),
    ]),
  ]);
  shell.appendChild(header);

  const body = h("div", { class: "chat-body" });
  const msgs = h("div", { class: "chat-messages", id: "chat-messages" });
  body.appendChild(msgs);
  shell.appendChild(body);

  // Render existing messages
  data.messages.forEach((m) => msgs.appendChild(msgElement(m.role, m.content, m.created_at)));
  // 첫 대화면 친근한 인사 — RFP 분석 여부에 따라 메시지 분기
  if (!data.messages || data.messages.length === 0) {
    let openerText;
    const rfp = data.rfp_analysis || {};
    const rfpHasRealData = rfp && (rfp.title || (rfp.key_requirements && rfp.key_requirements.length)
                                || rfp.summary || rfp.budget || rfp.deadline);
    if (rfpHasRealData) {
      // RFP 가 실제 분석된 경우 — 과업 핵심을 살짝 요약
      const lines = ["안녕하세요! 저는 제안서 수주 도우미예요 ✨", ""];
      if (rfp.title) lines.push(`이번 과업은 **「${rfp.title}」** 이네요.`);
      const bits = [];
      if (rfp.budget) bits.push(`예산 ${rfp.budget}`);
      if (rfp.deadline) bits.push(`마감 ${rfp.deadline}`);
      if (Array.isArray(rfp.key_requirements) && rfp.key_requirements.length) {
        bits.push(`핵심 요구사항 ${rfp.key_requirements.length}개`);
      }
      if (bits.length) lines.push(bits.join(" · ") + " — RFP 잘 받았어요 👀");
      lines.push("");
      lines.push("어떤 부분부터 함께 잡아볼까요? 전체 초안을 만들어달라고 하셔도 좋고, 특정 섹션만 먼저 의논해도 좋아요 😊");
      openerText = lines.join("\n");
    } else {
      // RFP 없으면 단순 안내
      openerText = "안녕하세요! 저는 제안서 수주 도우미예요 ✨\n\nRFP를 올려주시면 바로 시작할 수 있어요 😊";
    }
    msgs.appendChild(msgElement("assistant", openerText, new Date().toISOString()));
  }

  // Phase 4 (Step 3) — 대화는 무제한. 항상 enable + 기본 안내 placeholder.
  const taAttrs = {
    id: "message-input",
    placeholder: "메시지를 입력하세요… (Shift+Enter 줄바꿈, Enter 전송)",
    rows: 1,
  };
  const ta = h("textarea", taAttrs);
  const sendBtn = h("button", { class: "send-btn", html: iconHtml("send", 20), disabled: true, title: "전송" });
  const stopBtn = h("button", { class: "stop-btn hidden", html: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`, title: "생성 중단" });

  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    sendBtn.disabled = !ta.value.trim();
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
  });

  let streaming = false;
  let aborter = null;
  stopBtn.addEventListener("click", () => {
    if (aborter) { aborter.abort(); toast("생성을 중단했습니다", ""); }
  });

  sendBtn.addEventListener("click", async () => {
    const text = ta.value.trim();
    if (!text || streaming) return;
    streaming = true; sendBtn.disabled = true; ta.disabled = true;
    sendBtn.classList.add("hidden"); stopBtn.classList.remove("hidden");

    // Optimistic user bubble
    msgs.appendChild(msgElement("user", text, new Date().toISOString()));
    ta.value = ""; ta.style.height = "auto";
    body.scrollTop = body.scrollHeight;

    // 채팅은 풀스크린 오버레이 없이 인라인 텍스트 스트리밍만 사용.
    // no-op 핸들러 — 아래 기존 호출부를 최소 변경으로 무효화
    const overlayLoader = { setStep() {}, finish() {}, stop() {} };

    // Assistant placeholder
    const asstEl = msgElement("assistant", "", new Date().toISOString());
    msgs.appendChild(asstEl);
    const bubble = asstEl.querySelector(".msg-bubble");
    bubble.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
    body.scrollTop = body.scrollHeight;

    // Phase 4 — createStreamProgress 제거 (제안서 전용 컴포넌트, 채팅에서 false positive).
    // 채팅은 로딩 점 + 텍스트만으로 충분. 제안서 흐름은 runMultiPassProposal 이 별도 사용.

    // 채팅 입력 = CHAT_SYSTEM_PROMPT 로 응답만 받음.
    // 제안서 생성은 ✨ 버튼만 진입. 채팅 키워드 매칭 트리거 (이전 isProposalRequest)
    // 는 사용자 함정·오트리거 위험이 커서 제거됨. AI 가 CHAT_SYSTEM_PROMPT 의
    // A3 안내 (b219730) 에 따라 자연어로 ✨ 버튼 안내함.

    aborter = new AbortController();
    let targetText = "";    // 서버에서 받아 누적한 실제 full text
    let displayedText = ""; // 화면에 출력된 길이
    let firstDelta = true;
    let rafActive = false;
    let streamDone = false;
    // Phase 4 — JSON 감지 코드 제거 (legacy). 채팅은 항상 자연어 응답 — 제안서는 ✨ 버튼만.

    // 사용자가 위로 스크롤하면 자동 스크롤 일시 정지 (생성 완료 시 자동 해제)
    let userScrolledUp = false;
    const onUserScroll = () => {
      const distFromBottom = body.scrollHeight - body.scrollTop - body.clientHeight;
      // 200px 이상 위로 올린 경우 자동 스크롤 멈춤
      userScrolledUp = distFromBottom > 200;
    };
    body.addEventListener("scroll", onUserScroll);

    // 부드러운 흐름 애니메이션 — RAF 기반으로 target보다 뒤처진 displayed를 따라잡음
    const tick = () => {
      if (displayedText.length >= targetText.length) {
        rafActive = false;
        if (streamDone) renderAssistant(bubble, targetText, true);
        return;
      }
      const lag = targetText.length - displayedText.length;
      // 뒤처진 정도에 비례해서 더 많이 진행 — 최소 2자, 최대 24자/frame
      const step = Math.min(24, Math.max(2, Math.ceil(lag / 10)));
      displayedText = targetText.slice(0, displayedText.length + step);
      renderAssistant(bubble, displayedText);
      // 사용자가 직접 위로 스크롤한 동안엔 자동 스크롤 안 함
      if (!userScrolledUp) body.scrollTop = body.scrollHeight;
      requestAnimationFrame(tick);
    };
    const kickTyper = () => {
      if (!rafActive) { rafActive = true; requestAnimationFrame(tick); }
    };

    try {
      const resp = await fetch(`/api/conversations/${convId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ message: text }),
        signal: aborter.signal,
      });
      if (resp.status === 401) { clearToken(); redirectToLogin(); throw new Error("인증이 만료됐어요."); }
      // Phase 4 (Step 3) — 대화는 무제한 → quota 403 / 차감 코드 모두 제거.
      if (!resp.ok) throw new Error(await resp.text());

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop();
        for (const line of lines) {
          const m = line.match(/^data: (.*)$/s);
          if (!m) continue;
          let ev;
          try { ev = JSON.parse(m[1]); } catch { continue; }
          if (ev.type === "delta") {
            if (firstDelta) { overlayLoader.stop(); bubble.innerHTML = ""; firstDelta = false; }
            targetText += ev.text;
            kickTyper();
          } else if (ev.type === "error") {
            overlayLoader.stop();
            bubble.innerHTML = `<span style="color:var(--danger);">❌ ${escapeHtml(ev.error)}</span>`;
            streamDone = true;
          } else if (ev.type === "done") {
            overlayLoader.stop();
            streamDone = true;
            displayedText = targetText;
            renderAssistant(bubble, targetText, true);
          }
        }
      }
      // 스트림 끝났는데 displayed가 아직 따라잡지 못한 경우 보강
      if (displayedText.length < targetText.length) {
        displayedText = targetText;
        renderAssistant(bubble, targetText, true);
      }
      // rafActive가 진행 중이면 streamDone을 보고 알아서 마감
      streamDone = true;
    } catch (e) {
      overlayLoader.stop();
      if (e.name === "AbortError") {
        if (targetText) renderAssistant(bubble, targetText + "\n\n⏸ (중단됨)", true);
        else bubble.innerHTML = `<span class="muted small">⏸ 생성이 중단되었습니다.</span>`;
      } else {
        bubble.innerHTML = `<span style="color:var(--danger);">❌ ${escapeHtml(e.message || String(e))}</span>`;
      }
    } finally {
      streaming = false; sendBtn.disabled = false; ta.disabled = false;
      sendBtn.classList.remove("hidden"); stopBtn.classList.add("hidden");
      aborter = null;
      // 자동 스크롤 잠금 해제 + 스크롤 리스너 정리
      userScrolledUp = false;
      body.removeEventListener("scroll", onUserScroll);
      // Phase 4 — legacy 제안서 완성 감지 / PPTX flow 코드 제거.
      // 채팅은 항상 자연어 응답이라 JSON/HTML 감지가 false positive 만 만들었음.
      // 제안서 완성 흐름은 ✨ 버튼 → runMultiPassProposal 안에서 처리.
      ta.focus();
    }
  });

  shell.appendChild(h("div", { class: "chat-input-wrap" }, [
    h("div", { class: "chat-input-container" }, [ta, sendBtn, stopBtn]),
    h("p", { class: "chat-hint" }, "발주처 정보 · RFP 과업 · RAG 스타일 신호가 자동으로 들어가요"),
  ]));

  // On load, re-render assistant messages to parse any embedded proposal markup
  msgs.querySelectorAll(".msg-row.assistant .msg-bubble").forEach((b) => {
    renderAssistant(b, b.dataset.raw || b.textContent, true);
  });

  ta.focus();

  // 채팅 첫 진입 안내 팝업 hook — DB 영역 dismissed=0 이면 노출.
  // ta (textarea) ref 전달 → 꿀팁 클릭 시 자동 입력 영역.
  api.get("/api/me/chat-intro-status").then((status) => {
    if (status && !status.dismissed) showChatIntroNotice(ta);
  }).catch(() => {});
}

function msgElement(role, content, ts) {
  const iconName = role === "user" ? "users" : "brain";
  const row = h("div", { class: `msg-row ${role}` }, [
    h("div", { class: "msg-avatar", html: iconHtml(iconName, 18) }),
    h("div", { class: "msg-body" }, [
      h("div", { class: "msg-bubble" }, content),
      h("div", { class: "msg-time" }, fmtTime(ts)),
    ]),
  ]);
  const bubble = row.querySelector(".msg-bubble");
  bubble.dataset.raw = content;
  if (role === "assistant" && content) renderAssistant(bubble, content, true);
  return row;
}
function fmtTime(ts) {
  try {
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

// ---------- Render assistant content (detects & renders proposal HTML) ----------
// 가벼운 마크다운 → HTML 변환 (bold / italic / heading / list / inline code / linebreak)
function renderMarkdown(src) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  let html = esc(src);
  // 헤딩 (### / ## / #)
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');
  // bullet 리스트 (- / * / •) — Spec D-Fix-13: +? (lazy) → + (greedy) 본질 fix
  // lazy 일 경우 줄마다 따로 매치되어 <ul> 가 줄 수만큼 분리됨 (불릿은 시각적 비가시).
  html = html.replace(/^(?:[-*•]\s+.+(?:\n|$))+/gm, (block) => {
    const items = block.trim().split(/\n/).map((l) => l.replace(/^[-*•]\s+/, "")).map((t) => `<li>${t}</li>`).join("");
    return `<ul class="md-ul">${items}</ul>`;
  });
  // 번호 리스트 (1. / 2.) — Spec D-Fix-13: +? (lazy) → + (greedy) 본질 fix
  // lazy 영역으로 줄마다 따로 매치되어 <ol> 가 분리 → counter 매번 1 → "1. 1. 1." 버그.
  html = html.replace(/^(?:\d+\.\s+.+(?:\n|$))+/gm, (block) => {
    const items = block.trim().split(/\n/).map((l) => l.replace(/^\d+\.\s+/, "")).map((t) => `<li>${t}</li>`).join("");
    return `<ol class="md-ol">${items}</ol>`;
  });
  // bold (**text** or __text__)
  html = html.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_\n]+?)__/g, "<strong>$1</strong>");
  // italic (*text* or _text_)
  html = html.replace(/(?<![*\w])\*([^*\n]+?)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/(?<![_\w])_([^_\n]+?)_(?!_)/g, "<em>$1</em>");
  // inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');
  // 연속된 줄바꿈은 단락, 단일은 <br>
  html = html.split(/\n{2,}/).map((block) => {
    if (/^<(h\d|ul|ol)/.test(block.trim())) return block;
    return `<p>${block.replace(/\n/g, "<br>")}</p>`;
  }).join("");
  return html;
}

// multi-pass 결과 (raw slide JSON) detect — 채팅 reload 시 raw 노출 방지
function isMultiPassResult(text) {
  if (!text) return false;
  const t = text.trimStart();
  if (!t.startsWith("{")) return false;
  try {
    const obj = JSON.parse(text);
    return obj && Array.isArray(obj.slides) && obj.slides.length > 0;
  } catch { return false; }
}

function renderAssistant(bubble, text, final = false) {
  bubble.dataset.raw = text;
  // multi-pass 결과면 placeholder 표시 (raw JSON 노출 방지)
  // — 백엔드는 final_payload 를 그대로 DB 저장 (api_proposals_pptx 가 읽음)
  if (isMultiPassResult(text)) {
    let n = 0;
    try { n = JSON.parse(text).slides.length; } catch {}
    bubble.innerHTML =
      `<div style="color:#666; line-height:1.6;">` +
        `✓ 제안서 ${n}장 생성 완료 — PPTX 파일로 변환됨` +
      `</div>`;
    return;
  }
  const idx = text.indexOf('<div class="proposal"');
  if (idx === -1) {
    // 제안서 HTML 없음 → 마크다운 렌더링
    bubble.innerHTML = renderMarkdown(text);
    return;
  }

  // ── 제안서 검출: idx 이후 모든 텍스트를 HTML로 취급 (post-text 분리 제거)
  // AI가 outer div 를 중간에 닫아도, 추가 텍스트가 있어도 브라우저가 알아서
  // 무효한 태그/닫힘 처리를 하므로 HTML 코드가 문자로 노출될 일이 없음.
  const pre = text.slice(0, idx).trim();
  const propHtml = text.slice(idx);

  // 완성된 페이지 수 — 스트리밍 중 카드 업데이트 용
  const completedPages = (propHtml.match(/<\/div>\s*(?=<div class="proposal-page"|<\/div>\s*$)/gi) || []).length;
  const lastCount = parseInt(bubble.dataset.propPages || "-1", 10);
  const alreadyRendered = bubble.querySelector(".proposal-thumb-card");
  if (alreadyRendered && !final && completedPages === lastCount) {
    return; // DOM 재구축 스킵 — 깜빡임 방지
  }
  bubble.dataset.propPages = String(completedPages);

  // 숨겨진 컨테이너에 실제 proposal 렌더 (썸네일·팝업·프린트 재사용용)
  const hidden = h("div", { class: "proposal-hidden" });
  hidden.innerHTML = sanitizeProposalHtml(propHtml);
  const propEl = hidden.querySelector(".proposal");

  // ── 채팅창에는 큰 제안서를 그대로 박지 않고 작은 "썸네일 카드"만 배치
  const card = h("div", { class: "proposal-thumb-card" });
  if (propEl) {
    const title = propEl.getAttribute("data-title") || "제안서";
    const pageCount = propEl.querySelectorAll(".proposal-page").length;
    const orientation = propEl.getAttribute("data-orientation") || "landscape";
    const accent = propEl.getAttribute("data-accent") || "#6b46e5";

    // 페이지에 keyword-row / figure 이미지 자동 장식 (공통)
    decorateProposalPages(propEl);

    // [Phase 3-D] 우측 사이드 패널 HTML 자동 활성화 비활성화
    // — JSON 모드에선 PPTX → PNG 미리보기 모달이 책임, HTML 모드는 legacy 안 보여도 OK
    // — 사용자가 🖼 미리보기 버튼 누르면 PNG 캐러셀 모달 열림

    // 썸네일/모달/전체화면 보기 모두 제거 — 우측 사이드 패널이 미리보기 책임 100% 가져감
    // 컴팩트 카드: 라벨 + 메타 1줄 + 2버튼 ([PPTX][인쇄/PDF])
    const completed = !!final;
    card.appendChild(h("div", { class: "proposal-compact" }, [
      h("div", { class: "proposal-compact-info" }, [
        h("div", { class: "thumb-label" }, completed ? "✅ 제안서 완성" : "📝 제안서 작성 중"),
        h("h4", { class: "thumb-title" }, title),
        h("div", { class: "thumb-meta" },
          `${orientation === "portrait" ? "A4 세로" : "A4 가로"} · 총 ${pageCount}페이지${completed ? "" : " · 우측에서 미리보기"}`),
      ]),
      h("div", { class: "proposal-compact-actions" }, [
        h("button", {
          class: "btn btn-primary",
          html: `${iconHtml("file", 14)}<span>PPTX 다운로드</span>`,
          title: "제안서를 .pptx 파일로 내려받기",
          disabled: !completed,
          onclick: async (e) => {
            const btn = e.currentTarget;
            const m = location.hash.match(/\/chat\/([^/?#]+)/);
            const convId = m ? m[1] : null;
            if (!convId) { toast("대화 정보를 찾지 못했어요", "error"); return; }
            btn.disabled = true; btn.innerHTML = "변환 중…";
            try {
              const r = await api.post("/api/proposals/pptx", { conversation_id: convId }, { timeoutMs: 60000 });
              if (r.url) {
                // Phase 5 Phase 2 Step 2 — anchor click 우회 (helper 가 Bearer + Blob 처리)
                const ok = await downloadPptxAuthenticated(r.url, r.filename || "proposal.pptx");
                if (ok) toast(`PPTX 다운로드 완료 (${r.page_count} 슬라이드) ✨`, "success");
              }
            } catch (err) {
              toast("PPTX 변환 실패: " + (err.message || err), "error");
            } finally {
              btn.disabled = false;
              btn.innerHTML = `${iconHtml("file", 14)}<span>PPTX 다운로드</span>`;
            }
          },
        }),
        h("button", { class: "btn btn-outline", html: `${iconHtml("printer", 14)}<span>인쇄 / PDF</span>`,
          disabled: !completed,
          onclick: () => printProposal(propEl) }),
      ]),
    ]));
    card.appendChild(hidden);
    hidden.style.display = "none";
  } else {
    // proposal 태그는 있으나 파싱 실패 (극히 예외) — 빈 스켈레톤
    card.appendChild(h("div", { class: "thumb-label" }, "📝 제안서 생성 중"));
    card.appendChild(h("div", { class: "muted small", style: "padding:20px; text-align:center;" }, `${completedPages}페이지 작성 중…`));
  }

  const fragment = document.createDocumentFragment();
  if (pre) fragment.appendChild(h("div", { style: "white-space: pre-wrap; margin-bottom: 10px;" }, pre));
  fragment.appendChild(card);
  bubble.replaceChildren(fragment);
}

// ---------- 스트리밍 진행 표시 바 ----------
// 현재 섹션명·페이지 X/Y·진행률 — 제안서 HTML 이 오기 전에도 "분석 중" 상태로 표시
function createStreamProgress() {
  const el = h("div", { class: "stream-progress indeterminate" }, [
    h("div", { class: "sp-head" }, [
      h("div", { class: "sp-spinner" }),
      h("div", { class: "sp-section" }, "생각하는 중…"),
      h("div", { class: "sp-count" }, "준비 중"),
    ]),
    h("div", { class: "sp-bar" }, [ h("div", { class: "sp-bar-fill" }) ]),
  ]);
  const sectionEl = el.querySelector(".sp-section");
  const countEl = el.querySelector(".sp-count");
  const fillEl = el.querySelector(".sp-bar-fill");

  // 제안서 단계: 목차의 [페이지 수] 목표 (시스템 프롬프트 내 권장치) — 기본 10
  // 실제 파싱되는 `data-total-pages` 가 있으면 그걸 사용
  const DEFAULT_TARGET_PAGES = 10;

  let finished = false;

  // HTML 이 아직 오기 전엔 "생각하는 중…" 상태로 pulse
  // <div class="proposal" 이후부터는 페이지 단위 파싱
  function update(fullText) {
    if (finished) return;

    // 1) 제안서 HTML 시작 전 — 인트로 메시지 회전
    const propIdx = fullText.indexOf('<div class="proposal"');
    if (propIdx === -1) {
      el.classList.add("indeterminate");
      // 짧은 텍스트면 "분석 중", 점점 길어지면 "구조 설계 중"
      if (fullText.length < 80)      sectionEl.textContent = "RFP·컨텍스트 분석 중…";
      else if (fullText.length < 400) sectionEl.textContent = "제안 전략 설계 중…";
      else                            sectionEl.textContent = "제안서 구조 작성 중…";
      countEl.textContent = "";
      return;
    }

    // 2) 제안서 HTML 진입 — determinate 모드
    el.classList.remove("indeterminate");
    const propSlice = fullText.slice(propIdx);

    // 목표 페이지 수 힌트 (있으면 사용)
    let totalTarget = DEFAULT_TARGET_PAGES;
    const totalAttr = propSlice.match(/data-total-pages=["'](\d+)["']/);
    if (totalAttr) totalTarget = parseInt(totalAttr[1], 10) || DEFAULT_TARGET_PAGES;

    // 시작된 페이지 / 완료된 페이지
    const openedPages = (propSlice.match(/<div class="proposal-page\b/gi) || []).length;
    // 완료된 페이지 = proposal-page 다음에 닫힘 </div> 가 대응된 것
    // 간단 근사: 열린 페이지 수 - (마지막 페이지가 아직 열린 상태면 1 감산)
    // — 정확히 하려면 tag stack 파싱 필요하지만 진행률 용도론 충분
    const lastPageOpen = propSlice.lastIndexOf('<div class="proposal-page');
    const afterLast = lastPageOpen >= 0 ? propSlice.slice(lastPageOpen) : "";
    const closedInLast = (afterLast.match(/<\/div>/gi) || []).length;
    const lastClosed = closedInLast >= 4; // page 내부 중첩 div 대략 4개 이상 닫힘 → 완료 근사
    const completedPages = Math.max(0, openedPages - (lastClosed ? 0 : 1));

    // 현재 작성 중인 페이지의 섹션명 (data-section="…")
    let currentSection = "페이지 작성 중";
    const secMatches = [...propSlice.matchAll(/data-section=["']([^"']+)["']/g)];
    if (secMatches.length) {
      const last = secMatches[secMatches.length - 1];
      currentSection = last[1];
    }

    const currentPage = Math.max(1, openedPages);
    const displayTotal = Math.max(totalTarget, openedPages);

    sectionEl.textContent = `${currentSection} 페이지 작성 중…`;
    countEl.textContent = `페이지 ${currentPage} / ${displayTotal}`;

    // 진행률 — 완료된 페이지 + 현재 페이지 진행 근사 (0.5)
    const ratio = Math.min(1, (completedPages + 0.5) / displayTotal);
    fillEl.style.width = `${Math.max(6, ratio * 100).toFixed(1)}%`;
  }

  function finish(ok) {
    if (finished) return;
    finished = true;
    if (ok) {
      el.classList.remove("indeterminate");
      fillEl.style.width = "100%";
      sectionEl.textContent = "✅ 제안서 생성 완료";
      countEl.textContent = "완료";
    } else {
      sectionEl.textContent = "중단됨";
    }
    // 0.9s 대기 → 부드럽게 fade-out → 1.4s 후 DOM 제거
    setTimeout(() => {
      el.classList.add("fade-out");
      setTimeout(() => { el.remove(); }, 500);
    }, 900);
  }

  return { el, update, finish };
}

// ─── 제안서 페이지 선택 모달 (Step 2 — Phase 4 페이지 기반 크레딧) ─────────
// ✨ 버튼 클릭 시 표시. 사용자가 30/50/100 페이지 중 선택 → onConfirm(pages) 콜백.
// 취소 / ESC / backdrop 클릭 = 닫고 아무 액션 X.
// CSS: .beta-notice-* 클래스 재사용 (overlay/card 기본 스타일) + 옵션 버튼 인라인 스타일.
//
// pageLimit (선택 인자): RFP 분석의 page_limit 값. 권장 배지 동적 매핑 + 초과 경고.
//   - 유효한 양의 정수: opt.pages ≤ pageLimit 중 최대값에 권장 (모두 초과 시 최소값에 권장)
//   - null / undefined / 0 / 비숫자: 기존 동작 (100페이지에 권장)
// pageLimit 기반 동적 옵션 생성 (RFP 한도 정밀 반영).
//   - pageLimit 없음/0/비숫자: 기존 고정 옵션 (100/50/30)
//   - pageLimit 있음: [한도-5p (정석), 한도/2 (표준), 30p (간단)] 동적 — 중복 제거 + 내림차순.
// credits = pages × CREDITS_PER_PAGE (= 100, Step 2-A 단위 단순화 반영).
function buildPageOptions(pageLimit) {
  const C = CREDITS_PER_PAGE;  // L284 module-level 정의 (= 100)
  // pageLimit 타입 가드 — LLM 이 가끔 문자열 반환 가능. 숫자 양수만 신뢰.
  if (typeof pageLimit !== "number" || pageLimit <= 0) {
    return [
      { pages: 100, credits: 100 * C, label: "100페이지", desc: "풀 분량 제안서" },
      { pages: 50,  credits: 50 * C,  label: "50페이지",  desc: "표준 분량" },
      { pages: 30,  credits: 30 * C,  label: "30페이지",  desc: "간단 분량" },
    ];
  }
  // 한도 기반 동적 — 정석 (-5p 안전 마진) + 중간 (한도/2) + 최소 (30p)
  const recommended = Math.max(10, pageLimit - 5);
  const middle = Math.max(20, Math.round(pageLimit / 2));
  const minimum = 30;
  const candidates = [
    { pages: recommended, label: `${recommended}페이지`, desc: "정석 (RFP 한도 -5p)" },
    { pages: middle,      label: `${middle}페이지`,      desc: "표준 분량" },
    { pages: minimum,     label: "30페이지",             desc: "간단 분량" },
  ];
  // 중복 제거 (예: 한도 35 → recommended=30 + middle=18→20 + minimum=30 → 30 중복) + credits 계산
  const seen = new Set();
  const unique = [];
  for (const opt of candidates) {
    if (!seen.has(opt.pages)) {
      seen.add(opt.pages);
      opt.credits = opt.pages * C;
      unique.push(opt);
    }
  }
  // 내림차순 정렬 (큰 페이지부터)
  unique.sort((a, b) => b.pages - a.pages);
  return unique;
}

function showProposalPageSelectionModal(onConfirm, pageLimit = null) {
  if (document.querySelector(".pages-modal-overlay")) return;

  // 옵션 (페이지, 크레딧, 설명) — pageLimit 있으면 동적, 없으면 기존 고정.
  // recommended 는 effectiveLimit 기준으로 동적 계산 (아래 권장 결정 로직).
  const OPTIONS = buildPageOptions(pageLimit);

  // pageLimit 타입 가드 — LLM 이 가끔 문자열 반환 가능. 숫자 양수만 신뢰.
  const effectiveLimit = (typeof pageLimit === "number" && pageLimit > 0) ? pageLimit : null;

  // 권장 페이지 결정:
  //   - effectiveLimit 없음 → 50 (중간값, 보수적 권장 — 사용자가 한도 모를 때 100p 는 과다)
  //   - opt.pages ≤ effectiveLimit 인 옵션 있음 → 그 중 최대값 (동적 OPTIONS 의 경우 자동으로 한도 -5p)
  //   - 모든 옵션이 effectiveLimit 초과 → 가장 작은 옵션 (limit 에 가장 근접한 선택 유도)
  let recommendedPages;
  if (effectiveLimit === null) {
    recommendedPages = 50;
  } else {
    const eligible = OPTIONS.filter((o) => o.pages <= effectiveLimit);
    if (eligible.length > 0) {
      recommendedPages = Math.max.apply(null, eligible.map((o) => o.pages));
    } else {
      recommendedPages = Math.min.apply(null, OPTIONS.map((o) => o.pages));
    }
  }

  const close = () => {
    overlay.classList.add("fade-out");
    setTimeout(() => overlay.remove(), 240);
    document.removeEventListener("keydown", onEsc);
  };
  const onEsc = (e) => { if (e.key === "Escape") close(); };

  // .beta-notice-overlay 재사용 (style.css 6149) + 커스텀 마커 .pages-modal-overlay
  const overlay = h("div", {
    class: "beta-notice-overlay pages-modal-overlay",
    onclick: (ev) => { if (ev.target === overlay) close(); },
  });
  const card = h("div", { class: "beta-notice-modal", style: "max-width:440px;" });
  overlay.appendChild(card);

  // ✕ 닫기 (beta-notice-close 재사용)
  card.appendChild(h("button", {
    class: "beta-notice-close", "aria-label": "닫기",
    onclick: () => close(),
  }, "✕"));

  // 헤더
  card.appendChild(h("h2", { class: "beta-notice-title" }, "📋 제안서 페이지를 선택하세요"));
  card.appendChild(h("p", { class: "beta-notice-subtitle" },
    "선택한 페이지 수만큼 제안서가 생성됩니다."));

  // 옵션 리스트 — 인라인 스타일로 깔끔하게
  const listWrap = h("div", { style: "display:flex; flex-direction:column; gap:10px; margin:18px 0 8px;" });
  OPTIONS.forEach((opt) => {
    const isRec = (opt.pages === recommendedPages);
    const exceedsLimit = (effectiveLimit !== null && opt.pages > effectiveLimit);
    const btn = h("button", {
      style:
        "display:flex; flex-direction:column; align-items:flex-start; gap:4px;" +
        "width:100%; padding:14px 16px; cursor:pointer; text-align:left;" +
        "border-radius:8px; font-family:inherit;" +
        (isRec
          ? "border:2px solid #6366F1; background:#F5F5FF;"
          : "border:1px solid #DDD; background:#fff;"),
      onclick: () => {
        close();
        try { onConfirm(opt.pages); } catch (e) { console.error("onConfirm 실패:", e); }
      },
    }, [
      h("div", { style: "display:flex; align-items:center; gap:8px; width:100%;" }, [
        h("span", { style: "font-size:16px; font-weight:700; color:#1A1A1A;" }, opt.label),
        isRec
          ? h("span", {
              style:
                "font-size:11px; padding:2px 8px; border-radius:999px;" +
                "background:#6366F1; color:#fff; font-weight:600;",
            }, "권장")
          : null,
      ]),
      h("div", { style: "font-size:12px; color:#666;" },
        `${opt.credits.toLocaleString("ko-KR")} 크레딧 · ${opt.desc}`),
      // RFP page_limit 초과 옵션 — 경고 표시 (선택은 가능)
      exceedsLimit
        ? h("div", { style: "font-size:11px; color:var(--danger, #c43); margin-top:2px; font-weight:600;" },
            `⚠️ RFP 제한(${effectiveLimit}p) 초과`)
        : null,
    ]);
    listWrap.appendChild(btn);
  });
  card.appendChild(listWrap);

  // 취소 버튼 (beta-notice-btn-secondary 재사용)
  card.appendChild(h("div", { class: "beta-notice-actions", style: "justify-content:center;" }, [
    h("button", {
      class: "beta-notice-btn-secondary",
      onclick: () => close(),
    }, "취소"),
  ]));

  document.body.appendChild(overlay);
  document.addEventListener("keydown", onEsc);
}


// ─── Multi-pass 제안서 생성 — SSE 받으면서 진행률 표시 + 끝나면 PPTX 변환 ───
async function runMultiPassProposal({ convId, pages, asstEl, bubble, progress, body, msgs }) {
  // 영구 안내 + 목차 작성 placeholder
  bubble.innerHTML =
    '<div class="mp-warning">⚠ 5~10분 소요. 작업 진행 중 페이지 이동·새로고침 시 진행 사라짐</div>' +
    '<div class="mp-outline-status">' +
      '<span class="loading-dots"><span></span><span></span><span></span></span>' +
      '<span class="mp-substep muted">RFP 분석 중...</span>' +
    '</div>';

  // 우측 미리보기 패널 preparing 모드
  try { window.shellSetSidePanelPng && window.shellSetSidePanelPng("preparing"); } catch {}

  // ─ outline phase sub-step heuristic (시간 기반) ─
  const outlineStart = Date.now();
  const OUTLINE_SUBSTEPS = [
    { sec: 0,   msg: "RFP 분석 중..." },
    { sec: 10,  msg: "RAG 검색 중..." },
    { sec: 30,  msg: "프롬프트 빌드 중..." },
    { sec: 60,  msg: "목차 작성 중... (보통 60~180초)" },
    { sec: 180, msg: "목차 작성 중... (긴 RFP — 잠시만 더)" },
  ];
  let outlineTimer = setInterval(() => {
    const elapsed = (Date.now() - outlineStart) / 1000;
    let msg = OUTLINE_SUBSTEPS[0].msg;
    for (const s of OUTLINE_SUBSTEPS) if (elapsed >= s.sec) msg = s.msg;
    const sub = bubble.querySelector(".mp-substep");
    if (sub) sub.textContent = msg;
  }, 1000);
  function stopOutlineTimer() {
    if (outlineTimer) { clearInterval(outlineTimer); outlineTimer = null; }
  }

  // Step 2 — pages query param 추가 (사용자 선택 페이지 수, 1~100)
  const pagesQS = (typeof pages === "number" && pages > 0) ? `?pages=${pages}` : "";
  const resp = await fetch(`/api/conversations/${convId}/proposals/generate${pagesQS}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getToken()}`,
    },
  });
  if (resp.status === 401) {
    stopOutlineTimer();
    clearToken();
    redirectToLogin();
    throw new Error("인증이 만료됐어요.");
  }
  if (!resp.ok) { stopOutlineTimer(); throw new Error(await resp.text()); }

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let totalSlides = 0;
  let okCount = 0;
  let failCount = 0;
  let outlineLines = [];
  let outlineList = [];   // [{page, section, governing, status}]
  let slidesStart = 0;
  let finalDone = false;

  // progress UI 헬퍼
  const sectionEl = progress.el.querySelector(".sp-section");
  const countEl = progress.el.querySelector(".sp-count");
  const fillEl = progress.el.querySelector(".sp-bar-fill");
  progress.el.classList.remove("indeterminate");

  // 자동 스크롤 — bubble.innerHTML 갱신 시 화면 위치 변동 사고 fix.
  // 사용자가 위로 스크롤하면 자동 스크롤 일시 정지 (chat 영역 동일 패턴).
  let userScrolledUp = false;
  const onUserScroll = () => {
    const distFromBottom = body.scrollHeight - body.scrollTop - body.clientHeight;
    userScrolledUp = distFromBottom > 200;
  };
  body.addEventListener("scroll", onUserScroll);
  const autoScroll = () => {
    if (!userScrolledUp) body.scrollTop = body.scrollHeight;
  };

  // ─ ETA 계산 ─ slide_done 마다 평균 갱신
  function calcEta(doneCount, total) {
    if (slidesStart === 0 || doneCount === 0) return "";
    const elapsed = (Date.now() - slidesStart) / 1000;
    const avg = elapsed / doneCount;
    const remaining = Math.max(0, total - doneCount);
    const sec = Math.round(remaining * avg);
    if (sec <= 0) return "마무리 중";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `약 ${m}분 ${s}초 남음` : `약 ${s}초 남음`;
  }

  // ─ 슬라이드 list 부분 갱신 (Spec D-Fix-13) ─
  // 본질: bubble.innerHTML 통째 재구축 → 높이 감소 → scrollTop clamp → 위로 튕김.
  // 해결: initBubble 1회 + data-page 기반 부분 갱신 (li / eta 만 변경).

  // 1회만 호출 — bubble DOM 초기 구축 (header + outlineList 기반 pending li)
  function initBubble() {
    const headerHtml =
      `<div class="mp-warning">⚠ 5~10분 소요. 작업 진행 중 페이지 이동·새로고침 시 진행 사라짐</div>` +
      `<div class="mp-progress-head">` +
        `<div class="mp-count-text" style="font-weight:600;">📑 슬라이드 0 / ${totalSlides} 작성 중</div>` +
        `<div class="mp-eta muted small"></div>` +
      `</div>`;
    const items = outlineList.map((o) => {
      return `<div class="mp-slide-item mp-pending" data-page="${o.page}">` +
        `<span class="mp-mark">·</span> p${o.page}. ${escapeHtml(o.section)} ` +
        `<span class="muted small">· ${escapeHtml(o.governing || "")}</span>` +
      `</div>`;
    }).join("");
    bubble.innerHTML = headerHtml + `<div class="mp-slide-list">${items}</div>`;
    autoScroll();   // 1회만 — 이후 부분 갱신이라 reflow 거의 0
  }

  // 진행 카운트 + ETA 부분 갱신 — textContent 만 변경 (DOM 재구축 0)
  function updateProgress(eta) {
    const countEl = bubble.querySelector(".mp-count-text");
    if (countEl) countEl.textContent = `📑 슬라이드 ${okCount + failCount} / ${totalSlides} 작성 중`;
    const etaEl = bubble.querySelector(".mp-eta");
    if (etaEl) etaEl.textContent = eta || "";
    autoScroll();
  }

  // 특정 페이지 상태 변경 — data-page li 만 변경 (다른 li 무영향)
  // status: "done" / "fail" / "doing" / "pending"
  function updateSlideItem(page, status) {
    const itemEl = bubble.querySelector(`.mp-slide-item[data-page="${page}"]`);
    if (!itemEl) return;
    itemEl.classList.remove("mp-pending", "mp-doing", "mp-done", "mp-fail");
    itemEl.classList.add(`mp-${status}`);
    const markEl = itemEl.querySelector(".mp-mark");
    if (markEl) {
      if (status === "done") markEl.textContent = "✓";
      else if (status === "fail") markEl.textContent = "✗";
      else if (status === "doing") markEl.textContent = "🔄";
      else markEl.textContent = "·";
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop();
    for (const line of lines) {
      const m = line.match(/^data: (.*)$/s);
      if (!m) continue;
      let ev;
      try { ev = JSON.parse(m[1]); } catch { continue; }

      if (ev.type === "phase") {
        sectionEl.textContent = ev.message || ev.phase;
        if (ev.phase === "outline") {
          progress.el.classList.add("indeterminate");
        } else {
          progress.el.classList.remove("indeterminate");
          stopOutlineTimer();
        }
        countEl.textContent = ev.phase === "outline" ? "분석 중" : "";
      } else if (ev.type === "outline_done") {
        stopOutlineTimer();
        totalSlides = ev.total_slides || (ev.outline || []).length;
        outlineLines = (ev.outline || []).map(o => `p${o.page}. ${o.section} · ${o.governing}`);
        outlineList = (ev.outline || []).map(o => ({
          page: o.page, section: o.section, governing: o.governing, status: "pending",
        }));
        slidesStart = Date.now();
        progress.el.classList.remove("indeterminate");
        sectionEl.textContent = `목차 작성 완료 — 슬라이드 ${totalSlides}장 병렬 작성 시작`;
        countEl.textContent = `0 / ${totalSlides}`;
        fillEl.style.width = "5%";
        initBubble();   // Spec D-Fix-13: 1회만 통째 구축. 이후 부분 갱신.
      } else if (ev.type === "slide_done") {
        if (ev.ok) okCount++;
        else { failCount++; console.warn(`slide ${ev.page} 실패: ${ev.error}`); }
        // 마커 transition: 해당 슬라이드 done, 다음 pending 슬라이드 doing 으로
        const item = outlineList.find(o => o.page === ev.page);
        if (item) item.status = ev.ok ? "ok" : "fail";
        const nextPending = outlineList.find(o => o.status === "pending");
        if (nextPending) nextPending.status = "doing";
        const progressPct = Math.min(95, 5 + Math.round((ev.progress / Math.max(1, ev.total)) * 90));
        fillEl.style.width = `${progressPct}%`;
        sectionEl.textContent = `슬라이드 작성 중 — ${ev.section}`;
        countEl.textContent = `${ev.progress} / ${ev.total}`;
        // Spec D-Fix-13: 부분 갱신 — 해당 page li + (옵션) 다음 pending → doing + eta
        updateSlideItem(ev.page, ev.ok ? "done" : "fail");
        if (nextPending) updateSlideItem(nextPending.page, "doing");
        updateProgress(calcEta(ev.progress, ev.total));
      } else if (ev.type === "error") {
        stopOutlineTimer();
        progress.finish(false);
        bubble.innerHTML =
          `<div style="color:var(--danger); margin-bottom:8px;">❌ ${escapeHtml(ev.error)}</div>` +
          `<button class="mp-retry-btn" type="button">🔄 다시 시도</button>`;
        const btn = bubble.querySelector(".mp-retry-btn");
        if (btn) btn.addEventListener("click", () => {
          const retryBtn = document.querySelector('button.btn-primary[title*=""], button.btn-primary');
          // ✨ 메인 버튼 자동 트리거 — DOM 의 첫 primary 버튼 (✨ 제안서 생성)
          const sparkle = Array.from(document.querySelectorAll("button.btn-primary"))
            .find((b) => b.textContent.includes("제안서 생성"));
          if (sparkle) sparkle.click();
          else toast("✨ 버튼을 다시 눌러주세요", "");
        });
        return;
      } else if (ev.type === "done") {
        finalDone = true;
        fillEl.style.width = "100%";
        sectionEl.textContent = `✅ 제안서 작성 완료 — ${ev.ok_slides}/${ev.total} 슬라이드 (${ev.elapsed_sec}초)`;
        countEl.textContent = "완료";
        bubble.innerHTML =
          `<div style="line-height:1.6;">` +
            `<div style="font-weight:600;">✅ 제안서 ${ev.total}장 작성 완료</div>` +
            (failCount > 0 ? `<div style="color:#c43;">⚠ ${failCount}장 실패 (placeholder 처리됨)</div>` : "") +
            `<div class="muted small" style="margin-top:6px;">PPTX 변환 중… 🔨</div>` +
          `</div>`;
        autoScroll();
        // Phase 4 (Step 3) — 페이지 기반 차감. ev.total = 생성된 슬라이드 수.
        // 백엔드의 GREATEST(0, q - pages*100) 와 동일 식으로 클라 UI sync.
        try { refreshQuotaUI("proposal", ev.total || 0); } catch (e) { console.warn("quota UI refresh 실패:", e); }
      }
    }
  }

  stopOutlineTimer();
  if (!finalDone) throw new Error("제안서 생성이 완료되지 않았어요.");

  progress.finish(true);

  // PPTX 변환 트리거 — 기존 endpoint 활용
  try {
    const pptxResp = await api.post("/api/proposals/pptx", { conversation_id: convId }, { timeoutMs: 180000 });
    // Phase 5 Phase 2 Step 2 — anchor → button (인증 헤더 부착 위해 helper 경유).
    // innerHTML 로 button 렌더링 후 querySelector + addEventListener 로 onclick 부착.
    bubble.innerHTML =
      `<div style="line-height:1.6;">` +
        `<div style="font-weight:600;">✅ 제안서 ${totalSlides}장 + PPTX 변환 완료</div>` +
        `<div class="muted small" style="margin-top:6px;">우측 미리보기에서 확인하세요 😊</div>` +
        `<button class="pptx-dl-inline" style="display:inline-block; margin-top:8px; padding:8px 14px; background:#1A1A1A; color:#fff; border:none; border-radius:8px; font-weight:600; cursor:pointer; font-family:inherit; font-size:inherit;">⬇ PPTX 다운로드</button>` +
      `</div>`;
    const _dlBtn = bubble.querySelector(".pptx-dl-inline");
    if (_dlBtn) {
      _dlBtn.addEventListener("click", () => {
        downloadPptxAuthenticated(pptxResp.url, pptxResp.filename || "proposal.pptx");
      });
    }
    autoScroll();
    // 우측 미리보기 패널 갱신 — 기존 함수 활용
    try { window.shellSetSidePanelPng && window.shellSetSidePanelPng(pptxResp.url); } catch {}
    // 산출내역서 버튼 활성화 — PPTX 변환 성공 = 활성화 조건 도달 (멱등 함수, 안전).
    // hotfix: runMultiPassProposal 영역 enable 호출 누락 영역 영역 (이전 Fix 1A-1 영역 SSE 흐름 영역만 적용).
    if (pptxResp && pptxResp.url) {
      try { window.__nightoff_enableBudgetBtn && window.__nightoff_enableBudgetBtn(); } catch {}
      // 채팅 헤더 3 버튼 (PPTX 다운로드 / 페이지 재생성 / 자체 검증) 동적 활성화 — stale 사고 fix.
      // outline 은 SSE 응답 outline 이벤트에서 받음 (있으면 inject, 없으면 null — 페이지 재생성 modal 이 추가 fetch).
      try {
        window.__nightoff_enableProposalButtons && window.__nightoff_enableProposalButtons(
          pptxResp.url,
          totalSlides,
          (typeof outline !== "undefined" ? outline : null)
        );
      } catch {}
    }
  } catch (e) {
    bubble.innerHTML = `<span style="color:var(--danger);">❌ PPTX 변환 실패: ${escapeHtml(e.message || String(e))}</span>`;
  }
}

// 제안서 페이지에 keyword row / 이미지 자동 로드 장식 — 썸네일/팝업 공통
function decorateProposalPages(propEl) {
  propEl.querySelectorAll(".proposal-page").forEach((page) => {
    const kw = page.getAttribute("data-keyword");
    if (kw && !page.nextElementSibling?.classList.contains("keyword-row")) {
      const kwRow = h("div", { class: "keyword-row" }, [
        h("span", { class: "muted" }, `이미지 검색 · ${kw}`),
        h("a", {
          href: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(kw)}`,
          target: "_blank", rel: "noopener",
        }, "구글에서 이미지 보기 →"),
      ]);
      page.insertAdjacentElement("afterend", kwRow);
    }
  });
  // 깨진 <img> (Claude 의 web_search 결과 URL 이 죽었거나 막힌 경우) 자동 정리
  // — figure 자체를 제거해 깨진 이미지 아이콘 노출 방지
  propEl.querySelectorAll("figure.ai-image img").forEach((img) => {
    if (img.dataset.errBound === "1") return;
    img.dataset.errBound = "1";
    img.addEventListener("error", () => {
      const fig = img.closest("figure.ai-image");
      if (fig) fig.remove();
    });
  });
  // 과거 placeholder div 가 남아있는 figure (외부 이미지 못 찾은 경우) 제거
  propEl.querySelectorAll("figure.ai-image").forEach((fig) => {
    if (!fig.querySelector("img")) fig.remove();
  });
}



function sanitizeProposalHtml(html) {
  // Very permissive sanitizer: removes script, iframe, on* attrs, javascript: URLs.
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content.querySelectorAll("script, iframe, object, embed, link, meta").forEach((el) => el.remove());
  tpl.content.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      if (attr.name === "href" && /^javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  });
  return tpl.innerHTML;
}

// ---------- Proposal: print + fullscreen ----------
function printProposal(propEl) {
  const clone = propEl.cloneNode(true);
  let mount = document.getElementById("print-mount");
  if (!mount) {
    mount = h("div", { id: "print-mount" });
    document.body.appendChild(mount);
  }
  mount.innerHTML = "";
  // Remove keyword rows in print (B&W skeleton only)
  clone.querySelectorAll(".keyword-row").forEach(e => e.remove());
  mount.appendChild(clone);
  mount.style.display = "block";
  setTimeout(() => {
    window.print();
    setTimeout(() => { mount.style.display = "none"; }, 500);
  }, 100);
}


// ---------- Settings modal ----------
// Spec D-Fix-9 (5/19) — 회원 탈퇴 링크 영역 index.html settings-modal 안 추가됨 (/withdraw.html).
// 모달 하단 작은 회색 텍스트 영역 (사용자 실수 방지). 클릭 시 정적 페이지 이동.
async function openSettings() {
  const modal = $("#settings-modal");
  const s = await api.get("/api/settings");
  const inp = $("#api-key-input");
  inp.value = "";
  if (s.env_active) {
    // Railway 환경변수가 활성이면 입력창을 잠금 + 시각적으로도 비활성 분위기
    inp.placeholder = `🔒 ${s.masked_key} (Railway 환경변수 사용 중)`;
    inp.disabled = true;
    inp.readOnly = true;
    inp.classList.add("locked-by-env");
  } else {
    inp.placeholder = s.has_key ? s.masked_key : "sk-ant-api03-...";
    inp.disabled = false;
    inp.readOnly = false;
    inp.classList.remove("locked-by-env");
  }
  const status = $("#api-key-status");
  if (s.env_active) {
    status.innerHTML = `<strong style="color: var(--primary);">🔒 Railway 환경변수가 항상 우선이에요</strong><br><span class="muted">서버 환경변수 <code>ANTHROPIC_API_KEY</code> (<code>${escapeHtml(s.masked_key)}</code>) 가 활성 상태입니다. 환경변수가 있는 동안엔 DB 키를 저장해도 적용되지 않아요. 키를 바꾸려면 <strong>Railway Variables</strong> 에서 직접 수정하세요.</span>`;
  } else if (s.has_key) {
    status.innerHTML = `<strong style="color: var(--success);">📦 DB 폴백 사용 중</strong><br><span class="muted">DB에 저장된 키 사용 중: <code>${escapeHtml(s.masked_key)}</code><br>환경변수가 설정되면 자동으로 우선 전환됩니다.</span>`;
  } else {
    status.textContent = "설정된 키 없음 — 입력 후 저장하거나 Railway 환경변수로 주입하세요.";
  }
  $("#model-select").value = s.model || "claude-sonnet-4-5-20250929";

  const dx = $("#settings-diagnostic");
  if (dx) { dx.classList.add("hidden"); dx.classList.remove("ok", "err"); dx.innerHTML = ""; }
  modal.classList.remove("hidden");
}
function closeSettings() { $("#settings-modal").classList.add("hidden"); }

$("#settings-btn")?.addEventListener("click", openSettings);
$$("[data-close-modal]").forEach((el) => el.addEventListener("click", closeSettings));
$("#settings-modal")?.addEventListener("click", (e) => {
  if (e.target.id === "settings-modal") closeSettings();
});
$("#save-settings")?.addEventListener("click", async () => {
  // 현재 env 활성 상태인지 한 번 더 조회 — 가드
  let envActive = false;
  try { const s = await api.get("/api/settings"); envActive = !!s.env_active; } catch {}

  const body = {};
  const inp = $("#api-key-input");
  const k = (inp?.value || "").trim();
  // env 활성이면 api_key 필드는 절대 보내지 않음 (서버도 거부하지만 클라이언트에서도 가드)
  if (k && !envActive) body.api_key = k;
  body.model = $("#model-select").value;
  try {
    await api.post("/api/settings", body);
    if (k && envActive) {
      toast("환경변수가 우선이라 키는 저장하지 않았어요 (모델만 저장됨)", "");
    } else {
      toast("설정이 저장되었습니다", "success");
    }
    closeSettings();
  } catch (e) { toast(String(e.message || e), "error"); }
});

$("#test-key")?.addEventListener("click", async () => {
  const newKey = $("#api-key-input")?.value.trim() || "";
  const box = $("#settings-diagnostic");
  const btn = $("#test-key");
  btn.disabled = true; btn.textContent = "테스트 중…";
  box.classList.remove("hidden", "ok", "err");
  box.textContent = "API 연결 확인 중…";

  // env 활성 여부 사전 조회 — env 활성이면 키 자동저장 시도 자체를 막음
  let envActive = false;
  try { const s = await api.get("/api/settings"); envActive = !!s.env_active; } catch {}

  try {
    if (newKey && !envActive) {
      // env 가 비어있는 경우에만 새 입력 키를 DB 에 저장
      await api.post("/api/settings", { api_key: newKey, model: $("#model-select").value });
    } else if ($("#model-select").value) {
      // 모델 변경만 반영
      await api.post("/api/settings", { model: $("#model-select").value });
    }
    const r = await api.post("/api/settings/test");
    box.classList.add(r.ok ? "ok" : "err");
    if (r.ok) {
      box.innerHTML = `<strong>✅ 정상 연결</strong><br>${escapeHtml(r.message)}${r.output_tokens != null ? `<br><span class="small muted">응답 ${r.output_tokens} tokens · 입력 ${r.input_tokens ?? 0}</span>` : ""}`;
    } else {
      const stageLabel = { auth: "🔑 인증", credit: "💳 크레딧/빌링", disabled: "🚫 조직 비활성", network: "🌐 네트워크", bad_request: "⚠️ 요청", status: "⚠️ API 상태", no_key: "❓ 키 없음" }[r.stage] || "⚠️ 진단";
      let html = `<strong>${stageLabel}</strong><br>${escapeHtml(r.message).replace(/\n/g, "<br>")}`;
      if (r.key_tail) html += `<br><span class="small muted">키 끝자리 ···${r.key_tail}${r.model ? ` · 모델 ${r.model}` : ""}</span>`;
      if (r.raw) html += `<br><span class="small muted">원본: ${escapeHtml(r.raw)}</span>`;
      box.innerHTML = html;
    }
  } catch (e) {
    box.classList.add("err");
    box.textContent = "진단 실패: " + (e.message || e);
  } finally {
    btn.disabled = false; btn.textContent = "연결 테스트";
  }
});

// ── 건강 체크 (HEALTH_TIPS + ensureBodyClock / applyHealthTip / typeBodyMessage /
//    tickBodyTime / bootBodyCharacter + sessionStorage 'nightoff.bodyStartedAt') 은
//    Spec 5 (5/16) 우측 사이드바 폐기 영역 함께 폐기. static/images/health/ 12 이미지 자원은 보존.

// ---------- 햄버거 사이드바 토글 (반응형: 1024px 미만) ----------
function bootNavToggle() {
  const btn = document.getElementById("nav-toggle");
  const backdrop = document.getElementById("nav-backdrop");
  if (!btn) return;
  const close = () => {
    document.body.classList.remove("nav-open");
    btn.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    document.body.classList.add("nav-open");
    btn.setAttribute("aria-expanded", "true");
  };
  const toggle = () => {
    if (document.body.classList.contains("nav-open")) close();
    else open();
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });
  if (backdrop) backdrop.addEventListener("click", close);
  // 사이드바 안 항목 클릭 시 자동으로 닫기 (네비게이션 후)
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!target || !target.closest) return;
    if (target.closest(".sidebar a, .sidebar button, .sidebar-item, .sidebar-recent-item")) {
      // 모바일/태블릿일 때만 닫기 (메뉴가 열려 있는 상태일 때)
      if (document.body.classList.contains("nav-open")) {
        setTimeout(close, 80);
      }
    }
  });
  // ESC 로 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("nav-open")) close();
  });
  // 화면 사이즈 커지면 자동 닫기 (1024px 이상)
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", (e) => { if (e.matches) close(); });
}

// ---------- Boot ----------
// 최초 방문 체크
window.addEventListener("DOMContentLoaded", async () => {
  // ── 묶음 N Commit 5 — 인증 게이트 (Phase 4 수정: token 있으면 공개 페이지도 검증) ──
  //
  // 변경 이유: 기존 가드는 "비공개 페이지에 토큰 없으면 redirect" 만 처리.
  // 그러나 로그인 후 / (공개) 로 redirect 되면 /api/auth/me 호출 skip →
  // __nightoff_user 미설정 → 사이드바 quota / 일일 보상 / 어드민 권한 모두 깨짐.
  //
  // 신규 흐름:
  //   1) token 있음 → 페이지 종류 무관하게 /api/auth/me 호출 → __nightoff_user 항상 설정
  //   2) token 없음 + 비공개 페이지 → redirectToLogin
  //   3) token 없음 + 공개 페이지 → 그대로 (랜딩 노출)
  if (getToken()) {
    // 토큰 검증 — /api/auth/me 호출 (공개/비공개 무관)
    try {
      const me = await api.get("/api/auth/me");
      window.__nightoff_user = me.user;  // 다른 곳에서 활용 가능
    } catch (e) {
      // 401 (만료/무효) — 토큰 정리. 비공개 페이지면 redirect, 공개 페이지면 그대로 랜딩.
      if (e && e.status === 401) {
        clearToken();
        if (!AUTH_PUBLIC_PAGES.has(location.pathname)) {
          redirectToLogin();
          return;
        }
        // 공개 페이지에서 401 = stale token + 랜딩 노출. __nightoff_user 미설정으로 fall through.
      }
      // 다른 에러 (네트워크 / 500 등) 도 silent fall through — 공개 페이지는 토큰 없이도 진행
    }
  } else if (!AUTH_PUBLIC_PAGES.has(location.pathname)) {
    // token 없음 + 비공개 페이지 → 로그인 강제
    redirectToLogin();
    return;
  }
  // token 없음 + 공개 페이지 → 그대로 진행 (랜딩 노출, __nightoff_user 미설정)
  // (legacy ensureSignup 모달 — 묶음 N 인증 시스템 전환 후 폐기됨.
  //  가입 흐름은 랜딩 CTA "지금 시작하기 ✨" -> /register.html 으로 이동.)
  // 체류시간 인체 캐릭터 (bootBodyCharacter) 호출은 Spec 5 (5/16) 폐기.
  // 반응형 햄버거 토글
  bootNavToggle();
  // route() 영역 영역 영역 영역 호출 — window.__nightoff_user 영역 영역 영역 영역
  // (사이드바 사용자 영역 div 영역 미렌더 race condition 회피).
  // public 페이지(/, /landing 등)는 fetch 분기 skip 후 즉시 도달, 비공개 페이지는
  // /api/auth/me await 후 도달. redirectToLogin 케이스는 위에서 return으로 차단됨.
  route();
});
