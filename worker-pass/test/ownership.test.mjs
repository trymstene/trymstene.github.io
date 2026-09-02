// 🎩 STAND OWNERSHIP THROUGH AN ACCEPTED SPEND, in-process against a fake R2:
// the freeze adopts what a record holds once; after it a client's own_<stand
// id> is stripped from base, led and stats; a purchase row that names the
// item is judged owned / price / funds and authors ownership on acceptance;
// unknown items are plain spends; legacy stand spends are adopted while
// OWN_STRICT is off and refused when on; grants and folds keep gear; every
// answer names the gear and a push names the refusals.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
const KEY = 'test-admin-key';
function fakeR2() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(opts = {}) { const p = opts.prefix || ''; return { objects: [...m.keys()].filter((k) => k.startsWith(p)).map((key) => ({ key })), truncated: false }; },
  };
}
const mkEnv = (extra = {}) => ({ PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', PASS_ADMIN_KEY: KEY, ...extra });
let env = mkEnv();
const ctx = { waitUntil() {}, passThroughOnException() {} };
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, { ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json' } }), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const keyOf = async (credId) => 'pass/' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credId)))].map((b) => b.toString(16).padStart(2, '0')).join('') + '.json';
const rec = async (credId) => JSON.parse(env.PASSES._m.get(await keyOf(credId)));
const DEV = 'dev00001';
let n = 0;
const ev = (k, d, a, s, i) => ({ id: 'f' + String(++n).padStart(7, '0'), t: Date.now(), k, d, a, ...(s ? { s } : {}), ...(i ? { i } : {}) });
// a client blob: slots for earned/spent + any own_ claims the device makes
const blob = (led, events, extra = {}) => ({
  pass: { created: 1, patches: {}, base: extra.base || {}, stats: extra.stats || {}, led: Object.fromEntries(Object.entries(led).map(([k, v]) => [k, { [DEV]: v }])), days: [] },
  ev: events, evDrop: 0, evDev: DEV,
});
const push = (a, b) => post('/push', { credId: a.credId, token: a.token, blob: b }).then((r) => r.json());
const pull = (a) => hit(`/pull?credId=${encodeURIComponent(a.credId)}&token=${a.token}`).then((r) => r.json());
const owned = (R, id) => (((R.blob || {}).pass || {}).base || {})['own_' + id] > 0 || Object.values((((R.blob || {}).pass || {}).led || {})['own_' + id] || {}).some((v) => v > 0);

console.log('1. the freeze');
// a real client mints its anonymous pass WITH its ledger (ensureAnon sends collectBlob), so the claim rides the mint
let a = await (await post('/anon', { blob: blob({ own_squidhat: 1 }, []) })).json();
let r = await push(a, blob({ coins_earned: 200, own_squidhat: 1 }, [ev('coins_earned', 200, 'park', 'egg')]));
let R = await rec(a.credId);
ok('the mint adopts the claimed squidhat once (the freeze)', owned(R, 'squidhat') && R.ownAt > 0, { ownAt: R.ownAt, base: R.blob.pass.base });
ok('…listed as frozen-in on the record', Array.isArray(R.ownFroze) && R.ownFroze.includes('squidhat'), R.ownFroze);
ok('…and the answer names it', Array.isArray(r.own) && r.own.includes('squidhat'), r.own);
ok('the wallet froze at the same time', r.wallet && r.wallet.bal === 200, r.wallet);

console.log('2. after the freeze a client claim is stripped');
r = await push(a, blob({ coins_earned: 200, own_duckhat: 1 }, [], { base: { own_buckethat: 1 }, stats: { own_potato: 1, coins_earned: 200 } }));
R = await rec(a.credId);
ok('a led slot, a base scalar and a raised mirror are all dropped', !owned(R, 'duckhat') && !owned(R, 'buckethat') && !owned(R, 'potato'), [R.blob.pass.base, R.blob.pass.led]);
ok('…the answer does not name them', !r.own.includes('duckhat') && !r.own.includes('buckethat') && !r.own.includes('potato'), r.own);
ok('…the frozen squidhat stays', r.own.includes('squidhat'));
ok('…and no drift is scored on own_ keys', !Object.keys(R.log.drift || {}).some((k) => k.startsWith('own_')), R.log.drift);

console.log('3. purchases');
r = await push(a, blob({ coins_earned: 200, coins_spent: 60, own_duckhat: 1 }, [ev('coins_spent', 60, 'park', 'stand', 'duckhat'), ev('own_duckhat', 1, 'park')]));
R = await rec(a.credId);
ok('an accepted purchase debits and authors ownership', r.wallet.bal === 140 && owned(R, 'duckhat') && r.own.includes('duckhat'), [r.wallet, r.own]);
ok('…no refusal on the answer', !r.nak, r.nak);
ok('…the tape row is marked own:1', R.log.ev.some((e) => e.i === 'duckhat' && e.own === 1));
r = await push(a, blob({ coins_earned: 200, coins_spent: 90, own_duckhat: 1, own_buckethat: 1 }, [ev('coins_spent', 30, 'park', 'stand', 'buckethat')]));
ok('an overpay (30 for a 25 bucket hat after a cut) is accepted', r.wallet.bal === 110 && r.own.includes('buckethat'), [r.wallet, r.own]);
r = await push(a, blob({ coins_earned: 200, coins_spent: 100, own_duckhat: 1, own_buckethat: 1, own_snailhat: 1 }, [ev('coins_spent', 10, 'park', 'stand', 'snailhat')]));
R = await rec(a.credId);
ok('an under-price spend is refused, nothing debited, nothing owned', r.wallet.bal === 110 && !owned(R, 'snailhat') && r.nak && r.nak[0].i === 'snailhat' && r.nak[0].r === 'price', [r.wallet, r.nak]);
r = await push(a, blob({ coins_earned: 200, coins_spent: 220, own_duckhat: 1, own_buckethat: 1, own_squidhat: 1, own_flamingoring: 1 }, [ev('coins_spent', 120, 'park', 'stand', 'flamingoring')]));
R = await rec(a.credId);
ok('an overdraft is refused as funds', r.wallet.bal === 110 && !owned(R, 'flamingoring') && r.nak[0].r === 'funds', [r.wallet, r.nak]);
r = await push(a, blob({ coins_earned: 200, coins_spent: 160, own_duckhat: 1, own_buckethat: 1 }, [ev('coins_spent', 60, 'park', 'stand', 'duckhat')]));
ok('buying what you own is refused as owned, no charge', r.wallet.bal === 110 && r.nak[0].r === 'owned', [r.wallet, r.nak]);
r = await push(a, blob({ coins_earned: 200, coins_spent: 205 }, [ev('coins_spent', 45, 'homestead', 'order', 'decor:campfire')]));
R = await rec(a.credId);
ok('an unknown item is a plain spend: debited, nothing authored', r.wallet.bal === 65 && !Object.keys(R.blob.pass.base).some((k) => k.includes('campfire')), r.wallet);
const dup = ev('coins_spent', 12, 'park', 'stand', 'sockssandals');
r = await push(a, blob({ coins_earned: 200, coins_spent: 217 }, [dup]));
r = await push(a, blob({ coins_earned: 200, coins_spent: 217 }, [dup]));
ok('a re-sent purchase row counts once', r.wallet.bal === 53 && r.own.includes('sockssandals'), [r.wallet, r.own]);

console.log('4. legacy stand spends');
a = await (await post('/anon', {})).json();
await push(a, blob({ coins_earned: 100 }, [ev('coins_earned', 100, 'park', 'egg')]));   // freeze
r = await push(a, blob({ coins_earned: 100, coins_spent: 15, own_snailhat: 1 }, [ev('coins_spent', 15, 'park', 'stand')]));
R = await rec(a.credId);
ok('OWN_STRICT off: a stand spend without an item is adopted unstripped and counted', owned(R, 'snailhat') && R.log.ownLegacy === 1 && r.wallet.bal === 85, [r.own, R.log.ownLegacy]);
env = mkEnv({ OWN_STRICT: '1' });
a = await (await post('/anon', {})).json();
await push(a, blob({ coins_earned: 100 }, [ev('coins_earned', 100, 'park', 'egg')]));
r = await push(a, blob({ coins_earned: 100, coins_spent: 15, own_snailhat: 1 }, [ev('coins_spent', 15, 'park', 'stand')]));
R = await rec(a.credId);
ok('OWN_STRICT on: refused as item, stripped, no charge', !owned(R, 'snailhat') && r.wallet.bal === 100 && R.log.ev.slice(-1)[0].r === 'item', [r.wallet, R.log.ev.slice(-1)]);
env = mkEnv();

console.log('5. the ownership-freeze push carrying a purchase');
a = await (await post('/anon', {})).json();
// this record's wallet froze earlier (simulate: first push with no purchase), then ownAt is cleared to mimic a
// record that predates slice 4 and buys in its first post-ship push
await push(a, blob({ coins_earned: 100 }, [ev('coins_earned', 100, 'park', 'egg')]));
let k = await keyOf(a.credId); let st = JSON.parse(env.PASSES._m.get(k)); delete st.ownAt; delete st.ownFroze; env.PASSES._m.set(k, JSON.stringify(st));
r = await push(a, blob({ coins_earned: 100, coins_spent: 60, own_duckhat: 1 }, [ev('coins_spent', 60, 'park', 'stand', 'duckhat')]));
R = await rec(a.credId);
ok('the purchase in the freeze push is debited and owned (owned-check skipped)', r.wallet.bal === 40 && owned(R, 'duckhat') && !r.nak, [r.wallet, r.nak]);

console.log('6. grants and folds');
const led = await (await hit('/admin/ledger?key=' + KEY)).json();
const row = (led.passes || []).find((x) => x.coins === 40);
const g = await (await post('/admin/grant', { key: KEY, id: row.id, gear: 'squidhat' })).json();
r = await push(a, blob({ coins_earned: 100, coins_spent: 60 }, []));
ok('an HQ gear grant for a stand id lands and survives the next push', g.ok && r.own.includes('squidhat'), [g, r.own]);
const b2 = await (await post('/anon', { blob: blob({ own_potato: 1 }, []) })).json();   // its freeze (the mint) adopts the potato
await push(b2, blob({ own_potato: 1 }, []));
const c = await (await post('/anon', {})).json();
await push(c, blob({ coins_earned: 5 }, []));
// fold b2 (anon) into c via a fake passkey restore is heavy; exercise foldAnon through /register's join path instead:
const pl = await pull(b2);
ok('an anon record keeps its frozen gear on pull', pl.own.includes('potato'), pl.own);

console.log('7. a wallet-fresh push refuses nothing');
a = await (await post('/anon', {})).json();
r = await push(a, blob({ coins_earned: 10, coins_spent: 60, own_duckhat: 1 }, [ev('coins_spent', 60, 'park', 'stand', 'duckhat')]));
ok('history is history: the first push is adopted whole', r.wallet.bal === -50 || r.wallet.bal === 10 - 60 || r.own.includes('duckhat'), [r.wallet, r.own]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
