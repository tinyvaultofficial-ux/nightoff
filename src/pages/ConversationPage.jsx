import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 10,
      alignItems: 'flex-end',
      marginBottom: 16,
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>
          AI
        </div>
      )}
      <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser ? 'var(--primary)' : '#fff',
          color: isUser ? '#fff' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontSize: 14, lineHeight: 1.7,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxShadow: 'var(--shadow)',
        }}>
          {message.content}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4, padding: '0 4px' }}>
          {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}

function StreamingBubble({ text }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--primary)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, flexShrink: 0,
      }}>
        AI
      </div>
      <div style={{
        maxWidth: '70%',
        padding: '12px 16px',
        borderRadius: '18px 18px 18px 4px',
        background: '#fff',
        border: '1px solid var(--border)',
        fontSize: 14, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        boxShadow: 'var(--shadow)',
      }}>
        {text || <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--text-light)',
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </span>}
        {text && <span style={{ opacity: .5, animation: 'blink 1s step-start infinite' }}>▊</span>}
      </div>
    </div>
  );
}

export default function ConversationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    api.getConversation(id).then(data => {
      setConv(data);
      setMessages(data.messages || []);
      setEnded(Boolean(data.ended_at));
      setLoading(false);
    }).catch(() => navigate('/'));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  async function handleSend() {
    const content = input.trim();
    if (!content || streaming || ended) return;

    setInput('');
    setError('');
    setStreaming(true);
    setStreamText('');

    const optimisticMsg = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    let accum = '';
    await api.sendMessage(id, content, {
      onChunk: (text) => {
        accum += text;
        setStreamText(accum);
      },
      onDone: () => {
        setStreaming(false);
        setStreamText('');
        // Reload messages from server for accurate timestamps/IDs
        api.getConversation(id).then(data => {
          setMessages(data.messages || []);
        });
      },
      onError: (msg) => {
        setError(msg);
        setStreaming(false);
        setStreamText('');
        // Remove optimistic user message on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      },
    });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleEnd() {
    if (!window.confirm('대화를 종료하고 뉘앙스를 업데이트하시겠습니까?\n종료 후에는 메시지를 추가할 수 없습니다.')) return;
    setEnding(true);
    setError('');
    try {
      const result = await api.endConversation(id);
      setEnded(true);
      if (result.nuance_updated) {
        setError(''); // clear any error
        // Show success briefly then navigate
        setTimeout(() => navigate(`/clients/${conv.client_id}`), 1500);
      } else {
        navigate(`/clients/${conv.client_id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEnding(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  const client = conv?.client;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--sidebar-bg)', padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to={`/clients/${client?.id}`}
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← 뒤로
          </Link>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)' }} />
          <div>
            <div style={{ color: '#f8fafc', fontSize: 14, fontWeight: 700 }}>{client?.name}</div>
            {client?.company && (
              <div style={{ color: '#64748b', fontSize: 11 }}>{client.company}</div>
            )}
          </div>
          {client?.nuance_summary && (
            <span style={{
              background: 'rgba(16,185,129,.15)', color: '#34d399',
              padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            }}>
              🧠 뉘앙스 주입됨
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {ended ? (
            <span style={{ color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569', display: 'inline-block' }} />
              종료된 대화
            </span>
          ) : (
            <>
              <span style={{ color: '#34d399', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                진행 중
              </span>
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(239,68,68,.15)', color: '#f87171', border: '1px solid rgba(239,68,68,.3)' }}
                onClick={handleEnd}
                disabled={ending || streaming}
              >
                {ending ? <><span className="spinner" /> 종료 중...</> : '대화 종료 & 뉘앙스 업데이트'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Nuance notice */}
      {client?.nuance_summary && !ended && (
        <div style={{
          background: 'rgba(59,130,246,.08)', borderBottom: '1px solid rgba(59,130,246,.15)',
          padding: '8px 20px', fontSize: 12.5, color: '#60a5fa',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          🧠 이전 대화에서 파악한 뉘앙스가 Claude에게 자동 전달됩니다
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.length === 0 && !streaming && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              {client?.name}과의 새 대화
            </div>
            <div style={{ fontSize: 13, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
              {client?.nuance_summary
                ? '이전 대화에서 학습한 뉘앙스가 반영되어 있습니다. 바로 업무 이야기를 시작해보세요.'
                : '첫 대화입니다. 대화 후 종료하면 AI가 뉘앙스를 자동으로 학습합니다.'}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streaming && <StreamingBubble text={streamText} />}

        {error && (
          <div className="alert alert-danger" style={{ margin: '8px 0 16px' }}>
            ⚠️ {error}
          </div>
        )}

        {ended && !ending && (
          <div className="alert alert-info" style={{ margin: '8px 0 16px', justifyContent: 'center', textAlign: 'center' }}>
            ✓ 대화가 종료되었습니다. 뉘앙스가 업데이트되었습니다.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!ended && (
        <div style={{
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          padding: '16px 20px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              className="form-input"
              style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 160, lineHeight: 1.6 }}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              disabled={streaming}
            />
            <button
              className="btn btn-primary"
              style={{ height: 44, padding: '0 18px', flexShrink: 0 }}
              onClick={handleSend}
              disabled={streaming || !input.trim()}
            >
              {streaming ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : '전송 ↑'}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginTop: 6 }}>
            대화가 끝나면 "대화 종료" 버튼을 눌러주세요. AI가 뉘앙스를 자동으로 업데이트합니다.
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
