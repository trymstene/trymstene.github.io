// Banana sticker fulfilment worker (Cloudflare Workers + R2).
//
// The flow (see memory/sticker-flow + worker/README.md):
//   1. The make-a-banana builder POSTs the print-res PNG to /upload -> stored
//      in R2, returns { key, url }.
//   2. The site adds the "Custom Banana Sticker" Shopify product to the cart
//      with `_design_key` as a line-item attribute; customer pays via the
//      normal Shopify checkout.
//   3. Shopify fires the orders/paid webhook at /webhook/shopify. We verify
//      the HMAC, find custom-sticker line items, and create a DRAFT Printful
//      order (confirm: false) using GET /d/<key> as the print file URL.
//      Trym approves drafts in the Printful dashboard before anything prints —
//      that's the human moderation gate.
//
// Routes:
//   POST /upload            (CORS: ALLOWED_ORIGIN)  body = image/png, max 8 MB
//   GET  /d/<key>           serve a stored design (Printful fetches from here)
//   POST /webhook/shopify   Shopify orders/paid webhook

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/upload') return handleUpload(request, env);
      if (url.pathname.startsWith('/d/')) return handleServe(request, env, url);
      if (url.pathname === '/webhook/shopify') return handleWebhook(request, env, url);
      if (url.pathname === '/health') return handleHealth(env);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'internal error' }, 500);
    }
  },
};

// ---------- helpers ----------

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function corsHeaders(env, request) {
  // ALLOWED_ORIGIN is a comma-separated allowlist (prod site + local dev)
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  const origin = request ? request.headers.get('Origin') : null;
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// ---------- POST /upload ----------

async function handleUpload(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (!len || len > MAX_UPLOAD_BYTES) return json({ error: 'file too large' }, 413, corsHeaders(env, request));
  if (!(request.headers.get('Content-Type') || '').includes('image/png')) {
    return json({ error: 'png only' }, 415, corsHeaders(env, request));
  }

  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_UPLOAD_BYTES) return json({ error: 'file too large' }, 413, corsHeaders(env, request));
  // PNG magic bytes — don't trust the header alone
  const sig = new Uint8Array(buf.slice(0, 8));
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!PNG.every((b, i) => sig[i] === b)) return json({ error: 'not a png' }, 415, corsHeaders(env, request));

  const key = crypto.randomUUID() + '.png';
  await env.DESIGNS.put(key, buf, { httpMetadata: { contentType: 'image/png' } });

  const base = new URL(request.url).origin;
  return json({ key, url: `${base}/d/${key}` }, 200, corsHeaders(env, request));
}

// ---------- GET /d/<key> ----------

async function handleServe(request, env, url) {
  const key = url.pathname.slice(3);
  if (!/^[a-f0-9-]{36}\.png$/.test(key)) return json({ error: 'bad key' }, 400);
  const obj = await env.DESIGNS.get(key);
  if (!obj) return json({ error: 'not found' }, 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// ---------- GET /health ----------
// Verifies the Printful token + config without exposing anything sensitive.

async function handleHealth(env) {
  const out = { variant_id: env.PRINTFUL_VARIANT_ID, printful: 'no token set' };
  if (env.PRINTFUL_TOKEN) {
    const res = await fetch('https://api.printful.com/stores', {
      headers: { Authorization: `Bearer ${env.PRINTFUL_TOKEN}` },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const stores = body.result || [];
      out.printful = 'ok';
      out.stores = stores.map((s) => ({ id: s.id, name: s.name, type: s.type }));
    } else {
      out.printful = `error ${res.status}`;
    }
  }
  return json(out);
}

// ---------- POST /webhook/shopify (orders/paid) ----------

async function handleWebhook(request, env, url) {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const raw = await request.text();
  const given = request.headers.get('X-Shopify-Hmac-Sha256') || '';
  if (!(await verifyShopifyHmac(raw, given, env.SHOPIFY_WEBHOOK_SECRET))) {
    console.log('webhook: HMAC verification FAILED (bad/missing secret or forged request)');
    return json({ error: 'invalid hmac' }, 401);
  }
  console.log('webhook: HMAC verified OK');

  const order = JSON.parse(raw);

  // Collect custom-sticker line items (the cart attaches `_design_key`)
  const items = [];
  for (const li of order.line_items || []) {
    const props = Object.fromEntries((li.properties || []).map((p) => [p.name, p.value]));
    if (props._design_key && /^[a-f0-9-]{36}\.png$/.test(props._design_key)) {
      items.push({
        variant_id: parseInt(env.PRINTFUL_VARIANT_ID, 10),
        quantity: li.quantity || 1,
        files: [{ url: `${url.origin}/d/${props._design_key}` }],
      });
    }
  }
  if (!items.length) return json({ ok: true, note: 'no custom items' }); // regular order, nothing to do

  const s = order.shipping_address || {};
  const printfulOrder = {
    external_id: `shopify-${order.id}`, // idempotency: Printful rejects duplicates
    recipient: {
      name: s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      address1: s.address1, address2: s.address2 || '',
      city: s.city, state_code: s.province_code || '',
      country_code: s.country_code, zip: s.zip,
      phone: s.phone || '', email: order.email || '',
    },
    items,
    confirm: false, // DRAFT — Trym approves in the Printful dashboard before print
  };

  const res = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(printfulOrder),
  });
  const body = await res.json().catch(() => ({}));

  if (res.ok) return json({ ok: true, printful_order: body?.result?.id });
  // Duplicate external_id => webhook retry of an order we already created: fine.
  if (res.status === 400 && JSON.stringify(body).includes('external_id')) {
    return json({ ok: true, note: 'already created' });
  }
  console.error('printful error', res.status, JSON.stringify(body));
  return json({ error: 'printful failed' }, 500); // non-200 makes Shopify retry
}

async function verifyShopifyHmac(rawBody, givenB64, secret) {
  if (!givenB64 || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== givenB64.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ givenB64.charCodeAt(i);
  return diff === 0;
}
