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

// 👻 THE BIG ONE (3 Oct 2026). Trym: "taking out / walking on ghosts should reward much XP, we dont have some big XP reward
// stuff at the moment". His call: the day's first ghost pays XP_PAY.town.ghostDay, every other ghost XP_PAY.town.ghost, each
// once a day — and a ghost walked into again pays nothing (it forms again a few seconds after a catch)
test('ghosts: the day’s first pays big, the next ghost a solid 250, and the same ghost again nothing', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  const errs = await town(page);
  await page.evaluate(() => window.__town.life.set(21));   // the town's own night: the whole company is out
  const ghost = (id) => page.evaluate((k) => (window.__town.room.ghosts() || []).find((g) => g.id === k && !g.hidden) || null, id);
  const onto = (g) => page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [g.x, g.y]);
  const away = () => page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 1360; t.pos.y = t.tgt.y = 880; });   // a measured empty spot
  await away();
  await expect.poll(() => ghost('sit'), { timeout: 30000, message: 'the sitting ghost is out' }).not.toBeNull();
  const before = await rep(page);
  await onto(await ghost('sit'));
  await expect.poll(() => rep(page), { timeout: 3000, message: 'the day’s first ghost' }).toBe(before + XP_PAY.town.ghostDay);
  await away();
  await expect.poll(() => ghost('roam'), { timeout: 30000, message: 'the roamer is out' }).not.toBeNull();
  await onto(await ghost('roam'));   // it keeps 110 from a banana: the banana stands where it is
  await expect.poll(() => rep(page), { timeout: 3000, message: 'another ghost' }).toBe(before + XP_PAY.town.ghostDay + XP_PAY.town.ghost);
  await away();
  await expect.poll(() => ghost('sit'), { timeout: 15000, message: 'the sitting ghost forms again' }).not.toBeNull();
  await onto(await ghost('sit'));
  await expect.poll(() => page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_ghost' && e[1] && e[1].caught && e[1].id === 'sit').length), { timeout: 3000, message: 'caught again' }).toBe(2);
  await page.waitForTimeout(600);
  expect(await rep(page), 'the same ghost twice in a day pays once').toBe(before + XP_PAY.town.ghostDay + XP_PAY.town.ghost);
  expect(errs).toEqual([]);
});

// 🗑 THE STREET'S MESS PAYS A LITTLE MORE (3 Oct 2026, Trym: "picking up trash in the park and in town can also reward a little
// bit more"): litter walked over pays XP_PAY.town.flyer for the first flyersPerDay of a day on a device, then 1 — a reload lays
// the street's litter again — and a litter problem put right pays XP_PAY.town.litter
test('street litter pays a little more for the first few dozen of a day, then 1; a litter problem put right pays more too', async ({ page }) => {
  const errs = await town(page);
  const d = Math.floor(Date.now() / 864e5);
  await page.evaluate(([day, n]) => localStorage.setItem('tw-litxp-v1', JSON.stringify({ d: day, n })), [d, XP_PAY.town.flyersPerDay - 1]);
  const fl = await page.evaluate(() => window.__town.life.flyers());
  expect(fl.length, 'litter on the street').toBeGreaterThan(1);
  const before = await rep(page);
  await page.evaluate((i) => window.__town.life.pick(i), fl[0].i);
  await expect.poll(() => rep(page), { message: 'the day’s last raised piece' }).toBe(before + XP_PAY.town.flyer);
  await page.evaluate((i) => window.__town.life.pick(i), fl[1].i);
  await expect.poll(() => rep(page), { message: 'past the day’s few dozen, 1 as before' }).toBe(before + XP_PAY.town.flyer + 1);
  const mid = await rep(page);
  const id = await page.evaluate(() => window.__town.room.plant('litter', [1360, 880]));
  expect(id, 'a litter problem planted').toBeTruthy();
  await page.evaluate((k) => window.__town.room.fix(k), id);
  await expect.poll(() => rep(page), { message: 'a litter problem put right' }).toBe(mid + XP_PAY.town.litter);
  expect(errs).toEqual([]);
});

test('park: a piece of litter cleared pays the raised amount', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(/googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  await page.routeWebSocket(/workers\.dev/, () => {});
  await page.addInitScript(() => { try { localStorage.setItem('tt-internal', '1'); localStorage.setItem('cookie-consent-v1', 'n'); localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); } catch (e) {} });
  await page.goto('/park/?parktest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__park && window.__park.litter && window.__park.warp), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const at = await page.evaluate(() => ({ x: Math.round(window.__park.pos.x), y: Math.round(window.__park.pos.y) }));
  await page.evaluate(() => window.__park.litter(1));   // a piece 80 px ahead of the banana
  await page.waitForTimeout(400);
  const before = await rep(page);
  await page.evaluate(([x, y]) => window.__park.warp(x, y), [at.x + 80, at.y + 6]);
  await expect.poll(() => rep(page), { timeout: 3000, message: 'the litter cleared' }).toBe(before + XP_PAY.park.trash);
  expect(errs).toEqual([]);
});
