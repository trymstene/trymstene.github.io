// 📦 THE SECOND DELIVERY (28 Sep 2026), walked as a player in their house.
//
// Trym: *"fill up with some more homestead items in the shop in the banana phone order - find more fun interior from the
// modern interior pack, that we dont have before … make sure they are moveable through the build-mode, and that the
// objects have a certain delivery time, and a cost that makes sense, would be good to fill up with atleast 50 more items
// spread around the different categories on the banana phone order"* — and *"find some special items that we can use as
// rewards here and there, 10 maybe"*.
//
// One walk: the catalogue holds the new pieces on every indoor shelf (and the two new shelves), each with its own van
// time and a price; the reward pieces are nowhere in the shop; a piece is ordered, arrives, is placed in the house, and
// build mode lifts it and sets it down somewhere else; a reward is given once, and the shed never offers to sell it.
// Screenshots go to test-results/order-*.png.
import { test, expect } from '@playwright/test';
import { DECOR } from '../src/data/decor.js';

const NEW = DECOR.filter((d) => d.ship != null);
const REWARDS = DECOR.filter((d) => d.reward);
const INDOOR = ['kitchen', 'living', 'bedroom', 'bathroom', 'hallway', 'music', 'hobby', 'party'];
const SHOT = 'test-results/order-';
// a point on the house's floor, as a fraction of the room (homestead-geo roomBounds), on the screen
const floorAt = (page, fx, fy) => page.evaluate(([a, b]) => {
  const R = window.__hs.geo.roomBounds(3), wr = document.getElementById('hsWorld').getBoundingClientRect(), g = window.__hs.signGeo();
  const k = wr.width / g.W;
  return [wr.left + (R[0] + (R[2] - R[0]) * a) * k, wr.top + (R[1] + (R[3] - R[1]) * b) * k];
}, [fx, fy]);

test('the catalogue: fifty-odd new pieces over every indoor shelf, each with a van time and a price; ten rewards never sold', () => {
  expect(NEW.length, 'at least fifty new pieces for sale').toBeGreaterThanOrEqual(50);
  for (const c of INDOOR) expect(NEW.filter((d) => d.cat === c).length, 'new pieces on the ' + c + ' shelf').toBeGreaterThanOrEqual(4);
  for (const d of NEW) {
    expect(d.surface, d.id + ' belongs indoors').toBe('floor');
    expect(d.price, d.id + ' has a price').toBeGreaterThan(0);
    expect(d.ship, d.id + ' has a van time: hours, never days').toBeGreaterThanOrEqual(10);
    expect(d.ship).toBeLessThanOrEqual(240);
    expect(d.w > 0 && d.h > 0, d.id + ' has a measured footprint').toBe(true);
  }
  // a bigger thing costs more and takes longer: the dearest fifth never arrives faster than the cheapest fifth
  const byPrice = [...NEW].sort((a, b) => a.price - b.price), fifth = Math.floor(NEW.length / 5);
  const avg = (L) => L.reduce((t, d) => t + d.ship, 0) / L.length;
  expect(avg(byPrice.slice(-fifth)), 'the dear pieces take the van longer').toBeGreaterThan(avg(byPrice.slice(0, fifth)) * 2);
  expect(REWARDS.length, 'ten reward pieces').toBe(10);
  for (const d of REWARDS) expect(d.price, d.id + ' is never sold, so it is never priced').toBe(0);
  expect(new Set(DECOR.map((d) => d.id)).size, 'every id once').toBe(DECOR.length);
});

test('in the house: order a new piece, it arrives, it is placed, build mode moves it; a reward lands once and is not for sale', async ({ page }) => {
  test.setTimeout(120000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    // a claimed yard with the house up (stage 3) and an empty house, and a wallet (?hstest=rich tops it up)
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], shed: [], orders: [],
      inItems: {}, bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);

  // ── the phone's order app, indoors: every indoor shelf has a chip, the two new ones among them
  await page.evaluate(() => window.__hs.shop('order'));
  await page.waitForSelector('#hsShopList .hs-tile', { timeout: 8000 });
  const chips = await page.locator('#hsShopCats button').allTextContents();
  expect(chips.join(' | ')).toContain('🎨 Hobbies');
  expect(chips.join(' | ')).toContain('🎉 Party');
  const names = await page.locator('#hsShopList .hs-tile b').allTextContents();
  for (const d of NEW.slice(0, 20)) expect(names.some((n) => n.startsWith(d.name)), d.name + ' is on sale').toBe(true);
  for (const d of REWARDS) expect(names.some((n) => n.startsWith(d.name)), d.name + ' is never on sale').toBe(false);
  await page.screenshot({ path: SHOT + '01-all.png' });

  // ── the party shelf: each tile shows its own van time
  await page.locator('#hsShopCats button', { hasText: '🎉 Party' }).click();
  await page.waitForTimeout(400);
  const tree = page.locator('#hsShopList .hs-tile', { hasText: 'Christmas tree' });
  await expect(tree.locator('em')).toContainText('1h');
  const balloon = page.locator('#hsShopList .hs-tile', { hasText: 'Red balloon' });
  await expect(balloon.locator('em')).toContainText('10m');
  await page.screenshot({ path: SHOT + '02-party.png' });

  // ── order the balloon: it goes on the van, ten minutes
  await balloon.locator('button').click();
  await page.waitForTimeout(400);
  const inv1 = await page.evaluate(() => window.__hs.inv());
  const ord = inv1.orders.find((o) => o.id === 'balloonred');
  expect(ord, 'the balloon is on the van').toBeTruthy();
  expect(Math.round((ord.at - Date.now()) / 60000), 'for its own ten minutes').toBeGreaterThanOrEqual(9);
  await page.screenshot({ path: SHOT + '03-ordered.png' });

  // ── the van arrives (the walk moves the clock, not the van): the balloon is in the shed
  await page.evaluate(() => { const s = window.__hs.stock({}); s.orders.forEach((o) => { o.at = Date.now() - 1000; }); window.__hs.stock({ orders: s.orders }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.inv && window.__hs.inv().shed.includes('balloonred'), null, { timeout: 20000 });

  // ── place it in the house, from the shed
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__hs.shop('shed'));
  await page.waitForSelector('#hsShopList', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.locator('#hsShopList .hs-tile, #hsShopList .hs-row', { hasText: 'Red balloon' }).first().locator('button', { hasText: /place/ }).first().click();
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  // the ghost starts at your feet, where it cannot go: a tap on open floor tries a spot, then ✓
  await page.mouse.click(...(await floorAt(page, 0.3, 0.55)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const placed = await page.evaluate(() => { const L = Object.values(window.__hs.inv().inItems).flat(); return L.find((i) => i.id === 'balloonred') || null; });
  expect(placed, 'the balloon stands in the house').toBeTruthy();
  await page.screenshot({ path: SHOT + '04-placed.png' });

  // ── build mode: lift it, set it down somewhere else
  await page.click('#hsBuild');
  await page.waitForTimeout(700);
  const at = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.hs-it--in')].find((e) => (e.style.backgroundImage || '').includes('d-balloonred'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.7 };
  });
  expect(at, 'the balloon is drawn in the room').toBeTruthy();
  await page.mouse.click(at.x, at.y);
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await floorAt(page, 0.7, 0.5)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const moved = await page.evaluate(() => Object.values(window.__hs.inv().inItems).flat().find((i) => i.id === 'balloonred'));
  expect(moved.x !== placed.x || moved.y !== placed.y, 'build mode moved it (' + placed.x + ',' + placed.y + ' → ' + moved.x + ',' + moved.y + ')').toBe(true);
  await page.screenshot({ path: SHOT + '05-moved.png' });

  // ── a reward: given once, in the shed, and the shed never offers to sell it
  expect(await page.evaluate(() => window.__hs.reward('goldtrophy'))).toBe(true);
  expect(await page.evaluate(() => window.__hs.reward('goldtrophy')), 'a reward is given once').toBe(false);
  await page.evaluate(() => window.__hs.shop('shed'));
  await page.waitForTimeout(700);
  const trophy = page.locator('#hsShopList .hs-tile, #hsShopList .hs-row', { hasText: 'Golden trophy' }).first();
  await expect(trophy).toBeVisible();
  expect(await trophy.locator('button', { hasText: /sell/ }).count(), 'no sell button on a reward').toBe(0);
  await page.screenshot({ path: SHOT + '06-reward.png' });
  expect(errs).toEqual([]);
});
