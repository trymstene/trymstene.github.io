// 🗣 THE TOWN'S TOASTS ARE THE RIG'S (22 Sep 2026).
//
// CLAUDE.md: "CLAUDE WRITES CODE. GPT WRITES THE WORDS". A handful of toasts in the town were still typed into
// say('…') — the road home, the Exchange's sell button, a lure in the pocket, a cabinet that will not load, the
// arcade's prize and new-best lines — and tools/check-literal-says.mjs now refuses that in every script. This walk
// proves the other half on the built site: each of those moments says the approved line (town-life `toasts`,
// `pocket`), filled with the game's own numbers, and none of them prints a {placeholder}.
import { test, expect } from '@playwright/test';
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };

const T = LIFE.toasts, P = LIFE.pocket;
const toast = (page) => page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
// a rig line with holes, as a pattern: the words exact, each {hole} any text
const shaped = (line) => new RegExp('^' + line.split(/\{\w+\}/).map((s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('.+?') + '$');

async function town(page, init) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  if (init) await page.addInitScript(init);
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
  await page.waitForTimeout(400);
  return errs;
}

test('the pocket tray and a lure in it speak the rig’s words', async ({ page }) => {
  const errs = await town(page);
  await page.evaluate(() => { window.__town.pocketAdd('lure'); window.__town.pocketAdd('firework'); });
  await page.locator('#twPocket').click();
  await page.waitForSelector('#twTray:not([hidden])', { timeout: 5000 });
  const tray = await page.evaluate(() => ({
    names: [...document.querySelectorAll('#twTray .tw-row b')].map((b) => b.textContent.trim()),
    where: [...document.querySelectorAll('#twTray .tw-row small')].map((s) => s.textContent.trim()),
    use: (document.querySelector('#twTray [data-use]') || {}).textContent || '',
  }));
  expect(tray.names.sort(), 'the rows are named in the rig’s words').toEqual([P.firework + ' ×1', P.lure + ' ×1'].sort());
  expect(tray.where, 'the lure says where it works').toEqual([P.lureWhere]);
  expect(tray.use.trim(), 'and the firework’s button is the rig’s verb').toBe(P.use);
  await page.locator('#twTray [data-say="lure"]').click();
  await page.waitForTimeout(150);
  expect(await toast(page), 'a lure tapped in town says where it works').toBe(T.lure);
  expect(errs).toEqual([]);
});

test('the Exchange shows what the eggs would fetch, and says nothing changed hands', async ({ page }) => {
  // a homestead with a hen that has laid three eggs: the Exchange reads the yard on this device
  const errs = await town(page, () => { try { localStorage.setItem('hs-v1', JSON.stringify({ slug: 'ada-yard', claimedAt: Date.now(), animals: [{ id: 'h1', sp: 'hen', gs: 3 }] })); } catch (e) {} });
  await page.evaluate(() => window.__town.open('exchange'));
  await page.waitForSelector('#twCardBody [data-sell="0"]:not([disabled])', { timeout: 5000 });
  await page.locator('#twCardBody [data-sell="0"]').click();
  await page.waitForTimeout(150);
  const said = await toast(page);
  expect(said, 'the rig’s line, filled: ' + said).toMatch(shaped(T.sold));
  expect(said.startsWith('3 eggs'), 'with the count and the goods the game knows').toBe(true);
  expect(said, 'and no hole left open').not.toMatch(/\{\w+\}/);
  expect(errs).toEqual([]);
});

test('walking off by the south road says where you are going', async ({ page }) => {
  const errs = await town(page);
  // ⚠️ the town leaves for the park 600 ms after the line: catch the line, keep the next page from mattering
  await page.route('**/park/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>park</p>' }));
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 1100; t.pos.y = t.tgt.y = 1275; });
  await page.waitForFunction((l) => ((document.getElementById('twToast') || {}).textContent || '').trim() === l, T.road, { timeout: 4000 });
  expect(errs).toEqual([]);
});

test('an arcade run says its prize, then its new best, in the rig’s words', async ({ page }) => {
  let answer = { ok: true, best: 12, rank: 3, players: 9, newBest: true, prizes: ['pixelcrown'], top: [], week: [] };
  await page.route('**/arcade/score', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) }));
  await page.route('**/arcade/board**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ top: [], week: [], players: 9 }) }));
  const errs = await town(page, () => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__town.arcade.play('g2'));   // Banana Snake
  await page.waitForFunction(() => { const g = window.__town.arcade.game(); return !!(g && g.state && g.state()); }, null, { timeout: 15000 });
  // a run that scored twelve, and then ran into the wall: the game's own die() submits it
  const run = () => page.evaluate(() => { const g = window.__town.arcade.game(); g.game.turn(1, 0); const st = g.state(); st.score = 12; st.body[0].x = 14; st.nextDir = { x: 1, y: 0 }; });
  await run();
  await page.waitForFunction((l) => ((document.getElementById('twToast') || {}).textContent || '').trim() === l, T.prize.replace('{prizes}', 'a pixel crown'), { timeout: 8000 });
  // a second run with no prize and a new best: the best line, filled with the board's numbers
  answer = { ok: true, best: 14, rank: 2, players: 9, newBest: true, prizes: [], top: [], week: [] };
  await page.evaluate(() => { const g = window.__town.arcade.game(); g.restart(); });
  await run();
  const best = T.best.replace('{best}', '14').replace('{rank}', '2').replace('{players}', '9');
  await page.waitForFunction((l) => ((document.getElementById('twToast') || {}).textContent || '').trim() === l, best, { timeout: 8000 });
  expect(errs).toEqual([]);
});

test('a cabinet that is still loading says so in the rig’s words', async ({ page }) => {
  // hold the games' own chunk back, so the loading card is on screen long enough to read
  await page.route('**/town-games*.js', async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.continue(); });
  const errs = await town(page);
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__town.arcade.play('g1'));
  await page.waitForTimeout(200);
  const sub = await page.evaluate(() => { const p = document.querySelector('#twCardBody .tw-card__sub'); return p ? p.textContent.trim() : ''; });
  expect(sub, 'the loading line is the rig’s').toBe(T.warming);
  expect(errs).toEqual([]);
});
