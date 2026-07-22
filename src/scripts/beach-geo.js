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
export const WORLD = { w: 2400, h: 1100 };
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
  [0, 306, 250, 980],   // the boardwalk deck
  [317, 434, 343, 470],   // palm tree
  [507, 864, 533, 900],   // palm tree
  [1487, 484, 1513, 520],   // palm tree
  [1317, 1004, 1343, 1040],   // palm tree
  [1997, 864, 2023, 900],   // palm tree
  [587, 492, 613, 528],   // palm tree
  [2277, 604, 2303, 640],   // palm tree
  [1580, 638, 1822, 748],   // ship bar
  [2122, 686, 2240, 778],   // example lighthouse
  [666, 834, 1194, 854],   // THE NET — solid; you go AROUND the poles
];

export const OB_CIRCLES = [
  [1265, 548, 13],   // yellow beach umbrella opened
  [430, 1020, 13],   // blue beach umbrella opened
  [2050, 560, 13],   // green beach umbrella opened
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
  { src: 'ov-0.png', x: 262, y: 309, w: 136, h: 161, base: 470 },
  { src: 'ov-1.png', x: 452, y: 739, w: 136, h: 161, base: 900 },
  { src: 'ov-2.png', x: 1432, y: 359, w: 136, h: 161, base: 520 },
  { src: 'ov-3.png', x: 1262, y: 879, w: 136, h: 161, base: 1040 },
  { src: 'ov-4.png', x: 1942, y: 739, w: 136, h: 161, base: 900 },
  { src: 'ov-5.png', x: 532, y: 367, w: 136, h: 161, base: 528 },
  { src: 'ov-6.png', x: 2222, y: 479, w: 136, h: 161, base: 640 },
  { src: 'ov-7.png', x: 1572, y: 563, w: 256, h: 177, base: 740 },
  { src: 'ov-8.png', x: 2116, y: 488, w: 129, h: 282, base: 770 },
  { src: 'ov-9.png', x: 1211, y: 408, w: 108, h: 140, base: 548 },
  { src: 'ov-10.png', x: 376, y: 880, w: 108, h: 140, base: 1020 },
  { src: 'ov-11.png', x: 1996, y: 420, w: 108, h: 140, base: 560 },
  { src: 'ov-12.png', x: 123, y: 248, w: 94, h: 152, base: 400 },
  { src: 'ov-13.png', x: 91, y: 416, w: 158, h: 134, base: 550 },
  { src: 'ov-14.png', x: 91, y: 556, w: 158, h: 134, base: 690 },
  { src: 'ov-15.png', x: 91, y: 696, w: 158, h: 134, base: 830 },
  { src: 'ov-16.png', x: 91, y: 836, w: 158, h: 134, base: 970 },
];

// the dock: drawn ABOVE the animated sea but BELOW anything that walks, because
// a floor must never occlude someone standing on it.
export const PIER_SPRITE = { x: 1812, y: 60, w: 156, h: 258 };

// 🎡 the midway. Each entry is where a stall's COUNTER is — the page hangs a
// sign above it and opens that stall's view when you tap it.
export const STALLS = [
  { x: 170, y: 550 },
  { x: 170, y: 690 },
  { x: 170, y: 830 },
  { x: 170, y: 970 },
];

// 🕹 the claw machine at the seaward end of the pier — the midway's one
// landmark and the only place tickets buy the grand prize.
export const GRABBER = { x: 170, y: 400 };
