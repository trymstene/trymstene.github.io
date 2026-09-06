// ⚔️ TWO PHONES, ONE INSTANT — conditional writes on the pass record, in-process
// against a fake R2 that hands out etags and refuses a stale `onlyIf`. Two
// devices push at the same moment: both events must land, the second writer
// must have been told "no" once and re-run. Then a desk grant racing a push,
// then four phones at once.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
function fakeR2() {
  const m = new Map();
  let ver = 0;
  const stats = { conflicts: 0, puts: 0 };
  return {
    _m: m, stats,
    async get(k) {
      if (!m.has(k)) return null;
      const { v, etag } = m.get(k);
      return { etag, json: async () => JSON.parse(v), text: async () => v };
    },
    async put(k, v, opts) {
      const cur = m.get(k);
      const want = opts && opts.onlyIf && opts.onlyIf.etagMatches;
      if (want !== undefined && (!cur || cur.etag !== want)) { stats.conflicts++; return null; }
      stats.puts++;
      const etag = 'e' + (++ver);
      m.set(k, { v: typeof v === 'string' ? v : JSON.stringify(v), etag });
      return { etag };
    },
    async delete(k) { m.delete(k); },
    async list(opts = {}) {
      const p = opts.prefix || '';
      return { objects: [...m.keys()].filter((k) => k.startsWith(p)).sort().map((key) => ({ key })), truncated: false };
    },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', PASS_ADMIN_KEY: 'desk-key', RULES_STRICT: '0' };
const ctx = { waitUntil() {}, passThroughOnException() {} };
let ipN = 0;
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.1.' + (++ipN % 200), ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
const J = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const te = new TextEncoder();
const sha = async (x) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(x)))].map((v) => v.toString(16).padStart(2, '0')).join('');
const recOf = async (credId) => JSON.parse(env.PASSES._m.get('pass/' + (await sha(credId)) + '.json').v);
// a push from device `dev` whose coins_earned slot now reads `coins`, carrying one
// tape event of `d` (the tape wants 6-12 hex ids)
const blobFor = (dev, coins, id, d) => ({
  pass: { created: Date.now(), patches: {}, days: [], base: {}, led: { coins_earned: { [dev]: coins } }, stats: { coins_earned: coins } },
  shelf: [], name: 'Racer', nameAt: 1,
  ev: [{ id, t: Date.now(), k: 'coins_earned', d: d || coins, a: 'park', s: 'weed' }], evDrop: 0, evDev: dev,
});
const empty = { pass: { created: Date.now(), patches: {}, days: [], base: {}, led: {}, stats: {} } };

console.log('A. the record remembers its etag; a lone push lands without a conflict');
const a = await J(await post('/anon', { blob: empty }));
ok('a pass exists', a.credId && a.token, a);
const c0 = env.PASSES.stats.conflicts;
const one = await J(await post('/push', { credId: a.credId, token: a.token, blob: blobFor('devA0000', 5, 'aa0001') }));
ok('a lone push lands, its event seen', one.ok === true && one.seen && one.seen.includes('aa0001'), { ok: one.ok, seen: one.seen });
ok('…without a conflict', env.PASSES.stats.conflicts === c0, env.PASSES.stats);

console.log('B. two phones push at the same instant');
const [pa, pb] = await Promise.all([
  post('/push', { credId: a.credId, token: a.token, blob: blobFor('devA0000', 10, 'aa0002', 5) }).then(J),
  post('/push', { credId: a.credId, token: a.token, blob: blobFor('devB0000', 5, 'bb0001') }).then(J),
]);
ok('both pushes were answered ok', pa.ok === true && pb.ok === true, { pa: pa.status, pb: pb.status });
const r = await recOf(a.credId);
ok('the loser was told no once and re-ran', env.PASSES.stats.conflicts >= c0 + 1, env.PASSES.stats);
ok('both events are in the tape\'s seen ring', r.log.seen.includes('aa0002') && r.log.seen.includes('bb0001'), r.log.seen);
ok('both devices keep their slot', r.blob.pass.led.coins_earned.devA0000 === 10 && r.blob.pass.led.coins_earned.devB0000 === 5, r.blob.pass.led.coins_earned);
ok('the wallet counted every accepted coin (5 + 5 + 5)', r.wallet && r.wallet.earned === 15, r.wallet);
ok('the record holds no etag field of its own', !Object.keys(r).some((k) => /etag/i.test(k)), Object.keys(r));

console.log('C. a desk grant racing a push loses nothing');
const rows = await J(await hit('/admin/ledger?key=desk-key'));
const id = rows.passes[0].id;
const [g, p3] = await Promise.all([
  post('/admin/grant', { key: 'desk-key', id, coins: 100 }).then(J),
  // (a weed pays at most 6 a time under RULES.park — the event stays inside the rule)
  post('/push', { credId: a.credId, token: a.token, blob: blobFor('devA0000', 15, 'aa0003', 5) }).then(J),
]);
ok('the grant went through', g.ok === true, g);
ok('the push went through', p3.ok === true, p3.status);
const r2 = await recOf(a.credId);
ok('the hq slot survived the race', r2.blob.pass.led.coins_earned.hq === 100, r2.blob.pass.led.coins_earned);
ok('and the phone\'s newest event too', r2.log.seen.includes('aa0003') && r2.blob.pass.led.coins_earned.devA0000 === 15, r2.blob.pass.led.coins_earned);
ok('the wallet has both: 15 + 100 + 5', r2.wallet.earned === 120, r2.wallet);

console.log('D. four phones at once');
const b2 = await J(await post('/anon', { blob: empty }));
ok('a second mint writes without a precondition', b2.credId && b2.token, b2);
const c1 = env.PASSES.stats.conflicts;
const four = await Promise.all([1, 2, 3, 4].map((n) => post('/push', { credId: b2.credId, token: b2.token, blob: blobFor('dev' + n + '0000', 2, 'cc000' + n) }).then(J)));
ok('all four answered ok', four.every((x) => x.ok === true), four.map((x) => x.status));
const r3 = await recOf(b2.credId);
ok('every event kept', ['cc0001', 'cc0002', 'cc0003', 'cc0004'].every((e) => r3.log.seen.includes(e)), r3.log.seen);
ok('every slot kept', [1, 2, 3, 4].every((n) => r3.blob.pass.led.coins_earned['dev' + n + '0000'] === 2), r3.blob.pass.led.coins_earned);
ok('the wallet has all eight coins', r3.wallet.earned === 8, r3.wallet);
ok('…and the losers re-ran (conflicts counted)', env.PASSES.stats.conflicts > c1, env.PASSES.stats);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
