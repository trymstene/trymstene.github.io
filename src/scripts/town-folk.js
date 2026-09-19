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
import { STREETS, SPOTS, SEATS } from './town-geo.js';

const F_LEFT = 0, F_RIGHT = 4;      // the side-facing crouch the beach sits its bananas on
const WALK = 96;                    // px a second — a stroll, slower than the player's 168
const MAX = 6;                      // ⭐ Trym: "a max of 6-8 roaming bananas … at the same time"
const GAP = [7000, 19000];          // how long between arrivals, before the cap bites

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
const LINKS = STREETS.map(() => []);
for (let i = 0; i < STREETS.length; i++) {
  for (let j = i + 1; j < STREETS.length; j++) {
    const o = overlap(STREETS[i], STREETS[j]);
    if (o) { LINKS[i].push({ to: j, at: o }); LINKS[j].push({ to: i, at: o }); }
  }
}
// the street a point is on, or the nearest one to it
function streetAt(x, y) {
  for (let i = 0; i < STREETS.length; i++) if (inRect(STREETS[i], x, y)) return i;
  let best = 0, d = Infinity;
  STREETS.forEach((r, i) => { const m = mid(r), k = Math.hypot(m.x - x, m.y - y); if (k < d) { d = k; best = i; } });
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
const HELD = ['balloons', 'balloondog', 'mug', 'boombox', 'lemonjug', 'broom', 'letter', 'potato',
  'cactuspot', 'rubberchicken', 'bigfish', 'vinyl', 'trophy', 'oldcane'];
const GLASSES = ['shades', 'nerd', 'potter', 'threed', 'monocle'];

export function bootTownFolk(ctx) {
  const { world, W, H, pct, PROPS, drawMe, inside } = ctx;
  const folk = [];
  let nextAt = 0, seedN = 0, stopped = false;

  // ⚠️ THE SEATS ARE DECLARED AT THE PROP, never guessed from the key. Scanning PROPS for `bench*`
  // sat a banana on the square's Flowers_Bench planters — keyed benchh0/h1 and not a seat at all —
  // where it vanished behind the petals with only a nightcap showing. The builder is the only place
  // that knows which bench is a bench, and which way its sitter should look.
  // ⚠️ AND THE SEAT IS BEHIND THE BENCH'S FOOT. Everything outdoors sorts by its own y, so a sitter
  // at base + 6 paints IN FRONT of the bench and reads as standing beside it with its feet dangling.
  // Two pixels the other side and the bench's front slats draw over its legs — which is what sitting
  // on a bench looks like, and the same trick the café's window uses on a bigger scale.
  const BENCHES = (SEATS || []).map(([key, x, base, face]) => ({ key, x, y: base - 2, face, taken: false }));
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
    if (folk.length >= MAX) return;
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
      const s = SPOTS[pick(v.r, ['exchange', 'wheel', 'board', 'cart', 'info', 'monument', 'terrace'])] || SPOTS.board;
      go(v, { x: s.x + (v.r() - 0.5) * 90, y: s.y + 30 }, head);
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
    v.until = now + 6000 + v.r() * 16000;      // standing about
  }

  function paint(v) {
    // ⭐ the frame is the pose: sitting is LOCKED (it must not dance on a bench), walking bobs
    // between two, standing is the front pose. Same grammar the residents use.
    const f = v.sitting ? v.frame : v.path.length
      ? (v.face === 'left' ? 4 : v.face === 'right' ? 0 : 2) + v.bob
      : 2;
    if (f !== v.drawn) {
      v.drawn = f;
      v.g.clearRect(0, 0, 150, 150);
      try { drawMe(v.g, 150, f, v.outfit); } catch (e) {}
    }
    v.el.style.left = pct(v.x, W);
    v.el.style.top = pct(v.y, H);
    v.el.style.zIndex = String(100 + Math.round(v.y));
  }

  function tick(now, dt) {
    if (stopped) return;
    if (now > nextAt) { nextAt = now + GAP[0] + Math.random() * (GAP[1] - GAP[0]); spawn(now); }
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
    take(v, to) { if (v.seat) { v.seat.taken = false; v.seat = null; } v.job = 'queue'; v.until = 0; v.sitting = false; go(v, to); },
    seam: {
      count: () => folk.length,
      folk: () => folk.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y), job: v.job, sitting: !!v.sitting, frame: v.drawn, hat: v.outfit.hat, hidden: !!v.el.hidden })),
      gates: () => GATES.map((g) => ({ at: { ...g.at }, on: { ...g.on } })),
      benches: () => BENCHES.map((b) => ({ key: b.key, x: b.x, y: b.y, taken: b.taken })),
      // the walk cannot stand in the square for twenty minutes waiting for a crowd
      fill: (n, now) => { for (let i = 0; i < (n || MAX); i++) spawn(now || performance.now()); return folk.length; },
      routeTo: (x, y) => route({ x: 1100, y: 1230 }, { x, y }).length,
      max: () => MAX,
      // ⚠️ every time route() gave up and drew a straight line. It must be 0: a stray is a banana
      // walking through a flower bed, and the street graph being disconnected is how it happens.
      strays: () => strays,
      links: () => LINKS.map((l, i) => ({ i, to: l.map((k) => k.to) })),
    },
  };
}
