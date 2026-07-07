// Content pages sitemap (everything that isn't an ecommerce/product URL).
// Includes <image:image> entries — Google Images is a primary discovery
// channel for a GIF-seeking audience, so we tell it exactly which images
// matter on each page.
import { locales } from '../data/locales.js';

const SITE = 'https://trymstene.com';

// Canonical content URLs. Redirect stubs are noindex and intentionally excluded.
// images: [path, title] pairs surfaced to Google Images for that page.
const PAGES = [
  { path: '/', images: [['/assets/og/default.png', 'The Dancing Banana — trymstene.com']] },
  {
    path: '/dancing-banana-gif-meme/',
    images: [
      ['/assets/dancing-banana-gif.gif', 'The original Dancing Banana GIF (1999) by Trym Stene'],
      ['/assets/dancing-banana-transparent.gif', 'Dancing Banana GIF with transparent background'],
      ['/assets/dancing-banana-transparent.png', 'Dancing Banana transparent PNG'],
      ['/assets/example-banana-1.png', 'Custom dancing banana with a cowboy hat'],
      ['/assets/example-banana-2.png', 'Custom dancing banana with top hat, moustache and bow tie'],
      ['/assets/example-banana-3.png', 'Custom dancing banana with party hat and heart shades'],
    ],
  },
  { path: '/make-a-banana/', images: [['/assets/og/builder.png', 'Make your own Dancing Banana — free banana builder']] },
  { path: '/banana-of-the-day/', images: [] },
  {
    path: '/dancing-banana-wallpaper/',
    images: [
      ['/assets/wallpapers/dancing-banana-wallpaper-classic-desktop.png', 'Dancing Banana wallpaper — classic yellow, 1920x1080'],
      ['/assets/wallpapers/dancing-banana-wallpaper-ink-desktop.png', 'Dancing Banana wallpaper — dark mode, 1920x1080'],
      ['/assets/wallpapers/dancing-banana-wallpaper-pattern-desktop.png', 'Dancing Banana pattern wallpaper, 1920x1080'],
      ['/assets/wallpapers/dancing-banana-wallpaper-classic-phone.png', 'Dancing Banana phone wallpaper — classic yellow'],
    ],
  },
  {
    path: '/dancing-banana-emoji/',
    images: [
      ['/assets/dancing-banana-transparent.gif', 'Dancing Banana emoji for Discord, Slack and Telegram'],
      ['/assets/dancing-banana-transparent.png', 'Dancing Banana emoji transparent PNG'],
    ],
  },
  {
    path: '/dancing-banana-remixes/',
    images: [
      ['/assets/dancing-banana-community-remixes/bananadance-warrior.gif', 'The warrior banana — Dancing Banana community remix'],
      ['/assets/dancing-banana-community-remixes/mariodance-pbj.gif', 'Dancing Mario — Peanut Butter Jelly Time community remix'],
    ],
  },
  { path: '/peanut-butter-jelly-time/', images: [['/assets/dancing-banana-gif.gif', 'The Peanut Butter Jelly Time banana — the original Dancing Banana']] },
  { path: '/license-the-dancing-banana/', images: [['/assets/dancing-banana-gif.gif', 'License the original Dancing Banana GIF']] },
  { path: '/projects/', images: [] },
  { path: '/contact/', images: [] },
  { path: '/me/', images: [['/assets/trym-stene-profile-photo.jpg', 'Trym Stene — creator of the Dancing Banana GIF']] },
  ...locales.map((l) => ({
    path: `/${l.code}/`,
    images: [['/assets/dancing-banana-gif.gif', 'The original Dancing Banana GIF (1999) by Trym Stene']],
  })),
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function GET() {
  const urls = PAGES.map((p) => {
    const imgs = p.images
      .map(([src, title]) => `    <image:image><image:loc>${SITE}${src}</image:loc><image:title>${esc(title)}</image:title></image:image>`)
      .join('\n');
    return `  <url>\n    <loc>${SITE}${p.path}</loc>\n${imgs ? imgs + '\n' : ''}  </url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
