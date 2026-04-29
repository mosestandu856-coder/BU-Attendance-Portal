/**
 * Form validation utilities for the Attendance System Website.
 * Requirements: 4.2, 4.3, 4.4, 8.4
 */

// RFC-5322-like email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the contact form fields.
 * @param {string} name
 * @param {string} email
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateContactForm(name, email) {
  const errors = [];

  if (!name || name.trim().length === 0) {
    errors.push('Name is required.');
  }

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates the login form fields.
 * @param {string} regNumber
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLoginForm(regNumber, password) {
  const errors = [];

  if (!regNumber || regNumber.trim().length === 0) {
    errors.push('Registration number is required.');
  }

  if (!password || password.trim().length === 0) {
    errors.push('Password is required.');
  }

  return { valid: errors.length === 0, errors };
}

// Node.js / Jest compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateContactForm, validateLoginForm };
}

// Browser compatibility
if (typeof window !== 'undefined') {
  window.validateContactForm = validateContactForm;
  window.validateLoginForm = validateLoginForm;
}
