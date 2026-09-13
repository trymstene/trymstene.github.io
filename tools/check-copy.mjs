#!/usr/bin/env node
// ✍️ THE COPY GATE — the mechanical half of docs/voice.md, enforced on every
// file the game imports out of src/data/copy/.
//
// Copy is now written by a model and approved by a human, which means the thing
// that used to protect it (one person typing every line) is gone. These are the
// faults that shipped before and can be caught by machine: a line too long for
// its card, an emoji in a spoken line, a straight apostrophe, a placeholder left
// unfilled, a published timetable, an outside brand name, a cast member renamed.
// Everything else is judgement and lives in the voice guide.
//
// Run: node tools/check-copy.mjs
import { readdirSync, readFileSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jobs, jobForFile, lockedTops, mergeLocked, schemaFor } from './copy-jobs.mjs';
import { checkFile, report, strings, patternOf } from './copy-rules.mjs';

const ROOT = process.cwd();
const DIR = 'src/data/copy';
const VOICE = 'docs/voice.md';
const problems = [];
let files = 0, lines = 0;

if (!existsSync(join(ROOT, DIR))) {
  console.error(`✗ ${DIR} is missing — the approved copy the game imports lives there`);
  process.exit(1);
}

for (const name of readdirSync(join(ROOT, DIR)).filter((f) => f.endsWith('.json')).sort()) {
  const rel = `${DIR}/${name}`;
  const job = jobForFile(name);
  if (!job) { problems.push(`${rel} — no job in tools/copy-jobs.mjs is called "${name.replace(/\.json$/, '')}", so nothing knows the rules for it`); continue; }
  let data;
  try { data = JSON.parse(readFileSync(join(ROOT, rel), 'utf8')); }
  catch (e) { problems.push(`${rel} — does not parse: ${e.message}`); continue; }
  const { bad, warn } = checkFile(job, data, { draft: false });
  files++;
  lines += [...strings(data)].length;
  if (warn.length) console.log(`⚠️  ${rel}: ${warn.length} over the guide's target, under the limit\n${report(warn)}`);
  if (bad.length) problems.push(`${rel} — ${bad.length} violation${bad.length === 1 ? '' : 's'}:\n${report(bad)}`);
  else console.log(`✓ ${rel}: ${[...strings(data)].length} strings, all clean (${job.title})`);
}

// a job whose brief has been deleted cannot be rewritten, and a job with no
// approved file has nothing for the game to import
for (const j of jobs()) {
  if (!existsSync(join(ROOT, j.brief))) problems.push(`${j.id} — its brief ${j.brief} is gone; GPT would be asked to write blind`);
  const has = existsSync(join(ROOT, j.approved));
  // ⏳ A NEW JOB WAITING ON TRYM is not a broken one. A job is registered, briefed and
  // drafted before he has read it, and the draft is gitignored, so "no approved file" is
  // the correct state for a day or two — failing on it would hold every gate and all of
  // CI red until he got to his desk, which is how a gate gets switched off.
  // `awaiting: true` says that out loud, and the flag cannot be left behind: the moment
  // the approved file appears, the gate fails until somebody removes it.
  if (!has && j.awaiting) console.log(`⏳ ${j.id}: no approved copy yet — the draft is on Trym's desk at /dev/copy/. Nothing imports ${j.approved} until he says so.`);
  else if (!has) problems.push(`${j.id} — no approved copy at ${j.approved} (write one with \`node tools/copy.mjs ${j.id}\`, review at /dev/copy/, then --approve)`);
  else if (j.awaiting) problems.push(`${j.id} — ${j.approved} exists now, so drop \`awaiting: true\` from its entry in tools/copy-jobs.mjs`);
}

// 🔒 THE LOCK, TESTED — not described. A locked section is copy Trym wrote himself
// (Old Peel). The gate poisons a draft and proves his words still win, every run.
//
// ⚠️ It runs the REAL `node tools/copy.mjs --approve <job>` in a throwaway copy of the
// repo, not the merge helper on its own. An earlier version called mergeLocked directly
// and was self-referential: an audit deleted the splice from copy.mjs's approve() and
// this gate stayed green while Old Peel's greeting was overwritten. A test that only
// proves a helper is faithful proves nothing about whether anyone still calls it.
function locksHold(j, locked) {
  const sand = mkdtempSync(join(tmpdir(), 'copylock-'));
  try {
    for (const rel of ['tools/copy.mjs', 'tools/copy-jobs.mjs', 'tools/copy-rules.mjs', VOICE, j.brief, j.approved]) {
      mkdirSync(join(sand, rel, '..'), { recursive: true });
      copyFileSync(join(ROOT, rel), join(sand, rel));
    }
    const approved = JSON.parse(readFileSync(join(ROOT, j.approved), 'utf8'));
    // A draft that would be ACCEPTED on every other count, and differs only in the locked
    // words. That matters: a poison that breaks the shape makes approve() die before it
    // writes, which is red for the wrong reason and hides a real lock failure behind
    // "inconclusive". So only `prose` fields are rewritten — never ids, keys or names —
    // each to the same length with its {placeholders} intact, which keeps every mechanical
    // rule (length, apostrophes, brands, placeholders) satisfied.
    const rewrite = (v, path) => {
      if (typeof v === 'string') {
        const spec = j.fields[patternOf(path)];
        if (!spec || spec.kind !== 'prose') return v;
        return v.replace(/\{[^}]*\}|[A-Za-z]/g, (m) => (m.length > 1 ? m : 'x'));
      }
      if (Array.isArray(v)) return v.map((x, i) => rewrite(x, `${path}[${i}]`));
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x, `${path}.${k}`)]));
      return v;
    };
    const poison = JSON.parse(JSON.stringify(approved));
    for (const k of locked) poison[k] = rewrite(poison[k], k);
    poison._meta = { job: j.id, model: 'the-lock-test', api: 'none', when: '1970-01-01T00:00:00.000Z' };
    mkdirSync(join(sand, j.out, '..'), { recursive: true });
    writeFileSync(join(sand, j.out), JSON.stringify(poison, null, 2) + '\n');

    const run = spawnSync(process.execPath, ['tools/copy.mjs', '--approve', j.id], { cwd: sand, encoding: 'utf8' });
    const after = JSON.parse(readFileSync(join(sand, j.approved), 'utf8'));
    const out = [];
    for (const k of locked) {
      if (JSON.stringify(after[k]) !== JSON.stringify(approved[k])) {
        out.push(`${j.id} — LOCK BROKEN: \`node tools/copy.mjs --approve ${j.id}\` overwrote "${k}" in ${j.approved}. ${j.locked[k]}`
          + `\n      the splice lives in approve() in tools/copy.mjs (holdLocked) and in mergeLocked in tools/copy-jobs.mjs`
          + (run.status ? `\n      (the command also exited ${run.status})` : ''));
      }
    }
    // the other half: --approve must have RUN to the write. A command that died early
    // leaves the locked words intact for the wrong reason and would pass silently.
    const wrote = run.status === 0 && String(run.stdout || '').includes(`✓ ${j.approved}:`);
    if (!wrote) {
      out.push(`${j.id} — the lock test is inconclusive: \`--approve\` never reached the write, so it never had the chance to touch ${locked.join(', ')}`
        + `\n      exit ${run.status}` + (run.stderr ? ` · ${String(run.stderr).trim().split('\n')[0]}` : '')
        + (run.error ? ` · ${run.error.message}` : ''));
    }
    return out;
  } catch (e) {
    return [`${j.id} — the lock test could not run: ${e.message}`];
  } finally {
    rmSync(sand, { recursive: true, force: true });
  }
}

for (const j of jobs()) {
  const locked = lockedTops(j);
  if (!locked.length) continue;
  const at = join(ROOT, j.approved);
  if (!existsSync(at)) { problems.push(`${j.id} — locks ${locked.join(', ')} but ${j.approved} is gone; there is nothing left to protect`); continue; }
  let approved;
  try { approved = JSON.parse(readFileSync(at, 'utf8')); } catch (e) { continue; }   // already reported above
  const gone = locked.filter((k) => approved[k] === undefined);
  if (gone.length) { problems.push(`${j.id} — "${gone.join('", "')}" is locked but missing from ${j.approved}; the words it protects are not there`); continue; }

  // 1 · the helper is faithful
  let held = null;
  const poison = { ...approved };
  for (const k of locked) poison[k] = { poisoned: 'a draft trying to overwrite words it does not own' };
  try { held = mergeLocked(j, poison, approved); }
  catch (e) { problems.push(`${j.id} — the lock threw while protecting ${locked.join(', ')}: ${e.message}`); }
  for (const k of locked) {
    if (held && JSON.stringify(held[k]) !== JSON.stringify(approved[k])) {
      problems.push(`${j.id} — mergeLocked let a draft through for "${k}". ${j.locked[k]}`);
    }
    // 2 · the model is never asked for the words in the first place
    const schema = schemaFor(j);
    if ((schema.properties || {})[k] || (schema.required || []).includes(k)) {
      problems.push(`${j.id} — "${k}" is locked but still in the schema the writer answers in, so the model is being asked for words it must not write`);
    }
  }
  // 3 · and the command a person actually types still honours it
  problems.push(...locksHold(j, locked));
  console.log(`🔒 ${j.id}: ${locked.map((k) => `"${k}"`).join(', ')} held through a real --approve — ${locked.map((k) => j.locked[k]).join(' ')}`);
}

if (problems.length) {
  console.error('\n✗ copy gate:\n' + problems.map((p) => '  ' + p).join('\n')
    + '\n\n  the rules are tools/copy-rules.mjs, the limits are tools/copy-jobs.mjs, the voice is docs/voice.md'
    + '\n  read the drafts side by side at /dev/copy/');
  process.exit(1);
}
console.log(`✓ copy: ${lines} strings across ${files} file${files === 1 ? '' : 's'} pass every mechanical rule in docs/voice.md`);
