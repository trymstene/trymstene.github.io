// ✉️📊 THE POST OFFICE, COUNTED (1 Oct 2026). Trym: "im just a bit curious about the 'vibe' people are using it for -
// as i want this place to be feelgood and warm … and ofcourse which users are communicating with eachother to
// understand if users are actually using this as the social layer its ment to be". And, first: "i totally respect the
// privacy".
//
// ⚠️ NOBODY READS A LETTER HERE. A mailbox labels its own letters' tone INSIDE its room (toneOf, called by the
// room's /tally) and hands out only the label; tally() turns the labels and the who-wrote-to-which-house stamps into
// counts. No words leave a mailbox and no name leaves this module: a conversation is "A ↔ B", never two names.
// The privacy page says exactly this ("Letters").

// what makes a letter warm: hellos, thanks, praise, laughs and hearts, in the languages the site speaks
// ⚠️ a word that is also an everyday word elsewhere is left out ("ty" is Polish for "you", "kind" German for "child")
const WARM_WORDS = [
  'hi', 'hello', 'hey', 'heya', 'hiya', 'howdy', 'yo', 'hei', 'hallo', 'hola', 'ciao', 'salut', 'bonjour', 'olá',
  'hej', 'moin', 'cześć', 'czesc', 'привет', 'welcome', 'velkommen', 'willkommen', 'bienvenue', 'bienvenido', 'benvenuto',
  'thanks', 'thank', 'thx', 'tysm', 'takk', 'danke', 'merci', 'gracias', 'grazie', 'obrigado', 'obrigada',
  'dziękuję', 'dzieki', 'dzięki', 'спасибо', 'bedankt', 'dank',
  'love', 'lovely', 'nice', 'cute', 'cool', 'awesome', 'amazing', 'great', 'beautiful', 'sweet', 'happy', 'glad',
  'yay', 'congrats', 'congratulations', 'gratulerer', 'friend', 'friends', 'buddy', 'pal', 'neighbour', 'neighbor',
  'enjoy', 'fun', 'wow', 'proud', 'hug', 'hugs', 'xoxo', 'haha', 'hahaha', 'hehe', 'lol', 'xd', 'gg',
  'flott', 'kos', 'koselig', 'hyggelig', 'nydelig', 'søt', 'digg', 'kult', 'venn', 'vennen', 'elsker',
  'schön', 'toll', 'lieb', 'freund', 'genial', 'amigo', 'amiga', 'bonito', 'bonita', 'mignon', 'ami', 'amie', 'bello',
  'bella', 'leuk', 'mooi', 'vriend', 'fajnie', 'super', 'супер', 'друг', 'круто',
];
const WARM_PHRASES = ['good luck', 'good morning', 'good night', 'have a nice', 'have a great', 'have a good',
  'have a lovely', 'miss you', 'see you', 'thank you', 'god morgen', 'god natt', 'lykke til', 'ha en fin',
  'glad i deg'];
const WARM_SIGNS = /❤|♥|💛|💕|💖|💗|💙|💚|💜|🧡|🤍|😊|🙂|😀|😃|😄|😁|😆|🥰|😍|😘|🤗|✨|🎉|🌸|🌻|🍌|👋|😂|🤣|👍|💐|☺|:\)|:-\)|:d\b|;\)|\(:|\^\^|<3|ありがとう|こんにちは|かわいい|감사|고마워|안녕/u;
// what makes it unkind: an insult, or words aimed to push somebody away. The check refuses the worst before delivery,
// so what is left here is what a word filter cannot see.
const UNKIND_WORDS = ['idiot', 'idiots', 'stupid', 'dumb', 'loser', 'moron', 'ugly', 'pathetic', 'disgusting', 'creep',
  'freak', 'kys', 'dumm', 'blöd', 'idiota', 'idioot', 'stupido', 'estúpido', 'estupido', 'tonto', 'tonta', 'dum', 'teit',
  'drittsekk', 'tufs', 'дурак', 'тупой', 'идиот'];
const UNKIND_PHRASES = ['shut up', 'go away', 'get lost', 'leave me alone', 'hate you', 'you suck', 'nobody likes you',
  'hold kjeft', 'stikk av', 'hater deg', 'halt die klappe', 'hasse dich', 'cállate', 'callate', 'te odio',
  'ta gueule', 'je te déteste', 'stai zitto'];
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (list) => new RegExp('(?:^|[^\\p{L}\\p{N}])(?:' + list.map(esc).join('|') + ')(?=$|[^\\p{L}\\p{N}])', 'u');
const WARM_RE = words(WARM_WORDS);
const UNKIND_RE = words(UNKIND_WORDS);

// a letter's tone, read inside its own mailbox: 'warm', 'unkind' or 'neutral'. A letter with both reads as neutral,
// because "haha you idiot ❤" between two friends is not a fight.
export function toneOf(text) {
  const t = String(text || '').toLowerCase();
  const warm = WARM_RE.test(t) || WARM_SIGNS.test(t) || WARM_PHRASES.some((p) => t.includes(p));
  const unkind = UNKIND_RE.test(t) || UNKIND_PHRASES.some((p) => t.includes(p));
  return warm && !unkind ? 'warm' : unkind && !warm ? 'unkind' : 'neutral';
}

// Trym's own homestead and the test farms: left out, as the census leaves them out
export const qaHome = (slug) => /^testy(-|$)/.test(slug || '') || slug === 'trym';

const HOUR = 3600000, DAY = 86400000, WEEK = 7 * DAY;
const dayOf = (t) => new Date(t).toISOString().slice(0, 10);

// boxes: [{ slug, open, letters: [{from, at, kind, tone, read, knock, flag}], refused: [{at, from, why}], reported: [{at}] }]
// yards: { slug: { created, seen } } — every homestead, and when its owner was last about
export function tally(boxes, yards, now, days = 30) {
  const since = now - days * DAY;
  const seen = {};
  for (const [s, y] of Object.entries(yards || {})) seen[s] = +(y && y.seen) || 0;
  const posts = [];
  let notes = 0, flagged = 0, reported = 0, waiting = 0;
  const stopped = { words: 0, contact: 0, other: 0 };
  const stoppedBy = new Set();
  for (const b of boxes) {
    if (b.open && b.slug in seen) seen[b.slug] = Math.max(seen[b.slug], +b.open || 0);   // read the post in the town
    for (const l of b.letters || []) {
      if (!(l.at >= since)) continue;
      if (l.kind === 'note') { notes++; continue; }
      if (qaHome(l.from)) continue;
      if (l.flag) flagged++;
      if (l.knock) waiting++;
      posts.push({ from: l.from, to: b.slug, at: l.at, card: l.kind === 'card', tone: l.tone, read: !!l.read, knock: !!l.knock });
    }
    for (const r of b.refused || []) {
      if (!(r.at >= since) || qaHome(r.from)) continue;
      stopped[r.why === 'words' || r.why === 'contact' ? r.why : 'other']++;
      if (r.from) stoppedBy.add(r.from);
    }
    for (const r of b.reported || []) if (r.at >= since) reported++;
  }
  posts.sort((a, b) => a.at - b.at);

  const letters = posts.filter((p) => !p.card);
  const tone = { warm: 0, neutral: 0, unkind: 0 };
  for (const l of letters) tone[l.tone in tone ? l.tone : 'neutral']++;

  // the pairs: who wrote to whom, either way round (a pair is A ↔ B)
  const pairs = new Map();
  for (const p of posts) {
    const [a, b] = p.from < p.to ? [p.from, p.to] : [p.to, p.from];
    const k = a + '|' + b;
    (pairs.get(k) || pairs.set(k, { a, b, list: [] }).get(k)).list.push(p);
  }
  // an answer: any post back from the reader inside a week (a postcard answers too). The rate only asks of post
  // that has had its whole week, or the newest letters would read as ignored.
  const replyMs = [];
  let cohort = 0, answered = 0;
  const shapes = [];
  for (const e of pairs.values()) {
    const L = e.list;
    let turns = 0, last = '', ab = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (p.from !== last) { turns++; last = p.from; }
      if (p.from === e.a) ab++;
      let back = null;
      for (let j = i + 1; j < L.length && L[j].at - p.at <= WEEK; j++) if (L[j].from === p.to) { back = L[j]; break; }
      if (back) replyMs.push(back.at - p.at);
      if (now - p.at >= WEEK) { cohort++; if (back) answered++; }
    }
    shapes.push({ a: e.a, b: e.b, n: L.length, ab, ba: L.length - ab, turns, first: L[0].at, last: L[L.length - 1].at });
  }
  replyMs.sort((x, y) => x - y);
  const both = shapes.filter((s) => s.ab && s.ba);

  // the longest conversations, as shapes with letters for names: the same house keeps the same letter, so a
  // house that writes with three others shows as A three times, and still nobody is named
  const tag = new Map();
  const T = (slug) => tag.get(slug) || tag.set(slug, String.fromCharCode(65 + tag.size)).get(slug);
  const longest = both.slice().sort((x, y) => y.turns - x.turns || y.n - x.n || y.last - x.last).slice(0, 5)
    .map((s) => ({ a: T(s.a), b: T(s.b), n: s.n, turns: s.turns, ways: [s.ab, s.ba], days: Math.max(1, Math.ceil((s.last - s.first) / DAY)) }));

  // the biggest circle: houses joined by post, either way, however many hands it passes through
  const up = new Map();
  const find = (x) => { let r = x; while (up.get(r) !== r) r = up.get(r); up.set(x, r); return r; };
  for (const s of shapes) {
    for (const v of [s.a, s.b]) if (!up.has(v)) up.set(v, v);
    up.set(find(s.a), find(s.b));
  }
  const size = new Map();
  for (const v of up.keys()) { const r = find(v); size.set(r, (size.get(r) || 0) + 1); }

  // opened: post more than a day old that was let in (a knock waits for the reader to let its house in first)
  const openable = posts.filter((p) => !p.knock && now - p.at > DAY);

  // ⭐ the value question, with its caveat said on the card: did the people who got post come back after it, and
  // are homes that get post still about more often than homes that do not? (Both groups only counts homes old
  // enough to have had a week.)
  const firstIn = new Map();
  for (const p of posts) if (!firstIn.has(p.to)) firstIn.set(p.to, p.at);
  let cameBack = 0;
  for (const [slug, at] of firstIn) if ((seen[slug] || 0) > at + HOUR) cameBack++;
  const old = Object.entries(yards || {}).filter(([, y]) => (+(y && y.created) || 0) < now - WEEK);
  const about = (rows) => ({ n: rows.length, about: rows.filter(([s]) => (seen[s] || 0) > now - WEEK).length });

  // day by day, every day in the window (a quiet day is a 0, never a gap — a gap makes the chart lie)
  const perDay = [];
  const byDay = new Map();
  for (let t = Date.parse(dayOf(since) + 'T00:00:00Z'); t <= now; t += DAY) {
    const row = { d: dayOf(t), letters: 0, cards: 0, warm: 0, unkind: 0 };
    perDay.push(row);
    byDay.set(row.d, row);
  }
  for (const p of posts) {
    const row = byDay.get(dayOf(p.at));
    if (!row) continue;
    if (p.card) row.cards++;
    else { row.letters++; if (p.tone === 'warm') row.warm++; else if (p.tone === 'unkind') row.unkind++; }
  }

  return {
    days, at: now,
    posts: posts.length, letters: letters.length, cards: posts.length - letters.length, notes,
    tone, flagged, stopped, stoppedBy: stoppedBy.size, reported,
    writers: new Set(posts.map((p) => p.from)).size, receivers: firstIn.size,
    people: up.size, pairs: pairs.size, penPals: both.length, circle: Math.max(0, ...size.values()),
    replies: { cohort, answered, n: replyMs.length, medianH: replyMs.length ? Math.round(replyMs[Math.floor(replyMs.length / 2)] / HOUR * 10) / 10 : null },
    opened: openable.filter((p) => p.read).length, openable: openable.length, waiting,
    longest,
    value: { gotPost: firstIn.size, cameBack,
      withPost: about(old.filter(([s]) => firstIn.has(s))), without: about(old.filter(([s]) => !firstIn.has(s))) },
    perDay,
  };
}
