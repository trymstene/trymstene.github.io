// Banana share worker — makes shared bananas unfurl as THEMSELVES.
//
// The flow:
//   1. The builder's "Copy share link" renders a 1200x630 OG PNG of the
//      user's banana IN THE BROWSER (the only place that can render it
//      faithfully) and POSTs it here with the builder params.
//   2. We store the PNG + params in R2 under a short id and hand back
//      /s/<id> — the link people actually share.
//   3. Crawlers hitting /s/<id> get a tiny HTML page whose og:image is
//      /so/<id>.png → Discord/Twitter/Slack unfurl the user's actual
//      banana. Humans get bounced straight to the builder with the same
//      params, ready to remix.
//
// Deliberately SEPARATE from the payment/fulfilment worker (banana-sticker):
// different blast radius, different bucket. Nothing here touches money.
//
// Routes:
//   POST /share            (CORS: ALLOWED_ORIGIN)  body = image/png OG card,
//                          ?p=<urlencoded builder query>  max 600 KB
//   GET  /s/<id>           share page: og tags + redirect to the builder
//   GET  /so/<id>.png      the stored OG image (immutable cache)
//   POST /wall/submit      (CORS: ALLOWED_ORIGIN)  body = JSON {kind, params}
//                          → the PRIVATE wall inbox. NOTHING here is public:
//                          the wall page is statically built from wall.json in
//                          the repo — publishing = a commit through Trym's hands.
//   GET  /wall/inbox?key=  capability-URL review list (WALL_KEY secret)
//   DELETE /wall/inbox/<id>?key=   remove after review
//   GET  /health           bucket reachability

const MAX_UPLOAD_BYTES = 600 * 1024;
const MAX_WALL_BYTES = 160 * 1024; // forge creations (b64 frames) can be chunky
const SITE = 'https://trymstene.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/share') return handleShare(request, env, url);
      if (url.pathname.startsWith('/s/')) return handlePage(env, url);
      if (url.pathname.startsWith('/so/')) return handleImage(request, env, url);
      if (url.pathname === '/wall/submit') return handleWallSubmit(request, env, url);
      if (url.pathname.startsWith('/wall/inbox')) return handleWallInbox(request, env, url);
      if (url.pathname === '/health') return handleHealth(env);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'internal error' }, 500);
    }
  },
};

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function corsHeaders(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  const origin = request ? request.headers.get('Origin') : null;
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- POST /share ----------
// Cost guardrails (R2 writes are the one pay-as-you-go surface on the
// account): strict Origin check + a best-effort per-IP throttle. Imperfect
// across isolates, but it blunts scripted abuse to a trickle.
const ipHits = new Map();
function throttled(ip) {
  const now = Date.now();
  const rec = ipHits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  ipHits.set(ip, rec);
  if (ipHits.size > 5000) ipHits.clear();
  return rec.n > 10; // max 10 shares/min/IP — no human shares faster
}

async function handleShare(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env, request) });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  if (!allowed.includes(request.headers.get('Origin') || '')) {
    return json({ error: 'forbidden' }, 403);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (throttled(ip)) return json({ error: 'slow down' }, 429, corsHeaders(env, request));

  const len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (!len || len > MAX_UPLOAD_BYTES) return json({ error: 'too large' }, 413, corsHeaders(env, request));

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD_BYTES) return json({ error: 'too large' }, 413, corsHeaders(env, request));
  const head = new Uint8Array(body.slice(0, 8));
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (!isPng) return json({ error: 'not a png' }, 415, corsHeaders(env, request));

  // builder params travel in ?p= (already url-encoded query string, no "?")
  const params = (url.searchParams.get('p') || '').slice(0, 800);

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  await env.SHARES.put(`og/${id}.png`, body, {
    httpMetadata: { contentType: 'image/png' },
    customMetadata: { params },
  });

  return json({ id, url: `${url.origin}/s/${id}` }, 200, corsHeaders(env, request));
}

// ---------- GET /s/<id> — the share page crawlers read ----------
async function handlePage(env, url) {
  const id = url.pathname.slice(3);
  if (!/^[a-f0-9]{6,32}$/.test(id)) return new Response('not found', { status: 404 });

  const obj = await env.SHARES.head(`og/${id}.png`);
  if (!obj) {
    // unknown id: send humans to the builder anyway
    return Response.redirect(`${SITE}/make-a-banana/`, 302);
  }
  const params = (obj.customMetadata && obj.customMetadata.params) || '';
  const target = `${SITE}/make-a-banana/${params ? '?' + params : ''}`;
  const img = `${url.origin}/so/${id}.png`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>A custom dancing banana</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(target)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="trymstene.com">
<meta property="og:title" content="I made a dancing banana">
<meta property="og:description" content="Dressed, captioned and dancing since 1999. Tap to remix it or make your own.">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(url.origin + '/s/' + id)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body>
<p>Taking you to the banana… <a href="${esc(target)}">continue</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

// ---------- GET /so/<id>.png ----------
async function handleImage(request, env, url) {
  const m = url.pathname.match(/^\/so\/([a-f0-9]{6,32})\.png$/);
  if (!m) return new Response('not found', { status: 404 });
  const obj = await env.SHARES.get(`og/${m[1]}.png`);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// ---------- POST /wall/submit — into the PRIVATE inbox, never public ----------
async function handleWallSubmit(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env, request) });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  if (!allowed.includes(request.headers.get('Origin') || '')) {
    return json({ error: 'forbidden' }, 403);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (throttled(ip)) return json({ error: 'slow down' }, 429, corsHeaders(env, request));

  const len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (!len || len > MAX_WALL_BYTES) return json({ error: 'too large' }, 413, corsHeaders(env, request));

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, corsHeaders(env, request)); }
  const kind = body && body.kind;
  const params = body && typeof body.params === 'string' ? body.params.slice(0, MAX_WALL_BYTES) : '';
  if (!['banana', 'emoji'].includes(kind) || !params) {
    return json({ error: 'bad submission' }, 400, corsHeaders(env, request));
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  await env.SHARES.put(`wall-inbox/${id}.json`, JSON.stringify({ kind, params, created: Date.now() }), {
    httpMetadata: { contentType: 'application/json' },
  });
  return json({ ok: true, id }, 200, corsHeaders(env, request));
}

// ---------- the review gate: capability URL with the WALL_KEY secret ----------
async function handleWallInbox(request, env, url) {
  if (!env.WALL_KEY || url.searchParams.get('key') !== env.WALL_KEY) {
    return json({ error: 'forbidden' }, 403);
  }
  const delMatch = url.pathname.match(/^\/wall\/inbox\/([a-f0-9]{6,32})$/);
  if (delMatch && request.method === 'DELETE') {
    await env.SHARES.delete(`wall-inbox/${delMatch[1]}.json`);
    return json({ ok: true });
  }
  const list = await env.SHARES.list({ prefix: 'wall-inbox/', limit: 100 });
  const out = [];
  for (const o of list.objects) {
    const obj = await env.SHARES.get(o.key);
    if (!obj) continue;
    try {
      const d = await obj.json();
      const id = o.key.slice('wall-inbox/'.length, -'.json'.length);
      out.push({
        id,
        kind: d.kind,
        params: d.params,
        created: d.created,
        preview: d.kind === 'banana' ? `${SITE}/make-a-banana/?${d.params}` : '(open the forge and load via shelf format)',
      });
    } catch (e) {}
  }
  return json({ pending: out.length, items: out });
}

// ---------- GET /health ----------
async function handleHealth(env) {
  try {
    await env.SHARES.head('og/healthcheck.png');
    return json({ bucket: 'ok' });
  } catch (e) {
    return json({ bucket: 'error: ' + e.message }, 500);
  }
}
