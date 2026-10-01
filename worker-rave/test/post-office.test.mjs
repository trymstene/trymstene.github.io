// ✉️📊 THE POST OFFICE'S COUNT (1 Oct 2026) — a letter's tone label, a box's read-only tally, the office's lap over
// every mailbox and the numbers Banana HQ draws. ⚠️ The promise under test is the privacy page's: the check counts
// how friendly the post is — a number, never the words. No text and no name may leave a mailbox or the office.
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const worker = await import('../src/index.js');
const { PostRoom, YardRoom } = worker;
const { toneOf, tally, qaHome } = await import('../src/post-tally.js');

function fakeState() {
  const m = new Map();
  let alarm = null;
  return {
    storage: {
      async get(k) {
        if (Array.isArray(k)) return new Map(k.filter((x) => m.has(x)).map((x) => [x, structuredClone(m.get(x))]));
        return m.has(k) ? structuredClone(m.get(k)) : undefined;
      },
      async put(k, v) { m.set(k, structuredClone(v)); },
      async delete(k) { m.delete(k); },
      async list(opts = {}) { const p = opts.prefix || ''; return new Map([...m.entries()].filter(([k]) => k.startsWith(p)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, structuredClone(v)])); },
      async getAlarm() { return alarm; },
      async setAlarm(t) { alarm = t; },
      async deleteAlarm() { alarm = null; },
    },
    _m: m, takeAlarm() { const a = alarm; alarm = null; return a; },
    getWebSockets: () => [], setWebSocketAutoResponse() {}, acceptWebSocket() {},
  };
}
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const post = (room, path, body) => room.fetch(new Request('https://room' + path, { method: 'POST', body: JSON.stringify(body || {}) }));
const jsonOf = async (res) => { try { return JSON.parse(await res.text()); } catch (e) { return {}; } };
const HOUR = 3600000, DAY = 86400000;

console.log('\n✉️📊  the post office');

// ── the tone label ───────────────────────────────────────────────────────────────────────────────
{
  const warm = ['Hi! Your sunflowers are enormous.', 'takk for brevet!', 'Danke schön, Nachbar', 'merci beaucoup',
    'love the farm ❤', 'haha nice one', 'see you at the rave :)', 'Привет, друг', 'gg on the arcade'];
  const unkind = ['your farm is ugly', 'shut up', 'you are stupid', 'hold kjeft', 'go away and leave me alone'];
  const neutral = ['I planted carrots today.', 'what time is the rave', 'this is a thing which happens', 'haha you idiot ❤',
    'a dumbbell and some stupidity', ''];
  ok('warm letters read warm, in several languages', warm.every((t) => toneOf(t) === 'warm'), warm.map((t) => [t, toneOf(t)]).filter(([, v]) => v !== 'warm'));
  ok('unkind letters read unkind', unkind.every((t) => toneOf(t) === 'unkind'), unkind.map((t) => [t, toneOf(t)]).filter(([, v]) => v !== 'unkind'));
  ok('plain letters, mixed ones and words INSIDE words read neutral', neutral.every((t) => toneOf(t) === 'neutral'), neutral.map((t) => [t, toneOf(t)]).filter(([, v]) => v !== 'neutral'));
  ok('Trym’s homestead and the test farms are QA', qaHome('trym') && qaHome('testy-proof-1') && qaHome('testy') && !qaHome('trymmy') && !qaHome('ada'));
}

// ── a box's tally: counts and labels, never words ────────────────────────────────────────────────
{
  const room = new PostRoom(fakeState(), {});
  await post(room, '/sent', { to: 'ada-acres' });   // the box knows Ada: her post comes straight in
  await post(room, '/send', { from: 'ada-acres', text: 'Hello neighbour! Your hens look lovely.' });
  await post(room, '/send', { from: 'ada-acres', text: 'one more, for the desk' });
  await post(room, '/send', { from: 'bob-barn', text: 'your farm is ugly' });   // a stranger: it knocks
  await post(room, '/send', { from: 'ada-acres', card: { tpl: 'park', line: 0, look: {} } });
  await post(room, '/send', { from: 'cy-corner', text: 'add me on snap: cy.corner99' });   // refused at the door
  const rep = [...(await room.state.storage.list({ prefix: 'L:' })).values()].find((x) => x.text === 'one more, for the desk');
  await post(room, '/report', { id: rep.id, __box: 'me' });
  const before = [...room.state._m.keys()].sort().join(',');
  const t = await jsonOf(await post(room, '/tally'));
  const after = [...room.state._m.keys()].sort().join(',');
  ok('⭐ /tally writes nothing: no resident’s note, no expiry, no stamp', before === after, { before, after });
  const raw = JSON.stringify(t);
  ok('⭐ no words leave the box', !/neighbour|hens|ugly|snap|corner99|lovely|desk/i.test(raw), raw);
  ok('…and no names or houses either', !/"name"|"house"|"text"|"card":\{/.test(raw), raw);
  const kinds = (t.letters || []).map((l) => l.kind + ':' + (l.tone || '-')).sort();
  ok('each piece of post is a kind and a tone label', JSON.stringify(kinds) === JSON.stringify(['card:-', 'letter:unkind', 'letter:warm']), kinds);
  ok('the stranger’s letter is counted as a knock', (t.letters || []).some((l) => l.from === 'bob-barn' && l.knock && l.tone === 'unkind'), t.letters);
  ok('the refusal is counted with its reason', (t.refused || []).length === 1 && t.refused[0].why === 'contact' && t.refused[0].from === 'cy-corner', t.refused);
  ok('the report is counted, and only when', (t.reported || []).length === 1 && Object.keys(t.reported[0]).join() === 'at', t.reported);
}
{
  // ✉️ /box stamps when the owner last opened it, at most once an hour
  const room = new PostRoom(fakeState(), {});
  await post(room, '/box', { __box: 'zed' });
  const first = await room.state.storage.get('open');
  await post(room, '/box', { __box: 'zed', peek: 1 });
  ok('opening the box stamps "open", once an hour', first > 0 && (await room.state.storage.get('open')) === first);
  ok('…and /tally hands the stamp out', (await jsonOf(await post(room, '/tally'))).open === first);
}

// ── the rail: /tally and /office are not on it; /post-stats is behind the key ─────────────────────
{
  const stub = { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('{"stats":null}') }) };
  const env = { POST_OFF: '0', ALLOWED_ORIGIN: 'https://trymstene.com', RAVE: stub, POST: stub, YARDS: stub };
  const call = (path, e) => worker.default.fetch(new Request('https://banana-rave.example' + path, { headers: { Origin: 'https://trymstene.com' } }), e || env);
  for (const p of ['/post/tally?slug=ada', '/post/office?slug=ada'])
    ok('⭐ ' + p.split('?')[0] + ' is not on the public rail', (await call(p)).status === 404);
  ok('/post-stats without a key is nothing', (await call('/post-stats')).status === 404);
  ok('/post-stats with no POST_ADMIN_KEY set is nothing (fails closed)', (await call('/post-stats?key=x')).status === 404);
  ok('/post-stats with the wrong key is nothing', (await call('/post-stats?key=nope', { ...env, POST_ADMIN_KEY: 'right' })).status === 404);
  const r = await call('/post-stats?key=right', { ...env, POST_ADMIN_KEY: 'right\n' });
  ok('/post-stats with the key reaches the office', r.status === 200 && 'stats' in (await jsonOf(r)));
}

// ── the neighbourhood's list of homes ────────────────────────────────────────────────────────────
{
  const st = fakeState();
  const yard = new YardRoom(st, { MEMBER_HMAC: 'x' });
  const now = Date.now();
  await st.storage.put('y:plum-farm', { slug: 'plum-farm', name: 'Plum', pass: 'aaaa0000ffffffff', created: now - 40 * DAY, updated: now - 9 * DAY, seen: now - 8 * DAY });
  await st.storage.put('seen:plum-farm', now - 2 * DAY);
  await st.storage.put('y:old-plum', { alias: 'plum-farm' });
  await st.storage.put('y:testy-proof-9', { slug: 'testy-proof-9', created: now, updated: now });
  await st.storage.put('y:trym', { slug: 'trym', created: now, updated: now });
  const q = (headers) => yard.fetch(new Request('https://room/post-yards', { headers })).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  ok('without the internal header the list does not exist', (await q({})).status === 404);
  const r = await q({ 'x-internal': '1' });
  ok('the internal caller gets every real home, no alias, no test farm', JSON.stringify(Object.keys(r.yards || {})) === '["plum-farm"]', r);
  ok('"seen" is the newest of the yard’s own stamps', r.yards && r.yards['plum-farm'].seen === now - 2 * DAY, r.yards);
  ok('…and nothing else about the home leaves', r.yards && JSON.stringify(Object.keys(r.yards['plum-farm']).sort()) === '["created","seen"]', r.yards);
}

// ── the office's lap: forty boxes a tick, every box counted once, nothing named ───────────────────
{
  const now = Date.now();
  const HOMES = Array.from({ length: 95 }, (_, i) => 'plum-' + String(i).padStart(3, '0') + '-farm');
  const yards = Object.fromEntries(HOMES.map((s, i) => [s, { created: now - 40 * DAY, seen: i < 10 ? now - DAY : now - 20 * DAY }]));
  let calls = 0;
  const rooms = new Map();
  const env = {};
  env.YARDS = { idFromName: (n) => n, get: () => ({ fetch: async (req) => { calls++; return new Response(JSON.stringify(new URL(req.url).pathname === '/post-yards' && req.headers.get('x-internal') === '1' ? { yards } : { err: 'no' })); } }) };
  env.POST = {
    idFromName: (n) => n,
    get: (n) => {
      if (!rooms.has(n)) rooms.set(n, new PostRoom(fakeState(), env));
      const room = rooms.get(n);
      return { fetch: async (req) => { calls++; return room.fetch(req); } };
    },
  };
  const box = (slug) => { env.POST.get('box:' + slug); return rooms.get('box:' + slug); };
  // three homes write: 000 ↔ 001 back and forth, 002 → 000 once, and 003 sends 001 a postcard
  const at = (room, from, text, tAt) => room.state.storage.put('L:' + tAt.toString(36) + from, { id: tAt.toString(36) + from, from, at: tAt, text, read: true, flag: '' });
  const [a, b, c, d] = HOMES;
  await at(box(b), a, 'Hi there, lovely farm!', now - 20 * DAY);
  await at(box(a), b, 'Thanks! See you at the rave :)', now - 20 * DAY + 3 * HOUR);
  await at(box(b), a, 'I planted carrots today.', now - 19 * DAY);
  await at(box(a), b, 'your carrots are ugly', now - 19 * DAY + 5 * HOUR);
  await at(box(a), c, 'hello from the corner', now - 10 * DAY);
  await box(b).state.storage.put('L:card' + d, { id: 'card' + d, from: d, at: now - 3 * DAY, read: false, flag: '', kind: 'card', card: { tpl: ['a', 'b', 'c'], line: 0, look: {} } });
  await at(box(c), 'trym', 'hello from Trym', now - 2 * DAY);   // Trym's own letters are QA

  const office = env.POST.get('office:tally') && rooms.get('office:tally');
  let r = await jsonOf(await office.fetch(new Request('https://room/office')));
  ok('the first ask has nothing yet and starts counting', r.stats === null && r.counting === true && (await office.state.storage.getAlarm()) > 0, r);
  let ticks = 0, worst = 0;
  while (office.state.takeAlarm() && ticks < 20) {
    calls = 0;
    await office.alarm();
    ticks++;
    worst = Math.max(worst, calls);
  }
  ok('⭐ a lap over 95 homes takes three ticks', ticks === 3, ticks);
  ok('⭐ no tick makes more than 41 calls (the free plan stops at 50)', worst <= 41, worst);
  r = await jsonOf(await office.fetch(new Request('https://room/office')));
  const s = r.stats || {};
  ok('the count is fresh and no longer counting', r.counting === false && s.homes === 95, r);
  ok('five letters and a postcard, Trym’s left out', s.letters === 5 && s.cards === 1, s);
  ok('the tone tally: three warm, one unkind, one neutral', s.tone && s.tone.warm === 3 && s.tone.unkind === 1 && s.tone.neutral === 1, s.tone);
  ok('four writers, two homes reached', s.writers === 4 && s.receivers === 2, s);
  ok('one pair of pen pals among three pairs', s.penPals === 1 && s.pairs === 3, s);
  ok('the biggest circle is four homes', s.circle === 4, s);
  ok('replies: four of six old posts answered, the middle answer in 5 h', s.replies && s.replies.cohort === 5 && s.replies.answered === 3 && s.replies.medianH === 5, s.replies);
  ok('the longest conversation is A ↔ B, four posts in four turns', s.longest && s.longest[0] && s.longest[0].a === 'A' && s.longest[0].b === 'B' && s.longest[0].n === 4 && s.longest[0].turns === 4, s.longest);
  ok('the value question: both homes with post came back after it; 8 of 93 without are about', s.value && s.value.gotPost === 2 && s.value.cameBack === 2 && s.value.withPost.n === 2 && s.value.withPost.about === 2 && s.value.without.n === 93 && s.value.without.about === 8, s.value);
  const raw = JSON.stringify(r);
  ok('⭐ nothing the office answers names a home or holds a word', !/plum-|carrot|lovely|rave|corner|Trym/i.test(raw), raw.slice(0, 400));
  ok('a day series with every day in it', Array.isArray(s.perDay) && s.perDay.length === 31 && s.perDay.reduce((t, x) => t + x.letters, 0) === 5, s.perDay && s.perDay.length);
  const hist = await office.state.storage.get('hist');
  ok('the long record keeps the days', hist && Object.values(hist).reduce((t, x) => t + x.letters, 0) === 5, hist);
  // a letter expires: the box forgets it, the long record does not
  await box(a).state.storage.delete('L:' + (now - 10 * DAY).toString(36) + c);
  await office.state.storage.put('stats', { ...s, at: now - 2 * HOUR });
  await office.fetch(new Request('https://room/office'));
  while (office.state.takeAlarm()) await office.alarm();
  const s2 = (await jsonOf(await office.fetch(new Request('https://room/office')))).stats;
  ok('a new lap sees four letters', s2.letters === 4, s2.letters);
  ok('⭐ …and the long record still has five', Object.values(await office.state.storage.get('hist')).reduce((t, x) => t + x.letters, 0) === 5);
}

// ── tally() on its own: reading, knocks, stops, the value question ───────────────────────────────
{
  const now = Date.now();
  const yards = {
    ann: { created: now - 30 * DAY, seen: now - HOUR },
    ben: { created: now - 30 * DAY, seen: now - 9 * DAY },
    cat: { created: now - 30 * DAY, seen: now - 2 * DAY },
    dan: { created: now - DAY, seen: now },          // too new for the comparison
  };
  const boxes = [
    { slug: 'ann', open: 0, letters: [
      { from: 'ben', at: now - 10 * DAY, kind: 'letter', tone: 'warm', read: true },
      { from: 'cat', at: now - 2 * HOUR, kind: 'letter', tone: 'neutral', read: false },
      { from: '', at: now - DAY, kind: 'note', tone: '', read: true },
      { from: 'testy-x', at: now - DAY, kind: 'letter', tone: 'warm', read: true },
      { from: 'old', at: now - 40 * DAY, kind: 'letter', tone: 'warm', read: true },
    ], refused: [{ at: now - DAY, from: 'zed', why: 'contact' }, { at: now - DAY, from: 'zed', why: 'words' }, { at: now - 2 * DAY, from: 'yan', why: 'long' }], reported: [{ at: now - DAY }] },
    { slug: 'ben', open: now - HOUR, letters: [{ from: 'cat', at: now - 5 * DAY, kind: 'letter', tone: 'unkind', read: false, knock: true }], refused: [], reported: [] },
  ];
  const s = tally(boxes, yards, now);
  ok('resident notes are their own number, and never post', s.notes === 1 && s.posts === 3, s);
  ok('a letter from a test farm or older than the window is not counted', s.letters === 3);
  ok('opened: of post older than a day and let in, how much was read', s.openable === 1 && s.opened === 1, s);
  ok('a knock waiting at the door is counted apart', s.waiting === 1, s);
  ok('stopped: by reason, from how many', s.stopped.contact === 1 && s.stopped.words === 1 && s.stopped.other === 1 && s.stoppedBy === 2, s);
  ok('reported', s.reported === 1);
  ok('the box opened in the town counts as being about', s.value.cameBack === 2, s.value);
  ok('about this week: homes with post vs homes without (new homes left out)', s.value.withPost.n === 2 && s.value.withPost.about === 2 && s.value.without.n === 1 && s.value.without.about === 1, s.value);
  ok('nothing at all is still an answer', tally([], {}, now).posts === 0 && tally([], {}, now).circle === 0);
}

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
