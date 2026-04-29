const express = require('express');
const { prepare } = require('../db/database');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
}
function requireAdmin(req, res, next) {
  if (!['admin'].includes(req.session.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
}
function requireQAorAdmin(req, res, next) {
  if (!['admin', 'qa'].includes(req.session.role)) return res.status(403).json({ error: 'Access denied' });
  next();
}

// ── STUDENT ASSESSMENTS ───────────────────────────────────────────────────────

router.get('/students', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await prepare(`
      SELECT sa.*, u.reg_number, u.username,
        l.title as lecture_title, l.period
      FROM student_assessments sa
      JOIN users u ON sa.student_id = u.id
      JOIN lectures l ON sa.lecture_id = l.id
      ORDER BY sa.created_at DESC
    `).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/my', requireAuth, async (req, res) => {
  try {
    const rows = await prepare(`
      SELECT sa.*, l.title as lecture_title, l.period
      FROM student_assessments sa
      JOIN lectures l ON sa.lecture_id = l.id
      WHERE sa.student_id = ?
      ORDER BY sa.created_at DESC
    `).all(req.session.userId);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

function calcGrade(total) {
  if (total >= 80) return { grade: 'A',  gp: 5.0 };
  if (total >= 75) return { grade: 'B+', gp: 4.5 };
  if (total >= 70) return { grade: 'B',  gp: 4.0 };
  if (total >= 65) return { grade: 'C+', gp: 3.5 };
  if (total >= 60) return { grade: 'C',  gp: 3.0 };
  if (total >= 55) return { grade: 'D+', gp: 2.5 };
  if (total >= 50) return { grade: 'D',  gp: 2.0 };
  return               { grade: 'F',  gp: 0.0 };
}

router.post('/students', requireAuth, requireAdmin, async (req, res) => {
  const { student_id, lecture_id, attendance_score, mid_semester_score, final_exam_score, remarks } = req.body;
  if (!student_id || !lecture_id) return res.status(400).json({ error: 'student_id and lecture_id required' });

  const as = parseFloat(attendance_score) || 0;
  const ms = parseFloat(mid_semester_score) || 0;
  const fe = parseFloat(final_exam_score) || 0;
  const total = as + ms + fe;
  const { grade, gp } = calcGrade(total);

  try {
    const existing = await prepare('SELECT id FROM student_assessments WHERE student_id = ? AND lecture_id = ?').get(student_id, lecture_id);
    if (existing) {
      await prepare(`UPDATE student_assessments SET attendance_score=?,mid_semester_score=?,final_exam_score=?,total_score=?,grade=?,grade_point=?,remarks=?,assessed_by=? WHERE id=?`)
        .run(as, ms, fe, total, grade, gp, remarks || '', req.session.userId, existing.id);
    } else {
      await prepare(`INSERT INTO student_assessments (student_id,lecture_id,attendance_score,mid_semester_score,final_exam_score,total_score,grade,grade_point,remarks,assessed_by) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(student_id, lecture_id, as, ms, fe, total, grade, gp, remarks || '', req.session.userId);
    }
    res.json({ message: 'Assessment saved', grade, gp, total });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/students/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prepare('DELETE FROM student_assessments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── LECTURER ASSESSMENTS ──────────────────────────────────────────────────────

router.get('/lecturers', requireAuth, requireQAorAdmin, async (req, res) => {
  try {
    const rows = await prepare(`
      SELECT la.*, u.reg_number, u.username,
        a.reg_number as assessor_reg
      FROM lecturer_assessments la
      JOIN users u ON la.lecturer_id = u.id
      LEFT JOIN users a ON la.assessed_by = a.id
      ORDER BY la.created_at DESC
    `).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/lecturers', requireAuth, requireQAorAdmin, async (req, res) => {
  const { lecturer_id, semester, teaching_quality, punctuality, content_delivery, comments } = req.body;
  if (!lecturer_id || !semester) return res.status(400).json({ error: 'lecturer_id and semester required' });

  const tq = parseInt(teaching_quality) || 0;
  const pu = parseInt(punctuality) || 0;
  const cd = parseInt(content_delivery) || 0;
  const overall = ((tq + pu + cd) / 3).toFixed(1);

  try {
    await prepare(`INSERT INTO lecturer_assessments (lecturer_id,semester,teaching_quality,punctuality,content_delivery,overall_rating,comments,assessed_by) VALUES (?,?,?,?,?,?,?,?)`)
      .run(lecturer_id, semester, tq, pu, cd, overall, comments || '', req.session.userId);
    res.json({ message: 'Lecturer assessment saved', overall });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/lecturers/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prepare('DELETE FROM lecturer_assessments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── STUDENT LECTURER RATINGS ──────────────────────────────────────────────────

router.post('/rate-lecturer', requireAuth, async (req, res) => {
  const { lecture_id, rating, comment } = req.body;
  if (!lecture_id || !rating) return res.status(400).json({ error: 'lecture_id and rating required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
  try {
    const lecture = await prepare('SELECT created_by FROM lectures WHERE id = ?').get(lecture_id);
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });
    const lecturer_id = lecture.created_by;
    const existing = await prepare('SELECT id FROM student_lecturer_ratings WHERE student_id = ? AND lecture_id = ?').get(req.session.userId, lecture_id);
    if (existing) {
      await prepare('UPDATE student_lecturer_ratings SET rating=?,comment=? WHERE id=?').run(rating, comment || '', existing.id);
    } else {
      await prepare('INSERT INTO student_lecturer_ratings (student_id,lecturer_id,lecture_id,rating,comment) VALUES (?,?,?,?,?)').run(req.session.userId, lecturer_id, lecture_id, rating, comment || '');
    }
    res.json({ message: 'Rating submitted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/lecturer-ratings', requireAuth, requireQAorAdmin, async (req, res) => {
  try {
    const rows = await prepare(`
      SELECT slr.*,
        s.username as student_name, s.reg_number as student_reg,
        l.username as lecturer_name, l.reg_number as lecturer_reg,
        lec.title as lecture_title
      FROM student_lecturer_ratings slr
      JOIN users s ON slr.student_id = s.id
      JOIN users l ON slr.lecturer_id = l.id
      LEFT JOIN lectures lec ON slr.lecture_id = lec.id
      ORDER BY slr.created_at DESC
    `).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/my-ratings', requireAuth, async (req, res) => {
  try {
    const rows = await prepare(`
      SELECT slr.*, l.username as lecturer_name, l.reg_number as lecturer_reg, lec.title as lecture_title
      FROM student_lecturer_ratings slr
      JOIN users l ON slr.lecturer_id = l.id
      LEFT JOIN lectures lec ON slr.lecture_id = lec.id
      WHERE slr.student_id = ?
      ORDER BY slr.created_at DESC
    `).all(req.session.userId);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── COURSE RATINGS ────────────────────────────────────────────────────────────

router.post('/course-ratings/student-rates-lecturer', requireAuth, async (req, res) => {
  if (req.session.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const { course_id, score, comment } = req.body;
  if (!course_id || !score) return res.status(400).json({ error: 'course_id and score required' });
  if (score < 1 || score > 10) return res.status(400).json({ error: 'Score must be between 1 and 10' });
  try {
    const course = await prepare('SELECT lecturer_id FROM courses WHERE id = ?').get(course_id);
    if (!course || !course.lecturer_id) return res.status(404).json({ error: 'Course or lecturer not found' });
    const enrolled = await prepare("SELECT id FROM course_enrollments WHERE student_id=? AND course_id=? AND status='approved'").get(req.session.userId, course_id);
    if (!enrolled) return res.status(403).json({ error: 'You are not enrolled in this course' });
    await prepare(`INSERT INTO course_ratings (rater_id, ratee_id, course_id, rater_role, score, comment)
                   VALUES (?,?,?,'student',?,?)
                   ON DUPLICATE KEY UPDATE score=VALUES(score), comment=VALUES(comment)`).run(req.session.userId, course.lecturer_id, course_id, parseInt(score), comment || '');
    res.json({ message: 'Rating submitted successfully' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/course-ratings/lecturer-rates-student', requireAuth, async (req, res) => {
  if (!['lecturer', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Lecturers only' });
  const { student_id, course_id, score, comment } = req.body;
  if (!student_id || !course_id || !score) return res.status(400).json({ error: 'student_id, course_id and score required' });
  if (score < 1 || score > 10) return res.status(400).json({ error: 'Score must be between 1 and 10' });
  try {
    const course = await prepare('SELECT id FROM courses WHERE id=? AND lecturer_id=?').get(course_id, req.session.userId);
    if (!course && req.session.role !== 'admin') return res.status(403).json({ error: 'You are not assigned to this course' });
    const enrolled = await prepare("SELECT id FROM course_enrollments WHERE student_id=? AND course_id=? AND status='approved'").get(student_id, course_id);
    if (!enrolled) return res.status(400).json({ error: 'Student is not enrolled in this course' });
    await prepare(`INSERT INTO course_ratings (rater_id, ratee_id, course_id, rater_role, score, comment)
                   VALUES (?,?,?,'lecturer',?,?)
                   ON DUPLICATE KEY UPDATE score=VALUES(score), comment=VALUES(comment)`).run(req.session.userId, student_id, course_id, parseInt(score), comment || '');
    res.json({ message: 'Student rated successfully' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/course-ratings/my', requireAuth, async (req, res) => {
  try {
    const ratings = await prepare(`
      SELECT cr.*, c.course_code, c.course_name, u.username as rater_name, u.reg_number as rater_reg
      FROM course_ratings cr
      JOIN courses c ON cr.course_id = c.id
      JOIN users u ON cr.rater_id = u.id
      WHERE cr.ratee_id = ?
      ORDER BY cr.created_at DESC
    `).all(req.session.userId);
    res.json(ratings);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET ratings the student submitted (student → lecturer)
router.get('/course-ratings/submitted', requireAuth, async (req, res) => {
  try {
    const ratings = await prepare(`
      SELECT cr.course_id, cr.score, cr.comment, cr.created_at,
        c.course_code, c.course_name,
        u.username as ratee_name
      FROM course_ratings cr
      JOIN courses c ON cr.course_id = c.id
      JOIN users u ON cr.ratee_id = u.id
      WHERE cr.rater_id = ? AND cr.rater_role = 'student'
      ORDER BY cr.created_at DESC
    `).all(req.session.userId);
    res.json(ratings);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE student removes their own rating for a course
router.delete('/course-ratings/student-clear/:courseId', requireAuth, async (req, res) => {
  try {
    await prepare(
      "DELETE FROM course_ratings WHERE rater_id = ? AND course_id = ? AND rater_role = 'student'"
    ).run(req.session.userId, req.params.courseId);
    res.json({ message: 'Rating removed' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE lecturer removes their own rating for a student in a course
router.delete('/course-ratings/lecturer-clear/:courseId/:studentId', requireAuth, async (req, res) => {
  if (!['lecturer', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Access denied' });
  try {
    await prepare(
      "DELETE FROM course_ratings WHERE rater_id = ? AND course_id = ? AND ratee_id = ? AND rater_role = 'lecturer'"
    ).run(req.session.userId, req.params.courseId, req.params.studentId);
    res.json({ message: 'Rating removed' });
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/course-ratings/given', requireAuth, async (req, res) => {
  if (!['lecturer', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Lecturers only' });
  try {
    const ratings = await prepare(`
      SELECT cr.*, c.course_code, c.course_name, u.username as student_name, u.reg_number as student_reg
      FROM course_ratings cr
      JOIN courses c ON cr.course_id = c.id
      JOIN users u ON cr.ratee_id = u.id
      WHERE cr.rater_id = ? AND cr.rater_role = 'lecturer'
      ORDER BY cr.created_at DESC
    `).all(req.session.userId);
    res.json(ratings);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/course-ratings', requireAuth, requireQAorAdmin, async (req, res) => {
  try {
    const ratings = await prepare(`
      SELECT cr.*, c.course_code, c.course_name,
        rater.username as rater_name, rater.reg_number as rater_reg, rater.role as rater_role_name,
        ratee.username as ratee_name, ratee.reg_number as ratee_reg
      FROM course_ratings cr
      JOIN courses c ON cr.course_id = c.id
      JOIN users rater ON cr.rater_id = rater.id
      JOIN users ratee ON cr.ratee_id = ratee.id
      ORDER BY cr.created_at DESC
    `).all();
    res.json(ratings);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET ratings for a specific course — accessible by the lecturer who owns it
router.get('/course-ratings/by-course/:courseId', requireAuth, async (req, res) => {
  try {
    const courseId = req.params.courseId;
    // Lecturers can only see ratings for their own courses
    if (req.session.role === 'lecturer') {
      const owned = await prepare('SELECT id FROM courses WHERE id = ? AND lecturer_id = ?').get(courseId, req.session.userId);
      if (!owned) return res.status(403).json({ error: 'Access denied' });
    } else if (!['admin', 'qa'].includes(req.session.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const ratings = await prepare(`
      SELECT cr.*, c.course_code, c.course_name,
        rater.username as rater_name, rater.reg_number as rater_reg, rater.role as rater_role_name,
        ratee.username as ratee_name, ratee.reg_number as ratee_reg
      FROM course_ratings cr
      JOIN courses c ON cr.course_id = c.id
      JOIN users rater ON cr.rater_id = rater.id
      JOIN users ratee ON cr.ratee_id = ratee.id
      WHERE cr.course_id = ?
      ORDER BY cr.created_at DESC
    `).all(courseId);
    res.json(ratings);
  } catch (e) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
