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
//             comes out wagging. Rain sends her there too, until it stops
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
  if (NAP && NAP.h === h) { tapHouse(NAP.it); return; }
  const g = h.dg;
  if (!g) return;
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
      else if (home && r < (t.pat === 2 ? 0.5 : t.pat === 0 ? 0.15 : 0.3)) { g.m = 'nap'; g.ph = 0; }
      else g.m = 'play';
    }
  } else if (g.m === 'play') {
    if (!g.dash && !g.gapUntil) {
      g.dash = 2 + Math.floor(Math.random() * 3);
      // now and then a chase instead: a bird on the ground, or the cat if she is about
      const b = birdNear(h, 360), c = !b && Math.random() < 0.35 ? catNear(h, 340) : null;
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
  } else if (g.m === 'nap' || g.m === 'shelter') {
    if (!home) { g.m = 'rest'; g.until = 0; }
    else if (!NAP) {
      h.tx = home.x + 6; h.ty = home.y + 16;
      if (g.m === 'shelter') { strip = 'c-dog-run.png'; gait(RUN, pace); } else { strip = 'c-dog-walk.png'; gait(TROT, pace); }
      if (there(6)) napIn(h, home, now, (22000 + Math.random() * 26000) * (t.pat === 2 ? 1.5 : t.pat === 0 ? 0.6 : 1));
    } else {
      hold();
      if (g.m === 'shelter' && C.huddle) NAP.until = Math.max(NAP.until, now + 8000);   // she sleeps the rain out
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
