# Implementation Plan: Attendance System Website

## Overview

Incremental build of a multi-page attendance system: static HTML/CSS/JS frontend served by an Express + SQLite backend. Tasks progress from project scaffolding through frontend pages, styling, interactivity, API integration, authentication, and database wiring.

## Tasks

- [x] 1. Scaffold project structure and install dependencies
  - Create directory layout: `public/`, `public/css/`, `public/js/`, `routes/`, `db/`, `tests/unit/`, `tests/property/`
  - Create `package.json` with dependencies: `express`, `better-sqlite3`, `bcrypt`, `express-session`, and devDependencies: `jest`, `fast-check`
  - Create `server.js` with Express static file serving from `/public` and JSON middleware
  - _Requirements: 1.1, 8.1, 9.1_

- [x] 2. Build HTML page shells and navigation bar
  - [x] 2.1 Create `public/index.html`, `public/about.html`, `public/contact.html`, `public/login.html`, and `public/dashboard.html` with shared `<nav>` markup containing links to all pages
    - Each page must include `<script src="/js/nav.js">` and link to `/css/styles.css`
    - Home page must include a welcome message, a summary paragraph, and a button for the alert interaction
    - About page must include descriptive content about the attendance system
    - Contact page must include the contact form with name input, email input, and submit button with proper `<label>` associations
    - Login page must include username input, password input, and submit button
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 4.1, 4.5, 8.1_

  - [x] 2.2 Implement `public/js/nav.js` active link highlighting
    - On `DOMContentLoaded`, compare `window.location.pathname` to each `<a>` href in the nav and add `active` class to the matching link
    - _Requirements: 2.4_

  - [ ]* 2.3 Write property test for active nav link (Property 4)
    - **Property 4: Active nav link matches current path**
    - **Validates: Requirements 2.4**

- [x] 3. Implement CSS styling and responsive layout
  - [x] 3.1 Create `public/css/styles.css` with base styles
    - Define CSS custom properties (`--primary-color`, `--font-family`, etc.) for consistent theming
    - Apply background color, font family, font size, and font color globally
    - Style nav bar, cards, forms, and sections with borders, box shadows, and CSS transitions
    - Use Flexbox or Grid for page layout
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.2_

  - [x] 3.2 Add responsive media queries
    - At `max-width: 768px`: collapse nav into a stacked/mobile-friendly layout, stack multi-column content to single column
    - At `max-width: 480px`: further reduce font sizes and padding
    - _Requirements: 5.1, 5.3, 5.4_

- [x] 4. Implement JavaScript interactivity
  - [x] 4.1 Add alert button handler to `public/index.html` (inline or in a dedicated `home.js`)
    - Attach a click listener to the Home page button that calls `alert()`
    - _Requirements: 6.1_

  - [x] 4.2 Add dynamic text element and handler to the Home page
    - Add a `<span>` or `<p>` with an `id` for dynamic text and a trigger element (button or input)
    - On interaction, update the element's `textContent` without reloading the page
    - _Requirements: 6.3_

  - [ ]* 4.3 Write property test for dynamic text update (Property 5)
    - **Property 5: Dynamic text update without reload**
    - **Validates: Requirements 6.3**

- [x] 5. Implement contact form validation
  - [x] 5.1 Create `public/js/validator.js` with `validateContactForm` and `validateLoginForm`
    - `validateContactForm(name, email)`: returns `{ valid, errors }` — name must be non-empty after trim, email must match RFC-5322-like regex
    - `validateLoginForm(username, password)`: returns `{ valid, errors }` — both fields must be non-empty after trim
    - Export both functions for use in form scripts and tests
    - _Requirements: 4.2, 4.3, 4.4, 8.4_

  - [x] 5.2 Wire `validateContactForm` to the contact form submit event
    - On submit, call `validateContactForm`; if invalid, display inline error messages below the relevant fields and block submission; if valid, display a confirmation message
    - _Requirements: 4.2, 4.3, 4.4, 6.2_

  - [ ]* 5.3 Write property tests for contact form validator (Properties 1, 2, 3)
    - **Property 1: Valid contact form is accepted**
    - **Property 2: Empty name is rejected**
    - **Property 3: Invalid email is rejected**
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [ ]* 5.4 Write unit tests for `validateContactForm` and `validateLoginForm`
    - Test known valid inputs, empty string vs. whitespace-only, malformed emails
    - _Requirements: 4.2, 4.3, 4.4, 8.4_

  - [ ]* 5.5 Write property test for login form empty-field validation (Property 8)
    - **Property 8: Login form empty-field validation**
    - **Validates: Requirements 8.4**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Set up database module and schema
  - [x] 7.1 Create `db/database.js` with `initDB()` and `getDB()`
    - `initDB()` creates `users` and `attendance` tables if they do not exist using the SQL schema from the design
    - `getDB()` returns the `better-sqlite3` instance
    - Call `initDB()` on server startup in `server.js`
    - _Requirements: 9.1_

  - [ ]* 7.2 Write unit tests for database initialization
    - Verify tables are created and schema matches expected columns
    - _Requirements: 9.1_

- [x] 8. Implement authentication backend routes
  - [x] 8.1 Create `routes/auth.js` with `POST /api/auth/register`
    - Validate required fields; return 400 if missing
    - Check for duplicate username/email; return 409 if exists
    - Hash password with `bcrypt`, insert user record, return 201
    - _Requirements: 9.1, 9.2_

  - [x] 8.2 Add `POST /api/auth/login` to `routes/auth.js`
    - Retrieve user by username from DB; return 401 if not found
    - Compare submitted password to stored bcrypt hash; return 401 if mismatch
    - On success, set `req.session.userId` and `req.session.username`; return 200
    - _Requirements: 8.2, 8.3, 9.3_

  - [x] 8.3 Add `POST /api/auth/logout` and `GET /api/auth/me` to `routes/auth.js`
    - Logout destroys the session and returns 200
    - `/me` returns current session user or 401 if unauthenticated
    - _Requirements: 8.5_

  - [x] 8.4 Add auth guard middleware in `server.js` for `/dashboard.html` and `/api/attendance`
    - Redirect unauthenticated requests for `/dashboard.html` to `/login.html`
    - Return 401 JSON for unauthenticated requests to `/api/attendance`
    - _Requirements: 8.5_

  - [ ]* 8.5 Write property tests for authentication routes (Properties 9, 10, 11, 12)
    - **Property 9: Valid credentials produce authenticated session**
    - **Property 10: Invalid credentials are rejected**
    - **Property 11: Protected routes reject unauthenticated requests**
    - **Property 12: User registration stores all required fields**
    - **Validates: Requirements 8.2, 8.3, 8.5, 9.1, 9.2**

  - [ ]* 8.6 Write unit tests for auth routes
    - Test `GET /api/auth/me` without session returns 401
    - Test `POST /api/auth/register` with duplicate username returns 409
    - Test `POST /api/auth/login` with wrong password returns 401
    - _Requirements: 8.2, 8.3, 9.2_

- [x] 9. Implement attendance backend routes and API proxy
  - [x] 9.1 Create `routes/attendance.js` with `GET /api/attendance`
    - Require authenticated session; return 401 if not authenticated
    - Query `attendance` table for records belonging to `req.session.userId`
    - Return records as JSON array; wrap DB call in try/catch and return 500 on failure
    - _Requirements: 9.4, 9.5_

  - [x] 9.2 Add `GET /api/attendance-feed` proxy to `routes/attendance.js`
    - Use `fetch()` to call the designated external API endpoint
    - Parse response as JSON and return to client; on failure return descriptive error JSON
    - _Requirements: 7.1, 7.3_

  - [ ]* 9.3 Write property tests for attendance routes (Properties 13, 14)
    - **Property 13: Attendance records round-trip through database**
    - **Property 14: Database errors produce descriptive error responses**
    - **Validates: Requirements 9.4, 9.5**

  - [ ]* 9.4 Write unit tests for attendance routes
    - Test authenticated `GET /api/attendance` returns correct records
    - Test unauthenticated request returns 401
    - _Requirements: 9.4, 8.5_

- [x] 10. Implement frontend API client and dashboard
  - [x] 10.1 Create `public/js/api-client.js` with `fetchAttendanceData()`
    - Call `GET /api/attendance-feed`; on success return parsed JSON array
    - On non-2xx or network error, throw an `Error` with a descriptive message
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.2 Create `public/js/dashboard.js`
    - On page load, call `fetchAttendanceData()` and render records into a `<table>` inside `#attendance-container`
    - On error, render the error message string into `#attendance-container`
    - _Requirements: 7.2, 7.3, 9.4_

  - [x] 10.3 Create `public/dashboard.html` attendance view
    - Include `#attendance-container` div, link `dashboard.js` and `api-client.js`
    - _Requirements: 7.2, 9.4_

  - [ ]* 10.4 Write property tests for API client (Properties 6, 7)
    - **Property 6: API response parse and render round-trip**
    - **Property 7: API error produces descriptive message**
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 11. Wire login form to backend and handle session state
  - [x] 11.1 Add login form submit handler (inline script or `login.js`)
    - Call `validateLoginForm` before sending any request; display inline errors if invalid
    - On valid input, POST credentials to `/api/auth/login`; on success redirect to `/dashboard.html`; on 401 display authentication failure message
    - _Requirements: 8.1, 8.3, 8.4_

  - [x] 11.2 Add session-aware UI state to pages
    - On dashboard load, call `GET /api/auth/me`; if 401 redirect to `/login.html`
    - Display username in dashboard header when authenticated
    - Wire logout button to `POST /api/auth/logout` then redirect to `/login.html`
    - _Requirements: 8.5_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use **fast-check** with a minimum of 100 iterations each
- Unit and property tests both run via `npx jest --run`
- All backend route handlers wrap DB calls in try/catch; no stack traces are exposed to clients
