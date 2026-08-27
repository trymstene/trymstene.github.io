// 🐦🔭 THE PARK'S BIRDS — the birdhouse residents, the WILD visitors, and the
// birdwatching loop that hangs off both. Wired through the shared ctx (P5).
//
// ART: the Garden Birds pack, ONE 4×4 sheet per species (16px frames at ×2).
// ⭐ verified rows — 0 FLY (4-frame flap) · 1 TAKEOFF (spare) · 2 PECK (the
// sit/forage idle) · 3 WALK. EVERY FRAME FACES LEFT, so the sprite flips
// (scaleX(-1)) whenever a bird moves RIGHT — walking or flying.
//
// WHO IS OUT: park health is the bird feeder. The wild roster is seeded per
// 10-MINUTE WINDOW from (window · health band · rarity ceiling), the coin-
// window pattern — so everyone in the park sees the SAME species at the same
// time and "the hummingbird is here right now" is a shared moment (positions
// and wander stay per-client). Each STOCKED birdhouse adds its own 2-3
// residents on top and nudges the rarity ceiling: the payoff for stocking.
import { seedRand } from '../lib/world.js';
import { passStat, passGet } from '../lib/banana-pass.js';
import { track, PARK_TEST } from './park-util.js';
import { BIRD_SPOTS, BIRD_SPECIES, PLAZA, BOUND, OVERLAYS, TREE_OVS } from './park-geo.js';

// 🔭 THE FOUR TIERS — the whole birdwatching payout. rep on the FIRST spot of
// a species each day; the tier also caps who can show up at all.
const TIERS = [
  { id: 'common', rep: 1, label: 'common' },
  { id: 'uncommon', rep: 2, label: 'uncommon' },
  { id: 'rare', rep: 4, label: 'rare' },
  { id: 'legend', rep: 8, label: 'very rare' },
];
const TIER_OF = {
  'house-finch': 0, chickadee: 0, 'red-robin': 0, crow: 0,
  'blue-jay': 1, magpie: 1, 'wood-thrush': 1, 'cedar-waxwing': 1,
  cardinal: 2, 'stellers-jay': 2, 'white-dove': 2,
  hummingbird: 3,
};
export const BIRD_NAMES = {
  'blue-jay': 'blue jay', cardinal: 'cardinal', 'cedar-waxwing': 'cedar waxwing',
  chickadee: 'chickadee', crow: 'crow', 'house-finch': 'house finch',
  hummingbird: 'hummingbird', magpie: 'magpie', 'red-robin': 'red robin',
  'stellers-jay': 'steller’s jay', 'white-dove': 'white dove', 'wood-thrush': 'wood thrush',
};
const BY_TIER = [0, 1, 2, 3].map((t) => BIRD_SPECIES.filter((s) => TIER_OF[s] === t));

// 🌸 HEALTH GATES THE SKY: how many wild birds are about (per band) and how
// rare they may get. Within the ceiling, rarer stays rarer (TIER_W).
const WILD_N = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 6]];
const WILD_CEIL = [0, 0, 1, 2, 3];
const TIER_W = [1, 0.45, 0.16, 0.05];
const WILD_WIN = 600000;              // 10 min — the shared roster window
const SPECIES_EVERY = 5;              // …but WHO visits only changes every 5 (≈50 min)
const WILD_SALT = 0x8bfa;

const PER_HOUSE = (spot) => 2 + (spot % 2);   // 2-3 residents, stable per post
const HOUSE_ROAM = 520;               // how far a resident ranges from its post
const WILD_ROAM = 700;
const FLY_SPD = 215, WALK_SPD = 30;
const HOP = [26, 92];                 // one walking leg
const HOME_EVERY = [40000, 90000];    // the feeding beat: back to your house
const PERCH_FOR = [3500, 8000];
const PERCH_ALT = 64;                 // roof height (the house art is 36×72)

// the tree clumps are where wild birds hang about (overlay ground points)
const HAUNTS = PARK_TEST ? [[1330, 900], [1180, 820]]
  : TREE_OVS.map((i) => [OVERLAYS[i][1] + OVERLAYS[i][3] / 2, OVERLAYS[i][5]]);

const DAY_KEY = 'pk_birds_day';
const dayStamp = () => new Date().toISOString().slice(0, 10);
// today's sightings — read by the day panel and the postcard
export function birdsToday() {
  try {
    const j = JSON.parse(localStorage.getItem(DAY_KEY) || '{}');
    return j && j.date === dayStamp() && Array.isArray(j.species) ? j.species.slice() : [];
  } catch (e) { return []; }
}
function addToday(sp) {
  const list = birdsToday();
  if (list.indexOf(sp) >= 0) return false;
  list.push(sp);
  try { localStorage.setItem(DAY_KEY, JSON.stringify({ date: dayStamp(), species: list })); } catch (e) {}
  return true;
}

const rnd = (r) => r[0] + Math.random() * (r[1] - r[0]);
function pickTier(r, ceil) {
  let sum = 0;
  for (let t = 0; t <= ceil; t++) sum += TIER_W[t];
  let acc = 0;
  for (let t = 0; t <= ceil; t++) { acc += TIER_W[t] / sum; if (r < acc) return t; }
  return 0;
}
// the SHARED roster: same window + same band + same ceiling → same species.
// ⚠️ BIRDS FLOCK (Trym, 30 Jul: "ive spotted 7 birds in 2 minutes… have more
// of the same species show up instead of so many different birds at once, so
// discovering new birds gets more exciting"). One window = ONE flock species
// filling most slots; only sometimes does a single stray of another species
// tag along — and a rarity above common always arrives ALONE, so a cardinal
// or the hummingbird is an event, not one of five simultaneous firsts.
function rosterFor(win, band, ceil) {
  const [lo, hi] = WILD_N[band];
  const n = lo + Math.floor(seedRand(WILD_SALT + win * 31 + band * 7 + ceil) * (hi - lo + 1));
  if (!n) return [];
  // the flock's SPECIES changes far slower than its size: a species holds the
  // park for ~45 min (4-5 count windows) so birds come and go while WHO is
  // visiting stays put — that's what makes a new face feel like news
  const sWin = Math.floor(win / SPECIES_EVERY);
  const flockT = pickTier(seedRand(WILD_SALT + sWin * 131 + ceil * 13), ceil);
  const fPool = BY_TIER[flockT].length ? BY_TIER[flockT] : BY_TIER[0];
  const flock = fPool[Math.floor(seedRand(WILD_SALT + sWin * 17 + flockT * 61) * fPool.length)];
  if (flockT > 0) return [flock];              // anything rarer travels alone
  const out = new Array(n).fill(flock);
  // ~35% of windows: one stray of another species keeps the lawn from
  // looking cloned — same tier, so it stays a common companion
  if (n > 1 && seedRand(WILD_SALT + sWin * 401 + band) < 0.35) {
    const alt = fPool[Math.floor(seedRand(WILD_SALT + sWin * 733) * fPool.length)];
    if (alt !== flock) out[n - 1] = alt;
  }
  return out;
}

export function initBirds(ctx) {
  const { W, H, world, pct, depth, blocked, float, toast, pos, refreshHud, place, hideEl } = ctx;

  const inPlaza = (x, y) => {
    const ex = (x - PLAZA.x) / PLAZA.rx, ey = (y - PLAZA.y) / PLAZA.ry;
    return ex * ex + ey * ey < 1;
  };
  // birds may cross roads — they may NOT land in the pond, the fountain basin
  // or off the world edge (blocked() already owns the pond + the props)
  const landOk = (x, y) => x > BOUND + 24 && x < W - BOUND - 24 && y > BOUND + 24
    && y < H - BOUND - 24 && !blocked(x, y) && !inPlaza(x, y);
  function nearSpot(cx, cy, rMin, rMax) {
    for (let t = 0; t < 22; t++) {
      const a = Math.random() * Math.PI * 2;
      const r = rMin + Math.random() * (rMax - rMin);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.72;
      if (landOk(x, y)) return { x, y };
    }
    return null;
  }

  const birds = [];
  function anim(b, cls) {
    if (b.anim === cls) return;
    b.anim = cls;
    b.el.className = 'pk-gbird ' + cls;
  }
  function makeBird(sp, o) {
    const el = document.createElement('div');
    el.className = 'pk-gbird is-fly';
    el.style.backgroundImage = "url('/assets/park/bird-" + sp + ".png')";
    world.appendChild(el);
    const sh = document.createElement('i');
    sh.className = 'pk-gbshad';
    sh.noCull = true;           // shown only while airborne — its own display
    sh.style.display = 'none';
    world.appendChild(sh);
    const b = {
      el, sh, sp, anim: 'is-fly', tier: TIER_OF[sp] || 0, hover: sp === 'hummingbird',
      spot: o.spot, k: o.k || 0, n: o.n || 1, hx: o.hx, hy: o.hy, roam: o.roam,
      x: o.hx, y: o.hy, alt: 0, state: 'sit', wait: 1, right: false, goHome: false,
      fx: 0, fy: 0, fa: 0, tx: o.hx, ty: o.hy, ta: 0, ft: 0, fdur: 1, peak: 0,
      nextHome: 0, wx: NaN, wy: NaN, wr: null, shOn: false, sx: NaN, sy: NaN,
    };
    birds.push(b);
    return b;
  }
  function despawn(b) {
    b.el.remove();
    b.sh.remove();
    const i = birds.indexOf(b);
    if (i >= 0) birds.splice(i, 1);
  }

  function flyTo(b, x, y, alt, mul) {
    b.fx = b.x; b.fy = b.y; b.fa = b.alt;
    b.tx = x; b.ty = y; b.ta = alt || 0;
    const d = Math.hypot(x - b.x, y - b.y);
    b.fdur = Math.max(0.3, d / (FLY_SPD * (mul || 1) * (b.hover ? 1.7 : 1)));
    b.ft = 0;
    b.peak = Math.max(16, Math.min(76, d * 0.16));
    b.right = x > b.x;
    b.state = 'fly';
    anim(b, 'is-fly');
  }
  function wander(b) {
    const s = nearSpot(b.hx, b.hy, 60, b.roam) || { x: b.hx, y: b.hy };
    flyTo(b, s.x, s.y, b.hover ? 40 + Math.random() * 30 : 0);
  }
  function goHome(b) {
    // gathered at the feeder, not stacked on it: the middle bird takes the
    // roof peak, the others sit lower off each shoulder (the house is 36×72)
    const [sx, sy] = BIRD_SPOTS[b.spot];
    const mid = (b.n - 1) / 2;
    b.goHome = true;
    flyTo(b, sx + (b.k - mid) * 31, sy, PERCH_ALT + (b.k === Math.round(mid) ? 12 : -8));
  }
  function decide(b, now) {
    if (b.spot != null && now > b.nextHome) { goHome(b); return; }
    if (b.hover) { wander(b); return; }        // hummingbirds don't do lawns
    if (b.alt > 5) { wander(b); return; }      // off the roof: never walk on air
    const r = Math.random();
    if (r < 0.5) {
      const s = nearSpot(b.x, b.y, HOP[0], HOP[1]);
      if (s) { b.tx = s.x; b.ty = s.y; b.right = s.x > b.x; b.state = 'walk'; anim(b, 'is-walk'); return; }
    }
    if (r < 0.86) { wander(b); return; }
    b.state = 'sit';
    b.wait = 1.6 + Math.random() * 4;
    anim(b, 'is-sit');
  }
  function arrive(b, now) {
    b.x = b.tx; b.y = b.ty; b.alt = b.ta;
    if (b.goHome) {                            // the feeding beat, up on the house
      b.goHome = false;
      b.state = 'perch';
      b.wait = rnd(PERCH_FOR) / 1000;
      anim(b, 'is-sit');
      return;
    }
    if (b.hover && Math.random() > 0.18) {     // rarely lands
      b.state = 'hover';
      b.wait = 0.9 + Math.random() * 1.6;
      anim(b, 'is-fly');
      return;
    }
    b.alt = 0;
    b.state = 'sit';
    b.wait = 1.4 + Math.random() * 3.6;
    anim(b, 'is-sit');
  }
  function leaveFor(b, mul) {                  // a departure, not a vanish
    const ex = b.x < W / 2 ? -280 : W + 280;
    b.goHome = false;
    flyTo(b, ex, b.y - 180 - Math.random() * 220, 150, mul || 1.25);
    b.state = 'leave';
  }
  function flyIn(b, tx, ty) {                  // …and an arrival, not a pop
    const a = Math.random() * Math.PI * 2;
    b.x = tx + Math.cos(a) * (860 + Math.random() * 320);
    b.y = ty + Math.sin(a) * 560 - 240;
    b.alt = 150;
    flyTo(b, tx, ty, 0, 0.95);
  }

  function paint(b, now) {
    const air = b.alt > 5;
    const bob = (b.state === 'fly' || b.state === 'leave' || b.state === 'hover')
      ? Math.sin(now / 130 + b.k) * 2 : 0;
    const ay = b.y - b.alt + bob;
    if (b.wx !== b.x || b.wy !== ay || b.wr !== b.right) {
      b.wx = b.x; b.wy = ay; b.wr = b.right;
      place(b.el, b.x, ay, ' translate(-50%,-100%)' + (b.right ? ' scaleX(-1)' : ''));
      b.el.style.zIndex = air ? '1560' : String(100 + Math.round(b.y));
    }
    // an indoor bird's shadow goes indoors with it — it used to keep gliding
    // across the grass with no bird above it
    const on = !b.indoors && (b.state === 'fly' || b.state === 'leave');
    if (on !== b.shOn) { b.shOn = on; b.sh.style.display = on ? '' : 'none'; }
    if (on) {
      // …and its own change-guard, which it never had
      if (b.sx !== b.x || b.sy !== b.y) {
        b.sx = b.x; b.sy = b.y;
        place(b.sh, b.x, b.y, ' translate(-50%,-50%)');
        depth(b.sh, b.y);
      }
      b.sh.style.opacity = String(Math.max(0.07, 0.3 - b.alt / 340));
    }
  }
  function stepBird(b, dt, now) {
    if (b.state === 'fly' || b.state === 'leave') {
      b.ft += dt;
      const u = Math.min(1, b.ft / b.fdur);
      b.x = b.fx + (b.tx - b.fx) * u;
      b.y = b.fy + (b.ty - b.fy) * u;
      b.alt = b.fa + (b.ta - b.fa) * u + Math.sin(Math.PI * u) * b.peak;
      if (u >= 1) {
        if (b.state === 'leave') { despawn(b); return; }
        arrive(b, now);
      }
    } else if (b.state === 'walk') {
      const dx = b.tx - b.x, dy = b.ty - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) { b.state = 'sit'; b.wait = 1.2 + Math.random() * 3.2; anim(b, 'is-sit'); }
      else {
        const m = Math.min(d, WALK_SPD * dt);
        const nx = b.x + (dx / d) * m, ny = b.y + (dy / d) * m;
        if (landOk(nx, ny)) { b.x = nx; b.y = ny; if (Math.abs(dx) > 3) b.right = dx > 0; }
        else { b.state = 'sit'; b.wait = 0.8; anim(b, 'is-sit'); }
      }
    } else {
      b.wait -= dt;
      if (b.state === 'hover') b.alt = b.ta + Math.sin(now / 180 + b.k) * 4;
      if (b.wait <= 0) {
        if (b.state === 'perch') b.nextHome = now + rnd(HOME_EVERY);
        decide(b, now);
      }
    }
    paint(b, now);
  }

  // ---- 🏠 the residents: 2-3 per STOCKED house, spread around the post -----
  let stockedN = 0;
  const stocked = BIRD_SPOTS.map(() => false);
  function houseSeats(i, n) {
    const [sx, sy] = BIRD_SPOTS[i];
    const base = Math.random() * Math.PI * 2;
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = base + k * (Math.PI * 2 / n) + (Math.random() - 0.5) * 0.7;
      let p = null;
      for (let t = 0; t < 10 && !p; t++) {
        const r = 84 + Math.random() * 86 + t * 12;
        const x = sx + Math.cos(a) * r, y = sy + Math.sin(a) * r * 0.7 + 22;
        if (landOk(x, y)) p = { x, y };
      }
      out.push(p || { x: sx + (k - 1) * 48, y: sy + 36 });
    }
    return out;
  }
  function moveIn(i, now) {
    const n = PER_HOUSE(i);
    const seats = houseSeats(i, n);
    const day = Math.floor(Date.now() / 86400000);
    // ⚠️ ONE FAMILY PER HOUSE (Trym, 30 Jul — mixed residents handed out four
    // new species the moment you walked in): every resident of a house is the
    // SAME species for the whole day. Four houses = at most four faces, and a
    // house becomes "the chickadees' place" until tomorrow.
    const houseSp = BIRD_SPECIES[Math.floor(seedRand(0x5eed + day * 97 + i * 31) * BIRD_SPECIES.length)];
    for (let k = 0; k < n; k++) {
      const sp = houseSp;
      const b = makeBird(sp, { spot: i, k, n, hx: seats[k].x, hy: seats[k].y, roam: HOUSE_ROAM });
      b.nextHome = now + rnd(HOME_EVERY);
      flyIn(b, seats[k].x, seats[k].y);
      b.ft = -k * 0.55;                 // staggered arrivals, not a formation
      if (wxIndoors) setIndoors(b, true);   // a house stocked mid-downpour
    }
  }
  function setStocked(flags) {
    const now = performance.now();
    stockedN = flags.filter(Boolean).length;
    flags.forEach((on, i) => {
      if (on === stocked[i]) return;
      stocked[i] = on;
      if (on) moveIn(i, now);
      else birds.filter((b) => b.spot === i && b.state !== 'leave').forEach((b) => leaveFor(b));
    });
  }

  // ---- 🌿 the wild roster — shared by everyone in the park -----------------
  let band = -1, wildKey = '';
  function spawnWild(sp) {
    const h = HAUNTS[Math.floor(Math.random() * HAUNTS.length)];
    const p = nearSpot(h[0], h[1], 60, 230);
    if (!p) return;
    const b = makeBird(sp, { spot: null, k: birds.length % 5, n: 1, hx: p.x, hy: p.y, roam: WILD_ROAM });
    flyIn(b, p.x, p.y);
  }
  // 🌦 how much of the roster the weather leaves in the sky. Rides the sync
  // KEY, so the machinery that already handles a roster change does all the
  // work: birds off the new list fly off properly, returns fly back in.
  let wxCut = 1, wxIndoors = false;
  // ⚠️ through the chassis, never el.style.display: the cull sweep owns that
  // property on these same elements and used to walk indoor birds back out
  // into the rain the moment their house scrolled into view. The shadow is
  // noCull (paint() owns it), so it reads b.indoors instead.
  function setIndoors(b, on) {
    b.indoors = on;
    hideEl(b.el, on);
  }
  function setWeather(k) {
    // 🏠 the HOUSES go quiet too (Trym: "empty around birdhouses in heavy
    // rain"). Residents are not roster-managed — they belong to their post —
    // so they are simply indoors until it passes. In a real storm the server
    // destroys the houses anyway and the next poll removes them for good.
    wxIndoors = k === 'heavy' || k === 'storm';
    birds.forEach((b2) => { if (b2.spot != null) setIndoors(b2, wxIndoors); });
    const cut = k === 'storm' ? 0 : k === 'heavy' ? 0.15 : k === 'drizzle' ? 0.7 : 1;
    if (cut === wxCut) return;
    wxCut = cut;
    wildKey = '';                              // force the next sync to re-cast
    wildSync();
  }
  function wildSync() {
    if (band < 0) return;                      // no word on park health yet
    const win = Math.floor(Date.now() / WILD_WIN);
    // a stocked house pulls the ceiling up a notch (two houses, two notches)
    const ceil = Math.min(3, WILD_CEIL[band] + Math.min(2, stockedN));
    const key = win + ':' + band + ':' + ceil + ':' + wxCut;
    if (key === wildKey) return;
    wildKey = key;
    const want = rosterFor(win, band, ceil).slice(0, Math.round(rosterFor(win, band, ceil).length * wxCut));
    const pool = birds.filter((b) => b.spot == null && !b.qa && b.state !== 'leave');
    const need = [];
    want.forEach((s) => {                      // a species still on the roster STAYS
      const i = pool.findIndex((b) => b.sp === s);
      if (i >= 0) pool.splice(i, 1);
      else need.push(s);
    });
    pool.forEach((b) => leaveFor(b));          // off the roster → it flies off
    need.forEach((s) => spawnWild(s));
  }
  const setBloom = (v) => {
    const b2 = Math.max(0, Math.min(4, Math.floor(v / 20)));
    if (b2 !== band) { band = b2; wildKey = ''; }
  };

  // ---- 🔭 SPOTTING — tap a bird, it startles, the day list grows -----------
  let birdTracked = false;
  function startle(b) {
    const ang = Math.atan2(b.y - pos.y, b.x - pos.x) + (Math.random() - 0.5) * 0.9;
    const s = nearSpot(b.x + Math.cos(ang) * 320, b.y + Math.sin(ang) * 200, 0, 150)
      || { x: b.hx, y: b.hy };
    b.goHome = false;
    flyTo(b, s.x, s.y, b.hover ? 50 : 0, 1.6);
    b.nextHome = performance.now() + 30000;
  }
  function tapBird(wx, wy) {
    // ⚠️ TIGHT TO THE SPRITE (the Shelly rule from the bay): birds run FIRST in
    // the tap chain and wander the lawn — at 46 units a bird drifting near a
    // bed ate the tap meant for the PLANT behind it, and because birds move it
    // felt like the plant card randomly refusing to open. A bird is ~20px; 28
    // still catches a deliberate tap on the bird itself.
    let best = null, bd = 28;
    for (const b of birds) {
      if (b.state === 'leave') continue;
      const d = Math.hypot(wx - b.x, wy - (b.y - b.alt - 16));
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return false;
    const name = BIRD_NAMES[best.sp] || best.sp;
    const t = TIERS[best.tier];
    if (addToday(best.sp)) {
      passStat('rep', t.rep);
      if (!((passGet().stats || {})['bird_' + best.sp])) passStat('bird_' + best.sp, 1);
      refreshHud();
      float(best.x, best.y - best.alt - 40, '+' + t.rep);
      toast('🔭 spotted! a ' + name + ' — ' + t.label, 3600);
      if (!birdTracked) { birdTracked = true; track('park_bird', { species: best.sp, tier: t.id }); }
    } else {
      toast('🔭 a ' + name + ' — already on today’s list');
    }
    startle(best);
    return true;
  }

  function birdTick(dt, now) {
    wildSync();
    for (let i = birds.length - 1; i >= 0; i--) stepBird(birds[i], dt, now);
  }

  return {
    birdTick, tapBird, setStocked, setBloom, setWeather,
    qa: {
      birds,
      // 🐦 bird QA: read the shared roster, or drop a species at your feet
      roster: () => birds.map((b) => b.sp + (b.spot == null ? ' (wild)' : ' (house ' + b.spot + ')')),
      wild: (sp) => {
        const s = sp || BIRD_SPECIES[Math.floor(Math.random() * BIRD_SPECIES.length)];
        const p = nearSpot(pos.x, pos.y, 90, 260) || { x: pos.x + 90, y: pos.y };
        const b = makeBird(s, { spot: null, k: 0, n: 1, hx: p.x, hy: p.y, roam: WILD_ROAM });
        b.qa = true;              // exempt from the roster sweep, so it stays
        flyIn(b, p.x, p.y);
        return s;
      },
      // 🔭 wipe today's sightings (the panel + postcard follow next tick)
      unspot: () => { try { localStorage.removeItem(DAY_KEY); } catch (e) {} },
    },
  };
}
