// 🎮 THE PLAYER-WALK — every world area booted like a player, every visit
// asserting the LAST module came alive, not the first pixel (the
// partial-init trap as a literal test). Each area also gets a screenshot
// into test-results/walk/ — CI keeps them as artifacts, the future blessed
// set diffs against them.
import { test, expect } from '@playwright/test';

// The world talks to live Cloudflare workers; from a test origin some of that
// is EXPECTED to fail (websocket origin checks, CORS on localhost). Those are
// environment noise, not bugs — everything else in the console is a failure.
const EXPECTED_NOISE = [
  /banana-rave\.trymstene\.workers\.dev/,
  /banana-sticker\.trymstene\.workers\.dev/,
  /banana-contact\.trymstene\.workers\.dev/,
  /banana-share\.trymstene\.workers\.dev/,
  /WebSocket/i,
  /CORS|Access-Control/i,
  /Failed to load resource.*(net::ERR_FAILED|status of 403)/,
  /googletagmanager|google-analytics|clarity\.ms|facebook/,
];
const realErrors = (errs) => errs.filter((e) => !EXPECTED_NOISE.some((rx) => rx.test(e)));

function watchConsole(page) {
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  return errs;
}

// area → { path, lastAlive: [selector, minCount] } — the marker is chosen from
// LATE in each area's boot, so a partial init cannot pass.
const AREAS = [
  { name: 'rave', path: '/rave/', lastAlive: ['#rvStats .rv-stat', 3] },
  { name: 'park', path: '/park/', lastAlive: ['#pkWorld canvas, #pkView canvas', 1] },
  { name: 'beach', path: '/beach/', lastAlive: ['#bhWorld canvas, #bhView canvas', 1] },
  { name: 'homestead', path: '/homestead/', lastAlive: ['#hsWorld canvas', 1] },
  { name: 'builder', path: '/make-a-banana/', lastAlive: ['canvas', 1] },
];

for (const area of AREAS) {
  test(`the ${area.name} boots to its last module`, async ({ page }) => {
    const errs = watchConsole(page);
    await page.goto(area.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000); // let the world land: engines, rooms, first spawns
    const [sel, min] = area.lastAlive;
    const count = await page.locator(sel).count();
    expect(count, `${area.name}: late-boot marker "${sel}"`).toBeGreaterThanOrEqual(min);
    const bad = realErrors(errs);
    expect(bad, `${area.name} console:\n${bad.join('\n')}`).toHaveLength(0);
    await page.screenshot({ path: `test-results/walk/${area.name}.png`, fullPage: false });
  });
}

test('the rave teaches a first-timer (the hello run)', async ({ page }) => {
  const errs = watchConsole(page);
  await page.goto('/rave/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  // the arc needs a PLAYER first — solo mode can be slow when the websocket
  // fails lazily, so wait for the banana, then the lesson (≤3s after)
  await page.waitForSelector('.rv-raver', { timeout: 30000 });
  await page.waitForSelector('.rv-hellotag', { timeout: 12000 });
  await expect(page.locator('.rv-hellotag')).toHaveText(/tap to grab/i);
  await page.screenshot({ path: 'test-results/walk/rave-hello.png' });
  const bad = realErrors(errs);
  expect(bad, `hello-run console:\n${bad.join('\n')}`).toHaveLength(0);
});

test('the light show sweeps (lasers live on the floor)', async ({ page }) => {
  await page.goto('/rave/?lasertest', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.rv-laser', { timeout: 20000 });
  const beam = page.locator('.rv-laser__beam').first();
  await expect(beam).toBeVisible();
  await page.screenshot({ path: 'test-results/walk/rave-laser.png' });
});
