// 🪜 THE JOB LADDER — the walk (23 Sep 2026; the plan https://claude.ai/artifact/BN3XdtMec5Q4BkvVh7FBht, slice 1).
//
// Trym, 22 Sep: "you can level up and get promoted in all workplaces — some more than others — we need levels and
// titles for each job — and XP for each job". His calls on 23 Sep: any boss hires, ranks 3·4·5·5·6, ONE pay scale,
// and promotion happens AT THE BOSS. So the order is the thing this walks: the work earns XP; XP past the line is
// NEWS (the note turns green, the card says so); you walk to your boss and ask; the boss tells you in their own words,
// the card closes by itself, and only then does PROMOTED go up over the square — the hire's own order. After it, the
// title, the rank and the tips cap are the new rank's everywhere they are shown.
import { test, expect } from '@playwright/test';
import STAFF from '../src/data/copy/town-staff.json' with { type: 'json' };
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };
import DUTY from '../src/data/copy/town-duties.json' with { type: 'json' };
import { tipsCap, xpAt, LADDER } from '../src/data/town/jobs.js';

const stand = (page, x, y) => page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = t.tgt.x = px; t.pos.y = t.tgt.y = py; }, [x, y]);
const view = (lad) => ({ ok: true, job: { at: 'cafe', week: '2026-W39', days: 1, pay: 0, duties: [], share: 0, sofar: 0, owed: 0, nudge: false, fired: null, lad } });

async function town(page, w, h) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));   // an area can look alive and be dead
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); localStorage.removeItem('tw-job-v1'); } catch (e) {} });
  // the pass worker, stubbed: a barista at rank 1 with the line to rank 2 already crossed, and a boss who tells them
  const sent = [];
  await page.route('**/job/view', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(view({ xp: 0, rank: 1, today: 0, news: false })) }));
  await page.route('**/job/chore', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) }));
  await page.route('**/job/promote', (r) => { sent.push(JSON.parse(r.request().postData() || '{}')); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...view({ xp: 260, rank: 2, today: 40, news: false }), promoted: { at: 'cafe', from: 1, to: 2 } }) }); });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(12); });
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.waitForFunction(() => !!window.__town.work.words(), null, { timeout: 10000 });   // the ladder's words come with the job
  expect(await page.evaluate(() => window.__town.staffReady()), 'the card’s chunk arrives').toBe(true);
  return { errs, sent };
}
const card = (page) => page.evaluate(() => { const s = window.__town.staff(); const l = s && s.last(); const b = document.getElementById('twCardBody'); return l && b && !document.getElementById('twPanel').hidden ? { ...l, text: b.innerText, pips: b.querySelectorAll('.tws-pips i').length, on: b.querySelectorAll('.tws-pips i.is-on').length, bar: (b.querySelector('.tws-xp .tws-bar i') || {}).style ? b.querySelector('.tws-xp .tws-bar i').style.transform : '', news: !!b.querySelector('.tws-news:not(.is-word)') } : null; });
const closeCard = (page) => page.evaluate(() => { const x = document.getElementById('twCardX'); if (x) x.click(); });

for (const [w, h] of [[360, 640], [393, 852]]) {
  test(`the ladder at the Coffee Cup: the card, the news, and a promotion told by Bean at ${w}×${h}`, async ({ page }) => {
    test.setTimeout(90000);
    const { errs, sent } = await town(page, w, h);

    // ── rank 1: the title, the pips, the XP to the next line, and what the next rank gives
    await page.evaluate(() => window.__town.work.setLad({ xp: 120, rank: 1, today: 40 }));
    await page.evaluate(() => window.__town.staffOpen('cafe', 'note'));
    let c = await card(page);
    expect(c, 'your own staff card').not.toBeNull();
    expect(c.title, 'what you are called: rank 1').toBe(STAFF.ranks.cafe[0]);
    expect(c.text, 'which rank, of how many').toContain(STAFF.rank.replace('{n}', '1').replace('{of}', '4'));
    expect([c.pips, c.on], 'four pips, one lit').toEqual([4, 1]);
    expect(c.text, 'your work XP against the next rank’s line').toContain('/ ' + xpAt('cafe', 2));
    expect(parseFloat(String(c.bar).replace('scaleX(', '')), 'a bar that far along').toBeCloseTo(120 / 250, 3);
    expect(c.text, 'today against the day’s cap').toContain(STAFF.today.replace('{n}', '40').replace('{cap}', String(LADDER.cafe.day)));
    expect(c.text, 'what the next rank gives: a title and a bigger tips cap').toContain(STAFF.nextTips.replace('{title}', STAFF.ranks.cafe[1]).replace('{cap}', String(tipsCap('cafe', 2))));
    expect(c.text, 'the tips cap is the rank’s').toContain('/ ' + tipsCap('cafe', 1));
    expect(c.news, 'no news yet').toBe(false);
    await page.locator('.tw-card').screenshot({ path: `test-results/ladder-card-r1-${w}.png` });
    await closeCard(page);

    // ── the line crossed: NEWS. The note turns green and names Bean; the card says the same over the XP
    await page.evaluate(() => window.__town.work.setLad({ xp: 260, rank: 1, today: 80 }));
    await page.waitForFunction((l) => window.__town.duties.line() === l, STAFF.news.cafe, { timeout: 5000 });   // the card's own line, on the note
    expect(await page.evaluate(() => window.__town.duties.kind()), 'the note wears the news’s green').toBe('news');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.twd-chip')).backgroundImage), 'green, not the quest’s yellow or the pager’s amber').toContain('rgb(226, 245, 196)');
    expect(await page.evaluate(() => window.__town.duties.xp()), 'its thin bar is full').toBe('100.0%');
    expect(await page.evaluate(() => window.__town.work.ladder()), 'the XP has earned rank 2; the rank you hold is still 1').toMatchObject({ earned: 2, rank: 1, news: true });
    await page.screenshot({ path: `test-results/ladder-note-news-${w}.png` });
    await page.evaluate(() => window.__town.staffOpen('cafe', 'note'));
    c = await card(page);
    expect(c.news, 'the card carries the news').toBe(true);
    expect(c.text).toContain(STAFF.news.cafe);
    expect(c.title, 'and still the title you hold').toBe(STAFF.ranks.cafe[0]);
    await page.locator('.tw-card').screenshot({ path: `test-results/ladder-card-news-${w}.png` });
    await closeCard(page);

    // ── walk up to Bean and tap Bean, the way a player does: the news is the FIRST question on the card
    const at = await page.evaluate(() => { const n = window.__town.life.residents().find((r) => r.key === 'bean'); return { x: n.x, y: n.y }; });
    await stand(page, at.x + 40, at.y + 20);
    await page.waitForFunction(() => { const e = document.querySelector('.tw-npc[data-k="bean"]'); return !!(e && !e.hidden && e.getBoundingClientRect().width); }, null, { timeout: 15000 });
    await page.waitForTimeout(400);
    const hit = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="bean"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 12 }; });
    await page.mouse.click(hit.x, hit.y);
    await page.waitForFunction((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].some((b) => b.textContent === q), STAFF.promoQ, { timeout: 10000 });
    const qs = await page.evaluate(() => [...document.querySelectorAll('#twCardBody .wd-q button')].map((b) => b.textContent));
    expect(qs[0], '⭐ the boss’s news is the first thing you can ask').toBe(STAFF.promoQ);
    await page.locator('.tw-card').screenshot({ path: `test-results/ladder-bean-card-${w}.png` });
    // the moment's clock, read in the page
    await page.evaluate(() => {
      const t0 = performance.now(), seen = { closed: 0, moment: 0 };
      const panel = document.getElementById('twPanel');
      const tick = () => { if (!seen.closed && panel.hidden) seen.closed = performance.now() - t0; if (!seen.moment && document.querySelector('.wm-moment')) seen.moment = performance.now() - t0; if (!seen.closed || !seen.moment) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      window.__promoSeen = seen;
    });
    const fx0 = await page.evaluate(() => window.__town.fx());
    await page.evaluate((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].find((b) => b.textContent === q).click(), STAFF.promoQ);
    // Bean says it, in the card, typed
    const said = STAFF.promo.bean.replace('{title}', STAFF.ranks.cafe[1]);
    await page.waitForFunction((t) => (document.querySelector('#twCardBody .wd-box p') || {}).textContent === t, said, { timeout: 8000 });
    await page.locator('.tw-card').screenshot({ path: `test-results/ladder-bean-says-${w}.png` });
    // ⭐ then the card closes BY ITSELF, and only then PROMOTED
    await page.waitForFunction(() => document.getElementById('twPanel').hidden, null, { timeout: 8000 });
    await page.waitForSelector('.wm-moment', { timeout: 4000 });
    const seen = await page.evaluate(() => window.__promoSeen);
    expect(seen.moment, '⭐ the card closes FIRST, then the splash').toBeGreaterThan(seen.closed);
    const m = await page.evaluate(() => { const e = document.querySelector('.wm-moment'), v = document.getElementById('twView').getBoundingClientRect(), r = e.getBoundingClientRect(); return { title: e.querySelector('b').textContent, sub: (e.querySelector('small') || {}).textContent || '', inside: r.left >= v.left - 1 && r.right <= v.right + 1 }; });
    expect(m.title, 'the big word').toBe(STAFF.promoMoment);
    expect(m.sub, 'your new title, and where').toBe(STAFF.promoLine.replace('{title}', STAFF.ranks.cafe[1]).replace('{where}', LIFE.work.at.cafe));
    expect(m.inside, 'inside the world on a phone').toBe(true);
    expect(await page.evaluate(() => window.__town.fx()), 'a burst over your banana').toBeGreaterThan(fx0);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `test-results/ladder-promoted-${w}.png` });
    // the server was asked, once, for the café
    expect(sent, 'one promotion asked of the pass worker, at the café').toEqual([{ credId: 'c', token: 't', at: 'cafe' }]);
    expect(await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_promo').map((e) => e[1])), 'Pulse hears it').toEqual([{ at: 'cafe', rank: 2 }]);

    // ── after: the new rank everywhere it is shown
    expect(await page.evaluate(() => window.__town.work.ladder()), 'the rank is yours').toMatchObject({ rank: 2, news: false });
    await page.waitForFunction((t) => window.__town.duties.top().indexOf(t) === 0, STAFF.ranks.cafe[1], { timeout: 5000 });
    expect(await page.evaluate(() => window.__town.duties.kind()), 'the note is itself again').not.toBe('news');
    expect(await page.evaluate(() => window.__town.duties.top()), 'with the new title and the new rank’s tips cap').toContain('/' + tipsCap('cafe', 2));
    await page.waitForTimeout(4600);   // the moment goes
    await page.evaluate(() => window.__town.staffOpen('cafe', 'note'));
    c = await card(page);
    expect(c.title).toBe(STAFF.ranks.cafe[1]);
    expect([c.pips, c.on], 'two of four lit').toEqual([4, 2]);
    expect(c.text, 'the tips cap rose with the rank').toContain('/ ' + tipsCap('cafe', 2));
    await page.locator('.tw-card').screenshot({ path: `test-results/ladder-card-r2-${w}.png` });
    await closeCard(page);

    // ── Bean has nothing more to tell: no news question on the card (Bean has walked on by now: find Bean again)
    const at2 = await page.evaluate(() => { const n = window.__town.life.residents().find((r) => r.key === 'bean'); return { x: n.x, y: n.y }; });
    await stand(page, at2.x + 40, at2.y + 20);
    await page.waitForTimeout(500);
    const hit2 = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="bean"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 12 }; });
    await page.mouse.click(hit2.x, hit2.y);
    await page.waitForFunction(() => document.querySelectorAll('#twCardBody .wd-q button').length > 0, null, { timeout: 10000 });
    const qs2 = await page.evaluate(() => [...document.querySelectorAll('#twCardBody .wd-q button')].map((b) => b.textContent));
    expect(qs2, 'the news was told').not.toContain(STAFF.promoQ);
    expect(errs).toEqual([]);
  });
}

// the payslip jobs climb the same ladder: a chore's XP moves the note's bar at once, and the card says what a full week pays next
test('at the arcade a sweep is work XP on the note’s bar, and the card says what the next rank pays', async ({ page }) => {
  test.setTimeout(60000);
  const { errs } = await town(page, 393, 852);
  await page.evaluate(() => window.__town.work.set({ at: 'condo' }));
  await page.waitForFunction((t) => window.__town.duties.top().indexOf(t) === 0, STAFF.ranks.condo[0], { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.duties.xp()), 'nothing yet').toBe('0.0%');
  await page.evaluate(() => window.__town.work.chore('sweep'));
  // the day's ten and the day's piece of litter's forty-five, of the three hundred to the next rank
  expect(await page.evaluate(() => window.__town.work.ladder()), 'fifty-five work XP').toMatchObject({ xp: 55, today: 55 });
  await page.waitForFunction((x) => window.__town.duties.xp() === x, (55 / 300 * 100).toFixed(1) + '%', { timeout: 3000 });
  await page.evaluate(() => window.__town.staffOpen('condo', 'note'));
  const c = await card(page);
  expect(c.title).toBe(STAFF.ranks.condo[0]);
  expect([c.pips, c.on], 'five ranks at the arcade').toEqual([5, 1]);
  expect(c.text, 'the next rank’s title and its full week (120 × 1.2)').toContain(STAFF.nextWeek.replace('{title}', STAFF.ranks.condo[1]).replace('{coins}', '144'));
  await page.locator('.tw-card').screenshot({ path: 'test-results/ladder-card-arcade.png' });
  expect(errs).toEqual([]);
});

// ↕ THE WEEKLY REVIEW (23 Sep 2026). Trym: "you should also be able to be demoted, or fired … if you want to be great and
// stay great you must do a good job". A poor week under your rank's line leaves the boss a WORD — a warning, and the next
// time a demotion (the rank has moved on the server already). The note turns the nudge's colour, the card says so, and the
// first question on the boss's card is "You wanted a word?".
test('a warning, then a demotion, heard at Bean — and the card and the note say where you stand', async ({ page }) => {
  test.setTimeout(90000);
  const { errs } = await town(page, 393, 852);
  await page.route('**/job/promote', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...view({ xp: 220, rank: 2, today: 0, news: false, warn: true, talk: '' }), promoted: null, heard: 'warn' }) }));
  // ── warned: a poor week took 80 back and left 220 under the second rank's 250
  await page.evaluate(() => window.__town.work.setLad({ xp: 220, rank: 2, today: 0, warn: true, talk: 'warn', last: { v: 'poor', xp: -80 } }));
  await page.waitForFunction((l) => window.__town.duties.line() === l, STAFF.word.cafe, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.duties.kind()), 'the note wears the nudge’s colour').toBe('word');
  await page.screenshot({ path: 'test-results/ladder-note-word.png' });
  await page.evaluate(() => window.__town.staffOpen('cafe', 'note'));
  let c = await card(page);
  expect(c.title, 'still the rank you hold').toBe(STAFF.ranks.cafe[1]);
  expect(c.text, 'the boss’s word waits').toContain(STAFF.word.cafe);
  expect(c.text, 'the warning stands').toContain(STAFF.warnCard);
  expect(c.text, 'and last week is on the card').toContain(STAFF.last.poor.replace('{xp}', '80'));
  expect(c.text, 'the XP counts toward climbing back over your own rank’s line').toContain('/ ' + xpAt('cafe', 2));
  expect(await page.evaluate(() => !!document.querySelector('#twCardBody .tws-xp .tws-bar.is-under')), 'on an amber bar').toBe(true);
  expect(c.news, 'no promotion').toBe(false);
  await page.locator('.tw-card').screenshot({ path: 'test-results/ladder-card-warned.png' });
  await closeCard(page);

  // ── at Bean: "You wanted a word?" first; the warning names the rank you would drop to
  const at = await page.evaluate(() => { const n = window.__town.life.residents().find((r) => r.key === 'bean'); return { x: n.x, y: n.y }; });
  await stand(page, at.x + 40, at.y + 20);
  await page.waitForTimeout(500);
  const hit = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="bean"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 12 }; });
  await page.mouse.click(hit.x, hit.y);
  await page.waitForFunction((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].some((b) => b.textContent === q), STAFF.wordQ, { timeout: 10000 });
  expect((await page.evaluate(() => [...document.querySelectorAll('#twCardBody .wd-q button')].map((b) => b.textContent)))[0], '⭐ the boss’s word is the first thing to ask').toBe(STAFF.wordQ);
  await page.evaluate((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].find((b) => b.textContent === q).click(), STAFF.wordQ);
  const warned = STAFF.warn.bean.replace('{title}', STAFF.ranks.cafe[0]);
  await page.waitForFunction((t) => (document.querySelector('#twCardBody .wd-box p') || {}).textContent === t, warned, { timeout: 8000 });
  await page.locator('.tw-card').screenshot({ path: 'test-results/ladder-bean-warns.png' });
  expect(await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_warn').map((e) => e[1])), 'Pulse hears the warning').toEqual([{ at: 'cafe', rank: 2 }]);
  expect(await page.evaluate(() => window.__town.work.ladder()), 'heard: no word waiting, the warning still stands').toMatchObject({ talk: '', warn: true, rank: 2 });
  await closeCard(page);

  // ── another poor week: the server has moved you down; Bean tells you
  await page.unroute('**/job/promote');
  await page.route('**/job/promote', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...view({ xp: 150, rank: 1, today: 0, news: false, warn: false, talk: '' }), promoted: null, heard: 'demoted' }) }));
  await page.evaluate(() => window.__town.work.setLad({ xp: 150, rank: 1, today: 0, warn: false, talk: 'demoted', last: { v: 'poor', xp: -80 } }));
  await page.waitForFunction((l) => window.__town.duties.line() === l, STAFF.word.cafe, { timeout: 5000 });
  await page.waitForFunction((t) => window.__town.duties.top().indexOf(t) === 0, STAFF.ranks.cafe[0], { timeout: 5000 });
  // Bean has walked on by now: find Bean again
  const at2 = await page.evaluate(() => { const n = window.__town.life.residents().find((r) => r.key === 'bean'); return { x: n.x, y: n.y }; });
  await stand(page, at2.x + 40, at2.y + 20);
  await page.waitForTimeout(500);
  const hit2 = await page.evaluate(() => { const r = document.querySelector('.tw-npc[data-k="bean"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 12 }; });
  await page.mouse.click(hit2.x, hit2.y);
  await page.waitForFunction((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].some((b) => b.textContent === q), STAFF.wordQ, { timeout: 10000 });
  await page.evaluate((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].find((b) => b.textContent === q).click(), STAFF.wordQ);
  const demoted = STAFF.demoted.bean.replace('{title}', STAFF.ranks.cafe[0]);
  await page.waitForFunction((t) => (document.querySelector('#twCardBody .wd-box p') || {}).textContent === t, demoted, { timeout: 8000 });
  await page.locator('.tw-card').screenshot({ path: 'test-results/ladder-bean-demotes.png' });
  expect(await page.waitForFunction(() => document.getElementById('twPanel').hidden === false, null, { timeout: 2000 }).then(() => true), 'no big moment: the card stays until you close it').toBe(true);
  expect(await page.locator('.wm-moment').count(), 'a demotion is said, never celebrated').toBe(0);
  expect(await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_demote').map((e) => e[1])), 'Pulse hears the demotion').toEqual([{ at: 'cafe', rank: 1 }]);
  await closeCard(page);
  await page.evaluate(() => window.__town.staffOpen('cafe', 'note'));
  c = await card(page);
  expect(c.title, 'the card has the first rank’s title').toBe(STAFF.ranks.cafe[0]);
  expect(c.text, 'and the first rank’s tips cap').toContain('/ ' + tipsCap('cafe', 1));
  expect(c.text, 'no word waiting any more').not.toContain(STAFF.word.cafe);
  await closeCard(page);
  // ── a Thursday with nothing done: the Coffee Cup nudges too, now that a counter can be let go
  await page.evaluate(() => window.__town.work.set({ at: 'cafe', nudge: true }));
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.nudge.cafe, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.duties.kind())).toBe('nudge');
  expect(errs).toEqual([]);
});
