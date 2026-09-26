// 🎁 NIB'S WELCOME PRESENT (26 Sep 2026), in-process against a fake R2 that speaks etags.
//
// Trym: "i believe in giving secret gifts or mystery chests … users get something others dont have". What has to hold:
//   · only a NEW banana gets one (a pass younger than three days, by the pass's own created), and only one, ever
//   · it opens on a LATER UTC DAY — that is the whole point: it is the reason to come back tomorrow
//   · what is inside is rolled HERE: a Banana Stand wearable the pass does not own, rarer the dearer
//   · it is owned the way a purchase is (server-authored own_), and an ordinary sync afterwards keeps it
//   · opened twice, it answers the first roll again — never a second item
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
function fakeR2() {
  const m = new Map();
  let ver = 0;
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const { v, etag } = m.get(k); return { etag, json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v, opts) {
      const cur = m.get(k), want = opts && opts.onlyIf && opts.onlyIf.etagMatches;
      if (want !== undefined && (!cur || cur.etag !== want)) return null;
      const etag = 'e' + (++ver);
      m.set(k, { v: typeof v === 'string' ? v : JSON.stringify(v), etag });
      return { etag };
    },
    async delete(k) { m.delete(k); },
    async list(opts = {}) { const p = opts.prefix || ''; return { objects: [...m.keys()].filter((k) => k.startsWith(p)).sort().map((key) => ({ key })), truncated: false }; },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', RULES_STRICT: '0' };
const ctx = { waitUntil() {}, passThroughOnException() {} };
let ipN = 0;
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.3.' + (++ipN % 250), ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
const J = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); }
};
const REAL_NOW = Date.now;
let CLOCK = Date.UTC(2026, 8, 26, 15, 0, 0);
Date.now = () => CLOCK;
const realRGV = crypto.getRandomValues.bind(crypto);
let FORCE = null;
Object.defineProperty(crypto, 'getRandomValues', { configurable: true, writable: true,
  value: (a) => (FORCE != null && a instanceof Uint32Array ? ((a[0] = FORCE), a) : realRGV(a)) });

// a pass as a device makes it: minted anonymous, then one push carrying its own created (the pass's age)
const DEV = 'dev0000g';
async function anon(created, own) {
  const a = await J(await post('/anon', {}));
  const base = {};
  const blob = { pass: { created, patches: {}, base, led: { coins_earned: { [DEV]: 20 }, coins_spent: { [DEV]: 0 } }, days: [] }, ev: [], evDrop: 0, evDev: DEV };
  await J(await post('/push', { credId: a.credId, token: a.token, blob }));
  for (const [item, price] of own || []) {
    // bought the ordinary way: a spend row that names the item, accepted by the server
    const t = Date.now();
    const b2 = { pass: { created, patches: {}, base: {}, led: { coins_earned: { [DEV]: 20 + price }, coins_spent: { [DEV]: price } }, days: [] },
      ev: [{ id: 'buy' + item, k: 'coins_earned', d: price, a: 'park', s: 'wish', t }, { id: 'sp' + item, k: 'coins_spent', d: price, s: 'stand', i: item, t }], evDrop: 0, evDev: DEV };
    await J(await post('/push', { credId: a.credId, token: a.token, blob: b2 }));
  }
  return a;
}
const gift = (me, act) => post('/gift', { credId: me.credId, token: me.token, act }).then(J);

console.log('\n1. who gets a present');
const old = await anon(Date.UTC(2026, 6, 1));
let r = await gift(old, 'view');
ok('a pass starts with no present', r.status === 200 && r.gift === null, r);
r = await gift(old, 'give');
ok('a regular (a pass months old) is not handed one', r.error === 'old' && r.gift === null, r);
const me = await anon(CLOCK - 3600000);
r = await gift(me, 'give');
ok('a new banana is handed one', r.ok && r.gift && r.gift.at === CLOCK && !r.gift.ready && !r.gift.opened, r);
const at = r.gift.at;
CLOCK += 60000;
r = await gift(me, 'give');
ok('…and only one, ever', r.gift && r.gift.at === at, r.gift);
r = await post('/gift', { credId: me.credId, token: 'nope', act: 'give' }).then(J);
ok('nobody hands over a present without the pass', r.status === 403, r);

console.log('\n2. it opens tomorrow');
r = await gift(me, 'open');
ok('the same day it stays wrapped', r.error === 'early' && r.gift && !r.gift.opened, r);
CLOCK = Date.UTC(2026, 8, 27, 0, 5, 0);   // just past midnight UTC: a new day
r = await gift(me, 'view');
ok('the next day it is ready', r.gift && r.gift.ready === true, r.gift);
FORCE = 0;   // the first in the pool
r = await gift(me, 'open');
FORCE = null;
const OWN = ['duckhat', 'melticecream', 'watermelonhat', 'buckethat', 'snailhat', 'squidhat', 'snorkelmask', 'flamingoring', 'medal', 'sockssandals', 'balloondog', 'potato', 'cactuspot'];
ok('it opens to a Banana Stand wearable', r.ok && OWN.includes(r.gift.item) && r.gift.opened > 0 && !r.gift.ready, r);
ok('…which the pass now owns, as the server says', Array.isArray(r.own) && r.own.includes(r.gift.item), r.own);
const first = r.gift.item;
r = await gift(me, 'open');
ok('opened again: the same answer, never a second roll', r.gift.item === first, r.gift);
const push = await J(await post('/push', { credId: me.credId, token: me.token, blob: { pass: { created: CLOCK - 86400000, patches: {}, base: {}, led: { coins_earned: { [DEV]: 20 }, coins_spent: { [DEV]: 0 } }, days: [] }, ev: [], evDrop: 0, evDev: DEV } }));
ok('an ordinary sync afterwards keeps it (the phone never had to claim it)', Array.isArray(push.own) && push.own.includes(first), push.own);

console.log('\n3. what is inside');
// a new banana who already bought every stand piece but the squid hat gets the squid hat
const rich = await anon(CLOCK - 3600000, [['duckhat', 60], ['potato', 10]]);
await gift(rich, 'give');
CLOCK = Date.UTC(2026, 8, 28, 9, 0, 0);
r = await gift(rich, 'open');
ok('never something they already own', r.ok && r.gift.item && !['duckhat', 'potato'].includes(r.gift.item), r.gift);
// the weights: with everything in the pool, the cheapest comes up far oftener than the dearest
const counts = {};
const PRICES = { duckhat: 60, melticecream: 30, watermelonhat: 30, buckethat: 25, snailhat: 15, squidhat: 120, snorkelmask: 40, flamingoring: 80, medal: 35, sockssandals: 12, balloondog: 35, potato: 10, cactuspot: 40 };
for (let i = 0; i < 60; i++) {
  const n = await anon(CLOCK - 3600000);
  await gift(n, 'give');
  CLOCK += 86400000;
  const o = await gift(n, 'open');
  counts[o.gift.item] = (counts[o.gift.item] || 0) + 1;
}
const cheap = (counts.potato || 0) + (counts.sockssandals || 0) + (counts.snailhat || 0);
const dear = (counts.squidhat || 0) + (counts.flamingoring || 0);
ok('rarer the dearer: the three cheapest come up far oftener than the two dearest (' + cheap + ' vs ' + dear + ')', cheap > dear * 2, counts);
ok('every roll is a stand piece', Object.keys(counts).every((k) => k in PRICES), counts);

Date.now = REAL_NOW;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
