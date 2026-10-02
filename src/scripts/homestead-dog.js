// 🐕 THE DOG'S MIND — a lazy chunk (28 Sep 2026, the cat's pattern), loaded only by a yard that has a dog: the yard calls
// brain() for her every frame, stuck() when a wall stops her, pet() when she is tapped, and tapHouse() for a tap on her
// doghouse. Everything it needs arrives once through init(ctx); `state` and `huddle` are LIVE getters.
//
// Trym, 28 Sep 2026: "upgrade the dog a bit aswell, we can probably do some more on the poor dog". She kept her soul (the
// moods below, tuned so a phone viewport witnesses them) and got the rest of her own sprite sheet: a WALK when there is
// no hurry (she used to gallop everywhere), all six frames of every row, and a BARK. New moods:
//   greet   · you come in at the gate: she runs to meet you and barks hello
//   chase   · a garden bird on the ground, or the cat now and then: a dash, a bark — the bird is off, the cat bolts
//   nap     · with a doghouse in the yard she naps IN it (the pack's own sleeping-in-the-doghouse frames); tap it and she
//             comes out wagging. Rain sends her there too, until it stops. Without one she lies down on the grass where
//             she rests (the same row, on its own: Trym, "does the dog have any sleep-position outside the doghouse?")
//   drink   · with a bowl in the yard she drinks from it once a day; it stays empty until tomorrow
// And the old ones: checkin (the guaranteed visit), linger, sitby (you stand still, she sits at your leg), rest, play
// (zoomies with sniff pauses), shadow (the leash that keeps her in view), seek (you leave: she sprints after you and waits
// at the edge of the plot). Strips share one frame box (tools/build-homestead-scene.py), so a swap never moves her feet.
let C = null, pos, hens, birdsLive, lvOf, traitsOf;
export function init(ctx) {
  C = ctx;
  ({ pos, hens, birdsLive, lvOf, traitsOf } = ctx);
}
const DOG = {   // strip → [frames, ms a frame]
  'c-dog-idle.png': [6, 170], 'c-dog-walk.png': [6, 95], 'c-dog-run.png': [6, 70], 'c-dog-eat.png': [6, 150], 'c-dog-bark.png': [3, 150],
  'c-dog-sleep.png': [8, 330],
};
// her gaits as [speed, ms a frame], matched to her legs: in the walk row a planted paw slides back ~3.5 px of the 48-scale
// art a frame (1.9 world px at her size), so 24 at 95 ms keeps it planted; the gallop is a blur and may run ahead of it
const WALK = [24, 95], TROT = [36, 66], RUN = [150, 70], DASH = [210, 60], SPRINT = [280, 48];
function dogStrip(h, s, now) {
  if (h.dstrip === s) return;
  h.dstrip = s;
  h.nf = DOG[s][0];
  h.frame = 0; h.pf = -1; h.frameAt = now;
  h.img.style.backgroundImage = "url('/assets/homestead/" + s + "')";
  h.img.style.backgroundSize = (h.nf * 100) + '% 100%';
}
function face(h, x) {
  const f = x < h.x ? 'scaleX(-1)' : '';
  if (h.fl !== f) { h.fl = f; h.img.style.transform = f; }
}
const itemOf = (id) => C.state.items.find((i) => i.id === id);
// ---- 🏠 the doghouse: she goes in, the doghouse shows her asleep in its door (an overlay exactly over it) ------------
let NAP = null;
function napIn(h, it, now, ms) {
  napOut();
  const el = document.createElement('div');
  el.className = 'hs-dogsleep';
  el.style.left = C.pct(it.x - 32, C.W); el.style.top = C.pct(it.y - 86, C.H);   // over the doghouse (64x86 from its base)
  el.style.width = C.pct(64, C.W); el.style.height = C.pct(96, C.H);              // her nose past the door: 10 px lower
  C.depth(el, it.y + 1);
  C.world.appendChild(el);
  h.el.style.visibility = 'hidden';
  NAP = { el, it, h, until: now + ms };
}
function napOut() {
  if (!NAP) return;
  const { el, it, h } = NAP;
  NAP = null;
  el.remove();
  h.el.style.visibility = '';
  h.x = h.tx = it.x + 6; h.y = h.ty = it.y + 16;   // out through her door
}
// a tap on her doghouse while she is in it: out she comes, wagging, with a bark (the hug is the yard's own tap)
export function tapHouse(it) {
  if (!NAP || NAP.it !== it) return false;
  const h = NAP.h;
  napOut();
  if (h.dg) Object.assign(h.dg, { m: 'bark', until: (h.dg.now || 0) + 900, then: 'linger' });
  return true;
}
export const napping = () => !!NAP;
export function drop(h) { if (NAP && NAP.h === h) napOut(); }
// the day's bowl: full every morning (the pass keeps the day she drank, so a pull never fills it twice)
const bowlFull = () => (C.stats().hs_dogbowl || 0) < C.dayNum();
function bowlDrunk() {
  const today = C.dayNum(), last = C.stats().hs_dogbowl || 0;
  if (last < today) { C.passStat('hs_dogbowl', today - last); C.refreshItems(); C.track1('homestead_dog_drink'); }
}
// the cat, if she is out in the yard and awake: the one the dog may chase
function catNear(h, r) {
  const c = hens.find((o) => o.a && o.a.sp === 'cat' && o.cg && o.el.style.visibility !== 'hidden');
  if (!c || !/^(sit|stroll|zoom)$/.test(c.cg.m) || Math.hypot(c.x - h.x, c.y - h.y) > r) return null;
  return c;
}
function birdNear(h, r) {
  let best = null, bd = r;
  for (const b of birdsLive) {
    if (b.mode !== 'ground' || b.scare) continue;
    const d = Math.hypot(b.x - h.x, b.y - h.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
export function stuck(h, now) {
  const g = h.dg;
  h.tx = h.x; h.ty = h.y;
  if (!g) return;
  if (g.m === 'nap' || g.m === 'shelter') { g.m = 'rest'; g.until = now + 2500; return; }   // the way in is blocked: she rests
  if (g.m === 'play' || g.m === 'chase') { g.gapUntil = now + 300; g.prey = null; g.m = g.m === 'chase' ? 'rest' : 'play'; return; }
  g.m = 'rest'; g.until = now + 2500; g.heelAt = now;
}
export function pet(h) {
  if (R && R.h === h) { roomPet(); return; }   // 🏠 indoors, her indoor self answers
  if (NAP && NAP.h === h) { tapHouse(NAP.it); return; }
  const g = h.dg;
  if (!g) return;
  if (g.m === 'nap') { Object.assign(g, { m: 'linger', until: (g.now || 0) + 2500 }); return; }   // asleep on the grass: up, wagging
  if (g.m !== 'seek' && g.m !== 'greet') Object.assign(g, { m: 'bark', until: (g.now || 0) + 900, then: 'linger' });   // a happy woof back
}
export function brain(h, now) {
  const a = h.a, t = h.tr || traitsOf(a), pace = [0.85, 1, 1.15][t.pace] || 1;
  const g = h.dg || (h.dg = { m: 'checkin', until: 0, heelAt: now, cd: 0, dash: 0, gapUntil: 0, pMoveAt: now, px: pos.x, py: pos.y,
    wasIn: true, jit: null, drank: false, greetAt: 0 });
  g.now = now;
  const P = C.plotNow();
  const cx = (x) => Math.max(P[0] + 30, Math.min(P[2] - 30, x));
  const cy = (y) => Math.max(P[1] + 50, Math.min(P[3] - 12, y));
  const pIn = pos.x > P[0] - 24 && pos.x < P[2] + 24 && pos.y > P[1] - 24 && pos.y < P[3] + 50;
  if (Math.hypot(pos.x - g.px, pos.y - g.py) > 1.5) g.pMoveAt = now;
  g.px = pos.x; g.py = pos.y;
  const pd = Math.hypot(pos.x - h.x, pos.y - h.y);
  const home = itemOf('doghouse'), bowl = itemOf('dogbowl');
  let strip = 'c-dog-idle.png', spd = 0, fr = 0;
  const gait = (G, k = 1) => { spd = G[0] * k; fr = G[1] / k; };
  const hold = () => { h.tx = h.x; h.ty = h.y; };
  const there = (r = 5) => Math.hypot(h.tx - h.x, h.ty - h.y) < r;
  const arrive = () => { g.heelAt = now; C.float(h.x, h.y - 44, '❤️'); a.gs = (a.gs || 0) + 1;
    g.m = 'linger'; g.until = now + 2500 + Math.random() * 2500; };
  // 🚪 leaving? only an OUTWARD CROSSING counts — never proximity, or she would mob every fence-builder all session
  if (g.wasIn && !pIn && now > g.cd) { napOut(); g.m = 'seek'; g.cd = now + 25000; }
  // 🐕 and coming home: an INWARD crossing — she runs to meet you and barks hello (once in a while, not every step)
  if (!g.wasIn && pIn && now > g.greetAt) { napOut(); g.m = 'greet'; g.greetAt = now + 30000; }
  g.wasIn = pIn;
  // 🌧 rain: into her doghouse if she has one (she sleeps it out); without one she stays by you, as she always did
  if (C.huddle && home && !/^(shelter|seek|greet)$/.test(g.m)) { napOut(); g.m = 'shelter'; g.ph = 0; }
  // the guaranteed visit — sooner for a dog who never leaves your side, later for an independent one
  if (!/^(seek|sitby|checkin|linger|greet|nap|shelter|drink|bark|chase)$/.test(g.m)) {
    if (g.jit == null) g.jit = (18000 + Math.random() * 12000) * (t.bold === 1 ? 0.7 : t.bold === 0 ? 1.4 : 1);
    if (now - g.heelAt > g.jit) { g.m = 'checkin'; g.jit = null; }
  }
  // you stood still a while — she notices
  if ((g.m === 'rest' || g.m === 'play' || g.m === 'shadow') && now - g.pMoveAt > 6000 && pd > 90) g.m = 'sitby';
  if (g.m === 'seek') {
    gait(SPRINT);
    if (pos.y > P[3] + 60) {   // she will not follow into the road — she waits at the edge
      h.tx = Math.max(P[0] + 24, Math.min(P[2] - 24, pos.x)); h.ty = P[3] - 6;
      if (there()) { strip = 'c-dog-idle.png'; spd = 0; }
      else strip = 'c-dog-run.png';
    } else {
      h.tx = pos.x - 52; h.ty = pos.y + 6; strip = 'c-dog-run.png';
      if (pd < 70) arrive();
    }
  } else if (g.m === 'greet') {
    h.tx = pos.x + (h.x < pos.x ? -46 : 46); h.ty = pos.y + 6;
    strip = 'c-dog-run.png'; gait(RUN, pace);
    if (pd < 60 || there()) { face(h, pos.x); C.float(h.x, h.y - 44, '❤️'); a.gs = (a.gs || 0) + 1; g.heelAt = now;
      Object.assign(g, { m: 'bark', until: now + 1500, then: 'linger' }); }
  } else if (g.m === 'bark') {
    hold(); strip = 'c-dog-bark.png';
    if (g.faceX != null) face(h, g.faceX); else if (pd < 300) face(h, pos.x);
    if (now > g.until) { g.m = g.then || 'rest'; g.until = g.m === 'linger' ? now + 2000 + Math.random() * 2000 : 0; g.then = null; g.faceX = null; }
  } else if (g.m === 'checkin') {
    h.tx = pos.x - 52; h.ty = pos.y + 6; strip = 'c-dog-run.png'; gait(DASH, pace);
    if (pd < 70) arrive();
  } else if (g.m === 'linger') {
    hold(); strip = 'c-dog-idle.png';
    if (now > g.until) { g.m = Math.random() < 0.5 ? 'play' : 'rest'; g.until = 0; g.dash = 0; }
  } else if (g.m === 'sitby') {
    h.tx = pos.x - 40; h.ty = pos.y + 8; strip = 'c-dog-walk.png'; gait(TROT, pace);
    if (pd < 55) { hold(); strip = 'c-dog-idle.png'; spd = 0; g.heelAt = now; face(h, pos.x); }
    if (now - g.pMoveAt < 800) g.m = 'shadow';
  } else if (g.m === 'rest') {
    if (!g.until) {
      g.until = now + (8000 + Math.random() * 12000) * (t.pat === 2 ? 1.5 : t.pat === 0 ? 0.6 : 1);
      const nearHome = Math.hypot(pos.x - C.state.home.x, pos.y - C.state.home.y) < 400;
      const ax = nearHome ? C.state.home.x : pos.x, ay = nearHome ? C.state.home.y + 90 : pos.y;
      g.rx = cx(ax + (Math.random() * 280 - 140)); g.ry = cy(ay + (Math.random() * 140 - 40));
    }
    h.tx = g.rx; h.ty = g.ry;
    if (there()) { strip = 'c-dog-idle.png'; spd = 0; } else { strip = 'c-dog-walk.png'; gait(WALK, pace); }
    if (pd > 350) { g.m = 'shadow'; g.until = 0; }
    else if (now > g.until) {
      // what next: her bowl once a day, her doghouse for a nap (a sleepy dog more often), or play
      g.until = 0; g.dash = 0;
      const r = Math.random();
      if (bowl && !g.drank && bowlFull() && r < 0.6) { g.m = 'drink'; g.ph = 0; }
      else if (r < (C.night && C.night() ? 0.85 : t.pat === 2 ? 0.5 : t.pat === 0 ? 0.15 : 0.3)) { g.m = 'nap'; g.ph = 0; }   // her doghouse, or the grass (🌙 almost always, at night)
      else g.m = 'play';
    }
  } else if (g.m === 'play') {
    if (!g.dash && !g.gapUntil) {
      g.dash = 2 + Math.floor(Math.random() * 3);
      // now and then a chase instead: a bird on the ground, or the cat if she is about
      // (`calm`, a walk's knob as it is the cat's: no chase while a mood is being looked at)
      const b = g.calm ? null : birdNear(h, 360), c = !b && !g.calm && Math.random() < 0.35 ? catNear(h, 340) : null;
      if (b || c) { g.m = 'chase'; g.prey = b ? { b } : { c }; g.ph = 0; }
    }
    if (g.m === 'play') {
      // ⚠️ the next dash waits in nx/ny through the sniff: holding still used to wipe it, so every "zoomie" was a sniff
      // and a one-frame step, and she never actually dashed (found by the frame walk, 28 Sep 2026)
      if (g.gapUntil && now < g.gapUntil) {   // the sniff between zoomies — and a look back at you
        hold(); strip = 'c-dog-eat.png'; face(h, pos.x);
      } else if (g.gapUntil) {                // sniffed enough: off she goes
        g.gapUntil = 0; h.tx = g.nx; h.ty = g.ny; strip = 'c-dog-run.png'; gait(DASH, pace);
      } else if (there()) {
        if (g.dash <= 0) { g.m = Math.random() < 0.6 ? 'rest' : 'shadow'; g.until = 0; }
        else {
          g.dash--;
          g.gapUntil = now + 300 + Math.random() * 600;
          const a2 = Math.random() * Math.PI * 2, r2 = 60 + Math.random() * 120;
          g.nx = cx(h.x + Math.cos(a2) * r2); g.ny = cy(h.y + Math.sin(a2) * r2 * 0.6);
          hold(); strip = 'c-dog-eat.png';
        }
      } else { strip = 'c-dog-run.png'; gait(DASH, pace); }
      if (pd > 350) { g.m = 'shadow'; g.gapUntil = 0; }
    }
  } else if (g.m === 'chase') {
    const pr = g.prey || {};
    const tgtX = pr.b ? pr.b.x : pr.c ? pr.c.x : h.x, tgtY = pr.b ? pr.b.y : pr.c ? pr.c.y : h.y;
    const gone = pr.b ? (!birdsLive.includes(pr.b) || pr.b.mode !== 'ground') : !pr.c;
    if (gone && g.ph === 0) { g.m = 'rest'; g.until = 0; g.prey = null; }
    else if (g.ph === 0) {
      h.tx = cx(tgtX + (h.x < tgtX ? -30 : 30)); h.ty = cy(tgtY + 4); strip = 'c-dog-run.png'; gait(DASH, pace);
      if (Math.hypot(tgtX - h.x, tgtY - h.y) < 60 || there(8)) {
        if (pr.b) pr.b.scare = 1;                               // off over the trees
        if (pr.c && pr.c.cg) pr.c.cg.spook = { t: now, x: h.x, y: h.y };   // and the cat bolts, away from her (homestead-cat.js)
        Object.assign(g, { m: 'bark', until: now + 1200, then: 'rest', faceX: tgtX, prey: null });
        C.track1('homestead_dog_chase', { at: pr.b ? 'bird' : 'cat' });
      }
    }
  } else if (g.m === 'drink') {
    if (!bowl) { g.m = 'rest'; g.until = 0; }
    else if (!g.ph) { h.tx = cx(bowl.x - 30); h.ty = bowl.y + 4; strip = 'c-dog-walk.png'; gait(TROT, pace); if (there()) { g.ph = 1; g.until = now + 3200; } }
    else {
      hold(); face(h, bowl.x); strip = 'c-dog-eat.png';
      if (now > g.until) { g.drank = true; bowlDrunk(); g.m = 'rest'; g.until = 0; }
    }
  } else if (g.m === 'nap' && !home) {
    // 💤 no doghouse: she lies down where she rested, on the grass — and gets up to follow when you wander off
    hold(); strip = 'c-dog-sleep.png';
    if (h.fl) { h.fl = ''; h.img.style.transform = ''; }   // the sleeping row faces you, as the pack draws it
    if (!g.until) g.until = now + (22000 + Math.random() * 26000) * (t.pat === 2 ? 1.5 : t.pat === 0 ? 0.6 : 1);
    if (C.night && C.night()) g.until = Math.max(g.until, now + 4000);   // 🌙 she sleeps the night out — unless you wander off
    if (now > g.until || pd > 420) { g.m = 'rest'; g.until = 0; g.heelAt = now; }
  } else if (g.m === 'nap' || g.m === 'shelter') {
    if (!home) { g.m = 'rest'; g.until = 0; }   // rain and no doghouse: she stays by you, as she always did
    else if (!NAP) {
      h.tx = home.x + 6; h.ty = home.y + 16;
      if (g.m === 'shelter') { strip = 'c-dog-run.png'; gait(RUN, pace); } else { strip = 'c-dog-walk.png'; gait(TROT, pace); }
      if (there(6)) napIn(h, home, now, (22000 + Math.random() * 26000) * (t.pat === 2 ? 1.5 : t.pat === 0 ? 0.6 : 1));
    } else {
      hold();
      if ((g.m === 'shelter' && C.huddle) || (C.night && C.night())) NAP.until = Math.max(NAP.until, now + 8000);   // she sleeps the rain out — and the night (3 Oct 2026)
      if (now > NAP.until) { napOut(); g.m = 'rest'; g.until = 0; g.heelAt = now; }
    }
  } else {
    // shadow — the leash that keeps everything else visible: she walks after you, and runs when you get far ahead
    if (pd > 280) {
      h.tx = pos.x + (h.x - pos.x) / (pd || 1) * 230; h.ty = pos.y + (h.y - pos.y) / (pd || 1) * 230;
      strip = pd > 380 ? 'c-dog-run.png' : 'c-dog-walk.png';
      if (pd > 380) gait(RUN, pace); else gait(TROT, pace);
    } else { hold(); strip = 'c-dog-idle.png'; }
    if (now - g.pMoveAt > 2500) { g.m = 'rest'; g.until = 0; }
  }
  if (NAP && NAP.h === h && g.m !== 'nap' && g.m !== 'shelter') napOut();
  dogStrip(h, strip, now);
  h.dspd = spd; h.dfr = fr || DOG[strip][1];
  // she wags (and breathes, and barks) even when she isn't going anywhere
  if (spd === 0 && now - h.frameAt > h.dfr) { h.frameAt = now; h.frame = (h.frame + 1) % h.nf; }
}
// ---- 🏠 INDOORS (28 Sep 2026) ------------------------------------------------------------------------------------------
// Trym: "can the dog come indoors? … so the dog can also sleep inside?" She follows you in unless she is asleep in her
// doghouse or off across the yard (a dog goes where her person goes; the cat only when it suits her), and comes back out
// with you. Inside she trots after you, sits by your leg when you stop (a heart now and then, on her check-in clock),
// and once you have been still a while lies down for a nap on the pack's own sleeping row: by the fire, else on a rug,
// else beside you — never on the cat's spot. She gets up and follows when you go. A tap is the yard's own (the hug):
// awake she woofs, asleep she wakes and wags.
const WARM = /^(fireplace|woodstove)$/;
let R = null;
function roomSpots(t) {
  const out = [], B = C.roomBounds(t), cat = C.petRoom('cat');
  for (const it of ((C.state.inItems || {})[t] || [])) {
    const d = C.DEX[it.id];
    if (!d) continue;
    let s = null;
    if (WARM.test(it.id)) s = { x: it.x, y: Math.min(B[3] - 6, it.y + 20), w: 5 };
    else if (d.rug && d.h >= 40) s = { x: it.x, y: it.y - d.h * 0.35, w: 3 };
    if (s && !(cat && Math.hypot(cat.x - s.x, cat.y - s.y) < 44)) out.push(s);
  }
  return out;
}
export function roomEnter(h, t, now) {
  roomLeave(true);
  const g = h.dg, home = C.state.home;
  if (!g || !h.a || NAP || g.m === 'seek' || Math.hypot(h.x - home.x, h.y - home.y - 34) > 520) return;
  const I = C.INTERIORS[t], el = document.createElement('div'), img = document.createElement('span');
  el.className = 'hs-indog';
  img.className = 'hs-henimg';
  el.appendChild(img);
  C.world.appendChild(el);
  R = { h, t, el, img, x: I.spawn[0] - 30, y: I.spawn[1] + 6, m: 'follow', ph: 0, until: 0, now, frameAt: now,
    pMoveAt: now, px: pos.x, py: pos.y, fl: '', heartAt: now + 6000 };
  R.tx = R.x; R.ty = R.y;
  C.track1('homestead_dog_inside');
}
export function roomLeave(quiet) {
  if (!R) return;
  const h = R.h;
  R.el.remove();
  R = null;
  if (quiet || !h.dg) return;
  h.x = h.tx = C.state.home.x - 34; h.y = h.ty = C.state.home.y + 46;   // out by the door, on the other side from the cat
  Object.assign(h.dg, { m: 'linger', until: performance.now() + 2500, prey: null });
}
export const roomAt = (wx, wy) => !!R && Math.hypot(wx - R.x, wy - (R.y - 14)) < 34;
export const roomRead = () => R && { m: R.m, ph: R.ph, x: R.x, y: R.y, strip: R.dstrip, frame: R.frame, nf: R.nf,
  size: R.img.style.backgroundSize, pos: R.img.style.backgroundPosition };
export const roomMood = (m, o) => { if (R) Object.assign(R, { m, ph: 0, until: 0 }, o || {}); return !!R; };
function roomPet() {
  if (R.m === 'nap' && R.ph === 1) { R.m = 'follow'; R.ph = 0; R.pMoveAt = R.now; return; }   // woken by a hand: up, wagging
  R.m = 'bark'; R.until = R.now + 900;
}
export function roomTick(now, dt) {
  if (!R) return;
  const h = R.h, a = h.a, t = h.tr || traitsOf(a), pace = [0.85, 1, 1.15][t.pace] || 1, B = C.roomBounds(R.t);
  R.now = now;
  if (Math.hypot(pos.x - R.px, pos.y - R.py) > 1.5) R.pMoveAt = now;
  R.px = pos.x; R.py = pos.y;
  const pd = Math.hypot(pos.x - R.x, pos.y - R.y), still = now - R.pMoveAt;
  const aim = (x, y) => { R.tx = Math.max(B[0] + 16, Math.min(B[2] - 16, x)); R.ty = Math.max(B[1] + 8, Math.min(B[3] - 4, y)); };
  const there = () => Math.hypot(R.tx - R.x, R.ty - R.y) < 4;
  let strip = 'c-dog-idle.png', spd = 0, fr = 0;
  if (R.m === 'follow') {
    // at your side — the side away from the cat when she is at your feet too
    const cat = C.petRoom('cat');
    let side = R.x < pos.x ? -1 : 1;
    if (cat && Math.hypot(cat.x - (pos.x + side * 44), cat.y - pos.y) < 40) side = -side;
    if (pd > 80 || R.going) {
      R.going = pd > 56;
      aim(pos.x + side * 44, pos.y + 8);
      strip = 'c-dog-walk.png';
      if (pd > 160) { spd = 36 * pace; fr = 66 / pace; } else { spd = 24 * pace; fr = 95 / pace; }
    } else {
      const f = pos.x < R.x ? 'scaleX(-1)' : '';
      if (R.fl !== f) { R.fl = f; R.img.style.transform = f; }
      if (still > 5000 && now > R.heartAt) {   // she sat by you: her check-in, indoors
        R.heartAt = now + (18000 + Math.random() * 12000) * (t.bold === 1 ? 0.7 : t.bold === 0 ? 1.4 : 1);
        C.float(R.x, R.y - 44, '❤️'); a.gs = (a.gs || 0) + 1;
      }
      if (still > 12000 && !R.calm) { R.m = 'nap'; R.ph = 0; }
    }
  } else if (R.m === 'nap') {
    if (!R.ph) {
      const S = roomSpots(R.t);
      let r = Math.random() * S.reduce((n, s) => n + s.w, 0);
      const s = S.find((q) => (r -= q.w) < 0) || S[0] || { x: pos.x + (R.x < pos.x ? -40 : 40), y: pos.y + 10 };
      aim(s.x, s.y); R.ph = 0.5;
    }
    if (R.ph === 0.5) {
      strip = 'c-dog-walk.png'; spd = 24 * pace; fr = 95 / pace;
      if (there()) { R.ph = 1; R.until = now + (25000 + Math.random() * 25000) * (t.pat === 2 ? 1.5 : t.pat === 0 ? 0.6 : 1); }
    }
    if (R.ph === 1) {
      strip = 'c-dog-sleep.png';
      if (R.fl) { R.fl = ''; R.img.style.transform = ''; }
      // you go: after a moment she is up and after you
      if (still < 300 && pd > 220) R.wakeAt = R.wakeAt || now + 1200; else R.wakeAt = 0;
      if (now > R.until || (R.wakeAt && now > R.wakeAt)) { R.m = 'follow'; R.ph = 0; R.wakeAt = 0; }
    }
  } else if (R.m === 'bark') {
    strip = 'c-dog-bark.png';
    if (pd < 260) { const f = pos.x < R.x ? 'scaleX(-1)' : ''; if (R.fl !== f) { R.fl = f; R.img.style.transform = f; } }
    if (now > R.until) R.m = 'follow';
  }
  if (spd) {
    const dx = R.tx - R.x, dy = R.ty - R.y, d = Math.hypot(dx, dy);
    if (d > 1) {
      const s = Math.min(d, spd * dt);
      R.x += dx / d * s; R.y += dy / d * s;
      const f = dx < -0.5 ? 'scaleX(-1)' : dx > 0.5 ? '' : R.fl;
      if (R.fl !== f) { R.fl = f; R.img.style.transform = f; }
    }
  }
  dogStrip(R, strip, now);
  if (now - R.frameAt > (fr || DOG[strip][1])) { R.frameAt = now; R.frame = (R.frame + 1) % R.nf; }
  if (R.pf !== R.frame) { R.pf = R.frame; R.img.style.backgroundPosition = (R.frame * 100 / (R.nf - 1)) + '% 0'; }
  R.el.style.left = C.pct(R.x - 28, C.W); R.el.style.top = C.pct(R.y - 36, C.H);
  R.el.style.zIndex = String(C.IN_Z + Math.round(R.y));
  h.x = R.x; h.y = R.y;   // her yard self stands where she is: a tap's heart floats over her
}
