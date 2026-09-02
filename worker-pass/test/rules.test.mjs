// 📏 PER-AREA RULES, in-process against a fake R2: homestead coin events must
// name a faucet and fit its max and its per-person caps; refusals are marked
// with a reason and never reach the wallet; the used caps ride the answers;
// unnamed events pass while RULES_STRICT is off and fail when it is on; an
// unruled area is untouched.
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
const mkEnv = (extra = {}) => ({ PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', PASS_ADMIN_KEY: KEY, ...extra });
let env = mkEnv();
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
const ev = (k, d, a, s) => ({ id: 'd' + String(++n).padStart(7, '0'), t: Date.now(), k, d, a, ...(s ? { s } : {}) });
let earned = 0;
const blob = (events) => ({ pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: earned } }, days: [] }, ev: events, evDrop: 0, evDev: DEV });
async function player() {
  const a = await (await post('/anon', {})).json();
  earned = 0;
  await post('/push', { credId: a.credId, token: a.token, blob: blob([]) });   // the freeze, at 0
  return a;
}
const pushEv = async (a, events) => {
  for (const e of events) if (e.k === 'coins_earned') earned += e.d;
  return post('/push', { credId: a.credId, token: a.token, blob: blob(events) }).then((r) => r.json());
};
const lastRows = async (a, k) => (await rec(a.credId)).log.ev.slice(-k);

console.log('1. the stall: 25 a day per PERSON (50 with the buff)');
let a = await player();
let r = await pushEv(a, [ev('coins_earned', 25, 'homestead', 'stall')]);
ok('the first stall sale is paid', r.wallet.bal === 25, r.wallet);
ok('…and the used cap rides back', r.rules && r.rules['homestead:stall'] && r.rules['homestead:stall'].used === 25, r.rules);
r = await pushEv(a, [ev('coins_earned', 25, 'homestead', 'stall')]);
ok('the buffed second 25 still fits the day', r.wallet.bal === 50, r.wallet);
r = await pushEv(a, [ev('coins_earned', 4, 'homestead', 'stall')]);
ok('one coin past the day cap is refused', r.wallet.bal === 50, r.wallet);
let rows = await lastRows(a, 1);
ok('…marked on the tape with the reason', rows[0].x === 1 && rows[0].r === 'day', rows[0]);
r = await pushEv(a, [ev('coins_earned', 500, 'homestead', 'stall')]);
ok('an absurd stall payout is refused for its size', r.wallet.bal === 50 && (await lastRows(a, 1))[0].r === 'max', r.wallet);

console.log('2. the road: 10 coins once per person');
a = await player();
for (let i = 0; i < 5; i++) r = await pushEv(a, [ev('coins_earned', 2, 'homestead', 'road')]);
ok('five road coins are paid', r.wallet.bal === 10, r.wallet);
r = await pushEv(a, [ev('coins_earned', 2, 'homestead', 'road')]);
ok('a sixth (another device) is refused for the lifetime total', r.wallet.bal === 10 && (await lastRows(a, 1))[0].r === 'total', r.wallet);
r = await pushEv(a, [ev('coins_earned', 4, 'homestead', 'road')]);
ok('a buffed 4 would also break the total', r.wallet.bal === 10);

console.log('3. naming');
a = await player();
r = await pushEv(a, [ev('coins_earned', 9, 'homestead', 'lottery')]);
ok('an unknown faucet is refused', r.wallet.bal === 0 && (await lastRows(a, 1))[0].r === 'src');
r = await pushEv(a, [ev('coins_earned', 9, 'homestead', 'qa')]);
ok('the QA faucet is denied', r.wallet.bal === 0 && (await lastRows(a, 1))[0].r === 'deny');
r = await pushEv(a, [ev('coins_earned', 9, 'homestead')]);
ok('an unnamed homestead event passes while RULES_STRICT is off', r.wallet.bal === 9, r.wallet);
let R = await rec(a.credId);
ok('…and is counted unruled', R.log.unruled === 1, R.log.unruled);
r = await pushEv(a, [ev('coins_earned', 30, 'park')]);
ok('an unruled area is untouched', r.wallet.bal === 39, r.wallet);
r = await pushEv(a, [ev('coins_earned', 26, 'homestead', 'dish'), ev('coins_earned', 70, 'homestead', 'knit'), ev('coins_earned', 45, 'homestead', 'rehome'), ev('coins_earned', 100, 'homestead', 'shed')]);
ok('every named homestead faucet is paid within its rule', r.wallet.bal === 39 + 26 + 70 + 45 + 100, r.wallet);

console.log('4. the day rolls over');
R = await rec(a.credId);
a = await player();
await pushEv(a, [ev('coins_earned', 50, 'homestead', 'stall')]);
const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a.credId)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const key = `pass/${h}.json`;
const stored = JSON.parse(env.PASSES._m.get(key));
stored.rules['homestead:stall'].d = '2000-01-01';   // yesterday, as far as the rule knows
env.PASSES._m.set(key, JSON.stringify(stored));
r = await pushEv(a, [ev('coins_earned', 25, 'homestead', 'stall')]);
ok('a new UTC day opens the stall again', r.wallet.bal === 75, r.wallet);

console.log('5. strict mode');
env = mkEnv({ RULES_STRICT: '1' });
a = await player();
r = await pushEv(a, [ev('coins_earned', 9, 'homestead')]);
ok('an unnamed homestead event is refused under RULES_STRICT', r.wallet.bal === 0 && (await lastRows(a, 1))[0].r === 'src', r.wallet);
r = await pushEv(a, [ev('coins_earned', 9, 'park')]);
ok('…while an unruled area is still fine', r.wallet.bal === 9);

console.log('6. the desk');
const led = await (await hit('/admin/ledger?key=' + KEY)).json();
const row = (led.passes || []).find((x) => x.rr >= 1);
ok('the ledger row counts rule refusals', !!row && row.rr === 1, row && { rr: row.rr, unruled: row.unruled });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
