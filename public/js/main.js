// Trym Stene — homepage interactions

// Google Analytics (GA4) — production only (skips github.io preview + localhost)
(function () {
  var GA_ID = 'G-1C0QRT9SRK';
  var host = location.hostname;
  if (host !== 'trymstene.com' && host !== 'www.trymstene.com') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_ID);

  // Key conversion events
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (a.hasAttribute('download') || /\.(gif|png|webp|mp4)(\?|$)/i.test(href)) {
      gtag('event', 'gif_download', { file: href.split('/').pop() });
    } else if (href.indexOf('make-a-banana') > -1) {
      gtag('event', 'generator_click');
    } else if (href.indexOf('buymeacoffee') > -1) {
      gtag('event', 'tip_click');
    } else if (href.indexOf('license-the-dancing-banana') > -1) {
      gtag('event', 'license_click');
    }
  });
})();

// Mobile nav: slide-in panel
const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav__toggle');
const backdrop = document.querySelector('.nav__backdrop');

function setMenu(open) {
  if (!nav || !toggle) return;
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
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
