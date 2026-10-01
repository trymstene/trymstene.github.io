// INTO THE ARCADE: our banana (plain, the classic) comes along the street, walks up to the arcade's door and in — the town
// drops away behind the arcade's own room — then on up the room to Banana Snake's cabinet. The door is the town's own:
// __town.open('condo') is what a tap on the arcade answers (walk to the door, then enterRoom), the walk is __town.tgt.
// The world films at 1:1 (the town's camera off), DPR 4; the lamps' and windows' CSS glow is held to the page's clock.
import { test } from '@playwright/test';
import { pause, wait } from './harness.mjs';
import { arcadeTown, freezeAt, rollEven } from './arcade-helpers.mjs';

const WORLD_W = 2200, WORLD_H = 1300;
test.use({ viewport: { width: 900, height: 820 }, deviceScaleFactor: 4 });   // the view starts under the site's nav (77 px)
const START = [720, 622], DOOR = [480, 590];
const INSIDE = [[588, 330], [412, 318]];
const CLIP = [300, 120, 576, 600];   // world px: the arcade's room box and the street in front of it

test('town-arcade-door', async ({ page }) => {
  test.setTimeout(10 * 60000);
  await arcadeTown(page, { enter: false, rules: [
    '.tw-wrap{max-width:none!important;padding:0!important}', '.tw-stage{box-shadow:none!important;border:0!important}',
    '.tw-sign,.tw-tag{display:none!important}',
    `.tw-view{width:${WORLD_W}px!important;height:${WORLD_H}px!important}`,
    `#twWorld{width:${WORLD_W}px!important;height:${WORLD_H}px!important;transform:none!important}`,
    '#twView>:not(#twWorld){visibility:hidden!important}', '.tw-toast{visibility:hidden!important}',
  ] });
  await page.waitForTimeout(1200);
  await pause(page);
  await freezeAt(page, '2026-10-01T15:01:00');
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = x; t.pos.y = y; t.tgt.x = x; t.tgt.y = y; }, START);
  await wait(page, 600);
  const v = await page.locator('#twView').boundingBox();
  let leg = -1;
  await rollEven(page, {
    name: 'town-arcade-door', secs: 5,
    clip: { x: v.x + CLIP[0], y: v.y + CLIP[1], width: CLIP[2], height: CLIP[3] },
    each: async (i) => {
      if (i === 4) await page.evaluate(([x, y]) => { const t = window.__town; t.open('condo'); t.tgt.x = x; t.tgt.y = y; }, DOOR);   // the tap on the arcade
      if (i <= 4) return;
      const st = await page.evaluate(() => { const t = window.__town; return { inside: t.arcade.inside(), near: Math.hypot(t.tgt.x - t.pos.x, t.tgt.y - t.pos.y) < 3 }; });
      if (st.inside && st.near && leg < INSIDE.length - 1) { leg++; await page.evaluate(([x, y]) => { const t = window.__town; t.tgt.x = x; t.tgt.y = y; }, INSIDE[leg]); }
    },
  });
  console.log(JSON.stringify(await page.evaluate(() => ({ pos: window.__town.pos, inside: window.__town.arcade.inside() }))));
});
