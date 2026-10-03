// ✨ SHIMMER'S MECHANICS, AS DESIGNED (the Claude Doc "Shimmer & the Star Map"). The words are src/data/copy/shimmer.json;
// this is which perk sits at which star, what kind it is, and where the titles come. Nothing reads it to pay anything yet:
// the perk bench (src/lib/shimmer-bench.js, ?shimmer) shows how each one looks.
// 🔧 4 Oct 2026, the perks rewritten (Trym: "You need to know how this game works before you invent perks for it"): every perk
// changes a number or a rule the game already has. The Claude Doc's "Today → with the perk" column names each one.

// the six constellations: five areas and the banana itself. Forty stars each, a perk at every fourth, a choice at the 20th,
// the capstone at the 40th (no title, ever). `area` is the page a perk works on ('' = every area).
export const LADDER = {
  sunflower: { area: 'park', steps: [[4, 'cheapseeds'], [8, 'greenthumb'], [12, 'twoseeds'], [16, 'rarebirds'], [20, 'ripelonger', 'deeproots'], [24, 'waterall'], [28, 'stormproof'], [32, 'extrafruit'], [36, 'bloomsteps'], [40, 'sunflowercap']] },
  hen: { area: 'homestead', steps: [[4, 'express'], [8, 'sprout'], [12, 'dblhearts'], [16, 'goodswait'], [20, 'babies', 'trough'], [24, 'pie'], [28, 'neighbour'], [32, 'wool'], [36, 'moreanimals'], [40, 'hencap']] },
  ghost: { area: 'town', steps: [[4, 'calmghosts'], [8, 'quickfix'], [12, 'strongarms'], [16, 'tomorrow'], [20, 'morefix', 'steadyhands'], [24, 'ghostreach'], [28, 'secondspin'], [32, 'ghostbounty'], [36, 'firework'], [40, 'ghostcap']] },
  fish: { area: 'beach', steps: [[4, 'quickbite'], [8, 'comber'], [12, 'catchday'], [16, 'sealegs'], [20, 'luckyline', 'nightfish'], [24, 'treasure'], [28, 'lures'], [32, 'bighitter'], [36, 'float'], [40, 'fishcap']] },
  vinyl: { area: 'rave', steps: [[4, 'jellykeep'], [8, 'longjelly'], [12, 'magnet'], [16, 'reactions'], [20, 'luckyjelly', 'megajelly'], [24, 'latejoin'], [28, 'lasersense'], [32, 'longtoys'], [36, 'goldsteps'], [40, 'vinylcap']] },
  banana: { area: '', steps: [[4, 'nightstride'], [8, 'reach'], [12, 'seat'], [16, 'starsteps'], [20, 'starburst', 'heartsall'], [24, 'daystride'], [28, 'reach2'], [32, 'lantern'], [36, 'nightsprint'], [40, 'bananacap']] },
};
export const ORDER = ['sunflower', 'hen', 'ghost', 'fish', 'vinyl', 'banana'];   // the copy file's constellations, in its order

// seven kinds, said beside every perk with an icon (the capstone is its own): less waiting, more rewards, better luck,
// easier, for your banana, everyone sees it, helps others
export const KIND = {
  cheapseeds: 'easy', greenthumb: 'wait', twoseeds: 'more', rarebirds: 'lucky', ripelonger: 'easy', deeproots: 'easy', waterall: 'banana', stormproof: 'easy', extrafruit: 'more', bloomsteps: 'seen', sunflowercap: 'capstone',
  express: 'wait', sprout: 'wait', dblhearts: 'more', goodswait: 'easy', babies: 'wait', trough: 'easy', pie: 'more', neighbour: 'others', wool: 'more', moreanimals: 'more', hencap: 'capstone',
  calmghosts: 'easy', quickfix: 'wait', strongarms: 'banana', tomorrow: 'easy', morefix: 'more', steadyhands: 'easy', ghostreach: 'banana', secondspin: 'lucky', ghostbounty: 'more', firework: 'seen', ghostcap: 'capstone',
  quickbite: 'wait', comber: 'more', catchday: 'lucky', sealegs: 'banana', luckyline: 'lucky', nightfish: 'lucky', treasure: 'easy', lures: 'more', bighitter: 'banana', float: 'seen', fishcap: 'capstone',
  jellykeep: 'easy', longjelly: 'more', magnet: 'banana', reactions: 'banana', luckyjelly: 'lucky', megajelly: 'more', latejoin: 'easy', lasersense: 'easy', longtoys: 'more', goldsteps: 'seen', vinylcap: 'capstone',
  nightstride: 'banana', reach: 'banana', seat: 'banana', starsteps: 'seen', starburst: 'seen', heartsall: 'others', daystride: 'banana', reach2: 'banana', lantern: 'seen', nightsprint: 'banana', bananacap: 'capstone',
  north: 'capstone',
};
export const STARS_EACH = 40;
export const TITLE_AT = [1, 10, 25, 50, 75, 100, 125, 150, 200, 250];   // the copy file's `titles`, in order
// a Shimmer level costs 150 + 45 × its number in XP, never more than 6 000 (the doc; an open question for Trym)
export const shimmerStep = (n) => Math.min(6000, 150 + 45 * n);
