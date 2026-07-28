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
  [1547, 440, 1573, 476],   // palm tree
  [1623, 476, 1649, 512],   // palm tree
  [1405, 820, 1431, 856],   // palm tree
  [1580, 638, 1822, 748],   // ship bar
  [1234, 806, 1258, 812],   // white cartel
  [1735, 378, 1761, 384],   // blue cartel 2
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
  [2144, 686, 2216, 710],   // benched table 2
  [2326, 668, 2394, 688],   // square bench
  [1993, 438, 2063, 458],   // pier crates 4
  [1995, 602, 2057, 618],   // pier barrel 3
  [2053, 984, 2127, 998],   // pier barrel 4
  [2575, 984, 2649, 1002],   // pier crates 5
  [666, 834, 1194, 854],   // THE NET — solid; you go AROUND the poles
];

export const OB_CIRCLES = [
  [250, 424, 13],   // yellow parasol pole
  [566, 444, 13],   // green parasol pole
  [900, 420, 13],   // blue parasol pole
  [452, 754, 10],   // direction pole small
  [1470, 630, 10],   // direction pole big
  [2180, 648, 13],   // umbrella 3
  [2552, 640, 13],   // umbrella 2
  [2540, 690, 15],   // street food table 1
  [2044, 786, 11],   // trashbin 7
  [2236, 596, 11],   // trashbin 9
  [2640, 890, 11],   // trashbin 8
  [455, 930, 11],   // sign 7
  [215, 655, 48],   // the bonfire ring
];

export const CHAIRS = [
  { rect: [156, 404, 226, 458], seat: { x: 190, y: 448 } },   // sunbed 5
  { rect: [470, 420, 540, 474], seat: { x: 504, y: 464 } },   // sunbed 1
  { rect: [594, 412, 664, 466], seat: { x: 628, y: 456 } },   // sunbed 9
  { rect: [808, 394, 878, 448], seat: { x: 842, y: 438 } },   // sunbed 2
];

// ⭐ Y-SORTED PROP LAYER. Each of these is ALSO baked into the plate; the page
// redraws it on top and sorts it against everything that walks by comparing
// `base` (the prop's ground line) to the walker's y. That's what lets you pass
// in FRONT of a palm's roots and BEHIND its canopy. A prop baked only into the
// plate can never draw in front of anything.
export const OVERLAYS = [
  { src: 'ov-0.png', x: 52, y: 399, w: 136, h: 161, base: 560 },
  { src: 'ov-1.png', x: 128, y: 351, w: 136, h: 161, base: 512 },
  { src: 'ov-2.png', x: 1492, y: 315, w: 136, h: 161, base: 476 },
  { src: 'ov-3.png', x: 1568, y: 351, w: 136, h: 161, base: 512 },
  { src: 'ov-4.png', x: 1350, y: 695, w: 136, h: 161, base: 856 },
  { src: 'ov-5.png', x: 1911, y: 385, w: 95, h: 67, base: 452 },
  { src: 'ov-6.png', x: 1887, y: 445, w: 95, h: 67, base: 512 },
  { src: 'ov-7.png', x: 1883, y: 879, w: 95, h: 67, base: 946 },
  { src: 'ov-8.png', x: 1865, y: 931, w: 95, h: 67, base: 998 },
  { src: 'ov-9.png', x: 1572, y: 563, w: 256, h: 177, base: 740 },
  { src: 'ov-10.png', x: 556, y: 437, w: 28, h: 33, base: 470 },
  { src: 'ov-11.png', x: 524, y: 328, w: 72, h: 72, base: 400 },
  { src: 'ov-12.png', x: 212, y: 95, w: 40, h: 63, base: 158 },
  { src: 'ov-13.png', x: 277, y: 192, w: 47, h: 44, base: 236 },
  { src: 'ov-14.png', x: 333, y: 156, w: 47, h: 44, base: 200 },
  { src: 'ov-15.png', x: 1229, y: 734, w: 35, h: 78, base: 812 },
  { src: 'ov-16.png', x: 1726, y: 312, w: 45, h: 72, base: 384 },
  { src: 'ov-17.png', x: 430, y: 692, w: 44, h: 62, base: 754 },
  { src: 'ov-18.png', x: 1448, y: 541, w: 44, h: 89, base: 630 },
  { src: 'ov-19.png', x: 1189, y: 817, w: 95, h: 67, base: 884 },
  { src: 'ov-20.png', x: 1313, y: 854, w: 51, h: 40, base: 894 },
  { src: 'ov-21.png', x: 1443, y: 719, w: 95, h: 67, base: 786 },
  { src: 'ov-22.png', x: 1825, y: 108, w: 22, h: 24, base: 132 },
  { src: 'ov-23.png', x: 1933, y: 108, w: 22, h: 24, base: 132 },
  { src: 'ov-24.png', x: 1825, y: 188, w: 22, h: 24, base: 212 },
  { src: 'ov-25.png', x: 1933, y: 188, w: 22, h: 24, base: 212 },
  { src: 'ov-26.png', x: 112, y: 589, w: 31, h: 44, base: 633 },
  { src: 'ov-27.png', x: 288, y: 589, w: 31, h: 44, base: 633 },
  { src: 'ov-28.png', x: 112, y: 659, w: 31, h: 44, base: 703 },
  { src: 'ov-29.png', x: 288, y: 659, w: 31, h: 44, base: 703 },
  { src: 'ov-30.png', x: -21, y: 675, w: 95, h: 67, base: 742 },
  { src: 'ov-31.png', x: 41, y: 534, w: 51, h: 40, base: 574 },
  { src: 'ov-32.png', x: 99, y: 469, w: 95, h: 67, base: 536 },
  { src: 'ov-33.png', x: 207, y: 453, w: 95, h: 67, base: 520 },
  { src: 'ov-34.png', x: 2061, y: 366, w: 158, h: 134, base: 500 },
  { src: 'ov-35.png', x: 2057, y: 454, w: 166, h: 50, base: 503 },
  { src: 'ov-36.png', x: 2351, y: 366, w: 158, h: 134, base: 500 },
  { src: 'ov-37.png', x: 2347, y: 454, w: 166, h: 50, base: 503 },
  { src: 'ov-38.png', x: 2061, y: 806, w: 158, h: 134, base: 940 },
  { src: 'ov-39.png', x: 2057, y: 894, w: 166, h: 50, base: 943 },
  { src: 'ov-40.png', x: 2351, y: 806, w: 158, h: 134, base: 940 },
  { src: 'ov-41.png', x: 2347, y: 894, w: 166, h: 50, base: 943 },
  { src: 'ov-42.png', x: 2599, y: 546, w: 98, h: 154, base: 700 },
  { src: 'ov-43.png', x: 2231, y: 330, w: 119, h: 136, base: 466 },
  { src: 'ov-44.png', x: 2551, y: 350, w: 119, h: 136, base: 486 },
  { src: 'ov-45.png', x: 2229, y: 776, w: 123, h: 134, base: 910 },
  { src: 'ov-46.png', x: 1956, y: 592, w: 128, h: 134, base: 726 },
  { src: 'ov-47.png', x: 2508, y: 810, w: 105, h: 120, base: 930 },
  { src: 'ov-48.png', x: 2138, y: 537, w: 85, h: 111, base: 648 },
  { src: 'ov-49.png', x: 2138, y: 631, w: 84, h: 81, base: 712 },
  { src: 'ov-50.png', x: 2320, y: 622, w: 80, h: 68, base: 690 },
  { src: 'ov-51.png', x: 2343, y: 591, w: 35, h: 47, base: 638 },
  { src: 'ov-52.png', x: 2288, y: 655, w: 32, h: 47, base: 702 },
  { src: 'ov-53.png', x: 2400, y: 655, w: 32, h: 47, base: 702 },
  { src: 'ov-54.png', x: 2510, y: 529, w: 85, h: 111, base: 640 },
  { src: 'ov-55.png', x: 2519, y: 617, w: 43, h: 73, base: 690 },
  { src: 'ov-56.png', x: 2523, y: 678, w: 34, h: 34, base: 712 },
  { src: 'ov-57.png', x: 1996, y: 794, w: 41, h: 62, base: 856 },
  { src: 'ov-58.png', x: 2190, y: 749, w: 41, h: 51, base: 800 },
  { src: 'ov-59.png', x: 2029, y: 731, w: 30, h: 55, base: 786 },
  { src: 'ov-60.png', x: 2220, y: 543, w: 32, h: 53, base: 596 },
  { src: 'ov-61.png', x: 2625, y: 835, w: 30, h: 55, base: 890 },
  { src: 'ov-62.png', x: 1993, y: 392, w: 70, h: 68, base: 460 },
  { src: 'ov-63.png', x: 1995, y: 565, w: 63, h: 55, base: 620 },
  { src: 'ov-64.png', x: 2053, y: 952, w: 75, h: 48, base: 1000 },
  { src: 'ov-65.png', x: 2575, y: 946, w: 75, h: 58, base: 1004 },
  { src: 'ov-66.png', x: 271, y: 647, w: 19, h: 14, base: 661 },
  { src: 'ov-67.png', x: 248, y: 667, w: 26, h: 17, base: 684 },
  { src: 'ov-68.png', x: 211, y: 682, w: 28, h: 14, base: 696 },
  { src: 'ov-69.png', x: 173, y: 675, w: 24, h: 17, base: 692 },
  { src: 'ov-70.png', x: 146, y: 654, w: 22, h: 19, base: 673 },
  { src: 'ov-71.png', x: 141, y: 635, w: 19, h: 14, base: 649 },
  { src: 'ov-72.png', x: 156, y: 609, w: 26, h: 17, base: 626 },
  { src: 'ov-73.png', x: 191, y: 600, w: 28, h: 14, base: 614 },
  { src: 'ov-74.png', x: 233, y: 601, w: 24, h: 17, base: 618 },
  { src: 'ov-75.png', x: 262, y: 618, w: 22, h: 19, base: 637 },
  { src: 'ov-76.png', x: 41, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-77.png', x: 93, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-78.png', x: 145, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-79.png', x: 753, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-80.png', x: 823, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-81.png', x: 893, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-82.png', x: 963, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-83.png', x: 1033, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-84.png', x: 1103, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-85.png', x: 1481, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-86.png', x: 1547, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-87.png', x: 1613, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-88.png', x: 1679, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-89.png', x: 1745, y: 1074, w: 38, h: 22, base: 1096 },
  { src: 'ov-90.png', x: 1811, y: 1058, w: 38, h: 38, base: 1096 },
  { src: 'ov-91.png', x: 437, y: 862, w: 37, h: 68, base: 930 },
];

// ⛱ CLICKABLE PARASOLS. NOT baked into the plate (a baked open one would show
// through a folded one), NO baked shadow (the page fades a DOM shadow with the
// state). Both sprites share a bottom-centre pole, so the page anchors there;
// `w/h` size the OPEN box, `cw/ch` the folded sprite drawn at the same scale.
export const UMBRELLAS = [
  { color: 'yellow', open: 'umb-yellow-open.png', closed: 'umb-yellow-closed.png', x: 196, y: 284, w: 108, h: 140, cw: 35, ch: 115, base: 424 },
  { color: 'green', open: 'umb-green-open.png', closed: 'umb-green-closed.png', x: 512, y: 304, w: 108, h: 140, cw: 35, ch: 115, base: 444 },
  { color: 'blue', open: 'umb-blue-open.png', closed: 'umb-blue-closed.png', x: 846, y: 280, w: 108, h: 140, cw: 35, ch: 115, base: 420 },
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

// 🧭 the waypost at the park lane — the DOM plank that names it hangs here
export const PARK_SIGN = { x: 455, y: 930 };
