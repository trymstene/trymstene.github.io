// 📱 THE HUD STRIP IS ONE LINE ON A PHONE (28 Sep 2026, design library §15).
//
// Trym: *"On mobile, the HUD doesnt have LVL, Coins, Gardener level and Online players arent on one line at the top, it seems
// like the quest icon pushes the top HUD elements so that the Solo stickerpill breaks one line down."* It was not the quest
// badge (that sits under the strip, out of its flow): four chips at their desk size were ~370 px, and a phone's frame leaves
// the strip 310 px at 360 and 343 at 393. Every area is walked at the four phone widths with the widest strip a real player
// can have — LVL 99, five-digit coins, the gardener chip and the amber "not saved" ask — and every chip must share one row,
// inside the frame. Screenshots of the top of each view go to test-results/hud-*.png.
import { test, expect } from '@playwright/test';

// a legend's pass, kept on this device: rep for LVL 99, 12 345 coins, the gardener's top rung — and no email on it, so the
// crowd chip wears the save ask (its widest face)
const PASS = { created: Date.now() - 40 * 86400000, patches: {}, base: { rep: 240000, coins_earned: 12345, garden_harvests: 40 }, led: {}, days: [] };
const AREAS = [
  ['homestead', '/homestead/?hstest=claimed'],
  ['park', '/park/?world'],
  ['beach', '/beach/'],
  ['town', '/town/?towntest'],
];
const WIDTHS = [360, 375, 390, 393];

for (const [area, url] of AREAS) {
  test(area + ': the strip holds one line at every phone width', async ({ browser }) => {
    test.setTimeout(120000);
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.route(/googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
      await page.addInitScript((pass) => {
        try {
          sessionStorage.setItem('pass-wallet-off', '1');   // this device's ledger is the wallet (no server number over it)
          localStorage.setItem('pass-v1', JSON.stringify(pass));
          localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
        } catch (e) {}
      }, PASS);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.wh', { timeout: 30000 });
      // the strip reads the pass every second: wait until it shows the legend's numbers
      await page.waitForFunction(() => /LVL 99/.test((document.querySelector('.wh__lvl') || {}).textContent || ''), null, { timeout: 15000 });
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const wh = document.querySelector('.wh'), view = wh.parentElement.getBoundingClientRect(), s = wh.getBoundingClientRect();
        const chips = [...wh.children].filter((c) => getComputedStyle(c).display !== 'none')
          .map((c) => { const b = c.getBoundingClientRect(); return { cls: c.className, top: Math.round(b.top), left: b.left, right: b.right, text: c.textContent.replace(/\s+/g, ' ').trim() }; });
        return { chips, strip: { left: s.left, right: s.right }, view: { left: view.left, right: view.right, top: view.top } };
      });
      const tag = area + ' at ' + w + ' px (' + r.chips.map((c) => c.text).join(' | ') + ')';
      expect(r.chips.length, tag + ': the strip has its chips').toBeGreaterThanOrEqual(3);
      expect(new Set(r.chips.map((c) => c.top)).size, tag + ': ONE row').toBe(1);
      expect(r.chips[0].left, tag + ': inside the frame on the left').toBeGreaterThanOrEqual(r.view.left);
      expect(r.chips[r.chips.length - 1].right, tag + ': inside the frame on the right').toBeLessThanOrEqual(r.view.right);
      if (area === 'homestead' || area === 'park') {
        expect(r.chips.some((c) => /wh__gard/.test(c.cls)), tag + ': the gardener chip is in it').toBe(true);
        expect(r.chips.some((c) => /wh__crowd--save/.test(c.cls)), tag + ': with the save ask on (its widest face)').toBe(true);
      }
      await page.screenshot({ path: 'test-results/hud-' + area + '-' + w + '.png', clip: { x: 0, y: Math.max(0, Math.round(r.view.top) - 8), width: w, height: 150 } });
      expect(errs, tag + ': no page errors').toEqual([]);
      await ctx.close();
    }
  });
}
