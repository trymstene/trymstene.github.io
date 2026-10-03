// 🌗🏖 THE BAY AT NIGHT (3 Oct 2026, design library §56) — the bay's half of the world's night: WHERE its lights are.
//
// Trym, 3 Oct 2026: "Continue with the beach. not sure streetlights are the best solution, if there exist torches, or just
// use more bonfires for the beach maybe that fits the beach better for some extra lightning - the wooden bay area with the
// stalls all to the right could probably have some lightposts / fitting streetlight a couple of places". No pack he owns
// has a torch, so the sand burns campfires: the bonfire ring, and three fire pits the generator lays with logs (FIRE_PITS
// in tools/build-beach-scene.py) that this chunk lights one by one at sunset with the bonfire's own flame. The deck gets
// the world's lamp at its four corners (LAMPS), lighting the planks under them. The hut's window, the stalls' counters, the
// ship bar and the claw machine glow, and every banana carries its little light. The dark itself is world-night.js.
import { mountNight } from './world-night.js';
import { litAt } from '../lib/world.js';
import { OVERLAYS, LAMPS, LAMP_HALO, FIRE_PITS, BONFIRE, HUT, STALLS, GRABBER, BAR } from './beach-geo.js';

const FIRE = [255, 142, 60], LAMP = [255, 168, 84], WINDOW = [255, 176, 86], ME = [235, 196, 150], CLAW = [214, 196, 255];

/**
 * @param view     the bay's #bhView
 * @param weather  the bay's weather (the night is LINKED to it: a room's door hides both)
 * @param p        from banana-beach.js: { world, W, H, pct, hideEl, scale, cam, pos, peers } — getters where it moves
 */
export function mountBayNight(view, weather, p) {
  // 🔥 the pits' flames (the bonfire's own .bh-fire), hidden till the sky is dark enough for each
  const pits = FIRE_PITS.map(([x, y]) => {
    const f = document.createElement('div');
    f.className = 'bh-fire';
    f.style.left = p.pct(x, p.W); f.style.top = p.pct(y, p.H);
    f.style.zIndex = String(101 + y);
    p.hideEl(f, true);
    p.world.appendChild(f);
    return { x, y, el: f, on: false };
  });
  // 💡 the deck's lamps: the posts are the plate's overlays; over each one the pack's lit lamp (n-lamp.png)
  const lamps = LAMPS.map(([i, fl]) => {
    const o = OVERLAYS[i];
    const L = { x: o.x, y: o.y, w: o.w, h: o.h, fl: !!fl, on: false, el: null };
    if (LAMP_HALO) {
      const d = document.createElement('div');
      d.className = 'bh-lamp' + (L.fl ? ' is-flip' : '');
      d.style.left = p.pct(L.x + (L.fl ? LAMP_HALO.dxf : LAMP_HALO.dx), p.W);
      d.style.top = p.pct(L.y + LAMP_HALO.dy, p.H);
      d.style.width = p.pct(LAMP_HALO.w, p.W);
      d.style.height = p.pct(LAMP_HALO.h, p.H);
      d.style.zIndex = String(101 + o.base);
      p.hideEl(d, true);
      p.world.appendChild(d);
      L.el = d;
    }
    return L;
  });
  const lit = [...pits, ...lamps];   // one dusk for both: the fires catch first, then the deck

  function lights() {
    const k = p.scale(), c = p.cam(), out = [];
    const put = (x, y, r, col, i, bloom, more) => out.push({ x: x * k - c.x, y: y * k - c.y, r: r * k, c: col, i, bloom, ...more });
    put(BONFIRE.x, BONFIRE.y - 18, 210, FIRE, 1, 0.85, { flicker: 'fire' });   // the ring burns day and night
    for (const f of pits) if (f.on) put(f.x, f.y - 16, 165, FIRE, 0.95, 0.75, { flicker: 'fire' });
    for (const L of lamps) if (L.on) put(L.x + L.w / 2 + (L.fl ? -4 : 4), L.y + L.h * 0.92, 170, LAMP, 0.95, 0, { sq: 1.6 });   // the planks under it, and only those
    put(HUT.win.x + HUT.win.w / 2, HUT.win.y + HUT.win.h / 2, 23, WINDOW, 0.75, 0.4, { sq: 1, rect: [HUT.win.w * k, HUT.win.h * k] });   // the hut's window
    put(HUT.x, HUT.y + 14, 110, WINDOW, 0.55, 0, { sq: 1.6 });
    for (const s of STALLS) put(s.x, s.y - 22, 70, WINDOW, 0.7, 0.35);   // a lamp under each awning
    put(BAR.x, BAR.y - 70, 130, WINDOW, 0.7, 0.3);   // the ship bar keeps its lanterns on
    put(GRABBER.x, GRABBER.y - 70, 72, CLAW, 0.7, 0.5);   // the claw machine glows
    const me = p.pos();
    put(me.x, me.y - 40, 58, ME, 0.4, 0);   // a banana carries a little light of its own…
    for (const q of p.peers().values()) if (Number.isFinite(q.x) && Number.isFinite(q.y)) put(q.x, q.y - 40, 50, ME, 0.32, 0);   // …and so does every visitor
    return out;
  }
  const night = weather.link(mountNight(view, { lights, cam: p.cam }));
  night.lights = lights;   // 🧪 what the walk reads: every light the bay hands over right now
  // 🌗 the pits and the lamps come on when the sky is dark enough for each (world.js litAt)
  const tick = night.tick;
  let litSig = '';
  night.tick = (now) => {
    tick(now);
    const d = night.level();
    let sig = '';
    lit.forEach((q, n) => { q.on = litAt(d, n / lit.length); sig += q.on ? 1 : 0; });
    if (sig === litSig) return;
    litSig = sig;
    for (const q of lit) if (q.el) p.hideEl(q.el, !q.on);
  };
  night.lit = () => ({ pits: pits.map((f) => f.on), lamps: lamps.map((L) => L.on) });
  // 🧪 the hour a QA walk's sky starts at (?beachtest only): ?skyh=21 for one that must begin in the dark, and noon for any
  // other AUTOMATED walk (navigator.webdriver), so a walk never passes or fails by the time of day it ran
  const q = new URLSearchParams(location.search);
  const skyh = q.has('beachtest') && (q.get('skyh') || (navigator.webdriver ? '11' : null));
  if (skyh) night.hour(+skyh);
  return night;
}
