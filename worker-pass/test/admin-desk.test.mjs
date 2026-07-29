// The Banana HQ admin desk, in-process against a fake R2.
// ⭐ THE POINT OF THIS SUITE is the last two blocks: they push a device's OLD
// values back after an admin edit, which is the thing that silently undoes naive
// admin writes. Grants and coin-takes must survive it; if they ever stop
// surviving it, the desk is lying to Trym and this test says so.
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
      const keys = [...m.keys()].filter((k) => k.startsWith(p)).sort();
      const lim = opts.limit || 1000;
      return { objects: keys.slice(0, lim).map((key) => ({ key })), truncated: keys.length > lim };
    },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', PASS_ADMIN_KEY: KEY };
const ctx = { waitUntil() {} };
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};

// ── two passes: one recoverable by email, one device-only ────────────────
const CRED_A = 'device-a', TOK_A = 'token-a';
const keyA = await sha(CRED_A);
const EMAIL = 'player@example.com';
const mailKeyA = 'm' + (await sha(EMAIL));
const CRED_B = 'device-b', TOK_B = 'token-b';
const keyB = await sha(CRED_B);

await env.PASSES.put(`pass/${keyA}.json`, JSON.stringify({
  pk: 'pk-a', alg: -7, tokens: { [await sha(TOK_A)]: Date.now() }, updated: Date.now(),
  blob: { name: 'Disco Dave', glow: '1', shelf: [{ params: 'x', created: 1 }],
    pass: { created: 1750000000000, patches: { og: 1, night1: 2 }, days: ['2026-07-28', '2026-07-29'],
      stats: { rep: 240, jelly: 12, coins_earned: 500, coins_spent: 120, own_tophat: 1 } } },
}));
await env.PASSES.put(`pass/${mailKeyA}.json`, JSON.stringify({ mail: 1, tokens: {}, link: keyA }));
await env.PASSES.put(`pass/${keyB}.json`, JSON.stringify({
  pk: 'pk-b', alg: -7, tokens: { [await sha(TOK_B)]: Date.now() }, updated: Date.now() - 20 * 86400000,
  blob: { pass: { created: 1755000000000, patches: {}, days: [], stats: { rep: 10 } } },
}));

console.log('\n1. the ledger');
{
  const bad = await hit('/admin/ledger?key=nope');
  ok('a wrong key is 404, not 403 (deny as nothing)', bad.status === 404, bad.status);
  const r = await hit('/admin/ledger?key=' + KEY);
  const d = await r.json();
  ok('opens with the right key', r.status === 200 && Array.isArray(d.passes), d);
  ok('one row per PASS, not per credential', d.passes.length === 2, d.passes.map((p) => p.id));
  const a = d.passes.find((p) => p.id === keyA.slice(0, 8));
  ok('the row carries the name', a && a.name === 'Disco Dave', a && a.name);
  ok('coins are a BALANCE (earned − spent)', a && a.coins === 380, a && a.coins);
  ok('badges counted', a && a.badges === 2, a && a.badges);
  ok('⭐ recoverable: the email pointer sets mail:true', a && a.mail === true, a && a.mail);
  ok('…and it counts as a device', a && a.devices === 2, a && a.devices);
  const b = d.passes.find((p) => p.id === keyB.slice(0, 8));
  ok('⭐ device-only pass is flagged NOT recoverable', b && b.mail === false, b && b.mail);
  ok('summary totals the coins in circulation', d.sum.coins === 380 + 0, d.sum);
  ok('summary counts who can get back in', d.sum.withMail === 1, d.sum);
  ok('summary counts active-this-week', d.sum.activeWeek === 1, d.sum);
}

console.log('\n2. ✉️ find the pass behind an email (the privacy-page promise)');
{
  const r = await post('/admin/find', { key: KEY, email: EMAIL });
  const d = await r.json();
  ok('resolves the address to its HOME pass', d.found && d.id === keyA.slice(0, 8), d);
  const miss = await (await post('/admin/find', { key: KEY, email: 'nobody@example.com' })).json();
  ok('an unknown address is simply not found', miss.found === false, miss);
  const noKey = await post('/admin/find', { key: 'nope', email: EMAIL });
  ok('no key, no lookup', noKey.status === 404, noKey.status);
}

console.log('\n3. grants');
{
  const r = await post('/admin/grant', { key: KEY, id: keyA.slice(0, 8), coins: 100, rep: 60, gear: 'crown' });
  const d = await r.json();
  ok('grant returns the new balance', d.ok && d.coins === 480, d);
  ok('rep went up', d.rep === 300, d);
  const rec = JSON.parse(env.PASSES._m.get(`pass/${keyA}.json`));
  ok('gear is a real own_ stat', rec.blob.pass.stats.own_crown === 1, rec.blob.pass.stats);
  const empty = await post('/admin/grant', { key: KEY, id: keyA.slice(0, 8) });
  ok('a no-op grant is refused rather than logged', empty.status === 400, empty.status);
  const capped = await (await post('/admin/grant', { key: KEY, id: keyA.slice(0, 8), coins: 99999999 })).json();
  ok('a fat-fingered amount is capped, not applied', capped.coins <= 480 + 100000, capped.coins);
}

console.log('\n4. ⭐ a grant SURVIVES the player\'s next device push');
{
  const before = JSON.parse(env.PASSES._m.get(`pass/${keyA}.json`)).blob.pass.stats;
  // the device still believes its own older, lower numbers
  const r = await post('/push', { credId: CRED_A, token: TOK_A, blob: {
    pass: { created: 1750000000000, patches: { og: 1 }, days: ['2026-07-28'],
      stats: { rep: 240, jelly: 12, coins_earned: 500, coins_spent: 120 } } } });
  ok('the push is accepted', r.status === 200, await r.text());
  const after = JSON.parse(env.PASSES._m.get(`pass/${keyA}.json`)).blob.pass.stats;
  ok('granted coins survived (MAX kept the raise)', after.coins_earned === before.coins_earned, [before.coins_earned, after.coins_earned]);
  ok('granted rep survived', after.rep === before.rep, [before.rep, after.rep]);
  ok('granted gear survived', after.own_crown === 1, after.own_crown);
}

console.log('\n5. ⭐ TAKING coins survives too — because it raises SPENT');
{
  const bal0 = (await (await hit('/admin/ledger?key=' + KEY)).json()).passes.find((p) => p.id === keyA.slice(0, 8)).coins;
  const d = await (await post('/admin/grant', { key: KEY, id: keyA.slice(0, 8), take: 200 })).json();
  ok('the balance drops by the amount taken', d.coins === bal0 - 200, [bal0, d.coins]);
  // …and the device pushes its old (lower) coins_spent right back
  await post('/push', { credId: CRED_A, token: TOK_A, blob: {
    pass: { created: 1750000000000, patches: {}, days: [], stats: { coins_earned: 500, coins_spent: 120 } } } });
  const bal1 = (await (await hit('/admin/ledger?key=' + KEY)).json()).passes.find((p) => p.id === keyA.slice(0, 8)).coins;
  ok('the deduction STILL holds after that push', bal1 === d.coins, [d.coins, bal1]);
}

console.log('\n6. erase (and the guard rail on it)');
{
  const loose = await post('/admin/erase', { key: KEY, id: keyA.slice(0, 8), confirm: 'whatever' });
  ok('a mismatched confirmation refuses', loose.status === 400, loose.status);
  ok('…and the pass is still there', env.PASSES._m.has(`pass/${keyA}.json`));
  const r = await post('/admin/erase', { key: KEY, id: keyA.slice(0, 8), confirm: keyA.slice(0, 8) });
  const d = await r.json();
  ok('erase reports how many credentials went', d.ok && d.credentials === 2, d);
  ok('the pass record is gone', !env.PASSES._m.has(`pass/${keyA}.json`));
  ok('⚠️ and so is its email pointer — no dangling link left behind', !env.PASSES._m.has(`pass/${mailKeyA}.json`));
  const gone = await (await post('/admin/find', { key: KEY, email: EMAIL })).json();
  ok('the address no longer resolves to anything', gone.found === false, gone);
}

console.log('\n7. the audit trail');
{
  const d = await (await hit('/admin/log?key=' + KEY)).json();
  const acts = d.rows.map((r) => r.act);
  ok('every write left a row', acts.includes('grant') && acts.includes('erase'), acts);
  ok('the erase row says what it took with it',
    d.rows.some((r) => r.act === 'erase' && /credential/.test(r.detail || '')), d.rows);
  const shut = await hit('/admin/log?key=nope');
  ok('the log needs the key too', shut.status === 404, shut.status);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
