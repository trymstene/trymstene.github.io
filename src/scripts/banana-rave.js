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
import { passPatch, passStat, passVisit } from '../lib/banana-pass.js';

const RAVE_WS = 'wss://banana-rave.trymstene.workers.dev/ws';
const DROP_PERIOD = 180, DROP_LEN = 10; // seconds
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
const ITEM_PERIOD = 75, ITEM_WAIT = 55, ITEM_OFFSET = 15;               // THE CONVEYOR: an item every 75s, forever — keep in sync with worker
const SNACKS = { candy: ['🍬', 'CANDY'], pizza: ['🍕', 'PIZZA SLICE'], balloon: ['🎈', 'BALLOON'] };
const WAVE_PERIOD = 480, WAVE_LEN = 8, WAVE_OFFSET = 300;               // THE WAVE — client-only, synced by clock + emote broadcasts
const CHAIN_MS = 90000;                                                  // grab the next item within 90s to keep the chain
const SPECIAL_PERIOD = 300, SPECIAL_LEN = 35, SPECIAL_OFFSET = 270;     // Barty's specials, right between happy hours — keep in sync with worker
const COCKTAILS = ['daiquiri', 'fizz'];                                 // rotation — keep in sync with worker
const FX_MS = 150000;
const FX_ZAP_MS = 60000; // the electric charge is LOUD — it burns out fastest (keep in sync with worker)
// zap windows are capped at FIRST SIGHT too, so the short fuse holds even
// against a not-yet-redeployed worker still stamping 150s
const capFx = (fx) => (fx && fx.id === 'zap' ? { ...fx, until: Math.min(fx.until, Date.now() + FX_ZAP_MS) } : fx);
const FX_NAMES = { flames: 'Flaming Potassium', daiquiri: 'Banana Daiquiri', fizz: 'Bubblegum Fizz', zap: 'Electric Charge' };
const FX_ICON = { flames: '🔥', daiquiri: '🍹', fizz: '🫧', zap: '⚡' };
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
  return r < 0.2 ? 'sauce' : r < 0.38 ? 'zap' : r < 0.55 ? 'fizz' : r < 0.7 ? 'candy' : r < 0.85 ? 'pizza' : 'balloon';
}
// a gloved FIST with a wrist cuff (yellow stripe) — a plain mitten blob read as
// "a white ball" at rave size; the cuff is what makes it read as a glove
const MITT_SVG = '<svg viewBox="0 0 10 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="0" width="4" height="1" fill="#111111"/><rect x="3" y="1" width="1" height="1" fill="#111111"/><rect x="4" y="1" width="4" height="1" fill="#fffdf5"/><rect x="8" y="1" width="1" height="1" fill="#111111"/><rect x="0" y="2" width="1" height="4" fill="#111111"/><rect x="1" y="2" width="1" height="4" fill="#ffe135"/><rect x="2" y="2" width="1" height="4" fill="#111111"/><rect x="3" y="2" width="6" height="4" fill="#fffdf5"/><rect x="9" y="2" width="1" height="4" fill="#111111"/><rect x="3" y="6" width="1" height="1" fill="#111111"/><rect x="4" y="6" width="4" height="1" fill="#fffdf5"/><rect x="8" y="6" width="1" height="1" fill="#111111"/><rect x="4" y="7" width="4" height="1" fill="#111111"/></svg>';
// Floor-item sprites — authored in scratchpad floor-items.py (Pillow-verified on
// the real floor colour at floor size; the old 7×7 vinyl "looked like a rock").
const SAUCE_SVG = '<svg viewBox="0 0 8 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="0" width="2" height="1" fill="#3a304c"/><rect x="3" y="1" width="2" height="1" fill="#3a304c"/><rect x="2" y="2" width="1" height="1" fill="#1e182c"/><rect x="3" y="2" width="2" height="1" fill="#fffaf0"/><rect x="5" y="2" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#1e182c"/><rect x="3" y="3" width="2" height="1" fill="#e83b3b"/><rect x="5" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="4" height="1" fill="#e83b3b"/><rect x="6" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#1e182c"/><rect x="2" y="5" width="1" height="1" fill="#e83b3b"/><rect x="3" y="5" width="2" height="1" fill="#fffaf0"/><rect x="5" y="5" width="1" height="1" fill="#e83b3b"/><rect x="6" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="2" height="1" fill="#fffaf0"/><rect x="4" y="6" width="1" height="1" fill="#ff9128"/><rect x="5" y="6" width="1" height="1" fill="#fffaf0"/><rect x="6" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="7" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#fffaf0"/><rect x="3" y="7" width="2" height="1" fill="#ff9128"/><rect x="5" y="7" width="1" height="1" fill="#fffaf0"/><rect x="6" y="7" width="1" height="1" fill="#1e182c"/><rect x="1" y="8" width="1" height="1" fill="#1e182c"/><rect x="2" y="8" width="1" height="1" fill="#e83b3b"/><rect x="3" y="8" width="2" height="1" fill="#fffaf0"/><rect x="5" y="8" width="1" height="1" fill="#e83b3b"/><rect x="6" y="8" width="1" height="1" fill="#1e182c"/><rect x="1" y="9" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="2" height="1" fill="#e83b3b"/><rect x="4" y="9" width="1" height="1" fill="#a62026"/><rect x="5" y="9" width="1" height="1" fill="#e83b3b"/><rect x="6" y="9" width="1" height="1" fill="#1e182c"/><rect x="1" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="10" width="2" height="1" fill="#e83b3b"/><rect x="4" y="10" width="2" height="1" fill="#a62026"/><rect x="6" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="11" width="4" height="1" fill="#1e182c"/></svg>';
const DAIQUIRI_SVG = '<svg viewBox="0 0 10 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="0" width="2" height="1" fill="#ff5078"/><rect x="3" y="1" width="4" height="1" fill="#ff5078"/><rect x="2" y="2" width="1" height="1" fill="#ff5078"/><rect x="3" y="2" width="1" height="1" fill="#c8285a"/><rect x="4" y="2" width="2" height="1" fill="#ff5078"/><rect x="6" y="2" width="1" height="1" fill="#c8285a"/><rect x="7" y="2" width="1" height="1" fill="#ff5078"/><rect x="4" y="3" width="2" height="1" fill="#ffffff"/><rect x="1" y="4" width="1" height="1" fill="#6caac4"/><rect x="2" y="4" width="6" height="1" fill="#ffd650"/><rect x="8" y="4" width="1" height="1" fill="#6caac4"/><rect x="1" y="5" width="1" height="1" fill="#6caac4"/><rect x="2" y="5" width="1" height="1" fill="#ffd650"/><rect x="3" y="5" width="1" height="1" fill="#f0f0fa"/><rect x="4" y="5" width="3" height="1" fill="#ffd650"/><rect x="7" y="5" width="1" height="1" fill="#d6a024"/><rect x="8" y="5" width="1" height="1" fill="#6caac4"/><rect x="2" y="6" width="1" height="1" fill="#6caac4"/><rect x="3" y="6" width="3" height="1" fill="#ffd650"/><rect x="6" y="6" width="1" height="1" fill="#d6a024"/><rect x="7" y="6" width="1" height="1" fill="#6caac4"/><rect x="3" y="7" width="1" height="1" fill="#6caac4"/><rect x="4" y="7" width="1" height="1" fill="#ffd650"/><rect x="5" y="7" width="1" height="1" fill="#d6a024"/><rect x="6" y="7" width="1" height="1" fill="#6caac4"/><rect x="4" y="8" width="2" height="1" fill="#6caac4"/><rect x="4" y="9" width="2" height="1" fill="#6caac4"/><rect x="3" y="10" width="4" height="1" fill="#6caac4"/><rect x="2" y="11" width="6" height="1" fill="#6caac4"/></svg>';
const FIZZ_SVG = '<svg viewBox="0 0 8 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="0" width="1" height="1" fill="#ff4d9d"/><rect x="6" y="0" width="1" height="1" fill="#ffffff"/><rect x="4" y="1" width="1" height="1" fill="#ff4d9d"/><rect x="5" y="1" width="1" height="1" fill="#ffffff"/><rect x="1" y="2" width="1" height="1" fill="#6caac4"/><rect x="2" y="2" width="4" height="1" fill="#ffffff"/><rect x="6" y="2" width="1" height="1" fill="#6caac4"/><rect x="1" y="3" width="1" height="1" fill="#6caac4"/><rect x="2" y="3" width="1" height="1" fill="#78ebff"/><rect x="3" y="3" width="1" height="1" fill="#ffffff"/><rect x="4" y="3" width="2" height="1" fill="#78ebff"/><rect x="6" y="3" width="1" height="1" fill="#6caac4"/><rect x="1" y="4" width="1" height="1" fill="#6caac4"/><rect x="2" y="4" width="3" height="1" fill="#78ebff"/><rect x="5" y="4" width="1" height="1" fill="#ffffff"/><rect x="6" y="4" width="1" height="1" fill="#6caac4"/><rect x="1" y="5" width="1" height="1" fill="#6caac4"/><rect x="2" y="5" width="1" height="1" fill="#ffffff"/><rect x="3" y="5" width="3" height="1" fill="#78ebff"/><rect x="6" y="5" width="1" height="1" fill="#6caac4"/><rect x="1" y="6" width="1" height="1" fill="#6caac4"/><rect x="2" y="6" width="4" height="1" fill="#78ebff"/><rect x="6" y="6" width="1" height="1" fill="#6caac4"/><rect x="1" y="7" width="1" height="1" fill="#6caac4"/><rect x="2" y="7" width="1" height="1" fill="#78ebff"/><rect x="3" y="7" width="1" height="1" fill="#ffffff"/><rect x="4" y="7" width="2" height="1" fill="#78ebff"/><rect x="6" y="7" width="1" height="1" fill="#6caac4"/><rect x="1" y="8" width="1" height="1" fill="#6caac4"/><rect x="2" y="8" width="4" height="1" fill="#78ebff"/><rect x="6" y="8" width="1" height="1" fill="#6caac4"/><rect x="1" y="9" width="1" height="1" fill="#6caac4"/><rect x="2" y="9" width="1" height="1" fill="#42a8c6"/><rect x="3" y="9" width="2" height="1" fill="#78ebff"/><rect x="5" y="9" width="1" height="1" fill="#42a8c6"/><rect x="6" y="9" width="1" height="1" fill="#6caac4"/><rect x="1" y="10" width="1" height="1" fill="#6caac4"/><rect x="2" y="10" width="4" height="1" fill="#42a8c6"/><rect x="6" y="10" width="1" height="1" fill="#6caac4"/><rect x="1" y="11" width="6" height="1" fill="#6caac4"/></svg>';

const ZAP_SVG = '<svg viewBox="0 0 8 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="0" width="1" height="1" fill="#1e182c"/><rect x="4" y="0" width="2" height="1" fill="#78ebff"/><rect x="2" y="1" width="1" height="1" fill="#1e182c"/><rect x="3" y="1" width="3" height="1" fill="#78ebff"/><rect x="2" y="2" width="1" height="1" fill="#1e182c"/><rect x="3" y="2" width="1" height="1" fill="#78ebff"/><rect x="4" y="2" width="1" height="1" fill="#ffffff"/><rect x="5" y="2" width="1" height="1" fill="#78ebff"/><rect x="1" y="3" width="1" height="1" fill="#1e182c"/><rect x="2" y="3" width="1" height="1" fill="#78ebff"/><rect x="3" y="3" width="1" height="1" fill="#ffffff"/><rect x="4" y="3" width="1" height="1" fill="#78ebff"/><rect x="5" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#1e182c"/><rect x="2" y="4" width="1" height="1" fill="#78ebff"/><rect x="3" y="4" width="1" height="1" fill="#ffffff"/><rect x="4" y="4" width="1" height="1" fill="#78ebff"/><rect x="0" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#78ebff"/><rect x="2" y="5" width="2" height="1" fill="#ffffff"/><rect x="4" y="5" width="2" height="1" fill="#78ebff"/><rect x="6" y="5" width="1" height="1" fill="#1e182c"/><rect x="0" y="6" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="2" height="1" fill="#78ebff"/><rect x="3" y="6" width="1" height="1" fill="#ffffff"/><rect x="4" y="6" width="1" height="1" fill="#78ebff"/><rect x="5" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="1" height="1" fill="#ffffff"/><rect x="4" y="7" width="1" height="1" fill="#78ebff"/><rect x="2" y="8" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="2" height="1" fill="#78ebff"/><rect x="1" y="9" width="1" height="1" fill="#1e182c"/><rect x="2" y="9" width="2" height="1" fill="#78ebff"/><rect x="1" y="10" width="1" height="1" fill="#1e182c"/><rect x="2" y="10" width="1" height="1" fill="#78ebff"/><rect x="1" y="11" width="2" height="1" fill="#1e182c"/></svg>';
const CANDY_SVG = '<svg viewBox="0 0 12 8" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0" width="1" height="1" fill="#c62c74"/><rect x="4" y="0" width="4" height="1" fill="#c62c74"/><rect x="10" y="0" width="1" height="1" fill="#c62c74"/><rect x="0" y="1" width="1" height="1" fill="#c62c74"/><rect x="1" y="1" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="1" width="6" height="1" fill="#ff4d9d"/><rect x="10" y="1" width="1" height="1" fill="#ff4d9d"/><rect x="11" y="1" width="1" height="1" fill="#c62c74"/><rect x="0" y="2" width="1" height="1" fill="#c62c74"/><rect x="1" y="2" width="3" height="1" fill="#ff4d9d"/><rect x="4" y="2" width="1" height="1" fill="#f0f0fa"/><rect x="5" y="2" width="6" height="1" fill="#ff4d9d"/><rect x="11" y="2" width="1" height="1" fill="#c62c74"/><rect x="1" y="3" width="1" height="1" fill="#c62c74"/><rect x="2" y="3" width="2" height="1" fill="#ff4d9d"/><rect x="4" y="3" width="1" height="1" fill="#f0f0fa"/><rect x="5" y="3" width="1" height="1" fill="#ffffff"/><rect x="6" y="3" width="4" height="1" fill="#ff4d9d"/><rect x="10" y="3" width="1" height="1" fill="#c62c74"/><rect x="1" y="4" width="1" height="1" fill="#c62c74"/><rect x="2" y="4" width="3" height="1" fill="#ff4d9d"/><rect x="5" y="4" width="1" height="1" fill="#f0f0fa"/><rect x="6" y="4" width="4" height="1" fill="#ff4d9d"/><rect x="10" y="4" width="1" height="1" fill="#c62c74"/><rect x="0" y="5" width="1" height="1" fill="#c62c74"/><rect x="1" y="5" width="5" height="1" fill="#ff4d9d"/><rect x="6" y="5" width="1" height="1" fill="#f0f0fa"/><rect x="7" y="5" width="4" height="1" fill="#ff4d9d"/><rect x="11" y="5" width="1" height="1" fill="#c62c74"/><rect x="0" y="6" width="1" height="1" fill="#c62c74"/><rect x="1" y="6" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="6" width="6" height="1" fill="#ff4d9d"/><rect x="10" y="6" width="1" height="1" fill="#ff4d9d"/><rect x="11" y="6" width="1" height="1" fill="#c62c74"/><rect x="1" y="7" width="1" height="1" fill="#c62c74"/><rect x="4" y="7" width="4" height="1" fill="#c62c74"/><rect x="10" y="7" width="1" height="1" fill="#c62c74"/></svg>';
const PIZZA_SVG = '<svg viewBox="0 0 10 10" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0" width="8" height="1" fill="#dea85c"/><rect x="0" y="1" width="1" height="1" fill="#dea85c"/><rect x="1" y="1" width="8" height="1" fill="#ffd650"/><rect x="9" y="1" width="1" height="1" fill="#dea85c"/><rect x="1" y="2" width="1" height="1" fill="#dea85c"/><rect x="2" y="2" width="1" height="1" fill="#ffd650"/><rect x="3" y="2" width="2" height="1" fill="#e83b3b"/><rect x="5" y="2" width="2" height="1" fill="#ffd650"/><rect x="7" y="2" width="1" height="1" fill="#e83b3b"/><rect x="8" y="2" width="1" height="1" fill="#dea85c"/><rect x="1" y="3" width="1" height="1" fill="#dea85c"/><rect x="2" y="3" width="1" height="1" fill="#ffd650"/><rect x="3" y="3" width="2" height="1" fill="#e83b3b"/><rect x="5" y="3" width="1" height="1" fill="#ffd650"/><rect x="6" y="3" width="2" height="1" fill="#e83b3b"/><rect x="8" y="3" width="1" height="1" fill="#dea85c"/><rect x="2" y="4" width="1" height="1" fill="#dea85c"/><rect x="3" y="4" width="3" height="1" fill="#ffd650"/><rect x="6" y="4" width="2" height="1" fill="#e83b3b"/><rect x="8" y="4" width="1" height="1" fill="#dea85c"/><rect x="2" y="5" width="1" height="1" fill="#dea85c"/><rect x="3" y="5" width="4" height="1" fill="#ffd650"/><rect x="7" y="5" width="1" height="1" fill="#dea85c"/><rect x="3" y="6" width="1" height="1" fill="#dea85c"/><rect x="4" y="6" width="2" height="1" fill="#e83b3b"/><rect x="6" y="6" width="1" height="1" fill="#ffd650"/><rect x="7" y="6" width="1" height="1" fill="#dea85c"/><rect x="3" y="7" width="1" height="1" fill="#dea85c"/><rect x="4" y="7" width="2" height="1" fill="#ffd650"/><rect x="6" y="7" width="1" height="1" fill="#dea85c"/><rect x="4" y="8" width="2" height="1" fill="#dea85c"/><rect x="4" y="9" width="2" height="1" fill="#dea85c"/></svg>';
const BALLOON_SVG = '<svg viewBox="0 0 8 12" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="1" height="1" fill="#1e182c"/><rect x="3" y="0" width="2" height="1" fill="#c62c74"/><rect x="5" y="0" width="1" height="1" fill="#1e182c"/><rect x="1" y="1" width="1" height="1" fill="#1e182c"/><rect x="2" y="1" width="1" height="1" fill="#c62c74"/><rect x="3" y="1" width="2" height="1" fill="#ff4d9d"/><rect x="5" y="1" width="1" height="1" fill="#c62c74"/><rect x="6" y="1" width="1" height="1" fill="#1e182c"/><rect x="0" y="2" width="1" height="1" fill="#1e182c"/><rect x="1" y="2" width="1" height="1" fill="#c62c74"/><rect x="2" y="2" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="2" width="1" height="1" fill="#f0f0fa"/><rect x="4" y="2" width="2" height="1" fill="#ff4d9d"/><rect x="6" y="2" width="1" height="1" fill="#c62c74"/><rect x="7" y="2" width="1" height="1" fill="#1e182c"/><rect x="0" y="3" width="1" height="1" fill="#1e182c"/><rect x="1" y="3" width="1" height="1" fill="#c62c74"/><rect x="2" y="3" width="1" height="1" fill="#ff4d9d"/><rect x="3" y="3" width="1" height="1" fill="#f0f0fa"/><rect x="4" y="3" width="2" height="1" fill="#ff4d9d"/><rect x="6" y="3" width="1" height="1" fill="#c62c74"/><rect x="7" y="3" width="1" height="1" fill="#1e182c"/><rect x="0" y="4" width="1" height="1" fill="#1e182c"/><rect x="1" y="4" width="1" height="1" fill="#c62c74"/><rect x="2" y="4" width="4" height="1" fill="#ff4d9d"/><rect x="6" y="4" width="1" height="1" fill="#c62c74"/><rect x="7" y="4" width="1" height="1" fill="#1e182c"/><rect x="0" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="5" width="1" height="1" fill="#c62c74"/><rect x="2" y="5" width="4" height="1" fill="#ff4d9d"/><rect x="6" y="5" width="1" height="1" fill="#c62c74"/><rect x="7" y="5" width="1" height="1" fill="#1e182c"/><rect x="1" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="6" width="1" height="1" fill="#c62c74"/><rect x="3" y="6" width="2" height="1" fill="#ff4d9d"/><rect x="5" y="6" width="1" height="1" fill="#c62c74"/><rect x="6" y="6" width="1" height="1" fill="#1e182c"/><rect x="2" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="7" width="2" height="1" fill="#c62c74"/><rect x="5" y="7" width="1" height="1" fill="#1e182c"/><rect x="3" y="8" width="2" height="1" fill="#1e182c"/><rect x="3" y="9" width="1" height="1" fill="#ffffff"/><rect x="2" y="10" width="1" height="1" fill="#ffffff"/><rect x="3" y="11" width="1" height="1" fill="#ffffff"/></svg>';
const ITEM_SVGS = { sauce: SAUCE_SVG, zap: ZAP_SVG, fizz: FIZZ_SVG, candy: CANDY_SVG, pizza: PIZZA_SVG, balloon: BALLOON_SVG };

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
  // first-timers get a party-ready random fit
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return {
    hat: pick(['none', 'party', 'crown', 'tophat', 'cowboy']),
    glasses: pick(['none', 'shades', 'hearts', 'visor']),
    extras: { mustache: Math.random() < 0.25, bowtie: Math.random() < 0.25 },
    effect: 'none',
  };
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
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keysDown.delete(k); });
  addEventListener('blur', () => keysDown.clear());

  floor.addEventListener('click', (e) => {
    if (e.target.closest('.rv-zoom') || e.target.closest('.rv-quest')) return; // buttons + the quest chip are not walk orders
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
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
        // report the RESTING spot — the throttle can eat the last step, and the
        // server verifies claims against its copy of your position
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'move', x: +me.x.toFixed(1), y: +me.y.toFixed(1) }));
        return;
      }
      dx /= dist; dy /= dist;
    }
    if (!dx && !dy) return;
    const norm = Math.hypot(dx, dy) || 1;
    let boost = fxActive(me, now) && me.fx.id === 'daiquiri' ? 1.45 : 1; // fresh daiquiri legs
    if (now < hypeModeUntil) boost *= 1.25; // hype mode = disco legs — peaking must FEEL like peaking
    const step = (WALK_SPEED * boost * dtMs) / 1000;
    let nx = clamp(me.x + (dx / norm) * step, 4, 96);
    let ny = clamp(me.y + (dy / norm) * step, topClamp, 92);
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

  function dropRaver(id) {
    const r = ravers.get(id);
    if (!r) return;
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
          spEl.innerHTML = kind === 'daiquiri' ? DAIQUIRI_SVG : FIZZ_SVG;
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
  function addHype(n) {
    if (hypeCharged || Date.now() < hypeModeUntil) return; // holds while armed or peaking
    hype = Math.min(HYPE_MAX, hype + n * hypeBoost);
    lastHypeGain = Date.now();
    if (hype >= HYPE_MAX) {
      // the meter is STATUS (it pulses FULL); the ACTION lights up in the
      // controls with the other actions — interaction grammar (Trym's call)
      hypeCharged = true;
      el('rvDropBtn').hidden = false;
      mixerEl.classList.add('rv-mixer--charged');
    }
    renderHype();
  }
  function spendHype() {
    if (!hypeCharged) return;
    hypeCharged = false;
    el('rvDropBtn').hidden = true;
    mixerEl.classList.remove('rv-mixer--charged');
    hype = 0;
    hypeModeUntil = Date.now() + HYPE_MODE_MS;
    miniDropUntil = Date.now() + 8000; // YOU drop the floor — strobe, pyro, the works
    passPatch('hype');
    passStat('hypes');
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
      floor.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }
    setTimeout(endHypeMode, HYPE_MODE_MS);
    nightEvent('hypedrop');
  }
  el('rvDropBtn').addEventListener('click', spendHype);
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
  function tickRun() {
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    const now = Date.now();
    if (!run) {
      if (now >= nextRunAt) {
        run = newRun();
        if (!run) nextRunAt = now + 2500;
      }
      return;
    }
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
        addHype(6);
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
  function bumpChain() {
    const now = Date.now();
    chain = now - chainAt < CHAIN_MS ? chain + 1 : 1;
    chainAt = now;
    addHype(12); // every pickup is hype fuel
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
    if (id === myId) bumpChain();
    if (fx) {
      applyFx(id, fx);
    } else if (id === myId && SNACKS[kind]) {
      const toast = document.createElement('div');
      toast.className = 'rv-glowtoast';
      toast.innerHTML = SNACKS[kind][0] + ' <b>' + SNACKS[kind][1] + '</b>' + (chain > 1 ? ' — chain ×' + chain + '!' : ' — keep moving, keep the chain!');
      floor.appendChild(toast);
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
    if (id === myId) {
      bumpChain();
      const toast = document.createElement('div');
      toast.className = 'rv-glowtoast';
      toast.innerHTML = '🍌 <b>THE GOLDEN BANANA</b> — the whole floor parties for you!';
      floor.appendChild(toast);
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
        zap: 'you’re crackling with static!',
      }[fx.id] || '') + chainTag();
      floor.appendChild(toast);
      setTimeout(() => toast.remove(), 4500);
      track('rave_fx', { fx: fx.id });
    } else {
      showBubble(FX_ICON[fx.id] + ' ' + autoName(r.outfit) + ' got the ' + (FX_NAMES[fx.id] || 'good stuff') + '!', false, 5000);
    }
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
      floor.appendChild(toast);
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
    if (vPh < VINYL_WAIT && vinylWinClaimed !== vWin && !carried) {
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
      const soloFx = { sauce: 'flames', zap: 'zap', fizz: 'fizz' }[itemLive.kind];
      if (ws && ws.readyState === 1) sendClaim('{"t":"item"}');
      else itemGrant(myId, itemLive.win, itemLive.kind, soloFx ? { id: soloFx, until: Date.now() + (soloFx === 'zap' ? FX_ZAP_MS : FX_MS) } : undefined);
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
        applyFx(myId, { id: barSpecialLive.kind, until: Date.now() + FX_MS }, { x: 10, y: 76 });
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
        if (Math.hypot(a.x - b.x, a.y - b.y) > FIVE_DIST) continue;
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
            victim.wrap.classList.add('rv-shock');
            setTimeout(() => victim.wrap.classList.remove('rv-shock'), 460);
            if (victim.id === myId) addHype(4); // a jolt IS hype
          }
        }
        const moved = (a.lastMoveAt && now - a.lastMoveAt < 8000) || (b.lastMoveAt && now - b.lastMoveAt < 8000);
        if (!moved) continue; // idle clusters don't spontaneously combust into greetings
        const key = a.id < b.id ? a.id + b.id : b.id + a.id;
        if ((fived.get(key) || 0) > now) continue;
        fived.set(key, now + FIVE_COOLDOWN);
        spawnFive((a.x + b.x) / 2, Math.min(a.y, b.y) - 9); // ABOVE both heads — between them it hid behind the sprites
        if (a.id === myId || b.id === myId) { track('rave_highfive'); passStat('fives'); }
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
      ws.send(JSON.stringify({ t: 'hi', outfit: myOutfit() }));
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
        if (m.on && m.id === myId) el('rvStage').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        if (tourActive && tourStep === 3) tourBox(el('rvBarman'), 'BARTY, THE BARTENDER', 'calls the happy hours, mixes the specials, hands out tonight’s jobs. never stops talking.', { noPool: true });
      }, 600);
    },
    () => { // the mixer: camera home; screen-space UI can't be zoomed, so the
      // meter itself steps forward for its close-up
      world.style.transform = '';
      mixerEl.classList.add('rv-mixer--tour');
      setTimeout(() => {
        if (tourActive && tourStep === 4) tourBox(mixerEl, 'THE JELLY METER', 'everything you do fills it with JELLY. full = the JELLY TIME button lights up in your controls — press it and the floor drops.', { noPool: true });
      }, 550);
    },
    () => { // the floor itself: full-floor pool, caption pinned up top like a subtitle
      const how = matchMedia('(pointer: coarse)').matches ? 'tap anywhere to walk over.' : 'walk with WASD, or click anywhere.';
      tourBox(el('rvTrails'), 'THE DANCE FLOOR', how + ' chase the sparkle trails, catch what lands, bump into strangers.', { pad: -18, pin: 'top' });
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
      tourBox(tourDemoEl, 'FLOOR SNACKS', 'something lands every minute or two. first banana to reach it keeps it — pickups chain, chains build JELLY.', { pad: 12 });
    },
  ];
  function runTour() {
    if (tourActive || !myId || !ravers.get(myId)) return;
    tourActive = true;
    tourStep = -1;
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
    refreshZoomBtn(); // the camera toggle gets its corner back
    track(skipped ? 'rave_tour_skip' : 'rave_tour_done', { step: tourStep });
    nightInit(); // the tour hands straight off to Barty's first job
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
    { n: 1, steps: [ // FIRST NIGHT — the guided tour, extends the welcome show
      { tray: 'go to the bar — first one’s on the house', check: 'bar',
        say: ['well howdy, new face! 🤠 c’mon down to the bar — first one’s on the house!', { t: 'nobody ever bought ME a first one. anyway!', mutter: true }] },
      { tray: 'run the lost record up to the DJ', check: 'qvinyl',
        say: ['there ya go! now — the DJ lost a record out on that floor. run it up to the booth, would ya?', { t: 'errands build character. they’re all i had.', mutter: true }] },
      { tray: 'fill the JELLY meter — then hit JELLY TIME', check: 'hypedrop',
        say: ['WOO, listen to that! last job: fill that JELLY meter — sparkles, snacks, the works — and when she’s full… you know what time it is.'] },
    ], done: { patch: 'night1',
      say: ['FIRST NIGHTSHIFT done, partner! 🌟 you’re one of us now — back to clubbing! night two’s on me tomorrow.', { t: 'i’ll be here. i’m always here.', mutter: true }] } },
    { n: 2, steps: [ // look who's back — the club KNOWS you now
      { tray: 'build a chain of THREE pickups', check: 'chain3',
        say: ['well look who’s BACK! 🤠 knew it. folks always come back.', { t: '’cept pa.', mutter: true }, 'tonight’s shift: a CHAIN of THREE — pickups, back to back, no dawdlin’!'] },
    ], done: { patch: null,
      say: ['shift’s OVER — back to clubbing, partner! same time tomorrow?', { t: 'i’ll count the hours. all of ’em.', mutter: true }] } },
  ];
  const NIGHT_TEST = parseInt((location.search.match(/nighttest=(\d)/) || [])[1] || '0', 10);
  const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  function nightLoad() { try { return JSON.parse(localStorage.getItem('rv-night-v1') || '{}'); } catch (e) { return {}; } }
  let night = null; // { def, step, qv }
  function nightInit() {
    if (night) return; // a tour replay must not restart a night in progress
    const s = nightLoad();
    if (!NIGHT_TEST && s.lastStamp === localDay()) {
      // already stamped tonight: the chip stays as the day's receipt — an
      // empty corner read as "broken", not "done"
      nightTray('✔ nightshift done — back to clubbing', true);
      return;
    }
    const arc = NIGHT_TEST || s.arc || 1;
    if (arc > NIGHTS.length) return; // Act One is all we have — Act Two arrives with "the program"
    night = { def: NIGHTS[arc - 1], step: -1 };
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
        if (st.check === 'qvinyl') nightSpawnVinyl();
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
  function nightFrame(now) { // proximity checks at frame rate (the claims lesson)
    if (!night || night.step < 0) return;
    const st = night.def.steps[night.step];
    if (!st) return;
    const me = myId && ravers.get(myId);
    if (!me || me.stage) return;
    if (now - (night.lastPoll || 0) < 120) return;
    night.lastPoll = now;
    if (st.check === 'bar' && me.x < BAR_ZONE.x && me.y > BAR_ZONE.y) {
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
    }
  }
  function nightEvent(kind, val) { // hooks fired by the floor's own machinery
    if (!night || night.step < 0) return;
    const st = night.def.steps[night.step];
    if (!st) return;
    if ((st.check === 'hypedrop' && kind === 'hypedrop')
      || (st.check === 'chain3' && kind === 'chain' && val >= 3)) nightAdvance();
  }
  function nightStamp() {
    const d = night.def;
    night = null;
    // THE STAMP-OUT: your shift ends, the club doesn't — big type, the floor
    // drops FOR you, Barty stamps you out, and the chip becomes the receipt
    bigMoment('NIGHTSHIFT DONE ✔', 'back to clubbing!');
    confettiBurst();
    miniDropUntil = Date.now() + 8000; // the club celebrates your shift
    bartySay(d.done.say, true);
    nightTray('✔ nightshift done — back to clubbing', true);
    if (d.done.patch) passPatch(d.done.patch);
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
    floor.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
    track('rave_glowstick_unlock');
    passPatch('survivor', { quiet: true }); // the glowtoast IS the celebration here
  }
  setInterval(checkGlowstick, 5000);

  stageBtn.addEventListener('click', () => {
    if (stageBtn.disabled) return;
    const want = !onStage();
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'stage', on: want }));
    else if (myId) { // solo mode: the stage is all yours
      setStage(myId, want);
      if (want) {
        const sr = ravers.get(myId);
        if (sr) showBubble('⭐ ' + autoName(sr.outfit) + ' takes the stage!', false, 4000);
        el('rvStage').scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    for (const r of ravers.values()) {
      if (r.lastWalk && now - r.lastWalk > 300) stopLean(r); // came to rest — stand straight (keep facing)
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
        if (!hasFx) continue;
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
          const w = r.wrap;
          w.classList.add('rv-shock');
          setTimeout(() => w.classList.remove('rv-shock'), 460);
        }
        // flames + dashes are PARTICLES at past positions (a real trail behind the
        // walker) — drawing at the live feet hid them under the sprite, and the
        // canvas fade killed them in ~1s (Trym, iOS). Each spawn lands at the
        // PREVIOUS spawn spot (one step behind, never in front of the banana);
        // 170ms spacing = half the sprites, each frame readable (Trym round 2).
        if ((r.fx.id === 'flames' || r.fx.id === 'daiquiri') && moving && now - (r.fxSpawnAt || 0) > 170) {
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
        }
      }
      // fx particle trails: flames are SPRITES that flicker, sway and rise as they
      // die (~2s); dashes streak ~1.4s. Both fade with age.
      if (fxParts.length) {
        fxParts = fxParts.filter((p) => now - p.t0 < (p.kind === 'flames' ? 1400 : p.kind === 'zap' ? 350 : 1400));
        trailCtx.imageSmoothingEnabled = false;
        for (const p of fxParts) {
          const age = (now - p.t0) / (p.kind === 'flames' ? 1400 : p.kind === 'zap' ? 350 : 1400);
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
            const w = 21 * (1 - age * 0.45);
            const h = w * 8 / 7;
            const sway = Math.sin((p.seed || 0) * 2.1 + now / 160) * 2.5;
            trailCtx.globalAlpha = 0.95 * (1 - age);
            trailCtx.drawImage(frame, p.x - w / 2 + sway, p.y - h - age * 12, w, h);
            trailCtx.globalAlpha = 1;
          } else {
            const gx2 = Math.floor(p.x / 8) * 8;
            const gy2 = Math.floor(p.y / 8) * 8;
            trailCtx.fillStyle = `rgba(255, 214, 80, ${0.7 * (1 - age)})`;
            trailCtx.fillRect(gx2 - 4, gy2 - 6, 12, 3);
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
          trailCtx.fillStyle = p.c;
          trailCtx.fillRect(p.px, p.py, p.s, p.s);
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
      if (lastDrop === true && !dropActive) { passStat('drops'); addHype(8); }
      lastDrop = dropActive;
      document.body.classList.toggle('rv-drop', dropActive && !reduced);
      dropFlashEl.hidden = !dropActive;
    }
    if (idx !== lastIdx) {
      lastIdx = idx;
      const hue = dropActive ? Math.floor((now / 12) % 360) : 0;
      for (const r of [...ravers.values()].slice(0, MAX_VISIBLE)) {
        const o = r.outfit;
        drawComposite(r.cv.getContext('2d'), 160, idx, {
          bg: 'transparent', captions: false,
          // the courier's record rides the LEFT glove via the engine's hand anchor
          // (r.vinyl is a rave flag, never part of the broadcast outfit)
          hat: o.hat, glasses: o.glasses, extras: (r.vinyl || r.qvinyl) ? { ...(o.extras || {}), vinyl: true } : (o.extras || {}), top: '', bottom: '',
          effect: dropActive ? 'confetti' : o.effect,
          hue: dropActive ? hue : (o.effect === 'disco' ? (360 * idx / NFRAMES) : 0),
        });
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

  // ---- the pass: rave moments leave marks ----
  passVisit();
  passPatch('raver');
  setInterval(() => { if (ws && ws.readyState === 1) passStat('raveMin'); }, 60000);
  try { if (localStorage.getItem('rv-glowstick') === '1') passPatch('survivor', { quiet: true }); } catch (e) {}

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
    connect();
    requestAnimationFrame(tick);
  });
}
