// 📋 THE ORDER BOARD, WALKED (27 Sep 2026). Trym: "the Exchange looks visually abandoned … no town-banana looks responsible
// for it … can it be much more?", then "yes order board, every area".
//
// The pass worker checks, takes and pays (worker-pass/test/orders.test.mjs proves that half in-process); this walk proves
// the other half on the built site with the worker's answers stubbed: Tally stands at her stall through the working day,
// the card opens on today's three orders — the SAME three the worker holds (src/data/town/orders.js, one source) — each
// with the face and name of whoever asks, their own line, what it pays and what you have; an order you can fill has
// Deliver, one you cannot sends you to the area that makes it; a delivery says who got it and what Tally paid, takes a
// farm order's goods off the farm on this device, keeps the server's slots and counts as two visits on the resident's
// ladder. Every line is the copy file's (src/data/copy/town-exchange.json).
import { test, expect } from '@playwright/test';
import { fillWords } from '../src/lib/fill-words.js';
import EXCHANGE from '../src/data/copy/town-exchange.json' with { type: 'json' };
import NPCS from '../src/data/copy/town-npcs.json' with { type: 'json' };
import { ordersOf, statOf, givenOf, LADDER_STEP } from '../src/data/town/orders.js';
import { dayOf } from '../src/data/town/market.js';

const O = EXCHANGE.orders, X = EXCHANGE.exchange;
// the app's own filler, so a name that ends a sentence itself ("Fig Jr.") keeps one full stop, as on screen
const fill = fillWords;
const json = (o) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const nameOf = (key) => (NPCS.residents.find((r) => r.key === key) || {}).name;
const TODAY = ordersOf(dayOf(Date.now()));
const FARM = TODAY.find((o) => o.area === 'farm'), BAY = TODAY.find((o) => o.area === 'bay'), PARK = TODAY.find((o) => o.area === 'park');

// a banana with a pass, a farm holding two more than the farm order asks, one fewer of the bay's thing than it asks, and
// exactly the park's — seeded once per test (a reload must not undo what the card did)
function seed({ farm = FARM.n + 2, bay = BAY.n - 1, park = PARK.n } = {}) {
  return [({ farmGood, farm, bayStat, bay, parkStat, park }) => {
    try {
      if (sessionStorage.getItem('orders-seeded')) return;
      localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' }));
      const hs = { v: 1, slug: 'ada-yard', claimedAt: 1, eggs: 0, milk: 0, wool: 0, pubUpdated: 1000, animals: [{ id: 'h1', sp: 'hen', gs: 31 }] };
      hs[farmGood] = farm;
      localStorage.setItem('hs-v1', JSON.stringify(hs));
      const led = { [bayStat]: { dev00001: bay }, [parkStat]: { dev00001: park } };
      localStorage.setItem('pass-v1', JSON.stringify({ created: 1, patches: {}, base: {}, led, days: [] }));
      sessionStorage.setItem('orders-seeded', '1');
    } catch (e) {}
  }, { farmGood: FARM.want, farm, bayStat: statOf(BAY), bay, parkStat: statOf(PARK), park }];
}
async function town(page, init) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  if (init) await page.addInitScript(...init);
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); });
  return errs;
}
// the pass worker's /town/order: `view` answers what is delivered today, a delivery answers `answer(body)`
function orderWorker(page, answer, done = []) {
  const calls = [];
  page.route('**/town/order', (r) => {
    const b = JSON.parse(r.request().postData() || '{}');
    calls.push(b);
    if (b.view) return r.fulfill(json({ ok: true, day: dayOf(Date.now()), done }));
    return r.fulfill(json(answer(b)));
  });
  return calls;
}
const rowOf = (page, area) => page.locator('#twCardBody .tw-ex__order[data-area="' + area + '"]');
const ladder = (page, key) => page.evaluate((k) => { const p = JSON.parse(localStorage.getItem('pass-v1') || '{}'); return Object.values((p.led || {})['tw_met_' + k] || {}).reduce((a, b) => a + b, 0); }, key);

test('Tally keeps the Exchange through the working day, and lunches by the statue', async ({ page }) => {
  const errs = await town(page);
  for (const [h, want] of [[4.5, 'exchange'], [8.5, 'monument'], [12.5, 'exchange']]) {
    await page.evaluate((hh) => window.__town.life.set(hh), h);
    await page.waitForFunction((w) => { const t = window.__town.life.residents().find((r) => r.key === 'tally'); return t && t.at === w && !t.walking; }, want, { timeout: 10000 });
    const t = await page.evaluate(() => window.__town.life.residents().find((r) => r.key === 'tally'));
    expect(t.hidden, 'she is out on the square at ' + h).toBe(false);
    if (want === 'exchange') {
      expect(Math.hypot(t.x - 800, t.y - 802), 'at her stall, the Exchange (' + t.x + ', ' + t.y + ')').toBeLessThan(40);
      await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 900; t.pos.y = t.tgt.y = 880; });   // stand by the stall: the camera follows
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'test-results/town-orders/tally-at-the-exchange-' + h + '.png' });
    }
  }
  expect(errs).toEqual([]);
});

test('the Exchange opens on today’s three orders, and a delivery is paid and remembered', async ({ page }) => {
  const calls = orderWorker(page, (b) => ({ ok: true, id: b.id, who: FARM.who, want: FARM.want, kind: '', n: FARM.n, coins: FARM.coins, done: [b.id],
    yard: { updated: 2000, prev: 1000 }, wallet: { bal: 40 + FARM.coins, seq: 12 }, seen: [], slots: { coins_earned: { order: FARM.coins } } }));
  const errs = await town(page, seed());
  await page.evaluate(() => window.__town.life.set(4.5));
  await page.evaluate(() => window.__town.open('exchange'));
  await page.waitForSelector('#twCardBody .tw-ex__order', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#twCardBody .tw-ex__order').length === 3, null, { timeout: 5000 });
  expect(await page.locator('#twCardBody h2').textContent(), 'Tally’s stall').toBe(X.title);
  expect(await page.locator('#twCardBody [data-tab="orders"]').getAttribute('aria-selected'), 'the orders are the first tab').toBe('true');
  // every row: whoever asks (their name and their own line), the order and its pay, what you have
  for (const o of TODAY) {
    const row = rowOf(page, o.area), t = (await row.textContent()) || '';
    expect(t, o.area + ': who asks').toContain(nameOf(o.who));
    expect(t, o.area + ': in their own words').toContain(EXCHANGE.orders.wants[o.who][o.want]);
    expect(t, o.area + ': what it pays').toContain(fill(O.pay, { coins: o.coins }));
    expect(t, o.area + ': how many').toContain('×' + o.n);
    const drawn = await row.locator('canvas.tw-ex__face').evaluate((cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    expect(drawn, o.area + ': their face is drawn').toBeGreaterThan(200);
  }
  // the farm order can be filled; the bay one is one short, so its row sends you to the bay; the park one is exactly enough
  expect(await rowOf(page, 'farm').textContent()).toContain(fill(O.have, { have: FARM.n + 2 }));
  await expect(rowOf(page, 'farm').locator('[data-order]')).toHaveText(O.deliver);
  await expect(rowOf(page, 'bay').locator('a.tw-ex__go')).toHaveAttribute('href', '/beach/');
  await expect(rowOf(page, 'bay').locator('a.tw-ex__go')).toHaveText(O.go.bay);
  expect(await rowOf(page, 'bay').textContent()).toContain(fill(O.have, { have: BAY.n - 1 }));
  await expect(rowOf(page, 'park').locator('[data-order]')).toHaveText(O.deliver);
  await page.screenshot({ path: 'test-results/town-orders/board.png' });
  // ⚠️ §40: the card's controls are ON the card at a phone's size — the last row's button is inside the viewport unscrolled
  const vis = await rowOf(page, 'park').locator('[data-order]').evaluate((b) => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
  expect(vis, 'the last order’s button is on screen without scrolling').toBe(true);

  const before = await ladder(page, FARM.who);
  await rowOf(page, 'farm').locator('[data-order]').click();
  await expect(rowOf(page, 'farm').locator('.tw-ex__said'), 'the answer is said in the row that changed (§3d)').toHaveText(fill(O.paid, { who: nameOf(FARM.who), coins: FARM.coins }), { timeout: 8000 });
  expect(calls.filter((c) => !c.view), 'one delivery, of today’s farm order').toEqual([expect.objectContaining({ id: FARM.id })]);
  await expect(rowOf(page, 'farm').locator('button')).toHaveText(O.done);
  expect(await rowOf(page, 'farm').evaluate((r) => r.classList.contains('is-done'))).toBe(true);
  const hs = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1')));
  expect(hs[FARM.want], 'the order’s goods left the farm on this device').toBe(2);
  expect(hs.pubUpdated, 'in step with the farm before, so it steps forward with it').toBe(2000);
  const led = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-v1')).led);
  expect(led.coins_earned && led.coins_earned.order, 'the server’s own slot is kept on this device').toBe(FARM.coins);
  expect(await ladder(page, FARM.who), 'a delivery is two visits on their ladder').toBe(before + LADDER_STEP);
  await page.screenshot({ path: 'test-results/town-orders/delivered.png' });
  expect(errs).toEqual([]);
});

test('a bay or park order is given out of the pass’s count, and the server’s count of what orders took comes back', async ({ page }) => {
  orderWorker(page, (b) => ({ ok: true, id: b.id, who: PARK.who, want: PARK.want, kind: PARK.kind, n: PARK.n, coins: PARK.coins, done: [b.id],
    wallet: { bal: 9, seq: 3 }, seen: [], slots: { coins_earned: { order: PARK.coins }, [givenOf(PARK)]: { order: PARK.n } } }));
  const errs = await town(page, seed());
  await page.evaluate(() => window.__town.open('exchange'));
  await page.waitForSelector('#twCardBody .tw-ex__order[data-area="park"] [data-order]', { timeout: 15000 });
  await rowOf(page, 'park').locator('[data-order]').click();
  await expect(rowOf(page, 'park').locator('.tw-ex__said')).toHaveText(fill(O.paid, { who: nameOf(PARK.who), coins: PARK.coins }), { timeout: 8000 });
  const led = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-v1')).led);
  expect(led[givenOf(PARK)] && led[givenOf(PARK)].order, 'what the order took, as the server counts it').toBe(PARK.n);
  expect(led[statOf(PARK)].dev00001, 'the collection itself is untouched').toBe(PARK.n);
  expect(errs).toEqual([]);
});

test('an order the server says is done, short or gone says so, and the board remembers what is delivered', async ({ page }) => {
  let reply = { error: 'short', have: FARM.n - 1 };
  orderWorker(page, () => reply, [PARK.id]);
  const errs = await town(page, seed());
  await page.evaluate(() => window.__town.open('exchange'));
  await page.waitForFunction(() => { const b = document.querySelector('#twCardBody .tw-ex__order[data-area="park"] button'); return b && b.disabled; }, null, { timeout: 15000 });
  await expect(rowOf(page, 'park').locator('button'), 'the view said the park order is delivered today').toHaveText(O.done);
  await rowOf(page, 'farm').locator('[data-order]').click();
  await expect(rowOf(page, 'farm').locator('.tw-ex__said')).toHaveText(fill(O.short, { have: FARM.n - 1, n: FARM.n }), { timeout: 8000 });
  const hs = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1')));
  expect(hs[FARM.want], 'nothing left the farm').toBe(FARM.n + 2);
  reply = { error: 'done' };
  await rowOf(page, 'farm').locator('[data-order]').click();
  await expect(rowOf(page, 'farm').locator('.tw-ex__said')).toHaveText(O.already, { timeout: 8000 });
  await expect(rowOf(page, 'farm').locator('button')).toHaveText(O.done);
  expect(errs).toEqual([]);
});

test('with no homestead a farm order points at the homestead, and the spare-produce tab is still there', async ({ page }) => {
  orderWorker(page, () => ({ error: 'nofarm' }));
  const errs = await town(page, seed());
  await page.evaluate(() => { localStorage.removeItem('hs-v1'); });
  await page.evaluate(() => window.__town.open('exchange'));
  await page.waitForSelector('#twCardBody .tw-ex__order[data-area="farm"] a.tw-ex__go', { timeout: 15000 });
  await expect(rowOf(page, 'farm').locator('a.tw-ex__go')).toHaveAttribute('href', '/homestead/');
  await expect(rowOf(page, 'farm').locator('a.tw-ex__go')).toHaveText(O.go.farm);
  await page.locator('#twCardBody [data-tab="sell"]').click();
  await page.waitForSelector('#twCardBody [data-sell="eggs"]');
  expect(((await page.locator('#twSellRes').textContent()) || '').trim()).toBe(X.noFarm);
  expect(errs).toEqual([]);
});

// 📱 the smallest phone the world is tested at (memory: mobile-viewport-targets): the three orders and their buttons fit
test.describe('on a small phone', () => {
  test.use({ viewport: { width: 360, height: 640 } });
  // ⚠️ THE TALLEST CARD, not today's: the morning (Tally at her post, her head over the orders) — today, and the day in the coming
  // year whose three order lines are the longest (pip.eggs, spinner.fish, granfig.harvest, UTC day 20783). If those fit, every day does.
  for (const [label, at, met] of [['today, a stranger', 0, 0], ['the longest day, a close friend', 20783 * 86400000 + 43200000, 20]]) {
    test('every order’s button or link is on screen without scrolling the card — ' + label, async ({ page }) => {
      if (at) await page.clock.setFixedTime(new Date(at));
      orderWorker(page, () => ({ error: 'busy' }));
      const errs = await town(page, seed());
      if (met) await page.evaluate((m) => { const p = JSON.parse(localStorage.getItem('pass-v1')); p.led.tw_met_tally = { dev00001: m }; localStorage.setItem('pass-v1', JSON.stringify(p)); }, met);
      await page.evaluate(() => window.__town.life.set(4.5));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__town.open('exchange'));
      await page.waitForFunction(() => document.querySelectorAll('#twCardBody .tw-ex__order').length === 3 && !!document.querySelector('#twCardBody .tw-keep'), null, { timeout: 15000 });
      await page.waitForTimeout(300);
      const CTRL = '#twCardBody .tw-ex__act > *';
      const off = await page.evaluate((sel) => { const cr = document.querySelector('.tw-card').getBoundingClientRect(); return [...document.querySelectorAll(sel)].map((b) => { const r = b.getBoundingClientRect(); return r.top >= cr.top - 1 && r.bottom <= cr.bottom + 1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth ? '' : b.textContent + ' @' + Math.round(r.top) + '-' + Math.round(r.bottom); }).filter(Boolean); }, CTRL);
      const scroll = await page.evaluate(() => { const c = document.querySelector('.tw-card'); return c.scrollHeight - c.clientHeight; });
      await page.screenshot({ path: 'test-results/town-orders/board-360' + (met ? '-longest' : '') + '.png' });
      expect(scroll, 'the whole board is on the card: nothing below its fold').toBeLessThanOrEqual(1);
      expect(off, 'every button is on screen at 360×640').toEqual([]);
      const wrapped = await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((b) => b.getBoundingClientRect().height > 40 || b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent), CTRL);
      expect(wrapped, 'no button breaks its line (memory: buttons never line-break)').toEqual([]);
      expect(errs).toEqual([]);
    });
  }
});
