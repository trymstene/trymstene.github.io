// BANANA STACK, PLAYED: the arcade's fifth cabinet, played with real presses of Space by a player that drops each crate
// when it swings square over the tower. A first run is lost off camera (two bad drops narrow the tower, the third misses
// it: TOPPLED at 24) so the screen's "best" is a score to beat; the second run is filmed climbing past it — crates
// landing "perfect" three a second, the banana riding the top of the tower, one crate dropped a hand wide and trimmed.
import { test } from '@playwright/test';
import { pause } from './harness.mjs';
import { CARD_RULES, CARD_VIEW, rollEven, arcadeTown, freezeAt, gs, screenClip, stackTake } from './arcade-helpers.mjs';

test.use(CARD_VIEW);

test('town-arcade-stack', async ({ page }) => {
  test.setTimeout(14 * 60000);
  await arcadeTown(page, { rules: CARD_RULES });
  await pause(page);
  await freezeAt(page, '2026-10-01T15:01:00');
  const p = await stackTake(page, { from: 19 });
  const log = [];
  await rollEven(page, { name: 'town-arcade-stack', secs: 5, clip: await screenClip(page), each: async (i) => {
    const r = await p(i);
    if (r === 'drop') { const s = await gs(page); log.push(i + ':' + s.score + (s.perfect > 0.5 ? 'P' : '') + '/w' + Math.round(s.tower[s.tower.length - 1].w)); }
  } });
  console.log(log.join(' '));
});
