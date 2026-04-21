import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(row => { settings[row.key] = row.value; });

  if (settings.api_key) {
    settings.api_key_set = true;
    settings.api_key_preview = settings.api_key.substring(0, 15) + '...';
    delete settings.api_key;
  } else {
    settings.api_key_set = false;
  }

  res.json(settings);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { api_key } = req.body;

  if (api_key !== undefined && api_key !== '') {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('api_key', api_key.trim());
  }

  res.json({ success: true });
});

export default router;
