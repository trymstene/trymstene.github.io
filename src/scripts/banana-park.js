// 🌳 THE PARK — Park 2.0 P2: the beach engine's chassis on the park scene
// (park-2-plan). Walkable world, both-axis camera, doors to the rave (south)
// and the bay (east), World HUD, presence room. Activities land in P3.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { passStat, passGet } from '../lib/banana-pass.js';
import { levelFor } from '../lib/pass-defs.js';
import { presenceRoom, poofInto } from '../lib/world.js';
import { catCustom, loadCatalog, fullOutfit } from '../lib/drops.js';
// generated geometry — tools/build-park-scene.py declares every collider on
// the place() call that draws its prop. Never hand-copy a coordinate here.
import {
  WORLD, BOUND, PLAZA, POND, FOUNTAIN, MARKET, MEADOW, SWINGS, DOORS,
  OB_RECTS, OB_CIRCLES, OVERLAYS,
} from './park-geo.js';

// ⚠️ init() is CALLED AT THE BOTTOM of this file — module consts first,
// entry point last (the TDZ trap that once killed the rave floor).
const view = document.getElementById('pkView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// ?parktest = the QA hook (same family as ?beachtest / ?cointest): all five
// P3 features force-spawn near the plaza spawn, timers ignored.
const PARK_TEST = typeof location !== 'undefined' && /[?&]parktest(?:=|&|$)/.test(location.search);

const R = (x, y, w, h, f) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"/>';
const SVG = (vb, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vb + '" shape-rendering="crispEdges">' + body + '</svg>';

// 🌰 the acorn — cap, warm body, inner shadow (banana-density pixel style)
const ACORN_SVG = SVG('11 13',
  R(4, 0, 3, 1, '#4a3018') + R(2, 1, 7, 1, '#6b4320') + R(1, 2, 9, 2, '#8a5a2b')
  + R(2, 2, 3, 1, '#a8742a') + R(2, 4, 7, 1, '#e0a84e') + R(1, 5, 9, 4, '#c9913a')
  + R(3, 5, 2, 3, '#e8b866') + R(2, 9, 7, 2, '#a8742a') + R(3, 11, 5, 1, '#8a5a2b')
  + R(5, 12, 1, 1, '#6b4320'));

// 🦋 the meadow's six — palette IS the species. The Gardener + the full
// 20-species atlas are a later pass; this array is built to grow.
const BFLY = [
  { id: 'skipper', name: 'Lemon Skipper', a: '#ffe135', b: '#c99a1e' },
  { id: 'meadowblue', name: 'Meadow Blue', a: '#7db9ff', b: '#3a6fd6' },
  { id: 'monarch', name: 'Ember Monarch', a: '#ff9d3a', b: '#c2571a' },
  { id: 'snowcap', name: 'Snowcap White', a: '#f5f2e8', b: '#b8bcd0' },
  { id: 'duskwing', name: 'Plum Duskwing', a: '#b48ae0', b: '#6b3fa0' },
  { id: 'glasswing', name: 'Leaf Glasswing', a: '#9fe08d', b: '#4d9e4a' },
];
// two frames as .f1/.f2 groups — CSS steps() them, the poof pattern
const bflySvg = (a, b) => SVG('10 8',
  '<g class="f1">'
  + R(0, 0, 3, 3, a) + R(1, 3, 2, 2, b) + R(1, 1, 1, 1, b)
  + R(7, 0, 3, 3, a) + R(7, 3, 2, 2, b) + R(8, 1, 1, 1, b)
  + R(3, 0, 1, 1, '#3a2b18') + R(6, 0, 1, 1, '#3a2b18') + R(4, 1, 2, 5, '#3a2b18')
  + '</g><g class="f2">'
  + R(2, 0, 2, 4, a) + R(2, 3, 2, 1, b) + R(6, 0, 2, 4, a) + R(6, 3, 2, 1, b)
  + R(4, 1, 2, 5, '#3a2b18')
  + '</g>');

// 🐿 two frames, alternate legs
const SQ_SVG = SVG('14 10',
  '<g class="f1">'
  + R(0, 1, 3, 5, '#6b4320') + R(1, 0, 2, 2, '#6b4320') + R(3, 3, 7, 4, '#8a5a2b')
  + R(9, 2, 3, 3, '#8a5a2b') + R(10, 1, 1, 1, '#6b4320') + R(11, 3, 1, 1, '#1c120a')
  + R(5, 6, 4, 1, '#c9a15a') + R(4, 7, 1, 2, '#6b4320') + R(8, 7, 1, 2, '#6b4320')
  + '</g><g class="f2">'
  + R(0, 1, 3, 5, '#6b4320') + R(1, 0, 2, 2, '#6b4320') + R(3, 3, 7, 4, '#8a5a2b')
  + R(9, 2, 3, 3, '#8a5a2b') + R(10, 1, 1, 1, '#6b4320') + R(11, 3, 1, 1, '#1c120a')
  + R(5, 6, 4, 1, '#c9a15a') + R(3, 7, 2, 1, '#6b4320') + R(9, 7, 2, 1, '#6b4320')
  + '</g>');

// 🌰 ground near the tree clumps + stumps — jittered + blocked()-tested on spawn
const ACORN_SPOTS = [[300, 650], [1040, 300], [1215, 985], [1650, 265], [2480, 985],
  [900, 530], [1005, 345], [878, 572], [735, 1000], [2555, 330], [400, 558]];
const TEST_ACORN_SPOTS = [[1300, 860], [1450, 870], [1360, 910]];

// 🧃 THE MERCH CART — keys are the PDP slugs (/make-a-banana/<key>/, from
// shared/products.js); prices are display hints, Shopify enforces the real one
const MERCH_PRODUCTS = [
  { key: 'sticker', name: 'die-cut sticker', price: '$14.99' },
  { key: 'magnet', name: 'fridge magnet', price: '$16.99' },
  { key: 'tee', name: 'tee', price: '$34.99' },
];

const WISHES = [
  'you wish for a sunny day. granted — look around.',
  'you wish the rave never closes. it never has.',
  'you wish for the giant plush. the claw machine heard that.',
  'you wish for more acorns. the trees will see what they can do.',
  'you wish somebody walks up the road right now. keep watching it.',
  'you keep this one to yourself. the fountain understands.',
];

function init() {
  const W = WORLD.w, H = WORLD.h;
  // the most art px we ever show on each axis (see the beach's layout() notes)
  const VIEW_ART_W = 900, VIEW_ART_V = 760;
  const PLAZA_FIT = 520;   // the plaza (500 wide) must always fit across
  const world = document.getElementById('pkWorld');
  const meEl = document.getElementById('pkMe');
  const meCtx = document.getElementById('pkMeCv').getContext('2d');
  const cutEl = document.getElementById('pkCut');
  const hintEl = document.getElementById('pkHint');
  const exitEl = document.getElementById('pkExitStrip');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let myOutfit = { hat: 'none', glasses: 'none', extras: {} };
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o) myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {}, c: o.c };
  } catch (e) {}
  const ME_DRAW = { ...myOutfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
  // a caught community item lives in outfit.c — never-cache-a-miss redraw
  loadCatalog().then(() => { try { lastF = -1; drawMe(); peers.forEach((p) => drawPeer(p, true)); } catch (e) {} });

  const pct = (v, span) => (v / span * 100) + '%';

  // ---- camera: pans BOTH axes, the banana leads ---------------------------
  let scale = 1, viewW = 0, viewH = 0, camX = 0, camY = 0;
  function layout() {
    const r = view.getBoundingClientRect();
    viewW = r.width; viewH = r.height;
    const want = Math.max(viewW / VIEW_ART_W, viewH / VIEW_ART_V);
    const fill = Math.max(viewW / W, viewH / H);
    const maxIn = viewW / PLAZA_FIT;
    scale = Math.min(1.7, maxIn, Math.max(0.55, fill, want));
    world.style.width = (W * scale) + 'px';
    world.style.height = (H * scale) + 'px';
  }
  addEventListener('resize', layout);
  layout();
  function camTarget() {
    return {
      x: Math.max(0, Math.min(Math.max(0, W * scale - viewW), pos.x * scale - viewW / 2)),
      y: Math.max(0, Math.min(Math.max(0, H * scale - viewH), pos.y * scale - viewH * 0.58)),
    };
  }
  let camWX = NaN, camWY = NaN;   // change-guard: write only when moved
  function cam() {
    const t = camTarget();
    camX += (t.x - camX) * 0.12;
    camY += (t.y - camY) * 0.12;
    if (Math.abs(t.x - camX) < 0.2) camX = t.x;
    if (Math.abs(t.y - camY) < 0.2) camY = t.y;
    if (camX === camWX && camY === camWY) return;
    camWX = camX; camWY = camY;
    world.style.transform = 'translate(' + (-camX) + 'px,' + (-camY) + 'px)';
  }

  // ⭐ one painter's algorithm for the whole park: z from the ground line
  const depth = (el, y) => { el.style.zIndex = String(100 + Math.round(y)); };

  // the props, redrawn above the plate so they can occlude walkers
  OVERLAYS.forEach((o) => {
    const d = document.createElement('div');
    d.className = 'pk-ov';
    d.style.left = pct(o[1], W); d.style.top = pct(o[2], H);
    d.style.width = pct(o[3], W); d.style.height = pct(o[4], H);
    d.style.backgroundImage = "url('/assets/park/" + o[0] + "')";
    d.style.zIndex = String(100 + Math.round(o[5]));
    world.appendChild(d);
  });

  // ⛲ the fountain — the pack's 6-frame strip, CSS-stepped like the bonfire
  (() => {
    const [fx, fy, fw, fh] = FOUNTAIN;
    const f = document.createElement('div');
    f.className = 'pk-fountain';
    f.style.left = pct(fx, W); f.style.top = pct(fy, H);
    f.style.width = pct(fw, W); f.style.height = pct(fh, H);
    f.style.zIndex = String(100 + fy);
    world.appendChild(f);
  })();

  // 🛝 THE RIDES — SWINGS[0..1] are the swing (12 frames), [2..3] the spring
  // riders (8 frames). Each entry anchors bottom-centre at (x, y), 72×72 —
  // frame 0 of the strip IS the baked pose, so the animated overlay lands
  // pixel-exact over the plate and only shows while somebody's on it.
  const RIDES = SWINGS.map((s, i) => ({
    x: s[0], y: s[1], w: s[2], h: s[3],
    strip: i < 2 ? 'a-swing.png' : 'a-spring.png', n: i < 2 ? 12 : 8,
  }));
  RIDES.forEach((q) => {
    const el = document.createElement('div');
    el.className = 'pk-ride pk-ride--' + q.n;
    el.style.left = pct(q.x - q.w / 2, W); el.style.top = pct(q.y - q.h, H);
    el.style.width = pct(q.w, W); el.style.height = pct(q.h, H);
    el.style.backgroundImage = "url('/assets/park/" + q.strip + "')";
    el.style.zIndex = String(100 + q.y);
    world.appendChild(el);
    q.el = el;
  });
  let riding = null, pendingRide = null;
  function mountRide(q) {
    riding = q;
    q.el.classList.add('is-on');
    meEl.style.display = 'none';   // locally only — peers still get your pos
    tgt.x = pos.x; tgt.y = pos.y;
  }
  function dismount() {
    if (!riding) return;
    riding.el.classList.remove('is-on');
    riding = null;
    meEl.style.display = '';
    meWX = NaN;                    // force a position rewrite next frame
  }
  function tapRide(wx, wy) {
    const q = RIDES.find((r2) => Math.abs(wx - r2.x) < 40 && wy > r2.y - r2.h - 8 && wy < r2.y + 10);
    if (!q) return false;
    const sx = q.x, sy = q.y + 24;     // +24 clears the spring bases' colliders
    if (Math.hypot(pos.x - sx, pos.y - sy) < 30) {
      pos.x = sx; pos.y = sy; meWX = NaN;
      mountRide(q);
    } else {
      tgt.x = sx; tgt.y = sy;
      pendingRide = { q, x: sx, y: sy };
    }
    return true;
  }

  // ---- geometry -----------------------------------------------------------
  const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  // the BOUND inset is the wall, except the two door corridors through it
  const inSouthDoorLane = (x, y) => Math.abs(x - DOORS.south.x) < 60 && y > H - BOUND && y < H - 14;
  const inEastDoorLane = (x, y) => Math.abs(y - DOORS.east.y) < 60 && x > W - BOUND && x < W - 14;
  function blocked(x, y) {
    if (x < BOUND || x > W - BOUND || y < BOUND || y > H - BOUND) {
      if (!inSouthDoorLane(x, y) && !inEastDoorLane(x, y)) return true;
    }
    for (const r of OB_RECTS) if (inRect(x, y, r)) return true;
    for (const c of OB_CIRCLES) if (Math.hypot(x - c[0], y - c[1]) < c[2]) return true;
    const px = (x - POND.x) / POND.rx, py = (y - POND.y) / POND.ry;
    if (px * px + py * py < 1) return true;   // bananas famously can't swim
    return false;
  }

  // ---- spawn: arrive through the door you came in by ----------------------
  const fromBeach = /[?&]beach(?:=|&|$)/.test(location.search);
  const fromRave = /[?&]rave(?:=|&|$)/.test(location.search);
  const pos = fromBeach ? { x: 2610, y: DOORS.east.y }
    : fromRave ? { x: DOORS.south.x, y: 1008 }
      : { x: 1380, y: 820 };                       // the plaza's south edge
  const tgt = fromBeach ? { x: 2480, y: DOORS.east.y }
    : fromRave ? { x: DOORS.south.x, y: 900 }
      : { x: 1380, y: 740 };
  let meWX = NaN, meWY = NaN;   // change-guard
  const c0 = camTarget(); camX = c0.x; camY = c0.y;
  track('park_join', { via: fromBeach ? 'beach' : fromRave ? 'rave' : 'direct' });

  // ---- walking ------------------------------------------------------------
  const SPEED = 168;
  const keys = {};
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      keys[k] = true; e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  view.addEventListener('click', (e) => {
    if (e.target.closest('.pk-whud') || e.target.closest('.pk-actions') || e.target.closest('.pk-panel')) return;
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    hint(false);
    pendingRide = null;
    if (riding) dismount();          // any tap off the ride hops you off
    if (tapBfly(wx, wy)) return;
    if (tapRide(wx, wy)) return;
    tgt.x = wx;
    tgt.y = wy;
  });

  // ---- 🚪 the doors: hysteresis, never an instant teleport ----------------
  // Arm only once you've been properly INSIDE the park (clear of both doors),
  // so arriving through a door can't bounce you straight back out. In the
  // zone the confirm strip names where the road goes; walking on to the door
  // itself is the yes — the cut runs, then the nav.
  const DOOR_DEFS = [
    { x: DOORS.south.x, y: DOORS.south.y, href: '/rave/', label: 'keep walking ↓ back to the rave' },
    { x: DOORS.east.x, y: DOORS.east.y, href: '/beach/?park', label: 'keep walking → to Banana Bay' },
  ];
  const DOOR_ZONE = 130, DOOR_GO = 36, DOOR_ARM = 180;
  let doorArmed = false, leaving = false, stripOn = -1;
  function exitTo(href) {
    if (leaving) return;
    leaving = true;
    try { parkRoom.leave(); } catch (e) {}   // poof for everyone the instant you go
    if (REDUCED) { location.href = href; return; }
    cutEl.classList.add('is-on');
    setTimeout(() => { location.href = href; }, 170);
  }
  function doorTick() {
    let nearest = -1, nd = Infinity;
    DOOR_DEFS.forEach((d, i) => {
      const dist = Math.hypot(pos.x - d.x, pos.y - d.y);
      if (dist < nd) { nd = dist; nearest = i; }
    });
    if (!doorArmed) { if (nd > DOOR_ARM) doorArmed = true; return; }
    if (nd < DOOR_GO) { exitTo(DOOR_DEFS[nearest].href); return; }
    const want = nd < DOOR_ZONE ? nearest : -1;
    if (want !== stripOn) {
      stripOn = want;
      if (want < 0) exitEl.classList.remove('is-on');
      else { exitEl.textContent = DOOR_DEFS[want].label; exitEl.classList.add('is-on'); }
    }
  }

  function float(x, y, text) {
    const d = document.createElement('div');
    d.className = 'pk-float';
    d.textContent = text;
    d.style.left = pct(x, W);
    d.style.top = pct(y, H);
    world.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  // the big-moment toast — one element, one timer that only toggles a class
  const toastEl = document.getElementById('pkToast');
  let toastTimer = null;
  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms || 2400);
  }

  // ---- 🌰 ACORNS: the park's shells — a calm XP trickle -------------------
  // Walk-over pickup, +2 rep (the same world stat the shells/floor feed).
  // All clocks ride the rAF step loop, so a hidden tab spawns nothing.
  const acorns = [];
  const ACORN_MAX = 3;
  let acornNextAt = 0, acornTracked = false;
  function acornSpawn(spots) {
    if (acorns.length >= ACORN_MAX) return;
    const list = spots || ACORN_SPOTS;
    for (let t = 0; t < 14; t++) {
      const s = list[Math.floor(Math.random() * list.length)];
      const x = s[0] + (Math.random() * 32 - 16), y = s[1] + (Math.random() * 24 - 12);
      if (blocked(x, y)) continue;
      if (acorns.some((a) => Math.hypot(a.x - x, a.y - y) < 60)) continue;
      const el = document.createElement('div');
      el.className = 'pk-acorn';
      el.innerHTML = ACORN_SVG;
      el.style.left = pct(x, W);
      el.style.top = pct(y, H);
      world.appendChild(el);
      acorns.push({ el, x, y });
      return;
    }
  }
  function acornTick(now) {
    if (now > acornNextAt) {
      acornNextAt = now + 25000 + Math.random() * 15000;
      acornSpawn(PARK_TEST ? TEST_ACORN_SPOTS : null);
    }
    for (let i = acorns.length - 1; i >= 0; i--) {
      const a = acorns[i];
      if (Math.hypot(pos.x - a.x, (pos.y - 6) - a.y) < 34) {
        a.el.remove();
        acorns.splice(i, 1);
        passStat('rep', 2);
        refreshHud();               // the XP lands on the LEVEL bar right away
        float(a.x, a.y - 12, '+2');
        if (!acornTracked) { acornTracked = true; track('park_acorn'); }
      }
    }
  }
  acornSpawn(PARK_TEST ? TEST_ACORN_SPOTS : null);
  if (PARK_TEST) { acornSpawn(TEST_ACORN_SPOTS); acornSpawn(TEST_ACORN_SPOTS); }

  // ---- 🦋 BUTTERFLIES + THE MEADOW (collection v1, keeper comes later) ----
  // Three flit over the meadow, one wanders the park. Rush one and it darts
  // off; walk up slowly (a tap near it stops you short) and tap it up close.
  const bflyCol = () => { try { return JSON.parse(localStorage.getItem('pk_bfly') || '{}'); } catch (e) { return {}; } };
  const bflyHave = () => { const c = bflyCol(); return BFLY.filter((s) => c[s.id] > 0).length; };
  const M_AREA = { x0: MEADOW[0] + 40, y0: MEADOW[1] + 30, x1: MEADOW[2] - 40, y1: MEADOW[3] - 30 };
  const ALL_AREA = PARK_TEST
    ? { x0: 1240, y0: 740, x1: 1520, y1: 900 }
    : { x0: BOUND + 60, y0: BOUND + 60, x1: W - BOUND - 60, y1: H - BOUND - 60 };
  const bflys = [{ area: M_AREA }, { area: M_AREA }, { area: M_AREA }, { area: ALL_AREA }];
  function bflyAim(b) {
    b.tx = b.area.x0 + Math.random() * (b.area.x1 - b.area.x0);
    b.ty = b.area.y0 + Math.random() * (b.area.y1 - b.area.y0);
    b.spd = 45 + Math.random() * 30;
    b.fleeing = false;
  }
  function bflySpawn(b) {
    b.sp = BFLY[Math.floor(Math.random() * BFLY.length)];
    const el = document.createElement('div');
    el.className = 'pk-bfly';
    el.innerHTML = bflySvg(b.sp.a, b.sp.b);
    el.style.zIndex = '1500';
    world.appendChild(el);
    b.el = el;
    b.gone = false;
    b.phase = Math.random() * 6.28;
    b.x = b.area.x0 + Math.random() * (b.area.x1 - b.area.x0);
    b.y = b.area.y0 + Math.random() * (b.area.y1 - b.area.y0);
    b.perchUntil = 0;
    b.dir = 1;
    bflyAim(b);
  }
  bflys.forEach(bflySpawn);
  function bflyTick(dt, now) {
    for (const b of bflys) {
      if (b.gone) { if (now > b.respawnAt) bflySpawn(b); continue; }
      const pd = Math.hypot(pos.x - b.x, pos.y - b.y);
      // barrelled at → it's off, well out of reach
      if (pd < 85 && pSpeed > 115 && !b.fleeing) {
        const ang = Math.atan2(b.y - pos.y, b.x - pos.x);
        b.tx = Math.max(b.area.x0, Math.min(b.area.x1, b.x + Math.cos(ang) * 190));
        b.ty = Math.max(b.area.y0, Math.min(b.area.y1, b.y + Math.sin(ang) * 130));
        b.spd = 175;
        b.fleeing = true;
        b.perchUntil = 0;
      }
      if (b.perchUntil > now) { /* settled — still flapping */ }
      else {
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 4) { b.perchUntil = now + 800 + Math.random() * 2600; bflyAim(b); }
        else {
          const m = Math.min(d, b.spd * dt);
          b.x += (dx / d) * m;
          b.y += (dy / d) * m;
          if (Math.abs(dx) > 4) b.dir = dx < 0 ? -1 : 1;
        }
      }
      const bob = Math.sin(now / 300 + b.phase) * 4;
      b.el.style.left = pct(b.x, W);
      b.el.style.top = pct(b.y - 26 + bob, H);
      b.el.style.transform = 'translate(-50%,-50%)' + (b.dir < 0 ? ' scaleX(-1)' : '');
    }
  }
  function catchBfly(b) {
    const sp = b.sp;
    const col = bflyCol();
    col[sp.id] = (col[sp.id] || 0) + 1;
    try { localStorage.setItem('pk_bfly', JSON.stringify(col)); } catch (e) {}
    b.el.remove();
    b.gone = true;
    b.respawnAt = performance.now() + 20000 + Math.random() * 15000;
    float(b.x, b.y - 34, '🦋');
    toast('🦋 ' + sp.name + ' caught!');
    refreshBflyHud();
  }
  function tapBfly(wx, wy) {
    const b = bflys.find((q) => !q.gone && Math.hypot(wx - q.x, wy - (q.y - 26)) < 46);
    if (!b) return false;
    if (Math.hypot(pos.x - b.x, pos.y - b.y) < 78) { catchBfly(b); return true; }
    // approach: stop SHORT of it, so the last steps are yours to take slowly
    const d = Math.hypot(b.x - pos.x, b.y - pos.y) || 1;
    tgt.x = b.x - ((b.x - pos.x) / d) * 55;
    tgt.y = b.y - ((b.y - pos.y) / d) * 55;
    return true;
  }
  // the HUD pill + the atlas popup
  const bflyBtn = document.getElementById('pkBflyBtn');
  const bflyNEl = document.getElementById('pkBflyN');
  const atlasPanel = document.getElementById('pkAtlas');
  const atlasGrid = document.getElementById('pkAtlasGrid');
  const atlasSub = document.getElementById('pkAtlasSub');
  function refreshBflyHud() {
    const n = bflyHave();
    bflyBtn.classList.toggle('is-dim', n === 0);
    bflyNEl.textContent = n ? n + '/' + BFLY.length : '—';
  }
  function openAtlas() {
    const col = bflyCol();
    atlasGrid.innerHTML = BFLY.map((s) => {
      const n = col[s.id] || 0;
      return '<div class="pk-bslot' + (n ? '' : ' is-missing')
        + '" aria-label="' + (n ? s.name : 'not caught yet') + '">'
        + bflySvg(s.a, s.b) + '<span>' + (n ? s.name : '???') + '</span>'
        + (n > 1 ? '<b>' + n + '</b>' : '') + '</div>';
    }).join('');
    atlasSub.innerHTML = '🦋 <b>' + bflyHave() + '</b> of ' + BFLY.length
      + ' kinds caught · walk up slowly, then tap';
    atlasPanel.hidden = false;
  }
  bflyBtn.addEventListener('click', openAtlas);
  document.getElementById('pkAtlasClose').addEventListener('click', () => { atlasPanel.hidden = true; });
  atlasPanel.addEventListener('click', (e) => { if (e.target === atlasPanel) atlasPanel.hidden = true; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !atlasPanel.hidden) atlasPanel.hidden = true; });
  refreshBflyHud();

  // ---- 🐿 SQUIRRELS: locals, never interactive ----------------------------
  // The crab pattern: a home they orbit, darts with long stillnesses, a bolt
  // when you get close — and they never set foot on the plaza.
  const inPlaza = (x, y) => {
    const ex = (x - PLAZA.x) / PLAZA.rx, ey = (y - PLAZA.y) / PLAZA.ry;
    return ex * ex + ey * ey < 1;
  };
  const SQ_HOMES = PARK_TEST ? [[1500, 880], [1180, 970]] : [[300, 640], [1180, 970]];
  const squirrels = [];
  SQ_HOMES.forEach(([hx, hy]) => {
    const el = document.createElement('div');
    el.className = 'pk-squirrel is-still';
    el.innerHTML = SQ_SVG;
    el.style.left = pct(hx, W);
    el.style.top = pct(hy, H);
    world.appendChild(el);
    squirrels.push({ el, hx, hy, x: hx, y: hy, tx: hx, ty: hy,
      wait: Math.random() * 3, flee: 0, face: 1, still: true });
  });
  function sqPick(s) {
    const a = Math.random() * Math.PI * 2;
    const r2 = 50 + Math.random() * 90;
    let tx = s.x + Math.cos(a) * r2, ty = s.y + Math.sin(a) * r2 * 0.6;
    if (Math.hypot(tx - s.hx, ty - s.hy) > 140) { tx = s.hx; ty = s.hy; }
    if (!blocked(tx, ty) && !inPlaza(tx, ty)) { s.tx = tx; s.ty = ty; }
  }
  function sqStep(s, dt) {
    const fear = Math.hypot(pos.x - s.x, pos.y - s.y);
    if (fear < 70) {
      const ang = Math.atan2(s.y - pos.y, s.x - pos.x);
      const tx = s.x + Math.cos(ang) * 130, ty = s.y + Math.sin(ang) * 65;
      if (!inPlaza(tx, ty)) { s.tx = tx; s.ty = ty; }
      s.flee = 0.9; s.wait = 0;
    }
    s.flee = Math.max(0, s.flee - dt);
    if (s.wait > 0) {
      s.wait -= dt;
      if (!s.still) { s.still = true; s.el.classList.add('is-still'); }
      return;
    }
    const dx = s.tx - s.x, dy = s.ty - s.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) { s.wait = 1.5 + Math.random() * 4; sqPick(s); return; }
    if (s.still) { s.still = false; s.el.classList.remove('is-still'); }
    const sp = (s.flee > 0 ? 170 : 55) * dt;
    const nx = s.x + (dx / d) * Math.min(d, sp);
    const ny = s.y + (dy / d) * Math.min(d, sp);
    if (!blocked(nx, ny) && !inPlaza(nx, ny)) { s.x = nx; s.y = ny; }
    else { s.wait = 0.5; sqPick(s); return; }
    if (Math.abs(dx) > 5) s.face = dx < 0 ? -1 : 1;
    s.el.style.left = pct(s.x, W);
    s.el.style.top = pct(s.y, H);
    s.el.style.transform = 'translate(-50%,-100%)' + (s.face < 0 ? ' scaleX(-1)' : '');
    depth(s.el, s.y);
  }

  // ---- 🪙 THE FOUNTAIN COIN TOSS — an honest tiny sink, no payout ---------
  const TOSS_AT = { x: FOUNTAIN[0], y: FOUNTAIN[1] + 10 };
  const tossBtn = document.getElementById('pkToss');
  let tossShown = false, tossTracked = false, tossBusy = false;
  let wishIdx = Math.floor(Math.random() * WISHES.length);
  function tossTick() {
    const near = Math.hypot(pos.x - TOSS_AT.x, pos.y - TOSS_AT.y) < 120;
    if (near !== tossShown) { tossShown = near; tossBtn.hidden = !near; }
  }
  tossBtn.addEventListener('click', () => {
    if (tossBusy) return;
    if (coinBal() < 1) { toast('no coins — the rave floor drops them'); return; }
    passStat('coins_spent', 1);
    refreshHud();
    if (!tossTracked) { tossTracked = true; track('park_toss'); }
    tossBusy = true;
    const c = document.createElement('div');
    c.className = 'pk-coinfly';
    c.innerHTML = '<img src="/assets/banana-stand/coin.png" width="16" height="16" alt="" />';
    c.style.left = pct(pos.x, W);
    c.style.top = pct(pos.y - 34, H);
    world.appendChild(c);
    const bx = FOUNTAIN[0] + (Math.random() * 36 - 18), by = FOUNTAIN[1] - 32;
    requestAnimationFrame(() => { c.style.left = pct(bx, W); c.style.top = pct(by, H); });
    setTimeout(() => {          // the timer takes its own element with it
      c.remove();
      float(bx, by, '✦');
      toast('🪙 ' + WISHES[wishIdx++ % WISHES.length], 3400);
      tossBusy = false;
    }, 720);
  });

  // ---- 🧃 THE MERCH CART — the one real thing in the park -----------------
  // The builder→merch bridge is dead; the cart IS merch's home now. Cards
  // show YOUR banana; a tap lands on the real PDP with the exact outfit
  // pre-built via the builder's own interchange params (h/g/ex/e — the same
  // string the gallery's merch CTAs ride).
  const CART_AT = { x: MARKET.cart[0], y: MARKET.cart[1] };
  const browseBtn = document.getElementById('pkBrowse');
  const merchPanel = document.getElementById('pkMerch');
  const merchGrid = document.getElementById('pkMerchGrid');
  let browseShown = false, cartViewTracked = false, sparkleAt = 0;
  function merchParams() {
    let o = {};
    try { o = JSON.parse(localStorage.getItem('bb-last') || '{}') || {}; } catch (e) {}
    const p = new URLSearchParams();
    if (o.hat && o.hat !== 'none') p.set('h', o.hat);
    if (o.glasses && o.glasses !== 'none') p.set('g', o.glasses);
    const ex = Object.keys(o.extras || {}).filter((k) => o.extras[k]);
    if (ex.length) p.set('ex', ex.join('.'));
    if (o.effect && o.effect !== 'none') p.set('e', o.effect);
    return p.toString();
  }
  function openMerch() {
    const q = merchParams();
    merchGrid.innerHTML = MERCH_PRODUCTS.map((pr) =>
      '<a class="pk-mcard pk-mcard--' + pr.key + '" href="/make-a-banana/' + pr.key + '/'
      + (q ? '?' + q : '') + '" data-product="' + pr.key + '">'
      + '<span class="pk-mcard__mock"><canvas width="150" height="150" aria-hidden="true"></canvas></span>'
      + '<span class="pk-mcard__txt"><b>' + pr.name + '</b><i>' + pr.price + '</i></span>'
      + '<span class="pk-mcard__go" aria-hidden="true">→</span>'
      + '</a>').join('');
    // your banana on every card — frame 2, the presenting pose
    assetsReady().then(() => {
      merchGrid.querySelectorAll('canvas').forEach((cv) => {
        drawComposite(cv.getContext('2d'), 150, 2,
          { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
      });
    });
    merchGrid.querySelectorAll('.pk-mcard').forEach((a) => {
      a.addEventListener('click', () => { track('stand_cart_click', { product: a.dataset.product }); });
    });
    merchPanel.hidden = false;
    if (!cartViewTracked) { cartViewTracked = true; track('stand_cart_view'); }
  }
  browseBtn.addEventListener('click', openMerch);
  document.getElementById('pkMerchClose').addEventListener('click', () => { merchPanel.hidden = true; });
  merchPanel.addEventListener('click', (e) => { if (e.target === merchPanel) merchPanel.hidden = true; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !merchPanel.hidden) merchPanel.hidden = true; });
  // proximity + the idle ✦ (rides the rAF step, so a hidden tab sparkles nothing)
  function cartTick(now) {
    const near = Math.hypot(pos.x - CART_AT.x, pos.y - CART_AT.y) < 110;
    if (near !== browseShown) { browseShown = near; browseBtn.hidden = !near; }
    if (now > sparkleAt) {
      sparkleAt = now + 6500 + Math.random() * 3000;
      const s = document.createElement('div');
      s.className = 'pk-sparkle';
      s.textContent = '✦';
      s.style.left = pct(CART_AT.x - 45 + Math.random() * 90, W);
      s.style.top = pct(CART_AT.y - 60 - Math.random() * 55, H);
      world.appendChild(s);
      setTimeout(() => s.remove(), 1500);
    }
  }

  // ---- 🌍 THE WORLD HUD — the refined pill strip, park edition ------------
  const lvlNEl = document.getElementById('pkLvlN');
  const lvlFillEl = document.getElementById('pkLvlFill');
  const coinNEl = document.getElementById('pkCoinN');
  const coinBal = () => {
    const s = passGet().stats || {};
    return Math.max(0, (s.coins_earned || 0) - (s.coins_spent || 0));
  };
  function refreshHud() {
    const s = passGet().stats || {};
    if (lvlNEl) {
      const lv = levelFor(s.rep || 0);
      lvlNEl.textContent = 'LVL ' + lv.level;
      if (lvlFillEl) lvlFillEl.style.width = Math.round((lv.into / lv.need) * 100) + '%';
    }
    if (coinNEl) coinNEl.textContent = coinBal();
  }
  refreshHud();
  setInterval(() => { if (!document.hidden) refreshHud(); }, 1000);

  // 🎮 the action bar — React · Sound
  document.getElementById('pkEmote').addEventListener('click', () => {
    float(pos.x, pos.y - 44, '❤️');
  });
  (() => {
    const btn = document.getElementById('pkAudio');
    let on = false;
    btn.addEventListener('click', () => {
      on = !on;
      btn.textContent = on ? '🔊' : '🔇';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  })();

  // ---- the loop -----------------------------------------------------------
  let last = performance.now();
  let pSpeed = 0, prevPX = 0, prevPY = 0;   // smoothed — the butterflies read it
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (kx || ky) {
      tgt.x = pos.x + kx * 30; tgt.y = pos.y + ky * 30;
      hint(false); pendingRide = null;
      if (riding) dismount();
    }
    const dx = tgt.x - pos.x, dy = tgt.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5 && !riding) {
      const m = Math.min(d, SPEED * dt);
      const nx = pos.x + (dx / d) * m, ny = pos.y + (dy / d) * m;
      if (!blocked(nx, ny)) { pos.x = nx; pos.y = ny; }
      else if (!blocked(nx, pos.y)) pos.x = nx;
      else if (!blocked(pos.x, ny)) pos.y = ny;
      else {
        // round obstacles: step perpendicular, whichever side is open
        const p1x = pos.x + (dy / d) * m, p1y = pos.y - (dx / d) * m;
        const p2x = pos.x - (dy / d) * m, p2y = pos.y + (dx / d) * m;
        if (!blocked(p1x, p1y)) { pos.x = p1x; pos.y = p1y; }
        else if (!blocked(p2x, p2y)) { pos.x = p2x; pos.y = p2y; }
        else { tgt.x = pos.x; tgt.y = pos.y; }
      }
      pos.x = Math.max(12, Math.min(W - 12, pos.x));
      pos.y = Math.max(12, Math.min(H - 12, pos.y));
      if (pos.x !== meWX || pos.y !== meWY) {
        meWX = pos.x; meWY = pos.y;
        meEl.style.left = pct(pos.x, W);
        meEl.style.top = pct(pos.y, H);
        depth(meEl, pos.y);
      }
    }
    // walked all the way to a ride you tapped → hop on
    if (pendingRide && Math.hypot(pos.x - pendingRide.x, pos.y - pendingRide.y) < 24) {
      const pr = pendingRide; pendingRide = null;
      pos.x = pr.x; pos.y = pr.y; meWX = NaN;
      mountRide(pr.q);
    }
    const inst = Math.hypot(pos.x - prevPX, pos.y - prevPY) / Math.max(dt, 0.001);
    pSpeed = pSpeed * 0.8 + inst * 0.2;
    prevPX = pos.x; prevPY = pos.y;
    acornTick(now);
    bflyTick(dt, now);
    squirrels.forEach((s) => sqStep(s, dt));
    tossTick();
    cartTick(now);
    doorTick();
    parkSendMove(now);
    cam();
    requestAnimationFrame(step);
  }

  // everyone in Banana World dances on the same wall clock
  const frameNow = () => {
    const cyc = BASE_CYCLE_S * 1000;
    return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES;
  };
  const CV = 150;
  let lastF = -1;
  function drawMe() {
    const f = frameNow();
    if (f === lastF) return;
    lastF = f;
    drawComposite(meCtx, CV, f, { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
  }
  function hint(on) { if (hintEl) hintEl.classList.toggle('is-off', !on); }

  // ---- 🌐 the park is MULTIPLAYER ----------------------------------------
  // The EXISTING ParkRoom DO on worker-rave (/park) — same protocol the old
  // stand page speaks: join, move, outfit, leave. ⚠️ THE WIRE IS IN PERCENT
  // (the DO clamps x 5–95 / y 20–99), so world px convert at this boundary.
  // Fails silently by design: no socket, no crowd, the park still works solo.
  const PARK_WS = 'wss://banana-rave.trymstene.workers.dev/park';
  const peers = new Map();                      // id → { el, ctx, outfit, x, y, lastF }
  const crowdEl = document.getElementById('pkCrowd');
  let myParkId = null, parkSendAt = 0, sawPeer = false;
  const lastSent = { x: -1, y: -1 };
  let parkName = '';
  try { parkName = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}
  const myParkOutfit = () => fullOutfit(ME_DRAW);
  const toPctX = (x) => x / W * 100, toPctY = (y) => y / H * 100;
  const fromPctX = (x) => (Number(x) || 50) / 100 * W, fromPctY = (y) => (Number(y) || 90) / 100 * H;
  function refreshCrowd() {
    if (crowdEl) crowdEl.textContent = peers.size ? String(peers.size + 1) : 'solo';
  }
  function drawPeer(p, force) {
    const f = frameNow();
    if (!force && f === p.lastF) return;
    p.lastF = f;
    drawComposite(p.ctx, CV, f, {
      ...p.outfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
      custom: p.outfit && p.outfit.c ? catCustom(p.outfit.c) : undefined,
    });
  }
  function placePeer(p) {
    p.el.style.left = pct(p.x, W);
    p.el.style.top = pct(p.y, H);
    depth(p.el, p.y);
  }
  function addPeer(d) {
    if (!d || d.id === myParkId || peers.has(d.id)) return;
    if (!sawPeer) { sawPeer = true; track('park_multiplayer'); }
    const el = document.createElement('div');
    el.className = 'pk-peer';
    const cv = document.createElement('canvas');
    cv.width = CV; cv.height = CV;
    el.appendChild(cv);
    if (d.name) { const tag = document.createElement('span'); tag.textContent = d.name; el.appendChild(tag); }
    world.appendChild(el);
    const p = {
      el, ctx: cv.getContext('2d'), outfit: d.outfit || {}, name: d.name || '',
      x: fromPctX(d.x), y: fromPctY(d.y), lastF: -1,
    };
    peers.set(d.id, p);
    placePeer(p);
    drawPeer(p, true);
    refreshCrowd();
  }
  const parkRoom = presenceRoom({
    url: PARK_WS,
    hi: () => ({ outfit: myParkOutfit(), x: toPctX(pos.x), y: toPctY(pos.y), name: parkName }),
    onMessage: (m) => {
      if (m.t === 'roster') { myParkId = m.you; (m.all || []).forEach(addPeer); refreshCrowd(); }
      else if (m.t === 'join') addPeer(m.p);
      else if (m.t === 'move') {
        const p = peers.get(m.id);
        if (p) { p.x = fromPctX(m.x); p.y = fromPctY(m.y); placePeer(p); }
      } else if (m.t === 'outfit') {
        const p = peers.get(m.id);
        if (p) { p.outfit = m.outfit || {}; drawPeer(p, true); }
      } else if (m.t === 'leave') {
        const p = peers.get(m.id);
        if (p) {
          poofInto(world, 'pk-poof', p.x / W * 100, (p.y - 26) / H * 100);
          p.el.remove();
          peers.delete(m.id);
          refreshCrowd();
        }
      }
    },
    onDown: () => { peers.forEach((p) => p.el.remove()); peers.clear(); refreshCrowd(); },
  });
  function parkSendMove(now) {
    if (!parkRoom.live || now - parkSendAt < 150) return;
    if (Math.abs(pos.x - lastSent.x) < 1 && Math.abs(pos.y - lastSent.y) < 1) return;
    parkSendAt = now;
    lastSent.x = pos.x; lastSent.y = pos.y;
    parkRoom.send({ t: 'move', x: toPctX(pos.x), y: toPctY(pos.y) });
  }

  // the QA reach-in (same family as ?beachtest): place the banana, top up
  // coins, read the live rosters — nothing here exists in a normal session
  if (PARK_TEST) {
    window.__park = {
      pos, tgt, acorns, bflys, squirrels, RIDES,
      coins: (n) => { passStat('coins_earned', n); refreshHud(); },
      warp: (x, y) => { pos.x = x; pos.y = y; tgt.x = x; tgt.y = y; meWX = NaN; },
    };
  }

  meEl.style.left = pct(pos.x, W);
  meEl.style.top = pct(pos.y, H);
  depth(meEl, pos.y);
  assetsReady().then(() => {
    drawMe();
    setTimeout(() => { lastF = -1; drawMe(); }, 700);   // redraw belt: accessories decode async
    setTimeout(() => { lastF = -1; drawMe(); }, 1800);
    setInterval(() => {
      if (document.hidden) return;
      drawMe();
      peers.forEach((p) => drawPeer(p));
    }, 120);
    requestAnimationFrame((t) => { last = t; step(t); });
  });
}

// the entry point, AFTER every module const above it (TDZ)
if (view) init();
