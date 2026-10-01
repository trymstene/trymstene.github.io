// 🐕 HOME-DOG — "He adopted a dog." The emotional beat: she is asleep in her doghouse by the house; our banana comes home
// up from the road, and the moment he steps onto his land she is out of the doghouse and running to meet him — a heart
// over her and three happy barks (her own greet mood, homestead-dog.js: an INWARD crossing of the plot edge). Then he pets
// her (a player's tap): the yard's mood bubble with its heart, the day's hug heart, and a woof back.
// Staging is the yard's QA seam only: dogMood puts her to sleep in her doghouse before he arrives and keeps her own
// interruptions (the check-in, the leash) off until the greet.
import { test } from '@playwright/test';
import { roll } from './harness.mjs';
import { yard, openYard, settleAndPause, viewBox, waitSync, tapWorld, notes, dev, DOGHOUSE, VIEW_W, VIEW_H } from './homestead-helpers.mjs';

test.use({ viewport: { width: VIEW_W + 40, height: VIEW_H + 60 }, deviceScaleFactor: 2 });

const NAME = 'home-dog';
const PATH_X = 800;          // he walks home straight up from the road here: the house and her doghouse in frame
const STOP_Y = 690;

test(NAME, async ({ page }) => {
  test.setTimeout(900000);
  const errs = await openYard(page, yard());
  await page.waitForFunction(() => window.__hs.dog() && window.__hs.cat(), null, { timeout: 60000 });
  await settleAndPause(page, 2500);
  await page.evaluate(() => { window.__hs.feed(); });   // the trough was filled today: her mood bubble is a heart
  // he is out on the road; the herd wanders out from the coop to the spots they were set down in (their ✥ pins)
  await page.evaluate(([x]) => window.__hs.warp(x, 905), [PATH_X]);
  await page.evaluate(() => window.__hs.dogMood('linger', { until: 1e12, heelAt: 1e12, greetAt: 1e12, cd: 1e12, pMoveAt: 1e12, wasIn: false, calm: true }));
  await waitSync(page, 80000);
  await page.evaluate(() => window.__hs.catMood('nap', 0, { visitAt: 1e12, calm: true, at: [745, 505] }));
  // asleep in her doghouse; he is out on the road (wasIn false), nothing else will move her first
  await page.evaluate(([hx, hy]) => window.__hs.dogMood('nap', { at: [hx + 6, hy + 16], heelAt: 1e12, greetAt: 0, cd: 1e12, wasIn: false, calm: true }), [DOGHOUSE.x, DOGHOUSE.y]);
  await waitSync(page, 3000);
  const v = await viewBox(page);
  const log = [];
  let barked = -1, tapped = -1, lingerAt = -1, metAt = null;
  await roll(page, {
    name: NAME, secs: 7,
    clip: { x: v.x, y: v.y, width: v.width, height: v.height },
    each: async (i) => {
      if (i === 10) await page.evaluate(([x, y]) => { window.__hs.tgt.x = x; window.__hs.tgt.y = y; }, [PATH_X, STOP_Y]);
      const d = await page.evaluate(() => window.__hs.dog());
      if (d.m === 'bark' && barked < 0) { barked = i; metAt = [Math.round(d.x), Math.round(d.y)]; }
      // the bark is over and she stands wagging at his side: he pets her
      if (d.m === 'linger' && barked >= 0 && lingerAt < 0) lingerAt = i;
      if (lingerAt >= 0 && tapped < 0 && i >= lingerAt + 14) { tapped = i; await tapWorld(page, d.x, d.y - 14); }
      log.push(i + ':' + d.m + '/' + (d.strip || '').replace('c-dog-', '').replace('.png', '') + (d.napping ? 'Z' : ''));
    },
  });
  console.log(log.join(' '));
  console.log('barked', barked, 'tapped', tapped, 'met', JSON.stringify(metAt), 'cam', v.camX);
  console.log('errors', JSON.stringify(errs));
  const run = log.findIndex((r) => r.includes('greet'));
  notes(NAME, {
    what: 'The dog asleep in her doghouse; our banana comes home up from the road, she is out and running to meet him, a heart and three happy barks; then he pets her: the heart bubble, a heart, a woof back.',
    frames: log.length, fps: 30, camera: 'static (the game camera, centred on his path); clip = the whole 760x1100 view at DPR 2',
    best: [
      { from: 4, to: barked + 46, why: 'asleep in her doghouse (breathing) -> he steps onto his land -> she bursts out and runs to him -> heart over her, she barks at his side' },
      { from: run - 6, to: barked + 30, why: 'the tight version: the run and the heart' },
      { from: tapped - 8, to: Math.min(log.length - 1, tapped + 40), why: 'he pets her: a white bubble with a heart over her, a heart floats up, she woofs back' },
    ],
    focus: [
      { frame: 8, ...dev(v, DOGHOUSE.x, DOGHOUSE.y - 40), what: 'the doghouse, her sleeping head in the door' },
      { frame: run + 2, ...dev(v, DOGHOUSE.x + 6, DOGHOUSE.y), what: 'she bursts out of the doghouse' },
      { frame: barked + 2, ...dev(v, metAt[0] + 25, metAt[1] - 40), what: 'the meeting: dog, heart, banana' },
      { frame: tapped + 6, ...dev(v, metAt[0], metAt[1] - 45), what: 'the heart bubble over her' },
    ],
    issues: "The hearts are the game's own small 15 px floats (they rise and fade in ~1 s): push in (up to ~1.6x) around the meeting point for them to read. Everything moves at the game's own speed; its CSS animations (heart float, bubble fade, doghouse breathing) were stepped on the same clock as the world. No HUD, no words on screen.",
  });
});
