// 🧪 THE QA LOGIN DOOR — the two-device proof's way in, in-process against a
// fake R2. A ticket under QA_KEY opens the same door an inbox link does; the
// home it opens is stamped and invisible to the rollup and the desk; erase
// deletes only stamped records; a player's pass is never touchable through it.
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
function fakeR2() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(opts = {}) {
      const p = opts.prefix || '';
      return { objects: [...m.keys()].filter((k) => k.startsWith(p)).sort().map((key) => ({ key })), truncated: false };
    },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', PASS_ADMIN_KEY: 'desk-key', QA_KEY: 'qa-key ' };   // a trailing space, like a pasted secret
const ctx = { waitUntil() {}, passThroughOnException() {} };
let ipN = 0;
const hit = (path, init = {}, e = env) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.' + (++ipN % 200), ...(init.headers || {}) },
}), e, ctx);
const post = (p, b, e) => hit(p, { method: 'POST', body: JSON.stringify(b) }, e);
const J = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};
const recs = () => [...env.PASSES._m.entries()].filter(([k]) => k.startsWith('pass/')).map(([k, v]) => [k, JSON.parse(v)]);

console.log('A. the door is shut without the key');
let r = await J(await post('/qa/ticket', { who: 'proof-1' }));
ok('no key → 404 (deny as nothing)', r.status === 404, r);
r = await J(await post('/qa/ticket', { key: 'wrong', who: 'proof-1' }));
ok('wrong key → 404', r.status === 404, r);
r = await J(await post('/qa/ticket', { key: 'qa-key', who: 'proof-1' }, { ...env, QA_KEY: '' }));
ok('QA_KEY unset → 404, whatever is sent', r.status === 404, r);
r = await J(await post('/qa/ticket', { key: 'qa-key', who: 'Not An Id!' }));
ok('a who outside [a-z0-9-] → 400', r.status === 400, r);
r = await J(await post('/qa/ticket', { key: 'qa-key', who: 'proof-1' }));
ok('the right key (trimmed) mints a ticket', r.ok === true && /^[a-f0-9]{64}$/.test(r.t || ''), r);
const t1 = r.t;

console.log('B. phone A: an anonymous pass, then the QA ticket ATTACHES to it');
const a = await J(await post('/anon', { blob: { name: 'Proofy', nameAt: 5, shelf: [] } }));
ok('phone A minted an anonymous pass', a.credId && a.credId.startsWith('a:') && /^[a-f0-9]{16}$/.test(a.gid), a);
r = await J(await hit(`/mail/use?t=${t1}&credId=${encodeURIComponent(a.credId)}&token=${a.token}`));
ok('the ticket opens like an inbox link: attached, same gid', r.status === 200 && r.attached === true && r.gid === a.gid, r);
const credA = r.credId, tokA = r.token;
ok('the mail credential is in the mail namespace', typeof credA === 'string' && credA.startsWith('m:'), credA);
let home = recs().find(([, v]) => !v.link && v.anon);
ok('the home (phone A\'s anon record) is stamped qa', !!home && home[1].qa === 1, home && home[1]);
let ptr = recs().find(([, v]) => v.link && v.mail);
ok('the mail pointer is stamped qa too', !!ptr && ptr[1].qa === 1, ptr && ptr[1]);
r = await J(await hit(`/mail/use?t=${t1}`));
ok('a ticket is single use', r.status === 404, r);

console.log('C. phone B: a second ticket for the same who logs into the SAME home');
r = await J(await post('/qa/ticket', { key: 'qa-key', who: 'proof-1' }));
const t2 = r.t;
r = await J(await hit(`/mail/use?t=${t2}`));
ok('B logs in (no attach) with A\'s world id', r.status === 200 && r.attached === false && r.gid === a.gid, r);
ok('…and A\'s blob comes down (the name)', r.blob && r.blob.name === 'Proofy', r.blob && r.blob.name);
const credB = r.credId, tokB = r.token;
r = await J(await hit(`/pull?credId=${encodeURIComponent(credB)}&token=${tokB}`));
ok('B pulls with its own token', r.status === 200 && r.gid === a.gid, r.status);

console.log('D. the rollup and the desk never count the proof');
const plain = await J(await post('/anon', { blob: { name: 'Real Player', nameAt: 5 } }));
ok('a real anonymous player exists beside it', plain.credId && plain.credId.startsWith('a:'));
r = await J(await hit('/admin/rollup/tick?key=desk-key'));
let guard = 0;
while (!r.done && guard++ < 20) r = await J(await hit('/admin/rollup/tick?key=desk-key'));
r = await J(await hit('/admin/rollup?key=desk-key&days=2'));
const today = new Date().toISOString().slice(0, 10);
const d = (r.days || []).find((x) => x.day === today);
ok('the day counts ONE pass (the real one), not the proof\'s home', !!d && d.passes === 1 && d.anon === 1, d && { passes: d.passes, anon: d.anon, mailCreds: d.mailCreds, named: d.named });
ok('…and no mail credential for the proof', !!d && d.mailCreds === 0, d && d.mailCreds);
r = await J(await hit('/admin/ledger?key=desk-key'));
ok('the desk lists one pass, the real one', r.passes && r.passes.length === 1 && r.passes[0].name === 'Real Player', r.passes && r.passes.map((p) => p.name));

console.log('E. erase');
r = await J(await post('/qa/erase', { credId: plain.credId, token: plain.token }));
ok('a real player\'s own credential cannot erase through the QA door', r.status === 403 && r.error === 'not a qa pass', r);
r = await J(await post('/qa/erase', { who: 'proof-1' }));
ok('erase by who needs the key', r.status === 404, r);
r = await J(await post('/qa/erase', { key: 'qa-key', who: 'proof-1' }));
ok('erase by key + who removes the pointer and the home', r.ok === true && r.gone === 2, r);
r = await J(await hit(`/pull?credId=${encodeURIComponent(credA)}&token=${tokA}`));
ok('phone A\'s mail credential no longer opens anything', r.status === 403, r.status);
r = await J(await hit(`/pull?credId=${encodeURIComponent(a.credId)}&token=${a.token}`));
ok('phone A\'s anon credential is gone too (it WAS the home)', r.status === 403, r.status);
r = await J(await post('/qa/erase', { key: 'qa-key', who: 'proof-1' }));
ok('a second erase is a quiet no-op', r.ok === true && r.gone === 0, r);
r = await J(await hit(`/pull?credId=${encodeURIComponent(plain.credId)}&token=${plain.token}`));
ok('the real player is untouched', r.status === 200, r.status);
ok('only the real player\'s record remains', recs().length === 1 && recs()[0][1].blob.name === 'Real Player', recs().map(([k]) => k));

console.log('F. erase by the person\'s own credential (a fresh who, B\'s token)');
r = await J(await post('/qa/ticket', { key: 'qa-key', who: 'proof-2' }));
r = await J(await hit(`/mail/use?t=${r.t}`));
ok('a brand-new QA person (no device pass) is a stamped primary', r.status === 200 && recs().some(([, v]) => v.qa === 1 && v.mail && !v.link), recs().map(([, v]) => v));
r = await J(await post('/qa/erase', { credId: r.credId, token: r.token }));
ok('…and erases itself by its own token', r.ok === true && r.gone === 1, r);
ok('nothing of it remains', recs().length === 1, recs().map(([k]) => k));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
