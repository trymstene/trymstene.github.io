// Trym Stene — homepage interactions

// Mobile nav toggle
const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav__toggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  // close menu after tapping a link (mobile)
  nav.querySelectorAll('.nav__links a').forEach((a) =>
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );
}

// Current year in footer
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

// A little easter egg for the curious
console.log('%c🍌 hello yes, it\'s the banana guy', 'font-size:16px;font-weight:bold;');
console.log('Made the Dancing Banana in 1999. Still dancing.');
