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
import { jobs, jobForFile } from './copy-jobs.mjs';
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

if (problems.length) {
  console.error('\n✗ copy gate:\n' + problems.map((p) => '  ' + p).join('\n')
    + '\n\n  the rules are tools/copy-rules.mjs, the limits are tools/copy-jobs.mjs, the voice is docs/voice.md'
    + '\n  read the drafts side by side at /dev/copy/');
  process.exit(1);
}
console.log(`✓ copy: ${lines} strings across ${files} file${files === 1 ? '' : 's'} pass every mechanical rule in docs/voice.md`);
