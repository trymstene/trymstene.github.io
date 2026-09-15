// ✍️ THE COPY RULES — the mechanical half of docs/voice.md.
//
// One module, three readers: tools/copy.mjs validates what GPT just wrote,
// tools/check-copy.mjs gates what is tracked in src/data/copy/, and
// /dev/copy/ flags the same things on screen so Trym sees why a line is red.
// A rule lives here ONLY if it is greppable — everything else is judgement and
// belongs in the voice guide.
//
// No node builtins on purpose: an Astro page imports this at build time.

// --- the field walk ---------------------------------------------------------
// Every string in a copy file, as a concrete path ("residents[2].hi[0]") plus
// the pattern its spec is filed under ("residents[].hi[]").
export function* strings(node, path = '') {
  if (typeof node === 'string') { yield { path, value: node }; return; }
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) yield* strings(node[i], `${path}[${i}]`); return; }
  if (node && typeof node === 'object') for (const k of Object.keys(node)) yield* strings(node[k], path ? `${path}.${k}` : k);
}
export const patternOf = (path) => path.replace(/\[\d+\]/g, '[]');
export const indexOf = (path) => { const m = /\[(\d+)\]$/.exec(path); return m ? +m[1] : null; };

// --- the mechanics ----------------------------------------------------------
// Outside names. Mechanics are free, names are not — and a brand in a line is
// the one thing nobody can fix after it ships.
export const BRANDS = [
  'minecraft', 'roblox', 'fortnite', 'stardew', 'animal crossing', 'pac-man', 'pacman',
  'tetris', 'mario', 'nintendo', 'playstation', 'xbox', 'netflix', 'tiktok', 'instagram',
  'facebook', 'twitter', 'youtube', 'snapchat', 'whatsapp', 'disney', 'coca-cola', 'pepsi',
  'mcdonald', 'peanut butter jelly time',
];
// A published clock. Naming a rhythm is the pitch; naming the interval spoils it.
const CLOCK_UNIT = '(?:ms|s|sec|secs|second|seconds|min|mins|minute|minutes|hour|hours|hr|hrs|day|days|week|weeks|month|months)';
const DIGIT_CLOCK = new RegExp(String.raw`\b\d+(?:[.,]\d+)?\s*-?\s*${CLOCK_UNIT}\b`, 'i');
const WORD_CLOCK = new RegExp(String.raw`\bevery\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|sixty)\s+\w*\s*(?:${CLOCK_UNIT}|spins?|taps?|games?|turns?)\b`, 'i');
// the characters a paste brings in that nobody can see: a control byte, a
// non-breaking space, a zero width joiner, a line separator, a BOM.
const ODD_POINTS = [[0, 31], [127, 127], [160, 160], [0x200b, 0x200f], [0x2028, 0x2029], [0xfeff, 0xfeff]];
const oddChar = (s) => [...s].some((c) => { const n = c.codePointAt(0); return ODD_POINTS.some(([a, b]) => n >= a && n <= b); });

/** Every mechanical fault in one line, in the order they matter. `spec` carries
 *  the field's own limits; pass none and only the universal rules run. */
export function faults(value, spec = {}) {
  const out = [];
  const say = (rule, msg) => out.push({ rule, msg });
  if (typeof value !== 'string') { say('type', 'not a string'); return out; }
  const max = limitOf(spec, 'max');
  if (spec.kind !== 'key' && !value.trim()) { if (spec.emptyOk) return out; say('empty', 'the field is empty'); }   // emptyOk: a key the shape demands of everyone that only one resident fills (Moss's nights)
  if (max && value.length > max) say('length', `${value.length} characters, the limit is ${max}`);
  if (/^\s|\s$/.test(value)) say('space', 'leading or trailing whitespace');
  if (/ {2}/.test(value)) say('space', 'a double space');
  if (/[\n\r\t]/.test(value)) say('space', 'a line break or tab inside a line');
  if (oddChar(value)) say('char', 'an invisible or control character (non-breaking space, zero width)');
  if (spec.kind === 'prose') {
    if (value.includes("'")) say('apostrophe', 'a straight apostrophe — the house uses ’');
    if (value.includes('"')) say('apostrophe', 'a straight double quote — the house uses “ ”');
    if (/\p{Extended_Pictographic}/u.test(value)) say('emoji', 'an emoji in a spoken line');
    const brace = /\{[^}]*\}/g;
    // a field may declare its own placeholders (the stand's sold line holds {item}); {name} is
    // universal, and anything else is a brace the game would print raw
    const ok = new Set(['{name}', ...(spec.holds || [])]);
    for (const m of value.match(brace) || []) if (!ok.has(m)) say('placeholder', `${m} is not a placeholder the game fills here — allowed: ${[...ok].join(', ')}`);
    if (DIGIT_CLOCK.test(value) || WORD_CLOCK.test(value)) say('clock', 'a published interval — name the rhythm, never the number');
    if (/\bclone of\b/i.test(value)) say('name', '"clone of" — ours has a banana name and one real twist');
    const low = value.toLowerCase();
    const allow = (spec.allowBrands || []).map((b) => b.toLowerCase());
    for (const b of BRANDS) if (!allow.includes(b) && low.includes(b)) say('name', `the outside name "${b}"`);
  }
  if (spec.kind === 'enum' && spec.values && !spec.values.includes(value)) say('enum', `"${value}" is not one of ${spec.values.join(', ')}`);
  if (spec.needs) for (const [re, why] of spec.needs) if (!re.test(value)) say('needs', why);
  if (spec.forbids) for (const [re, why] of spec.forbids) if (re.test(value)) say('forbids', why);
  return out;
}

/** Over the voice guide's target but under the gate's hard limit: amber, not red. */
export function overAim(value, spec = {}) {
  const aim = limitOf(spec, 'aim'), max = limitOf(spec, 'max');
  return typeof value === 'string' && aim && value.length > aim && (!max || value.length <= max) ? aim : 0;
}
function limitOf(spec, which) {
  const byIndex = which === 'max' ? spec.maxByIndex : spec.aimByIndex;
  if (byIndex && spec._index != null) return byIndex[spec._index] ?? byIndex[byIndex.length - 1];
  return spec[which] ?? (which === 'aim' ? spec.max : null);
}

// --- a whole file -----------------------------------------------------------
/** Checks one copy file against its job. Returns { bad, warn } — `bad` fails
 *  the gate, `warn` is the voice guide's target missed by a few characters. */
export function checkFile(job, data, { draft = false } = {}) {
  const bad = [], warn = [];
  const flag = (path, rule, msg) => bad.push({ path, rule, msg });
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    flag('', 'shape', 'the file is not a JSON object');
    return { bad, warn };
  }
  // `_meta` is the draft's receipt (job, model, when). It is stripped on approve,
  // so a tracked file carrying one means somebody copied a draft by hand.
  const top = Object.keys(data);
  for (const k of top) {
    if (k === '_meta') { if (!draft) flag('_meta', 'meta', 'a tracked copy file must not carry _meta — approve it with `node tools/copy.mjs --approve ' + job.id + '`'); continue; }
    if (!job.top.includes(k)) flag(k, 'shape', `unknown top-level field "${k}" — this job writes ${job.top.join(', ')}`);
  }
  if (draft && !data._meta) flag('_meta', 'meta', 'a draft must carry _meta (job, model, when)');
  for (const k of job.top) if (data[k] == null) flag(k, 'shape', `"${k}" is missing`);

  for (const p of job.shape(data)) flag(p.path, p.rule || 'shape', p.msg);

  for (const { path, value } of strings(data)) {
    if (path.startsWith('_meta')) continue;
    const spec = job.fields[patternOf(path)];
    if (!spec) { flag(path, 'shape', 'no rule declares this field — add it to tools/copy-jobs.mjs'); continue; }
    const withIndex = { ...spec, _index: indexOf(path) };
    for (const f of faults(value, withIndex)) bad.push({ path, ...f, value });
    const aim = overAim(value, withIndex);
    if (aim) warn.push({ path, rule: 'length', msg: `${value.length} characters; the guide asks for ${aim}`, value });
  }
  return { bad, warn };
}

/** One line per fault, the field path first — the only format worth reading in CI. */
export const report = (items) => items.map((f) => `  ${f.path}  ${f.msg}` + (f.value ? `\n      “${f.value}”` : '')).join('\n');
