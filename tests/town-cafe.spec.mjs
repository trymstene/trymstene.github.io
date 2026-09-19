// ☕ THE COUNTER — the walk (19 Sep 2026, docs/town-cafe-plan.md §4, §9).
//
// The counter is walked on its own bench (/dev/cafe/, noindex, linked from nowhere), because the
// bench drives the REAL src/scripts/town-cafe.js and the REAL /css/town-cafe.css over the town's own
// square. What is asserted here is asserted about the shipping code.
//
// ⚠️ THE THREE THINGS THAT COULD BE QUIETLY WRONG, and each is a line below:
//   · THE WHOLE ARGUMENT FOR THE TRAY is that the square stays visible while you pour — if the tray
//     ever grows past the bottom strip, the night collision ("serve the next cup, or run out and
//     relight the lamp") becomes a choice you cannot see, and the form is the wrong one.
//   · A PERFECT CUP MUST BE REACHABLE ON A SLOW PHONE (§9's named risk). The thumb is judged on its
//     own timestamp, never the last painted frame, so this drives it at 8× CPU throttle.
//   · THE POUR IS A HOLD, and a hold on a control inside anything scrollable dies to `pointercancel`
//     after two moves. The tray takes the pointer outright; a real press-and-hold proves it.
import { test, expect } from '@playwright/test';

const SHOT = 'test-results/cafe-';

async function bench(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));   // an area can look alive and be dead
  await page.goto('/dev/cafe/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__cafe && window.__cafe.counter, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  return errors;
}
const seam = (page, fn, arg) => page.evaluate(fn, arg);

test('the tray leaves the square visible, and folds when you step off the mark', async ({ page }) => {
  const errors = await bench(page);

  const box = await page.evaluate(() => {
    const v = document.getElementById('cbView').getBoundingClientRect();
    const t = document.querySelector('.tw-cup').getBoundingClientRect();
    return {
      view: { w: v.width, h: v.height, left: v.left, right: v.right, bottom: v.bottom },
      tray: { w: t.width, h: t.height, left: t.left, right: t.right, bottom: t.bottom },
      z: +getComputedStyle(document.querySelector('.tw-cup')).zIndex,
      parent: document.querySelector('.tw-cup').parentElement.id,
      pos: getComputedStyle(document.querySelector('.tw-cup')).position,
    };
  });
  // ⚠️ a child of the VIEW or it anchors to the page — .tw-stage and .tw-wrap are position:static
  expect(box.parent, 'the tray hangs off the view itself').toBe('cbView');
  expect(box.pos).toBe('absolute');
  expect(Math.round(box.tray.left), 'it spans the full width').toBe(Math.round(box.view.left));
  expect(Math.round(box.tray.right)).toBe(Math.round(box.view.right));
  expect(Math.round(box.tray.bottom), 'and sits on the bottom edge').toBe(Math.round(box.view.bottom));
  // ⭐ THE WHOLE ARGUMENT FOR THE TRAY, as a number: three quarters of the square is still there
  expect(box.tray.h / box.view.h, 'the tray takes a strip, never the screen').toBeLessThan(0.3);
  expect(box.z, 'above the world and the health bar, below the card panel (1500)').toBeGreaterThan(9);
  expect(box.z).toBeLessThan(1500);

  // the queue is behind it and on screen: the lamp, the ghost and the line are all still choosable
  const seen = await page.evaluate(() => {
    const v = document.getElementById('cbView').getBoundingClientRect();
    const t = document.querySelector('.tw-cup').getBoundingClientRect();
    return [...document.querySelectorAll('.cb-body')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.bottom > v.top && r.bottom < t.top && r.left > v.left && r.right < v.right;
    }).length;
  });
  expect(seen, 'the whole queue is visible ABOVE the tray while you work').toBe(3);

  // step off the mark: the tray folds out of the way and the cup waits for you
  await seam(page, () => window.__cafe.counter.fold());
  await page.waitForTimeout(350);
  const folded = await page.evaluate(() => {
    const v = document.getElementById('cbView').getBoundingClientRect();
    const t = document.querySelector('.tw-cup').getBoundingClientRect();
    return { below: t.top >= v.bottom - 1, open: window.__cafe.counter.open() };
  });
  expect(folded.below, 'folded, it is off the bottom of the square entirely').toBe(true);
  expect(folded.open).toBe(false);
  await seam(page, () => window.__cafe.counter.show());
  await page.waitForTimeout(350);
  expect(await seam(page, () => window.__cafe.counter.open()), 'and it comes back up').toBe(true);
  expect(errors).toEqual([]);
});

// ⭐ §9's NAMED RISK, answered with a number. "Timing windows on throttled phones and the hold
// gesture; a CPU-throttled perfect cup must be reachable, and the walk must prove it."
test('a PERFECT cup is reachable on an 8× throttled phone', async ({ page, browser }) => {
  const errors = await bench(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });

  const got = await page.evaluate(async () => {
    const c = window.__cafe.counter, sm = c.seam;
    window.__cafe.serve();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let guard = 0; guard < 30 && c.cup(); guard++) {
      const key = sm.station();
      // the perfect instant is SOLVED, not hunted: v is a pure function of the clock, which is the
      // whole reason a slow screen cannot cost the player a cup
      const t = sm.best(performance.now());
      await wait(Math.max(0, t - performance.now()));
      if (key === 'pour') { sm.press(performance.now()); await wait(30); sm.release(sm.best(performance.now())); }
      else sm.press(sm.best(performance.now()));
      await wait(20);
    }
    return (document.getElementById('cbLog').textContent || '').split('\n')[0];
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  expect(got, 'grind, pour and milk all perfect at 8× CPU').toContain('PERFECT');
  expect(got, 'and it pays the top tip').toContain('tip 5');
  expect(errors).toEqual([]);
});

// ⚠️ THE MEASURED KILLER: a vertical drag begun on a control inside anything that can scroll gets
// `pointercancel` after two moves, and the pour dies before it is written. The tray takes the
// pointer outright (touch-action:none, nothing scrollable) and listens for the release on the
// window, so a thumb that slides off the button still finishes its pour.
test('the pour survives a real press-and-hold, and a thumb that slides off it', async ({ page }) => {
  const errors = await bench(page);
  const cancels = await page.evaluate(() => { window.__cancels = 0; window.addEventListener('pointercancel', () => { window.__cancels++; }, true); return 0; });
  void cancels;
  // land the grinder however it falls, so the cup is on the pour
  await seam(page, () => { const sm = window.__cafe.counter.seam; sm.press(performance.now()); });
  expect(await seam(page, () => window.__cafe.counter.seam.station()), 'the cup is at the pour').toBe('pour');

  const btn = page.locator('.tw-cup__go');
  const b = await btn.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  expect(await seam(page, () => !!window.__cafe.counter.cup().held), 'the hold started').toBe(true);
  await page.waitForTimeout(700);
  const mid = await seam(page, () => window.__cafe.counter.cup().v);
  expect(mid, 'and the level is rising while it is held').toBeGreaterThan(0.2);
  // the thumb slides right off the button, the way a thumb does
  await page.mouse.move(b.x + b.width / 2, b.y - 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ station: window.__cafe.counter.seam.station(), cancels: window.__cancels }));
  expect(after.station, 'the pour LANDED — it did not hang on the button').toBe('milk');
  expect(after.cancels, 'and nothing cancelled the pointer stream').toBe(0);
  expect(errors).toEqual([]);
});

// 🤫 THE QUIET RULE, which the design library has always claimed the town walk checks and which
// nothing in tests/ has ever actually asserted: no banana in this world ever wears a speech bubble.
// Patience is the BODY — the shadow under it — and a leaver is named in the town's own toast.
test('patience is the body: not one bubble over a customer, day or night', async ({ page }) => {
  const errors = await bench(page);
  const quiet = await page.evaluate(() => {
    const bad = [];
    for (const b of document.querySelectorAll('.cb-body')) {
      if ((b.textContent || '').trim()) bad.push('text on a body: ' + b.textContent.trim().slice(0, 40));
      for (const kid of b.children) if (kid.tagName !== 'CANVAS') bad.push('a non-canvas child on a body: ' + kid.tagName);
    }
    return bad;
  });
  expect(quiet, '⚠️ a customer said something — the Quiet Rule is broken').toEqual([]);

  // the three steps of patience are a colour under the body, and nothing else changes
  const steps = await page.evaluate(() => {
    const b = document.querySelector('.cb-body');
    const read = () => getComputedStyle(b).getPropertyValue('--tw-pat').trim();
    const out = { green: read() };
    b.classList.add('is-half'); out.half = read();
    b.classList.remove('is-half'); b.classList.add('is-last'); out.last = read();
    b.classList.remove('is-last');
    return out;
  });
  expect(steps.green, 'a fresh customer stands on green').toBeTruthy();
  expect(steps.half, 'amber at half').not.toBe(steps.green);
  expect(steps.last, 'red at a fifth').not.toBe(steps.half);

  await page.screenshot({ path: SHOT + 'day.png' });
  await page.evaluate(() => document.getElementById('cbNight').classList.add('is-on'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOT + 'night.png' });
  expect(errors).toEqual([]);
});
