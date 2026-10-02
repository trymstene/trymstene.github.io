// 🪪 PROTECTED NAMES, in-process against a fake R2 (2 Oct 2026; src/lib/name-guard.js).
//
// Trym, after a stranger walked past his homestead as "Trym Stene": "add protection on my name, its a bit silly if players
// thats using my name is sent letters and stuff". What must hold:
//   · the owner's pass (NAME_OWNERS) keeps its protected name, and its every answer carries a NAME TOKEN for its world id
//   · any other pass that pushes one is left nameless, with a NEWER clock, so its devices take the change
//   · lookalikes count ("Tryrn 5tene"); plain "Trym" does not
//   · a pass that already held one before this shipped is cleared the first time it pulls
//   · the arcade signs a stranger's score "a banana", and a board shows no protected name it was not given by its owner
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
let sent = [];
function fakeR2() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : JSON.stringify(v)); },
    async delete(k) { m.delete(k); },
    async list(opts = {}) { const p = opts.prefix || ''; return { objects: [...m.keys()].filter((k) => k.startsWith(p)).map((key) => ({ key })), truncated: false }; },
  };
}
const sha = async (str) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))]
  .map((b) => b.toString(16).padStart(2, '0')).join('');
const OWNER_HOME = 'm' + (await sha('owner@example.com'));
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 'test-stamp', MEMBER_HMAC: 'test-member', RESEND_KEY: 'test-key', MAIL_FROM: 'b@send.trymstene.com', NAME_OWNERS: ' ' + OWNER_HOME + ' ,' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) {
    const body = JSON.parse(init.body);
    sent.push({ link: (body.text.match(/https?:\/\/\S+/) || [''])[0] });
    return new Response(JSON.stringify({ id: 'fake' }), { status: 200 });
  }
  return realFetch(url, init);
};
const ctx = { waitUntil() {}, passThroughOnException() {} };
const hit = (path, init = {}) => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(init.headers || {}) },
}), env, ctx);
const post = (p, b) => hit(p, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); }
};
async function kept(email) {
  sent = [];
  await env.PASSES.delete(`mailcd/${await sha(email)}.json`);
  await post('/mail/signin', { email });
  const t = new URL(sent[0].link).searchParams.get('in');
  return (await (await hit('/mail/use?t=' + t)).json());
}
const blob = (name, nameAt) => ({ pass: { created: Date.now() - 86400000, patches: {}, base: {}, led: {} }, name, nameAt });
const pull = (p) => hit('/pull?credId=' + encodeURIComponent(p.credId) + '&token=' + encodeURIComponent(p.token)).then((r) => r.json());
const NT = /^[a-f0-9]{16}\.\d+\.[a-f0-9]{64}$/;

console.log('\n1. the owner keeps the name, and carries the token that says so');
const owner = await kept('owner@example.com');
let a = await post('/push', { credId: owner.credId, token: owner.token, blob: blob('Trym Stene', 1000) });
ok('the owner’s push is answered with a name token for its world id', a.ok === true && NT.test(a.nameToken || '') && a.nameToken.startsWith(a.gid + '.'), { nt: a.nameToken, gid: a.gid });
let pl = await pull(owner);
ok('…and the name stays', pl.blob.name === 'Trym Stene' && NT.test(pl.nameToken || ''), pl.blob.name);

console.log('\n2. anybody else is left nameless, and their devices follow');
const stranger = await kept('stranger@example.com');
const T0 = Date.now();
a = await post('/push', { credId: stranger.credId, token: stranger.token, blob: blob('Trym Stene', T0) });
ok('a stranger’s push gets no name token', a.ok === true && !a.nameToken, a);
pl = await pull(stranger);
ok('⭐ the stranger’s pass is nameless, on a NEWER clock than the device’s', pl.blob.name === '' && pl.blob.nameAt >= T0, { name: pl.blob.name, nameAt: pl.blob.nameAt });
await post('/push', { credId: stranger.credId, token: stranger.token, blob: blob('Tryrn 5tene', Date.now() + 5) });
pl = await pull(stranger);
ok('a lookalike is the same name', pl.blob.name === '', pl.blob.name);
await post('/push', { credId: stranger.credId, token: stranger.token, blob: blob('Real Trym Stene', Date.now() + 10) });
pl = await pull(stranger);
ok('…and so is one with the name inside it', pl.blob.name === '', pl.blob.name);
await post('/push', { credId: stranger.credId, token: stranger.token, blob: blob('Trym', Date.now() + 15) });
pl = await pull(stranger);
ok('plain “Trym” is anybody’s (a Norwegian first name)', pl.blob.name === 'Trym', pl.blob.name);

console.log('\n3. a pass that already held the name before this shipped');
const early = await kept('early@example.com');
await post('/push', { credId: early.credId, token: early.token, blob: blob('Pip', 1) });
const ek = 'pass/m' + (await sha('early@example.com')) + '.json';
const rec = JSON.parse(env.PASSES._m.get(ek));
rec.blob.name = 'DJ Sentry'; rec.blob.nameAt = 5;   // as if it were stored before the guard existed
env.PASSES._m.set(ek, JSON.stringify(rec));
pl = await pull(early);
ok('⭐ its first pull clears it', pl.blob.name === '', pl.blob.name);
ok('…and the clear is saved, not only answered', JSON.parse(env.PASSES._m.get(ek)).blob.name === '', JSON.parse(env.PASSES._m.get(ek)).blob.name);

console.log('\n4. the arcade');
const now = Date.now();
await post('/arcade/score', { credId: owner.credId, token: owner.token, game: 'peelout', score: 10, dur: 20000 });
await post('/push', { credId: stranger.credId, token: stranger.token, blob: blob('Trym Stene', Date.now() + 20) });
await post('/arcade/score', { credId: stranger.credId, token: stranger.token, game: 'peelout', score: 12, dur: 20000 });
// an entry stored before the guard, under the stranger's key
const ak = 'arcade/peelout.json';
const arc = JSON.parse(env.PASSES._m.get(ak));
const sk = Object.keys(arc.best).find((k) => k !== OWNER_HOME);
arc.best[sk].n = 'Trym Stene';
env.PASSES._m.set(ak, JSON.stringify(arc));
const board = await (await hit('/arcade/board?game=peelout')).json();
const names = (board.top || []).map((r) => r.n);
ok('⭐ the board shows the owner’s name and never the stranger’s copy of it', names.includes('Trym Stene') && names.filter((n) => n === 'Trym Stene').length === 1 && names.includes('a banana'), names);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
void now;
