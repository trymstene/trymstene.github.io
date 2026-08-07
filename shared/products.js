// Shared product catalog for the custom-banana line (make-a-banana).
// ONE source of truth, read by THREE places so nothing is hardcoded twice:
//   • the builder picker tiles + PDP configs  → src/lib/sticker-core.js
//   • the PDP routes                          → src/pages/make-a-banana/[product].astro
//   • the fulfilment worker's Shopify→Printful variant map → worker/src/index.js
//
// Add a product = add ONE entry here, then redeploy the site + the worker. No
// branching logic anywhere — the tile grid, the product pages, and what gets
// printed all follow this list.
//
// ARRAY ORDER = display order in the "Take this banana home" tiles (Trym's
// merchandising call 13 Jul: tee leads, then sticker, then magnet).
//
// Fields:
//   key                unique slug — the PDP URL (/make-a-banana/<key>/), the
//                      mockup style ('magnet' gets a depth edge), the tile id.
//   shopifyVariantGid  what the cart sells (Storefront merchandiseId). The
//                      worker also derives the numeric id from this to know
//                      which order line items are which product. null = not
//                      wired in Shopify yet.
//   printfulVariantId  Printful catalog variant = what actually gets printed.
//   live               true = sellable (tile links to its PDP, worker fulfils).
//                      false = teaser: shown with a "soon" ribbon, not sold.
//   priceHint          display fallback only, in USD (store currency since
//                      15 Jul 2026); Shopify is the source of truth for the
//                      real (localized) price at checkout.
const PRODUCTS = [
  {
    // THE TEE (13 Jul 2026, research-backed: apparel = #1 POD category; the
    // wearer's OWN dressed banana printed front and center). Color x size ride
    // as cart attributes on ONE Shopify variant (same price for all), and the
    // worker maps the selection to the right Printful variant server-side —
    // price stays Shopify-enforced, the selection is price-neutral.
    // Base garment: Bella+Canvas 3001 (Printful product 71, $13.50 all colors).
    // NO black/dark grounds (the banana's outline is black) and NO yellows
    // (banana camouflage) — Trym's call: colored/white, banana shines.
    // ⚠️ ONE FLAT PRICE ACROSS EVERY COLOUR AND SIZE, while Printful's cost
    // CLIMBS WITH SIZE — Bella+Canvas 3001, checked 7 Aug: S-XL $11.95,
    // 2XL $13.69, then 3XL $15.69 / 4XL $17.69 / 5XL $19.69. The official tee
    // had the same shape and 5XL was losing ~$9 a sale before it got tiered.
    // ⭐ This one is SAFE ONLY BECAUSE `sizes` STOPS AT 2XL. $26.99 covers the
    // dearest offered size in the dearest market (2XL to Norway, +$1.44).
    // ⚠️ ADDING 3XL+ TO `sizes` WITHOUT RE-PRICING PUTS IT UNDERWATER AGAIN —
    // a 5XL at $26.99 loses money. Price the size, or don't offer it.
    key: 'tee',
    name: 'Tee',
    shopifyVariantGid: 'gid://shopify/ProductVariant/48971119526107', // Custom Banana Tee
    printfulVariantId: 4012, // fallback = White / M (never used once options resolve)
    options: {
      sizeGuideId: '71', // Printful catalog id → src/data/size-guides.json (build-size-guides.py)
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      colors: [
        { id: 'white',     label: 'White',      hex: '#ffffff', variants: { S: 4011, M: 4012, L: 4013, XL: 4014, '2XL': 4015 } },
        { id: 'red',       label: 'Red',        hex: '#d0071e', variants: { S: 4141, M: 4142, L: 4143, XL: 4144, '2XL': 4145 } },
        { id: 'royal',     label: 'True Royal', hex: '#01408d', variants: { S: 4171, M: 4172, L: 4173, XL: 4174, '2XL': 4175 } },
        { id: 'kelly',     label: 'Kelly',      hex: '#1a9462', variants: { S: 4086, M: 4087, L: 4088, XL: 4089, '2XL': 4090 } },
        { id: 'turquoise', label: 'Turquoise',  hex: '#54d9eb', variants: { S: 4176, M: 4177, L: 4178, XL: 4179, '2XL': 4180 } },
        { id: 'berry',     label: 'Berry',      hex: '#c02773', variants: { S: 4041, M: 4042, L: 4043, XL: 4044, '2XL': 4045 } },
      ],
    },
    size: 'S–2XL',
    material: 'soft unisex cotton tee (Bella+Canvas 3001)',
    priceHint: '26.99',
    live: true,
  },
  {
    key: 'sticker',
    name: 'Sticker',
    shopifyVariantGid: 'gid://shopify/ProductVariant/48935555006683', // Custom Banana Sticker
    printfulVariantId: 10163,   // Kiss-Cut Stickers (product 358), 3″×3″, cost $2.50
    size: '3″×3″ (7.5 cm)',
    material: 'durable weatherproof vinyl',
    priceHint: '11.99',
    live: true,
  },
  {
    // ☕ THE MUG (31 Jul 2026). The official line already had one; this is the
    // same object with YOUR banana on it. `print: 'mug'` routes the print file
    // to the WRAP renderer — the design is placed twice, once per half, so it
    // reads whichever hand you drink with and nothing straddles the handle
    // seam. Captions always print (see renderMugPrint).
    // ⚠️ SAME BLANK AS THE OFFICIAL MUG (Trym's call): Printful Enamel Mug
    // (product 407, variant 11189, 12oz, cost $12.25) — the white camper mug
    // with the dark rim, not the ceramic one. One mug in the line, two ways to
    // get it: ours on it, or yours.
    key: 'mug',
    name: 'Mug',
    shopifyVariantGid: 'gid://shopify/ProductVariant/49051171586267', // Custom Banana Mug
    printfulVariantId: 11189,
    print: 'mug',
    size: '12 oz (0.35 l)',
    material: 'white enamel camper mug with a rolled rim',
    // $12.25 blank + $4.49 US / $9.99 NO shipping, both measured 7 Aug via
    // /health?ship=1. Free shipping is baked in on BOTH lanes now.
    priceHint: '22.99',
    live: true, // ⚠️ flipped WITH Shopify DRAFT→ACTIVE — the two must never disagree
  },
];
// ✂️ THE MAGNET WAS RETIRED 7 Aug 2026 (Trym's call). Die-Cut Magnets, product
// 656 / variant 16366, $3.32 to print — but the worst shipper in the catalog by
// a distance: $10.99 to the UK, dearer than a t-shirt, with no cheaper rate
// offered. That pinned it near $15 while the sticker went to $11.99, so it read
// as the expensive twin of a better product. Its Shopify product is archived.

export default PRODUCTS;

// 🪟 THE WORLD SHOPS' WINDOW — the beach hut and the park merch cart each hang
// a little sign listing what's for sale. Both used to RETYPE the products and
// prices, and both went stale on every single price change (three times on
// 7 Aug alone) — signs a visitor walks up to and reads, quoting numbers the
// checkout no longer agreed with. They read this instead.
//
// The in-world voice stays lowercase and plain ("kiss-cut sticker", not
// "Sticker"), so the label lives here rather than in the manifest rows — but
// the PRICE and the LIVE list come from the one place that decides them.
// ⚠️ A product with no entry here still shows, using its manifest name.
const WINDOW_LABEL = { sticker: 'kiss-cut sticker', mug: 'mug', tee: 'tee' };

export const shopWindow = () => PRODUCTS
  .filter((p) => p.live)
  .map((p) => ({
    key: p.key,
    name: WINDOW_LABEL[p.key] || p.name.toLowerCase(),
    price: '$' + p.priceHint,
  }));
