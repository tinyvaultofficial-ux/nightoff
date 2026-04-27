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
      h("h2", {}, "NightOff 의 핵심 기능 3가지"),
      h("p", {}, "RFP 업로드부터 제안서 생성까지 하나의 흐름으로 이어집니다"),
    ]),
    toggleBtn,
  ]);
  banner.appendChild(header);
  const feats = [
    {
      icon: "eye",
      title: "👀 발주처 들여다보기",
      desc: "RFP를 넣으면 발주처 정보와 과업 내용을 자동으로 파악해요",
    },
    {
      icon: "trending",
      title: "💪 우리 회사의 강점은?",
      desc: "잘하는 분야를 선택하면 제안서에 자동 반영돼요",
    },
    {
      icon: "activity",
      title: "📊 입찰 활동 히스토리",
      desc: "수주/탈락 결과를 기록하면 나의 입찰 활동을 한눈에 볼 수 있어요",
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
        h("p", { class: "ob-title" }, "발주처별로 강점을 골라두면 제안서에 자동 반영돼요"),
        h("p", { class: "ob-desc" }, "발주처 상세의 ‘우리 회사의 강점은? 💪’ 카드에서 과업에 어울리는 분야와 세부 역량을 선택하면, 제안서 생성 시 자동으로 녹여냅니다."),
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
        h("p", {}, "제안서 수주 도우미 · 함께 만들어요 ✨"),
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
    "NightOff · 수주를 진심으로 기원합니다 🙏"
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

  let client = null;
  try {
    client = await api.get(`/api/clients/${cid}`);
  } catch (e) {
    console.error("[renderClientDetail] api/clients/:cid failed:", e);
    // 진짜 404 만 "찾을 수 없음" → 홈으로 이동.
    // 그 외 (5xx, timeout, 네트워크) 는 일시적일 수 있어 인플레이스 재시도 UI 제공.
    if (e?.status === 404) {
      toast("발주처를 찾을 수 없습니다", "error");
      navigate("/");
      return;
    }
    // 인플레이스 에러 카드 + 재시도 버튼
    main.appendChild(h("div", {
      style: "padding: 60px 28px; text-align: center; max-width: 640px; margin: 0 auto;",
    }, [
      h("h2", { style: "margin: 0 0 8px; font-size: 18px; font-weight: 700;" }, "발주처 정보를 불러오지 못했어요"),
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
    icon("arrowL", 14), document.createTextNode("발주처 목록으로"),
  ]));

  const stack = h("div", { class: "row-gap-18" });
  content.appendChild(stack);

  // 새 순서: 입찰 활동 히스토리 → 발주처 들여다보기 → RFP 분석 → 우리 회사 강점
  stack.appendChild(await renderConvHistorySection(cid));
  stack.appendChild(await renderClientIntelSection(cid));
  stack.appendChild(await renderRfpSection(cid));
  stack.appendChild(await renderClientStrengthsSection(cid));
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
  body.appendChild(h("div", { class: "btn-start-conv-wrap" }, [
    h("button", {
      class: "btn btn-primary big-cta",
      style: "justify-content: center; text-align: center;",
      onclick: startNew,
      html: `${iconHtml("plus", 22)}<span>새 대화 시작하기</span>`,
    }),
  ]));

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

// ---------- 발주처 들여다보기 👀 ----------
async function renderClientIntelSection(cid) {
  const r = await api.get(`/api/clients/${cid}/intel`).catch(() => ({ intel: {}, updated_at: null }));
  const intel = r?.intel || {};
  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: iconHtml("eye", 18) }),
      h("div", { style: "flex:1; min-width:0;" }, [
        h("h3", { class: "card-title" }, "발주처 들여다보기 👀"),
        h("p", { class: "card-subtitle" }, "RFP 를 넣으면 발주처 정보와 과업 내용을 자동으로 파악해요"),
      ]),
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

  if (!intel || Object.keys(intel).length === 0 || intel.error) {
    if (intel?.error) {
      // 에러 시에만 재시도 버튼 노출
      body.appendChild(h("div", { class: "intel-error-row" }, [
        h("span", { class: "muted small" }, `자동 수집 실패: ${intel.error}`),
        inlineRetry("다시 시도"),
      ]));
    } else {
      body.appendChild(h("div", { class: "muted small", style: "padding: 12px 4px;" },
        "RFP 를 업로드하면 자동으로 발주처 정보를 수집해요."));
    }
    return card;
  }

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

// ---------- 우리 회사의 강점은? 💪 (대시보드 전용) ----------
// ---------- 우리 회사의 강점은? 💪 (발주처별 — RFP 과업 성격 기반 추천) ----------
async function renderClientStrengthsSection(cid) {
  const [catalogR, currentR] = await Promise.all([
    api.get("/api/strengths/catalog").catch(() => ({ catalog: [] })),
    api.get(`/api/clients/${cid}/strengths`).catch(() => ({
      category: "", capabilities: [], suggested_category: "", project_domain_label: "", has_rfp: false,
    })),
  ]);
  const catalog = (catalogR && Array.isArray(catalogR.catalog)) ? catalogR.catalog : [];
  const cur = currentR || {};
  const allCategories = catalog.map((c) => c.category);
  const capByCategory = Object.fromEntries(catalog.map((c) => [c.category, c.capabilities]));

  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: "💪" }),
      h("div", { style: "flex:1; min-width:0;" }, [
        h("h3", { class: "card-title" }, "우리 회사의 강점은? 💪"),
        h("p", { class: "card-subtitle" }, "선택한 강점은 제안서 생성 시 자동으로 반영돼요"),
      ]),
    ]),
  ]));

  const body = h("div", { class: "card-body row-gap-12" });
  card.appendChild(body);

  // 1) RFP 분석 전 — 안내만
  if (!cur.has_rfp) {
    body.appendChild(h("div", { class: "muted small", style: "padding: 10px 4px; line-height: 1.6;" },
      "RFP 를 먼저 업로드하면 과업 성격을 자동으로 파악하고 어울리는 강점 분야를 추천해 드려요."));
    return card;
  }

  // 2) 과업 성격 안내 + 추천
  const suggested = cur.suggested_category || "";
  const domainLabel = cur.project_domain_label || "";
  const introBox = h("div", { class: "strengths-intro" });
  if (suggested) {
    introBox.innerHTML =
      `<div class="strengths-intro-title">이 과업은 <strong>${escapeHtml(suggested)}</strong> 성격이에요${domainLabel && domainLabel !== suggested ? ` <span class="muted small">(${escapeHtml(domainLabel)})</span>` : ""}.</div>` +
      `<div class="strengths-intro-sub">우리 회사가 잘하는 분야를 선택해주세요. 추천 분야가 자동으로 골라져 있어요.</div>`;
  } else {
    introBox.innerHTML =
      `<div class="strengths-intro-title">RFP 를 분석했어요. 잘하는 분야를 골라주세요.</div>` +
      `<div class="strengths-intro-sub">발주처 과업과 가장 잘 맞는 분야 한 가지를 먼저 고른 뒤, 세부 역량을 복수 선택할 수 있어요.</div>`;
  }
  body.appendChild(introBox);

  // 3) 대분류 select
  const initialCategory = cur.category || suggested || "";
  const categorySel = h("select", { class: "select strength-category-select" }, [
    h("option", { value: "" }, "분야 선택…"),
    ...allCategories.map((c) =>
      h("option", { value: c, ...(c === initialCategory ? { selected: "" } : {}) }, c)
    ),
  ]);
  body.appendChild(h("div", { class: "field" }, [
    h("label", { class: "small muted", style: "display: block; margin-bottom: 6px;" }, "1. 분야 (대분류)"),
    categorySel,
  ]));

  // 4) 소분류(capabilities) 멀티 체크박스 — 카테고리 선택 후 노출
  const capWrap = h("div", { class: "field strength-capabilities-wrap" });
  body.appendChild(capWrap);

  // 5) 저장 버튼 + 상태 표시
  const statusEl = h("span", { class: "small muted", style: "margin-left: auto;" }, "");
  const saveBtn = h("button", { class: "btn btn-primary" }, "저장");
  body.appendChild(h("div", { style: "display: flex; align-items: center; gap: 10px; margin-top: 4px;" }, [
    saveBtn, statusEl,
  ]));

  let currentCategory = initialCategory;
  let currentCaps = new Set(Array.isArray(cur.capabilities) ? cur.capabilities : []);

  function renderCapabilities() {
    capWrap.innerHTML = "";
    if (!currentCategory) {
      capWrap.appendChild(h("p", { class: "small muted", style: "margin: 0;" },
        "분야를 먼저 선택하면 세부 역량이 보여요."));
      return;
    }
    const caps = capByCategory[currentCategory] || [];
    capWrap.appendChild(h("label", { class: "small muted", style: "display: block; margin-bottom: 6px;" },
      `2. 세부 역량 (복수 선택 가능 · ${caps.length}개)`));
    const list = h("div", { class: "strength-cap-list strength-cap-list-multi" });
    caps.forEach((capName) => {
      const id = `cap-${cid}-${capName}`.replace(/[^\w가-힣-]/g, "_");
      const cb = h("input", {
        type: "checkbox", id,
        ...(currentCaps.has(capName) ? { checked: "" } : {}),
        onchange: () => {
          if (cb.checked) currentCaps.add(capName);
          else currentCaps.delete(capName);
          statusEl.textContent = "변경 사항 있음 — 저장 눌러주세요";
          statusEl.style.color = "var(--warning)";
        },
      });
      list.appendChild(h("label", { for: id, class: "strength-cap" }, [
        cb,
        h("span", {}, capName),
      ]));
    });
    capWrap.appendChild(list);
  }

  categorySel.addEventListener("change", () => {
    const newCat = categorySel.value;
    if (newCat !== currentCategory) {
      // 카테고리 바뀌면 기존 선택은 리셋
      currentCategory = newCat;
      currentCaps = new Set();
      renderCapabilities();
      statusEl.textContent = "변경 사항 있음 — 저장 눌러주세요";
      statusEl.style.color = "var(--warning)";
    }
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true; saveBtn.textContent = "저장 중…";
    try {
      await api.post(`/api/clients/${cid}/strengths`, {
        category: currentCategory,
        capabilities: Array.from(currentCaps),
      });
      statusEl.textContent = "✅ 저장됐어요";
      statusEl.style.color = "var(--success)";
    } catch (e) {
      statusEl.textContent = "저장 실패";
      statusEl.style.color = "var(--danger)";
      toast("저장 실패: " + (e.message || e), "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "저장";
    }
  });

  renderCapabilities();
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

    // ── (중단) 좌측 레이더 차트 + 우측 요구사항 체크리스트
    const middleGrid = h("div", { class: "rfp-grid-2" });

    // 좌: SVG 레이더 차트 (평가 기준 배점)
    if (a.evaluation_criteria?.length) {
      const crit = [...a.evaluation_criteria].map((ec) => {
        const m = String(ec.weight || "").match(/(\d+(?:\.\d+)?)/);
        return { item: ec.item || "", weight: m ? parseFloat(m[1]) : 0, raw: ec.weight };
      }).filter((c) => c.item);
      const radarSvg = buildRadarChartSvg(crit);
      middleGrid.appendChild(h("div", { class: "rfp-radar-wrap" }, [
        h("p", { class: "rfp-radar-title" }, `📊 평가 기준 배점 (총 ${crit.length}개 항목)`),
        radarSvg,
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

// ---------- SVG 레이더 차트 (RFP 평가 기준 시각화) ----------
function buildRadarChartSvg(items) {
  // items: [{item, weight, raw}, ...]  최대 8개로 컷, 작으면 그대로
  const data = (items || []).slice(0, 8);
  const n = data.length;
  if (n < 3) {
    // 항목이 너무 적으면 단순 배지 리스트로 대체
    const wrap = h("div", { style: "display: flex; flex-wrap: wrap; gap: 8px; padding: 8px;" });
    data.forEach((d) => wrap.appendChild(
      h("div", { style: "padding: 6px 12px; background: var(--primary-soft); color: var(--primary); border-radius: 999px; font-size: 12px; font-weight: 600;" },
        `${d.item} ${d.raw || (d.weight + "점")}`)));
    return wrap;
  }
  const maxW = Math.max(1, ...data.map((d) => d.weight));
  const cx = 160, cy = 160, R = 110;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i, ratio) => {
    const a = angle(i);
    return [cx + Math.cos(a) * R * ratio, cy + Math.sin(a) * R * ratio];
  };

  // 격자(2단계)
  const rings = [0.33, 0.66, 1].map((ratio) => {
    const pts = data.map((_, i) => point(i, ratio).join(",")).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="#E5E5E5" stroke-width="1"/>`;
  }).join("");

  // 축 (각 항목)
  const axes = data.map((_, i) => {
    const [x, y] = point(i, 1);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#E5E5E5" stroke-width="1"/>`;
  }).join("");

  // 데이터 폴리곤
  const dataPts = data.map((d, i) => point(i, Math.max(0.08, d.weight / maxW)).join(",")).join(" ");
  const dataPoly = `<polygon points="${dataPts}" fill="rgba(124,58,237,0.18)" stroke="#7C3AED" stroke-width="2"/>`;
  const dataDots = data.map((d, i) => {
    const [x, y] = point(i, Math.max(0.08, d.weight / maxW));
    return `<circle cx="${x}" cy="${y}" r="4" fill="#7C3AED"/>`;
  }).join("");

  // 라벨
  const labels = data.map((d, i) => {
    const [x, y] = point(i, 1.16);
    const anchor = (Math.abs(x - cx) < 8) ? "middle" : (x > cx ? "start" : "end");
    const itemShort = d.item.length > 9 ? d.item.slice(0, 8) + "…" : d.item;
    const wText = d.raw || `${d.weight}점`;
    return `<g><text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" fill="#374151" font-weight="600">${itemShort}</text><text x="${x}" y="${y + 13}" text-anchor="${anchor}" font-size="10" fill="#7C3AED" font-weight="500">${wText}</text></g>`;
  }).join("");

  const svgHtml = `
    <svg viewBox="0 0 320 320" width="100%" style="max-width: 360px; display: block; margin: 0 auto;">
      ${rings}
      ${axes}
      ${dataPoly}
      ${dataDots}
      ${labels}
    </svg>`;
  const wrap = h("div", {});
  wrap.innerHTML = svgHtml;
  return wrap;
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

  // 사이드 패널 활성화/비활성화 헬퍼 — 외부에서 접근 가능
  function activateSidePanel(propEl, isFinal) {
    splitWrap.classList.add("split-active");
    sidePanel.classList.remove("hidden");
    sidePanel.innerHTML = "";
    sidePanel.appendChild(h("div", { class: "side-panel-head" }, [
      h("div", {}, [
        h("p", { class: "side-panel-label" }, isFinal ? "✅ 미리보기" : "⏳ 작성 중인 제안서"),
        h("p", { class: "side-panel-title" }, propEl?.getAttribute?.("data-title") || "제안서"),
      ]),
      h("button", {
        class: "icon-btn", title: "사이드 패널 닫기",
        html: iconHtml("x", 18),
        onclick: () => {
          splitWrap.classList.remove("split-active");
          sidePanel.classList.add("hidden");
        },
      }),
    ]));
    const stage = h("div", { class: "side-panel-stage" });
    if (propEl) {
      const clone = propEl.cloneNode(true);
      clone.classList.add("side-panel-mode");
      // keyword-row 제거 — 사이드에선 군더더기
      clone.querySelectorAll(".keyword-row, .image-credit").forEach((e) => e.remove());
      stage.appendChild(clone);
    }
    sidePanel.appendChild(stage);
  }
  // 글로벌 노출 — renderAssistant 가 호출
  shell._activateSidePanel = activateSidePanel;

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
  // 첫 대화면 친근한 인사 메시지
  if (!data.messages || data.messages.length === 0) {
    msgs.appendChild(msgElement(
      "assistant",
      "안녕하세요! 저는 제안서 수주 도우미예요 ✨\n\nRFP 를 올려주시면 발주처 정보랑 과업 내용을 같이 살펴보고, 우리 회사 강점에 맞춰 제안서 초안을 함께 만들어 드릴게요.\n\n어떤 사업부터 시작해볼까요?",
      new Date().toISOString(),
    ));
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

    aborter = new AbortController();
    let targetText = "";    // 서버에서 받아 누적한 실제 full text
    let displayedText = ""; // 화면에 출력된 길이
    let firstDelta = true;
    let rafActive = false;
    let streamDone = false;

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
            renderAssistant(bubble, targetText, true);
            progress.finish(true);
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
      // 제안서가 포함된 응답이면 완료 메시지를 한 번 더 노출
      if (/<div class="proposal"/.test(targetText)) {
        const done = h("div", { class: "msg-row assistant proposal-done-row" }, [
          h("div", { class: "msg-avatar", html: iconHtml("brain", 18) }),
          h("div", { class: "msg-body" }, [
            h("div", { class: "msg-bubble" },
              "✅ 제안서 초안이 완성됐어요! 수정이 필요한 부분은 말씀해 주세요 😊"),
          ]),
        ]);
        msgs.appendChild(done);
        if (!userScrolledUp) body.scrollTop = body.scrollHeight;
      }
      ta.focus();
    }
  });

  shell.appendChild(h("div", { class: "chat-input-wrap" }, [
    h("div", { class: "chat-input-container" }, [ta, sendBtn, stopBtn]),
    h("p", { class: "chat-hint" }, "발주처 정보 · RFP 과업 · 우리 회사 강점이 자동으로 들어가요"),
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

    // 좌우 분할 패널 자동 활성화 — 제안서 HTML 감지되면 우측에 라이브 미리보기
    try {
      const shellEl = document.querySelector("main.chat-split-wrap > .chat-shell");
      if (shellEl && typeof shellEl._activateSidePanel === "function") {
        shellEl._activateSidePanel(propEl, !!final);
      }
    } catch (e) { /* 사이드 패널은 옵셔널 — 실패해도 본문은 정상 */ }

    // 썸네일: 축소 미리보기 (첫 2~3 페이지)
    const thumbWrap = h("div", { class: "proposal-thumb-preview" });
    const thumbInner = h("div", { class: "proposal-thumb-stage", style: `--proposal-accent: ${accent};` });
    const propClone = propEl.cloneNode(true);
    propClone.classList.add("proposal-thumb-mode");
    thumbInner.appendChild(propClone);
    thumbWrap.appendChild(thumbInner);

    card.appendChild(h("div", { class: "proposal-thumb-header" }, [
      h("div", { style: "flex:1; min-width:0;" }, [
        h("div", { class: "thumb-label" }, final ? "✅ 제안서 완성" : "📝 제안서 생성 중"),
        h("h4", { class: "thumb-title" }, title),
        h("div", { class: "thumb-meta" }, `${orientation === "portrait" ? "A4 세로" : "A4 가로"} · 총 ${pageCount}페이지`),
      ]),
      h("button", {
        class: "btn btn-primary btn-lg thumb-open",
        html: `${iconHtml("eye", 16)}<span>전체화면으로 보기</span>`,
        onclick: () => openProposalInNewTab(propEl),
      }),
    ]));
    card.appendChild(thumbWrap);
    const actionsBar = h("div", { class: "proposal-thumb-actions" }, [
      h("button", {
        class: "btn btn-primary",
        html: `${iconHtml("file", 14)}<span>PPTX 다운로드</span>`,
        title: "제안서를 .pptx 파일로 내려받기",
        onclick: async (e) => {
          const btn = e.currentTarget;
          // 가장 가까운 conversation id 추적 — URL 해시에서 추출
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
      h("button", { class: "btn btn-outline", html: `${iconHtml("printer", 14)}<span>인쇄 / PDF</span>`,
        onclick: () => printProposal(propEl) }),
      h("button", { class: "btn btn-outline", html: `${iconHtml("eye", 14)}<span>모달로 보기</span>`,
        onclick: () => openProposalFullscreen(propEl) }),
    ]);
    card.appendChild(actionsBar);
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
  inp.placeholder = s.has_key ? s.masked_key : "sk-ant-api03-...";
  inp.disabled = !!s.env_active;  // env 사용 중이면 입력창 비활성
  const status = $("#api-key-status");
  if (s.env_active) {
    status.innerHTML = `<strong style="color: var(--primary);">🔒 Railway 환경변수 사용 중</strong><br><span class="muted">서버 환경변수 <code>ANTHROPIC_API_KEY</code> 가 우선 적용됩니다 (<code>${escapeHtml(s.masked_key)}</code>). 키를 바꾸려면 Railway Variables 에서 수정하세요.</span>`;
  } else if (s.has_key) {
    status.innerHTML = `DB에 저장된 키 사용 중: <code>${escapeHtml(s.masked_key)}</code>`;
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

$("#test-key")?.addEventListener("click", async () => {
  // 저장 안 된 새 키가 입력창에 있다면 먼저 저장
  const newKey = $("#api-key-input")?.value.trim() || "";
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
