// 📋 THE ORDER BOARD (27 Sep 2026). Trym, of the Exchange: "the cart / stall looks abandoned, and no town-banana looks
// responsible for it … can it be much more? more than selling eggs for a better price if you peek in at the right time" —
// and then "yes order board, every area". Two sales in its first five days said the same. So every UTC day three residents
// pin an order at the Exchange, one for each of the other areas — the farm, the bay, the park — and Tally, who keeps the
// stall now, pays for what you bring. It pays better than any stall, and a delivery is a visit the resident remembers
// (the friendship ladder: town-life.js `tw_met_<key>`).
//
// ⚠️ ONE SOURCE, TWO READERS (market.js's rule): worker-pass imports this to check and pay a delivery; the town imports it
// to draw the board. Pure data and pure functions, no DOM, and NO WORDS — every line a resident says about an order is
// src/data/copy/town-exchange.json `orders.wants.<who>.<want>`.
// ⚠️ ORDERS ONLY EVER COME FROM RESIDENTS, never from another player: no trading (the town's killed list).
import { mix32 } from './market.js';
import { FISH } from '../../scripts/fish-data.js';
import { SHELLS } from '../../scripts/shell-data.js';

// what an order can ask for, and where the server takes it from:
//   'yard' — the SAVED farm, all or nothing (worker-rave /yards/take with `all`, the Exchange's own path)
//   'stat' — a pass count. What is there to give is the count minus what orders have taken already (`og_<stat>`, a
//            server-written slot), so the collection itself — the fish ledger, the shells, the harvests — stays whole.
// `n`: how many are asked for, min and max. `pay`: coins each, above what the homestead's own stall gives.
export const WANTS = {
  eggs:    { area: 'farm', take: 'yard', n: [3, 6], pay: 5 },
  milk:    { area: 'farm', take: 'yard', n: [2, 4], pay: 8 },
  wool:    { area: 'farm', take: 'yard', n: [1, 3], pay: 15 },
  fish:    { area: 'bay', take: 'stat', n: [2, 3], pay: 6, uncommon: 12 },    // a species, fish_<id>
  shell:   { area: 'bay', take: 'stat', n: [2, 3], pay: 5, uncommon: 10 },    // a species, sh_<id>
  harvest: { area: 'park', take: 'stat', stat: 'garden_harvests', n: [1, 3], pay: 12 },
  pegg:    { area: 'park', take: 'stat', stat: 'eggs_found', n: [1, 2], pay: 10 },
};
// who asks for what, by area: [resident key, want]. The words for each pair are the copy file's.
// ⚠️ MIRRORED in tools/copy-jobs.mjs ORDER_ASKS (the copy gate runs where src/ is not): change both — worker-pass/test/orders.test.mjs
// fails on a difference, and the copy gate on a pair with no line in src/data/copy/town-exchange.json.
export const ASKS = {
  farm: [['bean', 'milk'], ['bean', 'eggs'], ['pip', 'eggs'], ['pip', 'wool'], ['stamp', 'wool'], ['nib', 'milk']],
  bay: [['spinner', 'fish'], ['moss', 'fish'], ['dot', 'fish'], ['twirl', 'shell'], ['stamp', 'shell']],
  park: [['granfig', 'harvest'], ['figjr', 'harvest'], ['bean', 'harvest'], ['dot', 'pegg'], ['pip', 'pegg']],
};
export const AREAS = ['farm', 'bay', 'park'];
// a bay order asks for a common or an uncommon species: a rare one would be a wish, not an order
const kinds = (list) => list.filter((x) => x.tier === 'common' || x.tier === 'uncommon').map((x) => [x.id, x.tier]);
const SPECIES = { fish: kinds(FISH), shell: kinds(SHELLS) };

// today's three orders — the same for everybody, from the UTC day (market.js's splitmix32)
export function ordersOf(day) {
  const asking = new Set();
  return AREAS.map((area, a) => {
    const r = mix32(day * 11 + a * 977 + 5), list = ASKS[area];
    // three different faces a day: a resident already asking today hands on to the next in line
    let i = Math.floor(r() * list.length);
    for (let k = 0; k < list.length && asking.has(list[i][0]); k++) i = (i + 1) % list.length;
    const [who, want] = list[i];
    asking.add(who);
    const w = WANTS[want];
    let kind = '', tier = 'common';
    if (SPECIES[want]) { [kind, tier] = SPECIES[want][Math.floor(r() * SPECIES[want].length)]; }
    const hi = tier === 'uncommon' ? Math.max(w.n[0], w.n[1] - 1) : w.n[1];   // fewer of the harder ones
    const lo = tier === 'uncommon' ? 1 : w.n[0];
    const n = lo + Math.floor(r() * (hi - lo + 1));
    const each = tier === 'uncommon' && w.uncommon ? w.uncommon : w.pay;
    return { id: day + '-' + area, area, who, want, kind, n, coins: n * each };
  });
}
// the pass count an order is given out of, and the counter beside it that remembers what orders took
export const statOf = (o) => (o.want === 'fish' ? 'fish_' + o.kind : o.want === 'shell' ? 'sh_' + o.kind : WANTS[o.want].stat || '');
export const givenOf = (o) => 'og_' + statOf(o);
// how many a banana can give towards an order: the count, less what orders took before — and, for a shell, less the old
// three-for-one swap's `shx_<id>` (removed 26 Jul; the beach's own held() still subtracts it). `get(key)` reads one summed
// count: the server hands it the pass's stats, the town statTotal() over this device's ledger.
export const spareFrom = (get, o) => Math.max(0, get(statOf(o)) - get(givenOf(o)) - (o.want === 'shell' ? get('shx_' + o.kind) : 0));
export const spareOf = (stats, o) => spareFrom((k) => (stats && +stats[k]) || 0, o);
export const LADDER_STEP = 2;   // a delivery counts as two visits on the resident's ladder (town-life.js rung)
