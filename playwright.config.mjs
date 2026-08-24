// 🎮 THE PLAYER-WALK (rig step 2, Dev Desk issue #2): Playwright walks the
// world like a player against the BUILT site (astro preview over dist/).
// Headless Chromium composites frames, so rAF-driven floors actually run —
// the hidden-tab pause that stalls manual testing does not apply here.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/print-parity.spec.mjs', // owned by playwright.parity.config.mjs
  timeout: 60000,
  retries: 1,                       // the world talks to live workers — one retry absorbs a hiccup
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 393, height: 852 },   // the house mobile target — the world is mobile-first
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
