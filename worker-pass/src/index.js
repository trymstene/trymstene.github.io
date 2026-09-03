// Banana pass sync — the cross-device backbone of the Banana Pass.
//
// The model: a PASSKEY is the identity (no email, no password, no PII — the
// platform syncs it between the user's devices and biometrics gate its use).
// Biometrics appear only when LINKING a device (register/assert); day-to-day
// sync rides a per-device bearer token minted at link time.
//
//   POST /challenge   → { c, t, s }  stateless freshness stamp (HMAC)
//   POST /register    body { credId, pk, alg, clientDataJSON, blob }
//                     → verifies the challenge stamp + origin, stores the
//                       SPKI public key (browser's getPublicKey(), no CBOR),
//                       mints a device token → { token }
//   POST /assert      body { credId, clientDataJSON, authenticatorData,
//                       signature, blob? }
//                     → verifies the WebAuthn assertion signature against the
//                       stored key, mints a token, merges any pushed blob
//                       → { token, blob }
//   POST /push        body { credId, token, blob }   token-auth sync up
//   GET  /pull?credId=&token=                        token-auth sync down
//
// Records: R2 pass/<sha256(credId)>.json =
//   { pk, alg, tokens: { sha256(token): ts }, blob, updated }
// Blobs merge by UNION (patches/days/shelf) and MAX (stats) so two devices
// never clobber each other. Blob cap 256 KB. Cost guardrails as everywhere:
// Origin allowlist, per-IP throttle, free plan fails closed.

// ⭐ THE WORLD'S OWN LEVEL CURVE, not a lookalike — the ledger has to print the
// level the PLAYER sees, and a second formula here drifts silently every time
// the real one is retuned. Bundled by esbuild the way worker/ pulls in
// shared/products.js; pass-defs is pure data + pure functions, no DOM.
import { levelFor } from '../../src/lib/pass-defs.js';

const MAX_BLOB = 256 * 1024;
const MAX_TOKENS = 10;
const CHALLENGE_TTL = 5 * 60 * 1000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env, request) });
      if (url.pathname === '/challenge') return challenge(request, env);
      if (url.pathname === '/register') return register(request, env);
      if (url.pathname === '/assert') return assert_(request, env);
      if (url.pathname === '/mail/signin') return mailSignin(request, env);
      if (url.pathname === '/mail/use') return mailUse(request, env, url);
      if (url.pathname === '/news/join') return newsJoin(request, env);
      if (url.pathname === '/news/confirm') return newsConfirm(request, env, url);
      if (url.pathname === '/link/start') return linkStart(request, env);
      if (url.pathname === '/link/finish') return linkFinish(request, env);
      if (url.pathname === '/push') return push(request, env);
      if (url.pathname === '/pull') return pull(request, env, url);
      if (url.pathname === '/anon') return anon(request, env);
      if (url.pathname === '/admin/ledger') return adminLedger(request, env, url);
      if (url.pathname === '/admin/find') return adminFind(request, env);
      if (url.pathname === '/admin/grant') return adminGrant(request, env);
      if (url.pathname === '/admin/erase') return adminErase(request, env);
      if (url.pathname === '/admin/log') return adminLog(request, env, url);
      if (url.pathname === '/kofi-hook') return kofiHook(request, env);
      if (url.pathname === '/polar-hook') return polarHook(request, env);
      if (url.pathname === '/pay/checkout') return payCheckout(request, env, url);
      if (url.pathname === '/pay/tip') return payTip(request, env, url);
      if (url.pathname === '/pay/manage') return payManage(request, env);
      if (url.pathname === '/supporters') return supporters(request, env);
      if (url.pathname === '/health') return json({ ok: true });
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'internal error' }, 500);
    }
  },
};

// ---------- plumbing ----------
function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}
function cors(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
function originOk(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  return allowed.includes(request.headers.get('Origin') || '');
}
const ipHits = new Map();
function throttled(ip) {
  const now = Date.now();
  const rec = ipHits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  ipHits.set(ip, rec);
  if (ipHits.size > 5000) ipHits.clear();
  return rec.n > 30;
}
function guard(env, request) {
  if (!originOk(env, request)) return json({ error: 'forbidden' }, 403);
  if (throttled(request.headers.get('CF-Connecting-IP') || 'unknown')) {
    return json({ error: 'slow down' }, 429, cors(env, request));
  }
  return null;
}

const te = new TextEncoder();
const b64uToBuf = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const bufToHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(s) { return bufToHex(await crypto.subtle.digest('SHA-256', te.encode(s))); }

async function hmacHex(env, msg) {
  const key = await crypto.subtle.importKey('raw', te.encode(env.PASS_HMAC || 'dev'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bufToHex(await crypto.subtle.sign('HMAC', key, te.encode(msg)));
}

// 🎩 the MEMBER TOKEN — `tier.until.hmac`, signed with MEMBER_HMAC (the secret
// SHARED with worker-rave, which verifies it to let member hats through room
// sanitize). Minted on pull/push/mail-use whenever the home blob holds a live
// grant; expires with the grant, so revocation needs no recall. Deliberately
// unbound to a person: sharing one leaks only a hat LOOK for ≤35 days — the
// cosmetics bar, same as every client-side wearable check.
const MEMBER_GRACE = 72 * 3600 * 1000;
async function mintMemberToken(env, member) {
  try {
    // ⚠️ THE GRACE APPLIES HERE TOO. Refusing to mint during it meant the
    // client had no token to present at all, so worker-rave could not have
    // honoured the grace even if it wanted to. 72h, mirrored from
    // src/data/wearables.js — change one, change all four.
    if (!env.MEMBER_HMAC || !member || !member.t
      || !(+member.until + MEMBER_GRACE > Date.now())) return undefined;
    const base = member.t + '.' + (+member.until);
    const key = await crypto.subtle.importKey('raw', te.encode(env.MEMBER_HMAC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return base + '.' + bufToHex(await crypto.subtle.sign('HMAC', key, te.encode(base)));
  } catch (e) { return undefined; }
}

// ---------- 🪪 THE WORLD ID ----------
// A stable, public, per-PERSON id for the walkable world — the thing the garden
// needed and never had. Derived from the PRIMARY record's key, so every device
// and every passkey on one pass gets the same answer.
//
// ⚠️⚠️ HMAC, NOT THE KEY ITSELF. The email rail's key IS the hash of the
// address ('m:' + sha256(email)). Handing that to the client would let anyone
// who guesses an address confirm it by hashing — which is exactly the property
// the hash-keyed design exists to prevent. The HMAC uses PASS_HMAC, so the id
// is stable, comparable, and reverses to nothing without the secret.
// ⚠️ 16 hex chars. The garden stores an 8-char prefix and compares on that; a
// longer id costs bytes in every plot for no extra safety at this scale.
async function worldGid(env, homeKey) {
  return (await hmacHex(env, 'world:' + homeKey)).slice(0, 16);
}
// 🪪 THE WORLD TOKEN — `gid.exp.aliases.sig`. The world id above is an
// identifier; this is the PROOF that the browser presenting it holds the pass
// behind it. Until 2 Sep 2026 the garden and the yards took `pass` as a plain
// string (and the garden published it), so anyone could write as anyone.
// Signed with MEMBER_HMAC — the secret worker-rave already shares for member
// hats — under its own 'wt:' prefix; 30 days, renewed on every pull and push.
// `aliases` = world ids this pass used to answer to (an anonymous pass folded
// into it), so a yard or a plot keyed to the old id follows the person.
// No secret configured = no token, and the world workers stay in soft mode.
const WT_TTL = 30 * 86400000;
async function mintWorldToken(env, gid, aliases) {
  try {
    if (!env.MEMBER_HMAC || !gid) return undefined;
    const al = (aliases || []).filter((a) => /^[a-f0-9]{8,16}$/.test(a) && a !== gid).slice(-8).join(',');
    const base = gid + '.' + (Date.now() + WT_TTL) + '.' + al;
    const key = await crypto.subtle.importKey('raw', te.encode(env.MEMBER_HMAC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return base + '.' + bufToHex(await crypto.subtle.sign('HMAC', key, te.encode('wt:' + base)));
  } catch (e) { return undefined; }
}
// everything a logged-in answer carries about WHO this is, in one place
async function identityOf(env, R) {
  const gid = await worldGid(env, R.homeKey);
  return { gid, worldToken: await mintWorldToken(env, gid, R.home.aliases),
    memberToken: await mintMemberToken(env, (R.home.blob || {}).member),
    // 💰 the server wallet (once frozen) and the tape ids it has seen, so a
    // device can clear an outbox a beacon push delivered without an ack
    ...walletOut(R.home), seen: (R.home.log && R.home.log.seen) || [],
    ...(R.home.rules ? { rules: R.home.rules } : {}),   // 📏 the caps this person has used
    own: OWN_IDS_W.filter((id) => statTotal((R.home.blob || {}).pass, 'own_' + id) > 0) };   // 🎩 the stand gear this pass holds
}

// ---------- POST /challenge ----------
async function challenge(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  const c = bufToHex(crypto.getRandomValues(new Uint8Array(32)));
  const t = Date.now();
  const s = await hmacHex(env, c + '.' + t);
  return json({ c, t, s }, 200, cors(env, request));
}
async function challengeOk(env, clientDataJSON) {
  // the browser embeds our challenge (as base64url of its bytes) in clientData
  let cd;
  try { cd = JSON.parse(new TextDecoder().decode(b64uToBuf(clientDataJSON))); } catch (e) { return false; }
  if (!cd || (cd.type !== 'webauthn.create' && cd.type !== 'webauthn.get')) return false;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(b64uToBuf(cd.challenge))); } catch (e) { return false; }
  if (!payload || !payload.c || !payload.t) return false;
  if (Date.now() - payload.t > CHALLENGE_TTL) return false;
  return (await hmacHex(env, payload.c + '.' + payload.t)) === payload.s;
}

// ---------- the merge: union what accumulates, max what counts ----------
// 💰 the ledger lens: a stat's true value is its frozen legacy scalar plus the
// sum of its per-device slots. Every server-side reader must use this, or the
// admin desk under-reports everything a player earned since the slots landed.
const sumSlots = (o) => { let n = 0; if (o) for (const k in o) { const v = +o[k]; if (Number.isFinite(v)) n += v; } return n; };
function statTotal(pass, key) {
  if (!pass) return 0;
  return (+(pass.base && pass.base[key]) || 0) + sumSlots(pass.led && pass.led[key]);
}
// a pre-ledger pass has no base (its scalars ARE the floor), and a device on
// old code writes the mirror directly — anything above base+slots is real
// progress and has to be adopted rather than dropped
function impliedBase(pass) {
  const b = { ...((pass && pass.base) || {}) };
  for (const k in (pass && pass.stats) || {}) {
    const imp = (+pass.stats[k] || 0) - sumSlots((pass.led || {})[k] || {});
    if (imp > (+b[k] || 0)) b[k] = imp;
  }
  return b;
}
function statsOf(pass) {
  const out = { ...impliedBase(pass) };
  for (const k in (pass && pass.led) || {}) out[k] = (+out[k] || 0) + sumSlots(pass.led[k]);
  return out;
}

function mergeBlob(oldB, newB) {
  if (!oldB) return newB;
  if (!newB) return oldB;
  const out = { ...oldB, ...newB };
  const op = oldB.pass || {}, np = newB.pass || {};
  const patches = { ...(op.patches || {}) };
  for (const [id, ts] of Object.entries(np.patches || {})) patches[id] = Math.min(patches[id] || ts, ts);
  // 💰 THE LEDGER (mirror of banana-pass.js — change both or neither).
  // Counters live in PER-DEVICE slots summed on read; max-merging a slot is
  // lossless because only its own device writes it. The bare scalar is the
  // frozen legacy floor and still merges by max, so a device on old code keeps
  // working through the transition without double-counting.
  const base = {};
  for (const src of [impliedBase(op), impliedBase(np)]) {
    for (const [k, v] of Object.entries(src)) base[k] = Math.max(base[k] || 0, +v || 0);
  }
  const led = {};
  for (const src of [op.led || {}, np.led || {}]) {
    for (const [k, slots] of Object.entries(src)) {
      if (!slots || typeof slots !== 'object') continue;
      led[k] = led[k] || {};
      for (const [dev, v] of Object.entries(slots)) led[k][dev] = Math.max(led[k][dev] || 0, +v || 0);
    }
  }
  const days = [...new Set([...(op.days || []), ...(np.days || [])])].sort().slice(-400);
  const mergedPass = { base, led };
  const stats = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(led)])) stats[k] = statTotal(mergedPass, k);
  out.pass = {
    created: Math.min(op.created || Date.now(), np.created || Date.now()),
    patches, stats, base, led, days,
  };
  // shelf tombstones: union deletions (max ts), keep the newest copy per
  // params, and drop anything tombstoned after it was made — so a delete on
  // one device propagates instead of being resurrected by the union.
  const del = { ...(oldB.shelfDel || {}) };
  for (const [k, ts] of Object.entries(newB.shelfDel || {})) del[k] = Math.max(del[k] || 0, ts);
  const byParams = new Map();
  for (const c of [...(newB.shelf || []), ...(oldB.shelf || [])]) {
    if (!c || !c.params) continue;
    const ex = byParams.get(c.params);
    if (!ex || (c.created || 0) > (ex.created || 0)) byParams.set(c.params, c);
  }
  out.shelf = [...byParams.values()]
    .filter((c) => !(del[c.params] && (c.created || 0) <= del[c.params]))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, 24);
  out.shelfDel = Object.fromEntries(Object.entries(del).sort((a, b) => b[1] - a[1]).slice(0, 200));
  if (oldB.glow === '1' || newB.glow === '1') out.glow = '1';
  // ⏱ newest edit wins for the outfit and the name (mirror of applyBlob). A
  // blank-guard alone made a rename un-propagatable and a cleared name
  // immortal; a clock lets a real edit travel in BOTH directions, while a
  // fresh device (clock 0) still cannot erase anything.
  const oAt = +(oldB.bbAt || 0) || 0, nAt = +(newB.bbAt || 0) || 0;
  if (nAt > oAt) { out.bbLast = newB.bbLast; out.bbAt = nAt; }
  else if (oAt > nAt) { out.bbLast = oldB.bbLast; out.bbAt = oAt; }
  else if (!newB.bbLast && oldB.bbLast) out.bbLast = oldB.bbLast;
  const oNAt = +(oldB.nameAt || 0) || 0, nNAt = +(newB.nameAt || 0) || 0;
  if (nNAt > oNAt) { out.name = newB.name || ''; out.nameAt = nNAt; }
  else if (oNAt > nNAt) { out.name = oldB.name || ''; out.nameAt = oNAt; }
  else if (!newB.name && oldB.name) out.name = oldB.name;
  // 🎩 the membership grant is person-scoped and merges by max(until), rank
  // breaking the tie (a prorated tier upgrade keeps the renewal date) — a
  // stale device can never regress it, and revocation happens by TIME (the
  // grant stops renewing), so there is no delete to merge (mirror of
  // banana-pass.js applyBlob; change both or neither). cleanMember clamps
  // client-authored shapes: bad tier / non-finite / far-future `until` would
  // otherwise poison the durable copy so a REAL grant could never win again;
  // cleaning oldB too makes a previously-poisoned record self-heal.
  const oM = cleanMember(oldB.member), nM = cleanMember(newB.member);
  if (oldB.member !== undefined || newB.member !== undefined) {
    const oU = (oM || {}).until || 0, nU = (nM || {}).until || 0;
    out.member = nU > oU ? nM : oU > nU ? oM
      : (MEMBER_RANK[(nM || {}).t] || 0) >= (MEMBER_RANK[(oM || {}).t] || 0) ? nM : oM;
  }
  return out;
}

const MEMBER_RANK = { 'sup-t1': 1, 'sup-t2': 2, 'sup-t3': 3 };
function cleanMember(m) {
  if (!m || typeof m !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(MEMBER_RANK, m.t)) return null;
  const u = +m.until;
  if (!Number.isFinite(u) || u <= 0) return null;
  return { t: m.t, until: Math.min(u, Date.now() + 400 * 86400 * 1000) };
}

// ---------- ☕ THE KO-FI RAIL — memberships in, grants out ----------
// Ko-fi POSTs form-encoded `data=<json>` to /kofi-hook on every payment
// (configured at ko-fi.com/manage/webhooks; auth = its verification_token
// checked against the KOFI_TOKEN secret — no Origin guard, it's server-to-
// server). There is NO end-of-membership event and none is needed: every
// membership payment extends the grant ~35 days, so a lapse expires on its
// own (revocation by time — the same rule the whole grant system runs on).
// The payer email is normMail'd, hashed, and DISCARDED — the store holds
// hashes and public names only, the standing no-emails doctrine.
// Grants are delivered STRAIGHT INTO the member's home blob via the email
// rail ('m' + hash): paid before ever logging in → the grant waits in the
// member store and lands at mail/use. Tier names are matched loosely; a
// payment that matches no tier is banked in kofi/pending.json, never dropped.
const KOFI_TIERS = [
  { m: /legend|gold/i, t: 'sup-t3' },
  { m: /patron|silver/i, t: 'sup-t2' },
  { m: /friend|blue/i, t: 'sup-t1' },
];
const KOFI_EXTEND = 35 * 86400 * 1000;
function kofiTier(d) {
  const name = String(d.tier_name || '');
  if (name) for (const r of KOFI_TIERS) if (r.m.test(name)) return r.t;
  const usd = String(d.currency || '').toUpperCase() === 'USD' ? parseFloat(d.amount) : NaN;
  return usd >= 15 ? 'sup-t3' : usd >= 10 ? 'sup-t2' : usd >= 5 ? 'sup-t1' : null;
}
async function readJson(env, key) {
  const o = await env.PASSES.get(key);
  try { return o ? await o.json() : null; } catch (e) { return null; }
}
async function writeJson(env, key, v) {
  await env.PASSES.put(key, JSON.stringify(v), { httpMetadata: { contentType: 'application/json' } });
}
// deliver a grant into the member's home blob via the email rail; true if a
// pass existed to deliver to
// `polar` carries the provider's own ids for this membership. They are stamped
// on the HOME RECORD, never in the blob: the blob syncs to every device and is
// client-writable on push, and the one thing a cancel button must not accept is
// a subscription id chosen by the browser asking for the cancellation.
async function deliverGrant(env, emailHash, grant, polar) {
  const mailKey = 'm' + emailHash;
  const rec = await loadKey(env, mailKey);
  if (!rec) return false;
  const homeKey = rec.link || mailKey;
  const home = rec.link ? await loadKey(env, homeKey) : rec;
  if (!home) return false;
  home.blob = mergeBlob(home.blob, { member: grant });
  if (polar && polar.sub) home.polar = { ...(home.polar || {}), ...polar, at: Date.now() };
  await saveKey(env, homeKey, home);
  return true;
}
async function kofiHook(request, env) {
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);
  if (!env.KOFI_TOKEN) return json({ error: 'not configured' }, 503);
  let d;
  try {
    const form = await request.formData();
    d = JSON.parse(form.get('data') || '');
  } catch (e) { return json({ error: 'bad payload' }, 400); }
  if (!d || typeof d !== 'object' || d.verification_token !== env.KOFI_TOKEN) {
    return json({ error: 'bad token' }, 403);
  }
  const ts = Date.now();
  const tx = String(d.kofi_transaction_id || d.message_id || '') || ('t' + ts);
  // every payment lands on the wall ledger (names only when the supporter
  // chose public; dedup by transaction — Ko-fi retries undelivered hooks)
  const wall = (await readJson(env, 'kofi/wall.json')) || [];
  if (!wall.some((w) => w.tx === tx)) {
    wall.unshift({
      tx, ts,
      n: d.is_public === false ? '' : String(d.from_name || '').slice(0, 40),
      a: String(d.amount || ''), c: String(d.currency || '').slice(0, 3),
      k: d.is_subscription_payment ? 'member' : 'coffee',
    });
    await writeJson(env, 'kofi/wall.json', wall.slice(0, 500));
  }
  if (d.is_subscription_payment || /subscription/i.test(String(d.type || ''))) {
    const t = kofiTier(d);
    if (!t) {
      const pend = (await readJson(env, 'kofi/pending.json')) || [];
      pend.unshift({ ts, tx, tier_name: String(d.tier_name || ''), a: String(d.amount || ''), c: String(d.currency || '') });
      await writeJson(env, 'kofi/pending.json', pend.slice(0, 100));
      return json({ ok: true, banked: 'unknown tier' });
    }
    const emailHash = await sha256Hex(normMail(d.email));
    const members = (await readJson(env, 'kofi/members.json')) || {};
    const cur = members[emailHash] || {};
    const until = Math.max(ts + KOFI_EXTEND, +cur.until || 0);
    members[emailHash] = {
      t, until, last: ts,
      n: d.is_public === false ? '' : String(d.from_name || '').slice(0, 40),
    };
    await writeJson(env, 'kofi/members.json', members);
    const delivered = await deliverGrant(env, emailHash, { t, until });
    return json({ ok: true, delivered });
  }
  return json({ ok: true });
}
// ---------- 🐻‍❄️ THE POLAR RAIL (prototype — dark until its secrets exist) ----
// Why a second rail at all: Ko-fi has NO checkout API (webhooks out, nothing in)
// and its internal mint endpoint is Cloudflare bot-walled, so a supporter must
// always take one hop to ko-fi.com. Polar is a merchant of record with a real
// API, so the button can mint a checkout HERE and hand the buyer straight to
// payment — and it carries EU VAT, which is why this is never raw Stripe.
// Both rails write the SAME member/wall stores, so /supporters/ and the park
// board do not care which one paid.
const POLAR_PRODUCT_ENV = { t1: 'POLAR_T1', t2: 'POLAR_T2', t3: 'POLAR_T3', tip: 'POLAR_TIP' };
const POLAR_GRANT = { t1: 'sup-t1', t2: 'sup-t2', t3: 'sup-t3', tip: '' };   // a tip grants nothing but thanks
const polarBase = (env) => env.POLAR_BASE || 'https://sandbox-api.polar.sh';

// GET /pay/checkout?t=t1|t2|t3 → 302 straight into a fresh Polar checkout.
// ⚠️ every failure lands the buyer back on /supporters/ with a reason rather
// than a worker error page: a dead money path must be visible, never a blank.
async function payCheckout(request, env, url) {
  const site = (env.ALLOWED_ORIGIN || 'https://trymstene.com').split(',')[0].trim();
  const back = (why) => Response.redirect(site + '/supporters/?pay=' + why, 302);
  if (throttled(request.headers.get('CF-Connecting-IP') || 'unknown')) return back('busy');
  const t = String(url.searchParams.get('t') || '').slice(0, 4);
  const pid = env[POLAR_PRODUCT_ENV[t] || ''] || '';
  if (!pid || !env.POLAR_TOKEN) return back('unconfigured');
  try {
    const r = await fetch(polarBase(env) + '/v1/checkouts', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.POLAR_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: [pid],
        success_url: site + '/supporters/?joined=1',
        metadata: { tier: POLAR_GRANT[t] || '', src: 'supporters' },
      }),
    });
    const d = await r.json().catch(() => null);
    const to = d && (d.url || d.checkout_url);
    return (r.ok && to) ? Response.redirect(to, 302) : back('down');
  } catch (e) { return back('down'); }
}

// ---------- 🚪 THE WAY OUT, on our own page ----------
// A membership you can only leave by logging into a stranger's site is a
// membership people hesitate to start. Everything a supporter needs — see it,
// cancel it, change their mind — happens on /pass/ with no second login,
// because the pass credential they already hold is the proof.
//
// ⚠️ THE SUBSCRIPTION ID IS NEVER TAKEN FROM THE REQUEST. It is read off the
// home record, where only a signature-verified Polar webhook can have written
// it. A client that could name the id could cancel a stranger's membership by
// guessing one, and ids travel in plain sight through checkout URLs.
// ⚠️ NO `portal` ACTION HERE, deliberately. Minting a customer session hands
// the browser a URL containing a one-hour token that opens invoices, the
// billing email and the saved card — far more than a cancel, off one pass
// token. Card and receipts go through Polar's own email-code portal (they
// require it for PCI anyway); what a member actually needs often — leaving —
// happens here in one tap.
const MANAGE_ACTS = ['status', 'cancel', 'keep'];
const MANAGE_MAX = 5;                                  // mutations per hour, per pass
const CANCEL_REASONS = ['too_expensive', 'missing_features', 'switched_service',
  'unused', 'customer_service', 'low_quality', 'too_complex', 'other'];

async function payManage(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  const out = (o, st = 200) => json(o, st, cors(env, request));
  if (request.method !== 'POST') return out({ error: 'not found' }, 404);
  let b;
  try { b = await request.json(); } catch (e) { return out({ error: 'bad json' }, 400); }
  const act = String(b.act || 'status');
  if (!MANAGE_ACTS.includes(act)) return out({ error: 'bad act' }, 400);

  const R = await tokenRec(env, b.credId, b.token);
  if (!R) return out({ error: 'not linked' }, 403);
  let P = (R.home && R.home.polar) || {};
  // 🩹 memberships that predate the stamp: when the home record IS the email
  // identity, its own key carries the address hash, so the member store can say
  // which subscription this is. ⚠️ the hash comes from the RECORD KEY, never
  // from the request — a browser still cannot name whose membership to touch.
  if (!P.sub && /^m[0-9a-f]{64}$/.test(R.homeKey)) {
    const m = ((await readJson(env, 'kofi/members.json')) || {})[R.homeKey.slice(1)];
    if (m && m.sub) {
      P = { sub: m.sub, cust: m.cust || '', at: Date.now() };
      R.home.polar = P;
      await saveKey(env, R.homeKey, R.home);        // pay the lookup once
    }
  }
  // no stamped subscription = we genuinely cannot tell which one is theirs, and
  // guessing on a money path is worse than saying so. Ko-fi members land here
  // too: that rail has no cancel API at all, and no `sub` to stamp.
  if (!P.sub) return out({ ok: true, known: false });
  if (!env.POLAR_TOKEN) return out({ ok: true, known: false, why: 'unconfigured' });
  // ⚠️ FAIL CLOSED OFF PRODUCTION. polarBase() falls back to sandbox, where a
  // real subscription id does not exist — a cancel would report failure (or
  // one day succeed against nothing) while the card kept being charged.
  if (!/^https:\/\/api\.polar\.sh\/?$/.test(polarBase(env))) return out({ ok: true, known: false, why: 'unconfigured' });

  // a per-PASS budget, kept on the record itself. The IP throttle is an
  // in-memory Map per isolate — fine for chatter, not a control on a route
  // that moves money. Reads are free; only mutations spend.
  if (act !== 'status') {
    const win = R.home.manage && Date.now() - R.home.manage.t < 3600e3 ? R.home.manage : { n: 0, t: Date.now() };
    if (win.n >= MANAGE_MAX) return out({ error: 'slow down' }, 429);
    win.n++;
    R.home.manage = win;
    await saveKey(env, R.homeKey, R.home);
  }

  const api = (path, init = {}) => fetch(polarBase(env) + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + env.POLAR_TOKEN, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

  try {
    const at = '/v1/subscriptions/' + encodeURIComponent(P.sub);
    // ⚠️ ONLY EVER cancel_at_period_end. `revoke` takes back a month that has
    // already been paid for and cannot be undone — the opposite of every other
    // revocation in this codebase, which happens by TIME.
    const body = act === 'cancel'
      ? { cancel_at_period_end: true,
          customer_cancellation_reason: CANCEL_REASONS.includes(String(b.reason)) ? b.reason : null }
      : { cancel_at_period_end: false };
    const call = () => (act === 'status' ? api(at) : api(at, { method: 'PATCH', body: JSON.stringify(body) }));

    let r = await call();
    // a row Polar is already busy with — one polite retry beats telling somebody
    // their cancellation failed when it merely collided
    if (r.status === 409) {
      await new Promise((ok) => setTimeout(ok, 900));
      r = await call();
    }
    let d = await r.json().catch(() => null);
    if (!r.ok) {
      const code = String((d && (d.error || d.type)) || '');
      // ⚠️ ALREADY CANCELLED IS NOT A FAILURE. Polar 403s a second cancel, and
      // showing that as an error tells someone their membership is still
      // running when it is not — so read the truth back and show that instead.
      if (code === 'AlreadyCanceledSubscription') {
        const g = await api(at);
        const gd = await g.json().catch(() => null);
        if (g.ok && gd && gd.id) d = gd;
      }
      // the provider's own error text never reaches the browser — it is theirs,
      // it changes without notice, and none of it helps a member
      console.error('polar manage', act, r.status, code);
      if (!d || !d.id) return out({ error: 'polar' }, 502);
    }
    if (!d || !d.id) return out({ error: 'polar' }, 502);
    // names and ids stay server-side; the page only needs what it will show
    return out({
      ok: true, known: true, act,
      state: String(d.status || ''),
      ending: !!d.cancel_at_period_end || ['canceled', 'revoked'].includes(String(d.status)),
      endsAt: d.ends_at || d.current_period_end || null,
      amount: +d.amount || 0,
      product: String((d.product || {}).name || ''),
    });
  } catch (e) { return out({ error: 'polar down' }, 502); }
}

// ☕ A ONE-OFF, IN ONE TAP. The amount is chosen on our own page and carried
// into the checkout, so nobody has to type it twice.
// ⚠️ AND IT FALLS BACK TO THE KO-FI TIP JAR rather than erroring — if the
// product is unset, the token is missing, or Polar is down, the money still has
// somewhere to go. A dead donate button is worse than a slower one, and this is
// the one route where the visitor is already holding their wallet.
const TIP_JAR = 'https://ko-fi.com/trymstene';
async function payTip(request, env, url) {
  const site = (env.ALLOWED_ORIGIN || 'https://trymstene.com').split(',')[0].trim();
  if (throttled(request.headers.get('CF-Connecting-IP') || 'unknown')) return Response.redirect(TIP_JAR, 302);
  const pid = env.POLAR_TIP || '';
  if (!pid || !env.POLAR_TOKEN) return Response.redirect(TIP_JAR, 302);
  // cents, clamped to what the product will actually accept: its minimum is
  // $3, and below that Polar refuses the checkout outright — better to drop the
  // amount and let them pick than to bounce somebody off a broken link. The
  // ceiling is there so a stray digit cannot mint a four-figure checkout.
  const want = Math.round(Number(url.searchParams.get('a')) || 0);
  const amount = want >= 300 && want <= 50000 ? want : 0;
  try {
    const r = await fetch(polarBase(env) + '/v1/checkouts', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.POLAR_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: [pid],
        ...(amount ? { amount } : {}),          // 0 = let them pick on the checkout
        success_url: site + '/supporters/?thanks=1',
        metadata: { tier: 'coffee', src: 'supporters' },
      }),
    });
    const d = await r.json().catch(() => null);
    const to = d && (d.url || d.checkout_url);
    return (r.ok && to) ? Response.redirect(to, 302) : Response.redirect(TIP_JAR, 302);
  } catch (e) { return Response.redirect(TIP_JAR, 302); }
}

// Standard Webhooks: base64 HMAC-SHA256 over `id.timestamp.body`, header
// `webhook-signature: v1,<sig>` (space-separated list during key rotation).
// The secret may arrive raw or base64 behind a whsec_ prefix — accept both.
async function polarVerify(env, headers, body) {
  const raw = env.POLAR_WEBHOOK_SECRET || '';
  const id = headers.get('webhook-id'), ts = headers.get('webhook-timestamp');
  const sigs = headers.get('webhook-signature');
  if (!raw || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;   // replay window
  // ⚠️ THE KEY DERIVATION IS NOT THE OBVIOUS ONE. Standard Webhooks says the
  // secret is base64 behind a `whsec_` prefix, but Polar's SDK base64-ENCODES
  // the secret string it was given and hands that to the library, which then
  // decodes it — so their real HMAC key is the UTF-8 bytes of the whole secret,
  // prefix included. Guessing wrong cost a round of live 403s with Polar
  // retrying politely, so try every sane derivation and accept any match: all
  // three are HMAC-SHA256 under a secret only Polar and this worker hold.
  const bare = raw.startsWith('whsec_') ? raw.slice(6) : raw;
  const keys = [te.encode(raw), te.encode(bare)];
  try { keys.push(Uint8Array.from(atob(bare), (c) => c.charCodeAt(0))); } catch (e) {}
  const want = sigs.split(' ').map((one) => one.split(',')[1]).filter(Boolean);
  for (const bytes of keys) {
    const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, te.encode(id + '.' + ts + '.' + body));
    const expect = btoa(String.fromCharCode(...new Uint8Array(mac)));
    if (want.includes(expect)) return true;
  }
  return false;
}

// product id → tier, then the product NAME, then the amount (cents) — the same
// belt-and-braces the Ko-fi rail needs, for the same reason: a payload field
// you assume is present is the one that arrives null on the first real sale
function polarTier(env, d) {
  const pid = (d.product && d.product.id) || d.product_id || '';
  for (const [t, key] of Object.entries(POLAR_PRODUCT_ENV)) {
    if (pid && env[key] && env[key] === pid) return POLAR_GRANT[t];
  }
  const name = String((d.product && d.product.name) || '');
  if (/legend|gold/i.test(name)) return 'sup-t3';
  if (/patron|silver/i.test(name)) return 'sup-t2';
  if (/friend|blue/i.test(name)) return 'sup-t1';
  const cents = +(d.amount || (d.price && d.price.price_amount) || 0);
  return cents >= 1500 ? 'sup-t3' : cents >= 1000 ? 'sup-t2' : cents >= 500 ? 'sup-t1' : null;
}

async function polarHook(request, env) {
  if (request.method !== 'POST') return json({ error: 'not found' }, 404);
  if (!env.POLAR_WEBHOOK_SECRET) return json({ error: 'not configured' }, 503);
  const body = await request.text();
  if (!(await polarVerify(env, request.headers, body))) return json({ error: 'bad signature' }, 403);
  let ev;
  try { ev = JSON.parse(body); } catch (e) { return json({ error: 'bad json' }, 400); }
  const type = String(ev.type || ''), d = ev.data || {};
  const cust = d.customer || d.user || {};
  const email = normMail(cust.email || d.customer_email || '');
  const pub = String(cust.public_name || cust.name || '').slice(0, 40);
  const now = Date.now();
  const tx = String(d.id || '') || ('p' + now);

  // 🧾 the wall ledger — one line per payment, whichever rail took it
  const isSub = /^subscription\./.test(type) || !!d.subscription_id || !!d.recurring_interval;
  // ⚠️ ONLY order.paid writes here. Polar fires subscription.created, .active,
  // .updated AND order.paid for a single payment, each carrying a different id,
  // so a tx-keyed dedupe cannot see they are the same event — one join showed
  // up as two lines on the public feed until this was narrowed to the one event
  // that actually means money moved.
  if (type === 'order.paid') {
    const wall = (await readJson(env, 'kofi/wall.json')) || [];
    if (!wall.some((w) => w.tx === tx)) {
      wall.unshift({ tx, ts: now, n: pub, a: String((+d.amount || 0) / 100), c: 'USD',
        k: isSub ? 'member' : 'coffee' });
      await writeJson(env, 'kofi/wall.json', wall.slice(0, 500));
    }
  }

  if (!email) return json({ ok: true, note: 'no email on event' });
  const members = (await readJson(env, 'kofi/members.json')) || {};
  const hash = await sha256Hex(email);

  // revocation is still BY TIME everywhere else — this just brings the clock
  // forward, so the 72h client grace still applies and nothing goes negative
  // ⚠️ A REFUND IS NOT A CANCELLATION in Polar — refunding an order leaves the
  // subscription active, and order.refunded is a SEPARATE event that has to be
  // subscribed to explicitly. Missing it meant a refunded supporter kept the hat
  // silently (found by refunding a real payment; the endpoint now carries it).
  if (type === 'subscription.revoked' || type === 'order.refunded') {
    if (members[hash]) {
      members[hash] = { ...members[hash], until: now, last: now };
      await writeJson(env, 'kofi/members.json', members);
      await deliverGrant(env, hash, { t: members[hash].t, until: now });
    }
    return json({ ok: true, revoked: true });
  }

  const GRANT_EVENTS = ['subscription.created', 'subscription.active', 'subscription.cycled', 'subscription.updated'];
  if (GRANT_EVENTS.includes(type) || (type === 'order.paid' && isSub)) {
    if (d.status && !['active', 'trialing'].includes(String(d.status))) {
      return json({ ok: true, note: 'status ' + d.status });
    }
    const t = polarTier(env, d);
    if (!t) {
      const pend = (await readJson(env, 'kofi/pending.json')) || [];
      pend.unshift({ ts: now, tx, rail: 'polar', product: (d.product && d.product.name) || '', a: d.amount });
      await writeJson(env, 'kofi/pending.json', pend.slice(0, 100));
      return json({ ok: true, banked: 'unknown tier' });
    }
    // the period end IS the truth when Polar sends it; otherwise fall back to
    // the same ~35 day window the Ko-fi rail uses
    const per = Date.parse(d.current_period_end || '') || 0;
    const until = Math.max(per || (now + KOFI_EXTEND), +(members[hash] || {}).until || 0);
    // ⚠️ on order.paid the event's own id is the ORDER's — the subscription is
    // one field over. Stamping the order id here would give the cancel route a
    // valid-looking id that Polar refuses.
    const subId = String((/^subscription\./.test(type) ? d.id : d.subscription_id) || '');
    const polar = { sub: subId, cust: String(cust.id || '') };
    members[hash] = { t, until, last: now, n: pub,
      ...(subId ? { sub: subId } : {}), ...(cust.id ? { cust: String(cust.id) } : {}) };
    await writeJson(env, 'kofi/members.json', members);
    const delivered = await deliverGrant(env, hash, { t, until }, polar);
    return json({ ok: true, tier: t, delivered });
  }
  return json({ ok: true, ignored: type });
}

// GET /supporters — the public feed for the wall/page: names only, cached
async function supporters(request, env) {
  const wall = (await readJson(env, 'kofi/wall.json')) || [];
  const members = (await readJson(env, 'kofi/members.json')) || {};
  const now = Date.now();
  const names = Object.values(members)
    .filter((m) => m.until > now && m.n)
    .sort((a, b) => (MEMBER_RANK[b.t] || 0) - (MEMBER_RANK[a.t] || 0) || (a.last || 0) - (b.last || 0))
    .map((m) => ({ n: m.n, t: m.t }));
  return json({
    members: names,
    wall: wall.slice(0, 100).map((w) => ({ n: w.n, k: w.k, ts: w.ts })),
  }, 200, { ...cors(env, request), 'Cache-Control': 'public, max-age=300' });
}

// ⭐ THE KEY SPACE IS SHARED. A passkey's key is the hash of its credential id;
// an email's is 'm' + the hash of the address, handed to the client as an
// OPAQUE credId ('m:<hash>'). One namespace means resolve(), tokens, push and
// pull all work for an email identity with no second code path — and the
// address itself never travels in a URL or sits in localStorage.
async function keyFor(credId) {
  const c = String(credId || '');
  return c.startsWith('m:') ? c.slice(2) : await sha256Hex(c);
}
async function loadRec(env, credId) {
  const obj = await env.PASSES.get(`pass/${await keyFor(credId)}.json`);
  return obj ? await obj.json() : null;
}
async function loadKey(env, key) {
  const obj = await env.PASSES.get(`pass/${key}.json`);
  return obj ? await obj.json() : null;
}
async function saveKey(env, key, rec) {
  rec.updated = Date.now();
  await env.PASSES.put(`pass/${key}.json`, JSON.stringify(rec),
    { httpMetadata: { contentType: 'application/json' } });
}

// ⭐ ONE PASS, SEVERAL PASSKEYS. A record is either a PRIMARY (it holds the
// blob) or a POINTER: its own pk/alg/tokens, plus `link` — the key of the
// primary whose blob it shares. Nothing about existing records changes; every
// pass written before this is simply a primary already, which is why this
// needed no migration.
// ⚠️ ONE HOP ONLY. A pointer's `link` must name a PRIMARY, never another
// pointer — chains would be a loop waiting to happen and buy nothing.
// ⚠️ THE KEY STAYS ON ITS OWN RECORD. Verification and tokens belong to the
// credential that presented them; only the BLOB is shared. A device you unlink
// later must not be able to keep asserting with somebody else's key.
async function resolve(env, credId) {
  const ownKey = await keyFor(credId);
  const own = await loadKey(env, ownKey);
  if (!own) return null;
  if (!own.link) return { own, ownKey, home: own, homeKey: ownKey };
  const home = await loadKey(env, own.link);
  if (!home || home.link) return null;          // dangling or chained — refuse
  return { own, ownKey, home, homeKey: own.link };
}

// ---------- 🗄 THE PASS LEDGER (Banana HQ's World desk) ----------
// Read-only admin view over SYNCED passes: who linked a passkey, their coins,
// gear, badges and rhythm. Key-gated by the PASS_ADMIN_KEY secret and FAILS
// CLOSED (404, deny-as-nothing — the Pulse pattern) until Trym sets it.
// LocalStorage-only visitors have no record here by design — this is the
// ledger of the synced, not a user database.
// ---------- 🗄 THE ADMIN DESK (Banana HQ → Users) ----------------------
// ⚠️ EVERY WRITE HERE FIGHTS mergeBlob(), AND THE MERGE WINS. Stats merge by
// MAX and the name survives a blank, so:
//   · GRANTING is durable    — raise a number, MAX keeps it
//   · TAKING COINS is durable ONLY through coins_spent, because the balance is
//     (earned − spent) and spent is MAX-merged too
//   · lowering rep/jelly, revoking own_* gear and clearing a name are NOT: the
//     player's own next push restores the higher (or older) value and the edit
//     evaporates with no error anywhere.
// Those three are therefore NOT OFFERED. A button that looks like it worked and
// silently didn't is worse than no button; they need a tombstone rail like the
// shelf's, and that is a separate build.
// ⚠️ ERASE is the exception that IS durable — there is no record left to merge
// into. It is also how a GDPR deletion request gets honoured (see /admin/find).
// ⚠️ THE FREE PLAN ALLOWS 50 SUBREQUESTS PER REQUEST AND AN R2 BINDING CALL IS
// ONE. Every record this desk reads, and every one it deletes, spends from that
// same 50 — so these caps are a hard budget, not a preference: go over and the
// desk throws 1101 instead of a ledger, i.e. it breaks exactly as the user base
// grows. Truncation is always REPORTED in the JSON, never silently short.
const ADMIN_LIST = 1000;     // key names are cheap — one list call whatever the size
const SUBREQ_BUDGET = 48;    // …of the plan's 50, leaving headroom
const ADMIN_READ = 46;       // pass records one ledger request reads (1 list + 46 gets)
const ADMIN_LOG_READ = 40;   // audit-log rows one request reads
const ADMIN_CHUNK = 12;      // gets/deletes go out in parallel batches, never serially
const ERASE_HOLD = 5;        // deletes a sweep holds back so it can finish its page
                             // (a pass carries 1-3 credentials in practice; holding 12
                             // starved the read budget below what the old code swept)
const GRANT_CAP = 100000;    // no fat fingers turning 100 into 100000000

const adminOk = (env, key) => !!(env.PASS_ADMIN_KEY && key === env.PASS_ADMIN_KEY);
const notFound = () => new Response('not found', { status: 404 });
// ✉️ an email identity is keyed 'm' + hash; a passkey key is pure hex, and 'm'
// is not a hex digit, so the prefix tells the two rails apart with no lookup
const isMailKey = (k) => k.slice(5).startsWith('m');

// read many records at once. ⚠️ a serial `await` per key is what blows the
// subrequest budget's wall-clock; the CAPS are what keep the count legal, this
// only stops N reads costing N round trips. Order in = order out.
async function readMany(env, keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += ADMIN_CHUNK) {
    const batch = await Promise.all(keys.slice(i, i + ADMIN_CHUNK).map(async (k) => {
      try {
        const obj = await env.PASSES.get(k);
        return obj ? [k, await obj.json()] : null;
      } catch (e) { return null; }
    }));
    for (const hit of batch) if (hit) out.push(hit);
  }
  return out;
}

async function adminLog(request, env, url) {
  if (!adminOk(env, url.searchParams.get('key') || '')) return notFound();
  const list = await env.PASSES.list({ prefix: 'adminlog/', limit: 200 });
  const all = list.objects.map((o) => o.key).sort().reverse();
  const keys = all.slice(0, ADMIN_LOG_READ);
  const rows = (await readMany(env, keys)).map(([, r]) => r);
  return json({ rows, truncated: all.length > keys.length }, 200,
    { ...cors(env, request), 'Cache-Control': 'no-store' });
}
// ⚠️ every write leaves a trace. An admin desk with no record of what it did
// is indistinguishable from a compromised one.
async function adminNote(env, act, id, detail) {
  const at = Date.now();
  await env.PASSES.put(`adminlog/${at}-${bufToHex(crypto.getRandomValues(new Uint8Array(3)))}.json`,
    JSON.stringify({ at, act, id, detail }), { httpMetadata: { contentType: 'application/json' } });
}

// one sweep of the bucket: primaries become rows, and every POINTER folds into
// the row it points at as a device count + whether that pass can be recovered
async function adminScan(env) {
  const list = await env.PASSES.list({ prefix: 'pass/', limit: ADMIN_LIST });
  const keys = list.objects.map((o) => o.key);
  const truncated = !!list.truncated || keys.length > ADMIN_READ;
  const recs = new Map(await readMany(env, keys.slice(0, ADMIN_READ)));
  const extra = new Map();                       // homeKey → { devices, mail }
  for (const [k, r] of recs) {
    if (!r || !r.link) continue;
    const e = extra.get(`pass/${r.link}.json`) || { devices: 0, mail: false };
    e.devices += 1;
    if (isMailKey(k)) e.mail = true;
    extra.set(`pass/${r.link}.json`, e);
  }
  const rows = [];
  for (const [k, rec] of recs) {
    if (!rec || rec.link) continue;              // one row per PASS, not per credential
    const blob = rec.blob || {};
    const p = blob.pass || {};
    const stats = statsOf(p);        // totals, not the frozen scalars
    const ex = extra.get(k) || { devices: 0, mail: false };
    const gear = Object.keys(stats).filter((x) => x.startsWith('own_') && stats[x] > 0).map((x) => x.slice(4));
    const rep = stats.rep || 0;
    rows.push({
      id: k.slice(5, 13),                        // stable pseudo-id, never the credId
      name: (blob.name || '').slice(0, 24),
      updated: rec.updated || 0,
      created: p.created || 0,
      // ⭐ THE COLUMN THE EMAIL RAIL MADE POSSIBLE: can this player get back in
      // after losing the device? mail = yes, forever. devices only = only while
      // the other one still works. neither = one dead phone from gone.
      // ⚠️ null = UNKNOWN, not "no": past the read cap a recovery pointer may
      // simply not have been read, and this column is the one an erase or a
      // support answer leans on. Never print a guess as a fact.
      mail: (ex.mail || isMailKey(k)) ? true : (truncated ? null : false),
      devices: Object.keys(rec.tokens || {}).length + ex.devices,
      days: (p.days || []).length,
      badges: Object.keys(p.patches || {}).length,
      shelf: (blob.shelf || []).length,
      rep,
      level: levelFor(rep).level,                // ⚠️ the real curve — see the import
      jelly: stats.jelly || 0,
      // 💰 the server wallet once frozen, the client ledger's number until then
      coins: rec.wallet ? walletBal(rec.wallet)
        : Math.max(0, (stats.coins_earned || 0) + (stats.coins_refunded || 0) - (stats.coins_spent || 0)),
      wallet: !!rec.wallet,
      refused: (rec.wallet && rec.wallet.refused) || 0,
      // 📏 events a faucet rule refused (by reason) and unnamed ones let through
      rr: rec.log && rec.log.rr ? Object.values(rec.log.rr).reduce((t, v) => t + v, 0) : 0,
      unruled: (rec.log && rec.log.unruled) || 0,
      // 🎩 stand ownership: frozen-in ids and pushes from pre-slice tabs
      ownFroze: rec.ownFroze || [],
      ownLegacy: (rec.log && rec.log.ownLegacy) || 0,
      coinsEarned: stats.coins_earned || 0,
      coinsSpent: stats.coins_spent || 0,
      gear,
      glow: blob.glow === '1',
      anon: !!rec.anon,                          // 🫧 a server pass nobody has claimed yet
      // 📜 the tape: events kept, drift score (|slot move − events| over the
      // money keys), pushes the drift could not judge, and the last few events
      ev: (rec.log && rec.log.n) || 0,
      drift: driftScore(rec.log),
      unsure: (rec.log && rec.log.unsure) || 0,
      evLast: ((rec.log && rec.log.ev) || []).slice(-8).map((e) => ({ t: e.t, k: e.k, d: e.d, a: e.a, ...(e.s ? { s: e.s } : {}) })),
    });
  }
  rows.sort((a, b) => b.updated - a.updated);
  return { rows, truncated, scanned: recs.size, listed: list.objects.length };
}

async function adminLedger(request, env, url) {
  if (!adminOk(env, url.searchParams.get('key') || '')) return notFound();
  const { rows, truncated, scanned, listed } = await adminScan(env);
  const week = Date.now() - 7 * 86400000;
  const sum = {
    passes: rows.length,
    withMail: rows.filter((r) => r.mail).length,
    activeWeek: rows.filter((r) => r.updated > week).length,
    coins: rows.reduce((n, r) => n + r.coins, 0),
    badges: rows.reduce((n, r) => n + r.badges, 0),
    multiDevice: rows.filter((r) => r.devices > 1).length,
  };
  return json({ total: listed, scanned, truncated, sum, passes: rows }, 200, {
    ...cors(env, request), 'Cache-Control': 'no-store',
  });
}

// resolve the 8-char pseudo-id the desk shows back to a real record
async function adminKeyFor(env, id) {
  const want = String(id || '').toLowerCase();
  if (!/^[0-9a-f]{6,16}$|^m[0-9a-f]{5,15}$/.test(want)) return null;
  const list = await env.PASSES.list({ prefix: 'pass/' + want, limit: 5 });
  const hits = list.objects.map((o) => o.key);
  if (hits.length !== 1) return null;            // ⚠️ ambiguous never guesses
  return hits[0];
}

// POST /admin/find { key, email } → { id } | { found: false }
// ⭐ THIS IS THE PRIVACY PAGE'S PROMISE, IMPLEMENTED. The site cannot turn a
// stored record back into an address (one-way hash), but it CAN go the other
// way — which is exactly enough to honour "delete the pass behind this email".
async function adminFind(request, env) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  if (!adminOk(env, (b && b.key) || '')) return notFound();
  const email = normMail(b.email);
  if (!MAIL_RE.test(email)) return json({ error: 'bad email' }, 400, cors(env, request));
  const mailKey = 'm' + (await sha256Hex(email));
  const rec = await loadKey(env, mailKey);
  if (!rec) return json({ found: false }, 200, cors(env, request));
  const homeKey = rec.link || mailKey;
  return json({ found: true, id: homeKey.slice(0, 8), viaMail: mailKey.slice(0, 8) },
    200, cors(env, request));
}

// POST /admin/grant { key, id, coins?, take?, rep?, jelly?, gear? }
async function adminGrant(request, env) {
  if (throttled(request.headers.get('CF-Connecting-IP') || 'admin')) {
    return json({ error: 'slow down' }, 429, cors(env, request));
  }
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  if (!adminOk(env, (b && b.key) || '')) return notFound();
  const k = await adminKeyFor(env, b.id);
  if (!k) return json({ error: 'no such pass' }, 404, cors(env, request));
  const rec = await (await env.PASSES.get(k)).json();
  if (!rec || rec.link) return json({ error: 'not a primary' }, 409, cors(env, request));

  const n = (v) => Math.min(GRANT_CAP, Math.max(0, Math.floor(Number(v) || 0)));
  const blob = rec.blob || (rec.blob = {});
  const p = blob.pass || (blob.pass = { created: Date.now(), patches: {}, stats: {}, days: [] });
  const st = p.stats || (p.stats = {});
  // ⚠️ grants go into the ADMIN's own ledger slot, never the shared scalar: a
  // player's device pushes its own slots and max-merges the scalar, so a grant
  // written to the scalar could be flattened by an older client's copy.
  const led = p.led || (p.led = {});
  if (!p.base) p.base = { ...(p.stats || {}) };   // freeze the pre-ledger floor before granting
  const did = [];
  const add = (stat, amount, label) => {
    if (!amount) return;
    led[stat] = led[stat] || {};
    led[stat].hq = (+led[stat].hq || 0) + amount;
    did.push(label + ' +' + amount);
  };
  add('coins_earned', n(b.coins), 'coins');
  // ⚠️ TAKING coins raises SPENT, never lowers EARNED — a lowered number loses
  // to MAX on the player's next push and the deduction would just vanish.
  add('coins_spent', n(b.take), 'coins taken');
  // 💰 …and the server wallet moves with the grant (a slot alone never moves it)
  if (rec.wallet && (n(b.coins) || n(b.take))) {
    rec.wallet.earned += n(b.coins);
    rec.wallet.spent += n(b.take);
    rec.wallet.seq = (rec.wallet.seq || 0) + 1;
    rec.wallet.at = Date.now();
    const log = rec.log || (rec.log = { ev: [], n: 0, seen: [], drop: 0, pushes: 0, unsure: 0, drift: {} });
    for (const [k, d] of [['coins_earned', n(b.coins)], ['coins_spent', n(b.take)]]) {
      if (!d) continue;
      log.ev.push({ id: bufToHex(crypto.getRandomValues(new Uint8Array(4))), t: Date.now(), k, d, a: 'hq', s: 'grant', at: Date.now() });
      log.n = (log.n || 0) + 1;
    }
    if (log.ev.length > LOG_CAP) log.ev.splice(0, log.ev.length - LOG_CAP);
  }
  add('rep', n(b.rep), 'rep');
  add('jelly', n(b.jelly), 'jelly');
  if (b.gear) {
    const id = String(b.gear).replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
    if (id) { st['own_' + id] = 1; p.base = p.base || {}; p.base['own_' + id] = 1; did.push('gear ' + id); }   // base + mirror: identityOf reads base
  }
  if (!did.length) return json({ error: 'nothing to do' }, 400, cors(env, request));
  // the record's stats MIRROR must agree with base + slots at once — a stale
  // mirror made every desk grant look lost until the player's next push
  p.stats = statsOf(p);
  await env.PASSES.put(k, JSON.stringify({ ...rec, updated: Date.now() }),
    { httpMetadata: { contentType: 'application/json' } });
  await adminNote(env, 'grant', k.slice(5, 13), did.join(', '));
  const coins = rec.wallet ? walletBal(rec.wallet)
    : Math.max(0, statTotal(p, 'coins_earned') + statTotal(p, 'coins_refunded') - statTotal(p, 'coins_spent'));
  return json({ ok: true, did, coins, rep: statTotal(p, 'rep'), jelly: statTotal(p, 'jelly') },
    200, cors(env, request));
}

// POST /admin/erase { key, id, confirm } → the pass and every credential for it
// ⚠️ IRREVERSIBLE and deliberately awkward: `confirm` must be the id again.
async function adminErase(request, env) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  if (!adminOk(env, (b && b.key) || '')) return notFound();
  if (String(b.confirm || '') !== String(b.id || '')) {
    return json({ error: 'confirm must repeat the id' }, 400, cors(env, request));
  }
  const k = await adminKeyFor(env, b.id);
  if (!k) return json({ error: 'no such pass' }, 404, cors(env, request));
  const home = k.slice(5, -5);
  // sweep the pointers first — a pointer left behind resolves to nothing and
  // would strand that device on a dangling link.
  // ⚠️ THE CURSOR IS THE POINT. Sweeping only the first page left every pointer
  // past it alive, in the one feature whose whole promise is that the data is
  // gone. A list, a get and a delete each cost one subrequest, so reads and
  // deletes get separate shares — a page can then always finish deleting what
  // it just found instead of running dry mid-page.
  let reads = SUBREQ_BUDGET - 3 - ERASE_HOLD;   // …less adminKeyFor's list, the home
  let dels = ERASE_HOLD;                        // delete and the audit note still owed
  let gone = 0, swept = false, cursor;
  while (reads > 1) {
    const list = await env.PASSES.list({ prefix: 'pass/', limit: ADMIN_LIST, cursor });
    reads--;
    const keys = list.objects.map((o) => o.key).filter((key) => key !== k);
    const batch = keys.slice(0, reads);
    reads -= batch.length;
    const hits = (await readMany(env, batch)).filter(([, r]) => r && r.link === home).map(([key]) => key);
    const del = hits.slice(0, dels);
    for (let i = 0; i < del.length; i += ADMIN_CHUNK) {
      await Promise.all(del.slice(i, i + ADMIN_CHUNK).map((key) => env.PASSES.delete(key)));
    }
    dels -= del.length;
    gone += del.length;
    if (batch.length < keys.length || del.length < hits.length) break;   // the budget cut it short
    if (list.truncated && list.cursor) { cursor = list.cursor; continue; }
    // ⚠️ TERMINATION, and the only place `swept` becomes true: the listing said
    // this was the last page. A listing that claims MORE and hands back no
    // cursor stops here too — spinning on it would never end — but reports
    // false, because pointers past it were never looked at.
    swept = !list.truncated;
    break;
  }
  // the record holding the BLOB always goes, swept or not — the data leaving is
  // the promise; a stray pointer is inert (resolve() refuses a dangling link)
  await env.PASSES.delete(k);
  await adminNote(env, 'erase', k.slice(5, 13), gone + ' linked credential(s) too'
    + (swept ? '' : ' — ⚠️ sweep hit the request budget, pointers may remain'));
  return json({ ok: true, credentials: gone + 1, swept }, 200, cors(env, request));
}

async function saveRec(env, credId, rec) {
  rec.updated = Date.now();
  await env.PASSES.put(`pass/${await keyFor(credId)}.json`, JSON.stringify(rec), {
    httpMetadata: { contentType: 'application/json' },
  });
}
async function mintToken(rec) {
  const token = bufToHex(crypto.getRandomValues(new Uint8Array(24)));
  rec.tokens = rec.tokens || {};
  rec.tokens[await sha256Hex(token)] = Date.now();
  const keys = Object.entries(rec.tokens).sort((a, b) => b[1] - a[1]).slice(0, MAX_TOKENS);
  rec.tokens = Object.fromEntries(keys);
  return token;
}
// 🔒 A GRANT IS SERVER-AUTHORED, ALWAYS. Every blob arriving from a browser
// goes through here first.
//
// ⚠️ WHY: `member` used to ride the sync blob in BOTH directions, and mergeBlob
// only checked its SHAPE — a known tier and a finite `until` — never where it
// came from. So `localStorage.setItem('bb-member', {t:'sup-t3', until: …})`
// followed by one push wrote a Legend grant onto the server record, which then
// minted a real signed member token and put the gold hat on that banana in
// front of everybody in the rave. Cosmetic, and it was logged as an accepted
// risk back when no payment rail existed. One exists now.
//
// The grant only ever comes from deliverGrant() or /mail/use, both of which
// write the home record directly and do not pass through here. The client's
// ONLY legitimate move is to adopt what the server sends down — so stripping it
// on the way up costs a real member nothing.
// ---------- 🎩 STAND OWNERSHIP THROUGH AN ACCEPTED SPEND (2 Sep 2026, slice 4) ----------
// A Banana Stand wearable is yours only when this worker ACCEPTED the spend
// row that names it (`i`) at or above the manifest price. For those ids
// own_<id> is server-authored, the way `member` is: clientBlob strips a
// client's own_<stand id> from base, led AND stats (impliedBase would lift a
// raised mirror into base otherwise), and the only writers are tapeIn on an
// accepted purchase, the HQ gear grant, and the one-time FREEZE — a record's
// first inbound blob after this shipped merges unstripped and is stamped
// `ownAt` (the wallet's grandfather, cheats included, listed in `ownFroze`).
// Every answer carries `own` (the stand ids this pass holds) and a push adds
// `nak` (refused purchases), so a forging device reconciles within one push.
// ⚠️ OWN_PRICES is GENERATED from src/data/wearables.js by
// tools/build-worker-allowlists.mjs — a price RAISE ships the site first, a
// CUT ships this worker first, a NEW item regens + deploys this worker first.
// OWN-PRICES-START — GENERATED by tools/build-worker-allowlists.mjs from
// src/data/wearables.js (preview: stand + price). NEVER edit by hand.
const OWN_PRICES = { duckhat: 60, melticecream: 30, watermelonhat: 30, buckethat: 25, snailhat: 15, squidhat: 120, snorkelmask: 40, flamingoring: 80, medal: 35, sockssandals: 12, balloondog: 35, potato: 10, cactuspot: 40 };
// OWN-PRICES-END
const OWN_IDS_W = Object.keys(OWN_PRICES);
const ownStrict = (env) => !!(env && String(env.OWN_STRICT || '') === '1');
function clientBlob(blob, keepOwn) {
  if (!blob || typeof blob !== 'object') return blob;
  // `member` is server-authored; `ev`/`evDrop`/`evDev` are the ledger tape,
  // consumed by /push and never part of the blob
  const { member, ev, evDrop, evDev, ...rest } = blob;
  if (keepOwn || !rest.pass || typeof rest.pass !== 'object') return rest;
  const p = { ...rest.pass };
  for (const f of ['base', 'led', 'stats']) {
    if (!p[f] || typeof p[f] !== 'object') continue;
    const o = { ...p[f] };
    for (const id of OWN_IDS_W) delete o['own_' + id];
    p[f] = o;
  }
  return { ...rest, pass: p };
}
// the one door an inbound client blob takes onto a home record
const NEW_FLOOR = 300;   // the most a brand-new record's claimed ledger may open with
function takeBlob(home, blob, keepOwn) {
  const fresh = !home.ownAt && !!home.blob;   // a record that never held a blob has nothing to grandfather
  const out = mergeBlob(home.blob, clientBlob(blob, fresh || keepOwn) || null);
  if (fresh) {
    home.ownAt = Date.now();
    home.ownFroze = OWN_IDS_W.filter((id) => statTotal(out && out.pass, 'own_' + id) > 0);
  }
  return out;
}

// ---------- 📜 THE LEDGER TAPE (2 Sep 2026, slice 1 of the server-side ledger) ----------
// Every stat write on a device also sends a small event with the next push:
// { id, t, k, d, a (area), s? (source) }. We keep the last LOG_CAP per player
// INSIDE the home record — the record is read and written on every push
// anyway, so the tape costs no extra R2 call — dedupe by id (a beacon push
// has no ack and re-sends), and score DRIFT: how far the pushing device's own
// ledger slot moved beyond what its events explain. Honest play drifts 0.
// A DevTools edit of pass-v1 moves a slot with no event behind it — that is
// the number the desk shows. ⚠️ Advisory, not a verdict: a device still on
// pre-tape JS pushes slot moves with no events at all (drift = everything),
// and a push whose outbox overflowed (evDrop > 0) is skipped as `unsure`.
// Totals stay client-authoritative; nothing here changes what a player has.
const LOG_CAP = 600, SEEN_CAP = 2000, EV_MAX = 600;   // seen ≫ a push, or a beacon re-send double-counts
const DRIFT_KEYS = ['coins_earned', 'coins_spent', 'coins_refunded', 'rep', 'jelly'];
const COIN_KEYS = ['coins_earned', 'coins_refunded', 'coins_spent'];
function slotsOf(blob, dv) {
  const out = {};
  const led = (blob && blob.pass && blob.pass.led) || {};
  if (dv) for (const k in led) { const v = +(led[k] && led[k][dv]); if (Number.isFinite(v)) out[k] = v; }
  return out;
}
// ---------- 💰 THE SERVER WALLET (2 Sep 2026, slice 2 of the server-side ledger) ----------
// The balance is what the SERVER has accepted. It is FROZEN at the player's
// own number on their first push after this shipped (nobody loses a coin;
// whatever came before is grandfathered), then moved only by tape events —
// coins_earned, coins_refunded, coins_spent — and by admin grants. A ledger
// slot that moves with no event behind it moves the drift, never the wallet.
// A spend the wallet cannot cover is REFUSED (kept on the tape as x:1) so the
// balance never goes below zero. The client's coinsNow() shows this number
// plus whatever its outbox still holds, so play stays smooth offline and the
// two agree on every ack. ⚠️ ONE FORMULA, BOTH SIDES: base + earned +
// refunded − spent (banana-pass.js coinsNow is the client's owner).
// ---------- 📏 PER-AREA RULES (2 Sep 2026, slice 3 of the server-side ledger) ----------
// A coins_earned event from a RULED area must name its faucet (`s`) and fit
// that faucet's per-event `max` and per-PERSON `day` (UTC) / `total`
// (lifetime) caps, or it is refused before the wallet (tape row x:1 + r:
// why). The caps a person has used ride every identity answer as `rules`,
// so the client's local cap logic reads the person's state, not the
// device's — that is the per-device → per-person change. `max` values are
// 2× the nominal pay because the homestead buff doubles every grant.
// ⚠️ ADD THE RULE BEFORE THE FAUCET: a named source the table does not know
// is refused ('src'). An UNNAMED event from a ruled area is accepted and
// counted `unruled` while RULES_STRICT is off (tabs on pre-slice JS name
// nothing); flip RULES_STRICT=1 once the desk shows unruled at ~0.
// `deny` = a faucet that must never reach the server wallet (the QA top-up:
// QA devices run on the local ledger, see banana-pass.js pass-wallet-off).
const RULES = {
  homestead: {
    road:   { max: 4,   count: 5 },    // 5 coins on the road, once per person (a count, so the buff cannot double it)
    stall:  { max: 50,  day: 50 },     // the stall pays 25 a day (50 buffed)
    shed:   { max: 400, day: 1200 },   // selling a shed piece back at half price
    dish:   { max: 52,  day: 400 },    // dishes pay 10–26
    knit:   { max: 140, day: 560 },    // beanie 50 / scarf 70
    rehome: { max: 200, day: 600 },    // an animal sold back at its price (cow 90 × the buff)
    quest:  { max: 100, total: 300 },  // Return to Sender wages (15/10/15/20 + a top-up), once per person
    qa:     { deny: 1 },
  },
  // 🏖 the beach — sized from the 2 Sep faucet audit. ⚠️ `window` is the
  // shared world coin (world.js): COIN_PERIOD=60 runs on a SECONDS clock, so
  // a window is 60 s today (the 27 Jul commit meant minutes) — 1440/day × 20
  // × buff; the day cap is deliberately above that ceiling (a design call for
  // Trym, not a rule). `dig` and `bottle` have no local cap either; their max
  // is the real guard until a design cap is chosen.
  beach: {
    window:  { max: 40,  day: 60000 },   // tide coin 5|10|20 per world window (bc-win)
    bottle:  { max: 12,  day: 50000 },   // drift bottle 2-6 on 30% of bottles, one per 22 s
    fishing: { max: 10,  day: 30 },      // bycatch 2-4 + coin catch 2-5, one 15/day device cap (bh-fishcoins-v1) × buff
    dig:     { max: 10,  day: 2100000 }, // loose change 2-5 on 16% of digs, 420 ms throttle, no local cap
    quest:   { max: 30,  count: 1 },     // c1_shelly 15, once ever
    qa:      { deny: 1 },                // ?beachtest top-up, ?cointest windows
  },
  // 🌳 the park — `wish` is the one cap meant to bite: the fountain is
  // net-positive EV per 1-coin toss, so 7000/day stops a grinder after
  // ~40-80 minutes of tapping and touches nobody else.
  park: {
    wish:  { max: 50,  day: 7000 },   // fountain answer: 25 jackpot (3%) or 4-10 (15-25%) per toss
    weed:  { max: 6,   day: 300 },    // roots 1-3 on 8% of pulls; ~360 room weeds a day
    egg:   { max: 80,  day: 3000 },   // the room's verdict: golden 40 / plain 6-12, ~32 lays a day
    quest: { max: 30,  count: 2 },    // c1_peel_memory 15 + c1_peel_tin 10, once ever each
    qa:    { deny: 1 },               // window.__park.coins(n), ?parktest shim weeds/eggs
  },
  // 🎫 the pass page — the questline's finale pays there (bootQuest area 'pass')
  pass: {
    quest: { max: 100, total: 300 },
  },
  // 🪩 the rave — `spot` tapes one coin per lit second (≤35 per appearance)
  rave: {
    window:     { max: 40, day: 60000 },  // the same faucet and bc-win claim as the beach
    spot:       { max: 2,  day: 60000 },  // spotlight 1 coin/s, ≤40 per 35 s appearance, in-memory cap only
    floorquest: { max: 12, day: 600 },    // floor quest 6, one per 30-min slot (rv-fq-slot) × buff
    quest:      { max: 40, count: 1 },    // c1_barty_truth 20, once ever
    qa:         { deny: 1 },              // ?questtest forced completions, ?cointest windows
  },
};
const rulesStrict = (env) => !!(env && String(env.RULES_STRICT || '') === '1');
// 🔁 a refund must look like the spend it undoes: the park's three server
// goods, at their prices, a sane day ceiling — anything else is refused
const REFUNDS = {
  park: { seed: { max: 650, day: 2000 }, border: { max: 3, day: 60 }, birdhouse: { max: 30, day: 300 } },
};
function refundGate(home, row, log) {
  const area = REFUNDS[row.a];
  if (!area) return 'area';
  const rule = row.s && area[row.s];
  if (!rule) return 'src';
  if (row.d > rule.max) return 'max';
  const key = 'refund:' + row.a + ':' + row.s;
  const st = (home.rules || (home.rules = {}))[key] || { d: '', used: 0 };
  const day = utcDay(row.t || Date.now());
  if (st.d !== day) { st.d = day; st.used = 0; }
  if (st.used + row.d > rule.day) return 'day';
  st.used += row.d;
  home.rules[key] = st;
  return null;
}
const utcDay = (t) => new Date(t).toISOString().slice(0, 10);
// the verdict for one earned event: null = fine, else the reason it is refused
function ruleGate(home, row, strict, log) {
  const area = RULES[row.a];
  if (!area) return 'area';                     // deny by default: only a ruled area may mint coins
  if (!row.s) { if (strict) return 'src'; log.unruled = (log.unruled || 0) + 1; return null; }
  const rule = area[row.s];
  if (!rule) return 'src';
  if (rule.deny) return 'deny';
  if (row.d > rule.max) return 'max';
  const st = (home.rules || (home.rules = {}))[row.a + ':' + row.s] || { d: '', used: 0, total: 0, n: 0 };
  // 📅 the day is the EVENT's UTC day, not the push's: a beacon push landing
  // just after midnight must not eat the new day's cap. Two buckets — today
  // and the day before; anything older is history and counts against nothing.
  const day = utcDay(row.t || Date.now());
  if (day > (st.d || '')) { st.pd = st.d || ''; st.pused = st.used || 0; st.d = day; st.used = 0; }
  const bucket = day === st.d ? 'used' : day === (st.pd || '') ? 'pused' : '';
  if (rule.day != null && bucket && (st[bucket] || 0) + row.d > rule.day) return 'day';
  if (rule.total != null && st.total + row.d > rule.total) return 'total';
  if (rule.count != null && (st.n || 0) + 1 > rule.count) return 'total';   // a lifetime NUMBER of payouts
  if (bucket) st[bucket] = (st[bucket] || 0) + row.d;
  st.total += row.d; st.n = (st.n || 0) + 1;
  home.rules[row.a + ':' + row.s] = st;
  return null;
}
const ledgerBalance = (blob) => {
  const p = blob && blob.pass;
  return p ? statTotal(p, 'coins_earned') + statTotal(p, 'coins_refunded') - statTotal(p, 'coins_spent') : 0;
};
const walletBal = (w) => (w ? (w.base || 0) + (w.earned || 0) + (w.refunded || 0) - (w.spent || 0) : 0);
const walletOut = (home) => (home && home.wallet ? { wallet: { bal: walletBal(home.wallet), seq: home.wallet.seq || 0 } } : {});
function tapeIn(home, ev, evDrop, dv, before, after, postBlob, strict, ownFresh, strictOwn) {
  const log = home.log || (home.log = { ev: [], n: 0, seen: [], drop: 0, pushes: 0, unsure: 0, drift: {} });
  log.pushes = (log.pushes || 0) + 1;
  const seen = new Set(log.seen || []);
  const now = Date.now();
  const rows = [];
  for (const e of (Array.isArray(ev) ? ev : []).slice(0, EV_MAX)) {
    if (!e || typeof e !== 'object') continue;
    const id = String(e.id || '');
    const k = String(e.k || '').slice(0, 32);
    const d = +e.d;
    if (!/^[a-f0-9]{6,12}$/.test(id) || seen.has(id) || !k || !Number.isFinite(d) || Math.abs(d) > 1e6) continue;
    if (COIN_KEYS.includes(k) && !(d > 0)) continue;          // coins only ever move by a positive counter
    const row = { id, t: Math.min(+e.t || now, now), k, d, a: String(e.a || '').slice(0, 16), at: now };
    if (e.s) row.s = String(e.s).slice(0, 32);
    if (e.i && /^[a-z0-9_-]{1,40}$/i.test(String(e.i))) row.i = String(e.i);   // 🎩 the item a spend buys
    seen.add(id); log.seen.push(id);
    rows.push(row);
  }
  // 💰 the wallet, from the accepted rows in the order they happened
  const fresh = !home.wallet;
  if (fresh) {
    // the floor = the ledger minus EVERY coin row in this push (accepted or
    // not — a refused row's coins must not survive inside the floor); a record
    // born after the wallet shipped opens at a capped floor, never at a claim
    let explained = 0;
    for (const r of rows) if (COIN_KEYS.includes(r.k)) explained += r.k === 'coins_spent' ? -r.d : r.d;
    let base = ledgerBalance(postBlob) - explained;
    if (home.born) base = Math.min(base, NEW_FLOOR);
    home.wallet = { base, earned: 0, spent: 0, refunded: 0, seq: 0, refused: 0, frozenAt: now };
  }
  const w = home.wallet;
  const sum = {};
  const refuse = (r, why) => { r.x = 1; r.r = why; log.rr = log.rr || {}; log.rr[why] = (log.rr[why] || 0) + 1; };
  const isOwnRow = (k) => k.startsWith('own_') && OWN_IDS_W.includes(k.slice(4));
  for (const r of rows) {
    if (r.k.startsWith('patch:') || isOwnRow(r.k)) continue;   // a client's own_ claim is a row on the tape, never a vote
    if (r.k === 'coins_spent') {
      // 🎩 a purchase: the row names a stand item — judged owned / price / funds, then authored
      const item = r.i && OWN_PRICES[r.i] != null ? r.i : '';
      if (!fresh && item && !ownFresh && statTotal(postBlob && postBlob.pass, 'own_' + item) > 0) { refuse(r, 'owned'); continue; }
      if (!fresh && item && r.d < OWN_PRICES[item]) { refuse(r, 'price'); continue; }
      if (!fresh && walletBal(w) - r.d < 0) { r.x = 1; r.r = 'funds'; w.refused = (w.refused || 0) + 1; continue; }
      if (!item && r.s === 'stand') {   // a stand spend that names nothing (pre-slice JS): counted, refused under OWN_STRICT
        log.ownLegacy = (log.ownLegacy || 0) + 1;
        if (strictOwn) { refuse(r, 'item'); continue; }
      }
      if (item && postBlob) {
        const p = postBlob.pass || (postBlob.pass = { created: now, patches: {}, stats: {}, base: {}, led: {}, days: [] });
        p.base = p.base || {}; p.stats = p.stats || {};
        p.base['own_' + item] = 1; p.stats['own_' + item] = 1;
        r.own = 1;
        home.ownAuth = [...new Set([...(home.ownAuth || []), item])];   // remembered: it crosses a fold
      }
    }
    if (r.k === 'coins_earned') {   // 📏 the faucet's rule — on every push, the freeze push included (its rows are play, not history)
      const why = ruleGate(home, r, strict, log);
      if (why) { refuse(r, why); continue; }
    }
    if (r.k === 'coins_refunded') {   // 🔁 a refund must look like the spend it undoes
      const why = refundGate(home, r, log);
      if (why) { refuse(r, why); continue; }
    }
    if (r.k === 'coins_earned') w.earned += r.d;
    else if (r.k === 'coins_refunded') w.refunded += r.d;
    else if (r.k === 'coins_spent') w.spent += r.d;
    sum[r.k] = (sum[r.k] || 0) + r.d;
  }
  if (rows.length || fresh) { w.seq = (w.seq || 0) + 1; w.at = now; }
  log.ev.push(...rows);
  log.n = (log.n || 0) + rows.length;
  if (log.ev.length > LOG_CAP) log.ev.splice(0, log.ev.length - LOG_CAP);
  if (log.seen.length > SEEN_CAP) log.seen.splice(0, log.seen.length - SEEN_CAP);
  const dropped = Math.max(0, Math.floor(+evDrop || 0));
  if (dropped) { log.drop = (log.drop || 0) + dropped; log.unsure = (log.unsure || 0) + 1; return rows; }
  if (!dv || fresh) return rows;   // the freeze push carries history, not drift
  // the drift: what the slot moved, minus what the tape explains, per key
  // (a refused spend explains nothing, so it shows up here too)
  log.drift = log.drift || {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after), ...Object.keys(sum)]);
  for (const k of keys) {
    if (isOwnRow(k)) continue;   // stand ownership is authored here, never a slot to score
    const moved = (after[k] || 0) - (before[k] || 0);
    const d = moved - (sum[k] || 0);
    if (d) { log.drift[k] = (log.drift[k] || 0) + d; log.driftAt = now; }
  }
  return rows;
}
const driftScore = (log) => (log && log.drift ? DRIFT_KEYS.reduce((t, k) => t + Math.abs(log.drift[k] || 0), 0) : 0);
function blobOk(blob) {
  return blob && typeof blob === 'object' && JSON.stringify(blob).length <= MAX_BLOB;
}

// ---------- POST /anon — a pass with nobody to log in as (yet) ----------
// ⭐ EVERY PLAYER GETS A SERVER PASS at their first meaningful write. Nothing
// changes on screen: no email, no passkey, no prompt. The world gets a stable
// person-id (and a token that proves it) before anybody decides to keep the
// pass, and adding an email or a passkey later ATTACHES to this same home
// (register/mail-use/assert take the device's credentials), so the world id
// never changes underneath a yard. ⚠️ It does NOT survive a wipe — the
// credential lives in the browser like any device token. Only a linked email
// does that, and that ask stays at the investment moment.
const anonHits = new Map();
function anonThrottled(ip) {
  const now = Date.now();
  const rec = anonHits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 3600000) { rec.n = 0; rec.t = now; }
  rec.n++;
  anonHits.set(ip, rec);
  if (anonHits.size > 5000) anonHits.clear();
  return rec.n > 12;
}
async function anon(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  if (anonThrottled(request.headers.get('CF-Connecting-IP') || 'unknown')) return json({ error: 'slow down' }, 429, cors(env, request));
  let b = {};
  try { b = await request.json(); } catch (e) {}
  const blob = b && b.blob;
  if (blob && !blobOk(blob)) return json({ error: 'blob too large' }, 413, cors(env, request));
  const credId = 'a:' + bufToHex(crypto.getRandomValues(new Uint8Array(24)));
  // a brand-new record adopts NO claimed gear (born + ownAt stamped) and its
  // coins open at a capped floor — an unverifiable claim is not a grandfather
  const rec = { anon: 1, tokens: {}, blob: null, born: Date.now(), ownAt: Date.now(), ownFroze: [] };
  rec.blob = takeBlob(rec, blob || null);
  const token = await mintToken(rec);
  await saveRec(env, credId, rec);
  const R = { home: rec, homeKey: await keyFor(credId) };
  return json({ credId, token, ...(await identityOf(env, R)) }, 200, cors(env, request));
}
// 🫧 FOLD an anonymous pass into the pass this device just logged into: its
// blob merges in (nothing lost), the anon record becomes a pointer (its token
// keeps resolving), and its world id is kept as an ALIAS so the yard and the
// plots it claimed follow the person. ⚠️ ONLY anonymous homes fold. A real
// pass arriving on a shared browser is a SWITCH (pass-sync settleAccount),
// never a merge — that is the family-tablet rule and it stays.
async function foldAnon(env, R, fromCredId, fromToken) {
  try {
    if (!fromCredId || !fromToken || !R || !R.home) return false;
    const F = await tokenRec(env, fromCredId, fromToken);
    if (!F || !F.home.anon || F.homeKey !== F.ownKey || F.homeKey === R.homeKey) return false;
    // 🎩 gear crosses the fold only if the anon pass EARNED it here (authored
    // by an accepted purchase) — or froze it in as an old record's history
    const keep = new Set([...(F.home.ownAuth || []), ...(F.home.born ? [] : (F.home.ownFroze || []))]);
    const fb = clientBlob(F.home.blob, true);
    if (fb && fb.pass && typeof fb.pass === 'object') {
      const p = { ...fb.pass };
      for (const f of ['base', 'led', 'stats']) {
        if (!p[f] || typeof p[f] !== 'object') continue;
        const o = { ...p[f] };
        for (const id of OWN_IDS_W) if (!keep.has(id)) delete o['own_' + id];
        p[f] = o;
      }
      fb.pass = p;
    }
    R.home.blob = mergeBlob(R.home.blob, fb);
    // 💰 the coins the anon pass earned and spent here (event-backed, never its
    // frozen floor) follow the person; so do the caps it used and the tape ids
    // it has seen (a re-sent event must still dedupe after the fold)
    if (F.home.wallet && R.home.wallet) {
      const fw = F.home.wallet, rw = R.home.wallet;
      rw.earned += fw.earned || 0; rw.refunded += fw.refunded || 0; rw.spent += fw.spent || 0;
      rw.seq = (rw.seq || 0) + 1; rw.at = Date.now();
    }
    if (F.home.rules) {
      R.home.rules = R.home.rules || {};
      for (const [k, st] of Object.entries(F.home.rules)) {
        const cur = R.home.rules[k];
        if (!cur) { R.home.rules[k] = st; continue; }
        if (cur.d === st.d) cur.used = Math.max(cur.used || 0, st.used || 0);
        else if ((st.d || '') > (cur.d || '')) { cur.pd = cur.d; cur.pused = cur.used || 0; cur.d = st.d; cur.used = st.used || 0; }
        cur.total = (cur.total || 0) + (st.total || 0); cur.n = (cur.n || 0) + (st.n || 0);
      }
    }
    if (F.home.log && Array.isArray(F.home.log.seen) && F.home.log.seen.length) {
      const log = R.home.log || (R.home.log = { ev: [], n: 0, seen: [], drop: 0, pushes: 0, unsure: 0, drift: {} });
      log.seen = [...new Set([...log.seen, ...F.home.log.seen])].slice(-SEEN_CAP);
    }
    if (F.home.ownAuth) R.home.ownAuth = [...new Set([...(R.home.ownAuth || []), ...F.home.ownAuth])];
    const gid = await worldGid(env, F.homeKey);
    R.home.aliases = [...new Set([...(R.home.aliases || []), gid])].slice(-8);
    const ptr = { tokens: F.home.tokens || {}, link: R.homeKey, folded: Date.now() };
    await saveKey(env, F.homeKey, ptr);
    return true;
  } catch (e) { return false; }
}

// ---------- POST /register ----------
async function register(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  const { credId, pk, alg, clientDataJSON, blob } = b || {};
  if (!credId || !pk || !clientDataJSON || ![-7, -257].includes(alg)) return json({ error: 'bad register' }, 400, cors(env, request));
  // ⚠️ 'm:' is the EMAIL namespace — a WebAuthn path must never mint or claim
  // a key in it, or the two rails could be made to collide
  if (String(credId).startsWith('m:')) return json({ error: 'bad register' }, 400, cors(env, request));
  if (!(await challengeOk(env, clientDataJSON))) return json({ error: 'stale challenge' }, 400, cors(env, request));
  if (blob && !blobOk(blob)) return json({ error: 'blob too large' }, 413, cors(env, request));

  const existing = await loadRec(env, credId);
  if (existing && existing.pk !== pk) return json({ error: 'credential exists' }, 409, cors(env, request));
  // ⚠️ RE-REGISTERING AN ALREADY-LINKED DEVICE must merge into its HOME, not
  // onto the pointer. Writing a blob onto a pointer record creates a second,
  // orphaned copy that resolve() never reads — the save would look like it
  // worked and the data would be gone.
  if (existing && existing.link) {
    const R = await resolve(env, credId);
    if (R) {
      R.home.blob = takeBlob(R.home, blob);
      const tk = await mintToken(R.own);
      await saveKey(env, R.ownKey, R.own);
      await saveKey(env, R.homeKey, R.home);
      return json({ token: tk }, 200, cors(env, request));
    }
  }
  // 🫧 a passkey made on a device that already holds an ANONYMOUS pass joins
  // that pass instead of starting a second one: the new credential is a
  // pointer, the home (and its world id) stays exactly what the yard is keyed to
  if (!existing && b.fromCredId && b.fromToken) {
    const F = await tokenRec(env, b.fromCredId, b.fromToken);
    if (F && F.home.anon && F.homeKey === F.ownKey) {
      F.home.blob = takeBlob(F.home, blob);
      const ptr = { pk, alg, tokens: {}, link: F.homeKey };
      const tk = await mintToken(ptr);
      await saveKey(env, F.homeKey, F.home);
      await saveRec(env, credId, ptr);
      return json({ token: tk, joined: true }, 200, cors(env, request));
    }
  }
  const rec = existing || { pk, alg, tokens: {}, blob: null, born: Date.now(), ownAt: Date.now(), ownFroze: [] };
  rec.blob = takeBlob(rec, blob);
  const token = await mintToken(rec);
  await saveRec(env, credId, rec);
  return json({ token }, 200, cors(env, request));
}

// ---------- POST /assert — link another device ----------
async function assert_(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  const { credId, clientDataJSON, authenticatorData, signature, blob } = b || {};
  if (!credId || !clientDataJSON || !authenticatorData || !signature) return json({ error: 'bad assert' }, 400, cors(env, request));
  if (!(await challengeOk(env, clientDataJSON))) return json({ error: 'stale challenge' }, 400, cors(env, request));

  const R = await resolve(env, credId);
  if (!R) return json({ error: 'unknown pass' }, 404, cors(env, request));
  const rec = R.own;                       // ← the KEY is always the credential's own
  // ⚠️ an EMAIL identity has no public key — it can never satisfy a WebAuthn
  // assertion, and must be refused explicitly rather than fall through the
  // verify below on an undefined key
  if (!rec.pk) return json({ error: 'wrong rail' }, 400, cors(env, request));

  // signedData = authenticatorData || SHA-256(clientDataJSON)
  const authData = b64uToBuf(authenticatorData);
  const cdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', b64uToBuf(clientDataJSON)));
  const signed = new Uint8Array(authData.length + cdHash.length);
  signed.set(authData, 0);
  signed.set(cdHash, authData.length);

  let ok = false;
  const sig = b64uToBuf(signature);
  if (rec.alg === -7) {
    const key = await crypto.subtle.importKey('spki', b64uToBuf(rec.pk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sig), signed);
  } else {
    const key = await crypto.subtle.importKey('spki', b64uToBuf(rec.pk), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signed);
  }
  if (!ok) return json({ error: 'bad signature' }, 403, cors(env, request));

  // …but the BLOB lives on the home record, which may be another device's
  if (blob && blobOk(blob)) R.home.blob = takeBlob(R.home, blob);
  const folded = await foldAnon(env, R, b.fromCredId, b.fromToken);
  const token = await mintToken(rec);
  await saveKey(env, R.ownKey, rec);
  if (R.homeKey !== R.ownKey || folded) await saveKey(env, R.homeKey, R.home);
  return json({ token, blob: R.home.blob, folded, ...(await identityOf(env, R)) }, 200, cors(env, request));
}

// WebAuthn ECDSA signatures are DER; WebCrypto wants raw r||s (32+32)
function derToRaw(der) {
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;
  if (der[i] !== 0x02) throw new Error('bad der');
  let rLen = der[i + 1];
  let r = der.slice(i + 2, i + 2 + rLen);
  i = i + 2 + rLen;
  if (der[i] !== 0x02) throw new Error('bad der');
  let sLen = der[i + 1];
  let s = der.slice(i + 2, i + 2 + sLen);
  const strip = (x) => { while (x.length > 32 && x[0] === 0) x = x.slice(1); return x; };
  r = strip(r); s = strip(s);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

// ---------- ✉️ THE EMAIL RAIL — the only thing that survives a dead device ----
// Device linking only helps while the OLD device still works. An address is
// what makes a pass outlive the hardware, and a magic link is simpler than a
// password for everyone: nothing to remember, nothing for us to store, no
// device story to explain.
// ⚠️ NO PASSWORDS, EVER — not as a fallback. Two rails is two attack surfaces.
// ⚠️ NO ACCOUNT ENUMERATION: /mail/signin answers the same whether or not the
// address is known. The inbox is the only channel that differs.
// ⚠️ GDPR: the address is the ONLY personal datum stored, it is for sign-in
// alone (never a mailing list), and it must stay deletable. See banana-id-plan.
const MAIL_TTL = 15 * 60 * 1000;
// ⚠️ THE QUOTA IS THE ATTACK SURFACE. Resend's free tier allows 100 mails a
// DAY, so without these one bot could burn the lot in a minute and lock every
// real login out until midnight. The generic 30/min IP throttle does not help:
// a hundred addresses from one script is a hundred legitimate-looking requests.
const MAIL_COOLDOWN = 2 * 60 * 1000;   // one link per address per 2 min
const MAIL_DAILY_CAP = 90;             // ⚠️ deliberately UNDER the provider's 100

const MAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
const normMail = (e) => String(e || '').trim().toLowerCase();

// 🍌 THE LOGIN MAIL — it is the only piece of the world that arrives somewhere
// we do not control, so it has to carry the brand on its own.
// ⚠️ TABLES AND INLINE STYLES ON PURPOSE. Mail clients are not browsers: no
// stylesheets, no flex/grid, no external CSS. This looks like 2003 markup
// because that is what survives Gmail, Outlook and Apple Mail alike.
// ⚠️ IT MUST READ FINE WITH IMAGES OFF — most clients block them by default,
// so the banana is decoration with alt text and never the message.
// ⚠️ AND THE PLAIN-TEXT PART STAYS. A mail with no text/plain alternative
// looks like spam to filters, and the raw URL is the fallback when a button
// cannot be tapped.
const mailHtml = (link, c = {}) => `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#fdf9ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdf9ec;">
<tr><td align="center" style="padding:26px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;background:#ffe135;border:4px solid #111111;">
    <tr><td style="background:#111111;color:#ffe135;padding:9px 16px;font:bold 11px Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;">&#9733; Banana World</td></tr>
    <tr><td align="center" style="padding:22px 24px 0;">
      <img src="https://trymstene.com/assets/dancing-banana-transparent.gif" width="88" height="88" alt="" style="display:block;border:0;">
    </td></tr>
    <tr><td align="center" style="padding:14px 24px 0;font:bold 23px/1.2 Arial,Helvetica,sans-serif;color:#111111;">${c.head || 'Here&rsquo;s your way in'}</td></tr>
    <tr><td align="center" style="padding:8px 24px 0;font:15px/1.5 Arial,Helvetica,sans-serif;color:#111111;">${c.line || 'Tap the button and you&rsquo;re logged in &mdash; no password needed.'}</td></tr>
    ${c.list ? `<tr><td align="center" style="padding:12px 24px 0;font:bold 13px/1.9 Arial,Helvetica,sans-serif;color:#111111;">${c.list}</td></tr>` : ''}
    <tr><td align="center" style="padding:20px 24px 2px;">
      <a href="${link}" style="display:inline-block;background:#111111;color:#ffe135;font:bold 16px Arial,Helvetica,sans-serif;padding:15px 28px;text-decoration:none;">${c.cta || 'Log me in &rarr;'}</a>
    </td></tr>
    <tr><td align="center" style="padding:16px 24px 22px;font:12px/1.55 Arial,Helvetica,sans-serif;color:#4a4326;">
      ${c.foot || 'Works once, for 15 minutes.<br>Did not ask for this? Ignore it &mdash; nothing happens.'}
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;">
    <tr><td style="padding:14px 4px 0;font:11px/1.6 Arial,Helvetica,sans-serif;color:#777777;">
      Button not working? Paste this into your browser:<br>
      <span style="word-break:break-all;color:#777777;">${link}</span>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

// the sender is pluggable and FAILS CLOSED — no key, no mail, no pretending
async function sendLink(env, to, link, copy) {
  if (!env.RESEND_KEY || !env.MAIL_FROM) return { ok: false, why: 'not configured' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      // ⚠️ hello@send.… is a SENDING address with no mailbox behind it, so a
      // reply would bounce. MAIL_REPLY (optional) points replies at a real
      // inbox — people DO reply to login mail, usually to ask for help.
      ...(env.MAIL_REPLY ? { reply_to: env.MAIL_REPLY } : {}),
      to: [to],
      // the subject names the thing they just pressed, so it is findable in a
      // busy inbox and obviously not marketing
      subject: (copy && copy.subject) || 'Log in to Banana World',
      html: mailHtml(link, copy),
      text: (copy && copy.text) || (`Tap to log in:\n\n${link}\n\nThe link works once and expires in 15 minutes.\n`
        + `Did not ask for this? Ignore it — nothing happens.\n`),
    }),
  });
  if (!res.ok) {
    // ⚠️ A SILENT SEND FAILURE IS THE WORST OUTCOME HERE: the caller is told
    // "check your inbox" (it must be, to stay non-enumerating) and nothing ever
    // arrives. The provider's reason has to reach the logs or the only symptom
    // is a user who cannot log in and no way to find out why. `wrangler tail`.
    const why = await res.text().catch(() => '');
    console.error('mail send failed', res.status, why.slice(0, 300));
    return { ok: false, why: 'send failed' };
  }
  return { ok: true, why: '' };
}

// POST /mail/signin { email } → always { ok: true }
async function mailSignin(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  const email = normMail(b && b.email);
  if (!MAIL_RE.test(email) || email.length > 160) {
    return json({ error: 'bad email' }, 400, cors(env, request));
  }
  if (!env.RESEND_KEY || !env.MAIL_FROM) {
    return json({ error: 'email not configured' }, 503, cors(env, request));
  }
  // ⚠️ the cooldown answers ok:true and simply does not send — telling the
  // caller "too soon" would confirm the address exists in a request that is
  // otherwise carefully non-enumerating, and the user already has their link.
  const cdKey = `mailcd/${await sha256Hex(email)}.json`;
  const cdObj = await env.PASSES.get(cdKey);
  if (cdObj) {
    const cd = await cdObj.json().catch(() => null);
    if (cd && Date.now() - cd.at < MAIL_COOLDOWN) return json({ ok: true }, 200, cors(env, request));
  }
  // the day's budget. ⚠️ read-modify-write on R2 is not atomic, so this drifts
  // by a few under load — which is exactly why the cap sits under the real one
  // rather than on it. It is a budget, not a lock.
  const dayKey = `mailday/${new Date().toISOString().slice(0, 10)}.json`;
  const dayObj = await env.PASSES.get(dayKey);
  const day = dayObj ? await dayObj.json().catch(() => ({ n: 0 })) : { n: 0 };
  if ((day.n || 0) >= MAIL_DAILY_CAP) {
    // ⚠️ a DISTINCT error, so the page can say something true instead of
    // "check your inbox" for a mail that is never coming
    return json({ error: 'daily limit' }, 429, cors(env, request));
  }

  const tok = bufToHex(crypto.getRandomValues(new Uint8Array(32)));
  // ⚠️ THE TICKET STORES THE DERIVED KEY, NOT THE ADDRESS. A ticket that is
  // never clicked is never deleted, so a plaintext address in here would be a
  // plaintext address at rest forever. The key is all /mail/use ever needed —
  // which means the site stores NO email addresses anywhere. Nothing to leak,
  // nothing to enumerate, and no deletion desk to build ([[banana-id-plan]] §5).
  await env.PASSES.put(`mailtkt/${await sha256Hex(tok)}.json`,
    JSON.stringify({ k: 'm' + (await sha256Hex(email)), exp: Date.now() + MAIL_TTL }),
    { httpMetadata: { contentType: 'application/json' } });
  const base = (env.ALLOWED_ORIGIN || '').split(',')[0].trim() || 'https://trymstene.com';
  const sent = await sendLink(env, email, `${base}/pass/?in=${tok}`);
  if (sent.ok) {                       // only a mail that LEFT costs budget
    await env.PASSES.put(dayKey, JSON.stringify({ n: (day.n || 0) + 1 }),
      { httpMetadata: { contentType: 'application/json' } });
    await env.PASSES.put(cdKey, JSON.stringify({ at: Date.now() }),
      { httpMetadata: { contentType: 'application/json' } });
  }
  // ⚠️ the SAME answer either way — never confirm whether an address is known
  return json({ ok: true }, 200, cors(env, request));
}

// GET /mail/use?t=…[&credId=…&token=…] → { credId, token, blob, attached }
// A known address resolves like any other credential. A NEW one either becomes
// a pass of its own, or — if the click comes from a device that already owns
// one — ATTACHES to that pass as a pointer.
// ⭐ ONE LINK, BOTH MEANINGS. "Log in" and "add my email" are the same journey
// (type address → click link), so they are the same endpoint. Without this an
// existing player who typed their address got a SECOND, empty pass and their
// real one was orphaned — the copy-not-a-pointer mistake [[banana-id-plan]] §2
// exists to prevent.
// ⚠️ BOTH HALVES ARE PROVEN BEFORE ANYTHING ATTACHES: the device token proves
// they hold the pass, and clicking the mailed link proves they hold the inbox.
// Either one alone must never be enough.
// ⚠️ AN ADDRESS THAT ALREADY EXISTS IS NEVER RE-POINTED. It simply logs in.
// Silently moving a live address onto whatever pass happens to be open in the
// browser would be a takeover dressed up as a convenience.
async function mailUse(request, env, url) {
  const bad = guard(env, request);
  if (bad) return bad;
  const t = url.searchParams.get('t') || '';
  if (!t) return json({ error: 'bad link' }, 400, cors(env, request));
  const tk = `mailtkt/${await sha256Hex(t)}.json`;
  const obj = await env.PASSES.get(tk);
  if (!obj) return json({ error: 'used or unknown' }, 404, cors(env, request));
  const ticket = await obj.json();
  await env.PASSES.delete(tk);                       // single use, always
  if (!ticket || ticket.exp < Date.now()) return json({ error: 'link expired' }, 410, cors(env, request));

  // `ticket.email` is the pre-hardening shape — honoured so links already in
  // somebody's inbox still work, and removable once they have all expired
  const key = ticket.k || (ticket.email ? 'm' + (await sha256Hex(ticket.email)) : '');
  if (!key) return json({ error: 'bad link' }, 400, cors(env, request));
  const credId = 'm:' + key;
  let rec = await loadKey(env, key);
  let attached = false;
  if (!rec) {
    const claim = await tokenRec(env, url.searchParams.get('credId'), url.searchParams.get('token'));
    if (claim) {
      rec = { mail: 1, tokens: {}, link: claim.homeKey };  // ← a pointer, not a copy
      attached = true;
    } else {
      rec = { mail: 1, tokens: {}, blob: null };           // a brand-new pass
    }
  }
  const token = await mintToken(rec);
  await saveKey(env, key, rec);
  const R = await resolve(env, credId);
  // 🫧 a KNOWN address arriving on a device that holds an anonymous pass:
  // that world folds into this one (see foldAnon) instead of being left behind
  const folded = !attached && R && R.home
    ? await foldAnon(env, R, url.searchParams.get('credId'), url.searchParams.get('token')) : false;
  if (folded) await saveKey(env, R.homeKey, R.home);
  // ☕ a Ko-fi membership bought BEFORE this pass first logged in has been
  // waiting in the member store — it lands the moment the email rail proves
  // the address (key = 'm' + emailHash, so the hash is right here)
  try {
    const m = ((await readJson(env, 'kofi/members.json')) || {})[key.slice(1)];
    if (m && m.until > Date.now() && R && R.home) {
      R.home.blob = mergeBlob(R.home.blob, { member: { t: m.t, until: m.until } });
      // ⚠️ the ids come across too. Without this the member has a hat but no
      // way to take it off from our own page — deliverGrant is not the only
      // door a membership arrives through, and a cancel button that only works
      // for people who happened to log in first is not a cancel button.
      if (m.sub) R.home.polar = { ...(R.home.polar || {}), sub: m.sub, cust: m.cust || '', at: Date.now() };
      await saveKey(env, R.homeKey, R.home);
    }
  } catch (e) {}
  const blobOut = (R && R.home.blob) || rec.blob || null;
  return json({ credId, token, attached, folded, blob: blobOut,
    ...(R ? await identityOf(env, R) : { memberToken: await mintMemberToken(env, (blobOut || {}).member) }) },
    200, cors(env, request));
}

// ---------- 📣 THE NEWS LIST — a SECOND rail, never the login one ----------
// ⚠️ THE LOGIN ADDRESSES ARE NOT AVAILABLE FOR THIS AND MUST NEVER BECOME SO.
// They are stored one-way hashed, they were given for authentication, and the
// privacy page promises in Trym's own words that they are not a mailing list.
// Marketing needs its OWN freely-given consent, so this is its own opt-in with
// its own store — the contacts live in a Resend AUDIENCE, which means the
// plaintext sits with the processor (not in our bucket) and the legally
// required one-click unsubscribe is theirs to honour, not ours to build.
// ⚠️ DOUBLE OPT-IN, NOT BECAUSE IT IS NICE: anyone can type anyone's address
// into a box. The confirm click is what proves the inbox belongs to the person
// consenting — and it is the record that consent existed at all.
// ⚠️ LOGIN OUTRANKS NEWS ON THE SHARED QUOTA. Both rails spend the same 100
// mails/day, and a login link that never arrives locks somebody out of their
// own pass, while a late newsletter confirmation costs nothing. News stops at
// NEWS_CEILING so there is always headroom left for people getting in.
const NEWS_TTL = 24 * 60 * 60 * 1000;   // a day to click; this is not urgent
const NEWS_CEILING = 60;                // …of the day's 100, leaving 40 for logins

// ⚠️ THE SCOPE IS THE CONSENT. Whatever this mail promises is the whole of what
// may ever be sent — "new areas only" here would make a later merch mail
// something nobody agreed to. So the list names every kind of mail up front,
// merch included, and it is a LIST rather than a paragraph: five promises in
// the space prose spends on one ([[copy-cro-doctrine]]).
async function newsSend(env, to, link) {
  return sendLink(env, to, link, {
    subject: 'One click and you are on the list',
    head: 'Confirm the updates',
    line: 'Tap once and I&rsquo;ll write when Banana World gets bigger:',
    list: '🌍 new areas &nbsp;·&nbsp; ✨ new features<br>🎁 items &amp; wearables &nbsp;·&nbsp; 🔧 fixes<br>🛒 the odd bit of new merch',
    cta: 'Yes, keep me posted &rarr;',
    foot: 'No schedule, no spam &mdash; and one click unsubscribes.<br>'
      + 'Didn&rsquo;t ask for this? Ignore it &mdash; without this click you&rsquo;re on no list.',
    text: `Confirm you want updates from Banana World:\n\n${link}\n\n`
      + `New areas, new features, items and wearables, fixes, and the odd bit of\n`
      + `new merch. No schedule, and one click unsubscribes.\n\n`
      + `Without this click you are not on any list. The link lasts a day.\n`,
  });
}

// POST /news/join { email } → always { ok: true } (never confirms who is known)
async function newsJoin(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  const email = normMail(b && b.email);
  if (!MAIL_RE.test(email) || email.length > 160) return json({ error: 'bad email' }, 400, cors(env, request));
  if (!env.RESEND_KEY || !env.MAIL_FROM || !env.NEWS_OPEN) {
    return json({ error: 'news not configured' }, 503, cors(env, request));
  }
  const cdKey = `newscd/${await sha256Hex(email)}.json`;
  const cdObj = await env.PASSES.get(cdKey);
  if (cdObj) {
    const cd = await cdObj.json().catch(() => null);
    if (cd && Date.now() - cd.at < MAIL_COOLDOWN) return json({ ok: true }, 200, cors(env, request));
  }
  const dayKey = `mailday/${new Date().toISOString().slice(0, 10)}.json`;
  const dayObj = await env.PASSES.get(dayKey);
  const day = dayObj ? await dayObj.json().catch(() => ({ n: 0 })) : { n: 0 };
  if ((day.n || 0) >= NEWS_CEILING) {
    return json({ error: 'busy day' }, 429, cors(env, request));   // ← logins keep the rest
  }
  const tok = bufToHex(crypto.getRandomValues(new Uint8Array(32)));
  // ⚠️ the ticket holds the ADDRESS, unlike a login ticket, because the whole
  // point is to hand it to Resend on confirmation. It is deleted on the click,
  // and swept if never clicked (see the TTL check in newsConfirm).
  await env.PASSES.put(`newstkt/${await sha256Hex(tok)}.json`,
    JSON.stringify({ email, exp: Date.now() + NEWS_TTL }),
    { httpMetadata: { contentType: 'application/json' } });
  const base = (env.ALLOWED_ORIGIN || '').split(',')[0].trim() || 'https://trymstene.com';
  const sent = await newsSend(env, email, `${base}/pass/?news=${tok}`);
  if (sent.ok) {
    await env.PASSES.put(dayKey, JSON.stringify({ n: (day.n || 0) + 1 }),
      { httpMetadata: { contentType: 'application/json' } });
    await env.PASSES.put(cdKey, JSON.stringify({ at: Date.now() }),
      { httpMetadata: { contentType: 'application/json' } });
  }
  return json({ ok: true }, 200, cors(env, request));
}

// GET /news/confirm?t=… → the click that actually creates the subscription
async function newsConfirm(request, env, url) {
  const bad = guard(env, request);
  if (bad) return bad;
  const t = url.searchParams.get('t') || '';
  if (!t) return json({ error: 'bad link' }, 400, cors(env, request));
  const tk = `newstkt/${await sha256Hex(t)}.json`;
  const obj = await env.PASSES.get(tk);
  if (!obj) return json({ error: 'used or unknown' }, 404, cors(env, request));
  const ticket = await obj.json();
  await env.PASSES.delete(tk);
  if (!ticket || ticket.exp < Date.now()) return json({ error: 'link expired' }, 410, cors(env, request));

  // ⚠️ ACCOUNT-LEVEL CONTACTS, NOT AN AUDIENCE. Resend has deprecated Audiences
  // in favour of Segments, and there is no "create an audience" step in the
  // dashboard any more — contacts simply belong to the account. So there is no
  // id to configure and nothing to paste wrong. Segments/Topics can slice the
  // list later without changing anything here.
  const res = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ticket.email, unsubscribed: false }),
  });
  if (!res.ok) {
    const why = await res.text().catch(() => '');
    console.error('news subscribe failed', res.status, why.slice(0, 300));
    return json({ error: 'could not subscribe' }, 502, cors(env, request));
  }
  // ⚠️ THE CONSENT RECEIPT. GDPR asks you to SHOW consent was given, not just
  // assert it: when, and by what route. Keyed by hash so this record cannot
  // itself become a second copy of the mailing list.
  await env.PASSES.put(`newsok/${await sha256Hex(ticket.email)}.json`,
    JSON.stringify({ at: Date.now(), how: 'double opt-in click', src: 'pass' }),
    { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true }, 200, cors(env, request));
}

// ---------- 🔗 LINK ANOTHER DEVICE ----------------------------------------
// A pass used to belong to a PASSKEY, not to a person: save it to Windows Hello
// and it was stranded on that PC forever, which is exactly what a player wrote
// in about. Now the device that already works can invite another one.
//
// ⚠️ WHAT THIS IS NOT: a "reset my passkey". With no second factor, a reset
// anyone can trigger is an account-takeover switch — name a pass, claim a pass.
// The invite has to START on a device that can already prove it owns the pass.
// ⚠️ The code is short-lived, single-use, and deleted the moment it is spent.
// Guessing it means beating 32^8 through a 30-req/min IP throttle.
const LINK_TTL = 10 * 60 * 1000;
const LINK_ALPHABET = '234679ACDEFGHJKLMNPQRTUVWXYZ';   // no 0/O/1/I/5/S/8/B
function linkCode() {
  const r = crypto.getRandomValues(new Uint8Array(8));
  return [...r].map((b) => LINK_ALPHABET[b % LINK_ALPHABET.length]).join('');
}

// POST /link/start { credId, token } → { code, mins }
async function linkStart(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  const R = await tokenRec(env, b.credId, b.token);
  if (!R) return json({ error: 'not linked' }, 403, cors(env, request));
  const code = linkCode();
  await env.PASSES.put(`link/${await sha256Hex(code)}.json`,
    JSON.stringify({ home: R.homeKey, exp: Date.now() + LINK_TTL }),
    { httpMetadata: { contentType: 'application/json' } });
  return json({ code, mins: Math.round(LINK_TTL / 60000) }, 200, cors(env, request));
}

// POST /link/finish { code, credId, pk, alg, clientDataJSON } → { token, blob }
// The new device has just CREATED its own passkey; we file it as a pointer at
// the inviting pass. It never receives the other device's key — only the blob.
async function linkFinish(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  const { code, credId, pk, alg, clientDataJSON } = b || {};
  if (!code || !credId || !pk || !clientDataJSON || ![-7, -257].includes(alg)
      || String(credId).startsWith('m:')) {          // ⚠️ never the email namespace
    return json({ error: 'bad link' }, 400, cors(env, request));
  }
  if (!(await challengeOk(env, clientDataJSON))) return json({ error: 'stale challenge' }, 400, cors(env, request));
  const ticketKey = `link/${await sha256Hex(String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''))}.json`;
  const obj = await env.PASSES.get(ticketKey);
  if (!obj) return json({ error: 'bad code' }, 404, cors(env, request));
  const ticket = await obj.json();
  await env.PASSES.delete(ticketKey);                       // single use, always
  if (!ticket || ticket.exp < Date.now()) return json({ error: 'code expired' }, 410, cors(env, request));
  const home = await loadKey(env, ticket.home);
  if (!home || home.link) return json({ error: 'bad code' }, 404, cors(env, request));

  const ownKey = await sha256Hex(credId);
  if (ownKey === ticket.home) return json({ error: 'same device' }, 409, cors(env, request));
  const existing = await loadKey(env, ownKey);
  if (existing && existing.pk !== pk) return json({ error: 'credential exists' }, 409, cors(env, request));
  const rec = existing || { pk, alg, tokens: {} };
  rec.link = ticket.home;                                   // ← a pointer, not a copy
  delete rec.blob;                                          // the home record owns it
  const token = await mintToken(rec);
  await saveKey(env, ownKey, rec);
  const R = { home, homeKey: ticket.home };
  const folded = await foldAnon(env, R, b.fromCredId, b.fromToken);
  if (folded) await saveKey(env, ticket.home, home);
  return json({ token, blob: home.blob, folded, ...(await identityOf(env, R)) }, 200, cors(env, request));
}

// ---------- token-auth sync (no biometrics day-to-day) ----------
// the token proves THIS credential; the blob it unlocks may live elsewhere
async function tokenRec(env, credId, token) {
  if (!credId || !token) return null;
  const R = await resolve(env, credId);
  if (!R || !R.own.tokens || !R.own.tokens[await sha256Hex(token)]) return null;
  return R;
}

async function push(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  const R = await tokenRec(env, b.credId, b.token);
  if (!R) return json({ error: 'not linked' }, 403, cors(env, request));
  if (!blobOk(b.blob)) return json({ error: 'bad blob' }, 400, cors(env, request));
  // 📜 the pushing device's own slots, before and after the merge
  const dv = /^[\w-]{1,8}$/.test(String(b.blob.evDev || '')) ? String(b.blob.evDev) : '';
  const before = slotsOf(R.home.blob, dv);
  const ownFresh = !R.home.ownAt && !!R.home.blob;
  R.home.blob = takeBlob(R.home, b.blob);
  const rows = tapeIn(R.home, b.blob.ev, b.blob.evDrop, dv, before, slotsOf(R.home.blob, dv), R.home.blob, rulesStrict(env), ownFresh, ownStrict(env)) || [];
  await saveKey(env, R.homeKey, R.home);
  const nak = rows.filter((r) => r.x && r.i).map((r) => ({ id: r.id, i: r.i, r: r.r }));
  return json({ ok: true, ...(await identityOf(env, R)), ...(nak.length ? { nak } : {}) }, 200, cors(env, request));
}

async function pull(request, env, url) {
  const bad = guard(env, request);
  if (bad) return bad;
  const R = await tokenRec(env, url.searchParams.get('credId'), url.searchParams.get('token'));
  if (!R) return json({ error: 'not linked' }, 403, cors(env, request));
  return json({ blob: R.home.blob, updated: R.home.updated, ...(await identityOf(env, R)) }, 200, cors(env, request));
}
