// 🏡 THE HOMESTEAD — your own clearing west of the park (task #106, M0).
//
// The world's first PERSONAL space: claim the plot, name it, buy decor at the
// mailbox, place it anywhere on your lawn (three verbs: place / move / put
// away), pitch the tent, grow the bed. M0 state is device-local (hs-v1);
// the YardRoom DO + slugs arrive with visiting (M1) — the shape below is
// already the DO's document so nothing migrates.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { passStat, buffGet, buffSet, seedCount, seedUse } from '../lib/banana-pass.js';
import { catCustom, loadCatalog } from '../lib/drops.js';
import { wearToCustom } from '../lib/wear-render.js';
import { mountHud, coinBalance } from '../lib/world-hud.js';
import { initTravel } from './world-travel.js';
import { askName } from '../lib/banana-id.js';
import { worldOwner, worldSid } from '../lib/world.js';
import { WORLD, BOUND, ROAD, GATE, SPAWN, FENCE_TIERS, TENT, STRUCTS, STRUCT_STYLES,
  MAILBOX, SIGN, OB_RECTS, OVERLAYS, BIRDS, INTERIORS } from './homestead-geo.js';
import { DECOR } from '../data/decor.js';

const view = document.getElementById('hsView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// 🪙 prices wear the REAL bananacoin, never the stock emoji (Trym)
const COIN = '<img class="hs-coin" src="/assets/homestead/coin16.png" width="14" height="14" alt="bananacoins">';

// 🏡 THE NEIGHBOURHOOD (M1): every claimed yard has a public mirror in the
// YardRoom DO. worldOwner() owns it; the browser's hs-v1 stays the truth.
const YARD_API = 'https://banana-rave.trymstene.workers.dev/yards';
async function yFetch(path, body) {
  const r = await fetch(YARD_API + path, body ? {
    method: 'POST',
    body: JSON.stringify({ ...body, pass: worldOwner(), alt: worldSid() }),
  } : undefined);
  if (!r.ok) throw new Error('yard ' + r.status);
  return r.json();
}
// ?yard=trym today; /homestead/trym/ the day the apex goes orange-cloud
const VISIT_SLUG = (() => {
  try {
    const q = new URLSearchParams(location.search).get('yard');
    if (q) return q.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    const m = location.pathname.match(/^\/homestead\/([a-z0-9-]{1,40})\/?$/);
    return m ? m[1] : '';
  } catch (e) { return ''; }
})();

const HS_KEY = 'hs-v1';
// ⚠️ STRESS-TESTED 3 Aug (?hstest=full): 16 items on the 19×10-tile lawn read
// as ~15% furnished — "full" must LOOK like a lived-in yard, so the caps rose.
const CAPS = [12, 28, 42, 56];   // placement spots per stage — each rung adds room
// 🏠 the ladder: every rung is a WARDROBE — pick a style, then place it
const STRUCT_LADDER = [
  { key: 'tent', price: 50, name: 'Pitch a tent', icon: '⛺',
    pitch: 'pick a colour, move in — the whole decor catalog opens up.' },
  { key: 'cabin', price: 250, name: 'Get a real roof', icon: '🛖',
    pitch: 'a mobile home, a barn — your call. The plot grows and the fancier catalog unlocks.' },
  { key: 'house', price: 600, name: 'Build the house', icon: '🏠',
    pitch: 'country, villa, haunted, city — the full homestead, the grandest catalog.' },
];
const STYLE_DEFAULTS = { 1: 'tent1', 2: 'barn', 3: 'country' };
const CROPS = [
  { id: 'tomato', name: 'Tomato', seed: 3 },
  { id: 'pumpkin', name: 'Pumpkin', seed: 3 },
  { id: 'wheat', name: 'Wheat', seed: 3 },
];
const CROP_EMO = { tomato: '🍅', pumpkin: '🎃', wheat: '🌾' };
// 🍳 THE SPINE (M2): crops → the pantry → dishes with WORLD-WIDE effects.
// The multiplier enforces itself inside passStat — one choke point, every area.
const DISHES = [
  { id: 'stew', icon: '🍲', name: 'Campfire stew', need: { tomato: 2, wheat: 1 },
    fx: 'coins2', mins: 45, blurb: 'every bananacoin pays double · 45 min · everywhere' },
  { id: 'pie', icon: '🥧', name: 'Pumpkin pie', need: { pumpkin: 2, wheat: 1 },
    fx: 'rep2', mins: 45, blurb: 'double XP from everything · 45 min · everywhere' },
  { id: 'loaf', icon: '🍞', name: 'Golden loaf', need: { wheat: 3 },
    pay: 25, blurb: 'bakes straight into 25 bananacoins' },
];
const TENT_PRICE = 50;
const dayStr = () => new Date().toISOString().slice(0, 10);

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(HS_KEY) || 'null');
    if (s && s.v === 1) return s;
  } catch (e) {}
  return { v: 1, name: '', claimedAt: 0, stage: 0, items: [], shed: [], soil: [] };
}
function withHome(s) {   // older saves have no home — defaults = old spots
  if (!s.home) s.home = { x: TENT.x, y: TENT.y };
  // 🪏 DIG-YOUR-OWN SOIL (Trym): no given bed, no fixed square — cells are
  // tile coords {i,j}, dug freehand. The old 4-slot bed migrates into cells.
  if (!Array.isArray(s.soil)) {
    s.soil = [];
    if (s.bedAt && Array.isArray(s.bed)) {
      const slots = [[-90, -32], [-20, -32], [50, -32], [120, -32]];
      s.bed.forEach((b, k) => {
        const i = Math.floor((s.bedAt.x + slots[k][0]) / 48);
        const j = Math.floor((s.bedAt.y + slots[k][1]) / 48);
        if (!s.soil.some((c) => c.i === i && c.j === j)) {
          s.soil.push({ i, j, ...(b ? { crop: b.crop, waters: b.waters | 0, last: b.last || '', planted: b.planted || '' } : {}) });
        }
      });
    }
  }
  delete s.bed; delete s.bedAt;
  if (!Array.isArray(s.fence)) s.fence = [];   // 🪵 player-built, cell by cell
  if (!s.mailAt) s.mailAt = { x: MAILBOX.x, y: MAILBOX.y };
  if (!s.signAt) s.signAt = { x: SIGN.x, y: SIGN.y };
  if (!s.style) s.style = {};
  if (!s.pantry) s.pantry = {};
  if (!Array.isArray(s.orders)) s.orders = [];   // deliveries on the way
  if (typeof s.look !== 'string') s.look = '';   // 🎨 worn style (wardrobe)
  return s;
}

// 🧪 ?hstest=<scenario> — jump the homestead to any point of the journey and
// LOOK at it (the park's ?parktest pattern). Overwrites hs-v1 for this device;
// touches no coins, no pass stats. Scenarios:
//   fresh    the very first arrival        claimed  named, stage 0, empty
//   tent     just moved in, a few things   full     stage 1 MAXED: 16/16 spots,
//            every bed slot at a different growth stage, a stuffed shed
function applyTestScenario(kind) {
  const day = new Date().toISOString().slice(0, 10);
  const base = { v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 0,
    items: [], shed: [], bed: [null, null, null, null] };
  let s = null;
  if (kind === 'fresh') { try { localStorage.removeItem(HS_KEY); } catch (e) {} return; }
  if (kind === 'rich') {   // a test wallet: balance jumps to ~9999, state untouched
    try {
      const pv = JSON.parse(localStorage.getItem('pass-v1') || '{}');
      pv.stats = pv.stats || {};
      pv.stats.coins_earned = (pv.stats.coins_spent || 0) + 9999;
      localStorage.setItem('pass-v1', JSON.stringify(pv));
    } catch (e) {}
    return;
  }
  if (kind === 'claimed') s = base;
  // ⚠️ 'tent'/'full' are stage 1 = the TIER-1 yard (x 864-1296, y 494-768,
  // tent at 1000,560, bed at 1010,730) — every position must fit INSIDE it
  if (kind === 'tent') {
    s = { ...base, stage: 1,
      items: [{ id: 'sunflower', x: 900, y: 540 }, { id: 'bench', x: 1150, y: 530 }],
      shed: [{ id: 'lantern' }] };
  }
  if (kind === 'full') {
    const ids = ['sunflower', 'redflower', 'blueflower', 'pinkvase', 'bush', 'bush2',
      'stump', 'mushrooms', 'flowerbush', 'lantern', 'bench', 'table', 'chair',
      'campfire', 'scarecrow', 'bananacrate'];
    const spots = [
      [880, 510], [1075, 510], [1130, 510], [1185, 510], [1240, 510],
      [880, 560], [1080, 562], [1135, 560], [1190, 562], [1245, 560],
      [880, 610], [935, 612], [990, 610], [1045, 612], [1100, 610], [1155, 612], [1210, 610], [1265, 612],
      [1180, 660], [1235, 662], [1180, 712], [1240, 710],
      [880, 762], [940, 760], [1000, 762], [1060, 760], [1120, 762], [1180, 760],
    ];
    s = { ...base, stage: 1, bedAt: { x: 1010, y: 730 },
      items: spots.map(([x, y], i) => ({ id: ids[i % ids.length], x, y })),
      shed: [{ id: 'bush' }, { id: 'stump' }, { id: 'pinkvase' }],
      bed: [
        { crop: 'tomato', waters: 0, last: '', planted: day },
        { crop: 'pumpkin', waters: 1, last: '', planted: day },
        { crop: 'wheat', waters: 2, last: '', planted: day },
        { crop: 'tomato', waters: 3, last: '', planted: day },
      ] };
  }
  if (kind === 'max') {
    // 🏠 THE END STATE: the house, 56/56 spots, every category represented.
    // Positions dodge the house footprint (x 582-938, y up to 434) + the bed.
    const items = [];
    const put2 = (id, x, y) => items.push({ id, x, y });
    // north rows, either side of the house
    ['sunflower', 'redflower', 'blueflower'].forEach((id, i) => put2(id, 400 + i * 56, 330));
    ['whiteflower', 'pinkvase', 'bluevase', 'sunvase', 'whitevase', 'sproutvase'].forEach((id, i) => put2(id, 965 + i * 56, 332));
    // west column
    ['statue', 'bush', 'flowerbush', 'bench', 'mushrooms', 'sprout'].forEach((id, i) => put2(id, 405 + (i % 2) * 62, 400 + Math.floor(i / 2) * 62));
    // east column
    ['statue2', 'coop', 'shelf', 'benchv', 'armchair', 'chair', 'bush2', 'flowerbush2'].forEach((id, i) => put2(id, 990 + (i % 3) * 100, 420 + Math.floor(i / 3) * 78));
    // the front yard, below the house porch
    ['fountain', 'table', 'campfire', 'marshfire', 'lantern', 'lantern2'].forEach((id, i) => put2(id, 590 + i * 62, 495));
    // mid-band accents
    ['bananacrate', 'crate', 'scarecrow', 'stump'].forEach((id, i) => put2(id, 800 + i * 92, 585));
    // the south band, along the fence
    ['bush', 'sunflower', 'chair', 'redflower', 'stump', 'blueflower', 'bush2', 'whiteflower',
      'mushrooms', 'lantern', 'flowerbush', 'pinkvase'].forEach((id, i) => put2(id, 395 + i * 60, 738));
    // fill the remainder to the 56 cap with a mixed hedge row
    const fillers = ['bush', 'bush2', 'flowerbush', 'sunflower', 'redflower', 'blueflower'];
    let fi = 0;
    while (items.length < 56) { put2(fillers[fi % fillers.length], 980 + (fi % 5) * 68, 660 + Math.floor(fi / 5) * 52); fi++; }
    // 'max' predates the land tiers: its layout was placed around the house at
    // (760,430) and the bed at (610,700) — pin those spots explicitly
    const fence = [];
    for (let i = 9; i <= 25; i++) {
      fence.push({ i, j: 7 });
      if (i !== 23 && i !== 24) fence.push({ i, j: 15 });
    }
    for (let j = 8; j <= 14; j++) { fence.push({ i: 9, j }); fence.push({ i: 25, j }); }
    s = { ...base, stage: 3, items, fence,
      home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 },
      shed: [{ id: 'statue' }, { id: 'fountain' }, { id: 'coop' }, { id: 'bananacrate' }],
      bed: [
        { crop: 'tomato', waters: 3, last: '', planted: day },
        { crop: 'pumpkin', waters: 3, last: '', planted: day },
        { crop: 'wheat', waters: 2, last: '', planted: day },
        { crop: 'tomato', waters: 1, last: '', planted: day },
      ] };
  }
  if (s) { try { localStorage.setItem(HS_KEY, JSON.stringify(s)); } catch (e) {} }
}
const HS_TEST = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('hstest');
if (HS_TEST) applyTestScenario(HS_TEST);

// a visitor's "state": the neighbour's public doc wearing the local shape —
// the whole render path (tent/items/bed/sign) reads it unchanged
function visitState(d) {
  return withHome({
    v: 1, name: d.name || 'A Homestead', claimedAt: 1, slug: d.slug,
    stage: d.stage || 0, style: d.style || {}, items: d.items || [], shed: [],
    look: typeof d.look === 'string' ? d.look : '',
    soil: Array.isArray(d.soil) ? d.soil : [],
    fence: Array.isArray(d.fence) ? d.fence : [],
    mailAt: d.mailAt, signAt: d.signAt,
    bed: Array.isArray(d.bed) ? d.bed : undefined, bedAt: d.bedAt,   // old docs migrate in withHome
    home: d.home, guest: d.guest || [], wtoday: !!d.wtoday,
  });
}

function init(visitDoc, visitMiss) {
  const visiting = !!visitDoc;
  const W = WORLD.w, H = WORLD.h;
  const world = document.getElementById('hsWorld');
  const meEl = document.getElementById('hsMe');
  const meCtx = document.getElementById('hsMeCv').getContext('2d');
  const hintEl = document.getElementById('hsHint');
  const exitEl = document.getElementById('hsExitStrip');
  const cutEl = document.getElementById('hsCut');
  const toastEl = document.getElementById('hsToast');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pct = (v, span) => (v / span * 100) + '%';

  const state = visiting ? visitDoc : withHome(loadState());
  {
    // legacy fixup: saves minted before the land tiers may hold spots that
    // now sit OUTSIDE the current fence — those come home to the defaults
    const P = FENCE_TIERS[Math.max(1, Math.min(state.stage, 3))].plot;
    const inP = (p) => p && p.x > P[0] - 60 && p.x < P[2] + 60 && p.y > P[1] - 60 && p.y < P[3] + 60;
    if (!inP(state.home)) state.home = { x: TENT.x, y: TENT.y };
    state.soil = (state.soil || []).filter((c) => inP({ x: c.i * 48 + 24, y: c.j * 48 + 24 }));
  }
  // ⚠️ a visitor's save is a NO-OP twice over: never write their yard into
  // hs-v1, never push their yard to the DO as ours
  const save = visiting ? () => {} : () => {
    try { localStorage.setItem(HS_KEY, JSON.stringify(state)); } catch (e) {}
    pushYard();
  };
  // debounced publish of the public snapshot (the yard the neighbours see)
  let pushT = null;
  function pushYard() {
    if (visiting || !state.claimedAt || !state.slug) return;
    clearTimeout(pushT);
    pushT = setTimeout(() => {
      yFetch('/save', { name: state.name, state: {
        stage: state.stage, style: state.style, look: state.look, home: state.home,
        items: state.items, soil: state.soil, fence: state.fence,
        mailAt: state.mailAt, signAt: state.signAt,
      } }).catch(() => {});
    }, 2500);
  }
  // ⚠️ TDZ: camTarget() reads these and is CALLED at spawn setup, so they
  // must live above the camera section (the rave-floor lesson)
  let placing = null;   // { id, x, y, el, moving }
  let camFree = null;   // the placing camera: PANNED by drags, never chases the ghost
  // 🔨 planner state ALSO lives up here — layout() reads it (the TDZ lesson)
  let digging = false, fencing = false, clearing = false, planner = false, hovEl = null, planEls = null;

  let myName = '';
  try { myName = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}

  let myOutfit = { hat: 'none', glasses: 'none', extras: {} };
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o) myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {}, c: o.c };
  } catch (e) {}
  const ME_DRAW = { ...myOutfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
  loadCatalog().then(() => { try { lastF = -1; drawMe(); } catch (e) {} });

  // ---- camera (the park's, verbatim shape) --------------------------------
  const VIEW_ART_W = 900, VIEW_ART_V = 760, YARD_FIT = 520;   // 520 = the park's own phone cap
  let scale = 1, viewW = 0, viewH = 0, camX = 0, camY = 0;
  function layout() {
    const r = view.getBoundingClientRect();
    viewW = r.width; viewH = r.height;
    const want = Math.max(viewW / VIEW_ART_W, viewH / VIEW_ART_V);
    const fill = Math.max(viewW / W, viewH / H);
    scale = Math.min(1.7, viewW / YARD_FIT, Math.max(0.55, fill, want));
    if (planner) {   // 🔨 build mode: fit the whole deed in view
      const F = FENCE_TIERS[fenceTier()].fence;
      scale = Math.min(1.2, viewW / (F[2] - F[0] + 120), viewH / (F[3] - F[1] + 120));
    }
    world.style.width = (W * scale) + 'px';
    world.style.height = (H * scale) + 'px';
    replaceMovers();
  }
  addEventListener('resize', layout);
  layout();
  function camTarget() {
    // 🪴 while placing the camera is FREE: it glides to the ghost once at the
    // start, then only DRAGS move it — a moving object must never yank the
    // view around (Trym: "alot of camera jumping"). Tap = try the spot,
    // drag = look around; two gestures, two jobs.
    const foc = ((placing || digging || fencing) && camFree) ? camFree : pos;
    return {
      x: Math.max(0, Math.min(Math.max(0, W * scale - viewW), foc.x * scale - viewW / 2)),
      y: Math.max(0, Math.min(Math.max(0, H * scale - viewH), foc.y * scale - viewH * 0.58)),
    };
  }
  let camWX = NaN, camWY = NaN;
  function cam() {
    const t = camTarget();
    const k = ((placing || digging || fencing) && camFree) ? 0.3 : 0.12;   // panning wants a tighter leash
    camX += (t.x - camX) * k;
    camY += (t.y - camY) * k;
    if (Math.abs(t.x - camX) < 0.2) camX = t.x;
    if (Math.abs(t.y - camY) < 0.2) camY = t.y;
    if (camX === camWX && camY === camWY) return;
    camWX = camX; camWY = camY;
    world.style.transform = 'translate(' + (-camX) + 'px,' + (-camY) + 'px)';
  }

  const ME_ANCHOR = ' translate(-50%,-100%)';
  function place(el, x, y, tail) {
    el.cx = x; el.cy = y; el.cTail = tail || '';
    el.style.transform = 'translate(' + (x * scale) + 'px,' + (y * scale) + 'px)' + el.cTail;
  }
  function replaceMovers() {
    const kids = world ? world.children : [];
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      if (el.cx === undefined) continue;
      el.style.transform = 'translate(' + (el.cx * scale) + 'px,' + (el.cy * scale) + 'px)' + el.cTail;
    }
  }
  const depth = (el, y) => { el.style.zIndex = String(100 + Math.round(y)); };

  // ---- baked fixture overlays (mailbox, sign) -----------------------------
  OVERLAYS.forEach((o) => {
    const d = document.createElement('div');
    d.className = 'hs-ov';
    d.style.left = pct(o[1], W); d.style.top = pct(o[2], H);
    d.style.width = pct(o[3], W); d.style.height = pct(o[4], H);
    d.style.backgroundImage = "url('/assets/homestead/" + o[0] + "')";
    depth(d, o[5]);
    world.appendChild(d);
  });

  // ---- 🌱 THE DEED — invisible now, it still grows with the ladder --------
  // (Trym: "fence is something you should be able to set up yourself") The
  // tier rects only bound WHERE you may build/dig; the visible fence is yours.
  const fenceTier = () => Math.max(1, Math.min(state.stage, 3));
  const plotNow = () => FENCE_TIERS[fenceTier()].plot;
  // an UPGRADE ghost roams the land it BRINGS — the deed expands with the roof
  const placeBounds = () => FENCE_TIERS[Math.max(1, Math.min((placing && placing.toStage) || state.stage, 3))].plot;

  // ---- 🪵 THE PLAYER FENCE: cells like soil, autotiled from the kit -------
  const FENCE_CAP = 120;
  const fenceHas = (i, j) => state.fence.some((c) => c.i === i && c.j === j);
  // ⚠️ THE CORNER LESSON (Trym's screenshot): the kit's verticals come in
  // WEST-post and EAST-post flavours — a column must put its posts in the
  // SAME tile column as the corner piece it hangs off, so we walk the column
  // to its junction and read which side the horizontal run leaves from.
  function fenceVSide(i, j) {
    for (const dir of [-1, 1]) {
      let k = j + dir;
      while (fenceHas(i, k)) {
        if (fenceHas(i - 1, k)) return 've';   // run to the west → east posts
        if (fenceHas(i + 1, k)) return 'vw';   // run to the east → west posts
        k += dir;
      }
    }
    // free-standing column: side by which HALF of the deed it stands in, so a
    // wall drawn one tile shy of its corner still leans the right way (Trym's
    // right wall rendered left-posted and met nothing)
    const F = FENCE_TIERS[fenceTier()].fence;
    return i * 48 + 24 > (F[0] + F[2]) / 2 ? 've' : 'vw';
  }
  function fencePieceFor(i, j) {
    const L = fenceHas(i - 1, j), R2 = fenceHas(i + 1, j);
    const U = fenceHas(i, j - 1), D = fenceHas(i, j + 1);
    if (L || R2) {
      // ⚠️ BOTTOM corners take the kit's SOUTH-JUNCTION pieces (jl/jr): the
      // nub on top of the post is the art that closes the gap to a column
      // arriving from the north — end-runs alone left a visible break (Trym)
      if (!L) return U ? 'jl' : 'endl';
      if (!R2) return U ? 'jr' : 'endr';
      return i % 2 ? 'h' : 'h2';
    }
    // true top-down verticals now: dedicated top/bottom ends, mids alternate
    if (U || D) return !U ? 'vu' : (!D ? 'vb' : (j % 2 ? 'vw' : 've'));
    return 'gl';   // a lone post
  }
  const fpieceEls = new Map();
  // ⚠️ colliders FUSE toward neighbouring cells — per-cell inset boxes left
  // 16px seams between stacked pieces and the banana walked through the rails
  // (Trym). Precomputed here so blocked() stays a flat rect scan.
  let fenceRects = [];
  function buildFenceRects() {
    // 🎯 Trym's three-wall tuning: hitboxes know their piece's ORIENTATION
    // and which side you approach from. Coming from BELOW a wall you stop
    // past its base (drawn in front of the rails); coming from ABOVE you walk
    // deep enough that the fence overflows your legs (drawn behind). Vertical
    // walls push sideways so the sprite never sits on the rails. Fused sides
    // (a fence neighbour) stay flush so walls remain seamless.
    fenceRects = state.fence.map((c) => {
      const L = fenceHas(c.i - 1, c.j), R2 = fenceHas(c.i + 1, c.j);
      const U = fenceHas(c.i, c.j - 1), D = fenceHas(c.i, c.j + 1);
      const vert = (U || D) && !L && !R2;
      return [
        c.i * 48 + (L ? 0 : (vert ? -14 : 4)),
        c.j * 48 + (U ? 0 : (vert ? 14 : 26)),
        c.i * 48 + 48 - (R2 ? 0 : (vert ? -14 : 4)),
        c.j * 48 + 48 - (D ? 0 : (vert ? 2 : -16)),
      ];
    });
  }
  function refreshFenceB() {
    buildFenceRects();
    const seen = new Set();
    state.fence.forEach((c) => {
      const key = c.i + ',' + c.j;
      seen.add(key);
      let el = fpieceEls.get(key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'hs-fpiece';
        el.style.left = pct(c.i * 48, W);
        el.style.top = pct(c.j * 48, H);
        el.style.width = pct(48, W);
        el.style.height = pct(48, H);
        depth(el, (c.j + 1) * 48 - 4);
        world.appendChild(el);
        fpieceEls.set(key, el);
      }
      const piece = fencePieceFor(c.i, c.j);
      if (el.dataset.p !== piece) {
        el.dataset.p = piece;
        el.style.backgroundImage = "url('/assets/homestead/f-" + piece + ".png')";
      }
    });
    fpieceEls.forEach((el, key) => {
      if (!seen.has(key)) { el.remove(); fpieceEls.delete(key); }
    });
  }
  refreshFenceB();
  let tierWas = fenceTier();

  // 📬🪧 the fixtures are MOVERS now (Trym: "place the sign and mailbox
  // where you want it") — drawn from state, colliders ride rebuildSolids
  const mailEl = document.createElement('div');
  mailEl.className = 'hs-ov';
  mailEl.style.width = pct(MAILBOX.w, W);
  mailEl.style.height = pct(MAILBOX.h, H);
  mailEl.style.backgroundImage = "url('/assets/homestead/m-mail.png')";
  world.appendChild(mailEl);
  const signEl = document.createElement('div');
  signEl.className = 'hs-ov';
  signEl.style.width = pct(SIGN.w, W);
  signEl.style.height = pct(SIGN.h, H);
  signEl.style.backgroundImage = "url('/assets/homestead/m-sign.png')";
  world.appendChild(signEl);
  const signName = document.createElement('div');
  signName.className = 'hs-signname';
  world.appendChild(signName);
  function refreshFixtures() {
    mailEl.style.left = pct(state.mailAt.x - MAILBOX.w / 2, W);
    mailEl.style.top = pct(state.mailAt.y - MAILBOX.h, H);
    depth(mailEl, state.mailAt.y);
    signEl.style.left = pct(state.signAt.x - SIGN.w / 2, W);
    signEl.style.top = pct(state.signAt.y - SIGN.h, H);
    depth(signEl, state.signAt.y);
    signName.style.left = pct(state.signAt.x, W);
    signName.style.top = pct(state.signAt.y - SIGN.h - 12, H);
    depth(signName, state.signAt.y + 200);
  }
  refreshFixtures();
  function refreshSign() { signName.textContent = state.name || ''; signName.hidden = !state.name; }
  refreshSign();

  // ---- 🏠 the structure at the TENT spot: nothing → tent → cabin → house --
  const curStruct = () => state.stage >= 1
    ? STRUCT_LADDER[Math.min(state.stage, STRUCT_LADDER.length) - 1] : null;
  const STYLE_RUNG = {};
  Object.keys(STRUCT_STYLES).forEach((r) => STRUCT_STYLES[r].forEach((k) => { STYLE_RUNG[k] = Number(r); }));
  // 🎨 progress never regresses; the LOOK is always your choice — a worn
  // lower-rung style overrides the purchased one (tent on a house-sized deed)
  const curStyleKey = () => {
    const r = Math.min(state.stage, 3);
    if (state.look && STYLE_RUNG[state.look] && STYLE_RUNG[state.look] <= r) return state.look;
    return (state.style && state.style[r]) || STYLE_DEFAULTS[r];
  };
  const structDims = () => state.stage >= 1 ? STRUCTS[curStyleKey()] : { w: 140, h: 74 };
  let structEl = null, structKey = '', tentSpotEl = null;
  function refreshTent() {
    if (state.stage < 1) {
      if (structEl) { structEl.remove(); structEl = null; structKey = ''; }
      if (!tentSpotEl) {
        tentSpotEl = document.createElement('div');
        tentSpotEl.className = 'hs-tentspot';
        tentSpotEl.style.left = pct(state.home.x - 70, W);
        tentSpotEl.style.top = pct(state.home.y - 74, H);
        tentSpotEl.style.width = pct(140, W);
        tentSpotEl.style.height = pct(74, H);
        tentSpotEl.innerHTML = '<span>⛺ a good tent spot<br><small>ask at the mailbox</small></span>';
        depth(tentSpotEl, state.home.y - 40);
        world.appendChild(tentSpotEl);
      }
      return;
    }
    if (tentSpotEl) { tentSpotEl.remove(); tentSpotEl = null; }
    const styleKey = curStyleKey();
    const sig = styleKey + ':' + state.home.x + ',' + state.home.y;
    if (structKey === sig) return;
    if (structEl) structEl.remove();
    const d = STRUCTS[styleKey];
    structEl = document.createElement('div');
    structEl.className = 'hs-ov';
    structEl.style.left = pct(state.home.x - d.w / 2, W);
    structEl.style.top = pct(state.home.y - d.h, H);
    structEl.style.width = pct(d.w, W);
    structEl.style.height = pct(d.h, H);
    structEl.style.backgroundImage = "url('/assets/homestead/ov-" + styleKey + ".png')";
    depth(structEl, state.home.y);
    world.appendChild(structEl);
    structKey = sig;
  }
  refreshTent();

  // ---- 🛋 INTERIORS (M4): step inside — the room floats over a shade ------
  // Same coordinate space, same camera, same collision machinery; the shade
  // (z 2000) hides the yard and the banana rides z+2100 while indoors.
  let inside = 0, inShade = null, inPlate = null, inPlateKey = '';
  const IN_Z = 2100;
  function camSnap() { const t = camTarget(); camX = t.x; camY = t.y; }
  const homeTier = () => STYLE_RUNG[curStyleKey()] || Math.max(1, Math.min(state.stage, 3));
  function enterHome() {
    const I = INTERIORS[homeTier()];
    if (!I) return;
    inside = homeTier();
    if (!inShade) {
      inShade = document.createElement('div');
      inShade.className = 'hs-inshade';
      world.appendChild(inShade);
    }
    inShade.hidden = false;
    if (!inPlate) {
      inPlate = document.createElement('div');
      inPlate.className = 'hs-ov';
      inPlate.style.zIndex = '2010';
      world.appendChild(inPlate);
    }
    if (inPlateKey !== I.img) {
      inPlateKey = I.img;
      inPlate.style.left = pct(I.box[0], W); inPlate.style.top = pct(I.box[1], H);
      inPlate.style.width = pct(I.box[2], W); inPlate.style.height = pct(I.box[3], H);
      inPlate.style.backgroundImage = "url('/assets/homestead/" + I.img + "')";
    }
    inPlate.hidden = false;
    pos.x = I.spawn[0]; pos.y = I.spawn[1];
    tgt.x = pos.x;
    // nudge INTO the room — toward its centre, never back through the door
    tgt.y = pos.y + (pos.y < I.box[1] + I.box[3] / 2 ? 34 : -34);
    camSnap();
    toast('🏠 home — the door takes you back out');
    track('homestead_enter_home', { tier: inside });
  }
  function exitHome() {
    inside = 0;
    if (inShade) inShade.hidden = true;
    if (inPlate) inPlate.hidden = true;
    pos.x = state.home.x; pos.y = state.home.y + 34;
    tgt.x = pos.x; tgt.y = pos.y + 30;
    camSnap();
  }

  // ---- placed decor -------------------------------------------------------
  const DEX = {};
  DECOR.forEach((d) => { DEX[d.id] = d; });
  // 🎁 COMMUNITY DECOR (M3b): forge-made pieces ride the catalog as inline
  // SVG (kind 'decor', never worn) — they join the mailbox with maker credit,
  // and a visitor's yard re-renders once the catalog lands.
  loadCatalog().then((items) => {
    let fresh = 0;
    (items || []).forEach((it) => {
      if (it.kind !== 'decor' || !it.wear || DEX[it.id]) return;
      const cu = wearToCustom(it.wear);
      if (!cu || !cu.art) return;
      DEX[it.id] = { id: it.id, name: it.title || 'community piece', cat: 'community',
        price: 20, stage: 1, w: 46, h: 46, surface: 'ground',
        svg: cu.art, img: null, solid: null, maker: it.by || '' };
      fresh++;
    });
    if (fresh) refreshItems();
  });
  const itemEls = [];
  function itemDiv(it, ghost) {
    const d = DEX[it.id];
    const el = document.createElement('div');
    el.className = 'hs-it' + (ghost ? ' hs-it--ghost' : '');
    el.style.left = pct(it.x - d.w / 2, W);
    el.style.top = pct(it.y - d.h, H);
    el.style.width = pct(d.w, W);
    el.style.height = pct(d.h, H);
    if (d.svg) el.innerHTML = d.svg;
    else el.style.backgroundImage = "url('" + d.img + "')";
    depth(el, it.y);
    world.appendChild(el);
    return el;
  }
  function refreshItems() {
    itemEls.forEach((el) => el.remove());
    itemEls.length = 0;
    state.items.forEach((it) => { if (DEX[it.id]) itemEls.push(itemDiv(it)); });
    rebuildSolids();
  }

  // ---- collision ----------------------------------------------------------
  let liveRects = [];
  function rebuildSolids() {
    liveRects = [];
    state.items.forEach((it) => {
      const d = DEX[it.id];
      if (d && d.solid) liveRects.push([it.x + d.solid[0], it.y + d.solid[1], it.x + d.solid[2], it.y + d.solid[3]]);
    });
    if (state.stage >= 1) {
      const d = structDims();
      const hw2 = Math.max(24, d.w * 0.42);
      liveRects.push([state.home.x - hw2, state.home.y - Math.max(20, d.h * 0.2), state.home.x + hw2, state.home.y + 4]);
    }
    // the soil is WALKABLE (Trym) — no collider; placement still keeps off it
    liveRects.push([state.mailAt.x - 14, state.mailAt.y - 12, state.mailAt.x + 14, state.mailAt.y + 2]);
    liveRects.push([state.signAt.x - 16, state.signAt.y - 10, state.signAt.x + 16, state.signAt.y + 2]);
  }
  const inRect = (x, y, r) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
  const inRoadLane = (y) => Math.abs(y - ROAD.y) < ROAD.hw - 6;
  function blocked(x, y) {
    if (inside) {
      const I = INTERIORS[inside];
      if (x < I.box[0] + 6 || x > I.box[0] + I.box[2] - 6
        || y < I.box[1] + 6 || y > I.box[1] + I.box[3] - 6) return true;
      for (const r of I.cols) if (inRect(x, y, r)) return true;
      return false;
    }
    if (x < BOUND || y < BOUND || y > H - BOUND) return true;
    if (x > W - BOUND && !inRoadLane(y)) return true;      // east = the road out
    for (const r of OB_RECTS) if (inRect(x, y, r)) return true;
    for (const r of fenceRects) if (inRect(x, y, r)) return true;
    for (const r of liveRects) if (inRect(x, y, r)) return true;
    return false;
  }
  rebuildSolids();
  refreshItems();

  // ---- 🪏 the soil: DUG cell by cell, any shape (Trym) --------------------
  // A cell is a 48px tile {i,j}; walkable, plantable, refillable. No collider
  // — the only fence around a patch is the shape you dug it in.
  const SOIL_CAP = 24;
  const cellCx = (c) => c.i * 48 + 24;
  const cellBase = (c) => c.j * 48 + 48;
  const cellAt = (wx, wy) => state.soil.find((c) => c.i === Math.floor(wx / 48) && c.j === Math.floor(wy / 48));
  function cropStage(b) { return !b ? 0 : Math.min(4, 1 + (b.waters | 0)); }
  // the pack's arable topsoil is a 16-piece neighbour grammar — a dug region
  // reads as ONE organic patch, never stacked squares (Trym's screenshot)
  function soilPieceFor(c) {
    const has = (a, b) => state.soil.some((s2) => s2.i === a && s2.j === b);
    const n = has(c.i, c.j - 1), s2 = has(c.i, c.j + 1);
    const w2 = has(c.i - 1, c.j), e2 = has(c.i + 1, c.j);
    if (!n && !s2) return (!w2 && !e2) ? 'iso' : (!w2 ? 'hl' : (e2 ? 'hm' : 'hr'));
    if (!w2 && !e2) return !n ? 'vu' : (s2 ? 'vm' : 'vb');
    const row = !n ? 'u' : (s2 ? 'm' : 'b');
    const col = !w2 ? 'l' : (e2 ? (row === 'm' ? 'c' : 'm') : 'r');
    return row + col;
  }
  const soilEls = new Map();
  function refreshSoil() {
    const seen = new Set();
    state.soil.forEach((c) => {
      const key = c.i + ',' + c.j;
      seen.add(key);
      let e = soilEls.get(key);
      if (!e) {
        e = { soil: document.createElement('div'), crop: null, sig: '' };
        e.soil.className = 'hs-soil';
        e.soil.style.left = pct(c.i * 48, W);
        e.soil.style.top = pct(c.j * 48, H);
        e.soil.style.width = pct(48, W);
        e.soil.style.height = pct(48, H);
        world.appendChild(e.soil);
        soilEls.set(key, e);
      }
      const st = c.crop ? cropStage(c) : 0;
      const sig = (c.crop || '') + st + soilPieceFor(c);
      if (e.pc !== soilPieceFor(c)) {
        e.pc = soilPieceFor(c);
        e.soil.style.backgroundImage = "url('/assets/homestead/s-" + e.pc + ".png')";
      }
      if (e.sig !== sig) {
        e.sig = sig;
        if (e.crop) { e.crop.remove(); e.crop = null; }
        if (c.crop) {
          e.crop = document.createElement('div');
          e.crop.className = 'hs-crop' + (st >= 4 ? ' is-ripe' : '');
          e.crop.style.left = pct(cellCx(c) - 18, W);
          e.crop.style.top = pct(cellBase(c) - 44, H);
          e.crop.style.width = pct(36, W);
          e.crop.style.height = pct(40, H);
          e.crop.style.backgroundImage = "url('/assets/park/c-" + c.crop + '-' + st + ".png')";
          depth(e.crop, cellBase(c) - 4);
          world.appendChild(e.crop);
        }
      }
    });
    soilEls.forEach((e, key) => {
      if (!seen.has(key)) { e.soil.remove(); if (e.crop) e.crop.remove(); soilEls.delete(key); }
    });
  }
  refreshSoil();

  // ---- 🐦 garden birds (M3): they come when the yard is LIVED-IN ----------
  // Ambient, not a loop: an empty yard gets no birds, decor attracts them,
  // bird houses attract more — and walking up close scares them off. The
  // reward for furnishing is a yard that moves.
  const birdsLive = [];
  const birdTick = (() => {
    if (REDUCED || !BIRDS.length) return () => {};
    let nextAt = 6000 + Math.random() * 9000;
    const birdCap = () => Math.min(3, 1 + state.items.filter((i) => i.id.indexOf('birdhouse') === 0).length);
    function landSpot() {
      const houses = state.items.filter((i) => i.id.indexOf('birdhouse') === 0);
      const pool = (houses.length && Math.random() < 0.6) ? houses : state.items;
      if (!pool.length) return null;
      const it = pool[(Math.random() * pool.length) | 0];
      const P = plotNow();
      return {
        x: Math.max(P[0] + 12, Math.min(P[2] - 12, it.x + (Math.random() * 90 - 45))),
        y: Math.max(P[1] + 30, Math.min(P[3] - 6, it.y + 8 + Math.random() * 26)),
      };
    }
    function setStrip(b, kind) {
      b.strip = kind;
      b.img.style.backgroundImage = "url('/assets/homestead/b-" + b.key + '-' + kind + ".png')";
    }
    function makeBird() {
      const spot = landSpot();
      if (!spot) return;
      const el = document.createElement('div');
      el.className = 'hs-bird';
      const img = document.createElement('span');
      el.appendChild(img);
      world.appendChild(el);
      const b = { el, img, key: BIRDS[(Math.random() * BIRDS.length) | 0],
        x: Math.random() < 0.5 ? -30 : W + 30, y: Math.max(60, spot.y - 320),
        tx: spot.x, ty: spot.y, mode: 'in', strip: '',
        until: 0, frame: 0, frameAt: 0, hopAt: 0 };
      setStrip(b, 'f');
      birdsLive.push(b);
    }
    return (now, dt) => {
      if (now > nextAt) {
        if (birdsLive.length < birdCap()) makeBird();
        nextAt = now + 16000 + Math.random() * 26000;
      }
      for (let i = birdsLive.length - 1; i >= 0; i--) {
        const b = birdsLive[i];
        const flying = b.mode !== 'ground';
        if (now - b.frameAt > (flying ? 90 : 240)) {
          b.frameAt = now;
          b.frame = (b.frame + 1) % 4;
          const want = flying ? 'f' : 'g';
          if (b.strip !== want) setStrip(b, want);
          b.img.style.backgroundPosition = (b.frame * 100 / 3) + '% 0';
        }
        if (flying) {
          const dx = b.tx - b.x, dy = b.ty - b.y;
          const d = Math.hypot(dx, dy);
          if (d < 9) {
            if (b.mode === 'out') { b.el.remove(); birdsLive.splice(i, 1); continue; }
            b.mode = 'ground';
            b.until = now + 12000 + Math.random() * 22000;
            b.hopAt = now + 900;
          } else {
            b.x += dx / d * 300 * dt;
            b.y += dy / d * 300 * dt;
            if (Math.abs(dx) > 4) b.img.style.transform = dx < 0 ? 'scaleX(-1)' : '';
          }
        } else if (Math.hypot(pos.x - b.x, pos.y - b.y) < 80 || now > b.until) {
          b.mode = 'out';   // scared (or bored) — off over the treeline
          b.tx = b.x + (b.x > W / 2 ? 600 : -600);
          b.ty = -80;
        } else if (now > b.hopAt) {
          b.hopAt = now + 1400 + Math.random() * 2600;
          const P = plotNow();
          b.x = Math.max(P[0] + 12, Math.min(P[2] - 12, b.x + (Math.random() * 44 - 22)));
          if (Math.random() < 0.5) b.img.style.transform = Math.random() < 0.5 ? 'scaleX(-1)' : '';
        }
        place(b.el, b.x, b.y, ' translate(-50%,-100%)');
        depth(b.el, b.y);
      }
    };
  })();

  // ---- juice --------------------------------------------------------------
  function float(x, y, text) {
    const d = document.createElement('div');
    d.className = 'hs-float';
    d.innerHTML = text;   // internal strings only — prices ride the real coin
    d.style.left = pct(x, W); d.style.top = pct(y, H);
    world.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }
  let toastTimer = null;
  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms || 2400);
  }
  const hint = (on) => { if (hintEl) hintEl.classList.toggle('is-off', !on); };

  // ---- HUD + actions ------------------------------------------------------
  const hud = mountHud({
    mount: view,
    theme: { bg: 'rgba(16, 24, 12, 0.82)' },
    chips: ['lvl', 'coins'],
  });
  const refreshHud = () => hud && hud.refresh();
  document.getElementById('hsEmote').addEventListener('click', () => float(pos.x, pos.y - 44, '❤️'));
  document.getElementById('hsBag').addEventListener('click', () => {
    if (visiting) { toast('that’s ' + state.name + '’s number, not yours'); return; }
    if (!state.claimedAt) { toast('walk in through the gate first — this clearing can be yours'); return; }
    openShop('home');   // 🍌 the phone opens on its home screen
  });
  initTravel({ here: 'homestead', mount: document.querySelector('.hs-actions'), btnClass: 'hs-act hs-act--icon', track });
  // 🔨 THE PLANNER (Trym: "a separate mode where the camera zooms out and
  // you get the whole map as a dark overlay grid") — building is rare, so it
  // lives behind ONE button and gets a real editor: the deed lit and gridded,
  // the rest of the world dimmed, taps instant, drag pans. The ACNH
  // island-designer convention.
  const buildBtn = document.getElementById('hsBuild');
  const planBar = document.getElementById('hsPlan');
  const toolF = document.getElementById('hsToolFence');
  const toolS = document.getElementById('hsToolSoil');
  const toolC = document.getElementById('hsToolClear');
  function setTool(t) {
    fencing = t === 'fence'; digging = t === 'soil'; clearing = t === 'clear';
    toolF.setAttribute('aria-pressed', String(fencing));
    toolS.setAttribute('aria-pressed', String(digging));
    toolC.setAttribute('aria-pressed', String(clearing));
    toast(fencing ? '🪵 tap your land (the lit grid) to build fence — tap a piece to take it down'
      : digging ? '⛏️ tap your land to till soil — tap soil to fill it back'
      : '🧹 tap anything to clear it — decor goes safely to the shed', 3400);
  }
  function planOverlay() {
    const F = FENCE_TIERS[fenceTier()].fence;
    if (!planEls) {
      planEls = {
        dims: [0, 1, 2, 3].map(() => {
          const d = document.createElement('div');
          d.className = 'hs-dim';
          world.appendChild(d);
          return d;
        }),
        grid: document.createElement('div'),
      };
      planEls.grid.className = 'hs-gridov';
      world.appendChild(planEls.grid);
    }
    const [x0, y0, x1, y1] = F;
    const box = (el, a, b, w2, h2) => {
      el.style.left = pct(a, W); el.style.top = pct(b, H);
      el.style.width = pct(w2, W); el.style.height = pct(h2, H);
    };
    box(planEls.dims[0], 0, 0, W, y0);
    box(planEls.dims[1], 0, y1, W, H - y1);
    box(planEls.dims[2], 0, y0, x0, y1 - y0);
    box(planEls.dims[3], x1, y0, W - x1, y1 - y0);
    box(planEls.grid, x0, y0, x1 - x0, y1 - y0);
    planEls.grid.style.backgroundImage =
      'linear-gradient(to right, rgba(255,253,235,0.16) 1px, transparent 1px),'
      + 'linear-gradient(to bottom, rgba(255,253,235,0.16) 1px, transparent 1px)';
    planEls.grid.style.backgroundSize = (48 / (x1 - x0) * 100) + '% ' + (48 / (y1 - y0) * 100) + '%';
    planShow(true);
  }
  function planShow(on) {
    if (!planEls) return;
    planEls.dims.forEach((d) => { d.hidden = !on; });
    planEls.grid.hidden = !on;
  }
  function enterPlanner() {
    planner = true;
    buildBtn.setAttribute('aria-pressed', 'true');
    planBar.hidden = false;
    planOverlay();
    setTool('fence');
    const F = FENCE_TIERS[fenceTier()].fence;
    camFree = { x: (F[0] + F[2]) / 2, y: (F[1] + F[3]) / 2 };
    view.classList.add('is-placing');
    layout();
    camSnap();
    track('homestead_planner');
  }
  function exitPlanner() {
    if (!planner && !digging && !fencing) return;
    planner = false; digging = false; fencing = false; clearing = false;
    buildBtn.setAttribute('aria-pressed', 'false');
    planBar.hidden = true;
    planShow(false);
    if (hovEl) hovEl.hidden = true;
    if (!placing) camFree = null;
    view.classList.toggle('is-placing', !!placing);
    layout();
    camSnap();
  }
  buildBtn.addEventListener('click', () => {
    if (visiting) { toast('build at your own homestead'); return; }
    if (!state.claimedAt) { toast('walk in through the gate first — this clearing can be yours'); return; }
    if (planner) exitPlanner(); else enterPlanner();
  });
  toolF.addEventListener('click', () => setTool('fence'));
  toolS.addEventListener('click', () => setTool('soil'));
  toolC.addEventListener('click', () => setTool('clear'));
  document.getElementById('hsToolShed').addEventListener('click', () => openShop('shed', true));
  document.getElementById('hsPlanDone').addEventListener('click', exitPlanner);
  // the hover cell: desktop sees exactly which tile a tap would hit
  view.addEventListener('pointermove', (e) => {
    if (!planner || (gest && gest.panning)) { if (hovEl) hovEl.hidden = true; return; }
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    const i = Math.floor(wx / 48), j = Math.floor(wy / 48);
    const F = FENCE_TIERS[fenceTier()].fence;
    const ok = i * 48 >= F[0] && (i + 1) * 48 <= F[2] && j * 48 >= F[1] && (j + 1) * 48 <= F[3];
    if (!hovEl) {
      hovEl = document.createElement('div');
      hovEl.className = 'hs-hovcell';
      hovEl.style.width = pct(48, W);
      hovEl.style.height = pct(48, H);
      world.appendChild(hovEl);
    }
    hovEl.hidden = !ok;
    if (ok) { hovEl.style.left = pct(i * 48, W); hovEl.style.top = pct(j * 48, H); }
  });

  // ---- spawn + walking ----------------------------------------------------
  const pos = { x: SPAWN.x, y: SPAWN.y };
  const tgt = { x: SPAWN.x - 120, y: SPAWN.y };
  const c0 = camTarget(); camX = c0.x; camY = c0.y;
  track('homestead_open', { claimed: state.claimedAt ? 1 : 0 });

  const SPEED = 168;
  const keys = {};
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      if (panelOpen()) return;
      keys[k] = true; e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // ---- the east door: back to the park ------------------------------------
  const DOOR = { x: W - 40, y: ROAD.y };
  const DOOR_ZONE = 130, DOOR_GO = 40, DOOR_ARM = 200;
  let doorArmed = false, leaving = false, stripOn = false;
  function exitTo(href) {
    if (leaving) return;
    leaving = true;
    track('homestead_exit', { to: 'park' });
    if (REDUCED) { location.href = href; return; }
    cutEl.classList.add('is-on');
    setTimeout(() => { location.href = href; }, 170);
  }
  function doorTick() {
    const d = Math.hypot(pos.x - DOOR.x, pos.y - DOOR.y);
    if (!doorArmed) { if (d > DOOR_ARM) doorArmed = true; return; }
    if (d < DOOR_GO) { exitTo('/park/'); return; }
    const want = d < DOOR_ZONE;
    if (want !== stripOn) {
      stripOn = want;
      exitEl.textContent = 'keep walking → back to the park';
      exitEl.classList.toggle('is-on', want);
    }
  }

  // ---- panels -------------------------------------------------------------
  const claimEl = document.getElementById('hsClaim');
  const shopEl = document.getElementById('hsShop');
  const guestEl = document.getElementById('hsGuest');
  const cookEl = document.getElementById('hsCook');
  const confirmEl = document.getElementById('hsConfirm');
  const panelOpen = () => !claimEl.hidden || !shopEl.hidden || !guestEl.hidden || !cookEl.hidden;
  // while any popup is open the PAGE must not scroll under it (Trym)
  const syncLock = () => document.body.classList.toggle('hs-lock', panelOpen());

  // ---- 🍳 the kitchen (stage 2+): the pantry becomes WORLD-WIDE effects ----
  function renderCook() {
    const pan = document.getElementById('hsPantry');
    pan.replaceChildren();
    CROPS.forEach((c) => {
      const b = document.createElement('span');
      b.textContent = CROP_EMO[c.id] + ' × ' + (state.pantry[c.id] || 0);
      pan.appendChild(b);
    });
    const buff = buffGet();
    const note = document.getElementById('hsCookNote');
    note.textContent = buff
      ? '✨ ' + (buff.fx === 'coins2' ? 'double coins' : 'double XP') + ' is on — '
        + Math.max(1, Math.round((buff.until - Date.now()) / 60000)) + ' min left'
      : 'grow it, cook it — the whole world pays out more.';
    const list = document.getElementById('hsCookList');
    list.replaceChildren();
    DISHES.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'hs-dish';
      const needTxt = Object.entries(d.need).map(([k, n]) => CROP_EMO[k] + '×' + n).join('  ');
      const meta = document.createElement('div');
      meta.innerHTML = '<b>' + d.icon + ' ' + d.name + '</b><span>' + needTxt + ' → ' + d.blurb + '</span>';
      const btn = document.createElement('button');
      btn.className = 'hs-btn';
      const can = Object.entries(d.need).every(([k, n]) => (state.pantry[k] || 0) >= n);
      const busy = d.fx && buff;   // one pot, one simmer at a time
      btn.textContent = busy ? 'pot’s busy' : 'cook it';
      btn.disabled = !can || !!busy;
      btn.addEventListener('click', () => {
        Object.entries(d.need).forEach(([k, n]) => { state.pantry[k] -= n; });
        if (d.fx) {
          buffSet(d.fx, d.mins);
          toast(d.icon + ' ' + d.blurb);
        } else {
          passStat('coins_earned', d.pay);
          refreshHud();
          toast(d.icon + ' +' + d.pay + ' bananacoins — fresh from the oven');
        }
        save();
        track('homestead_cook', { dish: d.id });
        renderCook();
      });
      row.append(meta, btn);
      list.appendChild(row);
    });
  }
  function openCook() { cookEl.hidden = false; syncLock(); renderCook(); track('homestead_kitchen'); }
  document.getElementById('hsCookClose').addEventListener('click', () => { cookEl.hidden = true; syncLock(); });
  cookEl.addEventListener('click', (e) => { if (e.target === cookEl) { cookEl.hidden = true; syncLock(); } });

  // ---- 🪧 the guestbook at the sign (+ your address, once you have one) ----
  const yardUrl = () => 'https://trymstene.com/homestead/?yard=' + state.slug;
  let guestCache = visiting ? (state.guest || []) : null;
  function renderGuest(entries) {
    const list = document.getElementById('hsGuestList');
    list.replaceChildren();
    if (!entries || !entries.length) {
      const p = document.createElement('p');
      p.className = 'hs-note';
      p.textContent = entries ? 'No notes yet — the first one is the best one.' : 'The book won’t open… try again in a bit.';
      list.appendChild(p);
      return;
    }
    entries.forEach((g) => {
      const row = document.createElement('div');
      row.className = 'hs-guest';
      const b = document.createElement('b');
      b.textContent = g.n || 'a banana';
      const sp = document.createElement('span');
      sp.textContent = g.x;
      row.append(b, sp);
      list.appendChild(row);
    });
  }
  async function openGuest() {
    document.getElementById('hsGuestTitle').textContent = '🪧 ' + (state.name || 'The sign');
    document.getElementById('hsSignRow').hidden = !visiting;
    document.getElementById('hsSignMove').hidden = visiting || !state.claimedAt;
    const share = document.getElementById('hsShare');
    share.hidden = visiting || !state.slug;
    if (!share.hidden) document.getElementById('hsShareUrl').value = yardUrl();
    guestEl.hidden = false;
    syncLock();
    track('homestead_guestbook', { visiting: visiting ? 1 : 0 });
    if (!guestCache && state.slug) {
      renderGuest([]);
      try { guestCache = (await yFetch('/yard?slug=' + state.slug)).guest || []; } catch (e) { guestCache = null; }
    }
    renderGuest(guestCache || []);
  }
  document.getElementById('hsGuestClose').addEventListener('click', () => { guestEl.hidden = true; syncLock(); });
  guestEl.addEventListener('click', (e) => { if (e.target === guestEl) { guestEl.hidden = true; syncLock(); } });
  document.getElementById('hsShareCopy').addEventListener('click', () => {
    const inp = document.getElementById('hsShareUrl');
    try { navigator.clipboard.writeText(inp.value); } catch (e) { inp.select(); document.execCommand('copy'); }
    toast('🔗 address copied — hand it to a friend');
    track('homestead_share');
  });
  document.getElementById('hsSignGo').addEventListener('click', async () => {
    const inp = document.getElementById('hsSignText');
    const text = inp.value.trim().slice(0, 80);
    if (!text) { inp.focus(); return; }
    const btn = document.getElementById('hsSignGo');
    btn.disabled = true;
    let ok = true;   // ⚠️ AWAITED — a promise is always truthy
    try { ok = await import('../lib/sticker-core.js').then((m) => m.captionsClean({ top: text })); } catch (e) {}
    if (!ok) { btn.disabled = false; toast('let’s keep the book family friendly'); return; }
    try {
      const r = await yFetch('/sign', { slug: state.slug, name: myName, text });
      guestCache = r.guest || guestCache;
      inp.value = '';
      renderGuest(guestCache);
      toast('✍️ signed — ' + state.name + ' will find it');
      track('homestead_sign');
    } catch (e) { toast('the pen is out of ink — try again in a bit'); }
    btn.disabled = false;
  });

  // ---- 👋 visiting: the banner + the doorbell ------------------------------
  if (visiting) {
    const bar = document.getElementById('hsVisit');
    document.getElementById('hsVisitName').textContent = '👋 visiting ' + state.name;
    bar.hidden = false;
    yFetch('/visit', { slug: state.slug, name: myName }).catch(() => {});
    track('homestead_visit', { slug: state.slug });
  }
  if (visitMiss) toast('that homestead isn’t on the map — the road home is east', 3600);

  // ---- 📯 the owner's yard sync: address backfill + away-news --------------
  async function yardBoot() {
    if (visiting || !state.claimedAt) return;
    try {
      if (!state.slug) {
        const r = await yFetch('/claim', { name: state.name });
        if (!r || !r.slug) return;
        state.slug = r.slug;
      }
      const n = await yFetch('/news', {});
      state.wdays = state.wdays || [];
      let watered = 0, wname = '';
      (n.waters || []).forEach((w) => {
        if (!w.d || state.wdays.includes(w.d)) return;
        state.wdays.push(w.d);
        state.soil.forEach((b) => {
          if (b.crop && cropStage(b) < 4 && b.last !== w.d && (b.planted || '') <= w.d) {
            b.waters = (b.waters | 0) + 1;
            if ((b.last || '') < w.d) b.last = w.d;
            watered++;
          }
        });
        if (w.n) wname = w.n;
      });
      state.wdays = state.wdays.slice(-14);
      if (watered) refreshSoil();
      save();   // persists slug/wdays AND publishes the fresh snapshot
      const msgs = [];
      if (watered) msgs.push('💧 ' + (wname || 'a neighbour') + ' watered your beds while you were away');
      if (n.signs && n.signs.length) {
        msgs.push(n.signs.length === 1
          ? '✍️ ' + (n.signs[0].n || 'someone') + ' signed your guestbook'
          : '✍️ ' + n.signs.length + ' new notes in your guestbook');
      }
      const vc = n.visitCount || 0;
      if (vc) {
        msgs.push(vc === 1
          ? '👋 ' + ((n.visits && n.visits[0]) || 'a banana') + ' came by while you were away'
          : '👋 ' + vc + ' bananas came by while you were away');
      }
      msgs.forEach((m, i) => setTimeout(() => toast(m, 3200), 1200 + i * 3500));
      if (msgs.length) track('homestead_news', { n: msgs.length });
    } catch (e) {}
  }
  yardBoot();

  // ---- 🪧 THE CLAIM — once, when you first walk through the gate ----------
  let claimShown = false;
  function offerClaim() {
    if (claimShown || state.claimedAt) return;
    claimShown = true;
    const inp = document.getElementById('hsClaimName');
    inp.value = myName ? myName + "'s Homestead" : 'My Homestead';
    claimEl.hidden = false;
    syncLock();
    setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 40);
  }
  document.getElementById('hsClaimGo').addEventListener('click', async () => {
    const inp = document.getElementById('hsClaimName');
    const v = inp.value.trim().slice(0, 28);
    if (!v) { inp.focus(); return; }
    const btn = document.getElementById('hsClaimGo');
    btn.disabled = true;
    let ok = true;   // ⚠️ AWAITED — a promise is always truthy (the askName lesson)
    try { ok = await import('../lib/sticker-core.js').then((m) => m.captionsClean({ top: v })); } catch (e) {}
    btn.disabled = false;
    if (!ok) { toast('let’s keep the sign family friendly — try another name'); inp.focus(); return; }
    state.name = v;
    state.claimedAt = Date.now();
    save(); refreshSign();
    claimEl.hidden = true;
    syncLock();
    toast('🏡 ' + v + ' — it’s yours');
    track('homestead_claim');
    // mint the ADDRESS — the sign name becomes the slug (yardBoot retries if offline)
    yFetch('/claim', { name: v }).then((r) => {
      if (r && r.slug) { state.slug = r.slug; save(); }
    }).catch(() => {});
    // the naming moment, AFTER the deed (silent if already named/asked)
    askName({
      why: 'Your clearing has a sign now.',
      paint: (cv) => { try { drawComposite(cv.getContext('2d'), 72, 2, ME_DRAW); } catch (e) {} },
      clean: (v2) => import('../lib/sticker-core.js').then((m) => m.captionsClean({ top: v2 })).catch(() => true),
    }).then((nm) => { if (nm) myName = nm; });
  });

  // ---- 📬 the mailbox shop -------------------------------------------------
  const cap = () => CAPS[Math.min(state.stage, CAPS.length - 1)];
  const CAT_LABELS = { garden: '🌼 Garden', furniture: '🪑 Furniture', nature: '🌿 Nature',
    lighting: '🏮 Lighting', display: '🏆 Display', fun: '🎈 Fun', community: '🎁 Community',
    farm: '🌾 Farm' };
  // 🚚 THE DELIVERY TIERS (Trym): commons build instantly, furniture and
  // statement pieces take a van — short waits (hours, never days), and the
  // arrival is an EVENT. Community pieces ship instantly (maker-made).
  const SHIP_MIN = { garden: 0, nature: 0, farm: 0, fun: 0, community: 0, lighting: 30, furniture: 60, display: 240 };
  const shipMin = (d) => SHIP_MIN[d.cat] || 0;
  const fmtShip = (ms) => {
    const m = Math.max(1, Math.round(ms / 60000));
    return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60 ? (m % 60) + 'm' : '') : m + 'm';
  };
  function checkOrders() {
    if (visiting || !state.orders.length) return;
    const now = Date.now();
    const due = state.orders.filter((o) => o.at <= now);
    if (!due.length) return;
    state.orders = state.orders.filter((o) => o.at > now);
    due.forEach((o) => state.shed.push({ id: o.id }));
    save();
    shopNote(due.length === 1
      ? '📦 your ' + (DEX[due[0].id] ? DEX[due[0].id].name.toLowerCase() : 'order') + ' arrived — it’s in the shed'
      : '📦 ' + due.length + ' orders arrived — they’re in the shed', 4200);
    track('homestead_delivery', { n: due.length });
    if (!shopEl.hidden) { shopHead(); renderShop(); }
  }
  setInterval(checkOrders, 30000);
  setTimeout(checkOrders, 1500);
  function shopTile(d, verb, cb) {
    const tile = document.createElement('div');
    tile.className = 'hs-tile';
    let im;
    if (d.svg) {   // a community piece — inline SVG, with the maker's name on it
      im = document.createElement('span');
      im.className = 'hs-tilesvg';
      im.innerHTML = d.svg;
    } else {
      im = document.createElement('img');
      im.src = d.img; im.alt = ''; im.loading = 'lazy';
    }
    const nm = document.createElement('b');
    nm.textContent = d.name;
    if (d.maker) {
      const by = document.createElement('i');
      by.className = 'hs-maker';
      by.textContent = 'by ' + d.maker;
      nm.appendChild(document.createElement('br'));
      nm.appendChild(by);
    }
    const pr = document.createElement('em');
    if (verb === 'buy') pr.innerHTML = d.price + ' ' + COIN + (shipMin(d) ? ' · 🚚 ' + fmtShip(shipMin(d) * 60000) : '');
    else pr.textContent = 'in the shed';
    const btn = document.createElement('button');
    btn.className = 'hs-btn';
    if (verb === 'buy' && d.stage > state.stage) {
      const need = STRUCT_LADDER[Math.min(d.stage, STRUCT_LADDER.length) - 1];
      btn.textContent = 'get it';
      btn.disabled = true;
      tile.classList.add('is-locked');
      const pill = document.createElement('span');
      pill.className = 'hs-lockpill';
      pill.textContent = '🔒 ' + (need && need.key ? need.key + ' first' : 'locked');
      tile.appendChild(pill);
    } else if (verb === 'buy') {
      btn.textContent = shipMin(d) ? 'order it' : 'get it';
      btn.disabled = coinBalance() < d.price;
    } else {
      btn.textContent = 'place it';
    }
    btn.addEventListener('click', cb);
    tile.append(im, nm, pr, btn);
    return tile;
  }
  // 🎨 the style wardrobe: thumbnails, one selected, returns a getter
  function stylePicker(rung, host) {
    const keys = STRUCT_STYLES[rung] || [];
    let chosen = STYLE_DEFAULTS[rung];
    const row = document.createElement('div');
    row.className = 'hs-stylepick';
    keys.forEach((k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hs-stylebtn';
      b.innerHTML = '<img src="/assets/homestead/ov-' + k + '.png" alt="" loading="lazy">';
      b.setAttribute('aria-pressed', String(k === chosen));
      b.addEventListener('click', () => {
        chosen = k;
        row.querySelectorAll('button').forEach((x) =>
          x.setAttribute('aria-pressed', String(x === b)));
      });
      row.appendChild(b);
    });
    host.appendChild(row);
    return () => chosen;
  }

  function renderShop() {
    const list = document.getElementById('hsShopList');
    const catsRow = document.getElementById('hsShopCats');
    list.replaceChildren();
    catsRow.hidden = true;
    // ⛺ TENT FIRST (Trym): before you've moved in, the mailbox offers ONE
    // thing — the catalog stays behind the canvas until the tent is up.
    const tabsRow = shopEl.querySelector('.hs-tabs');
    tabsRow.hidden = state.stage < 1;
    if (state.stage < 1) {
      const card = document.createElement('div');
      card.className = 'hs-up';
      card.innerHTML = '<div class="hs-uphead"><b>⛺ Pitch a tent</b>'
        + '<span class="hs-price">' + TENT_PRICE + ' ' + COIN + '</span></div>'
        + '<span>pick a colour — the decor catalog opens when you move in.</span>'
        + (coinBalance() < TENT_PRICE
          ? '<span class="hs-note">bananacoins come from playing — the rave, park and bay all pay</span>' : '');
      const getStyle = stylePicker(1, card);
      const btn = document.createElement('button');
      btn.className = 'hs-btn';
      btn.innerHTML = coinBalance() >= TENT_PRICE ? '⛺ pitch it' : 'need ' + TENT_PRICE + ' ' + COIN + ' — you have ' + coinBalance();
      btn.disabled = coinBalance() < TENT_PRICE;
      btn.addEventListener('click', () => {
        closeShop();
        startPlacingHome(getStyle(), { price: TENT_PRICE, toStage: 1 });
      });
      card.appendChild(btn);
      list.appendChild(card);
      return;
    }
    const tab = shopEl.dataset.tab || 'order';
    if (tab === 'home') return;   // the app grid is pure CSS state
    const full = state.items.length >= cap();
    if (tab === 'order') {
      // category chips — the catalog reads as SHELVES, not a corridor
      const cats = ['all', ...new Set(DECOR.map((d) => d.cat))];
      const curCat = shopEl.dataset.cat || 'all';
      catsRow.hidden = false;
      catsRow.replaceChildren();
      cats.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = c === 'all' ? 'All' : (CAT_LABELS[c] || c);
        b.setAttribute('aria-pressed', String(c === curCat));
        b.addEventListener('click', () => { shopEl.dataset.cat = c; renderShop(); });
        catsRow.appendChild(b);
      });
      if (full) {
        const p = document.createElement('p');
        p.className = 'hs-note';
        p.textContent = 'Your plot is full (' + cap() + ' spots) — pick something up to make space.';
        list.appendChild(p);
      }
      if (state.orders.length) {
        const ow = document.createElement('div');
        ow.className = 'hs-orders';
        state.orders.slice().sort((a, b) => a.at - b.at).forEach((o) => {
          const d = DEX[o.id];
          if (!d) return;
          const row = document.createElement('div');
          row.className = 'hs-order';
          const im2 = document.createElement('img');
          im2.src = d.img; im2.alt = '';
          const nm2 = document.createElement('b');
          nm2.textContent = d.name;
          const eta = document.createElement('em');
          eta.textContent = '🚚 ' + fmtShip(o.at - Date.now());
          row.append(im2, nm2, eta);
          ow.appendChild(row);
        });
        list.appendChild(ow);
      }
      const grid = document.createElement('div');
      grid.className = 'hs-grid';
      DECOR.filter((d) => curCat === 'all' || d.cat === curCat).forEach((d) => {
        grid.appendChild(shopTile(d, 'buy', () => {
          if (d.stage > state.stage || coinBalance() < d.price) return;
          passStat('coins_spent', d.price);
          refreshHud();
          track('homestead_buy', { id: d.id, price: d.price, ship: shipMin(d) });
          const mins = shipMin(d);
          if (mins) {
            state.orders.push({ id: d.id, at: Date.now() + mins * 60000 });
            save();
            shopNote('🚚 ordered — arrives in ' + fmtShip(mins * 60000));
          } else {
            state.shed.push({ id: d.id });
            save();
            shopNote('📦 ' + d.name + ' → your shed');
          }
          renderShop();   // stay in the store — batch shopping is the point
        }));
      });
      list.appendChild(grid);
    } else if (tab === 'shed') {
      if (!state.shed.length) {
        const p = document.createElement('p');
        p.className = 'hs-note';
        p.textContent = 'Nothing in the shed — mailbox orders land here, ready to place.';
        list.appendChild(p);
      }
      // duplicates STACK (Bush ×7, one tile); selling pays half, floor — the
      // buff can at most break even, and unpriced trophies are memories, not
      // merchandise (no sell button, never destroyed)
      const grid = document.createElement('div');
      grid.className = 'hs-grid';
      const counts = {};
      state.shed.forEach((s) => { if (DEX[s.id]) counts[s.id] = (counts[s.id] || 0) + 1; });
      Object.keys(counts).forEach((id) => {
        const d = DEX[id];
        const tile = shopTile(d, 'place', () => {
          if (state.items.length >= cap()) { toast('the plot is full'); return; }
          const i = state.shed.findIndex((s) => s.id === id);
          if (i < 0) return;
          state.shed.splice(i, 1);
          save();
          closeShop();
          startPlacing(d.id);
        });
        if (counts[id] > 1) {
          const n = document.createElement('span');
          n.className = 'hs-stackn';
          n.textContent = '×' + counts[id];
          tile.appendChild(n);
        }
        const sale = Math.floor((d.price || 0) / 2);
        if (sale > 0) {
          const sell = document.createElement('button');
          sell.className = 'hs-btn hs-btn--ghost';
          sell.innerHTML = 'sell · ' + sale + ' ' + COIN;
          sell.addEventListener('click', () => {
            const i = state.shed.findIndex((s) => s.id === id);
            if (i < 0) return;
            state.shed.splice(i, 1);
            passStat('coins_earned', sale);
            save();
            refreshHud();
            shopNote('💰 sold — +' + sale + ' coins');
            track('homestead_sell', { id: id, sale: sale });
            shopHead();
            renderShop();
          });
          tile.appendChild(sell);
        }
        grid.appendChild(tile);
      });
      list.appendChild(grid);
    } else {   // upgrades (stage ≥ 1 — the tent gate lives above)
      const card = document.createElement('div');
      card.className = 'hs-up';
      const next = STRUCT_LADDER[state.stage];   // stage 1 → roof, 2 → house
      let cta = null;
      if (next) {
        card.innerHTML = '<div class="hs-uphead"><b>' + next.icon + ' ' + next.name + '</b>'
          + '<span class="hs-price">' + next.price + ' ' + COIN + '</span></div>'
          + '<span>' + next.pitch + ' Your land grows, and ' + CAPS[state.stage + 1] + ' decor spots open up.</span>';
        const getStyle = stylePicker(state.stage + 1, card);
        cta = document.createElement('button');
        cta.className = 'hs-btn hs-upcta';
        cta.innerHTML = coinBalance() >= next.price ? next.icon + ' ' + next.name.toLowerCase()
          : 'need ' + next.price + ' ' + COIN + ' — you have ' + coinBalance();
        cta.disabled = coinBalance() < next.price;
        cta.addEventListener('click', () => {
          closeShop();
          startPlacingHome(getStyle(), { price: next.price, toStage: state.stage + 1 });
        });
      } else {
        card.innerHTML = '<div><b>🏠 Fully upgraded</b><span>The homestead stands complete — for now.</span></div>';
      }
      list.appendChild(card);
      // 🎨 THE WARDROBE — every rung you've earned stays wearable; a
      // stage-3 tent on a house-sized deed is a flex, not a downgrade
      const ward = document.createElement('div');
      ward.className = 'hs-up';
      ward.innerHTML = '<div class="hs-uphead"><b>🎨 Your look</b></div>'
        + '<span>Anything you’ve earned — restyling is free.</span>';
      const wgrid = document.createElement('div');
      wgrid.className = 'hs-stylepick';
      const worn = curStyleKey();
      for (let r = 1; r <= Math.min(state.stage, 3); r++) {
        (STRUCT_STYLES[r] || []).forEach((k) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'hs-stylebtn';
          b.innerHTML = '<img src="/assets/homestead/ov-' + k + '.png" alt="" loading="lazy">';
          b.setAttribute('aria-pressed', String(k === worn));
          b.addEventListener('click', () => {
            if (k === curStyleKey()) return;
            closeShop();
            startPlacingHome(k, { look: true });
          });
          wgrid.appendChild(b);
        });
      }
      ward.appendChild(wgrid);
      list.appendChild(ward);
      if (cta) list.appendChild(cta);
    }
  }
  let pnTimer = null;
  function phoneNote(text) {
    const n = document.getElementById('hsPhoneNote');
    if (!n) return;
    n.textContent = text;
    n.classList.add('is-on');
    clearTimeout(pnTimer);
    pnTimer = setTimeout(() => n.classList.remove('is-on'), 2300);
  }
  const shopNote = (t, ms) => { if (shopEl.hidden) toast(t, ms); else phoneNote(t); };
  const SHOP_HEADS = {
    home: ['🍌 Banana Phone', ''],
    order: ['🛒 Order online', 'The van delivers to your mailbox.'],
    shed: ['📦 Your shed', 'Ready to place in 🔨 build mode.'],
    up: ['⛺ Upgrades', ''],
  };
  function shopHead() {
    const hd = SHOP_HEADS[shopEl.dataset.tab] || SHOP_HEADS.order;
    document.getElementById('hsShopTitle').textContent = hd[0];
    const p = document.getElementById('hsShopLead');
    if (p) p.textContent = hd[1];
    const xb = document.getElementById('hsShopClose');
    if (xb) xb.textContent = (shopEl.dataset.tab === 'home' || state.stage < 1) ? '✕' : '←';
    const bd = document.getElementById('hsShedBadge');
    if (bd) {
      const n = (state.shed || []).length;
      bd.hidden = !n;
      bd.textContent = n > 9 ? '9+' : n;
    }
  }
  function openShop(tab, remote) {
    if (state.stage < 1) tab = 'order';   // tent-first: straight to the one offer
    if (tab) shopEl.dataset.tab = tab;
    shopHead();
    shopEl.hidden = false;
    syncLock();
    renderShop();
    track('homestead_phone', { tab: shopEl.dataset.tab });
  }
  function closeShop() { shopEl.hidden = true; syncLock(); }
  shopEl.addEventListener('click', (e) => {
    if (e.target === shopEl) closeShop();
    const t = e.target.closest('[data-tab]');
    if (t && t.tagName === 'BUTTON') {
      shopEl.dataset.tab = t.dataset.tab;
      shopHead();
      renderShop();
    }
  });
  document.getElementById('hsShopClose').addEventListener('click', () => {
    if (state.stage >= 1 && shopEl.dataset.tab !== 'home') {
      shopEl.dataset.tab = 'home';
      shopHead();
      return;
    }
    closeShop();
  });
  document.getElementById('hsPhoneHome').addEventListener('click', () => {
    if (state.stage < 1) return;   // no home screen before the tent
    shopEl.dataset.tab = 'home';
    shopHead();
  });

  // ---- 🪴 placing: the ghost + the confirm bar -----------------------------
  const snap = (v) => Math.round(v / 24) * 24;
  function spotOk(d, x, y) {
    const P = plotNow();
    if (x - d.w / 2 < P[0] || x + d.w / 2 > P[2]) return false;
    if (x < P[0] + 10 || x > P[2] - 10 || y < P[1] + 24 || y > P[3] - 6) return false;
    for (const c of state.soil) {
      if (x > c.i * 48 - 14 && x < c.i * 48 + 62 && y > c.j * 48 - 8 && y < c.j * 48 + 56) return false;
    }
    // keep clear of the structure's FOOTPRINT only — the front yard below the
    // porch stays decoratable (the max stress test caught the old box banning it)
    const sd = structDims();
    if (state.stage >= 1 && Math.abs(x - state.home.x) < sd.w * 0.52 + d.w * 0.3
      && y > state.home.y - sd.h * 0.62 && y < state.home.y + 12) return false;
    if (Math.hypot(x - state.mailAt.x, y - state.mailAt.y) < 50) return false;
    if (Math.hypot(x - state.signAt.x, y - state.signAt.y) < 40) return false;
    for (const c of state.fence) {
      if (x > c.i * 48 - 14 && x < c.i * 48 + 62 && y > c.j * 48 - 8 && y < c.j * 48 + 56) return false;
    }
    for (const it of state.items) {
      if (placing && placing.moving === it) continue;
      const o = DEX[it.id];
      if (Math.abs(x - it.x) < (d.w + o.w) * 0.32 && Math.abs(y - it.y) < 34) return false;
    }
    return true;
  }
  function startPlacing(id, moving) {
    exitPlanner();
    cancelPlacing();
    const d = DEX[id];
    const P = plotNow();
    const x = snap(moving ? moving.x : Math.max(P[0] + 60, Math.min(P[2] - 60, pos.x)));
    const y = snap(moving ? moving.y : Math.max(P[1] + 60, Math.min(P[3] - 30, pos.y)));
    placing = { id, x, y, el: itemDiv({ id, x, y }, true), moving: moving || null };
    camFree = { x, y };   // one glide to the ghost — after this, only drags pan
    if (moving) { refreshItems(); }   // the original disappears while it moves
    view.classList.add('is-placing');   // touch drags steer the camera, not the page
    updateGhost();
    confirmEl.hidden = false;
    hint(false);
    toast('drag to look around · tap to try a spot — then ✓', 3600);
  }
  // 🏠 placing the STRUCTURE itself (buy or move): same gestures, its own
  // validity, and anything under the confirmed footprint sweeps to the shed.
  const FIXD = { mail: { w: MAILBOX.w, h: MAILBOX.h }, sign: { w: SIGN.w, h: SIGN.h } };
  const FIX_BOUNDS = [320, 270, 1400, 878];   // fixtures may live off-plot, by the road
  const fixDims = () => FIXD[placing.key] || STRUCTS[placing.key];
  function homeOk(x, y) {
    const d = fixDims();
    const P = FIXD[placing.key] ? FIX_BOUNDS : placeBounds();
    if (x - d.w / 2 < P[0] - 2 || x + d.w / 2 > P[2] + 2) return false;
    if (y - d.h < P[1] - 44 || y > P[3] - 8) return false;
    for (const c of state.fence) {
      if (x > c.i * 48 - 26 && x < c.i * 48 + 74 && y > c.j * 48 - 12 && y < c.j * 48 + 60) return false;
    }
    const foot = [x - d.w * 0.52, y - d.h * 0.62, x + d.w * 0.52, y + 12];
    for (const c of state.soil) {   // structures keep off the dug soil
      if (foot[0] < (c.i + 1) * 48 && foot[2] > c.i * 48 && foot[1] < (c.j + 1) * 48 && foot[3] > c.j * 48) return false;
    }
    return true;
  }
  function startPlacingHome(key, opts) {
    exitPlanner();
    cancelPlacing();
    const d = FIXD[key] || STRUCTS[key];
    const el = document.createElement('div');
    el.className = 'hs-it hs-it--ghost';
    el.style.width = pct(d.w, W);
    el.style.height = pct(d.h, H);
    el.style.backgroundImage = "url('/assets/homestead/" + (FIXD[key] ? 'm-' + key : 'ov-' + key) + ".png')";
    world.appendChild(el);
    const from = key === 'mail' ? state.mailAt : key === 'sign' ? state.signAt : state.home;
    placing = { home: true, key, x: from.x, y: from.y, el,
      price: (opts && opts.price) || 0, toStage: (opts && opts.toStage) || 0,
      look: !!(opts && opts.look) };
    camFree = { x: placing.x, y: placing.y };
    view.classList.add('is-placing');
    updateGhost();
    confirmEl.hidden = false;
    hint(false);
    toast(placing.toStage > state.stage
      ? 'your land grows with it — place it anywhere on the new deed'
      : 'choose where it stands — drag to look, tap to try', 3600);
  }
  function confirmHome() {
    const d = fixDims();
    const x = placing.x, y = placing.y;
    // the sweep: items under the new footprint go safely to the shed
    const foot = [x - d.w * 0.52, y - d.h * 0.62, x + d.w * 0.52, y + 12];
    const kept = [], swept = [];
    state.items.forEach((it) => {
      (it.x > foot[0] && it.x < foot[2] && it.y > foot[1] && it.y < foot[3] ? swept : kept).push(it);
    });
    if (swept.length) {
      state.items = kept;
      swept.forEach((it) => state.shed.push({ id: it.id }));
      toast('🧰 ' + swept.length + ' thing' + (swept.length > 1 ? 's' : '') + ' moved to the shed to make room');
    }
    const key = placing.key;
    if (FIXD[key]) {   // 📬🪧 a fixture found its new spot
      state[key === 'mail' ? 'mailAt' : 'signAt'] = { x, y };
      placing.el.remove();
      placing = null;
      confirmEl.hidden = true;
      camFree = null;
      view.classList.remove('is-placing');
      save();
      refreshFixtures(); rebuildSolids();
      float(x, y - 40, '✓');
      track('homestead_move_fixture', { id: key });
      return;
    }
    if (placing.toStage) {   // this placement completes an UPGRADE
      passStat('coins_spent', placing.price);
      state.stage = placing.toStage;
      state.style = state.style || {};
      state.style[placing.toStage] = placing.key;
      state.look = '';   // a new roof is worn the day it lands
      const rung = STRUCT_LADDER[placing.toStage - 1];
      track('homestead_upgrade', { to: placing.key });
      if (!swept.length) toast(rung.icon + ' ' + rung.name.toLowerCase() + ' — done');
    } else if (placing.look) {   // 🎨 the wardrobe, not the ladder
      state.look = placing.key;
      track('homestead_restyle', { key: placing.key });
      if (!swept.length) toast('🎨 new look — the neighbours will notice');
    } else {
      track('homestead_move_home');
    }
    state.home = { x, y };
    placing.el.remove();
    placing = null;
    confirmEl.hidden = true;
    camFree = null;
    view.classList.remove('is-placing');
    save();
    const grew = fenceTier() !== tierWas;
    tierWas = fenceTier();
    refreshTent(); refreshSoil(); rebuildSolids(); refreshItems(); refreshHud();
    float(x, y - STRUCTS[key].h - 8, '✓');
    if (grew) setTimeout(() => toast('🌱 your land grew — more room to build, dig and decorate'), 1400);
  }
  // the sign's move button lives in the guestbook; the mailbox offers its
  // own chip on tap (the phone replaced the shop-panel button)
  document.getElementById('hsSignMove').addEventListener('click', () => {
    if (visiting) return;
    guestEl.hidden = true;
    syncLock();
    startPlacingHome('sign', {});
  });

  function updateGhost() {
    if (!placing) return;
    if (placing.home) {
      const d = fixDims();
      placing.el.style.left = pct(placing.x - d.w / 2, W);
      placing.el.style.top = pct(placing.y - d.h, H);
      depth(placing.el, placing.y);
      const ok = homeOk(placing.x, placing.y);
      placing.el.classList.toggle('is-bad', !ok);
      document.getElementById('hsPlaceGo').disabled = !ok;
      return;
    }
    const d = DEX[placing.id];
    placing.el.style.left = pct(placing.x - d.w / 2, W);
    placing.el.style.top = pct(placing.y - d.h, H);
    depth(placing.el, placing.y);
    const ok = spotOk(d, placing.x, placing.y);
    placing.el.classList.toggle('is-bad', !ok);
    document.getElementById('hsPlaceGo').disabled = !ok;
  }
  function cancelPlacing() {
    if (!placing) return;
    view.classList.remove('is-placing');
    camFree = null;
    placing.el.remove();
    if (placing.home) {   // an upgrade not yet paid for simply doesn't happen
      const wasUpgrade = !!placing.toStage;
      placing = null;
      confirmEl.hidden = true;
      if (wasUpgrade) toast('no rush — the offer stays at the mailbox');
      return;
    }
    if (placing.moving) state.items.push(placing.moving);   // it never left
    const wasBuy = !placing.moving;
    const backId = placing.id;
    placing = null;
    confirmEl.hidden = true;
    if (wasBuy) { state.shed.push({ id: backId }); save(); toast('into the shed — place it any time'); }
    refreshItems();
  }
  document.getElementById('hsPlaceGo').addEventListener('click', () => {
    if (!placing) return;
    if (placing.home) { confirmHome(); return; }
    view.classList.remove('is-placing');
    camFree = null;
    const it = { id: placing.id, x: placing.x, y: placing.y };
    placing.el.remove();
    const moved = !!placing.moving;
    placing = null;
    confirmEl.hidden = true;
    state.items.push(it);
    save();
    refreshItems();
    float(it.x, it.y - (DEX[it.id].h || 30) - 6, '✓');
    track(moved ? 'homestead_move' : 'homestead_place', { id: it.id });
  });
  document.getElementById('hsPlaceNo').addEventListener('click', cancelPlacing);

  // an existing item, tapped: move it or put it away
  let itChip = null;
  function itemChip(idx) {
    clearChip();
    const it = state.items[idx];
    const d = DEX[it.id];
    itChip = document.createElement('div');
    itChip.className = 'hs-chip';
    const mv = document.createElement('button');
    mv.className = 'hs-btn'; mv.textContent = '✥ move';
    const rm = document.createElement('button');
    rm.className = 'hs-btn hs-btn--ghost'; rm.textContent = '📦 put away';
    mv.addEventListener('click', () => {
      const moving = state.items.splice(idx, 1)[0];
      clearChip();
      startPlacing(moving.id, moving);
    });
    rm.addEventListener('click', () => {
      const gone = state.items.splice(idx, 1)[0];
      state.shed.push({ id: gone.id });
      save();
      clearChip();
      refreshItems();
      float(it.x, it.y - 40, '📦');
      track('homestead_pickup', { id: gone.id });
    });
    itChip.append(mv, rm);
    itChip.style.left = pct(it.x, W);
    itChip.style.top = pct(it.y - d.h - 14, H);
    itChip.style.zIndex = '3000';
    world.appendChild(itChip);
  }
  function clearChip() { if (itChip) { itChip.remove(); itChip = null; } }

  // the bed, tapped: plant / water / harvest
  let bedChip = null;
  function clearBedChip() { if (bedChip) { bedChip.remove(); bedChip = null; } }
  // 💧 the neighbour verb: water THEIR beds — once per yard per day, kindness
  // lands as +1 growth day in the owner's away-news
  function visitorWater() {
    const wkey = 'hs-wd:' + state.slug;
    let mine = '';
    try { mine = localStorage.getItem(wkey) || ''; } catch (e) {}
    if (state.wtoday || mine === dayStr()) { toast('these beds are watered for today 💧'); return; }
    if (!state.soil.some((c) => c.crop && cropStage(c) < 4)) { toast('nothing growing right now'); return; }
    yFetch('/water', { slug: state.slug, name: myName }).then((r) => {
      try { localStorage.setItem(wkey, dayStr()); } catch (e) {}
      state.wtoday = true;
      if (r.already) { toast('someone beat you to the watering can today'); return; }
      state.soil.forEach((c) => {
        if (c.crop && cropStage(c) < 4) float(cellCx(c), cellBase(c) - 44, '💧');
      });
      toast('💧 you watered ' + state.name + ' — it counts overnight');
      track('homestead_neighbor_water');
    }).catch(() => toast('the watering can is empty — try again in a bit'));
  }

  function cellTap(cell) {
    clearBedChip();
    if (visiting) { visitorWater(); return; }
    const s = [cellCx(cell), cellBase(cell) - 16];
    const b = cell.crop ? cell : null;
    if (!b) {
      bedChip = document.createElement('div');
      bedChip.className = 'hs-chip';
      // 🌱 seeds are POCKETED AT THE PARK (crop harvests there), spent here
      let anySeeds = false;
      CROPS.forEach((c) => {
        const n = seedCount(c.id);
        anySeeds = anySeeds || n > 0;
        const btn = document.createElement('button');
        btn.className = 'hs-btn';
        btn.innerHTML = (CROP_EMO[c.id] || '') + ' ' + c.name + ' · 🌱×' + n;
        btn.disabled = !n;
        btn.addEventListener('click', () => {
          if (!seedCount(c.id)) return;
          seedUse(c.id);
          cell.crop = c.id; cell.waters = 0; cell.last = ''; cell.planted = dayStr();
          save(); refreshSoil(); clearBedChip();
          float(s[0], s[1] - 44, '🌱');
          track('homestead_plant', { crop: c.id });
        });
        bedChip.appendChild(btn);
      });
      if (!anySeeds) toast('no seeds in the pouch — harvest crops in the park garden 🌱', 3600);
      bedChip.style.left = pct(s[0], W);
      bedChip.style.top = pct(s[1] - 52, H);
      bedChip.style.zIndex = '3000';
      world.appendChild(bedChip);
      return;
    }
    if (cropStage(b) >= 4) {
      // 🧺 harvests fill the PANTRY, not the wallet — the kitchen is the value
      state.pantry[b.crop] = (state.pantry[b.crop] || 0) + 1;
      delete cell.crop; delete cell.waters; delete cell.last; delete cell.planted;
      save(); refreshSoil();
      float(s[0], s[1] - 46, '+1 ' + (CROP_EMO[b.crop] || '🧺'));
      track('homestead_harvest', { crop: b.crop });
      if (state.stage < 2) toast('into the pantry — a real roof comes with a stove 🍳', 2800);
      return;
    }
    if (b.last === dayStr()) { float(s[0], s[1] - 44, '💤 tomorrow'); return; }
    b.last = dayStr();
    b.waters = (b.waters | 0) + 1;
    save(); refreshSoil();
    float(s[0], s[1] - 44, '💧');
    track('homestead_water', { crop: b.crop });
  }

  // 🖐 placing gestures: DRAG pans the camera, TAP tries the spot. Never both
  // from one action — the pan threshold decides which one this gesture was.
  let gest = null, justPanned = false;   // { x0, y0, cam0x, cam0y, panning }
  function ghostTo(e) {
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    if (placing.home) {
      const d = fixDims();
      const P = FIXD[placing.key] ? FIX_BOUNDS : placeBounds();   // fixtures may sit by the road
      placing.x = snap(Math.max(P[0] + d.w / 2, Math.min(P[2] - d.w / 2, wx)));
      placing.y = snap(Math.max(P[1] + Math.min(d.h * 0.5, 120), Math.min(P[3] - 10, wy)));
    } else {
      const P = plotNow();
      placing.x = snap(Math.max(P[0] + 12, Math.min(P[2] - 12, wx)));
      placing.y = snap(Math.max(P[1] + 26, Math.min(P[3] - 8, wy)));
    }
    updateGhost();
  }
  view.addEventListener('pointerdown', (e) => {
    if ((!placing && !digging && !fencing) || panelOpen()) return;
    if (e.target.closest('.wh') || e.target.closest('.hs-actions') || e.target.closest('.hs-confirm')) return;
    gest = { x0: e.clientX, y0: e.clientY, cam0x: camFree.x, cam0y: camFree.y, panning: false };
  });
  view.addEventListener('pointermove', (e) => {
    if (!gest || (!placing && !digging && !fencing)) return;
    const dx = e.clientX - gest.x0, dy = e.clientY - gest.y0;
    if (!gest.panning && Math.hypot(dx, dy) < 9) return;   // still a tap so far
    gest.panning = true;
    // the world follows the finger: drag left = look right
    camFree.x = Math.max(0, Math.min(W, gest.cam0x - dx / scale));
    camFree.y = Math.max(0, Math.min(H, gest.cam0y - dy / scale));
  });
  addEventListener('pointerup', (e) => {
    if (gest && placing && !gest.panning) ghostTo(e);   // a clean tap places
    justPanned = !!(gest && gest.panning);   // a pan must never ALSO act
    gest = null;
  });

  // ---- taps ---------------------------------------------------------------
  view.addEventListener('click', (e) => {
    if (e.target.closest('.wh') || e.target.closest('.hs-actions') || e.target.closest('.hs-chip')
      || e.target.closest('.hs-confirm')) return;
    if (panelOpen()) return;
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    hint(false);
    clearChip(); clearBedChip();
    if (placing) return;   // pointerdown/drag owns the ghost
    if (inside) {          // indoors: the stove answers, everything else walks
      const I = INTERIORS[inside];
      if (I.kitchen && wx > I.kitchen[0] && wx < I.kitchen[2] && wy > I.kitchen[1] && wy < I.kitchen[3]) {
        if (Math.hypot(pos.x - wx, pos.y - wy) < 170) { openCook(); return; }
      }
      tgt.x = wx; tgt.y = wy;
      return;
    }
    // ✋ a camera pan must never also act — the doctrine's other half
    if (justPanned) { justPanned = false; return; }
    // 🧹 clear mode: one demolish tool — decor → shed, fence down, soil filled
    if (clearing && !visiting) {
      for (let k = state.items.length - 1; k >= 0; k--) {
        const it = state.items[k];
        const d = DEX[it.id];
        if (d && Math.abs(wx - it.x) < Math.max(24, d.w / 2) && wy > it.y - d.h - 8 && wy < it.y + 10) {
          state.items.splice(k, 1);
          state.shed.push({ id: it.id });
          save(); refreshItems();
          float(it.x, it.y - 40, '📦');
          track('homestead_pickup', { id: it.id, via: 'planner' });
          return;
        }
      }
      const fi = Math.floor(wx / 48), fj = Math.floor(wy / 48);
      const fc = state.fence.find((s2) => s2.i === fi && s2.j === fj);
      if (fc) {
        state.fence = state.fence.filter((s2) => s2 !== fc);
        save(); refreshFenceB(); rebuildSolids();
        float(fi * 48 + 24, fj * 48 + 28, '🪵');
        return;
      }
      const sc = state.soil.find((s2) => s2.i === fi && s2.j === fj);
      if (sc) {
        if (sc.crop) { toast('something grows here — harvest it first'); return; }
        state.soil = state.soil.filter((s2) => s2 !== sc);
        save(); refreshSoil();
        float(fi * 48 + 24, fj * 48 + 28, '🌿');
        return;
      }
      return;
    }
    // 🪵 fence mode: tap = raise a piece, tap a piece = take it down
    if (fencing && !visiting) {
      const i = Math.floor(wx / 48), j = Math.floor(wy / 48);
      const F = FENCE_TIERS[fenceTier()].fence;
      const cx = i * 48 + 24, cb = j * 48 + 48;
      if (i * 48 < F[0] || (i + 1) * 48 > F[2] || j * 48 < F[1] || (j + 1) * 48 > F[3]) {
        toast('that’s outside your land — the lit grid is yours');
        return;
      }
      const c = state.fence.find((s2) => s2.i === i && s2.j === j);
      if (c) {
        state.fence = state.fence.filter((s2) => s2 !== c);
        float(cx, cb - 24, '🪵');
      } else {
        if (state.fence.length >= FENCE_CAP) { toast(FENCE_CAP + ' pieces is the whole lumber yard'); return; }
        if (state.soil.some((s2) => s2.i === i && s2.j === j)) { toast('that ground is tilled — fill it first'); return; }
        const sd = structDims();
        if (state.stage >= 1 && cx > state.home.x - sd.w * 0.52 - 20 && cx < state.home.x + sd.w * 0.52 + 20
          && cb > state.home.y - sd.h * 0.62 && cb < state.home.y + 30) { toast('not through the house'); return; }
        if (Math.hypot(cx - state.mailAt.x, cb - state.mailAt.y) < 60
          || Math.hypot(cx - state.signAt.x, cb - state.signAt.y) < 60) { toast('not on the mailbox or sign'); return; }
        state.fence.push({ i, j });
        float(cx, cb - 24, '🔨');
        track('homestead_fence', { n: state.fence.length });
      }
      save(); refreshFenceB(); rebuildSolids();
      return;
    }
    // 🪏 dig mode: tap lawn = till a cell, tap empty soil = fill it back
    if (digging && !visiting) {
      const i = Math.floor(wx / 48), j = Math.floor(wy / 48);
      const P = FENCE_TIERS[fenceTier()].fence;   // the SAME rect the grid lights
      const cx = i * 48 + 24, cb = j * 48 + 48;
      if (i * 48 < P[0] || (i + 1) * 48 > P[2] || j * 48 < P[1] || (j + 1) * 48 > P[3]) {
        toast('that’s outside your land — the lit grid is yours');
        return;
      }
      const c = state.soil.find((s2) => s2.i === i && s2.j === j);
      if (c) {
        if (c.crop) { toast('something grows here — harvest it first'); return; }
        state.soil = state.soil.filter((s2) => s2 !== c);
        float(cx, cb - 20, '🌿');
      } else {
        if (state.soil.length >= SOIL_CAP) { toast('that’s ' + SOIL_CAP + ' patches — a farm already'); return; }
        if (fenceHas(i, j)) { toast('there’s a fence there'); return; }
        const sd = structDims();
        if (state.stage >= 1 && cx > state.home.x - sd.w * 0.52 - 20 && cx < state.home.x + sd.w * 0.52 + 20
          && cb > state.home.y - sd.h * 0.62 && cb < state.home.y + 30) { toast('not under the house'); return; }
        state.soil.push({ i, j });
        float(cx, cb - 20, '⛏️');
        track('homestead_dig', { n: state.soil.length });
      }
      save(); refreshSoil();
      return;
    }
    // the mailbox: near = open, far = walk to it
    if (Math.hypot(wx - state.mailAt.x, wy - (state.mailAt.y - 20)) < 46) {
      if (Math.hypot(pos.x - state.mailAt.x, pos.y - state.mailAt.y) < 110) {
        if (visiting) { toast('📬 answers only to ' + state.name); return; }
        checkOrders();
        const nxt = state.orders.slice().sort((a, b) => a.at - b.at)[0];
        toast(nxt
          ? '🚚 ' + state.orders.length + ' on the way — next in ' + fmtShip(nxt.at - Date.now())
          : '📭 nothing on the way — order from your 🍌 phone');
        clearChip();
        itChip = document.createElement('div');
        itChip.className = 'hs-chip';
        const mv2 = document.createElement('button');
        mv2.className = 'hs-btn';
        mv2.textContent = '✥ move it';
        mv2.addEventListener('click', () => { clearChip(); startPlacingHome('mail', {}); });
        itChip.append(mv2);
        itChip.style.left = pct(state.mailAt.x, W);
        itChip.style.top = pct(state.mailAt.y - MAILBOX.h - 12, H);
        itChip.style.zIndex = '3000';
        world.appendChild(itChip);
        return;
      }
      tgt.x = state.mailAt.x - 40; tgt.y = state.mailAt.y + 16;
      return;
    }
    // 🪧 the sign: near = the guestbook, far = walk to it
    if (Math.hypot(wx - state.signAt.x, wy - (state.signAt.y - 30)) < 56) {
      if (Math.hypot(pos.x - state.signAt.x, pos.y - state.signAt.y) < 130) { openGuest(); return; }
      tgt.x = state.signAt.x - 44; tgt.y = state.signAt.y + 6;
      return;
    }
    // the tent spot (stage 0): near = the upgrades tab, far = walk over
    if (!visiting && state.stage < 1 && Math.abs(wx - state.home.x) < 76 && wy > state.home.y - 84 && wy < state.home.y + 8) {
      if (Math.hypot(pos.x - state.home.x, pos.y - state.home.y) < 150) { openShop('up'); return; }
      tgt.x = state.home.x; tgt.y = state.home.y + 40;
      return;
    }
    // a soil cell: plant / water / harvest (visitors: water)
    {
      const c = cellAt(wx, wy);
      if (c) {
        if (Math.hypot(pos.x - cellCx(c), pos.y - cellBase(c)) < 130) cellTap(c);
        else { tgt.x = cellCx(c); tgt.y = cellBase(c) + 10; }
        return;
      }
    }
    // the structure: near = offer the move, far = walk over
    if (state.stage >= 1) {
      const sd = structDims();
      if (Math.abs(wx - state.home.x) < sd.w / 2 && wy > state.home.y - sd.h && wy < state.home.y + 8) {
        if (Math.hypot(pos.x - state.home.x, pos.y - state.home.y) < sd.w / 2 + 90) {
          if (visiting) return;   // their house is not furniture
          clearChip();
          itChip = document.createElement('div');
          itChip.className = 'hs-chip';
          const mv = document.createElement('button');
          mv.className = 'hs-btn';
          mv.textContent = '✥ move it';
          mv.addEventListener('click', () => { clearChip(); startPlacingHome(curStyleKey(), {}); });
          itChip.append(mv);
          // 🍳 cooking lives INSIDE now — tap the kitchen counters
          if (INTERIORS[homeTier()]) {   // 🚪 every home has a door — even the tent
            const go = document.createElement('button');
            go.className = 'hs-btn';
            go.textContent = '🚪 step inside';
            go.addEventListener('click', () => { clearChip(); enterHome(); });
            itChip.prepend(go);
          }
          itChip.style.left = pct(state.home.x, W);
          itChip.style.top = pct(state.home.y - sd.h - 12, H);
          itChip.style.zIndex = '3000';
          world.appendChild(itChip);
        } else { tgt.x = state.home.x; tgt.y = state.home.y + 30; }
        return;
      }
    }
    // a placed item
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      const d = DEX[it.id];
      if (Math.abs(wx - it.x) < Math.max(24, d.w / 2) && wy > it.y - d.h - 8 && wy < it.y + 10) {
        if (visiting) { tgt.x = it.x; tgt.y = it.y + 30; return; }   // look, don't touch
        if (Math.hypot(pos.x - it.x, pos.y - it.y) < 150) itemChip(i);
        else { tgt.x = it.x; tgt.y = it.y + 30; }
        return;
      }
    }
    tgt.x = wx; tgt.y = wy;
  });

  // ---- the banana ---------------------------------------------------------
  const frameNow = () => {
    const cyc = BASE_CYCLE_S * 1000;
    return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES;
  };
  let lastF = -1;
  function drawMe() {
    const f = frameNow();
    if (f === lastF) return;
    lastF = f;
    drawComposite(meCtx, 150, f, { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
  }

  // ---- the loop -----------------------------------------------------------
  const FRAME_MS = 12;
  let last = 0, gateAt = 0, meWX = NaN, meWY = NaN;
  let seen = true;
  new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; },
    { threshold: 0 }).observe(view);
  function step(now) {
    requestAnimationFrame(step);
    if (now - gateAt < FRAME_MS) return;
    gateAt = now;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!seen || document.hidden) return;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (kx || ky) { tgt.x = pos.x + kx * 30; tgt.y = pos.y + ky * 30; hint(false); }
    const dx = tgt.x - pos.x, dy = tgt.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5) {
      const m = Math.min(d, SPEED * dt);
      const nx = pos.x + (dx / d) * m, ny = pos.y + (dy / d) * m;
      if (!blocked(nx, ny)) { pos.x = nx; pos.y = ny; }
      else if (!blocked(nx, pos.y)) pos.x = nx;
      else if (!blocked(pos.x, ny)) pos.y = ny;
      else {
        const p1x = pos.x + (dy / d) * m, p1y = pos.y - (dx / d) * m;
        const p2x = pos.x - (dy / d) * m, p2y = pos.y + (dx / d) * m;
        if (!blocked(p1x, p1y)) { pos.x = p1x; pos.y = p1y; }
        else if (!blocked(p2x, p2y)) { pos.x = p2x; pos.y = p2y; }
        else { tgt.x = pos.x; tgt.y = pos.y; }
      }
      pos.x = Math.max(12, Math.min(W - 12, pos.x));
      pos.y = Math.max(12, Math.min(H - 12, pos.y));
    }
    if (pos.x !== meWX || pos.y !== meWY) {
      meWX = pos.x; meWY = pos.y;
      place(meEl, pos.x, pos.y, ME_ANCHOR);
      meEl.style.zIndex = String((inside ? IN_Z : 100) + Math.round(pos.y));
    }
    if (inside) {
      const I = INTERIORS[inside];
      if (inRect(pos.x, pos.y, I.exit)) { exitHome(); return; }
    }
    // stepping INTO the yard (through the south gate) triggers the claim
    const F1 = FENCE_TIERS[1].fence;
    if (!state.claimedAt && pos.x > F1[0] && pos.x < F1[2] && pos.y > F1[1] && pos.y < F1[3] - 26) offerClaim();
    drawMe();
    doorTick();
    birdTick(now, dt);
    cam();
  }
  assetsReady().then(() => {
    drawMe();
    place(meEl, pos.x, pos.y, ME_ANCHOR);
    depth(meEl, pos.y);
    requestAnimationFrame((t) => { last = t; step(t); });
  });
}

// visiting: fetch the neighbour's yard BEFORE the scene builds; your own slug
// in the URL just means "home" (shared links open your yard as theirs to see)
async function boot() {
  let doc = null, miss = false;
  if (VISIT_SLUG) {
    const mine = loadState();
    if (mine.slug !== VISIT_SLUG) {
      try { doc = visitState(await yFetch('/yard?slug=' + VISIT_SLUG)); }
      catch (e) { miss = true; }
    }
  }
  init(doc, miss);
}
if (view) boot();
