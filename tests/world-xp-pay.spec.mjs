// ✨ EVERY AREA PAYS WORLD XP (2 Oct 2026, the endgame plan's step 1c; the numbers are src/data/xp-pay.js). The town was
// paying 20–40 XP an hour of play, because its own loops — the jobs, the Wheel of Peel — paid nothing at all. This walk
// plays two of them against the pass worker's answers (played here, never real) and reads the XP on the pass.
import { test, expect } from '@playwright/test';
import { XP_PAY } from '../src/data/xp-pay.js';

const json = (o) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const rep = (page) => page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('pass-v1') || 'null') || {};
  return (+((p.base || {}).rep) || 0) + Object.values((p.led || {}).rep || {}).reduce((a, b) => a + (+b || 0), 0);
});

async function town(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(/googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  await page.routeWebSocket(/workers\.dev/, () => {});
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); localStorage.removeItem('tw-job-v1'); } catch (e) {} });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(12); });
  await page.waitForTimeout(400);
  return errs;
}

test('a turn of the Wheel of Peel pays world XP as the wheel stops', async ({ page }) => {
  await page.route('**/town/wheel', (r) => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.view) return r.fulfill(json({ ok: true, pot: 50, next: 'free', left: 30, cost: 3, wallet: { bal: 40, seq: 9 }, seen: [], slots: {} }));
    return r.fulfill(json({ ok: true, i: 0, id: 'peel', kind: 'free', coins: 0, item: '', full: false, pot: 50, next: 'paid', left: 30, wallet: { bal: 40, seq: 10 }, seen: [], slots: {} }));
  });
  const errs = await town(page);
  const before = await rep(page);
  await page.evaluate(() => window.__town.open('wheel'));
  await page.waitForFunction(() => /\d/.test((document.getElementById('twPot') || {}).textContent || ''), null, { timeout: 10000 });
  await page.locator('#twSpin').click();
  expect(await rep(page), 'nothing before the wheel stops (§30.2)').toBe(before);
  await page.waitForFunction(() => /\S/.test((document.getElementById('twSpinRes') || {}).textContent || ''), null, { timeout: 8000 });
  await expect.poll(() => rep(page), { timeout: 2000 }).toBe(before + XP_PAY.town.spin);
  expect(errs).toEqual([]);
});

test('a shift pays world XP: twice the Work XP the server counted, and nothing when it counted none', async ({ page }) => {
  const lad = { xp: 0, rank: 1, today: 0, news: false };
  const job = (l) => ({ at: 'condo', week: '2026-W40', days: 1, pay: 0, duties: [], share: 0, sofar: 0, owed: 0, nudge: false, fired: null, lad: l });
  let counted = 45;
  await page.route('**/job/view', (r) => r.fulfill(json({ ok: true, job: job(lad) })));
  await page.route('**/job/chore', (r) => r.fulfill(json({ ok: true, counted: true, xp: counted, job: job({ ...lad, xp: counted, today: counted }) })));
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'condo' }));
  await page.waitForTimeout(300);
  const before = await rep(page);
  await page.evaluate(() => window.__town.work.chore('sweep'));
  await expect.poll(() => rep(page), { timeout: 3000 }).toBe(before + 45 * XP_PAY.town.workMul);
  // the day's cap reached: the server counts nothing, and nothing is paid
  counted = 0;
  const mid = await rep(page);
  await page.evaluate(() => window.__town.work.chore('sweep'));
  await page.waitForTimeout(800);
  expect(await rep(page), 'a capped verb pays no world XP').toBe(mid);
  expect(errs).toEqual([]);
});
