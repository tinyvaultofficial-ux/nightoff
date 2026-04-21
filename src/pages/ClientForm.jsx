import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({ name: '', company: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      api.getClient(id).then(c => {
        setForm({ name: c.name, company: c.company || '', description: c.description || '' });
        setLoading(false);
      }).catch(() => navigate('/'));
    }
  }, [id]);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('이름을 입력해주세요.'); return; }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await api.updateClient(id, form);
        navigate(`/clients/${id}`);
      } else {
        const client = await api.createClient(form);
        navigate(`/clients/${client.id}`);
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={isEdit ? `/clients/${id}` : '/'} className="btn btn-ghost btn-sm">← 뒤로</Link>
          <div className="page-title">{isEdit ? '클라이언트 수정' : '클라이언트 추가'}</div>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="alert alert-danger" style={{ marginBottom: 18 }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  이름 <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="예: 김철수 팀장"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  회사명 <span>(선택)</span>
                </label>
                <input
                  className="form-input"
                  type="text"
                  value={form.company}
                  onChange={set('company')}
                  placeholder="예: (주)테크스타트"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  메모 <span>(선택)</span>
                </label>
                <textarea
                  className="form-textarea"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="클라이언트에 대한 기본 메모를 남겨두세요. (담당 분야, 관계, 계약 배경 등)"
                  rows={4}
                />
                <div className="form-hint">
                  상세한 뉘앙스는 대화를 통해 AI가 자동으로 학습합니다.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Link
                  to={isEdit ? `/clients/${id}` : '/'}
                  className="btn btn-secondary"
                >
                  취소
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> 저장 중...</> : (isEdit ? '저장' : '추가')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
