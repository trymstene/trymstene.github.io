// ☕ THE KO-FI RAIL, in-process against a fake R2: webhook auth, tier mapping,
// wall dedupe, grant delivery to an existing pass, late-login delivery via
// /mail/use, pending banking for unknown tiers, and the /supporters feed.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
const KOFI = 'test-kofi-token';

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
      return { objects: keys.map((key) => ({ key })), truncated: false };
    },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', KOFI_TOKEN: KOFI };

const te = new TextEncoder();
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function hook(data, e = env) {
  const req = new Request('https://x/kofi-hook', {
    method: 'POST',
    body: new URLSearchParams({ data: JSON.stringify(data) }),
  });
  const res = await worker.fetch(req, e);
  return { status: res.status, body: await res.json() };
}
let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ok  ', label); }
  else { fail++; console.log('  FAIL', label, extra !== undefined ? JSON.stringify(extra) : ''); }
};

// 1. auth gates
{
  const r = await hook({ verification_token: KOFI }, { ...env, KOFI_TOKEN: '' });
  ok(r.status === 503, 'unconfigured hook refuses (503)', r);
  const r2 = await hook({ verification_token: 'wrong', type: 'Donation' });
  ok(r2.status === 403, 'wrong verification_token refused (403)', r2);
}

// 2. a public donation lands on the wall once, retries deduped
{
  const d = { verification_token: KOFI, type: 'Donation', kofi_transaction_id: 'tx-1',
    from_name: 'Kiwi', amount: '3.00', currency: 'USD', is_public: true, email: 'kiwi@example.com' };
  await hook(d); await hook(d);
  const wall = JSON.parse(env.PASSES._m.get('kofi/wall.json'));
  ok(wall.length === 1 && wall[0].n === 'Kiwi' && wall[0].k === 'coffee', 'donation on the wall, deduped', wall);
}

// 3. private donations keep their name off the wall
{
  await hook({ verification_token: KOFI, type: 'Donation', kofi_transaction_id: 'tx-2',
    from_name: 'Shy', amount: '5.00', currency: 'USD', is_public: false, email: 'shy@example.com' });
  const wall = JSON.parse(env.PASSES._m.get('kofi/wall.json'));
  ok(wall[0].n === '', 'private donation shows no name', wall[0]);
}

// 4. membership with no pass yet: banked in members, not delivered
{
  const r = await hook({ verification_token: KOFI, type: 'Subscription', kofi_transaction_id: 'tx-3',
    is_subscription_payment: true, is_first_subscription_payment: true,
    tier_name: 'Legend of Banana World', from_name: 'Jade', amount: '15.00', currency: 'USD',
    is_public: true, email: ' Jade@Example.com ' });
  const members = JSON.parse(env.PASSES._m.get('kofi/members.json'));
  const eh = await sha('jade@example.com');
  const m = members[eh];
  ok(r.body.ok && r.body.delivered === false, 'no pass yet -> not delivered', r.body);
  ok(m && m.t === 'sup-t3' && m.until > Date.now() + 30 * 86400e3, 'tier + until banked (email normMailed)', m);
}

// 5. late login via /mail/use lands the waiting grant
{
  const eh = await sha('jade@example.com');
  const tok = 'ticket-1';
  await env.PASSES.put(`mailtkt/${await sha(tok)}.json`, JSON.stringify({ k: 'm' + eh, exp: Date.now() + 60000 }));
  const req = new Request(`https://x/mail/use?t=${tok}`, { method: 'POST', headers: { Origin: ORIGIN } });
  const res = await worker.fetch(req, env);
  const body = await res.json();
  ok(res.status === 200 && body.blob && body.blob.member && body.blob.member.t === 'sup-t3',
    'mail/use delivers the waiting grant', body.blob && body.blob.member);
  const rec = JSON.parse(env.PASSES._m.get(`pass/m${eh}.json`));
  ok(rec.blob && rec.blob.member && rec.blob.member.t === 'sup-t3', 'grant persisted on the home record', rec.blob && rec.blob.member);
}

// 6. renewal extends; existing pass gets direct delivery
{
  const r = await hook({ verification_token: KOFI, type: 'Subscription', kofi_transaction_id: 'tx-4',
    is_subscription_payment: true, tier_name: 'Legend of Banana World', from_name: 'Jade',
    amount: '15.00', currency: 'USD', is_public: true, email: 'jade@example.com' });
  ok(r.body.delivered === true, 'renewal delivered straight to the existing pass', r.body);
}

// 7. tier fallback by amount when tier_name is unrecognizable but USD
{
  await hook({ verification_token: KOFI, type: 'Subscription', kofi_transaction_id: 'tx-5',
    is_subscription_payment: true, tier_name: 'weird custom name', from_name: 'Ten',
    amount: '10.00', currency: 'USD', is_public: true, email: 'ten@example.com' });
  const members = JSON.parse(env.PASSES._m.get('kofi/members.json'));
  const m = members[await sha('ten@example.com')];
  ok(m && m.t === 'sup-t2', 'USD 10 falls back to sup-t2', m);
}

// 8. unmappable membership is banked as pending, never dropped
{
  const r = await hook({ verification_token: KOFI, type: 'Subscription', kofi_transaction_id: 'tx-6',
    is_subscription_payment: true, tier_name: 'mystery', from_name: 'Nok', amount: '80', currency: 'NOK',
    is_public: true, email: 'nok@example.com' });
  const pend = JSON.parse(env.PASSES._m.get('kofi/pending.json'));
  ok(r.body.banked && pend.length === 1 && pend[0].tier_name === 'mystery', 'unknown tier banked in pending', pend);
}

// 9. the public /supporters feed: active members by rank, wall names only
{
  const req = new Request('https://x/supporters', { headers: { Origin: ORIGIN } });
  const res = await worker.fetch(req, env);
  const body = await res.json();
  ok(res.status === 200 && body.members.some((m) => m.n === 'Jade' && m.t === 'sup-t3'),
    'supporters feed lists the member', body.members);
  ok(body.wall.every((w) => !('tx' in w) && !('a' in w)), 'wall feed carries names only (no tx/amounts)', body.wall && body.wall[0]);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
