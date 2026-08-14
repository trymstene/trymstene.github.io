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
/* 0.6rem bottom = the SAME gap the buttons keep between themselves — the
   finale stacks stage-content straight onto the button column, so every
   vertical gap in the card reads as one rhythm */
.bwt-stage { display:grid; gap:0.6rem; margin-bottom:0.6rem; }

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
.bwt-pill img { height:1em; width:auto; vertical-align:-0.12em; }

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
/* smooth downscale of the 44px coin — pixelated at 15px ate the emboss */
.bwt-coin img { width:15px; height:15px; }

.bwt-map { display:grid; place-items:center; padding:0.2rem 0 0.4rem; transform:rotate(-1.2deg); }

/* 🍌 the finale — our share-card language, live: a glowing sun with ray
   stripes spreading to the sides, animals strolling the lawn, the fountain,
   and YOUR banana hands-up, close into the frame. */
.bwt-og { position:relative; transform:rotate(-0.8deg); }
.bwt-og .bwt-ogpill {
  position:absolute; top:-12px; left:12px; z-index:3; transform:rotate(-3deg);
  background:#ff5c7a; color:#fff; border:3px solid #000; border-radius:6px;
  font-size:0.66rem; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;
  padding:0.3rem 0.6rem; box-shadow:2px 2px 0 rgba(0,0,0,0.4);
}
.bwt-og__win {
  position:relative; aspect-ratio:420/320; border:4px solid #000; border-radius:16px;
  overflow:hidden; box-shadow:5px 5px 0 rgba(0,0,0,0.5); background:#ffe135;
}
.bwt-og__bg { position:absolute; inset:0; width:100%; height:100%; }
.bwt-og h3 {
  position:absolute; top:9%; left:0; right:0; z-index:1; margin:0;
  color:#1a1408; font-size:1.5rem; line-height:1.08; text-align:center;
  letter-spacing:0.01em; text-shadow:0 0 14px rgba(255,255,255,0.55);
}
.bwt-og__me {
  position:absolute; left:50%; bottom:-14%; z-index:2; width:230px; height:230px;
  transform:translateX(-50%) rotate(-5deg); image-rendering:pixelated;
  filter:drop-shadow(0 8px 10px rgba(60,60,10,0.35));
}
.bwt-og small {
  position:absolute; left:12px; bottom:8px; z-index:2;
  font-size:0.62rem; font-weight:800; color:#1a1408; opacity:0.7;
}
/* ⚖️ ONE button size — next, back and the Discord door share identical
   metrics (padding, font, line-height, border, radius); COLOUR is the
   hierarchy, never height (Trym: mixed heights read twonky) */
.bwt-next, .bwt-back, .bwt-disc {
  display:block; width:100%; box-sizing:border-box; text-align:center;
  cursor:pointer; font-family:inherit; font-weight:800; font-size:0.9rem;
  line-height:1.2; padding:0.65rem; text-decoration:none;
  border:3px solid #000; border-radius:12px; box-shadow:3px 3px 0 #000;
}
.bwt-next { background:linear-gradient(#ffe14d,#f2c012); color:#241c00; }
.bwt-back { background:#182a16; color:#fffdf5; margin-top:0.6rem; }
/* the Discord door wears Discord's own blurple, white mark beside the words */
.bwt-disc { background:#5865f2; color:#fff; margin-top:0.6rem; }
.bwt-disc svg { vertical-align:-3px; margin-right:4px; }
.bwt-next:active, .bwt-back:active, .bwt-disc:active {
  transform:translate(2px,2px); box-shadow:1px 1px 0 #000;
}
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
// the Discord mark (Clyde), white via currentColor on the blurple button
const DISCORD_SVG = '<svg viewBox="0 0 127.14 96.36" width="19" height="14.4" fill="currentColor" aria-hidden="true">'
  + '<path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg>';

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
        + '<span class="bwt-coin"><img src="/assets/banana-stand/coin.png" alt=""> 128</span>'
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
        + '<span class="bwt-pill"><img src="/assets/banana-stand/coin.png" alt=""> paid in bananacoins — earned by playing</span>'
        + '</div>',
    },
    {
      t: '',
      s: '',
      // the sticker announces what just happened — "always growing" was the
      // step's old TITLE and read as nonsense on its own (Trym: what is
      // always growing?)
      h: '<div class="bwt-og"><i class="bwt-ogpill">population +1</i>'
        + '<div class="bwt-og__win">'
        + '<canvas class="bwt-og__bg" width="840" height="640"></canvas>'
        + '<h3>welcome home,<br>banana</h3>'
        + '<canvas class="bwt-og__me" width="300" height="300"></canvas>'
        + '<small>trymstene.com</small>'
        + '</div></div>'
        + '<p class="bwt-sub" style="margin:0.7rem 0 0; text-align:center">'
        + 'Nib is waiting outside with your first quest — and new things land every week. '
        + 'The Discord hears about them first.</p>'
        + '<a class="bwt-disc" href="' + DISCORD + '" target="_blank" rel="noopener">' + DISCORD_SVG + ' join the Discord ↗</a>',
      og: true,
      last: true,
    },
  ];
}

// 🌅 THE FINALE SCENE — the share cards' graphic language on the tour's last
// card: a glowing sun with ray stripes spreading to the sides, a scalloped
// lawn with flowers, a kite, a beach ball, the fountain — and the park's
// REAL critter strips strolling through (frame-cycled by `tick`).
function drawFinale(cv, imgs, tick) {
  const c = cv.getContext('2d');
  c.setTransform(2, 0, 0, 2, 0, 0);
  const W = 420, H = 320;
  // banana-yellow sky, warm toward the sun
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#ffe856'); sky.addColorStop(1, '#ffd21f');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  // ray stripes fanning out of the sun across the whole field
  const SX = W / 2, SY = 58;
  c.fillStyle = 'rgba(255,247,175,0.5)';
  for (let i = 0; i < 12; i++) {
    c.save();
    c.translate(SX, SY);
    c.rotate((i / 12) * Math.PI * 2 + 0.13);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(560, -32); c.lineTo(560, 32);
    c.closePath(); c.fill();
    c.restore();
  }
  // the sun itself, glowing — it halos the title sitting over it
  const glow = c.createRadialGradient(SX, SY, 6, SX, SY, 120);
  glow.addColorStop(0, 'rgba(255,255,235,0.95)');
  glow.addColorStop(0.35, 'rgba(255,248,190,0.55)');
  glow.addColorStop(1, 'rgba(255,248,190,0)');
  c.fillStyle = glow; c.fillRect(SX - 120, SY - 120, 240, 240);
  c.fillStyle = '#fff6b8'; c.beginPath(); c.arc(SX, SY, 34, 0, 7); c.fill();
  c.fillStyle = '#fffdf0'; c.beginPath(); c.arc(SX, SY, 24, 0, 7); c.fill();
  // a kite up in the rays, string trailing to the lawn
  c.save();
  c.translate(64, 92 + (tick % 4 < 2 ? 0 : 2));
  c.rotate(-0.3);
  c.fillStyle = '#ff5c7a';
  c.beginPath(); c.moveTo(0, -16); c.lineTo(11, 0); c.lineTo(0, 16); c.lineTo(-11, 0);
  c.closePath(); c.fill();
  c.strokeStyle = '#1a1408'; c.lineWidth = 1.5; c.stroke();
  c.beginPath(); c.moveTo(0, -16); c.lineTo(0, 16); c.moveTo(-11, 0); c.lineTo(11, 0); c.stroke();
  c.restore();
  c.strokeStyle = 'rgba(26,20,8,0.5)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(60, 106); c.quadraticCurveTo(40, 180, 66, 250); c.stroke();
  // the lawn, scalloped like the treeline trick
  c.fillStyle = '#8fbe58';
  c.beginPath();
  c.moveTo(0, H); c.lineTo(0, 246);
  for (let x = 0; x <= W; x += 42) c.quadraticCurveTo(x + 21, 228, x + 42, 246);
  c.lineTo(W, H); c.closePath(); c.fill();
  const shade = c.createLinearGradient(0, 246, 0, H);
  shade.addColorStop(0, 'rgba(20,70,20,0)'); shade.addColorStop(1, 'rgba(20,70,20,0.28)');
  c.fillStyle = shade; c.fillRect(0, 240, W, H - 240);
  // little pixel flowers in the grass
  [[38, 268, '#fffdf5'], [128, 296, '#ffd6e8'], [212, 268, '#fffdf5'],
    [258, 306, '#ffd6e8'], [382, 292, '#fffdf5'], [172, 310, '#ffe135']].forEach(([fx, fy, col]) => {
    c.fillStyle = '#2c6b2c'; c.fillRect(fx + 2, fy + 4, 3, 8);
    c.fillStyle = col;
    c.fillRect(fx - 4, fy, 5, 5); c.fillRect(fx + 4, fy, 5, 5);
    c.fillRect(fx, fy - 4, 5, 5); c.fillRect(fx, fy + 4, 5, 5);
    c.fillStyle = '#fff3a0'; c.fillRect(fx + 1, fy + 1, 3, 3);
  });
  // the fountain, mid-lawn right — the park-postcard silhouette, small
  const fx = 356, fy = 292, k = 0.55;
  c.fillStyle = '#33735c'; c.fillRect(fx - 52 * k, fy - 14 * k, 104 * k, 14 * k);
  c.fillStyle = '#7fb98f'; c.fillRect(fx - 52 * k, fy - 20 * k, 104 * k, 6 * k);
  c.fillStyle = '#33735c'; c.fillRect(fx - 7 * k, fy - 52 * k, 14 * k, 38 * k);
  c.fillStyle = '#7fb98f'; c.fillRect(fx - 22 * k, fy - 58 * k, 44 * k, 8 * k);
  c.strokeStyle = 'rgba(200,236,255,0.9)'; c.lineWidth = 5 * k; c.lineCap = 'round';
  c.beginPath(); c.moveTo(fx, fy - 58 * k);
  c.quadraticCurveTo(fx - 30 * k, fy - 96 * k, fx - 40 * k, fy - 26 * k); c.stroke();
  c.beginPath(); c.moveTo(fx, fy - 58 * k);
  c.quadraticCurveTo(fx + 30 * k, fy - 96 * k, fx + 40 * k, fy - 26 * k); c.stroke();
  // a beach ball rolled up from the bay (right of the site tag's corner)
  c.save();
  c.translate(150, 302); c.rotate((tick % 8) * 0.1);
  ['#ff5c7a', '#fffdf5', '#78c8ff', '#ffe135'].forEach((col, q) => {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 13, q * Math.PI / 2, (q + 1) * Math.PI / 2);
    c.closePath(); c.fill();
  });
  c.strokeStyle = '#1a1408'; c.lineWidth = 2;
  c.beginPath(); c.arc(0, 0, 13, 0, 7); c.stroke();
  c.restore();
  // the park's real critters strolling through, hearts bobbing overhead
  const crit = (img, x, y, kk, flip) => {
    if (!img || !img.naturalWidth) return;
    const fw = Math.floor(img.width / 6), fh = img.height;
    c.save();
    c.imageSmoothingEnabled = false;
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    c.drawImage(img, (tick % 6) * fw, 0, fw, fh, -fw * kk / 2, -fh * kk, fw * kk, fh * kk);
    c.restore();
    const hy = y - fh * kk - 9 - (tick % 2 ? 1 : 0);
    c.fillStyle = '#ff5c7a';
    c.fillRect(x - 5, hy, 4, 4); c.fillRect(x + 1, hy, 4, 4);
    c.fillRect(x - 4, hy + 3, 8, 3); c.fillRect(x - 3, hy + 6, 6, 2); c.fillRect(x - 1, hy + 8, 2, 2);
  };
  crit(imgs.c1, 96, 262, 1.1);
  crit(imgs.c2, 344, 252, 1.0, true);
  crit(imgs.rb, 296, 306, 0.9, true);
}

let styled = false;

/**
 * @param paint    (canvas) => void — draws the CURRENT dance frame of the
 *                 player's banana; the wizard calls it on a beat so the
 *                 welcome banana actually dances
 * @param paintUp  (canvas) => void — draws the banana in the HANDS-UP pose
 *                 (the share cards' frame 2) at the canvas's full size; the
 *                 finale's close-up uses it, falling back to paint
 * @param track    analytics fn
 * @param force    show even if already seen (the ?bwtour replay)
 */
export function initWorldTutorial({ paint, paintUp, track, force } = {}) {
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
    // 🌅 the finale scene: hands-up banana close-up + the drawn sun-and-lawn
    // card with the park's critter strips walking on a beat
    if (st.og) {
      const bg = el('.bwt-og__bg');
      const me = el('.bwt-og__me');
      try { (paintUp || paint) && (paintUp || paint)(me); } catch (e) {}
      const imgs = {};
      let tick = 0;
      [['c1', '/assets/park/a-chicken1.png'], ['c2', '/assets/park/a-chicken2.png'],
        ['rb', '/assets/park/a-rabbit.png']].forEach(([k, src]) => {
        const im = new Image();
        im.onload = () => { if (bg.isConnected) drawFinale(bg, imgs, tick); };
        im.src = src;
        imgs[k] = im;
      });
      drawFinale(bg, imgs, 0);
      if (!RM) {
        heroTimer = setInterval(() => {
          if (!bg.isConnected) { clearInterval(heroTimer); return; }
          tick++;
          drawFinale(bg, imgs, tick);
        }, 260);
      }
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
export function initTutorialInvite({ mount, paint, paintUp, track } = {}) {
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
  // ⏱ LAST IN THE QUEUE (14 Aug): at 1.6s this landed on top of the cookie
  // banner, the control hint and the quest chip all at once — four prompts in
  // the first two seconds, so an ad arrival read none of them (4 of 168 shown
  // ever opened it). It now waits out the arrival and offers itself once the
  // player has had a moment: consent → walk → quest → THEN the tour.
  setTimeout(() => { if (b.isConnected) b.classList.add('is-on'); }, 22000);
  if (track) track('bwtour_invite');

  b.querySelector('.bwt-invite__go').addEventListener('click', () => {
    b.remove();
    initWorldTutorial({ paint, paintUp, track, force: true });
  });
  b.querySelector('.bwt-invite__x').addEventListener('click', () => {
    try { localStorage.setItem(INV_KEY, '1'); } catch (e) {}
    b.classList.remove('is-on');
    setTimeout(() => b.remove(), 350);
    if (track) track('bwtour_invite_no');
  });
  return { el: b };
}
