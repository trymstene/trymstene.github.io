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
  },
});
