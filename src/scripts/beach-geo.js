// ⚠️⚠️ GENERATED FILE — DO NOT EDIT BY HAND. ⚠️⚠️
// Written by tools/build-beach-scene.py. Re-run it after moving anything:
//     python tools/build-beach-scene.py
//
// WHY THIS EXISTS: these numbers used to be hand-copied into
// banana-beach.js beside a "keep in sync" comment, and they drifted the
// first time a prop moved — shifting the parasols for the bigger volleyball
// court left one invisible pole standing ON the court and another where no
// umbrella had been for two commits. Colliders are now declared on the
// place() call that draws the prop, so the art and the collision are one
// edit. Top-down blocking is always the BASE of an object, never its full
// height: you walk BEHIND a palm's crown and a lighthouse's tower.
export const WORLD = { w: 2760, h: 1100 };
export const WATER_Y = 292;               // bananas famously can't swim
export const PIER = { x0: 1820, x1: 1960, y0: 60 };
export const PLATFORM = { x0: 1820, x1: 1960, y0: 60, y1: 308 };
export const PIER_MOUTH = { x: 1890, y: 348 };
export const COURT = { x0: 690, y0: 532, x1: 1170, y1: 1012 };
// NET.y is the line the net STANDS on — what you collide with. sprite* is
// where net.png is drawn: it rises ~138px ABOVE that line, which is why the
// page must depth-sort against it.
// topZ / gapZ are the MESH band's height above the base line. The ball must
// clear topZ; below gapZ it passes under the net through the gap the art
// actually shows; in between it hits the mesh.
export const NET = { y: 844, x0: 666, x1: 1194,
  spriteX: 665, spriteY: 705, spriteW: 530, spriteH: 146,
  topZ: 133, gapZ: 76 };
export const BAR = { x: 1700, y: 760, r: 104 };

export const OB_RECTS = [
  [457, 864, 483, 900],   // palm tree
  [507, 684, 533, 720],   // palm tree
  [1487, 484, 1513, 520],   // palm tree
  [1317, 1004, 1343, 1040],   // palm tree
  [137, 624, 163, 660],   // palm tree
  [687, 492, 713, 528],   // palm tree
  [347, 344, 373, 380],   // palm tree
  [1580, 638, 1822, 748],   // ship bar
  [992, 336, 1110, 428],   // example lighthouse
  [2094, 478, 2186, 506],   // midway
  [2384, 478, 2476, 506],   // midway
  [2094, 918, 2186, 946],   // midway
  [2384, 918, 2476, 946],   // midway
  [2608, 672, 2688, 704],   // midway
  [2246, 442, 2334, 466],   // fruit flowers cart 2
  [2566, 462, 2654, 486],   // fruit flowers cart 3
  [2246, 886, 2334, 910],   // street food cart 5
  [1976, 702, 2064, 726],   // street food cart 2
  [2516, 906, 2604, 930],   // fruit flowers cart 2
  [666, 834, 1194, 854],   // THE NET — solid; you go AROUND the poles
];

export const OB_CIRCLES = [
  [1265, 548, 13],   // yellow parasol pole
  [430, 1020, 13],   // blue parasol pole
  [340, 620, 13],   // green parasol pole
  [2360, 690, 13],   // street food table 2
  [2500, 728, 13],   // street food table 4
  [2318, 704, 13],   // street food chair 1
  [560, 640, 80],   // the bonfire ring
];

export const CHAIRS = [
  { rect: [1206, 592, 1276, 646], seat: { x: 1240, y: 636 } },   // sunbed 1
  { rect: [1296, 652, 1366, 706], seat: { x: 1330, y: 696 } },   // sunbed 5
  { rect: [366, 712, 436, 766], seat: { x: 400, y: 756 } },   // sunbed 9
];

// ⭐ Y-SORTED PROP LAYER. Each of these is ALSO baked into the plate; the page
// redraws it on top and sorts it against everything that walks by comparing
// `base` (the prop's ground line) to the walker's y. That's what lets you pass
// in FRONT of a palm's roots and BEHIND its canopy. A prop baked only into the
// plate can never draw in front of anything.
export const OVERLAYS = [
  { src: 'ov-0.png', x: 402, y: 739, w: 136, h: 161, base: 900 },
  { src: 'ov-1.png', x: 452, y: 559, w: 136, h: 161, base: 720 },
  { src: 'ov-2.png', x: 1432, y: 359, w: 136, h: 161, base: 520 },
  { src: 'ov-3.png', x: 1262, y: 879, w: 136, h: 161, base: 1040 },
  { src: 'ov-4.png', x: 82, y: 499, w: 136, h: 161, base: 660 },
  { src: 'ov-5.png', x: 632, y: 367, w: 136, h: 161, base: 528 },
  { src: 'ov-6.png', x: 292, y: 219, w: 136, h: 161, base: 380 },
  { src: 'ov-7.png', x: 1572, y: 563, w: 256, h: 177, base: 740 },
  { src: 'ov-8.png', x: 986, y: 138, w: 129, h: 282, base: 420 },
  { src: 'ov-9.png', x: 2061, y: 366, w: 158, h: 134, base: 500 },
  { src: 'ov-10.png', x: 2057, y: 454, w: 166, h: 50, base: 503 },
  { src: 'ov-11.png', x: 2351, y: 366, w: 158, h: 134, base: 500 },
  { src: 'ov-12.png', x: 2347, y: 454, w: 166, h: 50, base: 503 },
  { src: 'ov-13.png', x: 2061, y: 806, w: 158, h: 134, base: 940 },
  { src: 'ov-14.png', x: 2057, y: 894, w: 166, h: 50, base: 943 },
  { src: 'ov-15.png', x: 2351, y: 806, w: 158, h: 134, base: 940 },
  { src: 'ov-16.png', x: 2347, y: 894, w: 166, h: 50, base: 943 },
  { src: 'ov-17.png', x: 2601, y: 548, w: 94, h: 152, base: 700 },
  { src: 'ov-18.png', x: 2231, y: 330, w: 119, h: 136, base: 466 },
  { src: 'ov-19.png', x: 2551, y: 350, w: 119, h: 136, base: 486 },
  { src: 'ov-20.png', x: 2229, y: 776, w: 123, h: 134, base: 910 },
  { src: 'ov-21.png', x: 1956, y: 592, w: 128, h: 134, base: 726 },
  { src: 'ov-22.png', x: 2508, y: 810, w: 105, h: 120, base: 930 },
  { src: 'ov-23.png', x: 2341, y: 635, w: 38, h: 55, base: 690 },
  { src: 'ov-24.png', x: 2481, y: 675, w: 38, h: 53, base: 728 },
  { src: 'ov-25.png', x: 2303, y: 673, w: 31, h: 31, base: 704 },
];

// ⛱ CLICKABLE PARASOLS. NOT baked into the plate (a baked open one would show
// through a folded one), NO baked shadow (the page fades a DOM shadow with the
// state). Both sprites share a bottom-centre pole, so the page anchors there;
// `w/h` size the OPEN box, `cw/ch` the folded sprite drawn at the same scale.
export const UMBRELLAS = [
  { color: 'yellow', open: 'umb-yellow-open.png', closed: 'umb-yellow-closed.png', x: 1211, y: 408, w: 108, h: 140, cw: 35, ch: 115, base: 548 },
  { color: 'blue', open: 'umb-blue-open.png', closed: 'umb-blue-closed.png', x: 376, y: 880, w: 108, h: 140, cw: 35, ch: 115, base: 1020 },
  { color: 'green', open: 'umb-green-open.png', closed: 'umb-green-closed.png', x: 286, y: 480, w: 108, h: 140, cw: 35, ch: 115, base: 620 },
];

// the dock: drawn ABOVE the animated sea but BELOW anything that walks, because
// a floor must never occlude someone standing on it.
export const PIER_SPRITE = { x: 1812, y: 60, w: 156, h: 258 };

// 🎡 the midway. Each entry is where a stall's COUNTER is — the page hangs a
// sign above it and opens that stall's view when you tap it.
export const STALLS = [
  { x: 2140, y: 500 },
  { x: 2430, y: 500 },
  { x: 2140, y: 940 },
  { x: 2430, y: 940 },
];

// 🕹 the claw machine at the seaward end of the pier — the midway's one
// landmark and the only place tickets buy the grand prize.
export const GRABBER = { x: 2648, y: 700 };
