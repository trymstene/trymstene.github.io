// 💼🎖 THE MOMENT YOU ARE HIRED (22 Sep 2026).
//
// Trym: *"When i ask a boss / store owner if i can work there - the dialogue window should close and there
// should be some sort of salute or splash text saying something about the job i get. And the dialogue popup
// should close first, then splash."*
//
// So the order is the whole test: the boss says yes in their own card (a character only speaks there,
// design library §18), the card closes BY ITSELF, and only then does the world celebrate — a burst over
// your banana and the big moment over the square (/css/world-moment.css, the rave's register) — and once
// that has gone up, one plain line says where the work is. Every word is the rig's (town-life `work`).
import { test, expect } from '@playwright/test';
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };

const seam = (page, fn, arg) => page.evaluate(fn, arg);
const stand = (page, x, y) => page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = t.tgt.x = px; t.pos.y = t.tgt.y = py; }, [x, y]);

async function toBean(page, w, h) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (w) await page.setViewportSize({ width: w, height: h });
  // a kept pass on the device, and the server's answer to the take stubbed: this walk is about the moment
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); localStorage.removeItem('tw-job-v1'); } catch (e) {} });
  await page.route('**/job/take', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, job: { at: 'cafe', week: '2026-W39', days: 0, pay: 0, duties: [], share: 0, sofar: 0, owed: 0, nudge: false, fired: null } }) }));
  await page.route('**/job/view', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, job: { at: 'cafe', week: '2026-W39', days: 0, pay: 0, duties: [], share: 0, sofar: 0, owed: 0 } }) }));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await seam(page, () => { window.__town.room.curse('none'); window.__town.life.set(12); });
  await page.waitForFunction(() => window.__town && window.__town.work && window.__town.work.ask && window.__town.work.bosses, null, { timeout: 20000 });
  await seam(page, () => window.__town.work.set({ at: '' }));
  // walk up to Bean and tap Bean, the way a player does
  const at = await seam(page, () => { const n = window.__town.life.residents().find((r) => r.key === 'bean'); return { x: n.x, y: n.y }; });
  await stand(page, at.x + 40, at.y + 20);
  await page.waitForFunction(() => { const e = document.querySelector('.tw-npc[data-k="bean"]'); return !!(e && !e.hidden && e.getBoundingClientRect().width); }, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const hit = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="bean"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 12 }; });
  await page.mouse.click(hit.x, hit.y);
  await page.waitForFunction((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].some((b) => b.textContent === q), LIFE.work.ask, { timeout: 10000 });
  return errors;
}
// the moment's clock, read in the page: when the card went away, and when the big words came up
const watch = (page) => page.evaluate(() => {
  const t0 = performance.now(), seen = { closed: 0, moment: 0, note: 0 };
  const panel = document.getElementById('twPanel');
  const tick = () => {
    if (!seen.closed && panel.hidden) seen.closed = performance.now() - t0;
    if (!seen.moment && document.querySelector('.wm-moment')) seen.moment = performance.now() - t0;
    const n = document.querySelector('.twd-chip');
    if (!seen.note && n && !n.hidden) seen.note = performance.now() - t0;   // 💼 when the work note first showed the job
    if (!seen.closed || !seen.moment || !seen.note) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__hiredSeen = seen;
});

for (const [w, h] of [[360, 640], [393, 852]]) {
  test(`asking to work: the boss says yes, the card closes itself, THEN the moment, at ${w}×${h}`, async ({ page }) => {
    const errors = await toBean(page, w, h);
    const fx0 = await seam(page, () => window.__town.fx());
    await watch(page);
    const q = await page.evaluateHandle((ask) => [...document.querySelectorAll('#twCardBody .wd-q button')].find((b) => b.textContent === ask), LIFE.work.ask);
    await q.asElement().click();
    // the boss's own yes, in the card, typed
    const hired = LIFE.work.hired.replace('{where}', LIFE.work.at.cafe);
    await page.waitForFunction((t) => (document.querySelector('#twCardBody .wd-box p') || {}).textContent === t, hired, { timeout: 8000 });
    // ⭐ then the card closes BY ITSELF — no tap
    await page.waitForFunction(() => document.getElementById('twPanel').hidden, null, { timeout: 6000 });
    // ⭐ and only then the moment
    await page.waitForSelector('.wm-moment', { timeout: 4000 });
    const seen = await seam(page, () => window.__hiredSeen);
    expect(seen.closed, 'the card closed').toBeGreaterThan(0);
    expect(seen.moment, '⭐ the dialogue closes FIRST, then the splash').toBeGreaterThan(seen.closed);
    // 💼 and the work note arrives WITH the hire, never under the boss's yes while it types (24 Sep 2026, the live job journey)
    await page.waitForFunction(() => window.__hiredSeen.note > 0, null, { timeout: 8000 });
    expect((await seam(page, () => window.__hiredSeen)).note, 'the note shows the job only once the card has closed').toBeGreaterThanOrEqual(seen.closed);
    const m = await page.evaluate(() => {
      const e = document.querySelector('.wm-moment'), v = document.getElementById('twView').getBoundingClientRect(), r = e.getBoundingClientRect();
      const b = e.querySelector('b');
      return { title: b.textContent, sub: (e.querySelector('small') || {}).textContent || '', font: getComputedStyle(b).fontFamily, tap: getComputedStyle(e).pointerEvents,
        inside: r.left >= v.left - 1 && r.right <= v.right + 1 && r.top >= v.top - 1, wide: r.width };
    });
    expect(m.title, 'the big word is the rig’s').toBe(LIFE.work.moment);
    expect(m.sub, 'and the line under it names the job’s place').toBe(LIFE.work.momentLine.replace('{where}', LIFE.work.at.cafe));
    expect(m.font, 'in the rave’s big-moment face').toContain('Anton');
    expect(m.tap, 'it never takes a tap — the world goes on under it').toBe('none');
    expect(m.inside, 'and it sits inside the world, not off the side of a phone').toBe(true);
    expect(await seam(page, () => window.__town.fx()), 'the salute: a burst went up over your banana').toBeGreaterThan(fx0);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `test-results/town-hired-${w}.png` });
    // …and once it has gone up, where the work is
    await page.waitForFunction((t) => (document.getElementById('twToast').textContent || '').trim() === t, LIFE.work.start.cafe, { timeout: 8000 });
    expect(await seam(page, () => window.__town.work.job()), 'and the job is yours').toMatchObject({ at: 'cafe' });
    expect(errors).toEqual([]);
  });
}

test('shutting the card during the yes still gives you the moment', async ({ page }) => {
  const errors = await toBean(page, 393, 852);
  const q = await page.evaluateHandle((ask) => [...document.querySelectorAll('#twCardBody .wd-q button')].find((b) => b.textContent === ask), LIFE.work.ask);
  await q.asElement().click();
  await page.waitForTimeout(250);
  await page.click('#twCardX');
  await page.waitForSelector('.wm-moment', { timeout: 4000 });
  expect(await page.locator('.wm-moment b').textContent(), 'the moment belongs to the job, not to how the card was shut').toBe(LIFE.work.moment);
  expect(errors).toEqual([]);
});

test('a boss who says no, or already has you, never sets off the moment', async ({ page }) => {
  const errors = await toBean(page, 393, 852);
  await seam(page, () => window.__town.work.set({ at: 'store' }));   // you work for Pip: Bean says you are his
  await seam(page, () => document.getElementById('twCardX').click());
  const hit = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="bean"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 12 }; });
  await page.mouse.click(hit.x, hit.y);
  await page.waitForFunction((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].some((b) => b.textContent === q), LIFE.work.ask, { timeout: 10000 });
  const q = await page.evaluateHandle((ask) => [...document.querySelectorAll('#twCardBody .wd-q button')].find((b) => b.textContent === ask), LIFE.work.ask);
  await q.asElement().click();
  await page.waitForTimeout(4000);
  expect(await page.locator('.wm-moment').count(), 'no moment for a no').toBe(0);
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden), 'and the card stays open for the next question').toBe(false);
  expect(errors).toEqual([]);
});

// 🚪 24 Sep 2026, Trym: "I click May i stop working here, and after the click it probably confirms, but i can still click May i stop
// working here. When i do that i just get an empty dialogue window". The goodbye ends the talk: the card closes by itself a beat
// after it, and the next time the question is not there to ask.
test('asking to stop working: the boss says goodbye, the card closes by itself, and the question is gone', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); localStorage.removeItem('tw-job-v1'); } catch (e) {} });
  await page.route('**/job/take', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, job: { at: '', week: '2026-W39', days: 0, pay: 0, duties: [], share: 0, sofar: 0, owed: 0, nudge: false, fired: null } }) }));
  await page.route('**/job/view', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, job: { at: 'cafe', week: '2026-W39', days: 1, pay: 0, duties: [], share: 0, sofar: 0, owed: 0 } }) }));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work, null, { timeout: 30000 });
  await seam(page, () => { window.__town.room.curse('none'); window.__town.life.set(12); });
  await seam(page, () => window.__town.work.set({ at: 'cafe' }));
  const tapBean = async () => {
    const at = await seam(page, () => { const n = window.__town.life.residents().find((r) => r.key === 'bean'); return { x: n.x, y: n.y }; });
    await stand(page, at.x + 40, at.y + 20);
    await page.waitForFunction(() => { const e = document.querySelector('.tw-npc[data-k="bean"]'); return !!(e && !e.hidden && e.getBoundingClientRect().width); }, null, { timeout: 15000 });
    await page.waitForTimeout(400);
    const hit = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="bean"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 12 }; });
    await page.mouse.click(hit.x, hit.y);
    await page.waitForSelector('#twCardBody .wd-q button', { timeout: 10000 });
  };
  await tapBean(page);
  await page.evaluate((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].find((b) => b.textContent === q).click(), LIFE.work.quit);
  await page.waitForFunction((t) => (document.querySelector('#twCardBody .wd-box p') || {}).textContent === t, LIFE.work.quitDone, { timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('twPanel').hidden, null, { timeout: 5000 });   // ⭐ by itself
  expect(await seam(page, () => window.__town.work.job().at), 'the job is let go').toBe('');
  await tapBean(page);
  const qs = await page.evaluate(() => [...document.querySelectorAll('#twCardBody .wd-q button')].map((b) => b.textContent));
  expect(qs, 'nothing left to quit').not.toContain(LIFE.work.quit);
  expect(errors).toEqual([]);
});
