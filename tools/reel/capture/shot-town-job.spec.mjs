// "He got a job." — our banana working the Coffee Cup's counter: he stands in the giant coffee cup's serving hatch, the
// square's own visitors queue at the rope, each cup is made with the counter's three real gestures (grind, pour, milk —
// pressed at their perfect instants on the stepped clock), a "+2" tip floats up from the hatch, and the served customer
// walks off with the mug while the next one steps up and another joins the queue.
// Two views of ONE timeline: town-job (the world only) and town-job-tray (the same frames with the counter's tray, the
// mini-game a player thumbs, at the bottom of the view).
import { test } from '@playwright/test';
import { pause, wait } from './harness.mjs';
import { town, rollSync, tidy, notes, boxPx, worldPx } from './town-day-helpers.mjs';

const VW = 640, VH = 1138;
test.use({ viewport: { width: VW, height: VH + 100 }, deviceScaleFactor: 2 });

// one 32 ms step of a barista with perfect timing: the next order up, a sweep or a pulse pressed at its perfect instant,
// a pour held and let go at its line (town-cafe.js mountCounter's own seam: press/release/best — the walks' thumb)
// ⚠️ never the same instant twice: a pulse's perfect moment comes round once a span, and a thumb taps it once
const barista = () => {
  const c = window.__town.room.cafe(), g = c && c.gest();
  if (!g) return '';
  const now = performance.now(), last = window.__capLast || -1e9;
  if (!c.cup()) { c.serve(); return c.cup() ? 'serve' : ''; }
  const key = g.station(), cup = c.cup();
  if (!key) return '';
  if (key === 'pour') {
    if (!cup.held) { if (now - last < 150) return ''; g.press(now); window.__capLast = now; return 'hold'; }
    const t = g.best(now);
    if (t <= now + 32) { g.release(t); window.__capLast = t; return 'poured'; }
    return '';
  }
  const t = g.best(now);
  if (t <= now + 32 && t - last > 300) { g.press(t); window.__capLast = t; return 'pressed ' + key; }
  return '';
};
// how long until the barista's next press is due (the pre-roll stops a beat before the first cup is finished)
const due = () => { const c = window.__town.room.cafe(), g = c.gest(), cup = c.cup(); if (!g || !cup) return { key: '', taps: 0, in: 1e9 }; const now = performance.now(); return { key: g.station(), taps: cup.taps.length, in: g.best(now) - now }; };
const queue = (page) => page.evaluate(() => window.__town.room.cafe().line());

test('town-job', async ({ page }) => {
  test.setTimeout(10 * 60000);
  // ☀ the morning beat: Bean steps aside to the terrace while you work his counter, and Moss sweeps the hall, not the café
  await town(page, { w: VW, h: VH, hour: 6, health: 92 });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(7, performance.now()));
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 10000 });
  // the counter's own QA switch: nobody comes unless called, so the shot decides when the next customer sets off
  await page.evaluate(() => window.__town.room.cafe().quiet(true));
  await page.addStyleTag({ content: [
    '#twView>:not(#twWorld):not(#twFx):not(.tw-night):not(.tw-cup){visibility:hidden!important}',
    '.tw-toast{visibility:hidden!important}',
    'html:not([data-cap="tray"]) #twView>.tw-cup{visibility:hidden!important}',
  ].join('') });
  await page.waitForTimeout(1500);   // real time: the chunks and pictures arrive
  await pause(page);
  // the square fills and two customers walk to the rope (fast-forwarded on the game's own clock)
  await wait(page, 5000);
  for (let k = 0; k < 2; k++) { await page.evaluate(() => window.__town.room.cafe().call()); await wait(page, 600); }
  for (let k = 0; k < 60 && !(await queue(page)).every((q) => q.waiting); k++) await wait(page, 500);
  // 🧹 the corner tidied the way a player tidies it (the room's own fix: a bin bag seeded beside the hatch read as a mess
  // on the counter, not as the job), and its puffs and bursts done with before the roll
  console.log('tidied', JSON.stringify(await tidy(page, [1460, 140, 2200, 1300])));
  await wait(page, 2500);
  // the first cup, made up to half a second before its last tap of milk
  for (let k = 0; k < 400; k++) {
    const at = await page.evaluate(due);
    if (at.key === 'milk' && at.taps >= 2 && at.in < 520 && at.in > 380) break;
    await page.evaluate(barista);
    await wait(page, 32);
  }
  // a third customer sets off now, so the rope is never empty while the shot runs
  await page.evaluate(() => window.__town.room.cafe().call());
  console.log('queue', JSON.stringify(await queue(page)));
  const view = await page.locator('#twView').boundingBox();
  const clip = { x: Math.round(view.x), y: Math.round(view.y), width: VW, height: VH };
  // where things are in the frame (the camera holds still while the shift is on)
  const hatch = await worldPx(page, 1829, 990, clip), tip = await worldPx(page, 1830, 930, clip), rope = await worldPx(page, 1752, 1030, clip);
  const log = [], cups = [];
  let tray = null, gauge = null;
  await rollSync(page, {
    secs: 6,
    views: [{ name: 'town-job', clip, cap: '' }, { name: 'town-job-tray', clip, cap: 'tray' }],
    each: async (i) => {
      const before = (await page.evaluate(() => window.__town.room.cafe().take())).served;
      const s = await page.evaluate(barista);
      if (s) log.push(i + ':' + s);
      if ((await page.evaluate(() => window.__town.room.cafe().take())).served > before) cups.push(i);   // the cup is served in this frame: +2 floats from it
      if (i === 70) await page.evaluate(() => window.__town.room.cafe().call());   // and a fourth: the queue keeps coming
      if (i === 60) { tray = await boxPx(page, '.tw-cup', clip); gauge = await boxPx(page, '.tw-cup__bar', clip); }
      if (i % 30 === 0) log.push(i + ' line ' + JSON.stringify(await queue(page)));
    },
  });
  console.log(log.join('\n'));
  console.log('cups served at frames', JSON.stringify(cups), 'hatch', JSON.stringify(hatch));
  if (cups.length < 2) throw new Error('only ' + cups.length + ' cup(s) served on film: re-take (try another rng)');
  const [c1, c2] = cups;
  notes('town-job', {
    what: 'Our banana on shift in the Coffee Cup — the giant coffee cup kiosk — standing in its serving hatch (hands up, the counter\'s locked pose) while the square\'s visitors queue at the rope. Two cups are made with the counter\'s real gestures (the tray is hidden in this view); each one floats a "+2" tip up off the COFFEE AND TEA sign and the customer walks off holding the mug while the next steps up.',
    best: [
      { from: Math.max(0, c1 - 8), to: Math.min(179, c1 + 55), why: 'cup served: +2 floats up from the hatch, the white-capped customer takes the mug and walks off, the party-hat one steps up' },
      { from: Math.max(0, c2 - 12), to: 179, why: 'the second cup: +2 again, and the party-hat customer leaves with the mug' },
    ],
    focus: [
      { frame: c1, x: hatch.x, y: hatch.y, what: 'our banana in the serving hatch' },
      { frame: c1 + 8, x: tip.x, y: tip.y - 30, what: 'the +2 tip float rising over the sign' },
      { frame: c1 + 20, x: rope.x - 60, y: rope.y + 40, what: 'the served customer walking off with the mug' },
      { frame: c2 + 8, x: tip.x, y: tip.y - 30, what: 'the second +2' },
    ],
    issues: 'True scale: the world is 2 device px per world px (the game\'s own layout at scale 1, its own camera, which holds still during a shift). The banana in the hatch is small (~60 px tall in the frame): push in on the kiosk (x 480-800, y 1450-1900 holds the kiosk, the hatch and the queue). The post office fills the top third; the terrace benches the bottom. Cups take the game\'s real time (about 4.5 s each, perfect timing), so there are two payoffs, at frames ' + c1 + ' and ' + c2 + '. town-job-tray is the same frames WITH the counter\'s tray (the mini-game: "Tap to grind", "Hold to pour", "Tap to foam" and the needle gauge). HUD, toasts and the work note are hidden; bursts/floats are the game\'s own. CSS animations are stepped with the clock (32 ms a frame).',
  });
  notes('town-job-tray', {
    what: 'The same frames as town-job with the Coffee Cup counter\'s tray at the bottom of the view: the cup\'s three real gestures played at their perfect instants — the grinder needle stopped in its band, the pour held to its line, three taps of milk foam on the pulse — and the cup served.',
    best: [
      { from: Math.max(0, c1 - 10), to: Math.min(179, c1 + 30), why: 'the last tap of foam lands and the cup is served (+2 in the world)' },
      { from: Math.min(179, c1 + 20), to: Math.min(179, c1 + 75), why: 'the next order: the needle sweeps, Tap to grind, then Hold to pour fills the bar' },
      { from: Math.max(0, c2 - 70), to: Math.min(179, c2 + 5), why: 'Tap to foam: three taps on the pulse, the cup done' },
    ],
    focus: tray ? [{ frame: 60, x: gauge ? gauge.x : tray.x, y: gauge ? gauge.y : tray.y, what: 'the gauge and its band' }, { frame: 60, x: tray.x, y: tray.y, what: 'the whole tray (' + tray.w + '×' + tray.h + ' px)' }] : [],
    issues: 'The tray is UI: readable at phone size as a mini-game, but its words are small. It sits on the bottom ' + (tray ? tray.h : 300) + ' px of the frame; the world above it is the same as town-job.',
  });
});
