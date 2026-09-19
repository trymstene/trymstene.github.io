// 📬 THE WORLD'S OWN POST (19 Sep 2026): the mailbox is a mailbox — a dot when something is in it, the
// letters on the world's paper, no orders in there (they live on the phone) and no move button (that is
// build mode's job). The letters are device-local by design: they never ride the public yard read.
import { test, expect } from '@playwright/test';

async function mailbox(page) {
  const g = await page.evaluate(() => { const t = window.__hs, g = t.mailGeo(); t.pos.x = t.tgt.x = g.at.x - 40; t.pos.y = t.tgt.y = g.at.y + 16; return g; });
  await page.waitForTimeout(400);
  const r = await page.locator('#hsWorld').boundingBox();
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(r.x + g.at.x / g.W * r.width, r.y + (g.at.y - 20) / g.H * r.height);
    await page.waitForTimeout(500);
    if (await page.locator('#hsPost').isVisible()) return true;
  }
  return false;
}

test('the mailbox holds the world’s post, shows a dot, and nothing else', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mailGeo, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // the world has written: the dot is up before anything is opened
  expect(await page.locator('.hs-maildot').isVisible(), 'the unread dot').toBe(true);
  {  // …and it reads as a dot on the box, from where a player stands
    const g = await page.evaluate(() => { const t = window.__hs, g = t.mailGeo(); t.pos.x = t.tgt.x = g.at.x - 40; t.pos.y = t.tgt.y = g.at.y + 16; return g; });
    await page.waitForTimeout(700);
    const r = await page.locator('#hsWorld').boundingBox();
    const x = r.x + g.at.x / g.W * r.width, y = r.y + g.at.y / g.H * r.height;
    await page.screenshot({ path: 'test-results/homestead-maildot.png', clip: { x: Math.max(0, x - 90), y: Math.max(0, y - 120), width: 180, height: 150 } });
  }

  expect(await mailbox(page), 'the mailbox opened its post').toBe(true);
  // the letters are on the world's paper, in the world's hand
  const papers = page.locator('#hsPostList .bw-paper');
  expect(await papers.count()).toBeGreaterThan(0);
  expect(await papers.first().evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Caveat');
  expect(await papers.first().textContent()).not.toContain('{');   // the placeholders are filled
  await page.locator('#hsPost .hs-card').screenshot({ path: 'test-results/homestead-post.png' });

  // …and nothing that is not post: no orders, no move button
  const card = (await page.locator('#hsPost').textContent()) || '';
  expect(card).not.toMatch(/on the way|move it|✥/);

  // reading it clears the dot
  await page.locator('.hs-post__it').first().click();
  await page.waitForTimeout(400);
  await page.click('#hsPostClose');
  await page.waitForTimeout(500);
  const left = await page.evaluate(() => window.__hs.mailGeo().unread);
  expect(await page.locator('.hs-maildot').isVisible()).toBe(left > 0);

  // the post is kept on the device, and ONLY there — it is not in what the yard publishes, so a
  // visitor can never read somebody's letters (⚠️ a scenario reload would re-seed the yard, so this
  // reads the store itself rather than reloading)
  const kept = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hs-v1') || '{}'); } catch (e) { return {}; } });
  expect((kept.mail || []).length, 'the letters are saved on the device').toBeGreaterThan(0);
  expect(kept.mail[0].id).toBeTruthy();
  expect(JSON.stringify(kept.mail)).not.toContain('big book');   // a row keeps its key, never the prose
  expect(errors, 'page errors: ' + errors.join(' | ')).toEqual([]);
});
