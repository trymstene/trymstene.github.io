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
// wisp (a small one, rising and gone). fps is its own frame rate.
export const GHOSTS = [
  // wanders the square's south edge and fades when you come near
  { id: 'drift',  art: 'drift',  fps: 6, path: [[760, 985], [1440, 985]], speed: 20, near: 96 },
  // sits on the east bench of the square; walk up and tap for a line
  { id: 'sit',    art: 'ghostf', fps: 5, at: [1240, 1030], tap: 1 },
  // sets off from the fountain toward the alley behind the café, and is gone — and where it
  // went, there is something on the ground
  { id: 'lead',   art: 'ghost',  fps: 6, from: [1160, 950], to: [2040, 1090], speed: 34, leaves: 'object' },
  // stands at the hall door, leaning at it, and the door does not open
  { id: 'knock',  art: 'ghostf', fps: 5, at: [1100, 600], bob: 1 },
  // by the fountain, waving at nobody, over and over
  { id: 'repeat', art: 'ghostw', fps: 7, at: [1010, 905] },
  // over the statue, rising and gone, rising and gone
  { id: 'wisp',   art: 'wisp',   fps: 6, at: [1416, 300], loop: 1 },
];
export const NIGHT_GHOSTS = {
  hush: ['drift', 'wisp'],
  creep: ['drift', 'sit', 'knock', 'wisp'],
  deep: ['drift', 'sit', 'lead', 'knock', 'repeat', 'wisp'],
};
export const DAY_GHOSTS = ['wisp'];
