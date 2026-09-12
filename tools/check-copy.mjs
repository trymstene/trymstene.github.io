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
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { jobs, jobForFile, lockedTops, mergeLocked, schemaFor } from './copy-jobs.mjs';
import { checkFile, report, strings } from './copy-rules.mjs';

const ROOT = process.cwd();
const DIR = 'src/data/copy';
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
  if (!existsSync(join(ROOT, j.approved))) problems.push(`${j.id} — no approved copy at ${j.approved} (write one with \`node tools/copy.mjs ${j.id}\`, review at /dev/copy/, then --approve)`);
}

// 🔒 THE LOCK, TESTED — not described. A locked section is copy Trym wrote
// himself (Old Peel), and the only thing standing between his words and a
// `--approve` is tools/copy-jobs.mjs `mergeLocked`. So the gate poisons a draft
// and proves the approved words still win, every run, in about a millisecond.
// If someone simplifies the merge away, this is what says so.
for (const j of jobs()) {
  const locked = lockedTops(j);
  if (!locked.length) continue;
  const at = join(ROOT, j.approved);
  if (!existsSync(at)) { problems.push(`${j.id} — locks ${locked.join(', ')} but ${j.approved} is gone; there is nothing left to protect`); continue; }
  let approved;
  try { approved = JSON.parse(readFileSync(at, 'utf8')); } catch (e) { continue; }   // already reported above
  const gone = locked.filter((k) => approved[k] === undefined);
  if (gone.length) { problems.push(`${j.id} — "${gone.join('", "')}" is locked but missing from ${j.approved}; the words it protects are not there`); continue; }

  const poison = { ...approved };
  for (const k of locked) poison[k] = { poisoned: 'a draft trying to overwrite words it does not own' };
  let held = null;
  try { held = mergeLocked(j, poison, approved); }
  catch (e) { problems.push(`${j.id} — the lock threw while protecting ${locked.join(', ')}: ${e.message}`); }
  const schema = schemaFor(j);
  for (const k of locked) {
    if (held && JSON.stringify(held[k]) !== JSON.stringify(approved[k])) {
      problems.push(`${j.id} — LOCK BROKEN: a draft can overwrite "${k}" in ${j.approved}. ${j.locked[k]}`);
    }
    if ((schema.properties || {})[k] || (schema.required || []).includes(k)) {
      problems.push(`${j.id} — "${k}" is locked but still in the schema the writer answers in, so the model is being asked for words it must not write`);
    }
  }
  if (!gone.length) console.log(`🔒 ${j.id}: ${locked.map((k) => `"${k}"`).join(', ')} held — ${locked.map((k) => j.locked[k]).join(' ')}`);
}

if (problems.length) {
  console.error('\n✗ copy gate:\n' + problems.map((p) => '  ' + p).join('\n')
    + '\n\n  the rules are tools/copy-rules.mjs, the limits are tools/copy-jobs.mjs, the voice is docs/voice.md'
    + '\n  read the drafts side by side at /dev/copy/');
  process.exit(1);
}
console.log(`✓ copy: ${lines} strings across ${files} file${files === 1 ? '' : 's'} pass every mechanical rule in docs/voice.md`);
