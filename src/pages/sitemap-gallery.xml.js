// THE BANANA GALLERY sitemap — hub, category, tag and per-item pages, each
// item carrying its GIF as an image entry (the Google-Images play). Own child
// sitemap so Search Console reports gallery coverage separately.
import { loadGalleryItems } from '../lib/gallery-items.js';
import { liveTagList } from '../data/gallery-tags.js';

const SITE = 'https://trymstene.com';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET() {
  const items = await loadGalleryItems();
  // community lane: approved submissions served by the share worker
  let community = [];
  try {
    const res = await fetch('https://banana-share.trymstene.workers.dev/gallery/approved');
    if (res.ok) community = await res.json();
  } catch (e) {}

  const liveTags = liveTagList(items, community);

  const urls = [];
  urls.push(`  <url>\n    <loc>${SITE}/banana-memes/</loc>\n  </url>`);
  for (const c of ['stickers', 'gifs']) {
    urls.push(`  <url>\n    <loc>${SITE}/banana-memes/${c}/</loc>\n  </url>`);
  }
  for (const t of liveTags) {
    urls.push(`  <url>\n    <loc>${SITE}/banana-memes/${t}/</loc>\n  </url>`);
  }
  for (const i of items) {
    const loc = `${SITE}/banana-memes/${i.id}/`;
    const img = `${SITE}/assets/gallery-bananas/${i.file}`;
    const kind = i.kind === 'sticker' ? 'transparent dancing banana sticker' : 'dancing banana meme GIF';
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    <image:image><image:loc>${img}</image:loc><image:title>${esc(`${i.title} — ${kind}`)}</image:title></image:image>\n  </url>`);
  }
  urls.push(`  <url>\n    <loc>${SITE}/banana-memes/by/</loc>\n  </url>`);
  for (const c of community) {
    const loc = `${SITE}/banana-memes/by/${c.slug}/`;
    const img = `https://banana-share.trymstene.workers.dev/gallery/gif/${c.slug}.gif`;
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    <image:image><image:loc>${img}</image:loc><image:title>${esc(`${c.title} — a custom dancing banana by ${c.by || 'a banana fan'}`)}</image:title></image:image>\n  </url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
