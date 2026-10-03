// 🧪 THE SHIMMER BENCH (3 Oct 2026): ?shimmer in any area plays Shimmer's look on your banana — the blue pill, a Shimmer
// level, level 99, the Star Map, a falling star, and every perk of the area's constellation built so far — so Trym can judge
// how they feel where they would live. This walk keeps it honest: every button plays with no page error, NOTHING ON THE PASS
// MOVES (it is a preview), the bench never loads without its flag, and a tap on the Star Map stays in the map (it reached the
// park under the card, and opened a flower spot).
import { test, expect } from '@playwright/test';
import W from '../src/data/copy/shimmer.json' with { type: 'json' };

const NOISE = /googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/;
const AREAS = [
  { name: 'town', url: '/town/?towntest&shimmer', perks: 0 },
  { name: 'park', url: '/park/?shimmer', perks: 11 },
  { name: 'beach', url: '/beach/?shimmer', perks: 0 },
  { name: 'homestead', url: '/homestead/?hstest=rich&shimmer', perks: 0 },
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
    expect(n, 'Shimmer’s six, and the area’s perks built so far').toBe(6 + a.perks);
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

test('park: the Star Map places a star, the sixteenth lights its perk, and a tap on the map never reaches the park', async ({ page }) => {
  const errs = await open(page, '/park/?shimmer');
  await page.waitForSelector('.shb', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('.shb button', { hasText: 'Star Map' }).evaluate((el) => el.click());
  await page.waitForSelector('.sm-card', { timeout: 5000 });
  await expect(page.locator('.sm-top span')).toHaveText(W.map.toPlace.replace('{n}', '12'));
  // 💬 a perk is said by what it does (Trym: "no user understands what a skill / perc is by just reading a perk-name"): the
  // next one under the constellation carries its kind in a player's words and its line, and the list has every one
  const tidy = W.perks.find((p) => p.key === 'tidyplots');
  await expect(page.locator('.sm-next .sm-cap')).toHaveText(W.map.nextAt.replace('{at}', '16'));
  await expect(page.locator('.sm-next .sm-pl .ln')).toHaveText(tidy.line);
  await expect(page.locator('.sm-next .sm-pl .nm em')).toHaveText(W.kinds.comfort);
  await page.locator('.sm-next .sm-btn', { hasText: W.map.all }).evaluate((el) => el.click());
  await expect(page.locator('.sm-li'), 'ten perk stars in the Watering Can').toHaveCount(10);
  expect(await page.locator('.sm-li .sm-pl .ln').evaluateAll((ns) => ns.filter((n) => n.textContent.trim().length > 10).length), 'every perk with its line, the choice\u2019s two included').toBe(11);
  await expect(page.locator('.sm-li.is-next .nm').first()).toContainText(tidy.name);
  await page.screenshot({ path: 'test-results/shimmer-map-list.png' });
  await page.locator('.sm-lhead .sm-btn').evaluate((el) => el.click());
  await expect(page.locator('.sm-skywrap')).toBeVisible();
  await page.locator('.sm-go').evaluate((el) => el.click());
  const perk = W.perks.find((p) => p.key === 'tidyplots');
  await expect(page.locator('.sm-perk .n'), 'the Watering Can’s 16th star: Tidy plots').toHaveText(perk.name, { timeout: 4000 });
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
