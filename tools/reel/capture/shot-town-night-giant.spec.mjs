// 🎒 OUR BANANA PICKS UP A CURSED THING AND GOES GIANT. A plain town night: the night's first cursed thing comes through
// (town-night.js spawnThroughNight — on 27 Sep 2026 the day's seed draws the lost backpack, by the fountain's west bench)
// with its wisp and its blooming purple aura. Our banana walks over it, it is picked up (a burst, and it goes to the
// shed) and its curse lands: lostpack → 'giant' (ME_FX) — bigger, see-through, violet-edged, afloat, purple fire at the
// feet — and the giant takes a walk in front of the fountain, past the ghost on the bench.
import { test } from '@playwright/test';
import { pause, roll } from './harness.mjs';
import { W, H, stageTown, waitSync, placeMe, walkTo, notes, px, peek, tidy } from './town-night-helpers.mjs';

test.use({ viewport: { width: W + 100, height: H + 200 }, deviceScaleFactor: 2 });

const C = { x: 850, y: 340, w: 600, h: 960 };
const ME = [1120, 1150], PICK = [1045, 1046], STROLL = [[1190, 975], [1335, 975]];

test('town-night-giant', async ({ page }) => {
  await stageTown(page, { time: '2026-09-27T21:00:00', hour: 16 });
  await pause(page);
  await placeMe(page, ME[0], ME[1]);
  await tidy(page, C);
  await page.evaluate(() => window.__town.life.set(20.02));   // night falls: the night's ghosts, and its cursed things to come
  await waitSync(page, 1200);
  await tidy(page, C);   // …and whatever the roamer threw down on its first rest
  await waitSync(page, 1300);
  const pre = await peek(page);
  if (pre.objects.length) throw new Error('the cursed thing came early: ' + JSON.stringify(pre.objects));
  const v = await page.locator('#twView').boundingBox();
  const ev = { born: -1, go: -1, giant: -1, stroll: -1, pickups: [] };
  let leg = 0, nProb = pre.problems;
  await roll(page, {
    name: 'town-night-giant', secs: 5.5, clip: { x: v.x + C.x, y: v.y + C.y, width: C.w, height: C.h },
    each: async (i) => {
      if (i === 8) await page.evaluate(() => window.__town.room.nightSpawn());   // the night's next thing, now (it was due within seconds)
      // what each() sees happened in the step before: it is first on screen in frame i - 1
      const p = await peek(page);
      if (ev.born < 0 && p.objects.length) { ev.born = i - 1; if (p.objects[0].id !== 'lostpack') throw new Error('not the backpack: ' + p.objects[0].id); }
      if (ev.born >= 0 && ev.go < 0 && i >= ev.born + 30) { ev.go = i; await walkTo(page, PICK[0], PICK[1]); }
      if (ev.giant < 0 && p.fx === 'giant') ev.giant = i - 1;
      if (ev.giant >= 0 && ev.stroll < 0 && i >= ev.giant + 18) { ev.stroll = i; await walkTo(page, STROLL[0][0], STROLL[0][1]); }
      if (ev.stroll >= 0 && leg === 0 && Math.hypot(p.pos.x - STROLL[0][0], p.pos.y - STROLL[0][1]) < 3) { leg = 1; await walkTo(page, STROLL[1][0], STROLL[1][1]); }
      if (p.problems < nProb) ev.pickups.push(i - 1);   // a walk-over pickup (+coins) landed in the shot
      nProb = p.problems;
    },
  });
  if (ev.giant < 0 || ev.pickups.length) throw new Error('a bad take: ' + JSON.stringify(ev));
  notes('town-night-giant', {
    what: 'A plain town night by the fountain: a cursed backpack appears in a purple glow (a wisp rises off it), our banana walks over and picks it up — a burst — and the curse lands: it goes GIANT, see-through and violet with purple fire at its feet, and strolls past the ghost on the bench like that.',
    best: [
      { from: Math.max(0, ev.born - 4), to: 164, why: 'the cursed thing appears, our banana takes it, goes giant, walks it off' },
      { from: ev.go, to: Math.min(164, ev.giant + 45), why: 'the walk up, the pickup burst and the pop to giant' },
      { from: ev.giant, to: 164, why: 'walking around giant' },
    ],
    focus: [
      { frame: ev.born + 12, ...px(C, 1045, 1000), what: 'the cursed backpack appearing (wisp, aura)' },
      { frame: ev.giant + 2, ...px(C, PICK[0], PICK[1] - 45), what: 'the pop to giant' },
      { frame: Math.min(164, ev.stroll + 40), ...px(C, 1250, 930), what: 'the giant banana walking past the bench ghost' },
    ],
    events: ev,
    issues: 'Giant is the game\'s own 1.35× (it reads as a pop, not a monster) plus see-through, violet edge, a float and purple flame at the feet; it lasts 25 s in game. The pickup also sends the backpack to the player\'s shed and says its name in a toast — the toast is hidden (text is the editor\'s). Plain night (no storm) for clarity.',
  });
});
