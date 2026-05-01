# Bugfix Requirements Document

## Introduction

This document covers three bugs in the BU Attendance System:

1. **Course selection limit** — The "My Courses" enrollment UI uses a single-select dropdown, allowing students to request only one course at a time with no upper-bound enforcement. Students should be able to select and submit 1–8 courses in a single multi-select action.

2. **GPS location enforcement** — The attendance scan flow does not strictly enforce GPS presence for both the student and the lecturer's classroom location. When GPS is unavailable or denied, the system falls back to recording attendance anyway (`location_valid = 1` by default), allowing students who are not physically present to mark attendance by sharing QR codes.

3. **Duplicate lecture prevention** — The "Create New Lecture" form in the Lecturer Dashboard allows creating a lecture for the same course and period combination more than once (the server-side duplicate check only compares `course_id + period + created_by`, but the frontend does not surface the error clearly, and the check does not cover all edge cases such as case/whitespace variations in the period string).

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a student opens the "My Courses" enrollment section THEN the system displays a single `<select>` dropdown that allows selecting only one course at a time, with no limit enforced on total enrolled courses.

1.2 WHEN a student submits an enrollment request THEN the system processes exactly one course per submission, requiring multiple separate form submissions to enroll in multiple courses.

2.1 WHEN a student's device cannot provide GPS coordinates (permission denied, GPS unavailable, or timeout) THEN the system records attendance with `location_valid = 1` and does not block the scan, even when the lecture has a classroom location set.

2.2 WHEN a student is outside the allowed classroom radius but GPS coordinates are provided THEN the system correctly blocks attendance — however, when coordinates are `null` (GPS skipped), the location check is bypassed entirely and attendance is recorded regardless.

2.3 WHEN the lecturer creates a lecture without setting a classroom location (`class_lat` / `class_lng` are null) THEN the system has no reference point to validate student proximity, making GPS enforcement impossible for that lecture.

3.1 WHEN a lecturer submits the "Create New Lecture" form with a course and period that already exists in the database THEN the server returns a 409 error, but the frontend `lec-error` paragraph displays the message without any visual distinction, and the form does not prevent re-submission.

3.2 WHEN a lecturer enters a period string with different casing or surrounding whitespace (e.g. `"monday 8:00–10:00 am"` vs `"Monday 8:00–10:00 AM"`) THEN the system treats them as different periods and allows the duplicate lecture to be created.

### Expected Behavior (Correct)

2.1 WHEN a student's device cannot provide GPS coordinates AND the lecture has a classroom location set THEN the system SHALL reject the attendance scan with an error message indicating that GPS is required to verify presence.

2.2 WHEN GPS coordinates are null and the lecture has `class_lat`/`class_lng` set THEN the system SHALL NOT record attendance and SHALL return an error such as "Location required — please enable GPS to mark attendance."

2.3 WHEN a lecturer creates a lecture THEN the system SHALL require a classroom location (`class_lat` and `class_lng`) so that GPS enforcement is always possible.

1.1 WHEN a student opens the "My Courses" enrollment section THEN the system SHALL display a multi-select control that allows selecting between 1 and 8 courses simultaneously.

1.2 WHEN a student selects more than 8 courses in the multi-select control THEN the system SHALL prevent the selection and display a validation message: "You can select a maximum of 8 courses."

1.3 WHEN a student submits the multi-select enrollment form THEN the system SHALL send enrollment requests for all selected courses in a single action and display a summary of the results.

3.1 WHEN a lecturer submits the "Create New Lecture" form with a course and period combination that already exists THEN the system SHALL display a clearly styled error message (e.g. highlighted in red) and SHALL NOT submit the form again until the period is changed.

3.2 WHEN comparing period strings for duplicate detection THEN the system SHALL normalize the period value (trim whitespace, collapse internal spaces) before comparison so that minor formatting differences do not bypass the duplicate check.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a lecturer creates a lecture with a course and period combination that does not already exist THEN the system SHALL CONTINUE TO create the lecture, generate a QR code, and display it in the modal.

3.2 WHEN a student selects between 1 and 8 courses and submits the enrollment form THEN the system SHALL CONTINUE TO send enrollment requests and display pending/approved status correctly.

3.3 WHEN a student is physically inside the classroom radius and GPS coordinates are available THEN the system SHALL CONTINUE TO record attendance with `location_valid = 1`.

3.4 WHEN a lecture has no classroom location set (`class_lat` and `class_lng` are null) THEN the system SHALL CONTINUE TO handle this case — after the fix, lecturers will be required to set a location, but existing lectures without a location should not break the scan flow for already-created lectures (they should be flagged as location-unverified).

3.5 WHEN a student has already scanned for a lecture THEN the system SHALL CONTINUE TO reject duplicate scans with the existing "already scanned" error.

3.6 WHEN a student is not enrolled in the course for a lecture THEN the system SHALL CONTINUE TO reject the scan with the existing "not enrolled" error.

---

## Bug Condition Pseudocode

### Bug 1 — Course Selection Limit

```pascal
FUNCTION isBugCondition_CourseSelection(X)
  INPUT: X = { ui_control_type, courses_selected_count }
  OUTPUT: boolean

  RETURN X.ui_control_type = 'single-select'
      OR X.courses_selected_count > 8
      OR X.courses_selected_count < 1
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_CourseSelection(X) DO
  result ← renderEnrollmentUI'(X)
  ASSERT result.control_type = 'multi-select'
  ASSERT result.max_selectable = 8
  ASSERT result.shows_validation_error WHEN X.courses_selected_count > 8
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_CourseSelection(X) DO
  ASSERT enrollmentRequest(X) = enrollmentRequest'(X)
END FOR
```

### Bug 2 — GPS Location Enforcement

```pascal
FUNCTION isBugCondition_GPS(X)
  INPUT: X = { student_lat, student_lng, lecture_has_location }
  OUTPUT: boolean

  RETURN X.lecture_has_location = true
     AND (X.student_lat = null OR X.student_lng = null)
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_GPS(X) DO
  result ← recordAttendance'(X)
  ASSERT result.status = 'rejected'
  ASSERT result.error CONTAINS 'GPS required'
  ASSERT no attendance row inserted
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_GPS(X) DO
  ASSERT recordAttendance(X) = recordAttendance'(X)
END FOR
```

### Bug 3 — Duplicate Lecture Prevention

```pascal
FUNCTION isBugCondition_DuplicateLecture(X)
  INPUT: X = { course_id, period, created_by }
  OUTPUT: boolean

  normalizedPeriod ← TRIM(COLLAPSE_SPACES(LOWERCASE(X.period)))
  existing ← SELECT id FROM lectures
              WHERE course_id = X.course_id
                AND TRIM(COLLAPSE_SPACES(LOWERCASE(period))) = normalizedPeriod
                AND created_by = X.created_by

  RETURN existing IS NOT NULL
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_DuplicateLecture(X) DO
  result ← createLecture'(X)
  ASSERT result.status = 409
  ASSERT result.error CONTAINS 'already exists'
  ASSERT no new lecture row inserted
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_DuplicateLecture(X) DO
  ASSERT createLecture(X) = createLecture'(X)
END FOR
```
