/**
 * Login form handler.
 * Requirements: 8.1, 8.3, 8.4
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous errors
    document.getElementById('reg-error').textContent = '';
    document.getElementById('password-error').textContent = '';
    document.getElementById('login-error').textContent = '';

    const regNumber = document.getElementById('login-reg').value;
    const password = document.getElementById('login-password').value;

    // Client-side validation
    const { valid } = validateLoginForm(regNumber, password);
    if (!valid) {
      if (!regNumber || regNumber.trim().length === 0) {
        document.getElementById('reg-error').textContent = 'Registration number is required.';
      }
      if (!password || password.trim().length === 0) {
        document.getElementById('password-error').textContent = 'Password is required.';
      }
      return;
    }

    // Submit to API
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reg_number: regNumber.trim(), password }),
      });

      if (res.status === 200) {
        const data = await res.json();
        window.location.href = data.role === 'admin'
          ? '/admin.html'
          : data.role === 'qa'
            ? '/qa.html'
            : data.role === 'lecturer'
              ? '/lecturer.html'
              : '/dashboard.html';
      } else if (res.status === 401) {
        document.getElementById('login-error').textContent = 'Invalid registration number or password.';
      } else {
        document.getElementById('login-error').textContent = 'An error occurred. Please try again.';
      }
    } catch (err) {
      document.getElementById('login-error').textContent = 'An error occurred. Please try again.';
    }
  });
});
