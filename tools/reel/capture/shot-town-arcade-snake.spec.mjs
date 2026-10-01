// BANANA SNAKE, PLAYED: the arcade's second cabinet, opened in the arcade, played with real arrow keys by a player that
// reads the screen. A first run ends in the wall at 40 (off camera) — so the screen's "best" is a score to beat — and the
// second run is filmed as it climbs past it: a long peel at full speed, jelly after jelly, the best ticking up with it.
import { test } from '@playwright/test';
import { pause } from './harness.mjs';
import { CARD_RULES, CARD_VIEW, rollEven, arcadeTown, freezeAt, openGame, gs, play, screenClip, snakePlayer } from './arcade-helpers.mjs';

test.use(CARD_VIEW);
const BEST = 40, FROM = 37;

test('town-arcade-snake', async ({ page }) => {
  test.setTimeout(14 * 60000);
  await arcadeTown(page, { rules: CARD_RULES });
  await pause(page);
  await freezeAt(page, '2026-10-01T15:01:00');
  await openGame(page, 'g2');
  await play(page, 6000, snakePlayer(page, { crashAt: BEST }));   // run one: into the wall at 40
  await play(page, 30);                                             // the end card's beat
  await page.keyboard.press('Space');                               // another go
  const p = snakePlayer(page);
  await play(page, 6000, async (i) => ((await gs(page)).score >= FROM ? 'stop' : p(i)));
  const s = await gs(page);
  console.log('rolling at score', s.score, 'len', s.body.length, 'dead', s.dead);
  await rollEven(page, { name: 'town-arcade-snake', secs: 5, clip: await screenClip(page), each: p });
  console.log('end score', (await gs(page)).score);
});
