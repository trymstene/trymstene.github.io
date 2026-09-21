// 🔤🚦 EVERY NAME A PLAYER CHOSE GOES THROUGH ONE RULE.
//
// Trym, 21 Sep 2026, after the address book showed its first real stranger — "𝐃𝐉𝐂𝐎𝐎𝐊𝐈𝐄", in
// mathematical bold, in whatever font the browser fell back to:
//   *"we should probably write that in as a rule everywhere so we avoid things breaking because
//   users and kids format their usernames / pass names in crazy ways"*
//
// A rule stated once is a paragraph nobody reads (CLAUDE.md). This is the check.
//
// It holds three things:
//   1. src/lib/player-name.js is the ONLY definition — the ranges are the shipped fonts' own
//      unicode-range, so a second copy somewhere would drift away from what can actually be drawn.
//   2. every place a name is BORN or STORED folds it: both workers, and both fields a player types
//      their own name into.
//   3. and the folding itself still does what it says, on the stunts that prompted it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cleanName } from '../src/lib/player-name.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch (e) { return ''; } };
const fail = [];

// ── 1. the places a name is accepted, and what each must run ────────────────────────────────
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

// ── 2. one definition, and it is the font's range ───────────────────────────────────────────
const lib = read('src/lib/player-name.js');
if (!/normalize\('NFKC'\)/.test(lib)) {
  fail.push('player-name.js no longer folds with NFKC — that is the step that turns \U0001d403\U0001d409… back into letters '
    + 'rather than refusing it, and NFKD would split an accent off "Renée" for the next step to eat');
}
for (const [file] of DOORS) {
  const src = read(file);
  if (/normalize\('NFK/.test(src) && !/player-name\.js/.test(src)) {
    fail.push(file + ' folds names itself instead of using the one rule');
  }
}
// the ranges have to match what public/css/fonts.css actually ships
const fonts = read('public/css/fonts.css');
if (fonts && !/unicode-range/.test(fonts)) {
  fail.push('public/css/fonts.css declares no unicode-range — the name rule is derived from it, so it '
    + 'cannot be checked and may now be allowing letters the fonts cannot draw');
}

// ── 3. and the rule still does what it promises ─────────────────────────────────────────────
const CASES = [
  ['\u{1D403}\u{1D409}\u{1D402}\u{1D40E}\u{1D40E}\u{1D40A}\u{1D408}\u{1D404}', 'DJCOOKIE', 'mathematical bold folds to letters'],
  ['Ｆｕｌｌｗｉｄｔｈ', 'Fullwidth', 'fullwidth folds'],
  ['ⓒⓘⓡⓒⓛⓔⓓ', 'circled', 'circled letters fold'],
  ['Renée', 'Renée', 'a real accent is kept — the font has it'],
  ['Bjørn', 'Bjørn', '…and so is a Norwegian one'],
  ['Łukasz', 'Łukasz', '…and Latin Extended-A'],
  ['🍌 Banana 🍌', 'Banana', 'an emoji has no glyph and goes, the name stays'],
  ['a​b‮c', 'abc', 'zero-widths and bidi overrides go'],
  ['é́́́zalgo', 'ézalgo', 'a zalgo stack collapses'],
  ['•••', '', 'a name of pure punctuation is not a name'],
  // ⚠️ THESE THREE ARE THE RANGE ITSELF, and without them the allowed set could be widened to the
  // whole of Unicode and every other case would still pass. The shipped fonts are latin +
  // latin-ext: a Cyrillic, Greek or Japanese name has no glyph here and would render in whatever
  // the browser fell back to. It is dropped rather than drawn badly, and the surface falls back
  // to the house name or the address — which is a real cost, and the honest one until the fonts
  // carry those subsets.
  ['Пётр', '', 'Cyrillic has no glyph in the shipped fonts'],
  ['こんにちは', '', '…nor Japanese'],
  ['Ωμεγα', '', '…nor Greek'],
  ['   spaced   out   ', 'spaced out', 'spacing is tidied'],
];
for (const [input, want, what] of CASES) {
  const got = cleanName(input);
  if (got !== want) fail.push('the rule broke: ' + what + ' — ' + JSON.stringify(input) + ' gave ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
}

if (fail.length) {
  console.error('❌ names:\n' + fail.map((f) => '   · ' + f).join('\n'));
  process.exit(1);
}
console.log('✅ names: one rule (src/lib/player-name.js), run at all ' + DOORS.length + ' doors a name comes in by,\n'
  + '   and ' + CASES.length + ' stunts still fold to something the shipped fonts can draw');
