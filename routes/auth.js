const express = require('express');
const bcrypt = require('bcrypt');
const { webcrypto: crypto } = require('crypto');
const { prepare } = require('../db/database');

const router = express.Router();
const SALT_ROUNDS = 10;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, reg_number, password } = req.body;

  if (!reg_number || !password) {
    return res.status(400).json({ error: 'Registration number and password are required' });
  }

  try {
    const existing = await prepare('SELECT id FROM users WHERE reg_number = ?').get(reg_number);
    if (existing) {
      return res.status(409).json({ error: 'Registration number already in use' });
    }

    const count = await prepare('SELECT COUNT(*) as count FROM users').get();
    const role = (count && count.count === 0) ? 'admin' : 'student';

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await prepare('INSERT INTO users (username, reg_number, password, role) VALUES (?, ?, ?, ?)').run(username || null, reg_number, hash, role);

    return res.status(201).json({ message: 'Registered successfully', role });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { reg_number, password } = req.body;

  if (!reg_number || !password) {
    return res.status(400).json({ error: 'Registration number and password are required' });
  }

  try {
    const user = await prepare('SELECT id, username, reg_number, password, role FROM users WHERE reg_number = ?').get(reg_number);
    if (!user) return res.status(401).json({ error: 'Invalid registration number or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid registration number or password' });

    req.session.userId = user.id;
    req.session.regNumber = user.reg_number;
    req.session.username = user.username;
    req.session.role = user.role;

    return res.status(200).json({ reg_number: user.reg_number, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/create-user (admin only)
router.post('/create-user', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { username, reg_number, password, role } = req.body;
  if (!reg_number || !password || !role) return res.status(400).json({ error: 'reg_number, password and role are required' });
  if (!['lecturer', 'qa'].includes(role)) return res.status(400).json({ error: 'Role must be lecturer or qa' });

  try {
    const existing = await prepare('SELECT id FROM users WHERE reg_number = ?').get(reg_number);
    if (existing) return res.status(409).json({ error: 'Registration number already in use' });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await prepare('INSERT INTO users (username, reg_number, password, role) VALUES (?, ?, ?, ?)').run(username || null, reg_number, hash, role);
    return res.status(201).json({ message: `${role} account created successfully` });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/students', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const students = await prepare('SELECT id, username, reg_number, role, created_at FROM users ORDER BY created_at DESC').all();
    return res.json(students);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/students/:id (admin only)
router.put('/students/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { id } = req.params;
  const { reg_number, role, password, username } = req.body;

  try {
    const user = await prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check reg_number uniqueness if being changed
    if (reg_number) {
      const conflict = await prepare('SELECT id FROM users WHERE reg_number = ? AND id != ?').get(reg_number, id);
      if (conflict) return res.status(409).json({ error: 'Registration number already in use' });
    }

    // Validate role
    if (role && !['student', 'admin', 'qa', 'lecturer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Build a single UPDATE with all changed fields
    const fields = [];
    const values = [];

    if (username !== undefined) { fields.push('username = ?'); values.push(username.trim() || null); }
    if (reg_number)             { fields.push('reg_number = ?'); values.push(reg_number.trim()); }
    if (role)                   { fields.push('role = ?'); values.push(role); }
    if (password) {
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      fields.push('password = ?');
      values.push(hash);
    }

    if (!fields.length) return res.json({ message: 'Nothing to update' });

    values.push(id);
    await prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // If the admin edited their own account, refresh the session data
    if (parseInt(id) === req.session.userId) {
      const updated = await prepare('SELECT username, reg_number, role FROM users WHERE id = ?').get(id);
      if (updated) {
        req.session.username = updated.username;
        req.session.regNumber = updated.reg_number;
        req.session.role = updated.role;
      }
    }

    return res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update student error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/auth/students/:id (admin only)
router.delete('/students/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { id } = req.params;
  if (parseInt(id) === req.session.userId) return res.status(400).json({ error: 'Cannot delete your own account' });

  try {
    // Delete all related records in correct order to avoid FK constraint errors
    await prepare('DELETE FROM student_lecturer_ratings WHERE student_id = ?').run(id);
    await prepare('DELETE FROM student_lecturer_ratings WHERE lecturer_id = ?').run(id);
    await prepare('DELETE FROM course_ratings WHERE rater_id = ?').run(id);
    await prepare('DELETE FROM course_ratings WHERE ratee_id = ?').run(id);
    await prepare('DELETE FROM student_assessments WHERE student_id = ?').run(id);
    await prepare('DELETE FROM lecturer_assessments WHERE lecturer_id = ?').run(id);
    await prepare('DELETE FROM attendance WHERE user_id = ?').run(id);
    await prepare('DELETE FROM course_enrollments WHERE student_id = ?').run(id);
    await prepare('DELETE FROM webauthn_credentials WHERE user_id = ?').run(id);
    // Delete lectures created by this user and their attendance records
    const lectures = await prepare('SELECT id FROM lectures WHERE created_by = ?').all(id);
    for (const lec of lectures) {
      await prepare('DELETE FROM attendance WHERE lecture_id = ?').run(lec.id);
      await prepare('DELETE FROM student_assessments WHERE lecture_id = ?').run(lec.id);
      await prepare('DELETE FROM student_lecturer_ratings WHERE lecture_id = ?').run(lec.id);
    }
    await prepare('DELETE FROM lectures WHERE created_by = ?').run(id);
    await prepare('DELETE FROM courses WHERE lecturer_id = ?').run(id);
    await prepare('DELETE FROM contact_messages WHERE user_id = ?').run(id);
    await prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── WebAuthn: Registration challenge ─────────────────────────────────────────
router.get('/webauthn/register-challenge', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  const challenge = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  req.session.webauthnChallenge = challenge;
  res.json({ challenge, userId: req.session.userId, username: req.session.username || req.session.regNumber });
});

// ── WebAuthn: Save credential after registration ──────────────────────────────
router.post('/webauthn/register', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  const { credentialId, publicKey } = req.body;
  if (!credentialId || !publicKey) return res.status(400).json({ error: 'Missing credential data' });
  try {
    const existing = await prepare('SELECT id FROM webauthn_credentials WHERE user_id = ?').get(req.session.userId);
    if (existing) {
      await prepare('UPDATE webauthn_credentials SET credential_id = ?, public_key = ?, counter = 0 WHERE user_id = ?')
        .run(credentialId, publicKey, req.session.userId);
    } else {
      await prepare('INSERT INTO webauthn_credentials (user_id, credential_id, public_key) VALUES (?, ?, ?)')
        .run(req.session.userId, credentialId, publicKey);
    }
    res.json({ message: 'Biometric registered successfully' });
  } catch (err) {
    console.error('WebAuthn register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── WebAuthn: Authentication challenge ───────────────────────────────────────
router.get('/webauthn/auth-challenge', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  const cred = await prepare('SELECT credential_id FROM webauthn_credentials WHERE user_id = ?').get(req.session.userId);
  const challenge = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  req.session.webauthnChallenge = challenge;
  res.json({ challenge, credentialId: cred ? cred.credential_id : null, registered: !!cred });
});

// ── WebAuthn: Verify authentication ──────────────────────────────────────────
router.post('/webauthn/verify', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  const { credentialId } = req.body;
  if (!credentialId) return res.status(400).json({ error: 'Missing credential' });
  const cred = await prepare('SELECT id FROM webauthn_credentials WHERE user_id = ? AND credential_id = ?')
    .get(req.session.userId, credentialId);
  if (!cred) return res.status(401).json({ error: 'Biometric not recognized' });
  req.session.biometricVerified = true;
  res.json({ verified: true });
});

// ── WebAuthn: Check if registered ────────────────────────────────────────────
router.get('/webauthn/status', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  const cred = await prepare('SELECT id FROM webauthn_credentials WHERE user_id = ?').get(req.session.userId);
  res.json({ registered: !!cred });
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Internal server error' });
    return res.status(200).json({ message: 'Logged out' });
  });
});

// System settings — persisted to database
router.get('/settings', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  try {
    const rows = await prepare('SELECT setting_key, setting_value FROM system_settings').all();
    const settings = { name: 'BU Attendance Portal', threshold: 75, qr_expiry: 0 };
    rows.forEach(r => {
      if (r.setting_key === 'name') settings.name = r.setting_value;
      if (r.setting_key === 'threshold') settings.threshold = parseFloat(r.setting_value);
      if (r.setting_key === 'qr_expiry') settings.qr_expiry = parseInt(r.setting_value);
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/settings', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  const { name, threshold, qr_expiry } = req.body;
  try {
    if (name !== undefined) {
      await prepare('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)').run('name', name);
    }
    if (threshold !== undefined) {
      await prepare('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)').run('threshold', String(threshold));
    }
    if (qr_expiry !== undefined) {
      await prepare('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)').run('qr_expiry', String(qr_expiry));
    }
    // Return updated settings
    const rows = await prepare('SELECT setting_key, setting_value FROM system_settings').all();
    const settings = { name: 'BU Attendance Portal', threshold: 75, qr_expiry: 0 };
    rows.forEach(r => {
      if (r.setting_key === 'name') settings.name = r.setting_value;
      if (r.setting_key === 'threshold') settings.threshold = parseFloat(r.setting_value);
      if (r.setting_key === 'qr_expiry') settings.qr_expiry = parseInt(r.setting_value);
    });
    res.json({ message: 'Settings saved', settings });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  try {
    // Always read fresh from DB so username changes are reflected immediately
    const user = await prepare('SELECT id, username, reg_number, role FROM users WHERE id = ?').get(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    // Keep session in sync
    req.session.username = user.username;
    req.session.regNumber = user.reg_number;
    req.session.role = user.role;
    return res.status(200).json({
      userId: user.id,
      username: user.username,
      reg_number: user.reg_number,
      role: user.role,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
