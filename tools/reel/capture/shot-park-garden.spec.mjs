// THE PARK'S GARDEN: the pond-side beds on a perfect park day (bloom 98 = the lush plates, butterflies, squirrels).
// Our plain banana picks his ripe pumpkin (confetti, the rep and the seed float up), steps along the row, picks his
// watermelon, then waters his thirsty carrot with the action bar's 💧 tool (the soil goes dark, a drop floats up).
// The garden is staged through the game's own ?parktest seam: its stand-in server (gShim) mirrors the park room's
// rules, and the beds are filled the way the room fills them — plots carry a grower id and watered days. Four plots
// are OURS (they get the game's wooden stakes); the rest belong to fictional growers, no names. Every pick and the
// water are real input: a tap on the plant (the view's own click handler) and the tool button.
import { test } from '@playwright/test';
import { css } from './harness.mjs';
import { seed, noRoom, stageStill, until, rollSync, waitSync, notes } from './areas-helpers.mjs';

test.use({ viewport: { width: 860, height: 1400 }, deviceScaleFactor: 2 });

const DAY = 86400000;
// site D, the pond's south-east bank: plot -> [seed, grower ('me' = our banana), watered days, watered today]
const BEDS = {
  48: ['sunflower', 'f1', 4, 1], 49: ['corn', 'f2', 5, 1], 50: ['tulip', 'f3', 5, 1], 51: ['pumpkin', 'f1', 4, 1],
  52: ['sunflower', 'f4', 4, 1], 53: ['grape', 'f2', 6, 1], 54: ['daisy', 'f3', 2, 0], 55: ['watermelon', 'f4', 5, 1],
  56: ['wheat', 'f5', 6, 1], 57: ['strawberry', 'me', 3, 1], 58: ['tomato', 'f5', 4, 1], 59: ['pumpkin', 'me', 5, 1],
  60: ['corn', 'f6', 2, 0], 61: ['watermelon', 'me', 7, 1], 62: ['sunflower', 'f6', 4, 1], 63: ['carrot', 'me', 1, 0],
  // site B next door (the playground beds), other growers' plots, so the view is one garden and not bare soil
  8: ['corn', 'f7', 5, 1], 9: ['pumpkin', 'f7', 5, 1], 10: ['sunflower', 'f8', 4, 1], 11: ['tomato', 'f8', 3, 1],
  12: ['pineapple', 'f9', 8, 1], 13: ['strawberry', 'f9', 3, 1], 14: ['tulip', 'f7', 5, 0], 15: ['wheat', 'f8', 6, 1],
  32: ['grape', 'f9', 6, 1], 33: ['carrot', 'f7', 3, 1], 34: ['watermelon', 'f8', 7, 1], 35: ['daisy', 'f9', 2, 1],
  36: ['prickly', 'f7', 9, 1], 37: ['corn', 'f8', 3, 0], 38: ['sunflower', 'f9', 4, 1], 39: ['radish', 'f7', 1, 1],
};

test('park-garden', async ({ page }) => {
  await stageStill(page, { url: '/park/?parktest', time: '2026-10-01T14:30:00', stub: (p) => noRoom(p), init: seed, rand: 5 });
  await until(page, () => !!(window.__park && window.__park.gShim));
  // ⚠️ the frame CSS caps the view at 1000 x 580. Staged PORTRAIT, 800 x 1100 (--world-w includes the gutters and the
  // frame): the park's own layout() then lands on scale 1.5 — min(1.7, w/520, max(w/900, h/760)) = 1.45 → snapScale —
  // the 733 art px of height it is designed to show, the framing a phone gets
  await css(page, [
    ':root{--world-w:833.6px}', '.pk-view{height:1100px!important}',
    '.wh, .pk-hbar, .pk-hint, .pk-exitstrip, .pk-toast, .ccb { visibility: hidden !important; }',
  ].join(''));
  await page.evaluate(() => dispatchEvent(new Event('resize')));
  await page.waitForTimeout(1500);
  await page.evaluate(([beds, DAY]) => {
    const p = window.__park, g = p.gShim, now = Date.now(), today = Math.floor(now / DAY);
    // the plots' grower id is how the shim (and the room) know whose plant it is
    const me = (localStorage.getItem('world-gid') || localStorage.getItem('park-sid') || '').slice(0, 8);
    for (const i in beds) {
      const [seedId, who, grew, wet] = beds[i];
      g.slots[+i] = { passShort: who === 'me' ? me : 'grow' + who, name: '', seed: seedId, plantedAt: now - 9 * DAY,
        lastWater: wet ? now - 2 * 3600000 : now - DAY, waterers: [], grew, gday: wet ? today : today - 1 };
    }
    g.algae = [];      // a perfect day: the pond skimmed…
    g.bloom = 98;      // …and the park in full bloom (phase 4: lush plates, butterflies)
    [10, 11, 12, 13, 14, 20, 23].forEach((spot, k) => g.border.push({ spot, kind: ['marigold', 'poppy', 'bluebell', 'primrose'][k % 4], name: '', at: now - 2 * DAY }));
    p.wx('clear');
    p.ff(48, 0);       // the QA reach-in's poll: the garden repaints from the shim
  }, [BEDS, DAY]);
  await waitSync(page, 1500);
  await page.evaluate(() => window.__park.warp(600, 910));   // a few steps west of his pumpkin
  await waitSync(page, 3000);
  const v = await page.locator('.pk-view').boundingBox();
  // a world point on screen (scale 1: the world layer is panned by the camera, never scaled)
  const at = (wx, wy) => page.evaluate(([x, y]) => {
    const r = document.getElementById('pkWorld').getBoundingClientRect(), s = r.width / 2760;
    return { x: r.left + x * s, y: r.top + y * s };
  }, [wx, wy]);
  const tap = async (wx, wy) => { const q = await at(wx, wy); await page.mouse.click(q.x, q.y); };

  await rollSync(page, {
    name: 'park-garden', secs: 4.2, clip: v,
    each: async (i) => {
      const walk = (x, y) => page.evaluate(([a, b]) => { const t = window.__park.tgt; t.x = a; t.y = b; }, [x, y]);
      if (i === 2) await walk(715, 902);                                  // in he comes (beside the pumpkin, not over it)
      if (i === 28) await tap(680, 826);                                  // pick the pumpkin
      if (i === 50) await walk(790, 905);
      if (i === 68) await tap(758, 824);                                  // pick the watermelon
      if (i === 96) await page.locator('#pkTool').click();                // 💧 water the carrot
    },
  });
  notes('park-garden', {
    what: 'a perfect park day by the pond: our plain banana harvests his ripe pumpkin and watermelon (confetti, rep and seed floats) and waters his thirsty carrot',
    best: [
      { from: 26, to: 58, why: 'pumpkin picked: confetti burst, +32, the seed and the gardener tally float up' },
      { from: 64, to: 92, why: 'watermelon picked: confetti, +40' },
      { from: 94, to: 125, why: 'the water tool: a drop floats over the carrot and its soil goes dark' },
    ],
    focus: [
      { frame: 31, x: 712, y: 1360, what: 'the pumpkin harvest confetti' },
      { frame: 72, x: 720, y: 1340, what: 'the watermelon harvest confetti' },
      { frame: 100, x: 880, y: 1320, what: 'watering the carrot' },
      { frame: 72, x: 800, y: 1480, what: 'our banana' },
    ],
    issues: "View staged portrait 800 x 1100 CSS (the park's own layout picks scale 1.5). The garden is staged through the park's ?parktest stand-in server: 32 plots, 4 ours (the wooden stakes), the rest fictional growers, no names; bloom 98 (lush plates). The camera rests on the park's bottom edge, so the lower third is lawn. Floats are the game's numbers. Hidden: world HUD, health bar, hint, toasts.",
  });
});
