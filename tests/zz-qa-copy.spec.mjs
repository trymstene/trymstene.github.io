import { test, expect } from '@playwright/test';
const stand = (page, x, y) => page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = t.tgt.x = px; t.pos.y = t.tgt.y = py; }, [x, y]);
test('copy probe', async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => window.__town.room.curse('none'));
  await page.evaluate(() => window.__town.life.set(12));
  await page.waitForFunction(() => window.__town.work, null, { timeout: 15000 });
  // give this device a kept pass so the hire lines are reachable at all
  await page.evaluate(() => localStorage.setItem('pass-link', JSON.stringify({ credId: 'qa', token: 'qa' })));
  const lines = await page.evaluate(() => {
    const out = {};
    for (const k of ['pip', 'spinner', 'bean']) { window.__town.work.set({ at: '' }); const a = window.__town.work.ask(k); out[k] = a && a.a; }
    out.moved = (window.__town.work.ask('pip') || {}).a;
    return out;
  });
  console.log('HIRED', JSON.stringify(lines, null, 1));
  // tap the Coffee Cup with no job there, through the view's own hit test
  await page.evaluate(() => window.__town.work.set({ at: '' }));
  await stand(page, 1830, 1100);
  await page.evaluate(() => { const t = document.getElementById('twToast'); t.textContent=''; t.hidden = true; });
  const box = await page.locator('#twView').boundingBox();
  const s = await page.evaluate(() => { const w = document.getElementById('twWorld'); const m = new DOMMatrixReadOnly(getComputedStyle(w).transform); return { a: m.a, e: m.e, f: m.f }; });
  await page.mouse.click(box.x + s.e + 1830 * s.a, box.y + s.f + 1035 * s.a);
  await page.waitForTimeout(1200);
  console.log('CAFE TAP TOAST:', await page.evaluate(() => { const t = document.getElementById('twToast'); return t.hidden ? '(nothing)' : t.textContent; }));
  // the receipt when the day's cap paid nothing
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.waitForFunction(() => window.__town.room.cafeReady && window.__town.room.cafeReady(), null, { timeout: 20000 });
  await page.waitForFunction(() => !!window.__town.room.cafe(), null, { timeout: 20000 });
  const r = await page.evaluate(() => { const c = window.__town.room.cafe(); c.receipt(0); const el = document.querySelector('.tw-cup__till'); return el ? el.innerText : '(no card)'; });
  console.log('RECEIPT(0):', JSON.stringify(r));
  expect(1).toBe(1);
});
