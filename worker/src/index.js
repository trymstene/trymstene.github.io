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
// manifest by slug — temp per-order products have unknown variant ids, so the
// /checkout mint burns the slug into their SKU and fulfilment reads it back
// from the order. The sku is SERVER-SET; the cart's `_product` attribute isn't.
const PRODUCT_BY_KEY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p]));

const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const TEMP_SKU = new RegExp(`^CUSTOM-TEMP-(.+)-${UUID_RE}\\.png$`);
// ⏳ mints from before the slug segment existed (25 Aug 2026). Temp products
// are swept at 72h, so this can only match an order in flight across that
// deploy — it must never become the easy way in again.
const LEGACY_TEMP_SKU = new RegExp(`^CUSTOM-TEMP-${UUID_RE}\\.png$`);

// what the line actually PAID, in the manifest's currency. priceHint is quoted
// in USD (the store currency), so a line booked in anything else is unusable
// for comparison rather than loosely trusted.
function paidUsd(li) {
  const m = (li.price_set && li.price_set.shop_money) || null;
  if (m && m.currency_code && m.currency_code !== 'USD') return null;
  const n = Number(m && m.amount != null ? m.amount : li.price);
  return Number.isFinite(n) ? n : null;
}

// 💰 WHAT GETS PRINTED IS BOUND TO WHAT WAS PAID FOR, never to a cart
// attribute: `_product` is pure client input (the Storefront cartCreate is
// public — anyone can replay it with the $4.99 sticker variant and
// _product:'tee'). Trust order: the variant Shopify charged for, then the slug
// the mint wrote into the server-set sku.
function productForLine(li, props) {
  const byVariant = PRODUCT_BY_SHOPIFY[String(li.variant_id)];
  if (byVariant) return byVariant;
  const sku = String(li.sku || '');
  const m = sku.match(TEMP_SKU);
  if (m) return PRODUCT_BY_KEY[m[1]] || null;
  // legacy temp line (minted before the sku carried the product): believe
  // `_product` only if the line paid at least that product's list price — a
  // sticker's $4.99 can never buy a tee's print. Deliberately one-sided: a
  // priceHint that has drifted HIGH only makes this stricter (the line falls
  // back to the sticker), never looser.
  if (LEGACY_TEMP_SKU.test(sku)) {
    const p = PRODUCT_BY_KEY[props._product];
    const paid = paidUsd(li);
    if (p && p.live && paid !== null && paid >= Number(p.priceHint)) return p;
  }
  return null;
}

// Resolve the Printful variant for a line item. Products with options (the
// tee) carry _color/_size as line properties — price-neutral (every combo
// sells at the same Shopify price), so trusting them only lets a buyer pick
// which colour/size THEY get, once the PRODUCT is settled server-side above.
function printfulVariantFor(li, props, env) {
  const p = productForLine(li, props);
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
      // 🖨 GET /pf — what Printful actually holds for the Shopify store, via
      // the v2 API (v1 refuses platform stores outright). Read-only. This is
      // the only way to learn which CATALOG variant sits behind each Shopify
      // variant, which is what a real margin check needs.
      if (url.pathname === '/pf') return handlePf(request, env, url);
      if (url.pathname === '/health') {
        // CORS so the Banana HQ world desk can show the buyable light — the
        // silent-unbuyable day must never need a manual curl to notice
        const res = await handleHealth(env, url.searchParams.get('ship') === '1', url.searchParams.get('store') === '1',
          url.searchParams.get('buyable') === '1');
        const h = new Headers(res.headers);
        Object.entries(corsHeaders(env, request)).forEach(([k, v]) => h.set(k, v));
        return new Response(res.body, { status: res.status, headers: h });
      }
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

// CHARGED shipping (flat 49 NOK worldwide) lives in the "Stickers" delivery profile — a product
// left in the DEFAULT profile charges real rates (the same checklist trap that
// once hit the tee + magnet, now automated away). Association is MANDATORY:
// if it fails, /checkout fails, and the client falls back to the shared
// variant whose shipping is correct — wrong shipping must never reach a buyer.
let STICKERS_PROFILE = null;
async function stickersProfileId(env) {
  if (STICKERS_PROFILE) return STICKERS_PROFILE;
  // ⚠️ first: 30, not 10 — the 7-8 Aug label re-makes grew the store to 12
  // profiles and a first:10 can miss ours. And the match must never land on
  // "Printful: Stickers (#PF-FRG10)" — those are app-owned; associating into
  // them fails. Exact name first, fuzzy-minus-Printful as the fallback.
  const d = await adminGql(env, 'query { deliveryProfiles(first: 30) { nodes { id name } } }');
  const nodes = d.deliveryProfiles.nodes || [];
  const hit = nodes.find((p) => p.name === 'Stickers')
    || nodes.find((p) => /sticker/i.test(p.name) && !/printful/i.test(p.name));
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
  // line items, so anyone reading an order can tell it was a temp product).
  // ⚠️ THE SLUG IN THE SKU IS THE FULFILMENT MAPPING for temp variants — it is
  // set here, server-side, next to the price Shopify will charge. Never move it
  // to a cart attribute (see productForLine).
  const upd = await adminGql(env, `
    mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`, {
    productId: prodId,
    variants: [{ id: variantGid, price: tpl.node.price, inventoryItem: { sku: `CUSTOM-TEMP-${p.key}-${key}` } }],
  });
  if (upd.productVariantsBulkUpdate.userErrors.length) {
    throw new Error('variantUpdate: ' + JSON.stringify(upd.productVariantsBulkUpdate.userErrors));
  }

  // 🚚 ASSOCIATION RESTORED (18 Aug). The 7 Aug removal assumed the General
  // profile carried sane charged rates — it carried leftover TEMPLATE rates
  // (~179 NOK international), so every minted product overcharged ~4x real
  // cost. Shipping IS still charged (Trym's one-rule doctrine): the Stickers
  // profile now bills a flat 49 NOK worldwide, and the mint pins each
  // per-order product to it so temp products bill exactly like their base
  // product. MANDATORY fails-closed: any failure = mint 500 = the client
  // falls back to the shared variant, whose shipping is verified by /health.
  const assoc = await adminGql(env, `
    mutation($id: ID!, $profile: DeliveryProfileInput!) {
      deliveryProfileUpdate(id: $id, profile: $profile) {
        profile { id } userErrors { field message }
      }
    }`, { id: await stickersProfileId(env), profile: { variantsToAssociate: [variantGid] } });
  if (assoc.deliveryProfileUpdate.userErrors.length) {
    throw new Error('profileAssociate: ' + JSON.stringify(assoc.deliveryProfileUpdate.userErrors));
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

// ---------- GET /pf ----------
// Printful's v2 API, read-only. v1's /store/products refuses this store
// ("applies only to Manual Order / API platform") but v2 answers fine, so this
// is where the CATALOG variant behind each Shopify variant finally becomes
// visible — the number a real margin check needs, and the reason the official
// line was once priced by feel (nobody could see the enamel mug cost $12.25).
async function handlePf(request, env, url) {
  const tok = env.PRINTFUL_TOKEN_SHOP;
  if (!tok) return json({ error: 'no PRINTFUL_TOKEN_SHOP' }, 503);
  const pf = (path) => fetch('https://api.printful.com' + path, {
    headers: { Authorization: `Bearer ${tok}` },
  }).then((r) => r.json());
  const only = url.searchParams.get('only');       // substring of the name
  const list = await pf('/v2/sync-products?limit=50');
  if (!Array.isArray(list.data)) return json({ error: String(JSON.stringify(list)).slice(0, 300) }, 502);
  const out = {};
  for (const p of list.data) {
    if (only && !p.name.toLowerCase().includes(only.toLowerCase())) continue;
    const v = await pf(`/v2/sync-products/${p.id}/sync-variants?limit=100`);
    out[p.name] = Array.isArray(v.data)
      ? v.data.map((x) => `${x.name.replace(p.name, '').replace(/^\s*[-–]\s*/, '')} :: catalog ${x.catalog_variant_id} :: retail ${x.retail_price}`)
      : String(JSON.stringify(v)).slice(0, 200);
  }
  return json(out);
}

// ---------- GET /health ----------
// Verifies the Printful token + config without exposing anything sensitive.

async function handleHealth(env, ship, store, buyable) {
  const out = { variant_id: env.PRINTFUL_VARIANT_ID, variant_map: PRINTFUL_BY_SHOPIFY, printful: 'no token set' };
  // 🛒 CAN ANYONE ACTUALLY BUY IT? (/health?buyable=1)
  // Found 8 Aug: every variant of BOTH official products reported
  // availableForSale:false on the Storefront API — 100 tee variants and the
  // mug — while every builder product was fine. A product can look perfect on
  // the PDP and simply refuse to sell, and nothing else in the stack notices.
  // Printful-synced products don't need Shopify inventory at all; tracked +
  // 0 on hand + policy DENY is the combination that silently blocks a sale.
  if (buyable) {
    if (!adminConfigured(env)) {
      out.buyable = 'no admin credentials set';
    } else try {
      const d = await adminGql(env, `query { products(first: 30) { nodes {
        handle status tags publishedAt
        resourcePublications(first: 15) { nodes { isPublished publication { name } } }
        variants(first: 100) { nodes { title price inventoryPolicy inventoryQuantity
          inventoryItem { tracked requiresShipping } } } } } }`);
      out.buyable = {};
      for (const p of d.products.nodes) {
        if ((p.tags || []).includes('custom-temp')) continue;
        const vs = p.variants.nodes;
        const blocked = vs.filter((v) => v.inventoryItem.tracked
          && v.inventoryPolicy === 'DENY' && (v.inventoryQuantity || 0) <= 0);
        const v0 = vs[0] || {};
        out.buyable[p.handle] = {
          verdict: blocked.length
            ? `❌ ${blocked.length}/${vs.length} variants blocked — tracked, 0 on hand, policy DENY`
            : (p.status === 'ACTIVE' ? `ok (${vs.length})` : `status ${p.status}`),
          published: p.publishedAt ? 'yes' : '❌ NOT PUBLISHED',
          channels: p.resourcePublications.nodes.filter((r) => r.isPublished)
            .map((r) => r.publication.name).join(' | ') || '❌ NO CHANNELS',
          // every variant's price — checks a new product's margin against the
          // slate without opening Shopify, and catches a size priced by hand
          prices: vs.map((v) => `${v.title} $${v.price}`).slice(0, 14),
          v0: v0.title && `${v0.title}: policy=${v0.inventoryPolicy} qty=${v0.inventoryQuantity} ` +
            `tracked=${v0.inventoryItem.tracked} requiresShipping=${v0.inventoryItem.requiresShipping}`,
        };
      }
      // ⚠️ AND THE ONE THAT ACTUALLY BIT US: a product whose delivery profile
      // has no zone covering a country is availableForSale:FALSE in that
      // market — while still true with no @inContext at all. Inventory looks
      // perfect, the PDP renders, and nobody can buy. Left behind by the
      // free-shipping experiment's profile juggling.
      // what CAN this app do? saves guessing which scope a 'Access denied'
      // wants, and proves a newly-granted one actually took
      try {
        const sc = await adminGql(env,
          'query { currentAppInstallation { accessScopes { handle } } }');
        out.scopes = sc.currentAppInstallation.accessScopes.map((s) => s.handle).sort().join(', ');
      } catch (e) { out.scopes = 'error: ' + e.message.slice(0, 120); }
      // needs read_markets: every market's catalog PUBLICATION id. A product
      // that isn't published to those is invisible-to-buy in that market while
      // still resolving a converted price — which is exactly the symptom.
      try {
        const m = await adminGql(env, `query { markets(first: 15) { nodes { name handle enabled
          catalogs(first: 5) { nodes { id status ... on MarketCatalog { publication { id } } } } } } }`);
        out.markets = m.markets.nodes.map((k) => ({
          name: `${k.name} (${k.handle}) enabled=${k.enabled}`,
          pubs: k.catalogs.nodes.map((c) => (c.publication && c.publication.id) || c.id + ':' + c.status),
        }));
      } catch (e) { out.markets = 'error: ' + e.message.slice(0, 160); }
      try {
        const c = await adminGql(env, `query { catalogs(first: 25) { nodes { id status
          ... on MarketCatalog { title markets(first: 5) { nodes { handle } } }
          publication { id } } } }`);
        out.catalogs = c.catalogs.nodes.map((k) => `${k.title || k.id} ${k.status}` +
          (k.markets ? ` markets=[${k.markets.nodes.map((m) => m.handle).join(',')}]` : '') +
          ` pub=${k.publication ? k.publication.id.split('/').pop() : 'none'}`);
      } catch (e) { out.catalogs = 'error: ' + e.message.slice(0, 160); }
      // needs read_inventory: WHERE the tracked 9999 actually sits
      try {
        const inv = await adminGql(env, `query { products(first: 30) { nodes { handle
          variants(first: 1) { nodes { inventoryItem { tracked
            inventoryLevels(first: 8) { nodes { id
              quantities(names: "available") { quantity } } } } } } } } }`);
        out.inventory = {};
        for (const p of inv.products.nodes) {
          const it = p.variants.nodes[0] && p.variants.nodes[0].inventoryItem;
          if (!it) continue;
          out.inventory[p.handle] = `tracked=${it.tracked} levels=` +
            (it.inventoryLevels.nodes.map((l) =>
              (l.quantities[0] ? l.quantities[0].quantity : '?')).join(', ') || '❌ NONE');
        }
      } catch (e) { out.inventory = 'error: ' + e.message.slice(0, 160); }
      // ⚠️ first: 10 returned exactly 10 and hid a profile — every new product
      // type can add one (Printful splits by fulfilment category), so this has
      // to have real headroom or the reconciliation below lies.
      const dp = await adminGql(env, `query { deliveryProfiles(first: 30) { nodes {
        id name default productVariantsCount { count }
        profileItems(first: 20) { nodes { product { handle } } }
        profileLocationGroups { locationGroupZones(first: 20) { nodes {
          zone { name countries { code { countryCode } } }
          methodDefinitions(first: 5) { nodes { name active } } } } } } } }`);
      out.delivery = dp.deliveryProfiles.nodes.map((p) => {
        const zones = p.profileLocationGroups.flatMap((g) => g.locationGroupZones.nodes);
        const rates = zones.reduce((n, z) => n + z.methodDefinitions.nodes.filter((m) => m.active).length, 0);
        return {
          id: p.id,
          name: (p.default ? '(default) ' : '') + p.name,
          variants: p.productVariantsCount.count,
          // the country CODES, not just a count — "International [28]" told us
          // nothing about whether the US was one of them, which is the only
          // question that matters for a product that won't sell there
          zones: zones.map((z) => z.zone.name + ': ' +
            z.zone.countries.map((c) => c.code.countryCode).join(',')),
          rates,
          products: (p.profileItems ? p.profileItems.nodes.map((i) => i.product.handle) : []),
          warn: rates ? undefined : 'NOTHING CAN SHIP',
        };
      });
      // 🚚 THE 180-NOK GUARD (17 Aug — third profile incident): the custom
      // products fell OUT of the free-shipping "Stickers" profile into the
      // default one, and every checkout quoted ~$19 international. The
      // delivery report above only DESCRIBES profiles; this ASSERTS the truth
      // the way a buyer meets it — a real Storefront cart per product, US
      // address, and the quote must be FREE. Failure is written into the
      // product's verdict so the HQ desk's existing ❌-scan lights up.
      try {
        out.shipping = {};
        for (const pr of PRODUCTS.filter((x) => x.live && x.shopifyVariantGid)) {
          const q = await fetch('https://officialdancingbanana.myshopify.com/api/2024-07/graphql.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json',
              'X-Shopify-Storefront-Access-Token': '1032480366b6bf67760ba73ace4fe0f8' },
            body: JSON.stringify({
              query: `mutation($lines: [CartLineInput!]!, $addr: MailingAddressInput!) {
                cartCreate(input: { lines: $lines, buyerIdentity: { countryCode: US,
                  deliveryAddressPreferences: [{ deliveryAddress: $addr }] } }) {
                  cart { deliveryGroups(first: 5) { nodes { deliveryOptions {
                    title estimatedCost { amount currencyCode } } } } }
                  userErrors { message } } }`,
              variables: { lines: [{ merchandiseId: pr.shopifyVariantGid, quantity: 1 }],
                addr: { country: 'US', address1: '1 Main St', city: 'New York', province: 'NY', zip: '10001' } },
            }),
          }).then((r) => r.json());
          const cart = q.data && q.data.cartCreate && q.data.cartCreate.cart;
          const opts = cart ? cart.deliveryGroups.nodes.flatMap((g) => g.deliveryOptions) : [];
          // Doctrine (shop-design-direction): shipping is CHARGED on both
          // lanes — never free (a $4.99 sticker with free shipping sells at a
          // loss) and never the default profile's leftover ~$19 template rate.
          // Sane band for a US quote: roughly Printful's real cost.
          const amt = opts.length ? Number(opts[0].estimatedCost.amount) : null;
          const cur = opts.length ? opts[0].estimatedCost.currencyCode : '';
          const verdict = !opts.length ? '❌ NO DELIVERY OPTIONS (unbuyable)'
            : amt === 0 ? '❌ FREE shipping — doctrine is CHARGED; this sells at a loss'
              : amt > 12 ? '❌ quoted ' + amt + ' ' + cur + ' — default-profile template rate (the 180-NOK bug)'
                : 'ok charged ' + amt + ' ' + cur;
          out.shipping[pr.key] = verdict;
          const bh = 'custom-banana-' + pr.key;   // Shopify handle convention
          if (verdict.includes('❌') && out.buyable[bh]) out.buyable[bh].verdict = verdict;
        }
      } catch (e) { out.shipping = 'error: ' + e.message.slice(0, 160); }
    } catch (e) { out.buyable = 'error: ' + e.message.slice(0, 200); }
  }
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
      // ⚠️ COUNT, not the store list — /health is unauthenticated, and the ids
      // and names were free recon for anyone who guessed the URL.
      out.printful = 'ok';
      out.stores = (body.result || []).length;
    } else {
      out.printful = `error ${res.status}`;
    }
  }
  // 📊 GA4: prove the Measurement Protocol secret actually works, without
  // waiting for a real sale. This hits the DEBUG endpoint, which validates the
  // payload and returns what's wrong with it — the live endpoint answers 204
  // with an empty body even for a malformed event, so it can't tell you this.
  // ⚠️ value 0 + a marked transaction_id on purpose: the debug endpoint does
  // not record events, but if that ever changed, a 0-value "ga4-healthcheck"
  // sale is obvious and filterable rather than silently polluting revenue.
  if (env.GA4_API_SECRET) {
    try {
      const probe = {
        client_id: '1234567890.1234567890',
        events: [{ name: 'purchase', params: {
          transaction_id: 'ga4-healthcheck', value: 0, currency: 'USD',
          items: [{ item_id: 'sticker', item_name: 'Custom Banana Sticker', price: 0, quantity: 1 }],
        } }],
      };
      const r = await fetch(
        `https://www.google-analytics.com/debug/mp/collect?measurement_id=${GA4_ID}&api_secret=${env.GA4_API_SECRET}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(probe) });
      const b = await r.json().catch(() => ({}));
      const msgs = b.validationMessages || [];
      out.ga4 = msgs.length
        ? msgs.map((m) => m.description || m.validationCode)
        : `ok — ${GA4_ID} accepted the purchase payload`;
    } catch (e) { out.ga4 = 'error: ' + String(e && e.message).slice(0, 120); }
  } else {
    out.ga4 = 'no GA4_API_SECRET set — server-side purchase is OFF';
  }
  // 🏷 the OFFICIAL line's real economics (/health?store=1). Those products are
  // Printful-synced rather than manifest-driven, so their cost lives only in
  // Printful — which is why they were priced by feel and never re-checked.
  if (store) {
    // PRINTFUL_TOKEN is scoped to "Banana API" — the native store that takes
    // the custom lane's orders, which has NO synced products and therefore
    // cannot see the official line's cost. PRINTFUL_TOKEN_SHOP is the second,
    // optional token for the Shopify-connected store. Both are tried and
    // reported separately, so it's obvious which one can see what.
    // ⚠️ ONE representative variant per product, not all of them. The hoodie
    // alone has 80 sync variants and the classic tee 100 — walking them all
    // blows Cloudflare's 50-subrequest cap and the whole worker throws 1101.
    out.store = {};
    for (const [label, tok] of [['api', env.PRINTFUL_TOKEN], ['shop', env.PRINTFUL_TOKEN_SHOP]]) {
      if (!tok) { out.store[label] = 'no token set'; continue; }
      const pf = (path) => fetch('https://api.printful.com' + path, {
        headers: { Authorization: `Bearer ${tok}` },
      }).then((r) => r.json()).catch((e) => ({ _err: String(e && e.message) }));
      try {
        const stores = await pf('/stores');
        const seen = (stores.result || []).map((s) => `${s.id}:${s.name}(${s.type})`);
        // ⚠️ /store/products lists SYNCED products only. A product created in
        // Shopify by hand (rather than pushed from Printful) shows up as
        // "ignored" and never appears here — so report what Printful actually
        // said, including the ignored count, instead of a bare zero.
        // ⚠️ Printful puts its ERROR MESSAGE in `result` as a plain string, so
        // `result` being truthy proves nothing — always check it's an array.
        // (An invalid status= value returns exactly that, and .slice().map then
        // dies with a message that names neither the endpoint nor the reason.)
        const grab = async (q) => {
          const r = await pf('/store/products' + q);
          return Array.isArray(r.result) ? r.result : { _said: JSON.stringify(r).slice(0, 140) };
        };
        // ⚖️ CAN THIS TOKEN CREATE PRODUCTS AT ALL? v1 /store/products refuses
        // Shopify-platform stores outright ("applies only to Manual Order /
        // API platform"), which is why 13 products have to be clicked by hand.
        // Probe v2 read-only before assuming the newer API inherits the ban —
        // a yes would turn a morning of clicking into one script.
        const v2 = await fetch('https://api.printful.com/v2/catalog-products?limit=1', {
          headers: { Authorization: `Bearer ${tok}` },
        }).then((r) => r.status + ' ' + JSON.stringify(r.ok ? { ok: 1 } : {}).slice(0, 60))
          .catch((e) => 'err ' + String(e && e.message).slice(0, 60));
        const v2sync = await fetch('https://api.printful.com/v2/sync-products?limit=1', {
          headers: { Authorization: `Bearer ${tok}` },
        }).then(async (r) => r.status + ' ' + (await r.text()).slice(0, 120))
          .catch((e) => 'err ' + String(e && e.message).slice(0, 60));
        // Deliberately EMPTY body: a 422/400 validation complaint proves the
        // endpoint is open to us and only the payload is missing, while 403 or
        // the platform ban proves it is closed. Creates nothing either way.
        const v2post = await fetch('https://api.printful.com/v2/sync-products', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: '{}',
        }).then(async (r) => r.status + ' ' + (await r.text()).slice(0, 220))
          .catch((e) => 'err ' + String(e && e.message).slice(0, 60));
        out.store[label + '_v2'] = { catalog: v2, sync_products: v2sync, can_create: v2post };
        const synced = await grab('?limit=50');
        const ignored = await grab('?status=ignored&limit=50');
        out.store[label + '_counts'] = {
          synced: Array.isArray(synced) ? synced.length : synced,
          ignored: Array.isArray(ignored) ? ignored.length : ignored,
          names: (Array.isArray(synced) ? synced : []).concat(Array.isArray(ignored) ? ignored : [])
            .slice(0, 12).map((p) => p.name),
        };
        const list = { result: Array.isArray(synced) ? synced : [] };
        const rows = [];
        for (const p of list.result.slice(0, 12)) {
          const d = await pf('/store/products/' + p.id);
          const sv = ((d.result || {}).sync_variants || [])[0];
          if (!sv) continue;
          const cvid = sv.product && sv.product.variant_id;
          const cv = cvid ? await pf('/products/variant/' + cvid) : null;
          rows.push({
            product: p.name,
            variants: ((d.result || {}).sync_variants || []).length,
            retail: sv.retail_price,
            cost: cv && cv.result && cv.result.variant ? cv.result.variant.price : null,
          });
        }
        out.store[label] = { stores: seen, products: rows.length, rows };
      } catch (e) {
        out.store[label] = 'threw: ' + String(e && e.message).slice(0, 160);
      }
    }
  }
  // 🚚 real shipping cost per product, on demand (/health?ship=1). Shipping is
  // baked into every price here, so it IS the margin on a cheap item — and it
  // was the one number we kept having to guess. Off by default: it's several
  // Printful calls and nobody needs it on a routine health check.
  if (ship && env.PRINTFUL_TOKEN) {
    // the destinations that actually buy — GA4's top session countries, not a
    // tidy sample. Shipping varies 2.5x across them, so a single global price
    // either loses money somewhere or stays high; this is how you find out which.
    const dests = {
      US: { address1: '1600 Pennsylvania Ave NW', city: 'Washington', state_code: 'DC', country_code: 'US', zip: '20500' },
      GB: { address1: '10 Downing St', city: 'London', country_code: 'GB', zip: 'SW1A 2AA' },
      CA: { address1: '80 Wellington St', city: 'Ottawa', state_code: 'ON', country_code: 'CA', zip: 'K1A 0A2' },
      AU: { address1: '1 Macquarie St', city: 'Sydney', state_code: 'NSW', country_code: 'AU', zip: '2000' },
      DE: { address1: 'Pariser Platz 1', city: 'Berlin', country_code: 'DE', zip: '10117' },
      NL: { address1: 'Dam 1', city: 'Amsterdam', country_code: 'NL', zip: '1012 JS' },
      NO: { address1: 'Karl Johans gate 1', city: 'Oslo', country_code: 'NO', zip: '0154' },
    };
    out.shipping = {};
    for (const p of PRODUCTS.filter((x) => x.printfulVariantId)) {
      out.shipping[p.key] = { price: p.priceHint };
      for (const [cc, recipient] of Object.entries(dests)) {
        try {
          const r = await fetch('https://api.printful.com/shipping/rates', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.PRINTFUL_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient, items: [{ variant_id: p.printfulVariantId, quantity: 1 }] }),
          });
          const b = await r.json().catch(() => ({}));
          const rates = b.result || [];
          // ⚠️ take the MINIMUM, don't trust result[0] to be sorted — a magnet
          // quoting dearer than a t-shirt is exactly how you'd notice you were
          // reading whichever rate Printful happened to list first.
          out.shipping[p.key][cc] = rates.length
            ? rates.map((x) => `${x.rate} ${x.currency}`).join(' | ')
            : `no rate (${b.error && b.error.message ? b.error.message.slice(0, 80) : r.status})`;
        } catch (e) { out.shipping[p.key][cc] = 'error'; }
      }
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
  // 📊 …and GA4, the same way and for the same reason. GA4 has never recorded
  // a purchase for ANYONE — the browser funnel stops at checkout_redirect and
  // the Shopify sales-channel link that was supposed to cover the rest never
  // fired, including for real paid orders. This makes the sale land regardless.
  try {
    console.log('ga4 mp:', await sendGa4Purchase(order, env));
  } catch (e) {
    console.error('ga4 mp threw (order still fulfils)', e && e.message);
  }

  // Collect custom-sticker line items (the cart attaches `_design_key`)
  const items = [];
  for (const li of order.line_items || []) {
    const props = Object.fromEntries((li.properties || []).map((p) => [p.name, p.value]));
    if (props._design_key && /^[a-f0-9-]{36}\.png$/.test(props._design_key)) {
      // which Printful variant to print = the line's Shopify variant or its
      // server-set sku, never a cart attribute (apparel still reads
      // _color/_size). Falls back to the sticker so nothing drops an order.
      // ⚠️ the sku is LOAD-BEARING for fulfilment since the product stopped
      // coming from a client attribute: an unresolvable design line would
      // print every paid tee or mug as a sticker, so say so out loud — this
      // is the money path's only silent-misprint route.
      if (!productForLine(li, props)) {
        console.error('webhook: design line resolved to NO product — printing the sticker default',
          JSON.stringify({ variant_id: li.variant_id, sku: li.sku || null }));
      }
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
        // same server-side resolve as fulfilment — a spoofable attribute must
        // not decide which product a sale is reported against either
        contents: lines.map((li) => ({
          id: String((productForLine(li, lineProps(li)) || {}).key || li.sku || li.variant_id || ''),
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

// 📊 GA4 Measurement Protocol purchase — the server-side twin of the Meta call
// above. Needs the GA4_API_SECRET secret (GA4 Admin → Data Streams → the web
// stream → Measurement Protocol API secrets). Without it this is a no-op, so
// deploying ahead of the secret is safe.
const GA4_ID = 'G-1C0QRT9SRK';

async function sendGa4Purchase(order, env) {
  if (!env.GA4_API_SECRET) return 'no secret — GA4 MP off';
  const lines = order.line_items || [];
  // the real browser client id rides in as a line attribute (sticker-core /
  // shop.js read it off the _ga cookie). Without it GA4 still COUNTS the sale
  // but credits it to a new user and no campaign — so fall back, don't skip.
  const cid = lineProps(lines[0] || {})._ga_cid || `shopify.${order.id}`;

  const payload = {
    client_id: cid,
    // GA4 dedups on this; if a browser-side purchase is ever added it must
    // send the same transaction_id or every sale counts twice.
    events: [{
      name: 'purchase',
      params: {
        transaction_id: String(order.order_number || order.id),
        value: Number(order.total_price) || 0,
        currency: order.currency,
        shipping: Number(order.total_shipping_price_set?.shop_money?.amount) || 0,
        tax: Number(order.total_tax) || 0,
        items: lines.map((li) => {
          const pr = lineProps(li);
          return {
            item_id: String((productForLine(li, pr) || {}).key || li.sku || li.variant_id || ''),
            item_name: li.title || li.name || 'banana',
            item_variant: [pr._color, pr._size].filter(Boolean).join(' / ') || undefined,
            price: Number(li.price) || 0,
            quantity: li.quantity || 1,
          };
        }),
      },
    }],
  };

  const res = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_ID}&api_secret=${env.GA4_API_SECRET}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  // ⚠️ MP answers 204 with NO body even for a malformed event — it never tells
  // you an event was rejected. Use the /debug/mp/collect endpoint to validate.
  return res.ok ? `sent (${res.status}, cid ${cid === `shopify.${order.id}` ? 'FALLBACK' : 'real'})`
    : `FAILED ${res.status}`;
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
