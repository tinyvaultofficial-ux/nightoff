// BidPick — SPA client
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
const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error((await r.text()) || r.statusText);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : null,
    });
    if (!r.ok) throw new Error((await r.text()) || r.statusText);
    return r.json();
  },
  async patch(path, body) {
    const r = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.text()) || r.statusText);
    return r.json();
  },
  async del(path) {
    const r = await fetch(path, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.text()) || r.statusText);
    return r.json();
  },
  async upload(path, file) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(path, { method: "POST", body: fd });
    if (!r.ok) throw new Error((await r.text()) || r.statusText);
    return r.json();
  },
};

// ---------- Toast ----------
function toast(msg, kind = "") {
  const el = h("div", { class: `toast ${kind}` }, msg);
  $("#toast-root").appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

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
      h("div", { class: "sidebar-logo-mark" }, "B"),
      h("span", { class: "sidebar-logo-name" }, "BidPick"),
    ]),
    h("nav", { class: "sidebar-nav" }, [
      h("button", {
        class: "sidebar-item" + (active === "clients" ? " active" : ""),
        onclick: () => navigate("/"),
        html: `${iconHtml("users")}<span>클라이언트 목록</span>`,
      }),
      h("div", { class: "sidebar-section-title" }, "최근 클라이언트"),
      ...recent.map((c) =>
        h("button", {
          class: "sidebar-recent-item",
          onclick: () => navigate(`/client/${c.id}`),
          html: `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.name)}</span>${iconHtml("chevronR", 14)}`,
        })
      ),
      recent.length === 0
        ? h("div", { class: "muted small", style: "padding: 8px 12px;" }, "등록된 클라이언트가 없습니다")
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
async function renderDashboard() {
  const root = $("#app-root");
  root.innerHTML = "";
  root.appendChild(await renderSidebar("clients"));

  const main = h("main", { class: "main" });
  root.appendChild(main);

  const stats = await api.get("/api/stats").catch(() => ({}));
  const clients = await api.get("/api/clients").catch(() => []);

  main.appendChild(h("header", { class: "main-header" }, [
    h("div", {}, [
      h("h1", {}, "클라이언트"),
      h("p", {}, `총 ${clients.length}개의 클라이언트를 관리하고 있습니다`),
    ]),
    h("button", {
      class: "btn btn-primary btn-lg",
      onclick: () => navigate("/client/new"),
      html: `${iconHtml("plus", 18)}<span>클라이언트 추가</span>`,
    }),
  ]));

  const content = h("div", { class: "main-content" });
  main.appendChild(content);

  // Stats
  const statItems = [
    { label: "진행 중인 대화", value: stats.active_conversations ?? 0, unit: "건", icon: "file", tint: "var(--primary-soft)", fg: "var(--primary)" },
    { label: "등록 클라이언트", value: stats.total_clients ?? 0, unit: "건", icon: "users", tint: "var(--warning-soft)", fg: "var(--warning)" },
    { label: "누적 메시지", value: stats.total_messages ?? 0, unit: "건", icon: "activity", tint: "var(--accent)", fg: "var(--accent-fg)" },
    { label: "RFP 분석", value: stats.rfp_count ?? 0, unit: "건", icon: "trending", tint: "var(--success-soft)", fg: "var(--success)" },
  ];
  const statsGrid = h("div", { class: "stats-grid" });
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

  // Clients section
  const clientsHeader = h("div", { class: "flex-between", style: "margin-bottom: 18px;" }, [
    h("h2", { style: "margin: 0; font-size: 18px; font-weight: 600;" }, "클라이언트 목록"),
  ]);
  content.appendChild(clientsHeader);

  if (clients.length === 0) {
    content.appendChild(h("div", { class: "card empty-state" }, [
      h("p", {}, "등록된 클라이언트가 없습니다."),
      h("div", { style: "margin-top: 12px;" }, [
        h("button", { class: "btn btn-primary", onclick: () => navigate("/client/new") }, "첫 클라이언트 추가"),
      ]),
    ]));
  } else {
    const grid = h("div", { class: "client-grid" });
    clients.forEach((c) => grid.appendChild(clientCard(c)));
    content.appendChild(grid);
  }
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
      h("h1", {}, mode === "create" ? "새 클라이언트 추가" : "클라이언트 수정"),
      h("p", {}, "클라이언트 기본 정보를 입력하세요"),
    ]),
  ]));

  let data = { name: "", industry: "", manager: "", memo: "" };
  if (mode === "edit" && id) {
    try { data = await api.get(`/api/clients/${id}`); } catch (e) { toast("클라이언트를 불러올 수 없습니다", "error"); return; }
  }

  const form = h("form", {}, [
    h("div", { class: "card", style: "padding: 28px; max-width: 720px;" }, [
      h("div", { class: "row-gap-18" }, [
        h("div", { class: "field" }, [
          h("label", {}, [document.createTextNode("클라이언트명 "), h("span", { style: "color: var(--danger);" }, "*")]),
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
            if (!body.name) { toast("클라이언트명을 입력하세요", "error"); return; }
            if (!body.industry) { toast("업종을 선택하세요", "error"); return; }
            try {
              if (mode === "create") {
                const r = await api.post("/api/clients", body);
                toast("클라이언트가 추가되었습니다", "success");
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
  if (!client) { toast("클라이언트를 찾을 수 없습니다", "error"); navigate("/"); return; }

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
    icon("arrowL", 14), document.createTextNode("클라이언트 목록으로"),
  ]));

  const stack = h("div", { class: "row-gap-18" });
  content.appendChild(stack);

  // Order per spec: History → References → RFP → Competitors → Memory
  stack.appendChild(await renderConvHistorySection(cid));
  stack.appendChild(await renderReferenceSection(cid));
  stack.appendChild(await renderRfpSection(cid));
  stack.appendChild(await renderCompetitorSection(cid));
  stack.appendChild(await renderMemorySection(cid));
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
    h("button", {
      class: "btn btn-primary", html: `${iconHtml("plus", 16)}<span>새 대화 시작</span>`,
      onclick: async () => {
        try {
          const r = await api.post(`/api/clients/${cid}/conversations`);
          navigate(`/client/${cid}/chat/${r.id}`);
        } catch (e) { toast(String(e.message || e), "error"); }
      },
    }),
  ]));

  const body = h("div", { class: "card-body" });
  card.appendChild(body);

  if (!convs.length) {
    body.appendChild(h("div", { class: "empty-state" }, "대화가 없습니다. 새 대화를 시작해보세요."));
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
    const row = h("div", { class: "file-row" }, [
      h("div", { class: "left" }, [
        h("div", { class: "file-icon", html: iconHtml("file", 18) }),
        h("div", {}, [
          h("p", { class: "file-name" }, file.name),
          h("p", { class: "file-sub" }, [
            h("span", { class: "loading-dots", html: "<span></span><span></span><span></span>" }),
            document.createTextNode(" AI 분석 중…"),
          ]),
        ]),
      ]),
    ]);
    list.prepend(row);
    try {
      await api.upload(`/api/clients/${cid}/references`, file);
      toast("레퍼런스 등록 완료", "success");
      renderClientDetail(cid);
    } catch (e) {
      row.remove();
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
async function renderRfpSection(cid) {
  const rfp = await api.get(`/api/clients/${cid}/rfp`).catch(() => ({ has_rfp: false }));
  const card = h("div", { class: "card" });
  card.appendChild(h("div", { class: "card-head" }, [
    h("div", { class: "card-title-row" }, [
      h("div", { class: "card-title-icon", html: iconHtml("fileSearch", 18) }),
      h("div", {}, [
        h("h3", { class: "card-title" }, "RFP 분석"),
        h("p", { class: "card-subtitle" }, "RFP 문서를 업로드하면 핵심 요구사항·마감일·형식을 자동 파악합니다"),
      ]),
    ]),
  ]));

  const body = h("div", { class: "card-body row-gap-14" });
  card.appendChild(body);

  const input = h("input", { type: "file", style: "display: none;", accept: ".pdf,.doc,.docx,.txt" });
  input.addEventListener("change", async () => {
    if (input.files[0]) await doUpload(input.files[0]);
    input.value = "";
  });
  body.appendChild(input);

  const drop = h("div", { class: "drop-area", onclick: () => input.click() }, [
    h("div", { class: "drop-icon", html: iconHtml("upload", 22) }),
    h("p", { class: "drop-title" }, rfp.has_rfp ? "새 RFP로 교체 업로드" : "RFP 파일 업로드"),
    h("p", { class: "drop-hint" }, "PDF / Word 지원"),
  ]);
  ["dragenter","dragover"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragover"); }));
  ["dragleave","drop"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("dragover"); }));
  drop.addEventListener("drop", async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) await doUpload(e.dataTransfer.files[0]);
  });
  body.appendChild(drop);

  async function doUpload(file) {
    toast("RFP 업로드 & 분석 중…", "");
    try {
      await api.upload(`/api/clients/${cid}/rfp`, file);
      toast("RFP 분석 완료", "success");
      renderClientDetail(cid);
    } catch (e) { toast("업로드 실패: " + (e.message || e), "error"); }
  }

  if (rfp.has_rfp && rfp.analysis) {
    const a = rfp.analysis;
    const result = h("div", { class: "card", style: "padding: 20px; border: 1px solid var(--border); box-shadow: none;" });
    body.appendChild(result);

    result.appendChild(h("div", { class: "flex-between" }, [
      h("div", {}, [
        h("h4", { style: "margin: 0 0 4px; font-size: 16px; font-weight: 600;" }, a.title || rfp.filename),
        h("p", { class: "small muted", style: "margin: 0;" }, rfp.filename),
      ]),
      h("div", { class: "flex-row", style: "gap: 6px;" }, [
        h("span", { class: "badge badge-success", html: `${iconHtml("check", 12)}<span>분석 완료</span>` }),
        h("button", {
          class: "icon-btn", title: "삭제", html: iconHtml("trash", 16),
          onclick: async () => {
            if (!confirm("RFP를 삭제하시겠습니까?")) return;
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

    // Requirements
    if (a.key_requirements?.length) {
      result.appendChild(h("div", { style: "margin-top: 18px;" }, [
        h("p", { class: "small muted", style: "margin: 0 0 8px; font-weight: 500;" }, "주요 요구사항"),
        h("div", { class: "flex-row", style: "flex-wrap: wrap; gap: 6px;" },
          a.key_requirements.map((r) => h("span", { class: "badge badge-outline" }, r))),
      ]));
    }

    // Evaluation criteria
    if (a.evaluation_criteria?.length) {
      result.appendChild(h("div", { style: "margin-top: 18px;" }, [
        h("p", { class: "small muted", style: "margin: 0 0 8px; font-weight: 500;" }, "평가 기준"),
        ...a.evaluation_criteria.map((ec) => h("div", { style: "display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 14px;" }, [
          h("span", {}, ec.item || ""),
          h("span", { class: "muted" }, ec.weight || ""),
        ])),
      ]));
    }

    // Risk points
    if (a.risk_points?.length) {
      result.appendChild(h("div", { style: "margin-top: 18px;" }, [
        h("p", { class: "small muted", style: "margin: 0 0 8px; font-weight: 500;" }, "리스크/주의사항"),
        h("ul", { style: "list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;" },
          a.risk_points.map((p) => h("li", { class: "flex-row", style: "align-items: flex-start; font-size: 14px;" }, [
            h("span", { style: "color: var(--warning); flex-shrink: 0; margin-top: 3px;", html: iconHtml("alert", 14) }),
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

  // Input row
  const inp = h("input", { class: "input", placeholder: "경쟁사 기업명을 입력하세요 (예: LG CNS)" });
  const ctx = h("input", { class: "input", placeholder: "추가 컨텍스트 (선택, 예: 동일 사업 수주 이력)" });
  body.appendChild(h("div", { style: "display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px;" }, [
    inp, ctx,
    h("button", {
      class: "btn btn-primary", html: `${iconHtml("plus", 16)}<span>분석 추가</span>`,
      onclick: async () => {
        const name = inp.value.trim();
        if (!name) { toast("경쟁사명을 입력하세요", "error"); return; }
        toast("경쟁사 분석 중…", "");
        try {
          await api.post(`/api/clients/${cid}/competitors`, { name, context: ctx.value.trim() });
          toast("분석 완료", "success");
          renderClientDetail(cid);
        } catch (e) { toast(String(e.message || e), "error"); }
      },
    }),
  ]));

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
    (c.strengths?.length ? h("div", {}, [
      h("p", { class: "small muted", style: "margin: 8px 0 4px; font-weight: 500;" }, "강점"),
      h("div", { class: "comp-tags-row" }, c.strengths.map((s) => h("span", { class: "badge strength-badge" }, s))),
    ]) : null),
    (c.weaknesses?.length ? h("div", {}, [
      h("p", { class: "small muted", style: "margin: 8px 0 4px; font-weight: 500;" }, "약점"),
      h("div", { class: "comp-tags-row" }, c.weaknesses.map((s) => h("span", { class: "badge weakness-badge" }, s))),
    ]) : null),
    c.differentiator ? h("div", { class: "comp-diff" }, "우리의 승부수 · " + c.differentiator) : null,
  ]);
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
        h("p", { class: "card-subtitle" }, `AI가 학습한 클라이언트 정보 ${mems.length}개 · 새 대화에 자동 주입됩니다`),
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
      h("div", { class: "context-badges" }, [
        h("span", { class: "small muted" }, "주입됨:"),
        injected.rfp ? h("span", { class: "badge badge-primary" }, "RFP") : null,
        injected.refs ? h("span", { class: "badge badge-primary" }, "레퍼런스") : null,
        injected.memory ? h("span", { class: "badge badge-primary" }, "대화기억") : null,
        (!injected.rfp && !injected.refs && !injected.memory) ? h("span", { class: "small muted" }, "없음") : null,
      ]),
      h("button", {
        class: "btn btn-outline", html: `${iconHtml("save", 14)}<span>대화 종료 & 기억 저장</span>`,
        onclick: async () => {
          if (!confirm("대화를 종료하고 기억을 저장하시겠습니까? AI가 대화에서 뉘앙스를 추출해 클라이언트에 저장합니다.")) return;
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
  const sendBtn = h("button", { class: "send-btn", html: iconHtml("send", 20), disabled: true });

  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    sendBtn.disabled = !ta.value.trim();
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
  });

  let streaming = false;
  sendBtn.addEventListener("click", async () => {
    const text = ta.value.trim();
    if (!text || streaming) return;
    streaming = true; sendBtn.disabled = true; ta.disabled = true;

    // Optimistic user bubble
    msgs.appendChild(msgElement("user", text, new Date().toISOString()));
    ta.value = ""; ta.style.height = "auto";
    body.scrollTop = body.scrollHeight;

    // Assistant placeholder
    const asstEl = msgElement("assistant", "", new Date().toISOString());
    msgs.appendChild(asstEl);
    const bubble = asstEl.querySelector(".msg-bubble");
    bubble.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
    body.scrollTop = body.scrollHeight;

    let fullText = "";
    try {
      const resp = await fetch(`/api/conversations/${convId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
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
            fullText += ev.text;
            renderAssistant(bubble, fullText);
            body.scrollTop = body.scrollHeight;
          } else if (ev.type === "error") {
            bubble.innerHTML = `<span style="color:var(--danger);">❌ ${escapeHtml(ev.error)}</span>`;
          } else if (ev.type === "done") {
            renderAssistant(bubble, fullText, true);
          }
        }
      }
    } catch (e) {
      bubble.innerHTML = `<span style="color:var(--danger);">❌ ${escapeHtml(e.message || String(e))}</span>`;
    } finally {
      streaming = false; sendBtn.disabled = false; ta.disabled = false; ta.focus();
    }
  });

  shell.appendChild(h("div", { class: "chat-input-wrap" }, [
    h("div", { class: "chat-input-container" }, [ta, sendBtn]),
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
function renderAssistant(bubble, text, final = false) {
  bubble.dataset.raw = text;
  // Detect proposal block
  const idx = text.indexOf('<div class="proposal"');
  if (idx === -1) {
    bubble.textContent = text;
    return;
  }

  // Split: pre-text and proposal content
  const pre = text.slice(0, idx).trim();
  const rest = text.slice(idx);
  const endIdx = findProposalEnd(rest);
  let propHtml = endIdx > 0 ? rest.slice(0, endIdx) : rest;
  const post = endIdx > 0 ? rest.slice(endIdx).trim() : "";

  bubble.innerHTML = "";
  if (pre) bubble.appendChild(h("div", { style: "white-space: pre-wrap; margin-bottom: 10px;" }, pre));

  // Sanitize and render proposal
  const wrapper = h("div", { class: "proposal-wrapper" });
  const safe = sanitizeProposalHtml(propHtml);
  wrapper.innerHTML = safe;

  const propEl = wrapper.querySelector(".proposal");
  if (propEl) {
    // 완전 흑백 — 어떤 색상도 주입하지 않음 (디자이너가 나중에 입힘)

    // Add toolbar (only when final or has at least 1 page)
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

    // Add keyword row under each page
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

    propEl.parentElement.insertBefore(toolbar, propEl);
  }

  bubble.appendChild(wrapper);
  if (post) bubble.appendChild(h("div", { style: "white-space: pre-wrap; margin-top: 10px;" }, post));
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
    class: "modal-backdrop",
    onclick: (e) => { if (e.target === backdrop) backdrop.remove(); },
  });
  const modal = h("div", {
    class: "modal",
    style: "max-width: 95vw; max-height: 95vh; overflow: auto; padding: 24px;",
  });
  modal.appendChild(h("div", { class: "flex-between", style: "margin-bottom: 14px;" }, [
    h("h3", { style: "margin: 0;" }, propEl.getAttribute("data-title") || "제안서 미리보기"),
    h("button", { class: "icon-btn", onclick: () => backdrop.remove(), html: iconHtml("x", 20) }),
  ]));
  const clone = propEl.cloneNode(true);
  modal.appendChild(clone);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

// ---------- Settings modal ----------
async function openSettings() {
  const modal = $("#settings-modal");
  const s = await api.get("/api/settings");
  $("#api-key-input").value = "";
  $("#api-key-input").placeholder = s.has_key ? s.masked_key : "sk-ant-api03-...";
  $("#api-key-status").textContent = s.has_key ? `설정된 키: ${s.masked_key}` : "설정된 키 없음";
  $("#model-select").value = s.model || "claude-sonnet-4-5-20250929";
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

// ---------- Boot ----------
route();
