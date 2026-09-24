// 🔨 BUILD MODE DRAWS THE LAND (24 Sep 2026). Trym: "build mode is broken, just shows a dark brown overlay - atleast on
// desktop". Since 21 Sep the build camera's scale was snapped to whole device pixels with a floor of 0 — and at a device
// pixel ratio under 2 (every desktop at 100–125 %) the only whole step under the fit WAS 0, so the yard was drawn 0×0.
// Phones at 2× and 3× happened to land on a real step, which is how it hid. No walk had ever opened build mode; this one
// does, at 1×, 2× and 3×, on a desktop and a phone, and checks the land is drawn at a real size and on screen.
import { test, expect } from '@playwright/test';

async function openBuild(page, w, h) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/homestead/?hstest=tent', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.signGeo, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('#hsBuild');
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const v = document.getElementById('hsView').getBoundingClientRect(), wd = document.getElementById('hsWorld').getBoundingClientRect();
    const tiles = [...document.querySelectorAll('#hsWorld *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.right > v.left && r.left < v.right && r.bottom > v.top && r.top < v.bottom; }).length;
    return { vw: v.width, ww: wd.width, wh: wd.height, tiles, bar: !document.getElementById('hsPlan').hidden };
  });
  return { errors, m };
}

for (const [dpr, w, h, tag] of [[1, 1280, 800, 'desktop-1x'], [1, 393, 852, 'phone-1x'], [2, 1280, 800, 'desktop-2x'], [3, 393, 852, 'phone-3x']]) {
  test.describe(tag, () => {
    test.use({ deviceScaleFactor: dpr });
    test(`build mode draws your land at a real size — ${tag}`, async ({ page }) => {
      test.setTimeout(60000);
      const { errors, m } = await openBuild(page, w, h);
      await page.screenshot({ path: `test-results/homestead-build-${tag}.png` });
      expect(m.bar, 'the tool bar is up').toBe(true);
      expect(m.ww, `the yard is drawn wider than half the view (was 0×0 at 1×: ${m.ww}×${m.wh})`).toBeGreaterThan(m.vw * 0.5);
      expect(m.tiles, 'and the things on it are on screen').toBeGreaterThan(5);
      expect(errors).toEqual([]);
    });
  });
}
