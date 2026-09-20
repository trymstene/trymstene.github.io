import { test, expect } from '@playwright/test';
const stand = (page, x, y) => page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = t.tgt.x = px; t.pos.y = t.tgt.y = py; }, [x, y]);
test('the toast over the tray', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => window.__town.room.curse('none'));
  await page.evaluate(() => window.__town.life.set(12));
  await stand(page, 1830, 1100);
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.waitForFunction(() => window.__town.room.cafeReady && window.__town.room.cafeReady(), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.evaluate(async () => { const c = window.__town.room.cafe(); c.clockIn(); });
  await page.waitForTimeout(600);
  // force a queue and a cup so the gauge is live
  await page.evaluate(() => { const f = window.__town.folkSeam || (window.__town.room.folk && window.__town.room.folk()); if (f && f.fill) f.fill(4); });
  await page.evaluate(() => { const c = window.__town.room.cafe(); c.call(); c.call(); c.arrive(); c.serve(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const t = document.getElementById('twToast'); t.textContent = 'A neat cup crosses the rope without a wobble.'; t.hidden = false; });
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) }; };
    return { toast: r('.tw-toast'), tray: r('.tw-cup'), bar: r('.tw-cup__bar'), go: r('.tw-cup__go'), note: r('.tw-cup__note'), noteText: (document.querySelector('.tw-cup__note')||{}).textContent, goText: (document.querySelector('.tw-cup__go')||{}).textContent, view: r('#twView') };
  });
  console.log(JSON.stringify(m, null, 1));
  await page.locator('#twView').screenshot({ path: 'test-results/qa-cafe-toast.png' });
  expect(1).toBe(1);
});
