// ✍️ THE COPY JOBS — one entry per writing job in Banana World.
//
// A job is: the brief GPT is given, the JSON Schema its answer must satisfy,
// the field limits the gate enforces, and the two files (the draft it writes,
// the approved copy the game imports). Add a job here and the writer, the gate
// and /dev/copy/ all learn about it at once.
//
// No node builtins: an Astro page imports this at build time.

// one schema property, described for the model in the same words the gate uses
const str = (note) => ({ type: 'string', description: note });
// 🪜 the ladder's ranks per workplace — src/data/town/jobs.js LADDER, mirrored here because this file runs in a throwaway copy
// of tools/ for the lock test (no src/ there). tests/jobs-maths.spec.mjs holds the two equal.
export const LADDER_RANKS = { stand: 3, cafe: 4, condo: 5, store: 5, post: 6 };
const ranksOf = (k) => LADDER_RANKS[k] | 0;

export const BEATS = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night'];

// The residents, by the key the game uses. The NAMES ARE FIXED — a rewrite
// gives the same cast new words, never a new cast, and this is what pins that.
export const TOWN_CAST = [
  ['nib', 'Nib'], ['stamp', 'Stamp'], ['moss', 'Moss'], ['pip', 'Pip'], ['bean', 'Bean'],
  ['figjr', 'Fig Jr.'], ['spinner', 'Spinner'], ['dot', 'Dot'], ['granfig', 'Gran Fig'],
  ['twirl', 'Twirl'],   // 🎡 the tenth (24 Sep 2026): the Wheel of Peel's keeper, when Spinner went back to his arcade
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
  'residents[].hi[]': { kind: 'prose', maxByIndex: [90, 90, 90, 90, 100], note: 'The meeting ladder, rungs 0-4. 0 a stranger, 1 they have noticed you, 2 they use your name and say ONE plain, concrete thing about the square or their counter — never a riddle, never a mood, 3 their own nickname for you, 4 ONE private thing given away — the only warm line they have.' },
  'residents[].ask.doing': { kind: 'prose', aim: 26, max: 34, note: 'The button the PLAYER presses to ask what this resident is doing right now. The player’s own voice, plain and natural. It is pressed at ANY station — a bench, the square, mid-walk — so it must never name an activity the player cannot see (not "What are you writing down?"). Ends in a question mark.' },
  'residents[].ask.want': { kind: 'prose', aim: 26, max: 34, note: 'The button the PLAYER presses to ask whether this resident needs anything. The player’s own voice, plain and natural. Ends in a question mark.' },
  'residents[].ask.curse': { kind: 'prose', emptyOk: true, aim: 26, max: 34, note: 'MOSS ONLY. The button the PLAYER presses to ask about the nights here — the player’s own voice, plain (“What happens here at night?”). Ends in a question mark.' },
  'residents[].curse': { kind: 'prose', emptyOk: true, aim: 170, max: 210, note: 'MOSS ONLY, in his voice: how the nights go here. Some nights the square is cursed; ghosts wander and undo the day’s work, and walking into one sends it off; strange things appear in the dark, and one picked up is yours to keep — though it does something to you for a while; the night stall pays coin for them. Two or three short sentences, concrete and plain; never when, never a number.' },
  'residents[].beats[].beat': { kind: 'enum', values: BEATS },
  'residents[].beats[].lines[]': { kind: 'prose', aim: 90, max: 95, note: 'What they are doing at this station at this time of day. Nobody hears it out loud; it is read off their dialogue card later. Three per beat, and one may hint at another resident.' },
};

// the shape the game needs, checked after the field walk: the same cast, all six
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
    // 🌑 the nights are Moss's to tell, and only his (Trym, 15 Sep: told by a resident, not the board)
    const tells = !!(r.curse || (r.ask && r.ask.curse));
    if (key === 'moss') { if ((r.curse !== undefined || (r.ask && r.ask.curse !== undefined)) && (!r.curse || !r.ask || !r.ask.curse)) say(`${at}.curse`, 'Moss tells of the nights: he needs ask.curse (the button) and curse (his answer)'); }   // absent everywhere = a file from before the topic
    else if (tells) say(`${at}.curse`, `only Moss speaks of the nights — ${name} must not carry ask.curse or curse`);
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
  for (const r of list) if (!TOWN_CAST.some(([k]) => k === r.key)) say(`residents[${r && r.key}]`, `"${r && r.key}" is not one of the cast — the cast is fixed`, 'cast');
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
      description: 'All the residents, in the order the brief lists them.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'name', 'role', 'tap', 'want', 'hi', 'ask', 'beats', 'curse'],
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
            type: 'object', additionalProperties: false, required: ['doing', 'want', 'curse'],   // the API wants every key required: the eight who do not tell of the nights carry ""
            description: 'The two buttons the player can press, in the PLAYER’s voice, not the resident’s.',
            properties: {
              doing: { type: 'string', description: townFields['residents[].ask.doing'].note },
              want: { type: 'string', description: townFields['residents[].ask.want'].note },
              curse: { type: 'string', description: townFields['residents[].ask.curse'].note },
            },
          },
          curse: { type: 'string', description: townFields['residents[].curse'].note },
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

// --- town-personas -----------------------------------------------------------
// 🧍 THE CHARACTER BIBLE. Not dialogue — nobody reads these words in the game. They are
// handed to the writer every time it writes a line for one of the nine, so the lines come
// out of a person instead of a job title. Trym, 13 Sep 2026: "they need to be strong
// identifyable characters all of them in their own way … when creating dialogue for them,
// their personalitys needs to be a part of the dialogue generation".
//
// The temperament ladder is an ENUM because his ask was a RANGE — "some NPCs are grumpy,
// some are normal happy, some are ecstatic" — and a range is the one thing a writer left
// to itself will not produce. Nine pleasant people is the failure mode, and it is
// greppable, so it is checked rather than requested.
export const TEMPERS = ['grumpy', 'gruff', 'wry', 'steady', 'warm', 'sunny', 'ecstatic'];
const SOUR = ['grumpy', 'gruff'];
const BRIGHT = ['sunny', 'ecstatic'];

const personaFields = {
  'residents[].key': { kind: 'key', max: 12, note: 'FIXED. Copy the key from the brief exactly.' },
  'residents[].name': { kind: 'name', max: 14, note: 'FIXED. Copy the name from the brief exactly.' },
  'residents[].temper': { kind: 'enum', values: TEMPERS, note: 'Their default setting. One word from the list — the true one, not the nicest one.' },
  'residents[].born': { kind: 'prose', aim: 170, max: 220, note: 'Where they come from and how they ended up here. Concrete: a road, a bus, a season, an inheritance.' },
  'residents[].loves': { kind: 'prose', aim: 90, max: 120, note: 'One thing they genuinely love, named exactly — a thing you could put in front of them, never a category.' },
  'residents[].hates': { kind: 'prose', aim: 90, max: 120, note: 'One thing that reliably annoys them, named exactly. Small and specific beats grand. No two residents hate the same thing.' },
  'residents[].interest': { kind: 'prose', aim: 120, max: 160, note: 'What they do that has nothing to do with their job. Most of them are slightly odd.' },
  'residents[].quirk': { kind: 'prose', aim: 100, max: 140, note: 'A habit you could watch them do. Physical, repeatable, theirs alone.' },
  'residents[].voice': { kind: 'prose', aim: 150, max: 200, note: 'How they talk, as instructions to a writer: sentence length, rhythm, a word they overuse, a thing they never do. Practical, never poetic.' },
  'residents[].soft': { kind: 'prose', aim: 130, max: 170, note: 'The thing underneath they would not say out loud. The payoff at the top of the acquaintance ladder, so it must be worth arriving at.' },
};

function personaShape(data) {
  const bad = [];
  const say = (path, msg, rule) => bad.push({ path, msg, rule: rule || 'shape' });
  const list = data.residents;
  if (!Array.isArray(list)) { say('residents', 'residents must be an array'); return bad; }
  const seen = new Map(list.map((r, i) => [r && r.key, i]));
  for (const [key, name] of TOWN_CAST) {
    const i = seen.get(key);
    if (i == null) { say(`residents[${key}]`, `"${key}" (${name}) has no persona — the cast is fixed`, 'cast'); continue; }
    if (list[i].name !== name) say(`residents[${i}].name`, `this resident is ${name}; the name is not the writer's to change`, 'cast');
  }
  for (const r of list) if (!TOWN_CAST.some(([k]) => k === r.key)) say(`residents[${r && r.key}]`, `"${r && r.key}" is not one of the cast`, 'cast');

  // 🌡 THE RANGE. Nine agreeable people is not a town, and it is exactly what a writer
  // produces when nobody asks otherwise. These four checks are Trym's "some grumpy, some
  // normal happy, some ecstatic" in the only form that survives a lost context.
  const tempers = list.map((r) => r && r.temper).filter(Boolean);
  const distinct = new Set(tempers);
  if (distinct.size < 5) {
    say('residents[].temper', `only ${distinct.size} temperaments across the cast (${[...distinct].join(', ')}) — the town needs at least five different ones`, 'range');
  }
  for (const t of distinct) {
    const n = tempers.filter((x) => x === t).length;
    if (n > 3) say('residents[].temper', `${n} of the cast are "${t}" — no more than three may share a temperament`, 'range');
  }
  if (!tempers.some((t) => SOUR.includes(t))) say('residents[].temper', `nobody here is ${SOUR.join(' or ')} — at least one resident is genuinely hard work`, 'range');
  if (!tempers.some((t) => BRIGHT.includes(t))) say('residents[].temper', `nobody here is ${BRIGHT.join(' or ')} — at least one resident runs hot`, 'range');

  // and the individuality itself: two residents who hate the same thing are one resident
  for (const field of ['hates', 'loves', 'quirk']) {
    const byValue = new Map();
    list.forEach((r, i) => {
      const v = String((r && r[field]) || '').trim().toLowerCase();
      if (!v) return;
      if (byValue.has(v)) say(`residents[${i}].${field}`, `the same ${field} as ${list[byValue.get(v)].name} — each resident needs their own`, 'range');
      else byValue.set(v, i);
    });
  }
  return bad;
}

const personaSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['residents'],
  properties: {
    residents: {
      type: 'array',
      description: 'All the residents, in the order the brief lists them.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'name', 'temper', 'born', 'loves', 'hates', 'interest', 'quirk', 'voice', 'soft'],
        properties: {
          key: str('The resident’s key, copied from the brief. Never shown to a player.'),
          name: str(personaFields['residents[].name'].note),
          temper: { type: 'string', enum: TEMPERS, description: personaFields['residents[].temper'].note },
          born: str(personaFields['residents[].born'].note),
          loves: str(personaFields['residents[].loves'].note),
          hates: str(personaFields['residents[].hates'].note),
          interest: str(personaFields['residents[].interest'].note),
          quirk: str(personaFields['residents[].quirk'].note),
          voice: str(personaFields['residents[].voice'].note),
          soft: str(personaFields['residents[].soft'].note),
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

// --- town-life -----------------------------------------------------------------
// 🏘️ TOWN LIFE (14 Sep 2026): the few words the town's condition needs — the notice
// board's word for each band, Pip's counter, the travelling stall, the night vendor, the
// ghosts' lines, the closed-today notes and the cursed objects' names. The systems run
// wordless until this is approved (town-room.js reads the file through a glob), so
// nothing here is a placeholder in code and nothing ships unread.
export const TOWN_BANDS = ['abandoned', 'struggling', 'recovering', 'lively', 'thriving'];
export const CURSED_IDS = ['humlantern', 'coldfire', 'stillbear', 'lostpack', 'coldurn', 'redcap', 'tinwalker', 'emptymirror', 'stoppedclock', 'lastlamp'];   // six swapped 15 Sep: small things that read cursed
const lifeFields = {
  'bands[].key': { kind: 'key', max: 12, note: 'FIXED: abandoned, struggling, recovering, lively, thriving, in that order.' },
  'bands[].name': { kind: 'prose', aim: 10, max: 12, note: 'The PLAIN word for the state, capitalised, exactly these five in order: Abandoned, Struggling, Recovering, Lively, Thriving. (The evocative names were bad copy — a newcomer must read the state at once; Trym, 15 Sep.)' },
  'bands[].brings': { kind: 'prose', aim: 50, max: 64, note: 'What this state BRINGS, as the promise on the board for the state above the town’s: the things it opens or lights or fills. A fragment, not a sentence; no number.' },
  'store.greet': { kind: 'prose', aim: 80, max: 120, note: '⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: the card’s heading (store.title) already names Pip’s General Store, so this line does not repeat it (24 Sep 2026, the QA sweep): buy things for your homestead here, and the shelf is different tomorrow. Plain, one breath.' },
  'store.shut': { kind: 'prose', aim: 90, max: 110, note: 'Shown instead of the shelf when the store is shut and Pip is indoors. Not an apology; it should make a player want to fix things.' },
  'store.needs': { kind: 'prose', aim: 24, max: 34, note: 'A row the player cannot buy yet: their house is too small for it. Four or five words.' },
  'store.van': { kind: 'prose', aim: 18, max: 26, note: 'A row that arrives by van rather than at once. Three or four words.' },
  'store.staff': { kind: 'label', max: 16, note: '🔑 Beside a row’s price when Pip’s keyholder (the store’s rank 5) is buying: the price shown is the staff price. Two words, lower case.' },
  'store.sold[]': { kind: 'prose', aim: 70, max: 90, holds: ['{item}'], note: 'Said when somebody buys. MUST contain {item} — the game puts the thing’s name there.' },
  'store.title': { kind: 'label', max: 26, note: 'The heading of Pip’s shelf card: the store’s name as the square spells it.' },
  'store.inShed': { kind: 'prose', max: 40, note: 'Added after the sold line when the thing is in the homestead shed at once: where it went. One plain sentence.' },
  'store.byVan': { kind: 'prose', max: 52, note: 'Added after the sold line when the thing comes by van: it comes to your homestead by the morning van. One plain sentence.' },
  'board.title': { kind: 'prose', aim: 12, max: 18, note: 'The board’s heading. One or two words.' },
  'shutSign': { kind: 'prose', aim: 6, max: 8, note: 'The ONE word on the little red sign in a shut kiosk’s window (Trym, 15 Sep). A word a shop hangs on its door.' },
  'board.intro': { kind: 'prose', aim: 100, max: 120, note: 'The FIRST notice, for a banana who has just walked in and knows nothing: this square is shared by every player; things here break; you fix one by walking up to it; every fix lifts the square for everyone. Two short sentences at most. No number, no rate, no time.' },
  'board.todo': { kind: 'prose', aim: 14, max: 20, note: 'The small heading over the list of what wants doing today. Two or three words.' },
  'board.nothing': { kind: 'prose', aim: 36, max: 48, note: 'Shown instead of that list when the player has fixed everything on it today. One short line; tomorrow brings more.' },
  'board.fixes': { kind: 'prose', aim: 20, max: 28, note: 'The label under the count of things put right today, by everyone. Two to four words, no number.' },
  'board.people': { kind: 'prose', aim: 20, max: 28, note: 'The label under the count of different bananas who did that today.' },
  'board.found': { kind: 'prose', aim: 20, max: 28, note: 'The label under the cursed objects this player has found, out of all of them.' },
  'board.next': { kind: 'prose', aim: 10, max: 14, note: 'The word before the next state’s name on the bar under the lamps. One or two words, like a signpost.' },
  'board.health': { kind: 'prose', aim: 12, max: 16, note: 'The label over the big number on the health card — what the number IS, the way the park’s card says “park health”. Two words.' },
  'board.curse': { kind: 'prose', aim: 80, max: 100, note: 'RETIRED 15 Sep — the nights are Moss’s to tell (town-npcs residents[].curse); kept so the last approved file passes until the next approve. ONE sentence, the standing notice on an ordinary day: some nights the square is cursed — the lamps go dark, the kiosks shut, ghosts wander and undo things. Never when.' },
  'things.lamp[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'A dark street lamp, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'things.litter[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'Rubbish on the cobbles, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'things.bin[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'A street bin overflowing, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'things.dumpster[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'A dumpster open and full, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'things.graffiti[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'A tag on a shopfront, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'things.fountain[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'The fountain run dry, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'things.shutter[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'A kiosk with its shutter down, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'things.crows[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'Crows on a bench or a roof, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'things.leaves[]': { kind: 'prose', aim: 14, max: 22, holds: ['{n}'], note: 'Leaves the storm left, as [one, many]: the singular with its article ("a dark lamp"), the plural with {n} ("{n} dark lamps"). Plain words a newcomer sees at once.' },
  'board.omen': { kind: 'prose', aim: 90, max: 110, note: 'Pinned when a night is coming: the signs the player can see right now (crows on every perch, a ghost by daylight, the sky wrong at the edges). A warning, not a time.' },
  'board.night': { kind: 'prose', aim: 90, max: 110, note: 'Pinned while a Curse Night is on: what to do — keep to the lit lamps, the night stall trades, what lies about may be taken.' },
  'board.after': { kind: 'prose', aim: 90, max: 110, note: 'Pinned the morning after: what the night cost the square, and that today needs hands.' },
  'merchant.name': { kind: 'prose', aim: 20, max: 28, note: 'The travelling stall’s heading: a trade, not a person.' },
  'merchant.greet': { kind: 'prose', aim: 80, max: 100, note: 'One line at the top of the travelling stall’s shelf.' },
  'merchant.lines[]': { kind: 'prose', aim: 70, max: 90, holds: ['{item}'], note: 'Said on a sale at the travelling stall.' },
  'vendor.name': { kind: 'prose', aim: 20, max: 28, note: 'The night vendor’s heading.' },
  'vendor.greet': { kind: 'prose', aim: 80, max: 100, note: 'One line at the top of the night vendor’s shelf. Odd, unhurried, at home in the dark; never frightening.' },
  'vendor.bought': { kind: 'prose', aim: 70, max: 90, holds: ['{item}'], note: 'Said when the vendor buys a cursed object from the player. MUST contain {item}.' },
  'vendor.lines[]': { kind: 'prose', aim: 70, max: 90, holds: ['{item}'], note: 'Said on a sale at the night vendor.' },
  'ghosts[]': { kind: 'prose', aim: 80, max: 100, note: 'What a ghost on the bench says when tapped. Small, odd, a little sad or funny; never a threat, never a riddle, never a question.' },
  'closed.cafe[]': { kind: 'prose', aim: 70, max: 110, note: '⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: say plainly that the Coffee Cup is shut today, name the small fault in one concrete phrase, and say that fixing it opens the door again. Then the old note: Why THE COFFEE CUP is shut today, the way a note taped to its own door reads — a small fault in a coffee kiosk that somebody will see to. ⚠️ THREE FRONTS CAN SHUT AND NO OTHERS (the café, the info point, the general store), and a line only ever hangs on the one it is written for: naming any other building here is a lie on a door. Never the arcade and never the post office, which can never shut.' },
  'closed.info[]': { kind: 'prose', aim: 70, max: 110, note: 'The same, plainly: the map kiosk is shut today, the fault in one concrete phrase, and that fixing it opens it again. Then the old note: The same, for THE INFO POINT — the little map-and-noticeboard kiosk Dot keeps. Its faults are its own: the map, the glass, the leaflets, the light inside it.' },
  'closed.store[]': { kind: 'prose', aim: 70, max: 110, note: 'The same, plainly: the general store is shut today, the fault in one concrete phrase, and that fixing it opens it again. Then the old note: The same, for THE GENERAL STORE — Pip’s shop, which sells fireworks, lures and duck bread. Its faults are its own: a delivery, the till, a shelf, the cellar.' },
  'work.at.store': { kind: 'prose', aim: 20, max: 30, note: 'The general store’s name AS IT FITS INSIDE A SENTENCE — it is dropped into {where} in `hired` and `moved`, so it must read naturally mid-line and carry its own article if it needs one. Not the sign plank, which shouts.' },
  'work.at.condo': { kind: 'prose', aim: 20, max: 30, note: 'The arcade’s name, the same way.' },
  'work.at.cafe': { kind: 'prose', aim: 20, max: 30, note: 'The Coffee Cup’s name, the same way.' },
  'work.at.post': { kind: 'prose', aim: 20, max: 30, note: 'The post office’s name, the same way — Stamp hires there since 22 Sep 2026.' },
  'work.at.stand': { kind: 'prose', aim: 20, max: 30, note: 'The lemonade stand’s name, the same way — Fig Jr. hires there since 22 Sep 2026. Lower case with its article, inside a sentence.' },
  'work.crate': { kind: 'prose', aim: 60, max: 80, note: 'Said as you lift a crate off the stack in the shop you work in. The weight is the point — the banana walks slower while carrying — so let the line feel like picking something heavy up. No instruction, no arrow, no “now take it to…”: the shelf with nothing on it is the instruction.' },
  'work.stocked': { kind: 'prose', aim: 60, max: 80, note: 'Said as the crate goes onto a bare shelf and the face fills. ⭐ the reward IS the shelf and the row now on the till, so this line notices that rather than praising anybody. Never a number, never coins — the chore does not pay in money.' },
  'work.full': { kind: 'prose', aim: 60, max: 80, note: 'Said when every face the shop has is already filled, so there is nothing left to stock today. Contented, not a refusal — the work is DONE, which is a nice thing to be told.' },
  'work.ask': { kind: 'prose', aim: 26, max: 40, note: 'The question the PLAYER asks a boss to be hired, on their dialogue card beside the two they already answer. The player’s voice, not the boss’s. A question, with a question mark.' },
  'work.hired': { kind: 'prose', aim: 80, max: 100, holds: ['{where}'], note: 'The boss saying yes. MUST contain {where} (the building). Warm and a little dry — a job in this town is a favour done gladly, never a contract. ⚠️ {where} IS LOWERCASE AND CARRIES ITS OWN ARTICLE (“the Arcade”), so it may never be the first thing after a full stop or start the line: “Gladly. {where} could use your hands.” printed a sentence beginning with a small letter for two of the three bosses. Keep it inside a clause.' },
  'work.moved': { kind: 'prose', aim: 80, max: 100, holds: ['{where}'], note: 'Said when a player who already works somewhere takes a job here instead. MUST contain {where}. One job at a time is the rule; this line makes leaving the old one feel like a decision, never a telling-off. ⚠️ {where} is lowercase and carries its own article, so it may never follow a full stop or open the line.' },
  'work.already': { kind: 'prose', aim: 70, max: 90, note: 'Said when you ask for a job you already hold. Fond, brief, no admin.' },
  // 💼 ONE JOB AT A TIME, said out loud (Trym, 22 Sep: "there should be a message saying that i need to quit my job at <place> if i try to get a job somewhere else")
  'work.busy': { kind: 'prose', aim: 76, max: 100, holds: ['{where}'], note: 'Said by a boss when a player who ALREADY works somewhere else asks for a job here: one job at a time, so they would have to leave {where} first (MUST contain {where} — the other workplace, lower case with its article, so it must sit inside a clause and never start a sentence). Kind and plain, a little dry — not a rule quoted, not a refusal with a slammed door; the boss would have them, but not while they are somebody else’s. Never “quit” as an order, never a number.' },
  'work.quit': { kind: 'prose', aim: 24, max: 40, note: 'The question the PLAYER asks their OWN boss to stop working here — on the boss’s card beside the job question, only while they hold the job. The player’s voice, plain and polite, a question with a question mark.' },
  'work.paidHere': { kind: 'prose', aim: 56, max: 72, holds: ['{coins}'], needs: [[/\{coins\}/, 'must carry {coins} — the game prints the wage']], note: '💼 Said in the town when a finished week’s wage is paid to a worker with no homestead to collect a payslip at (24 Sep 2026, the job QA: without this they were never paid). Payday, how much, for last week’s work. Plain.' },
  'work.quitDone': { kind: 'prose', aim: 70, max: 100, note: 'The boss letting the player go at their own asking: warm, brief, the door stays open — no guilt, no admin, no number. It is the same door the sack leaves open, in a kinder key.' },
  'work.keep': { kind: 'prose', aim: 90, max: 110, note: 'Said when the player has no kept pass, so wages cannot be theirs yet. ⭐ AN INVITATION, NEVER A PUNISHMENT and never a rule quoted at them: work is something they can keep, and keeping the pass is how. No jargon — not “account”, not “anonymous”.' },
  'work.keepCta': { kind: 'label', aim: 22, max: 30, note: 'The ONE button under the `keep` answer on the boss’s card, which opens the page where a pass is kept. ⚠️ a “no” with nothing to tap is where a newcomer puts the phone down, and this is the whole of the fix: a verb first, two to four words, no full stop, and short enough that it can never wrap on a 360-wide phone. It is the player’s own next step, not an instruction from anybody.' },
  // 💼 THE MOMENT YOU ARE HIRED (22 Sep 2026, Trym: "the dialogue window should close and there should be some sort of salute or splash text saying something about the job i get")
  'work.moment': { kind: 'label', aim: 6, max: 10, note: 'The BIG word the world puts over the square the moment a boss takes the player on, once the boss’s card has closed — the world celebrating with the player, never a character speaking. Capitals, one or two words, at most 10 characters: the plain feeling of being hired.' },
  'work.momentLine': { kind: 'prose', aim: 36, max: 52, holds: ['{where}'], note: 'The small line under that big word: what the player is now, and where. MUST contain {where} (lowercase, carrying its own article, e.g. “the Coffee Cup”) inside a clause, never first. The screen sets it in capitals. No number, no rate, never a promise about pay. At most 52 characters.' },
  'work.start.stand': { kind: 'prose', aim: 64, max: 80, note: 'Straight after HIRED, where the work is and how it starts, in one plain sentence naming only things on screen and the card’s own button (24 Sep 2026: the old lines described a tap that no longer starts a shift). THE LEMONADE STAND: tap the stand, then Go to work on its card; customers come to you.' },
  'work.start.cafe': { kind: 'prose', aim: 64, max: 80, note: 'Straight after HIRED, where the work is and how it starts, in one plain sentence naming only things on screen and the card’s own button (24 Sep 2026: the old lines described a tap that no longer starts a shift). THE COFFEE CUP: tap the kiosk, then Go to work on its card; customers come to you.' },
  'work.start.condo': { kind: 'prose', aim: 64, max: 80, note: 'Straight after HIRED, where the work is and how it starts, in one plain sentence naming only things on screen and the card’s own button (24 Sep 2026: the old lines described a tap that no longer starts a shift). THE ARCADE: inside, sweep up the litter on the floor and fix a cabinet that has gone dark.' },
  'work.start.store': { kind: 'prose', aim: 64, max: 80, note: 'Straight after HIRED, where the work is and how it starts, in one plain sentence naming only things on screen and the card’s own button (24 Sep 2026: the old lines described a tap that no longer starts a shift). PIP’S GENERAL STORE: inside, fill empty shelves from the crates and serve customers at the till.' },
  'work.start.post': { kind: 'prose', aim: 64, max: 80, note: 'Straight after HIRED, where the work is and how it starts, in one plain sentence naming only things on screen and the card’s own button (24 Sep 2026: the old lines described a tap that no longer starts a shift). THE POST OFFICE: tap it, then Go to work on its card, and sort the post.' },
  // 🗣 THE TOWN'S TOASTS (22 Sep 2026): lines that were typed straight into say() — now a gate refuses that
  'toasts.road': { kind: 'prose', aim: 30, max: 44, note: 'Said the moment a player walks off the square by the south road, which takes them to the park; the page changes a beat later. The world noting where they are going. One short line.' },
  'toasts.lure': { kind: 'prose', aim: 60, max: 80, note: 'Said when a player taps a lure in their pocket while in town: a lure only works at the pier at the beach, where it arms itself for the next casts; there is nothing to do with it here. Plain, no number.' },
  'toasts.haunt': { kind: 'prose', aim: 50, max: 70, note: 'Said as a HAUNTED night falls — one of the town’s own nights in ten (23 Sep 2026): darker, a cold rain, the residents indoors, bolder ghosts, a cursed thing to find, and a bigger bite out of the town’s health. The world’s voice, plain: tonight is haunted. Never a time, never how often.' },
  'toasts.warming': { kind: 'prose', aim: 24, max: 40, note: 'The line under an arcade cabinet’s name on its card for the second or two while its game is loading: the machine is warming up. Lower case is fine.' },
  'toasts.asleep': { kind: 'prose', aim: 44, max: 64, note: 'Said when an arcade cabinet’s game could not be loaded (a network hiccup): the machine is not answering right now; try again in a moment.' },
  'toasts.prize': { kind: 'prose', aim: 60, max: 90, holds: ['{prizes}'], note: 'Said when a run on an arcade cabinet wins a prize. MUST contain {prizes} exactly once — the game puts in what was won, as “an arcade visor” (two are joined with a comma); then that it is in the player’s wardrobe now. No number.' },
  'toasts.best': { kind: 'prose', aim: 50, max: 80, holds: ['{best}', '{rank}', '{players}'], note: 'Said when a run sets the player’s new personal best on that cabinet. MUST contain {best} (the score), {rank} (their place on this week’s board) and {players} (how many are on it), each exactly once, and no other number.' },
  // 👝 THE POCKET TRAY (what the Wheel of Peel's prizes go into)
  'pocket.firework': { kind: 'label', aim: 8, max: 14, note: 'The name of a firework as its row in the pocket tray shows it; a count follows it (“×2”). One word, a capital first.' },
  'pocket.lure': { kind: 'label', aim: 4, max: 14, note: 'The name of a fishing lure as its row in the pocket tray shows it; a count follows it. One word, a capital first.' },
  'pocket.lureWhere': { kind: 'label', aim: 24, max: 32, note: 'The small line under a lure’s row in the pocket tray, saying where it works: at the pier, where it arms itself. Lower case, no full stop.' },
  'pocket.use': { kind: 'label', aim: 8, max: 12, note: 'The button on a firework’s row in the pocket tray: set it off here. A verb first, one or two words.' },
  'pocket.empty': { kind: 'label', aim: 6, max: 16, note: 'The pocket tray when there is nothing in it. One or two words.' },
  // 🎆 the firework toast (it was hand-written in the code; 22 Sep 2026)
  'fx.yours': { kind: 'prose', aim: 40, max: 60, note: 'The world noting that the player’s own firework (a pocket item from Pip’s shop) just went up over the square. One short sentence, plain and a little proud.' },
  'fx.named': { kind: 'prose', aim: 40, max: 60, holds: ['{name}'], note: 'The same when the firework carries the name of who launched it — the player’s own name, or another player’s seen from across the square. MUST contain {name}, inside the sentence.' },
  'locks.store': { kind: 'prose', aim: 70, max: 90, note: 'What the general store WILL be, said at a boarded front. Not what it is — it is a worksite. A shop worth waiting for, in one line.' },
  'locks.post': { kind: 'prose', aim: 70, max: 90, note: 'The same, for the post office.' },
  'locks.cafe': { kind: 'prose', aim: 70, max: 90, note: 'The same, for the Coffee Cup.' },
  'locks.story': { kind: 'prose', aim: 70, max: 90, note: 'The one line that says the STORY opens this door, not the town’s health and not money. It must read as a hook — something is coming — never as a refusal. Never a date, never a rate.' },
  'locks.step': { kind: 'prose', aim: 40, max: 60, holds: ['{n}', '{of}'], note: 'How far along the player is, MUST contain {n} and {of} (as in 2 and 4). A sign that only says no is a dead end; this is the half that makes it a quest hook.' },
  'rooms.condo': { kind: 'prose', aim: 60, max: 110, note: '⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is the arcade — tap a cabinet to play; scores go on the board and the prizes are things to wear. Then the old note: Said once, as a player steps into the Arcade: cabinets along one wall, a prize board, coins going in. ⚠️ IT IS THE PLACE TALKING, NOT A HELP STRING. The two room lines used to end with the same seven-word instruction about walking back onto the doorway, which made them the only tutorial voice left in the town — and the doorway is a LIT FLOOR TILE that already says it. So: what it is like to be standing in there. No instruction, and nothing about leaving. 💼 24 Sep 2026 (the job QA): said only to a STRANGER walking in (the place’s own staff are not greeted like its customers), so it also says the place hires — the café and the stand already did.' },
  'rooms.store': { kind: 'prose', aim: 60, max: 110, note: '⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is the inside of Pip’s store — the shelves show what he has today, and the counter sells it. Then the old note: The same, for stepping into the general store: Pip’s counter, shelves bare or full depending on the town. The place talking, in its own way — it must not share a clause, a rhythm or an ending with the arcade’s line, and it must not tell anybody how to leave. 💼 24 Sep 2026 (the job QA): said only to a STRANGER walking in (the place’s own staff are not greeted like its customers), so it also says the place hires — the café and the stand already did.' },
  'lowShut[]': { kind: 'prose', aim: 70, max: 110, note: '⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: this shop is shut because the town is run down; fix broken things in the square and it opens again. Then the old note: Said when a player taps a shopfront THE TOWN has shut — not a one-day fault but a town too low to keep its doors open. It must point at the shared repair: hands in the square lift it and the doors come back. Never a number, never a rate, never a timetable, never a question.' },
  'objects[].id': { kind: 'key', max: 14, note: 'FIXED. The ten ids from the brief, in order.' },
  'objects[].name': { kind: 'prose', aim: 20, max: 28, note: 'Two or three words: the name it has in a collection. More than the ordinary thing’s plain name.' },
  'objects[].desc': { kind: 'prose', aim: 80, max: 100, note: 'One line a player reads in their collection: what this thing DOES that no ordinary one does, said OUTRIGHT and exaggerated — plainly cursed, clear at first read, no hint, no half-said mood (Trym, 15 Sep: “what does this copy even mean?”). Specific and a little funny; never harmful.' },
};
function lifeShape(data) {
  const bad = [];
  const say = (path, msg, rule) => bad.push({ path, msg, rule: rule || 'shape' });
  const bands = data.bands;
  if (!Array.isArray(bands) || bands.length !== TOWN_BANDS.length) say('bands', `five bands: ${TOWN_BANDS.join(', ')}`);
  else bands.forEach((b, i) => { if (!b || b.key !== TOWN_BANDS[i]) say(`bands[${i}].key`, `band ${i} must be "${TOWN_BANDS[i]}" — worst first, the order is fixed`); });
  const names = new Set((bands || []).map((b) => b && String(b.name || '').trim().toLowerCase()).filter(Boolean));
  if (bands && names.size < bands.length) say('bands[].name', 'two bands share a name — each state needs its own word', 'range');
  for (const [path, list, min] of [['store.sold', data.store && data.store.sold, 3], ['merchant.lines', data.merchant && data.merchant.lines, 3], ['vendor.lines', data.vendor && data.vendor.lines, 3], ['ghosts', data.ghosts, 4], ['closed.cafe', (data.closed || {}).cafe, 3], ['closed.info', (data.closed || {}).info, 3], ['closed.store', (data.closed || {}).store, 3], ['lowShut', data.lowShut, 3]]) {
    if (!Array.isArray(list) || list.length < min) say(path, `at least ${min}`);
  }
  for (const [path, v] of [['store.sold', data.store && data.store.sold], ['vendor.bought', data.vendor && [data.vendor.bought]]]) {
    (v || []).forEach((l, i) => { if (!String(l || '').includes('{item}')) say(`${path}[${i}]`, 'must contain {item} — the game puts the thing there'); });
  }
  // ⚠️ {where} IS LOWERCASE AND CARRIES ITS OWN ARTICLE. "Gladly. {where} could use your hands."
  // printed a sentence starting with a small letter for two of the three bosses.
  for (const f of ['prize', 'best']) {
    const t = String(((data.toasts || {})[f]) || '').replace(/\{[a-z]+\}/g, '');
    if (/\d/.test(t)) say(`toasts.${f}`, 'carries a number of its own — the game prints every figure', 'shape');
  }
  // ⚠️ {prizes} is lowercase and carries its own article ("an arcade visor"), like {where}: never a sentence's first word
  if (/(^|[.!?]\s+)\{prizes\}/.test(String(((data.toasts || {}).prize) || ''))) say('toasts.prize', '{prizes} starts a sentence — it is lowercase with its own article ("an arcade visor"), so it must sit inside a clause', 'shape');
  for (const f of ['hired', 'moved', 'busy', 'momentLine']) {
    const l = String(((data.work || {})[f]) || '');
    if (/(^|[.!?]\s+)\{where\}/.test(l)) say(`work.${f}`, '{where} sits at the start of a sentence — it is lowercase and carries its own article, so it must stay inside a clause', 'range');
  }
  // ⚠️ and the two rooms may not end with the same words: one repeated instruction read as a help
  // string rather than as either place talking
  const tail = (l) => String(l || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).slice(-4).join(' ');
  if ((data.rooms || {}).condo && tail((data.rooms || {}).condo) === tail((data.rooms || {}).store)) {
    say('rooms.store', 'ends with the same four words as rooms.condo — two rooms saying one sentence is a help string, not a place', 'range');
  }
  // ⭐ the places answer plainly: Pip's shelf, the two rooms, every shut front
  plainPlace(bad, 'store.greet', (data.store || {}).greet, ['store', 'shop', 'shelf'], ['buy', 'coins', 'sell']);
  plainPlace(bad, 'rooms.condo', (data.rooms || {}).condo, ['arcade', 'cabinet'], ['play', 'score', 'prize']);
  plainPlace(bad, 'rooms.store', (data.rooms || {}).store, ['store', 'shop', 'shelves', 'shelf'], ['buy', 'sell', 'counter']);
  for (const k of ['cafe', 'info', 'store']) ((data.closed || {})[k] || []).forEach((l, i) => plainPlace(bad, 'closed.' + k + '[' + i + ']', l, ['shut', 'closed'], ['fix', 'mend', 'repair', 'open']));
  (data.lowShut || []).forEach((l, i) => plainPlace(bad, 'lowShut[' + i + ']', l, ['shut', 'closed', 'shop', 'door'], ['fix', 'mend', 'repair', 'open', 'hands']));
  const objs = data.objects;
  if (!Array.isArray(objs) || objs.length !== CURSED_IDS.length) say('objects', `ten objects: ${CURSED_IDS.join(', ')}`);
  else objs.forEach((o, i) => { if (!o || o.id !== CURSED_IDS[i]) say(`objects[${i}].id`, `object ${i} must be "${CURSED_IDS[i]}" — the ids are fixed and in order`); });
  // a ghost must not ask the player anything (the player types nothing, ever)
  (data.ghosts || []).forEach((l, i) => { if (/\?\s*$/.test(String(l || ''))) say(`ghosts[${i}]`, 'ends in a question — nobody may ask the player one'); });
  return bad;
}
const lifeSchema = {
  type: 'object', additionalProperties: false, required: ['bands', 'store', 'board', 'merchant', 'vendor', 'ghosts', 'closed', 'lowShut', 'rooms', 'locks', 'work', 'objects', 'things', 'shutSign', 'fx', 'toasts', 'pocket'],
  properties: {
    bands: { type: 'array', description: 'The five bands, worst first, keys fixed.', items: { type: 'object', additionalProperties: false, required: ['key', 'name', 'brings'],
      properties: { key: str(lifeFields['bands[].key'].note), name: str(lifeFields['bands[].name'].note), brings: str(lifeFields['bands[].brings'].note) } } },
    store: { type: 'object', additionalProperties: false, required: ['greet', 'shut', 'needs', 'van', 'sold', 'title', 'inShed', 'byVan'],
      properties: { title: str(lifeFields['store.title'].note), inShed: str(lifeFields['store.inShed'].note), byVan: str(lifeFields['store.byVan'].note), greet: str(lifeFields['store.greet'].note), shut: str(lifeFields['store.shut'].note), needs: str(lifeFields['store.needs'].note), van: str(lifeFields['store.van'].note), staff: str(lifeFields['store.staff'].note),
        sold: { type: 'array', description: lifeFields['store.sold[]'].note, items: { type: 'string' } } } },
    board: { type: 'object', additionalProperties: false, required: ['title', 'intro', 'todo', 'nothing', 'fixes', 'people', 'found', 'next', 'health', 'omen', 'night', 'after'],
      properties: { title: str(lifeFields['board.title'].note), intro: str(lifeFields['board.intro'].note), todo: str(lifeFields['board.todo'].note), nothing: str(lifeFields['board.nothing'].note), fixes: str(lifeFields['board.fixes'].note), people: str(lifeFields['board.people'].note), found: str(lifeFields['board.found'].note),
        next: str(lifeFields['board.next'].note), health: str(lifeFields['board.health'].note), omen: str(lifeFields['board.omen'].note), night: str(lifeFields['board.night'].note), after: str(lifeFields['board.after'].note) } },
    merchant: { type: 'object', additionalProperties: false, required: ['name', 'greet', 'lines'],
      properties: { name: str(lifeFields['merchant.name'].note), greet: str(lifeFields['merchant.greet'].note), lines: { type: 'array', description: lifeFields['merchant.lines[]'].note, items: { type: 'string' } } } },
    vendor: { type: 'object', additionalProperties: false, required: ['name', 'greet', 'bought', 'lines'],
      properties: { name: str(lifeFields['vendor.name'].note), greet: str(lifeFields['vendor.greet'].note), bought: str(lifeFields['vendor.bought'].note), lines: { type: 'array', description: lifeFields['vendor.lines[]'].note, items: { type: 'string' } } } },
    ghosts: { type: 'array', description: lifeFields['ghosts[]'].note, items: { type: 'string' } },
    closed: { type: 'object', additionalProperties: false, required: ['cafe', 'info', 'store'], description: 'Why a front is shut today, KEYED BY THE FRONT — only these three can ever shut.', properties: {
      cafe: { type: 'array', description: lifeFields['closed.cafe[]'].note, items: { type: 'string' } },
      info: { type: 'array', description: lifeFields['closed.info[]'].note, items: { type: 'string' } },
      store: { type: 'array', description: lifeFields['closed.store[]'].note, items: { type: 'string' } },
    } },
    lowShut: { type: 'array', description: lifeFields['lowShut[]'].note, items: { type: 'string' } },
    work: { type: 'object', additionalProperties: false, required: ['at', 'ask', 'hired', 'moved', 'already', 'busy', 'quit', 'quitDone', 'keep', 'keepCta', 'paidHere', 'crate', 'stocked', 'full', 'moment', 'momentLine', 'start'], properties: {
      crate: { type: 'string', description: lifeFields['work.crate'].note },
      stocked: { type: 'string', description: lifeFields['work.stocked'].note },
      full: { type: 'string', description: lifeFields['work.full'].note },
      at: { type: 'object', additionalProperties: false, required: ['store', 'condo', 'cafe', 'post', 'stand'], properties: {
        post: { type: 'string', description: lifeFields['work.at.post'].note },
        stand: { type: 'string', description: lifeFields['work.at.stand'].note },
        store: { type: 'string', description: lifeFields['work.at.store'].note },
        condo: { type: 'string', description: lifeFields['work.at.condo'].note },
        cafe: { type: 'string', description: lifeFields['work.at.cafe'].note },
      } },
      ask: { type: 'string', description: lifeFields['work.ask'].note },
      hired: { type: 'string', description: lifeFields['work.hired'].note },
      moved: { type: 'string', description: lifeFields['work.moved'].note },
      already: { type: 'string', description: lifeFields['work.already'].note },
      busy: { type: 'string', description: lifeFields['work.busy'].note },
      quit: { type: 'string', description: lifeFields['work.quit'].note },
      quitDone: { type: 'string', description: lifeFields['work.quitDone'].note },
      paidHere: { type: 'string', description: lifeFields['work.paidHere'].note },
      keep: { type: 'string', description: lifeFields['work.keep'].note },
      keepCta: { type: 'string', description: lifeFields['work.keepCta'].note },
      moment: { type: 'string', description: lifeFields['work.moment'].note },
      momentLine: { type: 'string', description: lifeFields['work.momentLine'].note },
      start: { type: 'object', additionalProperties: false, required: ['stand', 'cafe', 'condo', 'store', 'post'], properties: {
        stand: { type: 'string', description: lifeFields['work.start.stand'].note },
        cafe: { type: 'string', description: lifeFields['work.start.cafe'].note },
        condo: { type: 'string', description: lifeFields['work.start.condo'].note },
        store: { type: 'string', description: lifeFields['work.start.store'].note },
        post: { type: 'string', description: lifeFields['work.start.post'].note },
      } },
    } },
    locks: { type: 'object', additionalProperties: false, required: ['store', 'post', 'cafe', 'story', 'step'], properties: {
      store: { type: 'string', description: lifeFields['locks.store'].note },
      post: { type: 'string', description: lifeFields['locks.post'].note },
      cafe: { type: 'string', description: lifeFields['locks.cafe'].note },
      story: { type: 'string', description: lifeFields['locks.story'].note },
      step: { type: 'string', description: lifeFields['locks.step'].note },
    } },
    rooms: { type: 'object', additionalProperties: false, required: ['condo', 'store'], properties: {
      condo: { type: 'string', description: lifeFields['rooms.condo'].note },
      store: { type: 'string', description: lifeFields['rooms.store'].note },
    } },
    objects: { type: 'array', description: 'The ten cursed objects, ids fixed and in order.', items: { type: 'object', additionalProperties: false, required: ['id', 'name', 'desc'],
      properties: { id: str(lifeFields['objects[].id'].note), name: str(lifeFields['objects[].name'].note), desc: str(lifeFields['objects[].desc'].note) } } },
    shutSign: str(lifeFields['shutSign'].note),
    fx: { type: 'object', additionalProperties: false, required: ['yours', 'named'], properties: {
      yours: { type: 'string', description: lifeFields['fx.yours'].note },
      named: { type: 'string', description: lifeFields['fx.named'].note },
    } },
    toasts: { type: 'object', additionalProperties: false, required: ['road', 'lure', 'warming', 'asleep', 'prize', 'best', 'haunt'],
      properties: Object.fromEntries(['road', 'lure', 'warming', 'asleep', 'prize', 'best', 'haunt'].map((k) => [k, { type: 'string', description: lifeFields['toasts.' + k].note }])) },
    pocket: { type: 'object', additionalProperties: false, required: ['firework', 'lure', 'lureWhere', 'use', 'empty'],
      properties: Object.fromEntries(['firework', 'lure', 'lureWhere', 'use', 'empty'].map((k) => [k, { type: 'string', description: lifeFields['pocket.' + k].note }])) },
    things: { type: 'object', additionalProperties: false, description: 'What wants doing, in plain words: for each kind, [one, many].', required: ['lamp', 'litter', 'bin', 'dumpster', 'graffiti', 'fountain', 'shutter', 'crows', 'leaves'],
      properties: { lamp: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.lamp[]'].note }, litter: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.litter[]'].note }, bin: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.bin[]'].note }, dumpster: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.dumpster[]'].note }, graffiti: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.graffiti[]'].note }, fountain: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.fountain[]'].note }, shutter: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.shutter[]'].note }, crows: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.crows[]'].note }, leaves: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' }, description: lifeFields['things.leaves[]'].note } } },
  },
};

// ☕ THE COFFEE CUP'S COUNTER (19 Sep 2026, docs/town-cafe-plan.md).
//
// ⚠️ ITS OWN JOB AND ITS OWN FILE, not a `cafe` block on town-life. town-life.json is eager-globbed
// into town-room.js, which is at 96% of its 56 000 B cap with 2 447 B left — two kilobytes of café
// words there is what would blow it, not the code. This file is globbed inside the café's own lazy
// chunk instead, so the town's hot path never carries a word of it.
//
// The hiring is NOT here: `work.ask/hired/moved/already/keep/day` on town-life already ask Bean for
// a job, and `work.at.cafe` already names the building. This is the counter itself.
const cafeFields = {
  far: { kind: 'prose', aim: 50, max: 64, note: '💼 Said when Go to work walked the banana toward the café but the walk stopped short of the counter (a wall in the way), so no shift started (24 Sep 2026, the job QA — the post office’s round.far is the model). Walk up to the window yourself, then try again. Plain; never blame.' },
  tipsAll: { kind: 'prose', aim: 60, max: 72, note: '🗣 Said ONCE in a shift, at the cup whose tip met today’s limit: that is today’s tips all earned, and cups still count for work XP — so the cups after it that float nothing are not read as wrong (24 Sep 2026, the copy review). Plain; never a number.' },
  'go.syrup': { kind: 'label', aim: 14, max: 16, note: '☕ The tray’s button for a special order’s SYRUP step (rank 3): a needle sweeps, one tap stops it. Starts with “Tap”.' },
  special: { kind: 'prose', aim: 50, max: 70, note: '☕ Said at the first special order of a shift (rank 3): some orders add a syrup step, and they tip a little more. Plain; never a number.' },
  'rush.on': { kind: 'prose', aim: 60, max: 70, note: '☕ The town’s toast as a rush begins (the café’s rank 2): customers now come one after another, and serving every one earns extra work XP — the goal is said when it starts, not after. Never how long it lasts or how often it comes.' },
  'rush.done': { kind: 'prose', aim: 60, max: 76, note: '☕ The town’s toast when every customer of the rush was served: the extra work XP is earned, and Bean may notice. Never a number.' },
  on: { kind: 'prose', aim: 50, max: 76, note: '🗣 The toast as the shift starts and the tray rises: where you are and the one thing to do — make each cup the ticket shows. Plain, one breath; the ticket is the pictures on the tray.' },
  'receipt.title': { kind: 'prose', aim: 20, max: 24, note: 'The receipt card’s heading: the place’s name and “receipt”, so it reads as the paper it is.' },
  'receipt.take': { kind: 'prose', aim: 54, max: 72, holds: ['{n}'], note: 'The one measured line naming what the tips came to. MUST contain {n} — the game puts the coins there. ⚠️ a TOTAL is fine and a RATE is forbidden: no “per cup”, no “each”, no “an hour”.' },
  'receipt.none': { kind: 'prose', aim: 50, max: 84, note: 'Shown INSTEAD of the take when no cup went out this shift: so no tips. Plain and never a telling-off.' },
  'receipt.capped': { kind: 'prose', aim: 80, max: 88, note: 'Shown INSTEAD of the take when cups went out but today’s tips were already all earned: the work still counts, for work XP. Plain; never a number.' },
  'receipt.wrong': { kind: 'prose', aim: 56, max: 72, note: 'Shown INSTEAD of the take when cups went out but every one missed the green band, so none tipped (and the day’s limit was not the reason). Plain, never a telling-off; the green band by name.' },
  'receipt.xp': { kind: 'prose', aim: 22, max: 32, holds: ['{n}'], needs: [[/\{n\}/, 'must carry {n} — the game fills it']], note: '🪜 Under the result: the work XP this shift earned toward the next rank (23 Sep 2026, the job ladder). MUST contain {n} — the game prints the number. Plain, a label in a sentence: never praise, never “reward” or “bonus”.' },
  'receipt.back': { kind: 'label', aim: 5, max: 18, note: 'The button that closes the receipt: “Close”, the word every card in the town closes with.' },
  'cup.perfect[]': { kind: 'prose', aim: 56, max: 76, note: '🗣 Said for the FIRST cup of a shift that came out spot on (every step in the middle of the green band), and never again that shift — the +n float over the counter says the rest (24 Sep 2026, design library §30). It names what happened and why it matters: spot on tips more. The GREEN BAND is the only name for the target, because it is the only thing on screen. A deck of 3–4, one picked a shift.' },
  'cup.fine[]': { kind: 'prose', aim: 56, max: 76, note: '🗣 Said for the FIRST cup of a shift that was good but not spot on, and never again that shift. It is the one place the game teaches the grade: the middle of the green band tips more. Plain; the green band by name. A deck of 3–4.' },
  'cup.wrong[]': { kind: 'prose', aim: 56, max: 76, note: '🗣 Said EVERY time a cup comes out wrong (a step outside the green band), because nothing floats and this line is the only thing that says why: they take it, but leave no tip. No blame, no telling-off. A deck of 3–4 so it does not repeat word for word.' },
  left: { kind: 'prose', aim: 60, max: 78, note: 'The toast when a customer waited too long and walked off without a cup. Plain: somebody got tired of waiting and left. They have no name. Never how long they waited.' },
  front: { kind: 'prose', aim: 90, max: 130, note: 'What the Coffee Cup says when a player who does NOT work there taps it. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is Bean’s coffee kiosk; ask Bean for a job and you can serve coffee here for tips. ⚠️ it replaces a hand-written “Not built yet.” that shipped in code and was false — the café is open, Bean is behind it, and the counter is simply Bean’s until Bean hands it over. So: what the place IS, and that the counter belongs to somebody. It must not instruct and must not name a price or a condition — Bean’s own card is where a job is asked for.' },
  idle: { kind: 'prose', aim: 44, max: 54, note: 'The small line ON THE TRAY when nobody is waiting: nobody yet, and the counter is open — so an empty tray reads as quiet, never broken. Never a wait time, never “soon”.' },
  leave: { kind: 'label', aim: 10, max: 12, note: '⭐ THE WAY OUT OF A SHIFT (Trym, 22 Sep: "better to lock it and have a button for leave work"): while you work, your banana is held at the counter and this is the ONE button that ends the shift, on the tray’s strip. A VERB first, two words at most, at most 12 characters, never wraps: the plain thing it does — leave work, step away.' },
  'go.grind': { kind: 'label', aim: 12, max: 16, note: 'The tray’s one button while the GRINDER runs: a needle sweeps the bar and ONE TAP stops it. Trym, 23 Sep 2026: “it isnt obvious that you have to press the button on mobile” — the button NAMES THE GESTURE: it starts with “Tap” (a tap step) — e.g. “Tap to grind”. Never wraps on a 360-wide phone.' },
  'go.pour': { kind: 'label', aim: 12, max: 16, note: 'The same button while the POUR runs: HOLD it down and the cup fills, let go in the band. The café’s one HELD step, and the one a phone player could not tell was held. Trym, 23 Sep 2026: “it isnt obvious that you have to press the button on mobile” — the button NAMES THE GESTURE: it starts with “Hold”.' },
  'go.milk': { kind: 'label', aim: 12, max: 16, note: 'The same button at the MILK: three taps on a swelling pulse. It starts with “Tap” (a tap step).' },
};
// 🍋 THE LEMONADE STAND (22 Sep 2026, docs/town-jobs-plan.md §11.5): the café's counter with a lemonade deck on
// it, so the same fields — re-noted for a stall with a jug on it, a glass instead of a cup, and a kid behind it.
const lemonFields = {
  far: { kind: 'prose', aim: 50, max: 64, note: '💼 Said when Go to work walked the banana toward the stand but the walk stopped short of it (a wall in the way), so no shift started (24 Sep 2026, the job QA — the post office’s round.far is the model). Walk up to the stand yourself, then try again. Plain; never blame.' },
  tipsAll: { kind: 'prose', aim: 60, max: 72, note: '🗣 Said ONCE in a shift, at the glass whose tip met today’s limit: that is today’s tips all earned, and glasses still count for work XP — so the glasses after it that float nothing are not read as wrong (24 Sep 2026, the copy review). Plain; never a number.' },
  'go.fill': { kind: 'label', aim: 14, max: 16, note: '🍋 The tray’s button while the JUG is filled (rank 3): HOLD it, let go at the line. Starts with “Hold”. Never wraps on a 360-wide phone.' },
  'jug.offer': { kind: 'prose', aim: 50, max: 70, note: '🍋 The town’s line the FIRST time in a shift the jug is offered (rank 3, nobody waiting): fill it now, and the next glasses skip the squeeze. Said once a shift — after that the button’s own words do it.' },
  'jug.full': { kind: 'prose', aim: 50, max: 70, note: '🍋 The jug filled: the next glasses skip the squeeze. A count is fine; never a rate or a time.' },
  'jug.spilt': { kind: 'prose', aim: 50, max: 70, note: '🍋 The jug filled badly and spilt: nothing counts, try again when it is quiet. Never a telling-off.' },
  big: { kind: 'prose', aim: 48, max: 66, note: '🍋 Said the first time in a shift a customer orders a big glass (the stand’s rank 2): it is a big glass, and the squeeze is held longer. Plain; never a number, never the tip.' },
  on: { kind: 'prose', aim: 50, max: 76, note: '🗣 The toast as the shift starts and the tray rises: where you are and the one thing to do — make each glass the ticket shows. Plain, one breath; the ticket is the pictures on the tray.' },
  'receipt.title': { kind: 'prose', aim: 20, max: 24, note: 'The receipt card’s heading: the place’s name and “receipt”, so it reads as the paper it is.' },
  'receipt.take': { kind: 'prose', aim: 54, max: 72, holds: ['{n}'], note: 'The one measured line naming what the tips came to. MUST contain {n} — the game puts the coins there. A TOTAL is fine and a RATE is forbidden: no “per glass”, no “each”.' },
  'receipt.none': { kind: 'prose', aim: 50, max: 84, note: 'Shown INSTEAD of the take when no glass went out this shift: so no tips. Plain and never a telling-off.' },
  'receipt.capped': { kind: 'prose', aim: 80, max: 88, note: 'Shown INSTEAD of the take when glasses went out but today’s tips were already all earned: the work still counts, for work XP. Plain; never a number.' },
  'receipt.wrong': { kind: 'prose', aim: 56, max: 72, note: 'Shown INSTEAD of the take when glasses went out but every one missed the green band, so none tipped (and the day’s limit was not the reason). Plain, never a telling-off; the green band by name.' },
  'receipt.xp': { kind: 'prose', aim: 22, max: 32, holds: ['{n}'], needs: [[/\{n\}/, 'must carry {n} — the game fills it']], note: '🪜 Under the result: the work XP this shift earned toward the next rank (23 Sep 2026, the job ladder). MUST contain {n} — the game prints the number. Plain, a label in a sentence: never praise, never “reward” or “bonus”.' },
  'receipt.back': { kind: 'label', aim: 5, max: 18, note: 'The button that closes the receipt: “Close”, the word every card in the town closes with.' },
  'cup.perfect[]': { kind: 'prose', aim: 56, max: 76, note: '🗣 Said for the FIRST glass of a shift that came out spot on (every step in the middle of the green band), and never again that shift — the +n float over the counter says the rest (24 Sep 2026, design library §30). It names what happened and why it matters: spot on tips more. The GREEN BAND is the only name for the target, because it is the only thing on screen. A deck of 3–4, one picked a shift.' },
  'cup.fine[]': { kind: 'prose', aim: 56, max: 76, note: '🗣 Said for the FIRST glass of a shift that was good but not spot on, and never again that shift. It is the one place the game teaches the grade: the middle of the green band tips more. Plain; the green band by name. A deck of 3–4.' },
  'cup.wrong[]': { kind: 'prose', aim: 56, max: 76, note: '🗣 Said EVERY time a glass comes out wrong (a step outside the green band), because nothing floats and this line is the only thing that says why: they take it, but leave no tip. No blame, no telling-off. A deck of 3–4 so it does not repeat word for word.' },
  left: { kind: 'prose', aim: 60, max: 78, note: 'The toast when a customer waited too long and walked off without a glass. Plain: somebody got tired of waiting and left. They have no name. Never how long they waited.' },
  front: { kind: 'prose', aim: 90, max: 130, note: 'What the lemonade stand says when a player who does NOT work there taps it. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is Fig Jr.’s lemonade stand; ask Fig Jr. for a job and you can pour lemonade here for tips. ⚠️ it replaces a hand-written line ending “Not built yet.” which is false — the stand is open and Fig Jr. is behind it. What the place IS and whose it is; never an instruction, never a price, never how to get a job (Fig Jr.’s own card asks that).' },
  idle: { kind: 'prose', aim: 44, max: 54, note: 'The small line ON THE TRAY when nobody is waiting: nobody yet, and the stand is open — so an empty tray reads as quiet, never broken. Never a wait time, never “soon”.' },
  leave: { kind: 'label', aim: 10, max: 12, note: '⭐ THE WAY OUT OF A SHIFT (Trym, 22 Sep: "better to lock it and have a button for leave work"): while you work, your banana is held at the counter and this is the ONE button that ends the shift, on the tray’s strip. A VERB first, two words at most, at most 12 characters, never wraps: the plain thing it does — leave work, step away.' },
  'go.squeeze': { kind: 'label', aim: 12, max: 16, note: 'The tray’s one button while the LEMON is squeezed: HOLD it down, let go in the band. The stand’s one HELD step. Trym, 23 Sep 2026: “it isnt obvious that you have to press the button on mobile” — the button NAMES THE GESTURE: it starts with “Hold”. Never wraps on a 360-wide phone.' },
  'go.ice': { kind: 'label', aim: 12, max: 16, note: 'The same button at the ICE: three taps on a pulse. It starts with “Tap” (a tap step).' },
  'go.pour': { kind: 'label', aim: 12, max: 16, note: 'The same button while the water is POURED: one tap stops a sweeping needle at the line. It starts with “Tap” (a tap step) — never the café’s held “pour”.' },
};
const LEMON_CAFE = /\b(propeller|apron|barista|coffee|espresso|foam|milk|grind|grinder|rope|cups?)\b/i;
// 🫳 THE BUTTON NAMES ITS GESTURE (Trym, 23 Sep 2026: “it isnt obvious that you have to press the button on mobile” — the button NAMES THE GESTURE). Which steps are held and which are tapped is the decks' own
// (town-cafe.js STATIONS, town-lemon.js LEMON_DECK): a held step says Hold, a tapped one says Tap, so the words can
// never drift back to naming the thing instead of the thumb.
function gestureLabels(bad, go, held, tapped) {
  for (const k of held) if (!/^hold\b/i.test(String((go || {})[k] || ''))) bad.push({ path: 'go.' + k, msg: 'is a HELD step: its button starts with “Hold”', rule: 'shape' });
  for (const k of tapped) if (!/^tap\b/i.test(String((go || {})[k] || ''))) bad.push({ path: 'go.' + k, msg: 'is a TAPPED step: its button starts with “Tap”', rule: 'shape' });
}
function lemonShape(data) {
  const bad = cafeRules(data);
  gestureLabels(bad, data.go, ['squeeze', 'fill'], ['ice', 'pour']);   // the same mechanical rules: decks are decks, nobody is asked a question, {drink} is there
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });
  const walk = (v, path) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + '[' + i + ']'));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], path ? path + '.' + k : k);
    else if (typeof v === 'string' && LEMON_CAFE.test(v)) say(path, 'is the café talking (' + String(v.match(LEMON_CAFE)[0]) + ') — this is a lemonade stand: a glass, a jug, a table, a lane');
  };
  walk(data, '');
  plainPlace(bad, 'front', data.front, ['lemonade stand', 'lemonade'], ['job', 'work', 'sell', 'pour', 'tips']);
  return bad;
}
const lemonSchema = {
  type: 'object', additionalProperties: false, required: ['on', 'receipt', 'idle', 'front', 'go', 'cup', 'left', 'leave', 'tipsAll'],
  properties: {
    leave: str(lemonFields.leave.note), far: str(lemonFields.far.note),
    on: str(lemonFields.on.note), idle: str(lemonFields.idle.note), front: str(lemonFields.front.note), left: str(lemonFields.left.note),
    receipt: { type: 'object', additionalProperties: false, required: ['title', 'take', 'none', 'capped', 'wrong', 'xp', 'back'],
      properties: { wrong: str(lemonFields['receipt.wrong'].note), xp: str(lemonFields['receipt.xp'].note), title: str(lemonFields['receipt.title'].note), take: str(lemonFields['receipt.take'].note), none: str(lemonFields['receipt.none'].note), capped: str(lemonFields['receipt.capped'].note), back: str(lemonFields['receipt.back'].note) } },
    tipsAll: str(lemonFields.tipsAll.note),
    go: { type: 'object', additionalProperties: false, required: ['squeeze', 'ice', 'pour'], properties: { squeeze: str(lemonFields['go.squeeze'].note), ice: str(lemonFields['go.ice'].note), pour: str(lemonFields['go.pour'].note) } },
    cup: { type: 'object', additionalProperties: false, required: ['perfect', 'fine', 'wrong'],
      properties: { perfect: { type: 'array', minItems: 3, maxItems: 4, items: str(lemonFields['cup.perfect[]'].note) }, fine: { type: 'array', minItems: 3, maxItems: 4, items: str(lemonFields['cup.fine[]'].note) }, wrong: { type: 'array', minItems: 3, maxItems: 4, items: str(lemonFields['cup.wrong[]'].note) } } },
  },
};

// ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026). The rule cannot be judged by a machine, but its two
// answers leave marks a machine can read: the line names the place, and it names something a player can DO
// there. A line with neither is the poetry Trym could not read (“the striped awning on Hall Street”).
export function plainPlace(bad, path, v0, names, doings) {
  const v = String(v0 || '').toLowerCase();
  if (!v) return;
  if (!names.some((w) => v.includes(w))) bad.push({ path, msg: 'does not name the place (one of: ' + names.join(', ') + ') — a tap on a place says what it is', rule: 'plain' });
  if (doings && !doings.some((w) => v.includes(w))) bad.push({ path, msg: 'does not say what a player can do here (one of: ' + doings.join(', ') + ')', rule: 'plain' });
}

// 🤫 THE QUIET RULE HAS NO OTHER GUARD. Nothing in the client can stop a line that reads as a
// banana speaking, so the mechanical half is here: nobody may be asked a question, and the decks
// must be decks (one line repeated twice over a long shift is what a deck exists to prevent).
function cafeRules(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });   // an OBJECT: copy-rules reads p.path / p.msg; a pair printed as "undefined undefined"
  for (const k of ['perfect', 'fine', 'wrong']) {
    const deck = ((data.cup || {})[k]) || [];
    if (deck.length < 3) say(`cup.${k}`, `a deck of at least 3 — one line twice in a shift is what a deck exists to prevent (got ${deck.length})`);
    deck.forEach((l, i) => { if (/\?\s*$/.test(String(l || ''))) say(`cup.${k}[${i}]`, 'ends in a question — nobody may ask the player one'); });
  }
  for (const f of ['on', 'left', 'front', 'tipsAll']) {
    if (/\?\s*$/.test(String(data[f] || ''))) say(f, 'ends in a question — nobody may ask the player one');
  }
  return bad;
}
// the café's own shape: the shared rules, then its front names the Coffee Cup (the stand shares the rules, not the name)
function cafeShape(data) {
  const bad = cafeRules(data);
  gestureLabels(bad, data.go, ['pour'], ['grind', 'milk', 'syrup']);
  plainPlace(bad, 'front', data.front, ['coffee cup', 'kiosk', 'café', 'cafe'], ['job', 'work', 'serve', 'tips']);
  return bad;
}
const cafeSchema = {
  type: 'object', additionalProperties: false, required: ['on', 'idle', 'front', 'receipt', 'go', 'cup', 'left', 'leave', 'tipsAll'],
  properties: {
    leave: str(cafeFields.leave.note), far: str(cafeFields.far.note),
    on: str(cafeFields.on.note),
    receipt: { type: 'object', additionalProperties: false, required: ['title', 'take', 'none', 'capped', 'wrong', 'xp', 'back'],
      properties: { wrong: str(cafeFields['receipt.wrong'].note), xp: str(cafeFields['receipt.xp'].note), title: str(cafeFields['receipt.title'].note), take: str(cafeFields['receipt.take'].note), none: str(cafeFields['receipt.none'].note), capped: str(cafeFields['receipt.capped'].note), back: str(cafeFields['receipt.back'].note) } },
    tipsAll: str(cafeFields.tipsAll.note),
    idle: str(cafeFields.idle.note),
    front: str(cafeFields.front.note),
    go: { type: 'object', additionalProperties: false, required: ['grind', 'pour', 'milk'],
      properties: { grind: str(cafeFields['go.grind'].note), pour: str(cafeFields['go.pour'].note), milk: str(cafeFields['go.milk'].note) } },
    cup: { type: 'object', additionalProperties: false, required: ['perfect', 'fine', 'wrong'],
      properties: {
        perfect: { type: 'array', description: cafeFields['cup.perfect[]'].note, items: { type: 'string' } },
        fine: { type: 'array', description: cafeFields['cup.fine[]'].note, items: { type: 'string' } },
        wrong: { type: 'array', description: cafeFields['cup.wrong[]'].note, items: { type: 'string' } },
      } },
    left: str(cafeFields.left.note),
  },
};

// --- town-dress ----------------------------------------------------------------
// 👕 THE CLOTHES SHOP (20 Sep 2026). A card with a mirror and three rails, and the one place in
// Banana World that is not a workplace, not a shop you buy from and not a game. Six strings and a
// tooltip. The shop runs wordless until this is approved, like every surface in this world.
const dressFields = {
  title: { kind: 'prose', aim: 18, max: 26, note: 'The heading at the top of the card: a NAME for the little room with the mirrors in it, two or three words, not a sentence. ⚠️ not the word on the plank outside — that already says CLOTHES.' },
  line: { kind: 'prose', aim: 64, max: 110, note: '⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is the clothes shop — try on and change your banana’s hat and glasses here; what you have not earned is shown where to find it. Then the old note: The one small line under the rails, and the only prose on the card. It notices the ROOM or the moment — the lamp, the mirrors, the quiet, nobody waiting — and never the player’s taste, never their outfit, never what to do next. ⚠️ nobody works here, so it may not welcome anybody, and nothing is sold here, so no word may smell of a till.' },
  alt: { kind: 'label', aim: 60, max: 90, note: 'Read out to somebody who cannot see the mirror: one plain sentence describing what is drawn — a banana standing in a lit changing room between two tall mirrors. A label, not atmosphere: plain and useful.' },
  // ❌ THE RAIL NAMES ARE NOT IN THIS JOB ANY MORE, and that is the honest answer rather than a lock.
  // Trym, 20 Sep 2026: "why isnt it Shades, Hats, Body, Shoes, Extras like in the original Make A
  // Banana for consistency?" They are not this room's words to choose at all — they are Make A
  // Banana's own <label> rows, years old, and the dressing room reads them straight out of
  // src/lib/wardrobe-slots.js, the file that exists so the builder, the shop and the world cannot
  // drift. A copy of them here, even a locked one, would be a second source to keep in step.
  // tools/check-wardrobe-rows.mjs holds the builder and the library to the same five words.
  confirm: { kind: 'label', aim: 10, max: 16, note: 'The one button at the foot of the card, and the ONLY thing that puts the outfit on — close the card any other way and the banana walks out in what it came in wearing. A verb first, one or two words, ONE line. ⚠️ it is the last word in a changing room, so it belongs to the moment of stepping out in something, not to a form: never “Save”, never “OK”, never “Apply”, and nothing that smells of a till.' },
  locked: { kind: 'prose', aim: 46, max: 64, holds: ['{where}'], note: 'What a dimmed, padlocked garment says when you rest on it. MUST contain {where} — the game puts the place it is caught there (“the rave”, “the pier”, “the park garden”). ⭐ AN INVITATION, NEVER A REFUSAL: the thing is on the rail precisely so you learn it exists and where it lives, so it is about the PLACE and what happens there. Never “locked”, never “unlock”, never “you can’t”. Short: it sits in a tooltip on a 44-pixel chip.' },
};
// 🛒 NOTHING IS SOLD IN THIS ROOM, and that is the one rule a machine can hold. A price, a coin or a
// verb from a till turns a mirror into a shop, which is the exact thing this card is not.
const DRESS_TILL = /\b(buy|price|coin|cost|sale|sell|purchase|checkout|unlock|locked)\b/i;
function dressShape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });   // an OBJECT: copy-rules reads p.path / p.msg; a pair printed as "undefined undefined"
  const flat = (o, p) => Object.entries(o || {}).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, String(v)]]));
  for (const [path, v] of flat(data, '')) {
    if (DRESS_TILL.test(v)) say(path, 'reads like a till — nothing is sold in the dressing room, and no word here may suggest it is');
    if (/\?\s*$/.test(v)) say(path, 'ends in a question — nobody may ask the player one');
  }
  if (!String(data.locked || '').includes('{where}')) say('locked', 'must contain {where} — the game puts the place it is caught there');
  return bad;
}
const dressSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'line', 'alt', 'confirm', 'locked'],
  properties: {
    title: str(dressFields.title.note),
    line: str(dressFields.line.note),
    alt: str(dressFields.alt.note),
    confirm: str(dressFields.confirm.note),
    locked: str(dressFields.locked.note),
  },
};

// --- town-post ----------------------------------------------------------------
// ✉️ THE POST OFFICE (20 Sep 2026, docs/town-jobs-plan.md §6) — the first surface in Banana World
// where one player's words reach another. Eleven strings, and one of them is the hardest line in the
// town: a refusal that must be kind, final and completely uninformative, because a precise reason is
// a lesson in how to get round the filter next time.
const postFields = {
  front: { kind: 'prose', aim: 84, max: 130, note: 'What the post office says when a player taps it. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is the post office; your mailbox is here — read letters from other players and write back; ask Stamp for a job to sort the post. ⚠️ it replaces a hand-written line ending “Not built yet.”, which is no longer true — there is a mailbox in there with post in it. What the building IS, and that your post is inside. No instruction, no promise of anything that is not there, and no mention of postcards (not built).' },
  title: { kind: 'prose', aim: 16, max: 24, note: 'The heading on the mailbox card: a NAME for the place your letters sit, two or three words, not a sentence.' },
  empty: { kind: 'prose', aim: 78, max: 105, note: 'The whole of the card when there is no post at all. ⭐ THIS IS THE MOST-READ STRING IN THE JOB — an empty box is what most players will find for a long time, so it has to be a pleasant place to land rather than a failure. One or two short lines. It may not promise post is coming and may not tell anybody to go and write one.' },
  noaddress: { kind: 'prose', aim: 92, max: 120, note: 'The whole of the card for a player with NO ADDRESS YET. A mailbox is keyed to the homestead’s sign name, so somebody who has never claimed a yard has nowhere for a letter to land. ⚠️ NOT the same as the counter being closed — it used to print that line, which is a lie: the post office is fine and the player has no door. ⭐ A DOOR, NOT A REFUSAL, the same rule as a locked garment on the dressing-room rail: post goes to a house, this player has not put a name on one, and the HOMESTEAD is where that is fixed. No instruction ("go and claim one"), no promise that post is waiting, and nothing that suggests they did something wrong.' },
  shut: { kind: 'prose', aim: 66, max: 90, note: 'Replaces the letters when the post is not running at all. An ordinary, temporary thing — the counter is closed. Not an error and not an apology. Never “server”, never “down”, never “error”, never a time.' },
  from: { kind: 'label', aim: 10, max: 18, holds: ['{who}'], note: 'The small label over who a letter came from. One or two words, MUST contain {who} — the game puts the sender’s name there.' },
  // 📬 THE TWO DRAWERS (22 Sep 2026, Trym: "make sure it looks great visually in the mailbox when you have lots of
  // letters so its not all in a long list, maybe a 'read' or 'archive' minitab for old letters, so you always see
  // the fresh letters youve received from anyone, users and residents")
  'drawers.fresh': { kind: 'label', aim: 5, max: 9, note: '📬 THE TAB OVER THE POST YOU HAVE NOT OPENED YET. The mailbox has two drawers now, so new post is always the first thing you see and older post never buries it. ONE word, titled, the way a tray or a drawer is labelled. The game puts a small count beside it.' },
  'drawers.kept': { kind: 'label', aim: 5, max: 9, note: 'THE OTHER TAB: the post you have already opened — one row per person who wrote, and the postcards you kept. ONE word, titled. ⚠️ never “Archive”, “Inbox”, “Folder”, “Old” or “Read”: it is a drawer of letters worth keeping, not a mail program’s folder.' },
  'drawers.none': { kind: 'prose', aim: 58, max: 84, note: 'The whole of the new-post drawer when nothing new has come but older post IS kept in the other drawer. It may point to the other drawer by its name, calmly. ⚠️ Not the same as `empty` (a box with nothing in it at all): this box has post, just nothing new. It may not promise post is coming and may not tell anybody to go and write one.' },
  // 🚪 THE KNOCK (22 Sep 2026) — the rail that actually holds (docs/town-jobs-plan.md §6)
  'knock.line': { kind: 'label', aim: 14, max: 22, holds: ['{who}'], note: '🚪 THE LINE ON A KNOCK. Post from a house the reader has never had post from waits at the door instead of coming straight in: the reader sees WHO, never what they wrote, until they let them in. MUST contain {who} (the game puts the sender’s name there). Two to four words, one line: somebody is at the door, not a warning.' },
  'knock.about': { kind: 'prose', aim: 84, max: 116, note: 'The one line above the knocks, saying what they are in plain words: post from a house that has not written to you before waits at the door; let them in and you can read it, and whatever they send after comes straight in. ⚠️ It may not frighten (never “stranger”, “danger”, “unknown”, “blocked”), may not name a rule or a filter, and it is not a list of instructions. One or two short sentences.' },
  'knock.in': { kind: 'label', aim: 7, max: 11, note: 'The button that lets the house in: the letter comes in to be opened, and everything they send after comes straight in. A verb first, one or two words, ONE line in half of a 261-pixel row.' },
  'knock.away': { kind: 'label', aim: 8, max: 11, note: 'The button beside it that turns the house away: this post goes, and that house does not knock again. A verb first, one or two words, ONE line in the other half of the row. Plain and never cruel — never “block” or “report”.' },
  'knock.gone': { kind: 'prose', aim: 52, max: 74, note: 'The toast after turning a house away: the knock is gone and that house will not knock again. Matter-of-fact. ⚠️ It may not say what the sender is told (they are told nothing), and it may not thank or praise.' },
  back: { kind: 'label', aim: 8, max: 14, note: 'The button that goes back up a level — from an open letter to the list, and from one person’s letters to the mailbox. A verb first, one or two words, one line, and it must make sense in BOTH of those places.' },
  report: { kind: 'label', aim: 14, max: 20, note: 'The button under an open letter that reports it. A verb first, two or three words, plain — this is a normal thing a person might do, not an accusation. One line, always.' },
  reported: { kind: 'prose', aim: 66, max: 88, note: 'The one line after they tap it: the letter is gone from their box and somebody will read it. Matter-of-fact and brief. It must not thank them, must not praise them, and must not say what happens to the sender, because nobody knows yet.' },
  reply: { kind: 'label', aim: 12, max: 18, note: 'The button that opens the sheet to write back. A verb first, two or three words, one line.' },
  sheet: { kind: 'prose', aim: 30, max: 44, holds: ['{who}'], note: 'The one small line above the writing paper, saying who it is going to. MUST contain {who}. Nothing else — no instruction, no encouragement, no word count.' },
  send: { kind: 'label', aim: 8, max: 14, note: 'The button that sends the letter. A verb first, one or two words, one line.' },
  sent: { kind: 'prose', aim: 54, max: 76, note: 'The world’s line once a letter has gone. Quiet and done — the feeling of a letter dropping into a box, not a receipt. Never “successfully”, never “delivered”.' },
  'card.title': { kind: 'prose', aim: 16, max: 24, note: 'The heading on the sheet where a postcard is made: a NAME for the thing being made, two or three words, not an instruction.' },
  'card.places.park': { kind: 'label', aim: 10, max: 18, note: 'The place name printed under the park’s picture (the fountain and its plaza). Its own name, titled, never renamed.' },
  'card.places.home': { kind: 'label', aim: 12, max: 20, note: 'The same, under the picture of your own gate on the road. ⚠️ this one is the PLAYER’S OWN place, which the word may acknowledge.' },
  'card.places.rave': { kind: 'label', aim: 10, max: 18, note: 'The same, under the picture of the Banana Rave: beams, a dark floor, a crowd. Its own name, titled.' },
  'card.lines[]': { kind: 'prose', aim: 40, max: 62, note: '⭐ ONE LINE OF THE DECK, AND THE DECK IS THE ENTIRE VOCABULARY OF EVERY POSTCARD ANYBODY WILL EVER SEND. Short — the back of a card with somebody waiting behind you in the queue. ⚠️ IT MUST WORK UNDER ALL THREE PICTURES (the park, a gate on a road, the rave), because the sender picks the place and the line separately and will pick the odd combination on purpose. Nobody is named, nothing is asked (a postcard has no reply box, so a question can never be answered), and the eight must not read as eight ways of saying one thing: some warm, some dry, one or two funny because they are so flat.' },
  'card.make': { kind: 'label', aim: 9, max: 13, note: '⭐ THE BUTTON THAT STARTS A POSTCARD, side by side with the one that starts a letter, under anything you have open. A verb first, ONE line, and SHORT — it shares a row with “Write back” inside a 261-pixel card, and a label that has to be cut with an ellipsis is a label nobody can read. ⚠️ not the sheet’s heading (card.title), which names the thing being made rather than the act of making one.' },
  'card.send': { kind: 'label', aim: 8, max: 14, note: 'The button that sends the postcard. A verb first, one or two words, ONE line.' },
  'card.sent': { kind: 'prose', aim: 54, max: 76, note: 'The world’s line once the card has gone — the feeling of a card dropping in, not a receipt. ⚠️ it may not repeat the letter’s own `sent` line: two different things happened.' },
  'card.got': { kind: 'label', aim: 14, max: 24, holds: ['{who}'], note: 'The small label over a postcard in the mailbox, saying who sent it. MUST contain {who}. ⚠️ not the letter’s `from`: a letter is FROM somebody, a postcard was SENT by somebody from somewhere, and the words may notice it.' },
  'folk.title': { kind: 'prose', aim: 16, max: 24, note: '⚠️ THE HEADING OVER THE ADDRESS BOOK, and it REPLACES the mailbox’s own — you tapped “Write a letter” and landed on a page headed “Your Mailbox”, which names the wrong room. Two or three words, a NAME for the list of people you could write to, never an instruction and never a question. It may not be the mailbox’s title and may not use the word mailbox.' },
  'folk.write': { kind: 'label', aim: 12, max: 16, note: '⭐ THE BUTTON THAT OPENS THE ADDRESS BOOK, and the most important label in this job — it sits at the bottom of the mailbox and it is the ONLY way anybody ever writes a first letter. A verb first, two or three words, ONE line inside 261 pixels. It is about writing to somebody, not about the book: never “Directory”, never “Find people”, never “Browse”.' },
  'folk.find': { kind: 'label', aim: 20, max: 28, note: 'The placeholder inside the search box above the list of people. It says what you can type — a name, or the name of a house. Never an instruction with a verb (“Search for…”): a placeholder is an example, not an order.' },
  'folk.wait': { kind: 'prose', aim: 30, max: 44, note: 'The one line where the list goes, for the half-second the book is on its way. Calm and brief — it is a page turning, not a load. Never “Loading”, never a spinner’s words, never a promise about what will be there.' },
  'folk.empty': { kind: 'prose', aim: 74, max: 100, note: 'The whole of the list when there is genuinely NOBODY to write to — a world this small will hit it. ⚠️ it must not read as a fault and must not read as sad: the people are simply not about. It may not explain the rule (a Pass and a Homestead), may not name a number, and may not tell anybody to come back later.' },
  'folk.none': { kind: 'prose', aim: 56, max: 78, note: 'The same place, when a SEARCH found nobody. It is about the word they typed, not about the world being empty — the two states are different and must not share a line. Never an apology, never “try again”.' },
  nopass: { kind: 'prose', aim: 74, max: 100, note: '⚠️ WHAT THE COUNTER SAYS WHEN IT CANNOT TELL WHOSE THE LETTER IS. Post is signed by the house it came from, and this device has not shown the counter who it is — which happens to somebody coming back after a long time away, before anything has caught up. ⭐ IT MUST NOT BLAME THE LETTER: the words are fine, the writer is simply not known yet, and telling them their ordinary letter was rejected is the one lie this card must never tell. Not technical (never “pass”, “token”, “sync”, “device”, “signed in”), not an error, and it does not instruct — it is the clerk not finding your name behind the counter yet. Calm and brief, and it leaves the letter still there to send.' },
  // ✉️ THE SORTING ROUND (22 Sep 2026, docs/town-jobs-plan.md §11.4): the post office's own job, on the café's tray
  'round.start': { kind: 'label', aim: 12, max: 16, note: '⭐ THE BUTTON AT THE FOOT OF THE MAILBOX CARD that only the post office’s own staff ever see: it starts a round of sorting at the counter. A verb first, two or three words, ONE line, never wraps on a phone.' },
  'round.on': { kind: 'prose', aim: 60, max: 78, note: 'The town’s toast as a round begins: the pile is on the counter, the four pigeonholes behind it. It NOTICES, the way the café’s clock-in line does — it must not instruct (no “tap”, no “match”, no “sort the…”), and it names no number.' },
  'round.holes.park': { kind: 'label', aim: 8, max: 16, note: 'The park’s name as the post office writes it on a pigeonhole — read out to somebody who cannot see the flower stamped on it. Its own name, one or two words, titled.' },
  'round.holes.beach': { kind: 'label', aim: 10, max: 16, note: 'The same for Banana Bay, whose stamp is a fish. Its own name, titled.' },
  'round.holes.home': { kind: 'label', aim: 10, max: 16, note: 'The same for the homesteads — everybody’s own plot, whose stamp is a house. One or two words, titled.' },
  'round.holes.rave': { kind: 'label', aim: 10, max: 16, note: 'The same for the Banana Rave, whose stamp is a note of music. Its own name, titled.' },
  'round.registered': { kind: 'prose', aim: 40, max: 48, note: '🔴 Under the pigeonholes the first time a REGISTERED card (a red seal) comes up in a round (rank 4): sort it at once — late counts as wrong. ⚠️ ONE LINE on a 360 phone.' },
  'round.parcel': { kind: 'prose', aim: 40, max: 48, note: '📦 Under the pigeonholes the first time a PARCEL comes up in a round (rank 3): sort it, then tap it while it sits on the scale. ⚠️ ONE LINE on a 360 phone.' },
  'round.holes.town': { kind: 'label', aim: 10, max: 16, note: 'The same for Banana Town itself, the fifth hole a senior sorter gets (rank 2), whose stamp is the town hall’s bell. Its own name, titled.' },
  'round.hint': { kind: 'prose', aim: 40, max: 60, note: '⭐ THE ONE-TIME NOTICE under the pigeonholes, shown through a player’s FIRST round only (Trym, 22 Sep: “a small one-time notice by the sorting buttons that says something about what to do … Short and sweet”). One short line that says what the round wants: the card on the counter goes into the hole with the same stamp. It may explain, but it may not name a control — no “tap”, “click”, “button”, “press” — and no number.' },
  'round.stamp': { kind: 'label', aim: 6, max: 8, note: 'The word on the rubber stamp slammed across the receipt of a round that made the week’s sheet — the payslip has PAID; this is the counter’s own. CAPITALS, one word, at most 8 letters.' },
  'round.far': { kind: 'prose', aim: 50, max: 70, note: 'The town’s toast when the round is asked for and the banana is not at the counter (the walk from the card stopped short): the counter is a step away and waits. It notices, it never instructs — no “walk”, “go”, “tap” — and no number.' },
  'round.receipt.title': { kind: 'prose', aim: 16, max: 24, note: 'The heading on the card the counter hands you at the end of a round: a NAME for that paper, two or three words, not a sentence.' },
  'round.receipt.take': { kind: 'prose', aim: 44, max: 64, holds: ['{n}', '{of}'], note: 'The one line with the round’s result. MUST contain {n} (how many cards went straight to the right hole) and {of} (the size of the pile) exactly once each, and no other number — something like: how many of the pile went where they were going.' },
  'round.receipt.xp': { kind: 'prose', aim: 22, max: 32, holds: ['{n}'], needs: [[/\{n\}/, 'must carry {n} — the game fills it']], note: '🪜 Under the result: the work XP this shift earned toward the next rank (23 Sep 2026, the job ladder). MUST contain {n} — the game prints the number. Plain, a label in a sentence: never praise, never “reward” or “bonus”. Shown only for a round that made the sheet.' },
  'round.receipt.counted': { kind: 'prose', aim: 50, max: 72, note: 'Under the result when enough of the pile went to the right hole: this round is on the week’s sheet, Stamp has it down. No numbers, never “reward”, never “bonus”.' },
  'round.receipt.short': { kind: 'prose', aim: 56, max: 80, note: 'Under the result when too little of the pile went to the right hole: this round is NOT on the week’s sheet, and the counter is there again in a moment. Never cruel, never a lecture, no numbers.' },
  'round.leave': { kind: 'label', aim: 10, max: 12, note: '⭐ THE WAY OUT OF A SHIFT (Trym, 22 Sep: "better to lock it and have a button for leave work"): while you work, your banana is held at the counter and this is the ONE button that ends the shift, on the tray’s strip. A VERB first, two words at most, at most 12 characters, never wraps: the plain thing it does — leave work, step away. Here it ends the sorting round; the receipt follows.' },
  'round.receipt.back': { kind: 'label', aim: 8, max: 14, note: 'The one button under the receipt that puts it away. A verb first, one or two words.' },
  refused: { kind: 'prose', aim: 78, max: 105, note: '⭐ THE HARDEST LINE IN THE JOB. What the writer sees when the filter stops their letter. It must be KIND, FINAL and COMPLETELY UNINFORMATIVE: it names no rule, no word and no reason, and it does not suggest what to change — a precise reason is a lesson in getting round the filter next time. It must also not sound like an accusation, because most people who ever see this typed something perfectly ordinary and were caught by a shop’s name or a phone number.' },
};
// 🤐 THE REFUSAL MAY NOT TEACH. A machine cannot judge kindness, but it can judge whether a line has
// started naming the rules — which is the exact failure this string has.
const POST_TELLS = /\b(link|url|website|web address|email|e-mail|phone|number|address|handle|username|discord|snapchat|instagram|contact|swear|word|rude|filter|blocked|banned|violat|policy|rule)\b/i;
function postShape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });   // an OBJECT: copy-rules reads p.path / p.msg; a pair printed as "undefined undefined"
  if (POST_TELLS.test(String(data.refused || ''))) say('refused', 'names what was wrong with the letter — a refusal that teaches is a lesson in getting round the filter next time');
  for (const f of ['empty', 'noaddress', 'shut', 'reported', 'sent', 'refused', 'front']) {
    if (/\?\s*$/.test(String(data[f] || ''))) say(f, 'ends in a question — nobody may ask the player one');
  }
  // 📬 the drawers and 🚪 the knock
  const dr = data.drawers || {}, kn = data.knock || {};
  for (const [p, v] of [['drawers.fresh', dr.fresh], ['drawers.kept', dr.kept]]) {
    if (!String(v || '').trim()) say(p, 'is empty');
    else if (String(v).trim().split(/\s+/).length > 1) say(p, 'is more than one word, and it is a label on a drawer');
  }
  if (/\b(archive|inbox|folder|old|read)\b/i.test(String(dr.kept || ''))) say('drawers.kept', 'names a mail program’s folder — it is a drawer of kept letters');
  if (!String(kn.line || '').includes('{who}')) say('knock.line', 'must contain {who}');
  for (const [p, v] of [['knock.in', kn.in], ['knock.away', kn.away]]) {
    if (!String(v || '').trim()) say(p, 'is empty');
    else if (String(v).trim().split(/\s+/).length > 2) say(p, 'is more than two words, and a button never wraps');
  }
  if (/\b(stranger|danger|unknown|blocked?|filter|rules?|spam)\b/i.test(String(kn.about || ''))) say('knock.about', 'frightens or names a rule — a knock is somebody at the door');
  if (/\b(block|blocked|report|ban|banned)\b/i.test(String(kn.away || ''))) say('knock.away', 'calls turning a house away a block or a report');
  if (/\b(block|blocked|report|ban|banned|told)\b/i.test(String(kn.gone || ''))) say('knock.gone', 'calls it a block, or says what the sender is told');
  for (const [p, v] of [['drawers.none', dr.none], ['knock.about', kn.about], ['knock.gone', kn.gone]]) {
    if (/\?\s*$/.test(String(v || ''))) say(p, 'ends in a question — nobody may ask the player one');
  }
  for (const [f, hold] of [['from', '{who}'], ['sheet', '{who}']]) {
    if (!String(data[f] || '').includes(hold)) say(f, 'must contain ' + hold);
  }
  // 📮 the postcard's own rules
  const card = data.card || {};
  if (!String(card.got || '').includes('{who}')) say('card.got', 'must contain {who}');
  const deck = Array.isArray(card.lines) ? card.lines.map((x) => String(x)) : [];
  if (deck.length !== 8) say('card.lines', 'the deck is exactly eight — letter-gate.js judges a card’s index against that number');
  if (new Set(deck.map((l) => l.trim().toLowerCase())).size < deck.length) say('card.lines', 'two lines of the deck are the same');
  for (const [i, l] of deck.entries()) {
    if (/\?\s*$/.test(l)) say('card.lines[' + i + ']', 'asks a question — a postcard has no reply box, so it can never be answered');
    // ⚠️ A LINE THAT NAMES ITS PICTURE IS A LINE THAT IS WRONG UNDER THE OTHER TWO. The sender picks
    // the place and the line separately, so "the flowers are out" read at the rave is a mistake.
    if (/(fountain|flowers?|garden|pond|beach|gate|fence|rave|dancing|beams?|music)/i.test(l)) {
      say('card.lines[' + i + ']', 'names one of the three pictures — every line has to work under all of them');
    }
  }
  // ✉️ the round's own rules: the numbers are the round's, the labels are one line, nobody instructs
  const ro = data.round || {}, rc = ro.receipt || {}, rh = ro.holes || {};
  for (const [p, v0] of [['round.start', ro.start], ['round.on', ro.on], ['round.far', ro.far], ['round.hint', ro.hint], ['round.receipt.title', rc.title], ['round.receipt.take', rc.take], ['round.receipt.counted', rc.counted], ['round.receipt.short', rc.short], ['round.receipt.back', rc.back], ['round.holes.park', rh.park], ['round.holes.beach', rh.beach], ['round.holes.home', rh.home], ['round.holes.rave', rh.rave]]) {
    const v = String(v0 || '');
    if (!v) { say(p, 'is empty'); continue; }
    if (/\d/.test(v.replace(/\{n\}|\{of\}/g, ''))) say(p, 'carries a number of its own — the game prints the round’s figures');
    if (/\?\s*$/.test(v)) say(p, 'ends in a question — nobody may ask the player one');
    if (/\b(tap|click|button|swipe|drag|match)\b/i.test(v)) say(p, 'names a control or instructs; the counter shows, it never tells');
    if (/\b(reward|bonus|prize)\b/i.test(v)) say(p, 'calls the week’s work a reward');
  }
  if ((String(rc.take || '').match(/\{n\}/g) || []).length !== 1) say('round.receipt.take', 'must contain {n} exactly once');
  if ((String(rc.take || '').match(/\{of\}/g) || []).length !== 1) say('round.receipt.take', 'must contain {of} exactly once');
  for (const k of ['park', 'beach', 'home', 'rave']) if (String(rh[k] || '').split(/\s+/).length > 2) say('round.holes.' + k, 'is more than two words, and it is a name on a pigeonhole');
  if (String(ro.start || '').split(/\s+/).length > 3) say('round.start', 'is more than three words, and a button never wraps');
  const stamp = String(ro.stamp || '');
  if (!stamp) say('round.stamp', 'is empty');
  if (stamp && stamp !== stamp.toUpperCase()) say('round.stamp', 'is not in capitals, and a rubber stamp is');
  if (/\s/.test(stamp)) say('round.stamp', 'is more than one word');
  if (/(press|hold)/i.test(String(ro.hint || ''))) say('round.hint', 'names a gesture; the notice says what the round wants, never which control');
  if (String(card.sent || '').trim().toLowerCase() === String(data.sent || '').trim().toLowerCase()) {
    say('card.sent', 'is the letter’s own line — a card and a letter are two different things happening');
  }
  plainPlace(bad, 'front', data.front, ['post office'], ['letter', 'write', 'read', 'mailbox']);
  // ⚠️ the mystery rule: this world never publishes its own timetables or its caps
  for (const [f, v] of Object.entries(data)) {
    if (typeof v === 'string' && /\b\d+\s*(letters?|a day|per day|days?|hours?|minutes?)\b/i.test(v)) say(f, 'publishes a cap or a timetable — this world does not');
  }
  return bad;
}
const postSchema = {
  type: 'object', additionalProperties: false,
  required: ['front', 'title', 'empty', 'noaddress', 'shut', 'from', 'back', 'report', 'reported', 'reply', 'sheet', 'send', 'sent', 'refused', 'nopass', 'card', 'folk', 'round', 'drawers', 'knock'],
  properties: {
    ...Object.fromEntries(Object.entries(postFields).filter(([k]) => !k.startsWith('card.') && !k.startsWith('folk.') && !k.startsWith('round.') && !k.startsWith('drawers.') && !k.startsWith('knock.')).map(([k, v]) => [k, str(v.note)])),
    // 📬 the two drawers (22 Sep 2026): the tab for new post, the tab for kept post, and new post with none
    drawers: {
      type: 'object', additionalProperties: false, required: ['fresh', 'kept', 'none'],
      properties: { fresh: str(postFields['drawers.fresh'].note), kept: str(postFields['drawers.kept'].note), none: str(postFields['drawers.none'].note) },
    },
    // 🚪 the knock (22 Sep 2026): who is at the door, what a knock is, the two buttons, and the toast after one
    knock: {
      type: 'object', additionalProperties: false, required: ['line', 'about', 'in', 'away', 'gone'],
      properties: {
        line: str(postFields['knock.line'].note), about: str(postFields['knock.about'].note),
        in: str(postFields['knock.in'].note), away: str(postFields['knock.away'].note), gone: str(postFields['knock.gone'].note),
      },
    },
    // ✉️ the sorting round (22 Sep 2026): the staff's button, two toasts, four pigeonhole names and the receipt
    round: {
      type: 'object', additionalProperties: false, required: ['start', 'on', 'far', 'hint', 'stamp', 'leave', 'holes', 'receipt'],
      properties: {
        leave: str(postFields['round.leave'].note), start: str(postFields['round.start'].note), on: str(postFields['round.on'].note), far: str(postFields['round.far'].note), hint: str(postFields['round.hint'].note), stamp: str(postFields['round.stamp'].note),
        holes: { type: 'object', additionalProperties: false, required: ['park', 'beach', 'home', 'rave'],
          properties: { park: str(postFields['round.holes.park'].note), beach: str(postFields['round.holes.beach'].note), home: str(postFields['round.holes.home'].note), rave: str(postFields['round.holes.rave'].note) } },
        receipt: { type: 'object', additionalProperties: false, required: ['title', 'take', 'counted', 'short', 'back'],
          properties: { xp: str(postFields['round.receipt.xp'].note), title: str(postFields['round.receipt.title'].note), take: str(postFields['round.receipt.take'].note), counted: str(postFields['round.receipt.counted'].note), short: str(postFields['round.receipt.short'].note), back: str(postFields['round.receipt.back'].note) } },
      },
    },
    // 📮 the postcard: a heading, the three place names, the deck of eight, and the two words
    // that carry a send. ⚠️ EXACTLY EIGHT LINES — src/lib/letter-gate.js CARD.lines is the number a
    // card's index is judged against, so a ninth would be a line nobody can ever pick and a seventh
    // would be a card that refuses itself.
    card: {
      type: 'object', additionalProperties: false, required: ['title', 'make', 'places', 'lines', 'send', 'sent', 'got'],
      properties: {
        title: str(postFields['card.title'].note),
        make: str(postFields['card.make'].note),
        places: { type: 'object', additionalProperties: false, required: ['park', 'home', 'rave'],
          properties: { park: str(postFields['card.places.park'].note), home: str(postFields['card.places.home'].note), rave: str(postFields['card.places.rave'].note) } },
        lines: { type: 'array', minItems: 8, maxItems: 8, items: str(postFields['card.lines[]'].note) },
        send: str(postFields['card.send'].note),
        sent: str(postFields['card.sent'].note),
        got: str(postFields['card.got'].note),
      },
    },
    // 📇 the address book — the way a FIRST letter is ever written (21 Sep 2026)
    folk: {
      type: 'object', additionalProperties: false, required: ['title', 'write', 'find', 'wait', 'empty', 'none'],
      description: 'The list of players a first letter can be addressed to, and the button that opens it.',
      properties: {
        title: str(postFields['folk.title'].note),
        write: str(postFields['folk.write'].note),
        find: str(postFields['folk.find'].note),
        wait: str(postFields['folk.wait'].note),
        empty: str(postFields['folk.empty'].note),
        none: str(postFields['folk.none'].note),
      },
    },
  },
};


// --- town-info ----------------------------------------------------------------
// ℹ️ THE INFORMATION KIOSK (20 Sep 2026) — a rack of maps and a flyer, which is the first thing in
// this world that TELLS A NEW PLAYER WHAT IS IN IT. Trym: "the info kiosk can open a nice interactive
// view of each area of banana world — world maps of all areas … also for the Rave — not needed with a
// map for that area — but more like a promotional image of the Rave, can maybe look like a Flyer."
//
// ❌ AND THERE ARE NO CAPTIONS ANY MORE. Each map carried a line under it saying what the place was.
// Trym, 20 Sep 2026: "in the map for the town in the kiosk there some white text over the map that
// doesnt quite fit, remove that." A map's title and its picture are the whole of it — and a field the
// game no longer reads is a line the rig keeps writing for nobody, so it leaves the job rather than
// sitting in the file unread.
//
// ⚠️ THE FOUR PLACE NAMES ARE NOT THE WRITER'S TO INVENT. Banana Town, the Park, Banana Bay and the
// homestead are named all over this world — on planks, in the nav, on the pass — and a map that titles
// them something else is a map of somewhere else. The shape check holds each one to its own word.
const AREA_KEYS = ['town', 'park', 'bay', 'homestead'];
const AREA_WORD = { town: /banana town/i, park: /\bpark\b/i, bay: /banana bay|\bbay\b/i, homestead: /homestead|smallholding|your land/i };
const infoFields = {
  title: { kind: 'prose', aim: 16, max: 24, note: 'The heading on the kiosk’s card: a NAME for the rack of maps, two or three words, not a sentence. What you would CALL the thing, not what it does.' },
  line: { kind: 'prose', aim: 62, max: 110, note: '⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is Dot’s map counter — pick up a map of any area of Banana World here. Then the old note: The one small line under the tiles, and the only prose on the first screen. It notices the kiosk or the PAPER — the rack, the fold marks, the pin holes, the counter. ⚠️ it may not instruct (no “tap”, no “zoom”, no “drag”) and may not list what the maps are, because the tiles are pictures of the places and already say.' },
  back: { kind: 'label', aim: 8, max: 14, note: 'The button from an open map back to the rack. A verb first, one or two words, ONE line — buttons in this world never wrap.' },
  shut: { kind: 'prose', aim: 64, max: 88, note: 'What stands in for the maps when the kiosk is closed, which happens only when the town is at its lowest. Ordinary and temporary — the shutter is down. Not an error, not an apology, and it may NOT blame the player for the state of the town.' },
  'areas.town.name': { kind: 'label', aim: 12, max: 20, note: 'The title printed under the town’s map. MUST be the place’s own name — Banana Town — titled, never renamed.' },
  'areas.park.name': { kind: 'label', aim: 10, max: 18, note: 'The title under the Park’s map. Its own name, titled.' },
  'areas.bay.name': { kind: 'label', aim: 10, max: 18, note: 'The title under Banana Bay’s map. Its own name, titled.' },
  'areas.homestead.name': { kind: 'label', aim: 12, max: 20, note: 'The title under the homestead’s map. Its own name, titled — and this one is the PLAYER’S OWN place, which the word may acknowledge.' },
  'rave.name': { kind: 'label', aim: 16, max: 26, note: 'The big name at the top of the flyer: the NIGHT’s name or the club’s, two or three words, the kind of thing printed in capitals above everything else on a poster.' },
  'rave.tonight': { kind: 'label', aim: 8, max: 14, note: 'The small word or two above the name, the way a flyer says when it is on. ⚠️ the poster is up EVERY DAY, so it has to be true every day: nothing dated, no day of the week, no hour.' },
  'rave.bill[]': { kind: 'label', aim: 16, max: 24, note: 'One act on the bill, printed on its own line. The first is the headliner. Banana names or act names, short enough for a phone — and they are BANANAS, never anybody real.' },
  'rave.lines[]': { kind: 'prose', aim: 48, max: 68, note: 'One short line of what is on down there. Between the two of them they carry the music and the floor, and the things a night gets you — gear you can wear, coins. ⚠️ no number, no price, no rate, no odds: a flyer boasts, it does not quote a rate card.' },
  'rave.door': { kind: 'label', aim: 34, max: 52, note: 'The one small line at the foot of the flyer, the way a poster prints the door: where it is and that everybody is welcome. Never a time, never a price, and never the word free as a promise of value.' },
};
function infoShape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });   // an OBJECT: copy-rules reads p.path / p.msg; a pair printed as "undefined undefined"
  const flat = (o, p) => Object.entries(o || {}).flatMap(([k, v]) => (Array.isArray(v)
    ? v.map((x, i) => [p + k + '.' + i, String(x)])
    : (v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, String(v)]])));
  const all = flat(data, '');
  for (const [path, v] of all) {
    if (/\?\s*$/.test(v)) say(path, 'ends in a question — nobody may ask the player one');
    // the mystery rule, and a flyer's version of it: no rates, no odds, no clock
    if (/\b\d+\s*(coins?|%|per|a day|days?|hours?|minutes?|pm|am)\b/i.test(v)) say(path, 'publishes a rate or a clock — this world does not, and a flyer boasts rather than quotes');
    // ⭐ A MAP RACK DOES NOT TALK TO ANYBODY: nobody works in the kiosk, so no line is in a voice
    if (/\b(welcome to|we\b|our\b|thanks|thank you)\b/i.test(v)) say(path, 'speaks in somebody’s voice — nobody works in the kiosk and this is printed matter');
  }
  if (/\b(tap|click|drag|pinch|zoom|swipe|press)\b/i.test(String(data.line || ''))) say('line', 'instructs — the tiles are pictures of the places and already say what they are');
  for (const k of AREA_KEYS) {
    const a = (data.areas || {})[k] || {};
    if (!AREA_WORD[k].test(String(a.name || ''))) say('areas.' + k + '.name', 'is not that place’s own name — the four are named all over this world, and a map may title them, never rename them');
  }
  const bill = (data.rave || {}).bill || [];
  if (new Set(bill.map((b) => String(b).trim().toLowerCase())).size < bill.length) say('rave.bill', 'two acts on the bill share a name');
  if (/\bfree\b/i.test(String((data.rave || {}).door || ''))) say('rave.door', 'says free — the door line says where it is and that everybody is welcome, not what it is worth');
  return bad;
}
const infoSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'line', 'back', 'shut', 'areas', 'rave'],
  properties: {
    title: str(infoFields.title.note),
    line: str(infoFields.line.note),
    back: str(infoFields.back.note),
    shut: str(infoFields.shut.note),
    areas: {
      type: 'object', additionalProperties: false, required: AREA_KEYS,
      properties: Object.fromEntries(AREA_KEYS.map((k) => [k, {
        type: 'object', additionalProperties: false, required: ['name'],
        properties: { name: str(infoFields['areas.' + k + '.name'].note) },
      }])),
    },
    rave: {
      type: 'object', additionalProperties: false, required: ['name', 'tonight', 'bill', 'lines', 'door'],
      properties: {
        name: str(infoFields['rave.name'].note),
        tonight: str(infoFields['rave.tonight'].note),
        bill: { type: 'array', minItems: 3, maxItems: 3, items: str(infoFields['rave.bill[]'].note) },
        lines: { type: 'array', minItems: 2, maxItems: 2, items: str(infoFields['rave.lines[]'].note) },
        door: str(infoFields['rave.door'].note),
      },
    },
  },
};

// --- town-quest ---------------------------------------------------------------
// 🕯 CHAPTER TWO OF THE QUESTLINE. The biggest writing job on the rig, and the first STORY to go
// through it — chapter one's dialogue is written into src/lib/world-quest.js because it predates the
// rule, and this is what the rule looks like applied: src/data/quest-c2.js holds the mechanics and
// not one word, this holds the words and not one mechanic.
//
// ⭐ THE STEP KEYS ARE NOT WRITTEN HERE. They are derived from SIGNATURES in src/data/town/locks.js,
// which is the same list the hoarding's signpost counts "the second of four" against. Three files
// therefore agree about the order by construction rather than by comment, and check-quest-c2.mjs
// proves the fourth (quest-c2.js) agrees too.
export const QUEST_KEYS = ['open',
  ...['store', 'condo', 'post', 'cafe'].flatMap((k) => [k + '_fault', k + '_sign']),
  'done'];
const QUEST_PAYS = ['store_sign', 'condo_sign', 'post_sign', 'cafe_sign', 'done'];
export const QUEST_WHO = ['nib', 'you', 'paper'];
const questFields = {
  'steps[].key': { kind: 'key', max: 14 },
  chapter: { kind: 'label', aim: 10, max: 14, note: 'The eyebrow over the title splash. Chapter one\u2019s reads exactly \u201cchapter i\u201d \u2014 lower case, a roman numeral, nothing else. This one is the second.' },
  title: { kind: 'label', aim: 18, max: 30, note: 'The chapter\u2019s NAME on the splash that plays once before its first line. Chapter one\u2019s is \u201cwhat the plot?\u201d: short, lower case, curious rather than epic, and a phrase or a question rather than a statement. Never a colon and never a subtitle.' },
  'steps[].find': { kind: 'prose', aim: 40, max: 58, note: 'The journal chip while this step is open \u2014 the little yellow note in the corner, which is also the compass that says WHERE TO GO. The one field in this job where an instruction belongs. Lower case, very short, names the place and never the mechanic.' },
  'steps[].hint': { kind: 'prose', emptyOk: true, aim: 40, max: 58, note: 'The same note once the talking is done, pointing at what comes NEXT. Same voice as find. \u26a0\ufe0f the last step\u2019s is EMPTY: there is nothing after the chapter.' },
  'steps[].note': { kind: 'prose', emptyOk: true, aim: 34, max: 52, note: 'The one line on the receipt card after a step pays. It names THE THING YOU WERE GIVEN and never the money \u2014 the stamped order, the certificate. Chapter one\u2019s register: \u201cPeel\u2019s old watering can\u201d, \u201cthe flipbook \u2014 a keepsake\u201d. No verb, no sentence, no thanks. \u26a0\ufe0f only the five paying steps have one; the rest are "".' },
  'steps[].lines[].who': { kind: 'enum', values: QUEST_WHO },
  'steps[].lines[].text': { kind: 'prose', aim: 130, max: 220, note: 'One speech bubble. \u26a0\ufe0f THREE VOICES AND THEY ARE DIFFERENT KINDS OF THING: nib is the town clerk, warm and delighted by paperwork and never a bureaucrat; paper is the 1999 works order nailed to the front, printed matter that addresses NOBODY; you is the player thinking out loud, one short sentence, never enthusiastic on the player\u2019s behalf. A line sits in a 261-pixel bubble, so 220 characters is the ceiling \u2014 and the lengths must VARY, because a one-word answer between two long ones is what makes it sound like people.' },
};
// 🤐 what a chapter may not do. Every one of these is a rule in the brief, and a rule that can be
// checked is checked rather than repeated (CLAUDE.md).
const Q_PAY = /\b(coin|coins|bananacoin|reward|payout|prize|bonus|jelly)\b/i;
const Q_UI = /\b(tap|click|button|swipe|press the|menu|screen|card opens)\b/i;
const Q_RUSH = /\b(hurry|quickly|urgent|urgently|immediately|too late|running out|deadline|before it)\b/i;
const Q_NEXT = /\bchapter\s*(three|3|iii)\b/i;
const Q_DESK = /\b(registry|archive|deed|pursuant|hereby|aforementioned|statutory|ordinance)\b/i;
function questShape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });   // an OBJECT: copy-rules reads p.path / p.msg; a pair printed as "undefined undefined"
  const rows = Array.isArray(data.steps) ? data.steps : [];
  const got = rows.map((r) => String((r && r.key) || ''));
  // ⚠️ IN ORDER, not merely all present: the chapter is four round trips and the hoarding's
  // signpost counts "the second of four" against this same order.
  if (got.join(',') !== QUEST_KEYS.join(',')) {
    say('steps', 'must be the ten steps in order (' + QUEST_KEYS.join(', ') + ') — it is ' + (got.join(', ') || 'empty'));
  }
  const steps = Object.fromEntries(rows.filter((r) => r && r.key).map((r) => [r.key, r]));
  if (!/^chapter [ivx]+$/.test(String(data.chapter || ''))) say('chapter', 'must read like chapter one\u2019s: lower case, the words "chapter" and a roman numeral, nothing else');
  if (/[:.]/.test(String(data.title || ''))) say('title', 'carries a colon or a full stop \u2014 a chapter name is a phrase, not a sentence and not a subtitle');
  if (String(data.title || '') !== String(data.title || '').toLowerCase()) say('title', 'is not lower case, and the splash is set in the display face without a capital in sight');
  for (const k of QUEST_KEYS) {
    const st = steps[k];
    if (!st) continue;
    const at = (f) => 'steps.' + k + '.' + f;
    const lines = Array.isArray(st.lines) ? st.lines : [];
    if (lines.length < 3) say(at('lines'), 'has fewer than three bubbles \u2014 too short to be a scene');
    if (k === 'open' && lines.length < 5) say(at('lines'), 'is the step that has to make a stranger want the other nine, and it is shorter than five bubbles');
    for (const [i, l] of lines.entries()) {
      const who = String((l && l.who) || ''), t = String((l && l.text) || '');
      const where = at('lines[' + i + ']');
      if (!QUEST_WHO.includes(who)) say(where, 'is spoken by "' + who + '", and this chapter has three voices: ' + QUEST_WHO.join(', '));
      if (Q_PAY.test(t)) say(where, 'names what the player gets \u2014 the world never publishes its own numbers');
      if (Q_UI.test(t)) say(where, 'reads like a tutorial: no line in this world tells anybody which control to use');
      if (Q_RUSH.test(t)) say(where, 'puts the player in a hurry, and nothing in Banana Town is urgent');
      if (Q_NEXT.test(t)) say(where, 'trails the next chapter, which is the one thing the mystery rule forbids');
      // ⚠️ THE ORDER IS PRINTED MATTER. A works order that says "you" is a person talking, and the
      // whole joke of the four faults is that nobody has read them for twenty-seven years.
      if (who === 'paper' && /\b(you|your|you\u2019re|you\u2019ll)\b/i.test(t)) say(where, 'is the works order addressing the player \u2014 printed matter speaks to nobody');
      if (who === 'nib' && Q_DESK.test(t)) say(where, 'gives Nib a bureaucrat\u2019s vocabulary; he says "the big book", "the top drawer", "the yellow form"');
      if (who === 'you' && (t.match(/[.!?]/g) || []).length > 1) say(where, 'gives the player more than one sentence \u2014 they think out loud, briefly');
    }
    // ⭐ THE PLAYER NOTICES THE FAULT. A fault step that is all paperwork has nobody in it.
    if (/_fault$/.test(k) && !lines.some((l) => l && l.who === 'you')) say(at('lines'), 'has no line from the player, and finding the fault is THEIR moment');
    if (/_fault$/.test(k) && !lines.some((l) => l && l.who === 'paper')) say(at('lines'), 'never shows the works order, which is the thing being read');
    for (const f of ['find', 'hint']) {
      const v = String(st[f] || '');
      if (v && /^[A-Z]/.test(v)) say(at(f), 'starts with a capital, and every chip in this world is lower case');
      if (Q_UI.test(v)) say(at(f), 'names a control; a chip says where to go, never how');
    }
    if (k === 'done' && String(st.hint || '')) say(at('hint'), 'must be empty \u2014 there is nothing after the chapter');
    if (k !== 'done' && !String(st.find || '')) say(at('find'), 'is empty, and without it the chip cannot say where to go');
    const note = String(st.note || '');
    if (QUEST_PAYS.includes(k) && !note) say(at('note'), 'is the receipt for a step that pays, and it is empty');
    if (!QUEST_PAYS.includes(k) && note) say(at('note'), 'has a receipt line and this step pays nothing');
    if (note && Q_PAY.test(note)) say(at('note'), 'names the money; a receipt names the THING');
  }
  return bad;
}
const lineItems = {
  type: 'object', additionalProperties: false, required: ['who', 'text'],
  properties: {
    who: { type: 'string', enum: QUEST_WHO, description: 'nib (the clerk), paper (the 1999 works order \u2014 addresses nobody) or you (the player, one short sentence).' },
    text: { type: 'string', description: questFields['steps[].lines[].text'].note },
  },
};
const stepItem = {
  type: 'object', additionalProperties: false, required: ['key', 'find', 'hint', 'note', 'lines'],
  properties: {
    key: { type: 'string', enum: QUEST_KEYS, description: 'The step\u2019s key, copied from the brief in the brief\u2019s order. Never shown to a player.' },
    find: { type: 'string', description: questFields['steps[].find'].note },
    hint: { type: 'string', description: questFields['steps[].hint'].note },
    note: { type: 'string', description: questFields['steps[].note'].note },
    lines: { type: 'array', description: 'The scene, in order.', items: lineItems },
  },
};
const questSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['chapter', 'title', 'steps'],
  properties: {
    chapter: { type: 'string', description: questFields.chapter.note },
    title: { type: 'string', description: questFields.title.note },
    steps: {
      type: 'array', minItems: 10, maxItems: 10,
      description: 'All ten steps, IN THIS ORDER: open, then each of the four buildings as a _fault and then a _sign, then done.',
      items: stepItem,
    },
  },
};

// --- town-notes -------------------------------------------------------------
// ✉️ THE LETTERS THE RESIDENTS WRITE TO YOU — the plan's "load-bearing beam, not a flourish"
// (docs/town-jobs-plan.md §6). At ten players most mailboxes are empty most of the time, and an
// empty mailbox is where a social feature quietly dies.
//
// ⚠️ THIS COPY IS READ BY A WORKER, not by a page. worker-rave imports the approved JSON directly
// (it already imports src/lib/letter-gate.js), because a letter the server writes has to be written
// by the server — the alternative is letting a page claim to be Nib, which is exactly the forgery
// the rail was just closed against.
export const NOTE_FOLK = [['nib', 'Nib'], ['stamp', 'Stamp'], ['moss', 'Moss'], ['bean', 'Bean']];
export const NOTE_KINDS = ['welcome', 'quiet', 'first', 'cabin', 'house', 'fixed', 'curse'];
// ⭐ each fact-keyed letter has to NAME its fact, or it is a hello with a reason nobody can see
const NOTE_NAMES_FACT = { first: /\b(letters?|cards?|postcards?|post)\b/i, cabin: /\bcabin\b/i, house: /\bhouse\b/i, fixed: /\bsquare\b/i, curse: /\bnight\b/i };
const noteFields = {
  'welcome[].key': { kind: 'key', max: 8 },
  'welcome[].text': { kind: 'prose', aim: 150, max: 260, note: '⭐ THE FIRST THING ANYBODY EVER READS IN THEIR MAILBOX — there has never been a letter in it. A neighbour noticed the new sign on the fence and wrote. ⚠️ IT MAY NOT BE A TUTORIAL: it does not explain the mailbox, does not ask them to write back, and names no part of the game. Two or three short sentences in this resident’s own voice, on paper, in handwriting.' },
  'quiet[].key': { kind: 'key', max: 8 },
  // ⭐ THE FACT-KEYED LETTERS (22 Sep 2026, docs/town-jobs-plan.md §6: "a card that names what you DID is worth
  // ten that say hello — and it needs no typing, because the fact comes from the server"). Each names ONE
  // thing the world saw, and nothing else about the reader.
  'first[].key': { kind: 'key', max: 8 },
  'first[].text': { kind: 'prose', aim: 150, max: 260, note: '✉️ THE READER’S FIRST LETTER OR POSTCARD HAS GONE OUT to a neighbour: post has left their house for the first time, and the resident noticed. MUST mention the letter, the card or the post. ⚠️ It may not say who it went to, may not quote or guess what it said, and may not ask whether they will write again. Warm and small — a house that sends post is a house that has joined the street.' },
  'cabin[].key': { kind: 'key', max: 8 },
  'cabin[].text': { kind: 'prose', aim: 150, max: 260, note: '🏡 THE READER’S HOMESTEAD HAS GROWN FROM A TENT INTO A CABIN, and the resident heard or walked past and saw it. MUST name the cabin. ⚠️ No numbers, no prices, nothing about what it cost or how it was built, and no advice about what to do next.' },
  'house[].key': { kind: 'key', max: 8 },
  'house[].text': { kind: 'prose', aim: 150, max: 260, note: '🏠 THE READER’S HOMESTEAD HAS GROWN FROM A CABIN INTO A HOUSE — a proper house on the road now, the last step. MUST name the house. ⚠️ No numbers, no prices, no advice, and it may not say the reader is done or finished.' },
  'fixed[].key': { kind: 'key', max: 8 },
  'fixed[].text': { kind: 'prose', aim: 150, max: 260, note: '🔧 THE READER PUT THE SQUARE RIGHT: in one day they mended several things in Banana Town’s square (a lamp relit, litter cleared, a wall scrubbed, a bin set upright). The resident noticed the square looking better and knows it was them. MUST name the square. ⚠️ It may not say how many, may not call it a job or a task, and may not ask for more.' },
  'curse[].key': { kind: 'key', max: 8 },
  'curse[].text': { kind: 'prose', aim: 150, max: 260, note: '🌑 THE MORNING AFTER A CURSE NIGHT in Banana Town: the lamps went out, the ghosts were about, and the square took a knock. The resident writes about what the night left behind. MUST mention the night. ⚠️ It may not claim the reader was there or saw it, may not frighten, may not explain the curse, may not name a time, a date or how often it comes, and may not ask the reader to help.' },
  'quiet[].text': { kind: 'prose', aim: 150, max: 260, note: 'A letter for no reason at all, when nothing has arrived for days — which is the reason: people who like you write when nothing is happening. ⚠️ it must NEVER mention that the box was empty, never suggest anybody was forgotten or lonely, and never ask why they have not written. Something small the writer noticed: the light over the square, the queue at their counter, what the night left behind.' },
};
// 🤐 what a letter from a neighbour may not sound like
const NOTE_APP = /(welcome to|click|tap|button|menu|inbox|notification|account|feature|unlock|reward|coins?)/i;
const NOTE_OWED = /(write back|reply|respond|let me know|get in touch|drop me a line|waiting to hear|hope to hear)/i;
const NOTE_PITY = /(lonely|alone|forgotten|nobody has|empty|quiet in there|no one writes)/i;
function noteShape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });   // an OBJECT: copy-rules reads p.path / p.msg; a pair printed as "undefined undefined"
  for (const kind of NOTE_KINDS) {
    const rows = Array.isArray(data[kind]) ? data[kind] : [];
    const keys = rows.map((r) => String((r && r.key) || ''));
    if (keys.join(',') !== NOTE_FOLK.map((f) => f[0]).join(',')) {
      say(kind, 'must be the four residents in order (' + NOTE_FOLK.map((f) => f[0]).join(', ') + ') — it is ' + (keys.join(', ') || 'empty'));
    }
    for (const r of rows) {
      const t = String((r && r.text) || ''), at = kind + '.' + (r && r.key);
      if (NOTE_APP.test(t)) say(at, 'sounds like an app rather than a person — no part of the game is ever named in a letter');
      if (NOTE_OWED.test(t)) say(at, 'asks for a reply, and nothing in this world is ever owed');
      if (kind === 'quiet' && NOTE_PITY.test(t)) say(at, 'notices that the box was empty — the whole point is that the letter has no reason');
      if (NOTE_NAMES_FACT[kind] && !NOTE_NAMES_FACT[kind].test(t)) say(at, 'does not name what happened, so it reads as a hello with a reason nobody can see');
      if (kind === 'curse' && /\b(you (were|saw|heard)|your help|help us|scared|terrif|horror|blood|dead)\b/i.test(t)) say(at, 'claims the reader was there, frightens, or asks for help — the morning after is only what the night left behind');
      if (kind === 'house' && /\b(done|finished|complete|the end)\b/i.test(t)) say(at, 'tells the reader they are finished');
      if (/\d/.test(t)) say(at, 'carries a number, and the world never publishes its own');
    }
    // ⭐ four people, not one voice with four signatures
    const texts = rows.map((r) => String((r && r.text) || '').toLowerCase());
    for (let i = 0; i < texts.length; i++) {
      for (let k = i + 1; k < texts.length; k++) {
        const a = new Set(texts[i].split(/\W+/).filter((w) => w.length > 4));
        const b = texts[k].split(/\W+/).filter((w) => w.length > 4);
        const shared = b.filter((w) => a.has(w)).length;
        if (shared >= 4) say(kind, keys[i] + ' and ' + keys[k] + ' share too much of their wording — four residents, four voices');
      }
    }
  }
  return bad;
}
const noteRow = {
  type: 'object', additionalProperties: false, required: ['key', 'text'],
  properties: {
    key: { type: 'string', enum: NOTE_FOLK.map((f) => f[0]), description: 'The resident’s key, copied from the brief in the brief’s order.' },
    text: { type: 'string' },
  },
};
const noteSchema = {
  type: 'object', additionalProperties: false, required: NOTE_KINDS,
  properties: {
    welcome: { type: 'array', minItems: 4, maxItems: 4, description: 'One per resident, in order: ' + NOTE_FOLK.map((f) => f[0]).join(', ') + '. ' + noteFields['welcome[].text'].note, items: noteRow },
    quiet: { type: 'array', minItems: 4, maxItems: 4, description: 'The same four, in the same order. ' + noteFields['quiet[].text'].note, items: noteRow },
    first: { type: 'array', minItems: 4, maxItems: 4, description: 'The same four, in the same order. ' + noteFields['first[].text'].note, items: noteRow },
    cabin: { type: 'array', minItems: 4, maxItems: 4, description: 'The same four, in the same order. ' + noteFields['cabin[].text'].note, items: noteRow },
    house: { type: 'array', minItems: 4, maxItems: 4, description: 'The same four, in the same order. ' + noteFields['house[].text'].note, items: noteRow },
    fixed: { type: 'array', minItems: 4, maxItems: 4, description: 'The same four, in the same order. ' + noteFields['fixed[].text'].note, items: noteRow },
    curse: { type: 'array', minItems: 4, maxItems: 4, description: 'The same four, in the same order. ' + noteFields['curse[].text'].note, items: noteRow },
  },
};

// --- quest-c1 -----------------------------------------------------------------
// 🕯 CHAPTER ONE'S FIRST SCENE, MOVED TO THE TOWN (21 Sep 2026). The rest of chapter one keeps its
// inline words (grandfathered); this scene is the one that CHANGED, and a change goes through the
// rig. Nib now waits by the fountain, the plot is a place you travel to, and you cannot name it until
// you have asked Old Peel. The ending is not in this job — it still happens at the plot, unchanged.
export const C1_WHO = ['nib', 'you', 'paper'];
const C1_LETTER = '“the eleventh plot, to whoever comes asking. it has waited long enough.”';
const c1Fields = {
  'open.find': { kind: 'prose', aim: 40, max: 58, note: 'The journal chip while the first scene is waiting: WHERE TO GO. Lower case, very short, names the fountain in the town. ⚠️ it is read in the park, the bay and the homestead as the compass too, so it must make sense to somebody who is not in the town yet.' },
  'open.findRes': { kind: 'prose', aim: 40, max: 58, note: 'The same chip for a player who already lives on Plot 11. Lower case, very short.' },
  'open.hint': { kind: 'prose', aim: 40, max: 58, note: 'The chip once the scene is done: where next — Old Peel, in the park. Lower case, very short, names the place never the mechanic.' },
  'open.lines[].who': { kind: 'enum', values: C1_WHO },
  'open.lines[].text': { kind: 'prose', aim: 120, max: 220, note: 'One speech bubble of the STRANGER’s scene, in order. nib is the town clerk, warm and delighted by paperwork; you is the player, one short sentence; paper is the old letter and says exactly the line in the brief. The plot is a DESTINATION: never “here”, “this plot”, “where you’re standing”. Ends by sending the player to Old Peel in the park, and Nib says he will be at the town hall.' },
  'open.linesRes[].who': { kind: 'enum', values: C1_WHO },
  'open.linesRes[].text': { kind: 'prose', aim: 120, max: 220, note: 'The same scene for somebody who ALREADY lives on Plot 11: Nib came to write them in properly and found the page empty. Same letter, same send-off, shorter.' },
};
// 🤐 what the scene may not do — every one a rule in the brief, checked rather than repeated
// not a bare "here": "and here you are" is about the person, not the ground (the first draft tripped on it)
const C1_HERE = new RegExp('\\b(this plot|this land|where you.re standing|standing here|right here|this spot|this very spot|under your feet)\\b', 'i');
const C1_END = new RegExp('\\b(scratch|laminat|already something on|somebody wrote a name|write you in(to)? the book)\\b', 'i');
const C1_PAY = new RegExp('\\b(coin|coins|bananacoin|reward|payout|prize)\\b', 'i');
const C1_UI = new RegExp('\\b(tap|click|button|menu|screen)\\b', 'i');
const C1_DESK = new RegExp('\\b(registry|archive|deed|pursuant|hereby|statutory)\\b', 'i');
function c1Shape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });   // an OBJECT: copy-rules reads p.path / p.msg; a pair printed as "undefined undefined"
  const o = data.open || {};
  for (const [k, cap] of [['lines', 10], ['linesRes', 8]]) {
    const ls = Array.isArray(o[k]) ? o[k] : [];
    if (ls.length < 5) say('open.' + k, 'is shorter than five bubbles — too short to open a chapter');
    if (ls.length > cap) say('open.' + k, 'runs past ' + cap + ' bubbles');
    const papers = ls.filter((l) => l && l.who === 'paper');
    if (papers.length !== 1) say('open.' + k, 'must read the letter exactly once (paper); it reads it ' + papers.length + ' times');
    for (const p of papers) if (String(p.text || '').trim() !== C1_LETTER) say('open.' + k, 'rephrases the letter — it has been the same line since August, on the player’s own paper in three places');
    if (!ls.some((l) => l && l.who === 'nib' && /old peel/i.test(l.text || ''))) say('open.' + k, 'never sends the player to Old Peel, which is the whole reason the plot cannot be named yet');
    if (!ls.some((l) => l && /\bpark\b/i.test(l.text || ''))) say('open.' + k, 'never says WHERE Old Peel is — the park');
    if (!ls.some((l) => l && /plot 11|eleventh plot/i.test(l.text || ''))) say('open.' + k, 'never names Plot 11');
    if (!ls.some((l) => l && l.who === 'nib' && /town hall/i.test(l.text || ''))) say('open.' + k, 'Nib never says he will be at the town hall, and he is about to walk there');
    for (const [i, l] of ls.entries()) {
      const t = String((l && l.text) || ''), at = 'open.' + k + '[' + i + ']';
      if (!C1_WHO.includes(String(l && l.who))) say(at, 'is spoken by "' + (l && l.who) + '"; this scene has three voices');
      if ((l && l.who) !== 'paper' && C1_HERE.test(t)) say(at, 'treats the plot as the ground underfoot — the player is in the square, the plot is a place to travel to');
      if (C1_END.test(t)) say(at, 'describes the ENDING, which is not this job');
      if (C1_PAY.test(t)) say(at, 'names what the player gets');
      if (C1_UI.test(t)) say(at, 'reads like a tutorial');
      if ((l && l.who) === 'nib' && C1_DESK.test(t)) say(at, 'gives Nib a bureaucrat’s vocabulary; he says "the big book", "the top drawer", "the yellow form"');
      if ((l && l.who) === 'you' && (t.match(/[.!?]/g) || []).length > 1) say(at, 'gives the player more than one sentence');
    }
  }
  for (const f of ['find', 'findRes', 'hint']) {
    const v = String(o[f] || '');
    if (!v) say('open.' + f, 'is empty');
    if (/^[A-Z]/.test(v)) say('open.' + f, 'starts with a capital, and every chip in this world is lower case');
    if (C1_UI.test(v)) say('open.' + f, 'names a control; a chip says where to go, never how');
  }
  if (!/fountain/i.test(String(o.find || ''))) say('open.find', 'does not say the fountain — it is the compass for a player who is not in the town yet');
  if (!/peel|park/i.test(String(o.hint || ''))) say('open.hint', 'does not point at Old Peel or the park');
  return bad;
}
const c1Line = { type: 'object', additionalProperties: false, required: ['who', 'text'],
  properties: { who: { type: 'string', enum: C1_WHO, description: 'nib (the clerk), paper (the old letter — addresses nobody) or you (the player, one short sentence).' }, text: { type: 'string' } } };
const c1Schema = {
  type: 'object', additionalProperties: false, required: ['open'],
  properties: { open: { type: 'object', additionalProperties: false, required: ['find', 'findRes', 'hint', 'lines', 'linesRes'],
    properties: {
      find: str(c1Fields['open.find'].note), findRes: str(c1Fields['open.findRes'].note), hint: str(c1Fields['open.hint'].note),
      lines: { type: 'array', minItems: 5, maxItems: 10, description: c1Fields['open.lines[].text'].note, items: c1Line },
      linesRes: { type: 'array', minItems: 5, maxItems: 8, description: c1Fields['open.linesRes[].text'].note, items: c1Line },
    } } },
};

// --- town-page -----------------------------------------------------------------
// 🏘 THE TOWN PAGE ITSELF (21 Sep 2026): the four lines nobody in the world speaks — the tab title,
// the search line, the line under the sign and the how-to under the square. Written the day the
// town stopped being a hidden prototype and became the front door of Banana World.
const pageFields = {
  title: { kind: 'label', aim: 48, max: 60, note: 'The browser tab and the search headline. MUST start with the two words "Banana Town" (the desk counts world pages by that prefix), then a dash and a few plain words: a free pixel-art town you walk around in, where Banana World begins.' },
  description: { kind: 'prose', aim: 130, max: 155, note: 'The search result’s grey line: one or two plain sentences — what you do there, that the story starts here, free and in the browser. No exclamation marks, no "welcome to".' },
  tag: { kind: 'label', aim: 44, max: 70, note: 'The small line right under the big BANANA TOWN sign. Lower case, a phrase not a sentence, in the world’s own voice: this is where Banana World begins. It may name the fountain or Nib.' },
  note: { kind: 'prose', aim: 140, max: 180, note: 'The one line under the square that tells a newcomer how to play: walk by tapping or with the arrow keys; tap a door, a sign or a resident; the roads lead out to the rest of Banana World. The one place on the page where an instruction belongs.' },
};
const PAGE_PROTO = new RegExp('\\b(prototype|construction|coming soon|under development|beta|placeholder|work in progress)\\b', 'i');
const PAGE_FLUFF = new RegExp('\\b(immersive|experience|vibrant|cozy|cosy|charming|explore|discover|unlock|adventure awaits|welcome to)\\b', 'i');
function pageShape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });
  const t = String(data.title || '');
  if (!/^Banana Town\b/.test(t)) say('title', 'must start with "Banana Town" — the desk matches world pages by that prefix (pulse-dicts WORLD_TITLES)');
  for (const f of ['title', 'description', 'tag', 'note']) {
    const v = String(data[f] || '');
    if (!v) say(f, 'is empty');
    if (PAGE_PROTO.test(v)) say(f, 'still talks about a prototype — the town is simply open');
    if (PAGE_FLUFF.test(v)) say(f, 'reaches for a brochure word');
    if (/\d/.test(v)) say(f, 'publishes a number, and the world never does');
    if (f !== 'note' && /!/.test(v)) say(f, 'has an exclamation mark');
  }
  if (/^[A-Z]/.test(String(data.tag || ''))) say('tag', 'starts with a capital, and the line under the sign is lower case');
  if (!/Banana World/.test(String(data.description || '') + ' ' + String(data.tag || ''))) say('description', 'neither it nor the tag says "Banana World", and the page is its front door');
  return bad;
}
const pageSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'description', 'tag', 'note'],
  properties: { title: str(pageFields.title.note), description: str(pageFields.description.note), tag: str(pageFields.tag.note), note: str(pageFields.note.note) },
};

// --- town-duties -----------------------------------------------------------------
// 💼 THE WORK NOTE (22 Sep 2026; docs/town-jobs-plan.md §12): the quest chip's sibling in the town's
// paper — the week's counts (composed by the game from the duty labels and the numbers) and one line
// under them. The numbers are the pass worker's and go into {coins} and {days}; the words never carry one.
export const DUTY_KINDS = ['sweep', 'fix', 'restock', 'days', 'sort', 'serve'];
export const DUTY_BOSS = ['condo', 'store', 'post', 'cafe', 'stand'];   // ↕ the counters can be nudged and let go too (23 Sep 2026, the weekly review)
const dutyFields = {
  'kinds.sweep': { kind: 'label', aim: 11, max: 18, note: 'The arcade floor, swept — the duty AS DONE, two or three lower-case words, no number: e.g. what goes before "1/3" in "floor swept 1/3".' },
  'kinds.fix': { kind: 'label', aim: 14, max: 18, note: 'A dark arcade cabinet brought back — the duty as done, two or three lower-case words, no number.' },
  'kinds.restock': { kind: 'label', aim: 15, max: 18, note: 'The General Store\u2019s shelf restocked from a crate — the duty as done, two or three lower-case words, no number.' },
  'kinds.days': { kind: 'label', aim: 9, max: 18, note: 'Days you turned up at the workplace — as done, one or two lower-case words, no number.' },
  'kinds.serve': { kind: 'label', aim: 16, max: 18, note: 'Customers served at the store’s till (23 Sep 2026) — the duty as done, two or three lower-case words, no number.' },
  'kinds.sort': { kind: 'label', aim: 11, max: 18, note: 'The post office\u2019s post sorted (a duty that comes later) — as done, two lower-case words, no number.' },
  'duty.cafe': { kind: 'prose', aim: 44, max: 70, note: 'The Coffee Cup\u2019s note until you have clocked in today: clock in at the serving window and make cups. Lower case first letter.' },
  'duty.stand': { kind: 'prose', aim: 44, max: 70, note: 'The lemonade stand\u2019s note until you have clocked in today: step behind Fig Jr.\u2019s stand and pour glasses of lemonade for whoever comes to the front. Lower case first letter, no numbers, not the café\u2019s words.' },
  wage: { kind: 'prose', aim: 60, max: 80, holds: ['{coins}', '{days}'], note: 'Under the counts at a cheque job: how much the week has earned so far and how far away payday is. MUST contain {coins} and {days} exactly once each \u2014 the game prints the numbers. Payday is Monday. Lower case first letter.' },
  done: { kind: 'prose', aim: 46, max: 70, note: 'Under the counts when every target of the week is met: the week\u2019s work is done and the rest of it is yours. No numbers. Lower case first letter.' },
  'nudge.condo': { kind: 'prose', aim: 72, max: 80, note: 'Under the counts when Thursday has come and nothing at all has been done this week: Spinner asks you in, and the line says the stake — two empty weeks in a row and the job is gone (24 Sep 2026, the copy review: the sack must never arrive unannounced). Starts with Spinner’s name; the number as a word.' },
  'nudge.store': { kind: 'prose', aim: 72, max: 80, note: 'Under the counts when Thursday has come and nothing at all has been done this week: Pip asks you in, and the line says the stake — two empty weeks in a row and the job is gone (24 Sep 2026, the copy review: the sack must never arrive unannounced). Starts with Pip’s name; the number as a word.' },
  'fired.condo': { kind: 'prose', aim: 60, max: 80, note: 'Spinner let you go after two finished weeks with nothing done at the Arcade; his door is open if you ask again. Never cruel, never a lecture, no numbers. Lower case first letter.' },
  'fired.store': { kind: 'prose', aim: 60, max: 80, note: 'The same, for the General Store: Pip let you go; ask again when you like. No numbers. Lower case first letter.' },
  'nudge.post': { kind: 'prose', aim: 72, max: 80, note: 'Under the counts when Thursday has come and nothing at all has been done this week: Stamp asks you in, and the line says the stake — two empty weeks in a row and the job is gone (24 Sep 2026, the copy review: the sack must never arrive unannounced). Starts with Stamp’s name; the number as a word.' },
  'nudge.cafe': { kind: 'prose', aim: 72, max: 80, note: 'Under the counts when Thursday has come and nothing at all has been done this week: Bean asks you in, and the line says the stake — two empty weeks in a row and the job is gone (24 Sep 2026, the copy review: the sack must never arrive unannounced). Starts with Bean’s name; the number as a word.' },
  'nudge.stand': { kind: 'prose', aim: 72, max: 80, note: 'Under the counts when Thursday has come and nothing at all has been done this week: Fig Jr. asks you in, and the line says the stake — two empty weeks in a row and the job is gone (24 Sep 2026, the copy review: the sack must never arrive unannounced). Starts with Fig Jr.’s name; the number as a word.' },
  'fired.cafe': { kind: 'prose', aim: 60, max: 80, note: 'Bean let you go after empty weeks; ask again and you start over from the first rank (Trym: fired means you “have to start over”). No numbers.' },
  'fired.stand': { kind: 'prose', aim: 60, max: 80, note: 'Fig Jr. let you go; reapply and you start over at the bottom. No numbers.' },
  'fired.post': { kind: 'prose', aim: 60, max: 80, note: 'The same, for the Post Office: Stamp let you go; ask again when you like. No numbers. Lower case first letter.' },
  cafeDone: { kind: 'prose', aim: 50, max: 70, note: 'The Coffee Cup once you have clocked in today: tips are counted on the tray as you pour and paid when you step away. No numbers. Lower case first letter.' },
  standDone: { kind: 'prose', aim: 50, max: 70, note: 'The lemonade stand once you have clocked in today: the tips gather on the tray glass by glass and are paid when you step away. No numbers. Lower case first letter, not the café\u2019s words.' },
  payslip: { kind: 'prose', aim: 50, max: 70, note: 'A cheque has been paid and the payslip waits in the letterbox at your homestead: it sends you home to open it. No numbers \u2014 the payslip has them. Lower case first letter.' },
  tips: { kind: 'label', aim: 10, max: 18, note: 'Today\u2019s tips at the caf\u00e9 or the stand, before the count the game prints (what goes before \u201c24/120\u201d). Two lower-case words, no number. (23 Sep 2026: the caf\u00e9 and stand notes had no numbers at all.)' },
  // \ud83d\udcdf the pager (23 Sep 2026, the staff card plan\u2019s slice 0b): at the arcade and the store the town CALLS its staff,
  // and the note is where the call lands, gold, until it is answered. The boss is named, and the window is said: open
  // until midnight. Never a guilt line, never a countdown.
  'call.sweep': { kind: 'prose', aim: 55, max: 80, note: 'The note when the arcade\u2019s litter call has come in: Spinner calls, litter on the arcade floor, open until midnight. Starts with Spinner\u2019s name.' },
  'call.fix': { kind: 'prose', aim: 55, max: 80, note: 'The note when the arcade\u2019s dark-cabinet call has come in: Spinner calls, a cabinet has gone dark, open until midnight. Starts with Spinner\u2019s name.' },
  'call.restock': { kind: 'prose', aim: 55, max: 80, note: 'The note when the store\u2019s delivery call has come in: Pip calls, a delivery waits to be shelved, open until midnight. Starts with Pip\u2019s name.' },
  'call.serve': { kind: 'prose', aim: 55, max: 80, note: 'The note when the store\u2019s customer call has come in (23 Sep 2026): Pip calls, customers are waiting at the till, open until midnight. Starts with Pip\u2019s name.' },
  'call.deliver': { kind: 'prose', aim: 70, max: 82, note: '📦 The note when the store\u2019s parcel call has come in (rank 3): Pip calls, a parcel waits at the store to be delivered, open until midnight. Starts with Pip\u2019s name.' },
  answered: { kind: 'prose', aim: 50, max: 70, note: 'The note once every one of today\u2019s calls is answered: nothing more is wanted until tomorrow. No numbers, no praise-as-reward. Lower case first letter.' },
  tipsAll: { kind: 'prose', aim: 50, max: 70, note: '🗣 The note at the café or the stand once today\u2019s tips are all earned (24 Sep 2026, the copy review): shifts still earn work XP, so a counter past its limit is still worth working. No numbers. Lower case first letter.' },
};
const DUTY_UI = new RegExp('\\b(tap|click|button|menu|screen|swipe)\\b', 'i');
const DUTY_PAY = new RegExp('\\b(reward|bonus|prize|jackpot)\\b', 'i');
function dutyShape(data) {
  const bad = [];
  const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });
  const k = data.kinds || {}, d = data.duty || {}, nu = data.nudge || {}, fi = data.fired || {};
  const all = [...DUTY_KINDS.map((x) => ['kinds.' + x, k[x]]), ['duty.cafe', d.cafe], ['duty.stand', d.stand], ['standDone', data.standDone], ['wage', data.wage], ['done', data.done],
    ...DUTY_BOSS.map((x) => ['nudge.' + x, nu[x]]), ...DUTY_BOSS.map((x) => ['fired.' + x, fi[x]]), ['cafeDone', data.cafeDone], ['payslip', data.payslip], ['tips', data.tips], ['tipsAll', data.tipsAll],
    ...['sweep', 'fix', 'restock', 'serve'].map((x) => ['call.' + x, (data.call || {})[x]]), ['answered', data.answered]];
  for (const [p, v0] of all) {
    const v = String(v0 || '');
    if (!v) { say(p, 'is empty'); continue; }
    // a note to yourself starts small — unless it starts with somebody's name (Spinner's letter…)
    if (/^[A-Z]/.test(v) && !/^(Spinner|Pip|Bean|Nib|Stamp|Fig Jr\.)/.test(v)) say(p, 'starts with a capital, and a note to yourself starts small');
    if (DUTY_UI.test(v)) say(p, 'names a control; a chip says what the place wants, never which button');
    if (DUTY_PAY.test(v)) say(p, 'calls a wage or a tip a reward');
    if (/\d/.test(v.replace(/\{coins\}|\{days\}/g, ''))) say(p, 'carries a number of its own \u2014 the game prints the numbers');
    if (p !== 'wage' && /\{(coins|days)\}/.test(v)) say(p, 'has a placeholder, and only the wage line carries the numbers');
    if ((p.startsWith('kinds.') || p === 'tips') && v.split(/\s+/).length > 3) say(p, 'is more than three words, and it sits before a count');
  }
  const w = String(data.wage || '');
  if ((w.match(/\{coins\}/g) || []).length !== 1) say('wage', 'must contain {coins} exactly once');
  if ((w.match(/\{days\}/g) || []).length !== 1) say('wage', 'must contain {days} exactly once');
  return bad;
}
const dutySchema = {
  type: 'object', additionalProperties: false, required: ['kinds', 'duty', 'wage', 'done', 'nudge', 'fired', 'cafeDone', 'standDone', 'payslip', 'tips', 'call', 'answered', 'tipsAll'],
  properties: {
    kinds: { type: 'object', additionalProperties: false, required: DUTY_KINDS,
      properties: Object.fromEntries(DUTY_KINDS.map((x) => [x, str(dutyFields['kinds.' + x].note)])) },
    duty: { type: 'object', additionalProperties: false, required: ['cafe', 'stand'], properties: { cafe: str(dutyFields['duty.cafe'].note), stand: str(dutyFields['duty.stand'].note) } },
    wage: str(dutyFields.wage.note), done: str(dutyFields.done.note),
    nudge: { type: 'object', additionalProperties: false, required: DUTY_BOSS, properties: Object.fromEntries(DUTY_BOSS.map((x) => [x, str(dutyFields['nudge.' + x].note)])) },
    fired: { type: 'object', additionalProperties: false, required: DUTY_BOSS, properties: Object.fromEntries(DUTY_BOSS.map((x) => [x, str(dutyFields['fired.' + x].note)])) },
    cafeDone: str(dutyFields.cafeDone.note), standDone: str(dutyFields.standDone.note), payslip: str(dutyFields.payslip.note), tips: str(dutyFields.tips.note),
    call: { type: 'object', additionalProperties: false, required: ['sweep', 'fix', 'restock', 'serve', 'deliver'], properties: { sweep: str(dutyFields['call.sweep'].note), fix: str(dutyFields['call.fix'].note), restock: str(dutyFields['call.restock'].note), serve: str(dutyFields['call.serve'].note), deliver: str(dutyFields['call.deliver'].note) } },
    answered: str(dutyFields.answered.note), tipsAll: str(dutyFields.tipsAll.note),
  },
};

// 🏘️ THE PLACES THAT STILL ANSWERED FROM CODE (22 Sep 2026): the town hall, the bank and the print shop toasted a
// hand-written line ending “Not built yet.”; the Wheel and the Exchange described themselves in HTML; an old
// arcade cabinet said “out of order” from a table in banana-town.js. Prose in code is the rule broken; now the rig
// writes them, plainly, and the town reads them (src/data/copy/town-fronts.json).
const frontFields = {
  hall: { kind: 'prose', aim: 80, max: 120, note: 'What the Town Hall says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is the Town Hall, where Nib keeps the big book of every resident; there is nothing to do inside yet — chapter two of the story will open it. Never a date.' },
  bank: { kind: 'prose', aim: 70, max: 110, note: 'What the bank says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is the bank — a cash machine; nothing to do here yet.' },
  print: { kind: 'prose', aim: 80, max: 120, note: 'What the print shop says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: it is the print shop with the sticker packs in its window; nothing to do inside yet — the packs are in the site’s shop. Never a price.' },
  wheel: { kind: 'prose', aim: 90, max: 130, note: 'The line under the Wheel of Peel’s heading on its card. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: Spinner’s wheel — one free spin a day, then a few coins a spin; every paid spin feeds the pot and one wedge takes it all. No rate beyond “a few coins”, no odds.' },
  exchange: { kind: 'prose', aim: 90, max: 130, note: 'The line under the Exchange’s heading on its card. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: Fig Jr. buys what your homestead made (eggs, milk, wool) at today’s price, which moves from day to day — sell now or hold. No number.' },
  // 🪧 THE REST OF THE SQUARE'S SPOTS (22 Sep 2026): these still answered a tap with a sentence typed into the code
  counter: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: the counter inside the Arcade. One day it will hand out tokens and keep the high-score book; nothing to do at it yet (every cabinet keeps its own board already)." },
  cart: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: the fruit cart on the square. One day it will sell duck bread; nothing to buy at it yet." },
  fountain: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: the fountain in the middle of the square. It works; there is nothing to do at it but look." },
  orchard: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: the orchard by the lemonade stand. One day it will drop apples your animals at home love; nothing to pick yet." },
  monument: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: the monument: a statue of a banana on a plinth with no plaque, so nobody knows who it is. One day the week’s best will be read out here; nothing to do at it yet. Never name a day of the week." },
  terrace: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: the Coffee Cup’s terrace. Nowhere to sit yet, and nothing to do here yet." },
  cut: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: the road north out of town. One day it will lead to the Cut; it goes nowhere yet." },
  gardenE: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: the Coffee Cup’s garden. Nothing to do here yet." },
  gardenW: { kind: 'prose', aim: 70, max: 110, note: "What this place says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026): a SIGNPOST, not a moment. Two plain sentences at most: what this is, then what a player can do here — here, that there is nothing to do yet, said plainly and without apology. No scenery, no metaphor, no riddle, no number, no day or time, never a question, never a promise of when. Here: Gran Fig’s flower garden. Nothing to do here yet. Never say when she is there." },
  oldCabinet: { kind: 'prose', aim: 50, max: 80, note: 'What an old arcade cabinet says when tapped. ⭐ A PLACE ANSWERS PLAINLY (docs/voice.md, 22 Sep 2026 — Trym: “i dont understand any of this text … clear and concrete messages”): this is a SIGNPOST, not a moment. Two plain sentences: what this is (name the place and who runs it), then what a player can do here. No scenery, no metaphor, no weather, no riddle. Here: this cabinet is out of order; nothing to play on it yet.' },
};
function frontShape(data) {
  const bad = [];
  plainPlace(bad, 'hall', data.hall, ['town hall', 'hall'], ['nothing', 'story', 'chapter', 'book']);
  plainPlace(bad, 'bank', data.bank, ['bank', 'cash machine'], ['nothing', 'yet']);
  plainPlace(bad, 'print', data.print, ['print shop', 'sticker'], ['nothing', 'yet', 'shop']);
  plainPlace(bad, 'wheel', data.wheel, ['wheel'], ['spin']);
  plainPlace(bad, 'exchange', data.exchange, ['exchange', 'fig jr'], ['sell', 'buys', 'price']);
  plainPlace(bad, 'oldCabinet', data.oldCabinet, ['cabinet'], ['out of order', 'nothing', 'yet']);
  plainPlace(bad, 'counter', data.counter, ['counter'], ['nothing', 'yet']);
  plainPlace(bad, 'cart', data.cart, ['cart'], ['nothing', 'yet']);
  plainPlace(bad, 'fountain', data.fountain, ['fountain'], ['nothing', 'look']);
  plainPlace(bad, 'orchard', data.orchard, ['orchard'], ['nothing', 'yet']);
  plainPlace(bad, 'monument', data.monument, ['monument', 'statue'], ['nothing', 'yet']);
  plainPlace(bad, 'terrace', data.terrace, ['terrace'], ['nothing', 'yet']);
  plainPlace(bad, 'cut', data.cut, ['road', 'cut'], ['nothing', 'yet', 'nowhere']);
  plainPlace(bad, 'gardenE', data.gardenE, ['garden'], ['nothing', 'yet']);
  plainPlace(bad, 'gardenW', data.gardenW, ['garden', 'flowers'], ['nothing', 'yet']);
  for (const f of ['monument', 'gardenW']) if (/monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening/i.test(String(data[f] || ''))) bad.push({ path: f, msg: 'names a day or a time — the town publishes no timetable', rule: 'shape' });
  for (const [f, v] of Object.entries(data)) if (typeof v === 'string' && /\d/.test(v)) bad.push({ path: f, msg: 'carries a number — no price, no odds, no date', rule: 'shape' });
  for (const [f, v] of Object.entries(data)) if (typeof v === 'string' && /\?\s*$/.test(v)) bad.push({ path: f, msg: 'ends in a question — nobody may ask the player one', rule: 'shape' });
  return bad;
}
const frontSchema = { type: 'object', additionalProperties: false, required: ['hall', 'bank', 'print', 'wheel', 'exchange', 'oldCabinet', 'counter', 'cart', 'fountain', 'orchard', 'monument', 'terrace', 'cut', 'gardenE', 'gardenW'],
  properties: Object.fromEntries(Object.entries(frontFields).map(([k, v]) => [k, str(v.note)])) };

// --- the toasts ------------------------------------------------------------------
// 🍞 one short line a place says back (23 Sep 2026: park-toasts, beach-toasts, rave-toasts, builder-toasts,
// pass-toasts). holdsAll() declares the holes a line may carry AND makes each one required, because a line that
// lost its {coins} still reads fine and silently drops the number. NO_MARKUP guards a line that goes into innerHTML.
const toastLine = (max, note, more = {}) => ({ kind: 'prose', max, note, ...more });
const holdsAll = (...keys) => ({
  holds: keys.map((k) => `{${k}}`),
  needs: keys.map((k) => [new RegExp(`\\{${k}\\}`), `must carry {${k}} — the game fills it`]),
});
const NO_MARKUP = { forbids: [[/[<>&]/, 'markup or an entity — the code builds the markup around this line']] };

export const JOBS = {
  // 📈🎡 THE MARKET (23 Sep 2026): the Wheel of Peel's card and the Exchange's card, now that both are real —
  // the server rolls the wheel and pays it, and a sale takes the produce out of the saved farm. The ids the
  // lists are keyed by (wedges, goods) are src/data/town/market.js's; the shape check holds the two together.
  'town-market': {
    id: 'town-market',
    title: 'Banana Town — the Wheel of Peel and the Exchange',
    what: 'The two market cards on the square: the wheel’s pot, its wedges, its buttons and what each spin says; the Exchange’s rows, its button, Bean’s rumour and what a sale says.',
    approved: 'src/data/copy/town-market.json',
    reads: 'src/scripts/banana-town.js (a static import: both cards open from the square)',
    top: ['wheel', 'exchange'],
    fields: {
      'wheel.title': { kind: 'label', max: 24, note: 'The wheel card’s heading.' },
      'wheel.pot': toastLine(30, 'Over the wheel: how many coins are in the shared pot right now.', holdsAll('n')),
      'wheel.wedges.c5': { kind: 'label', max: 10, note: 'Painted on the wedge that pays five coins. Short: it is drawn on a canvas.' },
      'wheel.wedges.firework': { kind: 'label', max: 12, note: 'The wedge that puts a firework in the pocket.' },
      'wheel.wedges.peel': { kind: 'label', max: 10, note: 'The two wedges that pay nothing (a banana peel).' },
      'wheel.wedges.c20': { kind: 'label', max: 10, note: 'The wedge that pays twenty coins.' },
      'wheel.wedges.lure': { kind: 'label', max: 10, note: 'The wedge that puts a lure in the pocket.' },
      'wheel.wedges.again': { kind: 'label', max: 12, note: 'The wedge that gives a free spin straight away.' },
      'wheel.wedges.pot': { kind: 'label', max: 10, note: 'The wedge that takes the whole pot.' },
      'wheel.free': { kind: 'label', max: 14, note: 'The button’s verb for the day’s free spin.' },
      'wheel.freeNote': { kind: 'label', max: 18, note: 'Under it: that it costs nothing today.' },
      'wheel.again': { kind: 'label', max: 14, note: 'The verb after a “spin again” wedge.' },
      'wheel.againNote': { kind: 'label', max: 18, note: 'Under it: that it is free.' },
      'wheel.paid': { kind: 'label', max: 14, note: 'The verb for a paid spin.' },
      'wheel.paidNote': { kind: 'label', max: 18, note: 'Under it: what it costs; {n} is the price.', ...holdsAll('n') },
      'wheel.wait': { kind: 'label', max: 14, note: 'On the button while the wheel turns.' },
      'wheel.won.coins': toastLine(40, 'Under the wheel after a coin wedge; {n} is what it paid.', holdsAll('n')),
      'wheel.won.firework': toastLine(90, 'After the firework wedge: it went into the pocket, and it can be launched on the square.'),
      'wheel.won.lure': toastLine(90, 'After the lure wedge: it went into the pocket, and it works at the beach pier.'),
      'wheel.won.peel': toastLine(60, 'After a peel wedge: nothing, said kindly.'),
      'wheel.won.again': toastLine(40, 'After the spin-again wedge.'),
      'wheel.won.pot': toastLine(50, 'After the pot wedge: {n} is the whole pot, now in the wallet.', holdsAll('n')),
      'wheel.full': toastLine(100, 'After an item wedge when the pocket already holds the most of that kind: Spinner pays {n} coins instead.', holdsAll('n')),
      'wheel.funds': toastLine(60, 'A paid spin with too few coins; {n} is the price, {have} the wallet.', holdsAll('n', 'have')),
      'wheel.cap': toastLine(100, 'The last paid spin of the day has been used; the free one comes back.'),
      'wheel.busy': toastLine(80, 'The spin did not reach the server: nothing was spent.'),
      'wheel.keep': toastLine(90, 'A device with no Banana Pass cannot spin, because spins are kept on the pass.'),
      'wheel.keepLink': { kind: 'label', max: 18, note: 'The link to the pass page under that line.' },
      'wheel.potWon': toastLine(90, 'What everybody on the square reads when {name} wins the pot of {n} coins.', holdsAll('name', 'n')),
      'wheel.potWonAnon': toastLine(90, 'The same when the winner has no name on their pass.', holdsAll('n')),
      'exchange.title': { kind: 'label', max: 20, note: 'The Exchange card’s heading.' },
      'exchange.goods.eggs': { kind: 'label', max: 10, note: 'A row’s name for eggs.' },
      'exchange.goods.milk': { kind: 'label', max: 10, note: 'A row’s name for milk.' },
      'exchange.goods.wool': { kind: 'label', max: 10, note: 'A row’s name for wool.' },
      'exchange.things.eggs': { kind: 'label', max: 18, note: 'Eggs, counted, inside a sentence (“12 eggs”).' },
      'exchange.things.milk': { kind: 'label', max: 18, note: 'Milk, counted, inside a sentence.' },
      'exchange.things.wool': { kind: 'label', max: 18, note: 'Wool, counted, inside a sentence.' },
      'exchange.each': toastLine(24, 'Beside a good’s name: today’s price; {price} is filled by the game.', holdsAll('price')),
      'exchange.up': toastLine(30, 'Under it when the price rose since yesterday; {was} is yesterday’s.', holdsAll('was')),
      'exchange.down': toastLine(30, 'When it fell.', holdsAll('was')),
      'exchange.same': toastLine(30, 'When it did not move.'),
      'exchange.have': toastLine(20, 'How many the farm has to sell.', holdsAll('n')),
      'exchange.sell': { kind: 'label', max: 12, note: 'The row’s button: sell all {n}.', ...holdsAll('n') },
      'exchange.sold': { kind: 'label', max: 10, note: 'The button after the sale.' },
      'exchange.total': toastLine(40, 'Under the rows: what everything would fetch today.', holdsAll('n')),
      'exchange.rumourUp': toastLine(80, 'Bean’s rumour that eggs go up tomorrow. Never a rate.'),
      'exchange.rumourDown': toastLine(80, 'Bean’s rumour that eggs drop tomorrow. Never a rate.'),
      'exchange.paid': toastLine(70, 'After a sale: {coins} paid for {n} of {what}.', holdsAll('coins', 'n', 'what')),
      'exchange.none': toastLine(120, 'The farm has nothing to sell right now: what makes the goods.'),
      'exchange.noFarm': toastLine(80, 'A player with no homestead.'),
      'exchange.cap': toastLine(80, 'Fig Jr. has bought all he takes of that good from one banana today; {what} is the good.', holdsAll('what')),
      'exchange.busy': toastLine(80, 'The sale did not go through: nothing was sold.'),
      'exchange.keep': toastLine(90, 'A device with no Banana Pass cannot sell, because sales are kept on the pass.'),
      'exchange.keepLink': { kind: 'label', max: 18, note: 'The link to the pass page under that line.' },
    },
    shape: (d) => {
      const bad = [];
      const w = (d.wheel && d.wheel.wedges) || {}, g = (d.exchange && d.exchange.goods) || {}, t = (d.exchange && d.exchange.things) || {};
      for (const id of ['c5', 'firework', 'peel', 'c20', 'lure', 'again', 'pot']) if (!w[id]) bad.push({ path: 'wheel.wedges.' + id, msg: 'missing — src/data/town/market.js paints a wedge with this id' });
      for (const id of ['eggs', 'milk', 'wool']) {
        if (!g[id]) bad.push({ path: 'exchange.goods.' + id, msg: 'missing — src/data/town/market.js sells this good' });
        if (!t[id]) bad.push({ path: 'exchange.things.' + id, msg: 'missing — the sale line names this good' });
      }
      return bad;
    },
  },
  // 💼 THE STAFF CARD (23 Sep 2026; the plan https://claude.ai/artifact/Ub4HFW4zdQcDiCGrUZNJxH): one card for all five
  // workplaces, opened by a tap on your own workplace or on the work note. Its top half is who you are there; its
  // bottom half is a round you play (the café, the stand, the post office) or the calls the town has for you (the
  // arcade, the store). A place answers plainly (docs/voice.md): these are signposts and labels, not a resident's line.
  'town-staff': {
    id: 'town-staff',
    title: 'Banana Town — the staff card',
    what: 'The card a worker opens at their own workplace or from the work note: where they work and for whom, their title, today’s tips or the week’s work and wage, today’s calls, and the buttons (go to work, answer the calls, the place’s other use).',
    approved: 'src/data/copy/town-staff.json',
    reads: 'src/scripts/town-staff.js (through a glob inside the card’s own lazy chunk)',
    top: ['of', 'ranks', 'rank', 'xp', 'today', 'nextWeek', 'nextTips', 'top', 'news', 'promoQ', 'promo', 'promoMoment', 'promoLine', 'wordQ', 'word', 'warn', 'demoted', 'warnCard', 'last', 'tips', 'tipsCap', 'week', 'wage', 'payday', 'calls', 'call', 'until', 'go', 'answer', 'quiet', 'second', 'shut', 'unlock', 'told', 'ref', 'refCard', 'memento', 'mementoFull', 'sotw', 'sotwMoment', 'sotwLine', 'sotwAgain', 'sotwCard', 'sotwCardOne'],
    fields: {
      ...Object.fromEntries(['cafe', 'stand', 'post', 'condo', 'store'].map((k) => [`of.${k}`, { kind: 'label', max: 40, note: 'Small capitals over the title: the workplace, then whose staff you are.' }])),
      // 🪜 THE LADDER (23 Sep 2026; Trym's calls: ranks 3·4·5·5·6, promotion at the boss). A title per rank, bottom first —
      // the card's heading, the work note's first words and the promotion's big line. Rank 1 is what you are called on the day you are hired.
      ...Object.fromEntries(['cafe', 'stand', 'post', 'condo', 'store'].map((k) => [`ranks.${k}[]`, { kind: 'label', max: 20, note: 'The titles at this workplace, rank 1 first, one per rank (src/data/town/jobs.js LADDER): what you are called there. Each rank a step up; plain enough to read on the work note.' }])),
      rank: toastLine(24, 'Beside the rank pips: which rank you hold; {n} is it and {of} how many there are.', { ...holdsAll('n', 'of'), ...NO_MARKUP }),
      xp: { kind: 'label', max: 14, note: 'Over your work XP at this workplace; the game prints the number and the next rank’s line.' },
      today: toastLine(40, 'Under the XP bar: today’s work XP against the day’s cap; {n} and {cap} are numbers.', { ...holdsAll('n', 'cap'), ...NO_MARKUP }),
      nextWeek: toastLine(64, 'What the next rank gives at a payslip job: its title, and what a full week pays there.', { ...holdsAll('title', 'coins'), ...NO_MARKUP }),
      nextTips: toastLine(64, 'What the next rank gives at a tips job: its title, and the day’s tips cap there.', { ...holdsAll('title', 'cap'), ...NO_MARKUP }),
      top: toastLine(40, 'Instead of that line at the top rank.', NO_MARKUP),
      'told.litter': toastLine(60, '🕹 Said the first time a day an arcade worker of the fourth rank picks litter up off the square: it counts as their sweeping for Spinner. Plain.', NO_MARKUP),
      'told.tidy': toastLine(76, '☕ Said when the café’s keyholder (rank 4) closes a good shift and the nearest mess on the square is put right: they tidied up, and the town is better for it. Plain, a little warm.', NO_MARKUP),
      ...Object.fromEntries(['cafe', 'condo', 'store', 'post'].map((k) => ['ref.' + k, toastLine(80, '📜 Said after the hire when the top rank at the rung below started you at this workplace’s second rank: whose reference counts, and where it starts you. Plain.', NO_MARKUP)])),
      ...Object.fromEntries(['stand', 'cafe', 'condo', 'store'].map((k) => ['refCard.' + k, toastLine(80, '📜 On the staff card at this workplace’s TOP rank: the boss’s reference, and the next rung up that would start you at its second rank.', NO_MARKUP)])),
      ...Object.fromEntries(['stand', 'cafe', 'condo', 'store', 'post'].map((k) => ['memento.' + k, toastLine(80, '📜 Said a beat after the promotion to this workplace’s TOP rank: the boss gives a piece for your homestead (the decor piece’s own name), and it is in your shed.', NO_MARKUP)])),
      mementoFull: toastLine(80, '📜 Said instead when the homestead shed is full: the boss has a gift, make room (it is given the next time there is).', NO_MARKUP),
      'told.ghost': toastLine(60, '👻 Said the first time a day an arcade worker of the fifth rank (the night manager) catches a ghost on the square: it counts as one of their repairs for Spinner. Plain.', NO_MARKUP),
      'told.lamp': toastLine(60, '🕹 Said when an arcade worker of the third rank puts a street lamp right on the square: it counts as one of their repairs for Spinner. Plain.', NO_MARKUP),
      // 🔓 THE UNLOCKS (23 Sep 2026; the ladder's slice 3, src/data/town/jobs.js UNLOCKS): what a rank lets you DO, one line per
      // unlock — under the next rank's line on the staff card, and said once the PROMOTED moment has gone up
      ...Object.fromEntries([['stand', 'big'], ['stand', 'jug'], ['cafe', 'rush'], ['cafe', 'special'], ['cafe', 'keys'], ['condo', 'streak'], ['condo', 'lamps'], ['condo', 'litter'], ['condo', 'ghosts'], ['store', 'basket'], ['store', 'deliver'], ['store', 'second'], ['store', 'keys'], ['post', 'fifth'], ['post', 'parcel'], ['post', 'registered'], ['post', 'round'], ['post', 'bus']].map(([a, k]) => [`unlock.${a}.${k}`, toastLine(80, 'What this rank lets you do at this workplace, in plain words: the new thing first, then what it means. Never a number, a rate or how often it comes (docs/voice.md).', NO_MARKUP)])),
      ...Object.fromEntries(['cafe', 'stand', 'post', 'condo', 'store'].map((k) => [`news.${k}`, toastLine(64, 'Over the XP once it has crossed the next rank’s line — and the WORK NOTE’s green line too (town-duties.js reads it from here): the boss has news, and you hear it by talking to them (promotion happens at the boss). Starts with the boss’s name. Never the word promoted, never a title or a number.', { ...NO_MARKUP, forbids: [[/[<>&]/, 'markup or an entity'], [/promot|\d/i, 'the word promoted or a number — the news is said in person']] })])),
      promoQ: { kind: 'prose', aim: 22, max: 32, note: 'The PLAYER’s question on their own boss’s card when the boss has news: the player’s voice, a question with a question mark (the job question’s sibling).' },
      ...Object.fromEntries(['bean', 'figjr', 'spinner', 'pip', 'stamp'].map((k) => [`promo.${k}`, { kind: 'prose', aim: 72, max: 96, holds: ['{title}'], needs: [[/\{title\}/, 'must carry {title} — the new rank’s title']], note: 'The boss telling the player they are promoted, in the boss’s own voice (Bean reads cups, Fig Jr. talks like a company, Spinner is a showman, Pip keeps last ones, Stamp weighs things and says Noted). MUST contain {title}, the new title, inside a sentence. No number, no pay.' }])),
      // ↕ THE WEEKLY REVIEW (23 Sep 2026): a poor week under the rank's line brings the boss's WARNING, the next one a DEMOTION —
      // both said in person, like a promotion, though the rank has already moved on the server
      wordQ: { kind: 'prose', aim: 20, max: 32, note: 'The PLAYER’s question on their own boss’s card when the boss has a word for them (a warning or a demotion): the player’s voice, a question with a question mark.' },
      ...Object.fromEntries(['cafe', 'stand', 'post', 'condo', 'store'].map((k) => [`word.${k}`, toastLine(64, 'On the work note and the staff card while the boss has a word waiting: who wants a word, and that you hear it by talking to them. Starts with the boss’s name. Never the word demoted, never a title or a number.', { forbids: [[/[<>&]/, 'markup or an entity'], [/demot|promot|\d/i, 'the word demoted or promoted, or a number — it is said in person']] })])),
      ...Object.fromEntries(['bean', 'figjr', 'spinner', 'pip', 'stamp'].map((k) => [`warn.${k}`, { kind: 'prose', aim: 72, max: 96, holds: ['{title}'], needs: [[/\{title\}/, 'must carry {title} — the rank you would drop to']], note: 'The boss’s WARNING, in their own voice (Bean reads cups, Fig Jr. talks like a company, Spinner is a showman, Pip keeps last ones, Stamp weighs things and says Noted): last week was poor, and another like it costs a rank. MUST contain {title}, the title one rank down. Firm, never cruel, no number.' }])),
      ...Object.fromEntries(['bean', 'figjr', 'spinner', 'pip', 'stamp'].map((k) => [`demoted.${k}`, { kind: 'prose', aim: 72, max: 96, holds: ['{title}'], needs: [[/\{title\}/, 'must carry {title} — the rank you are now']], note: 'The boss telling you that you are moved down a rank, in their own voice. MUST contain {title}, the title you hold now. It must leave the way back open. No number.' }])),
      warnCard: toastLine(60, 'On the staff card while a warning stands: another poor week here costs a rank. Plain.', NO_MARKUP),
      'last.full': toastLine(60, 'On the staff card: last week’s review was a full week, and {xp} work XP came extra.', { ...holdsAll('xp'), ...NO_MARKUP }),
      'last.poor': toastLine(60, 'On the staff card: last week’s review was poor, and {xp} work XP was taken back.', { ...holdsAll('xp'), ...NO_MARKUP }),
      'last.empty': toastLine(64, '↕ On the staff card after a week with nothing done here (a strike toward the sack): the next empty week loses the job. Said before it bites (design library §30.1). Plain.', NO_MARKUP),
      'last.poorCups': toastLine(64, '↕ On the staff card of the café or the stand after a poor week — for a counter that means most drinks missed the green band, not undone duties — and {xp} work XP was taken back.', { ...holdsAll('xp'), ...NO_MARKUP }),
      // 🏆 STAFF OF THE WEEK, TOLD BY THE BOSS (24 Sep 2026; docs/town-jobs-plan.md §25): the promotion's own grammar — the note
      // says the boss has news (news.*), the card leads with it (promoQ), the boss says it, STAFF OF THE WEEK goes up after.
      ...Object.fromEntries(['bean', 'figjr', 'spinner', 'pip', 'stamp'].map((k) => [`sotw.${k}`, { kind: 'prose', aim: 70, max: 90, note: 'The boss tells you that you were last week’s staff of the week at this workplace — the most work done there, a real week. In the boss’s own voice (town-personas), one breath; no number, no prize (there is none: the name is the prize).' }])),
      sotwMoment: { kind: 'label', max: 18, note: 'The BIG words over the square once the boss’s card has closed on the crown — the promotion’s PROMOTED, for staff of the week. Capitals.' },
      sotwLine: { kind: 'prose', aim: 26, max: 40, holds: ['{where}'], needs: [[/\{where\}/, 'must carry {where}']], note: 'Under it, the first time: when and where. {where} is lower case with its article, so never first. The screen sets it in capitals.' },
      sotwAgain: { kind: 'prose', aim: 26, max: 40, holds: ['{n}', '{where}'], needs: [[/\{n\}/, 'must carry {n}'], [/\{where\}/, 'must carry {where}']], note: 'Under it, a second crown or more: {n} is how many weeks in all. {where} never first.' },
      sotwCard: toastLine(44, 'On the staff card, for a worker crowned here more than once: {n} is how many weeks.', { ...holdsAll('n'), ...NO_MARKUP }),
      sotwCardOne: toastLine(44, 'The same, crowned here once.', NO_MARKUP),
      promoMoment: { kind: 'label', max: 10, note: 'The BIG word over the square once the boss’s card has closed on a promotion — the hire’s HIRED, for a new rank. Capitals, one word.' },
      promoLine: { kind: 'prose', aim: 30, max: 52, holds: ['{title}', '{where}'], needs: [[/\{title\}/, 'must carry {title}'], [/\{where\}/, 'must carry {where}']], note: 'The small line under it: the new title and where. {where} is lower case with its article (“the Coffee Cup”), so never first. The screen sets it in capitals.' },
      tips: { kind: 'label', max: 14, note: 'Over today’s tips (café, stand); the game prints the number and the cap beside it.' },
      tipsCap: toastLine(50, 'Under the tips bar: the most tips one banana can earn in a day; {cap} is the number.', { ...holdsAll('cap'), ...NO_MARKUP }),
      week: { kind: 'label', max: 14, note: 'Over the week’s duties (post office, arcade, store).' },
      wage: { kind: 'label', max: 16, note: 'Beside the week’s wage so far; the game prints the coins.' },
      payday: toastLine(50, 'Under the wage: payday is Monday; {days} is how many days away.', { ...holdsAll('days'), ...NO_MARKUP }),
      calls: { kind: 'label', max: 16, note: 'Over the list of what is waiting at the arcade or the store today.' },
      'call.sweep': { kind: 'label', max: 32, note: 'A call: litter to sweep on the arcade floor; the game prints how many.' },
      'call.fix': { kind: 'label', max: 32, note: 'A call: one arcade cabinet has gone dark and needs fixing.' },
      'call.restock': { kind: 'label', max: 32, note: 'A call: bare shelves in the store to fill from the crates.' },
      'call.serve': { kind: 'label', max: 32, note: 'A call: customers waiting at the store’s till (23 Sep 2026).' },
      'call.deliver': { kind: 'label', max: 32, note: '📦 A call: a parcel at the store to carry to a resident (rank 3).' },
      until: toastLine(40, 'Under today’s calls: a call stays open until midnight (slice 0b). No countdown, no pressure.', NO_MARKUP),
      go: { kind: 'label', max: 14, note: 'The big button on a shift job’s card: start the round.' },
      answer: { kind: 'label', max: 18, note: 'The big button when calls are waiting: go in and see to them.' },
      quiet: toastLine(40, 'Instead of that button when nothing is waiting.', NO_MARKUP),
      'second.post': { kind: 'label', max: 22, note: 'The post office’s other use, under Go to work: your own letters.' },
      'second.store': { kind: 'label', max: 22, note: 'The store’s other use: Pip’s shelf, to buy things.' },
      'second.condo': { kind: 'label', max: 22, note: 'The arcade’s other use: go inside and play the cabinets.' },
      shut: toastLine(70, 'The workplace is shut today: no work until it opens.', NO_MARKUP),
    },
    shape: (d) => {
      const bad = [];
      for (const k of ['cafe', 'stand', 'post', 'condo', 'store']) {
        if (!(d.of || {})[k]) bad.push({ path: 'of.' + k, msg: 'missing — every workplace has a staff card' });
        const r = (d.ranks || {})[k] || [];
        if (r.length !== ranksOf(k)) bad.push({ path: 'ranks.' + k, msg: `${r.length} titles, and the ladder has ${ranksOf(k)} ranks here (src/data/town/jobs.js LADDER)` });
        if (new Set(r).size !== r.length) bad.push({ path: 'ranks.' + k, msg: 'two ranks share a title' });
        if (!(d.news || {})[k]) bad.push({ path: 'news.' + k, msg: 'missing — every workplace has a boss with news' });
      }
      for (const k of ['bean', 'figjr', 'spinner', 'pip', 'stamp']) for (const t of ['promo', 'warn', 'demoted']) if (!(d[t] || {})[k]) bad.push({ path: t + '.' + k, msg: 'missing — every boss has this to say' });
      for (const k of ['cafe', 'stand', 'post', 'condo', 'store']) if (!(d.word || {})[k]) bad.push({ path: 'word.' + k, msg: 'missing — every workplace has a boss with a word' });
      if (!/\?$/.test(String(d.wordQ || ''))) bad.push({ path: 'wordQ', msg: 'is a question, with a question mark' });
      if (!/^[A-Z]+$/.test(String(d.promoMoment || ''))) bad.push({ path: 'promoMoment', msg: 'one word in capitals' });
      if (/^\{where\}/.test(String(d.promoLine || ''))) bad.push({ path: 'promoLine', msg: 'starts with {where}, which is lower case' });
      if (!/\?$/.test(String(d.promoQ || ''))) bad.push({ path: 'promoQ', msg: 'is a question, with a question mark' });
      for (const k of ['bean', 'figjr', 'spinner', 'pip', 'stamp']) if (!(d.sotw || {})[k]) bad.push({ path: 'sotw.' + k, msg: 'missing — every boss can crown their staff' });
      if (!/^[A-Z ]+$/.test(String(d.sotwMoment || ''))) bad.push({ path: 'sotwMoment', msg: 'in capitals' });
      for (const p of ['sotwLine', 'sotwAgain']) if (/^\{where\}/.test(String(d[p] || ''))) bad.push({ path: p, msg: 'starts with {where}, which is lower case' });
      for (const k of ['sweep', 'fix', 'restock', 'serve']) if (!(d.call || {})[k]) bad.push({ path: 'call.' + k, msg: 'missing — src/scripts/town-staff.js lists this call' });
      for (const k of ['post', 'store', 'condo']) if (!(d.second || {})[k]) bad.push({ path: 'second.' + k, msg: 'missing — this workplace has another use' });
      return bad;
    },
  },
  // 🛒 THE STORE'S CUSTOMERS (23 Sep 2026): a customer at the till wants a thing from the shelves; the ticket is its
  // picture, the bar their patience; find it, carry it to the till, hand it over. The world's voice around it.
  'town-deliver': {
    id: 'town-deliver',
    title: 'Banana Town — the store’s home delivery',
    what: 'The store’s parcel (rank 3): the one line when you pick it up (who it is for and where), the line when it arrives, and each resident as the parcel names them.',
    approved: 'src/data/copy/town-deliver.json',
    reads: 'src/scripts/town-deliver.js (through a glob inside its own lazy chunk)',
    top: ['picked', 'pickedTwo', 'delivered', 'deliveredOne', 'to', 'round', 'bus'],
    fields: {
      picked: toastLine(80, '📦 Said when the parcel is picked up off the store’s floor: who it is for and where ({to}, e.g. “Dot at the print shop”), and that the marker over the door shows the way. Plain, one breath.', { ...NO_MARKUP, ...holdsAll('to') }),
      delivered: toastLine(70, '📦 Said when the parcel reaches the door: delivered to {to}, and the job is done. Plain; never praise of the player.', { ...NO_MARKUP, ...holdsAll('to') }),
      pickedTwo: toastLine(90, '📦 Said at pickup on a two-parcel day (rank 4): who each is for ({to} and {to2}), and that the markers are over their doors.', { ...NO_MARKUP, ...holdsAll('to', 'to2') }),
      deliveredOne: toastLine(76, '📦 Said when the FIRST of two parcels reaches its door: delivered to {to}, and the other is for {next}.', { ...NO_MARKUP, ...holdsAll('to', 'next') }),
      'round.given': toastLine(96, '✉️ Said when the post office’s satchel is handed over after a round that counted (rank 5): letters for three residents ({to}, {to2}, {to3}), and the markers over their doors.', { ...NO_MARKUP, ...holdsAll('to', 'to2', 'to3') }),
      'round.deliveredOne': toastLine(60, '✉️ A letter of the round delivered, more to go: {to}, and {n} (a number) left.', { ...NO_MARKUP, ...holdsAll('to', 'n') }),
      'round.delivered': toastLine(60, '✉️ The last letter of the round delivered: the satchel is empty, the round is done.', NO_MARKUP),
      'bus.waiting': toastLine(64, '🚌 Said once, the first time in a day the mail bag is waiting at the bus stop (rank 6): the bus has left the post.', NO_MARKUP),
      'bus.picked': toastLine(60, '🚌 Said when the bag is picked up: carry it to the post office.', NO_MARKUP),
      'bus.delivered': toastLine(60, '🚌 The bag brought to the post office door: the town’s post is in.', NO_MARKUP),
      ...Object.fromEntries(TOWN_CAST.map(([k]) => ['to.' + k, { kind: 'label', max: 30, note: 'The resident and their place, as the parcel line names them: “Name at the place”. The place is where their door is on the square.' }])),
    },
    shape: (d) => Object.keys((d && d.to) || {}).length === TOWN_CAST.length ? [] : [{ path: 'to', msg: 'every resident needs a line: a parcel or a letter can be for any of them' }],
  },
  'town-serve': {
    id: 'town-serve',
    title: 'Banana Town — the store’s customers',
    what: 'What the store says while its staff serve a customer: the line under the ticket (what to do, the thing picked up, the wrong face), handing it over (fine and quick), a customer who gives up, and the tray’s way out.',
    approved: 'src/data/copy/town-serve.json',
    reads: 'src/scripts/town-serve.js (through a glob inside its own lazy chunk)',
    top: ['find', 'got', 'wrong', 'basket', 'one', 'more', 'served', 'late', 'leave', 'stopped', 'learnFind', 'learnGive'],
    fields: {
      // ⚠️ NEVER "THE TILL" (24 Sep 2026, Trym: "'Till' is a weird word - clear language is always preferred. I didnt understand if
      // i was supposed to put the object on the counter, or give it straight to the customer"). What they want GLOWS on the shelf
      // (no picture on the tray), and you give it to the CUSTOMER — say those two things, in those words.
      find: toastLine(60, 'Under the ticket, as the customer comes in (and again if you tap them with empty hands): take the glowing thing from the shelf to the customer. The one instruction, plain; never “till”.', { ...NO_MARKUP, forbids: [...NO_MARKUP.forbids, [/\btill\b/i, 'never “till” — say the customer']] }),
      got: toastLine(50, 'Under the ticket once you picked the right thing off the shelf: now give it to the customer.', { ...NO_MARKUP, forbids: [...NO_MARKUP.forbids, [/\btill\b/i, 'never “till” — say the customer']] }),
      wrong: toastLine(60, 'Under the ticket when you tapped a face with something else on it. Kind, plain; the right one is the one that glows.', NO_MARKUP),
      basket: toastLine(66, 'Under the ticket when a customer wants TWO things (the rank-2 basket): both glow; take both to the customer. Plain.', { ...NO_MARKUP, forbids: [...NO_MARKUP.forbids, [/\btill\b/i, 'never “till” — say the customer']] }),
      learnFind: toastLine(72, 'The FIRST customer this device ever sees: what a customer is, that what they want glows on the shelf, and tap it. A bouncing pointer stands over the glowing thing while this shows.', NO_MARKUP),
      learnGive: toastLine(50, 'The first time you pick the thing up: tap the customer to give it to them. The pointer moves over the customer and a lit square stands under them.', NO_MARKUP),
      one: toastLine(50, 'Under the ticket once you hold the first of the two things: now the other one.', NO_MARKUP),
      more: toastLine(50, 'Under the ticket when you reach the till holding only one of the two things. Never a telling-off.', NO_MARKUP),
      'served.fine': toastLine(60, 'Handed over in time. The customer leaves content.', NO_MARKUP),
      'served.perfect': toastLine(60, 'Handed over quickly. The store’s bell rings the customer out. Delight, never praise of the player.', NO_MARKUP),
      late: toastLine(60, 'The customer waited too long and leaves. Never a telling-off.', NO_MARKUP),
      leave: { kind: 'label', max: 12, note: 'The tray’s way out: send this customer away and take no more for now. Says what it does: stop serving.' },
      stopped: toastLine(60, 'Said when that button is pressed: no more customers until you step out of the store and back in — so the pause is said, never discovered.', NO_MARKUP),
    },
    shape: (d) => {
      const bad = [];
      for (const k of ['fine', 'perfect']) if (!(d.served || {})[k]) bad.push({ path: 'served.' + k, msg: 'missing — a customer is served fine or quickly' });
      return bad;
    },
  },
  // 🔧 THE ARCADE'S REPAIR GAME (23 Sep 2026): a dark cabinet is three steps on the counter's tray — unscrew (a needle to
  // stop), solder (a hold), power up (three taps) — graded like a cup. The world's voice around it, and the three buttons.
  'town-repair': {
    id: 'town-repair',
    title: 'Banana Town — the arcade’s repair game',
    what: 'The tray that opens when the arcade’s staff reach a dark cabinet: its three buttons, the way out, and the world’s lines as the panel comes off, when a repair sparks, and when the cabinet wakes.',
    approved: 'src/data/copy/town-repair.json',
    reads: 'src/scripts/town-repair.js (through a glob inside its own lazy chunk)',
    top: ['on', 'go', 'leave', 'spark', 'fixed', 'streak'],
    fields: {
      on: toastLine(76, 'Said as the repair tray rises: the cabinet’s back panel comes off, and what is wrong inside it. The world’s voice, plain, a picture of the three things to put right (a screw, a wire, a switch). Never an instruction.', NO_MARKUP),
      'go.unscrew': { kind: 'label', max: 16, note: 'The button for the first step, a TAPPED one: stop the needle in the screw’s slot. Starts with “Tap”.' },
      'go.solder': { kind: 'label', max: 16, note: 'The button for the second step, a HELD one: hold the iron to the wire and let go in the band. Starts with “Hold”.' },
      'go.power': { kind: 'label', max: 16, note: 'The button for the third step, TAPPED three times on the switch’s pulse. Starts with “Tap”.' },
      leave: { kind: 'label', max: 12, note: 'The tray’s way out: stop the repair, and the cabinet stays dark. A verb, short.' },
      spark: toastLine(60, 'A spoiled repair: the cabinet sparks and stays dark, and another go begins at once. Never a telling-off.', NO_MARKUP),
      'fixed.fine': toastLine(60, 'A repair that came out fine: the cabinet wakes, a little grudgingly.', NO_MARKUP),
      'fixed.perfect': toastLine(60, 'A perfect repair: the cabinet wakes as good as new. Delight, never praise of the player.', NO_MARKUP),
      'streak.one': toastLine(60, '🕹 A perfect repair at the arcade’s rank 2, the first of a run: the cabinet lights up (gold) and stays lit for the day. Said instead of fixed.perfect.', NO_MARKUP),
      'streak.run': toastLine(64, '🕹 A perfect repair that continues a run: it lights gold again, and the run’s count. MUST contain {n} — the game puts the count there.', { ...NO_MARKUP, ...holdsAll('n') }),
    },
    shape: (d) => {
      const bad = [];
      gestureLabels(bad, d.go, ['solder'], ['unscrew', 'power']);
      for (const k of ['fine', 'perfect']) if (!(d.fixed || {})[k]) bad.push({ path: 'fixed.' + k, msg: 'missing — a repair comes out fine or perfect' });
      return bad;
    },
  },
  'town-fronts': {
    id: 'town-fronts',
    title: 'Banana Town — what the other places say when tapped',
    what: 'The Town Hall, the bank, the print shop, an old arcade cabinet and the square’s smaller spots (the Arcade’s counter, the fruit cart, the fountain, the orchard, the monument, the terrace, the road north, the two gardens) when tapped; the line under the Wheel of Peel’s and the Exchange’s headings.',
    brief: 'tools/copy-briefs/town-fronts.md',
    out: 'tools/copy-out/town-fronts.json',
    approved: 'src/data/copy/town-fronts.json',
    reads: 'src/scripts/banana-town.js (a static import: short lines, read on every visit)',
    top: ['hall', 'bank', 'print', 'wheel', 'exchange', 'oldCabinet', 'counter', 'cart', 'fountain', 'orchard', 'monument', 'terrace', 'cut', 'gardenE', 'gardenW'],
    fields: frontFields,
    shape: frontShape,
    schema: frontSchema,
  },
  'town-life': {
    id: 'town-life',
    title: 'Banana Town — the town’s life',
    what: 'The notice board’s word for each band, Pip’s counter, the travelling stall, the night vendor, the ghosts, the closed-today notes and the cursed objects.',
    brief: 'tools/copy-briefs/town-life.md',
    out: 'tools/copy-out/town-life.json',
    approved: 'src/data/copy/town-life.json',
    reads: 'src/scripts/town-room.js (through a glob: the town runs wordless until this is approved)',
    top: ['bands', 'store', 'board', 'merchant', 'vendor', 'ghosts', 'closed', 'lowShut', 'rooms', 'locks', 'work', 'objects', 'things', 'shutSign', 'fx', 'toasts', 'pocket'],
    // ✅ approved by Trym 14 Sep 2026 ("approve town-life")
    // 🧍 Pip speaks here, so the writer gets the bible
    personas: 'town-personas',
    fields: lifeFields,
    shape: lifeShape,
    schema: lifeSchema,
  },
  'town-info': {
    id: 'town-info',
    title: 'Banana Town — the information kiosk',
    what: 'The rack of maps: its name, the four places and what each one is, the flyer for tonight at the Rave, and what the kiosk says with its shutter down.',
    brief: 'tools/copy-briefs/town-info.md',
    out: 'tools/copy-out/town-info.json',
    approved: 'src/data/copy/town-info.json',
    reads: 'src/scripts/town-info.js (through a glob inside the kiosk’s own lazy chunk, so a player who never opens the maps downloads none of it)',
    top: ['title', 'line', 'back', 'shut', 'areas', 'rave'],
    fields: infoFields,
    shape: infoShape,
    schema: infoSchema,
  },
  'town-post': {
    id: 'town-post',
    title: 'Banana Town — the post office',
    what: 'What the building says, the mailbox card and its two drawers, the knock at the door, an open letter, writing back, the refusal that may not say why — and the sorting round for the post office’s own staff.',
    brief: 'tools/copy-briefs/town-post.md',
    out: 'tools/copy-out/town-post.json',
    approved: 'src/data/copy/town-post.json',
    reads: 'src/scripts/town-post.js (through a glob inside the post office’s own lazy chunk)',
    top: ['front', 'title', 'empty', 'noaddress', 'shut', 'from', 'back', 'report', 'reported', 'reply', 'sheet', 'send', 'sent', 'refused', 'nopass', 'card', 'folk', 'round', 'drawers', 'knock'],
    fields: postFields,
    shape: postShape,
    schema: postSchema,
  },
  'town-quest': {
    id: 'town-quest',
    title: 'Banana Town \u2014 chapter two: the four signatures',
    what: 'The whole of chapter two: the title splash, and ten steps of dialogue between the town clerk, the 1999 works order nailed to each front, and the player.',
    brief: 'tools/copy-briefs/town-quest.md',
    out: 'tools/copy-out/town-quest.json',
    approved: 'src/data/copy/town-quest.json',
    reads: 'src/lib/world-quest.js (through a glob, joined to src/data/quest-c2.js at boot \u2014 no words means no chapter, and the town simply has no story in it)',
    top: ['chapter', 'title', 'steps'],
    // 🧍 Nib is not one of the town's nine, so the bible is not his \u2014 his voice is in the brief
    fields: questFields,
    shape: questShape,
    schema: questSchema,
  },
  'town-notes': {
    id: 'town-notes',
    title: 'Banana Town — the letters the residents write to you',
    what: 'Twenty-eight letters: a welcome from each of the four residents for somebody who has never had post, a note for no reason at all when nothing has arrived for days, and five letters keyed to something the world saw the reader do — their first post out, a cabin, a house, the square put right, and the morning after a Curse Night.',
    brief: 'tools/copy-briefs/town-notes.md',
    out: 'tools/copy-out/town-notes.json',
    approved: 'src/data/copy/town-notes.json',
    reads: 'worker-rave/src/index.js — the SERVER writes these, because a page that could claim to be Nib is the forgery the rail was closed against',
    top: NOTE_KINDS,
    // 🧍 four residents speak here, so the writer gets the bible
    personas: 'town-personas',
    fields: noteFields,
    shape: noteShape,
    schema: noteSchema,
  },
  'quest-c1': {
    id: 'quest-c1',
    title: 'Return to Sender \u2014 chapter one opens in the town',
    what: 'The first scene of chapter one, moved from the plot to the fountain in Banana Town: Nib, the letter, Plot 11 as a place to travel to, and the send-off to Old Peel.',
    brief: 'tools/copy-briefs/quest-c1.md',
    out: 'tools/copy-out/quest-c1.json',
    approved: 'src/data/copy/quest-c1.json',
    reads: 'src/lib/world-quest.js (through a glob; until this is approved the town has no first scene and the chapter cannot open)',
    top: ['open'],
    fields: c1Fields,
    shape: c1Shape,
    schema: c1Schema,
  },
  'town-page': {
    id: 'town-page',
    title: 'Banana Town \u2014 the page, now the front door',
    what: 'The four lines of the town page nobody in the world speaks: the tab title, the search line, the line under the sign and the how-to under the square.',
    brief: 'tools/copy-briefs/town-page.md',
    out: 'tools/copy-out/town-page.json',
    approved: 'src/data/copy/town-page.json',
    reads: 'src/pages/town.astro (a static import at build time \u2014 the page does not build without it)',
    top: ['title', 'description', 'tag', 'note'],
    fields: pageFields,
    shape: pageShape,
    schema: pageSchema,
  },
  'town-duties': {
    id: 'town-duties',
    title: 'Banana Town \u2014 the duties chip',
    what: 'The one-line work note in the corner of the square: today\u2019s duty at your workplace, the wage so far and the days to payday, the payslip waiting at home.',
    brief: 'tools/copy-briefs/town-duties.md',
    out: 'tools/copy-out/town-duties.json',
    approved: 'src/data/copy/town-duties.json',
    reads: 'src/scripts/town-duties.js (through a glob \u2014 no words, no chip)',
    top: ['kinds', 'duty', 'wage', 'done', 'nudge', 'fired', 'cafeDone', 'standDone', 'payslip', 'tips', 'call', 'answered', 'tipsAll'],
    fields: dutyFields,
    shape: dutyShape,
    schema: dutySchema,
  },
  'town-dress': {
    id: 'town-dress',
    title: 'Banana Town — the clothes shop',
    what: 'The dressing room card: its name, its one line, the three rails, and what a garment you have not caught yet says.',
    brief: 'tools/copy-briefs/town-dress.md',
    out: 'tools/copy-out/town-dress.json',
    approved: 'src/data/copy/town-dress.json',
    reads: 'src/scripts/town-dress.js (through a glob inside the shop’s own lazy chunk, so a player who never opens the wardrobe downloads none of it)',
    top: ['title', 'line', 'alt', 'confirm', 'locked'],
    fields: dressFields,
    shape: dressShape,
    schema: dressSchema,
  },
  'town-lemon': {
    id: 'town-lemon',
    title: 'Banana Town — the lemonade stand',
    what: 'Stepping behind Fig Jr.’s stand and stepping away, what the stand says to a stranger, the receipt, the three decks for a glass well or badly made, the one who gives up, and the three drinks’ names.',
    brief: 'tools/copy-briefs/town-lemon.md',
    out: 'tools/copy-out/town-lemon.json',
    approved: 'src/data/copy/town-lemon.json',
    reads: 'src/scripts/town-lemon.js (through a glob inside the stand’s own lazy chunk)',
    top: ['on', 'idle', 'front', 'receipt', 'go', 'cup', 'left', 'leave', 'big', 'jug', 'tipsAll', 'far'],
    personas: 'town-personas',
    fields: lemonFields,
    shape: lemonShape,
    schema: lemonSchema,
  },
  'town-cafe': {
    id: 'town-cafe',
    title: 'Banana Town — the Coffee Cup’s counter',
    what: 'Stepping behind the counter and stepping away, what the front says to a stranger, the receipt, the three decks for a cup well or badly made, the one who gives up, and the three drinks’ names.',
    brief: 'tools/copy-briefs/town-cafe.md',
    out: 'tools/copy-out/town-cafe.json',
    approved: 'src/data/copy/town-cafe.json',
    reads: 'src/scripts/town-cafe.js (through a glob inside the café’s own lazy chunk, so town-room never carries these bytes)',
    top: ['on', 'idle', 'front', 'receipt', 'go', 'cup', 'left', 'leave', 'rush', 'special', 'tipsAll', 'far'],
    // 🧍 Bean speaks here, so the writer gets the bible
    personas: 'town-personas',
    fields: cafeFields,
    shape: cafeShape,
    schema: cafeSchema,
  },
  'town-personas': {
    id: 'town-personas',
    title: 'Banana Town — who the residents are',
    what: 'The character bible: temperament, where they came from, what they love and hate, their interest, quirk, voice and the thing underneath.',
    brief: 'tools/copy-briefs/town-personas.md',
    out: 'tools/copy-out/town-personas.json',
    approved: 'src/data/copy/town-personas.json',
    reads: 'the writer, on every town-npcs run — no player ever reads these words',
    top: ['residents'],
    // ✅ approved by Trym 14 Sep 2026 ("approve town-personas") — the bible reaches every town-npcs run now
    fields: personaFields,
    shape: personaShape,
    schema: personaSchema,
  },
  'town-npcs': {
    id: 'town-npcs',
    title: 'Banana Town — the residents',
    what: 'Everything the town’s residents say: the meeting ladder, the tap line, their day, their want.',
    brief: 'tools/copy-briefs/town-npcs.md',
    out: 'tools/copy-out/town-npcs.json',
    approved: 'src/data/copy/town-npcs.json',
    reads: 'src/scripts/town-life.js',
    top: ['residents'],
    // 🧍 every line for these nine is written WITH the character bible in the prompt.
    // Trym, 13 Sep 2026: "when creating dialogue for them, their personalitys needs to be
    // a part of the dialogue generation". A persona sheet nobody feeds to the writer is a
    // document, and documents lose.
    personas: 'town-personas',
    fields: townFields,
    shape: townShape,
    schema: townSchema,
  },
  // 🕹 THE ARCADE'S FIVE GAMES (25 Sep 2026). Trym lost a run of Banana Invaders to "SWARMED" with the swarm still high up:
  // a fly's drop had hit him, and the game had one word for both ends. An end says what happened (docs/voice.md, "a game
  // line says what happened"), and a computer's lines name its keys where a phone's say tap.
  'town-games': {
    id: 'town-games',
    title: 'Banana Town — the arcade’s five games',
    what: 'Each cabinet’s name and the line under it on its card, what the screen says before a run (for a thumb, and for a keyboard), how each run ends, the line that offers another go, and the few words drawn during a run.',
    approved: 'src/data/copy/town-games.json',
    reads: 'src/scripts/town-games.js (a static import inside the games’ own lazy chunk)',
    top: ['cabinets', 'start', 'startKeys', 'end', 'again', 'againKeys', 'wave', 'perfect', 'spinner'],
    fields: {
      ...Object.fromEntries(['peelout', 'snake', 'invaders', 'pong', 'stack'].flatMap((g) => [
        ['cabinets.' + g + '.name', { kind: 'label', aim: 15, max: 18, note: 'The cabinet’s name: the heading of its card.' }],
        ['cabinets.' + g + '.sub', { kind: 'prose', aim: 76, max: 80, note: 'Under the name on the card: how to play with a thumb, then the game in one short sentence.' }],
        ['start.' + g, { kind: 'label', aim: 28, max: 30, note: 'Drawn on the game’s screen before a run starts, on a phone or a tablet: the one gesture that starts it. Lower case.' }],
        ['startKeys.' + g, { kind: 'label', aim: 28, max: 30, note: 'The same line on a computer (a mouse or a touchpad): the keys that play it. Lower case except a key’s own name.' }],
      ])),
      'end.peelout': { kind: 'label', aim: 8, max: 14, note: 'Big, in capitals, when the banana hits a vine, a crate or the vat.' },
      'end.snakeBit': { kind: 'label', aim: 8, max: 14, note: 'Big, in capitals, when the snake runs into its own peel.' },
      'end.snakeEdge': { kind: 'label', aim: 12, max: 14, note: 'Big, in capitals, when the snake runs off the edge of the board. Never the same word as snakeBit: the end says which it was.' },
      'end.invadersSwarmed': { kind: 'label', aim: 8, max: 14, note: 'Big, in capitals, when the flies come all the way down to the banana.' },
      'end.invadersHit': { kind: 'label', aim: 6, max: 14, note: 'Big, in capitals, when a drop from a fly lands on the banana (the drop that did it is marked). Never the swarm’s word.' },
      'end.pong': { kind: 'label', aim: 12, max: 14, note: 'Big, in capitals, when the third ball gets past the player’s peel.' },
      'end.stack': { kind: 'label', aim: 8, max: 14, note: 'Big, in capitals, when a crate misses the tower.' },
      again: { kind: 'label', aim: 20, max: 32, note: 'Under the end, on a phone: a tap starts a new run.' },
      againKeys: { kind: 'label', aim: 26, max: 32, note: 'The same on a computer: Space starts a new run (a click does too).' },
      wave: { kind: 'label', aim: 8, max: 12, ...holdsAll('n'), note: 'Banana Invaders, when a new row of flies comes in; {n} is its number.' },
      perfect: { kind: 'label', aim: 7, max: 10, note: 'Banana Stack, when a crate lands exactly on the one below.' },
      spinner: { kind: 'label', aim: 7, max: 10, note: 'Banana Pong: the name written by the other peel. Spinner runs the arcade.' },
    },
    shape: (d) => {
      const bad = [], ends = d.end || {};
      if (ends.snakeBit && ends.snakeBit === ends.snakeEdge) bad.push({ path: 'end.snakeEdge', msg: 'the same word as snakeBit — the end must say which it was' });
      if (ends.invadersHit && ends.invadersHit === ends.invadersSwarmed) bad.push({ path: 'end.invadersHit', msg: 'the same word as invadersSwarmed — a drop is not the swarm' });
      if (!/\bS\b/.test((d.startKeys || {}).invaders || '')) bad.push({ path: 'startKeys.invaders', msg: 'must name S, the key that throws (Trym asked for it, 25 Sep 2026)' });
      return bad;
    },
  },
  // 📷 the sticker packs' PRODUCT PHOTOS (18 Sep 2026): Trym's photos of the printed Party pack, shown on every
  // pack's page so a buyer sees the real thing — each carries a stamp saying so (tools/build-pack-photos.py bakes it)
  'pack-photos': {
    id: 'pack-photos',
    title: 'The sticker packs — the product photos’ stamp',
    what: 'The stamp baked onto the real product photos, the coin’s line, and the photos’ alt text.',
    brief: 'tools/copy-briefs/pack-photos.md',
    out: 'tools/copy-out/pack-photos.json',
    approved: 'src/data/copy/pack-photos.json',
    reads: 'tools/build-pack-photos.py + src/pages/shop/[handle].astro',
    top: ['stamp', 'stampOwn', 'coin', 'alt'],
    fields: {
      'stamp': { kind: 'prose', aim: 56, max: 70, note: 'The sticker baked onto every product photo: this is a real photo of a printed pack (the Party pack), shown for the finish and the size, and may not be the pack on this page. Plain, short, one line; no marketing.' },
      'stampOwn': { kind: 'prose', aim: 44, max: 60, note: 'The sticker on the same photos where they are shown on the Party pack’s OWN page: this is a real photo of this printed pack, for the finish and the size. Plain, short, one line.' },
      'coin': { kind: 'prose', aim: 20, max: 32, note: 'A second small sticker on the photo with the coin: the coin is there for size. A few words.' },
      'alt': { kind: 'prose', aim: 80, max: 110, note: 'The alt text of the product photos: what is in the picture (a printed A5 sticker sheet of pixel bananas on a wooden table), plainly.' },
    },
    shape: () => [],
    schema: { type: 'object', additionalProperties: false, required: ['stamp', 'stampOwn', 'coin', 'alt'], properties: {
      stamp: { type: 'string', description: 'The sticker baked onto every product photo: a real photo of a printed pack (the Party pack), for finish and size; may not be the pack on this page. One short plain line.' },
      stampOwn: { type: 'string', description: 'The sticker on the photos where they are shown on the Party pack’s own page: a real photo of this printed pack, for finish and size. One short plain line.' },
      coin: { type: 'string', description: 'The small second sticker on the coin photo: the coin is for size. A few words.' },
      alt: { type: 'string', description: 'Alt text: what the photo shows, plainly.' } } },
  },
  // 🪧 the homestead's notes (18 Sep 2026): the one line the sign says before the story has given you the place
  'homestead-notes': {
    id: 'homestead-notes',
    title: 'The Homestead — the sign before the story',
    what: 'What the sign says when a new banana taps it before Chapter 1 has given them the plot.',
    brief: 'tools/copy-briefs/homestead-notes.md',
    out: 'tools/copy-out/homestead-notes.json',
    approved: 'src/data/copy/homestead-notes.json',
    reads: 'src/scripts/banana-homestead.js',
    top: ['signEarly'],
    fields: {
      'signEarly': { kind: 'prose', aim: 70, max: 90, note: 'A toast when a new banana taps the homestead sign before the story has handed them the plot: the sign is not theirs to write yet, and the letter in the mailbox (Nib, the clerk) is where it starts. Warm, plain, one sentence; the voice bar (a 13-year-old and a 50-year-old read it without a stumble).' },
    },
    shape: () => [],
    schema: { type: 'object', additionalProperties: false, required: ['signEarly'], properties: {
      signEarly: { type: 'string', description: 'The toast when a new banana taps the sign before the story has handed them the plot: not theirs to write yet; the letter in the mailbox is where it starts. One warm plain sentence.' } } },
  },
  // 📬 THE WORLD'S OWN POST (19 Sep 2026): the letters the town writes to a player's homestead
  // mailbox. One per occasion, ever. src/scripts/banana-homestead.js holds WHEN; this holds WHAT.
  // 🌱 THE SEEDS' WAY HOME (24 Sep 2026). Be, a player, in a letter: "Where do I find my harvested seeds from the park and how
  // do I plant them?" — and Trym: "nothing says that you can plant seeds on that dirt". Each step of the way is said at the
  // moment it applies (design library §30), in plain site words: what you have, then the one thing to tap.
  // 🏡 the homestead’s toasts that were reworded in the plain-words pass (25 Sep 2026) — a changed line may not stay typed
  // into the code (tools/check-literal-says.mjs), so these nine moved here; the rest of the yard’s older toasts are still owed
  'homestead-toasts': {
    id: 'homestead-toasts',
    title: 'The Homestead — what the yard says back',
    what: 'Toasts in the homestead: a save that failed, a neighbour’s phone and mailbox, build mode’s soil tool and the ground it digs, the tent that comes first, land that grows, a full trough, and watering a neighbour’s beds.',
    approved: 'src/data/copy/homestead-toasts.json',
    reads: 'src/scripts/banana-homestead.js (a static import)',
    top: ['saveFailed', 'notYourPhone', 'soilTool', 'tentFirst', 'landGrows', 'fedWatered', 'wateredNeighbour', 'groundDug', 'theirMailbox'],
    fields: {
      saveFailed: toastLine(100, 'The homestead could not be saved online after several tries: it is safe on this device and that is what you see. Plain, no server talk. The game puts ⚠️ in front.'),
      notYourPhone: toastLine(48, 'Tapping the Banana Phone while visiting somebody else’s homestead: it is theirs. {name} is the owner.', holdsAll('name')),
      soilTool: toastLine(64, 'Build mode’s soil tool picked (no seeds in hand): tap to dig soil, tap soil to fill it back. The game puts ⛏️ in front.'),
      tentFirst: toastLine(60, 'Opening build mode before the tent is up: the tent comes first, and where to tap for it.'),
      landGrows: toastLine(72, 'Placing a new house that makes your land bigger: place it anywhere on the bigger plot.'),
      fedWatered: toastLine(60, 'The trough filled on a day the animals are fed: they give double tomorrow. The game puts 💧 in front.'),
      wateredNeighbour: toastLine(60, 'Watering the beds at a neighbour’s homestead: {name} is the neighbour; the beds grow overnight. The game puts 💧 in front.', holdsAll('name')),
      groundDug: toastLine(48, 'Trying to build on soil that is dug up: fill it in first.'),
      theirMailbox: toastLine(40, 'Tapping the mailbox at somebody else’s homestead: it is {name}’s. The game puts 📬 in front.', holdsAll('name')),
    },
    shape: () => [],
  },
  'homestead-seeds': {
    id: 'homestead-seeds',
    title: 'The Homestead — planting the seeds from the park',
    what: 'The lines that walk a player from seeds in the pouch to a planted seed: arriving with seeds, the soil tool, the first patch dug, and leaving build mode.',
    approved: 'src/data/copy/homestead-seeds.json',
    reads: 'src/scripts/banana-homestead.js (a static import)',
    top: ['arrive', 'soil', 'dug', 'done'],
    fields: {
      'arrive.digOne': toastLine(80, 'Arriving at your own homestead (once a day) with ONE seed from the park and no soil dug yet. The hammer button glows while it shows. What you have, then the action. The game puts 🌱 in front.'),
      'arrive.digMany': toastLine(84, 'The same with several seeds; {n} is how many.', holdsAll('n')),
      'arrive.plantOne': toastLine(70, 'Arriving with ONE seed and bare soil already dug: the soil glows while there are seeds.'),
      'arrive.plantMany': toastLine(72, 'The same with several seeds; {n} is how many.', holdsAll('n')),
      soil: toastLine(80, 'Build mode’s soil tool picked (or opened on) while you hold seeds: what soil is for, and the two steps after digging. The game puts ⛏️ in front.'),
      dug: toastLine(60, 'The first bare patch dug while you hold seeds: the next step. The game puts ⛏️ in front.'),
      done: toastLine(44, 'Leaving build mode with seeds and bare soil: the one thing to do. The game puts 🌱 in front.'),
    },
    shape: () => [],
  },
  'homestead-post': {
    id: 'homestead-post',
    title: 'The homestead — the world’s post',
    what: 'The letters the town’s residents send to a player’s mailbox — the occasion notes, the payslip and the bosses’ letters. (Since 22 Sep 2026 the mailbox is the post office’s own two-drawer card, so its heading and its empty line are town-post’s.)',
    brief: 'tools/copy-briefs/homestead-post.md',
    out: 'tools/copy-out/homestead-post.json',
    approved: 'src/data/copy/homestead-post.json',
    reads: 'src/scripts/banana-homestead.js',
    top: ['letters', 'wage', 'bosses'],
    fields: {
      'wage.from': { kind: 'prose', aim: 14, max: 20, note: 'Who signs the pay letter: Nib, who keeps the town’s big book and is its payroll desk.' },
      'wage.line': { kind: 'prose', aim: 110, max: 140, holds: ['{n}'], note: '⭐ THE CHEQUE, and the first thing in this world that ever ARRIVES WHILE THE PLAYER WAS NOT LOOKING. It is for a week of work that has finished, and MUST contain {n}, the coins. Say it as a clerk filing a thing that is already done — warm, dry, done. ⚠️ never a rate, never a day of the week, never “per” anything, and never a promise about next week: the town does not publish a timetable. At most 140 characters.' },
      // 📄 the payslip (22 Sep 2026): the stamp, the printed figures, the workplace names
      'wage.stamp': { kind: 'label', aim: 4, max: 8, note: 'The word on the rubber stamp across a settled payslip, in capitals, one word, at most 8 letters.' },
      'wage.slip': { kind: 'prose', aim: 34, max: 60, holds: ['{pct}', '{rate}'], note: 'The share line printed under the week\u2019s counts on the payslip. MUST contain {pct} (the share of the week\u2019s work done, a percentage the game prints) and {rate} (the wage for a full week) exactly once each; no other number; lower case; under 60 characters. The share first, then the rate it is a share of.' },
      // \ud83d\udcc4 the week that paid nothing (22 Sep 2026): it arrives too now, so the reasoning is on paper before the sack is
      'wage.none': { kind: 'prose', aim: 100, max: 140, note: 'Nib\u2019s line on the payslip for a finished week in which NOTHING on the week\u2019s list was done, so it pays nothing. Dry and warm, filing a thing that is already done: nothing was done, so nothing is filed \u2014 the counts printed under it show why. \u26a0\ufe0f no number and no {n} at all, never a scolding, never a threat, never a word about being let go (that is the boss\u2019s own letter), never a promise about next week. At most 140 characters.' },
      'wage.void': { kind: 'label', aim: 4, max: 8, note: 'The word on the rubber stamp across a payslip that paid NOTHING, in capitals, one word, at most 8 letters \u2014 the sibling of the stamp on a paid one, and not the same word.' },
      'bosses.nudge.condo.from': { kind: 'prose', aim: 7, max: 20, note: 'Who signs it: Spinner, who runs the Arcade.' },
      'bosses.nudge.condo.line': { kind: 'prose', aim: 100, max: 140, note: 'Spinner\u2019s letter when Thursday has come and nothing has been done at the Arcade that week: is the player coming in? Warm, dry, a little pointed, never a threat, never a number. It may use {home}. ⚖️ 24 Sep 2026 (the job QA): the letter ALSO says the stake — two empty weeks in a row and the job is gone — because the sack must never arrive unannounced; a rule is not a threat.' },
      'bosses.nudge.store.from': { kind: 'prose', aim: 3, max: 20, note: 'Who signs it: Pip, of the General Store.' },
      'bosses.nudge.store.line': { kind: 'prose', aim: 100, max: 140, note: 'Pip\u2019s letter when Thursday has come and nothing has been done at the store that week: is the player coming in? Warm, dry, a little pointed, never a threat, never a number. It may use {home}. ⚖️ 24 Sep 2026 (the job QA): the letter ALSO says the stake — two empty weeks in a row and the job is gone — because the sack must never arrive unannounced; a rule is not a threat.' },
      'bosses.fired.condo.from': { kind: 'prose', aim: 7, max: 20, note: 'Who signs it: Spinner.' },
      'bosses.fired.condo.line': { kind: 'prose', aim: 100, max: 140, note: 'Spinner\u2019s letter with the last payslip after two finished weeks with nothing done: he has taken the player off the book; the door is open if they ask again. Never cruel, never a lecture, never a number. ⚖️ 24 Sep 2026: it says what it was for — two weeks with no WORK done — never "you stopped coming": a player can turn up daily and still do no work.' },
      'bosses.fired.store.from': { kind: 'prose', aim: 3, max: 20, note: 'Who signs it: Pip.' },
      'bosses.nudge.post.from': { kind: 'prose', aim: 5, max: 20, note: 'Who signs it: Stamp, the postmaster.' },
      'bosses.nudge.post.line': { kind: 'prose', aim: 100, max: 140, note: 'Stamp\u2019s letter when Thursday has come and nothing has been done at the post office that week: is the player coming in? The pile on the counter is his subject. Warm, dry, a little pointed, never a threat, never a number, at most 140 characters. May use {home}. ⚖️ 24 Sep 2026 (the job QA): the letter ALSO says the stake — two empty weeks in a row and the job is gone — because the sack must never arrive unannounced; a rule is not a threat.' },
      'bosses.fired.post.from': { kind: 'prose', aim: 5, max: 20, note: 'Who signs it: Stamp.' },
      'bosses.fired.post.line': { kind: 'prose', aim: 100, max: 140, note: 'Stamp\u2019s letter with the last payslip after two finished weeks with nothing done: he has taken the player off the book; the door is open if they ask again. Never cruel, never a lecture, never a number, at most 140 characters. ⚖️ 24 Sep 2026: it says what it was for — two weeks with no WORK done — never "you stopped coming": a player can turn up daily and still do no work.' },
      // 🪜 the boss has news and you have not come by (23 Sep 2026: promotion happens at the boss, a letter if you do not come)
      ...Object.fromEntries(['cafe', 'stand', 'condo', 'store', 'post'].flatMap((k) => [[`bosses.news.${k}.from`, { kind: 'prose', aim: 6, max: 20, note: 'Who signs it: the boss at this workplace.' }], [`bosses.news.${k}.line`, { kind: 'prose', aim: 90, max: 140, note: 'The boss’s letter when the player’s work XP has earned a promotion and they have not come by: come and see me, I have news. In the boss’s own voice. Never the word promoted, never a title, never a number — the news is said in person.' }]])),
      ...Object.fromEntries(['cafe', 'stand'].flatMap((k) => ['nudge', 'fired'].flatMap((t) => [[`bosses.${t}.${k}.from`, { kind: 'prose', aim: 6, max: 20, note: 'Who signs it: the boss at this workplace.' }], [`bosses.${t}.${k}.line`, { kind: 'prose', aim: 100, max: 140, note: t === 'nudge' ? 'The boss’s Thursday letter when nothing has been done at the counter this week (23 Sep 2026: the counters can be let go too): come in when you can. Warm, a little pointed, never a threat, no number.' : 'The boss’s letter when empty weeks have cost you the job: you are off the book, and asking again starts you over from the bottom (Trym: fired means you “have to start over”). Never cruel, no number.' }]]))),
      'wage.review.full': { kind: 'prose', aim: 36, max: 50, holds: ['{xp}'], needs: [[/\{xp\}/, 'must carry {xp}']], note: 'A row on the payslip: the week’s review found a full week, and {xp} work XP came extra.' },
      'wage.review.poor': { kind: 'prose', aim: 36, max: 50, holds: ['{xp}'], needs: [[/\{xp\}/, 'must carry {xp}']], note: 'A row on the payslip: the week’s review found a poor week, and {xp} work XP was taken back.' },
      'wage.warned': { kind: 'prose', aim: 30, max: 50, note: 'A row on the payslip under a poor week that left you under your rank’s line: your boss wants a word. No number, no title.' },
      'wage.demoted': { kind: 'prose', aim: 30, max: 50, note: 'A row on the payslip under the week that cost you a rank. Plain, no number, no title.' },
      'bosses.fired.store.line': { kind: 'prose', aim: 100, max: 140, note: 'Pip\u2019s letter with the last payslip after two finished weeks with nothing done: he has taken the player off the book; the door is open if they ask again. Never cruel, never a lecture, never a number. ⚖️ 24 Sep 2026: it says what it was for — two weeks with no WORK done — never "you stopped coming": a player can turn up daily and still do no work.' },
      'wage.at.store': { kind: 'prose', aim: 17, max: 24, note: 'The General Store as it is printed on a payslip: lower case, with its article.' },
      'wage.at.condo': { kind: 'prose', aim: 10, max: 24, note: 'The Arcade as it is printed on a payslip: lower case, with its article.' },
      'wage.at.post': { kind: 'prose', aim: 15, max: 24, note: 'The Post Office as it is printed on a payslip: lower case, with its article.' },
      'letters.welcome.from': { kind: 'prose', aim: 14, max: 20, note: 'Who signed it: Nib, the Town Hall clerk. Their name as they would sign a letter.' },
      'letters.welcome.line': { kind: 'prose', aim: 110, max: 140, holds: ['{home}'], note: 'The letter itself, at most 140 characters, in their own voice, handwritten on paper: the plot is registered and the place is yours; he is pleased the paperwork is finally in order. Warm, plain, the questline’s voice bar (a 13-year-old and a 50-year-old read it without a stumble). It may use {name} for the player and {home} for their homestead’s name. Never a rate, never a time, never asks for anything back.' },
      'letters.movedin.from': { kind: 'prose', aim: 14, max: 20, note: 'Who signed it: Moss, the street sweeper. Their name as they would sign a letter.' },
      'letters.movedin.line': { kind: 'prose', aim: 110, max: 140, holds: ['{home}'], note: 'The letter itself, at most 140 characters, in their own voice, handwritten on paper: he walked past and saw the tent up; the place looks lived in. Warm, plain, the questline’s voice bar (a 13-year-old and a 50-year-old read it without a stumble). It may use {name} for the player and {home} for their homestead’s name. Never a rate, never a time, never asks for anything back.' },
      'letters.firstbeast.from': { kind: 'prose', aim: 14, max: 20, note: 'Who signed it: Gran Fig. Their name as they would sign a letter.' },
      'letters.firstbeast.line': { kind: 'prose', aim: 110, max: 140, holds: ['{home}'], note: 'The letter itself, at most 140 characters, in their own voice, handwritten on paper: she heard there is an animal on the plot now, and approves. Warm, plain, the questline’s voice bar (a 13-year-old and a 50-year-old read it without a stumble). It may use {name} for the player and {home} for their homestead’s name. Never a rate, never a time, never asks for anything back.' },
      'letters.shed.from': { kind: 'prose', aim: 14, max: 20, note: 'Who signed it: Pip, the General Store. Their name as they would sign a letter.' },
      'letters.shed.line': { kind: 'prose', aim: 110, max: 140, holds: ['{home}'], note: 'The letter itself, at most 140 characters, in their own voice, handwritten on paper: the shed is filling up; he is glad the things found a home. Warm, plain, the questline’s voice bar (a 13-year-old and a 50-year-old read it without a stumble). It may use {name} for the player and {home} for their homestead’s name. Never a rate, never a time, never asks for anything back.' },
      'letters.week.from': { kind: 'prose', aim: 14, max: 20, note: 'Who signed it: Nib, the Town Hall clerk. Their name as they would sign a letter.' },
      'letters.week.line': { kind: 'prose', aim: 110, max: 140, holds: ['{home}'], note: 'The letter itself, at most 140 characters, in their own voice, handwritten on paper: a week on the plot; the big book says so, and he thought you should know. Warm, plain, the questline’s voice bar (a 13-year-old and a 50-year-old read it without a stumble). It may use {name} for the player and {home} for their homestead’s name. Never a rate, never a time, never asks for anything back.' },
    },
    shape: (data) => {
      const bad = [];
      const say = (path, msg) => bad.push({ path, msg, rule: 'shape' });
      const w = data.wage || {};
      const stamp = String(w.stamp || '');
      if (!stamp) say('wage.stamp', 'is empty');
      if (stamp && stamp !== stamp.toUpperCase()) say('wage.stamp', 'is not in capitals, and a rubber stamp is');
      if (/\s/.test(stamp)) say('wage.stamp', 'is more than one word');
      // 📄 the week that paid nothing: its own stamp, and a line with no figure in it
      const vd = String(w.void || '');
      if (!vd) say('wage.void', 'is empty');
      if (vd && vd !== vd.toUpperCase()) say('wage.void', 'is not in capitals, and a rubber stamp is');
      if (/\s/.test(vd)) say('wage.void', 'is more than one word');
      if (vd && vd === stamp) say('wage.void', 'is the paid stamp’s word, on a slip that paid nothing');
      if (/\d|\{/.test(String(w.none || ''))) say('wage.none', 'carries a figure or a placeholder — a week that paid nothing names no number');
      const slip = String(w.slip || '');
      if ((slip.match(/\{pct\}/g) || []).length !== 1) say('wage.slip', 'must contain {pct} exactly once');
      if ((slip.match(/\{rate\}/g) || []).length !== 1) say('wage.slip', 'must contain {rate} exactly once');
      const bo = data.bosses || {};
      for (const k of ['cafe', 'stand', 'condo', 'store', 'post']) {
        const b = (bo.news || {})[k] || {};
        if (!String(b.from || '')) say('bosses.news.' + k + '.from', 'is empty');
        const l = String(b.line || '');
        if (!l) say('bosses.news.' + k + '.line', 'is empty');
        if (/\d|promot/i.test(l)) say('bosses.news.' + k + '.line', 'names a number or the promotion — the news is said in person');
      }
      for (const kind of ['nudge', 'fired']) for (const k of ['condo', 'store', 'post', 'cafe', 'stand']) {
        const b = (bo[kind] || {})[k] || {};
        if (!String(b.from || '')) say('bosses.' + kind + '.' + k + '.from', 'is empty');
        const l = String(b.line || '');
        if (!l) say('bosses.' + kind + '.' + k + '.line', 'is empty');
        if (/\d/.test(l)) say('bosses.' + kind + '.' + k + '.line', 'carries a number, and a boss\u2019s letter never does');
      }
      if (/\d/.test(slip)) say('wage.slip', 'carries a number of its own — the game prints the figures');
      if (slip && /^[A-Z]/.test(slip)) say('wage.slip', 'starts with a capital, and the printed line is lower case');
      if (/\d|\{/.test(String(w.line || '').replace(/\{n\}/g, ''))) say('wage.line', 'carries a figure of its own; the slip line prints the figures');
      for (const k of ['store', 'condo', 'post']) {
        const v = String((w.at || {})[k] || '');
        if (!v) say('wage.at.' + k, 'is empty');
        if (/^[A-Z]/.test(v)) say('wage.at.' + k, 'starts with a capital, and a workplace on a payslip is lower case with its article');
      }
      return bad;
    },
    schema: { type: 'object', additionalProperties: false, required: ['letters', 'wage', 'bosses'], properties: {
      bosses: { type: 'object', additionalProperties: false, required: ['nudge', 'fired', 'news'], properties: {
        news: { type: 'object', additionalProperties: false, required: ['cafe', 'stand', 'condo', 'store', 'post'], properties: Object.fromEntries(['cafe', 'stand', 'condo', 'store', 'post'].map((k) => [k, { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'The boss.' }, line: { type: 'string', description: 'Come and see me, I have news (a promotion, said in person).' } } }])) },
        nudge: { type: 'object', additionalProperties: false, required: ['condo', 'store', 'post'], properties: {
          post: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Stamp.' }, line: { type: 'string', description: 'Thursday has come and nothing has been done at the post office that week: is the player coming in? The pile on the counter is his subject. Warm, dry, a little pointed, never a threat, never a number, at most 140 characters. May use {home}.' } } },
          condo: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Spinner.' }, line: { type: 'string', description: 'Thursday has come and nothing has been done at the Arcade this week: is the player coming in? Warm, dry, a little pointed, never a threat, never a number, at most 140 characters.' } } },
          store: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Pip.' }, line: { type: 'string', description: 'Thursday has come and nothing has been done at the store this week: is the player coming in? Warm, dry, a little pointed, never a threat, never a number, at most 140 characters.' } } },
        } },
        fired: { type: 'object', additionalProperties: false, required: ['condo', 'store', 'post'], properties: {
          post: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Stamp.' }, line: { type: 'string', description: 'With the last payslip after two finished weeks with nothing done: he has taken the player off the book; the door is open if they ask again. Never cruel, never a lecture, never a number, at most 140 characters.' } } },
          condo: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Spinner.' }, line: { type: 'string', description: 'With the last payslip after two finished weeks with nothing done: he has taken the player off the book; the door is open if they ask again. Never cruel, never a lecture, never a number, at most 140 characters.' } } },
          store: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Pip.' }, line: { type: 'string', description: 'With the last payslip after two finished weeks with nothing done: he has taken the player off the book; the door is open if they ask again. Never cruel, never a lecture, never a number, at most 140 characters.' } } },
        } },
      } },
      wage: { type: 'object', additionalProperties: false, required: ['from', 'line', 'stamp', 'slip', 'at', 'none', 'void'], properties: {
        from: { type: 'string', description: 'Who signed the pay letter.' }, line: { type: 'string', description: 'The pay letter, holding {n} coins.' },
        stamp: { type: 'string', description: 'The word on the rubber stamp across a settled payslip: capitals, one word, at most 8 letters.' },
        slip: { type: 'string', description: 'The share line under the week\u2019s counts: MUST contain {pct} and {rate} exactly once each, no other number, lower case, under 60 characters; the share first, then the rate it is a share of.' },
        none: { type: 'string', description: 'Nib\u2019s line on the payslip for a finished week in which nothing on the list was done, so it pays nothing: nothing was done, so nothing is filed. No number, no {n}, never a scolding or a threat or a word about being let go, at most 140 characters.' },
        void: { type: 'string', description: 'The rubber-stamp word across a payslip that paid nothing: capitals, one word, at most 8 letters, not the paid stamp\u2019s word.' },
        at: { type: 'object', additionalProperties: false, required: ['store', 'condo', 'post'], properties: {
          store: { type: 'string', description: 'The General Store as printed on a payslip: lower case, with its article.' },
          condo: { type: 'string', description: 'The Arcade as printed on a payslip: lower case, with its article.' },
          post: { type: 'string', description: 'The Post Office as printed on a payslip: lower case, with its article.' } } },
      } },
      letters: { type: 'object', additionalProperties: false, required: ['welcome', 'movedin', 'firstbeast', 'shed', 'week'], properties: {
        welcome: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Who signed it: Nib, the Town Hall clerk.' }, line: { type: 'string', description: 'The letter, at most 140 characters: the plot is registered and the place is yours; he is pleased the paperwork is finally in order.' } } },
        movedin: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Who signed it: Moss, the street sweeper.' }, line: { type: 'string', description: 'The letter, at most 140 characters: he walked past and saw the tent up; the place looks lived in.' } } },
        firstbeast: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Who signed it: Gran Fig.' }, line: { type: 'string', description: 'The letter, at most 140 characters: she heard there is an animal on the plot now, and approves.' } } },
        shed: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Who signed it: Pip, the General Store.' }, line: { type: 'string', description: 'The letter, at most 140 characters: the shed is filling up; he is glad the things found a home.' } } },
        week: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Who signed it: Nib, the Town Hall clerk.' }, line: { type: 'string', description: 'The letter, at most 140 characters: a week on the plot; the big book says so, and he thought you should know.' } } },
      } },
    } },
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
  // 🍞 THE TOASTS (23 Sep 2026): the short lines a place says back when you do something. They were typed into
  // the calls until the toast gate (tools/check-literal-says.mjs) listed them as owed; they live here now, and
  // Claude writes them (the rule changed on 23 Sep 2026). Icons and markup stay in the code, the words here.
  'park-toasts': {
    id: 'park-toasts',
    title: 'The Park — what the garden and the birds say back',
    what: 'The toasts of the park’s garden (planting, watering, picking, the border, the birdhouses, the eggs, a miss), the birdwatching line and the tiers’ names.',
    approved: 'src/data/copy/park-toasts.json',
    reads: 'src/scripts/park-garden.js + src/scripts/park-birds.js (static imports)',
    top: ['garden', 'birds'],   // ⛲ the wishing fountain came out 25 Sep 2026 (its picture stays)
    fields: {
      'garden.miss': toastLine(60, 'The garden’s room never answered (offline, a hiccup): nothing happened, and any coins came back. Try again.'),
      'garden.takenBorder': toastLine(50, 'Somebody planted that border spot a moment before you; the coins came back.'),
      'garden.takenPost': toastLine(50, 'Somebody raised a birdhouse on that post first; the coins came back.'),
      'garden.takenPatch': toastLine(50, 'Somebody planted that patch first; the coins came back.'),
      'garden.groundBroken': toastLine(50, 'Breaking open a bed that is already open.'),
      'garden.bedOpen': toastLine(60, 'A new bed has been broken open, for everyone. The game puts 🪓 in front.'),
      'garden.borderPlanted': toastLine(70, 'A flower planted along the road; {what} is its name and the game puts its emoji in front.', holdsAll('what')),
      'garden.alreadyCleared': toastLine(40, 'Clearing a spot somebody cleared a moment ago.'),
      'garden.potCleared': toastLine(60, 'A spent border flower cleared: the spot can be planted again.'),
      'garden.houseRaised': toastLine(90, 'A birdhouse raised: the birds moved in, and stocking it daily keeps them. The game puts 🐦 in front.'),
      'garden.stockedToday': toastLine(60, 'Stocking a birdhouse that was stocked today already.'),
      'garden.stocked': toastLine(60, 'A birdhouse stocked. The game puts 🌾 in front.'),
      'garden.roots': toastLine(50, 'Coins turned up while digging; {n} is the amount, formatted by the game, which puts 🪙 in front.', holdsAll('n')),
      'garden.eggGone': toastLine(40, 'An egg somebody else picked up first. The game puts 🥚 in front.'),
      'garden.eggGolden': toastLine(80, 'The rare golden egg: {coins} coins and {tickets} beach tickets.', holdsAll('coins', 'tickets')),
      'garden.eggTickets': toastLine(70, 'An egg with {tickets} beach tickets in it; the pier on the bay takes them.', holdsAll('tickets')),
      'garden.eggCoins': toastLine(50, 'An egg with {coins} coins in it.', holdsAll('coins')),
      'garden.ripenedOne': toastLine(90, 'Back in the park: one of your plants ripened while you were away, and the park picked it for you.'),
      'garden.ripenedMany': toastLine(90, 'The same for {n} plants.', holdsAll('n')),
      'garden.ripenedRep': toastLine(20, 'The rep that came with them, added after the ripened line.', holdsAll('rep')),
      'garden.plantedDays': toastLine(60, 'A seed planted; {what} is the plant, {days} how many watered days it takes.', holdsAll('what', 'days')),
      'garden.plantedOneDay': toastLine(70, 'A seed planted that needs one watered day: what to do next.', holdsAll('what')),
      'garden.wateredToday': toastLine(60, 'Watering a patch that was watered today already.'),
      'garden.notYours': toastLine(70, 'Picking somebody else’s plant.'),
      'garden.notReady': toastLine(60, 'Picking a plant that is not ripe: it grows on the days it is watered.'),
      'garden.notQuite': toastLine(40, 'The room says the plant is still growing.'),
      'garden.bare': toastLine(40, 'Picking a patch with nothing in it.'),
      'garden.harvested': toastLine(50, 'A plant picked; {what} is its name, {rep} the rep it paid.', holdsAll('what', 'rep')),
      'garden.fruitAgain': toastLine(40, 'Said after a harvest from a bush that fruits again. The game adds 🍓.'),
      'garden.seedHome': toastLine(40, 'Said after a harvest: a seed went into the pouch for the homestead. The game adds 🌱.'),
      'garden.harvestedWear': toastLine(80, 'A wearable plant picked; {what} is the wearable. It is saved to the pass and a seed goes home.', holdsAll('what')),
      'garden.gardenerLevel': toastLine(60, 'The gardener level went up to {lvl}; new seeds are in the seed sheet.', holdsAll('lvl')),
      'garden.bedCleared': toastLine(60, 'A spent bed patch cleared: it can be planted again.'),
      'birds.spotted': toastLine(60, 'A bird spotted for the first time today; {bird} is its name, {tier} how rare it is. The game puts 🔭 in front.', holdsAll('bird', 'tier')),
      'birds.already': toastLine(60, 'A bird already on today’s list; {bird} is its name.', holdsAll('bird')),
      'birds.tiers.common': { kind: 'label', max: 16, note: 'How rare a bird is, as the spotted line says it: the commonest.' },
      'birds.tiers.uncommon': { kind: 'label', max: 16, note: 'The second tier.' },
      'birds.tiers.rare': { kind: 'label', max: 16, note: 'The third tier.' },
      'birds.tiers.legend': { kind: 'label', max: 16, note: 'The rarest birds.' },
    },
    shape: (d) => ['common', 'uncommon', 'rare', 'legend']
      .filter((k) => !(d.birds && d.birds.tiers && d.birds.tiers[k]))
      .map((k) => ({ path: 'birds.tiers.' + k, msg: 'missing — park-birds.js names every tier by its id' })),
  },
  'beach-toasts': {
    id: 'beach-toasts',
    title: 'Banana Bay — what the beach says back',
    what: 'The line for the last shell of the set, what the captain by the wreck says when you walk up (the day’s treasure while it is buried, then his rotation), and the lure arming itself at the pier.',
    approved: 'src/data/copy/beach-toasts.json',
    reads: 'src/scripts/banana-beach.js (a static import)',
    top: ['shells', 'captain', 'lure'],
    fields: {
      'shells.all': toastLine(80, 'The last kind of shell found: the collection is complete.'),
      'captain.treasure': toastLine(80, 'The captain, when you walk up while today’s treasure is still buried. The game puts 🗺 in front.'),
      'captain.lines[]': toastLine(80, 'The captain’s rotation once the treasure is found, one line per visit. He talks about the sand and digging, never shells.'),
      'lure.armed': toastLine(70, 'Over the float when a lure from the pocket arms itself on a cast at the pier: the next bites run bigger. Never a count.'),
      'lure.spent': toastLine(70, 'Over the float when the armed lure has run out.'),
    },
    shape: (d) => (Array.isArray(d.captain && d.captain.lines) && d.captain.lines.length ? []
      : [{ path: 'captain.lines', msg: 'the captain needs at least one line' }]),
  },
  'rave-toasts': {
    id: 'rave-toasts',
    title: 'The Rave — the big moments',
    what: 'The big moment for a new level (and the pass line under it), stepping up onto the stage, and the jelly boss arriving.',
    approved: 'src/data/copy/rave-toasts.json',
    reads: 'src/scripts/banana-rave.js (a static import)',
    top: ['level', 'stage', 'jellyBoss'],
    fields: {
      'level.title': toastLine(20, 'The headline of a level-up, in capitals; {level} is the new level. The game adds 🎖 and the rank’s title after it.', holdsAll('level')),
      'level.next': toastLine(60, 'Under the headline while there is a next title to earn; {at} is the level it comes at.', holdsAll('at')),
      'level.top': toastLine(60, 'Under the headline at the top rank.'),
      'level.remember': toastLine(50, 'The pass toast after the level in bold.'),
      'stage.title': toastLine(30, 'The headline for stepping up onto the stage, in capitals. The game adds 🔥.'),
      'stage.downStar': toastLine(60, 'Under it, when the ⭐ button brings you down again; the game fills {star} with the icon.', holdsAll('star')),
      'stage.downFloor': toastLine(60, 'Under it, when tapping the floor brings you down again.'),
      'jellyBoss.title': toastLine(30, 'The headline when the jelly boss arrives, in capitals. The game adds 🫧.'),
      'jellyBoss.sub': toastLine(30, 'Under it: what to do.'),
    },
    shape: () => [],
  },
  'builder-toasts': {
    id: 'builder-toasts',
    title: 'The builder — what Make a Banana says back',
    what: 'The builder’s toasts: copying a share link, sending a banana to the gallery wall, the overlay link, downloads, and the products that are coming soon.',
    approved: 'src/data/copy/builder-toasts.json',
    reads: 'src/scripts/banana-builder.js (a static import)',
    top: ['share', 'wall', 'overlay', 'download', 'soon'],
    fields: {
      'share.unfurl': toastLine(60, 'The share link copied, in the mode where the link previews as the player’s own banana.'),
      'share.plain': toastLine(40, 'The share link copied.'),
      'share.manual': toastLine(50, 'The clipboard refused: copy the address by hand.'),
      'wall.undressed': toastLine(50, 'Sending a banana to the wall with nothing on it.', { emojiOk: true }),
      'wall.clean': toastLine(60, 'The caption failed the family filter.', { emojiOk: true }),
      'wall.unnamed': toastLine(50, 'Sending a banana to the wall without a name.', { emojiOk: true }),
      'wall.rendering': toastLine(40, 'While the banana is rendered for the wall.', { emojiOk: true }),
      'wall.sentTitle': toastLine(50, 'In bold: the banana went to Trym for review. The game puts 🖼 in front.', NO_MARKUP),
      'wall.sentBody': toastLine(80, 'Under it: where the verdict shows up; the game fills {pass} with a link whose words are sentPass. The turnaround is Trym’s real promise.', { clockOk: true, ...holdsAll('pass'), ...NO_MARKUP }),
      'wall.sentPass': toastLine(30, 'The words of the link to the pass page inside sentBody.', NO_MARKUP),
      'wall.busy': toastLine(50, 'The gallery did not take the banana: try again later.'),
      'overlay.copied': toastLine(70, 'The stream overlay link copied, and where it goes.'),
      'download.emoji': toastLine(30, 'The emoji GIF downloaded.'),
      'download.meme': toastLine(30, 'The meme GIF downloaded.'),
      'download.image': toastLine(30, 'The image downloaded.'),
      'download.hiccup': toastLine(40, 'A GIF export failed: try again.'),
      'soon.named': toastLine(80, 'Tapping a product that is not for sale yet; {product} is its name, made plural by the s after it.', { emojiOk: true, ...holdsAll('product') }),
      'soon.unnamed': toastLine(80, 'The same when the tile has no name to read.', { emojiOk: true }),
    },
    shape: () => [],
  },
  // 🛒 THE CHECKOUT HAND-OFF (24 Sep 2026). Trym: *"it can take from 3-6-7 seconds before anything happens and youre sent
  // to the checkout page … should we have a better loading popup"*. One card over the page for every road to Shopify's
  // checkout (the official shop's Buy, Make a Banana's Order and its add-to-cart, the cart drawer's Checkout), naming each
  // step as it happens (design library §3d: one word held for seven seconds reads as stalled). Site words: plain.
  'checkout': {
    id: 'checkout',
    title: 'The checkout hand-off — the card while an order is prepared',
    what: 'The card that covers the page between a buy button and Shopify’s checkout: its heading, the steps it ticks off, the secure-checkout line, what it says when the wait runs long, when the page will not leave, and when something failed.',
    approved: 'src/data/copy/checkout.json',
    reads: 'src/lib/checkout-veil.js (a static import; the veil is its own lazy chunk)',
    top: ['title', 'step', 'secure', 'slow', 'stuck', 'open', 'fail', 'retry', 'close'],
    fields: {
      'title.item': { kind: 'prose', aim: 30, max: 38, ...holdsAll('product'), note: 'The card’s heading when Make a Banana’s Order sends THEIR design to checkout; {product} is the product in lower case (sticker, magnet, tee, sticker sheet). What is happening, in their words.' },
      'title.order': { kind: 'prose', aim: 26, max: 32, note: 'The heading when the official shop’s Buy or the cart drawer’s Checkout sends the whole cart to checkout.' },
      'title.add': { kind: 'prose', aim: 34, max: 42, ...holdsAll('product'), note: 'The heading when Make a Banana’s add-to-cart puts their design in the cart (no checkout: the cart drawer opens after).' },
      'step.design': { kind: 'label', aim: 22, max: 28, note: 'Step one of a custom order: the print file is rendered and uploaded. Shown with a box that ticks when it is done; the card adds the ellipsis while it runs.' },
      'step.cart': { kind: 'label', aim: 22, max: 28, note: 'The item goes into the shared cart (for a custom design, the per-order product is made first so checkout shows their banana).' },
      'step.checkout': { kind: 'label', aim: 24, max: 28, note: 'The page is on its way to Shopify’s checkout. Stays up until the page leaves.' },
      secure: { kind: 'label', aim: 26, max: 32, note: 'Small, under the bar, beside a lock the code draws: the next page is Shopify’s, on another address, so it is said before they land there.' },
      slow: { kind: 'prose', aim: 56, max: 70, note: 'Appears under the bar when one step has run long: still working, and the likely reason. Never a number of seconds.' },
      stuck: { kind: 'prose', aim: 36, max: 48, note: 'Appears when the page has been told to go to checkout and has not left: an in-app browser can hold it. The open button below is the way through.' },
      open: { kind: 'label', aim: 13, max: 16, note: 'The button under stuck: a plain link to the checkout address.' },
      'fail.title': { kind: 'prose', aim: 16, max: 22, note: 'The heading when a step failed.' },
      'fail.design': { kind: 'prose', aim: 60, max: 76, note: 'The render or the upload failed: what did not happen, and what to do. No blame.' },
      'fail.cart': { kind: 'prose', aim: 66, max: 80, note: 'The shop (Shopify’s cart) did not answer: nothing was charged — the one worry at a payment step — and try again.' },
      retry: { kind: 'label', aim: 9, max: 14, note: 'The button that runs the whole thing again from the start.' },
      close: { kind: 'label', aim: 5, max: 10, note: 'The button that closes the card after a failure: “Close”, the word every card on the site closes with.' },
    },
    shape: () => [],
  },
  'pass-toasts': {
    id: 'pass-toasts',
    title: 'My Pass — what the pass page says back',
    what: 'The pass page’s notes and toasts: the membership (cancel, keep), a login link that failed, a rename sent for review, the family filter on a name, logging in, linking a device, a passkey, logging out, the news list, an email added.',
    approved: 'src/data/copy/pass-toasts.json',
    reads: 'src/scripts/banana-pass-page.js (a static import)',
    top: ['member', 'landing', 'outbox', 'name', 'share', 'device', 'logout', 'passkey', 'welcome', 'news', 'email'],
    fields: {
      'member.cancelling': toastLine(30, 'While a membership cancel is sent.'),
      'member.wait': toastLine(30, 'While a membership change is sent.'),
      'member.cancelled': toastLine(60, 'The membership is cancelled; the line above already carries the date.'),
      'member.kept': toastLine(50, 'The cancel was undone: still a member.'),
      'member.failed': toastLine(110, 'The server said no: nothing changed; try again or use the Polar link below.'),
      'member.error': toastLine(60, 'The call failed: nothing changed.'),
      'landing.slow': toastLine(80, 'A login link timed out reaching the server.', NO_MARKUP),
      'landing.broken': toastLine(40, 'A login link failed with no reason given.', NO_MARKUP),
      'outbox.sent': toastLine(60, 'A creator’s rename was sent to Trym for a look (the game puts 📮 in front).'),
      'outbox.unsent': toastLine(40, 'The rename did not send.'),
      'outbox.failed': toastLine(40, 'Taking an item off sale did not work.'),
      'name.clean': toastLine(60, 'A pass name failed the family filter.', { emojiOk: true, ...NO_MARKUP }),
      'name.official': toastLine(40, 'After the new name in bold: it is the pass’s name now.', NO_MARKUP),
      'share.failed': toastLine(50, 'Sharing the pass failed.', NO_MARKUP),
      'device.title': toastLine(20, 'In bold capitals: a second device linked. The game puts 🔗 in front.', NO_MARKUP),
      'device.body': toastLine(50, 'Under it.', NO_MARKUP),
      'logout.title': toastLine(20, 'In bold capitals: logged out. The game puts 👋 in front.', NO_MARKUP),
      'logout.body': toastLine(120, 'Under it: what stays on this device and what waits on the account.', NO_MARKUP),
      'passkey.title': toastLine(20, 'In bold capitals: a passkey set up. The game puts 🔐 in front.', NO_MARKUP),
      'passkey.body': toastLine(70, 'After it: how the login works on this device now.', NO_MARKUP),
      'welcome.title': toastLine(20, 'In bold capitals: logged back in with a passkey. The game puts 🎫 in front.', NO_MARKUP),
      'welcome.body': toastLine(50, 'Under it.', NO_MARKUP),
      'news.title': toastLine(24, 'In bold capitals: signed up for the news. The game puts 📣 in front.', NO_MARKUP),
      'news.body': toastLine(50, 'Under it.', NO_MARKUP),
      'email.addedTitle': toastLine(20, 'In bold capitals: an email added to a pass. The game puts ✉️ in front.', NO_MARKUP),
      'email.addedBody': toastLine(50, 'Under it.', NO_MARKUP),
      'email.inTitle': toastLine(20, 'In bold capitals: logged in with an email link. The game puts 🎫 in front.', NO_MARKUP),
      'email.inBody': toastLine(40, 'Under it.', NO_MARKUP),
    },
    shape: () => [],
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
