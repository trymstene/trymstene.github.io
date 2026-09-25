// 🎡📈 THE MARKET, WALKED (23 Sep 2026): the Wheel of Peel and the Exchange are real.
//
// The pass worker rolls, charges and pays (worker-pass/test/market.test.mjs proves that half in-process); this walk
// proves the other half on the built site, with the worker's answers stubbed: the wheel turns to the wedge the
// SERVER names and the card says what it paid, a prize lands in the pocket, the square's pot news is said, a sale
// takes the goods out of the farm on this device and steps its stamp forward, and a lure won here arms itself at
// the pier. Every line is the copy file's (src/data/copy/town-market.json, beach-toasts.json).
import { test, expect } from '@playwright/test';
import MARKET from '../src/data/copy/town-market.json' with { type: 'json' };
import BEACH from '../src/data/copy/beach-toasts.json' with { type: 'json' };

const W = MARKET.wheel, X = MARKET.exchange;
const fill = (t, v) => String(t).replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
const text = (page, sel) => page.evaluate((s) => ((document.querySelector(s) || {}).textContent || '').trim(), sel);
const json = (o) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const LINK = () => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} };

async function town(page, init) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(LINK);
  if (init) await page.addInitScript(init);
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
  await page.waitForTimeout(400);
  return errs;
}
// the wheel's worker: `view` answers how the wheel stands, a spin answers `spin`
function wheelWorker(page, spin, view) {
  const calls = [];
  page.route('**/town/wheel', (r) => {
    const b = JSON.parse(r.request().postData() || '{}');
    calls.push(b);
    if (b.view) return r.fulfill(json({ ok: true, pot: 123, next: 'free', left: 30, cost: 3, wallet: { bal: 40, seq: 9 }, seen: [], slots: {}, ...(view || {}) }));
    return r.fulfill(json(spin));
  });
  return calls;
}

test('the wheel turns to the wedge the server rolled, and the card says what it paid', async ({ page }) => {
  const calls = wheelWorker(page, { ok: true, i: 3, id: 'c20', kind: 'free', coins: 20, item: '', full: false, pot: 123, next: 'paid', left: 30, wallet: { bal: 60, seq: 10 }, seen: [], slots: { coins_earned: { wheel: 20 } } });
  const errs = await town(page);
  await page.evaluate(() => window.__town.open('wheel'));
  await page.waitForFunction(() => /\d/.test((document.getElementById('twPot') || {}).textContent || ''), null, { timeout: 10000 });
  expect(await text(page, '#twPot'), 'the pot, as the server holds it').toBe(fill(W.pot, { n: 123 }));
  expect(await text(page, '#twSpin .tw-cta__verb'), 'today’s spin is free').toBe(W.free);
  await page.locator('#twSpin').click();
  await page.waitForFunction(() => /\S/.test((document.getElementById('twSpinRes') || {}).textContent || ''), null, { timeout: 8000 });
  expect(await text(page, '#twSpinRes')).toBe(fill(W.won.coins, { n: 20 }));
  expect(await text(page, '#twSpin .tw-cta__verb'), 'the next one costs').toBe(W.paid);
  // the pin points into the SERVER's wedge (the 20 coins, the fourth) — somewhere in it, not always dead centre
  const ang = await page.evaluate(() => parseFloat(((document.getElementById('twWheel').style.transform || '').match(/rotate\(([-\d.]+)deg\)/) || [])[1]));
  const per = 360 / 8, under = (((360 - ang) % 360) + 360) % 360;
  expect(under, 'the SERVER’s wedge (the 20 coins) is under the pin').toBeGreaterThan(3 * per);
  expect(under, 'the SERVER’s wedge (the 20 coins) is under the pin').toBeLessThan(4 * per);
  const spins = calls.filter((c) => !c.view);
  expect(spins.length, 'one spin asked').toBe(1);
  expect(spins[0].n, 'with a nonce, so a lost answer can be asked for again').toMatch(/^[a-z0-9]{6,24}$/);
  // the coins are the purse's as they land in it (a moment after the line), and the wallet is the answer's
  await page.waitForFunction(() => ((JSON.parse(localStorage.getItem('pass-wallet-v1') || 'null') || {}).bal) === 60, null, { timeout: 4000 });
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('pass-wallet-v1') || 'null'));
  expect(wallet && wallet.bal, 'the wallet the answer carried is the one the HUD reads').toBe(60);
  await page.screenshot({ path: 'test-results/town-market/wheel.png' });
  expect(errs).toEqual([]);
});

// 🌀 THE SPIN FEELS LIKE A SPIN (25 Sep 2026). Trym: "i click the button - it takes 3-4 seconds before anything happens …
// then if i've won i see my banana coins increase before the wheel has given me the result … i get half of the answers on
// my spin by just watching my banana coins in my HUD … if im winning something there should be a bit more 'wow'".
// A slow server (two seconds here), and the wheel must already be turning; the HUD's purse must not move until the line
// says what was won; a win lights its wedge and flies its coins; a peel is only its line; a failed spin says nothing a
// wedge could — it stops on a line between two.
function slowWheel(page, spin, ms) {
  page.route('**/town/wheel', async (r) => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.view) return r.fulfill(json({ ok: true, pot: 123, next: 'free', left: 30, cost: 3, wallet: { bal: 40, seq: 9 }, seen: [], slots: {} }));
    await new Promise((res) => setTimeout(res, ms));
    return r.fulfill(json(spin));
  });
}
const hudCoins = (page) => page.evaluate(() => ((document.querySelector('.wh__coins b') || {}).textContent || '').trim());
const wheelAngle = (page) => page.evaluate(() => parseFloat(((document.getElementById('twWheel').style.transform || '').match(/rotate\(([-\d.]+)deg\)/) || [0, 0])[1]));

test('the wheel turns the moment you tap, and the purse moves only when it has stopped', async ({ page }) => {
  slowWheel(page, { ok: true, i: 3, id: 'c20', kind: 'free', coins: 20, item: '', full: false, pot: 123, next: 'paid', left: 30, wallet: { bal: 60, seq: 10 }, seen: [], slots: { coins_earned: { wheel: 20 } } }, 2000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.open('wheel'));
  await page.waitForFunction(() => /\d/.test((document.getElementById('twPot') || {}).textContent || ''), null, { timeout: 10000 });
  await page.waitForFunction(() => ((document.querySelector('.wh__coins b') || {}).textContent || '').trim() === '40', null, { timeout: 5000 });
  const a0 = await wheelAngle(page);
  await page.locator('#twSpin').click();
  await page.waitForTimeout(300);
  const seam = () => page.evaluate(async () => { const s = await window.__town.market(); return { turning: s.turning(), spinning: s.spinning() }; });
  expect((await seam()).turning, 'turning within a third of a second, with the server still thinking').toBe(true);
  expect(await wheelAngle(page) - a0, 'and it has already gone a good way round').toBeGreaterThan(30);
  // every look at the purse while it turns: still the old number, and no line yet
  const seen = [];
  for (let k = 0; k < 40; k++) {
    const res = await page.evaluate(() => ((document.getElementById('twSpinRes') || {}).textContent || '').trim());
    if (res) break;
    seen.push(await hudCoins(page));
    await page.waitForTimeout(120);
  }
  expect(seen.length, 'the wheel turned for a while before it said anything').toBeGreaterThan(10);
  expect([...new Set(seen)], 'the HUD kept the old purse the whole time the wheel turned').toEqual(['40']);
  expect(await page.evaluate(() => ((document.getElementById('twSpinRes') || {}).textContent || '').trim())).toBe(fill(W.won.coins, { n: 20 }));
  expect((await seam()).turning, 'and it said so only once it had stopped').toBe(false);
  await page.waitForFunction(() => ((document.querySelector('.wh__coins b') || {}).textContent || '').trim() === '60', null, { timeout: 3000 });
  expect(errs).toEqual([]);
});

test('a win is a moment: the wedge lights, the coins fly to the purse — and a peel is only its line', async ({ page }) => {
  let spin = { ok: true, i: 3, id: 'c20', kind: 'free', coins: 20, item: '', full: false, pot: 123, next: 'paid', left: 30, wallet: { bal: 60, seq: 10 }, seen: [], slots: { coins_earned: { wheel: 20 } } };
  page.route('**/town/wheel', (r) => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.view) return r.fulfill(json({ ok: true, pot: 123, next: 'free', left: 30, cost: 3, wallet: { bal: 40, seq: 9 }, seen: [], slots: {} }));
    return r.fulfill(json(spin));
  });
  const errs = await town(page);
  await page.evaluate(() => window.__town.open('wheel'));
  await page.waitForFunction(() => /\d/.test((document.getElementById('twPot') || {}).textContent || ''), null, { timeout: 10000 });
  await page.locator('#twSpin').click();
  await page.waitForFunction(() => /\S/.test((document.getElementById('twSpinRes') || {}).textContent || ''), null, { timeout: 8000 });
  const won = await page.evaluate(async () => ({ lit: (await window.__town.market()).lit(), glow: document.getElementById('twWheelWrap').classList.contains('is-win'),
    pop: document.getElementById('twSpinRes').classList.contains('is-pop'), coins: document.querySelectorAll('.tw-fly--coin').length,
    purseUp: document.querySelector('.wh--overlay').classList.contains('is-lit') }));
  expect(won.lit, 'the twenty-coin wedge is lit').toBe(3);
  expect(won.glow, 'the rim glows').toBe(true);
  expect(won.pop, 'the line pops').toBe(true);
  expect(won.coins, 'a handful of coins is in the air').toBeGreaterThan(8);
  expect(won.purseUp, 'the purse rose out of the card’s shade to catch them').toBe(true);
  await page.screenshot({ path: 'test-results/town-market/wheel-win.png' });
  await page.waitForFunction(() => !document.querySelector('.tw-fly'), null, { timeout: 4000 });
  // …and the next spin, a peel: its line, nothing more
  spin = { ok: true, i: 2, id: 'peel', kind: 'paid', coins: 0, item: '', full: false, pot: 124, next: 'paid', left: 29, wallet: { bal: 57, seq: 11 }, seen: [], slots: {} };
  await page.locator('#twSpin').click();
  await page.waitForFunction(() => ((document.getElementById('twSpinRes') || {}).textContent || '').trim() === '', null, { timeout: 3000 }).catch(() => {});
  await page.waitForFunction(() => /\S/.test((document.getElementById('twSpinRes') || {}).textContent || ''), null, { timeout: 8000 });
  const peel = await page.evaluate(async () => ({ line: document.getElementById('twSpinRes').textContent.trim(), lit: (await window.__town.market()).lit(), coins: document.querySelectorAll('.tw-fly').length }));
  expect(peel.line).toBe(W.won.peel);
  expect(peel.lit, 'nothing lit for a peel').toBe(-1);
  expect(peel.coins, 'and nothing flies').toBe(0);
  expect(errs).toEqual([]);
});

test('a spin that fails stops on a line between two wedges, and says the wheel stuck', async ({ page }) => {
  slowWheel(page, { error: 'busy' }, 600);
  const errs = await town(page);
  await page.evaluate(() => window.__town.open('wheel'));
  await page.waitForFunction(() => /\d/.test((document.getElementById('twPot') || {}).textContent || ''), null, { timeout: 10000 });
  await page.locator('#twSpin').click();
  await page.waitForFunction(() => /\S/.test((document.getElementById('twSpinRes') || {}).textContent || ''), null, { timeout: 8000 });
  expect(await text(page, '#twSpinRes')).toBe(W.busy);
  const ang = await wheelAngle(page), per = 360 / 8, off = ((ang % per) + per) % per;
  expect(Math.min(off, per - off), 'the pin sits on a line, not in a wedge').toBeLessThan(0.5);
  expect(errs).toEqual([]);
});

test('a firework from the wheel is in the pocket, because the server’s slot came with the answer', async ({ page }) => {
  wheelWorker(page, { ok: true, i: 1, id: 'firework', kind: 'free', coins: 0, item: 'firework', full: false, pot: 123, next: 'paid', left: 30, wallet: { bal: 40, seq: 10 }, seen: [], slots: { pocket_firework: { wheel: 1 } } });
  const errs = await town(page);
  await page.evaluate(() => window.__town.open('wheel'));
  await page.waitForFunction(() => /\d/.test((document.getElementById('twPot') || {}).textContent || ''), null, { timeout: 10000 });
  await page.locator('#twSpin').click();
  await page.waitForFunction(() => /\S/.test((document.getElementById('twSpinRes') || {}).textContent || ''), null, { timeout: 8000 });
  expect(await text(page, '#twSpinRes')).toBe(W.won.firework);
  expect(await page.evaluate(() => window.__town.pocket()), 'the pocket reads the pass').toEqual({ firework: 1 });
  expect(await page.evaluate(() => !document.getElementById('twPocket').hidden && document.getElementById('twPocketN').textContent), 'the pocket is on the bar').toBe('1');
  expect(errs).toEqual([]);
});

test('a spin you cannot afford says so, with the price and the purse', async ({ page }) => {
  wheelWorker(page, { error: 'funds', bal: 1, cost: 3 }, { next: 'paid' });
  const errs = await town(page);
  await page.evaluate(() => window.__town.open('wheel'));
  await page.waitForFunction(() => /\d/.test((document.getElementById('twPot') || {}).textContent || ''), null, { timeout: 10000 });
  expect(await text(page, '#twSpin .tw-cta__verb')).toBe(W.paid);
  await page.locator('#twSpin').click();
  await page.waitForFunction(() => /\S/.test((document.getElementById('twSpinRes') || {}).textContent || ''), null, { timeout: 8000 });
  expect(await text(page, '#twSpinRes')).toBe(fill(W.funds, { n: 3, have: 1 }));
  expect(errs).toEqual([]);
});

test('somebody else winning the pot is news on the square', async ({ page }) => {
  wheelWorker(page, {});
  const errs = await town(page);
  await page.evaluate(async () => { const s = await window.__town.market(); s.pot(100, 150, 'KIWI'); });
  await page.waitForFunction(() => /\S/.test((document.getElementById('twToast') || {}).textContent || ''), null, { timeout: 4000 });
  expect(await text(page, '#twToast')).toBe(fill(W.potWon, { name: 'KIWI', n: 150 }));
  expect(errs).toEqual([]);
});

test('the Exchange sells what the farm holds, and the farm on this device gives it up', async ({ page }) => {
  const sold = [];
  page.route('**/town/sell', (r) => { sold.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill(json({ ok: true, good: 'eggs', took: 5, coins: 17, left: 0, room: 19, yard: { updated: 2000, prev: 1000 }, wallet: { bal: 57, seq: 11 }, seen: [], slots: { coins_earned: { exchange: 17 } } })); });
  const errs = await town(page, () => { try { if (!sessionStorage.getItem('hs-seeded')) { localStorage.setItem('hs-v1', JSON.stringify({ v: 1, slug: 'ada-yard', claimedAt: 1, eggs: 5, milk: 2, wool: 0, pubUpdated: 1000, animals: [{ id: 'h1', sp: 'hen', gs: 31 }] })); sessionStorage.setItem('hs-seeded', '1'); } } catch (e) {} });
  await page.evaluate(() => window.__town.open('exchange'));
  await page.waitForSelector('#twCardBody [data-sell="eggs"]', { timeout: 10000 });
  const row = await text(page, '#twCardBody .tw-row');
  expect(row, 'the eggs row counts the eggs IN HAND — never the hen’s lifetime tally of 31').toContain(fill(X.have, { n: 5 }));
  expect(row).toContain(X.goods.eggs + ' · ');
  await page.locator('#twCardBody [data-sell="eggs"]').click();
  await page.waitForFunction((l) => ((document.getElementById('twSellRes') || {}).textContent || '').trim() === l, fill(X.paid, { coins: 17, n: 5, what: X.things.eggs }), { timeout: 8000 });
  expect(sold).toEqual([expect.objectContaining({ good: 'eggs', n: 5 })]);
  const hs = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1')));
  expect(hs.eggs, 'the eggs left the farm on this device').toBe(0);
  expect(hs.milk, 'nothing else did').toBe(2);
  expect(hs.pubUpdated, 'in step with the farm before the sale, so it steps forward with it').toBe(2000);
  expect(await page.evaluate(() => document.querySelector('#twCardBody [data-sell="eggs"]').disabled), 'no eggs left to sell').toBe(true);
  await page.screenshot({ path: 'test-results/town-market/exchange.png' });
  expect(errs).toEqual([]);
});

test('with no homestead the Exchange says so and sells nothing', async ({ page }) => {
  const errs = await town(page, () => { try { localStorage.removeItem('hs-v1'); } catch (e) {} });
  await page.evaluate(() => window.__town.open('exchange'));
  await page.waitForSelector('#twCardBody [data-sell="eggs"]', { timeout: 10000 });
  expect(await text(page, '#twSellRes')).toBe(X.noFarm);
  expect(await page.evaluate(() => [...document.querySelectorAll('#twCardBody [data-sell]')].every((b) => b.disabled))).toBe(true);
  expect(errs).toEqual([]);
});

test('a lure from the pocket arms itself on a cast at the pier', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('lure-seeded')) { localStorage.setItem('pass-v1', JSON.stringify({ created: 1, patches: {}, base: {}, led: { pocket_lure: { wheel: 1 } }, days: [] })); localStorage.removeItem('bh-lure-v1'); sessionStorage.setItem('lure-seeded', '1'); } } catch (e) {} });
  await page.goto('/beach/?beachtest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__bay && window.__bay.fishAt), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__bay.fishAt(0));
  await page.waitForFunction((l) => [...document.querySelectorAll('.bh-float')].some((d) => d.textContent === l), BEACH.lure.armed, { timeout: 4000 });
  expect(await page.evaluate(() => window.__bay.lureLeft()), 'the next few casts are armed').toBe(5);
  const used = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('pass-v1')); return Object.values((p.led || {}).pocket_lure_used || {}).reduce((a, b) => a + b, 0); });
  expect(used, 'and the lure left the pocket').toBe(1);
  await page.evaluate(() => window.__bay.fishAt(1));   // a second cast: nothing left in the pocket, one lure is armed already
  expect(await page.evaluate(() => window.__bay.lureLeft())).toBe(5);
  expect(errs).toEqual([]);
});
