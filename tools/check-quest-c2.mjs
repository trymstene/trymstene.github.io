// 👻🚦 CHAPTER TWO, GHOST WRITER, IS SPREAD OVER SIX FILES AND THEY MUST AGREE (27 Sep 2026).
//
//   · src/data/quest-c2.js              STEPS  — the mechanics: which step, where, whose, what it pays
//   · tools/copy-jobs.mjs               C2_KEYS, C2_WHO, C2_PROPS — what the copy gate asks the words for
//   · src/data/copy/quest-c2.json       — the words it actually has, in order
//   · src/data/copy/homestead-post.json — the two letters that open and close it
//   · src/scripts/banana-homestead.js   POST_WHEN — who delivers those letters
//   · src/lib/world-quest.js            WHO — the portraits the scenes are spoken under
// A comment saying "keep these in step" is the thing this repo does not do (CLAUDE.md: a rule stated twice becomes a
// check). The runtime refuses the whole chapter if one scene has no words, which is right and invisible: the story would
// simply not be there, and nothing would say why. Here it is loud, before a build. Source-only; it costs nothing.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch (e) { return ''; } };
const fail = [];
const say = (m) => fail.push(m);

const [{ HOARD_ON }, c2, { C2_KEYS, C2_WHO, C2_PROPS, TOWN_CAST }] = await Promise.all([
  import('../src/data/town/locks.js'),
  import('../src/data/quest-c2.js'),
  import('./copy-jobs.mjs'),
]);
let copy = null, post = null;
try { copy = JSON.parse(read('src/data/copy/quest-c2.json')); } catch (e) {}
try { post = JSON.parse(read('src/data/copy/homestead-post.json')); } catch (e) {}
const engine = read('src/lib/world-quest.js');
const home = read('src/scripts/banana-homestead.js');
const life = read('src/scripts/town-life.js');

// ── 1. the steps: the table and the copy job ask for the same keys, in the same order ─────────
const keys = c2.STEPS.map((s) => s.say);
if (keys.join(',') !== C2_KEYS.join(',')) say('quest-c2.js wants copy keys [' + keys.join(', ') + '] and tools/copy-jobs.mjs C2_KEYS asks for [' + C2_KEYS.join(', ') + ']');
const ids = c2.STEPS.map((s) => s.id);
if (new Set(ids).size !== ids.length) say('two steps share an id, and the id is the receipt the pay is held against');

// ── 2. …and the words carry every one, with a scene for every scene ─────────────────────────
if (!copy) say('src/data/copy/quest-c2.json is missing or unreadable — the chapter refuses to load without it');
else {
  const rows = Array.isArray(copy.steps) ? copy.steps : [];
  const got = rows.map((r) => String((r && r.key) || ''));
  if (got.join(',') !== keys.join(',')) say('quest-c2.json holds [' + got.join(', ') + '] and the chapter needs [' + keys.join(', ') + ']');
  for (const st of c2.STEPS) {
    const r = rows.find((x) => x && x.key === st.say);
    if (!r) continue;
    const lines = Array.isArray(r.lines) ? r.lines : [];
    if (st.kind === 'talk' && !lines.length) say('quest-c2.json steps.' + st.say + ' has no scene, and world-quest.js refuses a chapter with an empty sheet in it');
    for (const l of lines) {
      const who = String((l && l.who) || '');
      if (!C2_WHO.includes(who) && !C2_PROPS.includes(who)) say('quest-c2.json steps.' + st.say + ' is spoken by "' + who + '", which is neither a speaker nor a prop');
    }
    if (r.note && !st.pay) say('quest-c2.json steps.' + st.say + ' carries a receipt line and the step pays nothing');
    if (!r.note && st.pay) say('quest-c2.json steps.' + st.say + ' pays and has no receipt line');
    if (st.keep && !lines.some((l) => l && l.who === st.keep)) say(st.id + ' keeps the ' + st.keep + ' as a keepsake, and its scene never shows one');
    if (st.night && !lines.some((l) => l && l.who === 'dark')) say(st.id + ' is the night scene and has no `dark` moment — the night’s things would never go');
  }
  for (const p of C2_PROPS) if (!/^(note|dark)$/.test(p) && !String((copy.props || {})[p] || '')) say('quest-c2.json props.' + p + ' is empty');
}

// ── 3. every speaker has a portrait, every resident is the town's, every station a place ─────
for (const w of C2_WHO) if (w !== 'you' && !new RegExp('\\n\\s+' + w + ': \\{ n: ').test(engine)) say('world-quest.js WHO has no portrait for "' + w + '", and its lines would open on a blank face');
const cast = new Set(TOWN_CAST.map(([k]) => k));
for (const st of c2.STEPS) {
  if (st.kind !== 'talk') continue;
  if (st.who !== 'monument' && !cast.has(st.who)) say(st.id + ' belongs to "' + st.who + '", who is not one of the town’s residents');
  if (st.follow && st.follow !== st.who) say(st.id + '’s ! follows ' + st.follow + ' and the scene is ' + st.who + '’s');
  if (st.station && !new RegExp('\\b' + st.station + ': \\[\\[').test(life)) say(st.id + ' holds ' + st.who + ' at "' + st.station + '", which is not a place in town-life.js ST');
  if (!st.follow && !st.at) say(st.id + ' has no ! anywhere: it needs a resident to follow or a place to hang it');
}

// ── 4. the letters: the mailbox delivers them, and has the words for them ───────────────────
for (const st of c2.STEPS.filter((s) => s.kind === 'letter')) {
  if (!new RegExp("id: '" + st.mail + "'").test(home)) say(st.id + ' waits on the letter "' + st.mail + '", and banana-homestead.js POST_WHEN never delivers it');
  const w = post && post.letters && post.letters[st.mail];
  if (!w || !Array.isArray(w.lines) || !w.lines.length) say(st.id + ' waits on "' + st.mail + '", and homestead-post.json has no words for it');
}
const last = c2.STEPS[c2.STEPS.length - 1];
if (!last || last.kind !== 'letter' || last.mail !== 'questblack') say('the chapter must end on M.’s black letter (Trym’s call 3), and its last step is ' + (last ? last.id : 'missing'));

// ── 5. the ink stays on the town ────────────────────────────────────────────────────────────
for (const st of c2.STEPS.filter((s) => s.kind === 'trail')) {
  if (!Array.isArray(st.path) || st.path.length < 3) say(st.id + ' is a trail of fewer than three drops');
  for (const [x, y] of st.path || []) if (!(x > 60 && x < 2140 && y > 60 && y < 1240)) say(st.id + ' drops ink at ' + x + ',' + y + ', off the walkable town');
}

// ── 6. the statue the props draw is still the statue ────────────────────────────────────────
// quest-c2-fx.js draws the town's own statue by its generated name, ov-51.png, in the close-up, the night's cutaway and
// the inset where its water stops, and lays the water strip over it pixel for pixel. build-town-scene.py numbers its
// overlays, so a rebuild that moved the statue would put a lamp post in the story and nothing would say so.
const pngSize = (p) => { try { const b = readFileSync(join(ROOT, p)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); } catch (e) { return 'missing'; } };
if (pngSize('public/assets/town/ov-51.png') !== '110x206') say('public/assets/town/ov-51.png is ' + pngSize('public/assets/town/ov-51.png') + ', not the statue (110x206) that chapter two’s props draw by that name (quest-c2-fx.js)');
if (pngSize('public/assets/town/a-statuewater.png') !== '660x206') say('public/assets/town/a-statuewater.png is ' + pngSize('public/assets/town/a-statuewater.png') + ', not six frames of the statue’s water (660x206; tools/build-statue-water.py)');
const fxSrc = read('src/lib/quest-c2-fx.js');
for (const w of C2_PROPS.filter((p) => !/^(note|dark)$/.test(p))) if (!fxSrc.includes("'" + w + "'")) say('quest-c2-fx.js propEl draws no "' + w + '", and the copy file shows one');

// ── 7. the hoardings stay down ──────────────────────────────────────────────────────────────
// ⚠️ The Four Signatures (the chapter 2 of 21 Sep) was the only thing that could open a hoarded front, and it is retired.
// HOARD_ON now would board up the store, the post office and the café for EVERY player, for ever, with no way through.
if (HOARD_ON !== false) say('HOARD_ON is no longer false, and since The Four Signatures retired no chapter opens a hoarded front: it would board up the store, the post office and the café for every player for good (src/data/town/locks.js)');

if (fail.length) {
  console.error('❌ chapter two:\n' + fail.map((f) => '   · ' + f).join('\n'));
  process.exit(1);
}
console.log('✅ chapter two: ' + c2.STEPS.length + ' steps, every scene has its words, every speaker a face, both letters a sender,'
  + '\n   and the hoardings stay down');
