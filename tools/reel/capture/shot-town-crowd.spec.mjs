// THE SQUARE IS SHARED: a bright afternoon round the fountain, six other players about. Coco and Taco walk in from
// either side, Sunny comes down the Town Hall steps, a new banana (its NEW tag, no name yet) comes up the road from the
// park; Mango waves at our banana and ours waves back (a real tap), Sunny waves Coco in, Lulu says hello to the new
// banana; Mango comes over; then Coco sets off a firework over the square. Our banana, plain, walks up into the middle.
// The players are made up (town-crowd-helpers.mjs answers the square's socket); everything they do is the room's wire.
import { test, expect } from '@playwright/test';
import { stage, pause } from './harness.mjs';
import { W, H, fakeRoom, squareStub, seed, standUp, freeze, film, tapPeer, notes } from './town-crowd-helpers.mjs';

test.use({ viewport: { width: W + 100, height: H + 200 }, deviceScaleFactor: 2 });

const MANGO = 'a1b2c3d4', COCO = 'c0c0a7e2', SUNNY = '5a7e11aa', LULU = 'b0b0e3f1', TACO = '7ac0e9d2', NEWB = 'e5f6a7b8';
const PRE = 1000;   // ms of the room's time before frame 0 (the pre-roll): frame i is at PRE + i * 33.3
const at = (frame) => Math.round(PRE + frame * 1000 / 30);
const room = fakeRoom({ peers: [
  { id: MANGO, name: 'Mango', outfit: { hat: 'party', glasses: 'shades', extras: { balloons: true } }, at: [985, 930],
    cues: [[at(26), 'wave', 'me'], [at(80), 'walk', [1020, 990]]] },   // …and once they have waved, comes over
  { id: COCO, name: 'Coco', outfit: { hat: 'cowboy', extras: { mustache: true, boombox: true } }, at: [1580, 930],
    cues: [[600, 'walk', [1420, 922], [1248, 912]], [at(96), 'burst']] },
  { id: SUNNY, name: 'Sunny', outfit: { hat: 'crown', glasses: 'hearts', extras: { goldchain: true } }, at: [1052, 628],
    cues: [[at(2), 'walk', [1100, 714]], [at(50), 'wave', COCO]] },
  { id: LULU, name: 'Lulu', outfit: { hat: 'beanieprop', glasses: 'googlyeyes', extras: { plushbanana: true } }, at: [1000, 1104],
    cues: [[at(40), 'walk', [1080, 1106]], [at(64), 'wave', NEWB]] },
  { id: TACO, name: 'Taco', outfit: { hat: 'sombrero', glasses: 'groucho', extras: { rubberchicken: true } }, at: [590, 896],
    cues: [[300, 'walk', [760, 892], [872, 906]]] },
  { id: NEWB, nw: 1, outfit: { hat: 'duckhat' }, at: [1112, 1300],
    cues: [[800, 'walk', [1140, 1200], [1186, 1112]], [at(88), 'walk', [1172, 1062], [1172, 992]]] },   // welcomed, it looks round
] });

test('town-crowd', async ({ page }) => {
  await stage(page, { url: '/town/?towntest&crowd=1&social=1', time: '2026-10-01T15:00:00', stub: squareStub(room), init: seed });
  await standUp(page, { tidy: [600, 380, 1600, 1300] });
  await pause(page);
  await freeze(page);
  await page.evaluate(() => { const t = window.__town; t.pos.x = 1100; t.pos.y = 1150; t.tgt.x = 1100; t.tgt.y = 1150; });
  const v = await page.locator('#twView').boundingBox();
  await film(page, {
    name: 'town-crowd', secs: 5, preroll: PRE / 1000, room,
    clip: { x: v.x + 600, y: v.y, width: 1000, height: 1300 },   // world x 600–1600, y 0–1300: px = ((x - 600) * 2, y * 2)
    each: async (i) => {
      if (i === -6) await page.evaluate(() => { window.__town.tgt.x = 1100; window.__town.tgt.y = 1010; });   // up into the crowd
      if (i === 48) await tapPeer(page, MANGO);   // 👋 a tap on Mango waves back
    },
  });
  // never a real player: no socket left the page, no worker answered, and the room's people were all ours
  expect(room.real).toEqual([]);
  expect(room.sockets).toEqual(['wss://banana-rave.trymstene.workers.dev/town']);
  expect(room.errors).toEqual([]);
  console.log('[town-crowd] routed sockets: ' + room.sockets.join(', ') + ' | refused worker calls: ' + [...new Set(room.blocked)].join(', '));
  expect(room.heard.some((m) => m.t === 'wave' && m.to === MANGO)).toBe(true);   // the wave back went out on the wire
  const peers = await page.evaluate(() => window.__town.crowd.peers());
  expect(peers.map((p) => p.id).sort()).toEqual([MANGO, COCO, SUNNY, LULU, TACO, NEWB].sort());
  notes('town-crowd', {
    what: 'The square is shared: six made-up players round the fountain on a bright afternoon, walking in, waving hello (Mango to ours, ours back, Sunny to Coco, Lulu to a NEW banana), then Coco\'s firework. Our banana is the plain one in the middle.',
    best: [
      { from: 0, to: 75, why: 'the square fills: Coco and Taco walk in from the edges, Sunny down the Town Hall steps, a NEW banana up the road from the park, ours walks into the middle; Mango waves at ours (26), ours waves back (48, a real tap), Sunny waves (50): three hands up at once ~50–62; Lulu waves the new banana in (64)' },
      { from: 80, to: 149, why: 'Mango comes over to stand beside ours, the new banana steps up on the other side; Coco\'s firework over the square at 96 with "Coco" under it (reads best 96–110)' },
    ],
    focus: [
      { frame: 30, x: 790, y: 1760, what: 'Mango (party hat, balloons) waves at our banana' },
      { frame: 56, x: 920, y: 1740, what: 'three hands up: Sunny, Mango, ours (the plain banana, px ~1000,1900)' },
      { frame: 70, x: 1070, y: 2110, what: 'Lulu (propeller beanie) waves at the NEW banana (duck hat)' },
      { frame: 100, x: 1296, y: 1524, what: 'Coco\'s firework, "Coco" under it' },
      { frame: 120, x: 1000, y: 1880, what: 'the trio: Mango, ours, the NEW banana' },
    ],
    issues: 'All six players are fictional; the residents (Nib at the Town Hall door, the stall keepers, the kiosk keeper) are NPCs. The square was tidied first with the game\'s own fix (no litter halos). Name tags are 8 CSS px: they read after a push-in. A firework at true scale is fine 4-px confetti, strongest in its first ~10 frames. CSS animations (fountain water, the peers\' glide, the hand) are stepped with the game clock here, unlike harness.roll.',
  });
});
