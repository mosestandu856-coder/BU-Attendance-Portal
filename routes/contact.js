const express = require('express');
const { prepare } = require('../db/database');
const router = express.Router();

// ── Submit a contact message ──────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { sender_name, sender_email, subject, message } = req.body;
  if (!sender_name || !sender_email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }
  try {
    const user_id = req.session.userId || null;
    await prepare(`INSERT INTO contact_messages (user_id, sender_name, sender_email, subject, message)
                   VALUES (?,?,?,?,?)`).run(user_id, sender_name.trim(), sender_email.trim(), (subject || 'General Enquiry').trim(), message.trim());
    res.status(201).json({ message: 'Your message has been sent. The admin will get back to you.' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Get user's own messages ───────────────────────────────────────────────────
router.get('/my', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  try {
    const msgs = await prepare(`SELECT * FROM contact_messages WHERE user_id=? ORDER BY created_at DESC`).all(req.session.userId);
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── Get all messages (admin only) ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (!req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const msgs = await prepare(`SELECT * FROM contact_messages ORDER BY created_at DESC`).all();
    res.json(msgs);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── Mark as read ──────────────────────────────────────────────────────────────
router.put('/:id/read', async (req, res) => {
  if (!req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    await prepare(`UPDATE contact_messages SET status='read' WHERE id=?`).run(req.params.id);
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── Admin reply ───────────────────────────────────────────────────────────────
router.post('/:id/reply', async (req, res) => {
  if (!req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { reply } = req.body;
  if (!reply) return res.status(400).json({ error: 'Reply text is required.' });
  try {
    const msg = await prepare(`SELECT id FROM contact_messages WHERE id=?`).get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    await prepare(`UPDATE contact_messages SET status='replied', admin_reply=?, replied_at=NOW() WHERE id=?`)
      .run(reply, req.params.id);
    res.json({ message: 'Reply saved.' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Delete message ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  if (!req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    await prepare(`DELETE FROM contact_messages WHERE id=?`).run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
