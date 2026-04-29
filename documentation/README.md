# BU Attendance Portal

A web-based QR code attendance management system for Bugema University.

---

## Quick Start

### Prerequisites
- Node.js v18+
- MySQL 8.0+

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Create MySQL database
mysql -u root -p
CREATE DATABASE attendance_db;
exit

# 3. Configure environment
# Edit .env file:
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=attendance_db
SESSION_SECRET=your-random-secret
NODE_ENV=development

# 4. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

The first registered account automatically becomes **Admin**.

---

## Making it accessible on phones (for QR scanning)

```bash
# Option 1 — Cloudflare Tunnel (recommended, free)
cloudflared tunnel --url http://localhost:3000

# Option 2 — ngrok (requires account)
ngrok http 3000
```

Share the generated HTTPS URL with students.

---

## User Roles

| Role | Login | Access |
|------|-------|--------|
| Admin | Any reg number (first registered) | Full system control |
| Lecturer | Created by Admin | Lectures, QR codes, attendance |
| Student | Self-register | Scan QR, view attendance, rate |
| QA Office | Created by Admin | Analytics and reports |

---

## Project Structure

```
├── server.js              # Express app entry point
├── db/
│   └── database.js        # MySQL connection and table creation
├── routes/
│   ├── auth.js            # Authentication, users, settings
│   ├── attendance.js      # QR scanning, attendance, analytics
│   ├── assessment.js      # Ratings and assessments
│   ├── courses.js         # Courses, semesters, enrollments
│   └── contact.js         # Contact messages
├── public/
│   ├── index.html         # Home page
│   ├── login.html         # Login page
│   ├── register.html      # Student registration
│   ├── dashboard.html     # Student dashboard
│   ├── admin.html         # Admin dashboard
│   ├── lecturer.html      # Lecturer dashboard
│   ├── qa.html            # QA office dashboard
│   ├── css/styles.css     # Global styles
│   └── js/                # Frontend JavaScript
├── tests/
│   └── unit/              # Jest unit tests
├── documentation/         # Project documentation
└── .env                   # Environment variables
```

---

## Running Tests

```bash
npm test
```

17 unit tests — all passing.

---

## Deployment (Railway)

1. Push to GitHub
2. Create Railway account at https://railway.app
3. New Project → Deploy from GitHub
4. Add MySQL plugin
5. Set environment variables (DB_HOST, DB_USER, etc.)
6. Deploy — get permanent public URL

---

## Tech Stack

- **Backend**: Node.js, Express.js, MySQL
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Security**: bcrypt, WebAuthn, express-session
- **Testing**: Jest, fast-check

---

*Bugema University — P.O. Box 6529 Kampala, Uganda*
*Tel: +256-312-351-400 | www.bugemauniv.ac.ug*
