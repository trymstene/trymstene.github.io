// BANANA INVADERS, PLAYED: the arcade's third cabinet, played with real keys (A and D held to slide, S to throw) by a
// player that reads the screen — it dodges the drops and slides under the fly a peel will meet. Filmed on its fourth
// wave: the last flies picked off, the screen's "wave 5", and the new swarm of thirty coming under fire.
import { test } from '@playwright/test';
import { pause } from './harness.mjs';
import { CARD_RULES, CARD_VIEW, rollEven, arcadeTown, freezeAt, openGame, gs, play, screenClip, invadersPlayer } from './arcade-helpers.mjs';

test.use(CARD_VIEW);
const WAVE = 3, LEFT = 5;   // roll from the moment wave index 3 (the screen's "wave 4") is down to five flies

test('town-arcade-invaders', async ({ page }) => {
  test.setTimeout(14 * 60000);
  await arcadeTown(page, { rules: CARD_RULES });
  await pause(page);
  await freezeAt(page, '2026-10-01T15:01:00');
  await openGame(page, 'g3');
  const p = invadersPlayer(page);
  await play(page, 6000, async (i) => { const s = await gs(page); if (s.dead || (s.wave === WAVE && s.flies.filter((f) => f.alive).length <= LEFT)) return 'stop'; return p(i); });
  const s0 = await gs(page);
  console.log('rolling at score', s0.score, 'wave', s0.wave, 'dead', s0.dead);
  const log = [];
  await rollEven(page, { name: 'town-arcade-invaders', secs: 5, clip: await screenClip(page), each: async (i) => {
    await p(i);
    const s = await gs(page);
    log.push(i + ':' + s.score + (s.win > 0 ? 'W' : '') + (s.dead ? 'D' : ''));
  } });
  await p.release();
  console.log(log.join(' '));
});
