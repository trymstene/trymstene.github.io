import { ART_P, ART_R } from '../data/wearart.js';
import { unpackArt } from './wear-unpack.js';   // pure, DOM-free, so the art gate can run it in node
import { KNIT_SVG } from '../data/knitwear.js';
import { ARCADE_SVG } from '../data/arcadewear.js';
import { TOWN_SVG } from '../data/townwear.js';
// Banana render engine — THE one render path, shared by the builder, the
// overlay, the rave and anything else that needs to draw dancing bananas.
// Extracted from banana-builder.js (4 Jul 2026) so N bananas can render from
// one code path: drawComposite takes the FULL outfit in `o` instead of
// closing over a single page-global state.
//   o: { hat, glasses, extras, top, bottom, bg, captions, hue, effect }
// CLIENT-ONLY module (creates Image objects at import) — never import from
// Astro frontmatter; that is what src/lib/banana-daily.js is for.

// the wearable catalog is PURE DATA, shared with the daily picker + the rave
// worker. Only the pixel ART is client-only, and since 19 Sep 2026 it SHIPS PACKED: the readable
// source is tools/wearart-source.js (outside src/, never bundled), the packed form is
// src/data/wearart.js, and ./wear-unpack.js turns one into the other byte for byte.
import { WEARABLE_PACKS as PACKS, ownsWearable } from '../data/wearables.js';

// ---- authentic dance frames ----
// ?v= busts stale browser caches: bump it whenever the sheet's pixels change,
// or old cached copies (e.g. the pre-fix sheet with white-filled arm gaps)
// keep haunting returning visitors' previews and exports.
// v7 = boundary columns scrubbed: frames 2/6's arm tips touched their cell
// edge and Chrome's sampler bled them 1px into the NEIGHBOUR frame — a
// floating vertical line blinking beside the banana (Trym, 3 Aug). Every
// frame's outer 2 columns are now guaranteed empty; keep it that way in
// tools/build-banana-assets.py rebuilds.
const SHEET_SRC = '/assets/banana-dance.png?v=7';
// 📐 proportions live in banana-geo.js so a surface can know them WITHOUT
// loading the sprite sheets. Re-exported below — one source of truth, one file down.
import { FW, FH, NFRAMES, BASE_CYCLE_S, PX, FRAME_H_FRAC, FRAME_TOP_FRAC } from './banana-geo.js';

// Per-frame anchors measured from the sprite pixels (Pillow-verified):
// eye centre (glasses), tip Y + head centre AT BRIM DEPTH (hat — the stem curves
// toward the body going down, so the hat anchor must be measured at the depth
// where the hat actually sits, per frame; this keeps the hat riding the head
// smoothly through the dance), and which way the face points.
// hands = the two white-glove centres [left, right] in screen space, measured by
// tools/find-hand-anchors.py — HELD items (anchor: 'hand') ride these. Both arms
// pump together in this dance (down 362 → up 135), so a held item pumps with the beat.
// feetX = the two shoe centroids [left, right] per frame (measured, y>=458 band).
// The feet bbox is fixed but the weight ROCKS side to side ~5px per frame — a
// held-still overlay reads as stiff, so shoes ride these per-frame anchors and
// dance with the banana. Bottom is constant (FEET_BOTTOM).
const FRAMES = [
  { eyeCx: 232, eyeCy: 222, hatCx: 272, btCx: 268, tipY: 85, face: 'right', hands: [[145, 362], [380, 362]], feetX: [159, 309] },
  { eyeCx: 232, eyeCy: 192, hatCx: 272, btCx: 270, tipY: 57, face: 'right', hands: [[116, 334], [409, 334]], feetX: [160, 308] },
  { eyeCx: 234, eyeCy: 135, hatCx: 248, btCx: 248, tipY: 0,  face: 'front', hands: [[45, 135], [437, 135]], feetX: [162, 306] },
  { eyeCx: 232, eyeCy: 156, hatCx: 206, btCx: 206, tipY: 28, face: 'front', hands: [[45, 206], [366, 206]], feetX: [163, 305] },
  { eyeCx: 236, eyeCy: 222, hatCx: 196, btCx: 200, tipY: 85, face: 'left',  hands: [[88, 362], [323, 362]], feetX: [159, 309] },
  { eyeCx: 236, eyeCy: 192, hatCx: 196, btCx: 198, tipY: 57, face: 'left',  hands: [[59, 334], [352, 334]], feetX: [160, 308] },
  { eyeCx: 234, eyeCy: 135, hatCx: 220, btCx: 220, tipY: 0,  face: 'front', hands: [[31, 135], [423, 135]], feetX: [162, 306] },
  { eyeCx: 237, eyeCy: 156, hatCx: 262, btCx: 262, tipY: 28, face: 'front', hands: [[102, 206], [423, 206]], feetX: [163, 305] },
];

// ---- accessory art: hand-authored PIXEL SVGs on the banana's own 13px grid ----
// Authored as ASCII pixel maps in tools/pixel-assets.py (Pillow-verified against
// the real frames) and emitted as crispEdges rect-grids. Coloured hats carry an
// auto-generated 1-unit black outline so they stay visible on any background.

// ⚠️ ORDER IS THE OLD ORDER: the three packs spread first, the wearables here win over them, exactly
// as when this was one literal. ART_R is the seven with sub-cell detail or a real image URL.
const SVG = {
  ...KNIT_SVG,   // 🧶 the tailor's knitwear (src/data/knitwear.js)
  ...ARCADE_SVG,   // 🕹 the Arcade's prizes (src/data/arcadewear.js)
  ...TOWN_SVG,   // 🏘️ the town residents' hand tools (src/data/townwear.js)
  ...ART_R,
};
for (const k in ART_P) SVG[k] = unpackArt(ART_P[k]);

const EFFECTS = [['none','None'],['disco','Disco'],['sparkle','Sparkles'],['confetti','Confetti']];

// ---- ASSET PACKS ----
// PACKS is imported from src/data/wearables.js (the single-source catalog).
// Every wearable's ART is keyed by its `art` field. To add one: add the entry in wearables.js,
// paste its pixel SVG into tools/wearart-source.js, then run `python tools/build-wearart.py`.
// 'core' is always on; a themed pack declares a month-day window and
// auto-activates. Any pack force-enables with ?pack=<id>. Chips, randomizer,
// URL state and rendering all derive from the registry — no other code changes.
function isPackActive(id, pack) {
  if (pack.always) return true;
  if (new URLSearchParams(location.search).get('pack') === id) return true;
  if (!pack.window) return false;
  const n = new Date();
  const md = String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  const { from, to } = pack.window;
  return from <= to ? (md >= from && md <= to) : (md >= from || md <= to); // 'from' > 'to' wraps over new year
}
const ACTIVE_PACKS = Object.entries(PACKS).filter(([id, p]) => isPackActive(id, p)).map(([, p]) => p);
const HAT_DEFS = ACTIVE_PACKS.flatMap((p) => p.hats || []);
const SHADE_DEFS = ACTIVE_PACKS.flatMap((p) => p.shades || []);
const EXTRA_DEFS = ACTIVE_PACKS.flatMap((p) => p.extras || []);
const HAT_BY_ID = Object.fromEntries(HAT_DEFS.map((h) => [h.id, h]));
const SHADE_BY_ID = Object.fromEntries(SHADE_DEFS.map((s) => [s.id, s]));
// preview-flagged items stay DRAWABLE (the BY_ID maps above keep them, so the
// dev review page can render them) but only enter the SELECTABLE lists when
// public — or when they're stand stock this visitor has BOUGHT (own_<id>)
const HATS = [['none', 'None'], ...HAT_DEFS.filter((h) => ownsWearable(h)).map((h) => [h.id, h.label])];
const GLASSES = [['none', 'None'], ...SHADE_DEFS.filter((s) => ownsWearable(s)).map((s) => [s.id, s.label])];

// The banana sprite's pixel unit is 13 source px; the pixel SVGs use 10 svg-px
// per unit. Sizing accessories in banana-pixels guarantees they match the
// sprite's resolution exactly (no mixed pixel densities).

const gridW = (key) => parseInt(key.match(/viewBox="0 0 (\d+)/)[1], 10) / 10;
const gridH = (key) => parseInt(key.match(/viewBox="0 0 \d+ (\d+)/)[1], 10) / 10;
// hat seating: deep enough to sit ON the head mass (not the stem peak); the
// x-anchor comes from the per-frame hatCx measured at this same depth. A hat
// def's `seat` adjusts per hat (outlined hats: -1, their bottom row is outline).
const HAT_OVERLAP = 7.3;
// shades ride slightly high to fully cover the eye whites. Chest-anchored
// extras (bow tie) use per-frame btCx: the body sways ±3 units at chest depth.
const SH_DY = -0.5;
// FOOTWEAR DOCTRINE (feet slot). Footwear art is ONE shoe (viewBox ~70×40),
// drawn once per foot at that foot's per-frame `feetX` centroid, so the pair
// rocks with the dance. Rules for any new shoe:
//   • COVER: each foot's white footprint is x±35 of its centroid, y 458→483
//     (~70px). The shoe must at minimum cover that (bigger = fine: giant shoes;
//     smaller = never), so the banana's own white shoes can't peek out.
//   • CRISP: shoes overlay the sprite's own crisp pixels → draw with smoothing
//     OFF (below), or anti-aliasing fractures the shared edges into notches.
//   • FLAT: the shoe hangs from FEET_BOTTOM so it sits on the ground.
// FEET_CX is only a fallback centre if a frame lacks feetX.
const FEET_CX = 234, FEET_BOTTOM = 501;
// square-canvas layout: headroom above the frame so hats fit at the tall frames


// 🍌 WEARABLE ANCHOR POINTS (sprite-px, per frame). The Forge's Items Workshop
// and the runtime custom channel BOTH read this, so "where you drew it" and
// "where it rides" agree by construction. A user-drawn item stores its offset
// from one of these points at the reference frame, then rides that point as the
// banana dances. Any stable point on the body part works — offset does the rest.
export function wearAnchor(idx, kind, hand) {
  const F = FRAMES[idx] || FRAMES[2];
  if (kind === 'face') return { x: F.eyeCx, y: F.eyeCy };
  if (kind === 'chest' || kind === 'body') return { x: F.btCx, y: F.eyeCy };
  if (kind === 'feet') { const fX = F.feetX || [FEET_CX - 71, FEET_CX + 71]; return { x: (fX[0] + fX[1]) / 2, y: FEET_BOTTOM }; }
  if (kind === 'hand') { const h = F.hands ? (hand === 'left' ? F.hands[0] : F.hands[1]) : [FEET_CX, 300]; return { x: h[0], y: h[1] }; }
  return { x: F.hatCx, y: F.tipY }; // head (default)
}
export const WEAR_ANCHORS = ['head', 'face', 'chest', 'hand', 'feet'];

// ---- effects: deterministic particle tables so the 8-frame GIF loops perfectly ----
// positions are canvas fractions, kept near the banana so the emoji trim stays tight
const SPARKS = [
  { x: 0.24, y: 0.30 }, { x: 0.76, y: 0.26 }, { x: 0.30, y: 0.55 }, { x: 0.72, y: 0.58 },
  { x: 0.26, y: 0.76 }, { x: 0.76, y: 0.78 }, { x: 0.50, y: 0.14 }, { x: 0.68, y: 0.40 },
  { x: 0.33, y: 0.40 }, { x: 0.60, y: 0.84 },
];
const CONFETTI_COLORS = ['#ff4d6d', '#4db8ff', '#f2c200', '#37d67a', '#b388ff'];
const CONFETTI = Array.from({ length: 14 }, (_, k) => ({
  x: 0.26 + ((k * 0.383) % 1) * 0.48,
  off: (k * 0.37) % 1,
  c: CONFETTI_COLORS[k % CONFETTI_COLORS.length],
}));

const sheet = new Image(); sheet.src = SHEET_SRC;
const imgCache = {};
function imgFor(key) {
  if (imgCache[key]) return imgCache[key];
  const img = new Image();
  // an inline pixel-SVG string starts with '<'; anything else is a real image
  // URL (the plush banana = the original PNG, resized crisp — not re-gridded)
  img.src = key.charAt(0) === '<'
    ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(key)
    : key;
  imgCache[key] = img; return img;
}
Object.values(SVG).forEach(imgFor); // prewarm
async function assetsReady() {
  // Wait on load/error events, NOT img.decode(): decode() can hang forever on a
  // cache-served image in Chromium (bites the PDP, which awaits this at boot
  // while the sheet is still loading). Already-complete images resolve at once.
  const imgs = [sheet, ...Object.values(imgCache)];
  await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth) ? Promise.resolve() : new Promise((res) => {
    i.addEventListener('load', () => res(), { once: true });
    i.addEventListener('error', () => res(), { once: true });
  })));
}

// ⏳ wait for SPECIFIC art keys. Community items enter imgCache lazily — at
// their first drawAcc, which is AFTER boot's assetsReady resolved — and
// drawAcc silently skips an unloaded image, so a ONE-SHOT canvas (the PDP
// mockup, a print file) can paint a banana missing the item it just equipped
// (Trym's first-click-does-nothing report, 28 Aug). Resolves true only if it
// actually had to wait — callers repaint on true without looping.
async function artReady(keys) {
  const imgs = (keys || []).filter(Boolean).map(imgFor);
  const pending = imgs.filter((i) => !(i.complete && i.naturalWidth));
  if (!pending.length) return false;
  await Promise.all(pending.map((i) => new Promise((res) => {
    i.addEventListener('load', () => res(), { once: true });
    i.addEventListener('error', () => res(), { once: true });
  })));
  return true;
}

// Safari (macOS + iOS) does NOT support ctx.filter — it silently ignores it,
// so hue-rotate (disco, the drop rainbow) did nothing on Apple devices
// (Trym's iOS catch). Detect once; ?huetest forces the fallback for testing.
const CTX_FILTER_OK = (() => {
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('huetest')) return false;
    // ⚠️ do NOT detect by set-and-read-back: Safari has no ctx.filter IDL
    // attribute, so the assignment lands as a plain JS expando that echoes the
    // value straight back — the read-back check passed on Safari and sent it
    // down the native (dead) path. Prototype membership is the honest test.
    return typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
  } catch (e) { return false; }
})();
// the fallback's scratch canvases (module-cached, resized on demand)
let _hueLayerCv = null, _hueMaskCv = null;
function scratchCv(which, W) {
  let cv = which === 'layer' ? _hueLayerCv : _hueMaskCv;
  if (!cv) { cv = document.createElement('canvas'); if (which === 'layer') _hueLayerCv = cv; else _hueMaskCv = cv; }
  if (cv.width !== W) { cv.width = W; cv.height = W; }
  return cv;
}

// An outfit → the builder's share-link params, the exact inverse of
// sticker-core's parseDesign(). Lives here because this module owns the outfit
// contract; every surface that hands a banana off to a product page (the rave's
// LED merch slide, the park shop, the offer card) must encode it identically or
// the visitor lands on a stranger's banana.
function outfitParams(o) {
  const p = new URLSearchParams();
  if (!o) return p;
  if (o.hat && o.hat !== 'none') p.set('h', o.hat);
  if (o.glasses && o.glasses !== 'none') p.set('g', o.glasses);
  const ex = Object.keys(o.extras || {}).filter((k) => o.extras[k]);
  if (ex.length) p.set('ex', ex.join('.'));
  if (o.effect && o.effect !== 'none') p.set('e', o.effect);
  // 🎁 the community-item slot travels too — without it a caught item showed on
  // the banana in the world and was gone the moment you sent it to the shop
  if (o.c) p.set('c', o.c);
  return p;
}

// ---- THE HAND RESOLVER: two gloves, one item each, forever ----
// Outfits carry only item IDS (URLs, bb-last, rave broadcasts — no hand
// state), so who-holds-what must be DERIVED from the equipped set alone.
// That way every surface — builder, your rave banana, everyone ELSE'S view
// of you, pass, prints, OG cards — resolves identically with zero schema
// change. Rules, in order:
//   1. rave-granted transients (beer, vinyl, broom…) claim first — a beer in
//      your busy hand bumps your mug to the other glove (the ownership-plan's
//      "temporary hand override", for free);
//   2. then catalog order: each item takes its preferred glove, else the
//      free one, else it is NOT drawn. Three-fisted bananas cannot exist.
// New hand items need nothing beyond their manifest `hand:` — never touch this.
function resolveHands(extras) {
  const out = { left: null, right: null };
  if (!extras) return out;
  const held = EXTRA_DEFS.filter((d) => d.anchor === 'hand' && extras[d.id]);
  held.sort((a, b) => (b.raveOnly ? 1 : 0) - (a.raveOnly ? 1 : 0)); // stable: catalog order within groups
  for (const d of held) {
    const pref = d.hand === 'left' ? 'left' : 'right';
    const other = pref === 'left' ? 'right' : 'left';
    if (!out[pref]) out[pref] = d;
    else if (!out[other]) out[other] = d;
  }
  return out;
}

// ---- the one render path ----
// Draws frame `idx` composited into a W×W canvas.
// o: { bg: css color|'transparent', captions: bool, hue: deg, effect: 'none'|'disco'|'sparkle'|'confetti' }
// tier LIGHT colors (≠ metal colors — bronze light would read brown/mud):
// blue pool / white moonlight / gold radiance, gold always the brightest
// `core` is the ring at the silhouette, `mid` the dimmer fill behind the body.
// ⚠️ Tier LIGHT is not tier METAL: gold has to be the brightest of the three or
// the ladder inverts, and silver must never out-shine it.
const MEMBER_GLOW = {
  'sup-t1': { mid: 'rgba(70,120,255,0.30)', core: 'rgba(90,150,255,0.62)', r: 1.0 },
  'sup-t2': { mid: 'rgba(215,230,245,0.28)', core: 'rgba(230,242,255,0.60)', r: 1.06 },
  'sup-t3': { mid: 'rgba(255,200,60,0.36)', core: 'rgba(255,214,80,0.80)', r: 1.16 },
};

function drawComposite(ctx, W, idx, o) {
  ctx.clearRect(0, 0, W, W);
  if (o.bg && o.bg !== 'transparent') { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, W); }
  const fh = W * FRAME_H_FRAC, scale = fh / FH, fw = FW * scale;
  const fx = (W - fw) / 2, fy = W * FRAME_TOP_FRAC;
  const F = FRAMES[idx];
  // 💛 THE MEMBER GLOW — an aura AROUND the banana, in its tier's own light.
  // ⚠️ IT USED TO BE A POOL ON THE GROUND at the feet, and it barely showed:
  // the banana already casts a default shadow under itself, so a soft blue
  // ellipse landed straight on top of a dark one and cancelled out (Trym). A
  // halo hugging the body has nothing competing with it and reads on any
  // background.
  // 'screen' so it only ever BRIGHTENS — normal alpha mixes orange into green
  // grass and makes mud. One radial gradient per frame + a wall-clock pulse,
  // both ancient canvas and iOS-safe. It keys off the hat id, so surfaces that
  // strip member gear (sticker-core → every product render) lose the glow with
  // the hat automatically. o.glow === false opts out.
  const mgl = HAT_BY_ID[o.hat] && HAT_BY_ID[o.hat].member && o.glow !== false
    ? MEMBER_GLOW[HAT_BY_ID[o.hat].member] : null;
  if (mgl) {
    const cx = fx + fw / 2;
    const cy = fy + FH * 0.52 * scale;        // the body's mass, not its feet
    const pulse = 1 + 0.06 * Math.sin(Date.now() / 620);
    const r = fh * 0.46 * mgl.r * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    // ⚠️ THE PEAK IS NOT AT THE CENTRE. A gradient brightest in the middle
    // hides its own best part behind the banana; pushing the peak out to ~0.45
    // puts the light where the silhouette actually is, so it reads as a glow
    // coming OFF the banana rather than a lamp behind it.
    grad.addColorStop(0, mgl.mid);
    grad.addColorStop(0.45, mgl.core);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }
  const unit = PX * scale;
  const side = F.face !== 'front';
  const mirror = F.face === 'left' ? -1 : 1;

  // banana + accessories render to `bctx`: the main canvas normally, or an
  // isolated scratch layer when Safari needs the hue-wash fallback
  const useHueWash = !!o.hue && !CTX_FILTER_OK;
  let layer = null;
  let bctx = ctx;
  if (useHueWash) {
    layer = scratchCv('layer', W);
    bctx = layer.getContext('2d');
    bctx.clearRect(0, 0, W, W);
  }

  bctx.save();
  bctx.filter = o.hue && CTX_FILTER_OK ? `hue-rotate(${o.hue}deg)` : 'none';
  // held items: resolved ONCE per draw — each glove carries at most one item,
  // and the assignment is identical on every surface (see resolveHands)
  const glove = resolveHands(o.extras);
  const drawHeld = (gside, d) => {
    if (!F.hands) return;
    const [hx, hy] = gside === 'left' ? F.hands[0] : F.hands[1];
    const key = SVG[d.art];
    // 🍌 PNG art (the plush) resizes the ORIGINAL crisp — size = manifest `gh`
    // grid-units × the PNG's own aspect, nearest-neighbor so it stays on-model.
    if (key.charAt(0) !== '<') {
      const img = imgFor(key);
      if (!(img.complete && img.naturalWidth)) return;
      const gh2 = (d.gh || 24) * unit;
      const gw2 = gh2 * img.naturalWidth / img.naturalHeight;
      const sm = bctx.imageSmoothingEnabled; bctx.imageSmoothingEnabled = false;
      bctx.drawImage(img, fx + hx * scale - gw2 / 2, fy + hy * scale - (d.grip || 0) * unit, gw2, gh2);
      bctx.imageSmoothingEnabled = sm;
      return;
    }
    const gw2 = gridW(key) * unit, gh2 = gridH(key) * unit;
    drawAcc(bctx, key, fx + hx * scale - gw2 / 2, fy + hy * scale - (d.grip || 0) * unit, gw2, gh2, false);
  };
  // the head accessory (hat). Pulled into a helper so it can draw EITHER on top
  // (normal) or in the BEHIND pass (a `behindFront` hat's brace tucks behind the
  // banana stem on front frames; the cups still overhang the head sides).
  const drawHat = (hatDef) => {
    // hats with a `side` art TURN with the head (DJ headphones' profile view),
    // mirrored on left frames — same front/side rule the shades use. Hats without
    // one keep their single art on every frame (a crown/cap reads fine head-on).
    const turns = side && hatDef.side;
    const key = SVG[turns ? hatDef.side : hatDef.art];
    const hw = gridW(key) * unit, hh = gridH(key) * unit;
    // the side view can want its OWN seat (headphones sit lower on a turned head,
    // so the cup lands over the ear rather than up on the crown)
    const seatUnits = turns && hatDef.sideSeat != null ? hatDef.sideSeat : (hatDef.seat || 0);
    const seat = HAT_OVERLAP + seatUnits;
    const hBottom = fy + F.tipY * scale + seat * unit;
    drawAcc(bctx, key, fx + F.hatCx * scale - hw / 2, hBottom - hh, hw, hh, turns && F.face === 'left');
  };
  const hatDef = HAT_BY_ID[o.hat];
  // a `behindFront` hat draws in the behind pass on FRONT frames only (brace
  // behind the stem); on turned frames it draws on top like any other hat.
  const hatBehind = hatDef && hatDef.behindFront && !side;
  // BEHIND layer: extras flagged `behind: true` draw BEFORE the banana, so the
  // body occludes them (the protest sign riding behind the head; future wings/
  // backpacks). Hand-anchored only — same glove math as the front pass.
  for (const gside of ['left', 'right']) {
    if (glove[gside] && glove[gside].behind) drawHeld(gside, glove[gside]);
  }
  // chest-anchored BEHIND extras (the shark fin): pre-body so the banana
  // occludes them. `sideOnly` items exist only in PROFILE — a back fin has
  // no front-view silhouette. (Round-1 bug: chest+behind fell through BOTH
  // passes — the hand-only behind loop skipped it, the front loop `continue`d.)
  for (const d of EXTRA_DEFS) {
    if (!o.extras[d.id] || !d.behind || d.anchor !== 'chest') continue;
    if (d.sideOnly && !side) continue;
    const key = SVG[d.art];
    const bw = gridW(key) * unit, bh = gridH(key) * unit;
    const bx = fx + F.btCx * scale;
    const by = fy + (F.eyeCy + d.dy * PX) * scale;
    drawAcc(bctx, key, bx - bw / 2, by - bh / 2, bw, bh, F.face === 'left');
  }
  if (hatBehind) drawHat(hatDef); // brace tucks behind the stem
  bctx.imageSmoothingEnabled = false;
  // (frame-boundary bleed is fixed in the ASSET — sheet v7 keeps every
  // frame's outer 2 columns empty, so the sampler has nothing to leak)
  try { bctx.drawImage(sheet, idx * FW, 0, FW, FH, fx, fy, fw, fh); } catch (e) {}
  bctx.imageSmoothingEnabled = true;

  // the hat rides the head/eyes; art switches side/front with the face. No
  // rotation ever — axis-aligned pixels are the authentic look. (behindFront
  // hats on front frames were already drawn in the behind pass above.)
  if (hatDef && !hatBehind) drawHat(hatDef);
  const shadeDef = SHADE_BY_ID[o.glasses];
  if (shadeDef) {
    const key = SVG[side ? shadeDef.side : shadeDef.front];
    const gw = gridW(key) * unit, gh = gridH(key) * unit;
    const gx = fx + F.eyeCx * scale, gy = fy + (F.eyeCy + SH_DY * PX) * scale;
    drawAcc(bctx, key, gx - gw / 2, gy - gh / 2, gw, gh, F.face === 'left');
  }
  let feetDrawn = false; // feet is a single-select slot — never stack two shoes
  for (const d of EXTRA_DEFS) {
    if (!o.extras[d.id]) continue;
    if (d.behind) continue; // already drawn in the behind pass, pre-body
    if (d.anchor === 'feet' && feetDrawn) continue;
    if (d.anchor === 'face') {
      const key = SVG[side ? d.side : d.front];
      const mw = gridW(key) * unit, mh = gridH(key) * unit;
      const mx = fx + F.eyeCx * scale + (side ? mirror * d.sideDx * unit : 0);
      const my = fy + (F.eyeCy + d.dy * PX) * scale;
      drawAcc(bctx, key, mx - mw / 2, my - mh / 2, mw, mh, F.face === 'left');
    } else if (d.anchor === 'hand') { // held items draw AFTER this loop, via the resolved gloves
      continue;
    } else if (d.anchor === 'feet') { // ONE shoe drawn per foot, riding the per-frame centroid so the pair dances
      feetDrawn = true;
      const key = SVG[d.art];
      const fw2 = gridW(key) * unit, fh2 = gridH(key) * unit;
      const fby = fy + FEET_BOTTOM * scale + (d.dy || 0) * unit;
      // CRISP: shoes overlay the sprite's own crisp pixels — smoothing (on for
      // other accessories) softens the edges so they stop landing 1:1 and the
      // shared corners fracture into notches
      const sm = bctx.imageSmoothingEnabled; bctx.imageSmoothingEnabled = false;
      const feetX = F.feetX || [FEET_CX - 71, FEET_CX + 71];
      // the LEFT foot mirrors, so toed footwear (clown shoes, skates) makes a
      // real PAIR facing outward instead of two right shoes (Trym's catch);
      // symmetric art (the sneakers) is unaffected by the flip
      feetX.forEach((cxu, fi) => {
        const fcx = fx + (cxu + (d.dx || 0) * PX) * scale;
        drawAcc(bctx, key, fcx - fw2 / 2, fby - fh2, fw2, fh2, fi === 0);
      });
      bctx.imageSmoothingEnabled = sm;
    } else { // 'chest'
      const key = SVG[d.art];
      const bw = gridW(key) * unit, bh = gridH(key) * unit;
      const bx = fx + F.btCx * scale;
      const by = fy + (F.eyeCy + d.dy * PX) * scale;
      drawAcc(bctx, key, bx - bw / 2, by - bh / 2, bw, bh, false);
    }
  }
  // the resolved gloves — front-layer held items, one per hand, on top of the
  // other accessories (a held thing is always nearest the camera)
  for (const gside of ['left', 'right']) {
    if (glove[gside] && !glove[gside].behind) drawHeld(gside, glove[gside]);
  }
  // 🍌 RUNTIME CUSTOM accessory (the Forge's wearable mode): a user-drawn sprite
  // (raw SVG string via forgeGridToSVG) rendered at a chosen anchor. This is the
  // ONE runtime channel into the catalog's world — everything else is build-time
  // constants. Same anchor math as the built-in accessories. Community sprites
  // are single-view, so on turned-away frames the art MIRRORS like a real
  // object (a gun drawn pointing outward keeps pointing outward when the
  // banana turns) — the built-ins' F.face==='left' flip rule, no creator work.
  // 🧢 ONE OR MANY. A banana wore exactly one community item until 2 Aug,
  // when a visitor wrote in asking to wear three. `custom` now takes an ARRAY
  // as well as a single object — old callers pass one and are untouched.
  // ⚠️ the CALLER enforces one-item-per-spot; the engine just draws what it
  // is handed, in order, so two head items would overlap. That is deliberate:
  // placement rules belong with the loadout, not the renderer.
  const customs = !o.custom ? [] : (Array.isArray(o.custom) ? o.custom : [o.custom]);
  for (const cItem of customs) {
  if (cItem && cItem.art) {
    // WYSIWYG placement: the item's TOP-LEFT sits at (anchor point + the offset
    // captured when it was drawn). The anchor moves per frame → the item rides
    // it. ox/oy are in sprite UNITS (PX-scaled). s scales the sprite to match
    // the size it was drawn at. When mirroring, the offset mirrors AROUND the
    // anchor with the art (so it's still held, not just flipped in place).
    // c.mirror = a future loadout seating the item in the opposite glove —
    // XORs with the frame flip so opposite-hand + turned-frame cancels out.
    const c = cItem, key = c.art, s = c.scale || 1;
    const cw = gridW(key) * unit * s, ch = gridH(key) * unit * s;
    const ap = wearAnchor(idx, c.anchor, c.hand);
    const flip = (F.face === 'left') !== !!c.mirror;
    const px = flip
      ? fx + ap.x * scale - ((c.ox || 0) * unit + cw)
      : fx + ap.x * scale + (c.ox || 0) * unit;
    const py = fy + ap.y * scale + (c.oy || 0) * unit;
    drawAcc(bctx, key, px, py, cw, ch, flip);
  }
  }
  bctx.filter = 'none';
  bctx.restore();

  if (useHueWash) {
    // Safari path: wash the isolated banana layer. The 'hue' blend keeps the
    // sprite's luminosity (shading, white gloves, black outlines) and pushes
    // every pixel toward the target hue ≈ what hue-rotate does to a yellow
    // banana. The blend rect paints the whole layer, so a mask pass restores
    // the layer's own alpha before compositing onto the real canvas.
    const mask = scratchCv('mask', W);
    const mctx = mask.getContext('2d');
    mctx.clearRect(0, 0, W, W);
    mctx.drawImage(layer, 0, 0);
    bctx.globalCompositeOperation = 'hue';
    bctx.fillStyle = `hsl(${(52 + o.hue) % 360}, 100%, 50%)`; // 52 ≈ the banana's own yellow
    bctx.fillRect(0, 0, W, W);
    bctx.globalCompositeOperation = 'destination-in';
    bctx.drawImage(mask, 0, 0);
    bctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, 0, 0);
  }

  // effects in front of the banana (deterministic per frame → GIF loops clean)
  const fxType = o.effect || 'none';
  if (fxType === 'sparkle') drawSparks(ctx, W, idx);
  if (fxType === 'confetti') drawConfetti(ctx, W, idx);

  if (o.captions) { caption(ctx, W, o.top, true); caption(ctx, W, o.bottom, false); }
}
function drawAcc(ctx, key, dx, dy, dw, dh, flip) {
  const img = imgFor(key); if (!(img.complete && img.naturalWidth)) return;
  if (!flip) { ctx.drawImage(img, dx, dy, dw, dh); return; }
  ctx.save();
  ctx.translate(dx + dw / 2, dy + dh / 2);
  ctx.scale(-1, 1);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function drawSparks(ctx, W, idx) {
  const s = Math.max(2, Math.round(W * 0.014));
  SPARKS.forEach((p, k) => {
    const t = (k * 3 + idx) % NFRAMES;
    if (t >= 4) return; // twinkle off
    const big = t < 2;
    const x = Math.round(p.x * W), y = Math.round(p.y * W);
    ctx.fillStyle = k % 2 ? '#f2c200' : '#ffffff';
    ctx.fillRect(x - s / 2, y - s / 2, s, s); // centre
    if (big) {
      ctx.fillRect(x - s / 2, y - s * 1.5, s, s);
      ctx.fillRect(x - s / 2, y + s / 2, s, s);
      ctx.fillRect(x - s * 1.5, y - s / 2, s, s);
      ctx.fillRect(x + s / 2, y - s / 2, s, s);
    }
  });
}
function drawConfetti(ctx, W, idx) {
  const s = Math.max(2, Math.round(W * 0.018));
  CONFETTI.forEach((p, k) => {
    const prog = (p.off + idx / NFRAMES) % 1;
    const y = (0.10 + prog * 0.82) * W;
    const x = p.x * W + ((idx + k) % 2 ? s : -s) / 2;
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(x), Math.round(y), s, ((k % 3) ? s : s * 1.6));
  });
}

function caption(ctx, W, text, top) {
  if (!text) return;
  let fs = Math.round(W * 0.095);
  // Anton (self-hosted, /fonts) FIRST so the baked-into-GIF caption is identical
  // on every OS. Impact/Arial Black are system fallbacks (Anton is 400-only — no
  // 900 weight, else the browser faux-bolds it). See fonts.css.
  const font = (s) => s + 'px "Anton", Impact, "Arial Black", "Franklin Gothic Bold", sans-serif';
  ctx.font = font(fs);
  while (ctx.measureText(text.toUpperCase()).width > W * 0.92 && fs > 14) { fs -= 2; ctx.font = font(fs); }
  ctx.textAlign = 'center'; ctx.textBaseline = top ? 'top' : 'bottom';
  ctx.lineWidth = fs * 0.29; ctx.strokeStyle = '#111'; ctx.fillStyle = '#fff'; ctx.lineJoin = 'round';
  const y = top ? W * 0.035 : W * 0.965;
  ctx.strokeText(text.toUpperCase(), W / 2, y); ctx.fillText(text.toUpperCase(), W / 2, y);
}

export {
  SHEET_SRC, FW, FH, NFRAMES, BASE_CYCLE_S, FRAMES, SVG, EFFECTS,
  PACKS, isPackActive, ACTIVE_PACKS, HAT_DEFS, SHADE_DEFS, EXTRA_DEFS,
  HAT_BY_ID, SHADE_BY_ID, HATS, GLASSES,
  PX, gridW, gridH, HAT_OVERLAP, SH_DY, FRAME_H_FRAC, FRAME_TOP_FRAC,
  SPARKS, CONFETTI,
  sheet, imgFor, assetsReady, artReady, drawComposite, drawAcc, drawSparks, drawConfetti, caption,
  resolveHands, outfitParams,
};
