// 🎡📈 THE MARKET'S TWO ROOM CALLS (23 Sep 2026), in-process against fake DOs.
//
// The pass worker holds the money; the neighbourhood holds the farms and the square holds the crowd. So:
//   · /take (YardRoom) answers ONLY the internal caller, takes at most what the SAVED farm holds, and MOVES THE
//     STAMP — a device still holding the old eggs is stale (409) and pulls the new count; the seller's own device,
//     fast-forwarded to the new stamp, saves on top of it
//   · /pot (SquareRoom) answers ONLY the internal caller and tells every socket the pot; a winner is named with
//     the name THIS ROOM holds for them, never one the message carries
//   · the router hands both to their rooms only from the 'internal' host, and the public /yards/* door cannot
//     reach /take
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const mod = await import('../src/index.js');
const { YardRoom, SquareRoom } = mod;
const router = mod.default;

function fakeState(sockets = []) {
  const m = new Map();
  return {
    storage: {
      async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; },
      async put(k, v) { m.set(k, structuredClone(v)); },
      async delete(k) { m.delete(k); },
      async list(opts = {}) { const p = opts.prefix || ''; return new Map([...m.entries()].filter(([k]) => k.startsWith(p)).map(([k, v]) => [k, structuredClone(v)])); },
    },
    _m: m, getWebSockets: () => sockets, setWebSocketAutoResponse() {}, acceptWebSocket() {},
  };
}
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const J = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });

console.log('\n1. the neighbourhood takes what the Exchange bought');
const G = '0123456789abcdef', OLD = 'fedcba9876543210';
const st = fakeState();
const yard = new YardRoom(st, { MEMBER_HMAC: 'x' });
await st.storage.put('own:' + G, 'kiwis-farm');
await st.storage.put('y:kiwis-farm', { slug: 'kiwis-farm', name: 'Kiwi', pass: G, created: 1, updated: 1000, mark: 'dev1', state: { goods: { eggs: 9, milk: 2, wool: 0, cheese: 1 }, animals: [] } });
const take = (body, internal = true) => yard.fetch(new Request('https://room/take', { method: 'POST', body: JSON.stringify(body), headers: internal ? { 'x-internal': '1' } : {} })).then(J);
let r = await take({ pass: G, good: 'eggs', n: 5 }, false);
ok('without the internal header the route does not exist', r.status === 404, r);
r = await take({ pass: G, good: 'eggs', n: 5 });
ok('five eggs taken, four left', r.ok && r.took === 5 && r.left === 4, r);
ok('…and the stamp moved past the one the devices know', r.prev === 1000 && r.updated > 1000, r);
const doc = await st.storage.get('y:kiwis-farm');
ok('…in the saved farm too, with no device named as its author', doc.state.goods.eggs === 4 && doc.state.goods.milk === 2 && doc.updated === r.updated && !doc.mark, doc);
const save = (since, eggs) => yard.fetch(new Request('https://room/save', { method: 'POST', body: JSON.stringify({ pass: G, alt: G, since, state: { goods: { eggs, milk: 2, wool: 0, cheese: 1 }, animals: [] } }) })).then(J);
r = await save(1000, 9);
ok('⭐ a device still holding the old eggs is stale — its save cannot bring them back', r.status === 409 && r.err === 'stale', r);
ok('…the farm still holds four', (await st.storage.get('y:kiwis-farm')).state.goods.eggs === 4);
r = await save(doc.updated, 4);
ok('the seller\'s device, fast-forwarded to the new stamp, saves on top of it', r.ok === 1, r);
r = await take({ pass: G, good: 'milk', n: 50 });
ok('asking for more than the farm holds takes what is there', r.ok && r.took === 2 && r.left === 0, r);
r = await take({ pass: G, good: 'wool', n: 3 });
ok('nothing of that good: nothing taken, the stamp does not move', r.ok && r.took === 0 && r.updated === r.prev, r);
r = await take({ pass: G, good: 'cheese', n: 1 });
ok('a good the Exchange does not buy is refused', r.status === 400, r);
r = await take({ pass: 'nobody00nobody00', good: 'eggs', n: 1 });
ok('a person with no farm: nofarm', r.status === 404 && r.err === 'nofarm', r);
await st.storage.put('own:' + OLD, 'old-farm');
await st.storage.put('y:old-farm', { slug: 'old-farm', name: 'Old', pass: OLD, created: 1, updated: 5, state: { goods: { eggs: 3 } } });
r = await take({ pass: 'a1a1a1a1a1a1a1a1', aliases: [OLD], good: 'eggs', n: 3 });
ok('a farm claimed under a world id the pass worker vouches for (an alias) is found', r.ok && r.took === 3, r);

console.log('\n2. the square hears the pot');
const sent = [];
const sock = (a) => ({ a, deserializeAttachment() { return a; }, serializeAttachment() {}, send(s) { sent.push({ to: a.id, m: JSON.parse(s) }); }, close() {} });
const socks = [sock({ id: 'p1', own: G, name: 'KIWI', joined: Date.now() }), sock({ id: 'p2', own: OLD, name: 'BO', joined: Date.now() })];
const sqState = fakeState(socks);
sqState.getWebSocketAutoResponseTimestamp = () => null;
const square = new SquareRoom(sqState, {});
const pot = (body, internal = true) => square.fetch(new Request('https://room/pot', { method: 'POST', body: JSON.stringify(body), headers: internal ? { 'x-internal': '1' } : {} }));
r = await pot({ pot: 150 }, false);
ok('without the internal header nothing is told', r.status === 404 && sent.length === 0, r.status);
await pot({ pot: 151, won: 0 });
ok('every socket hears the pot', sent.length === 2 && sent.every((x) => x.m.t === 'pot' && x.m.pot === 151 && x.m.won === 0 && x.m.name === ''), sent);
sent.length = 0;
await pot({ pot: 100, won: 151, own: G, name: 'A FORGED NAME' });
ok('a win names the winner with the name THIS room holds for them', sent.length === 1 && sent[0].m.won === 151 && sent[0].m.name === 'KIWI', sent);
ok('…to everybody but the winner, whose own spin is celebrating already', sent.every((x) => x.to !== 'p1'), sent);
sent.length = 0;
await pot({ pot: 100, won: 90, own: 'notonthesquare00' });
ok('a winner who is not on the square is nobody by name', sent.every((x) => x.m.name === ''), sent);

console.log('\n3. the router');
const yardsSeen = [], squareSeen = [];
const env = {
  ALLOWED_ORIGIN: 'https://trymstene.com',
  RAVE: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('{}') }) },
  YARDS: { idFromName: (n) => n, get: () => ({ fetch: async (req) => { yardsSeen.push({ url: req.url, internal: req.headers.get('x-internal') }); return new Response('{"ok":1}'); } }) },
  SQUARE: { idFromName: (n) => n, get: () => ({ fetch: async (req) => { squareSeen.push({ url: req.url, internal: req.headers.get('x-internal') }); return new Response('{"ok":1}'); } }) },
};
await router.fetch(new Request('https://internal/yards/take', { method: 'POST', body: '{"pass":"x"}' }), env, {});
ok('the internal host reaches /take with the header', yardsSeen.length === 1 && yardsSeen[0].url === 'https://room/take' && yardsSeen[0].internal === '1', yardsSeen);
await router.fetch(new Request('https://internal/square/pot', { method: 'POST', body: '{"pot":1}' }), env, {});
ok('…and the square\'s /pot with the header', squareSeen.length === 1 && squareSeen[0].url === 'https://room/pot' && squareSeen[0].internal === '1', squareSeen);
yardsSeen.length = 0;
await router.fetch(new Request('https://banana-rave.trymstene.workers.dev/yards/take', { method: 'POST', body: '{"pass":"x"}', headers: { Origin: 'https://trymstene.com', 'x-internal': '1' } }), env, {});
ok('the public door forwards /take WITHOUT the header, whatever the caller sent', yardsSeen.length === 1 && yardsSeen[0].internal === null, yardsSeen);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
