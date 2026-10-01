// PEEL OUT, PLAYED: the arcade's first cabinet — one thumb, a banana flapping through gaps between hanging vines and
// stacked crates — played with real presses of Space by a player that rides the bottom of each gap. A first run ends in
// the vat at 18 (off camera, SPLAT) so the screen's "best" is a score to beat; the second run is filmed passing it.
import { test } from '@playwright/test';
import { pause } from './harness.mjs';
import { CARD_RULES, CARD_VIEW, rollEven, arcadeTown, freezeAt, openGame, gs, play, screenClip, peelPlayer } from './arcade-helpers.mjs';

test.use(CARD_VIEW);
const BEST = 18, FROM = 16;

test('town-arcade-peelout', async ({ page }) => {
  test.setTimeout(14 * 60000);
  await arcadeTown(page, { rules: CARD_RULES });
  await pause(page);
  await freezeAt(page, '2026-10-01T15:01:00');
  await openGame(page, 'g1');
  await play(page, 6000, peelPlayer(page, { crashAt: BEST }));    // run one: SPLAT at 18
  await play(page, 30);
  await page.keyboard.press('Space');                              // another go
  const p = peelPlayer(page);
  await play(page, 6000, async (i) => ((await gs(page)).score >= FROM ? 'stop' : p(i)));
  console.log('rolling at', (await gs(page)).score);
  const log = [];
  await rollEven(page, { name: 'town-arcade-peelout', secs: 5, clip: await screenClip(page), each: async (i) => {
    await p(i);
    const s = await gs(page);
    if (i % 10 === 0 || s.dead) log.push(i + ':' + s.score + (s.dead ? 'D' : ''));
  } });
  console.log(log.join(' '));
});
