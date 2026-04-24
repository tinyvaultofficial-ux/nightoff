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

async function _call(method, path, { body, form, signal, timeoutMs = 60000 } = {}) {
  const ctrl = new AbortController();
  const signals = [ctrl.signal];
  if (signal) signals.push(signal);
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  try {
    const init = { method, signal: ctrl.signal };
    if (form) {
      init.body = form;
    } else if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = body ? JSON.stringify(body) : null;
    }
    const r = await fetch(path, init);
    if (!r.ok) {
      const msg = await _parseErrorResponse(r);
      const err = new Error(msg);
      err.status = r.status;
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
function toast(msg, kind = "") {
  const el = h("div", { class: `toast ${kind}` }, msg);
  $("#toast-root").appendChild(el);
  setTimeout(() => el.remove(), 2800);
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

// 풀스크린 로딩 오버레이 — 딤처리 + 인터랙션 차단 + 스피너 + 실무/위트 교대 표시 (한 슬롯)
function showFullscreenLoader(steps) {
  document.querySelectorAll(".fs-loader-backdrop").forEach((el) => el.remove());

  const safeSteps = (steps && steps.length) ? steps : [{ emoji: "✨", text: "잠시만요…" }];
  const backdrop = h("div", { class: "fs-loader-backdrop" });
  const messageEl = h("div", { class: "fs-message-text" }, `${safeSteps[0].emoji} ${safeSteps[0].text}`);
  const content = h("div", { class: "fs-loader-content" }, [
    h("div", { class: "fs-spinner" }),
    messageEl,
  ]);
  backdrop.appendChild(content);
  backdrop.addEventListener("click", (e) => e.stopPropagation());
  backdrop.addEventListener("mousedown", (e) => e.preventDefault());
  document.body.appendChild(backdrop);
  document.body.classList.add("fs-loader-active");

  // 교대 시퀀스: 실무 1 → 위트 1 → 실무 2 → 위트 2 …
  let isWittyTurn = false;
  let stepIdx = 0;
  let wittyIdx = Math.floor(Math.random() * WITTY_LINES.length);

  const rotate = () => {
    messageEl.classList.add("fade-out");
    setTimeout(() => {
      if (isWittyTurn) {
        wittyIdx = (wittyIdx + 1) % WITTY_LINES.length;
        messageEl.textContent = WITTY_LINES[wittyIdx];
        messageEl.classList.add("is-witty");
      } else {
        stepIdx = (stepIdx + 1) % safeSteps.length;
        messageEl.textContent = `${safeSteps[stepIdx].emoji} ${safeSteps[stepIdx].text}`;
        messageEl.classList.remove("is-witty");
      }
      isWittyTurn = !isWittyTurn;
      messageEl.classList.remove("fade-out");
    }, 380);
  };
  const timer = setInterval(rotate, 2800);

  let closed = false;
  const handle = {
    setStep(emoji, text) {
      messageEl.classList.add("fade-out");
      setTimeout(() => {
        messageEl.textContent = `${emoji} ${text}`;
        messageEl.classList.remove("is-witty", "fade-out");
      }, 260);
    },
    finish(emoji = "✅", text = "완료!", delayMs = 700) {
      if (closed) return;
      clearInterval(timer);
      messageEl.classList.remove("fade-out", "is-witty");
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
      }, 260);
    },
  };
  return handle;
}

const LOADER_STEPS = {
  rfp: [
    { emoji: "📄", text: "RFP를 읽고 있어요…" },
    { emoji: "🔍", text: "요구사항을 분석하고 있어요…" },
    { emoji: "📊", text: "평가 기준을 파악하고 있어요…" },
    { emoji: "🗂️", text: "목차와 페이지 수를 정리하고 있어요…" },
  ],
  competitor: [
    { emoji: "🔎", text: "기업 정보를 검색하고 있어요…" },
    { emoji: "⚡", text: "강점과 약점을 분석하고 있어요…" },
    { emoji: "🎯", text: "차별화 포인트를 찾고 있어요…" },
  ],
  reference: [
    { emoji: "📂", text: "파일을 읽고 있어요…" },
    { emoji: "🧠", text: "내용을 분석하고 있어요…" },
    { emoji: "💡", text: "패턴을 추출하고 있어요…" },
  ],
  proposal: [
    { emoji: "📋", text: "RFP 요구사항을 확인하고 있어요…" },
    { emoji: "✍️", text: "목차와 구성을 잡고 있어요…" },
    { emoji: "🎨", text: "페이지 레이아웃을 설계하고 있어요…" },
    { emoji: "🚀", text: "제안서를 작성하고 있어요…" },
  ],
  search: [
    { emoji: "🌐", text: "웹에서 실제 정보를 찾고 있어요…" },
    { emoji: "🔗", text: "후보를 정리하고 있어요…" },
  ],
};

// ---------- Router ----------
const routes = [
  { re: /^\/$/, handler: renderDashboard },
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
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      r.handler(m);
      return;
    }
  }
  renderDashboard();
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
  let recent = [];
  try { recent = (await api.get("/api/clients")).slice(0, 6); } catch {}
  const side = h("aside", { class: "sidebar" }, [
    h("div", { class: "sidebar-logo", role: "button", tabindex: "0", title: "메인으로", onclick: () => navigate("/"), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/"); } } }, [
      h("img", { class: "sidebar-logo-img", src: "/static/logo.png", alt: "NightOff" }),
    ]),
    h("nav", { class: "sidebar-nav" }, [
      h("button", {
        class: "sidebar-item" + (active === "clients" ? " active" : ""),
        onclick: () => navigate("/"),
        html: `${iconHtml("users")}<span>발주처 목록</span>`,
      }),
      h("div", { class: "sidebar-section-title" }, "최근 발주처"),
      ...recent.map((c) => {
        const initial = (c.name || "?").trim().slice(0, 1);
        return h("button", {
          class: "sidebar-recent-item",
          onclick: () => navigate(`/client/${c.id}`),
          html: `<span class="avatar">${escapeHtml(initial)}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.name)}</span>`,
        });
      }),
      recent.length === 0
        ? h("div", { class: "muted small", style: "padding: 8px 12px;" }, "등록된 발주처가 없습니다")
        : null,
    ]),
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

// ---------- Dashboard ----------
function renderSmartLearningBanner(dna, stats) {
  const stored = localStorage.getItem("nightoff.smartBannerOpen");
  // 기본: 접힘. 사용자가 한 번 열었던 적이 있다면 그 상태 유지.
  let expanded = stored === "1";

  const banner = h("section", { class: "smart-banner" + (expanded ? " expanded" : " collapsed") });

  const toggleBtn = h("button", {
    class: "smart-toggle", "aria-label": "소개 열기/닫기",
    html: iconHtml(expanded ? "chevronD" : "chevronR", 18),
  });
  const header = h("div", { class: "smart-header clickable", onclick: () => {
    expanded = !expanded;
    banner.classList.toggle("expanded", expanded);
    banner.classList.toggle("collapsed", !expanded);
    toggleBtn.innerHTML = iconHtml(expanded ? "chevronD" : "chevronR", 18);
    localStorage.setItem("nightoff.smartBannerOpen", expanded ? "1" : "0");
  } }, [
    h("span", { class: "sm-emoji" }, "✨"),
    h("div", { style: "flex: 1;" }, [
      h("h2", {}, "NightOff은 쓸수록 똑똑해져요"),
      h("p", {}, "RFP와 대화·과거 제안서·승패 기록이 쌓일수록 더 정확한 제안서가 나옵니다"),
    ]),
    toggleBtn,
  ]);
  banner.appendChild(header);
  const feats = [
    {
      icon: "brain",
      title: "발주처 성향",
      desc: "RFP와 대화마다 발주처 선호 키워드, 높은 배점 항목을 자동 축적해요.",
    },
    {
      icon: "folder",
      title: "우리 회사 DNA",
      desc: dna.exists
        ? `레퍼런스 ${dna.ref_count}건에서 회사 고유 스타일·전략을 학습 중이에요.`
        : "과거 제안서를 올릴수록 회사 문체·강점·전략 패턴을 학습해요.",
    },
    {
      icon: "trending",
      title: "승패 학습",
      desc: (stats.wins || stats.losses)
        ? `${stats.wins}승 ${stats.losses}패 기록 — 승률 ${stats.win_rate ?? "—"}% 로 전략에 반영 중`
        : "수주/탈락 결과를 기록하면 승률 높은 전략을 우선 반영해요.",
    },
  ];
  const grid = h("div", { class: "smart-grid" });
  feats.forEach((f) => {
    grid.appendChild(h("div", { class: "smart-feat" }, [
      h("div", { class: "sm-feat-icon", html: iconHtml(f.icon, 18) }),
      h("div", {}, [
        h("h4", {}, f.title),
        h("p", {}, f.desc),
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
        h("p", { class: "ob-title" }, "과거 제안서를 올려두면 회사 스타일을 학습해요"),
        h("p", { class: "ob-desc" }, "발주처 상세의 ‘레퍼런스 라이브러리’에 이전 제안서·회사 소개서·성공 사례를 업로드하면, NightOff이 자주 쓰는 표현·강점 키워드·전략 구조를 추출합니다. 올리면 올릴수록 새 제안서가 우리 회사답게 나와요."),
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
  root.innerHTML = "";
  root.appendChild(await renderSidebar("clients"));

  const main = h("main", { class: "main" });
  root.appendChild(main);

  const [stats, clients, activity, dna] = await Promise.all([
    api.get("/api/stats").catch(() => ({})),
    api.get("/api/clients").catch(() => []),
    api.get("/api/activity").catch(() => []),
    api.get("/api/company-dna").catch(() => ({ exists: false, ref_count: 0 })),
  ]);

  main.appendChild(h("header", { class: "main-header" }, [
    h("div", { class: "flex-row", style: "gap: 18px;" }, [
      h("img", { class: "header-logo", src: "/static/logo.png", alt: "NightOff", onclick: () => navigate("/") }),
      h("div", {}, [
        h("h1", {}, "대시보드"),
        h("p", {}, "기획자가 만든 기획자를 위한 제안서 AI"),
      ]),
    ]),
    h("button", {
      class: "btn btn-primary btn-lg",
      onclick: () => navigate("/client/new"),
      html: `${iconHtml("plus", 18)}<span>새 발주처</span>`,
    }),
  ]));

  const content = h("div", { class: "main-content" });
  main.appendChild(content);

  // ── 핵심 스탯 4개 (승률 포함)
  const winRateDisplay = stats.win_rate === null || stats.win_rate === undefined ? "—" : `${stats.win_rate}`;
  const winRateUnit = stats.win_rate === null || stats.win_rate === undefined ? "" : "%";
  const statItems = [
    { label: "등록된 발주처", value: stats.total_clients ?? 0, unit: "곳", icon: "users", tint: "var(--primary-soft)", fg: "var(--primary)" },
    { label: "작성한 제안서", value: stats.total_proposals ?? 0, unit: "건", icon: "file", tint: "var(--success-soft)", fg: "var(--success)" },
    { label: "이번 달 활동", value: stats.month_activity ?? 0, unit: "회", icon: "activity", tint: "var(--warning-soft)", fg: "var(--warning)" },
    { label: `수주율 (${stats.wins ?? 0}승 ${stats.losses ?? 0}패)`, value: winRateDisplay, unit: winRateUnit, icon: "trending", tint: "var(--accent)", fg: "var(--accent-fg)" },
  ];
  const statsGrid = h("div", { class: "stats-grid stats-grid-4" });
  statItems.forEach((s) => {
    statsGrid.appendChild(h("div", { class: "card stat-card" }, [
      h("div", { class: "flex-between", style: "align-items: flex-start;" }, [
        h("div", {}, [
          h("p", { class: "stat-label" }, s.label),
          h("p", { class: "stat-value", style: "margin: 0;" }, [
            document.createTextNode(String(s.value)),
            h("span", { class: "stat-unit" }, s.unit),
          ]),
        ]),
        h("div", { class: "stat-icon-wrap", style: `background: ${s.tint}; color: ${s.fg};`, html: iconHtml(s.icon, 22) }),
      ]),
    ]));
  });
  content.appendChild(h("section", { style: "margin-bottom: 28px;" }, statsGrid));

  // ── 빠른 시작 CTA
  content.appendChild(h("section", { class: "quick-start", style: "margin-bottom: 28px;" }, [
    h("div", { class: "quick-card", onclick: () => navigate("/client/new") }, [
      h("div", { class: "quick-icon", html: iconHtml("plus", 22) }),
      h("div", {}, [
        h("h4", {}, "새 발주처 등록"),
        h("p", {}, "발주처 정보를 입력하고 대화를 시작하세요"),
      ]),
    ]),
    h("div", { class: "quick-card", onclick: async () => {
      if (!clients.length) { toast("먼저 발주처를 등록해 주세요", "error"); navigate("/client/new"); return; }
      // 가장 최근 발주처로 이동하면서 RFP 섹션까지 스크롤 유도는 단순히 detail로
      navigate(`/client/${clients[0].id}`);
    } }, [
      h("div", { class: "quick-icon", html: iconHtml("fileSearch", 22) }),
      h("div", {}, [
        h("h4", {}, "RFP 바로 분석"),
        h("p", {}, "최근 발주처로 이동해 문서를 업로드하세요"),
      ]),
    ]),
    h("div", { class: "quick-card", onclick: () => openCompanyDnaModal() }, [
      h("div", { class: "quick-icon", html: iconHtml("brain", 22) }),
      h("div", {}, [
        h("h4", {}, "우리 회사 DNA"),
        h("p", {}, dna.exists ? `레퍼런스 ${dna.ref_count}건 학습 중` : "과거 제안서 올리면 회사 스타일 학습"),
      ]),
    ]),
  ]));

  // ── 2열 레이아웃: 발주처 목록 + 최근 활동
  const twoCol = h("div", { class: "dashboard-two-col" });
  content.appendChild(twoCol);

  // 발주처 목록
  const leftCol = h("section");
  leftCol.appendChild(h("div", { class: "flex-between", style: "margin-bottom: 14px;" }, [
    h("h2", { style: "margin: 0; font-size: 18px; font-weight: 600;" }, "발주처 목록"),
    h("span", { class: "small muted" }, `총 ${clients.length}곳`),
  ]));
  if (clients.length === 0) {
    leftCol.appendChild(h("div", { class: "card empty-state" }, [
      h("p", {}, "등록된 발주처가 없습니다."),
      h("div", { style: "margin-top: 12px;" }, [
        h("button", { class: "btn btn-primary", onclick: () => navigate("/client/new") }, "첫 발주처 추가"),
      ]),
    ]));
  } else {
    const grid = h("div", { class: "client-grid client-grid-2" });
    clients.forEach((c) => grid.appendChild(clientCard(c)));
    leftCol.appendChild(grid);
  }
  twoCol.appendChild(leftCol);

  // 최근 활동
  const rightCol = h("aside", { class: "activity-feed" });
  rightCol.appendChild(h("div", { class: "flex-between", style: "margin-bottom: 14px;" }, [
    h("h2", { style: "margin: 0; font-size: 18px; font-weight: 600;" }, "최근 활동"),
  ]));
  if (!activity.length) {
    rightCol.appendChild(h("div", { class: "card empty-state", style: "font-size: 13px;" }, "활동이 아직 없습니다."));
  } else {
    const feed = h("div", { class: "card", style: "padding: 10px 6px;" });
    activity.forEach((ev) => {
      feed.appendChild(h("div", {
        class: "activity-item",
        onclick: () => {
          if (ev.conv_id && ev.client_id) navigate(`/client/${ev.client_id}/chat/${ev.conv_id}`);
          else if (ev.client_id) navigate(`/client/${ev.client_id}`);
        },
      }, [
        h("div", { class: "activity-icon", html: iconHtml(ev.icon || "activity", 16) }),
        h("div", { class: "activity-body" }, [
          h("div", { class: "activity-title" }, ev.title),
          h("div", { class: "activity-time" }, relativeTime(ev.at)),
        ]),
      ]));
    });
    rightCol.appendChild(feed);
  }
  twoCol.appendChild(rightCol);

  // ── NightOff 소개 배너 (하단, 기본 접힌 상태) ──
  content.appendChild(renderSmartLearningBanner(dna, stats));

  // ── 푸터
  content.appendChild(h("footer", { class: "dashboard-footer" },
    "NightOff · 기획자가 만든 기획자를 위한 제안서 AI · ver 0.1"
  ));
}

function clientCard(c) {
  const initials = (c.name || "?").trim().slice(0, 1);
  const badges = [];
  if (c.has_rfp > 0) badges.push({ cls: "badge-primary", label: "RFP" });
  if (c.memory_count > 0) badges.push({ cls: "badge-success", label: `대화기억 ${c.memory_count}` });
  if (c.conv_count > 0) badges.push({ cls: "badge-muted", label: `제안서 ${c.conv_count}` });

  return h("div", {
    class: "card client-card",
    onclick: () => navigate(`/client/${c.id}`),
  }, [
    h("div", { class: "flex-row" }, [
      h("div", { class: "client-logo" }, initials),
      h("div", {}, [
        h("h3", {}, c.name),
        h("p", { class: "client-sub" }, c.industry || "업종 미지정"),
      ]),
    ]),
    badges.length
      ? h("div", { class: "flex-row", style: "flex-wrap: wrap; margin-top: 14px; gap: 6px;" },
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
  "IT/플랫폼", "IT서비스", "금융/보험", "제조업", "유통/소매",
  "의료/헬스케어", "교육", "건설/부동산", "미디어/엔터테인먼트",
  "물류/운송", "에너지/환경", "공공기관", "전자/반도체", "자동차/모빌리티", "이커머스", "기타",
];

async function renderClientForm(mode, id = null) {
  const root = $("#app-root");
  root.innerHTML = "";
  root.appendChild(await renderSidebar());
  const main = h("main", { class: "main" });
  root.appendChild(main);
  main.appendChild(h("header", { class: "main-header" }, [
    h("div", {}, [
      h("h1", {}, mode === "create" ? "새 발주처 추가" : "발주처 수정"),
      h("p", {}, "발주처 기본 정보를 입력하세요"),
    ]),
  ]));

  let data = { name: "", industry: "", manager: "", memo: "" };
  if (mode === "edit" && id) {
    try { data = await api.get(`/api/clients/${id}`); } catch (e) { toast("발주처를 불러올 수 없습니다", "error"); return; }
  }

  const form = h("form", {}, [
    h("div", { class: "card", style: "padding: 28px; max-width: 720px;" }, [
      h("div", { class: "row-gap-18" }, [
        h("div", { class: "field" }, [
          h("label", {}, [document.createTextNode("발주처명 "), h("span", { style: "color: var(--danger);" }, "*")]),
          h("input", { class: "input", id: "fld-name", value: data.name, placeholder: "예: 삼성전자" }),
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
            if (!body.name) { toast("발주처명을 입력하세요", "error"); return; }
            if (!body.industry) { toast("업종을 선택하세요", "error"); return; }
            try {
              if (mode === "create") {
                const r = await api.post("/api/clients", body);
                toast("발주처가 추가되었습니다", "success");
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

  const client = await api.get(`/api/clients/${cid}`).catch(() => null);
  if (!client) { toast("발주처를 찾을 수 없습니다", "error"); navigate("/"); return; }

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
    icon("arrowL", 14), document.createTextNode("발주처 목록으로"),
  ]));

  const stack = h("div", { class: "row-gap-18" });
  content.appendChild(stack);

  // Order: History → Profile → RFP → References → Competitors
  stack.appendChild(await renderConvHistorySection(cid));
  stack.appendChild(await renderProfileSection(cid));
  stack.appendChild(await renderRfpSection(cid));
  stack.appendChild(await renderReferenceSection(cid));
  stack.appendChild(await renderCompetitorSection(cid));
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

  // 큰 "새 대화 시작" CTA — 섹션 상단 중앙에 강조 배치
  const startNew = async () => {
    try {
      const r = await api.post(`/api/clients/${cid}/conversations`);
      navigate(`/client/${cid}/chat/${r.id}`);
    } catch (e) { toast(String(e.message || e), "error"); }
  };
  body.appendChild(h("button", {
    class: "btn btn-primary big-cta",
    onclick: startNew,
    html: `${iconHtml("plus", 22)}<span>새 대화 시작하기</span>`,
  }));

  if (!convs.length) {
    body.appendChild(h("div", { class: "empty-state", style: "margin-top: 14px;" }, "대화가 없습니다. 위 버튼으로 시작해보세요."));
    return card;
  }

  convs.forEach((cv) => {
    const item = h("div", { class: "conv-item" }, [
      h("div", { class: "conv-main", onclick: () => navigate(`/client/${cid}/chat/${cv.id}`) }, [
        h("h4", {}, cv.title),
        cv.preview ? h("p", { class: "conv-preview" }, cv.preview) : null,
        h("div", { class: "conv-meta" }, [
          h("span", { class: "flex-row", html: `${iconHtml("calendar", 12)}<span>${fmtDate(cv.created_at)}</span>` }),
          h("span", { class: "flex-row", html: `${iconHtml("msg", 12)}<span>${cv.msg_count || 0}개 메시지</span>` }),
          cv.ended ? h("span", { class: "badge badge-muted" }, "종료됨") : null,
          outcomeChip(cv, cid),
        ]),
      ]),
      h("div", { class: "conv-actions" }, [
        h("button", {
          class: "icon-btn", title: "삭제", html: iconHtml("trash", 16),
          onclick: async (e) => {
            e.stopPropagation();
            if (!confirm("이 대화를 삭제하시겠습니까?")) return;
            await api.del(`/api/conversations/${cv.id}`);
            toast("삭제되었습니다", "success");
            renderClientDetail(cid);
          },
        }),
      ]),
    ]);
    body.appendChild(item);
  });

  return card;
}

// ---------- Reference Library ----------
async function renderReferenceSection(cid) {
  const refs = await api.get(`/api/clients/${cid}/references`).catch(() => []);
  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: iconHtml("folder", 18) }),
      h("div", {}, [
        h("h3", { class: "card-title" }, "레퍼런스 라이브러리"),
        h("p", { class: "card-subtitle" }, "올려두면 AI가 알아서 참고해요"),
      ]),
    ]),
  ]));

  const body = h("div", { class: "card-body row-gap-14" });
  card.appendChild(body);

  // Drop area
  const input = h("input", { type: "file", style: "display: none;", multiple: "" });
  input.addEventListener("change", async () => {
    for (const f of input.files) await uploadRef(f);
    input.value = "";
  });
  body.appendChild(input);

  const drop = h("div", {
    class: "drop-area",
    onclick: () => input.click(),
  }, [
    h("div", { class: "drop-icon", html: iconHtml("upload", 22) }),
    h("p", { class: "drop-title" }, "파일을 드래그하거나 클릭하여 업로드"),
    h("p", { class: "drop-hint" }, "PDF, Word, TXT 지원 · AI가 자동 분석"),
  ]);
  ["dragenter","dragover"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragover"); }));
  ["dragleave","drop"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("dragover"); }));
  drop.addEventListener("drop", async (e) => {
    e.preventDefault();
    for (const f of e.dataTransfer.files) await uploadRef(f);
  });
  body.appendChild(drop);

  const list = h("div", { class: "row-gap-10" });
  body.appendChild(list);
  refs.forEach((f) => list.appendChild(refRow(f, cid)));
  if (!refs.length) list.appendChild(h("div", { class: "muted small", style: "padding: 4px 0;" }, "아직 업로드된 레퍼런스가 없습니다."));

  async function uploadRef(file) {
    const loader = showFullscreenLoader(LOADER_STEPS.reference);
    try {
      await api.upload(`/api/clients/${cid}/references`, file);
      loader.finish("✅", "저장 완료!", 600);
      setTimeout(() => renderClientDetail(cid), 700);
    } catch (e) {
      loader.stop();
      toast("업로드 실패: " + (e.message || e), "error");
    }
  }

  return card;
}

function refRow(f, cid) {
  return h("div", { class: "file-row" }, [
    h("div", { class: "left" }, [
      h("div", { class: "file-icon", html: iconHtml("file", 18) }),
      h("div", { style: "min-width: 0; flex: 1;" }, [
        h("p", { class: "file-name" }, f.filename),
        h("p", { class: "file-sub" }, `${f.filetype || "FILE"} · ${fmtSize(f.filesize)} · ${fmtDate(f.created_at)}`),
        f.summary ? h("p", { class: "file-sub", style: "margin-top: 6px; color: var(--fg-2);" }, f.summary) : null,
      ]),
    ]),
    h("button", {
      class: "icon-btn", title: "삭제", html: iconHtml("x", 16),
      onclick: async () => {
        if (!confirm("이 레퍼런스를 삭제하시겠습니까?")) return;
        await api.del(`/api/references/${f.id}`);
        toast("삭제되었습니다", "success");
        renderClientDetail(cid);
      },
    }),
  ]);
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

  const drop = h("div", { class: "drop-area", onclick: () => input.click() }, [
    h("div", { class: "drop-icon", html: iconHtml("upload", 22) }),
    h("p", { class: "drop-title" }, (rfp.files && rfp.files.length) ? "RFP 파일 추가 업로드" : "RFP 파일 업로드 (여러 개 가능)"),
    h("p", { class: "drop-hint" }, "PDF / Word / HWP 지원 — 드롭 또는 클릭, 여러 파일 선택 가능"),
  ]);
  ["dragenter","dragover"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragover"); }));
  ["dragleave","drop"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("dragover"); }));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) openRoleModal(Array.from(e.dataTransfer.files));
  });
  body.appendChild(drop);

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

    // Key info grid
    const infoGrid = h("div", { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-top: 16px;" });
    const infoItems = [
      { icon: "clock", label: "마감일", value: a.deadline || "미명시" },
      { icon: "trending", label: "예상 예산", value: a.budget || "미명시" },
      { icon: "file", label: "제안서 형식", value: (a.orientation === "portrait" ? "A4 세로" : "A4 가로") + (a.page_limit ? ` · ${a.page_limit}p` : "") },
      { icon: "building", label: "발주처 성격", value: a.client_type || "미분류" },
    ];
    infoItems.forEach((i) => {
      infoGrid.appendChild(h("div", { style: "display: flex; align-items: center; gap: 10px; padding: 12px; background: var(--bg-2); border-radius: 10px;" }, [
        h("div", { class: "card-title-icon", style: "width: 36px; height: 36px;", html: iconHtml(i.icon, 16) }),
        h("div", {}, [
          h("p", { class: "small muted", style: "margin: 0;" }, i.label),
          h("p", { style: "margin: 2px 0 0; font-weight: 600; font-size: 14px;" }, i.value),
        ]),
      ]));
    });
    result.appendChild(infoGrid);

    // Requirements — 체크리스트 형태
    if (a.key_requirements?.length) {
      result.appendChild(h("div", { style: "margin-top: 18px;" }, [
        h("p", { class: "small muted", style: "margin: 0 0 10px; font-weight: 500;" }, "주요 요구사항"),
        h("ul", { class: "check-list" },
          a.key_requirements.map((r) => h("li", {}, [
            h("span", { class: "check-icon", html: iconHtml("check", 14) }),
            h("span", {}, r),
          ]))),
      ]));
    }

    // Requirements — 체크리스트 형태
    // (앞선 key_requirements 블록을 보강: 배지 대신 체크 아이콘 리스트)
    // 평가기준 — 배점 높은 순 프로그레스바
    if (a.evaluation_criteria?.length) {
      const crit = [...a.evaluation_criteria]
        .map((ec) => {
          const m = String(ec.weight || "").match(/(\d+(?:\.\d+)?)/);
          return { ...ec, _w: m ? parseFloat(m[1]) : 0 };
        })
        .sort((x, y) => y._w - x._w);
      const maxW = Math.max(1, ...crit.map((c) => c._w));
      result.appendChild(h("div", { style: "margin-top: 18px;" }, [
        h("p", { class: "small muted", style: "margin: 0 0 10px; font-weight: 500;" }, "평가 기준 (배점 높은 순)"),
        ...crit.map((ec) => h("div", { class: "eval-bar-row" }, [
          h("div", { class: "eval-label" }, ec.item || ""),
          h("div", { class: "eval-bar" }, [h("span", { style: `width: ${(ec._w / maxW) * 100}%;` })]),
          h("div", { class: "eval-weight" }, ec.weight || "—"),
        ])),
      ]));
    }

    // Risk points — 빨간 경고 배지
    if (a.risk_points?.length) {
      result.appendChild(h("div", { style: "margin-top: 18px;" }, [
        h("p", { class: "small muted", style: "margin: 0 0 8px; font-weight: 500;" }, "리스크 / 주의사항"),
        h("div", { class: "risk-stack" },
          a.risk_points.map((p) => h("div", { class: "risk-alert" }, [
            h("span", { class: "risk-emoji" }, "⚠️"),
            h("span", {}, p),
          ]))),
      ]));
    }

    if (a.summary) {
      result.appendChild(h("div", { style: "margin-top: 18px; padding: 12px 14px; background: var(--primary-soft); border-radius: 10px; font-size: 14px; color: var(--primary);" }, a.summary));
    }
  }

  return card;
}

// ---------- Competitor Analysis ----------
async function renderCompetitorSection(cid) {
  const comps = await api.get(`/api/clients/${cid}/competitors`).catch(() => []);
  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: iconHtml("building", 18) }),
      h("div", {}, [
        h("h3", { class: "card-title" }, "경쟁사 분석"),
        h("p", { class: "card-subtitle" }, "기업명만 입력하면 AI가 강점·약점·차별화 포인트를 분석합니다"),
      ]),
    ]),
  ]));

  const body = h("div", { class: "card-body row-gap-14" });
  card.appendChild(body);

  // Input row — 2글자 이상 입력 시 자동으로 후보 드롭다운
  const inpWrap = h("div", { style: "position: relative;" });
  const inp = h("input", { class: "input", placeholder: "경쟁사 기업명 (2글자+) · 쉼표로 여러 개 가능 (예: LG CNS, SK C&C)", autocomplete: "off" });
  const ctx = { value: "" };  // 추가 컨텍스트 입력창 제거 — 빈 값으로 호환성 유지
  const dropdown = h("div", { class: "autocomplete-dropdown hidden" });
  inpWrap.appendChild(inp);
  inpWrap.appendChild(dropdown);

  const analysisArea = h("div");
  body.appendChild(inpWrap);
  body.appendChild(analysisArea);

  let debounceT = null;
  let currentQuery = "";
  let searchAborter = null;

  function closeDropdown() { dropdown.classList.add("hidden"); dropdown.innerHTML = ""; }
  function showLoadingDropdown() {
    dropdown.innerHTML = "";
    dropdown.appendChild(h("div", { class: "autocomplete-loading" }, [
      h("span", { class: "ac-spinner" }),
      h("span", {}, "후보를 찾고 있어요…"),
    ]));
    dropdown.classList.remove("hidden");
  }
  function showCandidatesDropdown(candidates) {
    dropdown.innerHTML = "";
    if (!candidates || !candidates.length) {
      dropdown.appendChild(h("div", { class: "autocomplete-empty" }, `후보를 찾지 못했어요. "${inp.value.trim()}" 그대로 분석하려면 아래 버튼을 눌러주세요.`));
    } else {
      candidates.slice(0, 5).forEach((c) => {
        dropdown.appendChild(h("div", {
          class: "autocomplete-item",
          onclick: () => { closeDropdown(); runAnalysis(c.name, ctx.value.trim()); },
        }, [
          h("div", { class: "ac-name" }, c.name),
          c.desc ? h("div", { class: "ac-desc" }, c.desc + (c.domain ? ` · ${c.domain}` : "")) : null,
        ]));
      });
    }
    const q = inp.value.trim();
    if (q) {
      dropdown.appendChild(h("div", {
        class: "autocomplete-item ac-direct",
        onclick: () => { closeDropdown(); runAnalysis(q, ctx.value.trim()); },
      }, [
        h("div", { class: "ac-name" }, `"${q}" 그대로 분석`),
        h("div", { class: "ac-desc" }, "후보에 원하는 기업이 없으면 입력한 이름 그대로 진행"),
      ]));
    }
    dropdown.classList.remove("hidden");
  }

  async function fetchCandidates(q) {
    if (searchAborter) searchAborter.abort();
    searchAborter = new AbortController();
    showLoadingDropdown();
    // 15초·30초 경과 시 메시지 업데이트 (웹 검색은 시간이 걸려요)
    const hint1 = setTimeout(() => {
      const l = dropdown.querySelector(".autocomplete-loading span:last-child");
      if (l) l.textContent = "웹 검색이 진행 중이에요… (최대 1분)";
    }, 15000);
    const hint2 = setTimeout(() => {
      const l = dropdown.querySelector(".autocomplete-loading span:last-child");
      if (l) l.textContent = "거의 다 됐어요… 조금만 더 기다려주세요";
    }, 35000);
    try {
      const r = await api.post(
        `/api/clients/${cid}/competitors/search`,
        { query: q, context: ctx.value.trim() },
        { signal: searchAborter.signal, timeoutMs: 90000 }  // 90초로 증가 (web_search 툴 고려)
      );
      if (q !== currentQuery) return;
      showCandidatesDropdown(r.candidates || []);
    } catch (e) {
      if (e.name === "AbortError") return;
      dropdown.innerHTML = "";
      const msg = /timeout|지연/.test(String(e.message || ""))
        ? `웹 검색이 오래 걸려요. "${q}" 그대로 바로 분석하려면 아래 버튼을 눌러주세요.`
        : (e.message || "검색 중 문제가 생겼어요.");
      dropdown.appendChild(h("div", { class: "autocomplete-empty" }, msg));
      // 타임아웃/실패 시 "직접" 옵션 즉시 노출
      if (q) {
        dropdown.appendChild(h("div", {
          class: "autocomplete-item ac-direct",
          onclick: () => { closeDropdown(); runAnalysis(q, ctx.value.trim()); },
        }, [
          h("div", { class: "ac-name" }, `"${q}" 그대로 분석`),
          h("div", { class: "ac-desc" }, "입력한 이름 그대로 경쟁사 분석 진행"),
        ]));
      }
      dropdown.classList.remove("hidden");
    } finally {
      clearTimeout(hint1);
      clearTimeout(hint2);
    }
  }

  inp.addEventListener("input", () => {
    const q = inp.value.trim();
    currentQuery = q;
    clearTimeout(debounceT);
    if (q.length < 2) { closeDropdown(); return; }
    debounceT = setTimeout(() => { if (q === currentQuery) fetchCandidates(q); }, 450);
  });
  inp.addEventListener("focus", () => {
    const q = inp.value.trim();
    if (q.length >= 2 && dropdown.innerHTML) dropdown.classList.remove("hidden");
  });
  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!inpWrap.contains(e.target)) closeDropdown();
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDropdown();
  });

  async function runAnalysis(name, context) {
    if (!name) return;
    const names = name.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;

    const loader = showFullscreenLoader(LOADER_STEPS.competitor);
    let success = 0;
    for (const [i, n] of names.entries()) {
      try {
        if (names.length > 1) {
          loader.setStep("🔎", `${i + 1}/${names.length} — ${n} 분석 중…`);
        }
        await api.post(`/api/clients/${cid}/competitors`, { name: n, context });
        success++;
      } catch (e) {
        toast(`${n} 분석 실패: ` + (e.message || e), "error");
      }
    }
    if (success > 0) {
      loader.finish("✅", names.length > 1 ? `${success}/${names.length}개 완료!` : "분석 완료!", 700);
      setTimeout(() => renderClientDetail(cid), 900);
    } else {
      loader.stop();
    }
  }

  if (!comps.length) {
    body.appendChild(h("div", { class: "muted small", style: "padding: 4px 0;" }, "등록된 경쟁사가 없습니다."));
    return card;
  }

  const grid = h("div", { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;" });
  body.appendChild(grid);
  comps.forEach((c) => grid.appendChild(compCard(c, cid)));
  return card;
}

function compCard(c, cid) {
  const col = (cls, title, items) => h("div", { class: `comp-col-card ${cls}` }, [
    h("h5", {}, title),
    items && items.length
      ? h("ul", {}, items.map((x) => h("li", {}, x)))
      : h("p", { class: "small muted", style: "margin: 0;" }, "—"),
  ]);
  return h("div", { class: "comp-card" }, [
    h("div", { class: "flex-between", style: "margin-bottom: 8px;" }, [
      h("h4", {}, c.name),
      h("button", {
        class: "icon-btn", title: "삭제", html: iconHtml("x", 14),
        onclick: async () => {
          if (!confirm(`${c.name} 분석을 삭제하시겠습니까?`)) return;
          await api.del(`/api/competitors/${c.id}`);
          toast("삭제되었습니다", "success");
          renderClientDetail(cid);
        },
      }),
    ]),
    c.analysis ? h("p", { class: "comp-summary" }, c.analysis) : null,
    // 3열 카드: 강점 / 약점 / 차별화
    h("div", { class: "comp-3col" }, [
      col("strengths", "강점", c.strengths),
      col("weaknesses", "약점", c.weaknesses),
      h("div", { class: "comp-col-card diff" }, [
        h("h5", {}, "차별화 (우리 승부수)"),
        c.differentiator ? h("p", {}, c.differentiator) : h("p", { class: "small muted", style: "margin:0;" }, "—"),
      ]),
    ]),
  ]);
}

// ---------- 발주처 성향 ----------
async function renderProfileSection(cid) {
  const p = await api.get(`/api/clients/${cid}/profile`).catch(() => ({ exists: false }));
  const card = h("div", { class: "card" });

  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", style: "background: var(--primary-soft); color: var(--primary);", html: iconHtml("brain", 18) }),
      h("div", {}, [
        h("h3", { class: "card-title" }, "발주처 성향"),
        h("p", { class: "card-subtitle" }, p.exists ? `${p.sample_count || 1}회 축적 · RFP와 대화에서 자동 학습` : "RFP를 넣고 대화할수록 NightOff이 이 발주처를 더 깊이 이해해요"),
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
        h("p", { class: "ob-desc" }, "RFP를 분석하고 대화를 나눌수록 이 발주처의 선호 키워드·높은 배점 항목·반복 요구사항을 자동으로 축적해요. 쌓인 프로파일은 모든 새 제안서에 자동으로 반영됩니다."),
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
        h("p", { class: "card-subtitle" }, `AI가 학습한 발주처 정보 ${mems.length}개 · 새 대화에 자동 주입됩니다`),
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

  const data = await api.get(`/api/conversations/${convId}`).catch(() => null);
  if (!data) { toast("대화를 불러올 수 없습니다", "error"); navigate(`/client/${cid}`); return; }

  root.appendChild(await renderSidebar());

  const shell = h("main", { class: "chat-shell" });
  root.appendChild(shell);

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
        document.createTextNode("이 발주처의 대화 기억이 적용됐어요"),
      ]) : null,
      h("div", { class: "context-badges" }, [
        injected.rfp ? h("span", { class: "badge badge-primary" }, "RFP") : null,
        injected.refs ? h("span", { class: "badge badge-primary" }, "레퍼런스") : null,
      ]),
      // 포인트 컬러 피커
      h("label", {
        class: "accent-picker", title: "발주처 포인트 컬러",
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
      // 산출내역서 버튼
      h("button", {
        class: "btn btn-outline", html: `${iconHtml("file", 14)}<span>산출내역서</span>`,
        onclick: () => openBudgetModal(convId),
      }),
      h("button", {
        class: "btn btn-outline", html: `${iconHtml("save", 14)}<span>대화 마치기</span>`,
        onclick: async () => {
          if (!confirm("대화를 종료하고 기억을 저장하시겠습니까? AI가 대화에서 뉘앙스를 추출해 발주처에 저장합니다.")) return;
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

    aborter = new AbortController();
    let targetText = "";    // 서버에서 받아 누적한 실제 full text
    let displayedText = ""; // 화면에 출력된 길이
    let firstDelta = true;
    let rafActive = false;
    let streamDone = false;

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
      body.scrollTop = body.scrollHeight;
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
      ta.focus();
    }
  });

  shell.appendChild(h("div", { class: "chat-input-wrap" }, [
    h("div", { class: "chat-input-container" }, [ta, sendBtn, stopBtn]),
    h("p", { class: "chat-hint" }, "RFP 분석 · 레퍼런스 · 대화 기억이 자동으로 컨텍스트에 포함됩니다"),
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

function renderAssistant(bubble, text, final = false) {
  bubble.dataset.raw = text;
  // Detect proposal block
  const idx = text.indexOf('<div class="proposal"');
  if (idx === -1) {
    // 마크다운 렌더링 — 일반 채팅 응답
    bubble.innerHTML = renderMarkdown(text);
    return;
  }

  // Split: pre-text and proposal content
  const pre = text.slice(0, idx).trim();
  const rest = text.slice(idx);
  const endIdx = findProposalEnd(rest);
  let propHtml = endIdx > 0 ? rest.slice(0, endIdx) : rest;
  const post = endIdx > 0 ? rest.slice(endIdx).trim() : "";

  // ── 깜빡임 방지: 완성된 페이지 개수가 늘어났거나, final일 때만 DOM 재구축
  const completedPages = (propHtml.match(/<\/div>\s*(?=<div class="proposal-page"|<\/div>\s*$)/g) || []).length;
  const lastCount = parseInt(bubble.dataset.propPages || "-1", 10);
  const alreadyRendered = bubble.querySelector(".proposal-wrapper");
  if (alreadyRendered && !final && completedPages === lastCount) {
    return; // 스트림은 계속 쌓이지만 DOM은 그대로 — 깜빡임 제거
  }
  bubble.dataset.propPages = String(completedPages);

  // Sanitize and render proposal
  const wrapper = h("div", { class: "proposal-wrapper" });
  const safe = sanitizeProposalHtml(propHtml);
  wrapper.innerHTML = safe;

  const propEl = wrapper.querySelector(".proposal");
  if (propEl) {
    const title = propEl.getAttribute("data-title") || "제안서";
    const toolbar = h("div", { class: "proposal-toolbar" }, [
      h("div", { class: "title" }, title),
      h("div", { class: "actions" }, [
        h("button", {
          class: "btn btn-outline", html: `${iconHtml("printer", 14)}<span>인쇄 / PDF</span>`,
          onclick: () => printProposal(propEl),
        }),
        h("button", {
          class: "btn btn-outline", html: `${iconHtml("eye", 14)}<span>전체보기</span>`,
          onclick: () => openProposalFullscreen(propEl),
        }),
      ]),
    ]);

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

    // AI/스톡 이미지 플레이스홀더 자동 로드
    propEl.querySelectorAll("figure.ai-image").forEach(async (fig) => {
      if (fig.dataset.loaded === "1") return;
      fig.dataset.loaded = "1";
      const type = fig.dataset.type || "stock";
      const key = fig.dataset.prompt || fig.dataset.keyword || "";
      if (!key) return;
      try {
        const j = await api.get(`/api/images/search?kind=${encodeURIComponent(type)}&keyword=${encodeURIComponent(key)}`);
        if (j.url) {
          const img = document.createElement("img");
          img.src = j.url;
          img.alt = key;
          const ph = fig.querySelector(".ai-image-placeholder");
          if (ph) ph.replaceWith(img); else fig.insertBefore(img, fig.firstChild);
        }
      } catch (e) { /* 실패 시 플레이스홀더 그대로 */ }
    });

    propEl.parentElement.insertBefore(toolbar, propEl);
  }

  // 재구축 시 한 번만 innerHTML 교체 — repaint 최소화
  const newContent = document.createDocumentFragment();
  if (pre) newContent.appendChild(h("div", { style: "white-space: pre-wrap; margin-bottom: 10px;" }, pre));
  newContent.appendChild(wrapper);
  if (post) newContent.appendChild(h("div", { style: "white-space: pre-wrap; margin-top: 10px;" }, post));
  bubble.replaceChildren(newContent);
}

function findProposalEnd(s) {
  // Finds matching closing </div> for .proposal outer div by depth counting
  // Start from opening <div class="proposal"
  const openRe = /<div\b/gi;
  const closeRe = /<\/div>/gi;
  let depth = 0, i = 0;
  // Skip first opening tag
  const firstOpen = s.indexOf(">");
  if (firstOpen < 0) return -1;
  i = firstOpen + 1; depth = 1;
  while (i < s.length && depth > 0) {
    openRe.lastIndex = i; closeRe.lastIndex = i;
    const o = openRe.exec(s); const c = closeRe.exec(s);
    if (!c) return -1;
    if (o && o.index < c.index) { depth++; i = o.index + 1; }
    else { depth--; i = c.index + "</div>".length; if (depth === 0) return i; }
  }
  return -1;
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
  $("#api-key-input").value = "";
  $("#api-key-input").placeholder = s.has_key ? s.masked_key : "sk-ant-api03-...";
  $("#api-key-status").textContent = s.has_key ? `설정된 키: ${s.masked_key}` : "설정된 키 없음";
  $("#model-select").value = s.model || "claude-sonnet-4-5-20250929";
  const dx = $("#settings-diagnostic");
  if (dx) { dx.classList.add("hidden"); dx.classList.remove("ok", "err"); dx.innerHTML = ""; }
  modal.classList.remove("hidden");
}
function closeSettings() { $("#settings-modal").classList.add("hidden"); }

$("#settings-btn").addEventListener("click", openSettings);
$$("[data-close-modal]").forEach((el) => el.addEventListener("click", closeSettings));
$("#settings-modal").addEventListener("click", (e) => {
  if (e.target.id === "settings-modal") closeSettings();
});
$("#save-settings").addEventListener("click", async () => {
  const body = {};
  const k = $("#api-key-input").value.trim();
  if (k) body.api_key = k;
  body.model = $("#model-select").value;
  try {
    await api.post("/api/settings", body);
    toast("설정이 저장되었습니다", "success");
    closeSettings();
  } catch (e) { toast(String(e.message || e), "error"); }
});

$("#test-key").addEventListener("click", async () => {
  // 저장 안 된 새 키가 입력창에 있다면 먼저 저장
  const newKey = $("#api-key-input").value.trim();
  const box = $("#settings-diagnostic");
  const btn = $("#test-key");
  btn.disabled = true; btn.textContent = "테스트 중…";
  box.classList.remove("hidden", "ok", "err");
  box.textContent = "API 연결 확인 중…";
  try {
    if (newKey) {
      await api.post("/api/settings", { api_key: newKey, model: $("#model-select").value });
    } else if ($("#model-select").value) {
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

// ---------- 이메일 간편 가입 (랜딩 CTA → 모달) ----------
function ensureSignup(onDone) {
  const cached = localStorage.getItem("nightoff.email");
  if (cached) { if (onDone) onDone(cached); return; }

  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal", style: "max-width: 440px;" });
  modal.appendChild(h("div", { class: "modal-header" }, [h("h3", {}, "시작하기")]));
  const emailIn = h("input", { class: "input", type: "email", placeholder: "이메일", autocomplete: "email" });
  const compIn = h("input", { class: "input", type: "text", placeholder: "회사명 (선택)" });
  modal.appendChild(h("div", { class: "modal-body" }, [
    h("p", { class: "small muted", style: "margin: 0 0 10px;" }, "비밀번호 없이 이메일만으로 시작할 수 있어요. 같은 이메일로 재방문 시 자동 로그인됩니다."),
    h("div", { class: "field" }, [h("label", {}, "이메일"), emailIn]),
    h("div", { class: "field" }, [h("label", {}, "회사명"), compIn]),
  ]));
  modal.appendChild(h("div", { class: "modal-footer" }, [
    h("button", {
      class: "btn btn-primary",
      onclick: async () => {
        const email = emailIn.value.trim();
        const company = compIn.value.trim();
        if (!email || !email.includes("@")) { toast("이메일을 확인해 주세요", "error"); return; }
        try {
          const r = await api.post("/api/signup", { email, company });
          localStorage.setItem("nightoff.email", r.email);
          localStorage.setItem("nightoff.company", company);
          backdrop.remove();
          toast(r.returning ? "다시 오신 것을 환영합니다!" : "시작해요!", "success");
          if (onDone) onDone(r.email);
        } catch (err) { toast(err.message || "가입 실패", "error"); }
      },
    }, "시작하기"),
  ]));
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  setTimeout(() => emailIn.focus(), 100);
}

// ---------- Boot ----------
// 최초 방문 체크
window.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("nightoff.email")) {
    // 비동기 — 페이지 렌더 후 모달
    setTimeout(() => ensureSignup(), 400);
  }
});

route();
