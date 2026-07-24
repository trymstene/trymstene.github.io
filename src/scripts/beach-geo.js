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
// 🔥 the fire circle's centre — the page stands an animated flame here and
// pools warm light around it. Its walk collider is in OB_CIRCLES as usual.
export const BONFIRE = { x: 215, y: 655 };

export const OB_RECTS = [
  [107, 524, 133, 560],   // palm tree
  [183, 476, 209, 512],   // palm tree
  [255, 434, 281, 470],   // palm tree
  [587, 1010, 613, 1046],   // palm tree
  [1535, 450, 1561, 486],   // palm tree
  [1595, 488, 1621, 524],   // palm tree
  [1887, 614, 1913, 650],   // palm tree
  [1580, 638, 1822, 748],   // ship bar
  [1296, 436, 1324, 442],   // white cartel
  [1704, 404, 1736, 410],   // blue cartel 2
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
  [618, 566, 13],   // yellow parasol pole
  [600, 664, 13],   // green parasol pole
  [582, 758, 13],   // blue parasol pole
  [524, 838, 13],   // direction pole small
  [1286, 726, 13],   // direction pole big
  [2360, 690, 13],   // street food table 2
  [2500, 728, 13],   // street food table 4
  [2318, 704, 13],   // street food chair 1
  [215, 655, 48],   // the bonfire ring
];

export const CHAIRS = [
  { rect: [812, 376, 882, 430], seat: { x: 846, y: 420 } },   // sunbed 5
  { rect: [910, 362, 980, 416], seat: { x: 944, y: 406 } },   // sunbed 1
  { rect: [1002, 382, 1072, 436], seat: { x: 1036, y: 426 } },   // sunbed 9
];

// ⭐ Y-SORTED PROP LAYER. Each of these is ALSO baked into the plate; the page
// redraws it on top and sorts it against everything that walks by comparing
// `base` (the prop's ground line) to the walker's y. That's what lets you pass
// in FRONT of a palm's roots and BEHIND its canopy. A prop baked only into the
// plate can never draw in front of anything.
export const OVERLAYS = [
  { src: 'ov-0.png', x: 52, y: 399, w: 136, h: 161, base: 560 },
  { src: 'ov-1.png', x: 128, y: 351, w: 136, h: 161, base: 512 },
  { src: 'ov-2.png', x: 200, y: 309, w: 136, h: 161, base: 470 },
  { src: 'ov-3.png', x: 532, y: 885, w: 136, h: 161, base: 1046 },
  { src: 'ov-4.png', x: 1480, y: 325, w: 136, h: 161, base: 486 },
  { src: 'ov-5.png', x: 1540, y: 363, w: 136, h: 161, base: 524 },
  { src: 'ov-6.png', x: 1832, y: 489, w: 136, h: 161, base: 650 },
  { src: 'ov-7.png', x: 1911, y: 385, w: 95, h: 67, base: 452 },
  { src: 'ov-8.png', x: 1887, y: 445, w: 95, h: 67, base: 512 },
  { src: 'ov-9.png', x: 1921, y: 493, w: 95, h: 67, base: 560 },
  { src: 'ov-10.png', x: 1899, y: 879, w: 95, h: 67, base: 946 },
  { src: 'ov-11.png', x: 1923, y: 931, w: 95, h: 67, base: 998 },
  { src: 'ov-12.png', x: 2113, y: 939, w: 95, h: 67, base: 1006 },
  { src: 'ov-13.png', x: 2373, y: 943, w: 95, h: 67, base: 1010 },
  { src: 'ov-14.png', x: 2613, y: 939, w: 95, h: 67, base: 1006 },
  { src: 'ov-15.png', x: 1572, y: 563, w: 256, h: 177, base: 740 },
  { src: 'ov-16.png', x: 1453, y: 663, w: 95, h: 67, base: 730 },
  { src: 'ov-17.png', x: 1499, y: 715, w: 95, h: 67, base: 782 },
  { src: 'ov-18.png', x: 986, y: 411, w: 28, h: 33, base: 444 },
  { src: 'ov-19.png', x: 524, y: 328, w: 72, h: 72, base: 400 },
  { src: 'ov-20.png', x: 1100, y: 119, w: 40, h: 63, base: 182 },
  { src: 'ov-21.png', x: 277, y: 192, w: 47, h: 44, base: 236 },
  { src: 'ov-22.png', x: 333, y: 156, w: 47, h: 44, base: 200 },
  { src: 'ov-23.png', x: 1287, y: 339, w: 47, h: 103, base: 442 },
  { src: 'ov-24.png', x: 1690, y: 314, w: 60, h: 96, base: 410 },
  { src: 'ov-25.png', x: 486, y: 729, w: 77, h: 109, base: 838 },
  { src: 'ov-26.png', x: 1247, y: 568, w: 78, h: 158, base: 726 },
  { src: 'ov-27.png', x: 1185, y: 681, w: 95, h: 67, base: 748 },
  { src: 'ov-28.png', x: 1193, y: 805, w: 95, h: 67, base: 872 },
  { src: 'ov-29.png', x: 1445, y: 472, w: 51, h: 40, base: 512 },
  { src: 'ov-30.png', x: 1825, y: 108, w: 22, h: 24, base: 132 },
  { src: 'ov-31.png', x: 1933, y: 108, w: 22, h: 24, base: 132 },
  { src: 'ov-32.png', x: 1825, y: 188, w: 22, h: 24, base: 212 },
  { src: 'ov-33.png', x: 1933, y: 188, w: 22, h: 24, base: 212 },
  { src: 'ov-34.png', x: 112, y: 589, w: 31, h: 44, base: 633 },
  { src: 'ov-35.png', x: 288, y: 589, w: 31, h: 44, base: 633 },
  { src: 'ov-36.png', x: 112, y: 659, w: 31, h: 44, base: 703 },
  { src: 'ov-37.png', x: 288, y: 659, w: 31, h: 44, base: 703 },
  { src: 'ov-38.png', x: -21, y: 675, w: 95, h: 67, base: 742 },
  { src: 'ov-39.png', x: -17, y: 583, w: 95, h: 67, base: 650 },
  { src: 'ov-40.png', x: 41, y: 534, w: 51, h: 40, base: 574 },
  { src: 'ov-41.png', x: 99, y: 469, w: 95, h: 67, base: 536 },
  { src: 'ov-42.png', x: 191, y: 457, w: 95, h: 67, base: 524 },
  { src: 'ov-43.png', x: 289, y: 504, w: 47, h: 44, base: 548 },
  { src: 'ov-44.png', x: 353, y: 533, w: 95, h: 67, base: 600 },
  { src: 'ov-45.png', x: 363, y: 763, w: 95, h: 67, base: 830 },
  { src: 'ov-46.png', x: 2061, y: 366, w: 158, h: 134, base: 500 },
  { src: 'ov-47.png', x: 2057, y: 454, w: 166, h: 50, base: 503 },
  { src: 'ov-48.png', x: 2351, y: 366, w: 158, h: 134, base: 500 },
  { src: 'ov-49.png', x: 2347, y: 454, w: 166, h: 50, base: 503 },
  { src: 'ov-50.png', x: 2061, y: 806, w: 158, h: 134, base: 940 },
  { src: 'ov-51.png', x: 2057, y: 894, w: 166, h: 50, base: 943 },
  { src: 'ov-52.png', x: 2351, y: 806, w: 158, h: 134, base: 940 },
  { src: 'ov-53.png', x: 2347, y: 894, w: 166, h: 50, base: 943 },
  { src: 'ov-54.png', x: 2601, y: 548, w: 94, h: 152, base: 700 },
  { src: 'ov-55.png', x: 2231, y: 330, w: 119, h: 136, base: 466 },
  { src: 'ov-56.png', x: 2551, y: 350, w: 119, h: 136, base: 486 },
  { src: 'ov-57.png', x: 2229, y: 776, w: 123, h: 134, base: 910 },
  { src: 'ov-58.png', x: 1956, y: 592, w: 128, h: 134, base: 726 },
  { src: 'ov-59.png', x: 2508, y: 810, w: 105, h: 120, base: 930 },
  { src: 'ov-60.png', x: 2341, y: 635, w: 38, h: 55, base: 690 },
  { src: 'ov-61.png', x: 2481, y: 675, w: 38, h: 53, base: 728 },
  { src: 'ov-62.png', x: 2303, y: 673, w: 31, h: 31, base: 704 },
  { src: 'ov-63.png', x: 271, y: 647, w: 19, h: 14, base: 661 },
  { src: 'ov-64.png', x: 248, y: 667, w: 26, h: 17, base: 684 },
  { src: 'ov-65.png', x: 211, y: 682, w: 28, h: 14, base: 696 },
  { src: 'ov-66.png', x: 173, y: 675, w: 24, h: 17, base: 692 },
  { src: 'ov-67.png', x: 146, y: 654, w: 22, h: 19, base: 673 },
  { src: 'ov-68.png', x: 141, y: 635, w: 19, h: 14, base: 649 },
  { src: 'ov-69.png', x: 156, y: 609, w: 26, h: 17, base: 626 },
  { src: 'ov-70.png', x: 191, y: 600, w: 28, h: 14, base: 614 },
  { src: 'ov-71.png', x: 233, y: 601, w: 24, h: 17, base: 618 },
  { src: 'ov-72.png', x: 262, y: 618, w: 22, h: 19, base: 637 },
  { src: 'ov-73.png', x: 41, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-74.png', x: 93, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-75.png', x: 145, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-76.png', x: 753, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-77.png', x: 823, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-78.png', x: 893, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-79.png', x: 963, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-80.png', x: 1033, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-81.png', x: 1103, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-82.png', x: 1481, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-83.png', x: 1547, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-84.png', x: 1613, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-85.png', x: 1679, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-86.png', x: 1745, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-87.png', x: 1811, y: 1058, w: 38, h: 38, base: 1096 },
];

// ⛱ CLICKABLE PARASOLS. NOT baked into the plate (a baked open one would show
// through a folded one), NO baked shadow (the page fades a DOM shadow with the
// state). Both sprites share a bottom-centre pole, so the page anchors there;
// `w/h` size the OPEN box, `cw/ch` the folded sprite drawn at the same scale.
export const UMBRELLAS = [
  { color: 'yellow', open: 'umb-yellow-open.png', closed: 'umb-yellow-closed.png', x: 564, y: 426, w: 108, h: 140, cw: 35, ch: 115, base: 566 },
  { color: 'green', open: 'umb-green-open.png', closed: 'umb-green-closed.png', x: 546, y: 524, w: 108, h: 140, cw: 35, ch: 115, base: 664 },
  { color: 'blue', open: 'umb-blue-open.png', closed: 'umb-blue-closed.png', x: 528, y: 618, w: 108, h: 140, cw: 35, ch: 115, base: 758 },
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
