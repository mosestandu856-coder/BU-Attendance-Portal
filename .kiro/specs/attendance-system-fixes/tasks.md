# Implementation Plan

- [ ] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - GPS Null Bypass, Duplicate Period Normalisation, Single-Select UI
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behaviour — they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) to ensure reproducibility

  **Bug 2 — GPS null bypass (routes/attendance.js `POST /scan`)**
  - Create `tests/property/gps-enforcement.test.js`
  - Scope: `isBugCondition_GPS(X)` where `X.lecture_has_location = true AND (X.student_lat = null OR X.student_lng = null)`
  - Use `fast-check` to generate lecture objects with `class_lat`/`class_lng` set (non-null) paired with `student_lat: null, student_lng: null`
  - Call the scan handler (via supertest or direct handler invocation) with a valid QR token for a lecture that has `class_lat`/`class_lng` set, passing `student_lat: null, student_lng: null`
  - Assert: response status is 403 AND error message contains "GPS" AND no attendance row is inserted
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (attendance is recorded instead of rejected — confirms the `&&` short-circuit bug)
  - Document counterexample: `{ student_lat: null, student_lng: null, lecture_class_lat: 0.3476, lecture_class_lng: 32.5825 }` → attendance row inserted (bug confirmed)

  **Bug 3 — Duplicate period normalisation (routes/attendance.js `POST /lectures`)**
  - Create `tests/property/duplicate-lecture.test.js`
  - Scope: `isBugCondition_DuplicateLecture(X)` where normalised period matches an existing lecture for same `course_id` + `created_by`
  - Use `fast-check` to generate period strings and their case/whitespace variants (e.g. `"Monday 8:00–10:00 AM"` → `"monday  8:00–10:00 am"`)
  - Call `POST /api/attendance/lectures` twice: first with the original period, second with the normalisation-variant period, same `course_id` and `created_by`
  - Assert: second call returns HTTP 409 AND no new lecture row is inserted
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (second lecture is created — confirms raw string comparison bug)
  - Document counterexample: `{ period: "Monday 8:00–10:00 AM" }` then `{ period: "monday  8:00–10:00 am" }` → second lecture created (bug confirmed)

  **Bug 1 — Single-select UI (public/dashboard.html)**
  - Create `tests/unit/enrollment-ui.test.js` (jsdom environment)
  - Scope: `isBugCondition_CourseSelection(X)` where `X.ui_control_type = 'single-select'`
  - Load the `#enroll-select` element from `dashboard.html` and assert it has the `multiple` attribute
  - Also assert that selecting > 8 options triggers a validation error without making an API call
  - Run on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (`multiple` attribute absent — confirms single-select bug)
  - Document counterexample: `<select id="enroll-select">` has no `multiple` attribute (bug confirmed)

  - Mark task complete when all three exploration tests are written, run, and failures are documented
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.2_

- [~] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - In-Radius GPS Scan, No-Location Lecture Scan, Unique Period Creation, Single Valid Enrollment
  - **IMPORTANT**: Follow observation-first methodology — observe behaviour on UNFIXED code for non-buggy inputs first
  - **GOAL**: Capture baseline behaviour that must not regress after the fix

  **Preservation 1 — In-radius GPS scan (Bug 2 non-buggy path)**
  - Create `tests/property/gps-preservation.test.js`
  - Scope: `NOT isBugCondition_GPS(X)` — cases where `student_lat` and `student_lng` are non-null AND student is within the allowed radius
  - Observe on UNFIXED code: `POST /scan` with valid GPS inside radius → attendance recorded with `location_valid = 1`
  - Use `fast-check` to generate `(student_lat, student_lng)` pairs within a fixed radius of a known classroom location
  - Assert: attendance is recorded with `location_valid = 1` for all generated in-radius coordinates
  - Verify test PASSES on UNFIXED code (confirms baseline)
  - _Requirements: 3.3_

  **Preservation 2 — No-location lecture scan (Bug 2 edge case)**
  - Add to `tests/property/gps-preservation.test.js`
  - Scope: lecture has `class_lat = null` / `class_lng = null` — GPS enforcement is not applicable
  - Observe on UNFIXED code: `POST /scan` with `student_lat: null` for a lecture without classroom location → attendance recorded
  - Assert: attendance is recorded regardless of student GPS when lecture has no location
  - Verify test PASSES on UNFIXED code (confirms baseline)
  - _Requirements: 3.4_

  **Preservation 3 — Unique period lecture creation (Bug 3 non-buggy path)**
  - Create `tests/property/lecture-creation-preservation.test.js`
  - Scope: `NOT isBugCondition_DuplicateLecture(X)` — period strings that do not match any existing lecture after normalisation
  - Observe on UNFIXED code: `POST /lectures` with a unique period → HTTP 201, lecture created, QR returned
  - Use `fast-check` to generate random period strings that are guaranteed unique (e.g. include a UUID suffix)
  - Assert: lecture is created (HTTP 201) and QR data URL is returned for all unique periods
  - Verify test PASSES on UNFIXED code (confirms baseline)
  - _Requirements: 3.1 (unchanged behaviour)_

  **Preservation 4 — Single valid enrollment (Bug 1 non-buggy path)**
  - Create `tests/property/enrollment-preservation.test.js`
  - Scope: `NOT isBugCondition_CourseSelection(X)` — exactly one course selected, not already enrolled or pending
  - Observe on UNFIXED code: `POST /api/courses/enroll` with one valid course code → HTTP 201, pending row created
  - Assert: one pending enrollment row is created and success message is returned
  - Verify test PASSES on UNFIXED code (confirms baseline)
  - _Requirements: 3.2_

  - Mark task complete when all preservation tests are written, run, and passing on UNFIXED code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [-] 3. Fix all three bugs

  - [x] 3.1 Fix Bug 2 — GPS location enforcement in `routes/attendance.js` (`POST /scan`)
    - Open `routes/attendance.js`
    - Locate the location check block: `if (lecture.class_lat && lecture.class_lng && student_lat && student_lng) { ... }`
    - Immediately BEFORE that block, insert the null-GPS rejection guard:
      ```javascript
      if (lecture.class_lat && lecture.class_lng && (student_lat == null || student_lng == null)) {
        return res.status(403).json({
          error: 'GPS location required — please enable location access to mark attendance for this class.'
        });
      }
      ```
    - The existing distance check block is left completely untouched
    - _Bug_Condition: isBugCondition_GPS(X) where X.lecture_has_location = true AND (X.student_lat = null OR X.student_lng = null)_
    - _Expected_Behavior: result.status = 403, result.error CONTAINS 'GPS required', no attendance row inserted_
    - _Preservation: student with valid GPS inside radius still gets attendance recorded with location_valid = 1; lecture with no classroom location still allows scan regardless of student GPS_
    - _Requirements: 2.1, 2.2, 3.3, 3.4_

  - [x] 3.2 Fix Bug 2 — Require classroom location on lecture creation in `routes/attendance.js` (`POST /lectures`)
    - Open `routes/attendance.js`
    - Locate the `POST /lectures` handler, after the existing `period` and `course_id` validation
    - Add the classroom location requirement guard:
      ```javascript
      if (!class_lat || !class_lng) {
        return res.status(400).json({ error: 'Classroom location is required. Please use the "Detect My Location" button.' });
      }
      ```
    - _Bug_Condition: lecture created without class_lat/class_lng makes GPS enforcement impossible_
    - _Expected_Behavior: HTTP 400 returned when class_lat or class_lng is missing_
    - _Preservation: lectures with valid class_lat/class_lng continue to be created normally_
    - _Requirements: 2.3_

  - [x] 3.3 Fix Bug 3 — Normalise period string before duplicate check in `routes/attendance.js` (`POST /lectures`)
    - Open `routes/attendance.js`
    - Locate the duplicate check query: `SELECT id FROM lectures WHERE course_id = ? AND period = ? AND created_by = ?`
    - Replace with normalised comparison:
      ```javascript
      const normalisedPeriod = period.trim().replace(/\s+/g, ' ').toLowerCase();
      const duplicate = await prepare(
        `SELECT id FROM lectures
         WHERE course_id = ?
           AND LOWER(TRIM(period)) = ?
           AND created_by = ?`
      ).get(course_id, normalisedPeriod, req.session.userId);
      ```
    - The JS normalisation (`trim + collapse whitespace + lowercase`) handles the parameter value; MySQL's `LOWER(TRIM(...))` handles the stored column value
    - _Bug_Condition: isBugCondition_DuplicateLecture(X) where normalised period matches existing lecture for same course_id + created_by_
    - _Expected_Behavior: result.status = 409, result.error CONTAINS 'already exists', no new lecture row inserted_
    - _Preservation: unique normalised periods continue to create lectures normally (HTTP 201, QR returned)_
    - _Requirements: 3.1, 3.2 (bug 3)_

  - [x] 3.4 Fix Bug 1 — Replace single-select with multi-select in `public/dashboard.html`
    - Open `public/dashboard.html`
    - Locate `<select id="enroll-select" ...>` in the "My Courses" section
    - Add `multiple` attribute and `size="6"` to render a scrollable multi-select list
    - Update the placeholder label text to: `"Select courses to request (hold Ctrl/Cmd to select multiple, max 8)"`
    - Update the `enroll-btn` click handler to:
      1. Read `Array.from(sel.selectedOptions)` instead of `sel.value`
      2. Validate: if `selected.length === 0` → show "Please select at least one course."
      3. Validate: if `selected.length > 8` → show "You can select a maximum of 8 courses." and return without API call
      4. Loop over selected options and call `POST /api/courses/enroll` for each course code (sequentially or in parallel)
      5. Collect results and display a summary: "X enrollment request(s) sent."
    - _Bug_Condition: isBugCondition_CourseSelection(X) where X.ui_control_type = 'single-select' OR X.courses_selected_count > 8 OR X.courses_selected_count < 1_
    - _Expected_Behavior: multi-select control rendered, max 8 enforced with validation message, all selected courses submitted in one action_
    - _Preservation: selecting 1–8 courses and submitting continues to create pending enrollment rows and display results correctly_
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.5 Fix Bug 1 — Extend `POST /enroll` to accept array of course codes in `routes/courses.js`
    - Open `routes/courses.js`
    - Locate `router.post('/enroll', ...)` handler
    - Extend to accept `req.body.course_codes` (array) in addition to the existing `req.body.course_code` (string):
      ```javascript
      // Accept both single code (legacy) and array of codes (new multi-select)
      const codes = req.body.course_codes
        ? req.body.course_codes
        : (req.body.course_code ? [req.body.course_code] : []);
      if (!codes.length) return res.status(400).json({ error: 'At least one course code is required' });
      if (codes.length > 8) return res.status(400).json({ error: 'You can select a maximum of 8 courses' });
      ```
    - Process each code using the existing single-enroll logic, collecting per-course results
    - Return `{ results: [{ course_code, message, error }] }` for multi-code requests; preserve existing single-code response shape for backward compatibility
    - _Bug_Condition: backend only accepts single course_code, cannot process multi-select submission_
    - _Expected_Behavior: array of 1–8 course codes processed, pending rows created for each, results summary returned_
    - _Preservation: existing single course_code requests continue to work identically_
    - _Requirements: 1.2, 1.3_

  - [x] 3.6 Fix Bug 3 — Style the `lec-error` element as a visible error banner in `public/lecturer.html`
    - Open `public/lecturer.html`
    - Locate `<p class="error-msg" id="lec-error"></p>` in the lecture creation form
    - Replace with a styled error `<div>`:
      ```html
      <div id="lec-error" style="display:none;padding:.75rem 1rem;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:var(--border-radius);margin-top:.75rem;font-weight:600;"></div>
      ```
    - Update the form submit handler to:
      - Set `lec-error.style.display = 'none'` and `lec-error.textContent = ''` at the start of each submission
      - Set `lec-error.style.display = 'block'` and `lec-error.textContent = data.error` when an error is received
    - Also update the "Classroom Location" label to indicate it is required (add "(required)" or an asterisk)
    - _Bug_Condition: 409 error displayed in unstyled paragraph, easy to miss_
    - _Expected_Behavior: error shown in red-bordered banner, clearly visible_
    - _Preservation: successful lecture creation flow (QR modal display) is unchanged_
    - _Requirements: 3.1 (bug 3 UX)_

  - [ ] 3.7 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - GPS Null Bypass, Duplicate Period Normalisation, Single-Select UI
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behaviour; when they pass, the bugs are fixed
    - Run `npx jest tests/property/gps-enforcement.test.js tests/property/duplicate-lecture.test.js tests/unit/enrollment-ui.test.js --testEnvironment node`
    - **EXPECTED OUTCOME**: All three exploration tests PASS (confirms all three bugs are fixed)
    - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.2_

  - [ ] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - In-Radius GPS Scan, No-Location Lecture Scan, Unique Period Creation, Single Valid Enrollment
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `npx jest tests/property/gps-preservation.test.js tests/property/lecture-creation-preservation.test.js tests/property/enrollment-preservation.test.js --testEnvironment node`
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - Confirm all tests still pass after all fixes (no regressions introduced)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [~] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite: `npx jest --testEnvironment node`
  - Confirm all exploration tests (Property 1) pass — bugs are fixed
  - Confirm all preservation tests (Property 2) pass — no regressions
  - Confirm existing unit tests (`tests/unit/nav.test.js`, `tests/unit/validator.test.js`) still pass
  - Manually verify in the browser:
    - Dashboard "My Courses" section shows a multi-select list (not a single dropdown)
    - Selecting > 8 courses shows the validation message without submitting
    - Lecturer dashboard "Create New Lecture" form shows "Classroom Location (required)"
    - Submitting a lecture without location shows HTTP 400 error in the styled red banner
    - Submitting a duplicate period (different casing) shows the styled red error banner
    - Scanning a QR code with GPS denied (for a lecture with a classroom location) shows the GPS-required error
  - Ask the user if any questions arise before marking complete
