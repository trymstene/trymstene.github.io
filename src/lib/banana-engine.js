// Banana render engine — THE one render path, shared by the builder, the
// overlay, the rave and anything else that needs to draw dancing bananas.
// Extracted from banana-builder.js (4 Jul 2026) so N bananas can render from
// one code path: drawComposite takes the FULL outfit in `o` instead of
// closing over a single page-global state.
//   o: { hat, glasses, extras, top, bottom, bg, captions, hue, effect }
// CLIENT-ONLY module (creates Image objects at import) — never import from
// Astro frontmatter; that is what src/lib/banana-daily.js is for.

// ---- authentic dance frames ----
// ?v= busts stale browser caches: bump it whenever the sheet's pixels change,
// or old cached copies (e.g. the pre-fix sheet with white-filled arm gaps)
// keep haunting returning visitors' previews and exports.
const SHEET_SRC = '/assets/banana-dance.png?v=6'; // v6 = rebuilt from Trym's 2000px remasters (tools/build-banana-assets.py)
const FW = 469, FH = 498, NFRAMES = 8;
const BASE_CYCLE_S = 0.8; // 8 frames x 100ms = the original GIF timing

// Per-frame anchors measured from the sprite pixels (Pillow-verified):
// eye centre (glasses), tip Y + head centre AT BRIM DEPTH (hat — the stem curves
// toward the body going down, so the hat anchor must be measured at the depth
// where the hat actually sits, per frame; this keeps the hat riding the head
// smoothly through the dance), and which way the face points.
// hands = the two white-glove centres [left, right] in screen space, measured by
// tools/find-hand-anchors.py — HELD items (anchor: 'hand') ride these. Both arms
// pump together in this dance (down 362 → up 135), so a held item pumps with the beat.
const FRAMES = [
  { eyeCx: 232, eyeCy: 222, hatCx: 272, btCx: 268, tipY: 85, face: 'right', hands: [[145, 362], [380, 362]] },
  { eyeCx: 232, eyeCy: 192, hatCx: 272, btCx: 270, tipY: 57, face: 'right', hands: [[116, 334], [409, 334]] },
  { eyeCx: 234, eyeCy: 135, hatCx: 248, btCx: 248, tipY: 0,  face: 'front', hands: [[45, 135], [437, 135]] },
  { eyeCx: 232, eyeCy: 156, hatCx: 206, btCx: 206, tipY: 28, face: 'front', hands: [[45, 206], [366, 206]] },
  { eyeCx: 236, eyeCy: 222, hatCx: 196, btCx: 200, tipY: 85, face: 'left',  hands: [[88, 362], [323, 362]] },
  { eyeCx: 236, eyeCy: 192, hatCx: 196, btCx: 198, tipY: 57, face: 'left',  hands: [[59, 334], [352, 334]] },
  { eyeCx: 234, eyeCy: 135, hatCx: 220, btCx: 220, tipY: 0,  face: 'front', hands: [[31, 135], [423, 135]] },
  { eyeCx: 237, eyeCy: 156, hatCx: 262, btCx: 262, tipY: 28, face: 'front', hands: [[102, 206], [423, 206]] },
];

// ---- accessory art: hand-authored PIXEL SVGs on the banana's own 13px grid ----
// Authored as ASCII pixel maps in tools/pixel-assets.py (Pillow-verified against
// the real frames) and emitted as crispEdges rect-grids. Coloured hats carry an
// auto-generated 1-unit black outline so they stay visible on any background.
const SVG = {
  shadesFront: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 50" width="150" height="50" shape-rendering="crispEdges"><rect x="0" y="0" width="150" height="10" fill="#111111"/><rect x="10" y="10" width="10" height="10" fill="#111111"/><rect x="20" y="10" width="20" height="10" fill="#ffffff"/><rect x="40" y="10" width="30" height="10" fill="#111111"/><rect x="80" y="10" width="10" height="10" fill="#111111"/><rect x="90" y="10" width="20" height="10" fill="#ffffff"/><rect x="110" y="10" width="30" height="10" fill="#111111"/><rect x="10" y="20" width="60" height="10" fill="#111111"/><rect x="80" y="20" width="60" height="10" fill="#111111"/><rect x="10" y="30" width="60" height="10" fill="#111111"/><rect x="80" y="30" width="60" height="10" fill="#111111"/><rect x="20" y="40" width="40" height="10" fill="#111111"/><rect x="90" y="40" width="40" height="10" fill="#111111"/></svg>',
  shadesSide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 50" width="130" height="50" shape-rendering="crispEdges"><rect x="0" y="0" width="130" height="10" fill="#111111"/><rect x="0" y="10" width="10" height="10" fill="#111111"/><rect x="10" y="10" width="20" height="10" fill="#ffffff"/><rect x="30" y="10" width="50" height="10" fill="#111111"/><rect x="0" y="20" width="80" height="10" fill="#111111"/><rect x="0" y="30" width="80" height="10" fill="#111111"/><rect x="10" y="40" width="60" height="10" fill="#111111"/></svg>',
  tophat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80" shape-rendering="crispEdges"><rect x="20" y="0" width="80" height="10" fill="#111111"/><rect x="20" y="10" width="10" height="10" fill="#111111"/><rect x="30" y="10" width="10" height="10" fill="#484848"/><rect x="40" y="10" width="60" height="10" fill="#111111"/><rect x="20" y="20" width="10" height="10" fill="#111111"/><rect x="30" y="20" width="10" height="10" fill="#484848"/><rect x="40" y="20" width="60" height="10" fill="#111111"/><rect x="20" y="30" width="10" height="10" fill="#111111"/><rect x="30" y="30" width="10" height="10" fill="#484848"/><rect x="40" y="30" width="60" height="10" fill="#111111"/><rect x="20" y="40" width="10" height="10" fill="#111111"/><rect x="30" y="40" width="60" height="10" fill="#e22020"/><rect x="90" y="40" width="10" height="10" fill="#111111"/><rect x="20" y="50" width="80" height="10" fill="#111111"/><rect x="0" y="60" width="120" height="10" fill="#111111"/><rect x="0" y="70" width="120" height="10" fill="#111111"/></svg>',
  crown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 80" width="130" height="80" shape-rendering="crispEdges"><rect x="10" y="0" width="10" height="10" fill="#111111"/><rect x="60" y="0" width="10" height="10" fill="#111111"/><rect x="110" y="0" width="10" height="10" fill="#111111"/><rect x="0" y="10" width="10" height="10" fill="#111111"/><rect x="10" y="10" width="10" height="10" fill="#f2c200"/><rect x="20" y="10" width="10" height="10" fill="#111111"/><rect x="50" y="10" width="10" height="10" fill="#111111"/><rect x="60" y="10" width="10" height="10" fill="#f2c200"/><rect x="70" y="10" width="10" height="10" fill="#111111"/><rect x="100" y="10" width="10" height="10" fill="#111111"/><rect x="110" y="10" width="10" height="10" fill="#f2c200"/><rect x="120" y="10" width="10" height="10" fill="#111111"/><rect x="0" y="20" width="10" height="10" fill="#111111"/><rect x="10" y="20" width="20" height="10" fill="#f2c200"/><rect x="30" y="20" width="20" height="10" fill="#111111"/><rect x="50" y="20" width="30" height="10" fill="#f2c200"/><rect x="80" y="20" width="20" height="10" fill="#111111"/><rect x="100" y="20" width="20" height="10" fill="#f2c200"/><rect x="120" y="20" width="10" height="10" fill="#111111"/><rect x="0" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="30" width="30" height="10" fill="#f2c200"/><rect x="40" y="30" width="10" height="10" fill="#111111"/><rect x="50" y="30" width="30" height="10" fill="#f2c200"/><rect x="80" y="30" width="10" height="10" fill="#111111"/><rect x="90" y="30" width="30" height="10" fill="#f2c200"/><rect x="120" y="30" width="10" height="10" fill="#111111"/><rect x="0" y="40" width="10" height="10" fill="#111111"/><rect x="10" y="40" width="50" height="10" fill="#f2c200"/><rect x="60" y="40" width="10" height="10" fill="#e22020"/><rect x="70" y="40" width="50" height="10" fill="#f2c200"/><rect x="120" y="40" width="10" height="10" fill="#111111"/><rect x="0" y="50" width="10" height="10" fill="#111111"/><rect x="10" y="50" width="110" height="10" fill="#f2c200"/><rect x="120" y="50" width="10" height="10" fill="#111111"/><rect x="0" y="60" width="10" height="10" fill="#111111"/><rect x="10" y="60" width="110" height="10" fill="#c49a00"/><rect x="120" y="60" width="10" height="10" fill="#111111"/><rect x="10" y="70" width="110" height="10" fill="#111111"/></svg>',
  party: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" shape-rendering="crispEdges"><rect x="50" y="0" width="20" height="10" fill="#111111"/><rect x="40" y="10" width="10" height="10" fill="#111111"/><rect x="50" y="10" width="20" height="10" fill="#f2c200"/><rect x="70" y="10" width="10" height="10" fill="#111111"/><rect x="30" y="20" width="10" height="10" fill="#111111"/><rect x="40" y="20" width="40" height="10" fill="#f2c200"/><rect x="80" y="20" width="10" height="10" fill="#111111"/><rect x="40" y="30" width="10" height="10" fill="#111111"/><rect x="50" y="30" width="20" height="10" fill="#4db8ff"/><rect x="70" y="30" width="10" height="10" fill="#111111"/><rect x="30" y="40" width="10" height="10" fill="#111111"/><rect x="40" y="40" width="40" height="10" fill="#4db8ff"/><rect x="80" y="40" width="10" height="10" fill="#111111"/><rect x="30" y="50" width="10" height="10" fill="#111111"/><rect x="40" y="50" width="10" height="10" fill="#4db8ff"/><rect x="50" y="50" width="10" height="10" fill="#ffffff"/><rect x="60" y="50" width="20" height="10" fill="#4db8ff"/><rect x="80" y="50" width="10" height="10" fill="#111111"/><rect x="20" y="60" width="10" height="10" fill="#111111"/><rect x="30" y="60" width="60" height="10" fill="#4db8ff"/><rect x="90" y="60" width="10" height="10" fill="#111111"/><rect x="20" y="70" width="10" height="10" fill="#111111"/><rect x="30" y="70" width="20" height="10" fill="#4db8ff"/><rect x="50" y="70" width="10" height="10" fill="#ffffff"/><rect x="60" y="70" width="30" height="10" fill="#4db8ff"/><rect x="90" y="70" width="10" height="10" fill="#111111"/><rect x="10" y="80" width="10" height="10" fill="#111111"/><rect x="20" y="80" width="60" height="10" fill="#4db8ff"/><rect x="80" y="80" width="10" height="10" fill="#ffffff"/><rect x="90" y="80" width="10" height="10" fill="#4db8ff"/><rect x="100" y="80" width="10" height="10" fill="#111111"/><rect x="10" y="90" width="10" height="10" fill="#111111"/><rect x="20" y="90" width="80" height="10" fill="#4db8ff"/><rect x="100" y="90" width="10" height="10" fill="#111111"/><rect x="0" y="100" width="10" height="10" fill="#111111"/><rect x="10" y="100" width="100" height="10" fill="#4db8ff"/><rect x="110" y="100" width="10" height="10" fill="#111111"/><rect x="10" y="110" width="100" height="10" fill="#111111"/></svg>',
  cowboy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" width="160" height="90" shape-rendering="crispEdges"><rect x="60" y="0" width="40" height="10" fill="#111111"/><rect x="50" y="10" width="10" height="10" fill="#111111"/><rect x="60" y="10" width="40" height="10" fill="#8a5a2b"/><rect x="100" y="10" width="10" height="10" fill="#111111"/><rect x="40" y="20" width="10" height="10" fill="#111111"/><rect x="50" y="20" width="60" height="10" fill="#8a5a2b"/><rect x="110" y="20" width="10" height="10" fill="#111111"/><rect x="40" y="30" width="10" height="10" fill="#111111"/><rect x="50" y="30" width="60" height="10" fill="#8a5a2b"/><rect x="110" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="40" width="20" height="10" fill="#111111"/><rect x="40" y="40" width="10" height="10" fill="#111111"/><rect x="50" y="40" width="60" height="10" fill="#5a3618"/><rect x="110" y="40" width="10" height="10" fill="#111111"/><rect x="130" y="40" width="20" height="10" fill="#111111"/><rect x="0" y="50" width="10" height="10" fill="#111111"/><rect x="10" y="50" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="50" width="20" height="10" fill="#111111"/><rect x="50" y="50" width="60" height="10" fill="#8a5a2b"/><rect x="110" y="50" width="20" height="10" fill="#111111"/><rect x="130" y="50" width="20" height="10" fill="#8a5a2b"/><rect x="150" y="50" width="10" height="10" fill="#111111"/><rect x="10" y="60" width="10" height="10" fill="#111111"/><rect x="20" y="60" width="120" height="10" fill="#8a5a2b"/><rect x="140" y="60" width="10" height="10" fill="#111111"/><rect x="20" y="70" width="10" height="10" fill="#111111"/><rect x="30" y="70" width="100" height="10" fill="#8a5a2b"/><rect x="130" y="70" width="10" height="10" fill="#111111"/><rect x="30" y="80" width="100" height="10" fill="#111111"/></svg>',
  heartsFront: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 60" width="130" height="60" shape-rendering="crispEdges"><rect x="10" y="0" width="20" height="10" fill="#111111"/><rect x="40" y="0" width="20" height="10" fill="#111111"/><rect x="70" y="0" width="20" height="10" fill="#111111"/><rect x="100" y="0" width="20" height="10" fill="#111111"/><rect x="0" y="10" width="10" height="10" fill="#111111"/><rect x="10" y="10" width="20" height="10" fill="#ff4d6d"/><rect x="30" y="10" width="10" height="10" fill="#111111"/><rect x="40" y="10" width="20" height="10" fill="#ff4d6d"/><rect x="60" y="10" width="10" height="10" fill="#111111"/><rect x="70" y="10" width="20" height="10" fill="#ff4d6d"/><rect x="90" y="10" width="10" height="10" fill="#111111"/><rect x="100" y="10" width="20" height="10" fill="#ff4d6d"/><rect x="120" y="10" width="10" height="10" fill="#111111"/><rect x="0" y="20" width="10" height="10" fill="#111111"/><rect x="10" y="20" width="10" height="10" fill="#ff4d6d"/><rect x="20" y="20" width="10" height="10" fill="#ffffff"/><rect x="30" y="20" width="60" height="10" fill="#ff4d6d"/><rect x="90" y="20" width="10" height="10" fill="#ffffff"/><rect x="100" y="20" width="20" height="10" fill="#ff4d6d"/><rect x="120" y="20" width="10" height="10" fill="#111111"/><rect x="10" y="30" width="10" height="10" fill="#111111"/><rect x="20" y="30" width="30" height="10" fill="#ff4d6d"/><rect x="50" y="30" width="30" height="10" fill="#111111"/><rect x="80" y="30" width="30" height="10" fill="#ff4d6d"/><rect x="110" y="30" width="10" height="10" fill="#111111"/><rect x="20" y="40" width="10" height="10" fill="#111111"/><rect x="30" y="40" width="10" height="10" fill="#ff4d6d"/><rect x="40" y="40" width="10" height="10" fill="#111111"/><rect x="80" y="40" width="10" height="10" fill="#111111"/><rect x="90" y="40" width="10" height="10" fill="#ff4d6d"/><rect x="100" y="40" width="10" height="10" fill="#111111"/><rect x="30" y="50" width="10" height="10" fill="#111111"/><rect x="90" y="50" width="10" height="10" fill="#111111"/></svg>',
  heartsSide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 80" width="130" height="80" shape-rendering="crispEdges"><rect x="10" y="0" width="30" height="10" fill="#111111"/><rect x="50" y="0" width="30" height="10" fill="#111111"/><rect x="0" y="10" width="10" height="10" fill="#111111"/><rect x="10" y="10" width="30" height="10" fill="#ff4d6d"/><rect x="40" y="10" width="10" height="10" fill="#111111"/><rect x="50" y="10" width="30" height="10" fill="#ff4d6d"/><rect x="80" y="10" width="40" height="10" fill="#111111"/><rect x="0" y="20" width="10" height="10" fill="#111111"/><rect x="10" y="20" width="10" height="10" fill="#ff4d6d"/><rect x="20" y="20" width="10" height="10" fill="#ffffff"/><rect x="30" y="20" width="90" height="10" fill="#ff4d6d"/><rect x="120" y="20" width="10" height="10" fill="#111111"/><rect x="0" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="30" width="70" height="10" fill="#ff4d6d"/><rect x="80" y="30" width="40" height="10" fill="#111111"/><rect x="10" y="40" width="10" height="10" fill="#111111"/><rect x="20" y="40" width="50" height="10" fill="#ff4d6d"/><rect x="70" y="40" width="10" height="10" fill="#111111"/><rect x="20" y="50" width="10" height="10" fill="#111111"/><rect x="30" y="50" width="30" height="10" fill="#ff4d6d"/><rect x="60" y="50" width="10" height="10" fill="#111111"/><rect x="30" y="60" width="10" height="10" fill="#111111"/><rect x="40" y="60" width="10" height="10" fill="#ff4d6d"/><rect x="50" y="60" width="10" height="10" fill="#111111"/><rect x="40" y="70" width="10" height="10" fill="#111111"/></svg>',
  visorFront: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 50" width="150" height="50" shape-rendering="crispEdges"><rect x="10" y="0" width="130" height="10" fill="#111111"/><rect x="0" y="10" width="10" height="10" fill="#111111"/><rect x="10" y="10" width="130" height="10" fill="#4db8ff"/><rect x="140" y="10" width="10" height="10" fill="#111111"/><rect x="0" y="20" width="10" height="10" fill="#111111"/><rect x="10" y="20" width="10" height="10" fill="#4db8ff"/><rect x="20" y="20" width="20" height="10" fill="#ffffff"/><rect x="40" y="20" width="100" height="10" fill="#4db8ff"/><rect x="140" y="20" width="10" height="10" fill="#111111"/><rect x="0" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="30" width="130" height="10" fill="#4db8ff"/><rect x="140" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="40" width="130" height="10" fill="#111111"/></svg>',
  visorSide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 50" width="110" height="50" shape-rendering="crispEdges"><rect x="10" y="0" width="90" height="10" fill="#111111"/><rect x="0" y="10" width="10" height="10" fill="#111111"/><rect x="10" y="10" width="90" height="10" fill="#4db8ff"/><rect x="100" y="10" width="10" height="10" fill="#111111"/><rect x="0" y="20" width="10" height="10" fill="#111111"/><rect x="10" y="20" width="10" height="10" fill="#4db8ff"/><rect x="20" y="20" width="20" height="10" fill="#ffffff"/><rect x="40" y="20" width="60" height="10" fill="#4db8ff"/><rect x="100" y="20" width="10" height="10" fill="#111111"/><rect x="0" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="30" width="90" height="10" fill="#4db8ff"/><rect x="100" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="40" width="90" height="10" fill="#111111"/></svg>',
  mustacheFront: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 30" width="130" height="30" shape-rendering="crispEdges"><rect x="0" y="0" width="10" height="10" fill="#5a3618"/><rect x="120" y="0" width="10" height="10" fill="#5a3618"/><rect x="0" y="10" width="20" height="10" fill="#5a3618"/><rect x="110" y="10" width="20" height="10" fill="#5a3618"/><rect x="10" y="20" width="50" height="10" fill="#5a3618"/><rect x="70" y="20" width="50" height="10" fill="#5a3618"/></svg>',
  mustacheSide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 30" width="70" height="30" shape-rendering="crispEdges"><rect x="0" y="0" width="10" height="10" fill="#5a3618"/><rect x="0" y="10" width="20" height="10" fill="#5a3618"/><rect x="10" y="20" width="60" height="10" fill="#5a3618"/></svg>',
  bowtie: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 50" width="90" height="50" shape-rendering="crispEdges"><rect x="10" y="0" width="20" height="10" fill="#111111"/><rect x="60" y="0" width="20" height="10" fill="#111111"/><rect x="0" y="10" width="10" height="10" fill="#111111"/><rect x="10" y="10" width="10" height="10" fill="#4db8ff"/><rect x="20" y="10" width="10" height="10" fill="#ffffff"/><rect x="30" y="10" width="30" height="10" fill="#111111"/><rect x="60" y="10" width="10" height="10" fill="#ffffff"/><rect x="70" y="10" width="10" height="10" fill="#4db8ff"/><rect x="80" y="10" width="10" height="10" fill="#111111"/><rect x="0" y="20" width="10" height="10" fill="#111111"/><rect x="10" y="20" width="30" height="10" fill="#4db8ff"/><rect x="40" y="20" width="10" height="10" fill="#5a3618"/><rect x="50" y="20" width="30" height="10" fill="#4db8ff"/><rect x="80" y="20" width="10" height="10" fill="#111111"/><rect x="0" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="30" width="20" height="10" fill="#4db8ff"/><rect x="30" y="30" width="30" height="10" fill="#111111"/><rect x="60" y="30" width="20" height="10" fill="#4db8ff"/><rect x="80" y="30" width="10" height="10" fill="#111111"/><rect x="10" y="40" width="20" height="10" fill="#111111"/><rect x="60" y="40" width="20" height="10" fill="#111111"/></svg>',
  // happy-hour prize at the rave: a pixel beer for the left glove. Server-granted
  // only (the worker strips it from client outfits and re-applies for holders).
  // the stolen traffic cone — every club ends up with one. Rave-only fx
  // costume (worn while the 'cone' effect runs, injected at draw time)
  cone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" shape-rendering="crispEdges"><rect x="50" y="0" width="20" height="10" fill="#1e182c"/><rect x="40" y="10" width="10" height="10" fill="#1e182c"/><rect x="50" y="10" width="20" height="10" fill="#ff8c28"/><rect x="70" y="10" width="10" height="10" fill="#1e182c"/><rect x="40" y="20" width="10" height="10" fill="#1e182c"/><rect x="50" y="20" width="10" height="10" fill="#ff8c28"/><rect x="60" y="20" width="10" height="10" fill="#c85f10"/><rect x="70" y="20" width="10" height="10" fill="#1e182c"/><rect x="30" y="30" width="10" height="10" fill="#1e182c"/><rect x="40" y="30" width="20" height="10" fill="#ff8c28"/><rect x="60" y="30" width="10" height="10" fill="#c85f10"/><rect x="70" y="30" width="10" height="10" fill="#1e182c"/><rect x="30" y="40" width="10" height="10" fill="#1e182c"/><rect x="40" y="40" width="40" height="10" fill="#fffdf5"/><rect x="80" y="40" width="10" height="10" fill="#1e182c"/><rect x="20" y="50" width="10" height="10" fill="#1e182c"/><rect x="30" y="50" width="50" height="10" fill="#fffdf5"/><rect x="80" y="50" width="10" height="10" fill="#1e182c"/><rect x="20" y="60" width="10" height="10" fill="#1e182c"/><rect x="30" y="60" width="30" height="10" fill="#ff8c28"/><rect x="60" y="60" width="20" height="10" fill="#c85f10"/><rect x="80" y="60" width="10" height="10" fill="#1e182c"/><rect x="10" y="70" width="10" height="10" fill="#1e182c"/><rect x="20" y="70" width="40" height="10" fill="#ff8c28"/><rect x="60" y="70" width="20" height="10" fill="#c85f10"/><rect x="80" y="70" width="10" height="10" fill="#1e182c"/><rect x="10" y="80" width="10" height="10" fill="#1e182c"/><rect x="20" y="80" width="40" height="10" fill="#ff8c28"/><rect x="60" y="80" width="30" height="10" fill="#c85f10"/><rect x="90" y="80" width="10" height="10" fill="#1e182c"/><rect x="0" y="90" width="110" height="10" fill="#1e182c"/><rect x="0" y="100" width="10" height="10" fill="#1e182c"/><rect x="10" y="100" width="90" height="10" fill="#c85f10"/><rect x="100" y="100" width="10" height="10" fill="#1e182c"/><rect x="10" y="110" width="90" height="10" fill="#1e182c"/></svg>',
  beer: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 60" width="50" height="60" shape-rendering="crispEdges"><rect x="10" y="0" width="30" height="10" fill="#fffdf5"/><rect x="0" y="10" width="10" height="40" fill="#111111"/><rect x="10" y="10" width="30" height="10" fill="#fffdf5"/><rect x="40" y="10" width="10" height="40" fill="#111111"/><rect x="10" y="20" width="30" height="30" fill="#f2c200"/><rect x="15" y="25" width="7" height="20" fill="#ffe135"/><rect x="10" y="50" width="30" height="10" fill="#111111"/></svg>',
  // the rave souvenir: a neon glowstick, held in the glove (anchor: hand). The
  // pixel halo (low-opacity flanks) is the glow — crispEdges, no blur, engine style.
  glowstick: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 100" width="70" height="100" shape-rendering="crispEdges"><rect x="10" y="10" width="10" height="60" fill="#39ff14" opacity="0.2"/><rect x="50" y="10" width="10" height="60" fill="#39ff14" opacity="0.2"/><rect x="20" y="0" width="10" height="70" fill="#39ff14" opacity="0.4"/><rect x="40" y="0" width="10" height="70" fill="#39ff14" opacity="0.4"/><rect x="30" y="0" width="10" height="10" fill="#eaffe0"/><rect x="30" y="10" width="10" height="70" fill="#39ff14"/><rect x="30" y="80" width="10" height="10" fill="#111111"/></svg>',
  // the golden banana TROPHY: catch it on the floor (patch `golden`) and hold
  // it forever — same 12×12 art as the floor sprite minus the corner sparkles
  // (they read as floating dots in a hand)
  goldbanana: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 140" width="80" height="140" shape-rendering="crispEdges"><rect x="40" y="0" width="10" height="10" fill="#5a3618"/><rect x="40" y="10" width="10" height="10" fill="#5a3618"/><rect x="40" y="20" width="20" height="10" fill="#5a3618"/><rect x="30" y="30" width="10" height="10" fill="#d69a1e"/><rect x="40" y="30" width="20" height="10" fill="#ffe135"/><rect x="60" y="30" width="10" height="10" fill="#d69a1e"/><rect x="30" y="40" width="10" height="10" fill="#d69a1e"/><rect x="40" y="40" width="10" height="10" fill="#f0f0fa"/><rect x="50" y="40" width="10" height="10" fill="#ffe135"/><rect x="60" y="40" width="10" height="10" fill="#d69a1e"/><rect x="20" y="50" width="10" height="10" fill="#d69a1e"/><rect x="30" y="50" width="10" height="10" fill="#f0f0fa"/><rect x="40" y="50" width="20" height="10" fill="#ffe135"/><rect x="60" y="50" width="10" height="10" fill="#d69a1e"/><rect x="20" y="60" width="10" height="10" fill="#d69a1e"/><rect x="30" y="60" width="30" height="10" fill="#ffe135"/><rect x="60" y="60" width="10" height="10" fill="#d69a1e"/><rect x="20" y="70" width="10" height="10" fill="#d69a1e"/><rect x="30" y="70" width="30" height="10" fill="#ffe135"/><rect x="60" y="70" width="10" height="10" fill="#d69a1e"/><rect x="20" y="80" width="10" height="10" fill="#d69a1e"/><rect x="30" y="80" width="30" height="10" fill="#ffe135"/><rect x="60" y="80" width="10" height="10" fill="#d69a1e"/><rect x="20" y="90" width="10" height="10" fill="#d69a1e"/><rect x="30" y="90" width="30" height="10" fill="#ffe135"/><rect x="60" y="90" width="10" height="10" fill="#d69a1e"/><rect x="20" y="100" width="10" height="10" fill="#d69a1e"/><rect x="30" y="100" width="30" height="10" fill="#ffe135"/><rect x="60" y="100" width="10" height="10" fill="#d69a1e"/><rect x="10" y="110" width="10" height="10" fill="#d69a1e"/><rect x="20" y="110" width="30" height="10" fill="#ffe135"/><rect x="50" y="110" width="10" height="10" fill="#d69a1e"/><rect x="10" y="120" width="10" height="10" fill="#d69a1e"/><rect x="20" y="120" width="20" height="10" fill="#ffe135"/><rect x="40" y="120" width="10" height="10" fill="#d69a1e"/><rect x="20" y="130" width="20" height="10" fill="#5a3618"/></svg>',
  // Barty's broom: the nightshift tool — handle in the glove, brush at the floor
  broom: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 220" width="80" height="220" shape-rendering="crispEdges"><rect x="30" y="0" width="20" height="10" fill="#5a3618"/><rect x="30" y="10" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="20" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="30" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="40" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="50" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="60" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="70" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="80" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="90" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="100" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="110" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="120" width="20" height="10" fill="#8a5a2b"/><rect x="30" y="130" width="20" height="10" fill="#8a5a2b"/><rect x="20" y="140" width="10" height="10" fill="#111111"/><rect x="30" y="140" width="20" height="10" fill="#8a5a2b"/><rect x="50" y="140" width="10" height="10" fill="#111111"/><rect x="20" y="150" width="10" height="10" fill="#111111"/><rect x="30" y="150" width="20" height="10" fill="#ffd650"/><rect x="50" y="150" width="10" height="10" fill="#111111"/><rect x="10" y="160" width="10" height="10" fill="#111111"/><rect x="20" y="160" width="40" height="10" fill="#ffd650"/><rect x="60" y="160" width="10" height="10" fill="#111111"/><rect x="10" y="170" width="10" height="10" fill="#111111"/><rect x="20" y="170" width="20" height="10" fill="#ffd650"/><rect x="40" y="170" width="10" height="10" fill="#d6a024"/><rect x="50" y="170" width="10" height="10" fill="#ffd650"/><rect x="60" y="170" width="10" height="10" fill="#111111"/><rect x="0" y="180" width="10" height="10" fill="#111111"/><rect x="10" y="180" width="20" height="10" fill="#ffd650"/><rect x="30" y="180" width="10" height="10" fill="#d6a024"/><rect x="40" y="180" width="30" height="10" fill="#ffd650"/><rect x="70" y="180" width="10" height="10" fill="#111111"/><rect x="0" y="190" width="10" height="10" fill="#111111"/><rect x="10" y="190" width="10" height="10" fill="#ffd650"/><rect x="20" y="190" width="10" height="10" fill="#d6a024"/><rect x="30" y="190" width="20" height="10" fill="#ffd650"/><rect x="50" y="190" width="10" height="10" fill="#d6a024"/><rect x="60" y="190" width="10" height="10" fill="#ffd650"/><rect x="70" y="190" width="10" height="10" fill="#111111"/><rect x="0" y="200" width="10" height="10" fill="#111111"/><rect x="10" y="200" width="30" height="10" fill="#ffd650"/><rect x="40" y="200" width="10" height="10" fill="#d6a024"/><rect x="50" y="200" width="20" height="10" fill="#ffd650"/><rect x="70" y="200" width="10" height="10" fill="#111111"/><rect x="10" y="210" width="60" height="10" fill="#111111"/></svg>',
  // the lost record, carried in the glove while the courier runs it to the DJ
  // (same 12×12 art as the floor sprite, engine ×10 units)
  vinyl: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" shape-rendering="crispEdges"><rect x="30" y="0" width="60" height="10" fill="#52526a"/><rect x="20" y="10" width="10" height="10" fill="#52526a"/><rect x="30" y="10" width="60" height="10" fill="#101016"/><rect x="90" y="10" width="10" height="10" fill="#52526a"/><rect x="10" y="20" width="10" height="10" fill="#52526a"/><rect x="20" y="20" width="10" height="10" fill="#101016"/><rect x="30" y="20" width="20" height="10" fill="#f0f0fa"/><rect x="50" y="20" width="50" height="10" fill="#101016"/><rect x="100" y="20" width="10" height="10" fill="#52526a"/><rect x="10" y="30" width="10" height="10" fill="#52526a"/><rect x="20" y="30" width="20" height="10" fill="#f0f0fa"/><rect x="40" y="30" width="60" height="10" fill="#101016"/><rect x="100" y="30" width="10" height="10" fill="#52526a"/><rect x="0" y="40" width="10" height="10" fill="#52526a"/><rect x="10" y="40" width="10" height="10" fill="#101016"/><rect x="20" y="40" width="10" height="10" fill="#f0f0fa"/><rect x="30" y="40" width="20" height="10" fill="#101016"/><rect x="50" y="40" width="20" height="10" fill="#ff4d9d"/><rect x="70" y="40" width="30" height="10" fill="#101016"/><rect x="100" y="40" width="10" height="10" fill="#787894"/><rect x="110" y="40" width="10" height="10" fill="#52526a"/><rect x="0" y="50" width="10" height="10" fill="#52526a"/><rect x="10" y="50" width="30" height="10" fill="#101016"/><rect x="40" y="50" width="10" height="10" fill="#ff4d9d"/><rect x="50" y="50" width="20" height="10" fill="#ffe135"/><rect x="70" y="50" width="10" height="10" fill="#c62c74"/><rect x="80" y="50" width="20" height="10" fill="#101016"/><rect x="100" y="50" width="10" height="10" fill="#787894"/><rect x="110" y="50" width="10" height="10" fill="#52526a"/><rect x="0" y="60" width="10" height="10" fill="#52526a"/><rect x="10" y="60" width="30" height="10" fill="#101016"/><rect x="40" y="60" width="10" height="10" fill="#ff4d9d"/><rect x="50" y="60" width="20" height="10" fill="#ffe135"/><rect x="70" y="60" width="10" height="10" fill="#c62c74"/><rect x="80" y="60" width="20" height="10" fill="#101016"/><rect x="100" y="60" width="10" height="10" fill="#787894"/><rect x="110" y="60" width="10" height="10" fill="#52526a"/><rect x="0" y="70" width="10" height="10" fill="#52526a"/><rect x="10" y="70" width="40" height="10" fill="#101016"/><rect x="50" y="70" width="20" height="10" fill="#c62c74"/><rect x="70" y="70" width="30" height="10" fill="#101016"/><rect x="100" y="70" width="10" height="10" fill="#787894"/><rect x="110" y="70" width="10" height="10" fill="#52526a"/><rect x="10" y="80" width="10" height="10" fill="#52526a"/><rect x="20" y="80" width="60" height="10" fill="#101016"/><rect x="80" y="80" width="20" height="10" fill="#787894"/><rect x="100" y="80" width="10" height="10" fill="#52526a"/><rect x="10" y="90" width="10" height="10" fill="#52526a"/><rect x="20" y="90" width="80" height="10" fill="#101016"/><rect x="100" y="90" width="10" height="10" fill="#52526a"/><rect x="20" y="100" width="10" height="10" fill="#52526a"/><rect x="30" y="100" width="60" height="10" fill="#101016"/><rect x="90" y="100" width="10" height="10" fill="#52526a"/><rect x="30" y="110" width="60" height="10" fill="#52526a"/></svg>',
};

const EFFECTS = [['none','None'],['disco','Disco'],['sparkle','Sparkles'],['confetti','Confetti']];

// ---- ASSET PACKS ----
// Every wearable lives in a pack. 'core' is always on; a themed pack (e.g. a
// Christmas set) declares a month-day window and auto-activates in that range —
// no admin panel needed. Any pack can be force-enabled with ?pack=<id> for
// testing. To add a pack: author the art as ASCII maps in tools/pixel-assets.py,
// verify + emit with --svg, paste the SVGs into the SVG dict above, and declare
// the pack here. Chips, randomizer, URL state and rendering all derive from
// this registry — no other code changes needed.
const PACKS = {
  core: {
    label: 'The classics',
    always: true,
    hats: [
      { id: 'party',  label: 'Party',   art: 'party',  seat: -1 },
      { id: 'crown',  label: 'Crown',   art: 'crown',  seat: -1 },
      { id: 'tophat', label: 'Top hat', art: 'tophat', seat: 0  },
      { id: 'cowboy', label: 'Cowboy',  art: 'cowboy', seat: -1 },
    ],
    shades: [
      { id: 'shades', label: 'Deal with it', front: 'shadesFront', side: 'shadesSide' },
      { id: 'hearts', label: 'Hearts',       front: 'heartsFront', side: 'heartsSide' },
      { id: 'visor',  label: 'Visor',        front: 'visorFront',  side: 'visorSide'  },
    ],
    // extras anchor to the FACE (eye anchor + dy, front/side art, mirrored on
    // left-facing frames) or the CHEST (per-frame btCx body centre + dy)
    extras: [
      { id: 'mustache', label: 'Moustache', anchor: 'face',  dy: 4.0, sideDx: -1.2, front: 'mustacheFront', side: 'mustacheSide' },
      { id: 'bowtie',   label: 'Bow tie',     anchor: 'chest', dy: 9.5, art: 'bowtie' },
      // earned, never given: unlocked by surviving 30 min at the rave (builder shows a locked door chip).
      // NOT in banana-daily pools on purpose — the daily banana doesn't wear souvenirs it didn't earn.
      // anchor 'hand' rides the per-frame glove centres; grip = art grid-units from the
      // art top to where the glove wraps it (here: the black cap).
      { id: 'glowstick', label: 'Glowstick', anchor: 'hand', hand: 'right', grip: 8.5, art: 'glowstick', earned: 'rave',
        lock: 'a rave souvenir: survive 30 minutes on the dance floor and it’s yours forever' },
      // the trophy: earned by catching the golden banana at the rave (patch
      // `golden` is the proof of the moment); worn from the pass or the builder
      { id: 'goldbanana', label: 'Golden Banana', anchor: 'hand', hand: 'left', grip: 2, art: 'goldbanana', earned: 'golden',
        lock: 'the trophy: catch the golden banana at the rave — it strikes every half hour' },
      // happy-hour trophy: lives for one rave session, granted by the worker (first
      // banana at the bar). raveOnly = never a builder chip, never randomized.
      { id: 'cone', label: 'Traffic cone', anchor: 'face', dy: -10.5, sideDx: 0, front: 'cone', side: 'cone', raveOnly: true },
      { id: 'beer', label: 'Beer', anchor: 'hand', hand: 'left', grip: 3.5, art: 'beer', raveOnly: true },
      // the courier's record: injected at DRAW time from the rave's carry flag
      // (never in outfit broadcasts); left glove — it overflows the beer while carried
      { id: 'vinyl', label: 'Vinyl', anchor: 'hand', hand: 'left', grip: 1.5, art: 'vinyl', raveOnly: true },
      // the nightshift broom — injected at draw time from the rave's chore flag
      { id: 'broom', label: 'Broom', anchor: 'hand', hand: 'right', grip: 3, art: 'broom', raveOnly: true },
    ],
  },
  // Example future pack (art not drawn yet):
  // xmas: { label: 'Christmas', window: { from: '12-01', to: '12-26' },
  //         hats: [{ id: 'santa', label: 'Santa', art: 'santa', seat: -1 }], shades: [], extras: [] },
};

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
const HATS = [['none', 'None'], ...HAT_DEFS.map((h) => [h.id, h.label])];
const GLASSES = [['none', 'None'], ...SHADE_DEFS.map((s) => [s.id, s.label])];

// The banana sprite's pixel unit is 13 source px; the pixel SVGs use 10 svg-px
// per unit. Sizing accessories in banana-pixels guarantees they match the
// sprite's resolution exactly (no mixed pixel densities).
const PX = 13;
const gridW = (key) => parseInt(key.match(/viewBox="0 0 (\d+)/)[1], 10) / 10;
const gridH = (key) => parseInt(key.match(/viewBox="0 0 \d+ (\d+)/)[1], 10) / 10;
// hat seating: deep enough to sit ON the head mass (not the stem peak); the
// x-anchor comes from the per-frame hatCx measured at this same depth. A hat
// def's `seat` adjusts per hat (outlined hats: -1, their bottom row is outline).
const HAT_OVERLAP = 7.3;
// shades ride slightly high to fully cover the eye whites. Chest-anchored
// extras (bow tie) use per-frame btCx: the body sways ±3 units at chest depth.
const SH_DY = -0.5;
// square-canvas layout: headroom above the frame so hats fit at the tall frames
const FRAME_H_FRAC = 0.66, FRAME_TOP_FRAC = 0.20;

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
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(key);
  imgCache[key] = img; return img;
}
Object.values(SVG).forEach(imgFor); // prewarm
async function assetsReady() {
  const imgs = [sheet, ...Object.values(imgCache)];
  await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth) ? Promise.resolve() : i.decode().catch(() => {})));
}

// ---- the one render path ----
// Draws frame `idx` composited into a W×W canvas.
// o: { bg: css color|'transparent', captions: bool, hue: deg, effect: 'none'|'disco'|'sparkle'|'confetti' }
function drawComposite(ctx, W, idx, o) {
  ctx.clearRect(0, 0, W, W);
  if (o.bg && o.bg !== 'transparent') { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, W); }
  const fh = W * FRAME_H_FRAC, scale = fh / FH, fw = FW * scale;
  const fx = (W - fw) / 2, fy = W * FRAME_TOP_FRAC;
  const F = FRAMES[idx];
  const unit = PX * scale;
  const side = F.face !== 'front';
  const mirror = F.face === 'left' ? -1 : 1;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.filter = o.hue ? `hue-rotate(${o.hue}deg)` : 'none';
  try { ctx.drawImage(sheet, idx * FW, 0, FW, FH, fx, fy, fw, fh); } catch (e) {}
  ctx.imageSmoothingEnabled = true;

  // accessories ride the head/eyes; art switches side/front with the face.
  // No rotation ever — axis-aligned pixels are the authentic look.
  const hatDef = HAT_BY_ID[o.hat];
  if (hatDef) {
    const key = SVG[hatDef.art];
    const hw = gridW(key) * unit, hh = gridH(key) * unit;
    const seat = HAT_OVERLAP + (hatDef.seat || 0);
    const hBottom = fy + F.tipY * scale + seat * unit;
    drawAcc(ctx, key, fx + F.hatCx * scale - hw / 2, hBottom - hh, hw, hh, false);
  }
  const shadeDef = SHADE_BY_ID[o.glasses];
  if (shadeDef) {
    const key = SVG[side ? shadeDef.side : shadeDef.front];
    const gw = gridW(key) * unit, gh = gridH(key) * unit;
    const gx = fx + F.eyeCx * scale, gy = fy + (F.eyeCy + SH_DY * PX) * scale;
    drawAcc(ctx, key, gx - gw / 2, gy - gh / 2, gw, gh, F.face === 'left');
  }
  for (const d of EXTRA_DEFS) {
    if (!o.extras[d.id]) continue;
    if (d.anchor === 'face') {
      const key = SVG[side ? d.side : d.front];
      const mw = gridW(key) * unit, mh = gridH(key) * unit;
      const mx = fx + F.eyeCx * scale + (side ? mirror * d.sideDx * unit : 0);
      const my = fy + (F.eyeCy + d.dy * PX) * scale;
      drawAcc(ctx, key, mx - mw / 2, my - mh / 2, mw, mh, F.face === 'left');
    } else if (d.anchor === 'hand') { // held items ride the per-frame glove centres
      const hands = F.hands;
      if (hands) {
        const [hx, hy] = d.hand === 'left' ? hands[0] : hands[1];
        const key = SVG[d.art];
        const gw2 = gridW(key) * unit, gh2 = gridH(key) * unit;
        drawAcc(ctx, key, fx + hx * scale - gw2 / 2, fy + hy * scale - (d.grip || 0) * unit, gw2, gh2, false);
      }
    } else { // 'chest'
      const key = SVG[d.art];
      const bw = gridW(key) * unit, bh = gridH(key) * unit;
      const bx = fx + F.btCx * scale;
      const by = fy + (F.eyeCy + d.dy * PX) * scale;
      drawAcc(ctx, key, bx - bw / 2, by - bh / 2, bw, bh, false);
    }
  }
  ctx.filter = 'none';
  ctx.restore();

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
  const font = (s) => '900 ' + s + 'px Impact, "Arial Black", "Franklin Gothic Bold", sans-serif';
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
  sheet, imgFor, assetsReady, drawComposite, drawAcc, drawSparks, drawConfetti, caption,
};
