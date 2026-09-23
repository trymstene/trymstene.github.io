// 🎯 A COUNTER SHIFT FRAMES THE COUNTER (23 Sep 2026).
//
// On a phone the lemonade stand vanished during a shift: it sits near the top of the world (its sprite at y 444–545), the
// camera put the player at 58% of the view, and that left the stand high in the view — under the work note and under every
// toast, which docks at the top while a counter's tray is up (design library §25). Measured at 393×852: the stand at
// y 298–368, the note over 236–319, the toast over 327–403. The fix is the class: while a counter holds the banana
// (the café, the stand, the post round, a repair), the camera frames the counter in the band between the top notes (and
// the toast's place under them) and the tray. This walks every counter at 360 and 393 on the built site and asserts the
// counter — the figure at work, and for the stand its sprite too — is clear of the notes, the quest chip and the toast.
import { test, expect } from '@playwright/test';
import { playRepair } from './play-repair.mjs';

async function town(page, w, h) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(12); });
  await page.waitForTimeout(600);
  return errs;
}
// what covers the counter: every top note that is showing, and the toast while it is up
const cover = (page, sels) => page.evaluate((ss) => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const shown = (e) => e && !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().height > 0;
  const things = ss.map((s) => document.querySelector(s)).filter(shown).map(r);
  const over = [...document.querySelectorAll('.twd-chip, .bwq-hint, #twToast')].filter(shown).map((e) => ({ id: e.id || e.className.split(' ')[0], ...r(e) }));
  const tray = [...document.querySelectorAll('.tw-cup')].find((t) => !t.hidden);
  const v = r(document.getElementById('twView'));
  return {
    n: things.length,
    under: over.filter((o) => things.some((t) => hit(t, o))).map((o) => o.id + ' ' + Math.round(o.t) + '–' + Math.round(o.b)),
    things: things.map((t) => Math.round(t.t) + '–' + Math.round(t.b)),
    inView: things.every((t) => t.t >= v.t && t.b <= (tray ? tray.getBoundingClientRect().top : v.b) + 1),
    toast: !document.getElementById('twToast').hidden,
  };
}, sels);
const say = (page, line) => page.evaluate((l) => window.__town.say && window.__town.say(l), line);

for (const [w, h] of [[393, 852], [360, 740]]) {
  test(`🍋 the lemonade stand at ${w}×${h}: the stand and its vendor clear of the notes and the toast through a shift`, async ({ page }) => {
    test.setTimeout(90000);
    const errs = await town(page, w, h);
    await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 890; t.pos.y = t.tgt.y = 610; });
    await page.evaluate(() => window.__town.work.set({ at: 'stand' }));
    await page.evaluate(() => window.__town.room.folkReady());
    await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
    expect(await page.evaluate(() => window.__town.room.lemonReady())).toBe(true);
    await page.evaluate(() => window.__town.room.open('stand'));
    await page.waitForFunction(() => window.__town.room.lemon() && window.__town.room.lemon().on(), null, { timeout: 30000 });
    await page.waitForTimeout(1500);   // the camera settles on the counter
    const SEL = ['.tw-ov[src*="ov-50"]', '.tw-atwork--stand'];
    let c = await cover(page, SEL);
    expect(c.n, 'the stand and the vendor are drawn').toBe(2);
    expect(c.under, 'nothing over the stand as the shift begins ' + JSON.stringify(c)).toEqual([]);
    expect(c.inView, 'and it sits above the tray').toBe(true);
    // a toast mid-shift, the longest kind the stand says
    await say(page, 'A big glass. Hold the squeeze a little longer for this one.');
    await page.waitForTimeout(300);
    c = await cover(page, SEL);
    expect(c.toast, 'the toast is up').toBe(true);
    expect(c.under, '⭐ the toast stands clear of the stand ' + JSON.stringify(c)).toEqual([]);
    await page.screenshot({ path: `test-results/counter-frame-stand-${w}.png` });
    expect(errs).toEqual([]);
  });

  test(`☕ the café at ${w}×${h}: the barista in the hatch clear of the notes and the toast`, async ({ page }) => {
    test.setTimeout(90000);
    const errs = await town(page, w, h);
    await page.evaluate(() => window.__town.room.folkReady());
    await page.evaluate(() => window.__town.room.cafeReady());
    await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
    await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
    await page.waitForTimeout(250);
    await page.evaluate(() => window.__town.room.open('cafe'));
    await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 8000 });
    await page.waitForTimeout(1500);
    await say(page, 'A long line the town says while the tray is up, to see where it stands.');
    await page.waitForTimeout(300);
    const c = await cover(page, ['.tw-atwork']);
    expect(c.n).toBe(1);
    expect(c.under, 'nothing over the barista ' + JSON.stringify(c)).toEqual([]);
    expect(c.inView, 'above the tray').toBe(true);
    await page.screenshot({ path: `test-results/counter-frame-cafe-${w}.png` });
    expect(errs).toEqual([]);
  });

  test(`✉️ the post round at ${w}×${h}: the sorter at the counter clear of the notes and the toast`, async ({ page }) => {
    test.setTimeout(90000);
    const errs = await town(page, w, h);
    await page.evaluate(() => window.__town.work.set({ at: 'post' }));
    await page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
    expect(await page.evaluate(() => window.__town.sortReady())).toBe(true);
    expect(await page.evaluate(() => window.__town.sort().clockIn())).toBe(true);
    await page.waitForTimeout(1500);
    await say(page, 'A long line the town says while the tray is up, to see where it stands.');
    await page.waitForTimeout(300);
    const c = await cover(page, ['.tw-me']);
    expect(c.n).toBe(1);
    expect(c.under, 'nothing over the sorter ' + JSON.stringify(c)).toEqual([]);
    expect(c.inView, 'above the tray').toBe(true);
    await page.screenshot({ path: `test-results/counter-frame-post-${w}.png` });
    expect(errs).toEqual([]);
  });

  test(`🔧 a repair at ${w}×${h}: the banana at the dark cabinet clear of the notes and the toast`, async ({ page }) => {
    test.setTimeout(90000);
    const errs = await town(page, w, h);
    await page.evaluate(() => window.__town.work.set({ at: 'condo' }));
    await page.evaluate(() => window.__town.arcade.enter());
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__town.room.arcadeReset());
    await page.waitForTimeout(300);
    const key = (await page.evaluate(() => window.__town.room.arcade())).dead;
    const spot = await page.evaluate((k) => window.__town.arcade.spots().find((q) => q[0] === k), key);
    await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [(spot[1] + spot[3]) / 2, spot[4] + 26]);
    await page.evaluate((k) => window.__town.room.cabinetRepair(k), key);
    await page.waitForFunction(() => window.__town.room.arcade().working, null, { timeout: 10000 });
    await page.waitForTimeout(1500);
    await say(page, 'A long line the town says while the tray is up, to see where it stands.');
    await page.waitForTimeout(300);
    const c = await cover(page, ['.tw-me']);
    expect(c.n).toBe(1);
    expect(c.under, 'nothing over the banana at the cabinet ' + JSON.stringify(c)).toEqual([]);
    expect(c.inView, 'above the tray').toBe(true);
    await page.screenshot({ path: `test-results/counter-frame-repair-${w}.png` });
    await playRepair(page, false);
    expect(errs).toEqual([]);
  });
}
