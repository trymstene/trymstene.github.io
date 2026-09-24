// ✂️ public/js/main.js (every page) and shop.js (the product pages) are minified into dist/ by the build since 24 Sep 2026
// (astro.config.mjs, the budget trim). Minified is not the same as working: the cookie choice, the phone menu and the
// footer are main.js's, walked here on the built site. shop.js's Buy is walked by tests/checkout-veil.spec.mjs.
import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Europe/Oslo' });

test('main.js, minified: the cookie choice, the phone menu and the footer year all still work', async ({ page, request }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const src = await (await request.get('/js/main.js')).text();
  expect(src.includes('ground-truth pageview counter'), 'shipped without its comments').toBe(false);
  expect(src.length, 'and small').toBeLessThan(10000);
  await page.goto('/?cookietest');
  const banner = page.locator('.ccb');
  await expect(banner, 'the cookie question is asked').toBeVisible();
  await page.locator('.ccb__btn--no').click();
  await expect(banner, 'and a no takes it away').toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('cookie-consent-v1'), window.__cookieConsent.denied])).toEqual(['n', true]);
  await page.locator('.nav__toggle').click();
  await expect(page.locator('.nav'), 'the phone menu opens').toHaveClass(/\bopen\b/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.nav'), 'and Escape closes it').not.toHaveClass(/\bopen\b/);
  expect(await page.locator('#year').textContent(), 'the footer year').toBe(String(new Date().getFullYear()));
  expect(errs).toEqual([]);
});
