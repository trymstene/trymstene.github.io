// THE ARCADE, INSIDE: our banana (plain, the classic) comes in at the door and walks up the room to the row of five
// cabinets on the back wall, and stops at Banana Snake's; Spinner keeps the prize desk. Staged through the town's own
// seams only: __town.arcade.enter() is the door, __town.pos/tgt are the walk. The world films at 1:1 (the town's own
// camera off), the room's box clipped, at DPR 4 so the editor can crop a 9:16 window out of a room that is wider than tall.
import { test } from '@playwright/test';
import { pause, wait } from './harness.mjs';
import { arcadeTown, freezeAt, rollEven } from './arcade-helpers.mjs';

const WORLD_W = 2200, WORLD_H = 1300;
test.use({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 4 });   // the site's nav sits over the view: 77 px
const PATH = [[588, 330], [412, 318]];   // up the middle of the room, then along the row to the second cabinet's front

test('town-arcade-room', async ({ page }) => {
  test.setTimeout(10 * 60000);
  await arcadeTown(page, { rules: [
    '.tw-wrap{max-width:none!important;padding:0!important}', '.tw-stage{box-shadow:none!important;border:0!important}',
    '.tw-sign,.tw-tag{display:none!important}',
    `.tw-view{width:${WORLD_W}px!important;height:${WORLD_H}px!important}`,
    `#twWorld{width:${WORLD_W}px!important;height:${WORLD_H}px!important;transform:none!important}`,
    '#twView>:not(#twWorld){visibility:hidden!important}', '.tw-toast{visibility:hidden!important}',
  ] });
  await page.waitForTimeout(1200);   // real time: Spinner's sprite and the room's plate arrive
  await pause(page);
  await freezeAt(page, '2026-10-01T15:01:00');
  await page.evaluate(() => { const t = window.__town; t.pos.x = 588; t.pos.y = 528; t.tgt.x = 588; t.tgt.y = 528; });
  await wait(page, 800);
  const v = await page.locator('#twView').boundingBox();
  const box = await page.evaluate(() => window.__town.arcade.box());
  let leg = 0;
  await rollEven(page, {
    name: 'town-arcade-room', secs: 4,
    clip: { x: v.x + box[0], y: v.y + box[1], width: box[2], height: box[3] },
    each: async (i) => {
      if (i === 6) await page.evaluate(([x, y]) => { const t = window.__town; t.tgt.x = x; t.tgt.y = y; }, PATH[leg++]);
      else if (leg < PATH.length && i > 6) {
        const near = await page.evaluate(() => { const t = window.__town; return Math.hypot(t.tgt.x - t.pos.x, t.tgt.y - t.pos.y) < 3; });
        if (near) await page.evaluate(([x, y]) => { const t = window.__town; t.tgt.x = x; t.tgt.y = y; }, PATH[leg++]);
      }
    },
  });
  console.log(JSON.stringify(await page.evaluate(() => ({ pos: window.__town.pos, inside: window.__town.arcade.inside() }))));
});
