// 🏘️ TOWN LIFE — the CURSED OBJECTS (14 Sep 2026).
//
// A cursed object is an ORDINARY thing with metadata: a row of the homestead's decor
// catalogue (src/data/decor.js), a rarity, where in the town it can turn up, and a small
// cosmetic effect while it lies there. Found, it goes to the homestead as the ordinary
// object — placed at home it is a lantern, a chair, a statue. The ledger of what a player
// has found lives on the pass (cur_<id>, a counter that travels); the night vendor buys
// them back at BOUNTY. The NAMES and the descriptions are copy, never here: the rig's
// town-life job writes them, keyed by these ids (docs/town-life-plan.md §7).
export const OBJECTS = [
  { id: 'humlantern',  decor: 'lantern2',  rarity: 'common',   fx: 'hum',     where: ['alley', 'terrace'] },
  { id: 'coldfire',    decor: 'campfire',  rarity: 'common',   fx: 'flicker', where: ['square', 'terrace'] },
  { id: 'wetchair',    decor: 'chair',     rarity: 'common',   fx: 'still',   where: ['alley', 'garden'] },
  { id: 'drycrate',    decor: 'crate',     rarity: 'common',   fx: 'still',   where: ['alley', 'square'] },
  { id: 'nightbush',   decor: 'bush2',     rarity: 'uncommon', fx: 'hum',     where: ['garden', 'orchard'] },
  { id: 'redcap',      decor: 'mushrooms', rarity: 'uncommon', fx: 'flicker', where: ['orchard', 'alley'] },
  { id: 'emptyhouse',  decor: 'birdhouse', rarity: 'uncommon', fx: 'still',   where: ['orchard', 'garden'] },
  { id: 'watcher',     decor: 'scarecrow', rarity: 'rare',     fx: 'turn',    where: ['orchard'] },
  { id: 'secondangel', decor: 'statue',    rarity: 'rare',     fx: 'turn',    where: ['square', 'monument'] },
  { id: 'lastlamp',    decor: 'tlantern',  rarity: 'rare',     fx: 'hum',     where: ['monument', 'terrace'] },
];
// the spots (feet, world px), by the name a row's `where` uses
export const WHERE = {
  // ⚠️ every spot MEASURED clear of every prop box (15 Sep): the first set sat under the dumpsters, the square
  //    benches, the garden boxes, a tree, the info kiosk — a cursed thing nobody could see. tools: the finder in
  //    the session notes; re-measure when a prop moves
  alley: [[1820,  1168],  [290,  330],  [785,  410]],
  terrace: [[1750,  1230]],
  square: [[1045,  1030],  [1155,  1030]],
  garden: [[1730,  700],  [560,  690]],
  orchard: [[795,  320]],
  monument: [[1505,  260]],
};
export const RARITY_W = { common: 6, uncommon: 3, rare: 1 };
export const BOUNTY = { common: 10, uncommon: 20, rare: 40 };   // what the night vendor pays for one turned in
