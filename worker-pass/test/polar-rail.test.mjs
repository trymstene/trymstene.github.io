// 🐻‍❄️ THE POLAR RAIL, in-process against a fake R2: Standard-Webhooks
// signature verification, tier mapping (product id → name → amount), grant
// delivery into the pass, renewal extension, revocation, and the shared wall.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
const SECRET = 'whsec_' + btoa('polar-test-secret');
const P1 = 'prod_blue', P2 = 'prod_silver', P3 = 'prod_gold';

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
      return { objects: [...m.keys()].filter((k) => k.startsWith(p)).sort().map((key) => ({ key })), truncated: false };
    },
  };
}
const env = {
  PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't',
  POLAR_WEBHOOK_SECRET: SECRET, POLAR_TOKEN: 'polar_test_token',
  POLAR_T1: P1, POLAR_T2: P2, POLAR_T3: P3,
};

const te = new TextEncoder();
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function sign(id, ts, body, secret = SECRET) {
  const s = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let bytes;
  try { bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); } catch (e) { bytes = te.encode(s); }
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, te.encode(id + '.' + ts + '.' + body));
  return 'v1,' + btoa(String.fromCharCode(...new Uint8Array(mac)));
}
async function hook(payload, opts = {}) {
  const body = JSON.stringify(payload);
  const id = opts.id || 'msg_' + Math.random().toString(16).slice(2);
  const ts = String(opts.ts || Math.floor(Date.now() / 1000));
  const sig = opts.sig || await sign(id, ts, body, opts.secret);
  const res = await worker.fetch(new Request('https://x/polar-hook', {
    method: 'POST', body,
    headers: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': sig, 'Content-Type': 'application/json' },
  }), opts.env || env);
  return { status: res.status, body: await res.json() };
}
const sub = (over = {}) => ({
  id: 'sub_' + Math.random().toString(16).slice(2),
  status: 'active',
  amount: 500,
  current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  product: { id: P1, name: 'Friend of the Banana' },
  customer: { email: 'kiwi@example.com', public_name: 'KiwiRainbowRain' },
  ...over,
});

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ok  ', label); }
  else { fail++; console.log('  FAIL', label, extra !== undefined ? JSON.stringify(extra) : ''); }
};

// 1. the signature gate
{
  const r = await hook({ type: 'subscription.active', data: sub() }, { sig: 'v1,deadbeef' });
  ok(r.status === 403, 'a bad signature is refused (403)', r);
  const r2 = await hook({ type: 'subscription.active', data: sub() }, { secret: 'whsec_' + btoa('someone-elses') });
  ok(r2.status === 403, "another sender's secret is refused", r2);
  const r3 = await hook({ type: 'subscription.active', data: sub() }, { ts: Math.floor(Date.now() / 1000) - 4000 });
  ok(r3.status === 403, 'a replayed old timestamp is refused', r3);
  const r4 = await worker.fetch(new Request('https://x/polar-hook', { method: 'POST', body: '{}' }),
    { ...env, POLAR_WEBHOOK_SECRET: '' });
  ok(r4.status === 503, 'unconfigured rail refuses (503)', r4.status);
}

// 2. a real subscription grants, banks, and lands on the shared wall
{
  const r = await hook({ type: 'subscription.active', data: sub() });
  const members = JSON.parse(env.PASSES._m.get('kofi/members.json'));
  const m = members[await sha('kiwi@example.com')];
  ok(r.status === 200 && r.body.tier === 'sup-t1', 'subscription.active grants sup-t1', r.body);
  ok(m && m.until > Date.now() + 25 * 86400e3, 'until comes from current_period_end', m);
  ok(!env.PASSES._m.get('kofi/wall.json'),
    'subscription.active alone writes NO wall line (Polar fires four events per payment)');
  // …the payment itself does, once, on the same wall the Ko-fi rail writes
  await hook({ type: 'order.paid', data: sub({ id: 'ord_1', subscription_id: 'sub_1' }) });
  await hook({ type: 'order.paid', data: sub({ id: 'ord_1', subscription_id: 'sub_1' }) });
  const wall = JSON.parse(env.PASSES._m.get('kofi/wall.json'));
  ok(wall.length === 1 && wall[0].k === 'member' && wall[0].n === 'KiwiRainbowRain',
    'order.paid writes exactly one line, retries deduped', wall);
}

// 3. tier mapping falls back: unknown product id → name → amount
{
  await hook({ type: 'subscription.active', data: sub({ product: { id: 'prod_x', name: 'Legend of Banana World' }, amount: 1500, customer: { email: 'byname@example.com' } }) });
  await hook({ type: 'subscription.active', data: sub({ product: { id: 'prod_y', name: 'mystery' }, amount: 1000, customer: { email: 'byamount@example.com' } }) });
  const members = JSON.parse(env.PASSES._m.get('kofi/members.json'));
  ok(members[await sha('byname@example.com')].t === 'sup-t3', 'unknown id maps by product NAME');
  ok(members[await sha('byamount@example.com')].t === 'sup-t2', 'unnamed maps by AMOUNT (1000c → silver)');
}

// 4. a paid-but-not-yet-signed-in supporter waits, then lands at /mail/use
{
  const r = await hook({ type: 'subscription.active', data: sub({ product: { id: P3, name: 'Legend of Banana World' }, amount: 1500, customer: { email: 'later@example.com', public_name: 'Later' } }) });
  ok(r.body.delivered === false, 'no pass yet → grant waits in the member store', r.body);
  const eh = await sha('later@example.com');
  const tok = 'ticket-polar';
  await env.PASSES.put(`mailtkt/${await sha(tok)}.json`, JSON.stringify({ k: 'm' + eh, exp: Date.now() + 60000 }));
  const res = await worker.fetch(new Request(`https://x/mail/use?t=${tok}`, { method: 'POST', headers: { Origin: ORIGIN } }), env);
  const body = await res.json();
  ok(body.blob && body.blob.member && body.blob.member.t === 'sup-t3',
    'the waiting grant lands when they sign in', body.blob && body.blob.member);
}

// 5. renewal extends rather than shortens; a stale period never claws back
{
  const eh = await sha('kiwi@example.com');
  const before = JSON.parse(env.PASSES._m.get('kofi/members.json'))[eh].until;
  await hook({ type: 'subscription.cycled', data: sub({ current_period_end: new Date(Date.now() + 60 * 86400000).toISOString() }) });
  const mid = JSON.parse(env.PASSES._m.get('kofi/members.json'))[eh].until;
  await hook({ type: 'subscription.updated', data: sub({ current_period_end: new Date(Date.now() + 5 * 86400000).toISOString() }) });
  const after = JSON.parse(env.PASSES._m.get('kofi/members.json'))[eh].until;
  ok(mid > before, 'a renewal pushes `until` out', { before, mid });
  ok(after === mid, 'an older period_end can never pull it back in', { mid, after });
}

// 6. revocation brings the clock forward (never a negative, never a delete)
{
  const r = await hook({ type: 'subscription.revoked', data: sub() });
  const m = JSON.parse(env.PASSES._m.get('kofi/members.json'))[await sha('kiwi@example.com')];
  ok(r.body.revoked && m.until <= Date.now(), 'revoked expires the grant by TIME', m);
}

// 6b. ⚠️ A REFUND IS NOT A CANCELLATION: Polar leaves the subscription active
// and fires order.refunded separately, so this must revoke on its own
{
  await hook({ type: 'subscription.active', data: sub({ customer: { email: 'refundme@example.com', public_name: 'Refundme' } }) });
  const before = JSON.parse(env.PASSES._m.get('kofi/members.json'))[await sha('refundme@example.com')];
  const r = await hook({ type: 'order.refunded', data: sub({ id: 'ord_ref', customer: { email: 'refundme@example.com' } }) });
  const after = JSON.parse(env.PASSES._m.get('kofi/members.json'))[await sha('refundme@example.com')];
  ok(before.until > Date.now(), 'the hat was granted first', before);
  ok(r.body.revoked && after.until <= Date.now(), 'order.refunded retires the hat by TIME', after);
}

// 7. a cancelled-but-still-paid subscription keeps the hat until period end
{
  const r = await hook({ type: 'subscription.canceled', data: sub({ customer: { email: 'kept@example.com' } }) });
  ok(r.body.ignored === 'subscription.canceled', 'cancel-at-period-end is ignored, not revoked', r.body);
}

// 8. checkout minting: unconfigured falls back to the page, never an error
{
  const res = await worker.fetch(new Request('https://x/pay/checkout?t=t1'), { ...env, POLAR_TOKEN: '' });
  ok(res.status === 302 && /pay=unconfigured/.test(res.headers.get('location') || ''),
    'no token → back to /supporters/ with a reason', res.headers.get('location'));
  const res2 = await worker.fetch(new Request('https://x/pay/checkout?t=nope'), env);
  ok(res2.status === 302 && /pay=unconfigured/.test(res2.headers.get('location') || ''),
    'an unknown tier cannot mint a checkout', res2.headers.get('location'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
