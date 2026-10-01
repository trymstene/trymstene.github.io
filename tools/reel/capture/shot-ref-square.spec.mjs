// REFERENCE SHOT: the square on a bright afternoon — clock tower to fountain, the residents about their day, our
// banana walking up from the south. Proves the rig: speed per frame, and that the world films clean at 2x.
import { test } from '@playwright/test';
import { stage, pause, css, roll, wait } from './harness.mjs';

const WORLD_W = 2200, WORLD_H = 1300;
test.use({ viewport: { width: WORLD_W + 100, height: WORLD_H + 200 }, deviceScaleFactor: 2 });

test('ref-square', async ({ page }) => {
  await stage(page, { url: '/town/?towntest', time: '2026-10-01T15:00:00', init: () => { try { localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); } catch (e) {} } });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 60000 });
  await page.evaluate(() => { const t = window.__town; t.room.curse('none'); t.wx('clear'); t.room.set(90); t.life.set(15); });
  await css(page, [
    '.tw-wrap{max-width:none!important;padding:0!important}', '.tw-stage{box-shadow:none!important;border:0!important}',
    `.tw-view{width:${WORLD_W}px!important;height:${WORLD_H}px!important}`,
    `#twWorld{width:${WORLD_W}px!important;height:${WORLD_H}px!important;transform:none!important}`,
    '#twView>:not(#twWorld){visibility:hidden!important}', '.tw-toast{visibility:hidden!important}',
  ].join(''));
  await page.waitForTimeout(1500);   // real time: the chunks and pictures arrive
  await pause(page);
  await page.evaluate(() => { const t = window.__town; t.pos.x = 1100; t.pos.y = 1180; t.tgt.x = 1100; t.tgt.y = 1180; });
  await wait(page, 600);
  const v = await page.locator('#twView').boundingBox();
  await roll(page, {
    name: 'ref-square', secs: 3,
    clip: { x: v.x + 600, y: v.y, width: 1000, height: 1300 },
    each: async (i) => { if (i === 10) await page.evaluate(() => { const t = window.__town; t.tgt.x = 1100; t.tgt.y = 930; }); },
  });
});
