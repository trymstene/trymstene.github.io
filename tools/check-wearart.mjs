#!/usr/bin/env node
// 🎨 THE ART GATE — the packed wearables must decode to the source, byte for byte.
//
// 195 804 B of hand-authored pixel SVG moved out of src/lib/banana-engine.js on 19 Sep 2026 and ships
// as about 17 KB of packed grids. The whole case for doing that rests on one property: the decoder
// reproduces the original string EXACTLY — not "looks the same", identical. A property nobody checks
// is a property nobody has, so this checks it, on every build, with the browser's own decoder.
//
// It compares three things that must agree:
//   1. every key in tools/wearart-source.js is reachable from the engine's SVG dict
//   2. every packed wearable decodes to its source string, character for character
//   3. nothing was quietly dropped — the counts match
//
// If this is red, DO NOT hand-edit src/data/wearart.js. Fix the art in tools/wearart-source.js and
// run `python tools/build-wearart.py`, which refuses to write anything that does not round-trip.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const { WEAR_ART_SOURCE } = await import('file://' + join(ROOT, 'tools', 'wearart-source.js').replace(/\\/g, '/'));
const { ART_P, ART_R } = await import('file://' + join(ROOT, 'src', 'data', 'wearart.js').replace(/\\/g, '/'));

// the decoder itself, read out of the engine so this tests the SHIPPED code and not a copy of it
const engine = readFileSync(join(ROOT, 'src', 'lib', 'banana-engine.js'), 'utf8');
if (!/unpackArt/.test(engine)) {
  console.error('\n❌ art gate — src/lib/banana-engine.js no longer imports unpackArt(); the packed art has no decoder\n');
  process.exit(1);
}
// ⚠️ the decoder lives in its own DOM-free module precisely so this gate can run it: banana-engine.js
// creates Image objects at import and cannot be loaded in node at all.
const { unpackArt } = await import('file://' + join(ROOT, 'src', 'lib', 'wear-unpack.js').replace(/\\/g, '/'))
  .catch((e) => { console.error('\n❌ art gate — the decoder did not import:', e.message, '\n'); process.exit(1); });

const bad = [];
const srcKeys = Object.keys(WEAR_ART_SOURCE);
for (const k of srcKeys) {
  const want = WEAR_ART_SOURCE[k];
  let got;
  if (ART_P[k]) got = unpackArt(ART_P[k]);
  else if (Object.prototype.hasOwnProperty.call(ART_R, k)) got = ART_R[k];
  else { bad.push([k, 'is in the source art but in neither ART_P nor ART_R — it would not draw at all']); continue; }
  if (got !== want) {
    let i = 0;
    while (i < Math.min(got.length, want.length) && got[i] === want[i]) i++;
    bad.push([k, `decodes to a DIFFERENT string at character ${i}\n       want …${want.slice(Math.max(0, i - 40), i + 40)}…\n       got  …${got.slice(Math.max(0, i - 40), i + 40)}…`]);
  }
}
for (const k of [...Object.keys(ART_P), ...Object.keys(ART_R)]) {
  if (!(k in WEAR_ART_SOURCE)) bad.push([k, 'ships but is not in tools/wearart-source.js — the source of truth has drifted']);
}

if (bad.length) {
  console.error('\n❌ art gate\n');
  for (const [k, why] of bad) console.error(`   ${k}\n     ${why}\n`);
  console.error(`${bad.length} problem(s). Fix tools/wearart-source.js and run: python tools/build-wearart.py\n`);
  process.exit(1);
}
const packedB = JSON.stringify(ART_P).length + JSON.stringify(ART_R).length;
const srcB = srcKeys.reduce((n, k) => n + WEAR_ART_SOURCE[k].length, 0);
console.log(`✅ art gate — ${srcKeys.length} wearables decode byte-for-byte (${Object.keys(ART_P).length} packed, ${Object.keys(ART_R).length} verbatim); ${srcB.toLocaleString()} B of art ships as ${packedB.toLocaleString()} B`);
