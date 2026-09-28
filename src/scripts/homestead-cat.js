// 🐈 THE CAT'S MIND — a lazy chunk (28 Sep 2026), loaded only by a yard that has a cat: banana-homestead.js calls
// brain() for her every frame, stuck() when a wall stops her and pet() when she is tapped. Everything it needs from
// the yard arrives once through init(ctx); `state` and `huddle` are LIVE getters because the yard reassigns them.
let C = null, pos, hens, birdsLive, lvOf, traitsOf, spotOf, isYoungA;
export function init(ctx) {
  C = ctx;
  ({ pos, hens, birdsLive, lvOf, traitsOf, spotOf, isYoungA } = ctx);
}
// Trym, 28 Sep 2026: "give the cat a cat-style personality - make it feel like a cats behaviour". The dog
// comes to you; the cat comes when SHE decides, and mostly she is busy with her own day:
//   nap     · lies down, long, in her spot: where you carried her, else her favourite, else by the house.
//             A tap never wakes her. Rain sends her running for the eaves to sleep it out
//   sit     · stands and watches, tail going: you, a bird, nothing much
//   stroll  · a slow walk somewhere near (a nosy one's often ends near you)
//   hunt    · a garden bird on the ground, or a hen: creeps up, freezes, pounces, never catches. The bird
//             is off over the trees, the hen hops away, and she sniffs about as if nothing happened
//   zoom    · two to four sudden dashes, then a flop into a nap (twice as likely in your evening)
//   visit   · only once you have stood still a while: she walks over, purrs at your feet, goes again
//   meow    · you walk in through the gate: she looks up and meows from where she is
//   shun    · walk straight at a cat who does not know you yet (or a shy one) and she steps away
// She never follows you out of the yard. From Lv 5 she comes round more often (her card says so).
// Every strip is one bake (tools/cat/bake_homestead.py) sharing one frame box, so a swap never moves her feet.
// her gaits as [speed, ms a frame], matched to her legs: in the walk row a planted foot slides back ~4 pack px over
// three frames (6 world px at her size), so 28 at 105 ms keeps it planted — at 44 she skated (the frame films, 28 Sep)
const WALK = [28, 105], TROT = [34, 90], AWAY = [40, 80], CREEP = [14, 170], ZOOM = [180, 55], POUNCE = [240, 50];
const CAT = {   // strip → [frames, ms a frame]
  'c-catidle.png': [6, 190], 'c-cat.png': [6, 120], 'c-catrun.png': [6, 70], 'c-cateat.png': [6, 150],
  'c-catmeow.png': [3, 170], 'c-cathappy.png': [6, 140], 'c-catsleep.png': [8, 330],
};
function catStrip(h, s, now) {
  if (h.cstrip === s) return;
  h.cstrip = s;
  h.nf = CAT[s][0];
  h.frame = 0; h.pf = -1; h.frameAt = now;
  h.img.style.backgroundImage = "url('/assets/homestead/" + s + "')";
  h.img.style.backgroundSize = (h.nf * 100) + '% 100%';
}
// a wall, a fence or a trough in her way: walking to a nap, she naps right there; anything else, she sits
export function stuck(h, now) {
  const g = h.cg;
  h.tx = h.x; h.ty = h.y;
  if (!g) return;
  if ((g.m === 'nap' || g.m === 'shelter') && g.ph === 0.5) {
    g.ph = 1; g.until = g.m === 'nap' ? now + 20000 + Math.random() * 20000 : 0;
    return;
  }
  // mid-zoomies she bounces off it and dashes somewhere else
  if (g.m === 'zoom' && g.dashing) { g.dashing = false; g.gapUntil = now + 200 + Math.random() * 300; return; }
  g.m = 'sit'; g.ph = 0; g.until = now + 1800 + Math.random() * 1800; g.prey = null;
}
function catFace(h, x) {
  const f = x < h.x ? 'scaleX(-1)' : '';
  if (h.fl !== f) { h.fl = f; h.img.style.transform = f; }
}
// a gap before her next visit: a nosy cat comes often, a shy one seldom, and a friend more often
function catGap(a, t) {
  const lv = lvOf(a);
  const base = t.bold === 1 ? 22000 + Math.random() * 16000 : t.bold === 0 ? 70000 + Math.random() * 40000
    : 38000 + Math.random() * 24000;
  return base * (lv >= 5 ? 0.6 : lv >= 3 ? 0.85 : 1);
}
function catPrey(h) {
  let best = null, bd = 420;
  for (const b of birdsLive) {
    if (b.mode !== 'ground' || b.scare) continue;
    const d = Math.hypot(b.x - h.x, b.y - h.y);
    if (d < bd) { bd = d; best = { b }; }
  }
  if (best || Math.random() > 0.4) return best;
  bd = 320;
  for (const o of hens) {
    if (o === h || !o.a || o.a.sp !== 'hen' || isYoungA(o.a)) continue;
    const d = Math.hypot(o.x - h.x, o.y - h.y);
    if (d < bd && d > 60) { bd = d; best = { h: o }; }
  }
  return best;
}
export function brain(h, now) {
  const a = h.a, t = h.tr || traitsOf(a);
  const g = h.cg || (h.cg = { m: 'sit', ph: 0, until: now + 2500, pMoveAt: now, px: pos.x, py: pos.y, wasIn: true,
    visitAt: now + 20000 + Math.random() * 20000, meowAt: 0, shunAt: 0 });
  g.now = now;
  const P = C.plotNow();
  const cx = (x) => Math.max(P[0] + 30, Math.min(P[2] - 30, x));
  const cy = (y) => Math.max(P[1] + 50, Math.min(P[3] - 12, y));
  const pIn = pos.x > P[0] - 24 && pos.x < P[2] + 24 && pos.y > P[1] - 24 && pos.y < P[3] + 50;
  if (Math.hypot(pos.x - g.px, pos.y - g.py) > 1.5) g.pMoveAt = now;
  g.px = pos.x; g.py = pos.y;
  const pd = Math.hypot(pos.x - h.x, pos.y - h.y);
  const still = now - g.pMoveAt;
  const lv = lvOf(a);
  const pace = [0.8, 1, 1.2][t.pace] || 1;
  const go = (m, ms) => { g.m = m; g.ph = 0; g.until = ms ? now + ms : 0; if (m !== 'hunt') g.prey = null; };
  const aim = (x, y) => { h.tx = cx(x); h.ty = cy(y); };
  const hold = () => { h.tx = h.x; h.ty = h.y; };
  const there = () => Math.hypot(h.tx - h.x, h.ty - h.y) < 5;
  const napSpot = () => {
    let s = a.hm && Number.isFinite(a.hm.x) ? { x: a.hm.x, y: a.hm.y } : spotOf(a);
    if (!s) s = C.state.stage >= 1 ? { x: C.state.home.x + 44, y: C.state.home.y + 70 } : { x: h.x, y: h.y };
    return { x: s.x + (Math.random() * 72 - 36), y: s.y + 8 + Math.random() * 16 };
  };
  const pick = () => {
    const eve = (() => { const hr = new Date().getHours(); return hr >= 19 || hr < 5; })();
    const prey = catPrey(h);
    if (prey && !g.calm && Math.random() < 0.3) { g.prey = prey; go('hunt'); return; }   // calm: a walk holding her still
    const pNap = t.pat === 2 ? 0.45 : t.pat === 0 ? 0.18 : 0.32;
    const pZoom = (t.pat === 0 ? 0.16 : 0.08) * (eve ? 2 : 1);
    const r = Math.random();
    if (r < pNap) go('nap');
    else if (r < pNap + pZoom) go('zoom');
    else if (r < pNap + pZoom + 0.36) go('stroll');
    else go('sit', 3000 + Math.random() * 6000);
  };
  // 🚪 you walked in through the gate: she looks up and says so (never out of a nap, once in a while)
  if (!g.wasIn && pIn && g.m !== 'nap' && g.m !== 'shelter' && now > g.meowAt) { go('meow', 1050); g.meowAt = now + 30000; }
  g.wasIn = pIn;
  // 🌧 rain: up from wherever she was, she runs for the eaves and sleeps it out
  if (C.huddle && g.m !== 'shelter') go('shelter');
  // 🐾 her visit: only once you have stood still a while, and only when she feels like it
  if (!C.huddle && pIn && still > 5000 && now > g.visitAt && pd < 460 && pd > 70
    && (g.m === 'sit' || g.m === 'stroll')) go('visit');
  // 🙀 walked straight at by somebody she does not trust yet: she steps away
  if ((g.m === 'sit' || g.m === 'stroll') && pd < 60 && still < 400 && (lv < 3 || t.bold === 0) && now > g.shunAt) go('shun');
  // 🐦 a bird lands in sight: most of the time she has seen it
  if ((g.m === 'sit' || g.m === 'stroll') && !g.prey && !g.calm) {
    for (const b of birdsLive) {
      if (b.catSeen || b.mode !== 'ground') continue;
      b.catSeen = 1;
      if (Math.hypot(b.x - h.x, b.y - h.y) < 380 && Math.random() < 0.55) { g.prey = { b }; go('hunt'); }
      break;
    }
  }
  let strip = 'c-catidle.png', spd = 0, fr = 0;
  if (g.m === 'sit') {
    hold();
    if (pd < 300) catFace(h, pos.x);
    if (!g.until) g.until = now + 2500 + Math.random() * 4000;
    if (now > g.until) pick();
  } else if (g.m === 'stroll') {
    if (!g.ph) {
      g.ph = 1;
      if (t.bold === 1 && pd < 420 && Math.random() < 0.35) {
        const an = Math.random() * Math.PI * 2;
        aim(pos.x + Math.cos(an) * (70 + Math.random() * 40), pos.y + Math.sin(an) * 40);
      } else {
        const an = Math.random() * Math.PI * 2, r = 60 + Math.random() * 150;
        aim(h.x + Math.cos(an) * r, h.y + Math.sin(an) * r * 0.6);
      }
    }
    strip = 'c-cat.png'; spd = WALK[0] * pace; fr = WALK[1] / pace;
    if (there()) go('sit', 2000 + Math.random() * 3500);
  } else if (g.m === 'nap') {
    if (!g.ph) { g.ph = 0.5; const s = napSpot(); aim(s.x, s.y); }
    if (g.ph === 0.5) {
      strip = 'c-cat.png'; spd = WALK[0] * pace; fr = WALK[1] / pace;
      if (there()) { g.ph = 1; g.until = now + (25000 + Math.random() * 35000) * (t.pat === 2 ? 1.6 : t.pat === 0 ? 0.6 : 1); }
    }
    if (g.ph === 1) {
      hold(); strip = 'c-catsleep.png';
      if (now > g.until) go('sit', 2000 + Math.random() * 1500);
    }
  } else if (g.m === 'shelter') {
    if (!g.ph) {
      g.ph = 0.5;
      // ⚠️ in FRONT of the wall, below the door's tap band (home.y + 8): tight against the house a tap on
      // her opened the door instead (the walk)
      const side = Math.random() < 0.5 ? -1 : 1;
      aim(C.state.home.x + side * (30 + Math.random() * 30), C.state.home.y + 30 + Math.random() * 10);
    }
    if (g.ph === 0.5) {
      strip = 'c-catrun.png'; spd = 150; fr = 75;
      if (there()) g.ph = 1;
    }
    if (g.ph === 1) {
      hold(); strip = 'c-catsleep.png';
      if (C.huddle) g.until = 0;
      else if (!g.until) g.until = now + 8000 + Math.random() * 7000;
      else if (now > g.until) go('sit', 2000);
    }
  } else if (g.m === 'hunt') {
    const pr = g.prey;
    const alive = pr && (pr.b ? birdsLive.includes(pr.b) && pr.b.mode === 'ground' && !pr.b.scare : pr.h && hens.includes(pr.h));
    if (!alive && g.ph < 2) { g.prey = null; go('sit', 2500); }
    else if (g.ph === 0) {   // a walk over, then the last stretch in a creep, low and slow, to a pounce away
      const px2 = pr.b ? pr.b.x : pr.h.x, py2 = pr.b ? pr.b.y : pr.h.y;
      const dd = Math.hypot(px2 - h.x, py2 - h.y);
      if (dd < 58) { g.ph = 1; g.until = now + 700 + Math.random() * 900; hold(); }
      else {
        aim(px2 - (px2 - h.x) / dd * 50, py2 - (py2 - h.y) / dd * 50); strip = 'c-cat.png';
        if (dd > 140) { spd = WALK[0] * pace; fr = WALK[1] / pace; } else { spd = CREEP[0]; fr = CREEP[1]; }
      }
    } else if (g.ph === 1) {   // freeze, eyes on it
      hold(); catFace(h, pr.b ? pr.b.x : pr.h.x);
      if (now > g.until) { g.ph = 2; aim((pr.b ? pr.b.x : pr.h.x) + (h.fl ? -8 : 8), pr.b ? pr.b.y : pr.h.y); }
    } else if (g.ph === 2) {   // the pounce
      strip = 'c-catrun.png'; spd = POUNCE[0]; fr = POUNCE[1];
      if (there()) {
        if (pr && pr.b) pr.b.scare = 1;
        if (pr && pr.h) {
          const o = pr.h, ox = o.x - h.x, oy = o.y - h.y, od = Math.hypot(ox, oy) || 1;
          o.el.classList.add('is-hop'); setTimeout(() => o.el.classList.remove('is-hop'), 700);
          o.tx = Math.max(P[0] + 16, Math.min(P[2] - 16, o.x + ox / od * 70));
          o.ty = Math.max(P[1] + 40, Math.min(P[3] - 10, o.y + oy / od * 40));
          o.waitUntil = 0; o.via = null;
        }
        g.prey = null; g.ph = 3; g.until = now + 1200 + Math.random() * 1000;
      }
    } else {   // as if nothing happened
      hold(); strip = 'c-cateat.png';
      if (now > g.until) go('sit', 2000 + Math.random() * 2000);
    }
  } else if (g.m === 'zoom') {
    // dash, stop dead, dash again: two to four of them, then a flop where she stands (or a sit)
    if (!g.ph) { g.ph = 1; g.dash = 2 + Math.floor(Math.random() * 3); g.dashing = false; g.gapUntil = now + 300; hold(); }
    if (g.dashing) {
      strip = 'c-catrun.png'; spd = ZOOM[0]; fr = ZOOM[1];
      if (there()) { g.dashing = false; g.gapUntil = now + 250 + Math.random() * 450; strip = 'c-catidle.png'; spd = 0; fr = 0; }
    } else if (now < g.gapUntil) {
      hold();
    } else if (g.dash > 0) {
      g.dash--; g.dashing = true;
      const an = Math.random() * Math.PI * 2, r = 90 + Math.random() * 100;
      aim(h.x + Math.cos(an) * r, h.y + Math.sin(an) * r * 0.6);
      strip = 'c-catrun.png'; spd = ZOOM[0]; fr = ZOOM[1];
    } else if (Math.random() < 0.6) {
      go('nap'); g.ph = 1; g.until = now + 15000 + Math.random() * 20000;
      hold(); strip = 'c-catsleep.png';
    } else go('sit', 2000 + Math.random() * 2000);
  } else if (g.m === 'visit') {
    if (!g.ph) {
      if (still < 800 || pd > 480) { go('sit', 2500); }   // you moved: a cat does not chase you
      else {
        const side = h.x < pos.x ? -1 : 1;
        aim(pos.x + side * 34, pos.y + 6);
        strip = 'c-cat.png'; spd = TROT[0] * pace; fr = TROT[1] / pace;
        if (there() || pd < 40) {
          g.ph = 1; g.until = now + 3000 + Math.random() * 1500;
          C.float(h.x, h.y - 38, '❤️');
          a.gs = (a.gs || 0) + 1;
        }
      }
    } else {
      hold(); strip = 'c-cathappy.png';
      if (now > g.until) {
        g.visitAt = now + catGap(a, t);
        if (Math.random() < 0.3) { go('nap'); g.ph = 1; g.until = now + 20000 + Math.random() * 20000; }
        else { go('stroll'); g.ph = 1; const an = Math.random() * Math.PI * 2; aim(h.x + Math.cos(an) * 150, h.y + Math.sin(an) * 70); }
      }
    }
    if (g.m === 'nap' && g.ph === 1) { hold(); strip = 'c-catsleep.png'; spd = 0; }
  } else if (g.m === 'meow') {
    hold(); catFace(h, pos.x); strip = 'c-catmeow.png';
    if (now > g.until) {
      // sometimes she strolls over to meet you part of the way, and sits in your path
      if (Math.random() < 0.4 && pIn && pd > 120) {
        go('stroll'); g.ph = 1;
        const dx = pos.x - h.x, dy = pos.y - h.y, dd = pd || 1;
        aim(h.x + dx / dd * (pd - 90), h.y + dy / dd * (pd - 90));
      } else go('sit', 2500 + Math.random() * 2000);
    }
  } else if (g.m === 'shun') {
    if (!g.ph) {
      g.ph = 1;
      const dx = h.x - pos.x, dy = h.y - pos.y, dd = Math.hypot(dx, dy) || 1;
      aim(h.x + dx / dd * (80 + Math.random() * 40), h.y + dy / dd * 50);
    }
    strip = 'c-cat.png'; spd = AWAY[0] * pace; fr = AWAY[1] / pace;
    if (there()) { g.shunAt = now + 1500; go('sit', 2000 + Math.random() * 2000); }
  } else if (g.m === 'purr') {
    hold(); strip = 'c-cathappy.png';
    if (now > g.until) go('sit', 2000 + Math.random() * 2000);
  }
  catStrip(h, strip, now);
  h.dspd = spd; h.dfr = fr || CAT[strip][1];
  // she breathes in her sleep and her tail keeps going while she stands
  if (spd === 0 && now - h.frameAt > h.dfr) { h.frameAt = now; h.frame = (h.frame + 1) % h.nf; }
}
// a tap: asleep she stays asleep (a stroke is a longer nap), a stranger or a shy one walks off,
// anyone else purrs at you. The hug itself is henMood's, the same as every animal's.
export function pet(h) {
  const g = h.cg;
  if (!g || !h.a) return;
  if ((g.m === 'nap' || g.m === 'shelter') && g.ph === 1) { if (g.until) g.until += 4000; return; }
  const t = h.tr || traitsOf(h.a);
  if (lvOf(h.a) < 3 && t.bold === 0) { g.m = 'shun'; g.ph = 0; return; }
  g.m = 'purr'; g.ph = 0; g.until = (g.now || 0) + 2600;
}
