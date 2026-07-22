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
//   POST /checkout          (CORS: ALLOWED_ORIGIN)  mint a per-order product so
//                           checkout shows the buyer's ACTUAL design (needs
//                           SHOPIFY_ADMIN_TOKEN; clients fall back to the
//                           shared variant when this 503s/fails)
//   GET  /d/<key>           serve a stored design (Printful fetches from here)
//   POST /webhook/shopify   Shopify orders/paid webhook
//   GET  /geo               visitor country code (for localized price display)
//
// Temp-product lifecycle: created ACTIVE + tagged 'custom-temp' + published to
// the Headless channel only (invisible to browsing, sellable via Storefront
// API). The daily cron deletes custom-temp products older than 72h — long
// enough that order-confirmation emails keep their image while it matters.

import PRODUCTS from '../../shared/products.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Shopify numeric variant id -> product manifest entry, derived from the
// shared manifest (shared/products.js). This is why nothing is hardcoded: add
// a product to that list (with its Shopify variant + Printful variant) and the
// right thing gets printed — no worker code change, just a redeploy. Mapping is
// server-side + trusted (Shopify enforces the price; we pick what to print).
const PRODUCT_BY_SHOPIFY = Object.fromEntries(
  PRODUCTS
    .filter((p) => p.shopifyVariantGid && p.printfulVariantId)
    .map((p) => [String(p.shopifyVariantGid).split('/').pop(), p])
);
const PRINTFUL_BY_SHOPIFY = Object.fromEntries(
  Object.entries(PRODUCT_BY_SHOPIFY).map(([k, p]) => [k, p.printfulVariantId])
);
// manifest by slug — temp per-order products have unknown variant ids, so their
// line items carry `_product` (the slug) and are mapped through here instead
const PRODUCT_BY_KEY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p]));

// Resolve the Printful variant for a line item. Products with options (the
// tee) carry _color/_size as line properties — price-neutral (every combo
// sells at the same Shopify price), so trusting them only lets a buyer pick
// which colour/size THEY get. Unknown values fall back to the product default.
function printfulVariantFor(li, props, env) {
  const p = PRODUCT_BY_KEY[props._product] || PRODUCT_BY_SHOPIFY[String(li.variant_id)];
  if (!p) return parseInt(env.PRINTFUL_VARIANT_ID, 10); // unmapped → default sticker
  if (p.options) {
    const color = p.options.colors.find((c) => c.id === props._color) || p.options.colors[0];
    const size = p.options.sizes.includes(props._size) ? props._size : 'M';
    return color.variants[size] || p.printfulVariantId;
  }
  return p.printfulVariantId;
}

export default {
  // Daily sweep: delete custom-temp products older than 72h (bought or
  // abandoned alike — Printful drafts and order records don't need them, and
  // 72h keeps order-confirmation emails showing the design while it matters).
  async scheduled(event, env) {
    if (!adminConfigured(env)) return;
    const cutoff = new Date(Date.now() - 72 * 3600e3).toISOString();
    const d = await adminGql(env,
      'query($q: String!) { products(first: 100, query: $q) { nodes { id } } }',
      { q: `tag:custom-temp created_at:<'${cutoff}'` });
    for (const n of d.products.nodes || []) {
      try {
        await adminGql(env,
          'mutation($input: ProductDeleteInput!) { productDelete(input: $input) { userErrors { message } } }',
          { input: { id: n.id } });
      } catch (e) { console.error('temp sweep failed for', n.id, e.message); }
    }
    if ((d.products.nodes || []).length) console.log('temp sweep: deleted', d.products.nodes.length);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/upload') return handleUpload(request, env);
      if (url.pathname === '/checkout') return handleCheckout(request, env, url);
      if (url.pathname.startsWith('/d/')) return handleServe(request, env, url);
      if (url.pathname === '/webhook/shopify') return handleWebhook(request, env, url);
      if (url.pathname === '/health') return handleHealth(env);
      // visitor country (Cloudflare provides it on every request) — the
      // builder uses it to show Shopify's localized price for that country
      if (url.pathname === '/geo') {
        return json({ country: (request.cf && request.cf.country) || null }, 200, {
          'Cache-Control': 'no-store',
          ...corsHeaders(env, request),
        });
      }
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

// ---------- POST /checkout: mint the per-order product ----------
// The buyer's design becomes the product image, so checkout shows THEIR
// banana instead of the shared placeholder (Trym 22 Jul: same image for
// everything reads as "something's wrong" at the scariest step). Shopify's
// cart API has no per-line image — a disposable product is the only way.

const SHOP_ADMIN = 'https://officialdancingbanana.myshopify.com';
const ADMIN_API = SHOP_ADMIN + '/admin/api/2024-10/graphql.json';

function adminConfigured(env) {
  return Boolean(env.SHOPIFY_ADMIN_TOKEN || (env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET));
}

// The new dev dashboard issues no permanent shpat_ token — apps exchange their
// client id+secret for short-lived Admin tokens (client credentials grant,
// ~24h). Cached per isolate with a 5-min safety margin. A legacy
// SHOPIFY_ADMIN_TOKEN secret, if ever set, takes precedence.
let ADMIN_TOKEN = { value: null, exp: 0 };
async function adminToken(env) {
  if (env.SHOPIFY_ADMIN_TOKEN) return env.SHOPIFY_ADMIN_TOKEN;
  if (ADMIN_TOKEN.value && Date.now() < ADMIN_TOKEN.exp) return ADMIN_TOKEN.value;
  const res = await fetch(SHOP_ADMIN + '/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error('token grant failed ' + res.status + ': ' + JSON.stringify(body).slice(0, 200));
  }
  ADMIN_TOKEN = {
    value: body.access_token,
    exp: Date.now() + Math.max(60, (body.expires_in || 86400) - 300) * 1000,
  };
  return ADMIN_TOKEN.value;
}

async function adminGql(env, query, variables) {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await adminToken(env) },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    throw new Error('admin api ' + res.status + ': ' + JSON.stringify(body.errors || body).slice(0, 400));
  }
  return body.data;
}

let HEADLESS_PUB = null; // per-isolate cache — the publication id never changes
async function headlessPublicationId(env) {
  if (HEADLESS_PUB) return HEADLESS_PUB;
  const d = await adminGql(env, 'query { publications(first: 20) { nodes { id name } } }');
  const hit = (d.publications.nodes || []).find((p) => /headless|hydrogen/i.test(p.name));
  if (!hit) throw new Error('no headless publication found');
  HEADLESS_PUB = hit.id;
  return HEADLESS_PUB;
}

async function handleCheckout(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const cors = corsHeaders(env, request);
  // no Admin credentials yet = feature off; clients fall back to the shared variant
  if (!adminConfigured(env)) return json({ error: 'not configured' }, 503, cors);

  const { key, product } = await request.json().catch(() => ({}));
  if (!/^[a-f0-9-]{36}\.png$/.test(key || '')) return json({ error: 'bad key' }, 400, cors);
  const p = PRODUCT_BY_KEY[product];
  if (!p || !p.live || !p.shopifyVariantGid) return json({ error: 'bad product' }, 400, cors);
  if (!(await env.DESIGNS.head(key))) return json({ error: 'unknown design' }, 404, cors);

  // the template variant's REAL title + price — Shopify stays the source of
  // truth, so a price edit in admin flows straight through to temp products
  const tpl = await adminGql(env,
    'query($id: ID!) { node(id: $id) { ... on ProductVariant { price product { title } } } }',
    { id: p.shopifyVariantGid });
  if (!tpl.node) throw new Error('template variant not found');

  const created = await adminGql(env, `
    mutation($input: ProductInput!, $media: [CreateMediaInput!]) {
      productCreate(input: $input, media: $media) {
        product { id variants(first: 1) { nodes { id } } }
        userErrors { field message }
      }
    }`, {
    input: { title: tpl.node.product.title, status: 'ACTIVE', tags: ['custom-temp'] },
    media: [{ originalSource: `${url.origin}/d/${key}`, mediaContentType: 'IMAGE', alt: 'Your custom banana design' }],
  });
  if (created.productCreate.userErrors.length) {
    throw new Error('productCreate: ' + JSON.stringify(created.productCreate.userErrors));
  }
  const prodId = created.productCreate.product.id;
  const variantGid = created.productCreate.product.variants.nodes[0].id;

  // copy the price; the sku marks the product disposable (rides into order
  // line items, so anyone reading an order can tell it was a temp product)
  const upd = await adminGql(env, `
    mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`, {
    productId: prodId,
    variants: [{ id: variantGid, price: tpl.node.price, inventoryItem: { sku: 'CUSTOM-TEMP-' + key } }],
  });
  if (upd.productVariantsBulkUpdate.userErrors.length) {
    throw new Error('variantUpdate: ' + JSON.stringify(upd.productVariantsBulkUpdate.userErrors));
  }

  // headless channel ONLY: sellable via the Storefront API, invisible to browsing
  const pub = await adminGql(env, `
    mutation($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) { userErrors { field message } }
    }`, { id: prodId, input: [{ publicationId: await headlessPublicationId(env) }] });
  if (pub.publishablePublish.userErrors.length) {
    throw new Error('publish: ' + JSON.stringify(pub.publishablePublish.userErrors));
  }

  // give the image a beat to process so checkout doesn't render a placeholder
  for (let i = 0; i < 3; i++) {
    const st = await adminGql(env,
      'query($id: ID!) { product(id: $id) { media(first: 1) { nodes { status } } } }', { id: prodId });
    const m0 = st.product.media.nodes[0];
    if (m0 && m0.status === 'READY') break;
    await new Promise((r) => setTimeout(r, 800));
  }

  return json({ variantGid }, 200, cors);
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
  const out = { variant_id: env.PRINTFUL_VARIANT_ID, variant_map: PRINTFUL_BY_SHOPIFY, printful: 'no token set' };
  // temp-product feature + cron hygiene at a glance
  if (adminConfigured(env)) {
    try {
      const d = await adminGql(env, 'query { productsCount(query: "tag:custom-temp") { count } }');
      out.temp_products = d.productsCount.count;
    } catch (e) { out.temp_products = 'error: ' + e.message.slice(0, 120); }
  } else {
    out.temp_products = 'no admin credentials set (checkout images off, fallback active)';
  }
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
      // which Printful variant to print = looked up from this line item's
      // Shopify variant (manifest map; apparel also reads _color/_size).
      // Fall back to the sticker so a missing mapping never drops an order.
      items.push({
        variant_id: printfulVariantFor(li, props, env),
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
