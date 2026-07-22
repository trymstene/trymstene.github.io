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
  OB_RECTS, OB_CIRCLES, CHAIRS, OVERLAYS, PIER_SPRITE, STALLS, GRABBER,
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
  const W = WORLD.w, H = WORLD.h;
  // The most art px we ever show on each axis. ⚠️ BOTH matter — see layout().
  const VIEW_ART_W = 900, VIEW_ART_V = 760;
  const COURT_FIT = 500;   // art px that must always fit across (court = 480)
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
    // ⚠️ ZOOM FROM BOTH AXES, taking whichever needs MORE zoom, so neither
    // span can blow out. Width-only zoom (the old rule) let a tall pane show
    // 1029 art px vertically against an 1100px world — you saw 94% of the
    // map's height at once, so the sea filled the top and the banana read
    // tiny at 8.4% of the view. Capping the VERTICAL span is what fixes it.
    // (The original note here warned against height-ONLY zoom, which made a
    //  narrow phone a postage stamp. Taking the max of the two avoids both.)
    const want = Math.max(viewW / VIEW_ART_W, viewH / VIEW_ART_V);
    // …and never zoom out past the world filling the view, or it letterboxes
    const fill = Math.max(viewW / W, viewH / H);
    // ⚠️ …but never zoom IN so far that the volley court stops fitting across.
    // On a tall narrow phone the vertical cap alone wanted 423 art px across
    // against a 480-wide court, so you could never see both sidelines. On
    // those screens the horizontal floor wins and you accept more sea.
    const maxIn = viewW / (COURT_FIT);
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
  const NET_Y = NET.y, NET_X0 = NET.x0, NET_X1 = NET.x1;

  // ---- 🥅 the net's own layer, so things can pass BEHIND it ---------------
  // The net stands on NET.y but is DRAWN rising ~138px up the screen. While it
  // lived only in the background plate it could only ever draw behind the
  // banana, so you walked visibly through the mesh and then stopped dead at an
  // invisible line 75px lower (Trym drew exactly that on a screenshot). Depth
  // sorting is what makes a top-down wall read as a wall.
  // ⚠️ Below `pct`, never above it — a const used before its line is in the
  // temporal dead zone and throws a silent ReferenceError mid-init.
  const netEl = document.getElementById('bhNet');
  if (netEl) {
    netEl.style.left = pct(NET.spriteX, W);
    netEl.style.top = pct(NET.spriteY, H);
    netEl.style.width = pct(NET.spriteW, W);
    netEl.style.height = pct(NET.spriteH, H);
    netEl.style.zIndex = String(100 + NET.y);   // same rule as everything else
  }
  // ⭐ ONE PAINTER'S ALGORITHM FOR THE WHOLE BEACH.
  // Everything that stands on the sand — bananas, crabs, the ball, the net,
  // the palms, the lighthouse, the parasols, the wreck — takes a z-index from
  // its GROUND LINE. Lower on the map = nearer the viewer = drawn on top. That
  // one rule gives Trym's ask for free: you pass in FRONT of a palm's roots
  // and BEHIND its canopy, because the canopy belongs to a trunk whose base is
  // above you. It replaces the net's old two-value special case.
  // Range 100..1200 — safely clear of the ground layers (patches 2, shells 3)
  // and of the bubbles (1900+). All inside .bh-world, which has a transform
  // and therefore its own stacking context, so the HUD is never in the fight.
  const depth = (el, y) => { el.style.zIndex = String(100 + Math.round(y)); };

  // the props, redrawn above the plate so they can occlude
  OVERLAYS.forEach((o) => {
    const d = document.createElement('div');
    d.className = 'bh-ov';
    d.style.left = pct(o.x, W); d.style.top = pct(o.y, H);
    d.style.width = pct(o.w, W); d.style.height = pct(o.h, H);
    d.style.backgroundImage = "url('/assets/beach/" + o.src + "')";
    d.style.zIndex = String(100 + Math.round(o.base));
    world.appendChild(d);
  });
  // …and the dock, which is a FLOOR: above the opaque sea, below every walker
  const pierEl = document.createElement('div');
  pierEl.className = 'bh-pier';
  pierEl.style.left = pct(PIER_SPRITE.x, W);
  pierEl.style.top = pct(PIER_SPRITE.y, H);
  pierEl.style.width = pct(PIER_SPRITE.w, W);
  pierEl.style.height = pct(PIER_SPRITE.h, H);
  world.appendChild(pierEl);
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
  // ⚠️ The direct/ad landing now spawns in the TOP half — Sandy owns the near
  // one. You arrive already facing him across the net with the ball at your
  // feet, which is a much stronger cold-open than landing on empty sand.
  const pos = fromPark ? { x: 70, y: 1040 } : { x: 898, y: 742 };
  const tgt = fromPark ? { x: 330, y: 980 } : { x: 898, y: 720 };
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
    // space is context-sensitive: dig if you're stood on a patch, else play
    if (k === ' ' || k === 'spacebar') {
      if (patchAt(pos.x, pos.y)) dig(); else playBall();
      e.preventDefault();
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
    // 🎯 TAP THE BALL TO PLAY IT — checked first, and against the ball's
    // SCREEN position (y − z), so a ball in mid-air is tappable where you can
    // actually see it. In reach you bump; out of reach you go and fetch it.
    if (Math.hypot(wx - ball.x, wy - (ball.y - ball.z)) < 46) {
      seated = null; sitTarget = null;
      meEl.classList.remove('is-sitting');
      playBall();
      return;
    }
    if (tapGrabber(wx, wy)) return;   // 🕹 the landmark, out on the pier
    if (tapStall(wx, wy)) return;     // 🎡 a stall counter takes priority
    // ⛏ TAP A PATCH TO DIG IT — the same verb as tapping the ball. A dim chip
    // in the corner of the HUD was not discoverable: Trym built this with me
    // and still had to ask how to dig. Tapping the thing you want to interact
    // with is the rule this whole beach already uses.
    const tapPatch = patchAt(wx, wy);
    if (tapPatch) {
      seated = null; sitTarget = null;
      meEl.classList.remove('is-sitting');
      if (patchAt(pos.x, pos.y) === tapPatch) dig();   // stood on it → dig
      else { nextTgt = null; tgt.x = wx; tgt.y = wy; } // otherwise walk over
      return;
    }
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
  // ⚠️ THE BALL MUST CLEAR THE NET THAT'S ACTUALLY DRAWN. It used to need
  // only z > 18 against a mesh standing 133px tall — and its maximum apex was
  // 117, so it *could not* get over the net yet every crossing counted. Shots
  // sailed straight through the mesh (Trym: "looks like the net is
  // overflowing the ball… think it needs more bounce").
  //   NET.topZ (133) = top of the mesh   → clear this and it's a real volley
  //   NET.gapZ  (76) = bottom of the mesh → below this you pass UNDER the net,
  //                    through the gap the pack's art genuinely shows
  // Gravity is up from 180 so the higher arc still lands in a readable time
  // (apex 150 → ~1.7s of flight, not ~3s of floating).
  const GRAV = 420;
  // How hard a banana can pop a beach ball. This cap is what creates the
  // skill: from mid-court the arc it needs sits well under the cap, but
  // bumping from right against the net demands an apex the cap won't give.
  const MAX_APEX = 265;
  let rally = 0, bestRally = 0, restAt = 0, lastKick = 0, kickTrackAt = 0;
  try { bestRally = parseInt(localStorage.getItem('bh-rally-best') || '0', 10) || 0; } catch (e) {}
  function showRally() {
    rallyEl.textContent = rally > 1 ? ('🏐 ' + rally + (bestRally > 1 ? ' · best ' + bestRally : '')) : '';
  }
  // A BUMP, SOLVED RATHER THAN GUESSED.
  // For a projectile, the height at any point of its arc is
  //     z(u) = 4 · apex · u · (1 − u),  u = fraction of the flight travelled.
  // So if the net sits u of the way to where you're aiming, the apex you NEED
  // to clear it is  apex = NET.topZ / (4·u·(1−u)).  Solving it gives the whole
  // feel for free, straight out of the geometry:
  //   · bump from mid-court and a normal arc clears comfortably;
  //   · bump from right up against the net (u → 0) and the required apex goes
  //     to infinity — it's capped at MAX_APEX, so the shot hits the mesh.
  //     That's Trym's "if the shot is bad its not overflowing the net",
  //     falling out of physics instead of a hand-tuned rule.
  //   · ±12% noise on the apex, so shots near the limit sometimes just miss.
  // ⚠️ Keep `margin` SMALLER than `spread`, or it swallows the variation and
  // every shot from open court clears — no misses, no tension.
  const HIT_YOU = { margin: 13, maxApex: MAX_APEX, spread: 0.24 };
  // Sandy is DELIBERATELY better than you. "Never lets a rally die on
  // purpose" is his entire character, and a solo rally only exists at all
  // because somebody on the far side keeps sending it back: a rival who beat
  // you would end the loop, a partner who returns everything IS the loop.
  const HIT_SANDY = { margin: 34, maxApex: 460, spread: 0.10 };

  function bumpFrom(hx, hy, cfg) {
    const far = hy >= NET_Y ? -1 : 1;              // always at the OTHER half
    const tx = CT.x0 + 70 + Math.random() * (CT.x1 - CT.x0 - 140);
    const ty = NET_Y + far * (120 + Math.random() * 70);
    const L = Math.max(24, Math.hypot(tx - ball.x, ty - ball.y));
    const D = Math.abs(NET_Y - ball.y);
    const u = Math.min(0.94, Math.max(0.03, D / L));
    const need = (NET.topZ + cfg.margin) / (4 * u * (1 - u));
    const apex = Math.min(cfg.maxApex, need) * (1 - cfg.spread / 2 + Math.random() * cfg.spread);
    const vz = Math.sqrt(2 * GRAV * apex);
    const P = L / (2 * vz / GRAV);                 // speed to land at the target
    // mostly the aim, with a little "away from the hitter" so it feels struck
    let dx = (tx - ball.x) / L, dy = (ty - ball.y) / L;
    const ax = ball.x - hx, ay = ball.y - hy;
    const al = Math.hypot(ax, ay) || 1;
    dx = dx * 0.8 + (ax / al) * 0.2;
    dy = dy * 0.8 + (ay / al) * 0.2;
    const nl = Math.hypot(dx, dy) || 1;
    ball.vx = (dx / nl) * P;
    ball.vy = (dy / nl) * P;                       // ⚠️ NOT foreshortened: the
    ball.vz = vz;                                  // clearance maths needs the
    ballEl.animate(                                // real ground distance
      [{ transform: 'translate(-50%,-50%) scale(1.35)' }, { transform: 'translate(-50%,-50%) scale(1)' }],
      { duration: 170, easing: 'ease-out' },
    );
    return true;
  }

  function bump(now) {
    if (now - lastKick < 320) return false;
    lastKick = now;
    bumpFrom(pos.x, pos.y - 8, HIT_YOU);
    if (now - kickTrackAt > 8000) { kickTrackAt = now; track('beach_ball_kick'); }
    return true;
  }

  // 🎯 PLAY THE BALL — one gesture that works on a phone and a mouse alike.
  // Running into the ball at the right angle was the only way to hit it, which
  // is fiddly on a touchscreen (Trym asked for something better). Now: tap the
  // ball. In reach → you bump it. Out of reach → your banana goes and gets it,
  // and the contact bump fires on arrival. Space does the same on a keyboard.
  function playBall() {
    const d = Math.hypot(pos.x - ball.x, (pos.y - 8) - ball.y);
    if (d < 68 && ball.z < 120) { bump(performance.now()); return; }
    const bx = ball.x, by = Math.min(H - 20, ball.y + 14);
    // ⚠️ Ball on the FAR side? Route around a pole, exactly like land↔pier
    // routes via PIER_MOUTH. Walking straight at it would just grind your
    // banana into the net until you noticed and steered around yourself.
    if ((pos.y - NET_Y) * (by - NET_Y) < 0) {
      nextTgt = { x: bx, y: by };
      tgt.x = pos.x < (NET_X0 + NET_X1) / 2 ? NET_X0 - 26 : NET_X1 + 26;
      tgt.y = NET_Y;
      return;
    }
    nextTgt = null;
    tgt.x = bx; tgt.y = by;                                  // fetch it
  }

  function ballStep(dt, now) {
    // contact bump: still just walk into it — the thing you discover for free
    const d = Math.hypot(pos.x - ball.x, (pos.y - 8) - ball.y);
    if (d < 26 && ball.z < 60) bump(now);
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
    // THE NET, IN THE THREE BANDS THE ART ACTUALLY SHOWS:
    //   below gapZ  → under the net, through the real gap beneath the mesh
    //   gapZ..topZ  → into the mesh, bounced back
    //   above topZ  → a clean volley
    const crossed = (py0 - NET_Y) * (ball.y - NET_Y) < 0;
    if (crossed && ball.x > NET_X0 && ball.x < NET_X1) {
      if (ball.z < NET.gapZ) {
        // a dribbling ball genuinely rolls under — no bounce, but no rally
        // either. Only announce it if there was a rally worth losing, or a
        // ball nudging back and forth would spam the floats.
        if (rally) { rally = 0; showRally(); float(ball.x, ball.y - 14, 'under!'); }
      } else if (ball.z <= NET.topZ) {
        ball.y = py0 < NET_Y ? NET_Y - 7 : NET_Y + 7;
        ball.vy = -ball.vy * 0.55;
        ball.vz *= 0.4;                  // the mesh kills the arc, it drops
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
    depth(ballEl, ball.y);         // a ball in the far half passes behind the net
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
      // 🗺 THE MAP lives on his counter and rolls with the patches every night,
      // so the clue is always about TODAY's beach. It narrows the hunt to one
      // landmark without handing the spot over — you still dig the patch out.
      say(!treasureFound()
        ? '🗺 map says the sea buried something good ' + patches.treasureClue + '. dig it out.'
        : n >= 3
          ? 'ahoy! ' + n + ' spare shells in that pocket. i can work with that.'
          : CAP_LINES[capIdx++ % CAP_LINES.length], 6000);
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
    depth(c.el, c.y);              // critters sort against the props too
  }

  // ---- ⛏ THE DIG ----------------------------------------------------------
  // Trym's shape: patches are VISIBLE (so a cold visitor sees one and digs
  // within seconds — standalone-first), but a patch is an AREA to search, not
  // a prize. "it cant be one dig, one find… big enough patches so you actually
  // have to look for a while." So each patch holds several buried things at
  // seeded spots inside it, and digging between them turns up nothing but
  // sand. The empty holes ARE the content.
  //
  // ⚠️ PATCH SITES ARE HAND-PLACED, not random. Random points landed in the
  // sea, on the pier and inside the court. Hand-placing also buys the treasure
  // map its clue for free: every site already has a landmark name.
  const DIG_SITES = [
    { x: 402, y: 424, clue: 'where the wet sand remembers the tide' },
    { x: 596, y: 1042, clue: 'south of the old fire ring' },
    { x: 1298, y: 402, clue: 'up where the sea comes closest' },
    { x: 1452, y: 906, clue: 'east of the court, past the towel' },
    { x: 1912, y: 1014, clue: 'below the pier, where nobody looks' },
    { x: 2166, y: 918, clue: 'in the lighthouse’s long shadow' },
    { x: 2258, y: 430, clue: 'the far corner, where the rocks sit' },
    { x: 906, y: 1064, clue: 'just south of the volley court' },
    { x: 352, y: 706, clue: 'between the boardwalk and the palms' },
  ];
  const PATCH_W = 156, PATCH_H = 104;
  const DIG_REACH = 46;            // how near a buried spot a dig has to land
  const DIG_PATCHES = 5;           // sites the tide turns over each night
  // 🏴 the loot. ⚠️ NO COINS, EVER — bananacoins are one faucet (the rave) and
  // a diggable money source would inflate every price in the stand. The beach
  // pays in collection and comedy, which is the whole point of it.
  const DIG_JUNK = ['an old boot', 'a bent fork', 'one flip-flop', 'a rusted tin',
    'somebody’s lost sunglasses', 'a very annoyed crab', 'half a frisbee'];
  const DIG_CURIO = ['sea glass', 'a ship’s key', 'a worn doubloon', 'a shark’s tooth'];
  // 🧰 THE CHEST — one a day, and it is often empty.
  // ⚠️ THIS IS THE ONE PLACE OUTSIDE THE RAVE THAT MINTS COINS, and it only
  // stays harmless because it is HARD-CAPPED AND DATE-SEEDED: a single chest
  // per day, at most CHEST_MAX coins, contents fixed by the date so nobody can
  // re-roll it. That is a bounded daily bonus, not a second faucet — the stand's
  // 13 prices are balanced against the rave's drop rate, and an ungated dig
  // payout would quietly devalue every one of them. Keep the cap load-bearing:
  // if this ever becomes grindable or uncapped, the shop economy goes with it.
  const CHEST_MAX = 20;
  const CHEST_EMPTY_ODDS = 0.3;      // a third of chests are a joke, on purpose
  // ⭐ Split the haul across SLOTS. 12 coins shown as 4 piles reads as a find;
  // the same 12 as one number reads as a receipt. Same payout, more occasion.
  function chestLoot() {
    if (digRnd() < CHEST_EMPTY_ODDS) return [];
    const slots = 2 + Math.floor(digRnd() * 3);          // 2-4 piles
    const total = 6 + Math.floor(digRnd() * (CHEST_MAX - 5));
    const cut = [];
    let left = total;
    for (let i = 0; i < slots; i++) {
      const take = i === slots - 1 ? left : Math.max(1, Math.round(left / (slots - i) * (0.7 + digRnd() * 0.6)));
      cut.push(Math.min(left, take));
      left -= cut[i];
      if (left <= 0) break;
    }
    return cut.filter((n) => n > 0);
  }
  const digDay = Math.floor(Date.now() / 86400000);
  // ⚠️ seedRand(n) is ONE-SHOT — it maps a seed to a number, it is NOT a
  // generator (the shells call it once per spot with a stepped seed). Walking
  // a counter through it gives the deterministic STREAM this needs; calling
  // the result threw and silently killed init on the first attempt.
  let digSeq = 0;
  const digRnd = () => seedRand(digDay * 7919 + 31 + (digSeq++) * 131);
  const patches = [];
  (() => {
    const pool = DIG_SITES.slice();
    for (let i = pool.length - 1; i > 0; i--) {      // seeded shuffle
      const j = Math.floor(digRnd() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const chosen = pool.slice(0, DIG_PATCHES);
    const treasureIn = Math.floor(digRnd() * chosen.length);
    const bottleIn = Math.floor(digRnd() * chosen.length);   // may share a patch
    chosen.forEach((site, i) => {
      const n = 4 + Math.floor(digRnd() * 3);         // 4-6 things buried here
      const spots = [];
      for (let k = 0; k < n; k++) {
        spots.push({
          x: site.x + (digRnd() - 0.5) * (PATCH_W - 40),
          y: site.y + (digRnd() - 0.5) * (PATCH_H - 30),
          // slot 0 is the treasure's, slot 1 the bottle's — n is 4-6 so both
          // always exist, and exactly one of each is buried per day
          kind: i === treasureIn && k === 0 ? 'treasure'
            : i === bottleIn && k === 1 ? 'chest'
              : digRnd() < 0.34 ? 'shell' : digRnd() < 0.55 ? 'curio' : 'junk',
          got: false,
        });
      }
      patches.push({ ...site, spots, holes: [], el: null });
    });
    // the map's clue points at the patch holding the day's treasure
    patches.treasureClue = chosen[treasureIn].clue;
  })();
  const DIG_KEY = 'bh-dig-' + digDay;
  try {                                              // holes persist for today
    const saved = JSON.parse(localStorage.getItem(DIG_KEY) || 'null');
    if (saved && saved.p) saved.p.forEach((h, i) => {
      if (!patches[i]) return;
      patches[i].holes = h.holes || [];
      (h.got || []).forEach((k) => { if (patches[i].spots[k]) patches[i].spots[k].got = true; });
    });
  } catch (e) {}
  function digSave() {
    try {
      localStorage.setItem(DIG_KEY, JSON.stringify({
        p: patches.map((p) => ({
          holes: p.holes,
          got: p.spots.map((s, k) => (s.got ? k : -1)).filter((k) => k >= 0),
        })),
      }));
    } catch (e) {}
  }
  const digWrap = document.getElementById('bhDigs');
  function digHole(p, x, y) {
    const h = document.createElement('div');
    h.className = 'bh-hole';
    h.style.left = pct(x, W);
    h.style.top = pct(y, H);
    digWrap.appendChild(h);
  }
  function paintDigs() {
    patches.forEach((p) => {
      const el = document.createElement('div');
      el.className = 'bh-patch';
      el.style.left = pct(p.x, W);
      el.style.top = pct(p.y, H);
      el.style.width = pct(PATCH_W, W);
      el.style.height = pct(PATCH_H, H);
      digWrap.appendChild(el);
      p.el = el;
      p.holes.forEach((h) => digHole(p, h[0], h[1]));
      if (p.spots.every((s) => s.got)) el.classList.add('is-spent');
    });
  }
  const patchAt = (x, y) => patches.find((p) =>
    Math.abs(x - p.x) < PATCH_W / 2 && Math.abs(y - p.y) < PATCH_H / 2);
  let digAt = 0;
  function dig() {
    const now = performance.now();
    if (now - digAt < 420) return;
    const p = patchAt(pos.x, pos.y);
    if (!p) return;
    digAt = now;
    p.holes.push([Math.round(pos.x), Math.round(pos.y)]);
    digHole(p, pos.x, pos.y);
    meEl.animate([{ transform: 'translate(-50%,-100%) scale(1,0.86)' },
      { transform: 'translate(-50%,-100%) scale(1,1)' }], { duration: 260, easing: 'ease-out' });
    // the nearest thing still buried within reach — otherwise, just sand
    let best = null, bd = DIG_REACH;
    p.spots.forEach((s) => {
      if (s.got) return;
      const d = Math.hypot(s.x - pos.x, s.y - pos.y);
      if (d < bd) { bd = d; best = s; }
    });
    if (!best) {
      float(pos.x, pos.y - 26, 'just sand…');
      digSave();
      return;
    }
    best.got = true;
    if (best.kind === 'treasure') {
      float(pos.x, pos.y - 30, '🏴 THE TREASURE!');
      sandySay('you found it! that’s what the map was on about.', 5200);
      passStat('bh_treasure', 1);
      track('beach_dig', { find: 'treasure' });
    } else if (best.kind === 'chest') {
      openChest();
      track('beach_dig', { find: 'chest' });
    } else if (best.kind === 'shell') {
      const id = SHELL_IDS[Math.floor(Math.random() * SHELL_IDS.length)];
      passStat('sh_' + id, 1);
      float(pos.x, pos.y - 30, '🐚 ' + shellName(id));
      refreshShellChip();
      track('beach_dig', { find: 'shell' });
    } else if (best.kind === 'curio') {
      const c = DIG_CURIO[Math.floor(Math.random() * DIG_CURIO.length)];
      passStat('bh_curio', 1);
      float(pos.x, pos.y - 30, '✨ ' + c);
      track('beach_dig', { find: 'curio' });
    } else {
      float(pos.x, pos.y - 30, DIG_JUNK[Math.floor(Math.random() * DIG_JUNK.length)]);
      track('beach_dig', { find: 'junk' });
    }
    passStat('bh_dug', 1);
    if (p.spots.every((s) => s.got)) p.el.classList.add('is-spent');
    digSave();
  }
  // 🧰 the chest popup: slots of coins you TAKE, or a chest full of nothing
  const chestPanel = document.getElementById('bhChestPanel');
  const chestSlots = document.getElementById('bhChestSlots');
  const chestSub = document.getElementById('bhChestSub');
  const chestBtn = document.getElementById('bhChestBtn');
  let chestHaul = 0;
  function openChest() {
    const cut = chestLoot();
    chestHaul = cut.reduce((a, c) => a + c, 0);
    chestSlots.innerHTML = '';
    if (!chestHaul) {
      chestSub.textContent = 'sand. just sand, all the way down.';
      chestSlots.innerHTML = '<div class="bh-slotempty">empty</div>';
      chestBtn.textContent = 'well. that’s the sea for you';
    } else {
      chestSub.textContent = 'buried treasure, and it’s yours.';
      cut.forEach((n) => {
        const d = document.createElement('div');
        d.className = 'bh-cslot';
        d.innerHTML = '<img src="/assets/banana-stand/coin.png" width="30" alt="" />'
          + '<b>' + n + '</b>';
        chestSlots.appendChild(d);
      });
      chestBtn.textContent = 'take the ' + chestHaul + ' coins';
    }
    chestPanel.hidden = false;
    float(pos.x, pos.y - 30, '🧰 a chest!');
    passStat('bh_chest', 1);
  }
  chestBtn.addEventListener('click', () => {
    if (chestHaul) {
      // ⚠️ the wallet is a pass STAT pair: balance = coins_earned − coins_spent
      passStat('coins_earned', chestHaul);
      float(pos.x, pos.y - 34, '+' + chestHaul + ' coins');
      track('beach_chest', { coins: chestHaul });
      chestHaul = 0;
    }
    chestPanel.hidden = true;
  });
  const digBtn = document.getElementById('bhDigBtn');
  digBtn.addEventListener('click', (e) => { e.stopPropagation(); dig(); });
  paintDigs();
  const treasureFound = () => patches.some((p) =>
    p.spots.some((s) => s.kind === 'treasure' && s.got));

  // ---- 🏐 SANDY, the court's resident -------------------------------------
  // The solo problem in one line: with a solid net, a lap around a pole is
  // 4.2s, so you could never return your own shot — you served, watched, and
  // jogged. Sandy IS the loop. He's written as a partner, not a rival: he
  // returns almost everything (HIT_SANDY), keeps no score, and the rally
  // counter climbs because of him. A rival who beat you would end the game.
  const SANDY_DRAW = {
    hat: 'none', glasses: 'visor', extras: {},
    top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
  };
  const SANDY_HOME = { x: 930, y: 946 };      // his half is the NEAR one
  const SANDY_FIRE = { x: 566, y: 748 };      // beside the firepit, off court
  const SANDY_SPEED = 152;                    // a shade under yours (168)
  const sandyEl = document.getElementById('bhSandy');
  const sandyCtx = document.getElementById('bhSandyCv').getContext('2d');
  const sandyBubble = document.getElementById('bhSandyBubble');
  const sandy = {
    x: SANDY_HOME.x, y: SANDY_HOME.y, tx: SANDY_HOME.x, ty: SANDY_HOME.y,
    last: 0, away: false, greeted: false, idx: 0, timer: 0,
  };
  const SANDY_LINES = [
    'no score, no pressure. just keep it up with me a while.',
    'send it anywhere. i’ll get it.',
    'if it goes in the net that’s the net’s fault, not yours.',
    'i’ve been out here since the tide went out. i’ll be here after it comes back.',
    'nice one. i barely had to move.',
  ];
  function sandySay(text, ms) {
    sandyBubble.textContent = text;
    sandyBubble.classList.add('is-on');
    clearTimeout(sandy.timer);
    sandy.timer = setTimeout(() => sandyBubble.classList.remove('is-on'), ms || 4200);
  }
  // ⚠️ B2 HOOK: Sandy steps aside once the court is a TWO-banana court —
  // Trym's rule. Multiplayer isn't built yet, so peers is always 0 and the
  // rule is dormant; when the BeachRoom lands it only has to keep this number
  // up to date. ?beachtest can set it, so the behaviour is testable today.
  let peersInCourt = 0;
  const inCourt = (x, y) => x > CT.x0 && x < CT.x1 && y > CT.y0 && y < CT.y1;
  const courtBananas = () => (inCourt(pos.x, pos.y) ? 1 : 0) + peersInCourt;
  // where the ball will touch down, so he moves to meet it instead of chasing
  function ballLanding() {
    const t = (ball.vz + Math.sqrt(Math.max(0, ball.vz * ball.vz + 2 * GRAV * ball.z))) / GRAV;
    return { x: ball.x + ball.vx * t, y: ball.y + ball.vy * t };
  }
  function sandyTick(dt, now) {
    const busy = courtBananas() >= 2;
    if (busy !== sandy.away) {
      sandy.away = busy;
      sandySay(busy
        ? 'two of you! i’ll be by the fire. shout if you want a third.'
        : 'back then. whenever you’re ready.');
    }
    if (sandy.away) {
      sandy.tx = SANDY_FIRE.x; sandy.ty = SANDY_FIRE.y;
    } else if (ball.y > NET_Y - 10) {           // it's coming to his half
      const lp = ballLanding();
      const px = lp.y > NET_Y ? lp.x : ball.x;
      const py = lp.y > NET_Y ? lp.y : ball.y;
      sandy.tx = Math.max(CT.x0 + 34, Math.min(CT.x1 - 34, px));
      sandy.ty = Math.max(NET_Y + 40, Math.min(CT.y1 - 30, py + 14));
    } else {
      sandy.tx = SANDY_HOME.x; sandy.ty = SANDY_HOME.y;
    }
    const dx = sandy.tx - sandy.x, dy = sandy.ty - sandy.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {                                 // same axis-slide as you get
      const m = Math.min(d, SANDY_SPEED * dt);
      const nx = sandy.x + (dx / d) * m, ny = sandy.y + (dy / d) * m;
      if (!blocked(nx, ny)) { sandy.x = nx; sandy.y = ny; }
      else if (!blocked(nx, sandy.y)) sandy.x = nx;
      else if (!blocked(sandy.x, ny)) sandy.y = ny;
    }
    if (!sandy.away && ball.y > NET_Y && ball.z < 60 && now - sandy.last > 340
        && Math.hypot(sandy.x - ball.x, (sandy.y - 8) - ball.y) < 32) {
      sandy.last = now;
      bumpFrom(sandy.x, sandy.y - 8, HIT_SANDY);
    }
    // he greets you when you first step onto the court, then resets when you
    // wander off, so he's pleased to see you rather than nagging
    const onCourt = inCourt(pos.x, pos.y);
    if (onCourt && !sandy.greeted && !sandy.away) {
      sandy.greeted = true;
      sandySay(SANDY_LINES[sandy.idx++ % SANDY_LINES.length]);
      track('beach_sandy');
    } else if (!onCourt && sandy.greeted) sandy.greeted = false;
    sandyEl.style.left = pct(sandy.x, W);
    sandyEl.style.top = pct(sandy.y, H);
    depth(sandyEl, sandy.y);
    sandyBubble.style.left = pct(sandy.x, W);
    sandyBubble.style.top = pct(sandy.y - 88, H);
  }
  function drawSandy() { drawComposite(sandyCtx, 150, frameNow(), SANDY_DRAW); }

  // ---- 🎡 THE MIDWAY ------------------------------------------------------
  // Stalls are VIEW STATES, not routes. A route per stall would re-parse a
  // bundle and throw away the loaded assets, wallet and session every time you
  // stepped up to a counter (see the per-surface JS budget doctrine). This
  // swaps a panel in over the live world instead — instant, and the beach is
  // still there behind you.
  // ⭐ SAME FRAME, DIFFERENT GAME: every stall gets the identical shell —
  // name, tickets, odds, cost, PLAY, leave — and only the middle changes. The
  // second stall then teaches itself, and stall #6 costs almost nothing.
  const STALL_DEFS = [
    { id: 'duck', name: 'Hook-a-Duck', sign: '🦆', cost: 5,
      blurb: 'pick a duck. the number underneath is yours.' },
    { id: 'crab', name: 'Whack-a-Crab', sign: '🦀', soon: true },
    { id: 'coco', name: 'Coconut Shy', sign: '🥥', soon: true },
    { id: 'prize', name: 'The Prize Counter', sign: '🏆' },
  ];
  // 🏆 PRIZES ARE TROPHIES, NOT FASHION. The stand is where you choose how you
  // look; this is where you show what you did. That distinction is the entire
  // reason tickets exist as a separate currency — a hat you bought says
  // nothing, a giant plush says you played the pier for weeks.
  const PRIZES = [
    { id: 'pinwheel', name: 'paper pinwheel', icon: '🎡', tix: 8 },
    { id: 'goldfish', name: 'goldfish in a bag', icon: '🐠', tix: 14 },
    { id: 'sunhat', name: 'novelty sun hat', icon: '👒', tix: 22 },
    { id: 'ring', name: 'inflatable ring', icon: '🛟', tix: 34 },
    { id: 'shades', name: 'holiday shades', icon: '🕶️', tix: 48 },
    { id: 'trophy', name: 'plastic trophy', icon: '🏆', tix: 70 },
  ];
  // the one on the top shelf. Deliberately far away — it's the thing you keep
  // looking at, which is what gives the whole midway a direction.
  const GRAND = { id: 'plush', name: 'THE GIANT PLUSH BANANA', icon: '🍌', tix: 150 };
  const ownsPrize = (id) => ((passGet().stats || {})['prize_' + id] || 0) > 0;
  // 🎟 TICKETS — deliberately NOT coins. Coins are the world's one economy and
  // the stand's 13 prices are balanced against them; tickets can only ever be
  // spent here, so midway payouts can be tuned freely without touching that.
  const ticketBal = () => {
    const s = passGet().stats || {};
    return Math.max(0, (s.tickets || 0) - (s.tickets_spent || 0));
  };
  const coinBal = () => {
    const s = passGet().stats || {};
    return Math.max(0, (s.coins_earned || 0) - (s.coins_spent || 0));
  };
  // ⚖️ ODDS ARE POSTED, not hidden. A ticket only means something if you can
  // see what it's worth — that's the line between an arcade and a slot machine.
  const DUCK_TABLE = [
    { n: 1, w: 40 }, { n: 2, w: 30 }, { n: 3, w: 18 }, { n: 6, w: 9 }, { n: 15, w: 3 },
  ];
  function rollDuck() {
    let r = Math.random() * 100;
    for (const row of DUCK_TABLE) { r -= row.w; if (r <= 0) return row.n; }
    return 1;
  }

  const stallPanel = document.getElementById('bhStallPanel');
  const stallName = document.getElementById('bhStallName');
  const stallTickets = document.getElementById('bhStallTickets');
  const stallBody = document.getElementById('bhStallBody');
  const stallFoot = document.getElementById('bhStallFoot');
  let openStallIdx = -1;

  function closeStall() {
    openStallIdx = -1;
    stallPanel.hidden = true;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  document.getElementById('bhStallClose').addEventListener('click', closeStall);

  function paintTickets() { stallTickets.textContent = '🎟 ' + ticketBal(); }

  function openStall(i) {
    const def = STALL_DEFS[i];
    if (!def) return;
    openStallIdx = i;
    stallName.textContent = def.sign + ' ' + def.name;
    paintTickets();
    stallPanel.hidden = false;
    history.replaceState(null, '', '#' + def.id);   // linkable, back-button safe
    track('beach_stall', { stall: def.id });
    if (def.soon) {
      stallBody.innerHTML = '<p class="bh-stallsoon">the boards are up but the '
        + 'games aren’t in yet. come back.</p>';
      stallFoot.innerHTML = '';
      return;
    }
    if (def.id === 'prize') prizeCounter();
    else duckRound(false);
  }

  // ---- 🏆 the prize counter -----------------------------------------------
  function prizeCounter() {
    const tix = ticketBal();
    stallBody.innerHTML = '<p class="bh-stallblurb">tickets only. no coins — '
      + 'these have to be won.</p><div class="bh-prizes">'
      + PRIZES.map((p) => {
        const owned = ownsPrize(p.id);
        return '<div class="bh-prize' + (owned ? ' is-owned' : '') + '">'
          + '<i>' + p.icon + '</i><b>' + p.name + '</b>'
          + (owned ? '<span class="bh-got">won</span>'
            : '<button class="bh-take" data-p="' + p.id + '"'
              + (tix < p.tix ? ' disabled' : '') + '>🎟 ' + p.tix + '</button>')
          + '</div>';
      }).join('') + '</div>';
    stallFoot.innerHTML = '<span class="bh-stallhint">the big one is in the '
      + 'claw machine, out at the end of the pier.</span>';
    [...stallBody.querySelectorAll('.bh-take')].forEach((b2) => {
      b2.addEventListener('click', () => {
        const p = PRIZES.find((q) => q.id === b2.dataset.p);
        if (!p || ticketBal() < p.tix || ownsPrize(p.id)) return;
        passStat('tickets_spent', p.tix);
        passStat('prize_' + p.id, 1);
        track('beach_prize', { prize: p.id, tickets: p.tix });
        paintTickets();
        prizeCounter();
      });
    });
  }

  // ---- 🕹 THE GRABBER ------------------------------------------------------
  // ⭐ GAMBLE SMALL, GUARANTEE BIG. The grab is THEATRE, not chance: you save,
  // you pay, the claw descends, and you get the thing. Never let RNG eat weeks
  // of saving — chance belongs in the 5-coin stalls where a loss costs nothing.
  function openGrabber() {
    openStallIdx = 99;
    stallName.textContent = '🕹 The Grabber';
    paintTickets();
    stallPanel.hidden = false;
    history.replaceState(null, '', '#grabber');
    track('beach_grabber_open');
    const has = ticketBal(), own = ownsPrize(GRAND.id);
    const pct2 = Math.min(100, Math.round(has / GRAND.tix * 100));
    stallBody.innerHTML = '<div class="bh-glass"><div class="bh-claw"></div>'
      + '<div class="bh-grand">' + GRAND.icon + '</div></div>'
      + '<p class="bh-grandname">' + GRAND.name + '</p>'
      + (own ? '<p class="bh-odds">it’s yours. it barely fits through the door.</p>'
        : '<div class="bh-bar"><span style="width:' + pct2 + '%"></span></div>'
          + '<p class="bh-odds">' + has + ' of ' + GRAND.tix + ' tickets · '
          + 'no luck involved — save enough and the claw never misses</p>');
    stallFoot.innerHTML = own ? ''
      : '<button class="bh-btn" id="bhGrab" type="button"'
        + (has < GRAND.tix ? ' disabled' : '') + '>'
        + (has < GRAND.tix ? 'not enough tickets yet' : 'GRAB IT — 🎟 ' + GRAND.tix)
        + '</button>';
    const g = document.getElementById('bhGrab');
    if (g) g.addEventListener('click', () => {
      if (ticketBal() < GRAND.tix || ownsPrize(GRAND.id)) return;
      passStat('tickets_spent', GRAND.tix);
      passStat('prize_' + GRAND.id, 1);
      track('beach_grabber_win');
      stallBody.querySelector('.bh-claw').classList.add('is-grabbing');
      stallFoot.innerHTML = '<span class="bh-stallhint">…</span>';
      setTimeout(() => {
        paintTickets();
        if (openStallIdx === 99) openGrabber();
      }, 1900);
    });
  }

  // ---- 🦆 hook-a-duck ------------------------------------------------------
  function duckRound(live) {
    const def = STALL_DEFS[0];
    stallBody.innerHTML = '<p class="bh-stallblurb">' + def.blurb + '</p>'
      + '<div class="bh-pond" id="bhPond"></div>'
      + '<p class="bh-odds">most ducks pay 1–3 · one in ten pays 6 · one in thirty pays 15</p>';
    const pond = document.getElementById('bhPond');
    for (let k = 0; k < 6; k++) {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'bh-duck' + (live ? ' is-live' : '');
      d.style.animationDelay = (-k * 0.31) + 's';
      d.disabled = !live;
      d.setAttribute('aria-label', 'duck ' + (k + 1));
      if (live) d.addEventListener('click', () => hookDuck(d), { once: true });
      pond.appendChild(d);
    }
    const bal = coinBal();
    stallFoot.innerHTML = live
      ? '<span class="bh-stallhint">pick one…</span>'
      : '<button class="bh-btn" id="bhStallPlay" type="button"'
        + (bal < def.cost ? ' disabled' : '') + '>'
        + (bal < def.cost ? 'you need ' + def.cost + ' coins' : 'play — ' + def.cost + ' coins')
        + '</button>';
    const play = document.getElementById('bhStallPlay');
    if (play) play.addEventListener('click', () => {
      if (coinBal() < def.cost) return;
      passStat('coins_spent', def.cost);
      track('beach_stall_play', { stall: def.id, cost: def.cost });
      duckRound(true);
    });
  }

  function hookDuck(el) {
    const won = rollDuck();
    el.classList.add('is-hooked');
    el.innerHTML = '<b>' + won + '</b>';
    [...document.querySelectorAll('.bh-duck')].forEach((d) => { d.disabled = true; });
    passStat('tickets', won);
    paintTickets();
    track('beach_stall_win', { stall: 'duck', tickets: won });
    stallFoot.innerHTML = '<span class="bh-stallhint">+' + won + ' tickets!</span>';
    setTimeout(() => { if (openStallIdx === 0) duckRound(false); }, 1500);
  }

  // the signs, hung over each stall in the world
  STALLS.forEach((s, i) => {
    const def = STALL_DEFS[i];
    if (!def) return;
    const sign = document.createElement('div');
    // ⚠️ NOT 'bh-sign' — that class is already the page's BANANA BAY title,
    // and reusing it silently restyled the heading.
    sign.className = 'bh-stallsign';
    sign.textContent = def.sign + ' ' + def.name;
    sign.style.left = pct(s.x, W);
    sign.style.top = pct(s.y - 150, H);
    sign.style.zIndex = String(100 + s.y + 1);   // rides with its stall
    world.appendChild(sign);
  });
  // the grabber's own sign, out at the end of the pier
  (() => {
    const sign = document.createElement('div');
    sign.className = 'bh-stallsign';
    sign.textContent = '🕹 The Grabber';
    sign.style.left = pct(GRABBER.x, W);
    sign.style.top = pct(GRABBER.y - 158, H);
    sign.style.zIndex = String(100 + GRABBER.y + 1);
    world.appendChild(sign);
  })();

  // tapping a stall: step up to the counter, or open it if you're already there
  function tapGrabber(wx, wy) {
    if (Math.abs(wx - GRABBER.x) < 60 && wy > GRABBER.y - 155 && wy < GRABBER.y + 20) {
      // you have to walk the pier to it — that's the point of putting it there
      if (Math.hypot(pos.x - GRABBER.x, pos.y - (GRABBER.y + 60)) < 130) openGrabber();
      else { nextTgt = { x: GRABBER.x, y: GRABBER.y + 60 }; tgt.x = PIER_MOUTH.x; tgt.y = PIER_MOUTH.y; }
      return true;
    }
    return false;
  }
  function tapStall(wx, wy) {
    const i = STALLS.findIndex((s) => Math.abs(wx - s.x) < 82
      && wy > s.y - 140 && wy < s.y + 24);
    if (i < 0) return false;
    const s = STALLS[i];
    if (Math.hypot(pos.x - (s.x + 120), pos.y - s.y) < 150) openStall(i);
    else { nextTgt = null; tgt.x = s.x + 120; tgt.y = s.y; }   // stand on the sand
    return true;
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
      depth(meEl, pos.y);            // behind the net when your feet are past it
      if (pos.x > 300) roadArmed = true;
      if (roadArmed && pos.x < 40 && pos.y > 1040) exitToPark();
    }
    ballStep(dt, now);
    shellTick();
    capTick(now);
    crabs.forEach((c) => crabStep(c, dt));
    sandyTick(dt, now);
    digBtn.classList.toggle('is-on', !!patchAt(pos.x, pos.y));
    cam();
    requestAnimationFrame(step);
  }

  // everyone in Banana World dances on the same wall clock
  const frameNow = () => {
    const cyc = BASE_CYCLE_S * 1000;
    return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES;
  };
  let lastF = -1;
  // 🪑 SITTING = a frozen frame, not a pose we have to draw. The engine's
  // cycle already turns the banana: frames 0-1 face right, 2-3 front, 4-5
  // left. Frame 4 is the LEFT-facing one at the lowest point of the bob, so
  // holding it reads as settled into the chair — side-on and still, while
  // everyone else keeps dancing. Costs one line and no new art.
  const SIT_FRAME = 4;
  function drawMe() {
    const f = seated ? SIT_FRAME : frameNow();
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
  depth(capEl, 688);        // behind the wreck's hull (base 740) = behind his bar
  capBubble.style.left = pct(1690, W);
  capBubble.style.top = pct(610, H);

  // ?beachtest = the QA hook (same family as ?cointest / ?nyantest): reach in
  // and place the ball or the banana without playing your way there
  if (/[?&]beachtest(?:=|&|$)/.test(location.search)) {
    window.__bay = { ball, pos, tgt, shells, SHELL_IDS, held, rallyOf: () => rally,
      bump, playBall, NET, GRAV, lastKickReset: () => { lastKick = 0; },
      sandy, HIT_SANDY, bumpFrom, sandyHome: SANDY_HOME, sandyFire: SANDY_FIRE,
      patches, dig, treasureClue: () => patches.treasureClue,
      // fake a second banana on the court so the B2 step-aside rule is
      // testable before multiplayer exists
      setPeers: (n) => { peersInCourt = n; } };
  }

  assetsReady().then(() => {
    drawMe(); drawCap(); drawSandy();
    setTimeout(() => { lastF = -1; drawMe(); drawCap(); drawSandy(); }, 700);   // redraw belt: accessories decode async
    setTimeout(() => { lastF = -1; drawMe(); drawCap(); drawSandy(); }, 1800);
    setInterval(() => { if (!document.hidden) { drawMe(); drawSandy(); } }, 120);
    requestAnimationFrame((t) => { last = t; step(t); });
  });
}

// the entry point, AFTER every module const above it (see the TDZ note up top)
if (view) init();
