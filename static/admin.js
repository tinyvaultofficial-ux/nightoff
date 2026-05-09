// NightOff Admin Dashboard — 단계 3-A (skeleton + 탭 1 사용자 관리)
// 인증: localStorage.token (JWT) → fetch /api/admin/* Authorization: Bearer
// 401 → /login redirect / 403 → 권한 X 안내 / 200 → 데이터 렌더

// ─── Auth helpers ──────────────────────────────────────────────────────────
const TOKEN_KEY = "nightoff_token";

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
async function loadCurrentUser() {
  try {
    const data = await apiGet("/api/auth/me");
    if (data.role !== "admin") {
      document.body.innerHTML = `
        <div style="padding:60px; text-align:center;">
          <h2 style="color:#c43;">관리자 권한이 필요합니다</h2>
          <p>현재 계정 (${escapeHtml(data.email)})은 일반 사용자입니다.</p>
          <p style="margin-top:20px;">
            <a href="/" style="color:#6b46e5;">메인 페이지로 돌아가기</a>
          </p>
        </div>`;
      return false;
    }
    document.getElementById("admin-email").textContent = data.email;
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
      // 탭 전환 시 데이터 로드 (cache 영역 없으면)
      if (tab === "users" && !usersState.loaded) loadUsers();
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
  const rows = usersState.users.map((u) => `
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
      <td class="num">${fmtNumber(u.credits || 0)}</td>
      <td class="num">${fmtNumber(u.credits_used_this_month || 0)}</td>
      <td class="num" title="무료 크레딧 (퀴즈/로또/운세)">${fmtNumber(u.credit_count || 0)}</td>
      <td>${fmtDate(u.last_reset_date)}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>
        <button class="btn" onclick="openUserModal('${escapeHtml(u.id)}')">수정</button>
      </td>
    </tr>
  `).join("");

  content.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>이메일</th>
          <th>회사</th>
          <th>역할</th>
          <th>상태</th>
          <th class="num">유료 크레딧</th>
          <th class="num">이달 사용</th>
          <th class="num">무료 크레딧</th>
          <th>리셋일</th>
          <th>가입일</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
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
          <input type="text" id="m-reset" value="${escapeHtml(u.last_reset_date || "")}" placeholder="2026-05-01" />
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
          <button class="btn btn-primary" onclick="saveUserModal('${escapeHtml(userId)}')">저장</button>
        </div>
      </div>
    </div>`;
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

async function saveUserModal(userId) {
  const credits = Number(document.getElementById("m-credits").value);
  const used = Number(document.getElementById("m-used").value);
  const reset = document.getElementById("m-reset").value.trim();
  const suspend = Number(document.getElementById("m-suspend").value);

  const body = {
    credits,
    credits_used_this_month: used,
    is_suspended: suspend,
  };
  if (reset) body.last_reset_date = reset;

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
  }
}

// ─── 초기화 ────────────────────────────────────────────────────────────────
async function init() {
  setupTabs();
  const ok = await loadCurrentUser();
  if (!ok) return;
  loadUsers();
}

document.addEventListener("DOMContentLoaded", init);
