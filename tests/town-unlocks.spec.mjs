// 🔓 THE UNLOCKS, RANK 2 (23 Sep 2026; the ladder's slice 3 — Trym: "yes build it all").
//
// Every workplace's second rank gives a new thing to DO (src/data/town/jobs.js UNLOCKS), and each is walked here through
// the real verbs: the store's basket (two things, a stack of two, one till), the post office's fifth postmark and faster
// pile, the stand's big glass (a longer squeeze, twice the tip), the café's rush (customers without a gap, a bonus for
// serving every one) and the arcade's streak (a perfect repair lights its cabinet; perfect ones in a row are counted).
// The first rank keeps each of them out, and the staff card names what the next rank brings.
import { test, expect } from '@playwright/test';
import SERVE from '../src/data/copy/town-serve.json' with { type: 'json' };
import STAFF from '../src/data/copy/town-staff.json' with { type: 'json' };
import LEMON from '../src/data/copy/town-lemon.json' with { type: 'json' };
import CAFE from '../src/data/copy/town-cafe.json' with { type: 'json' };
import REPAIR from '../src/data/copy/town-repair.json' with { type: 'json' };
import { DAY_XP, xpFor, UNLOCKS } from '../src/data/town/jobs.js';
const PERFECT_TIP = 2;   // town-cafe.js TIP[2]: what a perfect cup or glass tips (that module globs its words, so node cannot import it)
import { playRepair } from './play-repair.mjs';

const DAY = () => Math.floor(Date.now() / 86400000);
async function town(page, width) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  await page.setViewportSize({ width: width || 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(96); window.__town.life.set(12); });
  await page.waitForTimeout(600);
  return errs;
}
const hire = (page, at, rank, xp) => page.evaluate(([a, r, x]) => { window.__town.work.set({ at: a }); window.__town.work.setLad({ xp: x, rank: r, today: 0 }); }, [at, rank, xp]);
const toast = (page, line, ms) => page.waitForFunction((l) => (document.getElementById('twToast').textContent || '').trim() === l, line, { timeout: ms || 8000 });
const events = (page, name) => page.evaluate((n) => window.__ev.filter((e) => e[0] === n).map((e) => e[1]), name);
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
// a cup or a glass made right at the tray's own instants (the counter walks' recipe); `hold` is the deck's held station
const makeOne = (page, which, hold) => page.evaluate(async ([w, h]) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = window.__town.room[w]();
  c.serve();
  const g = c.gest();
  if (!g) return false;
  for (let s = 0; s < 20 && c.cup(); s++) {
    const key = g.station(); if (!key) break;
    const t = g.best(performance.now());
    await wait(Math.max(0, t - performance.now()));
    if (key === h) { g.press(performance.now()); await wait(30); g.release(g.best(performance.now())); }
    else g.press(g.best(performance.now()));
    await wait(20);
  }
  await wait(150);
  return true;
}, [which, hold]);

test('🧺 the store’s rank 2: a basket — two things on the ticket, a stack of two, and one till for both', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await town(page);
  await hire(page, 'store', 2, 320);
  await page.evaluate((d) => { localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: ['serve'] })); localStorage.removeItem('tw-serve-v1'); }, DAY());
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => !!window.__town.serve, null, { timeout: 10000 });
  await page.evaluate(() => window.__town.serve.basket(true));   // the draw makes about one customer in two a basket; the walk asks for one
  await page.waitForFunction(() => { const w = window.__town.serve.want(); return w && w.waiting; }, null, { timeout: 12000 });
  const w = await page.evaluate(() => window.__town.serve.want());
  expect(w.basket, 'a basket').toBe(true);
  expect(new Set(w.ids).size, 'of two different things').toBe(2);
  expect(w.wait, 'and a longer wait for it').toBe(36000);
  const tray = await page.evaluate(() => window.__town.serve.tray());
  expect(tray.basket && !!tray.img2, '🎟 the ticket shows both pictures').toBe(true);
  expect(tray.name, 'and both names').toContain(' + ');
  expect(tray.note, 'and says there are two').toBe(SERVE.basket);
  await page.screenshot({ path: 'test-results/unlock-basket-ticket.png' });

  const faceOf = (id) => page.evaluate((i) => { const s = window.__town.room.shelf(), f = window.__town.rooms.of('store').full; return f[s.indexOf(i)][0]; }, id);
  // ── the first thing: in hand, and the ticket asks for the other
  await tapSpot(page, await faceOf(w.ids[0]));
  await page.waitForFunction((id) => window.__town.serve.carrying() === id, w.ids[0], { timeout: 10000 });
  expect((await page.evaluate(() => window.__town.serve.tray())).note, 'one down').toBe(SERVE.one);
  // ── the till with half a basket: not yet
  await tapSpot(page, 'till');
  await page.waitForFunction((l) => window.__town.serve.tray().note === l, SERVE.more, { timeout: 10000 });
  expect(await page.evaluate(() => window.__town.serve.served()), 'nothing handed over').toBe(0);
  // ── the second thing stacks on the first
  await tapSpot(page, await faceOf(w.ids[1]));
  await page.waitForFunction((ids) => window.__town.serve.carrying() === ids.join('+'), w.ids, { timeout: 10000 });
  expect((await page.evaluate(() => window.__town.serve.tray())).note, 'both in hand: to the till').toBe(SERVE.got);
  const stack = await page.evaluate(() => window.__town.serve.stack());
  expect(stack.length, 'two things over the banana’s head').toBe(2);
  expect(stack[1].top, 'the second stacked above the first').toBeLessThan(stack[0].top);
  await page.screenshot({ path: 'test-results/unlock-basket-stack.png' });
  // ── one till, both handed over: a customer served, a basket's XP
  await tapSpot(page, 'till');
  await page.waitForFunction(() => window.__town.serve.served() === 1, null, { timeout: 10000 });
  const c = (await events(page, 'town_chore')).find((e) => e.kind === 'basket');
  expect(c, 'Pulse hears a basket').toMatchObject({ at: 'store', kind: 'basket' });
  expect((await page.evaluate(() => window.__town.work.state())).duties.find((d) => d.kind === 'serve').done, 'a customer served on the week’s sheet').toBe(1);
  expect(await page.evaluate(() => window.__town.work.ladder().xp), 'the day’s ten and a basket’s XP').toBe(320 + DAY_XP + xpFor('store', 'basket', c.g));
  expect(errs).toEqual([]);
});

test('✉️ the post office’s rank 2: the town’s own postmark as a fifth hole, and a faster pile', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page, 360);
  const S = (fn) => page.evaluate((src) => (0, eval)('(' + src + ')')(window.__town.sort()), fn.toString());
  const at = () => page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  // ── the first rank: four holes, as it always was
  await hire(page, 'post', 1, 100);
  await at();
  expect(await page.evaluate(() => window.__town.sortReady())).toBe(true);
  expect(await S((s) => s.clockIn())).toBe(true);
  let r = await S((s) => s.round());
  expect(r.holes, 'four postmarks at the first rank').toEqual(['park', 'beach', 'home', 'rave']);
  expect(await S((s) => s.holes()), 'four pigeonholes').toHaveLength(4);
  await S((s) => s.clockOut());
  if (await page.locator('#twSortX').count()) await page.click('#twSortX');   // the receipt, closed
  // ── the second rank: the town's own post, and the pile comes faster
  await hire(page, 'post', 2, 400);
  await at();
  await page.waitForTimeout(300);
  expect(await S((s) => s.clockIn()), 'a new round').toBe(true);
  r = await S((s) => s.round());
  expect(r.holes, '✉️ five postmarks: the town’s own bell joins them').toEqual(['park', 'beach', 'home', 'rave', 'town']);
  expect(r.cards.filter((c) => c === 'town').length, 'three cards of each, the town’s too').toBe(3);
  expect(r.cards.length, 'a pile of fifteen').toBe(15);
  expect([r.fresh, r.gone], 'and it comes faster').toEqual([3400, 7500]);
  const holes = await page.evaluate(() => { const v = document.getElementById('twView').getBoundingClientRect(); return [...document.querySelectorAll('.tw-sort__hole, .tw-sort__card')].map((b) => { const q = b.getBoundingClientRect(); return { w: q.width, r: q.right, seen: q.top >= v.top && q.bottom <= v.bottom && q.height > 20, mark: b.dataset.mark, icon: !!b.querySelector('svg') }; }); });
  expect(holes.every((h) => h.seen), '⚠️ the card and every pigeonhole inside the view, top to bottom (fifteen cards once pushed them out of the tray)').toBe(true);
  holes.shift();   // the card led the list
  expect(holes.map((h) => h.mark), 'five pigeonholes on the tray').toEqual(['park', 'beach', 'home', 'rave', 'town']);
  expect(holes.every((h) => h.icon), 'each wearing its stamp').toBe(true);
  expect(Math.min(...holes.map((h) => h.w)), 'still a thumb’s width on a 360 phone').toBeGreaterThanOrEqual(36);
  expect(Math.max(...holes.map((h) => h.r)), 'and all inside the screen').toBeLessThanOrEqual(360);
  await page.waitForTimeout(400);   // the card's slide-in (twSortIn, 260 ms)
  const fit = await page.evaluate(() => { const v = document.getElementById('twView').getBoundingClientRect(), t = document.querySelector('.tw-cup--sort'), n = t.querySelector('.tw-cup__note'), c = t.querySelector('.tw-sort__card'); const r = (e) => e.getBoundingClientRect(); return { card: r(c).left >= r(t).left, note: !n.textContent || r(n).bottom <= Math.min(r(t).bottom, v.bottom) + 1, tray: [Math.round(r(t).top), Math.round(r(t).bottom), Math.round(v.bottom)], nb: Math.round(r(n).bottom) }; });
  console.log('FIT', JSON.stringify(fit));
  expect(fit.card, 'the card inside the tray').toBe(true);
  expect(fit.note, 'and the hint under the holes read to its last word').toBe(true);
  await page.screenshot({ path: 'test-results/unlock-post-five.png' });
  // a town card goes in the town's hole
  for (let i = 0; i < 15; i++) {
    const card = await S((s) => s.card());
    if (card === 'town') { const res = await page.evaluate(() => window.__town.sort().sort('town')); expect(res.g, 'the town’s own post sorts like any other').toBe(2); break; }
    await page.evaluate(() => { const s = window.__town.sort(); s.sort(s.card()); });
  }
  expect(errs).toEqual([]);
});

test('🍋 the stand’s rank 2: a big glass — a bigger ticket, a longer squeeze, twice the tip', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 890; t.pos.y = t.tgt.y = 610; });
  await hire(page, 'stand', 2, 220);
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  expect(await page.evaluate(() => window.__town.room.lemonReady())).toBe(true);
  await page.evaluate(() => window.__town.room.lemon().bigNext(true));   // the draw makes about one order in three big; the walk asks for the first
  await page.evaluate(() => window.__town.room.open('stand'));
  await page.waitForFunction(() => window.__town.room.lemon() && window.__town.room.lemon().on() && window.__town.room.lemon().line().length > 0, null, { timeout: 30000 });
  await page.evaluate(() => window.__town.room.lemon().arrive());
  expect(await page.evaluate(() => window.__town.room.lemon().serve()), 'the order is on the tray').toBe(true);
  expect(await page.evaluate(() => window.__town.room.lemon().big()), 'a big glass').toBe(true);
  await toast(page, LEMON.big);   // said for the shift's first
  const t = await page.evaluate(() => { const b = document.querySelector('.tw-cup[data-deck="lemon"]'); const p = b.querySelector('.tw-cup__pip').getBoundingClientRect(); return { big: b.classList.contains('is-big'), w: p.width }; });
  expect(t.big, '🎟 the ticket reads big').toBe(true);
  expect(t.w, 'its pictures bigger than a glass’s').toBeGreaterThan(20);
  // the squeeze is longer: the held station's perfect instant sits later than a small glass's would
  const z = await page.evaluate(() => { const g = window.__town.room.lemon().gest(), t = performance.now(); return g.best(t) - t; });
  expect(z, 'the squeeze held longer (a big glass: 2600 ms of pour, a small one 1700)').toBeGreaterThan(1700 * 0.72);
  await page.screenshot({ path: 'test-results/unlock-big-glass.png' });
  const tips0 = (await page.evaluate(() => window.__town.room.lemon().take())).tips;
  await page.evaluate(async () => {   // finish the glass that is on the tray, perfectly
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const c = window.__town.room.lemon(), g = c.gest();
    for (let s = 0; s < 20 && c.cup(); s++) {
      const key = g.station(); if (!key) break;
      const tt = g.best(performance.now()); await wait(Math.max(0, tt - performance.now()));
      if (key === 'squeeze') { g.press(performance.now()); await wait(30); g.release(g.best(performance.now())); } else g.press(g.best(performance.now()));
      await wait(20);
    }
  });
  await page.waitForFunction(() => !window.__town.room.lemon().cup(), null, { timeout: 8000 });
  const took = await page.evaluate(() => window.__town.room.lemon().take());
  expect(took.tips - tips0, 'twice a perfect glass’s tip').toBe(2 * PERFECT_TIP);
  expect(await page.evaluate(() => window.__town.room.lemon().grades()), 'and two glasses’ worth of work').toEqual([2, 2]);
  expect((await events(page, 'town_cup')).filter((e) => e.big === 1).length, 'Pulse hears a big glass').toBe(1);
  expect(errs).toEqual([]);
});

test('☕ the café’s rank 2: a rush — no rush at the first rank; at the second, customers without a gap and a bonus for every one', async ({ page }) => {
  test.setTimeout(150000);
  const errs = await town(page);
  await page.evaluate(() => localStorage.removeItem('tw-rush-v1'));
  await hire(page, 'cafe', 1, 100);
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 8000 });
  // ── two cups at the first rank, then an empty rope: no rush
  for (let i = 0; i < 2; i++) { await page.evaluate(() => { const c = window.__town.room.cafe(); if (!c.line().length) c.call(); c.arrive(); }); await makeOne(page, 'cafe', 'pour'); }
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__town.room.cafe().rush()), 'a barista of the first rank gets no rush').toBeNull();
  expect(await page.evaluate(() => window.__town.room.cafe().rushed()), 'and none is spent for today').toBe(false);
  // ── the second rank: with the rope clear the rush begins by itself
  await page.evaluate(() => window.__town.work.setLad({ xp: 300, rank: 2, today: 0 }));
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__town.room.cafe().rush())); i++) {
    const busy = await page.evaluate(() => window.__town.room.cafe().line().length);
    if (busy) { await page.evaluate(() => window.__town.room.cafe().arrive()); await makeOne(page, 'cafe', 'pour'); }   // a customer who came before it: served, and the rope clears
    else await page.waitForTimeout(250);
  }
  expect(await page.evaluate(() => window.__town.room.cafe().rush()), '☕ the rush is on').not.toBeNull();
  await toast(page, CAFE.rush.on);
  expect(await page.evaluate(() => window.__town.room.cafe().rushed()), 'one rush a day: it is spent').toBe(true);
  await page.screenshot({ path: 'test-results/unlock-rush.png' });
  // ── serve every one of them
  for (let i = 0; i < 12 && (await page.evaluate(() => window.__town.room.cafe().rush())); i++) {
    await page.waitForFunction(() => window.__town.room.cafe().line().length > 0 || !window.__town.room.cafe().rush(), null, { timeout: 15000 });
    if (!(await page.evaluate(() => window.__town.room.cafe().rush()))) break;
    await page.evaluate(() => window.__town.room.cafe().arrive());
    await makeOne(page, 'cafe', 'pour');
  }
  expect(await page.evaluate(() => window.__town.room.cafe().rush()), 'the rush is over').toBeNull();
  await toast(page, CAFE.rush.done);
  expect((await events(page, 'town_chore')).filter((e) => e.kind === 'rush'), 'Pulse hears a rush served to the last customer').toHaveLength(1);
  expect((await events(page, 'town_cup')).filter((e) => e.r === 'rush'), 'and the rush beginning').toHaveLength(1);
  expect(errs).toEqual([]);
});

test('🕹 the arcade’s rank 2: a perfect repair lights its cabinet gold, and perfect repairs in a row are counted', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await town(page);
  await page.evaluate(() => localStorage.removeItem('tw-streak-v1'));
  await hire(page, 'condo', 2, 320);
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(300);
  const fix = async (spoil) => {
    await page.evaluate(() => window.__town.room.arcadeReset());
    await page.waitForTimeout(300);
    const key = (await page.evaluate(() => window.__town.room.arcade())).dead;
    const spot = await page.evaluate((k) => window.__town.arcade.spots().find((q) => q[0] === k), key);
    await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [(spot[1] + spot[3]) / 2, spot[4] + 26]);
    await page.evaluate((k) => window.__town.room.cabinetRepair(k), key);
    await playRepair(page, !!spoil);
    if (spoil) await playRepair(page, false);   // the next go, played well, wakes it
    await page.waitForFunction(() => window.__town.room.arcade().dead === null, null, { timeout: 8000 });
    return key;
  };
  const lit = () => page.evaluate(() => ({ n: document.querySelectorAll('#twWorld .tw-lit.is-in').length, key: (JSON.parse(localStorage.getItem('tw-arcade-v1') || '{}') || {}).lit || null }));
  // ── a perfect repair: the cabinet lights up gold, and stays lit
  const k1 = await fix(false);
  await toast(page, REPAIR.streak.one);
  expect(await lit(), '🕹 lit gold for the day').toEqual({ n: 1, key: k1 });
  expect(await page.evaluate(() => window.__town.repair.streak()), 'the run begins').toBe(1);
  await page.screenshot({ path: 'test-results/unlock-streak-lit.png' });
  // ── another perfect one: the run counts on
  await fix(false);
  await toast(page, REPAIR.streak.run.replace('{n}', '2'));
  expect(await page.evaluate(() => window.__town.repair.streak())).toBe(2);
  // ── a spark breaks it; the good go after it is only fine or perfect again from one
  await fix(true);
  expect(await page.evaluate(() => window.__town.repair.streak()), 'a spark starts the run over').toBe(1);
  expect((await events(page, 'town_chore')).filter((e) => e.kind === 'streak').map((e) => e.n), 'Pulse hears the runs').toEqual([1, 2, 1]);
  expect(errs).toEqual([]);
});

test('🔓 at the first rank every staff card names what the second rank lets you do', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page);
  for (const at of Object.keys(UNLOCKS)) {
    await hire(page, at, 1, 0);
    await page.evaluate((a) => window.__town.staffOpen(a, 'note'), at);
    await page.waitForSelector('.tws-unlock', { timeout: 5000 });
    const got = await page.evaluate(() => [...document.querySelectorAll('.tws-unlock')].map((e) => e.textContent));
    const want = Object.keys(UNLOCKS[at]).filter((k) => UNLOCKS[at][k] === 2).map((k) => STAFF.unlock[at][k]);
    expect(got, at + ': the second rank’s new thing, on the card').toEqual(want);
    if (at === 'store') await page.locator('.tw-card').screenshot({ path: 'test-results/unlock-card-store.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  expect(errs).toEqual([]);
});
