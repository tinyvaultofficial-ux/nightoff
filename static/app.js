/**
 * BidPick Frontend — Preact + htm (no build step)
 * Model: claude-sonnet-4-5 | Backend: FastAPI + SQLite
 */
import { h, render } from 'https://esm.sh/preact@10.22.0';
import { useState, useEffect, useRef, useCallback } from 'https://esm.sh/preact@10.22.0/hooks';
import { html } from 'https://esm.sh/htm@3.1.1/preact';

// ─────────────────────────────────────────────
// API Layer
// ─────────────────────────────────────────────
const api = {
  // Settings
  getSettings: () => fetch('/api/settings').then(r => r.json()),
  saveSettings: (data) => fetch('/api/settings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  }).then(r => r.json()),

  // Dashboard
  getDashboard: () => fetch('/api/dashboard').then(r => r.json()),

  // Clients
  getClients: () => fetch('/api/clients').then(r => r.json()),
  createClient: (body) => fetch('/api/clients', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
  getClient: (id) => fetch(`/api/clients/${id}`).then(r => r.json()),
  updateClient: (id, body) => fetch(`/api/clients/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
  deleteClient: (id) => fetch(`/api/clients/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Conversations
  getConversations: (clientId) => fetch(`/api/clients/${clientId}/conversations`).then(r => r.json()),
  createConversation: (clientId, body) => fetch(`/api/clients/${clientId}/conversations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
  getConversation: (convId) => fetch(`/api/conversations/${convId}`).then(r => r.json()),
  deleteConversation: (convId) => fetch(`/api/conversations/${convId}`, { method: 'DELETE' }).then(r => r.json()),
  endConversation: (convId) => fetch(`/api/conversations/${convId}/end`, { method: 'POST' }).then(r => r.json()),

  // Messages (returns raw Response for SSE)
  sendMessage: (convId, body) => fetch(`/api/conversations/${convId}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),

  // References
  getReferences: (clientId) => fetch(`/api/clients/${clientId}/references`).then(r => r.json()),
  uploadReference: (clientId, file, memo = '') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('memo', memo);
    return fetch(`/api/clients/${clientId}/references`, { method: 'POST', body: fd }).then(r => r.json());
  },
  analyzeReference: (refId) => fetch(`/api/references/${refId}/analyze`, { method: 'POST' }),
  deleteReference: (refId) => fetch(`/api/references/${refId}`, { method: 'DELETE' }).then(r => r.json()),

  // RFP
  uploadRfp: (clientId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`/api/clients/${clientId}/rfp`, { method: 'POST', body: fd }).then(r => r.json());
  },
  deleteRfp: (clientId) => fetch(`/api/clients/${clientId}/rfp`, { method: 'DELETE' }).then(r => r.json()),

  // Competitor
  analyzeCompetitor: (clientId, companies) => fetch(`/api/clients/${clientId}/competitor/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companies }),
  }),
  updateCompetitor: (clientId, competitor_analysis) => fetch(`/api/clients/${clientId}/competitor`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competitor_analysis }),
  }).then(r => r.json()),
};

// ─────────────────────────────────────────────
// SSE stream reader
// Reads Server-Sent Events from a fetch Response, calls onEvent per parsed event
// ─────────────────────────────────────────────
async function readSSE(response, onEvent) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') return;
      try { onEvent(JSON.parse(raw)); } catch { /* ignore malformed */ }
    }
  }
}

// ─────────────────────────────────────────────
// Router (hash-based)
// ─────────────────────────────────────────────
function parseRoute(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';
  let m;
  m = path.match(/^\/clients\/([^/]+)\/conversations\/([^/]+)$/);
  if (m) return { page: 'conversation', clientId: m[1], convId: m[2] };
  m = path.match(/^\/clients\/([^/]+)$/);
  if (m) return { page: 'client', clientId: m[1] };
  if (path === '/settings') return { page: 'settings' };
  return { page: 'clients' };
}

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const h = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

function navigate(path) { location.hash = path; }

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d;
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function avatarLetter(name) { return name ? name[0] : '?'; }

const PALETTE = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777'];
function avatarColor(name) {
  if (!name) return PALETTE[0];
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}

function extractHtmlBlock(text) {
  if (!text) return null;
  const m = text.match(/```html\s*([\s\S]*?)(?:```|$)/i);
  return m ? m[1] : null;
}

function extractImgKeywords(htmlStr) {
  if (!htmlStr) return [];
  const matches = htmlStr.match(/이미지 검색 키워드[：:]\s*([^\n<]+)/g);
  if (!matches) return [];
  const all = [];
  for (const line of matches) {
    const kws = line
      .replace(/이미지 검색 키워드[：:]\s*/, '')
      .split(/[,，、]/)
      .map(k => k.trim())
      .filter(Boolean);
    all.push(...kws);
  }
  return [...new Set(all)];
}

function extractProgressivePages(accum) {
  const cm = accum.match(/```html\s*/i);
  if (!cm) return null;
  const content = accum.slice(cm.index + cm[0].length).replace(/```\s*$/, '');
  const starts = [];
  const re = /<div[^>]+class="a4-page"/g;
  let m;
  while ((m = re.exec(content)) !== null) starts.push(m.index);
  if (starts.length === 0) return { preamble: content, completed: [], inProgress: '', count: 0 };
  const preamble = content.slice(0, starts[0]);
  const completed = [];
  for (let i = 0; i < starts.length - 1; i++) completed.push(content.slice(starts[i], starts[i + 1]));
  return { preamble, completed, inProgress: content.slice(starts[starts.length - 1]), count: starts.length };
}

function buildPreviewDoc(preamble, completed, inProgress) {
  const body = preamble + completed.join('') + (inProgress || '');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f0f0f0;padding:20px;font-family:'SUIT',sans-serif}
.a4-page{background:#fff;margin:0 auto 16px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
</style></head><body>${body}</body></html>`;
}

// ─────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────
function Spinner({ size = 20 }) {
  const s = size + 'px';
  const b = Math.max(2, Math.round(size / 8)) + 'px';
  return html`<div class="spinner" style=${{ width: s, height: s, borderWidth: b }}></div>`;
}

// ─────────────────────────────────────────────
// Dashboard Stat Card
// ─────────────────────────────────────────────
function DashCard({ icon, value, label, sub }) {
  return html`
    <div class="dash-card">
      <div class="dash-icon">${icon}</div>
      <div class="dash-value">${value}</div>
      <div class="dash-label">${label}</div>
      ${sub && html`<div class="dash-sub">${sub}</div>`}
    </div>
  `;
}

// ─────────────────────────────────────────────
// ProgressiveIframe — updates srcdoc in-place (no recreation, no flicker)
// ─────────────────────────────────────────────
function ProgressiveIframe({ doc }) {
  const iRef = useRef(null);
  useEffect(() => {
    if (!iRef.current || !doc) return;
    iRef.current.srcdoc = doc;
  }, [doc]);
  return html`<iframe
    ref=${iRef}
    class="html-preview-iframe a4"
    srcdoc=${doc || ''}
    sandbox="allow-same-origin"
    style="width:100%;border:none;"
  />`;
}

// ─────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────
function Sidebar({ route, recentClients }) {
  return html`
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect width="22" height="22" rx="6" fill="#7c3aed"/>
            <path d="M6 7h10M6 11h7M6 15h9" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          <span>BidPick</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <a class=${'sidebar-link' + (route.page === 'clients' ? ' active' : '')}
          href="#/"
          onclick=${e => { e.preventDefault(); navigate('/'); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          클라이언트
        </a>
      </nav>

      ${recentClients && recentClients.length > 0 && html`
        <div class="sidebar-recent">
          <div class="sidebar-section-label">최근 클라이언트</div>
          ${recentClients.slice(0, 5).map(c => html`
            <a key=${c.id}
              class=${'sidebar-link' + (route.clientId === c.id ? ' active' : '')}
              href=${'#/clients/' + c.id}
              onclick=${e => { e.preventDefault(); navigate('/clients/' + c.id); }}>
              <span class="sidebar-dot" style=${{ background: avatarColor(c.name) }}></span>
              ${c.name}
            </a>
          `)}
        </div>
      `}

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="sidebar-avatar">B</div>
          <div class="sidebar-user-info">
            <span class="sidebar-user-name">BidPick</span>
            <span class="sidebar-user-role">제안 전문가</span>
          </div>
          <button class="sidebar-settings-btn" title="설정"
            onclick=${() => navigate('/settings')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  `;
}

// ─────────────────────────────────────────────
// Settings Page
// ─────────────────────────────────────────────
function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    api.getSettings()
      .then(d => alive && setApiKey(d.api_key || ''))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const save = async () => {
    if (!apiKey.trim()) { setErr('API 키를 입력하세요'); return; }
    setErr(''); setSaving(true);
    try {
      await api.saveSettings({ api_key: apiKey.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setErr('저장 실패'); }
    setSaving(false);
  };

  return html`
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">설정</h1>
      </div>
      <div class="card" style="max-width:520px">
        <div class="card-body">
          <div class="section-title" style="margin-bottom:6px">Anthropic API 키</div>
          <div style="font-size:13px;color:#888;margin-bottom:16px">
            Claude API 키를 입력하세요. 환경변수 ANTHROPIC_API_KEY가 설정된 경우 생략 가능합니다.
          </div>
          ${err && html`<div class="alert alert-danger" style="margin-bottom:12px">${err}</div>`}
          ${loading
            ? html`<${Spinner}/>`
            : html`
              <input class="form-input" type="password" placeholder="sk-ant-..." value=${apiKey}
                onInput=${e => setApiKey(e.target.value)}
                onKeydown=${e => e.key === 'Enter' && save()}
                style="width:100%;margin-bottom:12px" />
              <div style="display:flex;justify-content:flex-end;gap:8px;align-items:center">
                ${saved && html`<span style="font-size:13px;color:#059669;font-weight:500">✓ 저장됨</span>`}
                <button class="btn btn-primary" onclick=${save} disabled=${saving}>
                  ${saving ? html`<${Spinner} size=${16}/>` : '저장'}
                </button>
              </div>
            `}
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Client List Page
// ─────────────────────────────────────────────
function ClientListPage() {
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([api.getClients(), api.getDashboard()])
      .then(([cl, st]) => { if (!alive) return; setClients(cl); setStats(st); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const createClient = async () => {
    if (!form.name.trim()) { setErr('클라이언트명을 입력하세요'); return; }
    setErr(''); setCreating(true);
    try {
      const c = await api.createClient({
        name: form.name.trim(),
        company: form.company.trim(),
        description: form.description.trim(),
      });
      setClients(prev => [c, ...prev]);
      setForm({ name: '', company: '', description: '' });
      setShowNew(false);
    } catch { setErr('생성 실패'); }
    setCreating(false);
  };

  const deleteClient = async (id, e) => {
    e.stopPropagation();
    if (!confirm('클라이언트를 삭제하시겠습니까?\n모든 대화, 레퍼런스, RFP가 함께 삭제됩니다.')) return;
    await api.deleteClient(id).catch(() => {});
    setClients(prev => prev.filter(c => c.id !== id));
  };

  return html`
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">클라이언트</h1>
          <p class="page-sub">AI 기반 제안서 작성 전문 플랫폼</p>
        </div>
        <button class="btn btn-primary" onclick=${() => setShowNew(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          새 클라이언트
        </button>
      </div>

      <!-- 대시보드 통계 카드 -->
      <div class="dashboard-stats">
        <${DashCard} icon="📋" value=${stats ? stats.active_proposals : '—'} label="진행중인 제안" sub="활성 대화 기준"/>
        <${DashCard} icon="👥" value=${stats ? stats.total_clients : '—'} label="전체 클라이언트" sub="관리 중인 고객사"/>
        <${DashCard} icon="💬" value=${stats ? stats.this_month_conversations : '—'} label="이달 대화" sub="이번 달 기준"/>
        <${DashCard} icon="🤖" value="AI" label="자동 제안 생성" sub="claude-sonnet-4-5"/>
      </div>

      ${showNew && html`
        <div class="card" style="margin-bottom:24px">
          <div class="card-body">
            <div class="section-title" style="margin-bottom:14px">새 클라이언트</div>
            ${err && html`<div class="alert alert-danger" style="margin-bottom:12px">${err}</div>`}
            <div style="display:flex;flex-direction:column;gap:10px">
              <input class="form-input" placeholder="클라이언트명 *" value=${form.name}
                onInput=${e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeydown=${e => e.key === 'Enter' && createClient()} autofocus />
              <input class="form-input" placeholder="회사명 (선택)" value=${form.company}
                onInput=${e => setForm(f => ({ ...f, company: e.target.value }))} />
              <textarea class="form-input" placeholder="메모 (선택)" value=${form.description}
                onInput=${e => setForm(f => ({ ...f, description: e.target.value }))}
                style="min-height:64px;resize:vertical"></textarea>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
              <button class="btn btn-ghost" onclick=${() => { setShowNew(false); setErr(''); }}>취소</button>
              <button class="btn btn-primary" onclick=${createClient} disabled=${creating}>
                ${creating ? html`<${Spinner} size=${16}/>` : '추가'}
              </button>
            </div>
          </div>
        </div>
      `}

      ${loading
        ? html`<div style="text-align:center;padding:80px"><${Spinner} size=${32}/></div>`
        : clients.length === 0
          ? html`
            <div class="empty-state">
              <div class="empty-icon">🏢</div>
              <div class="empty-title">클라이언트가 없습니다</div>
              <div class="empty-sub">새 클라이언트를 추가하여 제안 업무를 시작하세요</div>
              <button class="btn btn-primary" style="margin-top:20px" onclick=${() => setShowNew(true)}>
                첫 클라이언트 추가
              </button>
            </div>`
          : html`
            <div class="client-grid">
              ${clients.map(c => html`
                <div class="client-card" key=${c.id} onclick=${() => navigate('/clients/' + c.id)}>
                  <div class="client-card-top">
                    <div class="client-avatar" style=${{ background: avatarColor(c.name) }}>
                      ${avatarLetter(c.name)}
                    </div>
                    <button class="conv-delete-btn" onclick=${e => deleteClient(c.id, e)} title="삭제">✕</button>
                  </div>
                  <div class="client-name">${c.name}</div>
                  ${c.company && html`<div class="client-company">${c.company}</div>`}
                  <div class="client-meta">
                    <span>${c.conversation_count || 0}개 대화</span>
                    <span>${fmtDate(c.last_conversation_at || c.updated_at)}</span>
                  </div>
                </div>
              `)}
            </div>
          `}
    </div>
  `;
}

// ─────────────────────────────────────────────
// Conversation List Tab
// ─────────────────────────────────────────────
function ConvListTab({ clientId }) {
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getConversations(clientId)
      .then(r => alive && setConvs(r))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [clientId]);

  const create = async () => {
    setCreating(true);
    try {
      const c = await api.createConversation(clientId, { title: title.trim() || '새 대화' });
      navigate(`/clients/${clientId}/conversations/${c.id}`);
    } catch { setCreating(false); }
  };

  const del = async (id, e) => {
    e.stopPropagation();
    if (!confirm('이 대화를 삭제하시겠습니까?')) return;
    await api.deleteConversation(id).catch(() => {});
    setConvs(prev => prev.filter(c => c.id !== id));
  };

  return html`
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" onclick=${() => setShowNew(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          새 대화
        </button>
      </div>

      ${showNew && html`
        <div class="card" style="margin-bottom:16px">
          <div class="card-body">
            <input class="form-input" placeholder="대화 제목 (선택)" value=${title}
              onInput=${e => setTitle(e.target.value)}
              onKeydown=${e => e.key === 'Enter' && !creating && create()}
              autofocus style="width:100%;margin-bottom:10px" />
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-ghost" onclick=${() => setShowNew(false)}>취소</button>
              <button class="btn btn-primary" onclick=${create} disabled=${creating}>
                ${creating ? html`<${Spinner} size=${16}/>` : '시작'}
              </button>
            </div>
          </div>
        </div>
      `}

      ${loading
        ? html`<${Spinner}/>`
        : convs.length === 0
          ? html`<div class="empty-state" style="padding:32px">대화가 없습니다</div>`
          : html`
            <div class="conv-list">
              ${convs.map(c => html`
                <div class="conv-item" key=${c.id}
                  onclick=${() => navigate(`/clients/${clientId}/conversations/${c.id}`)}>
                  <div class="conv-item-body">
                    <div class="conv-item-title">${c.title}</div>
                    <div class="conv-item-meta">
                      메시지 ${c.message_count || 0}개 · ${fmtDate(c.created_at)}
                      ${c.ended_at ? html`<span class="badge" style="margin-left:6px;background:#e5e7eb;color:#6b7280;font-size:10px;padding:1px 6px;border-radius:4px">종료</span>` : ''}
                    </div>
                  </div>
                  <button class="conv-delete-btn" onclick=${e => del(c.id, e)} title="삭제">✕</button>
                </div>
              `)}
            </div>
          `}
    </div>
  `;
}

// ─────────────────────────────────────────────
// Reference Library Tab
// ─────────────────────────────────────────────
function RefLibTab({ clientId }) {
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState({});
  const [streamTexts, setStreamTexts] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api.getReferences(clientId)
      .then(r => alive && setRefs(r))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [clientId]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const ref = await api.uploadReference(clientId, file);
      setRefs(prev => [ref, ...prev]);
      analyze(ref.id);
    } catch { alert('업로드 실패'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const analyze = async (refId) => {
    setAnalyzing(prev => ({ ...prev, [refId]: true }));
    setStreamTexts(prev => ({ ...prev, [refId]: '' }));
    let acc = '';
    try {
      const res = await api.analyzeReference(refId);
      if (!res.body) throw new Error();
      await readSSE(res, ev => {
        if (ev.type === 'text') {
          acc += ev.text;
          setStreamTexts(prev => ({ ...prev, [refId]: acc }));
        }
        if (ev.type === 'done') {
          setRefs(prev => prev.map(r => r.id === refId ? { ...r, analysis: acc } : r));
        }
      });
    } catch { /* ignore */ }
    setAnalyzing(prev => ({ ...prev, [refId]: false }));
  };

  const del = async (id) => {
    if (!confirm('이 레퍼런스를 삭제하시겠습니까?')) return;
    await api.deleteReference(id).catch(() => {});
    setRefs(prev => prev.filter(r => r.id !== id));
  };

  return html`
    <div>
      <!-- 레퍼런스 라이브러리 설명 -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:14px 18px;background:var(--primary-dim);border-radius:var(--r);border:1px solid rgba(124,58,237,0.15)">
        <span style="font-size:22px">✨</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--primary)">올려두면 AI가 알아서 참고해요</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px">파일을 업로드하면 AI가 자동 분석하고, 새 대화 시 컨텍스트로 자동 포함됩니다</div>
        </div>
      </div>

      <div class="rfp-dropzone"
        onclick=${() => fileRef.current?.click()}
        ondragover=${e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
        ondragleave=${e => e.currentTarget.classList.remove('drag-over')}
        ondrop=${e => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-over');
          upload(e.dataTransfer.files[0]);
        }}>
        ${uploading
          ? html`<${Spinner} size=${28}/>`
          : html`
            <div class="rfp-dropzone-icon">📄</div>
            <div class="rfp-dropzone-text">클릭하거나 파일을 드래그하여 업로드</div>
            <div class="rfp-dropzone-sub">PDF, DOCX, TXT, PPTX 지원 · AI가 자동으로 분석합니다</div>
          `}
      </div>
      <input ref=${fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.pptx"
        style="display:none" onchange=${e => upload(e.target.files[0])} />

      ${loading
        ? html`<${Spinner}/>`
        : refs.length === 0
          ? html`<div class="empty-state" style="padding:32px">레퍼런스가 없습니다</div>`
          : html`
            <div class="ref-list">
              ${refs.map(ref => {
                const isAnalyzing = !!analyzing[ref.id];
                const streamTxt = streamTexts[ref.id] || '';
                const analysis = isAnalyzing ? streamTxt : (ref.analysis || '');
                return html`
                  <div class="ref-item" key=${ref.id}>
                    <div class="ref-item-header">
                      <div style="display:flex;align-items:center;gap:10px">
                        <span style="font-size:22px">📄</span>
                        <div>
                          <div style="font-weight:600;font-size:14px">${ref.filename}</div>
                          <div style="font-size:12px;color:#888">${fmtDate(ref.created_at)}</div>
                        </div>
                      </div>
                      <div style="display:flex;gap:6px">
                        ${!ref.analysis && !isAnalyzing && html`
                          <button class="btn btn-ghost btn-sm" onclick=${() => analyze(ref.id)}>AI 분석</button>
                        `}
                        <button class="btn btn-ghost btn-sm" onclick=${() => del(ref.id)}>삭제</button>
                      </div>
                    </div>
                    ${(isAnalyzing || analysis) && html`
                      <div class="ref-analysis">
                        <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">
                          ${isAnalyzing ? 'AI 분석 중...' : 'AI 분석'}
                        </div>
                        <div style="font-size:13px;line-height:1.6;white-space:pre-wrap">
                          ${analysis}${isAnalyzing ? html`<span class="typing-dot"/>` : ''}
                        </div>
                      </div>
                    `}
                  </div>
                `;
              })}
            </div>
          `}
    </div>
  `;
}

// ─────────────────────────────────────────────
// RFP Tab
// ─────────────────────────────────────────────
function RfpTab({ client, onClientUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const rfpRaw = client.rfp_analysis || '';
  let rfp = null;
  try { rfp = rfpRaw ? JSON.parse(rfpRaw) : null; } catch {}

  const upload = async (file) => {
    if (!file) return;
    setUploading(true); setErr('');
    try {
      const updated = await api.uploadRfp(client.id, file);
      onClientUpdate(updated);
    } catch { setErr('RFP 업로드/분석 실패'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const del = async () => {
    if (!confirm('RFP를 삭제하시겠습니까?')) return;
    await api.deleteRfp(client.id).catch(() => {});
    onClientUpdate({ ...client, rfp_analysis: '', rfp_filename: '', rfp_uploaded_at: null });
  };

  return html`
    <div>
      <div class="rfp-dropzone"
        onclick=${() => fileRef.current?.click()}
        ondragover=${e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
        ondragleave=${e => e.currentTarget.classList.remove('drag-over')}
        ondrop=${e => {
          e.preventDefault();
          e.currentTarget.classList.remove('drag-over');
          upload(e.dataTransfer.files[0]);
        }}>
        ${uploading
          ? html`
            <div style="text-align:center">
              <${Spinner} size=${28}/>
              <div style="margin-top:10px;font-size:13px;color:#888">RFP 분석 중...</div>
            </div>`
          : html`
            <div class="rfp-dropzone-icon">📋</div>
            <div class="rfp-dropzone-text">${rfp ? 'RFP 재업로드' : 'RFP 파일 업로드'}</div>
            <div class="rfp-dropzone-sub">PDF, DOCX, TXT 지원 · AI가 자동으로 분석합니다</div>
          `}
      </div>
      <input ref=${fileRef} type="file" accept=".pdf,.docx,.doc,.txt"
        style="display:none" onchange=${e => upload(e.target.files[0])} />

      ${err && html`<div class="alert alert-danger" style="margin-top:12px">${err}</div>`}

      ${rfp && html`
        <div class="rfp-analysis-box">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
            <div>
              <div style="font-weight:700;font-size:16px">${rfp.name || '(제목 없음)'}</div>
              ${rfp.client && html`<div style="font-size:13px;color:#888;margin-top:2px">발주처: ${rfp.client}</div>`}
            </div>
            <button class="btn btn-ghost btn-sm" onclick=${del}>삭제</button>
          </div>

          ${rfp.purpose && html`
            <div class="rfp-field"><span class="rfp-label">목적</span><span>${rfp.purpose}</span></div>
          `}
          ${rfp.budget && html`
            <div class="rfp-field"><span class="rfp-label">예산</span><span>${rfp.budget}</span></div>
          `}
          ${rfp.deadline && html`
            <div class="rfp-field"><span class="rfp-label">기한</span><span>${rfp.deadline}</span></div>
          `}
          ${rfp.duration && html`
            <div class="rfp-field"><span class="rfp-label">기간</span><span>${rfp.duration}</span></div>
          `}
          ${rfp.requirements?.length > 0 && html`
            <div class="rfp-field">
              <span class="rfp-label">요구사항</span>
              <ul style="margin:0;padding-left:16px">
                ${rfp.requirements.map((r, i) => html`<li key=${i} style="font-size:13px;margin-bottom:3px">${r}</li>`)}
              </ul>
            </div>
          `}
          ${rfp.evaluation?.length > 0 && html`
            <div class="rfp-field">
              <span class="rfp-label">평가기준</span>
              <ul style="margin:0;padding-left:16px">
                ${rfp.evaluation.map((e, i) => html`<li key=${i} style="font-size:13px;margin-bottom:3px">${e}</li>`)}
              </ul>
            </div>
          `}
          ${rfp.warnings?.length > 0 && html`
            <div class="rfp-field">
              <span class="rfp-label">주의사항</span>
              <ul style="margin:0;padding-left:16px">
                ${rfp.warnings.map((w, i) => html`<li key=${i} style="font-size:13px;margin-bottom:3px;color:#dc2626">${w}</li>`)}
              </ul>
            </div>
          `}
          ${rfp.strategy && html`
            <div style="margin-top:14px;padding:12px;background:#f5f3ff;border-radius:8px">
              <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">수주 전략</div>
              <div style="font-size:13px;line-height:1.6">${rfp.strategy}</div>
            </div>
          `}
          ${rfp.format && html`
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0;font-size:12px;color:#aaa">
              방향: ${rfp.format.orientation === 'landscape' ? '가로형 (A4)' : '세로형 (A4)'}
              ${rfp.format.page_limit ? ` · 최대 ${rfp.format.page_limit}페이지` : ''}
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

// ─────────────────────────────────────────────
// Competitor Tab
// ─────────────────────────────────────────────
function CompetitorTab({ client, onClientUpdate }) {
  const [companies, setCompanies] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [err, setErr] = useState('');

  const rawAnalysis = client.competitor_analysis || '';
  let competitors = [];
  try {
    const parsed = rawAnalysis ? JSON.parse(rawAnalysis) : [];
    competitors = Array.isArray(parsed) ? parsed : [];
  } catch {}

  const analyze = async () => {
    const list = companies
      .split(/[,，、\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (list.length === 0) { setErr('경쟁사를 입력하세요'); return; }
    setErr(''); setStreaming(true); setStreamText('');
    try {
      const res = await api.analyzeCompetitor(client.id, list);
      if (!res.body) throw new Error();
      await readSSE(res, ev => {
        if (ev.type === 'text') setStreamText(prev => prev + ev.text);
        if (ev.type === 'done') {
          setCompanies('');
          // Reload client to get updated competitor_analysis
          api.getClient(client.id).then(onClientUpdate).catch(() => {});
        }
        if (ev.type === 'error') setErr(ev.message || '분석 실패');
      });
    } catch { setErr('분석 실패'); }
    setStreaming(false); setStreamText('');
  };

  const clearAll = async () => {
    if (!confirm('경쟁사 분석 전체를 삭제하시겠습니까?')) return;
    await api.updateCompetitor(client.id, '').catch(() => {});
    onClientUpdate({ ...client, competitor_analysis: '' });
  };

  return html`
    <div>
      <div class="card" style="margin-bottom:20px">
        <div class="card-body">
          <div class="section-title" style="margin-bottom:12px">경쟁사 분석</div>
          <div style="display:flex;gap:10px;align-items:flex-end">
            <input class="form-input" style="flex:1"
              placeholder="경쟁사명 입력 (쉼표로 구분, 예: A사, B사)"
              value=${companies}
              onInput=${e => setCompanies(e.target.value)}
              onKeydown=${e => e.key === 'Enter' && !streaming && analyze()}
              disabled=${streaming} />
            <button class="btn btn-primary" onclick=${analyze}
              disabled=${streaming || !companies.trim()}>
              ${streaming ? html`<${Spinner} size=${16}/>` : 'AI 분석'}
            </button>
          </div>
          ${err && html`<div class="alert alert-danger" style="margin-top:10px">${err}</div>`}
          ${streaming && streamText && html`
            <div style="margin-top:12px;padding:12px;background:#f9f9f9;border-radius:8px;font-size:12px;color:#666;white-space:pre-wrap;max-height:120px;overflow:auto">
              ${streamText}▋
            </div>
          `}
        </div>
      </div>

      ${competitors.length > 0 && html`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:14px;color:var(--text-muted)">${competitors.length}개 경쟁사 분석 완료</div>
          <button class="btn btn-ghost btn-sm" onclick=${clearAll}>전체 삭제</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          ${competitors.map((c, i) => html`
            <div class="ci-card" key=${i}>
              <!-- 헤더: 회사명 + 아바타 -->
              <div class="ci-card-header">
                <div style="display:flex;align-items:center;gap:12px">
                  <div class="client-avatar"
                    style=${{ background: avatarColor(c.name), width: '36px', height: '36px', fontSize: '15px' }}>
                    ${avatarLetter(c.name)}
                  </div>
                  <div>
                    <div style="font-weight:700;font-size:16px">${c.name}</div>
                    <div style="font-size:13px;color:var(--text-muted)">경쟁사 분석</div>
                  </div>
                </div>
              </div>
              <!-- 강점/약점 인포그래픽 (5줄 이내) -->
              <div class="ci-grid">
                <div class="ci-col">
                  <div style="font-size:12px;font-weight:700;color:var(--success);margin-bottom:8px;display:flex;align-items:center;gap:5px">
                    <span style="width:18px;height:18px;background:var(--success);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px">✓</span>
                    강점
                  </div>
                  ${(c.strengths || []).slice(0, 5).map((s, j) => html`
                    <div key=${j} class="ci-diff strength" style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;font-size:13px;line-height:1.4">
                      <span style="flex-shrink:0;margin-top:2px">•</span>
                      <span>${s}</span>
                    </div>
                  `)}
                </div>
                <div class="ci-col">
                  <div style="font-size:12px;font-weight:700;color:var(--danger);margin-bottom:8px;display:flex;align-items:center;gap:5px">
                    <span style="width:18px;height:18px;background:var(--danger);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:10px">✗</span>
                    약점
                  </div>
                  ${(c.weaknesses || []).slice(0, 5).map((w, j) => html`
                    <div key=${j} class="ci-diff weakness" style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;font-size:13px;line-height:1.4">
                      <span style="flex-shrink:0;margin-top:2px">•</span>
                      <span>${w}</span>
                    </div>
                  `)}
                </div>
              </div>
              <!-- 차별화 전략 -->
              ${c.diff && html`
                <div style="margin:0;padding:14px 20px;background:var(--primary-dim);border-top:1px solid rgba(124,58,237,0.12)">
                  <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em">💡 우리의 차별화 전략</div>
                  <div style="font-size:14px;color:var(--text);line-height:1.6">${c.diff}</div>
                </div>
              `}
            </div>
          `)}
        </div>
      `}
      ${competitors.length === 0 && !streaming && html`
        <div class="empty-state" style="padding:40px">
          <div class="empty-icon">🏆</div>
          <div class="empty-title">경쟁사 분석이 없습니다</div>
          <div class="empty-sub">경쟁사 회사명을 입력하면 AI가 자동으로 강점·약점·차별화 전략을 분석합니다</div>
        </div>
      `}
    </div>
  `;
}

// ─────────────────────────────────────────────
// Memory Tab
// ─────────────────────────────────────────────
function MemoryTab({ client }) {
  const nuance = client.nuance_summary || '';
  return html`
    <div>
      <div class="alert alert-info" style="margin-bottom:16px">
        대화 종료 시 Claude가 클라이언트 성향과 주요 인사이트를 자동 요약·축적합니다.
        이후 제안서 작성 시 자동으로 참조됩니다.
      </div>
      ${nuance
        ? html`
          <div class="memory-content">
            <div style="white-space:pre-wrap;font-size:13px;line-height:1.7">${nuance}</div>
          </div>
          ${client.nuance_updated_at && html`
            <div style="margin-top:8px;font-size:12px;color:#aaa">
              최종 업데이트: ${fmtDate(client.nuance_updated_at)}
            </div>
          `}`
        : html`<div class="empty-state" style="padding:32px">아직 누적된 대화 기억이 없습니다</div>`}
    </div>
  `;
}

// ─────────────────────────────────────────────
// Client Detail Page
// ─────────────────────────────────────────────
function ClientDetailPage({ clientId }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('conversations');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getClient(clientId)
      .then(c => alive && setClient(c))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [clientId]);

  const TABS = [
    { id: 'conversations', label: '대화히스토리' },
    { id: 'refs', label: '레퍼런스라이브러리' },
    { id: 'rfp', label: 'RFP분석' },
    { id: 'competitors', label: '경쟁사분석' },
    { id: 'memory', label: '대화기억' },
  ];

  if (loading) return html`<div style="padding:80px;text-align:center"><${Spinner} size=${32}/></div>`;
  if (!client) return html`<div style="padding:40px;text-align:center;color:#888">클라이언트를 찾을 수 없습니다</div>`;

  return html`
    <div class="page-container">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-ghost btn-sm" onclick=${() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="client-avatar"
            style=${{ background: avatarColor(client.name), width: '40px', height: '40px', fontSize: '18px' }}>
            ${avatarLetter(client.name)}
          </div>
          <div>
            <h1 class="page-title" style="margin:0">${client.name}</h1>
            ${client.company && html`<div style="font-size:13px;color:#888">${client.company}</div>`}
          </div>
        </div>
      </div>

      <div class="tab-bar">
        ${TABS.map(t => html`
          <button key=${t.id}
            class=${'tab-btn' + (tab === t.id ? ' active' : '')}
            onclick=${() => setTab(t.id)}>
            ${t.label}
          </button>
        `)}
      </div>

      <div class="tab-content">
        ${tab === 'conversations' && html`<${ConvListTab} clientId=${client.id}/>`}
        ${tab === 'refs' && html`<${RefLibTab} clientId=${client.id}/>`}
        ${tab === 'rfp' && html`<${RfpTab} client=${client} onClientUpdate=${setClient}/>`}
        ${tab === 'competitors' && html`<${CompetitorTab} client=${client} onClientUpdate=${setClient}/>`}
        ${tab === 'memory' && html`<${MemoryTab} client=${client}/>`}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const htmlContent = !isUser ? extractHtmlBlock(msg.content) : null;
  const hasProposal = !!htmlContent;
  const [showPreview, setShowPreview] = useState(false);
  const [showKw, setShowKw] = useState(false);
  const keywords = hasProposal ? extractImgKeywords(htmlContent) : [];

  const plainText = hasProposal
    ? msg.content.replace(/```html[\s\S]*?(?:```|$)/i, '').trim()
    : msg.content;

  const openNew = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${htmlContent}</body></html>`);
    w.document.close();
  };

  const doPrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${htmlContent}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return html`
    <div class=${'msg-row' + (isUser ? ' user' : '')}>
      ${!isUser && html`<div class="msg-avatar">B</div>`}
      <div style=${{ flex: 1, maxWidth: isUser ? '72%' : '100%' }}>
        <div class=${'msg-bubble' + (isUser ? ' user' : ' assistant')}>
          ${isUser
            ? html`<div style="white-space:pre-wrap;line-height:1.6">${msg.content}</div>`
            : html`
              ${plainText && html`
                <div style=${{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginBottom: hasProposal ? '12px' : '0' }}>
                  ${plainText}
                </div>`}
              ${hasProposal && html`
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${showPreview ? '14px' : '0'}">
                  <button class="btn btn-primary btn-sm" onclick=${() => setShowPreview(v => !v)}>
                    📄 ${showPreview ? '미리보기 닫기' : '제안서 미리보기'}
                  </button>
                  <button class="btn btn-ghost btn-sm" onclick=${openNew}>새 탭</button>
                  <button class="btn btn-ghost btn-sm" onclick=${doPrint}>🖨️ 인쇄/PDF</button>
                  ${keywords.length > 0 && html`
                    <button class="btn btn-ghost btn-sm" onclick=${() => setShowKw(v => !v)}>
                      🔍 이미지 키워드
                    </button>
                  `}
                </div>
                ${showKw && keywords.length > 0 && html`
                  <div class="img-keywords-panel">
                    <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">
                      Google 이미지 검색
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">
                      ${keywords.map(kw => html`
                        <a key=${kw} class="img-keyword-chip"
                          href=${'https://www.google.com/search?q=' + encodeURIComponent(kw) + '&tbm=isch'}
                          target="_blank" rel="noopener">
                          ${kw}
                        </a>
                      `)}
                    </div>
                  </div>
                `}
                ${showPreview && html`
                  <${ProgressiveIframe}
                    doc=${`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${htmlContent}</body></html>`}
                  />
                `}
              `}
            `}
        </div>
        <div class="msg-time">${fmtDate(msg.created_at)}</div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Stream Bubble (live generation)
// ─────────────────────────────────────────────
function StreamBubble({ text }) {
  const pages = extractProgressivePages(text);
  const hasPages = pages && pages.count > 0;

  return html`
    <div class="msg-row">
      <div class="msg-avatar">B</div>
      <div style="flex:1">
        <div class="msg-bubble assistant">
          ${!pages
            ? html`<div style="white-space:pre-wrap;line-height:1.6">${text || ''}<span class="typing-dot"/></div>`
            : html`
              <div style="font-size:13px;color:#888;margin-bottom:${hasPages ? '12px' : '4px'}">
                제안서 생성 중${pages.count > 0 ? ` — ${pages.count}페이지 완성` : ''}...
                <span class="typing-dot"/>
              </div>
              ${hasPages && html`
                <${ProgressiveIframe} doc=${buildPreviewDoc(pages.preamble, pages.completed, pages.inProgress)}/>
              `}
            `}
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Conversation Page (full-screen, no sidebar)
// ─────────────────────────────────────────────
function ConversationPage({ clientId, convId }) {
  const [conv, setConv] = useState(null);
  const [client, setClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [refs, setRefs] = useState([]);
  const [selectedRefs, setSelectedRefs] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [showMemory, setShowMemory] = useState(false);
  const [loading, setLoading] = useState(true);
  const taRef = useRef(null);
  const endRef = useRef(null);
  const userScrolledUp = useRef(false);

  // Natural page scroll mode
  useEffect(() => {
    document.documentElement.classList.add('in-chat');
    return () => document.documentElement.classList.remove('in-chat');
  }, []);

  // Track manual scroll up
  useEffect(() => {
    const onScroll = () => {
      const atBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 160;
      userScrolledUp.current = !atBottom;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!userScrolledUp.current) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load data
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api.getConversation(convId),
      api.getReferences(clientId),
    ]).then(([convData, refsData]) => {
      if (!alive) return;
      setConv(convData);
      setClient(convData.client || null);
      setMessages(convData.messages || []);
      setRefs(refsData);
    }).catch(() => {}).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [clientId, convId]);

  useEffect(() => { scrollToBottom(); }, [messages.length, streamText]);

  const adjustTa = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '48px';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const toggleRef = (id) => {
    setSelectedRefs(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const endConv = async () => {
    if (!confirm('대화를 종료하고 인사이트를 저장하시겠습니까?')) return;
    try {
      const result = await api.endConversation(convId);
      setConv(prev => ({ ...prev, ended_at: result.ended_at || new Date().toISOString() }));
      alert('대화가 종료되었으며 클라이언트 인사이트가 업데이트되었습니다.');
    } catch { alert('종료 처리 중 오류가 발생했습니다.'); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    userScrolledUp.current = false;
    setInput('');
    if (taRef.current) taRef.current.style.height = '48px';

    const tmpUserMsg = {
      id: 'tmp-u-' + Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tmpUserMsg]);
    setStreaming(true);
    setStreamText('');

    let fullText = '';
    try {
      const res = await api.sendMessage(convId, { content: text, reference_ids: selectedRefs });
      if (!res.body) throw new Error('No stream body');

      await readSSE(res, ev => {
        if (ev.type === 'text') {
          fullText += ev.text;
          setStreamText(fullText);
        }
        if (ev.type === 'done') {
          setMessages(prev => [...prev, {
            id: ev.message_id || ('tmp-a-' + Date.now()),
            role: 'assistant',
            content: fullText,
            created_at: new Date().toISOString(),
          }]);
          setStreaming(false);
          setStreamText('');
        }
        if (ev.type === 'error') {
          setMessages(prev => [...prev, {
            id: 'err-' + Date.now(),
            role: 'assistant',
            content: `⚠️ 오류: ${ev.message || '알 수 없는 오류'}`,
            created_at: new Date().toISOString(),
          }]);
          setStreaming(false);
          setStreamText('');
        }
      });
    } catch (e) {
      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: '⚠️ 오류가 발생했습니다. 다시 시도해주세요.',
        created_at: new Date().toISOString(),
      }]);
      setStreaming(false);
      setStreamText('');
    }
  };

  const nuance = client?.nuance_summary || '';
  const isEnded = !!conv?.ended_at;

  if (loading) return html`<div style="padding:100px;text-align:center"><${Spinner} size=${32}/></div>`;

  return html`
    <div class="chat-layout">

      <!-- Sticky Header -->
      <div class="chat-header">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-ghost btn-sm"
            onclick=${() => navigate('/clients/' + clientId)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          ${client && html`
            <div class="client-avatar"
              style=${{ background: avatarColor(client.name), width: '28px', height: '28px', fontSize: '12px' }}>
              ${avatarLetter(client.name)}
            </div>
            <div>
              <div style="font-weight:600;font-size:14px">${client.name}</div>
              <div style="font-size:11px;color:#aaa">${conv?.title || '대화'}</div>
            </div>
          `}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class=${'status-dot' + (isEnded ? ' ended' : ' active')}></span>
          <span style="font-size:12px;color:#aaa">
            ${isEnded ? '종료됨' : streaming ? '생성 중' : '대기'}
          </span>
          ${!isEnded && !streaming && html`
            <button class="btn btn-ghost btn-sm" onclick=${endConv}>대화 종료</button>
          `}
        </div>
      </div>

      <!-- Context Bar (refs + memory) -->
      ${(refs.length > 0 || nuance) && html`
        <div class="chat-context-bar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            ${nuance && html`
              <button class="btn btn-ghost btn-sm"
                onclick=${() => setShowMemory(v => !v)}
                style="font-size:12px">
                💭 대화기억 ${showMemory ? '▲' : '▼'}
              </button>
            `}
            ${refs.length > 0 && html`
              <span style="font-size:12px;color:#aaa">참고자료:</span>
              <div class="ref-picker">
                ${refs.map(r => html`
                  <button key=${r.id}
                    class=${'attach-chip' + (selectedRefs.includes(r.id) ? ' selected' : '')}
                    onclick=${() => toggleRef(r.id)}>
                    📄 ${r.filename.length > 14 ? r.filename.slice(0, 14) + '…' : r.filename}
                  </button>
                `)}
              </div>
            `}
          </div>
          ${showMemory && nuance && html`
            <div class="memory-content" style="margin-top:8px">${nuance}</div>
          `}
        </div>
      `}

      <!-- Messages -->
      <div class="chat-messages">
        ${messages.length === 0 && !streaming && html`
          <div class="empty-state" style="padding:80px 40px">
            <div class="empty-icon">✍️</div>
            <div class="empty-title">대화를 시작하세요</div>
            <div class="empty-sub">제안서 작성, 전략 수립, 경쟁사 분석 등을 도와드립니다</div>
          </div>
        `}
        ${messages.map(msg => html`<${MessageBubble} key=${msg.id} msg=${msg}/>`)}
        ${streaming && html`<${StreamBubble} text=${streamText}/>`}
        <div ref=${endRef}></div>
      </div>

      <!-- Sticky Input -->
      <div class="chat-input-area">
        ${selectedRefs.length > 0 && html`
          <div class="attach-chips">
            ${selectedRefs.map(id => {
              const r = refs.find(r => r.id === id);
              return r ? html`
                <span key=${id} class="attach-chip selected">
                  📄 ${r.filename.slice(0, 16)}
                  <button
                    onclick=${() => toggleRef(id)}
                    style="margin-left:4px;border:none;background:none;color:inherit;cursor:pointer;padding:0;font-size:11px;line-height:1">
                    ✕
                  </button>
                </span>
              ` : null;
            })}
          </div>
        `}
        <div class="chat-input-row">
          <textarea
            ref=${taRef}
            class="chat-textarea"
            value=${input}
            placeholder=${isEnded ? '이 대화는 종료되었습니다' : '메시지를 입력하세요... (Shift+Enter: 줄바꿈)'}
            onInput=${e => { setInput(e.target.value); adjustTa(); }}
            onKeydown=${e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled=${streaming || isEnded}
            rows="1"
          />
          <button class="chat-send-btn" onclick=${send}
            disabled=${streaming || isEnded || !input.trim()}>
            ${streaming
              ? html`<${Spinner} size=${18}/>`
              : html`
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              `}
          </button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// App Root
// ─────────────────────────────────────────────
function App() {
  const route = useRoute();
  const [recentClients, setRecentClients] = useState([]);

  // Refresh recent clients whenever we navigate to a non-conversation page
  useEffect(() => {
    if (route.page !== 'conversation') {
      api.getClients().then(setRecentClients).catch(() => {});
    }
  }, [route.page, route.clientId]);

  // Full-screen pages skip the sidebar layout
  if (route.page === 'conversation') {
    return html`<${ConversationPage} clientId=${route.clientId} convId=${route.convId}/>`;
  }

  return html`
    <div class="app-layout">
      <${Sidebar} route=${route} recentClients=${recentClients}/>
      <main class="main-area">
        ${route.page === 'clients' && html`<${ClientListPage}/>`}
        ${route.page === 'client' && html`<${ClientDetailPage} clientId=${route.clientId}/>`}
        ${route.page === 'settings' && html`<${SettingsPage}/>`}
      </main>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────
render(html`<${App}/>`, document.getElementById('app'));
