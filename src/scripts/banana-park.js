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
  WORLD, BOUND, POND, FOUNTAIN, DOORS, OB_RECTS, OB_CIRCLES, OVERLAYS,
} from './park-geo.js';

// ⚠️ init() is CALLED AT THE BOTTOM of this file — module consts first,
// entry point last (the TDZ trap that once killed the rave floor).
const view = document.getElementById('pkView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

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
    if (e.target.closest('.pk-whud') || e.target.closest('.pk-actions')) return;
    const r = view.getBoundingClientRect();
    tgt.x = (e.clientX - r.left + camX) / scale;
    tgt.y = (e.clientY - r.top + camY) / scale;
    hint(false);
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
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (kx || ky) { tgt.x = pos.x + kx * 30; tgt.y = pos.y + ky * 30; hint(false); }
    const dx = tgt.x - pos.x, dy = tgt.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5) {
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
