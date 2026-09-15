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
  { id: 'shutter',  on: 'kiosks',   pays: [4, 6], rep: 3, bands: ALL },   // a kiosk with its shutter down (a low band's, or today's closure — always fixable)
  { id: 'crows',    on: 'perches',  pays: [2, 4], rep: 1, bands: ALL },   // crows where they should not be
  { id: 'leaves',   on: 'street',   pays: [2, 4], rep: 1, bands: ALL, wx: 'storm' },   // what the storm left behind
];

// the anchors, in world px. `street` and `walls` carry (x, base); a wall row also names the
// building so a tag sits on its front. `lamps`, `bin`, `fountain` and `kiosks` are the props'
// own keys (OVERLAYS carries them since 14 Sep) and town-room.js reads the position from
// the placed prop, so they never drift from the plate.
export const ANCHORS = {
  street: [[1180, 985], [1300, 850], [900, 650], [1350, 640], [1650, 1100], [1860, 1120], [560, 620], [1560, 620],
    [800, 1100], [1440, 1100], [320, 900], [1990, 900], [1100, 1190], [1230, 830], [980, 830]],
  walls: [[560, 1000, 'store'], [1700, 1000, 'print'], [1780, 520, 'post'], [400, 520, 'condo']],
  // a perch is a SURFACE of a prop, measured on the plate by the builder's twin of this table in
  // tools/… (the top of each bench at its middle, the cart's umbrella, the shelter's roof, the
  // board's rail, the fountain's upper rim) plus the crow's own feet offset, named so the sprite
  // can outrank the prop. Benches first: that is where crows sit (Trym, 14 Sep).
  perches: [[960, 1000, 'benchsq0'], [1240, 1000, 'benchsq1'], [960, 588, 'benchh0'], [1240, 588, 'benchh1'], [1500, 423, 'benchm'], [1600, 711, 'benchc0'], [1860, 711, 'benchc1'], [610, 711, 'benchg'], [1670, 1133, 'bencht0'], [1870, 1133, 'bencht1'], [1472, 891, 'cart'], [2060, 224, 'bus'], [800, 866, 'board'], [1100, 768, 'fountain']],
  lamps: ['lamp0', 'lamp1', 'lamp2', 'lamp3', 'lamp4', 'lamp5', 'lamp6', 'lamp7'],
  kiosks: ['cafe', 'info'],
  bins: ['bin', 'bin1', 'bin2'],
  dumps: ['dump0', 'dump1'],
  fountain: ['fountain'],
};
