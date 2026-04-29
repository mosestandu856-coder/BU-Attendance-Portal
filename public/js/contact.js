(async function () {
  try {
    const meRes = await fetch('/api/auth/me');
    if (meRes.ok) {
      const loginLink = document.getElementById('nav-login');
      if (loginLink) loginLink.style.display = 'none';
    }
  } catch(e) {}
}());
