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
      if (url.pathname === '/link/start') return linkStart(request, env);
      if (url.pathname === '/link/finish') return linkFinish(request, env);
      if (url.pathname === '/push') return push(request, env);
      if (url.pathname === '/pull') return pull(request, env, url);
      if (url.pathname === '/admin/ledger') return adminLedger(request, env, url);
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
function mergeBlob(oldB, newB) {
  if (!oldB) return newB;
  if (!newB) return oldB;
  const out = { ...oldB, ...newB };
  const op = oldB.pass || {}, np = newB.pass || {};
  const patches = { ...(op.patches || {}) };
  for (const [id, ts] of Object.entries(np.patches || {})) patches[id] = Math.min(patches[id] || ts, ts);
  const stats = { ...(op.stats || {}) };
  for (const [k, v] of Object.entries(np.stats || {})) stats[k] = Math.max(stats[k] || 0, v);
  const days = [...new Set([...(op.days || []), ...(np.days || [])])].sort().slice(-400);
  out.pass = {
    created: Math.min(op.created || Date.now(), np.created || Date.now()),
    patches, stats, days,
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
  if (!newB.bbLast && oldB.bbLast) out.bbLast = oldB.bbLast; // a fresh device must never erase the signature banana
  if (!newB.name && oldB.name) out.name = oldB.name; // …nor the name written on the pass
  return out;
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
async function adminLedger(request, env, url) {
  const key = url.searchParams.get('key') || '';
  if (!env.PASS_ADMIN_KEY || key !== env.PASS_ADMIN_KEY) {
    return new Response('not found', { status: 404 });
  }
  const list = await env.PASSES.list({ prefix: 'pass/', limit: 500 });
  const passes = [];
  for (const o of list.objects.slice(0, 100)) { // cost cap: 100 reads/call
    let rec = null;
    try { rec = await (await env.PASSES.get(o.key)).json(); } catch (e) { continue; }
    if (!rec) continue;
    if (rec.link) continue;   // a linked device is not its own pass — one row per PASS
    const blob = rec.blob || {};
    const stats = (blob.pass && blob.pass.stats) || {};
    const gear = Object.keys(stats).filter((k) => k.startsWith('own_') && stats[k] > 0).map((k) => k.slice(4));
    passes.push({
      id: o.key.slice(5, 13), // stable pseudo-id (hash prefix) — never the credId
      name: (blob.name || '').slice(0, 24),
      updated: rec.updated || 0,
      devices: Object.keys(rec.tokens || {}).length,
      created: (blob.pass && blob.pass.created) || 0,
      days: ((blob.pass && blob.pass.days) || []).length,
      badges: Object.keys((blob.pass && blob.pass.patches) || {}).length,
      shelf: (blob.shelf || []).length,
      rep: stats.rep || 0,
      jelly: stats.jelly || 0,
      coinsEarned: stats.coins_earned || 0,
      coinsSpent: stats.coins_spent || 0,
      gear,
      glow: blob.glow === '1',
    });
  }
  passes.sort((a, b) => b.updated - a.updated);
  return json({ total: list.objects.length, truncated: !!list.truncated, passes }, 200, {
    ...cors(env, request),
    'Cache-Control': 'no-store',
  });
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
function blobOk(blob) {
  return blob && typeof blob === 'object' && JSON.stringify(blob).length <= MAX_BLOB;
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
      R.home.blob = mergeBlob(R.home.blob, blob || null);
      const tk = await mintToken(R.own);
      await saveKey(env, R.ownKey, R.own);
      await saveKey(env, R.homeKey, R.home);
      return json({ token: tk }, 200, cors(env, request));
    }
  }
  const rec = existing || { pk, alg, tokens: {}, blob: null };
  rec.blob = mergeBlob(rec.blob, blob || null);
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
  if (blob && blobOk(blob)) R.home.blob = mergeBlob(R.home.blob, blob);
  const token = await mintToken(rec);
  await saveKey(env, R.ownKey, rec);
  if (R.homeKey !== R.ownKey) await saveKey(env, R.homeKey, R.home);
  return json({ token, blob: R.home.blob }, 200, cors(env, request));
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

// the sender is pluggable and FAILS CLOSED — no key, no mail, no pretending
async function sendLink(env, to, link) {
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
      subject: 'Your link into Banana World',
      text: `Tap to log in:\n\n${link}\n\nThe link works once and expires in 15 minutes.\n`
        + `Did not ask for this? Ignore it — nothing happens.\n`,
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

// GET /mail/use?t=… → { credId, token, blob }
// A first-time address BECOMES a pass (the record is its own primary); a known
// one resolves like any other credential — including through a pointer if this
// address was claimed by an existing passkey pass.
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
  if (!rec) rec = { mail: 1, tokens: {}, blob: null };   // a brand-new pass
  const token = await mintToken(rec);
  await saveKey(env, key, rec);
  const R = await resolve(env, credId);
  return json({ credId, token, blob: (R && R.home.blob) || rec.blob || null },
    200, cors(env, request));
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
  return json({ token, blob: home.blob }, 200, cors(env, request));
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
  R.home.blob = mergeBlob(R.home.blob, b.blob);
  await saveKey(env, R.homeKey, R.home);
  return json({ ok: true }, 200, cors(env, request));
}

async function pull(request, env, url) {
  const bad = guard(env, request);
  if (bad) return bad;
  const R = await tokenRec(env, url.searchParams.get('credId'), url.searchParams.get('token'));
  if (!R) return json({ error: 'not linked' }, 403, cors(env, request));
  return json({ blob: R.home.blob, updated: R.home.updated }, 200, cors(env, request));
}
