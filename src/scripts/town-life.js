// 🏘️ TOWN LIFE — the residents' days (12 Sep 2026).
//
// A town day is twelve real minutes, six beats of two, read off the wall clock
// so everyone sees the same town. Every resident has a station per beat and
// WALKS between them along the lanes (a small node graph laid on STREETS'
// centrelines, Dijkstra per leg). At a station the act decides what they do:
// Moss sweeps the flyers off the street, the Figs water the beds, the rest
// stand at their counter, read the board, or sit out the noon on a bench with
// ⭐ THE POSES (12 Sep, Trym: "they all line up in this riverdance-pose … nothing feels quite natural"):
// the engine's eight frames are a DANCE. Front-facing (2, 3, 6, 7) has the arms up and out — that is
// the jazz-hands pose that made nine residents look like a chorus line. Only the side frames have the
// arms down: 0/1 facing right, 4/5 facing left. So a resident NEVER stands front-facing; they stand
// side-on and sway slowly between their two frames, each on their own period. Front is for walking
// toward or away from you, and for the portrait in the dialogue card.
//
// ⭐ AND NOBODY MOVES IN LOCKSTEP. Each resident leaves for the next station at their own seeded moment
// in the beat, and at a station they POTTER between a few marks on their own rhythm, so what you see is
// one banana crossing the square while another turns from a shelf — not a migration on the whistle.
//
// ⭐ THE TOWN IS QUIET (Trym, 12 Sep: "you dont see speechbubbles yapping away in stardew valley …
// with lots of npcs yapping away at the same time it gets chaotic and just noisy … theres no speech
// bubbles, but npcs stand next to eachother when they talk — when you go up to them and click them, a
// dialogue window opens"). So: NOTHING a resident says appears over their head, ever. They work in
// silence; two of them at one place stand FACING EACH OTHER, and that is how you see they are talking.
// You hear one only by walking up and tapping: then a dialogue card opens with their portrait, and the
// line depends on how often you two have met (the ladder, a pass stat). At night they go home: the
// element hides and a warm window glows. The Mayor is never seen; a light in the hall's upper window
// in the evening is all of him.
import { drawComposite } from '../lib/banana-engine.js';
import { poofInto, burstInto } from '../lib/world.js';
import { passStat, passRaw, statTotal } from '../lib/banana-pass.js';

// ---- the clock
const DAY_MS = 720000, HOUR_MS = 30000;   // a town day is twelve real minutes: six beats of two
const BEATS = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night'];
let setHour = null, setAt = 0;   // QA: a pinned hour that keeps running from the moment it was set
const townMs = () => setHour == null ? Date.now() % DAY_MS : (setHour * HOUR_MS + (performance.now() - setAt)) % DAY_MS;
const hourNow = () => townMs() / HOUR_MS;
const beatOf = (h) => Math.floor(h / 4) % 6;

// ---- the bible: who they are, where they stand, what they say.
// ✍️ THE WORDS ARE NOT HERE ANY MORE (12 Sep 2026). Every line a resident says lives in
// src/data/copy/town-npcs.json: written by GPT against tools/copy-briefs/town-npcs.md and the house
// voice in docs/voice.md, read side by side at /dev/copy/, approved with
// `node tools/copy.mjs --approve town-npcs`, and gated by tools/check-copy.mjs.
// What stays in code is the MECHANICS — the outfit, the home, and which place, act and facing each
// beat puts them at. The two are merged below, so the runtime shape of R is exactly what it was:
// day = six beats of [place, act, face, lines], plus name, role, hi, tap, want.
import COPY from '../data/copy/town-npcs.json';

const MECH = [
  { key: 'nib', hat: 'tophat', glasses: 'potter', tool: '', home: 'hall',
    day: [['monument', 'stand', 'front'], ['hall', 'counter', 'front'], ['bench_e', 'bench', 'front'], ['hall', 'counter', 'front'], ['board', 'read', 'front'], ['home', 'home', 'front']] },
  { key: 'stamp', hat: 'buckethat', glasses: '', tool: 'letter', home: 'post',
    day: [['bus', 'stand', 'right'], ['post', 'counter', 'front'], ['terrace', 'bench', 'front'], ['post', 'counter', 'front'], ['hall', 'stroll', 'right'], ['home', 'home', 'front']] },
  { key: 'moss', hat: 'woolbeanie', glasses: '', tool: 'broom', home: 'condo',
    day: [['square', 'sweep', 'left'], ['hall', 'sweep', 'right'], ['bench_w', 'bench', 'front'], ['cafe', 'sweep', 'left'], ['square', 'stand', 'front'], ['home', 'home', 'front']] },
  { key: 'pip', hat: 'backwardscap', glasses: '', tool: 'rubberchicken', home: 'store',
    day: [['store', 'stand', 'front'], ['store', 'counter', 'front'], ['bank', 'stand', 'front'], ['store', 'counter', 'front'], ['condo', 'stand', 'front'], ['home', 'home', 'front']] },
  { key: 'bean', hat: 'beanieprop', glasses: '', tool: 'mug', home: 'cafe',
    day: [['cafe', 'counter', 'front'], ['cafe', 'counter', 'front'], ['terrace', 'bench', 'front'], ['cafe', 'counter', 'front'], ['garden_e', 'stroll', 'left'], ['home', 'home', 'front']] },
  { key: 'figjr', hat: 'cowboy', glasses: 'shades', tool: 'lemonjug', home: 'garden_w',
    day: [['orchard', 'water', 'right'], ['stand', 'counter', 'front'], ['cart', 'stand', 'front'], ['stand', 'counter', 'front'], ['garden_w', 'stand', 'front'], ['home', 'home', 'front']] },
  { key: 'spinner', hat: 'jester', glasses: '', tool: 'balloons', home: 'condo',
    day: [['square', 'stand', 'front'], ['wheel', 'counter', 'front'], ['cart', 'stand', 'front'], ['wheel', 'counter', 'front'], ['condo', 'stand', 'front'], ['home', 'home', 'front']] },
  { key: 'dot', hat: '', glasses: '', tool: '', home: 'print',
    day: [['square', 'stand', 'front'], ['board', 'read', 'front'], ['bench_e', 'bench', 'front'], ['info', 'counter', 'front'], ['monument', 'bench', 'front'], ['home', 'home', 'front']] },
  { key: 'granfig', hat: 'snailhat', glasses: 'nerd', tool: 'wateringcan', home: 'garden_w',
    day: [['garden_w', 'water', 'left'], ['orchard', 'water', 'right'], ['bench_w', 'bench', 'front'], ['store', 'stand', 'front'], ['garden_w', 'bench', 'front'], ['home', 'home', 'front']] },
];
// the words, by key. A resident the copy file has never heard of would be a nameless banana standing
// in the square with nothing to say, so it is named out loud here — the copy gate makes it impossible
// to ship (the cast is pinned in tools/copy-jobs.mjs), and this is what it looks like if it ever is.
const SAID = new Map((COPY.residents || []).map((c) => [c.key, c]));
const R = MECH.map((m) => {
  const c = SAID.get(m.key);
  if (!c) throw new Error('town-life: src/data/copy/town-npcs.json has no lines for ' + m.key);
  return { ...m, name: c.name, role: c.role, want: c.want, tap: c.tap, hi: c.hi, ask: c.ask,
    day: m.day.map(([place, act, face], beat) => [place, act, face, c.beats[beat].lines]) };
});

// ---- where a place's station is (feet, world px): at a lane's edge next to the place. A second
// (third) point is for the residents who share the place in one beat — the bible's lunches.
const ST = {
  monument: [[1416, 372]], 'monument|bench': [[1450, 482]],
  hall: [[1140, 590], [1060, 590]], post: [[1750, 590], [1650, 590]],
  store: [[530, 1068], [440, 1068]], bank: [[620, 1072]], print: [[1580, 1068]], cafe: [[1780, 1068], [1880, 1068]],
  board: [[800, 1012], [872, 1012]], cart: [[1405, 1034], [1478, 1034]], info: [[1012, 1210]],
  terrace: [[1705, 1242], [1835, 1242]], orchard: [[792, 322]], stand: [[890, 576], [962, 576]], bus: [[1962, 352]],
  garden_w: [[485, 704], [556, 704]], garden_e: [[1730, 698]],
  // the lunch pairs stand just behind their bench (feet above its top edge: nothing overlaps), each pair framed by its own
  square: [[1100, 990], [1000, 950], [1200, 950]], bench_w: [[935, 992], [995, 992]], bench_e: [[1215, 992], [1275, 992]],
  condo: [[480, 592], [562, 592]], wheel: [[1400, 802]], exchange: [[800, 802]],
};
// the sweeps and strolls: a line on the lane, walked back and forth
const PATHS = {
  'moss|0': [[880, 985], [1320, 985], [1320, 800], [1230, 800]],
  'moss|1': [[640, 650], [1560, 650]],
  'moss|3': [[1560, 1095], [1900, 1095]],
  'stamp|4': [[1600, 650], [1000, 650], [1300, 650]],
  'bean|4': [[1580, 700], [1880, 700], [1730, 700]],
};
// home: the door they vanish through, and the window that glows while they are in
const HOME = { hall: [1100, 590], post: [1700, 590], condo: [480, 592], store: [480, 1068], cafe: [1830, 1068], print: [1620, 1068], garden_w: [520, 704] };
const GLOW = { hall: [[1098, 468]], post: [[1694, 215]], condo: [[435, 400], [525, 400]], store: [[516, 1006]], cafe: [[1837, 1012]], print: [[1656, 1000]], garden_w: [[612, 738]] };
const MAYOR = [1098, 468];
// the beds a waterer sprinkles, per place
const BEDS = { garden_w: [[440, 748], [530, 748]], orchard: [[690, 336], [900, 336], [790, 222]] };
// the flyers: six spots on the streets, and the beat in which Moss's sweep reaches each
const LITTER = [[1180, 985, 1, 0], [1300, 850, 2, 0], [900, 650, 2, 1], [1350, 640, 1, 1], [1650, 1100, 1, 3], [1860, 1120, 2, 3]];
// 🏘️ Town Life adds litter OFF Moss's route when the town is low (town-room.js sets the level:
// four more at 1, eight at 2). Nobody sweeps these — sweepBeat 9 never comes — the player may.
const LITTER_MORE = [[560, 620, 1, 9], [1560, 620, 2, 9], [800, 1100, 1, 9], [1440, 1100, 2, 9], [320, 900, 2, 9], [1990, 900, 1, 9], [1230, 830, 1, 9], [980, 830, 2, 9]];

// ---- the lanes as a graph: nodes on STREETS' centrelines, edges along them; a station attaches to
// the nearest edge (its projection), and a leg is Dijkstra from one attachment to the other
const N = { hw: [310, 615], h1: [720, 615], h2: [792, 615], h3: [1100, 615], h4: [1416, 615], h5: [1480, 615], h6: [1944, 615], he: [1975, 615],
  gw: [310, 1090], g1: [720, 1090], g2: [1100, 1090], g3: [1480, 1090], g4: [1620, 1090], ge: [1975, 1090],
  wl: [310, 696], wp: [655, 696], el: [1975, 696], ep: [1560, 696],
  nw: [720, 700], ne: [1480, 700], sw: [720, 1000], se: [1480, 1000], ss: [1100, 1000],
  or: [792, 322], mo: [1416, 372], mb: [1416, 482], bu: [1944, 352], ms: [1100, 1250], t1: [1620, 1200], t2: [1880, 1200] };
const E = 'hw-h1 h1-h2 h2-h3 h3-h4 h4-h5 h5-h6 h6-he gw-g1 g1-g2 g2-g3 g3-g4 g4-ge hw-wl wl-gw he-el el-ge wl-wp wp-nw el-ep ep-ne h1-nw h5-ne g1-sw g3-se g2-ss nw-ne nw-sw sw-ss ss-se se-ne h2-or h4-mb mb-mo h6-bu g2-ms g4-t1 t1-t2'
  .split(' ').map((s) => s.split('-'));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// a stable 0..1 from three small numbers: the rhythms differ per resident and per beat, and they are
// the same for everybody who is looking (no Math.random anywhere in the town's clockwork)
function h01(a, b, c) {
  let x = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
function attach(p) {   // the closest point on the closest edge
  let best = null;
  for (const [a, b] of E) {
    const A = N[a], B = N[b], vx = B[0] - A[0], vy = B[1] - A[1], L = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * vx + (p[1] - A[1]) * vy) / L));
    const q = [A[0] + vx * t, A[1] + vy * t], d = dist(p, q);
    if (!best || d < best.d) best = { d, pt: q, a, b };
  }
  return best;
}
function route(from, to) {   // the points to walk, from (exclusive) to `to` (inclusive)
  const A = attach(from), B = attach(to);
  const P = { ...N, A: A.pt, B: B.pt };
  const adj = {};
  const link = (a, b) => { const w = dist(P[a], P[b]); (adj[a] = adj[a] || []).push([b, w]); (adj[b] = adj[b] || []).push([a, w]); };
  for (const [a, b] of E) link(a, b);
  link('A', A.a); link('A', A.b); link('B', B.a); link('B', B.b);
  if ((A.a === B.a && A.b === B.b) || (A.a === B.b && A.b === B.a)) link('A', 'B');
  const D = { A: 0 }, prev = {}, open = new Set(['A']), done = new Set();
  while (open.size) {
    let u = null;
    for (const k of open) if (u == null || D[k] < D[u]) u = k;
    open.delete(u); done.add(u);
    if (u === 'B') break;
    for (const [v, w] of adj[u] || []) {
      if (done.has(v)) continue;
      const nd = D[u] + w;
      if (D[v] == null || nd < D[v]) { D[v] = nd; prev[v] = u; open.add(v); }
    }
  }
  const ids = [];
  for (let u = 'B'; u != null; u = prev[u]) ids.unshift(u);
  const pts = ids.map((k) => P[k]);
  pts.push(to);
  // drop the doglegs: a point within a step of its neighbours' line is a bend nobody sees
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (q && dist(p, q) < 3) continue;
    out.push(p);
  }
  return out;
}

// ---- the ladder: how often this player has met them, a pass stat that travels
const metNow = new Set();   // at most once per page session per resident
const total = (key) => { try { return statTotal(passRaw(), 'tw_met_' + key); } catch (e) { return 0; } };
const rung = (key) => { const t = total(key); return t >= 14 ? 4 : t >= 7 ? 3 : t >= 3 ? 2 : t >= 1 ? 1 : 0; };
function met(key) {
  if (metNow.has(key)) return;
  metNow.add(key);
  try { passStat('tw_met_' + key, 1); } catch (e) {}
}
function nameOf() {
  let n = '';
  try { n = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}
  return n || 'friend';
}
const fill = (s) => s.replace(/\{name\}/g, nameOf());

const WALK = 110, BOB_MS = 333, SWEEP_R = 120;
const POTTER = 34, POTTER_SPD = 46;   // how far a resident drifts around their station, and how slowly
const SWAY_MIN = 2100, SWAY_VAR = 2600;   // the standing sway: slow, and a different period each
// how long they stand at a mark before moving to the next one: a wide spread so two neighbours never
// shift at the same moment (which is what made the pairs look choreographed)
const DWELL_MIN = 4200, DWELL_VAR = 11000;
// a station's marks: the base point, then a few nearby ones with their own facing. `act` decides the
// shape — a counter keeper stays behind it and only turns, a bench sitter shifts along it, someone
// standing about wanders a little wider.
function marksFor(n, st, beat) {
  // 👀 in a pair the facing is the conversation: every mark keeps it (st.paired), so they never drift
  //    into standing side by side looking the same way, which reads as two strangers
  const near = (dx, dy, face) => [st.x + dx, st.y + dy, st.paired ? st.face : face];
  const r = (k) => h01(n.idx + 1, beat + 1, k);
  const side = st.x > 1100 ? 'left' : 'right';   // they face into the square, not off the map
  if (st.act === 'counter' || st.act === 'stand') {
    return [near(0, 0, st.face), near(st.act === 'counter' ? 22 : 30, -4, side === 'left' ? 'left' : 'right'),
      near(-(18 + Math.round(r(3) * 14)), 2, side === 'left' ? 'right' : 'left'), near(Math.round(r(4) * 16) - 8, -8, st.face)];
  }
  if (st.act === 'bench') return [near(0, 0, st.face), near(14, 2, st.face), near(-10, 0, st.face === 'left' ? 'right' : 'left')];
  if (st.act === 'read') return [near(0, 0, st.face), near(20, 0, st.face), near(-16, 4, st.face)];
  if (st.act === 'water') return [near(0, 0, st.face), near(26, 6, st.face), near(-22, -4, st.face === 'left' ? 'right' : 'left')];
  return [near(0, 0, st.face)];
}
// 🧍 the standing pose: side-on always (the front frames are arms-up dance poses), with a slow sway
// between the facing's two frames on the resident's own period. Used while they stand AND while they
// wait for their moment to set off.
function standFrame(n, now) {
  const base = n.face === 'left' ? 4 : n.face === 'right' ? 0 : (n.x > 1100 ? 4 : 0);
  if (now - n.swayAt > n.sway) { n.swayAt = now; n.swayF = n.swayF ? 0 : 1; n.sway = SWAY_MIN + h01(n.idx + 1, n.beat + 2, n.swayF + 30) * SWAY_VAR; }
  return base + n.swayF;
}

export function initLife({ world, W, H, pct }) {
  let ready = false, curBeat = -1, lastSweep = 0, mayorEl = null;
  const flyers = [];
  // 🏘️ TOWN LIFE's seams (14 Sep 2026): who stays in this beat, whose window may glow, who
  // stands somewhere odd today, and how much litter the streets carry. Set from town-room.js;
  // null = the town as it always was.
  let keepFn = null, glowFn = null, overrideFn = null, litterLevel = 0;

  // the residents: one .tw-npc each (a canvas; no name over the head — a name is read on the card when you
  // walk up and talk, Trym 15 Sep) and their home's window glow
  const res = R.map((r, idx) => {
    const el = document.createElement('div');
    el.className = 'tw-npc';
    const cv = document.createElement('canvas'); cv.width = cv.height = 150;
    el.appendChild(cv);
    el.hidden = true;
    world.appendChild(el);
    const outfit = { hat: r.hat || 'none', glasses: r.glasses || 'none', extras: r.tool ? { [r.tool]: true } : {}, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
    return { ...r, idx, el, cv, ctx: cv.getContext('2d'), outfit, x: 0, y: 0, px: NaN, py: NaN, drawn: '', face: 'front',
      path: [], wait: 0, walking: false, loop: null, li: 0, ldir: 1, hidden: true, beat: -1, place: '', act: '', talked: false, lastWater: 0, bedI: 0, glow: null,
      marks: [], mi: 0, dwell: 0, drift: null, sway: SWAY_MIN, swayAt: 0, swayF: 0 };
  });
  // glows: one per home window; two residents above the arcade, the Figs share a lantern
  const glowCount = {};
  for (const n of res) {
    const pts = GLOW[n.home] || [], k = glowCount[n.home] || 0; glowCount[n.home] = k + 1;
    const g = pts[Math.min(k, pts.length - 1)];
    if (!g) continue;
    const el = document.createElement('div');
    el.className = 'tw-glow'; el.hidden = true;
    el.style.left = pct(g[0], W); el.style.top = pct(g[1], H); el.style.zIndex = String(100 + HOME[n.home][1] + 2);
    world.appendChild(el);
    n.glow = el; n.glowAt = g;
  }
  mayorEl = document.createElement('div');
  mayorEl.className = 'tw-glow tw-glow--mayor'; mayorEl.hidden = true;
  mayorEl.style.left = pct(MAYOR[0], W); mayorEl.style.top = pct(MAYOR[1], H); mayorEl.style.zIndex = String(100 + 560 + 3);
  world.appendChild(mayorEl);

  const byKey = (key) => res.find((n) => n.key === key);

  // ---- stations
  function stationFor(n, beat) {
    const [place, act, face, lines] = n.day[beat];
    // 🏘️ today's oddity: a resident standing where they never stand, for this one beat
    const odd = overrideFn && overrideFn(n, beat);
    if (odd && ST[odd] && act !== 'home') { const p = ST[odd][0]; return { place: odd, act: 'stand', face: p[0] > 1100 ? 'left' : 'right', lines, x: p[0], y: p[1], loop: null }; }
    const loop = PATHS[n.key + '|' + beat] || null;
    if (loop) return { place, act, face, lines, x: loop[0][0], y: loop[0][1], loop };
    if (act === 'home') { const d = HOME[n.home]; return { place, act, face, lines, x: d[0], y: d[1], loop: null }; }
    const pts = ST[place + '|' + act] || ST[place] || [[1100, 990]];
    // who else stands at this place this beat (walkers excluded): the k-th takes the k-th point
    // ⚠️ a resident kept indoors today is not at the place, so nobody turns to face them
    const group = res.filter((m) => { const d = m.day[beat]; return d[0] === place && d[1] !== 'sweep' && d[1] !== 'stroll' && d[1] !== 'home' && !(keepFn && keepFn(m, beat)) && !(overrideFn && overrideFn(m, beat)); });
    const k = Math.max(0, group.indexOf(n));
    const p = pts[Math.min(k, pts.length - 1)];
    // 🗣 two residents at one place TURN TOWARD EACH OTHER — with no bubbles that is the only way you
    // see a conversation, and it is how Stardew does it. The one on the left looks right, and vice versa.
    let f = face, x = p[0], y = p[1];
    if (group.length > 1 && pts.length > 1) {
      const other = pts[Math.min(k === 0 ? 1 : 0, pts.length - 1)];
      if (Math.abs(other[0] - x) > 24) f = other[0] > x ? 'right' : 'left';
      y += k === 0 ? -7 : 7;   // half a step apart in depth: two on one line is a chorus line
    }
    return { place, act, face: f, lines, x, y, loop: null, paired: group.length > 1 && pts.length > 1 };
  }
  function goHome(n) {
    n.hidden = true; n.el.hidden = true;
    // the window lights when they are home for the NIGHT; a resident kept in by the day (or
    // a Curse Night) sits behind a dark window, and a low town leaves some windows dark
    if (n.glow) n.glow.hidden = !!n.kept || !!(glowFn && !glowFn(n));
  }
  function leaveHome(n) {
    if (!n.hidden) return;
    const d = HOME[n.home];
    n.x = d[0]; n.y = d[1];
    n.hidden = false; n.el.hidden = false;
    if (n.glow) n.glow.hidden = true;
  }
  function changeBeat(beat, walk) {
    curBeat = beat;
    if (!walk || beat === 0) spawnLitter(beat, walk);
    for (const n of res) {
      const st = stationFor(n, beat);
      // 🏘️ kept in: they go home (walking, if they are out) and stay there behind a dark window
      n.kept = !!(keepFn && keepFn(n, beat) && st.act !== 'home');
      if (n.kept) {
        n.beat = beat; n.place = 'home'; n.act = 'home'; n.lines = st.lines; n.loop = null; n.marks = []; n.drift = null;
        if (walk && !n.hidden) { const d = HOME[n.home]; n.path = route([n.x, n.y], [d[0], d[1]]); n.wait = 400 + h01(n.idx + 1, beat + 1, 7) * 12000; n.walking = false; }
        else { n.path = []; n.walking = false; n.wait = 0; goHome(n); }
        continue;
      }
      n.beat = beat; n.place = st.place; n.act = st.act; n.face = st.face; n.lines = st.lines; n.loop = st.loop; n.li = 0; n.ldir = 1;
      n.lastWater = 0;
      n.marks = marksFor(n, st, beat); n.mi = 0; n.drift = null;
      n.dwell = DWELL_MIN + h01(n.idx + 1, beat + 1, 11) * DWELL_VAR;
      n.sway = SWAY_MIN + h01(n.idx + 1, beat + 1, 12) * SWAY_VAR;
      if (walk) {
        if (st.act !== 'home' || !n.hidden) leaveHome(n);
        n.path = route([n.x, n.y], [st.x, st.y]);
        // ⏳ their OWN moment to set off: up to two thirds of the beat, so the town never migrates at once
        n.wait = 400 + h01(n.idx + 1, beat + 1, 5) * 74000;
        n.walking = false;
      } else {
        n.path = []; n.walking = false; n.wait = 0;
        n.x = st.x; n.y = st.y;
        if (st.act === 'home') goHome(n); else leaveHome(n);
      }
    }
    if (mayorEl) mayorEl.hidden = beat !== 4;
  }
  function arrive(n) {
    n.walking = false; n.path = [];
    if (n.act === 'home') goHome(n);
  }

  // ---- litter
  function spawnLitter(beat, respawn) {
    for (const f of flyers) f.el.remove();
    flyers.length = 0;
    [...LITTER, ...LITTER_MORE.slice(0, litterLevel * 4)].forEach(([x, y, art, sweepBeat], i) => {
      if (!respawn && sweepBeat < beat) return;   // Moss has already been past it today
      const el = document.createElement('img');
      el.className = 'tw-litter'; el.alt = ''; el.draggable = false; el.decoding = 'async';
      el.src = '/assets/town/litter-' + art + '.png';
      // twice its pixels: at 1x a flyer read as a grey pebble in the cobbles (Trym, 15 Sep)
      el.onload = () => { el.style.width = pct(el.naturalWidth * 2, W); };
      el.style.left = pct(x, W); el.style.top = pct(y, H); el.style.zIndex = String(100 + y);
      world.appendChild(el);
      flyers.push({ i, x, y, el, gone: false });
    });
  }
  function poof(x, y) { poofInto(world, 'tw-poof', x / W * 100, (y - 10) / H * 100); }
  function burst(x, y) { burstInto(world, 'tw-burst', x / W * 100, (y - 16) / H * 100); }   // ✨ the player's own pickup (town-room.js has the twin)
  function takeFlyer(f, mine) {
    if (f.gone) return;
    f.gone = true; f.el.remove(); if (mine) burst(f.x, f.y); else poof(f.x, f.y);
  }
  function pick(i) {   // the player picked one up; Moss, if near, has a line for it
    const f = flyers.find((q) => q.i === i && !q.gone);
    if (!f) return false;
    takeFlyer(f, true);
    // 🗞 litter is litter: picking it up is the park's walk-over rule, rep only (Trym, 15 Sep: "i can
    // pick them up but nothing more happens, doesnt seem like a part of the fixing-system")
    try { passStat('rep', 1); } catch (e) {}
    // 🤫 and nothing is said about it: she notices, and noticing is silent (Trym, 12 Sep). Her line
    // about the flyer lives in her dialogue card, where every line belongs.
    return true;
  }

  // ---- the dialogue: only ever on a tap, and only after you have walked up to them
  // The line is chosen by the ladder — how often you two have met — and the SECOND tap in a session
  // gives you what they are doing right now instead of the greeting again.
  function talk(key) {
    const n = byKey(key);
    if (!n) return null;
    const first = !n.talked;
    n.talked = true;
    const line = first ? n.hi[rung(n.key)] : (n.lines && n.lines.length ? n.lines[Math.floor(hourNow()) % n.lines.length] : n.tap);
    met(n.key);
    // the two questions every resident answers: what they are at right now, and the one thing they
    // would like of you some day (their want — a promise for later, never a task with a timer on it)
    const doing = () => fill((n.lines && n.lines.length) ? n.lines[(Math.floor(hourNow() * 2) + n.idx) % n.lines.length] : n.tap);
    // ✍️ the two questions are the PLAYER's voice and they are copy like any other: they come from
    // src/data/copy/town-npcs.json (`ask`), never from this file. Trym, 12 Sep, on the pair I had
    // hardcoded: "What are you at? is a very weird sentence and question."
    const ask = n.ask || {};
    const topics = [];
    if (ask.doing) topics.push({ q: ask.doing, a: doing });
    if (ask.want && n.want) topics.push({ q: ask.want, a: fill(n.want) });
    return { key: n.key, name: n.name, line: fill(line), outfit: n.outfit, topics, at: { x: n.x, y: n.y } };
  }
  function standBy(key) {   // where the player waits to talk: beside them, never on them
    const n = byKey(key);
    if (!n || n.hidden) return null;
    return { x: n.x, y: n.y };
  }

  // ---- drawing: only when the frame changes
  function draw(n, frame) {
    const k = frame + ':' + n.tool;
    if (n.drawn === k) return;
    n.drawn = k;
    drawComposite(n.ctx, 150, frame, n.outfit);
  }
  function placeEl(n) {
    if (n.x === n.px && n.y === n.py) return;
    n.px = n.x; n.py = n.y;
    n.el.style.left = pct(n.x, W); n.el.style.top = pct(n.y, H); n.el.style.zIndex = String(100 + Math.round(n.y));
  }
  function step(n, tx, ty, dt) {   // one step toward (tx, ty); true when there
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy), s = WALK * dt;
    if (d <= s) { n.x = tx; n.y = ty; return true; }
    n.x += dx / d * s; n.y += dy / d * s;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : 'front';
    return false;
  }

  function tick(now, dt) {
    if (!ready) return;
    const beat = beatOf(hourNow());
    if (beat !== curBeat) changeBeat(beat, true);
    const bob = Math.floor(now / BOB_MS) % 2;
    for (const n of res) {
      let frame;
      if (n.path.length) {
        if (n.wait > 0) { n.wait -= dt * 1000; frame = standFrame(n, now); }   // still at their post, not posing
        else {
          n.walking = true;
          const p = n.path[0];
          if (step(n, p[0], p[1], dt)) { n.path.shift(); if (!n.path.length) arrive(n); }
          frame = (n.dir === 'left' ? 4 : n.dir === 'right' ? 0 : 2) + bob;
        }
      } else if (n.loop && !n.hidden) {
        n.walking = true;
        const p = n.loop[n.li];
        if (step(n, p[0], p[1], dt)) {
          if (n.li + n.ldir >= n.loop.length || n.li + n.ldir < 0) n.ldir = -n.ldir;
          n.li += n.ldir;
        }
        frame = (n.dir === 'left' ? 4 : n.dir === 'right' ? 0 : 2) + bob;
      } else if (n.drift) {
        // a short shuffle to the next mark: slower than a walk, and it is still the walking bob
        n.walking = true;
        if (step(n, n.drift[0], n.drift[1], dt * (POTTER_SPD / WALK))) {
          n.face = n.drift[2] || n.face; n.drift = null;
          n.dwell = DWELL_MIN + h01(n.idx + 1, n.beat + 1, n.mi + 20) * DWELL_VAR;
        }
        frame = (n.dir === 'left' ? 4 : n.dir === 'right' ? 0 : 2) + bob;
      } else {
        n.walking = false;
        frame = standFrame(n, now);
        // …and every so often they move to another mark round the station: the pottering that makes a
        // shopkeeper look like they are working rather than posing
        if (n.marks.length > 1 && !n.path.length) {
          n.dwell -= dt * 1000;
          if (n.dwell <= 0) {
            n.mi = (n.mi + 1 + Math.floor(h01(n.idx + 1, n.beat + 1, n.mi + 40) * (n.marks.length - 1))) % n.marks.length;
            const m = n.marks[n.mi];
            n.drift = (Math.hypot(m[0] - n.x, m[1] - n.y) > 4) ? m : null;
            if (!n.drift) { n.face = m[2] || n.face; n.dwell = DWELL_MIN + h01(n.idx + 1, n.beat + 1, n.mi + 21) * DWELL_VAR; }
          }
        }
      }
      if (n.hidden) continue;
      draw(n, frame);
      placeEl(n);
      // the act
      if (n.act === 'sweep' && !n.path.length && now - lastSweep > 900) {
        const f = flyers.find((q) => !q.gone && Math.hypot(q.x - n.x, q.y - n.y) < SWEEP_R);
        if (f) { takeFlyer(f); lastSweep = now; }
      }
      if (n.act === 'water' && !n.path.length && !n.drift) {
        if (!n.lastWater) n.lastWater = now - 6500;
        if (now - n.lastWater > 8000) {
          n.lastWater = now;
          const beds = BEDS[n.place] || [[n.x, n.y]];
          const b = beds[n.bedI++ % beds.length];
          poof(b[0], b[1]);
        }
      }
    }
  }

  // ---- hit-testing for the tap handler: a flyer first (small), then a resident
  function at(wx, wy) {
    for (const f of flyers) if (!f.gone && Math.abs(wx - f.x) < 26 && wy < f.y + 8 && wy > f.y - 40) return ['flyer', f.i];
    for (const n of res) if (!n.hidden && Math.abs(wx - n.x) < 34 && wy < n.y + 6 && wy > n.y - 90) return ['npc', n.key];
    return null;
  }
  const flyer = (i) => { const f = flyers.find((q) => q.i === i && !q.gone); return f ? { x: f.x, y: f.y } : null; };
  const pickAt = (x, y, r) => { const f = flyers.find((q) => !q.gone && Math.hypot(q.x - x, q.y - y) < r); if (!f) return null; pick(f.i); return { x: f.x, y: f.y }; };   // 🚶 walk-over pickup (town-room.js autoPick)
  const sweep = (x, y, r) => flyers.filter((f) => !f.gone && Math.hypot(f.x - x, f.y - y) < r).map((f) => pick(f.i)).length;   // 🧹 a container fixed takes the flyers round it (town-room.js)

  function start() {
    ready = true;
    changeBeat(beatOf(hourNow()), false);
  }
  // the QA seam (window.__town.life)
  // 🏘️ the seams. A change re-runs the beat as a WALK, so a resident sent in crosses the
  // square to their door instead of vanishing where they stood.
  const refresh = () => { if (ready) changeBeat(curBeat, true); };
  const setKeep = (fn) => { keepFn = fn || null; refresh(); };
  const setGlow = (fn) => { glowFn = fn || null; for (const n of res) if (n.hidden && n.glow) n.glow.hidden = !!n.kept || !!(glowFn && !glowFn(n)); };
  const setOverride = (fn) => { overrideFn = fn || null; refresh(); };
  const setLitter = (level) => { const l = Math.max(0, Math.min(2, level | 0)); if (l === litterLevel) return; litterLevel = l; if (ready) spawnLitter(curBeat, true); };
  const seam = {
    hour: () => hourNow(),
    kept: () => res.filter((n) => n.kept).map((n) => n.key),
    glows: () => res.filter((n) => n.glow && !n.glow.hidden).map((n) => n.key),
    beat: () => curBeat,
    set: (h) => { setHour = h == null ? null : +h; setAt = performance.now(); if (ready) changeBeat(beatOf(hourNow()), false); },
    residents: () => res.map((n) => ({ key: n.key, x: Math.round(n.x), y: Math.round(n.y), beat: BEATS[n.beat] || '', place: n.place, act: n.act, tool: n.tool || 'none', walking: n.walking, hidden: n.hidden, face: n.face, frame: n.drawn, leg: !!(n.path.length && n.wait <= 0), waiting: n.wait > 0, potter: !!n.drift, mark: n.mi })),   // `leg` = actually crossing town; a resident with a path but time on the clock is still at their post
    litter: () => flyers.filter((f) => !f.gone).length,
    flyers: () => flyers.filter((f) => !f.gone).map((f) => ({ i: f.i, x: f.x, y: f.y })),
    rung,
    talk,
    facing: () => res.filter((n) => !n.hidden).map((n) => ({ key: n.key, face: n.face, place: n.place })),
    pick,
    mayor: () => !!(mayorEl && !mayorEl.hidden),
  };
  return { tick, at, talk, standBy, pick, pickAt, flyer, sweep, start, seam, setKeep, setGlow, setOverride, setLitter, beat: () => curBeat, homeOf: (key) => { const n = byKey(key); return n ? HOME[n.home] : null; } };
}
