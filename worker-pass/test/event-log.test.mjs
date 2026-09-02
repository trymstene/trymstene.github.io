// 📜 THE LEDGER TAPE, in-process against a fake R2: events ride the push and
// are kept inside the pass record, never in the blob; ids dedupe; the drift
// scores a slot that moved with no event behind it; an overflowed outbox is
// "unsure", not drift; the admin desk row carries the numbers.
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
  const te = new TextEncoder();
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(credId)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return JSON.parse(env.PASSES._m.get(`pass/${h}.json`));
};
const DEV = 'dev00001';
const ev = (id, k, d, a = 'park', extra = {}) => ({ id, t: Date.now(), k, d, a, ...extra });
const blobWith = (slots, events, evDrop = 0) => ({
  pass: { created: 1, patches: {}, base: {}, led: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, { [DEV]: v }])), days: [] },
  ev: events, evDrop, evDev: DEV,
});

console.log('1. events ride the push and stay out of the blob');
const a = await (await post('/anon', {})).json();
const push = (blob) => post('/push', { credId: a.credId, token: a.token, blob });
let r = await (await push(blobWith({ coins_earned: 5 }, [ev('aaaa0001', 'coins_earned', 5, 'park', { s: 'water' })]))).json();
ok('the push is accepted', r.ok === true, r);
let R = await rec(a.credId);
ok('the record holds the tape', R.log && R.log.n === 1 && R.log.ev[0].k === 'coins_earned' && R.log.ev[0].s === 'water', R.log);
ok('…and the stored blob carries no ev fields', !('ev' in R.blob) && !('evDev' in R.blob) && !('evDrop' in R.blob), Object.keys(R.blob));
ok('an honest push drifts 0', !R.log.drift || !Object.keys(R.log.drift).length, R.log.drift);

console.log('2. dedupe (a beacon push re-sends)');
r = await (await push(blobWith({ coins_earned: 5 }, [ev('aaaa0001', 'coins_earned', 5)]))).json();
R = await rec(a.credId);
ok('the same id is not counted twice', R.log.n === 1 && R.log.ev.length === 1, R.log.n);
ok('…and re-sending drifts nothing', driftSum(R.log) === 0, R.log.drift);

console.log('3. a slot that moved with no event behind it');
r = await (await push(blobWith({ coins_earned: 100 }, []))).json();
R = await rec(a.credId);
ok('drift catches the unexplained 95 coins', R.log.drift && R.log.drift.coins_earned === 95, R.log.drift);
r = await (await push(blobWith({ coins_earned: 100, rep: 12 }, [ev('aaaa0002', 'rep', 12, 'rave')]))).json();
R = await rec(a.credId);
ok('an explained move adds no drift', R.log.drift.coins_earned === 95 && !R.log.drift.rep, R.log.drift);

console.log('4. an overflowed outbox is unsure, not drift');
r = await (await push(blobWith({ coins_earned: 140, rep: 12 }, [ev('aaaa0003', 'coins_earned', 10)], 7))).json();
R = await rec(a.logCredId || a.credId);
ok('the push is marked unsure and the drift stays', R.log.unsure === 1 && R.log.drop === 7 && R.log.drift.coins_earned === 95, [R.log.unsure, R.log.drop, R.log.drift]);

console.log('5. badges are events without drift');
r = await (await push(blobWith({ coins_earned: 140, rep: 12 }, [ev('aaaa0004', 'patch:raver', 1, 'rave')]))).json();
R = await rec(a.credId);
ok('a patch event is kept', R.log.ev.some((e) => e.k === 'patch:raver'));
ok('…and never scored', !('patch:raver' in (R.log.drift || {})));

console.log('6. junk is refused quietly');
r = await (await push(blobWith({ coins_earned: 140, rep: 12 }, [{ id: 'nope', k: 'coins_earned', d: 5 }, { id: 'aaaa0005', k: 'coins_earned', d: 1e9 }, 'garbage', null]))).json();
R = await rec(a.credId);
ok('bad ids, absurd deltas and non-objects are dropped', R.log.n === 4 && r.ok === true, R.log.n);

console.log('7. the cap');
const many = [];
for (let i = 0; i < 700; i++) many.push(ev('b' + String(i).padStart(7, '0'), 'jelly', 1, 'rave'));
r = await (await push(blobWith({ coins_earned: 140, rep: 12, jelly: 300 }, many.slice(0, 300)))).json();
r = await (await push(blobWith({ coins_earned: 140, rep: 12, jelly: 600 }, many.slice(300, 600)))).json();
r = await (await push(blobWith({ coins_earned: 140, rep: 12, jelly: 700 }, many.slice(600)))).json();
R = await rec(a.credId);
ok('the tape keeps the newest 600 and counts them all', R.log.ev.length === 600 && R.log.n === 704, [R.log.ev.length, R.log.n]);
ok('the seen ring is bounded', R.log.seen.length <= 400, R.log.seen.length);

console.log('8. the desk sees it');
const led = await (await hit('/admin/ledger?key=' + KEY)).json();
const row = (led.passes || []).find((x) => x.anon);   // the ledger answers { passes, sum, … }
ok('the ledger row carries events, drift and the last events', !!row && row.ev === 704 && row.drift === 95 && Array.isArray(row.evLast) && row.evLast.length === 8, row && { ev: row.ev, drift: row.drift, last: row.evLast && row.evLast.length });

function driftSum(log) { return log && log.drift ? Object.values(log.drift).reduce((t, v) => t + Math.abs(v), 0) : 0; }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
