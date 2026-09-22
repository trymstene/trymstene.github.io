// 🗣🚦 NO WORDS TYPED INTO A TOAST (22 Sep 2026).
//
// CLAUDE.md: "CLAUDE WRITES CODE. GPT WRITES THE WORDS" — every line a player reads comes through the copy rig
// (node tools/copy.mjs <job>, approved into src/data/copy/*.json). The rule held for cards and dialogue and
// slipped for the smallest surface: a toast. Lines went straight into say('…') and toast('…'), including one a
// session added to banana-town.js on the day the rule was 10 days old. A rule that slips twice becomes a check.
//
// So: every call to say / toast / passToast / bigMoment in src/scripts/*.js is read, every string literal in its
// arguments is collected (inside template parts, ternaries and concatenations too), markup and entities are
// stripped, and a literal that still holds a LETTER fails. Emoji, punctuation, numbers, spaces and '' are not
// words and pass. Words come in through the imported copy: say(W.line), toast(fill(W.x, { name })).
//
// ⚠️ THE OWED LIST. Lines that were already typed in when this gate was born sit in tools/literal-says-owed.json,
// file by file, word for word — so the gate can go green today without pretending they are fine. It only ever
// SHRINKS: a line not on it fails (new, or an owed one edited — route it instead), and a line on it that is no
// longer in the code fails too (take it off, so the list stays the truth).
//
//   node tools/check-literal-says.mjs            the gate
//   node tools/check-literal-says.mjs --list     every offending literal, file by file (what the owed list holds)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src', 'scripts');
const OWED_FILE = join(ROOT, 'tools', 'literal-says-owed.json');
const CALLS = ['say', 'toast', 'passToast', 'bigMoment'];
// the copy accessors: a literal handed to one of these is a section key, e.g. say(lifeWords('toasts').road)
const KEY_CALL = /(?:lifeWords|copyOf)\(\s*$/;

// ── a small scanner: enough JavaScript to find a call's arguments and the strings inside them ──────────────
const ID = /[\w$]/;
// a `/` starts a regex (not a division) after an operator, an opener, a keyword or the start
const REGEX_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '']);
function prevSig(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return '';
  if (ID.test(src[j])) {
    let k = j;
    while (k >= 0 && ID.test(src[k])) k--;
    const word = src.slice(k + 1, j + 1);
    return ['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do'].includes(word) ? '(' : 'x';
  }
  return src[j];
}
function readString(src, i) {                      // src[i] is the quote; returns [value, index after]
  const q = src[i];
  let out = '';
  i++;
  while (i < src.length && src[i] !== q) {
    if (src[i] === '\\') { out += src[i + 1] || ''; i += 2; continue; }
    if (src[i] === '\n') break;                     // an unclosed string: stop at the line
    out += src[i++];
  }
  return [out, i + 1];
}
function skipRegex(src, i) {                       // src[i] is '/'
  i++;
  let cls = false;
  while (i < src.length && src[i] !== '\n') {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '[') cls = true;
    else if (c === ']') cls = false;
    else if (c === '/' && !cls) { i++; while (i < src.length && /[a-z]/i.test(src[i])) i++; return i; }
    i++;
  }
  return i;
}
// scan from i until the closer that balances `open`, collecting every string literal on the way
function scan(src, i, open, lits) {
  const PAIR = { '(': ')', '{': '}', '[': ']' };
  const stack = [PAIR[open]];
  while (i < src.length && stack.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === "'" || c === '"') {
      const [v, n] = readString(src, i);
      // a KEY into the approved copy (lifeWords('toasts'), copyOf('work')) names where the words live; it is not words
      if (!KEY_CALL.test(src.slice(Math.max(0, i - 24), i))) lits.push(v);
      i = n;
      continue;
    }
    if (c === '`') {
      i++;
      let cur = '';
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { cur += src[i + 1] || ''; i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { lits.push(cur); cur = ''; i = scan(src, i + 2, '{', lits); continue; }
        cur += src[i++];
      }
      lits.push(cur);
      i++;
      continue;
    }
    if (c === '/' && REGEX_AFTER.has(prevSig(src, i))) { i = skipRegex(src, i); continue; }
    if (c === '(' || c === '{' || c === '[') { stack.push(PAIR[c]); i++; continue; }
    if (c === stack[stack.length - 1]) { stack.pop(); i++; continue; }
    i++;
  }
  return i;
}
// is this literal WORDS? Markup, entities and a rig line's {placeholder} tokens are mechanics; a letter left over is a word.
const words = (s) => /\p{L}/u.test(String(s).replace(/<[^>]*>/g, '').replace(/&[#a-z0-9]+;/gi, '').replace(/\{[a-zA-Z]+\}/g, ''));

// ⚠️ CALLS ARE FOUND IN CODE ONLY. A comment that reads "…an old cabinet say (the rig's…" is not a call, and
// its apostrophe is not a string — so comments, strings and regexes are blanked first (same length, same
// newlines) and the call sites are looked for in what is left; a template's ${…} stays, because it is code.
function mask(src) {
  const a = src.split('');
  const blank = (from, to) => { for (let k = from; k < to && k < a.length; k++) if (a[k] !== '\n') a[k] = ' '; };
  const code = (i, closer) => {                   // walk code until `closer` (or the end); returns the index after it
    const stack = closer ? [closer] : [];
    while (i < src.length) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); blank(i, e < 0 ? src.length : e); i = e < 0 ? src.length : e; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const n = e < 0 ? src.length : e + 2; blank(i, n); i = n; continue; }
      if (c === "'" || c === '"') { const [, n] = readString(src, i); blank(i, n); i = n; continue; }
      if (c === '`') {
        let j = i + 1, from = i;
        while (j < src.length && src[j] !== '`') {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '$' && src[j + 1] === '{') { blank(from, j); j = code(j + 2, '}'); from = j; continue; }
          j++;
        }
        blank(from, j + 1);
        i = j + 1;
        continue;
      }
      if (c === '/' && REGEX_AFTER.has(prevSig(src, i))) { const n = skipRegex(src, i); blank(i, n); i = n; continue; }
      if (c === '(' || c === '{' || c === '[') { stack.push({ '(': ')', '{': '}', '[': ']' }[c]); i++; continue; }
      if (stack.length && c === stack[stack.length - 1]) { stack.pop(); i++; if (closer && !stack.length) return i; continue; }
      i++;
    }
    return i;
  };
  code(0, '');
  return a.join('');
}

export function offenders(src) {
  const out = [];
  const re = new RegExp('(?<![\\w$])(' + CALLS.join('|') + ')\\s*\\(', 'g');
  const masked = mask(src);
  let m;
  while ((m = re.exec(masked))) {
    const before = src.slice(Math.max(0, m.index - 16), m.index);
    if (/function\s*\*?\s*$/.test(before)) continue;           // a definition, not a call
    const lits = [];
    const end = scan(src, m.index + m[0].length, '(', lits);
    const after = src.slice(end).match(/^\s*(\S)/);
    if (after && after[1] === '{') continue;                    // a method shorthand: say(t) { … }
    const line = src.slice(0, m.index).split('\n').length;
    for (const l of lits) if (words(l)) out.push({ call: m[1], line, text: l.trim() });
  }
  return out;
}

// 🧪 THE GATE PROVES IT BITES, every run (a gate once passed with the thing it guarded deleted): these must be
// caught, and these must not.
const MUST_CATCH = [
  "say('Back down the road to the park…');",
  "toast('🪙 +' + coinsPaid(n) + ' — the stall took ' + k, 3200);",
  "say(ok ? 'yes, done' : W.no);",
  'say(`You have ${n} apples`);',
  "passToast('<b>' + 'LOGGED OUT' + '</b>');",
  "bigMoment('HIRED', sub);",
  "api.say('A prize: ' + p);",
  "say(lifeWords('toasts') || 'a fallback line');",
];
const MUST_PASS = [
  'say(W.line);',
  "say('');",
  "toast('🪙 +' + coinsPaid(n), 2600);",
  "say(lifeWords('toasts').road);",
  "say(t.replace('{name}', name));",
  "say('<b>' + esc(t) + '</b>');",
  "function say(text) { toastEl.textContent = text; }",
  "const api = { say(t) { return t; } };",
  "// say('only a comment')\nconst x = 1;",
  "const s = \"say('inside a string')\";",
];
const selfBad = [
  ...MUST_CATCH.filter((c) => !offenders(c).length).map((c) => 'missed: ' + c),
  ...MUST_PASS.filter((c) => offenders(c).length).map((c) => 'wrongly caught: ' + c),
];
if (selfBad.length) {
  console.error('✗ the toast gate does not work as it says:\n  ' + selfBad.join('\n  '));
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.js')).sort();
const found = {};
for (const f of files) {
  const o = offenders(readFileSync(join(DIR, f), 'utf8'));
  if (o.length) found[f] = o;
}

if (process.argv.includes('--list')) {
  for (const [f, o] of Object.entries(found)) {
    console.log('\n' + f + ' — ' + o.length);
    for (const x of o) console.log('  ' + String(x.line).padStart(5) + '  ' + x.call + '  ' + JSON.stringify(x.text));
  }
  process.exit(0);
}

const owed = existsSync(OWED_FILE) ? JSON.parse(readFileSync(OWED_FILE, 'utf8')) : {};
const bad = [], stale = [];
let owedN = 0;
for (const f of new Set([...Object.keys(found), ...Object.keys(owed.files || {})])) {
  const left = [...(((owed.files || {})[f]) || [])];
  owedN += left.length;
  for (const x of found[f] || []) {
    const k = left.indexOf(x.text);
    if (k >= 0) { left.splice(k, 1); continue; }
    bad.push(f + ':' + x.line + '  ' + x.call + '(…' + JSON.stringify(x.text) + '…)');
  }
  for (const t of left) stale.push(f + '  ' + JSON.stringify(t));
}
if (bad.length || stale.length) {
  if (bad.length) {
    console.error('✗ words typed straight into a toast (' + bad.length + '):\n  ' + bad.join('\n  '));
    console.error('  → put the line in a copy job (tools/copy-jobs.mjs + a brief), run node tools/copy.mjs <job>, approve,');
    console.error('    and pass the approved words in: say(W.line), toast(fill(W.x, { name })). CLAUDE.md: GPT writes the words.');
  }
  if (stale.length) {
    console.error('✗ owed lines that are no longer in the code — take them off tools/literal-says-owed.json (' + stale.length + '):\n  ' + stale.join('\n  '));
  }
  process.exit(1);
}
console.log('✓ toasts: no words typed into say/toast/passToast/bigMoment in src/scripts (' + owedN + ' older lines still owed, file by file, in tools/literal-says-owed.json)');
