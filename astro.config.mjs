// @ts-check
import { defineConfig } from 'astro/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';
import { stripCssStrings } from './tools/css-strings.mjs';

// ✂️ public/js/*.js is copied into dist/ exactly as written, comments and all: main.js rides EVERY page and shop.js
// the product pages. Minified after the build (24 Sep 2026, the budget trim; 33 KB → 15 KB) so the source stays
// readable. es2020 like the rest of the bundle: the minifier must never write newer syntax than it was given.
const minifyPublicJs = {
  name: 'minify-public-js',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const js = new URL('js/', dir);
      for (const f of (await readdir(js)).filter((x) => x.endsWith('.js'))) {
        const p = fileURLToPath(new URL(f, js)), src = await readFile(p, 'utf8');
        const out = await transformWithEsbuild(src, f, { minify: true, charset: 'utf8', target: 'es2020', legalComments: 'none' });
        await writeFile(p, out.code);
        logger.info('/js/' + f + ' ' + Buffer.byteLength(src) + ' → ' + Buffer.byteLength(out.code) + ' B');
      }
    },
  },
};

// Static site for trymstene.com — deploys to GitHub Pages.
// trailingSlash 'always' + 'directory' format keeps the EXACT current URLs
// (e.g. /shop/, /me/, /dancing-banana-gif-meme/) so SEO is preserved.
// Sitemaps are hand-generated as endpoints (src/pages/sitemap-*.xml.js) so
// they can be SPLIT BY CATEGORY (content pages vs product pages) for clean
// per-sitemap coverage reports in Search Console.
export default defineConfig({
  site: 'https://trymstene.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [minifyPublicJs],
  // ✂️ the comments inside CSS that scripts carry as strings come out at build time (tools/css-strings.mjs)
  vite: { plugins: [{ name: 'css-strings', apply: 'build', enforce: 'pre',
    transform(code, id) {
      if (!/\/src\/.*\.js$/.test(id.split('?')[0]) || !code.includes(' = `')) return null;
      const out = stripCssStrings(code);
      return out === code ? null : { code: out, map: null };
    } }] },
  // /make/ was a fork page (builder vs forge) — now both live in the top nav,
  // so the middle step is gone. Keep old links/bookmarks alive → the builder.
  redirects: {
    '/make/': '/make-a-banana/',
    // 🎩 /supporters/ became /support/ on 4 Sep: one word, a verb, and short
    // enough to paste into an email when somebody asks how to help. The old
    // slug has been on the park board and in My Pass for weeks, so it stays.
    '/supporters/': '/support/',
    // 🛒 THE WIX STORE'S URLS. /product-page/<slug> was Wix's format and the
    // slugs outlived the migration — bots still probe them daily and a stale
    // bookmark would land on a 404. `?gone=1` tells main.js not to count the
    // arrival, so forwarding scrapers cannot inflate the shop's numbers.
    '/product-page/crop-top/': '/shop/?gone=1',
    '/product-page/dancing-banana-official-enamel-mug/': '/shop/?gone=1',
    '/product-page/dancing-banana-official-framed-photo-print/': '/shop/?gone=1',
    '/product-page/dancing-banana-official-mini-unisex-organic-t-shirt/': '/shop/?gone=1',
    '/product-page/music-band-unisex-classic-tee/': '/shop/?gone=1',
    '/product-page/sports-water-bottle/': '/shop/?gone=1',
    '/product-page/dancing-banana-official-bubble-free-stickers/': '/shop/?gone=1',
    '/product-page/dancing-banana-official-men-s-premium-tank-top/': '/shop/?gone=1',
    '/product-page/unisex-classic-tee/': '/shop/?gone=1',
    '/product-page/unisex-hoodie/': '/shop/?gone=1',
    '/product-page/where-do-you-see-yourself-in-10-years-unisex-classic-tee/': '/shop/?gone=1',
    // Park 2.0: the PARK is the area, the BANANA STAND is the shop in it —
    // the area page moved to /park/ (the old slug had spread through doors,
    // LED ads and guides; those all point at /park/ now).
    '/banana-stand/': '/park/',
    // /park2/ was the Park 2.0 QA preview slug until the 29 Jul flip.
    '/park2/': '/park/',
    // 🧱 THE WALL retired 2 Aug 2026. It rendered FOUR HAND-WRITTEN entries
    // from src/data/wall.json and never showed a single visitor submission — the
    // live /wall/items.json endpoint returns 'not found'. Meanwhile /wall/submit
    // was feeding the HQ queue all along, and approvals publish to the GALLERY.
    // So the page was a static showcase orphaned from its own submit button.
    // 23 impressions / 0 clicks in 90 days. The gallery does this job properly.
    '/wall/': '/banana-memes/',
    // 📁 GUIDES MOVED UNDER /guides/ on 2 Aug. They were flat at root while
    // the breadcrumb already said Home › Guides › X — and the gallery and
    // remixes both nest, so flat guides were the odd one out. Moved while the
    // pages had ZERO impressions in 90 days: free now, costly at fifty pages.
    // Root is finite — it belongs to the big things (/rave/, /park/, /shop/),
    // not to fifty spec pages.
    '/discord-emoji-size/': '/guides/discord-emoji-size/',
    '/twitch-emote-size/': '/guides/twitch-emote-size/',
    '/slack-emoji-size/': '/guides/slack-emoji-size/',
    '/telegram-sticker-size/': '/guides/telegram-sticker-size/',
    '/discord-sticker-size/': '/guides/discord-sticker-size/',
  },
});
