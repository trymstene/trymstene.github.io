// 🎟 SERIES 1 STICKER PACKS — the one source of truth for every surface that
// sells them: the front-page band, the GIF page's grid, the shop's section and
// the pack product pages. Trym, 5 Sep 2026: "this is now our main product for
// the site, its unique products you dont find other places."
//
// The pack CONTENTS live in tools/build-sticker-packs.py (PACKS) and arrive
// here through src/data/pack-art.json, written by tools/build-pack-art.py
// together with the pictures — so a sticker's name, its file and its print are
// one thing. Change a pack there, rerun both tools, and this file needs nothing.
import ART from './pack-art.json';

// $9.99 a sheet: the middle of the store rule's three honest options (blank
// $5.50 → $8.99 / $9.99 / $10.99). Keeps $3.90; a buyer pays $14.28 with
// shipping, of which shipping is 30% — against 46% on a single sticker.
export const PACK_PRICE = ART.price;
export const PACK_OG = '/assets/og/sticker-packs.png';

// Each pack is named after the ground its picture stands on (Trym, 5 Sep:
// "something short for each pack, instead of Pack 1, Pack 2" — the number
// stays as the PACK N flair printed on the picture). Change a ground in
// tools/build-pack-art.py MOODS, change its name here.
const NAMES = { 1: 'Park Life', 2: 'Sunshine', 3: 'Meadow', 4: 'Party', 5: 'Rave', 6: 'Beach Day', 7: 'Blue Sky', 8: 'Moods' };
export const SET_PRICE = 69.99;   // all eight, an automatic Shopify discount ($9.93 off at 8 packs)
export const STICKER_PACKS = Object.keys(ART.packs).map(Number).sort((a, b) => a - b).map((n) => {
  const stickers = ART.packs[n];
  return {
    n,
    name: NAMES[n] || `Pack ${n}`,
    num: `Pack ${n}`,
    // the Shopify handle as created on 5 Sep 2026 — client code (the download card)
    // links straight to it; build-time code prefers the live product's handle
    handle: `dancing-banana-official-sticker-pack-${n}`,
    stickers,
    hero: stickers.find((s) => s.hero) || stickers[1],
    // the five that make this pack THIS pack — the Original is in all eight and
    // is said once, under the grid, not eight times
    names: stickers.filter((s) => s.name !== 'The Original').map((s) => s.name),
  };
});
export const HEROES = STICKER_PACKS.map((p) => p.hero);

export const stickerSrc = (slug) => `/assets/packs/stickers/${slug}.webp`;   // one kiss-cut sticker, transparent
export const packSpread = (n) => `/assets/packs/pack-${n}-spread.webp`;     // 1200², the PDP's first picture
export const packCard = (n) => `/assets/packs/pack-${n}-card.webp`;         // 600², the grids
export const packThumb = (n) => `/assets/packs/pack-${n}-thumb.webp`;       // 240², the slim carousel
export const packSheet = (n) => `/assets/packs/pack-${n}-sheet.webp`;       // the A5 as it prints

// Which pack a Shopify product is. Shopify builds the handle from the title
// Trym types in Printful ("Dancing Banana Sticker Pack 3" →
// dancing-banana-sticker-pack-3), so the site keys on the tail and survives a
// brand prefix or a trademark sign in front of it.
export function packNumber(handle) {
  const m = /sticker-pack-(\d+)/.exec(handle || '');
  const n = m ? +m[1] : 0;
  return ART.packs[n] ? n : 0;
}
export function packProducts(products) {
  const out = {};
  for (const p of products) {
    const n = packNumber(p.handle);
    if (n && !out[n]) out[n] = p;
  }
  return out;
}

// PACK_PREVIEW=1 npm run build — stands in for the eight products until Trym
// has published them, so the pages can be walked before launch (design library
// rule 13: verify by looking). Never on by default; a real product always wins.
export function previewPacks(products) {
  // ⚠️ this module is also bundled for the browser (the download card) where
  // `process` does not exist — never touch it unguarded
  if (typeof process === 'undefined' || !process.env.PACK_PREVIEW) return [];
  const have = packProducts(products);
  return STICKER_PACKS.filter((p) => !have[p.n]).map((p) => {
    const handle = `dancing-banana-sticker-pack-${p.n}`;
    const v = { id: '', color: '', size: '', price: PACK_PRICE, cur: 'USD', available: false, image: packSpread(p.n) };
    return {
      handle, title: `Dancing Banana Sticker Pack ${p.n}`,
      descHtml: '<p>Preview build — this product is not published yet.</p>', embeddedGuide: null,
      featured: packSpread(p.n), images: [packSpread(p.n)], colors: [], sizes: [], colorImage: {},
      vmap: { '||': v }, variants: [v], cur: 'USD', pmin: PACK_PRICE, pmax: PACK_PRICE,
      url: `https://trymstene.com/shop/${handle}/`, preview: true,
    };
  });
}
