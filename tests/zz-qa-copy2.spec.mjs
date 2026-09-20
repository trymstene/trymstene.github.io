import { test, expect } from '@playwright/test';
test('cafe openFor by band', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => window.__town.room.curse('none'));
  await page.evaluate(() => window.__town.life.set(12));
  await page.waitForFunction(() => window.__town.work, null, { timeout: 15000 });
  await page.evaluate(() => window.__town.work.set({ at: '' }));
  for (const v of [10, 30, 55, 78, 96]) {
    const r = await page.evaluate((n) => {
      window.__town.room.set(n);
      const t = document.getElementById('twToast'); t.textContent = ''; t.hidden = true;
      const ok = window.__town.room.open('cafe');
      return { band: window.__town.room.band(), ok, toast: t.hidden ? '' : t.textContent, card: (() => { const p = document.querySelector('.tw-panel'); return p && !p.hidden ? p.innerText.slice(0, 120) : ''; })() };
    }, v);
    // what banana-town would toast when openFor said no
    console.log(v, JSON.stringify(r));
  }
  const about = await page.evaluate(() => { const t = document.getElementById('twToast'); t.textContent=''; t.hidden=true; return null; });
  void about;
  expect(1).toBe(1);
});
