// Product (ecommerce) sitemap — the shop listing + every product page.
// Pulled from the same build-time Shopify fetch that builds the shop, so it
// stays in sync automatically as products are added.
import { getProducts, SITE } from '../lib/shop.js';

export async function GET() {
  const products = await getProducts();
  const locs = [`${SITE}/shop/`, ...products.map((p) => p.url)];
  const urls = locs.map((u) => `  <url><loc>${u}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
