// 🔒 NOTHING MOVES BEHIND AN OPEN POPUP — every area, one rule (20 Sep 2026).
//
// Trym: "when a user opens a popup in bananaworld, all movement in the background should be locked. it
// keeps happening that when i click on content in a popup my banana moves in the background."
//
// ⚠️ THE TAP WAS NEVER THE LEAK, and that is why this took a while to find. Every area already refuses
// to START a walk from a tap inside its own chrome, and all four were clean when probed that way — 25
// popups, clicked and held, no movement. What actually happens is that a walk ALREADY RUNNING keeps
// running when a popup opens over it; and in the town, opening a building's card and setting a walk to
// its door were the SAME tap, so the banana set off across the square underneath the thing you had just
// opened. Measured on the Exchange before the fix: 25 px of travel with the card up.
//
// So this asserts the STEP, not the tap: set a walk going, open a popup, and the banana must stand.
import { test, expect } from '@playwright/test';

const AREAS = [
  { name: 'the town', url: '/town/?towntest', seam: '__town', panel: '.tw-panel', far: { x: 1100, y: 1100 } },
  { name: 'the park', url: '/park/?parktest', seam: '__park', panel: '.pk-panel', far: null },
  { name: 'the bay', url: '/beach/?beachtest', seam: '__bay', panel: '.bh-panel', far: null },
  { name: 'the homestead', url: '/homestead/?hstest=full', seam: '__hs', panel: '.hs-panel,#hsShop,#hsPost,#hsSeed', far: null },
];

for (const a of AREAS) {
  test(`${a.name}: a banana already walking stops when a popup opens`, async ({ page }) => {
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(a.url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((s) => !!(window[s] && window[s].pos && window[s].tgt), a.seam, { timeout: 30000 });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(async ({ seam, panel, far }) => {
      const t = window[seam];
      const wait = (ms) => new Promise((x) => setTimeout(x, ms));
      // ── a walk is under way: a target a long way from where we stand
      const start = { x: t.pos.x, y: t.pos.y };
      const aim = far || { x: start.x + 300, y: start.y + 60 };
      t.tgt.x = aim.x; t.tgt.y = aim.y;
      await wait(260);
      const moving = { x: t.pos.x, y: t.pos.y };
      const wentFirst = Math.hypot(moving.x - start.x, moving.y - start.y);

      // ── now a popup opens over it, mid-stride
      const el = document.querySelector(panel);
      if (!el) return { err: 'no popup element for ' + panel };
      const was = el.hidden;
      el.hidden = false;
      await wait(700);
      const after = { x: t.pos.x, y: t.pos.y };
      const wentUnder = Math.hypot(after.x - moving.x, after.y - moving.y);

      // ── and it walks again once the popup closes, if it is told to
      el.hidden = was;
      t.tgt.x = aim.x; t.tgt.y = aim.y;
      await wait(300);
      const wentAfter = Math.hypot(t.pos.x - after.x, t.pos.y - after.y);
      return { wentFirst, wentUnder, wentAfter };
    }, a);

    expect(r.err, 'the area has a popup to open').toBeUndefined();
    // ⚠️ the first leg has to actually happen, or the test proves nothing: a banana that never moved
    // would pass the real assertion for the wrong reason
    expect(r.wentFirst, 'the banana was walking before the popup opened').toBeGreaterThan(8);
    expect(r.wentUnder, 'and does not move one pixel while the popup is up').toBeLessThanOrEqual(1);
    expect(r.wentAfter, 'but it is not stuck: it walks again once the popup closes').toBeGreaterThan(4);
    expect(errs).toEqual([]);
  });
}
