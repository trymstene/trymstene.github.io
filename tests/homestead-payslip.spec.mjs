// 📄 THE PAYSLIP (22 Sep 2026; docs/town-jobs-plan.md §11.3, §12). Trym: *"the paycheck should have a different
// color paper or look or envelope style visual for when you get paid … the user gets the reasoning in the
// payslip why the pay is lower this time if they havent done much."*
//
// The wage letter in the homestead mailbox is a payslip: kraft paper, a rubber stamp, Nib's line, and the
// figures printed under it — the workplace, the week's counts duty by duty, the share of the rate they came
// to, the total with its coin. All words are the rig's; the numbers are what /job/pay dropped in the row.
// A slip delivered before the counts existed keeps its line and prints no figures. And the boss's own
// letters land in the same box: the Thursday nudge, and the goodbye.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'homestead-post.json'), 'utf8'));
const DUTY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-duties.json'), 'utf8'));

test('a cheque in the box is a payslip with the week’s counts and the share; the boss writes too', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.mail, null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.slug('my-yard'));
  // this week's slip with its counts, one from before the counts existed, and the boss's two letters
  await page.evaluate(() => {
    window.__hs.mail({ id: 'wage:2026-W37:condo', n: 30, d: 4, at: 'condo', r: 60, share: 0.5, duties: [{ kind: 'sweep', done: 2, of: 3 }, { kind: 'fix', done: 1, of: 3 }] });
    window.__hs.mail({ id: 'wage:2026-W36:store', n: 26 });
    window.__hs.mail({ id: 'nudge:2026-W38:condo', at: 'condo' });
    window.__hs.mail({ id: 'fired:2026-W38:store', at: 'store' });
  });
  await page.evaluate(() => window.__hs.post());
  await page.waitForSelector('.bw-paper--wage', { timeout: 10000 });
  const papers = await page.evaluate(() => [...document.querySelectorAll('.bw-paper')].map((p) => ({
    wage: p.classList.contains('bw-paper--wage'),
    stamp: (p.querySelector('.bw-slip__stamp') || {}).textContent || '',
    at: (p.querySelector('.bw-slip__at') || {}).textContent || '',
    duties: [...p.querySelectorAll('.bw-slip__duty')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()),
    terms: (p.querySelector('.bw-slip__terms') || {}).textContent || '',
    total: (p.querySelector('.bw-slip__total b') || {}).textContent || '',
    rows: !!p.querySelector('.bw-slip__rows'),
    text: p.textContent,
    kraft: getComputedStyle(p).backgroundColor,
    from: (p.querySelector('.bw-paper__from') || {}).textContent || '',
  })));
  const slips = papers.filter((p) => p.wage);
  expect(slips.length, 'both slips are in the box').toBe(2);
  const today = slips.find((s) => s.rows), old = slips.find((s) => !s.rows);
  expect(today, 'this week’s slip prints its figures').toBeTruthy();
  expect(today.stamp, 'the stamp is the rig’s word, in capitals').toBe(COPY.wage.stamp);
  expect(today.at, 'the workplace, as the rig prints it').toBe(COPY.wage.at.condo);
  expect(today.duties, 'the week’s counts, duty by duty, with the rig’s labels').toEqual([DUTY.kinds.sweep + ' 2/3', DUTY.kinds.fix + ' 1/3']);
  expect(today.terms, 'the share of the rate they came to').toContain('50%');
  expect(today.terms, '…and the rate').toContain('60');
  expect(today.terms.replace(/\d+%|\d+/g, '{}'), 'around the rig’s share line').toBe(COPY.wage.slip.replace(/\{pct\}|\{rate\}/g, '{}'));
  expect(today.total, 'the total with its coin').toBe('30');
  expect(today.text, 'Nib’s line carries the total too').toContain('30');
  expect(today.from, 'signed by the payroll desk').toBe(COPY.wage.from);
  expect(today.kraft, 'on kraft paper, not the cream sheet').toBe('rgb(217, 187, 142)');
  expect(old, 'the old slip is still a slip').toBeTruthy();
  expect(old.stamp, '…with the stamp').toBe(COPY.wage.stamp);
  expect(old.rows, '…but no figures it never had').toBe(false);
  // the boss's letters: Spinner asking, Pip saying goodbye — on the ordinary cream paper, in their own hand
  const nudgeText = COPY.bosses.nudge.condo.line.split('{home}')[0].trim().slice(0, 24);
  const nudge = papers.find((p) => !p.wage && p.text.includes(nudgeText));
  expect(nudge, 'Spinner’s Thursday letter is in the box').toBeTruthy();
  expect(nudge.from, 'signed by Spinner').toBe(COPY.bosses.nudge.condo.from);
  const fired = papers.find((p) => !p.wage && p.text.includes(COPY.bosses.fired.store.line.split('{home}')[0].trim().slice(0, 24)));
  expect(fired, 'Pip’s goodbye is in the box').toBeTruthy();
  expect(fired.from, 'signed by Pip').toBe(COPY.bosses.fired.store.from);
  await page.waitForTimeout(700);   // the papers unfold for 0.4 s; the picture is of the settled box
  await page.evaluate(() => { const r = document.querySelector('.bw-slip__rows'); if (r) r.scrollIntoView({ block: 'center' }); });   // …with the figures in frame
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/homestead-payslip.png' });
  expect(errs, 'nothing threw').toEqual([]);
});
