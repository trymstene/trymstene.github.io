// 🌚 THE TOWN AT NIGHT — ghosts, cursed objects and the Curse Nights, in their own chunk (20 Sep 2026).
//
// This was 21 KB inside town-room.js, which had reached 98% of its 56 000 B cap with 1 188 bytes
// left. Nothing about the night changed in the move: the bodies below are the same lines, and the
// only edits are the ones the seam forces — closure reads that became getters because town-room
// REASSIGNS them (band, problems, curse, vendor, the sky element, plainNight, curseTold), and the
// writes that became setters for the same reason.
//
// ⚠️ IT IS LAZY, AND THE DAY CAN NEED IT. condition() asks for a wisp in DAYLIGHT when the town is
// low enough to draw one, so the gate is not simply "is it dark": town-room loads this the moment
// the evening beat arrives, a Curse Night is on, an omen is up, or the band wants a day ghost.
//
// ⚠️ AND kill() CANNOT REACH THE GHOST LIST ANY MORE. town-room's kill() is the generic sprite
// killer, called from about twenty places, and it used to splice the dead sprite out of `ghosts`
// itself. That array lives here now, so kill() calls `unghost(s)` instead and this file does the
// splicing — miss that and a killed ghost stays in the list for ever, haunting the step loop.
import { GHOSTS, NIGHT_GHOSTS, ROAM } from '../data/town/ghosts.js';
import { OBJECTS, WHERE, RARITY_W } from '../data/town/objects.js';
import { CURSE_SHELF } from '../data/town/stock.js';
import { PROBLEMS } from '../data/town/problems.js';
import { LOOK, NIGHT } from '../data/town/condition.js';
import { OB_RECTS, OB_CIRCLES } from './town-geo.js';
import { burstInto } from '../lib/world.js';
import { passStat } from '../lib/banana-pass.js';
import { grantToShed } from '../lib/homestead-inventory.js';

export function bootTownNight(ctx) {
  const {
    // tables and plain things, passed once
    DEX, W_OBJ, ANCHORS, W, H, pct, view, world, cond, life, weather, say, track, float,
    poof, burst, mark, sprite, show, kill, moveSprite, body, bodies, killBody, propOf, perchZ,
    glowProblem, setFull, lampsByHour, shutters, dayNum, found, weighted, h, one,
    fill, todayShut, keepFn, LAMP_HIT, litterRoom,
    // ⚠️ GETTERS, because town-room reassigns every one of these
    band, problems, curse, vendor, night, plainNight, curseTold,
    // …and setters, because a getter cannot stand on the left of an assignment
    setCurse, setVendor, setPlainNight, setCurseTold,
  } = ctx;
  // 🕯️ the candles that stand either side of a Curse Night's shelf. They were declared beside the
  // sky element in town-room, which stays behind — only the candles are the night's.
  let candles = [];
  // (`bananas` is declared by the slab itself, a little further down)

  const ghosts = [];   // { def, s, ... }
  const objects = [];  // { def, s, x, y, day }
  function ghostOf(id, def0, set) {   // set: one of a night's set — one of each, over a plain night's; an omen's or a day's wisp is its own
    const def = def0 || GHOSTS.find((g) => g.id === id); if (!def) return null;
    const out = set && ghosts.find((g) => g.def.id === id && !g.done && g.night); if (out) return out.s;
    const at = def.at || def.from || (def.path && def.path[0]) || [1100, 950];
    const s = sprite(def.art, at[0], at[1], { fps: def.fps || 6, cls: 'is-fade is-haunt', mode: def.loop || def.id === 'wisp' ? 'once' : 'loop', z: def.z });   // is-haunt: the curse's purple, weaker than a cursed object's; z: in front of what it sits on
    if (!s) return null;
    const g = { def, s, x: at[0], y: at[1], dir: 1, hideT: 0, done: false, night: !!set };
    if (s.n === 32) faceGhost(g, s, 0, 1);   // the four-facing stack starts facing front
    if (def.id === 'wisp' || def.loop) s.onDone = () => { g.hideT = 2 + Math.random() * 3; };
    ghosts.push(g);
    return s;
  }
  // the friendly ghost's four facings (ghosts.js): the stack's frame window follows the way it goes
  function faceGhost(g, s, dx, dy) {
    const f = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'front' : 'back');
    if (f === g.face) return;
    g.face = f; const lo = { right: 0, back: 8, left: 16, front: 24 }[f]; s.lo = lo; s.hi = lo + 7; show(s, lo);
  }
  // ⚠️ a ghost's own x/y must move WITH its sprite: moveSprite() alone left g.x where it began, so every
  // walking ghost took one step from its start each tick and jittered in place (found 15 Sep)
  // a roamer's way is clear when no sample of the straight line falls inside a BIG solid (a building, the fountain):
  // a ghost may pass behind a bench, never through the town hall (the eye caught one inside the fountain, 15 Sep)
  const BIG = OB_RECTS.filter((r) => (r[2] - r[0]) * (r[3] - r[1]) > 14400);
  function clearWay(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 30);
    for (let i = 1; i < n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (BIG.some((r) => x > r[0] && x < r[2] && y > r[1] && y < r[3]) || OB_CIRCLES.some((c) => Math.hypot(x - c[0], y - c[1]) < c[2] + 24)) return false; }
    return true;
  }
  // 🍌 the bananas a ghost keeps away from: yours (live), the residents out tonight and other players' (cached twice a second)
  let bananas = [];
  function nearestBanana(x, y) {
    let best = { x: ctx.pos.x, y: ctx.pos.y, d: Math.hypot(ctx.pos.x - x, ctx.pos.y - y) };
    for (const b of bananas) { const d = Math.hypot(b.x - x, b.y - y); if (d < best.d) best = { x: b.x, y: b.y, d }; }
    return best;
  }
  // a roamer's next waypoint: reachable on a clear line, and by preference far from every banana
  // 💡 ⭐ A GHOST GOES FOR THE LIGHTS (Trym, 21 Sep: "maybe you actually see ghosts ruin the
  // streetlights aswell, they are causing it and frequently targets the streetlights?").
  //
  // They always COULD snuff a lamp — but only one that happened to be within 130 px of wherever they
  // chose to rest, and they chose at random over the whole square. So a night's lamps came down to
  // luck, and most nights it was none of them: the cause was never on screen, and the morning
  // looked the same as the evening. Now most rests are AIMED at a lit lamp, so you watch one drift
  // to a streetlight, hang there, and put it out.
  //
  // ⚠️ NOT ALWAYS, and that is deliberate: a ghost that only ever walks lamp to lamp is a machine
  // with a route. One rest in three is still wherever it likes, which is what keeps it a wanderer.
  const LAMP_HUNT = 0.66;
  function wayNearLamp(g) {
    const lit = ANCHORS.lamps.filter((k) => cond.lamps[k] === 'ok' && !problems().some((q) => q.key === k));
    if (!lit.length) return null;
    // the waypoints that sit within snuffing reach of a lamp that is still burning
    const spots = [];
    for (const k of lit) {
      const [lx, ly] = footOf(k);
      for (const w of ROAM) {
        const dd = Math.hypot(w[0] - g.x, w[1] - g.y);
        if (dd > 40 && dd < 700 && Math.hypot(w[0] - lx, w[1] - ly) < 120
          && nearestBanana(w[0], w[1]).d > 160 && clearWay(g.x, g.y, w[0], w[1])) spots.push(w);
      }
    }
    return spots.length ? spots[Math.floor(Math.random() * spots.length)] : null;
  }
  function pickWay(g) {
    if (Math.random() < LAMP_HUNT) { const w = wayNearLamp(g); if (w) return w; }
    const can = ROAM.filter((w) => { const dd = Math.hypot(w[0] - g.x, w[1] - g.y); return dd > 40 && dd < 700 && clearWay(g.x, g.y, w[0], w[1]); });
    const far = can.filter((w) => nearestBanana(w[0], w[1]).d > 160);
    const from = far.length ? far : can.length ? can : ROAM;
    return from[Math.floor(Math.random() * from.length)];
  }
  // …and when a banana comes close: the waypoint that puts the most ground between them
  function awayFrom(g, b) {
    const can = ROAM.filter((w) => Math.hypot(w[0] - b.x, w[1] - b.y) > b.d + 60 && Math.hypot(w[0] - g.x, w[1] - g.y) < 700 && clearWay(g.x, g.y, w[0], w[1]));
    can.sort((p, q) => Math.hypot(q[0] - b.x, q[1] - b.y) - Math.hypot(p[0] - b.x, p[1] - b.y));
    return can.length ? can[Math.floor(Math.random() * Math.min(3, can.length))] : null;
  }
  // 👻 MISCHIEF (Trym, 15 Sep: "the ghosts spread garbage and fixes needed so you have to clean up more after
  // them"): at a waypoint a roamer may snuff a lit lamp near it, tip an empty bin or dumpster, or drop litter
  // where it hovers — each a problem of yours, paid like any other. A few per ghost per night, never a flood.
  const MESS_CAP = 6;
  let messN = 0;
  const footOf = (k) => { const p = propOf(k); return p ? [p.x + p.w / 2, p.base] : [-1e9, -1e9]; };
  const rowOf = (id) => PROBLEMS.find((r) => r.id === id);
  // ⚠️ A LAMP'S PROBLEM IS SHAPED LIKE A LAMP, on this path too. The reseed gives one a lift of 118
  // and a tap box 190 tall reaching down to its foot; this path gave every problem the same default,
  // so a lamp a ghost had just put out could not be tapped anywhere near its own repair icon — the
  // closed-door rule again, and the second time in this class. The numbers come from town-room.js so
  // there is exactly one copy of them (design library §24).
  function addProblem(t, key, x, y, z, icon) {
    const lamp = t.on === 'lamps' && LAMP_HIT;
    const p = { id: t.id + ':' + key, type: t.id, x, y, key, pays: t.pays, rep: t.rep,
      el: mark(x, y, lamp ? LAMP_HIT.lift : 150, z, icon), sprite: null, foot: y };
    if (lamp) { p.grab = LAMP_HIT.grab; p.tall = LAMP_HIT.tall; }
    problems().push(p); return p;
  }
  function mischief(g, force) {
    if ((g.mess || 0) >= MESS_CAP) return null;   // every rest makes something, up to the cap (15 Sep: too slow to matter before)
    // the mess lands on the waypoint it rests at (every one measured in the open), never mid-way behind a bench
    const [gx, gy] = ROAM.reduce((a, w) => (Math.hypot(w[0] - g.x, w[1] - g.y) < Math.hypot(a[0] - g.x, a[1] - g.y) ? w : a), ROAM[0]);
    const near = (k) => { const [x, y] = footOf(k); return Math.hypot(x - gx, y - gy) < 130; };
    const free = (k) => !problems().some((q) => q.key === k);
    let did = null;
    const lamp = ANCHORS.lamps.find((k) => cond.lamps[k] === 'ok' && free(k) && near(k));
    const bin = [...ANCHORS.bins, ...ANCHORS.dumps].find((k) => !cond.full.has(k) && free(k) && near(k));
    // ⚠️ 0.5 → 0.85: it came all this way. A ghost that drifts to a streetlight and then flips a
    // coin over it reads as a ghost doing nothing, which is half of what made the nights dull.
    if (lamp && Math.random() < 0.85) {
      cond.lamps[lamp] = 'out'; lampsByHour();
      const p0 = propOf(lamp); addProblem(rowOf('lamp'), lamp, p0.x + p0.w / 2, p0.base + 4, 100 + p0.base + 3, true); poof(p0.x + p0.w / 2, p0.base - 40); did = 'lamp';
    } else if (bin && Math.random() < 0.5) {
      setFull(bin, true);
      const p0 = propOf(bin), t = rowOf(ANCHORS.dumps.includes(bin) ? 'dumpster' : 'bin');
      glowProblem(addProblem(t, bin, p0.x + p0.w / 2, p0.base + 4, 100 + p0.base + 3, false)); did = t.id;
    } else {
      // 🗑 A GHOST DROPS RUBBISH WHERE THERE IS ROOM FOR IT, or it does not drop any. This threw a
      // sprite down at the waypoint ±20 px whatever was already there, and a ghost that rests twice at
      // the same bench built a heap of three bin bags on one patch — which reads as a broken sprite, not
      // as a mess. Trym, 20 Sep: "now i see often garbage sprites totally overlap, and it shouldnt."
      // It tries a few spots around the waypoint and gives up rather than stack.
      const kind = ['pile', 'trash1', 'trash2', 'trash3'][Math.floor(Math.random() * 4)];
      let x = 0, y = 0, room = false;
      for (let tries = 0; tries < 8 && !room; tries++) {
        const r = 24 + tries * 22, a = Math.random() * Math.PI * 2;
        x = Math.round(gx + Math.cos(a) * r); y = Math.round(gy + 8 + Math.sin(a) * r * 0.5);
        room = !litterRoom || litterRoom(x, y, kind);
      }
      if (!room) return null;   // nowhere to put it: this ghost simply does not litter this time
      const p = addProblem(rowOf('litter'), 'g' + (messN++), x, y, null, false);
      p.sprite = sprite(kind, x, y); glowProblem(p); poof(x, y - 6); did = 'litter';
    }
    g.mess = (g.mess || 0) + 1;
    return did;
  }
  // 👋 CAUGHT: walked into, a ghost un-forms — the pack's own forming frames played backwards — in a purple burst;
  // the tall grey one flies up and scatters on its own last frames. It keeps away a while, then forms again where
  // it stands (Trym, 15 Sep: "when i catch a ghost it needs an animation")
  const CURSE_INK = ['#b26cff', '#7a3ff0', '#e0c3ff', '#4b1d99', '#9d5cff'];
  function catchGhost(g) {
    const s = g.s, tall = g.def.art === 'drift';
    const gone = sprite(tall ? 'driftgone' : 'ghostform', g.x, g.y, { fps: 10, mode: 'once', cls: 'is-haunt is-gone', z: g.y });
    if (gone) {
      if (!tall) { show(gone, gone.n - 1); gone.rev = true; }
      if (g.face === 'left' || s.el.classList.contains('is-flip')) gone.el.classList.add('is-flip');
      gone.onDone = () => kill(gone);
    }
    s.el.style.opacity = '0';
    burstInto(world, 'tw-burst tw-burst--curse', g.x / W * 100, (g.y - 30) / H * 100, 12, CURSE_INK);
    track('town_ghost', { id: g.def.id, caught: 1 });
  }
  function returnGhost(g) {
    const s = g.s;
    if (g.def.art === 'drift') { s.el.style.opacity = ''; return; }   // its own loop forms it again
    const back = sprite('ghostform', g.x, g.y, { fps: 10, mode: 'once', cls: 'is-haunt', z: g.y });
    if (g.face === 'left' || s.el.classList.contains('is-flip')) back && back.el.classList.add('is-flip');
    if (back) back.onDone = () => { kill(back); s.el.style.opacity = ''; }; else s.el.style.opacity = '';
  }
  function moveGhost(g, x, y) { g.x = x; g.y = y; moveSprite(g.s, x, y); }
  function stepGhosts(dt, now) {
    for (const g of ghosts) {
      if (g.done) continue;
      const d = g.def, s = g.s;
      // 👣 walked into, a ghost fades and keeps away a while (the drift has its own shyness below); the leader
      // hurries on instead — it is leading you (Trym, 15 Sep: "the ghosts should also flee or fade when i walk into them")
      const near = Math.hypot(ctx.pos.x - g.x, ctx.pos.y - g.y);
      if (d.from && d.to) g.hurry = near < 56 ? 3 : Math.max(0, (g.hurry || 0) - dt);
      else if (!d.path) {
        if (!g.fled && near < 42) { g.fled = 1; g.fleeT = 4 + Math.random() * 3; catchGhost(g); }
        else if (g.fled) { g.fleeT -= dt; if (g.fleeT <= 0 && near > 70) { g.fled = 0; returnGhost(g); } }
      }
      if ((d.id === 'wisp' || d.loop) && s.mode === 'done') { g.hideT -= dt; if (g.hideT <= 0) { s.el.hidden = false; show(s, 0); s.mode = 'once'; } continue; }
      if (d.path) {   // back and forth, and shy of the player
        const [a, b] = d.path, tx = g.dir > 0 ? b[0] : a[0];
        const nx = g.x + Math.sign(tx - g.x) * d.speed * dt;
        if (Math.abs(tx - g.x) < 3) g.dir = -g.dir;
        moveGhost(g, nx, g.y);
        s.el.classList.toggle('is-flip', g.dir < 0);
        const near = Math.hypot(ctx.pos.x - g.x, ctx.pos.y - g.y) < (d.near || 90);
        if (near && !g.shy) { g.shy = 1; s.el.style.opacity = '0'; g.hideT = 6; }
        else if (g.shy) { g.hideT -= dt; if (g.hideT <= 0 && !near) { g.shy = 0; s.el.style.opacity = ''; } }
      } else if (d.from && d.to) {   // walks to somewhere and is gone; something is left there
        const dx = d.to[0] - g.x, dy = d.to[1] - g.y, dist = Math.hypot(dx, dy);
        if (dist < 4) { g.done = true; s.el.style.opacity = '0'; setTimeout(() => kill(s), 1500); if (d.leaves === 'object') spawnObject(dayNum() * 7 + 2, false, d.to); }
        else { const st = Math.min(dist, d.speed * (g.hurry > 0 ? 2.4 : 1) * dt); moveGhost(g, g.x + dx / dist * st, g.y + dy / dist * st); if (s.n === 32) faceGhost(g, s, dx, dy); else s.el.classList.toggle('is-flip', dx < 0); }
      } else if (d.roam) {   // 👣 roams: waypoint to waypoint over the whole town, a pause at each, facing where it goes
        // …and keeps away from bananas (Trym, 15 Sep): a banana within reach turns it toward open ground
        const b = nearestBanana(g.x, g.y);
        if (b.d < 110 && now - (g.turnAt || 0) > 600) { g.turnAt = now; const w = awayFrom(g, b); if (w) { g.to = w; g.wait = 0; } }
        if (g.wait > 0) { g.wait -= dt; continue; }
        if (!g.to) g.to = pickWay(g);
        const dx = g.to[0] - g.x, dy = g.to[1] - g.y, dist = Math.hypot(dx, dy);
        if (dist < 4) { g.to = null; g.wait = 0.8 + Math.random() * 1.4; mischief(g); continue; }
        const st = Math.min(dist, d.speed * (b.d < 150 ? 1.7 : 1) * dt);   // chased, it flees — near the banana's own pace, still catchable
        moveGhost(g, g.x + dx / dist * st, g.y + dy / dist * st);
        if (s.n === 32) faceGhost(g, s, dx, dy); else s.el.classList.toggle('is-flip', dx < 0);
      } else if (d.bob) {   // leaning at a door
        g.t = (g.t || 0) + dt;
        s.el.style.transform = 'translateY(' + (Math.sin(g.t * 2.2) * 3).toFixed(1) + 'px)';
      }
    }
  }
  function clearGhosts(keepDay) {
    for (const g of ghosts.slice()) { if (keepDay && g.s === cond.dayghost) continue; g.done = true; g.s.el.style.opacity = '0'; const s = g.s; setTimeout(() => kill(s), 1500); ghosts.splice(ghosts.indexOf(g), 1); }
  }
  function spawnObject(seed, day, at, forced, born) {
    const def = forced || weighted(OBJECTS, (o) => RARITY_W[o.rarity], seed);   // a chapter names its object; a night draws one
    // its place by seed, then a spot in it nothing else stands on (two on one spot hid each other, 15 Sep)
    const spots = WHERE[def.where[Math.floor(h(seed, 3) * def.where.length)]] || [[1100, 1000]];
    let spot = at;
    if (!spot) { const j = Math.floor(h(seed, 5) * spots.length); for (let q = 0; q < spots.length && !spot; q++) { const c = spots[(j + q) % spots.length]; if (!objects.some((o) => Math.hypot(o.x - c[0], o.y - c[1]) < 60)) spot = c; } spot = spot || spots[j]; }
    const d = DEX[def.decor]; if (!d) return null;
    // an ordinary decor sprite, on the ground, with its small wrongness
    const el = document.createElement('div');
    el.className = 'tw-state' + (def.fx === 'hum' ? ' is-hum' : def.fx === 'flicker' ? ' is-flicker' : '');
    const w = Math.round(d.w * 0.9), hh = Math.round(d.h * 0.9);
    el.style.left = pct(spot[0] - w / 2, W); el.style.top = pct(spot[1] - hh, H); el.style.width = pct(w, W); el.style.aspectRatio = w + ' / ' + hh; el.style.zIndex = String(100 + spot[1]);
    const im = document.createElement('img'); im.src = d.img; im.alt = ''; im.className = 'is-on'; if (def.fx === 'turn') im.style.transform = 'scaleX(-1)'; el.appendChild(im);
    world.appendChild(el);
    el.classList.add('is-cursed');
    // 🔮 the curse shows on it: a dark purple aura on the ground, the pack's low flame (tinted purple in CSS)
    // licking round its foot behind it, sparks in front (Trym, 15 Sep: "a dark purple flaming glow")
    const k = Math.max(1.4, w / 26), aw = Math.round(Math.max(90, w * 3)), ah = Math.round(aw * 0.45);
    const aura = document.createElement('div');
    aura.className = 'tw-aura';
    aura.style.left = pct(spot[0] - aw / 2, W); aura.style.top = pct(spot[1] - ah / 2, H); aura.style.width = pct(aw, W); aura.style.aspectRatio = aw + ' / ' + ah; aura.style.zIndex = String(100 + spot[1] - 2);
    world.appendChild(aura);
    const flame = sprite('flame', spot[0], spot[1] + 12 * k, { z: spot[1] - 1, fps: 8, cls: 'is-flame', size: k });
    const lick = sprite('flame', spot[0], spot[1] + 12 * k * 0.45 + 3, { z: spot[1] + 1, fps: 9, cls: 'is-flame is-lick', size: k * 0.45 });   // small, at the foot only: the thing itself stays readable
    const spark = sprite('spark', spot[0], spot[1] + 13 * k - hh * 0.2, { z: spot[1] + 2, fps: 7, cls: 'is-flame', size: k });
    if (born) { aura.classList.add('is-born'); const wisp = sprite('wisp', spot[0], spot[1], { fps: 6, mode: 'once', cls: 'is-haunt' }); if (wisp) wisp.onDone = () => kill(wisp); }   // it APPEARS: a wisp rises and the aura blooms
    const o = { def, el, x: spot[0], y: spot[1], day: !!day, m: mark(spot[0], spot[1] + 2), aura, flame, lick, spark };
    objects.push(o);
    return o;
  }
  // 🔮 CURSED THINGS COME THROUGH THE NIGHT, not all at once (Trym, 15 Sep: "spawn mysteriously at night"): the first
  // within moments of dark, then one every so often, up to the night's number out at once; a taken one frees its
  // place, and a whole night gives a few more than that number — never a flood
  let nightCap = 0, nightSpawned = 0, nextSpawnAt = 0;
  function nightBegins(cap) { nightCap = cap; nightSpawned = 0; nextSpawnAt = performance.now() + 3000 + Math.random() * 5000; }
  function nightEnds() { nightCap = 0; nightSpawned = 0; nextSpawnAt = 0; clearNightObjects(); }
  function spawnThroughNight(now) {
    if (!nightCap || now < nextSpawnAt || nightSpawned >= nightCap + 2 || objects.filter((o) => !o.day).length >= nightCap) return;
    spawnObject(dayNum() * 5 + nightSpawned * 3 + 11, false, null, null, true);
    nightSpawned++; nextSpawnAt = now + 12000 + Math.random() * 23000;
  }
  // 😱 THE CURSE ON YOU: a cursed thing picked up rides along for a while — see-through, a violet edge, afloat, purple
  // fire at your feet (Trym, 15 Sep: "a fun scary effect like you get on pickups in the rave"); a rare one longer
  // …and each cursed thing has its own way with you on top (Trym, 15 Sep: "more fun curse-effects"): a class on the
  // banana (town.astro .is-me-*) — giant, tiny, mirrored, blinking, unseen, cold and shivering, purple — or blue fire,
  // a blaze, or the dark TWIN that walks a moment behind you
  const ME_FX = { humlantern: 'purple', coldfire: 'bluefire', stillbear: 'mirror', lostpack: 'giant', coldurn: 'cold', redcap: 'blink', tinwalker: 'tiny', emptymirror: 'unseen', stoppedclock: 'twin', lastlamp: 'blaze' };
  let meCurseUntil = 0, meFire = null, meFx = '', twin = null, trail = [];
  function curseMe(def) {
    endMeCurse();
    meCurseUntil = performance.now() + (def.rarity === 'rare' ? 40000 : 25000);
    meFx = ME_FX[def.id] || '';
    const me = world.querySelector('.tw-me'); if (me) { me.classList.add('is-cursed-me'); if (meFx) me.classList.add('is-me-' + meFx); }
    meFire = sprite('flame', ctx.pos.x, ctx.pos.y + 17, { z: ctx.pos.y - 1, fps: 8, cls: 'is-flame is-mefire' + (meFx === 'bluefire' ? ' is-bluefire' : ''), size: meFx === 'blaze' ? 2.1 : 1.4 });
    if (meFx === 'twin') { twin = document.createElement('div'); twin.className = 'tw-me-twin'; const cv = document.createElement('canvas'); cv.width = cv.height = 150; twin.appendChild(cv); world.appendChild(twin); trail = []; }
  }
  function endMeCurse() {
    meCurseUntil = 0;
    const me = world.querySelector('.tw-me'); if (me) { me.classList.remove('is-cursed-me'); if (meFx) me.classList.remove('is-me-' + meFx); }
    kill(meFire); meFire = null; if (twin) twin.remove(); twin = null; meFx = '';
  }
  function stepMeCurse(now) {
    if (!meCurseUntil) return;
    if (now >= meCurseUntil) { endMeCurse(); return; }
    if (meFire) moveSprite(meFire, ctx.pos.x, ctx.pos.y + 17, -20);   // at the feet, behind the banana
    if (twin) {   // the twin: your own picture, dark, where you stood a moment ago
      trail.push([ctx.pos.x, ctx.pos.y]); if (trail.length > 22) trail.shift();
      const [tx, ty] = trail[0], me = world.querySelector('.tw-me canvas');
      twin.style.left = pct(tx, W); twin.style.top = pct(ty, H); twin.style.zIndex = String(100 + Math.round(ty) - 1);
      if (me) { const g = twin.firstChild.getContext('2d'); g.clearRect(0, 0, 150, 150); g.drawImage(me, 0, 0, 150, 150); }
    }
  }
  function clearNightObjects() { for (const o of objects.slice()) if (!o.day) { objects.splice(objects.indexOf(o), 1); o.el.remove(); o.m.remove(); unhaunt(o); } }
  function unhaunt(o) { if (o.aura) o.aura.remove(); kill(o.flame); kill(o.lick); kill(o.spark); }
  function takeObject(o) {
    const i = objects.indexOf(o); if (i < 0) return;
    objects.splice(i, 1); o.el.remove(); o.m.remove(); unhaunt(o); burst(o.x, o.y - 6); curseMe(o.def);
    const first = !found(o.def.id);
    passStat('cur_' + o.def.id, 1);
    const ok = grantToShed(o.def.decor);
    const wo = W_OBJ[o.def.id] || {};
    if (wo.name) say(wo.name + (wo.desc ? '. ' + wo.desc : ''));
    track('town_object', { id: o.def.id, first: first ? 1 : 0, kept: ok ? 1 : 0 });
    if (first) passStat('rep', 5);
  }
  function enterCurse(type) {
    setCurse(type);
    if (night()) night().style.opacity = String(type === 'hush' ? NIGHT.hush : NIGHT.curse);
    weather.setKind(type === 'deep' ? 'storm' : type === 'creep' ? 'heavy' : null);
    if (type !== 'hush') {
      life.setKeep(keepFn); life.setGlow(() => false);
      cond.shut.add('cafe'); cond.shut.add('info'); shutters();
      candles = [[1100, 596], [1700, 596], [480, 1076], [1620, 1076]].map(([x, y]) => sprite('candle', x, y, { fps: 5 })).filter(Boolean);
    }
    // a hush is dusk, not a night: it brings no ghosts and no cursed things of its own — the town's own night does
    // (15 Sep: a real-time hush spawned the night set by the town's day). A creeping or deep night is the night.
    if (type !== 'hush') { (NIGHT_GHOSTS[type] || []).forEach((id) => ghostOf(id, null, true)); nightBegins(type === 'deep' ? 4 : 3); }
    if (type === 'deep') { setVendor(body(CURSE_SHELF.at[0], CURSE_SHELF.at[1], { hat: 'tophat', glasses: 'nerd' })); bodies.add(vendor()); }
    lampsByHour();
    if (curseTold() !== type + dayNum()) { setCurseTold(type + dayNum()); track('town_curse', { tier: type }); }
  }
  function leaveCurse() {
    setCurse(null);
    weather.setKind(null);
    life.setGlow((n) => h(dayNum(), 2, n.idx) >= LOOK[band()].windowsDark);
    cond.shut = new Set([...LOOK[band()].shut, ...todayShut]); shutters();
    life.setKeep(keepFn);
    candles.forEach(kill); candles = [];
    clearGhosts(true); setPlainNight(false);   // still night? the plain set comes back on the next look
    killBody(vendor()); setVendor(null);
    nightEnds();
    lampsByHour();
  }
  // 🌒 THE OMENS. A night that will charge the town is foreshadowed for three hours before it:
  // crows gather on every perch, a wisp shows by daylight, the sky goes wrong at the edges, and
  // the board pins a red notice. A sign, never a time — the clock is still nobody's to read.
  let omenOn = false, omenCrows = [], omenWisp = null;
  function omens(on) {
    omenOn = on;
    omenCrows.forEach(kill); omenCrows = [];
    if (on) {
      const taken = new Set([...cond.crows.filter((s) => !s.gone).map((s) => s.perch.join(',')), ...problems().filter((p) => p.type === 'crows').map((p) => p.x + ',' + p.y)]);
      for (const [x, y, k] of ANCHORS.perches) if (!taken.has(x + ',' + y)) { const s = sprite('crow', x, y, { fps: 2, z: perchZ(k) }); if (s) omenCrows.push(s); }
      if (!omenWisp) omenWisp = ghostOf('wisp');
      night().style.background = '#2a1040';
    } else { kill(omenWisp); omenWisp = null; night().style.background = ''; }
  }
  // ⚠️ `bananas` is WRITTEN by town-room's tick (it is built from the residents each half second)
  // and only read here, so it is set in rather than read out. The ghosts steer around whoever is
  // standing about, and that list is not this file's to keep.
  return {
    ghostOf, stepGhosts, clearGhosts, mischief, spawnObject, takeObject, unhaunt,
    nightBegins, nightEnds, spawnThroughNight, stepMeCurse, enterCurse, leaveCurse, omens,
    setBananas: (list) => { bananas = list; },
    // town-room's kill() used to splice this array itself; it cannot reach it any more
    unghost: (s) => { for (let i = ghosts.length - 1; i >= 0; i--) if (ghosts[i].s === s) ghosts.splice(i, 1); },
    ghosts: () => ghosts,
    objects: () => objects,
    omenOn: () => omenOn,
    resetSpawn: () => { nextSpawnAt = 0; return nightCap; },
    cursedMe: () => !!meCurseUntil,
    meFx: () => meFx,
  };
}
