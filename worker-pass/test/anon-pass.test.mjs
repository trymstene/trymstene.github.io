// 🫧 THE ANONYMOUS PASS + 🪪 THE WORLD TOKEN, in-process against a fake R2:
// /anon mints a home with a gid and a signed token; a passkey made on that
// device JOINS the home (same gid); a known email logging in on that device
// FOLDS the anonymous world in (blob merged, old gid kept as an alias in the
// token); a new email ATTACHES; no MEMBER_HMAC = no token (soft mode).
import worker from '../src/index.js';

const ORIGIN = 'https://trymstene.com';
const HMAC = 'test-member-hmac';

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
  PASSES: fakeR2(), ALLOWED_ORIGIN: ORIGIN, PASS_HMAC: 'test-stamp', MEMBER_HMAC: HMAC,
  RESEND_KEY: 'test-key', MAIL_FROM: 'banana@send.trymstene.com',
};
let sent = [];
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
const hit = (path, init = {}, ip = '1.2.3.4') => worker.fetch(new Request('https://w.dev' + path, {
  ...init, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...(init.headers || {}) },
}), env, ctx);
const post = (p, b, ip) => hit(p, { method: 'POST', body: JSON.stringify(b) }, ip);
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', te.encode(s)));
const b64u = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', te.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, te.encode(msg)));
}
const WT_RE = /^([a-f0-9]{16})\.(\d+)\.([a-f0-9,]*)\.([a-f0-9]{64})$/;
async function tokenOk(wt) {
  const m = WT_RE.exec(wt || '');
  if (!m) return null;
  const sig = await hmac(HMAC, 'wt:' + m[1] + '.' + m[2] + '.' + m[3]);
  return sig === m[4] && +m[2] > Date.now() ? { gid: m[1], aliases: m[3] ? m[3].split(',') : [] } : null;
}
async function mailLink(email) {
  sent = [];
  await env.PASSES.delete(`mailcd/${await sha(email)}.json`);
  const r = await post('/mail/signin', { email });
  if (!sent.length) return null;
  return new URL(sent[0].link).searchParams.get('in');
}
async function forgedCreate() {
  const c = await (await post('/challenge', {})).json();
  return b64u(JSON.stringify({ type: 'webauthn.create', challenge: b64u(JSON.stringify(c)), origin: ORIGIN }));
}

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra === undefined ? '' : JSON.stringify(extra)); }
};

// ---- A. /anon mints a home, a gid and a proof ----
console.log('A. /anon');
const a = await (await post('/anon', { blob: { shelf: [{ params: 'x=1', kind: 'banana', created: 1 }] } })).json();
ok('credId in the anon namespace', typeof a.credId === 'string' && a.credId.startsWith('a:'), a);
ok('a device token', typeof a.token === 'string' && a.token.length === 48);
ok('a 16-hex gid', /^[a-f0-9]{16}$/.test(a.gid || ''), a.gid);
const at = await tokenOk(a.worldToken);
ok('the world token verifies and names the gid', !!at && at.gid === a.gid, a.worldToken);
ok('…with no aliases yet', !!at && at.aliases.length === 0);

// ---- B. the anon credential syncs like any other ----
console.log('B. pull/push');
const pl = await (await hit(`/pull?credId=${encodeURIComponent(a.credId)}&token=${a.token}`)).json();
ok('pull answers with the same gid', pl.gid === a.gid, pl);
ok('…the blob it was minted with', !!pl.blob && Array.isArray(pl.blob.shelf) && pl.blob.shelf[0].params === 'x=1');
ok('…and a fresh token', !!(await tokenOk(pl.worldToken)));
const ps = await (await post('/push', { credId: a.credId, token: a.token, blob: { shelf: [{ params: 'y=2', kind: 'banana', created: 2 }] } })).json();
ok('push merges and answers with gid + token', ps.ok === true && ps.gid === a.gid && !!(await tokenOk(ps.worldToken)), ps);

// ---- C. a passkey made on the anonymous device JOINS the home ----
console.log('C. register joins');
const reg = await (await post('/register', {
  credId: 'pk-anon-device', pk: 'AAAA', alg: -7, clientDataJSON: await forgedCreate(), blob: {},
  fromCredId: a.credId, fromToken: a.token,
})).json();
ok('register reports the join', reg.joined === true && typeof reg.token === 'string', reg);
const pk = await (await hit(`/pull?credId=pk-anon-device&token=${reg.token}`)).json();
ok('the passkey resolves to the SAME gid (a pointer, not a second pass)', pk.gid === a.gid, pk.gid);
ok('…and sees the anon world', !!pk.blob && pk.blob.shelf.some((s) => s.params === 'y=2'));

// ---- D. a KNOWN email logging in on an anonymous device folds it in ----
console.log('D. fold on login');
const t1 = await mailLink('kiwi@example.com');
const first = await (await hit('/mail/use?t=' + t1)).json();            // a brand-new email pass
ok('the email pass exists on its own gid', /^[a-f0-9]{16}$/.test(first.gid || '') && first.gid !== a.gid, first);
const b = await (await post('/anon', { blob: { shelf: [{ params: 'anon=1', kind: 'banana', created: 3 }] } }, '5.5.5.5')).json();
// the anon pass plays: earns 40, buys a snail hat (authored), forges a squid hat claim; the real pass has a frozen wallet of 500
const DEVX = 'devfold1';
const bl = (led, events) => ({ pass: { created: 1, patches: {}, base: {}, stats: {}, led: Object.fromEntries(Object.entries(led).map(([k, v]) => [k, { [DEVX]: v }])), days: [] }, ev: events, evDrop: 0, evDev: DEVX });
await post('/push', { credId: b.credId, token: b.token, blob: bl({ coins_earned: 40 }, [{ id: 'f01d0001', t: Date.now(), k: 'coins_earned', d: 40, a: 'park', s: 'egg' }]) });
await post('/push', { credId: b.credId, token: b.token, blob: bl({ coins_earned: 40, coins_spent: 15, own_snailhat: 1, own_squidhat: 1 }, [{ id: 'f01d0002', t: Date.now(), k: 'coins_spent', d: 15, a: 'park', s: 'stand', i: 'snailhat' }]) });
{ // the real pass: a frozen wallet of 500 (set directly — the floor is history)
  const hk = 'pass/m' + (await sha('kiwi@example.com')) + '.json';
  const st = JSON.parse(env.PASSES._m.get(hk)); st.wallet = { base: 500, earned: 0, spent: 0, refunded: 0, seq: 1, refused: 0, frozenAt: 1 }; env.PASSES._m.set(hk, JSON.stringify(st));
}
const t2 = await mailLink('kiwi@example.com');
const fold = await (await hit('/mail/use?t=' + t2 + '&credId=' + encodeURIComponent(b.credId) + '&token=' + b.token)).json();
ok('the login says it folded', fold.folded === true && fold.attached === false, fold);
ok('…onto the EMAIL gid, not the anon one', fold.gid === first.gid, [fold.gid, first.gid]);
ok('…with the anon world merged in', !!fold.blob && fold.blob.shelf.some((s) => s.params === 'anon=1'));
const ft = await tokenOk(fold.worldToken);
ok('…and the old gid rides the token as an alias', !!ft && ft.aliases.includes(b.gid), ft);
const viaOld = await (await hit(`/pull?credId=${encodeURIComponent(b.credId)}&token=${b.token}`)).json();
ok('the old anon credential now resolves to the email pass', viaOld.gid === first.gid, viaOld.gid);
ok('the fold carried the anon pass\'s earned coins (500 + 40 − 15)', fold.wallet && fold.wallet.bal === 525, fold.wallet);
ok('…and the bought snail hat, but not the forged squid hat', Array.isArray(fold.own) && fold.own.includes('snailhat') && !fold.own.includes('squidhat'), fold.own);

// ---- E. a NEW email on an anonymous device attaches (gid unchanged) ----
console.log('E. attach');
const c = await (await post('/anon', {}, '6.6.6.6')).json();
const t3 = await mailLink('jade@example.com');
const att = await (await hit('/mail/use?t=' + t3 + '&credId=' + encodeURIComponent(c.credId) + '&token=' + c.token)).json();
ok('a first-time address attaches to the anon home', att.attached === true && att.folded === false, att);
ok('…and the gid is the anon one (nothing moved)', att.gid === c.gid, [att.gid, c.gid]);

// ---- F. no secret = no token, everything else still works ----
console.log('F. soft mode');
const env2 = { ...env, MEMBER_HMAC: undefined, PASSES: fakeR2() };
const soft = await (await worker.fetch(new Request('https://w.dev/anon', { method: 'POST', body: '{}',
  headers: { Origin: ORIGIN, 'Content-Type': 'application/json' } }), env2, ctx)).json();
ok('anon still mints a gid without MEMBER_HMAC', /^[a-f0-9]{16}$/.test(soft.gid || ''), soft);
ok('…but no world token', soft.worldToken === undefined);

// ---- G. the mint is throttled per IP ----
console.log('G. throttle');
let last = 200;
for (let i = 0; i < 14 && last !== 429; i++) last = (await post('/anon', {}, '9.9.9.9')).status;
ok('a 13th mint in an hour from one IP is refused', last === 429, last);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
