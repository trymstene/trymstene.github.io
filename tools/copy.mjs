#!/usr/bin/env node
// ✍️ THE WRITER — GPT writes the words, this puts them where the game can see them.
//
//   node tools/copy.mjs <job>            ask the model; writes tools/copy-out/<job>.json
//   node tools/copy.mjs <job> --dry      print the exact prompt + schema, call nothing
//   node tools/copy.mjs --approve <job>  the reviewed draft becomes src/data/copy/<job>.json
//   node tools/copy.mjs --models         what this key can see
//   node tools/copy.mjs --jobs           the jobs that exist
//
// The key and the model live in tools/copy.local.json (gitignored), or in
// OPENAI_API_KEY / OPENAI_MODEL. The model name is NEVER hardcoded here — a model
// nobody chose is a model nobody can change. The key is never printed, not even
// truncated, and never written into a draft.
//
// Review at /dev/copy/, then approve. The gate (tools/check-copy.mjs) runs the
// same rules in CI, so a draft that fails here cannot reach the game by hand.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { JOBS, jobFor, lockedTops, isLocked, schemaFor, mergeLocked } from './copy-jobs.mjs';
import { checkFile, report, strings } from './copy-rules.mjs';

const ROOT = process.cwd();
const VOICE = 'docs/voice.md';
// 🎛 the steer that applies to EVERY job, read before the job's own
const ALL_STEER = 'tools/copy-briefs/_all.steer.md';
// --steer "…" : one run only. --reject "…" : file a line as a NOT-THIS for every run after this one.
const argOf = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : null; };
const extraSteer = argOf('--steer');
const API = 'https://api.openai.com/v1';
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const die = (msg) => { console.error('✗ ' + msg); process.exit(1); };

const argv = process.argv.slice(2);
const flag = (name) => argv.includes('--' + name);
const valueOf = (name) => { const i = argv.indexOf('--' + name); return i < 0 ? null : argv[i + 1]; };
const bare = argv.filter((a) => !a.startsWith('--') && a !== valueOf('approve'));

if (flag('help') || (!argv.length)) {
  console.log(read('tools/copy.mjs').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  console.log('jobs: ' + Object.keys(JOBS).join(', '));
  process.exit(0);
}

// --- the config -------------------------------------------------------------
// Lazy: --dry and --jobs must work on a machine with no key at all.
function config() {
  let local = {};
  const at = join(ROOT, 'tools/copy.local.json');
  if (existsSync(at)) {
    try { local = JSON.parse(readFileSync(at, 'utf8')); }
    catch (e) { die('tools/copy.local.json does not parse: ' + e.message); }
  }
  const key = local.openai_key || process.env.OPENAI_API_KEY;
  const model = local.model || process.env.OPENAI_MODEL;
  const api = local.api || process.env.OPENAI_API || 'responses';
  if (!key) die('no API key. Put {"openai_key": "…", "model": "…"} in tools/copy.local.json (gitignored) or set OPENAI_API_KEY');
  if (!model) die('no model name. Add "model" to tools/copy.local.json or set OPENAI_MODEL — this tool never picks one for you (`node tools/copy.mjs --models` lists what the key can see)');
  if (api !== 'responses' && api !== 'chat') die(`"api" is "${api}" — it is "responses" (default) or "chat"`);
  return { key, model, api };
}

async function call(path, { key, body, method = 'POST' }) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: { authorization: 'Bearer ' + key, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) { die('the request never landed: ' + e.message); }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* an error page, not JSON */ }
  if (!res.ok) {
    // the message only: an error body can echo the request, and the request
    // carries the key's Authorization sibling in some proxies' dumps
    die(`OpenAI said ${res.status}: ${(json && json.error && json.error.message) || 'no message in the reply'}`);
  }
  return json;
}

// --- the prompt -------------------------------------------------------------
// In order: the house voice, the job's brief, then the fields with their limits.
// Nothing else — a model given a fourth source starts averaging them.
function fieldNotes(job) {
  const rows = Object.entries(job.fields).filter(([path]) => !isLocked(job, path)).map(([path, spec]) => {
    const aim = spec.aim && spec.aim !== spec.max ? ` (aim for ${spec.aim})` : '';
    const limit = spec.values ? `one of: ${spec.values.join(', ')}`
      : spec.maxByIndex ? `max ${spec.maxByIndex.map((n, i) => `rung ${i}: ${n}`).join(', ')} characters`
        : `max ${spec.max} characters${aim}`;
    return `${path}\n    ${limit}${spec.note ? '\n    ' + spec.note : ''}`;
  });
  return rows.join('\n');
}
function assemble(job) {
  const system = read(VOICE);
  // 🎛 THE STEER — Trym's own words, first in the brief and outranking it. The house voice and the
  // brief are written by Claude; this block is the only place the person whose world it is speaks
  // directly to the writer, so it goes at the top and the writer is told it wins any argument.
  //
  // TWO steer files, widest first: ALL_STEER applies to every job in the world (Trym,
  // 13 Sep 2026, after steering one shopkeeper: "that goes for all shopkeepers, and NPCs
  // for that matter"), then the job's own. A direction about how EVERYONE speaks belongs
  // in one file, or it is a thing to remember to copy into the next brief — and that is
  // the failure this whole rig exists to stop.
  const readSteer = (rel) => {
    if (!existsSync(join(ROOT, rel))) return '';
    return read(rel)
      .replace(/<!--[\s\S]*?-->/g, '')          // the how-to comments are for Trym, not the writer
      .split('\n')
      .filter((l) => !/^\s*#/.test(l) && !/^\s*\(nothing yet/.test(l))   // headings and the placeholder are not instructions
      .join('\n').trim();
  };
  const steerParts = [];
  for (const rel of [ALL_STEER, job.brief.replace(/\.md$/, '.steer.md')]) {
    const t = readSteer(rel);
    if (t) steerParts.push(t);
  }
  if (extraSteer) steerParts.push(extraSteer.trim());
  const steer = steerParts.length ? [
    '## TRYM’S STEER — read this first, and let it win',
    '',
    'The rest of this brief and the house voice were written by his collaborator. The lines below are',
    'from Trym, who made this world. Where they disagree with anything else you are given, follow these.',
    '',
    steerParts.join('\n\n'),
    '', '---', '',
  ].join('\n') : '';
  // 🔒 what the brief describes but you are NOT writing. The schema already makes it
  // impossible to return; saying so stops the model spending its attention there.
  const locked = lockedTops(job);
  const held = locked.length ? [
    '# NOT YOURS TO WRITE',
    '',
    ...locked.map((k) => `**${k}** — ${job.locked[k]}`),
    '',
    'The brief still describes ' + locked.join(' and ') + ', because the voices you ARE writing share a place',
    'with them. Read every word about them as background, never as a request. The schema below has no',
    'room for them, so there is nowhere to put those words even if you wanted to.',
    '',
  ].join('\n') : '';
  const user = [
    steer,
    `# THE BRIEF — ${job.title}`,
    '',
    read(job.brief).trim(),
    '',
    // spread, never a bare '' — a job with no lock must assemble a prompt byte for byte
    // identical to the one before locks existed. An empty slot here is a newline nobody asked for.
    ...(held ? [held] : []),
    '# THE FIELDS YOU ARE RETURNING',
    '',
    'Character counts are hard limits. Most good lines land far under them.',
    '',
    fieldNotes(job),
    '',
    '# HOW TO ANSWER',
    '',
    'Return only the JSON the schema describes. No markdown, no commentary, no code fence.',
    'Keys and names are copied from the brief exactly. Every line is new words for the same person.',
  ].join('\n');
  return { system, user, text: system + '\n\n' + user };
}

/** The approved file as it stands, or null. Locked sections are read from here. */
function approvedNow(job) {
  const at = join(ROOT, job.approved);
  if (!existsSync(at)) return null;
  try { return JSON.parse(readFileSync(at, 'utf8')); }
  catch (e) { die(`${job.approved} does not parse: ${e.message}`); }
  return null;
}
/** Splice the locked sections back in, and say out loud that it happened. */
function holdLocked(job, data, why) {
  const locked = lockedTops(job);
  if (!locked.length) return data;
  let out;
  try { out = mergeLocked(job, data, approvedNow(job)); }
  catch (e) { die(e.message); }
  for (const k of locked) console.log(`🔒 ${k}: kept from ${job.approved}, ${why}. ${job.locked[k]}`);
  return out;
}

// --- the jobs ---------------------------------------------------------------
function listJobs() {
  for (const j of Object.values(JOBS)) {
    const has = existsSync(join(ROOT, j.approved));
    console.log(`${j.id}\n  ${j.what}\n  brief    ${j.brief}\n  draft    ${j.out}\n  approved ${j.approved}${has ? '' : '  (not written yet)'}\n`);
  }
}

function validate(job, data, draft) {
  const { bad, warn } = checkFile(job, data, { draft });
  if (warn.length) console.log(`\n⚠️  ${warn.length} line${warn.length === 1 ? '' : 's'} over the voice guide's target (the gate allows it):\n` + report(warn));
  if (bad.length) console.error(`\n✗ ${bad.length} rule violation${bad.length === 1 ? '' : 's'}:\n` + report(bad));
  else console.log(`\n✓ every rule in docs/voice.md that can be checked by machine passes`);
  return bad.length === 0;
}
const countLines = (data) => [...strings(data)].filter((s) => !s.path.startsWith('_meta')).length;

// --- write ------------------------------------------------------------------
async function write(job) {
  const { key, model, api } = config();
  const { system, user, text } = assemble(job);
  const bytes = Buffer.byteLength(text, 'utf8');
  console.log(`${job.id}: ${model} via /v1/${api === 'chat' ? 'chat/completions' : 'responses'}, prompt ${bytes.toLocaleString()} bytes`);
  const name = job.id.replace(/-/g, '_');
  const schema = schemaFor(job);       // 🔒 locked sections are not in it
  const json = api === 'chat'
    ? await call('/chat/completions', { key, body: { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } } } })
    : await call('/responses', { key, body: { model, input: [{ role: 'system', content: system }, { role: 'user', content: user }],
      text: { format: { type: 'json_schema', name, strict: true, schema } } } });
  const raw = api === 'chat'
    ? ((json.choices || [])[0] || {}).message?.content
    : (typeof json.output_text === 'string' && json.output_text) ||
      (json.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  if (!raw) die('the reply carried no text (a refusal, or a model that cannot do structured output — try another with --models)');
  let reply;
  try { reply = JSON.parse(raw); } catch (e) { die('the reply is not JSON: ' + e.message); }
  // ✍️ TIDY, not judgement: a straight apostrophe is a typography convention, not a writing choice, and
  // failing a whole draft over it wastes a call. Normalise it here and say how many were fixed; the gate
  // still rejects them in an APPROVED file, where they could only come from a hand edit.
  let tidied = 0;
  const tidy = (v) => {
    if (typeof v === 'string') {
      const t = v.replace(/(\w)'(\w)/g, '$1’$2').replace(/(\w)'(?=\s|$|[.,!?])/g, '$1’');
      if (t !== v) tidied += 1;
      return t;
    }
    if (Array.isArray(v)) return v.map(tidy);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)]));
    return v;
  };
  reply = tidy(reply);
  if (tidied) console.log(`tidied ${tidied} straight apostrophe${tidied === 1 ? '' : 's'} into the house ’`);
  // a draft is always a WHOLE file, so the desk can show it beside the live copy —
  // the locked sections in it are the approved words, copied, never generated
  reply = holdLocked(job, reply, 'never sent to the model');
  const draft = { _meta: { job: job.id, model, api, when: new Date().toISOString(), promptBytes: bytes }, ...reply };
  mkdirSync(join(ROOT, dirname(job.out)), { recursive: true });
  writeFileSync(join(ROOT, job.out), JSON.stringify(draft, null, 2) + '\n');
  console.log(`wrote ${job.out} — ${countLines(draft)} lines`);
  // a draft that fails the rules is still written (it has to be readable to be
  // fixed) but the exit code says so
  const ok = validate(job, draft, true);
  console.log(`\nread it at /dev/copy/, then: node tools/copy.mjs --approve ${job.id}`);
  process.exit(ok ? 0 : 1);
}

// --- approve ----------------------------------------------------------------
function approve(job) {
  const at = join(ROOT, job.out);
  if (!existsSync(at)) die(`no draft at ${job.out} — run \`node tools/copy.mjs ${job.id}\` first`);
  let draft;
  try { draft = JSON.parse(readFileSync(at, 'utf8')); } catch (e) { die(`${job.out} does not parse: ${e.message}`); }
  const { _meta, ...rest } = draft;
  // ✍️ THE RECEIPT. _meta (job, model, when) is written by write() and by nothing else,
  // so it is the one mechanical answer to CLAUDE.md's "never hand-write player-facing
  // words": no receipt, no approval. This used to be enforced as a side effect of
  // validating with { draft: true }; validating the SPLICED object (below) has no _meta
  // by construction, which quietly deleted the requirement for a day. Say it outright.
  if (!_meta) {
    die(`${job.out} carries no _meta receipt, so it was not written by the rig.\n`
      + `  Drafts come from \`node tools/copy.mjs ${job.id}\`. Copy is never typed by hand — see CLAUDE.md.`);
  }
  // 🔒 THE LAST GATE before the game's own copy is overwritten. Whatever the draft
  // holds for a locked section — a generated one, a hand-pasted one, a stale one from
  // before the lock existed — the approved file's words go back in here. Then we
  // validate the EXACT object about to be written, not the thing we read.
  const clean = holdLocked(job, rest, 'not replaced by this approval');
  if (!validate(job, clean, false)) die('the draft breaks the rules above — it cannot be approved');
  const before = existsSync(join(ROOT, job.approved)) ? JSON.parse(read(job.approved)) : null;
  writeFileSync(join(ROOT, job.approved), JSON.stringify(clean, null, 2) + '\n');
  if (before) {
    const was = new Map([...strings(before)].map((s) => [s.path, s.value]));
    const changed = [...strings(clean)].filter((s) => was.get(s.path) !== s.value);
    console.log(`\n✓ ${job.approved}: ${changed.length} of ${countLines(clean)} lines changed`);
  } else console.log(`\n✓ ${job.approved}: ${countLines(clean)} lines, first write`);
  console.log(`  written by ${_meta.model} on ${String(_meta.when).slice(0, 10)} — the receipt is checked, then not copied`);
  console.log(`  the game reads it through ${job.reads}. Run: npx astro build && node tools/check-copy.mjs`);
}

// --- the door ---------------------------------------------------------------
if (flag('jobs')) { listJobs(); process.exit(0); }
if (flag('models')) {
  const { key, model } = config();
  const json = await call('/models', { key, method: 'GET' });
  const ids = (json.data || []).map((m) => m.id).sort();
  console.log(ids.join('\n'));
  console.log(`\n${ids.length} models. tools/copy.local.json asks for "${model}"${ids.includes(model) ? '' : ' — which is NOT in this list'}`);
  process.exit(0);
}
const wanted = valueOf('approve') || bare[0];
if (!wanted) die('which job? ' + Object.keys(JOBS).join(', '));
const job = jobFor(wanted);

// --- reject: a line Trym did not like becomes a NOT-THIS for every run after this -----
// The learning loop. The voice guide was built from his past rejections; this keeps that going
// without anyone having to remember to write it down.
if (process.argv.includes('--reject')) {
  const line = argOf('--reject');
  if (!line) die('say what to reject:  node tools/copy.mjs <job> --reject "the line, verbatim"');
  const who = argOf('--who');
  const why = argOf('--why');
  const f = join(ROOT, job.brief.replace(/\.md$/, '.steer.md'));
  const head = existsSync(f) ? '' : [
    '# ' + job.id + ' — Trym’s steer',
    '',
    '<!-- Everything below goes to the writer ABOVE the brief, and outranks it. Write plainly, in your',
    '     own words: "Moss is too clipped, give her the warmth back", "Spinner must not say his own',
    '     name in every line". Comment lines like this one are stripped. -->',
    '', '## Notes', '',
  ].join('\n') + '\n';
  const entry = ['- NOT THIS' + (who ? ' (' + who + ')' : '') + ': “' + line.trim() + '”' + (why ? ' — ' + why : ''), ''].join('\n');
  const cur = existsSync(f) ? readFileSync(f, 'utf8') : '';
  const body = cur.includes('## Never write these again')
    ? cur.replace('## Never write these again\n', '## Never write these again\n' + entry)
    : cur + (cur.endsWith('\n') || !cur ? '' : '\n') + '\n## Never write these again\n' + entry;
  writeFileSync(f, head + body);
  console.log('filed against ' + job.id + ': ' + relative(ROOT, f));
  console.log('every run after this one is told not to write it. Nothing was called.');
  process.exit(0);
}
if (!job) die(`no job called "${wanted}". There is: ` + Object.keys(JOBS).join(', '));
for (const rel of [VOICE, job.brief]) if (!existsSync(join(ROOT, rel))) die(`${rel} is missing — the writer will not guess the voice`);

if (flag('approve')) approve(job);
else if (flag('dry')) {
  const { system, user, text } = assemble(job);
  console.log('='.repeat(78));
  console.log(`DRY RUN — ${job.id}. Nothing is called and nothing is written.`);
  console.log('='.repeat(78));
  console.log(`\n--- system: ${VOICE} (${Buffer.byteLength(system)} bytes) ---\n`);
  console.log(system);
  console.log(`\n--- user: ${job.brief} + the field notes (${Buffer.byteLength(user)} bytes) ---\n`);
  console.log(user);
  console.log(`\n--- schema: strict json_schema "${job.id.replace(/-/g, '_')}" ---\n`);
  console.log(JSON.stringify(schemaFor(job), null, 2));
  for (const k of lockedTops(job)) console.log(`\n🔒 "${k}" is NOT in that schema. ${job.locked[k]}`);
  console.log(`\n--- the assembled prompt is ${Buffer.byteLength(text, 'utf8').toLocaleString()} bytes ---`);
  // the model is read, never chosen here; --dry says which one WOULD be asked
  let model = null;
  try {
    const at = join(ROOT, 'tools/copy.local.json');
    model = (existsSync(at) ? JSON.parse(readFileSync(at, 'utf8')).model : null) || process.env.OPENAI_MODEL || null;
  } catch (e) { /* a broken config is write()'s problem, not the dry run's */ }
  console.log(`--- model: ${model || 'none configured (tools/copy.local.json "model", or OPENAI_MODEL)'} ---`);
  console.log(`--- the draft would land in ${job.out}; the approved copy is ${job.approved} ---`);
} else await write(job);
