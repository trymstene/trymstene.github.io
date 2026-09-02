// 📏 PER-AREA RULES for beach, park and rave, in-process against a fake R2:
// every named faucet is paid within its rule, the max binds, the tight caps
// bind, once-evers count, QA is denied, unknown faucets are refused, spends
// are untouched, and the quest wage is ruled in all three.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
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
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h' };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, { ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json' } }), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const DEV = 'dev00001';
let n = 0, earned = 0, spent = 0;
const ev = (k, d, a, s) => ({ id: 'e' + String(++n).padStart(7, '0'), t: Date.now(), k, d, a, ...(s ? { s } : {}) });
const blob = (events) => ({ pass: { created: 1, patches: {}, base: {}, led: { coins_earned: { [DEV]: earned }, coins_spent: { [DEV]: spent } }, days: [] }, ev: events, evDrop: 0, evDev: DEV });
async function player() {
  const a = await (await post('/anon', {})).json();
  earned = 0; spent = 0;
  await post('/push', { credId: a.credId, token: a.token, blob: blob([]) });
  return a;
}
const pushEv = async (a, events) => {
  for (const e of events) { if (e.k === 'coins_earned') earned += e.d; if (e.k === 'coins_spent') spent += e.d; }
  return post('/push', { credId: a.credId, token: a.token, blob: blob(events) }).then((r) => r.json());
};

console.log('1. beach');
let a = await player();
let r = await pushEv(a, [ev('coins_earned', 20, 'beach', 'window'), ev('coins_earned', 6, 'beach', 'bottle'), ev('coins_earned', 5, 'beach', 'fishing'), ev('coins_earned', 5, 'beach', 'dig'), ev('coins_earned', 15, 'beach', 'quest')]);
ok('every beach faucet is paid within its rule', r.wallet.bal === 51, r.wallet);
r = await pushEv(a, [ev('coins_earned', 40, 'beach', 'window'), ev('coins_earned', 41, 'beach', 'window')]);
ok('a buffed window (40) is paid, 41 is refused', r.wallet.bal === 91, r.wallet);
r = await pushEv(a, [ev('coins_earned', 10, 'beach', 'fishing'), ev('coins_earned', 10, 'beach', 'fishing'), ev('coins_earned', 6, 'beach', 'fishing')]);
ok('fishing stops at 30 a day per person (5+10+10, then refused)', r.wallet.bal === 111, r.wallet);
r = await pushEv(a, [ev('coins_earned', 15, 'beach', 'quest')]);
ok('the beach quest wage pays once ever', r.wallet.bal === 111, r.wallet);
r = await pushEv(a, [ev('coins_earned', 100, 'beach', 'qa'), ev('coins_earned', 9, 'beach', 'seagull')]);
ok('QA is denied and an unknown faucet refused', r.wallet.bal === 111, r.wallet);
r = await pushEv(a, [ev('coins_spent', 5, 'beach', 'duck'), ev('coins_spent', 5, 'beach', 'coco')]);
ok('stall spends are untouched by the rules', r.wallet.bal === 101, r.wallet);

console.log('2. park');
a = await player();
r = await pushEv(a, [ev('coins_earned', 25, 'park', 'wish'), ev('coins_earned', 3, 'park', 'weed'), ev('coins_earned', 40, 'park', 'egg'), ev('coins_earned', 15, 'park', 'quest'), ev('coins_earned', 10, 'park', 'quest')]);
ok('every park faucet is paid within its rule', r.wallet.bal === 93, r.wallet);
r = await pushEv(a, [ev('coins_earned', 15, 'park', 'quest')]);
ok('a third quest wage in the park is refused (count 2)', r.wallet.bal === 93, r.wallet);
r = await pushEv(a, [ev('coins_earned', 7, 'park', 'weed')]);
ok('a 7-coin weed breaks its max', r.wallet.bal === 93, r.wallet);
r = await pushEv(a, [ev('coins_spent', 1, 'park', 'wish'), ev('coins_spent', 30, 'park', 'birdhouse'), ev('coins_refunded', 30, 'park', 'birdhouse')]);
ok('a spend and its refund pass through', r.wallet.bal === 92, r.wallet);

console.log('3. rave');
a = await player();
const spots = []; for (let i = 0; i < 35; i++) spots.push(ev('coins_earned', 1, 'rave', 'spot'));
r = await pushEv(a, [ev('coins_earned', 20, 'rave', 'window'), ...spots, ev('coins_earned', 6, 'rave', 'floorquest'), ev('coins_earned', 20, 'rave', 'quest')]);
ok('every rave faucet is paid within its rule', r.wallet.bal === 81, r.wallet);
r = await pushEv(a, [ev('coins_earned', 3, 'rave', 'spot')]);
ok('a 3-coin spotlight tick breaks its max', r.wallet.bal === 81, r.wallet);
r = await pushEv(a, [ev('coins_earned', 6, 'rave', 'qa')]);
ok('a forced floor quest under ?questtest is denied', r.wallet.bal === 81, r.wallet);
const R = JSON.parse(env.PASSES._m.get([...env.PASSES._m.keys()].find((k) => k.startsWith('pass/') && env.PASSES._m.get(k).includes('"rave:spot"'))));
ok('the caps used ride the record per area', R.rules['rave:spot'].used === 35 && R.rules['rave:window'].used === 20, R.rules);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
