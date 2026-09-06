// 🏆 A WEEK OF NEIGHBOURLINESS — the yard room counts what each visitor did in
// OTHER people's yards inside a window; your own yard never counts; the route
// answers only to the internal caller.
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const { YardRoom } = await import('../src/index.js');

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
const st = fakeState();
const yard = new YardRoom(st, { MEMBER_HMAC: 'x' });
const now = Date.now(), DAY = 86400000;
const from = now - 7 * DAY, to = now + 1;
// two yards: Jade's (owner id prefix jade0000) and Be's (be000000)
await st.storage.put('y:jade-green', { slug: 'jade-green', name: 'Jade', pass: 'jade0000ffffffff', created: 1, updated: now, state: null });
await st.storage.put('y:be-s-place', { slug: 'be-s-place', name: "Be's Place", pass: 'be000000ffffffff', created: 1, updated: now, state: null });
// Kiwi visits and hugs at Jade's, waters at Be's; Be hugs at Jade's; Jade hugs her OWN animals (not neighbourly); an old row from last month
await st.storage.put('hug:jade-green', [
  { i: 'h1', n: 'Kiwi', o: 'kiwi0000', d: 'd', t: now - DAY },
  { i: 'h2', n: 'Kiwi', o: 'kiwi0000', d: 'd', t: now - 2 * DAY },
  { i: 'h3', n: 'Be', o: 'be000000', d: 'd', t: now - DAY },
  { i: 'h4', n: 'Jade', o: 'jade0000', d: 'd', t: now - DAY },
  { i: 'h5', n: 'Kiwi', o: 'kiwi0000', d: 'd', t: now - 30 * DAY },
]);
await st.storage.put('wat:be-s-place', [{ n: 'Kiwi', o: 'kiwi0000', d: 'd', t: now - 3 * DAY }]);
await st.storage.put('fed:be-s-place', [{ n: 'Kiwi', o: 'kiwi0000', d: 'd', t: now - 3 * DAY }]);
await st.storage.put('vis:jade-green', [{ n: 'Kiwi', o: 'kiwi0000', day: 'd', t: now - DAY }, { n: 'Kiwi', o: 'kiwi0000', day: 'd2', t: now - 2 * DAY }]);
await st.storage.put('g:jade-green', [{ n: 'Be', o: 'be000000', x: 'nice hens', day: 'd', t: now - DAY }]);

const q = (headers) => yard.fetch(new Request('https://room/week?from=' + from + '&to=' + to, { headers })).then(async (r) => ({ status: r.status, ...(await r.json()) }));
let r = await q({});
ok('without the internal header the route does not exist', r.status === 404, r);
r = await q({ 'x-internal': '1' });
ok('the internal caller gets the week', r.status === 200 && r.who, r);
ok('Kiwi: 2 hugs, 1 feed, 1 watering, 2 visits, no notes — inside the window only', JSON.stringify(r.who.kiwi0000) === JSON.stringify({ hugs: 2, feeds: 1, waters: 1, signs: 0, visits: 2 }), r.who.kiwi0000);
ok('Be: a hug and a note at Jade\'s', r.who.be000000 && r.who.be000000.hugs === 1 && r.who.be000000.signs === 1, r.who.be000000);
ok('Jade hugging her own animals is not neighbourliness', !r.who.jade0000, r.who);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
