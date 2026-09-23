// 🍋 THE LEMONADE STAND — the walk (22 Sep 2026; docs/town-jobs-plan.md §11.5). Trym: *"The lemonade stand
// should also have something - maybe you can work selling lemonade"*, then *"go ahead with the lemonade stand"*.
//
// Fig Jr.'s stand is the café's counter engine with a lemonade deck on it, so what is asserted here is what
// the stand adds: the stand answers a stranger in its own words; its own staff walk up and step round the
// back of the table; the tray plays the lemonade deck in its order; the customers queue on Hall Street in
// front of the table and above the tray; a glass made right pays tips once, at clock-out, through the
// faucet the server knows; a served customer walks off with the glass; Fig Jr. steps to the orchard; and
// the work note knows the stand as a tips job.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-lemon.json'), 'utf8'));
const DUTY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-duties.json'), 'utf8'));

async function square(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
  await page.waitForTimeout(600);
  return errors;
}
const stand = (page, x, y) => page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [x, y]);
const lemon = (page, fn, arg) => page.evaluate(([src, a]) => { const l = window.__town.room.lemon(); return l ? (0, eval)('(' + src + ')')(l, a) : null; }, [fn.toString(), arg]);
const events = (page, name) => page.evaluate((n) => window.__ev.filter((e) => e[0] === n).map((e) => e[1]), name);
// a glass made right, at the exact instants the tray's own seam solves for
const makeGlasses = (page, n) => page.evaluate(async (k) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const l = window.__town.room.lemon();
  for (let i = 0; i < k; i++) {
    l.serve();
    const g = l.gest();
    if (!g) break;
    for (let s = 0; s < 20 && l.cup(); s++) {
      const key = g.station(); if (!key) break;
      const t = g.best(performance.now());
      await wait(Math.max(0, t - performance.now()));
      if (key === 'squeeze') { g.press(performance.now()); await wait(30); g.release(g.best(performance.now())); }
      else g.press(g.best(performance.now()));
      await wait(20);
    }
    await wait(150);
  }
}, n);

test('the stand answers a stranger in its own words, and its own staff step round the back of the table onto a lemonade deck', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await square(page);
  await stand(page, 890, 610);   // on Hall Street, in front of the stand

  // ── a stranger, and a shop assistant: the stand is a stall to them, and it says so in the rig's words
  for (const at of ['', 'store']) {
    await page.evaluate((j) => window.__town.work.set({ at: j }), at);
    expect(await page.evaluate(() => window.__town.room.open('stand')), 'the stand answers').toBe(true);
    await page.waitForFunction((f) => (document.getElementById('twToast').textContent || '').trim() === f, COPY.front, { timeout: 10000 });
    expect(await page.evaluate(() => !!(window.__town.room.lemon() && window.__town.room.lemon().on())), `${at || 'a stranger'} does not clock in`).toBe(false);
  }
  const said = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  expect(said, '⚠️ never the old hand-written stub').not.toContain('Not built yet');

  // ── you work here: the tap answers, the walk stops at the table, and the shift begins one step round the back
  await page.evaluate(() => window.__town.work.set({ at: 'stand' }));
  expect(await page.evaluate(() => window.__town.room.lemonReady()), 'the stand’s chunk arrives').toBe(true);
  expect(await page.evaluate(() => window.__town.room.open('stand')), 'and the stand answers its own staff').toBe(true);
  await page.waitForFunction(() => window.__town.room.lemon() && window.__town.room.lemon().on(), null, { timeout: 30000 });
  await page.waitForTimeout(400);
  // ⭐ THE VENDOR IS DRAWN, in front of the stall and clipped at the table's edge (Trym, 22 Sep: "anchored lower
  // with at least half a banana"): a banana that merely walked behind the stall showed a sliver in the gap
  const v = await lemon(page, (l) => l.vendor());
  expect(v, 'a vendor stands at the counter').toBeTruthy();
  expect(v.z, 'over the stall (its z is its base, 545)').toBeGreaterThan(100 + 545);
  expect(v.clip, 'cut off at the counter’s edge, never floating over the table').toMatch(/^inset\(0(px)? 0(px)? [\d.]+%( 0(px)?)?\)$/);   // the browser folds the fourth value away
  const under = (v.floor - v.tableTop) / v.drawn;
  expect(under, 'chest-up: the counter takes the body and leaves the head, the shoulders and the hands').toBeGreaterThan(0.5);
  expect(under, '…but never the face').toBeLessThan(0.72);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.tw-me')).display === 'none'), 'your banana on the cobbles is the one at the counter').toBe(true);
  const drawn = await page.evaluate(() => { const e = document.querySelector('.tw-atwork--stand'), o = [...document.querySelectorAll('.tw-ov')].find((i) => /ov-50/.test(i.src)); const r = e.getBoundingClientRect(), k = o.getBoundingClientRect(); return { inside: r.left >= k.left - 30 && r.right <= k.right + 30, tall: r.height > k.height * 0.4, cvw: e.firstChild.width }; });
  expect(drawn.inside, 'it stands within the stall’s width').toBe(true);
  expect(drawn.tall, 'and it is a proper size — the counter crops it, the scale does not').toBe(true);
  expect(drawn.cvw, 'drawn at the size it is shown').toBeGreaterThan(24);
  expect(await lemon(page, (l) => l.counter()), 'the counter knows where it is').toBe('stand');
  const tray = await page.evaluate(() => { const t = document.querySelector('.tw-cup'); return { deck: t && t.dataset.deck, hidden: !t || t.hidden, steps: document.querySelectorAll('.tw-cup__step').length }; });
  expect(tray.deck, 'the tray plays the lemonade deck').toBe('lemon');
  expect(tray.hidden).toBe(false);
  expect(tray.steps, 'three stations').toBe(3);
  const on = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  expect(on, 'the town noticed the stand open, in the rig’s words').toBe(COPY.on);

  // ── the queue forms on Hall Street in front of the table, above the tray, and the deck runs in its order
  // (the counter borrows its customers from the town's visitors, so the walk brings them in first)
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.waitForTimeout(300);
  for (let i = 0; i < 2; i++) { await lemon(page, (l) => l.call()); await page.waitForTimeout(400); }
  await lemon(page, (l) => l.arrive());
  await page.waitForTimeout(400);
  const line = await lemon(page, (l) => l.line());
  expect(line.length, 'a queue of two').toBe(2);
  const rope = await lemon(page, (l) => l.rope());
  expect(rope[0], 'the first customer stands at the counter').toEqual({ x: 890, y: 598 });
  for (const r of rope) { expect(r.y, 'every mark is on Hall Street, south of the table (the router only walks a lane)').toBeGreaterThan(560); expect(r.y).toBeLessThan(660); }
  const seen = await page.evaluate(() => {
    const v = document.getElementById('twView').getBoundingClientRect(), t = document.querySelector('.tw-cup').getBoundingClientRect();
    const wl = document.getElementById('twWorld').getBoundingClientRect(), s = wl.width / 2200;
    return window.__town.room.lemon().rope().map((r) => wl.top + r.y * s).filter((foot) => foot > v.top && foot < t.top).length;
  });
  expect(seen, 'both marks are above the tray, inside the frame').toBe(2);
  expect(await lemon(page, (l) => l.serve()), 'the first order is on the tray').toBe(true);
  expect(await lemon(page, (l) => l.gest().station()), 'a lemonade starts with the squeeze').toBe('squeeze');
  expect(await page.evaluate(() => document.querySelector('.tw-cup').dataset.st), 'and the tray is dressed for it').toBe('squeeze');
  expect((await page.locator('.tw-cup__go').textContent()).trim(), 'the button wears the rig’s word for it').toBe(COPY.go.squeeze);
  expect(await page.locator('.tw-cup__pip').count(), 'the order is pictures: a lemon, ice — maybe a leaf or a splash').toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: 'test-results/town-lemon-tray.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(500);
  const ob = await page.locator('.tw-ov[src*="ov-50"]').boundingBox();
  await page.screenshot({ path: 'test-results/town-lemon-vendor-desktop.png', clip: { x: Math.max(0, ob.x - 120), y: Math.max(0, ob.y - 60), width: ob.width + 240, height: ob.height + 140 } });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForTimeout(400);

  // ── glasses, made right at the tray’s own instants: tips gather on the tray and a served customer takes the glass
  const before = await page.evaluate(() => (window.__town.room.folk().folk() || []).filter((v) => (v.held || []).includes('lemoncup')).length);
  expect(before, 'nobody in the square starts with a glass').toBe(0);
  await makeGlasses(page, 2);
  await page.waitForTimeout(600);
  const took = await lemon(page, (l) => l.take());
  expect(took.served, 'glasses went out').toBeGreaterThan(0);
  expect(took.tips, 'and they were worth something').toBeGreaterThan(0);
  const chip = await page.evaluate(() => { const t = document.querySelector('.tw-cup__tips'); return t ? { hidden: t.hidden, n: parseInt(t.textContent, 10) } : null; });
  expect(chip && !chip.hidden && chip.n === took.tips, 'the tray’s counter carries the shift’s total').toBe(true);
  const carried = await page.evaluate(() => (window.__town.room.folk().folk() || []).filter((v) => (v.held || []).includes('lemoncup')).length);
  expect(carried, 'a glass in a hand for every glass that went out').toBe(took.served);
  expect((await events(page, 'town_cup')).every((p) => p.at === 'stand'), 'Pulse hears the glasses at the stand').toBe(true);

  // ── 🔒 held at the counter (Trym, 22 Sep: "movement should be locked"): a tap on the square does not walk, a key
  // does not move, and the tray's Leave button is the way out
  const held0 = await page.evaluate(() => ({ x: window.__town.tgt.x, y: window.__town.tgt.y, px: window.__town.pos.x, py: window.__town.pos.y }));
  const vb = await page.evaluate(() => { const v = document.getElementById('twView').getBoundingClientRect(); return { x: v.left + v.width * 0.5, y: v.top + v.height * 0.45 }; });
  await page.mouse.click(vb.x, vb.y);
  await page.waitForTimeout(250);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.down('a'); await page.waitForTimeout(300); await page.keyboard.up('a');
  const held1 = await page.evaluate(() => ({ x: window.__town.tgt.x, y: window.__town.tgt.y, px: window.__town.pos.x, py: window.__town.pos.y }));
  expect(held1, 'a tap and the keys moved nothing while the shift was on').toEqual(held0);
  expect(await lemon(page, (l) => l.on()), 'and the shift is still on').toBe(true);
  expect((await page.locator('.tw-cup__leave').textContent()).trim(), 'the strip carries the way out, in the rig’s word').toBe(COPY.leave);
  // ── nothing is paid until you step away; then once, through the faucet the server knows, and the receipt says the take
  const paidBefore = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pass-ev-v1') || '[]') || []).filter((e) => e.s === 'tips').length; } catch (e) { return -1; } });
  expect(paidBefore, 'not a coin has moved yet').toBe(0);
  await page.click('.tw-cup__leave');
  await page.waitForTimeout(500);
  const paid = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pass-ev-v1') || '[]') || []).filter((e) => e.s === 'tips').map((e) => e.d); } catch (e) { return []; } });
  expect(paid.length, 'paid ONCE, at the end').toBe(1);
  expect(paid[0], 'and it is what the shift came to').toBe(took.tips);
  const card = await page.evaluate(() => (document.getElementById('twCardBody') || {}).textContent || '');
  expect(card, 'the receipt is the stand’s own paper').toContain(COPY.receipt.title);
  expect(card, '…and names the take').toContain(String(took.tips));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/town-lemon-receipt.png' });
  expect((await events(page, 'town_shift')).map((p) => p.at + ':' + p.step), 'Pulse heard the shift at the stand').toEqual(['stand:in', 'stand:out', 'stand:paid']);
  expect(errors).toEqual([]);
});

test('Fig Jr. steps to the orchard while his stand is worked, and the work note knows the stand as a tips job', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await square(page);
  // ── the note: the stand’s duty until you have clocked in today, then its after-line; never a count
  await page.evaluate(() => window.__town.work.set({ at: 'stand', pay: 0 }));
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.duty.stand, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.duties.top()), 'no counts on a tips job').toBe('');
  await page.evaluate(() => window.__town.work.turnUp());
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.standDone, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.duties.html()), 'no number anywhere on a tips job').not.toMatch(/<b>\d/);

  // ── the kid steps off his pitch while you work it: his place is the orchard for as long as the shift is on
  await stand(page, 890, 556);
  expect(await page.evaluate(() => window.__town.room.lemonReady())).toBe(true);
  expect(await lemon(page, (l) => l.clockIn())).toBe(true);
  await page.waitForFunction(() => { const r = (window.__town.life.residents() || []).find((q) => q.key === 'figjr'); return !!r && r.place === 'booth'; }, null, { timeout: 8000 }).catch(() => {});
  const fig = await page.evaluate(() => { const r = (window.__town.life.residents() || []).find((q) => q.key === 'figjr'); return r ? { place: r.place, x: Math.round(r.x), y: Math.round(r.y) } : null; });
  expect(fig, 'Fig Jr. is in the square').toBeTruthy();
  expect(fig.place, 'and his place is beside the phone box while the stand is yours — off the queue’s line').toBe('booth');
  // …and when you leave by the button, he comes back to his own day
  await page.click('.tw-cup__leave');
  await page.waitForTimeout(300);
  expect(await lemon(page, (l) => l.on())).toBe(false);
  await page.evaluate(() => { const x = document.getElementById('twCardX'); if (x) x.click(); });
  await page.waitForFunction(() => { const r = (window.__town.life.residents() || []).find((q) => q.key === 'figjr'); return !!r && r.place !== 'booth'; }, null, { timeout: 8000 });
  expect(errors).toEqual([]);
});

// ⭐ 23 Sep 2026: the "LEMONADE" sign skipped the walk. For the stand's own staff a tap on it clocked them in where they
// stood (from across the square, so the shift ended at once with an empty receipt) or out in the middle of a shift.
// A sign is its place now: the same walk, then the same deed, and nothing while the tray is up.
test('the LEMONADE sign walks a worker to the stand before the shift, and never ends one', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await square(page);
  await page.evaluate(() => window.__town.work.set({ at: 'stand' }));
  expect(await page.evaluate(() => window.__town.room.lemonReady()), 'the stand’s chunk arrives').toBe(true);
  await stand(page, 1500, 1000);   // across the square from the stand
  await page.waitForTimeout(400);
  const sign = page.locator('.tw-plank[data-key="stand"]');
  await sign.dispatchEvent('click');
  await page.waitForTimeout(300);
  expect(await lemon(page, (l) => l.on()), 'no shift where you stand').toBe(false);
  expect(await page.evaluate(() => { const t = window.__town; return Math.hypot(t.tgt.x - t.pos.x, t.tgt.y - t.pos.y) > 100; }), 'the banana sets off for the stand').toBe(true);
  await page.waitForFunction(() => window.__town.room.lemon() && window.__town.room.lemon().on(), null, { timeout: 30000 });
  await sign.dispatchEvent('click');
  await page.waitForTimeout(500);
  expect(await lemon(page, (l) => l.on()), 'a tap on the sign mid-shift does not end it').toBe(true);
  expect(errors).toEqual([]);
});
