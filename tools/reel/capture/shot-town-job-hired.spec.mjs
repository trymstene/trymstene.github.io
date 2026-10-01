// "He got a job." (the moment itself) — our banana asks Bean for work at the Coffee Cup: Bean's own dialogue card (his
// portrait, his line, the questions), "May I work here?" tapped, his yes types out, the card closes itself, and the town
// celebrates the way it does for every hire (banana-town.js hiredMoment): a burst over our banana and the big moment
// HIRED · YOU WORK AT THE COFFEE CUP NOW over the square.
// Real taps on the town (on Bean, then on the question). The hire's request (worker-pass /job/take) is aborted like every
// worker call here, so the hire stands on the device's own mirror — exactly what a player sees before the answer lands.
import { test } from '@playwright/test';
import { pause, wait } from './harness.mjs';
import { town, rollSync, onPage, notes, boxPx, worldPx, tidy } from './town-day-helpers.mjs';

const VW = 640, VH = 1138;
test.use({ viewport: { width: VW, height: VH + 100 }, deviceScaleFactor: 2 });

test('town-job-hired', async ({ page }) => {
  test.setTimeout(10 * 60000);
  await town(page, { w: VW, h: VH, hour: 6, health: 92 });   // ☀ the morning beat: Bean is at his own counter
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.folk().fill(5, performance.now()));
  await page.addStyleTag({ content: '#twView>:not(#twWorld):not(#twFx):not(.tw-night):not(#twPanel):not(.wm-moment){visibility:hidden!important}.tw-toast{visibility:hidden!important}' });
  await page.waitForTimeout(1200);
  await pause(page);
  await wait(page, 3000);
  console.log('tidied', JSON.stringify(await tidy(page, [1460, 140, 2200, 1300])));
  // our banana a few steps from the café, and a tap on Bean: the walk, then his card (banana-town.js talkTo)
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 1640; t.pos.y = t.tgt.y = 1110; });
  await wait(page, 1500);
  const bean = await page.evaluate(() => window.__town.life.residents().find((r) => r.key === 'bean'));
  console.log('bean', JSON.stringify(bean));
  const p = await onPage(page, bean.x, bean.y - 40);
  await page.mouse.click(p.x, p.y);
  for (let k = 0; k < 40 && !(await page.evaluate(() => !document.getElementById('twPanel').hidden)); k++) await wait(page, 100);
  await wait(page, 1600);   // his line typed, the questions up
  const ask = page.locator('#twCardBody .wd-q button', { hasText: 'May I work here?' });
  if (!(await ask.count())) throw new Error('no job question on Bean\'s card: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#twCardBody .wd-q button')].map((b) => b.textContent))));
  const q = await ask.boundingBox();
  const clip = { x: 0, y: 0, width: VW, height: VH };
  const card = await boxPx(page, '.tw-card', clip);
  const ev = { ask: 10, closed: -1, moment: -1 };
  let moment = null;
  await rollSync(page, {
    secs: 6,
    views: [{ name: 'town-job-hired', clip }],
    each: async (i) => {
      if (i === ev.ask) await page.mouse.click(q.x + q.width / 2, q.y + q.height / 2);
      const st = await page.evaluate(() => ({ card: !document.getElementById('twPanel').hidden, moment: !!document.querySelector('.wm-moment'), job: window.__town.work.job().at }));
      if (ev.closed < 0 && i > ev.ask && !st.card) ev.closed = i;
      if (ev.moment < 0 && st.moment) { ev.moment = i; moment = await boxPx(page, '.wm-moment', clip); }
      if (i % 20 === 0) console.log(i, JSON.stringify(st));
    },
  });
  console.log(JSON.stringify(ev));
  if (ev.moment < 0) throw new Error('the hire never went up on film');
  const me = await page.evaluate(() => ({ x: window.__town.pos.x, y: window.__town.pos.y }));
  const mePx = await worldPx(page, me.x, me.y - 45, clip);
  notes('town-job-hired', {
    what: `The hire itself: Bean's dialogue card at the Coffee Cup (his portrait, his line, the questions), "May I work here?" tapped, his yes types out — "Gladly, the Coffee Cup could use your hands." — the card closes itself, and the square celebrates: a burst over our banana and the big moment HIRED · YOU WORK AT THE COFFEE CUP NOW.`,
    best: [
      { from: Math.max(0, ev.ask - 4), to: Math.min(179, ev.moment + 60), why: 'the question, the yes, the card closing, HIRED going up' },
      { from: Math.max(0, ev.moment - 6), to: Math.min(179, ev.moment + 70), why: 'HIRED over the square with the burst over our banana' },
    ],
    focus: [
      { frame: ev.ask + 20, x: card.x, y: card.y, what: `Bean's card, his yes typing out` },
      ...(moment ? [{ frame: ev.moment + 8, x: moment.x, y: moment.y, what: 'HIRED · YOU WORK AT THE COFFEE CUP NOW' }] : []),
      { frame: ev.moment + 4, x: mePx.x, y: mePx.y, what: 'our banana under the burst, beside Bean at the café' },
    ],
    issues: `The game's own words on screen (the card's lines, and HIRED / YOU WORK AT THE COFFEE CUP NOW — banana-town.js hiredMoment, town-life.json work.moment) — it says what the trailer's "He got a job." says, so it may be used instead of the caption or not at all. The card is UI over the dimmed square. The hire's server call is aborted (the device's own mirror shows the hire, as it does for a player before the answer lands). HUD, toasts and the work note that appears after the hire are hidden.`,
  });
});
