// 🏖 BANANA BAY — B1 "The Resort" (banana-beach-plan).
// The world is 1400×620 art px with a BOTH-AXIS camera. Three hooks, one of
// each kind (never three of the same): the FIDGET (volleyball over a real net,
// ball has height + shadow, rally counter), the COLLECTION (29 shells, tide-
// seeded daily, visible gaps), the DAILY RITUAL (the tide lays a fresh set
// every day). Captain Split trades duplicates — never coins, so the world's
// one coin faucet stays untouched.
// Solo-first by law: multiplayer (B2) only amplifies what already works alone.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { passStat, passGet } from '../lib/banana-pass.js';
import { seedRand } from '../lib/world.js';
// 🔧 GENERATED GEOMETRY — every collider and world line comes from
// tools/build-beach-scene.py, which declares each collider on the place()
// call that draws the prop. Never hand-copy a coordinate in here again: the
// hand-kept version drifted three times (two parasol poles and a palm trunk
// left standing where their props used to be, one of them ON the court).
import {
  WORLD, WATER_Y, PIER, PLATFORM, PIER_MOUTH, COURT, NET, BAR,
  OB_RECTS, OB_CIRCLES, CHAIRS,
} from './beach-geo.js';

// ⚠️ init() is CALLED AT THE BOTTOM of this file, never here: everything it
// touches (SHELL_IDS, SHELL_TABLE…) is a module const, and consts are in the
// temporal dead zone until their line runs. Calling init() up here throws a
// silent ReferenceError mid-init — the same TDZ trap that killed the rave
// floor once. Module consts first, entry point last.
const view = document.getElementById('bhView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// ---- the collection contract --------------------------------------------
// ORDER MATCHES tools/build-beach-scene.py's SHELL_IDS → the sprite strip is
// indexed by position. Never reorder; only append (and bump the strip).
const SHELL_IDS = [];
const FAMILIES = ['brown', 'grey', 'white', 'ice', 'pink', 'gold', 'goldblue'];
const SHAPES = ['spiral', 'fan', 'cone'];
FAMILIES.forEach((f) => SHAPES.forEach((s) => SHELL_IDS.push(f + '_' + s)));
['blue', 'green', 'purple', 'yellow'].forEach((c) => {
  SHELL_IDS.push('star_' + c + '_s');
  SHELL_IDS.push('star_' + c + '_b');
});
const SHELL_W = { brown: 10, grey: 10, white: 9, ice: 6, pink: 6, gold: 2, goldblue: 1 };
const SHAPE_NAME = { spiral: 'spiral', fan: 'scallop', cone: 'cone' };
const FAM_NAME = { brown: 'brown', grey: 'grey', white: 'white', ice: 'ice-white', pink: 'pink', gold: 'gold', goldblue: 'blue-gold' };
function shellName(id) {
  if (id.indexOf('star_') === 0) {
    const p = id.split('_');
    return (p[2] === 'b' ? 'big ' : '') + p[1] + ' starfish';
  }
  const p = id.split('_');
  return FAM_NAME[p[0]] + ' ' + SHAPE_NAME[p[1]];
}
// weighted draw table (gold/blue-gold are the grails)
const SHELL_TABLE = [];
SHELL_IDS.forEach((id) => {
  let w;
  if (id.indexOf('star_') === 0) w = id.endsWith('_b') ? 1.5 : 4;
  else w = SHELL_W[id.split('_')[0]];
  SHELL_TABLE.push({ id, w });
});
const SHELL_TOTAL_W = SHELL_TABLE.reduce((a, s) => a + s.w, 0);
function shellForRoll(r) {
  let acc = 0;
  const t = r * SHELL_TOTAL_W;
  for (const s of SHELL_TABLE) { acc += s.w; if (t <= acc) return s.id; }
  return SHELL_TABLE[0].id;
}

function init() {
  // B2: a true TOP-DOWN map at the pack's native 48px scale (see the plan).
  // The banana is ~56 art px — about one tile — so palms and buildings tower
  // over it the way they do in the pack's own world.
  const W = WORLD.w, H = WORLD.h, VIEW_ART_H = 820;   // ≈ art px shown ACROSS
  const world = document.getElementById('bhWorld');
  const meEl = document.getElementById('bhMe');
  const meCtx = document.getElementById('bhMeCv').getContext('2d');
  const capEl = document.getElementById('bhCap');
  const capCtx = document.getElementById('bhCapCv').getContext('2d');
  const capBubble = document.getElementById('bhCapBubble');
  const cutEl = document.getElementById('bhCut');
  const hintEl = document.getElementById('bhHint');
  const rallyEl = document.getElementById('bhRally');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let myOutfit = { hat: 'none', glasses: 'none', extras: {} };
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o) myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {} };
  } catch (e) {}
  const ME_DRAW = { ...myOutfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
  // Captain Split: bucket hat + snorkel, because of course
  const CAP_DRAW = {
    hat: 'buckethat', glasses: 'snorkelmask', extras: {},
    top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
  };

  const pct = (v, span) => (v / span * 100) + '%';

  // ---- camera: pans BOTH axes, the banana leads ---------------------------
  let scale = 1, viewW = 0, viewH = 0, camX = 0, camY = 0;
  function layout() {
    const r = view.getBoundingClientRect();
    viewW = r.width; viewH = r.height;
    // zoom is driven by WIDTH, not height: a tall narrow phone viewport
    // divided by a fixed art-height zoomed the map to a postage stamp.
    // Aim to show ~VIEW_ART_H art px across, clamped so it never gets silly.
    scale = Math.max(0.5, Math.min(1.15, viewW / VIEW_ART_H));
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
  function cam() {
    const t = camTarget();
    camX += (t.x - camX) * 0.12;
    camY += (t.y - camY) * 0.12;
    world.style.transform = 'translate(' + (-camX) + 'px,' + (-camY) + 'px)';
  }

  // ---- geometry (art px) --------------------------------------------------
  // All of it is imported from the GENERATED beach-geo.js. What stays here is
  // only gameplay TUNING — numbers you'd change by feel, not by moving art.
  //
  // NET_H is deliberately LOW: a struck ball clears it, a dribbling one
  // doesn't. The rally is about hustle (keep reaching it), not precision —
  // which is the "fidget" hook this area needs, not a skill wall.
  // ⚠️ THE NET IS HORIZONTAL (the pack's net pieces are drawn to be laid
  // left→right, which is also how LimeZu's own beach screenshot uses them),
  // so the ball crosses it on the Y axis, not X.
  const NET_Y = NET.y, NET_X0 = NET.x0, NET_X1 = NET.x1, NET_H = 18;
  const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  function blocked(x, y) {
    if (x < 12 || x > WORLD.w - 12 || y > WORLD.h - 12) return true;
    if (y < WATER_Y) {
      const onPier = (x >= PIER.x0 && x <= PIER.x1 && y >= PIER.y0)
        || (x >= PLATFORM.x0 && x <= PLATFORM.x1 && y >= PLATFORM.y0 && y <= PLATFORM.y1);
      if (!onPier) return true;           // bananas famously can't swim
    }
    for (const r of OB_RECTS) if (inRect(x, y, r)) return true;
    for (const c of OB_CIRCLES) if (Math.hypot(x - c[0], y - c[1]) < c[2]) return true;
    return false;
  }

  // ---- spawn --------------------------------------------------------------
  const fromPark = /[?&]park(?:=|&|$)/.test(location.search);
  const pos = fromPark ? { x: 70, y: 1040 } : { x: 860, y: 880 };
  const tgt = fromPark ? { x: 330, y: 980 } : { x: 860, y: 820 };
  const c0 = camTarget(); camX = c0.x; camY = c0.y;
  track('beach_join', { via: fromPark ? 'park' : 'direct' });

  // ---- walking ------------------------------------------------------------
  let seated = null, sitTarget = null, satOnce = false, nextTgt = null;
  const SPEED = 168;                      // art px/s — the map doubled
  const keys = {};
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      keys[k] = true; e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  // land↔pier walks route through the pier mouth (the pier is an L — a
  // straight line into the water dead-ends against its side)
  function setTarget(wx, wy) {
    const crossing = (pos.y < WATER_Y + 10) !== (wy < WATER_Y + 10);
    if (crossing) { nextTgt = { x: wx, y: wy }; tgt.x = PIER_MOUTH.x; tgt.y = PIER_MOUTH.y; }
    else { nextTgt = null; tgt.x = wx; tgt.y = wy; }
  }
  view.addEventListener('click', (e) => {
    if (e.target.closest('.bh-panel') || e.target.closest('.bh-chip')) return;
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    hint(false);
    // at the bar? tapping the wreck talks to the Captain instead of walking
    if (inRect(wx, wy, [1540, 590, 1866, 780])) {
      if (Math.hypot(pos.x - BAR.x, pos.y - BAR.y) < BAR.r + 30) { openTrade(); return; }
      seated = null; sitTarget = null;
      meEl.classList.remove('is-sitting');
      setTarget(BAR.x, BAR.y);            // too far — walk over first
      return;
    }
    seated = null;
    meEl.classList.remove('is-sitting');
    const chair = CHAIRS.find((c) => inRect(wx, wy, c.rect));
    if (chair) { sitTarget = chair; setTarget(chair.seat.x, chair.seat.y + 10); return; }
    sitTarget = null;
    setTarget(wx, wy);
  });

  // ---- the road home (bottom-left) ---------------------------------------
  let roadArmed = false, leaving = false;
  function exitToPark() {
    if (leaving) return;
    leaving = true;
    track('beach_exit_park');
    if (REDUCED) { location.href = '/banana-stand/?beach'; return; }
    cutEl.classList.add('is-on');
    setTimeout(() => { location.href = '/banana-stand/?beach'; }, 170);
  }

  function float(x, y, text) {
    const d = document.createElement('div');
    d.className = 'bh-float';
    d.textContent = text;
    d.style.left = pct(x, W);
    d.style.top = pct(y, H);
    world.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  // ---- 🏐 THE VOLLEYBALL: the ball has HEIGHT, and the net cares ----------
  const ballEl = document.getElementById('bhBall');
  const shadowEl = document.getElementById('bhBallShadow');
  // ⚠️ THE BALL NEVER LEAVES THE COURT. It is the volleyball, not the beach's
  // loose toy — Trym: "that specific ball needs to stay exclusively inside the
  // red volleyball border as its for playing volleyball and shouldnt escape".
  // The red line is the wall, inset by the ball's radius so it visibly bounces
  // off the line instead of clipping through it. Because nothing inside the
  // court can obstruct it (audit_court() guarantees that at build time), the
  // ball needs NO obstacle test and no world-edge fences at all.
  const CT = COURT;                       // from the generated beach-geo.js
  const BALL_R = 14;
  const BX0 = CT.x0 + BALL_R, BX1 = CT.x1 - BALL_R;
  const BY0 = CT.y0 + BALL_R, BY1 = CT.y1 - BALL_R;
  const WALL_BOUNCE = 0.62;      // lively enough to stay in play, not pinball
  const BALL_FRAMES = 8;
  // how far off the net line counts as "in the net's dead zone" — a ball that
  // stops here is unplayable, so it gets rolled out (see the anti-stick below)
  const NET_DEAD = 36;
  const ball = { x: 930, y: 660, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 };
  // a beach ball FLOATS — light gravity and a high pop, so a kick from a
  // sensible distance clears the net (tuned in testing: at 300 it never did,
  // which made the court a wall instead of a game). The net still punishes
  // weak contact and rolling balls, which is where the skill lives.
  const GRAV = 180;
  let rally = 0, bestRally = 0, restAt = 0, lastKick = 0, kickTrackAt = 0;
  try { bestRally = parseInt(localStorage.getItem('bh-rally-best') || '0', 10) || 0; } catch (e) {}
  function showRally() {
    rallyEl.textContent = rally > 1 ? ('🏐 ' + rally + (bestRally > 1 ? ' · best ' + bestRally : '')) : '';
  }
  function ballStep(dt, now) {
    // the kick: walk into it. Kicks from behind the net send it high.
    const d = Math.hypot(pos.x - ball.x, (pos.y - 8) - ball.y);
    if (d < 22 && ball.z < 42 && now - lastKick > 320) {
      // A bump AIMS. Purely "away from the player" made the ball squirt off
      // sideways as often as over the net, which doesn't read as volleyball.
      // Blend the away-vector with an aim at a spot in the FAR half, then size
      // the hop so the ball lands roughly there — near apex over the net.
      const away = Math.atan2(ball.y - (pos.y - 8), ball.x - pos.x);
      const far = pos.y >= NET_Y ? -1 : 1;
      const tx = CT.x0 + 70 + Math.random() * (CT.x1 - CT.x0 - 140);
      const ty = NET_Y + far * (100 + Math.random() * 90);
      const aim = Math.atan2(ty - ball.y, tx - ball.x);
      let dx = Math.cos(away) * 0.38 + Math.cos(aim) * 0.62;
      let dy = Math.sin(away) * 0.38 + Math.sin(aim) * 0.62;
      const dl = Math.hypot(dx, dy) || 1;
      const dist = Math.hypot(tx - ball.x, ty - ball.y);
      const power = Math.max(95, Math.min(205, dist * 1.15));
      ball.vx = (dx / dl) * power;
      ball.vy = (dy / dl) * power * 0.82;
      // vz from the flight time it needs, so a deep hit hangs and a short one
      // pops — but never under the net's clearance (GRAV 180 → apex 40 at 120)
      ball.vz = Math.max(122, Math.min(205, GRAV * (dist / power) / 2));
      lastKick = now;
      ballEl.animate(
        [{ transform: 'translate(-50%,-50%) scale(1.35)' }, { transform: 'translate(-50%,-50%) scale(1)' }],
        { duration: 170, easing: 'ease-out' },
      );
      if (now - kickTrackAt > 8000) { kickTrackAt = now; track('beach_ball_kick'); }
    }
    const py0 = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.z += ball.vz * dt;
    ball.vz -= GRAV * dt;
    if (ball.z <= 0) {                     // landed
      ball.z = 0;
      if (ball.vz < -30) ball.vz = -ball.vz * 0.46;
      else ball.vz = 0;
      const damp = Math.pow(0.12, dt);     // sand kills roll fast
      ball.vx *= damp; ball.vy *= damp;
    }
    // THE NET: crossing it low bounces you back, crossing it high = a volley
    const crossed = (py0 - NET_Y) * (ball.y - NET_Y) < 0;
    if (crossed && ball.x > NET_X0 && ball.x < NET_X1) {
      if (ball.z < NET_H) {
        ball.y = py0 < NET_Y ? NET_Y - 7 : NET_Y + 7;
        ball.vy = -ball.vy * 0.55;
        rally = 0;
        showRally();
        float(ball.x, ball.y - 14, 'net!');
      } else {
        rally++;
        if (rally > bestRally) {
          bestRally = rally;
          try { localStorage.setItem('bh-rally-best', String(bestRally)); } catch (e) {}
        }
        showRally();
        if (rally === 5 || rally === 10 || rally === 25) float(ball.x, ball.y - 16, 'rally ' + rally + '!');
        passStat('bh_volley', 1);
      }
    }
    // THE RED BORDER IS THE WALL. Clamp AFTER the net test so a wall bounce
    // can never shunt the ball across the net line without being judged; the
    // side walls are ~150px clear of it either way, so they never can.
    if (ball.x < BX0) { ball.x = BX0; ball.vx = Math.abs(ball.vx) * WALL_BOUNCE; }
    else if (ball.x > BX1) { ball.x = BX1; ball.vx = -Math.abs(ball.vx) * WALL_BOUNCE; }
    if (ball.y < BY0) { ball.y = BY0; ball.vy = Math.abs(ball.vy) * WALL_BOUNCE; }
    else if (ball.y > BY1) { ball.y = BY1; ball.vy = -Math.abs(ball.vy) * WALL_BOUNCE; }

    const speed = Math.hypot(ball.vx, ball.vy);
    // ⚠️ ANTI-STICK. A ball that trickles to a halt ON the net line is dead:
    // you walk into it, the kick shoves it at the net, the net shoves it back,
    // and it jitters there forever. So whenever it settles inside the net's
    // dead zone, roll it out — to YOUR half, so the next hit is always on.
    if (speed < 16 && ball.z === 0 && Math.abs(ball.y - NET_Y) < NET_DEAD) {
      const side = pos.y >= NET_Y ? 1 : -1;
      ball.y = NET_Y + side * NET_DEAD;
      ball.vy = side * 30;
      ball.vx *= 0.5;
    }
    // a rally dies when the ball comes to rest
    if (speed < 8 && ball.z === 0) {
      if (!restAt) restAt = now;
      // 6s, up from 3: a rally must never die while you're still sprinting for
      // the ball. Now that the net is solid you have to run AROUND a pole to
      // follow it — from mid-court that's ~730px, about 4.3s at SPEED 168.
      else if (now - restAt > 6000 && rally) { rally = 0; showRally(); }
    } else restAt = 0;

    // SPIN follows travel, so the ball rolls instead of sliding. Frame index
    // must land EXACTLY on a frame: for an N-frame strip the frames sit at
    // multiples of 100/(N-1)%, never 100/N% — see beach.astro's stepping note.
    ball.spin += (ball.vx * 0.72 + ball.vy * 0.42) * dt * 0.075;
    const fr = ((Math.floor(ball.spin) % BALL_FRAMES) + BALL_FRAMES) % BALL_FRAMES;
    ballEl.style.backgroundPositionX = (fr * (100 / (BALL_FRAMES - 1))) + '%';
    ballEl.style.left = pct(ball.x, W);
    ballEl.style.top = pct(ball.y - ball.z, H);
    shadowEl.style.left = pct(ball.x, W);
    shadowEl.style.top = pct(ball.y + 3, H);
    const s = Math.max(0.35, 1 - ball.z / 150);
    shadowEl.style.opacity = String(0.1 + s * 0.28);
    shadowEl.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }

  // ---- 🐚 THE SHELLS: the tide lays a fresh set every day -----------------
  const stats = () => passGet().stats || {};
  const held = (id) => Math.max(0, (stats()['sh_' + id] || 0) - (stats()['shx_' + id] || 0));
  const haveCount = () => SHELL_IDS.filter((id) => held(id) > 0).length;
  const dupeCount = () => SHELL_IDS.reduce((a, id) => a + Math.max(0, held(id) - 1), 0);
  const missingIds = () => SHELL_IDS.filter((id) => held(id) === 0);
  const DAY = Math.floor(Date.now() / 86400000);
  const SPOTS = 16;
  let claimed = [];
  try {
    const st = JSON.parse(localStorage.getItem('bh-shells-v1') || 'null');
    if (st && st.day === DAY && Array.isArray(st.claimed)) claimed = st.claimed;
  } catch (e) {}
  function saveClaimed() {
    try { localStorage.setItem('bh-shells-v1', JSON.stringify({ day: DAY, claimed })); } catch (e) {}
  }
  const shells = [];
  for (let i = 0; i < SPOTS; i++) {
    const x = 300 + seedRand(DAY * 977 + i * 31) * 2000;
    const y = 300 + seedRand(DAY * 977 + i * 31 + 1) * 30;
    const id = shellForRoll(seedRand(DAY * 977 + i * 31 + 2));
    const idx = SHELL_IDS.indexOf(id);
    if (claimed.indexOf(i) > -1) { shells.push(null); continue; }
    const el = document.createElement('div');
    el.className = 'bh-shell';
    el.style.left = pct(x, W);
    el.style.top = pct(y, H);
    el.style.backgroundPosition = (idx / (SHELL_IDS.length - 1) * 100) + '% 0';
    el.style.animationDelay = (i * 0.21) + 's';
    world.appendChild(el);
    shells.push({ el, x, y, id, i });
  }
  const shellChip = document.getElementById('bhShellChip');
  const shellCountEl = document.getElementById('bhShellCount');
  function refreshShellChip() { shellCountEl.textContent = haveCount() + '/' + SHELL_IDS.length; }
  refreshShellChip();
  function shellTick() {
    for (let i = 0; i < shells.length; i++) {
      const s = shells[i];
      if (!s) continue;
      if (Math.hypot(pos.x - s.x, (pos.y - 6) - s.y) < 20) {
        const isNew = held(s.id) === 0;
        passStat('sh_' + s.id, 1);
        claimed.push(s.i);
        saveClaimed();
        s.el.remove();
        shells[i] = null;
        refreshShellChip();
        float(s.x, s.y - 8, (isNew ? '★ NEW — ' : '+ ') + shellName(s.id));
        track('beach_shell', { shell: s.id, fresh: isNew ? 1 : 0 });
        if (isNew && haveCount() === SHELL_IDS.length) {
          say('you found every last one. the sea has nothing left to hide from you.', 6000);
          track('beach_shells_complete');
        }
      }
    }
  }

  // the collection panel
  const shellPanel = document.getElementById('bhShellPanel');
  const shellGrid = document.getElementById('bhShellGrid');
  const shellSub = document.getElementById('bhShellSub');
  function slotHTML(id) {
    const n = held(id);
    const idx = SHELL_IDS.indexOf(id);
    return '<div class="bh-slot' + (n ? '' : ' is-missing') + '" title="' + shellName(id) + '">'
      + '<i style="background-position:' + (idx / (SHELL_IDS.length - 1) * 100) + '% 0"></i>'
      + (n > 1 ? '<b>' + n + '</b>' : '') + '</div>';
  }
  function renderGrid(el) { el.innerHTML = SHELL_IDS.map(slotHTML).join(''); }
  function openShells() {
    renderGrid(shellGrid);
    const left = shells.filter(Boolean).length;
    shellSub.textContent = haveCount() + ' of ' + SHELL_IDS.length + ' found · '
      + (left ? left + ' still out on the sand today' : 'today’s tide is picked clean — more tomorrow');
    shellPanel.hidden = false;
    track('beach_shells_open');
  }
  shellChip.addEventListener('click', (e) => { e.stopPropagation(); openShells(); });
  document.getElementById('bhShellClose').addEventListener('click', () => { shellPanel.hidden = true; });

  // ---- 🚢 CAPTAIN SPLIT ---------------------------------------------------
  const CAP_LINES = [
    'ahoy. mind the net, it’s undefeated.',
    'i ran a ship once. now i run a bar. the ship is the bar.',
    'tide brings shells in at dawn. every dawn. it’s very reliable, the tide.',
    'got three of the same shell? i’ll swap you something you ain’t got.',
    'no, we don’t take coins. what would a shipwreck do with coins.',
    'the lighthouse still works. nobody knows who turns it on.',
    'that gold shell? seen two in my life. one of ’em i lost betting.',
  ];
  let capTimer = null, capIdx = 0, capGreeted = false;
  function say(text, ms) {
    capBubble.textContent = text;
    capBubble.classList.add('is-on');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => capBubble.classList.remove('is-on'), ms || 4200);
  }
  function capTick(now) {
    const near = Math.hypot(pos.x - BAR.x, pos.y - BAR.y) < BAR.r;
    if (near && !capGreeted) {
      capGreeted = true;
      const n = dupeCount();
      say(n >= 3
        ? 'ahoy! ' + n + ' spare shells in that pocket. i can work with that.'
        : CAP_LINES[capIdx++ % CAP_LINES.length]);
      track('beach_captain');
    } else if (!near && capGreeted && Math.hypot(pos.x - BAR.x, pos.y - BAR.y) > BAR.r + 40) {
      capGreeted = false;                 // re-greets next time you wander back
    }
  }
  // tapping the bar (or standing at it and tapping the Captain) opens trading
  const tradePanel = document.getElementById('bhTradePanel');
  const tradeGrid = document.getElementById('bhTradeGrid');
  const tradeSay = document.getElementById('bhTradeSay');
  const tradeDo = document.getElementById('bhTradeDo');
  function refreshTrade() {
    renderGrid(tradeGrid);
    const d = dupeCount(), m = missingIds().length;
    tradeDo.disabled = !(d >= 3 && m > 0);
    tradeDo.textContent = m === 0
      ? 'nothing left to want'
      : (d >= 3 ? 'trade 3 duplicates → 1 new shell' : 'you need ' + (3 - d) + ' more duplicates');
    tradeSay.textContent = m === 0
      ? '"you’ve got the lot. i’ve nothing to sell a finished collector."'
      : '"three you’ve got spare, one you ain’t got. that’s the deal. i don’t do money."';
  }
  function openTrade() {
    refreshTrade();
    tradePanel.hidden = false;
    track('beach_trade_open');
  }
  tradeDo.addEventListener('click', () => {
    const spares = SHELL_IDS.filter((id) => held(id) > 1)
      .sort((a, b) => held(b) - held(a));
    if (dupeCount() < 3) return;
    let need = 3;
    for (const id of spares) {
      while (need > 0 && held(id) > 1) { passStat('shx_' + id, 1); need--; }
      if (!need) break;
    }
    const miss = missingIds();
    const got = miss[Math.floor(Math.random() * miss.length)];
    passStat('sh_' + got, 1);
    refreshShellChip();
    refreshTrade();
    tradeSay.textContent = '"there she is — a ' + shellName(got) + '. pleasure doing business."';
    track('beach_trade', { got });
  });
  document.getElementById('bhTradeClose').addEventListener('click', () => { tradePanel.hidden = true; });

  // (the bobbing water props and the gulls are OUT for now — they were
  // flickering, see the frame-stepping note in beach.astro. Crabs first,
  // then the rest come back one at a time once the technique is proven.)

  // ---- 🦀 crabs: locals who want NOTHING to do with you -------------------
  // A crab is not a slow banana. It has a HOME it never really leaves, it
  // moves in short sideways darts with long stillnesses between them, and it
  // only sprints when you get close. Trym's read on the first version — "they
  // float around weirdly and with the same speed as the banana" — was two
  // faults: they picked targets anywhere on the whole map, so each one glided
  // the full width of the beach in one smooth straight line; and their legs
  // kept cycling while they stood still.
  const CRAB_WANDER = 26, CRAB_FLEE = 96, CRAB_HOME_R = 150;   // banana = 168
  const crabs = [];
  for (const home of [{ x: 700, y: 400 }, { x: 1300, y: 900 }, { x: 2000, y: 420 },
                      { x: 460, y: 1000 }, { x: 1560, y: 380 }]) {
    const el = document.createElement('div');
    el.className = 'bh-crab is-still';   // the pack's 10-frame crab, CSS-stepped
    el.style.animationDelay = (-Math.random() * 0.75) + 's';
    el.style.left = pct(home.x, W);
    el.style.top = pct(home.y, H);
    world.appendChild(el);
    crabs.push({ el, hx: home.x, hy: home.y, x: home.x, y: home.y,
                 tx: home.x, ty: home.y, wait: Math.random() * 3,
                 flee: 0, face: 1, still: true });
  }
  function crabPick(c) {
    // a dart: short, mostly sideways, and always back toward home if it drifted
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 70;
    let tx = c.x + Math.cos(a) * r, ty = c.y + Math.sin(a) * r * 0.5;
    if (Math.hypot(tx - c.hx, ty - c.hy) > CRAB_HOME_R) { tx = c.hx; ty = c.hy; }
    if (!blocked(tx, ty)) { c.tx = tx; c.ty = ty; }
  }
  function crabStep(c, dt) {
    const fear = Math.hypot(pos.x - c.x, pos.y - c.y);
    if (fear < 60) {                     // bolt away, sideways, for a moment
      const ang = Math.atan2(c.y - pos.y, c.x - pos.x);
      c.tx = c.x + Math.cos(ang) * 110;
      c.ty = c.y + Math.sin(ang) * 55;
      c.flee = 0.9; c.wait = 0;
    }
    c.flee = Math.max(0, c.flee - dt);
    if (c.wait > 0) {
      c.wait -= dt;
      if (!c.still) { c.still = true; c.el.classList.add('is-still'); }
      return;                            // legs stop when the crab does
    }
    const dx = c.tx - c.x, dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) { c.wait = 1.4 + Math.random() * 4; crabPick(c); return; }
    if (c.still) { c.still = false; c.el.classList.remove('is-still'); }
    const sp = (c.flee > 0 ? CRAB_FLEE : CRAB_WANDER) * dt;
    const nx = c.x + (dx / d) * Math.min(d, sp);
    const ny = c.y + (dy / d) * Math.min(d, sp);
    if (!blocked(nx, ny)) { c.x = nx; c.y = ny; } else { c.wait = 0.5; crabPick(c); return; }
    if (Math.abs(dx) > 6) c.face = dx < 0 ? -1 : 1;   // don't flutter near dx≈0
    c.el.style.left = pct(c.x, W);
    c.el.style.top = pct(c.y, H);
    c.el.style.transform = 'translate(-50%,-100%)' + (c.face < 0 ? ' scaleX(-1)' : '');
  }

  // ---- the loop -----------------------------------------------------------
  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (kx || ky) {
      tgt.x = pos.x + kx * 30; tgt.y = pos.y + ky * 30;
      hint(false); seated = null; sitTarget = null; nextTgt = null;
      meEl.classList.remove('is-sitting');
    }
    if (!seated) {
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
      } else if (nextTgt) {
        tgt.x = nextTgt.x; tgt.y = nextTgt.y; nextTgt = null;
      } else if (sitTarget) {
        seated = sitTarget; sitTarget = null;
        pos.x = seated.seat.x; pos.y = seated.seat.y;
        meEl.classList.add('is-sitting');
        if (!satOnce) { satOnce = true; track('beach_sit'); }
      }
      pos.x = Math.max(12, Math.min(W - 12, pos.x));
      pos.y = Math.max(64, Math.min(H - 12, pos.y));
      meEl.style.left = pct(pos.x, W);
      meEl.style.top = pct(pos.y, H);
      if (pos.x > 300) roadArmed = true;
      if (roadArmed && pos.x < 40 && pos.y > 1040) exitToPark();
    }
    ballStep(dt, now);
    shellTick();
    capTick(now);
    crabs.forEach((c) => crabStep(c, dt));
    cam();
    requestAnimationFrame(step);
  }

  // everyone in Banana World dances on the same wall clock
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
  function drawCap() { drawComposite(capCtx, 150, 3, CAP_DRAW); }  // he stands still, like a barman does
  function hint(on) { if (hintEl) hintEl.classList.toggle('is-off', !on); }

  // the Captain and his bubble sit at the bar, in world coords
  // he stands BEHIND the counter of the wreck — feet just above the bar top,
  // so the hull reads as being in front of him
  capEl.style.left = pct(1690, W);
  capEl.style.top = pct(688, H);
  capBubble.style.left = pct(1690, W);
  capBubble.style.top = pct(610, H);

  // ?beachtest = the QA hook (same family as ?cointest / ?nyantest): reach in
  // and place the ball or the banana without playing your way there
  if (/[?&]beachtest(?:=|&|$)/.test(location.search)) {
    window.__bay = { ball, pos, tgt, shells, SHELL_IDS, held, rallyOf: () => rally };
  }

  assetsReady().then(() => {
    drawMe(); drawCap();
    setTimeout(() => { lastF = -1; drawMe(); drawCap(); }, 700);   // redraw belt: accessories decode async
    setTimeout(() => { lastF = -1; drawMe(); drawCap(); }, 1800);
    setInterval(() => { if (!document.hidden) drawMe(); }, 120);
    requestAnimationFrame((t) => { last = t; step(t); });
  });
}

// the entry point, AFTER every module const above it (see the TDZ note up top)
if (view) init();
