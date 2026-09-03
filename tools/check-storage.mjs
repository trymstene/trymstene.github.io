#!/usr/bin/env node
// 🗄 THE STORAGE GATE — every key this site writes to a player's device must
// say whether it TRAVELS with them.
//
// Writing to the browser is one line. It works at once, it survives a reload,
// and on the machine you are building on it looks completely correct. Nothing
// fails, nothing warns, and the feature ships holding a player's progress on
// exactly one device. That is not a hypothetical: the homestead pantry and the
// questline chapter both shipped that way and were only found months later by
// asking what a player on a second device would actually see. The volleyball
// best made three.
//
// So the list stops being something we remember and becomes something the
// build knows. Add a key, declare it. The declaration is the design decision,
// written down at the moment it is made instead of reconstructed later.
//
//   tools/storage-keys.mjs   what every key is, and whether it follows the pass
//
// Run: node tools/check-storage.mjs        (add --list to dump what it found)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KEYS, ALLOW_DYNAMIC } from './storage-keys.mjs';

// ⚠️ a URL pathname keeps its %20 — this repo lives under "Web Development"
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIRS = [join(ROOT, 'src'), join(ROOT, 'public', 'js')];
const TRAVELS = ['pass', 'yard', 'server', 'no'];

const walk = (dir, out = []) => {
  let entries;
  try { entries = readdirSync(dir); } catch (e) { return out; }
  for (const e of entries) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(js|mjs|astro)$/.test(f)) out.push(f);
  }
  return out;
};

// `const KEY = 'hs-v1';` — the indirection almost every module uses, including
// the comma form (`const EV_KEY = 'pass-ev-v1', EV_CAP = 800;`). A name bound
// to two different literals in one file is ambiguous and stays unresolved.
const constsIn = (src) => {
  const map = new Map(), bad = new Set();
  const re = /\b([A-Za-z_$][\w$]*)\s*=\s*'([^'\n]{2,64})'\s*[,;)\n]/g;
  let m;
  while ((m = re.exec(src))) {
    if (map.has(m[1]) && map.get(m[1]) !== m[2]) bad.add(m[1]);
    else map.set(m[1], m[2]);
  }
  for (const b of bad) map.delete(b);
  return map;
};

// every storage call, with whatever sits in the first argument
const CALL = /\b(?:localStorage|sessionStorage)\s*\.\s*(?:get|set|remove)Item\s*\(\s*([^,)]+)/g;

function keysIn(file) {
  const src = readFileSync(file, 'utf8');
  const consts = constsIn(src);
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const found = [], unresolved = [];
  let m;
  while ((m = CALL.exec(src))) {
    const arg = m[1].trim();
    const line = src.slice(0, m.index).split('\n').length;
    const lit = arg.match(/^'([^'\n]*)'/) || arg.match(/^`([^`$\n]*)`/);
    const joined = /\+/.test(arg) || /\$\{/.test(arg);
    if (lit) { found.push({ key: lit[1] + (joined ? '*' : ''), file: rel, line }); continue; }
    const id = arg.match(/^([A-Za-z_$][\w$]*)/);
    if (id && consts.has(id[1])) { found.push({ key: consts.get(id[1]) + (joined ? '*' : ''), file: rel, line }); continue; }
    unresolved.push({ arg: arg.slice(0, 40), file: rel, line });
  }
  return { found, unresolved };
}

const all = new Map(), dyn = [];
for (const dir of DIRS) {
  for (const f of walk(dir)) {
    const { found, unresolved } = keysIn(f);
    for (const k of found) {
      if (!all.has(k.key)) all.set(k.key, []);
      all.get(k.key).push(k.file + ':' + k.line);
    }
    dyn.push(...unresolved);
  }
}

if (process.argv.includes('--list')) {
  for (const [k, at] of [...all].sort()) {
    const d = KEYS[k];
    console.log((d ? d.travels.padEnd(7) : 'UNKNOWN').padEnd(9), k.padEnd(24), at[0]);
  }
  process.exit(0);
}

const problems = [];

// 1. a key the build has never been told about
for (const [k, at] of all) {
  if (KEYS[k]) continue;
  problems.push(`a key nobody has declared: '${k}'\n      first written at ${at[0]}`
    + `\n      → add it to tools/storage-keys.mjs and say whether it follows the player.`
    + `\n        travels: 'pass' rides the pass blob, 'yard' rides the homestead,`
    + `\n        'server' is kept server-side by identity, 'no' is deliberately this device only.`);
}

// 2. a declaration that has outlived its key — the list has to stay honest
for (const k of Object.keys(KEYS)) {
  if (!all.has(k) && !KEYS[k].gone) problems.push(`'${k}' is declared but nothing writes it any more`
    + `\n      → delete it from tools/storage-keys.mjs, or mark { gone: 1 } if it is a migration read.`);
}

// 3. a shape check on the declarations themselves
for (const [k, d] of Object.entries(KEYS)) {
  if (!TRAVELS.includes(d.travels)) problems.push(`'${k}' declares travels: ${JSON.stringify(d.travels)} — must be one of ${TRAVELS.join(', ')}`);
  if (!d.why || d.why.length < 8) problems.push(`'${k}' needs a why: the next person has to know if it was a decision or an oversight`);
}

// 4. anything that belongs to the PASS must be wiped when somebody else signs
//    in on this browser, or one person's progress greets the next
const sync = readFileSync(join(ROOT, 'src/lib/pass-sync.js'), 'utf8');
const wipeBlock = (sync.match(/const WORLD_KEYS = \[([\s\S]*?)\];/) || [])[1] || '';
const syncConsts = constsIn(sync);
const wiped = new Set();
for (const m of wipeBlock.matchAll(/'([^'\n]+)'/g)) wiped.add(m[1]);
for (const m of wipeBlock.matchAll(/\b([A-Z_][A-Z_0-9]*)\b/g)) if (syncConsts.has(m[1])) wiped.add(syncConsts.get(m[1]));
for (const [k, d] of Object.entries(KEYS)) {
  if (d.travels !== 'pass' || d.gone) continue;
  if (!wiped.has(k)) problems.push(`'${k}' follows the pass but is not in WORLD_KEYS (src/lib/pass-sync.js)`
    + `\n      → a shared browser would hand it to whoever signs in next.`);
}

// 5. a key built at runtime is fine, but the place that builds it is named
for (const u of dyn) {
  if (ALLOW_DYNAMIC.some((a) => u.file === a.file && u.arg.startsWith(a.arg))) continue;
  problems.push(`a storage key built at runtime that nothing explains: ${u.arg} …`
    + `\n      at ${u.file}:${u.line}`
    + `\n      → resolve it to a literal, or name it in ALLOW_DYNAMIC in tools/storage-keys.mjs with a note.`);
}

if (problems.length) {
  console.error('\n❌ storage gate\n');
  for (const p of problems) console.error('   • ' + p + '\n');
  console.error(`   ${problems.length} to settle. Run with --list to see everything it found.\n`);
  process.exit(1);
}
const rides = Object.values(KEYS).filter((d) => d.travels !== 'no').length;
console.log(`✅ storage gate — ${all.size} keys on the device, ${rides} follow the player, all declared`);
