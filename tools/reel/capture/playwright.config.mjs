// the trailer's film crew: same built site as the walks (astro preview over dist/), one spec per shot
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /shot-.*\.spec\.mjs$/,
  timeout: 15 * 60000,
  retries: 0,
  workers: 2,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4321' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4321',
    cwd: '../../..',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
