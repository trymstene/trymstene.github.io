// The news list — a SECOND rail, and the tests exist to keep it second.
// ⭐ The two properties worth protecting: nobody joins the list without clicking
// the confirmation, and a busy newsletter day can never starve the login rail.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
let mails = [], contacts = [];

function fakeR2() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { return m.has(k) ? { json: async () => JSON.parse(m.get(k)) } : null; },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(o = {}) {
      const keys = [...m.keys()].filter((k) => k.startsWith(o.prefix || ''));
      return { objects: keys.map((key) => ({ key })), truncated: false };
    },
  };
}
const env = {
  PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't',
  RESEND_KEY: 'k', MAIL_FROM: 'Banana World <hello@send.trymstene.com>',
  RESEND_AUDIENCE: 'aud_123',
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('/audiences/')) {
    contacts.push({ url: u, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'c1' }), { status: 200 });
  }
  if (u.includes('api.resend.com/emails')) {
    const b = JSON.parse(init.body);
    mails.push({ to: b.to[0], subject: b.subject, link: (b.text.match(/https?:\/\/\S+/) || [''])[0] });
    return new Response('{}', { status: 200 });
  }
  return realFetch(url, init);
};
const ctx = { waitUntil() {} };
const hit = (p, i = {}) => worker.fetch(new Request('https://w.dev' + p, {
  ...i, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(i.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) });
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');
const today = () => `mailday/${new Date().toISOString().slice(0, 10)}.json`;

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

console.log('\n1. ⭐ joining sends a confirmation and subscribes NOBODY');
{
  mails = []; contacts = [];
  const r = await post('/news/join', { email: 'fan@example.com' });
  ok('answers 200 ok', r.status === 200 && (await r.json()).ok === true);
  ok('a confirmation went out', mails.length === 1 && mails[0].to === 'fan@example.com', mails);
  ok('…with its own subject, not the login one', !/log in/i.test(mails[0].subject), mails[0].subject);
  ok('⭐ NO contact created yet — the click is the consent', contacts.length === 0, contacts);
  ok('the link lands on the pass page', /\/pass\/\?news=/.test(mails[0].link), mails[0].link);
}

console.log('\n2. the click is what subscribes');
{
  const t = new URL(mails[0].link).searchParams.get('news');
  const r = await hit('/news/confirm?t=' + t);
  ok('confirm succeeds', r.status === 200, await r.text());
  ok('now the contact exists', contacts.length === 1 && contacts[0].body.email === 'fan@example.com', contacts);
  ok('…and is subscribed, not silently opted out', contacts[0].body.unsubscribed === false, contacts[0].body);
  ok('it went to the configured audience', contacts[0].url.includes('aud_123'), contacts[0].url);
  const receipt = env.PASSES._m.get(`newsok/${await sha('fan@example.com')}.json`);
  ok('⚠️ a consent receipt was written (GDPR: show it, do not assert it)', !!receipt, receipt);
  ok('…keyed by hash, so the receipt is not a second copy of the list',
    !!receipt && !receipt.includes('fan@example.com'), receipt);
  const again = await hit('/news/confirm?t=' + t);
  ok('the link cannot be clicked twice', again.status === 404, again.status);
}

console.log('\n3. ⭐ a busy newsletter day never starves the login rail');
{
  mails = [];
  await env.PASSES.put(today(), JSON.stringify({ n: 60 }));   // at the news ceiling
  const news = await post('/news/join', { email: 'late@example.com' });
  ok('news is refused once it hits its ceiling', news.status === 429, news.status);
  ok('…and no mail was spent on it', mails.length === 0, mails);
  const login = await post('/mail/signin', { email: 'player@example.com' });
  ok('⭐ but a LOGIN link still goes out — 40 of the 100 are reserved',
    login.status === 200 && mails.length === 1, [login.status, mails.length]);
  await env.PASSES.put(today(), JSON.stringify({ n: 0 }));
}

console.log('\n4. the shape of the answers');
{
  mails = [];
  const bad = await post('/news/join', { email: 'not-an-email' });
  ok('a junk address is refused', bad.status === 400, bad.status);
  // ⚠️ an address ALREADY on the list must get the same answer as a new one,
  // or the endpoint becomes a way to ask "is this person a member?"
  const again = await post('/news/join', { email: 'fan@example.com' });
  ok('a known address answers exactly like an unknown one', again.status === 200 && (await again.json()).ok === true);
  const cooled = await post('/news/join', { email: 'fan@example.com' });
  ok('the per-address cooldown holds without leaking it', cooled.status === 200 && (await cooled.json()).ok === true);
  ok('…by not sending a second mail', mails.length <= 1, mails.length);
  const stale = await hit('/news/confirm?t=deadbeef');
  ok('an unknown confirmation is a plain 404', stale.status === 404, stale.status);
}

console.log('\n5. it fails closed when unconfigured');
{
  const bare = { ...env, RESEND_AUDIENCE: '' };
  const r = await worker.fetch(new Request('https://w.dev/news/join', {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'x@example.com' }),
  }), bare, ctx);
  ok('no audience configured → 503, never a silent pretend', r.status === 503, r.status);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
