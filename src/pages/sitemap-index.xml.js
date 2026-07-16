// Sitemap index — references the category-split child sitemaps.
// robots.txt points here; submit this in Search Console (or submit each
// child separately for per-category coverage reports).
const SITE = 'https://trymstene.com';

const CHILDREN = ['/sitemap-pages.xml', '/sitemap-remixes.xml', '/sitemap-gallery.xml', '/sitemap-products.xml'];

export function GET() {
  const items = CHILDREN.map((c) => `  <sitemap><loc>${SITE}${c}</loc></sitemap>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
