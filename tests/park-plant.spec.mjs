// 🌱 PLANTING A SEED IN THE PARK, the way a player does (3 Oct 2026). The planting line read `free` — the wishing fountain's
// free seed, removed on 25 Sep — so every first plant of a visit threw right after the seed went in: the park_plant event
// went silent in Pulse for eight days and the naming moment after a first seed never came. Nothing walked the planting, so
// nothing saw it. This one taps an empty plot on the test garden, picks a radish, and needs the event and no page error.
import { test, expect } from '@playwright/test';

test('a seed planted in the park: the sheet opens, the radish goes in, Pulse hears it, and nothing throws', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route(/googletagmanager|google-analytics|cloudflareinsights|facebook|clarity|workers\.dev/, (r) => r.abort());
  await page.routeWebSocket(/workers\.dev/, () => {});
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); try { localStorage.setItem('cookie-consent-v1', 'n'); localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); localStorage.setItem('pass-v1', JSON.stringify({ created: Date.now() - 10 * 864e5, patches: {}, stats: { coins_earned: 500 }, days: [new Date().toISOString().slice(0, 10)] })); } catch (e) {} });
  await page.goto('/park/?parktest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__park && window.__park.PLOTS && window.__park.warp), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  // stand beside the first plot (the test garden starts empty), then tap it where it is on the screen
  const at = await page.evaluate(() => { const [x, y] = window.__park.PLOTS[0]; window.__park.warp(x + 40, y + 30); return { x, y }; });
  await page.waitForTimeout(1200);
  const scr = await page.evaluate(([x, y]) => { const w = document.getElementById('pkWorld').getBoundingClientRect(); return { x: w.left + (x / 2760) * w.width, y: w.top + (y / 1100) * w.height }; }, [at.x, at.y]);
  await page.mouse.click(scr.x, scr.y - 6);
  await page.waitForSelector('[data-seed="radish"]', { timeout: 8000 });
  await page.locator('[data-seed="radish"]').first().click();
  await expect.poll(() => page.evaluate(() => window.__ev.filter((e) => e[0] === 'park_plant').map((e) => e[1])), { timeout: 4000 })
    .toEqual([{ seed: 'radish', held: 1, paid: 5 }]);
  expect(errs, 'the planting line threw on every first plant (the fountain’s `free`)').toEqual([]);
});
