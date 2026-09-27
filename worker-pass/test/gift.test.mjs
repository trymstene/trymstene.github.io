// 🎁 NIB'S WELCOME PRESENT (26 Sep 2026), in-process against a fake R2 that speaks etags.
//
// Trym: "i believe in giving secret gifts or mystery chests … users get something others dont have". What has to hold:
//   · only a NEW banana gets one (a pass younger than three days, by the pass's own created), and only one, ever
//   · it opens on a LATER UTC DAY — that is the whole point: it is the reason to come back tomorrow
//   · what is inside is rolled HERE: a Banana Stand wearable the pass does not own, rarer the dearer
//   · it is owned the way a purchase is (server-authored own_), and an ordinary sync afterwards keeps it
//   · opened twice, it answers the first roll again — never a second item
//
// 🎲 EVERY RUN ROLLS THE SAME PRESENTS (27 Sep 2026). The clock is pinned and so is every draw the roll makes (FORCE,
// SEQ below). Before that this file failed 4 of the 13 CI runs since it landed, and 18 of 50 runs locally: its "rich"
// pass never owned what it had bought (event ids the server does not accept, see anon()), so "never something they
// already own" was decided by the real random draw, which landed on the potato or the duck hat about one time in four.
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
// the roll is crypto.getRandomValues on a Uint32Array (giftRoll; nothing else on these routes draws one): FORCE pins
// every draw to one value, SEQ makes the draws a seeded series. Byte draws (the pass ids) stay real.
const realRGV = crypto.getRandomValues.bind(crypto);
let FORCE = null, SEQ = null;
Object.defineProperty(crypto, 'getRandomValues', { configurable: true, writable: true,
  value: (a) => {
    if (!(a instanceof Uint32Array) || (FORCE == null && !SEQ)) return realRGV(a);
    for (let i = 0; i < a.length; i++) a[i] = FORCE != null ? FORCE : SEQ();
    return a;
  } });
// splitmix32: a small, well-spread 32-bit series from a seed (the same generator the site's daily banana uses)
const splitmix32 = (seed) => () => {
  seed = (seed + 0x9e3779b9) | 0;
  let z = seed;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
};

// a pass as a device makes it: minted anonymous, then one push carrying its own created (the pass's age). `own` buys
// stand pieces the ordinary way, in a second push: coins earned at the park's wishing fountain, then a spend row that
// names each piece, all judged by the server's wallet. ⚠️ AN EVENT ID IS 6 TO 12 HEX CHARACTERS, like the ones a phone
// mints (src/lib/banana-pass.js): the server drops any other id without a word. Ids like 'buyduckhat' bought nothing
// at all, and the wish pays at most 50 a toss, so the duck hat's single 60-coin earn would have been refused anyway.
const DEV = 'dev0000g';
let evN = 0;
const evId = () => (0x10000000 + (++evN)).toString(16);   // eight hex characters, never the same twice
async function anon(created, own) {
  const a = await J(await post('/anon', {}));
  const cost = (own || []).reduce((t, [, price]) => t + price, 0);
  const opening = cost ? 300 : 20;   // a new record's wallet opens at most at 300 (the server's NEW_FLOOR)
  const blob = { pass: { created, patches: {}, base: {}, led: { coins_earned: { [DEV]: opening }, coins_spent: { [DEV]: 0 } }, days: [] }, ev: [], evDrop: 0, evDev: DEV };
  await J(await post('/push', { credId: a.credId, token: a.token, blob }));
  if (cost) {
    const t = Date.now(), ev = [];
    let earned = 0;
    while (opening + earned < cost) { const d = Math.min(50, cost - opening - earned); ev.push({ id: evId(), k: 'coins_earned', d, a: 'park', s: 'wish', t }); earned += d; }
    for (const [item, price] of own) ev.push({ id: evId(), k: 'coins_spent', d: price, s: 'stand', i: item, t });
    const b2 = { pass: { created, patches: {}, base: {}, led: { coins_earned: { [DEV]: opening + earned }, coins_spent: { [DEV]: cost } }, days: [] }, ev, evDrop: 0, evDev: DEV };
    a.bought = await J(await post('/push', { credId: a.credId, token: a.token, blob: b2 }));   // its `own` is what the server says they own
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
const PRICES = { duckhat: 60, melticecream: 30, watermelonhat: 30, buckethat: 25, snailhat: 15, squidhat: 120, snorkelmask: 40, flamingoring: 80, medal: 35, sockssandals: 12, balloondog: 35, potato: 10, cactuspot: 40 };
// a new banana who already bought every stand piece but the squid hat gets the squid hat, whatever the draw. The draw
// is pinned to the first piece of a full pool (the duck hat, which they own), so this proves the owned pieces are
// taken OUT of the pool, not merely unlikely: there is nothing else it could open to.
const RICH = OWN.filter((id) => id !== 'squidhat').map((id) => [id, PRICES[id]]);
const rich = await anon(CLOCK - 3600000, RICH);
ok('they really bought all twelve: the server says they own them', Array.isArray(rich.bought.own) && RICH.every(([id]) => rich.bought.own.includes(id)), rich.bought);
await gift(rich, 'give');
CLOCK = Date.UTC(2026, 8, 28, 9, 0, 0);
FORCE = 0;
r = await gift(rich, 'open');
FORCE = null;
ok('never something they already own: the one piece they lack', r.ok && r.gift.item === 'squidhat', r.gift);
ok('…so now they own all thirteen', Array.isArray(r.own) && OWN.every((id) => r.own.includes(id)), r.own);
// the weights: with everything in the pool, the cheapest comes up far oftener than the dearest. The draws are a seeded
// series, so it is the same presents every run: the check is on the weights, never on the luck of a run. ⚠️ 300 of them
// and a factor of three, not 60 and two: with 60 a pool where every piece is equally likely passed the old bar for some
// series (this one included), and a fixed series that lets a broken roll through would pass it for ever. At 300 the
// real weights give about twelve cheap for every dear one and equal weights about one and a half; three sits far from both.
const counts = {};
SEQ = splitmix32(0x5eed2026);
for (let i = 0; i < 300; i++) {
  const n = await anon(CLOCK - 3600000);
  await gift(n, 'give');
  CLOCK += 86400000;
  const o = await gift(n, 'open');
  counts[o.gift.item] = (counts[o.gift.item] || 0) + 1;
}
SEQ = null;
const cheap = (counts.potato || 0) + (counts.sockssandals || 0) + (counts.snailhat || 0);
const dear = (counts.squidhat || 0) + (counts.flamingoring || 0);
ok('rarer the dearer: the three cheapest come up far oftener than the two dearest (' + cheap + ' vs ' + dear + ')', cheap > dear * 3, counts);
ok('every roll is a stand piece', Object.keys(counts).every((k) => k in PRICES), counts);

Date.now = REAL_NOW;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
