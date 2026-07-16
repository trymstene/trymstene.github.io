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
//
//   THE BANANA GALLERY submission pipeline (16 Jul) — /banana-memes/ community
//   lane. Visitors submit a REAL rendered GIF from the builder; Trym approves
//   in a worker-served panel; the site build pulls the approved list:
//   POST /gallery/submit?meta=<uriencoded JSON>  (CORS)  body = the GIF binary
//   GET  /gallery/admin?key=        approve/reject panel (WALL_KEY)
//   GET  /gallery/pending/<id>.gif?key=   inbox preview image
//   POST /gallery/moderate?key=     {id, action:'approve'|'reject', title}
//   GET  /gallery/approved          public JSON of live items (build-time pull)
//   GET  /gallery/gif/<slug>.gif    public immutable serve of a live item
//   GET  /health           bucket reachability

const MAX_UPLOAD_BYTES = 600 * 1024;
const MAX_WALL_BYTES = 160 * 1024; // forge creations (b64 frames) can be chunky
const MAX_GALLERY_BYTES = 350 * 1024; // a 480px 8-frame banana meme is ~60-90 KB
const SITE = 'https://trymstene.com';

// ⚠ keep in sync with BLOCKLIST in src/lib/sticker-core.js (the client gate);
// this server copy is the one submitters can't bypass
const BLOCKLIST = ['fuck','shit','bitch','cunt','nigg','fagg','retard','whore','slut','porn','rape','hitler','nazi','faen','jævla','jævel','fitte','kuk','pikk','hore','kneppe'];
const dirty = (s) => { const t = String(s || '').toLowerCase(); return BLOCKLIST.some((w) => t.includes(w)); };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/share') return handleShare(request, env, url);
      if (url.pathname.startsWith('/s/')) return handlePage(env, url);
      if (url.pathname.startsWith('/so/')) return handleImage(request, env, url);
      if (url.pathname === '/wall/submit') return handleWallSubmit(request, env, url);
      if (url.pathname.startsWith('/wall/inbox')) return handleWallInbox(request, env, url);
      if (url.pathname === '/gallery/submit') return handleGallerySubmit(request, env, url);
      if (url.pathname === '/gallery/admin') return handleGalleryAdmin(request, env, url);
      if (url.pathname.startsWith('/gallery/pending/')) return handleGalleryPending(request, env, url);
      if (url.pathname === '/gallery/moderate') return handleGalleryModerate(request, env, url);
      if (url.pathname === '/gallery/approved') return handleGalleryApproved(env);
      if (url.pathname.startsWith('/gallery/gif/')) return handleGalleryGif(env, url);
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
  // the optional signature — free text is acceptable ONLY because every entry
  // passes Trym's human gate before publication (he reads name + art together)
  const by = body && typeof body.by === 'string'
    ? body.by.replace(/[\\u0000-\\u001f\\u007f]/g, '').trim().slice(0, 24)
    : '';
  if (!['banana', 'emoji'].includes(kind) || !params) {
    return json({ error: 'bad submission' }, 400, corsHeaders(env, request));
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  await env.SHARES.put(`wall-inbox/${id}.json`, JSON.stringify({ kind, params, by, created: Date.now() }), {
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
        by: d.by || '',
        created: d.created,
        preview: d.kind === 'banana' ? `${SITE}/make-a-banana/?${d.params}` : '(open the forge and load via shelf format)',
      });
    } catch (e) {}
  }
  return json({ pending: out.length, items: out });
}

// ═══════════════ THE BANANA GALLERY submission pipeline ═══════════════

const slugify = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'banana';

// ---------- POST /gallery/submit?meta= — GIF binary into the inbox ----------
async function handleGallerySubmit(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env, request) });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  if (!allowed.includes(request.headers.get('Origin') || '')) {
    return json({ error: 'forbidden' }, 403);
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (throttled(ip)) return json({ error: 'slow down' }, 429, corsHeaders(env, request));

  const len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (!len || len > MAX_GALLERY_BYTES) return json({ error: 'too large' }, 413, corsHeaders(env, request));

  let meta = {};
  try { meta = JSON.parse(url.searchParams.get('meta') || '{}'); } catch (e) {}
  const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
  const kind = ['banana', 'emoji'].includes(meta.kind) ? meta.kind : 'banana';
  const title = clean(meta.title, 60);
  const by = clean(meta.by, 24);
  const params = clean(meta.params, 800);
  const transparent = !!meta.transparent;
  if (dirty(title) || dirty(by)) return json({ error: 'family friendly only 🍌' }, 400, corsHeaders(env, request));

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_GALLERY_BYTES) return json({ error: 'too large' }, 413, corsHeaders(env, request));
  const head = new Uint8Array(body.slice(0, 6));
  const magic = String.fromCharCode(...head);
  if (magic !== 'GIF89a' && magic !== 'GIF87a') return json({ error: 'not a gif' }, 415, corsHeaders(env, request));

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  await env.SHARES.put(`gallery-inbox/${id}.gif`, body, {
    httpMetadata: { contentType: 'image/gif' },
  });
  await env.SHARES.put(`gallery-inbox/${id}.json`,
    JSON.stringify({ kind, title, by, params, transparent, kb: Math.round(body.byteLength / 1024), created: Date.now() }),
    { httpMetadata: { contentType: 'application/json' } });
  return json({ ok: true, id }, 200, corsHeaders(env, request));
}

// ---------- GET /gallery/pending/<id>.gif?key= — inbox preview ----------
async function handleGalleryPending(request, env, url) {
  if (!env.WALL_KEY || url.searchParams.get('key') !== env.WALL_KEY) return json({ error: 'forbidden' }, 403);
  const m = url.pathname.match(/^\/gallery\/pending\/([a-f0-9]{6,32})\.gif$/);
  if (!m) return new Response('not found', { status: 404 });
  const obj = await env.SHARES.get(`gallery-inbox/${m[1]}.gif`);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } });
}

// ---------- GET /gallery/admin?key= — the approve/reject panel ----------
async function handleGalleryAdmin(request, env, url) {
  if (!env.WALL_KEY || url.searchParams.get('key') !== env.WALL_KEY) return json({ error: 'forbidden' }, 403);
  const key = url.searchParams.get('key');
  const list = await env.SHARES.list({ prefix: 'gallery-inbox/', limit: 200 });
  const items = [];
  for (const o of list.objects) {
    if (!o.key.endsWith('.json')) continue;
    const obj = await env.SHARES.get(o.key);
    if (!obj) continue;
    try {
      const d = await obj.json();
      items.push({ id: o.key.slice('gallery-inbox/'.length, -'.json'.length), ...d });
    } catch (e) {}
  }
  items.sort((a, b) => a.created - b.created);
  const rows = items.map((d) => `
    <div class="card" id="c-${d.id}">
      <img src="/gallery/pending/${d.id}.gif?key=${encodeURIComponent(key)}" alt="">
      <div class="meta">
        <input id="t-${d.id}" value="${esc(d.title)}" maxlength="60" placeholder="title (becomes the page)">
        <p>${d.kind} · ${d.transparent ? 'transparent (sticker)' : 'solid (gif)'} · ${d.kb} KB · by <b>${esc(d.by || 'anonymous')}</b> · ${new Date(d.created).toISOString().slice(0, 10)}</p>
        <div class="btns">
          <button class="ok" onclick="mod('${d.id}','approve')">✓ approve</button>
          <button class="no" onclick="mod('${d.id}','reject')">✕ reject</button>
        </div>
      </div>
    </div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>🖼 Gallery inbox (${items.length})</title>
<style>
  body { font-family: system-ui, sans-serif; background: #16121f; color: #fffdf5; margin: 0; padding: 1.2rem; }
  h1 { font-size: 1.1rem; } a { color: #ffe135; }
  .card { display: flex; gap: 1rem; align-items: flex-start; background: #241d33; border: 3px solid #000; padding: 0.9rem; margin-bottom: 0.9rem; max-width: 720px; }
  .card img { width: 140px; height: 140px; object-fit: contain; background: repeating-conic-gradient(#3a3350 0% 25%, #2c2740 0% 50%) 0 0 / 20px 20px; border: 2px solid #000; }
  .meta { flex: 1; } .meta p { font-size: 0.8rem; opacity: 0.8; }
  input { width: 100%; box-sizing: border-box; padding: 0.45rem; font: inherit; background: #16121f; color: #fffdf5; border: 2px solid #000; }
  .btns { display: flex; gap: 0.6rem; margin-top: 0.6rem; }
  button { padding: 0.5rem 1rem; font-weight: 700; cursor: pointer; border: 2px solid #000; }
  .ok { background: #ffe135; } .no { background: #ff4d6d; color: #fff; }
  .done { opacity: 0.35; pointer-events: none; }
</style></head><body>
<h1>🖼 Banana Gallery inbox — ${items.length} pending</h1>
<p style="font-size:0.8rem;opacity:0.7">Approve = live at /banana-memes/by/&lt;slug&gt;/ on the NEXT site build (push or daily cron). Edit the title first — it becomes the page. Reject = gone.</p>
${rows || '<p>Inbox zero 🍌</p>'}
<script>
async function mod(id, action) {
  const title = document.getElementById('t-' + id).value;
  const res = await fetch('/gallery/moderate?key=' + encodeURIComponent(${JSON.stringify(key)}), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, title }),
  });
  const d = await res.json().catch(() => ({}));
  if (d.ok) document.getElementById('c-' + id).classList.add('done');
  else alert(d.error || 'failed');
}
</script></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// ---------- POST /gallery/moderate?key= ----------
async function handleGalleryModerate(request, env, url) {
  if (!env.WALL_KEY || url.searchParams.get('key') !== env.WALL_KEY) return json({ error: 'forbidden' }, 403);
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const id = String(body.id || '');
  if (!/^[a-f0-9]{6,32}$/.test(id)) return json({ error: 'bad id' }, 400);

  if (body.action === 'reject') {
    await env.SHARES.delete(`gallery-inbox/${id}.gif`);
    await env.SHARES.delete(`gallery-inbox/${id}.json`);
    return json({ ok: true });
  }
  if (body.action !== 'approve') return json({ error: 'bad action' }, 400);

  const metaObj = await env.SHARES.get(`gallery-inbox/${id}.json`);
  const gifObj = await env.SHARES.get(`gallery-inbox/${id}.gif`);
  if (!metaObj || !gifObj) return json({ error: 'not found' }, 404);
  const d = await metaObj.json();
  const title = String(body.title || d.title || '').trim().slice(0, 60) || 'Community banana';
  if (dirty(title)) return json({ error: 'title fails the family filter' }, 400);

  // slug: title + a short id tail = readable AND collision-proof forever
  const slug = `${slugify(title)}-${id.slice(0, 4)}`;

  const idxObj = await env.SHARES.get('gallery-live/index.json');
  let index = [];
  if (idxObj) { try { index = await idxObj.json(); } catch (e) {} }
  if (index.some((e) => e.slug === slug)) return json({ error: 'already approved' }, 409);

  await env.SHARES.put(`gallery-live/${slug}.gif`, await gifObj.arrayBuffer(), {
    httpMetadata: { contentType: 'image/gif' },
  });
  index.push({
    slug, title, by: d.by || '', kind: d.kind, transparent: !!d.transparent,
    params: d.params || '', kb: d.kb || 0, created: d.created, approved: Date.now(),
  });
  await env.SHARES.put('gallery-live/index.json', JSON.stringify(index), {
    httpMetadata: { contentType: 'application/json' },
  });
  await env.SHARES.delete(`gallery-inbox/${id}.gif`);
  await env.SHARES.delete(`gallery-inbox/${id}.json`);
  return json({ ok: true, slug });
}

// ---------- GET /gallery/approved — public, the build pulls this ----------
async function handleGalleryApproved(env) {
  const idxObj = await env.SHARES.get('gallery-live/index.json');
  const bodyTxt = idxObj ? await idxObj.text() : '[]';
  return new Response(bodyTxt, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

// ---------- GET /gallery/gif/<slug>.gif — public live item ----------
async function handleGalleryGif(env, url) {
  const m = url.pathname.match(/^\/gallery\/gif\/([a-z0-9-]{1,60})\.gif$/);
  if (!m) return new Response('not found', { status: 404 });
  const obj = await env.SHARES.get(`gallery-live/${m[1]}.gif`);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/gif',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
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
