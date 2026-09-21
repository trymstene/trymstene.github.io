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
  'residents[].hi[]': { kind: 'prose', maxByIndex: [90, 90, 90, 90, 100], note: 'The meeting ladder, rungs 0-4. 0 a stranger, 1 they have noticed you, 2 they use your name and say ONE plain, concrete thing about the square or their counter — never a riddle, never a mood, 3 their own nickname for you, 4 ONE private thing given away — the only warm line they have.' },
  'residents[].ask.doing': { kind: 'prose', aim: 26, max: 34, note: 'The button the PLAYER presses to ask what this resident is doing right now. The player’s own voice, plain and natural. It is pressed at ANY station — a bench, the square, mid-walk — so it must never name an activity the player cannot see (not "What are you writing down?"). Ends in a question mark.' },
  'residents[].ask.want': { kind: 'prose', aim: 26, max: 34, note: 'The button the PLAYER presses to ask whether this resident needs anything. The player’s own voice, plain and natural. Ends in a question mark.' },
  'residents[].ask.curse': { kind: 'prose', emptyOk: true, aim: 26, max: 34, note: 'MOSS ONLY. The button the PLAYER presses to ask about the nights here — the player’s own voice, plain (“What happens here at night?”). Ends in a question mark.' },
  'residents[].curse': { kind: 'prose', emptyOk: true, aim: 170, max: 210, note: 'MOSS ONLY, in his voice: how the nights go here. Some nights the square is cursed; ghosts wander and undo the day’s work, and walking into one sends it off; strange things appear in the dark, and one picked up is yours to keep — though it does something to you for a while; the night stall pays coin for them. Two or three short sentences, concrete and plain; never when, never a number.' },
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
  for (const r of list) if (!TOWN_CAST.some(([k]) => k === r.key)) say(`residents[${r && r.key}]`, `"${r && r.key}" is not one of the nine`, 'cast');

  // 🌡 THE RANGE. Nine agreeable people is not a town, and it is exactly what a writer
  // produces when nobody asks otherwise. These four checks are Trym's "some grumpy, some
  // normal happy, some ecstatic" in the only form that survives a lost context.
  const tempers = list.map((r) => r && r.temper).filter(Boolean);
  const distinct = new Set(tempers);
  if (distinct.size < 5) {
    say('residents[].temper', `only ${distinct.size} temperaments across the nine (${[...distinct].join(', ')}) — the town needs at least five different ones`, 'range');
  }
  for (const t of distinct) {
    const n = tempers.filter((x) => x === t).length;
    if (n > 3) say('residents[].temper', `${n} of the nine are "${t}" — no more than three may share a temperament`, 'range');
  }
  if (!tempers.some((t) => SOUR.includes(t))) say('residents[].temper', `nobody here is ${SOUR.join(' or ')} — at least one resident is genuinely hard work`, 'range');
  if (!tempers.some((t) => BRIGHT.includes(t))) say('residents[].temper', `nobody here is ${BRIGHT.join(' or ')} — at least one resident runs hot`, 'range');

  // and the individuality itself: two residents who hate the same thing are one resident
  for (const field of ['hates', 'loves', 'quirk']) {
    const byValue = new Map();
    list.forEach((r, i) => {
      const v = String((r && r[field]) || '').trim().toLowerCase();
      if (!v) return;
      if (byValue.has(v)) say(`residents[${i}].${field}`, `the same ${field} as ${list[byValue.get(v)].name} — each of the nine needs their own`, 'range');
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
      description: 'All nine residents, in the order the brief lists them.',
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
  'store.greet': { kind: 'prose', aim: 80, max: 100, note: 'The line at the top of Pip’s shelf, in Pip’s voice. One breath.' },
  'store.shut': { kind: 'prose', aim: 90, max: 110, note: 'Shown instead of the shelf when the store is shut and Pip is indoors. Not an apology; it should make a player want to fix things.' },
  'store.needs': { kind: 'prose', aim: 24, max: 34, note: 'A row the player cannot buy yet: their house is too small for it. Four or five words.' },
  'store.van': { kind: 'prose', aim: 18, max: 26, note: 'A row that arrives by van rather than at once. Three or four words.' },
  'store.sold[]': { kind: 'prose', aim: 70, max: 90, holds: ['{item}'], note: 'Said when somebody buys. MUST contain {item} — the game puts the thing’s name there.' },
  'board.title': { kind: 'prose', aim: 12, max: 18, note: 'The board’s heading. One or two words.' },
  'forSale': { kind: 'prose', aim: 8, max: 12, note: 'The words on the big red sign hung on the Coffee Cup while the café is for sale (Trym, 15 Sep). Two words, the way a shop window says it.' },
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
  'closed.cafe[]': { kind: 'prose', aim: 70, max: 90, note: 'Why THE COFFEE CUP is shut today, the way a note taped to its own door reads — a small fault in a coffee kiosk that somebody will see to. ⚠️ THREE FRONTS CAN SHUT AND NO OTHERS (the café, the info point, the general store), and a line only ever hangs on the one it is written for: naming any other building here is a lie on a door. Never the arcade and never the post office, which can never shut.' },
  'closed.info[]': { kind: 'prose', aim: 70, max: 90, note: 'The same, for THE INFO POINT — the little map-and-noticeboard kiosk Dot keeps. Its faults are its own: the map, the glass, the leaflets, the light inside it.' },
  'closed.store[]': { kind: 'prose', aim: 70, max: 90, note: 'The same, for THE GENERAL STORE — Pip’s shop, which sells fireworks, lures and duck bread. Its faults are its own: a delivery, the till, a shelf, the cellar.' },
  'work.at.store': { kind: 'prose', aim: 20, max: 30, note: 'The general store’s name AS IT FITS INSIDE A SENTENCE — it is dropped into {where} in `hired` and `moved`, so it must read naturally mid-line and carry its own article if it needs one. Not the sign plank, which shouts.' },
  'work.at.condo': { kind: 'prose', aim: 20, max: 30, note: 'The arcade’s name, the same way.' },
  'work.at.cafe': { kind: 'prose', aim: 20, max: 30, note: 'The Coffee Cup’s name, the same way.' },
  'work.crate': { kind: 'prose', aim: 60, max: 80, note: 'Said as you lift a crate off the stack in the shop you work in. The weight is the point — the banana walks slower while carrying — so let the line feel like picking something heavy up. No instruction, no arrow, no “now take it to…”: the shelf with nothing on it is the instruction.' },
  'work.stocked': { kind: 'prose', aim: 60, max: 80, note: 'Said as the crate goes onto a bare shelf and the face fills. ⭐ the reward IS the shelf and the row now on the till, so this line notices that rather than praising anybody. Never a number, never coins — the chore does not pay in money.' },
  'work.full': { kind: 'prose', aim: 60, max: 80, note: 'Said when every face the shop has is already filled, so there is nothing left to stock today. Contented, not a refusal — the work is DONE, which is a nice thing to be told.' },
  'work.ask': { kind: 'prose', aim: 26, max: 40, note: 'The question the PLAYER asks a boss to be hired, on their dialogue card beside the two they already answer. The player’s voice, not the boss’s. A question, with a question mark.' },
  'work.hired': { kind: 'prose', aim: 80, max: 100, holds: ['{where}'], note: 'The boss saying yes. MUST contain {where} (the building). Warm and a little dry — a job in this town is a favour done gladly, never a contract. ⚠️ {where} IS LOWERCASE AND CARRIES ITS OWN ARTICLE (“the Arcade”), so it may never be the first thing after a full stop or start the line: “Gladly. {where} could use your hands.” printed a sentence beginning with a small letter for two of the three bosses. Keep it inside a clause.' },
  'work.moved': { kind: 'prose', aim: 80, max: 100, holds: ['{where}'], note: 'Said when a player who already works somewhere takes a job here instead. MUST contain {where}. One job at a time is the rule; this line makes leaving the old one feel like a decision, never a telling-off. ⚠️ {where} is lowercase and carries its own article, so it may never follow a full stop or open the line.' },
  'work.already': { kind: 'prose', aim: 70, max: 90, note: 'Said when you ask for a job you already hold. Fond, brief, no admin.' },
  'work.keep': { kind: 'prose', aim: 90, max: 110, note: 'Said when the player has no kept pass, so wages cannot be theirs yet. ⭐ AN INVITATION, NEVER A PUNISHMENT and never a rule quoted at them: work is something they can keep, and keeping the pass is how. No jargon — not “account”, not “anonymous”.' },
  'work.keepCta': { kind: 'label', aim: 22, max: 30, note: 'The ONE button under the `keep` answer on the boss’s card, which opens the page where a pass is kept. ⚠️ a “no” with nothing to tap is where a newcomer puts the phone down, and this is the whole of the fix: a verb first, two to four words, no full stop, and short enough that it can never wrap on a 360-wide phone. It is the player’s own next step, not an instruction from anybody.' },
  'work.day': { kind: 'prose', aim: 50, max: 70, note: 'The quiet line when turning up at your own workplace marks the day. Said once a day at most. It should feel noticed, not announced.' },
  'locks.store': { kind: 'prose', aim: 70, max: 90, note: 'What the general store WILL be, said at a boarded front. Not what it is — it is a worksite. A shop worth waiting for, in one line.' },
  'locks.post': { kind: 'prose', aim: 70, max: 90, note: 'The same, for the post office.' },
  'locks.cafe': { kind: 'prose', aim: 70, max: 90, note: 'The same, for the Coffee Cup.' },
  'locks.story': { kind: 'prose', aim: 70, max: 90, note: 'The one line that says the STORY opens this door, not the town’s health and not money. It must read as a hook — something is coming — never as a refusal. Never a date, never a rate.' },
  'locks.step': { kind: 'prose', aim: 40, max: 60, holds: ['{n}', '{of}'], note: 'How far along the player is, MUST contain {n} and {of} (as in 2 and 4). A sign that only says no is a dead end; this is the half that makes it a quest hook.' },
  'rooms.condo': { kind: 'prose', aim: 60, max: 80, note: 'Said once, as a player steps into the Arcade: cabinets along one wall, a prize board, coins going in. ⚠️ IT IS THE PLACE TALKING, NOT A HELP STRING. The two room lines used to end with the same seven-word instruction about walking back onto the doorway, which made them the only tutorial voice left in the town — and the doorway is a LIT FLOOR TILE that already says it. So: what it is like to be standing in there. No instruction, and nothing about leaving.' },
  'rooms.store': { kind: 'prose', aim: 60, max: 80, note: 'The same, for stepping into the general store: Pip’s counter, shelves bare or full depending on the town. The place talking, in its own way — it must not share a clause, a rhythm or an ending with the arcade’s line, and it must not tell anybody how to leave.' },
  'rooms.in': { kind: 'prose', aim: 12, max: 16, note: 'The control on Pip’s shelf card that takes you into the shop. A BUTTON: a verb first, two or three words, no full stop. It must never wrap on a phone.' },
  'lowShut[]': { kind: 'prose', aim: 70, max: 90, note: 'Said when a player taps a shopfront THE TOWN has shut — not a one-day fault but a town too low to keep its doors open. It must point at the shared repair: hands in the square lift it and the doors come back. Never a number, never a rate, never a timetable, never a question.' },
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
  for (const f of ['hired', 'moved']) {
    const l = String(((data.work || {})[f]) || '');
    if (/(^|[.!?]\s+)\{where\}/.test(l)) say(`work.${f}`, '{where} sits at the start of a sentence — it is lowercase and carries its own article, so it must stay inside a clause', 'range');
  }
  // ⚠️ and the two rooms may not end with the same words: one repeated instruction read as a help
  // string rather than as either place talking
  const tail = (l) => String(l || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).slice(-4).join(' ');
  if ((data.rooms || {}).condo && tail((data.rooms || {}).condo) === tail((data.rooms || {}).store)) {
    say('rooms.store', 'ends with the same four words as rooms.condo — two rooms saying one sentence is a help string, not a place', 'range');
  }
  const objs = data.objects;
  if (!Array.isArray(objs) || objs.length !== CURSED_IDS.length) say('objects', `ten objects: ${CURSED_IDS.join(', ')}`);
  else objs.forEach((o, i) => { if (!o || o.id !== CURSED_IDS[i]) say(`objects[${i}].id`, `object ${i} must be "${CURSED_IDS[i]}" — the ids are fixed and in order`); });
  // a ghost must not ask the player anything (the player types nothing, ever)
  (data.ghosts || []).forEach((l, i) => { if (/\?\s*$/.test(String(l || ''))) say(`ghosts[${i}]`, 'ends in a question — nobody may ask the player one'); });
  return bad;
}
const lifeSchema = {
  type: 'object', additionalProperties: false, required: ['bands', 'store', 'board', 'merchant', 'vendor', 'ghosts', 'closed', 'lowShut', 'rooms', 'locks', 'work', 'objects', 'things', 'shutSign', 'forSale'],
  properties: {
    bands: { type: 'array', description: 'The five bands, worst first, keys fixed.', items: { type: 'object', additionalProperties: false, required: ['key', 'name', 'brings'],
      properties: { key: str(lifeFields['bands[].key'].note), name: str(lifeFields['bands[].name'].note), brings: str(lifeFields['bands[].brings'].note) } } },
    store: { type: 'object', additionalProperties: false, required: ['greet', 'shut', 'needs', 'van', 'sold'],
      properties: { greet: str(lifeFields['store.greet'].note), shut: str(lifeFields['store.shut'].note), needs: str(lifeFields['store.needs'].note), van: str(lifeFields['store.van'].note),
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
    work: { type: 'object', additionalProperties: false, required: ['at', 'ask', 'hired', 'moved', 'already', 'keep', 'keepCta', 'day', 'crate', 'stocked', 'full'], properties: {
      crate: { type: 'string', description: lifeFields['work.crate'].note },
      stocked: { type: 'string', description: lifeFields['work.stocked'].note },
      full: { type: 'string', description: lifeFields['work.full'].note },
      at: { type: 'object', additionalProperties: false, required: ['store', 'condo', 'cafe'], properties: {
        store: { type: 'string', description: lifeFields['work.at.store'].note },
        condo: { type: 'string', description: lifeFields['work.at.condo'].note },
        cafe: { type: 'string', description: lifeFields['work.at.cafe'].note },
      } },
      ask: { type: 'string', description: lifeFields['work.ask'].note },
      hired: { type: 'string', description: lifeFields['work.hired'].note },
      moved: { type: 'string', description: lifeFields['work.moved'].note },
      already: { type: 'string', description: lifeFields['work.already'].note },
      keep: { type: 'string', description: lifeFields['work.keep'].note },
      keepCta: { type: 'string', description: lifeFields['work.keepCta'].note },
      day: { type: 'string', description: lifeFields['work.day'].note },
    } },
    locks: { type: 'object', additionalProperties: false, required: ['store', 'post', 'cafe', 'story', 'step'], properties: {
      store: { type: 'string', description: lifeFields['locks.store'].note },
      post: { type: 'string', description: lifeFields['locks.post'].note },
      cafe: { type: 'string', description: lifeFields['locks.cafe'].note },
      story: { type: 'string', description: lifeFields['locks.story'].note },
      step: { type: 'string', description: lifeFields['locks.step'].note },
    } },
    rooms: { type: 'object', additionalProperties: false, required: ['condo', 'store', 'in'], properties: {
      condo: { type: 'string', description: lifeFields['rooms.condo'].note },
      store: { type: 'string', description: lifeFields['rooms.store'].note },
      in: { type: 'string', description: lifeFields['rooms.in'].note },
    } },
    objects: { type: 'array', description: 'The ten cursed objects, ids fixed and in order.', items: { type: 'object', additionalProperties: false, required: ['id', 'name', 'desc'],
      properties: { id: str(lifeFields['objects[].id'].note), name: str(lifeFields['objects[].name'].note), desc: str(lifeFields['objects[].desc'].note) } } },
    shutSign: str(lifeFields['shutSign'].note),
    forSale: str(lifeFields['forSale'].note),
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
  on: { kind: 'prose', aim: 58, max: 76, note: 'The town’s toast as the banana steps behind the counter and the tray rises: the apron going on. Not an instruction, not a greeting to anybody — a shift has started, and that is the whole feeling. Never a time, never a rate.' },
  off: { kind: 'prose', aim: 58, max: 76, note: 'The town’s toast as they step away, a beat before the receipt card opens. The work is over for now. Contented; never a summary and never a number — the receipt carries the number.' },
  'receipt.title': { kind: 'prose', aim: 16, max: 24, note: 'The receipt card’s heading. Two or three words, a NAME for the thing rather than a sentence.' },
  'receipt.take': { kind: 'prose', aim: 54, max: 72, holds: ['{n}'], note: 'The one measured line naming what the tips came to. MUST contain {n} — the game puts the coins there. ⚠️ a TOTAL is fine and a RATE is forbidden: no “per cup”, no “each”, no “an hour”.' },
  'receipt.line': { kind: 'prose', aim: 66, max: 88, note: 'The single line under the take: the terrace as you left it, the cups still warm, the quiet after a rush. It notices the ROOM, never the player’s performance, and never a number.' },
  'receipt.none': { kind: 'prose', aim: 62, max: 84, note: 'Shown INSTEAD of the take when the shift served nothing at all. Contented, never a telling-off — standing behind a counter on a slow afternoon is a perfectly good thing to have done.' },
  'receipt.capped': { kind: 'prose', aim: 66, max: 88, note: 'Shown INSTEAD of the take when cups WENT OUT but today’s tips are already spent — the work happened and the coins did not. ⚠️ it is not a refusal and not a telling-off: the day’s coin is done, the coffee was not for nothing. Never a number, never a cap, never “come back tomorrow” as an instruction.' },
  'receipt.best': { kind: 'prose', aim: 58, max: 78, holds: ['{drink}'], note: 'One line under the take, shown only when at least one cup came out RIGHT, naming it: MUST contain {drink} — the game puts the drink’s own name there. It notices the cup, not the player. Never a count, never a grade, never the word perfect.' },
  'receipt.back': { kind: 'label', aim: 12, max: 18, note: 'The button that closes the receipt. A VERB first, and short enough that it can never wrap onto two lines.' },
  'cup.perfect[]': { kind: 'prose', aim: 56, max: 76, note: 'A deck of 3–4 town toasts for a cup that came out right, one picked per cup. Notice the CUP, or the customer taking it — never praise the player, never say “perfect”. Warm, brief, a little pleased with itself.' },
  'cup.fine[]': { kind: 'prose', aim: 56, max: 76, note: 'A deck of 3–4 for a cup that is good enough, and out it goes. One notch down from the perfect deck: approving, never a correction, and never a hint about what would have been better.' },
  'cup.wrong[]': { kind: 'prose', aim: 56, max: 76, note: 'A deck of 3–4 for a cup that is not a good cup. It costs the sale and nothing else, so: no blame, no advice, no number, no “try again”. This world is fond of the people in it.' },
  left: { kind: 'prose', aim: 58, max: 78, note: 'The town’s toast when somebody has waited too long, turns their back and walks off. ⚠️ THEY HAVE NO NAME: the customers are bananas visiting the square from the rest of the town, strangers who came in off the road, so the line cannot name them and must not pretend to — “somebody”, “the one at the back”, the rope itself. A small sadness, not a failure notice; never how long they waited and never what it cost.' },
  front: { kind: 'prose', aim: 90, max: 120, note: 'What the Coffee Cup says when a player who does NOT work there taps it. ⚠️ it replaces a hand-written “Not built yet.” that shipped in code and was false — the café is open, Bean is behind it, and the counter is simply Bean’s until Bean hands it over. So: what the place IS, and that the counter belongs to somebody. It must not instruct and must not name a price or a condition — Bean’s own card is where a job is asked for.' },
  idle: { kind: 'prose', aim: 40, max: 54, note: 'The small line ON THE TRAY when you are behind the counter and there is nobody at the rope yet. ⚠️ it is the only thing on an otherwise empty tray, so it has a job: it tells the player the counter is working and simply quiet, rather than broken. Never a wait time and never “soon” — the mystery rule. Never an instruction either: not “wait for a customer”.' },
  'go.grind': { kind: 'label', aim: 8, max: 12, note: 'The word on the tray’s one button while the GRINDER is running: a needle sweeps a bar and the thumb stops it. A single word for the THING BEING DONE — it is a label on a control, not an instruction, so no “tap” and no “now”. Short enough that it can never wrap.' },
  'go.pour': { kind: 'label', aim: 8, max: 12, note: 'The same button while the POUR is running: hold it down and the cup fills, let go at the right moment. One word, the thing being done.' },
  'go.milk': { kind: 'label', aim: 8, max: 12, note: 'The same button at the MILK: three taps on a swelling pulse. One word, the thing being done.' },
  'drinks.short': { kind: 'label', aim: 10, max: 16, note: 'The smallest drink’s NAME, one or two words, for the receipt only — the ticket on the tray is pictures. It should sound like this town, not like a chain: nobody here says “grande”.' },
  'drinks.tall': { kind: 'label', aim: 10, max: 16, note: 'The middle drink’s name, same rules.' },
  'drinks.double': { kind: 'label', aim: 10, max: 16, note: 'The strongest drink’s name, same rules.' },
};
// 🤫 THE QUIET RULE HAS NO OTHER GUARD. Nothing in the client can stop a line that reads as a
// banana speaking, so the mechanical half is here: nobody may be asked a question, and the decks
// must be decks (one line repeated twice over a long shift is what a deck exists to prevent).
function cafeShape(data) {
  const bad = [];
  const say = (f, m) => bad.push([f, m]);
  for (const k of ['perfect', 'fine', 'wrong']) {
    const deck = ((data.cup || {})[k]) || [];
    if (deck.length < 3) say(`cup.${k}`, `a deck of at least 3 — one line twice in a shift is what a deck exists to prevent (got ${deck.length})`);
    deck.forEach((l, i) => { if (/\?\s*$/.test(String(l || ''))) say(`cup.${k}[${i}]`, 'ends in a question — nobody may ask the player one'); });
  }
  for (const f of ['on', 'off', 'left', 'front']) {
    if (/\?\s*$/.test(String(data[f] || ''))) say(f, 'ends in a question — nobody may ask the player one');
  }
  // ⚠️ the receipt's third and fourth lines exist BECAUSE a shift of ten cups was being told the cups
  // stayed dry, so the holder that carries the drink's name is not optional
  if (!String((data.receipt || {}).best || '').includes('{drink}')) say('receipt.best', 'must contain {drink} — the game puts the drink’s own name there');
  return bad;
}
const cafeSchema = {
  type: 'object', additionalProperties: false, required: ['on', 'off', 'idle', 'front', 'receipt', 'go', 'cup', 'left', 'drinks'],
  properties: {
    on: str(cafeFields.on.note),
    off: str(cafeFields.off.note),
    receipt: { type: 'object', additionalProperties: false, required: ['title', 'take', 'line', 'none', 'capped', 'best', 'back'],
      properties: { title: str(cafeFields['receipt.title'].note), take: str(cafeFields['receipt.take'].note), line: str(cafeFields['receipt.line'].note), none: str(cafeFields['receipt.none'].note), capped: str(cafeFields['receipt.capped'].note), best: str(cafeFields['receipt.best'].note), back: str(cafeFields['receipt.back'].note) } },
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
    drinks: { type: 'object', additionalProperties: false, required: ['short', 'tall', 'double'],
      properties: { short: str(cafeFields['drinks.short'].note), tall: str(cafeFields['drinks.tall'].note), double: str(cafeFields['drinks.double'].note) } },
  },
};

// --- town-dress ----------------------------------------------------------------
// 👕 THE CLOTHES SHOP (20 Sep 2026). A card with a mirror and three rails, and the one place in
// Banana World that is not a workplace, not a shop you buy from and not a game. Six strings and a
// tooltip. The shop runs wordless until this is approved, like every surface in this world.
const dressFields = {
  title: { kind: 'prose', aim: 18, max: 26, note: 'The heading at the top of the card: a NAME for the little room with the mirrors in it, two or three words, not a sentence. ⚠️ not the word on the plank outside — that already says CLOTHES.' },
  line: { kind: 'prose', aim: 64, max: 86, note: 'The one small line under the rails, and the only prose on the card. It notices the ROOM or the moment — the lamp, the mirrors, the quiet, nobody waiting — and never the player’s taste, never their outfit, never what to do next. ⚠️ nobody works here, so it may not welcome anybody, and nothing is sold here, so no word may smell of a till.' },
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
  const say = (f, m) => bad.push([f, m]);
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
  front: { kind: 'prose', aim: 84, max: 110, note: 'What the post office says when a player taps it. ⚠️ it replaces a hand-written line ending “Not built yet.”, which is no longer true — there is a mailbox in there with post in it. What the building IS, and that your post is inside. No instruction, no promise of anything that is not there, and no mention of postcards (not built).' },
  title: { kind: 'prose', aim: 16, max: 24, note: 'The heading on the mailbox card: a NAME for the place your letters sit, two or three words, not a sentence.' },
  empty: { kind: 'prose', aim: 78, max: 105, note: 'The whole of the card when there is no post at all. ⭐ THIS IS THE MOST-READ STRING IN THE JOB — an empty box is what most players will find for a long time, so it has to be a pleasant place to land rather than a failure. One or two short lines. It may not promise post is coming and may not tell anybody to go and write one.' },
  noaddress: { kind: 'prose', aim: 92, max: 120, note: 'The whole of the card for a player with NO ADDRESS YET. A mailbox is keyed to the homestead’s sign name, so somebody who has never claimed a yard has nowhere for a letter to land. ⚠️ NOT the same as the counter being closed — it used to print that line, which is a lie: the post office is fine and the player has no door. ⭐ A DOOR, NOT A REFUSAL, the same rule as a locked garment on the dressing-room rail: post goes to a house, this player has not put a name on one, and the HOMESTEAD is where that is fixed. No instruction ("go and claim one"), no promise that post is waiting, and nothing that suggests they did something wrong.' },
  shut: { kind: 'prose', aim: 66, max: 90, note: 'Replaces the letters when the post is not running at all. An ordinary, temporary thing — the counter is closed. Not an error and not an apology. Never “server”, never “down”, never “error”, never a time.' },
  from: { kind: 'label', aim: 10, max: 18, holds: ['{who}'], note: 'The small label over who a letter came from. One or two words, MUST contain {who} — the game puts the sender’s name there.' },
  threads: { kind: 'label', aim: 10, max: 16, note: 'The small heading over the older post, under the new envelopes. Under it is one row per PERSON you have letters from, not one row per letter — sixty letters from eight people is eight rows. One or two words, the way you would label a drawer of kept correspondence. Set in capitals by the stylesheet.' },
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
  refused: { kind: 'prose', aim: 78, max: 105, note: '⭐ THE HARDEST LINE IN THE JOB. What the writer sees when the filter stops their letter. It must be KIND, FINAL and COMPLETELY UNINFORMATIVE: it names no rule, no word and no reason, and it does not suggest what to change — a precise reason is a lesson in getting round the filter next time. It must also not sound like an accusation, because most people who ever see this typed something perfectly ordinary and were caught by a shop’s name or a phone number.' },
};
// 🤐 THE REFUSAL MAY NOT TEACH. A machine cannot judge kindness, but it can judge whether a line has
// started naming the rules — which is the exact failure this string has.
const POST_TELLS = /\b(link|url|website|web address|email|e-mail|phone|number|address|handle|username|discord|snapchat|instagram|contact|swear|word|rude|filter|blocked|banned|violat|policy|rule)\b/i;
function postShape(data) {
  const bad = [];
  const say = (f, m) => bad.push([f, m]);
  if (POST_TELLS.test(String(data.refused || ''))) say('refused', 'names what was wrong with the letter — a refusal that teaches is a lesson in getting round the filter next time');
  for (const f of ['empty', 'noaddress', 'shut', 'reported', 'sent', 'refused', 'front']) {
    if (/\?\s*$/.test(String(data[f] || ''))) say(f, 'ends in a question — nobody may ask the player one');
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
  if (String(card.sent || '').trim().toLowerCase() === String(data.sent || '').trim().toLowerCase()) {
    say('card.sent', 'is the letter’s own line — a card and a letter are two different things happening');
  }
  // ⚠️ the mystery rule: this world never publishes its own timetables or its caps
  for (const [f, v] of Object.entries(data)) {
    if (typeof v === 'string' && /\b\d+\s*(letters?|a day|per day|days?|hours?|minutes?)\b/i.test(v)) say(f, 'publishes a cap or a timetable — this world does not');
  }
  return bad;
}
const postSchema = {
  type: 'object', additionalProperties: false,
  required: ['front', 'title', 'empty', 'noaddress', 'shut', 'from', 'threads', 'back', 'report', 'reported', 'reply', 'sheet', 'send', 'sent', 'refused', 'card', 'folk'],
  properties: {
    ...Object.fromEntries(Object.entries(postFields).filter(([k]) => !k.startsWith('card.') && !k.startsWith('folk.')).map(([k, v]) => [k, str(v.note)])),
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
  line: { kind: 'prose', aim: 62, max: 84, note: 'The one small line under the tiles, and the only prose on the first screen. It notices the kiosk or the PAPER — the rack, the fold marks, the pin holes, the counter. ⚠️ it may not instruct (no “tap”, no “zoom”, no “drag”) and may not list what the maps are, because the tiles are pictures of the places and already say.' },
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
  const say = (f, m) => bad.push([f, m]);
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
  const say = (f, m) => bad.push([f, m]);
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

export const JOBS = {
  'town-life': {
    id: 'town-life',
    title: 'Banana Town — the town’s life',
    what: 'The notice board’s word for each band, Pip’s counter, the travelling stall, the night vendor, the ghosts, the closed-today notes and the cursed objects.',
    brief: 'tools/copy-briefs/town-life.md',
    out: 'tools/copy-out/town-life.json',
    approved: 'src/data/copy/town-life.json',
    reads: 'src/scripts/town-room.js (through a glob: the town runs wordless until this is approved)',
    top: ['bands', 'store', 'board', 'merchant', 'vendor', 'ghosts', 'closed', 'lowShut', 'rooms', 'locks', 'work', 'objects', 'things', 'shutSign', 'forSale'],
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
    what: 'What the building says, the mailbox card, an open letter, writing back, and the refusal that may not say why.',
    brief: 'tools/copy-briefs/town-post.md',
    out: 'tools/copy-out/town-post.json',
    approved: 'src/data/copy/town-post.json',
    reads: 'src/scripts/town-post.js (through a glob inside the post office’s own lazy chunk)',
    top: ['front', 'title', 'empty', 'noaddress', 'shut', 'from', 'threads', 'back', 'report', 'reported', 'reply', 'sheet', 'send', 'sent', 'refused', 'card', 'folk'],
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
  'town-cafe': {
    id: 'town-cafe',
    title: 'Banana Town — the Coffee Cup’s counter',
    what: 'Stepping behind the counter and stepping away, what the front says to a stranger, the receipt, the three decks for a cup well or badly made, the one who gives up, and the three drinks’ names.',
    brief: 'tools/copy-briefs/town-cafe.md',
    out: 'tools/copy-out/town-cafe.json',
    approved: 'src/data/copy/town-cafe.json',
    reads: 'src/scripts/town-cafe.js (through a glob inside the café’s own lazy chunk, so town-room never carries these bytes)',
    top: ['on', 'off', 'idle', 'front', 'receipt', 'go', 'cup', 'left', 'drinks'],
    // 🧍 Bean speaks here, so the writer gets the bible
    personas: 'town-personas',
    fields: cafeFields,
    shape: cafeShape,
    schema: cafeSchema,
  },
  'town-personas': {
    id: 'town-personas',
    title: 'Banana Town — who the nine residents are',
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
    title: 'Banana Town — the nine residents',
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
  'homestead-post': {
    id: 'homestead-post',
    title: 'The homestead — the world’s post',
    what: 'The letters the town’s residents send to a player’s mailbox, and the two lines on the card.',
    brief: 'tools/copy-briefs/homestead-post.md',
    out: 'tools/copy-out/homestead-post.json',
    approved: 'src/data/copy/homestead-post.json',
    reads: 'src/scripts/banana-homestead.js',
    top: ['title', 'empty', 'letters', 'wage'],
    fields: {
      'title': { kind: 'prose', aim: 12, max: 18, note: 'The card’s heading when the mailbox is opened. Two or three words.' },
      'empty': { kind: 'prose', aim: 50, max: 70, note: 'Shown when there is no post at all: the box is empty today. Warm, never sad, never a promise about when something will come.' },
      'wage.from': { kind: 'prose', aim: 14, max: 20, note: 'Who signs the pay letter: Nib, who keeps the town’s big book and is its payroll desk.' },
      'wage.line': { kind: 'prose', aim: 110, max: 140, holds: ['{n}'], note: '⭐ THE CHEQUE, and the first thing in this world that ever ARRIVES WHILE THE PLAYER WAS NOT LOOKING. It is for a week of work that has finished, and MUST contain {n}, the coins. Say it as a clerk filing a thing that is already done — warm, dry, done. ⚠️ never a rate, never a day of the week, never “per” anything, and never a promise about next week: the town does not publish a timetable. At most 140 characters.' },
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
    shape: () => [],
    schema: { type: 'object', additionalProperties: false, required: ['title', 'empty', 'letters', 'wage'], properties: {
      title: { type: 'string', description: 'The card’s heading when the mailbox is opened.' },
      empty: { type: 'string', description: 'Shown when there is no post.' },
      wage: { type: 'object', additionalProperties: false, required: ['from', 'line'], properties: { from: { type: 'string', description: 'Who signed the pay letter.' }, line: { type: 'string', description: 'The pay letter, holding {n} coins.' } } },
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
