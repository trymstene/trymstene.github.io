// Per-remix detail pages — one indexable URL per community banana meme, each
// carrying its GIF as an image entry (the Google-Images play). Kept in its own
// child sitemap so Search Console reports remix coverage separately.
import remixes from '../data/remixes.json';
import meta from '../data/remix-meta.json';

const SITE = 'https://trymstene.com';
const byId = Object.fromEntries(meta.map((m) => [m.id, m]));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function GET() {
  const urls = remixes
    .map((r) => {
      const m = byId[r.id];
      if (!m) return null;
      const loc = `${SITE}/dancing-banana-remixes/${m.slug}/`;
      const img = `${SITE}/assets/dancing-banana-community-remixes/${r.id}.gif`;
      return `  <url>\n    <loc>${loc}</loc>\n    <image:image><image:loc>${img}</image:loc><image:title>${esc(m.metaTitle)}</image:title></image:image>\n  </url>`;
    })
    .filter(Boolean)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
