// The BANANA OF THE DAY — one shared, deterministic outfit-picker used by
// BOTH the /banana-of-the-day/ page (at build time, for crawlable text) and
// the builder's overlay daily mode (in the browser). Same UTC date in = same
// banana out, everywhere, no drift.
//
// The option pools come STRAIGHT from the shared catalog (src/data/wearables.js)
// — no more hand-syncing with the engine. Earned / rave-only extras are excluded
// here: the daily banana only wears things anyone could actually get.
import { WEARABLE_PACKS } from '../data/wearables.js';

const EFFECT_POOL = [['disco', 'disco mode'], ['sparkle', 'sparkles'], ['confetti', 'confetti']];

function packActive(pack, date) {
  if (pack.always) return true;
  if (!pack.window) return false;
  const md = String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  const { from, to } = pack.window;
  return from <= to ? (md >= from && md <= to) : (md >= from || md <= to);
}

// Pools as the builder sees them: 'none' first (so indices match its
// HATS/GLASSES arrays), then every active pack's options in declaration order.
function pools(date) {
  const active = Object.values(WEARABLE_PACKS).filter((p) => packActive(p, date));
  const pair = (x) => [x.id, x.phrase];
  return {
    hats: [['none', 'no hat'], ...active.flatMap((p) => (p.hats || []).map(pair))],
    shades: [['none', 'no shades'], ...active.flatMap((p) => (p.shades || []).map(pair))],
    // the daily only wears freely-available extras (never earned trophies, rave-granted
    // items, or FEET overlays — the daily keeps its own baked-in shoes)
    extras: active.flatMap((p) => (p.extras || []).filter((e) => !e.earned && !e.raveOnly && e.anchor !== 'feet').map(pair)),
  };
}

// Deterministic outfit for a UTC date. The rnd() CALL ORDER is the contract —
// hat, shades, one per extra, effect gate, effect pick — do not reorder.
export function dailyOutfit(date = new Date()) {
  // splitmix32 seeded by the UTC date. A STRONG mix is essential: consecutive
  // days' seeds differ by 1, and the old plain LCG barely changed its first
  // draw — so the hat stayed identical for weeks (only glasses/fx drifted). The
  // rnd() CALL ORDER below is still the contract; only the PRNG quality changed.
  let h = (date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()) >>> 0;
  const rnd = () => {
    h = (h + 0x9e3779b9) | 0;
    let t = h ^ (h >>> 16); t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return (t >>> 0) / 4294967296;
  };
  const { hats, shades, extras } = pools(date);
  const hat = hats[Math.floor(rnd() * hats.length)];
  const glasses = shades[Math.floor(rnd() * shades.length)];
  const worn = extras.filter(() => rnd() < 0.4);
  const effect = rnd() < 0.35 ? EFFECT_POOL[Math.floor(rnd() * EFFECT_POOL.length)] : null;
  return {
    hat: hat[0], glasses: glasses[0],
    extras: Object.fromEntries(worn.map(([id]) => [id, true])),
    effect: effect ? effect[0] : 'none',
    labels: { hat: hat[1], glasses: glasses[1], extras: worn.map(([, l]) => l), effect: effect ? effect[1] : null },
  };
}

// "a cowboy hat, heart shades and a bow tie — in disco mode"
export function describeOutfit(o) {
  const bits = [];
  if (o.hat !== 'none') bits.push(o.labels.hat);
  if (o.glasses !== 'none') bits.push(o.labels.glasses);
  bits.push(...o.labels.extras);
  let s;
  if (!bits.length) s = 'absolutely nothing — a rare naked banana day';
  else if (bits.length === 1) s = bits[0];
  else s = bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1];
  if (o.labels.effect) s += ' — in ' + o.labels.effect;
  return s;
}
