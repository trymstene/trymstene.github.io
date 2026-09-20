// 🏘️ TOWN LIFE — what can be WRONG with the town, and where (14 Sep 2026).
//
// A problem is YOURS: the set a player sees today is seeded by (player, day, band) in
// town-room.js, so one tireless banana cannot fix the town out from under everybody
// else, and nobody arrives to find nothing left (docs/town-life-plan.md §3). What every
// player has in common is the band; what every fix feeds is the shared Town Life.
//
// A row is a TYPE: which anchors it can attach to, what pays, which bands it belongs to,
// and (for `leaves`) the weather it needs. The LOOK — a state sprite over the prop, or a
// swap — is decided by the type's id in town-room.js. Adding a problem is adding a row.
const ALL = ['abandoned', 'struggling', 'recovering', 'lively', 'thriving'];
const LOW = ['abandoned', 'struggling', 'recovering'];

export const PROBLEMS = [
  { id: 'lamp',     on: 'lamps',    pays: [3, 5], rep: 2, bands: ALL },   // a dark or stuttering street lamp
  { id: 'litter',   on: 'street',   pays: [2, 3], rep: 1, bands: ALL },   // rubbish on the cobbles
  { id: 'bin',      on: 'bins',     pays: [3, 5], rep: 2, bands: ALL },   // a street bin, overflowing (the square's, the terrace's two)
  { id: 'dumpster', on: 'dumps',    pays: [5, 7], rep: 3, bands: ALL },   // a dumpster open and full of bags — emptied and closed
  { id: 'graffiti', on: 'walls',    pays: [4, 6], rep: 2, bands: LOW },   // a tag on a shopfront
  { id: 'fountain', on: 'fountain', pays: [5, 6], rep: 3, bands: ['abandoned', 'struggling'] },   // the fountain has run dry
  { id: 'shutter',  on: 'shops',    pays: [4, 6], rep: 3, bands: ALL },   // a kiosk with its shutter down (a low band's, or today's closure — always fixable)
  { id: 'crows',    on: 'perches',  pays: [2, 4], rep: 1, bands: ALL },   // crows where they should not be
  { id: 'leaves',   on: 'street',   pays: [2, 4], rep: 1, bands: ALL, wx: 'storm' },   // what the storm left behind
];

// the anchors, in world px. `street` and `walls` carry (x, base); a wall row also names the
// building so a tag sits on its front. `lamps`, `bin`, `fountain` and `kiosks` are the props'
// own keys (OVERLAYS carries them since 14 Sep) and town-room.js reads the position from
// the placed prop, so they never drift from the plate.
export const ANCHORS = {
  // 🗑 WHERE RUBBISH MAY LIE, and it is DERIVED, not eyeballed (20 Sep 2026). Trym: "for garbage
  // its nice to use the whole town to spread it around, but not behind buildings where users cant see
  // them." So these are a grid laid over the street rectangles in town-geo.js, with every spot inside a
  // tall overlay's box thrown away, thinned to 150 px apart and then jittered so they do not read as a
  // line painted down the middle of the road. Twenty spots across the whole town, against the fifteen
  // hand-picked ones that were here before — and the 150 px floor is what makes two bin bags in one
  // place impossible by construction rather than by luck.
  street: [[206, 581], [448, 588], [808, 595], [1050, 602], [1292, 582], [1652, 589], [1894, 596], [429, 1083], [671, 1063], [1031, 1070], [1391, 1077], [1633, 1084], [1875, 1064], [747, 815], [830, 1008], [954, 829], [1196, 809], [1202, 1002], [1444, 823], [1122, 1248]],
  // ⚠️ A WALL SPOT SITS A FEW PIXELS INSIDE ITS BUILDING'S EAST FACE, so the paint is ON the wall and
  // the player stands on the ground beside it. The store's and the print shop's always did (4 px of
  // masonry, open street behind you); the post office's and the arcade's were 46 px and 22 px DEEP
  // INSIDE their own footprints — the same defect as the crows on the fountain, found by the same gate
  // the day that one was reported. Measured: 6 px in, with 47% of the reach disc walkable, which is
  // what the two that always worked score.
  walls: [[560, 1000, 'store'], [1700, 1000, 'print'], [1832, 520, 'post'], [576, 520, 'condo']],
  // a perch is a SURFACE of a prop, measured on the plate by the builder's twin of this table in
  // tools/… (the top of each bench at its middle, the cart's umbrella, the shelter's roof, the
  // board's rail, the fountain's upper rim) plus the crow's own feet offset, named so the sprite
  // can outrank the prop. Benches first: that is where crows sit (Trym, 14 Sep).
  // ❌ AND THE FOUNTAIN'S RIM IS NOT ONE. Trym, 20 Sep 2026: "cant seem to touch these crows as the
  // fountain barrier is in the way, so maybe the crows should be moved somewhere else." Measured, and
  // he is right in the way that counts: the fountain is a 92 px circle with a second one inside it, and
  // the only ground within a crow's 74 px reach is a 14 px crescent you have to find between the two
  // walls — 51% of the reach disc is walkable, against 78–100% for every other anchor in this file. A
  // chore with one place to stand and no way to see where it is, is not a chore.
  // tools/check-town-lanes.mjs holds the rule now: room to stand, at every anchor, or it is not one.
  perches: [[960, 1000, 'benchsq0'], [1240, 1000, 'benchsq1'], [960, 588, 'benchh0'], [1240, 588, 'benchh1'], [1500, 423, 'benchm'], [1600, 711, 'benchc0'], [1860, 711, 'benchc1'], [610, 711, 'benchg'], [1670, 1133, 'bencht0'], [1870, 1133, 'bencht1'], [1472, 891, 'cart'], [2060, 224, 'bus'], [800, 866, 'board']],
  lamps: ['lamp0', 'lamp1', 'lamp2', 'lamp3', 'lamp4', 'lamp5', 'lamp6', 'lamp7'],
  shops: ['cafe', 'info', 'store'],   // every front that can be shut (today.js CLOSABLE) — renamed from `kiosks` when the store joined
  bins: ['bin', 'bin1', 'bin2'],
  dumps: ['dump0', 'dump1'],
  fountain: ['fountain'],
};
