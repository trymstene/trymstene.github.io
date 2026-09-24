// 👀 THE TOWN AS A NEWCOMER FINDS IT — loaded as it comes, the hour NOT pinned (24 Sep 2026).
//
// Every other walk pins the town's hour first (life.set), and that second placement found the residents visible — so none
// of them could see what a real first load did: seven of nine residents stood at their FRONT DOORS (town-life.js placed
// them at their station and then leaveHome() moved a still-hidden resident to its doorstep), each waiting up to 74 s to
// walk out. Bean was not at his counter, and chapter one's "!" hung over an empty fountain for the first minute a newcomer
// spent in Banana World. This walk never calls life.set: whatever the real hour, a resident who is out is at their place.
import { test, expect } from '@playwright/test';

const HOME = { hall: [1100, 590], post: [1700, 590], condo: [480, 592], store: [480, 1068], cafe: [1770, 1068], print: [1620, 1068], garden_w: [520, 704] };
const FOUNTAIN = [1160, 985];

test('a real first load: every resident who is out stands at their place, and Nib waits at the fountain under the "!"', async ({ page }) => {
  test.setTimeout(60000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.life.residents().some((r) => r.place), null, { timeout: 30000 });
  await page.waitForTimeout(2500);   // the room is up and has re-run the beat as a walk; nobody has had 74 s to wander out
  const rs = await page.evaluate(() => window.__town.life.residents());
  // on a doorstep that is not where they are meant to be (a station may be the door itself: Stamp at the post office)
  const atDoor = (r) => Object.values(HOME).some(([x, y]) => Math.hypot(r.x - x, r.y - y) < 4 && !(r.st && Math.hypot(r.st[0] - x, r.st[1] - y) < 12));
  const stuck = rs.filter((r) => !r.hidden && r.act !== 'home' && atDoor(r) && !r.leg).map((r) => r.key + '@' + r.place);
  expect(stuck, 'nobody who is out stands on their doorstep waiting to walk to their place').toEqual([]);
  const nib = rs.find((r) => r.key === 'nib');
  expect(nib && !nib.hidden && Math.hypot(nib.x - FOUNTAIN[0], nib.y - FOUNTAIN[1]) < 30, 'Nib is at the fountain from the first seconds, whatever the hour').toBe(true);
  await page.waitForSelector('.bwq-mark', { timeout: 10000 });
  const geo = await page.evaluate(() => {
    const m = document.querySelector('.bwq-mark').getBoundingClientRect(), b = document.querySelector('.tw-npc[data-k="nib"]').getBoundingClientRect();
    return { dx: Math.abs((m.left + m.width / 2) - (b.left + b.width / 2)), above: m.bottom <= b.top + 24 };
  });
  expect(geo.dx < 28 && geo.above, 'the "!" hangs over him, not over empty cobbles').toBe(true);
  await page.screenshot({ path: 'test-results/town-first-frame.png' });
  expect(errs).toEqual([]);
});

test('the chapter’s scene owns the screen: a tap on a building during its splash opens nothing under it', async ({ page }) => {
  test.setTimeout(60000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.waitForSelector('.bwq-mark', { timeout: 15000 });
  const b = await page.locator('.bwq-mark').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.bwq-intro', { timeout: 5000 });
  await page.evaluate(() => window.__town.open('post'));   // the impatient tap, mid-splash
  await page.waitForSelector('.bwq-dlg', { timeout: 10000 });
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden), 'no town card under Nib’s sheet').toBe(true);
  expect(errs).toEqual([]);
});
