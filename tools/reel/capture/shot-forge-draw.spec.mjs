// THE ITEMS WORKSHOP: a party hat drawn pixel by pixel on the banana, then "Play the dance" — the banana dances in it.
// Every pixel is the workshop's own tools under a real mouse: the pencil's strokes cross the grid one cell per frame
// (ink outline: left edge, right edge, brim), the bucket floods the cone blue, the pencil dots it yellow and builds a
// pink pompom, then the bench's own Play button dances the banana wearing exactly what was drawn. The grid is the
// workshop's 58-cell banana grid (one cell = one banana pixel); the hat sits on the tip of the head (rows 12-16).
import { test } from '@playwright/test';
import { css } from './harness.mjs';
import { seed, noRoom, stageStill, until, rollSync, waitSync, notes } from './areas-helpers.mjs';

test.use({ viewport: { width: 1400, height: 1300 }, deviceScaleFactor: 2 });

const N = 58, C = 29;   // the grid, and the banana's centre column
// the cone's edge at row r (apex row 5, brim row 16): half-width grows 0 → 5
const hw = (r) => Math.round((r - 5) * 5 / 11);

test('forge-draw', async ({ page }) => {
  await stageStill(page, { url: '/forge/items/', time: '2026-10-01T14:30:00', stub: (p) => noRoom(p), init: seed, rand: 3 });
  await until(page, () => { const c = document.getElementById('fgCanvas'); return !!c && c.width === 464; });
  await css(page, '.fg-toast, .ccb { visibility: hidden !important; }');   // the bench's status pill: the editor writes the words
  await page.waitForTimeout(2500);   // real time: the banana's sprite sheet arrives for the underlay
  await waitSync(page, 600);
  const box = await page.locator('#fgCanvas').boundingBox();
  const cellAt = (cx, cy) => ({ x: box.x + (cx + 0.5) * box.width / N, y: box.y + (cy + 0.5) * box.height / N });
  // the colour button's popover: a family, then (maybe) its shade. ⚠️ a swatch click re-renders the palette, so the
  // popover shuts behind it (the old swatch is gone by the time the outside-click check runs): reopen for the shade.
  const pick = async (main, shade) => {
    await page.locator('#fgColorBtn').click();
    await page.locator('#fgMains .fg-swatch[data-idx="' + main + '"]').click({ timeout: 5000 });
    if (shade) {
      if (await page.locator('#fgColorPop').isHidden()) await page.locator('#fgColorBtn').click();
      await page.locator('#fgShades .fg-swatch[data-idx="' + shade + '"]').click({ timeout: 5000 });
    }
    if (await page.locator('#fgColorPop').isVisible()) await page.locator('#fgColorBtn').click();   // shut it
  };
  const tool = (t) => page.locator('.fg-tool[data-tool="' + t + '"]').click();

  // the script: frame -> what the hand does. A stroke is down at its first cell, one cell per frame, up at its last.
  const plan = {};
  const stroke = (f0, cells) => {
    cells.forEach(([x, y], k) => { (plan[f0 + k] = plan[f0 + k] || []).push(['move', x, y]); });
    plan[f0].push(['down']);
    (plan[f0 + cells.length - 1] = plan[f0 + cells.length - 1] || []).push(['up']);
    return f0 + cells.length;
  };
  const dot = (f, x, y) => { (plan[f] = plan[f] || []).push(['move', x, y], ['down'], ['up']); };
  const edge = (side) => { const out = []; for (let r = 5; r <= 16; r++) out.push([C + side * hw(r), r]); return out; };
  const brim = []; for (let x = C - 5; x <= C + 5; x++) brim.push([x, 16]);
  const ink = 6;
  let f = stroke(ink, edge(-1));              // ✏️ left edge, apex to brim
  f = stroke(f + 2, edge(1));                 // ✏️ right edge
  f = stroke(f + 2, brim);                    // ✏️ the brim
  const fillAt = f + 4;                       // 🪣 the cone floods blue
  const dots = [[C, 8], [C - 2, 11], [C + 2, 12], [C - 1, 14], [C + 3, 15], [C - 3, 15]];
  dots.forEach(([x, y], k) => dot(fillAt + 5 + k * 3, x, y));   // ✏️ yellow polka dots
  const pom0 = fillAt + 5 + dots.length * 3 + 3;
  let g = stroke(pom0, [[C - 1, 4], [C, 4], [C + 1, 4]]);       // ✏️ a pink pompom
  g = stroke(g, [[C + 1, 3], [C, 3], [C - 1, 3]]);
  g = stroke(g, [[C - 1, 2], [C, 2], [C + 1, 2]]);
  const playAt = g + 6;                       // ▶ Play the dance

  await pick(1);                              // ink (the pencil is already in hand)
  await rollSync(page, {
    name: 'forge-draw', secs: (playAt + 66) / 30, clip: box,
    each: async (i) => {
      if (i === fillAt) { await pick(11); await tool('fill'); }
      for (const a of plan[i] || []) {
        if (a[0] === 'move') { const q = cellAt(a[1], a[2]); await page.mouse.move(q.x, q.y); }
        if (a[0] === 'down') await page.mouse.down();
        if (a[0] === 'up') await page.mouse.up();
      }
      if (i === fillAt) { const q = cellAt(C, 12); await page.mouse.click(q.x, q.y); await tool('pencil'); await pick(3); }
      if (i === pom0 - 1) await pick(6, 14);
      if (i === playAt) await page.locator('#fgItemsPlay').click();
    },
  });
  notes('forge-draw', {
    what: 'the Items Workshop: a party hat drawn pixel by pixel on the banana grid (outline, bucket fill, polka dots, pompom), then Play: the classic banana dances wearing it',
    best: [
      { from: 44, to: 72, why: 'the bucket floods the cone blue (f49) and the yellow dots go in one by one' },
      { from: 86, to: 120, why: 'Play (f90): the grid becomes the dancing banana in the hat it was just given' },
      { from: 4, to: 44, why: 'the ink outline drawn cell by cell over the faint banana' },
    ],
    focus: [
      { frame: 60, x: 727, y: 222, what: 'the hat on the grid' },
      { frame: 110, x: 715, y: 700, what: 'the dancing banana in the hat' },
    ],
    issues: "Clip = the grid canvas only (1430 x 1430 px). The drawing is one grid cell per frame (a speed-draw: the hand is fast, the tools are the bench's own: pencil, bucket, the colour popover). Headless shows no mouse cursor. The bench's status pill is hidden. At Play the canvas switches from the grid to the dance on cream; that cut is the game's.",
  });
});
