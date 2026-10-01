// 🏠 HOME-INSIDE — "He built a house." The furnished ground floor: lamp, fireplace with a painting over it, the bookshelf,
// the kitchen line, rug, couch, a dining table. The cat followed him in and sleeps by the fire, the dog followed him in and
// sleeps on the rug (she takes the spot the cat left her, homestead-dog.js roomSpots). Our banana stands at the kitchen
// counter and taps what is in reach: the fridge swings open on its shelves of food, a cup appears under the coffee
// machine, the toast goes down and pops back up (banana-homestead.js altTap — each piece's other state, for a moment).
import { test } from '@playwright/test';
import { roll } from './harness.mjs';
import { yard, openYard, settleAndPause, viewBox, waitSync, tapWorld, notes, dev } from './homestead-helpers.mjs';

const VW = 1000, VH = 940;   // the room is wide: 1000 x 940 still lands the game on scale 1 (see homestead-helpers.mjs)
test.use({ viewport: { width: VW + 40, height: VH + 60 }, deviceScaleFactor: 2 });

const NAME = 'home-inside';
const ME = { x: 1000, y: 560 };   // at the counter: the fridge, the coffee machine and the toaster all within reach (160)
// a tap on each, where the yard's own hit test finds it (pieceAt: a thing on a counter stands 27 px up, on its top)
const FRIDGE = { x: 1108, y: 425 }, COFFEE = { x: 1016, y: 405 }, TOASTER = { x: 984, y: 408 };

test(NAME, async ({ page }) => {
  test.setTimeout(900000);
  const errs = await openYard(page, yard(), { w: VW, h: VH });
  await page.waitForFunction(() => window.__hs.dog() && window.__hs.cat(), null, { timeout: 60000 });
  await settleAndPause(page, 2500);
  // home through the door with the two of them at his heels (each follows on her own rule: near the house, not asleep)
  await page.evaluate(() => {
    window.__hs.warp(770, 500);
    window.__hs.catMood('sit', 1e9, { at: [800, 520], visitAt: 1e12, calm: true });
    window.__hs.dogMood('linger', { at: [730, 530], until: 1e12, heelAt: 1e12, greetAt: 1e12, cd: 1e12, pMoveAt: 1e12, calm: true });
  });
  await waitSync(page, 1500);
  await page.evaluate(() => window.__hs.enter());
  await waitSync(page, 600);
  await page.evaluate(([x, y]) => window.__hs.warp(x, y), [ME.x, ME.y]);
  await waitSync(page, 1000);
  // the cat lies down first (her spot: the fire, else a rug, else up on the couch); then the dog, who never takes hers
  await page.evaluate(() => window.__hs.catRoomMood('nap', { calm: true }));
  for (let k = 0; k < 60; k++) { const c = await page.evaluate(() => window.__hs.catRoom()); if (c && c.ph === 1) break; await waitSync(page, 300); }
  await page.evaluate(() => window.__hs.dogRoomMood('nap', { calm: true }));
  for (let k = 0; k < 60; k++) { const d = await page.evaluate(() => window.__hs.dogRoom()); if (d && d.ph === 1) break; await waitSync(page, 300); }
  await waitSync(page, 1500);
  const pets = await page.evaluate(() => ({ cat: window.__hs.catRoom(), dog: window.__hs.dogRoom() }));
  console.log('pets', JSON.stringify(pets));
  const v = await viewBox(page);
  const taps = { 12: FRIDGE, 46: COFFEE, 80: TOASTER };
  await roll(page, {
    name: NAME, secs: 4.5,
    clip: { x: v.x, y: v.y, width: v.width, height: v.height },
    each: async (i) => { if (taps[i]) await tapWorld(page, taps[i].x, taps[i].y); },
  });
  console.log('cam', v.camX, v.camY, 'still asleep', JSON.stringify(await page.evaluate(() => [window.__hs.catRoom().strip, window.__hs.dogRoom().strip])));
  console.log('errors', JSON.stringify(errs));
  // where each lay down is her own pick (the fire, the rug, up on the couch): say this take's
  const spot = (p) => (p.up ? 'up on the couch' : p.y < 520 ? 'by the fire' : p.y < 630 ? 'on the rug' : 'on the floor');
  const lay = 'the cat sleeps ' + spot(pets.cat) + ', the dog ' + spot(pets.dog);
  notes(NAME, {
    what: 'Inside his house: lamp, fireplace, bookshelf, the kitchen line, rug, couch, armchair, table; ' + lay + '. At the counter our banana opens the fridge (shelves of food), a cup appears under the coffee machine, the toast goes down and pops up.',
    frames: Math.round(4.5 * 30), fps: 30, camera: 'static (the game camera); clip = the whole 1000x940 view at DPR 2 — the room is the lit box, the rest is the game\'s own dark shade over the yard',
    best: [
      { from: 6, to: 40, why: 'the fridge swings open (a 1-second cut)' },
      { from: 0, to: 134, why: 'the cosy room: both pets asleep, three kitchen things answering his taps' },
      { from: 76, to: 120, why: 'the toast goes down (frame 80) and pops back up (~frame 122)' },
    ],
    focus: [
      { frame: 14, ...dev(v, 1110, 420), what: 'the open fridge' },
      { frame: 50, ...dev(v, 1000, 410), what: 'coffee machine and toaster on the counter' },
      { frame: 30, ...dev(v, pets.cat.x, pets.cat.y - 12), what: 'the cat, ' + spot(pets.cat) },
      { frame: 30, ...dev(v, pets.dog.x, pets.dog.y - 12), what: 'the dog, ' + spot(pets.dog) },
      { frame: 30, ...dev(v, 900, 548), what: 'the room\'s centre (a 9:16 window of the 432-tall room is ~243 world px = ~486 PNG px wide: pick the fire or the kitchen)' },
    ],
    issues: 'The room is landscape (624x432 world px) inside the dark shade the game lays over the yard: a vertical crop takes one corner of it. Each kitchen piece shows its other state for a moment (2.4 s; the toaster 1.4 s) and goes back by itself — sprite swaps, not tweened.',
  });
});
