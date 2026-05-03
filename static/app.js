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
  const msg = body.error || body.detail || r.statusText || "알 수 없는 오류";
  // 이미 친절 메시지면 그대로, 스택트레이스 같으면 일반화
  if (typeof msg === "string" && /Traceback|Exception|at [A-Z]|<!DOCTYPE/i.test(msg)) {
    return `잠시 문제가 생겼어요 (${r.status}). 다시 시도해 주세요.`;
  }
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}

// ---------- Auth — JWT localStorage helpers (묶음 N Commit 5) ----------
const AUTH_TOKEN_KEY = "nightoff_jwt";
// 인증 면제 페이지 — 미가입 방문자가 접근 가능 (랜딩 노출용 / + /landing 포함)
const AUTH_PUBLIC_PAGES = new Set(["/", "/landing", "/login.html", "/register.html"]);

function getToken() { return localStorage.getItem(AUTH_TOKEN_KEY) || ""; }
function setToken(t) { localStorage.setItem(AUTH_TOKEN_KEY, t || ""); }
function clearToken() { localStorage.removeItem(AUTH_TOKEN_KEY); }

function redirectToLogin() {
  if (AUTH_PUBLIC_PAGES.has(location.pathname)) return;  // 이미 공개 페이지
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

// ---------- Soft pulse loader with fading emoji + text sequence ----------
// Steps: [{emoji, text}] rotated every ~1.8s with fade in/out
function createSoftLoader(steps, opts = {}) {
  const { block = false } = opts;
  const el = h("div", { class: "soft-loader" + (block ? " block" : "") });
  const emojiEl = h("span", { class: "soft-emoji" }, steps[0]?.emoji || "✨");
  const textEl = h("span", { class: "soft-text fade-in" }, steps[0]?.text || "잠시만요…");
  el.appendChild(emojiEl);
  el.appendChild(textEl);
  let idx = 0, stopped = false;
  const tick = () => {
    if (stopped || steps.length < 2) return;
    textEl.classList.remove("fade-in");
    textEl.classList.add("fade-out");
    setTimeout(() => {
      if (stopped) return;
      idx = (idx + 1) % steps.length;
      emojiEl.textContent = steps[idx].emoji;
      textEl.textContent = steps[idx].text;
      textEl.classList.remove("fade-out");
      textEl.classList.add("fade-in");
      setTimeout(tick, 1800);
    }, 400);
  };
  if (steps.length > 1) setTimeout(tick, 1800);
  return {
    el,
    finish(finalEmoji = "✅", finalText = "완료!") {
      stopped = true;
      textEl.classList.remove("fade-out");
      textEl.classList.add("fade-in");
      emojiEl.textContent = finalEmoji;
      textEl.textContent = finalText;
      el.style.animation = "none";
    },
    stop() { stopped = true; el.remove(); },
  };
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
  // 페이지 전환 시 우측 패널은 기본 ON (renderChat 안에서 OFF 토글)
  document.body.classList.remove("right-panel-off");
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
async function renderSidebar(active = "clients") {
  // 사이드바 — 로고 + 메뉴 + (하단) 최근 활동 3줄
  let activity = [];
  try { activity = await api.get("/api/activity"); } catch {}
  if (!Array.isArray(activity)) activity = [];

  const recentBlock = h("div", { class: "sidebar-recent" }, [
    h("p", { class: "sidebar-recent-title" }, "최근 활동"),
    activity.length === 0
      ? h("p", { class: "sidebar-recent-empty" }, "아직 활동이 없어요 🌙")
      : h("div", { class: "sidebar-recent-list" },
          activity.slice(0, 3).map((ev) =>
            h("button", {
              class: "sidebar-recent-row",
              onclick: () => {
                if (ev.conv_id && ev.client_id) navigate(`/client/${ev.client_id}/chat/${ev.conv_id}`);
                else if (ev.client_id) navigate(`/client/${ev.client_id}`);
              },
              title: ev.title,
            }, [
              h("span", { class: "sidebar-recent-icon", html: iconHtml(ev.icon || "activity", 12) }),
              h("span", { class: "sidebar-recent-text" }, [
                h("span", { class: "sidebar-recent-text-title" }, ev.title || ""),
                h("span", { class: "sidebar-recent-text-time" }, relativeTime(ev.at)),
              ]),
            ])
          )
        ),
  ]);

  const side = h("aside", { class: "sidebar" }, [
    h("div", { class: "sidebar-logo", role: "button", tabindex: "0", title: "메인으로", onclick: () => navigate("/"), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/"); } } }, [
      h("img", { class: "sidebar-logo-img", src: "/static/logo.png", alt: "NightOff" }),
    ]),
    h("nav", { class: "sidebar-nav" }, [
      h("button", {
        class: "sidebar-item" + (active === "clients" ? " active" : ""),
        onclick: () => navigate("/"),
        html: `${iconHtml("users")}<span>과업 목록</span>`,
      }),
    ]),
    recentBlock,
  ]);
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
      h("button", {
        class: "btn btn-primary landing-cta-btn",
        onclick: () => {
          // 미인증: 가입 페이지 / 인증: 대시보드
          if (getToken()) {
            localStorage.setItem("nightoff.landing_seen", "1");
            root.classList.remove("landing-active");
            navigate("/dashboard");
          } else {
            location.href = "/register.html";
          }
        },
        html: `<span>지금 시작하기 ✨</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:6px;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
      }),
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

  // ── 푸터
  wrap.appendChild(h("footer", { class: "landing-footer" },
    "NightOff · 수주를 진심으로 기원합니다 🙏"));

  // ── 베타 안내 팝업 (첫 진입 시 1회)
  if (!localStorage.getItem("nightoff.beta_notice_seen")) {
    setTimeout(() => showBetaNotice(), 600);  // 랜딩 fade-in 후 자연스럽게
  }
}

// ── 베타 안내 모달 ─────────────────────────────────────────────────────────
function showBetaNotice() {
  // 이미 떠있으면 중복 표시 X
  if (document.querySelector(".beta-notice-overlay")) return;

  const close = (persist = false) => {
    if (persist) localStorage.setItem("nightoff.beta_notice_seen", "1");
    overlay.classList.add("fade-out");
    setTimeout(() => overlay.remove(), 240);
  };

  const overlay = h("div", {
    class: "beta-notice-overlay",
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
  modal.appendChild(h("h2", { class: "beta-notice-title" }, "🌙 NightOff 베타 안내"));
  modal.appendChild(h("p", { class: "beta-notice-subtitle" },
    "지금 보고 계신 NightOff 는 베타 단계예요."));

  // ✨ 잘하는 것
  modal.appendChild(h("div", { class: "beta-notice-section bn-good" }, [
    h("h3", { class: "beta-notice-section-title" }, "✨ 잘하는 것"),
    h("ul", { class: "beta-notice-list" }, [
      h("li", {}, "RFP 한 장만 올려주시면 제안서 초안을 자동으로 만들어드려요"),
      h("li", {}, "발주처도 들여다볼 수 있어요 (발표 준비할 때 좋아요!)"),
      h("li", {}, "수백 건의 실제 수주 제안서를 학습한 차별화 패턴을 적용해요"),
    ]),
  ]));

  // ⚠ 아직 부족한 것
  modal.appendChild(h("div", { class: "beta-notice-section bn-warn" }, [
    h("h3", { class: "beta-notice-section-title" }, "⚠ 아직 부족한 것"),
    h("p", { class: "beta-notice-paragraph" },
      "생성되는 제안서는 약 70% 정도의 완성도예요. 디자이너나 디자인 가능한 기획자가 마무리해주셔야 합니다."),
  ]));

  // 🚀 곧 업데이트
  modal.appendChild(h("div", { class: "beta-notice-section bn-soon" }, [
    h("h3", { class: "beta-notice-section-title" }, "🚀 곧 업데이트"),
    h("ul", { class: "beta-notice-list" }, [
      h("li", {}, "발주처 성향을 자동으로 학습해요"),
      h("li", {}, "AI 평가위원과 PT 연습할 수 있어요"),
      h("li", {}, "나라장터 공고를 자동으로 매칭해드려요"),
      h("li", {}, "자사 데이터를 학습해 우리 회사만의 제안서를 만들어드려요"),
    ]),
  ]));

  // 액션 버튼
  const actions = h("div", { class: "beta-notice-actions" }, [
    h("button", {
      class: "beta-notice-btn-secondary",
      onclick: () => close(true),
    }, "다시 보지 않기"),
    h("button", {
      class: "beta-notice-btn-primary",
      onclick: () => close(false),
    }, "확인"),
  ]);
  modal.appendChild(actions);

  document.body.appendChild(overlay);
  // ESC 키로 닫기 (한 번만 바인딩)
  const onEsc = (e) => {
    if (e.key === "Escape") {
      close(false);
      document.removeEventListener("keydown", onEsc);
    }
  };
  document.addEventListener("keydown", onEsc);
}

// ---------- Dashboard ----------
// 🧠 핵심 기능 히어로 배너 (대시보드 최상단) — 1 메인 + 3 서브, 상시 펼침
function renderHeroBanner() {
  const banner = h("section", { class: "hero-banner" });

  // 메인 카드 — 핵심 가치 (든든한 AI 작가)
  banner.appendChild(h("div", { class: "hero-main-card hero-main-compact" }, [
    h("div", { class: "hero-main-emoji" }, "🖋"),
    h("div", { class: "hero-main-text" }, [
      h("h2", { class: "hero-main-title" }, "든든한 AI 작가"),
      h("p", { class: "hero-main-desc" },
        "수백 건의 실제 수주 제안서를 학습한 AI 가, 사용자 옆에서 직접 펜을 잡고 써내려가요"),
    ]),
    h("div", { class: "hero-main-sparkles" }, "✨"),
  ]));

  // 서브 카드 3개 — 메인을 뒷받침하는 도구들
  const feats = [
    { emoji: "👀", title: "발주처 들여다보기", desc: "RFP를 넣으면 발주처 정보와 과업 내용을 자동으로 파악해요" },
    { emoji: "📚", title: "고품질 제안서 학습", desc: "수많은 과거 제안서로 학습한 글투·시각화 패턴이 자동 반영돼요" },
    { emoji: "📊", title: "입찰 활동 히스토리", desc: "수주/탈락 결과를 기록하면 나의 입찰 활동을 한눈에 볼 수 있어요" },
  ];
  const grid = h("div", { class: "hero-sub-grid" });
  feats.forEach((f) => {
    grid.appendChild(h("div", { class: "hero-sub-card" }, [
      h("div", { class: "hero-sub-emoji" }, f.emoji),
      h("div", {}, [
        h("h4", { class: "hero-sub-title" }, f.title),
        h("p", { class: "hero-sub-desc" }, f.desc),
      ]),
    ]));
  });
  banner.appendChild(grid);
  return banner;
}

// ===== 산출내역서 (고정 양식: 구분→항목→세부내역→단가→수량→단위→기간→투입율→금액→비고) =====
const BUDGET_COLS = [
  { key: "item",         label: "항목",     width: "13%", align: "left" },
  { key: "spec",         label: "세부내역", width: "20%", align: "left" },
  { key: "unit_price",   label: "단가",     width: "10%", align: "right", num: true },
  { key: "qty",          label: "수량",     width: "6%",  align: "right", num: true },
  { key: "unit",         label: "단위",     width: "6%",  align: "center" },
  { key: "period",       label: "기간",     width: "8%",  align: "center" },
  { key: "utilization",  label: "투입율",   width: "7%",  align: "right", num: true, suffix: "%" },
  { key: "amount",       label: "금액",     width: "12%", align: "right", num: true, bold: true },
  { key: "note",         label: "비고",     width: "12%", align: "left" },
];

function _n(v) { const n = Number(String(v).replace(/[^\d.-]/g, "")); return isFinite(n) ? n : 0; }
function _fmt(n) { return (Number(n) || 0).toLocaleString("ko-KR"); }

function recalcBudget(data) {
  let subtotalSum = 0;
  (data.categories || []).forEach((cat) => {
    cat.subtotal = 0;
    (cat.items || []).forEach((it) => {
      const up = _n(it.unit_price);
      const qty = _n(it.qty);
      const util = _n(it.utilization);
      // amount = unit_price × qty × (util/100 or 1)
      const mult = util > 0 ? util / 100 : 1;
      it.amount = Math.round(up * qty * mult);
      cat.subtotal += it.amount;
    });
    subtotalSum += cat.subtotal;
  });
  data.subtotal_sum = subtotalSum;
  data.admin_fee   = Math.round(subtotalSum * 0.08);            // 일반관리비 8%
  data.agency_fee  = Math.round((subtotalSum + data.admin_fee) * 0.10);  // 대행료 10%
  data.total       = subtotalSum + data.admin_fee + data.agency_fee;
  data.proposed    = Math.floor(data.total / 10000) * 10000;    // 만원 단위 절사
  data.vat         = Math.round(data.proposed * 0.10);
  data.grand_total = data.proposed + data.vat;
  return data;
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
    h("div", {}, "AI가 과업을 분석하고 업계 평균 시세로 산출내역을 작성하고 있어요…"),
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
    const rows = [
      { label: "소계 합", value: data.subtotal_sum },
      { label: "일반관리비 (소계합 × 8%)", value: data.admin_fee },
      { label: "대행료 ((소계합+일반관리비) × 10%)", value: data.agency_fee },
      { label: "합계", value: data.total, strong: true },
      { label: "제안가 (만원 단위 절사)", value: data.proposed, strong: true, accent: true },
      { label: "부가세 (제안가 × 10%)", value: data.vat },
      { label: "최종 제안가 (VAT 포함)", value: data.grand_total, huge: true, accent: true },
    ];
    rows.forEach((r) => {
      summary.appendChild(h("div", { class: "budget-sum-row " + (r.accent ? "accent" : "") + (r.huge ? " huge" : "") }, [
        h("div", { class: "sum-label" }, r.label),
        h("div", { class: "sum-value" + (r.strong ? " strong" : ""), }, _fmt(r.value) + "원"),
      ]));
    });
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
    html: `${iconHtml("save", 14)}<span>엑셀 다운로드</span>`,
    onclick: () => downloadBudgetCsv(data),
  }));
}

function downloadBudgetCsv(data) {
  const header = ["구분", "항목", "세부내역", "단가", "수량", "단위", "기간", "투입율", "금액", "비고"];
  const rows = [header];
  (data.categories || []).forEach((cat) => {
    (cat.items || []).forEach((it) => {
      rows.push([
        cat.name, it.item || "", it.spec || "",
        it.unit_price, it.qty, it.unit || "",
        it.period || "", it.utilization || 100,
        it.amount, it.note || "",
      ]);
    });
    rows.push(["", "", "", "", "", "", "", "소계", cat.subtotal, ""]);
  });
  rows.push(["", "", "", "", "", "", "", "소계합", data.subtotal_sum, ""]);
  rows.push(["", "", "", "", "", "", "", "일반관리비(8%)", data.admin_fee, ""]);
  rows.push(["", "", "", "", "", "", "", "대행료(10%)", data.agency_fee, ""]);
  rows.push(["", "", "", "", "", "", "", "합계", data.total, ""]);
  rows.push(["", "", "", "", "", "", "", "제안가(만원절사)", data.proposed, ""]);
  rows.push(["", "", "", "", "", "", "", "부가세(10%)", data.vat, ""]);
  rows.push(["", "", "", "", "", "", "", "최종 제안가(VAT포함)", data.grand_total, ""]);

  const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `산출내역서_${(data.title || "제안").replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
        <td>${escapeHtml(it.spec || "")}</td>
        <td class="num">${_fmt(it.unit_price)}</td>
        <td class="num">${_fmt(it.qty)}</td>
        <td class="c">${escapeHtml(it.unit || "")}</td>
        <td class="c">${escapeHtml(it.period || "")}</td>
        <td class="num">${_fmt(it.utilization)}%</td>
        <td class="num bold">${_fmt(it.amount)}</td>
        <td>${escapeHtml(it.note || "")}</td>
      </tr>`).join("");
    const sub = `<tr class="sub"><td colspan="8" class="r">소계</td><td class="num bold accent">${_fmt(cat.subtotal)}원</td><td></td></tr>`;
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
<colgroup><col style="width:13%"/><col style="width:13%"/><col style="width:20%"/><col style="width:10%"/><col style="width:6%"/><col style="width:6%"/><col style="width:8%"/><col style="width:7%"/><col style="width:12%"/><col style="width:12%"/></colgroup>
<thead><tr>
<th>구분</th><th>항목</th><th>세부내역</th><th>단가</th><th>수량</th><th>단위</th><th>기간</th><th>투입율</th><th>금액</th><th>비고</th>
</tr></thead>
<tbody>${rowHtml}</tbody>
</table>
<div class="summary">
<div class="summary-row"><span>소계 합</span><span class="val">${_fmt(data.subtotal_sum)}원</span></div>
<div class="summary-row"><span>일반관리비 (소계합 × 8%)</span><span class="val">${_fmt(data.admin_fee)}원</span></div>
<div class="summary-row"><span>대행료 ((소계합+관리비) × 10%)</span><span class="val">${_fmt(data.agency_fee)}원</span></div>
<div class="summary-row"><span><b>합계</b></span><span class="val"><b>${_fmt(data.total)}원</b></span></div>
<div class="summary-row accent"><span>제안가 (만원 단위 절사)</span><span class="val">${_fmt(data.proposed)}원</span></div>
<div class="summary-row"><span>부가세 (제안가 × 10%)</span><span class="val">${_fmt(data.vat)}원</span></div>
<div class="summary-row huge"><span>최종 제안가 (VAT 포함)</span><span class="val">${_fmt(data.grand_total)}원</span></div>
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
  root.appendChild(await renderSidebar("clients"));

  const main = h("main", { class: "main" });
  root.appendChild(main);

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

  main.appendChild(h("header", { class: "main-header" }, [
    h("div", { class: "flex-row", style: "gap: 18px;" }, [
      h("img", { class: "header-logo", src: "/static/logo.png", alt: "NightOff", onclick: () => navigate("/") }),
      h("div", {}, [
        h("h1", {}, "대시보드"),
        // 시간대별 인사 (item 11-C)
        h("p", {}, getTimeBasedGreeting()),
      ]),
    ]),
    h("button", {
      class: "btn btn-primary btn-lg",
      onclick: () => navigate("/client/new"),
      html: `${iconHtml("plus", 18)}<span>새 과업</span>`,
    }),
  ]));

  const content = h("div", { class: "main-content" });
  main.appendChild(content);

  // ── 최상단: 핵심 기능 히어로 배너 (1 메인 + 3 서브)
  content.appendChild(renderHeroBanner());

  // ── 핵심 스탯 4개 (승률 포함)
  const winRateDisplay = stats.win_rate === null || stats.win_rate === undefined ? "—" : `${stats.win_rate}`;
  const winRateUnit = stats.win_rate === null || stats.win_rate === undefined ? "" : "%";
  const statItems = [
    { label: "등록 과업",    value: stats.total_clients ?? 0,    unit: "개", icon: "users",    tint: "var(--primary-soft)", fg: "var(--primary)" },
    { label: "작성 제안서",  value: stats.total_proposals ?? 0,  unit: "건", icon: "file",     tint: "var(--success-soft)", fg: "var(--success)" },
    { label: "이번 달 활동", value: stats.month_activity ?? 0,   unit: "회", icon: "activity", tint: "var(--warning-soft)", fg: "var(--warning)" },
    { label: `수주율 (${stats.wins ?? 0}승 ${stats.losses ?? 0}패)`,
                              value: winRateDisplay,             unit: winRateUnit, icon: "trending", tint: "var(--accent)", fg: "var(--accent-fg)" },
  ];
  const statsGrid = h("div", { class: "stats-grid stats-grid-4" });
  statItems.forEach((s, idx) => {
    // stagger 진입 (item 11-A) — 카드별 50ms 지연
    const valueNode = document.createTextNode("0");
    const card = h("div", {
      class: "card stat-card stagger-in",
      style: `--stagger-delay: ${idx * 60}ms;`,
    }, [
      h("div", { class: "flex-between", style: "align-items: flex-start;" }, [
        h("div", {}, [
          h("p", { class: "stat-label" }, s.label),
          h("p", { class: "stat-value", style: "margin: 0;" }, [
            valueNode,
            h("span", { class: "stat-unit" }, s.unit),
          ]),
        ]),
        h("div", { class: "stat-icon-wrap", style: `background: ${s.tint}; color: ${s.fg};`, html: iconHtml(s.icon, 22) }),
      ]),
    ]);
    statsGrid.appendChild(card);
    // 숫자 roll-up (item 11-B) — 0 → 실제 값 0.6s
    const target = Number(s.value);
    if (Number.isFinite(target) && target > 0) {
      const dur = 600;
      const t0 = performance.now();
      // 진입 stagger 끝나고 시작
      setTimeout(() => {
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);  // easeOutCubic
          valueNode.nodeValue = String(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
          else valueNode.nodeValue = String(target);
        };
        requestAnimationFrame(tick);
      }, idx * 60 + 80);
    } else {
      valueNode.nodeValue = String(s.value);
    }
  });
  content.appendChild(h("section", { style: "margin-bottom: 28px;" }, statsGrid));

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

  // ── 하단: 좌(과업 목록) / 우(오늘의 팁 + 최근 활동)
  const twoCol = h("div", { class: "dashboard-two-col" });
  content.appendChild(twoCol);

  // [좌] 과업 목록
  const leftCol = h("section");
  leftCol.appendChild(h("h2", { class: "dashboard-section-label" }, "과업 목록"));
  if (clients.length === 0) {
    // 빈 상태 — 노을 일러스트 + 따뜻한 카피
    leftCol.appendChild(h("div", { class: "card empty-state empty-state-lg" }, [
      h("div", { class: "empty-illust", html: SVG_ILLUST.sunset }),
      h("p", { class: "empty-title" }, "오늘은 어떤 과업부터 시작해볼까요?"),
      h("p", { class: "empty-desc muted" }, "RFP만 넣으면 분석부터 초안까지 — 같이 일찍 끝내봐요 ✨"),
    ]));
  } else {
    const grid = h("div", { class: "client-grid client-grid-2" });
    clients.forEach((c) => grid.appendChild(clientCard(c)));
    leftCol.appendChild(grid);
  }
  twoCol.appendChild(leftCol);

  // [우] 오늘의 팁 + 가짜 광고 (최근 활동은 좌측 사이드바 하단으로 이동됨)
  const rightCol = h("aside", { class: "dashboard-side-col" });

  // 1) 오늘의 팁 (5초 롤링)
  rightCol.appendChild(renderTodayTipCard());

  // 2) (드립) 가짜 스폰서 광고 — 닫기 버튼 눌러도 안 닫힘 ㅋㅋ
  rightCol.appendChild(renderFakeAdBanner());

  twoCol.appendChild(rightCol);

  // 핵심 기능 배너는 최상단으로 옮겨졌고 (renderHeroBanner)
  // 푸터는 글로벌 푸터(#global-footer)로 일원화 — 대시보드 자체 푸터 제거
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

// 시간대별 인사가 dnaR 등을 사용하지 않도록 만든 더미 (renderSmartLearningBanner 호환)
function renderSmartLearningBanner() {
  return document.createDocumentFragment();
}

// ---------- 💡 오늘의 팁 (사이드 카드 · 5초 롤링) ----------
const PROPOSAL_TIPS = [
  "RFP 복붙은 평가위원이 바로 알아채요. 반드시 우리 언어로 재해석하세요 ✍️",
  "배점 30점 이상 항목은 반드시 3페이지 이상 할애하세요 📄",
  "거버닝 메시지는 서술형이 아니라 명사형으로 끊어야 임팩트 있어요 💥",
  "추상적 표현은 금물! '우수한 안전관리' 대신 '99.9% 무사고 운영 실적'으로 📊",
  "페이지당 시각화 요소 최소 2개, 텍스트만 가득한 페이지는 평가위원이 안 읽어요 👀",
  "제안서 제출 전 업체명 노출 여부 반드시 확인하세요. 실격 사유예요 ⚠️",
  "페이지 수 초과는 아무리 잘 써도 실격이에요. 꼭 세어보세요 🔢",
  "PT 발표는 10분 안에 끝내야 해요. 시간 초과하면 강제 종료돼요 ⏱️",
  "평가위원은 하루에 수십 개 제안서를 봐요. 첫 페이지가 전부예요 🎯",
  "직접생산증명서, 사업수행실적 등 자격서류 미리 준비해두세요 📁",
  "배점이 같아도 발주처가 강조한 키워드가 있어요. RFP를 세 번 읽으세요 🔍",
  "경쟁사보다 못한 부분은 언급 말고, 잘하는 부분을 극대화하세요 💪",
  "발주처 담당자가 바뀌어도 기관의 방향성은 유지돼요. 과거 사업을 꼭 찾아보세요 🏛️",
  "'우리는 ~합니다' ❌ → '발주처는 ~을 확보합니다' ✅",
  "안전관리 계획은 얼마나 구체적이냐가 승패를 갈라요. 수치로 써주세요 🦺",
  "마감 당일 제출은 용기가 아니라 도박이에요 🎲",
  "나라장터 전자입찰은 마감 30분 전에 서버가 폭주해요. 일찍 제출하세요 🏃",
  "PT 심사 날짜 확인했나요? 제안서 제출일과 다를 수 있어요 📅",
];

function renderTodayTipCard() {
  // 시작 인덱스는 날짜 시드로 — 새로고침 시마다 약간 다르게
  let idx = Math.floor(Math.random() * PROPOSAL_TIPS.length);

  const card = h("div", { class: "tip-card" });
  card.appendChild(h("div", { class: "tip-card-head" }, [
    h("span", { class: "tip-emoji" }, "💡"),
    h("span", { class: "tip-label" }, "오늘의 팁"),
  ]));
  const quote = h("blockquote", { class: "tip-quote" });
  quote.textContent = PROPOSAL_TIPS[idx];
  card.appendChild(quote);

  // 5초마다 부드럽게 다음 팁으로 교체 (fade out → in)
  const interval = setInterval(() => {
    // DOM 에서 떠난 카드면 정리
    if (!document.body.contains(card)) {
      clearInterval(interval);
      return;
    }
    idx = (idx + 1) % PROPOSAL_TIPS.length;
    quote.classList.add("tip-out");
    setTimeout(() => {
      quote.textContent = PROPOSAL_TIPS[idx];
      quote.classList.remove("tip-out");
      quote.classList.add("tip-in");
      setTimeout(() => quote.classList.remove("tip-in"), 350);
    }, 280);
  }, 5000);

  return card;
}

// ---------- 📢 가짜 스폰서 광고 (드립용) ----------
const FAKE_AD_LINES = [
  { copy: "오늘도 야근?\n\nNightOff가 있잖아요 😊",          tone: "midnight" },
  { copy: "밤새지 말자고\n만들었습니다 🌙",                   tone: "indigo" },
  { copy: "RFP 복붙하다\n걸리셨나요? ㅋㅋ",                   tone: "yellow" },
  { copy: "개찰결과 뜨면\n대표자 이름부터\n확인하시죠? 🏆",   tone: "violet" },
  { copy: "애매하게 썼으면\n전화는 잘 받아주세요,\n공뭔님들 📞", tone: "rose" },
];

function renderFakeAdBanner() {
  const pick = FAKE_AD_LINES[Math.floor(Math.random() * FAKE_AD_LINES.length)];
  const card = h("div", { class: `fake-ad fake-ad-${pick.tone}` });

  // 상단 라벨 + 가짜 닫기 버튼 (눌러도 안 닫힘 ㅋ)
  card.appendChild(h("div", { class: "fake-ad-head" }, [
    h("span", { class: "fake-ad-label" }, "스폰서 광고"),
    h("button", {
      class: "fake-ad-close", title: "닫기",
      "aria-label": "닫기",
      onclick: (e) => {
        e.stopPropagation();
        // 흔들리면서 토스트 — 안 닫혀요 ㅋㅋ
        card.classList.remove("ad-shake");
        // 강제 reflow → 다시 추가 시 애니메이션 재시작
        void card.offsetWidth;
        card.classList.add("ad-shake");
        const msgs = [
          "어... 안 닫히네요? 😏",
          "광고는 열심히 일하는 중이에요 😅",
          "닫는 척만 했어요 ㅋ",
          "스폰서가 너무 소중해서요 💸",
        ];
        toast(msgs[Math.floor(Math.random() * msgs.length)], "");
      },
      html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    }),
  ]));

  // 본문 — 줄바꿈 보존
  const copy = h("div", { class: "fake-ad-copy" });
  copy.textContent = pick.copy;
  card.appendChild(copy);

  // 가짜 CTA — 눌러봐도 닫기와 같은 운명 ㅋ
  card.appendChild(h("button", {
    class: "fake-ad-cta",
    onclick: () => {
      toast("이 광고는 제가 만든 거예요 ㅋㅋ", "");
    },
  }, "더 알아보기 →"));

  // 푸터 — 진짜 광고 같은 마이크로 텍스트
  card.appendChild(h("div", { class: "fake-ad-footer" }, "Sponsored · NightOff"));

  return card;
}

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

function clientCard(c) {
  const initials = (c.name || "?").trim().slice(0, 1);
  const badges = [];
  if (c.has_rfp > 0) badges.push({ cls: "badge-primary", label: "RFP" });
  if (c.memory_count > 0) badges.push({ cls: "badge-success", label: `대화기억 ${c.memory_count}` });
  if (c.conv_count > 0) badges.push({ cls: "badge-muted", label: `제안서 ${c.conv_count}` });

  // D-day 계산 (서버가 client.deadline 을 내려주면 사용, 없으면 null)
  const dday = calcDday(c.deadline);

  return h("div", {
    class: "card client-card",
    onclick: () => navigate(`/client/${c.id}`),
  }, [
    h("div", { class: "client-card-head" }, [
      h("div", { class: "flex-row", style: "gap: 12px; flex: 1; min-width: 0;" }, [
        h("div", { class: "client-logo" }, initials),
        h("div", { style: "flex: 1; min-width: 0;" }, [
          h("h3", {}, c.name),
          h("p", { class: "client-sub" }, c.industry || "업종 미지정"),
        ]),
      ]),
      ddayBadge(dday),
    ]),
    badges.length
      ? h("div", { class: "flex-row", style: "flex-wrap: wrap; gap: 6px;" },
          badges.map((b) => h("span", { class: `badge ${b.cls}` }, b.label)))
      : null,
    h("div", { class: "client-meta" }, [
      h("span", { class: "flex-row", html: `${iconHtml("calendar", 14)}<span>${fmtDate(c.last_conv || c.updated_at)}</span>` }),
      h("span", { class: "flex-row", html: `${iconHtml("msg", 14)}<span>대화 ${c.conv_count}건</span>` }),
    ]),
  ]);
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
  root.appendChild(await renderSidebar());
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
  root.appendChild(await renderSidebar());
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

  // 화면 순서 (사용자 요청 / item 4):
  //  1️⃣ RFP 분석 (필수 첫 단계)
  //  2️⃣ 발주처 들여다보기 👀 (RFP 분석 후 자동 채워짐)
  //  3️⃣ ✨ 대화 시작하기 (보라 큰 CTA 버튼)
  //  4️⃣ 🎤 PT 연습하기 (제안서 완성 후 활성화 / 지금은 비활성)
  //  📋 대화 기록 (하단)
  // ── 강점 기능은 의도적으로 제거됨 (추상적 신호라 제안서 품질에 역효과)
  const [rfpSec, intelSec, historySec] = await Promise.all([
    renderRfpSection(cid),
    renderClientIntelSection(cid, client),
    renderConvHistorySection(cid),
  ]);
  stack.appendChild(rfpSec);
  stack.appendChild(intelSec);

  // 3️⃣ + 4️⃣ — 핵심 CTA 묶음 (대화 시작 + PT 연습)
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
    ]),
  ]);
  return card;
}

// ---------- 🎉 제안서 완성 confetti (가벼운 vanilla — 외부 라이브러리 X) ----------
function celebrateConfetti() {
  const colors = ['#7C3AED', '#EC4899', '#F59E0B', '#16A34A', '#3B82F6'];
  const layer = h("div", { class: "confetti-layer" });
  document.body.appendChild(layer);
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.background = colors[i % colors.length];
    piece.style.left = (Math.random() * 100) + "%";
    piece.style.animationDelay = (Math.random() * 0.3) + "s";
    piece.style.animationDuration = (1.6 + Math.random() * 1.2) + "s";
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
  }
  setTimeout(() => layer.remove(), 3500);
}

// ---------- 🖼 PPTX PNG 미리보기 모달 (Phase 3-C) ----------
function openPptxPreviewModal(slides) {
  if (!slides || !slides.length) {
    toast("미리보기 슬라이드가 없어요", "error");
    return;
  }
  const backdrop = h("div", { class: "modal-backdrop pptx-preview-backdrop" });
  const modal = h("div", { class: "modal pptx-preview-modal" });

  let cur = 0;
  const total = slides.length;

  // 헤더
  modal.appendChild(h("div", { class: "modal-header" }, [
    h("h3", {}, "🖼 슬라이드 미리보기"),
    h("div", { class: "flex-row", style: "gap: 14px; align-items: center;" }, [
      h("span", { class: "pptx-preview-counter" }, `${cur + 1} / ${total}`),
      h("button", {
        class: "icon-btn", onclick: () => backdrop.remove(),
        "aria-label": "닫기",
        html: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      }),
    ]),
  ]));

  // 본문 — 큰 슬라이드 + 좌우 ◀▶
  const stage = h("div", { class: "pptx-preview-stage" });
  const img = h("img", { class: "pptx-preview-img", src: slides[0].url, alt: "슬라이드 1" });
  stage.appendChild(img);

  const goTo = (newIdx) => {
    cur = Math.max(0, Math.min(total - 1, newIdx));
    img.src = slides[cur].url;
    img.alt = `슬라이드 ${cur + 1}`;
    modal.querySelector(".pptx-preview-counter").textContent = `${cur + 1} / ${total}`;
    modal.querySelector(".pptx-preview-prev").disabled = cur === 0;
    modal.querySelector(".pptx-preview-next").disabled = cur === total - 1;
    // 썸네일 active 표시
    modal.querySelectorAll(".pptx-thumb").forEach((t, i) => {
      t.classList.toggle("active", i === cur);
    });
  };

  // 좌우 navigation 버튼 (overlay)
  stage.appendChild(h("button", {
    class: "pptx-preview-prev pptx-preview-nav",
    title: "이전 (←)", disabled: cur === 0,
    onclick: () => goTo(cur - 1),
    html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  }));
  stage.appendChild(h("button", {
    class: "pptx-preview-next pptx-preview-nav",
    title: "다음 (→)", disabled: cur === total - 1,
    onclick: () => goTo(cur + 1),
    html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  }));
  modal.appendChild(stage);

  // 하단 — 썸네일 strip
  const thumbStrip = h("div", { class: "pptx-thumb-strip" });
  slides.forEach((s, i) => {
    thumbStrip.appendChild(h("button", {
      class: "pptx-thumb" + (i === cur ? " active" : ""),
      title: `슬라이드 ${i + 1}`,
      onclick: () => goTo(i),
    }, [
      h("img", { src: s.url, alt: `Thumb ${i + 1}` }),
      h("span", { class: "pptx-thumb-num" }, String(i + 1)),
    ]));
  });
  modal.appendChild(thumbStrip);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // 키보드 좌우 navigation
  const keyHandler = (e) => {
    if (e.key === "ArrowLeft") goTo(cur - 1);
    else if (e.key === "ArrowRight") goTo(cur + 1);
    else if (e.key === "Escape") backdrop.remove();
  };
  document.addEventListener("keydown", keyHandler);
  // 모달 제거 시 keyHandler 정리
  const origRemove = backdrop.remove.bind(backdrop);
  backdrop.remove = () => {
    document.removeEventListener("keydown", keyHandler);
    origRemove();
  };
  // 백드롭 클릭 시 닫기 (모달 내부 클릭은 X)
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
}


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
          const a = document.createElement("a");
          a.href = cv.pptx_path;
          a.download = "";  // 서버 Content-Disposition 따름
          document.body.appendChild(a); a.click(); a.remove();
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
      const r = await fetch(`/api/clients/${cid}/rfp/upload`, { method: "POST", body: fd });
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

// ---------- 과업 성향 ----------
async function renderProfileSection(cid) {
  const p = await api.get(`/api/clients/${cid}/profile`).catch(() => ({ exists: false }));
  const card = h("div", { class: "card" });

  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", style: "background: var(--primary-soft); color: var(--primary);", html: iconHtml("brain", 18) }),
      h("div", {}, [
        h("h3", { class: "card-title" }, "과업 성향"),
        h("p", { class: "card-subtitle" }, p.exists ? `${p.sample_count || 1}회 축적 · RFP와 대화에서 자동 학습` : "RFP를 넣고 대화할수록 NightOff이 이 과업을 더 깊이 이해해요"),
      ]),
    ]),
    p.exists ? h("span", {
      class: "win-rate-badge " + (p.win_rate === null ? "muted" : (p.win_rate >= 50 ? "good" : "warn")),
      title: `수주 ${p.win}건 / 탈락 ${p.lose}건`,
    }, p.win_rate === null ? "기록 없음" : `승률 ${p.win_rate}%`) : null,
  ]));

  const body = h("div", { class: "card-body row-gap-14" });
  card.appendChild(body);

  if (!p.exists) {
    body.appendChild(h("div", { class: "onboarding-hint" }, [
      h("span", { class: "ob-emoji" }, "✨"),
      h("div", {}, [
        h("p", { class: "ob-title" }, "다음 입찰엔 더 정확한 제안서가 나와요"),
        h("p", { class: "ob-desc" }, "RFP를 분석하고 대화를 나눌수록 이 과업의 선호 키워드·높은 배점 항목·반복 요구사항을 자동으로 축적해요. 쌓인 프로파일은 모든 새 제안서에 자동으로 반영됩니다."),
      ]),
    ]));
    return card;
  }

  // 선호 키워드 — 태그 클라우드 (빈도 가중치 없어도 크기 랜덤 배분 느낌)
  if (p.keywords?.length) {
    body.appendChild(h("div", {}, [
      h("p", { class: "small muted", style: "margin: 0 0 10px; font-weight: 500;" }, "선호 키워드"),
      h("div", { class: "tag-cloud" },
        p.keywords.map((k, i) => {
          const sizes = ["sz-lg", "sz-md", "sz-sm"];
          const sz = sizes[i % sizes.length];
          return h("span", { class: `cloud-tag ${sz}` }, k);
        })),
    ]));
  }

  // 높은 배점 항목 — 가로 바 차트
  if (p.high_weight_items?.length) {
    const items = p.high_weight_items.slice(0, 6);
    body.appendChild(h("div", {}, [
      h("p", { class: "small muted", style: "margin: 0 0 10px; font-weight: 500;" }, "높은 배점 항목 (상위 6개)"),
      h("div", { class: "hbar-chart" },
        items.map((x, i) => {
          // 순위 기반 가중치: 1등 100%, 2등 82%, 3등 68%, ...
          const pct = Math.round(100 - (i * 14));
          return h("div", { class: "hbar-row" }, [
            h("div", { class: "hbar-label" }, x),
            h("div", { class: "hbar" }, [h("span", { style: `width: ${pct}%;` })]),
          ]);
        })),
    ]));
  }

  if (p.recurring_reqs?.length) {
    body.appendChild(h("div", {}, [
      h("p", { class: "small muted", style: "margin: 0 0 8px; font-weight: 500;" }, "반복 요구사항"),
      h("div", { class: "flex-row", style: "flex-wrap: wrap; gap: 6px;" },
        p.recurring_reqs.map((x) => h("span", { class: "badge badge-warning" }, x))),
    ]));
  }

  // 축적된 인사이트 — 아이콘 + 한 줄 카드
  if (p.insights?.length) {
    body.appendChild(h("div", {}, [
      h("p", { class: "small muted", style: "margin: 0 0 10px; font-weight: 500;" }, "축적된 인사이트"),
      h("div", { class: "insight-stack" },
        p.insights.map((ins) => h("div", { class: "insight-card" }, [
          h("div", { class: "insight-icon", html: iconHtml("brain", 16) }),
          h("span", {}, ins),
        ]))),
    ]));
  }

  return card;
}

// ---------- Memory ----------
async function renderMemorySection(cid) {
  const mems = await api.get(`/api/clients/${cid}/memories`).catch(() => []);
  const card = h("div", { class: "card" });

  let expanded = false;
  const headBtn = h("div", { class: "card-head", style: "cursor: pointer; user-select: none;" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: iconHtml("brain", 18) }),
      h("div", {}, [
        h("h3", { class: "card-title" }, "대화 기억"),
        h("p", { class: "card-subtitle" }, `AI가 학습한 과업 정보 ${mems.length}개 · 새 대화에 자동 주입됩니다`),
      ]),
    ]),
    h("button", { class: "icon-btn", id: "mem-toggle", html: iconHtml("chevronD", 18) }),
  ]);
  card.appendChild(headBtn);

  const body = h("div", { class: "card-body row-gap-10", style: "display: none;" });
  card.appendChild(body);

  if (mems.length === 0) {
    body.appendChild(h("div", { class: "muted small", style: "padding: 4px 0;" }, "대화 종료 시 자동으로 뉘앙스가 축적됩니다."));
  }

  mems.forEach((m) => {
    body.appendChild(h("div", { class: "file-row", style: "align-items: flex-start;" }, [
      h("div", { class: "left" }, [
        h("div", { style: "min-width: 0; flex: 1;" }, [
          h("div", { class: "flex-row", style: "gap: 8px; margin-bottom: 6px;" }, [
            h("span", { class: "badge badge-primary" }, m.category),
            h("span", { class: "small muted" }, fmtDate(m.created_at)),
          ]),
          h("p", { class: "file-name", style: "font-weight: 400; font-size: 14px;" }, m.content),
          m.tags?.length ? h("div", { style: "margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px;" },
            m.tags.map((t) => h("span", { class: "tag-chip" }, "#" + t))) : null,
        ]),
      ]),
      h("button", {
        class: "icon-btn", title: "삭제", html: iconHtml("x", 14),
        onclick: async () => {
          if (!confirm("이 기억을 삭제하시겠습니까?")) return;
          await api.del(`/api/memories/${m.id}`);
          toast("삭제되었습니다", "success");
          renderClientDetail(cid);
        },
      }),
    ]));
  });

  headBtn.addEventListener("click", () => {
    expanded = !expanded;
    body.style.display = expanded ? "flex" : "none";
    $("#mem-toggle", card).innerHTML = iconHtml(expanded ? "chevronD" : "chevronD", 18);
    $("#mem-toggle", card).style.transform = expanded ? "rotate(180deg)" : "";
  });

  return card;
}

// ---------- Chat Screen ----------
async function renderChat(cid, convId) {
  const root = $("#app-root");
  root.innerHTML = "";
  // 채팅 화면은 우측 패널 숨김 (메인 영역 꽉 사용)
  document.body.classList.add("right-panel-off");

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

  root.appendChild(await renderSidebar());

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
  const injected = {
    rfp: !!data.rfp_analysis,
    memory: false,
    refs: false,
  };
  try {
    const m = await api.get(`/api/clients/${cid}/memories`); injected.memory = m.length > 0;
  } catch {}
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
      injected.memory ? h("span", { class: "nuance-badge", title: "대화 기억이 이 대화에 자동 적용됩니다" }, [
        h("span", { class: "dot" }),
        document.createTextNode("이 과업의 대화 기억이 적용됐어요"),
      ]) : null,
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
      // ✨ 제안서 생성 (multi-pass) — 명시적 버튼
      h("button", {
        class: "btn btn-primary",
        html: `<span style="margin-right:4px;">✨</span><span>제안서 생성</span>`,
        onclick: async () => {
          // 채팅 input 영역에 진행률 표시 — 가짜 user 메시지로 시각화
          const msgs = document.getElementById("chat-messages") || document.querySelector(".chat-messages");
          if (!msgs) { toast("채팅 영역을 못 찾았어요", "error"); return; }
          const userBubble = h("div", { class: "msg-row user" }, [
            h("div", { class: "msg-body" }, [
              h("div", { class: "msg-bubble" }, "✨ 제안서 생성"),
            ]),
          ]);
          msgs.appendChild(userBubble);
          // 5초 toast — 작업 시간 + 페이지 이동 경고
          toast("5~10분 소요. 작업 진행 중 페이지 이동·새로고침 X", "", 5000);
          const asstEl = msgElement("assistant", "", new Date().toISOString());
          msgs.appendChild(asstEl);
          const bubble = asstEl.querySelector(".msg-bubble");
          bubble.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
          const progress = createStreamProgress();
          asstEl.querySelector(".msg-body").insertBefore(progress.el, bubble);
          const body = msgs.parentElement || document.body;
          try {
            await runMultiPassProposal({ convId, asstEl, bubble, progress, body, msgs });
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
        },
      }),
      // 자체 검증 버튼 (Compliance + Red Team)
      h("button", {
        class: "btn btn-outline", title: "RFP 요구사항 누락·예상 점수 점검",
        html: `<span style="margin-right:4px;">🔍</span><span>자체 검증</span>`,
        onclick: () => openAuditModal(convId),
      }),
      // 산출내역서 버튼
      h("button", {
        class: "btn btn-outline", html: `${iconHtml("file", 14)}<span>산출내역서</span>`,
        onclick: () => openBudgetModal(convId),
      }),
      h("button", {
        class: "btn btn-outline", html: `${iconHtml("save", 14)}<span>대화 마치기</span>`,
        onclick: async () => {
          if (!confirm("대화를 종료하고 기억을 저장하시겠습니까? AI가 대화에서 뉘앙스를 추출해 과업에 저장합니다.")) return;
          toast("대화 기억 저장 중…", "");
          try {
            const r = await api.post(`/api/conversations/${convId}/end`);
            toast(`${r.memories_added}개 기억이 저장되었습니다`, "success");
            navigate(`/client/${cid}`);
          } catch (e) { toast(String(e.message || e), "error"); }
        },
      }),
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

  // Input
  const ta = h("textarea", { placeholder: "메시지를 입력하세요… (Shift+Enter 줄바꿈, Enter 전송)", rows: 1 });
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

    // 진행 표시 바 — 스트리밍 중 현재 섹션/페이지 표시
    const progress = createStreamProgress();
    asstEl.querySelector(".msg-body").insertBefore(progress.el, bubble);

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
    // [Phase 3-D fix] JSON 응답은 raw 텍스트로 노출하면 UX 망가짐 — placeholder 로 가림
    let isJsonMode = false;
    let jsonModeDecided = false;

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
        // JSON 모드는 done 시점에 placeholder 제거로 처리 — raw 렌더 X
        if (streamDone && !isJsonMode) renderAssistant(bubble, targetText, true);
        return;
      }
      const lag = targetText.length - displayedText.length;
      // 뒤처진 정도에 비례해서 더 많이 진행 — 최소 2자, 최대 24자/frame
      const step = Math.min(24, Math.max(2, Math.ceil(lag / 10)));
      displayedText = targetText.slice(0, displayedText.length + step);
      // JSON 모드면 bubble 에 raw 안 그림 (placeholder 유지) — progress 바만 갱신
      if (!isJsonMode) renderAssistant(bubble, displayedText);
      progress.update(targetText);   // ← 전체 target 기준으로 진행률 업데이트
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: aborter.signal,
      });
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
            progress.update(targetText);
            // [Phase 3-D fix · 강화] JSON 모드 감지 — 누적 80자 이상이면 한 번 판정
            // 더 관대하게: 평문 prefix 가 있어도 JSON 키워드만 보이면 JSON 모드로 간주
            if (!jsonModeDecided && targetText.length >= 80) {
              jsonModeDecided = true;
              const head = targetText.slice(0, 400);
              // 4가지 케이스 모두 JSON 으로 인식:
              //   ① ```json 코드펜스 시작
              //   ② { 로 바로 시작 + title/domain/slides 키 등장
              //   ③ 평문 prefix 후 어딘가에 ```json 등장
              //   ④ 평문 prefix 후 "slides": [ 패턴 등장
              isJsonMode =
                /```json/.test(head) ||
                /^\s*\{[\s\S]*?"(?:title|domain|accent|summary|slides)"/.test(head) ||
                /"slides"\s*:\s*\[/.test(head);
              if (isJsonMode) {
                bubble.innerHTML =
                  '<div class="json-stream-placeholder">' +
                    '<span class="loading-dots"><span></span><span></span><span></span></span>' +
                    '<span class="muted">제안서 구조를 설계하고 있어요…</span>' +
                  '</div>';
                // [B7] JSON 감지와 동시에 우측 패널 'preparing' 상태로 띄움
                try { shell._setSidePanelPng && shell._setSidePanelPng("preparing"); } catch {}
              }
            }
            kickTyper();
          } else if (ev.type === "error") {
            overlayLoader.stop();
            bubble.innerHTML = `<span style="color:var(--danger);">❌ ${escapeHtml(ev.error)}</span>`;
            streamDone = true;
            progress.finish(false);
          } else if (ev.type === "done") {
            overlayLoader.stop();
            streamDone = true;
            displayedText = targetText;
            // JSON 모드면 raw 텍스트 안 그리고 placeholder 유지 → done 후 doneBubble 이 안내
            if (!isJsonMode) renderAssistant(bubble, targetText, true);
            progress.finish(true);
          }
        }
      }
      // 스트림 끝났는데 displayed가 아직 따라잡지 못한 경우 보강
      if (displayedText.length < targetText.length) {
        displayedText = targetText;
        if (!isJsonMode) renderAssistant(bubble, targetText, true);
      }
      // rafActive가 진행 중이면 streamDone을 보고 알아서 마감
      streamDone = true;
      progress.finish(true);
    } catch (e) {
      overlayLoader.stop();
      progress.finish(false);
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
      // 제안서 완성 감지 — JSON (새 모드) 또는 HTML (legacy)
      // [관대하게] 어떤 형태든 "slides": [ 패턴이 나타나면 JSON 으로 인식
      // (코드펜스/평문 prefix/공백 모두 허용)
      const isJson = /"slides"\s*:\s*\[/.test(targetText);
      const isHtml = /<div class="proposal"/.test(targetText);
      if (isJson || isHtml) {
        // [Phase 3-D fix] JSON raw 텍스트가 bubble 에 남아있으면 정리
        if (isJson) {
          bubble.innerHTML =
            '<span class="muted small">✓ 제안서 구조 설계 완료 — PPTX 로 변환할게요</span>';
        }
        const doneBubble = h("div", { class: "msg-bubble" },
          isJson ? "✅ 제안서 완성! PPTX 변환 중… 🔨"
                 : "✅ 제안서 초안이 완성됐어요! 수정이 필요한 부분은 말씀해 주세요 😊");
        const done = h("div", { class: "msg-row assistant proposal-done-row" }, [
          h("div", { class: "msg-avatar", html: iconHtml("brain", 18) }),
          h("div", { class: "msg-body" }, [doneBubble]),
        ]);
        msgs.appendChild(done);
        try { celebrateConfetti(); } catch {}
        if (!userScrolledUp) body.scrollTop = body.scrollHeight;

        // [B7] JSON 모드: 자동 PPTX 생성 + PNG 미리보기 → 우측 사이드패널 (모달 X)
        if (isJson) {
          (async () => {
            const log = (...args) => console.log("[PPTX-FLOW]", ...args);
            log("step 0 · JSON 흐름 진입");
            try {
              // [근본 해결] renderChat(cid, convId) closure 의 convId 직접 사용
              // — location.hash 파싱은 라우팅 방식 변경에 취약 (이전: hash 매칭 실패로 null)
              const cid = convId;
              log("step 1 · convId(closure) =", cid);
              if (!cid) {
                log("❌ STOP — convId 자체가 비어있음 (renderChat 호출 잘못)");
                doneBubble.textContent =
                  "⚠ 대화 ID 를 찾지 못해 PPTX 변환을 시작할 수 없어요. 페이지 새로고침 후 다시 시도해주세요.";
                return;
              }
              // 1단계: PPTX 생성
              try { shell._setSidePanelPng && shell._setSidePanelPng("building"); } catch (e) { log("setSidePanelPng building 실패:", e); }
              log("step 2 · POST /api/proposals/pptx 호출 시작");
              const pptxR = await api.post("/api/proposals/pptx", { conversation_id: cid }, { timeoutMs: 180000 });
              log("step 3 · POST /pptx 응답:", pptxR);
              const pptxUrl = (pptxR && pptxR.url) || null;
              // 2단계: PNG 미리보기
              try { shell._setSidePanelPng && shell._setSidePanelPng("rendering"); } catch (e) { log("setSidePanelPng rendering 실패:", e); }
              log("step 4 · GET /preview 호출 시작");
              const r = await api.get(`/api/proposals/${cid}/preview`, { timeoutMs: 240000 });
              log("step 5 · GET /preview 응답:", r);
              if (r.slides && r.slides.length) {
                doneBubble.textContent =
                  `✅ 제안서 ${r.slides.length}장 완성됐어요! 우측에서 확인해보세요 😊`;
                try {
                  shell._setSidePanelPng && shell._setSidePanelPng("ready", {
                    slides: r.slides,
                    pptxUrl,
                  });
                  log("step 6 · 미리보기 패널 ready 표시 완료");
                } catch (e2) { log("setSidePanelPng ready 실패:", e2); }
              } else {
                log("⚠ slides 비어있음 ·", r);
                doneBubble.textContent =
                  "✅ 제안서 완성. PPTX 다운로드 / 🖼 미리보기 버튼을 눌러주세요.";
                try {
                  shell._setSidePanelPng && shell._setSidePanelPng("error", {
                    error: r.message || "미리보기 생성에 실패했어요",
                  });
                } catch {}
              }
            } catch (e) {
              log("❌ 예외 발생:", e);
              doneBubble.textContent =
                `⚠ PPTX 변환 중 오류: ${(e && e.message) || String(e)}`;
              try {
                shell._setSidePanelPng && shell._setSidePanelPng("error", {
                  error: (e && e.message) || "PPTX 변환 중 오류가 발생했어요",
                });
              } catch {}
            }
          })();
        }
      }
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
  // bullet 리스트 (- / * / •)
  html = html.replace(/^(?:[-*•]\s+.+(?:\n|$))+?/gm, (block) => {
    const items = block.trim().split(/\n/).map((l) => l.replace(/^[-*•]\s+/, "")).map((t) => `<li>${t}</li>`).join("");
    return `<ul class="md-ul">${items}</ul>`;
  });
  // 번호 리스트 (1. / 2.)
  html = html.replace(/^(?:\d+\.\s+.+(?:\n|$))+?/gm, (block) => {
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
                const a = document.createElement("a");
                a.href = r.url; a.download = r.filename || "proposal.pptx";
                document.body.appendChild(a); a.click(); a.remove();
                toast(`PPTX 다운로드 완료 (${r.page_count} 슬라이드) ✨`, "success");
              }
            } catch (err) {
              toast("PPTX 변환 실패: " + (err.message || err), "error");
            } finally {
              btn.disabled = false;
              btn.innerHTML = `${iconHtml("file", 14)}<span>PPTX 다운로드</span>`;
            }
          },
        }),
        h("button", {
          class: "btn btn-outline",
          html: `${iconHtml("eye", 14)}<span>🖼 미리보기</span>`,
          title: "PPTX 슬라이드 PNG 미리보기",
          disabled: !completed,
          onclick: async (e) => {
            const btn = e.currentTarget;
            const m = location.hash.match(/\/chat\/([^/?#]+)/);
            const convId = m ? m[1] : null;
            if (!convId) { toast("대화 정보를 찾지 못했어요", "error"); return; }
            btn.disabled = true; btn.innerHTML = "변환 중…";
            try {
              // 먼저 PPTX 가 없으면 생성
              await api.post("/api/proposals/pptx", { conversation_id: convId }, { timeoutMs: 60000 });
              // PNG 미리보기 가져오기
              const r = await api.get(`/api/proposals/${convId}/preview`, { timeoutMs: 180000 });
              if (r.status !== "cached" && r.status !== "generated") {
                toast(r.message || "미리보기 생성 실패", "error");
                return;
              }
              openPptxPreviewModal(r.slides || []);
            } catch (err) {
              toast("미리보기 실패: " + (err.message || err), "error");
            } finally {
              btn.disabled = false;
              btn.innerHTML = `${iconHtml("eye", 14)}<span>🖼 미리보기</span>`;
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

// ─── Multi-pass 제안서 생성 — SSE 받으면서 진행률 표시 + 끝나면 PPTX 변환 ───
async function runMultiPassProposal({ convId, asstEl, bubble, progress, body, msgs }) {
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

  const resp = await fetch(`/api/conversations/${convId}/proposals/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
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

  // ─ 슬라이드 list 마커 transition ─
  function renderSlideList() {
    const items = outlineList.map((o) => {
      let mark = "·", cls = "mp-pending";
      if (o.status === "doing") { mark = "🔄"; cls = "mp-doing"; }
      else if (o.status === "ok") { mark = "✓"; cls = "mp-done"; }
      else if (o.status === "fail") { mark = "✗"; cls = "mp-fail"; }
      return `<div class="mp-slide-item ${cls}"><span class="mp-mark">${mark}</span> p${o.page}. ${escapeHtml(o.section)} <span class="muted small">· ${escapeHtml(o.governing || "")}</span></div>`;
    }).join("");
    return items;
  }
  function updateBubble(eta) {
    const headerHtml =
      `<div class="mp-warning">⚠ 5~10분 소요. 작업 진행 중 페이지 이동·새로고침 시 진행 사라짐</div>` +
      `<div class="mp-progress-head">` +
        `<div style="font-weight:600;">📑 슬라이드 ${okCount + failCount} / ${totalSlides} 작성 중</div>` +
        (eta ? `<div class="mp-eta muted small">${escapeHtml(eta)}</div>` : "") +
      `</div>`;
    bubble.innerHTML =
      headerHtml +
      `<div class="mp-slide-list">${renderSlideList()}</div>`;
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
        updateBubble("");
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
        updateBubble(calcEta(ev.progress, ev.total));
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
      }
    }
  }

  stopOutlineTimer();
  if (!finalDone) throw new Error("제안서 생성이 완료되지 않았어요.");

  progress.finish(true);

  // PPTX 변환 트리거 — 기존 endpoint 활용
  try {
    const pptxResp = await api.post("/api/proposals/pptx", { conversation_id: convId }, { timeoutMs: 180000 });
    bubble.innerHTML =
      `<div style="line-height:1.6;">` +
        `<div style="font-weight:600;">✅ 제안서 ${totalSlides}장 + PPTX 변환 완료</div>` +
        `<div class="muted small" style="margin-top:6px;">우측 미리보기에서 확인하세요 😊</div>` +
        `<a href="${pptxResp.url}" download="${pptxResp.filename || ''}" style="display:inline-block; margin-top:8px; padding:8px 14px; background:#1A1A1A; color:#fff; border-radius:8px; text-decoration:none; font-weight:600;">⬇ PPTX 다운로드</a>` +
      `</div>`;
    // 우측 미리보기 패널 갱신 — 기존 함수 활용
    try { window.shellSetSidePanelPng && window.shellSetSidePanelPng(pptxResp.url); } catch {}
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

// 새 탭으로 제안서 열기 — 독립 HTML 문서 생성
function openProposalInNewTab(propEl) {
  const title = propEl.getAttribute("data-title") || "제안서";
  const accent = propEl.getAttribute("data-accent") || "#6b46e5";
  const w = window.open("", "_blank");
  if (!w) { toast("팝업이 차단됐어요. 브라우저 팝업 허용 후 다시 시도해주세요.", "error"); return; }
  // style.css 링크의 절대 경로 — 실패 시에도 안전 fallback
  const cssLink = document.querySelector('link[rel="stylesheet"][href*="/static/style.css"]');
  const cssHref = cssLink
    ? new URL(cssLink.getAttribute("href"), location.origin).href
    : `${location.origin}/static/style.css`;
  const bodyHtml = propEl.outerHTML;
  w.document.write(`<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"/>
<title>${title.replace(/</g, "&lt;")} · NightOff</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"/>
<link rel="stylesheet" href="${cssHref}"/>
<style>
  body { margin:0; background:#f5f5f5; font-family:'Pretendard Variable',Pretendard,sans-serif; }
  .proposal-viewer-root {
    padding: 40px 32px 80px;
    display: flex; flex-direction: column; align-items: center; gap: 24px;
  }
  .proposal-viewer-root .proposal { --proposal-accent: ${accent}; width: 100%; max-width: 1240px; display:flex; flex-direction:column; gap:24px; }
  .proposal-viewer-root .proposal-page {
    width: 100%; aspect-ratio: 1.4142/1; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15);
  }
  .pv-topbar {
    position: sticky; top: 0; background: #fff; padding: 14px 24px;
    border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;
    z-index: 10;
  }
  .pv-topbar h1 { font-size: 16px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
  .pv-topbar .actions { display: flex; gap: 8px; }
  .pv-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid #d1d1d1; background: #fff; cursor: pointer; font-size: 13px; font-weight: 500; }
  .pv-btn.primary { background: ${accent}; color: #fff; border-color: ${accent}; }
  @media print {
    .pv-topbar { display:none; }
    .proposal-viewer-root { padding: 0; }
    .proposal-viewer-root .proposal-page { box-shadow:none; break-after:page; page-break-after:always; }
    @page { size: A4 landscape; margin: 0; }
  }
</style>
</head><body>
<div class="pv-topbar">
  <h1>${title.replace(/</g, "&lt;")}</h1>
  <div class="actions">
    <button class="pv-btn" onclick="window.print()">🖨 인쇄 / PDF</button>
    <button class="pv-btn" onclick="window.close()">닫기</button>
  </div>
</div>
<div class="proposal-viewer-root">${bodyHtml}</div>
</body></html>`);
  w.document.close();
}

function findProposalEnd(s) {
  // s 는 <div class="proposal"... 로 시작하는 문자열.
  // AI가 outer div 를 중간에 잘못 닫고 이후에도 제안서 HTML(page/figure/table 등)을
  // 계속 출력하는 경우가 있어 단순 depth matching 은 신뢰할 수 없다.
  // → 전략: s 안에서 제안서성 HTML 태그가 등장하는 한 계속 포함하고,
  //   마지막 </div> 뒤 "순수 산문"이 나타나면 거기서 컷.
  // 먼저 문자열 끝까지 가장 마지막 </div> 위치를 찾는다.
  const allCloses = [...s.matchAll(/<\/div>/gi)];
  if (!allCloses.length) return -1;
  const lastClose = allCloses[allCloses.length - 1];
  const lastCloseEnd = lastClose.index + "</div>".length;

  // 그 뒤에 의미 있는 HTML 태그(제안서 블록류)가 더 있으면 그것도 포함
  const after = s.slice(lastCloseEnd);
  const moreHtml = /<(div|section|table|figure|svg|ul|ol|h\d)\b/i.exec(after);
  if (moreHtml) {
    // 뒤쪽에도 제안서 요소가 있음 → 문자열 끝까지 전부 proposal 로 포함
    return s.length;
  }
  // 마지막 </div> 이후가 짧은 산문(설명/마침문구)이면 잘라내고 post 로 분리
  if (after.trim().length > 0 && after.trim().length < 400) {
    return lastCloseEnd;
  }
  // 그 외엔 문자열 끝까지 전부 proposal 취급 (안전)
  return s.length;
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

function openProposalFullscreen(propEl) {
  const backdrop = h("div", {
    class: "modal-backdrop proposal-viewer-backdrop",
    onclick: (e) => { if (e.target === backdrop) backdrop.remove(); },
  });
  const modal = h("div", { class: "proposal-viewer" });

  // 상단 고정 툴바
  const pages = propEl.querySelectorAll(".proposal-page");
  const total = pages.length;
  modal.appendChild(h("div", { class: "proposal-viewer-topbar" }, [
    h("div", { class: "pv-title" }, propEl.getAttribute("data-title") || "제안서 미리보기"),
    h("div", { class: "pv-meta" }, [
      h("span", {}, `총 ${total} 페이지`),
      h("button", { class: "btn btn-outline", html: `${iconHtml("printer", 14)}<span>인쇄 / PDF</span>`,
        onclick: () => printProposal(propEl) }),
      h("button", {
        class: "pv-close-btn",
        title: "닫기 (ESC)",
        "aria-label": "닫기",
        onclick: () => backdrop.remove(),
        html: iconHtml("x", 22),
      }),
    ]),
  ]));

  // 본문 — 세로 스크롤로 모든 페이지 표시
  const scrollArea = h("div", { class: "proposal-viewer-scroll" });
  const clone = propEl.cloneNode(true);
  clone.querySelectorAll(".keyword-row").forEach((e) => e.remove());
  // 각 페이지에 번호 표시
  clone.querySelectorAll(".proposal-page").forEach((p, i) => {
    const num = h("div", { class: "pv-page-num" }, `${i + 1} / ${total}`);
    p.appendChild(num);
  });
  scrollArea.appendChild(clone);
  modal.appendChild(scrollArea);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // ESC 로 닫기
  const onKey = (e) => { if (e.key === "Escape") { backdrop.remove(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
}

// ---------- Settings modal ----------
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

// ---------- 체류시간 인체 캐릭터 ----------
// 단계: [분 임계값, 알림 zone, 메시지, 색 단계]
//   alert/warn 은 body-zone 클래스에 .alert / .warn 적용
//   pulse-* 클래스는 SVG 전체 호흡 속도
const BODY_STAGES = [
  { upTo: 30,    pulse: "pulse-slow", warn: [],          alert: [],          face: "happy",   msg: "오늘도 화이팅! 💪 일찍 끝내봐요" },
  { upTo: 120,   pulse: "pulse-mid",  warn: ["torso", "head", "arm-l", "arm-r", "leg-l", "leg-r", "waist", "neck"], alert: [], face: "happy", msg: "잘 하고 있어요 😊 6시에 만나요" },
  { upTo: 240,   pulse: "pulse-mid",  warn: ["torso", "head", "arm-l", "arm-r", "leg-l", "leg-r", "waist", "neck"], alert: ["wrist"], face: "tired", msg: "손목 좀 쉬어줘요 🤸 스트레칭 한 번!" },
  { upTo: 360,   pulse: "pulse-mid",  warn: ["torso", "head", "arm-l", "arm-r", "leg-l", "leg-r", "waist"],          alert: ["neck", "wrist"], face: "tired", msg: "목 돌리고 물 한 잔 어때요? 💧" },
  { upTo: 480,   pulse: "pulse-mid",  warn: ["torso", "head", "arm-l", "arm-r", "leg-l", "leg-r"],                   alert: ["waist", "neck", "wrist"], face: "tired", msg: "이만하면 충분! 일어나서 걸어요 🚶" },
  { upTo: Infinity, pulse: "pulse-mid", warn: [], alert: ["head","torso","waist","neck","wrist","arm-l","arm-r","leg-l","leg-r","feet"], face: "exhausted", msg: "이만 들어가요 🏡 내일 또 봐요!" },
];

const BODY_FACES = {
  happy:     { eyeL: "M 41 30 q 2 -1.5 4 0", eyeR: "M 55 30 q 2 -1.5 4 0", mouth: "M 45 38 q 5 4 10 0" },
  tired:     { eyeL: "M 41 30 l 4 0",         eyeR: "M 55 30 l 4 0",         mouth: "M 45 39 q 5 -2 10 0" },
  exhausted: { eyeL: "M 40 30 l 6 2 m 0 -2 l -6 2", eyeR: "M 54 30 l 6 2 m 0 -2 l -6 2", mouth: "M 45 40 q 5 -3 10 0" },
};

let _bodyStartedAt = null;
let _bodyTypingTimer = null;
let _bodyLastStageIdx = -1;

function ensureBodyClock() {
  // localStorage 에 세션 시작 시각 저장 (브라우저 세션 단위)
  let t = sessionStorage.getItem("nightoff.bodyStartedAt");
  if (!t) {
    t = String(Date.now());
    sessionStorage.setItem("nightoff.bodyStartedAt", t);
  }
  _bodyStartedAt = parseInt(t, 10);
}

function pickBodyStage(elapsedMin) {
  for (let i = 0; i < BODY_STAGES.length; i++) {
    if (elapsedMin <= BODY_STAGES[i].upTo) return i;
  }
  return BODY_STAGES.length - 1;
}

function applyBodyStage(stageIdx) {
  const svg = document.getElementById("rp-body-svg");
  const msgEl = document.getElementById("rp-body-msg");
  if (!svg || !msgEl) return;
  const stage = BODY_STAGES[stageIdx];
  // pulse 클래스 토글
  svg.classList.remove("pulse-slow", "pulse-mid");
  svg.classList.add(stage.pulse);
  // 모든 zone 초기화
  svg.querySelectorAll(".body-zone").forEach((g) => {
    g.classList.remove("warn", "alert", "alert-blink");
  });
  stage.warn.forEach((zone) => {
    svg.querySelectorAll(`.zone-${zone}`).forEach((g) => g.classList.add("warn"));
  });
  stage.alert.forEach((zone) => {
    svg.querySelectorAll(`.zone-${zone}`).forEach((g) => {
      g.classList.add("alert", "alert-blink");
    });
  });
  // 표정 변경
  const face = BODY_FACES[stage.face] || BODY_FACES.happy;
  const eyeL = document.getElementById("rp-eye-l");
  const eyeR = document.getElementById("rp-eye-r");
  const mouth = document.getElementById("rp-mouth");
  if (eyeL) eyeL.setAttribute("d", face.eyeL);
  if (eyeR) eyeR.setAttribute("d", face.eyeR);
  if (mouth) mouth.setAttribute("d", face.mouth);
  // 메시지 타이핑 효과 — 단계 변할 때만 재타이핑
  if (stageIdx !== _bodyLastStageIdx) {
    _bodyLastStageIdx = stageIdx;
    typeBodyMessage(msgEl, stage.msg);
  }
}

function typeBodyMessage(el, msg) {
  if (_bodyTypingTimer) clearInterval(_bodyTypingTimer);
  el.textContent = "";
  let i = 0;
  _bodyTypingTimer = setInterval(() => {
    if (i >= msg.length) {
      clearInterval(_bodyTypingTimer);
      _bodyTypingTimer = null;
      el.textContent = msg;   // 커서 없이 깔끔하게 마무리
      return;
    }
    i++;
    el.textContent = msg.slice(0, i);
  }, 35);
}

function tickBody() {
  if (!_bodyStartedAt) return;
  const elapsedMs = Date.now() - _bodyStartedAt;
  const elapsedMin = elapsedMs / 60000;
  const stageIdx = pickBodyStage(elapsedMin);
  applyBodyStage(stageIdx);
  // 시간 표시
  const timeEl = document.getElementById("rp-body-time");
  if (timeEl) {
    const h = Math.floor(elapsedMin / 60);
    const m = Math.floor(elapsedMin % 60);
    timeEl.textContent = h > 0 ? `${h}시간 ${m}분 째 작업 중` : `${m}분 째 작업 중`;
  }
}

function bootBodyCharacter() {
  ensureBodyClock();
  tickBody();
  // 30초마다 갱신
  setInterval(tickBody, 30 * 1000);
}

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
  // ── 묶음 N Commit 5 — 인증 게이트 ──
  // login/register 페이지는 토큰 검증 X (공개 페이지)
  if (!AUTH_PUBLIC_PAGES.has(location.pathname)) {
    if (!getToken()) {
      redirectToLogin();
      return;
    }
    // 토큰 검증 — /api/auth/me 호출
    try {
      const me = await api.get("/api/auth/me");
      window.__nightoff_user = me.user;  // 다른 곳에서 활용 가능
    } catch (e) {
      // /api/auth/me 의 401 은 _call() 안 redirect 분기에서 path.startsWith("/api/auth/")
      // 가드로 skip 됨 — 여기서 명시적으로 token clear + redirect.
      // (이전엔 silent return 이었어서 stale token 유지 -> dashboard 깜빡 -> 다른 endpoint
      //  401 -> redirect 의 마찰 흐름이 발생)
      if (e && e.status === 401) {
        clearToken();
        redirectToLogin();
        return;
      }
    }
  }
  // (legacy ensureSignup 모달 — 묶음 N 인증 시스템 전환 후 폐기됨.
  //  가입 흐름은 랜딩 CTA "지금 시작하기 ✨" -> /register.html 으로 이동.)
  // 체류시간 인체 캐릭터 시작
  bootBodyCharacter();
  // 반응형 햄버거 토글
  bootNavToggle();
});

route();
