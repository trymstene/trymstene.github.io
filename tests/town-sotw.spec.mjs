// 🏆 STAFF OF THE WEEK, TOLD BY YOUR BOSS (24 Sep 2026; docs/town-jobs-plan.md §25). Trym: "we can build the logic for staff for
// the week, but implement it visually later". The server crowns on Monday's lap and the job view says `sotw: { last, weeks }`.
// The telling needs no new art — it is the promotion's own grammar: the work note says the boss has news, the boss's card
// leads with it, the boss says it in their voice, the card closes by itself, and STAFF OF THE WEEK goes up over the square.
// Told once a crown; the staff card keeps the count. (The plaque by each shop is Trym's call on the look — not here.)
import { test, expect } from '@playwright/test';
import STAFF from '../src/data/copy/town-staff.json' with { type: 'json' };
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };

const stand = (page, x, y) => page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = t.tgt.x = px; t.pos.y = t.tgt.y = py; }, [x, y]);
const job = (sotw) => ({ at: 'cafe', week: '2026-W41', days: 2, pay: 0, duties: [], share: 0, sofar: 0, owed: 0, nudge: false, fired: null, sotw, lad: { xp: 120, rank: 1, today: 0 } });

async function town(page, sotw) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); localStorage.removeItem('tw-job-v1'); localStorage.removeItem('tw-sotw-v1'); } catch (e) {} });
  await page.route('**/job/view', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, job: job(sotw) }) }));
  await page.route('**/job/chore', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) }));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(12); });
  await page.evaluate((s) => window.__town.work.set({ at: 'cafe', week: '2026-W41', sotw: s, lad: { xp: 120, rank: 1, today: 0 } }), sotw);
  await page.waitForFunction(() => !!window.__town.work.words(), null, { timeout: 10000 });
  expect(await page.evaluate(() => window.__town.staffReady())).toBe(true);
  return errs;
}
async function tapBean(page) {
  const at = await page.evaluate(() => { const n = window.__town.life.residents().find((r) => r.key === 'bean'); return { x: n.x, y: n.y }; });
  await stand(page, at.x + 40, at.y + 20);
  await page.waitForFunction(() => { const e = document.querySelector('.tw-npc[data-k="bean"]'); return !!(e && !e.hidden && e.getBoundingClientRect().width); }, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const hit = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="bean"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 12 }; });
  await page.mouse.click(hit.x, hit.y);
  await page.waitForSelector('#twCardBody .wd-q button', { timeout: 10000 });
}
const questions = (page) => page.evaluate(() => [...document.querySelectorAll('#twCardBody .wd-q button')].map((b) => b.textContent));

test('last week’s staff of the week hears it from Bean: the note, the card, the line, then the moment — once', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page, { last: true, weeks: 1 });

  // ── the note says Bean has news, the staff card says the same, and counts the crown
  await page.waitForFunction((l) => window.__town.duties.line() === l, STAFF.news.cafe, { timeout: 8000 });
  await page.evaluate(() => window.__town.staffOpen('cafe', 'note'));
  await page.waitForSelector('.tws', { timeout: 8000 });
  const cardText = await page.locator('.tws').innerText();
  expect(cardText).toContain(STAFF.news.cafe);
  expect(cardText, 'the card keeps the count').toContain(STAFF.sotwCardOne);
  await page.locator('.tw-card').screenshot({ path: 'test-results/town-sotw-card.png' });
  await page.evaluate(() => { const x = document.getElementById('twCardX'); if (x) x.click(); });

  // ── Bean's card leads with it; Bean says it; the card closes by itself; then the moment
  await tapBean(page);
  expect((await questions(page))[0], 'the news is the first thing you can ask').toBe(STAFF.promoQ);
  await page.evaluate((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].find((b) => b.textContent === q).click(), STAFF.promoQ);
  await page.waitForFunction((t) => (document.querySelector('#twCardBody .wd-box p') || {}).textContent === t, STAFF.sotw.bean, { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('twPanel').hidden, null, { timeout: 8000 });
  await page.waitForSelector('.wm-moment', { timeout: 5000 });
  expect(await page.locator('.wm-moment b').textContent()).toBe(STAFF.sotwMoment);
  expect(await page.locator('.wm-moment small').textContent()).toBe(STAFF.sotwLine.replace('{where}', LIFE.work.at.cafe));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/town-sotw-moment.png' });

  // ── told: the note is back to the job, and Bean has no news the next time
  await page.waitForFunction((l) => window.__town.duties.line() !== l, STAFF.news.cafe, { timeout: 8000 });
  await page.waitForTimeout(2500);
  await tapBean(page);
  expect(await questions(page), 'told once').not.toContain(STAFF.promoQ);
  expect(errs).toEqual([]);
});

test('a crown won again says how many weeks, on the moment and on the card', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page, { last: true, weeks: 3 });
  await page.evaluate(() => window.__town.moment.crowned('cafe', 3));
  await page.waitForSelector('.wm-moment', { timeout: 5000 });
  expect(await page.locator('.wm-moment small').textContent()).toBe(STAFF.sotwAgain.replace('{n}', '3').replace('{where}', LIFE.work.at.cafe));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__town.staffOpen('cafe', 'note'));
  await page.waitForSelector('.tws', { timeout: 8000 });
  expect(await page.locator('.tws').innerText()).toContain(STAFF.sotwCard.replace('{n}', '3'));
  expect(errs).toEqual([]);
});

test('no crown, no news: a worker who was not staff of the week hears nothing of it', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page, { last: false, weeks: 0 });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__town.duties.line())).not.toBe(STAFF.news.cafe);
  await tapBean(page);
  expect(await questions(page)).not.toContain(STAFF.promoQ);
  expect(errs).toEqual([]);
});
