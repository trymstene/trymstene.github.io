// 📄 THE PAYSLIP (22 Sep 2026; docs/town-jobs-plan.md §9.3). Trym: *"the paycheck should have a different
// color paper or look or envelope style visual for when you get paid."*
//
// The wage letter in the homestead mailbox is a payslip now: kraft paper, a rubber stamp, Nib's line
// and the figures printed under it — the workplace, the days at the week's rate, the total with its
// coin. All words are the rig's; the numbers are what /job/pay dropped in the row. A slip delivered
// before today (only a total) keeps its line and prints no figures.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'homestead-post.json'), 'utf8'));

test('a cheque in the box is a payslip: kraft, a stamp, the figures — and an old one keeps its line', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mail, null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.slug('my-yard'));
  // two slips: today's, with its figures, and one from before the figures existed
  await page.evaluate(() => {
    window.__hs.mail({ id: 'wage:2026-W37:store', n: 64, d: 5, at: 'store', r: 90 });
    window.__hs.mail({ id: 'wage:2026-W36:condo', n: 26 });
  });
  await page.evaluate(() => window.__hs.post());
  await page.waitForSelector('.bw-paper--wage', { timeout: 10000 });
  const slips = await page.evaluate(() => [...document.querySelectorAll('.bw-paper--wage')].map((p) => ({
    stamp: (p.querySelector('.bw-slip__stamp') || {}).textContent || '',
    at: (p.querySelector('.bw-slip__at') || {}).textContent || '',
    terms: (p.querySelector('.bw-slip__terms') || {}).textContent || '',
    bold: [...p.querySelectorAll('.bw-slip__terms b, .bw-slip__total b')].map((b) => b.textContent),
    rows: !!p.querySelector('.bw-slip__rows'),
    text: p.textContent,
    kraft: getComputedStyle(p).backgroundColor,
    from: (p.querySelector('.bw-paper__from') || {}).textContent || '',
  })));
  expect(slips.length, 'both slips are in the box').toBe(2);
  const [today, old] = slips.some((s) => s.rows) ? [slips.find((s) => s.rows), slips.find((s) => !s.rows)] : [null, null];
  expect(today, 'the new slip prints its figures').not.toBeNull();
  expect(today.stamp, 'the stamp is the rig’s word, in capitals').toBe(COPY.wage.stamp);
  expect(today.at, 'the workplace, as the rig prints it').toBe(COPY.wage.at.store);
  expect(today.bold, 'the days, the rate and the total, in that order, in bold').toEqual(['5', '90', '64']);
  expect(today.terms.replace(/\d+/g, '{}'), 'around the rig’s slip line').toBe(COPY.wage.slip.replace(/\{days\}|\{rate\}/g, '{}'));
  expect(today.text, 'Nib’s line carries the total too').toContain('64');
  expect(today.from, 'signed by the payroll desk').toBe(COPY.wage.from);
  expect(today.kraft, 'on kraft paper, not the cream sheet').toBe('rgb(217, 187, 142)');
  expect(old, 'the old slip is still a slip').not.toBeNull();
  expect(old.stamp, '…with the stamp').toBe(COPY.wage.stamp);
  expect(old.text, '…and its line').toContain('26');
  expect(old.rows, '…but no figures it never had').toBe(false);
  await page.screenshot({ path: 'test-results/homestead-payslip.png' });
  expect(errs, 'nothing threw').toEqual([]);
});
