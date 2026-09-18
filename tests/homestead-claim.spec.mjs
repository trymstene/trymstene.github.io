// 🪧 the homestead's claim waits for the story (Trym, 18 Sep 2026): a new banana is not asked to name the place;
// the sign's hint is hidden and a tap on the sign says why; at the story's move-in the sign asks, and the card closes.
import { test, expect } from '@playwright/test';

// a real tap on the sign: stand next to it, then click where it stands on screen
async function tapSign(page) {
  const g = await page.evaluate(() => { const t = window.__hs; const g = t.signGeo(); t.pos.x = t.tgt.x = g.signAt.x; t.pos.y = t.tgt.y = g.signAt.y + 60; return g; });
  await page.waitForTimeout(400);
  const r = await page.locator('#hsWorld').boundingBox();
  await page.mouse.click(r.x + g.signAt.x / g.W * r.width, r.y + (g.signAt.y - 30) / g.H * r.height);
  await page.waitForTimeout(700);
}

test('a new banana is not asked to name the homestead until the story moves them in', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/homestead/?hstest=fresh', { waitUntil: 'domcontentloaded' });   // the first arrival, with the QA seam
  await page.waitForFunction(() => window.__hs && window.__hs.signGeo, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  expect(await page.locator('#hsClaim').isHidden()).toBe(true);
  expect(await page.locator('.hs-signhint').evaluate((e) => getComputedStyle(e).display)).toBe('none');
  // the sign, tapped early: a word, no card
  await tapSign(page);
  expect(await page.locator('#hsClaim').isHidden()).toBe(true);
  await expect(page.getByText('start with Nib')).toBeVisible();
  // the story's move-in: the hint shows, the sign asks, and the card can be closed
  await page.evaluate(() => localStorage.setItem('bwq-c1', JSON.stringify({ s: 14, k: {}, res: 0, done: 0, resSet: 1 })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.signGeo, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  expect(await page.locator('.hs-signhint').evaluate((e) => getComputedStyle(e).display)).not.toBe('none');
  await tapSign(page);
  expect(await page.locator('#hsClaim').isHidden()).toBe(false);
  await page.click('#hsClaimX');
  expect(await page.locator('#hsClaim').isHidden()).toBe(true);
  expect((await page.evaluate(() => window.__hs.signGeo())).claimed).toBe(false);   // skipped: still yours to name later
  await tapSign(page);
  expect(await page.locator('#hsClaim').isHidden()).toBe(false);   // …and the sign asks again
  expect(errors, 'page errors: ' + errors.join(' | ')).toEqual([]);
});
