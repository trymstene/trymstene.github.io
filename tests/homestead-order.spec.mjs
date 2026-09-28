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
// a world point on the screen, through the world element as it is drawn (its rect already carries the camera)
const screenAt = (page, wx, wy) => page.evaluate(([x, y]) => {
  const wr = document.getElementById('hsWorld').getBoundingClientRect(), k = wr.width / window.__hs.signGeo().W;
  return [wr.left + x * k, wr.top + y * k];
}, [wx, wy]);
// the camera glides to a new ghost or a moved banana: wait until the world stands still before a world point becomes a tap
const settle = async (page) => {
  let last = null;
  for (let i = 0; i < 40; i++) {
    const r = await page.evaluate(() => { const b = document.getElementById('hsWorld').getBoundingClientRect(); return Math.round(b.left * 4) + ',' + Math.round(b.top * 4); });
    if (r === last) return;
    last = r;
    await page.waitForTimeout(80);
  }
};
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
  // the kitchen line: every counter, the stove and the fridge know the empty rows under their front and their side border
  for (const id of ['kcounter', 'coffeemk', 'stockcounter', 'sinkcounter', 'toastcounter', 'microcounter', 'espressobar']) expect(by(id).tight, id).toEqual([0, 3]);
  expect(by('stove').tight, 'the stove: 12 empty rows under it, drawn at 2/3').toEqual([12, 2]);
  expect(by('fridge').tight, 'the fridge').toEqual([12, 2]);
  // a tap's other state, drawn in the same frame: the fridge open (its door grows it right), the stove lit, the toast
  // down, a cup under the coffee machine — and every other counter's cupboard open (Trym: "add tap states to more
  // kitchen things too"), each the size of the piece itself
  expect([by('fridge').alt, by('stove').alt, by('toastcounter').alt, by('espressobar').alt]).toEqual([[53, 85], [32, 64], [87, 84], [171, 87]]);
  for (const id of ['kcounter', 'coffeemk', 'stockcounter', 'sinkcounter', 'microcounter']) expect(by(id).alt, id + '’s cupboard').toEqual([by(id).w, by(id).h]);
  // the kitchen grill (added as a drinks cooler; Trym: "actually is a kitchen grill haha, looks like meat sticks on it"):
  // the house's, a kitchen-line piece, a tap shows its skewers
  const dc = by('drinkscooler');
  expect([dc.name, dc.cat, dc.stage, dc.ship, dc.alt]).toEqual(['Kitchen grill', 'kitchen', 3, 90, [dc.w, dc.h]]);
  expect(dc.tight, 'it stands in the kitchen line').toBeTruthy();
  // 🛁 and the bathroom (Trym: "add tap states to the bathroom things too"): the toilet's lid, the cabinet (it was never
  // a towel rack), the laundry — each other state the size of the piece
  for (const id of ['toilet', 'towelrack', 'laundry']) expect(by(id).alt, id).toEqual([by(id).w, by(id).h]);
  expect(by('towelrack').name, 'B133 is a cabinet with a mirror on top').toBe('Bathroom cabinet');
  // 🚽 tall on tiny feet: by the wall they stand 18 px out (Trym: "the 18 old is the correct position") and never join a
  // kitchen chain (the 0 border)
  expect([by('toilet').tight, by('towelrack').tight]).toEqual([[14, 0, 18], [8, 0, 18]]);
  // and the wash stand and the washing machine the same way (Trym: "do the same for the wash stand and washing machine")
  expect([by('bvanity').tight, by('washer').tight]).toEqual([[14, 0, 18], [8, 0, 18]]);
  // and the standing mirror and the bookcases (Trym: "do the same for the standing mirror and bookcases")
  expect([by('floormirror').tight, by('bookcase').tight, by('bookshelf').tight]).toEqual([[14, 0, 18], [14, 0, 18], [18, 0, 18]]);
  // names say what the picture shows (Trym: "the Microwave counter is actually a toaster")
  expect(by('coffeemk').name, 'a stand mixer on a counter').toBe('Baking counter');
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
  const f1 = await page.evaluate(() => { const el = [...document.querySelectorAll('.hs-it--in')].find((e) => (e.style.backgroundImage || '').includes('d-fridge-alt')); return el ? el.getBoundingClientRect().width : 0; });
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
  await expect(page.locator('#hsToast.is-on'), 'the arrival line has had its say').toHaveCount(0, { timeout: 8000 });
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
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 2, items: [], shed: [{ id: 'sunsetpic' }, { id: 'fairylights' }, { id: 'moonposter' }, { id: 'sinkcounter' }, { id: 'toilet' }], orders: [],
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
  // 🍳 and a counter under them, pushed to the wall: a tap on the wall stands it tight against the cabin's wall too
  await placeFromShed(page, 'Sink counter');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await screenAt(page, 900, 420)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const sink = await inRoom(page, 'sinkcounter');
  expect(sink, 'the sink counter is in').toBeTruthy();
  expect(sink.y, 'tight against the cabin’s wall').toBe(await page.evaluate(() => window.__hs.geo.tightY('sinkcounter', 2)));
  // 🚽 and a toilet by the cabin's wall: its feet 18 px in front of the cabin's floor line, too
  await placeFromShed(page, 'The toilet');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await screenAt(page, 790, 430)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const loo = await inRoom(page, 'toilet');
  expect(loo && loo.y - DECOR.find((x) => x.id === 'toilet').tight[0], 'the toilet’s feet at the cabin’s wall').toBe(372 + 92 + 18);
  await page.screenshot({ path: SHOT + '11-cabin-wall.png' });
  expect(errs).toEqual([]);
});

// 🍳 Trym, 28 Sep 2026: "the placement of countertops should go closer into the wall … this goes for all already
// implemented counters", then "the stove could stick more to the wall from the back aswell, and yeah, countertops kind
// of should stick together or be built like a chain". Each piece comes out of the shed and a tap on the wall, near the
// last one, puts it down: fronts flush along the wall, and each butted to its neighbour with one border between them.
test('in the house: a kitchen built along the wall is one run — fronts flush, each piece butted to the next', async ({ page }) => {
  test.setTimeout(120000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], orders: [],
      shed: [{ id: 'fridge' }, { id: 'sinkcounter' }, { id: 'toastcounter' }, { id: 'stove' }, { id: 'drinkscooler' }],
      inItems: {}, bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 1280, height: 900 });   // the whole house on one screen: every tap lands on it
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  const put = async (name, wx) => {
    await placeFromShed(page, name);
    await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
    await page.mouse.click(...(await screenAt(page, wx, 380)));   // on the wall, above where it should stand
    await page.waitForTimeout(300);
    await page.click('#hsPlaceGo');
    await page.waitForTimeout(600);
  };
  // each tap lands a little off the last piece's side, the way a thumb does
  await put('The fridge', 648);
  await put('Sink counter', 700);
  await put('Toaster counter', 790);
  await put('The stove', 850);
  await put('Kitchen grill', 890);
  const run = [];
  for (const id of ['fridge', 'sinkcounter', 'toastcounter', 'stove', 'drinkscooler']) {
    const it = await inRoom(page, id), d = DECOR.find((x) => x.id === id);
    expect(it, id + ' is in').toBeTruthy();
    expect(it.y, id + ' stands against the wall').toBe(await page.evaluate((i) => window.__hs.geo.tightY(i, 3), id));
    run.push({ id, front: it.y - d.tight[0], l: it.x - d.w / 2, r: it.x + d.w / 2, seam: d.tight[1] });
  }
  expect(new Set(run.map((p) => p.front)).size, 'fronts flush: ' + run.map((p) => p.front).join(', ')).toBe(1);
  expect(run[0].front, 'on the counters’ line: a counter’s top edge meets the wall').toBe(450);
  run.sort((a, b) => a.l - b.l);
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1], b = run[i];
    expect(Math.abs(a.r - b.l - Math.min(a.seam, b.seam)), a.id + ' and ' + b.id + ' butted, one border between them').toBeLessThanOrEqual(0.5);
  }
  await page.screenshot({ path: SHOT + '13-kitchen-tight.png' });

  // ── a tap (not in build mode) wakes each one: the stove's burners light, the toast goes down, the sink's cupboard
  // opens — and each comes back by itself
  const bg = (id) => page.evaluate((i) => { const el = [...document.querySelectorAll('.hs-it--in')].find((e) => (e.style.backgroundImage || '').includes('/d-' + i)); return el ? el.style.backgroundImage : ''; }, id);
  const stove = await inRoom(page, 'stove');
  await page.evaluate(([x, y]) => window.__hs.warp(x - 40, y + 40), [stove.x, stove.y]);
  await page.waitForTimeout(500);
  const s0 = await drawn(page, 'stove');
  await page.mouse.click(s0.x, s0.y);
  const k0 = await drawn(page, 'sinkcounter');
  await page.mouse.click(k0.x, k0.y + 10);
  const t0 = await drawn(page, 'toastcounter');
  await page.mouse.click(t0.x, t0.y + 20);
  const c0 = await drawn(page, 'drinkscooler');
  await page.mouse.click(c0.x, c0.y);
  await page.waitForTimeout(250);
  expect(await bg('drinkscooler'), 'the grill shows its skewers').toContain('d-drinkscooler-alt');
  expect(await bg('stove'), 'the burners light').toContain('d-stove-alt');
  expect(await bg('sinkcounter'), 'the cupboard under the sink opens').toContain('d-sinkcounter-alt');
  expect(await bg('toastcounter'), 'the toast goes down').toContain('d-toastcounter-alt');
  await page.screenshot({ path: SHOT + '14-kitchen-awake.png' });
  await page.waitForTimeout(2600);
  expect(await bg('stove'), 'the burners go out').not.toContain('-alt');
  expect(await bg('sinkcounter'), 'the cupboard shuts').not.toContain('-alt');
  expect(await bg('toastcounter'), 'and up it pops').not.toContain('-alt');
  expect(await bg('drinkscooler'), 'and shuts').not.toContain('-alt');

  // ── 🔨 build mode snaps too (Trym: "make the counters snap together in build mode too"), and forgives a thumb: lift
  // the toaster counter out of the run and tap 35 px past the grill's side — it lands butted to the grill, at the wall
  await page.click('#hsBuild');
  await page.waitForTimeout(700);
  const t1 = await drawn(page, 'toastcounter');
  await page.mouse.click(t1.x, t1.y + 20);
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  const grill = await inRoom(page, 'drinkscooler'), G = DECOR.find((x) => x.id === 'drinkscooler'), T = DECOR.find((x) => x.id === 'toastcounter');
  const butted = Math.round(grill.x + (G.w + T.w) / 2 - Math.min(G.tight[1], T.tight[1]));
  await page.mouse.click(...(await screenAt(page, butted + 35, 440)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const moved = await inRoom(page, 'toastcounter');
  expect([moved.x, moved.y], 'butted to the grill’s side, against the wall').toEqual([butted, await page.evaluate(() => window.__hs.geo.tightY('toastcounter', 3))]);
  await page.screenshot({ path: SHOT + '15-kitchen-moved.png' });
  expect(errs).toEqual([]);
});

// 🛁 Trym, 28 Sep 2026: "add tap states to the bathroom things too", then "the toilet and the cabinet needs to have its
// default position further back to the wall … they are tall and not wide objects, so they should be much tighter into the
// wall", and of four distances "the 18 old is the correct position". Each comes out of the shed and a tap on the wall
// stands it there: feet 18 px out, the rest up the wall. Then a
// tap closes the toilet's lid, opens the cabinet on its towels and shows the laundry — and each goes back by itself.
test('in the house: the bathroom stands tight to the wall and answers a tap — the toilet lid, the cabinet, the laundry', async ({ page }) => {
  test.setTimeout(120000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], orders: [],
      shed: [{ id: 'toilet' }, { id: 'towelrack' }, { id: 'bvanity' }, { id: 'washer' }], inItems: { 3: [{ id: 'laundry', x: 840, y: 504 }] },
      bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  for (const [name, id, wx] of [['The toilet', 'toilet', 700], ['Bathroom cabinet', 'towelrack', 760], ['Wash stand', 'bvanity', 880], ['Washing machine', 'washer', 960]]) {
    await placeFromShed(page, name);
    await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
    await page.mouse.click(...(await screenAt(page, wx, 390)));   // on the wall
    await page.waitForTimeout(300);
    await page.click('#hsPlaceGo');
    await page.waitForTimeout(600);
    const it = await inRoom(page, id), d = DECOR.find((x) => x.id === id);
    expect(it.y, id + ' stands on its own wall line').toBe(await page.evaluate((i) => window.__hs.geo.tightY(i, 3), id));
    expect(it.y - d.tight[0], id + '’s feet 18 px in front of the floor line (plate row 92)').toBe(332 + 92 + 18);
  }
  await page.screenshot({ path: SHOT + '17-bathroom-wall.png' });
  await page.evaluate(() => window.__hs.warp(760, 560));
  await page.waitForTimeout(900);
  const bg = (id) => page.evaluate((i) => { const el = [...document.querySelectorAll('.hs-it--in')].find((e) => (e.style.backgroundImage || '').includes('/d-' + i)); return el ? el.style.backgroundImage : ''; }, id);
  for (const id of ['toilet', 'towelrack', 'laundry']) {
    const p = await drawn(page, id);
    await page.mouse.click(p.x, p.y);
  }
  await page.waitForTimeout(250);
  expect(await bg('toilet'), 'the lid goes down').toContain('d-toilet-alt');
  expect(await bg('towelrack'), 'the cabinet opens on its towels').toContain('d-towelrack-alt');
  expect(await bg('laundry'), 'the laundry shows').toContain('d-laundry-alt');
  await page.screenshot({ path: SHOT + '16-bathroom-awake.png' });
  await page.waitForTimeout(2600);
  for (const id of ['toilet', 'towelrack', 'laundry']) expect(await bg(id), id + ' back by itself').not.toContain('-alt');
  expect(errs).toEqual([]);
});

// 📚 Trym, 28 Sep 2026: "do the same for the standing mirror and bookcases. remember, its important that these things also
// can be placed in the middle of the room if users want it - but close to the wall means always stick to the wall". A tap
// on the wall, or one row out, stands a piece on its wall line; a tap in the middle of the room stands it right there.
test('in the house: close to the wall sticks to it, the middle of the room is free', async ({ page }) => {
  test.setTimeout(120000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], orders: [], inItems: {},
      shed: [{ id: 'bookcase' }, { id: 'bookshelf' }, { id: 'floormirror' }, { id: 'kcounter' }],
      bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  const put = async (name, wx, wy) => {
    await placeFromShed(page, name);
    await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
    await page.mouse.click(...(await screenAt(page, wx, wy)));
    await page.waitForTimeout(300);
    await page.click('#hsPlaceGo');
    await page.waitForTimeout(600);
  };
  const wallLine = (id) => page.evaluate((i) => window.__hs.geo.tightY(i, 3), id);
  await put('Bookcase', 700, 390);             // on the wall
  await put('Tall bookshelf', 820, 478);       // one row out: close still means the wall
  await put('Standing mirror', 960, 600);      // the middle of the room
  await put('Kitchen counter', 1060, 478);     // the kitchen line keeps the same two rows
  expect((await inRoom(page, 'bookcase')).y, 'a tap on the wall: on its wall line').toBe(await wallLine('bookcase'));
  expect((await inRoom(page, 'bookshelf')).y, 'a tap a row out: still on its wall line').toBe(await wallLine('bookshelf'));
  expect((await inRoom(page, 'kcounter')).y, 'the kitchen counter a row out: at the wall too').toBe(await wallLine('kcounter'));
  const m = await inRoom(page, 'floormirror');
  expect(m.y, 'the middle of the room: right where it was tapped').toBe(600);
  expect(m.y > await wallLine('floormirror'), 'not pulled to the wall').toBe(true);
  await page.screenshot({ path: SHOT + '18-wall-or-room.png' });
  expect(errs).toEqual([]);
});

// ↻ the families as data: each side knows the next and the turn comes back round; every side is the piece (one name, shelf,
// price and rung) and only the first is sold
test('the families: one piece, every side it is drawn from, one turn through them all', () => {
  const by = (id) => DECOR.find((d) => d.id === id);
  const fams = {};
  for (const d of DECOR.filter((x) => x.turn)) (fams[d.fam || d.id] = fams[d.fam || d.id] || []).push(d);
  expect(Object.keys(fams).sort()).toEqual(['arcade', 'bench', 'dinchair', 'fridge', 'telly']);
  for (const [base, L] of Object.entries(fams)) {
    const b = by(base);
    expect(b.fam, base + ' is its family’s first').toBeUndefined();
    const seen = [base];
    for (let id = b.turn; id !== base; id = by(id).turn) {
      expect(seen, base + ' turns through ' + id + ' once').not.toContain(id);
      seen.push(id);
    }
    expect(seen.sort(), base + ': the turn reaches every side').toEqual(L.map((d) => d.id).sort());
    for (const d of L) {
      expect([d.name, d.cat, d.price, d.stage], d.id + ' is the ' + base).toEqual([b.name, b.cat, b.price, b.stage]);
      expect(d.fb && d.fb.length, d.id + ' knows its empty edges').toBe(3);
      if (d.side) expect(['l', 'r', 'f'], d.id).toContain(d.side);
    }
  }
  // a turned fridge still opens, and the arcade cabinet facing the room stands against the wall like the fridge
  expect([by('fridgeside').alt, by('fridgeside2').alt]).toEqual([[53, 85], [53, 85]]);
  expect(by('arcade').tight).toEqual([10, 0, 26]);
});

// ↻ Trym, 28 Sep 2026: "its the same object, but you can rotate it in the build mode so you can put the things and objects
// that HAS a side view sprite, on the side-walls aswell. these also must stick to the wall … Its a bit bad user experience
// to have the same object just from different angles, buying them separate - it can easily also bloat the shop with
// duplicate objects". The shop sells each piece once; the ghost's ↻ steps through its sides; a side turned to a side wall
// stands with its back against it; a turned piece goes back into the shed as the piece.
test('in the house: one of each on the shelf, ↻ turns it, and a side turned to a side wall sticks to it', async ({ page }) => {
  test.setTimeout(150000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    // two fridges, a chair and an arcade cabinet, and a chair and a cabinet bought as sides before the turn existed
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], orders: [], inItems: {},
      shed: [{ id: 'fridge' }, { id: 'fridge' }, { id: 'dinchair' }, { id: 'dinchair2' }, { id: 'arcade' }, { id: 'pinball' }],
      bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);

  // ── the shop: each piece once, whatever the pack draws of it
  await page.evaluate(() => window.__hs.shop('order'));
  await page.waitForSelector('#hsShopList .hs-tile', { timeout: 8000 });
  const names = await page.locator('#hsShopList .hs-tile b').allTextContents();
  for (const n of ['The fridge', 'Dining chair', 'Arcade cabinet', 'The telly']) expect(names.filter((t) => t.startsWith(n)).length, n + ' on the shelf once').toBe(1);
  // ── the shed: a side bought before stacks with its piece
  await page.evaluate(() => window.__hs.shop('shed'));
  await page.waitForTimeout(700);
  for (const n of ['The fridge', 'Dining chair', 'Arcade cabinet']) {
    const rows = page.locator('#hsShopList .hs-tile, #hsShopList .hs-row', { hasText: n });
    expect(await rows.count(), n + ': one stack').toBe(1);
    await expect(rows.first(), n + ': both in it').toContainText(/×\s?2/);
  }
  await page.screenshot({ path: SHOT + '19-shed-stacks.png' });

  const R = await page.evaluate(() => window.__hs.geo.INTERIORS[3]), L = R.cols[1][2], Rw = R.cols[2][0];
  const turnTo = async (id) => {
    for (let i = 0; i < 4; i++) {
      await expect(page.locator('#hsPlaceTurn'), 'the ghost of a piece with sides offers the turn').toBeVisible();
      await page.click('#hsPlaceTurn');
      await page.waitForTimeout(150);
      if (await page.evaluate((i2) => !!document.querySelector('.hs-it--ghost[style*="/d-' + i2 + '."]'), id)) return;
    }
    throw new Error('never turned to ' + id);
  };
  const put = async (name, wx, wy, id) => {
    await placeFromShed(page, name);
    await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
    await settle(page);
    await page.mouse.click(...(await screenAt(page, wx, wy)));
    await page.waitForTimeout(300);
    if (id) await turnTo(id);
    await page.screenshot({ path: SHOT + '20-turn-' + (id || name) + '.png' });
    await page.click('#hsPlaceGo');
    await page.waitForTimeout(600);
  };
  // ── a fridge tapped two columns off the left wall, turned to face right: its back against the left wall
  await put('The fridge', 640, 560, 'fridgeside');
  const fl = await inRoom(page, 'fridgeside'), FL = DECOR.find((x) => x.id === 'fridgeside');
  expect(fl, 'the fridge stands turned').toBeTruthy();
  expect(fl.x - FL.w / 2 + FL.fb[0], 'what you see of it touches the left wall').toBe(L);
  // ── the other, near the right wall, turned to face left: its back against the right wall
  await put('The fridge', 1150, 600, 'fridgeside2');
  const fr = await inRoom(page, 'fridgeside2'), FR = DECOR.find((x) => x.id === 'fridgeside2');
  expect(fr.x + FR.w / 2 - FR.fb[1], 'against the right wall').toBe(Rw);
  // ── the arcade cabinet turned to its side at the right wall too, lower down
  await put('Arcade cabinet', 1150, 680, 'arcadeside');
  const ar = await inRoom(page, 'arcadeside'), AR = DECOR.find((x) => x.id === 'arcadeside');
  expect(ar.x + AR.w / 2 - AR.fb[1], 'the cabinet’s back on the right wall').toBe(Rw);
  // ── a chair turned in the middle of the room stays where it was tapped, its feet where they stood
  await put('Dining chair', 905, 600, 'dinchair2');
  const ch = await inRoom(page, 'dinchair2');
  expect([ch.x, ch.y], 'the middle of the room: right where it was tapped').toEqual([912, 600]);
  expect(await page.evaluate(() => window.__hs.inv().shed), 'every one of them came out of the shed').toEqual(['dinchair2', 'pinball']);
  await page.screenshot({ path: SHOT + '21-turned-room.png' });

  // ── a tap opens each turned fridge's door the way it faces: the left one's to the right, the right one's to the left
  const box = (id) => page.evaluate((i) => {
    const el = [...document.querySelectorAll('.hs-it--in')].find((e) => (e.style.backgroundImage || '').includes('/d-' + i + '.') || (e.style.backgroundImage || '').includes('/d-' + i + '-alt.'));
    // in world px: the camera follows the banana after a tap, so screen px drift
    const r = el.getBoundingClientRect(), wr = document.getElementById('hsWorld').getBoundingClientRect(), k = wr.width / window.__hs.signGeo().W;
    return { l: (r.left - wr.left) / k, r: (r.right - wr.left) / k, alt: el.style.backgroundImage.includes('-alt') };
  }, id);
  for (const [id, it, dx] of [['fridgeside', fl, 90], ['fridgeside2', fr, -90]]) {
    await page.evaluate(([x, y]) => window.__hs.warp(x, y + 60), [it.x + dx, it.y]);   // beside it, clear of the door
    await page.waitForTimeout(500);
    const b0 = await box(id), p = await drawn(page, id);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(250);
    const b1 = await box(id);
    expect(b1.alt, id + ' opens').toBe(true);
    expect(b1.r - b1.l, id + '’s door swings out').toBeGreaterThan((b0.r - b0.l) * 1.4);
    // its back stays on the wall: the left one's left edge, the right one's right edge
    if (id === 'fridgeside') expect(Math.abs(b1.l - b0.l), 'the door swings right, into the room').toBeLessThan(1);
    else expect(Math.abs(b1.r - b0.r), 'the door swings left, into the room').toBeLessThan(1);
    if (id === 'fridgeside2') await page.screenshot({ path: SHOT + '22-turned-fridge-open.png' });
    await page.waitForTimeout(2600);
    const b2 = await box(id);
    expect([b2.alt, Math.abs(b2.l - b0.l) < 1, Math.abs(b2.r - b0.r) < 1], id + ' shuts by itself, where it stood').toEqual([false, true, true]);
  }

  // ── 🔨 build mode turns a piece that is already standing: the fridge on the left wall turns to face the room, the same
  // piece (nothing new in the room), stepped off the wall onto the floor
  const n0 = (await page.evaluate(() => window.__hs.inv().inItems[3])).length;
  await page.click('#hsBuild');
  await page.waitForTimeout(700);
  const f0 = await drawn(page, 'fridgeside');
  await page.mouse.click(f0.x, f0.y);
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await turnTo('fridge');
  await expect(page.locator('#hsPlaceGo'), 'a good spot').toBeEnabled();
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const room = await page.evaluate(() => window.__hs.inv().inItems[3]);
  expect(room.length, 'the same piece, turned').toBe(n0);
  expect([room.some((x) => x.id === 'fridge'), room.some((x) => x.id === 'fridgeside')], 'facing the room now').toEqual([true, false]);
  // ── and a turned piece put back goes into the shed as the piece: the second cabinet, turned, then "not now"
  await page.click('#hsPlanDone');
  await page.waitForTimeout(900);
  await placeFromShed(page, 'Arcade cabinet');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await turnTo('arcadeback');
  await page.click('#hsPlaceNo');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__hs.inv().shed), 'back as the cabinet, the way the shop shows it').toEqual(['dinchair2', 'arcade']);
  expect(errs).toEqual([]);
});

// 📱 the confirm bar with the turn in it, on a small phone: three buttons on one line, inside the screen
test('the confirm bar holds ↻ turn on a 360-px phone', async ({ page }) => {
  test.setTimeout(90000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], orders: [], inItems: {},
      shed: [{ id: 'fridge' }, { id: 'bookcase' }], bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  await placeFromShed(page, 'The fridge');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await page.mouse.click(...(await floorAt(page, 0.4, 0.4)));   // a spot on open floor
  await page.waitForTimeout(300);
  await page.click('#hsPlaceTurn');
  await page.waitForTimeout(200);
  await expect(page.locator('#hsPlaceGo'), 'a good spot, turned').toBeEnabled();
  const bar = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    return { bar: r(document.getElementById('hsConfirm')), btns: ['hsPlaceGo', 'hsPlaceTurn', 'hsPlaceNo'].map((id) => r(document.getElementById(id))) };
  });
  expect(bar.bar.left >= 0 && bar.bar.right <= 360, 'the bar fits the screen: ' + Math.round(bar.bar.left) + '–' + Math.round(bar.bar.right)).toBe(true);
  expect(new Set(bar.btns.map((b) => Math.round(b.top))).size, 'one row').toBe(1);
  for (const b of bar.btns) expect(b.height, 'each label on one line').toBeLessThan(40);
  await page.screenshot({ path: SHOT + '23-phone-turn-bar.png' });
  // a piece with one side has no turn
  await page.click('#hsPlaceNo');
  await page.waitForTimeout(400);
  await placeFromShed(page, 'Bookcase');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await expect(page.locator('#hsPlaceTurn'), 'no turn for a piece the pack draws once').toBeHidden();
  expect(errs).toEqual([]);
});

// 🍳 Trym, 28 Sep 2026: "separate sinks, microwaves, coffee machine, blender, toaster FROM the kitchen counter - because i
// think theres more than one type of kitchen counter - so kitchen accessories can stand on different types of counters -
// but that demands a rule that kitchen accessories have a belonging to standing on counters".
test('the counters as data: six finishes, ten things that stand on them, the old counters with things on them off the shelf', () => {
  const by = (id) => DECOR.find((d) => d.id === id);
  const counters = DECOR.filter((d) => d.top && !d.retired), things = DECOR.filter((d) => d.on);
  expect(counters.map((d) => d.id)).toEqual(['ctrwhite', 'ctrgrey', 'ctrred', 'ctroak', 'ctrwalnut', 'ctrhoney']);
  for (const d of counters) {
    expect([d.cat, d.stage, d.w, d.h, d.top], d.id + ': two tiles at 2/3, things stand 27 px above its base').toEqual(['kitchen', 2, 64, 40, 27]);
    expect(d.tight, d.id + ' joins the kitchen line, its 2-px border merged').toEqual([0, 2]);
    expect(d.ship, d.id + ' comes by van').toBeGreaterThan(0);
  }
  expect(things.map((d) => d.id)).toEqual(['toaster', 'microwave', 'coffeemachine', 'blender', 'mixer', 'kettle', 'ricecooker', 'dishrack', 'sink', 'steelsink']);
  for (const d of things) {
    expect([d.cat, d.stage, d.surface], d.id).toEqual(['kitchen', 2, 'floor']);
    expect(d.w, d.id + ' fits on one counter').toBeLessThanOrEqual(60);
    expect(d.tight, d.id + ' is no part of the kitchen line').toBeUndefined();
  }
  expect([by('toaster').alt, by('coffeemachine').alt], 'the toast goes down, a cup comes').toEqual([[26, 36], [28, 38]]);
  // the counters with things baked on: off the shelf, still owned; the long wooden one still carries things
  for (const id of ['kcounter', 'coffeemk', 'stockcounter', 'sinkcounter', 'toastcounter', 'microcounter', 'espressobar']) expect(by(id).retired, id).toBe(1);
  expect(by('kcounter').top, 'things stand on the wooden counter too').toBe(30);
  expect(by('sinkcounter').name, 'not the new Kitchen sink').toBe('Sink counter');
});

test('in the house: counters in a row, a toaster and a sink stand on them, a counter carries what stands on it', async ({ page }) => {
  test.setTimeout(150000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], orders: [], inItems: {},
      shed: [{ id: 'toaster' }, { id: 'ctrwhite' }, { id: 'ctrwhite' }, { id: 'ctrred' }, { id: 'sink' }, { id: 'coffeemachine' }, { id: 'kettle' }],
      bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  const C = (id) => DECOR.find((x) => x.id === id);
  const room = () => page.evaluate(() => window.__hs.inv().inItems[3] || []);
  const box = (id) => page.evaluate((i) => {   // a piece as drawn, in world px
    const el = [...document.querySelectorAll('.hs-it--in')].find((e) => (e.style.backgroundImage || '').includes('/d-' + i + '.') || (e.style.backgroundImage || '').includes('/d-' + i + '-alt.'));
    if (!el) return null;
    const r = el.getBoundingClientRect(), wr = document.getElementById('hsWorld').getBoundingClientRect(), k = wr.width / window.__hs.signGeo().W;
    return { l: (r.left - wr.left) / k, r: (r.right - wr.left) / k, t: (r.top - wr.top) / k, b: (r.bottom - wr.top) / k, z: +el.style.zIndex, alt: el.style.backgroundImage.includes('-alt') };
  }, id);

  // ── the kitchen shelf: six counters and the things that stand on them; the counters with things baked on are gone
  await page.evaluate(() => window.__hs.shop('order'));
  await page.waitForSelector('#hsShopList .hs-tile', { timeout: 8000 });
  await page.locator('#hsShopCats button', { hasText: 'Kitchen' }).click();
  await page.waitForTimeout(400);
  const shelf = await page.locator('#hsShopList .hs-tile b').allTextContents();
  for (const d of DECOR.filter((x) => (x.top || x.on) && !x.retired)) expect(shelf.some((t) => t.startsWith(d.name)), d.name + ' on the shelf').toBe(true);
  for (const n of ['Toaster counter', 'Microwave counter', 'Espresso bar', 'Baking counter', 'Stocked counter', 'Sink counter', 'Kitchen counter']) expect(shelf.some((t) => t.startsWith(n)), n + ' is off the shelf').toBe(false);
  await page.locator('#hsShopList .hs-tile', { hasText: 'White counter' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + '28-kitchen-shelf.png' });
  await page.locator('#hsShopList .hs-tile', { hasText: 'Stand mixer' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + '29-kitchen-shelf-things.png' });
  await page.evaluate(() => window.__hs.shop('shed'));
  // ── no counter yet: the toaster will not come out of the shed
  await expect(page.locator('#hsToast.is-on'), 'the arrival line has had its say').toHaveCount(0, { timeout: 8000 });
  await placeFromShed(page, 'Toaster');
  await page.waitForTimeout(500);
  expect(await page.locator('#hsConfirm:not([hidden])').count(), 'no ghost comes up').toBe(0);
  await expect(page.getByText(HW.counterOnly).first(), 'the phone says why').toBeVisible();
  await page.screenshot({ path: SHOT + '24-no-counter.png' });

  // ── three counters along the back wall, each tap a little off the last one's side: one run, borders merged
  const put = async (name, wx, wy) => {
    await placeFromShed(page, name);
    await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
    await settle(page);
    await page.mouse.click(...(await screenAt(page, wx, wy)));
    await page.waitForTimeout(300);
    await page.click('#hsPlaceGo');
    await page.waitForTimeout(600);
  };
  await put('White counter', 700, 390);
  await put('White counter', 770, 390);
  await put('Red counter', 830, 390);
  const run = (await room()).filter((x) => C(x.id).top).sort((a, b) => a.x - b.x);
  expect(run.length, 'three counters').toBe(3);
  const line = await page.evaluate(() => window.__hs.geo.tightY('ctrwhite', 3));
  for (const c of run) expect(c.y, c.id + ' against the wall').toBe(line);
  for (let i = 1; i < 3; i++) expect(run[i].x - run[i - 1].x, 'butted, one border between them').toBe(64 - 2);

  // ── the toaster, from the shed onto the counter nearest the banana; a tap on the first counter's worktop puts it there
  await put('Toaster', run[0].x - 12, line - 30);
  const toaster = (await room()).find((x) => x.id === 'toaster');
  expect(toaster, 'the toaster is in').toBeTruthy();
  expect(toaster.y, 'on the counter’s line').toBe(line);
  expect(Math.abs(toaster.x - run[0].x) <= 32, 'over the first counter').toBe(true);
  const tb = await box('toaster'), cb = await box('ctrwhite');
  expect(Math.round(tb.b - (line - C('ctrwhite').top)), 'standing on its worktop, 27 px above the counter’s base').toBe(0);
  expect(tb.z, 'drawn in front of the counter').toBeGreaterThan(cb.z);
  // ── the sink on the second counter; the coffee machine, tapped right onto the toaster, stands beside it instead
  await put('Kitchen sink', run[1].x, line - 28);
  await put('Coffee machine', toaster.x, line - 30);
  const now = await room(), sink = now.find((x) => x.id === 'sink'), cm = now.find((x) => x.id === 'coffeemachine');
  expect([sink.y, cm.y], 'both on the counters’ line').toEqual([line, line]);
  expect(Math.abs(cm.x - toaster.x) >= (C('coffeemachine').w + C('toaster').w) / 2 - 2, 'beside the toaster, never on it').toBe(true);
  // ── the kettle, tapped on the open floor, finds no counter there: the ghost says no until a counter is tapped
  await placeFromShed(page, 'Kettle');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await settle(page);
  await page.mouse.click(...(await screenAt(page, 900, 560)));   // open floor, clear of the bar at the bottom
  await page.waitForTimeout(300);
  await expect(page.locator('#hsPlaceGo'), 'no counter under it').toBeDisabled();
  await settle(page);
  await page.mouse.click(...(await screenAt(page, run[2].x + 10, line - 30)));
  await page.waitForTimeout(300);
  await expect(page.locator('#hsPlaceGo'), 'on the red counter').toBeEnabled();
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  expect((await room()).find((x) => x.id === 'kettle').y, 'the kettle on the counter').toBe(line);
  await page.screenshot({ path: SHOT + '25-counters-and-things.png' });

  // ── a tap wakes the toaster: the toast goes down, and pops back up by itself
  await page.evaluate(([x, y]) => window.__hs.warp(x, y + 60), [toaster.x, line]);
  await page.waitForTimeout(500);
  await settle(page);
  const t1 = await box('toaster');
  await page.mouse.click(...(await screenAt(page, (t1.l + t1.r) / 2, (t1.t + t1.b) / 2)));
  await page.waitForTimeout(250);
  expect((await box('toaster')).alt, 'the toast goes down').toBe(true);
  await page.waitForTimeout(1800);
  expect((await box('toaster')).alt, 'and pops up').toBe(false);

  // ── 🔨 build mode: the first counter, lifted by its doors, goes to the middle of the room with its toaster and coffee machine
  await page.click('#hsBuild');
  await page.waitForTimeout(700);
  await settle(page);
  await page.mouse.click(...(await screenAt(page, run[0].x, line - 6)));
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await settle(page);
  await page.mouse.click(...(await screenAt(page, 760, 620)));
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + '26-counter-lifted.png' });
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  const after = await room(), moved = after.find((x) => x.id === 'ctrwhite' && x.y !== line);
  expect(moved, 'the counter stands in the room').toBeTruthy();
  for (const [id, was] of [['toaster', toaster], ['coffeemachine', cm]]) {
    const it = after.find((x) => x.id === id);
    expect([it.x - moved.x, it.y], id + ' rode along').toEqual([was.x - run[0].x, moved.y]);
  }
  await page.screenshot({ path: SHOT + '27-counter-moved.png' });
  // ── and the toaster alone, lifted off it (a tap on the toaster lifts the toaster), goes back onto the red counter
  await settle(page);
  const t2 = await box('toaster');
  await page.mouse.click(...(await screenAt(page, (t2.l + t2.r) / 2, (t2.t + t2.b) / 2)));
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  expect(await page.evaluate(() => !!document.querySelector('.hs-it--ghost[style*="/d-toaster."]')), 'the toaster is up, not its counter').toBe(true);
  await settle(page);
  await page.mouse.click(...(await screenAt(page, run[2].x - 16, line - 30)));
  await page.waitForTimeout(300);
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  expect((await room()).find((x) => x.id === 'toaster').y, 'back on the wall run').toBe(line);
  // ── 🧹 clear the moved counter: it goes to the shed with the coffee machine on it
  await page.click('#hsToolClear');
  await page.waitForTimeout(300);
  await settle(page);
  await page.mouse.click(...(await screenAt(page, moved.x, moved.y - 6)));
  await page.waitForTimeout(500);
  const end = await room(), shed = await page.evaluate(() => window.__hs.inv().shed);
  expect([end.some((x) => x.id === 'coffeemachine'), shed.includes('coffeemachine'), shed.includes('ctrwhite')], 'into the shed together').toEqual([false, true, true]);
  expect(errs).toEqual([]);
});

// 🍳 a house holds 50 on its floor and 10 on its counters (Trym, 28 Sep 2026: "yes go ahead with 50 + 10 (things on
// counters) - and 96 in the yard") — 60 in all, what a save keeps (worker-rave ROOM_ITEM_CAP)
test('a house holds fifty on the floor and ten things on its counters', async ({ page }) => {
  test.setTimeout(90000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('order-seeded')) return;
    sessionStorage.setItem('order-seeded', '1');
    // six counters along the wall and forty-four pots: fifty floor pieces; nine kettles on the first five counters
    const cx = [640, 702, 764, 826, 888, 950];
    const room = cx.map((x) => ({ id: 'ctrwhite', x, y: 450 }));
    for (let i = 0; i < 44; i++) room.push({ id: 'aloe', x: 630 + (i % 11) * 50, y: 540 + Math.floor(i / 11) * 60 });
    for (let i = 0; i < 9; i++) room.push({ id: 'kettle', x: cx[Math.floor(i / 2)] + (i % 2 ? 14 : -14), y: 450 });
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], orders: [],
      inItems: { 3: room }, shed: [{ id: 'aloe' }, { id: 'blender' }, { id: 'dishrack' }],
      bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 } }));
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(800);
  await expect(page.locator('#hsToast.is-on'), 'the arrival line has had its say').toHaveCount(0, { timeout: 8000 });
  const room = () => page.evaluate(() => window.__hs.inv().inItems[3] || []);
  // the floor is full: another pot waits in the shed
  await placeFromShed(page, 'Aloe in a pot');
  await page.waitForTimeout(500);
  expect(await page.locator('#hsConfirm:not([hidden])').count(), 'no room for a pot').toBe(0);
  await expect(page.getByText('this room is full (50 spots)').first()).toBeVisible();
  // …but a tenth thing goes on the sixth counter
  await placeFromShed(page, 'Blender');
  await page.waitForSelector('#hsConfirm:not([hidden])', { timeout: 6000 });
  await settle(page);
  await page.mouse.click(...(await screenAt(page, 950, 420)));
  await page.waitForTimeout(300);
  await expect(page.locator('#hsPlaceGo'), 'on the sixth counter').toBeEnabled();
  await page.click('#hsPlaceGo');
  await page.waitForTimeout(600);
  expect((await room()).length, 'fifty on the floor, ten on the counters').toBe(60);
  // and the eleventh thing waits: the counters are full
  await placeFromShed(page, 'Dish rack');
  await page.waitForTimeout(500);
  expect(await page.locator('#hsConfirm:not([hidden])').count(), 'no eleventh thing').toBe(0);
  await expect(page.getByText(HW.countersFull.replace('{n}', '10')).first()).toBeVisible();
  expect(errs).toEqual([]);
});
