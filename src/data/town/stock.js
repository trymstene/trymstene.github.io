// 🏘️ TOWN LIFE — what the town SELLS, by how it is doing (14 Sep 2026).
//
// Pip's general store sells things for the player's HOMESTEAD — furniture, decorations,
// household objects, plants — never wearables (docs/town-and-cut-plan.md §4 stands).
// Every id here is a row of src/data/decor.js, the homestead's own catalogue: a buy is
// the homestead's own coin charge and lands in the homestead's own shed or van queue
// (src/lib/homestead-inventory.js). The town mints no currency and keeps no inventory.
//
// The pools are tiers of that catalogue; the SHELF says which tiers a band unlocks and
// how many of each are on the counter today. town-room.js rotates the picks daily with
// the world's day seed, so a Thriving Tuesday is not a Thriving Wednesday.
export const POOLS = {
  basic:  ['sunflower', 'redflower', 'blueflower', 'whiteflower', 'bush', 'bush2', 'mushrooms', 'stump', 'flowerbush', 'trough'],
  common: ['pinkvase', 'bluevase', 'bench', 'chair', 'armchair', 'campfire', 'lantern2', 'crate', 'birdhouse', 'flowerbush2', 'pottedplant', 'tlantern'],
  good:   ['table', 'benchv', 'marshfire', 'scarecrow', 'bananacrate', 'sprout', 'sproutvase', 'birdhouse2', 'readlamp', 'teatable', 'dinette'],
  rare:   ['statue', 'fountain', 'sunvase', 'whitevase', 'famtable', 'dressercurio'],
};
// an Abandoned store is shut (Pip stays in); the counter opens at Struggling with the
// basics and grows with the town
export const SHELF = {
  abandoned: null,
  struggling: { basic: 3 },
  recovering: { basic: 3, common: 2 },
  lively: { basic: 2, common: 2, good: 2 },
  thriving: { basic: 2, common: 2, good: 2, rare: 1 },
};
// 🧳 the travelling merchant: on seeded days from Lively up, a stall nobody else carries,
// at a markup. `share` is the share of eligible days; the day seed picks which.
export const MERCHANT = {
  pool: ['scarecrow', 'statue', 'fountain', 'marshfire', 'birdhouse2', 'sunvase', 'whitevase', 'readlamp', 'dressercurio', 'famtable'],
  n: 3, markup: 1.25, bands: ['lively', 'thriving'], share: 0.35,
  at: [1100, 1090],   // feet: the square's south edge, facing the fountain
};
// 🌑 the night vendor: only on a Curse Night, a short shelf at a discount, and the one who
// buys cursed objects back (src/data/town/objects.js BOUNTY)
export const CURSE_SHELF = { pool: ['lantern2', 'campfire', 'statue', 'mushrooms', 'bush2', 'crate'], n: 2, markup: 0.8, at: [1416, 400] };
