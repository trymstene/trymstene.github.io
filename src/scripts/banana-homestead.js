// 🏡 THE HOMESTEAD — your own clearing west of the park (task #106, M0).
//
// The world's first PERSONAL space: claim the plot, name it, buy decor at the
// mailbox, place it anywhere on your lawn (three verbs: place / move / put
// away), pitch the tent, grow the bed. M0 state is device-local (hs-v1);
// the YardRoom DO + slugs arrive with visiting (M1) — the shape below is
// already the DO's document so nothing migrates.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { passStat, buffGet, buffSet, seedCount, seedUse } from '../lib/banana-pass.js';
import { catCustom, loadCatalog, fullOutfit } from '../lib/drops.js';
import { wearToCustom } from '../lib/wear-render.js';
import { mountHud, coinBalance } from '../lib/world-hud.js';
import { initTravel } from './world-travel.js';
import { initWorldTutorial, initTutorialInvite } from './world-tutorial.js';
import { askName } from '../lib/banana-id.js';
import { worldOwner, worldSid, presenceRoom, poofInto } from '../lib/world.js';
import { WORLD, BOUND, ROAD, GATE, FENCE_TIERS, TENT, STRUCTS, STRUCT_STYLES,
  MAILBOX, SIGN, SIGNS, OB_RECTS, OVERLAYS, BIRDS, INTERIORS } from './homestead-geo.js';
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
  { key: 'cabin', price: 300, name: 'Get a real roof', icon: '🛖',
    pitch: 'a mobile home, a barn — your call. The plot grows and the fancier catalog unlocks.' },
  { key: 'house', price: 900, name: 'Build the house', icon: '🏠',
    pitch: 'country, villa, haunted, city — the full homestead, the grandest catalog.' },
];
const STYLE_DEFAULTS = { 1: 'tent1', 2: 'mobm3', 3: 'country' };
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
  if (!s.inItems || typeof s.inItems !== 'object' || Array.isArray(s.inItems)) s.inItems = {};
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
    ['statue', 'coop', 'shelf', 'benchv', 'armchair', 'chair', 'bush2', 'flowerbush2'].forEach((id, i) => put2(id, 990 + (i % 3) * 100, 420 + Math.floor(i / 3) * 78));
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
  let digging = false, fencing = false, clearing = false, arranging = false,
    planner = false, hovEl = null, planEls = null;
  let doorTgt = null;   // 🚪 walk-to-the-door intent: arriving steps inside
  let sitting = null;   // 🪑 parked on a chair/couch: frame locks, any move stands up

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
    if (planner) {   // 🔨 build mode: frame the WHOLE clearing (max deed), not the
      // current tier — fit-to-deed made tier 1 and tier 3 fill the same screen,
      // so upgrades didn't LOOK bigger (Trym's "my area didnt expand?")
      const F = FENCE_TIERS[3].fence;
      const dw = F[2] - F[0] + 120, dh = F[3] - F[1] + 120;
      // 📱 PORTRAIT ZOOMS IN AND PANS SIDEWAYS (Trym's call, 8 Aug: "very small
      // and doesnt utilize the whole screen"). The deed is 1344x576 — 2.33:1 —
      // and a phone view is 0.58:1, so CONTAIN binds on width and draws the plot
      // 132px tall inside 580px: 23% used, 77% dead. Fitting the HEIGHT instead
      // fills the screen and spends the leftover width on a sideways pan.
      // Sideways is also the only safe axis on a phone: a vertical drag would
      // compete with the page scroll (the view sets touch-action:none while
      // building, but the gesture still reads as "the page should move").
      scale = viewW < viewH
        ? Math.min(1.2, viewH / dh)
        : Math.min(1.2, viewW / dw, viewH / dh);
    }
    world.style.width = (W * scale) + 'px';
    world.style.height = (H * scale) + 'px';
    replaceMovers();
  }
  addEventListener('resize', layout);
  layout();
  // 🪴 while a TOOL is up the camera is FREE: it glides to the ghost once at the
  // start, then only DRAGS move it — a moving object must never yank the view
  // around (Trym: "alot of camera jumping"). Tap = try the spot, drag = look
  // around; two gestures, two jobs.
  //
  // ⚠️ ONE PREDICATE, because this list and the pointer handlers' list MUST
  // agree. They drifted: `clearing` and `arranging` were added to the gesture
  // handlers and not here, so with the clear or move tool up your drag did
  // update camFree — the camera just ignored it and stayed locked on the
  // banana (Trym, 8 Aug: "the camera jumps to my banana and i cant swipe to
  // where i want, my view is locked"). Any future tool is covered by adding it
  // to `toolUp` alone.
  const toolUp = () => placing || digging || fencing || clearing || arranging;
  function camTarget() {
    const foc = (toolUp() && camFree) ? camFree : pos;
    return {
      x: Math.max(0, Math.min(Math.max(0, W * scale - viewW), foc.x * scale - viewW / 2)),
      y: Math.max(0, Math.min(Math.max(0, H * scale - viewH), foc.y * scale - viewH * 0.58)),
    };
  }
  let camWX = NaN, camWY = NaN;
  function cam() {
    const t = camTarget();
    const k = (toolUp() && camFree) ? 0.3 : 0.12;   // panning wants a tighter leash
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
  const signDims = () => (SIGNS && SIGNS[fenceTier()]) || SIGN;
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
    const sd2 = signDims();
    signEl.style.width = pct(sd2.w, W);
    signEl.style.height = pct(sd2.h, H);
    signEl.style.backgroundImage = "url('/assets/homestead/m-psign" + fenceTier() + ".png')";
    signEl.style.left = pct(state.signAt.x - sd2.w / 2, W);
    signEl.style.top = pct(state.signAt.y - sd2.h, H);
    depth(signEl, state.signAt.y);
    signName.style.left = pct(state.signAt.x, W);
    // the board IS the label: its bottom overlaps the pole tops
    signName.style.top = pct(state.signAt.y - sd2.h + 7, H);
    signName.dataset.tier = String(fenceTier());
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
    // a stored style from a CULLED wardrobe falls back to the rung default
    const k = state.style && state.style[r];
    return (k && STYLE_RUNG[k] === r) ? k : STYLE_DEFAULTS[r];
  };
  const structDims = () => state.stage >= 1 ? STRUCTS[curStyleKey()] : { w: 140, h: 74 };
  // 🏠 tall sprites are mostly ELEVATION — the top ~3 rows are roof that
  // ground (and the banana) pass BEHIND; only the FLOOR occupies ground rows
  // (Trym: "the placement grid covers the roof / i go behind mid-house")
  const roofOf = (h) => Math.min(144, Math.round(h * 0.45));
  const floorOf = (h) => h - roofOf(h);
  let structEl = null, structKey = '', tentGhostEl = null, deedHintEl = null;
  function refreshTent() {
    if (state.stage < 1) {
      if (structEl) { structEl.remove(); structEl = null; structKey = ''; }
      if (!tentGhostEl) {
        // ⚠️ no deed outline here — the dashed plot only appears while a
        // roof is actually being PLACED (Trym: at idle it marked land the
        // player had no way to use yet). The ghost tent is the invitation.
        // a dark ghost tent stands on the spot — tap it, the phone opens
        tentGhostEl = document.createElement('div');
        tentGhostEl.className = 'hs-ov';
        const gd = STRUCTS.tent1;
        tentGhostEl.style.left = pct(state.home.x - gd.w / 2, W);
        tentGhostEl.style.top = pct(state.home.y - gd.h, H);
        tentGhostEl.style.width = pct(gd.w, W);
        tentGhostEl.style.height = pct(gd.h, H);
        tentGhostEl.style.backgroundImage = "url('/assets/homestead/ov-tent1.png')";
        tentGhostEl.style.filter = 'brightness(0.42) opacity(0.62)';
        tentGhostEl.style.pointerEvents = 'auto';
        tentGhostEl.style.cursor = 'pointer';
        tentGhostEl.addEventListener('click', () => { if (!visiting) openShop('order'); });
        depth(tentGhostEl, state.home.y);
        world.appendChild(tentGhostEl);
      }
      return;
    }
    if (tentGhostEl) { tentGhostEl.remove(); tentGhostEl = null; }
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
  // 🛋 M4.5: each room keeps its own furniture (state.inItems[tier])
  const INCAP = { 1: 6, 2: 12, 3: 16 };
  const inList = () => (state.inItems[inside] = state.inItems[inside] || []);
  // per-room placement insets: the wood rooms wear a ~100px wall band up top;
  // the tent is groundsheet to the brim. ⚠️ THE VISIBLE FLOOR IS THE PROMISE
  // (Trym, 7 Aug — third red-ghost round): every inset here must map to
  // something the eye can SEE. Tent walls are invisible → near-zero insets;
  // wood walls are 14px → 18 sides; tops sit just under the wall face so
  // furniture can stand AGAINST the back wall like the pack rooms do.
  const ROOM_INSETS = { 1: [6, 20, 6], 2: [18, 104, 8], 3: [18, 104, 8] };
  const roomBounds = (t = inside) => {
    const I = INTERIORS[t];
    const [ins, top, bot] = ROOM_INSETS[t] || [34, 116, 12];
    return [I.box[0] + ins, I.box[1] + top, I.box[0] + I.box[2] - ins, I.box[1] + I.box[3] - bot];
  };
  function camSnap() { const t = camTarget(); camX = t.x; camY = t.y; }
  const homeTier = () => STYLE_RUNG[curStyleKey()] || Math.max(1, Math.min(state.stage, 3));
  function enterHome() {
    standUp();
    if (planner) exitPlanner();
    const I = INTERIORS[homeTier()];
    if (!I) return;
    inside = homeTier();
    // ⚡ the shade covers the whole yard — a CSS class stops painting it
    // (items, critters, the animated fountain/campfire GIFs) while indoors
    world.classList.add('is-inside');
    if (!inShade) {
      inShade = document.createElement('div');
      inShade.className = 'hs-inshade';
      world.appendChild(inShade);
    }
    inShade.hidden = false;
    if (!inPlate) {
      inPlate = document.createElement('div');
      inPlate.className = 'hs-ov hs-ov--room';   // exempt from the is-inside hide
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
    refreshInItems();
    pos.x = I.spawn[0]; pos.y = I.spawn[1];
    tgt.x = pos.x;
    // nudge INTO the room — toward its centre, never back through the door
    tgt.y = pos.y + (pos.y < I.box[1] + I.box[3] / 2 ? 34 : -34);
    camSnap();
    toast('🏠 home — the door takes you back out');
    track('homestead_enter_home', { tier: inside });
  }
  function exitHome() {
    standUp();
    if (planner) exitPlanner();
    // ⚠️ WASD can carry you out MID-PLACEMENT — a stuck `placing` eats every
    // walk tap forever (the arranging-leak lesson, door edition)
    cancelPlacing();
    inside = 0;
    world.classList.remove('is-inside');
    refreshInItems();
    clearChip();
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
      // size from the maker's pixel bbox (3× render, like the pack's chunky
      // grid); older entries without fw/fh keep the classic 46 square
      const cw = Math.min(192, Math.max(18, (it.wear.fw | 0) * 3 || 46));
      const ch = Math.min(192, Math.max(18, (it.wear.fh | 0) * 3 || 46));
      DEX[it.id] = { id: it.id, name: it.title || 'community piece', cat: 'community',
        price: 20, stage: 1, w: cw, h: ch, surface: 'ground',
        indoor: it.wear.where === 'indoor',   // the maker's shelf choice
        svg: cu.art, img: null, solid: null, maker: it.by || '' };
      // ⚠️ the SHOP reads DECOR, not DEX — without this push the Community
      // shelf stayed empty forever (found 7 Aug wiring the maker pipeline)
      DECOR.push(DEX[it.id]);
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
    if (it.id === 'campfire' && it.lit && !ghost) {
      el.style.backgroundImage = "url('/assets/homestead/campfire-lit.gif')";
      el.style.height = pct(d.h * 2, H);
      el.style.top = pct(it.y - d.h * 2, H);
      el.style.filter = 'drop-shadow(0 0 16px rgba(255,150,50,.7))';
    }
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
  const inEls = [];
  function refreshInItems() {
    inEls.forEach((el) => el.remove());
    inEls.length = 0;
    if (!inside) return;
    (state.inItems[inside] || []).forEach((it) => {
      if (!DEX[it.id]) return;
      const el = itemDiv(it);
      el.classList.add('hs-it--in');   // indoor pieces survive the is-inside hide
      // rugs lie flat: always under the banana and any furniture on them
      el.style.zIndex = String(DEX[it.id].rug ? IN_Z : IN_Z + Math.round(it.y));
      inEls.push(el);
    });
  }
  function inSpotOk(d, x, y, t = inside) {
    const I = INTERIORS[t];
    if (!I) return false;
    const B = roomBounds(t);
    if (x - d.w / 2 < B[0] || x + d.w / 2 > B[2] || y - 10 < B[1] || y > B[3]) return false;
    if (I.kitchen && x + d.w / 2 > I.kitchen[0] - 8 && x - d.w / 2 < I.kitchen[2] + 8
      && y > I.kitchen[1] - 20 && y - d.h < I.kitchen[3] + 8) return false;
    // the DOOR CORRIDOR only — the gap's own width (+4), never the floor
    // beside it: standing a lamp NEXT to the door is what real rooms do
    if (!d.rug && I.exit && x + d.w / 2 > I.exit[0] - 4 && x - d.w / 2 < I.exit[2] + 4 && y > I.exit[1] - (t === 1 ? 36 : 90)) return false;
    // wall colliders gate placement only where walls are VISIBLE (wood rooms);
    // the tent's frame is invisible — vetoing on it reads as arbitrary red.
    // `y - 8`: a base 8px under the wall face = standing against the wall.
    if (t !== 1) {
      for (const c of I.cols) {
        if (x + d.w / 2 > c[0] && x - d.w / 2 < c[2] && y > c[1] && y - 8 < c[3]) return false;
      }
    }
    if (!d.rug) {
      for (const it of (state.inItems[t] || [])) {
        if (placing && placing.moving === it) continue;
        const o = DEX[it.id];
        if (o && !o.rug && Math.abs(x - it.x) < (d.w + o.w) * 0.32 && Math.abs(y - it.y) < 34) return false;
      }
    }
    return true;
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
      liveRects.push([state.home.x - hw2, state.home.y - floorOf(d.h), state.home.x + hw2, state.home.y + 4]);
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

  // ---- 🐔 coop chickens: three hens stroll the property (Trym) -------------
  const hens = [];
  function henTick(now, dt) {
    const hasCoop = state.items.some((i) => i.id === 'coop');
    if (!hasCoop || REDUCED) {
      while (hens.length) hens.pop().el.remove();
      return;
    }
    while (hens.length < 3) {
      const el = document.createElement('div');
      el.className = 'hs-hen';
      const img = document.createElement('span');
      img.style.backgroundImage = "url('/assets/homestead/c-hen" + hens.length + ".png')";
      el.appendChild(img);
      world.appendChild(el);
      const coop = state.items.find((i) => i.id === 'coop');
      hens.push({ el, img, x: coop.x - 30 + hens.length * 30, y: coop.y + 20,
        tx: coop.x, ty: coop.y + 40, waitUntil: 0, frame: 0, frameAt: 0 });
    }
    const P = plotNow();
    for (const h of hens) {
      const dx = h.tx - h.x, dy = h.ty - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        if (!h.waitUntil) h.waitUntil = now + 1500 + Math.random() * 5000;
        if (now > h.waitUntil) {
          h.waitUntil = 0;
          h.tx = Math.max(P[0] + 16, Math.min(P[2] - 16, h.x + (Math.random() * 260 - 130)));
          h.ty = Math.max(P[1] + 40, Math.min(P[3] - 10, h.y + (Math.random() * 160 - 80)));
        }
      } else {
        h.x += dx / d * 34 * dt;
        h.y += dy / d * 34 * dt;
        // ⚠️ dx < 0, NOT dx > 0 — the hens walked backwards for exactly this
        // reason (Trym). The bird flip below is `dx > 0` and is RIGHT, because
        // the Garden Birds art faces LEFT; the coop hens face RIGHT. The
        // expression was copied between two sprite sets with opposite native
        // facing. ⚠️ Check which way a new sprite looks before reusing either.
        const fl = dx < 0 ? 'scaleX(-1)' : '';
        if (h.fl !== fl) { h.fl = fl; h.img.style.transform = fl; }
        if (now - h.frameAt > 140) {
          h.frameAt = now;
          h.frame = (h.frame + 1) % 4;
        }
      }
      // ⚡ write-on-change only — an idle hen costs zero DOM
      if (h.pf !== h.frame) {
        h.pf = h.frame;
        h.img.style.backgroundPosition = (h.frame * 100 / 3) + '% 0';
      }
      if (h.px !== h.x || h.py !== h.y) {
        h.px = h.x; h.py = h.y;
        h.el.style.left = pct(h.x - 16, W);
        h.el.style.top = pct(h.y - 30, H);
        h.el.style.zIndex = String(100 + Math.round(h.y));
      }
    }
  }

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
            if (Math.abs(dx) > 4) b.img.style.transform = dx > 0 ? 'scaleX(-1)' : '';
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
        // ⚡ a bird standing between hops writes nothing
        if (b.px !== b.x || b.py !== b.y) {
          b.px = b.x; b.py = b.y;
          place(b.el, b.x, b.y, ' translate(-50%,-100%)');
          depth(b.el, b.y);
        }
      }
    };
  })();

  // ---- juice --------------------------------------------------------------
  function float(x, y, text) {
    const d = document.createElement('div');
    d.className = 'hs-float';
    if (text && text.nodeType) d.appendChild(text);
    else d.innerHTML = text;   // internal strings only — prices ride the real coin
    d.style.left = pct(x, W); d.style.top = pct(y, H);
    world.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }
  let toastTimer = null;
  function toast(text, ms) {
    if (String(text).indexOf('<img') >= 0) toastEl.innerHTML = text;
    else toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms || 2400);
  }
  const hint = (on) => { if (hintEl) hintEl.classList.toggle('is-off', !on); };

  // ---- HUD + actions ------------------------------------------------------
  const hud = mountHud({
    mount: view,
    theme: { bg: 'rgba(16, 24, 12, 0.82)' },
    chips: ['lvl', 'coins', 'crowd'],
  });
  const refreshHud = () => hud && hud.refresh();
  document.getElementById('hsEmote').addEventListener('click', function () {
    // the float rides the button's own pixel heart — one art source (rave grammar)
    const s = this.querySelector('svg');
    float(pos.x, pos.y - 44, s ? s.cloneNode(true) : '❤️');
  });
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
  const toolM = document.getElementById('hsToolMove');
  function setTool(t) {
    fencing = t === 'fence'; digging = t === 'soil'; clearing = t === 'clear'; arranging = t === 'move';
    toolF.setAttribute('aria-pressed', String(fencing));
    toolS.setAttribute('aria-pressed', String(digging));
    toolC.setAttribute('aria-pressed', String(clearing));
    toolM.setAttribute('aria-pressed', String(arranging));
    toast(fencing ? '🪵 tap your land (the lit grid) to build fence — tap a piece to take it down'
      : digging ? '⛏️ tap your land to till soil — tap soil to fill it back'
      : clearing ? '🧹 tap anything to clear it — decor goes safely to the shed'
      : '✥ tap a thing to lift it — decor, house, mailbox or sign', 3400);
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
    // dashed rings mark the land the NEXT rungs bring — aspiration, not clutter
    (planEls.next || []).forEach((el) => el.remove());
    planEls.next = [];
    for (let t = fenceTier() + 1; t <= 3; t++) {
      const N = FENCE_TIERS[t].fence;
      const el = document.createElement('div');
      el.className = 'hs-nextdeed';
      world.appendChild(el);
      box(el, N[0], N[1], N[2] - N[0], N[3] - N[1]);
      planEls.next.push(el);
    }
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
    (planEls.next || []).forEach((el) => { el.hidden = !on; });
  }
  function enterPlanner() {
    planner = true;
    buildBtn.setAttribute('aria-pressed', 'true');
    planBar.hidden = false;
    if (inside) {
      // indoors the room IS the grid — fence/soil/clear stay outside
      toolF.style.display = toolS.style.display = toolC.style.display = 'none';
      setTool('move');
      view.classList.add('is-placing');
      track('homestead_planner', { room: inside });
      return;
    }
    toolF.style.display = toolS.style.display = toolC.style.display = '';
    planOverlay();
    setTool('fence');
    // ⚠️ OPEN ON YOUR OWN LAND, not on the middle of the max deed. The frame is
    // still tier 3 so growth stays visible, but once the phone zooms in you can
    // only see a slice of it — and centring that slice on ground you don't own
    // yet means build mode opens somewhere you cannot build.
    const MY = FENCE_TIERS[Math.max(1, Math.min(state.stage, 3))].fence;
    camFree = { x: (MY[0] + MY[2]) / 2, y: (MY[1] + MY[3]) / 2 };
    view.classList.add('is-placing');
    layout();
    camSnap();
    // one toast, not two: replaces setTool's when there is anything to pan to
    if (W * scale > viewW + 8) {
      toast('🪵 tap the lit grid to build fence · swipe to look across your land', 4200);
    }
    track('homestead_planner');
  }
  function exitPlanner() {
    if (!planner && !digging && !fencing && !arranging) return;
    // ⚠️ every tool flag resets here — a stuck flag eats all walk taps (the
    // arranging leak: move tool survived 'done' and blocked tap-to-walk)
    planner = false; digging = false; fencing = false; clearing = false; arranging = false;
    toolF.style.display = toolS.style.display = toolC.style.display = '';
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
    if (state.stage < 1) { toast('pitch your tent first — tap its shadow on the deed'); return; }
    if (planner) exitPlanner(); else enterPlanner();
  });
  toolF.addEventListener('click', () => setTool('fence'));
  toolS.addEventListener('click', () => setTool('soil'));
  toolC.addEventListener('click', () => setTool('clear'));
  toolM.addEventListener('click', () => setTool('move'));
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
  // 🛣 arriving by ROAD (walked from the park, or fast travel) comes in the
  // EAST door — the same one you leave by, since the park lies east. A
  // DIRECT visit walks in from the WEST end of the road instead (Trym:
  // entering from the right only makes sense if you came from the park).
  const byRoad = /[?&](park|world)(?:=|&|$)/.test(location.search);
  const pos = byRoad ? { x: W - 90, y: ROAD.y } : { x: 104, y: ROAD.y };
  const tgt = byRoad ? { x: W - 260, y: ROAD.y } : { x: 300, y: ROAD.y };
  const c0 = camTarget(); camX = c0.x; camY = c0.y;
  track('homestead_open', {
    claimed: state.claimedAt ? 1 : 0,
    stage: state.stage || 0,
    visit: visiting ? 1 : 0,
    via: visiting ? 'yardlink'
      : /[?&]park(?:=|&|$)/.test(location.search) ? 'park'
        : /[?&]world(?:=|&|$)/.test(location.search) ? 'world' : 'direct',
  });

  // 🪙 THE WELCOME TRAIL — a one-time line of bananacoins on the road just
  // ahead of the walk-in, so the very first minute has something to pick up
  // (Trym). Spawns ONCE per device (hs-roadcoins-v1) and never again, even
  // half-collected. Diegetic-faucet sized: 5 × 2c. Walk-over collects.
  const roadCoins = [];
  (() => {
    if (visiting) return;
    try {
      if (localStorage.getItem('hs-roadcoins-v1')) return;
      localStorage.setItem('hs-roadcoins-v1', '1');
    } catch (e) { return; }
    const st = document.createElement('style');
    st.textContent = '.hs-roadcoin{position:absolute;width:26px;height:26px;pointer-events:none;}'
      + '.hs-roadcoin img{display:block;width:100%;height:100%;image-rendering:pixelated;'
      + 'filter:drop-shadow(0 3px 2px rgba(20,40,10,0.35));animation:hsCoinBob 1.1s ease-in-out infinite;}'
      + '@keyframes hsCoinBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}'
      + '@media (prefers-reduced-motion:reduce){.hs-roadcoin img{animation:none}}';
    document.head.appendChild(st);
    // strung along the road AHEAD of the walk-in, whichever door you used;
    // slight y-jitter so it reads as dropped, not printed
    [[400, -10], [500, 8], [600, -6], [700, 10], [800, 0]].forEach(([cx, jy], i) => {
      const x = byRoad ? W - cx : cx, y = ROAD.y + jy;
      const d = document.createElement('div');
      d.className = 'hs-roadcoin';
      d.innerHTML = '<img src="/assets/homestead/coin16.png" alt="" style="animation-delay:' + (i * 0.15) + 's">';
      place(d, x, y, ' translate(-50%,-50%)');
      depth(d, y);
      world.appendChild(d);
      roadCoins.push({ x, y, el: d });
    });
  })();
  function roadCoinTick() {
    for (let i = roadCoins.length - 1; i >= 0; i--) {
      const c = roadCoins[i];
      if (Math.hypot(c.x - pos.x, c.y - pos.y) > 34) continue;
      c.el.remove();
      roadCoins.splice(i, 1);
      passStat('coins_earned', 2);
      float(c.x, c.y - 22, '<img src="/assets/homestead/coin16.png" width="14" height="14" style="image-rendering:pixelated;vertical-align:-2px"> +2');
      refreshHud();
      if (!roadCoins.length) toast('🪙 first coins in the pocket — playing pays, anywhere in the world', 3600);
    }
  }

  const SPEED = 168;
  const keys = {};
  addEventListener('keydown', (e) => {
    // ⚠️ typing is typing — an S in the naming card must never walk the
    // banana behind the popup (Trym, mid-name)
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
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
  let doorArmed = false, doorClear = false, leaving = false, stripOn = false;
  // ⚠️ a deliberate tap/keypress ALSO arms the door — arming purely by
  // distance trapped anyone who turned straight back the way they came
  // (see the park's doorArmed note, same fix, same day)
  addEventListener('pointerdown', () => { doorArmed = true; }, true);
  addEventListener('keydown', () => { doorArmed = true; });
  function exitTo(href) {
    if (leaving) return;
    leaving = true;
    // leave NOW so neighbours see the poof the instant you commit (world.js)
    if (yardRoom) yardRoom.leave();
    track('homestead_exit', { to: 'park' });
    if (REDUCED) { location.href = href; return; }
    cutEl.classList.add('is-on');
    setTimeout(() => { location.href = href; }, 170);
  }
  function doorTick() {
    const d = Math.hypot(pos.x - DOOR.x, pos.y - DOOR.y);
    if (!doorArmed) { if (d > DOOR_ARM) doorArmed = true; return; }
    if (!doorClear) { if (d > DOOR_GO * 2) doorClear = true; return; }
    // ?homestead = the park spawns you at ITS west door + park_join logs the
    // via — without it you arrive at the default gate as a 'direct' visitor
    // (crossing the door LINE in the lane counts too — the GO disc alone
    // missed wall-huggers walking the road's edge; see the park's note)
    if (d < DOOR_GO || (pos.x >= DOOR.x && Math.abs(pos.y - DOOR.y) < 62)) { exitTo('/park/?homestead'); return; }
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
  // the CLEAN address — /homestead/<slug>/ rides the 404-page hop on Pages
  // (404.astro redirects it into ?yard=; the engine rewrites the bar back)
  const yardUrl = () => 'https://trymstene.com/homestead/' + state.slug + '/';
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
    // show the CLEAN address in the bar — what a visitor copies is the share URL
    try { history.replaceState(null, '', '/homestead/' + state.slug + '/'); } catch (e) {}
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
  let claimShown = false, renaming = false;
  function showNamePopup(prefill) {
    const inp = document.getElementById('hsClaimName');
    inp.value = prefill;
    claimEl.hidden = false;
    syncLock();
    setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 40);
  }
  function offerClaim() {
    if (claimShown || state.claimedAt) return;
    claimShown = true;
    showNamePopup(myName ? myName + "'s Homestead" : 'My Homestead');
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
    const wasRename = renaming;   // a repaint is not a founding — the funnel splits here
    if (renaming) { state.renames = (state.renames || 0) + 1; state.renamedAt = Date.now(); renaming = false; }
    state.claimedAt = state.claimedAt || Date.now();
    save(); refreshSign();
    claimEl.hidden = true;
    syncLock();
    toast('🏡 ' + v + ' — it’s yours');
    track(wasRename ? 'homestead_rename' : 'homestead_claim');
    // mint the ADDRESS — the sign name becomes the slug (yardBoot retries if offline)
    yFetch('/claim', { name: v }).then((r) => {
      if (r && r.slug) { state.slug = r.slug; save(); }
    }).catch(() => {});
    // the naming moment, AFTER the deed (silent if already named/asked)
    askName({
      why: 'The sign is up. Now — who lives here?',
      paint: (cv) => { try { drawComposite(cv.getContext('2d'), 72, 2, ME_DRAW); } catch (e) {} },
      clean: (v2) => import('../lib/sticker-core.js').then((m) => m.captionsClean({ top: v2 })).catch(() => true),
    }).then((nm) => { if (nm) myName = nm; });
  });

  // ---- 📬 the mailbox shop -------------------------------------------------
  const cap = () => CAPS[Math.min(state.stage, CAPS.length - 1)];
  const CAT_LABELS = { garden: '🌼 Garden', furniture: '🪑 Furniture', nature: '🌿 Nature',
    lighting: '🏮 Lighting', display: '🏆 Display', fun: '🎈 Fun', community: '🎁 Community',
    farm: '🌾 Farm', kitchen: '🍳 Kitchen', living: '🛋 Living room',
    bedroom: '🛏 Bedroom', bathroom: '🛁 Bathroom', hallway: '🚪 Hallway',
    music: '🎸 Music' };
  // the room-type shelves live INDOORS; everything else is the yard
  const INDOOR = new Set(['kitchen', 'living', 'bedroom', 'bathroom', 'hallway', 'music']);
  // community pieces carry the MAKER's indoor/yard choice; built-ins go by cat
  const isIndoorItem = (d) => d.cat === 'community' ? !!d.indoor : INDOOR.has(d.cat);
  // 🚚 THE DELIVERY TIERS (Trym): commons build instantly, furniture and
  // statement pieces take a van — short waits (hours, never days), and the
  // arrival is an EVENT. Community pieces ride the van too (Trym, 7 Aug).
  const SHIP_MIN = { garden: 0, nature: 0, farm: 0, fun: 0, community: 60, lighting: 30, furniture: 60, display: 240,
    kitchen: 45, living: 45, bedroom: 45, bathroom: 45, hallway: 45, music: 45 };
  const shipMin = (d) => SHIP_MIN[d.cat] || 0;
  const fmtShip = (ms) => {
    const m = Math.max(1, Math.round(ms / 60000));
    return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60 ? (m % 60) + 'm' : '') : m + 'm';
  };
  function checkOrders() {
    if (document.hidden || visiting || !state.orders.length) return;
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
      // orders in flight show ON the tile — the shed-stack chip, worn by the van
      const n = state.orders.filter((o) => o.id === d.id).length;
      if (n) {
        const op = document.createElement('span');
        op.className = 'hs-stackn';
        op.textContent = '🚚 ' + n;
        op.title = n + ' on the way';
        tile.appendChild(op);
      }
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
      const HERE = (d2) => isIndoorItem(d2) === !!inside;
      const cats = ['all', ...new Set(DECOR.filter(HERE).map((d) => d.cat))];
      const curCat = shopEl.dataset.cat || 'all';
      catsRow.hidden = cats.length <= 2;   // one shelf needs no chips
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
      DECOR.filter(HERE).filter((d) => curCat === 'all' || d.cat === curCat).forEach((d) => {
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
          const indoorItem = isIndoorItem(d);
          if (indoorItem && !inside) { shopNote('🛋 that belongs indoors — step inside first'); return; }
          if (!indoorItem && inside) { shopNote('🌳 that belongs in the yard — step outside first'); return; }
          if (inside ? inList().length >= INCAP[inside] : state.items.length >= cap()) {
            toast(inside ? 'this room is full (' + INCAP[inside] + ' spots)' : 'the plot is full');
            return;
          }
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
  // no stock emojis in the phone chrome (Trym) — clean OS titles
  const SHOP_HEADS = {
    home: ['Banana Phone', ''],
    order: ['Order online', 'The van delivers to your mailbox.'],
    shed: ['Your shed', 'Ready to place in build mode.'],
    up: ['Upgrades', ''],
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
      && y > state.home.y - floorOf(sd.h) && y < state.home.y + 12) return false;
    if (Math.hypot(x - state.mailAt.x, y - state.mailAt.y) < 50) return false;
    if (Math.hypot(x - state.signAt.x, y - state.signAt.y) < 40) return false;
    for (const c of state.fence) {
      if (x > c.i * 48 - 14 && x < c.i * 48 + 62 && y > c.j * 48 - 8 && y < c.j * 48 + 56) return false;
    }
    for (const it of state.items) {
      if (placing && placing.moving === it) continue;
      const o = DEX[it.id];
      if (o && Math.abs(x - it.x) < (d.w + o.w) * 0.32 && Math.abs(y - it.y) < 34) return false;
    }
    return true;
  }
  // 🎯 WHICH THING DID THEY MEAN? Both build tools used to walk the item list
  // backwards and take the FIRST box containing the tap. Hit boxes are generous
  // (half the sprite's width, its whole height plus 18px) and yard items
  // overlap constantly, so on a zoomed-out phone the answer was effectively
  // whichever happened to sit later in the array — Trym, 8 Aug: "when i tap
  // move it just selects a random object for me".
  //
  // Now every candidate is scored by how far the tap is from its CENTRE,
  // normalised by its own size so a wide sofa doesn't out-reach a small pot
  // standing on it. Z-order only breaks ties, which is what "the one on top"
  // should mean. Returns an index into state.items, or -1.
  function itemAt(wx, wy) {
    let best = -1, bestScore = Infinity;
    for (let k = state.items.length - 1; k >= 0; k--) {
      const it = state.items[k];
      const d = DEX[it.id];
      if (!d) continue;
      const halfW = Math.max(24, d.w / 2);
      if (Math.abs(wx - it.x) > halfW || wy < it.y - d.h - 8 || wy > it.y + 10) continue;
      const cy = it.y - d.h / 2;                       // the sprite's middle, not its feet
      const score = Math.hypot((wx - it.x) / halfW, (wy - cy) / Math.max(20, d.h / 2));
      if (score < bestScore) { bestScore = score; best = k; }
    }
    return best;
  }

  function startPlacing(id, moving) {
    cancelPlacing();
    const d = DEX[id];
    const P = inside ? roomBounds() : plotNow();
    const x = snap(moving ? moving.x : Math.max(P[0] + 40, Math.min(P[2] - 40, pos.x)));
    const y = snap(moving ? moving.y : Math.max(P[1] + 40, Math.min(P[3] - 20, pos.y)));
    placing = { id, x, y, el: itemDiv({ id, x, y }, true), moving: moving || null, room: inside };
    if (inside) {
      placing.el.classList.add('hs-it--in');
      placing.el.style.zIndex = String(d.rug ? IN_Z : IN_Z + Math.round(y));
    }
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
  const FIXD = { mail: { w: MAILBOX.w, h: MAILBOX.h }, get sign() { return signDims(); } };
  const FIX_BOUNDS = [320, 270, 1400, 878];   // fixtures may live off-plot, by the road
  const fixDims = () => FIXD[placing.key] || STRUCTS[placing.key];
  function homeOk(x, y) {
    const d = fixDims();
    const P = FIXD[placing.key] ? FIX_BOUNDS : placeBounds();
    // THE LIT GRID IS THE CONTRACT: it draws the FENCE rect, the plot is inset
    // ~48-62px inside it — walls may reach the fence line on the north, east
    // and west (Trym hit the invisible inset twice, 24px then 2px short)
    if (x - d.w / 2 < P[0] - 58 || x + d.w / 2 > P[2] + 58) return false;
    if (y - floorOf(d.h) < P[1] - 56 || y > P[3] - 8) return false;
    for (const c of state.fence) {
      if (x > c.i * 48 - 26 && x < c.i * 48 + 74 && y > c.j * 48 - 12 && y < c.j * 48 + 60) return false;
    }
    const foot = [x - d.w * 0.52, y - floorOf(d.h), x + d.w * 0.52, y + 12];
    for (const c of state.soil) {   // structures keep off the dug soil
      if (foot[0] < (c.i + 1) * 48 && foot[2] > c.i * 48 && foot[1] < (c.j + 1) * 48 && foot[3] > c.j * 48) return false;
    }
    return true;
  }
  function startPlacingHome(key, opts) {
    // structures rise in the YARD — buying an upgrade (or a restyle) from the
    // phone while indoors walks you out first, then hands you the ghost
    if (inside) exitHome();
    cancelPlacing();
    const d = FIXD[key] || STRUCTS[key];
    const el = document.createElement('div');
    el.className = 'hs-it hs-it--ghost';
    el.style.width = pct(d.w, W);
    el.style.height = pct(d.h, H);
    el.style.backgroundImage = "url('/assets/homestead/" + (FIXD[key]
      ? 'm-' + (key === 'sign' ? 'psign' + fenceTier() : key) : 'ov-' + key) + ".png')";
    world.appendChild(el);
    if (!FIXD[key]) {
      el.classList.add('hs-it--struct');
      const fr = document.createElement('i');
      fr.className = 'hs-footring';
      fr.style.height = Math.round(100 * floorOf(d.h) / d.h) + '%';
      el.appendChild(fr);
      // 📐 the dashed deed outline appears NOW — while a roof is being
      // placed it shows where the land runs; at idle it was noise (Trym)
      const tier = Math.max(1, (opts && opts.toStage) || state.stage);
      const P = FENCE_TIERS[tier].plot;
      deedHintEl = document.createElement('div');
      deedHintEl.className = 'hs-tentspot';
      deedHintEl.style.left = pct(P[0], W);
      deedHintEl.style.top = pct(P[1], H);
      deedHintEl.style.width = pct(P[2] - P[0], W);
      deedHintEl.style.height = pct(P[3] - P[1], H);
      deedHintEl.style.border = '3px dashed rgba(255,225,53,.5)';
      deedHintEl.style.borderRadius = '10px';
      deedHintEl.style.background = 'transparent';
      depth(deedHintEl, P[1] + 4);
      world.appendChild(deedHintEl);
    }
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
    if (deedHintEl) { deedHintEl.remove(); deedHintEl = null; }
    const d = fixDims();
    const x = placing.x, y = placing.y;
    // the sweep: items under the new footprint go safely to the shed
    const foot = [x - d.w * 0.52, y - floorOf(d.h), x + d.w * 0.52, y + 12];
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
      plannerAfterPlace(x, y);
      return;
    }
    if (placing.toStage) {   // this placement completes an UPGRADE
      passStat('coins_spent', placing.price);
      state.stage = placing.toStage;
      state.style = state.style || {};
      state.style[placing.toStage] = placing.key;
      state.look = '';   // a new roof is worn the day it lands
      const rung = STRUCT_LADDER[placing.toStage - 1];
      track('homestead_upgrade', { to: placing.key, stage: placing.toStage });
      if (!swept.length) toast(rung.icon + ' ' + rung.name.toLowerCase() + ' — done');
      if (placing.toStage === 1) {
        // move-in day: the tent comes furnished with its camp kit…
        if (!(state.inItems[1] || []).length) {
          state.inItems[1] = [{ id: 'sleepbag', x: 836, y: 560 },
            { id: 'tlantern', x: 906, y: 552 }, { id: 'backpack', x: 962, y: 560 }];
        }
        // …and NOW the place asks for its name (after the deed, not before)
        if (!state.claimedAt) setTimeout(offerClaim, 700);
      }
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
    plannerAfterPlace(x, y);
    if (grew) setTimeout(() => toast('🌱 your land grew — more room to build, dig and decorate'), 1400);
  }
  // the sign's move button lives in the guestbook; the mailbox offers its
  // own chip on tap (the phone replaced the shop-panel button)
  (() => {   // ✏️ rename — a second chance, then the sign dries for 48h
    const mv2 = document.getElementById('hsSignMove');
    if (!mv2 || visiting) return;
    const rn = document.createElement('button');
    rn.className = mv2.className;
    rn.textContent = '✏️ rename';
    rn.addEventListener('click', () => {
      const waited = Date.now() - (state.renamedAt || 0);
      if ((state.renames || 0) >= 1 && waited < 48 * 3600e3) {
        toast('the paint is still wet — rename again in ' + Math.ceil((48 * 3600e3 - waited) / 3600e3) + 'h');
        return;
      }
      guestEl.hidden = true;
      syncLock();
      renaming = true;
      showNamePopup(state.name || 'My Homestead');
    });
    mv2.parentNode.insertBefore(rn, mv2);
  })();
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
    if (placing.room) placing.el.style.zIndex = String(d.rug ? IN_Z : IN_Z + Math.round(placing.y));
    const ok = placing.room ? inSpotOk(d, placing.x, placing.y, placing.room)
      : spotOk(d, placing.x, placing.y);
    placing.el.classList.toggle('is-bad', !ok);
    document.getElementById('hsPlaceGo').disabled = !ok;
  }
  function plannerAfterPlace(x, y) {
    if (!planner) return;
    view.classList.add('is-placing');
    camFree = { x, y };
    planOverlay();
  }
  function cancelPlacing() {
    standUp();
    if (deedHintEl) { deedHintEl.remove(); deedHintEl = null; }
    if (!placing) return;
    const keepX = placing.x, keepY = placing.y;
    view.classList.remove('is-placing');
    camFree = null;
    placing.el.remove();
    if (placing.home) {   // an upgrade not yet paid for simply doesn't happen
      const wasUpgrade = !!placing.toStage;
      placing = null;
      confirmEl.hidden = true;
      if (wasUpgrade) toast('no rush — the offer stays at the mailbox');
      plannerAfterPlace(keepX, keepY);
      return;
    }
    if (placing.moving) {
      (placing.room ? (state.inItems[placing.room] = state.inItems[placing.room] || []) : state.items)
        .push(placing.moving);   // it never left
    }
    const wasBuy = !placing.moving;
    const backId = placing.id;
    placing = null;
    confirmEl.hidden = true;
    if (wasBuy) { state.shed.push({ id: backId }); save(); toast('into the shed — place it any time'); }
    refreshItems();
    refreshInItems();
    plannerAfterPlace(keepX, keepY);
  }
  document.getElementById('hsPlaceGo').addEventListener('click', () => {
    if (!placing) return;
    if (placing.home) { confirmHome(); return; }
    view.classList.remove('is-placing');
    camFree = null;
    const it = { id: placing.id, x: placing.x, y: placing.y };
    const room = placing.room;
    placing.el.remove();
    const moved = !!placing.moving;
    placing = null;
    confirmEl.hidden = true;
    (room ? (state.inItems[room] = state.inItems[room] || []) : state.items).push(it);
    save();
    refreshItems();
    refreshInItems();
    float(it.x, it.y - (DEX[it.id].h || 30) - 6, '✓');
    plannerAfterPlace(it.x, it.y);
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
    if (it.id === 'campfire') {
      const fire = document.createElement('button');
      fire.className = 'hs-btn';
      fire.textContent = it.lit ? '\ud83d\udca8 put out' : '\ud83d\udd25 light';
      fire.addEventListener('click', () => {
        it.lit = it.lit ? 0 : 1;
        save();
        clearChip();
        refreshItems();
        float(it.x, it.y - 40, it.lit ? '\ud83d\udd25' : '\ud83d\udca8');
      });
      itChip.appendChild(fire);
    }
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
      // the drag clamp matches homeOk: walls may reach the fence line (±46)
      placing.x = snap(Math.max(P[0] - 46 + d.w / 2, Math.min(P[2] + 46 - d.w / 2, wx)));
      placing.y = snap(Math.max(P[1] + Math.min(d.h * 0.5, 120), Math.min(P[3] - 10, wy)));
    } else {
      const P = placing.room ? roomBounds(placing.room) : plotNow();
      placing.x = snap(Math.max(P[0] + 12, Math.min(P[2] - 12, wx)));
      placing.y = snap(Math.max(P[1] + 26, Math.min(P[3] - 8, wy)));
    }
    updateGhost();
  }
  view.addEventListener('pointerdown', (e) => {
    if ((!placing && !digging && !fencing && !clearing && !arranging) || panelOpen()) return;
    if (e.target.closest('.wh') || e.target.closest('.hs-actions') || e.target.closest('.hs-confirm')) return;
    gest = { x0: e.clientX, y0: e.clientY, cam0x: camFree.x, cam0y: camFree.y, panning: false };
  });
  view.addEventListener('pointermove', (e) => {
    if (!gest || (!placing && !digging && !fencing && !clearing && !arranging)) return;
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
    if (inside) {          // indoors: the stove answers, furniture chats, else walks
      if (arranging && !visiting) {   // ✥ build mode: tap a piece, lift it
        const L3 = state.inItems[inside] || [];
        for (let k3 = L3.length - 1; k3 >= 0; k3--) {
          const it3 = L3[k3];
          const d4 = DEX[it3.id];
          if (d4 && Math.abs(wx - it3.x) < Math.max(24, d4.w / 2) && wy > it3.y - d4.h - 8 && wy < it3.y + 10) {
            L3.splice(k3, 1);
            startPlacing(it3.id, it3);
            return;
          }
        }
        // no piece under the tap — fall through, walking still works
      }
      const I = INTERIORS[inside];
      if (I.kitchen && wx > I.kitchen[0] && wx < I.kitchen[2] && wy > I.kitchen[1] && wy < I.kitchen[3]) {
        if (Math.hypot(pos.x - wx, pos.y - wy) < 170) { openCook(); return; }
      }
      const L2 = state.inItems[inside] || [];
      for (let k = L2.length - 1; k >= 0; k--) {
        const it = L2[k];
        const d2 = DEX[it.id];
        if (d2 && Math.abs(wx - it.x) < Math.max(24, d2.w / 2) && wy > it.y - d2.h - 8 && wy < it.y + 10) {
          if (Math.hypot(pos.x - it.x, pos.y - it.y) < 160) {
            if (d2.sit) sitOn(it, d2);
            clearChip();
            itChip = document.createElement('div');
            itChip.className = 'hs-chip';
            if (it.id === 'stove') {   // 🍳 a bought stove grants cooking
              const ck2 = document.createElement('button');
              ck2.className = 'hs-btn';
              ck2.textContent = '🍳 cook';
              ck2.addEventListener('click', () => { clearChip(); openCook(); });
              itChip.append(ck2);
            }
            const mv3 = document.createElement('button');
            mv3.className = 'hs-btn';
            mv3.textContent = '✥ move';
            mv3.addEventListener('click', () => {
              clearChip();
              L2.splice(k, 1);
              startPlacing(it.id, it);
            });
            const aw = document.createElement('button');
            aw.className = 'hs-btn hs-btn--ghost';
            aw.textContent = '📦 put away';
            aw.addEventListener('click', () => {
              clearChip();
              L2.splice(k, 1);
              state.shed.push({ id: it.id });
              save();
              refreshInItems();
              float(it.x, it.y - 30, '📦');
            });
            itChip.append(mv3, aw);
            itChip.style.left = pct(it.x, W);
            itChip.style.top = pct(it.y - (d2.h || 30) - 10, H);
            itChip.style.zIndex = '3200';
            world.appendChild(itChip);
          } else { tgt.x = it.x; tgt.y = it.y + 26; }
          return;
        }
      }
      tgt.x = wx; tgt.y = wy;
      return;
    }
    // ✋ a camera pan must never also act — the doctrine's other half
    if (justPanned) { justPanned = false; return; }
    // ✥ move mode: lift a thing, set it down — batch rearranging (Trym:
    // "better to reposition and move stuff in build mode")
    if (arranging && !visiting) {
      const k = itemAt(wx, wy);
      if (k >= 0) {
        const it = state.items[k];
        state.items.splice(k, 1);
        startPlacing(it.id, it);
        return;
      }
      if (Math.abs(wx - state.mailAt.x) < 30 && wy > state.mailAt.y - MAILBOX.h - 10 && wy < state.mailAt.y + 10) {
        startPlacingHome('mail', {});
        return;
      }
      if (Math.abs(wx - state.signAt.x) < 30 && wy > state.signAt.y - SIGN.h - 10 && wy < state.signAt.y + 10) {
        startPlacingHome('sign', {});
        return;
      }
      const sd2 = structDims();
      if (state.stage >= 1 && Math.abs(wx - state.home.x) < sd2.w / 2
        && wy > state.home.y - sd2.h && wy < state.home.y + 8) {
        startPlacingHome(curStyleKey(), {});
        return;
      }
      return;
    }
    // 🧹 clear mode: one demolish tool — decor → shed, fence down, soil filled
    if (clearing && !visiting) {
      const k = itemAt(wx, wy);
      if (k >= 0) {
        const it = state.items[k];
        state.items.splice(k, 1);
        state.shed.push({ id: it.id });
        save(); refreshItems();
        float(it.x, it.y - 40, '📦');
        track('homestead_pickup', { id: it.id, via: 'planner' });
        return;
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
          && cb > state.home.y - floorOf(sd.h) && cb < state.home.y + 30) { toast('not through the house'); return; }
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
          && cb > state.home.y - floorOf(sd.h) && cb < state.home.y + 30) { toast('not under the house'); return; }
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
          : 'nothing on the way — order on the <img class="hs-toastico" src="/assets/homestead/phone.png" alt="phone">');
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
    // 🚪 the door lives at the BOTTOM of every building (top-down: the banana
    // walks UP to things) — tap it and walk in; no chips, no buttons. Moving
    // lives in the planner's ✥ tool now.
    if (state.stage >= 1) {
      const sd = structDims();
      if (Math.abs(wx - state.home.x) < sd.w / 2 && wy > state.home.y - sd.h && wy < state.home.y + 8) {
        // ⚠️ the band is sized by the FLOOR, not a flat 64px (Trym: "i cant
        // walk into my cabin with porch"). Porch styles carry ~100px of decking
        // at the sprite's bottom, so their visible door sits ABOVE a 64px band
        // — taps on it read as wall, and walking the porch never entered. The
        // lower ¾ of the floor is door-intent now; the 64 minimum keeps the
        // tent exactly as it was, and the roof still just walks you over.
        const doorish = Math.abs(wx - state.home.x) < sd.w * 0.32
          && wy > state.home.y - Math.max(64, floorOf(sd.h) * 0.75);
        if (doorish && !visiting && INTERIORS[homeTier()]) {
          if (Math.hypot(pos.x - state.home.x, pos.y - state.home.y) < 130) { enterHome(); return; }
          tgt.x = state.home.x; tgt.y = state.home.y + 24;
          doorTgt = { x: tgt.x, y: tgt.y };   // arriving = stepping in
          return;
        }
        tgt.x = state.home.x; tgt.y = state.home.y + 30;
        return;
      }
    }
    // a placed item
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      const d = DEX[it.id];
      if (d && Math.abs(wx - it.x) < Math.max(24, d.w / 2) && wy > it.y - d.h - 8 && wy < it.y + 10) {
        if (visiting) { tgt.x = it.x; tgt.y = it.y + 30; return; }   // look, don't touch
        if (Math.hypot(pos.x - it.x, pos.y - it.y) < 150) {
          if (d.sit) sitOn(it, d);
          itemChip(i);
        }
        else { tgt.x = it.x; tgt.y = it.y + 30; }
        return;
      }
    }
    tgt.x = wx; tgt.y = wy;
  });
  // 🚪 the door intent: any new target (tap, WASD) cancels it; arriving enters
  setInterval(() => {
    if (!doorTgt) return;
    if (inside || placing || visiting || tgt.x !== doorTgt.x || tgt.y !== doorTgt.y) { doorTgt = null; return; }
    if (Math.hypot(pos.x - doorTgt.x, pos.y - doorTgt.y) < 46) { doorTgt = null; enterHome(); }
  }, 250);

  // ---- 🌐 the yard is MULTIPLAYER (M5) ------------------------------------
  // One tiny presence room PER HOMESTEAD — slug-keyed YardRoom instances on
  // worker-rave (/yard?slug=…), the same room contract as the park and the
  // bay. The wire speaks WORLD PIXELS. No slug yet (fresh, unclaimed) means
  // no socket: a yard nobody can visit has no crowd. Fails silently by design.
  const peers = new Map();          // id → { el, ctx, outfit, x, y, sit, lastF }
  let myYardId = null, hsSendAt = 0, sawNeighbour = false;
  const lastSent = { x: -1, y: -1, sit: false };
  function refreshCrowd() { if (hud) hud.setCrowd(peers.size ? String(peers.size + 1) : 'solo'); }
  function drawPeer(p, force) {
    const f = p.sit ? 7 : frameNow();
    if (!force && f === p.lastF) return;
    p.lastF = f;
    drawComposite(p.ctx, 150, f, { ...p.outfit, top: '', bottom: '', bg: 'transparent',
      captions: false, effect: 'none',
      custom: p.outfit && p.outfit.c ? catCustom(p.outfit.c) : undefined });
  }
  function placePeer(p) {
    place(p.el, p.x, p.y, ME_ANCHOR);
    p.el.style.zIndex = String(100 + Math.round(p.y));
  }
  function addPeer(d) {
    if (!d || d.id === myYardId || peers.has(d.id)) return;
    if (!sawNeighbour) { sawNeighbour = true; track('homestead_multiplayer'); }
    const el = document.createElement('div');
    el.className = 'hs-peer';
    const cv = document.createElement('canvas');
    cv.width = 150; cv.height = 150;
    el.appendChild(cv);
    if (d.name) { const tag = document.createElement('span'); tag.textContent = d.name; el.appendChild(tag); }
    world.appendChild(el);
    const p = { el, ctx: cv.getContext('2d'), outfit: d.outfit || {}, sit: d.sit === true,
      x: Number(d.x) || 900, y: Number(d.y) || 700, lastF: -1 };
    peers.set(d.id, p);
    placePeer(p);
    drawPeer(p, true);
    refreshCrowd();
  }
  const yardRoom = !state.slug ? null : presenceRoom({
    url: 'wss://banana-rave.trymstene.workers.dev/yard?slug=' + encodeURIComponent(state.slug),
    hi: () => ({ outfit: fullOutfit(ME_DRAW), x: pos.x, y: pos.y, sit: !!sitting, name: myName }),
    onMessage: (m) => {
      if (m.t === 'roster') { myYardId = m.you; (m.all || []).forEach(addPeer); refreshCrowd(); }
      else if (m.t === 'join') addPeer(m.p);
      else if (m.t === 'move') {
        const p = peers.get(m.id);
        if (p) { p.x = Number(m.x) || p.x; p.y = Number(m.y) || p.y; p.sit = m.sit === true; placePeer(p); }
      } else if (m.t === 'outfit') {
        const p = peers.get(m.id);
        if (p) { p.outfit = m.outfit || {}; drawPeer(p, true); }
      } else if (m.t === 'leave') {
        const p = peers.get(m.id);
        if (p) {
          poofInto(world, 'hs-poof', p.x / W * 100, (p.y - 26) / H * 100);
          p.el.remove();
          peers.delete(m.id);
          refreshCrowd();
        }
      }
    },
    onDown: () => { peers.forEach((p) => p.el.remove()); peers.clear(); refreshCrowd(); },
  });
  function hsSendMove(now) {
    // indoors you're invisible to the yard — freeze at the door, send nothing
    if (!yardRoom || !yardRoom.live || inside || now - hsSendAt < 150) return;
    const sit = !!sitting;
    if (Math.abs(pos.x - lastSent.x) < 1 && Math.abs(pos.y - lastSent.y) < 1 && sit === lastSent.sit) return;
    hsSendAt = now;
    lastSent.x = pos.x; lastSent.y = pos.y; lastSent.sit = sit;
    yardRoom.send({ t: 'move', x: pos.x, y: pos.y, sit });
  }

  // ---- the banana ---------------------------------------------------------
  const frameNow = () => {
    const cyc = BASE_CYCLE_S * 1000;
    return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES;
  };
  let lastF = -1;
  function standUp() {
    if (!sitting) return;
    sitting = null;
    meCtx.canvas.style.transform = '';
    lastF = -1;
  }
  function sitOn(it, d) {
    pos.x = it.x;
    pos.y = it.y - Math.max(6, Math.round(d.h * 0.22));
    tgt.x = pos.x; tgt.y = pos.y;
    sitting = it;
    meCtx.canvas.style.transform = d.sit === 'r' ? 'scaleX(-1)' : '';
    lastF = -1;
  }
  function drawMe() {
    const f = sitting ? 7 : frameNow();
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
    if (sitting && d > 1.5) standUp();
    if (d > 1.5) {
      const m = Math.min(d, SPEED * dt);
      const nx = pos.x + (dx / d) * m, ny = pos.y + (dy / d) * m;
      if (!blocked(nx, ny)) { pos.x = nx; pos.y = ny; }
      else if (!blocked(nx, pos.y)) pos.x = nx;
      else if (!blocked(pos.x, ny)) pos.y = ny;
      // wedged INSIDE a solid (corner-slide rounding): moves always succeed
      // until you're out — stuck states self-heal
      else if (blocked(pos.x, pos.y)) { pos.x = nx; pos.y = ny; }
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
    drawMe();
    doorTick();
    // ⚡ indoors the yard is under the shade — its critters neither move nor
    // paint until you step back out ("what nobody sees doesn't run")
    if (!inside) {
      birdTick(now, dt);
      henTick(now, dt);
      peers.forEach((p) => drawPeer(p));
      if (roadCoins.length) roadCoinTick();
    }
    hsSendMove(now);
    cam();
  }
  // the QA reach-in (the park's ?parktest pattern) — nothing here exists in a
  // normal session
  if (HS_TEST) {
    window.__hs = {
      pos, tgt, peers,
      warp: (x, y) => { pos.x = x; pos.y = y; tgt.x = x; tgt.y = y; meWX = NaN; },
      room: () => yardRoom,
      // the validity-grid probe (round-15 doctrine: verify the grid, not a spot)
      inOk: (id, x, y, t) => !!DEX[id] && inSpotOk(DEX[id], x, y, t),
      geo: { INTERIORS, roomBounds },
    };
  }

  assetsReady().then(() => {
    // 🌍 the Banana World tour — an INVITE now, never an auto-modal (Trym,
    // 12 Aug: it smacked up before the first step and fought the quest
    // chip). The chip offers it bottom-left; ?bwtour still force-opens.
    if (!visiting) {
      const tourOpts = {
        track,
        paint: (cv) => {
          try {
            drawComposite(cv.getContext('2d'), 150, frameNow(),
              { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
          } catch (e) {}
        },
        // the finale close-up: the share cards' hands-up pose (frame 2),
        // drawn once at the canvas's own resolution
        paintUp: (cv) => {
          try {
            drawComposite(cv.getContext('2d'), cv.width || 300, 2,
              { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
          } catch (e) {}
        },
      };
      if (/[?&]bwtour(?:=|&|$)/.test(location.search)) {
        initWorldTutorial({ ...tourOpts, force: true });
      } else {
        initTutorialInvite({ ...tourOpts, mount: document.querySelector('.hs-view') });
      }
    }
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
