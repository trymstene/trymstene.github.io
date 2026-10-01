// THE CABINET'S WHOLE CARD, for "beat the high score": Banana Stack's card as the arcade opens it — the name, the screen
// in play (the same take as town-arcade-stack: the second run climbing past the first's 24), and under it the board.
// The board is the pass worker's (/arcade/board), stubbed with a FICTIONAL one (initials only, arcade-helpers BOARD):
// no real player's name is on it. DPR 3: the card is 380 x 824 CSS px, a tall frame that is nearly 9:16 already.
import { test } from '@playwright/test';
import { pause } from './harness.mjs';
import { CARD_RULES, rollEven, arcadeTown, freezeAt, gs, stackTake } from './arcade-helpers.mjs';

test.use({ viewport: { width: 520, height: 1000 }, deviceScaleFactor: 3, hasTouch: true });

test('town-arcade-card', async ({ page }) => {
  test.setTimeout(14 * 60000);
  await arcadeTown(page, { rules: CARD_RULES });
  await pause(page);
  await freezeAt(page, '2026-10-01T15:01:00');
  const p = await stackTake(page, { from: 19 });
  const b = await page.locator('.tw-card').boundingBox();
  const clip = { x: Math.floor(b.x) - 2, y: Math.floor(b.y) - 2, width: Math.ceil(b.width) + 10, height: Math.ceil(b.height) + 10 };   // its shadow too
  await rollEven(page, { name: 'town-arcade-card', secs: 5, clip, each: p });
  console.log('end', (await gs(page)).score);
});
