// ⛔ THE VISITORS' LANES CARRY NO PROPS, AND STILL REACH EVERYWHERE.
//
// Trym, 20 Sep: "the visiting roaming bananas overflows some objects in the town, the fountain they
// just walk right through." They did — STREETS is the walkable ground, the plaza is one rectangle
// with the fountain standing in the middle of it, and route() drew a straight line across. The fix
// carves the colliders out of the streets in town-folk.js; THIS is what keeps it true when somebody
// moves a prop, because a carve that quietly walls the square in half is just as broken as a lane
// with a fountain in it.
//
// Three assertions, and the first two pull against each other on purpose:
//   1. no lane overlaps any collider  — nobody walks through anything
//   2. the lanes are ONE component    — and everybody can still get everywhere
//   3. no errand's whole POLYLINE, gate to destination, cuts a collider — because route() draws
//      straight lines between crossings and the last one lands off every lane on purpose
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];

const geo = await import(pathToFileURL(join(ROOT, 'src/scripts/town-geo.js')).href);
const geoConst = (k) => {
  if (!(k in geo)) throw new Error('town-geo.js has no ' + k);
  return geo[k];
};
const OB_RECTS = geoConst('OB_RECTS');
const OB_CIRCLES = geoConst('OB_CIRCLES');

// ⚠️ THE LANES ARE READ OUT OF THE CHUNK THAT USES THEM, not rebuilt here from a copy of the rules.
// A second implementation of carve() in this file would pass while the shipped one was wrong — the
// exact trap the mirrored growth tables already cost us once (memory: park-beds-plan).
const folkSrc = readFileSync(join(ROOT, 'src/scripts/town-folk.js'), 'utf8');
const mod = await import('data:text/javascript;base64,' + Buffer.from(
  folkSrc
    .replace(/^import \{([^}]*)\} from '\.\/town-geo\.js';/m,
      "const {$1} = " + JSON.stringify({ STREETS: geoConst('STREETS'), SPOTS: geoConst('SPOTS'), SEATS: geoConst('SEATS'), OB_RECTS, OB_CIRCLES }) + ';')
    .replace(/^import .*$/gm, '')
    + ['', 'export const __lanes = LANES;', 'export const __route = route;', 'export const __near = nearLane;', ''].join('\n'),
).toString('base64'));
const LANES = mod.__lanes;

if (!LANES || LANES.length < 12) fail.push(`only ${LANES ? LANES.length : 0} lanes — the carve collapsed the town`);

// ---- 1. no lane carries a prop -----------------------------------------------------------------
const boxes = [
  ...OB_RECTS.map((r) => ({ b: r, what: 'rect ' + JSON.stringify(r) })),
  ...OB_CIRCLES.map((c) => ({ b: [c[0] - c[2], c[1] - c[2], c[0] + c[2], c[1] + c[2]], what: 'circle ' + JSON.stringify(c) })),
];
// a lane and a collider may TOUCH — the carve leaves lanes flush against what it cut out. Only real
// overlap is a banana inside a prop, so a shared edge (and the pad the carve already added) is fine.
const EAT = 2;
for (const [i, L] of LANES.entries()) {
  for (const { b, what } of boxes) {
    const ox = Math.min(L[2], b[2]) - Math.max(L[0], b[0]);
    const oy = Math.min(L[3], b[3]) - Math.max(L[1], b[1]);
    if (ox > EAT && oy > EAT) fail.push(`lane ${i} ${JSON.stringify(L)} walks through ${what} (${ox}×${oy} px inside it)`);
  }
}

// ---- 2. …and the town is still one place -------------------------------------------------------
const JOIN = 12;
const touch = (a, b) => Math.min(a[2], b[2]) >= Math.max(a[0], b[0]) - JOIN
  && Math.min(a[3], b[3]) >= Math.max(a[1], b[1]) - JOIN;
const seen = new Set([0]);
const q = [0];
while (q.length) {
  const n = q.shift();
  LANES.forEach((L, j) => { if (!seen.has(j) && touch(LANES[n], L)) { seen.add(j); q.push(j); } });
}
if (seen.size !== LANES.length) {
  const lost = LANES.map((L, i) => [i, L]).filter(([i]) => !seen.has(i));
  fail.push(`${lost.length} of ${LANES.length} lanes are cut off from the rest of town: `
    + lost.slice(0, 6).map(([i, L]) => i + ' ' + JSON.stringify(L)).join(', '));
}

// ---- 3. …and no walk a visitor can be sent on crosses a prop ------------------------------------
// ⚠️ THE LANES BEING CLEAN IS NOT ENOUGH. route() returns the crossings between lanes and the walk
// draws a STRAIGHT LINE between them — and the last line of all runs from the final crossing to the
// destination, which is very often off every lane on purpose (a bench seat is inside its own bench;
// that is what sitting looks like). Six of the eight benches were on no street at all before this
// check existed, so that last leg was a diagonal over the gardens. What actually has to be true is
// the thing a player sees: the whole polyline, from the gate to the seat, touches nothing.
const SPOTS = geoConst('SPOTS');
const SEATS = geoConst('SEATS');
const GATE_ON = [{ x: 1100, y: 1200 }, { x: 1944, y: 140 }, { x: 1952, y: 330 }];
const ERRANDS = [
  ...['exchange', 'wheel', 'board', 'cart', 'info', 'monument', 'terrace']
    .filter((k) => SPOTS[k]).map((k) => ({ what: 'the ' + k + ' spot', ...mod.__near(SPOTS[k].x, SPOTS[k].y + 30) })),
  ...SEATS.map(([key, x, base]) => ({ what: 'bench ' + key, x, y: base - 2 })),
  ...Object.entries(SPOTS).filter(([k]) => ['condo', 'hall', 'post', 'store', 'bank', 'print', 'cafe', 'clothes'].includes(k))
    .map(([k, p]) => ({ what: 'the ' + k + ' door', x: p.x, y: p.y })),
];
// does the segment a→b pass through the box? (slab clip, and touching an edge does not count)
function cuts(a, b, box) {
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-(b.x - a.x), a.x - box[0]], [b.x - a.x, box[2] - a.x],
    [-(b.y - a.y), a.y - box[1]], [b.y - a.y, box[3] - a.y]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  // a real crossing, not a graze along an edge
  return (t1 - t0) * Math.hypot(b.x - a.x, b.y - a.y) > 8;
}
const inBox = (p, b) => p.x >= b[0] && p.x <= b[2] && p.y >= b[1] && p.y <= b[3];
const bad = new Map();
for (const e of ERRANDS) {
  for (const g of GATE_ON) {
    const path = [g, ...mod.__route(g, e)];
    for (let i = 0; i < path.length - 1; i++) {
      for (const { b, what } of boxes) {
        // the thing you are walking TO is allowed to be the thing you end up inside
        if (inBox(e, b)) continue;
        if (cuts(path[i], path[i + 1], b)) bad.set(e.what + ' → ' + what, `walking to ${e.what} cuts straight through ${what}`);
      }
    }
  }
}
for (const m of [...bad.values()].slice(0, 14)) fail.push(m);
if (bad.size > 14) fail.push(`…and ${bad.size - 14} more`);

if (fail.length) {
  console.error('❌ town lanes:\n' + fail.map((f) => '   · ' + f).join('\n'));
  process.exit(1);
}
console.log(`✅ town lanes: ${LANES.length} lanes, no prop inside one, all connected`);
