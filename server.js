require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { initDB } = require('./db/database');
const authRouter = require('./routes/auth');
const attendanceRouter = require('./routes/attendance');
const assessmentRouter = require('./routes/assessment');
const coursesRouter = require('./routes/courses');
const contactRouter = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.set('trust proxy', 1); // trust Render's reverse proxy so secure cookies work
app.use(session({
  secret: process.env.SESSION_SECRET || 'attendance-system-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login.html');
  next();
}

app.use('/api/auth', authRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/assessment', assessmentRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/contact', contactRouter);

app.get('/dashboard.html', requireAuth, (req, res, next) => next());
app.get('/admin.html', (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login.html');
  if (req.session.role !== 'admin') return res.redirect('/dashboard.html');
  next();
});
app.get('/scan.html', requireAuth, (req, res, next) => next());
app.get('/qa.html', (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login.html');
  if (!['admin', 'qa'].includes(req.session.role)) return res.redirect('/dashboard.html');
  next();
});
app.get('/lecturer.html', (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login.html');
  if (!['admin', 'lecturer'].includes(req.session.role)) return res.redirect('/dashboard.html');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Render and UptimeRobot
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
    console.log(`MySQL database connected.\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  console.error('DB_HOST:', process.env.DB_HOST);
  console.error('DB_NAME:', process.env.DB_NAME);
  console.error('DB_USER:', process.env.DB_USER);
  // Still start the server so Render doesn't mark it as failed
  // API calls will fail gracefully until DB is available
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nServer running on http://localhost:${PORT} (DB unavailable)\n`);
  });
});

module.exports = app;
