// 📱📱 THE TWO-DEVICE PROOF — its own config because it runs against the LIVE
// workers from a local build, and the workers only admit two origins:
// trymstene.com and http://localhost:8803. The default walk (127.0.0.1:4321)
// is refused by design, which is why it allowlists worker noise; this one
// must not, so it gets its own port, one worker, and no retries that would
// blur a real failure into a flake.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'two-devices.spec.mjs',
  timeout: 480000,                  // two phones, real network, real debounces
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8803',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host localhost --port 8803',
    url: 'http://localhost:8803',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
