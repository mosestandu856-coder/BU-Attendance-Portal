const express = require('express');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { prepare } = require('../db/database');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
}
function requireAdmin(req, res, next) {
  if (!['admin', 'lecturer'].includes(req.session.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Haversine distance in meters
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── LECTURER/ADMIN: Create lecture + generate QR ─────────────────────────────
router.post('/lectures', requireAuth, requireAdmin, async (req, res) => {
  const { title, period, class_lat, class_lng, radius_meters, expires_at, course_id } = req.body;
  if (!period) return res.status(400).json({ error: 'period is required' });
  if (!course_id) return res.status(400).json({ error: 'course_id is required' });

  try {
    if (req.session.role === 'lecturer') {
      const course = await prepare('SELECT id, course_code, course_name FROM courses WHERE id = ? AND lecturer_id = ?').get(course_id, req.session.userId);
      if (!course) return res.status(403).json({ error: 'You are not assigned to this course' });
    }

    // Prevent duplicate lectures for same course + period
    const duplicate = await prepare(
      'SELECT id FROM lectures WHERE course_id = ? AND period = ? AND created_by = ?'
    ).get(course_id, period, req.session.userId);
    if (duplicate) {
      return res.status(409).json({ error: 'A lecture for this course and period already exists. Delete the existing one first or use a different period.' });
    }

    const courseRow = await prepare('SELECT course_code, course_name FROM courses WHERE id = ?').get(course_id);
    const lectureTitle = (title && title.trim()) ? title.trim() : (courseRow ? `${courseRow.course_code} — ${courseRow.course_name}` : 'Lecture');

    const token = uuidv4();
    const scanUrl = `${req.protocol}://${req.get('host')}/scan.html?token=${token}`;
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await prepare(
      `INSERT INTO lectures (title, period, qr_token, class_lat, class_lng, radius_meters, created_by, expires_at, course_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(lectureTitle, period, token, class_lat || null, class_lng || null, radius_meters || 500, req.session.userId, expires_at || null, course_id, createdAt);

    const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 300 });
    res.status(201).json({ token, scanUrl, qr: qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: Delete lecture ─────────────────────────────────────────────────────
router.delete('/lectures/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prepare('DELETE FROM attendance WHERE lecture_id = ?').run(req.params.id);
    await prepare('DELETE FROM lectures WHERE id = ?').run(req.params.id);
    res.json({ message: 'Lecture deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/lectures', requireAuth, requireAdmin, async (req, res) => {
  try {
    const lectures = await prepare(`
      SELECT l.*, u.reg_number as created_by_reg, c.course_code, c.course_name,
        (SELECT COUNT(*) FROM attendance a WHERE a.lecture_id = l.id) as scan_count
      FROM lectures l
      JOIN users u ON l.created_by = u.id
      LEFT JOIN courses c ON l.course_id = c.id
      WHERE l.created_by = ?
      ORDER BY l.created_at DESC
    `).all(req.session.userId);
    res.json(lectures);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: Get lecture QR ─────────────────────────────────────────────────────
router.get('/lectures/:id/qr', requireAuth, requireAdmin, async (req, res) => {
  const lecture = await prepare('SELECT * FROM lectures WHERE id = ?').get(req.params.id);
  if (!lecture) return res.status(404).json({ error: 'Lecture not found' });
  const scanUrl = `${req.protocol}://${req.get('host')}/scan.html?token=${lecture.qr_token}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, { width: 300 });
  res.json({ qr: qrDataUrl, scanUrl, lecture });
});

// ── LECTURER: All attendance records ─────────────────────────────────────────
router.get('/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const records = await prepare(`
      SELECT a.id, a.scanned_at, a.student_lat, a.student_lng, a.location_valid,
             u.username, u.reg_number, l.title as lecture_title, l.period,
             c.course_code, c.course_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN lectures l ON a.lecture_id = l.id
      LEFT JOIN courses c ON l.course_id = c.id
      WHERE l.created_by = ?
      ORDER BY a.scanned_at DESC
    `).all(req.session.userId);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── LECTURER: Per-student attendance stats ────────────────────────────────────
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const totalRow = await prepare('SELECT COUNT(*) as count FROM lectures WHERE created_by = ?').get(req.session.userId);
    const totalLectures = totalRow.count;

    const stats = await prepare(`
      SELECT u.id, u.username, u.reg_number,
        COUNT(a.id) as attended,
        ? as total,
        ROUND(COUNT(a.id) * 100.0 / GREATEST(?, 1), 1) as percentage
      FROM users u
      JOIN course_enrollments ce ON ce.student_id = u.id AND ce.status = 'approved'
      JOIN courses c ON ce.course_id = c.id AND c.lecturer_id = ?
      LEFT JOIN attendance a ON a.user_id = u.id
        AND a.lecture_id IN (SELECT id FROM lectures WHERE created_by = ?)
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.reg_number
    `).all(totalLectures, totalLectures, req.session.userId, req.session.userId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── LECTURER: Per-course student attendance breakdown ─────────────────────────
router.get('/course-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const courses = await prepare(`
      SELECT c.id, c.course_code, c.course_name, s.name as semester_name,
        (SELECT COUNT(*) FROM lectures WHERE course_id = c.id AND created_by = ?) as total_lectures
      FROM courses c
      LEFT JOIN semesters s ON c.semester_id = s.id
      WHERE c.lecturer_id = ?
      ORDER BY c.course_code
    `).all(req.session.userId, req.session.userId);

    const result = await Promise.all(courses.map(async course => {
      const students = await prepare(`
        SELECT DISTINCT u.id, u.username, u.reg_number,
          (SELECT COUNT(*) FROM attendance a
            JOIN lectures l ON a.lecture_id = l.id
            WHERE a.user_id = u.id AND l.course_id = ?) as attended,
          ? as total
        FROM course_enrollments ce
        JOIN users u ON ce.student_id = u.id
        WHERE ce.course_id = ? AND ce.status = 'approved' AND u.role = 'student'
        ORDER BY u.reg_number
      `).all(course.id, course.total_lectures, course.id);

      students.forEach(s => {
        s.percentage = s.total > 0 ? Math.round(s.attended * 100 / s.total) : 0;
      });

      return { ...course, students };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: List all students ──────────────────────────────────────────────────
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prepare("SELECT id, reg_number, role, created_at FROM users WHERE role='student'").all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUBLIC: Validate token ────────────────────────────────────────────────────
router.get('/lecture-by-token/:token', requireAuth, async (req, res) => {
  const lecture = await prepare('SELECT id, title, period, class_lat, class_lng, radius_meters, expires_at FROM lectures WHERE qr_token = ?').get(req.params.token);
  if (!lecture) return res.status(404).json({ error: 'Invalid or expired QR code' });

  if (lecture.expires_at && new Date(lecture.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This QR code has expired' });
  }

  const already = await prepare('SELECT id FROM attendance WHERE user_id = ? AND lecture_id = ?').get(req.session.userId, lecture.id);
  if (already) return res.status(409).json({ error: 'You have already scanned for this lecture' });

  res.json(lecture);
});

// ── STUDENT: Scan QR / record attendance ─────────────────────────────────────
router.post('/scan', requireAuth, async (req, res) => {
  const { token, student_lat, student_lng } = req.body;
  if (!token) return res.status(400).json({ error: 'QR token is required' });

  try {
    // ── Enforce biometric registration before allowing scan ───────────────
    const biometric = await prepare('SELECT id FROM webauthn_credentials WHERE user_id = ?').get(req.session.userId);
    if (!biometric) {
      return res.status(403).json({ error: 'You must register your fingerprint/biometric before scanning. Please go to your profile and register your biometric first.' });
    }

    // ── Enforce biometric was verified this session ───────────────────────
    if (!req.session.biometricVerified) {
      return res.status(403).json({ error: 'Biometric verification required. Please verify your fingerprint before attendance is recorded.' });
    }

    const lecture = await prepare('SELECT * FROM lectures WHERE qr_token = ?').get(token);
    if (!lecture) return res.status(404).json({ error: 'Invalid QR code' });

    if (lecture.expires_at && new Date(lecture.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This QR code has expired' });
    }

    if (lecture.course_id) {
      const enrolled = await prepare(
        "SELECT id FROM course_enrollments WHERE student_id = ? AND course_id = ? AND status = 'approved'"
      ).get(req.session.userId, lecture.course_id);
      if (!enrolled) {
        return res.status(403).json({ error: 'You are not enrolled in the course for this lecture.' });
      }
    }

    const already = await prepare('SELECT id FROM attendance WHERE user_id = ? AND lecture_id = ?').get(req.session.userId, lecture.id);
    if (already) return res.status(409).json({ error: 'You have already scanned for this lecture' });

    let location_valid = 1;
    if (lecture.class_lat && lecture.class_lng && student_lat && student_lng) {
      const dist = distanceMeters(lecture.class_lat, lecture.class_lng, student_lat, student_lng);
      const accuracy_buffer = parseFloat(req.body.accuracy) || 50;
      const effective_radius = lecture.radius_meters + accuracy_buffer;
      location_valid = dist <= effective_radius ? 1 : 0;
      if (!location_valid) {
        return res.status(403).json({
          error: `You are not in the classroom. You are ${Math.round(dist)}m away (allowed: ${Math.round(effective_radius)}m including ±${Math.round(accuracy_buffer)}m GPS margin).`,
          distance: Math.round(dist)
        });
      }
    }

    const scannedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await prepare('INSERT INTO attendance (user_id, lecture_id, student_lat, student_lng, location_valid, scanned_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.session.userId, lecture.id, student_lat || null, student_lng || null, location_valid, scannedAt);
    res.status(201).json({ message: 'Attendance recorded successfully', lecture_title: lecture.title, period: lecture.period, scanned_at: scannedAt });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── QA: Advanced analytics endpoint ──────────────────────────────────────────
router.get('/qa/analytics', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (!['admin', 'qa'].includes(req.session.role)) return res.status(403).json({ error: 'Access denied' });
  try {
    const totalLectures = (await prepare('SELECT COUNT(*) as count FROM lectures').get()).count;
    const totalStudents = (await prepare("SELECT COUNT(*) as count FROM users WHERE role='student'").get()).count;
    const totalAttendances = (await prepare('SELECT COUNT(*) as count FROM attendance').get()).count;
    const totalCourses = (await prepare('SELECT COUNT(*) as count FROM courses').get()).count;
    const totalEnrolled = (await prepare("SELECT COUNT(*) as count FROM course_enrollments WHERE status='approved'").get()).count;

    const courseAttendance = await prepare(`
      SELECT c.course_code, c.course_name,
        u.username as lecturer_name,
        COUNT(DISTINCT l.id) as total_lectures,
        COUNT(DISTINCT ce.student_id) as enrolled_students,
        COUNT(a.id) as total_scans,
        CASE WHEN COUNT(DISTINCT l.id) * COUNT(DISTINCT ce.student_id) > 0
          THEN ROUND(COUNT(a.id) * 100.0 / (COUNT(DISTINCT l.id) * COUNT(DISTINCT ce.student_id)), 1)
          ELSE 0 END as attendance_rate
      FROM courses c
      LEFT JOIN users u ON c.lecturer_id = u.id
      LEFT JOIN lectures l ON l.course_id = c.id
      LEFT JOIN course_enrollments ce ON ce.course_id = c.id AND ce.status = 'approved'
      LEFT JOIN attendance a ON a.lecture_id = l.id AND a.user_id = ce.student_id
      GROUP BY c.id ORDER BY attendance_rate DESC
    `).all();

    const atRisk = await prepare(`
      SELECT u.username, u.reg_number, c.course_code, c.course_name,
        COUNT(DISTINCT l.id) as total_lectures,
        COUNT(DISTINCT a.lecture_id) as attended,
        CASE WHEN COUNT(DISTINCT l.id) > 0
          THEN ROUND(COUNT(DISTINCT a.lecture_id) * 100.0 / COUNT(DISTINCT l.id), 1)
          ELSE 0 END as percentage
      FROM course_enrollments ce
      JOIN users u ON ce.student_id = u.id
      JOIN courses c ON ce.course_id = c.id
      LEFT JOIN lectures l ON l.course_id = c.id
      LEFT JOIN attendance a ON a.user_id = u.id AND a.lecture_id = l.id
      WHERE ce.status = 'approved' AND u.role = 'student'
      GROUP BY ce.student_id, ce.course_id
      HAVING total_lectures > 0 AND percentage < 75
      ORDER BY percentage ASC
    `).all();

    const trend = await prepare(`
      SELECT DATE(a.scanned_at) as day, COUNT(*) as count
      FROM attendance a
      WHERE a.scanned_at >= DATE_ADD(CURDATE(), INTERVAL -30 DAY)
      GROUP BY day ORDER BY day ASC
    `).all();

    const lecturers = await prepare(`
      SELECT u.username, u.reg_number,
        COUNT(DISTINCT l.id) as lectures_created,
        COUNT(DISTINCT l.course_id) as courses_taught,
        COUNT(a.id) as total_scans,
        CASE WHEN COUNT(DISTINCT l.id) > 0
          THEN ROUND(COUNT(a.id) * 1.0 / COUNT(DISTINCT l.id), 1)
          ELSE 0 END as avg_attendance
      FROM users u
      LEFT JOIN lectures l ON l.created_by = u.id
      LEFT JOIN attendance a ON a.lecture_id = l.id
      WHERE u.role = 'lecturer'
      GROUP BY u.id ORDER BY lectures_created DESC
    `).all();

    const hourly = await prepare(`
      SELECT HOUR(scanned_at) as hour, COUNT(*) as count
      FROM attendance GROUP BY hour ORDER BY hour
    `).all();

    res.json({
      summary: { totalLectures, totalStudents, totalAttendances, totalCourses, totalEnrolled },
      courseAttendance, atRisk, trend, lecturers, hourly
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── QA: Lecturer teaching summary ─────────────────────────────────────────────
router.get('/qa/teaching-summary', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (!['admin', 'qa'].includes(req.session.role)) return res.status(403).json({ error: 'Access denied' });
  try {
    const lecturers = await prepare(`
      SELECT u.id, u.username, u.reg_number,
        COUNT(DISTINCT l.id) as total_lectures,
        COUNT(DISTINCT l.course_id) as courses_taught,
        COUNT(DISTINCT a.id) as total_scans,
        COUNT(DISTINCT a.user_id) as unique_students,
        CASE WHEN COUNT(DISTINCT l.id) > 0
          THEN ROUND(COUNT(DISTINCT a.id) * 1.0 / COUNT(DISTINCT l.id), 1)
          ELSE 0 END as avg_attendance_per_lecture,
        MIN(l.created_at) as first_lecture,
        MAX(l.created_at) as last_lecture
      FROM users u
      LEFT JOIN lectures l ON l.created_by = u.id
      LEFT JOIN attendance a ON a.lecture_id = l.id
      WHERE u.role = 'lecturer'
      GROUP BY u.id
      ORDER BY total_lectures DESC
    `).all();

    const result = await Promise.all(lecturers.map(async lec => {
      const courses = await prepare(`
        SELECT c.id, c.course_code, c.course_name, s.name as semester_name,
          (SELECT COUNT(*) FROM lectures WHERE course_id = c.id AND created_by = ?) as lectures_given,
          (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.id AND status = 'approved') as enrolled,
          (SELECT COUNT(*) FROM attendance a2
            JOIN lectures l2 ON a2.lecture_id = l2.id
            WHERE l2.course_id = c.id AND l2.created_by = ?) as total_scans
        FROM courses c
        LEFT JOIN semesters s ON c.semester_id = s.id
        WHERE c.lecturer_id = ?
        ORDER BY c.course_code
      `).all(lec.id, lec.id, lec.id);

      const weeklyActivity = await prepare(`
        SELECT DATE_FORMAT(created_at, '%Y-W%u') as week, COUNT(*) as count
        FROM lectures WHERE created_by = ?
        AND created_at >= DATE_ADD(CURDATE(), INTERVAL -56 DAY)
        GROUP BY week ORDER BY week
      `).all(lec.id);

      return { ...lec, courses, weeklyActivity };
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── QA: Lecturer teaching report ─────────────────────────────────────────────
router.get('/qa/report', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (!['admin', 'qa'].includes(req.session.role)) return res.status(403).json({ error: 'Access denied' });
  try {
    const totalLectures = (await prepare('SELECT COUNT(*) as count FROM lectures').get()).count;
    const lecturers = await prepare(`
      SELECT u.id, u.username, u.reg_number,
        COUNT(DISTINCT l.id) as lectures_created,
        (SELECT COUNT(*) FROM attendance a WHERE a.lecture_id IN (SELECT id FROM lectures WHERE created_by = u.id)) as total_scans,
        ? as total_lectures
      FROM users u
      LEFT JOIN lectures l ON l.created_by = u.id
      WHERE u.role = 'lecturer'
      GROUP BY u.id
      ORDER BY u.reg_number
    `).all(totalLectures);

    const lectures = await prepare(`
      SELECT l.id, l.title, l.period, l.created_at,
        u.reg_number as lecturer,
        u.username as lecturer_name,
        (SELECT COUNT(*) FROM attendance a WHERE a.lecture_id = l.id) as scan_count
      FROM lectures l
      JOIN users u ON l.created_by = u.id
      WHERE u.role = 'lecturer'
      ORDER BY l.created_at DESC
    `).all();

    const stats = await prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('lecturer');
    res.json({ totalLectures, lecturers, lectures, lecturerCount: stats ? stats.count : 0 });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── QA: Download CSV report ───────────────────────────────────────────────────
router.get('/qa/report/csv', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  if (!['admin', 'qa'].includes(req.session.role)) return res.status(403).json({ error: 'Access denied' });
  try {
    const lectures = await prepare(`
      SELECT l.title, l.period, l.created_at,
        u.reg_number as lecturer,
        u.username as lecturer_name,
        (SELECT COUNT(*) FROM attendance a WHERE a.lecture_id = l.id) as scan_count
      FROM lectures l
      JOIN users u ON l.created_by = u.id
      ORDER BY l.created_at DESC
    `).all();

    let csv = 'Lecture Title,Period,Created At,Lecturer Reg,Lecturer Name,Students Attended\n';
    lectures.forEach(l => {
      csv += `"${l.title}","${l.period}","${l.created_at}","${l.lecturer}","${l.lecturer_name || ''}","${l.scan_count}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="qa-report.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── STUDENT: Own attendance ───────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const records = await prepare(`
      SELECT a.id, a.scanned_at, a.location_valid, l.title as lecture_title, l.period,
             c.course_code, c.course_name
      FROM attendance a
      JOIN lectures l ON a.lecture_id = l.id
      LEFT JOIN courses c ON l.course_id = c.id
      WHERE a.user_id = ?
      ORDER BY a.scanned_at DESC
    `).all(req.session.userId);

    const courseStats = await prepare(`
      SELECT
        c.id as course_id, c.course_code, c.course_name,
        u.username as lecturer_name,
        (SELECT COUNT(*) FROM lectures l2 WHERE l2.course_id = c.id) as total,
        (SELECT COUNT(*) FROM attendance a2
          JOIN lectures l3 ON a2.lecture_id = l3.id
          WHERE a2.user_id = ? AND l3.course_id = c.id) as attended
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      LEFT JOIN users u ON c.lecturer_id = u.id
      WHERE ce.student_id = ? AND ce.status = 'approved'
      ORDER BY c.course_code
    `).all(req.session.userId, req.session.userId);

    const totalLectures = courseStats.reduce((s, c) => s + c.total, 0);
    const attended = courseStats.reduce((s, c) => s + c.attended, 0);
    const percentage = totalLectures > 0 ? Math.round(attended * 100 / totalLectures) : 0;

    courseStats.forEach(c => {
      c.percentage = c.total > 0 ? Math.round(c.attended * 100 / c.total) : 0;
    });

    res.json({ records, attended, total: totalLectures, percentage, courseStats });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
