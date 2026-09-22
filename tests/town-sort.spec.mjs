// ✉️ THE SORTING ROUND — the walk (22 Sep 2026; docs/town-jobs-plan.md §11.4, §12). Trym: *"the post office
// job - we need a plan for that aswell, some sort of simple minigame"*, and then *"go ahead with the post
// office sorting job"*.
//
// The post office's own staff find one more button at the foot of the mailbox card; it walks the banana to
// the counter and the tray rises with the pile. A card sorted fresh into its hole is right, the right hole
// late is late, the wrong hole or nobody at all is wrong. Enough right and the round is on the week's
// sheet; too few and it is not, and the receipt says so either way. Off the mark the tray folds and the
// pile keeps its clock; far away the round ends.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COPY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-post.json'), 'utf8'));
const R = COPY.round || {};
const HOLES = ['park', 'beach', 'home', 'rave'];

async function town(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]);
    try { localStorage.setItem('hs-v1', JSON.stringify({ slug: 'ada-yard', claimedAt: Date.now() })); } catch (e) {}   // a claimed yard: the mailbox is keyed by it
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(11); });
  return errs;
}
const stand = (page, x, y) => page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [x, y]);
// the counter's mark: the post office's foot, on the street — where the round is walked to
const atCounter = (page) => page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
const S = (page, fn, arg) => page.evaluate(([src, a]) => { const s = window.__town.sort(); return s ? (0, eval)('(' + src + ')')(s, a) : null; }, [fn.toString(), arg]);
const round = (page) => S(page, (s) => s.round());
const sortNext = (page, hole, lateBy) => S(page, (s, a) => { const c = s.card(); const h = a.hole === 'right' ? c : a.hole === 'wrong' ? ['park', 'beach', 'home', 'rave'].find((m) => m !== c) : a.hole; return s.sort(h, a.lateBy ? s.round().at + a.lateBy : undefined); }, { hole, lateBy });
const events = (page, name) => page.evaluate((n) => window.__ev.filter((e) => e[0] === n).map((e) => e[1]), name);

test('the staff’s mailbox has the round; it starts when the banana reaches the counter; right, late, wrong and gone; a counted round is on the sheet', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await town(page);

  // ── a stranger and a shop assistant: the mailbox opens, and there is no counter behind it
  for (const at of ['', 'store']) {
    await page.evaluate((j) => window.__town.work.set({ at: j }), at);
    await page.evaluate(() => window.__town.open('post'));
    await page.waitForFunction(() => !!document.querySelector('.tw-post'), null, { timeout: 20000 });
    await page.waitForTimeout(300);
    expect(await page.locator('#twPostSort').count(), `${at || 'a stranger'} sees no round`).toBe(0);
    await page.evaluate(() => document.getElementById('twCardX').click());
    await page.waitForTimeout(200);
  }

  // ── the post office's own staff: the button, the rig's word on it
  await page.evaluate(() => window.__town.work.set({ at: 'post', pay: 75 }));
  await stand(page, 1450, 600);   // on Hall Street, a clear walk east to the counter (the planters south of it block a straight line — the walk stops there, and the counter says so)
  await page.evaluate(() => window.__town.open('post'));
  await page.waitForFunction(() => !!document.querySelector('#twPostSort'), null, { timeout: 20000 });
  expect((await page.locator('#twPostSort').textContent()).trim(), 'the button is the rig’s word').toBe(R.start);
  await page.click('#twPostSort');
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden), 'the card closed on the tap').toBe(true);
  expect(await page.evaluate(() => !!(window.__town.sort() && window.__town.sort().on())), 'and the round waits for the banana to arrive').toBe(false);
  await page.waitForFunction(() => window.__town.sort() && window.__town.sort().on(), null, { timeout: 60000 });
  await page.waitForTimeout(350);

  // ── the tray: a strip on the bottom edge, the square alive behind it (the café's argument, as a number)
  const box = await page.evaluate(() => {
    const v = document.getElementById('twView').getBoundingClientRect(), el = document.querySelector('.tw-cup--sort'), t = el.getBoundingClientRect();
    return { vh: v.height, vb: v.bottom, vl: v.left, vr: v.right, th: t.height, tb: t.bottom, tl: t.left, tr: t.right, hidden: el.hidden, z: +getComputedStyle(el).zIndex, parent: el.parentElement.id };
  });
  expect(box.hidden).toBe(false);
  expect(box.parent, 'a child of the view, like the café’s').toBe('twView');
  expect(box.th / box.vh, 'the tray takes a strip, never the screen').toBeLessThan(0.3);
  expect(Math.round(box.tb), 'on the bottom edge').toBe(Math.round(box.vb));
  expect(Math.round(box.tl)).toBe(Math.round(box.vl));
  expect(Math.round(box.tr)).toBe(Math.round(box.vr));
  expect(box.z, 'over the world, under the card panel').toBeGreaterThan(9);
  expect(box.z).toBeLessThan(1500);
  const said = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  expect(said, 'the town noticed the round begin, in the rig’s words').toBe(R.on);
  // ⚠️ and the raised toast stands UNDER the work note, never on it (the strip alone used to put it there)
  const lay = await page.evaluate(() => { const t = document.getElementById('twToast').getBoundingClientRect(), n = document.querySelector('.twd-chip').getBoundingClientRect(), s = document.querySelector('.tw-cup--sort').getBoundingClientRect(); return { tTop: t.top, tBottom: t.bottom, nBottom: n.bottom, sTop: s.top }; });
  expect(lay.tTop, 'the raised toast sits under the work note').toBeGreaterThanOrEqual(lay.nBottom - 1);
  expect(lay.tBottom, '…and above the tray').toBeLessThanOrEqual(lay.sTop + 1);

  // ── the pile: twelve cards, three of each postmark, four holes each wearing a pixel mark
  const r0 = await round(page);
  expect(r0.cards.length, 'a pile of twelve').toBe(12);
  for (const m of HOLES) expect(r0.cards.filter((c) => c === m).length, 'three ' + m).toBe(3);
  expect(await S(page, (s) => s.pile()), 'twelve sheets on the pile').toBe(12);
  expect(await page.locator('.tw-sort__hole').count(), 'four pigeonholes').toBe(4);
  expect(await page.evaluate(() => [...document.querySelectorAll('.tw-sort__hole')].every((b) => b.querySelector('svg') && b.getAttribute('aria-label'))), 'each with a pixel mark and a name read out').toBe(true);
  expect(await page.evaluate(() => [...document.querySelectorAll('.tw-sort__hole')].map((b) => b.getAttribute('aria-label'))), 'the rig’s names, in the holes’ order').toEqual(HOLES.map((m) => R.holes[m]));
  expect(await page.evaluate(() => !!document.querySelector('.tw-sort__card .tw-sort__stamp svg')), 'the card on the counter wears its postmark').toBe(true);
  expect((await page.locator('.tw-cup--sort .tw-cup__leave').textContent()).trim(), 'the strip carries the way out, in the rig’s word').toBe(R.leave);
  // 🔒 held at the counter: a tap on the square does not walk, a key does not move
  const held0 = await page.evaluate(() => ({ x: window.__town.tgt.x, y: window.__town.tgt.y }));
  const vb = await page.evaluate(() => { const v = document.getElementById('twView').getBoundingClientRect(); return { x: v.left + v.width * 0.5, y: v.top + v.height * 0.4 }; });
  await page.mouse.click(vb.x, vb.y);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => ({ x: window.__town.tgt.x, y: window.__town.tgt.y })), 'a tap and the keys moved nothing while the round was on').toEqual(held0);
  expect(await S(page, (s) => s.hint()), 'a first round carries its one-time notice under the holes').toBe(true);
  expect(await S(page, (s) => s.note()), '…in the rig’s words').toBe(R.hint);
  await page.screenshot({ path: 'test-results/town-sort-tray.png' });

  // ── the three grades and the fourth outcome
  expect((await sortNext(page, 'right')).g, 'straight into its own hole: right').toBe(2);
  expect((await sortNext(page, 'right', 5000)).g, 'its own hole after the fresh window: late').toBe(1);
  expect((await sortNext(page, 'wrong')).g, 'another hole: wrong').toBe(0);
  const i3 = (await round(page)).i;
  await S(page, (s) => s.step(s.round().at + 9500));   // nobody sorts it: the counter takes it away
  const r4 = await round(page);
  expect(r4.i, 'the card left the counter').toBe(i3 + 1);
  expect(r4.marks[r4.marks.length - 1], '…as wrong').toBe(0);
  expect(await S(page, (s) => s.tally()), 'the tally on the tray shows the four so far, and the eight to come').toEqual(['2', '1', '0', '0', '', '', '', '', '', '', '', '']);
  expect(await S(page, (s) => s.pile()), 'eight sheets left').toBe(8);

  // ── the rest go right: the round ends on its own with a receipt, and it counts on the week's sheet
  for (let n = 0; n < 7; n++) expect((await sortNext(page, 'right')).g).toBe(2);
  // the last card: the tally waves before the tray goes down, and the receipt comes after the wave
  expect((await sortNext(page, 'right')).g).toBe(2);
  expect(await page.evaluate(() => document.querySelector('.tw-sort__tally').classList.contains('is-done')), 'the tally waves').toBe(true);
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden), 'and the receipt waits for it').toBe(true);
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden && !!document.querySelector('.tw-sort__till'), null, { timeout: 5000 });
  expect(await page.locator('.tw-burst').count(), 'the counter throws the moment up').toBeGreaterThanOrEqual(1);
  expect((await page.locator('.tw-sort__seal').textContent()).trim(), 'the counter’s stamp is slammed across a counted round').toBe(R.stamp);
  expect(await S(page, (s) => s.hinted()), 'the notice has done its job').toBe(true);
  expect(await S(page, (s) => s.on()), 'the round is over').toBe(false);
  expect(await page.evaluate(() => document.querySelector('.tw-cup--sort').hidden), 'and the tray is down').toBe(true);
  const last = await S(page, (s) => s.last());
  expect([last.right, last.late, last.wrong], 'nine right, one late, two wrong').toEqual([9, 1, 2]);
  expect(last.counted, 'enough went where it was going').toBe(true);
  const till = await page.evaluate(() => document.querySelector('.tw-sort__till').textContent);
  expect(till).toContain(R.receipt.title);
  expect(till, 'the result line, with the round’s own figures').toContain(R.receipt.take.replace('{n}', '9').replace('{of}', '12'));
  expect(till, 'and the line that says it is on the sheet').toContain(R.receipt.counted);
  expect(till).not.toContain(R.receipt.short);
  expect(await page.locator('.tw-sort__till .tw-sort__mark').count(), 'the twelve marks on the paper').toBe(12);
  expect(await page.locator('.tw-sort__till .tw-sort__mark.is-g2').count()).toBe(9);
  await page.waitForTimeout(1400);   // the marks arrive one by one and the seal slams at 720 ms: the picture is of the settled paper
  await page.screenshot({ path: 'test-results/town-sort-receipt.png' });
  const st = await page.evaluate(() => window.__town.work.state());
  expect(st.duties.find((d) => d.kind === 'sort').done, 'post sorted 1/3').toBe(1);
  expect(st.sofar, 'a sixth of the week’s work is a sixth of the rate').toBe(Math.round(75 / 6));
  expect(await page.evaluate(() => window.__town.duties.top()), 'and the work note says so').toMatch(/1\/3/);

  // ── Pulse heard the round, card by card
  expect((await events(page, 'town_shift')).map((p) => p.step), 'in, then out').toEqual(['in', 'out']);
  const out = (await events(page, 'town_shift'))[1];
  expect([out.right, out.late, out.wrong, out.counted]).toEqual([9, 1, 2, 1]);
  expect((await events(page, 'town_sort')).map((p) => p.r)).toEqual(['right', 'late', 'wrong', 'gone', ...Array(8).fill('right')]);
  expect((await events(page, 'town_chore')).map((p) => p.at + ':' + p.kind), 'and the week counted it').toEqual(['post:sort']);
  expect(errs, 'nothing threw').toEqual([]);
});

test('a round that goes wrong is not on the sheet; off the mark the tray folds and the pile keeps its clock; far away the round ends', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await page.evaluate((far) => { window.__R_FAR = far; }, R.far);
  await page.evaluate(() => window.__town.work.set({ at: 'post', pay: 75 }));
  await atCounter(page);
  expect(await page.evaluate(() => window.__town.sortReady()), 'the round’s chunk arrives').toBe(true);
  expect(await S(page, (s) => s.clockIn()), 'the round starts at the counter').toBe(true);
  await page.waitForTimeout(250);
  expect(await S(page, (s) => s.open()), 'the tray is up').toBe(true);
  expect(await S(page, (s) => s.hint()), 'the first round on this device carries the notice').toBe(true);

  // ── step off the mark: the tray folds, and a card left on the counter still leaves it
  const m = await S(page, (s) => s.mark());
  await stand(page, m.x, m.y + 220);
  await page.waitForFunction(() => window.__town.sort().folded(), null, { timeout: 4000 });
  expect(await S(page, (s) => s.open()), 'folded is not open').toBe(false);
  const i0 = (await round(page)).i;
  await S(page, (s) => s.step(s.round().at + 9500));
  const r1 = await round(page);
  expect(r1.i, 'the pile did not wait').toBe(i0 + 1);
  expect(r1.marks[r1.marks.length - 1], '…and the card went as wrong').toBe(0);
  // back on the mark: the tray rises again
  await atCounter(page);
  await page.waitForFunction(() => window.__town.sort().open(), null, { timeout: 4000 });

  // ── everything into the wrong hole: the round ends, the receipt says it is not on the sheet
  while (await S(page, (s) => s.card())) await sortNext(page, 'wrong');
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden && !!document.querySelector('.tw-sort__till'), null, { timeout: 5000 });
  const last = await S(page, (s) => s.last());
  expect(last.wrong, 'the whole pile went wrong').toBe(12);
  expect(last.counted, 'not enough went where it was going').toBe(false);
  const till = await page.evaluate(() => document.querySelector('.tw-sort__till').textContent);
  expect(await page.locator('.tw-sort__seal').count(), 'no stamp on a round that did not make the sheet').toBe(0);
  expect(till, 'the receipt says so, kindly').toContain(R.receipt.short);
  expect(till).not.toContain(R.receipt.counted);
  expect(till).toContain(R.receipt.take.replace('{n}', '0').replace('{of}', '12'));
  expect((await page.evaluate(() => window.__town.work.state())).duties.find((d) => d.kind === 'sort').done, 'post sorted 0/3 still').toBe(0);
  expect(await events(page, 'town_chore'), 'nothing counted').toEqual([]);
  await page.evaluate(() => document.getElementById('twSortX').click());
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden), 'the receipt goes away').toBe(true);

  // ── asked for from too far away: the walk from the card stops short at the planters south of the counter,
  // and the counter says it is a step away instead of raising a tray nobody can see
  await stand(page, 1700, 780);
  await page.evaluate(() => window.__town.open('post'));
  await page.waitForFunction(() => !!document.querySelector('#twPostSort'), null, { timeout: 20000 });
  await page.click('#twPostSort');
  await page.waitForFunction(() => (document.getElementById('twToast').textContent || '').trim() === window.__R_FAR, null, { timeout: 15000 }).catch(() => {});
  const farSaid = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  expect(farSaid, 'the counter says it is a step away').toBe(R.far);
  expect(await S(page, (s) => s.on()), 'and no round began').toBe(false);
  expect(await page.evaluate(() => { const t = window.__town; return Math.hypot(t.tgt.x - t.pos.x, t.tgt.y - t.pos.y) <= 2; }), 'the walk stopped (a slide that goes nowhere is a stop)').toBe(true);

  // ── back at the counter, a fresh round — wordless now, the notice was for the first — and the Leave button ends it with the counter's own line
  await atCounter(page);
  expect(await S(page, (s) => s.clockIn())).toBe(true);
  await page.waitForTimeout(200);
  expect(await S(page, (s) => s.hint()), 'the second round carries no notice').toBe(false);
  await page.click('.tw-cup--sort .tw-cup__leave');
  await page.waitForFunction(() => !window.__town.sort().on(), null, { timeout: 4000 });
  const said = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  expect(said, 'the town says the round ended').toBe(R.off);
  expect(await page.evaluate(() => document.querySelector('.tw-cup--sort').hidden), 'and the tray is down').toBe(true);
  expect((await events(page, 'town_shift')).map((p) => p.step)).toEqual(['in', 'out', 'in', 'out']);
  expect(errs, 'nothing threw').toEqual([]);
});
