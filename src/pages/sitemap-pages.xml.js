// Content pages sitemap (everything that isn't an ecommerce/product URL).
import { locales } from '../data/locales.js';

const SITE = 'https://trymstene.com';

// Canonical content URLs. Redirect stubs are noindex and intentionally excluded.
const PAGES = [
  '/',
  '/dancing-banana-gif-meme/',
  '/make-a-banana/',
  '/dancing-banana-emoji/',
  '/peanut-butter-jelly-time/',
  '/license-the-dancing-banana/',
  '/projects/',
  '/me/',
  ...locales.map((l) => `/${l.code}/`),
];

export function GET() {
  const urls = PAGES.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
