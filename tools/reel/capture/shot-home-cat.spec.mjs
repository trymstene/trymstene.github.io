// 🐈 HOME-CAT — "The cat adopted him." Our banana stands in front of his house; the cat, sitting a little way off watching
// him with her tail going, decides it is time: she walks over, a heart floats up, and she sits at his feet purring
// (homestead-cat.js `visit`: only once you have stood still a while, and only when she feels like it — the seam sets
// her clock to now). The dog naps in her doghouse beside them; the herd potters about on the right.
import { test } from '@playwright/test';
import { roll } from './harness.mjs';
import { yard, openYard, settleAndPause, viewBox, waitSync, notes, dev, DOGHOUSE, VIEW_W, VIEW_H } from './homestead-helpers.mjs';

test.use({ viewport: { width: VIEW_W + 40, height: VIEW_H + 60 }, deviceScaleFactor: 2 });

const NAME = 'home-cat';
const ME = { x: 700, y: 610 };        // in front of the porch
const CAT_AT = [604, 598];            // a little way off, on his left

test(NAME, async ({ page }) => {
  test.setTimeout(900000);
  const errs = await openYard(page, yard());
  await page.waitForFunction(() => window.__hs.dog() && window.__hs.cat(), null, { timeout: 60000 });
  await settleAndPause(page, 2500);
  await page.evaluate(() => { window.__hs.feed(); });
  await page.evaluate(([x, y]) => window.__hs.warp(x, y), [ME.x, ME.y]);
  await page.evaluate(() => window.__hs.dogMood('linger', { at: [560, 640], until: 1e12, heelAt: 1e12, greetAt: 1e12, cd: 1e12, pMoveAt: 1e12, calm: true }));
  await page.evaluate(() => window.__hs.catMood('sit', 1e9, { at: [604, 598], visitAt: 1e12, calm: true }));
  await waitSync(page, 80000);   // the herd wanders out from the coop to where each was set down
  // the dog asleep in her doghouse, the cat sitting watching him; he has been standing here a while (still > 5 s)
  await page.evaluate(([hx, hy]) => window.__hs.dogMood('nap', { at: [hx + 6, hy + 16], heelAt: 1e12, greetAt: 1e12, cd: 1e12, pMoveAt: 1e12, calm: true }), [DOGHOUSE.x, DOGHOUSE.y]);
  await page.evaluate((at) => window.__hs.catMood('sit', 1e9, { at, visitAt: 1e12, calm: true }), CAT_AT);
  // her doorstep gift for the day lies by the door (most mornings at her level; the seam lays it if today's roll said no)
  if (!(await page.evaluate(() => !!document.querySelector('.hs-gift')))) await page.evaluate(() => window.__hs.catGift());
  await waitSync(page, 6000);
  const v = await viewBox(page);
  const log = [];
  let heartAt = -1, lieAt = -1;
  await roll(page, {
    name: NAME, secs: 8.5,
    clip: { x: v.x, y: v.y, width: v.width, height: v.height },
    each: async (i) => {
      // her mind is made up: the visit is due now (she still only comes because he has stood still, and she is near)
      if (i === 12) await page.evaluate(() => { const c = window.__hs.cat(); window.__hs.catMood('sit', 1e9, { visitAt: c.now, calm: true }); });
      const c = await page.evaluate(() => window.__hs.cat());
      // the purr is over: of the visit's two endings (a stroll off, or down for a nap where she sits — 30%), this take
      // is the second; the seam hands her exactly what the brain's own branch does (nap, ph 1: asleep on the spot)
      if (c.m === 'visit' && c.ph === 1 && c.now + 40 >= c.until && lieAt < 0) {
        lieAt = i;
        await page.evaluate(() => { const c2 = window.__hs.cat(); window.__hs.catMood('nap', 0, { ph: 1, until: c2.now + 30000, visitAt: c2.now + 1e9, calm: true }); });
      }
      if (heartAt < 0 && c.m === 'visit' && c.strip === 'c-cathappy.png') heartAt = i;
      log.push(i + ':' + c.m + '/' + c.ph + '/' + c.strip.replace('c-cat', '').replace('.png', '') + '@' + Math.round(c.x) + ',' + Math.round(c.y));
    },
  });
  console.log(log.join(' '));
  console.log('heart', heartAt, 'lie', lieAt, 'cam', v.camX);
  console.log('errors', JSON.stringify(errs));
  const c1 = await page.evaluate(() => window.__hs.cat());
  notes(NAME, {
    what: 'The cat sits watching our banana, tail going; she makes up her mind, walks over, a heart floats up and she sits at his feet purring (facing us), then curls up asleep beside him. The dog sleeps in her doghouse beside them; her doorstep gift (a flower) glows by the door.',
    frames: log.length, fps: 30, camera: 'static (the game camera, centred on him); clip = the whole 760x1100 view at DPR 2',
    best: [
      { from: 8, to: heartAt + 40, why: 'she walks over to him on her own, heart, purr' },
      { from: heartAt - 20, to: heartAt + 60, why: 'the tight version: arriving, heart, the purr facing camera' },
      { from: lieAt - 20, to: log.length - 1, why: 'she lies down and curls up at his feet' },
    ],
    focus: [
      { frame: heartAt + 2, ...dev(v, (CAT_AT[0] + ME.x) / 2 + 10, ME.y - 40), what: 'cat + heart + banana' },
      { frame: lieAt + 10, ...dev(v, c1.x + 20, c1.y - 30), what: 'curled up at his feet' },
      { frame: 20, ...dev(v, DOGHOUSE.x, DOGHOUSE.y - 40), what: 'the dog asleep in her doghouse (context)' },
    ],
    issues: "The cat is small (a head shorter than the dog, as in the game): push in. The visit's walk is her own slow trot (~34 px/s). The heart is the game's 15 px float. Of the visit's two endings (stroll off / lie down where she sits) the seam picked the lie-down.",
  });
});
