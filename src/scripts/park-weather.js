// 🌦 THE PARK'S WEATHER — three tiers, one clock, almost no runtime cost.
//
// The clock (src/lib/world.js, mirrored in the worker) is a PURE FUNCTION OF
// TIME, so this module never asks the server what the weather is: it computes
// the same answer the ParkRoom is charging health from. That is why rain starts
// on the same second for everyone in the park without a single message.
//
// ⚠️ RENDERING IS CSS ONLY. Two tiling streak layers translated by keyframes,
// one scrim, one lightning flash — four composited elements whatever the
// weather, versus the ~200 positioned children we spent 30 Jul removing. No
// canvas, no element per drop, and NOTHING added to the rAF loop.
// ⚠️ They live in .pk-view, NOT .pk-world: rain falls on the viewport, not on
// the map, so it must not pan with the camera.
import { weatherAt, seedRand } from '../lib/world.js';
import { passStat } from '../lib/banana-pass.js';
import { track } from './park-util.js';

// how many puddles each tier leaves lying about
const PUDDLES = { clear: 0, drizzle: 3, heavy: 7, storm: 12 };
const PUDDLE_REP = 1;              // splashing one pays the acorn's trickle

export function initWeather(ctx) {
  const { W, H, world, pct, pos, float, refreshHud } = ctx;
  const view = document.getElementById('pkView');
  if (!view) return { wxTick: () => {}, now: () => 'clear' };

  // ---- the layers ---------------------------------------------------------
  const wrap = document.createElement('div');
  wrap.className = 'pk-wx';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<i class="pk-wx__scrim"></i>'
    + '<i class="pk-wx__rain pk-wx__rain--far"></i>'
    + '<i class="pk-wx__rain pk-wx__rain--near"></i>'
    + '<i class="pk-wx__flash"></i>';
  view.appendChild(wrap);

  let kind = 'clear';
  const puddles = [];
  // one seed per DAY per tier — the same rain leaves the same puddles for
  // everybody, and they are still somewhere new tomorrow
  const wxSeed = () => Math.floor(Date.now() / 86400000) * 7919
    + { clear: 0, drizzle: 1, heavy: 2, storm: 3 }[kind] * 104729;

  // 🍂 the storm's debris: five leaves driven across the VIEW (not the map),
  // each on its own duration and delay so they never march in step. Built once
  // and switched by class — nothing is created or destroyed per storm.
  const leaves = [];
  for (let i = 0; i < 5; i++) {
    const l = document.createElement('i');
    l.className = 'pk-leafblow';
    l.style.top = (8 + i * 17) + '%';
    l.style.animationDuration = (2.4 + i * 0.6) + 's';
    l.style.animationDelay = (-i * 1.3) + 's';
    if (i % 2) l.style.backgroundImage = "url('/assets/park/l-leaf2.png')";
    wrap.appendChild(l);
    leaves.push(l);
  }

  // 🌦 THE POST-STORM NOTICE. Deliberately NOT a broadcast during the storm
  // — it is for the visitor who arrives later and finds a wrecked park with no
  // explanation (Trym). ⚠️ only while health is STILL under 30%: if the
  // regulars already restored it to 90 there is nothing to tell anyone, and a
  // notice about a storm nobody can see is just noise. Once per visit.
  const note = document.createElement('div');
  note.className = 'pk-stormnote';
  note.hidden = true;
  note.innerHTML = '<b>the morning after</b><span>oh no — a storm came through. '
    + 'Somebody has some tidying to do.</span>';
  view.appendChild(note);
  let noted = false;
  function stormNote(stormAt, health) {
    if (noted || !stormAt || health >= 30) return;
    if (Date.now() - stormAt > 12 * 3600000) return;   // ancient history
    noted = true;
    note.hidden = false;
    requestAnimationFrame(() => note.classList.add('is-on'));
    setTimeout(() => { note.classList.remove('is-on'); setTimeout(() => { note.hidden = true; }, 600); }, 11000);
    track('park_stormnote');
  }

  // ---- 💧 puddles: they OUTLIVE the rain and fade, so the park stays wet for
  // a while afterwards. Walk through one to splash it away (the acorn
  // grammar). ⚠️ rep only, NEVER health — puddles appear in drizzle, and
  // drizzle costing health would make the cosmetic tier not cosmetic.
  // ⚠️ SEEDED, NOT RANDOM. These were Math.random() per client, so every
  // visitor saw a different set and they jumped to new spots on every reload
  // (Trym: "ponds move around for each refresh?"). The park is shared and the
  // weather clock is a pure function of time — the puddles it leaves have to
  // be too, or the same rain looks like a different park to each person.
  function puddleAdd(n) {
    const spots = ctx.puddleSpots;
    let g = null;
    for (let k = 0; k < 12 && !g; k++) {      // walk the seed until one sticks
      const c = spots[Math.floor(seedRand(0x9d7 + wxSeed() + n * 977 + k * 31) * spots.length)];
      if (c && !puddles.some((p) => Math.hypot(p.x - c[0], p.y - c[1]) < 90)) g = c;
    }
    if (!g) return;
    const el = document.createElement('div');
    el.className = 'pk-puddle';
    el.style.left = pct(g[0], W);
    el.style.top = pct(g[1], H);
    el.style.zIndex = String(100 + Math.round(g[1]) - 2);   // under everything that walks
    world.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    puddles.push({ el, x: g[0], y: g[1] });
  }
  function puddleGo(i) {
    const p = puddles[i];
    p.el.classList.add('is-out');
    setTimeout(() => p.el.remove(), 420);
    puddles.splice(i, 1);
  }
  let splashed = false;
  function puddleTick() {
    for (let i = puddles.length - 1; i >= 0; i--) {
      const p = puddles[i];
      if (Math.hypot(pos.x - p.x, (pos.y - 6) - p.y) < 34) {
        puddleGo(i);
        passStat('rep', PUDDLE_REP);
        refreshHud();
        float(p.x, p.y - 10, '+' + PUDDLE_REP);
        if (!splashed) { splashed = true; track('park_puddle'); }
      }
    }
  }

  // ---- the tier switch ----------------------------------------------------
  function setKind(k) {
    if (k === kind) return;
    kind = k;
    wrap.className = 'pk-wx' + (k === 'clear' ? '' : ' is-' + k);
    // puddles build up while it rains and are left behind when it stops
    const want = PUDDLES[k] || 0;
    while (puddles.length < want) puddleAdd(puddles.length);
    // 🐔🐦🦋 the park reacts. Every one of these is an EXISTING state machine
    // being biased — shelter targets, a roster multiplier, the on/off switches
    // the bloom phases already drive — not new behaviour bolted on.
    if (ctx.critters && ctx.critters.setWeather) ctx.critters.setWeather(k);
    if (ctx.birds && ctx.birds.setWeather) ctx.birds.setWeather(k);
    if (ctx.critters) {
      // butterflies and squirrels are fair-weather only; the phase system puts
      // them back when it clears (setPhase re-asserts on the next band change,
      // and we re-assert here so clearing skies bring them straight back)
      const fair = k === 'clear' || k === 'drizzle';
      ctx.critters.setBflies(fair && ctx.phase() >= 4);
      ctx.critters.setSquirrels(fair && ctx.phase() >= 3);
    }
    leaves.forEach((l) => l.classList.toggle('is-on', k === 'storm'));
    if (ctx.npc && ctx.npc.oldPhasePoke) ctx.npc.oldPhasePoke();   // he has a view on this
    if (k !== 'clear') track('park_weather', { kind: k });
  }

  // one cheap check a second — the clock is arithmetic, not a fetch
  let checkAt = 0;
  function wxTick(now) {
    if (now > checkAt) {
      checkAt = now + 1000;
      setKind(ctx.wxForce || weatherAt(Date.now()).type);
    }
    puddleTick();
  }

  return { wxTick, stormNote, now: () => kind, qa: { puddles, setKind, note } };
}
