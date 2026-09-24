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
import POST from '../src/data/copy/town-post.json' with { type: 'json' };
import DELIVER from '../src/data/copy/town-deliver.json' with { type: 'json' };
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };
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
const makeOne = (page, which, hold) => page.evaluate(async ([w, hs]) => {
  const h = [].concat(hs);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = window.__town.room[w]();
  c.serve();
  const g = c.gest(), first = c.cup();
  if (!g) return false;
  for (let s = 0; s < 20 && c.cup() && c.cup() === first; s++) {
    const key = g.station(); if (!key) break;
    const t = g.best(performance.now());
    await wait(Math.max(0, t - performance.now()));
    if (h.includes(key)) { g.press(performance.now()); await wait(30); g.release(g.best(performance.now())); }
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

// the order already on the tray, made right (no serve() first)
const finishOne = (page, which, hold) => page.evaluate(async ([w, hs]) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = window.__town.room[w](), g = c.gest(), h = [].concat(hs), first = c.cup();
  for (let s = 0; s < 20 && c.cup() && c.cup() === first; s++) {   // this order only: the next one (or the jug) is not ours
    const key = g.station(); if (!key) break;
    const t = g.best(performance.now()); await wait(Math.max(0, t - performance.now()));
    if (h.includes(key)) { g.press(performance.now()); await wait(30); g.release(g.best(performance.now())); } else g.press(g.best(performance.now()));
    await wait(20);
  }
  await wait(150);
}, [which, hold]);

test('🍋 the stand’s rank 3: the jug — offered when nobody waits, stepping aside for a customer, and its glasses skip the squeeze', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await town(page);
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 890; t.pos.y = t.tgt.y = 610; });
  await hire(page, 'stand', 3, 650);
  await page.evaluate(() => window.__town.room.folkReady());
  expect(await page.evaluate(() => window.__town.room.lemonReady())).toBe(true);
  await page.evaluate(() => window.__town.room.open('stand'));
  await page.waitForFunction(() => window.__town.room.lemon() && window.__town.room.lemon().on(), null, { timeout: 30000 });
  // ── nobody at the rope yet: the tray offers the jug, and says so under it
  await page.waitForFunction(() => { const o = window.__town.room.lemon().order(); return o && o.join() === 'fill'; }, null, { timeout: 8000 });
  const t = await page.evaluate(() => { const b = document.querySelector('.tw-cup[data-deck="lemon"]'); return { go: b.querySelector('.tw-cup__go').textContent, pip: !!b.querySelector('.tw-cup__pip--jug') }; });
  expect(t, 'the jug on the tray, and its button').toEqual({ go: LEMON.go.fill, pip: true });
  await toast(page, LEMON.jug.offer);   // said once a shift, the first time it is offered
  await page.screenshot({ path: 'test-results/unlock-jug-offer.png' });
  // ── a customer reaches the front: the untouched jug steps aside for them
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => { const l = window.__town.room.lemon(); l.quiet(true); l.bigNext(false); l.call(); l.arrive(); });   // one customer, and only the one the walk calls
  await page.waitForFunction(() => { const o = window.__town.room.lemon().order(); return o && o[0] === 'squeeze'; }, null, { timeout: 8000 });
  await finishOne(page, 'lemon', ['squeeze', 'fill']);
  // ── the rope clear again: the jug, filled
  await page.waitForFunction(() => { const l = window.__town.room.lemon(); return !l.line().some((q) => q.waiting) && (l.order() || []).join() === 'fill'; }, null, { timeout: 15000 });
  await finishOne(page, 'lemon', ['squeeze', 'fill']);
  expect(await page.evaluate(() => window.__town.room.lemon().jug()), 'a full jug: three glasses').toBe(3);
  await toast(page, LEMON.jug.full);
  expect(await page.locator('.tw-cup__jug i').count(), 'the three in the strip').toBe(3);
  // ── the next glass skips the squeeze
  await page.evaluate(() => { const l = window.__town.room.lemon(); l.bigNext(false); l.call(); l.arrive(); });
  await page.waitForFunction(() => { const o = window.__town.room.lemon().order(); return o && o[0] !== 'fill'; }, null, { timeout: 8000 });
  expect(await page.evaluate(() => window.__town.room.lemon().order()), 'from the jug: ice and pour').toEqual(['ice', 'pour']);
  expect(await page.locator('.tw-cup[data-deck="lemon"] .tw-cup__step').count(), 'two steps on the tray').toBe(2);
  await page.screenshot({ path: 'test-results/unlock-jug-glass.png' });
  await finishOne(page, 'lemon', ['squeeze', 'fill']);
  expect(await page.evaluate(() => window.__town.room.lemon().jug()), 'one glass poured from it').toBe(2);
  expect(errs).toEqual([]);
});

test('☕ the café’s rank 3: a special order adds a syrup step, and tips a little more', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await hire(page, 'cafe', 3, 800);
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__town.room.cafe().specialNext(true));
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on() && window.__town.room.cafe().line().length > 0, null, { timeout: 15000 });
  await page.evaluate(() => window.__town.room.cafe().arrive());
  expect(await page.evaluate(() => window.__town.room.cafe().serve())).toBe(true);
  expect(await page.evaluate(() => window.__town.room.cafe().special()), 'a special order').toBe(true);
  expect(await page.evaluate(() => window.__town.room.cafe().order()), 'with a syrup step on the end').toEqual(['grind', 'pour', 'milk', 'syrup']);
  const b = await page.evaluate(() => { const e = document.querySelector('.tw-cup:not(.tw-cup--sort)'); return { steps: e.querySelectorAll('.tw-cup__step').length, syrup: !!e.querySelector('.tw-cup__pip--syrup') }; });
  expect(b, 'four steps, and the syrup on the ticket').toEqual({ steps: 4, syrup: true });
  await toast(page, CAFE.special);
  await page.screenshot({ path: 'test-results/unlock-special.png' });
  const tips0 = (await page.evaluate(() => window.__town.room.cafe().take())).tips;
  await finishOne(page, 'cafe', ['pour']);
  expect((await page.evaluate(() => window.__town.room.cafe().take())).tips - tips0, 'a perfect cup’s tip and one more for the special').toBe(PERFECT_TIP + 1);
  expect(errs).toEqual([]);
});

test('🕹 the arcade’s rank 3: a lamp put right on the square is one of Spinner’s repairs — not before', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.room.set(5));   // abandoned: the lamps are dark
  await page.waitForTimeout(700);
  const lampFix = async () => { const id = await page.evaluate(() => { const l = window.__town.room.problems().find((q) => q.type === 'lamp'); return l ? l.id : window.__town.room.plant('lamp'); }); expect(id, 'a dark lamp').toBeTruthy(); await page.evaluate((x) => window.__town.room.fix(x), id); await page.waitForTimeout(300); };
  const fixDone = () => page.evaluate(() => (window.__town.work.state().duties.find((d) => d.kind === 'fix') || {}).done | 0);
  // ── the second rank: a lamp is the town's, and that is all
  await hire(page, 'condo', 2, 400);
  await lampFix();
  expect(await fixDone(), 'not a repair on the sheet at the second rank').toBe(0);
  // ── the third rank: Spinner counts it
  await hire(page, 'condo', 3, 950);
  await lampFix();
  await toast(page, STAFF.told.lamp);
  expect(await fixDone(), 'a repair on the week’s sheet').toBe(1);
  expect(await page.evaluate(() => window.__town.work.ladder().xp), 'the day’s ten and a lamp’s twenty').toBe(950 + DAY_XP + xpFor('condo', 'lamp'));
  expect(errs).toEqual([]);
});

test('📦 the post office’s rank 3: a parcel is sorted, then weighed on the scale — in the band it is right, left there it is late', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page, 360);
  const S = (fn, a) => page.evaluate(([src, x]) => (0, eval)('(' + src + ')')(window.__town.sort(), x), [fn.toString(), a]);
  await hire(page, 'post', 3, 1100);
  await page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  expect(await page.evaluate(() => window.__town.sortReady())).toBe(true);
  expect(await S((s) => s.clockIn())).toBe(true);
  const toParcel = async () => { for (let i = 0; i < 16 && !(await S((s) => s.parcel())); i++) await S((s) => s.sort(s.card())); return S((s) => s.parcel()); };
  // ── the first parcel: sorted into its hole, it goes on the scale, and the tray says what to do
  expect(await toParcel(), 'a parcel in the pile').toBe(true);
  expect(await page.evaluate(() => document.querySelector('.tw-sort__card').classList.contains('is-parcel')), 'dressed as a parcel').toBe(true);
  const res = await S((s) => s.sort(s.card()));
  expect(res && res.weigh, 'onto the scale').toBe(true);
  expect(await S((s) => s.weighing()), 'weighing').toBe(true);
  expect(await S((s) => s.note()), 'the one line, the first time').toBe(POST.round.parcel);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/unlock-parcel-scale.png' });
  const m0 = (await S((s) => s.round())).marks.length;
  await S((s) => s.weigh(s.bestWeigh(performance.now())));
  let r = await S((s) => s.round());
  expect([r.marks.length, r.marks[r.marks.length - 1]], 'weighed in the band: right').toEqual([m0 + 1, 2]);
  // ── the next parcel, left on the scale: late
  if (await toParcel()) {
    await S((s) => s.sort(s.card()));
    const at = await page.evaluate(() => performance.now());
    await S((s, x) => s.step(x + 3400), at);
    r = await S((s) => s.round());
    expect(r.marks[r.marks.length - 1], 'left on the scale: late').toBe(1);
  }
  expect(errs).toEqual([]);
});

test('📦 the store’s rank 3: a parcel on the floor, carried across the square to the door with the marker, and delivered', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await hire(page, 'store', 3, 950);
  await page.evaluate((d) => { localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: ['deliver'] })); localStorage.removeItem('tw-deliver-v1'); }, DAY());
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => window.__town.deliver.shown().box, null, { timeout: 5000 });
  await page.screenshot({ path: 'test-results/unlock-deliver-floor.png' });
  // ── walked onto: picked up, and the line says whose and where
  const at = await page.evaluate(() => window.__town.deliver.parcelAt());
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, at);
  await page.waitForFunction(() => window.__town.deliver.shown().held, null, { timeout: 5000 });
  const to = (await page.evaluate(() => window.__town.deliver.to()))[0];
  await toast(page, DELIVER.picked.replace('{to}', DELIVER.to[to]));
  // ── out on the square: the marker bounces over the door
  await page.evaluate(() => window.__town.rooms.exit());
  await page.waitForFunction(() => window.__town.deliver.shown().marker, null, { timeout: 5000 });
  const door = await page.evaluate(() => window.__town.deliver.door());
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y + 90; }, door);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/unlock-deliver-marker.png' });
  // ── at the door: delivered
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y + 20; }, door);
  await page.waitForFunction(() => window.__town.deliver.state().n === 1, null, { timeout: 5000 });
  await toast(page, DELIVER.delivered.replace('{to}', DELIVER.to[to]));
  expect(await page.evaluate(() => window.__town.deliver.shown()), 'nothing left drawn').toEqual({ box: false, held: 0, marker: 0 });
  expect((await events(page, 'town_chore')).map((e) => e.kind).filter((k) => k === 'pickup' || k === 'deliver'), 'Pulse hears the pickup and the delivery').toEqual(['pickup', 'deliver']);
  expect(await page.evaluate(() => window.__town.work.ladder().xp), 'the day’s ten and a delivery’s thirty').toBe(950 + DAY_XP + xpFor('store', 'deliver'));
  expect(errs).toEqual([]);
});

test('☕ the café’s rank 4: after a good shift the keyholder tidies the square by the café — once the receipt is closed', async ({ page }) => {
  test.setTimeout(150000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.room.set(85));   // an ordinary town: the planted mess below is what there is to tidy
  await page.waitForTimeout(700);
  const id = await page.evaluate(() => { const p = window.__town.PROPS.cafe; return window.__town.room.plant('litter', [p.x + p.w / 2 - 160, p.base + 20]); });
  await hire(page, 'cafe', 4, 1600);
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 8000 });
  await page.evaluate(() => localStorage.setItem('tw-rush-v1', JSON.stringify({ d: Math.floor(Date.now() / 864e5) })));   // no rush in the way today
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => { window.__town.room.folk().fill(6, performance.now()); const c = window.__town.room.cafe(); c.specialNext(false); if (!c.line().length) c.call(); });
    await page.waitForFunction(() => window.__town.room.cafe().line().length > 0, null, { timeout: 20000 });
    await page.evaluate(() => window.__town.room.cafe().arrive());
    await makeOne(page, 'cafe', ['pour']);
  }
  expect((await page.evaluate(() => window.__town.room.cafe().take())).served, 'five cups: a good shift').toBeGreaterThanOrEqual(5);
  // the keyholder tidies the NEAREST mess to the café (the planted one guarantees there is one)
  const nearest = () => page.evaluate(() => { const p = window.__town.PROPS.cafe, cx = p.x + p.w / 2, cy = p.base; const q = window.__town.room.problems().filter((o) => o.type !== 'crows' && Math.hypot(o.x - cx, o.y - cy) < 520).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]; return q ? q.id : null; });
  expect(id, 'a mess planted by the café').toBeTruthy();
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  await page.waitForSelector('#twTillX', { timeout: 5000 });
  const n0 = await nearest();
  expect(n0, 'a mess near the café').toBeTruthy();
  await page.waitForTimeout(600);
  expect(await page.evaluate((x) => window.__town.room.problems().some((q) => q.id === x), n0), 'it waits while the receipt is up').toBe(true);
  await page.click('#twTillX');
  await page.waitForFunction((x) => !window.__town.room.problems().some((q) => q.id === x), n0, { timeout: 5000 });
  await toast(page, STAFF.told.tidy);
  expect((await events(page, 'town_fix')).length, 'a fix on the square: the town’s health rises').toBeGreaterThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('🕹 the arcade’s rank 4: litter off the square is Spinner’s sweeping — said once a day', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.room.set(5));
  await page.waitForTimeout(700);
  await hire(page, 'condo', 4, 1900);
  const pick = async (i) => { const id = await page.evaluate((k) => window.__town.room.plant('litter', [900 + k * 60, 1000]), i); await page.evaluate((x) => window.__town.room.fix(x), id); await page.waitForTimeout(300); };
  const swept = () => page.evaluate(() => (window.__town.work.state().duties.find((d) => d.kind === 'sweep') || {}).done | 0);
  await pick(0);
  await toast(page, STAFF.told.litter);
  expect(await swept(), 'sweeping on the week’s sheet').toBe(1);
  await page.evaluate(() => { document.getElementById('twToast').textContent = ''; });
  await pick(1);
  expect(await swept(), 'and again').toBe(2);
  expect(await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim()), 'said once a day, not every piece').not.toBe(STAFF.told.litter);
  expect(errs).toEqual([]);
});

test('📦 the store’s rank 4: two parcels, two doors — one pickup, two markers, and the first delivery says whose the other is', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await hire(page, 'store', 4, 1900);
  await page.evaluate((d) => { localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: ['deliver'] })); localStorage.removeItem('tw-deliver-v1'); }, DAY());
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => window.__town.deliver.shown().box, null, { timeout: 5000 });
  const at = await page.evaluate(() => window.__town.deliver.parcelAt());
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, at);
  await page.waitForFunction(() => window.__town.deliver.shown().held === 2, null, { timeout: 5000 });
  const to = await page.evaluate(() => window.__town.deliver.to());
  expect(to.length, 'two parcels').toBe(2);
  const doors = await page.evaluate(() => window.__town.deliver.doors());
  expect(String(doors[0]) !== String(doors[1]), 'for two different doors').toBe(true);
  await toast(page, DELIVER.pickedTwo.replace('{to}', DELIVER.to[to[0]]).replace('{to2}', DELIVER.to[to[1]]));
  await page.evaluate(() => window.__town.rooms.exit());
  await page.waitForFunction(() => window.__town.deliver.shown().marker === 2, null, { timeout: 5000 });
  await page.screenshot({ path: 'test-results/unlock-deliver-two.png' });
  // ── the second door first: either order
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y + 20; }, doors[1]);
  await page.waitForFunction(() => window.__town.deliver.state().n === 1, null, { timeout: 5000 });
  await toast(page, DELIVER.deliveredOne.replace('{to}', DELIVER.to[to[1]]).replace('{next}', DELIVER.to[to[0]]));
  expect(await page.evaluate(() => window.__town.deliver.shown()), 'one in hand, one marker left').toMatchObject({ held: 1, marker: 1 });
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y + 20; }, doors[0]);
  await page.waitForFunction(() => window.__town.deliver.state().n === 2, null, { timeout: 5000 });
  await toast(page, DELIVER.delivered.replace('{to}', DELIVER.to[to[0]]));
  expect(await page.evaluate(() => window.__town.room.calls('store').some((c) => c.kind === 'deliver')), 'the day’s parcel call is answered').toBe(false);
  expect(errs).toEqual([]);
});

test('🔑 the store’s rank 5: Pip’s shelf sells to its keyholder at the staff price — and only Pip’s shelf', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.room.set(70));
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__town.room.rich());
  const priceRows = async () => { await page.evaluate(() => window.__town.room.cards.store()); const rows = page.locator('[data-town-buy]'); await expect(rows).toHaveCount(6, { timeout: 10000 }); const r = await page.evaluate(() => [...document.querySelectorAll('[data-town-buy]')].map((b) => ({ id: b.dataset.townBuy, price: +b.dataset.price, note: b.closest('.tw-row').querySelector('small').textContent }))); await page.keyboard.press('Escape'); await page.waitForTimeout(300); return r; };
  await hire(page, 'store', 4, 1900);
  const full = await priceRows();
  expect(full.every((r) => !r.note.includes(LIFE.store.staff)), 'the fourth rank pays the shelf price').toBe(true);
  await hire(page, 'store', 5, 3100);
  const staff = await priceRows();
  for (const r of staff) {
    const f = full.find((x) => x.id === r.id);
    expect(r.price, r.id + ': the staff price').toBe(Math.max(1, Math.round(f.price * 0.8)));
    expect(r.note, 'and the row says so').toContain(LIFE.store.staff);
  }
  await page.locator('.tw-card').screenshot({ path: 'test-results/unlock-staff-price.png' }).catch(() => {});
  expect(errs).toEqual([]);
});

test('📜 the top rank: the new thing, then the boss’s memento in the shed — once; the card names the reference; a reference starts you higher', async ({ page }) => {
  test.setTimeout(90000);
  // the pass worker's word on the gift, stubbed: owed once, then handed over — a second ask is told there is nothing
  const asked = [];
  await page.route('**/job/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (!path.endsWith('/job/memento')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) });
    asked.push(path);
    const lad = { xp: 650, rank: 3, today: 0, news: false, mem: 2 };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, given: asked.length === 1 ? 'stand' : null, job: { at: 'stand', week: '', days: 0, pay: 0, duties: [], share: 0, sofar: 0, owed: 0, nudge: false, fired: null, lad } }) });
  });
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  const errs = await town(page);
  await page.evaluate(() => { window.__town.work.set({ at: 'stand' }); window.__town.work.setLad({ xp: 650, rank: 3, today: 0, mem: 1 }); });   // promoted to the top: owed
  await page.waitForFunction(() => !!window.__town.work.words(), null, { timeout: 10000 });
  const shed = () => page.evaluate(() => ((JSON.parse(localStorage.getItem('hs-v1') || '{}') || {}).shed || []).map((x) => x.id));
  const shed0 = await shed();
  // ── PROMOTED to the top: the rank's new thing is said, and a beat later the boss's gift
  await page.evaluate(() => window.__town.moment.promoted('stand', 3));
  await toast(page, STAFF.unlock.stand.jug, 7000);
  await toast(page, STAFF.memento.stand, 12000);
  const shed1 = await shed();
  expect(shed1.length, 'one piece more in the homestead shed').toBe(shed0.length + 1);
  expect(shed1, 'the apple crate').toContain('crate');
  // ── told again (a later promotion to the same top): no second gift
  expect(asked.length, 'the pass worker was asked once').toBe(1);
  await page.evaluate(() => { window.__town.work.setLad({ xp: 650, rank: 3, today: 0, mem: 1 }); });   // a second device's stale word: still "owed"
  expect(await page.evaluate(() => window.__town.work.memento('stand')), 'given once — the server says there is nothing to give').toBe('');
  expect((await shed()).length, 'the shed unchanged').toBe(shed1.length);
  // ── the card at the top rank names the reference it has earned
  await page.evaluate(() => window.__town.staffOpen('stand', 'note'));
  await page.waitForSelector('.tws-unlock', { timeout: 5000 });
  expect(await page.evaluate(() => [...document.querySelectorAll('.tws-unlock')].map((e) => e.textContent)), 'the reference, on the card').toContain(STAFF.refCard.stand);
  await page.locator('.tw-card').screenshot({ path: 'test-results/unlock-top-card.png' });
  await page.keyboard.press('Escape');
  // ── a reference started you higher at the next rung: the hire says whose
  await page.evaluate(() => { window.__town.work.set({ at: 'cafe', ref: 'stand' }); window.__town.work.setLad({ xp: 250, rank: 2, today: 0 }); });
  await page.evaluate(() => { const j = window.__town.work.job(); window.__town.work.set({ ...j, ref: 'stand' }); window.__town.moment.hired('cafe'); });
  await toast(page, STAFF.ref.cafe, 12000);
  expect(errs).toEqual([]);
});

const atPost = (page) => page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
const SORT = (page, fn, a) => page.evaluate(([src, x]) => (0, eval)('(' + src + ')')(window.__town.sort(), x), [fn.toString(), a]);

test('🔴 the post office’s rank 4: registered post — sorted at once it counts double, late it counts wrong', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page, 360);
  await hire(page, 'post', 4, 2100);
  await atPost(page);
  expect(await page.evaluate(() => window.__town.sortReady())).toBe(true);
  expect(await SORT(page, (s) => s.clockIn())).toBe(true);
  const toReg = async () => { for (let i = 0; i < 16 && !(await SORT(page, (s) => s.reg())); i++) { if (await SORT(page, (s) => s.weighing())) await SORT(page, (s) => s.weigh(s.bestWeigh(performance.now()))); else await SORT(page, (s) => s.sort(s.card())); } return SORT(page, (s) => s.reg()); };
  expect(await toReg(), 'a registered card in the pile').toBe(true);
  expect(await page.evaluate(() => document.querySelector('.tw-sort__card').classList.contains('is-reg')), 'wearing its red seal').toBe(true);
  expect(await SORT(page, (s) => s.note()), 'said once, the first time').toBe(POST.round.registered);
  await page.waitForTimeout(700);   // the card slides in; the shot is of it standing
  await page.screenshot({ path: 'test-results/unlock-registered.png' });
  await SORT(page, (s) => s.sort(s.card()));
  let r = await SORT(page, (s) => s.round());
  expect([r.marks[r.marks.length - 1], r.regRight], 'sorted at once: right, and counted twice').toEqual([2, 1]);
  if (await toReg()) {
    const at = await SORT(page, (s) => s.round().at);
    await SORT(page, (s, x) => s.sort(s.card(), x + 5000), at);   // the right hole, but after the card went stale
    r = await SORT(page, (s) => s.round());
    expect(r.marks[r.marks.length - 1], 'late: registered post counts wrong').toBe(0);
  }
  expect(errs).toEqual([]);
});

test('✉️ the post office’s rank 5: a round that counts hands you a satchel — three letters, three doors, once the receipt is closed', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await town(page);
  await hire(page, 'post', 5, 3500);
  await page.evaluate(() => localStorage.removeItem('tw-round-v1'));
  await atPost(page);
  expect(await page.evaluate(() => window.__town.sortReady())).toBe(true);
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  expect(await SORT(page, (s) => s.clockIn())).toBe(true);
  for (let i = 0; i < 20 && (await SORT(page, (s) => !!s.round() && !s.round().done)); i++) {
    if (await SORT(page, (s) => s.weighing())) await SORT(page, (s) => s.weigh(s.bestWeigh(performance.now())));
    else await SORT(page, (s) => s.sort(s.card()));
  }
  await page.waitForSelector('#twSortX', { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.deliver.run('round').shown().held), 'not while the receipt is up').toBe(0);
  await page.click('#twSortX');
  await page.waitForFunction(() => window.__town.deliver.run('round').shown().held === 3, null, { timeout: 5000 });
  const to = await page.evaluate(() => window.__town.deliver.run('round').to());
  await toast(page, DELIVER.round.given.replace('{to}', DELIVER.to[to[0]]).replace('{to2}', DELIVER.to[to[1]]).replace('{to3}', DELIVER.to[to[2]]));
  await page.waitForFunction(() => window.__town.deliver.run('round').shown().marker === 3, null, { timeout: 5000 });
  await page.screenshot({ path: 'test-results/unlock-round.png' });
  const doors = await page.evaluate(() => window.__town.deliver.run('round').doors());
  for (let k = 0; k < 3; k++) {
    await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y + 20; }, doors[k]);
    await page.waitForFunction((n) => window.__town.deliver.run('round').state().n === n, k + 1, { timeout: 5000 });
  }
  await toast(page, DELIVER.round.delivered);
  expect(await page.evaluate(() => window.__town.deliver.run('round').shown()), 'nothing left in hand').toEqual({ box: false, held: 0, marker: 0 });
  expect(errs).toEqual([]);
});

test('🚌 the post office’s rank 6: in the town’s morning the mail bus leaves a bag at the bus stop — you bring the post in', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await hire(page, 'post', 6, 5300);
  await page.evaluate(() => localStorage.removeItem('tw-bus-v1'));
  await page.evaluate(() => window.__town.life.set(12));   // the afternoon: no bag
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__town.deliver.run('bus').shown().box), 'no bag in the afternoon').toBe(false);
  await page.evaluate(() => window.__town.life.set(1));    // the morning
  await page.waitForFunction(() => window.__town.deliver.run('bus').shown().box, null, { timeout: 5000 });
  await toast(page, DELIVER.bus.waiting);
  const at = await page.evaluate(() => window.__town.deliver.run('bus').parcelAt());
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, at);
  await page.waitForFunction(() => window.__town.deliver.run('bus').shown().held === 1, null, { timeout: 5000 });
  await toast(page, DELIVER.bus.picked);
  await page.screenshot({ path: 'test-results/unlock-bus.png' });
  const door = await page.evaluate(() => window.__town.deliver.run('bus').door());
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y + 20; }, door);
  await page.waitForFunction(() => window.__town.deliver.run('bus').state().n === 1, null, { timeout: 5000 });
  await toast(page, DELIVER.bus.delivered);
  expect(await page.evaluate(() => window.__town.work.ladder().xp), 'the day’s ten and the bag’s thirty').toBe(5300 + DAY_XP + xpFor('post', 'bag'));
  expect(errs).toEqual([]);
});

test('👻 the arcade’s rank 5: a ghost caught on the square at night counts as one of Spinner’s repairs, said once', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await hire(page, 'condo', 5, 3000);
  await page.waitForFunction(() => !!window.__town.work.words(), null, { timeout: 10000 });
  await page.evaluate(() => window.__town.life.set(21));   // the town's own night: the ghosts are out
  await page.waitForFunction(() => window.__town.room.ghosts().some((g) => !g.hidden), null, { timeout: 20000 });
  const before = await page.evaluate(() => window.__town.work.ladder().xp);
  // walk into a ghost: stand where it is, frame after frame, until it is caught
  let caught = false;
  for (let i = 0; i < 120 && !caught; i++) {
    await page.evaluate(() => { const t = window.__town, g = t.room.ghosts().find((x) => !x.hidden); if (g) { t.pos.x = t.tgt.x = g.x; t.pos.y = t.tgt.y = g.y; } });
    await page.waitForTimeout(100);
    caught = (await events(page, 'town_ghost')).some((p) => p && p.caught);
  }
  expect(caught, 'a ghost walked into is caught').toBe(true);
  await toast(page, STAFF.told.ghost);
  expect(await page.evaluate(() => window.__town.work.ladder().xp), 'the day’s ten and the ghost’s twenty').toBe(before + DAY_XP + xpFor('condo', 'ghost'));
  await page.screenshot({ path: 'test-results/unlock-night-shift.png' });
  // the same ghost forms again a few seconds later: walked into again, it is not a second repair
  const id = (await events(page, 'town_ghost')).find((p) => p && p.caught).id;
  const n0 = (await events(page, 'town_ghost')).filter((p) => p && p.caught).length;
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = t.pos.x + 160; });
  let again = false;
  for (let i = 0; i < 150 && !again; i++) {
    await page.evaluate((gid) => { const t = window.__town, g = t.room.ghosts().find((x) => x.id === gid && !x.hidden); if (g) { t.pos.x = t.tgt.x = g.x; t.pos.y = t.tgt.y = g.y; } }, id);
    await page.waitForTimeout(100);
    again = (await events(page, 'town_ghost')).filter((p) => p && p.caught).length > n0;
  }
  if (again) expect(await page.evaluate(() => window.__town.work.ladder().xp), 'caught again: no second repair').toBe(before + DAY_XP + xpFor('condo', 'ghost'));
  expect(errs).toEqual([]);
});

test('✉️ the satchel always holds three letters for three doors, on every day of the year — and none is for Stamp', async ({ page }) => {
  const errs = await town(page);
  await hire(page, 'post', 5, 3500);
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  // the draw is seeded by the day: walk a year of days through it (a stride that shared a factor with the pool reached
  // only three names on some days, and two could share a door)
  const bad = await page.evaluate(() => {
    const out = [], real = Date.now, R = window.__town.deliver.run('round');
    try {
      for (let d = 0; d < 366; d++) {
        Date.now = () => real() + d * 864e5;
        const to = R.to(), doors = new Set(R.doors().map(String));
        if (to.length !== 3 || doors.size !== 3 || to.includes('stamp')) out.push(d + ':' + to.join('/'));
      }
    } finally { Date.now = real; }
    return out;
  });
  expect(bad, 'every day: three letters, three different doors, none for Stamp').toEqual([]);
  expect(errs).toEqual([]);
});
