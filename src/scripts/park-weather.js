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
import { weatherAt } from '../lib/world.js';
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

  // ---- 💧 puddles: they OUTLIVE the rain and fade, so the park stays wet for
  // a while afterwards. Walk through one to splash it away (the acorn
  // grammar). ⚠️ rep only, NEVER health — puddles appear in drizzle, and
  // drizzle costing health would make the cosmetic tier not cosmetic.
  function puddleAdd() {
    const g = ctx.puddleSpots[Math.floor(Math.random() * ctx.puddleSpots.length)];
    if (!g) return;
    if (puddles.some((p) => Math.hypot(p.x - g[0], p.y - g[1]) < 90)) return;
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
    while (puddles.length < want) puddleAdd();
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

  return { wxTick, now: () => kind, qa: { puddles, setKind } };
}
