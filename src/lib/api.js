const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export const api = {
  // Settings
  getSettings: () => request('/settings'),
  saveSettings: (data) => request('/settings', { method: 'POST', body: JSON.stringify(data) }),

  // Clients
  getClients: () => request('/clients'),
  getClient: (id) => request(`/clients/${id}`),
  createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  // Conversations
  getClientConversations: (clientId) => request(`/clients/${clientId}/conversations`),
  createConversation: (clientId, data = {}) =>
    request(`/clients/${clientId}/conversations`, { method: 'POST', body: JSON.stringify(data) }),
  getConversation: (id) => request(`/conversations/${id}`),
  endConversation: (id) => request(`/conversations/${id}/end`, { method: 'POST' }),

  // Streaming message sender — returns cleanup function
  sendMessage: async (conversationId, content, { onChunk, onDone, onError }) => {
    try {
      const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const data = await res.json();
        onError(data.error || '요청 실패');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === 'text') onChunk(payload.text);
            else if (payload.type === 'done') onDone(payload);
            else if (payload.type === 'error') onError(payload.error);
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      onError(err.message);
    }
  },
};
