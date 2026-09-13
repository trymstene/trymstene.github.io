// ✍️ THE COPY JOBS — one entry per writing job in Banana World.
//
// A job is: the brief GPT is given, the JSON Schema its answer must satisfy,
// the field limits the gate enforces, and the two files (the draft it writes,
// the approved copy the game imports). Add a job here and the writer, the gate
// and /dev/copy/ all learn about it at once.
//
// No node builtins: an Astro page imports this at build time.

export const BEATS = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night'];

// The nine residents, by the key the game uses. The NAMES ARE FIXED — a rewrite
// gives the same cast new words, never a new cast, and this is what pins that.
export const TOWN_CAST = [
  ['nib', 'Nib'], ['stamp', 'Stamp'], ['moss', 'Moss'], ['pip', 'Pip'], ['bean', 'Bean'],
  ['figjr', 'Fig Jr.'], ['spinner', 'Spinner'], ['dot', 'Dot'], ['granfig', 'Gran Fig'],
];

// --- town-npcs ---------------------------------------------------------------
// The spoken half of src/scripts/town-life.js: five greetings up the meeting
// ladder, the tap line, six stations x three lines, the want. The mechanical
// half (hat, tool, home, and which place/act/facing each beat) stays in code.
//
// LIMITS. `max` fails the gate, `aim` is the number docs/voice.md asks for and
// only goes amber on the desk. The beat line's max is 95 because the town's own
// evening line about the Mayor's light is 94 and shipped; the guide still asks
// for 90. Raising a max is a deliberate act for a commit message, like a budget.
const townFields = {
  'residents[].key': { kind: 'key', max: 12 },
  'residents[].name': { kind: 'name', max: 14, note: 'FIXED. Return the name exactly as the brief gives it.' },
  'residents[].role': { kind: 'prose', aim: 100, max: 110, note: 'The one line under their name on the dialogue card: what they do here, in the world’s own voice, not theirs.' },
  'residents[].tap': { kind: 'prose', max: 100, note: 'The fallback when there is nothing else: who they are and what this counter is for, in their voice. Teaches without instructing.' },
  'residents[].want': { kind: 'prose', max: 110, note: 'What they wish for: ALWAYS company, never goods, money or a count. No reward named, no timer, no number.' },
  'residents[].hi[]': { kind: 'prose', maxByIndex: [90, 90, 90, 90, 100], note: 'The meeting ladder, rungs 0-4. 0 a stranger, 1 they have noticed you, 2 they use your name, 3 their own nickname for you, 4 ONE private thing given away — the only warm line they have.' },
  'residents[].ask.doing': { kind: 'prose', aim: 26, max: 34, note: 'The button the PLAYER presses to ask what this resident is doing right now. The player’s own voice, plain and natural, and it may be phrased for this character. Ends in a question mark.' },
  'residents[].ask.want': { kind: 'prose', aim: 26, max: 34, note: 'The button the PLAYER presses to ask whether this resident needs anything. The player’s own voice, plain and natural. Ends in a question mark.' },
  'residents[].beats[].beat': { kind: 'enum', values: BEATS },
  'residents[].beats[].lines[]': { kind: 'prose', aim: 90, max: 95, note: 'What they are doing at this station at this time of day. Nobody hears it out loud; it is read off their dialogue card later. Three per beat, and one may hint at another resident.' },
};

// the shape the game needs, checked after the field walk: the same nine, all six
// beats in order, five rungs, and {name} only where they know your name
function townShape(data) {
  const bad = [];
  const say = (path, msg, rule) => bad.push({ path, msg, rule });
  const list = data.residents;
  if (!Array.isArray(list)) { say('residents', 'residents must be an array'); return bad; }
  const seen = new Map(list.map((r, i) => [r && r.key, i]));
  for (const [key, name] of TOWN_CAST) {
    const i = seen.get(key);
    if (i == null) { say(`residents[${key}]`, `the resident "${key}" (${name}) is missing — the cast is fixed`); continue; }
    const r = list[i], at = `residents[${i}]`;
    if (r.name !== name) say(`${at}.name`, `the name is "${r.name}"; this resident is ${name} and the name is not the writer's to change`, 'cast');
    if (!Array.isArray(r.hi) || r.hi.length !== 5) say(`${at}.hi`, `the ladder needs exactly 5 greetings, rungs 0-4 (got ${Array.isArray(r.hi) ? r.hi.length : 'none'})`);
    else {
      // rungs 0 and 1 do not know your name yet, and a rung that claims to use
      // it must actually carry the placeholder
      if (/\{name\}/.test(r.hi[0])) say(`${at}.hi[0]`, 'rung 0 has never met you — it cannot use {name}');
      if (/\{name\}/.test(r.hi[1])) say(`${at}.hi[1]`, 'rung 1 has only noticed you — it cannot use {name}');
      for (const k of [2, 3, 4]) if (!/\{name\}/.test(r.hi[k])) say(`${at}.hi[${k}]`, `rung ${k} knows you — it must use {name}`);
    }
    if (!Array.isArray(r.beats) || r.beats.length !== BEATS.length) say(`${at}.beats`, `a day is ${BEATS.length} beats: ${BEATS.join(', ')}`);
    else r.beats.forEach((b, k) => {
      if (!b || b.beat !== BEATS[k]) say(`${at}.beats[${k}].beat`, `beat ${k} must be "${BEATS[k]}" — the day is read in order`);
      const n = b && Array.isArray(b.lines) ? b.lines.length : 0;
      if (n < 3 || n > 4) say(`${at}.beats[${k}].lines`, `${n} lines at this station; three is the shape (a fourth is allowed where the town already has one)`);
    });
  }
  for (const r of list) if (!TOWN_CAST.some(([k]) => k === r.key)) say(`residents[${r && r.key}]`, `"${r && r.key}" is not one of the nine — the cast is fixed`, 'cast');
  if (list.length !== TOWN_CAST.length) say('residents', `${list.length} residents; the town has ${TOWN_CAST.length}`);
  return bad;
}

// the JSON Schema the model answers in (strict: true, so the reply is data and
// never prose to parse). Kept flat on purpose — arrays of objects instead of one
// object per resident, so the schema stays well inside the strict-mode limits.
const townSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['residents'],
  properties: {
    residents: {
      type: 'array',
      description: 'All nine residents, in the order the brief lists them.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'name', 'role', 'tap', 'want', 'hi', 'ask', 'beats'],
        properties: {
          key: { type: 'string', description: 'The resident’s key, copied from the brief. Never shown to a player.' },
          name: { type: 'string', description: townFields['residents[].name'].note },
          role: { type: 'string', description: townFields['residents[].role'].note },
          tap: { type: 'string', description: townFields['residents[].tap'].note },
          want: { type: 'string', description: townFields['residents[].want'].note },
          hi: {
            type: 'array', description: townFields['residents[].hi[]'].note,
            items: { type: 'string' },
          },
          ask: {
            type: 'object', additionalProperties: false, required: ['doing', 'want'],
            description: 'The two buttons the player can press, in the PLAYER’s voice, not the resident’s.',
            properties: {
              doing: { type: 'string', description: townFields['residents[].ask.doing'].note },
              want: { type: 'string', description: townFields['residents[].ask.want'].note },
            },
          },
          beats: {
            type: 'array',
            description: 'The six beats of their day, in order. The place and the act are given in the brief and cannot move.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['beat', 'lines'],
              properties: {
                beat: { type: 'string', enum: BEATS, description: 'dawn, morning, noon, afternoon, evening or night.' },
                lines: { type: 'array', description: townFields['residents[].beats[].lines[]'].note, items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
};

// --- park-npcs ---------------------------------------------------------------
// The park's three voices. What makes this job different from the town's: the
// park has HEALTH, five bands from neglected to perfect, and Old Peel's answers
// change with it. So his bench mutters and three of his topics come as five
// versions of the same thought, one per band, and they have to read as one man
// watching a place get better — not five unrelated lines.
export const PHASES = [
  'neglected — weeds, litter, bare soil',
  'coming back — the first green, somebody has started',
  'half herself — green in patches',
  'nearly there — blooming, a few gaps',
  'perfect — the park at its best',
];
const parkFields = {
  'peel.name': { kind: 'name', max: 14, note: 'FIXED: old peel.' },
  'peel.greet': { kind: 'prose', aim: 70, max: 90, note: 'The first thing he says when the card opens. An invitation to sit, not a menu.' },
  'peel.bench[][]': { kind: 'prose', aim: 70, max: 90, note: 'What he mutters from his bench, to nobody. One inner array per health band, worst park first. Three or four each.' },
  // 🌦 the weather overrides the health band while it is falling — these are the same
  // bench mutter, for a sky instead of a state. They lived in park-npc.js until 13 Sep.
  'peel.wx.drizzle[]': { kind: 'prose', aim: 70, max: 90, note: 'What he mutters in light rain. The park likes it and so does he.' },
  'peel.wx.heavy[]': { kind: 'prose', aim: 70, max: 90, note: 'What he mutters in proper rain. Unbothered; he has sat through worse.' },
  'peel.wx.storm[]': { kind: 'prose', aim: 70, max: 90, note: 'What he mutters in a real storm. Still not leaving the bench.' },
  'peel.topics[].id': { kind: 'key', max: 10, note: 'FIXED. Return the ids exactly as the brief gives them.' },
  'peel.topics[].q': { kind: 'prose', aim: 34, max: 40, note: 'The question as the PLAYER would ask it, on a button. Lowercase, plain, no wit — the wit is his answer.' },
  'peel.topics[].line': { kind: 'prose', aim: 150, max: 180, note: 'A single answer, for a topic whose answer never changes.' },
  'peel.topics[].byPhase[]': { kind: 'prose', aim: 130, max: 160, note: 'The same answer at each of the five health bands, worst first. One man, one thought, five stages of a place healing.' },
  'peel.topics[].seq[]': { kind: 'prose', aim: 150, max: 180, note: 'His life, one beat per tap. Each must land on its own and still lead to the next.' },
  'peel.bed[]': { kind: 'prose', aim: 80, max: 100, note: 'His own flowerbed: a daisy, a sunflower, one midnight tulip. Proud, gentle, do-not-touch.' },
  'inka.name': { kind: 'name', max: 14, note: 'FIXED: inka.' },
  'inka.greet': { kind: 'prose', aim: 80, max: 100, note: 'The print shop, in one line. The one place in the park where things are real and cost real money.' },
  'inka.lines[]': { kind: 'prose', aim: 90, max: 110, note: 'What she says while you browse the wall. Warm, never a sales pitch, never pushy about money.' },
  'stand.name': { kind: 'name', max: 18, note: 'FIXED: the stand keeper.' },
  'stand.greet': { kind: 'prose', aim: 70, max: 90, note: 'The stand, opening. Coins buy the gear on this wall.' },
  'stand.sold[]': { kind: 'prose', aim: 60, max: 80, holds: ['{item}'], note: 'Said when somebody buys. MUST contain {item} — the game puts the thing they bought there.' },
};
function parkShape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });
  const P = data.peel, I = data.inka, S = data.stand;
  if (!P || !I || !S) { say('', 'the file needs peel, inka and stand'); return bad; }
  if (!Array.isArray(P.bench) || P.bench.length !== 5) say('peel.bench', 'five health bands, worst park first');
  else P.bench.forEach((b, i) => { if (!Array.isArray(b) || b.length < 3) say(`peel.bench[${i}]`, 'three or four mutters for this band'); });
  // 🌦 park-npc.js reads OLD_WX[wx] where wx is the weather's own name, so a missing
  // tier is not a copy problem — it is a silent fall back to the health band's lines
  if (!P.wx || typeof P.wx !== 'object') say('peel.wx', 'the three weather tiers are missing: drizzle, heavy, storm');
  else for (const tier of ['drizzle', 'heavy', 'storm']) {
    if (!Array.isArray(P.wx[tier]) || P.wx[tier].length < 3) say(`peel.wx.${tier}`, `at least three mutters for ${tier} — park-npc.js falls back to the health band without them`);
  }
  const ids = ['park', 'help', 'lore', 'shop', 'bye'];
  const got = (P.topics || []).map((t) => t && t.id);
  for (const id of ids) if (!got.includes(id)) say('peel.topics', `the topic "${id}" is missing — the deck is fixed`);
  for (const t of P.topics || []) {
    const path = `peel.topics[${got.indexOf(t.id)}]`;
    const kinds = ['line', 'byPhase', 'seq'].filter((k) => t[k] != null);
    if (kinds.length !== 1) say(path, 'a topic answers with exactly one of line, byPhase or seq');
    if (t.byPhase && t.byPhase.length !== 5) say(path + '.byPhase', 'one answer per health band: five');
    if (t.seq && t.seq.length < 3) say(path + '.seq', 'at least three beats');
  }
  if ((P.topics || []).some((t) => t.id === 'bye' && !t.close)) say('peel.topics', 'the goodbye topic keeps close: true');
  for (const [k, n] of [['inka.lines', (I.lines || []).length], ['stand.sold', (S.sold || []).length]]) {
    if (n < 3) say(k, 'at least three');
  }
  // 🧾 THE FACTS INKA CARRIES. Trym, 13 Sep 2026: "be more clear, precise and concrete,
  // while still being humorous and fun … that goes for all shopkeepers, and NPCs for that
  // matter". Her shop is the only place in the world that takes REAL money, and her lines
  // are the only place a player is told so — a draft that swapped all three facts for
  // atmosphere read beautifully and left the shop unexplained. Style is judgement and lives
  // in the steer; THESE are facts, and a missing fact is greppable.
  const inkaSays = [I.greet || '', ...(I.lines || [])].join(' \n ').toLowerCase();
  for (const [what, re, why] of [
    ['the wall can be tapped', /\b(tap|taps|tapping|press|pressing|poke|pokes|click|touch)\b/,
      'nothing tells the player the wall does anything — one line must invite a tap on it'],
    ['it costs real money, not coins', /\b(money|cash|paid|pay for|real thing|coins?)\b/,
      'nothing says this is real money rather than bananacoins — the one shop in the world that takes it'],
    ['she posts it out', /\b(post|posts|posted|posting|ship|ships|shipped|mail|mailed|deliver|delivers|delivered|parcel|envelope)\b/,
      'nothing says it is printed and sent to them — a player cannot tell what they would be buying'],
  ]) {
    if (!re.test(inkaSays)) say('inka.lines', `${why} (the fact: ${what}). Her greet and her four lines together must carry all three.`);
  }
  (S.sold || []).forEach((l, i) => { if (!String(l).includes('{item}')) say(`stand.sold[${i}]`, 'must contain {item} — the game puts the purchase there'); });
  return bad;
}
const str = (note) => ({ type: 'string', description: note });
const parkSchema = {
  type: 'object', additionalProperties: false, required: ['peel', 'inka', 'stand'],
  properties: {
    peel: {
      type: 'object', additionalProperties: false, required: ['name', 'greet', 'bench', 'wx', 'topics', 'bed'],
      properties: {
        name: str('Exactly: old peel'),
        greet: str(parkFields['peel.greet'].note),
        bench: { type: 'array', description: parkFields['peel.bench[][]'].note, items: { type: 'array', items: { type: 'string' } } },
        wx: {
          type: 'object', additionalProperties: false, required: ['drizzle', 'heavy', 'storm'],
          description: 'What he mutters while it is raining, which overrides the health band for as long as it lasts.',
          properties: {
            drizzle: { type: 'array', description: parkFields['peel.wx.drizzle[]'].note, items: { type: 'string' } },
            heavy: { type: 'array', description: parkFields['peel.wx.heavy[]'].note, items: { type: 'string' } },
            storm: { type: 'array', description: parkFields['peel.wx.storm[]'].note, items: { type: 'string' } },
          },
        },
        topics: {
          type: 'array',
          description: 'His five topics, ids fixed: park, help, lore, shop, bye.',
          items: {
            type: 'object', additionalProperties: false, required: ['id', 'q', 'line', 'byPhase', 'seq', 'close'],
            properties: {
              id: str('park, help, lore, shop or bye.'),
              q: str(parkFields['peel.topics[].q'].note),
              line: { type: ['string', 'null'], description: parkFields['peel.topics[].line'].note + ' null unless this topic uses it.' },
              byPhase: { type: ['array', 'null'], description: parkFields['peel.topics[].byPhase[]'].note + ' null unless this topic uses it.', items: { type: 'string' } },
              seq: { type: ['array', 'null'], description: parkFields['peel.topics[].seq[]'].note + ' null unless this topic uses it.', items: { type: 'string' } },
              close: { type: ['boolean', 'null'], description: 'true only on the goodbye.' },
            },
          },
        },
        bed: { type: 'array', description: parkFields['peel.bed[]'].note, items: { type: 'string' } },
      },
    },
    inka: {
      type: 'object', additionalProperties: false, required: ['name', 'greet', 'lines'],
      properties: { name: str('Exactly: inka'), greet: str(parkFields['inka.greet'].note), lines: { type: 'array', description: parkFields['inka.lines[]'].note, items: { type: 'string' } } },
    },
    stand: {
      type: 'object', additionalProperties: false, required: ['name', 'greet', 'sold'],
      properties: { name: str('Exactly: the stand keeper'), greet: str(parkFields['stand.greet'].note), sold: { type: 'array', description: parkFields['stand.sold[]'].note, items: { type: 'string' } } },
    },
  },
};

export const JOBS = {
  'town-npcs': {
    id: 'town-npcs',
    title: 'Banana Town — the nine residents',
    what: 'Everything the town’s residents say: the meeting ladder, the tap line, their day, their want.',
    brief: 'tools/copy-briefs/town-npcs.md',
    out: 'tools/copy-out/town-npcs.json',
    approved: 'src/data/copy/town-npcs.json',
    reads: 'src/scripts/town-life.js',
    top: ['residents'],
    fields: townFields,
    shape: townShape,
    schema: townSchema,
  },
  'park-npcs': {
    id: 'park-npcs',
    title: 'The Park — old peel, inka, the stand',
    what: 'Old Peel’s bench, his topics and his flowerbed; Inka at the print shop; the stand keeper.',
    brief: 'tools/copy-briefs/park-npcs.md',
    out: 'tools/copy-out/park-npcs.json',
    approved: 'src/data/copy/park-npcs.json',
    reads: 'src/scripts/park-npc.js + src/scripts/park-shops.js',
    top: ['peel', 'inka', 'stand'],
    // 🔒 Old Peel is Trym's. He wrote the bench mutters, the five band answers
    // and the lore beats himself, and tuned them again on 13 Sep 2026. The rig
    // reads them so the game can import one file; it does not write them.
    locked: {
      peel: 'Trym wrote and tuned Old Peel himself (13 Sep 2026). These are his words: the rig never drafts or replaces them.',
    },
    fields: parkFields,
    shape: parkShape,
    schema: parkSchema,
  },
};

export const jobs = () => Object.values(JOBS);
export const jobFor = (id) => JOBS[id] || null;
/** The job a tracked copy file belongs to — src/data/copy/<job>.json. */
export const jobForFile = (file) => JOBS[String(file).replace(/\\/g, '/').split('/').pop().replace(/\.json$/, '')] || null;

// 🔒 LOCKED SECTIONS — the words Trym wrote himself.
//
// The rig's whole premise is that GPT owns src/data/copy. Old Peel is the
// exception: Trym wrote and tuned his dialogue by hand and told me so on
// 13 Sep 2026 — "ive already optimized old peels dialogue myself, no need to
// change it". A sentence in a document cannot survive a compaction, so it is a
// mechanism instead: a locked section is never asked for, never drafted and
// never written, and `--approve` splices the approved file's own words back in
// before it saves. Poison the draft by hand and the locked words still win.
//
// A lock names a TOP-LEVEL key of the job's file. Unlock by deleting the entry,
// which is a deliberate act with Trym's name on it in the commit message.
/** The top-level keys this job will not write. */
export const lockedTops = (job) => Object.keys((job && job.locked) || {});
/** The top-level key a field path belongs to: peel.bench[][] -> peel. */
export const topOf = (path) => String(path).split(/[.[]/)[0];
/** Is this field path inside a locked section? */
export const isLocked = (job, path) => lockedTops(job).includes(topOf(path));

/** The schema the writer actually answers in: locked sections are not in it, so
 *  the model cannot return them even if the brief tempts it. */
export function schemaFor(job) {
  const locked = lockedTops(job);
  if (!locked.length) return job.schema;
  const s = JSON.parse(JSON.stringify(job.schema));
  for (const k of locked) delete (s.properties || {})[k];
  if (Array.isArray(s.required)) s.required = s.required.filter((k) => !locked.includes(k));
  return s;
}

/** Put the approved file's locked sections back into `data`, keeping the
 *  approved file's key order so a diff shows only what really moved.
 *  Throws if a locked section has nothing to be held back FROM. */
export function mergeLocked(job, data, approved) {
  const locked = lockedTops(job);
  if (!locked.length) return data;
  const missing = locked.filter((k) => !approved || approved[k] === undefined);
  if (missing.length) {
    throw new Error(`${job.id}: "${missing.join('", "')}" is locked, but ${job.approved} has no such section to keep. `
      + 'A lock protects words that already exist; write them first, or drop the lock.');
  }
  const out = {};
  for (const k of [...new Set([...Object.keys(approved), ...Object.keys(data)])]) {
    if (locked.includes(k)) out[k] = approved[k];
    else if (k in data) out[k] = data[k];
    // a non-locked section the writer did not return is LEFT OUT on purpose:
    // the shape check must fail loudly rather than quietly reship stale copy
  }
  return out;
}
