// "He got a job." (the alternative take) — our banana on shift in Pip's General Store: a customer in a hat walks in with
// her shopping bag and waits at the counter, what she wants GLOWS on the shelf, our banana walks over and takes it (it
// rides his right hand, pumping with the dance), carries it to her, hands it over — a burst — and she walks back out.
// Played with real taps on the store's own plate (the way tests/town-serve.spec.mjs plays it), on the stepped clock.
import { test } from '@playwright/test';
import { pause, wait } from './harness.mjs';
import { town, hideUi, rollSync, onPage, notes, worldPx } from './town-day-helpers.mjs';

const VW = 640, VH = 1138;
test.use({ viewport: { width: VW, height: VH + 100 }, deviceScaleFactor: 2 });

test('town-job-store', async ({ page }) => {
  test.setTimeout(10 * 60000);
  const day = Math.floor(new Date('2026-10-01T15:00:00').getTime() / 86400000);
  // 🕛 the noon beat: Pip is down at the cash machine (town-life.js), so the shop floor is ours and the customer's
  await town(page, { w: VW, h: VH, hour: 10, health: 96, seed: {
    'tw-calls-v1': { d: day, t0: new Date('2026-10-01T14:00:00').getTime(), qa: ['serve'] },   // the day's call: customers, in already
    'tw-once-v1': { 'serve:learn': 1 },   // past the first customer's lesson pointer
  } });
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  await hideUi(page);
  await page.waitForTimeout(1000);   // real time: the chunks and pictures arrive
  await pause(page);
  await wait(page, 2000);   // the noon beat: Pip is out at the cash machine, so the shop floor is ours and the customer's
  await page.evaluate(() => { const t = window.__town, s = t.SPOTS.store; t.pos.x = t.tgt.x = s.x; t.pos.y = t.tgt.y = s.y + 30; });
  await page.evaluate(() => window.__town.rooms.enter('store'));
  for (let k = 0; k < 40 && !(await page.evaluate(() => !!window.__town.serve)); k++) await page.waitForTimeout(100);   // the customers' chunk
  await page.evaluate(() => { const t = window.__town; t.tgt.x = 590; t.tgt.y = 892; });   // a step into the shop floor
  await wait(page, 800);   // inside the store's own pause before the first customer (town-serve.js enter: 3.5 s)
  if (await page.evaluate(() => !!(window.__town.serve && window.__town.serve.want()))) throw new Error('the customer came in before the roll');
  const clip = { x: 0, y: 0, width: VW, height: VH };
  const tapWorld = async (x, y) => { const p = await onPage(page, x, y); await page.mouse.click(p.x, p.y); };
  let shelfAt = -1, custAt = -1, inAt = -1, atCounter = -1, servedAt = -1, goneAt = -1, item = '';
  const log = [];
  await rollSync(page, {
    secs: 6,
    views: [{ name: 'town-job-store', clip }],
    each: async (i) => {
      if (i === 6) await page.evaluate(() => window.__town.serve.arriveNow());   // the store's own door: the customer comes in now
      const w = await page.evaluate(() => window.__town.serve && window.__town.serve.want());
      if (w && inAt < 0) inAt = i;
      if (w && w.waiting && shelfAt < 0 && i > 2) {   // she is at the counter: go and get it
        shelfAt = atCounter = i; item = w.id;
        const f = await page.evaluate((k) => window.__town.rooms.of('store').spots.find((q) => q[0] === k), w.face);
        await tapWorld((f[1] + f[3]) / 2, (f[2] + f[4]) / 2);
        log.push(i + ' tap shelf ' + w.face + ' for ' + w.id);
      }
      if (shelfAt >= 0 && custAt < 0) {
        const held = await page.evaluate(() => window.__town.serve.carrying());
        if (held) { custAt = i; await tapWorld(w.x, w.y - 40); log.push(i + ' carrying ' + held + ', tap customer'); }
      }
      const st = await page.evaluate(() => ({ served: window.__town.serve.served(), leaving: window.__town.serve.leaving() }));
      if (servedAt < 0 && st.served > 0) servedAt = i;   // handed over in the step just shot: the burst goes up
      if (servedAt >= 0 && goneAt < 0 && st.leaving === 0) goneAt = i;
      if (i % 20 === 0) log.push(i + ' ' + JSON.stringify(st) + ' pos=' + JSON.stringify(await page.evaluate(() => ({ x: Math.round(window.__town.pos.x), y: Math.round(window.__town.pos.y) }))));
    },
  });
  console.log(log.join('\n'));
  console.log('in', inAt, 'counter', atCounter, 'carry', custAt, 'served', servedAt, 'gone', goneAt);
  if (servedAt < 0) throw new Error('nobody was served on film: re-take');
  const room = await worldPx(page, 564, 812, clip), cust = await worldPx(page, 704, 830, clip), shelf = await worldPx(page, 496, 760, clip), burst = await worldPx(page, 704, 650, clip);
  const tl = await worldPx(page, 300, 620, clip), br = await worldPx(page, 828, 1004, clip);
  notes('town-job-store', {
    what: 'Our banana on shift in the General Store: a customer walks in and waits at the counter, the ' + item + ' she wants glows on the top shelf, our banana walks over, takes it (it rides his right hand, pumping with the dance), carries it to her and hands it over — a burst of confetti — and she walks back out of the door.',
    best: [
      { from: Math.max(0, inAt - 4), to: Math.min(179, (goneAt > 0 ? goneAt : servedAt + 45)), why: 'the whole errand: in, glow, fetch, carry, hand over, burst, out' },
      { from: Math.max(0, custAt - 12), to: Math.min(179, servedAt + 25), why: 'carrying it across the shop and the hand-over burst' },
    ],
    focus: [
      { frame: atCounter, x: shelf.x, y: shelf.y, what: 'the glowing ' + item + ' on the shelf' },
      { frame: custAt + 4, x: Math.round((shelf.x + cust.x) / 2), y: cust.y, what: 'our banana carrying it to her' },
      { frame: servedAt + 3, x: burst.x, y: burst.y, what: 'the burst over the customer' },
      { frame: 0, x: room.x, y: room.y, what: 'the middle of the shop' },
    ],
    issues: 'An interior: the shop is ' + (br.x - tl.x) + '×' + (br.y - tl.y) + ' px (x ' + tl.x + '-' + br.x + ', y ' + tl.y + '-' + br.y + ') in a vertical frame that is dark around it (the town is shaded while you are inside) — a 9:16 crop must be letterboxed or show the shop full-width. True scale (2 device px per world px). The burst goes up over the customer and mostly into the dark above the shop wall, as the game draws it. Noon: Pip (the boss) is out at the cash machine, so the floor is ours. The ticket tray and the work note are hidden.',
  });
});
