// 🌱 THE SEEDS' WAY HOME (24 Sep 2026). Be, a player, in a letter: "Where do I find my harvested seeds from the park and how do
// I plant them? Been trying to figure it out, but no luck yet". Trym: "nothing says that you can plant seeds on that dirt …
// Should probably be some sort of better flow on communicating that" — and "I dont want another action button".
//
// A banana arrives home with two seeds from the park and no soil. Each step is told when it applies: the arrival line and a
// glowing hammer; build mode opening on the soil tool with what soil is for; the first patch saying press done; done saying
// tap your soil, which now glows; and one tap on far soil walking there and opening the seeds. Pictures in test-results/.
import { test, expect } from '@playwright/test';
import W from '../src/data/copy/homestead-seeds.json' with { type: 'json' };

const toastIs = (page, line) => page.waitForFunction((l) => { const t = document.querySelector('.hs-toast, #hsToast'); return !!t && (t.textContent || '').includes(l); }, line, { timeout: 8000 });
// a world point → the screen, through the world element as it is drawn (its rect already carries the camera)
const screenOf = (page, wx, wy) => page.evaluate(([x, y]) => {
  const w = document.getElementById('hsWorld').getBoundingClientRect(), g = window.__hs.signGeo(), k = w.width / g.W;
  return { x: w.left + x * k, y: w.top + y * k };
}, [wx, wy]);

test('two seeds from the park, no soil: the homestead walks you from the hammer to a planted seed', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('pass-v1', JSON.stringify({ created: Date.now(), patches: {}, stats: { seedg_sunflower: 2 }, days: [] }));
        localStorage.removeItem('hs-seedhint-v1');
        sessionStorage.setItem('seeded', '1');
      }
    } catch (e) {}
  });
  await page.goto('/homestead/?hstest=tent', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.signGeo, null, { timeout: 30000 });

  // ── arriving: what you hold, and the one thing to tap
  await toastIs(page, W.arrive.digMany.replace('{n}', '2'));
  expect(await page.locator('#hsBuild.is-hint').count(), 'the hammer glows').toBe(1);
  await page.screenshot({ path: 'test-results/homestead-seeds-1-arrive.png' });

  // ── the hammer: build mode opens on the soil tool, and says what soil is for
  await page.click('#hsBuild');
  await expect(page.locator('#hsToolSoil')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#hsBuild.is-hint').count(), 'the hammer has done its job').toBe(0);
  await toastIs(page, W.soil);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/homestead-seeds-2-soil-tool.png' });

  // ── the first patch: press done
  const cell = await screenOf(page, 1224, 696);
  await page.mouse.click(cell.x, cell.y);
  await toastIs(page, W.dug);
  await page.screenshot({ path: 'test-results/homestead-seeds-3-dug.png' });

  // ── done: tap your soil, and the soil glows
  await page.click('#hsPlanDone');
  await toastIs(page, W.done);
  await expect(page.locator('.hs-soil.is-hint')).toHaveCount(1);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/homestead-seeds-4-done.png' });

  // ── one tap on the soil from across the yard: the banana walks there and the seeds open
  // far enough that a tap only walks (over 130 px), near enough that the soil is on the screen a thumb sees
  await page.evaluate(() => { const h = window.__hs; h.pos.x = h.tgt.x = 1164; h.pos.y = h.tgt.y = 850; });
  await page.waitForTimeout(900);
  const soil = await screenOf(page, 1224, 696);
  const v = await page.evaluate(() => { const r = document.getElementById('hsView').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  expect(soil.x > v.l && soil.x < v.r && soil.y > v.t && soil.y < v.b, 'the soil is on screen to be tapped').toBe(true);
  await page.mouse.click(soil.x, soil.y);
  await expect(page.locator('#hsSeed')).toBeVisible({ timeout: 12000 });
  await page.screenshot({ path: 'test-results/homestead-seeds-5-seeds.png' });
  await page.locator('#hsSeedList button').first().click();
  await expect(page.locator('#hsSeed')).toBeHidden();
  await expect(page.locator('.hs-crop')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the arrival line is said once a day, not every visit', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('pass-v1', JSON.stringify({ created: Date.now(), patches: {}, stats: { seedg_sunflower: 1 }, days: [] }));
      localStorage.setItem('hs-seedhint-v1', JSON.stringify({ d: new Date().toISOString().slice(0, 10) }));
    } catch (e) {}
  });
  await page.goto('/homestead/?hstest=tent', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.signGeo, null, { timeout: 30000 });
  await page.waitForTimeout(5000);
  const said = await page.evaluate((l) => (document.querySelector('.hs-toast, #hsToast') || {}).textContent || '', W.arrive.digOne);
  expect(said.includes(W.arrive.digOne), 'already said today').toBe(false);
  expect(await page.locator('#hsBuild.is-hint').count()).toBe(0);
});
