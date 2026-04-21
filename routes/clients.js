import { Router } from 'express';
import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*,
      COUNT(conv.id) as conversation_count,
      MAX(conv.created_at) as last_conversation_at
    FROM clients c
    LEFT JOIN conversations conv ON conv.client_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `).all();
  res.json(clients);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: '클라이언트를 찾을 수 없습니다' });
  res.json(client);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, company, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '이름을 입력해주세요' });

  const id = uuidv4();
  db.prepare('INSERT INTO clients (id, name, company, description) VALUES (?, ?, ?, ?)').run(
    id, name.trim(), (company || '').trim(), (description || '').trim()
  );

  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, company, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '이름을 입력해주세요' });

  db.prepare(`
    UPDATE clients SET name = ?, company = ?, description = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(name.trim(), (company || '').trim(), (description || '').trim(), req.params.id);

  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '클라이언트를 찾을 수 없습니다' });
  res.json({ success: true });
});

router.get('/:id/conversations', (req, res) => {
  const db = getDb();
  const conversations = db.prepare(`
    SELECT conv.*, COUNT(m.id) as message_count
    FROM conversations conv
    LEFT JOIN messages m ON m.conversation_id = conv.id
    WHERE conv.client_id = ?
    GROUP BY conv.id
    ORDER BY conv.created_at DESC
  `).all(req.params.id);
  res.json(conversations);
});

router.post('/:id/conversations', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: '클라이언트를 찾을 수 없습니다' });

  const id = uuidv4();
  const title = (req.body.title || '').trim() || `대화 ${new Date().toLocaleDateString('ko-KR')}`;
  db.prepare('INSERT INTO conversations (id, client_id, title) VALUES (?, ?, ?)').run(id, req.params.id, title);

  res.json(db.prepare('SELECT * FROM conversations WHERE id = ?').get(id));
});

export default router;
