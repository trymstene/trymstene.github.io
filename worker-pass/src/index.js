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
      if (url.pathname === '/push') return push(request, env);
      if (url.pathname === '/pull') return pull(request, env, url);
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
  const seen = new Set();
  out.shelf = [...(newB.shelf || []), ...(oldB.shelf || [])]
    .filter((c) => c && c.params && !seen.has(c.params) && seen.add(c.params))
    .slice(0, 24);
  if (oldB.glow === '1' || newB.glow === '1') out.glow = '1';
  if (!newB.bbLast && oldB.bbLast) out.bbLast = oldB.bbLast; // a fresh device must never erase the signature banana
  if (!newB.name && oldB.name) out.name = oldB.name; // …nor the name written on the pass
  return out;
}

async function loadRec(env, credId) {
  const obj = await env.PASSES.get(`pass/${await sha256Hex(credId)}.json`);
  return obj ? await obj.json() : null;
}
async function saveRec(env, credId, rec) {
  rec.updated = Date.now();
  await env.PASSES.put(`pass/${await sha256Hex(credId)}.json`, JSON.stringify(rec), {
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
  if (!(await challengeOk(env, clientDataJSON))) return json({ error: 'stale challenge' }, 400, cors(env, request));
  if (blob && !blobOk(blob)) return json({ error: 'blob too large' }, 413, cors(env, request));

  const existing = await loadRec(env, credId);
  const rec = existing || { pk, alg, tokens: {}, blob: null };
  if (existing && existing.pk !== pk) return json({ error: 'credential exists' }, 409, cors(env, request));
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

  const rec = await loadRec(env, credId);
  if (!rec) return json({ error: 'unknown pass' }, 404, cors(env, request));

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

  if (blob && blobOk(blob)) rec.blob = mergeBlob(rec.blob, blob);
  const token = await mintToken(rec);
  await saveRec(env, credId, rec);
  return json({ token, blob: rec.blob }, 200, cors(env, request));
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

// ---------- token-auth sync (no biometrics day-to-day) ----------
async function tokenRec(env, credId, token) {
  if (!credId || !token) return null;
  const rec = await loadRec(env, credId);
  if (!rec || !rec.tokens || !rec.tokens[await sha256Hex(token)]) return null;
  return rec;
}

async function push(request, env) {
  const bad = guard(env, request);
  if (bad) return bad;
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors(env, request)); }
  const rec = await tokenRec(env, b.credId, b.token);
  if (!rec) return json({ error: 'not linked' }, 403, cors(env, request));
  if (!blobOk(b.blob)) return json({ error: 'bad blob' }, 400, cors(env, request));
  rec.blob = mergeBlob(rec.blob, b.blob);
  await saveRec(env, b.credId, rec);
  return json({ ok: true }, 200, cors(env, request));
}

async function pull(request, env, url) {
  const bad = guard(env, request);
  if (bad) return bad;
  const rec = await tokenRec(env, url.searchParams.get('credId'), url.searchParams.get('token'));
  if (!rec) return json({ error: 'not linked' }, 403, cors(env, request));
  return json({ blob: rec.blob, updated: rec.updated }, 200, cors(env, request));
}
