// THE BANANA RAVE — everyone on the page dances together, in sync, forever.
//
// The clock trick: dance phase = wall time mod cycle, so every banana on
// Earth is on the same frame with ZERO realtime animation traffic. The
// server (worker-rave, Durable Object) is presence only: who's here, in
// what outfit, plus emotes. No captions on the floor (fixed emotes only) =
// no moderation surface.
//
// THE DROP: clock-synced shared moment — every 3 minutes, for 10 seconds,
// the whole floor goes disco. Everyone sees it together because everyone
// shares the same clock. Zero server involvement.
import { drawComposite, assetsReady, NFRAMES } from '../lib/banana-engine.js';
import { dailyOutfit } from '../lib/banana-daily.js';
import { passPatch, passStat, passVisit, passToast } from '../lib/banana-pass.js';
import { rankFor, nextRank } from '../lib/pass-defs.js';

const RAVE_WS = 'wss://banana-rave.trymstene.workers.dev/ws';
const DROP_PERIOD = 180, DROP_LEN = 15; // seconds — 15 covers the full 12.8s musical drop with a strut-out (was 10; Trym: "wohoo")
const MAX_VISIBLE = 60;
// stay this long → the stage opens (server enforces the same; ?stagetest = solo-mode preview)
const STAGE_UNLOCK_MS = location.search.includes('stagetest') ? 5000 : 5 * 60 * 1000;
// walking (option A: you dance-walk — the dance keeps playing, mirror + lean give direction)
const WALK_SPEED = 16;     // % of floor per second
const MOVE_SEND_MS = 150;  // network throttle; local echo runs every frame
// the souvenir: survive this long → the glowstick is yours forever (client-side unlock, it's a joke not DRM)
const GLOW_MS = location.search.includes('stagetest') ? 20000 : 30 * 60 * 1000;
// HAPPY HOUR — clock-synced like the drop: same window for the whole planet,
// every 5th minute for 40s. First banana at the bar drinks free (server-arbitrated).
const HAPPY_PERIOD = 300, HAPPY_LEN = 40, HAPPY_OFFSET = 120; // seconds, wall clock
const BAR_ZONE = { x: 34, y: 70 }; // bottom-LEFT bar: at the bar = x < 34% AND y > 70% (down = nearer)
const happyPhase = (t) => (((t - HAPPY_OFFSET) % HAPPY_PERIOD) + HAPPY_PERIOD) % HAPPY_PERIOD;
const happyActive = (t) => happyPhase(t) < HAPPY_LEN;
const happyWin = (t) => Math.floor((t - HAPPY_OFFSET) / HAPPY_PERIOD);
// FLOOR LIFE — all clock-synced or derived from positions we already have:
// light trails (walking paints the floor), the spotlight (a gathering ritual),
// high-fives (proximity sparks), and the lost vinyl (courier quest → bonus drop).
const SPOT_PERIOD = 120, SPOT_LEN = 35, SPOT_OFFSET = 30, SPOT_R = 14; // seconds / floor-% (35s = time to actually reach it)
const VINYL_PERIOD = 420, VINYL_WAIT = 180, VINYL_OFFSET = 210;        // keep in sync with worker
const SAUCE_PERIOD = 180, SAUCE_WAIT = 100, SAUCE_OFFSET = 60;          // hot sauce drop — keep in sync with worker
const GOLD_PERIOD = 1800, GOLD_WAIT = 240, GOLD_OFFSET = 660;           // THE GOLDEN BANANA (rare) — keep in sync with worker
// THE CONVEYOR: an item every 75s, forever, but each lives only FIVE SECONDS
// on the floor before the smoke poof takes it (Trym: reflex, not patience).
// The twinkle still announces 4s ahead. Keep in sync with worker (grace there).
const ITEM_PERIOD = 75, ITEM_WAIT = 5, ITEM_OFFSET = 15;
const SNACKS = { candy: ['🍬', 'CANDY'], pizza: ['🍕', 'PIZZA SLICE'], balloon: ['🎈', 'BALLOON'], pizzabox: ['🍕', 'A FULL PIZZA BOX'] };
const WAVE_PERIOD = 480, WAVE_LEN = 8, WAVE_OFFSET = 300;               // THE WAVE — client-only, synced by clock + emote broadcasts
const CHAIN_MS = 90000;                                                  // grab the next item within 90s to keep the chain
const SPECIAL_PERIOD = 300, SPECIAL_LEN = 35, SPECIAL_OFFSET = 270;     // Barty's specials, right between happy hours — keep in sync with worker
const COCKTAILS = ['daiquiri', 'fizz', 'espresso', 'lagoon', 'colada', 'margarita', 'champagne', 'milkshake', 'jellyshot', 'water']; // rotation — keep in sync with worker
// with a whole menu of items and drinks cycling, effects are MOMENTS, not
// outfits — 10s baseline (Trym's call; was 150s/60s). The crowd favourites
// earn longer runs (Trym's juice pass: "it's fun!"). Keep in sync with worker.
const FX_MS = 10000;
const FX_DUR = { cone: 30000, balloon: 20000, zap: 20000, conga: 15000, boots: 15000, magnet: 12000, sparkler: 12000, fog: 20000 };
const fxLen = (id) => FX_DUR[id] || FX_MS;
// every fx window is capped at FIRST SIGHT, so each id's fuse holds even
// against a not-yet-redeployed worker still stamping different windows
const capFx = (fx) => (fx ? { ...fx, until: Math.min(fx.until, Date.now() + fxLen(fx.id)) } : fx);
const FX_NAMES = {
  flames: 'Flaming Potassium', daiquiri: 'Banana Daiquiri', fizz: 'Bubblegum Fizz', zap: 'Electric Charge', balloon: 'Balloon Ride',
  prism: 'Mirror Mirror', cone: 'The Cone of Honour', popper: 'Party Popper', fog: 'Fog on the Floor', notes: 'Kazoo Solo',
  glitter: 'Glitter Bombed', flash: 'Paparazzi', slide: 'Ice Legs', bubbles: 'Bubble Wand',
  boots: 'Moon Boots', wobble: 'Jelly Legs', sparkler: 'The Sparkler',
  magnet: 'The Jelly Magnet', vhs: 'VHS Banana', conga: 'The Entourage',
  slice: 'Pizza in Hand', box: 'The Whole Box', sugar: 'Sugar Rush',
  espresso: 'Espresso Martini', lagoon: 'Blue Lagoon', colada: 'Piña Colada', margarita: 'Spicy Margarita',
  champagne: 'Champagne', milkshake: 'The Off-Menu Milkshake', jellyshot: 'Double Jelly Shot', water: 'Water (Barty Insists)',
};
const FX_ICON = {
  flames: '🔥', daiquiri: '🍹', fizz: '🫧', zap: '⚡', balloon: '🎈',
  prism: '🪩', cone: '🚧', popper: '🎉', fog: '🌫️', notes: '🎶', glitter: '✨', flash: '📸', slide: '🧊', bubbles: '🧼',
  espresso: '☕', lagoon: '🌊', colada: '🍍', margarita: '🌶️', champagne: '🥂', milkshake: '🥤', jellyshot: '🍮', water: '💧',
  boots: '👟', wobble: '🫠', sparkler: '🎇', magnet: '🧲', vhs: '📼', conga: '👯',
  slice: '🍕', box: '🍕', sugar: '🍬',
};
// what each conveyor item grants (client mirror of the worker's ITEM_FX)
const MENU_FX = {
  shard: 'prism', cone: 'cone', popper: 'popper', remote: 'fog', kazoo: 'notes', glitter: 'glitter', phone: 'flash', cube: 'slide', wand: 'bubbles',
  boots: 'boots', gel: 'wobble', sparkler: 'sparkler', magnet: 'magnet', vhs: 'vhs', star: 'conga',
  // the snacks got fx too (Trym's juice round 2): held pizza props + the sugar shakes
  pizza: 'slice', pizzabox: 'box', candy: 'sugar',
};
const GRAB_R = 12; // floor-item grab radius (was 8 — near-misses felt dead, esp. tap-steering on iOS)
const FIVE_DIST = 8, FIVE_COOLDOWN = 90000;
// deterministic 0..1 from an integer — same math as the worker (Math.imul is exact)
function seedRand(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function spotFor(w) {
  let x = 12 + seedRand(w * 2) * 70;
  let y = 16 + seedRand(w * 2 + 1) * 60;
  if (x < 36 && y > 66) y -= 30; // never inside the bar corner
  return { x, y };
}
function vinylSpotFor(w) { // keep in sync with vinylSpot() in worker-rave
  let x = 12 + seedRand(0x5eed + w * 2) * 70;
  let y = 26 + seedRand(0x5eed + w * 2 + 1) * 46; // open floor only — never against the stage edge
  if (x < 36 && y > 66) y -= 30;
  return { x, y };
}
function sauceSpotFor(w) { // keep in sync with sauceSpot() in worker-rave
  let x = 12 + seedRand(0xf1a5 + w * 2) * 70;
  let y = 26 + seedRand(0xf1a5 + w * 2 + 1) * 46;
  if (x < 36 && y > 66) y -= 30;
  return { x, y };
}
function goldSpotFor(w) { // keep in sync with goldSpot() in worker-rave
  let x = 12 + seedRand(0x601d + w * 2) * 70;
  let y = 26 + seedRand(0x601d + w * 2 + 1) * 46;
  if (x < 36 && y > 66) y -= 30;
  return { x, y };
}
function itemSpotFor(w) { // keep in sync with itemSpot() in worker-rave
  let x = 12 + seedRand(0x17e6 + w * 2) * 70;
  let y = 26 + seedRand(0x17e6 + w * 2 + 1) * 46;
  if (x < 36 && y > 66) y -= 30;
  return { x, y };
}
function itemTypeFor(w) { // keep weights in sync with itemType() in worker-rave
  const r = seedRand(0x7ab1e + w);
  // 22 kinds now — classics keep a slight edge; the R4.5 six close the table
  return r < 0.08 ? 'sauce' : r < 0.15 ? 'zap' : r < 0.22 ? 'fizz'
    : r < 0.28 ? 'candy' : r < 0.34 ? 'pizza' : r < 0.40 ? 'balloon'
    : r < 0.45 ? 'shard' : r < 0.50 ? 'cone' : r < 0.55 ? 'popper'
    : r < 0.59 ? 'remote' : r < 0.63 ? 'kazoo' : r < 0.67 ? 'glitter'
    : r < 0.71 ? 'phone' : r < 0.75 ? 'cube' : r < 0.78 ? 'pizzabox'
    : r < 0.81 ? 'wand' : r < 0.85 ? 'boots' : r < 0.88 ? 'gel'
    : r < 0.91 ? 'sparkler' : r < 0.94 ? 'magnet' : r < 0.97 ? 'vhs' : 'star';
}
// a gloved FIST with a wrist cuff (yellow stripe) — a plain mitten blob read as
// "a white ball" at rave size; the cuff is what makes it read as a glove
const MITT_SVG = '<svg viewBox="0 0 10 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="0" width="4" height="1" fill="#111111"/><rect x="3" y="1" width="1" height="1" fill="#111111"/><rect x="4" y="1" width="4" height="1" fill="#fffdf5"/><rect x="8" y="1" width="1" height="1" fill="#111111"/><rect x="0" y="2" width="1" height="4" fill="#111111"/><rect x="1" y="2" width="1" height="4" fill="#ffe135"/><rect x="2" y="2" width="1" height="4" fill="#111111"/><rect x="3" y="2" width="6" height="4" fill="#fffdf5"/><rect x="9" y="2" width="1" height="4" fill="#111111"/><rect x="3" y="6" width="1" height="1" fill="#111111"/><rect x="4" y="6" width="4" height="1" fill="#fffdf5"/><rect x="8" y="6" width="1" height="1" fill="#111111"/><rect x="4" y="7" width="4" height="1" fill="#111111"/></svg>';
// Floor-item sprites — authored in scratchpad floor-items.py (Pillow-verified on
// the real floor colour at floor size; the old 7×7 vinyl "looked like a rock").
const SAUCE_SVG = '<svg viewBox="0 0 8 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="0" width="2" height="1" fill="#3a304c"/><rect x="3" y="1" width="2" height="1" fill="#3a304c"/><rect x="2" y="2" width="1" height="1" fill="#1e182c"/><rect x="3" y="2" width="2" height="1" fill="#fffaf0"/><rect x="5" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="2" height="1" fill="#e83b3b"/><rect x="5" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="4" height="1" fill="#e83b3b"/><rect x="6" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="1" height="1" fill="#e83b3b"/><rect x="3" y="5" width="2" height="1" fill="#fffaf0"/><rect x="5" y="5" width="1" height="1" fill="#e83b3b"/><rect x="6" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="2" height="1" fill="#fffaf0"/><rect x="4" y="6" width="1" height="1" fill="#ff9128"/><rect x="5" y="6" width="1" height="1" fill="#fffaf0"/><rect x="6" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#fffaf0"/><rect x="3" y="7" width="2" height="1" fill="#ff9128"/><rect x="5" y="7" width="1" height="1" fill="#fffaf0"/><rect x="6" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#e83b3b"/><rect x="3" y="8" width="2" height="1" fill="#fffaf0"/><rect x="5" y="8" width="1" height="1" fill="#e83b3b"/><rect x="6" y="8" width="1" height="1" fill="#1e182c"/><rect x="1" y="9" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="2" height="1" fill="#e83b3b"/><rect x="4" y="9" width="1" height="1" fill="#a62026"/><rect x="5" y="9" width="1" height="1" fill="#e83b3b"/><rect x="6" y="9" width="1" height="1" fill="#1e182c"/><rect x="1" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="10" width="2" height="1" fill="#e83b3b"/><rect x="4" y="10" width="2" height="1" fill="#a62026"/><rect x="6" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="11" width="4" height="1" fill="#1e182c"/></svg>';
const DAIQUIRI_SVG = '<svg viewBox="0 0 10 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="0" width="2" height="1" fill="#ff5078"/><rect x="3" y="1" width="4" height="1" fill="#ff5078"/><rect x="2" y="2" width="1" height="1" fill="#ff5078"/><rect x="3" y="2" width="1" height="1" fill="#c8285a"/><rect x="4" y="2" width="2" height="1" fill="#ff5078"/><rect x="6" y="2" width="1" height="1" fill="#c8285a"/><rect x="7" y="2" width="1" height="1" fill="#ff5078"/><rect x="4" y="3" width="2" height="1" fill="#ffffff"/><rect x="1" y="4" width="1" height="1" fill="#6caac4"/><rect x="2" y="4" width="6" height="1" fill="#ffd650"/><rect x="8" y="4" width="1" height="1" fill="#6caac4"/><rect x="1" y="5" width="1" height="1" fill="#6caac4"/><rect x="2" y="5" width="1" height="1" fill="#ffd650"/><rect x="3" y="5" width="1" height="1" fill="#f0f0fa"/><rect x="4" y="5" width="3" height="1" fill="#ffd650"/><rect x="7" y="5" width="1" height="1" fill="#d6a024"/><rect x="8" y="5" width="1" height="1" fill="#6caac4"/><rect x="2" y="6" width="1" height="1" fill="#6caac4"/><rect x="3" y="6" width="3" height="1" fill="#ffd650"/><rect x="6" y="6" width="1" height="1" fill="#d6a024"/><rect x="7" y="6" width="1" height="1" fill="#6caac4"/><rect x="3" y="7" width="1" height="1" fill="#6caac4"/><rect x="4" y="7" width="1" height="1" fill="#ffd650"/><rect x="5" y="7" width="1" height="1" fill="#d6a024"/><rect x="6" y="7" width="1" height="1" fill="#6caac4"/><rect x="4" y="8" width="2" height="1" fill="#6caac4"/><rect x="4" y="9" width="2" height="1" fill="#6caac4"/><rect x="3" y="10" width="4" height="1" fill="#6caac4"/><rect x="2" y="11" width="6" height="1" fill="#6caac4"/></svg>';
const FIZZ_SVG = '<svg viewBox="0 0 8 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="0" width="1" height="1" fill="#ff4d9d"/><rect x="6" y="0" width="1" height="1" fill="#ffffff"/><rect x="4" y="1" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="1" width="1" height="1" fill="#ffffff"/><rect x="1" y="2" width="1" height="1" fill="#6caac4"/><rect x="2" y="2" width="4" height="1" fill="#ffffff"/><rect x="6" y="2" width="1" height="1" fill="#6caac4"/><rect x="1" y="3" width="1" height="1" fill="#6caac4"/><rect x="2" y="3" width="1" height="1" fill="#78ebff"/><rect x="3" y="3" width="1" height="1" fill="#ffffff"/><rect x="4" y="3" width="2" height="1" fill="#78ebff"/><rect x="6" y="3" width="1" height="1" fill="#6caac4"/><rect x="1" y="4" width="1" height="1" fill="#6caac4"/><rect x="2" y="4" width="3" height="1" fill="#78ebff"/><rect x="5" y="4" width="1" height="1" fill="#ffffff"/><rect x="6" y="4" width="1" height="1" fill="#6caac4"/><rect x="1" y="5" width="1" height="1" fill="#6caac4"/><rect x="2" y="5" width="1" height="1" fill="#ffffff"/><rect x="3" y="5" width="3" height="1" fill="#78ebff"/><rect x="6" y="5" width="1" height="1" fill="#6caac4"/><rect x="1" y="6" width="1" height="1" fill="#6caac4"/><rect x="2" y="6" width="4" height="1" fill="#78ebff"/><rect x="6" y="6" width="1" height="1" fill="#6caac4"/><rect x="1" y="7" width="1" height="1" fill="#6caac4"/><rect x="2" y="7" width="1" height="1" fill="#78ebff"/><rect x="3" y="7" width="1" height="1" fill="#ffffff"/><rect x="4" y="7" width="2" height="1" fill="#78ebff"/><rect x="6" y="7" width="1" height="1" fill="#6caac4"/><rect x="1" y="8" width="1" height="1" fill="#6caac4"/><rect x="2" y="8" width="4" height="1" fill="#78ebff"/><rect x="6" y="8" width="1" height="1" fill="#6caac4"/><rect x="1" y="9" width="1" height="1" fill="#6caac4"/><rect x="2" y="9" width="1" height="1" fill="#42a8c6"/><rect x="3" y="9" width="2" height="1" fill="#78ebff"/><rect x="5" y="9" width="1" height="1" fill="#42a8c6"/><rect x="6" y="9" width="1" height="1" fill="#6caac4"/><rect x="1" y="10" width="1" height="1" fill="#6caac4"/><rect x="2" y="10" width="4" height="1" fill="#42a8c6"/><rect x="6" y="10" width="1" height="1" fill="#6caac4"/><rect x="1" y="11" width="6" height="1" fill="#6caac4"/></svg>';

const ZAP_SVG = '<svg viewBox="0 0 10 14" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="1" height="1" fill="#78ebff"/><rect x="5" y="0" width="1" height="1" fill="#ffffff"/><rect x="1" y="1" width="1" height="1" fill="#ffe135"/><rect x="3" y="1" width="2" height="1" fill="#b0b0c8"/><rect x="6" y="1" width="1" height="1" fill="#78ebff"/><rect x="3" y="2" width="2" height="1" fill="#b0b0c8"/><rect x="2" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="2" height="1" fill="#b0b0c8"/><rect x="5" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="4" height="1" fill="#b0b0c8"/><rect x="6" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="4" height="1" fill="#b0b0c8"/><rect x="6" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="4" height="1" fill="#b0b0c8"/><rect x="6" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="2" height="1" fill="#b0b0c8"/><rect x="5" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="2" height="1" fill="#1e182c"/><rect x="3" y="9" width="1" height="1" fill="#1e182c"/><rect x="4" y="9" width="1" height="1" fill="#787894"/><rect x="4" y="10" width="1" height="1" fill="#1e182c"/><rect x="5" y="10" width="1" height="1" fill="#787894"/><rect x="5" y="11" width="1" height="1" fill="#1e182c"/><rect x="6" y="11" width="2" height="1" fill="#787894"/><rect x="6" y="12" width="1" height="1" fill="#1e182c"/><rect x="7" y="12" width="2" height="1" fill="#787894"/><rect x="7" y="13" width="1" height="1" fill="#1e182c"/><rect x="8" y="13" width="1" height="1" fill="#787894"/></svg>'; // THE LOOSE CABLE: the rig's wiring, unplugged and live — grab it (tidy the hazard) and it bites
const CANDY_SVG = '<svg viewBox="0 0 12 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0" width="1" height="1" fill="#c62c74"/><rect x="4" y="0" width="4" height="1" fill="#c62c74"/><rect x="10" y="0" width="1" height="1" fill="#c62c74"/><rect x="0" y="1" width="1" height="1" fill="#c62c74"/><rect x="1" y="1" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="1" width="6" height="1" fill="#ff4d9d"/><rect x="10" y="1" width="1" height="1" fill="#ff4d9d"/><rect x="11" y="1" width="1" height="1" fill="#c62c74"/><rect x="0" y="2" width="1" height="1" fill="#c62c74"/><rect x="1" y="2" width="3" height="1" fill="#ff4d9d"/><rect x="4" y="2" width="1" height="1" fill="#f0f0fa"/><rect x="5" y="2" width="6" height="1" fill="#ff4d9d"/><rect x="11" y="2" width="1" height="1" fill="#c62c74"/><rect x="1" y="3" width="1" height="1" fill="#c62c74"/><rect x="2" y="3" width="2" height="1" fill="#ff4d9d"/><rect x="4" y="3" width="1" height="1" fill="#f0f0fa"/><rect x="5" y="3" width="1" height="1" fill="#ffffff"/><rect x="6" y="3" width="4" height="1" fill="#ff4d9d"/><rect x="10" y="3" width="1" height="1" fill="#c62c74"/><rect x="1" y="4" width="1" height="1" fill="#c62c74"/><rect x="2" y="4" width="3" height="1" fill="#ff4d9d"/><rect x="5" y="4" width="1" height="1" fill="#f0f0fa"/><rect x="6" y="4" width="4" height="1" fill="#ff4d9d"/><rect x="10" y="4" width="1" height="1" fill="#c62c74"/><rect x="0" y="5" width="1" height="1" fill="#c62c74"/><rect x="1" y="5" width="5" height="1" fill="#ff4d9d"/><rect x="6" y="5" width="1" height="1" fill="#f0f0fa"/><rect x="7" y="5" width="4" height="1" fill="#ff4d9d"/><rect x="11" y="5" width="1" height="1" fill="#c62c74"/><rect x="0" y="6" width="1" height="1" fill="#c62c74"/><rect x="1" y="6" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="6" width="6" height="1" fill="#ff4d9d"/><rect x="10" y="6" width="1" height="1" fill="#ff4d9d"/><rect x="11" y="6" width="1" height="1" fill="#c62c74"/><rect x="1" y="7" width="1" height="1" fill="#c62c74"/><rect x="4" y="7" width="4" height="1" fill="#c62c74"/><rect x="10" y="7" width="1" height="1" fill="#c62c74"/></svg>';
const PIZZA_SVG = '<svg viewBox="0 0 14 14" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0" width="12" height="1" fill="#dea85c"/><rect x="0" y="1" width="2" height="1" fill="#dea85c"/><rect x="2" y="1" width="1" height="1" fill="#b47c3c"/><rect x="3" y="1" width="3" height="1" fill="#dea85c"/><rect x="6" y="1" width="1" height="1" fill="#b47c3c"/><rect x="7" y="1" width="3" height="1" fill="#dea85c"/><rect x="10" y="1" width="1" height="1" fill="#b47c3c"/><rect x="11" y="1" width="3" height="1" fill="#dea85c"/><rect x="0" y="2" width="14" height="1" fill="#dea85c"/><rect x="1" y="3" width="12" height="1" fill="#ffe135"/><rect x="1" y="4" width="1" height="1" fill="#ffe135"/><rect x="2" y="4" width="2" height="1" fill="#c82828"/><rect x="4" y="4" width="5" height="1" fill="#ffe135"/><rect x="9" y="4" width="2" height="1" fill="#c82828"/><rect x="11" y="4" width="2" height="1" fill="#ffe135"/><rect x="1" y="5" width="1" height="1" fill="#ffe135"/><rect x="2" y="5" width="2" height="1" fill="#c82828"/><rect x="4" y="5" width="2" height="1" fill="#ffe135"/><rect x="6" y="5" width="1" height="1" fill="#58c05c"/><rect x="7" y="5" width="2" height="1" fill="#ffe135"/><rect x="9" y="5" width="2" height="1" fill="#c82828"/><rect x="11" y="5" width="2" height="1" fill="#ffe135"/><rect x="2" y="6" width="10" height="1" fill="#ffe135"/><rect x="2" y="7" width="2" height="1" fill="#ffe135"/><rect x="4" y="7" width="2" height="1" fill="#c82828"/><rect x="6" y="7" width="6" height="1" fill="#ffe135"/><rect x="3" y="8" width="1" height="1" fill="#ffe135"/><rect x="4" y="8" width="2" height="1" fill="#c82828"/><rect x="6" y="8" width="2" height="1" fill="#ffe135"/><rect x="8" y="8" width="1" height="1" fill="#58c05c"/><rect x="9" y="8" width="2" height="1" fill="#ffe135"/><rect x="3" y="9" width="8" height="1" fill="#ffe135"/><rect x="4" y="10" width="2" height="1" fill="#ffe135"/><rect x="6" y="10" width="2" height="1" fill="#c82828"/><rect x="8" y="10" width="2" height="1" fill="#ffe135"/><rect x="4" y="11" width="2" height="1" fill="#ffe135"/><rect x="6" y="11" width="2" height="1" fill="#c82828"/><rect x="8" y="11" width="2" height="1" fill="#ffe135"/><rect x="5" y="12" width="4" height="1" fill="#ffe135"/><rect x="6" y="13" width="2" height="1" fill="#ffe135"/></svg>';
const BALLOON_SVG = '<svg viewBox="0 0 8 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="1" height="1" fill="#1e182c"/><rect x="3" y="0" width="2" height="1" fill="#c62c74"/><rect x="5" y="0" width="1" height="1" fill="#1e182c"/><rect x="1" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="1" width="1" height="1" fill="#c62c74"/><rect x="3" y="1" width="2" height="1" fill="#ff4d9d"/><rect x="5" y="1" width="1" height="1" fill="#c62c74"/><rect x="6" y="1" width="1" height="1" fill="#1e182c"/><rect x="0" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="1" height="1" fill="#c62c74"/><rect x="2" y="2" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="2" width="1" height="1" fill="#f0f0fa"/><rect x="4" y="2" width="2" height="1" fill="#ff4d9d"/><rect x="6" y="2" width="1" height="1" fill="#c62c74"/><rect x="7" y="2" width="1" height="1" fill="#1e182c"/><rect x="0" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#c62c74"/><rect x="2" y="3" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="3" width="1" height="1" fill="#f0f0fa"/><rect x="4" y="3" width="2" height="1" fill="#ff4d9d"/><rect x="6" y="3" width="1" height="1" fill="#c62c74"/><rect x="7" y="3" width="1" height="1" fill="#1e182c"/><rect x="0" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#c62c74"/><rect x="2" y="4" width="4" height="1" fill="#ff4d9d"/><rect x="6" y="4" width="1" height="1" fill="#c62c74"/><rect x="7" y="4" width="1" height="1" fill="#1e182c"/><rect x="0" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#c62c74"/><rect x="2" y="5" width="4" height="1" fill="#ff4d9d"/><rect x="6" y="5" width="1" height="1" fill="#c62c74"/><rect x="7" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#c62c74"/><rect x="3" y="6" width="2" height="1" fill="#ff4d9d"/><rect x="5" y="6" width="1" height="1" fill="#c62c74"/><rect x="6" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="2" height="1" fill="#c62c74"/><rect x="5" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="2" height="1" fill="#1e182c"/><rect x="3" y="9" width="1" height="1" fill="#ffffff"/><rect x="2" y="10" width="1" height="1" fill="#ffffff"/><rect x="3" y="11" width="1" height="1" fill="#ffffff"/></svg>';
const ITEM_SVGS = { sauce: SAUCE_SVG, zap: ZAP_SVG, fizz: FIZZ_SVG, candy: CANDY_SVG, pizza: PIZZA_SVG, balloon: BALLOON_SVG };
// (THE MENU's conveyor sprites join below, once MENU_SVGS exists)
// THE NIGHT's chores + characters (Pillow-authored, scratchpad night-sprites)
const PEEL_SVG = '<svg viewBox="0 0 24 18" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="13" y="0" width="1" height="1" fill="#5a3618"/><rect x="14" y="0" width="2" height="1" fill="#3a2410"/><rect x="16" y="0" width="1" height="1" fill="#5a3618"/><rect x="12" y="1" width="2" height="1" fill="#5a3618"/><rect x="14" y="1" width="2" height="1" fill="#3a2410"/><rect x="16" y="1" width="1" height="1" fill="#5a3618"/><rect x="10" y="2" width="3" height="1" fill="#5a3618"/><rect x="13" y="2" width="2" height="1" fill="#ffe135"/><rect x="15" y="2" width="1" height="1" fill="#e0a428"/><rect x="16" y="2" width="1" height="1" fill="#5a3618"/><rect x="10" y="3" width="1" height="1" fill="#5a3618"/><rect x="11" y="3" width="3" height="1" fill="#ffe135"/><rect x="14" y="3" width="1" height="1" fill="#e0a428"/><rect x="15" y="3" width="2" height="1" fill="#5a3618"/><rect x="9" y="4" width="2" height="1" fill="#5a3618"/><rect x="11" y="4" width="3" height="1" fill="#ffe135"/><rect x="14" y="4" width="2" height="1" fill="#5a3618"/><rect x="8" y="5" width="2" height="1" fill="#5a3618"/><rect x="10" y="5" width="5" height="1" fill="#ffe135"/><rect x="15" y="5" width="2" height="1" fill="#5a3618"/><rect x="7" y="6" width="3" height="1" fill="#5a3618"/><rect x="10" y="6" width="1" height="1" fill="#ffe135"/><rect x="11" y="6" width="2" height="1" fill="#fff6c8"/><rect x="13" y="6" width="2" height="1" fill="#ffe135"/><rect x="15" y="6" width="3" height="1" fill="#5a3618"/><rect x="6" y="7" width="2" height="1" fill="#5a3618"/><rect x="8" y="7" width="1" height="1" fill="#ffe135"/><rect x="9" y="7" width="1" height="1" fill="#5a3618"/><rect x="10" y="7" width="1" height="1" fill="#ffe135"/><rect x="11" y="7" width="1" height="1" fill="#fff6c8"/><rect x="12" y="7" width="3" height="1" fill="#ffe135"/><rect x="15" y="7" width="1" height="1" fill="#5a3618"/><rect x="16" y="7" width="1" height="1" fill="#ffe135"/><rect x="17" y="7" width="2" height="1" fill="#5a3618"/><rect x="5" y="8" width="2" height="1" fill="#5a3618"/><rect x="7" y="8" width="2" height="1" fill="#ffe135"/><rect x="9" y="8" width="1" height="1" fill="#5a3618"/><rect x="10" y="8" width="5" height="1" fill="#ffe135"/><rect x="15" y="8" width="1" height="1" fill="#5a3618"/><rect x="16" y="8" width="2" height="1" fill="#ffe135"/><rect x="18" y="8" width="2" height="1" fill="#5a3618"/><rect x="4" y="9" width="2" height="1" fill="#5a3618"/><rect x="6" y="9" width="2" height="1" fill="#ffe135"/><rect x="8" y="9" width="2" height="1" fill="#5a3618"/><rect x="10" y="9" width="5" height="1" fill="#ffe135"/><rect x="15" y="9" width="2" height="1" fill="#5a3618"/><rect x="17" y="9" width="2" height="1" fill="#ffe135"/><rect x="19" y="9" width="2" height="1" fill="#5a3618"/><rect x="3" y="10" width="2" height="1" fill="#5a3618"/><rect x="5" y="10" width="3" height="1" fill="#ffe135"/><rect x="8" y="10" width="1" height="1" fill="#5a3618"/><rect x="9" y="10" width="1" height="1" fill="#e0a428"/><rect x="10" y="10" width="5" height="1" fill="#ffe135"/><rect x="15" y="10" width="1" height="1" fill="#e0a428"/><rect x="16" y="10" width="1" height="1" fill="#5a3618"/><rect x="17" y="10" width="3" height="1" fill="#ffe135"/><rect x="20" y="10" width="2" height="1" fill="#5a3618"/><rect x="2" y="11" width="2" height="1" fill="#5a3618"/><rect x="4" y="11" width="4" height="1" fill="#ffe135"/><rect x="8" y="11" width="2" height="1" fill="#5a3618"/><rect x="10" y="11" width="5" height="1" fill="#ffe135"/><rect x="15" y="11" width="2" height="1" fill="#5a3618"/><rect x="17" y="11" width="1" height="1" fill="#e0a428"/><rect x="18" y="11" width="3" height="1" fill="#ffe135"/><rect x="21" y="11" width="2" height="1" fill="#5a3618"/><rect x="1" y="12" width="2" height="1" fill="#5a3618"/><rect x="3" y="12" width="3" height="1" fill="#ffe135"/><rect x="6" y="12" width="2" height="1" fill="#e0a428"/><rect x="8" y="12" width="2" height="1" fill="#5a3618"/><rect x="10" y="12" width="1" height="1" fill="#e0a428"/><rect x="11" y="12" width="4" height="1" fill="#ffe135"/><rect x="15" y="12" width="3" height="1" fill="#5a3618"/><rect x="18" y="12" width="1" height="1" fill="#e0a428"/><rect x="19" y="12" width="3" height="1" fill="#ffe135"/><rect x="22" y="12" width="2" height="1" fill="#5a3618"/><rect x="1" y="13" width="1" height="1" fill="#5a3618"/><rect x="2" y="13" width="3" height="1" fill="#ffe135"/><rect x="5" y="13" width="1" height="1" fill="#e0a428"/><rect x="6" y="13" width="5" height="1" fill="#5a3618"/><rect x="11" y="13" width="4" height="1" fill="#ffe135"/><rect x="15" y="13" width="1" height="1" fill="#5a3618"/><rect x="17" y="13" width="2" height="1" fill="#5a3618"/><rect x="19" y="13" width="1" height="1" fill="#e0a428"/><rect x="20" y="13" width="3" height="1" fill="#ffe135"/><rect x="23" y="13" width="1" height="1" fill="#5a3618"/><rect x="0" y="14" width="2" height="1" fill="#5a3618"/><rect x="2" y="14" width="2" height="1" fill="#ffe135"/><rect x="4" y="14" width="1" height="1" fill="#e0a428"/><rect x="5" y="14" width="2" height="1" fill="#5a3618"/><rect x="10" y="14" width="1" height="1" fill="#5a3618"/><rect x="11" y="14" width="4" height="1" fill="#ffe135"/><rect x="15" y="14" width="1" height="1" fill="#5a3618"/><rect x="18" y="14" width="2" height="1" fill="#5a3618"/><rect x="20" y="14" width="1" height="1" fill="#e0a428"/><rect x="21" y="14" width="3" height="1" fill="#ffe135"/><rect x="0" y="15" width="1" height="1" fill="#5a3618"/><rect x="1" y="15" width="2" height="1" fill="#ffe135"/><rect x="3" y="15" width="1" height="1" fill="#e0a428"/><rect x="4" y="15" width="2" height="1" fill="#5a3618"/><rect x="10" y="15" width="1" height="1" fill="#5a3618"/><rect x="11" y="15" width="1" height="1" fill="#e0a428"/><rect x="12" y="15" width="3" height="1" fill="#ffe135"/><rect x="15" y="15" width="1" height="1" fill="#5a3618"/><rect x="19" y="15" width="2" height="1" fill="#5a3618"/><rect x="21" y="15" width="1" height="1" fill="#e0a428"/><rect x="22" y="15" width="2" height="1" fill="#ffe135"/><rect x="0" y="16" width="1" height="1" fill="#5a3618"/><rect x="1" y="16" width="2" height="1" fill="#e0a428"/><rect x="3" y="16" width="2" height="1" fill="#5a3618"/><rect x="10" y="16" width="2" height="1" fill="#5a3618"/><rect x="12" y="16" width="2" height="1" fill="#ffe135"/><rect x="14" y="16" width="1" height="1" fill="#e0a428"/><rect x="15" y="16" width="1" height="1" fill="#5a3618"/><rect x="20" y="16" width="2" height="1" fill="#5a3618"/><rect x="22" y="16" width="2" height="1" fill="#e0a428"/><rect x="0" y="17" width="4" height="1" fill="#5a3618"/><rect x="11" y="17" width="1" height="1" fill="#5a3618"/><rect x="12" y="17" width="2" height="1" fill="#e0a428"/><rect x="14" y="17" width="2" height="1" fill="#5a3618"/><rect x="21" y="17" width="3" height="1" fill="#5a3618"/></svg>'; // v2: the CLASSIC peel (Trym's reference) — bent stem, centre tongue, two drooping side flaps, layered outlines
const PUDDLE_SVG = '<svg viewBox="0 0 18 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="0" width="6" height="1" fill="#4db8ff"/><rect x="3" y="1" width="3" height="1" fill="#4db8ff"/><rect x="6" y="1" width="6" height="1" fill="#78ebff"/><rect x="12" y="1" width="2" height="1" fill="#4db8ff"/><rect x="2" y="2" width="1" height="1" fill="#4db8ff"/><rect x="3" y="2" width="3" height="1" fill="#78ebff"/><rect x="6" y="2" width="1" height="1" fill="#f0f0fa"/><rect x="7" y="2" width="7" height="1" fill="#78ebff"/><rect x="14" y="2" width="1" height="1" fill="#4db8ff"/><rect x="1" y="3" width="1" height="1" fill="#4db8ff"/><rect x="2" y="3" width="9" height="1" fill="#78ebff"/><rect x="11" y="3" width="1" height="1" fill="#f0f0fa"/><rect x="12" y="3" width="3" height="1" fill="#78ebff"/><rect x="15" y="3" width="1" height="1" fill="#4db8ff"/><rect x="1" y="4" width="1" height="1" fill="#4db8ff"/><rect x="2" y="4" width="2" height="1" fill="#78ebff"/><rect x="4" y="4" width="1" height="1" fill="#f0f0fa"/><rect x="5" y="4" width="9" height="1" fill="#78ebff"/><rect x="14" y="4" width="1" height="1" fill="#4db8ff"/><rect x="2" y="5" width="2" height="1" fill="#4db8ff"/><rect x="4" y="5" width="5" height="1" fill="#78ebff"/><rect x="9" y="5" width="1" height="1" fill="#f0f0fa"/><rect x="10" y="5" width="2" height="1" fill="#78ebff"/><rect x="12" y="5" width="2" height="1" fill="#4db8ff"/><rect x="4" y="6" width="3" height="1" fill="#4db8ff"/><rect x="7" y="6" width="3" height="1" fill="#78ebff"/><rect x="10" y="6" width="3" height="1" fill="#4db8ff"/><rect x="7" y="7" width="3" height="1" fill="#4db8ff"/></svg>';
const MONKEY_SVG = '<svg viewBox="0 0 24 29" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="0" width="5" height="1" fill="#111111"/><rect x="8" y="1" width="2" height="1" fill="#111111"/><rect x="10" y="1" width="5" height="1" fill="#7a5234"/><rect x="15" y="1" width="2" height="1" fill="#111111"/><rect x="7" y="2" width="1" height="1" fill="#111111"/><rect x="8" y="2" width="9" height="1" fill="#583a22"/><rect x="17" y="2" width="1" height="1" fill="#111111"/><rect x="3" y="3" width="2" height="1" fill="#111111"/><rect x="6" y="3" width="1" height="1" fill="#111111"/><rect x="7" y="3" width="11" height="1" fill="#7a5234"/><rect x="18" y="3" width="1" height="1" fill="#111111"/><rect x="20" y="3" width="2" height="1" fill="#111111"/><rect x="2" y="4" width="1" height="1" fill="#111111"/><rect x="3" y="4" width="2" height="1" fill="#7a5234"/><rect x="5" y="4" width="1" height="1" fill="#111111"/><rect x="6" y="4" width="13" height="1" fill="#7a5234"/><rect x="19" y="4" width="1" height="1" fill="#111111"/><rect x="20" y="4" width="2" height="1" fill="#7a5234"/><rect x="22" y="4" width="1" height="1" fill="#111111"/><rect x="1" y="5" width="1" height="1" fill="#111111"/><rect x="2" y="5" width="6" height="1" fill="#7a5234"/><rect x="8" y="5" width="4" height="1" fill="#d6aa7d"/><rect x="12" y="5" width="1" height="1" fill="#7a5234"/><rect x="13" y="5" width="4" height="1" fill="#d6aa7d"/><rect x="17" y="5" width="6" height="1" fill="#7a5234"/><rect x="23" y="5" width="1" height="1" fill="#111111"/><rect x="0" y="6" width="1" height="1" fill="#111111"/><rect x="1" y="6" width="2" height="1" fill="#7a5234"/><rect x="3" y="6" width="2" height="1" fill="#d6aa7d"/><rect x="5" y="6" width="2" height="1" fill="#7a5234"/><rect x="7" y="6" width="2" height="1" fill="#d6aa7d"/><rect x="9" y="6" width="1" height="1" fill="#ffffff"/><rect x="10" y="6" width="1" height="1" fill="#1e140c"/><rect x="11" y="6" width="3" height="1" fill="#d6aa7d"/><rect x="14" y="6" width="1" height="1" fill="#ffffff"/><rect x="15" y="6" width="1" height="1" fill="#1e140c"/><rect x="16" y="6" width="2" height="1" fill="#d6aa7d"/><rect x="18" y="6" width="2" height="1" fill="#7a5234"/><rect x="20" y="6" width="2" height="1" fill="#d6aa7d"/><rect x="22" y="6" width="2" height="1" fill="#7a5234"/><rect x="0" y="7" width="1" height="1" fill="#111111"/><rect x="1" y="7" width="2" height="1" fill="#7a5234"/><rect x="3" y="7" width="2" height="1" fill="#d6aa7d"/><rect x="5" y="7" width="2" height="1" fill="#7a5234"/><rect x="7" y="7" width="2" height="1" fill="#d6aa7d"/><rect x="9" y="7" width="2" height="1" fill="#1e140c"/><rect x="11" y="7" width="3" height="1" fill="#d6aa7d"/><rect x="14" y="7" width="2" height="1" fill="#1e140c"/><rect x="16" y="7" width="2" height="1" fill="#d6aa7d"/><rect x="18" y="7" width="2" height="1" fill="#7a5234"/><rect x="20" y="7" width="2" height="1" fill="#d6aa7d"/><rect x="22" y="7" width="2" height="1" fill="#7a5234"/><rect x="1" y="8" width="1" height="1" fill="#111111"/><rect x="2" y="8" width="1" height="1" fill="#7a5234"/><rect x="3" y="8" width="2" height="1" fill="#d6aa7d"/><rect x="5" y="8" width="2" height="1" fill="#7a5234"/><rect x="7" y="8" width="11" height="1" fill="#d6aa7d"/><rect x="18" y="8" width="2" height="1" fill="#7a5234"/><rect x="20" y="8" width="2" height="1" fill="#d6aa7d"/><rect x="22" y="8" width="1" height="1" fill="#7a5234"/><rect x="23" y="8" width="1" height="1" fill="#111111"/><rect x="2" y="9" width="1" height="1" fill="#111111"/><rect x="3" y="9" width="2" height="1" fill="#7a5234"/><rect x="5" y="9" width="1" height="1" fill="#111111"/><rect x="6" y="9" width="1" height="1" fill="#7a5234"/><rect x="7" y="9" width="11" height="1" fill="#d6aa7d"/><rect x="18" y="9" width="1" height="1" fill="#7a5234"/><rect x="19" y="9" width="1" height="1" fill="#111111"/><rect x="20" y="9" width="2" height="1" fill="#7a5234"/><rect x="22" y="9" width="1" height="1" fill="#111111"/><rect x="3" y="10" width="3" height="1" fill="#111111"/><rect x="6" y="10" width="2" height="1" fill="#7a5234"/><rect x="8" y="10" width="3" height="1" fill="#d6aa7d"/><rect x="11" y="10" width="1" height="1" fill="#1e140c"/><rect x="12" y="10" width="1" height="1" fill="#d6aa7d"/><rect x="13" y="10" width="1" height="1" fill="#1e140c"/><rect x="14" y="10" width="3" height="1" fill="#d6aa7d"/><rect x="17" y="10" width="2" height="1" fill="#7a5234"/><rect x="19" y="10" width="1" height="1" fill="#111111"/><rect x="20" y="10" width="1" height="1" fill="#583a22"/><rect x="21" y="10" width="1" height="1" fill="#111111"/><rect x="6" y="11" width="1" height="1" fill="#111111"/><rect x="7" y="11" width="1" height="1" fill="#7a5234"/><rect x="8" y="11" width="9" height="1" fill="#d6aa7d"/><rect x="17" y="11" width="1" height="1" fill="#7a5234"/><rect x="18" y="11" width="1" height="1" fill="#111111"/><rect x="19" y="11" width="3" height="1" fill="#583a22"/><rect x="22" y="11" width="1" height="1" fill="#111111"/><rect x="7" y="12" width="1" height="1" fill="#111111"/><rect x="8" y="12" width="1" height="1" fill="#7a5234"/><rect x="9" y="12" width="2" height="1" fill="#d6aa7d"/><rect x="11" y="12" width="3" height="1" fill="#1e140c"/><rect x="14" y="12" width="2" height="1" fill="#d6aa7d"/><rect x="16" y="12" width="1" height="1" fill="#7a5234"/><rect x="17" y="12" width="2" height="1" fill="#111111"/><rect x="19" y="12" width="3" height="1" fill="#583a22"/><rect x="22" y="12" width="1" height="1" fill="#111111"/><rect x="8" y="13" width="2" height="1" fill="#111111"/><rect x="10" y="13" width="5" height="1" fill="#7a5234"/><rect x="15" y="13" width="2" height="1" fill="#111111"/><rect x="19" y="13" width="2" height="1" fill="#111111"/><rect x="21" y="13" width="2" height="1" fill="#583a22"/><rect x="23" y="13" width="1" height="1" fill="#111111"/><rect x="7" y="14" width="3" height="1" fill="#111111"/><rect x="10" y="14" width="5" height="1" fill="#7a5234"/><rect x="15" y="14" width="3" height="1" fill="#111111"/><rect x="21" y="14" width="2" height="1" fill="#111111"/><rect x="6" y="15" width="1" height="1" fill="#111111"/><rect x="7" y="15" width="8" height="1" fill="#7a5234"/><rect x="15" y="15" width="3" height="1" fill="#583a22"/><rect x="18" y="15" width="1" height="1" fill="#111111"/><rect x="20" y="15" width="1" height="1" fill="#111111"/><rect x="21" y="15" width="2" height="1" fill="#583a22"/><rect x="23" y="15" width="1" height="1" fill="#111111"/><rect x="6" y="16" width="1" height="1" fill="#111111"/><rect x="7" y="16" width="8" height="1" fill="#7a5234"/><rect x="15" y="16" width="3" height="1" fill="#583a22"/><rect x="18" y="16" width="1" height="1" fill="#111111"/><rect x="20" y="16" width="1" height="1" fill="#111111"/><rect x="21" y="16" width="1" height="1" fill="#583a22"/><rect x="22" y="16" width="1" height="1" fill="#111111"/><rect x="5" y="17" width="1" height="1" fill="#111111"/><rect x="6" y="17" width="5" height="1" fill="#7a5234"/><rect x="11" y="17" width="3" height="1" fill="#d6aa7d"/><rect x="14" y="17" width="1" height="1" fill="#7a5234"/><rect x="15" y="17" width="4" height="1" fill="#583a22"/><rect x="19" y="17" width="1" height="1" fill="#111111"/><rect x="20" y="17" width="3" height="1" fill="#583a22"/><rect x="23" y="17" width="1" height="1" fill="#111111"/><rect x="5" y="18" width="1" height="1" fill="#111111"/><rect x="6" y="18" width="4" height="1" fill="#7a5234"/><rect x="10" y="18" width="5" height="1" fill="#d6aa7d"/><rect x="15" y="18" width="4" height="1" fill="#583a22"/><rect x="19" y="18" width="1" height="1" fill="#111111"/><rect x="20" y="18" width="2" height="1" fill="#583a22"/><rect x="22" y="18" width="1" height="1" fill="#111111"/><rect x="4" y="19" width="1" height="1" fill="#111111"/><rect x="5" y="19" width="5" height="1" fill="#7a5234"/><rect x="10" y="19" width="5" height="1" fill="#d6aa7d"/><rect x="15" y="19" width="7" height="1" fill="#583a22"/><rect x="22" y="19" width="1" height="1" fill="#111111"/><rect x="4" y="20" width="1" height="1" fill="#111111"/><rect x="5" y="20" width="4" height="1" fill="#7a5234"/><rect x="9" y="20" width="7" height="1" fill="#d6aa7d"/><rect x="16" y="20" width="5" height="1" fill="#583a22"/><rect x="21" y="20" width="1" height="1" fill="#111111"/><rect x="3" y="21" width="1" height="1" fill="#111111"/><rect x="4" y="21" width="2" height="1" fill="#d6aa7d"/><rect x="6" y="21" width="1" height="1" fill="#111111"/><rect x="7" y="21" width="2" height="1" fill="#7a5234"/><rect x="9" y="21" width="7" height="1" fill="#d6aa7d"/><rect x="16" y="21" width="4" height="1" fill="#583a22"/><rect x="20" y="21" width="1" height="1" fill="#d6aa7d"/><rect x="21" y="21" width="1" height="1" fill="#111111"/><rect x="2" y="22" width="1" height="1" fill="#111111"/><rect x="3" y="22" width="4" height="1" fill="#d6aa7d"/><rect x="7" y="22" width="1" height="1" fill="#111111"/><rect x="8" y="22" width="2" height="1" fill="#7a5234"/><rect x="10" y="22" width="5" height="1" fill="#d6aa7d"/><rect x="15" y="22" width="2" height="1" fill="#583a22"/><rect x="17" y="22" width="1" height="1" fill="#111111"/><rect x="18" y="22" width="1" height="1" fill="#583a22"/><rect x="19" y="22" width="3" height="1" fill="#d6aa7d"/><rect x="22" y="22" width="1" height="1" fill="#111111"/><rect x="2" y="23" width="1" height="1" fill="#111111"/><rect x="3" y="23" width="4" height="1" fill="#d6aa7d"/><rect x="7" y="23" width="1" height="1" fill="#111111"/><rect x="8" y="23" width="2" height="1" fill="#7a5234"/><rect x="10" y="23" width="5" height="1" fill="#d6aa7d"/><rect x="15" y="23" width="2" height="1" fill="#583a22"/><rect x="17" y="23" width="1" height="1" fill="#111111"/><rect x="18" y="23" width="4" height="1" fill="#d6aa7d"/><rect x="22" y="23" width="1" height="1" fill="#111111"/><rect x="3" y="24" width="1" height="1" fill="#111111"/><rect x="4" y="24" width="2" height="1" fill="#d6aa7d"/><rect x="6" y="24" width="1" height="1" fill="#111111"/><rect x="8" y="24" width="1" height="1" fill="#111111"/><rect x="9" y="24" width="2" height="1" fill="#7a5234"/><rect x="11" y="24" width="3" height="1" fill="#d6aa7d"/><rect x="14" y="24" width="2" height="1" fill="#583a22"/><rect x="16" y="24" width="1" height="1" fill="#111111"/><rect x="18" y="24" width="1" height="1" fill="#111111"/><rect x="19" y="24" width="2" height="1" fill="#d6aa7d"/><rect x="21" y="24" width="1" height="1" fill="#111111"/><rect x="4" y="25" width="2" height="1" fill="#111111"/><rect x="8" y="25" width="1" height="1" fill="#111111"/><rect x="9" y="25" width="5" height="1" fill="#7a5234"/><rect x="14" y="25" width="2" height="1" fill="#583a22"/><rect x="16" y="25" width="1" height="1" fill="#111111"/><rect x="19" y="25" width="2" height="1" fill="#111111"/><rect x="8" y="26" width="1" height="1" fill="#111111"/><rect x="9" y="26" width="2" height="1" fill="#7a5234"/><rect x="11" y="26" width="3" height="1" fill="#111111"/><rect x="14" y="26" width="2" height="1" fill="#583a22"/><rect x="16" y="26" width="1" height="1" fill="#111111"/><rect x="7" y="27" width="1" height="1" fill="#111111"/><rect x="8" y="27" width="3" height="1" fill="#d6aa7d"/><rect x="11" y="27" width="1" height="1" fill="#111111"/><rect x="13" y="27" width="1" height="1" fill="#111111"/><rect x="14" y="27" width="3" height="1" fill="#d6aa7d"/><rect x="17" y="27" width="1" height="1" fill="#111111"/><rect x="7" y="28" width="1" height="1" fill="#111111"/><rect x="8" y="28" width="3" height="1" fill="#d6aa7d"/><rect x="11" y="28" width="1" height="1" fill="#111111"/><rect x="13" y="28" width="1" height="1" fill="#111111"/><rect x="14" y="28" width="3" height="1" fill="#d6aa7d"/><rect x="17" y="28" width="1" height="1" fill="#111111"/></svg>'; // v4: bigger eyes; sized by floor depth like every dancer
const JELLY_SVG = '<svg viewBox="0 0 7 7" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="3" height="1" fill="#ff4d9d"/><rect x="1" y="1" width="5" height="1" fill="#ff4d9d"/><rect x="0" y="2" width="2" height="1" fill="#ff4d9d"/><rect x="2" y="2" width="1" height="1" fill="#f0f0fa"/><rect x="3" y="2" width="4" height="1" fill="#ff4d9d"/><rect x="0" y="3" width="7" height="1" fill="#ff4d9d"/><rect x="0" y="4" width="1" height="1" fill="#c62c74"/><rect x="1" y="4" width="5" height="1" fill="#ff4d9d"/><rect x="6" y="4" width="1" height="1" fill="#c62c74"/><rect x="1" y="5" width="1" height="1" fill="#c62c74"/><rect x="2" y="5" width="3" height="1" fill="#ff4d9d"/><rect x="5" y="5" width="1" height="1" fill="#c62c74"/><rect x="2" y="6" width="3" height="1" fill="#c62c74"/></svg>'; // the pellets ARE jelly — spilled on the floor, hoovered into the meter
const STOOL_SVG = '<svg viewBox="0 0 8 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0" width="6" height="1" fill="#111111"/><rect x="0" y="1" width="1" height="1" fill="#111111"/><rect x="1" y="1" width="6" height="1" fill="#8a5a2b"/><rect x="7" y="1" width="1" height="1" fill="#111111"/><rect x="1" y="2" width="6" height="1" fill="#111111"/><rect x="1" y="3" width="1" height="1" fill="#111111"/><rect x="2" y="3" width="1" height="1" fill="#8a5a2b"/><rect x="5" y="3" width="1" height="1" fill="#8a5a2b"/><rect x="6" y="3" width="1" height="1" fill="#111111"/><rect x="1" y="4" width="1" height="1" fill="#111111"/><rect x="2" y="4" width="1" height="1" fill="#8a5a2b"/><rect x="5" y="4" width="1" height="1" fill="#8a5a2b"/><rect x="6" y="4" width="1" height="1" fill="#111111"/><rect x="1" y="5" width="1" height="1" fill="#111111"/><rect x="2" y="5" width="4" height="1" fill="#8a5a2b"/><rect x="6" y="5" width="1" height="1" fill="#111111"/><rect x="1" y="6" width="1" height="1" fill="#111111"/><rect x="2" y="6" width="1" height="1" fill="#8a5a2b"/><rect x="5" y="6" width="1" height="1" fill="#8a5a2b"/><rect x="6" y="6" width="1" height="1" fill="#111111"/><rect x="1" y="7" width="1" height="1" fill="#111111"/><rect x="2" y="7" width="1" height="1" fill="#8a5a2b"/><rect x="5" y="7" width="1" height="1" fill="#8a5a2b"/><rect x="6" y="7" width="1" height="1" fill="#111111"/></svg>';
// THE MENU (Trym-approved list, 7 Jul): 10 conveyor items + 8 counter
// drinks — sprites authored in tools/floor-items-2.py on the banana grid.
const MENU_SVGS = {
  shard: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="0" width="1" height="1" fill="#78ebff"/><rect x="4" y="1" width="2" height="1" fill="#1e182c"/><rect x="3" y="2" width="1" height="1" fill="#1e182c"/><rect x="4" y="2" width="1" height="1" fill="#c8d8e8"/><rect x="5" y="2" width="1" height="1" fill="#ffffff"/><rect x="6" y="2" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="1" height="1" fill="#1e182c"/><rect x="4" y="3" width="2" height="1" fill="#c8d8e8"/><rect x="6" y="3" width="1" height="1" fill="#ffffff"/><rect x="7" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="1" height="1" fill="#1e182c"/><rect x="3" y="4" width="1" height="1" fill="#c8d8e8"/><rect x="4" y="4" width="1" height="1" fill="#ffffff"/><rect x="5" y="4" width="2" height="1" fill="#c8d8e8"/><rect x="7" y="4" width="1" height="1" fill="#1e182c"/><rect x="10" y="4" width="1" height="1" fill="#78ebff"/><rect x="2" y="5" width="1" height="1" fill="#1e182c"/><rect x="3" y="5" width="2" height="1" fill="#c8d8e8"/><rect x="5" y="5" width="1" height="1" fill="#8898b8"/><rect x="6" y="5" width="1" height="1" fill="#c8d8e8"/><rect x="7" y="5" width="1" height="1" fill="#ffffff"/><rect x="8" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#c8d8e8"/><rect x="3" y="6" width="1" height="1" fill="#ffffff"/><rect x="4" y="6" width="1" height="1" fill="#c8d8e8"/><rect x="5" y="6" width="1" height="1" fill="#8898b8"/><rect x="6" y="6" width="2" height="1" fill="#c8d8e8"/><rect x="8" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="3" height="1" fill="#c8d8e8"/><rect x="5" y="7" width="1" height="1" fill="#8898b8"/><rect x="6" y="7" width="2" height="1" fill="#c8d8e8"/><rect x="8" y="7" width="1" height="1" fill="#ffffff"/><rect x="9" y="7" width="1" height="1" fill="#1e182c"/><rect x="0" y="8" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#c8d8e8"/><rect x="2" y="8" width="1" height="1" fill="#ffffff"/><rect x="3" y="8" width="2" height="1" fill="#c8d8e8"/><rect x="5" y="8" width="2" height="1" fill="#8898b8"/><rect x="7" y="8" width="2" height="1" fill="#c8d8e8"/><rect x="9" y="8" width="1" height="1" fill="#1e182c"/><rect x="0" y="9" width="10" height="1" fill="#1e182c"/><rect x="0" y="10" width="1" height="1" fill="#78ebff"/></svg>',
  cone: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="0" width="2" height="1" fill="#1e182c"/><rect x="4" y="1" width="1" height="1" fill="#1e182c"/><rect x="5" y="1" width="2" height="1" fill="#ff8c28"/><rect x="7" y="1" width="1" height="1" fill="#1e182c"/><rect x="4" y="2" width="1" height="1" fill="#1e182c"/><rect x="5" y="2" width="1" height="1" fill="#ff8c28"/><rect x="6" y="2" width="1" height="1" fill="#c85f10"/><rect x="7" y="2" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="1" height="1" fill="#1e182c"/><rect x="4" y="3" width="2" height="1" fill="#ff8c28"/><rect x="6" y="3" width="1" height="1" fill="#c85f10"/><rect x="7" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="4" width="1" height="1" fill="#1e182c"/><rect x="4" y="4" width="4" height="1" fill="#fffdf5"/><rect x="8" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="1" height="1" fill="#1e182c"/><rect x="3" y="5" width="5" height="1" fill="#fffdf5"/><rect x="8" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="6" width="3" height="1" fill="#ff8c28"/><rect x="6" y="6" width="2" height="1" fill="#c85f10"/><rect x="8" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="4" height="1" fill="#ff8c28"/><rect x="6" y="7" width="2" height="1" fill="#c85f10"/><rect x="8" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="4" height="1" fill="#ff8c28"/><rect x="6" y="8" width="3" height="1" fill="#c85f10"/><rect x="9" y="8" width="1" height="1" fill="#1e182c"/><rect x="0" y="9" width="11" height="1" fill="#1e182c"/><rect x="0" y="10" width="1" height="1" fill="#1e182c"/><rect x="1" y="10" width="9" height="1" fill="#c85f10"/><rect x="10" y="10" width="1" height="1" fill="#1e182c"/><rect x="1" y="11" width="9" height="1" fill="#1e182c"/></svg>',
  popper: '<svg viewBox="0 0 10 14" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="0" width="1" height="1" fill="#78ebff"/><rect x="6" y="0" width="1" height="1" fill="#ff4d9d"/><rect x="1" y="1" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="1" width="1" height="1" fill="#fffdf5"/><rect x="5" y="1" width="1" height="1" fill="#78ebff"/><rect x="2" y="2" width="2" height="1" fill="#ff4d9d"/><rect x="4" y="2" width="1" height="1" fill="#78ebff"/><rect x="2" y="3" width="3" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="2" height="1" fill="#ffd23f"/><rect x="4" y="4" width="1" height="1" fill="#c88f10"/><rect x="5" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="2" height="1" fill="#ffd23f"/><rect x="4" y="5" width="1" height="1" fill="#c88f10"/><rect x="5" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="6" width="2" height="1" fill="#ffd23f"/><rect x="5" y="6" width="1" height="1" fill="#c88f10"/><rect x="6" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="2" height="1" fill="#ffd23f"/><rect x="5" y="7" width="1" height="1" fill="#c88f10"/><rect x="6" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="1" height="1" fill="#1e182c"/><rect x="4" y="8" width="1" height="1" fill="#ffd23f"/><rect x="5" y="8" width="1" height="1" fill="#c88f10"/><rect x="6" y="8" width="1" height="1" fill="#1e182c"/><rect x="3" y="9" width="1" height="1" fill="#1e182c"/><rect x="4" y="9" width="2" height="1" fill="#ffd23f"/><rect x="6" y="9" width="1" height="1" fill="#c88f10"/><rect x="7" y="9" width="1" height="1" fill="#1e182c"/><rect x="4" y="10" width="1" height="1" fill="#1e182c"/><rect x="5" y="10" width="1" height="1" fill="#ffd23f"/><rect x="6" y="10" width="1" height="1" fill="#c88f10"/><rect x="7" y="10" width="1" height="1" fill="#1e182c"/><rect x="4" y="11" width="1" height="1" fill="#1e182c"/><rect x="5" y="11" width="2" height="1" fill="#ffd23f"/><rect x="7" y="11" width="1" height="1" fill="#c88f10"/><rect x="8" y="11" width="1" height="1" fill="#1e182c"/><rect x="5" y="12" width="3" height="1" fill="#1e182c"/></svg>',
  remote: '<svg viewBox="0 0 10 14" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="0" width="2" height="1" fill="#1e182c"/><rect x="3" y="1" width="1" height="1" fill="#1e182c"/><rect x="4" y="1" width="1" height="1" fill="#78ebff"/><rect x="5" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="4" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="3" height="1" fill="#8890a8"/><rect x="5" y="3" width="1" height="1" fill="#5a6078"/><rect x="6" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="1" height="1" fill="#8890a8"/><rect x="3" y="4" width="2" height="1" fill="#e83b3b"/><rect x="5" y="4" width="1" height="1" fill="#8890a8"/><rect x="6" y="4" width="1" height="1" fill="#5a6078"/><rect x="7" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="1" height="1" fill="#8890a8"/><rect x="3" y="5" width="2" height="1" fill="#e83b3b"/><rect x="5" y="5" width="1" height="1" fill="#8890a8"/><rect x="6" y="5" width="1" height="1" fill="#5a6078"/><rect x="7" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="4" height="1" fill="#8890a8"/><rect x="6" y="6" width="1" height="1" fill="#5a6078"/><rect x="7" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#8890a8"/><rect x="3" y="7" width="2" height="1" fill="#fffdf5"/><rect x="5" y="7" width="1" height="1" fill="#8890a8"/><rect x="6" y="7" width="1" height="1" fill="#5a6078"/><rect x="7" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="4" height="1" fill="#8890a8"/><rect x="6" y="8" width="1" height="1" fill="#5a6078"/><rect x="7" y="8" width="1" height="1" fill="#1e182c"/><rect x="1" y="9" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="1" height="1" fill="#8890a8"/><rect x="3" y="9" width="2" height="1" fill="#fffdf5"/><rect x="5" y="9" width="1" height="1" fill="#8890a8"/><rect x="6" y="9" width="1" height="1" fill="#5a6078"/><rect x="7" y="9" width="1" height="1" fill="#1e182c"/><rect x="1" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="10" width="4" height="1" fill="#8890a8"/><rect x="6" y="10" width="1" height="1" fill="#5a6078"/><rect x="7" y="10" width="1" height="1" fill="#1e182c"/><rect x="1" y="11" width="1" height="1" fill="#1e182c"/><rect x="2" y="11" width="5" height="1" fill="#5a6078"/><rect x="7" y="11" width="1" height="1" fill="#1e182c"/><rect x="2" y="12" width="5" height="1" fill="#1e182c"/></svg>',
  kazoo: '<svg viewBox="0 0 14 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="0" width="3" height="1" fill="#1e182c"/><rect x="3" y="1" width="1" height="1" fill="#1e182c"/><rect x="4" y="1" width="3" height="1" fill="#ff4d9d"/><rect x="7" y="1" width="1" height="1" fill="#1e182c"/><rect x="0" y="2" width="4" height="1" fill="#1e182c"/><rect x="4" y="2" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="2" width="1" height="1" fill="#fffdf5"/><rect x="6" y="2" width="1" height="1" fill="#ff4d9d"/><rect x="7" y="2" width="4" height="1" fill="#1e182c"/><rect x="0" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="3" height="1" fill="#ffd23f"/><rect x="4" y="3" width="3" height="1" fill="#ff4d9d"/><rect x="7" y="3" width="3" height="1" fill="#ffd23f"/><rect x="10" y="3" width="1" height="1" fill="#c88f10"/><rect x="11" y="3" width="1" height="1" fill="#1e182c"/><rect x="0" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="9" height="1" fill="#ffd23f"/><rect x="10" y="4" width="2" height="1" fill="#c88f10"/><rect x="12" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="7" height="1" fill="#ffd23f"/><rect x="9" y="5" width="2" height="1" fill="#c88f10"/><rect x="11" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="9" height="1" fill="#1e182c"/></svg>',
  glitter: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="0" width="1" height="1" fill="#1e182c"/><rect x="7" y="0" width="1" height="1" fill="#ffd23f"/><rect x="5" y="1" width="1" height="1" fill="#1e182c"/><rect x="6" y="1" width="1" height="1" fill="#fffdf5"/><rect x="7" y="1" width="1" height="1" fill="#1e182c"/><rect x="0" y="2" width="1" height="1" fill="#ffd23f"/><rect x="4" y="2" width="2" height="1" fill="#1e182c"/><rect x="3" y="3" width="1" height="1" fill="#1e182c"/><rect x="4" y="3" width="2" height="1" fill="#b388ff"/><rect x="6" y="3" width="1" height="1" fill="#1e182c"/><rect x="9" y="3" width="1" height="1" fill="#ffd23f"/><rect x="2" y="4" width="1" height="1" fill="#1e182c"/><rect x="3" y="4" width="1" height="1" fill="#b388ff"/><rect x="4" y="4" width="1" height="1" fill="#fffdf5"/><rect x="5" y="4" width="2" height="1" fill="#b388ff"/><rect x="7" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="1" height="1" fill="#b388ff"/><rect x="3" y="5" width="1" height="1" fill="#fffdf5"/><rect x="4" y="5" width="3" height="1" fill="#b388ff"/><rect x="7" y="5" width="1" height="1" fill="#7a55c8"/><rect x="8" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="3" height="1" fill="#b388ff"/><rect x="5" y="6" width="1" height="1" fill="#ffd23f"/><rect x="6" y="6" width="1" height="1" fill="#b388ff"/><rect x="7" y="6" width="1" height="1" fill="#7a55c8"/><rect x="8" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="2" height="1" fill="#b388ff"/><rect x="4" y="7" width="1" height="1" fill="#ffd23f"/><rect x="5" y="7" width="2" height="1" fill="#b388ff"/><rect x="7" y="7" width="1" height="1" fill="#7a55c8"/><rect x="8" y="7" width="1" height="1" fill="#1e182c"/><rect x="10" y="7" width="1" height="1" fill="#ffd23f"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="4" height="1" fill="#b388ff"/><rect x="6" y="8" width="2" height="1" fill="#7a55c8"/><rect x="8" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="1" height="1" fill="#1e182c"/><rect x="3" y="9" width="2" height="1" fill="#b388ff"/><rect x="5" y="9" width="2" height="1" fill="#7a55c8"/><rect x="7" y="9" width="1" height="1" fill="#1e182c"/><rect x="0" y="10" width="1" height="1" fill="#ffd23f"/><rect x="3" y="10" width="4" height="1" fill="#1e182c"/></svg>',
  phone: '<svg viewBox="0 0 10 14" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="1" height="1" fill="#ffffff"/><rect x="5" y="0" width="1" height="1" fill="#ffffff"/><rect x="1" y="1" width="1" height="1" fill="#ffffff"/><rect x="3" y="1" width="2" height="1" fill="#ffffff"/><rect x="2" y="2" width="1" height="1" fill="#ffffff"/><rect x="3" y="2" width="2" height="1" fill="#1e182c"/><rect x="5" y="2" width="1" height="1" fill="#ffffff"/><rect x="2" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="2" height="1" fill="#3a3f58"/><rect x="5" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="1" height="1" fill="#3a3f58"/><rect x="3" y="4" width="2" height="1" fill="#78ebff"/><rect x="5" y="4" width="1" height="1" fill="#3a3f58"/><rect x="6" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="1" height="1" fill="#3a3f58"/><rect x="3" y="5" width="2" height="1" fill="#78ebff"/><rect x="5" y="5" width="1" height="1" fill="#3a3f58"/><rect x="6" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#3a3f58"/><rect x="3" y="6" width="2" height="1" fill="#78ebff"/><rect x="5" y="6" width="1" height="1" fill="#3a3f58"/><rect x="6" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#3a3f58"/><rect x="3" y="7" width="2" height="1" fill="#78ebff"/><rect x="5" y="7" width="1" height="1" fill="#3a3f58"/><rect x="6" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#3a3f58"/><rect x="3" y="8" width="2" height="1" fill="#78ebff"/><rect x="5" y="8" width="1" height="1" fill="#3a3f58"/><rect x="6" y="8" width="1" height="1" fill="#1e182c"/><rect x="1" y="9" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="1" height="1" fill="#3a3f58"/><rect x="3" y="9" width="2" height="1" fill="#252a40"/><rect x="5" y="9" width="1" height="1" fill="#3a3f58"/><rect x="6" y="9" width="1" height="1" fill="#1e182c"/><rect x="1" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="10" width="1" height="1" fill="#3a3f58"/><rect x="3" y="10" width="1" height="1" fill="#ffffff"/><rect x="4" y="10" width="2" height="1" fill="#3a3f58"/><rect x="6" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="11" width="4" height="1" fill="#1e182c"/></svg>',
  cube: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0" width="8" height="1" fill="#4db8ff"/><rect x="0" y="1" width="1" height="1" fill="#4db8ff"/><rect x="1" y="1" width="1" height="1" fill="#ffffff"/><rect x="2" y="1" width="6" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="8" y="1" width="1" height="1" fill="#78ebff" opacity="0.55"/><rect x="9" y="1" width="1" height="1" fill="#4db8ff"/><rect x="0" y="2" width="1" height="1" fill="#4db8ff"/><rect x="1" y="2" width="1" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="2" y="2" width="1" height="1" fill="#ffffff"/><rect x="3" y="2" width="3" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="6" y="2" width="3" height="1" fill="#78ebff" opacity="0.55"/><rect x="9" y="2" width="1" height="1" fill="#4db8ff"/><rect x="0" y="3" width="1" height="1" fill="#4db8ff"/><rect x="1" y="3" width="3" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="4" y="3" width="5" height="1" fill="#78ebff" opacity="0.55"/><rect x="9" y="3" width="1" height="1" fill="#4db8ff"/><rect x="0" y="4" width="1" height="1" fill="#4db8ff"/><rect x="1" y="4" width="2" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="3" y="4" width="6" height="1" fill="#78ebff" opacity="0.55"/><rect x="9" y="4" width="1" height="1" fill="#4db8ff"/><rect x="0" y="5" width="1" height="1" fill="#4db8ff"/><rect x="1" y="5" width="1" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="2" y="5" width="6" height="1" fill="#78ebff" opacity="0.55"/><rect x="8" y="5" width="1" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="9" y="5" width="1" height="1" fill="#4db8ff"/><rect x="0" y="6" width="1" height="1" fill="#4db8ff"/><rect x="1" y="6" width="1" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="2" y="6" width="5" height="1" fill="#78ebff" opacity="0.55"/><rect x="7" y="6" width="2" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="9" y="6" width="1" height="1" fill="#4db8ff"/><rect x="0" y="7" width="1" height="1" fill="#4db8ff"/><rect x="1" y="7" width="5" height="1" fill="#78ebff" opacity="0.55"/><rect x="6" y="7" width="2" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="8" y="7" width="1" height="1" fill="#ffffff"/><rect x="9" y="7" width="1" height="1" fill="#4db8ff"/><rect x="0" y="8" width="1" height="1" fill="#4db8ff"/><rect x="1" y="8" width="4" height="1" fill="#78ebff" opacity="0.55"/><rect x="5" y="8" width="4" height="1" fill="#b9f4ff" opacity="0.75"/><rect x="9" y="8" width="1" height="1" fill="#4db8ff"/><rect x="1" y="9" width="8" height="1" fill="#4db8ff"/></svg>',
  pizzabox: '<svg viewBox="0 0 16 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="11" height="1" fill="#1e182c"/><rect x="1" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="1" width="11" height="1" fill="#dea85c"/><rect x="13" y="1" width="1" height="1" fill="#1e182c"/><rect x="0" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="2" height="1" fill="#dea85c"/><rect x="3" y="2" width="1" height="1" fill="#c82828"/><rect x="4" y="2" width="1" height="1" fill="#ffe135"/><rect x="5" y="2" width="1" height="1" fill="#c82828"/><rect x="6" y="2" width="3" height="1" fill="#dea85c"/><rect x="9" y="2" width="1" height="1" fill="#c82828"/><rect x="10" y="2" width="1" height="1" fill="#ffe135"/><rect x="11" y="2" width="1" height="1" fill="#c82828"/><rect x="12" y="2" width="2" height="1" fill="#dea85c"/><rect x="14" y="2" width="1" height="1" fill="#1e182c"/><rect x="0" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="2" height="1" fill="#dea85c"/><rect x="3" y="3" width="1" height="1" fill="#ffe135"/><rect x="4" y="3" width="1" height="1" fill="#c82828"/><rect x="5" y="3" width="1" height="1" fill="#ffe135"/><rect x="6" y="3" width="3" height="1" fill="#dea85c"/><rect x="9" y="3" width="1" height="1" fill="#ffe135"/><rect x="10" y="3" width="1" height="1" fill="#c82828"/><rect x="11" y="3" width="1" height="1" fill="#ffe135"/><rect x="12" y="3" width="2" height="1" fill="#dea85c"/><rect x="14" y="3" width="1" height="1" fill="#1e182c"/><rect x="0" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="12" height="1" fill="#dea85c"/><rect x="13" y="4" width="1" height="1" fill="#b47c3c"/><rect x="14" y="4" width="1" height="1" fill="#1e182c"/><rect x="0" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#dea85c"/><rect x="2" y="5" width="12" height="1" fill="#b47c3c"/><rect x="14" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="13" height="1" fill="#1e182c"/></svg>',
  wand: '<svg viewBox="0 0 10 16" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="3" height="1" fill="#78ebff"/><rect x="1" y="1" width="1" height="1" fill="#78ebff"/><rect x="2" y="1" width="2" height="1" fill="#b9f4ff" opacity="0.6"/><rect x="4" y="1" width="1" height="1" fill="#ffffff"/><rect x="5" y="1" width="1" height="1" fill="#78ebff"/><rect x="1" y="2" width="1" height="1" fill="#78ebff"/><rect x="2" y="2" width="3" height="1" fill="#b9f4ff" opacity="0.6"/><rect x="5" y="2" width="1" height="1" fill="#78ebff"/><rect x="1" y="3" width="1" height="1" fill="#78ebff"/><rect x="2" y="3" width="3" height="1" fill="#b9f4ff" opacity="0.6"/><rect x="5" y="3" width="1" height="1" fill="#78ebff"/><rect x="2" y="4" width="3" height="1" fill="#78ebff"/><rect x="3" y="5" width="2" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="6" width="2" height="1" fill="#78ebff"/><rect x="5" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#78ebff"/><rect x="5" y="7" width="1" height="1" fill="#78ebff"/><rect x="6" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#78ebff"/><rect x="5" y="8" width="1" height="1" fill="#78ebff"/><rect x="6" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="1" height="1" fill="#1e182c"/><rect x="3" y="9" width="2" height="1" fill="#78ebff"/><rect x="5" y="9" width="1" height="1" fill="#1e182c"/><rect x="3" y="10" width="1" height="1" fill="#1e182c"/><rect x="4" y="10" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="10" width="1" height="1" fill="#1e182c"/><rect x="3" y="11" width="1" height="1" fill="#1e182c"/><rect x="4" y="11" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="11" width="1" height="1" fill="#1e182c"/><rect x="3" y="12" width="1" height="1" fill="#1e182c"/><rect x="4" y="12" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="12" width="1" height="1" fill="#1e182c"/><rect x="3" y="13" width="1" height="1" fill="#1e182c"/><rect x="4" y="13" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="13" width="1" height="1" fill="#1e182c"/><rect x="4" y="14" width="1" height="1" fill="#1e182c"/></svg>',
  espresso: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="9" height="1" fill="#1e182c"/><rect x="1" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="1" width="2" height="1" fill="#b8874a"/><rect x="4" y="1" width="1" height="1" fill="#2e1a0a"/><rect x="5" y="1" width="2" height="1" fill="#b8874a"/><rect x="7" y="1" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="1" height="1" fill="#fffdf5"/><rect x="3" y="2" width="4" height="1" fill="#5a3a1e"/><rect x="7" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="2" height="1" fill="#5a3a1e"/><rect x="5" y="3" width="1" height="1" fill="#2e1a0a"/><rect x="6" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="4" width="1" height="1" fill="#1e182c"/><rect x="4" y="4" width="1" height="1" fill="#5a3a1e"/><rect x="5" y="4" width="1" height="1" fill="#1e182c"/><rect x="4" y="5" width="1" height="1" fill="#1e182c"/><rect x="4" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="3" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="3" height="1" fill="#ffd23f"/><rect x="6" y="8" width="1" height="1" fill="#1e182c"/></svg>',
  lagoon: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="0" width="1" height="1" fill="#ff4d9d"/><rect x="4" y="1" width="1" height="1" fill="#ff4d9d"/><rect x="1" y="2" width="3" height="1" fill="#1e182c"/><rect x="4" y="2" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="2" width="2" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="2" height="1" fill="#78ebff"/><rect x="4" y="3" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="3" width="1" height="1" fill="#78ebff"/><rect x="6" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="1" height="1" fill="#4db8ff"/><rect x="3" y="4" width="1" height="1" fill="#78ebff"/><rect x="4" y="4" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="4" width="1" height="1" fill="#4db8ff"/><rect x="6" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="4" height="1" fill="#4db8ff"/><rect x="6" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="4" height="1" fill="#4db8ff"/><rect x="6" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="4" height="1" fill="#4db8ff"/><rect x="6" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="4" height="1" fill="#1e182c"/></svg>',
  colada: '<svg viewBox="0 0 10 11" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="0" width="2" height="1" fill="#58c05c"/><rect x="2" y="1" width="1" height="1" fill="#e83b3b"/><rect x="4" y="1" width="2" height="1" fill="#58c05c"/><rect x="1" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="1" height="1" fill="#e83b3b"/><rect x="3" y="2" width="1" height="1" fill="#1e182c"/><rect x="4" y="2" width="1" height="1" fill="#ffe135"/><rect x="5" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="2" height="1" fill="#1e182c"/><rect x="3" y="3" width="2" height="1" fill="#fff6c8"/><rect x="5" y="3" width="2" height="1" fill="#1e182c"/><rect x="0" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#fff6c8"/><rect x="2" y="4" width="1" height="1" fill="#fffdf5"/><rect x="3" y="4" width="4" height="1" fill="#fff6c8"/><rect x="7" y="4" width="1" height="1" fill="#1e182c"/><rect x="0" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="6" height="1" fill="#fff6c8"/><rect x="7" y="5" width="1" height="1" fill="#1e182c"/><rect x="0" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="6" height="1" fill="#fff6c8"/><rect x="7" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="4" height="1" fill="#fff6c8"/><rect x="6" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="4" height="1" fill="#1e182c"/><rect x="2" y="9" width="4" height="1" fill="#1e182c"/></svg>',
  margarita: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1" height="1" fill="#ffffff"/><rect x="1" y="0" width="1" height="1" fill="#1e182c"/><rect x="2" y="0" width="1" height="1" fill="#ffffff"/><rect x="3" y="0" width="1" height="1" fill="#1e182c"/><rect x="4" y="0" width="1" height="1" fill="#ffffff"/><rect x="5" y="0" width="1" height="1" fill="#1e182c"/><rect x="6" y="0" width="1" height="1" fill="#ffffff"/><rect x="7" y="0" width="1" height="1" fill="#1e182c"/><rect x="8" y="0" width="1" height="1" fill="#ffffff"/><rect x="0" y="1" width="1" height="1" fill="#1e182c"/><rect x="1" y="1" width="7" height="1" fill="#8ce858"/><rect x="8" y="1" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="2" height="1" fill="#8ce858"/><rect x="4" y="2" width="1" height="1" fill="#d8f890"/><rect x="5" y="2" width="2" height="1" fill="#8ce858"/><rect x="7" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="3" height="1" fill="#8ce858"/><rect x="6" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="4" width="1" height="1" fill="#1e182c"/><rect x="4" y="4" width="1" height="1" fill="#8ce858"/><rect x="5" y="4" width="1" height="1" fill="#1e182c"/><rect x="4" y="5" width="1" height="1" fill="#1e182c"/><rect x="4" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="3" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="3" height="1" fill="#ffffff"/><rect x="6" y="8" width="1" height="1" fill="#1e182c"/></svg>',
  champagne: '<svg viewBox="0 0 10 11" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="0" width="1" height="1" fill="#ffffff"/><rect x="2" y="1" width="1" height="1" fill="#ffffff"/><rect x="4" y="1" width="1" height="1" fill="#ffffff"/><rect x="1" y="2" width="2" height="1" fill="#1e182c"/><rect x="3" y="2" width="1" height="1" fill="#fff6c8"/><rect x="4" y="2" width="2" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#fff6c8"/><rect x="3" y="3" width="1" height="1" fill="#ffd23f"/><rect x="4" y="3" width="1" height="1" fill="#ffffff"/><rect x="5" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="3" height="1" fill="#ffd23f"/><rect x="5" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="3" height="1" fill="#ffd23f"/><rect x="5" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="6" width="1" height="1" fill="#ffd23f"/><rect x="4" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="3" height="1" fill="#1e182c"/></svg>',
  milkshake: '<svg viewBox="0 0 10 11" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="0" width="1" height="1" fill="#1e182c"/><rect x="5" y="0" width="1" height="1" fill="#e83b3b"/><rect x="3" y="1" width="1" height="1" fill="#1e182c"/><rect x="4" y="1" width="1" height="1" fill="#fffdf5"/><rect x="5" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="1" height="1" fill="#1e182c"/><rect x="3" y="2" width="1" height="1" fill="#fff6c8"/><rect x="4" y="2" width="1" height="1" fill="#fffdf5"/><rect x="5" y="2" width="1" height="1" fill="#fff6c8"/><rect x="6" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#fff6c8"/><rect x="3" y="3" width="1" height="1" fill="#fffdf5"/><rect x="4" y="3" width="3" height="1" fill="#fff6c8"/><rect x="7" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="7" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="2" height="1" fill="#ff9ec8"/><rect x="4" y="5" width="1" height="1" fill="#fff6c8"/><rect x="5" y="5" width="2" height="1" fill="#ff9ec8"/><rect x="7" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#ff9ec8"/><rect x="3" y="6" width="1" height="1" fill="#fff6c8"/><rect x="4" y="6" width="3" height="1" fill="#ff9ec8"/><rect x="7" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="4" height="1" fill="#ff9ec8"/><rect x="6" y="7" width="2" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="3" height="1" fill="#ff9ec8"/><rect x="6" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="5" height="1" fill="#1e182c"/></svg>',
  jellyshot: '<svg viewBox="0 0 10 7" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0" width="6" height="1" fill="#1e182c"/><rect x="1" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="1" width="1" height="1" fill="#ffffff"/><rect x="3" y="1" width="3" height="1" fill="#ff4d9d"/><rect x="6" y="1" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="2" height="1" fill="#ff4d9d"/><rect x="4" y="2" width="1" height="1" fill="#c62c74"/><rect x="5" y="2" width="1" height="1" fill="#ff4d9d"/><rect x="6" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="3" width="1" height="1" fill="#c62c74"/><rect x="4" y="3" width="2" height="1" fill="#ff4d9d"/><rect x="6" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="4" height="1" fill="#c62c74"/><rect x="6" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="4" height="1" fill="#1e182c"/></svg>',
  water: '<svg viewBox="0 0 10 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0" width="1" height="1" fill="#8898b8"/><rect x="6" y="0" width="1" height="1" fill="#8898b8"/><rect x="1" y="1" width="1" height="1" fill="#8898b8"/><rect x="2" y="1" width="1" height="1" fill="#ffffff"/><rect x="3" y="1" width="3" height="1" fill="#b9f4ff" opacity="0.5"/><rect x="6" y="1" width="1" height="1" fill="#8898b8"/><rect x="1" y="2" width="1" height="1" fill="#8898b8"/><rect x="2" y="2" width="4" height="1" fill="#b9f4ff" opacity="0.5"/><rect x="6" y="2" width="1" height="1" fill="#8898b8"/><rect x="1" y="3" width="1" height="1" fill="#8898b8"/><rect x="2" y="3" width="4" height="1" fill="#b9f4ff" opacity="0.5"/><rect x="6" y="3" width="1" height="1" fill="#8898b8"/><rect x="1" y="4" width="1" height="1" fill="#8898b8"/><rect x="2" y="4" width="4" height="1" fill="#b9f4ff" opacity="0.5"/><rect x="6" y="4" width="1" height="1" fill="#8898b8"/><rect x="1" y="5" width="1" height="1" fill="#8898b8"/><rect x="2" y="5" width="3" height="1" fill="#b9f4ff" opacity="0.5"/><rect x="5" y="5" width="1" height="1" fill="#ffffff"/><rect x="6" y="5" width="1" height="1" fill="#8898b8"/><rect x="2" y="6" width="4" height="1" fill="#8898b8"/></svg>',
};
// conveyor sprites from the menu (drinks pour at the counter instead)
// — assigned here because MENU_SVGS must exist first
// eslint-disable-next-line no-use-before-define
Object.assign(ITEM_SVGS, {
  shard: MENU_SVGS.shard, cone: MENU_SVGS.cone, popper: MENU_SVGS.popper, remote: MENU_SVGS.remote,
  kazoo: MENU_SVGS.kazoo, glitter: MENU_SVGS.glitter, phone: MENU_SVGS.phone, cube: MENU_SVGS.cube,
  pizzabox: MENU_SVGS.pizzabox, wand: MENU_SVGS.wand,
});
// R4.5 conveyor items (Trym: "build all of them") — sprites authored in
// scratchpad floor-items-3.py, Pillow-verified on the floor colour
Object.assign(ITEM_SVGS, {
  boots: '<svg viewBox="0 0 12 10" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="4" height="1" fill="#1e182c"/><rect x="2" y="1" width="1" height="1" fill="#1e182c"/><rect x="3" y="1" width="1" height="1" fill="#fffdf5"/><rect x="4" y="1" width="1" height="1" fill="#c8d8e8"/><rect x="5" y="1" width="1" height="1" fill="#fffdf5"/><rect x="6" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="1" height="1" fill="#1e182c"/><rect x="3" y="2" width="1" height="1" fill="#fffdf5"/><rect x="4" y="2" width="1" height="1" fill="#c8d8e8"/><rect x="5" y="2" width="1" height="1" fill="#fffdf5"/><rect x="6" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="3" height="1" fill="#8898b8"/><rect x="6" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="1" height="1" fill="#1e182c"/><rect x="3" y="4" width="1" height="1" fill="#fffdf5"/><rect x="4" y="4" width="1" height="1" fill="#c8d8e8"/><rect x="5" y="4" width="1" height="1" fill="#fffdf5"/><rect x="6" y="4" width="3" height="1" fill="#1e182c"/><rect x="2" y="5" width="1" height="1" fill="#1e182c"/><rect x="3" y="5" width="1" height="1" fill="#fffdf5"/><rect x="4" y="5" width="1" height="1" fill="#c8d8e8"/><rect x="5" y="5" width="4" height="1" fill="#fffdf5"/><rect x="9" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="6" width="7" height="1" fill="#fffdf5"/><rect x="10" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="8" height="1" fill="#78ebff"/><rect x="10" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#78ebff"/><rect x="3" y="8" width="1" height="1" fill="#fffdf5"/><rect x="4" y="8" width="4" height="1" fill="#78ebff"/><rect x="8" y="8" width="1" height="1" fill="#fffdf5"/><rect x="9" y="8" width="1" height="1" fill="#78ebff"/><rect x="10" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="8" height="1" fill="#1e182c"/></svg>',
  gel: '<svg viewBox="0 0 12 9" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="0" width="6" height="1" fill="#1e182c"/><rect x="2" y="1" width="1" height="1" fill="#1e182c"/><rect x="3" y="1" width="2" height="1" fill="#b6f0b0"/><rect x="5" y="1" width="4" height="1" fill="#58c05c"/><rect x="9" y="1" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="2" height="1" fill="#b6f0b0"/><rect x="4" y="2" width="6" height="1" fill="#58c05c"/><rect x="10" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#b6f0b0"/><rect x="3" y="3" width="7" height="1" fill="#58c05c"/><rect x="10" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="8" height="1" fill="#58c05c"/><rect x="10" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="7" height="1" fill="#58c05c"/><rect x="9" y="5" width="1" height="1" fill="#2f8f3c"/><rect x="10" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="6" height="1" fill="#58c05c"/><rect x="8" y="6" width="2" height="1" fill="#2f8f3c"/><rect x="10" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="2" height="1" fill="#2f8f3c"/><rect x="4" y="7" width="3" height="1" fill="#58c05c"/><rect x="7" y="7" width="3" height="1" fill="#2f8f3c"/><rect x="10" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="8" height="1" fill="#1e182c"/></svg>',
  sparkler: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="0" width="1" height="1" fill="#ffffff"/><rect x="7" y="0" width="1" height="1" fill="#ffe135"/><rect x="2" y="1" width="1" height="1" fill="#ffe135"/><rect x="4" y="1" width="1" height="1" fill="#ffffff"/><rect x="5" y="1" width="1" height="1" fill="#ffe135"/><rect x="6" y="1" width="1" height="1" fill="#ffffff"/><rect x="3" y="2" width="1" height="1" fill="#ffffff"/><rect x="4" y="2" width="1" height="1" fill="#ffe135"/><rect x="5" y="2" width="1" height="1" fill="#ffffff"/><rect x="6" y="2" width="1" height="1" fill="#ffe135"/><rect x="7" y="2" width="1" height="1" fill="#ffffff"/><rect x="10" y="2" width="1" height="1" fill="#ffe135"/><rect x="1" y="3" width="1" height="1" fill="#ffe135"/><rect x="3" y="3" width="1" height="1" fill="#ffe135"/><rect x="4" y="3" width="1" height="1" fill="#ffffff"/><rect x="5" y="3" width="1" height="1" fill="#fffdf5"/><rect x="6" y="3" width="1" height="1" fill="#ffffff"/><rect x="7" y="3" width="1" height="1" fill="#ffe135"/><rect x="2" y="4" width="1" height="1" fill="#ffffff"/><rect x="3" y="4" width="1" height="1" fill="#ffe135"/><rect x="4" y="4" width="1" height="1" fill="#ffffff"/><rect x="5" y="4" width="1" height="1" fill="#fffdf5"/><rect x="6" y="4" width="1" height="1" fill="#ffffff"/><rect x="7" y="4" width="1" height="1" fill="#ffe135"/><rect x="8" y="4" width="1" height="1" fill="#ffffff"/><rect x="3" y="5" width="1" height="1" fill="#ffe135"/><rect x="4" y="5" width="1" height="1" fill="#ffffff"/><rect x="5" y="5" width="1" height="1" fill="#ffe135"/><rect x="6" y="5" width="1" height="1" fill="#ffffff"/><rect x="7" y="5" width="1" height="1" fill="#ffe135"/><rect x="2" y="6" width="1" height="1" fill="#ffe135"/><rect x="4" y="6" width="1" height="1" fill="#ffffff"/><rect x="5" y="6" width="1" height="1" fill="#ffe135"/><rect x="6" y="6" width="1" height="1" fill="#ffffff"/><rect x="9" y="6" width="1" height="1" fill="#ffe135"/><rect x="5" y="7" width="1" height="1" fill="#1e182c"/><rect x="5" y="8" width="1" height="1" fill="#1e182c"/><rect x="5" y="9" width="1" height="1" fill="#8a5a2b"/><rect x="5" y="10" width="1" height="1" fill="#8a5a2b"/><rect x="5" y="11" width="1" height="1" fill="#8a5a2b"/></svg>',
  magnet: '<svg viewBox="0 0 12 10" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="3" height="1" fill="#1e182c"/><rect x="7" y="0" width="3" height="1" fill="#1e182c"/><rect x="1" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="1" width="3" height="1" fill="#e83b3b"/><rect x="5" y="1" width="1" height="1" fill="#1e182c"/><rect x="7" y="1" width="1" height="1" fill="#1e182c"/><rect x="8" y="1" width="3" height="1" fill="#e83b3b"/><rect x="11" y="1" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="2" width="3" height="1" fill="#e83b3b"/><rect x="5" y="2" width="1" height="1" fill="#1e182c"/><rect x="7" y="2" width="1" height="1" fill="#1e182c"/><rect x="8" y="2" width="3" height="1" fill="#e83b3b"/><rect x="11" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="3" height="1" fill="#fffdf5"/><rect x="5" y="3" width="1" height="1" fill="#1e182c"/><rect x="7" y="3" width="1" height="1" fill="#1e182c"/><rect x="8" y="3" width="3" height="1" fill="#fffdf5"/><rect x="11" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="3" height="1" fill="#e83b3b"/><rect x="5" y="4" width="1" height="1" fill="#1e182c"/><rect x="7" y="4" width="1" height="1" fill="#1e182c"/><rect x="8" y="4" width="3" height="1" fill="#e83b3b"/><rect x="11" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="3" height="1" fill="#e83b3b"/><rect x="5" y="5" width="3" height="1" fill="#1e182c"/><rect x="8" y="5" width="3" height="1" fill="#e83b3b"/><rect x="11" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="9" height="1" fill="#e83b3b"/><rect x="11" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#a62026"/><rect x="3" y="7" width="7" height="1" fill="#e83b3b"/><rect x="10" y="7" width="1" height="1" fill="#a62026"/><rect x="11" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="2" height="1" fill="#a62026"/><rect x="5" y="8" width="3" height="1" fill="#e83b3b"/><rect x="8" y="8" width="2" height="1" fill="#a62026"/><rect x="10" y="8" width="1" height="1" fill="#1e182c"/><rect x="3" y="9" width="7" height="1" fill="#1e182c"/></svg>',
  vhs: '<svg viewBox="0 0 12 9" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="12" height="1" fill="#1e182c"/><rect x="0" y="1" width="1" height="1" fill="#1e182c"/><rect x="1" y="1" width="10" height="1" fill="#111111"/><rect x="11" y="1" width="1" height="1" fill="#1e182c"/><rect x="0" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="1" height="1" fill="#111111"/><rect x="2" y="2" width="8" height="1" fill="#ff4d9d"/><rect x="10" y="2" width="1" height="1" fill="#111111"/><rect x="11" y="2" width="1" height="1" fill="#1e182c"/><rect x="0" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="10" height="1" fill="#111111"/><rect x="11" y="3" width="1" height="1" fill="#1e182c"/><rect x="0" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#111111"/><rect x="2" y="4" width="1" height="1" fill="#3a304c"/><rect x="3" y="4" width="1" height="1" fill="#fffdf5"/><rect x="4" y="4" width="1" height="1" fill="#3a304c"/><rect x="5" y="4" width="2" height="1" fill="#111111"/><rect x="7" y="4" width="1" height="1" fill="#3a304c"/><rect x="8" y="4" width="1" height="1" fill="#fffdf5"/><rect x="9" y="4" width="1" height="1" fill="#3a304c"/><rect x="10" y="4" width="1" height="1" fill="#111111"/><rect x="11" y="4" width="1" height="1" fill="#1e182c"/><rect x="0" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#111111"/><rect x="2" y="5" width="1" height="1" fill="#3a304c"/><rect x="3" y="5" width="1" height="1" fill="#111111"/><rect x="4" y="5" width="1" height="1" fill="#3a304c"/><rect x="5" y="5" width="2" height="1" fill="#111111"/><rect x="7" y="5" width="1" height="1" fill="#3a304c"/><rect x="8" y="5" width="1" height="1" fill="#111111"/><rect x="9" y="5" width="1" height="1" fill="#3a304c"/><rect x="10" y="5" width="1" height="1" fill="#111111"/><rect x="11" y="5" width="1" height="1" fill="#1e182c"/><rect x="0" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="10" height="1" fill="#111111"/><rect x="11" y="6" width="1" height="1" fill="#1e182c"/><rect x="0" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="2" height="1" fill="#111111"/><rect x="3" y="7" width="6" height="1" fill="#fffdf5"/><rect x="9" y="7" width="2" height="1" fill="#111111"/><rect x="11" y="7" width="1" height="1" fill="#1e182c"/><rect x="0" y="8" width="12" height="1" fill="#1e182c"/></svg>',
  star: '<svg viewBox="0 0 12 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="0" width="2" height="1" fill="#1e182c"/><rect x="4" y="1" width="1" height="1" fill="#1e182c"/><rect x="5" y="1" width="2" height="1" fill="#ffd23f"/><rect x="7" y="1" width="1" height="1" fill="#1e182c"/><rect x="4" y="2" width="1" height="1" fill="#1e182c"/><rect x="5" y="2" width="2" height="1" fill="#ffd23f"/><rect x="7" y="2" width="1" height="1" fill="#1e182c"/><rect x="0" y="3" width="5" height="1" fill="#1e182c"/><rect x="5" y="3" width="2" height="1" fill="#ffd23f"/><rect x="7" y="3" width="5" height="1" fill="#1e182c"/><rect x="0" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="10" height="1" fill="#ffd23f"/><rect x="11" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="8" height="1" fill="#ffd23f"/><rect x="10" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#1e182c"/><rect x="3" y="6" width="6" height="1" fill="#ffd23f"/><rect x="9" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="6" height="1" fill="#ffd23f"/><rect x="9" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="3" height="1" fill="#ffd23f"/><rect x="5" y="8" width="2" height="1" fill="#1e182c"/><rect x="7" y="8" width="3" height="1" fill="#ffd23f"/><rect x="10" y="8" width="1" height="1" fill="#1e182c"/><rect x="1" y="9" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="1" height="1" fill="#ffd23f"/><rect x="3" y="9" width="1" height="1" fill="#e6a817"/><rect x="4" y="9" width="1" height="1" fill="#1e182c"/><rect x="7" y="9" width="1" height="1" fill="#1e182c"/><rect x="8" y="9" width="1" height="1" fill="#e6a817"/><rect x="9" y="9" width="1" height="1" fill="#ffd23f"/><rect x="10" y="9" width="1" height="1" fill="#1e182c"/><rect x="1" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="10" width="1" height="1" fill="#e6a817"/><rect x="3" y="10" width="1" height="1" fill="#1e182c"/><rect x="8" y="10" width="1" height="1" fill="#1e182c"/><rect x="9" y="10" width="1" height="1" fill="#e6a817"/><rect x="10" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="11" width="1" height="1" fill="#1e182c"/><rect x="9" y="11" width="1" height="1" fill="#1e182c"/></svg>',
});
// the smoke poof: unclaimed items vanish with it; so do leaving ravers
const POOF_FRAMES = ['<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="1" width="2" height="1" fill="#b8bcd0"/><rect x="3" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="4" y="2" width="2" height="1" fill="#e8eaf2"/><rect x="6" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="3" y="3" width="1" height="1" fill="#8890a8"/><rect x="4" y="3" width="2" height="1" fill="#e8eaf2"/><rect x="6" y="3" width="1" height="1" fill="#8890a8"/><rect x="4" y="4" width="2" height="1" fill="#8890a8"/></svg>', '<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="2" height="1" fill="#b8bcd0"/><rect x="7" y="0" width="1" height="1" fill="#b8bcd0"/><rect x="1" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="2" y="1" width="2" height="1" fill="#e8eaf2"/><rect x="4" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="6" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="7" y="1" width="1" height="1" fill="#8890a8"/><rect x="8" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="0" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="1" y="2" width="1" height="1" fill="#8890a8"/><rect x="2" y="2" width="3" height="1" fill="#e8eaf2"/><rect x="5" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="6" y="2" width="1" height="1" fill="#8890a8"/><rect x="7" y="2" width="1" height="1" fill="#e8eaf2"/><rect x="8" y="2" width="1" height="1" fill="#8890a8"/><rect x="1" y="3" width="1" height="1" fill="#8890a8"/><rect x="2" y="3" width="2" height="1" fill="#e8eaf2"/><rect x="4" y="3" width="1" height="1" fill="#8890a8"/><rect x="5" y="3" width="3" height="1" fill="#e8eaf2"/><rect x="8" y="3" width="1" height="1" fill="#8890a8"/><rect x="2" y="4" width="2" height="1" fill="#8890a8"/><rect x="4" y="4" width="1" height="1" fill="#b8bcd0"/><rect x="5" y="4" width="2" height="1" fill="#e8eaf2"/><rect x="7" y="4" width="1" height="1" fill="#8890a8"/><rect x="4" y="5" width="3" height="1" fill="#8890a8"/></svg>', '<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="1" y="0" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="5" y="0" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="9" y="0" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="0" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="2" y="1" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="4" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="6" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="3" y="2" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="7" y="2" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="9" y="2" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="0" y="3" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="3" y="3" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="5" y="3" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="2" y="4" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="7" y="4" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="10" y="4" width="1" height="1" fill="#8890a8" opacity="0.6"/></svg>'];

// flame trail: two flicker frames (Pillow-verified in scratchpad floor-items.py),
// prerendered to tiny canvases and stamped per particle — a straight line of
// squares "kind of looked like fire but wasn't flaming" (Trym)
const FLAME_MAPS = [
  ['...Y...', '..YY...', '..YYO..', '.YOOO..', '.YOWOY.', 'YOWWOY.', 'YOWOOY.', '.YOOY..'],
  ['..Y..Y.', '..YY.Y.', '.YYOY..', '.YOOOY.', 'YOWWOY.', 'YOWWOOY', '.YOWOY.', '..YOY..'],
];
const FLAME_COLS = { Y: '#ffe135', O: '#ff9128', W: '#f0f0fa' };
const flameCvs = FLAME_MAPS.map((rows) => {
  const c = document.createElement('canvas');
  c.width = 7; c.height = 8;
  const x = c.getContext('2d');
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (FLAME_COLS[ch]) { x.fillStyle = FLAME_COLS[ch]; x.fillRect(rx, ry, 1, 1); }
  }));
  return c;
});

// the daiquiri trail v2: tiny cocktail UMBRELLAS wobbling in your wake (two
// tilt frames), plus creamy splash droplets — the old gold dashes read as
// "thin yellow stripes" (Trym), which is no way to describe a banana daiquiri
const UMB_MAPS = [
  ['..PPPPP..', '.PPPPPPP.', 'PDPDPDPDP', '....W....', '....W....', '....W....', '....W....', '...WW....'],
  ['...PPPPP.', '..PPPPPPP', '.PDPDPDPD', '.....W...', '....W....', '....W....', '...W.....', '...WW....'],
];
const UMB_COLS = { P: '#ff4d9d', D: '#c62c74', W: '#fffdf5' };
const umbCvs = UMB_MAPS.map((rows) => {
  const c = document.createElement('canvas');
  c.width = 9; c.height = 8;
  const x = c.getContext('2d');
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (UMB_COLS[ch]) { x.fillStyle = UMB_COLS[ch]; x.fillRect(rx, ry, 1, 1); }
  }));
  return c;
});
// kazoo solo: two pixel note shapes (♪ / ♫-ish) for the notes trail
const NOTE_MAPS = [
  ['...W.', '...W.', '...W.', '..WW.', '.WWW.'],
  ['.WWWW', '.W..W', '.W..W', 'WW.WW', 'WW.WW'],
];
const noteCvs = NOTE_MAPS.map((rows) => {
  const c = document.createElement('canvas');
  c.width = 5; c.height = 5;
  const x = c.getContext('2d');
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
    if (ch === 'W') { x.fillStyle = '#ffe135'; x.fillRect(rx, ry, 1, 1); }
  }));
  return c;
});
// which effects paint a trail behind the walker (spawned at walk cadence)
const TRAIL_FX = new Set(['flames', 'daiquiri', 'prism', 'fog', 'notes', 'glitter', 'slide', 'popper', 'lagoon', 'espresso', 'sparkler']);
// which effects dress the banana itself (CSS class on the wrap)
const FX_CLASS = {
  balloon: 'rv-balloonfx', flash: 'rv-flashfx', milkshake: 'rv-thicc',
  // bubblegum fizz spins the whole banana + inflates it bubbly (Trym: the
  // bubbles alone were underwhelming — "rotate 360 for the fun of it")
  fizz: 'rv-fizzfx',
  boots: 'rv-bootsfx', wobble: 'rv-wobblefx',
  sugar: 'rv-sugarfx', // the candy: shaking off ALL the sugar
  lagoon: 'rv-lagoonglow', water: 'rv-waterglow', espresso: 'rv-jitter', colada: 'rv-sway',
};

// Barty's voice (Trym's brief): a southwestern, over-cheerful cowboy-bartender —
// with small drips of a tragic childhood UNDER THE BREATH: the dark part lands
// in its OWN smaller bubble, a beat after the cheer, stand-up timing (Jared
// Dunn energy). A quip = [cheer, {mutter}] — bartySay() runs the sequence.
const BAR_QUIPS = [
  ['yee-haw! another beautiful night at the club!', { t: 'every night here is beautiful. only here. anyway!', mutter: true }],
  ['we only serve potassium!', { t: 'pa said fruit was for the weak.', mutter: true }],
  ['you dance like a champion!', { t: 'i was never allowed to dance.', mutter: true }],
  ['happy hour every 5th minute! you can set your heart to it.', { t: 'i did.', mutter: true }],
  ['nice moves, partner! hydrate!', { t: 'ma never did.', mutter: true }],
  ['i love this job!', { t: 'i sleep under the bar. anyway!', mutter: true }],
  ['the drop hits every third minute. the bar never misses!', { t: 'it can’t.', mutter: true }],
  ['smile, partner! it’s free!', { t: 'only thing that ever was.', mutter: true }],
  ['fill that jelly meter, partner!', { t: 'i’ve been full of jelly my whole life. the other kind. anyway!', mutter: true }],
  ['this floor don’t sweep itself, partner!', { t: 'i would know. i sweep it.', mutter: true }],
  ['thanks for helpin’ an old banana out!', { t: 'the young ones just dance right past.', mutter: true }],
  ['mind the loose cables, partner!', { t: 'the wiring’s older than me. nothing is older than me.', mutter: true }],
];

const el = (id) => document.getElementById(id);
const floor = el('rvFloor');
const world = el('rvWorld');
if (floor) init();

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// outfit → a name with no moderation surface: built ONLY from known ids
function autoName(o) {
  const adj = (o.extras && o.extras.goldbanana ? 'Golden' : null) // the trophy outranks everything
    || (o.extras && o.extras.glowstick ? 'Glowing' : null)
    || { shades: 'Cool', hearts: 'Lovestruck', visor: 'Sporty' }[o.glasses]
    || { disco: 'Disco', sparkle: 'Sparkly', confetti: 'Party' }[o.effect]
    || (o.extras && o.extras.mustache ? 'Distinguished' : 'Fresh');
  const noun = { cowboy: 'Cowboy', crown: 'Royal', tophat: 'Fancy', party: 'Birthday' }[o.hat]
    || (o.extras && o.extras.bowtie ? 'Dapper' : 'Dancing');
  return adj + ' ' + noun + ' Banana';
}

function myOutfit() {
  try {
    const saved = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (saved && typeof saved === 'object') return saved;
  } catch (e) {}
  // first-timers get a party-ready random fit — SAVED, so it's THEIR banana
  // from now on. Regenerating per visit read as "my outfit randomly changes
  // whenever I leave and come back" (wife-test).
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const fit = {
    hat: pick(['none', 'party', 'crown', 'tophat', 'cowboy']),
    glasses: pick(['none', 'shades', 'hearts', 'visor']),
    extras: { mustache: Math.random() < 0.25, bowtie: Math.random() < 0.25 },
    effect: 'none',
  };
  try { localStorage.setItem('bb-last', JSON.stringify(fit)); } catch (e) {}
  return fit;
}

function init() {
  const ravers = new Map(); // id -> {outfit, joined, stage, wrap, cv, x, y, size}
  let myId = null;
  let online = false;
  let welcomed = false; // first roster (or solo fallback) triggers the tour-or-night decision once
  const sessionStart = Date.now();

  // deterministic floor position from id (no server coordinates needed).
  // THE SPAWN POINT (Trym): everyone walks in mid-floor-ish — a fixed-ish
  // spot with id-jitter so arrivals don't stack. Center spawns keep the
  // tour's 2.6× zoom-in off the walls (at that scale the camera needs ~19%
  // clearance on every side to center you) and clear of the bar, the stage
  // edge and the delivery zone.
  function place(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const x = 36 + (h % 29);           // 36..64 (%)
    const y = 34 + ((h >>> 8) % 23);   // 34..56 (%) — MUST be >>> : >> is signed, went negative for half of all ids and floated bananas above the floor
    return { x, y };
  }

  function addRaver(p, isMe) {
    if (ravers.has(p.id)) return;
    const { x, y } = (typeof p.x === 'number' && typeof p.y === 'number') ? { x: p.x, y: p.y } : place(p.id);
    const size = Math.round(74 + y * 0.9); // deeper = bigger (fake depth)
    const wrap = document.createElement('div');
    wrap.className = 'rv-raver' + (isMe ? ' rv-raver--me' : '');
    wrap.style.left = x + '%';
    wrap.style.top = y + '%';
    wrap.style.zIndex = String(100 + Math.round(y)); // must be an INTEGER — browsers silently reject "188.5" leaving z auto
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 160;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    wrap.appendChild(cv);
    // no YOU tag — the glow marks you, and the first step confirms it (Trym's call)
    world.appendChild(wrap);
    ravers.set(p.id, { ...p, wrap, cv, x, y, size });
    if (p.stage) setStage(p.id, true);
    refreshHud();
  }

  // ---- walking ----
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function setPos(r, x, y) {
    r.x = x; r.y = y;
    r.size = Math.round(74 + y * 0.9);
    if (r.stage) return; // stage members keep their spot for the return
    r.wrap.style.left = x + '%';
    r.wrap.style.top = y + '%';
    r.wrap.style.zIndex = String(100 + Math.round(y));
    r.cv.style.width = r.cv.style.height = r.size + 'px';
  }

  // mirror + lean into the direction of travel (rotate composes inside the flip,
  // so the same 4deg leans "forward" on both sides)
  function leanInto(r, dx) {
    if (dx < -0.01) r.facing = -1;
    else if (dx > 0.01) r.facing = 1;
    const flip = r.facing === -1 ? 'scaleX(-1) ' : '';
    r.cv.style.transform = flip + (Math.abs(dx) > 0.01 ? 'rotate(4deg)' : '');
    r.lastWalk = Date.now();
    r.lastMoveAt = r.lastWalk; // survives stopLean — trails + high-fives read this
  }

  function stopLean(r) {
    r.cv.style.transform = r.facing === -1 ? 'scaleX(-1)' : '';
    r.lastWalk = 0;
  }

  let walkTarget = null;        // tap-to-move destination
  const keysDown = new Set();   // arrow/WASD state
  let lastMoveSent = 0;
  let walkedOnce = false;

  // (the old first-night walk tip is gone — the tour's dance-floor step
  // teaches movement now, with input-aware copy)

  // ---- the camera: follow-me zoom for small screens (walking IS panning) ----
  const CAM_SCALE = 1.75;
  const cam = { on: matchMedia('(max-width: 640px)').matches, s: 1, tx: 0, ty: 0 };
  let floorW = 0, floorH = 0;
  // the bar is SOLID — bananas stop at it instead of moonwalking through the counter.
  // It's sized in px, so its world-percent rect depends on the floor size: re-measured
  // with the floor. Occupied corner = x < barSolid.x AND y > barSolid.y.
  const barEl = document.querySelector('.rv-bar');
  const barSolid = { x: 0, y: 100 };
  const trailCv = el('rvTrails');
  const trailCtx = trailCv ? trailCv.getContext('2d') : null;
  // the sprite is a FIXED-px box while y is a floor-percent, so how high a banana
  // can stand before its head + YOU tag poke above the floor (and read as "sliding
  // under the DJ stage" — Trym, iOS) depends on the floor height. Clamp dynamically;
  // capped at 16 so the vinyl delivery zone (y < 18) stays reachable on short floors.
  let topClamp = 10;
  const measureFloor = () => {
    floorW = floor.clientWidth;
    floorH = floor.clientHeight;
    if (floorH) topClamp = Math.min(16, Math.max(6, (58 / floorH) * 100));
    if (barEl && floorW && floorH) {
      barSolid.x = ((barEl.offsetWidth - 18) / floorW) * 100;       // 18px bleeds off the left
      barSolid.y = 100 - (((barEl.offsetHeight - 52) / floorH) * 100); // 52px bleeds off the bottom
    }
    if (trailCv) { trailCv.width = floorW; trailCv.height = floorH; } // resize clears — trails restart, fine
  };
  measureFloor();
  addEventListener('resize', measureFloor);
  const insideBar = (x, y) => x < barSolid.x && y > barSolid.y;

  const zoomBtn = el('rvZoom');
  // pixel magnifiers, Pillow-verified (scratchpad zoom-icons): + = zoom in on
  // you, − = pull back to the whole floor. The label is the ACTION, not the
  // state; small screens are icon-only ("users click stuff to see what it
  // does" — Trym), and the corner gets freed.
  const ZOOM_IN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90" shape-rendering="crispEdges"><rect x="20" y="0" width="30" height="10" fill="#fffdf5"/><rect x="10" y="10" width="10" height="10" fill="#fffdf5"/><rect x="50" y="10" width="10" height="10" fill="#fffdf5"/><rect x="0" y="20" width="10" height="10" fill="#fffdf5"/><rect x="30" y="20" width="10" height="10" fill="#ffe135"/><rect x="60" y="20" width="10" height="10" fill="#fffdf5"/><rect x="0" y="30" width="10" height="10" fill="#fffdf5"/><rect x="20" y="30" width="30" height="10" fill="#ffe135"/><rect x="60" y="30" width="10" height="10" fill="#fffdf5"/><rect x="0" y="40" width="10" height="10" fill="#fffdf5"/><rect x="30" y="40" width="10" height="10" fill="#ffe135"/><rect x="60" y="40" width="10" height="10" fill="#fffdf5"/><rect x="10" y="50" width="10" height="10" fill="#fffdf5"/><rect x="50" y="50" width="20" height="10" fill="#fffdf5"/><rect x="20" y="60" width="30" height="10" fill="#fffdf5"/><rect x="60" y="60" width="20" height="10" fill="#fffdf5"/><rect x="70" y="70" width="20" height="10" fill="#fffdf5"/><rect x="80" y="80" width="20" height="10" fill="#fffdf5"/></svg>';
  const ZOOM_OUT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90" shape-rendering="crispEdges"><rect x="20" y="0" width="30" height="10" fill="#fffdf5"/><rect x="10" y="10" width="10" height="10" fill="#fffdf5"/><rect x="50" y="10" width="10" height="10" fill="#fffdf5"/><rect x="0" y="20" width="10" height="10" fill="#fffdf5"/><rect x="60" y="20" width="10" height="10" fill="#fffdf5"/><rect x="0" y="30" width="10" height="10" fill="#fffdf5"/><rect x="20" y="30" width="30" height="10" fill="#ffe135"/><rect x="60" y="30" width="10" height="10" fill="#fffdf5"/><rect x="0" y="40" width="10" height="10" fill="#fffdf5"/><rect x="60" y="40" width="10" height="10" fill="#fffdf5"/><rect x="10" y="50" width="10" height="10" fill="#fffdf5"/><rect x="50" y="50" width="20" height="10" fill="#fffdf5"/><rect x="20" y="60" width="30" height="10" fill="#fffdf5"/><rect x="60" y="60" width="20" height="10" fill="#fffdf5"/><rect x="70" y="70" width="20" height="10" fill="#fffdf5"/><rect x="80" y="80" width="20" height="10" fill="#fffdf5"/></svg>';
  function refreshZoomBtn() {
    zoomBtn.hidden = false;
    const small = matchMedia('(max-width: 640px)').matches;
    zoomBtn.innerHTML = (cam.on ? ZOOM_OUT_SVG : ZOOM_IN_SVG) + (small ? '' : '<span>' + (cam.on ? 'whole floor' : 'follow me') + '</span>');
    zoomBtn.setAttribute('aria-label', cam.on ? 'Show the whole floor' : 'Follow my banana');
  }
  refreshZoomBtn();
  zoomBtn.addEventListener('click', () => { cam.on = !cam.on; refreshZoomBtn(); track('rave_zoom', { on: cam.on }); });

  let camLastTx = null, camLastTy = null;
  function updateCam() {
    if (tourActive) return; // the tour drives the camera itself
    const me = myId && ravers.get(myId);
    if (!cam.on || !me || me.stage) {
      if (cam.s !== 1) { cam.s = 1; cam.tx = 0; cam.ty = 0; camLastTx = null; world.style.transform = ''; }
      return;
    }
    cam.s = CAM_SCALE;
    const px = (me.x / 100) * floorW * cam.s;
    const py = (me.y / 100) * floorH * cam.s;
    cam.tx = clamp(floorW / 2 - px, floorW - floorW * cam.s, 0);
    cam.ty = clamp(floorH / 2 - py, floorH - floorH * cam.s, 0);
    // a stationary camera writes nothing — style writes every frame are compositor churn
    if (camLastTx !== null && Math.abs(cam.tx - camLastTx) < 0.1 && Math.abs(cam.ty - camLastTy) < 0.1) return;
    camLastTx = cam.tx; camLastTy = cam.ty;
    world.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`;
  }

  const KEYMAP = {
    ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd',
    a: 'l', d: 'r', w: 'u', s: 'd', A: 'l', D: 'r', W: 'u', S: 'd',
  };
  addEventListener('keydown', (e) => {
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault(); // arrows must not scroll the hall
    keysDown.add(k);
    walkTarget = null;
    sitting = false; pendingSit = false; // any step stands you up
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keysDown.delete(k); });
  addEventListener('blur', () => keysDown.clear());

  floor.addEventListener('click', (e) => {
    if (e.target.closest('.rv-zoom') || e.target.closest('.rv-quest') || e.target.closest('.rv-mixer')) return; // buttons, the quest chip + the JELLY meter are not walk orders (a charged-meter tap walked you INTO the corner — Trym, iOS + Chrome)
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    sitting = false; pendingSit = false; // clicking anywhere else stands you up
    const rect = floor.getBoundingClientRect();
    // undo the camera: screen point → world percent
    walkTarget = {
      x: clamp(((e.clientX - rect.left - cam.tx) / (rect.width * cam.s)) * 100, 4, 96),
      y: clamp(((e.clientY - rect.top - cam.ty) / (rect.height * cam.s)) * 100, topClamp, 92),
    };
  });

  function stepMe(now, dtMs) {
    if (tourActive) return; // nobody wanders off mid-tour
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    let dx = 0, dy = 0;
    if (keysDown.size) {
      if (keysDown.has('l')) dx -= 1;
      if (keysDown.has('r')) dx += 1;
      if (keysDown.has('u')) dy -= 1;
      if (keysDown.has('d')) dy += 1;
    } else if (walkTarget) {
      dx = walkTarget.x - me.x; dy = walkTarget.y - me.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) {
        walkTarget = null;
        if (pendingSit) {
          pendingSit = false;
          sitting = true;
          // anchor the BUM on the seat, not the eyes: both sprites are centre-
          // anchored, so lift the banana by ~30% of its own height
          setPos(me, stoolPos.x, stoolPos.y - ((me.size || 90) * 0.3 / floorH) * 100);
          // the sitter OVERFLOWS the stool (Trym) — banana in front, chair
          // peeking out behind him; the next real setPos (standing up) restores
          me.wrap.style.zIndex = String(100 + Math.round(stoolPos.y) + 1);
        }
        // report the RESTING spot — the throttle can eat the last step, and the
        // server verifies claims against its copy of your position
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'move', x: +me.x.toFixed(1), y: +me.y.toFixed(1) }));
        return;
      }
      dx /= dist; dy /= dist;
    }
    // ICE LEGS: the dropped ice cube swaps walking for MOMENTUM — you
    // accelerate, you glide, you drift past where you aimed. Velocity decays
    // (~1s slide-out) so letting go still moves you.
    const sliding = fxActive(me, now) && me.fx.id === 'slide';
    const gliding = sliding && (Math.abs(me.slideVx || 0) > 0.02 || Math.abs(me.slideVy || 0) > 0.02);
    if (!dx && !dy && !gliding) { me.slideVx = 0; me.slideVy = 0; return; }
    const norm = Math.hypot(dx, dy) || 1;
    let boost = fxActive(me, now) && me.fx.id === 'daiquiri' ? 1.45
      : fxActive(me, now) && me.fx.id === 'balloon' ? 1.35 : 1; // daiquiri legs / balloon drift
    if (now < hypeModeUntil) boost *= 1.25; // hype mode = disco legs — peaking must FEEL like peaking
    const step = (WALK_SPEED * boost * dtMs) / 1000;
    let nx, ny;
    if (sliding) {
      // v2 (Trym: "slide quickly and fast... long slides"): harder acceleration,
      // slower decay — top speed ~2.4× walking, glide-out ~2s. Capped so a
      // long hold can't rocket through the walls between frames.
      me.slideVx = (me.slideVx || 0) * 0.95 + (dx / norm) * step * 0.16;
      me.slideVy = (me.slideVy || 0) * 0.95 + (dy / norm) * step * 0.16;
      const vMag = Math.hypot(me.slideVx, me.slideVy);
      const vMax = step * 2.4;
      if (vMag > vMax) { me.slideVx *= vMax / vMag; me.slideVy *= vMax / vMag; }
      nx = clamp(me.x + me.slideVx, 4, 96);
      ny = clamp(me.y + me.slideVy, topClamp, 92);
    } else {
      me.slideVx = 0; me.slideVy = 0;
      nx = clamp(me.x + (dx / norm) * step, 4, 96);
      ny = clamp(me.y + (dy / norm) * step, topClamp, 92);
    }
    // the bar is solid: block ENTERING it (slide along the edge you hit); anyone
    // who spawned inside can still walk free
    if (insideBar(nx, ny) && !insideBar(me.x, me.y)) {
      if (me.x >= barSolid.x) nx = barSolid.x;      // hit the bar's right edge
      else if (me.y <= barSolid.y) ny = barSolid.y; // hit the countertop from above
      else { nx = me.x; ny = me.y; }
      if (walkTarget && insideBar(walkTarget.x, walkTarget.y)) walkTarget = null; // no tables inside the bar
    }
    setPos(me, nx, ny);
    leanInto(me, dx);
    if (!walkedOnce) { walkedOnce = true; track('rave_walk'); }
    if (now - lastMoveSent > MOVE_SEND_MS && ws && ws.readyState === 1) {
      lastMoveSent = now;
      ws.send(JSON.stringify({ t: 'move', x: +me.x.toFixed(1), y: +me.y.toFixed(1) }));
    }
  }

  // move a raver between the floor and the stage line behind the DJ
  function setStage(id, on) {
    const r = ravers.get(id);
    if (!r) return;
    r.stage = !!on;
    if (on) {
      r.cv.style.width = r.cv.style.height = ''; // stage size comes from CSS
      r.wrap.style.left = r.wrap.style.top = r.wrap.style.zIndex = '';
      // balance the line around the centre gap (the DJ stands in the middle)
      const stageEl = el('rvStage');
      const gap = stageEl.querySelector('.rv-stage__gap');
      const kids = [...stageEl.children];
      const leftCount = kids.indexOf(gap);
      const rightCount = kids.length - 1 - leftCount;
      if (leftCount <= rightCount) stageEl.insertBefore(r.wrap, gap);
      else stageEl.appendChild(r.wrap);
    } else {
      r.cv.style.width = r.cv.style.height = r.size + 'px';
      r.wrap.style.left = r.x + '%';
      r.wrap.style.top = r.y + '%';
      r.wrap.style.zIndex = String(100 + Math.round(r.y));
      world.appendChild(r.wrap);
    }
    if (id === myId) refreshStageUi();
    refreshHud();
  }

  // THE SMOKE POOF: how things leave the floor — expired items and departing
  // ravers alike. Nothing just blinks out of a club (Trym's rule).
  function poofAt(x, y, scale) {
    const d = document.createElement('div');
    d.className = 'rv-poof';
    d.style.left = x + '%';
    d.style.top = y + '%';
    d.style.zIndex = String(100 + Math.round(y) + 1);
    if (scale) d.style.width = Math.round(36 * scale) + 'px';
    d.innerHTML = '<span class="rv-poof__1">' + POOF_FRAMES[0] + '</span>' +
      '<span class="rv-poof__2">' + POOF_FRAMES[1] + '</span>' +
      '<span class="rv-poof__3">' + POOF_FRAMES[2] + '</span>';
    world.appendChild(d);
    setTimeout(() => d.remove(), 750);
  }

  function dropRaver(id) {
    const r = ravers.get(id);
    if (!r) return;
    if (!r.stage) poofAt(r.x, r.y, (r.size || 90) / 74); // gone in a puff, not a blink
    r.wrap.remove();
    ravers.delete(id);
    refreshHud();
  }

  // THE WAVE: everyone who emotes during the call-window joins the ripple —
  // synced purely by the shared clock + the emote broadcasts everyone already sees
  let waveWin = -1;
  const wavers = new Set();
  function runWave() {
    const parts = [...wavers].map((id) => ravers.get(id)).filter((r) => r && !r.stage).sort((a, b) => a.x - b.x);
    // staff ALWAYS join (honest NPCs with jobs — even a lone visitor gets a wave)
    const hops = [el('rvBarman'), ...parts.map((r) => r.cv), el('rvDj')].filter(Boolean);
    hops.forEach((cv, i) => {
      cv.style.animation = `rvWaveHop 0.55s steps(4) ${(i * 0.09).toFixed(2)}s`;
      setTimeout(() => { cv.style.animation = ''; }, 2600);
    });
    if (wavers.has(myId)) addHype(10); // you rode the wave
    if (parts.length) showBubble('🌊 what a wave!', false, 3000);
  }

  function floatEmote(id, kind) {
    const wPh = (((Date.now() / 1000 - WAVE_OFFSET) % WAVE_PERIOD) + WAVE_PERIOD) % WAVE_PERIOD;
    if (wPh < WAVE_LEN) wavers.add(id); // emoting during the call = you're in the wave
    if (id === myId) addHype(2);
    const r = ravers.get(id);
    if (!r) return;
    const e = document.createElement('span');
    e.className = 'rv-emote rv-emote--' + kind;
    // floats reuse the buttons' pixel icons (single art source); fire has no pixel icon yet
    const iconSvg = document.querySelector('.rv-emote-btn[data-emote="' + kind + '"] svg');
    if (iconSvg) e.appendChild(iconSvg.cloneNode(true));
    else e.innerHTML = { heart: '&#10084;', confetti: '&#10022;', banana: '&#127820;', fire: '&#128293;' }[kind] || '';
    r.wrap.appendChild(e);
    setTimeout(() => e.remove(), 1900);
  }

  // ---- the DJ: banana of the day on the podium ----
  const djOutfit = dailyOutfit();
  const djCv = el('rvDj');

  // ---- the bar: Barty (static NPC, frame 4 = first left-facing pose) + happy hour ----
  let beerWin = -1;      // last claimed happy-hour window
  let lastBeerTry = 0;
  let bubbleSticky = false, bubbleT = null;
  function showBubble(text, sticky, ms, kind) {
    if (tourActive) return; // one voice at a time — Barty doesn't talk over the tour (wife-test)
    const b = el('rvBubble');
    b.textContent = text;
    b.classList.toggle('rv-bubble--quest', kind === 'quest');   // yellow = Barty means BUSINESS
    b.classList.toggle('rv-bubble--mutter', kind === 'mutter'); // small + dim = under the breath
    b.hidden = false;
    bubbleSticky = !!sticky;
    clearTimeout(bubbleT);
    if (!sticky) bubbleT = setTimeout(hideBubble, ms || 4000);
  }

  // stand-up timing: each part gets read before the next lands — the dark drip
  // arrives in its own quieter bubble, a beat after the cheer (Trym's direction)
  let sayGen = 0, bartyBusyUntil = 0;
  const readMs = (t) => clamp(1400 + t.length * 55, 2200, 5200);
  function bartySay(parts, quest) {
    const seq = Array.isArray(parts) ? parts : [parts];
    const gen = ++sayGen; // a newer say cancels the tail of an older sequence
    let delay = 0;
    // Barty holds the floor for the whole delivery — a specials/happy-hour
    // sticky stomped the STAMP-OUT line at the emotional peak in testing
    bartyBusyUntil = Date.now() + seq.reduce((ms, p) => ms + readMs(typeof p === 'string' ? p : p.t), 0) + 4500;
    seq.forEach((p, i) => {
      const txt = typeof p === 'string' ? p : p.t;
      const mutter = typeof p === 'object' && !!p.mutter;
      const last = i === seq.length - 1;
      setTimeout(() => {
        if (gen !== sayGen) return;
        showBubble(txt, false, last ? (quest && !mutter ? 9000 : 5000) : readMs(txt) + 400, mutter ? 'mutter' : (quest ? 'quest' : undefined));
      }, delay);
      delay += readMs(txt);
    });
  }
  function hideBubble() { el('rvBubble').hidden = true; bubbleSticky = false; }

  function claimBeer(id) {
    const r = ravers.get(id);
    if (!r) return;
    r.outfit.extras = { ...(r.outfit.extras || {}), beer: true };
    beerWin = happyWin(Date.now() / 1000);
    el('rvCounterBeer').style.display = 'none'; // SVG: no .hidden property AND the UA [hidden] rule skips it — inline display only
    showBubble('SERVED! 🍺 ' + autoName(r.outfit) + ' drinks free', false, 6000);
    refreshHud();
    if (id === myId) { bumpChain(); track('rave_beer'); passPatch('round'); passStat('beers'); }
  }

  // what's ON the counter right now — barTick (1s) stages it, tryClaims (frame
  // rate) grabs it: the claims used to live on this slow tick + a 2s retry =
  // "i stand at the bar and nothing happens" (Trym)
  let barBeerLive = false, barSpecialLive = null;
  function barTick() {
    if (tourActive) return; // the bar holds its announcements while the tour is on stage
    const t = Date.now() / 1000;
    const bub = el('rvBubble');
    if (happyActive(t)) {
      const win = happyWin(t);
      barSpecialLive = null;
      barBeerLive = beerWin !== win;
      if (barBeerLive) { // this window's beer still on the counter
        el('rvCounterBeer').style.display = '';
        if (!bubbleSticky && Date.now() > bartyBusyUntil) showBubble('HAPPY HOUR! 🍺 first banana to the bar drinks free', true);
      }
    } else {
      el('rvCounterBeer').style.display = 'none';
      barBeerLive = false;
      // — Barty's specials: a rotating cocktail on the counter between happy hours —
      const spEl = el('rvSpecial');
      const spPh = (((t - SPECIAL_OFFSET) % SPECIAL_PERIOD) + SPECIAL_PERIOD) % SPECIAL_PERIOD;
      const spWin = Math.floor((t - SPECIAL_OFFSET) / SPECIAL_PERIOD);
      if (spPh < SPECIAL_LEN && cocktailWinClaimed !== spWin) {
        const kind = COCKTAILS[((spWin % COCKTAILS.length) + COCKTAILS.length) % COCKTAILS.length];
        if (spEl.dataset.kind !== kind) {
          spEl.dataset.kind = kind;
          spEl.innerHTML = kind === 'daiquiri' ? DAIQUIRI_SVG : kind === 'fizz' ? FIZZ_SVG : (MENU_SVGS[kind] || FIZZ_SVG);
        }
        spEl.hidden = false;
        barSpecialLive = { win: spWin, kind };
        if (!bubbleSticky && Date.now() > bartyBusyUntil) showBubble('SPECIALS! ' + FX_ICON[kind] + ' first banana to the bar gets the ' + FX_NAMES[kind], true);
      } else {
        spEl.hidden = true;
        barSpecialLive = null;
        if (bubbleSticky) hideBubble();
        // ambient Barty: the chatter between rituals — chattier now, he's a
        // living NPC, not a sign that occasionally speaks (Trym's direction)
        if (bub.hidden && Math.random() < 0.026) {
          bartySay(BAR_QUIPS[Math.floor(Math.random() * BAR_QUIPS.length)]);
        }
      }
    }
  }
  setInterval(barTick, 1000);

  // ---- floor life: spotlight + lost vinyl + hot sauce (one 500ms rhythm tick) ----
  let vinylWinClaimed = -1;
  let lastVinylTry = 0;
  let miniDropUntil = 0;
  let sauceWinClaimed = -1;
  let lastSauceTry = 0;
  let goldWinClaimed = -1;
  let lastGoldTry = 0;
  let itemWinClaimed = -1;
  let lastItemTry = 0;

  // THE JELLY METER (the lore name — internals keep 'hype' ids for continuity):
  // everything you do fills it, standing still drains it, full = JELLY TIME,
  // where the whole floor sees you
  // peak (the effect travels the existing outfit pipe). Purely client-side.
  const HYPE_MAX = 100, HYPE_MODE_MS = 20000;
  const hypeBoost = new URLSearchParams(location.search).has('hypetest') ? 8 : 1; // ?hypetest = fast meter for visual testing
  let hype = 0, hypeModeUntil = 0, lastHypeGain = 0, prevEffect = null;
  const hypeSegs = [];
  (() => {
    const bar = el('rvHypeBar');
    if (!bar) return;
    for (let i = 0; i < 12; i++) {
      const s = document.createElement('span');
      s.className = 'rv-mixer__seg';
      bar.appendChild(s);
      hypeSegs.push(s);
    }
  })();
  const mixerEl = el('rvMixer');
  let lastSegsOn = -1;
  function renderHype() {
    const peaking = Date.now() < hypeModeUntil;
    const on = peaking ? 12 : Math.round((hype / HYPE_MAX) * 12);
    if (on === lastSegsOn && !peaking) return; // segment count unchanged — no DOM work
    lastSegsOn = on;
    hypeSegs.forEach((s, i) => s.classList.toggle('on', i < on));
    mixerEl.classList.toggle('rv-mixer--peak', peaking);
  }
  // full ≠ auto-fire: a full meter ARMS the mixer and waits. Hype is a resource
  // you SPEND — "it's just something that is there and i cant use it for much"
  // (Trym) was the tell: a passive bar with a cosmetic ending isn't a loop.
  let hypeCharged = false;
  // ---- REP: the club remembers (THE WHY BUILD, phase 1) ----
  // Every action pays REP into the pass (stats.rep — cross-device via the
  // passkey sync, never decays: the no-punishing rule). Crossing a rank
  // threshold is a MOMENT on the floor, right where you earned it. Rank
  // REWARDS (wearable drops + privileges) arrive with the ownership stack —
  // never music drops; those are atmosphere, not currency (Trym).
  function earnRep(n) {
    const pts = Math.round(n);
    if (!pts || pts < 0) return;
    const total = passStat('rep', pts);
    const now2 = rankFor(total);
    if (now2.id !== rankFor(total - pts).id) {
      bigMoment('RANK UP 🎖 ' + now2.title.toUpperCase(), nextRank(total)
        ? 'the club knows your face — next stop: ' + nextRank(total).title
        : 'top of the ladder. the club is basically yours.');
      passToast('🎖 <b>' + now2.title + '</b> — <a href="/pass/">your standing at the club</a>');
      try { document.dispatchEvent(new CustomEvent('pass:change')); } catch (e) {}
      track('rave_rankup', { rank: now2.id });
    }
  }

  function addHype(n) {
    earnRep(n); // REP flows on EVERY action — even while the meter is charged or peaking
    if (hypeCharged || Date.now() < hypeModeUntil) return; // holds while armed or peaking
    // the DOUBLE JELLY SHOT: everything counts twice while it lasts
    const me = myId && ravers.get(myId);
    const shot = me && fxActive(me, Date.now()) && me.fx.id === 'jellyshot' ? 2 : 1;
    // ÷3: it's raining jelly on this floor — a full meter came too cheap and
    // the drops never stopped (Trym's recalibration, one dial for all gains)
    hype = Math.min(HYPE_MAX, hype + (n * hypeBoost * shot) / 3);
    lastHypeGain = Date.now();
    if (hype >= HYPE_MAX) {
      hypeCharged = true;
      mixerEl.classList.add('rv-mixer--charged');
    }
    renderHype();
  }
  // the METER IS THE BUTTON (Trym's call after the wife-test: the HUD JELLY
  // TIME button hid below the fold on mobile and was pure duplication —
  // deleted; the flashing TAP! meter is the one and only trigger)
  mixerEl.addEventListener('click', () => { if (hypeCharged) spendHype(); });

  function spendHype() {
    if (!hypeCharged) return;
    hypeCharged = false;
    mixerEl.classList.remove('rv-mixer--charged');
    hype = 0;
    hypeModeUntil = Date.now() + HYPE_MODE_MS;
    miniDropUntil = Date.now() + 8000; // YOU drop the floor — strobe, pyro, the works
    passPatch('hype');
    passStat('hypes');
    tonight.jellytimes += 1;
    refreshStats();
    track('rave_hype');
    confettiBurst();
    const me = myId && ravers.get(myId);
    if (me) {
      me.wrap.classList.add('rv-hypemode');
      prevEffect = me.outfit.effect;
      me.outfit.effect = 'disco'; // broadcast: the floor sees you peaking
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'outfit', outfit: me.outfit }));
      const toast = document.createElement('div');
      toast.className = 'rv-glowtoast';
      toast.innerHTML = '🍌 <b>IT’S JELLY TIME</b> — disco legs, gold trail, the floor goes OFF!';
      (el('rvToasts') || floor).appendChild(toast); // the stack: simultaneous pickups pile up, never overlap
      setTimeout(() => toast.remove(), 5000);
    }
    setTimeout(endHypeMode, HYPE_MODE_MS);
    nightEvent('hypedrop');
  }
  function endHypeMode() {
    const me = myId && ravers.get(myId);
    if (me) {
      me.wrap.classList.remove('rv-hypemode');
      me.outfit.effect = prevEffect || 'none';
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'outfit', outfit: me.outfit }));
    }
    renderHype();
  }

  // SPARKLE RUNS — your personal pellet trail, the meter's endless fuel: an arc
  // of sparkles only YOU see; finish it and a new one draws itself elsewhere.
  // Client-only and per-visitor, so there is ALWAYS something to chase.
  let run = null, nextRunAt = Date.now() + 6000;
  function newRun() {
    const me = myId && ravers.get(myId);
    if (!me || me.stage || !floorW || !floorH) return null;
    // DESIGNED shapes, not a random wander — the clamped walk read as "thrown
    // in there" (Trym): uneven gaps, kinked columns. Now: even spacing in PX
    // (the floor is wider than tall) and a whole shape either fits clean or we
    // rotate and try again — no per-pellet clamping, no smears.
    const STEP = clamp(floorW / 13, 44, 70);
    const px0 = (me.x / 100) * floorW, py0 = (me.y / 100) * floorH;
    const topPx = ((topClamp + 4) / 100) * floorH;
    const KINDS = ['line', 'arc', 'zig'];
    const kind0 = Math.floor(Math.random() * 3);
    const ang0 = Math.atan2(floorH / 2 - py0, floorW / 2 - px0) + (Math.random() - 0.5) * 1.2;
    for (let tryN = 0; tryN < 12; tryN++) {
      const kind = KINDS[(kind0 + tryN) % 3];
      let ang = ang0 + tryN * 0.55;
      const turn = kind === 'arc' ? (tryN % 2 ? -0.22 : 0.22) : 0;
      let x = px0, y = py0;
      const pts = [];
      let ok = true;
      for (let i = 0; i < 8; i++) {
        const a = ang + (kind === 'zig' ? (i % 2 ? 0.55 : -0.55) : 0);
        x += Math.cos(a) * STEP;
        y += Math.sin(a) * STEP * 0.8; // slight y squash — matches the floor's fake depth
        ang += turn;
        const xp = (x / floorW) * 100, yp = (y / floorH) * 100;
        if (x < floorW * 0.06 || x > floorW * 0.94 || y < topPx || y > floorH * 0.9 || insideBar(xp, yp)) { ok = false; break; }
        pts.push({ x: xp, y: yp, got: false });
      }
      if (!ok) continue;
      const host = el('rvRun');
      host.innerHTML = '';
      pts.forEach((p, i) => {
        const d = document.createElement('div');
        d.className = 'rv-pellet';
        d.innerHTML = JELLY_SVG; // the drops ARE jelly — that's why they fill the meter
        d.style.left = p.x + '%';
        d.style.top = p.y + '%';
        d.style.animationDelay = (i * 0.08) + 's';
        host.appendChild(d);
        p.elm = d;
      });
      return { pts, born: Date.now() };
    }
    return null; // cornered — tickRun retries in a moment
  }
  let magnetT = 0;
  function tickRun() {
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    const now = Date.now();
    // THE JELLY MAGNET: while it runs, jelly can't wait — no breather between
    // runs, and every loose pellet slides across the floor INTO you
    const magnetOn = fxActive(me, now) && me.fx.id === 'magnet';
    if (!run) {
      if (now >= nextRunAt || magnetOn) {
        run = newRun();
        if (!run) nextRunAt = now + 2500;
      }
      return;
    }
    if (magnetOn) {
      const dt = Math.min(now - (magnetT || now), 100);
      const pull = (160 * dt) / 1000; // px per frame toward the magnet
      for (const p of run.pts) {
        if (p.got) continue;
        const dxp = ((me.x - p.x) / 100) * floorW;
        const dyp = ((me.y - p.y) / 100) * floorH;
        const d = Math.hypot(dxp, dyp) || 1;
        p.x += ((dxp / d) * pull * 100) / floorW;
        p.y += ((dyp / d) * pull * 100) / floorH;
        p.elm.style.left = p.x + '%';
        p.elm.style.top = p.y + '%';
      }
    }
    magnetT = now;
    if (now - run.born > 120000) { // stale — redraw somewhere fresh
      el('rvRun').innerHTML = '';
      run = newRun();
      return;
    }
    let left = 0;
    // pickup radius in PX, sized to the sprite: %-distance is anisotropic (5%
    // vertically is ~half of 5% horizontally on this floor) so the banana
    // visibly STOOD on pellets it hadn't "reached" — Trym circled back for
    // one or two every single run
    const rPx = (me.size || 90) * 0.55;
    for (const p of run.pts) {
      if (p.got) continue;
      const dxp = ((me.x - p.x) / 100) * floorW;
      const dyp = ((me.y - p.y) / 100) * floorH;
      if (Math.hypot(dxp, dyp) < rPx) {
        p.got = true;
        p.elm.style.animationDelay = ''; // the spawn stagger must not postpone the pop
        p.elm.classList.add('rv-pellet--got');
        const gone = p.elm;
        setTimeout(() => gone.remove(), 500); // no half-faded ghosts, ever
        addHype(4); // 6 → 4: the onboarding was a drop-fest (Trym round 2)
        tonight.jelly += 1;
        passStat('jelly'); // lifetime total on the pass
        floatPlus(p.x, p.y - 3);
        refreshStats();
      } else {
        left++;
      }
    }
    if (!left) { // run complete: chain bump + breather before the next one
      run = null;
      nextRunAt = now + 5000;
      bumpChain();
      addHype(10);
      el('rvRun').innerHTML = '';
      track('rave_run');
    }
  }

  // THE CHAIN: every pickup within 90s of the last extends it — the lone
  // visitor's reason to keep moving. Client-side, personal, no leaderboard.
  let chain = 0, chainAt = 0;
  // ---- TONIGHT's stats: the braggable numbers of this visit (session-only;
  // lifetime totals live on the pass). refreshStats repaints the panel row.
  const tonight = { jelly: 0, fives: 0, pickups: 0, jellytimes: 0 };
  // time in the club — same source as the endurance board (joined timestamp,
  // server-held in multiplayer), formatted 1h 2m 3s / 4m 32s / 12s
  function clubTime() {
    const me = myId && ravers.get(myId);
    const ms = me && me.joined ? Date.now() - me.joined : 0;
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return h ? h + 'h ' + m + 'm ' + sec + 's' : m ? m + 'm ' + sec + 's' : sec + 's';
  }
  function refreshStats() {
    const s = el('rvStats');
    if (!s) return;
    const one = (n, sing, plur) => '<span><b>' + n + '</b> ' + (n === 1 ? sing : plur) + '</span>';
    s.innerHTML =
      '<span class="rv-stats__time" id="rvClubTime">⏱ <b>' + clubTime() + '</b> in the club</span>' +
      '<span><b>' + tonight.jelly + '</b> jelly</span>' +
      one(tonight.pickups, 'pickup', 'pickups') +
      one(tonight.fives, 'high-five', 'high-fives') +
      one(tonight.jellytimes, 'jelly time', 'jelly times');
  }
  setInterval(() => { // the counter TICKS — watching it climb is the point
    const t = el('rvClubTime');
    if (t) t.innerHTML = '⏱ <b>' + clubTime() + '</b> in the club';
  }, 1000);
  // the little "+1" that makes a pickup FEEL counted — floats off the spot
  function floatPlus(x, y, text) {
    const d = document.createElement('div');
    d.className = 'rv-plus';
    d.textContent = text || '+1';
    d.style.left = x + '%';
    d.style.top = y + '%';
    world.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }
  refreshStats(); // paint the zeros — the row invites filling them

  // ---- SHARE MY NIGHT: a 1080x1080 card rendered on the spot — YOUR banana
  // (outfit and all) big on the left, tilted, one raised glove waving out of
  // the crop (Trym's composition), tonight's numbers overflowing onto him.
  async function shareNight() {
    try { await document.fonts.ready; } catch (e) {}
    const me = myId && ravers.get(myId);
    if (!me) return;
    const S = 1080;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    // the club: near-black, a whisper of checkerboard, two spotlight beams
    c.fillStyle = '#0d0b14';
    c.fillRect(0, 0, S, S);
    c.fillStyle = 'rgba(179, 136, 255, 0.05)';
    for (let ty = 6; ty < 12; ty++) for (let tx = 0; tx < 12; tx++) {
      if ((tx + ty) % 2) c.fillRect(tx * 90, ty * 90, 90, 90);
    }
    for (const [bx, tilt] of [[220, 0.5], [760, -0.35]]) {
      const g = c.createLinearGradient(bx, 0, bx + tilt * S, S);
      g.addColorStop(0, 'rgba(255, 225, 53, 0.16)');
      g.addColorStop(1, 'rgba(255, 225, 53, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(bx - 40, 0); c.lineTo(bx + 40, 0);
      c.lineTo(bx + tilt * S + 190, S); c.lineTo(bx + tilt * S - 190, S);
      c.closePath(); c.fill();
    }
    // confetti pinches
    const CONF = ['#ffe135', '#ff4d9d', '#78ebff', '#58c05c'];
    for (let i = 0; i < 46; i++) {
      c.fillStyle = CONF[i % CONF.length];
      c.globalAlpha = 0.35 + (i % 5) * 0.12;
      c.fillRect(Math.floor(((i * 733) % S) / 10) * 10, Math.floor(((i * 379) % S) / 10) * 10, 10, 10);
    }
    c.globalAlpha = 1;
    // the banana: hands-up frame, big, tilted, hugging the left edge so the
    // near arm crops out and the far glove reads as a WAVE
    const bcv = document.createElement('canvas');
    bcv.width = bcv.height = 1024;
    drawComposite(bcv.getContext('2d'), 1024, 2, {
      bg: 'transparent', captions: false, top: '', bottom: '',
      hat: me.outfit.hat, glasses: me.outfit.glasses, extras: me.outfit.extras || {},
      effect: 'none',
    });
    const glow = c.createRadialGradient(240, 620, 60, 240, 620, 560);
    glow.addColorStop(0, 'rgba(255, 225, 53, 0.28)');
    glow.addColorStop(1, 'rgba(255, 225, 53, 0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, S, S);
    c.save();
    c.imageSmoothingEnabled = false;
    c.translate(150, 640);           // centre sits past the left edge's third
    c.rotate(-10 * Math.PI / 180);   // the lean
    c.drawImage(bcv, -620, -620, 1240, 1240);
    c.restore();
    // type — right-aligned column the banana leans INTO
    c.textAlign = 'right';
    c.fillStyle = '#fffdf5';
    c.font = '800 44px "Archivo Black", sans-serif';
    c.fillText('MY NIGHT AT', S - 60, 130);
    c.fillStyle = '#ffe135';
    c.font = '800 76px "Archivo Black", sans-serif';
    c.fillText('THE BANANA RAVE', S - 60, 215);
    // the headline stat: how long you danced — pink, above the numbers
    c.shadowColor = 'rgba(0, 0, 0, 0.9)';
    c.shadowBlur = 18;
    c.fillStyle = '#ff4d9d';
    c.font = '800 42px "Archivo Black", sans-serif';
    c.fillText('DANCED FOR ' + clubTime().toUpperCase(), S - 60, 292);
    c.shadowBlur = 0;
    const rows = [
      [tonight.jelly, 'JELLY'],
      [tonight.pickups, tonight.pickups === 1 ? 'PICKUP' : 'PICKUPS'],
      [tonight.fives, tonight.fives === 1 ? 'HIGH-FIVE' : 'HIGH-FIVES'],
      [tonight.jellytimes, tonight.jellytimes === 1 ? 'JELLY TIME' : 'JELLY TIMES'],
    ];
    let y = 400;
    for (const [n, label] of rows) {
      // the numbers OVERFLOW onto the banana (Trym's brief) — gold glow keeps
      // them readable where they cross his arm
      c.shadowColor = 'rgba(0, 0, 0, 0.9)';
      c.shadowBlur = 26;
      c.fillStyle = '#ffe135';
      c.font = '800 120px "Archivo Black", sans-serif';
      c.fillText(String(n), S - 540, y);
      c.shadowBlur = 14;
      c.fillStyle = '#fffdf5';
      c.font = '800 36px "Archivo Black", sans-serif';
      c.textAlign = 'left';
      c.fillText(label, S - 505, y - 10);
      c.textAlign = 'right';
      c.shadowBlur = 0;
      y += 138;
    }
    c.fillStyle = '#fffdf5';
    c.font = '700 30px "Archivo Black", sans-serif';
    c.fillText(autoName(me.outfit).toUpperCase(), S - 60, S - 116);
    c.fillStyle = '#ffe135';
    c.font = '800 34px "Archivo Black", sans-serif';
    c.fillText('trymstene.com/rave', S - 60, S - 62);
    track('rave_share_night');
    openShareModal(cv);
  }
  // the card gets a proper REVEAL — our own lightbox, not the OS dialog
  // (Windows' native share sheet has no image preview; Trym: "depressing").
  // The system sheet stays as an opt-in button where it's actually nice (phones).
  const FILE_NAME = 'my-night-banana-rave-trymstene.com.png';
  function openShareModal(cv) {
    const modal = el('rvShareModal');
    const slot = el('rvShareSlot');
    slot.replaceChildren(cv);
    modal.hidden = false;
    el('rvShareSys').hidden = !navigator.canShare;
    const toBlob = () => new Promise((r) => cv.toBlob(r, 'image/png'));
    el('rvShareDl').onclick = async () => {
      const blob = await toBlob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = FILE_NAME;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    el('rvShareCopy').onclick = async () => {
      try {
        const blob = await toBlob();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        el('rvShareCopy').textContent = '✓ copied — paste it anywhere';
        setTimeout(() => { el('rvShareCopy').textContent = '📋 copy image'; }, 2500);
      } catch (e) {
        el('rvShareCopy').textContent = 'copy blocked — use download';
        setTimeout(() => { el('rvShareCopy').textContent = '📋 copy image'; }, 2500);
      }
    };
    el('rvShareSys').onclick = async () => {
      const blob = await toBlob();
      const file = new File([blob], FILE_NAME, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My night at the banana rave' }); } catch (e) { /* user closed it */ }
      }
    };
  }
  const closeShare = () => { el('rvShareModal').hidden = true; };
  if (el('rvShareModal')) {
    el('rvShareClose').addEventListener('click', closeShare);
    el('rvShareModal').addEventListener('click', (e) => { if (e.target === el('rvShareModal')) closeShare(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el('rvShareModal').hidden) closeShare(); });
  }
  const shareBtn = el('rvShareNight');
  if (shareBtn) shareBtn.addEventListener('click', shareNight);

  function bumpChain() {
    const now = Date.now();
    chain = now - chainAt < CHAIN_MS ? chain + 1 : 1;
    chainAt = now;
    tonight.pickups += 1;
    refreshStats();
    addHype(7); // every pickup is jelly fuel (12 → 7: items overfilled the meter, Trym round 2)
    nightEvent('chain', chain);
    if (chain === 5) {
      const me = myId && ravers.get(myId);
      if (me) {
        me.wrap.classList.add('rv-chainglow');
        setTimeout(() => me.wrap.classList.remove('rv-chainglow'), 12000);
        showBubble('🔥 ' + autoName(me.outfit) + ' is on a CHAIN of FIVE!', false, 6000);
      }
      track('rave_chain', { n: 5 });
    }
    if (chain === 10) { passPatch('chain'); track('rave_chain', { n: 10 }); }
    return chain;
  }
  const chainTag = () => (chain > 1 ? ' — chain ×' + chain + '!' : '');

  // conveyor grant — shared by the ws broadcast and solo mode
  function itemGrant(id, win, kind, fx) {
    itemWinClaimed = win;
    const sp = itemSpotFor(win);
    pickupPop(sp.x, sp.y);
    if (id === myId) { bumpChain(); nightEvent('item'); }
    if (id === myId && kind === 'pizzabox') addHype(15); // a whole pizza is a MEAL — paid even now that the box grants a held-prop fx
    if (fx) {
      applyFx(id, fx);
    } else if (id === myId && SNACKS[kind]) {
      const toast = document.createElement('div');
      toast.className = 'rv-glowtoast';
      toast.innerHTML = SNACKS[kind][0] + ' <b>' + SNACKS[kind][1] + '</b>' +
        (kind === 'pizzabox' ? ' — +25 jelly, that’s dinner!' : (chain > 1 ? ' — chain ×' + chain + '!' : ' — keep moving, keep the chain!'));
      (el('rvToasts') || floor).appendChild(toast); // the stack: simultaneous pickups pile up, never overlap
      setTimeout(() => toast.remove(), 4000);
      track('rave_snack', { kind });
    }
  }
  let cocktailWinClaimed = -1;
  let lastCocktailTry = 0;

  // every claim rides with a fresh position: the server position-verifies claims,
  // but it only learns your position from move messages — a fresh reconnect (iOS
  // app-switch = pagehide + reconnect) has NO coords, and standing still never
  // sends any. Trym stood ON the vinyl and nothing happened — this is why.
  function sendClaim(payload) {
    const me = myId && ravers.get(myId);
    if (me && ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ t: 'move', x: +me.x.toFixed(1), y: +me.y.toFixed(1) }));
      ws.send(payload);
    }
  }

  // pickup juice: a pixel ring + four stars burst where an item was grabbed —
  // grabbing something should FEEL like grabbing something
  function pickupPop(xPct, yPct) {
    const d = document.createElement('div');
    d.className = 'rv-pop';
    d.style.left = xPct + '%';
    d.style.top = yPct + '%';
    d.innerHTML = '<span class="rv-pop__ring"></span>'
      + [[-24, -18], [24, -14], [-16, 20], [18, 18]]
        .map(([dx, dy]) => `<span class="rv-pop__s" style="--dx:${dx}px;--dy:${dy}px"></span>`).join('');
    world.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  // the golden banana: a MOMENT for the whole floor — finder mints the patch,
  // everyone gets the confetti
  function claimGold(id) {
    const r = ravers.get(id);
    if (!r) return;
    goldWinClaimed = Math.floor((Date.now() / 1000 - GOLD_OFFSET) / GOLD_PERIOD);
    const gs = goldSpotFor(goldWinClaimed);
    pickupPop(gs.x, gs.y);
    confettiBurst();
    goldenRain(); // the golden banana brings its own weather
    if (id === myId) {
      bumpChain();
      const toast = document.createElement('div');
      toast.className = 'rv-glowtoast';
      toast.innerHTML = '🍌 <b>THE GOLDEN BANANA</b> — the whole floor parties for you!';
      (el('rvToasts') || floor).appendChild(toast); // the stack: simultaneous pickups pile up, never overlap
      setTimeout(() => toast.remove(), 6000);
      passPatch('golden');
      track('rave_gold');
    } else {
      showBubble('🍌 ' + autoName(r.outfit) + ' found the GOLDEN BANANA!', false, 6000);
    }
  }

  // timed effects (flames/daiquiri/fizz) — SERVER-GRANTED, worn until fx.until
  const fxActive = (r, now) => !!(r && r.fx && r.fx.until > now);
  function applyFx(id, fx, at) {
    const r = ravers.get(id);
    if (!r || !fx) return;
    r.fx = capFx(fx);
    refreshHud();
    if (at) pickupPop(at.x, at.y);
    if (id === myId) {
      const toast = document.createElement('div');
      toast.className = 'rv-glowtoast';
      toast.innerHTML = FX_ICON[fx.id] + ' <b>' + (FX_NAMES[fx.id] || 'POWER-UP').toUpperCase() + '</b> — ' + ({
        flames: 'you’re literally on fire!',
        daiquiri: 'fresh legs, you’re faster!',
        fizz: 'you’re bubbling, dance it out!',
        zap: 'you grabbed the LIVE end — you’re crackling!',
        balloon: 'up you go — the club looks better from in here!',
        prism: 'you caught the light — now you ARE the light!',
        cone: 'the cone chooses its own. wear it with honour.',
        popper: 'POP! you’re the moment now!',
        fog: 'atmosphere follows you around.',
        notes: 'a kazoo solo nobody asked for. beautiful.',
        glitter: 'it’s NEVER coming out of the peel.',
        flash: 'the flash is stuck on — strike a pose!',
        slide: 'zero friction. good luck stopping!',
        bubbles: 'big bubbles, no troubles.',
        espresso: 'the closing-shift special — HOLD ON!',
        lagoon: 'cool as the deep end.',
        boots: 'one small step for banana — BOING!',
        wobble: 'your legs went full jelly. dance anyway!',
        sparkler: 'write your name on the night!',
        magnet: 'the floor’s jelly wants YOU!',
        vhs: 'tracking error — you’re glitching!',
        conga: 'you brought backup — it’s a conga line!',
        slice: 'dinner AND a show — hold it high!',
        box: 'the WHOLE box — +15 jelly, no regrets!',
        sugar: 'SUGAR RUSH — shake it off, shake it ALL off!',
        colada: 'the floor is a hammock now, sway with it.',
        margarita: 'spicy rim, fire breath — olé!',
        champagne: 'somebody’s celebrating — it’s you!',
        milkshake: 'off the menu, onto the hips.',
        jellyshot: 'DOUBLE jelly on everything — quick!',
        water: 'squeaky clean — Barty’s orders. dress up again!',
      }[fx.id] || '') + chainTag();
      (el('rvToasts') || floor).appendChild(toast); // the stack: simultaneous pickups pile up, never overlap
      setTimeout(() => toast.remove(), 4500);
      // one-shot garnishes on top of the timed window
      if (fx.id === 'popper') confettiBurst();
      // WATER, Barty insists: the sober-up — EVERYTHING comes off (clothes,
      // effects, the lot). A clean default banana, and the closet's right
      // there. (Trym: "forces you to go and dress up again")
      if (fx.id === 'water') { soberUp(); addHype(8); showBubble('fresh as the day you were peeled.', false, 3200, 'mutter'); }
      track('rave_fx', { fx: fx.id });
    } else {
      showBubble(FX_ICON[fx.id] + ' ' + autoName(r.outfit) + ' got the ' + (FX_NAMES[fx.id] || 'good stuff') + '!', false, 5000);
    }
  }

  function soberUp() {
    const me = myId && ravers.get(myId);
    if (!me) return;
    me.outfit = { hat: '', glasses: '', extras: {}, effect: 'none' };
    me.fx = null; // "no effects" means NO effects — the water glow goes too
    prevEffect = null; // the hype drop must not re-dress the stripped effect
    refreshHud();
    // sober: true also clears the server-held beer + fx — a clean slate is a clean slate
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'outfit', outfit: me.outfit, sober: true }));
  }

  function pickVinyl(id) {
    const r = ravers.get(id);
    if (!r || r.vinyl) return;
    r.vinyl = true;
    vinylWinClaimed = Math.floor((Date.now() / 1000 - VINYL_OFFSET) / VINYL_PERIOD);
    const vs = vinylSpotFor(vinylWinClaimed);
    pickupPop(vs.x, vs.y);
    showBubble('💿 ' + autoName(r.outfit) + ' found a lost record — run it to the DJ!', false, 6000);
    refreshHud();
    if (id === myId) {
      bumpChain();
      // unmissable self-feedback — the bar bubble is easy to overlook mid-dance
      const toast = document.createElement('div');
      toast.className = 'rv-glowtoast';
      toast.innerHTML = '💿 <b>YOU GOT THE RECORD</b> — run it up to the DJ!';
      (el('rvToasts') || floor).appendChild(toast); // the stack: simultaneous pickups pile up, never overlap
      setTimeout(() => toast.remove(), 5000);
      track('rave_vinyl_pickup');
    }
  }

  function deliverVinyl(id) {
    const r = ravers.get(id);
    if (!r || !r.vinyl) return;
    r.vinyl = false;
    miniDropUntil = Date.now() + 6000; // the whole floor gets a bonus drop
    showBubble('💿 ' + autoName(r.outfit) + ' dropped a banger!', false, 7000);
    refreshHud();
    if (id === myId) { track('rave_vinyl_delivered'); passPatch('courier'); passStat('vinyls'); }
  }

  function rhythmTick() {
    const t = Date.now() / 1000;
    // — the spotlight: lands somewhere new every 2 minutes; stand in it to shine —
    const spotEl = el('rvSpot');
    const sPh = (((t - SPOT_OFFSET) % SPOT_PERIOD) + SPOT_PERIOD) % SPOT_PERIOD;
    if (sPh < SPOT_LEN) {
      const s = spotFor(Math.floor((t - SPOT_OFFSET) / SPOT_PERIOD));
      spotEl.hidden = false;
      spotEl.style.left = s.x + '%';
      spotEl.style.top = s.y + '%';
      for (const r of ravers.values()) {
        const lit = !r.stage && Math.hypot(r.x - s.x, r.y - s.y) < SPOT_R;
        r.wrap.classList.toggle('rv-lit', lit);
        if (lit && r.id === myId) {
          addHype(2); // basking in the light per rhythm tick
          nightEvent('spotlight');
          if (!r.spotTracked) { r.spotTracked = true; track('rave_spotlight'); passPatch('spotlight'); }
        }
      }
    } else if (!spotEl.hidden) {
      spotEl.hidden = true;
      for (const r of ravers.values()) r.wrap.classList.remove('rv-lit');
    }
    // — floor items, CAPPED (Trym's rule): a couple on the floor at most, never a
    // flood. Blocks run in priority order (quest vinyl outranks power-ups); when
    // the cap is full, lower items simply wait invisible for their next window.
    const MAX_FLOOR_ITEMS = 2;
    let floorItems = 0;
    // — the lost vinyl: spawns every 7 minutes, first to reach it becomes the courier —
    const vEl = el('rvVinyl');
    const vPh = (((t - VINYL_OFFSET) % VINYL_PERIOD) + VINYL_PERIOD) % VINYL_PERIOD;
    const vWin = Math.floor((t - VINYL_OFFSET) / VINYL_PERIOD);
    const carried = [...ravers.values()].some((r) => r.vinyl);
    // the record is RARE now — every third window (~21 min): its bonus drop
    // stacked with jelly time and the clock into "drops all the time" (Trym).
    // While a night quest asks for it, the AMBIENT record hides — the quest
    // spawns its own personal vinyl, and two records + a stored jelly time
    // was "3 drops in a row, a bit much" (Trym). Client-side skip only, so
    // every shown window is still a real worker window — no deploy.
    const questVinyl = night && night.def && night.def.steps[night.step] && night.def.steps[night.step].check === 'qvinyl';
    if (vPh < VINYL_WAIT && !questVinyl && vWin % 3 === 0 && vinylWinClaimed !== vWin && !carried) {
      const s = vinylSpotFor(vWin);
      floorItems++;
      vEl.style.display = '';
      vEl.style.left = s.x + '%';
      vEl.style.top = s.y + '%';
      vinylLive = s;
    } else {
      vEl.style.display = 'none';
      vinylLive = null;
    }
    // — THE GOLDEN BANANA: rare; the finder mints a patch, everyone parties —
    const goEl = el('rvGold');
    const goPh = (((t - GOLD_OFFSET) % GOLD_PERIOD) + GOLD_PERIOD) % GOLD_PERIOD;
    const goWin = Math.floor((t - GOLD_OFFSET) / GOLD_PERIOD);
    if (goPh < GOLD_WAIT && goldWinClaimed !== goWin && floorItems < MAX_FLOOR_ITEMS) {
      const gs = goldSpotFor(goWin);
      floorItems++;
      goEl.style.display = '';
      goEl.style.left = gs.x + '%';
      goEl.style.top = gs.y + '%';
      goldLive = gs;
    } else {
      goEl.style.display = 'none';
      goldLive = null;
    }
    // — THE CONVEYOR: a fresh item lands every 75 seconds, forever — the floor is
    // never dead (Trym's brief: solo visitors need a constant chase) —
    const itEl = el('rvItem');
    const iPh = (((t - ITEM_OFFSET) % ITEM_PERIOD) + ITEM_PERIOD) % ITEM_PERIOD;
    const iWin = Math.floor((t - ITEM_OFFSET) / ITEM_PERIOD);
    if (iPh < ITEM_WAIT && itemWinClaimed !== iWin && floorItems < MAX_FLOOR_ITEMS) {
      const isp = itemSpotFor(iWin);
      const kind = itemTypeFor(iWin);
      floorItems++;
      if (itEl.dataset.kind !== kind) { itEl.dataset.kind = kind; itEl.innerHTML = ITEM_SVGS[kind]; }
      itEl.style.display = '';
      itEl.style.left = isp.x + '%';
      itEl.style.top = isp.y + '%';
      itemLive = { x: isp.x, y: isp.y, win: iWin, kind };
    } else {
      // window over: an UNCLAIMED item leaves in a puff of smoke — you had
      // your five seconds (claimed ones vanish via the pickup pop instead)
      if (itemLive && itemWinClaimed !== itemLive.win && itEl.style.display !== 'none') {
        poofAt(itemLive.x, itemLive.y, 0.8);
      }
      itEl.style.display = 'none';
      itemLive = null;
    }
    // — the twinkle: the next item announces its landing spot 4s early — race it —
    const twEl = el('rvTwinkle');
    if (iPh > ITEM_PERIOD - 4) {
      const nsp = itemSpotFor(iWin + 1);
      twEl.hidden = false;
      twEl.style.left = nsp.x + '%';
      twEl.style.top = nsp.y + '%';
    } else {
      twEl.hidden = true;
    }
    // — the hype economy: ACTIONS fill the meter, walking merely sustains it —
    // 0.7/tick filled it by strolling alone and the pellets felt like nothing
    // (Trym: "already fully hyped... nulling itself out")
    const meH = myId && ravers.get(myId);
    if (meH && !meH.stage && meH.lastMoveAt && Date.now() - meH.lastMoveAt < 600) {
      addHype(0.25);
    } else if (meH && meH.stage) {
      addHype(0.35); // performing keeps the meter warm — the stage must not bleed you dry
    } else if (hype > 0 && Date.now() - lastHypeGain > 2500 && Date.now() >= hypeModeUntil) {
      hype = Math.max(0, hype - 1.2);
      renderHype();
    }
    // the chain readout lives on the mixer; it fades when the chain window lapses
    const chainRow = el('rvChainRow');
    const chainLive = chain > 1 && Date.now() - chainAt < CHAIN_MS;
    chainRow.hidden = !chainLive;
    if (chainLive) el('rvChainN').textContent = chain;
    // — THE WAVE: Barty calls it, emote in time to join the ripple (staff always join) —
    const wvPh = (((t - WAVE_OFFSET) % WAVE_PERIOD) + WAVE_PERIOD) % WAVE_PERIOD;
    const wvWin = Math.floor((t - WAVE_OFFSET) / WAVE_PERIOD);
    if (wvPh < WAVE_LEN) {
      if (waveWin !== wvWin) {
        waveWin = wvWin;
        wavers.clear();
        if (!tourActive) showBubble('🌊 WAAAVE! smash any emote NOW!', true); // never over the tour
      }
    } else if (waveWin === wvWin) {
      waveWin = -1; // fires exactly once per window
      hideBubble();
      runWave();
    }
  }
  setInterval(rhythmTick, 500);

  // claims run at FRAME rate against what rhythmTick put on the floor — the old
  // 500ms tick + 2s retry cooldown meant you could walk clean OVER an item and
  // miss the window (Trym: "i can walk over them several times")
  let vinylLive = null, goldLive = null, itemLive = null;
  function tryClaims(now) {
    if (tourActive) return; // hidden items can't be grabbed mid-tour
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    if (vinylLive && !me.vinyl && now - lastVinylTry > 800 && Math.hypot(me.x - vinylLive.x, me.y - vinylLive.y) < GRAB_R) {
      lastVinylTry = now;
      if (ws && ws.readyState === 1) sendClaim('{"t":"vinyl"}');
      else pickVinyl(myId); // solo mode
    }
    // the delivery: carrier reaches the stage edge → bonus drop for everyone
    if (me.vinyl && me.y < 18 && me.x > 26 && me.x < 74 && now - lastVinylTry > 800) {
      lastVinylTry = now;
      if (ws && ws.readyState === 1) sendClaim('{"t":"vinylDrop"}');
      else deliverVinyl(myId);
    }
    if (goldLive && now - lastGoldTry > 800 && Math.hypot(me.x - goldLive.x, me.y - goldLive.y) < GRAB_R) {
      lastGoldTry = now;
      if (ws && ws.readyState === 1) sendClaim('{"t":"gold"}');
      else claimGold(myId);
    }
    if (itemLive && now - lastItemTry > 800 && Math.hypot(me.x - itemLive.x, me.y - itemLive.y) < GRAB_R) {
      lastItemTry = now;
      const soloFx = { sauce: 'flames', zap: 'zap', fizz: 'fizz', balloon: 'balloon', ...MENU_FX }[itemLive.kind];
      if (ws && ws.readyState === 1) sendClaim('{"t":"item"}');
      else itemGrant(myId, itemLive.win, itemLive.kind, soloFx ? { id: soloFx, until: Date.now() + fxLen(soloFx) } : undefined);
    }
    // the bar: "at the bar" = ADJACENT TO THE ACTUAL COUNTER, not a fixed
    // rectangle — the solid counter's edge scales with the floor (x≈50% on
    // phones), so the old x<34 zone was unreachable when you approached from
    // the right and stopped against the counter. Nothing happened. (Trym)
    const atBar = me.x < Math.max(BAR_ZONE.x, barSolid.x + 4) && me.y > BAR_ZONE.y;
    if (barBeerLive && atBar && !(me.outfit.extras && me.outfit.extras.beer) && now - lastBeerTry > 800) {
      lastBeerTry = now;
      if (ws && ws.readyState === 1) sendClaim('{"t":"beer"}');
      else claimBeer(myId); // solo mode: the bar is all yours
    }
    if (barSpecialLive && atBar && now - lastCocktailTry > 800) {
      lastCocktailTry = now;
      if (ws && ws.readyState === 1) sendClaim('{"t":"cocktail"}');
      else { // solo mode
        cocktailWinClaimed = barSpecialLive.win;
        el('rvSpecial').hidden = true;
        applyFx(myId, { id: barSpecialLive.kind, until: Date.now() + fxLen(barSpecialLive.kind) }, { x: 10, y: 76 });
      }
    }
  }

  // ---- floor life: high-fives (proximity + recent movement = a mitten pops) ----
  const fived = new Map();
  function spawnFive(x, y) {
    const d = document.createElement('div');
    d.className = 'rv-five';
    d.style.left = x + '%';
    d.style.top = y + '%';
    // TWO gloves bumping — one mitten alone read as "a white ball" (Trym)
    d.innerHTML = '<span class="rv-five__l">' + MITT_SVG + '</span><span class="rv-five__r">' + MITT_SVG + '</span>';
    world.appendChild(d);
    setTimeout(() => d.remove(), 1600);
  }
  const zappedPair = new Map(); // static-discharge cooldown per pair
  setInterval(() => {
    if (tourActive) return; // no mittens or shocks popping mid-lesson
    const now = Date.now();
    const list = [...ravers.values()].filter((r) => !r.stage).slice(0, 40);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        // the cone of honour draws people in — high-fives reach further
        const coneOn = (fxActive(a, now) && a.fx.id === 'cone') || (fxActive(b, now) && b.fx.id === 'cone');
        if (Math.hypot(a.x - b.x, a.y - b.y) > FIVE_DIST * (coneOn ? 1.6 : 1)) continue;
        // static discharge: brush past a CHARGED banana and you FEEL it — the
        // uncharged one shock-blinks (both clients compute this from the fx +
        // positions they already share; zero new traffic)
        const aZap = fxActive(a, now) && a.fx.id === 'zap';
        const bZap = fxActive(b, now) && b.fx.id === 'zap';
        if (aZap !== bZap) {
          const key = a.id < b.id ? a.id + b.id : b.id + a.id;
          if ((zappedPair.get(key) || 0) <= now) {
            zappedPair.set(key, now + 5000);
            const victim = aZap ? b : a;
            victim.shockUntil = now + 460; // the ungated loop renders + ends the blink
            if (victim.id === myId) addHype(4); // a jolt IS hype
          }
        }
        const moved = (a.lastMoveAt && now - a.lastMoveAt < 8000) || (b.lastMoveAt && now - b.lastMoveAt < 8000);
        if (!moved) continue; // idle clusters don't spontaneously combust into greetings
        const key = a.id < b.id ? a.id + b.id : b.id + a.id;
        if ((fived.get(key) || 0) > now) continue;
        fived.set(key, now + FIVE_COOLDOWN);
        spawnFive((a.x + b.x) / 2, Math.min(a.y, b.y) - 9); // ABOVE both heads — between them it hid behind the sprites
        if (a.id === myId || b.id === myId) {
          track('rave_highfive');
          passStat('fives');
          tonight.fives += 1;
          refreshStats();
        }
      }
    }
  }, 600);

  // ---- HUD ----
  function refreshHud() {
    el('rvCount').textContent = String(ravers.size);
    const board = el('rvBoard');
    const now = Date.now();
    const rows = [...ravers.values()]
      .sort((a, b) => a.joined - b.joined)
      .slice(0, 5)
      .map((r) => {
        const mins = Math.max(0, Math.floor((now - r.joined) / 60000));
        const name = (r.stage ? '⭐ ' : '') + (r.vinyl ? '💿 ' : '') + (r.outfit.extras && r.outfit.extras.beer ? '🍺 ' : '') + (fxActive(r, Date.now()) ? FX_ICON[r.fx.id] + ' ' : '') + autoName(r.outfit) + (r.id === myId ? ' (you)' : '');
        return `<li${r.id === myId ? ' class="rv-me"' : ''}><span>${name}</span><b>${mins}m</b></li>`;
      });
    board.innerHTML = rows.join('') || '<li><span>the floor awaits…</span></li>';
  }
  setInterval(refreshHud, 30000);

  // ---- websocket presence ----
  let ws = null;
  let lastPong = 0;
  function connect() {
    if (ws && ws.readyState <= 1) return; // already live or connecting — never stack sockets (a stacked one = an orphaned ghost)
    try { ws = new WebSocket(RAVE_WS); } catch (e) { return soloMode(); }
    ws.onopen = () => {
      online = true;
      lastPong = Date.now();
      el('rvStatus').textContent = 'live';
      el('rvStatus').className = 'rv-live';
      // sess = floor time so far: iOS re-sockets on every background/foreground,
      // and the server's stage gate must not restart with the socket
      ws.send(JSON.stringify({ t: 'hi', outfit: myOutfit(), sess: Date.now() - sessionStart }));
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'pong') { lastPong = Date.now(); }
      else if (m.t === 'roster') {
        myId = m.you;
        // a reconnect gets a fresh roster — clear ghosts from the dead session first
        const alive = new Set(m.all.map((p) => p.id));
        [...ravers.keys()].forEach((id) => { if (!alive.has(id)) dropRaver(id); });
        m.all.forEach((p) => addRaver(p, p.id === m.you));
        if (typeof m.beerWin === 'number') beerWin = m.beerWin; // late joiners learn this window's beer is gone
        if (typeof m.vinylWin === 'number') vinylWinClaimed = m.vinylWin;
        if (typeof m.sauceWin === 'number') sauceWinClaimed = m.sauceWin;
        if (typeof m.cocktailWin === 'number') cocktailWinClaimed = m.cocktailWin;
        if (typeof m.goldWin === 'number') goldWinClaimed = m.goldWin;
        if (typeof m.itemWin === 'number') itemWinClaimed = m.itemWin;
        m.all.forEach((p) => {
          const r = ravers.get(p.id);
          if (r && p.vinyl) r.vinyl = true; // drawn into the glove at render time
          if (r && p.fx) r.fx = capFx(p.fx); // active effects survive a rejoin (zap on its short fuse)
        });
        track('rave_join', { count: m.all.length });
        if (!welcomed) { welcomed = true; maybeTour(); }
      } else if (m.t === 'join') addRaver(m.p, false);
      else if (m.t === 'leave') dropRaver(m.id);
      else if (m.t === 'emote') floatEmote(m.id, m.k);
      else if (m.t === 'outfit') { const r = ravers.get(m.id); if (r) { r.outfit = m.outfit; refreshHud(); } }
      else if (m.t === 'move') {
        const r = ravers.get(m.id);
        if (r && !r.stage && r.id !== myId) { leanInto(r, m.x - r.x); setPos(r, m.x, m.y); }
      }
      else if (m.t === 'beer') claimBeer(m.id);
      else if (m.t === 'fx') {
        const tw = Date.now() / 1000;
        if (m.id === myId) bumpChain(); // bar cocktails and legacy grants chain too
        if (m.src === 'sauce') {
          sauceWinClaimed = Math.floor((tw - SAUCE_OFFSET) / SAUCE_PERIOD);
          applyFx(m.id, m.fx, sauceSpotFor(sauceWinClaimed));
        } else if (m.src === 'cocktail') {
          cocktailWinClaimed = Math.floor((tw - SPECIAL_OFFSET) / SPECIAL_PERIOD);
          el('rvSpecial').hidden = true;
          applyFx(m.id, m.fx, { x: 10, y: 76 }); // the pop lands over the bar counter
        } else applyFx(m.id, m.fx);
      }
      else if (m.t === 'item') itemGrant(m.id, m.win, m.kind, m.fx);
      else if (m.t === 'gold') claimGold(m.id);
      else if (m.t === 'vinyl') pickVinyl(m.id);
      else if (m.t === 'minidrop') deliverVinyl(m.id);
      else if (m.t === 'stage') {
        setStage(m.id, m.on);
        // taking the stage is an EVENT: Barty calls it, and YOUR join scrolls the
        // booth into view (on mobile you pressed a bottom button and never saw
        // yourself arrive up there — Trym)
        const sr = ravers.get(m.id);
        if (m.on && sr) showBubble('⭐ ' + autoName(sr.outfit) + ' takes the stage!', false, 4000);
        if (m.on && m.id === myId) {
          el('rvStage').scrollIntoView({ behavior: 'smooth', block: 'center' });
          // the join needs a MOMENT — wife-test: tapped the button, nothing
          // seemed to happen (the banana quietly teleported to a tiny row)
          bigMoment('YOU’RE ON THE STAGE 🔥', 'dance behind the DJ — tap ⭐ again to come down');
        }
      }
      else if (m.t === 'stageNo') {
        el('rvMore').textContent = m.reason === 'full' ? 'the stage is packed — try again soon' : 'not yet — keep dancing';
        setTimeout(() => { el('rvMore').textContent = ''; }, 4000);
      }
    };
    ws.onclose = () => { if (!online) soloMode(); else { el('rvStatus').textContent = 'reconnecting…'; setTimeout(connect, 3000 + Math.random() * 4000); } };
    ws.onerror = () => {};
  }
  // say a clean goodbye when actually LEAVING (navigation / tab close) so the floor
  // drops your ghost instantly — iOS never sends a close frame on its own and the
  // banana kept dancing for minutes (Trym caught his own ghost). Brief app-switches
  // deliberately do NOT disconnect: pocket-AFK endurance farming is the sport.
  addEventListener('pagehide', () => { try { if (ws) ws.close(); } catch (e) {} });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && online && (!ws || ws.readyState > 1)) connect();
  });

  // heartbeat with a DEADLINE: the server pongs without waking (auto-response), so a
  // missing pong = zombie socket (readyState lies at 1 after a worker redeploy or NAT
  // drop — send() goes into the void). Force-close → the onclose reconnect takes over.
  setInterval(() => {
    if (!ws || ws.readyState !== 1) return;
    if (lastPong && Date.now() - lastPong > 100000) {
      try { ws.close(); } catch (e) {}
      return;
    }
    try { ws.send('{"t":"ping"}'); } catch (e) {}
  }, 40000);

  function soloMode() {
    el('rvStatus').textContent = 'solo mode (connection trouble) — still dancing';
    myId = 'me';
    addRaver({ id: 'me', outfit: myOutfit(), joined: Date.now() }, true);
    if (!welcomed) { welcomed = true; maybeTour(); }
  }

  // ---- THE TOUR — the first-visit cinematic (Trym's spec: camera moves, big
  // pixel type, spotlight cutouts, "not just a big text box in the middle").
  // It replaced the old welcome show: same red-carpet job, done properly.
  // Once per device (rv-tour-v1); the ❓ button replays it; ends → Night 1.
  let tourActive = false, tourStep = -1, tourDemoEl = null;
  function maybeTour() {
    let seen = false;
    try { seen = !!localStorage.getItem('rv-tour-v1'); } catch (e) {}
    if (!seen || location.search.includes('tourtest')) {
      try { localStorage.setItem('rv-tour-v1', '1'); } catch (e) {}
      setTimeout(runTour, 1200);
    } else {
      nightInit();
    }
  }
  function tourCamTo(xPct, yPct, s) { // same math as updateCam, arbitrary target
    const px = (xPct / 100) * floorW * s;
    const py = (yPct / 100) * floorH * s;
    const tx = clamp(floorW / 2 - px, floorW - floorW * s, 0);
    const ty = clamp(floorH / 2 - py, floorH - floorH * s, 0);
    world.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }
  function bartyPct() { // Barty's floor spot from offsets — transform-immune
    const bm = el('rvBarman');
    const bar = bm.offsetParent; // .rv-bar
    return {
      x: ((bar.offsetLeft + bm.offsetLeft + bm.offsetWidth / 2) / floorW) * 100,
      y: ((bar.offsetTop + bm.offsetTop + bm.offsetHeight * 0.35) / floorH) * 100,
    };
  }
  // the big line anchors to a POINT (club coordinates) — above your banana on
  // step 1, centred over the floor on step 2. "Somewhere in the club" reads
  // as misaligned (Trym: "THIS IS YOU isn't centered").
  function tourBigAt(xPx, yPx, txt, sub) {
    const big = el('rvTourBig');
    el('rvTourBigTxt').textContent = txt;
    el('rvTourBigSub').textContent = sub || '';
    big.style.left = xPx + 'px';
    big.style.top = yPx + 'px';
    big.hidden = false;
  }
  function tourBox(target, title, text, opts = {}) { // spotlight pool (optional) + a captioned box beside it
    const pad = opts.pad != null ? opts.pad : 8;
    const pin = opts.pin;
    const cr = document.querySelector('.rv-club').getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const cx = r.left - cr.left + r.width / 2;
    const cy = r.top - cr.top + r.height / 2;
    const maxY = floor.offsetTop + floor.offsetHeight;
    let hx, hy, pw, ph;
    if (opts.noPool) {
      // corner targets get a CLOSE-UP instead of a pool — pressing an ellipse
      // into a corner skewed it off-centre (Trym); the zoom IS the highlight
      el('rvTourHl').hidden = true;
      pw = r.width + pad * 2;
      ph = r.height + pad * 2;
      hx = r.left - cr.left - pad;
      hy = r.top - cr.top - pad;
    } else {
      // the pool is an ELLIPSE ~1.8× the target (never smaller than a hand):
      // generous + feathered means off-by-a-few-px centering can't be seen.
      // It SHIFTS to stay inside the floor; the feather forgives the shift.
      pw = Math.min(Math.max(r.width * 1.8 + pad * 2, 130), cr.width - 8);
      ph = Math.min(Math.max(r.height * 1.8 + pad * 2, 110), maxY - 8);
      hx = clamp(cx - pw / 2, 4, cr.width - 4 - pw);
      hy = clamp(cy - ph / 2, 4, maxY - 4 - ph);
      const hl = el('rvTourHl');
      hl.style.left = hx + 'px';
      hl.style.top = hy + 'px';
      hl.style.width = pw + 'px';
      hl.style.height = ph + 'px';
      hl.hidden = false;
    }
    const box = el('rvTourBox');
    el('rvTourTitle').textContent = title;
    el('rvTourText').textContent = text;
    const bw = Math.min(250, cr.width - 20);
    box.style.maxWidth = bw + 'px';
    const bx = clamp(cx - bw / 2, 10, Math.max(10, cr.width - bw - 10));
    box.style.left = bx + 'px';
    box.hidden = false; // visible BEFORE measuring — offsetHeight is 0 while hidden
    if (pin === 'top') {
      // a full-floor pool has no "beside": the caption reads as a subtitle,
      // pinned under the booth, no arrow (you can't point at everything)
      box.dataset.side = 'none';
      box.style.top = (floor.offsetTop + 12) + 'px';
      box.style.bottom = 'auto';
    } else {
      const below = hy < cr.height * 0.5;
      box.dataset.side = below ? 'below' : 'above';
      // never into the control band: cap "below" boxes above the buttons
      const bandTop = el('rvTourBand').getBoundingClientRect().top - cr.top;
      box.style.top = below ? Math.min(hy + ph + 10, bandTop - box.offsetHeight - 10) + 'px' : 'auto';
      box.style.bottom = below ? 'auto' : (cr.height - hy + 10) + 'px';
      // the pixel arrow points at the TARGET, wherever the box got clamped to
      box.style.setProperty('--ax', clamp(cx - bx - 6, 10, bw - 28) + 'px');
    }
  }
  function tourClear() {
    el('rvTourHl').hidden = true;
    el('rvTourBig').hidden = true;
    el('rvTourBox').hidden = true;
    mixerEl.classList.remove('rv-mixer--tour'); // the meter steps back after its close-up
  }
  const TOUR = [
    () => { // tight on YOUR banana — the line sits right above your head
      const me = myId && ravers.get(myId);
      const s = 2.6;
      let sx = floorW / 2, sy = floorH / 2, half = 100;
      if (me) {
        tourCamTo(me.x, me.y, s);
        const px = (me.x / 100) * floorW * s, py = (me.y / 100) * floorH * s;
        sx = clamp(floorW / 2 - px, floorW - floorW * s, 0) + px;
        sy = clamp(floorH / 2 - py, floorH - floorH * s, 0) + py;
        half = ((me.size || 90) * s) / 2;
      }
      tourBigAt(
        clamp(sx, 130, floorW - 130),
        floor.offsetTop + clamp(sy - half - 108, 10, floorH - 150),
        'THIS IS YOU', me ? autoName(me.outfit) : ''
      );
    },
    () => { // pull back to the whole club
      world.style.transform = '';
      tourBigAt(floorW / 2, floor.offsetTop + floorH * 0.28, 'AND WELCOME TO THE CLUB', '');
      confettiBurst();
    },
    () => { // Barty gets the frame and his first hello
      const b = bartyPct();
      tourCamTo(b.x, b.y, 2.1);
      bartySay(['well howdy! 🤠 welcome to the CLUB, partner!', { t: 'we’ve been expectin’ ya. well. i have.', mutter: true }]);
    },
    () => { // who Barty is — the camera STAYS on him from his hello (a corner
      // pool skewed; the close-up IS the highlight)
      setTimeout(() => {
        if (tourActive && tourStep === 3) tourBox(el('rvBarman'), 'BARTY, THE BARTENDER', 'runs the bar, calls the happy hours — and always needs a hand with some little chore. help him out and he stamps your nightshift.', { noPool: true });
      }, 600);
    },
    () => { // the mixer: camera home; screen-space UI can't be zoomed, so the
      // meter itself steps forward for its close-up
      world.style.transform = '';
      mixerEl.classList.add('rv-mixer--tour');
      setTimeout(() => {
        if (tourActive && tourStep === 4) tourBox(mixerEl, 'THE JELLY METER', 'everything you do fills it with JELLY. when it’s FULL it starts flashing — tap the meter and the floor drops, just for you.', { noPool: true });
      }, 550);
    },
    () => { // the floor itself: full-floor pool, caption pinned up top like a subtitle
      const how = matchMedia('(pointer: coarse)').matches ? 'tap anywhere to walk over.' : 'walk with WASD, or click anywhere.';
      tourBox(el('rvTrails'), 'THE DANCE FLOOR', how + ' hoover up the jelly drops, catch what lands, bump into strangers.', { pad: -18, pin: 'top' });
    },
    () => { // the DJ
      tourBox(document.querySelector('.rv-djgroup'), 'TONIGHT’S DJ', 'the banana of the day is on the decks. every third minute: THE DROP. you’ll know it when it hits.');
    },
    () => { // an example item, spawned just for show
      tourDemoEl = document.createElement('div');
      tourDemoEl.className = 'rv-item';
      tourDemoEl.dataset.kind = 'candy';
      tourDemoEl.innerHTML = ITEM_SVGS.candy;
      tourDemoEl.style.left = '55%';
      tourDemoEl.style.top = '48%';
      tourDemoEl.style.animation = 'none'; // it holds still for its close-up (the bob made the light sit off-centre)
      world.appendChild(tourDemoEl);
      tourBox(tourDemoEl, 'FLOOR SNACKS', 'the crowd drops stuff all night. first banana to reach it keeps it — pickups chain, chains build JELLY. (and it keeps the floor clean. Barty notices.)', { pad: 12 });
    },
  ];
  function runTour() {
    if (tourActive || !myId || !ravers.get(myId)) return;
    tourActive = true;
    tourStep = -1;
    el('rvBubble').hidden = true; // Barty hushes mid-sentence — the tour has the floor
    world.classList.add('rv-world--tour');
    floor.classList.add('rv-tourclean'); // no chase-ables spawn mid-lesson, ever
    el('rvTour').hidden = false;
    // the control band: "tap to continue" centred + SKIP at its right, both
    // floating just above the HUD — the floor's top band belongs to the show
    // (and the club's very top hides under the sticky nav on mobile)
    const hud = document.querySelector('.rv-hud');
    el('rvTourBand').style.bottom = ((hud ? hud.offsetHeight : 60) + 14) + 'px';
    el('rvZoom').hidden = true; // the camera toggle isn't part of the show
    track('rave_tour_start');
    tourNext();
  }
  function tourNext() {
    tourStep++;
    tourClear();
    // steps 1–3 also hide the meters (furniture + staff only); the callout
    // steps un-hide them for their own close-ups
    floor.classList.toggle('rv-tourfocus', tourStep >= 0 && tourStep < 3);
    const step = TOUR[tourStep];
    if (!step) return endTour(false);
    step();
  }
  function endTour(skipped) {
    tourActive = false;
    tourClear();
    el('rvTour').hidden = true;
    world.classList.remove('rv-world--tour');
    floor.classList.remove('rv-tourclean');
    floor.classList.remove('rv-tourfocus');
    world.style.transform = '';
    camLastTx = null; // the follow-cam recomputes from scratch
    if (tourDemoEl) { tourDemoEl.remove(); tourDemoEl = null; }
    hideBubble();
    // class dismissed: pull back to the whole floor and start the set — the
    // tap that ends the tour is a live gesture, so audio may start right here.
    // Respect an explicit mute (rv-sound '0'): the ❓ replay never forces sound.
    cam.on = false;
    try { if (localStorage.getItem('rv-sound') !== '0' && !audioOn && !audioLoading) audioStart(); } catch (e) {}
    refreshZoomBtn(); // the camera toggle gets its corner back
    track(skipped ? 'rave_tour_skip' : 'rave_tour_done', { step: tourStep });
    nightInit(); // the tour hands straight off to Barty's first job
    // the first-night patch waits its turn — the welcome + tour own the first
    // minutes, so the PATCH EARNED toast lands 10s after the lesson (idempotent:
    // ❓ replays just no-op here)
    setTimeout(() => passPatch('raver'), 10000);
  }
  el('rvTour').addEventListener('click', (e) => {
    if (e.target.closest('.rv-tour__skip')) { endTour(true); return; }
    tourNext();
  });
  el('rvTourBtn').addEventListener('click', () => runTour());

  // ---- THE NIGHT: the quest layer, Act One (full design: the-night-plan) ----
  // Barty is the quest giver. His voice: over-cheerful southwestern bartender,
  // tragic childhood leaking out under the breath. Chat bubbles stay white;
  // QUEST bubbles go yellow; the active job docks under the hype bar with a
  // pixel checkbox. ONE night per calendar day (closure + a reason to return).
  // ?nighttest=N previews night N without saving progress.
  const NIGHTS = [
    { n: 1, steps: [ // FIRST NIGHTSHIFT — Barty's humble ask (Trym's line), then the chores
      { tray: 'go to the bar — first one’s on the house', check: 'bar',
        say: ['well howdy, new face! 🤠 i know you came to RAVE…', { t: '…everyone does. anyway!', mutter: true }, 'help an old banana with some chores? c’mon down to the bar — first one’s on the house!'] },
      { tray: 'run the lost record up to the DJ', check: 'qvinyl',
        say: ['there ya go! the DJ lost a record on the floor — run it up to the booth, would ya?', { t: 'errands build character. they’re all i had.', mutter: true }] },
      { tray: 'fill the JELLY meter — then hit JELLY TIME', check: 'hypedrop',
        say: ['WOO! last chore ain’t even a chore: fill that JELLY meter…', { t: '…and when she’s full, you know what time it is.', mutter: true }] },
    ], done: { patch: 'night1',
      say: ['FIRST NIGHTSHIFT done! 🌟 you’re one of us now — night two’s on me tomorrow.', { t: 'i’ll be here. i’m always here.', mutter: true }] } },
    { n: 2, steps: [ // look who's back — the broom debuts
      { tray: 'grab the broom at the bar, sweep the peels', check: 'sweep', targets: ['peel', 'peel', 'peel', 'peel'],
        say: ['well look who’s BACK! 🤠 knew it. folks always come back.', { t: '’cept pa.', mutter: true }, 'some ANIMAL left peels on my floor — grab the broom off the counter and sweep ’em up!'] },
      { tray: 'build a chain of THREE pickups', check: 'chain3',
        say: ['SPOTLESS! now — a CHAIN of THREE pickups, back to back, no dawdlin’!'] },
      { tray: 'stand in the spotlight when it lands', check: 'spotlight',
        say: ['look at you GO! 🤠 last one: stand in the SPOTLIGHT when it lands. you earned some shine.', { t: 'i had a spotlight once. it moved on.', mutter: true }] },
    ], done: { patch: null,
      say: ['shift’s OVER — back to clubbing, partner! same time tomorrow?', { t: 'i’ll count the hours. all of ’em.', mutter: true }] } },
    { n: 3, steps: [ // THE MONKEY debuts — the club's other staff member
      { tray: 'catch that monkey!', check: 'monkey',
        say: ['🐒 the MONKEY’s loose again! little bandit swiped my best bottle — catch him, partner!', { t: 'i named him. that was my mistake.', mutter: true }] },
      { tray: 'grab a floor snack, pay the monkey', check: 'feed',
        say: ['HA! got him! he only trades for snacks — grab somethin’ off the floor and pay the bandit.', { t: 'we all have a price. his is candy.', mutter: true }] },
    ], done: { patch: null,
      say: ['bottle’s BACK! that’s a nightshift, partner — back to clubbing!', { t: 'the monkey stays. everybody stays but says they won’t.', mutter: true }] } },
    { n: 4, steps: [ // THE LEAK + stage night
      { tray: 'grab the broom, mop up the puddles', check: 'sweep', targets: ['puddle', 'puddle', 'puddle'],
        say: ['EMERGENCY! ⚠️ pipe burst — PUDDLES on my floor! broom’s on the counter. GO!', { t: 'the plumbing’s older than the wiring. i’m older than both.', mutter: true }] },
      { tray: 'when the stage opens: get up there, throw a 🔥', check: 'stagefire',
        say: ['DRY! now get ON that stage when it opens and throw a 🔥 — tonight YOU’RE the show.', { t: 'i was the show once. one night. 1987.', mutter: true }] },
    ], done: { patch: null,
      say: ['what a SHIFT. the club owes ya one, partner — back to clubbing!', { t: 'the club never pays its debts. anyway!', mutter: true }] } },
    { n: 5, steps: [ // THE REGULAR — the best-of shift
      { tray: 'grab the broom — one last sweep of the mess', check: 'sweep', targets: ['peel', 'peel', 'peel', 'puddle', 'puddle'],
        say: ['night FIVE, partner. 🤠 the full mess: peels AND puddles. you know where the broom is.', { t: 'you know where everything is now. that’s how it gets you.', mutter: true }] },
      { tray: 'survive THE DROP on the floor', check: 'drop',
        say: ['CLEAN! now stay on that floor for THE DROP — every third minute, you know the clock by now.'] },
      { tray: 'one more JELLY TIME — end it right', check: 'hypedrop',
        say: ['LAST one’s a treat: fill that JELLY meter and end your shift the only right way.', { t: 'endings should be loud. mine wasn’t.', mutter: true }] },
    ], done: { patch: null,
      say: ['FIVE nightshifts, partner. you’re not a guest anymore.', { t: 'guests leave.', mutter: true }, 'that stool by the bar? YOURS. always. now — back to clubbing! ⭐'] } },
  ];
  const NIGHT_TEST = parseInt((location.search.match(/nighttest=(\d)/) || [])[1] || '0', 10);
  const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function nightLoad() { try { return JSON.parse(localStorage.getItem('rv-night-v1') || '{}'); } catch (e) { return {}; } }
  let night = null; // { def, step, qv }
  const questKicker = (txt) => { document.querySelector('.rv-quest__k').textContent = txt; };
  // the receipt answers BOTH questions Trym couldn't: WHICH shift you finished
  // and WHEN the next one opens ("done, doing something i dont remember, but i
  // dont know when or how i advance")
  function nightReceipt(doneN) {
    questKicker('quests ✔');
    nightTray(doneN < NIGHTS.length
      ? 'done! shift ' + (doneN + 1) + ' opens tomorrow — back to clubbing'
      : 'all five shifts done — you’re a regular ⭐', true);
  }
  function nightInit() {
    if (night) return; // a tour replay must not restart a night in progress
    const s = nightLoad();
    if (!NIGHT_TEST && s.lastStamp === localDay()) {
      // already stamped tonight: the chip stays as the day's receipt — an
      // empty corner read as "broken", not "done"
      nightReceipt(Math.min(Math.max((s.arc || 2) - 1, 1), NIGHTS.length));
      return;
    }
    const arc = NIGHT_TEST || s.arc || 1;
    if (arc > NIGHTS.length) { nightReceipt(NIGHTS.length); return; } // Act One done — Act Two arrives with "the program"
    night = { def: NIGHTS[arc - 1], step: -1 };
    questKicker('quests'); // fresh users read QUESTS — the shift lore lives in the tray text (wife-test: "SHIFT" meant nothing)
    setTimeout(nightAdvance, 2500); // a breath after the tour (or the join), then Barty's first job
  }
  // the BIG MOMENT: pixel-type over the floor for session-defining beats —
  // the stamp-out must be unmissable (a toast is a "nice moment" register)
  function bigMoment(title, sub) {
    const d = document.createElement('div');
    d.className = 'rv-bigmoment';
    d.innerHTML = '<b></b><small></small>';
    d.querySelector('b').textContent = title;
    d.querySelector('small').textContent = sub || '';
    floor.appendChild(d);
    setTimeout(() => d.classList.add('rv-bigmoment--out'), 3800);
    setTimeout(() => d.remove(), 4400);
  }
  // small screens get progressive disclosure: a new job announces itself,
  // then tucks behind the TONIGHT chip after a read — the floor view wins
  // (Trym: "how can we not present everything all at once"). Tap toggles.
  const questSmall = matchMedia('(max-width: 640px)');
  let questTuckT = null;
  function nightTray(txt, done) {
    const q = el('rvQuest');
    if (txt === null) { q.hidden = true; return; }
    q.hidden = false;
    el('rvQuestBox').classList.toggle('done', !!done);
    el('rvQuestTxt').textContent = txt;
    clearTimeout(questTuckT);
    q.classList.remove('rv-quest--min'); // news always shows itself first
    if (questSmall.matches) questTuckT = setTimeout(() => q.classList.add('rv-quest--min'), 7000);
  }
  el('rvQuest').addEventListener('click', () => {
    if (!questSmall.matches) return; // desktop never collapses — space is free
    clearTimeout(questTuckT);
    el('rvQuest').classList.toggle('rv-quest--min');
  });
  function nightAdvance() {
    if (!night) return;
    if (location.search.includes('nightdebug')) console.log('[night] advance from step', night.step, new Error().stack.split('\n')[2]);
    if (night.step >= 0) { // tick the finished box for a beat before what's next
      nightTray(night.def.steps[night.step].tray, true);
      track('rave_night_step', { night: night.def.n, step: night.step });
    }
    night.step++;
    const st = night.def.steps[night.step];
    setTimeout(() => {
      if (!night) return;
      if (st) {
        bartySay(st.say, true);
        nightTray(st.tray, false);
        if (st.check === 'bar') el('rvQuestDrink').style.display = ''; // the promised drink WAITS on the counter
        if (st.check === 'qvinyl') nightSpawnVinyl();
        if (st.check === 'sweep') { spawnChores(st.targets); el('rvBroomProp').style.display = ''; } // the broom leans on the counter
        if (st.check === 'monkey') monkeySpawn();
      } else {
        nightStamp();
      }
    }, night.step === 0 ? 0 : 1400);
  }
  function nightSpawnVinyl() { // the QUEST record: personal, clones the floor sprite
    const me = myId && ravers.get(myId);
    let x = 50, y = 50;
    for (let i = 0; i < 20; i++) {
      x = 15 + Math.random() * 70; y = 28 + Math.random() * 44;
      if (!insideBar(x, y) && (!me || Math.hypot(x - me.x, y - me.y) > 24)) break;
    }
    const q = el('rvVinyl').cloneNode(true);
    q.id = 'rvQVinyl';
    q.style.display = '';
    q.style.left = x + '%';
    q.style.top = y + '%';
    world.appendChild(q);
    night.qv = { el: q, x, y };
  }
  // ---- chores: sweepables (peels + puddles), swept while HOLDING the broom ----
  function spawnChores(kinds) {
    const host = el('rvChores');
    host.innerHTML = '';
    night.chores = [];
    for (const kind of kinds) {
      let x = 50, y = 50;
      for (let t = 0; t < 30; t++) {
        x = 12 + Math.random() * 74;
        y = clamp(26 + Math.random() * 58, topClamp + 6, 86);
        if (!insideBar(x, y) && night.chores.every((c) => Math.hypot(c.x - x, c.y - y) > 13)) break;
      }
      const d = document.createElement('div');
      d.className = 'rv-chore rv-chore--' + kind;
      d.innerHTML = kind === 'peel' ? PEEL_SVG : PUDDLE_SVG;
      d.style.left = x + '%';
      d.style.top = y + '%';
      host.appendChild(d);
      night.chores.push({ x, y, elm: d, done: false });
    }
  }
  function clearChores() {
    const h = el('rvChores');
    if (h) h.innerHTML = '';
    if (night) night.chores = null;
  }
  // ---- THE MONKEY: the club's chaos agent — staff pet, THEATRICAL guest,
  // never a fake visitor (the sacred rule). Flees the chaser, a hair slower
  // than a banana: catchable by commitment, not luck. ----
  let monkey = null;
  function monkeySpawn() {
    if (monkey) monkeyRemove();
    const d = document.createElement('div');
    d.className = 'rv-monkey';
    d.innerHTML = MONKEY_SVG;
    world.appendChild(d);
    monkey = { x: 50, y: topClamp + 8, tx: 25 + Math.random() * 50, ty: 45, el: d, mode: 'loose', lastPick: 0 };
    d.style.width = Math.round((74 + monkey.y * 0.9) * 0.38) + 'px'; // depth-sized from the first frame
    pickupPop(monkey.x, monkey.y); // pops in from the booth side — an ENTRANCE
  }
  function monkeyRemove() { if (monkey) { monkey.el.remove(); monkey = null; } }
  function monkeyTick(now, dtMs) {
    if (!monkey || monkey.mode !== 'loose') return;
    const me = myId && ravers.get(myId);
    if (me) {
      const d = Math.hypot(me.x - monkey.x, me.y - monkey.y);
      if (d < 18 && now - monkey.lastPick > 650) { // flee the chaser
        monkey.lastPick = now;
        const ang = Math.atan2(monkey.y - me.y, monkey.x - me.x) + (Math.random() - 0.5) * 1.2;
        monkey.tx = clamp(monkey.x + Math.cos(ang) * 30, 8, 92);
        monkey.ty = clamp(monkey.y + Math.sin(ang) * 24, topClamp + 4, 86);
        if (insideBar(monkey.tx, monkey.ty)) monkey.ty = Math.max(topClamp + 4, barSolid.y - 8);
      } else if (now - monkey.lastPick > 2600 && Math.hypot(monkey.tx - monkey.x, monkey.ty - monkey.y) < 2) {
        monkey.lastPick = now; // amble somewhere new
        monkey.tx = 12 + Math.random() * 76;
        monkey.ty = clamp(24 + Math.random() * 60, topClamp + 4, 86);
        if (insideBar(monkey.tx, monkey.ty)) monkey.ty = Math.max(topClamp + 4, barSolid.y - 8);
      }
    }
    const dx = monkey.tx - monkey.x, dy = monkey.ty - monkey.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.8) {
      const step = (13.5 * dtMs) / 1000;
      monkey.x += (dx / dist) * Math.min(step, dist);
      monkey.y += (dy / dist) * Math.min(step, dist);
      monkey.el.style.left = monkey.x + '%';
      monkey.el.style.top = monkey.y + '%';
      monkey.el.style.zIndex = String(100 + Math.round(monkey.y));
      // the monkey obeys the floor's fake depth like every dancer (deeper =
      // bigger) — a fixed size broke the perspective (Trym)
      monkey.el.style.width = Math.round((74 + monkey.y * 0.9) * 0.38) + 'px';
      monkey.el.style.transform = 'translate(-50%, -50%)' + (dx < 0 ? ' scaleX(-1)' : '');
    }
  }
  // the regular's stool: N5's privilege — furniture that is YOURS, forever.
  // It sits at the counter's edge, and it WORKS: click it, walk over, sit
  // down (dance freezes on the resting pose); any move stands you back up.
  let sitting = false, pendingSit = false, stoolPos = null;
  function stoolRender() {
    try { if (localStorage.getItem('rv-stool') !== '1') return; } catch (e) { return; }
    if (document.getElementById('rvStool')) return;
    // by the counter's right edge, just behind its top — device-aware like the
    // bar zone itself (barSolid scales with the floor)
    // at the counter's END — snug against its right edge, on the open-floor
    // side (the counter-top already holds the drinks + broom, and mid-floor
    // read as "a chair standing alone" — Trym). Clamped into the walkable
    // floor: an unreachable stool is furniture-only.
    stoolPos = { x: clamp(barSolid.x + 2, 10, 62), y: clamp(barSolid.y - 1, topClamp + 6, 91) };
    const d = document.createElement('div');
    d.id = 'rvStool';
    d.className = 'rv-stool';
    d.innerHTML = STOOL_SVG;
    d.style.left = stoolPos.x + '%';
    d.style.top = stoolPos.y + '%';
    d.style.zIndex = String(100 + Math.round(stoolPos.y) - 1); // just under the sitter
    d.addEventListener('click', (e) => {
      e.stopPropagation(); // a stool click is a SIT order, not a walk order
      const me = myId && ravers.get(myId);
      if (!me || me.stage) return;
      pendingSit = true;
      walkTarget = { x: stoolPos.x, y: stoolPos.y };
      track('rave_sit');
    });
    world.appendChild(d);
  }
  function nightFrame(now) { // proximity checks at frame rate (the claims lesson)
    if (!night || night.step < 0) return;
    const st = night.def.steps[night.step];
    if (!st) return;
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    if (now - (night.lastPoll || 0) < 120) return;
    night.lastPoll = now;
    if (st.check === 'bar' && me.x < Math.max(BAR_ZONE.x, barSolid.x + 4) && me.y > BAR_ZONE.y) {
      // the house pour moves from the counter into your glove — a promised
      // drink you can SEE is a promise kept (local-only; it's your moment)
      el('rvQuestDrink').style.display = 'none';
      me.outfit.extras = { ...(me.outfit.extras || {}), beer: true };
      pickupPop(me.x, me.y);
      nightAdvance();
    } else if (st.check === 'qvinyl' && night.qv) {
      if (!me.qvinyl) {
        const dxq = ((me.x - night.qv.x) / 100) * floorW, dyq = ((me.y - night.qv.y) / 100) * floorH;
        if (Math.hypot(dxq, dyq) < (me.size || 90) * 0.6) {
          me.qvinyl = true; // rides the left glove via the engine (render-time inject)
          night.qv.el.remove();
          pickupPop(night.qv.x, night.qv.y);
          bartySay(['that’s the one! up to the booth with it, partner!'], true);
        }
      } else if (me.y < 18 && me.x > 26 && me.x < 74) {
        me.qvinyl = false;
        miniDropUntil = Date.now() + 6000; // your delivery, your bonus drop
        nightAdvance();
      }
    } else if (st.check === 'sweep') {
      if (!me.qbroom) {
        // first: the broom, off the counter (adjacency zone, like every bar visit)
        if (me.x < Math.max(BAR_ZONE.x, barSolid.x + 4) && me.y > BAR_ZONE.y) {
          me.qbroom = true; // rides the right glove via the engine
          el('rvBroomProp').style.display = 'none';
          pickupPop(me.x, me.y);
          const total = night.chores ? night.chores.length : 0;
          nightTray(st.tray + ' — 0/' + total, false);
        }
      } else if (night.chores) {
        const rPx = (me.size || 90) * 0.55;
        let left = 0, hit = false;
        for (const c of night.chores) {
          if (c.done) { continue; }
          if (Math.hypot(((me.x - c.x) / 100) * floorW, ((me.y - c.y) / 100) * floorH) < rPx) {
            c.done = true;
            hit = true;
            c.elm.classList.add('rv-chore--swept');
            const gone = c.elm;
            setTimeout(() => gone.remove(), 500);
            pickupPop(c.x, c.y);
            addHype(4); // chores are jelly too
          } else {
            left++;
          }
        }
        if (hit) {
          const total = night.chores.length;
          if (left) {
            nightTray(st.tray + ' — ' + (total - left) + '/' + total, false);
          } else {
            me.qbroom = false; // Barty takes the good broom back
            nightAdvance();
          }
        }
      }
    } else if (st.check === 'monkey' && monkey && monkey.mode === 'loose') {
      if (Math.hypot(me.x - monkey.x, me.y - monkey.y) < 6.5) {
        monkey.mode = 'caught'; // sits still, waits for his price
        monkey.el.classList.add('rv-monkey--calm');
        pickupPop(monkey.x, monkey.y);
        nightAdvance();
      }
    } else if (st.check === 'feed' && monkey && night.snack) {
      if (Math.hypot(me.x - monkey.x, me.y - monkey.y) < 7.5) {
        night.snack = false;
        pickupPop(monkey.x, monkey.y);
        const m = monkey; // paid — waves off and scampers backstage
        monkey = null;
        setTimeout(() => {
          m.el.classList.add('rv-monkey--off');
          setTimeout(() => m.el.remove(), 900);
        }, 1500);
        nightAdvance();
      }
    }
  }
  function nightEvent(kind, val) { // hooks fired by the floor's own machinery
    if (!night || night.step < 0) return;
    const st = night.def.steps[night.step];
    if (!st) return;
    if (st.check === 'feed' && kind === 'item' && !night.snack) {
      night.snack = true; // any floor grab is monkey currency
      nightTray('got one — bring the snack to the monkey', false);
      return;
    }
    if ((st.check === 'hypedrop' && kind === 'hypedrop')
      || (st.check === 'chain3' && kind === 'chain' && val >= 3)
      || (st.check === 'spotlight' && kind === 'spotlight')
      || (st.check === 'stagefire' && kind === 'fire')
      || (st.check === 'drop' && kind === 'drop')) nightAdvance();
  }
  function nightStamp() {
    const d = night.def;
    // tidy the props before the ceremony (whatever the shift left behind)
    clearChores();
    monkeyRemove();
    el('rvBroomProp').style.display = 'none';
    const meS = myId && ravers.get(myId);
    if (meS) meS.qbroom = false;
    night = null;
    // THE STAMP-OUT: your shift ends, the club doesn't — big type, the floor
    // drops FOR you, Barty stamps you out, and the chip becomes the receipt
    bigMoment('NIGHTSHIFT ' + d.n + ' — IN THE BOOKS', 'back to clubbing! 🍌');
    confettiBurst();
    miniDropUntil = Date.now() + 8000; // the club celebrates your shift
    bartySay(d.done.say, true);
    nightReceipt(d.n);
    if (d.done.patch) passPatch(d.done.patch);
    if (d.n === NIGHTS.length) {
      // THE REGULAR: five shifts = you're furniture now, in the good way
      try { localStorage.setItem('rv-stool', '1'); } catch (e) {}
      setTimeout(() => {
        bigMoment('YOU’RE A REGULAR ⭐', 'the stool by the bar is yours');
        stoolRender();
        passPatch('regular');
      }, 4800);
    }
    passStat('nights');
    track('rave_night_complete', { night: d.n });
    if (!NIGHT_TEST) {
      try {
        const s = nightLoad();
        localStorage.setItem('rv-night-v1', JSON.stringify({ arc: d.n + 1, lastStamp: localDay(), n: (s.n || 0) + 1 }));
      } catch (e) {}
    }
  }

  // ---- emotes ----
  document.querySelectorAll('.rv-emote-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const k = b.dataset.emote;
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'emote', k }));
      if (myId) floatEmote(myId, k); // instant local echo
      if (k === 'fire' && onStage()) nightEvent('fire'); // night 4's stage moment
      // champagne in hand: every emote is a little celebration (+2 jelly)
      const meC = myId && ravers.get(myId);
      if (meC && fxActive(meC, Date.now()) && meC.fx.id === 'champagne') addHype(2);
      track('rave_emote', { k });
    });
  });

  // ---- the stage: survive STAGE_UNLOCK_MS → dance behind the DJ, earn the 🔥 ----
  const stageBtn = el('rvStageBtn');
  const fireBtn = document.querySelector('.rv-emote-btn--fire');
  const onStage = () => { const me = ravers.get(myId); return !!(me && me.stage); };

  function refreshStageUi() {
    if (!myId) return;
    const left = STAGE_UNLOCK_MS - (Date.now() - sessionStart);
    stageBtn.hidden = false;
    if (onStage()) {
      stageBtn.disabled = false;
      stageBtn.textContent = '↩ back to the floor';
    } else if (left > 0) {
      const m = Math.floor(left / 60000), s = Math.ceil((left % 60000) / 1000) % 60;
      stageBtn.disabled = true;
      stageBtn.textContent = `⭐ stage opens in ${m}:${String(s).padStart(2, '0')}`;
    } else {
      stageBtn.disabled = false;
      stageBtn.textContent = '⭐ join the stage';
    }
    fireBtn.hidden = !onStage();
  }
  setInterval(refreshStageUi, 1000);

  // ---- the glowstick souvenir: 30 minutes on the floor → a glowstick, forever ----
  let glowChecked = false;
  function checkGlowstick() {
    if (glowChecked || !myId || Date.now() - sessionStart < GLOW_MS) return;
    glowChecked = true;
    let had = false;
    try {
      had = localStorage.getItem('rv-glowstick') === '1';
      localStorage.setItem('rv-glowstick', '1');
    } catch (e) {}
    if (had) return; // already earned on an earlier night
    // put it on right here on the floor, for everyone to see
    const me = ravers.get(myId);
    if (me) {
      me.outfit.extras = { ...(me.outfit.extras || {}), glowstick: true };
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'outfit', outfit: me.outfit }));
    }
    // the saved builder banana wears it home too
    try {
      const saved = JSON.parse(localStorage.getItem('bb-last') || '{}');
      saved.extras = { ...(saved.extras || {}), glowstick: true };
      localStorage.setItem('bb-last', JSON.stringify(saved));
    } catch (e) {}
    const toast = document.createElement('div');
    toast.className = 'rv-glowtoast';
    toast.innerHTML = '🎉 <b>30 MINUTES ON THE FLOOR</b> — the glowstick is yours forever. It’s in your hand and in the builder.';
    (el('rvToasts') || floor).appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
    track('rave_glowstick_unlock');
    passPatch('survivor', { quiet: true }); // the glowtoast IS the celebration here
  }
  setInterval(checkGlowstick, 5000);

  stageBtn.addEventListener('click', () => {
    if (stageBtn.disabled) return;
    sitting = false; pendingSit = false; // no dancing on stage from a stool
    const want = !onStage();
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'stage', on: want }));
    else if (myId) { // solo mode: the stage is all yours
      setStage(myId, want);
      if (want) {
        const sr = ravers.get(myId);
        if (sr) showBubble('⭐ ' + autoName(sr.outfit) + ' takes the stage!', false, 4000);
        el('rvStage').scrollIntoView({ behavior: 'smooth', block: 'center' });
        bigMoment('YOU’RE ON THE STAGE 🔥', 'dance behind the DJ — tap ⭐ again to come down');
      }
    }
    track(want ? 'rave_stage_join' : 'rave_stage_leave');
  });

  // ---- the render loop: everyone dances off the same clock ----
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastIdx = -1, lastDrop = null, lastTick = 0;
  let confetti = [];
  let fxParts = []; // flame/dash trail particles — {x, y, t0, kind}
  function confettiBurst() {
    if (reduced || !floorW) return;
    // airy, not a hose: fewer pieces, slower fall, wide flutter — and each piece
    // ERASES its previous spot instead of smearing a streamer down the fade
    // canvas ("giant hoses of color" — Trym)
    const COLS = ['#ffe135', '#ff4d9d', '#78ebff', '#58c05c', '#fffdf5'];
    for (let i = 0; i < 45; i++) {
      confetti.push({
        x: Math.random() * floorW,
        y: -10 - Math.random() * 140,
        v: 38 + Math.random() * 46,
        sw: Math.random() * 2 * Math.PI,
        c: COLS[i % COLS.length],
        s: 3 + (i % 3),
      });
    }
  }
  // IT'S RAINING BANANAS — the golden banana's own weather (Trym: a repeat
  // find got "only confetti"; now the sky owes you). Rides the confetti
  // system: same fall/flutter/erase, but each piece is a tiny gold crescent
  // (Pillow-verified on the floor colour) that flips as it tumbles.
  const GOLDRAIN_MAP = [
    '..B.....W.',
    '..Y.....Y.',
    '..YY...YY.',
    '...YY.YYY.',
    '...OYYYYO.',
    '....OYYO..',
  ];
  const GOLDRAIN_COLS = { Y: '#ffd23f', B: '#7a4a21', W: '#fff6c8', O: '#e6a817' };
  const goldCvs = [false, true].map((mirror) => {
    const c = document.createElement('canvas');
    c.width = 10; c.height = 6;
    const x = c.getContext('2d');
    GOLDRAIN_MAP.forEach((row, ry) => [...row].forEach((ch, rx) => {
      if (GOLDRAIN_COLS[ch]) { x.fillStyle = GOLDRAIN_COLS[ch]; x.fillRect(mirror ? 9 - rx : rx, ry, 1, 1); }
    }));
    return c;
  });
  // VHS BANANA: bad-tracking glitch — horizontal slices of the fresh composite
  // shear sideways in bursts, with a white tracking band rolling through.
  // Mutates the raver's own canvas AFTER drawComposite; the next dance frame
  // redraws clean, so glitch phrases alternate with clean frames like a worn tape.
  function vhsGlitch(cv, now) {
    const g = Math.floor(now / 130) % 7;
    if (g > 4) return; // clean frames between bursts — the tape "recovers"
    const x = cv.getContext('2d');
    for (let s = 0; s < 4; s++) {
      const sy = ((g * 53 + s * 41) % 115) + 22;
      const sh = 6 + ((g * 7 + s * 5) % 10);
      const dx = ((g + s) % 2 ? 1 : -1) * (6 + ((g * 31 + s * 17) % 10));
      x.drawImage(cv, 0, sy, 160, sh, dx, sy, 160, sh);
    }
    if (g === 2 || g === 4) {
      x.globalAlpha = 0.22;
      x.fillStyle = '#ffffff';
      x.fillRect(0, (now / 9) % 160, 160, 6);
      x.globalAlpha = 1;
    }
  }
  function goldenRain() {
    if (reduced || !floorW) return;
    for (let i = 0; i < 22; i++) {
      confetti.push({
        x: Math.random() * floorW,
        y: -14 - Math.random() * 260,
        v: 46 + Math.random() * 52,
        sw: Math.random() * 2 * Math.PI,
        spr: true,
        s: 14 + (i % 3) * 4, // drawn width; height rides the 10:6 sprite ratio
      });
    }
  }
  const dropFlashEl = el('rvDropFlash');
  const dropFlashSpan = dropFlashEl.querySelector('span');
  let lastDropLabel = '';
  let trailsDirtyUntil = 0;
  function tick() {
    const now = Date.now();
    const dtMs = lastTick ? Math.min(now - lastTick, 100) : 16;
    lastTick = now;
    stepMe(now, dtMs);
    updateCam();
    tickRun(); // pellet collection at frame rate — the 500ms tick let fast walkers hop OVER pellets
    tryClaims(now); // item claims too — same lesson
    nightFrame(now); // quest proximity checks — same lesson again
    monkeyTick(now, dtMs); // the bandit keeps its distance
    for (const r of ravers.values()) {
      if (r.lastWalk && now - r.lastWalk > 300) stopLean(r); // came to rest — stand straight (keep facing)
      // the shock-blink renders HERE — the one loop with no perf gates and no
      // CSS animation. v1's lone timer could be lost (iOS freeze); v2's sweep
      // sat inside the trails pass, which the liveCanvas gate STOPS once the
      // floor goes still — fx dies, floor quiets, cleanup never ran; and the
      // keyframe animation could leave its black frame baked in the composited
      // layer even after the class left (only Trym's filter-changing hype drop
      // freed him). Static classes flipped by JS end in a plain style change.
      if (r.shockUntil) {
        const done = now > r.shockUntil;
        const white = !done && ((((r.shockUntil - now) / 75) | 0) % 2 === 1);
        r.wrap.classList.toggle('rv-shock', !done && !white);
        r.wrap.classList.toggle('rv-shockflash', white);
        if (done) r.shockUntil = 0;
      }
    }
    // is anything actually painting? a still floor skips the whole canvas pass
    // (the full-canvas fade composite ran every frame forever, even when blank)
    let liveCanvas = fxParts.length > 0 || confetti.length > 0;
    if (!liveCanvas) {
      for (const r of ravers.values()) {
        if (!r.stage && ((r.lastMoveAt && now - r.lastMoveAt < 350) || fxActive(r, now))) { liveCanvas = true; break; }
      }
    }
    if (liveCanvas) trailsDirtyUntil = now + 4000; // fade needs ~4s of runway to fully clear
    // light trails: walking leaves faint violet footprints (one calm tone — the
    // per-raver rainbow read as MESS on the checkerboard, Trym verdict)
    if (trailCtx && !reduced && floorW && now < trailsDirtyUntil) {
      trailCtx.globalCompositeOperation = 'destination-out';
      trailCtx.fillStyle = 'rgba(0,0,0,0.06)';
      trailCtx.fillRect(0, 0, floorW, floorH);
      trailCtx.globalCompositeOperation = 'source-over';
      for (const r of ravers.values()) {
        if (r.stage) continue;
        if (tourActive && r.id !== myId) continue; // hidden guests must not paint trails through the lesson
        const moving = r.lastMoveAt && now - r.lastMoveAt < 350;
        const px = (r.x / 100) * floorW;
        const py = ((r.y + 3) / 100) * floorH; // at the feet, not the torso
        const gx = Math.floor(px / 8) * 8;
        const gy = Math.floor(py / 8) * 8;
        if (moving) {
          // hype mode paints GOLD — your peak is written on the floor
          trailCtx.fillStyle = (r.id === myId && now < hypeModeUntil) ? 'rgba(255, 225, 53, 0.3)' : 'rgba(179, 136, 255, 0.16)';
          trailCtx.fillRect(gx, gy, 8, 8);
        }
        const hasFx = fxActive(r, now);
        const zapOn = hasFx && r.fx.id === 'zap';
        if (r.zapOn !== zapOn) { r.zapOn = zapOn; r.wrap.classList.toggle('rv-zapfx', zapOn); } // DOM writes only on change
        // costume effects are pure CSS on the wrap — one class per fx, DOM
        // writes only on change (the zapOn lesson)
        const fxClass = hasFx ? FX_CLASS[r.fx.id] : undefined;
        if (r.fxClass !== fxClass) {
          if (r.fxClass) r.wrap.classList.remove(r.fxClass);
          if (fxClass) r.wrap.classList.add(fxClass);
          r.fxClass = fxClass;
        }
        // FLAMING POTASSIUM v2 (Trym: "it's chilisauce, it's hot") — the banana
        // ITSELF flares up in flickers. Static class flips by JS, never a
        // keyframed filter (the iOS bake rule); computed BEFORE the continue
        // so the glow can't stick after the fx ends.
        // Math.floor, NOT |0 — epoch/260 overflows int32 and goes negative,
        // and a negative %3 never hits 2 (the goldrain lesson, same day)
        const hot = hasFx && r.fx.id === 'flames' && (Math.floor(now / 260) % 3) !== 2;
        if (r.hotOn !== hot) { r.hotOn = hot; r.wrap.classList.toggle('rv-flamehot', hot); }
        if (!hasFx) continue;
        // ...and it occasionally burns off the peel itself: a flame ON the body
        if (r.fx.id === 'flames' && now - (r.bodyFlameAt || 0) > 600) {
          r.bodyFlameAt = now;
          fxParts.push({ x: px + Math.sin(now / 280) * 12, y: py - (r.size || 90) * 0.35, t0: now, kind: 'flames', seed: now % 13 });
        }
        // GLITTER BOMBED v2: the bomb goes off every beat-and-a-half — a radial
        // burst of glitter AROUND the banana, not just a trail behind it
        if (r.fx.id === 'glitter' && now - (r.glitterAt || 0) > 1600) {
          r.glitterAt = now;
          for (let gb = 0; gb < 14; gb++) fxParts.push({ x: px, y: py - (r.size || 90) * 0.45, t0: now, kind: 'gburst', seed: gb });
        }
        // PARTY POPPER v2: it keeps POPPING — a streamer burst every two seconds
        if (r.fx.id === 'popper' && now - (r.popAt || 0) > 2000) {
          r.popAt = now;
          for (let pb = 0; pb < 10; pb++) fxParts.push({ x: px, y: py - (r.size || 90) * 0.5, t0: now, kind: 'pburst', seed: pb });
        }
        // MIRROR MIRROR: ghost reflections of YOU flicker in and out of the
        // original — one stamp per beat, left to the canvas fade to dissolve
        // ("mirrors floating in and out of your banana" — Trym; the rainbow
        // glints still trail behind the walk). Every other ghost is flipped:
        // a mirror shows the mirrored you.
        if (r.fx.id === 'prism' && now - (r.prismAt || 0) > 240) {
          r.prismAt = now;
          const sz = r.size || 90;
          const beat = Math.floor(now / 240);
          // offsets CLEAR of the sprite — ghosts stamped under the banana's
          // own DOM canvas just vanish behind it (the R1 flame-trail lesson)
          const offs = [[-sz * 0.72, -sz * 0.14], [sz * 0.70, -sz * 0.20], [-sz * 0.52, -sz * 0.48], [sz * 0.55, sz * 0.10]];
          const [ox, oy] = offs[beat % offs.length];
          const cy = py - 0.03 * floorH; // py is at the feet; the sprite centres 3% higher
          trailCtx.imageSmoothingEnabled = false; // crisp pixel ghosts, not a smear
          trailCtx.globalAlpha = 0.55;
          trailCtx.save();
          trailCtx.translate(px + ox, cy + oy);
          if (beat % 2) trailCtx.scale(-1, 1);
          trailCtx.drawImage(r.cv, -sz / 2, -sz / 2, sz, sz);
          trailCtx.restore();
          trailCtx.globalAlpha = 1;
        }
        // THE ENTOURAGE: a conga line of YOU — ghost copies replay your own
        // path half a second and a second behind (position history recorded
        // only while the fx runs), stamped per beat and left to the fade.
        // Standing still, the entourage catches up and merges into you.
        if (r.fx.id === 'conga') {
          const cyc = py - 0.03 * floorH;
          (r.hist || (r.hist = [])).push({ x: px, y: cyc, f: r.facing || 1, t: now });
          while (r.hist.length && now - r.hist[0].t > 1400) r.hist.shift();
          {
            // stamped EVERY frame at the delayed spot: the moving position
            // paints a bright leading copy, the fade turns the rest into a
            // comet tail (per-beat stamps read as smears — first draft)
            const sz = r.size || 90;
            trailCtx.imageSmoothingEnabled = false;
            for (const [delay, alpha] of [[500, 0.5], [1000, 0.34]]) {
              let h = null;
              for (const e of r.hist) { if (now - e.t >= delay) h = e; else break; }
              if (!h) continue;
              trailCtx.globalAlpha = alpha;
              trailCtx.save();
              trailCtx.translate(h.x, h.y);
              if (h.f === -1) trailCtx.scale(-1, 1); // the entourage faces YOUR way
              trailCtx.drawImage(r.cv, -sz / 2, -sz / 2, sz, sz);
              trailCtx.restore();
            }
            trailCtx.globalAlpha = 1;
          }
        } else if (r.hist) r.hist = null; // fx over — drop the buffer
        if (r.fx.id === 'zap' && now - (r.zapSpawnAt || 0) > 130) {
          // static crackles off you whether you walk or dance
          r.zapSpawnAt = now;
          fxParts.push({ x: px + (Math.sin(now / 70) * 26), y: py - 20 - ((now >> 6) % 5) * 9, t0: now, kind: 'zap', seed: now % 13 });
        }
        // the cartoon electrocution: every couple of seconds the whole banana
        // shock-blinks — black skeleton silhouette ↔ white flash (Trym's brief:
        // "tiny electrical sausages" weren't an electric shock)
        if (r.fx.id === 'zap' && now - (r.shockAt || 0) > 1900 + ((r.id ? r.id.length : 0) % 5) * 180) {
          r.shockAt = now;
          r.shockUntil = now + 460; // the ungated loop renders + ends the blink
        }
        // flames + dashes are PARTICLES at past positions (a real trail behind the
        // walker) — drawing at the live feet hid them under the sprite, and the
        // canvas fade killed them in ~1s (Trym, iOS). Each spawn lands at the
        // PREVIOUS spawn spot (one step behind, never in front of the banana);
        // 170ms spacing = half the sprites, each frame readable (Trym round 2).
        if (TRAIL_FX.has(r.fx.id) && moving && now - (r.fxSpawnAt || 0) > 170) {
          r.fxSpawnAt = now;
          if (r.fxPrev) fxParts.push({ x: r.fxPrev.x, y: r.fxPrev.y, t0: now, kind: r.fx.id, seed: (fxParts.length * 7 + 3) % 13 });
          r.fxPrev = { x: px, y: py };
          if (fxParts.length > 400) fxParts.splice(0, fxParts.length - 400);
        } else if (r.fx.id === 'fizz') {
          // bubbles rise off the banana whether it walks or just dances
          for (let b = 0; b < 2; b++) {
            const ph = ((now / 1400) + b * 0.5) % 1;
            const bx = px + Math.sin(now / 320 + b * 2.7) * 14;
            const by = py - 34 - ph * 52;
            trailCtx.fillStyle = `rgba(120, 235, 255, ${0.75 * (1 - ph)})`;
            trailCtx.fillRect(Math.floor(bx / 4) * 4, Math.floor(by / 4) * 4, 4, 4);
          }
        } else if (r.fx.id === 'bubbles') {
          // the wand: BIG lazy bubbles — outlined rings with a glint, floating high
          for (let b = 0; b < 2; b++) {
            const ph = ((now / 2600) + b * 0.5) % 1;
            const bx = px + Math.sin(now / 480 + b * 3.1) * 20;
            const by = py - 30 - ph * 78;
            const br = 5 + b * 3;
            trailCtx.strokeStyle = `rgba(120, 235, 255, ${0.8 * (1 - ph)})`;
            trailCtx.lineWidth = 2;
            trailCtx.strokeRect(Math.floor(bx - br), Math.floor(by - br), br * 2, br * 2);
            trailCtx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - ph)})`;
            trailCtx.fillRect(Math.floor(bx - br + 2), Math.floor(by - br + 2), 2, 2);
          }
        } else if (r.fx.id === 'champagne') {
          // golden spray fountains up behind the celebrant
          for (let b = 0; b < 3; b++) {
            const ph = ((now / 900) + b * 0.33) % 1;
            const bx = px + Math.sin(b * 2.1 + now / 200) * (6 + ph * 22);
            const by = py - 40 - ph * 60;
            trailCtx.fillStyle = b === 1 ? `rgba(255, 246, 200, ${0.9 * (1 - ph)})` : `rgba(255, 210, 63, ${0.9 * (1 - ph)})`;
            trailCtx.fillRect(Math.floor(bx / 3) * 3, Math.floor(by / 3) * 3, 3, 3);
          }
        } else if (r.fx.id === 'margarita' && now - (r.spicyAt || 0) > 700) {
          // fire breath on the beat: a flame puff at mouth height (sprite frames)
          r.spicyAt = now;
          fxParts.push({ x: px + (Math.sin(now / 500) > 0 ? 14 : -14), y: py - (r.size || 90) * 0.42, t0: now, kind: 'flames', seed: now % 13 });
        }
      }
      // fx particle trails: flames are SPRITES that flicker, sway and rise as they
      // die (~2s); dashes streak ~1.4s. Both fade with age.
      if (fxParts.length) {
        const life = (p) => (p.kind === 'zap' ? 350 : p.kind === 'sparkler' ? 2600 : p.kind === 'gburst' ? 900 : p.kind === 'pburst' ? 1100 : 1400); // sparkler segments burn long — that's the light-writing; bursts are quick
        fxParts = fxParts.filter((p) => now - p.t0 < life(p));
        trailCtx.imageSmoothingEnabled = false;
        for (const p of fxParts) {
          const age = (now - p.t0) / life(p);
          if (p.kind === 'zap') {
            // a tiny lightning kink: two offset cyan ticks + a white joint
            trailCtx.globalAlpha = 1 - age;
            trailCtx.fillStyle = '#78ebff';
            trailCtx.fillRect(p.x, p.y, 3, 6);
            trailCtx.fillRect(p.x - 3, p.y + 6, 3, 6);
            trailCtx.fillStyle = '#ffffff';
            trailCtx.fillRect(p.x - 1, p.y + 5, 3, 3);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'flames') {
            const frame = flameCvs[(Math.floor(now / 90) + (p.seed || 0)) % 2]; // per-particle flicker offset
            const w = 30 * (1 - age * 0.45); // 21 → 30: "bigger flames" (Trym round 2)
            const h = w * 8 / 7;
            const sway = Math.sin((p.seed || 0) * 2.1 + now / 160) * 2.5;
            trailCtx.globalAlpha = 0.95 * (1 - age);
            trailCtx.drawImage(frame, p.x - w / 2 + sway, p.y - h - age * 12, w, h);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'daiquiri') {
            // tropical wake: cocktail umbrellas wobbling upward, cream splash
            // droplets arcing out, the odd cherry — a DAIQUIRI, not gold dashes
            if ((p.seed || 0) % 2 === 0) {
              const frame = umbCvs[(Math.floor(now / 150) + (p.seed || 0)) % 2];
              const w = 18 * (1 - age * 0.3);
              const h = w * 8 / 9;
              const sway = Math.sin((p.seed || 0) * 1.7 + now / 220) * 3;
              trailCtx.globalAlpha = 0.95 * (1 - age);
              trailCtx.drawImage(frame, p.x - w / 2 + sway, p.y - h - age * 10, w, h);
              trailCtx.globalAlpha = 1;
            } else {
              trailCtx.globalAlpha = 0.9 * (1 - age);
              for (let b2 = 0; b2 < 3; b2++) {
                const ang = (p.seed || 0) * 2.4 + b2 * 2.1;
                const dx2 = Math.cos(ang) * (6 + age * 16);
                const dy2 = -10 * age + 22 * age * age + Math.sin(ang) * 3; // splash arc
                trailCtx.fillStyle = b2 === 2 && (p.seed || 0) % 5 === 0 ? '#ff4d9d'
                  : b2 % 2 ? '#fff6c8' : '#ffe135';
                trailCtx.fillRect(Math.round(p.x + dx2), Math.round(p.y - 8 + dy2), 3, 3);
              }
              trailCtx.globalAlpha = 1;
            }
          } else if (p.kind === 'prism') {
            // mirror-shard light: rainbow glints + the odd white star
            const PRISM = ['#ff4d9d', '#ffe135', '#78ebff', '#58c05c', '#b388ff'];
            trailCtx.globalAlpha = 0.95 * (1 - age);
            trailCtx.fillStyle = PRISM[((p.seed || 0) + Math.floor(now / 130)) % PRISM.length];
            trailCtx.fillRect(Math.round(p.x - 2), Math.round(p.y - 6 - age * 8), 4, 4);
            if ((p.seed || 0) % 3 === 0) {
              trailCtx.fillStyle = '#ffffff';
              trailCtx.fillRect(Math.round(p.x - 1), Math.round(p.y - 13 - age * 8), 2, 2);
            }
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'sparkler') {
            // light-writing v2, the golden firecracker (Trym: "even more
            // sparkly"): a white-hot core with sparks SPRAYING off it —
            // 6 radiating flecks per segment, gold/white, jittering fast
            trailCtx.globalAlpha = 1 - age;
            trailCtx.fillStyle = '#ffffff';
            trailCtx.fillRect(Math.round(p.x - 2), Math.round(p.y - 9), 4, 4);
            for (let sk = 0; sk < 6; sk++) {
              const sa = (p.seed || 0) * 1.3 + sk * 1.05 + now / 90;
              const sd = 4 + ((sk * 3 + (p.seed || 0)) % 8) + age * 8;
              trailCtx.fillStyle = sk % 3 === 0 ? '#ffffff' : sk % 3 === 1 ? '#ffe135' : '#ff9128';
              trailCtx.fillRect(Math.round(p.x + Math.cos(sa) * sd), Math.round(p.y - 7 + Math.sin(sa) * sd * 0.8), 2, 2);
            }
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'fog') {
            // smoke-machine wisps v2: BIG puffy banks, layered — a fog you can
            // lose your shoes in (Trym: "bigger and puffier"; runs 20s now)
            trailCtx.globalAlpha = 0.26 * (1 - age);
            trailCtx.fillStyle = '#b8bcd0';
            const fw = 24 + age * 34;
            trailCtx.fillRect(Math.round(p.x - fw / 2), Math.round(p.y - 10 - age * 5), Math.round(fw), 12);
            trailCtx.globalAlpha = 0.14 * (1 - age);
            trailCtx.fillStyle = '#e8eaf2';
            const fw2 = 14 + age * 20;
            trailCtx.fillRect(Math.round(p.x - fw2 / 2 + Math.sin((p.seed || 0) + now / 400) * 5), Math.round(p.y - 16 - age * 8), Math.round(fw2), 7);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'notes') {
            const nf = noteCvs[(p.seed || 0) % 2];
            const nw = 12 * (1 - age * 0.25);
            trailCtx.globalAlpha = 0.95 * (1 - age);
            trailCtx.drawImage(nf, p.x + Math.sin((p.seed || 0) + now / 240) * 4, p.y - 14 - age * 26, nw, nw);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'glitter') {
            // glitter v2: a wider, denser shimmer (the bombs are spawned as
            // 'gburst' back in the fx pass)
            trailCtx.globalAlpha = 0.9 * (1 - age);
            for (let g2 = 0; g2 < 5; g2++) {
              trailCtx.fillStyle = g2 % 2 ? '#ffffff' : g2 === 2 ? '#ff4d9d' : '#ffd23f';
              const gx3 = p.x + Math.cos((p.seed || 0) * 1.9 + g2 * 1.4) * (6 + age * 14);
              trailCtx.fillRect(Math.round(gx3), Math.round(p.y - 8 + age * 12 + g2 * 2), 3, 3);
            }
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'gburst') {
            // the glitter BOMB: a radial explosion around the banana
            const ga = (p.seed / 14) * Math.PI * 2;
            const gd = age * 46;
            trailCtx.globalAlpha = 1 - age;
            trailCtx.fillStyle = p.seed % 3 === 0 ? '#ffffff' : p.seed % 3 === 1 ? '#ffd23f' : '#ff4d9d';
            trailCtx.fillRect(Math.round(p.x + Math.cos(ga) * gd), Math.round(p.y + Math.sin(ga) * gd * 0.7), 3, 3);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'slide') {
            // ice legs v2: a windy icy wake — wide frost streaks + blown-up flurries
            trailCtx.globalAlpha = 0.7 * (1 - age);
            trailCtx.fillStyle = (p.seed || 0) % 2 ? '#b9f4ff' : '#78ebff';
            const iw = 16 + age * 22;
            trailCtx.fillRect(Math.round(p.x - iw / 2), Math.round(p.y - 3), Math.round(iw), 3);
            trailCtx.fillStyle = '#eafcff';
            trailCtx.fillRect(Math.round(p.x - 4 + Math.sin((p.seed || 0) * 2 + now / 140) * 9), Math.round(p.y - 10 - age * 12), 3, 3);
            trailCtx.fillRect(Math.round(p.x + 3 + Math.sin((p.seed || 0) * 3 + now / 110) * 7), Math.round(p.y - 5 - age * 8), 2, 2);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'popper') {
            // party popper v2: curling streamer RIBBONS falling behind you
            trailCtx.globalAlpha = 0.95 * (1 - age);
            const POP = ['#ffe135', '#ff4d9d', '#78ebff', '#58c05c'];
            trailCtx.fillStyle = POP[(p.seed || 0) % POP.length];
            for (let rb = 0; rb < 4; rb++) {
              const rx = p.x + Math.sin((p.seed || 0) * 1.7 + age * 9 + rb * 0.9) * 7;
              trailCtx.fillRect(Math.round(rx), Math.round(p.y - 16 + rb * 4 + age * 16), 3, 4);
            }
            trailCtx.fillStyle = '#fffdf5';
            trailCtx.fillRect(Math.round(p.x + Math.cos((p.seed || 0) * 3.1) * 10), Math.round(p.y - 6 + age * 12), 2, 2);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'pburst') {
            // the popper's POP: streamers shot radially off the banana
            const pa = (p.seed / 10) * Math.PI * 2;
            const pd = 6 + age * 40;
            const POPB = ['#ffe135', '#ff4d9d', '#78ebff', '#58c05c', '#fffdf5'];
            trailCtx.globalAlpha = 1 - age;
            trailCtx.fillStyle = POPB[p.seed % POPB.length];
            trailCtx.fillRect(Math.round(p.x + Math.cos(pa) * pd), Math.round(p.y + Math.sin(pa) * pd * 0.7), 3, 5);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'lagoon') {
            trailCtx.globalAlpha = 0.85 * (1 - age);
            trailCtx.fillStyle = (p.seed || 0) % 2 ? '#78ebff' : '#4db8ff';
            trailCtx.fillRect(Math.round(p.x - 1 + Math.sin((p.seed || 0)) * 5), Math.round(p.y - 6 + age * 12), 3, 3);
            trailCtx.globalAlpha = 1;
          } else if (p.kind === 'espresso') {
            // caffeinated dashes: short, brown, FAST — gone before you see them twice
            trailCtx.globalAlpha = 0.8 * (1 - age);
            trailCtx.fillStyle = '#8a5a2b';
            trailCtx.fillRect(Math.round(p.x - 5), Math.round(p.y - 5), 10, 3);
            trailCtx.globalAlpha = 1;
          }
        }
      }
      // confetti: loose pixel flakes for the RARE moments (golden banana, your
      // hype drop, the welcome) — erase-then-draw keeps them airy on the canvas
      if (confetti.length) {
        for (const p of confetti) {
          if (p.px !== undefined) trailCtx.clearRect(p.px - 1, p.py - 1, p.s + 2, p.s + 2);
        }
        confetti = confetti.filter((p) => p.y < floorH + 10);
        for (const p of confetti) {
          p.y += (p.v * dtMs) / 1000;
          const sway = Math.sin(p.sw + p.y / 14) * 26; // wide lazy flutter
          p.px = Math.floor((p.x + sway) / 2) * 2;
          p.py = Math.floor(p.y / 2) * 2;
          if (p.spr) { // golden rain: a tumbling gold crescent, not a square
            trailCtx.imageSmoothingEnabled = false;
            // p.y starts NEGATIVE (spawn above the floor) — % can yield -1
            trailCtx.drawImage(goldCvs[Math.abs(Math.floor(p.sw * 7 + p.y / 26)) % 2], p.px, p.py, p.s, Math.round(p.s * 0.6));
          } else {
            trailCtx.fillStyle = p.c;
            trailCtx.fillRect(p.px, p.py, p.s, p.s);
          }
        }
      }
    }
    const secs = (now / 1000) % DROP_PERIOD;
    const clockDrop = secs < DROP_LEN;
    // the clock doesn't care about the tour, but the STROBE does — a drop
    // landing mid-lesson would out-shout the teacher
    const dropActive = (clockDrop || now < miniDropUntil) && !tourActive;
    const dropLabel = clockDrop ? 'THE DROP' : 'BONUS DROP!';
    if (dropLabel !== lastDropLabel) { lastDropLabel = dropLabel; dropFlashSpan.textContent = dropLabel; } // was a querySelector + write EVERY frame
    const cycleMs = dropActive ? 480 : 800;
    const idx = Math.floor((now % cycleMs) / (cycleMs / NFRAMES));

    if (dropActive !== lastDrop) {
      // no confetti here — every-3rd-minute confetti was wallpaper (Trym: "too
      // frequent to appreciate"); the drop already has strobe + pyro + the flash
      if (lastDrop === true && !dropActive) { passStat('drops'); addHype(8); nightEvent('drop'); }
      if (dropActive && audioOn) playDropAudio(); // the music drops WITH the lights
      lastDrop = dropActive;
      document.body.classList.toggle('rv-drop', dropActive && !reduced);
      dropFlashEl.hidden = !dropActive;
    }
    if (idx !== lastIdx) {
      lastIdx = idx;
      const hue = dropActive ? Math.floor((now / 12) % 360) : 0;
      for (const r of [...ravers.values()].slice(0, MAX_VISIBLE)) {
        const o = r.outfit;
        // seated on YOUR stool = the dance rests on the calm frame (local-only);
        // sealed in a balloon = same calm frame — you float, you don't dance
        const fIdx = ((r.id === myId && sitting) || (fxActive(r, now) && r.fx.id === 'balloon')) ? 0 : idx;
        drawComposite(r.cv.getContext('2d'), 160, fIdx, {
          bg: 'transparent', captions: false,
          // held quest props ride the gloves via the engine's hand anchors
          // (r.vinyl/qvinyl/qbroom are rave flags, never in the broadcast outfit)
          hat: o.hat, glasses: o.glasses,
          extras: (r.vinyl || r.qvinyl || r.qbroom || (fxActive(r, now) && ['cone', 'slice', 'box'].includes(r.fx.id)))
            ? {
              ...(o.extras || {}),
              ...((r.vinyl || r.qvinyl) ? { vinyl: true } : {}),
              ...(r.qbroom ? { broom: true } : {}),
              // the stolen traffic cone rides the head while the fx runs
              ...((fxActive(r, now) && r.fx.id === 'cone') ? { cone: true } : {}),
              // dinner rides the gloves: the slice (right) or the whole box (left)
              ...((fxActive(r, now) && r.fx.id === 'slice') ? { slice: true } : {}),
              ...((fxActive(r, now) && r.fx.id === 'box') ? { pizzabox: true } : {}),
            }
            : (o.extras || {}),
          top: '', bottom: '',
          effect: dropActive ? 'confetti' : o.effect,
          hue: dropActive ? hue : (o.effect === 'disco' ? (360 * idx / NFRAMES) : 0),
        });
        if (fxActive(r, now) && r.fx.id === 'vhs') vhsGlitch(r.cv, now); // worn-tape shear on the fresh frame
      }
      if (djCv) {
        drawComposite(djCv.getContext('2d'), 200, idx, {
          bg: 'transparent', captions: false,
          hat: djOutfit.hat, glasses: djOutfit.glasses, extras: djOutfit.extras, top: '', bottom: '',
          effect: dropActive ? 'disco' : djOutfit.effect,
          hue: dropActive ? Math.floor((now / 12) % 360) : 0,
        });
      }
      const extra = ravers.size - MAX_VISIBLE;
      el('rvMore').textContent = extra > 0 ? '+' + extra + ' more bananas in the back' : '';
    }
    requestAnimationFrame(tick);
  }

  // ---- THE SOUND: Sentry's set (tools/RAVE-AUDIO-SPEC.md) ----
  // loop.mp3 = the default bed (40.000s = 25 bars @ 150 BPM, seamless);
  // drop.mp3 = 12.8s (8 bars), fired on EVERY dropActive rising edge — clock
  // drops, jelly time and bonus drops all ride the same flag, so the music
  // is synced to the lights by construction. On enable: the drop greets you
  // first, then the loop rolls (Trym's call). Mute by default, gesture-gated.
  const AUDIO_LOOP_URL = '/assets/audio/rave-loop.mp3';
  const AUDIO_DROP_URL = '/assets/audio/rave-drop.mp3';
  const AUDIO_LOOP_S = 40.0, AUDIO_DROP_S = 12.8; // true master lengths
  const LOOP_LEVEL = 0.9;
  let audio = null, audioOn = false, audioLoading = false, audioUnlockEl = null;

  // 1s of silence as a WAV — the iOS session-unlock element plays this
  function silentWav() {
    const rate = 8000, n = rate; // 1s mono 8kHz
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const wr = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    wr(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); wr(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    wr(36, 'data'); v.setUint32(40, n * 2, true);
    return buf;
  }

  // mp3 decode can prepend encoder delay; if the decoded buffer is longer
  // than the master, trim with the standard-LAME-preroll heuristic so the
  // loop seam stays sample-tight
  function audioTrim(buf, wantS) {
    const extra = buf.duration - wantS;
    if (extra < 0.005) return { start: 0, end: buf.duration };
    const start = Math.min(extra, 1105 / 44100);
    return { start, end: start + wantS };
  }

  // the loop, from ITS bar 1, scheduled at time t — used on enable and after
  // every drop, because drop-end resolves into loop-start (the authored seam)
  function startLoopAt(t) {
    const { ctx, loopBuf, loopGain } = audio;
    const tr = audioTrim(loopBuf, AUDIO_LOOP_S);
    const src = ctx.createBufferSource();
    src.buffer = loopBuf;
    src.loop = true;
    src.loopStart = tr.start;
    src.loopEnd = tr.end;
    src.connect(loopGain);
    src.start(t, tr.start);
    // a looped source only "ends" when something kills it (drop cut, iOS
    // interruption) — nulling here is what lets relightLoop() detect silence
    src.onended = () => { if (audio && audio.loopSrc === src) audio.loopSrc = null; };
    audio.loopSrc = src;
  }

  // running context, dead loop source = the silent-zombie state (iOS kills
  // sources on interruptions; resume() alone brings back nothing). Waits out
  // dropBusyUntil so it never doubles a loop the drop already scheduled.
  function relightLoop() {
    if (audio && audioOn && audio.ctx.state === 'running' && !audio.loopSrc && audio.ctx.currentTime > audio.dropBusyUntil) {
      startLoopAt(audio.ctx.currentTime + 0.05);
    }
  }

  // no ducking, no overlap (Trym: "why a duck release?") — a drop CUTS the
  // loop like a DJ would (its impact masks the cut), plays clean and alone,
  // and the loop RESTARTS from bar 1 at the exact end: the same butt joint
  // Sentry authored, on every single drop
  function playDropAudio() {
    if (!audio) return;
    const { ctx, dropBuf, dropGain, loopGain } = audio;
    const t = ctx.currentTime;
    if (t < audio.dropBusyUntil) return; // one drop at a time
    audio.dropBusyUntil = t + AUDIO_DROP_S - 0.5;
    const src = ctx.createBufferSource();
    src.buffer = dropBuf;
    src.connect(dropGain);
    const tr = audioTrim(dropBuf, AUDIO_DROP_S);
    src.start(t, tr.start, AUDIO_DROP_S);
    if (audio.loopSrc) {
      // 25ms fade-out kills the cut click, then the old source dies
      loopGain.gain.cancelScheduledValues(t);
      loopGain.gain.setTargetAtTime(0.0001, t, 0.012);
      try { audio.loopSrc.stop(t + 0.06); } catch (e) {}
      audio.loopSrc = null;
    }
    loopGain.gain.setValueAtTime(LOOP_LEVEL, t + AUDIO_DROP_S); // full level at the joint
    startLoopAt(t + AUDIO_DROP_S);
  }

  async function audioStart() {
    if (audioLoading || audio) return;
    audioLoading = true;
    refreshSoundBtn();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // iOS: the context starts SUSPENDED even inside a tap — resume() must be
      // called while the gesture is still live (before any await), and the
      // page must declare itself a media player or the silent switch mutes
      // Web Audio entirely (phones live on silent)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      if (ctx.state !== 'running') ctx.resume();
      // audioSession only exists on newer Safari — the evergreen unlock is a
      // silent looped <audio> ELEMENT started in the same tap: media-element
      // playback flips the audio session so the ringer switch stops muting
      // Web Audio on every iOS version
      try {
        if (!audioUnlockEl) {
          audioUnlockEl = document.createElement('audio');
          audioUnlockEl.loop = true;
          audioUnlockEl.volume = 0.01;
          // 1-second silent WAV, generated inline — nothing to download
          audioUnlockEl.src = URL.createObjectURL(new Blob([silentWav()], { type: 'audio/wav' }));
        }
        audioUnlockEl.play().catch(() => {});
      } catch (e) {}
      // some WebKit builds still want the callback form of decodeAudioData
      const decode = (buf) => new Promise((ok, err) => {
        const p = ctx.decodeAudioData(buf, ok, err);
        if (p && p.then) p.then(ok, err);
      });
      const [loopBuf, dropBuf] = await Promise.all([AUDIO_LOOP_URL, AUDIO_DROP_URL].map(async (u) => {
        const r = await fetch(u);
        return decode(await r.arrayBuffer());
      }));
      if (ctx.state !== 'running') await ctx.resume().catch(() => {});
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const loopGain = ctx.createGain();
      loopGain.gain.value = LOOP_LEVEL;
      loopGain.connect(master);
      const dropGain = ctx.createGain();
      dropGain.connect(master);
      audio = { ctx, loopBuf, dropBuf, loopGain, dropGain, master, dropBusyUntil: 0 };
      // the greeting IS just a drop with no loop to cut — playDropAudio
      // schedules the loop's entry at the authored joint itself
      playDropAudio();
      audioOn = true;
      try { localStorage.setItem('rv-sound', '1'); } catch (e) {}
      track('rave_sound', { on: true });
    } catch (e) {
      audio = null;
    }
    audioLoading = false;
    refreshSoundBtn();
  }

  function audioStop() {
    if (audio) { try { audio.ctx.close(); } catch (e) {} }
    if (audioUnlockEl) { try { audioUnlockEl.pause(); } catch (e) {} }
    audio = null;
    audioOn = false;
    try { localStorage.setItem('rv-sound', '0'); } catch (e) {}
    track('rave_sound', { on: false });
    refreshSoundBtn();
  }

  function refreshSoundBtn() {
    const b = el('rvSoundBtn');
    if (!b) return;
    b.classList.toggle('rv-soundbtn--on', audioOn);
    b.setAttribute('aria-pressed', String(audioOn));
    b.title = audioLoading ? 'warming up the speakers…' : audioOn ? 'sound off' : 'sound on — the set is live';
  }
  const soundBtn = el('rvSoundBtn');
  if (soundBtn) soundBtn.addEventListener('click', () => (audioOn ? audioStop() : audioStart()));
  // returning listeners: pref remembered, but browsers demand a gesture —
  // the FIRST tap/keypress anywhere re-opens the doors
  try {
    if (localStorage.getItem('rv-sound') === '1') {
      const arm = () => { if (!audioOn && !audioLoading) audioStart(); };
      addEventListener('pointerdown', arm, { once: true });
      addEventListener('keydown', arm, { once: true });
    }
  } catch (e) {}
  // iOS backgrounds the context — resume when the tab returns. Match any
  // non-running state: iOS also uses a non-standard 'interrupted' after
  // calls, Siri, silent-mode juggling…
  document.addEventListener('visibilitychange', () => {
    if (audio && document.visibilityState === 'visible' && audio.ctx.state !== 'running') audio.ctx.resume().catch(() => {});
    if (document.visibilityState === 'visible') relightLoop();
  });
  // coming BACK from the builder (bfcache restore) resurrects a ZOMBIE engine:
  // `audio` exists but its context/sources are dead, and audioStart refuses to
  // rebuild while `audio` is set — the button toggled, the speakers didn't
  // (Trym). A restore gets a full teardown; the remembered pref re-arms the
  // proven cold-start path on the first tap.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    if (audio) { try { audio.ctx.close(); } catch (err) {} }
    audio = null;
    audioLoading = false;
    if (audioOn) {
      audioOn = false;
      refreshSoundBtn();
      const arm = () => { if (!audioOn && !audioLoading) audioStart(); };
      addEventListener('pointerdown', arm, { once: true });
      addEventListener('keydown', arm, { once: true });
    }
  });
  // belt for iOS: if the context is ever stuck (decode outlived the gesture,
  // low-power mode, interruption), the NEXT tap anywhere unsticks it — and
  // re-kicks the session-unlock element too
  addEventListener('pointerdown', () => {
    if (audio && audioOn && audio.ctx.state !== 'running') {
      audio.ctx.resume().catch(() => {});
      if (audioUnlockEl) audioUnlockEl.play().catch(() => {});
    }
    relightLoop(); // running-but-silent heals on the next tap too
  });
  // QA handle (harmless): lets tests confirm the graph without ears
  window.__rvAudio = () => ({
    on: audioOn, loading: audioLoading, ctx: audio && audio.ctx.state,
    loopDur: audio && audio.loopBuf.duration, dropDur: audio && audio.dropBuf.duration,
    busyUntil: audio && audio.dropBusyUntil,
    unlock: audioUnlockEl ? (audioUnlockEl.paused ? 'paused' : 'playing') : 'none',
    session: (navigator.audioSession && navigator.audioSession.type) || 'unsupported',
  });

  // ---- the pass: rave moments leave marks ----
  passVisit();
  // first-timers get the raver patch AFTER the tour (endTour schedules it —
  // the arrival toast pile was "too much noise", Trym); returners mint now
  // (a no-op for anyone who already has it)
  try { if (localStorage.getItem('rv-tour-v1')) passPatch('raver'); } catch (e) { passPatch('raver'); }
  stoolRender(); // the regular's stool, for those who've earned it
  // ?fxtest=<id> — preview any timed effect on yourself (local visual only,
  // never broadcast; the stagetest/nighttest pattern for fx work)
  const fxTest = new URLSearchParams(location.search).get('fxtest');
  if (fxTest === 'goldrain') {
    // the golden banana's weather, on demand (its real window is ~30 min apart)
    setInterval(() => goldenRain(), 4000);
  } else if (fxTest) {
    // capFx trims every window to its fx length, so QA REAPPLIES on a loop —
    // the effect stays on for as long as the param is in the url
    setInterval(() => {
      if (myId && ravers.get(myId)) applyFx(myId, { id: fxTest, until: Date.now() + fxLen(fxTest) });
    }, 800);
  }
  setInterval(() => { if (ws && ws.readyState === 1) passStat('raveMin'); }, 60000);
  try { if (localStorage.getItem('rv-glowstick') === '1') passPatch('survivor', { quiet: true }); } catch (e) {}

  // connect NOW, in parallel with the sheet decode — nothing draws until
  // assetsReady (ravers are DOM-only until tick starts), so serializing the
  // WS handshake behind the image was pure wasted wall-clock
  connect();
  assetsReady().then(() => {
    // Barty the bartender: drawn ONCE (static NPC — he's working, not dancing),
    // frame 4 = the first left-facing pose, moustache + bow tie = the uniform
    const barCv = el('rvBarman');
    if (barCv) {
      drawComposite(barCv.getContext('2d'), 160, 4, {
        bg: 'transparent', captions: false,
        hat: 'none', glasses: 'none', extras: { mustache: true, bowtie: true }, top: '', bottom: '',
        effect: 'none',
      });
    }
    requestAnimationFrame(tick);
  });
}
