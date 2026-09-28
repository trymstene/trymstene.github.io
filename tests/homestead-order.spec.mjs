// 📦 THE SECOND DELIVERY (28 Sep 2026), walked as a player in their house.
//
// Trym: *"fill up with some more homestead items in the shop in the banana phone order - find more fun interior from the
// modern interior pack, that we dont have before … make sure they are moveable through the build-mode, and that the
// objects have a certain delivery time, and a cost that makes sense, would be good to fill up with atleast 50 more items
// spread around the different categories on the banana phone order"* — and *"find some special items that we can use as
// rewards here and there, 10 maybe"*. Then his look at it: the things on counters hung over the edge, a sink that was an
// oven, a fridge twice, a locker in the bedroom, and *"images in frames, portraits and paintings - they should be only
// placable on walls, in the cabin or house, but it needs to look like they fit on the actual walls"*, and *"not all
// should be available if you only have a tent, and not all if you have a cabin, but all that have upgraded to House
// should have everything available"*.
//
// The catalogue is checked as data; then a walk in the house orders a piece, waits for the van, places it and moves it in
// build mode, hangs a painting on the wall and slides it along, opens the fridge, and is given a reward once; and a walk in
// the tent finds that a picture will not go up where there is no wall. Screenshots go to test-results/order-*.png.
import { test, expect } from '@playwright/test';
import { DECOR } from '../src/data/decor.js';
import HW from '../src/data/copy/homestead-toasts.json' with { type: 'json' };

const NEW = DECOR.filter((d) => d.ship != null && !d.retired);
const REWARDS = DECOR.filter((d) => d.reward);
const INDOOR = ['kitchen', 'living', 'bedroom', 'bathroom', 'hallway', 'music', 'hobby', 'party'];
const IN = DECOR.filter((d) => d.surface === 'floor' || d.surface === 'wall');
const SHOT = 'test-results/order-';
// a point on the house's floor, as a fraction of the room (homestead-geo roomBounds), on the screen
const floorAt = (page, fx, fy) => page.evaluate(([a, b]) => {
  const R = window.__hs.geo.roomBounds(3), wr = document.getElementById('hsWorld').getBoundingClientRect(), g = window.__hs.signGeo();
  const k = wr.width / g.W;
  return [wr.left + (R[0] + (R[2] - R[0]) * a) * k, wr.top + (R[1] + (R[3] - R[1]) * b) * k];
}, [fx, fy]);
// a placed piece's element, by its picture
const drawn = (page, id) => page.evaluate((i) => {
  const el = [...document.querySelectorAll('.hs-it--in')].find((e) => (e.style.backgroundImage || '').includes('/d-' + i + '.'));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.6, top: r.top, bottom: r.bottom, left: r.left, w: r.width, z: +el.style.zIndex, bg: el.style.backgroundImage };
}, id);
const inRoom = (page, id) => page.evaluate((i) => Object.values(window.__hs.inv().inItems).flat().find((x) => x.id === i) || null, id);
const placeFromShed = async (page, name) => {
  await page.evaluate(() => window.__hs.shop('shed'));
  await page.waitForSelector('#hsShopList', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.locator('#hsShopList .hs-tile, #hsShopList .hs-row', { hasText: name }).first().locator('button', { hasText: /place/ }).first().click();
};

test('the catalogue: sixty-odd new pieces on every indoor shelf, each with a van time, a price and a home; pictures hang on walls; ten rewards never sold', () => {
  expect(NEW.length, 'at least fifty new pieces for sale').toBeGreaterThanOrEqual(50);
  for (const c of INDOOR) expect(NEW.filter((d) => d.cat === c).length, 'new pieces on the ' + c + ' shelf').toBeGreaterThanOrEqual(4);
  for (const d of NEW) {
    expect(['floor', 'wall'], d.id + ' belongs indoors').toContain(d.surface);
    expect(d.price, d.id + ' has a price').toBeGreaterThan(0);
    expect(d.ship, d.id + ' has a van time: hours, never days').toBeGreaterThanOrEqual(10);
    expect(d.ship).toBeLessThanOrEqual(240);
    expect(d.w > 0 && d.h > 0, d.id + ' has a measured footprint').toBe(true);
  }
  // a bigger thing costs more and takes longer: the dearest fifth never arrives faster than the cheapest fifth
  const byPrice = [...NEW].sort((a, b) => a.price - b.price), fifth = Math.floor(NEW.length / 5);
  const avg = (L) => L.reduce((t, d) => t + d.ship, 0) / L.length;
  expect(avg(byPrice.slice(-fifth)), 'the dear pieces take the van longer').toBeGreaterThan(avg(byPrice.slice(0, fifth)) * 2);
  // 🖼 every picture is a wall piece, fits the house's wall face (60 px) and needs a home with walls
  const walls = DECOR.filter((d) => d.surface === 'wall');
  expect(walls.length, 'pictures for sale and as rewards').toBeGreaterThanOrEqual(12);
  for (const d of walls) {
    expect(d.h, d.id + ' fits between the house wall’s trim and its baseboard').toBeLessThanOrEqual(60);
    expect(d.stage, d.id + ' needs the cabin, the first home with walls').toBeGreaterThanOrEqual(2);
  }
  // a reward has the home it fits too: the big ones wait for the house
  for (const id of ['dinoskeleton', 'triceratops', 'goldharp']) expect(DECOR.find((d) => d.id === id).stage, id + ' waits for the house').toBe(3);
  for (const id of ['starrynight', 'greatwave', 'smilinglady', 'butterflies', 'goldmedal', 'chalkboard', 'goldmirror']) {
    expect(DECOR.find((d) => d.id === id).surface, id + ' hangs on a wall').toBe('wall');
  }
  // 🏠 every home holds a different amount of the shop, and the house holds all of it
  const sold = IN.filter((d) => !d.reward && !d.retired);
  const at = (s) => sold.filter((d) => d.stage <= s).length;
  expect(at(1), 'the tent: what you could carry in').toBeGreaterThan(10);
  expect(at(1)).toBeLessThan(at(2) / 2);
  expect(at(2), 'the cabin: not yet everything').toBeLessThan(at(3));
  expect(at(3), 'the house: everything').toBe(sold.length);
  for (const id of ['fireplace', 'aquarium', 'upright', 'harp', 'treadmill', 'soapsink', 'gpiano', 'pooltable']) expect(DECOR.find((d) => d.id === id).stage, id + ' waits for the house').toBe(3);
  // Trym's sorting: the locker is a gym locker, the toy instruments are music, the deep tub is the bathtub
  const by = (id) => DECOR.find((d) => d.id === id);
  expect([by('locker').name, by('locker').cat]).toEqual(['Metal locker', 'hobby']);
  expect([by('toykeys').cat, by('toydrum').cat]).toEqual(['music', 'music']);
  expect(by('soapsink').name).toBe('Bathtub');
  expect(by('openfridge').retired, 'one fridge on the shelf; the open one is its door').toBe(1);
  expect(REWARDS.length, 'ten reward pieces').toBe(10);
  for (const d of REWARDS) expect(d.price, d.id + ' is never sold, so it is never priced').toBe(0);
  expect(new Set(DECOR.map((d) => d.id)).size, 'every id once').toBe(DECOR.length);
});

test('in the house: order, van, place, move; a painting hangs on the wall and slides along it; the fridge opens; a reward lands once', async ({ page }) => {
  test.setTimeout(150000);
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
  for (const d of NEW.slice(0, 24)) expect(names.some((n) => n.startsWith(d.name)), d.name + ' is on sale').toBe(true);
  for (const d of REWARDS) expect(names.some((n) => n.startsWith(d.name)), d.name + ' is never on sale').toBe(false);
  expect(names.some((n) => n.startsWith('Open fridge')), 'the open fridge is the fridge’s door, not a second fridge').toBe(false);
  await page.screenshot({ path: SHOT + '01-all.png' });

  // ── the party shelf: each tile shows its own van time
  await page.locator('#hsShopCats button', { hasText: '🎉 Party' }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('#hsShopList .hs-tile', { hasText: 'Christmas tree' }).locator('em')).toContainText('1h');
  const balloon = page.locator('#hsShopList .hs-tile', { hasText: 'Red balloon' });
  await expect(balloon.locator('em')).toContainText('10m');
  await page.screenshot({ path: SHOT + '02-party.png' });

  // ── order the balloon: it goes on the van, ten minutes
  await balloon.locator('button').click();
  await page.waitForTimeout(400);
  const ord = (await page.evaluate(() => window.__hs.inv())).orders.find((o) => o.id === 'balloonred');
  expect(ord, 'the balloon is on the van').toBeTruthy();
  expect(Math.round((ord.at - Date.now()) / 60000), 'for its own ten minutes').toBeGreaterThanOrEqual(9);

  // ── the van arrives (the walk moves the clock, not the van): the balloon is in the shed, with a fridge beside it
  await page.evaluate(() => { const s = window.__hs.stock({}); s.orders.forEach((o) => { o.at = Date.now() - 1000; }); window.__hs.stock({ orders: s.orders, shed: [...s.shed, { id: 'fridge' }] }); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.inv && window.__hs.inv().shed.includes('balloonred'), null, { timeout: 20000 });

  // ── place it in the house, from the shed: the ghost starts at your feet, a tap on open floor tries a spot, then ✓
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  await placeFromShed(page, 'Red balloon');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await floorAt(page, 0.3, 0.55)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const placed = await inRoom(page, 'balloonred');
  expect(placed, 'the balloon stands in the house').toBeTruthy();

  // ── build mode: lift it, set it down somewhere else
  await page.click('#hsBuild');
  await page.waitForTimeout(700);
  const b1 = await drawn(page, 'balloonred');
  await page.mouse.click(b1.x, b1.y);
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await floorAt(page, 0.7, 0.5)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const moved = await inRoom(page, 'balloonred');
  expect(moved.x !== placed.x || moved.y !== placed.y, 'build mode moved it').toBe(true);
  await page.screenshot({ path: SHOT + '03-moved.png' });

  // ── 🖼 a painting: given as a reward, it goes up ON THE WALL — wherever the tap lands, only its place along the wall moves
  expect(await page.evaluate(() => window.__hs.reward('starrynight'))).toBe(true);
  await placeFromShed(page, 'Starry night painting');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await floorAt(page, 0.25, 0.9)));   // a tap on the floor, far below the wall
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + '04-painting-ghost.png' });
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const wall = await page.evaluate(() => window.__hs.geo.wallOf(3));
  const d = DECOR.find((x) => x.id === 'starrynight');
  const hung = await inRoom(page, 'starrynight');
  expect(hung, 'the painting is up').toBeTruthy();
  expect(hung.y, 'on the wall face, not the floor below it').toBe(Math.round(Math.max(wall[1] + d.h, (wall[1] + wall[3] + d.h) / 2)));
  expect(hung.y - d.h >= wall[1] && hung.y <= wall[3], 'inside the face, trim to baseboard').toBe(true);
  const pic = await drawn(page, 'starrynight');
  expect(pic.z, 'drawn flat on the wall, behind everything that stands on the floor').toBe(2100);
  await page.screenshot({ path: SHOT + '05-painting-hung.png' });

  // ── …and build mode slides it along the wall, never off it: a tap on the floor to the right, down in the room
  const p1 = await drawn(page, 'starrynight');
  await page.mouse.click(p1.x, p1.y);
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(Math.min(p1.x + 130, 360), p1.bottom + 160);
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const slid = await inRoom(page, 'starrynight');
  expect(slid.x, 'moved along the wall').not.toBe(hung.x);
  expect(slid.y, 'at the same height on it').toBe(hung.y);
  await page.screenshot({ path: SHOT + '06-painting-moved.png' });

  // ── every control on the view is chrome the world ignores: "✓ done" used to walk you to the bar, out of the door under it
  expect(await page.evaluate(() => [...document.querySelectorAll('#hsView button, #hsView a')]
    .filter((b) => !b.closest('#hsWorld') && !window.__hs.onChrome(b)).map((b) => b.id || b.getAttribute('aria-label') || b.textContent)), 'controls the world would also take as a tap').toEqual([]);
  await page.click('#hsPlanDone');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => document.getElementById('hsWorld').classList.contains('is-inside')), 'still in the house after ✓ done').toBe(true);

  // ── 🧊 the fridge: placed like anything else; a tap (out of build mode) swings its door open, and it shuts by itself
  await placeFromShed(page, 'The fridge');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await floorAt(page, 0.15, 0.15)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const fr = await inRoom(page, 'fridge');
  expect(fr, 'the fridge is in').toBeTruthy();
  await page.evaluate(([x, y]) => window.__hs.warp(x + 30, y + 30), [fr.x, fr.y]);
  await page.waitForTimeout(400);
  const f0 = await drawn(page, 'fridge');
  await page.mouse.click(f0.x, f0.y);
  await page.waitForTimeout(300);
  const f1 = await page.evaluate(() => { const el = [...document.querySelectorAll('.hs-it--in')].find((e) => (e.style.backgroundImage || '').includes('d-openfridge')); return el ? el.getBoundingClientRect().width : 0; });
  expect(f1, 'the door swings open').toBeGreaterThan(f0.w * 1.4);
  await page.screenshot({ path: SHOT + '07-fridge-open.png' });
  await page.waitForTimeout(2600);
  expect((await drawn(page, 'fridge')).w, 'and shuts by itself').toBeCloseTo(f0.w, 0);

  // ── a reward: given once, in the shed, and the shed never offers to sell it
  expect(await page.evaluate(() => window.__hs.reward('goldtrophy'))).toBe(true);
  expect(await page.evaluate(() => window.__hs.reward('goldtrophy')), 'a reward is given once').toBe(false);
  await page.evaluate(() => window.__hs.shop('shed'));
  await page.waitForTimeout(700);
  const trophy = page.locator('#hsShopList .hs-tile, #hsShopList .hs-row', { hasText: 'Golden trophy' }).first();
  await expect(trophy).toBeVisible();
  expect(await trophy.locator('button', { hasText: /sell/ }).count(), 'no sell button on a reward').toBe(0);
  await page.screenshot({ path: SHOT + '08-reward.png' });
  // …and it stands in the room like any other piece
  await trophy.locator('button', { hasText: /place/ }).click();
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await floorAt(page, 0.45, 0.35)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(800);
  expect(await inRoom(page, 'goldtrophy'), 'the trophy stands in the house').toBeTruthy();
  await page.screenshot({ path: SHOT + '12-trophy-in-room.png' });
  expect(errs).toEqual([]);
});

test('in the tent: a picture will not go up where there is no wall, nor a dinosaur where it cannot fit — both wait in the shed', async ({ page }) => {
  test.setTimeout(90000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 1, items: [], shed: [{ id: 'greatwave' }, { id: 'dinoskeleton' }], orders: [],
      inItems: {}, bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__hs.geo.wallOf(1)), 'the tent has no wall to hang on').toBe(null);
  await placeFromShed(page, 'Great wave painting');
  await page.waitForTimeout(500);
  expect(await page.locator('#hsConfirm:not([hidden])').count(), 'no ghost comes up').toBe(0);
  await expect(page.getByText(HW.wallOnly).first(), 'the phone says why').toBeVisible();
  expect(await page.evaluate(() => window.__hs.inv().shed), 'it stays in the shed').toContain('greatwave');
  await page.screenshot({ path: SHOT + '09-tent-no-wall.png' });
  await page.locator('#hsShopList .hs-row', { hasText: 'Dinosaur skeleton' }).locator('button', { hasText: /place/ }).click();
  await page.waitForTimeout(500);
  expect(await page.locator('#hsConfirm:not([hidden])').count(), 'no dinosaur in a tent').toBe(0);
  await expect(page.getByText(HW.bigHome).first()).toBeVisible();
  expect(await page.evaluate(() => window.__hs.inv().shed), 'it waits in the shed for the house').toContain('dinoskeleton');
  await page.screenshot({ path: SHOT + '10-tent-no-dino.png' });
  // and the tent's shop shows the cabin's things locked, never on sale to a tent
  await page.evaluate(() => window.__hs.shop('order'));
  await page.waitForSelector('#hsShopList .hs-tile', { timeout: 8000 });
  const locked = await page.locator('#hsShopList .hs-tile.is-locked b').allTextContents();
  for (const n of ['Fireplace', 'Aquarium', 'Sunset picture', 'Kitchen sink']) expect(locked.some((t) => t.startsWith(n)), n + ' is locked in a tent').toBe(true);
  expect(errs).toEqual([]);
});

test('in the cabin: pictures hang on the cabin’s own wall, side by side, never one over the other', async ({ page }) => {
  test.setTimeout(90000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 2, items: [], shed: [{ id: 'sunsetpic' }, { id: 'fairylights' }, { id: 'moonposter' }], orders: [],
      inItems: {}, bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  const wall = await page.evaluate(() => window.__hs.geo.wallOf(2));
  expect(wall, 'the cabin has a wall').toBeTruthy();
  // a point along the cabin's wall, as a fraction of it, on the screen
  const wallAt = (fx) => page.evaluate(([a]) => {
    const w = window.__hs.geo.wallOf(2), wr = document.getElementById('hsWorld').getBoundingClientRect(), k = wr.width / window.__hs.signGeo().W;
    return [wr.left + (w[0] + (w[2] - w[0]) * a) * k, wr.top + ((w[1] + w[3]) / 2) * k];
  }, [fx]);
  const hang = async (name, fx) => {
    await placeFromShed(page, name);
    await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
    await page.mouse.click(...(await wallAt(fx)));
    await page.waitForTimeout(300);
    await page.click('#hsPlaceGo');
    await page.waitForTimeout(600);
  };
  await hang('Sunset picture', 0.2);
  await hang('Moon poster', 0.5);
  await hang('Fairy lights', 0.8);
  const up = [];
  for (const id of ['sunsetpic', 'moonposter', 'fairylights']) {
    const d = DECOR.find((x) => x.id === id), it = await inRoom(page, id);
    expect(it, id + ' is up').toBeTruthy();
    expect(it.y, id + ' hangs on the cabin’s wall').toBe(Math.round(Math.max(wall[1] + d.h, (wall[1] + wall[3] + d.h) / 2)));
    expect(it.x - d.w / 2 >= wall[0] && it.x + d.w / 2 <= wall[2], id + ' within the wall, corner to corner').toBe(true);
    up.push({ l: it.x - d.w / 2, r: it.x + d.w / 2 });
  }
  up.sort((a, b) => a.l - b.l);
  for (let i = 1; i < up.length; i++) expect(up[i].l, 'side by side, never one over the other').toBeGreaterThanOrEqual(up[i - 1].r);
  await page.screenshot({ path: SHOT + '11-cabin-wall.png' });
  expect(errs).toEqual([]);
});
