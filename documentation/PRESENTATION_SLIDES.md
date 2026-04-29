# BU Attendance Portal — Presentation Slides

---

## SLIDE 1 — Title Slide

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│           BUGEMA UNIVERSITY                         │
│                                                     │
│         BU ATTENDANCE PORTAL                        │
│    Web-Based QR Code Attendance System              │
│                                                     │
│    Faculty of Computing & Information Systems       │
│    Academic Year 2025/2026                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## SLIDE 2 — The Problem

**Manual Attendance is Broken**

- ❌ Time-consuming — wastes 5–10 minutes per class
- ❌ Proxy attendance — students sign for absent friends
- ❌ Paper records — easily lost, hard to analyse
- ❌ No real-time visibility — lecturers can't see trends
- ❌ No central system — data scattered across departments

> *"A lecturer with 40 students spends over 3 hours per semester just taking attendance manually."*

---

## SLIDE 3 — Our Solution

**BU Attendance Portal**

A web-based system that:

- ✅ Generates QR codes per lecture — scan to attend
- ✅ Verifies identity with biometric (fingerprint/Face ID)
- ✅ Checks GPS location — must be in the classroom
- ✅ Records attendance instantly in the database
- ✅ Provides real-time dashboards and reports
- ✅ Works on any smartphone — no app install needed

---

## SLIDE 4 — How It Works

**The Attendance Flow**

```
1. LECTURER creates lecture → QR code generated
         ↓
2. QR CODE displayed on projector/screen
         ↓
3. STUDENT opens portal on phone → scans QR
         ↓
4. BIOMETRIC prompt → student verifies fingerprint
         ↓
5. GPS CHECK → confirms student is in classroom
         ↓
6. ATTENDANCE RECORDED ✓ — instant confirmation
```

---

## SLIDE 5 — User Roles

**Four Role-Based Dashboards**

| Role | What They Can Do |
|------|-----------------|
| 👤 **Admin** | Manage users, courses, semesters, system settings |
| 👨‍🏫 **Lecturer** | Create lectures, generate QR codes, view & export attendance, rate students |
| 🎓 **Student** | Scan QR codes, view attendance history, rate lecturers |
| 📊 **QA Office** | View analytics, at-risk students, lecturer performance reports |

---

## SLIDE 6 — Key Features

**Feature Highlights**

- 📱 **QR Code Scanning** — Camera-based, works on all phones
- 🔐 **Biometric Security** — Fingerprint / Face ID via WebAuthn
- 📍 **GPS Verification** — Classroom radius check
- 📚 **Course Management** — Enrollment requests and approvals
- ⭐ **Rating System** — Students rate lecturers, lecturers rate students
- 📊 **Analytics Dashboard** — Charts, trends, at-risk alerts
- 🖨️ **Printable Reports** — University-branded PDF reports
- ⚙️ **System Settings** — Configurable name and attendance threshold

---

## SLIDE 7 — Technology Stack

**Built With Modern Web Technologies**

```
FRONTEND                    BACKEND
─────────────────           ─────────────────
HTML5 / CSS3                Node.js
Vanilla JavaScript          Express.js
WebAuthn API                MySQL Database
Geolocation API             bcrypt (security)
jsQR (camera scan)          express-session
Chart.js (analytics)        qrcode (generation)
Leaflet.js (maps)           uuid (tokens)
```

**Testing:** Jest (17 unit tests — all passing ✅)

---

## SLIDE 8 — Security

**Multi-Layer Security**

```
Layer 1: PASSWORD
  → bcrypt hashed, never stored in plain text

Layer 2: SESSION
  → Secure server-side sessions, role-based access

Layer 3: BIOMETRIC
  → WebAuthn fingerprint/Face ID — device-level security

Layer 4: GPS
  → Must be within classroom radius to scan

Layer 5: DATABASE
  → Parameterized queries — SQL injection proof
  → Unique constraints — no duplicate attendance
```

---

## SLIDE 9 — System Architecture

**Architecture Overview**

```
┌─────────────────────────────────────────┐
│           Web Browser (Any Device)      │
│   Student │ Lecturer │ Admin │ QA       │
└──────────────────┬──────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────┐
│         Express.js Server               │
│  /api/auth  /api/attendance             │
│  /api/courses  /api/assessment          │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│           MySQL Database                │
│  13 tables — users, lectures,           │
│  attendance, courses, ratings...        │
└─────────────────────────────────────────┘
```

---

## SLIDE 10 — Screenshots

**System Screens**

1. **Home Page** — Welcome screen with login button
2. **Login Page** — Registration number + password
3. **Student Dashboard** — QR scanner, attendance stats, rate lecturer
4. **Lecturer Dashboard** — Create lectures, QR codes, attendance logs
5. **Admin Dashboard** — User management, courses, settings
6. **QA Dashboard** — Analytics charts, at-risk students, reports
7. **Attendance Report** — University-branded printable PDF

*(See screenshots in documentation/screenshots/ folder)*

---

## SLIDE 11 — Testing Results

**Quality Assurance**

| Test Type | Tests | Result |
|-----------|-------|--------|
| Form Validation | 12 unit tests | ✅ All Pass |
| Navigation | 5 unit tests | ✅ All Pass |
| Manual Testing | All user flows | ✅ Verified |
| **Total** | **17 tests** | **✅ 100% Pass** |

**Manual test coverage:**
- Registration & login for all 4 roles
- QR generation and scanning
- Biometric registration and verification
- Enrollment workflow
- Rating submission and update
- Report generation

---

## SLIDE 12 — Challenges & Solutions

**Problems We Solved**

| Challenge | Solution |
|-----------|----------|
| Proxy attendance | Biometric + GPS verification |
| Database persistence on cloud | Migrated from SQLite to MySQL |
| HTTPS required for biometrics | Cloud hosting provides SSL automatically |
| Stale session after profile edit | `/api/auth/me` reads fresh from DB |
| Duplicate lecture creation | Unique constraint on course + period |
| Old broken ngrok version | Switched to Cloudflare Tunnel |

---

## SLIDE 13 — Deployment

**Going Live**

**Current (Local + Tunnel):**
```
node server.js → localhost:3000
cloudflared tunnel → public HTTPS URL
```

**Production (Cloud):**
```
GitHub → Railway.app
Node.js server + MySQL database
Permanent URL: https://bu-attendance.up.railway.app
Always online — no PC needed
```

---

## SLIDE 14 — Conclusion

**What We Achieved**

- ✅ Fully functional web-based attendance system
- ✅ Biometric + GPS security — proxy attendance eliminated
- ✅ Real-time dashboards for all user roles
- ✅ Comprehensive reporting with university branding
- ✅ Mobile-friendly — works on any smartphone
- ✅ Ready for cloud deployment

**Impact:**
> Saves lecturers hours of manual work, ensures accurate attendance records, and gives the QA office real-time visibility into teaching quality and student engagement.

---

## SLIDE 15 — Thank You

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              THANK YOU                              │
│                                                     │
│         BU Attendance Portal                        │
│    Bugema University — 2025/2026                    │
│                                                     │
│    Questions & Demonstration                        │
│                                                     │
│    Live URL: https://[your-deployment-url]          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

*Presentation prepared for: Faculty of Computing & Information Systems*
*Bugema University, P.O. Box 6529 Kampala, Uganda*
