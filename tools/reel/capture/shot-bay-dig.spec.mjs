// BANANA BAY, THE DIG: Captain Sabreface's treasure is buried somewhere on the sand every day (date-seeded). Our plain
// banana dance-walks in and digs a step short of it — the game's own hunt cue, "the sand's packed here — close!" — then
// two steps onto the spot and digs again: THE TREASURE, the chest card with the day's tickets, pocketed at the end
// (+9 tickets floats off him). The digs and the pocket are the bay's own buttons (⛏ Dig, the card's); the walks are the
// bay's own walk target (a tap does the same). The first dig sits ABOVE the X: its float holds 2.6 s, and level with
// the X it would print over THE TREASURE's. 6 Oct buries it on open sand below the Captain's boathouse, low enough that
// the camera rests on the bay's bottom edge and the card (centred in the view) never covers our banana.
// The view is staged PORTRAIT, 800 x 1100: the bay's own layout() then lands on scale 1.5 (the 733 art px of height it
// is designed to show, the framing a phone gets) — one world px = 1.5 CSS px = 3 device px at DPR 2.
import { test } from '@playwright/test';
import { css } from './harness.mjs';
import { seed, noRoom, stageStill, until, rollSync, waitSync, notes } from './areas-helpers.mjs';

test.use({ viewport: { width: 860, height: 1400 }, deviceScaleFactor: 2 });

test('bay-dig', async ({ page }) => {
  await stageStill(page, { url: '/beach/?beachtest', time: '2026-10-06T14:30:00', stub: (p) => noRoom(p), init: seed, rand: 4 });
  await until(page, () => !!(window.__bay && window.__bay.treasureAt));
  // ⚠️ the frame CSS caps the view at 1000 x 580 (--world-w includes the 0.8rem gutters and the 4px frame: 833.6 → an
  // 800 px view). layout(): min(1.7, w/500, max(w/900, h/760)) = 1.45 → snapScale → 1.5
  await css(page, [
    ':root{--world-w:833.6px}', '.bh-view{height:1100px!important}',
    '.wh, .bh-hint, .bh-capbubble, .ccb { visibility: hidden !important; }',
  ].join(''));
  await page.evaluate(() => dispatchEvent(new Event('resize')));
  await page.waitForTimeout(2500);   // real time: the plate, the sea strips and the sprites arrive
  const X = await page.evaluate(() => { const b = window.__bay; b.wx('clear'); return b.treasureAt; });
  const walk = (x, y) => page.evaluate(([a, b2]) => { const b = window.__bay; b.tgt.x = a; b.tgt.y = b2; }, [x, y]);
  // our banana a little way west, already standing (the camera settles on him), on a line clear of the day's shells
  // (walking over one picks it up, and its chip would sit in the shot) and of the Captain
  await page.evaluate(([x, y]) => { const b = window.__bay; b.pos.x = x; b.pos.y = y; b.tgt.x = x; b.tgt.y = y; }, [X.x - 180, X.y - 30]);
  await waitSync(page, 2500);
  const v = await page.locator('.bh-view').boundingBox();
  const dig = page.locator('#bhDigBtn');

  await rollSync(page, {
    name: 'bay-dig', secs: 4.6, clip: v,
    each: async (i) => {
      if (i === 2) await walk(X.x - 60, X.y - 70);                      // in he comes
      if (i === 28) await dig.click();                                  // ⛏ …"the sand's packed here — close!"
      if (i === 46) await walk(X.x, X.y);
      if (i === 74) await dig.click();                                  // ⛏ X marks the spot: THE TREASURE
      if (i === 120) await page.locator('#bhChestBtn').click();         // pocket the tickets
    },
  });
  notes('bay-dig', {
    what: 'our plain banana digs on open sand (the close cue), steps onto the X and digs up THE TREASURE (chest card, 15 tickets), then pockets it',
    best: [
      { from: 66, to: 100, why: 'the treasure dig: THE TREASURE! float at his feet and the chest card with the ticket piles (f74 on)' },
      { from: 20, to: 46, why: "first dig: the hole opens and the game's hunt cue (the sand's packed here, close!) floats up" },
      { from: 118, to: 137, why: 'pocketed: the card closes and +15 tickets floats off him' },
    ],
    focus: [
      { frame: 30, x: 820, y: 1480, what: 'our banana at the first dig, the close cue' },
      { frame: 76, x: 800, y: 1080, what: 'the chest card (THE TREASURE!)' },
      { frame: 76, x: 808, y: 1690, what: 'our banana on the X, THE TREASURE! float' },
      { frame: 124, x: 808, y: 1680, what: '+15 tickets floating off our banana' },
    ],
    issues: "View staged portrait 800 x 1100 CSS, so the bay's own layout picks scale 1.5 (the phone framing). The chest card is the game's reward UI with words (title, line, 6 + 9 ticket piles, pocket the 15 tickets) and dims the beach behind it; f70-74 is the dig without it. Floats are the game's own text. Hidden: world HUD, the hint line, the NPC speech bubbles. The camera rests on the bay's bottom edge, so our banana sits in the lower third.",
  });
});
