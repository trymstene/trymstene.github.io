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
      if (url.pathname === '/checkout') {
        // own catch: surface WHICH admin step failed (message only — gids and
        // step names, nothing secret; clients treat any non-200 as fallback)
        try { return await handleCheckout(request, env, url); }
        catch (e) {
          console.error('checkout mint failed:', e.message);
          return json({ error: 'mint failed', detail: String(e.message).slice(0, 300) }, 500, corsHeaders(env, request));
        }
      }
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

// ---------- the door: Origin + per-IP throttle ----------
// /upload writes to R2 and /checkout mints real Shopify products and burns
// Admin-API + Printful call volume. Both were open to any caller anywhere.
// Same shape as worker-share's proven guard: best-effort across isolates,
// but it blunts scripted abuse to a trickle.
const ipHits = new Map();
function throttled(ip, perMin) {
  const now = Date.now();
  const rec = ipHits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  ipHits.set(ip, rec);
  if (ipHits.size > 5000) ipHits.clear();
  return rec.n > perMin;
}

function originOk(env, request) {
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim());
  return allowed.includes(request.headers.get('Origin') || '');
}

// ---------- POST /upload ----------

async function handleUpload(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!originOk(env, request)) return json({ error: 'forbidden' }, 403);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // a buyer uploads one design per order; 10/min is far above any real flow
  if (throttled(ip, 10)) return json({ error: 'slow down' }, 429, corsHeaders(env, request));

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

// Free worldwide shipping lives in the "Stickers" delivery profile — a product
// left in the DEFAULT profile charges real rates (the same checklist trap that
// once hit the tee + magnet, now automated away). Association is MANDATORY:
// if it fails, /checkout fails, and the client falls back to the shared
// variant whose shipping is correct — wrong shipping must never reach a buyer.
let STICKERS_PROFILE = null;
async function stickersProfileId(env) {
  if (STICKERS_PROFILE) return STICKERS_PROFILE;
  const d = await adminGql(env, 'query { deliveryProfiles(first: 10) { nodes { id name } } }');
  const hit = (d.deliveryProfiles.nodes || []).find((p) => /sticker/i.test(p.name));
  if (!hit) throw new Error('no Stickers delivery profile found');
  STICKERS_PROFILE = hit.id;
  return STICKERS_PROFILE;
}

async function handleCheckout(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const cors = corsHeaders(env, request);
  if (!originOk(env, request)) return json({ error: 'forbidden' }, 403);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (throttled(ip, 10)) return json({ error: 'slow down' }, 429, cors);
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

  // free-shipping profile — mandatory, see stickersProfileId (needs the
  // write_shipping scope; without it this throws and the client falls back)
  const ship = await adminGql(env, `
    mutation($id: ID!, $profile: DeliveryProfileInput!) {
      deliveryProfileUpdate(id: $id, profile: $profile) { userErrors { field message } }
    }`, { id: await stickersProfileId(env), profile: { variantsToAssociate: [variantGid] } });
  if (ship.deliveryProfileUpdate.userErrors.length) {
    throw new Error('shippingProfile: ' + JSON.stringify(ship.deliveryProfileUpdate.userErrors));
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
  // 📘 Meta CAPI: prove the token can write to THIS dataset without ever
  // putting a fake Purchase in it.
  // ⚠️ NOT a read. A Conversions API token may only WRITE events, so
  // GET /{dataset}?fields=name answers "(#100) Missing Permission" even when
  // the token is perfect — which is exactly how this check lied the first time.
  // Posting an EMPTY batch separates the two cases cleanly: a good token is
  // refused for "param data must be non-empty" (validation, nothing written),
  // a bad one for "Cannot parse access token" (auth).
  out.meta = env.META_CAPI_TOKEN ? 'checking' : 'no token set (CAPI off)';
  if (env.META_CAPI_TOKEN) {
    const r = await fetch(`${META_API}/${env.META_DATASET_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [], access_token: env.META_CAPI_TOKEN }),
    });
    const b = await r.json().catch(() => ({}));
    const msg = (b.error && b.error.message) || '';
    // ⚠️ /health is PUBLIC — report the length of a bad token, never any of
    // its characters. (A mangled secret is the likely failure and length alone
    // identifies it: a stdin-piped `wrangler secret put` on Windows appended a
    // CRLF and Meta answered "Cannot parse access token" for two deploys.
    // `wrangler secret bulk <file.json>` + a redeploy is the reliable route.)
    out.meta = /non-empty/.test(msg)
      ? `ok — token writes to dataset ${env.META_DATASET_ID}`
      : `error: ${msg.slice(0, 140) || 'unexpected ' + r.status}`
        + ` [stored token length ${env.META_CAPI_TOKEN.length}]`;
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

  // 📘 Meta FIRST, and for EVERY paid order. The official-shop lane returns
  // early below (no custom items to print) — but a mug is still a sale, and
  // this is the only place that knows one happened.
  try {
    console.log('meta capi:', await sendMetaPurchase(order, env));
  } catch (e) {
    console.error('meta capi threw (order still fulfils)', e && e.message);
  }

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

// ---------- 📘 META CONVERSIONS API — the server-side Purchase ----------
// Sent from the one event that is definitionally true: Shopify says the money
// moved. It can't be ad-blocked, it survives iOS, and it is the FIRST purchase
// signal this business has ever had — four real orders shipped between 3 Jun
// and 22 Jul 2026 and the browser reported exactly zero of them.
//
// ⚠️ WHY NOT A SHOPIFY CUSTOM PIXEL: those run in a sandboxed iframe on a
// Shopify origin, so the _fbp we set on .trymstene.com is invisible to them —
// you'd get Purchases that Meta can't tie to the click that earned them.
// Here the cart carries _fbp/_fbc through as line attributes instead.
//
// ⚠️ THIS MUST NEVER THROW. A Meta outage returning non-200 would make Shopify
// retry the webhook, i.e. re-drive FULFILMENT because of a tracking failure.
const META_API = 'https://graph.facebook.com/v21.0';

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// ⚠️ Meta normalises before hashing (trim + lowercase; digits only for phones,
// no spaces in city/zip). Hash a raw string and it silently never matches —
// the event is accepted, the attribution just quietly isn't there.
async function hashed(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s ? [await sha256Hex(s)] : undefined;
}
const lineProps = (li) =>
  Object.fromEntries((li.properties || []).map((p) => [p.name, p.value]));

async function sendMetaPurchase(order, env) {
  if (!env.META_CAPI_TOKEN) return 'no token — Meta CAPI off';
  const lines = order.line_items || [];
  const first = lineProps(lines[0] || {});
  const s = order.shipping_address || order.billing_address || {};
  const cd = order.client_details || {};

  const user = {
    em: await hashed(order.email || order.contact_email),
    ph: await hashed(String(s.phone || order.phone || '').replace(/\D/g, '')),
    fn: await hashed(s.first_name),
    ln: await hashed(s.last_name),
    ct: await hashed(String(s.city || '').replace(/\s/g, '')),
    st: await hashed(s.province_code),
    zp: await hashed(String(s.zip || '').replace(/\s/g, '')),
    country: await hashed(s.country_code),
    client_ip_address: cd.browser_ip || undefined,
    client_user_agent: cd.user_agent || undefined,
    fbp: first._fbp || undefined,   // carried from the cart (sticker-core)
    fbc: first._fbc || undefined,
  };
  for (const k of Object.keys(user)) if (user[k] === undefined) delete user[k];

  const payload = {
    data: [{
      event_name: 'Purchase',
      // ⚠️ Meta rejects events older than 7 days — a replayed webhook from an
      // ancient order is dropped on their side, not ours.
      event_time: Math.floor(new Date(order.created_at || Date.now()).getTime() / 1000),
      // ⚠️ THE DEDUP KEY. If a browser-side Purchase is ever added it MUST send
      // this exact event_id or every sale is counted twice.
      event_id: `shopify-${order.id}`,
      action_source: 'website',
      event_source_url: 'https://trymstene.com/',
      user_data: user,
      custom_data: {
        currency: order.currency,
        value: Number(order.total_price) || 0,
        num_items: lines.reduce((n, li) => n + (li.quantity || 1), 0),
        contents: lines.map((li) => ({
          id: String(lineProps(li)._product || li.sku || li.variant_id || ''),
          quantity: li.quantity || 1,
        })),
      },
    }],
  };

  const res = await fetch(
    `${META_API}/${env.META_DATASET_ID}/events?access_token=${env.META_CAPI_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  return res.ok ? `sent (${body.events_received} received)`
    : `FAILED ${res.status}: ${JSON.stringify(body).slice(0, 200)}`;
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
