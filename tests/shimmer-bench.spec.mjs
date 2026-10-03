// 🧪 THE SHIMMER BENCH (3 Oct 2026): ?shimmer in any area plays Shimmer's look on your banana — the blue pill, a Shimmer
// level, level 99, the Star Map, a falling star, and every perk of the area's constellation built so far — so Trym can judge
// how they feel where they would live. This walk keeps it honest: every button plays with no page error, NOTHING ON THE PASS
// MOVES (it is a preview), the bench never loads without its flag, and a tap on the Star Map stays in the map (it reached the
// park under the card, and opened a flower spot).
import { test, expect } from '@playwright/test';
import W from '../src/data/copy/shimmer.json' with { type: 'json' };
import { LADDER, ORDER, KIND } from '../src/data/shimmer.js';
const PERKS = [...W.constellations.flatMap((c) => c.perks), W.north];
const perkOf = (k) => PERKS.find((p) => p.key === k);

const NOISE = /googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/;
// the perks the bench plays: the area's own sign's (the Sunflower 5, the Hen 11, the Vinyl 4) and the Banana's 7, everywhere
const AREAS = [
  { name: 'town', url: '/town/?towntest&shimmer', perks: 7 },
  { name: 'park', url: '/park/?shimmer', perks: 12 },
  { name: 'beach', url: '/beach/?shimmer', perks: 7 },
  { name: 'homestead', url: '/homestead/?hstest=rich&shimmer', perks: 18 },
  { name: 'rave', url: '/rave/?shimmer', perks: 11 },
];
async function open(page, url) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route(NOISE, (r) => r.abort());
  await page.route(/workers\.dev/, (r) => r.abort());
  // never a live room; the rave's floor takes you only when its room names you, so it is answered here
  await page.routeWebSocket(/workers\.dev/, (ws) => { ws.onMessage((m) => { let d = null; try { d = JSON.parse(String(m)); } catch (e) { return; } if (d && d.t === 'hi') ws.send(JSON.stringify({ t: 'roster', you: 'qa-me', all: [{ id: 'qa-me', outfit: d.outfit || {}, name: '', joined: Date.now(), lvl: 52 }] })); }); });
  await page.addInitScript(() => { try { localStorage.setItem('cookie-consent-v1', 'n'); localStorage.setItem('tt-internal', '1'); localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); localStorage.setItem('rv-tour-v1', '1'); localStorage.setItem('pass-v1', JSON.stringify({ created: Date.now() - 10 * 864e5, patches: {}, stats: { rep: 120000, coins_earned: 40 }, days: [new Date().toISOString().slice(0, 10)] })); } catch (e) {} });
  // every write to the device's storage, kept if the bench's own code made it: a preview writes nothing at all (the rave
  // itself pays XP while you stand on its floor, so "the pass did not change" is not the test; "the bench wrote nothing" is)
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    window.__benchWrites = [];
    Storage.prototype.setItem = function (k, v) { if (/shimmer-bench/.test(new Error().stack || '')) window.__benchWrites.push(k); return set.call(this, k, v); };
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return errs;
}
const benchWrites = (page) => page.evaluate(() => window.__benchWrites);

for (const a of AREAS) {
  test(`${a.name}: every button on the bench plays, and the bench writes nothing`, async ({ page }) => {
    test.setTimeout(120000);
    const errs = await open(page, a.url);
    await page.waitForSelector('.shb', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const buttons = page.locator('.shb-body button:not([disabled])');
    const n = await buttons.count();
    expect(n, 'Shimmer’s seven (Everything on among them), the area’s sign’s and the Banana’s').toBe(7 + a.perks);
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i), label = (await b.textContent()).trim();
      if (label === 'Star Map') continue;   // its own walk below
      await b.evaluate((el) => el.click());
      await page.waitForTimeout(450);
      if (await b.evaluate((el) => el.classList.contains('is-on'))) { await page.waitForTimeout(700); await b.evaluate((el) => el.click()); }
    }
    await page.waitForTimeout(2500);
    expect(await benchWrites(page), 'a preview: the bench wrote nothing to the pass or the device').toEqual([]);
    expect(errs).toEqual([]);
  });
}

// 🔧 THE PERKS ARE THE GAME'S OWN LEVERS, AND SAY WHERE (Trym, 4 Oct 2026: "more colors where? on what? a hammer? you need to be
// extremely clear in your copy"). Every perk on the ladder has its words in its own sign, every word has a star, and every
// line opens by saying where it works (the copy gate holds the words; this holds the ladder to them).
test('every perk on the ladder has its words in its own sign, with a kind, and none is left over', () => {
  expect(W.constellations.map((c) => c.key), 'the copy’s signs, in the map’s order').toEqual(ORDER);
  for (const c of W.constellations) expect(c.perks.map((p) => p.key), c.name + ': its words follow its ladder').toEqual(LADDER[c.key].steps.flatMap((st) => st.slice(1)));
  for (const p of PERKS) expect(KIND[p.key], p.key + ' has a kind').toBeTruthy();
  expect(Object.keys(KIND).sort(), 'no kind for a perk that is gone').toEqual(PERKS.map((p) => p.key).sort());
  for (const k of new Set(Object.values(KIND))) expect(W.kinds[k], 'the kind ' + k + ' has its words').toBeTruthy();
});

test('park: the Star Map places a star, the sixteenth lights its perk, and a tap on the map never reaches the park', async ({ page }) => {
  const errs = await open(page, '/park/?shimmer');
  await page.waitForSelector('.shb', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('.shb button', { hasText: 'Star Map' }).evaluate((el) => el.click());
  await page.waitForSelector('.sm-card', { timeout: 5000 });
  await expect(page.locator('.sm-top span')).toHaveText(W.map.toPlace.replace('{n}', '12'));
  // 💬 a perk is said by what it does (Trym: "no user understands what a skill / perc is by just reading a perk-name"): the
  // next one under the constellation carries its kind in a player's words and its line, and the list has every one
  const birds = perkOf('rarebirds');
  // 💬 ONE PERK SPELLED OUT AT A TIME (Trym, 4 Oct 2026: "its a lot of text … easy to miss other text, like 'Next at star 12'"):
  // the next perk is a count and one row, its name and kind; a tap opens what it does
  await expect(page.locator('.sm-next .sm-cap')).toHaveText(W.map.nextOne);
  await expect(page.locator('.sm-next .sm-pl .nm em')).toHaveText(W.kinds.lucky);
  await expect(page.locator('.sm-next .sm-pl .ln'), 'what it does waits for a tap').toBeHidden();
  await page.locator('.sm-next .sm-pl').evaluate((el) => el.click());
  await expect(page.locator('.sm-next .sm-pl .ln')).toHaveText(birds.line);
  await expect(page.locator('.sm-next .sm-pl .ln')).toBeVisible();
  // and under the sign's name, what every star in it gives (the stars between two perks too)
  await expect(page.locator('.sm-row .t span')).toHaveText(W.constellations[0].each);
  await page.locator('.sm-next .sm-btn', { hasText: W.map.all }).evaluate((el) => el.click());
  await expect(page.locator('.sm-li'), 'ten perk stars in the Sunflower').toHaveCount(10);
  expect(await page.locator('.sm-li .sm-pl .ln').evaluateAll((ns) => ns.filter((n) => n.textContent.trim().length > 10).length), 'every perk with its line, the choice\u2019s two included').toBe(11);
  await expect(page.locator('.sm-li.is-next .nm').first()).toContainText(birds.name);
  await page.screenshot({ path: 'test-results/shimmer-map-list.png' });
  await page.locator('.sm-lhead .sm-btn').evaluate((el) => el.click());
  await expect(page.locator('.sm-skywrap')).toBeVisible();
  await page.locator('.sm-go').evaluate((el) => el.click());
  const perk = perkOf('rarebirds');
  await expect(page.locator('.sm-perk .sm-cap'), 'the one perk spelled out: the new one').toHaveText(W.map.newPerk, { timeout: 4000 });
  await expect(page.locator('.sm-perk .n'), 'the Sunflower’s 16th star: Rare birds').toHaveText(perk.name, { timeout: 4000 });
  await expect(page.locator('.sm-next .sm-pl.is-open'), 'and the next one stays a row').toHaveCount(0);
  await expect(page.locator('.sm-perk .l')).toHaveText(perk.line);
  await expect(page.locator('.sm-top span')).toHaveText(W.map.toPlace.replace('{n}', '11'));
  // the whole card on a phone's view: the sky and its button, no scroll inside it
  expect(await page.evaluate(() => { const c = document.querySelector('.sm-card'); return c.scrollHeight <= c.clientHeight + 1; }), 'the map fits the view').toBe(true);
  await page.screenshot({ path: 'test-results/shimmer-map-perk.png' });
  // a real tap on the map's close: the park under it must not hear it (it opened a flower spot)
  const x = await page.locator('.sm-x').boundingBox();
  await page.mouse.click(x.x + x.width / 2, x.y + x.height / 2);
  await page.waitForTimeout(600);
  expect(await page.locator('.sm-card').count(), 'closed').toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll('.pk-panel:not([hidden]), .pk-sheet:not([hidden])')].filter((e) => e.getClientRects().length).length), 'and nothing of the park opened under it').toBe(0);
  expect(errs).toEqual([]);
});

// 🐔 THE HEN'S PREVIEWS ON A REAL YARD (4 Oct 2026, Trym: "build the previews for the Hen next"): three hens, a kid goat, a
// woolly sheep, the dog and the cat, a trough, and a carrot in the soil. Every Hen perk plays where it would live: two hearts
// off the nearest animal, four more goods by the trough in starlight, and the pet at your heels that keeps up when you walk.
// No page error, and the bench writes nothing (the yard on this device is the walk's own).
const today = () => Math.floor(Date.now() / 86400000);
const HEN = (i) => ({ sp: 'hen', b: 0, pd: 0, name: '', wd: 0, id: 100100 + i, ad: today() - 10, gs: 0, sd: 11 + i });
const YARD_ANIMALS = [HEN(0), HEN(1), HEN(2),
  { sp: 'goat', b: 0, pd: 0, name: '', wd: 0, id: 300300, ad: today() - 1, gs: 0, gd: 1, sd: 7 },
  { sp: 'sheep', b: 0, pd: 0, name: '', wd: 3, id: 400400, ad: today() - 20, gs: 0, sd: 9 },
  { sp: 'dog', b: 0, pd: 0, name: '', wd: 0, id: 200200, ad: today() - 5, gs: 0, sd: 5 },
  { sp: 'cat', b: 0, pd: 0, name: '', wd: 0, id: 424242, ad: today(), gs: 0, sd: 94 }];
async function openYard(page) {
  const errs = await open(page, 'about:blank');
  await page.addInitScript((an) => {
    if (sessionStorage.getItem('hen-seeded')) return;
    sessionStorage.setItem('hen-seeded', '1');
    localStorage.setItem('bw-social-v1', JSON.stringify({ g: { none: 1 } }));
    const fence = [];
    for (let i = 9; i <= 25; i++) { fence.push({ i, j: 7 }); if (i !== 23 && i !== 24) fence.push({ i, j: 15 }); }
    for (let j = 8; j <= 14; j++) { fence.push({ i: 9, j }); fence.push({ i: 25, j }); }
    const day = new Date().toISOString().slice(0, 10);
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [{ id: 'trough', x: 700, y: 540 }], shed: [], orders: [],
      inItems: {}, bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 }, fence,
      soil: [{ i: 16, j: 12, crop: 'carrot', waters: 1, last: '', planted: day }, { i: 17, j: 12 }],
      animals: an, animalsV: 3, hens: 3 }));
  }, YARD_ANIMALS);
  await page.route('**/yards/echoes*', (r) => r.fulfill({ contentType: 'application/json', body: '{"echoes":[]}' }));
  await page.goto('/homestead/?hstest=rich&shimmer', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.wx && document.querySelector('.shb'), null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.wx('clear'));
  // stand by the trough, where the flock and the crop are in view
  await page.evaluate(() => { window.__hs.tgt.x = 700; window.__hs.tgt.y = 600; });
  await page.waitForTimeout(2500);
  return errs;
}
const henBtn = (page, name) => page.locator('.shb-row button', { hasText: name }).first();

test('homestead: every Hen perk plays on a real yard — two hearts, the extra goods, the pet at your heels', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await openYard(page);
  expect(await page.evaluate(() => document.querySelectorAll('.hs-world .hs-hen').length), 'the flock is out: three hens, the kid, the sheep, the dog, the cat').toBe(7);
  const hen = W.constellations.find((c) => c.key === 'hen');
  await expect(page.locator('.shb-h', { hasText: hen.name })).toBeVisible();
  for (const p of hen.perks) await expect(henBtn(page, p.name), p.name + ' plays').toBeEnabled();
  // Double hearts: the hug's heart and a second one, in starlight
  await henBtn(page, perkOf('dblhearts').name).evaluate((el) => el.click());
  await expect.poll(() => page.locator('.shb-heart').count(), { timeout: 2000 }).toBe(2);
  // Goods wait for you: four by the trough, then four more in starlight (two more days of them)
  await henBtn(page, perkOf('goodswait').name).evaluate((el) => el.click());
  await expect.poll(() => page.locator('.shb-good.is-star').count(), { timeout: 3000 }).toBe(4);
  expect(await page.locator('.shb-good').count()).toBe(8);
  // the top star: the pet comes along, and keeps up when you walk away
  await henBtn(page, perkOf('hencap').name).evaluate((el) => el.click());
  await expect(page.locator('.shb-pet')).toHaveCount(1);
  const gap = () => page.evaluate(() => { const p = document.querySelector('.shb-pet').getBoundingClientRect(), m = document.querySelector('#hsMe canvas').getBoundingClientRect(); return Math.hypot(p.left + p.width / 2 - (m.left + m.width / 2), p.bottom - m.bottom); });
  await page.evaluate(() => { window.__hs.tgt.x = 980; window.__hs.tgt.y = 640; });
  await page.waitForTimeout(3500);
  expect(await gap(), 'at your heels after the walk, a step behind').toBeLessThan(120);
  await page.screenshot({ path: 'test-results/shimmer-hen-pet.png' });
  await henBtn(page, perkOf('hencap').name).evaluate((el) => el.click());
  await expect(page.locator('.shb-pet')).toHaveCount(0);
  // and every other Hen perk plays without a fault
  for (const p of hen.perks) {
    if (['dblhearts', 'goodswait', 'hencap'].includes(p.key)) continue;   // played above
    await henBtn(page, p.name).evaluate((el) => el.click());
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(6500);
  expect(await benchWrites(page), 'a preview: the bench wrote nothing').toEqual([]);
  expect(errs).toEqual([]);
});

// 🤲 LONG REACH IS REAL (Trym, 4 Oct 2026: "Long reach doesnt work on trash pickup or taking out ghosts, or other regular range
// based things"). With it switched on the bench, every walk-over pickup reaches half again as far: the morning's eggs a step
// out of reach stay put without it, and come in with it.
test('homestead: Long reach on the bench really reaches: an egg a step away stays put, then comes in', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await openYard(page);
  await page.evaluate(() => window.__hs.morning(1));
  await page.waitForTimeout(800);
  const eggs = () => page.evaluate(() => window.__hs.farm().eggsOnGround);
  const laid = await eggs();
  expect(laid, 'the morning laid the hens’ eggs by the trough').toBeGreaterThan(0);
  // stand 50 px below the first row of eggs (they lie 12 under the trough at 700,540, 30 apart from 656): past 34, inside 51
  await page.evaluate(() => { const h = window.__hs; h.pos.x = h.tgt.x = 701; h.pos.y = h.tgt.y = 600; });
  await page.waitForTimeout(1500);
  expect(await eggs(), 'out of the usual reach: nothing comes in').toBe(laid);
  await page.locator('.shb-row button', { hasText: perkOf('reach').name }).first().evaluate((el) => el.click());
  await expect.poll(eggs, { timeout: 4000 }).toBeLessThan(laid);
  await page.locator('.shb-row button', { hasText: perkOf('reach').name }).first().evaluate((el) => el.click());   // off again
  expect(await page.evaluate(() => !!(window.__perks && window.__perks.reach)), 'switched off, it is gone').toBe(false);
  expect(errs).toEqual([]);
});

test('without ?shimmer there is no bench, and its chunk is never fetched', async ({ page }) => {
  const asked = [];
  page.on('request', (r) => { if (/shimmer-bench/.test(r.url())) asked.push(r.url()); });
  const errs = await open(page, '/park/');
  await page.waitForFunction(() => !!document.querySelector('.wh'), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  expect(await page.locator('.shb').count()).toBe(0);
  expect(asked, 'no player downloads the bench').toEqual([]);
  expect(errs).toEqual([]);
});

// ⭐ THE LOOP, WHOLE (Trym, on the first bench: "wheres the Shimmer XP progression? you want ongoing XP points for Shimmer, not
// a handful of stars you collect here and there?"). After 99 XP keeps flowing into the blue bar; a full bar is the next Shimmer
// level, and every level is one more star to place. The bench starts at Shimmer 38 with 1 400 of its 1 860.
test('park: XP after 99 flows into the blue bar, and every Shimmer level is one more star to place', async ({ page }) => {
  const errs = await open(page, '/park/?shimmer');
  await page.waitForSelector('.shb', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('.shb button', { hasText: 'Earn XP' }).evaluate((el) => el.click());
  await expect(page.locator('.sh-lvln b'), '1 400 + 900 crosses 1 860: Shimmer 39').toHaveText('39', { timeout: 4000 });
  expect(await page.evaluate(() => document.querySelector('.wh__lvl').classList.contains('sh-pill')), 'the pill is blue').toBe(true);
  expect(await page.evaluate(() => { const i = document.querySelector('.sh-bar i'); return i && getComputedStyle(i.parentNode).display !== 'none'; }), 'with its own Shimmer bar').toBe(true);
  await page.locator('.shb button', { hasText: 'Star Map' }).evaluate((el) => el.click());
  await page.waitForSelector('.sm-card', { timeout: 5000 });
  await expect(page.locator('.sm-top span'), 'the level just earned is a star waiting').toHaveText(W.map.toPlace.replace('{n}', '13'));
  await expect(page.locator('.sm-prog b')).toHaveText(W.map.level.replace('{n}', '39'));
  // Shimmer 40 costs 150 + 45 × 39 = 1 905, and 440 of it is already in the bar
  await expect(page.locator('.sm-prog > span:last-child')).toHaveText(W.map.nextStar.replace('{xp}', '1,465'));
  await page.screenshot({ path: 'test-results/shimmer-loop-map.png' });
  expect(errs).toEqual([]);
});
