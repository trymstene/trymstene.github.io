// 🚦 THE GATE RUNNER — every fast gate, in one command, in about a second.
//
// Why this exists (Trym, 12 Sep 2026): *"after sessions are compacting, and you
// loose context, things starts to shake when keeping things consistent, even with
// .md files full of information — like the HUD not including the action bar, or
// the Park not having a footer added … how can it be guaranteed without me having
// to think that i need to remind you?"*
//
// It cannot be guaranteed by a document. A document is advisory and depends on
// being read at the right moment. What has actually held in this repo is the
// mechanical half: the storage gate has never let an undeclared key through, and
// the HUD rule stopped drifting the day it became a grep instead of a paragraph.
// The rules that drifted — the footer, the dialogue template — were the ones with
// prose and no check.
//
// So: this runs as a Stop hook (.claude/settings.json). A turn cannot end while a
// gate is red, whoever is at the keyboard and whatever they remember. The same
// gates run in CI, so the push is guarded too.
//
// Only FAST, SOURCE-ONLY gates belong here (~1 s total) — see the note below.
//
// Run: node tools/check-all.mjs [--quiet]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// ⚠️ SOURCE-ONLY gates. A gate that reads dist/ (the pulse gate, the budget gate)
// would go red whenever the build is stale, missing or half-written, and a hook
// that cries wolf gets switched off — which is worse than no hook. Those two run
// in CI and in the pre-push routine, after a real build.
const GATES = [
  ['design', 'tools/check-design.mjs', []],
  ['storage', 'tools/check-storage.mjs', []],
  ['copy', 'tools/check-copy.mjs', []],
  ['art', 'tools/check-wearart.mjs', []],
  ['lanes', 'tools/check-town-lanes.mjs', []],
  ['wardrobe', 'tools/check-wardrobe-rows.mjs', []],
  ['generated', 'tools/build-worker-allowlists.mjs', ['--check']],
];
const quiet = process.argv.includes('--quiet');
const failed = [];
const skipped = [];
const passed = [];

for (const [name, file, args] of GATES) {
  if (!existsSync(file)) { skipped.push(name); continue; }
  const r = spawnSync(process.execPath, [file, ...args], { encoding: 'utf8' });
  if (r.status === 0) { passed.push(name); continue; }
  failed.push({ name, file, out: ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-14).join('\n') });
}

const line = `gates: ${passed.length} pass${failed.length ? `, ${failed.length} FAIL` : ''}${skipped.length ? `, ${skipped.length} not built yet (${skipped.join(', ')})` : ''}`;

if (!failed.length) {
  if (!quiet) console.log('✅ ' + line);
  process.exit(0);
}

// exit 2 = a blocking error for a hook: the reason goes back to whoever is working
console.error('❌ ' + line);
for (const f of failed) {
  console.error(`\n--- ${f.name} (node ${f.file}) ---\n${f.out}`);
}
console.error('\nFix the gate, or say plainly that it was already red before this work.');
process.exit(2);
