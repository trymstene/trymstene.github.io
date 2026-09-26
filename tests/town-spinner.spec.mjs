// 🕹🎡 SPINNER KEEPS THE ARCADE, TWIRL THE WHEEL OF PEEL, MOSS SLEEPS AT THE CLOTHES SHOP (24 Sep 2026).
//
// Trym: *"Spinner should hang around the arcade, walk in and out, look busy there - not stand by the wheel of peel -
// someone else should stand and be responsible for the wheel of peel, because now i ask Spinner "may i work here" and he
// stands by the wheel and that doesnt make sense. Also, in the few moments Spinner stands in front of the arcade - Moss
// comes around and stand on top of Spinner"*. So Spinner's day is the arcade's step and the arcade's floor by turns, a
// new resident runs the wheel, Moss lives elsewhere — and nobody waits on a doorstep any more (they wait indoors).
import { test, expect } from '@playwright/test';
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };

const who = (page, k) => page.evaluate((key) => window.__town.life.residents().find((r) => r.key === key), k);
async function town(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.work.bosses, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.work.set({ at: '' }); });
  return errs;
}

test('Spinner stands on the arcade’s step beside its door, Twirl at the wheel, and Moss goes home to the clothes shop', async ({ page }) => {
  const errs = await town(page);
  await page.evaluate(() => window.__town.life.set(1));   // dawn: out on the step
  const sp = await who(page, 'spinner');
  expect(sp.hidden || sp.inside, 'out in the square').toBe(false);
  expect(sp.place).toBe('condo');
  expect(sp.x > 530 && sp.x < 620 && Math.abs(sp.y - 598) < 20, 'beside the door (x 444–479), not on it: ' + sp.x + ',' + sp.y).toBe(true);
  const tw = await who(page, 'twirl');
  expect(tw.place, 'the wheel has its own keeper').toBe('wheel');
  expect(Math.hypot(tw.x - 1400, tw.y - 802) < 40).toBe(true);
  await page.evaluate(() => window.__town.life.set(21));   // night: everybody home
  const [moss, sp2] = [await who(page, 'moss'), await who(page, 'spinner')];
  expect(moss.hidden && sp2.hidden, 'both home').toBe(true);
  expect(Math.hypot(moss.x - sp2.x, moss.y - sp2.y), 'and not behind the same door').toBeGreaterThan(250);
  expect(Math.hypot(moss.x - 154, moss.y - 590) < 4, 'Moss’s door is the clothes shop’s').toBe(true);
  expect(errs).toEqual([]);
});

test('on his indoor beats Spinner is on the arcade’s floor: gone from the square, and a real tap on him in there opens his card', async ({ page }) => {
  const errs = await town(page);
  await page.evaluate(() => window.__town.life.set(5));   // morning: indoors
  const sp = await who(page, 'spinner');
  expect(sp.inside, 'in the arcade').toBe(true);
  expect(sp.hidden, 'so not in the square').toBe(true);
  expect(await page.evaluate(() => document.querySelector('.tw-npc[data-k="spinner"]').hidden), 'not drawn over the town').toBe(true);
  expect(await page.evaluate(([x, y]) => JSON.stringify(window.__town.thing(x, y - 40)), [sp.x, sp.y]), 'and nothing of him to tap out there').not.toContain('spinner');
  // in through the door, and read in the same breath: shown AND placed at once, never a frame at the world's corner
  const now = await page.evaluate(() => { window.__town.rooms.enter('condo'); const e = document.querySelector('.tw-npc[data-k="spinner"]'); return { hidden: e.hidden, z: +e.style.zIndex }; });
  expect(now.hidden, 'on the floor the moment you are in').toBe(false);
  expect(now.z, 'and placed in that same moment').toBeGreaterThan(2100);
  const drawn = await page.evaluate(() => { const e = document.querySelector('.tw-npc[data-k="spinner"]'); return { cls: e.className, vis: getComputedStyle(e).visibility, z: +e.style.zIndex }; });
  expect(drawn.cls, 'a thing of the room').toContain('is-in');
  expect(drawn.vis).toBe('visible');
  expect(drawn.z, 'on the player’s own layer indoors').toBeGreaterThan(2100);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/town-spinner-inside.png' });
  const hit = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="spinner"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }; });
  await page.mouse.click(hit.x, hit.y);
  await page.waitForFunction((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].some((b) => b.textContent === q), LIFE.work.ask, { timeout: 10000 });
  expect(await page.locator('#twCardBody h2').textContent(), 'his card').toBe('Spinner');
  await page.screenshot({ path: 'test-results/town-spinner-card.png' });
  expect(errs).toEqual([]);
});

// every front door in the town (town-life.js HOME)
const DOORS = [[1100, 590], [1700, 590], [480, 592], [480, 1068], [1770, 1068], [1620, 1068], [520, 704], [154, 590]];
test('when the day turns, nobody waits on a doorstep: they wait indoors and come out when it is time to go', async ({ page }) => {
  const errs = await town(page);
  const seen = new Set();
  await page.evaluate(() => window.__town.life.set(23.96));   // a second before dawn: the town turns over as a WALK
  await page.waitForFunction(() => window.__town.life.beat() === 0, null, { timeout: 10000 });
  for (let i = 0; i < 6; i++) {
    const rs = await page.evaluate(() => window.__town.life.residents());
    for (const r of rs) if (r.waiting && r.hidden) seen.add(r.key);
    const loiter = rs.filter((r) => r.waiting && !r.hidden && DOORS.some(([x, y]) => Math.hypot(r.x - x, r.y - y) < 6)).map((r) => r.key + '@' + r.x + ',' + r.y);
    expect(loiter, 'waiting out of sight, never on the step').toEqual([]);
    await page.waitForTimeout(500);
  }
  expect(seen.size, 'and there WAS a wait indoors to watch').toBeGreaterThan(3);
  expect(errs).toEqual([]);
});

test('while you work the arcade, Spinner waits outside on its step — the floor is yours', async ({ page }) => {
  const errs = await town(page);
  await page.evaluate(() => window.__town.life.set(5));   // an indoor beat: he is on the floor
  expect((await who(page, 'spinner')).inside).toBe(true);
  await page.evaluate(() => window.__town.work.set({ at: 'condo' }));
  await page.evaluate(() => window.__town.rooms.enter('condo'));
  // his staff walks in: he walks OUT through the doorway at once — not a minute into your work
  await page.waitForFunction(() => { const r = window.__town.life.residents().find((x) => x.key === 'spinner'); return r && !r.inside && r.place === 'condo'; }, null, { timeout: 8000 });
  const sp = await who(page, 'spinner');
  expect(sp.place, 'out on the step').toBe('condo');
  // nobody on THIS floor (drawn in the room you are in). 🧾 Pip keeps the store from inside since 26 Sep 2026, so "nobody
  // inside anywhere" stopped being the arcade's business
  expect(await page.evaluate(() => JSON.stringify(window.__town.life.residents().filter((r) => r.inside && !r.hidden).map((r) => r.key)))).toBe('[]');
  await page.evaluate(() => window.__town.rooms.exit && window.__town.rooms.exit());
  expect(errs).toEqual([]);
});
