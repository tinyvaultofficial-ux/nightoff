import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function getApiKey() {
  const db = getDb();
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('api_key');
  return setting?.value || null;
}

function buildSystemPrompt(client) {
  let prompt = `당신은 제안서 작성 전문가를 돕는 AI 어시스턴트입니다. 현재 클라이언트 "${client.name}"과의 대화를 지원하고 있습니다.`;

  if (client.company) prompt += `\n소속 회사: ${client.company}`;
  if (client.description) prompt += `\n클라이언트 메모: ${client.description}`;

  if (client.nuance_summary) {
    prompt += `\n\n━━━ 클라이언트 뉘앙스 & 축적된 맥락 ━━━\n${client.nuance_summary}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  prompt += `\n\n제안서 작성, 요구사항 파악, 전략 수립, 표현 방식 등을 전문적으로 지원해주세요. 항상 한국어로 대화하세요.`;
  return prompt;
}

router.get('/:id', (req, res) => {
  const db = getDb();
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conversation) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(conversation.client_id);
  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  res.json({ ...conversation, client, messages });
});

router.post('/:id/messages', async (req, res) => {
  const db = getDb();
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '메시지를 입력해주세요' });

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conversation) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });
  if (conversation.ended_at) return res.status(400).json({ error: '이미 종료된 대화입니다' });

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(conversation.client_id);
  const prevMessages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(400).json({ error: 'API 키가 설정되지 않았습니다. 설정 화면에서 Claude API 키를 입력해주세요.' });
  }

  // Save user message
  const userMsgId = uuidv4();
  db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
    userMsgId, req.params.id, 'user', content.trim()
  );

  // Auto-title on first message
  if (prevMessages.length === 0) {
    const title = content.length > 40 ? content.substring(0, 40) + '...' : content;
    db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, req.params.id);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const anthropic = new Anthropic({ apiKey });
    const messageHistory = [
      ...prevMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: content.trim() },
    ];

    let fullResponse = '';
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: buildSystemPrompt(client),
      messages: messageHistory,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`);
      }
    }

    const assistantMsgId = uuidv4();
    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
      assistantMsgId, req.params.id, 'assistant', fullResponse
    );

    res.write(`data: ${JSON.stringify({ type: 'done', messageId: assistantMsgId })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Claude API 오류:', err.message);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

router.post('/:id/end', async (req, res) => {
  const db = getDb();
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!conversation) return res.status(404).json({ error: '대화를 찾을 수 없습니다' });

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(conversation.client_id);
  const messages = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  db.prepare("UPDATE conversations SET ended_at = datetime('now', 'localtime') WHERE id = ?").run(req.params.id);

  if (messages.length === 0) {
    return res.json({ success: true, nuance_updated: false });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.json({ success: true, nuance_updated: false, warning: 'API 키 없음 - 뉘앙스 업데이트 건너뜀' });
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const conversationText = messages
      .map(m => `[${m.role === 'user' ? '제안서 전문가' : 'AI'}]\n${m.content}`)
      .join('\n\n');

    const prompt = `당신은 제안서 작성 전문가의 CRM 비서입니다.
아래는 클라이언트 "${client.name}"(${client.company || '회사 미상'})과의 대화 기록입니다.

═══ 기존 뉘앙스 요약 ═══
${client.nuance_summary || '(아직 없음 - 첫 대화)'}

═══ 새로운 대화 ═══
${conversationText}

위 대화를 분석하여, 이 클라이언트에 대한 최신 뉘앙스 프로필을 작성해주세요.
기존 요약과 새로운 대화를 통합하여, 다음 대화 시 바로 활용할 수 있는 형태로 작성하세요.

반드시 아래 항목으로 구성하세요 (각 항목은 2-4줄):
## 커뮤니케이션 스타일
## 핵심 가치 & 의사결정 기준
## 제안서 선호도 (형식·내용·강조점)
## 주의사항 & 민감한 포인트
## 관계 맥락 & 히스토리 요약
## 다음 대화 시 우선 활용할 포인트

간결하고 실용적으로, 바로 업무에 쓸 수 있게 작성해주세요.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const newNuance = response.content[0].text;

    db.prepare(`
      UPDATE clients
      SET nuance_summary = ?, nuance_updated_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(newNuance, client.id);

    res.json({ success: true, nuance_updated: true, nuance_summary: newNuance });
  } catch (err) {
    console.error('뉘앙스 업데이트 오류:', err.message);
    res.json({ success: true, nuance_updated: false, warning: err.message });
  }
});

export default router;
