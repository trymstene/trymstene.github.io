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
//   priceHint          display fallback only; Shopify is the source of truth
//                      for the real (localized) price at checkout.
export default [
  {
    key: 'sticker',
    name: 'Sticker',
    shopifyVariantGid: 'gid://shopify/ProductVariant/48935555006683', // Custom Banana Sticker
    printfulVariantId: 10163,   // Kiss-Cut Stickers (product 358), 3″×3″, cost $2.50
    size: '3″×3″ (7.5 cm)',
    material: 'durable weatherproof vinyl',
    priceHint: 149,
    live: true,
  },
  {
    key: 'magnet',
    name: 'Magnet',
    shopifyVariantGid: 'gid://shopify/ProductVariant/48962172354779', // Custom Banana Magnet
    printfulVariantId: 16366,   // Die-Cut Magnets (product 656), 3″×3″, cost $3.32
    size: '3″×3″ (7.5 cm)',
    material: 'flexible fridge magnet',
    priceHint: 169,
    live: true,
  },
  {
    // THE TEE (13 Jul 2026, research-backed: apparel = #1 POD category; the
    // wearer's OWN dressed banana printed front and center). Color x size ride
    // as cart attributes on ONE Shopify variant (same price for all), and the
    // worker maps the selection to the right Printful variant server-side —
    // price stays Shopify-enforced, the selection is price-neutral.
    // Base garment: Bella+Canvas 3001 (Printful product 71, $13.50 all colors).
    // NO black/dark grounds (the banana's outline is black) and NO yellows
    // (banana camouflage) — Trym's call: colored/white, banana shines.
    key: 'tee',
    name: 'Tee',
    shopifyVariantGid: null, // ← Trym: create "Custom Banana Tee" (349 kr) in
    //   Shopify, publish to the Headless channel, paste the variant GID here
    //   and flip live: true. Everything else is already wired.
    printfulVariantId: 4012, // fallback = White / M (never used once options resolve)
    options: {
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
    priceHint: 349,
    live: false, // teaser tile until the Shopify product exists
  },
];
