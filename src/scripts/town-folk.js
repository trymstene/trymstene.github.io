// 🚶 THE TOWN'S VISITORS — bananas from the rest of Banana Town, 20 Sep 2026.
//
// ⭐ TRYM'S FRAME, and it is the whole reason this works: *"when we think of the Banana Town area —
// that's not really the whole town, it's just a part of it, the centre of it — so it makes sense
// that the map really is bigger but in the background."* So the square is a CENTRE, and bananas
// wander into it from the roads that leave the map: the south road the player themselves came in on,
// the north road out of the square, and the bus stop on the east side. They cross it, sit on a
// bench, go into a shop, stand about — and they leave again.
//
// ⭐ AND THE RESIDENTS STAY PUT. *"maybe it's best if the townsfolk NPCs don't do too much other than
// walk about sometimes greeting each other … mainly standing by their shops, to keep some
// consistency and not make it too messy with tons of bananas always on the move everywhere, it can
// get chaotic."* The nine residents are the town's fixtures; these are its traffic. One system
// should move and the other should be somewhere you can find it.
//
// ⚠️ THEY ARE NOT RESIDENTS AND MUST NEVER BE MISTAKEN FOR ONE. No name, no card, no dialogue: you
// cannot tap them, they are not in life.at()'s list or the room's `bodies`, and the Quiet Rule holds
// harder here than anywhere — a banana with no name that talks to you is a bug, not a character.
// They wear `.tw-npc .tw-visitor` so both of the town's `.is-inside` hide lists already blank them
// the moment the player steps into a room (design library §22).
//
// ⚠️ THE ENGINE'S `face` LABELS ARE INVERTED vs what you see: FRAMES[0].face says 'right' but frame 0
// VISUALLY looks LEFT, and frame 4 (`face:'left'`) VISUALLY looks RIGHT. Verified on the beach by
// cropping banana-dance.png, and that is where the sitting pair comes from — Banana Bay has sat
// bananas on chairs since July with exactly these two frames.
import { STREETS, SPOTS, SEATS, OB_RECTS, OB_CIRCLES } from './town-geo.js';
import { FRAME_H_FRAC, FRAME_TOP_FRAC } from '../lib/banana-geo.js';

const F_LEFT = 0, F_RIGHT = 4;      // the side-facing crouch the beach sits its bananas on
const WALK = 96;                    // px a second — a stroll, slower than the player's 168
const MAX = 6;                      // ⭐ Trym: "a max of 6-8 roaming bananas … at the same time"
const GAP = [7000, 19000];          // how long between arrivals, before the cap bites
// ⭐ AND HOW MANY OF THEM DEPENDS ON THE TOWN. An Abandoned square with six strangers strolling it
// says nothing is wrong; the crowd IS the band, the same way the lamps and the shutters are. 6 is
// Trym's own ceiling and thriving keeps it. (The baked statue-visitors in LOOK are a different and
// much smaller set — 0/0/0/1/3 — because those stand still all day.)
const CROWD = { abandoned: 0, struggling: 1, recovering: 3, lively: 5, thriving: 6 };

// Where the rest of the town reaches this square: the south road the player themselves came in on,
// the north road out of the square, and the bus stop on the east side.
//
// ⚠️ A GATE IS TWO POINTS, and it has to be. `at` is where a banana appears or vanishes — the very
// edge of the map, or a bus stop that stands OFF the road — and `on` is the step onto the street.
// With one point the bus stop was not on any street, so streetAt() fell back to the nearest one by
// centre distance and every arrival from it set off cross-country: a banana was caught at 1995,152,
// walking diagonally over the grass between two roads. Its own walk found it.
const GATES = [
  { at: { x: 1100, y: 1292 }, on: { x: 1100, y: 1200 } },
  { at: { x: 1944, y: 12 }, on: { x: 1944, y: 140 } },
  { at: { x: 2060, y: 330 }, on: { x: 1952, y: 330 } },
];

// ---- the lanes, derived from the town's own streets --------------------------------------------
// ⚠️ NOT A HAND-DRAWN GRAPH. STREETS is the walkable ground the scene builder laid down, and two
// streets that overlap are an intersection — so the graph IS the data, and re-baking the town cannot
// leave a visitor walking through a building because somebody forgot to move a waypoint.
const mid = (r) => ({ x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2 });

// ⛔ …AND THE STREETS HAVE THE PROPS CUT OUT OF THEM. Trym, 20 Sep: "the visiting roaming bananas
// overflows some objects in the town, the fountain they just walk right through." They did, and it was
// never one bad waypoint: STREETS is the walkable GROUND and the plaza is one rectangle 880×380 with
// the fountain, both market stalls, the notice board, the cart, two planters and two benches standing
// inside it. route() drew a straight line across that rectangle and the visitor walked through
// whatever stood on the way — the player never did, because the player is stopped by the same
// colliders these lanes ignored.
//
// So the lanes are the streets MINUS the colliders, carved here from the very same OB_RECTS and
// OB_CIRCLES the player is stopped by. A vertical-slab cut per street, runs with the same gap merged
// back into wide rectangles, and the result is a graph that cannot contain a prop — today, or after
// somebody moves one, because it is derived and not drawn. tools/check-town-lanes.mjs holds both
// halves of the promise: no lane carries an obstacle, and the lanes are still ONE connected place.
const PAD = 6;   // a banana has width; skimming a collider's corner still reads as walking through it
const BOXES = [
  ...OB_RECTS.map((r) => [r[0] - PAD, r[1] - PAD, r[2] + PAD, r[3] + PAD]),
  ...OB_CIRCLES.map((c) => [c[0] - c[2] - PAD, c[1] - c[2] - PAD, c[0] + c[2] + PAD, c[1] + c[2] + PAD]),
];
const MIN_LANE = 26;   // a slice thinner than a banana is not a lane, it is a seam between two props

function carve(st) {
  const hit = BOXES.filter((b) => b[0] < st[2] && b[2] > st[0] && b[1] < st[3] && b[3] > st[1]);
  if (!hit.length) return [st];
  // the x where anything starts or stops blocking, clipped to the street
  const xs = [...new Set([st[0], st[2], ...hit.flatMap((b) => [b[0], b[2]])])]
    .filter((x) => x >= st[0] && x <= st[2]).sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i], x1 = xs[i + 1];
    if (x1 - x0 < 1) continue;
    // what blocks this slab, as y spans, merged
    const spans = hit.filter((b) => b[0] < x1 && b[2] > x0)
      .map((b) => [Math.max(b[1], st[1]), Math.min(b[3], st[3])])
      .sort((p, q) => p[0] - q[0]);
    let y = st[1];
    const free = [];
    for (const [a0, a1] of spans) {
      if (a0 - y >= MIN_LANE) free.push([y, a0]);
      y = Math.max(y, a1);
    }
    if (st[3] - y >= MIN_LANE) free.push([y, st[3]]);
    for (const [y0, y1] of free) {
      // ⬅ merge straight back onto the slab to its left when the gap is the same one: without this a
      // street becomes forty thin columns and a visitor zig-zags across it, one waypoint per seam.
      const last = out[out.length - 1];
      if (last && last[2] === x0 && last[1] === y0 && last[3] === y1) last[2] = x1;
      else out.push([x0, y0, x1, y1]);
    }
  }
  return out;
}

const LANES = STREETS.flatMap(carve);

// ⭐ AND NOBODY IS SENT SOMEWHERE THEY CANNOT STAND. The lanes being clean fixes the WALK; this fixes
// the DESTINATION. Two of the "stand about" spots sit behind a prop — the info kiosk's own anchor is
// under the kiosk, the terrace's is under the terrace table — so the last straight line to them went
// through it, however clean the lanes were. A spot on no lane is pulled to the nearest edge of the
// nearest one: the visitor stands beside the kiosk instead of inside it. A SEAT is never snapped, for
// the opposite reason — a sitter is meant to be inside the bench (that is what sitting looks like).
function nearLane(x, y) {
  if (LANES.some((L) => inRect(L, x, y))) return { x, y };
  let best = { x, y }, d = Infinity;
  for (const L of LANES) {
    const cx = Math.max(L[0] + 8, Math.min(x, L[2] - 8));
    const cy = Math.max(L[1] + 8, Math.min(y, L[3] - 8));
    const k = Math.hypot(cx - x, cy - y);
    if (k < d) { d = k; best = { x: cx, y: cy }; }
  }
  return best;
}
// ⚠️ TOUCHING IS CONNECTED. The scene builder lays streets edge to edge — the plaza's top edge IS
// the north street's bottom edge, at y 660 exactly — so a strict overlap test finds no intersection
// and the whole middle of the square becomes an ISLAND. route() then falls back to a straight line
// and bananas walk diagonally over the grass between two roads. Seen twice in the walk (1995,152 and
// 1890,353) before this number existed.
const JOIN = 12;
const overlap = (a, b) => {
  const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
  if (x1 < x0 - JOIN || y1 < y0 - JOIN) return null;
  // the crossing sits in the middle of the shared edge, and inside BOTH rectangles when they only touch
  return { x: Math.max(Math.max(a[0], b[0]), Math.min((x0 + x1) / 2, Math.min(a[2], b[2]))),
    y: Math.max(Math.max(a[1], b[1]), Math.min((y0 + y1) / 2, Math.min(a[3], b[3]))) };
};
const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
const LINKS = LANES.map(() => []);
for (let i = 0; i < LANES.length; i++) {
  for (let j = i + 1; j < LANES.length; j++) {
    const o = overlap(LANES[i], LANES[j]);
    if (o) { LINKS[i].push({ to: j, at: o }); LINKS[j].push({ to: i, at: o }); }
  }
}
// the street a point is on, or the nearest one to it
function streetAt(x, y) {
  for (let i = 0; i < LANES.length; i++) if (inRect(LANES[i], x, y)) return i;
  let best = 0, d = Infinity;
  LANES.forEach((r, i) => { const m = mid(r), k = Math.hypot(m.x - x, m.y - y); if (k < d) { d = k; best = i; } });
  return best;
}
// a walk from here to there, as the crossings between the streets that get you from one to the other
function route(from, to) {
  const a = streetAt(from.x, from.y), b = streetAt(to.x, to.y);
  if (a === b) return [to];
  const prev = new Map([[a, null]]), q = [a];
  while (q.length) {
    const s = q.shift();
    if (s === b) break;
    for (const l of LINKS[s]) if (!prev.has(l.to)) { prev.set(l.to, { s, at: l.at }); q.push(l.to); }
  }
  // ⚠️ a straight line is the LAST resort and it is counted, because it is the one way a visitor
  // can end up crossing a lawn or a building. The walk asserts this never fires.
  if (!prev.has(b)) { strays++; return [to]; }
  const out = [];
  for (let s = b; prev.get(s); s = prev.get(s).s) out.unshift(prev.get(s).at);
  out.push(to);
  return out;
}

// ---- a visitor, seeded so a reload does not reroll the town ------------------------------------
// splitmix32, the world's own PRNG (memory: daily-banana-overlay)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}
let strays = 0;
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// ⭐ "or maybe they are having balloon wearable in his hand, or any other wearable hand or hat
// wearable on them to randomize them a bit" — a hat most of the time, something in hand some of the
// time, and now and then a banana with neither, because a crowd where everyone is dressed up is a
// parade. Every id here is free to wear: nothing earned, nothing a supporter paid for.
const HATS = ['party', 'crown', 'tophat', 'cowboy', 'sombrero', 'beanieprop', 'backwardscap', 'gradcap',
  'tricorn', 'jester', 'duckhat', 'watermelonhat', 'buckethat', 'snailhat', 'nightcap', 'fishbowl'];
// ☕ ⚠️ NO `mug` HERE. A coffee mug means one thing in this town now — that banana just bought a coffee
// at the counter — and a mug on 3% of random strangers is what stopped it meaning anything.
const HELD = ['balloons', 'balloondog', 'boombox', 'lemonjug', 'broom', 'letter', 'potato',
  'cactuspot', 'rubberchicken', 'bigfish', 'vinyl', 'trophy', 'oldcane'];
const GLASSES = ['shades', 'nerd', 'potter', 'threed', 'monocle'];

export function bootTownFolk(ctx) {
  const { world, W, H, pct, PROPS, drawMe, inside, band, nightOut } = ctx;
  const folk = [];
  let nextAt = 0, seedN = 0, stopped = false;
  const capNow = () => { const n = CROWD[band ? band() : 'thriving']; return Math.min(MAX, n == null ? MAX : n); };

  // ⚠️ THE SEATS ARE DECLARED AT THE PROP, never guessed from the key. Scanning PROPS for `bench*`
  // sat a banana on the square's Flowers_Bench planters — keyed benchh0/h1 and not a seat at all —
  // where it vanished behind the petals with only a nightcap showing. The builder is the only place
  // that knows which bench is a bench, and which way its sitter should look.
  //
  // 🪑 SITTING TOOK TWO GOES AND THEY ARE DIFFERENT PROBLEMS. The first is WHICH ORDER, the second is
  // WHERE.
  //
  // ⚠️ ORDER: A SITTER OVERFLOWS THE BENCH, and that needs its z decoupled from its y. Everything
  // outdoors sorts by `100 + y` and a seat is ABOVE the bench's own foot, so a banana sitting there
  // sorted BEHIND the thing it was sitting on and was painted over with the backrest. Trym, 20 Sep:
  // "when a banana sits on a bench he must overflow the bench, they now sit behind the bench
  // visually." It takes the bench's own z plus two instead, so the bench peeks out either side and
  // below it — which is what somebody sitting on one looks like.
  //
  // ⚠️ WHERE: AND IT SITS DOWN ON IT. Trym, same day: "when bananas sit on the bench in the town they
  // can anchor a bit lower on the bench, right now it looks like they stand sitting on the bench."
  // At base - 2 the feet landed 58% of the way down the square's plank — above the seat, which is the
  // pose of somebody standing behind it.
  //
  // ⭐ A FRACTION OF THE BENCH, NEVER A NUMBER OF PIXELS. The town has three bench shapes and they are
  // 38, 51 and 110 px tall, so one offset cannot serve them: the drop that seats a banana on the low
  // plank stands it on the grass in front of the tall terrace bench. Photographed at five drops on one
  // bench of each shape (qa-shots/sit-*) and all three read as SITTING at the same place — the feet
  // about seven eighths of the way down the bench's own height. So that is the rule, and the pixels
  // fall out of it.
  const SEAT_LINE = 0.88;
  // ⚠️ AND THE FEET ARE NOT THE ELEMENT'S BOTTOM EDGE. The element is a square canvas 4.5% of the world
  // wide (town.astro .tw-npc) and the banana is drawn inside it with headroom for a hat, so its feet
  // sit this far above the bottom — the engine's own frame geometry, imported rather than guessed.
  const FOOT_PAD = (1 - FRAME_TOP_FRAC - FRAME_H_FRAC) * (0.045 * W);
  const BENCHES = (SEATS || []).map(([key, x, base, face]) => {
    const h = (PROPS[key] || {}).h || 40;
    return { key, x, y: Math.round(base - h * (1 - SEAT_LINE) + FOOT_PAD), z: 100 + base + 2, face, taken: false };
  });
  // the shopfronts a banana might disappear into for a while
  const DOORS = ['store', 'condo', 'post', 'hall', 'print', 'cafe'].filter((k) => PROPS[k]).map((k) => {
    const p = PROPS[k];
    return { key: k, x: p.x + p.w / 2, y: p.base + 14 };
  });

  function body(v) {
    const el = document.createElement('div');
    el.className = 'tw-npc tw-visitor';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 150;
    el.appendChild(cv);
    world.appendChild(el);
    v.el = el; v.cv = cv; v.g = cv.getContext('2d'); v.drawn = -1;
  }

  function spawn(now) {
    if (folk.length >= capNow()) return;
    const r = rng((Math.floor(now / 1000) * 2654435761 + (seedN++) * 40503) >>> 0);
    const gate = pick(r, GATES);
    const hat = r() < 0.72 ? pick(r, HATS) : 'none';
    const extras = {};
    if (r() < 0.45) extras[pick(r, HELD)] = true;
    const v = {
      x: gate.at.x, y: gate.at.y, path: [], frame: 2, face: 'front', bob: 0, bobAt: now,
      outfit: { hat, glasses: r() < 0.22 ? pick(r, GLASSES) : 'none', extras, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' },
      job: null, until: 0, seat: null, gone: false, r,
    };
    body(v);
    folk.push(v);
    v.path = [gate.on];        // off the bus, or in off the road, before any routing happens
    v.next = () => errand(v, performance.now());
    errand(v, now, gate.on);
  }

  // ⭐ what a banana came into town to do. Mostly nothing much, which is the point: a square where
  // everybody has an errand reads like a stage, and a square where some of them are only passing
  // through reads like a place.
  function errand(v, now, from) {
    const head = from || { x: v.x, y: v.y };
    const roll = v.r();
    const free = BENCHES.filter((b) => !b.taken);
    if (roll < 0.30 && free.length) {
      const b = pick(v.r, free);
      b.taken = true; v.seat = b;
      v.job = 'sit'; v.until = 0;
      go(v, { x: b.x, y: b.y }, head);
    } else if (roll < 0.55 && DOORS.length) {
      const d = pick(v.r, DOORS);
      v.job = 'shop'; v.until = 0;
      go(v, { x: d.x, y: d.y }, head);
    } else if (roll < 0.72) {
      v.job = 'stand'; v.until = 0;
      const s = SPOTS[pick(v.r, ['exchange', 'wheel', 'cart', 'info', 'monument', 'terrace'])] || SPOTS.exchange;
      go(v, nearLane(s.x + (v.r() - 0.5) * 90, s.y + 30), head);
    } else {
      v.job = 'leave';
      goGate(v, head);
    }
  }
  // ⚠️ the head is where the walk STARTS FROM, which is not always where the banana stands: on
  // arrival it is the gate's step onto the road, because the route out of a bus stop begins there.
  const go = (v, to, from) => { v.path = (v.path || []).concat(route(from || { x: v.x, y: v.y }, to)); };
  const goGate = (v, from) => { const g = pick(v.r, GATES); go(v, g.on, from); v.path.push(g.at); };

  function leave(v) {
    if (v.seat) { v.seat.taken = false; v.seat = null; }
    v.sitting = false;
    // ⚠️ AND THE REST IS OVER. step() returns early for anything with `until` in the future — a banana
    // on a bench or inside a shop — so calling leave() on one did nothing at all until its own clock ran
    // out. At nightfall that left half the square still sitting there minutes after the lamps came on.
    v.until = 0;
    if (v.el && v.el.hidden) v.el.hidden = false;   // it was indoors: it has to come out to walk home
    v.job = 'leave';
    v.path = [];
    goGate(v);
  }
  function kill(v) {
    if (v.seat) { v.seat.taken = false; v.seat = null; }
    if (v.el) v.el.remove();
    v.gone = true;
  }

  function step(v, dt, now) {
    // sitting or gone indoors: nothing moves, and the clock decides when they have had enough
    if (v.job === 'queue' && !v.path.length) {
      // ☕ holding the rope: the counter owns where it stands — but not how it stands. The longer it waits
      // the faster it shifts its weight, and that is the whole patience readout now.
      const per = v.pat === 2 ? 470 : v.pat === 1 ? 1100 : 0;
      if (per && now - v.bobAt > per) { v.bobAt = now; v.bob = v.bob ? 0 : 1; }
      return;
    }
    if (v.until) {
      if (now < v.until) return;
      v.until = 0;
      if (v.job === 'shop' && v.el.hidden) v.el.hidden = false;
      leave(v);
      return;
    }
    if (!v.path.length) return;
    const t = v.path[0];
    const dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy);
    if (d < 4) {
      v.path.shift();
      if (v.path.length) return;
      arrive(v, now);
      return;
    }
    const s = Math.min(d, WALK * dt);
    v.x += (dx / d) * s; v.y += (dy / d) * s;
    v.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : 'front';
    if (now - v.bobAt > 260) { v.bobAt = now; v.bob = v.bob ? 0 : 1; }
  }

  function arrive(v, now) {
    if (v.job === 'leave') { kill(v); return; }
    if (v.job === 'sit' && v.seat) {
      // ⚠️ the sitting frames are the BEACH's, and its comment is the reason: the engine's `face`
      // labels are inverted, so frame 0 looks LEFT and frame 4 looks RIGHT. Which way a sitter faces
      // is the BUILDER's to say — the terrace pair face their own fountain, not the middle of the map.
      v.frame = v.seat.face === 'l' ? F_LEFT : F_RIGHT;
      v.sitting = true;
      v.until = now + 18000 + v.r() * 40000;
      return;
    }
    if (v.job === 'shop') { v.el.hidden = true; v.until = now + 9000 + v.r() * 22000; return; }
    // ☕ sent to the café's rope: it waits there until whoever sent it says otherwise. ⚠️ `until` is
    // left at 0 on purpose — a queued banana must not wander off on the ordinary timer, because the
    // counter is holding its patience clock and owns when it gives up.
    if (v.job === 'queue') { v.frame = 2; if (v.arrived) { const f = v.arrived; v.arrived = null; f(v); } return; }
    v.until = now + 6000 + v.r() * 16000;      // standing about
  }

  function paint(v) {
    // ⭐ the frame is the pose: sitting is LOCKED (it must not dance on a bench), walking bobs
    // between two, standing is the front pose. Same grammar the residents use.
    // ⚠️ 4 IS THE LEFT-FACING PAIR, taken from the walking line right above rather than from F_LEFT: the
    // engine's own `face` labels are inverted and these two code paths disagree about it, so the one that is
    // visually proven every time a banana walks left is the one to copy. Every rope mark is LEFT of the
    // serving window (marks 1554-1752, window 1806-1852), so the counter is on a waiting banana's right and
    // facing left is facing away from it.
    const queued = v.job === 'queue' && !v.sitting && !v.path.length;
    const f = v.sitting ? v.frame : v.path.length
      ? (v.face === 'left' ? 4 : v.face === 'right' ? 0 : 2) + v.bob
      : queued && v.pat === 2 ? 4 + v.bob
      : queued && v.pat === 1 ? 2 + v.bob
      : 2;
    if (f !== v.drawn) {
      v.drawn = f;
      v.g.clearRect(0, 0, 150, 150);
      try { drawMe(v.g, 150, f, v.outfit); } catch (e) {}
    }
    v.el.style.left = pct(v.x, W);
    v.el.style.top = pct(v.y, H);
    v.el.style.zIndex = String(v.sitting && v.seat ? v.seat.z : 100 + Math.round(v.y));
  }

  function tick(now, dt) {
    if (stopped) return;
    // ⭐ THE VISITORS READ THE TOWN. They are traffic, not fixtures (design library §23) — but traffic
    // that ignored the clock and the band, so a blacked-out Curse Night square still had six
    // party-hatted strangers strolling it, and a 2% Abandoned town was as busy as a Thriving one. The
    // town-wide rule is already written for the baked visitors and the travelling stall (Trym, 15 Sep:
    // "aren't the townsbananas supposed to go inside in the night?"); these obey it too now.
    if (nightOut && nightOut()) { for (const v of folk) if (v.job !== 'leave' && v.job !== 'queue') leave(v); }
    else {
      // a band that fell while they were out sends the extra ones home, one at a time
      const cap = capNow();
      if (folk.length > cap) { const v = folk.find((q) => q.job !== 'leave' && q.job !== 'queue'); if (v) leave(v); }
      if (now > nextAt) { nextAt = now + GAP[0] + Math.random() * (GAP[1] - GAP[0]); spawn(now); }
    }
    for (let i = folk.length - 1; i >= 0; i--) {
      const v = folk[i];
      step(v, dt, now);
      if (v.gone) { folk.splice(i, 1); continue; }
      if (!v.el.hidden) paint(v);
    }
    void inside;
  }

  return {
    tick,
    stop() { stopped = true; folk.forEach(kill); folk.length = 0; },
    // 🪑 the café's queue asks for these: a visitor already in town who can be sent to the rope
    idle: () => folk.filter((v) => !v.gone && !v.sitting && v.job !== 'leave' && !v.el.hidden),
    take(v, to, onArrive) { if (v.seat) { v.seat.taken = false; v.seat = null; } v.job = 'queue'; v.until = 0; v.sitting = false; v.arrived = onArrive || null; v.path = []; go(v, to); },
    // the counter is done with them: back to their own day, or out of town
    release(v, sit) { if (!v || v.gone) return; v.arrived = null; v.job = ''; v.until = 0; if (sit) errand(v, performance.now()); else leave(v); },
    // ☕ AND THEY LEAVE WITH THE CUP (Trym, 20 Sep: "all customer-bananas that get a coffee should leave
    // with the coffee cup / coffee mug wearable that we have"). It is the only thing on screen that says a
    // coffee was made — the tray's own toast is gone in four seconds and the terrace is across the square.
    // ⚠️ paint() caches on the FRAME NUMBER alone, so changing an outfit mid-life does not redraw until the
    // pose happens to change: a served banana whose errand lands where it already stands keeps frame 2 and
    // would never show the cup. Clearing `drawn` and painting in the same breath is what makes it appear.
    hand(v, id) {
      if (!v || v.gone || !id) return;
      (v.outfit.extras || (v.outfit.extras = {}))[id] = true;
      v.drawn = -1;
      if (v.el && !v.el.hidden) paint(v);
    },
    // ⭐ PATIENCE IS THE BODY, AND ONLY THE BODY. It was the colour of the ellipse they stand on — green,
    // amber, red — and Trym's verdict on that was flat: "the shadow color underneath the banana isn't very
    // pedagogic, i don't understand what it means so i don't think that's something we should use for
    // anything visually." He is right: a tinted shadow is a HUD reading painted on the floor, and nothing
    // else in this world speaks that language. So they act it instead, which is what the plan said all
    // along ("the customer's body does the acting"): they start still, they shift their weight, and at the
    // end they turn their back on the counter. No bubble ever goes over one of these (the Quiet Rule) —
    // they have no name and nothing to say. `tw-wait` stays as the handle a walk selects on; it carries no
    // colour any more.
    patience(v, k) { if (!v || !v.el) return; v.pat = k; v.el.classList.toggle('tw-wait', k != null); },
    seam: {
      count: () => folk.length,
      folk: () => folk.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y), job: v.job, sitting: !!v.sitting, frame: v.drawn, hat: v.outfit.hat, hidden: !!v.el.hidden, pat: v.pat == null ? null : v.pat, held: Object.keys(v.outfit.extras || {}).filter((k) => v.outfit.extras[k]) })),
      gates: () => GATES.map((g) => ({ at: { ...g.at }, on: { ...g.on } })),
      benches: () => BENCHES.map((b) => ({ key: b.key, x: b.x, y: b.y, z: b.z, taken: b.taken })),
      // 🪑 SIT SOMEBODY DOWN NOW. A bench is a one-in-three roll on an errand that takes half a
      // minute to walk, so proving a sitter draws OVER its bench meant standing in the square hoping.
      // This puts a visitor on a named bench in one call — same seat, same frames, same z the ordinary
      // path uses, so what the walk photographs is the real thing and not a staged copy.
      seat(i, key, dy) {
        const v = folk[i | 0], b = BENCHES.find((x) => x.key === key) || BENCHES[0];
        if (!v || !b) return null;
        if (v.seat) v.seat.taken = false;
        b.taken = true; v.seat = b; v.job = 'sit'; v.path = [];
        // ⚠️ `dy` IS FOR THE EYE AND NOTHING ELSE. How far a sitter drops onto a bench is a judgement
        // nobody can make from a number, so the walk can nudge it and take a picture at each value. The
        // shipped drop lives in BENCHES; this only ever shifts the copy on screen while it is being looked at.
        v.x = b.x; v.y = b.y + (dy || 0);
        arrive(v, performance.now());
        paint(v);
        return { key: b.key, x: b.x, y: v.y, z: +v.el.style.zIndex };
      },
      // the walk cannot stand in the square for twenty minutes waiting for a crowd
      fill: (n, now) => { for (let i = 0; i < (n || MAX); i++) spawn(now || performance.now()); return folk.length; },
      routeTo: (x, y) => route({ x: 1100, y: 1230 }, { x, y }).length,
      max: () => MAX,
      // ⚠️ every time route() gave up and drew a straight line. It must be 0: a stray is a banana
      // walking through a flower bed, and the street graph being disconnected is how it happens.
      strays: () => strays,
      cap: () => capNow(),
      dump: () => folk.map((v) => ({ job: v.job, path: v.path.length, until: Math.round(v.until || 0), x: Math.round(v.x), y: Math.round(v.y), hid: !!(v.el && v.el.hidden) })),
      links: () => LINKS.map((l, i) => ({ i, to: l.map((k) => k.to) })),
      lanes: () => LANES.map((r) => r.slice()),
      nearLane,
    },
  };
}
