// 🛒 THE STORE'S CUSTOMERS (23 Sep 2026; the job ladder's slice 2 — Trym: "do the store's customer requests next").
//
// On a day the town calls for it, customers come into Pip's store while its staff are inside: one WALKS up to the counter
// and wants a thing off the shelves. What they want GLOWS on its shelf (the tray keeps only its name and the wait), the
// worker takes it — it rides their right hand — and gives it to the CUSTOMER (a lit square stands under them while you
// carry), and the customer walks out: a customer on the week's sheet. 24 Sep 2026, Trym testing it: the stiff slide, the
// white squares round the wares, the tray's tiny icon, the word "till" and the thing on the belly are all gone. Played
// here with real taps on the store's own plate, the way a thumb plays it.
import { test, expect } from '@playwright/test';
import SERVE from '../src/data/copy/town-serve.json' with { type: 'json' };
import DUTY from '../src/data/copy/town-duties.json' with { type: 'json' };
import { DAY_XP, xpFor } from '../src/data/town/jobs.js';

const DAY = () => Math.floor(Date.now() / 86400000);

async function town(page, width) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  await page.setViewportSize({ width: width || 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(96); window.__town.life.set(11); });   // thriving: every face stocked
  await page.waitForTimeout(700);
  return errs;
}
// the day's calls, pinned: the customers' call, in already
const pin = (page, kinds, learnt = true) => page.evaluate(([k, d, l]) => { localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: k })); localStorage.removeItem('tw-serve-v1'); if (l) localStorage.setItem('tw-once-v1', JSON.stringify({ 'serve:learn': 1 })); else localStorage.removeItem('tw-once-v1'); }, [kinds, DAY(), learnt]);
// a real tap on the customer themselves — their body, the middle of it, the way a thumb gives a thing to somebody
async function tapCust(page) {
  const p = await page.evaluate(() => {
    const c = window.__town.serve.want(), w = document.getElementById('twWorld'), sc = parseFloat(w.style.getPropertyValue('--ws')), r = w.getBoundingClientRect();
    return { x: r.left + c.x * sc, y: r.top + (c.y - 40) * sc };
  });
  await page.mouse.click(p.x, p.y);
}
const want = (page) => page.evaluate(() => window.__town.serve && window.__town.serve.want());
const toast = (page, line) => page.waitForFunction((l) => (document.getElementById('twToast').textContent || '').trim() === l, line, { timeout: 8000 });
const chores = (page) => page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_chore').map((e) => e[1]));
// a real tap on a fitting of the store, at the middle of its box — only if it is on screen, because a thumb can only tap what it sees
async function tapSpot(page, key) {
  const p = await page.evaluate((k) => {
    const s = window.__town.rooms.of('store').spots.find((q) => q[0] === k);
    const w = document.getElementById('twWorld'), sc = parseFloat(w.style.getPropertyValue('--ws')), r = w.getBoundingClientRect(), v = document.getElementById('twView').getBoundingClientRect();
    const o = { x: r.left + ((s[1] + s[3]) / 2) * sc, y: r.top + ((s[2] + s[4]) / 2) * sc };
    o.on = o.x > v.left && o.x < v.right && o.y > v.top && o.y < v.bottom;
    return o;
  }, key);
  expect(p.on, key + ' is on screen').toBe(true);
  await page.mouse.click(p.x, p.y);
}
const faceOfItem = (page, id) => page.evaluate((i) => { const s = window.__town.room.shelf(), f = window.__town.rooms.of('store').full; return f[s.indexOf(i)][0]; }, id);

test('a customer walks up to the counter and wants a thing: it glows on the shelf, you carry it in your hand, give it to them, and the week counts it', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await town(page);

  // ── a customer of the store sees no customers and no tickets: they are the staff's work
  await page.evaluate(() => window.__town.work.set({ at: '' }));
  await pin(page, ['serve']);
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForTimeout(5000);   // longer than the pause before the first customer
  expect(await want(page), 'nobody waits for a shopper').toBeFalsy();
  expect(await page.locator('.tw-serve__tag').count(), 'no tickets on the shelves').toBe(0);
  await page.evaluate(() => window.__town.rooms.exit());

  // ── the staff walk in on a customers' day: a moment later somebody comes in and walks to the till
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  await pin(page, ['serve']);
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.call.serve, { timeout: 5000 });
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => { const w = window.__town.serve && window.__town.serve.want(); return w && w.waiting; }, null, { timeout: 10000 });
  const w1 = await want(page);
  const shelf = await page.evaluate(() => window.__town.room.shelf());
  expect(shelf, 'what they want is on the shelves').toContain(w1.id);
  expect(w1.basket, '🧺 a first-rank shop assistant never gets a basket (the store’s rank 2)').toBe(false);
  const tray = await page.evaluate(() => window.__town.serve.tray());
  expect(tray.shown, '🎟 the ticket is up').toBe(true);
  expect(tray.name, 'with the thing’s name on it').toBeTruthy();
  expect(await page.locator('.tw-serve__want img').count(), 'no picture on the tray: the shelf is the pointer (Trym: "better than adding more icons")').toBe(0);
  expect(await page.evaluate(() => window.__town.serve.glowing()), 'what they want glows on its shelf — and only that').toEqual([w1.face]);
  expect(w1.frame, 'they walked in and now stand facing you').toBe(2);
  expect(tray.note, 'and what to do').toBe(SERVE.find);
  expect(await page.evaluate(() => document.getElementById('twToast').hidden), 'the store’s welcome gave way to the ticket: nothing sits on the shelves').toBe(true);
  const tags = await page.evaluate(() => window.__town.serve.tags());
  expect(tags.length, 'every stocked face wears a picture of what is on it').toBe(shelf.length);
  expect(tags, 'the right one among them').toContain(w1.face);
  const card = await page.evaluate(() => { const t = getComputedStyle(document.querySelector('.tw-serve__tag')); return { bg: t.backgroundColor, border: t.borderTopWidth }; });
  expect(card, 'the thing itself, no white card round it').toEqual({ bg: 'rgba(0, 0, 0, 0)', border: '0px' });
  // ⚠️ and painted OVER the goods on its face: under the shelf's own sprite a ticket is there and nobody sees it
  const buried = await page.evaluate(() => [...document.querySelectorAll('.tw-serve__tag')].filter((t) => {
    const b = t.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, z = +t.style.zIndex;
    return [...document.querySelectorAll('#twWorld .tw-state')].some((s) => { const r = s.getBoundingClientRect(); return x > r.left && x < r.right && y > r.top && y < r.bottom && +s.style.zIndex >= z; });
  }).map((t) => t.dataset.face));
  expect(buried, 'no ticket hidden under its shelf’s goods').toEqual([]);
  expect(await page.locator('.tw-cup--serve .tw-cup__fill').evaluate((e) => getComputedStyle(e).backgroundImage), 'plenty of time: the bar is green').toContain('rgb(123, 195, 94)');
  await page.screenshot({ path: 'test-results/serve-customer.png' });

  // ── the wrong face: the banana walks there and finds the picture does not match — said on the ticket, where the eyes are
  const wrong = await page.evaluate((id) => { const s = window.__town.room.shelf(), f = window.__town.rooms.of('store').full; const i = s.findIndex((x) => x !== id); return f[i][0]; }, w1.id);
  await tapSpot(page, wrong);
  await page.waitForFunction((l) => window.__town.serve.tray().note === l, SERVE.wrong, { timeout: 8000 });
  expect(await page.evaluate(() => window.__town.serve.carrying()), 'nothing in hand').toBe('');

  // ── the till with empty hands: the ticket says what to do again
  await tapSpot(page, 'till');
  await page.waitForFunction((l) => window.__town.serve.tray().note === l, SERVE.find, { timeout: 8000 });

  // ── the right face: it is in the banana's hands
  await tapSpot(page, await faceOfItem(page, w1.id));
  await page.waitForFunction((id) => window.__town.serve.carrying() === id, w1.id, { timeout: 10000 });
  expect((await page.evaluate(() => window.__town.serve.tray())).note, 'the ticket says where to next').toBe(SERVE.got);
  expect(await page.locator('.tw-serve__held.is-in').count(), 'one thing in hand').toBe(1);
  const hand = await page.evaluate(() => { const h = document.querySelector('.tw-serve__held').getBoundingClientRect(), m = document.querySelector('.tw-me').getBoundingClientRect(); return { held: h.left + h.width / 2, me: m.left + m.width / 2, top: h.top, meTop: m.top, meBottom: m.bottom }; });
  expect(hand.held, 'in the RIGHT hand, not on the belly').toBeGreaterThan(hand.me + 8);
  expect(hand.top > hand.meTop && hand.top < hand.meBottom, 'at the height of a hand').toBe(true);
  expect(await page.evaluate(() => window.__town.serve.glowing()), 'what you hold no longer glows').toEqual([]);
  expect(await page.evaluate(() => window.__town.serve.spot()), 'a lit square under the customer: bring it here').toBe(true);
  await page.screenshot({ path: 'test-results/serve-carrying.png' });

  // ── the customer themselves: handed over, they walk out, the sheet and the XP move
  await tapCust(page);
  await page.waitForFunction(() => window.__town.serve.served() === 1, null, { timeout: 10000 });
  const c1 = (await chores(page)).find((c) => c.kind === 'serve');
  expect(c1, 'Pulse hears a customer served').toMatchObject({ at: 'store', kind: 'serve' });
  expect([1, 2], 'with the grade the wait earned').toContain(c1.g);
  await toast(page, SERVE.served[c1.g === 2 ? 'perfect' : 'fine']);
  expect(await want(page), 'they have gone').toBeFalsy();
  expect(await page.evaluate(() => window.__town.serve.leaving()), 'walking back out of the door').toBe(1);
  expect(await page.evaluate(() => window.__town.serve.spot()), 'and the square comes down').toBe(false);
  expect(await page.evaluate(() => window.__town.serve.carrying()), 'hands empty').toBe('');
  expect(await page.locator('.tw-serve__tag').count(), 'the tickets come down with them').toBe(0);
  expect(await page.evaluate(() => window.__town.serve.tray().shown), 'and the ticket').toBe(false);
  const st = await page.evaluate(() => window.__town.work.state());
  expect(st.duties.map((d) => d.kind + ':' + d.done + '/' + d.of), 'a customer on the week’s sheet').toEqual(['restock:0/3', 'serve:1/3']);
  expect(await page.evaluate(() => window.__town.work.ladder().xp), 'the day’s ten and the customer’s XP by the grade').toBe(DAY_XP + xpFor('store', 'serve', c1.g));
  expect(await page.evaluate(() => window.__town.duties.line()), 'the call wants one more').toBe(DUTY.call.serve);

  // ── the next one is left waiting too long: they give up and go, and nothing counts
  await page.evaluate(() => window.__town.serve.arriveNow());
  await page.waitForFunction(() => { const w = window.__town.serve.want(); return w && w.waiting; }, null, { timeout: 10000 });
  await page.evaluate(() => window.__town.serve.age(12000));
  await page.waitForFunction(() => document.querySelector('.tw-cup--serve').classList.contains('is-late'), null, { timeout: 3000 });
  expect(await page.locator('.tw-cup--serve .tw-cup__fill').evaluate((e) => getComputedStyle(e).backgroundImage), 'past the quick share: the bar is amber').toContain('rgb(232, 144, 42)');
  await page.screenshot({ path: 'test-results/serve-late.png' });   // the bar has gone amber
  await page.evaluate(() => window.__town.serve.age(30000));
  await toast(page, SERVE.late);
  expect(await page.evaluate(() => window.__town.serve.served()), 'nothing counted').toBe(1);
  expect((await chores(page)).map((c) => c.kind), 'Pulse hears the one who gave up').toEqual(['serve', 'miss']);

  // ── "Not now": the customer goes and nobody else comes while the worker is inside
  await page.evaluate(() => window.__town.serve.arriveNow());
  await page.waitForFunction(() => { const w = window.__town.serve.want(); return w && w.waiting; }, null, { timeout: 10000 });
  await page.click('.tw-cup--serve .tw-cup__leave');
  expect(await want(page), 'turned away').toBeFalsy();
  await page.waitForTimeout(5500);   // longer than the gap between customers
  expect(await want(page), 'and nobody else comes in while you are busy with other things').toBeFalsy();
  expect((await chores(page)).map((c) => c.kind), 'Pulse hears it').toEqual(['serve', 'miss', 'away']);

  // ── back in through the door: customers come again, and the second one served answers the day's call
  await page.evaluate(() => window.__town.rooms.exit());
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => { const w = window.__town.serve.want(); return w && w.waiting; }, null, { timeout: 10000 });
  const w2 = await want(page);
  await tapSpot(page, await faceOfItem(page, w2.id));
  await page.waitForFunction((id) => window.__town.serve.carrying() === id, w2.id, { timeout: 10000 });
  await tapSpot(page, 'till');
  await page.waitForFunction(() => window.__town.serve.served() === 2, null, { timeout: 10000 });
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.answered, { timeout: 5000 });
  await page.waitForTimeout(5000);   // the entrance pause and more
  expect(await want(page), 'the call is answered: no more customers today').toBeFalsy();
  expect((await page.evaluate(() => window.__town.work.state())).duties.find((d) => d.kind === 'serve').done, 'two customers on the sheet').toBe(2);
  expect(errs, 'nothing threw').toEqual([]);
});

test('the customer, the tickets and the ticket tray fit a small phone', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page, 360);
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  await pin(page, ['serve']);
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => { const w = window.__town.serve && window.__town.serve.want(); return w && w.waiting; }, null, { timeout: 10000 });
  const box = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    const v = document.getElementById('twView'), t = document.querySelector('.tw-cup--serve');
    return { view: r(v), tray: r(t), vw: innerWidth, leave: r(t.querySelector('.tw-cup__leave')), tags: [...document.querySelectorAll('.tw-serve__tag')].map(r), cust: r(document.querySelector('.tw-serve__cust')) };
  });
  expect(box.tray.l, 'the tray inside the screen').toBeGreaterThanOrEqual(0);
  expect(box.tray.r, 'on both sides').toBeLessThanOrEqual(box.vw);
  expect(box.leave.r <= box.vw && box.leave.b - box.leave.t >= 20, 'Not now is on screen, the café’s own way-out button').toBe(true);
  for (const t of box.tags) expect(t.t >= box.view.t && t.b <= box.view.b && t.l >= box.view.l && t.r <= box.view.r, 'every ticket is on screen').toBe(true);
  expect(box.cust.t >= box.view.t && box.cust.b <= box.view.b, 'the customer is on screen').toBe(true);
  await page.screenshot({ path: 'test-results/serve-360.png' });
  expect(errs, 'nothing threw').toEqual([]);
});

test('the first customer ever: a pointer over the glowing thing, then over the customer, and two plain lines — once', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  await pin(page, ['serve'], false);
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => { const w = window.__town.serve && window.__town.serve.want(); return w && w.waiting; }, null, { timeout: 10000 });
  const w1 = await want(page);
  expect(w1.learn, 'the first one ever').toBe(true);
  expect((await page.evaluate(() => window.__town.serve.tray())).note).toBe(SERVE.learnFind);
  expect(await page.evaluate(() => window.__town.serve.point()), 'a pointer over what they want').toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/serve-learn-1.png' });
  await tapSpot(page, await faceOfItem(page, w1.id));
  await page.waitForFunction((id) => window.__town.serve.carrying() === id, w1.id, { timeout: 10000 });
  expect((await page.evaluate(() => window.__town.serve.tray())).note).toBe(SERVE.learnGive);
  expect(await page.evaluate(() => window.__town.serve.point()), 'the pointer moves over the customer').toBe(true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/serve-learn-2.png' });
  await tapCust(page);
  await page.waitForFunction(() => window.__town.serve.served() === 1, null, { timeout: 10000 });
  expect(await page.evaluate(() => window.__town.serve.point()), 'the lesson is over').toBe(false);
  // the next customer: the plain line, no pointer
  await page.evaluate(() => window.__town.serve.arriveNow());
  await page.waitForFunction(() => { const w = window.__town.serve.want(); return w && w.waiting; }, null, { timeout: 12000 });
  expect((await want(page)).learn, 'once').toBe(false);
  expect((await page.evaluate(() => window.__town.serve.tray())).note).toBe(SERVE.find);
  expect(await page.evaluate(() => window.__town.serve.point())).toBe(false);
  expect(errs).toEqual([]);
});

test('the customer walks in on their feet: two frames that change as they go, never one still picture sliding', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  await pin(page, ['serve']);
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => !!(window.__town.serve && window.__town.serve.want()), null, { timeout: 10000 });
  const frames = await page.evaluate(async () => { const seen = new Set(); const t0 = performance.now(); while (performance.now() - t0 < 1200) { const w = window.__town.serve.want(); if (w && !w.waiting) seen.add(w.frame); await new Promise((r) => setTimeout(r, 40)); } return [...seen]; });
  expect(frames.sort(), 'the walking pair, stepping').toEqual([0, 1]);
  expect(errs).toEqual([]);
});
