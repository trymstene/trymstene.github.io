// 🍌📌 A PASS AND A DISCORD ACCOUNT (1 Oct 2026), in-process against a fake R2 that speaks etags.
//
// What has to hold:
//   · only BananaBOT can mint a code or read a card — those routes answer on the `internal` host alone
//   · a code is redeemed by the browser that holds the pass (credId + token), once, within fifteen minutes
//   · the card is public facts only: a name, a level and its title, days, badges, things made, the homestead's tag
//   · one pass per Discord account and one Discord account per pass; unlinking from either side clears both
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
function fakeR2() {
  const m = new Map();
  let ver = 0;
  return {
    _m: m,
    async get(k) { if (!m.has(k)) return null; const { v, etag } = m.get(k); return { etag, json: async () => JSON.parse(v), text: async () => v }; },
    async put(k, v, opts) {
      const cur = m.get(k), want = opts && opts.onlyIf && opts.onlyIf.etagMatches;
      if (want !== undefined && (!cur || cur.etag !== want)) return null;
      const etag = 'e' + (++ver);
      m.set(k, { v: typeof v === 'string' ? v : JSON.stringify(v), etag });
      return { etag };
    },
    async delete(k) { m.delete(k); },
    async list(opts = {}) { const p = opts.prefix || ''; return { objects: [...m.keys()].filter((k) => k.startsWith(p)).sort().map((key) => ({ key })), truncated: false }; },
  };
}
const env = { PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 't', MEMBER_HMAC: 'h', RULES_STRICT: '0' };
const ctx = { waitUntil() {}, passThroughOnException() {} };
let ipN = 0;
const hit = (path, init = {}, host = 'https://w.dev') => worker.fetch(new Request(host + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.4.' + (++ipN % 250), ...(init.headers || {}) },
}), env, ctx);
const post = (p, b, host) => hit(p, { method: 'POST', body: JSON.stringify(b) }, host);
const J = async (r) => ({ status: r.status, ...(await r.json().catch(() => ({}))) });
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); }
};
let CLOCK = Date.UTC(2026, 9, 1, 12, 0, 0);
Date.now = () => CLOCK;
const BOT = 'https://internal';

async function anon(name) {
  const a = await J(await post('/anon', {}));
  const blob = { name, pass: { created: CLOCK - 5 * 86400000, patches: { first: CLOCK }, base: { rep: 900 }, led: {}, days: ['2026-09-29', '2026-09-30', '2026-10-01'] }, shelf: [{ id: 's1' }], ev: [], evDrop: 0, evDev: 'devd0001' };
  await J(await post('/push', { credId: a.credId, token: a.token, blob }));
  return a;
}

console.log('\n🍌📌  a pass and a Discord account');
const kiwi = await anon('Kiwi');
let r = await J(await post('/discord/code', { uid: '111', name: 'kiwi_on_discord' }));
ok('⭐ a code is never minted off the internet', r.status !== 200 || !r.code, r);
r = await J(await hit('/discord/me?uid=111'));
ok('⭐ …nor a card read', r.status !== 200 || r.linked === undefined, r);
r = await J(await post('/discord/code', { uid: '111', name: 'kiwi_on_discord' }, BOT));
ok('BananaBOT mints a one-time code', r.status === 200 && /^[A-Z2-9]{6}$/.test(r.code), r);
const code = r.code;
r = await J(await post('/discord/peek', { code }));
ok('the pass page can see whose Discord it is before the tap', r.name === 'kiwi_on_discord', r);
r = await J(await post('/discord/link', { credId: kiwi.credId, token: 'nope', code }));
ok('⭐ nobody links a pass they cannot prove', r.status === 403, r);
r = await J(await post('/discord/link', { credId: kiwi.credId, token: kiwi.token, code }));
ok('the pass links itself', r.status === 200 && r.ok && r.name === 'kiwi_on_discord', r);
r = await J(await post('/discord/link', { credId: kiwi.credId, token: kiwi.token, code }));
ok('⭐ a code works once', r.status === 404 && r.error === 'gone', r);
r = await J(await hit('/discord/me?uid=111', {}, BOT));
const card = r.card || {};
ok('BananaBOT reads the card', r.linked === true && card.name === 'Kiwi' && card.level >= 1 && typeof card.title === 'string' && card.days === 3 && card.badges === 1 && card.made === 1 && /^[0-9a-f]{8}$/.test(card.tag), r);
ok('⭐ …and only public facts: no coins, no ids, no email', !/coin|cred|token|mail|wallet/i.test(Object.keys(card).join(',')), Object.keys(card));
r = await J(await post('/discord/status', { credId: kiwi.credId, token: kiwi.token }));
ok('the pass page knows it is linked, and to whom', r.linked === true && r.name === 'kiwi_on_discord', r);

// one Discord account per pass: the same account links a second pass, and the first lets go
const be = await anon('Be');
const c2 = (await J(await post('/discord/code', { uid: '111', name: 'kiwi_on_discord' }, BOT))).code;
await J(await post('/discord/link', { credId: be.credId, token: be.token, code: c2 }));
r = await J(await hit('/discord/me?uid=111', {}, BOT));
ok('linking a second pass moves the Discord account to it', r.card && r.card.name === 'Be', r);
r = await J(await post('/discord/status', { credId: kiwi.credId, token: kiwi.token }));
ok('⭐ …and the first pass is no longer linked', r.linked === false, r);

// a code goes stale
const c3 = (await J(await post('/discord/code', { uid: '222', name: 'late' }, BOT))).code;
CLOCK += 16 * 60000;
r = await J(await post('/discord/link', { credId: kiwi.credId, token: kiwi.token, code: c3 }));
ok('a code fifteen minutes old is gone', r.status === 404, r);

// unlinking, from either side
r = await J(await post('/discord/unlink', { uid: '111' }, BOT));
ok('/unlink from Discord lets go', r.ok && r.was === true, r);
r = await J(await post('/discord/status', { credId: be.credId, token: be.token }));
ok('…and the pass hears it', r.linked === false, r);
const c4 = (await J(await post('/discord/code', { uid: '333', name: 'gran' }, BOT))).code;
await J(await post('/discord/link', { credId: be.credId, token: be.token, code: c4 }));
r = await J(await post('/discord/forget', { credId: be.credId, token: be.token }));
ok('the pass page can unlink too', r.ok, r);
r = await J(await hit('/discord/me?uid=333', {}, BOT));
ok('…and the bot hears it', r.linked === false, r);
ok('no stray links are left behind', ![...env.PASSES._m.keys()].some((k) => k.startsWith('discord/uid/')), [...env.PASSES._m.keys()].filter((k) => k.startsWith('discord/')));

console.log('\n' + pass + ' pass, ' + fail + ' fail\n');
process.exit(fail ? 1 : 0);
