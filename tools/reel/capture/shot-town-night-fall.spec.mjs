// 🌙 NIGHT FALLS, AND THE CURSE COMES. The square at the end of a calm afternoon; the hour turns and the street lamps
// come on; then a Curse Night (the room's own deep tier): lightning, the storm, every ghost out, the candles at the hall,
// the night vendor at the monument, the kiosk shuttered and the residents starting home.
import { test } from '@playwright/test';
import { pause, roll } from './harness.mjs';
import { W, H, stageTown, waitSync, placeMe, notes, px, peek } from './town-night-helpers.mjs';

test.use({ viewport: { width: W + 100, height: H + 200 }, deviceScaleFactor: 2 });

const C = { x: 550, y: 0, w: 1100, h: 1300 };

test('town-night-fall', async ({ page }) => {
  await stageTown(page, { time: '2026-09-27T20:00:00', hour: 15 });
  await pause(page);
  await placeMe(page, 1100, 1110);
  await page.evaluate(() => window.__town.life.set(16 - 4.5 / 30));   // 4.5 s of afternoon left: 3.5 to settle, 1 on film
  await waitSync(page, 3500);
  const v = await page.locator('#twView').boundingBox();
  const ev = { dusk: -1, lamps: -1, curse: -1 };
  await roll(page, {
    name: 'town-night-fall', secs: 6, clip: { x: v.x + C.x, y: v.y + C.y, width: C.w, height: C.h },
    each: async (i) => {
      if (i === 75) await page.evaluate(() => window.__town.room.curse('deep'));
      // what each() sees happened in the step before: it is first on screen in frame i - 1
      const p = await peek(page), lit = await page.evaluate(() => window.__town.room.lit());
      if (ev.dusk < 0 && p.beat === 4) ev.dusk = i - 1;
      if (ev.lamps < 0 && lit) ev.lamps = i - 1;
      if (ev.curse < 0 && p.ghosts.length) ev.curse = i - 1;
    },
  });
  if (ev.lamps < 0 || ev.curse < 0) throw new Error('a bad take: ' + JSON.stringify(ev));
  notes('town-night-fall', {
    what: 'The square from the town hall to the info kiosk: a calm afternoon, the street lamps come on at dusk, then a Curse Night breaks — eight ghosts appear at once, a double lightning flash, a driving storm rolls in, candles at the hall door, the night vendor by the monument, the kiosk shutters.',
    best: [
      { from: 0, to: 179, why: 'the whole turn: afternoon, dusk lamps, the curse' },
      { from: Math.max(0, ev.lamps - 15), to: ev.lamps + 25, why: 'the hour turns: the street lamps light up' },
      { from: ev.curse - 8, to: Math.min(179, ev.curse + 70), why: 'the curse hits: ghosts pop in, lightning, the rain sweeps in and the dark comes down' },
      { from: 140, to: 179, why: 'the cursed town settled: storm, ghosts, candles' },
    ],
    focus: [
      { frame: ev.lamps + 10, ...px(C, 1100, 640), what: 'the lamps either side of the hall lit' },
      { frame: ev.curse + 1, ...px(C, 1080, 980), what: 'the ghosts just appeared round the fountain, our banana just below them' },
      { frame: ev.curse + 4, ...px(C, 1100, 760), what: 'the first lightning flash over the square' },
    ],
    events: ev,
    issues: 'The sky darkens on the game\'s own 3 s fade and the rain fades in over 2.4 s, so the storm is at full strength about 2.5 s after the curse lands. The lightning is a double flash 4 and 7 frames after the ghosts appear (the storm\'s own 11 s cycle; its next flash falls after the shot ends). Our banana is the plain one standing south of the fountain; the others are residents (fictional NPCs), some starting home. The kiosk\'s shutter carries the game\'s red CLOSED sign. The curse\'s big title card is hidden (text is the editor\'s).',
  });
});
