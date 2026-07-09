// Shop data — fetched from the Shopify Storefront API at BUILD time and
// normalized for the PLP (/shop/) and PDP (/shop/<handle>/) pages.
// The token is the PUBLIC publishable Storefront token (safe to embed).
// This replaces the old build-shop.py + products.json flow: the shop now
// re-syncs automatically on every build/deploy.

const SHOP = 'officialdancingbanana.myshopify.com';
const TOKEN = '1032480366b6bf67760ba73ace4fe0f8';
const API = `https://${SHOP}/api/2024-10/graphql.json`;
export const SITE = 'https://trymstene.com';

const QUERY = `{ products(first: 50) { edges { node {
  handle title descriptionHtml productType
  featuredImage { url altText }
  images(first: 30) { edges { node { url altText } } }
  options { name values }
  priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
  variants(first: 120) { edges { node { id title availableForSale price { amount currencyCode } selectedOptions { name value } image { url altText } } } }
} } } }`;

// ---- colour name -> swatch hex ----
// REAL Printful catalog hexes (Gildan 18500 hoodie + 5000 tee — /products/146,438),
// so the swatch matches the garment. Add new colours here as products are added;
// an unmapped name falls back to grey (a visible signal that it needs adding).
const COLOR_HEX = {
  ash: '#dedede', azalea: '#ff9faf', black: '#0b0b0b', 'brown savana': '#9f8971',
  'carolina blue': '#8db7f6', charcoal: '#534e4a', 'dark chocolate': '#35241b',
  'dark heather': '#47484d', 'forest green': '#222e1f', gold: '#ffaf24',
  'graphite heather': '#686868', 'heather sport dark navy': '#515a6e',
  heliconia: '#f63880', 'indigo blue': '#395d82', 'irish green': '#1d9345',
  'light blue': '#a1c5e1', 'light pink': '#f3d4e3', maroon: '#47171c',
  'military green': '#7e8560', navy: '#131928', orange: '#ff5723',
  purple: '#4a1c7d', red: '#da0a1a', royal: '#1d50a4', sand: '#e7d3b3',
  'sport grey': '#9b969c', white: '#ffffff', natural: '#efe7d2',
};
export const colorHex = (name) => COLOR_HEX[(name || '').trim().toLowerCase()] || '#cccccc';

// ---- size ordering ----
const SIZE_RANK = { XXS: -1, XS: 0, S: 1, M: 2, L: 3, XL: 4, '2XL': 5, XXL: 5, '3XL': 6, XXXL: 6, '4XL': 7, '5XL': 8, '6XL': 9 };
const sizeRank = (s) => (s.toUpperCase() in SIZE_RANK ? SIZE_RANK[s.toUpperCase()] : 50);

export const money = (amount, cur) => {
  const n = parseFloat(amount);
  return `${cur} ${Number.isInteger(n) ? n : n.toFixed(2)}`; // 249, not 249.00
};

const plain = (html) =>
  (html || '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

export function firstSentence(html, limit = 140) {
  const t = plain(html);
  let s = t.split(/(?<=[.!?])\s/)[0] || t;
  if (s.length > limit) s = s.slice(0, limit).replace(/\s+\S*$/, '') + '…';
  return s;
}

// ---- size guides (inches). cm computed. Verify against Printful. ----
export const SIZE_GUIDE_TEE = {
  note: 'Standard Unisex Classic Tee (Gildan 5000) measurements. Lay a tee flat to compare. Please verify against your Printful size guide.',
  cols: ['Length', 'Chest width (flat)'],
  rows: { S: [28, 18], M: [29, 20], L: [30, 22], XL: [31, 24], '2XL': [32, 26], '3XL': [33, 28], '4XL': [34, 30], '5XL': [35, 32] },
};
export function guideFor(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('classic tee') || (t.includes('unisex') && t.includes('tee'))) return SIZE_GUIDE_TEE;
  return null;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function sizeTableHtml(m) {
  const g = guideFor(m.title);
  if (!g) return '<p>Fit runs true to size. For exact measurements, <a href="/me/#contact">drop me a message</a> and I\'ll send the size chart.</p>';
  const rows = m.sizes.filter((s) => s in g.rows);
  const head = g.cols.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = (rows.length ? rows : Object.keys(g.rows)).map((s) => {
    const cells = [`<td><b>${esc(s)}</b></td>`];
    for (const inch of g.rows[s]) {
      const cm = Math.round(inch * 2.54);
      cells.push(`<td><span data-unit="in">${inch}"</span><span data-unit="cm" style="display:none">${cm} cm</span></td>`);
    }
    return `<tr>${cells.join('')}</tr>`;
  }).join('');
  return (
    '<div class="size-toggle" role="group" aria-label="Units">' +
    '<button data-unit="in" aria-pressed="true">inches</button>' +
    '<button data-unit="cm" aria-pressed="false">cm</button></div>' +
    `<table class="size-table"><caption>${esc(g.note)}</caption>` +
    `<thead><tr><th>Size</th>${head}</tr></thead><tbody>${body}</tbody></table>`
  );
}

// ---- normalize a Shopify product node ----
function model(node) {
  const handle = node.handle;
  const title = node.title;
  const descHtml = node.descriptionHtml || '';
  const images = node.images.edges.map((e) => e.node.url);
  const featured = (node.featuredImage && node.featuredImage.url) || images[0] || '';
  const opts = {};
  (node.options || []).forEach((o) => { opts[o.name] = o.values; });

  const variants = node.variants.edges.map((e) => {
    const v = e.node;
    const so = {};
    (v.selectedOptions || []).forEach((x) => { so[x.name] = x.value; });
    return {
      id: v.id, color: so.Color || '', size: so.Size || '',
      price: parseFloat(v.price.amount), cur: v.price.currencyCode,
      available: !!v.availableForSale, image: (v.image && v.image.url) || featured,
    };
  });

  let colors = (opts.Color || []).filter((c) => variants.some((v) => v.color === c));
  if (!colors.length) colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))].sort((a, b) => sizeRank(a) - sizeRank(b));

  const colorImage = {};
  for (const c of colors) {
    const hit = variants.find((v) => v.color === c && v.image);
    colorImage[c] = (hit && hit.image) || featured;
  }

  // key EVERY variant by color||size (either dimension may be empty '' for
  // products that only have sizes, only colours, or a single variant) — else
  // size-only / single-variant products (poster, mug, tote) get no buyable map.
  const vmap = {};
  for (const v of variants) vmap[`${v.color}||${v.size}`] = v;

  const prices = variants.map((v) => v.price);
  const cur = variants.length ? variants[0].cur : 'NOK';

  return {
    handle, title, descHtml, featured, images, colors, sizes, colorImage, vmap, variants, cur,
    pmin: prices.length ? Math.min(...prices) : 0,
    pmax: prices.length ? Math.max(...prices) : 0,
    url: `${SITE}/shop/${handle}/`,
  };
}

// Products that must NOT get a PLP card / PDP page: the custom sticker is only
// purchasable through the make-a-banana builder (which attaches the design) —
// a bare PDP would let people buy it with no design attached.
const BUILDER_ONLY = new Set(['custom-banana-sticker']);

let _cache;
export async function getProducts() {
  if (_cache) return _cache;
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
    body: JSON.stringify({ query: QUERY }),
  });
  if (!res.ok) throw new Error(`Shopify Storefront API ${res.status} at build time`);
  const json = await res.json();
  const nodes = (((json.data || {}).products || {}).edges || []).map((e) => e.node);
  _cache = nodes.filter((n) => !BUILDER_ONLY.has(n.handle)).map(model);
  return _cache;
}
