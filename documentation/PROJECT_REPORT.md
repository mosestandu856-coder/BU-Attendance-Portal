# BU Attendance Portal — Project Report

---

## 1. Introduction

### 1.1 Background

Bugema University currently relies on manual paper-based attendance tracking, which is time-consuming, error-prone, and difficult to audit. Lecturers spend valuable class time calling out names or passing around sign-in sheets, and the resulting records are hard to aggregate for reporting purposes.

The **BU Attendance Portal** is a web-based attendance management system developed to replace this manual process. It enables lecturers to generate unique QR codes for each lecture session, and students to scan those codes using their smartphones to record their attendance in real time. The system incorporates biometric fingerprint verification to prevent proxy attendance, GPS location checking to ensure students are physically present in the classroom, and role-based access control for Admins, Lecturers, Students, and the QA Office.

### 1.2 Problem Statement

- Manual attendance is slow and prone to human error
- Proxy attendance (one student signing for another) is difficult to prevent
- Attendance data is not easily accessible for analysis or reporting
- No centralised system for tracking student performance across courses

### 1.3 Objectives

1. Automate attendance recording using QR code scanning
2. Prevent proxy attendance through biometric (fingerprint/Face ID) verification
3. Provide real-time attendance dashboards for students, lecturers, and QA
4. Enable course management, enrollment, and assessment tracking
5. Generate printable attendance and analytics reports

---

## 2. System Overview

The BU Attendance Portal is a full-stack web application accessible from any device with a browser. It requires no app installation — students simply open the URL on their phone.

### 2.1 User Roles

| Role | Access |
|------|--------|
| **Admin** | Full system control — manage users, courses, semesters, settings |
| **Lecturer** | Create lectures, generate QR codes, view attendance, rate students |
| **Student** | Scan QR codes, view own attendance, rate lecturers |
| **QA Office** | Read-only analytics, course reports, teaching summaries |

### 2.2 Key Features

- **QR Code Attendance** — Lecturer generates a QR code per lecture; students scan it to mark attendance
- **Biometric Verification** — Students must verify with fingerprint or Face ID before attendance is recorded
- **GPS Location Check** — System verifies student is within the classroom radius before accepting scan
- **Course Management** — Admin creates courses, assigns lecturers, manages semesters
- **Enrollment Workflow** — Students request enrollment; admin approves or rejects
- **Rating System** — Students rate lecturers (1–10); lecturers rate students (1–10)
- **Analytics Dashboard** — QA office views attendance trends, at-risk students, lecturer performance
- **Printable Reports** — Course reports, attendance logs, and analytics reports with university branding
- **System Settings** — Admin configures system name and minimum attendance threshold

---

## 3. Tools & Technologies

### 3.1 Backend

| Tool | Purpose |
|------|---------|
| **Node.js** | JavaScript runtime environment |
| **Express.js** | Web framework for routing and middleware |
| **MySQL** | Relational database for persistent data storage |
| **mysql2** | MySQL driver for Node.js |
| **bcrypt** | Password hashing for secure authentication |
| **express-session** | Session management for user authentication |
| **qrcode** | QR code generation for lecture sessions |
| **uuid** | Unique token generation for QR codes |
| **nodemailer** | Email support for admin replies |
| **dotenv** | Environment variable management |

### 3.2 Frontend

| Tool | Purpose |
|------|---------|
| **HTML5 / CSS3** | Page structure and styling |
| **Vanilla JavaScript** | Client-side logic and API calls |
| **WebAuthn API** | Browser-native biometric authentication |
| **Geolocation API** | GPS location verification |
| **jsQR** | QR code scanning via device camera |
| **Chart.js** | Analytics charts and graphs |
| **Leaflet.js** | Interactive map for classroom location |

### 3.3 Development Tools

| Tool | Purpose |
|------|---------|
| **Jest** | Unit testing framework |
| **fast-check** | Property-based testing |
| **nodemon** | Auto-restart during development |
| **Cloudflare Tunnel / ngrok** | Expose local server for mobile testing |

---

## 4. System Architecture

```
Browser (Student / Lecturer / Admin / QA)
        │
        ▼
   Express.js Server (Node.js)
        │
        ├── /api/auth       → Authentication, user management, settings
        ├── /api/attendance → QR scanning, attendance records, analytics
        ├── /api/assessment → Student/lecturer assessments and ratings
        ├── /api/courses    → Course, semester, enrollment management
        └── /api/contact    → Contact messages
        │
        ▼
   MySQL Database (attendance_db)
```

### 4.1 Database Tables

| Table | Description |
|-------|-------------|
| `users` | All system users with roles |
| `lectures` | Lecture sessions with QR tokens |
| `attendance` | Student scan records |
| `courses` | Course definitions |
| `semesters` | Academic semesters |
| `course_enrollments` | Student-course enrollment with approval status |
| `course_ratings` | Student→Lecturer and Lecturer→Student ratings |
| `student_assessments` | Academic scores and grades |
| `lecturer_assessments` | QA assessments of lecturers |
| `webauthn_credentials` | Biometric credentials per user |
| `contact_messages` | Support messages |
| `system_settings` | Configurable system parameters |

---

## 5. System Features in Detail

### 5.1 Attendance Recording Flow

1. Lecturer logs in → creates a lecture for a course → system generates QR code
2. Lecturer displays QR code on screen/projector
3. Student opens the portal on their phone → goes to My Attendance
4. Student clicks **Start Camera Scanner** → scans the QR code
5. System prompts for **biometric verification** (fingerprint/Face ID)
6. After successful biometric, system checks **GPS location**
7. If within classroom radius → attendance is recorded
8. Student sees confirmation: "Attendance recorded successfully"

### 5.2 Security Features

- Passwords hashed with bcrypt (10 salt rounds)
- Session-based authentication with secure cookies in production
- Biometric verification required before every scan
- GPS radius check prevents remote scanning
- Duplicate scan prevention (UNIQUE constraint per student per lecture)
- Role-based access control on all API endpoints
- Parameterized SQL queries prevent SQL injection

### 5.3 Reporting

- **Lecturer**: Per-course attendance breakdown, printable course reports with ratings
- **QA Office**: System-wide analytics, at-risk students, lecturer performance, course reports
- **Student**: Personal attendance history with percentage per course
- All reports include Bugema University branding (logo, address, date)

---

## 6. Testing

### 6.1 Unit Tests

| Test Suite | Tests | Status |
|-----------|-------|--------|
| `validator.test.js` | 12 tests — form validation | ✅ All Pass |
| `nav.test.js` | 5 tests — navigation highlighting | ✅ All Pass |
| **Total** | **17 tests** | **✅ All Pass** |

### 6.2 Manual Testing

All major user flows were manually tested:
- Registration and login for all roles
- QR code generation and scanning
- Biometric registration and verification
- Course enrollment and approval
- Rating submission and update
- Report generation and printing
- System settings persistence

---

## 7. Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| SQLite not suitable for cloud hosting | Migrated to MySQL with full schema rewrite |
| Self-signed SSL certificates causing browser warnings | Removed cert logic; hosting platforms provide HTTPS |
| Biometric API requires HTTPS | Enforced HTTPS in production via hosting platform |
| Proxy attendance | Combined biometric + GPS verification |
| Session data stale after user edit | `/api/auth/me` now reads fresh from database |
| Duplicate lectures being created | Added unique constraint check on course + period |

---

## 8. Conclusion

The BU Attendance Portal successfully automates the attendance tracking process at Bugema University. It eliminates manual sign-in sheets, prevents proxy attendance through biometric verification, and provides comprehensive analytics for administrators and the QA office. The system is built with modern web technologies, is mobile-friendly, and is ready for cloud deployment.

---

*Bugema University — BU Attendance Portal*
*Academic Year 2025/2026*
