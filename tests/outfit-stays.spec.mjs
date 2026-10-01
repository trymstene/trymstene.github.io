// 👕 YOUR BANANA WEARS WHAT YOU PUT ON IT (1 Oct 2026). Trym: "i visited the page /banana-of-the-day/ … and now my
// outfit looks just like it … i think i had a red scarf and a top hat before". The banana of the day IS the builder, in
// overlay mode, inside that page; when the builder's catalog landed it repainted, and every repaint saved the banana on
// screen as yours (bb-last: what the world, the HUD and the pass wear). Somebody's shared link did the same. Only
// dressing saves now: a tap, or the pass closet's Wear door.
import { test, expect } from '@playwright/test';

const MINE = { hat: 'tophat', glasses: 'none', extras: { scarf: true }, effect: 'none', c: '' };

async function seed(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  let landed = 0;
  // ⚠️ the LAST route added answers first, so the catalog stub goes in after the blanket abort
  await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  // the catalog lands (an empty one is enough: its landing was the repaint that saved)
  await page.route(/banana-share\.trymstene\.workers\.dev\/catalog\/items\.json/, (r) => { landed++; r.fulfill({ json: [] }); });
  await page.addInitScript((mine) => {
    if (sessionStorage.getItem('qa-outfit-seeded')) return;   // once per tab: the overlay's own window shares it
    sessionStorage.setItem('qa-outfit-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('bb-last', JSON.stringify(mine));
  }, MINE);
  return { errs, landed: () => landed };
}
const worn = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bb-last') || 'null'));

test('⭐ opening the banana of the day leaves your banana in its own clothes', async ({ page }) => {
  const s = await seed(page);
  await page.goto('/banana-of-the-day/');
  await expect.poll(() => page.frames().some((f) => /make-a-banana\/\?.*overlay=1/.test(f.url())), { timeout: 15000 }).toBe(true);
  await expect.poll(s.landed, { timeout: 15000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  expect(await worn(page)).toEqual(MINE);
  expect(s.errs).toEqual([]);
});

test('⭐ a shared banana link shows that banana and leaves yours alone, until you dress it', async ({ page }) => {
  const s = await seed(page);
  await page.goto('/make-a-banana/?h=crown&g=shades');
  await expect.poll(s.landed, { timeout: 15000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  expect(await worn(page), 'looking is not wearing').toEqual(MINE);
  // a tap IS dressing: the banana on the stage (the link's, with this change) is yours now
  await page.locator('#bbHatChips .bb-chip[data-val="crown"]').click();
  await expect.poll(async () => (await worn(page)).glasses).toBe('shades');
  expect((await worn(page)).hat, 'the crown came off with the tap').toBe('none');
  expect(s.errs).toEqual([]);
});

test('your own builder, opened and left alone, saves nothing new', async ({ page }) => {
  const s = await seed(page);
  await page.goto('/make-a-banana/');
  await expect.poll(s.landed, { timeout: 15000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  expect(await worn(page)).toEqual(MINE);
  expect(s.errs).toEqual([]);
});

test('the pass closet’s Wear door puts the thing on at once, and the rest stays on', async ({ page }) => {
  const s = await seed(page);
  await page.goto('/make-a-banana/?wear=crown');
  await expect.poll(async () => (await worn(page)).hat, { timeout: 15000 }).toBe('crown');
  expect((await worn(page)).extras.scarf).toBe(true);
  expect(s.errs).toEqual([]);
});
