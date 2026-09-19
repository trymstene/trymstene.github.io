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
  'closed[]': { kind: 'prose', aim: 70, max: 90, note: 'Why a kiosk is shut today, the way a note on a door reads. Something a person could put right.' },
  'locks.store': { kind: 'prose', aim: 70, max: 90, note: 'What the general store WILL be, said at a boarded front. Not what it is — it is a worksite. A shop worth waiting for, in one line.' },
  'locks.post': { kind: 'prose', aim: 70, max: 90, note: 'The same, for the post office.' },
  'locks.cafe': { kind: 'prose', aim: 70, max: 90, note: 'The same, for the Coffee Cup.' },
  'locks.story': { kind: 'prose', aim: 70, max: 90, note: 'The one line that says the STORY opens this door, not the town’s health and not money. It must read as a hook — something is coming — never as a refusal. Never a date, never a rate.' },
  'locks.step': { kind: 'prose', aim: 40, max: 60, holds: ['{n}', '{of}'], note: 'How far along the player is, MUST contain {n} and {of} (as in 2 and 4). A sign that only says no is a dead end; this is the half that makes it a quest hook.' },
  'rooms.condo': { kind: 'prose', aim: 60, max: 80, note: 'Said once, as a player steps into the Arcade. Name the place and say how to leave — there is no close button: you walk back onto the doorway you came in by.' },
  'rooms.store': { kind: 'prose', aim: 60, max: 80, note: 'The same, for stepping into the general store. Pip’s counter is inside; the shelves are bare or full depending on the town. Name the place and say how to leave.' },
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
  for (const [path, list, min] of [['store.sold', data.store && data.store.sold, 3], ['merchant.lines', data.merchant && data.merchant.lines, 3], ['vendor.lines', data.vendor && data.vendor.lines, 3], ['ghosts', data.ghosts, 4], ['closed', data.closed, 4], ['lowShut', data.lowShut, 3]]) {
    if (!Array.isArray(list) || list.length < min) say(path, `at least ${min}`);
  }
  for (const [path, v] of [['store.sold', data.store && data.store.sold], ['vendor.bought', data.vendor && [data.vendor.bought]]]) {
    (v || []).forEach((l, i) => { if (!String(l || '').includes('{item}')) say(`${path}[${i}]`, 'must contain {item} — the game puts the thing there'); });
  }
  const objs = data.objects;
  if (!Array.isArray(objs) || objs.length !== CURSED_IDS.length) say('objects', `ten objects: ${CURSED_IDS.join(', ')}`);
  else objs.forEach((o, i) => { if (!o || o.id !== CURSED_IDS[i]) say(`objects[${i}].id`, `object ${i} must be "${CURSED_IDS[i]}" — the ids are fixed and in order`); });
  // a ghost must not ask the player anything (the player types nothing, ever)
  (data.ghosts || []).forEach((l, i) => { if (/\?\s*$/.test(String(l || ''))) say(`ghosts[${i}]`, 'ends in a question — nobody may ask the player one'); });
  return bad;
}
const lifeSchema = {
  type: 'object', additionalProperties: false, required: ['bands', 'store', 'board', 'merchant', 'vendor', 'ghosts', 'closed', 'lowShut', 'rooms', 'locks', 'objects', 'things', 'shutSign', 'forSale'],
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
    closed: { type: 'array', description: lifeFields['closed[]'].note, items: { type: 'string' } },
    lowShut: { type: 'array', description: lifeFields['lowShut[]'].note, items: { type: 'string' } },
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

export const JOBS = {
  'town-life': {
    id: 'town-life',
    title: 'Banana Town — the town’s life',
    what: 'The notice board’s word for each band, Pip’s counter, the travelling stall, the night vendor, the ghosts, the closed-today notes and the cursed objects.',
    brief: 'tools/copy-briefs/town-life.md',
    out: 'tools/copy-out/town-life.json',
    approved: 'src/data/copy/town-life.json',
    reads: 'src/scripts/town-room.js (through a glob: the town runs wordless until this is approved)',
    top: ['bands', 'store', 'board', 'merchant', 'vendor', 'ghosts', 'closed', 'lowShut', 'rooms', 'locks', 'objects', 'things', 'shutSign', 'forSale'],
    // ✅ approved by Trym 14 Sep 2026 ("approve town-life")
    // 🧍 Pip speaks here, so the writer gets the bible
    personas: 'town-personas',
    fields: lifeFields,
    shape: lifeShape,
    schema: lifeSchema,
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
    top: ['title', 'empty', 'letters'],
    fields: {
      'title': { kind: 'prose', aim: 12, max: 18, note: 'The card’s heading when the mailbox is opened. Two or three words.' },
      'empty': { kind: 'prose', aim: 50, max: 70, note: 'Shown when there is no post at all: the box is empty today. Warm, never sad, never a promise about when something will come.' },
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
    schema: { type: 'object', additionalProperties: false, required: ['title', 'empty', 'letters'], properties: {
      title: { type: 'string', description: 'The card’s heading when the mailbox is opened.' },
      empty: { type: 'string', description: 'Shown when there is no post.' },
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
