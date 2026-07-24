// Trym Stene — homepage interactions

// ---- 🍪 Cookie consent (EEA only): one banana-sized choice gates GA4 + Clarity ----
// The choice lives in localStorage 'cookie-consent-v1' ('y'/'n'). EEA detection
// is a timezone heuristic (Europe/* + the EEA Atlantic zones) — no geo service,
// zero friction for the ~85% non-EEA crowd, who never see a banner. Cloudflare's
// beacon is cookieless (consent-exempt) and stays outside the gate as the
// ground-truth pageview counter. QA: ?cookietest forces the banner anywhere —
// and never tracks, because it's also in the internal QA-param list below.
(function () {
  var KEY = 'cookie-consent-v1';
  var force = /[?&]cookietest(?:=|&|$)/.test(location.search);
  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var eea = /^Europe\//.test(tz) ||
    /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)/.test(tz);
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  if (force) { eea = true; choice = null; }

  var cc = window.__cookieConsent = {
    eea: eea,
    allowed: !eea || choice === 'y',
    denied: eea && choice === 'n',
    onAccept: [], // tracker loaders park here until the visitor says yes
  };

  // ---- Shopify checkout consent bridge (Phase 2) ----
  // Checkout runs on shop.trymstene.com (same root domain, primary since
  // 22 Jul). Headless means EEA buyers never see Shopify's own banner, so
  // checkout analytics would stay consent-blocked forever. Writing the
  // banner's yes into Shopify's _tracking_consent cookie on .trymstene.com
  // lets checkout inherit it. Decliners get NO cookie — checkout then stays
  // blocked-pending-consent, which is exactly right. Non-EEA needs no signal.
  function syncShopify() {
    var h = location.hostname;
    if (h !== 'trymstene.com' && h !== 'www.trymstene.com') return;
    if (/(^|; )_tracking_consent=/.test(document.cookie)) return; // already synced
    var api = document.createElement('script');
    api.async = true;
    api.src = 'https://cdn.shopify.com/shopifycloud/consent-tracking-api/v0.1/consent-tracking-api.js';
    api.onload = function () {
      try {
        window.Shopify.customerPrivacy.setTrackingConsent({
          analytics: true, marketing: true, preferences: true, sale_of_data: true,
          headlessStorefront: true,
          checkoutRootDomain: 'shop.trymstene.com',
          storefrontRootDomain: 'trymstene.com',
          storefrontAccessToken: '1032480366b6bf67760ba73ace4fe0f8',
        }, function () {});
      } catch (e) {}
    };
    document.head.appendChild(api);
  }
  cc.syncShopify = syncShopify;
  // Earlier accepters (or an expired cookie): re-assert on load
  if (eea && choice === 'y') syncShopify();

  // Banner: only when a choice is actually needed — and only where real
  // visitors are (production host); previews/localhost QA via ?cookietest.
  if (!eea || choice) return;
  var host = location.hostname;
  if (host !== 'trymstene.com' && host !== 'www.trymstene.com' && !force) return;
  if (/[?&]overlay=1/.test(location.search)) return; // OBS overlays = machines
  var internal = false;
  try { internal = localStorage.getItem('tt-internal') === '1'; } catch (e) {}
  if (internal && !force) return; // flagged browsers track nothing anyway

  var el = document.createElement('div');
  el.className = 'ccb';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Cookie choice');
  el.innerHTML =
    '<img class="ccb__nana" src="/favicon.svg" alt="" width="52" height="52">' +
    '<div class="ccb__bubble">' +
      '<p class="ccb__say"><strong>cookies?</strong> i only eat jelly — but Google would like a crumb to count your visit.</p>' +
      '<div class="ccb__row">' +
        '<button type="button" class="ccb__btn ccb__btn--yes">sure 🍌</button>' +
        '<button type="button" class="ccb__btn ccb__btn--no">no thanks</button>' +
        '<a class="ccb__what" href="/privacy/">what?</a>' +
      '</div>' +
    '</div>';
  function done(val) {
    try { localStorage.setItem(KEY, val); } catch (e) {}
    el.classList.add('ccb--out');
    setTimeout(function () { el.remove(); }, 350);
  }
  el.querySelector('.ccb__btn--yes').addEventListener('click', function () {
    done('y');
    cc.allowed = true;
    cc.denied = false;
    syncShopify(); // carry the yes into the shop.trymstene.com checkout
    if (window.gtag) gtag('consent', 'update', {
      ad_storage: 'granted', ad_user_data: 'granted',
      ad_personalization: 'granted', analytics_storage: 'granted',
    });
    cc.onAccept.forEach(function (f) { f(); });
    cc.onAccept.length = 0;
  });
  el.querySelector('.ccb__btn--no').addEventListener('click', function () {
    done('n');
    cc.denied = true;
  });
  document.body.appendChild(el);
})();

// Google Analytics (GA4) — production only (skips github.io preview + localhost)
(function () {
  var GA_ID = 'G-1C0QRT9SRK';
  var host = location.hostname;
  if (host !== 'trymstene.com' && host !== 'www.trymstene.com') return;
  // OBS/stream overlays are machine views, not people — a streamer's browser
  // source would fire a "session" every stream start. Don't count them.
  if (/[?&]overlay=1/.test(location.search)) return;

  // ---- internal-traffic flag: OUR browsers send NOTHING ----
  // Checked BEFORE any analytics loads. Visit trymstene.com/?internal=1 ONCE
  // per browser to flag it forever (?internal=0 clears it); QA/debug params
  // flag that session; opening bananamail (/inbox?token=…) flags forever.
  // Flagged = fully silent: GA4's Internal Traffic data filter cleans the
  // standard reports, but the REALTIME API (Banana Pulse's live map) shows
  // whatever it receives — tagging wasn't enough (proven 13 Jul), so the only
  // reliable exclusion is to never talk to Google at all. Builder share
  // params (?g=…&h=…) are NOT internal — real people follow those.
  var qs = location.search;
  try {
    if (/[?&]internal=1(?:&|$)/.test(qs)) localStorage.setItem('tt-internal', '1');
    else if (/[?&]internal=0(?:&|$)/.test(qs)) localStorage.removeItem('tt-internal');
  } catch (e) {}
  var isInternal = false;
  try { isInternal = localStorage.getItem('tt-internal') === '1'; } catch (e) {}
  if (!isInternal &&
      /[?&](tourtest|fxtest|welcometest|hypetest|stagetest|nighttest|cointest|standopen|counter|cookietest|beachtest)(?:=|&|$)/.test(qs)) {
    isInternal = true; // a QA/debug param = us, this session
  }
  if (!isInternal && /^\/inbox\/?$/.test(location.pathname) && /[?&]token=/.test(qs)) {
    try { localStorage.setItem('tt-internal', '1'); } catch (e) {}
    isInternal = true;
  }

  // gtag always EXISTS (site code calls it blindly) — but on a flagged
  // browser it's a dead end: gtag.js never loads, nothing is ever sent.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };

  if (isInternal) {
    if (window.console) {
      console.log('%c[GA] internal browser — analytics fully OFF, nothing is sent',
        'color:#b8860b;font-weight:bold');
    }
    return; // no gtag.js, no config, no Cloudflare beacon, no event wiring
  }

  // Consent Mode v2: the default is pushed BEFORE gtag.js loads. EEA visitors
  // without a stored yes start denied; everyone else (and stored-yes) starts
  // granted. The cookie banner (module above) flips denied→granted live via
  // gtag('consent','update') + the onAccept queue — no reload needed.
  var cc = window.__cookieConsent;
  gtag('consent', 'default', cc.allowed ? {
    ad_storage: 'granted', ad_user_data: 'granted',
    ad_personalization: 'granted', analytics_storage: 'granted',
  } : {
    ad_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', analytics_storage: 'denied',
  });

  function loadTrackers() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);

    // Microsoft Clarity — session recordings + heatmaps (free, uncapped).
    // Sits INSIDE the production + internal-flag + consent guards like GA:
    // flagged browsers and consent-less EEA visitors record nothing.
    // Recordings stop at the Shopify domain.
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', 'xmja5x3h8h');
    if (cc.eea) clarity('consent'); // consented European: tell Clarity cookies are OK
  }
  if (cc.allowed) loadTrackers();
  else if (!cc.denied) cc.onAccept.push(loadTrackers);

  // Cloudflare Web Analytics — adblocker-resilient, server-side pageview truth
  // (GA4 is blocked for ~30-40% of visitors; this cross-checks the real total).
  // Cookieless by design = consent-exempt, so it loads regardless of the banner
  // and keeps counting the decliners anonymously. Token is public.
  var cfb = document.createElement('script');
  cfb.defer = true;
  cfb.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  cfb.setAttribute('data-cf-beacon', '{"token":"2ec40ec596fc44a19251c3d36b1f0abb"}');
  document.head.appendChild(cfb);

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
  // Club Notices (gallery verdicts etc.) ride the same dot — unread ones are
  // marked read by the pass page itself, which dispatches pass:change
  function unreadNotices() {
    try {
      var l = JSON.parse(localStorage.getItem('ps-notices-v1') || '[]');
      var n = 0;
      for (var i = 0; i < l.length; i++) if (l[i] && !l[i].read) n++;
      return n;
    } catch (e) { return 0; }
  }
  function renderPassNote() {
    var unseen = Math.max(0, earnedCount() - seenCount()) + unreadNotices();
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
    if (pass) pass.setAttribute('aria-label', unseen > 0 ? ('Your banana pass — ' + unseen + ' new') : 'Your banana pass');
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
