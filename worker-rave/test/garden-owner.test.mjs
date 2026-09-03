// 🪪 THE GARDEN OWNER-ID HOLE + THE WORLD TOKEN, in-process against a fake DO.
// Before 2 Sep 2026 the feed published every plot's 8-char owner id and the
// room accepted that same string as proof; two requests took over a garden.
// Now: the wire carries a keyed hash, `mine` is the room's own verdict, a
// proven person is never somebody's alt, the ledger learns only from proof,
// and a wrong token is refused (an absent one only under WT_ENFORCE).
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const { ParkRoom, YardRoom } = await import('../src/index.js');

const HMAC = 'test-member-hmac';
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmac(msg) {
  const k = await crypto.subtle.importKey('raw', te.encode(HMAC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, te.encode(msg)));
}
async function wt(gid, aliases = [], ttl = 86400000) {
  const base = gid + '.' + (Date.now() + ttl) + '.' + aliases.join(',');
  return base + '.' + (await hmac('wt:' + base));
}
function fakeState() {
  const m = new Map();
  return {
    storage: {
      async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; },
      async put(k, v) { m.set(k, structuredClone(v)); },
      async delete(k) { m.delete(k); },
      async list(opts = {}) {
        const p = opts.prefix || '';
        return new Map([...m.entries()].filter(([k]) => k.startsWith(p)).map(([k, v]) => [k, structuredClone(v)]));
      },
    },
    _m: m,
    getWebSockets: () => [],
    setWebSocketAutoResponse() {},
    acceptWebSocket() {},
  };
}
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const mkPark = (env) => new ParkRoom(fakeState(), { MEMBER_HMAC: HMAC, ...env });
const get = (room, q) => room.fetch(new Request('https://room/garden?' + q)).then((r) => r.json());
const postJ = (room, path, body) => room.fetch(new Request('https://room' + path, { method: 'POST', body: JSON.stringify(body) }))
  .then(async (r) => ({ status: r.status, ...(await r.json()) }));

// people: gid = 16 hex (a person), sid = 12 chars (a browser)
const V = 'a1b2c3d4e5f60718', Vs = 'deadbeef1234';   // Kiwi: person + her browser
const A = '0f0f0f0f0f0f0f0f', As = 'attacker0001';   // the attacker
const P = '0123456789abcdef';                         // a player signing in on an old browser
const S = 'feedfacecafe';                             // …that browser's old sid (signed-out plots)
const Q = '9999888877776666', P2 = 'abcdefabcdefabcd'; // an anonymous gid folded into P2

console.log('1. the wire');
let park = mkPark({});
let r = await postJ(park, '/garden/plant', { slot: 0, seed: 'radish', name: 'Kiwi', pass: V, alt: Vs, wt: await wt(V) });
ok('a proven person plants', r.ok === 1, r);
ok('the reply carries a keyed hash, never the id', typeof r.slots[0].who === 'string' && /^[a-f0-9]{12}$/.test(r.slots[0].who) && !('passShort' in r.slots[0]), r.slots[0]);
ok('…and the room\'s own verdict for the grower', r.slots[0].mine === 1);
let feed = await get(park, `pass=${A.slice(0, 8)}&alt=${As.slice(0, 8)}`);
ok('a stranger\'s read: same hash, no mine, no id anywhere', feed.slots[0].who === r.slots[0].who && !feed.slots[0].mine
  && !JSON.stringify(feed).includes(V.slice(0, 8)), feed.slots[0]);

console.log('2. the takeover, closed');
r = await postJ(park, '/garden/harvest', { slot: 0, pass: A, alt: V.slice(0, 8) });   // the old exploit: victim id as alt
ok('a published-looking id as alt no longer owns the plot (no token)', !r.ok, r);
r = await postJ(park, '/garden/harvest', { slot: 0, pass: A, alt: V.slice(0, 8), wt: await wt(A) });
ok('…nor with the attacker\'s own valid token', !r.ok, r);
feed = await get(park, `pass=${A.slice(0, 8)}&alt=${V.slice(0, 8)}&wt=${await wt(A)}`);
ok('the ledger did not learn victim → attacker', !feed.slots[0].mine, feed.slots[0]);
feed = await get(park, `pass=${V.slice(0, 8)}&alt=${Vs.slice(0, 8)}&wt=${await wt(V)}`);
ok('Kiwi still owns her plot', feed.slots[0].mine === 1, feed.slots[0]);
const sidmap = park.state._m.get('sidmap') || {};
ok('sidmap holds no entry for the victim', !(V.slice(0, 8) in sidmap), sidmap);

console.log('3. the legit fold still works');
r = await postJ(park, '/garden/plant', { slot: 1, seed: 'radish', name: 'Sam', pass: S, alt: S });   // signed out: pass === alt, no token
ok('a signed-out browser plants without a token', r.ok === 1, r);
feed = await get(park, `pass=${P.slice(0, 8)}&alt=${S.slice(0, 8)}&wt=${await wt(P)}`);
ok('signing in on that browser folds the plot to the person', feed.slots[1].mine === 1, feed.slots[1]);
feed = await get(park, `pass=${P.slice(0, 8)}&alt=otherdev&wt=${await wt(P)}`);
ok('…and it is theirs from another device too', feed.slots[1].mine === 1, feed.slots[1]);
feed = await get(park, `pass=${A.slice(0, 8)}&alt=${P.slice(0, 8)}&wt=${await wt(A)}`);
ok('a proven person\'s id can never be somebody else\'s alt', !feed.slots[1].mine, feed.slots[1]);
feed = await get(park, `pass=${A.slice(0, 8)}&alt=${S.slice(0, 8)}`);
ok('an unproven read learns nothing', !feed.slots[1].mine && !(park.state._m.get('sidmap') || {})[S.slice(0, 8)] !== undefined);
feed = await get(park, `pass=${P.slice(0, 8)}&alt=${S.slice(0, 8)}&wt=${await wt(P)}`);
ok('Sam\'s plot is still Sam\'s', feed.slots[1].mine === 1);

console.log('4. aliases (an anonymous pass folded into a real one)');
r = await postJ(park, '/garden/plant', { slot: 2, seed: 'radish', name: 'Q', pass: Q, alt: 'qbrowser', wt: await wt(Q) });
ok('the anonymous person plants', r.ok === 1, r);
feed = await get(park, `pass=${P2.slice(0, 8)}&alt=newbrowsr&wt=${await wt(P2, [Q])}`);
ok('the real pass sees the alias\'s plot as mine', feed.slots[2].mine === 1, feed.slots[2]);
feed = await get(park, `pass=${P2.slice(0, 8)}&alt=newbrowsr&wt=${await wt(P2)}`);
ok('…and it stays theirs once the token drops the alias (folded for good)', feed.slots[2].mine === 1, feed.slots[2]);

console.log('5. the token gate');
r = await postJ(park, '/garden/plant', { slot: 3, seed: 'radish', name: 'X', pass: A, alt: As, wt: 'not.a.token.at-all' });
ok('a wrong token is refused', r.status === 401 && r.err === 'token', r);
r = await postJ(park, '/garden/plant', { slot: 3, seed: 'radish', name: 'X', pass: A, alt: As, wt: await wt(V) });
ok('somebody else\'s token is refused', r.status === 401, r);
r = await postJ(park, '/garden/plant', { slot: 3, seed: 'radish', name: 'X', pass: A, alt: As, wt: await wt(A, [], -1000) });
ok('an expired token is refused', r.status === 401, r);
r = await postJ(park, '/garden/plant', { slot: 3, seed: 'radish', name: 'X', pass: A, alt: As });
ok('no token still passes in soft mode', r.ok === 1, r);
const strict = mkPark({ WT_ENFORCE: '1' });
r = await postJ(strict, '/garden/plant', { slot: 0, seed: 'radish', name: 'X', pass: A, alt: As });
ok('WT_ENFORCE refuses an unproven person-id claim', r.status === 401, r);
r = await postJ(strict, '/garden/plant', { slot: 0, seed: 'radish', name: 'X', pass: As, alt: As });
ok('…but a signed-out browser (pass = alt) still plants', r.ok === 1, r);
r = await postJ(strict, '/garden/plant', { slot: 1, seed: 'radish', name: 'X', pass: A, alt: As, wt: await wt(A) });
ok('…and a proven person plants', r.ok === 1, r);

console.log('6. yards');
const yard = new YardRoom(fakeState(), { MEMBER_HMAC: HMAC });
const yp = (path, body) => yard.fetch(new Request('https://room' + path, { method: 'POST', body: JSON.stringify(body) }))
  .then(async (r2) => ({ status: r2.status, ...(await r2.json()) }));
r = await yp('/claim', { name: 'Testy Yard', pass: P, alt: S, wt: await wt(P) });
ok('a proven person claims', r.status === 200 && !!r.slug, r);
const slug = r.slug;
r = await yp('/save', { state: { stage: 1, items: [] }, pass: P, alt: S, wt: 'wrong' });
ok('a wrong token cannot save the yard', r.status === 401, r);
r = await yp('/save', { state: { stage: 1, items: [] }, pass: P, alt: S });
ok('no token still saves in soft mode', r.ok === 1, r);
r = await yp('/mine', { pass: P2, alt: 'zzz', wt: await wt(P2, [P]) });
ok('an alias finds the yard for the person it folded into', r.slug === slug, r);
ok('…and the yard is re-keyed to them', (yard.state._m.get('y:' + slug) || {}).pass === P2);
const st = await yard.fetch(new Request('https://room/stats')).then((r2) => r2.json());
ok('/stats reports the rollout counters', st.wt && st.wt.ok >= 1 && st.wt.miss >= 1 && st.wt.none >= 1, st.wt);


console.log('7. a known person without their token is nobody');
r = await postJ(park, '/garden/harvest', { slot: 0, pass: V.slice(0, 8), alt: V.slice(0, 8) });   // pass = alt, the "signed-out" shape, with Kiwi's id
ok('the signed-out shape cannot harvest a proven person\'s plot', !r.ok, r);
feed = await get(park, `pass=${V.slice(0, 8)}&alt=${V.slice(0, 8)}`);
ok('…nor see it as mine', !feed.slots[0].mine, feed.slots[0]);
feed = await get(park, `pass=${V.slice(0, 8)}&alt=${Vs.slice(0, 8)}&wt=${await wt(V)}`);
ok('with her token it is hers as ever', feed.slots[0].mine === 1);
console.log('8. the ledger never re-points a learned sid');
const S2 = 'sidsid00cafe';
r = await postJ(park, '/garden/plant', { slot: 4, seed: 'radish', name: 'S2', pass: S2, alt: S2 });
feed = await get(park, `pass=${P.slice(0, 8)}&alt=${S2.slice(0, 8)}&wt=${await wt(P)}`);
ok('the first proven person to sign in on that browser learns the pairing', feed.slots[4].mine === 1);
feed = await get(park, `pass=${A.slice(0, 8)}&alt=${S2.slice(0, 8)}&wt=${await wt(A)}`);
ok('a second proven person naming the same sid does not take it', !feed.slots[4].mine, feed.slots[4]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
