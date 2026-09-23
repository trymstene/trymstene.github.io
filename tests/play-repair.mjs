// 🔧 shared by the walks that wake a dark cabinet: tests/town-arcade-chores.spec.mjs and tests/town-calls.spec.mjs
// 🔧 THE REPAIR GAME (23 Sep 2026), played the way the café's walks make a cup: every step at the instant the tray's own
// seam solves as perfect — or, with `spoil`, the first step pressed where the needle is nowhere near the screw's slot
export async function playRepair(page, spoil) {
  await page.waitForFunction(() => !!(window.__town.repair && window.__town.repair.cup()), null, { timeout: 10000 });
  return page.evaluate(async (bad) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const R = window.__town.repair, sm = R.gest();
    for (let n = 0; n < 20 && R.cup(); n++) {
      const key = sm.station();
      if (!key) break;
      if (bad && key === 'unscrew') {
        const z = sm.zone(), t0 = performance.now();
        let t = t0; while (t < t0 + 3000 && Math.abs(sm.at(t) - z.at) < z.half * 3) t += 10;
        sm.press(t); bad = false; continue;
      }
      const t = sm.best(performance.now());
      await wait(Math.max(0, t - performance.now()));
      if (key === 'solder') { sm.press(performance.now()); await wait(30); sm.release(sm.best(performance.now())); }
      else sm.press(sm.best(performance.now()));
      await wait(20);
    }
    return R.tries();
  }, !!spoil);
}
