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
// ⭐ …AND STANDING STILL IS NOT STANDING DEAD (25 Sep 2026, Trym: "lots of town bananas just standing there statically -
// not a great first impression"). idle() gives every banana at its post a life without a new frame: a sway you can
// see, a glance round and back, two bars of the ORIGINAL dance now and then (all eight frames, moving — a dance is not
// the posing above), never beside another dancer, and in a pair the talk: whoever's turn it is gives two little hops.
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
// ⚡ the words load AFTER the square stands: 25 KB of dialogue was riding in the town's own script (96% of its
// budget, 15 Sep). A resident stands and walks without them; a tap waits the moment they take to arrive.
const COPY_P = import('../data/copy/town-npcs.json').then((m) => m.default || m);

// ⭐ THE RESIDENTS STAND BY THEIR OWN SHOPS (Trym, 20 Sep, once the visitors landed): *"maybe it's
// best if the townsfolk NPCs don't do too much other than walk about sometimes greeting each other
// or doing small stuff but mainly standing by their shops, to keep some consistency and not make it
// too messy with tons of bananas always on the move everywhere, it can get chaotic."*
//
// So a day is now POST, POST, a break, POST, POST, home — about three walks each instead of five,
// and everyone is where you would look for them for two thirds of the day. The town's motion comes
// from the VISITORS now (town-folk.js): they are the traffic, these are the fixtures. The small life
// is still here and does not need a schedule — they potter between the marks of their own station,
// they turn to face each other when they share one, and ODD_SPOTS still puts one of them somewhere
// they never stand, once in a while.
//
// ⚠️ MOSS IS THE EXCEPTION AND HAS TO BE. He is the sweeper: his beats 0, 1 and 3 are written into
// LITTER's fourth column, which is the beat each flyer is swept on. Pin Moss and the flyers stop
// being collected. One banana crossing the square with a broom is character, not chaos.
//
// 🕹 AND SPINNER KEEPS THE ARCADE, TWIRL THE WHEEL (24 Sep 2026, Trym: "Spinner should hang around the arcade, walk in
// and out, look busy there - not stand by the wheel of peel - someone else should stand and be responsible for the wheel
// of peel"). Spinner's day is out on the arcade's step and IN the arcade by turns: a home beat in a home with a room
// (INSIDE) is spent on that room's floor. Twirl is the tenth resident and runs the wheel. Moss moved out from over the
// arcade to the back of the clothes shop — she stood on Spinner in front of the arcade door (Trym, same day).
const MECH = [
  { key: 'nib', hat: 'tophat', glasses: 'potter', tool: '', home: 'hall',
    day: [['hall', 'counter', 'front'], ['hall', 'counter', 'front'], ['bench_e', 'bench', 'front'], ['hall', 'counter', 'front'], ['hall', 'counter', 'front'], ['home', 'home', 'front']] },
  { key: 'stamp', hat: 'buckethat', glasses: '', tool: 'letter', home: 'post',   // ☕ lunch on the terrace beside Bean at noon (25 Sep 2026)
    day: [['bus', 'stand', 'right'], ['post', 'counter', 'front'], ['terrace', 'bench', 'front'], ['post', 'counter', 'front'], ['post', 'counter', 'front'], ['home', 'home', 'front']] },
  { key: 'moss', hat: 'woolbeanie', glasses: '', tool: 'broom', home: 'clothes',
    day: [['square', 'sweep', 'left'], ['hall', 'sweep', 'right'], ['bench_w', 'bench', 'front'], ['cafe', 'sweep', 'left'], ['square', 'stand', 'front'], ['home', 'home', 'front']] },
  { key: 'pip', hat: 'backwardscap', glasses: '', tool: 'rubberchicken', home: 'store',
    day: [['store', 'stand', 'front'], ['store', 'counter', 'front'], ['bank', 'stand', 'front'], ['store', 'counter', 'front'], ['store', 'counter', 'front'], ['home', 'home', 'front']] },
  { key: 'bean', hat: 'beanieprop', glasses: '', tool: 'mug', home: 'cafe',
    day: [['cafe', 'counter', 'front'], ['cafe', 'counter', 'front'], ['terrace', 'bench', 'front'], ['cafe', 'counter', 'front'], ['cafe', 'counter', 'front'], ['home', 'home', 'front']] },
  { key: 'figjr', hat: 'cowboy', glasses: 'shades', tool: 'lemonjug', home: 'garden_w',
    day: [['stand', 'counter', 'front'], ['stand', 'counter', 'front'], ['orchard', 'water', 'right'], ['stand', 'counter', 'front'], ['stand', 'counter', 'front'], ['home', 'home', 'front']] },
  { key: 'spinner', hat: 'jester', glasses: '', tool: 'boingball', home: 'condo',
    day: [['condo', 'stand', 'front'], ['home', 'home', 'front'], ['condo', 'stand', 'front'], ['home', 'home', 'front'], ['condo', 'stand', 'front'], ['home', 'home', 'front']] },
  { key: 'dot', hat: '', glasses: '', tool: '', home: 'print',
    day: [['print', 'stand', 'front'], ['print', 'stand', 'front'], ['bench_e', 'bench', 'front'], ['print', 'stand', 'front'], ['print', 'stand', 'front'], ['home', 'home', 'front']] },
  { key: 'granfig', hat: 'snailhat', glasses: 'nerd', tool: 'wateringcan', home: 'garden_w',
    day: [['garden_w', 'water', 'left'], ['garden_w', 'water', 'left'], ['bench_w', 'bench', 'front'], ['orchard', 'water', 'right'], ['garden_w', 'bench', 'front'], ['home', 'home', 'front']] },
  { key: 'twirl', hat: 'party', glasses: 'monocle', tool: 'balloons', home: 'print',
    day: [['wheel', 'counter', 'front'], ['wheel', 'counter', 'front'], ['cart', 'stand', 'front'], ['wheel', 'counter', 'front'], ['wheel', 'counter', 'front'], ['home', 'home', 'front']] },
];
// the words, by key. A resident the copy file has never heard of would be a nameless banana standing
// in the square with nothing to say, so it is named out loud here — the copy gate makes it impossible
// to ship (the cast is pinned in tools/copy-jobs.mjs), and this is what it looks like if it ever is.
const R = MECH.map((m) => ({ ...m, name: '', role: '', want: '', tap: '', hi: [], ask: {}, curse: '', day: m.day.map(([place, act, face]) => [place, act, face, []]) }));
// the words, by key, onto the residents that are already out: a resident the copy file has never heard of would
// be a nameless banana with nothing to say, so it is named out loud — the copy gate pins the cast in
// tools/copy-jobs.mjs, so this cannot ship
function applyCopy(res, COPY) {
  const SAID = new Map((COPY.residents || []).map((c) => [c.key, c]));
  for (const n of res) {
    const c = SAID.get(n.key);
    if (!c) { console.error('town-life: src/data/copy/town-npcs.json has no lines for ' + n.key); continue; }
    Object.assign(n, { name: c.name, role: c.role, want: c.want, tap: c.tap, hi: c.hi, ask: c.ask, curse: c.curse });
    n.day.forEach((d, beat) => { d[3] = (c.beats[beat] || {}).lines || []; });
    n.lines = (n.day[n.beat] || [])[3] || [];
  }
}

// ---- where a place's station is (feet, world px): at a lane's edge next to the place. A second
// (third) point is for the residents who share the place in one beat — the bible's lunches.
const ST = {
  monument: [[1416, 372]], 'monument|bench': [[1450, 482]],
  hall: [[1140, 590], [1060, 590]], post: [[1750, 590], [1650, 590]],
  store: [[530, 1068], [440, 1068]], bank: [[620, 1072]], print: [[1580, 1068]], cafe: [[1780, 1068], [1880, 1068]],
  cart: [[1405, 1034], [1478, 1034]], info: [[1012, 1210]],   // ❌ `board` went with the notice board (20 Sep 2026)
  terrace: [[1705, 1242], [1835, 1242]], orchard: [[792, 322]], stand: [[890, 576], [962, 576]], bus: [[1962, 352]],
  garden_w: [[485, 704], [556, 704]], garden_e: [[1730, 698]],
  booth: [[770, 604]],   // 🍋 beside the phone box on Hall Street: Fig Jr.'s aside while you work his stand, off the queue's line
  // the lunch pairs stand just behind their bench (feet above its top edge: nothing overlaps), each pair framed by its own
  square: [[1100, 990], [1000, 950], [1200, 950]], bench_w: [[935, 992], [995, 992]], bench_e: [[1215, 992], [1275, 992]],
  condo: [[572, 598]], wheel: [[1400, 802]], exchange: [[800, 802]],   // 🕹 the arcade's step: right of its door (x 444-479), off the way in
  // 🕯 where Nib waits for a newcomer while chapter one's first scene is open (world-quest.js step 0 —
  // its ! is anchored to this exact point, so the two change together): just east of the fountain's
  // foot, facing it, off the lunch pair's marks
  fountain: [[1160, 985]],
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
// ⚠️ BEAN'S DOOR IS NOT THE SERVING HATCH. It was x 1830 — two pixels off the centre of the café's own
// window (CAFE_WIN spans 1806-1852) — and leaveHome() parks a resident AT their door for up to 74 s of a
// 120 s beat, so for most of the morning Bean stood squarely in the hatch with his z above the barista's.
// Trym, 20 Sep: "he stood in front of the window when my banana went into the window so i couldnt see
// that i entered the shop." At 1770 his drawn box ends at 1801 and the window is clear.
const HOME = { hall: [1100, 590], post: [1700, 590], condo: [480, 592], store: [480, 1068], cafe: [1770, 1068], print: [1620, 1068], garden_w: [520, 704], clothes: [154, 590] };
const GLOW = { hall: [[1098, 468]], post: [[1694, 215]], condo: [[435, 400], [525, 400]], store: [[516, 1006]], cafe: [[1837, 1012]], print: [[1656, 1000]], clothes: [[226, 520]] };
// 🕹 A HOME WITH A ROOM: a resident home in the DAY is in this room, on its floor — drawn only while the player is inside,
// pottering between these marks (feet; clear of every cabinet's tap box, the litter and the way in), in and out through
// its doorway. At night they are upstairs like everybody else.
const INSIDE = { condo: { door: [588, 540], marks: [[752, 392, 'front'], [660, 388, 'left'], [470, 394, 'right']] } };
const roomFor = (n, beat) => beat !== 5 && INSIDE[n.home];   // no glow for garden_w: a garden has no window (Trym, 15 Sep: "a glow under the bench")
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
// 🫁 THE STANDING SWAY, a different period each. It was 2.1–4.7 s and read as nothing at all: Trym, 25 Sep 2026, "just
// opened banana world … lots of town bananas just standing there statically - not a great first impression".
const SWAY_MIN = 1000, SWAY_VAR = 1300;
// how long they stand at a mark before moving to the next one: a wide spread so two neighbours never
// shift at the same moment (which is what made the pairs look choreographed) — and short enough that a
// newcomer sees somebody move in the first few seconds
const DWELL_MIN = 2600, DWELL_VAR = 6000;
// 💃 THE DANCE (25 Sep 2026): they are dancing bananas, and now and then one dances — two bars of the original GIF
// (8 frames × 100 ms) where they stand. Never two neighbours at once, never on anybody else's beat, the first within
// seconds of a visit. A dance MOVES through the front frames; standing still in one is still the posing §12 Sep forbids.
const DANCE_MS = 1600, DANCE_GAP_MIN = 20000, DANCE_GAP_VAR = 30000, DANCE_NEAR = 260;
// 👀 A GLANCE: somebody minding a shop looks up and round now and then, and back (side frames only)
const GLANCE_MIN = 5000, GLANCE_VAR = 9000;
// 🗣 A PAIR TALKS: turns of TALK_MS (each pair on its own phase), and whoever's turn it is bobs twice as it starts —
// with no speech bubbles (the quiet rule), that back-and-forth is the conversation
const TALK_MS = 2600;
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
  let base = n.face === 'left' ? 4 : n.face === 'right' ? 0 : (n.x > 1100 ? 4 : 0);
  if (!n.glanceNext) n.glanceNext = now + 1500 + h01(n.idx + 1, 5, 94) * GLANCE_VAR;
  if (now >= n.glanceNext) { n.glanceTo = now + 900 + h01(n.idx + 1, Math.floor(now / 1009), 95) * 1400; n.glanceNext = n.glanceTo + GLANCE_MIN + h01(n.idx + 1, Math.floor(now / 1013), 96) * GLANCE_VAR; }
  if (now < n.glanceTo && n.pk < 0) base = base === 4 ? 0 : 4;   // a pair keeps its eyes on each other
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
  let roomNow = '';   // 🕹 the room the player stands in ('' = the square)

  // the residents: one .tw-npc each (a canvas; no name over the head — a name is read on the card when you
  // walk up and talk, Trym 15 Sep) and their home's window glow
  const res = R.map((r, idx) => {
    const el = document.createElement('div');
    el.className = 'tw-npc';
    // 🧪 WHO THIS ONE IS, for a walk to tap. The square also carries nameless VISITORS wearing the same
    // class, so "the nearest banana" stopped being "the resident" on 20 Sep and a walk that tapped by
    // proximity was a coin flip — it failed both its attempts in one full-suite run and passed alone.
    el.dataset.k = r.key;
    const cv = document.createElement('canvas'); cv.width = cv.height = 150;
    el.appendChild(cv);
    el.hidden = true;
    world.appendChild(el);
    const outfit = { hat: r.hat || 'none', glasses: r.glasses || 'none', extras: r.tool ? { [r.tool]: true } : {}, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
    return { ...r, idx, el, cv, ctx: cv.getContext('2d'), outfit, x: 0, y: 0, px: NaN, py: NaN, drawn: '', face: 'front',
      path: [], wait: 0, walking: false, loop: null, li: 0, ldir: 1, hidden: true, beat: -1, place: '', act: '', talked: false, lastWater: 0, bedI: 0, glow: null,
      marks: [], mi: 0, dwell: 0, drift: null, sway: SWAY_MIN, swayAt: 0, swayF: 0,
      danceAt: 0, danceNext: 0, pk: -1, talkPh: 0, lift: false, glanceTo: 0, glanceNext: 0 };
  });
  // glows: one per home window; two residents above the arcade, the Figs share a lantern
  const glowCount = {};
  for (const n of res) {
    const pts = GLOW[n.home] || [], k = glowCount[n.home] || 0; glowCount[n.home] = k + 1;
    const g = pts[k];   // Twirl lodges at Dot's print shop: one shop window, one glow
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
    const odd0 = overrideFn && overrideFn(n, beat);
    // 🕯 an override may INSIST ({ place, always }): the chapter's Nib waits at the fountain through the night too
    const odd = odd0 && odd0.place ? odd0.place : odd0, insist = !!(odd0 && odd0.always);
    // …on a point of that place nobody stands on this hour: the first point stacked it on whoever lives there (Trym, 24 Sep:
    // "Moss comes around and stand on top of Spinner")
    if (odd && ST[odd] && (act !== 'home' || insist)) { const taken = res.filter((m) => m !== n && m.day[beat][0] === odd && !/^(sweep|stroll|home)$/.test(m.day[beat][1])).length, p = ST[odd][Math.min(taken, ST[odd].length - 1)]; return { place: odd, act: 'stand', face: p[0] > 1100 ? 'left' : 'right', lines, x: p[0], y: p[1], loop: null, insist }; }
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
    return { place, act, face: f, lines, x, y, loop: null, paired: group.length > 1 && pts.length > 1, pk: k % 2 };
  }
  function goHome(n, walked) {
    const room = roomFor(n, n.beat);
    if (room) { goIn(n, room, walked); return; }
    goOut(n);
    n.hidden = true; n.el.hidden = true;
    // the window lights when they are home for the NIGHT; a resident kept in by the day (or
    // a Curse Night) sits behind a dark window, and a low town leaves some windows dark
    if (n.glow) n.glow.hidden = !!n.kept || !!(glowFn && !glowFn(n));
  }
  // 🕹 into the room of their home: at its doorway and a walk to the first mark if they came in the door, on the mark if placed
  function goIn(n, room, walked) {
    n.inside = true; n.hidden = false; n.el.classList.add('is-in'); n.el.hidden = roomNow !== n.home; n.px = NaN;
    if (n.glow) n.glow.hidden = true;   // downstairs at work: the flat's window stays dark
    const m = room.marks[0];
    n.marks = room.marks; n.mi = 0; n.drift = null; n.face = m[2];
    if (walked) { n.x = room.door[0]; n.y = room.door[1]; n.path = [[m[0], m[1]]]; n.wait = 0; } else { n.x = m[0]; n.y = m[1]; n.path = []; }
  }
  function goOut(n) { if (!n.inside) return; n.inside = false; n.el.classList.remove('is-in'); n.px = NaN; }
  function leaveRoom(n) { goOut(n); const d = HOME[n.home]; n.x = d[0]; n.y = d[1]; n.el.hidden = false; }   // through the room's doorway, out of the street door
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
      // 🕯 …except a place the story INSISTS on: the day's seeded few once picked the chapter's Nib, and chapter one
      // opened on an empty fountain (23 Sep 2026)
      n.kept = !!(keepFn && keepFn(n, beat) && st.act !== 'home' && !st.insist);
      if (n.kept) {
        n.beat = beat; n.place = 'home'; n.act = 'home'; n.lines = st.lines; n.loop = null; n.drift = null;
        if (!n.inside) n.marks = [];
        if (n.inside) { n.path = []; n.wait = 0; }   // 🕹 kept in, and in already: at work indoors
        else if (walk && !n.hidden) { const d = HOME[n.home]; n.path = route([n.x, n.y], [d[0], d[1]]); n.wait = 400 + h01(n.idx + 1, beat + 1, 7) * 12000; n.walking = false; }
        else { n.path = []; n.walking = false; n.wait = 0; goHome(n); }
        continue;
      }
      n.beat = beat; n.place = st.place; n.act = st.act; n.face = st.face; n.lines = st.lines; n.loop = st.loop; n.li = 0; n.ldir = 1; n.st = [st.x, st.y];
      n.pk = st.paired ? st.pk : -1; n.talkPh = Math.round(h01(st.place.length + 3, beat + 1, 51) * TALK_MS * 2);   // one phase per pair
      n.lastWater = 0;
      n.marks = marksFor(n, st, beat); n.mi = 0; n.drift = null;
      n.dwell = DWELL_MIN + h01(n.idx + 1, beat + 1, 11) * DWELL_VAR;
      n.sway = SWAY_MIN + h01(n.idx + 1, beat + 1, 12) * SWAY_VAR;
      const room = st.act === 'home' && roomFor(n, beat);
      if (n.inside && room) { n.marks = room.marks; n.path = []; n.wait = 0; n.walking = false; continue; }   // 🕹 in, and staying in
      if (walk) {
        // 🚪 THE WAIT IS SPENT INDOORS (24 Sep 2026). leaveHome() used to stand them on the doorstep the moment the beat turned
        // and they waited THERE, up to 74 s — so housemates stood on each other at one door (Moss on Spinner at the arcade's,
        // Trym: "its hard to interact with Spinner when moss is placed on top of him"). Now they come out when it is time to go.
        if (n.inside) n.path = [[...INSIDE[n.home].door, 'out'], ...(st.act === 'home' ? [] : route(HOME[n.home], [st.x, st.y]))];
        else {
          if (n.hidden && st.act !== 'home') { const d = HOME[n.home]; n.x = d[0]; n.y = d[1]; }
          n.path = route([n.x, n.y], [st.x, st.y]);
        }
        // ⏳ their OWN moment to set off: up to two thirds of the beat, so the town never migrates at once
        n.wait = 400 + h01(n.idx + 1, beat + 1, 5) * 74000;
        n.walking = false;
      } else {
        n.path = []; n.walking = false; n.wait = 0;
        // ⚠️ OUT OF THE HOUSE FIRST, THEN TO THE PLACE (24 Sep 2026). Everyone is made hidden, and leaveHome() puts a
        // hidden resident on their DOORSTEP — so taking the place first and leaving home second stood seven of nine at
        // their front doors on every real first load (Bean not at his counter, Nib not at the fountain under the
        // newcomer's "!"), each then waiting up to 74 s to walk out. Every walk pinned the hour first, and a second
        // placement found them visible — so no walk saw it; tests/town-first-frame.spec.mjs loads the town as it comes.
        if (st.act === 'home') { n.x = st.x; n.y = st.y; goHome(n); } else { goOut(n); leaveHome(n); n.el.hidden = false; n.x = st.x; n.y = st.y; }
      }
    }
    if (mayorEl) mayorEl.hidden = beat !== 4;
  }
  function arrive(n) {
    n.walking = false; n.path = [];
    if (n.act === 'home' && !n.inside) goHome(n, true);
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
    if (!n || !n.name) return null;   // the words are still on their way
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
    if (ask.curse && n.curse) topics.push({ q: ask.curse, a: fill(n.curse) });   // Moss: the nights, the cursed things, the ghosts (Trym, 15 Sep: told by a resident, not the board)
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
    n.el.style.left = pct(n.x, W); n.el.style.top = pct(n.y, H); n.el.style.zIndex = String((n.inside ? 2100 : 100) + Math.round(n.y));   // 🕹 in a room: the player's own layer
  }
  function step(n, tx, ty, dt) {   // one step toward (tx, ty); true when there
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy), s = WALK * dt;
    if (d <= s) { n.x = tx; n.y = ty; return true; }
    n.x += dx / d * s; n.y += dy / d * s;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : 'front';
    return false;
  }

  // 💃🗣 A BANANA STANDING STILL (25 Sep 2026): now and then two bars of dance where they stand — never beside another
  // dancer, the first within seconds — and in a pair at their post, the talk: whoever's turn it is bobs twice as the turn
  // starts (the canvas lifts; the shadow stays down). ⚠️ BOTH ways of standing call this: at their post, and waiting at
  // it with a walk on the clock (up to 74 s after every refresh — the square's condition arriving on a first load is
  // one). The first version lived in the second branch only, and on a real first visit most of the town never danced.
  function idle(n, now, frame, atPost) {
    let lift = false;
    if (!n.danceNext) n.danceNext = now + 4000 + h01(n.idx + 1, 7, 91) * 20000;
    if (n.danceAt) {
      const t = now - n.danceAt;
      if (t < DANCE_MS) frame = Math.floor(t / 100) % 8;
      else { n.danceAt = 0; n.danceNext = now + DANCE_GAP_MIN + h01(n.idx + 1, Math.floor(now / 997), 92) * DANCE_GAP_VAR; }
    } else if (now >= n.danceNext && !n.hidden) {
      if (res.some((m) => m !== n && m.danceAt && Math.hypot(m.x - n.x, m.y - n.y) < DANCE_NEAR)) n.danceNext = now + 2000 + h01(n.idx + 1, 3, 93) * 3000;
      else { n.danceAt = now; frame = 0; }
    }
    if (atPost && n.pk >= 0 && !n.danceAt) {
      const t = (now + n.talkPh) % (TALK_MS * 2), tt = t % TALK_MS;
      lift = (n.pk === 0 ? t < TALK_MS : t >= TALK_MS) && ((tt > 60 && tt < 200) || (tt > 330 && tt < 470));
    }
    return [frame, lift];
  }

  function tick(now, dt) {
    if (!ready) return;
    const beat = beatOf(hourNow());
    if (beat !== curBeat) changeBeat(beat, true);
    const bob = Math.floor(now / BOB_MS) % 2;
    for (const n of res) {
      let frame, lift = false, stood = false;
      if (n.path.length) {
        if (n.wait > 0) {   // still at their post, not posing — and alive there
          n.wait -= dt * 1000; stood = true;
          [frame, lift] = idle(n, now, standFrame(n, now), !!n.st && Math.hypot(n.x - n.st[0], n.y - n.st[1]) < 8);
        }
        else {
          if (n.hidden && n.act !== 'home') leaveHome(n);   // 🚪 out of the door now that it is time
          n.walking = true;
          const p = n.path[0];
          if (step(n, p[0], p[1], dt)) { n.path.shift(); if (p[2]) leaveRoom(n); if (!n.path.length) arrive(n); }
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
        n.walking = false; stood = true;
        [frame, lift] = idle(n, now, standFrame(n, now), true);
        // …and every so often they move to another mark round the station: the pottering that makes a
        // shopkeeper look like they are working rather than posing (never in the middle of a dance)
        if (n.marks.length > 1 && !n.path.length && !n.danceAt) {
          n.dwell -= dt * 1000;
          if (n.dwell <= 0) {
            n.mi = (n.mi + 1 + Math.floor(h01(n.idx + 1, n.beat + 1, n.mi + 40) * (n.marks.length - 1))) % n.marks.length;
            const m = n.marks[n.mi];
            n.drift = (Math.hypot(m[0] - n.x, m[1] - n.y) > 4) ? m : null;
            if (!n.drift) { n.face = m[2] || n.face; n.dwell = DWELL_MIN + h01(n.idx + 1, n.beat + 1, n.mi + 21) * DWELL_VAR; }
          }
        }
      }
      if (!stood && n.danceAt) { n.danceAt = 0; n.danceNext = now + DANCE_GAP_MIN; }   // set off mid-dance: the walk wins
      if (n.lift !== lift) { n.lift = lift; n.el.classList.toggle('is-lift', lift); }
      if (n.hidden) continue;
      if (n.inside) { const off = roomNow !== n.home; if (n.el.hidden !== off) n.el.hidden = off; if (off) continue; }
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
    const hit = (n) => Math.abs(wx - n.x) < 34 && wy < n.y + 6 && wy > n.y - 90;
    if (roomNow) { for (const n of res) if (n.inside && n.home === roomNow && hit(n)) return ['npc', n.key]; return null; }
    for (const f of flyers) if (!f.gone && Math.abs(wx - f.x) < 26 && wy < f.y + 8 && wy > f.y - 40) return ['flyer', f.i];
    for (const n of res) if (!n.hidden && !n.inside && hit(n)) return ['npc', n.key];
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
  // 🕯 …and one resident sets off NOW: a refresh gives everybody their own moment (up to 74 s), which is
  // right for a beat and wrong for Nib the second the chapter lets him go — "he walks up to the town
  // hall" has to be what you see, not what happens a minute after you looked away
  const nudge = (key) => { const n = byKey(key); if (n && n.path.length) n.wait = Math.min(n.wait, 500); };
  // 🕹 banana-town.js, on every door. Placed and drawn AT ONCE: unhidden and left for the next frame, they stood a frame at
  // the world's corner with no depth (a walk caught z 0)
  const setRoom = (k) => { roomNow = k || ''; for (const n of res) if (n.inside) { n.el.hidden = roomNow !== n.home; if (!n.el.hidden) { placeEl(n); draw(n, standFrame(n, performance.now())); } } };
  const setLitter = (level) => { const l = Math.max(0, Math.min(2, level | 0)); if (l === litterLevel) return; litterLevel = l; if (ready) spawnLitter(curBeat, true); };
  const seam = {
    hour: () => hourNow(),
    kept: () => res.filter((n) => n.kept).map((n) => n.key),
    glows: () => res.filter((n) => n.glow && !n.glow.hidden).map((n) => n.key),
    beat: () => curBeat,
    set: (h) => { setHour = h == null ? null : +h; setAt = performance.now(); if (ready) changeBeat(beatOf(hourNow()), false); },
    residents: () => res.map((n) => ({ key: n.key, x: Math.round(n.x), y: Math.round(n.y), beat: BEATS[n.beat] || '', place: n.place, act: n.act, tool: n.tool || 'none', walking: n.walking, hidden: n.hidden || (!!n.inside && roomNow !== n.home), inside: !!n.inside, face: n.face, frame: n.drawn, leg: !!(n.path.length && n.wait <= 0), waiting: n.wait > 0, potter: !!n.drift, dancing: !!n.danceAt, pair: n.pk, mark: n.mi, st: n.st || null })),   // `leg` = actually crossing town; a resident with a path but time on the clock is still at their post
    litter: () => flyers.filter((f) => !f.gone).length,
    flyers: () => flyers.filter((f) => !f.gone).map((f) => ({ i: f.i, x: f.x, y: f.y })),
    rung,
    talk,
    facing: () => res.filter((n) => !n.hidden && !n.inside).map((n) => ({ key: n.key, face: n.face, place: n.place })),
    pick,
    mayor: () => !!(mayorEl && !mayorEl.hidden),
  };
  COPY_P.then((COPY) => applyCopy(res, COPY)).catch((e) => console.error('town-life: the words did not load', e));
  return { tick, at, talk, standBy, pick, pickAt, flyer, sweep, start, seam, setKeep, setGlow, setOverride, nudge, setLitter, setRoom, route, beat: () => curBeat, homeOf: (key) => { const n = byKey(key); return n ? HOME[n.home] : null; } };
}
