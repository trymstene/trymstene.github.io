// Trym Stene — homepage interactions

// Google Analytics (GA4) — production only (skips github.io preview + localhost)
(function () {
  var GA_ID = 'G-1C0QRT9SRK';
  var host = location.hostname;
  if (host !== 'trymstene.com' && host !== 'www.trymstene.com') return;
  // OBS/stream overlays are machine views, not people — a streamer's browser
  // source would fire a "session" every stream start. Don't count them.
  if (/[?&]overlay=1/.test(location.search)) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());

  // ---- internal-traffic tag: keep OUR testing out of the reports ----
  // Country filtering can't separate us (Trym tests while travelling), so we
  // tag at the source. Visit trymstene.com/?internal=1 ONCE per browser to
  // flag it forever (?internal=0 clears it). QA/debug params flag that session
  // only. GA4's Internal Traffic filter (traffic_type=internal) then drops it
  // from every report — events still FIRE (so realtime/DebugView still works),
  // they're just marked internal. Builder share params (?g=…&h=…) are NOT
  // treated as internal — real people follow those.
  var qs = location.search;
  try {
    if (/[?&]internal=1(?:&|$)/.test(qs)) localStorage.setItem('tt-internal', '1');
    else if (/[?&]internal=0(?:&|$)/.test(qs)) localStorage.removeItem('tt-internal');
  } catch (e) {}
  var isInternal = false;
  try { isInternal = localStorage.getItem('tt-internal') === '1'; } catch (e) {}
  if (!isInternal &&
      /[?&](tourtest|fxtest|welcometest|hypetest|stagetest|nighttest)(?:=|&|$)/.test(qs)) {
    isInternal = true; // a QA/debug param = us, this session
  }
  if (!isInternal && /^\/inbox\/?$/.test(location.pathname) && /[?&]token=/.test(qs)) {
    // the bananamail door: only Trym holds the token, so reading mail flags
    // this browser as internal FOREVER (same as ?internal=1) — no more
    // inbox-refresh "sessions" from unflagged devices
    try { localStorage.setItem('tt-internal', '1'); } catch (e) {}
    isInternal = true;
  }
  if (isInternal) {
    gtag('set', { traffic_type: 'internal' });
    if (window.console) {
      console.log('%c[GA] internal traffic — your visits are excluded from reports',
        'color:#b8860b;font-weight:bold');
    }
  }

  gtag('config', GA_ID);

  // Cloudflare Web Analytics — adblocker-resilient, server-side pageview truth
  // (GA4 is blocked for ~30-40% of visitors; this cross-checks the real total).
  // Token is public (rides in the HTML). Skipped for internal traffic so it
  // stays comparable to GA4's internal-filtered numbers.
  if (!isInternal) {
    var cfb = document.createElement('script');
    cfb.defer = true;
    cfb.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    cfb.setAttribute('data-cf-beacon', '{"token":"2ec40ec596fc44a19251c3d36b1f0abb"}');
    document.head.appendChild(cfb);
  }

  // Key conversion events. `placement` (data-place attr or the page path)
  // answers "which CTA earns its pixels" across every builder entry point.
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var place = a.getAttribute('data-place') || location.pathname;
    if (href.indexOf('/assets/wallpapers/') > -1) {
      var m = href.match(/wallpaper-([a-z]+)-([a-z0-9]+)\.png/i) || [];
      gtag('event', 'wallpaper_download', { design: m[1] || '', size: m[2] || '' });
    } else if (a.hasAttribute('download') || /\.(gif|png|webp|mp4)(\?|$)/i.test(href)) {
      gtag('event', 'gif_download', { file: href.split('/').pop() });
    } else if (href.indexOf('make-a-banana') > -1) {
      gtag('event', 'generator_click', { placement: place });
    } else if (href.indexOf('buymeacoffee') > -1) {
      gtag('event', 'tip_click', { placement: place });
    } else if (href.indexOf('license-the-dancing-banana') > -1) {
      gtag('event', 'license_click', { placement: place });
    }
  });
})();

// The post-download door: downloading is a completed action, so it gets ONE
// warm next step — the .dl-door line under the buttons stays hidden until the
// visitor actually takes a banana. (Outside the GA block: works on previews.)
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a || !a.hasAttribute('download')) return;
    var door = document.querySelector('.dl-door');
    if (door) door.classList.add('show');
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

// Badge notification on the pass — iOS-style: a hot dot with the count of
// UNSEEN badges (earned since you last looked at /pass/). Visiting the pass
// clears it, earning a badge pops it live. Nothing shows at zero.
(function () {
  var SEEN_KEY = 'pass-seen-v1';
  function earnedCount() {
    try {
      var p = JSON.parse(localStorage.getItem('pass-v1') || 'null');
      return p && p.patches ? Object.keys(p.patches).length : 0;
    } catch (e) { return 0; }
  }
  function seenCount() {
    try { return parseInt(localStorage.getItem(SEEN_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function renderPassNote() {
    var unseen = earnedCount() - seenCount();
    var hosts = [document.querySelector('.nav__pass'), document.querySelector('.nav__toggle')];
    hosts.forEach(function (host) {
      if (!host) return;
      var dot = host.querySelector('.nav-note');
      if (unseen <= 0) { if (dot) dot.remove(); return; }
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'nav-note';
        dot.setAttribute('aria-hidden', 'true');
        host.appendChild(dot);
      }
      dot.textContent = unseen;
    });
    var pass = document.querySelector('.nav__pass');
    if (pass) pass.setAttribute('aria-label', unseen > 0 ? ('Your banana pass — ' + unseen + ' new badge' + (unseen > 1 ? 's' : '')) : 'Your banana pass');
  }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, String(earnedCount())); } catch (e) {}
    document.querySelectorAll('.nav-note').forEach(function (d) { d.remove(); });
  }
  if (location.pathname === '/pass/') {
    // checking the pass = notification read — including badges minted WHILE
    // looking at it (they light up on the page itself, no dot needed)
    markSeen();
    document.addEventListener('pass:change', markSeen);
  } else {
    renderPassNote();
    // a badge earned mid-page pops the dot immediately (banana-pass.js dispatches)
    document.addEventListener('pass:change', renderPassNote);
  }
})();

// Current year in footer
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

// A little easter egg for the curious
console.log('%c🍌 hello yes, it\'s the banana guy', 'font-size:16px;font-weight:bold;');
console.log('Made the Dancing Banana in 1999. Still dancing.');
