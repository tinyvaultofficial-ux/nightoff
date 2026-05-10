// NightOff Admin Dashboard — 단계 3-A (skeleton + 탭 1 사용자 관리)
// 인증: localStorage.token (JWT) → fetch /api/admin/* Authorization: Bearer
// 401 → /login redirect / 403 → 권한 X 안내 / 200 → 데이터 렌더

// ─── Auth helpers ──────────────────────────────────────────────────────────
// ⚠ app.js:174 (AUTH_TOKEN_KEY = "nightoff_jwt") 영역 정확 일치 필수.
// 다른 키 영역 사용 영역 → token 영역 X → redirectToLogin 즉시 → admin 영역 X.
const TOKEN_KEY = "nightoff_jwt";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function redirectToLogin() {
  window.location.href = "/login.html";
}

// ─── API helpers ───────────────────────────────────────────────────────────
async function apiGet(path) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error("토큰 없음");
  }
  const resp = await fetch(path, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (resp.status === 401) {
    clearToken();
    redirectToLogin();
    throw new Error("인증 만료");
  }
  if (resp.status === 403) {
    throw new Error("관리자 권한이 필요합니다");
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function apiPatch(path, body) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error("토큰 없음");
  }
  const resp = await fetch(path, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (resp.status === 401) { clearToken(); redirectToLogin(); throw new Error("인증 만료"); }
  if (resp.status === 403) throw new Error("관리자 권한이 필요합니다");
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function apiPost(path, body) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error("토큰 없음");
  }
  const resp = await fetch(path, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (resp.status === 401) { clearToken(); redirectToLogin(); throw new Error("인증 만료"); }
  if (resp.status === 403) throw new Error("관리자 권한이 필요합니다");
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ─── UI helpers ────────────────────────────────────────────────────────────
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (type ? ` ${type}` : "");
  setTimeout(() => { el.className = "toast"; }, 3000);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtNumber(n) {
  if (typeof n !== "number") n = Number(n) || 0;
  return n.toLocaleString("ko-KR");
}

function fmtDate(s) {
  if (!s) return "-";
  // YYYY-MM-DD HH:MM:SS → YYYY-MM-DD
  return String(s).slice(0, 10);
}

// ─── 인증 헤더 영역 admin email 표시 + 권한 검증 ────────────────────────────
// ⚠ /api/auth/me 응답 구조 (main.py:4159-4162):
//   { "user": { "id": ..., "email": ..., "role": ... } }
// data.user.role / data.user.email 영역 접근 필수 (data.role / data.email 영역 X).
async function loadCurrentUser() {
  try {
    const data = await apiGet("/api/auth/me");
    const user = data.user || {};
    if (user.role !== "admin") {
      document.body.innerHTML = `
        <div style="padding:60px; text-align:center;">
          <h2 style="color:#c43;">관리자 권한이 필요합니다</h2>
          <p>현재 계정 (${escapeHtml(user.email || "")})은 일반 사용자입니다.</p>
          <p style="margin-top:20px;">
            <a href="/" style="color:#6b46e5;">메인 페이지로 돌아가기</a>
          </p>
        </div>`;
      return false;
    }
    document.getElementById("admin-email").textContent = user.email || "";
    return true;
  } catch (e) {
    console.error("auth 검증 실패:", e);
    return false;
  }
}

function logout() {
  clearToken();
  redirectToLogin();
}

// ─── 탭 전환 ────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(`tab-${tab}`).classList.add("active");
      // 탭 전환 시 데이터 로드 (cache 미존재 시)
      if (tab === "users" && !usersState.loaded) loadUsers();
      if (tab === "errors" && !errorsState.loaded) loadErrors();
      if (tab === "stats" && !statsState.loaded) loadStats();
      if (tab === "settings" && !settingsState.loaded) loadSettings();
      if (tab === "quota" && !quotaState.loaded) loadQuota();
      if (tab === "resetlog" && !resetlogState.loaded) loadResetlog();
    });
  });
}

// ─── 탭 1: 사용자 관리 ─────────────────────────────────────────────────────
const usersState = {
  limit: 50,
  offset: 0,
  total: 0,
  users: [],
  loaded: false,
};

async function loadUsers() {
  const content = document.getElementById("users-content");
  const meta = document.getElementById("users-meta");
  const errorEl = document.getElementById("users-error");
  errorEl.innerHTML = "";
  content.innerHTML = `<div class="loading">사용자 목록 로딩 중...</div>`;

  try {
    const data = await apiGet(`/api/admin/users?limit=${usersState.limit}&offset=${usersState.offset}`);
    usersState.users = data.users || [];
    usersState.total = data.total || 0;
    usersState.loaded = true;
    meta.textContent = `총 ${fmtNumber(usersState.total)}명 (${usersState.offset + 1}~${usersState.offset + usersState.users.length})`;
    renderUsersTable();
    renderUsersPagination();
  } catch (e) {
    content.innerHTML = "";
    errorEl.innerHTML = `<div class="error-banner">${escapeHtml(e.message || "로딩 실패")}</div>`;
  }
}

function renderUsersTable() {
  const content = document.getElementById("users-content");
  if (usersState.users.length === 0) {
    content.innerHTML = `<div class="empty">사용자가 없습니다.</div>`;
    return;
  }
  const rows = usersState.users.map((u) => {
    // Phase 3 quota 표시 — 백엔드 /api/admin/users 가 quota 컬럼 4종 반환.
    const propQ = u.monthly_proposal_quota != null ? u.monthly_proposal_quota : "-";
    const convQ = u.monthly_conversation_quota != null ? u.monthly_conversation_quota : "-";
    const propBonus = u.monthly_proposal_quota_bonus || 0;
    const convBonus = u.monthly_conversation_quota_bonus || 0;
    // 보너스 셀 — 둘 다 0 이면 '-', 아니면 'P+N · C+M' 형태
    const bonusCell = (propBonus === 0 && convBonus === 0)
      ? `<span style="color:var(--fg-2);">-</span>`
      : `<span title="프로모션 충전" style="font-size:12px;">`
        + (propBonus > 0 ? `<span class="status-badge admin">P +${propBonus}</span> ` : "")
        + (convBonus > 0 ? `<span class="status-badge admin">C +${convBonus}</span>` : "")
        + `</span>`;
    return `
    <tr>
      <td>${escapeHtml((u.id || "").slice(0, 12))}</td>
      <td>${escapeHtml(u.email || "-")}</td>
      <td>${escapeHtml(u.company || "-")}</td>
      <td>
        ${u.role === "admin" ? '<span class="status-badge admin">admin</span>' : "user"}
      </td>
      <td>
        ${u.is_active
          ? (u.is_suspended
              ? '<span class="status-badge suspended">정지</span>'
              : '<span class="status-badge active">활성</span>')
          : '<span class="status-badge suspended">비활성</span>'}
      </td>
      <td class="num" title="제안서 월간 잔여">${fmtNumber(propQ)}</td>
      <td class="num" title="대화 월간 잔여">${fmtNumber(convQ)}</td>
      <td>${bonusCell}</td>
      <td>${fmtDate(u.last_reset_date)}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>
        <button class="btn" onclick="openUserModal('${escapeHtml(u.id)}')">수정</button>
      </td>
    </tr>
  `;
  }).join("");

  content.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>이메일</th>
            <th>회사</th>
            <th>역할</th>
            <th>상태</th>
            <th class="num" title="monthly_proposal_quota">제안서</th>
            <th class="num" title="monthly_conversation_quota">대화</th>
            <th title="프로모션 충전 (proposal_bonus / conversation_bonus)">보너스</th>
            <th>마지막 리셋일</th>
            <th>가입일</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderUsersPagination() {
  const pag = document.getElementById("users-pagination");
  const total = usersState.total;
  if (total <= usersState.limit) {
    pag.style.display = "none";
    return;
  }
  pag.style.display = "flex";
  const page = Math.floor(usersState.offset / usersState.limit) + 1;
  const totalPages = Math.ceil(total / usersState.limit);
  pag.innerHTML = `
    <button onclick="usersGoPage(${page - 1})" ${page <= 1 ? "disabled" : ""}>← 이전</button>
    <span class="page-info">${page} / ${totalPages} 페이지</span>
    <button onclick="usersGoPage(${page + 1})" ${page >= totalPages ? "disabled" : ""}>다음 →</button>`;
}

function usersGoPage(page) {
  if (page < 1) return;
  usersState.offset = (page - 1) * usersState.limit;
  loadUsers();
}

// ─── 사용자 수정 모달 ──────────────────────────────────────────────────────
function openUserModal(userId) {
  const u = usersState.users.find((x) => x.id === userId);
  if (!u) { toast("사용자를 찾을 수 없습니다", "error"); return; }

  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
      <div class="modal">
        <h3>사용자 수정 — ${escapeHtml(u.email || u.id)}</h3>
        <div class="form-row">
          <label>유료 크레딧 (현재 ${fmtNumber(u.credits || 0)})</label>
          <input type="number" id="m-credits" value="${u.credits || 0}" min="0" />
        </div>
        <div class="form-row">
          <label>이달 사용액 (현재 ${fmtNumber(u.credits_used_this_month || 0)})</label>
          <input type="number" id="m-used" value="${u.credits_used_this_month || 0}" min="0" />
        </div>
        <div class="form-row">
          <label>마지막 리셋 날짜 (YYYY-MM-DD)</label>
          <input type="date" id="m-reset" value="${escapeHtml((u.last_reset_date || "").slice(0, 10))}" />
        </div>
        <div class="form-row">
          <label>정지 여부</label>
          <select id="m-suspend">
            <option value="0" ${!u.is_suspended ? "selected" : ""}>활성</option>
            <option value="1" ${u.is_suspended ? "selected" : ""}>정지</option>
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeModal()">취소</button>
          <button class="btn btn-primary" id="user-save-btn" onclick="saveUserModal('${escapeHtml(userId)}')">저장</button>
        </div>
      </div>
    </div>`;
  attachEscHandler();
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  // ESC 키 핸들러 영역 cleanup (메모리 누수 회피)
  if (window.__adminEscHandler) {
    document.removeEventListener("keydown", window.__adminEscHandler);
    window.__adminEscHandler = null;
  }
}

// 모달 영역 영역 시 ESC 핸들러 영역 — 영역 모달 (탭 1 / 탭 2) 영역 영역 흐름.
// closeModal 영역 자동 cleanup.
function attachEscHandler() {
  if (window.__adminEscHandler) {
    document.removeEventListener("keydown", window.__adminEscHandler);
  }
  const handler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
  };
  window.__adminEscHandler = handler;
  document.addEventListener("keydown", handler);
}

async function saveUserModal(userId) {
  const btn = document.getElementById("user-save-btn");
  if (btn && btn.disabled) return;  // 중복 클릭 방지

  const credits = Number(document.getElementById("m-credits").value);
  const used = Number(document.getElementById("m-used").value);
  const reset = document.getElementById("m-reset").value.trim();
  const suspend = Number(document.getElementById("m-suspend").value);

  // 날짜 형식 검증 — type="date" 영역 자동 형식 (YYYY-MM-DD) 다만 영역 영역 영역
  if (reset && !/^\d{4}-\d{2}-\d{2}$/.test(reset)) {
    toast("날짜 형식 영역 X — YYYY-MM-DD 형식 영역", "error");
    return;
  }

  const body = {
    credits,
    credits_used_this_month: used,
    is_suspended: suspend,
  };
  if (reset) body.last_reset_date = reset;

  if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }
  try {
    const data = await apiPatch(`/api/admin/users/${encodeURIComponent(userId)}`, body);
    if (data.ok) {
      toast("저장 완료", "ok");
      closeModal();
      loadUsers();
    } else {
      toast(data.message || "변경 사항 없음", "");
    }
  } catch (e) {
    toast(e.message || "저장 실패", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "저장"; }
  }
}

// ─── 탭 2: 오류 보고 ───────────────────────────────────────────────────────
const errorsState = {
  limit: 50,
  offset: 0,
  total: 0,
  reports: [],
  loaded: false,
  filter: "",  // '' / '접수' / '처리중' / '완료'
};

async function loadErrors() {
  const content = document.getElementById("errors-content");
  const meta = document.getElementById("errors-meta");
  const errorEl = document.getElementById("errors-error");
  errorEl.innerHTML = "";
  content.innerHTML = `<div class="loading">오류 보고 로딩 중...</div>`;

  const params = new URLSearchParams({
    limit: String(errorsState.limit),
    offset: String(errorsState.offset),
  });
  if (errorsState.filter) params.set("status", errorsState.filter);

  try {
    const data = await apiGet(`/api/admin/error-reports?${params.toString()}`);
    errorsState.reports = data.reports || [];
    errorsState.total = data.total || 0;
    errorsState.loaded = true;
    const start = errorsState.reports.length > 0 ? errorsState.offset + 1 : 0;
    meta.textContent = `총 ${fmtNumber(errorsState.total)}건 (${start}~${errorsState.offset + errorsState.reports.length})`;
    renderErrorsTable();
    renderErrorsPagination();
  } catch (e) {
    content.innerHTML = "";
    errorEl.innerHTML = `<div class="error-banner">${escapeHtml(e.message || "로딩 실패")}</div>`;
  }
}

function statusBadge(status) {
  const cls = status === "접수" ? "report-new"
            : status === "처리중" ? "report-progress"
            : status === "완료" ? "report-done"
            : "";
  return `<span class="status-badge ${cls}">${escapeHtml(status || "-")}</span>`;
}

function renderErrorsTable() {
  const content = document.getElementById("errors-content");
  if (errorsState.reports.length === 0) {
    content.innerHTML = `<div class="empty">오류 보고가 없습니다.</div>`;
    return;
  }
  const rows = errorsState.reports.map((r) => {
    const screenshot = r.screenshot_url
      ? `<a href="${escapeHtml(r.screenshot_url)}" target="_blank" rel="noopener">보기</a>`
      : "-";
    return `
      <tr>
        <td>${fmtDate(r.report_date)}</td>
        <td>${escapeHtml(r.user_email || (r.user_id || "").slice(0, 12) || "-")}</td>
        <td class="err-msg-cell" title="${escapeHtml(r.error_message || "")}">${escapeHtml(r.error_message || "-")}</td>
        <td>${screenshot}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="num">${fmtNumber(r.compensation_credits || 0)}</td>
        <td>${fmtDate(r.updated_at)}</td>
        <td>
          <button class="btn" onclick="openErrorModal('${escapeHtml(r.id)}')">처리</button>
        </td>
      </tr>`;
  }).join("");

  content.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>접수일</th>
            <th>사용자</th>
            <th>오류 메시지</th>
            <th>스크린샷</th>
            <th>상태</th>
            <th class="num">보상 크레딧</th>
            <th>최근 갱신</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderErrorsPagination() {
  const pag = document.getElementById("errors-pagination");
  const total = errorsState.total;
  if (total <= errorsState.limit) {
    pag.style.display = "none";
    return;
  }
  pag.style.display = "flex";
  const page = Math.floor(errorsState.offset / errorsState.limit) + 1;
  const totalPages = Math.ceil(total / errorsState.limit);
  pag.innerHTML = `
    <button onclick="errorsGoPage(${page - 1})" ${page <= 1 ? "disabled" : ""}>← 이전</button>
    <span class="page-info">${page} / ${totalPages} 페이지</span>
    <button onclick="errorsGoPage(${page + 1})" ${page >= totalPages ? "disabled" : ""}>다음 →</button>`;
}

function errorsGoPage(page) {
  if (page < 1) return;
  errorsState.offset = (page - 1) * errorsState.limit;
  loadErrors();
}

function errorsApplyFilter() {
  errorsState.filter = document.getElementById("errors-filter").value;
  errorsState.offset = 0;  // 필터 변경 시 첫 페이지로 영역 영역
  loadErrors();
}

// ─── 오류 보고 처리 모달 ───────────────────────────────────────────────────
function openErrorModal(reportId) {
  const r = errorsState.reports.find((x) => x.id === reportId);
  if (!r) { toast("오류 보고를 찾을 수 없습니다", "error"); return; }

  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
      <div class="modal" style="max-width:680px;">
        <h3>오류 보고 처리</h3>
        <div class="form-row">
          <label>사용자</label>
          <div style="padding:8px 10px; background:#f4f4f7; border-radius:6px; font-size:13px;">
            ${escapeHtml(r.user_email || r.user_id || "-")}
          </div>
        </div>
        <div class="form-row">
          <label>접수일</label>
          <div style="padding:8px 10px; background:#f4f4f7; border-radius:6px; font-size:13px;">
            ${fmtDate(r.report_date)}
          </div>
        </div>
        <div class="form-row">
          <label>오류 메시지 (read-only)</label>
          <textarea readonly style="background:#f4f4f7;">${escapeHtml(r.error_message || "")}</textarea>
        </div>
        ${r.screenshot_url ? `
        <div class="form-row">
          <label>스크린샷</label>
          <a href="${escapeHtml(r.screenshot_url)}" target="_blank" rel="noopener" style="font-size:13px;">${escapeHtml(r.screenshot_url)}</a>
        </div>` : ""}
        <div class="form-row">
          <label>상태</label>
          <select id="m-status">
            <option value="접수" ${r.status === "접수" ? "selected" : ""}>접수</option>
            <option value="처리중" ${r.status === "처리중" ? "selected" : ""}>처리중</option>
            <option value="완료" ${r.status === "완료" ? "selected" : ""}>완료</option>
          </select>
        </div>
        <div class="form-row">
          <label>보상 크레딧 (현재 ${fmtNumber(r.compensation_credits || 0)}) ⚠ 변경 시 사용자 credits 자동 INCREMENT</label>
          <input type="number" id="m-comp" value="${r.compensation_credits || 0}" min="0" />
        </div>
        <div class="form-row">
          <label>메모 (admin 영역 — 사용자 노출 X)</label>
          <textarea id="m-notes">${escapeHtml(r.notes || "")}</textarea>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="closeModal()">취소</button>
          <button class="btn btn-primary" id="error-save-btn" onclick="saveErrorModal('${escapeHtml(reportId)}')">저장</button>
        </div>
      </div>
    </div>`;
  attachEscHandler();
}

async function saveErrorModal(reportId) {
  const btn = document.getElementById("error-save-btn");
  if (btn && btn.disabled) return;  // 중복 클릭 방지

  const status = document.getElementById("m-status").value;
  const comp = Math.max(0, Number(document.getElementById("m-comp").value) || 0);
  const notes = document.getElementById("m-notes").value;

  const body = {
    status,
    compensation_credits: comp,
    notes,
  };

  if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }
  try {
    const data = await apiPatch(`/api/admin/error-reports/${encodeURIComponent(reportId)}`, body);
    if (data.ok) {
      const delta = data.changes && data.changes.user_credits_delta;
      toast(delta ? `저장 완료 (사용자 credits ${delta > 0 ? "+" : ""}${delta})` : "저장 완료", "ok");
      closeModal();
      loadErrors();
    } else {
      toast(data.message || "변경 사항 없음", "");
    }
  } catch (e) {
    toast(e.message || "저장 실패", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "저장"; }
  }
}


// ─── 탭 3: 통계 ────────────────────────────────────────────────────────────
const statsState = {
  loaded: false,
  data: null,
  chartInstance: null,
};

async function loadStats() {
  const content = document.getElementById("stats-content");
  const meta = document.getElementById("stats-meta");
  const errorEl = document.getElementById("stats-error");
  errorEl.innerHTML = "";
  content.innerHTML = `<div class="loading">통계 로딩 중...</div>`;

  try {
    const data = await apiGet("/api/admin/stats/credits");
    statsState.data = data;
    statsState.loaded = true;
    meta.textContent = `최종 갱신: ${new Date().toLocaleString("ko-KR")}`;
    renderStats();
  } catch (e) {
    content.innerHTML = "";
    errorEl.innerHTML = `<div class="error-banner">${escapeHtml(e.message || "로딩 실패")}</div>`;
  }
}

function renderStats() {
  const content = document.getElementById("stats-content");
  const d = statsState.data || {};
  const u = d.users || {};
  const c = d.compensation || {};
  const erStatus = d.error_report_status || {};

  // 카드 4개 (사용자 통계) + 카드 2개 (보상) + 도넛 차트 (오류 보고 상태)
  content.innerHTML = `
    <div class="stats-section-title">사용자 통계</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">전체 사용자 수</div>
        <div class="stat-value">${fmtNumber(u.user_count || 0)}<span class="stat-suffix">명</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">정지된 사용자</div>
        <div class="stat-value" style="color:${(u.suspended_count || 0) > 0 ? 'var(--danger)' : 'inherit'};">
          ${fmtNumber(u.suspended_count || 0)}<span class="stat-suffix">명</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">전체 유료 크레딧 합계</div>
        <div class="stat-value">${fmtNumber(u.total_credits || 0)}<span class="stat-suffix">크레딧</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">이달 사용액 합계</div>
        <div class="stat-value">${fmtNumber(u.total_used_this_month || 0)}<span class="stat-suffix">크레딧</span></div>
      </div>
    </div>

    <div class="stats-section-title">보상 (오류 보고 → 사용자 credits 자동 INCREMENT)</div>
    <div class="stats-grid compensation">
      <div class="stat-card">
        <div class="stat-label">총 보상 크레딧</div>
        <div class="stat-value">${fmtNumber(c.total || 0)}<span class="stat-suffix">크레딧</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">오류 보고 건수</div>
        <div class="stat-value">${fmtNumber(c.report_count || 0)}<span class="stat-suffix">건</span></div>
      </div>
    </div>

    <div class="chart-card">
      <h3>오류 보고 상태 분포</h3>
      <div class="chart-wrap">
        <canvas id="error-status-chart"></canvas>
      </div>
    </div>`;

  renderErrorStatusChart(erStatus);
}

function renderErrorStatusChart(erStatus) {
  const canvas = document.getElementById("error-status-chart");
  if (!canvas || typeof Chart === "undefined") {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js 로드 안 됨");
    }
    return;
  }

  // 이전 차트 instance 영역 → destroy (탭 전환 / 재로드 시 메모리 누수 회피)
  if (statsState.chartInstance) {
    try { statsState.chartInstance.destroy(); } catch {}
    statsState.chartInstance = null;
  }

  const labels = ["접수", "처리중", "완료"];
  const counts = labels.map((l) => erStatus[l] || 0);
  const total = counts.reduce((a, b) => a + b, 0);

  if (total === 0) {
    canvas.parentElement.innerHTML = `<div class="empty">오류 보고가 없습니다.</div>`;
    return;
  }

  const ctx = canvas.getContext("2d");
  statsState.chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: [
          "#fee2c5",  // 접수 — 주황 톤
          "#d1e7ff",  // 처리중 — 파랑 톤
          "#dfd",      // 완료 — 녹색 톤
        ],
        borderColor: [
          "#b65a00",
          "#0050b3",
          "#2a8",
        ],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { padding: 14, font: { size: 13 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const val = ctx.parsed || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return `${label}: ${val}건 (${pct}%)`;
            },
          },
        },
      },
    },
  });
}


// ─── 탭 4: 정책 설정 ───────────────────────────────────────────────────────
const settingsState = {
  loaded: false,
  settings: [],         // [{key, value, updated_at, updated_by}, ...]
  byKey: {},            // {key: {value, updated_at, updated_by}}
  saving: false,        // 중복 클릭 방지
};

// 정책값 영역 라벨 / 단위 매핑 (사용자 영역 영역 영역 영역).
// 신규 정책값 추가 시 영역 영역 영역 영역 영역 fallback (key 그대로 표시).
const POLICY_META = {
  package_price: {
    label: "월 패키지 가격",
    suffix: "원",
    type: "number",
    min: 0,
    desc: "월 정기 결제 영역 사용자 영역 청구 영역 (예: 380000 = 38만원)",
  },
  monthly_proposals: {
    label: "월 제안서 영역",
    suffix: "회",
    type: "number",
    min: 0,
    desc: "월 1회 결제 영역 사용자 영역 영역 ✨ 제안서 생성 영역 (cap)",
  },
  monthly_conversations: {
    label: "월 대화 영역",
    suffix: "회",
    type: "number",
    min: 0,
    desc: "월 1회 결제 영역 사용자 영역 영역 채팅 메시지 영역 (cap)",
  },
};

async function loadSettings() {
  const content = document.getElementById("settings-content");
  const meta = document.getElementById("settings-meta");
  const errorEl = document.getElementById("settings-error");
  errorEl.innerHTML = "";
  content.innerHTML = `<div class="loading">정책 설정 로딩 중...</div>`;

  try {
    const data = await apiGet("/api/admin/settings");
    settingsState.settings = data.settings || [];
    settingsState.byKey = {};
    for (const s of settingsState.settings) {
      settingsState.byKey[s.key] = s;
    }
    settingsState.loaded = true;
    meta.textContent = `${settingsState.settings.length}개 정책`;
    renderSettingsForm();
  } catch (e) {
    content.innerHTML = "";
    errorEl.innerHTML = `<div class="error-banner">${escapeHtml(e.message || "로딩 실패")}</div>`;
  }
}

function renderSettingsForm() {
  const content = document.getElementById("settings-content");
  if (settingsState.settings.length === 0) {
    content.innerHTML = `<div class="empty">정책값이 없습니다.</div>`;
    return;
  }

  // POLICY_META 영역 정의 영역 정책값 우선 + 그 외 영역 fallback 영역
  const ordered = [];
  for (const key of Object.keys(POLICY_META)) {
    if (settingsState.byKey[key]) ordered.push(settingsState.byKey[key]);
  }
  for (const s of settingsState.settings) {
    if (!POLICY_META[s.key]) ordered.push(s);  // 신규 정책 영역 fallback
  }

  const rows = ordered.map((s) => {
    const m = POLICY_META[s.key] || { label: s.key, suffix: "", type: "text", desc: "" };
    const inputAttrs = m.type === "number"
      ? `type="number" min="${m.min ?? 0}"`
      : `type="text"`;
    const updatedInfo = s.updated_at
      ? `최종 갱신 ${escapeHtml(s.updated_at)} ${s.updated_by ? `· ${escapeHtml(s.updated_by)}` : ""}`
      : "초기값";
    return `
      <div class="settings-row">
        <div class="settings-label">
          ${escapeHtml(m.label)}
          <span class="key-id">${escapeHtml(s.key)}</span>
        </div>
        <input ${inputAttrs} id="set-${escapeHtml(s.key)}" value="${escapeHtml(s.value || "")}" />
        <div class="settings-suffix">${escapeHtml(m.suffix)}</div>
        <div class="settings-meta-row">
          ${m.desc ? escapeHtml(m.desc) + " · " : ""}${updatedInfo}
        </div>
      </div>`;
  }).join("");

  content.innerHTML = `
    <div class="settings-form">
      ${rows}
      <div class="settings-actions">
        <button class="btn" onclick="loadSettings()">새로고침</button>
        <button id="settings-save-btn" class="btn btn-primary" onclick="saveSettings()">저장</button>
      </div>
    </div>

    <div class="settings-danger" style="margin-top:24px; background:var(--bg-card); border:1px solid #fcc; border-radius:10px; padding:20px 24px; box-shadow:var(--shadow-sm); max-width:720px;">
      <h3 style="margin:0 0 6px; font-size:15px; color:var(--danger);">⚠ 월간 Quota 리셋 (가입일 기준)</h3>
      <p style="margin:0 0 14px; font-size:13px; color:var(--fg-2);">
        가입일 기준 1개월 경과 사용자만 자동 감지 후 quota 를 초기화합니다.
        예) 5/15 가입자는 6/15·7/15·8/15… 마다 리셋. 프로모션 충전분(bonus)은 함께 소멸.
        매일 1회 호출해도 안전 — 자격 미달 사용자는 자동 스킵.
      </p>
      <button id="reset-quota-btn" class="btn btn-danger" onclick="resetMonthlyQuota()">
        리셋 대상 자동 감지 + 실행
      </button>
      <span id="reset-quota-status" style="margin-left:12px; font-size:12px; color:var(--fg-2);"></span>
    </div>`;
}

// ─── 월간 quota 리셋 (Phase 3 단계 6 — 가입일 기준) ────────────────────────
// 백엔드가 created_at + 1개월 경과 + last_reset_date + 1개월 경과 사용자만 자동 감지.
// 백엔드: POST /api/admin/quota/reset-monthly
async function resetMonthlyQuota() {
  const btn = document.getElementById("reset-quota-btn");
  const statusEl = document.getElementById("reset-quota-status");

  // 2단계 확인 — 실수 방지 (자격 사용자 영향)
  const ok1 = window.confirm(
    "리셋 대상을 자동 감지해 quota 를 초기화할까요?\n\n" +
    "감지 조건:\n" +
    "· 가입 후 1개월 이상 경과\n" +
    "· 직전 리셋 후 1개월 이상 경과 (또는 한 번도 리셋 안 됨)\n\n" +
    "초기화 내용:\n" +
    "· 제안서·대화 잔여 → 정책 기준값\n" +
    "· 프로모션 충전분(bonus) → 0 으로 소멸\n" +
    "· 이달 사용 누적 → 0 으로 초기화\n\n" +
    "되돌릴 수 없습니다."
  );
  if (!ok1) return;

  const ok2 = window.confirm("최종 확인 — 계속할까요?");
  if (!ok2) return;

  if (btn) { btn.disabled = true; btn.textContent = "리셋 중..."; }
  if (statusEl) statusEl.textContent = "";

  try {
    const data = await apiPost("/api/admin/quota/reset-monthly");
    if (data.ok) {
      const n = data.users_affected || 0;
      const msg = n === 0
        ? `리셋 대상 없음 — 가입/직전 리셋 후 1개월 미경과 (${data.reset_date} 기준)`
        : `리셋 완료 — ${n}명 ` +
          `(제안서 ${data.proposal_base}회 / 대화 ${data.conversation_base}회 · ${data.reset_date})`;
      toast(msg, "ok");
      if (statusEl) statusEl.textContent = msg;
      // 캐시 무효화 — Quota 현황 / 리셋 로그 탭 다음 진입 시 재로드
      try { _invalidateQuotaCaches(); } catch {}
    } else {
      toast(data.message || "리셋 실패", "error");
    }
  } catch (e) {
    toast(e.message || "리셋 실패", "error");
    if (statusEl) statusEl.textContent = `오류: ${e.message || ""}`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "리셋 대상 자동 감지 + 실행"; }
  }
}

async function saveSettings() {
  if (settingsState.saving) return;  // 중복 클릭 방지
  const btn = document.getElementById("settings-save-btn");

  // 변경된 값만 영역 영역
  const updates = {};
  let changed = 0;
  for (const s of settingsState.settings) {
    const input = document.getElementById(`set-${s.key}`);
    if (!input) continue;
    const newVal = String(input.value);
    if (newVal !== String(s.value || "")) {
      updates[s.key] = newVal;
      changed++;
    }
  }

  if (changed === 0) {
    toast("변경 사항이 없습니다", "");
    return;
  }

  settingsState.saving = true;
  if (btn) { btn.disabled = true; btn.textContent = "저장 중..."; }

  try {
    const data = await apiPatch("/api/admin/settings", { updates });
    if (data.ok) {
      toast(`${data.changes}개 정책 저장 완료`, "ok");
      await loadSettings();
    } else {
      toast(data.message || "변경 사항 없음", "");
    }
  } catch (e) {
    toast(e.message || "저장 실패", "error");
  } finally {
    settingsState.saving = false;
    if (btn) { btn.disabled = false; btn.textContent = "저장"; }
  }
}


// ─── 탭 5: Quota 현황 ─────────────────────────────────────────────────────
const quotaState = {
  loaded: false,
  limit: 50,
  offset: 0,
  total: 0,
  users: [],
  policy: { proposal_base: 0, conversation_base: 0 },
};

async function loadQuota() {
  const content = document.getElementById("quota-content");
  const meta = document.getElementById("quota-meta");
  const errorEl = document.getElementById("quota-error");
  errorEl.innerHTML = "";
  content.innerHTML = `<div class="loading">Quota 현황 로딩 중...</div>`;

  try {
    const data = await apiGet(
      `/api/admin/quota/status?limit=${quotaState.limit}&offset=${quotaState.offset}`
    );
    quotaState.users = data.users || [];
    quotaState.total = data.total || 0;
    quotaState.policy = data.policy || quotaState.policy;
    quotaState.loaded = true;
    const start = quotaState.offset + 1;
    const end = quotaState.offset + quotaState.users.length;
    meta.textContent = `총 ${fmtNumber(quotaState.total)}명 (${start}~${end}) · 정책 기본값 제안서 ${quotaState.policy.proposal_base} / 대화 ${quotaState.policy.conversation_base}`;
    renderQuotaTable();
    renderQuotaPagination();
  } catch (e) {
    content.innerHTML = "";
    errorEl.innerHTML = `<div class="error-banner">${escapeHtml(e.message || "로딩 실패")}</div>`;
  }
}

// 진행률 → 색상 클래스 (사용량 % 기준).
//   used 0~50% 녹색 / 50~80% 주황 / 80%+ 빨강
function _quotaBarClass(usedPct) {
  if (usedPct >= 80) return "danger";
  if (usedPct >= 50) return "warn";
  return "";
}

function _quotaCell(remaining, total, used) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const cls = _quotaBarClass(pct);
  return `
    <div class="quota-cell">
      <span class="quota-text">${fmtNumber(remaining)}/${fmtNumber(total)}</span>
      <div class="quota-bar" title="사용 ${used}/${total} (${pct}%)">
        <div class="quota-bar-fill ${cls}" style="width:${pct}%"></div>
      </div>
      <span class="quota-pct">${pct}%</span>
    </div>`;
}

function renderQuotaTable() {
  const content = document.getElementById("quota-content");
  if (quotaState.users.length === 0) {
    content.innerHTML = `<div class="empty">사용자가 없습니다.</div>`;
    return;
  }
  const rows = quotaState.users.map((u) => {
    const propCell = _quotaCell(u.proposal_remaining, u.proposal_total, u.proposal_used);
    const convCell = _quotaCell(u.conversation_remaining, u.conversation_total, u.conversation_used);
    const propBonus = u.proposal_bonus > 0
      ? `<span class="status-badge admin" title="프로모션 충전">+${u.proposal_bonus}</span>` : "";
    const convBonus = u.conversation_bonus > 0
      ? `<span class="status-badge admin" title="프로모션 충전">+${u.conversation_bonus}</span>` : "";
    return `
      <tr>
        <td>${escapeHtml(u.email || "-")}</td>
        <td>${propCell} ${propBonus}</td>
        <td>${convCell} ${convBonus}</td>
        <td>${fmtDate(u.last_reset_date) || "-"}</td>
        <td>${fmtDate(u.created_at) || "-"}</td>
      </tr>`;
  }).join("");

  content.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>이메일</th>
            <th>제안서 (남음/전체)</th>
            <th>대화 (남음/전체)</th>
            <th>마지막 리셋</th>
            <th>가입일</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderQuotaPagination() {
  const pag = document.getElementById("quota-pagination");
  const totalPages = Math.ceil(quotaState.total / quotaState.limit);
  if (totalPages <= 1) { pag.style.display = "none"; return; }
  const curPage = Math.floor(quotaState.offset / quotaState.limit) + 1;
  pag.style.display = "flex";
  pag.innerHTML = `
    <button onclick="quotaGoToPage(${curPage - 1})" ${curPage <= 1 ? "disabled" : ""}>이전</button>
    <span class="page-info">${curPage} / ${totalPages}</span>
    <button onclick="quotaGoToPage(${curPage + 1})" ${curPage >= totalPages ? "disabled" : ""}>다음</button>
  `;
}

function quotaGoToPage(page) {
  const totalPages = Math.ceil(quotaState.total / quotaState.limit);
  if (page < 1 || page > totalPages) return;
  quotaState.offset = (page - 1) * quotaState.limit;
  loadQuota();
}


// ─── 탭 6: 리셋 로그 ──────────────────────────────────────────────────────
// admin_audit_log 의 quota_reset_monthly action 만 필터링.
const resetlogState = {
  loaded: false,
  limit: 50,
  offset: 0,
  total: 0,
  logs: [],
};

async function loadResetlog() {
  const content = document.getElementById("resetlog-content");
  const meta = document.getElementById("resetlog-meta");
  const errorEl = document.getElementById("resetlog-error");
  errorEl.innerHTML = "";
  content.innerHTML = `<div class="loading">리셋 로그 로딩 중...</div>`;

  try {
    const url = `/api/admin/audit-log?action=quota_reset_monthly&limit=${resetlogState.limit}&offset=${resetlogState.offset}`;
    const data = await apiGet(url);
    resetlogState.logs = data.logs || [];
    resetlogState.total = data.total || 0;
    resetlogState.loaded = true;
    const start = resetlogState.offset + 1;
    const end = resetlogState.offset + resetlogState.logs.length;
    meta.textContent = resetlogState.total > 0
      ? `총 ${fmtNumber(resetlogState.total)}건 (${start}~${end})`
      : "기록 없음";
    renderResetlogTable();
    renderResetlogPagination();
  } catch (e) {
    content.innerHTML = "";
    errorEl.innerHTML = `<div class="error-banner">${escapeHtml(e.message || "로딩 실패")}</div>`;
  }
}

function renderResetlogTable() {
  const content = document.getElementById("resetlog-content");
  if (resetlogState.logs.length === 0) {
    content.innerHTML = `<div class="empty">리셋 기록이 없습니다.</div>`;
    return;
  }
  const rows = resetlogState.logs.map((log) => {
    // payload 는 백엔드에서 JSON 문자열. 파싱 실패 시 raw 표시.
    let payload = {};
    try {
      payload = typeof log.payload === "string" ? JSON.parse(log.payload) : (log.payload || {});
    } catch { payload = {}; }
    const usersAffected = payload.users_affected != null ? payload.users_affected : "-";
    const propBase = payload.proposal_base != null ? payload.proposal_base : "-";
    const convBase = payload.conversation_base != null ? payload.conversation_base : "-";
    const trig = payload.trigger || "manual";  // 구버전 로그는 trigger 필드 없음 — manual 추정
    const trigBadge = trig === "auto"
      ? `<span class="status-badge admin" title="APScheduler 매일 00:00 KST 자동 실행">🤖 자동</span>`
      : `<span class="status-badge active" title="어드민 수동 트리거">👤 수동</span>`;
    const executor = trig === "auto"
      ? `<span style="color:var(--fg-2); font-style:italic;">scheduler</span>`
      : escapeHtml(log.admin_email || "-");
    const sample = Array.isArray(payload.user_ids_sample) && payload.user_ids_sample.length
      ? `<span class="log-payload" title="${escapeHtml(payload.user_ids_sample.join(', '))}">${payload.user_ids_sample.length}개 sample</span>`
      : "-";
    return `
      <tr>
        <td>${escapeHtml(log.created_at || "-")}</td>
        <td>${trigBadge}</td>
        <td class="num">${escapeHtml(String(usersAffected))}명</td>
        <td class="num">${escapeHtml(String(propBase))}</td>
        <td class="num">${escapeHtml(String(convBase))}</td>
        <td>${executor}</td>
        <td>${sample}</td>
      </tr>`;
  }).join("");

  content.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>실행 시간</th>
            <th>트리거</th>
            <th>리셋 대상</th>
            <th>제안서 기본값</th>
            <th>대화 기본값</th>
            <th>실행자</th>
            <th>대상 사용자 sample</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderResetlogPagination() {
  const pag = document.getElementById("resetlog-pagination");
  const totalPages = Math.ceil(resetlogState.total / resetlogState.limit);
  if (totalPages <= 1) { pag.style.display = "none"; return; }
  const curPage = Math.floor(resetlogState.offset / resetlogState.limit) + 1;
  pag.style.display = "flex";
  pag.innerHTML = `
    <button onclick="resetlogGoToPage(${curPage - 1})" ${curPage <= 1 ? "disabled" : ""}>이전</button>
    <span class="page-info">${curPage} / ${totalPages}</span>
    <button onclick="resetlogGoToPage(${curPage + 1})" ${curPage >= totalPages ? "disabled" : ""}>다음</button>
  `;
}

function resetlogGoToPage(page) {
  const totalPages = Math.ceil(resetlogState.total / resetlogState.limit);
  if (page < 1 || page > totalPages) return;
  resetlogState.offset = (page - 1) * resetlogState.limit;
  loadResetlog();
}

// 리셋 직후 캐시 무효화 — resetMonthlyQuota() 가 성공하면 quota / resetlog 갱신
function _invalidateQuotaCaches() {
  quotaState.loaded = false;
  resetlogState.loaded = false;
}


// ─── 초기화 ────────────────────────────────────────────────────────────────
async function init() {
  setupTabs();
  const ok = await loadCurrentUser();
  if (!ok) return;
  loadUsers();
}

document.addEventListener("DOMContentLoaded", init);
