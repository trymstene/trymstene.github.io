// 🌗🌳 THE PARK AT NIGHT (3 Oct 2026, design library §56) — the park's half of the world's night: WHERE its lights are.
//
// Trym, 3 Oct 2026: "Start with the park, not sure the park have many light-sources by default for the nights? Might need
// to make some?" It had none — its lamps were cut from the plate in August. The generator puts eight back, the town's own
// post (LAMPS in tools/build-park-scene.py), and this lazy chunk lights them one by one through the dusk, lights the stand's
// counter and the mushroom shop's glass, lets the fireflies out over the pond, the meadow and under the trees, and gives
// every banana its little light. The dark itself is world-night.js on #pkView.
import { mountNight } from './world-night.js';
import { litAt } from '../lib/world.js';
import { OVERLAYS, LAMPS, LAMP_HALO, MARKET, POND, MEADOW, TREE_OVS } from './park-geo.js';

const LAMP = [255, 168, 84], WINDOW = [255, 176, 86], ME = [235, 196, 150], FLY = [206, 255, 118];
// 🪟 the stand's counter and the mushroom shop's glass, in each sprite's own px (ov-16, ov-17): [cx, cy, w, h, bloom]
const PANES = { stand: [88, 88, 88, 48, 0.4], cart: [100, 208, 96, 44, 0.35] };
const seed = (n) => { const x = Math.sin(n * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };

/**
 * @param view     the park's #pkView
 * @param weather  the park's weather (the night is LINKED to it: a shop's door hides both)
 * @param p        from banana-park.js: { world, W, H, pct, hideEl, scale, cam, pos, peers, kind } — getters where it moves
 */
export function mountParkNight(view, weather, p) {
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 💡 the posts are the plate's overlays; over each one, hidden till it is dark enough for IT, the pack's lit frames
  const lamps = LAMPS.map(([i, fl]) => {
    const o = OVERLAYS[i];
    const L = { x: o[1], y: o[2], w: o[3], h: o[4], fl: !!fl, on: false, el: null };
    if (LAMP_HALO) {
      const d = document.createElement('div');
      d.className = 'pk-lamp' + (L.fl ? ' is-flip' : '');
      d.style.left = p.pct(L.x + (L.fl ? LAMP_HALO.dxf : LAMP_HALO.dx), p.W);
      d.style.top = p.pct(L.y + LAMP_HALO.dy, p.H);
      d.style.width = p.pct(LAMP_HALO.w, p.W);
      d.style.height = p.pct(LAMP_HALO.h, p.H);
      d.style.zIndex = String(101 + o[5]);
      p.hideEl(d, true);
      p.world.appendChild(d);
      L.el = d;
    }
    return L;
  });
  const panes = Object.keys(PANES).map((k) => {
    const m = MARKET[k], o = m && OVERLAYS.find((q) => q[5] === m[1] && Math.abs(q[1] + q[3] / 2 - m[0]) < 4);
    return o ? { x: o[1], y: o[2], base: o[5], pane: PANES[k] } : null;
  }).filter(Boolean);
  // ✨ the fireflies' haunts: the pond's banks, the meadow, under every other tree
  const flies = [0.35, 0.95, 1.55, 2.15, 2.75, 5.85].map((a) => [POND.x + Math.cos(a) * POND.rx * 1.08, POND.y + Math.sin(a) * POND.ry * 1.18]);
  for (let n = 0; n < 5; n++) flies.push([MEADOW[0] + seed(n) * (MEADOW[2] - MEADOW[0]), MEADOW[1] + seed(n + 9) * (MEADOW[3] - MEADOW[1])]);
  TREE_OVS.forEach((i, n) => { if (n % 2 === 0) { const o = OVERLAYS[i]; flies.push([o[1] + o[3] / 2, o[5] - 26]); } });

  function lights(dark) {
    const k = p.scale(), c = p.cam(), out = [];
    const put = (x, y, r, col, i, bloom, more) => out.push({ x: x * k - c.x, y: y * k - c.y, r: r * k, c: col, i, bloom, ...more });
    for (const L of lamps) {
      if (!L.on) continue;
      put(L.x + L.w / 2 + (L.fl ? -4 : 4), L.y + L.h * 0.92, 170, LAMP, 0.95, 0, { sq: 1.6 });   // the pool on the ground
      put(L.x + L.w * (L.fl ? 0.28 : 0.72), L.y + L.h * 0.2, 38, LAMP, 0.35, 0.75);              // …and the glass
    }
    for (const s of panes) {
      const [cx, cy, w, h, b] = s.pane;
      put(s.x + cx, s.y + cy, 23, WINDOW, 0.75, b, { sq: 1, rect: [w * k, h * k] });
      put(s.x + cx, s.base + 14, 110, WINDOW, 0.55, 0, { sq: 1.6 });   // the light it throws out on the path
    }
    // ✨ a soft green spark each, drifting and blinking — out once the dusk is deep, and only under a clear sky
    const out_ = Math.min(1, Math.max(0, (dark - 0.55) / 0.3)) * ({ clear: 1, drizzle: 0.4 }[p.kind()] || 0);
    if (out_ > 0) {
      const t = still ? 0 : performance.now() / 1000;
      flies.forEach(([hx, hy], n) => {
        const ph = seed(n + 40) * 6.28, sp = 0.5 + seed(n + 60) * 0.5;
        const x = hx + Math.sin(t * 0.31 * sp + ph) * 34 + Math.sin(t * 0.83 * sp + ph * 2) * 10;
        const y = hy + Math.cos(t * 0.27 * sp + ph) * 20 + Math.sin(t * 0.71 * sp + ph) * 8;
        const blink = still ? 0.6 : Math.pow(Math.max(0, Math.sin(t * (0.9 + seed(n + 80) * 0.8) + ph * 3)), 3);   // a glow, then a long dark
        if (blink > 0.04) put(x, y, 15, FLY, 0.6 * blink * out_, 0.9 * blink * out_);
      });
    }
    const me = p.pos();
    put(me.x, me.y - 40, 58, ME, 0.4, 0);   // a banana carries a little light of its own…
    for (const q of p.peers().values()) if (Number.isFinite(q.x) && Number.isFinite(q.y)) put(q.x, q.y - 40, 50, ME, 0.32, 0);   // …and so does every visitor
    return out;
  }
  // 🔤 Old Peel's words and the animals' moods stay readable, and a reward's float glows (world-night.js)
  const night = weather.link(mountNight(view, { lights, keep: '.pk-mood.is-on', glow: '.pk-float' }));
  night.lights = () => lights(night.level());   // 🧪 what the walk reads: every light the park hands over right now
  // 🌗 each lamp comes on when the sky is dark enough for IT (world.js litAt), the plaza's four first
  const tick = night.tick;
  let litSig = '';
  night.tick = (now) => {
    tick(now);
    const d = night.level();
    let sig = '';
    lamps.forEach((L, n) => { L.on = litAt(d, n / lamps.length); sig += L.on ? 1 : 0; });
    if (sig === litSig) return;
    litSig = sig;
    for (const L of lamps) if (L.el) p.hideEl(L.el, !L.on);
  };
  night.lamps = () => lamps.map((L) => L.on);
  // 🧪 the hour a QA walk's sky starts at (?parktest only): ?skyh=21 for one that must begin in the dark, and noon for any
  // other AUTOMATED walk (navigator.webdriver) — the park's animals keep night hours, so a walk on the real clock would pass
  // or fail by the time of day it ran. A person on ?parktest sees the real sky.
  const q = new URLSearchParams(location.search);
  const skyh = q.has('parktest') && (q.get('skyh') || (navigator.webdriver ? '11' : null));
  if (skyh) night.hour(+skyh);
  return night;
}
