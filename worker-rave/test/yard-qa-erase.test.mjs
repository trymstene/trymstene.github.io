// 🧪 THE YARD ROOM CLEANS UP AFTER THE PROOF, in-process against a fake DO.
// /qa-erase: the PROVEN owner of a testy-proof-… yard may delete it (doc,
// pointers, aliases, guestbook rows, index entry); any testy-proof-… yard
// older than two days goes with it; a real yard is never touchable; the
// census treats every testy-* slug as QA.
globalThis.WebSocketRequestResponsePair = class { constructor(a, b) { this.a = a; this.b = b; } };
const { YardRoom } = await import('../src/index.js');

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

const st = fakeState();
const yard = new YardRoom(st, { MEMBER_HMAC: HMAC, WT_ENFORCE: '1' });
const yp = (path, body) => yard.fetch(new Request('https://room' + path, { method: 'POST', body: JSON.stringify(body) }))
  .then(async (r2) => ({ status: r2.status, ...(await r2.json()) }));
const yg = (path) => yard.fetch(new Request('https://room' + path)).then((r2) => r2.json());
const P = 'aaaaaaaaaaaaaaa1', S = 'phone-a-sid', P2 = 'bbbbbbbbbbbbbbb2', S2 = 'phone-b-sid', P3 = 'ccccccccccccccc3';

console.log('1. the proof\'s yard, a real yard beside it');
let r = await yp('/claim', { name: 'Testy Proof 062214', pass: P, alt: S, wt: await wt(P) });
ok('the proof claims testy-proof-…', r.slug === 'testy-proof-062214', r);
r = await yp('/save', { state: { stage: 1, items: [], animals: [{ id: 'h1', sp: 'hen' }] }, pass: P, alt: S, wt: await wt(P) });
ok('…and saves', r.ok === 1, r);
await st.storage.put('g:testy-proof-062214', [{ who: 'x', text: 'hi' }]);
r = await yp('/claim', { name: 'Be\'s Place', pass: P2, alt: S2, wt: await wt(P2) });
ok('a real yard exists too', r.slug === 'be-s-place', r);

console.log('2. who may erase');
r = await yp('/qa-erase', { pass: P, alt: S });
ok('no token → 401', r.status === 401, r);
r = await yp('/qa-erase', { pass: P, alt: S, wt: 'not.a.token' });
ok('a wrong token → 401', r.status === 401, r);
r = await yp('/qa-erase', { pass: P2, alt: S2, wt: await wt(P2) });
ok('the real yard\'s owner erases nothing (not a testy-proof slug)', r.ok === 1 && r.gone.length === 0, r);
r = await yp('/qa-erase', { pass: P3, alt: 'zzz', wt: await wt(P3) });
ok('a proven stranger with no yard erases nothing', r.ok === 1 && r.gone.length === 0, r);
r = await yp('/mine', { pass: P, alt: S, wt: await wt(P) });
ok('the proof\'s yard is still there', r.slug === 'testy-proof-062214', r);

console.log('3. the owner erases it, whole');
r = await yp('/qa-erase', { pass: P, alt: S, wt: await wt(P) });
ok('gone', r.ok === 1 && r.gone.length === 1 && r.gone[0] === 'testy-proof-062214', r);
r = await yp('/mine', { pass: P, alt: S, wt: await wt(P) });
ok('/mine finds nothing', r.slug === null, r);
ok('doc, pointers and guestbook rows are gone', !st._m.has('y:testy-proof-062214') && !st._m.has('own:' + P) && !st._m.has('own:' + S) && !st._m.has('g:testy-proof-062214'),
  [...st._m.keys()]);
ok('the index no longer lists it', !(st._m.get('index') || []).some((e) => e.slug === 'testy-proof-062214'), st._m.get('index'));
ok('the real yard is untouched', st._m.has('y:be-s-place') && st._m.get('own:' + P2) === 'be-s-place');
r = await yp('/qa-erase', { pass: P, alt: S, wt: await wt(P) });
ok('a second erase is a quiet no-op', r.ok === 1 && r.gone.length === 0, r);

console.log('4. a crashed run\'s leftovers go with the next erase');
const old = Date.now() - 3 * 86400000;
await st.storage.put('y:testy-proof-000001', { slug: 'testy-proof-000001', name: 'Testy Proof 000001', pass: P3, created: old, updated: old, state: null });
await st.storage.put('own:' + P3, 'testy-proof-000001');
await st.storage.put('index', [...(st._m.get('index') || []), { slug: 'testy-proof-000001', name: 'x', stage: 0, updated: old }]);
r = await yp('/claim', { name: 'Testy Proof 999999', pass: P, alt: S, wt: await wt(P) });
ok('a fresh proof yard (another run, tonight)', r.slug === 'testy-proof-999999', r);
r = await yp('/qa-erase', { pass: P2, alt: S2, wt: await wt(P2) });
ok('any proven person\'s erase sweeps the stale one and spares tonight\'s', r.ok === 1 && r.gone.length === 1 && r.gone[0] === 'testy-proof-000001', r);
ok('the stale doc and its pointer are gone', !st._m.has('y:testy-proof-000001') && !st._m.has('own:' + P3));
ok('tonight\'s is still there', st._m.has('y:testy-proof-999999'));

console.log('5. the census treats every testy-* as QA');
r = await yp('/save', { state: { stage: 1, items: [], animals: [{ id: 'h9', sp: 'hen' }] }, pass: P, alt: S, wt: await wt(P) });
r = await yp('/save', { state: { stage: 2, items: [], animals: [{ id: 'h2', sp: 'hen' }] }, pass: P2, alt: S2, wt: await wt(P2) });
const s = await yg('/stats');
ok('the list still carries both (owner tags, for HQ)', s.list.length === 2, s.list.map((e) => e.slug));
ok('the census counts the real yard only', s.census.named === 1 && s.census.withAnimals === 1 && s.census.stage[2] === 1 && s.census.stage[1] === 0, s.census);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
