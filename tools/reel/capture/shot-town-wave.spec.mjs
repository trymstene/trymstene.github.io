// WAVE HI: in front of the fountain, Mango walks up to our banana and waves; ours waves back (a real tap on Mango, the
// way a player does it); then Mango sets off a firework over the two of them, Mango's name under the burst, and Coco
// answers it with one of their own. A new banana stands beside them with its NEW tag. The players are made up
// (town-crowd-helpers.mjs answers the square's socket).
import { test, expect } from '@playwright/test';
import { stage, pause } from './harness.mjs';
import { W, H, fakeRoom, squareStub, seed, standUp, freeze, film, tapPeer, notes } from './town-crowd-helpers.mjs';

test.use({ viewport: { width: W + 100, height: H + 200 }, deviceScaleFactor: 2 });

const MANGO = 'a1b2c3d4', NEWB = 'e5f6a7b8', COCO = 'c0c0a7e2', SUNNY = '5a7e11aa';
const PRE = 1000;
const at = (frame) => Math.round(PRE + frame * 1000 / 30);
const room = fakeRoom({ peers: [
  { id: MANGO, name: 'Mango', outfit: { hat: 'party', glasses: 'shades', extras: { balloons: true } }, at: [850, 950],
    cues: [[at(-14), 'walk', [930, 976], [1012, 996]], [at(16), 'wave', 'me'], [at(52), 'burst']] },
  { id: NEWB, nw: 1, outfit: { hat: 'duckhat' }, at: [1190, 1004] },
  // the square behind them, as it was
  { id: COCO, name: 'Coco', outfit: { hat: 'cowboy', extras: { mustache: true, boombox: true } }, at: [1248, 912],
    cues: [[at(64), 'burst']] },   // …and Coco answers it with one of their own
  { id: SUNNY, name: 'Sunny', outfit: { hat: 'crown', glasses: 'hearts', extras: { goldchain: true } }, at: [1100, 714] },
] });

test('town-wave', async ({ page }) => {
  await stage(page, { url: '/town/?towntest&crowd=1&social=1', time: '2026-10-01T15:00:00', stub: squareStub(room), init: seed });
  await standUp(page, { tidy: [600, 380, 1600, 1300] });
  await pause(page);
  await freeze(page);
  await page.evaluate(() => { const t = window.__town; t.pos.x = 1100; t.pos.y = 1010; t.tgt.x = 1100; t.tgt.y = 1010; });
  const v = await page.locator('#twView').boundingBox();
  await film(page, {
    name: 'town-wave', secs: 3.5, preroll: PRE / 1000, room,
    clip: { x: v.x + 800, y: v.y + 240, width: 600, height: 1060 },   // world x 800–1400, y 240–1300: px = ((x - 800) * 2, (y - 240) * 2)
    each: async (i) => { if (i === 36) await tapPeer(page, MANGO); },   // 👋 a tap on Mango waves back
  });
  expect(room.real).toEqual([]);
  expect(room.sockets).toEqual(['wss://banana-rave.trymstene.workers.dev/town']);
  expect(room.errors).toEqual([]);
  console.log('[town-wave] routed sockets: ' + room.sockets.join(', ') + ' | refused worker calls: ' + [...new Set(room.blocked)].join(', '));
  expect(room.heard.some((m) => m.t === 'wave' && m.to === MANGO)).toBe(true);
  expect(await page.evaluate(() => window.__town.fx())).toBe(2);   // both fireworks went up
  notes('town-wave', {
    what: 'Wave hi: Mango walks up to our (plain) banana in front of the fountain and waves, ours waves back, then Mango\'s firework bursts over them and Coco answers with another. A NEW banana (duck hat) stands beside them.',
    best: [
      { from: 8, to: 66, why: 'Mango arrives and waves at ours (16); ours waves back (36, a real tap): both hands up together 38–62, the NEW banana right beside them' },
      { from: 48, to: 100, why: 'Mango\'s firework over the pair (52, "Mango" under it), Coco answers (64, "Coco"); confetti over the square while ours is still waving' },
    ],
    focus: [
      { frame: 20, x: 424, y: 1420, what: 'Mango waves at our banana' },
      { frame: 46, x: 512, y: 1430, what: 'both hands up: Mango and ours (ours px ~600,1450)' },
      { frame: 55, x: 424, y: 1212, what: 'Mango\'s burst over the pair' },
      { frame: 67, x: 896, y: 1044, what: 'Coco\'s burst' },
      { frame: 30, x: 780, y: 1300, what: 'the NEW tag on the new banana' },
    ],
    issues: 'Players fictional; Nib (top hat, Town Hall door), the stall keepers and the kiosk keeper are NPCs. Name labels under a burst stay 1.6 s after its sparks have thinned (80–100). A firework at true scale is fine 4-px confetti: strongest in its first ~10 frames.',
  });
});
