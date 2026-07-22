// 🏖 BANANA BAY — B0 "the postcard" (banana-beach-plan).
// The world is 760×420 art px, WIDER than the screen: an X-axis camera
// follows your banana (the new engine seam this area introduces). Solo-first:
// walk, kick the ball, chase-proof crabs, take a deck chair, watch the sun
// not set. The presence room (B1) plugs into the same coords later.
// Movement runs in ART-PX (not %), so speed feels identical on every screen.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';

const view = document.getElementById('bhView');
if (view) init();

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

function init() {
  const W = 760, H = 420;
  const world = document.getElementById('bhWorld');
  const meEl = document.getElementById('bhMe');
  const meCtx = document.getElementById('bhMeCv').getContext('2d');
  const cutEl = document.getElementById('bhCut');
  const hintEl = document.getElementById('bhHint');
  const kicksEl = document.getElementById('bhKicks');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // your banana, dressed the way you left it
  let myOutfit = { hat: 'none', glasses: 'none', extras: {} };
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o) myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {} };
  } catch (e) {}
  const ME_DRAW = { ...myOutfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };

  // ---- camera: the world pans, the banana leads ---------------------------
  let scale = 1, viewW = 0, camX = 0;
  function layout() {
    const r = view.getBoundingClientRect();
    scale = r.height / H;
    viewW = r.width;
    world.style.width = (W * scale) + 'px';
  }
  addEventListener('resize', layout);
  layout();
  function cam() {
    const target = Math.max(0, Math.min(W * scale - viewW, pos.x * scale - viewW / 2));
    camX += (target - camX) * 0.12;
    world.style.transform = 'translateX(' + (-camX) + 'px)';
  }

  // ---- spawn: in from the park road, or up from the bottom (cold landing) --
  const fromPark = /[?&]park(?:=|&|$)/.test(location.search);
  const pos = fromPark ? { x: 20, y: 392 } : { x: 380, y: 412 };
  const tgt = fromPark ? { x: 160, y: 356 } : { x: 308, y: 336 };
  camX = Math.max(0, Math.min(W * scale - viewW, pos.x * scale - viewW / 2));
  track('beach_join', { via: fromPark ? 'park' : 'direct' });

  // ---- geometry (art px): where feet may go -------------------------------
  // sand+boardwalk below the waterline; the pier is the one path over water
  const PIER = { x0: 598, x1: 642, y0: 96 };
  const PLATFORM = { x0: 578, x1: 662, y0: 90, y1: 134 };
  const OB_RECTS = [
    [12, 202, 96, 276],    // radio shack
    [14, 298, 100, 366],   // kiosk
    [144, 286, 162, 304],  // palm 1 trunk
    [514, 304, 532, 322],  // palm 2 trunk
  ];
  const OB_CIRCLES = [
    [250, 332, 18],        // bonfire ring
    [452, 336, 7],         // parasol pole
  ];
  const CHAIRS = [
    { rect: [338, 320, 380, 358], seat: { x: 359, y: 342 } },
    { rect: [390, 338, 432, 376], seat: { x: 411, y: 360 } },
  ];
  const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  function blocked(x, y) {
    if (x < 8 || x > 752 || y > 414) return true;
    if (y < 200) {
      const onPier = (x >= PIER.x0 && x <= PIER.x1 && y >= PIER.y0)
        || (x >= PLATFORM.x0 && x <= PLATFORM.x1 && y >= PLATFORM.y0 && y <= PLATFORM.y1);
      if (!onPier) return true; // bananas famously can't swim
    }
    for (const r of OB_RECTS) if (inRect(x, y, r)) return true;
    for (const [cx, cy, cr] of OB_CIRCLES) if (Math.hypot(x - cx, y - cy) < cr) return true;
    return false;
  }

  // ---- walking: tap the world / WASD, chairs are sit targets ---------------
  let seated = null; // the chair you're lounging in
  const SPEED = 92;  // art px/s (matches the park's stride)
  const keys = {};
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      keys[k] = true; e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  let sitTarget = null, satOnce = false, nextTgt = null;
  // the pier is an L — a straight line into the water dead-ends in its corner,
  // so any land↔pier walk routes through the pier MOUTH as a waypoint
  function setTarget(wx, wy) {
    const crossing = (pos.y < 198) !== (wy < 198);
    if (crossing) { nextTgt = { x: wx, y: wy }; tgt.x = 620; tgt.y = 208; }
    else { nextTgt = null; tgt.x = wx; tgt.y = wy; }
  }
  view.addEventListener('click', (e) => {
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top) / scale;
    hint(false);
    seated = null;
    meEl.classList.remove('is-sitting');
    const chair = CHAIRS.find((c) => inRect(wx, wy, c.rect));
    if (chair) { sitTarget = chair; setTarget(chair.seat.x, chair.seat.y + 8); return; }
    sitTarget = null;
    setTarget(wx, wy);
  });

  // ---- the exit road (bottom-left) back to the park ------------------------
  let roadArmed = false, leaving = false;
  function exitToPark() {
    if (leaving) return;
    leaving = true;
    track('beach_exit_park');
    if (REDUCED) { location.href = '/banana-stand/?beach'; return; }
    cutEl.classList.add('is-on');
    setTimeout(() => { location.href = '/banana-stand/?beach'; }, 170);
  }

  // ---- the beach ball: B0's one-tap toy ------------------------------------
  const ballEl = document.getElementById('bhBall');
  const ball = { x: fromPark ? 220 : 330, y: 300, vx: 0, vy: 0 };
  let kicks = 0, lastKickTrack = 0, kickAnim = 0;
  function kickFloat(x, y) {
    const d = document.createElement('div');
    d.className = 'bh-kickfloat';
    d.textContent = ['thwock!', 'boing', 'pow!', 'nice'][kicks % 4];
    d.style.left = (x / W * 100) + '%';
    d.style.top = (y / H * 100) + '%';
    world.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }
  function ballStep(dt, now) {
    // the kick: walk into it and it flies
    const d = Math.hypot(pos.x - ball.x, (pos.y - 6) - ball.y);
    if (d < 18 && now - kickAnim > 350) {
      const ang = Math.atan2(ball.y - (pos.y - 6), ball.x - pos.x) + (Math.random() - 0.5) * 0.4;
      const power = 150 + Math.random() * 60;
      ball.vx = Math.cos(ang) * power;
      ball.vy = Math.sin(ang) * power * 0.8;
      kicks++;
      kickAnim = now;
      kickFloat(ball.x, ball.y - 10);
      ballEl.classList.add('is-kicked');
      setTimeout(() => ballEl.classList.remove('is-kicked'), 140);
      if (kicksEl) kicksEl.textContent = '⚽ ' + kicks;
      if (now - lastKickTrack > 8000) { lastKickTrack = now; track('beach_ball_kick'); }
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const damp = Math.pow(0.25, dt);
    ball.vx *= damp; ball.vy *= damp;
    if (ball.x < 16) { ball.x = 16; ball.vx = Math.abs(ball.vx) * 0.65; }
    if (ball.x > 744) { ball.x = 744; ball.vx = -Math.abs(ball.vx) * 0.65; }
    if (ball.y < 204) { ball.y = 204; ball.vy = Math.abs(ball.vy) * 0.65; }
    if (ball.y > 408) { ball.y = 408; ball.vy = -Math.abs(ball.vy) * 0.65; }
    for (const r of OB_RECTS) {
      if (inRect(ball.x, ball.y, r)) {
        const dl = ball.x - r[0], dr = r[2] - ball.x, dtp = ball.y - r[1], db = r[3] - ball.y;
        const m = Math.min(dl, dr, dtp, db);
        if (m === dl) { ball.x = r[0]; ball.vx = -Math.abs(ball.vx) * 0.6; }
        else if (m === dr) { ball.x = r[2]; ball.vx = Math.abs(ball.vx) * 0.6; }
        else if (m === dtp) { ball.y = r[1]; ball.vy = -Math.abs(ball.vy) * 0.6; }
        else { ball.y = r[3]; ball.vy = Math.abs(ball.vy) * 0.6; }
      }
    }
    ballEl.style.left = (ball.x / W * 100) + '%';
    ballEl.style.top = (ball.y / H * 100) + '%';
  }

  // ---- crabs: two locals who want NOTHING to do with you -------------------
  const crabs = [];
  for (const start of [{ x: 300, y: 250 }, { x: 560, y: 380 }]) {
    const el = document.createElement('div');
    el.className = 'bh-crab';
    el.innerHTML = '<img src="/assets/beach/crab.png" alt="" aria-hidden="true">';
    world.appendChild(el);
    crabs.push({ el, x: start.x, y: start.y, tx: start.x, ty: start.y, wait: Math.random() * 3 });
  }
  function crabStep(c, dt) {
    const fear = Math.hypot(pos.x - c.x, pos.y - c.y);
    if (fear < 34) { // scurry AWAY, sideways-ish, like a proper crab
      const ang = Math.atan2(c.y - pos.y, c.x - pos.x) + (Math.random() - 0.5);
      c.tx = c.x + Math.cos(ang) * 60;
      c.ty = c.y + Math.sin(ang) * 30;
      c.wait = 0;
    }
    if (c.wait > 0) { c.wait -= dt; return; }
    const dx = c.tx - c.x, dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) {
      c.wait = 1 + Math.random() * 3.5;
      c.tx = 130 + Math.random() * 600;
      c.ty = 210 + Math.random() * 195;
      if (blocked(c.tx, c.ty)) { c.tx = c.x; c.ty = c.y; }
      return;
    }
    const sp = (fear < 34 ? 85 : 34) * dt;
    const nx = c.x + (dx / d) * Math.min(d, sp);
    const ny = c.y + (dy / d) * Math.min(d, sp);
    if (!blocked(nx, ny)) { c.x = nx; c.y = ny; } else { c.tx = c.x; c.ty = c.y; }
    c.el.style.left = (c.x / W * 100) + '%';
    c.el.style.top = (c.y / H * 100) + '%';
    c.el.querySelector('img').style.transform = dx < 0 ? 'scaleX(-1)' : '';
  }

  // ---- the walk loop -------------------------------------------------------
  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (kx || ky) {
      tgt.x = pos.x + kx * 22; tgt.y = pos.y + ky * 22;
      hint(false); seated = null; sitTarget = null; meEl.classList.remove('is-sitting');
    }
    if (!seated) {
      const dx = tgt.x - pos.x, dy = tgt.y - pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 1.5) {
        const m = Math.min(d, SPEED * dt);
        const nx = pos.x + (dx / d) * m, ny = pos.y + (dy / d) * m;
        if (!blocked(nx, ny)) { pos.x = nx; pos.y = ny; }
        else if (!blocked(nx, pos.y)) pos.x = nx;   // slide along edges
        else if (!blocked(pos.x, ny)) pos.y = ny;
        else {
          // round obstacles (the bonfire): try stepping perpendicular, pick
          // whichever side is open — walks AROUND instead of parking
          const p1x = pos.x + (dy / d) * m, p1y = pos.y - (dx / d) * m;
          const p2x = pos.x - (dy / d) * m, p2y = pos.y + (dx / d) * m;
          if (!blocked(p1x, p1y)) { pos.x = p1x; pos.y = p1y; }
          else if (!blocked(p2x, p2y)) { pos.x = p2x; pos.y = p2y; }
          else { tgt.x = pos.x; tgt.y = pos.y; }
        }
      } else if (nextTgt) {
        tgt.x = nextTgt.x; tgt.y = nextTgt.y; nextTgt = null; // waypoint cleared
      } else if (sitTarget) {
        seated = sitTarget;
        sitTarget = null;
        pos.x = seated.seat.x; pos.y = seated.seat.y;
        meEl.classList.add('is-sitting');
        if (!satOnce) { satOnce = true; track('beach_sit'); }
      }
      pos.y = Math.max(94, Math.min(414, pos.y));
      pos.x = Math.max(8, Math.min(752, pos.x));
      meEl.style.left = (pos.x / W * 100) + '%';
      meEl.style.top = (pos.y / H * 100) + '%';
      // the road home: bottom-left, armed once you're properly in
      if (pos.x > 70) roadArmed = true;
      if (roadArmed && pos.x < 24 && pos.y > 372) exitToPark();
    }
    ballStep(dt, now);
    crabs.forEach((c) => crabStep(c, dt));
    cam();
    requestAnimationFrame(step);
  }

  // dancing on the world beat, like everywhere in Banana World
  const frameNow = () => {
    const cyc = BASE_CYCLE_S * 1000;
    return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES;
  };
  let lastF = -1;
  function drawMe() {
    const f = frameNow();
    if (f === lastF) return;
    lastF = f;
    drawComposite(meCtx, 150, f, ME_DRAW);
  }
  function hint(on) { if (hintEl) hintEl.classList.toggle('is-off', !on); }

  assetsReady().then(() => {
    drawMe();
    setTimeout(() => { lastF = -1; drawMe(); }, 600); // redraw belt: async accessory decodes
    setInterval(() => { if (!document.hidden) drawMe(); }, 120);
    requestAnimationFrame((t) => { last = t; step(t); });
  });
}
