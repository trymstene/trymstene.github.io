// 🌟 the yard badges: two bundled pixel icons (the full pack is gitignored — never a pack URL)
import pxStar from '../icons/pixelart/star-solid.svg?raw';
import pxCrown from '../icons/pixelart/crown-solid.svg?raw';
import pxEdit from '../icons/pixelart/edit.svg?raw';
// 🏡 THE HOMESTEAD — your own clearing west of the park (task #106, M0).
//
// The world's first PERSONAL space: claim the plot, name it, buy decor at the
// mailbox, place it anywhere on your lawn (three verbs: place / move / put
// away), pitch the tent, grow the bed. M0 state is device-local (hs-v1);
// the YardRoom DO + slugs arrive with visiting (M1) — the shape below is
// already the DO's document so nothing migrates.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { passStat, passGet, passSpend, buffGet, buffSet, seedCount, seedUse, ruleUsed, coinsPaid, passNakDone } from '../lib/banana-pass.js';
import { loggedIn } from '../lib/pass-sync.js';
import { catCustom, loadCatalog, fullOutfit } from '../lib/drops.js';
import { wearToCustom } from '../lib/wear-render.js';
import { mountHud, coinBalance, gardenerCardHtml } from '../lib/world-hud.js';
import { gardenerLvlFor } from '../lib/pass-defs.js';
import { initTravel } from './world-travel.js';
import { initSteer } from './world-steer.js';

import { askName } from '../lib/banana-id.js';
import { worldOwner, worldSid, worldToken, presenceRoom, poofInto } from '../lib/world.js';
import { WORLD, BOUND, ROAD, GATE, FENCE_TIERS, TENT, STRUCTS, STRUCT_STYLES,
  MAILBOX, SIGN, SIGNS, OB_RECTS, OVERLAYS, BIRDS, INTERIORS } from './homestead-geo.js';
import { DECOR } from '../data/decor.js';

const view = document.getElementById('hsView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// 🪙 prices wear the REAL bananacoin, never the stock emoji (Trym)
// ⚠️ the 44px stand coin, smooth-DOWNSCALED to 14px (no pixelated) — the
// 16px art upscaled anywhere read as mush (Trym); one coin, one look, sitewide
const COIN = '<img class="hs-coin" src="/assets/banana-stand/coin.png" width="14" height="14" alt="bananacoins">';

// 🏡 THE NEIGHBOURHOOD (M1): every claimed yard has a public mirror in the
// YardRoom DO. worldOwner() owns it; the browser's hs-v1 stays the truth.
const YARD_API = 'https://banana-rave.trymstene.workers.dev/yards';
async function yFetch(path, body) {
  const r = await fetch(YARD_API + path, body ? {
    method: 'POST',
    body: JSON.stringify({ ...body, pass: worldOwner(), alt: worldSid(), wt: worldToken() }),   // 🪪 id + proof
  } : undefined);
  if (!r.ok) {
    const e = new Error('yard ' + r.status);
    e.status = r.status;
    try { e.body = await r.json(); } catch (x) {}
    throw e;
  }
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
// ⚠️ 30 Aug, same standard applied to the TOP rung (Trym: "we need to expand
// the area you can build on once you've upgraded to full house"). Measured on
// ?hstest=max: the stage-3 plot is 26×9 = 234 tiles and a MAXED yard filled
// 53 of them — 23%. The ground was never the limit; this number was, and the
// house alone eats 7 tiles of width. The full house is the last rung and the
// biggest purchase in the world at 900 coins, so it gets the big jump: room to
// actually furnish the land you paid for, at ~41% covered, walking space kept.
const CAPS = [12, 28, 42, 96];   // placement spots per stage — each rung adds room
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
  { id: 'radish', name: 'Radish', seed: 3 },
  { id: 'tomato', name: 'Tomato', seed: 3 },
  { id: 'pumpkin', name: 'Pumpkin', seed: 3 },
  { id: 'wheat', name: 'Wheat', seed: 3 },
  // the park's 28 Aug variety drop — same seeds-from-harvest pipe
  { id: 'carrot', name: 'Carrot', seed: 3 },
  { id: 'strawberry', name: 'Strawberry', seed: 3 },
  { id: 'corn', name: 'Sweetcorn', seed: 3 },
  { id: 'watermelon', name: 'Watermelon', seed: 3 },
  { id: 'grape', name: 'Grapes', seed: 3 },
  { id: 'pineapple', name: 'Pineapple', seed: 3 },
  { id: 'prickly', name: 'Prickly pear', seed: 3 },
  // 🌼 flowers joined the pouch 28 Aug — every park harvest pockets a seed now
  { id: 'daisy', name: 'Daisy', seed: 3 },
  { id: 'sunflower', name: 'Sunflower', seed: 3 },
  { id: 'tulip', name: 'Midnight tulip', seed: 3 },
];
const CROP_EMO = { egg: '🥚', milk: '🥛', cheese: '🧀', radish: '🥬', tomato: '🍅', pumpkin: '🎃', wheat: '🌾', carrot: '🥕', strawberry: '🍓', corn: '🌽', watermelon: '🍉', grape: '🍇', pineapple: '🍍', prickly: '🌵', daisy: '🌼', sunflower: '🌻', tulip: '🌷' };
// 🍳 THE SPINE (M2): crops → the pantry → dishes with WORLD-WIDE effects.
// The multiplier enforces itself inside passStat — one choke point, every area.
const DISHES = [
  // 🍳 SLICE 4 RETUNE — the old table needed park crops behind a 3-9 day
  // grow and a 300-coin wheat seed, which is why homestead_cook read ZERO
  // users ever. One rule now: what the FARM gives (free) cooks into COINS;
  // what the PARK sells (bought seeds) cooks into world-wide BUFFS. The
  // cheapest park ingredient is the 5-coin radish that finishes tomorrow —
  // the outbound pipe, priced for day two.
  // st = the station the ritual plays on (pan/pot on the hob, oven, counter), verb = the bar's word
  { id: 'fried', icon: '🍳', name: 'Fried egg', need: { egg: 2 }, st: 'pan', verb: 'frying',
    pay: 10, blurb: 'sizzles straight into 10 bananacoins' },
  { id: 'greens', icon: '🥗', name: 'Egg & greens', need: { egg: 1, radish: 1 }, st: 'pan', verb: 'tossing',
    pay: 16, blurb: 'tosses straight into 16 bananacoins' },
  { id: 'soup', icon: '🥣', name: 'Creamy soup', need: { milk: 1, carrot: 1 }, st: 'pot', verb: 'simmering',
    pay: 22, blurb: 'simmers straight into 22 bananacoins' },
  { id: 'bouquet', icon: '💐', name: 'Wildflower bouquet', need: { daisy: 1, sunflower: 1 }, st: 'counter', verb: 'tying',
    pay: 18, blurb: 'ties straight into 18 bananacoins' },
  { id: 'board', icon: '🧀', name: 'Cheese board', need: { cheese: 1 }, st: 'counter', verb: 'plating',
    pay: 26, blurb: 'plates straight into 26 bananacoins' },
  { id: 'stew', icon: '🍲', name: 'Campfire stew', need: { tomato: 2 }, st: 'pot', verb: 'simmering',
    fx: 'coins2', mins: 45, blurb: 'double coins · 45 min · everywhere' },
  { id: 'pie', icon: '🥧', name: 'Pumpkin pie', need: { pumpkin: 2 }, st: 'oven', verb: 'baking',
    fx: 'rep2', mins: 45, blurb: 'double XP · 45 min · everywhere' },
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
  // ⚠️ QA MUST NEVER EAT A REAL YARD. Every scenario below overwrites hs-v1
  // and SAVES — which is how Trym's phone lost "Tryms Place" to "Testy's
  // Homestead" (31 Aug): a test URL from the farm walk ran on a device that
  // held a real claim. A scenario now refuses to touch a claimed yard unless
  // that yard is already Testy's; wiping a real one takes hstest=fresh-really.
  let s = null;
  try {
    const cur = JSON.parse(localStorage.getItem(HS_KEY) || 'null');
    if (cur && cur.claimedAt && !/^Testy/.test(cur.name || '')
      && kind !== 'fresh-really' && kind !== 'rich' && kind !== 'pantry') {
      console.warn('hstest: refusing to overwrite the real yard "' + cur.name
        + '" — use ?hstest=fresh-really if you truly mean to wipe it');
      return;
    }
  } catch (e) {}
  if (kind === 'fresh' || kind === 'fresh-really') {
    try { localStorage.removeItem(HS_KEY); } catch (e) {}
    return;
  }
  if (kind === 'rich') {   // a test wallet: balance tops up to ~9999, state untouched
    // ⚠️ through the pass API, never by hand — the ledgers are per-device
    // slots summed on read, so a raw stats write lands in the wrong shape
    // 🧪 …and local-only from here: the server refuses the 'qa' faucet, so
    // this device keeps reading its own ledger instead of the server wallet
    try { sessionStorage.setItem('pass-wallet-off', '1'); } catch (e) {}
    const need = 9999 - coinBalance();
    if (need > 0) passStat('coins_earned', need, 'qa');
    return;
  }
  if (kind === 'pantry') {   // a stocked kitchen shelf on THIS yard (Trym: "no ingredients on ?farm") — additive, device-local, nothing else touched
    try {
      const cur = JSON.parse(localStorage.getItem(HS_KEY) || 'null');
      if (cur) {
        cur.pantry = cur.pantry || {};
        const top = { egg: 4, milk: 3, cheese: 2, radish: 2, carrot: 2, tomato: 2, pumpkin: 2, daisy: 1, sunflower: 1 };
        Object.keys(top).forEach((k) => { cur.pantry[k] = Math.max(cur.pantry[k] || 0, top[k]); });
        // 🧶 and the tailor's side: wool to knit with, and a tailor table in the
        // shed if this yard has none yet (place it yourself — the shed is yours)
        cur.wool = Math.max(cur.wool || 0, 8);
        cur.shed = cur.shed || [];
        const hasTailor = (cur.items || []).some((i) => i.id === 'tailor') || cur.shed.some((i) => i.id === 'tailor');
        if (!hasTailor) cur.shed.push({ id: 'tailor' });
        localStorage.setItem(HS_KEY, JSON.stringify(cur));
      }
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
// 🐔 THE FARM — LIVE FOR EVERYONE since 2 Sep 2026 (the flip). It was
// dark-launched behind a ?farm device switch from 30 Aug to 2 Sep, played on
// prod by Trym first. FARM stays a constant so the flag-off paths can be
// deleted at leisure rather than in a hurry.
const FARM = true;
// the farm's day clock — UTC day numbers, matching the worker's dayOf math.
// qaDayOfs lets ?hstest QA walk time forward without touching the ledger.
let qaDayOfs = 0;
const dayNum = () => Math.floor((Date.now() + qaDayOfs) / 86400000);
// 📊 once-per-session events — the park's latch, so users(event)/users(open)
// and sessions-per-user both read true (nothing here latched before, and the
// analysis that found the harvest cliff was only possible because the park's
// verbs did)
const tracked1 = {};
function track1(name, params) { if (tracked1[name]) return; tracked1[name] = 1; track(name, params); }

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
    // 🐐 their flock, and the trough's OWN clock. Before this the visitor's
    // pen was empty and the trough was painted from the visitor's own farm.
    animals: Array.isArray(d.animals) ? d.animals : [],
    feedAt: +d.feedAt || 0,
    // 🛋 their rooms + feeder clock (worker-sanitized; older docs simply lack them)
    inItems: (d.inItems && typeof d.inItems === 'object') ? d.inItems : {},
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
    state.dirty = 1;   // cleared when /save answers — the pull never overwrites unpushed work
    try { localStorage.setItem(HS_KEY, JSON.stringify(state)); } catch (e) {}
    pushYard();
  };
  // write the state down WITHOUT queueing a push — for bookkeeping fields only
  const saveRaw = () => { try { localStorage.setItem(HS_KEY, JSON.stringify(state)); } catch (e) {} };
  // debounced publish of the public snapshot (the yard the neighbours see)
  let pushT = null;
  function yardBody() {
      // 🛋 rooms travel with the yard now (visitor interiors, 13 Aug):
      // per-tier furnishing lists, trimmed to what the worker will keep
      const pubIn = {};
      [1, 2, 3].forEach((t2) => {
        const l = ((state.inItems || {})[t2] || []).slice(0, 20)
          .map((it) => ({ id: it.id, x: Math.round(it.x), y: Math.round(it.y) }));
        if (l.length) pubIn[t2] = l;
      });
      return { name: state.name, since: state.pubUpdated || undefined, mark: stampMark(), state: {
        stage: state.stage, style: state.style, look: state.look, home: state.home,
        items: state.items, soil: state.soil, fence: state.fence,
        mailAt: state.mailAt, signAt: state.signAt,
        inItems: pubIn,
        // 🥚 what this homestead is holding: the eggs in hand, the kitchen
        // shelf and the furniture still in the shed
        // the trough's own clock, so a visitor sees THIS yard's state
        feedAt: (farmStats().hs_fed || 0) * 86400000 || undefined,
        goods: { eggs: state.eggs || 0, milk: state.milk || 0, wool: state.wool || 0, cheese: state.cheese || 0 },
        pantry: state.pantry || {},
        shed: (state.shed || []).slice(0, 40).map((it) => ({ id: it.id })),
        animals: (state.animals || []).slice(0, 24).map((a) => ({
          sp: a.sp, b: Math.round(a.b || 0), name: a.name || '', wd: Math.round(a.wd || 0),
          gd: a.gd == null ? undefined : Math.round(a.gd),
          pd: Math.round(a.pd || 0),
          id: a.id || undefined, ad: a.ad == null ? undefined : Math.round(a.ad),
          gs: Math.round(a.gs || 0), sd: a.sd == null ? undefined : Math.round(a.sd),
          pa: a.pa || undefined, egg: a.egg ? 1 : undefined,
          hm: a.hm ? { x: Math.round(a.hm.x), y: Math.round(a.hm.y) } : undefined })),
        grass: (state.grass || []).slice(0, 40).map((g) => ({ sp: g.sp, name: g.name || '', b: Math.round(g.b || 0),
          ad: g.ad == null ? undefined : Math.round(g.ad), gs: Math.round(g.gs || 0), sd: g.sd == null ? undefined : Math.round(g.sd),
          id: g.id || undefined, pa: g.pa || undefined, ld: g.ld == null ? undefined : Math.round(g.ld) })),
        memory: (state.memory || []).slice(0, 12).map((m) => ({
          sp: m.sp, b: Math.round(m.b || 0), name: m.name || '',
          gd: m.gd == null ? undefined : Math.round(m.gd),
          rd: m.rd == null ? undefined : Math.round(m.rd),
          id: m.id || undefined, ad: m.ad == null ? undefined : Math.round(m.ad),
          gs: Math.round(m.gs || 0), sd: m.sd == null ? undefined : Math.round(m.sd),
          pa: m.pa || undefined })),   // a rehomed kid keeps her parent on every device (the tree)
      } };
  }
  // the publish MARK, written down BEFORE the publish leaves: a flush at
  // pagehide never gets an answer, and this is how a 409 or the next boot
  // recognises the stamp on the server as this device's own work.
  // ⚠️ THE LAST FEW, not the last one: every attempt mints a fresh mark, so
  // by the time an answer names one, this device has rotated past it.
  function stampMark() {
    state.pubMark = Math.random().toString(36).slice(2, 10);
    state.pubMarks = [...(state.pubMarks || []), state.pubMark].slice(-6);
    try { localStorage.setItem(HS_KEY, JSON.stringify(state)); } catch (e) {}
    return state.pubMark;
  }
  const ourMark = (m) => !!m && (state.pubMarks || []).includes(String(m));
  function pushYard() {
    if (visiting || !state.claimedAt || !state.slug) return;
    clearTimeout(pushT);
    pushT = setTimeout(() => {
      yFetch('/save', yardBody()).then((r) => {
        // ⏱ bookkeeping in SERVER time: the pull adopts a newer published yard
        // only when the server's stamp beats this one and nothing local is
        // still waiting to push — device clocks are never compared
        if (r && r.updated) { state.pubUpdated = r.updated; state.dirty = 0; saveRaw(); }
      }).catch((e) => {
        // 409 = this device synced before the yard's current stamp: another
        // device changed the yard since. Merge theirs in (animals, grass and
        // memories by id — a bought animal never vanishes), then save again.
        if (!String(e && e.message || '').includes('409')) return;
        // the stamp that refused us is OUR OWN unanswered flush: nothing was
        // lost, this device is simply holding an older receipt. Take the
        // stamp and save again — no merge, no reload under the player.
        const b = (e && e.body) || {};
        if (ourMark(b.mark)) {
          state.pubUpdated = b.updated || state.pubUpdated;
          saveRaw();
          pushYard();
          return;
        }
        yardResync();
      });
    }, 2500);
  }
  function yardResync() {
    yFetch('/mine', {}).then((r) => {
      if (!r || !r.slug || r.slug !== state.slug) return;
      const byId = (mine, theirs) => {
        const seen = new Set((theirs || []).map((x) => x.id).filter(Boolean));
        return [...(theirs || []), ...(mine || []).filter((x) => x.id && !seen.has(x.id))];
      };
      // an id this device moved to the long grass or a new home is GONE from
      // the pen on purpose — the server copy predates that, so taking theirs
      // wholesale would put the goat back (and pay to rehome her twice)
      const left = new Set([...(state.memory || []), ...(state.grass || [])].map((x) => x && x.id).filter(Boolean));
      const merged = { ...state, ...syncedFields(r),
        animals: byId(state.animals, r.animals).filter((a) => !(a && left.has(a.id))),
        grass: byId(state.grass, r.grass), memory: byId(state.memory, r.memory) };
      if (Array.isArray(merged.animals)) merged.hens = merged.animals.filter((a) => a.sp === 'hen').length || 0;
      merged.pubUpdated = r.updated || Date.now();
      merged.dirty = 1;
      // ⚠️⭐ THE LOOP. This used to write `merged` to localStorage and leave the
      // in-memory `state` untouched — but the reload below fires `pagehide`,
      // whose beacon calls stampMark(), and stampMark WRITES `state` back over
      // the same key. The merged yard was overwritten by the stale one every
      // single time, so the reloaded page came up with the OLD pubUpdated, its
      // save was refused again, and it resynced and reloaded forever.
      // Adopting into memory first means anything that writes `state` between
      // here and the reload carries the merge instead of undoing it.
      Object.assign(state, merged);
      try { localStorage.setItem(HS_KEY, JSON.stringify(state)); } catch (e) { return; }
      track1('homestead_pull', { how: 'resync' });
      // ⚠️ this path had NO guard at all: it sets dirty = 1, so the reload
      // pushes again, and a push that 409s again comes straight back here.
      // It shares the pull's budget — three reloads in half a minute is a loop
      // whichever door it came through.
      let rs = 0;
      try {
        const b = JSON.parse(localStorage.getItem('hs-pullbudget') || 'null');
        rs = (b && Date.now() - b.t < 30000) ? (b.n || 0) : 0;
      } catch (e) {}
      if (rs >= 2) {
        try { localStorage.removeItem('hs-pullbudget'); } catch (e) {}
        toast('⚠️ Could not save your homestead — the server keeps refusing it. Showing what is saved on this device.', 8000);
        console.warn('[homestead] resync loop stopped', { slug: state.slug, updated: r.updated });
        return;
      }
      try { localStorage.setItem('hs-pullbudget', JSON.stringify({ t: Date.now(), n: rs + 1 })); } catch (e) {}
      toast('⬇️ fetching your homestead…', 2400);
      setTimeout(() => location.reload(), 700);
    }).catch(() => {});
  }
  // a yard still waiting to push when the tab goes away flushes as a beacon
  // (text/plain: no preflight on unload; the worker parses the body as JSON)
  addEventListener('pagehide', () => {
    if (visiting || !state.dirty || !state.claimedAt || !state.slug || !navigator.sendBeacon) return;
    clearTimeout(pushT);
    try {
      navigator.sendBeacon(YARD_API + '/save', new Blob([JSON.stringify({ ...yardBody(), pass: worldOwner(), alt: worldSid(), wt: worldToken() })], { type: 'text/plain' }));
    } catch (e) {}
  });
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
  // ✏️ an EMPTY plank is the claim (Trym: the naming popup landed before
  // anyone knew what the place was): a pencil bobs over the blank sign until
  // it has a name; tapping the sign up close opens the naming card
  const signHint = document.createElement('div');
  signHint.className = 'hs-signhint';
  signHint.innerHTML = pxEdit.replace('<svg ', '<svg width="14" height="14" shape-rendering="crispEdges" aria-hidden="true" ');
  world.appendChild(signHint);
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
    signHint.style.left = pct(state.signAt.x, W);
    signHint.style.top = pct(state.signAt.y - sd2.h - 6, H);
    depth(signHint, state.signAt.y + 201);
  }
  refreshFixtures();
  function refreshSign() {
    signName.textContent = state.name || '';
    signName.hidden = !state.name;
    signHint.style.display = (!state.name && !visiting) ? '' : 'none';
  }
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
    toast(visiting
      ? '👀 peeking into ' + state.name + ' — the door takes you back out'
      : '🏠 home — the door takes you back out');
    track('homestead_enter_home', { tier: inside, visit: visiting ? 1 : 0 });
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
      // shelf stayed empty forever (found 7 Aug wiring the maker pipeline).
      // ⚠️ AND THIS IS WHY THE RETIRE FILTER GOES HERE AND NOT ABOVE: DEX must
      // still get the entry, or a retired piece already standing in somebody's
      // yard would vanish from it. Retiring stops it being SOLD, not owned.
      if (!it.retired) DECOR.push(DEX[it.id]);
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
    if (it.id === 'trough' && !ghost && FARM && fedToday()) {
      el.style.backgroundImage = "url('/assets/homestead/d-trough-full.png')";
    }
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
    // 🪄 a lifted piece STAYS in state (see the ghost-window doctrine at
    // startPlacing) — it just isn't painted twice while its ghost is up
    state.items.forEach((it) => {
      if (placing && placing.moving === it) return;
      if (DEX[it.id]) itemEls.push(itemDiv(it));
    });
    rebuildSolids();
  }
  const inEls = [];
  function refreshInItems() {
    inEls.forEach((el) => el.remove());
    inEls.length = 0;
    if (!inside) return;
    ((state.inItems || {})[inside] || []).forEach((it) => {
      if (placing && placing.moving === it) return;   // its ghost is up
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
      if (placing && placing.moving === it) return;   // a lifted piece has no collider
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
  // the yard's solids — the player's test, and the dog's (she is never indoors)
  function blockedOut(x, y) {
    if (x < BOUND || y < BOUND || y > H - BOUND) return true;
    if (x > W - BOUND && !inRoadLane(y)) return true;      // east = the road out
    for (const r of OB_RECTS) if (inRect(x, y, r)) return true;
    for (const r of fenceRects) if (inRect(x, y, r)) return true;
    for (const r of liveRects) if (inRect(x, y, r)) return true;
    return false;
  }
  // the solid a point stands in (bounds are not a thing you can be inside of)
  function solidAt(x, y) {
    for (const r of OB_RECTS) if (inRect(x, y, r)) return r;
    for (const r of fenceRects) if (inRect(x, y, r)) return r;
    for (const r of liveRects) if (inRect(x, y, r)) return r;
    return null;
  }
  function blocked(x, y) {
    if (inside) {
      const I = INTERIORS[inside];
      if (x < I.box[0] + 6 || x > I.box[0] + I.box[2] - 6
        || y < I.box[1] + 6 || y > I.box[1] + I.box[3] - 6) return true;
      for (const r of I.cols) if (inRect(x, y, r)) return true;
      return false;
    }
    return blockedOut(x, y);
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
  let farmPen = null;       // the largest pen, recomputed when the fence changes
  let farmPens = [];        // all pens — a carried animal can be assigned to any
  let farmPenN = -1;
  let carryA = null;        // ✥ move tool: the animal in your arms
  let henGreeted = false;   // the bond-7 gate greeting fires once per visit
  // the most-bonded animal of any species but the dog (she has her own brain)
  const bestBond = () => farmAnimals().filter((a) => a.sp !== 'dog')
    .reduce((m, a) => (!m || (a.b || 0) > (m.b || 0) ? a : m), null);
  // ⚠️ the ONE owner of "who meets you at the gate": the toast that promises
  // it and the arrival that delivers it both ask here. Any other test was a
  // promise the yard never kept (a goat at 7 behind a hen at 9, the dog)
  const greeter = () => { const g = bestBond(); return g && (g.b || 0) >= 7 ? g : null; };
  // 🚧 the paddock — WHERE YOU PUT HER decides where she stays
  // (Trym: "i cant tell animals where to stay or go"). An animal
  // carried to a spot in the ✥ tool keeps to it: inside a pen, that
  // pen is hers; on open grass, she keeps to that corner. Untouched
  // animals default to the largest pen as before. Open the fence and
  // she simply roams — never destroyed, never blocked. ONE clamp for
  // every target she is handed (wander, the gate greeting, the rituals):
  // the fence is solid for her now, so a target beyond it was a bump
  // and a shrug, not a walk — the greeter comes to her near rail instead
  function penned(a, tx, ty) {
    const pin = a.hm;
    const pen2 = pin
      ? farmPens.find((p) => pin.x > p.x0 && pin.x < p.x1 && pin.y > p.y0 && pin.y < p.y1)
      : farmPen;
    if (pen2 && pen2.int >= 4) {
      return [Math.max(pen2.x0 + 10, Math.min(pen2.x1 - 10, tx)), Math.max(pen2.y0 + 14, Math.min(pen2.y1 - 4, ty))];
    }
    if (pin) return [Math.max(pin.x - 130, Math.min(pin.x + 130, tx)), Math.max(pin.y - 90, Math.min(pin.y + 90, ty))];
    return [tx, ty];
  }
  // 🚶 hand her a destination — the paddock clamp, then the route. The
  // yard's south fence is drawn right across the edge with the gate as its
  // one gap, so a walk between yard and road goes by the gate mouth in two
  // legs (h.via), straight down the middle — never through the pickets.
  // Both ways, so the road is never a trap
  function walkTo(h, x, y) {
    const [tx, ty] = penned(h.a, x, y);
    const south = (yy) => yy > GATE.y + 4, north = (yy) => yy < GATE.y - 30;
    h.via = null;
    if (north(h.y) && south(ty)) { h.tx = GATE.x; h.ty = GATE.y - 46; h.via = [[GATE.x, ROAD.y], [tx, ty]]; }
    else if (south(h.y) && north(ty)) { h.tx = GATE.x; h.ty = ROAD.y; h.via = [[GATE.x, GATE.y - 46], [tx, ty]]; }
    else { h.tx = tx; h.ty = ty; }
    h.waitUntil = 0;
  }
  function henTick(now, dt) {
    const hasCoop = state.items.some((i) => i.id === 'coop');
    if (FARM && (state.fence || []).length !== farmPenN) {
      farmPenN = (state.fence || []).length;
      farmPens = computePens();
      farmPen = farmPens[0] || null;
    }
    // 🐔 FARM: hens are GRANTED at claim (state.hens), not coop-gated — the
    // coop keeps its three strollers on top. Before the claim, ONE hen follows
    // the walk-in: the design's hook is “a hen followed me home”, and she is
    // hen zero of the pair the claim grants. Under reduced motion the flock
    // STANDS — it never vanishes (the trap list's own rule; legacy coop-only
    // behaviour is unchanged with the switch off).
    const want = FARM
      ? (!visiting && !state.claimedAt ? 1 : farmAnimals().length + (hasCoop && !visiting ? 3 : 0))
      : (hasCoop && !REDUCED ? 3 : 0);
    if (!want) {
      while (hens.length) hens.pop().el.remove();
      return;
    }
    while (hens.length > want) hens.pop().el.remove();
    while (hens.length < want) {
      const el = document.createElement('div');
      el.className = 'hs-hen';
      const img = document.createElement('span');
      img.className = 'hs-henimg';   // ⚠️ NOT a bare span — `.hs-hen span` also
      // caught the mood bubble (a span in the same element) and dressed it in
      // the sprite's square box + 400% background (Trym's screenshot: a
      // stretched white slab with the heart in its corner)
      img.style.backgroundImage = "url('/assets/homestead/c-hen" + (hens.length % 3) + ".png')";
      el.appendChild(img);
      world.appendChild(el);
      const anchor = state.items.find((i) => i.id === 'coop')
        || state.items.find((i) => i.id === 'trough')
        || { x: state.home.x + 40, y: state.home.y + 44 };
      const follow = FARM && !visiting && !state.claimedAt;
      // bind this sprite to its entity. A visited flock binds too — it is the
      // neighbour's real animals, read-only: they dress, walk, wear their
      // names and open their card, and every write past here stays gated.
      const flock = (FARM && (visiting || state.claimedAt)) ? farmAnimals() : [];
      const a = flock[hens.length] || null;
      // 🐐 species dress the same skeleton: strip + a size class. The sheep
      // wears the pack's own two states — woolly when wool is ready, the
      // drawn Sheared block otherwise.
      const dr0 = dressFor(a, hens.length);
      el.className = dr0.cls;
      img.style.backgroundImage = dr0.img;
      // per-species anchor from the wardrobe, so the cow stands ON her
      // spot instead of hanging off a hen-sized hook
      const dims = [dr0.hw, dr0.hv];
      const h2 = { el, img, follow, a, yng: dr0.y, hw: dims[0], hv: dims[1],
        x: follow ? pos.x - 60 : anchor.x - 30 + hens.length * 30,
        y: follow ? pos.y + 4 : anchor.y + 20,
        tx: anchor.x, ty: anchor.y + 40, waitUntil: 0, frame: 0, frameAt: 0 };
      // ❤️ bond 7: she MEETS YOU AT THE GATE — once per arrival, the one
      // greeter walks to where the walk-in sets you down (tgt, not the
      // spawn: the road-in is 260px long, and aimed at the spawn she stood
      // alone on the road behind you — the walk)
      if (a && !henGreeted && a === greeter()) {
        henGreeted = true;
        // beside you, not on you (Trym: a greeter zooming into the banana
        // reads as a clump); she ends up facing you
        walkTo(h2, tgt.x + 58, tgt.y + 10);
        // a shy one still comes — the greeting IS trust; the 70px flinch
        // stays off for the walk and the moment (a shy greeter arrived,
        // took one look and stepped away — the walk)
        h2.shyAt = now + 40000;
      }
      hens.push(h2);
      h2.tr = a ? traitsOf(a) : null;
      petBadge(h2);
    }
    // ⚠️ REBIND sprite↔entity every tick — the binding was fixed at creation
    // by index, so after a sale the surviving sprites carried STALE refs to
    // sold animals: Henrietta's new home was written onto a ghost (the walk).
    // Cheap for a flock of ten; re-dress the sprite when its species changed.
    if (FARM && (visiting || state.claimedAt)) {
      const fl = farmAnimals();
      hens.forEach((h4, i4) => {
        const na = fl[i4] || null;
        const yn4 = na && isYoungA(na) ? 1 : 0;
        if (h4.a === na && h4.yng === yn4) return;   // stage change re-dresses too
        h4.a = na;
        if (na) {
          const dr = dressFor(na, i4);
          h4.el.className = dr.cls;
          h4.img.style.backgroundImage = dr.img;
          h4.hw = dr.hw; h4.hv = dr.hv;
          h4.fluff = undefined; h4.dstrip = undefined; h4.dg = undefined;
        }
        h4.yng = yn4;
        h4.tr = na ? traitsOf(na) : null;
        petBadge(h4);
      });
    }
    const P = plotNow();
    for (const h of hens) {
      if (h.follow) {   // trailing the banana up the road, until the claim
        if (state.claimedAt) h.follow = false;
        h.tx = pos.x - 46; h.ty = pos.y + 4;
      }
      if (REDUCED) {    // FARM-only path (legacy returned above): stand still
        if (h.px !== h.x) {
          h.px = h.x; h.py = h.y;
          h.el.style.left = pct(h.x - (h.hw || 16), W);
          h.el.style.top = pct(h.y - (h.hv || 30), H);
          h.el.style.zIndex = String(100 + Math.round(h.y));
        }
        continue;
      }
      // 🐕 the leash became a brain (Trym: glued to the heel she read
      // as part of the banana's own animation). Pens and ✥ pins still
      // never bind her — dogBrain owns her targets every frame.
      if (h.a && h.a.sp === 'dog' && !h.follow) dogBrain(h, now);
      // 🎉 rituals that walk: a graduate comes over to you once; on
      // naming day her best friend comes to hear the new name
      if (h.a && h.a.greet) { delete h.a.greet; walkTo(h, pos.x + 58, pos.y + 10); h.shyAt = now + 40000; }
      if (h.a && h.a.visit) {
        const to = hens.find((o) => o.a && o.a.id === h.a.visit);
        delete h.a.visit;
        if (to) walkTo(h, to.x + 40, to.y + 6);
      }
      // 🎲 a shy one keeps her distance: you within 70px → she steps
      // 60px away (a 3s cooldown keeps it from jitter); nosy is the opposite
      if (h.a && h.tr && h.tr.bold === 0 && !h.follow) {
        const sdx = h.x - pos.x, sdy = h.y - pos.y, sdd = Math.hypot(sdx, sdy);
        if (sdd < 70 && now > (h.shyAt || 0)) {
          h.shyAt = now + 3000;
          h.tx = Math.max(P[0] + 16, Math.min(P[2] - 16, h.x + (sdd ? sdx / sdd : 1) * 60));
          h.ty = Math.max(P[1] + 40, Math.min(P[3] - 10, h.y + (sdd ? sdy / sdd : 0) * 40));
          h.waitUntil = 0;
        }
      }
      const dx = h.tx - h.x, dy = h.ty - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 3 && h.via) {   // next leg of a routed walk, no pause between
        const v = h.via.shift();
        if (!h.via.length) h.via = null;
        h.tx = v[0]; h.ty = v[1]; h.waitUntil = 0;
        continue;
      }
      if (d < 3 && !(h.a && h.a.sp === 'dog')) {
        if (!h.waitUntil) h.waitUntil = now + (h.tr && h.tr.pat === 0 ? 1000 + Math.random() * 2000   // 🎲 restless
          : h.tr && h.tr.pat === 2 ? 5000 + Math.random() * 9000                                 // a dreamer
          : 1500 + Math.random() * 5000);
        if (now > h.waitUntil) {
          h.waitUntil = 0;
          h.tx = Math.max(P[0] + 16, Math.min(P[2] - 16, h.x + (Math.random() * 260 - 130)));
          h.ty = Math.max(P[1] + 40, Math.min(P[3] - 10, h.y + (Math.random() * 160 - 80)));
          // 🎲 TRAITS: where she goes is who she is. 30% of hops toward
          // her best friend, 40% toward her favourite spot, and a nosy one
          // pokes at you every third hop. The pen clamp below still rules.
          if (h.a && h.tr) {
            h.hop = (h.hop || 0) + 1;
            const r0 = Math.random();
            const fr = bestFriend(h.a);
            const frH = fr && hens.find((o) => o.a === fr);
            if (h.tr.bold === 1 && h.hop % 3 === 0 && Math.hypot(pos.x - h.x, pos.y - h.y) < 400) {
              h.tx = pos.x + (Math.random() * 80 - 40); h.ty = pos.y + 30 + Math.random() * 20;
            } else if (r0 < 0.3 && frH) {
              h.tx = frH.x + (Math.random() * 100 - 50); h.ty = frH.y + (Math.random() * 60 - 30);
            } else if (r0 < 0.7) {
              const sp2 = spotOf(h.a);
              if (sp2) { h.tx = sp2.x + (Math.random() * 120 - 60); h.ty = sp2.y + (Math.random() * 60 - 20); }
            }
          }
          // 🐾 PERSONAL SPACE (Trym: "one big overlapping clump of
          // sprites") — a target on top of another animal's spot is pushed
          // 40px away from it before she commits
          for (const o of hens) {
            if (o === h) continue;
            const ox = h.tx - o.x, oy = h.ty - o.y, od = Math.hypot(ox, oy);
            if (od < 40) { h.tx += (od ? ox / od : 1) * (40 - od); h.ty += (od ? oy / od : 0) * (40 - od); }
          }
          // 🚧 the paddock rules her wander too, and the gate its route (walkTo)
          if (h.a) walkTo(h, h.tx, h.ty);
          // the sheep's coat follows its wool: swap strips when the state flips
          if (h.a && h.a.sp === 'sheep' && !isYoungA(h.a)) {
            const wantF = (h.a.wd || 0) >= 3;
            if (h.fluff !== wantF) {
              h.fluff = wantF;
              h.img.style.backgroundImage = "url('/assets/homestead/" + (wantF ? 'c-sheepf.png' : 'c-sheeps.png') + "')";
            }
          }
        }
      } else if (d > 1) {
        // ⚠️ the d > 1 guard is LOAD-BEARING: the dog skips the d<3 idle
        // branch above, so a held position (tx === x) reaches this mover
        // with d = 0 — and dx/d is 0/0 = NaN, which poisoned h.x forever
        // (the sprite froze at its last valid style; the walk found her)
        // 🐕 gait comes from her brain: trot 150 / zoomies 210 /
        // sprint 280 (the banana walks 168 — a slower dog never catches
        // a leaver). Everything else ambles.
        const spd = h.a && h.a.sp === 'dog' ? (h.dspd != null ? h.dspd : 150)
          : 34 * (h.tr ? [0.75, 1, 1.3][h.tr.pace] : 1);   // 🎲 a dawdler, or quick on her feet
        let nx = h.x + dx / d * spd * dt, ny = h.y + dy / d * spd * dt;
        // 🚧 the yard's solids are solid for every animal (Trym: "the dog runs
        // over the fence… the house and other items… animals walk through the
        // cheese press") — they meet the player's own colliders (fences, the
        // house, placed items, trees): a step into one slides along it; a dead
        // stop hands the dog's brain a rest and a grazer a fresh wander target
        // (she pauses, then picks somewhere else). An animal standing INSIDE a
        // solid (spawned there, or a piece set down on her) may only step out
        // by the nearest edge — never across it; "already inside, so free"
        // was how a hen strolled through a whole fence line.
        if (h.a) {
          const inR = solidAt(h.x, h.y);
          let stuck = false;
          if (!inR) {
            if (blockedOut(nx, ny)) {
              if (!blockedOut(nx, h.y)) ny = h.y;
              else if (!blockedOut(h.x, ny)) nx = h.x;
              else stuck = true;
            }
          } else {
            const depth = (x, y) => Math.min(x - inR[0], inR[2] - x, y - inR[1], inR[3] - y);
            if (inRect(nx, ny, inR) && depth(nx, ny) >= depth(h.x, h.y)) stuck = true;
          }
          if (stuck) {
            nx = h.x; ny = h.y;
            if (h.a.sp === 'dog') { if (h.dg) { h.dg.m = 'rest'; h.dg.until = now + 2500; h.dg.heelAt = now; } }
            else { h.tx = h.x; h.ty = h.y; h.waitUntil = 0; h.via = null; }
          }
        }
        h.x = nx; h.y = ny;
        // ⚠️ dx < 0, NOT dx > 0 — the hens walked backwards for exactly this
        // reason (Trym). The bird flip below is `dx > 0` and is RIGHT, because
        // the Garden Birds art faces LEFT; the coop hens face RIGHT. The
        // expression was copied between two sprite sets with opposite native
        // facing. ⚠️ Check which way a new sprite looks before reusing either.
        const fl = dx < 0 ? 'scaleX(-1)' : '';
        if (h.fl !== fl) { h.fl = fl; h.img.style.transform = fl; }
        if (now - h.frameAt > (h.dfr || 140)) {
          h.frameAt = now;
          h.frame = (h.frame + 1) % 4;
        }
      }
      // 🐾 ...and standing animals ease apart (36px) — 20 px/s, so it
      // reads as shuffling room, never as a shove
      for (const o of hens) {
        if (o === h) continue;
        const ox = h.x - o.x, oy = h.y - o.y, od = Math.hypot(ox, oy);
        if (od < 36 && od > 0.01) { h.x += ox / od * 20 * dt; h.y += oy / od * 20 * dt; }
      }
      // ⚡ write-on-change only — an idle hen costs zero DOM
      if (h.pf !== h.frame) {
        h.pf = h.frame;
        h.img.style.backgroundPosition = (h.frame * 100 / 3) + '% 0';
      }
      if (h.px !== h.x || h.py !== h.y) {
        h.px = h.x; h.py = h.y;
        h.el.style.left = pct(h.x - (h.hw || 16), W);
        h.el.style.top = pct(h.y - (h.hv || 30), H);
        h.el.style.zIndex = String(100 + Math.round(h.y));
      }
    }
  }

  // ---- 🐔 THE SMALLHOLDING, slice 1 (dark behind FARM) ------------------
  // The area's headline bug was that it PAYS NOTHING. The hens fix that: two
  // are granted at claim, they lay overnight, the eggs are walk-over pickups,
  // and the gate stall turns them into the area's first coins. Care is a
  // bonus, never rent — an unfed hen still lays, feeding doubles TOMORROW.
  // ⚠️ FUNCTION DECLARATIONS, deliberately — itemDiv calls fedToday() and the
  // boot-time refreshItems() at :867 runs BEFORE this line is reached, so a
  // const here would be a TDZ crash for every returning player with a trough
  // (the rave's module-consts-above-init lesson, nearly repaid in full).
  // ---- 🐣 the wardrobe ---------------------------------------------
  // Age is data (gd = fed mornings; null or 5+ = grown), the look is
  // derived. ONE table dresses creation AND the every-tick rebind — the
  // old ternary chains doubled per species and young forms would have
  // tripled them.
  function isYoungA(a) { return !!a && a.gd != null && a.gd < 5; }
  function dressFor(a, i) {
    const y = isYoungA(a) ? 1 : 0;
    const sp = a && a.sp;
    let r;
    if (sp === 'goat') r = y ? ['ygoat', 'c-ygoat.png', 21, 24] : ['goat', 'c-goat.png', 21, 32];
    else if (sp === 'cow') r = y ? ['ycow', 'c-ycow.png', 24, 32] : ['cow', 'c-cow.png', 30, 34];
    else if (sp === 'rooster') r = y ? ['chick', 'c-chick.png', 11, 12] : ['roost', 'c-roost.png', 16, 30];
    else if (sp === 'sheep') r = y ? ['ysheep', 'c-ysheep.png', 23, 28]
      : ['sheep', (a.wd || 0) >= 3 ? 'c-sheepf.png' : 'c-sheeps.png', 26, 38];
    else if (sp === 'dog') r = ['dog', 'c-dog.png', 31, 36];
    else r = y ? ['chick', 'c-chick.png', 11, 12] : ['', 'c-hen' + (i % 3) + '.png', 16, 30];
    return { y, cls: 'hs-hen' + (r[0] ? ' hs-hen--' + r[0] : ''),
      img: "url('/assets/homestead/" + r[1] + "')", hw: r[2], hv: r[3] };
  }
  // ---- 🐕 THE DOG'S SOUL -------------------------------------------
  // Six moods instead of a leash, tuned so a ~400px phone viewport
  // actually WITNESSES them — the shadow band keeps her at most a step
  // off-screen, and the check-in clock guarantees a visit every 18-30s:
  //   rest    · tail-wagging near the house (or near you), 8-20s
  //   play    · 2-4 zoomies with ground-sniff pauses and a look back
  //   shadow  · drifts along 180-280px behind a moving player
  //   checkin · trots over, heart, lingers, wanders off again
  //   sitby   · you stand still 6s and she comes to sit at your leg
  //   seek    · you CROSS the plot edge outward → 280 px/s sprint (25s
  //             cooldown: fence work AT the boundary never triggers it);
  //             deep in the road she stops at the edge and waits for you
  // Strips share one frame box (bake), so swaps never move her feet.
  // REDUCED motion never reaches this — she freezes with the flock.
  function dogBrain(h, now) {
    const g = h.dg || (h.dg = { m: 'checkin', until: 0, heelAt: now, cd: 0,
      dash: 0, gapUntil: 0, pMoveAt: now, px: pos.x, py: pos.y, wasIn: true, jit: null });
    const P = plotNow();
    const pIn = pos.x > P[0] - 24 && pos.x < P[2] + 24 && pos.y > P[1] - 24 && pos.y < P[3] + 50;
    if (Math.hypot(pos.x - g.px, pos.y - g.py) > 1.5) g.pMoveAt = now;
    g.px = pos.x; g.py = pos.y;
    const pd = Math.hypot(pos.x - h.x, pos.y - h.y);
    // leaving? only an OUTWARD CROSSING counts — never proximity, or she
    // would mob every fence-builder all session
    if (g.wasIn && !pIn && now > g.cd) { g.m = 'seek'; g.cd = now + 25000; }
    g.wasIn = pIn;
    // the guaranteed visit
    if (g.m !== 'seek' && g.m !== 'sitby' && g.m !== 'checkin' && g.m !== 'linger') {
      if (g.jit == null) g.jit = 18000 + Math.random() * 12000;
      if (now - g.heelAt > g.jit) { g.m = 'checkin'; g.jit = null; }
    }
    // you stood still a while — she notices
    if ((g.m === 'rest' || g.m === 'play' || g.m === 'shadow')
      && now - g.pMoveAt > 6000 && pd > 90) { g.m = 'sitby'; }
    let strip = 'c-dog.png', spd = 150, fr = 140;
    const arrive = () => { g.heelAt = now; float(h.x, h.y - 44, '❤️'); if (h.a) h.a.gs = (h.a.gs || 0) + 1;
      g.m = 'linger'; g.until = now + 2500 + Math.random() * 2500; };
    if (g.m === 'seek') {
      spd = 280; fr = 90;
      if (pos.y > P[3] + 60) {
        // she will not follow into the road — she waits at the edge
        h.tx = Math.max(P[0] + 24, Math.min(P[2] - 24, pos.x));
        h.ty = P[3] - 6;
        if (Math.hypot(h.tx - h.x, h.ty - h.y) < 5) { strip = 'c-dogidle.png'; spd = 0; }
      } else {
        h.tx = pos.x - 52; h.ty = pos.y + 6;
        if (pd < 70) arrive();
      }
    } else if (g.m === 'checkin') {
      spd = 210; fr = 110;
      h.tx = pos.x - 52; h.ty = pos.y + 6;
      if (pd < 70) arrive();
    } else if (g.m === 'linger') {
      strip = 'c-dogidle.png'; spd = 0; h.tx = h.x; h.ty = h.y;
      if (now > g.until) { g.m = Math.random() < 0.5 ? 'play' : 'rest'; g.until = 0; g.dash = 0; }
    } else if (g.m === 'sitby') {
      h.tx = pos.x - 40; h.ty = pos.y + 8;
      if (pd < 55) { strip = 'c-dogidle.png'; spd = 0; h.tx = h.x; h.ty = h.y; g.heelAt = now; }
      if (now - g.pMoveAt < 800) { g.m = 'shadow'; }
    } else if (g.m === 'rest') {
      if (!g.until) {
        g.until = now + 8000 + Math.random() * 12000;
        const nearHome = Math.hypot(pos.x - state.home.x, pos.y - state.home.y) < 400;
        const ax = nearHome ? state.home.x : pos.x, ay = nearHome ? state.home.y + 90 : pos.y;
        g.rx = Math.max(P[0] + 30, Math.min(P[2] - 30, ax + (Math.random() * 280 - 140)));
        g.ry = Math.max(P[1] + 50, Math.min(P[3] - 12, ay + (Math.random() * 140 - 40)));
      }
      h.tx = g.rx; h.ty = g.ry;
      if (Math.hypot(g.rx - h.x, g.ry - h.y) < 5) { strip = 'c-dogidle.png'; spd = 0; }
      if (pd > 350) { g.m = 'shadow'; g.until = 0; }
      else if (now > g.until) { g.m = 'play'; g.until = 0; g.dash = 0; }
    } else if (g.m === 'play') {
      spd = 210; fr = 110;
      if (!g.dash && !g.gapUntil) g.dash = 2 + Math.floor(Math.random() * 3);
      if (g.gapUntil && now < g.gapUntil) {
        // the sniff between zoomies — and a look back at you
        strip = 'c-dogeat.png'; spd = 0; h.tx = h.x; h.ty = h.y;
        const fl2 = pos.x < h.x ? 'scaleX(-1)' : '';
        if (h.fl !== fl2) { h.fl = fl2; h.img.style.transform = fl2; }
      } else if (Math.hypot(h.tx - h.x, h.ty - h.y) < 5) {
        if (g.dash <= 0) { g.m = Math.random() < 0.6 ? 'rest' : 'shadow'; g.until = 0; g.gapUntil = 0; }
        else {
          g.dash--;
          g.gapUntil = now + 300 + Math.random() * 600;
          const a2 = Math.random() * Math.PI * 2, r2 = 60 + Math.random() * 120;
          h.tx = Math.max(P[0] + 30, Math.min(P[2] - 30, h.x + Math.cos(a2) * r2));
          h.ty = Math.max(P[1] + 50, Math.min(P[3] - 12, h.y + Math.sin(a2) * r2 * 0.6));
        }
      } else { g.gapUntil = 0; }
      if (pd > 350) { g.m = 'shadow'; g.gapUntil = 0; }
    } else {
      // shadow — the leash that keeps everything else visible
      if (pd > 280) {
        h.tx = pos.x + (h.x - pos.x) / (pd || 1) * 230;
        h.ty = pos.y + (h.y - pos.y) / (pd || 1) * 230;
      } else { h.tx = h.x; h.ty = h.y; strip = 'c-dogidle.png'; spd = 0; }
      if (now - g.pMoveAt > 2500) { g.m = 'rest'; g.until = 0; }
    }
    h.dspd = spd; h.dfr = fr;
    if (h.dstrip !== strip) {
      h.dstrip = strip;
      h.img.style.backgroundImage = "url('/assets/homestead/" + strip + "')";
    }
    // she wags even when she isn't going anywhere
    if (spd === 0 && now - h.frameAt > 300) { h.frameAt = now; h.frame = (h.frame + 1) % 4; }
  }
  // ---- 🐾 LEVELS ------------------------------------------------------
  // Hearts are the XP (hugs, never falling); the LEVEL is read off them,
  // with a real ceiling: Lv 10 = best friends — a state you live in, never
  // a number that keeps climbing (Trym's loop). Lv 3 is the name, Lv 5 the
  // gate greeting — the old rungs, now on the same ladder.
  const LV_AT = [0, 2, 3, 5, 7, 10, 13, 17, 22, 28];
  function lvOf(a) { let l = 1; for (let i = 1; i < LV_AT.length; i++) if ((a.b || 0) >= LV_AT[i]) l = i + 1; return l; }
  function lvNext(a) { const l = lvOf(a); return l >= 10 ? 0 : LV_AT[l] - (a.b || 0); }
  function mintId() { return 100000 + Math.floor(Math.random() * 900000); }
  const he0 = (a) => a.sp === 'rooster';
  const nameOf = (a) => a.name || (he0(a) ? 'he' : 'she');
  // 🎂 her yard-day: every 30 days from the day she arrived
  const yardDay = (a) => a.ad != null && dayNum() > a.ad && (dayNum() - a.ad) % 30 === 0;
  // 🌟 a star from Lv 5, a crown and a golden glow at Lv 10 — worn on
  // the sprite itself, so progress shows from across the yard
  function petBadge(h) {
    const a = h.a;
    const lv = a ? lvOf(a) : 0;
    const want = lv >= 10 ? 'crown-solid' : lv >= 5 ? 'star-solid' : '';
    if (h.bdg === want) return;
    h.bdg = want;
    let s2 = h.el.querySelector('.hs-henbadge');
    if (!want) { if (s2) s2.remove(); h.el.classList.remove('hs-hen--best'); return; }
    if (!s2) { s2 = document.createElement('span'); s2.className = 'hs-henbadge'; h.el.appendChild(s2); }
    s2.innerHTML = (want === 'crown-solid' ? pxCrown : pxStar).replace('<svg ', '<svg width="11" height="11" shape-rendering="crispEdges" aria-hidden="true" ');
    h.el.classList.toggle('hs-hen--best', lv >= 10);
  }
  // ---- 🎲 TRAITS FROM THE SEED ------------------------------------------
  // One hidden number per animal (sd), read the same way every time, is her
  // whole personality — pace, patience, boldness, a favourite spot — plus a
  // best friend picked by nearest seed. No new data, no new art: where she
  // goes and how she moves is who she is. Every word is a compliment.
  function traitsOf(a) {
    const sd = a.sd || 0;
    return { pace: sd % 3, pat: Math.floor(sd / 3) % 3, bold: Math.floor(sd / 9) % 4, spot: Math.floor(sd / 36) % 5 };
  }
  function bestFriend(a) {
    let best = null, bd = 1e9;
    farmAnimals().forEach((o) => {
      if (o === a || o.sp === 'dog') return;
      const d = Math.abs((o.sd || 0) - (a.sd || 0));
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }
  function spotOf(a) {
    const t = traitsOf(a).spot;
    const it = (id) => state.items.find((i) => i.id === id);
    for (let step = 0; step < 5; step++) {   // hers first; fall through if it isn't built
      const k = (t + step) % 5;
      if (k === 0) { const i2 = it('trough'); if (i2) return { x: i2.x, y: i2.y + 22, k }; }
      else if (k === 1) { const i2 = it('fountain'); if (i2) return { x: i2.x, y: i2.y + 34, k }; }
      else if (k === 2) { if (state.home && state.stage >= 1) return { x: state.home.x, y: state.home.y + 64, k }; }
      else if (k === 3) { const i2 = it('coop'); if (i2) return { x: i2.x, y: i2.y + 26, k }; }
      else if (k === 4 && (state.fence || []).length) {
        const ref = a.hm || { x: state.home.x, y: state.home.y + 120 };
        let bc = null, bdd = 1e9;
        state.fence.forEach((c) => { const cx = c.i * 48 + 24, cy = c.j * 48 + 48;
          const d = Math.hypot(cx - ref.x, cy - ref.y); if (d < bdd) { bdd = d; bc = { x: cx, y: cy, k }; } });
        if (bc) return bc;
      }
    }
    return null;
  }
  const BABY_W = { hen: 'chick', rooster: 'chick', goat: 'kid goat', sheep: 'lamb', cow: 'calf' };
  const SPOT_W = ['the trough', 'the well', 'the house', 'the coop', 'the fence'];
  const isOld = (a) => a.ad != null && dayNum() - a.ad >= 90;   // an old friend of the farm
  // 🥚 GENERATIONS — a kid of her own line: her species, her arrival
  // today, ONE of her four traits inherited (the rest rolled fresh), and
  // her id as the parent (the family tree hangs off it)
  function hatchFrom(a, today) {
    const t = traitsOf(a), keep = Math.floor(Math.random() * 4);
    const r3 = () => Math.floor(Math.random() * 3);
    const c = { pace: keep === 0 ? t.pace : r3(), pat: keep === 1 ? t.pat : r3(),
      bold: keep === 2 ? t.bold : Math.floor(Math.random() * 4), spot: keep === 3 ? t.spot : Math.floor(Math.random() * 5) };
    return { sp: a.sp, b: 0, pd: 0, name: '', wd: 0, gd: 0, id: mintId(), ad: today, gs: 0, pa: a.id,
      sd: c.pace + 3 * c.pat + 9 * c.bold + 36 * c.spot + 180 * Math.floor(Math.random() * 50) };
  }
  // 🌾 THE LONG GRASS — the only door out, and only the player opens it.
  // She stops working and starts being remembered: her record moves to
  // state.grass (the album), her slot frees, and if she had an egg waiting
  // it hatches into her place — the generational swap. The day after, the
  // news says where her best friend stood.
  function toGrass(a) {
    const i = state.animals.indexOf(a);
    if (i < 0) return null;
    const bf = bestFriend(a), sp = spotOf(a);
    state.animals.splice(i, 1);
    state.grass = state.grass || [];
    if (state.grass.length < 40) state.grass.push({ sp: a.sp, name: a.name || '', b: a.b || 0, ad: a.ad, gs: a.gs || 0,
      sd: a.sd, id: a.id, pa: a.pa, ld: dayNum() });
    state.hens = state.animals.filter((x) => x.sp === 'hen').length;
    const h = hens.find((o) => o.a === a);
    if (h) float(h.x, h.y - 48, '❤️');
    state.grassNews = 'The yard was quiet this morning.' + (bf
      ? ' ' + (bf.name || 'The ' + bf.sp) + ' stood by ' + (sp ? SPOT_W[sp.k] : 'the gate') + ' a while — ' + (a.name ? a.name + '’s spot.' : 'where she used to stand.') : '');
    let born = null;
    if (a.egg) { born = hatchFrom(a, dayNum()); state.animals.push(born); track1('homestead_hatch', { sp: a.sp, at: 'grass' }); }
    state.hens = state.animals.filter((x) => x.sp === 'hen').length;
    save(); refreshHud();
    toast((a.name || 'She') + ' went into the long grass. ' + (born ? 'Her ' + BABY_W[a.sp] + ' hatched in her place.' : 'She’ll be in the album.'), 5200);
    track1('homestead_long_grass', { born: born ? 1 : 0 });
    return born;
  }
  function farmStats() { return passGet().stats || {}; }
  // ⚠️ WHOSE trough is this? On a visited yard the answer is the yard's own
  // stamp, not the viewer's pass stat — the full/empty sprite and the animals'
  // mood used to show a visitor their OWN farm painted onto somebody else's.
  function fedToday() {
    if (visiting) return Math.floor((state.feedAt || 0) / 86400000) >= dayNum();
    return (farmStats().hs_fed || 0) >= dayNum();
  }
  // 🐔 slice 2: an animal is an ENTITY — { sp, b (bond, only ever up),
  // pd (last pet day), name }. state.hens stays as the count mirror the pen
  // maths reads. Bond and names ride hs-v1 AND the yard sync (yardSan keeps
  // them), so the phone and the desktop agree on who Henrietta is.
  // 🚧 THE PEN TEST — a BOUNDING BOX over each connected fence cluster,
  // never a flood fill, and biased to YES (the doctrine: state.fence is a
  // cell list, not a polygon, and a false "not closed" on a fence the player
  // believes is shut punishes exactly the arranger this design rewards). A
  // cluster is a pen when it reaches all four sides of its own box and holds
  // at least one interior tile; a one-cell gate gap still counts.
  function computePens() {
    const cells = state.fence || [];
    if (cells.length < 8) return [];
    const key = (i, j) => i + ',' + j;
    const set = new Set(cells.map((c) => key(c.i, c.j)));
    const seen = new Set();
    const pens = [];
    for (const c of cells) {
      const k0 = key(c.i, c.j);
      if (seen.has(k0)) continue;
      const q = [c]; seen.add(k0);
      let mnI = c.i, mxI = c.i, mnJ = c.j, mxJ = c.j;
      const members = [];
      while (q.length) {
        const cur = q.pop();
        members.push(cur);
        mnI = Math.min(mnI, cur.i); mxI = Math.max(mxI, cur.i);
        mnJ = Math.min(mnJ, cur.j); mxJ = Math.max(mxJ, cur.j);
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const k2 = key(cur.i + di, cur.j + dj);
          if (!seen.has(k2) && set.has(k2)) { seen.add(k2); q.push({ i: cur.i + di, j: cur.j + dj }); }
        }
      }
      const touches = members.some((m) => m.i === mnI) && members.some((m) => m.i === mxI)
        && members.some((m) => m.j === mnJ) && members.some((m) => m.j === mxJ);
      const inTiles = Math.max(0, mxI - mnI - 1) * Math.max(0, mxJ - mnJ - 1);
      if (touches && inTiles >= 1) {
        pens.push({ mnI, mxI, mnJ, mxJ, int: inTiles,
          // the interior in world px, for wander clamps and the tint
          x0: (mnI + 1) * 48, y0: (mnJ + 1) * 48, x1: mxI * 48, y1: mxJ * 48 });
      }
    }
    return pens.sort((a, b) => b.int - a.int);
  }
  // 📐 capacity reads the LARGEST pen — the ladder as written: ≥4 tiles
  // holds 4 hens, ≥8 adds the goat, ≥12 adds two sheep. One paddock model:
  // every animal lives in the biggest pen when one exists.
  function penCaps() {
    const pens = computePens();
    const big = pens[0];
    return { pens,
      hen: big && big.int >= 4 ? 4 : 2,
      goat: big && big.int >= 8 ? 1 : 0,
      sheep: big && big.int >= 12 ? 2 : 0,
      cow: big && big.int >= 20 ? 1 : 0,
      rooster: 1,
      dog: 1 };   // 🐕 pens are for keeping animals IN — she keeps herself on you
  }
  const spCount = (sp) => farmAnimals().filter((a) => a.sp === sp).length;
  // 🟩 THE LIVE TINT — closed pens light up WHILE the fence tool is in hand
  // (the doctrine: closed must be SEEN during the act, not reported after).
  const penEls = [];
  function penTint() {
    penEls.forEach((e) => e.remove());
    penEls.length = 0;
    if (!FARM || !fencing) return;
    computePens().forEach((p) => {
      const d = document.createElement('div');
      d.className = 'hs-pen';
      d.style.left = pct(p.x0, W); d.style.top = pct(p.y0, H);
      d.style.width = pct(p.x1 - p.x0, W); d.style.height = pct(p.y1 - p.y0, H);
      const t = document.createElement('i');
      // the SAME size-words the market speaks — building the fence is
      // where players learn them
      t.textContent = p.int >= 20 ? 'cow-sized — room for everyone'
        : p.int >= 12 ? 'sheep-sized — sheep would settle here'
        : p.int >= 8 ? 'goat-sized — a goat fits'
        : p.int >= 4 ? 'hen-sized — hens approve' : 'a bit snug — stretch it out';
      d.appendChild(t);
      world.appendChild(d);
      penEls.push(d);
      track1('homestead_pen', { tiles: p.int });
    });
  }
  function farmAnimals() {
    if (!Array.isArray(state.animals)) state.animals = [];
    // ⚠️ READ ONLY on a visited yard: the migrations below MINT ids, arrival
    // days and personality seeds. Run here they would invent a stranger's
    // animals rather than read them.
    if (visiting) return state.animals;
    // ⚠️ the slice-1 count migrates into entities ONCE, flag-gated — this
    // used to run on every call, topping the list back up to the mirror, so
    // a sold hen was resurrected before her refund toast faded (the walk:
    // +12 paid, flock unchanged, forever)
    if (!state.animalsV) {
      while (state.animals.filter((a) => a.sp === 'hen').length < (state.hens || 0)) {
        state.animals.push({ sp: 'hen', b: 0, pd: 0, name: '' });
      }
      state.animalsV = 1;
    }
    // 🐾 v3: every animal gets an identity — id (the family tree will
    // need it), arrival day (grandfathered to the claim day), a personality
    // seed — once, flag-gated like the hen migration above
    if ((state.animalsV || 0) < 3) {
      const day0 = state.claimedAt ? Math.floor(state.claimedAt / 86400000) : dayNum();
      state.animals.forEach((a) => {
        if (!a.id) a.id = mintId();
        if (a.ad == null) a.ad = day0;
        if (a.sd == null) a.sd = Math.floor(Math.random() * 10000);
      });
      state.animalsV = 3;
    }
    return state.animals;
  }
  // 💛 THE FARM'S MEMORY — the pens-are-containers promise, kept: sell the
  // goat and buy a goat next month, and Gunnar walks back in with his name
  // and his bond. Anything named or bonded is stashed on sale; a later buy of
  // the same species revives the most-bonded memory first. Capped, oldest out.
  function farmMemory() {
    if (!Array.isArray(state.memory)) state.memory = [];
    return state.memory;
  }
  function farmGrant() {
    // idempotent: claims made before the farm existed get theirs on arrival
    if (state.hens) { farmAnimals(); return; }
    state.hens = 2;
    farmAnimals();
    if (!state.items.some((i) => i.id === 'trough')) {
      state.items.push({ id: 'trough', x: state.home.x + 96, y: state.home.y + 52 });
    }
    if (!state.items.some((i) => i.id === 'campfire')) {
      state.items.push({ id: 'campfire', lit: 1, x: state.home.x - 88, y: state.home.y + 58 });
    }
    // ⏰ the day clock starts at the moment of the grant — without this, a
    // claim made mid-session had hs_day = 0 and the FIRST morning spent
    // itself seeding the clock instead of laying (caught in the walk)
    passStat('hs_day', dayNum() - (farmStats().hs_day || 0));
    save(); refreshItems();
    toast('🐔 two hens moved in — they’re yours. they lay while you’re away', 4200);
    track1('homestead_farm_grant');
  }
  // ⏰ THE MORNING — yield accrued from days-since-last-visit, HARD-CAPPED at
  // two days so a fortnight away hands back the same full yard as a weekend
  // (the only shape the ledger can express: monotonic day counters, never a
  // subtraction, max-merge safe across devices — hs_day/hs_fed live on the
  // PASS, never in doc.state, which /save wholesale-replaces).
  const eggEls = [];
  function morningTick() {
    if (!FARM || visiting || !state.claimedAt || !state.hens) return;
    const st = farmStats();
    const today = dayNum();
    const last = st.hs_day || 0;
    if (!last) { passStat('hs_day', today); return; }   // day zero seeds the clock
    // 🐓 the rooster keeps the yard while you're away: the pile holds THREE
    // mornings instead of two. Said twice in plain words (Trym's condition):
    // on his stall card, and by the news at the exact moment it pays.
    const capDays = farmAnimals().some((a) => a.sp === 'rooster' && !isYoungA(a)) ? 3 : 2;
    const gap = Math.min(today - last, capDays);
    if (gap <= 0) return;
    const fed = (st.hs_fed || 0) >= last;               // fed on the last visit day
    const flock = farmAnimals();
    const adult = (a) => !isYoungA(a);   // kids pay in cuteness, not goods
    const eggs = gap * flock.filter((a) => a.sp === 'hen' && adult(a)).length * (fed ? 2 : 1);
    // 🥛 the dairy: a goat fills one can a day, the cow two
    const dairy = flock.filter((a) => a.sp === 'goat' && adult(a)).length
      + flock.filter((a) => a.sp === 'cow' && adult(a)).length * 2;
    const milk = gap * dairy * (fed ? 2 : 1);
    // 🐾 her own tally — the card's "she's laid 31 eggs"
    const prevGs = new Map(flock.map((a) => [a, a.gs || 0]));
    flock.forEach((a) => {
      if (!adult(a)) return;
      if (a.sp === 'hen' || a.sp === 'goat') a.gs = (a.gs || 0) + gap * (fed ? 2 : 1);
      else if (a.sp === 'cow') a.gs = (a.gs || 0) + gap * 2 * (fed ? 2 : 1);
    });
    // 🧶 wool grows in DAYS, capped at ready — a fortnight away meets the
    // same one shearing as a weekend, never a backlog
    flock.forEach((a) => { if (a.sp === 'sheep' && adult(a)) a.wd = Math.min(3, (a.wd || 0) + gap); });
    // 🐣 kids grow on FED mornings only — pause on a miss, never regress
    // (the zero-guilt doctrine; the park's watered-days precedent). The
    // stage flips HERE, on morning arrival with its own news line, never
    // silently mid-play — and growing AFTER the yields means a graduate's
    // first goods land TOMORROW, exactly as the news promises.
    let gradN = 0, gradName = '', leftMin = 9;
    if (fed) flock.forEach((a) => {
      if (!isYoungA(a)) return;
      a.gd += 1;
      if (a.gd >= 5) { gradN++; if (a.name && !gradName) gradName = a.name; a.greet = 1; track1('homestead_grow', { sp: a.sp }); }
      else leftMin = Math.min(leftMin, 5 - a.gd);
    });
    const growLine = !(gradN || leftMin < 9) ? '' : gradN
      ? '🎉 ' + (gradName || 'the little one') + (gradN > 1 ? ' & co' : '')
        + ' — all grown up. The mornings start paying tomorrow'
      : '🐣 the little ones grew — fill the trough ' + leftMin
        + ' more morning' + (leftMin === 1 ? '' : 's');
    // 💔 THE OBLIGATION (Trym, 2 Sep: "you should hug your animals — a
    // day without hugging loses a heart, that's how Stardew does it"). The
    // one deliberate exception to zero-guilt: every full day since the
    // last morning that she went unhugged costs one heart. Counted exactly
    // — a day is judged once, never twice — floored at zero; names are
    // never lost, only levels and badges fall back honestly.
    let lostN = 0, lostA = 0, worst = null, worstN = 0;
    flock.forEach((a) => {
      const missed = Math.max(0, (today - 1) - Math.max(a.pd || 0, last - 1));
      if (!missed || !(a.b > 0)) return;
      const cut = Math.min(a.b, missed);
      a.b -= cut; lostN += cut; lostA++;
      if (cut > worstN) { worstN = cut; worst = a; }
    });
    if (lostN) { hens.forEach(petBadge); track1('homestead_decay', { hearts: lostN, animals: lostA }); }   // crowns and stars come off with the hearts
    const lostLine = lostN
      ? '💔 ' + (worst.name || 'the ' + worst.sp) + (lostA > 1 ? ' & co' : '') + ' missed you — '
        + lostN + ' heart' + (lostN > 1 ? 's' : '') + ' lost'
      : '';
    passStat('hs_day', today - last);
    const t = state.items.find((i) => i.id === 'trough') || { x: state.home.x + 96, y: state.home.y + 52 };
    const drops = [];
    for (let i = 0; i < eggs; i++) drops.push('egg');
    for (let i = 0; i < milk; i++) drops.push('milk');
    drops.forEach((kind, i) => {
      const el = document.createElement('div');
      el.className = kind === 'milk' ? 'hs-milk' : 'hs-egg';
      const x = t.x - 44 + (i % 4) * 30, y = t.y + 12 + Math.floor(i / 4) * 24;
      el.style.left = pct(x, W); el.style.top = pct(y, H);
      depth(el, y);
      world.appendChild(el);
      eggEls.push({ x, y, el, kind });
    });
    // 🧀 the press finishes overnight, whoever is watching
    const press = state.items.find((i2) => i2.id === 'cheesemk' && i2.load && i2.load < today);
    if (press) {
      press.load = 0;
      const el = document.createElement('div');
      el.className = 'hs-chz';
      el.style.left = pct(press.x + 30, W); el.style.top = pct(press.y - 10, H);
      depth(el, press.y);
      world.appendChild(el);
      eggEls.push({ x: press.x + 30, y: press.y - 10, el, kind: 'cheese' });
      save();
    }
    const star = bestBond();
    const who = star && star.name ? star.name + (farmAnimals().length > 1 ? ' & co' : '') : 'the farm';
    const bits = [];
    let mainLine = '';
    if (eggs) bits.push(eggs + ' egg' + (eggs > 1 ? 's' : ''));
    if (milk) bits.push(milk + ' can' + (milk > 1 ? 's' : '') + ' of milk');
    if (press) bits.push('a wheel of cheese');
    if (bits.length) {
      // when the third morning pays, the rooster gets his credit by name —
      // the effect is narrated at the moment it matters, never only sold
      const kept = gap >= 3 ? 'you were gone ' + (today - last) + ' days — the rooster kept everything: '
        : '';
      mainLine = '🥚 ' + (kept || who + ' left ') + bits.join(' · ') + (kept ? '' : ' by the trough')
        + (fed ? ' — double, for yesterday’s feed' : '') + (lostLine ? ' · ' + lostLine : '');
    } else if (lostLine) {
      mainLine = lostLine;
    }
    // 🥚 GENERATIONS: an old friend at best friends gets an egg; it
    // hatches the morning there is room for her species, else it waits
    let eggLine = '', bornLine = '';
    flock.forEach((a) => {
      if (a.sp === 'dog' || isYoungA(a) || a.egg) return;
      if (isOld(a) && lvOf(a) >= 10) { a.egg = 1; if (!eggLine) eggLine = '🥚 ' + (a.name || 'the ' + a.sp) + ' has an egg'; }
    });
    const caps0 = penCaps();
    flock.slice().forEach((a) => {
      if (!a.egg) return;
      if (spCount(a.sp) >= (caps0[a.sp] || 0)) { if (eggLine.indexOf(' — ') < 0) eggLine += ' — make room and it hatches'; return; }
      state.animals.push(hatchFrom(a, today)); a.egg = 0;
      track1('homestead_hatch', { sp: a.sp, at: 'morning' });
      if (!bornLine) bornLine = '🐣 ' + (a.name || 'the ' + a.sp) + ' had a ' + BABY_W[a.sp] + ' — her own';
      eggLine = '';
    });
    if (bornLine) state.hens = state.animals.filter((x) => x.sp === 'hen').length;
    const quietLine = state.grassNews || '';
    state.grassNews = '';
    const woolLine = flock.some((a) => a.sp === 'sheep' && (a.wd || 0) >= 3)
      ? '🧶 the sheep is woolly — tap her to shear' : '';
    // 🎉 RITUALS (Trym: care and emotion is what can shine here)
    // her first egg / can gets her name on it
    const firstA = flock.find((a) => a.name && prevGs.get(a) === 0 && (a.gs || 0) > 0 && a.sp !== 'dog');
    const firstLine = firstA
      ? '🥚 ' + firstA.name + '’s first ' + (firstA.sp === 'hen' ? 'egg' : 'can of milk')
        + ' — ' + (he0(firstA) ? 'he’s very pleased with himself' : 'she’s very pleased with herself')
      : '';
    // her yard-day, every 30 days since she arrived
    const yd = flock.filter((a) => a.name && yardDay(a));
    const ydLine = yd.length
      ? '🎂 ' + yd[0].name + (yd.length > 1 ? ' & co' : '') + ' — '
        + (yd.length > 1 ? 'yard-days today' : ((today - yd[0].ad) / 30 === 1 ? 'a month' : ((today - yd[0].ad) / 30) + ' months') + ' here today')
      : '';
    // 📰 the news, one line at a time, in order of importance
    const news = [mainLine, quietLine, bornLine, firstLine, growLine, eggLine, ydLine, woolLine].filter(Boolean);
    news.forEach((t, i) => setTimeout(() => toast(t, 4600), i * 4800));
  }
  function farmEggTick() {
    if (visiting) return;                               // pay-side gate: a
    for (let i = eggEls.length - 1; i >= 0; i--) {      // visited yard must
      const c = eggEls[i];                              // never mint for the
      if (Math.hypot(c.x - pos.x, c.y - pos.y) > 34) continue;   // visitor
      c.el.remove();
      eggEls.splice(i, 1);
      if (c.kind === 'cheese') {
        state.cheese = (state.cheese || 0) + 1;
        float(c.x, c.y - 22, '🧀 +1');
        track1('homestead_cheese');
      } else if (c.kind === 'milk') {
        state.milk = (state.milk || 0) + 1;
        float(c.x, c.y - 22, '🥛 +1');
        track1('homestead_milk');
      } else {
        state.eggs = (state.eggs || 0) + 1;
        float(c.x, c.y - 22, '🥚 +1');
        track1('homestead_egg');
      }
      save();
    }
  }
  // ❤️ the mood bubble — the park's hearts-only grammar, reused exactly:
  // ❤️ fed today, 💔 hungry (an appointment, never a wound — the floor
  // never drops). Tap a hen to ask her.
  function henMood(h) {
    let b = h.el.querySelector('.hs-mood');
    if (!b) { b = document.createElement('span'); b.className = 'hs-mood'; h.el.appendChild(b); }
    b.innerHTML = '<b>' + (fedToday() ? '❤️' : '💔') + '</b>';   // <b> = the raised text layer (see CSS)
    b.classList.add('is-on');
    clearTimeout(h.moodT);
    h.moodT = setTimeout(() => b.classList.remove('is-on'), 1800);
    track1('homestead_mood', { fed: fedToday() ? 1 : 0 });
    // ❤️ THE HUG (slice 2). The same tap: bond climbs once per day per animal
    // and never, ever falls — pd is the only gate, there is no decay anywhere.
    const a = h.a;
    if (!a) return;
    if (visiting) { visitorHug(a, h); return; }
    // 🧶 THE SHEAR (slice 3): a woolly sheep gives her coat on the tap —
    // one wool, the drawn Sheared sprite takes over, three days grow it back
    if (a.sp === 'sheep' && (a.wd || 0) >= 3) {
      a.wd = 0;
      a.gs = (a.gs || 0) + 1;
      state.wool = (state.wool || 0) + 1;
      save();
      // the coat comes off WITH the tap — the tick's lazy swap only runs on a
      // wander retarget, which left her fluffy for seconds after the shear
      h.fluff = false;
      h.img.style.backgroundImage = "url('/assets/homestead/c-sheeps.png')";
      float(h.x, h.y - 48, '🧶 +1');
      toast('🧶 a bundle of wool — ' + nameOf(a) + ' looks lighter already', 3600);
      track1('homestead_shear');
    }
    const today = dayNum();
    if ((a.pd || 0) < today) {
      a.pd = today;
      // 🐣 a hug means MORE to a kid — double bond while she's little
      // (raising pays in the other currency while the goods wait)
      const inc = isYoungA(a) ? 2 : 1;
      float(h.x, h.y - 44, yardDay(a) ? '❤️❤️' : '❤️');   // 🎂 two on her yard-day
      bondUp(a, inc, h);
      save();
      track1('homestead_pet', { b: a.b });
    }
    // ✏️ NAMING at bond 3 — earned, never bought. One name per farm, ever
    // (Trym: no duplicates), through the same family filter as every sign.
    if (a.name) henNameShow(h);
  }
  // ❤️ hearts go up — the hug and a cooked treat share the moment: the
  // level-up hop, float and badge (when she is on screen), and the two
  // milestone toasts (a name at 3, the gate at 7)
  function bondUp(a, inc, h) {
    const gWas = greeter();
    a.b = (a.b || 0) + inc;
    const lvWas = lvOf({ b: a.b - inc }), lvNow = lvOf(a);
    if (lvNow > lvWas) {
      track('homestead_levelup', { lv: lvNow, sp: a.sp, best: lvNow >= 10 ? 1 : 0 });
      if (h) {
        float(h.x, h.y - 62, '⬆ Lv ' + lvNow);
        h.el.classList.add('is-hop');
        setTimeout(() => h.el.classList.remove('is-hop'), 700);
        petBadge(h);
      }
      if (lvNow >= 10) toast('👑 ' + nameOf(a) + ' — best friends', 4200);
    }
    if (a.b >= 3 && a.b - inc < 3 && !a.name) {
      toast('❤️ ' + (he0(a) ? 'he trusts you now — open his card (tap twice) to name him'
        : 'she trusts you now — open her card (tap twice) to name her'), 4200);
    } else if (gWas !== a && greeter() === a) {
      // crossing 7 in the lead, or overtaking the old greeter — an
      // outranked animal is never promised the gate
      toast('❤️ ' + nameOf(a) + ' will meet you at the gate from now on', 4200);
    }
  }
  // her name, said over her head when you tap her (the bubble stays
  // hearts-only — the name is a label, not a mood)
  function henNameShow(h) {
    let t = h.el.querySelector('.hs-henname');
    if (!t) { t = document.createElement('i'); t.className = 'hs-henname'; h.el.appendChild(t); }
    t.textContent = h.a.name;
    t.classList.add('is-on');
    clearTimeout(h.nameT);
    h.nameT = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  // 🐦 NO SPECIES COLLECTION HERE (Trym, 30 Aug). Birdwatching belongs to
  // the PARK, where it can feed the park's health — a shared place worth
  // keeping nice. In a private yard it hung off nothing: it wrote the PARK's
  // own day-list and `bird_<sp>` stats from a second location, paid each
  // species once ever, and paid in rep you cannot spend. Twelve sightings and
  // it was finished. Animals you keep replace it. The birdhouse stays
  // purchasable and birds still prefer it — nobody loses what they bought.

  // ---- 🐦 garden birds (M3): they come when the yard is LIVED-IN ----------
  // Ambient, not a loop: an empty yard gets no birds, decor attracts them,
  // bird houses attract more — and walking up close scares them off. The
  // reward for furnishing is a yard that moves.
  const birdsLive = [];
  const birdTick = (() => {
    if (REDUCED || !BIRDS.length) return () => {};
    let nextAt = 6000 + Math.random() * 9000;
    const birdCap = () => Math.min(3, 1 + state.items.filter((i) => i.id.indexOf('birdhouse') === 0).length);
    // ⚠️ AN EMPTY YARD USED TO GET NO BIRDS AT ALL. The pool was state.items
    // alone, so `if (!pool.length) return null` bailed for every player who had
    // not yet bought decor — which is 641 of the 644 who have ever opened this
    // place. The one ambient thing the homestead owns was gated behind the shop
    // it is supposed to sell you on. Anything standing in the yard is a perch:
    // your roof, the mailbox, the sign, a fence post, a dug bed.
    function landSpot() {
      const houses = state.items.filter((i) => i.id.indexOf('birdhouse') === 0);
      const perches = state.items.concat(
        state.claimedAt && state.stage >= 1 ? [{ x: state.home.x, y: state.home.y }] : [],
        [{ x: MAILBOX.x, y: MAILBOX.y }, { x: SIGN.x, y: SIGN.y }],
        // ⚠️ fence and soil are stored as GRID CELLS { i, j }, not world x/y
        (state.fence || []).map((f) => ({ x: cellCx(f), y: cellBase(f) })),
        (state.soil || []).map((c) => ({ x: cellCx(c), y: cellBase(c) })));
      const pool = (houses.length && Math.random() < 0.6) ? houses : perches;
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
    if (HS_TEST) window.__hsBird = () => { makeBird(); return birdsLive.length; };
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
          {
            const want = flying ? 'f' : 'g';
            if (b.strip !== want) setStrip(b, want);
            b.img.style.backgroundPosition = (b.frame * 100 / 3) + '% 0';
          }
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
  let moved = false;            // has the player walked even once?
  const hint = (on) => { if (hintEl) hintEl.classList.toggle('is-off', !on); };
  // 🍪 ⚠️ THE COVERED INSTRUCTION (14 Aug, from the ad's day-one funnel):
  // .ccb is fixed to the viewport bottom and .hs-hint sits at the frame's
  // bottom — on a phone the cookie banner lands exactly on top of "tap to
  // walk", the one line that turns a picture into a game. Only 6 of 181 ad
  // arrivals ever walked far enough to collect the coins in front of them.
  // So the hint WAITS for the banner to go, and only then invites the tap.
  //
  // 📱 …and the same band eats every CONTROL (found again 25 Aug): at 375x667
  // the banner covers ✓ place it here, the tool bar and the whole ❤️/🔨/📱 row,
  // so a placement — or a PAID upgrade — cannot be committed. Consent is
  // legally load-bearing, so the BANNER never moves: the game frame shrinks by
  // the band and the page nudges so the frame ends above it (world-travel's
  // boot nudge / the rave's alignGameFrame, with the banner added to the fold).
  const actionsRow = document.querySelector('.hs-actions');
  // ⚠️ offsetHeight + its own bottom inset, NEVER the client rect: the banner
  // slides in from translateY(140%), so at boot its rect is off-screen and a
  // rect-based band measured zero — the frame never moved (caught in QA)
  const ccbBand = () => {
    const b = matchMedia('(max-width: 700px)').matches && document.querySelector('.ccb');
    if (!b) return 0;   // wide screens: the card is a left-hand corner, the controls centre
    return b.offsetHeight + (parseFloat(getComputedStyle(b).bottom) || 12) + 8;
  };
  // ⚠️ layout() only, never camSnap(): this runs at BOOT and camTarget() reads
  // `pos`, which is still in its TDZ up here — cam() eases to the new frame
  function fitFrame() {
    document.documentElement.style.setProperty('--hs-ccb', ccbBand() + 'px');
    layout();
  }
  function alignFrame(smooth) {
    if (!actionsRow || !matchMedia('(max-width: 700px)').matches) return;
    const vh = (window.visualViewport && window.visualViewport.height) || innerHeight;
    const off = actionsRow.getBoundingClientRect().bottom - (vh - ccbBand());
    if (off > 8 || (smooth && off < -8)) scrollBy({ top: off, behavior: smooth ? 'smooth' : 'auto' });
  }
  addEventListener('resize', fitFrame);
  (() => {
    if (!document.querySelector('.ccb')) return;
    fitFrame();
    if (hintEl) hint(false);
    const watch = setInterval(() => {
      if (document.querySelector('.ccb')) return;
      clearInterval(watch);
      fitFrame();                      // the band is gone — the frame gets it back
      if (!moved && hintEl) hint(true); // still standing still? now say how
    }, 400);
    setTimeout(() => clearInterval(watch), 60000);
  })();
  // one boot nudge, after world-travel's (800ms) so the banner's band wins
  setTimeout(() => alignFrame(false), 900);

  // ---- HUD + actions ------------------------------------------------------
  const hud = mountHud({
    mount: view,
    theme: { bg: 'rgba(16, 24, 12, 0.82)' },
    // 🧑‍🌾 the beds live here too, so the gardener chip does — the card says
    // where the ladder is CLIMBED (the park), with a door
    chips: ['lvl', 'coins', 'gardener', 'crowd'],
    onGardener: openGardenerCard,
  });
  function openGardenerCard() {
    const gl = gardenerLvlFor((passGet().stats || {}).garden_harvests || 0);
    let veil = document.getElementById('hsGardCard');
    if (!veil) {
      veil = document.createElement('div');
      veil.id = 'hsGardCard';
      veil.className = 'hs-veil';
      veil.addEventListener('click', (e) => { if (e.target === veil) veil.hidden = true; });
      document.body.appendChild(veil);
    }
    veil.innerHTML = '<div class="hs-card">' + gardenerCardHtml(gl)
      + '<p style="margin:0.9rem 0 0;text-align:center"><a class="hs-btn" href="/park/?world">the ladder climbs in the park garden →</a></p></div>';
    veil.hidden = false;
  }
  const refreshHud = () => hud && hud.refresh();
  document.getElementById('hsEmote').addEventListener('click', function () {
    // the float rides the button's own pixel heart — one art source (rave grammar)
    const s = this.querySelector('svg');
    float(pos.x, pos.y - 44, s ? s.cloneNode(true) : '❤️');
  });
  document.getElementById('hsBag').addEventListener('click', () => {
    if (visiting) { toast('that’s ' + state.name + '’s number, not yours'); return; }
    // ⚠️ THE GATE THIS ASKED FOR DOES NOT EXIST. This refused to open until
    // `claimedAt`, and `claimedAt` is set in exactly one place — offerClaim(),
    // whose only caller runs AFTER the 50-coin tent is placed. The tent is
    // bought in this shop. So the visible control turned every new player away
    // with an instruction they could not follow (GATE was imported and never
    // referenced), and the only working door was the tent ghost 264px off the
    // right edge of a 375px phone. 644 arrivals, 10 claims.
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
    penTint();   // existing pens light up the moment the tool is in hand
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
      // ⚠️ the placing camera, indoors too: without camFree every finger-down
      // threw on camFree.x and drag-to-look was dead in every room
      const R = roomBounds(inside);
      camFree = { x: (R[0] + R[2]) / 2, y: (R[1] + R[3]) / 2 };
      layout();
      camSnap();
      alignFrame(true);
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
    alignFrame(true);   // the tool bar docks at the bottom in portrait — keep it clear
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
    if (carryA) { carryA.el.style.opacity = ''; carryA = null; }   // arms empty on done
    toolF.style.display = toolS.style.display = toolC.style.display = '';
    buildBtn.setAttribute('aria-pressed', 'false');
    planBar.hidden = true;
    planShow(false);
    penTint();   // fencing is false now — this clears the tint
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
  // 🚩 FARM spawns direct arrivals on the road IN FRONT OF the yard — the
  // measured killer was geometry: the old spawn walked x104→300 inside a 520px
  // camera while everything the area owns sits at x 930-1250, so the majority
  // of players never once had their own plot on screen.
  const pos = byRoad ? { x: W - 90, y: ROAD.y }
    : FARM ? { x: GATE.x - 300, y: ROAD.y } : { x: 104, y: ROAD.y };
  const tgt = byRoad ? { x: W - 260, y: ROAD.y }
    : FARM ? { x: GATE.x - 40, y: ROAD.y } : { x: 300, y: ROAD.y };
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
      if (ruleUsed('homestead:road').n >= 5) return;   // 📏 collected on another device — once per person
      // ⚠️ THE FLAG IS WRITTEN WHEN THE LAST COIN IS PICKED UP, NOT HERE. It
      // used to be set at spawn, so one reload, one back-nav or one bounce
      // spent the area's entire free faucet without paying out a single coin.
    } catch (e) { return; }
    // ⚠️ the art is the stand's 44px coin (coin-spin strip, 6 frames, 2.5KB)
    // shown at 22 CSS px — EXACTLY half, so 2× phone screens render it
    // device-pixel-perfect. coin16 upscaled through the camera read as mush
    // (Trym: "why so low resolution").
    const st = document.createElement('style');
    st.textContent = '.hs-roadcoin{position:absolute;width:30px;height:30px;pointer-events:none;'
      + 'background:url(/assets/banana-stand/coin-spin.png) 0 0/180px 30px no-repeat;'
      + 'image-rendering:pixelated;'
      + 'filter:drop-shadow(0 0 7px rgba(255,225,53,0.85)) drop-shadow(0 3px 2px rgba(20,40,10,0.3));'
      + 'animation:hsCoinSpin 0.9s steps(6) infinite;}'
      + '@keyframes hsCoinSpin{to{background-position:-180px 0}}'
      + '@media (prefers-reduced-motion:reduce){.hs-roadcoin{animation:none;'
      + 'background:url(/assets/banana-stand/coin.png) 0 0/30px 30px no-repeat;}}';
    document.head.appendChild(st);
    // strung along the road AHEAD of the walk-in, whichever door you used;
    // slight y-jitter so it reads as dropped, not printed
    // FARM: the coins string along the shorter gate walk, so the arrival
    // auto-walk crosses every one of them before the first tap
    // ⚠️ PAST THE ARRIVAL WALK, NOT UNDER IT (Trym, 4 Sep: "the banana walks
    // through coins automatically when joining directly ... so he doesnt
    // auto-pick them up since hes on the move when you load in"). The direct
    // arrival walks east to the gate at x1152, so the trail starts beyond it
    // and the first coin is a thing you choose to fetch.
    //
    // ⚠️ THE TRAIL USED TO END INSIDE THE WALK ON PURPOSE: the spent-flag is
    // written when the LAST coin is picked up, so a trail nobody finishes
    // respawns every visit. Out of auto-reach that would come straight back —
    // so we now spawn only the coins this PERSON is still owed (the server's
    // own count), and the flag stops mattering for the ones already paid.
    const owed = Math.max(0, 5 - (ruleUsed('homestead:road').n || 0));
    // ⚠️ AND CLEAR OF NIB. He now stands beside the post-box at x1252, so a
    // trail starting at 1230 sat on top of him. It starts east of them both.
    // the first coin has to be VISIBLE or the trail is not a lure — it sits
    // ~80px past Nib (x1252) and ~145px past where the arrival walk stops
    // reaching (gate x1152 + a 34px grab), so it tempts without collecting.
    ((FARM && !byRoad) ? [[1330, -10], [1395, 8], [1460, -6], [1525, 10], [1590, 0]]
      : [[400, -10], [500, 8], [600, -6], [700, 10], [800, 0]]).slice(0, owed).forEach(([cx, jy], i) => {
      const x = byRoad ? W - cx : cx, y = ROAD.y + jy;
      const d = document.createElement('div');
      d.className = 'hs-roadcoin';
      d.style.animationDelay = (i * 0.13) + 's';   // desynced spins
      place(d, x, y, ' translate(-50%,-50%)');
      depth(d, y);
      world.appendChild(d);
      roadCoins.push({ x, y, el: d });
    });
  })();
  // 🎫 THE KEEP NOTE — once, ever, after a real minute on your own plot.
  //
  // ⚠️ IT MUST NOT LIE. Everyone gets an anonymous server pass at their first
  // write, so their progress IS saved — telling them it is not would be false
  // and would read as a scare. What is actually true is narrower and is the
  // thing that bit Trym himself on 4 Sep: the anonymous credential lives in
  // THIS BROWSER, so the homestead does not follow you to your phone until an
  // email is on it. That is the sentence, and nothing more.
  //
  // ⚠️ NOT AT SPAWN. A person who has been here 45 seconds has made something
  // worth keeping; a person who has been here 2 seconds is being sold to.
  (() => {
    if (visiting || HS_TEST) return;
    try { if (localStorage.getItem('hs-keepnote-v1')) return; } catch (e) { return; }
    setTimeout(() => {
      // re-checked LATE: they may have signed in during the 45 seconds, and a
      // note that arrives after the thing it asks for is just noise
      if (visiting || loggedIn()) return;
      try {
        if (localStorage.getItem('hs-keepnote-v1')) return;
        localStorage.setItem('hs-keepnote-v1', '1');
      } catch (e) { return; }
      // ✂️ CONCRETE, NOT CLEVER (Trym, 4 Sep). This said "take it anywhere",
      // which means nothing to somebody who arrived ninety seconds ago —
      // anywhere as in gmail? netflix? Benefit-copy needs a mental model the
      // reader does not have yet. Say the OUTCOME they already understand
      // (save your progress) and the ACTION, naming a thing that is on screen:
      // "My Pass" is the nav's own label and the 🎫 is the nav's own icon, so
      // the sentence points at something they can actually find.
      toast('🎫 To save your progress, log into My Pass in the menu', 9000);
      track1('homestead_keepnote', {});
    }, 45000);
  })();

  function roadCoinTick() {
    for (let i = roadCoins.length - 1; i >= 0; i--) {
      const c = roadCoins[i];
      if (Math.hypot(c.x - pos.x, c.y - pos.y) > 34) continue;
      c.el.remove();
      roadCoins.splice(i, 1);
      passStat('coins_earned', 2, 'road');
      float(c.x, c.y - 22, '<img src="/assets/banana-stand/coin.png" width="14" height="14" style="vertical-align:-2px"> +2');
      refreshHud();
      // 🏡 the claim is FREE and waits on the blank sign — never a popup
      if (!roadCoins.length) {
        try { localStorage.setItem('hs-roadcoins-v1', '1'); } catch (e) {}
        toast('<img class="hs-toastico" src="/assets/banana-stand/coin.png" style="image-rendering:auto" alt=""> first coins in the pocket — playing pays, anywhere in the world', 3600);
        track('roadcoins_done');   // the first-ten-seconds hook landed
      }
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
  const tailorEl = document.getElementById('hsTailor');
  const confirmEl = document.getElementById('hsConfirm');
  const seedEl = document.getElementById('hsSeed');
  const petEl = document.getElementById('hsPet');
  const panelOpen = () => !claimEl.hidden || !shopEl.hidden || !guestEl.hidden || !cookEl.hidden || !tailorEl.hidden
    || !seedEl.hidden || !petEl.hidden;
  // while any popup is open the PAGE must not scroll under it (Trym)
  const syncLock = () => document.body.classList.toggle('hs-lock', panelOpen());

  // 🍳🧶 the kitchen and the tailor live in a LAZY chunk
  // (homestead-kitchen.js), loaded on the first stove, fire or tailor open
  // — the yard's hot path stays under its cap. Same ctx seam as the phone.
  let kitchenMod = null;
  function kitchen() {
    if (kitchenMod) return Promise.resolve(kitchenMod);
    return import('./homestead-kitchen.js').then((m) => { m.init(phoneCtx); kitchenMod = m; return m; });
  }
  function openCook(where) { kitchen().then((K) => K.openCook(where)); }
  function openTailor() { kitchen().then((K) => K.openTailor()); }
  document.getElementById('hsCookClose').addEventListener('click', () => { cookEl.hidden = true; syncLock(); });
  document.getElementById('hsTailorClose').addEventListener('click', () => { tailorEl.hidden = true; syncLock(); });
  document.getElementById('hsPetClose').addEventListener('click', () => { petEl.hidden = true; syncLock(); });
  petEl.addEventListener('click', (e) => { if (e.target === petEl) { petEl.hidden = true; syncLock(); } });
  document.getElementById('hsSeedClose').addEventListener('click', () => { seedEl.hidden = true; syncLock(); });
  seedEl.addEventListener('click', (e) => { if (e.target === seedEl) { seedEl.hidden = true; syncLock(); } });
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
      // 🤗 HUGS FROM THE OTHER SIDE OF THE FENCE. A neighbour cannot write
      // this yard, so their hug arrived as a note. It counts as the animal's
      // hug for that day: the day's heart, and the morning that would have
      // taken one back leaves her alone. One per animal per day, whoever gave
      // it — a visitor can keep an animal's day, never out-hug her person.
      const dnOf = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
      state.hgs = state.hgs || [];
      let hugged = 0, hname = '';
      (n.hugs || []).forEach((g) => {
        const tag = g.d + ':' + g.i;
        if (!g.d || !g.i || state.hgs.includes(tag)) return;
        state.hgs.push(tag);
        const a = (state.animals || []).find((x) => x.id === g.i);
        const dn = dnOf(g.d);
        if (!a || !Number.isFinite(dn) || (a.pd || 0) >= dn) return;
        a.pd = dn;
        if ((a.b || 0) < LV_AT[LV_AT.length - 1]) a.b = (a.b || 0) + 1;
        hugged++;
        if (g.n) hname = g.n;
      });
      state.hgs = state.hgs.slice(-40);
      if (hugged) hens.forEach((h) => { if (h.a) petBadge(h); });
      // 🌾 AND THEIR TROUGH. Somebody filled it while this yard was empty, so
      // the morning pays double exactly as it would have by the owner's hand.
      state.fdays = state.fdays || [];
      let fedBy = 0, fname = '';
      (n.feeds || []).forEach((f) => {
        if (!f.d || state.fdays.includes(f.d)) return;
        state.fdays.push(f.d);
        const dn = dnOf(f.d);
        if (!Number.isFinite(dn)) return;
        if ((farmStats().hs_fed || 0) < dn) passStat('hs_fed', dn - (farmStats().hs_fed || 0));
        fedBy++;
        if (f.n) fname = f.n;
      });
      state.fdays = state.fdays.slice(-14);
      if (fedBy) refreshItems();
      save();   // persists slug/wdays AND publishes the fresh snapshot
      const msgs = [];
      if (watered) msgs.push('💧 ' + (wname || 'a neighbour') + ' watered your beds while you were away');
      if (hugged) {
        msgs.push('❤️ ' + (hname || 'a neighbour') + (hugged === 1
          ? ' hugged one of your animals while you were away'
          : ' hugged ' + hugged + ' of your animals while you were away'));
      }
      if (fedBy) msgs.push('🌾 ' + (fname || 'a neighbour') + ' filled your trough — the morning pays double');
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
    const wasUnclaimed = !state.claimedAt;
    state.claimedAt = state.claimedAt || Date.now();
    if (FARM && wasUnclaimed) farmGrant();
    save(); refreshSign();
    claimEl.hidden = true;
    syncLock();
    toast('🏡 ' + v + ' — it’s yours');
    track(wasRename ? 'homestead_rename' : 'homestead_claim');
    // mint the ADDRESS — the sign name becomes the slug (yardBoot retries if offline)
    yFetch('/claim', { name: v }).then((r) => {
      // the rename moved the yard's stamp: take the new receipt with it, or
      // the next save reads as stale and the homestead reloads under the sign
      if (r && r.slug) { state.slug = r.slug; if (r.updated) state.pubUpdated = r.updated; save(); }
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

  // 📱 the phone + card chunk, loaded on first open (a separate file in
  // dist — the yard's hot path stays under its 130k cap). ctx hands it the
  // main module's world; state/inside/visiting are live getters.
  let phoneMod = null, renderTok = 0;
  const phoneCtx = {
    get state() { return state; }, get inside() { return inside; }, get visiting() { return visiting; },
    get BABY_W() { return BABY_W; }, get SPOT_W() { return SPOT_W; }, get isOld() { return isOld; }, get toGrass() { return toGrass; },
    get CHEESE_C() { return CHEESE_C; },
    get COIN() { return COIN; },
    get DEX() { return DEX; },
    get EGG_C() { return EGG_C; },
    get INCAP() { return INCAP; },
    get MILK_C() { return MILK_C; },
    get STALL_CAP() { return STALL_CAP; },
    get WOOL_C() { return WOOL_C; },
    get bestFriend() { return bestFriend; },
    get closeShop() { return closeShop; },
    get dayNum() { return dayNum; },
    get drawComposite() { return drawComposite; },   // the visitor's banana, for the story's photos
    get yFetch() { return yFetch; },
    get farmAnimals() { return farmAnimals; },
    get farmMemory() { return farmMemory; },
    get fedToday() { return fedToday; },
    get he0() { return he0; },
    get inList() { return inList; },
    get cap() { return cap; },   // ⚠️ missed by the first split: the shed's "place it" threw for a day
    get isIndoorItem() { return isIndoorItem; },
    get isYoungA() { return isYoungA; },
    get lvNext() { return lvNext; },
    get lvOf() { return lvOf; },
    get mintId() { return mintId; },
    get openShop() { return openShop; },
    get passSpend() { return passSpend; },
    get passStat() { return passStat; },
    get penCaps() { return penCaps; },
    get petEl() { return petEl; },
    get refreshHud() { return refreshHud; },
    get renderShop() { return renderShop; },
    get save() { return save; },
    get shopHead() { return shopHead; },
    get shopNote() { return shopNote; },
    get spCount() { return spCount; },
    get spotOf() { return spotOf; },
    get stallDay() { return stallDay; },
    get stallSell() { return stallSell; },
    get startPlacing() { return startPlacing; },
    get syncLock() { return syncLock; },
    get toast() { return toast; },
    get track() { return track; },
    get track1() { return track1; },
    get traitsOf() { return traitsOf; },
    get CROP_EMO() { return CROP_EMO; },
    get DISHES() { return DISHES; },
    get bondUp() { return bondUp; },
    get buffGet() { return buffGet; },
    get coinsPaid() { return coinsPaid; },
    get buffSet() { return buffSet; },
    get cookEl() { return cookEl; },
    get farmStats() { return farmStats; },
    get hens() { return hens; },
    get phone() { return phone; },
    get tailorEl() { return tailorEl; },
  };
  function phone() {
    if (phoneMod) return Promise.resolve(phoneMod);
    return import('./homestead-phone.js').then((m) => { m.init(phoneCtx); phoneMod = m; return m; });
  }
  function renderShop() {
    const list = document.getElementById('hsShopList');
    list.classList.remove('hs-list--rows', 'hs-list--tree', 'hs-list--story');
    const catsRow = document.getElementById('hsShopCats');
    list.replaceChildren();
    catsRow.hidden = true;
    armAnimalsTab();
    const tok = ++renderTok;   // a later paint wins; a stale chunk load paints nothing
    const tabNow = shopEl.dataset.tab;
    if (FARM && (tabNow === 'sell' || tabNow === 'buy' || tabNow === 'animals' || tabNow === 'tree' || tabNow === 'story')) {
      phone().then((PH) => {
        if (tok !== renderTok) return;
        if (tabNow === 'sell') PH.renderSell(list); else if (tabNow === 'buy') PH.renderBuy(list);
        else if (tabNow === 'tree') PH.renderTree(list);
        else if (tabNow === 'story') PH.renderStory(list);
        else PH.renderAnimals(list);
      });
      return;
    }
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
        b.addEventListener('click', () => { shopEl.dataset.cat = c; renderShop(); track('homestead_shelf', { cat: c }); });
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
          if (d.stage > state.stage) return;
          // the tile disables itself when you are short, but the charge is the
          // only check that counts — never spend past zero
          if (!passSpend(d.price, 'order')) { shopNote('🪙 not enough coins for that one'); renderShop(); return; }
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
      if (FARM) {
        phone().then((PH) => { if (tok === renderTok) PH.shedRows(list); });
        return;
      }
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
            passStat('coins_earned', sale, 'shed');
            save();
            refreshHud();
            shopNote('💰 sold — +' + coinsPaid(sale) + ' coins');
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
    sell: ['Sell goods', 'The stall takes what your farm makes.'],
    buy: ['Buy animals', 'A bigger fence fits more of them.'],
    animals: ['My animals', 'Everyone who lives here.'],
    tree: ['The family tree', 'Everyone who ever lived here.'],
    story: ['The farm story', 'What happened here while you were out.'],
    order: ['Order stuff', 'The van delivers to your mailbox.'],
    shed: ['The shed', 'Your stuff, ready to place.'],
    up: ['Upgrades', ''],
  };
  // 🥚 THE GATE STALL — one card, two buttons, no tabs inside it. Sells at
  // 4c an egg against a 25c/day take (the cap is the PIPE, not a throttle:
  // surplus is meant to become a dish). The daily tally is device-local by
  // design — the worst a second device buys is one more capped day.
  const EGG_C = 4, MILK_C = 6, WOOL_C = 12, CHEESE_C = 20, STALL_CAP = 25;
  function stallDay() {
    try {
      const j = JSON.parse(localStorage.getItem('hs-stall-v1') || 'null');
      if (j && j.d === dayNum()) return j;
    } catch (e) {}
    return { d: dayNum(), sold: 0 };
  }
  function stallSell(kind, price, label) {
    // 📏 sold today = this device's tally OR what the server says this PERSON
    // sold on any device (plus what is still in the outbox) — whichever is more
    // ⚠️ ONE UNIT: the buff doubles what the tape and the server count, the
    // local tally is unbuffed — compare in buffed units, and never go negative
    const mult = (buffGet() || {}).fx === 'coins2' ? 2 : 1;
    const soldToday = Math.max(stallDay().sold * mult, ruleUsed('homestead:stall').used);
    const room = Math.max(0, STALL_CAP * mult - soldToday);
    const nSold = Math.min(state[kind] || 0, Math.floor(room / (price * mult)));
    if (nSold <= 0) { if ((state[kind] || 0) > 0) toast('the stall is done for today — it opens again tomorrow', 2800); return; }
    state[kind] -= nSold;
    const coins = nSold * price;
    passStat('coins_earned', coins, 'stall', kind + '-' + nSold);   // the goods ride the row: a refused sale puts them back
    try { localStorage.setItem('hs-stall-v1', JSON.stringify({ d: dayNum(), sold: stallDay().sold + coins })); } catch (e) {}
    save(); refreshHud(); renderShop();
    toast('🪙 +' + coinsPaid(coins) + ' — the stall took ' + nSold + ' ' + label, 3200);
    track1('homestead_sell_stall', { kind, n: nSold });
  }
  // a stall sale the server would not pay (the cap was already spent on
  // another device): the goods go quietly back on the shelf, the number
  // reads what the server holds — nothing to explain, the eggs are there
  document.addEventListener('pass:refused', (e) => {
    const { k, s, i, id } = (e && e.detail) || {};
    if (visiting || k !== 'coins_earned' || s !== 'stall' || !i) return;
    const m = /^(eggs|milk|wool|cheese)-(\d{1,3})$/.exec(String(i));
    if (!m) return;
    state[m[1]] = (state[m[1]] || 0) + +m[2];
    save(); renderShop();
    passNakDone(id);   // put right — the record can let this one go
  });
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
    const farmTabs = tab === 'sell' || tab === 'buy' || tab === 'animals' || tab === 'tree' || tab === 'story';
    if (state.stage < 1 && !farmTabs) tab = 'order';   // tent-first: straight to the one offer (the farm trades from day one — it FUNDS the tent)
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
      const from = shopEl.dataset.tab;
      shopEl.dataset.tab = t.dataset.tab;
      shopHead();
      renderShop();
      track('homestead_app', { app: t.dataset.tab, from });   // which app they chose, from where
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
    // 💀 THE GHOST WINDOW (the lost-decor bug): a lift used to SPLICE the piece
    // out of state with no save, so any save landing mid-ghost (a delivery, a
    // purchase from the phone) wrote the yard without it — and cancel put it
    // back in memory only. Nothing leaves state until the move COMMITS; the
    // renderers and rebuildSolids skip placing.moving, so it just stops being
    // painted. Both lists refresh: indoors the twin stayed lit beside the ghost.
    if (moving) { refreshItems(); refreshInItems(); }
    view.classList.add('is-placing');   // touch drags steer the camera, not the page
    updateGhost();
    confirmEl.hidden = false;
    requestAnimationFrame(() => alignFrame(true));   // the ✓ bar must not open under the cookie banner
    moved = true; hint(false);
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
    const foot = [x - d.w * 0.52, y - floorOf(d.h), x + d.w * 0.52, y + 12];
    // ⚠️ THE FOOTPRINT, NOT THE ANCHOR (Trym's screenshot, 30 Aug: the country
    // house sat on top of his fence). This tested the single anchor point
    // against a ~100x72 box per fence cell, so a 356px-wide house whose base
    // centre happened to land in open ground could lay its whole west wall
    // across a fence run. The soil test three lines down had it right all
    // along — same rect, same overlap maths, now used for both.
    for (const c of state.fence) {
      if (foot[0] < (c.i + 1) * 48 && foot[2] > c.i * 48 && foot[1] < (c.j + 1) * 48 && foot[3] > c.j * 48) return false;
    }
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
    requestAnimationFrame(() => alignFrame(true));   // the ✓ bar must not open under the cookie banner
    moved = true; hint(false);
    toast(placing.toStage > state.stage
      ? 'your land grows with it — place it anywhere on the new deed'
      : 'choose where it stands — drag to look, tap to try', 3600);
  }
  function confirmHome() {
    // 💸 THE MONEY MOVES HERE, not at the CTA. The bag stays open while you
    // walk the ghost around, so the balance that lit the button can be spent
    // by now — and an overdrawn wallet reads as ZERO and eats every coin you
    // earn until the hole refills. passSpend takes nothing when it is short.
    // (Charging at the CTA would need a refund on every exit — cancel, the
    // WASD escape hatch, a closed tab — and the closed tab has no refund.)
    if (placing.toStage && placing.price > 0 && !passSpend(placing.price, 'stage')) {
      refreshHud();
      toast('🪙 not enough coins any more — you need ' + placing.price
        + '. The spot is still yours, come back with them.', 4200);
      return;
    }
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
    if (placing.toStage) {   // this placement completes an UPGRADE (paid above)
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
    // 🪧 refreshFixtures too — the property sign wears the TIER, so an upgrade
    // that skipped it kept the old plank until the next page load
    refreshTent(); refreshSoil(); rebuildSolids(); refreshItems(); refreshFixtures(); refreshHud();
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
    const wasBuy = !placing.moving;   // a lifted piece never left state — nothing to put back
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
    const room = placing.room;
    // a move MUTATES the piece already in state (it keeps its extras — a lit
    // campfire used to be rebuilt cold); only a buy pushes a new one
    const it = placing.moving || { id: placing.id, x: placing.x, y: placing.y };
    it.x = placing.x; it.y = placing.y;
    placing.el.remove();
    const moved = !!placing.moving;
    placing = null;
    confirmEl.hidden = true;
    if (!moved) (room ? (state.inItems[room] = state.inItems[room] || []) : state.items).push(it);
    save();
    refreshItems();
    refreshInItems();
    float(it.x, it.y - (DEX[it.id].h || 30) - 6, '✓');
    plannerAfterPlace(it.x, it.y);
    track(moved ? 'homestead_move' : 'homestead_place', { id: it.id });
  });
  document.getElementById('hsPlaceNo').addEventListener('click', cancelPlacing);

  // an existing item, tapped in PLAY mode: only what you can DO with it
  // (fill, press, cook, light). Moving and putting away live in build mode
  // (✥ and 🧹), and the stall lives on the phone — Trym: "the buttons
  // become a bit noisy if you have decorated a lot". No verbs → no chip;
  // the tap walks you there like any patch of grass.
  let itChip = null;
  let lastTapH = null, lastTapAt = 0;   // 🐾 second tap on the same animal within 600ms = her card
  function itemChip(idx) {
    clearChip();
    const it = state.items[idx];
    const d = DEX[it.id];
    itChip = document.createElement('div');
    itChip.className = 'hs-chip';
    // ⚠️ THE PAID FEEDER IS GONE with the species it summoned — leaving it
    // would charge 5 coins for nothing at all. The birdhouse is still decor,
    // and birds still favour it as a perch.
    if (it.id === 'tailor' && FARM) {
      const kn = document.createElement('button');
      kn.className = 'hs-btn';
      kn.textContent = '🧶 knit';
      kn.addEventListener('click', () => { clearChip(); openTailor(); });
      itChip.appendChild(kn);
    }
    if (it.id === 'cheesemk' && FARM) {
      const pr = document.createElement('button');
      pr.className = 'hs-btn';
      if (it.load) {
        // 🧀 the press runs to the NEXT MORNING (the day clock ticks at
        // UTC midnight) — the chip is a progress bar of how far the wheel
        // has come, with a rough hours-left (Trym: "a progress bar showing
        // when cheese is done")
        const dayMs = 86400000;
        const doneAt = (it.load + 1) * dayMs - qaDayOfs;
        const startAt = it.loadAt || (it.load * dayMs - qaDayOfs);
        const frac = Math.max(0.03, Math.min(1, (Date.now() - startAt) / Math.max(1, doneAt - startAt)));
        const hrs = Math.ceil(Math.max(0, doneAt - Date.now()) / 3600000);
        pr.className = 'hs-btn hs-chipbar';
        pr.innerHTML = '<i style="width:' + Math.round(frac * 100) + '%"></i><span>🧀 pressing — '
          + (hrs <= 1 ? 'under an hour' : 'about ' + hrs + 'h') + ' to go</span>';
        pr.disabled = true;
      } else if ((state.milk || 0) >= 2) {
        pr.textContent = '🧀 press 2 milk';
        pr.addEventListener('click', () => {
          state.milk -= 2;
          it.load = dayNum();
          it.loadAt = Date.now();   // for the progress bar (device-local, like load)
          save(); clearChip();
          float(it.x, it.y - 60, '🥛🥛');
          toast('🧀 the press turns overnight — a wheel by morning', 3600);
          track1('homestead_press');
        });
      } else {
        pr.textContent = '🧀 needs 2 milk in the pocket';
        pr.disabled = true;
      }
      itChip.appendChild(pr);
    }
    if (it.id === 'trough' && FARM) {
      const fd = document.createElement('button');
      fd.className = 'hs-btn';
      if (fedToday()) {
        fd.textContent = '💧 full — tomorrow pays double';
        fd.disabled = true;
      } else {
        fd.textContent = '💧 fill the trough';
        fd.addEventListener('click', () => {
          passStat('hs_fed', dayNum() - (farmStats().hs_fed || 0));
          clearChip();
          refreshItems();                    // the water appears
          hens.forEach((h) => float(h.x, h.y - 40, '❤️'));
          toast('💧 fed & watered — everything pays double tomorrow', 3600);
          track1('homestead_feed');
        });
      }
      itChip.appendChild(fd);
    }
    if (it.id === 'campfire' && FARM && it.lit) {
      // 🍳 "the fire is already lit" — cooking stops hiding behind tent 50
      // + cabin 300 + stove 42 + a 45-minute van. The lit fire in the yard IS
      // the kitchen; the stove stays as the indoor upgrade.
      const ck = document.createElement('button');
      ck.className = 'hs-btn';
      ck.textContent = '🍳 cook';
      ck.addEventListener('click', () => { clearChip(); openCook('fire'); });
      itChip.appendChild(ck);
    }
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
    if (!itChip.children.length) { itChip = null; return false; }
    itChip.style.left = pct(it.x, W);
    itChip.style.top = pct(it.y - d.h - 14, H);
    itChip.style.zIndex = '3000';
    world.appendChild(itChip);
    return true;
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

  // 🤗 A HUG OVER THE FENCE. The bond lives in the owner's yard doc, which
  // only their own browser ever writes — so this leaves a note the server
  // keeps and the owner folds in on their next visit, exactly like the
  // watering can. One per animal per day, whoever gives it.
  function visitorHug(a, h) {
    if (!a.id) return;
    const hkey = 'hs-hg:' + state.slug;
    const today = dayStr();
    let mine = [];
    try { const v = JSON.parse(localStorage.getItem(hkey) || 'null'); if (v && v.d === today) mine = v.a || []; } catch (e) {}
    if (mine.includes(a.id)) return;   // already hugged by this device today — the bubble said so
    mine.push(a.id);
    try { localStorage.setItem(hkey, JSON.stringify({ d: today, a: mine.slice(-24) })); } catch (e) {}
    yFetch('/hug', { slug: state.slug, id: a.id, name: myName }).then((r) => {
      if (r && r.already) return;      // somebody got here first today; the hug still happened on screen
      float(h.x, h.y - 46, '❤️');
      track('homestead_neighbor_hug');
    }).catch(() => {});
  }
  // 🌾 FILLING SOMEBODY ELSE'S TROUGH — one yard, one day, and their morning
  // pays double the way it would have if they had filled it themselves.
  function visitorFeed(it) {
    if (fedToday()) { toast('this trough is full for today 🌾'); return; }
    yFetch('/feed', { slug: state.slug, name: myName }).then((r) => {
      state.feedAt = Date.now();
      refreshItems();
      hens.forEach((h) => float(h.x, h.y - 40, '❤️'));
      if (r && r.already) { toast('someone beat you to the trough today'); return; }
      toast('🌾 you filled ' + state.name + '’s trough — their morning pays double', 3600);
      track('homestead_neighbor_feed');
    }).catch(() => toast('the feed sack is empty — try again in a bit'));
  }

  // 🌱 THE SEED SHEET (the park's, in homestead colours). Only what's in the
  // pouch is listed — an empty pouch never opens an empty modal, it says where
  // seeds come from instead.
  function openSeedPanel(cell, at) {
    const pouch = CROPS.filter((c) => seedCount(c.id) > 0);
    // 🌱 THE ONE PLACE THIS IS SAID. Tapping bare soil is the moment somebody
    // asks where seeds come from, so the answer lives here and nowhere else —
    // an always-on label on the bed answers it before anyone has wondered, and
    // it does not link out: you came to the homestead to be here.
    if (!pouch.length) { toast('no seeds yet — harvest a crop in the park 🌱', 3600); return; }
    const note = document.getElementById('hsSeedNote');
    note.textContent = pouch.length === 1
      ? 'one kind in the pouch — plant it and it grows on watered days.'
      : pouch.length + ' kinds in the pouch. Seeds come from harvesting in the park.';
    const list = document.getElementById('hsSeedList');
    list.replaceChildren();
    pouch.forEach((c) => {
      const row = document.createElement('button');
      row.className = 'hs-seedrow';
      row.type = 'button';
      row.innerHTML = '<i>' + (CROP_EMO[c.id] || '🌱') + '</i><b>' + c.name + '</b>'
        + '<span>🌱×' + seedCount(c.id) + '</span>';
      row.addEventListener('click', () => {
        if (!seedCount(c.id)) return;
        seedUse(c.id);
        cell.crop = c.id; cell.waters = 0; cell.last = ''; cell.planted = dayStr();
        save(); refreshSoil();
        seedEl.hidden = true; syncLock();
        float(at[0], at[1] - 44, '🌱');
        track('homestead_plant', { crop: c.id });
      });
      list.appendChild(row);
    });
    seedEl.hidden = false;
    syncLock();
  }

  function cellTap(cell) {
    clearBedChip();
    if (visiting) { visitorWater(); return; }
    const s = [cellCx(cell), cellBase(cell) - 16];
    const b = cell.crop ? cell : null;
    if (!b) {
      // 🌱 seeds are POCKETED AT THE PARK (crop harvests there), spent here.
      // The picker is the PARK'S SEED SHEET — a modal of rows — not a row of
      // buttons pinned to the bed: that listed every crop in the game and ran
      // off the side of a phone (Kiwi, 28 Aug).
      openSeedPanel(cell, s);
      return;
    }
    if (cropStage(b) >= 4) {
      // 🧺 harvests fill the PANTRY, not the wallet — the kitchen is the value
      state.pantry[b.crop] = (state.pantry[b.crop] || 0) + 1;
      delete cell.crop; delete cell.waters; delete cell.last; delete cell.planted;
      save(); refreshSoil();
      float(s[0], s[1] - 46, '+1 ' + (CROP_EMO[b.crop] || '🧺'));
      track('homestead_harvest', { crop: b.crop });
      if (state.stage < 2) toast('on the shelf — cook it at the fire 🍳', 2800);
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
  // ⚠️ ONE chrome list, three guards (pointerdown, the tap dispatch, the steer):
  // .hs-visit was missing from all three, so a deliberate press on the visiting
  // banner's only way home armed a steer instead of following the link.
  const UI_CHROME = '.wh, .hs-actions, .hs-chip, .hs-confirm, .hs-visit';
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
    if (e.target.closest(UI_CHROME)) return;
    if (!camFree) camFree = { x: pos.x, y: pos.y };   // a tool that forgot the camera degrades, never throws
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
    if (e.target.closest(UI_CHROME)) return;
    if (panelOpen()) return;
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    moved = true; hint(false);
    clearChip(); clearBedChip();
    if (placing) return;   // pointerdown/drag owns the ghost
    if (inside) {          // indoors: the stove answers, furniture chats, else walks
      if (arranging && !visiting) {   // ✥ build mode: tap a piece, lift it
        const L3 = state.inItems[inside] || [];
        for (let k3 = L3.length - 1; k3 >= 0; k3--) {
          const it3 = L3[k3];
          const d4 = DEX[it3.id];
          if (d4 && Math.abs(wx - it3.x) < Math.max(24, d4.w / 2) && wy > it3.y - d4.h - 8 && wy < it3.y + 10) {
            startPlacing(it3.id, it3);
            return;
          }
        }
        // no piece under the tap — fall through, walking still works
      }
      // ⚠️ THE KITCHEN ZONE WAS NEVER BAKED. Both guards here read I.kitchen,
      // and INTERIORS (homestead-geo.js, GENERATED) carries only
      // img/box/spawn/exit/cols — grep -c kitchen returns 0. So the designed
      // door into openCook() could never open, and the stove chip was the only
      // way in: tent 50 + cabin 300 + stove 42 + a 45-min van. Nobody has ever
      // cooked. Removed rather than left looking live; the fire replaces it.
      const L2 = (state.inItems || {})[inside] || [];
      for (let k = L2.length - 1; k >= 0; k--) {
        const it = L2[k];
        const d2 = DEX[it.id];
        if (d2 && Math.abs(wx - it.x) < Math.max(24, d2.w / 2) && wy > it.y - d2.h - 8 && wy < it.y + 10) {
          if (Math.hypot(pos.x - it.x, pos.y - it.y) < 160) {
            if (d2.sit) sitOn(it, d2);
            if (visiting) return;   // sitting is hospitality; the chips are not
            clearChip();
            itChip = document.createElement('div');
            itChip.className = 'hs-chip';
            if (it.id === 'stove') {   // 🍳 a bought stove grants cooking
              const ck2 = document.createElement('button');
              ck2.className = 'hs-btn';
              ck2.textContent = '🍳 cook';
              ck2.addEventListener('click', () => { clearChip(); openCook('stove'); });
              itChip.append(ck2);
            }
            // moving / putting away is build mode's job indoors too (✥ lifts,
            // 🧹 sends to the shed) — a chair just seats you, no menu
            if (!itChip.children.length) { itChip = null; return; }
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
      // 🐔 an animal in your arms lands where you tap — before anything
      // else, so putting her down always wins
      if (carryA) {
        const P2 = plotNow();
        const px2 = Math.max(P2[0] + 16, Math.min(P2[2] - 16, wx));
        const py2 = Math.max(P2[1] + 40, Math.min(P2[3] - 6, wy));
        carryA.a.hm = { x: Math.round(px2), y: Math.round(py2) };
        carryA.x = px2; carryA.y = py2;
        carryA.tx = px2; carryA.ty = py2;
        carryA.el.style.opacity = '';
        float(px2, py2 - 40, '🐾');
        toast(nameOf(carryA.a) + ' stays here now', 2600);
        carryA = null;
        save();
        track1('homestead_move_animal');
        return;
      }
      // ...or pick the nearest one up
      if (FARM) {
        let bh = null, bd = 36;
        for (const h3 of hens) {
          if (!h3.a) continue;
          const d3 = Math.hypot(wx - h3.x, wy - (h3.y - 14));
          if (d3 < bd) { bd = d3; bh = h3; }
        }
        if (bh) {
          carryA = bh;
          bh.el.style.opacity = '0.55';
          toast('🐾 tap where ' + nameOf(bh.a) + ' should stay', 3600);
          return;
        }
      }
      const k = itemAt(wx, wy);
      if (k >= 0) {
        startPlacing(state.items[k].id, state.items[k]);
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
      if (inside) {   // 📦 indoor furniture goes back to the shed from here
        const L4 = (state.inItems || {})[inside] || [];
        for (let k4 = L4.length - 1; k4 >= 0; k4--) {
          const it4 = L4[k4];
          const d4 = DEX[it4.id];
          if (d4 && Math.abs(wx - it4.x) < Math.max(24, d4.w / 2) && wy > it4.y - d4.h - 8 && wy < it4.y + 10) {
            L4.splice(k4, 1);
            state.shed.push({ id: it4.id });
            save(); refreshInItems();
            float(it4.x, it4.y - 30, '📦');
            track('homestead_pickup', { id: it4.id, via: 'planner' });
            return;
          }
        }
        return;
      }
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
        save(); refreshFenceB(); rebuildSolids(); penTint();
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
      save(); refreshFenceB(); rebuildSolids(); penTint();
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
    // 🐔 a hen within reach answers with her mood — checked AFTER the placed
    // items, deliberately: the flock gathers AT the trough, so a hen-first
    // test swallowed the tap that fills it (caught in the walk). Mood is a
    // flourish; the trough is the verb. Never in build mode — the planner's
    // taps belong to the grid.
    if (FARM && !planner) {
      // ⚠️ NEAREST animal wins, not first-in-array — in a full paddock the
      // flock bunches up, and array order let a hen steal the tap meant for
      // the woolly sheep beside her (caught in the slice-3 walk)
      let bestH = null, bestD = 36;
      for (const h of hens) {
        const d2 = Math.hypot(wx - h.x, wy - (h.y - 14));
        if (d2 < bestD) { bestD = d2; bestH = h; }
      }
      if (bestH) {
        const t0 = Date.now();
        if (bestH.a && lastTapH === bestH && t0 - lastTapAt < 600) { lastTapH = null; const a0 = bestH.a; phone().then((PH) => PH.openPet(a0, visiting ? 'guest' : undefined)); return; }
        lastTapH = bestH; lastTapAt = t0;
        henMood(bestH); return;
      }
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
      if (Math.hypot(pos.x - state.signAt.x, pos.y - state.signAt.y) < 130) {
        if (!state.claimedAt && !visiting) { claimShown = false; offerClaim(); return; }
        openGuest(); return;
      }
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
        // visitors may step inside too (13 Aug) — the room renders read-only
        if (doorish && INTERIORS[homeTier()]) {
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
        if (visiting) {
          tgt.x = it.x; tgt.y = it.y + 30;                            // look, don't touch…
          if (it.id === 'trough' && FARM) visitorFeed(it);            // …except the trough, which is help
          return;
        }
        if (Math.hypot(pos.x - it.x, pos.y - it.y) < 150) {
          if (d.sit) sitOn(it, d);
          if (!itemChip(i) && !d.sit) { tgt.x = wx; tgt.y = wy; }   // nothing to do here — just walk
        }
        else { tgt.x = it.x; tgt.y = it.y + 30; }
        return;
      }
    }
    tgt.x = wx; tgt.y = wy;
  });
  // 🕹 hold-and-drag steering — walk orders only. The build modes keep their
  // own drag verb (camera pan while placing/fencing/etc), so steering stands
  // down whenever one is active; indoors it just walks, like a tap does.
  initSteer({
    view,
    blocked: (e) => panelOpen() || placing || digging || fencing || clearing || arranging
      || e.target.closest(UI_CHROME),
    toWorld: (cx, cy) => { const r = view.getBoundingClientRect(); return { x: (cx - r.left + camX) / scale, y: (cy - r.top + camY) / scale }; },
    onArm: () => { moved = true; hint(false); clearChip(); clearBedChip(); },
    onMove: (w) => { tgt.x = w.x; tgt.y = w.y; },
    first: () => track('hs_steer'),
  });
  // 🚪 the door intent: any new target (tap, WASD) cancels it; arriving enters
  setInterval(() => {
    if (!doorTgt) return;
    if (inside || placing || tgt.x !== doorTgt.x || tgt.y !== doorTgt.y) { doorTgt = null; return; }
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
    if (kx || ky) { tgt.x = pos.x + kx * 30; tgt.y = pos.y + ky * 30; moved = true; hint(false); }
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
      if (FARM) farmEggTick();
      peers.forEach((p) => drawPeer(p));
      if (roadCoins.length) roadCoinTick();
    }
    hsSendMove(now);
    cam();
  }
  // the QA reach-in (the park's ?parktest pattern) — nothing here exists in a
  // normal session
  // ---- ⬇️ THE PULL — cross-device sync's missing half (Trym, 31 Aug) ------
  // The push always converged: /claim keys yards by the PASS, so a second
  // signed-in device gets the same address back and there is never a duplicate
  // yard per pass. But that device started EMPTY — Trym's phone greeted him as
  // Testy's Homestead while the real Tryms Place sat published on the server.
  // On boot, /mine asks the server which yard this pass owns:
  //   · nothing local (or a Testy leftover, or another pass's yard) → ADOPT
  //     the published yard wholesale; the old local state is stashed in
  //     hs-v1-prev first, so nothing is ever silently destroyed
  //   · same yard, server saved LATER by another device, nothing local
  //     unpushed → refresh the SYNCED fields only — shed, pantry, eggs, hens
  //     and every other local-only pocket survives untouched
  //   · same yard, first boot after this shipped → grandfather: record the
  //     stamp, adopt nothing (the device in hand is the source of truth)
  // ?hstest skips the pull entirely — test yards stay test yards, and the
  // scenario guard already refuses to clobber real ones.
  const syncedFields = (d) => ({
    name: d.name || state.name, stage: d.stage || 0,
    style: d.style || {}, look: typeof d.look === 'string' ? d.look : '',
    items: Array.isArray(d.items) ? d.items : [],
    soil: Array.isArray(d.soil) ? d.soil : [],
    fence: Array.isArray(d.fence) ? d.fence : [],
    mailAt: d.mailAt, signAt: d.signAt, home: d.home,
    inItems: (d.inItems && typeof d.inItems === 'object') ? d.inItems : {},
    animals: Array.isArray(d.animals) ? d.animals : undefined,
    memory: Array.isArray(d.memory) ? d.memory : undefined,
    grass: Array.isArray(d.grass) ? d.grass : undefined,
    // ⚠️ absent, not empty: a yard last saved by a tab that did not know about
    // the pantry leaves this device's own shelf exactly where it is
    ...(d.goods && typeof d.goods === 'object' ? { eggs: +d.goods.eggs || 0, milk: +d.goods.milk || 0,
      wool: +d.goods.wool || 0, cheese: +d.goods.cheese || 0 } : {}),
    ...(d.pantry && typeof d.pantry === 'object' ? { pantry: d.pantry } : {}),
    ...(Array.isArray(d.shed) ? { shed: d.shed.filter((it) => it && it.id).map((it) => ({ id: it.id })) } : {}),
  });
  async function yardPull() {
    if (!FARM || visiting || HS_TEST) return;
    let r;
    try { r = await yFetch('/mine', {}); } catch (e) { return; }
    if (!r || !r.slug) return;
    // 🪧 a renamed yard is still MINE — the server says what it used to
    // be called, so this device switches address quietly (refresh, never
    // adopt: the shed, pantry and pockets survive)
    if (r.was && state.slug === r.was && state.slug !== r.slug) { state.slug = r.slug; saveRaw(); }
    const mine = state.slug === r.slug;
    // ⚠️⭐ ONLY WHEN THE SERVER HAS SOMETHING BETTER TO OFFER. This read "the
    // local yard is called Testy" on its own, and meant "a QA leftover — take
    // the real published yard instead". But a scenario that ran on a real
    // device PUBLISHES the Testy name (Trym's own yard is slug testy-3), and
    // then adopting it leaves the name Testy — so the next boot adopts again,
    // and the next, and the homestead reloads under the player forever.
    // A Testy yard is only disposable when the published one is not also Testy.
    const testy = /^Testy/.test(state.name || '') && !/^Testy/.test(r.name || '');
    let next = null;
    if (!state.claimedAt || testy || !mine) {
      try { localStorage.setItem('hs-v1-prev', localStorage.getItem(HS_KEY) || ''); } catch (e) {}
      next = withHome({ v: 1, shed: [], pantry: {}, ...syncedFields(r), slug: r.slug,
        claimedAt: r.created || Date.now(),
        bed: Array.isArray(r.bed) ? r.bed : undefined, bedAt: r.bedAt });
    } else if (!state.pubUpdated) {
      state.pubUpdated = r.updated || 1;   // grandfather: this device is truth
      saveRaw();
      return;
    } else if (r.mark && (state.pubMarks || []).includes(String(r.mark))) {
      // the stamp on the server is this device's own last flush: take the
      // receipt and keep the yard on screen exactly as it is
      state.pubUpdated = r.updated || state.pubUpdated;
      state.dirty = 0;
      saveRaw();
      return;
    } else if ((r.updated || 0) > state.pubUpdated && !state.dirty) {
      next = { ...state, ...syncedFields(r) };
    }
    if (!next) return;
    if (Array.isArray(next.animals)) {
      next.animals = next.animals.map((a) => ({ sp: a.sp, b: a.b || 0, pd: a.pd || 0, name: a.name || '',
        wd: a.wd || 0, gd: a.gd == null ? undefined : a.gd, hm: a.hm,
        id: a.id || mintId(), ad: a.ad == null ? undefined : a.ad, gs: a.gs || 0, sd: a.sd == null ? undefined : a.sd,
        pa: a.pa || undefined, egg: a.egg ? 1 : undefined }));
      next.hens = next.animals.filter((a) => a.sp === 'hen').length || next.hens || 0;
    }
    next.pubUpdated = r.updated || Date.now();
    next.dirty = 0;
    // ⚠️ THE STAMP GUARD IS NOT ENOUGH, and it never was. It lives in
    // sessionStorage behind three swallowed catches, so a browser that refuses
    // session storage loses the guard SILENTLY — and even with it working, a
    // stamp that changes every boot (a device whose identity flips between an
    // anonymous pass and a linked one gets a different yard from /mine each
    // time) is a new stamp every time and never matches. Either way the page
    // adopts, reloads, adopts, reloads, and the homestead is unusable.
    //
    // So the reload gets a BUDGET, kept in localStorage — the store we know
    // works, because the yard itself lives there. Two adoptions in half a
    // minute is already wrong; a third is a loop, and we stop and say so
    // rather than bouncing the player forever.
    const stamp = r.slug + ':' + (r.updated || 0);
    // ⚠️ this read is ALSO the probe. If sessionStorage throws here, the guard
    // below is dead and that is the whole bug — no need for a second key to
    // find it out (and the storage gate is right to refuse one).
    let guardOk = true;
    try { if (sessionStorage.getItem('hs-pull') === stamp) return; } catch (e) { guardOk = false; }
    let spins = 0;
    try {
      const b = JSON.parse(localStorage.getItem('hs-pullbudget') || 'null');
      spins = (b && Date.now() - b.t < 30000) ? (b.n || 0) : 0;
    } catch (e) {}
    if (spins >= 2) {
      // ⚠️ NO RELOAD. Keep whatever is on screen, tell the truth, and leave a
      // breadcrumb that says which of the two causes it was.
      try { localStorage.removeItem('hs-pullbudget'); } catch (e) {}
      // ⚠️ THE DIAGNOSIS GOES ON SCREEN, NOT IN THE CONSOLE. This fires on
      // PHONES, where nobody can open one — a diagnostic the sufferer cannot
      // read is not a diagnostic.
      // ⚠️ these are read by a PLAYER, not by me. "session storage", "stamp"
      // and "yard" are words from the code. The `why` on the event below keeps
      // the precision for the desk; the sentence keeps the plain version.
      const why = !guardOk ? 'this browser blocks storage'
        : !mine ? 'this device is on a different homestead'
          : 'another device keeps changing it';
      track1('homestead_pull', { how: 'loop', why: !guardOk ? 'nosession' : !mine ? 'slug' : 'stamp' });
      toast('⚠️ Could not load your homestead (' + why + '). Showing what is saved on this device.', 8000);
      console.warn('[homestead] pull loop stopped after ' + spins + ' adoptions.',
        { serverSlug: r.slug, mySlug: state.slug, mine, updated: r.updated,
          claimed: !!state.claimedAt,
          sessionGuard: guardOk ? 'works — so the stamp is changing every boot'
            : 'UNAVAILABLE — this browser refuses sessionStorage, and that is the cause' });
      return;
    }
    try { localStorage.setItem('hs-pullbudget', JSON.stringify({ t: Date.now(), n: spins + 1 })); } catch (e) {}
    try { sessionStorage.setItem('hs-pull', stamp); } catch (e) {}
    // ⚠️ same hazard as yardResync: the reload's pagehide beacon calls
    // stampMark(), which persists `state`. Adopt into memory first or the
    // pull is undone on its way out.
    Object.assign(state, next);
    try { localStorage.setItem(HS_KEY, JSON.stringify(state)); } catch (e) { return; }
    track1('homestead_pull', { how: mine ? 'refresh' : 'adopt' });
    toast('⬇️ fetching your homestead…', 2400);
    setTimeout(() => location.reload(), 700);
  }
  yardPull();

  // 🐔 farm boot — after everything above exists: back-grants for yards
  // claimed before the farm, then the morning
  if (FARM) {
    document.querySelectorAll('[data-tab="sell"], [data-tab="buy"]').forEach((b) => { b.hidden = false; });
  }
  // 🐔 My animals appears the day somebody moves in — kept fresh on every
  // shop paint, since buys and rehomes change the answer
  function armAnimalsTab() {
    const has = FARM && !visiting && (state.animals || []).length > 0;
    document.querySelectorAll('[data-tab="animals"]').forEach((b) => { b.hidden = !has; });
    const ever = has || (FARM && !visiting && ((state.grass || []).length > 0 || (state.memory || []).length > 0));
    document.querySelectorAll('[data-tab="tree"]').forEach((b) => { b.hidden = !ever; });
    // the story is about visitors, so it waits for an address to visit
    const told = FARM && !visiting && !!state.claimedAt && !!state.slug;
    document.querySelectorAll('[data-tab="story"]').forEach((b) => { b.hidden = !told; });
  }
  armAnimalsTab();
  if (FARM && !visiting && state.claimedAt) { farmGrant(); morningTick(); }
  if (HS_TEST) {
    window.__hs = {
      pos, tgt, peers, birds: birdsLive,
      // 🐔 farm QA: morning(d) walks the clock d days and relays the morning
      morning: (d) => { qaDayOfs += (d || 1) * 86400000; morningTick(); return farmStats().hs_day; },
      pull: yardPull,
      bond: (i, b) => { const a = farmAnimals()[i || 0]; if (a) { a.b = b; a.pd = 0; save(); } return a; },
      animals: () => farmAnimals(),
      pet: (i) => phone().then((PH) => PH.openPet(farmAnimals()[i || 0])),
      age: (i, d2) => { const a = farmAnimals()[i || 0]; if (a) { a.ad = dayNum() - d2; save(); } return a; },
      grass: () => (state.grass = state.grass || []),
      memory: () => (state.memory = state.memory || []),
      tree: () => openShop('tree'),
      cook: (w) => openCook(w || 'stove'),
      tailor: () => openTailor(),
      stock: (o) => { Object.assign(state, o); save(); return state; },
      pantry: () => (state.pantry = state.pantry || {}),
      fence: (cells) => { (cells || []).forEach((c) => { if (!fenceHas(c.i, c.j)) state.fence.push({ i: c.i, j: c.j }); }); refreshFenceB(); save(); return state.fence.length; },
      blocked: (x, y) => blockedOut(x, y),
      dogAt: () => { const h2 = hens.find((x) => x.a && x.a.sp === 'dog'); return h2 && [h2.x, h2.y]; },
      grow: (i, g2) => { const a = farmAnimals()[i || 0]; if (a) { a.gd = g2; save(); } return a; },
      feed: () => { passStat('hs_fed', dayNum() - (farmStats().hs_fed || 0)); return farmStats().hs_fed; },
      dog: () => { const h2 = hens.find((x) => x.a && x.a.sp === 'dog'); return h2 && h2.dg; },
      pens: () => penCaps(),
      wool: (i, d) => { const a = farmAnimals()[i || 0]; if (a) { a.wd = d; save(); } return a; },
      goods: () => ({ eggs: state.eggs || 0, milk: state.milk || 0, wool: state.wool || 0, cheese: state.cheese || 0 }),
      farm: () => ({ hens: state.hens || 0, eggs: state.eggs || 0, fed: fedToday(), eggsOnGround: eggEls.length }),
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
      // ⚠️ THE TOUR IS 33KB OF ONCE-EVER WIZARD AND IT WAS IN EVERY PAGE LOAD.
      // Statically imported, and the homestead is its only consumer in the
      // repo — so Rollup folded the whole thing (CSS template, STOPS table,
      // finale canvas painter) into this chunk, and every returning player
      // downloaded and parsed it forever to run two localStorage reads that
      // say "you have seen this". Both entry points bail on those same two
      // keys (world-tutorial.js:507 and :638) before they touch anything, so
      // the read happens here and the module is fetched only when it is
      // actually going to draw. Same precedent as sticker-core at :1658.
      const forced = /[?&]bwtour(?:=|&|$)/.test(location.search);
      let tourSeen = false, tourWaved = false;
      try {
        tourSeen = !!localStorage.getItem('bw-tour-v1');
        tourWaved = !!localStorage.getItem('bw-tour-inv');
      } catch (e) {}
      if (forced || !(tourSeen || tourWaved)) {
        import('./world-tutorial.js').then((t) => {
          if (forced) t.initWorldTutorial({ ...tourOpts, force: true });
          else t.initTutorialInvite({ ...tourOpts, mount: document.querySelector('.hs-view') });
        }).catch(() => {});
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
