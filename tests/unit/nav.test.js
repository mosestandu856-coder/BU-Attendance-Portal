/**
 * Unit tests for public/js/nav.js active link highlighting
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const navScript = fs.readFileSync(
  path.join(__dirname, '../../public/js/nav.js'),
  'utf8'
);

function setupDOM(pathname, links) {
  // Set up nav HTML
  document.body.innerHTML = `<nav>${links
    .map(({ href, text }) => `<a href="${href}">${text}</a>`)
    .join('\n')}</nav>`;

  // Override location pathname
  Object.defineProperty(window, 'location', {
    value: { pathname },
    writable: true,
    configurable: true,
  });

  // Remove any previous listeners by re-evaluating the script
  // eslint-disable-next-line no-eval
  eval(navScript);

  // Trigger DOMContentLoaded
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

const navLinks = [
  { href: '/index.html', text: 'Home' },
  { href: '/about.html', text: 'About' },
  { href: '/contact.html', text: 'Contact' },
  { href: '/login.html', text: 'Login' },
];

describe('nav.js active link highlighting', () => {
  test('adds active class to the matching link', () => {
    setupDOM('/about.html', navLinks);
    const active = document.querySelectorAll('nav a.active');
    expect(active.length).toBe(1);
    expect(active[0].getAttribute('href')).toBe('/about.html');
  });

  test('does not add active class to non-matching links', () => {
    setupDOM('/index.html', navLinks);
    const allLinks = document.querySelectorAll('nav a');
    allLinks.forEach(link => {
      if (link.getAttribute('href') !== '/index.html') {
        expect(link.classList.contains('active')).toBe(false);
      }
    });
  });

  test('exactly one link is active when pathname matches', () => {
    setupDOM('/contact.html', navLinks);
    const active = document.querySelectorAll('nav a.active');
    expect(active.length).toBe(1);
  });

  test('no link is active when pathname does not match any href', () => {
    setupDOM('/nonexistent.html', navLinks);
    const active = document.querySelectorAll('nav a.active');
    expect(active.length).toBe(0);
  });

  test('treats the root path as the home page', () => {
    setupDOM('/', navLinks);
    const active = document.querySelector('nav a.active');
    expect(active).not.toBeNull();
    expect(active.getAttribute('href')).toBe('/index.html');
    expect(active.getAttribute('aria-current')).toBe('page');
  });
});
