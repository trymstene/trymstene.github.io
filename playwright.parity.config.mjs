// 🖨 PRINT PARITY config (rig step 4): runs ONLY tests/print-parity.spec.mjs
// against the built site — the walk's config ignores that spec, this one owns
// it. Single worker: each render holds a 8300² canvas (~275MB), two at once
// would fight for memory. No retries: the render is deterministic, a failure
// is a finding.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'print-parity.spec.mjs',
  timeout: 600000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4321',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
