// 💼 THE DUTIES CHIP (22 Sep 2026; docs/town-jobs-plan.md §9.2). Trym: *"there should also be
// notifications similar to the quest notifications … if you have duties regarding your job … a
// collected amount of pay so far with a counter until payday."*
//
// The chip says one line at a time, all of them the rig's: the duty before you turn up, the wage so far
// and the days to payday after, the payslip when a cheque waits at home. It folds like the quest chip,
// sits under it when both are up, and says nothing at all without a job.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-duties.json'), 'utf8'));
const strip = (s) => String(s).replace(/\{(coins|days)\}/g, '').replace(/\s+/g, ' ').trim();

const town = async (page) => {
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(11); });
};
const chip = (page) => page.evaluate(() => ({ hidden: window.__town.duties.hidden(), line: window.__town.duties.line(), html: window.__town.duties.html(), folded: window.__town.duties.folded(), top: window.__town.duties.top() }));

test('no job, no chip; a job says its duty; turning up says the wage and payday; a cheque says the letterbox', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  await town(page);
  expect((await chip(page)).hidden, 'nobody hired you: nothing to say').toBe(true);

  // ── hired at the store, not turned up today: the store's duty
  await page.evaluate(() => window.__town.work.set({ at: 'store', days: 2, pay: 90, sofar: 26, owed: 0 }));
  await page.waitForFunction(() => !window.__town.duties.hidden(), null, { timeout: 5000 });
  let c = await chip(page);
  expect(c.line, 'the store’s duty, the rig’s own words').toBe(COPY.duty.store);
  expect(c.line[0], 'a note to yourself starts small').toBe(c.line[0].toLowerCase());

  // ── turning up: the wage so far (the cheque’s own arithmetic) and the days to payday
  await page.evaluate(() => window.__town.work.turnUp());
  await page.waitForFunction((d) => window.__town.duties.line() !== d, COPY.duty.store, { timeout: 5000 });
  c = await chip(page);
  const payday = (7 - ((new Date().getUTCDay() + 6) % 7)) % 7 || 7;
  const sofar = Math.round(90 * 3 / 7);   // turning up counted a third day: the cheque's own formula, 90 × 3 ÷ 7
  expect(c.html, 'the coins so far are printed in bold, by the cheque’s own arithmetic').toContain('<b>' + sofar + '</b>');
  expect(c.html, '…and so is payday, counted to next Monday').toContain('<b>' + payday + '</b>');
  expect(strip(c.line.replace(String(sofar), '').replace(String(payday), '')), 'around the rig’s wage line').toBe(strip(COPY.wage).replace(/\s+/g, ' '));

  // ── a cheque was paid while you were away: the letterbox line wins
  await page.evaluate(() => window.__town.work.set({ at: 'store', days: 2, pay: 90, sofar: 26, owed: 90, up: new Date().toISOString().slice(0, 10) }));
  await page.waitForFunction((l) => window.__town.duties.line() === l, COPY.payslip, { timeout: 5000 });

  // ── the café is a tips job: its duty, then its after-line, never a wage
  await page.evaluate(() => window.__town.work.set({ at: 'cafe', days: 0, pay: 0, sofar: 0, owed: 0 }));
  await page.waitForFunction((l) => window.__town.duties.line() === l, COPY.duty.cafe, { timeout: 5000 });
  await page.evaluate(() => window.__town.work.turnUp());
  await page.waitForFunction((l) => window.__town.duties.line() === l, COPY.cafeDone, { timeout: 5000 });
  expect((await chip(page)).html, 'no number anywhere on a tips job').not.toMatch(/<b>\d/);

  // ── it folds like the quest chip, and stays folded
  await page.click('.twd-chip__badge');
  expect((await chip(page)).folded, 'folded to its badge').toBe(true);
  await page.click('.twd-chip__badge');
  expect((await chip(page)).folded, '…and open again').toBe(false);

  // ── Pulse heard each line once
  const ev = await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_duty').map((e) => e[1].kind));
  expect(ev, 'a duty, a wage, a payslip, a duty, an after-line').toEqual(['duty', 'wage', 'payslip', 'duty', 'wage']);

  // ── and it never speaks over the quest chip: under it when both are up
  await page.evaluate(() => window.__town.work.set({ at: 'store', days: 1, pay: 90, sofar: 13, owed: 0 }));
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.duties && !window.__town.duties.hidden() && document.querySelector('.bwq-hint') && !document.querySelector('.bwq-hint').classList.contains('bwq-hint--wait'), null, { timeout: 30000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'test-results/town-duties-under-the-quest.png' });   // a picture for the record
  const stack = await page.evaluate(() => { const q = document.querySelector('.bwq-hint').getBoundingClientRect(); const d = document.querySelector('.twd-chip').getBoundingClientRect(); return { qBottom: q.bottom, dTop: d.top }; });
  expect(stack.dTop, 'the work note sits below the quest note').toBeGreaterThan(stack.qBottom);
  expect(errs, 'nothing threw').toEqual([]);
});
