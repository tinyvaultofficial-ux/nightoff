import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuanceOpen, setNuanceOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    Promise.all([api.getClient(id), api.getClientConversations(id)])
      .then(([c, convs]) => {
        setClient(c);
        setConversations(convs);
        setLoading(false);
      })
      .catch(() => navigate('/'));
  }, [id]);

  async function handleNewConversation() {
    setCreating(true);
    try {
      const conv = await api.createConversation(id);
      navigate(`/conversations/${conv.id}`);
    } catch (err) {
      alert(err.message);
      setCreating(false);
    }
  }

  async function handleDelete() {
    try {
      await api.deleteClient(id);
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  if (!client) return null;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/" className="btn btn-ghost btn-sm">← 목록</Link>
          <div>
            <div className="page-title">{client.name}</div>
            {client.company && <div className="page-subtitle">🏢 {client.company}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/clients/${id}/edit`} className="btn btn-secondary btn-sm">수정</Link>
          {!deleteConfirm ? (
            <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(true)}>삭제</button>
          ) : (
            <>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>정말 삭제</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(false)}>취소</button>
            </>
          )}
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Description */}
        {client.description && (
          <div className="card">
            <div className="card-body">
              <div className="section-title">클라이언트 메모</div>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{client.description}</p>
            </div>
          </div>
        )}

        {/* Nuance Summary */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🧠</span>
              <span className="card-title">뉘앙스 & 맥락 요약</span>
              {client.nuance_summary && (
                <span className="nuance-badge has" style={{ marginLeft: 4 }}>AI 학습됨</span>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setNuanceOpen(o => !o)}
            >
              {nuanceOpen ? '접기 ▲' : '펼치기 ▼'}
            </button>
          </div>
          {nuanceOpen && (
            <div className="card-body">
              {client.nuance_summary ? (
                <div className={`nuance-box ${client.nuance_summary ? '' : 'empty'}`}>
                  <div className="nuance-content">{client.nuance_summary}</div>
                  {client.nuance_updated_at && (
                    <div className="nuance-updated">
                      🕐 마지막 업데이트: {formatDate(client.nuance_updated_at)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="nuance-box empty">
                  <div style={{ color: 'var(--text-muted)', fontSize: 13.5, textAlign: 'center', padding: '16px 0' }}>
                    아직 뉘앙스 정보가 없습니다.<br />
                    대화를 시작하고 종료하면 AI가 자동으로 뉘앙스를 학습합니다.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conversations */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>💬</span>
              <span className="card-title">대화 히스토리 ({conversations.length})</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleNewConversation} disabled={creating}>
              {creating ? <><span className="spinner" /> 생성 중...</> : '+ 새 대화 시작'}
            </button>
          </div>
          <div className="card-body">
            {conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                아직 대화가 없습니다. 새 대화를 시작해보세요!
              </div>
            ) : (
              <div className="conv-list">
                {conversations.map(conv => (
                  <Link to={`/conversations/${conv.id}`} key={conv.id} className="conv-item">
                    <span className="conv-item-icon">{conv.ended_at ? '📁' : '💬'}</span>
                    <div className="conv-item-body">
                      <div className="conv-item-title">{conv.title}</div>
                      <div className="conv-item-meta">
                        <span>{formatShortDate(conv.created_at)}</span>
                        <span>메시지 {conv.message_count}개</span>
                      </div>
                    </div>
                    <div className="conv-item-status">
                      <span
                        className={`status-dot ${conv.ended_at ? 'ended' : 'active'}`}
                        title={conv.ended_at ? '종료됨' : '진행 중'}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
