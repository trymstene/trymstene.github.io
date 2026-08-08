// 💰 WHAT EVERY LIVE VARIANT ACTUALLY EARNS — measured, not assumed.
//
// Joins three sources nothing else joins:
//   worker /pf          every Shopify variant -> its Printful CATALOG variant
//                       (v2 API; v1 refuses platform-connected stores)
//   Printful catalog    that catalog variant's blank cost (public, no auth)
//   tools/shop-slate.js the one rule: (2.00 + blank + 0.30) / 0.971 -> .99
//
// Until this existed nobody could see the official line's costs, which is how
// the mug shipped as the $12.25 enamel one and a flat-priced tee lost money on
// 5XL. Run it before reviving anything and after every price change.
//
//   node tools/shop-margins.js              every product
//   node tools/shop-margins.js hoodie crop  only matching names

import { priceFor, marginAt, MIN_MARGIN } from './shop-slate.js';

const WORKER = 'https://banana-sticker.trymstene.workers.dev/pf';
const only = process.argv.slice(2).map((s) => s.toLowerCase());

const get = (u) => fetch(u).then((r) => r.json());

// catalog variant id -> blank cost, resolved a PRODUCT at a time. One lookup
// per variant would be ~100 calls and Printful rate-limits at 120/min.
const costCache = new Map();
const productCache = new Map();

async function blankCost(variantId) {
  if (costCache.has(variantId)) return costCache.get(variantId);
  const v = await get(`https://api.printful.com/products/variant/${variantId}`);
  const pid = v.result && v.result.product && v.result.product.id;
  if (!pid) { costCache.set(variantId, null); return null; }
  if (!productCache.has(pid)) {
    const p = await get(`https://api.printful.com/products/${pid}`);
    productCache.set(pid, p.result && p.result.variants ? p.result.variants : []);
    for (const x of productCache.get(pid)) costCache.set(x.id, parseFloat(x.price));
  }
  return costCache.get(variantId) != null ? costCache.get(variantId) : null;
}

const pf = await get(WORKER);
let anyLoss = false;

for (const [name, rows] of Object.entries(pf)) {
  if (only.length && !only.some((o) => name.toLowerCase().includes(o))) continue;
  if (!Array.isArray(rows)) { console.log(`\n${name}: ${rows}`); continue; }
  console.log(`\n${name}  (${rows.length} variants)`);

  // group identical (blank, retail) pairs — 80 hoodie rows is unreadable
  const groups = new Map();
  for (const r of rows) {
    const m = /^(.*) :: catalog (\d+) :: retail ([\d.]+)$/.exec(r);
    if (!m) continue;
    const cost = await blankCost(+m[2]);
    const key = `${cost}|${m[3]}`;
    if (!groups.has(key)) groups.set(key, { cost, retail: parseFloat(m[3]), names: [] });
    groups.get(key).names.push(m[1].replace(/^\s*\/\s*/, '').trim());
  }

  for (const g of [...groups.values()].sort((a, b) => (a.cost || 0) - (b.cost || 0))) {
    if (g.cost == null) { console.log(`   ?? cost unknown — ${g.names.slice(0, 3).join(', ')}`); continue; }
    const keeps = marginAt(g.retail, g.cost);
    const want = priceFor(g.cost);
    const flag = keeps < 0 ? '💀 LOSS' : keeps < 1 ? '❌ under $1' : keeps < MIN_MARGIN ? '⚠️  thin' : '✅';
    if (keeps < MIN_MARGIN) anyLoss = true;
    const label = g.names.length > 3
      ? `${g.names[0]}…${g.names[g.names.length - 1]} (${g.names.length})`
      : g.names.join(', ');
    console.log(`   ${flag.padEnd(11)} ${label.padEnd(30)} blank $${g.cost.toFixed(2).padStart(6)}` +
      `  sells $${g.retail.toFixed(2).padStart(6)}  keeps $${keeps.toFixed(2).padStart(6)}` +
      (keeps < MIN_MARGIN ? `   → should be $${want.toFixed(2)}` : ''));
  }
}
console.log(anyLoss ? '\n⚠️  rows above are under the $2 rule — reprice before going live'
  : '\n✅ every variant clears the $2 rule');
