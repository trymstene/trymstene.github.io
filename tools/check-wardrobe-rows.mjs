// 👕 ONE WARDROBE, ONE SET OF WORDS.
//
// Trym, 20 Sep 2026: "why isnt it Shades, Hats, Body, Shoes, Extras like in the original Make A
// Banana for consistency?" The town's dressing room had three rows of its own invention — HATS,
// SPECS and a drawer called CARRY & WEAR — so a player who had dressed a banana on the builder
// arrived at a room with different words AND with the neckwear and the shoes tipped in with the
// balloons. The rows are src/lib/wardrobe-slots.js's now, and that file is what every surface reads.
//
// This is the check that keeps it true. Make A Banana states its rows in its own markup and will go
// on doing so; the library states them in code. Neither can move without the other noticing.
//
// ⚠️ IT READS BOTH SIDES, AND REBUILDS NEITHER. A copy of the list in this file would pass while the
// shipped one was wrong — the exact trap the mirrored growth tables cost us once (park-beds-plan).
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];

// ── the builder's own rows, out of its markup ────────────────────────────────────────────────────
// ⚠️ Background and Effects are PICTURE SETTINGS, not garments: a colour behind the banana and a
// filter over it. Neither is a thing a banana wears, so neither belongs on a rail in a changing room.
const NOT_WORN = ['Background', 'Effects'];
const astro = readFileSync(join(ROOT, 'src/pages/make-a-banana.astro'), 'utf8');
const rows = [...astro.matchAll(/<label>([^<]+)<\/label>/g)].map((m) => m[1].trim());
if (rows.length < 5) fail.push(`make-a-banana.astro states only ${rows.length} rows — has its markup changed shape?`);
const worn = rows.filter((r) => !NOT_WORN.includes(r));

// ── and the library's, out of the module every surface imports ───────────────────────────────────
// wardrobe-slots.js pulls the engine, which touches Image and localStorage, so the labels are read
// out of its source rather than by importing it — and the shape is pinned so a silent rename cannot
// come back as an empty list that passes.
const lib = readFileSync(join(ROOT, 'src/lib/wardrobe-slots.js'), 'utf8');
const slotBlock = lib.slice(lib.indexOf('export function slots()'));
const labels = [...slotBlock.matchAll(/\{\s*key:\s*'([a-z]+)',\s*label:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
if (labels.length !== 5) fail.push(`wardrobe-slots.js declares ${labels.length} rows, not 5 — the shape of slots() has changed and this gate can no longer read it`);

const mine = labels.map((l) => l[1]);
if (mine.join(' | ') !== worn.join(' | ')) {
  fail.push('the dressing room and Make A Banana disagree about the rows:\n'
    + `        make-a-banana.astro: ${worn.join(', ')}\n`
    + `        wardrobe-slots.js:   ${mine.join(', ')}`);
}

// ── the two single-select rows stay single-select ────────────────────────────────────────────────
// ⚠️ THE BUILDER'S OWN REASON, in its own words: "bow tie OR chain OR tie, never a pile of neckwear
// on ten pixels of banana" — and a shoe is one pair of feet. A room that lets you wear three
// necklaces at once is not the same wardrobe, however alike the labels read.
const KIND = { glasses: 'one', hat: 'one', body: 'one-of', feet: 'one-of', extras: 'many' };
for (const [key] of labels) {
  const m = new RegExp("key: '" + key + "'[^}]*?kind: '([a-z-]+)'").exec(slotBlock);
  const kind = m && m[1];
  if (kind !== KIND[key]) fail.push(`the ${key} row is '${kind}', and it has to be '${KIND[key]}' — ${KIND[key] === 'many' ? 'a set of toggles' : 'one at a time'}`);
}

// ── and no copy file has quietly grown a second set of them ──────────────────────────────────────
// The rail names used to live in src/data/copy/town-dress.json and be written by the copy rig. They
// are not copy: they are the builder's. If they come back, there are two sources again.
const approved = JSON.parse(readFileSync(join(ROOT, 'src/data/copy/town-dress.json'), 'utf8'));
if (approved.rails) fail.push('src/data/copy/town-dress.json has grown a `rails` key again — the row names are Make A Banana’s, held in src/lib/wardrobe-slots.js, and a copy of them here is a second source to keep in step');

// the jobs file must not offer to write them either
const jobs = await import(pathToFileURL(join(ROOT, 'tools/copy-jobs.mjs')).href);
const dress = jobs.JOBS['town-dress'];
if (dress && dress.top.includes('rails')) fail.push('tools/copy-jobs.mjs still lists `rails` in the town-dress job — the rig must not draft the builder’s row names');

if (fail.length) {
  console.error('❌ wardrobe rows:\n' + fail.map((f) => '   · ' + f).join('\n'));
  process.exit(1);
}
console.log(`✅ wardrobe rows: ${mine.join(', ')} — the builder, the library and the dressing room agree`);
