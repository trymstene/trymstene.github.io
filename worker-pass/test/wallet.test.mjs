// 💰 THE SERVER WALLET, in-process against a fake R2: frozen at the client's
// own number on the first push; moved only by accepted tape events and admin
// grants; a slot that moves with no event never moves it; an overdraft spend
// is refused and marked; dedupe holds; pull/push carry { bal, seq } + seen.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
const KEY = 'test-admin-key';
function fakeR2() {
  const m = new Map();
  return {
    _m: m,
    async get(k) {
      if (!m.has(k)) return null;
      const v = m.get(k);
      return { json: async () => JSON.parse(v), text: async () => v };
    },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(opts = {}) {
      const p = opts.prefix || '';
      return { objects: [...m.keys()].filter((k) => k.startsWith(p)).map((key) => ({ key })), truncated: false };
    },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', PASS_ADMIN_KEY: KEY };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const rec = async (credId) => {
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credId)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return JSON.parse(env.PASSES._m.get(`pass/${h}.json`));
};
const DEV = 'dev00001';
let n = 0;
const ev = (k, d, a = 'park', s) => ({ id: 'c' + String(++n).padStart(7, '0'), t: Date.now(), k, d, a, ...(s ? { s } : {}) });
const slots = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { [DEV]: v }]));
const blob = (led, events, evDrop = 0) => ({ pass: { created: 1, patches: {}, base: {}, led: slots(led), days: [] }, ev: events, evDrop, evDev: DEV });

console.log('1. the freeze');
const a = await (await post('/anon', {})).json();
const push = (b) => post('/push', { credId: a.credId, token: a.token, blob: b }).then((r) => r.json());
// a veteran's first push after the wallet shipped: 50 earned, 10 spent on the
// ledger, of which only the last 5 earned are on the tape
let r = await push(blob({ coins_earned: 50, coins_spent: 10 }, [ev('coins_earned', 5)]));
ok('the push answers with a wallet', r.ok === true && r.wallet && r.wallet.bal === 40 && r.wallet.seq === 1, r.wallet);
let R = await rec(a.credId);
ok('frozen at the client\'s own balance: base 35 + 5 explained', R.wallet.base === 35 && R.wallet.earned === 5 && R.wallet.spent === 0, R.wallet);
ok('…and the seen ids ride along', Array.isArray(r.seen) && r.seen.length === 1, r.seen);

console.log('2. only events move it');
r = await push(blob({ coins_earned: 60, coins_spent: 10 }, [ev('coins_earned', 10)]));
ok('an explained earn raises the wallet', r.wallet.bal === 50, r.wallet);
r = await push(blob({ coins_earned: 260, coins_spent: 10 }, []));
ok('a slot that jumps with no event does NOT', r.wallet.bal === 50, r.wallet);
R = await rec(a.credId);
ok('…it moves the drift instead', R.log.drift.coins_earned === 200, R.log.drift);
const jumpSeq = r.wallet.seq;
r = await push(blob({ coins_earned: 260, coins_spent: 10 }, []));
ok('a push with nothing new keeps the seq', r.wallet.seq === jumpSeq, r.wallet);

console.log('3. spends');
r = await push(blob({ coins_earned: 260, coins_spent: 30 }, [ev('coins_spent', 20, 'stand')]));
ok('a covered spend is carried', r.wallet.bal === 30, r.wallet);
r = await push(blob({ coins_earned: 260, coins_spent: 130 }, [ev('coins_spent', 100, 'stand')]));
ok('an overdraft spend is refused — the balance holds', r.wallet.bal === 30, r.wallet);
R = await rec(a.credId);
ok('…marked on the tape and counted', R.wallet.refused === 1 && R.log.ev.some((e) => e.k === 'coins_spent' && e.d === 100 && e.x === 1), R.log.ev.slice(-1));
r = await push(blob({ coins_earned: 260, coins_spent: 130 }, [ev('coins_refunded', 5, 'park', 'birdhouse')]));
ok('a refund raises it', r.wallet.bal === 35, r.wallet);
r = await push(blob({ coins_earned: 260, coins_spent: 130 }, [{ id: 'c9999999', t: Date.now(), k: 'coins_earned', d: -50, a: 'park' }]));
ok('a negative coin event is ignored', r.wallet.bal === 35, r.wallet);

console.log('4. dedupe');
const dup = ev('coins_earned', 7);
r = await push(blob({ coins_earned: 267, coins_spent: 130 }, [dup]));
r = await push(blob({ coins_earned: 267, coins_spent: 130 }, [dup]));
ok('a re-sent event counts once', r.wallet.bal === 42, r.wallet);

console.log('5. pull');
const pl = await (await hit(`/pull?credId=${encodeURIComponent(a.credId)}&token=${a.token}`)).json();
ok('pull carries the wallet and the seen ids', pl.wallet && pl.wallet.bal === 42 && Array.isArray(pl.seen) && pl.seen.includes(dup.id), [pl.wallet, pl.seen && pl.seen.length]);

console.log('6. admin grants');
const led = await (await hit('/admin/ledger?key=' + KEY)).json();
const row = (led.passes || []).find((x) => x.anon);
ok('the desk shows the wallet as the coins', row && row.coins === 42 && row.wallet === true && row.refused === 1, row && { coins: row.coins, wallet: row.wallet, refused: row.refused });
const g = await (await post('/admin/grant', { key: KEY, id: row.id, coins: 10 })).json();
ok('a grant raises the wallet', g.ok && g.coins === 52, g);
const t = await (await post('/admin/grant', { key: KEY, id: row.id, take: 2 })).json();
ok('a take lowers it', t.ok && t.coins === 50, t);
R = await rec(a.credId);
ok('…both on the tape as hq rows', R.log.ev.filter((e) => e.a === 'hq' && e.s === 'grant').length === 2);
ok('…and the player\'s next pull sees it', (await (await hit(`/pull?credId=${encodeURIComponent(a.credId)}&token=${a.token}`)).json()).wallet.bal === 50);

console.log('7. an old-JS device');
r = await push({ pass: { created: 1, patches: {}, base: {}, led: slots({ coins_earned: 400 }), days: [] } });
ok('a push with no tape at all leaves the wallet alone', r.wallet.bal === 50, r.wallet);

console.log('8. a brand-new player');
const b2 = await (await post('/anon', {})).json();
r = await post('/push', { credId: b2.credId, token: b2.token, blob: blob({ coins_earned: 5 }, [ev('coins_earned', 5, 'park')]) }).then((x) => x.json());
ok('freezes at 0 + the first coins', r.wallet.bal === 5, r.wallet);
R = await rec(b2.credId);
ok('…with a zero base', R.wallet.base === 0 && R.wallet.earned === 5, R.wallet);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
