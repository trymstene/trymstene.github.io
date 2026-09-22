// 🕯 THE QUEST CHIP GIVES WAY. Trym, 13 Sep 2026, with a screenshot of the fast-travel
// card with the chip's ! sitting on top of it: "quest icon shows on top of fast travel
// popup - quest icon should hide when other popups open, or when youre in a shop or in a
// different context than an open world area".
//
// It was z-index 900 and .pk-view is not a stacking context, so the chip competed in the
// ROOT context and beat the travel veil's fixed z-70. Re-ranking per area is impossible —
// the covers are z-12 on the beach, 40 in the park, 1500 in the town — so the chip went to
// the bottom of the pile (z-10, above the map and the rain, below every cover) and the
// interiors got an explicit rule, because a room appended inside the panning world can
// never out-rank anything on the view.
//
// No grep can check "is it on top", so this is the assertion CLAUDE.md asks for instead:
// point at the chip and ask the browser what is actually there.
import { test, expect } from '@playwright/test';

// what the browser says is at the badge's own centre
const atChip = (page) => page.evaluate(() => {
  const h = document.querySelector('.bwq-hint');
  if (!h) return { chip: false };
  const b = h.querySelector('.bwq-hint__badge') || h;
  const r = b.getBoundingClientRect();
  const shown = getComputedStyle(h).display !== 'none';
  if (!shown || !r.width) return { chip: true, shown, onTop: false, topIs: '(hidden)' };
  const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return { chip: true, shown, onTop: !!(el && el.closest('.bwq-hint')), topIs: el ? String(el.className || el.tagName) : '(nothing)' };
});

async function world(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // the chip deliberately waits ~5s so the world lands first (bwq-hint--wait)
  await page.waitForTimeout(7000);
}

test('the quest chip is reachable in the open world, and gives way to the travel card', async ({ page }) => {
  await world(page, '/park/?parktest');
  const open = await atChip(page);
  test.skip(!open.chip, 'no quest step points at the park in this state');
  expect(open.onTop, `the chip should be the thing at its own spot, found ${open.topIs}`).toBe(true);

  // the fast-travel door lives in the HUD's action bar
  await page.click('.wt-btn');
  await page.waitForTimeout(900);
  const covered = await atChip(page);
  expect(covered.onTop, `the travel card is open, yet the chip is still on top (${covered.topIs})`).toBe(false);
});

test('the quest chip hides inside a shop', async ({ page }) => {
  await world(page, '/park/?parktest');
  const open = await atChip(page);
  test.skip(!open.chip, 'no quest step points at the park in this state');
  expect(open.shown).toBe(true);
  // exactly what openShop does — the interior covers the view from inside the world,
  // where no z-index of the chip's could ever have hidden it
  await page.evaluate(() => document.body.classList.add('pk-inside'));
  await page.waitForTimeout(300);
  const inside = await atChip(page);
  expect(inside.shown, 'the chip is still showing while you are inside a shop').toBe(false);
});

// 📎 THE PAPER FOLDS ON A TAP (Trym, 22 Sep 2026: "important that it's possible to contract the
// work-quest-notification"). The badge was the only fold control and nobody found it; a tap on the note
// itself folds it now, the badge brings it back, and a tap on the paper never walks the banana under it.
test('a tap on the quest note folds it, the badge brings it back, and the banana stays put', async ({ page }) => {
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.pos && document.querySelector('.bwq-hint') && !document.querySelector('.bwq-hint').classList.contains('bwq-hint--wait'), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => document.querySelector('.bwq-hint').classList.contains('is-min')), 'the note is open').toBe(false);
  const before = await page.evaluate(() => ({ x: window.__town.tgt.x, y: window.__town.tgt.y }));
  await page.click('.bwq-hint > span');
  expect(await page.evaluate(() => document.querySelector('.bwq-hint').classList.contains('is-min')), 'a tap on the paper folds it').toBe(true);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ x: window.__town.tgt.x, y: window.__town.tgt.y }));
  expect(after, '…and the banana was not sent walking').toEqual(before);
  await page.click('.bwq-hint__badge');
  expect(await page.evaluate(() => document.querySelector('.bwq-hint').classList.contains('is-min')), 'the badge brings it back').toBe(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.bwq-hint'), null, { timeout: 30000 });
  expect(await page.evaluate(() => document.querySelector('.bwq-hint').classList.contains('is-min')), 'and the fold is remembered either way').toBe(false);
});
