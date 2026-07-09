// Custom-sticker BRAIN, shared by the builder (make-a-banana) and the custom
// product PDP (make-a-banana/sticker) so the design → mockup → print → checkout
// pipeline lives in ONE place. Config drift here = a broken sale, so both pages
// import these — never re-declare them. Framework-free; imports the engine.
import {
  GLASSES, HAT_BY_ID, EXTRA_DEFS, EFFECTS, NFRAMES,
  drawComposite as engineDraw,
} from './banana-engine.js';
import PRODUCTS from '../../shared/products.js';

// Shared store wiring — the SAME store + worker fulfil every custom product;
// only the variant changes per product (see shared/products.js). Storefront
// token is PUBLIC (safe to embed). See memory: sticker-flow.
export const SHOP = {
  workerBase: 'https://banana-sticker.trymstene.workers.dev',
  shopDomain: 'officialdancingbanana.myshopify.com',
  storefrontToken: '1032480366b6bf67760ba73ace4fe0f8',
};
export { PRODUCTS };
export function getProduct(key) { return PRODUCTS.find((p) => p.key === key) || null; }

// Back-compat: the sticker as a flat config. The builder's localized-price
// fetch + its (now-dormant) modal still import STICKER; new multi-product code
// uses SHOP + getProduct() instead.
export const STICKER = { ...SHOP, variantGid: (getProduct('sticker') || {}).shopifyVariantGid };

// What the visitor will actually pay — the static fallback; localizedPrice()
// overwrites it with exactly what checkout charges in the visitor's currency.
export const PRICE = { amount: 149, currency: 'NOK' };

// ---- design serialization -------------------------------------------------
// Parse a builder share-link (URLSearchParams) into a render state. URL-only:
// the PDP always arrives with the whole design in the query string. Mirrors
// the builder's load() so a link renders identically on both pages.
export function parseDesign(p) {
  const state = { bg: 'transparent', top: '', bottom: '', glasses: 'none', hat: 'none', extras: {}, effect: 'none', frame: 0 };
  if (p.get('bg')) state.bg = p.get('bg');
  state.top = p.get('t') || ''; state.bottom = p.get('b') || '';
  const g = p.get('g'); state.glasses = GLASSES.some(([v]) => v === g) ? g : (g ? 'shades' : 'none'); // old classic/cool links → shades
  const h = p.get('h'); state.hat = HAT_BY_ID[h] ? h : 'none';
  (p.get('ex') || '').split('.').forEach((id) => { if (EXTRA_DEFS.some((d) => d.id === id)) state.extras[id] = true; });
  if (p.get('mu') === '1') state.extras.mustache = true; // legacy params
  if (p.get('bt') === '1') state.extras.bowtie = true;
  const e = p.get('e') || p.get('m'); // old m=disco links still work
  if (EFFECTS.some(([v]) => v === e)) state.effect = e;
  const f = parseInt(p.get('f'), 10); if (f >= 0 && f < NFRAMES) state.frame = f;
  return state;
}

// client moderation gate (EN+NO, substring) — blunt on purpose; the real gate
// is Trym approving every Printful draft before it prints (see memory).
const BLOCKLIST = ['fuck','shit','bitch','cunt','nigg','fagg','retard','whore','slut','porn','rape','hitler','nazi','faen','jævla','jævel','fitte','kuk','pikk','hore','kneppe'];
export function captionsClean(state) {
  const t = ((state.top || '') + ' ' + (state.bottom || '')).toLowerCase();
  return !BLOCKLIST.some((w) => t.includes(w));
}

// short human/analytics fingerprint of a design
export function designStr(state) {
  const ex = Object.keys(state.extras).filter((k) => state.extras[k]).join('+') || 'none';
  return [state.hat, state.glasses, ex, state.effect, state.bg].join('|');
}

// draw this state's outfit'd banana (the engine takes explicit outfit args)
export function composite(ctx, W, idx, state, o = {}) {
  return engineDraw(ctx, W, idx, {
    hat: state.hat, glasses: state.glasses, extras: state.extras,
    top: state.top, bottom: state.bottom, ...o,
  });
}

// ---- pixel helpers (trim transparent designs to their content) ------------
export function bboxOf(framesData, W) {
  let minX = W, minY = W, maxX = 0, maxY = 0, found = false;
  for (const data of framesData) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 16) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (!found) return { x: 0, y: 0, w: W, h: W };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
export function pad(bb, W) {
  const p = Math.round(Math.max(bb.w, bb.h) * 0.04);
  const x = Math.max(0, bb.x - p), y = Math.max(0, bb.y - p);
  return { x, y, w: Math.min(W - x, bb.w + p * 2), h: Math.min(W - y, bb.h + p * 2) };
}
export function crop(cv, bb) {
  const o = document.createElement('canvas'); o.width = bb.w; o.height = bb.h;
  o.getContext('2d').drawImage(cv, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); return o;
}

// ---- the print file (what actually gets printed) --------------------------
// Two sticker styles (Trym's call): TRANSPARENT bg → trimmed transparent PNG
// so Printful DIE-CUTS along the outline; a COLOURED bg → the full square.
export function renderPrintFile(state) {
  const W = 2048;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
  composite(ctx, W, state.frame, state, {
    bg: state.bg, captions: true, effect: state.effect,
    hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
  });
  if (state.bg === 'transparent') {
    const data = ctx.getImageData(0, 0, W, W).data;
    return crop(cv, pad(bboxOf([data], W), W));
  }
  return cv;
}

// ---- product MOCKUP (what the buyer sees) ---------------------------------
// die-cut white contour for transparent designs, rounded white square for
// coloured ones. product='magnet' adds a grey depth band = visible thickness.
export function makeStickerMockup(state, design, size = 900, style = 'sticker') {
  const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e8e4da'; ctx.fillRect(0, 0, size, size); // paper backdrop
  const margin = size * 0.14;
  const s = Math.min((size - 2 * margin) / design.width, (size - 2 * margin) / design.height);
  const dw = design.width * s, dh = design.height * s;
  const dx = (size - dw) / 2, dy = (size - dh) / 2;
  const border = size * 0.02; // the white kiss-cut edge
  const thick = style === 'magnet' ? size * 0.022 : 0; // magnets show visible depth

  if (state.bg === 'transparent') {
    const sil = document.createElement('canvas'); sil.width = size; sil.height = size;
    const sctx = sil.getContext('2d');
    sctx.drawImage(design, dx, dy, dw, dh);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = '#fff'; sctx.fillRect(0, 0, size, size);
    const outline = document.createElement('canvas'); outline.width = size; outline.height = size;
    const octx = outline.getContext('2d');
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * 2 * Math.PI;
      octx.drawImage(sil, Math.cos(a) * border, Math.sin(a) * border);
    }
    octx.drawImage(sil, 0, 0);
    if (thick) {
      const dark = document.createElement('canvas'); dark.width = size; dark.height = size;
      const dctx = dark.getContext('2d');
      dctx.drawImage(outline, 0, 0);
      dctx.globalCompositeOperation = 'source-in';
      dctx.fillStyle = '#c7c1b4'; dctx.fillRect(0, 0, size, size);
      ctx.drawImage(dark, thick, thick);
    }
    ctx.save();
    ctx.shadowColor = 'rgba(17,17,17,0.28)'; ctx.shadowBlur = size * 0.03; ctx.shadowOffsetY = size * 0.012;
    ctx.drawImage(outline, 0, 0);
    ctx.restore();
    ctx.drawImage(outline, 0, 0);
    ctx.drawImage(design, dx, dy, dw, dh);
  } else {
    const r = size * 0.035;
    if (thick) {
      ctx.save(); ctx.fillStyle = '#c7c1b4';
      ctx.beginPath(); ctx.roundRect(dx - border + thick, dy - border + thick, dw + 2 * border, dh + 2 * border, r); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = 'rgba(17,17,17,0.28)'; ctx.shadowBlur = size * 0.03; ctx.shadowOffsetY = size * 0.012;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect(dx - border, dy - border, dw + 2 * border, dh + 2 * border, r); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, r * 0.5); ctx.clip();
    ctx.drawImage(design, dx, dy, dw, dh);
    ctx.restore();
  }
  return cv;
}

// ---- localized price ------------------------------------------------------
// Ask the Worker where the visitor is (Cloudflare knows for free), then ask
// Shopify what THAT country pays via @inContext — exactly what checkout will
// charge. Returns { display, amount, currency } or null on any failure.
export async function localizedPrice(product = getProduct('sticker')) {
  try {
    if (!product || !product.shopifyVariantGid) return null;
    const geo = await fetch(SHOP.workerBase + '/geo').then((r) => r.json());
    const cc = String(geo.country || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return null;
    const res = await fetch('https://' + SHOP.shopDomain + '/api/2024-10/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOP.storefrontToken },
      body: JSON.stringify({
        query: 'query($id: ID!, $country: CountryCode!) @inContext(country: $country) { node(id: $id) { ... on ProductVariant { price { amount currencyCode } } } }',
        variables: { id: product.shopifyVariantGid, country: cc },
      }),
    }).then((r) => r.json());
    const p = res && res.data && res.data.node && res.data.node.price;
    if (!p) return null;
    PRICE.amount = parseFloat(p.amount); PRICE.currency = p.currencyCode;
    const display = new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currencyCode, maximumFractionDigits: 0 }).format(parseFloat(p.amount));
    return { display, amount: PRICE.amount, currency: PRICE.currency };
  } catch (e) { return null; }
}

// ---- checkout -------------------------------------------------------------
// Upload the print PNG to the Worker (→ R2), then create a Shopify cart with
// the design attached as line-item attributes. Returns the checkoutUrl (the
// caller redirects). Throws on any failure so the caller can recover the UI.
export async function uploadAndCheckout(printCanvas, product = getProduct('sticker')) {
  if (!product || !product.shopifyVariantGid) throw new Error('product not available for sale');
  const blob = await new Promise((r) => printCanvas.toBlob(r, 'image/png'));
  const up = await fetch(SHOP.workerBase + '/upload', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
  if (!up.ok) throw new Error('upload failed: ' + up.status);
  const { key, url } = await up.json();

  const mutation = 'mutation($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { checkoutUrl } userErrors { message } } }';
  const res = await fetch('https://' + SHOP.shopDomain + '/api/2024-10/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': SHOP.storefrontToken },
    body: JSON.stringify({
      query: mutation,
      variables: { lines: [{ merchandiseId: product.shopifyVariantGid, quantity: 1, attributes: [
        { key: '_design_key', value: key },   // machine-readable, hidden in checkout
        { key: 'Design', value: url },        // visible link so the customer sees THEIR banana
      ] }] },
    }),
  });
  const data = await res.json();
  const checkout = data && data.data && data.data.cartCreate && data.data.cartCreate.cart && data.data.cartCreate.cart.checkoutUrl;
  if (!checkout) throw new Error('cart failed: ' + JSON.stringify(data));
  return { checkoutUrl: checkout, key, url };
}
