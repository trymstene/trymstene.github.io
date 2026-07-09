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
    shopifyVariantGid: null,    // ← set when the Shopify "Custom Banana Magnet" product exists
    printfulVariantId: 16366,   // Die-Cut Magnets (product 656), 3″×3″, cost $3.32
    size: '3″×3″ (7.5 cm)',
    material: 'flexible fridge magnet',
    priceHint: 169,
    live: false,                // "soon" until the Shopify variant + a worker deploy land
  },
];
