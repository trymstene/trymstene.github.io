// 🏘️👥 THE SQUARE IS SHARED (22 Sep 2026). Trym: *"if the town isnt «multiplayer» yet, make it so aswell"*.
//
// Two phones in the town at once, against the REAL room (worker-rave SquareRoom, the park's rail) — the
// same doctrine as tests/two-devices.spec.mjs: presence cannot be proven on a stub. Each sees the other's
// banana on the square with its name over its head, the crowd chip counts both, a walk moves the other
// one's copy, a door hides it, and leaving takes it away.
// ⚠️ the QA shim keeps every OTHER town walk out of the live room; this one asks for it (?crowd=1).
import { test, expect } from '@playwright/test';

const TOWN = '/town/?towntest&crowd=1&questreset';
const boot = async (page, name) => {
  await page.addInitScript((n) => {
    try { localStorage.setItem('ps-name-v1', n); localStorage.setItem('bwq-c1', JSON.stringify({ s: 17, done: 1 })); } catch (e) {}
  }, name);
  await page.goto(TOWN, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(11); });
  await page.waitForFunction(() => window.__town.crowd && window.__town.crowd.live(), null, { timeout: 20000 });
};
const peersOf = (page) => page.evaluate(() => window.__town.crowd.peers());
const crowdChip = (page) => page.evaluate(() => (document.querySelector('.wh__crowdn') || {}).textContent || '');

test('two bananas in the square see each other, walk, go indoors, and leave', async ({ browser }) => {
  test.setTimeout(120000);
  const A = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const B = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const a = await A.newPage(), b = await B.newPage();
  const errs = [];
  a.on('pageerror', (e) => errs.push('A ' + e)); b.on('pageerror', (e) => errs.push('B ' + e));
  await boot(a, 'QA Alpha');
  await boot(b, 'QA Bravo');

  // ── each sees the other, by name, on the square
  await a.waitForFunction(() => window.__town.crowd.peers().some((p) => p.name === 'QA Bravo'), null, { timeout: 20000 });
  await b.waitForFunction(() => window.__town.crowd.peers().some((p) => p.name === 'QA Alpha'), null, { timeout: 20000 });
  const seenByA = (await peersOf(a)).find((p) => p.name === 'QA Bravo');
  expect(seenByA.hidden, 'the other banana is on the square, drawn').toBe(false);
  expect(await a.locator('.tw-peer:not([hidden])').count(), 'as a body in the world').toBeGreaterThanOrEqual(1);
  expect(await a.locator('.tw-peer__name', { hasText: 'QA Bravo' }).count(), 'with its name over its head').toBe(1);
  expect(parseInt(await crowdChip(a), 10), 'and the crowd chip counts both').toBeGreaterThanOrEqual(2);
  // a picture for the record: A's square with B standing in it (the camera on the south road, where both spawned)
  await a.screenshot({ path: 'test-results/town-crowd-a-sees-b.png' });

  // ── B walks; A's copy of B follows within a beat
  await b.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 700; t.pos.y = t.tgt.y = 1000; });
  await a.waitForFunction(() => { const p = window.__town.crowd.peers().find((q) => q.name === 'QA Bravo'); return p && Math.abs(p.x - 700) < 12 && Math.abs(p.y - 1000) < 12; }, null, { timeout: 10000 });

  // ── B steps into the arcade: A no longer draws B on the square (another plate), and knows why
  await b.evaluate(() => window.__town.arcade.enter());
  await a.waitForFunction(() => { const p = window.__town.crowd.peers().find((q) => q.name === 'QA Bravo'); return p && p.room === 'condo' && p.hidden; }, null, { timeout: 10000 });
  await b.evaluate(() => window.__town.arcade.exit());
  await a.waitForFunction(() => { const p = window.__town.crowd.peers().find((q) => q.name === 'QA Bravo'); return p && !p.room && !p.hidden; }, null, { timeout: 10000 });

  // ── B leaves: A's square is its own again
  await B.close();
  await a.waitForFunction(() => !window.__town.crowd.peers().some((p) => p.name === 'QA Bravo'), null, { timeout: 15000 });

  // ⚠️ AND NOTHING RELOADS. Trym: "theres no issues with auto refresh of the area because it ends up
  // reloading the area again and again, we had an issue with that on the homestead". A presence room
  // superseding an older socket, a retry, a leave — none of it may turn into a navigation. One
  // navigation entry per phone, the same URL, and the room still live after a soak.
  await a.waitForTimeout(12000);
  const soak = await a.evaluate(() => ({ navs: performance.getEntriesByType('navigation').length, url: location.pathname + location.search, live: window.__town.crowd.live() }));
  expect(soak.navs, 'the page loaded exactly once').toBe(1);
  expect(soak.url, 'and never went anywhere').toBe('/town/?towntest&crowd=1&questreset');
  expect(soak.live, 'and the room is still live').toBe(true);
  expect(errs, 'nothing threw on either phone').toEqual([]);
  await A.close();
});
