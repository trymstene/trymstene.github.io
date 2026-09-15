// 🏘️ TOWN LIFE — the GHOSTS, as behaviours (14 Sep 2026).
//
// Measured 30 Aug: 3.8% of players ever dodge the world's one hazard. So a ghost is
// curiosity, never danger: nothing chases you and nothing hurts. A row is a behaviour —
// where it is, what it does, which sprite it wears — and the night's tier says which rows
// are out (docs/town-life-plan.md §7). Friendly sprites only; the graveyard-literal set
// (crosses, coffins, blood) is cut, and this stays Banana World.
//
// art = a STATE key from the scene builder (s-<key>-N.png): ghost (floating, facing
// right), ghostf (facing front), ghostw (waving), drift (the tall grey one that fades),
// wisp (a small one, rising and gone), ghost4 (the friendly one with all four facings in one stack: right 0-7,
// back 8-15, left 16-23, front 24-31 — a ROAMER faces where it goes). fps is its own frame rate.
// ⚠️ every spot is MEASURED against the prop boxes (15 Sep: the drift walked behind the board and the cart, the
// sitter was under the east bench and its tree, the leader ended behind the café dumpster, the wisp rose behind
// the statue — the walk gates it now). z: draw depth when a ghost must sit ON a thing (in front of it).
// where a roamer goes next: spread over the whole town and MEASURED clear of every prop and solid (the finder, 15 Sep)
export const ROAM = [[620, 480], [1320, 480], [1520, 480], [820, 580], [1120, 580], [1620, 680], [620, 780], [1020, 780], [1320, 880], [920, 980], [1120, 980], [720, 1080], [1620, 1080], [1020, 1180]];
export const GHOSTS = [
  // roams the whole square, waypoint to waypoint with a pause at each, facing where it goes (Trym, 15 Sep)
  { id: 'roam',   art: 'ghost4', fps: 6, roam: 1, speed: 58, at: [1120, 980] },   // speeds up 15 Sep (Trym: "they move very slow, i just take them out")
  { id: 'roam2',  art: 'ghost4', fps: 6, roam: 1, speed: 50, at: [820, 580] },
  // wanders the square's south edge and fades when you come near
  { id: 'drift',  art: 'drift',  fps: 6, path: [[1010, 1160], [1440, 1160]], speed: 20, near: 96 },
  // sits on the east bench of the square; walk up and tap for a line
  { id: 'sit',    art: 'ghostf', fps: 5, at: [1200, 1040], z: 1150, tap: 1 },
  // sets off from the fountain toward the alley behind the café, and is gone — and where it
  // went, there is something on the ground
  { id: 'lead',   art: 'ghost4', fps: 6, from: [1160, 950], to: [1820, 1168], speed: 34, leaves: 'object' },   // to = the alley spot, measured (objects.js WHERE)
  // stands at the hall door, leaning at it, and the door does not open
  { id: 'knock',  art: 'ghostf', fps: 5, at: [1100, 600], bob: 1 },
  // by the fountain, waving at nobody, over and over
  { id: 'repeat', art: 'ghostw', fps: 7, at: [1010, 905] },
  // over the statue, rising and gone, rising and gone
  { id: 'wisp',   art: 'wisp',   fps: 6, at: [1416, 250], z: 335, loop: 1 },
];
// which rows are out: EVERY night has its three (Trym, 15 Sep: "they should show up every night"); a Curse Night
// brings more, and the deep one all of them
export const NIGHT_GHOSTS = {
  night: ['roam', 'drift', 'sit', 'wisp'],
  hush: ['roam', 'drift', 'sit', 'wisp'],
  creep: ['roam', 'roam2', 'drift', 'sit', 'knock', 'wisp'],
  deep: ['roam', 'roam2', 'drift', 'sit', 'lead', 'knock', 'repeat', 'wisp'],
};
export const DAY_GHOSTS = ['wisp'];
