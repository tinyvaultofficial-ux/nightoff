import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState(null); // {api_key_set, api_key_preview}
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(s => setStatus(s));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.saveSettings({ api_key: apiKey.trim() });
      const s = await api.getSettings();
      setStatus(s);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">설정</div>
          <div className="page-subtitle">Claude API 키 및 환경 설정</div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* API Key Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔑 Claude API 키</span>
            </div>
            <div className="card-body">
              {status?.api_key_set && (
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  ✓ API 키가 설정되어 있습니다 — <code style={{ fontFamily: 'monospace' }}>{status.api_key_preview}</code>
                </div>
              )}
              {!status?.api_key_set && (
                <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                  ⚠️ API 키가 없습니다. 대화를 시작하려면 아래에서 입력해주세요.
                </div>
              )}
              {saved && (
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  ✓ API 키가 저장되었습니다.
                </div>
              )}

              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">
                    {status?.api_key_set ? '새 API 키로 교체' : 'API 키 입력'}
                  </label>
                  <input
                    className="form-input"
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    autoComplete="off"
                  />
                  <div className="form-hint">
                    Anthropic Console에서 발급한 API 키를 입력하세요.
                    키는 서버에 암호화 없이 저장됩니다 — 개인 환경에서만 사용하세요.
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !apiKey.trim()}
                >
                  {saving ? <><span className="spinner" /> 저장 중...</> : '저장'}
                </button>
              </form>
            </div>
          </div>

          {/* Info Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">ℹ️ 서비스 안내</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7 }}>
                <div>
                  <strong>🧠 뉘앙스 자동 학습</strong><br />
                  대화가 끝날 때 "대화 종료" 버튼을 누르면, AI가 대화 내용을 분석하여 클라이언트의 뉘앙스 프로필을 자동으로 업데이트합니다.
                </div>
                <div>
                  <strong>💬 맥락 자동 주입</strong><br />
                  새 대화를 시작할 때 저장된 뉘앙스가 자동으로 Claude에게 전달되어, 항상 이전 대화의 맥락을 이어갑니다.
                </div>
                <div>
                  <strong>🔒 데이터 저장</strong><br />
                  모든 데이터(클라이언트, 대화, 뉘앙스)는 로컬 SQLite 파일에 저장됩니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
