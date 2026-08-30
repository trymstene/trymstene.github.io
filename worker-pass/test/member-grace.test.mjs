// ⏳ THE 72-HOUR GRACE, END TO END.
//
// A member's hat is allowed for `until + 72h` — the cushion that stops renewal
// or webhook lag stripping somebody who has paid. The client honoured it and
// the two workers did not, so for those 72 hours the wearer saw their own hat
// and nobody else in the rave did: worker-pass refused to mint a token, and
// worker-rave would have refused it anyway.
//
// This suite pins BOTH ends against the same grant, because the bug was not in
// either one of them — it was in the disagreement.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
const HMAC = 'member-hmac-test';
const GRACE = 72 * 3600 * 1000;

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
    async list() { return { objects: [], truncated: false }; },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: HMAC };

const te = new TextEncoder();
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const CRED = 'cred-grace', TOKEN = 'tok-grace';
async function seed(until) {
  const key = await sha(CRED);
  await env.PASSES.put(`pass/${key}.json`, JSON.stringify({
    pk: 'x', alg: -7, tokens: { [await sha(TOKEN)]: { t: Date.now() } },
    blob: { member: { t: 'sup-t2', until } },
  }));
}
// what worker-pass hands the browser
async function mintedToken() {
  const res = await worker.fetch(new Request(
    `https://x/pull?credId=${CRED}&token=${TOKEN}`, { headers: { Origin: ORIGIN } }), env);
  return (await res.json()).memberToken;
}
// …and what worker-rave makes of it. Kept byte-identical to
// worker-rave/src/index.js memberRankOf — if this copy and that one ever
// disagree, the hat disappears for everyone except its owner.
const RAVE_RANK = { 'sup-t1': 1, 'sup-t2': 2, 'sup-t3': 3 };
async function raveRankOf(mt) {
  try {
    if (!mt) return 0;
    const [t, until, sig] = String(mt).split('.');
    if (!RAVE_RANK[t] || !(+until + GRACE > Date.now()) || !sig) return 0;
    const key = await crypto.subtle.importKey('raw', te.encode(HMAC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const buf = await crypto.subtle.sign('HMAC', key, te.encode(t + '.' + (+until)));
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === sig ? RAVE_RANK[t] : 0;
  } catch (e) { return 0; }
}

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ok  ', label); }
  else { fail++; console.log('  FAIL', label, extra !== undefined ? JSON.stringify(extra) : ''); }
};

// 1. a paid-up member: token minted, rave admits it
{
  await seed(Date.now() + 20 * 86400000);
  const mt = await mintedToken();
  ok(!!mt, 'a live membership mints a token', mt);
  ok(await raveRankOf(mt) === 2, 'and the rave admits it at the right rank');
}

// 2. ⚠️ THE BUG: one hour past `until`, deep inside the grace the client
// honours. Both ends must still say yes, or the hat is visible to its owner
// and invisible to the room.
{
  await seed(Date.now() - 3600 * 1000);
  const mt = await mintedToken();
  ok(!!mt, 'an hour past renewal STILL mints — the client shows the hat, so the room must see it', mt);
  ok(await raveRankOf(mt) === 2, 'and the rave still admits it');
}

// 3. the far edge of the grace, either side of it
{
  await seed(Date.now() - (GRACE - 2 * 3600 * 1000));   // 2h of grace left
  const near = await mintedToken();
  ok(!!near && await raveRankOf(near) === 2, 'two hours of grace left: still worn');

  await seed(Date.now() - (GRACE + 3600 * 1000));       // an hour past it
  const gone = await mintedToken();
  ok(!gone, 'past the grace, no token is minted at all', gone);
  ok(await raveRankOf(gone) === 0, 'and the rave admits nothing');
}

// 4. the grace is not a way in — it extends a real grant, it never invents one
{
  const forged = 'sup-t3.' + (Date.now() + 86400000) + '.' + 'f'.repeat(64);
  ok(await raveRankOf(forged) === 0, 'a forged signature is refused inside the window too');
  await seed(Date.now() - 3600 * 1000);
  // ⚠️ a regression here means NO token at all — say so, do not throw a stack
  // trace at whoever is reading the failure
  const mt = (await mintedToken()) || '';
  ok(!!mt, 'a token exists to tamper with (if this fails, the grace is broken above)');
  const [t, until, sig] = mt.split('.');
  ok(await raveRankOf('sup-t3.' + until + '.' + sig) === 0,
    'a real signature cannot be re-pointed at a higher tier');
  ok(await raveRankOf(t + '.' + (+until + 40 * 86400000) + '.' + sig) === 0,
    'nor at a later date — the date is inside what was signed');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
