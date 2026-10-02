// 🪪 PROTECTED NAMES on worker-rave, in-process against fake DOs (2 Oct 2026; src/lib/name-guard.js).
//
// Trym: "add protection on my name, its a bit silly if players thats using my name is sent letters and stuff". A protected
// name gets in only beside the NAME TOKEN worker-pass gives its owner (`gid.exp.hmac` under 'nt:', the member token's
// secret) for the world id it speaks for. What must hold:
//   · a room shows a stranger who arrives as "Trym Stene" with no name; the owner, with the token, keeps it
//   · a sign named after it keeps its default for a stranger; the owner's sign takes it, and says so in the index
//   · the address book (and so a letter) never offers a stranger by that name — the book refuses it at the door, and a row
//     stored before this existed is hidden unless its yard is older than the first stranger (NAME_CUTOFF)
//   · a guestbook line and a park plot go unsigned for a stranger
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const { ParkRoom, YardRoom, SquareRoom } = await import('../src/index.js');

const HMAC = 'test-member-hmac';
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(msg) {
  const k = await crypto.subtle.importKey('raw', te.encode(HMAC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, te.encode(msg)));
}
async function wt(gid) { const base = gid + '.' + (Date.now() + 86400000) + '.'; return base + '.' + (await hmac('wt:' + base)); }
async function nt(gid, ttl = 86400000) { const base = gid + '.' + (Date.now() + ttl); return base + '.' + (await hmac('nt:' + base)); }
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
const OWNER = 'a1b2c3d4e5f60718', STRANGER = '0f0f0f0f0f0f0f0f', OTHER = '1234123412341234';

console.log('1. a room');
{
  const list = [];
  const sq = new SquareRoom({ ...fakeState(), getWebSockets: () => list, getWebSocketAutoResponseTimestamp: () => null, acceptWebSocket(ws) { list.push(ws); } }, { MEMBER_HMAC: HMAC });
  const fakeWs = () => { let att = null; return { got: [], serializeAttachment(a) { att = structuredClone(a); }, deserializeAttachment() { return att ? structuredClone(att) : null; }, send(x) { this.got.push(JSON.parse(x)); }, close() {} }; };
  const join = async (hi) => { const ws = fakeWs(); list.push(ws); await sq.webSocketMessage(ws, JSON.stringify({ t: 'hi', x: 50, y: 90, room: '', ...hi })); return ws; };
  const watcher = await join({ sid: 's-watch', name: 'Pia' });
  await join({ sid: 's-fake', own: STRANGER, name: 'Trym Stene' });
  await join({ sid: 's-fake2', own: OTHER, name: 'Tryrn 5tene', nt: await nt(OWNER) });   // somebody else's token is nobody's
  await join({ sid: 's-real', own: OWNER, name: 'Trym Stene', nt: await nt(OWNER) });
  const names = watcher.got.filter((m) => m.t === 'join').map((m) => m.p.name);
  ok('⭐ a stranger who walks in as “Trym Stene” walks in with no name', !names[0], names);
  ok('…and one carrying somebody else’s token too', !names[1], names);
  ok('the owner, beside the token for their world id, keeps it', names[2] === 'Trym Stene', names);
}

console.log('2. a sign, the book and a letter’s heading');
const yard = new YardRoom(fakeState(), { MEMBER_HMAC: HMAC });
const yp = (path, body) => yard.fetch(new Request('https://room' + path, { method: 'POST', body: JSON.stringify(body) })).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const yg = (path) => yard.fetch(new Request('https://room' + path)).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const fit = { hat: 'tophat', glasses: 'none', extras: {} };
const id = async (gid, withNt) => ({ pass: gid, alt: gid, wt: await wt(gid), ...(withNt ? { nt: await nt(gid) } : {}) });
let r = await yp('/claim', { name: 'Trym Stene', ...(await id(STRANGER)) });
const fakeSlug = r.slug;
r = await yg('/yards');
const fakeDoc = await yard.state.storage.get('y:' + fakeSlug);
ok('⭐ a stranger’s sign named “Trym Stene” keeps its default', fakeDoc && fakeDoc.name === 'A Homestead', fakeDoc && fakeDoc.name);
r = await yp('/who', { who: { n: 'Trym Stene', fit }, ...(await id(STRANGER)) });
ok('…and the book will not take the name from them', r.status === 400, r);
r = await yp('/claim', { name: 'Trym Stene', ...(await id(OWNER, true)) });
const realSlug = r.slug;
const realDoc = await yard.state.storage.get('y:' + realSlug);
ok('the owner’s sign takes it, and remembers that its token stood behind it', realDoc.name === 'Trym Stene' && realDoc.nameOk === 1, realDoc);
r = await yp('/who', { who: { n: 'Trym Stene', fit }, ...(await id(OWNER, true)) });
ok('…and so does the book', r.status === 200, r);
// a row stored before the token existed: a stranger's (a yard claimed after the cutoff) and an old one (claimed before it)
const sneaky = { ...fakeDoc, who: { n: 'Trym Stene', fit } };
await yard.state.storage.put('y:' + fakeSlug, sneaky);
await yard.indexUpsert(sneaky);
const oldDoc = { slug: 'old-farm', name: 'DJ Sentry', pass: OTHER, created: Date.UTC(2026, 6, 1), updated: Date.now(), who: { n: 'DJ Sentry', fit } };
await yard.state.storage.put('y:old-farm', oldDoc);
await yard.state.storage.put('own:' + OTHER, 'old-farm');
await yard.indexUpsert(oldDoc);
r = await yg('/folk?q=');
const folk = (r.folk || []);
ok('⭐ the book offers the owner by the name, and never the stranger', folk.some((f) => f.slug === realSlug && f.n === 'Trym Stene') && !folk.some((f) => f.slug === fakeSlug), folk.map((f) => [f.slug, f.n, f.house]));
ok('a yard older than the first stranger keeps what it had', folk.some((f) => f.slug === 'old-farm' && f.n === 'DJ Sentry' && f.house === 'DJ Sentry'), folk.map((f) => [f.slug, f.n]));
r = await yg('/echoes');
ok('the echoes the same', (r.echoes || []).some((e) => e.slug === realSlug && e.n === 'Trym Stene') && !(r.echoes || []).some((e) => e.slug === fakeSlug && e.n), (r.echoes || []).map((e) => [e.slug, e.n]));
r = await yp('/whoami', await id(STRANGER));
ok('a letter written from the stranger’s yard is headed with no name', r.n === '' && r.house === 'A Homestead', r);
r = await yp('/whoami', await id(OWNER, true));
ok('…and the owner’s with theirs', r.n === 'Trym Stene' && r.house === 'Trym Stene', r);

console.log('3. a guestbook and a park plot');
r = await yp('/visit', { slug: realSlug, name: 'Trym Stene', ...(await id(STRANGER)) });
const vis = (await yard.state.storage.get('vis:' + realSlug)) || [];
ok('a stranger’s visit goes unsigned', r.status === 200 && vis.length === 1 && vis[0].n === '', vis);
const park = new ParkRoom(fakeState(), { MEMBER_HMAC: HMAC });
const pp = (path, body) => park.fetch(new Request('https://room' + path, { method: 'POST', body: JSON.stringify(body) })).then(async (r2) => ({ status: r2.status, ...(await r2.json()) }));
await pp('/garden/plant', { slot: 0, seed: 'radish', name: 'Trym Stene', ...(await id(STRANGER)) });
await pp('/garden/plant', { slot: 1, seed: 'radish', name: 'Trym Stene', ...(await id(OWNER, true)) });
const plots = (await park.state.storage.get('garden')) || [];
ok('⭐ a stranger’s plot goes unsigned, the owner’s is signed', plots[0] && plots[0].name === '' && plots[1] && plots[1].name === 'Trym Stene', [plots[0] && plots[0].name, plots[1] && plots[1].name]);

console.log('4. a token');
r = await yp('/who', { who: { n: 'Trym Stene', fit }, ...(await id(OWNER)), nt: await nt(OWNER, -1000) });
ok('an expired one is no token', r.status === 400, r);
r = await yp('/who', { who: { n: 'Trym Stene', fit }, ...(await id(OWNER)), nt: (await nt(OWNER)).replace(/.$/, (c) => (c === '0' ? '1' : '0')) });
ok('a forged one neither', r.status === 400, r);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
