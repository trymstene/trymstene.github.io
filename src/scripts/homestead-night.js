// 🌗🏡 THE HOMESTEAD AT NIGHT (3 Oct 2026, design library §56) — the yard's half of the world's night: WHERE its lights are.
//
// Trym, 2 Oct 2026: "isnt this an opportunity to really make cozy lighting? that lamps and bonfires, streetlights, windows,
// decorations and all this actually makes the night light a bit up - this is core cozy - especially in the homestead which
// arent haunted". The dark itself is world-night.js on the yard's view; this lazy chunk (loaded with it, never
// on the yard's first frame) hands it the lights: your home's windows, the lighting decor on the plot, every banana.
import { mountNight } from './world-night.js';

// 🏠 a home's lit panes, in its sprite's own px (= world px from the sprite's top-left; ov-<style>.png), [cx, cy, w, h, strength].
// Read off the art: the mobile homes' glass by colour, the country house's by eye (its slate roof is glass-coloured too), and
// a tent, which has no window, glows at its door and its flap — a lantern lit inside.
const TENT = [[56, 113, 30, 20, 0.8], [86, 109, 14, 14, 0.7]];
const HOME_LIGHTS = {
  tent1: TENT, tent2: TENT, tent3: TENT,
  mobm3: [[21.5, 107.5, 13, 19, 1], [126.5, 107.5, 21, 23, 1], [158.5, 107.5, 21, 23, 1]],
  mobm7: [[17, 86, 10, 16, 1], [101.5, 86, 17, 18, 1], [127.5, 86, 17, 18, 1], [58.5, 92, 26, 30, 0.45]],
  country: [[208, 141, 17, 20, 1], [166, 196, 33, 22, 1], [232, 196, 30, 18, 1], [90.5, 190.5, 12, 17, 1], [43.5, 192.5, 13, 11, 0.6],
    [162, 270, 27, 14, 0.8], [230.5, 267.4, 30, 9, 0.8]],
};
const FIRE = [255, 142, 60], LANTERN = [255, 164, 78], WINDOW = [255, 176, 86], ME = [235, 196, 150];
// 💡 a home with a light on inside glows at its windows; one without glows faintly (3 Oct 2026, the night touches). A tent has
// no inside: its lantern is always lit.
const INDOOR = new Set(['tlantern', 'readlamp', 'dresserlamp', 'fireplace', 'bluelamp', 'lavalamp', 'fairylights', 'jackolantern', 'lantern', 'lantern2', 'marshfire']);
const litInside = (st, tier) => ((st.inItems && st.inItems[tier]) || []).some((i) => INDOOR.has(i.id));
// 🔥 the catalog's lights on the plot, world px: [lift above the foot, radius, colour, light, bloom, flicker]. A campfire lights
// only when it is lit (its own toggle); everything else is lit whenever it is dark.
const DECOR = {
  campfire: [26, 162, FIRE, 1, 0.85, 'fire'], marshfire: [23, 127, FIRE, 0.9, 0.6, 'fire'],
  lantern2: [38, 107, LANTERN, 0.85, 0.55], lantern: [20, 93, LANTERN, 0.8, 0.5], tlantern: [17, 84, LANTERN, 0.75, 0.5],
  jackolantern: [26, 69, FIRE, 0.7, 0.5, 'fire'],
};

/**
 * @param view     the yard's #hsView
 * @param weather  the yard's weather (the night is LINKED to it: the house's door hides both)
 * @param y        getters from banana-homestead.js: { state, styleKey, dims, scale, cam, pos, peers, inside, tier } — all getters:
 *                 some of what they read is declared further down the yard's boot than the line that mounts this
 */
export function mountYardNight(view, weather, y) {
  function lights() {
    if (y.inside()) return [];
    const k = y.scale(), c = y.cam(), out = [];
    const put = (x, yy, r, col, i, bloom, more) => out.push({ x: x * k - c.x, y: yy * k - c.y, r: r * k, c: col, i, bloom, ...more });
    const st = y.state();
    const panes = st.stage >= 1 ? HOME_LIGHTS[y.styleKey()] : null;
    if (panes && st.home) {
      const d = y.dims(), x0 = st.home.x - d.w / 2, y0 = st.home.y - d.h;
      const on = panes === TENT || litInside(st, y.tier()) ? 1 : 0.4;
      for (const [px, py, w, h, s] of panes) put(x0 + px, y0 + py, 23, WINDOW, 0.7 * s * on, 0.55 * s * on, { sq: 1, rect: [w * k, h * k] });
    }
    for (const it of st.items || []) {
      const L = DECOR[it.id];
      if (!L || (it.id === 'campfire' && !it.lit)) continue;
      put(it.x, it.y - L[0], L[1], L[2], L[3], L[4], L[5] ? { flicker: L[5] } : null);
    }
    const me = y.pos();
    put(me.x, me.y - 40, 58, ME, 0.4, 0);   // a banana carries a little light of its own…
    for (const p of y.peers().values()) if (Number.isFinite(p.x) && Number.isFinite(p.y)) put(p.x, p.y - 40, 50, ME, 0.32, 0);   // …and so does every visitor
    return out;
  }
  const night = weather.link(mountNight(view, { lights }));
  night.lights = lights;   // 🧪 what the walk reads: every light the yard hands over right now
  // 🧪 the hour a QA walk's sky starts at (?hstest only): ?skyh=21 for one that must begin in the dark (the cat's gift), and
  // noon for any other AUTOMATED walk (navigator.webdriver) — the yard's animals keep night hours now, so a walk on the real
  // clock would pass or fail by the time of day it ran. A person on ?hstest sees the real sky.
  const q = new URLSearchParams(location.search);
  const skyh = q.has('hstest') && (q.get('skyh') || (navigator.webdriver ? '11' : null));
  if (skyh) night.hour(+skyh);
  return night;
}
