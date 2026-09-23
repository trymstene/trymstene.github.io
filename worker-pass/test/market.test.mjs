// 🎡📈 THE MARKET, in-process against a fake R2 that speaks etags (23 Sep 2026).
//
// What has to hold before this is deployed, because each is a way coins could leak or a player be cheated:
//   · the SERVER rolls the wheel; a free spin a day, then paid spins that cost SPIN_COST and feed the pot
//   · a spin asked twice (its answer lost on the way) answers the FIRST roll again and charges once
//   · the pot is shared: a paid spin feeds it, THE POT wedge pays all of it and it starts again from POT_SEED
//   · a prize is money the wallet can spend, never only a ledger slot (the cheque's 19 Sep lesson)
//   · the pocket holds at most POCKET_MAX of a kind: a full pocket pays coins instead
//   · a sale is paid only for what the neighbourhood really took out of the saved farm, at today's price
//   · ⭐ a pass kept the normal way (an email joining an anonymous pass) is KEPT: the jobs used to refuse it
import worker from '../src/index.js';
import { saleOf, dayOf, SPIN_COST, SPIN_CAP, POT_SEED, SELL_CAP, WEDGES } from '../../src/data/town/market.js';

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
// the neighbourhood and the square, as the pass worker reaches them (worker-rave's internal routes)
const heard = [];
let farm = { eggs: 7, milk: 0, wool: 0 }, farmOn = true;
const RAVE = {
  async fetch(req) {
    const u = new URL(req.url), b = await req.json().catch(() => ({}));
    heard.push({ path: u.pathname, host: u.hostname, b });
    if (u.pathname === '/square/pot') return new Response(JSON.stringify({ ok: 1 }));
    if (u.pathname === '/yards/take') {
      if (!farmOn) return new Response(JSON.stringify({ err: 'nofarm' }), { status: 404 });
      const have = farm[b.good] | 0, took = Math.min(have, b.n | 0);
      farm[b.good] = have - took;
      return new Response(JSON.stringify({ ok: 1, took, left: have - took, updated: 2000, prev: 1000 }));
    }
    return new Response('{}', { status: 404 });
  },
};
let sent = [];
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', RULES_STRICT: '0', RESEND_KEY: 'k', MAIL_FROM: 'b@send.trymstene.com', RAVE };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) { const body = JSON.parse(init.body); sent.push((body.text.match(/https?:\/\/\S+/) || [''])[0]); return new Response('{"id":"x"}'); }
  return realFetch(url, init);
};
const ctx = { waitUntil() {}, passThroughOnException() {} };
let ipN = 0;
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.2.' + (++ipN % 250), ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
const J = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); }
};
const REAL_NOW = Date.now;
let CLOCK = Date.UTC(2026, 8, 23, 12, 0, 0);
Date.now = () => CLOCK;

// 🎲 the wheel, steered: a forced draw lands in the weight band of the wedge a test wants
const realRGV = crypto.getRandomValues.bind(crypto);
let FORCE = null;
Object.defineProperty(crypto, 'getRandomValues', { configurable: true, writable: true,
  value: (a) => (FORCE != null && a instanceof Uint32Array ? ((a[0] = FORCE), a) : realRGV(a)) });
const AT = { c5: 100, firework: 2500, peel: 5000, c20: 8600, lure: 9000, again: 9900, pot: 9990 };
const spin = async (me, id, n) => { FORCE = AT[id]; const r = await J(await post('/town/wheel', { credId: me.credId, token: me.token, ...(n ? { n } : {}) })); FORCE = null; return r; };

// a pass with coins and a frozen wallet: minted anonymous, then one push (the way a real device does)
const DEV = 'dev0000m';
async function anonWith(coins) {
  const a = await J(await post('/anon', {}));
  const blob = { pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: coins }, coins_spent: { [DEV]: 0 } }, days: [] }, ev: [], evDrop: 0, evDev: DEV };
  const p = await J(await post('/push', { credId: a.credId, token: a.token, blob }));
  return { ...a, wallet: p.wallet };
}

console.log('\n1. the wheel as it stands');
const me = await anonWith(40);
ok('an anonymous pass has a frozen wallet to spin with', me.wallet && me.wallet.bal === 40, me.wallet);
let v = await J(await post('/town/wheel', { credId: me.credId, token: me.token, view: 1 }));
ok('view: the pot starts from POT_SEED, today\'s spin is free, the whole day\'s paid spins are left', v.ok && v.pot === POT_SEED && v.next === 'free' && v.left === SPIN_CAP && v.cost === SPIN_COST, v);
ok('an anonymous pass may spin (the wheel does not ask for a kept pass)', v.status === 200, v.status);

console.log('\n2. the free spin');
let s = await spin(me, 'c5', 'nonce0001');
ok('the free spin lands where the server rolled it and pays 5 coins', s.ok && s.kind === 'free' && s.id === 'c5' && WEDGES[s.i][0] === 'c5' && s.coins === 5, s);
ok('…into the WALLET, not only a slot', s.wallet && s.wallet.bal === 45, s.wallet);
ok('…and the answer carries the server slot so the device holds it at once', s.slots && s.slots.coins_earned && s.slots.coins_earned.wheel === 5, s.slots);
ok('a free spin does not feed the pot', s.pot === POT_SEED, s.pot);
ok('the next spin costs', s.next === 'paid', s.next);

console.log('\n3. a paid spin, and the same spin asked twice');
s = await spin(me, 'peel', 'nonce0002');
ok('a peel: charged SPIN_COST, paid nothing', s.ok && s.kind === 'paid' && s.id === 'peel' && s.coins === 0 && s.wallet.bal === 45 - SPIN_COST, s);
ok('…and the pot grew by one', s.pot === POT_SEED + 1, s.pot);
ok('…one paid spin used', s.left === SPIN_CAP - 1, s.left);
const again2 = await spin(me, 'c20', 'nonce0002');
ok('the same nonce answers the FIRST roll again (a peel, not the c20 asked for now)', again2.repeat === 1 && again2.id === 'peel', again2);
ok('…and charges nothing a second time', again2.wallet.bal === 45 - SPIN_COST, again2.wallet);
v = await J(await post('/town/wheel', { credId: me.credId, token: me.token, view: 1 }));
ok('…and the pot did not move for it', v.pot === POT_SEED + 1, v.pot);

console.log('\n4. spin again');
s = await spin(me, 'again', 'nonce0003');
ok('the spin-again wedge makes the next spin free', s.id === 'again' && s.next === 'again', s);
const bal4 = s.wallet.bal;
s = await spin(me, 'c20', 'nonce0004');
ok('…which costs nothing and pays 20', s.kind === 'again' && s.coins === 20 && s.wallet.bal === bal4 + 20, s);
ok('…and does not feed the pot', s.pot === POT_SEED + 2, s.pot);

console.log('\n5. the pocket');
s = await spin(me, 'firework', 'nonce0005');
ok('a firework goes into the pocket, as the server\'s slot', s.item === 'firework' && s.slots.pocket_firework && s.slots.pocket_firework.wheel === 1, s);
{
  // a pocket already holding five fireworks (bought or won): the wedge pays coins instead
  const full = await anonWith(30);
  await post('/push', { credId: full.credId, token: full.token, blob: { pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: 30 }, coins_spent: { [DEV]: 0 }, pocket_firework: { [DEV]: 5 } }, days: [] }, ev: [], evDrop: 0, evDev: DEV } });
  const f = await spin(full, 'firework', 'nonce0006');
  ok('a full pocket pays coins instead of a sixth firework', f.full === true && !f.item && f.coins === 5 && f.wallet.bal === 35, f);
}

console.log('\n6. THE POT');
{
  const lucky = await anonWith(20);
  await spin(lucky, 'peel', 'nonce0007');   // the free spin
  heard.length = 0;
  const potBefore = (await J(await post('/town/wheel', { credId: lucky.credId, token: lucky.token, view: 1 }))).pot;
  const w = await spin(lucky, 'pot', 'nonce0008');
  ok('THE POT pays the whole pot, fed by this very spin', w.id === 'pot' && w.coins === potBefore + 1, [w.coins, potBefore]);
  ok('…the pot starts again from POT_SEED', w.pot === POT_SEED, w.pot);
  ok('…the wallet has it', w.wallet.bal === 20 - SPIN_COST + potBefore + 1, w.wallet);
  const told = heard.find((h) => h.path === '/square/pot');
  ok('…and the square is told, on the internal host, who won what', told && told.host === 'internal' && told.b.won === potBefore + 1 && told.b.pot === POT_SEED && /^[a-f0-9]{16}$/.test(told.b.own), told);
}

console.log('\n7. refusals');
{
  const poor = await anonWith(0);
  await spin(poor, 'peel', 'nonce0009');   // the free one
  const r = await spin(poor, 'c5', 'nonce0010');
  ok('no coins, no paid spin', r.status === 409 && r.error === 'funds', r);
  // a day's paid spins used up: the record says so
  const key = 'pass/' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(me.credId)))].map((x) => x.toString(16).padStart(2, '0')).join('') + '.json';
  const cur = env.PASSES._m.get(key);
  const rec = JSON.parse(cur.v); rec.wheel.paid = SPIN_CAP; rec.wheel.again = 0;
  await env.PASSES.put(key, JSON.stringify(rec));
  const c = await spin(me, 'c5', 'nonce0011');
  ok('the day\'s paid spins used: refused, nothing charged', c.status === 409 && c.error === 'cap', c);
  CLOCK += 86400000;
  const next = await spin(me, 'c5', 'nonce0012');
  ok('a new UTC day: the free spin is back', next.ok && next.kind === 'free', next);
  const nl = await J(await post('/town/wheel', { credId: 'a:nobody', token: 'nothing', view: 1 }));
  ok('an unknown pass is refused', nl.status === 403, nl);
}

console.log('\n8. the Exchange');
{
  const seller = await anonWith(0);
  heard.length = 0;
  farm = { eggs: 7, milk: 0, wool: 0 };
  const r = await J(await post('/town/sell', { credId: seller.credId, token: seller.token, good: 'eggs', n: 10 }));
  const want = saleOf(dayOf(CLOCK), 0, 7);
  ok('asking for 10 eggs sells the 7 the saved farm really has', r.ok && r.took === 7 && r.left === 0, r);
  ok('…at today\'s price, rounded once (' + want + ')', r.coins === want && r.wallet && r.wallet.bal === want, [r.coins, r.wallet]);
  ok('…the answer carries the server slot and the farm\'s new stamp', r.slots.coins_earned.exchange === want && r.yard.updated === 2000 && r.yard.prev === 1000, r);
  const take = heard.find((h) => h.path === '/yards/take');
  ok('…the take went to the neighbourhood on the internal host, keyed by the world id', take && take.host === 'internal' && /^[a-f0-9]{16}$/.test(take.b.pass) && take.b.good === 'eggs' && take.b.n === 10, take);
  const none = await J(await post('/town/sell', { credId: seller.credId, token: seller.token, good: 'eggs', n: 3 }));
  ok('nothing left in the farm: nothing sold, nothing paid', none.ok && none.took === 0 && none.coins === 0 && none.wallet.bal === want, none);
  farm.eggs = 999;
  const big = await J(await post('/town/sell', { credId: seller.credId, token: seller.token, good: 'eggs', n: 999 }));
  ok('Fig Jr. takes at most SELL_CAP of a good from one banana a day', big.took === SELL_CAP - 7 && big.room === 0, big);
  const capped = await J(await post('/town/sell', { credId: seller.credId, token: seller.token, good: 'eggs', n: 1 }));
  ok('…then says so', capped.status === 409 && capped.error === 'cap', capped);
  const milk = await J(await post('/town/sell', { credId: seller.credId, token: seller.token, good: 'milk', n: 1 }));
  ok('…while another good still has room (and none to sell)', milk.ok && milk.took === 0, milk);
  farmOn = false;
  const nf = await J(await post('/town/sell', { credId: seller.credId, token: seller.token, good: 'wool', n: 2 }));
  ok('no homestead: refused as such', nf.status === 404 && nf.error === 'nofarm', nf);
  farmOn = true;
  const bad = await J(await post('/town/sell', { credId: seller.credId, token: seller.token, good: 'cheese', n: 2 }));
  ok('a good the Exchange does not buy is refused', bad.status === 400, bad);
  const noRave = await J(await worker.fetch(new Request('https://w.dev/town/sell', { method: 'POST', body: JSON.stringify({ credId: seller.credId, token: seller.token, good: 'milk', n: 1 }),
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.9.9' } }), { ...env, RAVE: undefined }, ctx));
  ok('no way to the neighbourhood: busy, nothing paid', noRave.status === 503 && noRave.error === 'busy', noRave);
  const forged = await J(await post('/push', { credId: seller.credId, token: seller.token, blob: { pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: 0 } }, days: [] }, ev: [{ id: 'f0rged01', t: CLOCK, k: 'coins_earned', d: 50, a: 'town', s: 'exchange' }], evDrop: 0, evDev: DEV } }));
  ok('a CLIENT claiming exchange coins is refused (the Exchange pays only server-side)', forged.wallet && forged.wallet.bal === want + saleOf(dayOf(CLOCK), 0, SELL_CAP - 7), forged.wallet);
}

console.log('\n9. ⭐ a pass kept by email is a KEPT pass');
{
  const a = await J(await post('/anon', {}));
  sent = [];
  await post('/mail/signin', { email: 'kept-by-email@example.com' });
  const t = new URL(sent[0]).searchParams.get('in');
  const att = await J(await hit('/mail/use?t=' + t + '&credId=' + encodeURIComponent(a.credId) + '&token=' + a.token));
  ok('the email attaches to the anonymous pass', att.attached === true, att);
  const job = await J(await post('/job/take', { credId: att.credId, token: att.token, at: 'store' }));
  ok('…and a boss hires that pass (it was refused "keep" before 23 Sep)', job.ok && job.job && job.job.at === 'store', job);
  // a home attached BEFORE the fix still carries the mark: the first kept call repairs it
  const homeKey = [...env.PASSES._m.keys()].find((k) => { try { const r = JSON.parse(env.PASSES._m.get(k).v); return r.keptAt && k.startsWith('pass/'); } catch (e) { return false; } });
  const rec = JSON.parse(env.PASSES._m.get(homeKey).v);
  ok('the home lost its anonymous mark when the email joined', !rec.anon, rec.anon);
  rec.anon = 1; delete rec.keptAt;
  await env.PASSES.put(homeKey, JSON.stringify(rec));
  const again9 = await J(await post('/job/chore', { credId: att.credId, token: att.token }));
  ok('an old stuck home: the kept email still works', again9.ok, again9);
  ok('…and the mark is repaired on the record', !JSON.parse(env.PASSES._m.get(homeKey).v).anon);
  const still = await J(await post('/job/view', { credId: a.credId, token: a.token }));
  ok('the anonymous credential on that phone opens a kept pass too, because its home now is', still.ok === true, still);
}

Date.now = REAL_NOW;
globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
