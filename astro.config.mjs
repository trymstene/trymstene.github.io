// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static site for trymstene.com — deploys to GitHub Pages.
// trailingSlash 'always' + 'directory' format keeps the EXACT current URLs
// (e.g. /shop/, /me/, /dancing-banana-gif-meme/) so SEO is preserved.
export default defineConfig({
  site: 'https://trymstene.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      // keep the noindex old-Wix redirect stubs out of the sitemap
      filter: (page) =>
        ![
          'https://trymstene.com/about-me/',
          'https://trymstene.com/contact/',
          'https://trymstene.com/category/all-products/',
          'https://trymstene.com/projects/the-corporate-rangers/',
        ].includes(page),
    }),
  ],
});
