// 🍌📌 BANANABOT, AGAINST ITS FAKES — the signature on every interaction, each command's answer, trivia (once per person,
// privately told), the posts it pins on its own (a baseline first, then only real news), its chat limits, the gateway's
// handshake, and the promise Trym asked for on 1 Oct 2026: it never says a word about letters.
const { verify } = await import('../src/discord.js');
const worker = (await import('../src/index.js')).default;
const { BotRoom, INTENTS, plain } = await import('../src/bot-room.js');
const { checkEvents, messages, oslo, isoWeek, pollResult } = await import('../src/events.js');
const trivia = await import('../src/trivia.js');
const { PERSONA, clean, think, snapshot } = await import('../src/brain.js');
const W = (await import('../../src/data/copy/bananabot.json', { with: { type: 'json' } })).default;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); }
};

// ── fakes ────────────────────────────────────────────────────────────────────────────────────────────────────────
function fakeState() {
  const m = new Map();
  let alarm = null;
  return {
    storage: {
      async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; },
      async put(k, v) { m.set(k, structuredClone(v)); },
      async delete(k) { m.delete(k); },
      async list(o = {}) { const p = o.prefix || ''; return new Map([...m.entries()].filter(([k]) => k.startsWith(p)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, structuredClone(v)])); },
      async getAlarm() { return alarm; }, async setAlarm(t) { alarm = t; }, async deleteAlarm() { alarm = null; },
    },
    _m: m, alarm: () => alarm,
  };
}
const WORLD = {
  '/count': { count: 3 }, '/park-count': { count: 1 }, '/beach-count': { count: 0 }, '/town-count': { count: 2 },
  '/town-life': { curse: 'none', dark: { night: false }, band: 'lively' },
  '/citizen': { last: { week: '2026-W39', winners: { citizen: { name: 'Andoo' }, neighbour: { name: 'KiwiRainbowRain' } } }, live: { citizen: [{ name: 'Be' }] } },
  '/arcade/board': { game: 'peelout', players: 6, top: [{ n: 'Kiwi', s: 31 }] },
  '/catalog/items.json': [{ id: 'c_aaaaaa01', title: 'Red Boxing Glove', by: 'Andoo', kind: 'wear' }, { id: 'c_bbbbbb02', title: 'A chair', kind: 'decor' }],
};
const binding = (world) => ({ fetch: async (req) => { const u = new URL(req.url); const body = world[u.pathname]; return new Response(JSON.stringify(body === undefined ? { err: 'no' } : body), { status: body === undefined ? 404 : 200 }); } });
const calls = [];
let anthropicReply = 'Three on the dance floor. I counted twice.';
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ url: u, method: init.method || 'GET', body, headers: init.headers || {} });
  if (u.startsWith('https://api.anthropic.com/')) return new Response(JSON.stringify({ content: [{ type: 'text', text: anthropicReply }], usage: { input_tokens: 900, output_tokens: 40 } }), { status: 200 });
  if (u.includes('/messages?limit=')) return new Response(JSON.stringify([]), { status: 200 });
  if (u.includes('/channels/') && (init.method || 'GET') === 'POST') return new Response(JSON.stringify({ id: 'm' + calls.length }), { status: 200 });
  if (u.includes('/channels/') && (init.method || 'GET') === 'GET') return new Response(JSON.stringify({ id: 'poll1', poll: { question: { text: 'Best place?' }, answers: [{ answer_id: 1, poll_media: { text: 'Banana Town' } }, { answer_id: 2, poll_media: { text: 'The Rave' } }], results: { is_finalized: true, answer_counts: [{ id: 1, count: 5 }, { id: 2, count: 3 }] } } }), { status: 200 });
  return new Response('{}', { status: 200 });
};

const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const pubHex = Buffer.from(await crypto.subtle.exportKey('raw', kp.publicKey)).toString('hex');
async function signed(body, tamper) {
  const ts = String(Math.floor(Date.now() / 1000));
  const raw = JSON.stringify(body);
  const sig = Buffer.from(await crypto.subtle.sign('Ed25519', kp.privateKey, new TextEncoder().encode(ts + raw))).toString('hex');
  return new Request('https://bot/interactions', { method: 'POST', headers: { 'x-signature-ed25519': sig, 'x-signature-timestamp': ts }, body: tamper ? raw.replace('}', ',"x":1}') : raw });
}
function makeEnv(extra = {}) {
  const env = { DISCORD_PUBLIC_KEY: pubHex, DISCORD_APP_ID: 'app1', DISCORD_TOKEN: 'tok', ANTHROPIC_KEY: 'key', BOT_STATS_TOKEN: 'stats', BOT_ADMIN_TOKEN: 'admin',
    RAVE: binding(WORLD), PASS: binding(WORLD), SHARE: binding(WORLD), ...extra };
  const rooms = new Map();
  env.BOT = { idFromName: (n) => n, get: (n) => { if (!rooms.has(n)) rooms.set(n, new BotRoom(fakeState(), env)); const r = rooms.get(n); return { fetch: (req) => r.fetch(req), room: r }; } };
  return env;
}
const ctx = { waitUntil() {} };
const call = async (env, body) => (await worker.fetch(await signed(body), env, ctx)).json();

console.log('\n🍌📌  BananaBOT');

// ── the signature ────────────────────────────────────────────────────────────────────────────────────────────────
{
  const env = makeEnv();
  ok('a signed PING is answered PONG', (await call(env, { type: 1 })).type === 1);
  ok('⭐ a tampered body is a 401', (await worker.fetch(await signed({ type: 1 }, true), env, ctx)).status === 401);
  ok('⭐ no signature is a 401', (await worker.fetch(new Request('https://bot/interactions', { method: 'POST', body: '{"type":1}' }), env, ctx)).status === 401);
  ok('/stats without its token is nothing', (await worker.fetch(new Request('https://bot/stats'), env, ctx)).status === 404);
  ok('/admin without its token is nothing', (await worker.fetch(new Request('https://bot/admin/config', { method: 'POST', body: '{}' }), env, ctx)).status === 404);
  ok('/stats with its token answers', (await worker.fetch(new Request('https://bot/stats', { headers: { 'X-Bot-Token': 'stats' } }), env, ctx)).status === 200);
}

// ── the commands ─────────────────────────────────────────────────────────────────────────────────────────────────
{
  const env = makeEnv();
  const cmd = (name, options) => call(env, { type: 2, data: { name, options }, token: 't', member: { user: { id: 'u1' } } });
  const w = await cmd('world');
  const e = w.data.embeds[0];
  ok('/world counts every place', e.fields.map((f) => f.value).join(',') === '3,1,0,2', e.fields);
  ok('…says whether the square is cursed', e.description.includes(W.world.plain));
  ok('…and wears the banana of the day', e.description.includes('Today’s banana wears'));
  ok('…with a button into Banana Town', w.data.components[0].components[0].url === 'https://trymstene.com/town/');
  ok('⭐ nobody gets pinged by a command', w.data.allowed_mentions && w.data.allowed_mentions.parse.length === 0);
  const t = await cmd('top');
  ok('/top names each cabinet’s leader', t.data.embeds[0].description.includes('**Peel Out** · Kiwi leads with 31'), t.data.embeds[0].description);
  const t1 = await cmd('top', [{ name: 'game', value: 'peelout' }]);
  ok('/top for one cabinet lists its board', t1.data.embeds[0].title === 'Peel Out' && t1.data.embeds[0].description.startsWith('1. **Kiwi** · 31'));
  const c = await cmd('citizens');
  ok('/citizens lists the plaques, the Citizen first', c.data.embeds[0].description.startsWith('**Citizen** · Andoo'), c.data.embeds[0].description);
  ok('…and who leads this week', c.data.embeds[0].description.includes('Be'));
  const today = await cmd('today');
  ok('/today shows the day’s picture', /\/assets\/daily\/today\.png\?d=\d{4}-\d{2}-\d{2}$/.test(today.data.embeds[0].image.url));
  const d = await cmd('dance');
  ok('/dance shows a remix GIF from the gallery', /^https:\/\/trymstene\.com\/assets\/dancing-banana-community-remixes\/.+\.gif$/.test(d.data.embeds[0].image.url));
  const h = await cmd('help');
  ok('/help answers only the one who asked', h.data.flags === 64);
}

// ── trivia ───────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const env = makeEnv();
  const q = await call(env, { type: 2, data: { name: 'trivia' }, token: 't' });
  const btns = q.data.components[0].components;
  ok('/trivia asks with four buttons', btns.length === 4 && btns.every((b) => /^tv:[a-z0-9]+:[0-3]$/.test(b.custom_id)), btns.map((b) => b.custom_id));
  const item = W.trivia.questions.find((x) => x.q === q.data.embeds[0].description);
  const right = btns.find((b) => b.label === item.a[0]);
  const wrong = btns.find((b) => b.label !== item.a[0]);
  const press = (b, user) => call(env, { type: 3, data: { custom_id: b.custom_id }, token: 't', member: { user: { id: user } } });
  const r1 = await press(right, 'u1');
  ok('a right answer updates the card for everyone', r1.type === 7 && r1.data.embeds[0].footer.text === '1 answered · 1 right', r1.data.embeds[0].footer);
  const r2 = await press(wrong, 'u2');
  ok('a wrong one is counted too', r2.data.embeds[0].footer.text === '2 answered · 1 right');
  const r3 = await press(right, 'u1');
  ok('⭐ nobody answers the same question twice', r3.type === 4 && r3.data.flags === 64 && r3.data.content === W.trivia.again);
  const gone = await press({ custom_id: 'tv:nope:0' }, 'u3');
  ok('an unknown question has come down off the board', gone.data.content === W.trivia.gone);
  const recent = [0, 1, 2];
  const picks = new Set(Array.from({ length: 40 }, (_, i) => trivia.newRound(recent, () => (i * 0.137) % 1).q));
  ok('a recent question is not asked again', ![...picks].some((p) => recent.includes(p)));
  const rd = trivia.newRound([], () => 0.5);
  ok('the buttons are a shuffle of the four answers', rd.order.slice().sort().join() === '0,1,2,3');
}

// ── the posts it pins on its own ─────────────────────────────────────────────────────────────────────────────────
{
  const world = structuredClone(WORLD);
  const env = { RAVE: binding(world), PASS: binding(world), SHARE: binding(world) };
  const sent = [];
  const send = async (kind, m) => { sent.push({ kind, m }); return { ok: true, id: 'p1', channel: 'c1' }; };
  const st = {};
  const mon10 = Date.parse('2026-10-05T08:00:00Z');   // Monday 10:00 in Oslo
  await checkEvents(env, st, mon10, send);
  ok('⭐ the first look is a baseline: nothing posted', sent.length === 0, sent.map((s) => s.kind));
  world['/town-life'] = { curse: 'creep', dark: { night: true } };
  world['/citizen'] = { last: { week: '2026-W40', winners: { citizen: { name: 'Kiwi' } } }, live: {} };
  world['/arcade/board'] = { top: [{ n: 'Be', s: 40 }] };
  world['/catalog/items.json'] = [...WORLD['/catalog/items.json'], { id: 'c_cccccc03', title: 'Wolf Tail', by: 'Andoo', kind: 'wear' }];
  await checkEvents(env, st, mon10 + 300000, send);
  const kinds = sent.map((s) => s.kind);
  ok('a Curse Night beginning is pinned', kinds.includes('curse'));
  ok('the plaques are pinned when a new week is crowned', kinds.includes('crowned') && sent.find((s) => s.kind === 'crowned').m.embeds[0].description.includes('Kiwi'));
  ok('a new best at the top of a board is pinned', kinds.filter((k) => k === 'record').length === 5, kinds);
  ok('a new Forge piece at the stand is pinned', kinds.includes('forge') && sent.find((s) => s.kind === 'forge').m.content.includes('Wolf Tail'));
  sent.length = 0;
  world['/arcade/board'] = { top: [{ n: 'Wiped', s: 3 }] };
  world['/catalog/items.json'] = Array.from({ length: 20 }, (_, i) => ({ id: 'c_dddddd' + String(i).padStart(2, '0'), title: 'x', kind: 'wear' }));
  await checkEvents(env, st, mon10 + 600000, send);
  ok('a wiped board is not a record, and twenty new pieces at once is a resync, not news', sent.length === 0, sent.map((s) => s.kind));
  await checkEvents(env, st, Date.parse('2026-10-05T15:05:00Z'), send);   // Monday 17:05 in Oslo
  ok('⭐ the weekly poll goes up on Monday evening', sent.some((s) => s.kind === 'poll') && st.poll && st.poll.end > 0, sent.map((s) => s.kind));
  const pm = sent.find((s) => s.kind === 'poll').m;
  ok('…as a real Discord poll, three days long', pm.poll.duration === 72 && pm.poll.answers.length >= 2 && pm.poll.answers.every((a) => a.poll_media.text.length <= 55));
  const n = sent.length;
  await checkEvents(env, st, Date.parse('2026-10-05T16:05:00Z'), send);
  ok('…once a week', sent.filter((s) => s.kind === 'poll').length === 1 && sent.length === n);
  await checkEvents(env, st, Date.parse('2026-10-06T07:30:00Z'), send);   // Tuesday 09:30 in Oslo
  ok('the banana of the day goes up in the morning', sent.some((s) => s.kind === 'morning'));
  const m = sent.length;
  await checkEvents(env, st, Date.parse('2026-10-06T09:00:00Z'), send);
  ok('…once a day', sent.length === m);
  ok('Oslo’s clock, summer time', oslo(Date.parse('2026-07-01T07:00:00Z')).hour === 9 && oslo(Date.parse('2026-12-01T08:00:00Z')).hour === 9);
  ok('ISO weeks', isoWeek('2026-10-05') === '2026-W41' && isoWeek('2027-01-01') === '2026-W53');
  const res = pollResult({ poll: { question: { text: 'Q' }, answers: [{ answer_id: 1, poll_media: { text: 'A' } }], results: { is_finalized: true, answer_counts: [{ id: 1, count: 4 }] } } });
  ok('a closed poll is read back', res && res.total === 4 && res.answers[0].text === 'A');
  ok('an open one is not', pollResult({ poll: { results: { is_finalized: false } } }) === null);
}

// ── chat: Claude answers a mention, inside its limits ────────────────────────────────────────────────────────────
{
  const env = makeEnv({ DAILY_CAP: '2', USER_CAP: '1' });
  const room = env.BOT.get('bananabot').room;
  room.me = { id: 'bot1' };
  const msg = (id, text, extra = {}) => ({ id, guild_id: 'g', channel_id: 'ch', content: text, author: { id: 'u' + id, username: 'kiwi' + id }, mentions: [{ id: 'bot1', username: 'BananaBOT' }], timestamp: new Date().toISOString(), ...extra });
  calls.length = 0;
  await room.chat(msg('1', '<@bot1> how many bananas at the rave?'));
  const ask = calls.find((c) => c.url.startsWith('https://api.anthropic.com/'));
  ok('a mention is answered by Claude', !!ask && ask.body.model === 'claude-haiku-4-5-20251001');
  ok('⭐ …told never to talk about letters', ask.body.system[0].text.includes('Never talk about letters, the post office, mail, postcards'));
  ok('…and given the world as it is right now', ask.body.system[1].text.includes('the Rave 3'));
  const out = calls.find((c) => c.url.endsWith('/channels/ch/messages') && c.method === 'POST');
  ok('the reply answers the message it was asked in', out && out.body.message_reference.message_id === '1' && out.body.content === anthropicReply);
  ok('⭐ and pings nobody but the asker', out.body.allowed_mentions.parse.length === 0 && out.body.allowed_mentions.users.join() === 'u1');
  calls.length = 0;
  await room.chat(msg('1b', '<@bot1> and the park?', { author: { id: 'u1', username: 'kiwi1' } }));
  const slow = calls.find((c) => c.url.endsWith('/channels/ch/messages') && c.method === 'POST');
  ok('one person past their share is told to slow down, without Claude', !calls.some((c) => c.url.startsWith('https://api.anthropic.com/')) && slow && slow.body.content.includes('give the board a minute'));
  await room.chat(msg('2', '<@bot1> hello'));
  calls.length = 0;
  await room.chat(msg('3', '<@bot1> hi'));
  const cap = calls.find((c) => c.url.endsWith('/channels/ch/messages'));
  ok('⭐ past the day’s cap: said once, then quiet', cap && cap.body.content === W.chat.cap && !calls.some((c) => c.url.startsWith('https://api.anthropic.com/')));
  calls.length = 0;
  await room.chat(msg('4', '<@bot1> hey'));
  ok('…quiet', calls.length === 0);
  calls.length = 0;
  await room.chat(msg('5', 'no mention here', { mentions: [] }));
  await room.chat(msg('6', '<@bot1> beep', { author: { id: 'b', username: 'otherbot', bot: true } }));
  ok('a message without a mention, or from a bot, is not answered', calls.length === 0);
  ok('mentions read as names', plain({ content: 'hi <@bot1> and <:banana:123>', mentions: [{ id: 'bot1', username: 'BananaBOT' }] }) === 'hi @BananaBOT and :banana:');
  ok('a reply never pings everyone', clean('@everyone look <@123>') === 'everyone look');
  ok('no key, no Claude', (await think({}, [{ who: 'a', text: 'b' }], '')) === null);
  ok('the live block is plain facts', snapshot({ counts: { rave: 1, park: 0, bay: 0, town: 2 }, square: { cursed: false } }).startsWith('Bananas here right now: the Rave 1'));
}

// ── the gateway: switched off, nothing; switched on, the handshake ───────────────────────────────────────────────
{
  const off = makeEnv({ GATEWAY_ON: '0' });
  const r0 = off.BOT.get('bananabot').room;
  calls.length = 0;
  await r0.tick();
  ok('⭐ with GATEWAY_ON off, the tick never opens a connection or sets the watchdog', !calls.some((c) => c.url.includes('gateway.discord.gg')) && r0.state.alarm() === null);

  const on = makeEnv({ GATEWAY_ON: '1' });
  const room = on.BOT.get('bananabot').room;
  const sentGw = [];
  const sock = { listeners: {}, accept() {}, send(s) { sentGw.push(JSON.parse(s)); }, close() { this.closed = true; }, addEventListener(t, f) { this.listeners[t] = f; } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).includes('gateway.discord.gg') ? { webSocket: sock } : realFetch(url, init));
  await room.tick();
  ok('switched on, the tick connects and sets the watchdog', !!room.ws && room.state.alarm() > Date.now());
  await room.onGateway(JSON.stringify({ op: 10, d: { heartbeat_interval: 45000 } }));
  const id = sentGw.find((x) => x.op === 2);
  ok('…identifies with the four intents it needs', id && id.d.intents === INTENTS && INTENTS === (1 | 2 | 512 | 32768));
  ok('…and its status line', id.d.presence.activities[0].state === W.presence);
  await room.onGateway(JSON.stringify({ op: 0, t: 'READY', s: 1, d: { session_id: 's1', resume_gateway_url: 'wss://r.discord.gg', user: { id: 'bot1', username: 'BananaBOT' } } }));
  ok('READY keeps the session to resume', (await room.get('gw')).session === 's1' && room.me.id === 'bot1');
  await room.onGateway(JSON.stringify({ op: 0, t: 'GUILD_CREATE', s: 2, d: { id: 'g1', name: 'Banana World', system_channel_id: 'sys1' } }));
  ok('a server’s system channel is where welcomes go until told otherwise', (await room.get('cfg')).system === 'sys1');
  calls.length = 0;
  await room.onGateway(JSON.stringify({ op: 0, t: 'GUILD_MEMBER_ADD', s: 3, d: { user: { id: 'new1', username: 'newbie' } } }));
  const wel = calls.find((c) => c.url.endsWith('/channels/sys1/messages'));
  ok('⭐ a newcomer is welcomed by name, and pinged only themselves', wel && wel.body.content.includes('<@new1>') && wel.body.allowed_mentions.users.join() === 'new1');
  clearInterval(room.hb);
  await room.onGateway(JSON.stringify({ op: 7 }));
  ok('Discord asking for a reconnect drops the socket for a resume', room.ws === null && sock.closed && !!(await room.get('gw')).session);
  globalThis.fetch = realFetch;
}

// ── the promise: no letters ──────────────────────────────────────────────────────────────────────────────────────
{
  const words = JSON.stringify(W).toLowerCase();
  ok('⭐ nothing BananaBOT says mentions letters or the post', !/\b(letters?|post ?office|postcards?|mail|mailbox|pen ?pals?)\b/.test(words));
  ok('⭐ the brain’s first rule is the letters rule', PERSONA.indexOf('Never talk about letters') > -1 && PERSONA.indexOf('Never talk about letters') < PERSONA.indexOf('Never give a timetable'));
  const src = ['../src/world.js', '../src/commands.js', '../src/events.js'].map((f) => import.meta.resolve(f));
  const { readFileSync } = await import('node:fs');
  const code = src.map((u) => readFileSync(new URL(u), 'utf8')).join('\n');
  ok('⭐ no route the bot reads goes near the post', !/\/post(-stats|-review|\/)|post-tally|office:tally/.test(code));
}

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
