// 🐿🦋🐔 THE PARK'S CRITTERS — acorns, butterflies, squirrels, the farm
// animals. Split from banana-park.js (P5); wired through the shared ctx.
import { poofInto } from '../lib/world.js';
import { passStat } from '../lib/banana-pass.js';
import { track, PARK_TEST, R, SVG } from './park-util.js';
import { BOUND, PLAZA, POND, MEADOW, TREE_OVS, OVERLAYS } from './park-geo.js';

// 🌰 the acorn — cap, warm body, inner shadow (banana-density pixel style)
const ACORN_SVG = SVG('11 13',
  R(4, 0, 3, 1, '#4a3018') + R(2, 1, 7, 1, '#6b4320') + R(1, 2, 9, 2, '#8a5a2b')
  + R(2, 2, 3, 1, '#a8742a') + R(2, 4, 7, 1, '#e0a84e') + R(1, 5, 9, 4, '#c9913a')
  + R(3, 5, 2, 3, '#e8b866') + R(2, 9, 7, 2, '#a8742a') + R(3, 11, 5, 1, '#8a5a2b')
  + R(5, 12, 1, 1, '#6b4320'));

// 🦋 the meadow's six — palette IS the species. Ambient life only (W1c):
// nothing is caught or kept, the variety is just so no two look alike.
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

// 🐔 THE ANIMALS (W2) — farm-pack wanderers, out in every bloom; their MOOD
// BUBBLE is the meter made visible (❤️ ≥3 · 😐 2 · 😢 ≤1). Strips = 6 walk
// frames facing right, frame 0 doubles as the standing pose. kind = cell
// shape: sq 36×36 (chickens) · tall 36×72 (rooster) · wide 72×72 (the
// ducks/rabbit sheets use 96-wide pack cells). Ducks keep the pond bank.
const ANIMALS = [
  { strip: 'chicken1', kind: 'sq', home: [1120, 650], r: 120 },
  { strip: 'chicken2', kind: 'sq', home: [1210, 730], r: 120 },
  { strip: 'rooster', kind: 'tall', home: [1050, 760], r: 140 },
  { strip: 'duck1', kind: 'wide', pond: true, w: 61, h: 61 },   // ducks at 0.85 (generator keeps in sync)
  { strip: 'duck2', kind: 'wide', pond: true, w: 61, h: 61 },
  { strip: 'rabbit', kind: 'wide', home: [2050, 720], r: 150 },
];
// ?parktest gathers the land animals by the plaza spawn (ducks stay pond-side)
const TEST_ANIMAL_HOMES = [[1270, 830], [1340, 890], [1440, 880], null, null, [1470, 820]];

// the bottom-centre anchor the pack sprites share (was in their CSS)
const SQ_ANCHOR = ' translate(-50%,-100%)';

export function initCritters(ctx) {
  const { W, H, world, pct, depth, blocked, onScreen, float, pos, tgt, refreshHud, place } = ctx;

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

  // ---- 🦋 BUTTERFLIES — phase-4 life, nothing kept ------------------------
  // Only a PERFECT park has butterflies (they poof away if the bloom drops).
  // Two flit over the meadow, one wanders. No catching, no atlas, no storage
  // (Trym W1c): walk up slowly and tap one and it startles off with a
  // sparkle. Rush one and it darts off too.
  try { localStorage.removeItem('pk_bfly'); } catch (e) {}   // the old collection
  const M_AREA = { x0: MEADOW[0] + 40, y0: MEADOW[1] + 30, x1: MEADOW[2] - 40, y1: MEADOW[3] - 30 };
  const ALL_AREA = PARK_TEST
    ? { x0: 1240, y0: 740, x1: 1520, y1: 900 }
    : { x0: BOUND + 60, y0: BOUND + 60, x1: W - BOUND - 60, y1: H - BOUND - 60 };
  const bflys = [{ area: M_AREA, gone: true }, { area: M_AREA, gone: true }, { area: ALL_AREA, gone: true }];
  let bflyOn = false;
  function setBflies(on) {
    if (on === bflyOn) return;
    bflyOn = on;
    bflys.forEach((b) => {
      if (on) { bflySpawn(b); return; }
      if (b.gone) return;
      poofInto(world, 'pk-poof', b.x / W * 100, (b.y - 26) / H * 100);
      b.el.remove();
      b.gone = true;
    });
  }
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
  function bflyTick(dt, now) {
    if (!bflyOn) return;
    for (const b of bflys) {
      if (b.gone) continue;
      const pd = Math.hypot(pos.x - b.x, pos.y - b.y);
      // barrelled at → it's off, well out of reach
      if (pd < 85 && ctx.pSpeed() > 115 && !b.fleeing) {
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
      place(b.el, b.x, b.y - 26 + bob, ' translate(-50%,-50%)' + (b.dir < 0 ? ' scaleX(-1)' : ''));
    }
  }
  function startleBfly(b) {
    float(b.x, b.y - 34, '✦');
    const ang = Math.atan2(b.y - pos.y, b.x - pos.x) + (Math.random() - 0.5);
    b.tx = Math.max(b.area.x0, Math.min(b.area.x1, b.x + Math.cos(ang) * 260));
    b.ty = Math.max(b.area.y0, Math.min(b.area.y1, b.y + Math.sin(ang) * 170));
    b.spd = 195;
    b.fleeing = true;
    b.perchUntil = 0;
  }
  function tapBfly(wx, wy) {
    const b = bflyOn && bflys.find((q) => !q.gone && Math.hypot(wx - q.x, wy - (q.y - 26)) < 46);
    if (!b) return false;
    if (Math.hypot(pos.x - b.x, pos.y - b.y) < 78) { startleBfly(b); return true; }
    // approach: stop SHORT of it, so the last steps are yours to take slowly
    const d = Math.hypot(b.x - pos.x, b.y - pos.y) || 1;
    tgt.x = b.x - ((b.x - pos.x) / d) * 55;
    tgt.y = b.y - ((b.y - pos.y) / d) * 55;
    return true;
  }

  // ---- 🐿 SQUIRRELS: locals, never interactive ----------------------------
  // The crab pattern: a home they orbit, darts with long stillnesses, a bolt
  // when you get close — and they never set foot on the plaza. Life
  // indicators (W1c): they only live in a nearly-bloomed park (phase ≥3)
  // and poof off if it drops.
  const inPlaza = (x, y) => {
    const ex = (x - PLAZA.x) / PLAZA.rx, ey = (y - PLAZA.y) / PLAZA.ry;
    return ex * ex + ey * ey < 1;
  };
  const SQ_HOMES = PARK_TEST ? [[1500, 880], [1180, 970]] : [[300, 640], [1180, 970]];
  const squirrels = [];
  let sqOn = false;
  function setSquirrels(on) {
    if (on === sqOn) return;
    sqOn = on;
    if (!on) {
      squirrels.forEach((s) => { poofInto(world, 'pk-poof', s.x / W * 100, (s.y - 8) / H * 100); s.el.remove(); });
      squirrels.length = 0;
      return;
    }
    SQ_HOMES.forEach(([hx, hy]) => {
      const el = document.createElement('div');
      el.className = 'pk-squirrel is-still';
      el.innerHTML = SQ_SVG;
      world.appendChild(el);
      place(el, hx, hy, SQ_ANCHOR);
      squirrels.push({ el, hx, hy, x: hx, y: hy, tx: hx, ty: hy,
        wait: Math.random() * 3, flee: 0, face: 1, still: true });
    });
  }
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
    place(s.el, s.x, s.y, SQ_ANCHOR + (s.face < 0 ? ' scaleX(-1)' : ''));
    depth(s.el, s.y);
  }
  function sqTick(dt) { squirrels.forEach((s) => sqStep(s, dt)); }

  // ---- 🐔 THE ANIMALS — the bloom made visible, on legs -------------------
  // Squirrel movement (home orbit, pause-walk-pause) minus the flee — these
  // are tame. Ducks orbit the POND BANK: targets are nearby angles on the
  // shore ring, so the chords never cut the water. The mood bubble pops ONCE
  // when an animal first walks into view, again on tap, and re-pops live
  // when the bloom crosses a mood border.
  const AN_SIZE = { sq: [36, 36], tall: [36, 72], wide: [72, 72] };
  // hearts-only mood language (Trym: no detailed stock-emoji faces in-world):
  // 💔 hurting park · nothing at mid · ❤️ thriving
  const MOOD_EMO = ['💔', '', '❤️'];
  const bandFor = (p) => (p >= 3 ? 2 : p === 2 ? 1 : 0);
  const animals = [];
  let moodBand = -1;
  const duckPoint = (a) => ({ x: POND.x + Math.cos(a) * (POND.rx + 30), y: POND.y + Math.sin(a) * (POND.ry + 26) });
  function anPick(a) {
    for (let t = 0; t < 8; t++) {
      if (a.pond) {
        const na = a.ang + (Math.random() * 1.2 - 0.6);
        const p = duckPoint(na);
        if (!blocked(p.x, p.y)) { a.ang = na; a.tx = p.x; a.ty = p.y; return; }
        continue;
      }
      const q = Math.random() * Math.PI * 2;
      const rr = 40 + Math.random() * a.r * 0.7;
      let tx = a.x + Math.cos(q) * rr, ty = a.y + Math.sin(q) * rr * 0.6;
      if (Math.hypot(tx - a.hx, ty - a.hy) > a.r) { tx = a.hx; ty = a.hy; }
      if (!blocked(tx, ty) && !inPlaza(tx, ty)) { a.tx = tx; a.ty = ty; return; }
    }
  }
  // ⚡ its own change-guard, which it never had: an animal at rest re-stated
  // where it already was on every frame it was called
  function anPlace(a) {
    if (a.px === a.x && a.py === a.y && a.pf === a.face) return;
    a.px = a.x; a.py = a.y; a.pf = a.face;
    place(a.el, a.x, a.y, SQ_ANCHOR + (a.face < 0 ? ' scaleX(-1)' : ''));
    depth(a.el, a.y);
  }
  function showMood(a) {
    const e = MOOD_EMO[bandFor(ctx.phase())];
    if (!e) { a.bub.classList.remove('is-on'); return; }   // mid band = no bubble
    a.bub.textContent = e;
    a.bub.classList.add('is-on');
    clearTimeout(a.bubTimer);
    a.bubTimer = setTimeout(() => a.bub.classList.remove('is-on'), 2500);
  }
  function anStep(a, dt) {
    if (a.wait > 0) {
      a.wait -= dt;
      if (!a.still) { a.still = true; a.el.classList.add('is-still'); }
      return;
    }
    const dx = a.tx - a.x, dy = a.ty - a.y;
    const d = Math.hypot(dx, dy);
    const sad = moodBand === 0;                  // mopey = slower, longer sulks
    if (d < 3) {
      // ☔ under its tree it just stays there until the rain passes
      if (a.shelter) { a.wait = 4; return; }
      a.wait = (sad ? 3.5 : 1.5) + Math.random() * (sad ? 5 : 3.5);
      anPick(a);
      return;
    }
    if (a.still) { a.still = false; a.el.classList.remove('is-still'); }
    const sp = (sad ? 26 : 46) * dt;
    const nx = a.x + (dx / d) * Math.min(d, sp);
    const ny = a.y + (dy / d) * Math.min(d, sp);
    if (!blocked(nx, ny) && (a.pond || !inPlaza(nx, ny))) { a.x = nx; a.y = ny; }
    else { a.wait = 0.6; anPick(a); return; }
    if (Math.abs(dx) > 4 && (dx < 0) !== (a.face < 0)) {
      a.face = dx < 0 ? -1 : 1;
      // counter-flip the bubble so the emote never mirrors with the body
      a.bub.style.transform = 'translate(-50%,-100%)' + (a.face < 0 ? ' scaleX(-1)' : '');
    }
    anPlace(a);
  }
  // 🌦 WEATHER: heavy rain sends every land animal to a tree — each to a
  // DIFFERENT one, scattered, some caught out in the open (Trym). A storm
  // takes them off the map entirely.
  // ⚠️ they shelter slightly ABOVE the tree's ground line, so the canopy
  // overlay (which sorts by its own base) draws OVER them. That overlap is the
  // whole read: standing level with the trunk looks like standing NEXT to a
  // tree, not under it.
  let wxNow = 'clear', hidden = false;
  function setWeather(k) {
    if (k === wxNow) return;
    const was = wxNow;
    wxNow = k;
    if (k === 'storm') {                       // gone
      if (!hidden) {
        hidden = true;
        animals.forEach((a) => {
          poofInto(world, 'pk-poof', a.x / W * 100, (a.y - 20) / H * 100);
          a.el.style.display = 'none';
        });
      }
      return;
    }
    if (hidden) { hidden = false; animals.forEach((a) => { a.el.style.display = ''; }); }
    if (k === 'heavy') {
      // one tree each, walked to in the normal way so it never teleports
      const trees = TREE_OVS.map((i) => [OVERLAYS[i][1] + OVERLAYS[i][3] / 2, OVERLAYS[i][5]]);
      animals.forEach((a, n) => {
        if (a.pond) return;                    // ducks love it, they stay out
        const t = trees[(n * 3 + 1) % trees.length];
        if (!t) return;
        a.tx = t[0] + (n % 2 ? 22 : -24);
        a.ty = t[1] - 16;                      // ABOVE the ground line = under the canopy
        a.wait = 0;
        a.shelter = true;
      });
    } else if (was === 'heavy') {
      animals.forEach((a) => { a.shelter = false; a.wait = 0.6 + Math.random() * 2; });
    }
  }

  function animalTick(dt) {
    for (const a of animals) {
      anStep(a, dt);
      if (!a.seen && ctx.phase() >= 0 && onScreen(a.x, a.y)) { a.seen = true; showMood(a); }
    }
  }
  function setAnimalMood(p) {
    const b = bandFor(p);
    if (b === moodBand) return;
    moodBand = b;
    animals.forEach((a) => {
      a.el.classList.toggle('is-sad', b === 0);
      if (a.seen && onScreen(a.x, a.y)) showMood(a);
    });
  }
  function tapAnimal(wx, wy) {
    const a = animals.find((q) => Math.abs(wx - q.x) < q.w * 0.7 && wy > q.y - q.h - 8 && wy < q.y + 10);
    if (!a) return false;
    showMood(a);
    return true;
  }
  ANIMALS.forEach((sp, i) => {
    const home = PARK_TEST && TEST_ANIMAL_HOMES[i] ? TEST_ANIMAL_HOMES[i] : sp.home;
    const el = document.createElement('div');
    el.className = 'pk-animal pk-animal--' + sp.kind + ' pk-animal--' + sp.strip + ' is-still';
    const bub = document.createElement('span');
    bub.className = 'pk-mood';
    el.appendChild(bub);
    world.appendChild(el);
    const a = {
      el, bub, pond: !!sp.pond,
      hx: home ? home[0] : 0, hy: home ? home[1] : 0, r: sp.r || 130,
      ang: Math.random() * 6.28, face: 1, still: true,
      wait: Math.random() * 3, seen: false, bubTimer: null,
      w: sp.w || AN_SIZE[sp.kind][0], h: sp.h || AN_SIZE[sp.kind][1],
    };
    if (a.pond) {   // land on a clear stretch of bank (the east shore has trees)
      let p = duckPoint(a.ang);
      for (let t = 0; t < 12 && blocked(p.x, p.y); t++) { a.ang = Math.random() * 6.28; p = duckPoint(a.ang); }
      a.x = p.x; a.y = p.y;
    } else { a.x = a.hx; a.y = a.hy; }
    a.tx = a.x; a.ty = a.y;
    anPlace(a);
    animals.push(a);
  });

  return {
    acornTick, bflyTick, tapBfly, setBflies,
    sqTick, setSquirrels,
    animalTick, setAnimalMood, tapAnimal, setWeather,
    qa: { acorns, bflys, squirrels, animals,
      // 🐔 mood QA: pop every animal's bubble right now
      mood: () => animals.forEach((a) => showMood(a)) },
  };
}
