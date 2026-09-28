// 🚶 WHERE AN ECHO MAY WALK, CHECKED (29 Sep 2026; design library §42). The park's and the bay's echoes stroll between the
// points of src/data/echo-routes.js along its links. Every point and every step of every link is walked here against the
// area's own colliders (the generated park-geo.js / beach-geo.js, the same rectangles and circles the player bumps into) and
// against the places a stranger never stands: the fountain's basin and Old Peel's bench, the pond; the court, the hut, the
// bar, the stalls' deck, the pier and the water. Used by tools/check-design.mjs; `node tools/echo-routes-check.mjs` prints it.
import * as PARK from '../src/scripts/park-geo.js';
import * as BEACH from '../src/scripts/beach-geo.js';
import { ECHO_ROUTES } from '../src/data/echo-routes.js';
import { pathToFileURL } from 'node:url';

const FOOT = 16;   // how far a banana's feet keep from anything solid (its drawn body is 99 px wide, its feet about 30)
const inRect = (x, y, r, m) => x > r[0] - m && x < r[2] + m && y > r[1] - m && y < r[3] + m;
// the places, per area: [what it is, a test (x, y) → true when the feet are there]
const ZONES = {
  park: [
    ['the edge of the park', (x, y) => x < PARK.BOUND + FOOT || x > PARK.WORLD.w - PARK.BOUND - FOOT || y < PARK.BOUND + FOOT || y > PARK.WORLD.h - PARK.BOUND - FOOT],
    ['a solid (park-geo OB_RECTS)', (x, y) => PARK.OB_RECTS.some((r) => inRect(x, y, r, FOOT))],
    ['a solid (park-geo OB_CIRCLES)', (x, y) => PARK.OB_CIRCLES.some((c) => Math.hypot(x - c[0], y - c[1]) < c[2] + FOOT)],
    ['the pond', (x, y) => { const px = (x - PARK.POND.x) / (PARK.POND.rx + FOOT), py = (y - PARK.POND.y) / (PARK.POND.ry + FOOT); return px * px + py * py < 1; }],
    // the basin and the statue's plinth, as drawn — its collider is only the middle 39 px
    ['the fountain', (x, y) => Math.hypot(x - PARK.FOUNTAIN[0], y - PARK.FOUNTAIN[1]) < 105],
    // Old Peel sits here most of the day: a stranger stands off
    ["Old Peel's bench", (x, y) => Math.hypot(x - PARK.OLDBENCH[0], y - PARK.OLDBENCH[1]) < 80],
    // a plot is its centre and the shared solid offset (BED_SOLID), open or not: nobody strolls through a garden bed
    ['the garden', (x, y) => PARK.PLOTS.some(([px, py]) => inRect(x, y, [px + PARK.BED_SOLID[0], py + PARK.BED_SOLID[1], px + PARK.BED_SOLID[2], py + PARK.BED_SOLID[3]], FOOT + 12))],
  ],
  beach: [
    ['the water', (x, y) => y < BEACH.WATER_Y + 40],
    ['the edge of the bay', (x, y) => x < 40 || x > BEACH.WORLD.w - 40 || y > BEACH.WORLD.h - 40],
    ['a solid (beach-geo OB_RECTS)', (x, y) => BEACH.OB_RECTS.some((r) => inRect(x, y, r, FOOT))],
    ['a solid (beach-geo OB_CIRCLES)', (x, y) => BEACH.OB_CIRCLES.some((c) => Math.hypot(x - c[0], y - c[1]) < c[2] + FOOT)],
    // Sandy's game: a stranger never walks across the court
    ['the court', (x, y) => inRect(x, y, [BEACH.COURT.x0, BEACH.COURT.y0, BEACH.COURT.x1, BEACH.COURT.y1], 24)],
    ['the bar', (x, y) => Math.hypot(x - BEACH.BAR.x, y - BEACH.BAR.y) < BEACH.BAR.r + 24],
    ['the hut', (x, y) => inRect(x, y, [BEACH.HUT.x - BEACH.HUT.w / 2, BEACH.HUT.y - BEACH.HUT.h, BEACH.HUT.x + BEACH.HUT.w / 2, BEACH.HUT.y], 24)],
    ["the stalls' deck", (x, y) => x > 1960],
    ['the pier', (x, y) => inRect(x, y, [BEACH.PLATFORM.x0, BEACH.PLATFORM.y0, BEACH.PLATFORM.x1, BEACH.PLATFORM.y1 + 40], FOOT)],
    ['the bonfire', (x, y) => Math.hypot(x - BEACH.BONFIRE.x, y - BEACH.BONFIRE.y) < 110],
  ],
};

// every fault in one area's route, as sentences
export function routeFaults(area, route = ECHO_ROUTES[area]) {
  const out = [], zones = ZONES[area];
  if (!route || !Array.isArray(route.pts) || !Array.isArray(route.links)) return ['no route for ' + area + ' in src/data/echo-routes.js'];
  const hit = (x, y) => { for (const [what, t] of zones) if (t(x, y)) return what; return ''; };
  route.pts.forEach(([x, y], i) => { const w = hit(x, y); if (w) out.push(area + ' point ' + i + ' (' + x + ', ' + y + ') stands in ' + w); });
  const seen = new Set();
  for (const [a, b] of route.links) {
    const p = route.pts[a], q = route.pts[b];
    if (!p || !q) { out.push(area + ' link ' + a + '–' + b + ' names a point that is not there'); continue; }
    const key = Math.min(a, b) + '-' + Math.max(a, b);
    if (seen.has(key)) out.push(area + ' link ' + a + '–' + b + ' is listed twice');
    seen.add(key);
    const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 4);
    for (let k = 1; k < n; k++) {
      const x = p[0] + (q[0] - p[0]) * k / n, y = p[1] + (q[1] - p[1]) * k / n, w = hit(x, y);
      if (w) { out.push(area + ' link ' + a + '–' + b + ' walks through ' + w + ' at (' + Math.round(x) + ', ' + Math.round(y) + ')'); break; }
    }
  }
  // one walk: every point reachable from every other, and every point has somewhere to go
  const nb = route.pts.map(() => []);
  for (const [a, b] of route.links) if (nb[a] && nb[b]) { nb[a].push(b); nb[b].push(a); }
  nb.forEach((l, i) => { if (!l.length) out.push(area + ' point ' + i + ' has no link: an echo there could never leave'); });
  const reach = new Set([0]), todo = [0];
  while (todo.length) for (const j of nb[todo.pop()] || []) if (!reach.has(j)) { reach.add(j); todo.push(j); }
  if (reach.size !== route.pts.length) out.push(area + ' route is in pieces: ' + (route.pts.length - reach.size) + ' point(s) cannot be walked to from point 0');
  return out;
}
export const routeAreas = () => Object.keys(ZONES);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0;
  for (const a of routeAreas()) { const f = routeFaults(a); bad += f.length; console.log(a + ': ' + (f.length ? '\n  ' + f.join('\n  ') : 'every point and link clear')); }
  process.exit(bad ? 1 : 0);
}
