// 🕹 THE ARCADE'S WEEK (22 Sep 2026; docs/town-jobs-plan.md §12). Trym: *"go ahead with the arcade chore …
// Arcade: Swept floor 0/3, fixed Arcade machine 0/3"*.
//
// Spinner's staff find the arcade floor littered and one cabinet dark each day. Walking onto a piece
// sweeps it; a tap on the dark cabinet is a repair — the streetlight's hold — and each counts on the
// week's sheet, which the work note shows in the same beat. A customer sees none of it.
import { test, expect } from '@playwright/test';

const town = async (page) => {
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(11); });
};
const arcade = (page) => page.evaluate(() => window.__town.room.arcade());
const state = (page) => page.evaluate(() => window.__town.work.state());

test('the arcade’s staff sweep the floor and wake the dark cabinet, and the week counts it', async ({ page }) => {
  test.setTimeout(90000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  await town(page);

  // ── a customer sees a clean, working arcade
  await page.evaluate(() => window.__town.work.set({ at: '' }));
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(300);
  let a = await arcade(page);
  expect(a.staff, 'not staff').toBe(false);
  expect(a.litter.length, 'no litter for a customer').toBe(0);
  expect(a.dead, 'no dark cabinet for a customer').toBeNull();
  await page.evaluate(() => window.__town.arcade.exit());

  // ── the staff find the day's work: three pieces on the floor and one cabinet dark
  await page.evaluate(() => window.__town.work.set({ at: 'condo', pay: 60 }));
  await page.evaluate(() => window.__town.room.arcadeReset());
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(300);
  a = await arcade(page);
  expect(a.staff, 'staff now').toBe(true);
  expect(a.litter.length, 'three pieces of litter on the floor').toBe(3);
  expect(a.dead, 'and one cabinet gone dark').toMatch(/^g[1-9]$/);
  expect(await page.locator('.tw-dead.is-in').count(), 'drawn dark on the room’s plate').toBe(1);
  const s0 = await state(page);
  expect(s0.duties.map((d) => d.kind + ':' + d.done + '/' + d.of), 'the note starts the week at nothing').toEqual(['sweep:0/3', 'fix:0/3']);
  expect(await page.evaluate(() => window.__town.duties.top()), 'and the counts are on the note').toMatch(/0\/3.*0\/3/);
  await page.screenshot({ path: 'test-results/town-arcade-chores.png' });   // the day's work, as the staff find it

  // ── walking onto a piece sweeps it, and the note moves in the same beat
  const l = a.litter[0];
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [l.x, l.y]);
  await page.waitForFunction(() => window.__town.room.arcade().litter.length === 2, null, { timeout: 5000 });
  const s1 = await state(page);
  expect(s1.duties.find((d) => d.kind === 'sweep').done, 'floor swept 1/3').toBe(1);
  expect(s1.sofar, 'a sixth of the week’s work is a sixth of the rate').toBe(Math.round(60 / 6));
  expect(await page.evaluate(() => window.__town.duties.top()), 'the note says so').toMatch(/1\/3/);

  // ── the dark cabinet: standing at it and tapping starts a repair, the hold wakes it
  const key = a.dead;
  const spot = await page.evaluate((k) => window.__town.arcade.spots().find((q) => q[0] === k), key);
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [(spot[1] + spot[3]) / 2, spot[4] + 26]);
  expect(await page.evaluate((k) => window.__town.room.cabinetRepair(k), key), 'the repair starts').toBe(true);
  expect((await arcade(page)).working, 'the hold is on').toBe(true);
  expect(await page.locator('.tw-work.is-in').count(), 'and its bar is on the room’s plate').toBe(1);
  await page.waitForFunction(() => window.__town.room.arcade().dead === null, null, { timeout: 8000 });
  const s2 = await state(page);
  expect(s2.duties.find((d) => d.kind === 'fix').done, 'machines fixed 1/3').toBe(1);
  expect(s2.sofar, 'two of six is a third of the rate').toBe(Math.round(60 / 3));
  expect(await page.locator('.tw-dead').count(), 'the cabinet is lit again').toBe(0);

  // ── the day remembers: back in, the swept piece stays swept and the cabinet stays woken
  await page.evaluate(() => window.__town.arcade.exit());
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(300);
  a = await arcade(page);
  expect(a.litter.length, 'two pieces left today').toBe(2);
  expect(a.dead, 'no cabinet to wake until tomorrow').toBeNull();

  const ev = await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_chore').map((e) => e[1].kind));
  expect(ev, 'Pulse heard a sweep and a fix').toEqual(['sweep', 'fix']);
  expect(errs, 'nothing threw').toEqual([]);
});
