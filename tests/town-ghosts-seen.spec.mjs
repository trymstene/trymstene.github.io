// 👀 A GHOST YOU CAN SEE (23 Sep 2026). Trym: "i dont see any ghosts at night anymore".
//
// They were out — five of them — but on a phone at the lemon stand one was on screen for 5 % of a night: the roamer
// rested only on the square's fourteen waypoints, "far from every banana", and the others keep their bench, their path
// and their statue. town-night.js now picks most of the roamer's rests in the ring round YOUR banana (out of reach, on a
// phone's screen), crossing the square in legs when the fountain is in the way. This walk stands on Hall Street at the
// lemon stand, on a phone, through a night, and waits for the roamer to come into view — and keep its distance.
import { test, expect } from '@playwright/test';

test('on a phone at the lemon stand, the night’s roamer comes into view and keeps out of reach', async ({ page }) => {
  test.setTimeout(150000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.life && window.__town.pos, null, { timeout: 30000 });
  const AT = [890, 580];   // Hall Street, in front of Fig Jr.'s stand — where the stand's staff spend the night
  const stand = () => page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, AT);
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(21); });   // the town's own night
  await stand();
  await page.waitForFunction(() => window.__town.life.beat() === 5 && document.querySelectorAll('#twWorld .tw-state.is-haunt').length >= 3, null, { timeout: 30000 });
  // a minute of the night, a look every second: how much of it has a ghost in a phone's view (it was 5 % before)
  let seen = 0, n = 0, closest = Infinity, ids = new Set();
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    await stand();
    const r = await page.evaluate(() => {
      const v = document.getElementById('twView').getBoundingClientRect(), w = document.getElementById('twWorld'), k = parseFloat(w.style.getPropertyValue('--ws')), o = w.getBoundingClientRect();
      return window.__town.room.ghosts().filter((g) => !g.hidden).filter((g) => { const x = o.left + g.x * k, y = o.top + g.y * k; return x > v.left + 8 && x < v.right - 8 && y > v.top + 8 && y < v.bottom - 8; }).map((g) => g.id);
    });
    const roam = (await page.evaluate(() => window.__town.room.ghosts())).find((g) => g.id === 'roam');
    if (roam) closest = Math.min(closest, Math.hypot(roam.x - AT[0], roam.y - AT[1]));
    if (await page.evaluate(() => window.__town.life.beat()) !== 5) continue;
    n++; if (r.length) { seen++; r.forEach((x) => ids.add(x)); }
  }
  expect(n, 'the minute was night').toBeGreaterThan(50);
  expect(seen / n, 'a ghost is in a phone’s view of the lemon stand for a good part of the night (it was 5 %)').toBeGreaterThan(0.15);
  expect([...ids], 'and it is the roamer that came').toContain('roam');
  expect(closest, '…and never into a banana standing still (a ghost is caught at 42)').toBeGreaterThan(42);
  await page.screenshot({ path: 'test-results/ghosts-seen-stand.png' });
  expect(errs, 'nothing threw').toEqual([]);
});
