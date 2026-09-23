// 🕯🏘 CHAPTER ONE OPENS IN THE TOWN (21 Sep 2026).
//
// Trym: *"For the first step in Chapter 1, Nib can stand by the fountain and meet you, and after
// the first quest dialogue of chapter 1 he can walk up to his regular place by the Town Hall."*
// and *"change the chapter 1 copy text … to more like referring to plot 11, not standing there,
// but that you have to travel there."*
//
// This is that scene, walked as a newcomer on a phone: the town's OWN Nib waits at the fountain
// (no second body is drawn), the ! hangs over him and he is in the frame at spawn, the tap plays
// the chapter's splash and then the rig's words — the letter verbatim, the plot a place to travel
// to, Old Peel in the park — and when the sheet closes he sets off for the town hall while the
// chip turns into the compass. Then the other end: a fresh player on the homestead is pointed at
// the fountain, and the chapter's LAST scene still happens at the plot, with Nib drawn there.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'quest-c1.json'), 'utf8')).open;
const W = 2200, H = 1300;
const FOUNTAIN = [1160, 985];   // town-life.js ST.fountain — the point the step's anchor is built from

const save = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bwq-c1') || 'null'); } catch (e) { return null; } });
const nib = (page) => page.evaluate(() => (window.__town.life.residents().find((r) => r.key === 'nib') || null));
const tap = async (page, sel) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('nothing to tap at ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};
// ⚠️ A BUBBLE IS TYPED OUT, one letter at a time — read it only once it has stopped changing
const settled = async (page) => {
  let last = null;
  for (let i = 0; i < 40; i++) {
    const now = await page.locator('.bwq-dlg').textContent().catch(() => null);
    if (now === null) return '';
    if (now === last) return now;
    last = now; await page.waitForTimeout(220);
  }
  return last || '';
};
// play the open sheet to its end: your own line is a button, everything else advances on a tap
const playSheet = async (page) => {
  for (let i = 0; i < 40; i++) {
    if (!(await page.locator('.bwq-dlg').count())) return;
    if (await page.locator('.bwq-ans:not([hidden]) button').count()) { await tap(page, '.bwq-ans:not([hidden]) button'); await page.waitForTimeout(260); continue; }
    await tap(page, '.bwq-dlg'); await page.waitForTimeout(260);
  }
  throw new Error('the sheet never closed');
};

test('a newcomer meets Nib at the fountain, and he walks up to the town hall after', async ({ page }) => {
  test.setTimeout(180000);   // nine typed bubbles, then a walk across the square
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (kind, name, p) => window.__ev.push([name, p]); });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  // a plain morning in a lively town, from the start of the beat: nobody is kept in (below Lively the day's seeded
  // few stay home, and on a day that picked Nib the walk up ended at his door), and the walk ends inside the beat
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(8); });

  // ── the chapter claimed him, and the square answered
  await page.waitForFunction(() => window.bwqTalk && window.bwqTalk.who === 'nib' && window.bwqTalk.station === 'fountain', null, { timeout: 15000 });
  await page.waitForFunction(([fx, fy]) => { const n = window.__town.life.residents().find((r) => r.key === 'nib'); return n && !n.hidden && Math.hypot(n.x - fx, n.y - fy) < 30; }, FOUNTAIN, { timeout: 20000 });
  const n0 = await nib(page);
  expect(n0.place, 'Nib stands at the fountain, not at his desk').toBe('fountain');
  expect(await page.locator('.bwq-npc').count(), 'and the chapter draws no second Nib in the town').toBe(0);
  expect(await page.locator('.tw-npc[data-k="nib"]').count(), 'there is exactly one').toBe(1);

  // ── the ! hangs over HIM, and he is in the frame where a newcomer lands
  await page.waitForSelector('.bwq-mark', { timeout: 10000 });
  const geo = await page.evaluate(([fx, fy]) => {
    const m = document.querySelector('.bwq-mark').getBoundingClientRect();
    const b = document.querySelector('.tw-npc[data-k="nib"]').getBoundingClientRect();
    const v = document.querySelector('#twView').getBoundingClientRect();
    const inView = (r) => r.left >= v.left - 1 && r.right <= v.right + 1 && r.top >= v.top - 1 && r.bottom <= v.bottom + 1;
    return { markX: m.left + m.width / 2, markBottom: m.bottom, nibX: b.left + b.width / 2, nibTop: b.top, nibIn: inView(b), markIn: inView(m) };
  }, FOUNTAIN);
  expect(Math.abs(geo.markX - geo.nibX), 'the ! sits over his head, not beside him').toBeLessThan(28);
  expect(geo.markBottom, 'above him, not on him').toBeLessThanOrEqual(geo.nibTop + 24);
  expect(geo.nibIn && geo.markIn, 'both in the frame at spawn on a 393-wide phone — the lesson of 14 Aug').toBe(true);

  // ── the tap: the chapter's splash, then the rig's words
  await tap(page, '.bwq-mark');
  await expect(page.locator('.bwq-intro'), 'the chapter i splash plays once').toHaveCount(1);
  await page.waitForTimeout(4200);
  await expect(page.locator('.bwq-dlg'), 'then the sheet').toHaveCount(1);
  const first = await settled(page);
  expect(first, 'the first bubble is the approved scene, word for word').toContain(COPY.lines[0].text);
  // the whole scene, as the file has it
  const said = [];
  for (let i = 0; i < 40 && await page.locator('.bwq-dlg').count(); i++) {
    said.push(await settled(page));
    if (await page.locator('.bwq-ans:not([hidden]) button').count()) { await tap(page, '.bwq-ans:not([hidden]) button'); await page.waitForTimeout(260); continue; }
    await tap(page, '.bwq-dlg'); await page.waitForTimeout(260);
  }
  const all = said.join('\n');
  expect(all, 'the letter is read verbatim').toContain('the eleventh plot, to whoever comes asking. it has waited long enough.');
  expect(all, 'Old Peel is where the answer is').toMatch(/Old Peel/);
  expect(all, 'and the plot is a place to travel to, never the ground underfoot').not.toMatch(/\b(this plot|standing here|right here)\b/i);
  await playSheet(page);

  // ── the scene is over: the save moved on, the town let him go, the chip is the compass
  const s = await save(page);
  expect(s && s.s, 'step 1 is open').toBe(1);
  await page.waitForFunction(() => !window.bwqTalk, null, { timeout: 5000 });
  await expect(page.locator('.bwq-mark'), 'no mark is left at the fountain').toHaveCount(0);
  const chip = await page.locator('.bwq-hint span').textContent();
  expect(chip.toLowerCase(), 'the chip points at Old Peel now').toMatch(/peel|park/);
  const ev = await page.evaluate(() => (window.__ev || []).map((e) => e[0]));
  expect(ev, 'the opening counted').toContain('quest_intro');

  // ── and he walks up to the town hall — now, not on his own moment a minute later
  await page.waitForFunction(() => { const n = window.__town.life.residents().find((r) => r.key === 'nib'); return n && n.place === 'hall'; }, null, { timeout: 8000 });
  await page.waitForFunction(() => { const n = window.__town.life.residents().find((r) => r.key === 'nib'); return n && n.leg; }, null, { timeout: 8000 });
  const walking = await nib(page);
  expect(walking.leg, 'he is crossing the square').toBe(true);
  // …and a few seconds later he is well away from it (the lane goes east first, then north)
  await page.waitForFunction(([fx, fy]) => { const n = window.__town.life.residents().find((r) => r.key === 'nib'); return n && Math.hypot(n.x - fx, n.y - fy) > 40; }, FOUNTAIN, { timeout: 8000 });
  // ⚠️ a long leash: under the full suite four browsers share one machine and the square's frames come
  // slow, so a nine-second walk alone has taken over 45 s beside its siblings
  await page.waitForFunction(() => { const n = window.__town.life.residents().find((r) => r.key === 'nib'); return n && !n.leg && n.y < 640; }, null, { timeout: 100000 });
  const there = await nib(page);
  expect(there.place, 'and he is at the hall').toBe('hall');
  expect(errs, 'nothing threw').toEqual([]);
});

// ⭐ 23 Sep 2026: the day's seeded few who stay indoors once included Nib, and chapter one opened on an empty
// fountain for every newcomer that day. A place the story INSISTS on beats being kept in; a Curse Night keeps
// EVERYBODY in, so it proves that on any day rather than only on the days the hash picks him.
test('a night that keeps the whole town in still leaves the chapter’s Nib at the fountain', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('deep'); window.__town.life.set(9); });
  // the night's own chunk loads first, so it takes a moment to send them in
  await page.waitForFunction(() => window.__town.life.kept().length >= 8, null, { timeout: 15000 });
  const kept = await page.evaluate(() => window.__town.life.kept());
  expect(kept, 'but never the one chapter one is waiting with').not.toContain('nib');
  const n = await nib(page);
  expect(n && n.place, 'he waits at the fountain').toBe('fountain');
});

test('a returning newcomer finds him still there, and the town at night keeps him out', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => window.__town.room.curse('none'));
  // ⭐ FROM THE FIRST FRAME: the square reads the chapter's save before the chapter boots, so he is
  // standing there when the page lands rather than walking down from his desk during the splash
  const early = await nib(page);
  expect(early && early.place, 'Nib is at the fountain before the chapter has even booted').toBe('fountain');
  // night falls (beat 5): everybody goes home — except the one the chapter is holding
  await page.evaluate(() => window.__town.life.set(21));
  await page.waitForTimeout(900);
  const night = await nib(page);
  expect(night.hidden, 'Nib waits through the night too').toBe(false);
  expect(night.place, '…at the fountain').toBe('fountain');
  const others = await page.evaluate(() => window.__town.life.residents().filter((r) => r.key !== 'nib' && !r.hidden && r.place !== 'home').map((r) => r.key + ':' + r.place));
  expect(others.length, 'while the rest of the town has gone in (or is on its way)').toBeLessThanOrEqual(3);
});

test('the homestead points a newcomer at the fountain, and the ending still happens at the plot', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.bwq-hint span', { timeout: 30000 });
  await page.waitForTimeout(5500);   // the chip holds back ~5 s on a first render
  const chip = (await page.locator('.bwq-hint span').textContent()).toLowerCase();
  expect(chip, 'the compass names the fountain in the town').toMatch(/fountain/);
  expect(await page.locator('.bwq-npc').count(), 'and nobody waits at the gate any more').toBe(0);

  await page.goto('/homestead/?hstest=claimed&queststep=16', { waitUntil: 'domcontentloaded' });   // Nib's last scene, at the gate
  await page.waitForSelector('.bwq-npc', { timeout: 30000 });
  expect(await page.locator('.bwq-npc').count(), 'the last scene draws Nib at the plot, as it always did').toBe(1);
  await expect(page.locator('.bwq-mark'), 'with his mark over him').toHaveCount(1);
});
