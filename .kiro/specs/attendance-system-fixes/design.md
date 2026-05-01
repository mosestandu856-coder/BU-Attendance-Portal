# Attendance System Fixes — Bugfix Design

## Overview

This document covers the technical design for three targeted bug fixes in the BU Attendance System:

1. **Course Selection Limit** — Replace the single-select enrollment dropdown in `dashboard.html` with a multi-select control that allows students to request 1–8 courses in one submission. The backend `POST /api/courses/enroll` endpoint must be extended to accept an array of course codes.

2. **GPS Location Enforcement** — The `POST /api/attendance/scan` handler in `routes/attendance.js` currently skips the location check when `student_lat`/`student_lng` are `null`, even when the lecture has a classroom location set. The fix rejects the scan in that case. The `POST /api/attendance/lectures` handler must also require `class_lat`/`class_lng` for new lectures.

3. **Duplicate Lecture Prevention** — The duplicate check in `POST /api/attendance/lectures` compares the raw `period` string. The fix normalises the period (trim + collapse whitespace + lowercase) before comparison. The frontend `lec-error` display is also upgraded to a styled error banner so the message is clearly visible.

Each fix is minimal and surgical — no unrelated code is touched.

---

## Glossary

- **Bug_Condition (C)**: The specific input state that triggers a defect.
- **Property (P)**: The correct output or side-effect the fixed function must produce for every input where C holds.
- **Preservation**: All behaviours that must remain identical before and after the fix for inputs where C does NOT hold.
- **`POST /api/courses/enroll`**: The Express route in `routes/courses.js` that inserts a `course_enrollments` row with `status = 'pending'`.
- **`POST /api/attendance/scan`**: The Express route in `routes/attendance.js` that validates a QR token and inserts an `attendance` row.
- **`POST /api/attendance/lectures`**: The Express route in `routes/attendance.js` that creates a lecture and generates a QR code.
- **`location_valid`**: The `TINYINT` column in the `attendance` table — `1` means the student was within the allowed radius, `0` means outside.
- **`class_lat` / `class_lng`**: The classroom GPS coordinates stored on the `lectures` row; `NULL` means no location was set.
- **`isBugCondition`**: Pseudocode predicate that returns `true` when a given input triggers the defect.
- **Normalised period**: A period string after applying `trim()`, collapsing internal whitespace to a single space, and converting to lowercase.

---

## Bug Details

### Bug 1 — Course Selection Limit

The enrollment UI in `dashboard.html` renders a `<select>` element (single-select by default). A student can pick only one course per form submission. There is no upper-bound check on total selections.

**Formal Specification:**

```
FUNCTION isBugCondition_CourseSelection(X)
  INPUT:  X = { ui_control_type: string, courses_selected_count: integer }
  OUTPUT: boolean

  RETURN X.ui_control_type = 'single-select'
      OR X.courses_selected_count > 8
      OR X.courses_selected_count < 1
END FUNCTION
```

**Examples:**

- Student opens enrollment section → sees a `<select>` (single-select) → can only pick one course → **BUG**
- Student selects 9 courses in a hypothetical multi-select → no validation error shown → **BUG**
- Student selects 3 courses and submits → all 3 enrollment requests sent in one action → **CORRECT (after fix)**
- Student selects 0 courses and clicks submit → validation message shown → **CORRECT (after fix)**

---

### Bug 2 — GPS Location Enforcement

In `routes/attendance.js`, the location check block is:

```javascript
if (lecture.class_lat && lecture.class_lng && student_lat && student_lng) {
  // distance check
}
```

When `student_lat` / `student_lng` are `null` (GPS denied or unavailable), the entire block is skipped and `location_valid` defaults to `1`. Attendance is recorded even though the student's physical presence cannot be verified.

**Formal Specification:**

```
FUNCTION isBugCondition_GPS(X)
  INPUT:  X = { student_lat: number|null, student_lng: number|null,
                lecture_has_location: boolean }
  OUTPUT: boolean

  RETURN X.lecture_has_location = true
     AND (X.student_lat = null OR X.student_lng = null)
END FUNCTION
```

**Examples:**

- Lecture has `class_lat = 0.3476`, student GPS denied → attendance recorded with `location_valid = 1` → **BUG**
- Lecture has `class_lat = 0.3476`, student GPS denied → scan rejected with "GPS required" error → **CORRECT (after fix)**
- Lecture has no classroom location (`class_lat = null`), student GPS denied → attendance recorded (no location to check) → **CORRECT (unchanged behaviour)**
- Lecture has `class_lat = 0.3476`, student GPS available and inside radius → attendance recorded → **CORRECT (unchanged behaviour)**

---

### Bug 3 — Duplicate Lecture Prevention

The duplicate check in `routes/attendance.js` is:

```javascript
const duplicate = await prepare(
  'SELECT id FROM lectures WHERE course_id = ? AND period = ? AND created_by = ?'
).get(course_id, period, req.session.userId);
```

The raw `period` string is compared without normalisation. `"Monday 8:00–10:00 AM"` and `"monday  8:00–10:00 am"` are treated as different periods, allowing a duplicate lecture to be created. Additionally, the frontend displays the 409 error in a plain `<p>` tag with no visual distinction.

**Formal Specification:**

```
FUNCTION isBugCondition_DuplicateLecture(X)
  INPUT:  X = { course_id: integer, period: string, created_by: integer }
  OUTPUT: boolean

  normalised ← TRIM(COLLAPSE_SPACES(LOWERCASE(X.period)))
  existing   ← SELECT id FROM lectures
               WHERE course_id = X.course_id
                 AND TRIM(COLLAPSE_SPACES(LOWERCASE(period))) = normalised
                 AND created_by = X.created_by

  RETURN existing IS NOT NULL
END FUNCTION
```

**Examples:**

- Lecturer creates "CS101 — Monday 8:00–10:00 AM", then submits "monday  8:00–10:00 am" for same course → second lecture created → **BUG**
- Lecturer creates duplicate with exact same string → 409 returned but error shown in unstyled `<p>` → **BUG (UX)**
- Lecturer creates "CS101 — Monday 8:00–10:00 AM", then submits "Monday 8:00–10:00 AM" for same course → 409 returned with styled red error banner → **CORRECT (after fix)**
- Lecturer creates "CS101 — Monday 8:00–10:00 AM", then submits "Tuesday 10:00–12:00 PM" for same course → new lecture created → **CORRECT (unchanged behaviour)**

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviours:**

- A student who selects 1–8 courses and submits the enrollment form SHALL continue to have pending enrollment requests created and displayed correctly.
- A student who is physically inside the classroom radius with GPS available SHALL continue to have attendance recorded with `location_valid = 1`.
- A lecture with no classroom location (`class_lat = null`) SHALL continue to allow attendance scans without GPS enforcement (existing lectures are not broken).
- A lecturer who creates a lecture with a unique course + normalised period combination SHALL continue to have the lecture created and the QR modal displayed.
- Duplicate scan rejection (same student, same lecture) SHALL continue to work.
- "Not enrolled" scan rejection SHALL continue to work.
- Expired QR code rejection SHALL continue to work.

**Scope:**

All inputs that do NOT satisfy any of the three bug conditions are completely unaffected by these fixes. Specifically:
- Mouse clicks, form submissions, and API calls unrelated to enrollment, scan, or lecture creation.
- Attendance records already in the database are not modified.
- The biometric verification flow is not touched.

---

## Hypothesized Root Cause

### Bug 1 — Course Selection Limit

1. **Missing `multiple` attribute**: The `<select id="enroll-select">` in `dashboard.html` lacks the `multiple` attribute, making it a single-select by default. HTML does not enforce a maximum selection count natively — a `change` event listener is needed.
2. **Single-item API contract**: `POST /api/courses/enroll` in `routes/courses.js` accepts only `{ course_code: string }`. It was never designed to handle an array.
3. **No upper-bound validation**: Neither the frontend nor the backend validates that the number of selected courses is ≤ 8.

### Bug 2 — GPS Location Enforcement

1. **Short-circuit `&&` condition**: The guard `if (lecture.class_lat && lecture.class_lng && student_lat && student_lng)` silently skips the entire location check when student coordinates are absent. The intent was "only check distance when all four values are present", but the correct intent for a location-enforced lecture is "reject when student coordinates are absent".
2. **Frontend fallback**: `scan.html` explicitly calls `checkIn(null, null)` when geolocation is denied or times out, passing nulls to the server. The server was expected to handle this but does not.
3. **No mandatory location on lecture creation**: `POST /api/attendance/lectures` does not require `class_lat`/`class_lng`, so lecturers can create lectures without a location, making enforcement impossible for those lectures.

### Bug 3 — Duplicate Lecture Prevention

1. **Raw string comparison**: The SQL `WHERE period = ?` performs a byte-for-byte comparison. Case differences and extra whitespace produce different strings that pass the uniqueness check.
2. **No frontend normalisation**: The frontend sends the period string as typed, with no trimming or case normalisation before submission.
3. **Unstyled error display**: The `lec-error` element is a plain `<p>` tag. When a 409 is returned, the error text is rendered in the same style as any other paragraph, making it easy to miss.

---

## Correctness Properties

Property 1: Bug Condition — Multi-Select Enrollment UI

_For any_ enrollment submission where the student selects between 1 and 8 courses using the multi-select control, the fixed frontend SHALL send all selected course codes in a single request and the fixed backend SHALL create a pending enrollment row for each course, returning a summary of results.

**Validates: Requirements 1.1, 1.2, 1.3**

Property 2: Preservation — Single Valid Enrollment

_For any_ enrollment submission where exactly one course is selected and that course is not already enrolled or pending, the fixed system SHALL produce the same result as the original system: one pending enrollment row created and a success message displayed.

**Validates: Requirements 3.2**

Property 3: Bug Condition — GPS Enforcement Rejection

_For any_ attendance scan where `student_lat` or `student_lng` is `null` AND the lecture has `class_lat`/`class_lng` set, the fixed `POST /api/attendance/scan` handler SHALL return HTTP 403 with an error message containing "GPS required" and SHALL NOT insert an attendance row.

**Validates: Requirements 2.1, 2.2**

Property 4: Preservation — GPS Available and In-Radius

_For any_ attendance scan where `student_lat` and `student_lng` are non-null AND the student is within the allowed radius, the fixed handler SHALL produce the same result as the original handler: attendance recorded with `location_valid = 1`.

**Validates: Requirements 3.3**

Property 5: Bug Condition — Normalised Duplicate Detection

_For any_ lecture creation request where the normalised period (trimmed, collapsed whitespace, lowercased) matches an existing lecture for the same course and creator, the fixed handler SHALL return HTTP 409 and SHALL NOT insert a new lecture row.

**Validates: Requirements 3.1, 3.2 (bug 3)**

Property 6: Preservation — Unique Period Lecture Creation

_For any_ lecture creation request where the normalised period does NOT match any existing lecture for the same course and creator, the fixed handler SHALL produce the same result as the original handler: lecture created, QR generated, 201 returned.

**Validates: Requirements 3.1 (unchanged behaviour)**

---

## Fix Implementation

### Bug 1 — Course Selection Limit

**File:** `public/dashboard.html`

**Element:** `<select id="enroll-select">`

**Specific Changes:**

1. **Add `multiple` attribute and `size`**: Change `<select id="enroll-select">` to `<select id="enroll-select" multiple size="6">` so the browser renders a scrollable list.
2. **Add selection count validation**: In the `enroll-btn` click handler, read `Array.from(sel.selectedOptions)`. If `selected.length === 0`, show "Please select at least one course." If `selected.length > 8`, show "You can select a maximum of 8 courses."
3. **Batch submission loop**: Iterate over selected options and call `POST /api/courses/enroll` for each course code sequentially (or in parallel), collecting results. Display a summary: "X enrollment request(s) sent."
4. **Update label text**: Change the label from "Select a course to request" to "Select courses to request (hold Ctrl/Cmd to select multiple, max 8)".

**File:** `routes/courses.js`

**Route:** `POST /enroll`

**Specific Changes:**

1. **Accept array input**: Check if `req.body.course_codes` (array) is present in addition to the existing `req.body.course_code` (string). If an array is provided, validate length (1–8) and process each entry.
2. **Batch response**: Return `{ results: [{ course_code, message, error }] }` when processing multiple codes, so the frontend can display per-course outcomes.

---

### Bug 2 — GPS Location Enforcement

**File:** `routes/attendance.js`

**Route:** `POST /scan`

**Specific Changes:**

1. **Add null-GPS rejection block**: Immediately after fetching the lecture row, add:
   ```javascript
   if (lecture.class_lat && lecture.class_lng && (student_lat == null || student_lng == null)) {
     return res.status(403).json({
       error: 'GPS location required — please enable location access to mark attendance for this class.'
     });
   }
   ```
   This block runs before the existing distance check, so the existing distance logic is untouched.

**File:** `routes/attendance.js`

**Route:** `POST /lectures`

**Specific Changes:**

1. **Require classroom location**: After the existing `period` and `course_id` validation, add:
   ```javascript
   if (!class_lat || !class_lng) {
     return res.status(400).json({ error: 'Classroom location is required. Please use the "Detect My Location" button.' });
   }
   ```

**File:** `public/lecturer.html`

**Specific Changes:**

1. **Update location UI label**: Change the "Classroom Location" label hint to indicate it is required (add an asterisk or "(required)" note).

---

### Bug 3 — Duplicate Lecture Prevention

**File:** `routes/attendance.js`

**Route:** `POST /lectures`

**Specific Changes:**

1. **Normalise period before duplicate check**: Replace the existing duplicate query with:
   ```javascript
   const normalisedPeriod = period.trim().replace(/\s+/g, ' ').toLowerCase();
   const duplicate = await prepare(
     `SELECT id FROM lectures
      WHERE course_id = ?
        AND LOWER(TRIM(period)) = ?
        AND created_by = ?`
   ).get(course_id, normalisedPeriod, req.session.userId);
   ```
   Note: MySQL's `LOWER(TRIM(period))` handles the DB side; the JS normalisation handles the value passed as the parameter. Internal whitespace collapsing is done in JS before passing to the query.

**File:** `public/lecturer.html`

**Specific Changes:**

1. **Style the error element**: Change the `lec-error` paragraph to a `<div>` with a CSS class that renders a red-bordered error box (matching the `status-error` style used in `scan.html`). Add inline style or a dedicated class:
   ```html
   <div id="lec-error" class="error-banner" style="display:none;padding:.75rem 1rem;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:var(--border-radius);margin-top:.75rem;font-weight:600;"></div>
   ```
2. **Show/hide logic**: In the form submit handler, set `lec-error.style.display = 'none'` on each submission attempt, and `lec-error.style.display = 'block'` when an error is received.

---

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach: first run exploratory tests against the **unfixed** code to confirm the bug manifests as expected (counterexample surfacing), then run fix-checking and preservation tests against the **fixed** code.

---

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that demonstrate each bug on unfixed code. Confirm or refute the root cause hypotheses.

**Test Plan:** Write unit tests that call the route handlers directly (or via supertest) with inputs that satisfy each `isBugCondition`. Run on unfixed code and observe failures.

**Test Cases:**

1. **GPS null bypass** (Bug 2): POST `/api/attendance/scan` with a valid token for a lecture that has `class_lat`/`class_lng` set, passing `student_lat: null, student_lng: null`. Expected on unfixed code: attendance row inserted (bug confirmed). Expected on fixed code: HTTP 403 returned.

2. **GPS null bypass — no lecture location** (Bug 2 edge case): POST `/api/attendance/scan` with `student_lat: null` for a lecture with no classroom location. Expected on both unfixed and fixed code: attendance recorded (no location to enforce).

3. **Case-variant duplicate period** (Bug 3): POST `/api/attendance/lectures` twice for the same `course_id` and `created_by`, with periods `"Monday 8:00–10:00 AM"` and `"monday  8:00–10:00 am"`. Expected on unfixed code: second lecture created (bug confirmed). Expected on fixed code: HTTP 409 returned.

4. **Exact duplicate period** (Bug 3): POST `/api/attendance/lectures` twice with identical period strings. Expected on both unfixed and fixed code: HTTP 409 on second attempt (already works, regression check).

5. **Single-select UI** (Bug 1): Inspect the rendered `<select id="enroll-select">` element. Expected on unfixed code: no `multiple` attribute present (bug confirmed). Expected on fixed code: `multiple` attribute present.

**Expected Counterexamples:**

- Bug 2: Attendance row is inserted when `student_lat = null` and lecture has a location — confirms the `&&` short-circuit is the root cause.
- Bug 3: A second lecture row is created for the normalisation-variant period — confirms raw string comparison is the root cause.

---

### Fix Checking

**Goal:** Verify that for all inputs where the bug condition holds, the fixed function produces the expected behaviour.

**Pseudocode:**

```
// Bug 2
FOR ALL X WHERE isBugCondition_GPS(X) DO
  result := recordAttendance_fixed(X)
  ASSERT result.status = 403
  ASSERT result.error CONTAINS 'GPS'
  ASSERT COUNT(attendance WHERE lecture_id = X.lecture_id AND user_id = X.user_id) = 0
END FOR

// Bug 3
FOR ALL X WHERE isBugCondition_DuplicateLecture(X) DO
  result := createLecture_fixed(X)
  ASSERT result.status = 409
  ASSERT result.error CONTAINS 'already exists'
  ASSERT COUNT(lectures WHERE course_id = X.course_id AND created_by = X.created_by
               AND LOWER(TRIM(period)) = normalise(X.period)) = 1  // no new row
END FOR

// Bug 1
FOR ALL X WHERE isBugCondition_CourseSelection(X) DO
  IF X.courses_selected_count > 8 THEN
    ASSERT UI shows validation error "maximum of 8 courses"
    ASSERT no API call made
  END IF
  IF X.ui_control_type = 'single-select' THEN
    ASSERT rendered control has attribute multiple
  END IF
END FOR
```

---

### Preservation Checking

**Goal:** Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**

```
// Bug 2 — student has GPS and is inside radius
FOR ALL X WHERE NOT isBugCondition_GPS(X) AND X.student_lat != null DO
  ASSERT recordAttendance_original(X) = recordAttendance_fixed(X)
END FOR

// Bug 3 — unique period
FOR ALL X WHERE NOT isBugCondition_DuplicateLecture(X) DO
  ASSERT createLecture_original(X) = createLecture_fixed(X)
END FOR

// Bug 1 — valid selection count (1–8)
FOR ALL X WHERE 1 <= X.courses_selected_count <= 8 DO
  ASSERT enrollmentRequest_original(X) = enrollmentRequest_fixed(X)
END FOR
```

**Testing Approach:** Property-based testing is recommended for preservation checking because:
- It generates many random inputs automatically across the full input domain.
- It catches edge cases (e.g., period strings with Unicode spaces, GPS coordinates at the exact radius boundary) that manual tests miss.
- It provides strong guarantees that behaviour is unchanged for all non-buggy inputs.

**Test Plan:** Observe behaviour on unfixed code for non-buggy inputs first, capture the expected outputs, then write property-based tests that assert the same outputs on fixed code.

**Test Cases:**

1. **In-radius GPS scan preservation**: Generate random `(student_lat, student_lng)` pairs within the allowed radius of a lecture that has a classroom location. Verify attendance is recorded with `location_valid = 1` on both unfixed and fixed code.
2. **No-location lecture scan preservation**: Generate scans for lectures with `class_lat = null`. Verify attendance is recorded regardless of student GPS on both unfixed and fixed code.
3. **Unique period lecture creation preservation**: Generate random period strings that do not match any existing lecture. Verify lecture is created and QR returned on both unfixed and fixed code.
4. **Single valid enrollment preservation**: Submit enrollment for one course not already enrolled. Verify pending row created on both unfixed and fixed code.

---

### Unit Tests

- Test `POST /api/attendance/scan` with `student_lat: null` and a lecture with classroom location → expect HTTP 403.
- Test `POST /api/attendance/scan` with `student_lat: null` and a lecture without classroom location → expect HTTP 201.
- Test `POST /api/attendance/scan` with valid GPS inside radius → expect HTTP 201.
- Test `POST /api/attendance/scan` with valid GPS outside radius → expect HTTP 403 (existing behaviour).
- Test `POST /api/attendance/lectures` with normalised duplicate period → expect HTTP 409.
- Test `POST /api/attendance/lectures` with case-variant duplicate period → expect HTTP 409.
- Test `POST /api/attendance/lectures` with unique period → expect HTTP 201.
- Test `POST /api/attendance/lectures` without `class_lat`/`class_lng` → expect HTTP 400.
- Test `POST /api/courses/enroll` with array of 3 valid course codes → expect 3 pending rows created.
- Test `POST /api/courses/enroll` with array of 9 course codes → expect HTTP 400.
- Test frontend multi-select: selecting > 8 options triggers validation message without API call.

### Property-Based Tests

- Generate random `(lat, lng)` pairs within a fixed radius and assert attendance is always recorded (`location_valid = 1`) — preservation of in-radius behaviour.
- Generate random period strings with varying case and whitespace and assert that normalised duplicates are always rejected — fix checking for Bug 3.
- Generate random arrays of 1–8 unique course codes and assert all enrollment requests succeed — fix checking for Bug 1.
- Generate random arrays of 9–20 course codes and assert the frontend always blocks submission — fix checking for Bug 1 upper bound.

### Integration Tests

- Full scan flow: lecturer creates lecture with location → student GPS denied → scan rejected with GPS error.
- Full scan flow: lecturer creates lecture with location → student GPS available and inside radius → attendance recorded.
- Full scan flow: lecturer creates lecture without location → student GPS denied → attendance recorded (no enforcement).
- Full enrollment flow: student selects 3 courses in multi-select → submits → 3 pending requests appear in "Pending Approval" section.
- Full lecture creation flow: lecturer submits same course + period twice (different casing) → second attempt shows styled red error banner.
