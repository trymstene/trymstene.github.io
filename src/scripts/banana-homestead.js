// 🏡 THE HOMESTEAD — your own clearing west of the park (task #106, M0).
//
// The world's first PERSONAL space: claim the plot, name it, buy decor at the
// mailbox, place it anywhere on your lawn (three verbs: place / move / put
// away), pitch the tent, grow the bed. M0 state is device-local (hs-v1);
// the YardRoom DO + slugs arrive with visiting (M1) — the shape below is
// already the DO's document so nothing migrates.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { passStat } from '../lib/banana-pass.js';
import { catCustom, loadCatalog } from '../lib/drops.js';
import { mountHud, coinBalance } from '../lib/world-hud.js';
import { initTravel } from './world-travel.js';
import { askName } from '../lib/banana-id.js';
import { WORLD, BOUND, ROAD, GATE, SPAWN, FENCE, PLOT, BED, TENT, STRUCTS, MAILBOX, SIGN,
  OB_RECTS, OVERLAYS } from './homestead-geo.js';
import { DECOR } from '../data/decor.js';

const view = document.getElementById('hsView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

const HS_KEY = 'hs-v1';
// ⚠️ STRESS-TESTED 3 Aug (?hstest=full): 16 items on the 19×10-tile lawn read
// as ~15% furnished — "full" must LOOK like a lived-in yard, so the caps rose.
const CAPS = [12, 28, 42, 56];   // placement spots per stage — each rung adds room
// 🏠 the structure ladder: stage n stands STRUCT_LADDER[n-1] at the TENT spot
const STRUCT_LADDER = [
  { key: 'tent', price: 50, name: 'Pitch a tent', icon: '⛺',
    pitch: 'move in, and the whole decor catalog opens up.' },
  { key: 'cabin', price: 250, name: 'Raise the cabin', icon: '🛖',
    pitch: 'a real roof — the plot grows and the fancier catalog unlocks.' },
  { key: 'house', price: 600, name: 'Build the house', icon: '🏠',
    pitch: 'the full homestead — the grandest things arrive in the catalog.' },
];
const CROPS = [
  { id: 'tomato', name: 'Tomato', seed: 3, pay: 6 },
  { id: 'pumpkin', name: 'Pumpkin', seed: 3, pay: 6 },
  { id: 'wheat', name: 'Wheat', seed: 3, pay: 6 },
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
  if (kind === 'tent') {
    s = { ...base, stage: 1,
      items: [{ id: 'sunflower', x: 480, y: 520 }, { id: 'bench', x: 640, y: 380 }],
      shed: [{ id: 'lantern' }] };
  }
  if (kind === 'full') {
    s = { ...base, stage: 1,
      items: [
        { id: 'statue', x: 430, y: 410 }, { id: 'bench', x: 620, y: 360 },
        { id: 'table', x: 1050, y: 400 }, { id: 'campfire', x: 890, y: 580 },
        { id: 'lantern', x: 990, y: 540 }, { id: 'lantern', x: 1180, y: 470 },
        { id: 'sunflower', x: 400, y: 330 }, { id: 'redflower', x: 445, y: 340 },
        { id: 'blueflower', x: 490, y: 330 }, { id: 'pinkvase', x: 545, y: 350 },
        { id: 'bush', x: 1250, y: 350 }, { id: 'bush', x: 1230, y: 560 },
        { id: 'stump', x: 960, y: 660 }, { id: 'scarecrow', x: 560, y: 540 },
        { id: 'sunflower', x: 1120, y: 340 }, { id: 'redflower', x: 1165, y: 355 },
        { id: 'blueflower', x: 600, y: 330 }, { id: 'pinkvase', x: 655, y: 345 },
        { id: 'sunflower', x: 705, y: 330 }, { id: 'bush', x: 420, y: 480 },
        { id: 'bush', x: 400, y: 630 }, { id: 'stump', x: 430, y: 730 },
        { id: 'lantern', x: 1140, y: 720 }, { id: 'campfire', x: 1255, y: 700 },
        { id: 'table', x: 910, y: 340 }, { id: 'bench', x: 1000, y: 320 },
        { id: 'statue', x: 1255, y: 630 }, { id: 'scarecrow', x: 850, y: 710 },
      ],
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
    s = { ...base, stage: 3, items,
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

function init() {
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

  const state = withHome(loadState());
  const save = () => { try { localStorage.setItem(HS_KEY, JSON.stringify(state)); } catch (e) {} };
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
  const structDims = () => {
    const c = curStruct();
    return c ? STRUCTS[c.key] : { w: 140, h: 74 };
  };
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
    const c = curStruct();
    const sig = c.key + ':' + state.home.x + ',' + state.home.y;
    if (structKey === sig) return;
    if (structEl) structEl.remove();
    const d = STRUCTS[c.key];
    structEl = document.createElement('div');
    structEl.className = 'hs-ov';
    structEl.style.left = pct(state.home.x - d.w / 2, W);
    structEl.style.top = pct(state.home.y - d.h, H);
    structEl.style.width = pct(d.w, W);
    structEl.style.height = pct(d.h, H);
    structEl.style.backgroundImage = "url('/assets/homestead/ov-" + c.key + ".png')";
    depth(structEl, state.home.y);
    world.appendChild(structEl);
    structKey = sig;
  }
  refreshTent();

  // ---- placed decor -------------------------------------------------------
  const DEX = {};
  DECOR.forEach((d) => { DEX[d.id] = d; });
  const itemEls = [];
  function itemDiv(it, ghost) {
    const d = DEX[it.id];
    const el = document.createElement('div');
    el.className = 'hs-it' + (ghost ? ' hs-it--ghost' : '');
    el.style.left = pct(it.x - d.w / 2, W);
    el.style.top = pct(it.y - d.h, H);
    el.style.width = pct(d.w, W);
    el.style.height = pct(d.h, H);
    el.style.backgroundImage = "url('" + d.img + "')";
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
    if (x < BOUND || y < BOUND || y > H - BOUND) return true;
    if (x > W - BOUND && !inRoadLane(y)) return true;      // east = the road out
    for (const r of OB_RECTS) if (inRect(x, y, r)) return true;
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

  // ---- juice --------------------------------------------------------------
  function float(x, y, text) {
    const d = document.createElement('div');
    d.className = 'hs-float';
    d.textContent = text;
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
  document.getElementById('hsBag').addEventListener('click', () => openShop('shed', true));
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
  const confirmEl = document.getElementById('hsConfirm');
  const panelOpen = () => !claimEl.hidden || !shopEl.hidden;

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
    lighting: '🏮 Lighting', display: '🏆 Display', fun: '🎈 Fun' };
  function shopTile(d, verb, cb) {
    const tile = document.createElement('div');
    tile.className = 'hs-tile';
    const im = document.createElement('img');
    im.src = d.img; im.alt = ''; im.loading = 'lazy';
    const nm = document.createElement('b');
    nm.textContent = d.name;
    const pr = document.createElement('em');
    pr.textContent = verb === 'buy' ? d.price + ' 🪙' : 'in the shed';
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
      card.innerHTML = '<img src="/assets/homestead/ov-tent.png" alt=""><div><b>First things first: pitch a tent</b>'
        + '<span>' + TENT_PRICE + ' 🪙 — move in, and the whole decor catalog opens up.'
        + ' Bananacoins come from playing anywhere in the world.</span></div>';
      const btn = document.createElement('button');
      btn.className = 'hs-btn';
      btn.textContent = coinBalance() >= TENT_PRICE ? '⛺ pitch it' : 'need ' + TENT_PRICE + ' 🪙 — you have ' + coinBalance();
      btn.disabled = coinBalance() < TENT_PRICE;
      btn.addEventListener('click', () => {
        closeShop();
        startPlacingHome('tent', { price: TENT_PRICE, toStage: 1 });
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
      const next = STRUCT_LADDER[state.stage];   // stage 1 → cabin, 2 → house
      if (next) {
        card.innerHTML = '<img src="/assets/homestead/ov-' + next.key + '.png" alt="">'
          + '<div><b>' + next.icon + ' ' + next.name + '</b>'
          + '<span>' + next.price + ' 🪙 — ' + next.pitch
          + ' The plot grows to ' + CAPS[state.stage + 1] + ' spots.</span></div>';
        const btn = document.createElement('button');
        btn.className = 'hs-btn';
        btn.textContent = coinBalance() >= next.price ? next.icon + ' ' + next.name.toLowerCase()
          : 'need ' + next.price + ' 🪙 — you have ' + coinBalance();
        btn.disabled = coinBalance() < next.price;
        btn.addEventListener('click', () => {
          closeShop();
          startPlacingHome(next.key, { price: next.price, toStage: state.stage + 1 });
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
    if (x - d.w / 2 < PLOT[0] || x + d.w / 2 > PLOT[2]) return false;
    if (x < PLOT[0] + 10 || x > PLOT[2] - 10 || y < PLOT[1] + 24 || y > PLOT[3] - 6) return false;
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
    const x = snap(moving ? moving.x : Math.max(PLOT[0] + 60, Math.min(PLOT[2] - 60, pos.x)));
    const y = snap(moving ? moving.y : Math.max(PLOT[1] + 60, Math.min(PLOT[3] - 30, pos.y)));
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
    if (x - d.w / 2 < PLOT[0] - 2 || x + d.w / 2 > PLOT[2] + 2) return false;
    if (y - d.h < PLOT[1] - 44 || y > PLOT[3] - 8) return false;
    const foot = [x - d.w * 0.52, y - d.h * 0.62, x + d.w * 0.52, y + 12];
    if (placing.key !== 'bed') {   // structures keep off the bed…
      const b = [state.bedAt.x - BED.w / 2 - 20, state.bedAt.y - BED.h - 40, state.bedAt.x + BED.w / 2 + 20, state.bedAt.y + 16];
      if (foot[0] < b[2] && foot[2] > b[0] && foot[1] < b[3] && foot[3] > b[1]) return false;
    } else if (state.stage >= 1) { // …and the bed keeps off the structure
      const sd = STRUCTS[curStruct().key];
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
      const rung = STRUCT_LADDER[placing.toStage - 1];
      track('homestead_upgrade', { to: rung.key });
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
    refreshTent(); refreshBed(); rebuildSolids(); refreshItems(); refreshHud();
    float(x, y - (key === 'bed' ? BED.h : STRUCTS[key].h) - 8, '✓');
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
  function bedTap(i) {
    clearBedChip();
    const s = slotAt(i);
    const b = state.bed[i];
    if (!b) {
      bedChip = document.createElement('div');
      bedChip.className = 'hs-chip';
      CROPS.forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'hs-btn';
        btn.textContent = c.name + ' · ' + c.seed + ' 🪙';
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
      const c = CROPS.find((x) => x.id === b.crop) || CROPS[0];
      passStat('coins_earned', c.pay);
      state.bed[i] = null;
      save(); refreshBed(); refreshHud();
      float(s[0], s[1] - 46, '+' + c.pay + ' 🪙');
      track('homestead_harvest', { crop: c.id });
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
      placing.x = snap(Math.max(PLOT[0] + d.w / 2, Math.min(PLOT[2] - d.w / 2, wx)));
      placing.y = snap(Math.max(PLOT[1] + Math.min(d.h * 0.5, 120), Math.min(PLOT[3] - 10, wy)));
    } else {
      placing.x = snap(Math.max(PLOT[0] + 12, Math.min(PLOT[2] - 12, wx)));
      placing.y = snap(Math.max(PLOT[1] + 26, Math.min(PLOT[3] - 8, wy)));
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
    // the mailbox: near = open, far = walk to it
    if (Math.hypot(wx - MAILBOX.x, wy - (MAILBOX.y - 20)) < 46) {
      if (Math.hypot(pos.x - MAILBOX.x, pos.y - MAILBOX.y) < 110) { openShop(); return; }
      tgt.x = MAILBOX.x - 40; tgt.y = MAILBOX.y + 16;
      return;
    }
    // the tent spot (stage 0): near = the upgrades tab, far = walk over
    if (state.stage < 1 && Math.abs(wx - state.home.x) < 76 && wy > state.home.y - 84 && wy < state.home.y + 8) {
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
          clearChip();
          itChip = document.createElement('div');
          itChip.className = 'hs-chip';
          const mv = document.createElement('button');
          mv.className = 'hs-btn';
          mv.textContent = '✥ move the ' + curStruct().key;
          mv.addEventListener('click', () => { clearChip(); startPlacingHome(curStruct().key, {}); });
          itChip.append(mv);
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
      depth(meEl, pos.y);
    }
    // stepping INTO the yard (through the south gate) triggers the claim
    if (!state.claimedAt && pos.x > FENCE[0] && pos.x < FENCE[2] && pos.y < FENCE[3] - 26) offerClaim();
    drawMe();
    doorTick();
    cam();
  }
  assetsReady().then(() => {
    drawMe();
    place(meEl, pos.x, pos.y, ME_ANCHOR);
    depth(meEl, pos.y);
    requestAnimationFrame((t) => { last = t; step(t); });
  });
}

if (view) init();
