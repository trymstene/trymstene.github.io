// 👋 ECHOES, WAVES AND NOTICES (26 Sep 2026), in-process against a fake DO.
//
// Trym: "the echo-thing sounds cool, wave - sure, its something we can try" … "for these social messages i dont
// think the letter mailbox is the right place, but maybe a separate icon shows up for general notifications".
// What must hold:
//   · an echo is exactly a person the address book already shows (a Pass, a Homestead, a name), about in the last
//     ECHO_DAYS, never yourself, never QA — and says which DAY, never what time
//   · a wave needs its sender's proof, lands in the other player's NOTICES (never the post), once a day per pair,
//     WAVE_DAY a day per sender, and a house owner waves under their book name whatever the body claims
//   · a banana with no house is waved back to by a keyed HANDLE, never their id
//   · notices are yours only (proof), follow your aliases, keep NOTICE_CAP, and `seen` marks when you last looked
//   · on the square a wave goes to somebody where you are, carries the ROOM's copy of your name, and is not a strobe
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const { YardRoom, SquareRoom } = await import('../src/index.js');

const HMAC = 'test-member-hmac';
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(msg) {
  const k = await crypto.subtle.importKey('raw', te.encode(HMAC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, te.encode(msg)));
}
async function wt(gid, aliases = []) {
  const base = gid + '.' + (Date.now() + 86400000) + '.' + aliases.join(',');
  return base + '.' + (await hmac('wt:' + base));
}
function fakeState() {
  const m = new Map();
  return {
    storage: {
      async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; },
      async put(k, v) { m.set(k, structuredClone(v)); },
      async delete(k) { m.delete(k); },
      async list(opts = {}) { const p = opts.prefix || ''; return new Map([...m.entries()].filter(([k]) => k.startsWith(p)).map(([k, v]) => [k, structuredClone(v)])); },
    },
    _m: m, getWebSockets: () => [], setWebSocketAutoResponse() {}, acceptWebSocket() {},
  };
}
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const realNow = Date.now;
const DAY = 86400000;
let gidN = 0;
const gid = () => (++gidN).toString(16).padStart(4, '0') + 'abcdef0123' + 'ff';   // 16 hex, all different

const st = fakeState();
const yard = new YardRoom(st, { MEMBER_HMAC: HMAC });
const yp = (path, body) => yard.fetch(new Request('https://room' + path, { method: 'POST', body: JSON.stringify(body) }))
  .then(async (r) => ({ status: r.status, ...(await r.json()) }));
const yg = (path) => yard.fetch(new Request('https://room' + path)).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const fit = { hat: 'tophat', glasses: 'shades', extras: { bowtie: true } };
async function person(house, n, at) {
  const p = { id: gid(), house, n };
  p.wt = await wt(p.id);
  if (at) Date.now = () => at;
  const c = await yp('/claim', { name: house, pass: p.id, alt: p.id, wt: p.wt });
  p.slug = c.slug;
  if (n) await yp('/who', { pass: p.id, alt: p.id, wt: p.wt, who: { n, fit } });
  Date.now = realNow;
  return p;
}

console.log('1. the echoes');
const ada = await person('Ada Orchard', 'Ada');
const bo = await person('Bo Bottom', 'Bo');
const quiet = await person('Quiet Acre', '');
const qa = await person('Testy', 'Tess');
const old = await person('Old Barn', 'Olly', realNow() - 15 * DAY);
const lately = await person('Late Lane', 'Lu', realNow() - 3 * DAY - 3600000);
let r = await yg('/echoes');
const E = (p) => (r.echoes || []).find((e) => e.slug === p.slug);
ok('the room answers', r.status === 200 && Array.isArray(r.echoes), r);
ok('a player with a pass, a house and a name is an echo', !!E(ada) && !!E(bo), r.echoes);
ok('a homestead with nobody named is not', !E(quiet), r.echoes);
ok('QA never walks about as a player', !E(qa), r.echoes);
ok('nobody gone longer than two weeks', !E(old), r.echoes);
ok('somebody from three days ago is', !!E(lately), r.echoes);
ok('an echo carries a name, a house and a banana', E(ada).n === 'Ada' && E(ada).house === 'Ada Orchard' && E(ada).fit.hat === 'tophat' && E(ada).fit.extras.bowtie === 1, E(ada));
ok('…and which DAY: 0 today, 3 three days ago', E(ada).d === 0 && E(lately).d === 3, [E(ada).d, E(lately).d]);
ok('…and never a time, a pass or an owner tag', ['t', 'pass', 'owner', 'updated', 'seen'].every((k) => E(ada)[k] === undefined), Object.keys(E(ada)));
ok('the most recently about come first', r.echoes[r.echoes.length - 1].slug === lately.slug, r.echoes.map((e) => e.slug));
r = await yg('/echoes?mine=' + ada.slug);
ok('you are never one of your own echoes', !(r.echoes || []).some((e) => e.slug === ada.slug), r.echoes);
r = await yg('/echoes');
ok('🌱 an echo of a farm claimed today is a new banana', E(ada) && r.echoes.find((e) => e.slug === ada.slug).nw === 1, r.echoes);
ok('…and one claimed three days ago is not', !r.echoes.find((e) => e.slug === lately.slug).nw, r.echoes);

console.log('2. a wave');
const nim = { id: gid() }; nim.wt = await wt(nim.id);   // an anonymous pass: no house, no name in any book
r = await yp('/wave', { pass: nim.id, alt: nim.id, to: ada.slug, n: 'Nim', fit });
ok('a wave without its sender\'s proof is refused', r.status === 401, r);
r = await yp('/wave', { pass: nim.id, alt: nim.id, wt: ada.wt, to: ada.slug, n: 'Nim' });
ok('…and so is somebody else\'s proof', r.status === 401, r);
r = await yp('/wave', { pass: nim.id, alt: nim.id, wt: nim.wt, to: ada.slug, n: 'Nim', fit });
ok('a proven banana with no house waves at an echo', r.status === 200 && r.ok === 1 && !r.again, r);
r = await yp('/wave', { pass: nim.id, alt: nim.id, wt: nim.wt, to: ada.slug, n: 'Nim', fit });
ok('a second wave the same day is the same wave', r.status === 200 && r.again === 1, r);
r = await yp('/wave', { pass: nim.id, alt: nim.id, wt: nim.wt, to: 'nobody-lives-here', n: 'Nim' });
ok('a wave at nobody is nobody\'s', r.status === 404, r);
r = await yp('/wave', { pass: ada.id, alt: ada.id, wt: ada.wt, to: ada.slug });
ok('you cannot wave at yourself', r.status === 400, r);

console.log('3. my notices');
r = await yp('/notices', { pass: ada.id, alt: ada.id });
ok('notices without proof are nobody\'s business', r.status === 401, r);
r = await yp('/notices', { pass: ada.id, alt: ada.id, wt: ada.wt });
ok('the one waved at finds one wave', r.status === 200 && r.notices.length === 1 && r.notices[0].k === 'wave', r);
const got = r.notices[0] || {};
ok('…from the name they gave, in the banana they wear', got.n === 'Nim' && got.fit.hat === 'tophat', got);
ok('…with no house to wave back to, but a HANDLE', got.s === '' && /^[a-f0-9]{12}$/.test(got.h), got);
ok('…and the handle is not their id', !nim.id.includes(got.h) && got.h !== nim.id.slice(0, 12), got.h);
ok('nothing that identifies the waver\'s pass leaves the room', got.o === undefined && got.day === undefined, Object.keys(got));
ok('first look: nothing seen yet', r.seen === 0, r.seen);

console.log('4. a wave back');
r = await yp('/wave', { pass: ada.id, alt: ada.id, wt: ada.wt, h: got.h, n: 'Mallory', fit: { hat: 'crown' } });
ok('a wave back by handle lands', r.status === 200 && r.ok === 1, r);
r = await yp('/notices', { pass: nim.id, alt: nim.id, wt: nim.wt });
const back = (r.notices || [])[0] || {};
ok('the banana with no house gets it', r.status === 200 && back.k === 'wave', r);
ok('…under the waver\'s BOOK name, whatever the body said', back.n === 'Ada', back);
ok('…in the banana the book has, not the one claimed', back.fit.hat === 'tophat', back.fit);
ok('…and from a house they can visit', back.s === ada.slug && back.h === '', back);
r = await yp('/wave', { pass: nim.id, alt: nim.id, wt: nim.wt, h: got.h, n: 'Nim' });
ok('waving at your own handle is waving at yourself', r.status === 400, r);
r = await yp('/wave', { pass: ada.id, alt: ada.id, wt: ada.wt, h: 'ZZZZ<script>', n: 'x' });
ok('a handle that is not a handle finds nobody', r.status === 404, r);

console.log('5. names the family filter refuses');
const rude = { id: gid() }; rude.wt = await wt(rude.id);
r = await yp('/wave', { pass: rude.id, alt: rude.id, wt: rude.wt, to: bo.slug, n: 'fuck', fit: { hat: '<img onerror>' } });
ok('a wave under a refused name still arrives…', r.status === 200, r);
r = await yp('/notices', { pass: bo.id, alt: bo.id, wt: bo.wt });
const rn = (r.notices || [])[0] || {};
ok('…with no name at all', rn.n === '', rn);
ok('…and an item id that is not an item id is no item', rn.fit.hat === '', rn.fit);

console.log('6. seen');
r = await yp('/notices', { pass: bo.id, alt: bo.id, wt: bo.wt, seen: 1 });
ok('marking seen still answers with the list', r.status === 200 && r.notices.length === 1, r);
r = await yp('/notices', { pass: bo.id, alt: bo.id, wt: bo.wt });
ok('…and the next look knows when that was', r.seen >= rn.t, [r.seen, rn.t]);

console.log('7. aliases: an anonymous pass that later signed in keeps what it was sent');
const anonId = gid(), realId = gid();
const anonHome = await (async () => {
  const w0 = await wt(anonId);
  const c = await yp('/claim', { name: 'Fold Farm', pass: anonId, alt: anonId, wt: w0 });
  await yp('/who', { pass: anonId, alt: anonId, wt: w0, who: { n: 'Folda', fit } });
  return c.slug;
})();
r = await yp('/wave', { pass: bo.id, alt: bo.id, wt: bo.wt, to: anonHome });
ok('a wave at the anonymous house', r.status === 200, r);
r = await yp('/notices', { pass: realId, alt: realId, wt: await wt(realId, [anonId]) });
ok('the signed-in pass reads it through its alias', r.status === 200 && r.notices.some((x) => x.n === 'Bo' && x.s === bo.slug), r);
r = await yp('/notices', { pass: realId, alt: realId, wt: await wt(realId) });
ok('…and without the alias in the proof it does not', r.status === 200 && !r.notices.length, r);

console.log('7b. not an echo, thanks');
r = await yp('/notices', { pass: ada.id, alt: ada.id, wt: ada.wt });
ok('a house with a name is told it is an echo', r.echo === 1, r.echo);
r = await yp('/notices', { pass: nim.id, alt: nim.id, wt: nim.wt });
ok('a banana with no house has nothing to switch', r.echo === undefined, r.echo);
r = await yp('/echo', { pass: ada.id, alt: ada.id, on: 0 });
ok('switching needs the owner’s proof', r.status === 401, r);
r = await yp('/echo', { pass: nim.id, alt: nim.id, wt: nim.wt, on: 0 });
ok('…and a house', r.status === 404, r);
r = await yp('/echo', { pass: ada.id, alt: ada.id, wt: ada.wt, on: 0 });
ok('the owner keeps their banana out', r.status === 200 && r.echo === 0, r);
r = await yg('/echoes');
ok('…and it is no longer among the echoes', !(r.echoes || []).some((e) => e.slug === ada.slug) && (r.echoes || []).some((e) => e.slug === bo.slug), r.echoes);
r = await yg('/folk');
ok('…but still in the address book, where letters are addressed', (r.folk || []).some((f) => f.slug === ada.slug), r.folk);
r = await yp('/notices', { pass: ada.id, alt: ada.id, wt: ada.wt });
ok('the notices say so', r.echo === 0, r.echo);
r = await yp('/wave', { pass: nim.id, alt: nim.id, wt: nim.wt, to: ada.slug, n: 'Nim' });
ok('a wave already addressed still lands (the house is still there)', r.status === 200, r);
r = await yp('/echo', { pass: ada.id, alt: ada.id, wt: ada.wt, on: 1 });
r = await yg('/echoes');
ok('and back in when they like', (r.echoes || []).some((e) => e.slug === ada.slug), r.echoes);

console.log('8. the caps');
const spam = { id: gid() }; spam.wt = await wt(spam.id);
const targets = [];
for (let i = 0; i < 31; i++) targets.push(await person('Cap House ' + i, ''));
let codes = [];
for (const t of targets) codes.push((await yp('/wave', { pass: spam.id, alt: spam.id, wt: spam.wt, to: t.slug, n: 'Spam' })).status);
ok('thirty waves a day from one banana', codes.slice(0, 30).every((c) => c === 200), codes);
ok('…and the thirty-first is refused', codes[30] === 429, codes[30]);
const star = await person('Star Farm', 'Star');
for (let i = 0; i < 32; i++) {
  const w = { id: gid() }; w.wt = await wt(w.id);
  await yp('/wave', { pass: w.id, alt: w.id, wt: w.wt, to: star.slug, n: 'Fan' + i });
}
r = await yp('/notices', { pass: star.id, alt: star.id, wt: star.wt });
ok('a player keeps the thirty newest', r.notices.length === 30 && r.notices[0].n === 'Fan31' && !r.notices.some((x) => x.n === 'Fan0' || x.n === 'Fan1'), r.notices.map((x) => x.n));

console.log('9. a wave across the square');
function fakeWs() {
  let att = null;
  return { got: [], serializeAttachment(a) { att = structuredClone(a); }, deserializeAttachment() { return att ? structuredClone(att) : null; }, send(s) { this.got.push(JSON.parse(s)); }, close() {} };
}
const socks = [];
const sq = new SquareRoom({ getWebSockets: () => socks, setWebSocketAutoResponse() {}, getWebSocketAutoResponseTimestamp: () => null, acceptWebSocket(ws) { socks.push(ws); } }, {});
const join = async (name, room) => { const ws = fakeWs(); socks.push(ws); await sq.webSocketMessage(ws, JSON.stringify({ t: 'hi', sid: 's-' + name, name, room, x: 50, y: 90 })); return ws; };
const A = await join('Ada', ''), B = await join('Bo', ''), C = await join('Cy', 'store');
const idOf = (ws) => ws.got.find((m) => m.t === 'roster').you;
const waves = (ws) => ws.got.filter((m) => m.t === 'wave');
let NOW = realNow();
Date.now = () => NOW;
await sq.webSocketMessage(A, JSON.stringify({ t: 'wave', to: idOf(B), name: 'Mallory' }));
ok('the one waved at is told', waves(B).length === 1 && waves(B)[0].id === idOf(A) && waves(B)[0].to === idOf(B), B.got);
ok('…under the name the ROOM holds, not the one in the message', waves(B)[0] && waves(B)[0].name === 'Ada', waves(B)[0]);
ok('…everybody else sees it too, the waver is not echoed', waves(C).length === 1 && waves(A).length === 0, [waves(C), waves(A)]);
NOW += 500;
await sq.webSocketMessage(A, JSON.stringify({ t: 'wave', to: idOf(B) }));
ok('a wave is a gesture, not a strobe', waves(B).length === 1, waves(B));
NOW += 2000;
await sq.webSocketMessage(A, JSON.stringify({ t: 'wave', to: idOf(C) }));
ok('nobody waves through a wall (Cy is in the store)', waves(B).length === 1 && waves(C).length === 1, waves(C));
await sq.webSocketMessage(A, JSON.stringify({ t: 'wave', to: idOf(A) }));
await sq.webSocketMessage(A, JSON.stringify({ t: 'wave', to: 'nobody00' }));
ok('nor at yourself, nor at nobody', waves(B).length === 1 && waves(C).length === 1, waves(B));
NOW += 2000;
await sq.webSocketMessage(B, JSON.stringify({ t: 'wave', to: idOf(A) }));
ok('and the one waved at can wave back', waves(A).length === 1 && waves(A)[0].name === 'Bo', waves(A));
Date.now = realNow;

console.log('10. and in every other room people meet in');
const mods = await import('../src/index.js');
// 🌱 a new banana is told to everybody in the room, and nobody else is
for (const K of ['ParkRoom', 'BeachRoom', 'YardRoom', 'SquareRoom']) {
  const list = [];
  const room = new mods[K]({ ...fakeState(), getWebSockets: () => list, getWebSocketAutoResponseTimestamp: () => null, acceptWebSocket(ws) { list.push(ws); } }, {});
  const hi = async (name, nw) => { const ws = fakeWs(); list.push(ws); await room.webSocketMessage(ws, JSON.stringify({ t: 'hi', sid: 's-' + name + K, name, x: 50, y: 50, ...(nw ? { nw: 1 } : {}) })); return ws; };
  const old = await hi('Old'), fresh = await hi('Fresh', true);
  const seen = old.got.find((m) => m.t === 'join');
  ok(K + ': a new banana arrives marked new', seen && seen.p.name === 'Fresh' && seen.p.nw === 1, seen);
  const ros = fresh.got.find((m) => m.t === 'roster').all.find((a) => a.name === 'Old');
  ok(K + ': …and a regular is not', ros && !ros.nw, ros);
}
for (const K of ['RaveRoom', 'ParkRoom', 'BeachRoom', 'YardRoom']) {
  const list = [];
  const room = new mods[K]({ ...fakeState(), getWebSockets: () => list, getWebSocketAutoResponseTimestamp: () => null, acceptWebSocket(ws) { list.push(ws); } }, {});
  const hi = async (name) => { const ws = fakeWs(); list.push(ws); await room.webSocketMessage(ws, JSON.stringify({ t: 'hi', sid: 's-' + name + K, name, x: 50, y: 50 })); return ws; };
  const P = await hi('Pia'), Q = await hi('Quin');
  await room.webSocketMessage(P, JSON.stringify({ t: 'wave', to: idOf(Q) }));
  ok(K + ': a wave reaches the one waved at, under the room\'s name for the waver', waves(Q).length === 1 && waves(Q)[0].name === 'Pia' && waves(Q)[0].to === idOf(Q), Q.got.slice(-2));
}

console.log('11. 💥 a level-up across a room: everybody else sees it, it only climbs, and it is never a strobe');
for (const K of ['ParkRoom', 'BeachRoom', 'YardRoom', 'SquareRoom']) {
  const list = [];
  const room = new mods[K]({ ...fakeState(), getWebSockets: () => list, getWebSocketAutoResponseTimestamp: () => null, acceptWebSocket(ws) { list.push(ws); } }, {});
  const hi = async (name) => { const ws = fakeWs(); list.push(ws); await room.webSocketMessage(ws, JSON.stringify({ t: 'hi', sid: 's-' + name + K, name, x: 50, y: 50 })); return ws; };
  const P = await hi('Pia'), Q = await hi('Quin');
  const ups = (ws) => ws.got.filter((m) => m.t === 'lvlup');
  let T = realNow(); Date.now = () => T;
  await room.webSocketMessage(P, JSON.stringify({ t: 'lvl', n: 12 }));
  ok(K + ': Quin sees Pia reach level 12, and Pia is not echoed', ups(Q).length === 1 && ups(Q)[0].id === idOf(P) && ups(Q)[0].n === 12 && ups(P).length === 0, ups(Q));
  T += 1000; await room.webSocketMessage(P, JSON.stringify({ t: 'lvl', n: 13 }));
  ok(K + ': a second one a second later is not a strobe', ups(Q).length === 1, ups(Q));
  T += 5000; await room.webSocketMessage(P, JSON.stringify({ t: 'lvl', n: 11 }));
  await room.webSocketMessage(P, JSON.stringify({ t: 'lvl', n: 'x' }));
  await room.webSocketMessage(P, JSON.stringify({ t: 'lvl', n: 500 }));
  ok(K + ': a level only climbs, and only to a real one', ups(Q).length === 1, ups(Q));
  await room.webSocketMessage(P, JSON.stringify({ t: 'lvl', n: 14 }));
  ok(K + ': the next real climb is seen', ups(Q).length === 2 && ups(Q)[1].n === 14, ups(Q));
  Date.now = realNow;
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
