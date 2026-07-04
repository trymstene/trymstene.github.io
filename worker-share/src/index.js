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
//   GET  /health           bucket reachability

const MAX_UPLOAD_BYTES = 600 * 1024;
const SITE = 'https://trymstene.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/share') return handleShare(request, env, url);
      if (url.pathname.startsWith('/s/')) return handlePage(env, url);
      if (url.pathname.startsWith('/so/')) return handleImage(request, env, url);
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
async function handleShare(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env, request) });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

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

// ---------- GET /health ----------
async function handleHealth(env) {
  try {
    await env.SHARES.head('og/healthcheck.png');
    return json({ bucket: 'ok' });
  } catch (e) {
    return json({ bucket: 'error: ' + e.message }, 500);
  }
}
