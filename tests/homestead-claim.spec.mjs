// 🪧 the homestead's claim waits for the story (Trym, 18 Sep 2026): a new banana is not asked to name the place;
// the sign's hint is hidden and a tap on the sign says why; at the story's move-in the sign asks, and the card closes.
import { test, expect } from '@playwright/test';
import NOTES from '../src/data/copy/homestead-notes.json' with { type: 'json' };

// a real tap on the sign: stand beside it, then click the sign sprite itself (the proof's locator), a
// few times if need be — a far tap only walks the banana there
async function signBox(page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll('#hsWorld .hs-ov')].find((e) => /m-psign/.test(e.style.backgroundImage || ''));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
  });
}
async function tapSign(page) {
  await page.evaluate(() => { const t = window.__hs, g = t.signGeo(); t.pos.x = t.tgt.x = g.signAt.x; t.pos.y = t.tgt.y = g.signAt.y + 60; });
  await page.waitForTimeout(400);
  for (let i = 0; i < 6; i++) {
    const b = await signBox(page);
    if (!b) throw new Error('no sign on screen');
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(500);
    if (await page.locator('#hsClaim').isVisible()) return true;
  }
  return false;
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
  await expect(page.getByText(NOTES.signEarly), 'the sign says where the story starts, in the copy file’s words').toBeVisible();
  // the story's move-in: the hint shows, the sign asks, and the card can be closed
  await page.evaluate(() => localStorage.setItem('bwq-c1', JSON.stringify({ s: 15, k: {}, res: 0, done: 0, resSet: 1 })));
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
