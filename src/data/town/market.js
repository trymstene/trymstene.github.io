// 📈🎡 THE MARKET — the Exchange's prices and the Wheel of Peel's wedges (23 Sep 2026).
//
// ⚠️ ONE SOURCE, TWO READERS (the jobs.js precedent). worker-pass imports this to price a sale and to pay a
// spin; the town imports it to draw the card and the wheel. Pure data and pure functions, no DOM. Change a
// number here and both sides change together.
//
// ⚠️ THE WHEEL'S ODDS ARE NOT HERE. The town plan: "Server-rolled, tape row, odds never published" — this
// file ships to every visitor's browser, so the weights live in worker-pass beside the roll.

// splitmix32: the daily banana's own rhythm, seeded by the UTC day
export function mix32(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x9e3779b9) >>> 0; let z = t; z = Math.imul(z ^ (z >>> 16), 0x21f0aaad); z = Math.imul(z ^ (z >>> 15), 0x735a2d97); z = z ^ (z >>> 15); return (z >>> 0) / 4294967296; };
}
export const dayOf = (t) => Math.floor(t / 86400000);   // the UTC day number (the worker's utcDay() names the same day)

// ---- the Exchange: Fig Jr. buys what the farm made, at a price that moves from day to day
// [id, base price, the animals that make it]
export const GOODS = [['eggs', 3, ['hen']], ['milk', 5, ['goat', 'cow']], ['wool', 8, ['sheep']]];
export const goodIndex = (id) => GOODS.findIndex((g) => g[0] === id);
// today's price for good i: 0.6× to 1.6× its base, to one decimal
export function priceOf(day, i) { const r = mix32(day * 7 + i * 131)(); return Math.round(GOODS[i][1] * (0.6 + r) * 10) / 10; }
// what n of good i fetch today — rounded once, so the card, the toast and the wallet say the same number
export const saleOf = (day, i, n) => Math.round(Math.max(0, n | 0) * priceOf(day, i));
// Bean's rumour about tomorrow's eggs: right seven times in ten, seeded by the day
export function rumourOf(day) {
  const up = priceOf(day + 1, 0) > priceOf(day, 0), honest = mix32(day * 3 + 9)() < 0.7;
  return up === honest ? 'up' : 'down';
}
export const SELL_CAP = 24;   // Fig Jr. buys at most this many of each good from one banana in a UTC day

// ---- the Wheel of Peel: the eight wedges in the order they are painted, clockwise from the pin
// ids only; what each one PAYS is the worker's (WHEEL_PAY), and what each one is CALLED is the copy's
export const WEDGES = [
  ['c5', '#ffe135', '#141208'], ['firework', '#ff8a3d', '#141208'], ['peel', '#d9d2c6', '#141208'], ['c20', '#ffe135', '#141208'],
  ['lure', '#7ec8ff', '#141208'], ['again', '#c9f26a', '#141208'], ['peel', '#d9d2c6', '#141208'], ['pot', '#ff5c8a', '#fffdf5'],
];
export const SPIN_COST = 3;    // a paid spin, after the day's free one
export const SPIN_CAP = 30;    // paid spins per banana per UTC day
export const POT_SEED = 100;   // what the pot starts from again after a wedge takes it
export const POT_FEED = 1;     // what every paid spin puts into the pot

// ---- the pocket: what the wheel's prizes go into, at most five of a kind (a pair of pass stats per kind:
// pocket_<kind> counts in, pocket_<kind>_used counts out, the balance is the difference — the tickets pattern)
export const POCKET_KINDS = ['firework', 'lure'];
export const POCKET_MAX = 5;
export const pocketHave = (stats, k) => Math.max(0, ((stats && stats['pocket_' + k]) || 0) - ((stats && stats['pocket_' + k + '_used']) || 0));
