// ✨ SHIMMER'S MECHANICS, AS DESIGNED (the Claude Doc "Shimmer & the Star Map", 2 Oct 2026). The words are
// src/data/copy/shimmer.json; this is which perk sits at which star, what kind it is, and where the titles come.
// Nothing reads it to pay anything yet: the perk bench (src/lib/shimmer-bench.js, ?shimmer) shows how each one looks.

// the six constellations, one per area: forty stars each, a perk at every fourth, a choice at the 20th, the capstone at
// the 40th (no title, ever). `area` is the page a perk works on.
export const LADDER = {
  can: { area: 'park', steps: [[4, 'bigcan'], [8, 'dew'], [12, 'seedback'], [16, 'tidyplots'], [20, 'greenstreak', 'compost'], [24, 'golden'], [28, 'neighbour'], [32, 'raincatch'], [36, 'bloom'], [40, 'cancap']] },
  barn: { area: 'homestead', steps: [[4, 'trough'], [8, 'round'], [12, 'yolk'], [16, 'slowfade'], [20, 'herd', 'richmilk'], [24, 'tidyyard'], [28, 'helping'], [32, 'cattreasure'], [36, 'barnlights'], [40, 'barncap']] },
  clock: { area: 'town', steps: [[4, 'quickfix'], [8, 'firstfix'], [12, 'ghostluck'], [16, 'tallynote'], [20, 'onroll', 'regular'], [24, 'lamplighter'], [28, 'citizen'], [32, 'nightowl'], [36, 'bell'], [40, 'clockcap']] },
  fish: { area: 'beach', steps: [[4, 'hands'], [8, 'catchday'], [12, 'luckyline'], [16, 'comber'], [20, 'hotstreak', 'treasurenose'], [24, 'storm'], [28, 'sharedcatch'], [32, 'ripple'], [36, 'bobber'], [40, 'fishcap']] },
  ball: { area: 'rave', steps: [[4, 'lightfeet'], [8, 'doors'], [12, 'spotlove'], [16, 'jellykeep'], [20, 'filler', 'longpeak'], [24, 'starter'], [28, 'glowrain'], [32, 'peakhour'], [36, 'shadow'], [40, 'ballcap']] },
  hammer: { area: 'forge', steps: [[4, 'colours'], [8, 'spark'], [12, 'canvas'], [16, 'drafts'], [20, 'mirror', 'starframe'], [24, 'praise'], [28, 'layer'], [32, 'signed'], [36, 'approved'], [40, 'hammercap']] },
};
export const ORDER = ['can', 'barn', 'clock', 'fish', 'ball', 'hammer'];   // the copy file's constellations, in its order

// seven kinds, so perks feel different from each other (the capstone is its own)
export const KIND = {
  bigcan: 'comfort', dew: 'daily', seedback: 'lucky', tidyplots: 'comfort', greenstreak: 'streak', compost: 'comfort', golden: 'lucky', neighbour: 'shared', raincatch: 'comfort', bloom: 'shine', cancap: 'capstone',
  trough: 'comfort', round: 'daily', yolk: 'lucky', slowfade: 'comfort', herd: 'streak', richmilk: 'lucky', tidyyard: 'comfort', helping: 'shared', cattreasure: 'lucky', barnlights: 'shine', barncap: 'capstone',
  quickfix: 'comfort', firstfix: 'daily', ghostluck: 'lucky', tallynote: 'comfort', onroll: 'streak', regular: 'comfort', lamplighter: 'shine', citizen: 'shared', nightowl: 'daily', bell: 'shine', clockcap: 'capstone',
  hands: 'comfort', catchday: 'daily', luckyline: 'lucky', comber: 'lucky', hotstreak: 'streak', treasurenose: 'comfort', storm: 'always', sharedcatch: 'shared', ripple: 'lucky', bobber: 'shine', fishcap: 'capstone',
  lightfeet: 'shine', doors: 'daily', spotlove: 'lucky', jellykeep: 'comfort', filler: 'streak', longpeak: 'lucky', starter: 'shared', glowrain: 'lucky', peakhour: 'daily', shadow: 'shine', ballcap: 'capstone',
  colours: 'comfort', spark: 'daily', canvas: 'comfort', drafts: 'comfort', mirror: 'comfort', starframe: 'shine', praise: 'shared', layer: 'comfort', signed: 'shine', approved: 'always', hammercap: 'capstone',
  north: 'capstone',
};
export const STARS_EACH = 40;
export const TITLE_AT = [1, 10, 25, 50, 75, 100, 125, 150, 200, 250];   // the copy file's `titles`, in order
// a Shimmer level costs 150 + 45 × its number in XP, never more than 6 000 (the doc; an open question for Trym)
export const shimmerStep = (n) => Math.min(6000, 150 + 45 * n);
