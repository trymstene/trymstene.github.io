// 🏘️ A PLACE ANSWERS PLAINLY (22 Sep 2026, docs/voice.md). Trym, tapping the lemonade stand: *"i dont understand
// any of this text … clear and concrete messages like this please - check all of those shop messages when you
// tap them, make them clear and understandable"*.
//
// Every line a place answers with is the rig's now, and the rig's gate holds the two answers (what is this, what
// can I do here). This walk taps the places that used to answer from a sentence typed into the code and checks
// that what they say is the approved line, word for word, and that no “Not built yet.” survives anywhere a tap
// can reach.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', f), 'utf8'));
const FRONTS = read('town-fronts.json'), CAFE = read('town-cafe.json'), LEMON = read('town-lemon.json'), POST = read('town-post.json');

async function town(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('hs-v1', JSON.stringify({ slug: 'ada-yard', claimedAt: Date.now() })); } catch (e) {} });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); window.__town.work.set({ at: '' }); });
  await page.waitForTimeout(500);
  return errs;
}
const toast = (page) => page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
const cardSub = (page) => page.evaluate(() => { const p = document.querySelector('#twCardBody .tw-card__sub'); return p ? p.textContent.trim() : ''; });
const closeCard = (page) => page.evaluate(() => document.getElementById('twCardX').click());

test('the hall, the bank, the print shop, the wheel, the exchange, the café and the stand answer a tap in the rig’s plain words', async ({ page }) => {
  const errs = await town(page);
  // the three that toast: the town's own tap answer, reached the way a walk reaches a spot
  for (const [key, line] of [['hall', FRONTS.hall], ['bank', FRONTS.bank], ['print', FRONTS.print]]) {
    await page.evaluate((k) => { const s = window.__town.SPOTS[k]; if (s) { window.__town.pos.x = window.__town.tgt.x = s.x; window.__town.pos.y = window.__town.tgt.y = s.y + 40; } window.__town.open(k); }, key);
    await page.waitForTimeout(300);
    const said = await toast(page);
    expect(said, key + ' answers in the rig’s words').toBe(line);
    expect(said, '…and never the developer’s').not.toContain('Not built yet');
  }
  // the two cards: their first line is the rig's
  await page.evaluate(() => window.__town.open('wheel'));
  await page.waitForTimeout(400);
  expect(await cardSub(page), 'the Wheel’s card opens with the rig’s line').toBe(FRONTS.wheel);
  await closeCard(page);
  await page.evaluate(() => window.__town.open('exchange'));
  await page.waitForTimeout(400);
  expect(await cardSub(page), 'the Exchange’s card opens with the rig’s line').toBe(FRONTS.exchange);
  await closeCard(page);
  // the two counters, to a stranger
  for (const [key, line, ready] of [['cafe', CAFE.front, 'cafeReady'], ['stand', LEMON.front, 'lemonReady']]) {
    await page.evaluate((r) => window.__town.room[r](), ready);
    await page.evaluate((k) => window.__town.room.open(k), key);
    await page.waitForFunction((l) => (document.getElementById('twToast').textContent || '').trim() === l, line, { timeout: 10000 });
  }
  // the post office's own line sits on its card
  await page.evaluate(() => window.__town.open('post'));
  await page.waitForFunction(() => !!document.querySelector('.tw-post'), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.querySelector('.tw-post').textContent), 'the post office says what it is on its card').toContain(POST.front);
  await closeCard(page);
  // and no hand-written tap line is left in the town's own table
  const stubs = await page.evaluate(() => Object.entries(window.__town.ABOUT || {}).filter(([k, v]) => /not built yet/i.test(String(v[2] || ''))).map(([k]) => k));
  expect(stubs, 'no “Not built yet.” anywhere a tap can reach').toEqual([]);
  expect(errs, 'nothing threw').toEqual([]);
});

test('every place line names its place and says what a player can do there', () => {
  const lines = [
    ['fronts.hall', FRONTS.hall, ['hall']], ['fronts.bank', FRONTS.bank, ['bank', 'cash machine']], ['fronts.print', FRONTS.print, ['print', 'sticker']],
    ['fronts.wheel', FRONTS.wheel, ['wheel']], ['fronts.exchange', FRONTS.exchange, ['exchange', 'fig jr']], ['fronts.oldCabinet', FRONTS.oldCabinet, ['cabinet']],
    ['cafe.front', CAFE.front, ['coffee cup', 'kiosk', 'café', 'cafe']], ['lemon.front', LEMON.front, ['lemonade']], ['post.front', POST.front, ['post office']],
  ];
  for (const [id, line, names] of lines) {
    const v = String(line || '').toLowerCase();
    expect(v.length, id + ' has a line').toBeGreaterThan(20);
    expect(names.some((n) => v.includes(n)), id + ' names its place').toBe(true);
    expect(/\?\s*$/.test(v), id + ' asks nothing').toBe(false);
  }
});
