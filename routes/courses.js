const express = require('express');
const { prepare } = require('../db/database');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
function requireAdminOrLecturer(req, res, next) {
  if (!['admin', 'lecturer'].includes(req.session.role)) return res.status(403).json({ error: 'Access denied' });
  next();
}

// ── SEMESTERS ─────────────────────────────────────────────────────────────────
router.get('/semesters', requireAuth, async (req, res) => {
  try { res.json(await prepare('SELECT * FROM semesters ORDER BY created_at DESC').all()); }
  catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/semesters', requireAuth, requireAdmin, async (req, res) => {
  const { name, start_date, end_date, is_active } = req.body;
  if (!name) return res.status(400).json({ error: 'Semester name required' });
  try {
    if (is_active) await prepare('UPDATE semesters SET is_active = 0').run();
    await prepare('INSERT INTO semesters (name, start_date, end_date, is_active) VALUES (?,?,?,?)').run(name, start_date || null, end_date || null, is_active ? 1 : 0);
    res.status(201).json({ message: 'Semester created' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/semesters/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, start_date, end_date, is_active } = req.body;
  try {
    if (is_active) await prepare('UPDATE semesters SET is_active = 0').run();
    await prepare('UPDATE semesters SET name=?,start_date=?,end_date=?,is_active=? WHERE id=?').run(name, start_date || null, end_date || null, is_active ? 1 : 0, req.params.id);
    res.json({ message: 'Semester updated' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/semesters/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prepare('DELETE FROM semesters WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── COURSES ───────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const courses = await prepare(`
      SELECT c.*, s.name as semester_name, u.username as lecturer_name, u.reg_number as lecturer_reg,
        (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'approved') as student_count
      FROM courses c
      LEFT JOIN semesters s ON c.semester_id = s.id
      LEFT JOIN users u ON c.lecturer_id = u.id
      ORDER BY c.created_at DESC
    `).all();
    res.json(courses);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    if (req.session.role === 'student') {
      const courses = await prepare(`
        SELECT c.*, s.name as semester_name, u.username as lecturer_name, u.reg_number as lecturer_reg
        FROM course_enrollments ce
        JOIN courses c ON ce.course_id = c.id
        LEFT JOIN semesters s ON c.semester_id = s.id
        LEFT JOIN users u ON c.lecturer_id = u.id
        WHERE ce.student_id = ? AND ce.status = 'approved'
        ORDER BY c.course_code
      `).all(req.session.userId);
      res.json(courses);
    } else if (['lecturer', 'admin'].includes(req.session.role)) {
      const courses = await prepare(`
        SELECT c.*, s.name as semester_name,
          (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'approved') as student_count
        FROM courses c
        LEFT JOIN semesters s ON c.semester_id = s.id
        WHERE c.lecturer_id = ?
        ORDER BY c.course_code
      `).all(req.session.userId);
      res.json(courses);
    } else {
      res.json([]);
    }
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/my/pending', requireAuth, async (req, res) => {
  try {
    const pending = await prepare(`
      SELECT ce.id, ce.enrolled_at, c.id as course_id, c.course_code, c.course_name, s.name as semester_name
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      LEFT JOIN semesters s ON c.semester_id = s.id
      WHERE ce.student_id = ? AND ce.status = 'pending'
      ORDER BY ce.enrolled_at DESC
    `).all(req.session.userId);
    res.json(pending);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { course_code, course_name, semester_id, lecturer_id } = req.body;
  if (!course_code || !course_name) return res.status(400).json({ error: 'Course code and name required' });
  try {
    await prepare('INSERT INTO courses (course_code, course_name, semester_id, lecturer_id) VALUES (?,?,?,?)').run(course_code, course_name, semester_id || null, lecturer_id || null);
    res.status(201).json({ message: 'Course created' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Course code already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { course_code, course_name, semester_id, lecturer_id } = req.body;
  try {
    await prepare('UPDATE courses SET course_code=?,course_name=?,semester_id=?,lecturer_id=? WHERE id=?').run(course_code, course_name, semester_id || null, lecturer_id || null, req.params.id);
    res.json({ message: 'Course updated' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prepare('DELETE FROM course_enrollments WHERE course_id=?').run(req.params.id);
    await prepare('DELETE FROM courses WHERE id=?').run(req.params.id);
    res.json({ message: 'Course deleted' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── ENROLLMENTS ───────────────────────────────────────────────────────────────
router.post('/enroll', requireAuth, async (req, res) => {
  const { course_code } = req.body;
  if (!course_code) return res.status(400).json({ error: 'Course code required' });

  // Guard: students may not hold more than 8 approved+pending enrollments
  try {
    const existing = await prepare(
      "SELECT COUNT(*) as cnt FROM course_enrollments WHERE student_id = ? AND status IN ('approved','pending')"
    ).get(req.session.userId);
    if (existing && existing.cnt >= 9) {
      return res.status(400).json({ error: 'You have reached the maximum of 9 courses. Remove a course before enrolling in a new one.' });
    }
  } catch (e) { /* non-fatal — proceed */ }

  try {
    const course = await prepare('SELECT id, course_name FROM courses WHERE course_code = ?').get(course_code.trim().toUpperCase());
    if (!course) return res.status(404).json({ error: 'Course does not exist. Please check the course code.' });
    const existing = await prepare('SELECT id, status FROM course_enrollments WHERE student_id=? AND course_id=?').get(req.session.userId, course.id);
    if (existing) {
      if (existing.status === 'pending') return res.status(409).json({ error: 'Enrollment request already pending for this course.' });
      if (existing.status === 'approved') return res.status(409).json({ error: 'Already enrolled in this course.' });
    }
    await prepare('INSERT INTO course_enrollments (student_id, course_id, status) VALUES (?,?,?)').run(req.session.userId, course.id, 'pending');
    res.status(201).json({ message: `Enrollment request sent for ${course.course_name}. Awaiting admin approval.`, course });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/enrollment-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const requests = await prepare(`
      SELECT ce.id, ce.status, ce.enrolled_at,
        u.id as student_id, u.username as student_name, u.reg_number,
        c.id as course_id, c.course_code, c.course_name,
        s.name as semester_name
      FROM course_enrollments ce
      JOIN users u ON ce.student_id = u.id
      JOIN courses c ON ce.course_id = c.id
      LEFT JOIN semesters s ON c.semester_id = s.id
      WHERE ce.status = 'pending' AND u.role = 'student'
      ORDER BY ce.enrolled_at DESC
    `).all();
    res.json(requests);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/enrollment-requests/:id', requireAuth, requireAdmin, async (req, res) => {
  const { action } = req.body;
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Action must be approve or reject' });
  try {
    const enrollment = await prepare('SELECT id FROM course_enrollments WHERE id=?').get(req.params.id);
    if (!enrollment) return res.status(404).json({ error: 'Enrollment request not found' });
    if (action === 'approve') {
      await prepare('UPDATE course_enrollments SET status=? WHERE id=?').run('approved', req.params.id);
      res.json({ message: 'Enrollment approved' });
    } else {
      await prepare('DELETE FROM course_enrollments WHERE id=?').run(req.params.id);
      res.json({ message: 'Enrollment rejected and removed' });
    }
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id/students', requireAuth, requireAdminOrLecturer, async (req, res) => {
  try {
    const students = await prepare(`
      SELECT u.id, u.username, u.reg_number, ce.enrolled_at
      FROM course_enrollments ce
      JOIN users u ON ce.student_id = u.id
      WHERE ce.course_id = ? AND ce.status = 'approved'
      ORDER BY u.reg_number
    `).all(req.params.id);
    res.json(students);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id/enroll/:studentId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prepare('DELETE FROM course_enrollments WHERE course_id=? AND student_id=?').run(req.params.id, req.params.studentId);
    res.json({ message: 'Student removed from course' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id/report', requireAuth, async (req, res) => {
  try {
    const course = await prepare('SELECT * FROM courses WHERE id=?').get(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const lectures = await prepare(`
      SELECT l.id, l.title, l.period, l.created_at,
        (SELECT COUNT(*) FROM attendance a WHERE a.lecture_id = l.id) as attended
      FROM lectures l WHERE l.course_id = ?
      ORDER BY l.created_at DESC
    `).all(req.params.id);
    const students = await prepare(`
      SELECT u.id, u.username, u.reg_number,
        (SELECT COUNT(*) FROM attendance a JOIN lectures l ON a.lecture_id=l.id WHERE a.user_id=u.id AND l.course_id=?) as attended,
        (SELECT COUNT(*) FROM lectures WHERE course_id=?) as total
      FROM course_enrollments ce JOIN users u ON ce.student_id=u.id
      WHERE ce.course_id=? AND ce.status='approved'
      ORDER BY u.reg_number
    `).all(req.params.id, req.params.id, req.params.id);
    res.json({ course, lectures, students });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
