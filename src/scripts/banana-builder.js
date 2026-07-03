// Dancing Banana builder — the banana ALWAYS dances (authentic 8-frame arm-wave
// from the original 1999 GIF, via /assets/banana-dance.png spritesheet); stills
// are only chosen at export time (sticker/meme card). One canvas render path
// (drawComposite) drives the live preview, the chat-size emoji preview, the
// frame-picker thumbnails and both exports, so what you see is what you get.
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

// ---- authentic dance frames ----
// ?v= busts stale browser caches: bump it whenever the sheet's pixels change,
// or old cached copies (e.g. the pre-fix sheet with white-filled arm gaps)
// keep haunting returning visitors' previews and exports.
const SHEET_SRC = '/assets/banana-dance.png?v=4';
const FW = 469, FH = 498, NFRAMES = 8;
const BASE_CYCLE_S = 0.8; // 8 frames x 100ms = the original GIF timing
const SPD_MIN = 0.35, SPD_MAX = 1.6;
// Per-frame anchors measured from the sprite pixels (Pillow-verified):
// eye centre (glasses), tip Y + head centre AT BRIM DEPTH (hat — the stem curves
// toward the body going down, so the hat anchor must be measured at the depth
// where the hat actually sits, per frame; this keeps the hat riding the head
// smoothly through the dance), and which way the face points.
const FRAMES = [
  { eyeCx: 232, eyeCy: 222, hatCx: 272, btCx: 268, tipY: 85, face: 'right' },
  { eyeCx: 232, eyeCy: 192, hatCx: 272, btCx: 270, tipY: 57, face: 'right' },
  { eyeCx: 234, eyeCy: 135, hatCx: 248, btCx: 248, tipY: 0,  face: 'front' },
  { eyeCx: 232, eyeCy: 156, hatCx: 206, btCx: 206, tipY: 28, face: 'front' },
  { eyeCx: 236, eyeCy: 222, hatCx: 196, btCx: 200, tipY: 85, face: 'left'  },
  { eyeCx: 236, eyeCy: 192, hatCx: 196, btCx: 198, tipY: 57, face: 'left'  },
  { eyeCx: 234, eyeCy: 135, hatCx: 220, btCx: 220, tipY: 0,  face: 'front' },
  { eyeCx: 237, eyeCy: 156, hatCx: 262, btCx: 262, tipY: 28, face: 'front' },
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
};

const BGS = ['transparent','#ffe135','#ff4d6d','#6c8cff','#37d67a','#ffffff','#111111','#ff9f1c','#b388ff'];
const EFFECTS = [['none','None'],['disco','Disco'],['sparkle','Sparkles'],['confetti','Confetti']];
// tiny monochrome pixel icons (currentColor) for the extras chips + pause button
const ICON_MUSTACHE = '<svg class="pxi" viewBox="0 0 90 30" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="0" y="0" width="40" height="10"/><rect x="50" y="0" width="40" height="10"/><rect x="0" y="10" width="90" height="10"/><rect x="10" y="20" width="20" height="10"/><rect x="60" y="20" width="20" height="10"/></svg>';
const ICON_BOWTIE = '<svg class="pxi" viewBox="0 0 140 110" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="30" height="10" fill="#262233"/><rect x="100" y="0" width="30" height="10" fill="#262233"/><rect x="0" y="10" width="10" height="10" fill="#262233"/><rect x="10" y="10" width="10" height="10" fill="#55aaff"/><rect x="20" y="10" width="10" height="10" fill="#b8dcff"/><rect x="30" y="10" width="10" height="10" fill="#262233"/><rect x="90" y="10" width="10" height="10" fill="#262233"/><rect x="100" y="10" width="10" height="10" fill="#b8dcff"/><rect x="110" y="10" width="10" height="10" fill="#55aaff"/><rect x="120" y="10" width="10" height="10" fill="#262233"/><rect x="0" y="20" width="10" height="10" fill="#262233"/><rect x="10" y="20" width="30" height="10" fill="#55aaff"/><rect x="40" y="20" width="10" height="10" fill="#262233"/><rect x="80" y="20" width="10" height="10" fill="#262233"/><rect x="90" y="20" width="30" height="10" fill="#55aaff"/><rect x="120" y="20" width="10" height="10" fill="#262233"/><rect x="0" y="30" width="10" height="10" fill="#262233"/><rect x="10" y="30" width="40" height="10" fill="#55aaff"/><rect x="50" y="30" width="10" height="10" fill="#262233"/><rect x="70" y="30" width="10" height="10" fill="#262233"/><rect x="80" y="30" width="40" height="10" fill="#55aaff"/><rect x="120" y="30" width="10" height="10" fill="#262233"/><rect x="0" y="40" width="10" height="10" fill="#262233"/><rect x="10" y="40" width="40" height="10" fill="#55aaff"/><rect x="50" y="40" width="30" height="10" fill="#262233"/><rect x="80" y="40" width="40" height="10" fill="#55aaff"/><rect x="120" y="40" width="10" height="10" fill="#262233"/><rect x="0" y="50" width="10" height="10" fill="#262233"/><rect x="10" y="50" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="50" width="20" height="10" fill="#55aaff"/><rect x="40" y="50" width="10" height="10" fill="#262233"/><rect x="50" y="50" width="30" height="10" fill="#6e4423"/><rect x="80" y="50" width="10" height="10" fill="#262233"/><rect x="90" y="50" width="20" height="10" fill="#55aaff"/><rect x="110" y="50" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="50" width="10" height="10" fill="#262233"/><rect x="0" y="60" width="10" height="10" fill="#262233"/><rect x="10" y="60" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="60" width="30" height="10" fill="#55aaff"/><rect x="50" y="60" width="30" height="10" fill="#262233"/><rect x="80" y="60" width="30" height="10" fill="#55aaff"/><rect x="110" y="60" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="60" width="10" height="10" fill="#262233"/><rect x="0" y="70" width="10" height="10" fill="#262233"/><rect x="10" y="70" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="70" width="30" height="10" fill="#55aaff"/><rect x="50" y="70" width="10" height="10" fill="#262233"/><rect x="70" y="70" width="10" height="10" fill="#262233"/><rect x="80" y="70" width="30" height="10" fill="#55aaff"/><rect x="110" y="70" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="70" width="10" height="10" fill="#262233"/><rect x="0" y="80" width="10" height="10" fill="#262233"/><rect x="10" y="80" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="80" width="20" height="10" fill="#55aaff"/><rect x="40" y="80" width="10" height="10" fill="#262233"/><rect x="80" y="80" width="10" height="10" fill="#262233"/><rect x="90" y="80" width="20" height="10" fill="#55aaff"/><rect x="110" y="80" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="80" width="10" height="10" fill="#262233"/><rect x="0" y="90" width="10" height="10" fill="#262233"/><rect x="10" y="90" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="90" width="10" height="10" fill="#55aaff"/><rect x="30" y="90" width="10" height="10" fill="#262233"/><rect x="90" y="90" width="10" height="10" fill="#262233"/><rect x="100" y="90" width="10" height="10" fill="#55aaff"/><rect x="110" y="90" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="90" width="10" height="10" fill="#262233"/><rect x="0" y="100" width="30" height="10" fill="#262233"/><rect x="100" y="100" width="30" height="10" fill="#262233"/></svg>';
const ICON_PAUSE = '<svg class="pxi" viewBox="0 0 70 80" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="10" y="10" width="20" height="60"/><rect x="40" y="10" width="20" height="60"/></svg>';
const ICON_PLAY = '<svg class="pxi" viewBox="0 0 70 80" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="15" y="10" width="15" height="60"/><rect x="30" y="20" width="15" height="40"/><rect x="45" y="30" width="15" height="20"/></svg>';

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
      { id: 'mustache', label: ICON_MUSTACHE + ' Moustache', anchor: 'face',  dy: 4.0, sideDx: -1.2, front: 'mustacheFront', side: 'mustacheSide' },
      { id: 'bowtie',   label: ICON_BOWTIE + ' Bow tie',     anchor: 'chest', dy: 9.5, art: 'bowtie' },
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

const el = (id) => document.getElementById(id);
if (el('bbStage')) init();

function init() {
  const stage = el('bbStage');
  const canvas = el('bbCanvas');
  const topIn = el('bbTopText'), botIn = el('bbBottomText'), speed = el('bbSpeed');

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    bg: 'transparent', top: '', bottom: '', glasses: 'none', hat: 'none',
    extras: {}, effect: 'none', // extras keyed by def id, e.g. { mustache: true }
    spd: BASE_CYCLE_S, frame: 0, // frame = the sticker still
    paused: reducedMotion,
  };

  // ---- sprite + accessory image loading ----
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

  // ---- controls ----
  BGS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'bb-swatch'; b.dataset.bg = c; b.setAttribute('aria-label', c);
    if (c === 'transparent') b.classList.add('bb-swatch--none'); else b.style.background = c;
    b.onclick = () => { state.bg = c; onState(); };
    el('bbSwatches').appendChild(b);
  });
  function chips(host, items, key) {
    items.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'bb-chip'; b.textContent = label; b.dataset.val = val;
      b.onclick = () => { state[key] = val; onState(); };
      el(host).appendChild(b);
    });
  }
  chips('bbGlassesChips', GLASSES, 'glasses');
  chips('bbHatChips', HATS, 'hat');
  chips('bbEffectChips', EFFECTS, 'effect');
  // extras = independent toggles, not a single-choice row (labels carry pixel icons)
  EXTRA_DEFS.forEach((d) => {
    const b = document.createElement('button');
    b.className = 'bb-chip'; b.innerHTML = d.label; b.dataset.val = d.id;
    b.onclick = () => { state.extras[d.id] = !state.extras[d.id]; onState(); };
    el('bbExtrasChips').appendChild(b);
  });

  topIn.addEventListener('input', () => { state.top = topIn.value; onState(); });
  botIn.addEventListener('input', () => { state.bottom = botIn.value; onState(); });
  // slider shows "faster to the right": invert into seconds-per-cycle
  speed.addEventListener('input', () => { state.spd = Math.round((SPD_MIN + SPD_MAX - parseFloat(speed.value)) * 100) / 100; onState(); });

  el('bbPause').onclick = () => { state.paused = !state.paused; refreshUI(); };

  el('bbRandom').onclick = () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const quips = [
      ['HELLO YES', "IT'S THE BANANA GUY"],
      ['IT IS', 'WEDNESDAY MY DUDES'],
      ['', 'PEANUT BUTTER JELLY TIME'],
      ['CERTIFIED', 'BANANA MOMENT'],
      ['NO THOUGHTS', 'JUST DANCE'],
      ['MOM SAID', "IT'S MY TURN TO DANCE"],
      ['CEO', 'OF DANCING'],
      ['ERROR 404', 'CHILL NOT FOUND'],
      ['LOCAL BANANA', 'REFUSES TO STOP'],
      ['ME AFTER', 'ONE COFFEE'],
      ['VIBE CHECK', 'PASSED'],
      ['5 AM', 'STILL DANCING'],
      ['THE FLOOR IS LAVA', 'ANYWAY'],
      ['BANANA', 'FOR SCALE'],
      ['UNLIMITED', 'POTASSIUM'],
      ['WHEN THE', 'BEAT DROPS'],
      ['MY LAST', 'BRAINCELL'],
      ['FRIDAY', 'ENERGY'],
      ['EMOTIONAL', 'SUPPORT BANANA'],
      ['GO', 'BANANAS'],
      ['DANCE LIKE NOBODY', 'IS WATCHING'],
      ['100%', 'RIPE'],
      ['POV:', 'YOU FOUND THE BANANA'],
      ['B', 'A N A N A'],
      ['ME WHEN', 'THE BANANA'],
      ['THIS IS', 'FINE'],
      ['ONE MORE DANCE', 'I PROMISE'],
      ['ABSOLUTE', 'UNIT'],
      ['PEEL', 'GOOD VIBES'],
      ['MAXIMUM', 'WIGGLE'],
      ['', ''],
    ];
    const q = pick(quips);
    state.bg = pick(BGS); state.top = q[0]; state.bottom = q[1];
    state.glasses = pick(GLASSES)[0]; state.hat = pick(HATS)[0];
    EXTRA_DEFS.forEach((d) => { state.extras[d.id] = Math.random() < 0.3; });
    state.effect = pick(['none','none','disco','sparkle','confetti']);
    state.spd = Math.round((0.5 + Math.random() * 0.8) * 100) / 100;
    topIn.value = state.top; botIn.value = state.bottom;
    onState();
  };

  let toastT;
  function toast(msg) { const t = el('bbToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
  el('bbShare').onclick = async () => { sync(); try { await navigator.clipboard.writeText(location.href); toast('Share link copied!'); } catch (e) { toast('Copy this URL from the address bar'); } };

  function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

  // ---- URL state ----
  function sync() {
    const p = new URLSearchParams();
    if (state.bg !== 'transparent') p.set('bg', state.bg);
    if (state.top) p.set('t', state.top);
    if (state.bottom) p.set('b', state.bottom);
    if (state.glasses !== 'none') p.set('g', state.glasses);
    if (state.hat !== 'none') p.set('h', state.hat);
    const exOn = EXTRA_DEFS.filter((d) => state.extras[d.id]).map((d) => d.id);
    if (exOn.length) p.set('ex', exOn.join('.'));
    if (state.effect !== 'none') p.set('e', state.effect);
    if (state.spd !== BASE_CYCLE_S) p.set('s', state.spd);
    if (state.frame !== 0) p.set('f', state.frame);
    history.replaceState(null, '', p.toString() ? '?' + p.toString() : location.pathname);
  }
  function load() {
    const p = new URLSearchParams(location.search);
    if (p.get('bg')) state.bg = p.get('bg');
    state.top = p.get('t') || ''; state.bottom = p.get('b') || '';
    const g = p.get('g'); state.glasses = GLASSES.some(([v]) => v === g) ? g : (g ? 'shades' : 'none'); // old classic/cool links → shades
    const h = p.get('h'); state.hat = HAT_BY_ID[h] ? h : 'none';
    state.extras = {};
    (p.get('ex') || '').split('.').forEach((id) => { if (EXTRA_DEFS.some((d) => d.id === id)) state.extras[id] = true; });
    if (p.get('mu') === '1') state.extras.mustache = true; // legacy params
    if (p.get('bt') === '1') state.extras.bowtie = true;
    const e = p.get('e') || p.get('m'); // old m=disco links still work
    if (EFFECTS.some(([v]) => v === e)) state.effect = e;
    state.spd = p.get('s') ? parseFloat(p.get('s')) : BASE_CYCLE_S;
    if (!(state.spd >= SPD_MIN && state.spd <= SPD_MAX)) state.spd = BASE_CYCLE_S;
    const f = parseInt(p.get('f'), 10); if (f >= 0 && f < NFRAMES) state.frame = f;
    topIn.value = state.top; botIn.value = state.bottom;
    speed.value = SPD_MIN + SPD_MAX - state.spd;
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
    const hatDef = HAT_BY_ID[state.hat];
    if (hatDef) {
      const key = SVG[hatDef.art];
      const hw = gridW(key) * unit, hh = gridH(key) * unit;
      const seat = HAT_OVERLAP + (hatDef.seat || 0);
      const hBottom = fy + F.tipY * scale + seat * unit;
      drawAcc(ctx, key, fx + F.hatCx * scale - hw / 2, hBottom - hh, hw, hh, false);
    }
    const shadeDef = SHADE_BY_ID[state.glasses];
    if (shadeDef) {
      const key = SVG[side ? shadeDef.side : shadeDef.front];
      const gw = gridW(key) * unit, gh = gridH(key) * unit;
      const gx = fx + F.eyeCx * scale, gy = fy + (F.eyeCy + SH_DY * PX) * scale;
      drawAcc(ctx, key, gx - gw / 2, gy - gh / 2, gw, gh, F.face === 'left');
    }
    for (const d of EXTRA_DEFS) {
      if (!state.extras[d.id]) continue;
      if (d.anchor === 'face') {
        const key = SVG[side ? d.side : d.front];
        const mw = gridW(key) * unit, mh = gridH(key) * unit;
        const mx = fx + F.eyeCx * scale + (side ? mirror * d.sideDx * unit : 0);
        const my = fy + (F.eyeCy + d.dy * PX) * scale;
        drawAcc(ctx, key, mx - mw / 2, my - mh / 2, mw, mh, F.face === 'left');
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

    if (o.captions) { caption(ctx, W, state.top, true); caption(ctx, W, state.bottom, false); }
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

  // ---- live preview loop (pausable clock) ----
  const pctx = canvas.getContext('2d');
  let lastIdx = -1, dirty = true, animT = 0, lastNow = 0;
  function tick(now) {
    if (!lastNow) lastNow = now;
    if (!state.paused) animT += now - lastNow;
    lastNow = now;
    const delay = Math.max(20, state.spd * 1000 / NFRAMES);
    const idx = Math.floor(animT / delay) % NFRAMES;
    const cyc = (animT % (delay * NFRAMES)) / (delay * NFRAMES);
    const hue = state.effect === 'disco' ? 360 * cyc : 0;
    if (idx !== lastIdx || hue || dirty) {
      const size = Math.min(720, Math.round(stage.clientWidth * (window.devicePixelRatio || 1)));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
      drawComposite(pctx, size, idx, { bg: state.bg, captions: true, hue, effect: state.effect });
      lastIdx = idx; dirty = false;
      drawChat(idx, hue);
    }
    requestAnimationFrame(tick);
  }

  // ---- chat-size emoji preview (the "this is how it looks in chat" moment) ----
  const chatCvs = [el('bbEmoji32'), el('bbEmoji48')].filter(Boolean);
  const OFF = document.createElement('canvas'); OFF.width = 240; OFF.height = 240;
  const offCtx = OFF.getContext('2d');
  let emojiBB = { x: 0, y: 0, w: 240, h: 240 };
  function recomputeEmojiBB() { // union across all frames = motion-aware crop
    const W = 240, datas = [];
    for (let i = 0; i < NFRAMES; i++) {
      drawComposite(offCtx, W, i, { bg: 'transparent', captions: false, effect: state.effect });
      datas.push(offCtx.getImageData(0, 0, W, W).data);
    }
    emojiBB = pad(bboxOf(datas, W), W);
  }
  function drawChat(idx, hue) {
    drawComposite(offCtx, 240, idx, { bg: 'transparent', captions: false, hue, effect: state.effect });
    for (const c of chatCvs) {
      const cctx = c.getContext('2d');
      cctx.clearRect(0, 0, c.width, c.height);
      cctx.imageSmoothingEnabled = true;
      const s = Math.min(c.width / emojiBB.w, c.height / emojiBB.h);
      const dw = emojiBB.w * s, dh = emojiBB.h * s;
      cctx.drawImage(OFF, emojiBB.x, emojiBB.y, emojiBB.w, emojiBB.h, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    }
  }

  // ---- frame picker (sticker card): freeze your favourite move ----
  const pickerHost = el('bbFrames');
  const pickerCvs = [];
  for (let i = 0; i < NFRAMES; i++) {
    const b = document.createElement('button');
    b.className = 'bb-frame'; b.dataset.frame = i; b.setAttribute('aria-label', 'Dance frame ' + (i + 1));
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    b.appendChild(c); pickerCvs.push(c);
    b.onclick = () => { state.frame = i; onState(); };
    pickerHost.appendChild(b);
  }
  function drawPicker() { // thumbnails show the outfit, not the effects
    pickerCvs.forEach((c, i) => drawComposite(c.getContext('2d'), 96, i, { bg: 'transparent', captions: false }));
  }

  // ---- state change: repaint everything derived ----
  let bbT;
  function onState() {
    dirty = true;
    refreshUI(); sync();
    clearTimeout(bbT);
    bbT = setTimeout(() => { recomputeEmojiBB(); drawPicker(); dirty = true; }, 60);
  }
  function refreshUI() {
    if (state.bg === 'transparent') { stage.classList.add('bb-stage--transparent'); stage.style.background = ''; }
    else { stage.classList.remove('bb-stage--transparent'); stage.style.background = state.bg; }
    document.querySelectorAll('.bb-swatch').forEach((s) => s.setAttribute('aria-pressed', s.dataset.bg === state.bg));
    [['bbGlassesChips','glasses'],['bbHatChips','hat'],['bbEffectChips','effect']].forEach(([host, key]) => {
      document.querySelectorAll('#' + host + ' .bb-chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.val === state[key]));
    });
    document.querySelectorAll('#bbExtrasChips .bb-chip').forEach((c) => c.setAttribute('aria-pressed', String(!!state.extras[c.dataset.val])));
    document.querySelectorAll('.bb-frame').forEach((f) => f.setAttribute('aria-pressed', String(parseInt(f.dataset.frame, 10) === state.frame)));
    const pb = el('bbPause');
    pb.innerHTML = state.paused ? ICON_PLAY : ICON_PAUSE;
    pb.setAttribute('aria-label', state.paused ? 'Play the dance' : 'Pause the dance');
  }

  // ---- trim helpers ----
  function bboxOf(framesData, W) {
    let minX = W, minY = W, maxX = 0, maxY = 0, found = false;
    for (const data of framesData) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (!found) return { x: 0, y: 0, w: W, h: W };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
  function pad(bb, W) {
    const p = Math.round(Math.max(bb.w, bb.h) * 0.04);
    const x = Math.max(0, bb.x - p), y = Math.max(0, bb.y - p);
    return { x, y, w: Math.min(W - x, bb.w + p * 2), h: Math.min(W - y, bb.h + p * 2) };
  }
  function crop(cv, bb) {
    const o = document.createElement('canvas'); o.width = bb.w; o.height = bb.h;
    o.getContext('2d').drawImage(cv, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); return o;
  }
  function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  // ---- emoji GIF export: ALWAYS transparent, tight-trimmed, no captions ----
  el('bbDownloadGif').onclick = async () => {
    const btn = el('bbDownloadGif'); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      await assetsReady();
      const W = 360;
      const frames = [];
      const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
      for (let i = 0; i < NFRAMES; i++) {
        drawComposite(ctx, W, i, {
          bg: 'transparent', captions: false, effect: state.effect,
          hue: state.effect === 'disco' ? (360 * i / NFRAMES) : 0,
        });
        frames.push(ctx.getImageData(0, 0, W, W));
      }
      const bb = pad(bboxOf(frames.map((f) => f.data), W), W);
      const TARGET = 220;
      const s = TARGET / Math.max(bb.w, bb.h);
      const tw = Math.max(2, Math.round(bb.w * s)), th = Math.max(2, Math.round(bb.h * s));
      const delay = Math.max(20, Math.round((state.spd * 1000) / NFRAMES));

      const gif = GIFEncoder();
      const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th; const tctx = tmp.getContext('2d');
      let palette = null;
      for (let i = 0; i < NFRAMES; i++) {
        const src = document.createElement('canvas'); src.width = W; src.height = W; src.getContext('2d').putImageData(frames[i], 0, 0);
        tctx.clearRect(0, 0, tw, th);
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(src, bb.x, bb.y, bb.w, bb.h, 0, 0, tw, th);
        const data = tctx.getImageData(0, 0, tw, th).data;
        for (let k = 3; k < data.length; k += 4) data[k] = data[k] < 110 ? 0 : 255; // 1-bit alpha
        if (!palette) palette = quantize(data, 128, { format: 'rgba4444', oneBitAlpha: true });
        const index = applyPalette(data, palette, 'rgba4444');
        gif.writeFrame(index, tw, th, { palette, delay, transparent: true, dispose: 2 });
      }
      gif.finish();
      const blob = new Blob([gif.bytes()], { type: 'image/gif' });
      download(URL.createObjectURL(blob), 'my-dancing-banana.gif');
      toast('Emoji GIF downloaded!');
      track('gif_download', { file: 'builder-emoji.gif' });
    } catch (e) { toast('GIF export hiccup — try again'); console.error(e); }
    finally { btn.disabled = false; btn.textContent = label; }
  };

  // ---- meme/sticker PNG export: the PICKED frame, captions + background ----
  el('bbDownloadPng').onclick = async () => {
    await assetsReady();
    const W = 720;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
    drawComposite(ctx, W, state.frame, {
      bg: state.bg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    let out = cv;
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      out = crop(cv, pad(bboxOf([data], W), W));
    }
    download(out.toDataURL('image/png'), 'my-dancing-banana.png');
    toast('Image downloaded!');
    track('gif_download', { file: 'builder-meme.png' });
  };

  // ---- order it as a REAL printed sticker (Part B) ----
  // Renders a print-res PNG of the picked frame, uploads it to the fulfilment
  // worker (R2), then opens a Shopify checkout with the design attached as a
  // line-item attribute. After payment, the worker's orders/paid webhook
  // creates a DRAFT Printful order that Trym approves before printing.
  const STICKER = {
    workerBase: 'https://banana-sticker.trymstene.workers.dev',
    variantGid: 'gid://shopify/ProductVariant/48935555006683', // Custom Banana Sticker
    shopDomain: 'officialdancingbanana.myshopify.com',
    storefrontToken: '1032480366b6bf67760ba73ace4fe0f8', // public Storefront token, safe to embed
  };
  // Quick client-side caption screen. Deliberately blunt (substring match, a
  // few false positives are fine — the toast just asks to reword). The REAL
  // moderation gate is Trym approving every Printful draft before print.
  const BLOCKLIST = ['fuck','shit','bitch','cunt','nigg','fagg','retard','whore','slut','porn','rape','hitler','nazi','faen','jævla','jævel','fitte','kuk','pikk','hore','kneppe'];
  const captionsClean = () => { const t = (state.top + ' ' + state.bottom).toLowerCase(); return !BLOCKLIST.some((w) => t.includes(w)); };

  // Renders the print file (what actually gets printed). Two sticker styles
  // (Trym's call, 3 Jul): TRANSPARENT background → trimmed transparent PNG so
  // Printful DIE-CUTS along the design's outline (banana + captions included;
  // Trym's draft approval catches odd cases like floating confetti). A
  // COLOURED background → the full square canvas (square sticker).
  function renderPrintFile() {
    const W = 2048;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
    drawComposite(ctx, W, state.frame, {
      bg: state.bg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      return crop(cv, pad(bboxOf([data], W), W));
    }
    return cv;
  }

  // Sticker MOCKUP matching the style: die-cut white contour border for
  // transparent designs, rounded white square for coloured ones. Soft shadow,
  // paper backdrop — so the buyer sees the physical thing.
  function makeStickerMockup(design, size = 900) {
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#e8e4da'; ctx.fillRect(0, 0, size, size); // paper backdrop
    const margin = size * 0.14;
    const s = Math.min((size - 2 * margin) / design.width, (size - 2 * margin) / design.height);
    const dw = design.width * s, dh = design.height * s;
    const dx = (size - dw) / 2, dy = (size - dh) / 2;
    const border = size * 0.02; // the white kiss-cut edge

    if (state.bg === 'transparent') {
      // white silhouette of the design, dilated in a ring = the die-cut border
      const sil = document.createElement('canvas'); sil.width = size; sil.height = size;
      const sctx = sil.getContext('2d');
      sctx.drawImage(design, dx, dy, dw, dh);
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = '#fff'; sctx.fillRect(0, 0, size, size);
      const outline = document.createElement('canvas'); outline.width = size; outline.height = size;
      const octx = outline.getContext('2d');
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * 2 * Math.PI;
        octx.drawImage(sil, Math.cos(a) * border, Math.sin(a) * border);
      }
      octx.drawImage(sil, 0, 0);
      ctx.save();
      ctx.shadowColor = 'rgba(17,17,17,0.28)'; ctx.shadowBlur = size * 0.03; ctx.shadowOffsetY = size * 0.012;
      ctx.drawImage(outline, 0, 0);
      ctx.restore();
      ctx.drawImage(outline, 0, 0); // crisp second pass over the shadowed one
      ctx.drawImage(design, dx, dy, dw, dh);
    } else {
      const r = size * 0.035;
      ctx.save();
      ctx.shadowColor = 'rgba(17,17,17,0.28)'; ctx.shadowBlur = size * 0.03; ctx.shadowOffsetY = size * 0.012;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.roundRect(dx - border, dy - border, dw + 2 * border, dh + 2 * border, r); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, r * 0.5); ctx.clip();
      ctx.drawImage(design, dx, dy, dw, dh);
      ctx.restore();
    }
    return cv;
  }

  // Step 1: the preview modal — see YOUR sticker before paying (trust!)
  let pendingPrint = null;
  el('bbOrderSticker').onclick = async () => {
    if (!captionsClean()) { toast('Let’s keep it family friendly \u{1F34C} — try other words'); return; }
    await assetsReady();
    pendingPrint = renderPrintFile();
    const mock = makeStickerMockup(pendingPrint);
    const mc = el('bbMockup');
    mc.width = mock.width; mc.height = mock.height;
    mc.getContext('2d').drawImage(mock, 0, 0);
    el('bbModalCut').textContent = state.bg === 'transparent'
      ? '3″×3″ (7.5 cm) vinyl sticker, die-cut along your design’s outline'
      : '3″×3″ (7.5 cm) square vinyl sticker with your design';
    el('bbOrderModal').hidden = false;
    document.body.style.overflow = 'hidden';
    track('sticker_preview_open', {});
  };
  function closeOrderModal() { el('bbOrderModal').hidden = true; document.body.style.overflow = ''; }
  el('bbOrderCancel').onclick = closeOrderModal;
  el('bbOrderModal').addEventListener('click', (e) => { if (e.target === el('bbOrderModal')) closeOrderModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el('bbOrderModal').hidden) closeOrderModal(); });

  // Step 2: confirmed — upload the print file + open the Shopify checkout
  el('bbOrderConfirm').onclick = async () => {
    const btn = el('bbOrderConfirm'); const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = 'Preparing your sticker…';
    try {
      const blob = await new Promise((r) => pendingPrint.toBlob(r, 'image/png'));
      const up = await fetch(STICKER.workerBase + '/upload', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
      if (!up.ok) throw new Error('upload failed: ' + up.status);
      const { key, url } = await up.json();

      const mutation = 'mutation($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { checkoutUrl } userErrors { message } } }';
      const res = await fetch('https://' + STICKER.shopDomain + '/api/2024-10/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': STICKER.storefrontToken },
        body: JSON.stringify({
          query: mutation,
          variables: { lines: [{ merchandiseId: STICKER.variantGid, quantity: 1, attributes: [
            { key: '_design_key', value: key },   // machine-readable, hidden in checkout
            { key: 'Design', value: url },        // visible link so the customer sees THEIR banana
          ] }] },
        }),
      });
      const data = await res.json();
      const checkout = data && data.data && data.data.cartCreate && data.data.cartCreate.cart && data.data.cartCreate.cart.checkoutUrl;
      if (!checkout) throw new Error('cart failed: ' + JSON.stringify(data));
      track('sticker_order_click', {});
      window.location.href = checkout;
    } catch (e) {
      console.error(e);
      toast('Hmm, that didn’t work — give it another try?');
      btn.disabled = false; btn.innerHTML = label;
    }
  };

  // exposed for debugging + future flows
  window.__bananaBuilder = { state, drawComposite, bboxOf, pad, crop, assetsReady, FRAMES, PACKS, STICKER, makeStickerMockup, renderPrintFile };

  // ---- boot ----
  load();
  refreshUI();
  sheet.decode().catch(() => {}).finally(() => {
    recomputeEmojiBB(); drawPicker(); dirty = true;
    requestAnimationFrame(tick);
  });
}
