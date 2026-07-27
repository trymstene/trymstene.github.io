// 🌳 THE PARK — Park 2.0 P2: the beach engine's chassis on the park scene
// (park-2-plan). Walkable world, both-axis camera, doors to the rave (south)
// and the bay (east), World HUD, presence room. Activities land in P3.
// ⚠️ the engine's art dict imports as ART — this module already has a local
// SVG() string helper (the acorn/stake pixel maps)
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S, SVG as ART } from '../lib/banana-engine.js';
import { WEARABLE_PACKS, DROPS } from '../data/wearables.js';
import { passStat, passGet, passPush } from '../lib/banana-pass.js';
import { levelFor } from '../lib/pass-defs.js';
import { presenceRoom, poofInto, worldSid, seedRand, COIN_PERIOD, COIN_WAIT, COIN_OFFSET, coinAmountFor } from '../lib/world.js';
import { iconSvg } from '../lib/pixel-icons.js';
import { catCustom, loadCatalog, fullOutfit } from '../lib/drops.js';
import { wearToCustom } from '../lib/wear-render.js';
// generated geometry — tools/build-park-scene.py declares every collider on
// the place() call that draws its prop. Never hand-copy a coordinate here.
import {
  WORLD, BOUND, PLAZA, POND, FOUNTAIN, MARKET, MEADOW, PLOTS, DOORS, OLDBENCH,
  OB_RECTS, OB_CIRCLES, OVERLAYS, TREE_OVS,
} from './park-geo.js';

// ⚠️ init() is CALLED AT THE BOTTOM of this file — module consts first,
// entry point last (the TDZ trap that once killed the rave floor).
const view = document.getElementById('pkView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// ?parktest = the QA hook (same family as ?beachtest / ?cointest): all five
// P3 features force-spawn near the plaza spawn, timers ignored.
const PARK_TEST = typeof location !== 'undefined' && /[?&]parktest(?:=|&|$)/.test(location.search);

// ?phase=0..4 — bookmarkable phase-view links (Trym): forces that phase's
// full visual state (plates/trees/critters/fountain/pill) RENDER-ONLY; the
// server data still flows (weeds/plants/eggs), only the phase is pinned.
const PHASE_FORCE = (() => {
  if (typeof location === 'undefined') return -1;
  const m = location.search.match(/[?&]phase=([0-4])(?:&|$)/);
  return m ? +m[1] : -1;
})();
const PHASE_MID = [10, 30, 50, 70, 90];   // a mid-band % to show when pinned
// the health bar's phase faces — real PixelIcon glyphs (pixelarticons Pro,
// bundled via src/icons/pixelart/), dead → joy. Never stock-emoji faces.
const PHASE_FACES = ['skull', 'frown', 'meh', 'smile', 'laugh'];

const R = (x, y, w, h, f) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"/>';
const SVG = (vb, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vb + '" shape-rendering="crispEdges">' + body + '</svg>';

// 🌰 the acorn — cap, warm body, inner shadow (banana-density pixel style)
const ACORN_SVG = SVG('11 13',
  R(4, 0, 3, 1, '#4a3018') + R(2, 1, 7, 1, '#6b4320') + R(1, 2, 9, 2, '#8a5a2b')
  + R(2, 2, 3, 1, '#a8742a') + R(2, 4, 7, 1, '#e0a84e') + R(1, 5, 9, 4, '#c9913a')
  + R(3, 5, 2, 3, '#e8b866') + R(2, 9, 7, 2, '#a8742a') + R(3, 11, 5, 1, '#8a5a2b')
  + R(5, 12, 1, 1, '#6b4320'));

// 🪧 the ownership stake — a tiny garden-label stake (plank-wood palette,
// banana-density) planted at the soil's front edge of YOUR plants only.
// The chips it replaced "took up much of the visuals" (Trym): species = the
// sprite, thirst = the soil, ready = the glint — only ownership needed art.
const STAKE_SVG = SVG('7 12',
  R(1, 0, 5, 1, '#3a2b18')
  + R(0, 1, 1, 4, '#3a2b18') + R(6, 1, 1, 4, '#3a2b18')
  + R(1, 1, 5, 3, '#b8834a') + R(1, 1, 5, 1, '#d9a860') + R(1, 1, 1, 3, '#d9a860')
  + R(1, 4, 5, 1, '#8a5a2b') + R(1, 5, 5, 1, '#3a2b18')
  + R(2, 6, 3, 5, '#8a5a2b') + R(4, 6, 1, 5, '#6b4320')
  + R(3, 11, 1, 1, '#4a3018'));

// 🍌 OLD PEEL — the bench elder by the fountain, the park's ambient
// commentator. A NORMAL engine banana (drawComposite) LOCKED to the first
// standing frame — no dancing, too old — round glasses + walking cane
// (the cap/beard drafts were dropped; his look is glasses and cane).
const OLD_NAME = 'old peel';
const OLD_DRAW = {
  hat: 'none', glasses: 'potter', extras: { oldcane: true },
  top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
};
// his lines, a band per phase — grief → worry → cautious hope → warmth →
// joy. Trym's lines verbatim where they fit; hints, never orders.
const OLD_LINES = [
  ['its so sad to see the park like this…',
    'someone should clean up this mess…',
    'i remember when this lawn was all green. long time ago now.',
    'even the fountain gave up. dry as my elbows.'],
  ['she’s hurting, this old park. weeds everywhere.',
    'the hens won’t lay in a place like this, you know.',
    'a little weeding would go a long way…'],
  ['wish someone could tend to the plants',
    'the soil’s still good, you know',
    'green in patches. she’s trying, i can tell.',
    'a bit of water works wonders. always has.'],
  ['the squirrels came back. good sign, that.',
    'she’s nearly herself again. keep at it.',
    'sat here all morning. didn’t want to leave.'],
  ['haven’t seen her this beautiful in years',
    'butterflies! my missus loved the butterflies.',
    'this is how i remember it. exactly this.',
    'some days this bench is the best seat in the world.'],
];
// 💬 his DIALOGUE — the park's first full RPG NPC (the pattern the Gardener
// reuses later). A topic answers with `byPhase` (index = health band 0-4),
// one static `line`, or a `seq` of lore beats stepped per ask; `close` ends
// the talk after the answer. Lowercase, warm, lean.
const OLD_GREET = 'ah, company. sit a while — what’s on your mind?';
const OLD_TOPICS = [
  { id: 'park', q: 'what happened to the park?', byPhase: [
    'she used to be the pride of banana world. then the footsteps stopped, and the weeds moved in.',
    'she’s coming back from a rough patch. parks don’t heal alone, you know.',
    'she’s half herself again. green in patches, like spring remembering the way.',
    'look at her. nearly the park i first sat down in, all those years ago.',
    'this is her. the real her. i knew she had it in her.',
  ] },
  { id: 'help', q: 'what can i do to help?', byPhase: [
    'pull the weeds, pick up the rubbish. small hands make green grass.',
    'keep weeding — and water anything anyone’s planted. she notices.',
    'plant something. and water the thirsty ones, even a stranger’s flowers.',
    'keep her watered and she’ll keep blooming. we’re nearly there.',
    'you’ve done it, friend. sit down. enjoy her. that helps too.',
  ] },
  { id: 'lore', q: 'tell me about yourself', seq: [
    'kept this park for forty years, i did. mowed her, planted her, knew every bench by its wobble.',
    'my missus and i had our first picnic right here. she loved the butterflies — said they were flowers that got restless.',
    'now i just sit. somebody else’s turn to keep her. maybe yours, eh?',
  ] },
  { id: 'shop', q: 'what’s that mushroom house?', line: 'inka’s little print shop, past the stand. everything else in this park costs coins — her wall is the one real thing. good sort, inka.' },
  { id: 'bye', q: 'goodbye', byPhase: [
    'mind the weeds on your way, friend.',
    'come back soon. she needs the footsteps.',
    'off you go. bring a watering can next time, eh?',
    'lovely day for it. off you go.',
    'enjoy her, friend. that’s what she’s for.',
  ], close: true },
];

// 🦋 the meadow's six — palette IS the species. Ambient life only (W1c):
// nothing is caught or kept, the variety is just so no two look alike.
const BFLY = [
  { id: 'skipper', name: 'Lemon Skipper', a: '#ffe135', b: '#c99a1e' },
  { id: 'meadowblue', name: 'Meadow Blue', a: '#7db9ff', b: '#3a6fd6' },
  { id: 'monarch', name: 'Ember Monarch', a: '#ff9d3a', b: '#c2571a' },
  { id: 'snowcap', name: 'Snowcap White', a: '#f5f2e8', b: '#b8bcd0' },
  { id: 'duskwing', name: 'Plum Duskwing', a: '#b48ae0', b: '#6b3fa0' },
  { id: 'glasswing', name: 'Leaf Glasswing', a: '#9fe08d', b: '#4d9e4a' },
];
// two frames as .f1/.f2 groups — CSS steps() them, the poof pattern
const bflySvg = (a, b) => SVG('10 8',
  '<g class="f1">'
  + R(0, 0, 3, 3, a) + R(1, 3, 2, 2, b) + R(1, 1, 1, 1, b)
  + R(7, 0, 3, 3, a) + R(7, 3, 2, 2, b) + R(8, 1, 1, 1, b)
  + R(3, 0, 1, 1, '#3a2b18') + R(6, 0, 1, 1, '#3a2b18') + R(4, 1, 2, 5, '#3a2b18')
  + '</g><g class="f2">'
  + R(2, 0, 2, 4, a) + R(2, 3, 2, 1, b) + R(6, 0, 2, 4, a) + R(6, 3, 2, 1, b)
  + R(4, 1, 2, 5, '#3a2b18')
  + '</g>');

// 🐿 two frames, alternate legs
const SQ_SVG = SVG('14 10',
  '<g class="f1">'
  + R(0, 1, 3, 5, '#6b4320') + R(1, 0, 2, 2, '#6b4320') + R(3, 3, 7, 4, '#8a5a2b')
  + R(9, 2, 3, 3, '#8a5a2b') + R(10, 1, 1, 1, '#6b4320') + R(11, 3, 1, 1, '#1c120a')
  + R(5, 6, 4, 1, '#c9a15a') + R(4, 7, 1, 2, '#6b4320') + R(8, 7, 1, 2, '#6b4320')
  + '</g><g class="f2">'
  + R(0, 1, 3, 5, '#6b4320') + R(1, 0, 2, 2, '#6b4320') + R(3, 3, 7, 4, '#8a5a2b')
  + R(9, 2, 3, 3, '#8a5a2b') + R(10, 1, 1, 1, '#6b4320') + R(11, 3, 1, 1, '#1c120a')
  + R(5, 6, 4, 1, '#c9a15a') + R(3, 7, 2, 1, '#6b4320') + R(9, 7, 2, 1, '#6b4320')
  + '</g>');

// 🌰 ground near the tree clumps + stumps — jittered + blocked()-tested on spawn
const ACORN_SPOTS = [[300, 650], [1040, 300], [1215, 985], [1650, 265], [2480, 985],
  [900, 530], [1005, 345], [878, 572], [735, 1000], [2555, 330], [400, 558]];
const TEST_ACORN_SPOTS = [[1300, 860], [1450, 870], [1360, 910]];

// 🧃 THE MERCH SHOP — keys are the PDP slugs (/make-a-banana/<key>/, from
// shared/products.js); prices are display hints, Shopify enforces the real one
const MERCH_PRODUCTS = [
  { key: 'sticker', name: 'die-cut sticker', price: '$14.99' },
  { key: 'magnet', name: 'fridge magnet', price: '$16.99' },
  { key: 'tee', name: 'tee', price: '$34.99' },
];
// 🍌 INKA, keeper of the merch shop — monocle + a drawn print-shop apron
// (banana NPCs are our own art; the apron is painted over the composite)
const KEEPER_GREET = 'welcome in. everything on this wall is real — printed, packed and posted.';
const KEEPER_LINES = [
  'that wall is your banana, printed. tap one down and have a look.',
  'no coins in here. real things cost real money — that is what makes them real.',
  'stickers go everywhere. laptops, fridges, somebody’s forehead once.',
  'free shipping, anywhere on earth. i checked twice.',
];
// the apron, painted in 3px blocks on the 150 grid (inner-shadowed hem + a
// little banana on the pocket) — scaled to whatever canvas it lands on
function drawApron(ctx, S) {
  const u = S / 150;
  const px = (x, y, w, h, f) => { ctx.fillStyle = f; ctx.fillRect(x * u, y * u, w * u, h * u); };
  const BIB = '#3a5f8a', DARK = '#2a4668', HEM = '#22394f';
  px(63, 78, 3, 6, DARK); px(84, 78, 3, 6, DARK);       // straps
  px(63, 84, 24, 9, BIB);                                // bib
  px(57, 93, 36, 24, BIB);                               // skirt
  px(60, 117, 30, 5, DARK);                              // hem shadow
  px(63, 120, 24, 3, HEM);
  px(66, 99, 18, 12, DARK);                              // the pocket
  px(72, 102, 3, 6, '#ffe135'); px(75, 101, 3, 3, '#ffe135'); // pocket banana
  px(75, 107, 3, 2, '#c99a1e');
}

// 🍌🏪 THE BANANA STAND — the coin shop, ported from the old /park/ page
// (banana-stand.js). Same manifest stock, same DESC voice, same lock art.
const ST_HELLO = 'what can i get you? everything on the wall is for sale. finally.';
const ST_DESC = {
  potato: "it's a potato.",
  squidhat: "the squid. 120 coins. i don't make the rules. i am the rules.",
  medal: "you didn't participate in anything. congratulations.",
  sockssandals: 'open-toe. at a rave. bold.',
  buckethat: 'a bucket. worn confidently, it becomes a hat.',
  duckhat: 'the duck stays on your head at all times.',
  flamingoring: 'flotation certified. dance floor approved.',
};
const ST_SOLD = [
  (l) => `SOLD. the ${l} is yours. wear it loud.`,
  (l) => `the ${l}. excellent taste. probably.`,
  (l) => `one ${l}, no receipt. we don't do receipts.`,
];
const ST_LOCK_SVG = '<svg viewBox="0 0 8 9" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="4" height="1" fill="#b8781b"/><rect x="1" y="1" width="1" height="2" fill="#b8781b"/><rect x="6" y="1" width="1" height="2" fill="#b8781b"/><rect x="0" y="3" width="8" height="5" fill="#ffd23f"/><rect x="0" y="8" width="8" height="1" fill="#e6a817"/><rect x="3" y="4" width="2" height="2" fill="#7a4a21"/><rect x="3" y="6" width="1" height="1" fill="#7a4a21"/></svg>';
const ST_BACKCAT_PRICE = 50;

// 🌱 THE GARDEN — the park's daily-return ritual (P3b).
// ⚠️ THE seed catalog — stars/days/price must match GARDEN_SEEDS in
// worker-rave/src/index.js (one catalog, two runtimes). ⭐ stars have ONE
// meaning: a living plant feeds the Bloom by its stars (higher also wilts
// slower, server-side). Flowers harvest into DRAFT wearables (own_<id> pass
// stats, /dev-wearables desk); crops pay rep (stars × 8) — crop wearables
// wait on a Trym batch review.
const SEEDS = [
  { id: 'daisy', emoji: '🌼', name: 'daisy', stars: 1, price: 10, days: 2, wearable: 'daisypin', wearLabel: 'daisy pin' },
  // sunflower wearable TBD (round 4: the crown draft was dropped) — pays rep meanwhile
  { id: 'sunflower', emoji: '🌻', name: 'sunflower', stars: 2, price: 25, days: 4 },
  { id: 'tulip', emoji: '🌷', name: 'midnight tulip', stars: 3, price: 60, days: 5, wearable: 'midnighttulip', wearLabel: 'midnight tulip', rare: true },
  { id: 'tomato', emoji: '🍅', name: 'tomato', stars: 3, price: 90, days: 4, crop: 1 },
  { id: 'pumpkin', emoji: '🎃', name: 'pumpkin', stars: 4, price: 160, days: 5, crop: 1 },
  { id: 'wheat', emoji: '🌾', name: 'golden wheat', stars: 5, price: 300, days: 6, crop: 1, rare: true },
];
const SEED_BY = {};
SEEDS.forEach((s) => { SEED_BY[s.id] = s; });
const starStr = (n) => '⭐'.repeat(n);
// 🧑‍🌾 gardener level — derived from total harvests (garden_harvests pass
// stat): reach GLVL_AT[i] harvests → level i+1 → seeds up to GLVL_STARS[i]
const GLVL_AT = [0, 3, 8, 15];
const GLVL_STARS = [2, 3, 4, 5];
// growth-stage sprites (generated by build-park-scene.py, pack art) + dims;
// crops carry four stages of their own (c-<id>-1..4)
const STAGE_ART = {
  sprout1: ['g-sprout1.png', 24, 28], sprout2: ['g-sprout2.png', 24, 33],
  daisy: ['g-daisy.png', 26, 31], sunflower: ['g-sunflower.png', 31, 47], tulip: ['g-tulip.png', 31, 26],
  tomato1: ['c-tomato-1.png', 22, 19], tomato2: ['c-tomato-2.png', 22, 33],
  tomato3: ['c-tomato-3.png', 22, 38], tomato4: ['c-tomato-4.png', 28, 58],
  pumpkin1: ['c-pumpkin-1.png', 28, 19], pumpkin2: ['c-pumpkin-2.png', 38, 28],
  pumpkin3: ['c-pumpkin-3.png', 38, 35], pumpkin4: ['c-pumpkin-4.png', 38, 51],
  wheat1: ['c-wheat-1.png', 24, 12], wheat2: ['c-wheat-2.png', 24, 24],
  wheat3: ['c-wheat-3.png', 24, 26], wheat4: ['c-wheat-4.png', 31, 38],
};
const GARDEN_API = 'https://banana-rave.trymstene.workers.dev/park-garden';
// 🌿 weed spots for the ?parktest shim only — the real list lives server-side
// in worker-rave (keep in sync); two sprite variants picked by id hash
const WEED_SPOTS_QA = [[380, 690], [960, 640], [1700, 560], [1650, 700], [900, 1000], [1550, 950]];

// 🧰 THE TOOL SLOT — tools for chores, taps for things (Trym): ONE morphing
// action-bar button, live only while a chore is in range; press = do the
// NEAREST one (walk the last step if needed). Tapping the thing still works.
const TOOL_RANGE = 110;

// 🐔 THE ANIMALS (W2) — farm-pack wanderers, out in every bloom; their MOOD
// BUBBLE is the meter made visible (❤️ ≥3 · 😐 2 · 😢 ≤1). Strips = 6 walk
// frames facing right, frame 0 doubles as the standing pose. kind = cell
// shape: sq 36×36 (chickens) · tall 36×72 (rooster) · wide 72×72 (the
// ducks/rabbit sheets use 96-wide pack cells). Ducks keep the pond bank.
const ANIMALS = [
  { strip: 'chicken1', kind: 'sq', home: [1120, 650], r: 120 },
  { strip: 'chicken2', kind: 'sq', home: [1210, 730], r: 120 },
  { strip: 'rooster', kind: 'tall', home: [1050, 760], r: 140 },
  { strip: 'duck1', kind: 'wide', pond: true, w: 61, h: 61 },   // ducks at 0.85 (generator keeps in sync)
  { strip: 'duck2', kind: 'wide', pond: true, w: 61, h: 61 },
  { strip: 'rabbit', kind: 'wide', home: [2050, 720], r: 150 },
];
// ?parktest gathers the land animals by the plaza spawn (ducks stay pond-side)
const TEST_ANIMAL_HOMES = [[1270, 830], [1340, 890], [1440, 880], null, null, [1470, 820]];

// 🌸 the bloom card IS the bar (Trym): five tappable phase segments, a
// glyph each, wilted→lush ramp; a tap reveals that phase's line below
const PHASE_GLYPHS = ['💀', '🍂', '🌱', '🌿', '🦋'];
// ONE line per phase (Trym): the state + what to do about it
const PHASE_LINES = [
  '💀 the park is dead — pull the weeds and plant something.',
  '🍂 wilting badly — keep pulling, keep planting.',
  '🌾 patchy, half straw — water what grows.',
  '🌿 nearly back — keep it watered and weeded.',
  '🦋 the park is thriving — hold it here and an egg can come out golden.',
];

const WISHES = [
  'you wish for a sunny day. granted — look around.',
  'you wish the rave never closes. it never has.',
  'you wish for the giant plush. the claw machine heard that.',
  'you wish for more acorns. the trees will see what they can do.',
  'you wish somebody walks up the road right now. keep watching it.',
  'you keep this one to yourself. the fountain understands.',
];

function init() {
  const W = WORLD.w, H = WORLD.h;
  // the most art px we ever show on each axis (see the beach's layout() notes)
  const VIEW_ART_W = 900, VIEW_ART_V = 760;
  const PLAZA_FIT = 520;   // the plaza (500 wide) must always fit across
  const world = document.getElementById('pkWorld');
  const meEl = document.getElementById('pkMe');
  const meCtx = document.getElementById('pkMeCv').getContext('2d');
  const cutEl = document.getElementById('pkCut');
  const hintEl = document.getElementById('pkHint');
  const exitEl = document.getElementById('pkExitStrip');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let myOutfit = { hat: 'none', glasses: 'none', extras: {} };
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o) myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {}, c: o.c };
  } catch (e) {}
  const ME_DRAW = { ...myOutfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
  // a caught community item lives in outfit.c — never-cache-a-miss redraw
  loadCatalog().then(() => { try { lastF = -1; drawMe(); peers.forEach((p) => drawPeer(p, true)); } catch (e) {} });

  const pct = (v, span) => (v / span * 100) + '%';

  // ---- camera: pans BOTH axes, the banana leads ---------------------------
  let scale = 1, viewW = 0, viewH = 0, camX = 0, camY = 0;
  function layout() {
    const r = view.getBoundingClientRect();
    viewW = r.width; viewH = r.height;
    const want = Math.max(viewW / VIEW_ART_W, viewH / VIEW_ART_V);
    const fill = Math.max(viewW / W, viewH / H);
    const maxIn = viewW / PLAZA_FIT;
    scale = Math.min(1.7, maxIn, Math.max(0.55, fill, want));
    world.style.width = (W * scale) + 'px';
    world.style.height = (H * scale) + 'px';
  }
  addEventListener('resize', layout);
  layout();
  function camTarget() {
    return {
      x: Math.max(0, Math.min(Math.max(0, W * scale - viewW), pos.x * scale - viewW / 2)),
      y: Math.max(0, Math.min(Math.max(0, H * scale - viewH), pos.y * scale - viewH * 0.58)),
    };
  }
  let camWX = NaN, camWY = NaN;   // change-guard: write only when moved
  function cam() {
    const t = camTarget();
    camX += (t.x - camX) * 0.12;
    camY += (t.y - camY) * 0.12;
    if (Math.abs(t.x - camX) < 0.2) camX = t.x;
    if (Math.abs(t.y - camY) < 0.2) camY = t.y;
    if (camX === camWX && camY === camWY) return;
    camWX = camX; camWY = camY;
    world.style.transform = 'translate(' + (-camX) + 'px,' + (-camY) + 'px)';
  }

  // ⭐ one painter's algorithm for the whole park: z from the ground line
  const depth = (el, y) => { el.style.zIndex = String(100 + Math.round(y)); };

  // the props, redrawn above the plate so they can occlude walkers
  const ovEls = [];
  OVERLAYS.forEach((o) => {
    const d = document.createElement('div');
    d.className = 'pk-ov';
    d.style.left = pct(o[1], W); d.style.top = pct(o[2], H);
    d.style.width = pct(o[3], W); d.style.height = pct(o[4], H);
    d.style.backgroundImage = "url('/assets/park/" + o[0] + "')";
    d.style.zIndex = String(100 + Math.round(o[5]));
    world.appendChild(d);
    ovEls.push(d);
  });

  // 🍂 THE FIVE BLOOM PHASES (W1c) — 0 dead … 4 perfect. Bands start at
  // 0/20/40/60/80, ±3 hysteresis on every border so nothing flaps. Ground =
  // three plates from ONE generator pass: sad (0-1) · mid (2-3) · lush (4,
  // the world's own background). TREES green up one by one between them in a
  // stable shuffled order — each tree crossfades 0.8s, ~100ms apart.
  const PHASE_STARTS = [0, 20, 40, 60, 80];
  const PHASE_GREEN = [0, 0.25, 0.5, 0.75, 1];
  let phase = -1;
  function phaseFor(v) {
    let p = phase;
    if (p < 0) { p = 0; while (p < 4 && v >= PHASE_STARTS[p + 1]) p++; return p; }
    while (p < 4 && v >= PHASE_STARTS[p + 1] + 3) p++;
    while (p > 0 && v <= PHASE_STARTS[p] - 3) p--;
    return p;
  }
  // the non-lush plates: lazy-built, preloaded before the fade — no mid-fade pop
  const plates = {};
  let plateWant = 'lush';
  function plateShow(kind) {
    plateWant = kind;
    ['sad', 'mid'].forEach((k) => {
      let el = plates[k];
      if (!el) {
        if (k !== kind) return;
        el = plates[k] = document.createElement('div');
        el.className = 'pk-plate';
        world.insertBefore(el, world.firstChild);
        const pre = new Image();
        pre.onload = () => {
          el.style.backgroundImage = "url('" + pre.src + "')";
          el.dataset.ok = '1';
          requestAnimationFrame(() => { el.style.opacity = plateWant === k ? '1' : '0'; });
        };
        pre.src = '/assets/park/park-' + k + '.png';
        return;
      }
      if (el.dataset.ok) el.style.opacity = k === kind ? '1' : '0';
    });
  }
  // every tree wilts/greens on its own sad-twin element; non-tree overlay
  // props (cart, kiosk, tables) follow the plate — sad only at phases 0-1
  const TREE_ORDER = TREE_OVS.slice().sort((a, b) =>
    ((a * 2654435761) % 4093) - ((b * 2654435761) % 4093) || a - b);
  const PROP_OVS = OVERLAYS.map((_, i) => i).filter((i) => TREE_OVS.indexOf(i) < 0);
  const ovSads = {};
  function fadeOv(i, sad, delay) {
    let el = ovSads[i];
    if (!el) {
      if (!sad) return false;              // green + never wilted = nothing to do
      el = ovSads[i] = document.createElement('div');
      el.className = 'pk-ovsad';
      el.style.backgroundImage = "url('/assets/park/ov-sad-" + i + ".png')";
      ovEls[i].appendChild(el);
    }
    const want = sad ? '1' : '0';
    if (el.dataset.want === want) return false;
    el.dataset.want = want;
    el.style.transitionDelay = delay + 'ms';
    requestAnimationFrame(() => { el.style.opacity = want; });
    return true;
  }
  function setTrees(p) {
    const n = Math.round(PHASE_GREEN[p] * TREE_ORDER.length);
    let k = 0;
    TREE_ORDER.forEach((ov, idx) => { if (fadeOv(ov, idx >= n, k * 100)) k++; });
  }
  function setPhase(p) {
    if (p === phase) return;
    phase = p;
    plateShow(p <= 1 ? 'sad' : p <= 3 ? 'mid' : 'lush');
    setTrees(p);
    PROP_OVS.forEach((i) => fadeOv(i, p <= 1, 0));
    setSquirrels(p >= 3);                  // 🐿 life returns near the top…
    setBflies(p >= 4);                     // 🦋 …and only a perfect park has these
    setAnimalMood(p);                      // 🐔 the flock's mood follows the bloom
    setFountain(p <= 1);                   // ⛲ dead monument in a dead park
    oldPhasePoke();                        // 🍌 Old Peel finds new words
  }

  // ⛲ the fountain — the pack's 6-frame strip, CSS-stepped like the bonfire.
  // At phases 0-1 the pack's Turn_Off end frame crossfades over it (jet
  // gone, basin dry) with the same sad grade the animals get.
  let fountainEl = null, fountainOff = null;
  (() => {
    const [fx, fy, fw, fh] = FOUNTAIN;
    const f = document.createElement('div');
    f.className = 'pk-fountain';
    f.style.left = pct(fx, W); f.style.top = pct(fy, H);
    f.style.width = pct(fw, W); f.style.height = pct(fh, H);
    f.style.zIndex = String(100 + fy);
    world.appendChild(f);
    fountainEl = f;
  })();
  function setFountain(dead) {
    if (!fountainOff) {
      if (!dead) return;                     // running + never died = nothing to do
      fountainOff = document.createElement('div');
      fountainOff.className = 'pk-fountain-off';
      fountainEl.appendChild(fountainOff);
      requestAnimationFrame(() => fountainOff.classList.add('is-on'));
      return;
    }
    fountainOff.classList.toggle('is-on', dead);
  }

  // ---- geometry -----------------------------------------------------------
  const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  // the BOUND inset is the wall, except the two door corridors through it
  const inSouthDoorLane = (x, y) => Math.abs(x - DOORS.south.x) < 60 && y > H - BOUND && y < H - 14;
  const inEastDoorLane = (x, y) => Math.abs(y - DOORS.east.y) < 60 && x > W - BOUND && x < W - 14;
  function blocked(x, y) {
    if (x < BOUND || x > W - BOUND || y < BOUND || y > H - BOUND) {
      if (!inSouthDoorLane(x, y) && !inEastDoorLane(x, y)) return true;
    }
    for (const r of OB_RECTS) if (inRect(x, y, r)) return true;
    for (const c of OB_CIRCLES) if (Math.hypot(x - c[0], y - c[1]) < c[2]) return true;
    const px = (x - POND.x) / POND.rx, py = (y - POND.y) / POND.ry;
    if (px * px + py * py < 1) return true;   // bananas famously can't swim
    return false;
  }

  // ---- spawn: arrive through the door you came in by ----------------------
  const fromBeach = /[?&]beach(?:=|&|$)/.test(location.search);
  const fromRave = /[?&]rave(?:=|&|$)/.test(location.search);
  const pos = fromBeach ? { x: 2610, y: DOORS.east.y }
    : fromRave ? { x: DOORS.south.x, y: 1008 }
      : { x: 1380, y: 820 };                       // the plaza's south edge
  const tgt = fromBeach ? { x: 2480, y: DOORS.east.y }
    : fromRave ? { x: DOORS.south.x, y: 900 }
      : { x: 1380, y: 740 };
  let meWX = NaN, meWY = NaN;   // change-guard
  const c0 = camTarget(); camX = c0.x; camY = c0.y;
  track('park_join', { via: fromBeach ? 'beach' : fromRave ? 'rave' : 'direct' });

  // ---- walking ------------------------------------------------------------
  const SPEED = 168;
  const keys = {};
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      keys[k] = true; e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  view.addEventListener('click', (e) => {
    if (e.target.closest('.pk-whud') || e.target.closest('.pk-actions') || e.target.closest('.pk-panel') || e.target.closest('.pk-shop')) return;
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    hint(false);
    pendingShop = false;
    pendingStand = false;
    pendingToss = false;
    pendingOld = false;
    pendingGarden = null;
    pendingWater = null;
    pendingWeed = null;
    pendingEgg = null;
    if (tapEgg(wx, wy)) return;
    if (tapBfly(wx, wy)) return;
    if (tapAnimal(wx, wy)) return;
    if (tapOld(wx, wy)) return;
    if (tapWeed(wx, wy)) return;
    if (tapGarden(wx, wy)) return;
    if (tapShop(wx, wy)) return;
    if (tapStand(wx, wy)) return;
    if (tapFountain(wx, wy)) return;
    tgt.x = wx;
    tgt.y = wy;
  });
  let pendingShop = false, pendingToss = false, pendingOld = false;

  // ---- 🚪 the doors: hysteresis, never an instant teleport ----------------
  // Arm only once you've been properly INSIDE the park (clear of both doors),
  // so arriving through a door can't bounce you straight back out. In the
  // zone the confirm strip names where the road goes; walking on to the door
  // itself is the yes — the cut runs, then the nav.
  const DOOR_DEFS = [
    { x: DOORS.south.x, y: DOORS.south.y, href: '/rave/', label: 'keep walking ↓ back to the rave' },
    { x: DOORS.east.x, y: DOORS.east.y, href: '/beach/?park', label: 'keep walking → to Banana Bay' },
  ];
  const DOOR_ZONE = 130, DOOR_GO = 36, DOOR_ARM = 180;
  let doorArmed = false, leaving = false, stripOn = -1;
  function exitTo(href) {
    if (leaving) return;
    leaving = true;
    try { parkRoom.leave(); } catch (e) {}   // poof for everyone the instant you go
    if (REDUCED) { location.href = href; return; }
    cutEl.classList.add('is-on');
    setTimeout(() => { location.href = href; }, 170);
  }
  function doorTick() {
    let nearest = -1, nd = Infinity;
    DOOR_DEFS.forEach((d, i) => {
      const dist = Math.hypot(pos.x - d.x, pos.y - d.y);
      if (dist < nd) { nd = dist; nearest = i; }
    });
    if (!doorArmed) { if (nd > DOOR_ARM) doorArmed = true; return; }
    if (nd < DOOR_GO) { exitTo(DOOR_DEFS[nearest].href); return; }
    const want = nd < DOOR_ZONE ? nearest : -1;
    if (want !== stripOn) {
      stripOn = want;
      if (want < 0) exitEl.classList.remove('is-on');
      else { exitEl.textContent = DOOR_DEFS[want].label; exitEl.classList.add('is-on'); }
    }
  }

  function float(x, y, text) {
    const d = document.createElement('div');
    d.className = 'pk-float';
    d.textContent = text;
    d.style.left = pct(x, W);
    d.style.top = pct(y, H);
    world.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  // the big-moment toast — one element, one timer that only toggles a class
  const toastEl = document.getElementById('pkToast');
  let toastTimer = null;
  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms || 2400);
  }

  // ---- 🌰 ACORNS: the park's shells — a calm XP trickle -------------------
  // Walk-over pickup, +2 rep (the same world stat the shells/floor feed).
  // All clocks ride the rAF step loop, so a hidden tab spawns nothing.
  const acorns = [];
  const ACORN_MAX = 3;
  let acornNextAt = 0, acornTracked = false;
  function acornSpawn(spots) {
    if (acorns.length >= ACORN_MAX) return;
    const list = spots || ACORN_SPOTS;
    for (let t = 0; t < 14; t++) {
      const s = list[Math.floor(Math.random() * list.length)];
      const x = s[0] + (Math.random() * 32 - 16), y = s[1] + (Math.random() * 24 - 12);
      if (blocked(x, y)) continue;
      if (acorns.some((a) => Math.hypot(a.x - x, a.y - y) < 60)) continue;
      const el = document.createElement('div');
      el.className = 'pk-acorn';
      el.innerHTML = ACORN_SVG;
      el.style.left = pct(x, W);
      el.style.top = pct(y, H);
      world.appendChild(el);
      acorns.push({ el, x, y });
      return;
    }
  }
  function acornTick(now) {
    if (now > acornNextAt) {
      acornNextAt = now + 25000 + Math.random() * 15000;
      acornSpawn(PARK_TEST ? TEST_ACORN_SPOTS : null);
    }
    for (let i = acorns.length - 1; i >= 0; i--) {
      const a = acorns[i];
      if (Math.hypot(pos.x - a.x, (pos.y - 6) - a.y) < 34) {
        a.el.remove();
        acorns.splice(i, 1);
        passStat('rep', 2);
        refreshHud();               // the XP lands on the LEVEL bar right away
        float(a.x, a.y - 12, '+2');
        if (!acornTracked) { acornTracked = true; track('park_acorn'); }
      }
    }
  }
  acornSpawn(PARK_TEST ? TEST_ACORN_SPOTS : null);
  if (PARK_TEST) { acornSpawn(TEST_ACORN_SPOTS); acornSpawn(TEST_ACORN_SPOTS); }

  // ---- 🦋 BUTTERFLIES — phase-4 life, nothing kept ------------------------
  // Only a PERFECT park has butterflies (they poof away if the bloom drops).
  // Two flit over the meadow, one wanders. No catching, no atlas, no storage
  // (Trym W1c): walk up slowly and tap one and it startles off with a
  // sparkle. Rush one and it darts off too.
  try { localStorage.removeItem('pk_bfly'); } catch (e) {}   // the old collection
  const M_AREA = { x0: MEADOW[0] + 40, y0: MEADOW[1] + 30, x1: MEADOW[2] - 40, y1: MEADOW[3] - 30 };
  const ALL_AREA = PARK_TEST
    ? { x0: 1240, y0: 740, x1: 1520, y1: 900 }
    : { x0: BOUND + 60, y0: BOUND + 60, x1: W - BOUND - 60, y1: H - BOUND - 60 };
  const bflys = [{ area: M_AREA, gone: true }, { area: M_AREA, gone: true }, { area: ALL_AREA, gone: true }];
  let bflyOn = false;
  function setBflies(on) {
    if (on === bflyOn) return;
    bflyOn = on;
    bflys.forEach((b) => {
      if (on) { bflySpawn(b); return; }
      if (b.gone) return;
      poofInto(world, 'pk-poof', b.x / W * 100, (b.y - 26) / H * 100);
      b.el.remove();
      b.gone = true;
    });
  }
  function bflyAim(b) {
    b.tx = b.area.x0 + Math.random() * (b.area.x1 - b.area.x0);
    b.ty = b.area.y0 + Math.random() * (b.area.y1 - b.area.y0);
    b.spd = 45 + Math.random() * 30;
    b.fleeing = false;
  }
  function bflySpawn(b) {
    b.sp = BFLY[Math.floor(Math.random() * BFLY.length)];
    const el = document.createElement('div');
    el.className = 'pk-bfly';
    el.innerHTML = bflySvg(b.sp.a, b.sp.b);
    el.style.zIndex = '1500';
    world.appendChild(el);
    b.el = el;
    b.gone = false;
    b.phase = Math.random() * 6.28;
    b.x = b.area.x0 + Math.random() * (b.area.x1 - b.area.x0);
    b.y = b.area.y0 + Math.random() * (b.area.y1 - b.area.y0);
    b.perchUntil = 0;
    b.dir = 1;
    bflyAim(b);
  }
  function bflyTick(dt, now) {
    if (!bflyOn) return;
    for (const b of bflys) {
      if (b.gone) continue;
      const pd = Math.hypot(pos.x - b.x, pos.y - b.y);
      // barrelled at → it's off, well out of reach
      if (pd < 85 && pSpeed > 115 && !b.fleeing) {
        const ang = Math.atan2(b.y - pos.y, b.x - pos.x);
        b.tx = Math.max(b.area.x0, Math.min(b.area.x1, b.x + Math.cos(ang) * 190));
        b.ty = Math.max(b.area.y0, Math.min(b.area.y1, b.y + Math.sin(ang) * 130));
        b.spd = 175;
        b.fleeing = true;
        b.perchUntil = 0;
      }
      if (b.perchUntil > now) { /* settled — still flapping */ }
      else {
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 4) { b.perchUntil = now + 800 + Math.random() * 2600; bflyAim(b); }
        else {
          const m = Math.min(d, b.spd * dt);
          b.x += (dx / d) * m;
          b.y += (dy / d) * m;
          if (Math.abs(dx) > 4) b.dir = dx < 0 ? -1 : 1;
        }
      }
      const bob = Math.sin(now / 300 + b.phase) * 4;
      b.el.style.left = pct(b.x, W);
      b.el.style.top = pct(b.y - 26 + bob, H);
      b.el.style.transform = 'translate(-50%,-50%)' + (b.dir < 0 ? ' scaleX(-1)' : '');
    }
  }
  function startleBfly(b) {
    float(b.x, b.y - 34, '✦');
    const ang = Math.atan2(b.y - pos.y, b.x - pos.x) + (Math.random() - 0.5);
    b.tx = Math.max(b.area.x0, Math.min(b.area.x1, b.x + Math.cos(ang) * 260));
    b.ty = Math.max(b.area.y0, Math.min(b.area.y1, b.y + Math.sin(ang) * 170));
    b.spd = 195;
    b.fleeing = true;
    b.perchUntil = 0;
  }
  function tapBfly(wx, wy) {
    const b = bflyOn && bflys.find((q) => !q.gone && Math.hypot(wx - q.x, wy - (q.y - 26)) < 46);
    if (!b) return false;
    if (Math.hypot(pos.x - b.x, pos.y - b.y) < 78) { startleBfly(b); return true; }
    // approach: stop SHORT of it, so the last steps are yours to take slowly
    const d = Math.hypot(b.x - pos.x, b.y - pos.y) || 1;
    tgt.x = b.x - ((b.x - pos.x) / d) * 55;
    tgt.y = b.y - ((b.y - pos.y) / d) * 55;
    return true;
  }

  // ---- 🐿 SQUIRRELS: locals, never interactive ----------------------------
  // The crab pattern: a home they orbit, darts with long stillnesses, a bolt
  // when you get close — and they never set foot on the plaza. Life
  // indicators (W1c): they only live in a nearly-bloomed park (phase ≥3)
  // and poof off if it drops.
  const inPlaza = (x, y) => {
    const ex = (x - PLAZA.x) / PLAZA.rx, ey = (y - PLAZA.y) / PLAZA.ry;
    return ex * ex + ey * ey < 1;
  };
  const SQ_HOMES = PARK_TEST ? [[1500, 880], [1180, 970]] : [[300, 640], [1180, 970]];
  const squirrels = [];
  let sqOn = false;
  function setSquirrels(on) {
    if (on === sqOn) return;
    sqOn = on;
    if (!on) {
      squirrels.forEach((s) => { poofInto(world, 'pk-poof', s.x / W * 100, (s.y - 8) / H * 100); s.el.remove(); });
      squirrels.length = 0;
      return;
    }
    SQ_HOMES.forEach(([hx, hy]) => {
      const el = document.createElement('div');
      el.className = 'pk-squirrel is-still';
      el.innerHTML = SQ_SVG;
      el.style.left = pct(hx, W);
      el.style.top = pct(hy, H);
      world.appendChild(el);
      squirrels.push({ el, hx, hy, x: hx, y: hy, tx: hx, ty: hy,
        wait: Math.random() * 3, flee: 0, face: 1, still: true });
    });
  }
  function sqPick(s) {
    const a = Math.random() * Math.PI * 2;
    const r2 = 50 + Math.random() * 90;
    let tx = s.x + Math.cos(a) * r2, ty = s.y + Math.sin(a) * r2 * 0.6;
    if (Math.hypot(tx - s.hx, ty - s.hy) > 140) { tx = s.hx; ty = s.hy; }
    if (!blocked(tx, ty) && !inPlaza(tx, ty)) { s.tx = tx; s.ty = ty; }
  }
  function sqStep(s, dt) {
    const fear = Math.hypot(pos.x - s.x, pos.y - s.y);
    if (fear < 70) {
      const ang = Math.atan2(s.y - pos.y, s.x - pos.x);
      const tx = s.x + Math.cos(ang) * 130, ty = s.y + Math.sin(ang) * 65;
      if (!inPlaza(tx, ty)) { s.tx = tx; s.ty = ty; }
      s.flee = 0.9; s.wait = 0;
    }
    s.flee = Math.max(0, s.flee - dt);
    if (s.wait > 0) {
      s.wait -= dt;
      if (!s.still) { s.still = true; s.el.classList.add('is-still'); }
      return;
    }
    const dx = s.tx - s.x, dy = s.ty - s.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) { s.wait = 1.5 + Math.random() * 4; sqPick(s); return; }
    if (s.still) { s.still = false; s.el.classList.remove('is-still'); }
    const sp = (s.flee > 0 ? 170 : 55) * dt;
    const nx = s.x + (dx / d) * Math.min(d, sp);
    const ny = s.y + (dy / d) * Math.min(d, sp);
    if (!blocked(nx, ny) && !inPlaza(nx, ny)) { s.x = nx; s.y = ny; }
    else { s.wait = 0.5; sqPick(s); return; }
    if (Math.abs(dx) > 5) s.face = dx < 0 ? -1 : 1;
    s.el.style.left = pct(s.x, W);
    s.el.style.top = pct(s.y, H);
    s.el.style.transform = 'translate(-50%,-100%)' + (s.face < 0 ? ' scaleX(-1)' : '');
    depth(s.el, s.y);
  }

  // ---- 🐔 THE ANIMALS — the bloom made visible, on legs -------------------
  // Squirrel movement (home orbit, pause-walk-pause) minus the flee — these
  // are tame. Ducks orbit the POND BANK: targets are nearby angles on the
  // shore ring, so the chords never cut the water. The mood bubble pops ONCE
  // when an animal first walks into view, again on tap, and re-pops live
  // when the bloom crosses a mood border.
  const AN_SIZE = { sq: [36, 36], tall: [36, 72], wide: [72, 72] };
  // hearts-only mood language (Trym: no detailed stock-emoji faces in-world):
  // 💔 hurting park · nothing at mid · ❤️ thriving
  const MOOD_EMO = ['💔', '', '❤️'];
  const bandFor = (p) => (p >= 3 ? 2 : p === 2 ? 1 : 0);
  const animals = [];
  let moodBand = -1;
  const duckPoint = (a) => ({ x: POND.x + Math.cos(a) * (POND.rx + 30), y: POND.y + Math.sin(a) * (POND.ry + 26) });
  function anPick(a) {
    for (let t = 0; t < 8; t++) {
      if (a.pond) {
        const na = a.ang + (Math.random() * 1.2 - 0.6);
        const p = duckPoint(na);
        if (!blocked(p.x, p.y)) { a.ang = na; a.tx = p.x; a.ty = p.y; return; }
        continue;
      }
      const q = Math.random() * Math.PI * 2;
      const rr = 40 + Math.random() * a.r * 0.7;
      let tx = a.x + Math.cos(q) * rr, ty = a.y + Math.sin(q) * rr * 0.6;
      if (Math.hypot(tx - a.hx, ty - a.hy) > a.r) { tx = a.hx; ty = a.hy; }
      if (!blocked(tx, ty) && !inPlaza(tx, ty)) { a.tx = tx; a.ty = ty; return; }
    }
  }
  function anPlace(a) {
    a.el.style.left = pct(a.x, W);
    a.el.style.top = pct(a.y, H);
    a.el.style.transform = 'translate(-50%,-100%)' + (a.face < 0 ? ' scaleX(-1)' : '');
    depth(a.el, a.y);
  }
  function showMood(a) {
    const e = MOOD_EMO[bandFor(phase)];
    if (!e) { a.bub.classList.remove('is-on'); return; }   // mid band = no bubble
    a.bub.textContent = e;
    a.bub.classList.add('is-on');
    clearTimeout(a.bubTimer);
    a.bubTimer = setTimeout(() => a.bub.classList.remove('is-on'), 2500);
  }
  const onScreen = (a) => {
    const sx = a.x * scale - camX, sy = a.y * scale - camY;
    return sx > -30 && sx < viewW + 30 && sy > -30 && sy < viewH + 30;
  };
  function anStep(a, dt) {
    if (a.wait > 0) {
      a.wait -= dt;
      if (!a.still) { a.still = true; a.el.classList.add('is-still'); }
      return;
    }
    const dx = a.tx - a.x, dy = a.ty - a.y;
    const d = Math.hypot(dx, dy);
    const sad = moodBand === 0;                  // mopey = slower, longer sulks
    if (d < 3) {
      a.wait = (sad ? 3.5 : 1.5) + Math.random() * (sad ? 5 : 3.5);
      anPick(a);
      return;
    }
    if (a.still) { a.still = false; a.el.classList.remove('is-still'); }
    const sp = (sad ? 26 : 46) * dt;
    const nx = a.x + (dx / d) * Math.min(d, sp);
    const ny = a.y + (dy / d) * Math.min(d, sp);
    if (!blocked(nx, ny) && (a.pond || !inPlaza(nx, ny))) { a.x = nx; a.y = ny; }
    else { a.wait = 0.6; anPick(a); return; }
    if (Math.abs(dx) > 4 && (dx < 0) !== (a.face < 0)) {
      a.face = dx < 0 ? -1 : 1;
      // counter-flip the bubble so the emote never mirrors with the body
      a.bub.style.transform = 'translate(-50%,-100%)' + (a.face < 0 ? ' scaleX(-1)' : '');
    }
    anPlace(a);
  }
  function animalTick(dt) {
    for (const a of animals) {
      anStep(a, dt);
      if (!a.seen && phase >= 0 && onScreen(a)) { a.seen = true; showMood(a); }
    }
  }
  function setAnimalMood(p) {
    const b = bandFor(p);
    if (b === moodBand) return;
    moodBand = b;
    animals.forEach((a) => {
      a.el.classList.toggle('is-sad', b === 0);
      if (a.seen && onScreen(a)) showMood(a);
    });
  }
  function tapAnimal(wx, wy) {
    const a = animals.find((q) => Math.abs(wx - q.x) < q.w * 0.7 && wy > q.y - q.h - 8 && wy < q.y + 10);
    if (!a) return false;
    showMood(a);
    return true;
  }
  ANIMALS.forEach((sp, i) => {
    const home = PARK_TEST && TEST_ANIMAL_HOMES[i] ? TEST_ANIMAL_HOMES[i] : sp.home;
    const el = document.createElement('div');
    el.className = 'pk-animal pk-animal--' + sp.kind + ' pk-animal--' + sp.strip + ' is-still';
    const bub = document.createElement('span');
    bub.className = 'pk-mood';
    el.appendChild(bub);
    world.appendChild(el);
    const a = {
      el, bub, pond: !!sp.pond,
      hx: home ? home[0] : 0, hy: home ? home[1] : 0, r: sp.r || 130,
      ang: Math.random() * 6.28, face: 1, still: true,
      wait: Math.random() * 3, seen: false, bubTimer: null,
      w: sp.w || AN_SIZE[sp.kind][0], h: sp.h || AN_SIZE[sp.kind][1],
    };
    if (a.pond) {   // land on a clear stretch of bank (the east shore has trees)
      let p = duckPoint(a.ang);
      for (let t = 0; t < 12 && blocked(p.x, p.y); t++) { a.ang = Math.random() * 6.28; p = duckPoint(a.ang); }
      a.x = p.x; a.y = p.y;
    } else { a.x = a.hx; a.y = a.hy; }
    a.tx = a.x; a.ty = a.y;
    anPlace(a);
    animals.push(a);
  });

  // ---- 🍌 OLD PEEL — the bench elder, phase-aware -------------------------
  // Ambient commentator (the animal-bubble grammar, words instead of moods):
  // one line pops on first sight each session, a tap peeks the next line, a
  // phase change refreshes him mid-sit. No walking, no scene, no event.
  // A player-sized engine banana (frame 0, never redrawn) sat ON TOP of the
  // plate's bench: full body visible, feet landing just past the seat's
  // front edge — no clipping (Trym: he overflows the bench, never cut).
  const OLD_X = OLDBENCH[0], OLD_Y = OLDBENCH[1];
  const OLD_CW = 0.036 * W;              // the player size class (.pk-me)
  const OLD_BOT = OLD_Y + 13;            // canvas bottom → feet at the bench front
  const oldEl = document.createElement('div');
  oldEl.className = 'pk-old';
  const oldCv = document.createElement('canvas');
  oldCv.width = 150; oldCv.height = 150;
  oldEl.appendChild(oldCv);
  const oldBub = document.createElement('span');
  oldBub.className = 'pk-mood pk-oldsay';
  oldEl.appendChild(oldBub);
  oldEl.style.left = pct(OLD_X, W);
  oldEl.style.top = pct(OLD_BOT, H);
  oldEl.style.width = pct(OLD_CW, W);
  depth(oldEl, OLD_Y);
  world.appendChild(oldEl);
  // portrait for his dialogue card: the SAME composite, drawn 2× for
  // crispness and zoomed so the waist-up crop fills the frame (beach v2)
  const oldPortraitCv = document.getElementById('pkOldPortrait');
  assetsReady().then(() => {           // one still frame + the redraw belt
    const drawOld = () => {
      drawComposite(oldCv.getContext('2d'), 150, 0, OLD_DRAW);
      const pc = oldPortraitCv.getContext('2d');
      pc.clearRect(0, 0, 390, 390);
      pc.save();
      pc.scale(1.5, 1.5); pc.translate(-390 * 0.167, -390 * 0.22);
      drawComposite(pc, 390, 0, OLD_DRAW);
      pc.restore();
    };
    drawOld();
    setTimeout(drawOld, 700);
  });
  let oldSeen = false, oldIdx = 0, oldBand = -1, oldTimer = null;
  const oldOnScreen = () => {
    const sx = OLD_X * scale - camX, sy = OLD_Y * scale - camY;
    return sx > -30 && sx < viewW + 30 && sy > -30 && sy < viewH + 30;
  };
  function oldSay() {
    const band = Math.max(0, phase);
    if (band !== oldBand) { oldBand = band; oldIdx = 0; }
    const lines = OLD_LINES[band];
    oldBub.innerHTML = '<i>' + OLD_NAME + '</i>' + esc(lines[oldIdx++ % lines.length]);
    oldBub.classList.add('is-on');
    clearTimeout(oldTimer);
    oldTimer = setTimeout(() => oldBub.classList.remove('is-on'), 5600);
  }
  function oldTick() {
    if (oldSeen || phase < 0) return;
    if (oldOnScreen()) { oldSeen = true; oldSay(); }
  }
  function oldPhasePoke() {
    if (oldSeen && oldOnScreen()) oldSay();   // live phase → fresh words
  }
  // 💬 the talk — walk-then-open (beach NPC grammar). Console-RPG flow
  // (Trym): tap a question → the deck hides and the answer TYPES into the
  // box (~32ms/char, blinking ▌); a tap skips to the full text; ▼ steps
  // lore beats / returns to the questions; goodbye closes after its line.
  // Presentation only — OLD_TOPICS stays data-driven (the Gardener inherits).
  const oldPanel = document.getElementById('pkOldPanel');
  const oldLineEl = document.getElementById('pkOldLine');
  const oldQsEl = document.getElementById('pkOldQs');
  const oldBox = document.getElementById('pkOldBox');
  const oldBoxText = document.getElementById('pkOldBoxText');
  const OLD_TALK_AT = { x: OLD_X, y: OLD_Y + 46 };   // stand at the bench front
  const RM_TYPE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let oldCloseTimer = null, typeTimer = null, typeText = '', typeAt = 0;
  let oldSeq = null, oldSeqAt = 0, oldClosing = false;
  function oldTypeDone() {
    clearInterval(typeTimer);
    typeTimer = null;
    oldBoxText.textContent = typeText;
    oldBox.classList.remove('is-typing');
    oldBox.classList.add('is-done');
    if (oldClosing) { clearTimeout(oldCloseTimer); oldCloseTimer = setTimeout(closeOld, 1700); }
  }
  function oldType(text) {
    clearInterval(typeTimer);
    typeText = text;
    typeAt = 0;
    oldBox.hidden = false;
    oldQsEl.hidden = true;
    oldLineEl.hidden = true;
    oldBox.classList.remove('is-done');
    if (RM_TYPE) { oldTypeDone(); return; }   // instant text, same flow
    oldBox.classList.add('is-typing');
    oldBoxText.textContent = '';
    typeTimer = setInterval(() => {
      typeAt += 1;
      oldBoxText.textContent = typeText.slice(0, typeAt);
      if (typeAt >= typeText.length) oldTypeDone();
    }, 32);
  }
  function oldBackToQs() {
    oldBox.hidden = true;
    oldBox.classList.remove('is-typing', 'is-done');
    oldSeq = null;
    oldQsEl.hidden = false;
    oldLineEl.hidden = false;
  }
  oldBox.addEventListener('click', () => {
    if (typeTimer) { oldTypeDone(); return; }        // mid-type tap = skip
    if (!oldBox.classList.contains('is-done')) return;
    if (oldClosing) { closeOld(); return; }          // goodbye: tap = leave now
    if (oldSeq && oldSeqAt < oldSeq.length - 1) {    // ▼ = the next lore beat
      oldSeqAt += 1;
      oldType(oldSeq[oldSeqAt]);
      return;
    }
    oldBackToQs();                                   // ▼ = the question deck
  });
  function oldAsk(t) {
    oldClosing = !!t.close;
    if (t.seq) { oldSeq = t.seq; oldSeqAt = 0; oldType(t.seq[0]); return; }
    oldSeq = null;
    oldType(t.byPhase ? t.byPhase[Math.max(0, Math.min(4, phase))] : t.line);
  }
  function openOld() {
    clearTimeout(oldCloseTimer);
    oldClosing = false;
    oldBackToQs();
    oldLineEl.textContent = OLD_GREET;
    if (!oldQsEl.childElementCount) {
      OLD_TOPICS.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = t.q;
        b.addEventListener('click', () => oldAsk(t));
        oldQsEl.appendChild(b);
      });
    }
    oldPanel.hidden = false;
  }
  function closeOld() {
    clearTimeout(oldCloseTimer);
    clearInterval(typeTimer);
    typeTimer = null;
    oldPanel.hidden = true;
  }
  document.getElementById('pkOldClose').addEventListener('click', closeOld);
  oldPanel.addEventListener('click', (e) => { if (e.target === oldPanel) closeOld(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !oldPanel.hidden) closeOld(); });
  function tapOld(wx, wy) {
    if (!(Math.abs(wx - OLD_X) < 45 && wy > OLD_Y - 90 && wy < OLD_Y + 12)) return false;
    if (Math.hypot(pos.x - OLD_TALK_AT.x, pos.y - OLD_TALK_AT.y) < 130) { openOld(); return true; }
    pendingOld = true;                        // walk up first, then talk
    tgt.x = OLD_TALK_AT.x;
    tgt.y = OLD_TALK_AT.y;
    return true;
  }
  function oldWalkTick() {
    if (pendingOld && Math.hypot(pos.x - OLD_TALK_AT.x, pos.y - OLD_TALK_AT.y) < 130) {
      pendingOld = false;
      openOld();
    }
  }

  // ---- 🪙 THE FOUNTAIN COIN TOSS — an honest tiny sink, no payout ---------
  // ⚠️ NO action-bar button — the world grammar is TAP THE THING (beach
  // stalls, rides): tap the fountain to toss, walking over first if far
  const TOSS_AT = { x: FOUNTAIN[0], y: FOUNTAIN[1] + 10 };
  let tossTracked = false, tossBusy = false;
  let wishIdx = Math.floor(Math.random() * WISHES.length);
  function tapFountain(wx, wy) {
    if (Math.hypot(wx - TOSS_AT.x, wy - TOSS_AT.y) > 80) return false;
    if (Math.hypot(pos.x - TOSS_AT.x, pos.y - TOSS_AT.y) < 120) { doToss(); return true; }
    pendingToss = true;
    tgt.x = TOSS_AT.x;
    tgt.y = TOSS_AT.y + 92;
    return true;
  }
  function tossTick() {
    if (pendingToss && Math.hypot(pos.x - TOSS_AT.x, pos.y - TOSS_AT.y) < 120) {
      pendingToss = false;
      doToss();
    }
  }
  function doToss() {
    if (tossBusy) return;
    if (coinBal() < 1) { toast('no coins — the rave floor drops them'); return; }
    passStat('coins_spent', 1);
    refreshHud();
    if (!tossTracked) { tossTracked = true; track('park_toss'); }
    tossBusy = true;
    const c = document.createElement('div');
    c.className = 'pk-coinfly';
    c.innerHTML = '<img src="/assets/banana-stand/coin.png" width="16" height="16" alt="" />';
    c.style.left = pct(pos.x, W);
    c.style.top = pct(pos.y - 34, H);
    world.appendChild(c);
    const bx = FOUNTAIN[0] + (Math.random() * 36 - 18), by = FOUNTAIN[1] - 32;
    requestAnimationFrame(() => { c.style.left = pct(bx, W); c.style.top = pct(by, H); });
    setTimeout(() => {          // the timer takes its own element with it
      c.remove();
      float(bx, by, '✦');
      toast('🪙 ' + WISHES[wishIdx++ % WISHES.length], 3400);
      tossBusy = false;
    }, 720);
  }

  // ---- 🪙 THE COIN WINDOW — the world clock, staged diegetically ----------
  // Same clock, odds and `bc-win` claim key as the club floor / old stand /
  // bay (world.js — no double-dipping). Only the STAGING is the park's own:
  // the coin washes up on the FOUNTAIN'S RIM with a splash — a tossed wish
  // come back. Park sick (phases 0-1) = the fountain is dry: no splash, the
  // coin just glints in the dry bowl. Still walk-over to claim.
  const coinWinEl = document.createElement('div');
  coinWinEl.className = 'pk-coin';
  coinWinEl.style.display = 'none';
  world.appendChild(coinWinEl);
  let coinLive = null, coinShownWin = -1;
  let coinWinClaimed = -1;
  try { coinWinClaimed = parseInt(localStorage.getItem('bc-win') || '-1', 10); } catch (e) {}
  function rimSpotFor(w2) {   // a spot on the basin's front rim, per window
    return {
      x: FOUNTAIN[0] - 52 + seedRand(0x51ab + w2 * 2) * 104,
      y: FOUNTAIN[1] + 24 + seedRand(0x51ab + w2 * 2 + 1) * 12,
    };
  }
  function coinSplash(x, y) {
    if (phase < 2) return;   // dry bowl — nothing to splash with
    const s = document.createElement('div');
    s.className = 'pk-splash';
    s.innerHTML = '<i></i><i></i><i></i>';
    s.style.left = pct(x, W);
    s.style.top = pct(y, H);
    depth(s, y + 1);
    world.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
  function coinWinTick() {
    const t = Date.now() / 1000;
    const cPh = (((t - COIN_OFFSET) % COIN_PERIOD) + COIN_PERIOD) % COIN_PERIOD;
    const cWin = Math.floor((t - COIN_OFFSET) / COIN_PERIOD);
    if (cPh < COIN_WAIT && coinWinClaimed !== cWin) {
      const cs = rimSpotFor(cWin);
      coinWinEl.className = 'pk-coin pk-coin--' + coinAmountFor(cWin);
      coinWinEl.style.display = '';
      coinWinEl.style.left = pct(cs.x, W);
      coinWinEl.style.top = pct(cs.y, H);
      depth(coinWinEl, cs.y);
      coinLive = { x: cs.x, y: cs.y, win: cWin };
      if (coinShownWin !== cWin) {   // fresh window → the wash-up moment
        coinShownWin = cWin;
        coinSplash(cs.x, cs.y);
        float(cs.x, cs.y - 14, '✦');
      }
    } else {
      // unclaimed windows leave in the smoke; claimed ones already vanished
      if (coinLive && coinWinClaimed !== coinLive.win && coinWinEl.style.display !== 'none') {
        poofInto(world, 'pk-poof', coinLive.x / W * 100, coinLive.y / H * 100);
      }
      coinWinEl.style.display = 'none';
      coinLive = null;
    }
    // the catch: walk into it — same monotonic wallet as everywhere
    if (coinLive && Math.hypot(pos.x - coinLive.x, pos.y - coinLive.y) < 44) {
      const n = coinAmountFor(coinLive.win);
      coinWinClaimed = coinLive.win;
      try { localStorage.setItem('bc-win', String(coinWinClaimed)); } catch (e) {}
      passStat('coins_earned', n);
      refreshHud();
      float(coinLive.x, coinLive.y - 16, '+' + n);
      toast(phase >= 2 ? '🪙 someone’s wish washed up — yours now'
        : '🪙 an old wish in the dry bowl — yours now', 3000);
      track('rave_coin', { n, at: 'park' });
      coinWinEl.style.display = 'none';
      coinLive = null;
    }
  }

  // ---- 🧃 THE MERCH CART — the one real thing in the park -----------------
  // The builder→merch bridge is dead; the cart IS merch's home now. Cards
  // show YOUR banana; a tap lands on the real PDP with the exact outfit
  // pre-built via the builder's own interchange params (h/g/ex/e — the same
  // string the gallery's merch CTAs ride).
  const CART_AT = { x: MARKET.cart[0], y: MARKET.cart[1] };
  const shopEl = document.getElementById('pkShop');
  const goodsEl = document.getElementById('pkGoods');
  const keeperCtx = document.getElementById('pkKeeperCv').getContext('2d');
  const keeperBubble = document.getElementById('pkKeeperBubble');
  const KEEPER_DRAW = {
    hat: 'none', glasses: 'monocle', extras: {},
    top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
  };
  let cartViewTracked = false, sparkleAt = 0;
  let keeperTimer = null, keeperIdx = 0;
  function merchParams() {
    let o = {};
    try { o = JSON.parse(localStorage.getItem('bb-last') || '{}') || {}; } catch (e) {}
    const p = new URLSearchParams();
    if (o.hat && o.hat !== 'none') p.set('h', o.hat);
    if (o.glasses && o.glasses !== 'none') p.set('g', o.glasses);
    const ex = Object.keys(o.extras || {}).filter((k) => o.extras[k]);
    if (ex.length) p.set('ex', ex.join('.'));
    if (o.effect && o.effect !== 'none') p.set('e', o.effect);
    return p.toString();
  }
  function keeperSay(text, ms) {
    keeperBubble.textContent = text;
    keeperBubble.classList.add('is-on');
    clearTimeout(keeperTimer);
    keeperTimer = setTimeout(() => keeperBubble.classList.remove('is-on'), ms || 5200);
  }
  function drawKeeper() {
    drawComposite(keeperCtx, 360, 2, KEEPER_DRAW);
    drawApron(keeperCtx, 360);
  }
  // the cartridge CUT into the interior — the stand's own scene change
  function blink(mid) {
    if (REDUCED) { mid(); return; }
    cutEl.classList.add('is-on');
    setTimeout(mid, 130);
    setTimeout(() => cutEl.classList.remove('is-on'), 280);
  }
  function openShop() {
    if (!shopEl.hidden) return;
    const q = merchParams();
    goodsEl.innerHTML = MERCH_PRODUCTS.map((pr) =>
      '<a class="pk-hang pk-hang--' + pr.key + '" href="/make-a-banana/' + pr.key + '/'
      + (q ? '?' + q : '') + '" data-product="' + pr.key + '">'
      + '<span class="pk-hang__mock"><canvas width="150" height="150" aria-hidden="true"></canvas></span>'
      + '<i class="pk-hang__tag">' + pr.price + '</i>'
      + '<b>' + pr.name + '</b>'
      + '</a>').join('');
    goodsEl.querySelectorAll('.pk-hang').forEach((a) => {
      a.addEventListener('click', () => { track('stand_cart_click', { product: a.dataset.product }); });
    });
    // your banana on every wall good; the keeper behind the counter — with the
    // redraw belt, accessories decode async
    assetsReady().then(() => {
      const draw = () => {
        goodsEl.querySelectorAll('canvas').forEach((cv) => {
          drawComposite(cv.getContext('2d'), 150, 2,
            { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
        });
        drawKeeper();
      };
      draw();
      setTimeout(draw, 700);
    });
    blink(() => { shopEl.hidden = false; document.body.classList.add('pk-inside'); });
    keeperSay(KEEPER_GREET, 6000);
    if (!cartViewTracked) { cartViewTracked = true; track('stand_cart_view'); }
  }
  function closeShop() {
    if (shopEl.hidden) return;
    clearTimeout(keeperTimer);
    keeperBubble.classList.remove('is-on');
    blink(() => { shopEl.hidden = true; document.body.classList.remove('pk-inside'); });
  }
  // tap the HUT itself to enter (walk-then-open — the beach stall grammar)
  function tapShop(wx, wy) {
    if (!(Math.abs(wx - CART_AT.x) < 105 && CART_AT.y - 250 < wy && wy < CART_AT.y + 14)) return false;
    if (Math.hypot(pos.x - CART_AT.x, pos.y - CART_AT.y) < 110) { openShop(); return true; }
    pendingShop = true;
    tgt.x = CART_AT.x;
    tgt.y = CART_AT.y + 46;
    return true;
  }
  document.getElementById('pkKeeper').addEventListener('click', () => {
    keeperSay(KEEPER_LINES[keeperIdx++ % KEEPER_LINES.length]);
  });
  document.getElementById('pkShopClose').addEventListener('click', closeShop);
  document.getElementById('pkShopBack').addEventListener('click', closeShop);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !shopEl.hidden) closeShop(); });
  // proximity + the idle ✦ over the shop roof (rides the rAF step, so a
  // hidden tab sparkles nothing)
  function cartTick(now) {
    if (pendingShop && Math.hypot(pos.x - CART_AT.x, pos.y - CART_AT.y) < 110) {
      pendingShop = false;
      openShop();
    }
    if (now > sparkleAt) {
      sparkleAt = now + 6500 + Math.random() * 3000;
      const s = document.createElement('div');
      s.className = 'pk-sparkle';
      s.textContent = '✦';
      s.style.left = pct(CART_AT.x - 70 + Math.random() * 140, W);
      s.style.top = pct(CART_AT.y - 120 - Math.random() * 130, H);
      world.appendChild(s);
      setTimeout(() => s.remove(), 1500);
    }
  }

  // ---- 🍌🏪 THE BANANA STAND — the coin shop, walk-in edition -------------
  // Ported from banana-stand.js: the same manifest STOCK, lock/YOURS states,
  // back-catalog (curated drops + community items) and the buy flow writing
  // own_<id> pass stats + instant equip. LIVE COMMERCE — behavior identical
  // to the old /park/ page by construction (only the chrome moved).
  const STAND_AT = { x: MARKET.stand[0], y: MARKET.stand[1] };
  const standEl = document.getElementById('pkStand');
  const standBubble = document.getElementById('pkStandBubble');
  const standKeeperCtx = document.getElementById('pkStandKeeperCv').getContext('2d');
  const standWalletEl = document.getElementById('pkStandWallet');
  const ST_KEEPER_DRAW = {
    hat: 'none', glasses: 'none', extras: {},
    top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
  };
  const ST_KEEPER_FRAME = 3;   // he stands still — done dancing (Trym's call)
  // 🍌 the keeper IN THE WINDOW, outdoors — the old page's scene-1 look
  // (the same static frame-3 banana, chest-up behind the counter). Set
  // dressing only: pointer-events none, the whole hut stays the tap target.
  // The wrapper IS the window cutout (the generator's 22%/35%→78%/66%
  // backing rect on the ×2 hut box) and clips him; z = one above the hut.
  (() => {
    const HW = 176, HH = 172;                      // the placed hut, ×2
    const hutL = STAND_AT.x - HW / 2, hutT = STAND_AT.y - HH;
    const w = document.createElement('div');
    w.className = 'pk-standnpc';
    w.style.left = pct(hutL + HW * 0.22, W);
    w.style.top = pct(hutT + HH * 0.35, H);
    w.style.width = pct(HW * 0.56, W);
    w.style.height = pct(HH * 0.31, H);
    w.style.zIndex = String(100 + Math.round(STAND_AT.y) + 1);
    const cv = document.createElement('canvas');
    cv.width = 150; cv.height = 150;
    cv.setAttribute('aria-hidden', 'true');
    w.appendChild(cv);
    world.appendChild(w);
    assetsReady().then(() => {
      const draw = () => drawComposite(cv.getContext('2d'), 150, ST_KEEPER_FRAME, ST_KEEPER_DRAW);
      draw();
      setTimeout(draw, 700);
    });
  })();
  let pendingStand = false, standSparkleAt = 0, standCounterTracked = false;
  let standBuilt = false, standBubbleTimer = null, soldIdx = 0;
  const stStats = () => passGet().stats || {};
  const stOwned = (id) => (stStats()['own_' + id] || 0) > 0;
  function standSay(text) {
    standBubble.textContent = text;
    standBubble.classList.add('is-on');
    clearTimeout(standBubbleTimer);
    standBubbleTimer = setTimeout(() => standBubble.classList.remove('is-on'), 3200);
  }
  function refreshStandWallet() { standWalletEl.textContent = coinBal(); }

  // THE STOCK: every `preview: 'stand'` item, straight from the manifest
  const ST_STOCK = [];
  const stExtraSlot = (d) => (d.anchor === 'feet' ? 'shoes' : d.anchor === 'hand' ? 'hands' : 'body');
  Object.values(WEARABLE_PACKS).forEach((p) => {
    (p.hats || []).forEach((d) => { if (d.preview === 'stand') ST_STOCK.push({ ...d, artKey: d.art, slot: 'hat' }); });
    (p.shades || []).forEach((d) => { if (d.preview === 'stand') ST_STOCK.push({ ...d, artKey: d.front, slot: 'face' }); });
    (p.extras || []).forEach((d) => { if (d.preview === 'stand') ST_STOCK.push({ ...d, artKey: d.art, slot: stExtraSlot(d) }); });
  });
  ST_STOCK.sort((a, b) => (a.price || 0) - (b.price || 0));   // browse cheap → grail

  const standShelf = document.getElementById('pkStandShelf');
  const standSpot = document.getElementById('pkStandSpot');
  const standBuyBtn = document.getElementById('pkStandBuy');
  const stTileById = new Map();
  const ST_ALL = [];   // stand stock + back-catalog entries (added async)
  let stPicked = null;
  function stItemArt(item) { return item.artHtml || ART[item.artKey] || ''; }
  function stUpdateTiles() {
    const bal = coinBal();
    ST_ALL.forEach((item) => {
      const tile = stTileById.get(item.id);
      if (!tile) return;
      const owned = stOwned(item.id);
      tile.classList.toggle('is-owned', owned);
      tile.classList.toggle('is-locked', !owned && bal < item.price);
      tile.setAttribute('aria-label', owned
        ? item.label + ' — yours'
        : item.label + ' — ' + item.price + ' bananacoins' + (bal < item.price ? ' (not enough coins yet)' : ''));
    });
  }
  function stUpdateSpot(item) {
    if (!item) return;
    if (stOwned(item.id)) {
      standBuyBtn.textContent = '✓ yours';
      standBuyBtn.classList.add('is-owned');
      standBuyBtn.classList.remove('is-poor');
    } else {
      standBuyBtn.textContent = 'get it';
      standBuyBtn.classList.toggle('is-poor', coinBal() < item.price);
      standBuyBtn.classList.remove('is-owned');
    }
  }
  function stPick(item, tile) {
    standEl.querySelectorAll('.pk-tile').forEach((t) => t.classList.remove('is-picked'));
    tile.classList.add('is-picked');
    stPicked = item;
    track('stand_item_view', { item: item.id });
    document.getElementById('pkStandSpotArt').innerHTML = stItemArt(item);
    document.getElementById('pkStandSpotName').textContent = item.label;
    document.getElementById('pkStandSpotDesc').textContent = item.back ? item.desc : (ST_DESC[item.id] || item.phrase);
    document.getElementById('pkStandSpotPrice').textContent = item.price;
    stUpdateSpot(item);
    standSpot.hidden = false;
  }
  function stAddTile(item, container) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'pk-tile';
    tile.innerHTML =
      '<span class="pk-tile__art">' + stItemArt(item) + '</span>'
      + '<b>' + item.label + '</b>'
      + '<span class="pk-tile__slot">' + (item.back ? 'drop' : item.slot) + '</span>'
      + '<span class="pk-price"><img src="/assets/banana-stand/coin.png" width="14" alt=""> ' + item.price + '</span>'
      + '<span class="pk-tile__lock" aria-hidden="true">' + ST_LOCK_SVG + '</span>'
      + '<span class="pk-tile__own" aria-hidden="true">YOURS</span>';
    tile.addEventListener('click', () => stPick(item, tile));
    stTileById.set(item.id, tile);
    ST_ALL.push(item);
    container.appendChild(tile);
  }
  // 🕰 THE BACK-CATALOG — drop nights you missed, flat-priced above floor gear
  const stCatOwned = () => { try { return JSON.parse(localStorage.getItem('cat-own-v1') || '{}') || {}; } catch (e) { return {}; } };
  function stAddBackItems(items) {
    if (!items.length) return;
    document.getElementById('pkStandBackHead').hidden = false;
    const backShelf = document.getElementById('pkStandBackShelf');
    backShelf.hidden = false;
    items.forEach((it) => stAddTile(it, backShelf));
    stUpdateTiles();
  }
  function buildStand() {   // lazy — the shelf exists once the door first opens
    if (standBuilt) return;
    standBuilt = true;
    ST_STOCK.forEach((item) => stAddTile(item, standShelf));
    stUpdateTiles();
    // wall dressing — the old page's four hung items, verbatim (Trym: bigger
    // beats many tiny ones); % widths so they scale with the window
    const ST_DECOR = [
      { id: 'buckethat', left: '2%', top: '8%', w: '21%', rot: -4 },
      { id: 'snorkelmask', left: '1%', top: '52%', w: '25%', rot: 3 },
      { id: 'duckhat', left: '76%', top: '6%', w: '23%', rot: 4 },
      { id: 'balloondog', left: '75%', top: '48%', w: '24%', rot: -3 },
    ];
    const stWin = standEl.querySelector('.pk-stand__window');
    if (stWin) ST_DECOR.forEach((d) => {
      const def = ST_STOCK.find((s) => s.id === d.id);
      if (!def) return;
      const el = document.createElement('span');
      el.className = 'pk-stand__decor';
      el.style.cssText = 'left:' + d.left + ';top:' + d.top + ';width:' + d.w + ';transform:rotate(' + d.rot + 'deg);';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = ART[def.artKey] || '';
      stWin.appendChild(el);
    });
    stAddBackItems(DROPS
      .filter((d) => !((d.flag && localStorage.getItem(d.flag) === '1') || stOwned(d.id)))
      .map((d) => ({
        id: d.id, label: d.label, slot: d.slot === 'glasses' ? 'face' : d.slot,
        price: ST_BACKCAT_PRICE, back: true, flag: d.flag,
        artHtml: ART[d.art] || '',
        desc: (d.by ? 'from ' + d.by + '’s booth. ' : '') + 'you missed the drop night. money fixes that.',
      })));
    fetch('https://banana-share.trymstene.workers.dev/catalog/items.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        if (!Array.isArray(items)) return;
        const own = stCatOwned();
        stAddBackItems(items
          .filter((it) => !own[it.id] && !stOwned(it.id))
          .map((it) => ({
            id: it.id, label: it.title || 'community item', slot: 'c',
            price: ST_BACKCAT_PRICE, back: true,
            artHtml: (wearToCustom(it.wear) || {}).art || '',
            desc: (it.by ? 'made by ' + it.by + '. ' : '') + 'you missed the drop night. money fixes that.',
          })));
      })
      .catch(() => { /* offline: the curated back-catalog stands */ });
  }
  // the purchase: spend coins, record the deed, wear it out the door.
  // Exclusivity mirrors the builder: one pair of shoes, one body garment.
  const ST_FEET_IDS = [], ST_BODY_IDS = [];
  Object.values(WEARABLE_PACKS).forEach((p) => (p.extras || []).forEach((d) => {
    if (d.anchor === 'feet') ST_FEET_IDS.push(d.id);
    if (d.zone === 'body') ST_BODY_IDS.push(d.id);
  }));
  function stEquip(item) {
    const wear = (o) => {
      if (item.slot === 'c') { o.c = item.id; return o; }   // community: the one custom slot
      if (item.slot === 'hat') { o.hat = item.id; return o; }
      if (item.slot === 'face') { o.glasses = item.id; return o; }
      const ex = { ...(o.extras || {}) };
      if (item.anchor === 'feet') ST_FEET_IDS.forEach((id) => delete ex[id]);
      if (item.zone === 'body') ST_BODY_IDS.forEach((id) => delete ex[id]);
      ex[item.id] = true;
      o.extras = ex;
      return o;
    };
    try {
      const saved = wear(JSON.parse(localStorage.getItem('bb-last') || '{}'));
      localStorage.setItem('bb-last', JSON.stringify(saved));
      passPush();   // bb-last rides the sync blob — nudge a push
    } catch (e) {}
    wear(ME_DRAW);   // the park banana wears it on the very next frame
    lastF = -1;
    parkRoom.send({ t: 'outfit', outfit: myParkOutfit() });   // everyone else's view too
  }
  standBuyBtn.addEventListener('click', () => {
    const item = stPicked;
    if (!item) return;
    if (stOwned(item.id)) { standSay('you already own that one.'); return; }
    const bal = coinBal();
    if (bal < item.price) {
      // still the demand list — "wanted it, couldn't afford it"
      track('stand_buy_try', { item: item.id });
      standSay('that’s ' + item.price + '. you’ve got ' + bal + '. the floor pays in coins.');
      return;
    }
    passStat('coins_spent', item.price);
    passStat('own_' + item.id, 1);
    if (item.back) {
      // back-catalog buys also write the LEGACY stores so every flag/cat-own
      // reader (rave gift gate, builder chips) unlocks at once
      if (item.flag) { try { localStorage.setItem(item.flag, '1'); } catch (e) {} }
      if (item.slot === 'c') {
        try {
          const ownM = stCatOwned();
          ownM[item.id] = Date.now();
          localStorage.setItem('cat-own-v1', JSON.stringify(ownM));
        } catch (e) {}
      }
    }
    stEquip(item);
    refreshHud();
    refreshStandWallet();
    stUpdateTiles();
    stUpdateSpot(item);
    standSay(ST_SOLD[soldIdx++ % ST_SOLD.length](item.label.toLowerCase()));
    track('stand_buy', { item: item.id, price: item.price, kind: item.back ? 'drop' : 'stand' });
  });
  document.getElementById('pkStandKeeper').addEventListener('click', () => standSay('*polishes the counter*'));
  function openStand() {
    buildStand();
    refreshStandWallet();
    stUpdateTiles();
    if (stPicked) stUpdateSpot(stPicked);
    assetsReady().then(() => {
      const draw = () => drawComposite(standKeeperCtx, 360, ST_KEEPER_FRAME, ST_KEEPER_DRAW);
      draw();
      setTimeout(draw, 700);
    });
    // one place, one title: the stand's neon sign replaces the park heading
    blink(() => { standEl.hidden = false; standEl.scrollTop = 0; document.body.classList.add('pk-inside'); });
    standSay(ST_HELLO);
    if (!standCounterTracked) { standCounterTracked = true; track('stand_counter'); }
  }
  function closeStand() {
    if (standEl.hidden) return;
    clearTimeout(standBubbleTimer);
    standBubble.classList.remove('is-on');
    blink(() => { standEl.hidden = true; document.body.classList.remove('pk-inside'); });
  }
  document.getElementById('pkStandBack').addEventListener('click', closeStand);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !standEl.hidden) closeStand(); });
  // tap the STAND BUILDING (tap-the-thing) → walk up → the counter cuts in
  function tapStand(wx, wy) {
    if (!(Math.abs(wx - STAND_AT.x) < 80 && STAND_AT.y - 130 < wy && wy < STAND_AT.y + 16)) return false;
    if (Math.hypot(pos.x - STAND_AT.x, pos.y - STAND_AT.y) < 115) { openStand(); return true; }
    pendingStand = true;
    tgt.x = STAND_AT.x;
    tgt.y = STAND_AT.y + 48;
    return true;
  }
  function standTick(now) {
    if (pendingStand && Math.hypot(pos.x - STAND_AT.x, pos.y - STAND_AT.y) < 115) {
      pendingStand = false;
      openStand();
    }
    if (now > standSparkleAt) {   // the kiosk's ✦ treatment, stand edition
      standSparkleAt = now + 7000 + Math.random() * 3200;
      const s = document.createElement('div');
      s.className = 'pk-sparkle';
      s.textContent = '✦';
      s.style.left = pct(STAND_AT.x - 60 + Math.random() * 120, W);
      s.style.top = pct(STAND_AT.y - 60 - Math.random() * 60, H);
      world.appendChild(s);
      setTimeout(() => s.remove(), 1500);
    }
  }

  // ---- 🌱 THE GARDEN — plant · water · harvest ----------------------------
  // Server truth lives on the ParkRoom DO (/park-garden); the client renders
  // the 8 PLOTS from polled state, acts optimistically, and reconciles on the
  // reply. ?parktest swaps the fetch for a local shim so the whole flow runs
  // before the worker deploy (+ __park.ff() fast-forwards growth locally).
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const myShort = worldSid().slice(0, 8);
  const gardenPanel = document.getElementById('pkGarden');
  const gardenBody = document.getElementById('pkGardenBody');
  // 16 slots since W3 — 0-7 site A (meadow), 8-15 site B (playground)
  let gSlots = Array(16).fill(null);
  const gEls = PLOTS.map(() => ({ plant: null, stage: '', soil: null, soilKey: '', stake: null }));
  let pendingGarden = null, pendingWater = null, gardenOpenSlot = -1;
  let plantTracked = false, waterTracked = false, harvestTracked = false;
  const gShim = {   // the ?parktest stand-in server (pre-lays a plain + golden egg)
    slots: Array(16).fill(null), weeds: [], trash: [], bloom: 70,
    eggs: [{ id: 'qa1', x: 1330, y: 876 }, { id: 'qa2', x: 1432, y: 866, g: 1 }],
  };
  function shimGarden(path, body) {
    const now = Date.now();
    const strip = () => ({
      ok: 1,
      slots: gShim.slots.map((s) => (s ? { ...s, waterers: (s.waterers || []).length } : null)),
      bloom: Math.round(gShim.bloom),
      weeds: gShim.weeds.map((w2) => ({ ...w2 })),
      trash: gShim.trash.map((t) => ({ ...t })),
      eggs: gShim.eggs.map((e) => ({ ...e })),
    });
    if (!body) return Promise.resolve(strip());
    if (path === '/egg') {
      const ei = gShim.eggs.findIndex((e) => e.id === body.id);
      if (ei < 0) return Promise.resolve({ err: 'gone', ...strip() });
      const [e] = gShim.eggs.splice(ei, 1);
      const reward = e.g ? { coins: 25, tickets: 5, golden: 1 }
        : Math.random() < 0.25 ? { tickets: 3 } : { coins: 3 + Math.floor(Math.random() * 6) };
      return Promise.resolve({ reward, ...strip() });
    }
    if (path === '/trash') {
      const ti = gShim.trash.findIndex((t) => t.id === body.id);
      if (ti < 0) return Promise.resolve({ err: 'gone', ...strip() });
      gShim.trash.splice(ti, 1);
      gShim.bloom = Math.min(100, gShim.bloom + 1);
      return Promise.resolve(strip());
    }
    if (path === '/weed') {
      const wi = gShim.weeds.findIndex((w2) => w2.id === body.id);
      if (wi < 0) return Promise.resolve({ err: 'gone', ...strip() });
      gShim.weeds.splice(wi, 1);
      gShim.bloom = Math.min(100, gShim.bloom + 3);
      return Promise.resolve(strip());
    }
    const i = body.slot, s = gShim.slots[i];
    if (path === '/plant') {
      if (s) return Promise.resolve({ err: 'taken', ...strip() });
      gShim.slots[i] = { passShort: myShort, name: body.name || '', seed: body.seed, plantedAt: now, lastWater: now, waterers: [] };
      gShim.bloom = Math.min(100, gShim.bloom + 6);
    } else if (path === '/water') {
      if (!s) return Promise.resolve({ err: 'empty' });
      s.lastWater = now;
      if (!s.waterers.includes(body.pass.slice(0, 8))) s.waterers.push(body.pass.slice(0, 8));
      gShim.bloom = Math.min(100, gShim.bloom + 2);
    } else if (path === '/harvest') {
      if (!s) return Promise.resolve({ err: 'empty' });
      if (Math.floor((now - s.plantedAt) / 86400000) < SEED_BY[s.seed].days) return Promise.resolve({ err: 'still growing' });
      gShim.slots[i] = null;
    }
    return Promise.resolve(strip());
  }
  async function gFetch(path, body) {
    if (PARK_TEST) return shimGarden(path, body);
    try {
      const r = await fetch(GARDEN_API + path, body
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
        : undefined);
      return await r.json();
    } catch (e) { return null; }   // no server, no garden — the park still works
  }
  const gDays = (s) => Math.floor((Date.now() - s.plantedAt) / 86400000);
  const gReady = (s) => s && gDays(s) >= (SEED_BY[s.seed] || { days: 99 }).days;
  const gMine = (s) => s && s.passShort === myShort;
  // watered today? (UTC day, matching the server's wday math)
  const gWet = (s) => s && Math.floor((s.lastWater || 0) / 86400000) === Math.floor(Date.now() / 86400000);
  function gStageArt(s) {
    const sd = SEED_BY[s.seed] || SEEDS[0];
    const t = gDays(s) / sd.days;
    if (sd.crop) {   // crops grow through their own four baked stages
      return STAGE_ART[s.seed + (t >= 1 ? 4 : t >= 0.66 ? 3 : t >= 0.33 ? 2 : 1)];
    }
    return t >= 1 ? STAGE_ART[s.seed] : t >= 0.4 ? STAGE_ART.sprout2 : STAGE_ART.sprout1;
  }
  // 🧑‍🌾 gardener level from harvests: [lvl 1..GLVL_AT.length, harvests, max ⭐]
  function gardenerLvl() {
    const n = (passGet().stats || {}).garden_harvests || 0;
    let l = 1;
    while (l < GLVL_AT.length && n >= GLVL_AT[l]) l++;
    return { lvl: l, n, stars: GLVL_STARS[l - 1] };
  }
  // zero floating UI over the beds (Trym — signs cramped, then the emoji
  // chips "took up the visuals" too): the sprite says species, the soil says
  // thirst, the glint says ready, the stake says yours. Words = the tap card.
  function renderGarden() {
    PLOTS.forEach(([sx, sy], i) => {
      const s = gSlots[i], el = gEls[i];
      if (!s) {
        if (el.plant) { el.plant.remove(); el.plant = null; el.stage = ''; }
        if (el.stake) { el.stake.remove(); el.stake = null; }
        if (el.soil) { el.soil.remove(); el.soil = null; el.soilKey = ''; }
        return;
      }
      // 💧 the soil tells the state: dark wet = watered today, light dry = not
      const wet = gWet(s) ? 'wet' : 'dry';
      if (el.soilKey !== wet) {
        el.soilKey = wet;
        if (!el.soil) {
          el.soil = document.createElement('div');
          el.soil.className = 'pk-soil';
          el.soil.style.left = pct(sx, W);
          el.soil.style.top = pct(sy + 12, H);
          el.soil.style.width = pct(39, W);
          el.soil.style.height = pct(25, H);
          el.soil.style.zIndex = String(100 + Math.round(sy));   // under the plant
          world.appendChild(el.soil);
        }
        el.soil.classList.toggle('pk-soil--wet', wet === 'wet');
        el.soil.classList.toggle('pk-soil--dry', wet === 'dry');
      }
      const [img, w2, h2] = gStageArt(s);
      const key = img + (gReady(s) ? '!' : '');
      if (el.stage !== key) {
        el.stage = key;
        if (!el.plant) {
          el.plant = document.createElement('div');
          el.plant.className = 'pk-plant';
          world.appendChild(el.plant);
        }
        el.plant.style.backgroundImage = "url('/assets/park/" + img + "')";
        el.plant.style.width = pct(w2, W);
        el.plant.style.height = pct(h2, H);
        el.plant.style.left = pct(sx, W);
        el.plant.style.top = pct(sy + 10, H);
        el.plant.classList.toggle('is-ready', gReady(s));
        depth(el.plant, sy + 10);
      }
      // 🪧 ownership: the tiny stake at the soil's front edge, YOURS only
      // (no floating UI over the beds — Trym; taps read the slot, not this)
      if (gMine(s) && !el.stake) {
        el.stake = document.createElement('div');
        el.stake.className = 'pk-gstake';
        el.stake.innerHTML = STAKE_SVG;
        el.stake.style.left = pct(sx - 13, W);
        el.stake.style.top = pct(sy + 21, H);
        el.stake.style.width = pct(7, W);
        el.stake.style.height = pct(12, H);
        el.stake.style.zIndex = String(100 + Math.round(sy) + 12);
        world.appendChild(el.stake);
      } else if (!gMine(s) && el.stake) {
        el.stake.remove();
        el.stake = null;
      }
    });
  }
  // ---- 🌿 WEEDS + 🌸 THE BLOOM — the shared entropy loop ------------------
  const weeds = new Map();                      // id → { el, x, y }
  let bloomV = -1, pendingWeed = null, weedTracked = false;
  // 🌸 THE HEALTH BAR — bottom-docked (the jellymeter's spot in the rave):
  // fill + % ride the live value, the face + whole palette ride the phase
  const bloomBtn = document.getElementById('pkHBar');
  const hFaceEl = document.getElementById('pkHFace');
  const hFillEl = document.getElementById('pkHFill');
  const hPctEl = document.getElementById('pkHPct');
  let hbarPhase = -1;
  function renderHBar(v, p) {
    hFillEl.style.width = v + '%';
    hPctEl.textContent = v + '%';
    hPctEl.style.left = v + '%';
    hPctEl.classList.toggle('is-out', v < 20);   // slim fill: % steps outside
    if (hbarPhase !== p) {
      hbarPhase = p;
      bloomBtn.className = 'pk-hbar pk-hbar--p' + p;
      hFaceEl.innerHTML = iconSvg(PHASE_FACES[p], { size: 20 });
    }
  }
  function refreshBloom(v) {
    if (PHASE_FORCE >= 0) v = PHASE_MID[PHASE_FORCE];   // pinned — polls no-op
    if (v === bloomV || typeof v !== 'number') return;
    bloomV = v;
    const p = phaseFor(v);                 // ±3 hysteresis lives in phaseFor
    renderHBar(Math.max(0, v), p);
    setPhase(p);
    const f = document.getElementById('pkBfill');
    if (f) {                               // the card is open — nudge it live
      f.style.clipPath = 'inset(0 ' + (100 - Math.max(0, v)) + '% 0 0)';
      gardenBody.querySelectorAll('.pk-bglyph').forEach((g, i) => g.classList.toggle('is-now', i === p));
      const num = document.getElementById('pkBnum');
      if (num) num.textContent = bloomStatus();
    }
  }
  // ---- 🗑 GARBAGE — litter on the lawn, walked over like acorns -----------
  // Server truth on the garden read (cap inverted by bloom: a hurting park
  // is littered). No tap, no tool: walking over it IS the pickup — poof,
  // +2 rep, and the server says thanks with +1 health (first touch wins).
  const trash = new Map();                      // id → { el, x, y }
  let trashTracked = false;
  function renderTrash(list) {
    const seen = new Set();
    (list || []).forEach((t) => {
      seen.add(t.id);
      if (trash.has(t.id)) return;
      const el = document.createElement('div');
      el.className = 'pk-trash pk-trash--' + (t.v === 2 ? 2 : t.v === 3 ? 3 : 1);
      el.style.left = pct(t.x, W);
      el.style.top = pct(t.y, H);
      depth(el, t.y);
      world.appendChild(el);
      trash.set(t.id, { el, x: t.x, y: t.y });
    });
    trash.forEach((t, id) => {
      if (!seen.has(id)) { t.el.remove(); trash.delete(id); }   // picked elsewhere
    });
  }
  function trashTick() {
    trash.forEach((t, id) => {
      if (Math.hypot(pos.x - t.x, (pos.y - 6) - t.y) > 32) return;
      trash.delete(id);                    // optimistic — the reply reconciles
      poofInto(world, 'pk-poof', t.x / W * 100, (t.y - 10) / H * 100);
      t.el.remove();
      passStat('rep', 2);
      refreshHud();
      float(t.x, t.y - 14, '+2');
      if (!trashTracked) { trashTracked = true; track('park_trash'); }
      gFetch('/trash', { id, pass: worldSid() }).then(applyGarden);
    });
  }
  function renderWeeds(list) {
    const seen = new Set();
    (list || []).forEach((w2) => {
      seen.add(w2.id);
      if (weeds.has(w2.id)) return;
      const el = document.createElement('div');
      el.className = 'pk-weed pk-weed--' + (1 + (parseInt(w2.id, 36) || 0) % 2);
      el.style.left = pct(w2.x, W);
      el.style.top = pct(w2.y, H);
      depth(el, w2.y);
      world.appendChild(el);
      weeds.set(w2.id, { el, x: w2.x, y: w2.y });
    });
    weeds.forEach((w2, id) => {
      if (!seen.has(id)) { w2.el.remove(); weeds.delete(id); }   // pulled elsewhere
    });
  }
  async function pullWeed(id) {
    const w2 = weeds.get(id);
    if (!w2) return;
    weeds.delete(id);                       // optimistic — the poll reconciles
    w2.el.classList.add('is-pulled');
    setTimeout(() => {
      poofInto(world, 'pk-poof', w2.x / W * 100, (w2.y - 14) / H * 100);
      w2.el.remove();
    }, 240);
    passStat('rep', 1);
    // 🪙 ~8%: something under the roots — the chore is a tiny lottery
    // (client-side roll, same as the world's other coin juice)
    if (Math.random() < 0.08) {
      const n = 1 + Math.floor(Math.random() * 3);
      passStat('coins_earned', n);
      float(w2.x + 18, w2.y - 34, '+' + n + ' 🪙');
      toast('🪙 something under the roots — +' + n, 2600);
    }
    refreshHud();
    float(w2.x, w2.y - 20, '+1');
    if (!weedTracked) { weedTracked = true; track('park_weed'); }
    applyGarden(await gFetch('/weed', { id, pass: worldSid() }));
  }
  function tapWeed(wx, wy) {
    let hit = null;
    weeds.forEach((w2, id) => {
      if (Math.hypot(wx - w2.x, wy - (w2.y - 10)) < 30) hit = { id, w2 };
    });
    if (!hit) return false;
    if (Math.hypot(pos.x - hit.w2.x, pos.y - hit.w2.y) < 90) { pullWeed(hit.id); return true; }
    pendingWeed = hit.id;                   // walk-then-pull
    tgt.x = hit.w2.x;
    tgt.y = hit.w2.y + 26;
    return true;
  }
  // ---- 🥚 EGGS — laid on the hens' lawn, FIRST TAP WINS -------------------
  // The rave-drop pattern: the server's removal is the verdict, so the egg
  // stays put until the reply lands — no optimistic grab on a shared prize.
  const eggs = new Map();                       // id → { el, x, y, g }
  let pendingEgg = null, eggBusy = false, eggTracked = false;
  function renderEggs(list) {
    const seen = new Set();
    (list || []).forEach((e) => {
      seen.add(e.id);
      if (eggs.has(e.id)) return;
      const el = document.createElement('div');
      el.className = 'pk-egg' + (e.g ? ' pk-egg--gold' : '');
      el.style.left = pct(e.x, W);
      el.style.top = pct(e.y, H);
      depth(el, e.y);
      world.appendChild(el);
      eggs.set(e.id, { el, x: e.x, y: e.y, g: e.g ? 1 : 0 });
    });
    eggs.forEach((e, id) => {
      if (!seen.has(id)) {
        e.el.remove();
        eggs.delete(id);
        if (pendingEgg === id) pendingEgg = null;   // snapped up mid-walk
      }
    });
  }
  async function claimEgg(id) {
    const e = eggs.get(id);
    if (!e || eggBusy) return;
    eggBusy = true;
    const res = await gFetch('/egg', { id, pass: worldSid() });
    eggBusy = false;
    if (!res) return;
    applyGarden(res);
    if (res.err) { toast('🥚 someone got it first'); return; }
    const r = res.reward || {};
    if (r.coins) passStat('coins_earned', r.coins);
    if (r.tickets) passStat('tickets', r.tickets);   // the bay's pier currency
    refreshHud();
    float(e.x, e.y - 14, r.golden ? '✨' : '+' + (r.coins || r.tickets));
    if (r.golden) {
      confettiAt(e.x, e.y);
      toast('🥚✨ THE GOLDEN EGG — +' + r.coins + ' coins, +' + r.tickets + ' beach tickets!', 4600);
    } else if (r.tickets) {
      toast('🥚 ' + r.tickets + ' beach tickets in an egg?! the pier takes those', 4200);
    } else {
      toast('🥚 +' + r.coins + ' coins — fresh from the hens');
    }
    if (!eggTracked) { eggTracked = true; track('park_egg', { golden: r.golden ? 1 : 0 }); }
  }
  function tapEgg(wx, wy) {
    let hit = null;
    eggs.forEach((e, id) => {
      if (Math.hypot(wx - e.x, wy - (e.y - 9)) < 26) hit = id;
    });
    if (hit == null) return false;
    const e = eggs.get(hit);
    if (Math.hypot(pos.x - e.x, pos.y - e.y) < 90) { claimEgg(hit); return true; }
    pendingEgg = hit;                     // walk-then-claim, like everything else
    tgt.x = e.x;
    tgt.y = e.y + 22;
    return true;
  }
  // the card is mostly BAR: five phase segments, each its own fill slice,
  // the live phase ringed; tapping a segment reveals that phase's lines
  function bloomStatus() {
    const n = weeds.size;
    const v = Math.max(0, bloomV);
    const stars = gSlots.reduce((t, s) => t + ((SEED_BY[s && s.seed] || {}).stars || 0), 0);
    return v + '%'
      + (n ? ' · ' + n + ' weed' + (n === 1 ? '' : 's') + ' out there' : '')
      + (stars ? ' · ' + starStr(Math.min(stars, 5)) + (stars > 5 ? '×' + stars : '') + ' feeding it' : '');
  }
  // ONE continuous bar (Trym: progress first, chapters second): a single
  // fill sliding over the faint ramp, ticks at the phase borders, glyphs
  // over their zones, invisible per-phase tap zones for the line reveals.
  // The fill + status track LIVE while the card is open (refreshBloom).
  bloomBtn.addEventListener('click', () => {
    const v = Math.max(0, bloomV);
    gardenBody.innerHTML = '<h2>🌸 park health</h2>'
      + '<div class="pk-bbar">'
      + '<div class="pk-bglyphs">' + PHASE_GLYPHS.map((g, i) =>
        '<span class="pk-bglyph' + (i === phase ? ' is-now' : '') + '">' + g + '</span>').join('') + '</div>'
      + '<div class="pk-btrack"><i class="pk-bramp"></i>'
      + '<i class="pk-bfill" id="pkBfill" style="clip-path:inset(0 ' + (100 - v) + '% 0 0)"></i>'
      + PHASE_STARTS.slice(1).map((t) => '<i class="pk-btick" style="left:' + t + '%"></i>').join('') + '</div>'
      + PHASE_GLYPHS.map((g, i) =>
        '<button class="pk-bzone" type="button" data-p="' + i + '" style="left:' + (i * 20) + '%"'
        + ' aria-label="park health phase ' + (i + 1) + ' of 5"></button>').join('')
      + '</div>'
      + '<p class="pk-bloomnum" id="pkBnum">' + bloomStatus() + '</p>'
      + '<p id="pkBexp"></p>';
    const exp = document.getElementById('pkBexp');
    const show = (i) => {
      exp.className = 'pk-bexp' + (i <= 1 ? ' pk-bexp--sad' : '');
      exp.textContent = PHASE_LINES[i];
      gardenBody.querySelectorAll('.pk-bglyph').forEach((g, gi) => g.classList.toggle('is-open', gi === i));
    };
    gardenBody.querySelectorAll('.pk-bzone').forEach((b) => {
      b.addEventListener('click', () => show(+b.dataset.p));
    });
    show(Math.max(0, phase));
    gardenPanel.hidden = false;
  });
  function applyGarden(res) {
    if (!res) return;
    if (Array.isArray(res.slots)) { gSlots = res.slots; renderGarden(); }
    if (Array.isArray(res.weeds)) renderWeeds(res.weeds);
    if (Array.isArray(res.trash)) renderTrash(res.trash);
    if (Array.isArray(res.eggs)) renderEggs(res.eggs);
    if (typeof res.bloom === 'number') refreshBloom(res.bloom);
  }
  async function gardenPoll() {
    applyGarden(await gFetch(''));
    if (phase < 0) {              // no word from the server — the park at its
      if (PHASE_FORCE >= 0) refreshBloom(PHASE_MID[PHASE_FORCE]);
      else setPhase(4);           // best (unless a ?phase link pins it)
    }
  }
  gardenPoll();
  setInterval(() => { if (!document.hidden) gardenPoll(); }, 60000);
  function closeGarden() { gardenPanel.hidden = true; gardenOpenSlot = -1; }
  document.getElementById('pkGardenClose').addEventListener('click', closeGarden);
  gardenPanel.addEventListener('click', (e) => { if (e.target === gardenPanel) closeGarden(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !gardenPanel.hidden) closeGarden(); });
  function coinChip(n) {
    return '<span class="pk-seedcost"><img src="/assets/banana-stand/coin.png" width="14" height="14" alt="coins" /> ' + n + '</span>';
  }
  function openSeedSheet(i) {
    gardenOpenSlot = i;
    const bal = coinBal();
    const gl = gardenerLvl();
    // locked seeds stay VISIBLE (aspiration) — greyed, with the level they need
    const lvlFor2 = (sd) => 1 + GLVL_STARS.findIndex((mx) => sd.stars <= mx);
    gardenBody.innerHTML = '<h2>an empty patch</h2>'
      + '<p class="pk-glvl">🧑‍🌾 gardener lvl ' + gl.lvl + ' · ' + gl.n + ' harvest' + (gl.n === 1 ? '' : 's') + '</p>'
      + '<p class="pk-panel__sub">plant a seed — it grows on real days, even while you’re gone. '
      + 'water it or it wilts away (higher ⭐ holds out longer). ⭐ feed the park’s health while it lives.</p>'
      + SEEDS.map((sd) => {
        const locked = sd.stars > gl.stars;
        return '<button class="pk-seedrow' + (locked ? ' pk-seedrow--lock' : '') + '" type="button"'
          + ' data-seed="' + sd.id + '"' + (locked || bal < sd.price ? ' disabled' : '') + '>'
          + '<i>' + sd.emoji + '</i>'
          + '<span class="pk-seedrow__txt"><b>' + sd.name + (sd.rare ? ' <em>rare</em>' : '') + '</b>'
          + '<small>' + starStr(sd.stars) + ' · ' + sd.days + ' days → '
          + (locked ? '🔒 gardener lvl ' + lvlFor2(sd)
            : sd.wearable ? 'the ' + sd.wearLabel : '+' + (sd.stars * 8) + ' rep') + '</small></span>'
          + coinChip(sd.price) + '</button>';
      }).join('')
      + (bal < SEEDS[0].price ? '<p class="pk-seedpoor">no coins — the rave floor drops them</p>' : '');
    gardenBody.querySelectorAll('.pk-seedrow').forEach((b) => {
      b.addEventListener('click', () => plantSeed(i, b.dataset.seed));
    });
    gardenPanel.hidden = false;
  }
  async function plantSeed(i, seedId) {
    const sd = SEED_BY[seedId];
    if (!sd || coinBal() < sd.price || sd.stars > gardenerLvl().stars) return;
    passStat('coins_spent', sd.price);
    refreshHud();
    closeGarden();
    const res = await gFetch('/plant', { slot: i, seed: seedId, name: parkName, pass: worldSid() });
    if (res && res.err === 'taken') {
      passStat('coins_spent', -sd.price);   // refund — somebody beat you to it
      refreshHud();
      toast('somebody beat you to this patch');
      applyGarden(res);
      return;
    }
    applyGarden(res);
    float(PLOTS[i][0], PLOTS[i][1] - 6, '🌱');
    toast(sd.emoji + ' ' + sd.name + ' planted — day 1 of ' + sd.days);
    if (!plantTracked) { plantTracked = true; track('park_plant', { seed: seedId }); }
  }
  function openPlantCard(i) {
    const s = gSlots[i];
    if (!s) { openSeedSheet(i); return; }
    gardenOpenSlot = i;
    const sd = SEED_BY[s.seed] || SEEDS[0];
    const mine = gMine(s), ready = gReady(s);
    // a stranger's plant is an OWNERSHIP popup: their name leads, big
    gardenBody.innerHTML = (mine
      ? '<h2>' + sd.emoji + ' your ' + sd.name + '</h2>'
      : '<h2>' + esc(s.name || 'a mystery banana') + '</h2>'
        + '<p class="pk-gplant">' + sd.emoji + ' their ' + sd.name + '</p>')
      + '<p class="pk-gplant">' + starStr(sd.stars) + '</p>'
      + '<p class="pk-panel__sub">' + (ready
        ? (mine ? 'full-grown — tap it to harvest!' : 'ready to pick — only its grower can harvest it.')
        : 'day ' + Math.min(gDays(s) + 1, sd.days) + ' of ' + sd.days + ' · growing on real days')
      + '</p>'
      + '<p class="pk-gwater">💧 watered by ' + (s.waterers || 0) + ' visitor' + (s.waterers === 1 ? '' : 's') + '</p>'
      + (ready ? '' : '<button class="pk-btn pk-gbtn" id="pkWaterBtn" type="button">💧 water it'
        + (mine ? '' : ' <small>+2 rep</small>') + '</button>')
      + (mine ? '<p class="pk-gsaved">' + (sd.wearable
        ? '💾 saved to your pass' : '🌾 harvest pays +' + (sd.stars * 8) + ' rep') + '</p>' : '');
    const wb = document.getElementById('pkWaterBtn');
    if (wb) wb.addEventListener('click', () => waterSlot(i));
    gardenPanel.hidden = false;
  }
  async function waterSlot(i) {
    const s = gSlots[i];
    if (!s) return;
    closeGarden();
    s.lastWater = Date.now();   // the soil darkens right away; the reply reconciles
    renderGarden();
    const res = await gFetch('/water', { slot: i, pass: worldSid() });
    if (res && res.err === 'watered today') { toast('already watered today — once a day per banana'); applyGarden(res); return; }
    if (res && res.err) { applyGarden(res); return; }
    applyGarden(res);
    float(PLOTS[i][0], PLOTS[i][1] - 8, '💧');
    if (!gMine(gSlots[i] || s)) { passStat('rep', 2); refreshHud(); }
    if (!waterTracked) { waterTracked = true; track('park_water'); }
  }
  function confettiAt(x, y) {
    for (let n = 0; n < 14; n++) {
      const c = document.createElement('i');
      c.className = 'pk-confetti';
      c.style.left = pct(x + (Math.random() * 60 - 30), W);
      c.style.top = pct(y - 10 - Math.random() * 30, H);
      c.style.background = ['#ffe135', '#8de08d', '#7db9ff', '#ff9d3a', '#b48ae0'][n % 5];
      c.style.animationDelay = (Math.random() * 0.2).toFixed(2) + 's';
      world.appendChild(c);
      setTimeout(() => c.remove(), 1400);
    }
  }
  async function doHarvest(i) {
    const s = gSlots[i];
    if (!s || !gMine(s) || !gReady(s)) return;
    const sd = SEED_BY[s.seed] || SEEDS[0];
    const res = await gFetch('/harvest', { slot: i, pass: worldSid() });
    if (res && res.err) { applyGarden(res); toast(res.err === 'still growing' ? 'not quite ready yet' : 'the patch is bare'); return; }
    applyGarden(res);
    const before = gardenerLvl().lvl;
    passStat('garden_harvests', 1);      // the gardener level's ledger
    confettiAt(PLOTS[i][0], PLOTS[i][1]);
    if (!sd.wearable) {                  // no wearable → rep by stars, never coins
      passStat('rep', sd.stars * 8);
      refreshHud();
      float(PLOTS[i][0], PLOTS[i][1] - 20, '+' + (sd.stars * 8));
      toast(sd.emoji + ' ' + sd.name + ' harvested — +' + (sd.stars * 8) + ' rep!', 4200);
    } else {
      passStat('own_' + sd.wearable, 1); // the wearable's earned-gate proof
      toast(sd.emoji + ' ' + sd.wearLabel + ' harvested — saved to your pass!', 4200);
    }
    const gl = gardenerLvl();
    if (gl.lvl > before) setTimeout(() => toast('🧑‍🌾 gardener lvl ' + gl.lvl + ' — new seeds in the sheet!', 4600), 1500);
    if (!harvestTracked) { harvestTracked = true; track('park_harvest', { seed: s.seed, level: gl.lvl }); }
  }
  function gardenAct(i) {
    const s = gSlots[i];
    if (!s) { openSeedSheet(i); return; }
    if (gReady(s) && gMine(s)) { doHarvest(i); return; }
    openPlantCard(i);
  }
  function tapGarden(wx, wy) {
    // an occupied slot's tap zone reaches UP over its plant; among
    // overlapping hits the nearest visual middle wins (rows sit 38px apart)
    let best = -1, bd = 1e9;
    PLOTS.forEach(([sx, sy], i) => {
      const hit = gSlots[i]
        ? (Math.abs(wx - sx) < 24 && wy > sy - 76 && wy < sy + 18) || Math.hypot(wx - sx, wy - sy) < 34
        : Math.hypot(wx - sx, wy - sy) < 34;
      if (!hit) return;
      const d2 = Math.hypot(wx - sx, wy - (sy - (gSlots[i] ? 24 : 0)));
      if (d2 < bd) { bd = d2; best = i; }
    });
    if (best < 0) return false;
    const [sx, sy] = PLOTS[best];
    if (Math.hypot(pos.x - sx, pos.y - sy) < 95) { gardenAct(best); return true; }
    pendingGarden = best;                 // walk-then-act, like everything else
    tgt.x = sx;
    tgt.y = 882;                          // the path along the beds' south edge
    return true;
  }
  function gardenTick() {
    if (pendingGarden != null) {
      const [sx, sy] = PLOTS[pendingGarden];
      if (Math.hypot(pos.x - sx, pos.y - sy) < 95) { const i = pendingGarden; pendingGarden = null; gardenAct(i); }
    }
    if (pendingWater != null) {   // the tool slot's walk-then-water
      const [sx, sy] = PLOTS[pendingWater];
      if (Math.hypot(pos.x - sx, pos.y - sy) < 95) { const i = pendingWater; pendingWater = null; waterSlot(i); }
    }
    if (pendingWeed != null) {
      const w2 = weeds.get(pendingWeed);
      if (!w2) pendingWeed = null;          // pulled by somebody else mid-walk
      else if (Math.hypot(pos.x - w2.x, pos.y - w2.y) < 90) { const id = pendingWeed; pendingWeed = null; pullWeed(id); }
    }
    if (pendingEgg != null) {
      const e = eggs.get(pendingEgg);
      if (!e) pendingEgg = null;            // claimed by somebody else mid-walk
      else if (Math.hypot(pos.x - e.x, pos.y - e.y) < 90) { const id = pendingEgg; pendingEgg = null; claimEgg(id); }
    }
  }

  // ---- 🧰 THE TOOL SLOT — the one contextual chore button ----------------
  // Scans every frame (≤10 weeds + 16 slots — cheap); DOM writes are
  // change-guarded on the chore key. DRY plant = not watered today (anyone's);
  // a ready plant is a harvest, not a chore. Press = act on the nearest,
  // walking the last step first — the same pull/water paths as a direct tap.
  const toolBtn = document.getElementById('pkTool');
  let toolChore = null, toolKey = '';
  function toolScan() {
    let best = null, bd = TOOL_RANGE;
    weeds.forEach((w2, id) => {
      const d = Math.hypot(pos.x - w2.x, pos.y - w2.y);
      if (d < bd) { bd = d; best = { kind: 'weed', id, x: w2.x, y: w2.y }; }
    });
    PLOTS.forEach(([sx, sy], i) => {
      const s = gSlots[i];
      if (!s || gWet(s) || gReady(s)) return;
      const d = Math.hypot(pos.x - sx, pos.y - sy);
      if (d < bd) { bd = d; best = { kind: 'water', i, x: sx, y: sy }; }
    });
    return best;
  }
  function toolTick() {
    const c = toolScan();
    toolChore = c;
    const key = c ? c.kind + ':' + (c.kind === 'weed' ? c.id : c.i) : '';
    if (key === toolKey) return;
    toolKey = key;
    if (!c) { toolBtn.hidden = true; return; }
    toolBtn.textContent = c.kind === 'weed' ? '🌿 pull' : '💧 water';
    toolBtn.hidden = false;
  }
  toolBtn.addEventListener('click', () => {
    const c = toolChore;
    if (!c) return;
    if (c.kind === 'weed') {
      if (Math.hypot(pos.x - c.x, pos.y - c.y) < 90) { pullWeed(c.id); return; }
      pendingWeed = c.id;
      tgt.x = c.x; tgt.y = c.y + 26;
      return;
    }
    if (Math.hypot(pos.x - c.x, pos.y - c.y) < 95) { waterSlot(c.i); return; }
    pendingWater = c.i;
    tgt.x = c.x; tgt.y = 882;
  });

  // ---- 🌍 THE WORLD HUD — the refined pill strip, park edition ------------
  const lvlNEl = document.getElementById('pkLvlN');
  const lvlFillEl = document.getElementById('pkLvlFill');
  const coinNEl = document.getElementById('pkCoinN');
  const coinBal = () => {
    const s = passGet().stats || {};
    return Math.max(0, (s.coins_earned || 0) - (s.coins_spent || 0));
  };
  function refreshHud() {
    const s = passGet().stats || {};
    if (lvlNEl) {
      const lv = levelFor(s.rep || 0);
      lvlNEl.textContent = 'LVL ' + lv.level;
      if (lvlFillEl) lvlFillEl.style.width = Math.round((lv.into / lv.need) * 100) + '%';
    }
    if (coinNEl) coinNEl.textContent = coinBal();
  }
  refreshHud();
  setInterval(() => { if (!document.hidden) refreshHud(); }, 1000);

  // 🎮 the action bar — React · Sound
  document.getElementById('pkEmote').addEventListener('click', () => {
    float(pos.x, pos.y - 44, '❤️');
  });
  (() => {
    const btn = document.getElementById('pkAudio');
    let on = false;
    btn.addEventListener('click', () => {
      on = !on;
      btn.textContent = on ? '🔊' : '🔇';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  })();

  // ---- the loop -----------------------------------------------------------
  let last = performance.now();
  let pSpeed = 0, prevPX = 0, prevPY = 0;   // smoothed — the butterflies read it
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (kx || ky) {
      tgt.x = pos.x + kx * 30; tgt.y = pos.y + ky * 30;
      hint(false);
    }
    const dx = tgt.x - pos.x, dy = tgt.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5) {
      const m = Math.min(d, SPEED * dt);
      const nx = pos.x + (dx / d) * m, ny = pos.y + (dy / d) * m;
      if (!blocked(nx, ny)) { pos.x = nx; pos.y = ny; }
      else if (!blocked(nx, pos.y)) pos.x = nx;
      else if (!blocked(pos.x, ny)) pos.y = ny;
      else {
        // round obstacles: step perpendicular, whichever side is open
        const p1x = pos.x + (dy / d) * m, p1y = pos.y - (dx / d) * m;
        const p2x = pos.x - (dy / d) * m, p2y = pos.y + (dx / d) * m;
        if (!blocked(p1x, p1y)) { pos.x = p1x; pos.y = p1y; }
        else if (!blocked(p2x, p2y)) { pos.x = p2x; pos.y = p2y; }
        else { tgt.x = pos.x; tgt.y = pos.y; }
      }
      pos.x = Math.max(12, Math.min(W - 12, pos.x));
      pos.y = Math.max(12, Math.min(H - 12, pos.y));
    }
    if (pos.x !== meWX || pos.y !== meWY) {   // outside the walk branch: a
      meWX = pos.x; meWY = pos.y;             // direct pos set repaints too
      meEl.style.left = pct(pos.x, W);
      meEl.style.top = pct(pos.y, H);
      depth(meEl, pos.y);
    }
    const inst = Math.hypot(pos.x - prevPX, pos.y - prevPY) / Math.max(dt, 0.001);
    pSpeed = pSpeed * 0.8 + inst * 0.2;
    prevPX = pos.x; prevPY = pos.y;
    acornTick(now);
    trashTick();
    oldTick();
    oldWalkTick();
    bflyTick(dt, now);
    animalTick(dt);
    squirrels.forEach((s) => sqStep(s, dt));
    tossTick();
    coinWinTick();
    cartTick(now);
    standTick(now);
    gardenTick();
    toolTick();
    doorTick();
    parkSendMove(now);
    cam();
    requestAnimationFrame(step);
  }

  // everyone in Banana World dances on the same wall clock
  const frameNow = () => {
    const cyc = BASE_CYCLE_S * 1000;
    return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES;
  };
  const CV = 150;
  let lastF = -1;
  function drawMe() {
    const f = frameNow();
    if (f === lastF) return;
    lastF = f;
    drawComposite(meCtx, CV, f, { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
  }
  function hint(on) { if (hintEl) hintEl.classList.toggle('is-off', !on); }

  // ---- 🌐 the park is MULTIPLAYER ----------------------------------------
  // The EXISTING ParkRoom DO on worker-rave (/park) — same protocol the old
  // stand page speaks: join, move, outfit, leave. ⚠️ THE WIRE IS IN PERCENT
  // (the DO clamps x 5–95 / y 20–99), so world px convert at this boundary.
  // Fails silently by design: no socket, no crowd, the park still works solo.
  const PARK_WS = 'wss://banana-rave.trymstene.workers.dev/park';
  const peers = new Map();                      // id → { el, ctx, outfit, x, y, lastF }
  const crowdEl = document.getElementById('pkCrowd');
  let myParkId = null, parkSendAt = 0, sawPeer = false;
  const lastSent = { x: -1, y: -1 };
  let parkName = '';
  try { parkName = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}
  const myParkOutfit = () => fullOutfit(ME_DRAW);
  const toPctX = (x) => x / W * 100, toPctY = (y) => y / H * 100;
  const fromPctX = (x) => (Number(x) || 50) / 100 * W, fromPctY = (y) => (Number(y) || 90) / 100 * H;
  function refreshCrowd() {
    if (crowdEl) crowdEl.textContent = peers.size ? String(peers.size + 1) : 'solo';
  }
  function drawPeer(p, force) {
    const f = frameNow();
    if (!force && f === p.lastF) return;
    p.lastF = f;
    drawComposite(p.ctx, CV, f, {
      ...p.outfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
      custom: p.outfit && p.outfit.c ? catCustom(p.outfit.c) : undefined,
    });
  }
  function placePeer(p) {
    p.el.style.left = pct(p.x, W);
    p.el.style.top = pct(p.y, H);
    depth(p.el, p.y);
  }
  function addPeer(d) {
    if (!d || d.id === myParkId || peers.has(d.id)) return;
    if (!sawPeer) { sawPeer = true; track('park_multiplayer'); }
    const el = document.createElement('div');
    el.className = 'pk-peer';
    const cv = document.createElement('canvas');
    cv.width = CV; cv.height = CV;
    el.appendChild(cv);
    if (d.name) { const tag = document.createElement('span'); tag.textContent = d.name; el.appendChild(tag); }
    world.appendChild(el);
    const p = {
      el, ctx: cv.getContext('2d'), outfit: d.outfit || {}, name: d.name || '',
      x: fromPctX(d.x), y: fromPctY(d.y), lastF: -1,
    };
    peers.set(d.id, p);
    placePeer(p);
    drawPeer(p, true);
    refreshCrowd();
  }
  const parkRoom = presenceRoom({
    url: PARK_WS,
    hi: () => ({ outfit: myParkOutfit(), x: toPctX(pos.x), y: toPctY(pos.y), name: parkName }),
    onMessage: (m) => {
      if (m.t === 'roster') { myParkId = m.you; (m.all || []).forEach(addPeer); refreshCrowd(); }
      else if (m.t === 'join') addPeer(m.p);
      else if (m.t === 'move') {
        const p = peers.get(m.id);
        if (p) { p.x = fromPctX(m.x); p.y = fromPctY(m.y); placePeer(p); }
      } else if (m.t === 'outfit') {
        const p = peers.get(m.id);
        if (p) { p.outfit = m.outfit || {}; drawPeer(p, true); }
      } else if (m.t === 'leave') {
        const p = peers.get(m.id);
        if (p) {
          poofInto(world, 'pk-poof', p.x / W * 100, (p.y - 26) / H * 100);
          p.el.remove();
          peers.delete(m.id);
          refreshCrowd();
        }
      }
    },
    onDown: () => { peers.forEach((p) => p.el.remove()); peers.clear(); refreshCrowd(); },
  });
  function parkSendMove(now) {
    if (!parkRoom.live || now - parkSendAt < 150) return;
    if (Math.abs(pos.x - lastSent.x) < 1 && Math.abs(pos.y - lastSent.y) < 1) return;
    parkSendAt = now;
    lastSent.x = pos.x; lastSent.y = pos.y;
    parkRoom.send({ t: 'move', x: toPctX(pos.x), y: toPctY(pos.y) });
  }

  // the QA reach-in (same family as ?beachtest): place the banana, top up
  // coins, read the live rosters — nothing here exists in a normal session
  if (PARK_TEST) {
    window.__park = {
      pos, tgt, acorns, bflys, squirrels, animals, eggs, PLOTS,
      // 🥚 egg QA: lay one at your feet (egg(1) = golden); steal() = somebody
      // else claims the oldest — tap it after for the 'someone got it' path
      egg: (g) => {
        gShim.eggs.push({ id: 'qa' + Math.random().toString(36).slice(2, 6),
          x: Math.round(pos.x) + 60, y: Math.round(pos.y), ...(g ? { g: 1 } : {}) });
        gardenPoll();
      },
      steal: () => { gShim.eggs.shift(); gardenPoll(); },
      // 🗑 litter QA: drop a piece just ahead — walk over it to test pickup
      litter: (v) => {
        gShim.trash.push({ id: 'qt' + Math.random().toString(36).slice(2, 6),
          x: Math.round(pos.x) + 80, y: Math.round(pos.y), v: v || 1 + Math.floor(Math.random() * 3) });
        gardenPoll();
      },
      // 🧰 chore QA: lay a weed at your feet; dry(i) = slot i missed today
      weed: () => {
        gShim.weeds.push({ id: 'qw' + Math.random().toString(36).slice(2, 6),
          x: Math.round(pos.x) - 70, y: Math.round(pos.y) });
        gardenPoll();
      },
      dry: (i) => { const s = gShim.slots[i]; if (s) s.lastWater -= 86460000; gardenPoll(); },
      // 🐔 mood QA: pop every animal's bubble right now
      mood: () => animals.forEach((a) => showMood(a)),
      coins: (n) => { passStat('coins_earned', n); refreshHud(); },
      // 🧑‍🌾 gardener QA: set the harvest count / jump straight to a level
      harvests: (n) => { passStat('garden_harvests', n - ((passGet().stats || {}).garden_harvests || 0)); return gardenerLvl(); },
      lvl: (n) => { passStat('garden_harvests', GLVL_AT[Math.max(1, Math.min(GLVL_AT.length, n)) - 1] - ((passGet().stats || {}).garden_harvests || 0)); return gardenerLvl(); },
      warp: (x, y) => { pos.x = x; pos.y = y; tgt.x = x; tgt.y = y; meWX = NaN; },
      // 🌱 garden QA: read state, fast-forward growth d days (shim store =
      // this session's local stand-in server; render follows on next poll)
      garden: () => gSlots,
      gShim,
      ff: (i, d2) => { const s = gShim.slots[i]; if (s) s.plantedAt -= d2 * 86400000; gardenPoll(); },
      // 🌸 phase QA: force the shim's bloom, read the resolved phase
      bloom: (v) => { gShim.bloom = v; gardenPoll(); },
      phase: () => phase,
    };
  }

  meEl.style.left = pct(pos.x, W);
  meEl.style.top = pct(pos.y, H);
  depth(meEl, pos.y);
  assetsReady().then(() => {
    drawMe();
    setTimeout(() => { lastF = -1; drawMe(); }, 700);   // redraw belt: accessories decode async
    setTimeout(() => { lastF = -1; drawMe(); }, 1800);
    setInterval(() => {
      if (document.hidden) return;
      drawMe();
      peers.forEach((p) => drawPeer(p));
    }, 120);
    requestAnimationFrame((t) => { last = t; step(t); });
  });
}

// the entry point, AFTER every module const above it (TDZ)
if (view) init();
