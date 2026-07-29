// The mail rail, end to end, in-process. A fake R2 plus a stubbed sender lets
// us read the magic link we just "sent" — the only way to exercise /mail/use
// (and the ATTACH path) without an inbox.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
let sent = [];   // captured "emails"

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

const env = {
  PASSES: fakeR2(),
  ALLOWED_ORIGIN: ORIGIN,
  PASS_HMAC: 'test-stamp',
  RESEND_KEY: 'test-key',
  MAIL_FROM: 'banana@send.trymstene.com',
};

// intercept the Resend call and keep the link
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) {
    const body = JSON.parse(init.body);
    sent.push({ to: body.to[0], link: (body.text.match(/https?:\/\/\S+/) || [''])[0] });
    return new Response(JSON.stringify({ id: 'fake' }), { status: 200 });
  }
  return realFetch(url, init);
};

const ctx = { waitUntil() {}, passThroughOnException() {} };
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};

// ── a magic link, requested and read ────────────────────────────────────
const sha = async (str) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');
async function link(email) {
  sent = [];
  // the 2-min per-address cooldown is real and correct (it answers ok:true and
  // silently skips the send); drop it so a test can ask twice in a row
  await env.PASSES.delete(`mailcd/${await sha(email)}.json`);
  const r = await post('/mail/signin', { email });
  const body = await r.json();
  if (!sent.length) return { status: r.status, body, t: null };
  return { status: r.status, body, t: new URL(sent[0].link).searchParams.get('in') };
}

console.log('\n1. sign in with a brand-new address');
{
  const { status, body, t } = await link('newbie@example.com');
  ok('answers 200 {ok:true}', status === 200 && body.ok === true, body);
  ok('a link was actually sent', !!t);
  const r = await hit('/mail/use?t=' + t);
  const got = await r.json();
  ok('the ticket spends for a credId + token', r.status === 200 && !!got.credId && !!got.token, got);
  ok('the credId is the opaque m: form', String(got.credId).startsWith('m:'), got.credId);
  ok('a fresh address is NOT flagged as attached', got.attached === false, got.attached);
  ok('no address is stored anywhere', ![...env.PASSES._m.values()].some((v) => v.includes('newbie@example.com')));

  const again = await hit('/mail/use?t=' + t);
  ok('the same link cannot be spent twice', again.status === 404, await again.json());
}

console.log('\n2. sign in again with the SAME address → same pass, no duplicate');
{
  const first = env.PASSES._m.size;
  const { t } = await link('newbie@example.com');
  ok('a second link is issued', !!t, 'cooldown may have suppressed it');
  if (t) {
    const got = await (await hit('/mail/use?t=' + t)).json();
    ok('still not "attached" (the record already existed)', got.attached === false, got.attached);
    ok('no second pass record appeared', env.PASSES._m.size <= first + 1, [first, env.PASSES._m.size]);
  }
}

console.log('\n3. ⭐ ATTACH: a logged-in pass gains an address as a POINTER');
{
  const credId = 'device-credential-xyz';
  const keyOf = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const homeKey = await keyOf(credId);
  const tokPlain = 'device-token-def';
  const tokHash = await keyOf(tokPlain);
  await env.PASSES.put(`pass/${homeKey}.json`, JSON.stringify({
    pk: 'fake-pk', alg: -7, tokens: { [tokHash]: Date.now() },
    blob: { stats: { rep: 130 }, v: 'the-real-world' },
  }));

  const { t } = await link('trym2@example.com');
  const got = await (await hit(`/mail/use?t=${t}&credId=${credId}&token=${tokPlain}`)).json();
  ok('flagged attached', got.attached === true, got);
  ok('the blob returned is the EXISTING pass, not an empty one',
    got.blob && got.blob.v === 'the-real-world', got.blob);
  const mailKey = 'm' + (await keyOf('trym2@example.com'));
  const rec = JSON.parse(env.PASSES._m.get(`pass/${mailKey}.json`));
  ok('the mail record is a POINTER (link set, no blob of its own)',
    rec.link === homeKey && !rec.blob, rec);
  ok('one hop only — it points at a primary', !JSON.parse(env.PASSES._m.get(`pass/${homeKey}.json`)).link);

  // and the pointer works for day-to-day sync
  const pull = await hit(`/pull?credId=${encodeURIComponent(got.credId)}&token=${encodeURIComponent(got.token)}`);
  const pulled = await pull.json();
  ok('/pull through the email pointer returns the shared world',
    pulled.blob && pulled.blob.v === 'the-real-world', pulled);
}

console.log('\n4. ⚠️ an EXISTING address is never re-pointed at whatever pass is open');
{
  const credId = 'someone-elses-device';
  const keyOf = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const homeKey = await keyOf(credId);
  const tokPlain = 'token-ghi';
  await env.PASSES.put(`pass/${homeKey}.json`, JSON.stringify({
    pk: 'pk2', alg: -7, tokens: { [await keyOf(tokPlain)]: Date.now() },
    blob: { v: 'an-attackers-world' },
  }));
  const mailKey = 'm' + (await keyOf('newbie@example.com'));
  const before = JSON.parse(env.PASSES._m.get(`pass/${mailKey}.json`));

  const { t } = await link('newbie@example.com');
  if (!t) { ok('(skipped — cooldown)', true); }
  else {
    const got = await (await hit(`/mail/use?t=${t}&credId=${credId}&token=${tokPlain}`)).json();
    const after = JSON.parse(env.PASSES._m.get(`pass/${mailKey}.json`));
    ok('not re-flagged as attached', got.attached === false, got.attached);
    ok('the existing mail record was NOT repointed', !after.link && !before.link, after);
    ok('it did not hand over the other pass', !(got.blob && got.blob.v === 'an-attackers-world'), got.blob);
  }
}

console.log('\n5. a bad or missing proof falls back to a plain login, never an error');
{
  const { t } = await link('nobody@example.com');
  const got = await (await hit(`/mail/use?t=${t}&credId=made-up&token=made-up`)).json();
  ok('a junk proof still logs in, unattached', got.attached === false && !!got.token, got);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
