// ☕ BEAN AND STAMP HAVE LUNCH ON THE TERRACE (25 Sep 2026). Trym asked whether "the fruit cart opens" really happens; it
// did not, and neither did the lunch Bean and Stamp both talked about — Stamp's break was in the evening. He said "yes make
// the lunch real": Stamp's break is at noon now, on the terrace beside Bean, the two of them turned to each other. A shift
// at either counter does not pull them off it (a boss steps aside only when they would be standing at that counter).
import { test, expect } from '@playwright/test';
import NPCS from '../src/data/copy/town-npcs.json' with { type: 'json' };

const who = (page, k) => page.evaluate((key) => window.__town.life.residents().find((r) => r.key === key), k);
const S = (page, fn) => page.evaluate((src) => { const s = window.__town.sort(); return s ? (0, eval)('(' + src + ')')(s) : null; }, fn.toString());
async function town(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hs-v1', JSON.stringify({ slug: 'ada-yard', claimedAt: Date.now() })); } catch (e) {} });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.work.set({ at: '' }); window.__town.life.set(9); });   // noon
  return errs;
}
async function lunch(page, why) {
  const [b, s] = [await who(page, 'bean'), await who(page, 'stamp')];
  expect(b.place + ' / ' + s.place, why + ': both on the terrace').toBe('terrace / terrace');
  expect(b.hidden || s.hidden, 'both out where you can see them').toBe(false);
  expect(Math.hypot(b.x - s.x, b.y - s.y), 'side by side, never one on the other').toBeGreaterThan(60);
  const [l, r] = b.x < s.x ? [b, s] : [s, b];
  expect(l.face + ' / ' + r.face, 'turned to each other: the one on the left looks right').toBe('right / left');
}

test('at noon Bean and Stamp sit on the terrace together, turned to each other, and say so', async ({ page }) => {
  const errs = await town(page);
  await lunch(page, 'noon');
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 1690; t.pos.y = t.tgt.y = 1150; });   // the camera on the terrace
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/town-lunch.png' });
  const bean = NPCS.residents.find((r) => r.key === 'bean'), stamp = NPCS.residents.find((r) => r.key === 'stamp');
  expect(bean.beats[2].lines.join(' '), 'Bean talks about it').toContain('Stamp');
  expect(stamp.beats[2].lines.join(' '), 'and so does Stamp').toContain('Bean');
  // the evening: Stamp is back at the post office, and the terrace is Bean's walk home
  await page.evaluate(() => window.__town.life.set(17));
  expect((await who(page, 'stamp')).place, 'the evening is at his counter again').toBe('post');
  expect(errs).toEqual([]);
});

test('a round at the post office at noon leaves Stamp at lunch: nobody at his counter to step aside', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'post', pay: 180 }));
  await page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  expect(await page.evaluate(() => window.__town.sortReady())).toBe(true);
  expect(await S(page, (s) => s.clockIn()), 'the round starts').toBe(true);
  await page.waitForTimeout(1500);   // the poll that sends a boss aside runs every half second
  await lunch(page, 'during a round');
  expect(errs).toEqual([]);
});

test('a shift at the Coffee Cup at noon leaves Bean at lunch, never stacked on Stamp', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  const errs = await town(page);
  await page.evaluate(() => window.__town.room.set(85));   // a healthy town: the café is open
  expect(await page.evaluate(() => window.__town.room.cafeReady()), 'the counter’s chunk arrives').toBe(true);
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 5000 });
  await page.waitForTimeout(1500);
  await lunch(page, 'during a café shift');
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  expect(errs).toEqual([]);
});
