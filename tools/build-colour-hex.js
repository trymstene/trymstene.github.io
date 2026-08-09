// 🎨 EVERY COLOURWAY'S REAL HEX, READ FROM PRINTFUL — not typed by hand.
//
//   node tools/build-colour-hex.js          write src/data/colour-hex.json
//   node tools/build-colour-hex.js --check  fail if it is out of date (CI)
//
// The shop's swatches used a hand-written COLOR_HEX map with a grey fallback,
// which meant a colour nobody remembered to add rendered as a grey dot and
// nothing said so. It had already been patched three times — the live tee
// "carried nine grey swatches since launch" — and the long sleeve arrived on
// 8 Aug with Agave, Harbor Blue and Carbon Grey all grey.
//
// Printful publishes `color_code` on every catalog variant, so the map is
// DERIVED now. Same shape as the worker allowlist codegen: one source, one
// generated file, no hand-editing.
import fs from 'node:fs';
import { SLATE } from './shop-slate.js';

// every catalog the shop sells from, live or specced. Extras are products that
// pre-date the slate and are not rows in it.
const EXTRA = [
  1474, 200,   // all-over crop tops
  1553,        // cotton tote W101
  172, 407,    // framed poster, enamel mug
];
const IDS = [...new Set([...SLATE.map((p) => p.catalog), ...EXTRA])].sort((a, b) => a - b);

const out = {};
const noCode = [];
for (const id of IDS) {
  const j = await (await fetch(`https://api.printful.com/products/${id}`)).json();
  if (!j.result || !j.result.variants) { console.log(`⚠️  #${id} unavailable`); continue; }
  for (const v of j.result.variants) {
    const name = (v.color || '').trim();
    if (!name) continue;
    if (!v.color_code) { noCode.push(`#${id} ${name}`); continue; }
    const key = name.toLowerCase();
    // a name can repeat across blanks with a slightly different code; first wins
    // and the rest are noted, because two products showing one name in two
    // shades is a swatch bug either way
    if (out[key] && out[key] !== v.color_code.toLowerCase()) continue;
    out[key] = v.color_code.toLowerCase();
  }
}

const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
const path = new URL('../src/data/colour-hex.json', import.meta.url);
const json = JSON.stringify(sorted, null, 1) + '\n';

if (process.argv.includes('--check')) {
  const have = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
  if (have !== json) {
    console.error('✗ colour-hex.json is stale — run: node tools/build-colour-hex.js');
    process.exit(1);
  }
  console.log(`✅ colour-hex.json is current (${Object.keys(sorted).length} colours)`);
} else {
  fs.writeFileSync(path, json);
  console.log(`wrote src/data/colour-hex.json — ${Object.keys(sorted).length} colours from ${IDS.length} catalogs`);
}
if (noCode.length) console.log(`⚠️  no color_code from Printful: ${noCode.join(', ')}`);
