// 🏡 THE HOMESTEAD — your own clearing west of the park (task #106, M0).
//
// The world's first PERSONAL space: claim the plot, name it, buy decor at the
// mailbox, place it anywhere on your lawn (three verbs: place / move / put
// away), pitch the tent, grow the bed. M0 state is device-local (hs-v1);
// the YardRoom DO + slugs arrive with visiting (M1) — the shape below is
// already the DO's document so nothing migrates.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { passStat, buffGet, buffSet } from '../lib/banana-pass.js';
import { catCustom, loadCatalog } from '../lib/drops.js';
import { wearToCustom } from '../lib/wear-render.js';
import { mountHud, coinBalance } from '../lib/world-hud.js';
import { initTravel } from './world-travel.js';
import { askName } from '../lib/banana-id.js';
import { worldOwner, worldSid } from '../lib/world.js';
import { WORLD, BOUND, ROAD, GATE, SPAWN, FENCE_TIERS, BED, TENT, STRUCTS, STRUCT_STYLES,
  MAILBOX, SIGN, OB_RECTS, OVERLAYS, BIRDS, INTERIORS } from './homestead-geo.js';
import { DECOR } from '../data/decor.js';

const view = document.getElementById('hsView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// 🪙 prices wear the REAL bananacoin, never the stock emoji (Trym)
const COIN = '<img class="hs-coin" src="/assets/banana-stand/coin.png" alt="bananacoins">';

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
  { price: 50, name: 'Pitch a tent', icon: '⛺',
    pitch: 'pick a colour, move in — the whole decor catalog opens up.' },
  { price: 250, name: 'Get a real roof', icon: '🛖',
    pitch: 'a mobile home, a barn — your call. The plot grows and the fancier catalog unlocks.' },
  { price: 600, name: 'Build the house', icon: '🏠',
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
  return { v: 1, name: '', claimedAt: 0, stage: 0, items: [], shed: [], bed: [null, null, null, null] };
}
function withHome(s) {   // older saves have no home/bedAt — defaults = old spots
  if (!s.home) s.home = { x: TENT.x, y: TENT.y };
  if (!s.bedAt) s.bedAt = { x: BED.def.x, y: BED.def.y };
  if (!s.style) s.style = {};
  if (!s.pantry) s.pantry = {};
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
    s = { ...base, stage: 1,
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
    s = { ...base, stage: 3, items,
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
    bed: Array.isArray(d.bed) ? d.bed : [null, null, null, null],
    home: d.home, bedAt: d.bedAt, guest: d.guest || [], wtoday: !!d.wtoday,
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
    if (!inP(state.bedAt)) state.bedAt = { x: BED.def.x, y: BED.def.y };
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
        stage: state.stage, style: state.style, home: state.home,
        bedAt: state.bedAt, items: state.items, bed: state.bed,
      } }).catch(() => {});
    }, 2500);
  }
  // ⚠️ TDZ: camTarget() reads these and is CALLED at spawn setup, so they
  // must live above the camera section (the rave-floor lesson)
  let placing = null;   // { id, x, y, el, moving }
  let camFree = null;   // the placing camera: PANNED by drags, never chases the ghost

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
    const foc = (placing && camFree) ? camFree : pos;
    return {
      x: Math.max(0, Math.min(Math.max(0, W * scale - viewW), foc.x * scale - viewW / 2)),
      y: Math.max(0, Math.min(Math.max(0, H * scale - viewH), foc.y * scale - viewH * 0.58)),
    };
  }
  let camWX = NaN, camWY = NaN;
  function cam() {
    const t = camTarget();
    const k = (placing && camFree) ? 0.3 : 0.12;   // panning wants a tighter leash
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

  // ---- 🌱 THE LAND GROWS WITH THE LADDER ----------------------------------
  // tent = a cosy corner, a real roof pushes the fence out, the house takes
  // the whole clearing (Trym). Two overlays per tier: the yard rows sit low,
  // the south row y-sorts so the pickets overflow the banana.
  const fenceTier = () => Math.max(1, Math.min(state.stage, 3));
  const plotNow = () => FENCE_TIERS[fenceTier()].plot;
  let fenceCols = [], fenceEls = [], fenceOn = 0;
  function refreshFence() {
    const t = fenceTier();
    if (t === fenceOn) return;
    fenceOn = t;
    const ft = FENCE_TIERS[t];
    fenceCols = ft.cols;
    fenceEls.forEach((el) => el.remove());
    fenceEls = [ft.yard, ft.south].map((o) => {
      const d = document.createElement('div');
      d.className = 'hs-ov';
      d.style.left = pct(o[1], W); d.style.top = pct(o[2], H);
      d.style.width = pct(o[3], W); d.style.height = pct(o[4], H);
      d.style.backgroundImage = "url('/assets/homestead/" + o[0] + "')";
      depth(d, o[5]);
      world.appendChild(d);
      return d;
    });
  }
  refreshFence();

  // the sign carries the homestead's NAME — the whole point of the sign
  const signName = document.createElement('div');
  signName.className = 'hs-signname';
  signName.style.left = pct(SIGN.x, W); signName.style.top = pct(SIGN.y - 44, H);
  depth(signName, SIGN.y + 200);       // reads above nearby props
  world.appendChild(signName);
  function refreshSign() { signName.textContent = state.name || ''; signName.hidden = !state.name; }
  refreshSign();

  // ---- 🏠 the structure at the TENT spot: nothing → tent → cabin → house --
  const curStruct = () => state.stage >= 1
    ? STRUCT_LADDER[Math.min(state.stage, STRUCT_LADDER.length) - 1] : null;
  const curStyleKey = () => {
    const r = Math.min(state.stage, 3);
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
  function enterHome() {
    const I = INTERIORS[state.stage >= 3 ? 3 : 2];
    if (!I) return;
    inside = state.stage >= 3 ? 3 : 2;
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
    liveRects.push([state.bedAt.x - BED.w / 2 - 6, state.bedAt.y - BED.h - 6, state.bedAt.x + BED.w / 2 + 6, state.bedAt.y + 6]);
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
    for (const r of fenceCols) if (inRect(x, y, r)) return true;
    for (const r of liveRects) if (inRect(x, y, r)) return true;
    return false;
  }
  rebuildSolids();
  refreshItems();

  // ---- the bed: a movable soil overlay + its crops ------------------------
  const slotAt = (i) => [state.bedAt.x + BED.slots[i][0], state.bedAt.y + BED.slots[i][1]];
  const slotEls = [null, null, null, null];
  let bedEl = null;
  function cropStage(b) { return !b ? 0 : Math.min(4, 1 + (b.waters | 0)); }
  function refreshBed() {
    if (!bedEl) {
      bedEl = document.createElement('div');
      bedEl.className = 'hs-ov';
      bedEl.style.backgroundImage = "url('/assets/homestead/ov-bed.png')";
      bedEl.style.zIndex = '60';   // flat tilled ground — under everything y-sorted
      world.appendChild(bedEl);
    }
    bedEl.style.left = pct(state.bedAt.x - BED.w / 2, W);
    bedEl.style.top = pct(state.bedAt.y - BED.h, H);
    bedEl.style.width = pct(BED.w, W);
    bedEl.style.height = pct(BED.h, H);
    BED.slots.forEach((rel, i) => {
      if (slotEls[i]) { slotEls[i].remove(); slotEls[i] = null; }
      const b = state.bed[i];
      if (!b) return;
      const sp = slotAt(i);
      const el = document.createElement('div');
      el.className = 'hs-crop' + (cropStage(b) >= 4 ? ' is-ripe' : '');
      el.style.left = pct(sp[0] - 18, W); el.style.top = pct(sp[1] - 40, H);
      el.style.width = pct(36, W); el.style.height = pct(40, H);
      el.style.backgroundImage = "url('/assets/park/c-" + b.crop + '-' + cropStage(b) + ".png')";
      depth(el, sp[1]);
      world.appendChild(el);
      slotEls[i] = el;
    });
  }
  refreshBed();

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
    if (visiting) { toast('your shed lives at your own homestead'); return; }
    // ⚠️ the remote bag let an UNCLAIMED visitor buy the tent from the road,
    // and the claim veil then ambushed them mid-play (found by the QA harness)
    if (!state.claimedAt) { toast('walk in through the gate first — this clearing can be yours'); return; }
    openShop('shed', true);
  });
  initTravel({ here: 'homestead', mount: document.querySelector('.hs-actions'), btnClass: 'hs-act hs-act--icon', track });

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
  function openCook() { cookEl.hidden = false; renderCook(); track('homestead_kitchen'); }
  document.getElementById('hsCookClose').addEventListener('click', () => { cookEl.hidden = true; });
  cookEl.addEventListener('click', (e) => { if (e.target === cookEl) cookEl.hidden = true; });

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
    const share = document.getElementById('hsShare');
    share.hidden = visiting || !state.slug;
    if (!share.hidden) document.getElementById('hsShareUrl').value = yardUrl();
    guestEl.hidden = false;
    track('homestead_guestbook', { visiting: visiting ? 1 : 0 });
    if (!guestCache && state.slug) {
      renderGuest([]);
      try { guestCache = (await yFetch('/yard?slug=' + state.slug)).guest || []; } catch (e) { guestCache = null; }
    }
    renderGuest(guestCache || []);
  }
  document.getElementById('hsGuestClose').addEventListener('click', () => { guestEl.hidden = true; });
  guestEl.addEventListener('click', (e) => { if (e.target === guestEl) guestEl.hidden = true; });
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
        state.bed.forEach((b) => {
          if (b && cropStage(b) < 4 && b.last !== w.d && (b.planted || '') <= w.d) {
            b.waters = (b.waters | 0) + 1;
            if ((b.last || '') < w.d) b.last = w.d;
            watered++;
          }
        });
        if (w.n) wname = w.n;
      });
      state.wdays = state.wdays.slice(-14);
      if (watered) refreshBed();
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
    lighting: '🏮 Lighting', display: '🏆 Display', fun: '🎈 Fun', community: '🎁 Community' };
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
    if (verb === 'buy') pr.innerHTML = d.price + ' ' + COIN;
    else pr.textContent = 'in the shed';
    const btn = document.createElement('button');
    btn.className = 'hs-btn';
    if (verb === 'buy' && d.stage > state.stage) {
      const need = STRUCT_LADDER[Math.min(d.stage, STRUCT_LADDER.length) - 1];
      btn.textContent = '🔒 ' + (need ? need.key + ' first' : 'locked');
      btn.disabled = true;
      tile.classList.add('is-locked');
    } else if (verb === 'buy') {
      btn.textContent = 'get it';
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
      card.innerHTML = '<div><b>First things first: pitch a tent</b>'
        + '<span>' + TENT_PRICE + ' ' + COIN + ' — pick a colour, move in, and the whole decor'
        + ' catalog opens up. Bananacoins come from playing anywhere in the world.</span></div>';
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
      const grid = document.createElement('div');
      grid.className = 'hs-grid';
      DECOR.filter((d) => curCat === 'all' || d.cat === curCat).forEach((d) => {
        grid.appendChild(shopTile(d, 'buy', () => {
          if (full) { toast('the plot is full — put something away first'); return; }
          if (d.stage > state.stage || coinBalance() < d.price) return;
          passStat('coins_spent', d.price);
          refreshHud();
          track('homestead_buy', { id: d.id, price: d.price });
          closeShop();
          startPlacing(d.id);
        }));
      });
      list.appendChild(grid);
    } else if (tab === 'shed') {
      if (!state.shed.length) {
        const p = document.createElement('p');
        p.className = 'hs-note';
        p.textContent = 'Nothing in the shed — things you pick up land here.';
        list.appendChild(p);
      }
      const grid = document.createElement('div');
      grid.className = 'hs-grid';
      state.shed.forEach((s, i) => {
        const d = DEX[s.id];
        if (!d) return;
        grid.appendChild(shopTile(d, 'place', () => {
          if (state.items.length >= cap()) { toast('the plot is full'); return; }
          state.shed.splice(i, 1);
          save();
          closeShop();
          startPlacing(d.id);
        }));
      });
      list.appendChild(grid);
    } else {   // upgrades (stage ≥ 1 — the tent gate lives above)
      const card = document.createElement('div');
      card.className = 'hs-up';
      const next = STRUCT_LADDER[state.stage];   // stage 1 → roof, 2 → house
      if (next) {
        card.innerHTML = '<div><b>' + next.icon + ' ' + next.name + '</b>'
          + '<span>' + next.price + ' ' + COIN + ' — ' + next.pitch
          + ' The plot grows to ' + CAPS[state.stage + 1] + ' spots.</span></div>';
        const getStyle = stylePicker(state.stage + 1, card);
        const btn = document.createElement('button');
        btn.className = 'hs-btn';
        btn.innerHTML = coinBalance() >= next.price ? next.icon + ' ' + next.name.toLowerCase()
          : 'need ' + next.price + ' ' + COIN + ' — you have ' + coinBalance();
        btn.disabled = coinBalance() < next.price;
        btn.addEventListener('click', () => {
          closeShop();
          startPlacingHome(getStyle(), { price: next.price, toStage: state.stage + 1 });
        });
        card.appendChild(btn);
      } else {
        card.innerHTML = '<div><b>🏠 Fully upgraded</b><span>The homestead stands complete — for now.</span></div>';
      }
      list.appendChild(card);
    }
  }
  function openShop(tab, remote) {
    if (tab) {
      shopEl.dataset.tab = tab;
      shopEl.querySelectorAll('.hs-tabs button').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    }
    // 📦 remote = the action-bar shed: your things, from anywhere. Ordering
    // NEW things stays a walk to the mailbox — that's the place's job.
    shopEl.dataset.remote = remote ? '1' : '';
    const h = document.getElementById('hsShopTitle');
    const p = document.getElementById('hsShopLead');
    if (h) h.textContent = remote ? '📦 Your shed' : '📬 The mailbox';
    if (p) p.textContent = remote
      ? 'Things you own but haven’t placed. New things are ordered at the mailbox.'
      : 'Order from the catalog — cheap things arrive on the spot.';
    shopEl.hidden = false;
    renderShop();
    track(remote ? 'homestead_shed' : 'homestead_mailbox');
  }
  function closeShop() { shopEl.hidden = true; }
  shopEl.addEventListener('click', (e) => {
    if (e.target === shopEl) closeShop();
    const t = e.target.closest('[data-tab]');
    if (t && t.tagName === 'BUTTON') {
      shopEl.dataset.tab = t.dataset.tab;
      shopEl.querySelectorAll('.hs-tabs button').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.tab === t.dataset.tab)));
      renderShop();
    }
  });
  document.getElementById('hsShopClose').addEventListener('click', closeShop);

  // ---- 🪴 placing: the ghost + the confirm bar -----------------------------
  const snap = (v) => Math.round(v / 24) * 24;
  function spotOk(d, x, y) {
    const P = plotNow();
    if (x - d.w / 2 < P[0] || x + d.w / 2 > P[2]) return false;
    if (x < P[0] + 10 || x > P[2] - 10 || y < P[1] + 24 || y > P[3] - 6) return false;
    if (inRect(x, y, [state.bedAt.x - BED.w / 2 - 26, state.bedAt.y - BED.h - 46, state.bedAt.x + BED.w / 2 + 26, state.bedAt.y + 16])) return false;
    // keep clear of the structure's FOOTPRINT only — the front yard below the
    // porch stays decoratable (the max stress test caught the old box banning it)
    const sd = structDims();
    if (state.stage >= 1 && Math.abs(x - state.home.x) < sd.w * 0.52 + d.w * 0.3
      && y > state.home.y - sd.h * 0.62 && y < state.home.y + 12) return false;
    if (Math.hypot(x - MAILBOX.x, y - MAILBOX.y) < 50) return false;
    for (const it of state.items) {
      if (placing && placing.moving === it) continue;
      const o = DEX[it.id];
      if (Math.abs(x - it.x) < (d.w + o.w) * 0.32 && Math.abs(y - it.y) < 34) return false;
    }
    return true;
  }
  function startPlacing(id, moving) {
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
  const fixDims = () => placing.key === 'bed' ? { w: BED.w, h: BED.h } : STRUCTS[placing.key];
  function homeOk(x, y) {
    const d = fixDims();
    const P = plotNow();
    if (x - d.w / 2 < P[0] - 2 || x + d.w / 2 > P[2] + 2) return false;
    if (y - d.h < P[1] - 44 || y > P[3] - 8) return false;
    const foot = [x - d.w * 0.52, y - d.h * 0.62, x + d.w * 0.52, y + 12];
    if (placing.key !== 'bed') {   // structures keep off the bed…
      const b = [state.bedAt.x - BED.w / 2 - 20, state.bedAt.y - BED.h - 40, state.bedAt.x + BED.w / 2 + 20, state.bedAt.y + 16];
      if (foot[0] < b[2] && foot[2] > b[0] && foot[1] < b[3] && foot[3] > b[1]) return false;
    } else if (state.stage >= 1) { // …and the bed keeps off the structure
      const sd = STRUCTS[curStyleKey()];
      const h2 = [state.home.x - sd.w * 0.52 - 20, state.home.y - sd.h * 0.62 - 20, state.home.x + sd.w * 0.52 + 20, state.home.y + 24];
      if (foot[0] < h2[2] && foot[2] > h2[0] && foot[1] < h2[3] && foot[3] > h2[1]) return false;
    }
    return true;
  }
  function startPlacingHome(key, opts) {
    cancelPlacing();
    const d = key === 'bed' ? { w: BED.w, h: BED.h } : STRUCTS[key];
    const el = document.createElement('div');
    el.className = 'hs-it hs-it--ghost';
    el.style.width = pct(d.w, W);
    el.style.height = pct(d.h, H);
    el.style.backgroundImage = "url('/assets/homestead/ov-" + key + ".png')";
    world.appendChild(el);
    const from = key === 'bed' ? state.bedAt : state.home;
    placing = { home: true, key, x: from.x, y: from.y, el,
      price: (opts && opts.price) || 0, toStage: (opts && opts.toStage) || 0 };
    camFree = { x: placing.x, y: placing.y };
    view.classList.add('is-placing');
    updateGhost();
    confirmEl.hidden = false;
    hint(false);
    toast('choose where it stands — drag to look, tap to try', 3600);
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
    if (placing.toStage) {   // this placement completes an UPGRADE
      passStat('coins_spent', placing.price);
      state.stage = placing.toStage;
      state.style = state.style || {};
      state.style[placing.toStage] = placing.key;
      const rung = STRUCT_LADDER[placing.toStage - 1];
      track('homestead_upgrade', { to: placing.key });
      if (!swept.length) toast(rung.icon + ' ' + rung.name.toLowerCase() + ' — done');
    } else {
      track('homestead_move_home');
    }
    if (key === 'bed') state.bedAt = { x, y };
    else state.home = { x, y };
    placing.el.remove();
    placing = null;
    confirmEl.hidden = true;
    camFree = null;
    view.classList.remove('is-placing');
    save();
    const grew = fenceTier() !== fenceOn;
    refreshFence();
    refreshTent(); refreshBed(); rebuildSolids(); refreshItems(); refreshHud();
    float(x, y - (key === 'bed' ? BED.h : STRUCTS[key].h) - 8, '✓');
    if (grew) setTimeout(() => toast('🌱 the fence moved out — more land is yours'), 1400);
  }

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
    if (!state.bed.some((b) => b && cropStage(b) < 4)) { toast('nothing growing right now'); return; }
    yFetch('/water', { slug: state.slug, name: myName }).then((r) => {
      try { localStorage.setItem(wkey, dayStr()); } catch (e) {}
      state.wtoday = true;
      if (r.already) { toast('someone beat you to the watering can today'); return; }
      state.bed.forEach((b, i) => {
        if (b && cropStage(b) < 4) { const s = slotAt(i); float(s[0], s[1] - 44, '💧'); }
      });
      toast('💧 you watered ' + state.name + ' — it counts overnight');
      track('homestead_neighbor_water');
    }).catch(() => toast('the watering can is empty — try again in a bit'));
  }

  function bedTap(i) {
    clearBedChip();
    if (visiting) { visitorWater(); return; }
    const s = slotAt(i);
    const b = state.bed[i];
    if (!b) {
      bedChip = document.createElement('div');
      bedChip.className = 'hs-chip';
      CROPS.forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'hs-btn';
        btn.innerHTML = c.name + ' · ' + c.seed + ' ' + COIN;
        btn.disabled = coinBalance() < c.seed;
        btn.addEventListener('click', () => {
          passStat('coins_spent', c.seed);
          state.bed[i] = { crop: c.id, waters: 0, last: '', planted: dayStr() };
          save(); refreshBed(); refreshHud(); clearBedChip();
          float(s[0], s[1] - 44, '🌱');
          track('homestead_plant', { crop: c.id });
        });
        bedChip.appendChild(btn);
      });
      bedChip.style.left = pct(s[0], W);
      bedChip.style.top = pct(s[1] - 52, H);
      bedChip.style.zIndex = '3000';
      world.appendChild(bedChip);
      return;
    }
    if (cropStage(b) >= 4) {
      // 🧺 harvests fill the PANTRY, not the wallet — the kitchen is the value
      state.pantry[b.crop] = (state.pantry[b.crop] || 0) + 1;
      state.bed[i] = null;
      save(); refreshBed();
      float(s[0], s[1] - 46, '+1 ' + (CROP_EMO[b.crop] || '🧺'));
      track('homestead_harvest', { crop: b.crop });
      if (state.stage < 2) toast('into the pantry — a real roof comes with a stove 🍳', 2800);
      return;
    }
    if (b.last === dayStr()) { float(s[0], s[1] - 44, '💤 tomorrow'); return; }
    b.last = dayStr();
    b.waters = (b.waters | 0) + 1;
    save(); refreshBed();
    float(s[0], s[1] - 44, '💧');
    track('homestead_water', { crop: b.crop });
  }

  // 🖐 placing gestures: DRAG pans the camera, TAP tries the spot. Never both
  // from one action — the pan threshold decides which one this gesture was.
  let gest = null;   // { x0, y0, cam0x, cam0y, panning }
  function ghostTo(e) {
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    if (placing.home) {
      const d = fixDims();
      const P = plotNow();
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
    if (!placing || panelOpen()) return;
    if (e.target.closest('.wh') || e.target.closest('.hs-actions') || e.target.closest('.hs-confirm')) return;
    gest = { x0: e.clientX, y0: e.clientY, cam0x: camFree.x, cam0y: camFree.y, panning: false };
  });
  view.addEventListener('pointermove', (e) => {
    if (!gest || !placing) return;
    const dx = e.clientX - gest.x0, dy = e.clientY - gest.y0;
    if (!gest.panning && Math.hypot(dx, dy) < 9) return;   // still a tap so far
    gest.panning = true;
    // the world follows the finger: drag left = look right
    camFree.x = Math.max(0, Math.min(W, gest.cam0x - dx / scale));
    camFree.y = Math.max(0, Math.min(H, gest.cam0y - dy / scale));
  });
  addEventListener('pointerup', (e) => {
    if (gest && placing && !gest.panning) ghostTo(e);   // a clean tap places
    gest = null;
  });

  // ---- taps ---------------------------------------------------------------
  view.addEventListener('click', (e) => {
    if (e.target.closest('.wh') || e.target.closest('.hs-actions') || e.target.closest('.hs-chip')) return;
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
    // the mailbox: near = open, far = walk to it
    if (Math.hypot(wx - MAILBOX.x, wy - (MAILBOX.y - 20)) < 46) {
      if (Math.hypot(pos.x - MAILBOX.x, pos.y - MAILBOX.y) < 110) {
        if (visiting) { toast('📬 answers only to ' + state.name); return; }
        openShop(); return;
      }
      tgt.x = MAILBOX.x - 40; tgt.y = MAILBOX.y + 16;
      return;
    }
    // 🪧 the sign: near = the guestbook, far = walk to it
    if (Math.hypot(wx - SIGN.x, wy - (SIGN.y - 30)) < 56) {
      if (Math.hypot(pos.x - SIGN.x, pos.y - SIGN.y) < 130) { openGuest(); return; }
      tgt.x = SIGN.x - 44; tgt.y = SIGN.y + 6;
      return;
    }
    // the tent spot (stage 0): near = the upgrades tab, far = walk over
    if (!visiting && state.stage < 1 && Math.abs(wx - state.home.x) < 76 && wy > state.home.y - 84 && wy < state.home.y + 8) {
      if (Math.hypot(pos.x - state.home.x, pos.y - state.home.y) < 150) { openShop('up'); return; }
      tgt.x = state.home.x; tgt.y = state.home.y + 40;
      return;
    }
    // a bed slot
    for (let i = 0; i < BED.slots.length; i++) {
      const s = slotAt(i);
      if (Math.hypot(wx - s[0], wy - (s[1] - 16)) < 32) {
        if (Math.hypot(pos.x - s[0], pos.y - s[1]) < 120) bedTap(i);
        else { tgt.x = s[0]; tgt.y = s[1] + 40; }
        return;
      }
    }
    // the bed itself (off-slot): near = offer the move, far = walk over
    if (Math.abs(wx - state.bedAt.x) < BED.w / 2 && wy > state.bedAt.y - BED.h && wy < state.bedAt.y + 6) {
      if (Math.hypot(pos.x - state.bedAt.x, pos.y - state.bedAt.y) < BED.w / 2 + 90) {
        if (visiting) { visitorWater(); return; }
        clearChip();
        itChip = document.createElement('div');
        itChip.className = 'hs-chip';
        const mv = document.createElement('button');
        mv.className = 'hs-btn';
        mv.textContent = '\u2725 move the bed';
        mv.addEventListener('click', () => { clearChip(); startPlacingHome('bed', {}); });
        itChip.append(mv);
        itChip.style.left = pct(state.bedAt.x, W);
        itChip.style.top = pct(state.bedAt.y - BED.h - 12, H);
        itChip.style.zIndex = '3000';
        world.appendChild(itChip);
      } else { tgt.x = state.bedAt.x; tgt.y = state.bedAt.y + 34; }
      return;
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
          if (state.stage >= 2) {   // 🍳 a real roof comes with a stove
            const ck = document.createElement('button');
            ck.className = 'hs-btn';
            ck.textContent = '🍳 cook';
            ck.addEventListener('click', () => { clearChip(); openCook(); });
            itChip.prepend(ck);
            if (INTERIORS[state.stage >= 3 ? 3 : 2]) {   // 🚪 and a front door
              const go = document.createElement('button');
              go.className = 'hs-btn';
              go.textContent = '🚪 step inside';
              go.addEventListener('click', () => { clearChip(); enterHome(); });
              itChip.prepend(go);
            }
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
