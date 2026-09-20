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
    return window.__cafe.last;
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // ⚠️ the CUP, not the log line: a log line is prose, and prose belongs to the rig — asserting on
  // it makes the next approved draft break a test that is about timing
  expect(got, 'a cup was actually finished').toBeTruthy();
  expect(got.marks, 'grind, pour and milk all perfect at 8× CPU').toEqual([2, 2, 2]);
  expect(got.grade).toBe('perfect');
  expect(got.tip, 'and it pays the top tip').toBe(5);
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

// ☕ CLOCKING IN, in the town itself (Trym, 19 Sep: "the banana can be inside of that window … let
// the coffee cup sprite overflow the banana — the locked banana frame can be the hands up pose").
// No new prop and no mark painted on the cobbles: the kiosk already has a serving hatch, and
// working it means standing in it.
//
// ⚠️ THE TWO WAYS THIS GOES WRONG, both seen on screen before these lines existed:
//   · THE Z. Everything outdoors sorts by its foot, and the hatch's floor is 30 px ABOVE the
//     kiosk's — so a banana placed by its own feet stands BEHIND the building it is inside, and the
//     shift is invisible with nothing to explain it. The beach's painter's-algorithm trap, in a new place.
//   · THE HAT. A viking helmet's horns ran straight up the COFFEE AND TEA sign. The banana is sized
//     to the window and clipped to the arch, so the kiosk overflows the banana rather than the reverse.
async function square(page, hat) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (hat) await page.addInitScript((h) => { try { localStorage.setItem('bb-last', JSON.stringify({ hat: h, glasses: 'nerd', extras: {} })); } catch (e) {} }, hat);
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(300);
  return errors;
}

test('a shift is standing in the Coffee Cup’s own window, and only for its own staff', async ({ page }) => {
  const errors = await square(page);

  // ── the kiosk is a building to everyone else
  await page.evaluate(() => window.__town.work.set({ at: '' }));
  expect(await page.evaluate(() => window.__town.room.open('cafe')), 'a stranger does not clock in').toBe(false);
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  expect(await page.evaluate(() => window.__town.room.open('cafe')), 'nor does Pip’s restocker').toBe(false);
  expect(await page.locator('.tw-atwork').count()).toBe(0);

  // ── you work here: the tap answers, the walk happens, and the banana is in the window
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  expect(await page.evaluate(() => window.__town.room.cafeReady()), 'the counter’s chunk arrives').toBe(true);
  expect(await page.evaluate(() => window.__town.room.open('cafe')), 'and the kiosk answers its own staff').toBe(true);
  await page.waitForFunction(() => document.querySelector('.tw-atwork'), null, { timeout: 5000 });

  const st = await page.evaluate(() => {
    const el = document.querySelector('.tw-atwork');
    const me = document.querySelector('.tw-me');
    const ov = [...document.querySelectorAll('.tw-ov')].find((o) => o.dataset.key === 'cafe');
    const r = el.getBoundingClientRect(), k = ov.getBoundingClientRect();
    return {
      elZ: +el.style.zIndex, kioskZ: +getComputedStyle(ov).zIndex,
      meGone: getComputedStyle(me).display === 'none',
      clipped: /ellipse/.test(el.style.clipPath || ''),
      // ⚠️ what is SEEN is the clip, not the element. The banana is deliberately bigger than the
      // window — only its upper body is in it — and getBoundingClientRect knows nothing about clip-path.
      inside: (() => { const w = window.__town.room.cafe().window(), p = window.__town.PROPS.cafe;
        return !!w && w.x0 >= p.x && w.x1 <= p.x + p.w && w.y0 >= p.y && w.y1 <= p.base; })(),
      bigger: r.height > (k.height * 0.25),
      tray: !!document.querySelector('.tw-cup'),
      on: window.__town.room.cafe().on(),
    };
  });
  expect(st.on, 'the shift is on').toBe(true);
  expect(st.elZ, '⚠️ IN FRONT of the kiosk, not behind it — the hatch floor is above the building’s foot').toBeGreaterThan(st.kioskZ);
  expect(st.meGone, 'and your banana on the cobbles is gone, because it is the one in the window').toBe(true);
  expect(st.clipped, 'the arch clips it, so the kiosk overflows the banana').toBe(true);
  expect(st.inside, 'the window it shows through is inside the kiosk’s own box').toBe(true);
  expect(st.bigger, 'and the banana is a proper size — the window crops it, the scale does not').toBe(true);
  expect(st.tray, 'and the tray is up').toBe(true);
  // the shot is for the eye: Bean stands at this door and the FOR SALE sign hangs over it, and
  // neither is what is being looked at
  await page.addStyleTag({ content: '.tw-npc{display:none!important}.tw-forsale{display:none!important}' });
  await page.waitForTimeout(150);
  const kb = await page.locator('.tw-ov[data-key="cafe"]').boundingBox();
  await page.screenshot({ path: SHOT + 'shift.png', clip: { x: Math.max(0, kb.x - 20), y: Math.max(0, kb.y - 10), width: kb.width + 40, height: kb.height + 30 } });

  // ── tapping again steps out
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  await page.waitForTimeout(300);
  expect(await page.locator('.tw-atwork').count(), 'the window empties').toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.tw-me')).display !== 'none'), 'and you are back on the cobbles').toBe(true);
  expect(errors).toEqual([]);
});

// ⚠️ THE WORST HAT IN THE GAME, on purpose. Before the arch clipped it, the viking helmet's horns
// ran up over the COFFEE AND TEA sign — a thing no gate could have caught and only a screenshot did.
test('the tallest hat in the game stays inside the window', async ({ page }) => {
  const errors = await square(page, 'viking');
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => document.querySelector('.tw-atwork'), null, { timeout: 5000 });
  const fit = await page.evaluate(() => {
    const el = document.querySelector('.tw-atwork');
    const ov = [...document.querySelectorAll('.tw-ov')].find((o) => o.dataset.key === 'cafe');
    const r = el.getBoundingClientRect(), k = ov.getBoundingClientRect();
    // the sign band is the top half of the kiosk: nothing the player wears may reach it. ⚠️ measured
    // on the WINDOW, because the element now extends past the opening on purpose and is clipped to it.
    const w = window.__town.room.cafe().window(), p = window.__town.PROPS.cafe;
    void r;
    return { overSign: (w.y0 - p.y) / (p.base - p.y) < 0.55, clip: el.style.clipPath, top: w.y0, kioskTop: p.y };
  });
  expect(fit.clip, 'the arch is clipping').toContain('ellipse');
  expect(fit.overSign, '⚠️ a horn reached the COFFEE AND TEA sign').toBe(false);
  expect(errors).toEqual([]);
});

// ☕ THE QUEUE AND THE TILL — the whole shift, in the town (20 Sep 2026).
//
// Bananas visiting the square peel off to the rope, the front one's order goes on the tray, and the
// tips are paid ONCE at clock-out through the only faucet the server knows.
//
// ⚠️ WHAT THIS EXISTS TO CATCH:
//   · the counter's STYLESHEET not being linked in the town. It was not, for a day: the bench at
//     /dev/cafe/ linked it and the town did not, so the tray was fully styled where it was being
//     thumbed and completely unstyled in the actual game. Nothing else would have noticed.
//   · patience showing nothing, because the shadow reads a custom property that file provides
//   · the till paying what the grades came to rather than what the day's cap still allows
async function shift(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 5000 });
  return errors;
}

test('the queue forms at the rope, above the tray, and patience is the shadow', async ({ page }) => {
  const errors = await shift(page);

  // ⚠️ THE STYLESHEET. /css/town-cafe.css is what makes the tray a tray and the shadow a patience
  // clock — and the town did not link it for a day while the bench did.
  const styled = await page.evaluate(() => {
    const t = document.querySelector('.tw-cup');
    const s = getComputedStyle(t);
    return { pos: s.position, z: +s.zIndex, bottom: s.bottom, touch: s.touchAction };
  });
  expect(styled.pos, '.tw-cup is positioned by the stylesheet, not by luck').toBe('absolute');
  expect(styled.z, 'and sits above the world').toBeGreaterThan(9);
  expect(styled.touch, '⚠️ touch-action:none, or the pour dies to pointercancel on a phone').toBe('none');

  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(500); }
  await page.evaluate(() => window.__town.room.cafe().arrive());
  await page.waitForTimeout(300);
  const line = await page.evaluate(() => window.__town.room.cafe().line());
  expect(line.length, 'a queue formed').toBeGreaterThan(0);

  // ⭐ the rope is ABOVE the tray, which is the whole argument for the tray (measured on the bench)
  const rope = await page.evaluate(() => window.__town.room.cafe().rope());
  for (const r of rope) expect(r.y, `a rope mark at ${r.x},${r.y} is above the tray's strip`).toBeLessThan(1150);

  // 🤫 patience is the BODY: a shadow under a banana, never a bubble over one
  const pat = await page.evaluate(() => {
    const b = document.querySelector('.tw-wait');
    return b ? { bg: getComputedStyle(b, '::after').backgroundColor, text: (b.textContent || '').trim() } : null;
  });
  expect(pat, 'somebody is waiting').not.toBeNull();
  expect(pat.bg, '⚠️ the shadow is the patience colour, not the default grey').not.toBe('rgba(20, 30, 18, 0.34)');
  expect(pat.text, 'and not one word over their head').toBe('');
  expect(errors).toEqual([]);
});

test('a served cup pays tips at clock-out, once, through the faucet the server knows', async ({ page }) => {
  const errors = await shift(page);
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(500); }
  await page.evaluate(() => window.__town.room.cafe().arrive());
  await page.waitForTimeout(300);

  // make cups the way the bench proved they can be made
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let k = 0; k < 3; k++) {
      window.__town.room.cafe().serve();
      const sm = window.__town.room.cafe().gest();
      if (!sm) break;
      for (let g = 0; g < 20 && window.__town.room.cafe().cup(); g++) {
        const key = sm.station(); if (!key) break;
        const t = sm.best(performance.now());
        await wait(Math.max(0, t - performance.now()));
        if (key === 'pour') { sm.press(performance.now()); await wait(30); sm.release(sm.best(performance.now())); }
        else sm.press(sm.best(performance.now()));
        await wait(20);
      }
      await wait(150);
    }
  });
  const took = await page.evaluate(() => window.__town.room.cafe().take());
  expect(took.served, 'cups were served').toBeGreaterThan(0);
  expect(took.tips, 'and they are worth something').toBeGreaterThan(0);

  // ⚠️ NOTHING IS PAID UNTIL YOU STEP AWAY. A tip banked per cup would be a faucet the server sees
  // a dozen times a shift instead of once.
  const before = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pass-ev-v1') || '[]') || []).filter((e) => e.s === 'tips').length; } catch (e) { return -1; } });
  expect(before, 'not a coin has moved yet').toBe(0);

  await page.evaluate(() => window.__town.room.cafe().clockOut());
  await page.waitForTimeout(400);
  const paid = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pass-ev-v1') || '[]') || []).filter((e) => e.s === 'tips').map((e) => e.d); } catch (e) { return []; } });
  expect(paid.length, 'paid ONCE, at the end').toBe(1);
  expect(paid[0], 'and it is what the shift came to').toBe(took.tips);
  // ⚠️ a nominal cup may never exceed 6: the stew buff DOUBLES a faucet and 6 × 2 = 12 = the max,
  // and a faucet over its max is refused WHOLE, so the coins would evaporate at the next ack
  expect(paid[0] / Math.max(1, took.served), 'no cup is worth more than the faucet allows').toBeLessThanOrEqual(6);

  const card = await page.evaluate(() => (document.getElementById('twCardBody') || {}).textContent || '');
  expect(card, 'the receipt names the take').toContain(String(took.tips));
  expect(errors).toEqual([]);
});
