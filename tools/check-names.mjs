// 🔤🚦 EVERY NAME A PLAYER CHOSE GOES THROUGH ONE RULE.
//
// Trym, 21 Sep 2026, after the address book showed its first real stranger — "𝐃𝐉𝐂𝐎𝐎𝐊𝐈𝐄", in
// mathematical bold, in whatever font the browser fell back to:
//   *"we should probably write that in as a rule everywhere so we avoid things breaking because
//   users and kids format their usernames / pass names in crazy ways"*
// …and then, when the first rule dropped Cyrillic, Greek and Japanese outright:
//   *"fallback font is fine, let them render"*
//
// A rule stated once is a paragraph nobody reads (CLAUDE.md). This is the check. It holds:
//   1. src/lib/player-name.js is the ONLY definition, and nobody folds names on their own.
//   2. every place a name is BORN or STORED runs it — both workers, and both fields a player types
//      their own name into.
//   3. the folding still folds, the stunts still go, and EVERY REAL WRITING SYSTEM STILL RENDERS.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cleanName } from '../src/lib/player-name.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch (e) { return ''; } };
const fail = [];
const ch = (n) => String.fromCharCode(n);   // ⚠️ built, never typed: a literal invisible in source is unreadable

// ── 1. the doors a name comes in by ─────────────────────────────────────────────────────────
// ⚠️ ADD A SURFACE THAT TAKES A NAME AND THIS LIST IS WHERE YOU SAY SO. That is the point of it:
// the next one is closed until somebody writes it down here deliberately.
const DOORS = [
  ['worker-rave/src/index.js', 'the world’s own store: yard names, guestbook signatures, who lives here'],
  ['worker-pass/src/index.js', 'the pass, where a name is BORN and merges across devices'],
  ['src/scripts/banana-pass-page.js', 'the field on My Pass'],
  ['src/lib/banana-id.js', 'the world’s own “what shall we call you” card'],
];
for (const [file, what] of DOORS) {
  const src = read(file);
  if (!src) { fail.push(file + ' is missing — ' + what); continue; }
  if (!/player-name\.js/.test(src)) fail.push(file + ' does not import the name rule (' + what + ')');
  if (!/cleanName\(/.test(src)) fail.push(file + ' imports the name rule and never calls it (' + what + ')');
}

// ── 2. one definition ───────────────────────────────────────────────────────────────────────
const lib = read('src/lib/player-name.js');
if (!/normalize\('NFKC'\)/.test(lib)) {
  fail.push('player-name.js no longer folds with NFKC — that is the step that turns mathematical bold '
    + 'back into letters rather than refusing it, and NFKD would split the accent off "Renée" for the '
    + 'mark step to eat');
}
for (const [file] of DOORS) {
  const src = read(file);
  if (/normalize\('NFK/.test(src) && !/player-name\.js/.test(src)) {
    fail.push(file + ' folds names itself instead of using the one rule');
  }
}

// ── 3. what it must do ──────────────────────────────────────────────────────────────────────
const CASES = [
  // the stunts fold to the letters underneath — the player keeps the name they chose
  ['\u{1D403}\u{1D409}\u{1D402}\u{1D40E}\u{1D40E}\u{1D40A}\u{1D408}\u{1D404}', 'DJCOOKIE', 'mathematical bold folds to letters'],
  ['Ｆｕｌｌｗｉｄｔｈ', 'Fullwidth', 'fullwidth folds'],
  ['ⓒⓘⓡⓒⓛⓔⓓ', 'circled', 'circled letters fold'],

  // ⭐ EVERY REAL WRITING SYSTEM RENDERS (Trym: "fallback font is fine, let them render"). These are
  // the cases that stop the rule quietly narrowing back to Latin — the first version returned '' for
  // all four, which would have erased a real person's name from every surface in the world.
  ['Пётр', 'Пётр', 'Cyrillic renders'],
  ['こんにちは', 'こんにちは', 'Japanese renders'],
  ['Ωμεγα', 'Ωμεγα', 'Greek renders'],
  ['مرحبا', 'مرحبا', 'Arabic renders'],
  ['नमस्ते', 'नमस्ते', 'Devanagari renders, marks and all'],
  ['🍌 Banana', '🍌 Banana', 'an emoji is a character too'],
  ['Renée', 'Renée', 'a real accent is kept'],
  ['Bjørn', 'Bjørn', '…and a Norwegian one'],

  // …and what is NOT writing still goes
  ['a' + ch(0x200B) + 'b' + ch(0x202E) + 'c', 'abc', 'a zero-width and a direction OVERRIDE go'],
  [ch(7) + 'bell', 'bell', 'a control character goes'],
  // ⚠️ the FIRST mark composes into the letter (NFKC turns e + ́ into é) and the cap applies to what
  //    is left — so six marks come out as é plus two, not e plus two.
  ['e' + ch(0x301).repeat(6) + 'zalgo', 'é' + ch(0x301).repeat(2) + 'zalgo', 'a zalgo stack is capped at two marks'],
  ['•••', '', 'a name of pure punctuation is not a name'],
  ['   spaced   out   ', 'spaced out', 'spacing is tidied'],
];
for (const [input, want, what] of CASES) {
  const got = cleanName(input);
  if (got !== want) fail.push('the rule broke: ' + what + ' — ' + JSON.stringify(input) + ' gave ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
}

// ── 4. a name of unknown direction is isolated where it is SHOWN ────────────────────────────
// ⚠️ THE OTHER HALF OF THE BIDI FIX. Stripping the overrides stops a name reordering the row it sits
// in; it does not stop a right-to-left name dragging the punctuation beside it around. That is what
// `unicode-bidi: isolate` on the element does, and it belongs to the surface rather than the rule.
const SHOWN = [['public/css/town-post.css', 'the mailbox and the address book']];
for (const [file, what] of SHOWN) {
  const css = read(file);
  if (css && !/unicode-bidi:\s*isolate/.test(css)) {
    fail.push(file + ' shows player names and never isolates them (' + what + ') — a right-to-left name '
      + 'will reorder the text beside it');
  }
}

if (fail.length) {
  console.error('❌ names:\n' + fail.map((f) => '   · ' + f).join('\n'));
  process.exit(1);
}
console.log('✅ names: one rule (src/lib/player-name.js) at all ' + DOORS.length + ' doors, ' + CASES.length + ' cases — the stunts fold,\n'
  + '   every real script renders, and what is not writing is stripped');
