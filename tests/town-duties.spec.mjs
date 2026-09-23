// 💼 THE WORK NOTE (22 Sep 2026; docs/town-jobs-plan.md §12). Trym: *"we should have optional quest-notifications
// in a different color letting users know that they have work-stuff to forfill and a time-span they have to
// fix it … Arcade: Swept floor 0/3, fixed Arcade machine 0/3"*.
//
// Two lines, all of them the rig's words around the game's numbers: the week's counts against their targets,
// and under them the wage so far and the days to payday — or the week's work done, the boss asking if you're
// coming in, the boss letting you go, or the payslip waiting at home. A tips job keeps its own two lines. It
// folds like the quest chip, sits under it when both are up, and says nothing at all without a job.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-duties.json'), 'utf8'));
const STAFF = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-staff.json'), 'utf8'));
import { tipsCap } from '../src/data/town/jobs.js';
const strip = (s) => String(s).replace(/\{(coins|days)\}/g, '').replace(/\s+/g, ' ').trim();

const town = async (page) => {
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(11); });
};
const chip = (page) => page.evaluate(() => ({ hidden: window.__town.duties.hidden(), top: window.__town.duties.top(), line: window.__town.duties.line(), html: window.__town.duties.html(), kind: window.__town.duties.kind(), folded: window.__town.duties.folded() }));
const waitLine = (page, l) => page.waitForFunction((x) => window.__town.duties.line() === x, l, { timeout: 5000 });

test('the note: nothing without a job, the counts and the wage with one, the boss’s lines, the payslip, the café', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  await town(page);
  expect((await chip(page)).hidden, 'nobody hired you: nothing to say').toBe(true);

  // ── hired at the arcade, a week half done: the counts, and the wage so far
  await page.evaluate(() => window.__town.work.set({ at: 'condo', pay: 60, sofar: 30, share: 0.5, owed: 0, duties: [{ kind: 'sweep', done: 2, of: 3 }, { kind: 'fix', done: 1, of: 3 }] }));
  await page.waitForFunction(() => !window.__town.duties.hidden(), null, { timeout: 5000 });
  // 🪜 the note leads with your title (the ladder, 23 Sep 2026) once the ladder's words have landed with the job
  await page.waitForFunction((t) => window.__town.duties.top().indexOf(t) === 0, STAFF.ranks.condo[0], { timeout: 5000 });
  let c = await chip(page);
  expect(c.top, 'your title first').toContain(STAFF.ranks.condo[0]);
  expect(c.top, 'floor swept 2/3').toContain(COPY.kinds.sweep + ' 2/3');
  expect(c.top, 'machines fixed 1/3').toContain(COPY.kinds.fix + ' 1/3');
  const payday = (7 - ((new Date().getUTCDay() + 6) % 7)) % 7 || 7;
  expect(c.html, 'the wage so far, in bold, the mirror’s own number').toContain('<b>30</b>');
  expect(c.html, '…and payday, counted to next Monday').toContain('<b>' + payday + '</b>');
  expect(strip(c.line.replace('30', '').replace(String(payday), '')), 'around the rig’s wage line').toBe(strip(COPY.wage));
  expect(c.line[0], 'a note to yourself starts small').toBe(c.line[0].toLowerCase());

  // ── the week's work done: the line changes, the counts stay
  await page.evaluate(() => window.__town.work.set({ at: 'condo', pay: 60, sofar: 60, share: 1, owed: 0, duties: [{ kind: 'sweep', done: 3, of: 3 }, { kind: 'fix', done: 3, of: 3 }] }));
  await waitLine(page, COPY.done);
  expect((await chip(page)).top, 'the counts are full').toContain(COPY.kinds.fix + ' 3/3');

  // ── Thursday and nothing done: the boss's nudge, in its own colour
  await page.evaluate(() => window.__town.work.set({ at: 'condo', pay: 60, sofar: 0, share: 0, owed: 0, nudge: true, duties: [{ kind: 'sweep', done: 0, of: 3 }, { kind: 'fix', done: 0, of: 3 }] }));
  await waitLine(page, COPY.nudge.condo);
  expect((await chip(page)).kind, 'the note wears the nudge’s colour').toBe('nudge');

  // ── a cheque paid while you were away: the letterbox line wins, whatever the week
  await page.evaluate(() => window.__town.work.set({ at: 'condo', pay: 60, sofar: 0, share: 0, owed: 40, nudge: true, duties: [{ kind: 'sweep', done: 0, of: 3 }, { kind: 'fix', done: 0, of: 3 }] }));
  await waitLine(page, COPY.payslip);

  // ── let go: no job any more, and the note says so for a few days
  await page.evaluate(() => window.__town.work.set({ at: '', fired: { at: 'condo', week: 'w', t: Date.now() } }));
  await waitLine(page, COPY.fired.condo);
  expect((await chip(page)).kind, 'the note wears the sack’s colour').toBe('fired');
  expect((await chip(page)).top, 'and no counts: there is no week').toBe('');
  await page.evaluate(() => window.__town.work.set({ at: '', fired: { at: 'condo', week: 'w', t: Date.now() - 4 * 86400000 } }));
  await page.waitForFunction(() => window.__town.duties.hidden(), null, { timeout: 5000 });

  // ── the store: its own two duties
  await page.evaluate(() => window.__town.work.set({ at: 'store', pay: 90, sofar: 45, share: 0.5, owed: 0, duties: [{ kind: 'restock', done: 3, of: 3 }, { kind: 'days', done: 0, of: 3 }] }));
  await page.waitForFunction(() => !window.__town.duties.hidden(), null, { timeout: 5000 });
  await page.waitForFunction((t) => window.__town.duties.top().indexOf(t) === 0, STAFF.ranks.store[0], { timeout: 5000 });
  c = await chip(page);
  expect(c.top, 'the store’s first title').toContain(STAFF.ranks.store[0]);
  expect(c.top, 'shelf restocked 3/3').toContain(COPY.kinds.restock + ' 3/3');
  expect(c.top, 'turned up 0/3').toContain(COPY.kinds.days + ' 0/3');

  // ── the café is a tips job: today's tips against the day's cap over it (23 Sep 2026: the note had no numbers at
  // all for a tips job), then its duty, then its after-line — never the week's counts
  await page.evaluate(() => window.__town.work.set({ at: 'cafe', pay: 0 }));
  await waitLine(page, COPY.duty.cafe);
  expect((await chip(page)).top, 'today’s tips against the RANK’s cap, not the week’s counts').toBe(STAFF.ranks.cafe[0] + ' · ' + COPY.tips + ' 0/' + tipsCap('cafe', 1));
  await page.evaluate(() => window.__town.work.turnUp());
  await waitLine(page, COPY.cafeDone);
  expect((await chip(page)).html, 'no number anywhere on a tips job').not.toMatch(/<b>\d/);

  // ── it folds like the quest chip, by its badge (Trym, 22 Sep: "important that it's possible to contract the
  // work-quest-notification") — and a tap on the paper opens your staff card now (23 Sep 2026, the staff card plan's
  // decision 2) and never walks the banana
  await page.click('.twd-chip__badge');
  expect((await chip(page)).folded, 'folded to its badge').toBe(true);
  await page.click('.twd-chip__badge');
  expect((await chip(page)).folded, '…and open again').toBe(false);
  const before = await page.evaluate(() => ({ x: window.__town.pos.x, y: window.__town.pos.y, tx: window.__town.tgt.x, ty: window.__town.tgt.y }));
  await page.click('.twd-chip__line');
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden && !!document.querySelector('.tws[data-at="cafe"]'), null, { timeout: 10000 });
  expect((await chip(page)).folded, 'a tap on the paper opens the card, and does not fold it').toBe(false);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ x: window.__town.pos.x, y: window.__town.pos.y, tx: window.__town.tgt.x, ty: window.__town.tgt.y }));
  expect([after.tx, after.ty], '…and the banana was not sent walking').toEqual([before.tx, before.ty]);
  await page.evaluate(() => document.getElementById('twCardX').click());

  // ── Pulse heard each kind of line once per day
  const ev = await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_duty').map((e) => e[1].kind));
  expect(ev, 'a wage, done, a nudge, a payslip, the sack, a wage (the store), a duty, a wage (the café)').toEqual(['wage', 'done', 'nudge', 'payslip', 'fired', 'wage', 'duty', 'wage']);

  // ── and it never speaks over the quest chip: under it when both are up
  await page.evaluate(() => window.__town.work.set({ at: 'store', pay: 90, sofar: 13, share: 0.15, owed: 0, duties: [{ kind: 'restock', done: 1, of: 3 }, { kind: 'days', done: 0, of: 3 }] }));
  await page.goto('/town/?towntest&questreset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.duties && !window.__town.duties.hidden() && document.querySelector('.bwq-hint') && !document.querySelector('.bwq-hint').classList.contains('bwq-hint--wait'), null, { timeout: 30000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'test-results/town-duties-under-the-quest.png' });
  const stack = await page.evaluate(() => { const q = document.querySelector('.bwq-hint').getBoundingClientRect(); const d = document.querySelector('.twd-chip').getBoundingClientRect(); return { qBottom: q.bottom, dTop: d.top }; });
  expect(stack.dTop, 'the work note sits below the quest note').toBeGreaterThan(stack.qBottom);
  // ── ONE COLUMN (Trym, 22 Sep: "harmony between the main questline icon and notification, and the work-job-icon
  // and notification - so they dont disturb or get in eachothers way"): fold the quest note and the work note
  // moves up under its badge, never onto it; fold both and the two badges stand stacked, apart, in one column
  const rect = (sel) => page.evaluate((s2) => { const r = document.querySelector(s2).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; }, sel);
  await page.click('.bwq-hint > span');
  await page.waitForTimeout(450);
  let qb = await rect('.bwq-hint__badge'), db = await rect('.twd-chip__badge'), dn = await rect('.twd-chip');
  expect(qb.h, 'the quest note folded to its badge').toBeGreaterThan(0);
  expect(db.top, 'the work note’s badge sits under the quest badge, not on it').toBeGreaterThanOrEqual(qb.bottom);
  expect(dn.top, 'and the note came up the column').toBeLessThan(stack.dTop);
  await page.click('.twd-chip__badge');   // 💼 the work note folds by its badge (a tap on its paper opens the staff card)
  await page.waitForTimeout(450);
  qb = await rect('.bwq-hint__badge'); db = await rect('.twd-chip__badge');
  expect(db.top, 'two folded notes: two badges, stacked').toBeGreaterThanOrEqual(qb.bottom);
  expect(Math.abs(db.left - qb.left), '…in one column').toBeLessThan(8);
  await page.screenshot({ path: 'test-results/town-duties-two-badges.png' });   // the two badges, stacked in one column
  await page.click('.twd-chip__badge');
  await page.click('.bwq-hint__badge');
  await page.waitForTimeout(450);
  const again = await page.evaluate(() => { const q = document.querySelector('.bwq-hint').getBoundingClientRect(); const d = document.querySelector('.twd-chip').getBoundingClientRect(); return { qBottom: q.bottom, dTop: d.top }; });
  expect(again.dTop, 'unfolded, the work note is back under the quest note').toBeGreaterThan(again.qBottom);
  await page.screenshot({ path: 'test-results/town-duties-column.png' });
  expect(errs, 'nothing threw').toEqual([]);
});
