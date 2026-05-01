# BU Attendance Portal — Presentation Slides

---

## SLIDE 1 — Title Slide

**BUGEMA UNIVERSITY**
*Excellence in Service*

---

# BU ATTENDANCE PORTAL
### A Web-Based QR Code Attendance Management System

---

**Presented by:** [Your Name]
**Programme:** Bachelor of Science in Computer Science
**Faculty:** Computing & Information Systems
**Academic Year:** 2025/2026
**Supervisor:** [Supervisor Name]

**Live System:** https://bu-attendance-portal-1.onrender.com

---

## SLIDE 2 — Introduction

### What is the BU Attendance Portal?

The BU Attendance Portal is a fully web-based attendance management system developed specifically for Bugema University. It replaces the traditional paper-based attendance method with a modern, secure, and efficient digital solution.

The system allows lecturers to generate unique QR codes for each lecture session. Students scan these codes using their smartphones to mark their attendance — verified through biometric authentication and GPS location — ensuring accuracy and eliminating proxy attendance.

The portal is accessible from any device with a browser and requires no application installation.

---

## SLIDE 3 — Problem Statement

### The Challenge with Manual Attendance

Despite advances in technology, many universities including Bugema University still rely on manual, paper-based attendance systems. This approach presents several critical challenges:

- **Time Inefficiency** — Taking manual attendance consumes 5 to 10 minutes of valuable lecture time per session
- **Proxy Attendance** — Students can sign on behalf of absent colleagues, making records unreliable
- **Data Loss Risk** — Paper records are easily misplaced, damaged, or destroyed
- **No Real-Time Visibility** — Lecturers and administrators cannot monitor attendance trends as they happen
- **Fragmented Records** — Attendance data is scattered across departments with no central repository
- **Delayed Reporting** — Generating attendance reports requires significant manual effort and time

These challenges directly affect academic performance monitoring, student accountability, and institutional decision-making.

---

## SLIDE 4 — Objectives

### What the System Aims to Achieve

**Primary Objective:**
To design and implement a secure, web-based attendance management system for Bugema University that automates attendance recording using QR codes and biometric verification.

**Specific Objectives:**
1. Develop a role-based access system for Admins, Lecturers, Students, and QA Officers
2. Implement QR code generation and scanning for lecture attendance
3. Integrate biometric authentication (fingerprint and Face ID) to prevent proxy attendance
4. Incorporate GPS location verification to confirm physical presence in the classroom
5. Provide real-time dashboards and downloadable attendance reports
6. Deploy the system on a cloud platform accessible from any device

---

## SLIDE 5 — How the System Works

### The Attendance Process — Step by Step

**Step 1 — Lecturer Creates a Session**
The lecturer logs in, selects a course, and creates a new lecture session. The system automatically generates a unique QR code tied to that session, with an optional expiry time.

**Step 2 — QR Code is Displayed**
The lecturer displays the QR code on a projector or screen at the front of the classroom.

**Step 3 — Student Scans the QR Code**
The student opens the portal on their smartphone, navigates to the scan page, and uses the camera to scan the QR code.

**Step 4 — Biometric Verification**
The student is prompted to verify their identity using their device's biometric sensor — fingerprint on Android or Face ID on iPhone.

**Step 5 — GPS Location Check**
The system checks the student's GPS coordinates against the classroom location. The student must be within the defined radius to proceed.

**Step 6 — Attendance Recorded**
If all checks pass, attendance is recorded instantly in the database with a timestamp. The student receives a confirmation message.

---

## SLIDE 6 — User Roles & Access

### Role-Based Access Control

The system supports four distinct user roles, each with a dedicated dashboard and specific permissions:

| Role | Access Level | Key Capabilities |
|------|-------------|-----------------|
| **Administrator** | Full system access | Manage all users, create courses and semesters, configure system settings, view all reports |
| **Lecturer** | Course-level access | Create lecture sessions, generate QR codes, view and export attendance records, assess and rate students |
| **Student** | Personal access | Scan QR codes to mark attendance, view personal attendance history, rate lecturers |
| **QA Officer** | Read-only analytics | View attendance analytics, identify at-risk students, monitor lecturer performance and ratings |

Access is enforced server-side — users cannot access pages outside their role.

---

## SLIDE 7 — Key Features

### System Feature Overview

**Attendance Management**
- QR code generation per lecture with optional expiry
- Camera-based QR scanning on any smartphone
- GPS classroom radius verification
- Duplicate attendance prevention

**Security & Authentication**
- Secure registration with bcrypt password hashing
- Biometric login via WebAuthn (fingerprint / Face ID)
- Role-based session management
- HTTPS enforced on all connections

**Academic Management**
- Course and semester creation and management
- Student enrollment with approval workflow
- Lecturer and student rating system
- Configurable attendance threshold per institution

**Reporting & Analytics**
- Real-time attendance dashboards with charts
- At-risk student identification
- University-branded printable attendance reports
- QA performance analytics

**User Experience**
- Responsive design — works on mobile, tablet, and desktop
- Bugema University branding throughout
- Floating WhatsApp support button for instant help
- No app installation required

---

## SLIDE 8 — Technology Stack

### Tools and Technologies Used

**Frontend (Client Side)**

| Technology | Purpose |
|-----------|---------|
| HTML5 & CSS3 | Page structure and styling |
| Vanilla JavaScript | Dynamic interactions and API calls |
| WebAuthn API | Biometric fingerprint and Face ID |
| Geolocation API | GPS classroom verification |
| html5-qrcode | Camera-based QR code scanning |

**Backend (Server Side)**

| Technology | Purpose |
|-----------|---------|
| Node.js | JavaScript runtime environment |
| Express.js | Web server and API routing |
| MySQL | Relational database (13 tables) |
| bcrypt | Secure password hashing |
| express-session | User session management |
| qrcode | QR code image generation |

**Infrastructure**

| Service | Purpose |
|---------|---------|
| Render | Cloud hosting and deployment |
| FreeSQLDatabase | Cloud MySQL database |
| GitHub | Version control and auto-deployment |

---

## SLIDE 9 — Database Design

### Database Structure Overview

The system uses a relational MySQL database with 13 tables:

| Table | Description |
|-------|-------------|
| users | All system users with roles |
| lectures | Lecture sessions with QR tokens |
| attendance | Attendance records per student per lecture |
| courses | University courses |
| semesters | Academic semesters |
| course_enrollments | Student course registrations |
| student_assessments | Academic scores and grades |
| lecturer_assessments | Lecturer performance evaluations |
| student_lecturer_ratings | Student ratings of lecturers |
| course_ratings | Course quality ratings |
| webauthn_credentials | Biometric credential storage |
| contact_messages | Support messages from users |
| system_settings | Configurable system parameters |

---

## SLIDE 10 — System Architecture

### How the Components Connect

```
┌─────────────────────────────────────────────────────┐
│              USER DEVICES (Any Browser)             │
│     Student │ Lecturer │ Admin │ QA Officer         │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (Secure Connection)
┌──────────────────────▼──────────────────────────────┐
│              RENDER CLOUD SERVER                    │
│           Express.js Application                    │
│  ┌──────────┐ ┌───────────┐ ┌──────────────────┐   │
│  │/api/auth │ │/api/attend│ │/api/courses       │   │
│  └──────────┘ └───────────┘ └──────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │         Static Files (HTML/CSS/JS)           │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│         FreeSQLDatabase — MySQL 5.5                 │
│         sql12.freesqldatabase.com                   │
│         13 Tables — Persistent Cloud Storage        │
└─────────────────────────────────────────────────────┘
```

GitHub pushes to main branch → Render auto-deploys within 2 minutes

---

## SLIDE 11 — Screenshot: Home Page

### Public Landing Page

[INSERT SCREENSHOT — Home page]

**What this page shows:**
- Bugema University logo prominently displayed at the top
- Welcome message: "Welcome to BU Attendance Portal"
- Brief description of the system's purpose
- "Go to Login" button for returning users
- "Get Support" button linking to the contact page
- Floating WhatsApp button in the bottom-right corner for instant support

---

## SLIDE 12 — Screenshot: Login & Registration

### Student Entry Points

[INSERT SCREENSHOT — Login page]

**Login Page:**
- Registration number field with placeholder: e.g. 22/BCC/BU/R/0014
- Password field with placeholder: Enter your password
- Redirects to the correct dashboard based on user role after login

[INSERT SCREENSHOT — Register page]

**Registration Page:**
- Username, registration number, and password fields
- After account creation, proceeds to biometric registration
- First registered user automatically becomes Administrator

---

## SLIDE 13 — Screenshot: Student Dashboard

### Student View After Login

[INSERT SCREENSHOT — Student dashboard]

**What students can do:**
- View their personal attendance percentage per course
- See a list of all attended and missed lectures
- Access the QR scanner to mark attendance
- Rate their lecturers
- View their academic assessment scores

---

## SLIDE 14 — Screenshot: Lecturer Panel

### Lecturer View After Login

[INSERT SCREENSHOT — Lecturer panel]

**What lecturers can do:**
- Create new lecture sessions for their courses
- View the generated QR code to display to students
- Monitor real-time attendance as students scan
- Export attendance records
- Assess and grade students

---

## SLIDE 15 — Screenshot: Admin Panel

### Administrator View After Login

[INSERT SCREENSHOT — Admin panel]

**What the administrator can do:**
- Create and manage all user accounts (students, lecturers, QA officers)
- Set up courses and academic semesters
- Configure system settings (portal name, attendance threshold)
- View all system-wide attendance and performance data
- Reply to contact messages from users

---

## SLIDE 16 — Screenshot: QA Dashboard & Contact Page

### QA Officer View and Support Page

[INSERT SCREENSHOT — QA dashboard]

**QA Officer capabilities:**
- View attendance analytics across all courses
- Identify students at risk of failing due to low attendance
- Monitor lecturer performance ratings
- Access comprehensive reports for accreditation purposes

[INSERT SCREENSHOT — Contact page]

**Contact Page:**
- Bugema University logo displayed
- Direct WhatsApp link for instant support
- Floating WhatsApp button available on all pages

---

## SLIDE 17 — Challenges & Solutions

### Problems Encountered During Development and Deployment

| # | Challenge | Root Cause | Solution Applied |
|---|-----------|-----------|-----------------|
| 1 | Database error: `ER_INVALID_DEFAULT` on `created_at` column | FreeSQLDatabase runs MySQL 5.5 which does not support `DATETIME DEFAULT NOW()` | Changed all `DATETIME` columns with defaults to `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` which is supported in all MySQL versions |
| 2 | Login and sessions not working after deployment on Render | Render uses a reverse proxy for HTTPS. Express did not trust the proxy, so secure cookies were rejected | Added `app.set('trust proxy', 1)` in server.js before the session middleware |
| 3 | Admin account inaccessible — password unknown | The admin account was created during testing with an unknown password | Used phpMyAdmin SQL console to run an `UPDATE` query that replaced the password hash with a known bcrypt hash |
| 4 | Bugema logo appeared dark and colours were lost | The `mix-blend-mode: multiply` CSS property was blending the logo colours into the blue background | Removed the blend mode and used the original `Bu.image.jpeg` file with its white background, displayed with `border-radius: 50%` |
| 5 | Render not triggering auto-deployment | Local code changes had not been committed and pushed to GitHub | Committed all pending changes and pushed to the main branch, triggering Render's auto-deploy |

---

## SLIDE 18 — Testing

### Quality Assurance and Testing Results

**Automated Unit Tests**

| Test Suite | Number of Tests | Result |
|-----------|----------------|--------|
| Form Validation (validator.test.js) | 12 tests | All Passed |
| Navigation Logic (nav.test.js) | 5 tests | All Passed |
| **Total** | **17 tests** | **100% Pass Rate** |

**Manual Testing Coverage**

All the following user flows were manually tested and verified on the live deployment:

- Student registration and biometric setup
- Login for all four user roles (Admin, Lecturer, Student, QA)
- QR code generation by lecturer
- QR code scanning by student on mobile device
- GPS location verification
- Course creation and student enrollment
- Attendance report generation
- Rating submission by students and lecturers
- Admin user management and settings configuration
- Contact message submission and admin reply

---

## SLIDE 19 — Deployment

### How the System is Deployed and Maintained

**Version Control — GitHub**
All source code is stored in a GitHub repository. Every change is committed with a descriptive message and pushed to the main branch.

**Continuous Deployment — Render**
Render is connected to the GitHub repository. Every push to the main branch automatically triggers a new build and deployment. The system is live within approximately 2 minutes of a code push.

**Database — FreeSQLDatabase**
The MySQL database is hosted on FreeSQLDatabase (sql12.freesqldatabase.com). Connection credentials are stored securely as environment variables on Render — never hardcoded in the source code.

**Environment Variables on Render**

| Variable | Purpose |
|----------|---------|
| DB_HOST | Database server address |
| DB_PORT | Database port (3306) |
| DB_USER | Database username |
| DB_PASSWORD | Database password |
| DB_NAME | Database name |
| SESSION_SECRET | Secret key for session encryption |
| NODE_ENV | Set to "production" |

---

## SLIDE 20 — Conclusion

### Summary and Impact

**What Was Achieved:**
- A fully functional, live, web-based attendance management system for Bugema University
- Biometric and GPS verification eliminates proxy attendance completely
- Four role-based dashboards serving all university stakeholders
- Secure cloud deployment accessible from any device, anywhere
- 17 automated tests with 100% pass rate confirming system reliability

**Academic Impact:**
The BU Attendance Portal transforms how Bugema University manages lecture attendance. It saves lecturers significant time, provides administrators with accurate real-time data, gives the QA office the analytics needed for institutional reporting, and holds students accountable for their attendance in a fair and verifiable way.

**Future Enhancements:**
- Email and SMS notifications for low attendance alerts
- Integration with the university's student information system
- Offline mode for areas with poor internet connectivity
- Advanced analytics with semester-over-semester comparisons

---

## SLIDE 21 — Thank You

**THANK YOU**

*Questions and Live Demonstration*

---

**BU Attendance Portal**
Bugema University — 2025/2026

Live System: https://bu-attendance-portal-1.onrender.com

Bugema University
P.O. Box 6529, Kampala, Uganda
*Excellence in Service*
