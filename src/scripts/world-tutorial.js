// 🌍 THE BANANA WORLD TOUR — the general welcome wizard (Trym, 6 Aug).
//
// The rave has its guided tour; this is the WORLD's: shown once, on your first
// visit to the Homestead (the world's front door now that the road is open).
// Skippable from every step, a progress bar so you can see the end, and the
// rave tour's core doctrine turned up: SHOWING IS TELLING. Real postcards of
// each area (tools/build-world-tour.py crops the actual plates), the real
// action-bar art, the real HUD chrome — text stays one line wherever it can.
//
// 🎨 13 Aug visual rehaul (Trym): rounded and PLAYFUL, not boxy — tilted
// stickers for the organic feel, Ken Burns zooms on the plates, an animated
// travel rundown through all FOUR areas (the Homestead included), a beat-by-
// beat make-it-yours pipeline, and a finale styled like our OG share cards
// (giant happy banana + title) that namedrops the Discord and points at the
// first quest. Every animation sits behind prefers-reduced-motion.
//
// Same world-level-widget deal as world-travel.js: brings its own CSS once,
// looks identical wherever it's mounted.

const KEY = 'bw-tour-v1';

const CSS = `
.bwt-veil {
  /* z 9000: the quest journal chip (z 900, inside the frame) drew OVER the
     tour card at z 90 — the tour is a full-screen moment, nothing world-side
     should poke through it */
  position:fixed; inset:0; z-index:9000; display:grid; place-items:center;
  background:rgba(4,8,4,0.82); padding:1rem;
}
.bwt-veil[hidden] { display:none; }
.bwt-card {
  width:min(470px,100%); background:#14240f; color:#fffdf5;
  border:4px solid #000; border-radius:18px; box-shadow:8px 8px 0 #000;
  padding:1rem 1.1rem 1.1rem; box-sizing:border-box; position:relative;
}
.bwt-skip {
  position:absolute; top:0.65rem; right:0.8rem; background:none; border:0;
  color:rgba(255,253,245,0.55); font:inherit; font-size:0.74rem; font-weight:800;
  cursor:pointer; text-decoration:underline; padding:0.2rem; z-index:2;
}
.bwt-skip:hover { color:#ffe135; }
/* right margin clears the whole skip link — 4rem left it lying ON the bar */
.bwt-bar { display:flex; gap:5px; margin:0.1rem 7.5rem 0.95rem 0; }
.bwt-bar i {
  flex:1; height:13px; background:#243a1c; border:2px solid #000; border-radius:99px;
}
.bwt-bar i.on {
  background:linear-gradient(#fff3a0,#ffe135 45%,#f2c012);
  box-shadow:0 0 10px rgba(255,225,53,0.55), inset 0 1px 0 rgba(255,255,255,0.55);
}
/* the segment you're ON burns a little brighter (browsers without :has()
   simply skip the pulse) */
.bwt-bar i.on:has(+ i:not(.on)), .bwt-bar i.on:last-child {
  animation:bwtGlow 1.6s ease-in-out infinite;
}
@keyframes bwtGlow {
  0%,100% { box-shadow:0 0 8px rgba(255,225,53,0.45), inset 0 1px 0 rgba(255,255,255,0.55); }
  50% { box-shadow:0 0 16px rgba(255,225,53,0.95), inset 0 1px 0 rgba(255,255,255,0.55); }
}
.bwt-title { margin:0 0 0.2rem; font-size:1.15rem; color:#ffe135; letter-spacing:0.02em; }
.bwt-sub { margin:0 0 0.85rem; font-size:0.82rem; line-height:1.5; color:rgba(255,253,245,0.78); }
.bwt-stage { display:grid; gap:0.6rem; margin-bottom:1rem; }

/* 🏷 the tilted sticker label — the one label grammar of the whole tour */
.bwt-slab {
  position:absolute; left:-6px; top:-10px; transform:rotate(-3deg);
  background:#ffe135; color:#241c00; border:3px solid #000; border-radius:8px;
  font-size:0.82rem; font-weight:800; padding:0.3rem 0.65rem; line-height:1;
  box-shadow:3px 3px 0 rgba(0,0,0,0.5); white-space:nowrap; z-index:2;
}

/* 📸 a full-bleed plate with a slow Ken Burns drift */
.bwt-full {
  position:relative; border:3px solid #000; border-radius:14px; overflow:hidden;
  box-shadow:4px 4px 0 rgba(0,0,0,0.5); transform:rotate(0.6deg);
}
.bwt-full img { display:block; width:100%; height:auto; animation:bwtKen 9s ease-in-out infinite alternate; }
@keyframes bwtKen { 0% { transform:scale(1); } 100% { transform:scale(1.1) translate(-1.5%,-1.5%); } }

/* 🎠 the travel rundown — one plate at a time, each with its tilted title */
.bwt-show { position:relative; aspect-ratio:420/264; }
.bwt-slide {
  position:absolute; inset:0; margin:0; border:3px solid #000; border-radius:14px;
  overflow:hidden; box-shadow:4px 4px 0 rgba(0,0,0,0.5);
  opacity:0; transition:opacity 0.45s ease; pointer-events:none;
}
.bwt-slide.on { opacity:1; pointer-events:auto; }
.bwt-slide img { display:block; width:100%; height:100%; object-fit:cover; }
.bwt-slide.on img { animation:bwtKen 7s ease-in-out infinite alternate; }
.bwt-slide .bwt-slab { top:auto; bottom:10px; left:10px; }
.bwt-slide:nth-child(even) .bwt-slab { left:auto; right:10px; transform:rotate(2.5deg); }
.bwt-dots { display:flex; gap:7px; justify-content:center; padding-top:0.15rem; }
.bwt-dots button {
  width:11px; height:11px; padding:0; border-radius:50%; cursor:pointer;
  background:#243a1c; border:2px solid #000;
}
.bwt-dots button.on { background:#ffe135; }

/* 🛠 rounded playful tiles — equal boxes, alternating tilt, staggered bob */
.bwt-row { display:flex; gap:0.6rem; align-items:stretch; }
.bwt-tile {
  flex:1; display:grid; justify-items:center; align-content:center; gap:0.4rem;
  background:#1c2f15; border:3px solid #000; border-radius:14px;
  padding:0.7rem 0.3rem 0.6rem; min-height:74px; box-shadow:3px 3px 0 rgba(0,0,0,0.4);
}
.bwt-tile img, .bwt-tile svg { image-rendering:pixelated; }
.bwt-tile em { font-style:normal; font-size:0.7rem; font-weight:800; text-align:center; line-height:1; }
.bwt-row--tools .bwt-tile { animation:bwtBob 3.4s ease-in-out infinite; }
.bwt-row--tools .bwt-tile:nth-child(odd) { transform:rotate(-1.6deg); }
.bwt-row--tools .bwt-tile:nth-child(even) { transform:rotate(1.6deg); animation-delay:0.6s; }
.bwt-row--tools .bwt-tile:nth-child(3) { animation-delay:1.2s; }
@keyframes bwtBob { 0%,100% { translate:0 0; } 50% { translate:0 -3px; } }

/* 📦 the make-it-yours pipeline — three beats that pop in turn, forever */
.bwt-flow .bwt-tile > :first-child { animation:bwtBeat 3.9s ease-in-out infinite; }
.bwt-flow .bwt-tile:nth-child(1) > :first-child { animation-delay:0s; }
.bwt-flow .bwt-tile:nth-child(3) > :first-child { animation-delay:1.3s; }
.bwt-flow .bwt-tile:nth-child(5) > :first-child { animation-delay:2.6s; }
.bwt-flow .bwt-tile:nth-child(1) { transform:rotate(-1.8deg); }
.bwt-flow .bwt-tile:nth-child(3) { transform:rotate(1.4deg); }
.bwt-flow .bwt-tile:nth-child(5) { transform:rotate(-1.2deg); }
@keyframes bwtBeat { 0%,28%,100% { transform:scale(1); } 8%,16% { transform:scale(1.22); } }
.bwt-arrow { align-self:center; font-size:1rem; font-weight:800; color:#ffe135; animation:bwtNudge 3.9s ease-in-out infinite; }
.bwt-row .bwt-arrow:nth-child(2) { animation-delay:0.9s; }
.bwt-row .bwt-arrow:nth-child(4) { animation-delay:2.2s; }
@keyframes bwtNudge { 0%,30%,100% { translate:0 0; opacity:0.75; } 10%,18% { translate:3px 0; opacity:1; } }
/* the fine-print pills under the pipeline — a loose, tilted sticker row */
.bwt-pills { display:flex; flex-wrap:wrap; gap:0.5rem 0.55rem; justify-content:center; padding-top:0.35rem; }
.bwt-pill {
  background:#1a1408; color:#ffe135; border:3px solid #000; border-radius:999px;
  font-size:0.7rem; font-weight:800; padding:0.35rem 0.7rem; line-height:1.2;
  box-shadow:2px 2px 0 rgba(0,0,0,0.45);
}
.bwt-pill:nth-child(odd) { transform:rotate(-2deg); }
.bwt-pill:nth-child(even) { transform:rotate(1.6deg); }
.bwt-pill img { height:1em; width:auto; image-rendering:pixelated; vertical-align:-0.12em; }

/* 🌅 the welcome — the banana on a slowly turning sunburst */
.bwt-hero { display:grid; place-items:center; padding:0.4rem 0 0.2rem; position:relative; }
.bwt-hero canvas { width:132px; height:132px; image-rendering:pixelated; position:relative; z-index:1; }
.bwt-burst {
  position:absolute; width:210px; height:210px; border-radius:50%;
  background:repeating-conic-gradient(rgba(255,225,53,0.14) 0 11deg, transparent 11deg 24deg);
  animation:bwtSpin 26s linear infinite;
}
@keyframes bwtSpin { to { transform:rotate(360deg); } }
.bwt-hero .bwt-heropill {
  position:relative; z-index:1; margin-top:0.4rem; transform:rotate(-2deg);
  background:#ffe135; color:#241c00; border:3px solid #000; border-radius:8px;
  font-size:0.78rem; font-weight:800; padding:0.3rem 0.7rem;
  box-shadow:3px 3px 0 rgba(0,0,0,0.5);
}

/* 🎖 HUD chips, alive: the bar keeps filling, the coin gives a beat */
.bwt-hud { display:flex; gap:0.55rem; justify-content:center; padding:0.5rem 0; }
.bwt-lvl, .bwt-coin {
  display:inline-flex; align-items:center; gap:0.4rem; border:3px solid #000;
  border-radius:999px; padding:0.35rem 0.8rem; font-weight:800; font-size:0.85rem;
}
.bwt-lvl { background:#1a1408; color:#ffe135; border-color:#ffe135; transform:rotate(-1.6deg); }
.bwt-lvl i { display:inline-block; width:56px; height:8px; background:#3a3110; border-radius:99px; overflow:hidden; }
.bwt-lvl i::after { content:''; display:block; height:100%; background:#ffe135; animation:bwtFill 3s ease-in-out infinite; }
@keyframes bwtFill { 0% { width:12%; } 70%,100% { width:88%; } }
.bwt-coin { background:#1a1408; color:#ffe135; transform:rotate(1.4deg); animation:bwtBob 3.4s ease-in-out infinite 0.8s; }
.bwt-coin img { width:15px; height:15px; image-rendering:pixelated; }

.bwt-map { display:grid; place-items:center; padding:0.2rem 0 0.4rem; transform:rotate(-1.2deg); }

/* 🍌 the finale — our OG share-card, live: yellow field, sticker, big words,
   giant happy banana. The card the internet already knows us by. */
.bwt-og {
  position:relative; background:#ffe135; border:4px solid #000; border-radius:16px;
  box-shadow:5px 5px 0 rgba(0,0,0,0.5); padding:1.6rem 1rem 0.9rem;
  display:grid; justify-items:center; gap:0.15rem; transform:rotate(-0.8deg);
}
.bwt-og .bwt-ogpill {
  position:absolute; top:-12px; left:12px; transform:rotate(-3deg);
  background:#ff5c7a; color:#fff; border:3px solid #000; border-radius:6px;
  font-size:0.66rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;
  padding:0.3rem 0.6rem; box-shadow:2px 2px 0 rgba(0,0,0,0.4);
}
.bwt-og h3 {
  margin:0; color:#1a1408; font-size:1.45rem; line-height:1.1; text-align:center;
  letter-spacing:0.01em;
}
.bwt-og canvas { width:150px; height:150px; image-rendering:pixelated; }
.bwt-og small { justify-self:start; font-size:0.62rem; font-weight:800; color:#1a1408; opacity:0.65; }
.bwt-disc {
  display:block; width:100%; box-sizing:border-box; margin-top:0.6rem; text-align:center;
  cursor:pointer; font-family:inherit; font-weight:800; font-size:0.8rem;
  background:#182a16; color:#fffdf5; border:3px solid #000; border-radius:10px;
  box-shadow:3px 3px 0 #000; padding:0.55rem; text-decoration:none;
}
.bwt-disc:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }

.bwt-next {
  width:100%; cursor:pointer; font-family:inherit; font-weight:800; font-size:0.98rem;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  border:3px solid #000; border-radius:12px; box-shadow:3px 3px 0 #000; padding:0.7rem;
}
.bwt-next:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
.bwt-back {
  width:100%; margin-top:0.5rem; cursor:pointer; font-family:inherit; font-weight:800;
  font-size:0.78rem; background:#182a16; color:#fffdf5; border:3px solid #000;
  border-radius:12px; box-shadow:3px 3px 0 #000; padding:0.45rem;
}
.bwt-back:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
@media (prefers-reduced-motion:reduce) {
  .bwt-next, .bwt-back { transition:none; }
  .bwt-full img, .bwt-slide.on img, .bwt-row--tools .bwt-tile, .bwt-flow .bwt-tile > :first-child,
  .bwt-arrow, .bwt-burst, .bwt-lvl i::after, .bwt-coin { animation:none; }
  .bwt-lvl i::after { width:62%; }
}
/* 🍌 THE INVITE — the tour is a CHOICE now (Trym, 12 Aug): a small chip
   bottom-left in the frame offers it instead of a modal smacking the first
   second of play (it collided with the quest chip and blocked the walk). */
.bwt-invite {
  position:absolute; left:14px; bottom:56px; z-index:60; display:flex; gap:6px;
  opacity:0; transform:scale(0.6); pointer-events:none;
}
.bwt-invite.is-on {
  opacity:1; transform:none; pointer-events:auto;
  transition:opacity 0.3s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
}
.bwt-invite__go {
  cursor:pointer; font-family:inherit; font-weight:800; font-size:0.78rem;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  border:3px solid #000; box-shadow:3px 3px 0 #000; border-radius:2px;
  padding:0.5rem 0.75rem; white-space:nowrap;
}
.bwt-invite__x {
  cursor:pointer; font-family:inherit; font-weight:800; font-size:0.8rem;
  background:#14240f; color:#fffdf5; border:3px solid #000; box-shadow:3px 3px 0 #000;
  border-radius:2px; width:36px;
}
@media (prefers-reduced-motion:reduce) { .bwt-invite.is-on { transition:none; } }
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
// south, bay east — drawn, not described. A little gold walker rides the
// roads on loop (SMIL, skipped under reduced motion).
function roadMap(rm) {
  return '<svg viewBox="0 0 300 120" width="290" height="116" aria-hidden="true">'
    + '<path d="M40 62 L150 60 L262 58" stroke="#c9a86a" stroke-width="9" fill="none" stroke-linecap="round"/>'
    + '<path d="M150 60 L152 104" stroke="#c9a86a" stroke-width="9" fill="none" stroke-linecap="round"/>'
    + (rm ? '' : ('<circle r="6" fill="#ffe135" stroke="#000" stroke-width="2.5">'
      + '<animateMotion dur="9s" repeatCount="indefinite"'
      + ' path="M40 62 L150 60 L262 58 L150 60 L152 104 L150 60 L40 62"/></circle>'))
    + '<circle cx="40" cy="60" r="20" fill="#1c2f15" stroke="#000" stroke-width="3"/>'
    + '<circle cx="150" cy="58" r="20" fill="#1c2f15" stroke="#000" stroke-width="3"/>'
    + '<circle cx="262" cy="56" r="20" fill="#1c2f15" stroke="#000" stroke-width="3"/>'
    + '<circle cx="152" cy="102" r="16" fill="#1c2f15" stroke="#000" stroke-width="3"/>'
    + '<text x="40" y="67" font-size="19" text-anchor="middle">🏡</text>'
    + '<text x="150" y="65" font-size="19" text-anchor="middle">🌳</text>'
    + '<text x="262" y="63" font-size="19" text-anchor="middle">🏖</text>'
    + '<text x="152" y="109" font-size="16" text-anchor="middle">🪩</text>'
    + '</svg>';
}

const A = '/assets/homestead/';
const DISCORD = 'https://discord.gg/cuF6BHfZT4';

// the rundown's stops — the Homestead rides along (it was missing from the
// old four-corners grid, which had three photos and an apology tile)
const STOPS = [
  { img: '/assets/world/tour-home.jpg', n: 'the Homestead' },
  { img: '/assets/world/tour-park.jpg', n: 'the Park' },
  { img: '/assets/world/tour-rave.jpg', n: 'the Rave' },
  { img: '/assets/world/tour-beach.jpg', n: 'Banana Bay' },
];

function steps(rm) {
  return [
    {
      t: 'Welcome to Banana World',
      s: '',
      h: '<div class="bwt-hero"><span class="bwt-burst"></span>'
        + '<canvas width="150" height="150"></canvas>'
        + '<span class="bwt-heropill">one banana · one world · all yours</span></div>',
      hero: true,
    },
    {
      t: 'This is the Homestead',
      s: 'your home. pitch the tent, put your name on the sign, build it up.',
      h: '<div class="bwt-full"><img src="/assets/world/tour-home.jpg" alt="the homestead" width="420" height="264">'
        + '<b class="bwt-slab">plot 11 · yours</b></div>',
    },
    {
      t: 'Your tools',
      s: 'the bar at the bottom — everything you do starts here.',
      h: '<div class="bwt-row bwt-row--tools">'
        + '<span class="bwt-tile"><span class="bwt-ic" data-clone="#hsEmote svg" style="font-size:1.5rem">❤️</span><em>say hi</em></span>'
        + '<span class="bwt-tile"><span style="font-size:1.5rem">🔨</span><em>build</em></span>'
        + '<span class="bwt-tile"><img src="' + A + 'phone.png" width="26" height="26" alt=""><em>phone</em></span>'
        + '<span class="bwt-tile">' + DOOR + '<em>travel</em></span>'
        + '</div>',
      clone: true,
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
      h: '<div class="bwt-map">' + roadMap(rm) + '</div>',
    },
    {
      t: 'Four corners of the world',
      s: 'every area has its own games — this is the neighbourhood.',
      h: '<div class="bwt-show">'
        + STOPS.map((p, k) => '<figure class="bwt-slide' + (k === 0 ? ' on' : '') + '">'
          + '<img src="' + p.img + '" alt="' + p.n + '" loading="eager">'
          + '<b class="bwt-slab">' + p.n + '</b></figure>').join('')
        + '</div>'
        + '<div class="bwt-dots">'
        + STOPS.map((p, k) => '<button type="button" aria-label="' + p.n + '"'
          + (k === 0 ? ' class="on"' : '') + '></button>').join('')
        + '</div>',
      show: true,
    },
    {
      t: 'Make it yours',
      s: 'order on the phone → the van delivers → build mode places it.',
      h: '<div class="bwt-row bwt-flow">'
        + '<span class="bwt-tile"><img src="' + A + 'phone.png" width="26" height="26" alt=""><em>order</em></span>'
        + '<span class="bwt-arrow">→</span>'
        + '<span class="bwt-tile"><img src="' + A + 'm-mail.png" width="30" height="36" alt=""><em>delivered</em></span>'
        + '<span class="bwt-arrow">→</span>'
        + '<span class="bwt-tile"><img src="' + A + 'd-sofa.png" width="48" height="24" alt="" style="width:48px;height:auto"><em>placed</em></span>'
        + '</div>'
        + '<div class="bwt-pills">'
        + '<span class="bwt-pill">⛲ decorate</span>'
        + '<span class="bwt-pill">🌱 grow veggies</span>'
        + '<span class="bwt-pill">⛺ tent → cabin → house</span>'
        + '<span class="bwt-pill"><img src="' + A + 'coin16.png" alt=""> paid in bananacoins — earned by playing</span>'
        + '</div>',
    },
    {
      t: '',
      s: '',
      h: '<div class="bwt-og"><i class="bwt-ogpill">always growing</i>'
        + '<h3>welcome home,<br>banana</h3>'
        + '<canvas width="150" height="150"></canvas>'
        + '<small>trymstene.com</small></div>'
        + '<p class="bwt-sub" style="margin:0.7rem 0 0; text-align:center">'
        + 'Nib is waiting outside with your first quest — and new things land every week. '
        + 'The Discord hears about them first.</p>'
        + '<a class="bwt-disc" href="' + DISCORD + '" target="_blank" rel="noopener">💬 join the Discord ↗</a>',
      hero: true,
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

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = steps(RM);
  let i = 0;
  let heroTimer = null, showTimer = null;

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
    clearInterval(heroTimer); clearInterval(showTimer);
    veil.remove();
    if (track) track(how === 'skip' ? 'bwtour_skip' : 'bwtour_done', { step: i });
  };

  function show(n) {
    i = Math.max(0, Math.min(S.length - 1, n));
    const st = S[i];
    veil.querySelectorAll('.bwt-bar i').forEach((seg, k) => seg.classList.toggle('on', k <= i));
    el('.bwt-title').textContent = st.t;
    el('.bwt-title').style.display = st.t ? '' : 'none';
    el('.bwt-sub').textContent = st.s;
    el('.bwt-sub').style.display = st.s ? '' : 'none';
    el('.bwt-stage').innerHTML = st.h;
    el('.bwt-next').textContent = st.last ? "let's go 🍌" : 'next →';
    el('.bwt-back').style.display = i === 0 ? 'none' : '';
    clearInterval(heroTimer); clearInterval(showTimer);
    if (st.hero && paint) {
      const cv = el('.bwt-stage canvas');
      const beat = () => { try { paint(cv); } catch (e) {} };
      beat();
      heroTimer = setInterval(beat, 120);   // the welcome banana dances
    }
    // 🛠 the say-hi tile clones the REAL pixel heart off the action bar
    if (st.clone) {
      veil.querySelectorAll('.bwt-ic[data-clone]').forEach((slot) => {
        const real = document.querySelector(slot.getAttribute('data-clone'));
        if (real) { slot.textContent = ''; slot.style.fontSize = ''; slot.appendChild(real.cloneNode(true)); }
      });
    }
    // 🎠 the travel rundown — auto-advances; the dots are also buttons
    if (st.show) {
      const slides = [...veil.querySelectorAll('.bwt-slide')];
      const dots = [...veil.querySelectorAll('.bwt-dots button')];
      let k = 0;
      const go = (n2) => {
        k = (n2 + slides.length) % slides.length;
        slides.forEach((s2, j) => s2.classList.toggle('on', j === k));
        dots.forEach((d2, j) => d2.classList.toggle('on', j === k));
      };
      dots.forEach((d2, j) => d2.addEventListener('click', () => { go(j); restart(); }));
      const restart = () => {
        clearInterval(showTimer);
        if (!RM) showTimer = setInterval(() => go(k + 1), 2600);
      };
      restart();
    }
    // 💬 the finale's Discord door — counts as a warm-up offer taken
    const disc = el('.bwt-disc');
    if (disc && track) disc.addEventListener('click', () => track('offer_discord', { from: 'bwtour' }));
    if (track) track('bwtour_step', { step: i });
  }

  el('.bwt-skip').addEventListener('click', () => done('skip'));
  el('.bwt-next').addEventListener('click', () => (i >= S.length - 1 ? done('done') : show(i + 1)));
  el('.bwt-back').addEventListener('click', () => show(i - 1));

  show(0);
  if (track) track('bwtour_open');
  return { close: () => done('skip') };
}

const INV_KEY = 'bw-tour-inv';   // '1' = the invite was waved away for good

/**
 * 🍌 THE INVITE — the tour as a CHOICE (Trym, 12 Aug). The wizard used to
 * auto-open on the first visit, colliding with the quest chip and blocking
 * the first minute of play. Now a small chip bottom-left OFFERS it: tap =
 * the wizard opens; ✕ = never asks again; finishing or skipping the wizard
 * retires the invite too (it keys off the same bw-tour-v1 seen flag).
 * @param mount  the game view element the chip docks into
 */
export function initTutorialInvite({ mount, paint, track } = {}) {
  let seen = false, waved = false;
  try {
    seen = !!localStorage.getItem(KEY);
    waved = !!localStorage.getItem(INV_KEY);
  } catch (e) {}
  if (seen || waved) return null;

  if (!styled) {
    styled = true;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  const b = document.createElement('div');
  b.className = 'bwt-invite';
  b.innerHTML = '<button class="bwt-invite__go" type="button">🍌 new here? take the tour</button>'
    + '<button class="bwt-invite__x" type="button" aria-label="no thanks">✕</button>';
  (mount || document.body).appendChild(b);
  // a soft beat after the world lands — never the first thing that happens
  setTimeout(() => { if (b.isConnected) b.classList.add('is-on'); }, 1600);
  if (track) track('bwtour_invite');

  b.querySelector('.bwt-invite__go').addEventListener('click', () => {
    b.remove();
    initWorldTutorial({ paint, track, force: true });
  });
  b.querySelector('.bwt-invite__x').addEventListener('click', () => {
    try { localStorage.setItem(INV_KEY, '1'); } catch (e) {}
    b.classList.remove('is-on');
    setTimeout(() => b.remove(), 350);
    if (track) track('bwtour_invite_no');
  });
  return { el: b };
}
