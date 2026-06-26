// Trym Stene — homepage interactions

// Mobile nav: slide-in panel
const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav__toggle');
const backdrop = document.querySelector('.nav__backdrop');

function setMenu(open) {
  if (!nav || !toggle) return;
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? '✕' : '☰';
  document.body.style.overflow = open ? 'hidden' : '';
}

if (toggle) {
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  // close after tapping a link
  nav.querySelectorAll('.nav__links a').forEach((a) =>
    a.addEventListener('click', () => setMenu(false))
  );
}
if (backdrop) backdrop.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('resize', () => { if (window.innerWidth >= 820) setMenu(false); });

// Current year in footer
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

// A little easter egg for the curious
console.log('%c🍌 hello yes, it\'s the banana guy', 'font-size:16px;font-weight:bold;');
console.log('Made the Dancing Banana in 1999. Still dancing.');
