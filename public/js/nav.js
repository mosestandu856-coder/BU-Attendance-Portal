document.addEventListener('DOMContentLoaded', function () {
  const navLinks = document.querySelectorAll('nav a');

  function normalizePath(pathname) {
    if (!pathname || pathname === '/') {
      return '/index.html';
    }

    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  }

  const currentPath = normalizePath(window.location.pathname);

  navLinks.forEach(function (link) {
    const href = normalizePath(link.getAttribute('href'));
    const isActive = href === currentPath;

    link.classList.toggle('active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
});
