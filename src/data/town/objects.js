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
  // ⚠️ SMALL things, and things that read cursed on their own (Trym, 15 Sep: a garden chair was "very strange") — a
  // teddy on the cobbles, a backpack nobody dropped, a mirror, a clock; the homestead's decor catalogue still, so a
  // find is a real thing at home
  { id: 'humlantern',   decor: 'lantern2',    rarity: 'common',   fx: 'hum',     where: ['alley', 'terrace'] },
  { id: 'coldfire',     decor: 'campfire',    rarity: 'common',   fx: 'flicker', where: ['square', 'terrace'] },
  { id: 'stillbear',    decor: 'teddy',       rarity: 'common',   fx: 'still',   where: ['alley', 'garden', 'square'] },
  { id: 'lostpack',     decor: 'backpack',    rarity: 'common',   fx: 'still',   where: ['alley', 'square', 'orchard'] },
  { id: 'coldurn',      decor: 'whitevase',   rarity: 'uncommon', fx: 'hum',     where: ['garden', 'monument'] },
  { id: 'redcap',       decor: 'mushrooms',   rarity: 'uncommon', fx: 'flicker', where: ['orchard', 'alley'] },
  { id: 'tinwalker',    decor: 'robottoy',    rarity: 'uncommon', fx: 'turn',    where: ['square', 'terrace'] },
  { id: 'emptymirror',  decor: 'floormirror', rarity: 'rare',     fx: 'turn',    where: ['alley', 'garden'] },
  { id: 'stoppedclock', decor: 'gclock',      rarity: 'rare',     fx: 'hum',     where: ['monument', 'square'] },
  { id: 'lastlamp',     decor: 'tlantern',    rarity: 'rare',     fx: 'hum',     where: ['monument', 'terrace'] },
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
