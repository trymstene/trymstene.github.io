// 💼 THE JOB JOURNEY — against the LIVE pass worker from a local build (24 Sep 2026). Like the two-device proof it needs the
// one local origin the workers admit (http://localhost:8803) and QA_KEY for the QA login door; one worker, no retries.
// It is for the eye: it records every message a player is shown, in order, while a real saved pass asks for a job, is
// hired, works a first shift at each of the five workplaces, and quits. Run:
//   QA_KEY=… npx playwright test -c playwright.journey.config.mjs
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'job-journey.spec.mjs',
  timeout: 2700000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8803', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run preview -- --host localhost --port 8803',
    url: 'http://localhost:8803',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
