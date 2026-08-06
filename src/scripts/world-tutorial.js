// 🌍 THE BANANA WORLD TOUR — the general welcome wizard (Trym, 6 Aug).
//
// The rave has its guided tour; this is the WORLD's: shown once, on your first
// visit to the Homestead (the world's front door now that the road is open).
// Skippable from every step, a progress bar so you can see the end, and the
// rave tour's core doctrine turned up: SHOWING IS TELLING. Real postcards of
// each area (tools/build-world-tour.py crops the actual plates), the real
// action-bar art, the real HUD chrome — text stays one line wherever it can.
//
// Same world-level-widget deal as world-travel.js: brings its own CSS once,
// looks identical wherever it's mounted.

const KEY = 'bw-tour-v1';

const CSS = `
.bwt-veil {
  position:fixed; inset:0; z-index:90; display:grid; place-items:center;
  background:rgba(4,8,4,0.82); padding:1rem;
}
.bwt-veil[hidden] { display:none; }
.bwt-card {
  width:min(470px,100%); background:#14240f; color:#fffdf5;
  border:4px solid #000; box-shadow:8px 8px 0 #000;
  padding:1rem 1.1rem 1.1rem; box-sizing:border-box; position:relative;
}
.bwt-skip {
  position:absolute; top:0.65rem; right:0.8rem; background:none; border:0;
  color:rgba(255,253,245,0.55); font:inherit; font-size:0.74rem; font-weight:800;
  cursor:pointer; text-decoration:underline; padding:0.2rem;
}
.bwt-skip:hover { color:#ffe135; }
.bwt-bar { display:flex; gap:4px; margin:0 4rem 0.9rem 0; }
.bwt-bar i {
  flex:1; height:7px; background:#243a1c; border:2px solid #000; border-radius:99px;
}
.bwt-bar i.on { background:#ffe135; }
.bwt-title { margin:0 0 0.2rem; font-size:1.15rem; color:#ffe135; letter-spacing:0.02em; }
.bwt-sub { margin:0 0 0.85rem; font-size:0.82rem; line-height:1.5; color:rgba(255,253,245,0.78); }
.bwt-stage { display:grid; gap:0.6rem; margin-bottom:1rem; }
.bwt-post { position:relative; border:3px solid #000; box-shadow:4px 4px 0 rgba(0,0,0,0.5); }
.bwt-post img { display:block; width:100%; height:auto; image-rendering:auto; }
.bwt-post b {
  position:absolute; left:8px; bottom:8px; background:#1a1408; color:#ffe135;
  font-size:0.72rem; font-weight:800; padding:0.2rem 0.55rem; border-radius:4px;
}
.bwt-hero { display:grid; place-items:center; padding:0.4rem 0 0.2rem; }
.bwt-hero canvas { width:132px; height:132px; image-rendering:pixelated; }
.bwt-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; }
.bwt-row { display:flex; gap:0.6rem; align-items:stretch; }
.bwt-tile {
  flex:1; display:grid; justify-items:center; align-content:start; gap:0.35rem;
  background:#1c2f15; border:3px solid #000; padding:0.6rem 0.3rem 0.5rem;
}
.bwt-tile img, .bwt-tile svg { image-rendering:pixelated; }
.bwt-tile em { font-style:normal; font-size:0.7rem; font-weight:800; text-align:center; line-height:1.25; }
.bwt-tile small { font-size:0.62rem; opacity:0.65; text-align:center; line-height:1.3; }
.bwt-arrow { align-self:center; font-size:1rem; font-weight:800; color:#ffe135; }
.bwt-hud { display:flex; gap:0.55rem; justify-content:center; padding:0.4rem 0; }
.bwt-lvl, .bwt-coin {
  display:inline-flex; align-items:center; gap:0.4rem; border:3px solid #000;
  border-radius:999px; padding:0.35rem 0.8rem; font-weight:800; font-size:0.85rem;
}
.bwt-lvl { background:#1a1408; color:#ffe135; border-color:#ffe135; }
.bwt-lvl i { display:inline-block; width:56px; height:8px; background:#3a3110; border-radius:99px; overflow:hidden; }
.bwt-lvl i::after { content:''; display:block; width:62%; height:100%; background:#ffe135; }
.bwt-coin { background:#1a1408; color:#ffe135; }
.bwt-coin img { width:15px; height:15px; image-rendering:pixelated; }
.bwt-map { display:grid; place-items:center; padding:0.2rem 0 0.4rem; }
.bwt-next {
  width:100%; cursor:pointer; font-family:inherit; font-weight:800; font-size:0.98rem;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  border:3px solid #000; box-shadow:3px 3px 0 #000; padding:0.7rem;
}
.bwt-next:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
.bwt-back {
  width:100%; margin-top:0.5rem; cursor:pointer; font-family:inherit; font-weight:800;
  font-size:0.78rem; background:#182a16; color:#fffdf5; border:3px solid #000;
  box-shadow:3px 3px 0 #000; padding:0.45rem;
}
.bwt-back:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
@media (prefers-reduced-motion:reduce) { .bwt-next, .bwt-back { transition:none; } }
`;

// the same drawn door world-travel carries — a tiny copy keeps this module
// self-contained (the per-surface budget doctrine)
const DOOR = '<svg viewBox="0 0 8 15" width="16" height="30" shape-rendering="crispEdges" aria-hidden="true">'
  + '<path fill="#3a2918" d="M0 0h8v1h-8zM0 1h1v13h-1zM7 1h1v13h-1zM0 14h8v1h-8z"/>'
  + '<path fill="#8a5a2b" d="M1 1h6v12h-6z"/>'
  + '<path fill="#5f3d1c" d="M2 2h4v4h-4zM2 9h4v4h-4z"/>'
  + '<path fill="#a6713a" d="M3 3h2v2h-2zM3 10h2v2h-2z"/>'
  + '<path fill="#ffe135" d="M5 7h1v1h-1z"/></svg>';

// the roads, as a postcard-sized map: home west, the crossroad park, rave
// south, bay east — drawn, not described
const MAP = '<svg viewBox="0 0 300 120" width="290" height="116" aria-hidden="true">'
  + '<path d="M40 62 L150 60 L262 58" stroke="#c9a86a" stroke-width="9" fill="none" stroke-linecap="round"/>'
  + '<path d="M150 60 L152 104" stroke="#c9a86a" stroke-width="9" fill="none" stroke-linecap="round"/>'
  + '<circle cx="40" cy="60" r="20" fill="#1c2f15" stroke="#000" stroke-width="3"/>'
  + '<circle cx="150" cy="58" r="20" fill="#1c2f15" stroke="#000" stroke-width="3"/>'
  + '<circle cx="262" cy="56" r="20" fill="#1c2f15" stroke="#000" stroke-width="3"/>'
  + '<circle cx="152" cy="102" r="16" fill="#1c2f15" stroke="#000" stroke-width="3"/>'
  + '<text x="40" y="67" font-size="19" text-anchor="middle">🏡</text>'
  + '<text x="150" y="65" font-size="19" text-anchor="middle">🌳</text>'
  + '<text x="262" y="63" font-size="19" text-anchor="middle">🏖</text>'
  + '<text x="152" y="109" font-size="16" text-anchor="middle">🪩</text>'
  + '</svg>';

const A = '/assets/homestead/';

function steps() {
  return [
    {
      t: 'Welcome to Banana World',
      s: 'one banana. one world. all yours.',
      h: '<div class="bwt-hero"><canvas width="150" height="150"></canvas></div>',
      hero: true,
    },
    {
      t: 'This is the Homestead',
      s: 'your home. pitch the tent, put your name on the sign, build it up.',
      h: '<div class="bwt-post"><img src="/assets/world/tour-home.jpg" alt="the homestead" width="420" height="264"><b>the Homestead</b></div>',
    },
    {
      t: 'Your tools',
      s: 'the bar at the bottom — everything you do starts here.',
      h: '<div class="bwt-row">'
        + '<span class="bwt-tile"><span style="font-size:1.5rem">❤️</span><em>say hi</em></span>'
        + '<span class="bwt-tile"><span style="font-size:1.5rem">🔨</span><em>build mode</em></span>'
        + '<span class="bwt-tile"><img src="' + A + 'phone.png" width="26" height="26" alt=""><em>banana phone</em></span>'
        + '<span class="bwt-tile">' + DOOR + '<em>fast travel</em></span>'
        + '</div>',
    },
    {
      t: 'Level up anywhere',
      s: 'your level and bananacoins follow you — every area pays.',
      h: '<div class="bwt-hud">'
        + '<span class="bwt-lvl">LVL 7 <i></i></span>'
        + '<span class="bwt-coin"><img src="' + A + 'coin16.png" alt=""> 128</span>'
        + '</div>',
    },
    {
      t: 'The roads are real',
      s: 'walk out of one area and into the next — or tap the door and skip the walk.',
      h: '<div class="bwt-map">' + MAP + '</div>',
    },
    {
      t: 'Four corners of the world',
      s: '',
      h: '<div class="bwt-grid2">'
        + '<div class="bwt-post"><img src="/assets/world/tour-park.jpg" alt="the park" width="420" height="264"><b>the Park</b></div>'
        + '<div class="bwt-post"><img src="/assets/world/tour-rave.jpg" alt="the rave" width="420" height="264"><b>the Rave</b></div>'
        + '<div class="bwt-post"><img src="/assets/world/tour-beach.jpg" alt="banana bay" width="420" height="264"><b>Banana Bay</b></div>'
        + '<div class="bwt-tile" style="justify-content:center"><em>gardens · dancefloors ·<br>beaches · shops</em><small>every area has its own games</small></div>'
        + '</div>',
    },
    {
      t: 'Make it yours',
      s: 'order on the phone → the van delivers → build mode places it.',
      h: '<div class="bwt-row">'
        + '<span class="bwt-tile"><img src="' + A + 'phone.png" width="26" height="26" alt=""><em>order</em></span>'
        + '<span class="bwt-arrow">→</span>'
        + '<span class="bwt-tile"><img src="' + A + 'm-mail.png" width="30" height="36" alt=""><em>delivered</em></span>'
        + '<span class="bwt-arrow">→</span>'
        + '<span class="bwt-tile"><img src="' + A + 'd-sofa.png" width="48" height="24" alt="" style="width:48px;height:auto"><em>placed</em></span>'
        + '</div>'
        + '<div class="bwt-row" style="margin-top:0.6rem">'
        + '<span class="bwt-tile"><img src="' + A + 'd-fountain.gif" width="30" height="45" alt="" style="width:30px;height:auto"><em>decorate</em></span>'
        + '<span class="bwt-tile"><img src="' + A + 's-iso.png" onerror="this.remove()" width="30" height="30" alt=""><em>grow veggies</em></span>'
        + '<span class="bwt-tile"><img src="' + A + 'ov-country.png" width="60" height="40" alt="" style="width:60px;height:auto"><em>tent → cabin → house</em></span>'
        + '</div>',
    },
    {
      t: 'Always growing',
      s: 'Banana World is in development all the time — new things land every week.',
      h: '<div class="bwt-hero"><span style="font-size:2.6rem">🍌</span></div>',
      last: true,
    },
  ];
}

let styled = false;

/**
 * @param paint  (canvas) => void — draws the CURRENT dance frame of the
 *               player's banana; the wizard calls it on a beat so the
 *               welcome banana actually dances
 * @param track  analytics fn
 * @param force  show even if already seen (the ?bwtour replay)
 */
export function initWorldTutorial({ paint, track, force } = {}) {
  let seen = false;
  try { seen = !!localStorage.getItem(KEY); } catch (e) {}
  if (seen && !force) return null;

  if (!styled) {
    styled = true;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  const S = steps();
  let i = 0;
  let heroTimer = null;

  const veil = document.createElement('div');
  veil.className = 'bwt-veil';
  veil.innerHTML = '<div class="bwt-card" role="dialog" aria-modal="true" aria-label="Welcome to Banana World">'
    + '<button class="bwt-skip" type="button">skip the tour</button>'
    + '<div class="bwt-bar">' + S.map(() => '<i></i>').join('') + '</div>'
    + '<h2 class="bwt-title"></h2><p class="bwt-sub"></p>'
    + '<div class="bwt-stage"></div>'
    + '<button class="bwt-next" type="button"></button>'
    + '<button class="bwt-back" type="button">← back</button>'
    + '</div>';
  document.body.appendChild(veil);

  const el = (q) => veil.querySelector(q);
  const done = (how) => {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    clearInterval(heroTimer);
    veil.remove();
    if (track) track(how === 'skip' ? 'bwtour_skip' : 'bwtour_done', { step: i });
  };

  function show(n) {
    i = Math.max(0, Math.min(S.length - 1, n));
    const st = S[i];
    veil.querySelectorAll('.bwt-bar i').forEach((seg, k) => seg.classList.toggle('on', k <= i));
    el('.bwt-title').textContent = st.t;
    el('.bwt-sub').textContent = st.s;
    el('.bwt-sub').style.display = st.s ? '' : 'none';
    el('.bwt-stage').innerHTML = st.h;
    el('.bwt-next').textContent = st.last ? "let's go 🍌" : 'next →';
    el('.bwt-back').style.display = i === 0 ? 'none' : '';
    clearInterval(heroTimer);
    if (st.hero && paint) {
      const cv = el('.bwt-stage canvas');
      const beat = () => { try { paint(cv); } catch (e) {} };
      beat();
      heroTimer = setInterval(beat, 120);   // the welcome banana dances
    }
    if (track) track('bwtour_step', { step: i });
  }

  el('.bwt-skip').addEventListener('click', () => done('skip'));
  el('.bwt-next').addEventListener('click', () => (i >= S.length - 1 ? done('done') : show(i + 1)));
  el('.bwt-back').addEventListener('click', () => show(i - 1));

  show(0);
  if (track) track('bwtour_open');
  return { close: () => done('skip') };
}
