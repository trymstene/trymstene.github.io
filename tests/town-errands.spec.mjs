// 🧺 THE RESIDENTS' ERRANDS (27 Sep 2026). Trym: "noone looks like they are out and about doing important town-things -
// they just stand there like dolls" — and on the live town each resident walked 3–16 s in five minutes. Once in a working
// beat a resident now takes a short trip with the thing they carry and comes back to their post (src/scripts/town-life.js
// ERRANDS): the square should read as a town at work, and still "mainly standing by their shops" (Trym, 20 Sep).
import { test, expect } from '@playwright/test';

const town = async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.life.residents().some((r) => r.place), null, { timeout: 30000 });
};
const sample = (page) => page.evaluate(() => window.__town.life.residents().map((r) => ({ k: r.key, e: r.errand, x: r.x, y: r.y, st: r.st, h: r.hidden })));

test('a working beat: residents go out on errands and come back, never more than three at once', async ({ page }) => {
  test.setTimeout(170000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await town(page);
  await page.evaluate(() => window.__town.life.set(4.05));   // the morning beat, from its first seconds
  const went = new Set(), back = new Set();
  let most = 0;
  const was = {};
  for (let i = 0; i < 220; i++) {   // 110 s of the beat's 118
    await page.waitForTimeout(500);
    const rs = await sample(page);
    most = Math.max(most, rs.filter((r) => r.e).length);
    for (const r of rs) {
      if (r.e) went.add(r.k);
      if (was[r.k] && !r.e) back.add(r.k);   // an errand that ended
      was[r.k] = r.e;
    }
  }
  const home = await sample(page);
  expect(went.size, 'several residents took a trip in the beat: ' + [...went].join(', ')).toBeGreaterThanOrEqual(4);
  expect([...went].filter((k) => !back.has(k)), 'every one of them came back to their post before the beat ran out').toEqual([]);
  expect(most, 'still mainly at their shops: never more than three out at once').toBeLessThanOrEqual(3);
  const away = home.filter((r) => !r.h && r.st && went.has(r.k) && Math.hypot(r.x - r.st[0], r.y - r.st[1]) > 60).map((r) => r.k + ' at ' + r.x + ',' + r.y);
  expect(away, 'back AT their post, not near it').toEqual([]);
  expect(errs).toEqual([]);
});

test('the noon break has no errands: a bench is a rest', async ({ page }) => {
  test.setTimeout(90000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await town(page);
  await page.evaluate(() => window.__town.life.set(8.05));   // noon, from its first seconds
  const went = new Set();
  for (let i = 0; i < 100; i++) {   // 50 s
    await page.waitForTimeout(500);
    for (const r of await sample(page)) if (r.e) went.add(r.k);
  }
  expect([...went], 'nobody leaves their lunch for an errand').toEqual([]);
  expect(errs).toEqual([]);
});
