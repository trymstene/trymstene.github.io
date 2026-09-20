// 🕯🚦 CHAPTER TWO IS SPREAD OVER FOUR FILES AND THEY MUST AGREE.
//
// The order the chapter opens the fronts in is written down four times, because four different
// things need it and none of them can reasonably import the others at runtime:
//   · src/data/town/locks.js   SIGNATURES — what the hoarding's signpost counts "the second of four"
//   · src/data/quest-c2.js     FRONTS     — which building each pair of steps is about
//   · tools/copy-jobs.mjs      QUEST_KEYS — the ten copy keys the writer is asked for
//   · src/data/copy/town-quest.json       — the ten it actually wrote, in order
// A comment saying "keep these in step" is the thing this repo does not do any more (CLAUDE.md:
// a rule stated twice becomes a check). So: this is the check. It is source-only and costs nothing.
//
// ⚠️ AND IT HOLDS THE SEAM THAT ACTUALLY BREAKS THINGS. The chapter is only a chapter if every
// step's copy key resolves; world-quest.js refuses the whole chapter if one does not, which is the
// right runtime behaviour and an invisible one — the town would simply have no story in it and
// nothing would say why. Here it is loud, on the branch, before a build.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];
const say = (m) => fail.push(m);

const [{ SIGNATURES, HOARDABLE, HOARD_ON }, c2, { QUEST_KEYS, QUEST_WHO }] = await Promise.all([
  import('../src/data/town/locks.js'),
  import('../src/data/quest-c2.js'),
  import('./copy-jobs.mjs'),
]);

let copy = null;
try { copy = JSON.parse(readFileSync(join(ROOT, 'src/data/copy/town-quest.json'), 'utf8')); } catch (e) {}

// ── 1. the four fronts, in the one order ────────────────────────────────────────────────────
const fronts = c2.FRONTS.map((f) => f.key);
if (fronts.join(',') !== SIGNATURES.join(',')) {
  say('quest-c2.js opens ' + fronts.join(' → ') + ', and locks.js SIGNATURES says '
    + SIGNATURES.join(' → ') + ' — the signpost counts against SIGNATURES, so a player would be'
    + ' told they are on the second of four while the third came down');
}

// ── 2. the ten steps: the data and the copy job ask for the same ten ────────────────────────
const ids = c2.STEPS.map((s) => s.say);
if (ids.join(',') !== QUEST_KEYS.join(',')) {
  say('the steps in quest-c2.js want copy keys [' + ids.join(', ') + '] and tools/copy-jobs.mjs'
    + ' asks the writer for [' + QUEST_KEYS.join(', ') + ']');
}

// ── 3. …and the approved copy carries them, in order ────────────────────────────────────────
if (!copy) {
  say('src/data/copy/town-quest.json is missing or unreadable — the chapter refuses to load without'
    + ' it and the town has no story in it (run: node tools/copy.mjs town-quest)');
} else {
  const rows = Array.isArray(copy.steps) ? copy.steps : [];
  const keys = rows.map((r) => String((r && r.key) || ''));
  if (keys.join(',') !== ids.join(',')) {
    say('the approved copy holds [' + keys.join(', ') + '] and the chapter needs [' + ids.join(', ') + ']');
  }
  for (const r of rows) {
    const at = 'town-quest.json steps.' + (r.key || '?');
    if (!Array.isArray(r.lines) || !r.lines.length) say(at + ' has no lines, and world-quest.js refuses a chapter with an empty sheet in it');
    for (const l of r.lines || []) {
      if (!QUEST_WHO.includes(String(l && l.who))) say(at + ' is spoken by "' + (l && l.who) + '", which world-quest.js cannot draw a portrait for');
    }
  }
  // the receipt: only the steps that pay carry one, and the engine only reads it when they do
  for (const r of rows) {
    const st = c2.STEPS.find((s) => s.say === r.key);
    if (!st) continue;
    if (r.note && !st.pay) say('town-quest.json steps.' + r.key + ' carries a receipt line and the step pays nothing — nobody would ever read it');
    if (!r.note && st.pay) say('town-quest.json steps.' + r.key + ' pays and has no receipt line');
  }
}

// ── 4. every `opens` is a front that CAN be hoarded, or the step unlocks nothing ─────────────
// ⚠️ `condo` is the deliberate exception and must stay one: the arcade collects a signature and is
// never boarded, because five shipped games have to answer on a stranger's worst day.
for (const st of c2.STEPS) {
  if (!st.opens) continue;
  if (!SIGNATURES.includes(st.opens)) say(st.id + ' opens "' + st.opens + '", which is not one of the four signatures');
  if (st.opens !== 'condo' && !HOARDABLE.includes(st.opens)) {
    say(st.id + ' opens "' + st.opens + '", which no hoarding ever stands in front of — the step would'
      + ' pay out and nothing on screen would change');
  }
}
const opens = c2.STEPS.filter((s) => s.opens).map((s) => s.opens);
if (opens.join(',') !== SIGNATURES.join(',')) {
  say('the chapter opens [' + opens.join(', ') + '] and there are four signatures to collect: ' + SIGNATURES.join(', '));
}

// ── 5. the marks are on the plate, and no two fronts share one ──────────────────────────────
// A mark placed outside 0-100% lands off the world and is simply never seen; two steps sharing a
// spot is the other silent failure — the second front's notice hanging on the first one's wall.
const seen = new Map();
for (const f of c2.FRONTS) {
  const { x, y } = f.at;
  if (!(x > 0 && x < 100 && y > 0 && y < 100)) say(f.key + '’s mark sits at ' + x + '%,' + y + '% — off the town plate');
  const at = x + ',' + y;
  if (seen.has(at)) say(f.key + ' and ' + seen.get(at) + ' hang their marks on the same spot');
  seen.set(at, f.key);
}
if (seen.has(c2.HALL.x + ',' + c2.HALL.y)) say('a building front shares the town hall’s spot, so a fault mark and a signing mark would sit on top of each other');

// ── 6. the switch is still Trym's ───────────────────────────────────────────────────────────
// ⚠️ NOT A STYLE RULE. HOARD_ON boards up three fronts for every player who has not played this
// chapter, and on 21 Sep 2026 that is very nearly everybody: 4400 people have met the questline,
// 116 started it, 76 cleared a step, 409 steps in total — at most 22 finishers of chapter 1, and
// chapter 2 is newer than that. The plan (§8 q1) says to measure before building and to "gate less
// behind the chapter" if the number is small. Building it does not flip it; Trym does, by name.
if (HOARD_ON !== false) {
  say('HOARD_ON is no longer false. That boards up the store, the post office and the café for every'
    + ' player who has not finished chapter 2 — which is almost everybody. It is Trym’s switch and'
    + ' his alone (src/data/town/locks.js, docs/town-jobs-plan.md §8 q1). If he flipped it, delete'
    + ' this check in the same commit and say so.');
}

if (fail.length) {
  console.error('❌ chapter two:\n' + fail.map((f) => '   · ' + f).join('\n'));
  process.exit(1);
}
console.log('✅ chapter two: ' + c2.STEPS.length + ' steps over ' + SIGNATURES.length + ' fronts'
  + ' (' + SIGNATURES.join(' → ') + '), every copy key resolves, the arcade is never boarded,\n'
  + '   and HOARD_ON is still off');
