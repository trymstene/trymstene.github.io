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

console.log('9. a stale yard save is refused');
r = await yp('/save', { state: { stage: 1, items: [] }, pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('a save without a stamp still lands', r.ok === 1 && r.updated > 0, r);
const stamp = r.updated;
r = await yp('/save', { state: { stage: 2, items: [] }, since: stamp - 1000, pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('a device that synced before the current stamp is refused 409 stale', r.status === 409 && r.err === 'stale' && r.updated === stamp, r);
r = await yp('/save', { state: { stage: 2, items: [] }, since: stamp, pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('…and one that synced at the current stamp saves', r.ok === 1 && r.updated >= stamp, r);

// 10. 🏷 THE PUBLISH MARK — a device must not conflict with its own flush.
// The save sent as the tab goes away gets no answer, so the device cannot
// learn the new stamp. The mark lets the next boot (and the 409) recognise
// that stamp as its own work instead of reloading the yard over the player.
console.log('10. the publish mark tells a device its own flush');
r = await yp('/save', { state: { stage: 3, items: [] }, mark: 'abc12345', pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('a save hands its mark back', r.ok === 1 && r.mark === 'abc12345', r);
const own = r.updated;
r = await yp('/mine', { pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('…/mine carries the mark of the last publish', r.mark === 'abc12345' && r.updated === own, { mark: r.mark });
r = await yp('/save', { state: { stage: 4, items: [] }, since: own - 5000, mark: 'def67890', pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('a stale save is refused WITH the mark, so the device can see the stamp is its own', r.status === 409 && r.mark === 'abc12345' && r.updated === own, r);
r = await yp('/save', { state: { stage: 4, items: [] }, since: own, mark: 'def67890', pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('…taking that stamp, the save lands and the mark moves on', r.ok === 1 && r.mark === 'def67890', r);
r = await yp('/save', { state: { stage: 5, items: [] }, mark: 'NOPE!!', since: r.updated, pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('a junk mark is dropped, never stored', r.ok === 1 && r.mark === null, r);

// 11. 🥚 THE PANTRY TRAVELS. Produce, the kitchen shelf and the shed of
// unplaced furniture were the last things a player HOLDS that never left the
// browser: eggs collected on a phone were invisible on a laptop.
console.log('11. the pantry travels with the yard');
r = await yp('/save', { state: { stage: 1, items: [],
  goods: { eggs: 6, milk: 2, wool: 40, cheese: 1 },
  pantry: { egg: 4, radish: 2, NOPE: 9, tomato: 0 },
  shed: [{ id: 'bench' }, { id: 'tailor' }, { id: 'BAD ID!' }] },
  since: r.updated, mark: 'pantry01', pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('a save carrying the pantry lands', r.ok === 1, r);
r = await yp('/mine', { pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('produce comes home on the other device', r.goods && r.goods.eggs === 6 && r.goods.wool === 40 && r.goods.cheese === 1, r.goods);
ok('…the kitchen shelf too, junk keys and empty counts dropped', r.pantry && r.pantry.egg === 4 && r.pantry.radish === 2 && !('NOPE' in r.pantry) && !('tomato' in r.pantry), r.pantry);
ok('…and the shed, with a bad id refused', Array.isArray(r.shed) && r.shed.length === 2 && r.shed[0].id === 'bench', r.shed);
const vis = await yard.fetch(new Request('https://room/yard?slug=' + r.slug)).then((x) => x.json());
ok('a VISITOR never sees what the player is holding', !vis.goods && !vis.pantry && !vis.shed, { g: vis.goods, p: vis.pantry, s: vis.shed });
r = await yp('/save', { state: { stage: 1, items: [], goods: { eggs: 9999, milk: -5 }, pantry: {}, shed: [] },
  since: 0, mark: 'pantry02', pass: P2, alt: 'zzz', wt: await wt(P2) });
r = await yp('/mine', { pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('counts are clamped, never negative and never absurd', r.goods.eggs === 999 && r.goods.milk === 0, r.goods);
ok('…an emptied shelf and shed are honoured (the player spent them)', Object.keys(r.pantry).length === 0 && r.shed.length === 0, { p: r.pantry, s: r.shed });
// ⚠️ THE MIXED-VERSION GUARD: a tab still running yesterday's script saves a
// yard with no pantry in it. That must not erase the shelf on every device.
r = await yp('/save', { state: { stage: 2, items: [] }, since: 0, mark: 'oldtab01', pass: P2, alt: 'zzz', wt: await wt(P2) });
r = await yp('/mine', { pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('a save from an older tab leaves the fields ABSENT, never empty', r.goods === undefined && r.pantry === undefined && r.shed === undefined, { g: r.goods, p: r.pantry, s: r.shed });

// 12. 🐐 A VISITED FARM HAS ANIMALS IN IT, and a neighbour can help with them.
// The doc always held the flock; the visitor half of the wire stopped short.
// The two help verbs are shaped like the watering can: a per-yard, per-day
// note the owner folds in — a visitor never writes the owner's doc.state.
console.log('12. visiting a farm: the flock, a hug, a filled trough');
const FLOCK = [{ sp: 'goat', b: 4, name: 'Gunnar', id: 314159, ad: 20000, sd: 77, gs: 3 },
  { sp: 'hen', b: 1, name: '', id: 271828, ad: 20001, sd: 12, gs: 9 }];
r = await yp('/save', { state: { stage: 2, items: [], animals: FLOCK }, since: 0, mark: 'flock001', pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('the owner publishes a flock', r.ok === 1, r);
const seen = await yard.fetch(new Request('https://room/yard?slug=' + r.slug)).then((x) => x.json());
ok('a VISITOR now sees it, dressed and named', Array.isArray(seen.animals) && seen.animals.length === 2
  && seen.animals[0].sp === 'goat' && seen.animals[0].name === 'Gunnar' && seen.animals[0].id === 314159, seen.animals);
ok('…and still sees none of what the player is holding', !seen.goods && !seen.pantry && !seen.shed, { g: seen.goods, p: seen.pantry });

r = await yp('/hug', { slug: seen.slug, id: 314159, name: 'Kiwi', pass: V, alt: Vs, wt: await wt(V) });
ok('a neighbour hugs Gunnar', r.ok === 1 && !r.already, r);
r = await yp('/hug', { slug: seen.slug, id: 314159, name: 'Kiwi', pass: V, alt: Vs, wt: await wt(V) });
ok('…once per animal per day, whoever gives it', r.already === 1, r);
r = await yp('/hug', { slug: seen.slug, id: 271828, name: 'Kiwi', pass: V, alt: Vs, wt: await wt(V) });
ok('…but the hen is a different animal', r.ok === 1 && !r.already, r);
r = await yp('/hug', { slug: seen.slug, id: 999999, name: 'Kiwi', pass: V, alt: Vs, wt: await wt(V) });
ok('an animal that is not in the pen is refused', r.status === 400, r);
r = await yp('/hug', { slug: seen.slug, id: 314159, name: 'me', pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('you cannot hug your own animals from the visitor door', r.status === 400 && r.err === 'own', r);

r = await yp('/feed', { slug: seen.slug, name: 'Kiwi', pass: V, alt: Vs, wt: await wt(V) });
ok('a neighbour fills the trough', r.ok === 1 && !r.already, r);
r = await yp('/feed', { slug: seen.slug, name: 'Jade', pass: A, alt: As, wt: await wt(A) });
ok('…one yard, one day, even from somebody else', r.already === 1, r);
const seen2 = await yard.fetch(new Request('https://room/yard?slug=' + seen.slug)).then((x) => x.json());
ok('the next visitor sees a full trough, not their own farm\'s', seen2.feedAt > 0, seen2.feedAt);

r = await yp('/news', { pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('the owner comes home to the hugs', Array.isArray(r.hugs) && r.hugs.length === 2
  && r.hugs.some((h) => h.i === 314159 && h.n === 'Kiwi'), r.hugs);
ok('…and to the filled trough', Array.isArray(r.feeds) && r.feeds.length === 1 && r.feeds[0].n === 'Kiwi', r.feeds);

// 13. 📖 THE FARM STORY reads the same rows as the away-news, but whole, in
// order, and WITHOUT consuming them: /news exists to fire toasts and stamps
// its seen marker on the way out, so a story cannot be built on it.
console.log('13. the farm story: a read that changes nothing');
r = await yp('/news', { pass: P2, alt: 'zzz', wt: await wt(P2) });          // consume the news
r = await yp('/diary', { pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('the story still has everything the news already ate', Array.isArray(r.rows)
  && r.rows.some((x) => x.k === 'hug') && r.rows.some((x) => x.k === 'feed'), (r.rows || []).map((x) => x.k));
ok('a hug names the animal it was for', r.rows.some((x) => x.k === 'hug' && x.an === 'Gunnar' && x.sp === 'goat'),
  (r.rows || []).filter((x) => x.k === 'hug'));
ok('rows are newest first', r.rows.every((x, i) => i === 0 || r.rows[i - 1].t >= x.t), r.rows.map((x) => x.t));
ok('nobody\'s id rides along, only the name they signed with', !JSON.stringify(r.rows).includes('"o"'), r.rows[0]);
const again = await yp('/diary', { pass: P2, alt: 'zzz', wt: await wt(P2) });
ok('…and reading it twice reads the same story', again.rows.length === r.rows.length, { a: r.rows.length, b: again.rows.length });
r = await yp('/diary', { pass: V, alt: Vs, wt: await wt(V) });
ok('a stranger has no story to read here', r.status === 404, r);

// 14. 🌍 THE CENSUS — /yards/stats already loaded every homestead document
// and threw away everything but four counts. The world is in hand; counting it
// is arithmetic inside a loop that was running anyway.
console.log('14. the world census');
const stats = await yard.fetch(new Request('https://room/stats')).then((x) => x.json());
ok('the census rides along with the headline counts', !!stats.census, Object.keys(stats));
ok('homesteads are counted by what they have grown into', Array.isArray(stats.census.stage) && stats.census.stage.length === 4
  && stats.census.stage.reduce((a, b) => a + b, 0) > 0, stats.census.stage);
ok('the flock is counted, and so is how many yards have one', stats.census.animals > 0 && stats.census.withAnimals > 0, stats.census);
ok('the neighbourhood mechanic is measured at last', stats.census.social.hugs > 0 && stats.census.social.feeds > 0, stats.census.social);
ok('…and a named sign is told from an unnamed one', stats.census.named >= 0, stats.census.named);
// ⚠️ Trym's own test yards once made this desk read as a boom
const before = stats.census.animals;
await yp('/save', { state: { stage: 3, items: [], animals: [{ sp: 'cow', b: 1, id: 111111, ad: 1 }] },
  since: 0, mark: 'qacow01', pass: V, alt: Vs, wt: await wt(V), name: 'Testy Boom' });
const after = await yard.fetch(new Request('https://room/stats')).then((x) => x.json());
ok('a QA yard never inflates the census', after.census.animals === before, { before, after: after.census.animals });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
