// ✋ TWO GLOVES, ONE THING EACH — WHATEVER THE THING IS (1 Oct 2026).
//
// Trym, on the Citizens' board: "on one hand boxing gloves and a lightstick, and the other hand boxing glove and
// miniature banana? It shouldnt be possible to have two wearable items in one hand at the same time." The game's own
// hand items were held to one per glove; a community item on a hand was drawn over whatever the glove held, and the
// print renderer put the game's items in the gloves in a different order from the engine.
//
// This gate holds the rule where it can drift:
//   1. one table of cases through src/lib/hands.js AND tools/hands_rule.py — the two must give the same gloves;
//   2. "the newest wins" (makeRoom) on the cases a wardrobe meets;
//   3. the engine and the print renderer both skip a community hand item whose glove is not its own, and every
//      surface that puts a community item on a banana (the builder, the stand, an approval) makes room in the hands.
//
//   node tools/check-hands.mjs        (in check-all, the Stop hook, and in CI)
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WEARABLE_PACKS } from '../src/data/wearables.js';
import { resolveHands, makeRoom } from '../src/lib/hands.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];
const DEF = Object.fromEntries(Object.values(WEARABLE_PACKS).flatMap((p) => p.extras || []).map((d) => [d.id, d]));
const ORDER = Object.keys(DEF);
// the game's items as a wardrobe hands them over: switched on, in catalog order
const defs = (ids) => ids.map((id) => { if (!DEF[id]) fail.push('the case table names ' + id + ', which is not a wearable'); return DEF[id]; })
  .filter(Boolean).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
const glove = (id, hand) => ({ id, anchor: 'hand', hand });

// ── 1. the table: ids in, the four gloves out ──────────────────────────────────────────────────────────────
const CASES = [
  { name: 'Andoo on the board: two boxing gloves over a plush and a glowstick', on: ['plushbanana', 'glowstick'],
    worn: [{ id: 'c_bow', anchor: 'head' }, glove('c_gl', 'left'), glove('c_gr', 'right')],
    want: { left: null, right: null, ownLeft: 'c_gl', ownRight: 'c_gr' } },
  { name: 'a plush and a glowstick go in catalog order, whatever order the outfit lists them in', on: ['glowstick', 'plushbanana'],
    worn: [], want: { left: 'glowstick', right: 'plushbanana', ownLeft: null, ownRight: null } },
  { name: 'one community glove on the left: the first of the game’s items in catalog order takes the free right hand', on: ['boombox', 'trophy'],
    worn: [glove('c_gl', 'left')], want: { left: null, right: 'boombox', ownLeft: 'c_gl', ownRight: null } },
  { name: 'the moment’s item claims first: a beer in the left hand beats a community glove there', on: ['beer'],
    worn: [glove('c_gl', 'left')], want: { left: 'beer', right: null, ownLeft: null, ownRight: null } },
  { name: 'a beer bumps a mug to the other glove, as it always did', on: ['mug', 'beer'],
    worn: [], want: { left: 'beer', right: 'mug', ownLeft: null, ownRight: null } },
  { name: 'two community items on one glove: the newest wins it', on: [],
    worn: [glove('c_a', 'right'), glove('c_b', 'right')], want: { left: null, right: null, ownLeft: null, ownRight: 'c_b' } },
  { name: 'a community hand item with no side rides the right glove', on: ['candle'],
    worn: [glove('c_x', undefined)], want: { left: 'candle', right: null, ownLeft: null, ownRight: 'c_x' } },
  { name: 'three of the game’s items: the third is not drawn', on: ['boombox', 'mug', 'trophy'],
    worn: [], want: { left: 'boombox', right: 'mug', ownLeft: null, ownRight: null } },
];
const idOf = (x) => (x && x.id) || null;
const js = CASES.map((c) => { const r = resolveHands(defs(c.on), c.worn); return { left: idOf(r.left), right: idOf(r.right), ownLeft: idOf(r.own.left), ownRight: idOf(r.own.right) }; });
CASES.forEach((c, i) => { if (JSON.stringify(js[i]) !== JSON.stringify(c.want)) fail.push('engine rule — ' + c.name + ': ' + JSON.stringify(js[i])); });

// …and the same table through the print renderer's copy
const pyIn = JSON.stringify(CASES.map((c) => ({ defs: defs(c.on).map((d) => ({ id: d.id, hand: d.hand, raveOnly: !!d.raveOnly })), customs: c.worn })));
let py = null;
for (const exe of ['python', 'python3']) {
  const r = spawnSync(exe, [join(ROOT, 'tools/hands_rule.py')], { input: pyIn, encoding: 'utf8' });
  if (r.status === 0) { try { py = JSON.parse(r.stdout); } catch (e) { fail.push('tools/hands_rule.py printed something that is not JSON'); } break; }
}
if (!py) fail.push('could not run tools/hands_rule.py with python or python3 — the print renderer’s copy of the rule went unchecked');
else CASES.forEach((c, i) => { if (JSON.stringify(py[i]) !== JSON.stringify(c.want)) fail.push('print renderer (tools/hands_rule.py) — ' + c.name + ': ' + JSON.stringify(py[i])); });

// ── 2. the newest wins ─────────────────────────────────────────────────────────────────────────────────────
const ROOM = [
  { name: 'a community glove on the left takes the left hand’s item off, and the right keeps its own',
    on: ['boombox', 'trophy'], worn: [glove('c_gl', 'left')], put: 'c_gl', want: { off: ['boombox'], drop: [] } },
  { name: 'a plush put on over two community gloves takes ONE glove off — its own side', on: ['plushbanana'],
    worn: [glove('c_gl', 'left'), glove('c_gr', 'right')], put: 'plushbanana', want: { off: [], drop: ['c_gr'] } },
  { name: 'a mug into a free hand takes nothing off', on: ['trophy', 'mug'], worn: [], put: 'mug', want: { off: [], drop: [] } },
  { name: 'a third game item lets go of what its own glove held', on: ['boombox', 'mug', 'trophy'], worn: [], put: 'boombox',
    want: { off: ['mug'], drop: [] } },
  { name: 'tidying a loaded outfit takes off only what was not drawn', on: ['plushbanana', 'glowstick'],
    worn: [glove('c_gl', 'left'), glove('c_gr', 'right')], put: null, want: { off: ['plushbanana', 'glowstick'], drop: [] } },
  { name: 'the moment’s item is never taken off', on: ['beer', 'mug'], worn: [glove('c_gr', 'right')], put: 'c_gr',
    want: { off: ['mug'], drop: [] } },
];
for (const c of ROOM) {
  const on = defs(c.on);
  const put = c.put ? (on.find((d) => d.id === c.put) || c.worn.find((w) => w.id === c.put)) : null;
  const got = makeRoom(on, c.worn, put);
  const norm = (o) => JSON.stringify({ off: [...o.off].sort(), drop: [...o.drop].sort() });
  if (norm(got) !== norm(c.want)) fail.push('newest wins — ' + c.name + ': ' + JSON.stringify(got));
}

// ── 3. the renderers and the wardrobes use it ──────────────────────────────────────────────────────────────
const src = (f) => readFileSync(join(ROOT, f), 'utf8');
const engine = src('src/lib/banana-engine.js');
const cat = src('src/data/wearables.js');
if (!/export \{[^}]*resolveHands[^}]*\} from '\.\.\/lib\/hands\.js'/.test(cat)) fail.push('src/data/wearables.js no longer carries the hand rule from src/lib/hands.js');
if (!/resolveHands as handRule[^;]*from '\.\.\/data\/wearables\.js'/.test(engine)) fail.push('src/lib/banana-engine.js does not take its hand rule from the catalog (src/lib/hands.js)');
if (!/glove\.own\[gloveOf\(cItem\)\] !== cItem\) continue/.test(engine)) fail.push('the engine draws a community hand item without asking whether its glove is its own');
const pyr = src('tools/banana_render.py');
if (!/from hands_rule import/.test(pyr)) fail.push('tools/banana_render.py does not take its hand rule from tools/hands_rule.py');
if (!/glove\['own'\]\[glove_of\(c\)\] is not c/.test(pyr)) fail.push('tools/banana_render.py draws a community hand item without asking whether its glove is its own');
for (const f of ['src/scripts/banana-builder.js', 'src/scripts/park-shops.js', 'src/lib/banana-pass.js']) {
  if (!/makeRoom/.test(src(f))) fail.push(f + ' puts things on a banana without making room in its hands (src/lib/hands.js makeRoom)');
}

if (fail.length) {
  console.error('❌ the hands:\n   · ' + fail.join('\n   · '));
  process.exit(1);
}
console.log('✅ hands: one thing per glove — ' + CASES.length + ' cases agree in the engine and the print renderer, ' + ROOM.length
  + ' wardrobe cases keep the newest, and the builder, the stand and an approval make room');
