// 🗑️ LITTER LOOKS LIKE LITTER (2 Oct 2026, design library §55). Trym, three times: 15 Sep, the town's flyer "read as a
// grey pebble in the cobbles"; 20 Sep, "they are supposed to be litter, but they dont look like litter, small grey
// things"; 2 Oct, "it just looks like big rocks … it must look like garbage — either reuse other garbage sprites or find
// some new garbage sprites". Every sprite the world drops as rubbish is read here and must have colour in it: a grey
// piece on grey cobbles, or a white-grey ball on grass, reads as a stone whatever it was cut from. The lists are read from
// the code that draws them, so a new piece cannot skip the check.
//
//   node tools/check-litter.mjs        (in check-all, the Stop hook and CI)
import fs from 'node:fs';
import zlib from 'node:zlib';

const MIN_SAT = 0.22;   // mean saturation of a sprite's lit pixels: the grey flyers were 0.16–0.18, a cardboard box 0.27
const root = new URL('..', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root));
const problems = [];

// a small PNG reader — 8-bit greyscale, RGB, palette, grey+alpha and RGBA, not interlaced (what the pack scripts write)
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
function png(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, plte = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), kind = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; inter = data[12]; }
    else if (kind === 'PLTE') plte = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    off += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (depth !== 8 || inter !== 0 || !ch) throw new Error('only 8-bit, non-interlaced PNGs here (depth ' + depth + ', type ' + type + ')');
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++], line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? line[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      line[x] = (line[x] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : 0)) & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, q = x * ch;
      if (type === 6) { px[o] = line[q]; px[o + 1] = line[q + 1]; px[o + 2] = line[q + 2]; px[o + 3] = line[q + 3]; }
      else if (type === 2) { px[o] = line[q]; px[o + 1] = line[q + 1]; px[o + 2] = line[q + 2]; px[o + 3] = 255; }
      else if (type === 3) { const i = line[q]; px[o] = plte[i * 3]; px[o + 1] = plte[i * 3 + 1]; px[o + 2] = plte[i * 3 + 2]; px[o + 3] = trns && i < trns.length ? trns[i] : 255; }
      else if (type === 4) { px[o] = px[o + 1] = px[o + 2] = line[q]; px[o + 3] = line[q + 1]; }
      else { px[o] = px[o + 1] = px[o + 2] = line[q]; px[o + 3] = 255; }
    }
    prev = line;
  }
  return { w, h, px };
}

// how much colour a sprite has: the mean saturation of its lit pixels (the dark outline and the see-through ones are not
// what the eye reads as the thing)
function meanSat(img) {
  let n = 0, s = 0;
  for (let i = 0; i < img.w * img.h; i++) {
    const r = img.px[i * 4], g = img.px[i * 4 + 1], b = img.px[i * 4 + 2], a = img.px[i * 4 + 3];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (a <= 128 || mx < 51) continue;
    n += 1; s += (mx - mn) / mx;
  }
  return n ? s / n : 0;
}

// the check bites: a grey square fails it and a red one passes, every run
const square = (r, g, b) => ({ w: 2, h: 2, px: Buffer.from(Array.from({ length: 4 }, () => [r, g, b, 255]).flat()) });
if (!(meanSat(square(128, 128, 136)) < MIN_SAT) || !(meanSat(square(200, 60, 50)) >= MIN_SAT)) {
  console.error('❌ litter: the colour measure cannot tell a grey square from a red one — the check is broken');
  process.exit(1);
}

// what the world drops as rubbish, read from the code that draws it
const sprites = [];
const listOf = (file, name) => {
  const m = read(file).toString().match(new RegExp('const ' + name + ' = \\[([^\\]]+)\\]'));
  if (!m) { problems.push(file + ': ' + name + ' is gone — this check reads the litter list from it'); return []; }
  return (m[1].match(/'([a-z0-9]+)'/g) || []).map((q) => q.slice(1, -1));
};
for (const k of listOf('src/scripts/town-room.js', 'LITTER_ART')) sprites.push(['the town’s litter “' + k + '”', 'public/assets/town/s-' + k + '-0.png']);
for (const k of listOf('src/scripts/town-life.js', 'FLYER_ART')) sprites.push(['a town flyer spot’s “' + k + '”', 'public/assets/town/s-' + k + '-0.png']);
if (/assets\/town\/litter-/.test(read('src/scripts/town-life.js').toString())) problems.push('town-life.js draws /assets/town/litter-*: the grey flyer art is gone for good (§55)');
for (const m of read('src/pages/park.astro').toString().matchAll(/\.pk-trash--\d[^}]*url\('\/(assets\/park\/[^']+\.png)'\)/g)) sprites.push(['the park’s litter ' + m[1].split('/').pop(), 'public/' + m[1]]);
if (sprites.length < 10) problems.push('only ' + sprites.length + ' litter sprites found — a list moved, and this check must follow it');

const seen = new Set();
for (const [what, file] of sprites) {
  if (seen.has(file)) continue;
  seen.add(file);
  let img;
  try { img = png(read(file)); } catch (e) { problems.push(what + ' (' + file + '): ' + e.message); continue; }
  const s = meanSat(img);
  if (s < MIN_SAT) problems.push(what + ' (' + file + ') is grey: colour ' + s.toFixed(2) + ' under ' + MIN_SAT + ' — on cobbles it reads as a stone. Use a piece you can name at a glance (a can, a carton, a box)');
}

if (problems.length) {
  console.error('❌ litter — design library §55: litter looks like litter, never a grey lump\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('✅ litter — ' + seen.size + ' rubbish sprites, every one with colour in it (§55)');
