// 🚪 /pay/manage — the way out, on our own page. The subscription id must come
// from the home record and NOWHERE else, so most of this suite is about what a
// hostile browser cannot make the worker do.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
const SUB = '11111111-2222-4333-8444-555555555555';
const CUST = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

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
  POLAR_TOKEN: 'polar_test_token', POLAR_BASE: 'https://api.polar.sh',
  POLAR_WEBHOOK_SECRET: 'whsec_' + btoa('s'), POLAR_T1: 'prod_blue',
};

const te = new TextEncoder();
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// every outbound Polar call is recorded so we can assert WHICH id was acted on
let calls = [];
let reply = () => ({ status: 200, body: { id: SUB, status: 'active', cancel_at_period_end: true,
  ends_at: '2026-09-19T00:00:00Z', amount: 500, product: { name: 'Friend of the Banana' } } });
globalThis.fetch = async (url, init = {}) => {
  const rec = { url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null,
    auth: (init.headers || {}).Authorization };
  calls.push(rec);
  const r = reply(rec);
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
};

const CRED = 'cred-abc';
const TOKEN = 'tok-abc';
async function seedPass(polar) {
  const key = await sha(CRED);
  await env.PASSES.put(`pass/${key}.json`, JSON.stringify({
    pk: 'x', alg: -7, tokens: { [await sha(TOKEN)]: { t: Date.now() } },
    blob: { member: { t: 'sup-t1', until: Date.now() + 20 * 86400000 } },
    ...(polar ? { polar } : {}),
  }));
}
async function manage(body, headers = { Origin: ORIGIN }) {
  const res = await worker.fetch(new Request('https://x/pay/manage', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers },
  }), env);
  return { status: res.status, body: await res.json() };
}

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ok  ', label); }
  else { fail++; console.log('  FAIL', label, extra !== undefined ? JSON.stringify(extra) : ''); }
};

// 1. the gates
{
  await seedPass({ sub: SUB, cust: CUST });
  const r = await manage({ act: 'status', credId: CRED, token: TOKEN }, {});
  ok(r.status === 403, 'no Origin is refused', r);
  const r2 = await manage({ act: 'destroy', credId: CRED, token: TOKEN });
  ok(r2.status === 400, 'an unknown act is refused', r2);
  const r3 = await manage({ act: 'cancel', credId: CRED, token: 'wrong-token' });
  ok(r3.status === 403, 'a wrong pass token cannot cancel', r3);
  const r4 = await manage({ act: 'cancel', credId: 'someone-else', token: TOKEN });
  ok(r4.status === 403, 'an unknown credential cannot cancel', r4);
  const res = await worker.fetch(new Request('https://x/pay/manage', { headers: { Origin: ORIGIN } }), env);
  ok(res.status === 404, 'GET is not a cancel', res.status);
}

// 2. ⚠️ THE ONE THAT MATTERS: a client-supplied subscription id is ignored
{
  calls = [];
  const victim = '99999999-9999-4999-8999-999999999999';
  const r = await manage({ act: 'cancel', credId: CRED, token: TOKEN, sub: victim, subscription_id: victim, polar: { sub: victim } });
  ok(r.status === 200, 'the call succeeds', r);
  ok(calls.length === 1 && calls[0].url.includes(SUB) && !calls[0].url.includes(victim),
    "Polar was called with the STORED id, never the browser's", calls[0] && calls[0].url);
}

// 3. cancel is cancel-at-period-end, with a clamped reason
{
  calls = [];
  const r = await manage({ act: 'cancel', credId: CRED, token: TOKEN, reason: 'nonsense-reason', comment: 'x'.repeat(900) });
  const b = calls[0].body;
  ok(calls[0].method === 'PATCH' && b.cancel_at_period_end === true, 'cancel sets cancel_at_period_end', b);
  ok(b.customer_cancellation_reason === null, 'an off-menu reason is dropped, not forwarded', b);
  ok(!('customer_cancellation_comment' in b), 'no client free-text is forwarded — Polar shows that field back to the customer', b);
  ok(r.body.ending === true && r.body.endsAt, 'the page is told when the hat comes off', r.body);
  ok(!JSON.stringify(r.body).includes(CUST) && !JSON.stringify(r.body).includes(SUB),
    'no polar ids leak back to the browser', r.body);
}

// 4. changing your mind is the same call, undone
{
  calls = [];
  await manage({ act: 'keep', credId: CRED, token: TOKEN });
  ok(calls[0].method === 'PATCH' && calls[0].body.cancel_at_period_end === false, 'keep un-cancels', calls[0].body);
}

// 5. the portal action does not exist — a pass token must not open invoices,
// the billing email and the saved card
{
  calls = [];
  const r = await manage({ act: 'portal', credId: CRED, token: TOKEN });
  ok(r.status === 400, 'there is no portal action to hand out a session token', r);
  ok(calls.length === 0, 'and nothing was called', calls.length);
}

// 6. a member we cannot identify is told so, rather than guessed at
{
  reply = () => ({ status: 200, body: { id: SUB, status: 'active' } });
  await seedPass(null);
  const r = await manage({ act: 'cancel', credId: CRED, token: TOKEN });
  ok(r.status === 200 && r.body.known === false, 'no stamped subscription → known:false, no call', r.body);
  await seedPass({ sub: SUB, cust: CUST });
  const r2 = await manage({ act: 'cancel', credId: CRED, token: TOKEN },
    { Origin: ORIGIN });
  ok(r2.status === 200, 'a stamped membership is manageable again', r2.status);
}

// 7. Polar being down is a 502, never a half-cancel and never a stack trace
{
  await seedPass({ sub: SUB, cust: CUST });
  reply = () => ({ status: 500, body: { error: 'boom' } });
  const r = await manage({ act: 'cancel', credId: CRED, token: TOKEN });
  ok(r.status === 502 && !/boom/.test(JSON.stringify(r.body)), 'a provider error is a plain 502', r);
  globalThis.fetch = async () => { throw new Error('network'); };
  const r2 = await manage({ act: 'cancel', credId: CRED, token: TOKEN });
  ok(r2.status === 502, 'a thrown fetch is still a 502', r2);
}

// 8. ⚠️ the stamp itself: /push must never be able to write home.polar
{
  const key = await sha(CRED);
  await seedPass({ sub: SUB, cust: CUST });
  const res = await worker.fetch(new Request('https://x/push', {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ credId: CRED, token: TOKEN, blob: { stats: {} }, polar: { sub: 'hijack' } }),
  }), env);
  await res.json();
  const rec = JSON.parse(env.PASSES._m.get(`pass/${key}.json`));
  ok(rec.polar.sub === SUB, 'a push cannot overwrite the stamped subscription', rec.polar);
}

// 9. ⚠️ SANDBOX IS NOT PRODUCTION. polarBase() falls back to sandbox, where a
// live subscription id does not exist — cancelling there would report failure
// while the card kept being charged.
{
  await seedPass({ sub: SUB, cust: CUST });
  calls = [];
  const res = await worker.fetch(new Request('https://x/pay/manage', {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ act: 'cancel', credId: CRED, token: TOKEN }),
  }), { ...env, POLAR_BASE: '' });
  const body = await res.json();
  ok(body.known === false && calls.length === 0, 'off production it refuses rather than cancels into thin air', body);
}

// 10. already cancelled is not an error — showing one would tell somebody their
// membership is still running when it is not
{
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' });
    const isRead = (init.method || 'GET') === 'GET';
    return new Response(JSON.stringify(isRead
      ? { id: SUB, status: 'canceled', cancel_at_period_end: true, ends_at: '2026-09-19T00:00:00Z' }
      : { error: 'AlreadyCanceledSubscription' }), { status: isRead ? 200 : 403 });
  };
  calls = [];
  const r = await manage({ act: 'cancel', credId: CRED, token: TOKEN });
  ok(r.status === 200 && r.body.ending === true, 'a second cancel reads the truth back and shows it', r.body);
  ok(calls.length === 2 && calls[1].method === 'GET', 'it re-read rather than guessed', calls.map((c) => c.method));
}

// 11. a busy row is retried once, not reported as a failure
{
  let n = 0;
  globalThis.fetch = async () => {
    n++;
    return n === 1
      ? new Response(JSON.stringify({ error: 'SubscriptionLocked' }), { status: 409 })
      : new Response(JSON.stringify({ id: SUB, status: 'active', cancel_at_period_end: true, ends_at: '2026-09-19T00:00:00Z' }), { status: 200 });
  };
  const r = await manage({ act: 'cancel', credId: CRED, token: TOKEN });
  ok(r.status === 200 && n === 2, 'a 409 is retried once and then succeeds', { n, r: r.body });
}

// 12. the per-pass budget — the IP throttle is a per-isolate Map, not a control
{
  globalThis.fetch = async () => new Response(JSON.stringify({ id: SUB, status: 'active' }), { status: 200 });
  await seedPass({ sub: SUB, cust: CUST });
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await manage({ act: 'keep', credId: CRED, token: TOKEN })).status);
  ok(codes.filter((c) => c === 200).length === 5 && codes.slice(5).every((c) => c === 429),
    'five mutations an hour per pass, then 429', codes);
  const r = await manage({ act: 'status', credId: CRED, token: TOKEN });
  ok(r.status === 200, 'reading your own state is never rate-limited', r.status);
}

// 13. the public wall must never carry a subscription id
{
  await env.PASSES.put('kofi/members.json', JSON.stringify({
    deadbeef: { t: 'sup-t1', until: Date.now() + 86400000, n: 'Kiwi', sub: SUB, cust: CUST },
  }));
  const res = await worker.fetch(new Request('https://x/supporters', { headers: { Origin: ORIGIN } }), env);
  const txt = await res.text();
  ok(!txt.includes(SUB) && !txt.includes(CUST), 'the public feed leaks no polar ids', txt.slice(0, 200));
}

// 14. a membership from before the stamp existed is recovered from the member
// store — using the hash in the RECORD KEY, never anything the browser said
{
  const EH = 'b'.repeat(64);
  await env.PASSES.put(`pass/m${EH}.json`, JSON.stringify({
    mail: 1, tokens: { [await sha(TOKEN)]: { t: Date.now() } },
    blob: { member: { t: 'sup-t1', until: Date.now() + 9 * 86400000 } },
  }));
  await env.PASSES.put('kofi/members.json', JSON.stringify({
    [EH]: { t: 'sup-t1', until: Date.now() + 9 * 86400000, n: 'Old', sub: SUB, cust: CUST },
  }));
  globalThis.fetch = async (url) => {
    calls.push({ url: String(url) });
    return new Response(JSON.stringify({ id: SUB, status: 'active', cancel_at_period_end: false }), { status: 200 });
  };
  calls = [];
  const r = await manage({ act: 'status', credId: 'm:m' + EH, token: TOKEN });
  ok(r.body.known === true && calls[0] && calls[0].url.includes(SUB),
    'an older membership is recovered and manageable', r.body);
  const rec = JSON.parse(env.PASSES._m.get(`pass/m${EH}.json`));
  ok(rec.polar && rec.polar.sub === SUB, 'and the member store is consulted only once', rec.polar);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
