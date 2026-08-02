// @ts-check
import { defineConfig } from 'astro/config';

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
  // /make/ was a fork page (builder vs forge) — now both live in the top nav,
  // so the middle step is gone. Keep old links/bookmarks alive → the builder.
  redirects: {
    '/make/': '/make-a-banana/',
    // Park 2.0: the PARK is the area, the BANANA STAND is the shop in it —
    // the area page moved to /park/ (the old slug had spread through doors,
    // LED ads and guides; those all point at /park/ now).
    '/banana-stand/': '/park/',
    // /park2/ was the Park 2.0 QA preview slug until the 29 Jul flip.
    '/park2/': '/park/',
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
