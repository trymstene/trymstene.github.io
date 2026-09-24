// 💼 PAYDAY REACHES EVERY WORKER, AND A CALL COMES BEFORE THE PAYSLIP (24 Sep 2026, the job QA).
//
// The cheque is collected by the homestead's mailbox (banana-homestead.js wageCheck → /job/pay). A worker with no claimed
// homestead was told "go home and open your payslip" — and was never paid; the week fell away after two. The town now pays
// such a worker itself, the first time it sees a finished week owing, and says so in one line. A worker WITH a homestead
// keeps the payslip ritual, and the note says so — but an open call is today's, so the note shows it first.
import { test, expect } from '@playwright/test';
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };
import DUTY from '../src/data/copy/town-duties.json' with { type: 'json' };

const job = (owed) => ({ at: 'store', week: '2026-W40', days: 0, pay: 150, sofar: 0, owed, duties: [{ kind: 'restock', done: 0, of: 3 }, { kind: 'serve', done: 0, of: 3 }], share: 0, nudge: false, fired: null, lad: { xp: 40, rank: 1, today: 0 } });
async function town(page, { home, called }) {
  const errs = [], pays = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(([h, c]) => {
    try {
      localStorage.setItem('pass-link', JSON.stringify({ credId: 'm:qa', token: 't' }));
      localStorage.setItem('tw-job-v1', JSON.stringify({ at: 'store', owed: 150 }));
      if (h) localStorage.setItem('hs-v1', JSON.stringify({ claimedAt: Date.now() - 864e5, slug: 'testy' }));
      if (c) localStorage.setItem('tw-calls-v1', JSON.stringify({ d: Math.floor(Date.now() / 864e5), t0: Date.now() - 36e5, h: 'store' }));
    } catch (e) {}
  }, [home, called]);
  await page.route('**/job/view', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, job: job(150) }) }));
  await page.route('**/job/pay', (r) => { pays.push(1); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, total: 150, paid: [{ week: '2026-W40', at: 'store', coins: 150, pay: 150 }], job: job(0) }) }); });
  await page.route('**/job/chore', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) }));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work, null, { timeout: 30000 });
  return { errs, pays };
}
const note = (page) => page.evaluate(() => { const n = document.querySelector('.twd-chip'); return n && !n.hidden ? n.innerText.replace(/\s+/g, ' ') : ''; });

test('a worker with no homestead is paid in the town, and told so once', async ({ page }) => {
  const s = await town(page, { home: false, called: false });
  await page.waitForFunction((l) => (document.getElementById('twToast').textContent || '').trim() === l, LIFE.work.paidHere.replace('{coins}', '150'), { timeout: 15000 });
  expect(s.pays.length, 'the wage was collected once').toBe(1);
  expect(await note(page), 'and nothing sends them to a homestead they do not have').not.toContain(DUTY.payslip);
  await page.screenshot({ path: 'test-results/town-payday-paid-here.png' });
  expect(s.errs).toEqual([]);
});

test('a worker with a homestead keeps the payslip: the note sends them home, and the town does not pay', async ({ page }) => {
  const s = await town(page, { home: true, called: false });
  await page.waitForFunction((l) => { const n = document.querySelector('.twd-chip'); return !!n && n.innerText.includes(l.slice(0, 24)); }, DUTY.payslip, { timeout: 15000 });
  await page.waitForTimeout(1500);
  expect(s.pays.length, 'the homestead collects it, not the town').toBe(0);
  expect(s.errs).toEqual([]);
});

test('an open call comes before the payslip on the note: it is today’s, the payslip waits', async ({ page }) => {
  const s = await town(page, { home: true, called: true });
  await page.waitForFunction((l) => { const n = document.querySelector('.twd-chip'); return !!n && n.innerText.includes(l.slice(0, 24)); }, DUTY.call.restock, { timeout: 15000 });
  expect(await note(page)).not.toContain(DUTY.payslip.slice(0, 24));
  await page.screenshot({ path: 'test-results/town-payday-call-first.png' });
  expect(s.errs).toEqual([]);
});
