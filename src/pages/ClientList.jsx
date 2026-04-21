import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

function avatarLetter(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiKeySet, setApiKeySet] = useState(true);

  useEffect(() => {
    Promise.all([api.getClients(), api.getSettings()]).then(([c, s]) => {
      setClients(c);
      setApiKeySet(s.api_key_set);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">클라이언트 목록</div>
          <div className="page-subtitle">총 {clients.length}명의 클라이언트</div>
        </div>
        <Link to="/clients/new" className="btn btn-primary">
          + 클라이언트 추가
        </Link>
      </div>

      <div className="page-body">
        {!apiKeySet && (
          <div className="alert alert-warning" style={{ marginBottom: 20 }}>
            <span>⚠️</span>
            <span>
              Claude API 키가 설정되지 않았습니다.{' '}
              <Link to="/settings" style={{ fontWeight: 700, textDecoration: 'underline' }}>설정 화면</Link>
              에서 API 키를 입력해야 대화를 시작할 수 있습니다.
            </span>
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">클라이언트가 없습니다</div>
            <div className="empty-state-desc">
              첫 클라이언트를 추가하고 제안서 작성 대화를 시작해보세요.
              대화할수록 클라이언트의 뉘앙스가 자동으로 학습됩니다.
            </div>
            <Link to="/clients/new" className="btn btn-primary">
              + 첫 클라이언트 추가
            </Link>
          </div>
        ) : (
          <div className="client-grid">
            {clients.map(client => (
              <Link to={`/clients/${client.id}`} key={client.id} className="client-card">
                <div className="client-card-avatar">
                  {avatarLetter(client.name)}
                </div>
                <div className="client-card-name">{client.name}</div>
                {client.company && (
                  <div className="client-card-company">🏢 {client.company}</div>
                )}
                <div className="client-card-meta">
                  <span>💬 {client.conversation_count}회 대화</span>
                  {client.last_conversation_at && (
                    <span>🕐 {formatDate(client.last_conversation_at)}</span>
                  )}
                </div>
                <div style={{ marginTop: 12 }}>
                  {client.nuance_summary ? (
                    <span className="nuance-badge has">✓ 뉘앙스 학습됨</span>
                  ) : (
                    <span className="nuance-badge none">뉘앙스 없음</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
