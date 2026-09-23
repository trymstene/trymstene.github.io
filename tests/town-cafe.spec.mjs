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
import COPY from '../src/data/copy/town-cafe.json' with { type: 'json' };

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
  expect(got.tip, 'and it pays the top tip (2 since the ladder’s one pay scale, 23 Sep 2026)').toBe(2);
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

  // ⭐ PATIENCE IS THE BODY, AND ONLY THE BODY (Trym, 20 Sep: "the shadow color underneath the banana
  // isn't very pedagogic, i don't understand what it means"). It used to be the colour of the ellipse
  // they stand on — green, amber, red — which nobody could learn, because nothing else in this world
  // states a value on the floor. They act it: still, then shifting weight, then turned away. What this
  // asserts is that the SHADOW IS JUST A SHADOW and the poses are three different things.
  const steps = await page.evaluate(() => {
    const b = document.querySelector('.cb-body');
    return {
      shadow: getComputedStyle(b, '::after').backgroundColor,
      ladder: getComputedStyle(b).getPropertyValue('--tw-pat').trim(),
    };
  });
  expect(steps.ladder, '⚠️ no patience colour survives anywhere').toBe('');
  expect(steps.shadow, 'a waiting banana stands on the town’s ordinary shadow').toBe('rgba(20, 30, 18, 0.34)');

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

  // ── the kiosk is a building to everyone else — and it says so IN ITS OWN WORDS. The tap used to be
  // answered by the world's fallback, which ended "Not built yet." on the building carrying the biggest
  // thing in the release; four of six critics found that one sentence. The front answers now, from the
  // rig, so `open` is TRUTHY for a stranger and what must be false is the SHIFT.
  for (const at of ['', 'store']) {
    await page.evaluate((j) => window.__town.work.set({ at: j }), at);
    await page.evaluate(() => window.__town.room.open('cafe'));
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => { const c = window.__town.room.cafe(); return !!(c && c.on()); }), `a ${at || 'stranger'} does not clock in`).toBe(false);
    const said = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
    expect(said.length, 'and the front says something rather than nothing').toBeGreaterThan(10);
    expect(said, '⚠️ never the old hand-written stub').not.toContain('Not built yet');
  }
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
  // the shot is for the eye: Bean stands at this door, and he is not what is being looked at
  await page.addStyleTag({ content: '.tw-npc{display:none!important}' });
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
  // ⚠️ 360 WIDE, not the house 393: at 360×740 the whole world fits the view, so the tray owns a
  // deeper slice of the world than it does on any other phone — and that is the width the old rope
  // hid all three customers at. The tightest supported screen is the one this has to be true on.
  await page.setViewportSize({ width: 360, height: 740 });
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

  // ⭐ THE ROPE IS ABOVE THE TRAY, which is the whole argument for the tray — and it is measured on
  // the SCREEN now, at the narrowest phone the house supports. A world-y ceiling of 1150 stood here
  // for a day and was simply wrong: at 360×740 the entire world fits the view, so the tray's 150 px
  // own everything past world y 1061, and two of three customers were standing behind it at 393.
  // ⭐ AND THEY DO NOT OVERLAP. A body is 99 world px wide; the marks were 30 px apart, so the queue
  // was a pile of bananas at 57% overlap, measured. This asserts the daylight between them.
  const geo = await page.evaluate(() => {
    const tray = document.querySelector('.tw-cup').getBoundingClientRect();
    const wl = document.getElementById('twWorld').getBoundingClientRect();
    const s = wl.width / 2200;                       // town-geo.js WORLD.w
    const BODY = 99;                                 // what drawComposite lays down for one banana
    return {
      maxFoot: (tray.top - wl.top) / s,
      marks: window.__town.room.cafe().rope().map((m) => ({ x: m.x, y: m.y, l: m.x - BODY / 2, r: m.x + BODY / 2 })),
      win: window.__town.room.cafe().window(),
    };
  });
  for (const m of geo.marks) {
    expect(m.y, `a rope mark at ${m.x},${m.y} stands where the counter UI cannot cover its feet`).toBeLessThan(geo.maxFoot);
    expect(m.y, 'and in front of the storefronts, not inside them').toBeGreaterThan(1040);
  }
  for (let i = 1; i < geo.marks.length; i++) {
    const gap = geo.marks[i].l - geo.marks[i - 1].l;
    expect(Math.abs(gap), 'a queue, not a pile: one body between marks').toBeGreaterThanOrEqual(99);
  }
  // 🪟 and nobody stands in front of the hatch, which is where the player's own face is
  if (geo.win) for (const m of geo.marks) {
    expect(m.l > geo.win.x1 || m.r < geo.win.x0, `the customer at ${m.x} leaves the serving window clear`).toBe(true);
  }

  // 🤫 PATIENCE IS THE BODY, never a bubble over one — and never a colour on the floor either. The
  // rung is driven the whole way up to the last one and what changes is the POSE: still at first, then
  // shifting weight, then turned away from the counter (every rope mark is left of the window, so the
  // counter is on their right and the left-facing pair is facing away from it).
  const pat = await page.evaluate(async () => {
    const seam = window.__town.room.cafe();
    const v = seam.line()[0];
    const who = () => (window.__town.room.folk().folk() || []).find((q) => q.job === 'queue');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const seen = {};
    for (const rung of [0, 1, 2]) {
      window.__town.room.cafe().rung(rung);
      await wait(700);
      const q = who();
      seen[rung] = q ? { pat: q.pat, frame: q.frame } : null;
    }
    const b = document.querySelector('.tw-wait');
    return { seen, shadow: b ? getComputedStyle(b, '::after').backgroundColor : null, text: b ? (b.textContent || '').trim() : null, some: !!v };
  });
  expect(pat.some, 'somebody is waiting').toBe(true);
  expect(pat.shadow, '⚠️ a waiting banana stands on the town’s ordinary shadow, not a readout').toBe('rgba(20, 30, 18, 0.34)');
  expect(pat.text, 'and not one word over their head').toBe('');
  expect(pat.seen[0], 'the rung reaches the body').not.toBeNull();
  // ⚠️ the FRAME is the assertion: 2 and 3 are the front pair, 4 and 5 the left-facing one, so a
  // customer at the last rung has literally turned away from the counter
  expect(pat.seen[2].frame, 'at the last rung they have turned their back on the counter').toBeGreaterThanOrEqual(4);
  expect(pat.seen[0].frame, 'and a fresh one has not').toBeLessThan(4);
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
  // 🪙 AND EACH ONE SAID SO AS IT POURED (Trym, 21 Sep: "its not very obvious how i make tips while
  // working"): the tray's coin counter carries the shift's total, and a +n floated from the hatch.
  const chip = await page.evaluate(() => { const t = document.querySelector('.tw-cup__tips'); return t ? { hidden: t.hidden, n: parseInt(t.textContent, 10) } : null; });
  expect(chip, 'the tray has a tips counter').not.toBeNull();
  expect(chip.hidden, 'and it is showing').toBe(false);
  expect(chip.n, 'with the shift’s total on it').toBe(took.tips);

  // ⚠️ NOTHING IS PAID UNTIL YOU STEP AWAY. A tip banked per cup would be a faucet the server sees
  // a dozen times a shift instead of once.
  const before = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pass-ev-v1') || '[]') || []).filter((e) => e.s === 'tips').length; } catch (e) { return -1; } });
  expect(before, 'not a coin has moved yet').toBe(0);

  await page.evaluate(() => window.__town.room.cafe().clockOut());
  await page.waitForTimeout(400);
  const paid = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pass-ev-v1') || '[]') || []).filter((e) => e.s === 'tips').map((e) => e.d); } catch (e) { return []; } });
  expect(paid.length, 'paid at the end').toBeGreaterThan(0);
  expect(paid.reduce((a, b) => a + b, 0), 'and it is what the shift came to').toBe(took.tips);
  // ⚠️ THE RULE IS PER EVENT: RULES.town.tips refuses any ONE event over 12, whole (the jobs audit, 22 Sep)
  expect(Math.max(...paid), 'no one payment is over the faucet’s max').toBeLessThanOrEqual(12);
  // ⚠️ a nominal cup may never exceed 6: the stew buff DOUBLES a faucet and 6 × 2 = 12 = the max
  expect(took.tips / Math.max(1, took.served), 'no cup is worth more than the faucet allows').toBeLessThanOrEqual(6);

  const card = await page.evaluate(() => (document.getElementById('twCardBody') || {}).textContent || '');
  expect(card, 'the receipt names the take').toContain(String(took.tips));
  expect(errors).toEqual([]);
});

// 🪙 A LONG SHIFT'S TIPS LAND (the jobs audit, 22 Sep 2026). A shift used to be paid as ONE event, and the
// server refuses any one tips event over 12 whole — so every shift worth more than 12 (6 with the stew buff)
// was taken back at the next ack while the receipt said it was paid. It is paid in pieces now.
// 🪜 and since the ladder (23 Sep 2026) the day's tips stop at the RANK's cap: the Coffee Cup's top rank (31 a day)
// is where a shift big enough to need pieces can still land whole.
for (const buffed of [false, true]) {
  test(`a big shift at the top rank is paid in pieces the server accepts${buffed ? ', with the stew buff' : ''}`, async ({ page }) => {
    if (buffed) await page.addInitScript(() => { try { localStorage.setItem('hs-buff-v1', JSON.stringify({ fx: 'coins2', until: Date.now() + 36e5 })); } catch (e) {} });
    const errors = await shift(page);
    await page.evaluate(() => window.__town.work.setLad({ xp: 1500, rank: 4 }));
    await page.evaluate(() => { const c = window.__town.room.cafe(); for (let i = 0; i < 10; i++) c.tip(2); });
    await page.evaluate(() => window.__town.room.cafe().clockOut());
    await page.waitForTimeout(400);
    const paid = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pass-ev-v1') || '[]') || []).filter((e) => e.s === 'tips').map((e) => e.d); } catch (e) { return []; } });
    // twenty tips: all twenty land unbuffed (under 31); with the buff doubling them, the cap lets fifteen through as thirty
    const want = buffed ? 30 : 20;
    expect(Math.max(...paid), '⭐ no one event is over the server’s max of 12').toBeLessThanOrEqual(12);
    expect(paid.reduce((a, b) => a + b, 0), 'and together they are the whole shift' + (buffed ? ', doubled' : '')).toBe(want);
    const card = await page.evaluate(() => (document.getElementById('twCardBody') || {}).textContent || '');
    expect(card, 'the receipt names what landed').toContain(String(want));
    expect(errors).toEqual([]);
  });
}

// 🪜 ONE PAY SCALE (Trym, 23 Sep 2026: "yes, one pay scale"): a day's tips stop at a fifth of the rank's full week — 18 at
// the Coffee Cup's first rank. The cups past the cap still count, for their work XP, and the receipt says how much.
test('at the first rank the day’s tips stop at 18, and the shift’s cups still earn work XP', async ({ page }) => {
  const errors = await shift(page);
  expect(await page.evaluate(() => window.__town.room.cafe().left()), 'a fresh day: eighteen to earn').toBe(18);
  await page.evaluate(() => { const c = window.__town.room.cafe(); for (let i = 0; i < 12; i++) c.tip(2, 2); });
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  await page.waitForTimeout(400);
  const paid = await page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('pass-ev-v1') || '[]') || []).filter((e) => e.s === 'tips').map((e) => e.d); } catch (e) { return []; } });
  expect(paid.reduce((a, b) => a + b, 0), '⭐ twenty-four tips earned, eighteen paid: the rank’s cap').toBe(18);
  expect(await page.evaluate(() => window.__town.room.cafe().left()), 'and nothing is left today').toBe(0);
  // the twelve perfect cups went on the ladder as one report: ten for the day and six a cup, up to the day's eighty
  expect(await page.evaluate(() => window.__town.room.cafe().xp()), 'the shift’s work XP: the day’s cap at the Coffee Cup').toBe(80);
  expect(await page.evaluate(() => window.__town.work.ladder().today), 'and the ladder has it').toBe(80);
  const card = await page.evaluate(() => (document.getElementById('twCardBody') || {}).textContent || '');
  expect(card, 'the receipt names the take').toContain('18');
  expect(card, '⭐ and the XP the shift earned').toContain(COPY.receipt.xp.replace('{n}', '80'));
  expect(await page.evaluate(() => !!document.querySelector('.tw-cup__xpbar i')), 'with a bar to the next rank').toBe(true);
  await page.locator('.tw-card').screenshot({ path: 'test-results/cafe-receipt-ladder.png' });
  expect(errors).toEqual([]);
});

// ⚠️ THE EDGES OF A SHIFT, all four found by probing rather than by reading (20 Sep).
test('a shift ends when you walk away, and cannot be started twice or behind a shut door', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); });
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  const stand = () => page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });

  // ── a town too low to keep the café open: the door answers, and nobody clocks in
  await page.evaluate(() => window.__town.room.set(15));
  await page.waitForTimeout(800);
  await stand();
  expect(await page.evaluate(() => window.__town.room.open('cafe')), 'the shut door still says why').toBe(true);
  expect(await page.evaluate(() => window.__town.room.cafe().on()), '…but there is no shift behind a shutter').toBe(false);

  // ── clocked in, then into the general store
  await page.evaluate(() => window.__town.room.set(85));
  await page.waitForTimeout(800);
  await stand();
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe().on(), null, { timeout: 5000 });
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForTimeout(600);
  const room = await page.evaluate(() => {
    const t = document.querySelector('.tw-cup');
    const w = document.querySelector('.tw-atwork');
    return {
      on: window.__town.room.cafe().on(),
      tray: t ? (!t.hidden && getComputedStyle(t).visibility === 'visible') : false,
      atWork: w ? getComputedStyle(w).visibility === 'visible' : false,
    };
  });
  // ⚠️ WALKING INTO A SHOP IS WALKING AWAY. Before this the tray stayed up over the store's plate and
  // your own banana went on standing in the café window while you were inside somebody else's shop —
  // the tray is a child of the VIEW, so neither `.is-inside` hide list can reach it.
  expect(room.on, 'a room ends the shift').toBe(false);
  expect(room.tray, '⚠️ and the tray is not left over the shop’s plate').toBe(false);
  expect(room.atWork, '⚠️ nor your banana still serving coffee from inside the grocer’s').toBe(false);
  await page.evaluate(() => window.__town.rooms.exit());
  await page.waitForTimeout(400);

  // ── clocking in twice is once
  // ⚠️ THE RECEIPT IS STILL UP from the clock-out above, and since 20 Sep a card owns the world while it
  // is open — nothing walks behind one, so the walk-then-clock-in this tap arms would sit waiting. A
  // player cannot reach the kiosk through an open card either; they close it first, so the walk does too.
  await page.evaluate(() => { const x = document.getElementById('twCardX'); if (x && !document.getElementById('twPanel').hidden) x.click(); });
  await page.waitForTimeout(300);
  await stand();
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe().on(), null, { timeout: 5000 });
  const twice = await page.evaluate(() => { const c = window.__town.room.cafe(); c.clockIn(); return { on: c.on(), trays: document.querySelectorAll('.tw-cup').length, windows: document.querySelectorAll('.tw-atwork').length }; });
  expect(twice.on).toBe(true);
  expect(twice.trays, 'one tray, however many times you tap').toBe(1);
  expect(twice.windows, 'and one banana in the window').toBe(1);

  // ── clocking out mid-cup leaves nothing behind
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.waitForTimeout(400);
  await page.evaluate(() => { const c = window.__town.room.cafe(); c.call(); c.arrive(); c.serve(); });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => !!window.__town.room.cafe().cup()), 'a cup is in hand').toBe(true);
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ on: window.__town.room.cafe().on(), line: window.__town.room.cafe().line().length, cup: !!window.__town.room.cafe().cup(), atwork: !!document.querySelector('.tw-atwork') }));
  expect(after, 'the shift takes everything with it').toEqual({ on: false, line: 0, cup: false, atwork: false });
  expect(errors).toEqual([]);
});

// ⭐ THE DIFFICULTY IS A MEASUREMENT NOW, NOT A HOPE (20 Sep 2026, the critics' §18 and §9).
//
// The walk above proves a PERFECT cup is reachable by a machine pressing at an exact millisecond.
// That is a different claim from "reachable by a person", and for a day it hid two real bugs:
//   · the grinder's band came from `(seed | 0) % 50` and `seed` is a uint32, so roughly half of all
//     seeds went NEGATIVE and a quarter of all cups had their target off the left edge of the bar;
//   · the milk's band sat AT the bar's right edge with a 640 ms up-and-down, which left a ±18 ms
//     perfect window against ±75 ms at the other two stations — so nobody ever poured a perfect cup.
// Both are arithmetic, so both can be asserted. This measures the SHIPPING functions.
test('every station has a perfect window a thumb can hit, and every band lies on the bar', async ({ page }) => {
  const errors = await bench(page);

  const m = await page.evaluate(() => {
    const { newCup, zoneOf, press, release, STATIONS } = window.__cafe.fn;
    const ORDER = ['grind', 'pour', 'milk'];
    const T0 = 10000;   // an arbitrary clock origin: v is a function of the offset from it

    // 1. every band the town's own seeds can produce lies inside the bar
    let offBar = 0, narrowest = 1;
    for (let i = 0; i < 500; i++) {
      const c = newCup('tall', 0, Math.imul(i + 1, 2654435761) >>> 0);
      const z = zoneOf(c, 'grind');
      if (z.from <= 0.0001 || z.to >= 0.9999) offBar++;
      narrowest = Math.min(narrowest, z.to - z.from);
    }

    // 2. how far off the perfect instant a thumb may land and still be graded perfect, per station
    const cupAt = (key) => { const c = newCup('tall', 0, 12345); c.i = ORDER.indexOf(key); c.t0 = T0; return c; };
    const gradeAt = (key, d) => {
      const c = cupAt(key), st = STATIONS[key], z = zoneOf(c, key);
      if (key === 'pour') { press(c, T0); return (release(c, T0 + z.at * st.span + d) || {}).g; }
      if (key === 'milk') {
        const t = T0 + (z.at / 2) * st.span;
        press(c, t + d); press(c, t + st.span + d); press(c, t + st.span * 2 + d);
        return c.marks[c.marks.length - 1];   // the milk's own mark: the mean of its three taps
      }
      return (press(c, T0 + z.at * st.span + d) || {}).g;
    };
    const half = {};
    for (const key of ORDER) { let d = 0; while (d < 600 && gradeAt(key, d) === 2) d += 1; half[key] = d; }
    return { offBar, narrowest, half, perfectAtZero: ORDER.map((k) => gradeAt(k, 0)) };
  });

  expect(m.offBar, 'no seed puts the grinder’s band off the end of the bar').toBe(0);
  expect(m.narrowest, 'and the band is never clipped down to nothing').toBeGreaterThan(0.25);
  expect(m.perfectAtZero, 'a thumb on the exact instant is perfect at all three').toEqual([2, 2, 2]);
  // ⚠️ 30 ms is the floor, and it is not a taste: a practised tap on a moving mark lands inside
  // ±40 ms, so a window narrower than this is a station nobody passes — which is what the milk was.
  for (const key of ['grind', 'pour', 'milk']) {
    expect(m.half[key], key + '’s perfect window is wide enough for a person').toBeGreaterThanOrEqual(30);
  }
  // and no station may be more than three times tighter than the loosest, or one of them is the game
  const all = Object.values(m.half);
  expect(Math.max(...all) / Math.min(...all), 'the three stations are the same kind of hard').toBeLessThan(3);
  expect(errors).toEqual([]);
});

// ⭐ THE COUNTER IS A MARK ON THE GROUND (20 Sep 2026 — five of the six critics found this one).
//
// Clocking in hid the player's banana with a class and nothing ever measured where they were, so a
// shift had no geography at all: you could walk the whole square as nobody with the tray still up,
// serving a queue three screens away. This is Trym's 19 Sep sentence, asserted: "step off the mark
// and it folds, the customer keeps its ticket; step back and it rises" — plus the receipt for
// somebody who walks away and stays away.
test('stepping off the counter mark folds the tray and gives the banana back', async ({ page }) => {
  const errors = await square(page);
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe().on(), null, { timeout: 5000 });

  const look = () => page.evaluate(() => {
    const t = document.querySelector('.tw-cup'), me = document.querySelector('.tw-me'), w = document.querySelector('.tw-atwork');
    return {
      on: window.__town.room.cafe().on(),
      folded: t ? t.classList.contains('is-folded') : null,
      inWindow: !!w,
      meShown: me ? getComputedStyle(me).display !== 'none' : null,
    };
  });

  const behind = await look();
  expect(behind.on, 'the shift is on').toBe(true);
  expect(behind.folded, 'and on the mark the tray is up').toBe(false);
  expect(behind.inWindow, 'with the banana in the serving window').toBe(true);
  expect(behind.meShown, 'and the walking banana put away').toBe(false);

  // ── two body-lengths down the lane: the tray goes down, the banana comes back
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2 - 230; t.pos.y = t.tgt.y = p.base + 60; });
  await page.waitForTimeout(700);
  const off = await look();
  expect(off.on, 'the shift survives a step away — the cup waits').toBe(true);
  expect(off.folded, 'the tray folds').toBe(true);
  expect(off.inWindow, 'nobody is left standing in the window').toBe(false);
  expect(off.meShown, 'and you are a banana again, able to walk').toBe(true);

  // ── back on the mark
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.waitForTimeout(700);
  const back = await look();
  expect(back.folded, 'and it rises again').toBe(false);
  expect(back.inWindow, 'with the banana back in the window').toBe(true);

  // ── right across the square: that is leaving, and leaving pays
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 900; t.pos.y = t.tgt.y = 700; });
  await page.waitForTimeout(900);
  const gone = await look();
  expect(gone.on, 'walking away ends the shift').toBe(false);
  expect(gone.inWindow, 'and empties the window').toBe(false);
  expect(errors).toEqual([]);
});

// ⚠️ THE WORLD'S VOICE HAS NOWHERE TO STAND DURING A SHIFT unless it is told where. The toast is z
// 2000 and docks at the bottom, so it landed on the gauge; raised by 172 px it landed square on the
// barista's face in the window instead (measured: toast 419–495, banana 455–510 at 360×740).
test('the toast never lands on the gauge, the strip or the face in the window', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const errors = await square(page);
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe().on(), null, { timeout: 5000 });
  await page.evaluate(() => window.__town.say('a line the world says while a thumb is on the gauge'));
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bot: b.bottom, h: b.height }; };
    return { toast: box('.tw-toast'), tray: box('.tw-cup'), work: box('.tw-atwork'), strip: box('.wh'), view: box('#twView') };
  });
  expect(r.toast, 'the toast is on screen').not.toBeNull();
  expect(r.toast.h, 'and has a real height').toBeGreaterThan(8);
  const clear = (a, b) => a.bot <= b.top + 1 || a.top >= b.bot - 1;
  for (const [name, other] of [['the tray', r.tray], ['the banana in the window', r.work], ['the HUD strip', r.strip]]) {
    if (!other) continue;
    expect(clear(r.toast, other), `the toast does not overlap ${name}`).toBe(true);
  }
  expect(r.toast.top, 'and it stays inside the view').toBeGreaterThanOrEqual(r.view.top - 1);
  expect(errors).toEqual([]);
});

// ⚠️ A TAP IS NOT A POUR, AND IT MAY NOT COST A CUP. Two of the three stations are taps and this one
// is a hold; the tray's one button looks identical either way, and nothing may say "hold" out loud
// (the brief forbids instructing). A quick tap used to land a release at v ≈ 0.02 — graded WRONG,
// silently, with nothing on screen to say what had happened.
test('a tap on the pour costs nothing: it resets, it does not ruin the cup', async ({ page }) => {
  const errors = await bench(page);
  const r = await page.evaluate(() => {
    const { newCup, press, release, zoneOf, STATIONS } = window.__cafe.fn;
    const c = newCup('tall', 0, 12345);
    c.i = 1; c.t0 = 5000;                       // straight to the pour
    press(c, 5000);                             // thumb down
    const tap = release(c, 5040);               // …and up again 40 ms later: a tap
    const afterTap = { graded: !!tap, marks: c.marks.length, held: c.held };
    press(c, 6000);                             // a real hold this time
    const z = zoneOf(c, 'pour');
    const good = release(c, 6000 + z.at * STATIONS.pour.span);
    return { afterTap, good: good && good.g, marks: c.marks.slice() };
  });
  expect(r.afterTap.graded, 'a tap grades nothing at all').toBe(false);
  expect(r.afterTap.marks, 'and leaves no mark on the cup').toBe(0);
  expect(r.afterTap.held, 'the pour is simply back to unpoured').toBe(0);
  expect(r.good, 'and the hold that follows it still earns a perfect pour').toBe(2);
  expect(errors).toEqual([]);
});

// ☕ THE CUP LEAVES WITH THEM (Trym, 20 Sep: "all customer-bananas that get a coffee should leave with the
// coffee cup / coffee mug wearable that we have"). It is the only thing on screen that says a coffee was
// made: the tray's toast is gone in four seconds and the terrace is across the square.
test('a served customer walks off carrying the cup, and only a served one', async ({ page }) => {
  const errors = await square(page);
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe().on(), null, { timeout: 5000 });

  // ⚠️ nobody in the square starts with one: `mug` was pulled out of the visitors' random HELD list on
  // purpose, because a cup on 3% of strangers is what stopped a cup meaning anything.
  const before = await page.evaluate(() => (window.__town.room.folk().folk() || []).filter((v) => (v.held || []).includes('mug')).length);
  expect(before, 'no stranger carries a coffee for no reason').toBe(0);

  for (let i = 0; i < 2; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(400); }
  await page.evaluate(() => window.__town.room.cafe().arrive());
  await page.waitForTimeout(400);
  const queued = await page.evaluate(() => window.__town.room.cafe().line().length);
  expect(queued, 'a queue formed').toBeGreaterThan(0);

  // one cup, made properly, at the exact instants
  await page.evaluate(async () => {
    const c = window.__town.room.cafe(), g = c.gest();
    c.serve();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let n = 0; n < 30 && c.cup(); n++) {
      const key = g.station();
      const t = g.best(performance.now());
      await wait(Math.max(0, t - performance.now()));
      if (key === 'pour') { g.press(performance.now()); await wait(30); g.release(g.best(performance.now())); }
      else g.press(g.best(performance.now()));
      await wait(20);
    }
  });
  await page.waitForTimeout(600);
  // ⚠️ COUNT THE CUPS, not one: the tray serves the next customer the moment a cup is finished, so the
  // loop above makes as many as the queue can take. What has to hold is that the two numbers match.
  const after = await page.evaluate(() => (window.__town.room.folk().folk() || []).filter((v) => (v.held || []).includes('mug')).length);
  const till = await page.evaluate(() => window.__town.room.cafe().take());
  expect(till.served, 'at least one cup was made').toBeGreaterThan(0);
  expect(after, 'a cup in a hand for every cup that went out, and not one more').toBe(till.served);
  expect(errors).toEqual([]);
});

// 📱 THE TRAY ON A REAL PHONE, measured in the TOWN and not on the bench. The bench's view is taller, so
// the existing "the tray takes a strip, never the screen" assertion ran where it could not fail: in the
// town at 360×640 the tray was 31.7% of the square, over its own bound, because an empty note row held
// 21px open whenever a cup was up. And the toast outranked every card in the town by 500 of z-index, so
// the clock-out line landed square on the receipt on both short phones (design library §8).
for (const [w, h] of [[360, 640], [375, 667], [393, 852]]) {
  test(`the counter holds together at ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errors = await shift(page);
    await page.evaluate(() => window.__town.room.cafe().call());
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__town.room.cafe().arrive());
    await page.evaluate(() => window.__town.room.cafe().serve());
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bot: b.bottom, left: b.left, right: b.right, h: b.height, w: b.width }; };
      const view = box('#twView'), tray = box('.tw-cup'), wl = document.getElementById('twWorld').getBoundingClientRect();
      const s = wl.width / 2200;
      return {
        share: tray.h / view.h,
        clipped: tray.bot - view.bot,
        goWrap: (() => { const g = document.querySelector('.tw-cup__go'); return g ? g.scrollWidth - g.clientWidth : 0; })(),
        // every customer at the rope, fully inside the frame
        marks: window.__town.room.cafe().rope().map((r) => ({ l: wl.left + (r.x - 49.5) * s, r: wl.left + (r.x + 49.5) * s, foot: wl.top + r.y * s })),
        view, tray,
      };
    });
    expect(m.share, 'the tray takes a strip of the square, never a third of it').toBeLessThan(0.3);
    expect(m.clipped, 'and no part of it is cut off by the frame').toBeLessThanOrEqual(1);
    expect(m.goWrap, '⚠️ a button in this world never wraps and never clips').toBeLessThanOrEqual(0);
    for (const k of m.marks) {
      expect(k.l, 'every customer at the rope is inside the frame').toBeGreaterThanOrEqual(m.view.left - 1);
      expect(k.r, 'on both sides').toBeLessThanOrEqual(m.view.right + 1);
      expect(k.foot, 'with its feet above the counter UI').toBeLessThan(m.tray.top);
    }

    // ── and the receipt: a card owns the screen, so nothing of the world's chatter lands on it
    await page.evaluate(() => window.__town.room.cafe().clockOut());
    await page.waitForTimeout(500);
    const over = await page.evaluate(() => {
      const c = document.querySelector('.tw-card'), t = document.querySelector('.tw-toast');
      if (!c || !t || t.hidden) return { clear: true, z: 0 };
      const a = c.getBoundingClientRect(), b = t.getBoundingClientRect();
      const hit = !(b.bottom <= a.top || b.top >= a.bottom || b.right <= a.left || b.left >= a.right);
      const zc = +getComputedStyle(document.querySelector('.tw-panel')).zIndex, zt = +getComputedStyle(t).zIndex;
      return { clear: !hit || zc > zt, z: zc - zt };
    });
    expect(over.clear, 'the toast does not paint over an open card').toBe(true);
    expect(errors).toEqual([]);
  });
}

// ☕ THE WINDOW IS THE TAP TARGET (Trym, 21 Sep): "to walk into the coffee shop for work i should have to
// tap the window - the hitbox now is a bit large so when i try to walk past the coffee shop i start
// working there because i auto-jump into the building". A tap on the kiosk's roof or its side is a walk
// like any tap on a wall; only the serving hatch answers as the café.
test('the café answers at its serving window, and nowhere else on the kiosk', async ({ page }) => {
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.thing, null, { timeout: 30000 });
  const hits = await page.evaluate(() => {
    const w = window.__town.room.cafeReady ? null : null; void w;
    const [x0, y0, x1, y1] = (window.__town.room.cafe && window.__town.room.cafe() && window.__town.room.cafe().window) ? [window.__town.room.cafe().window().x0, window.__town.room.cafe().window().y0, window.__town.room.cafe().window().x1, window.__town.room.cafe().window().y1] : [1806, 960, 1852, 1010];
    const t = window.__town.thing;
    return { hatch: t((x0 + x1) / 2, (y0 + y1) / 2), roof: t((x0 + x1) / 2, y0 - 70), side: t(x0 - 60, (y0 + y1) / 2), window: [x0, y0, x1, y1] };
  });
  // the hatch answers as the café — the kiosk itself, or its shutter to raise on a day it is shut
  expect(hits.hatch && String(hits.hatch[1]).endsWith('cafe'), 'a tap on the hatch is the café: ' + JSON.stringify(hits.hatch)).toBe(true);
  // ⚠️ "not the café" rather than "nothing": Bean stands at his own counter beside the hatch, and a
  // resident or a problem under the tap is a fair answer — a walk into the kiosk is not.
  const isCafe = (h) => !!(h && h[0] === 'spot' && h[1] === 'cafe');
  expect(isCafe(hits.roof), 'a tap on the roof never opens the counter: ' + JSON.stringify(hits.roof)).toBe(false);
  expect(isCafe(hits.side), '…nor does a tap beside the hatch: ' + JSON.stringify(hits.side)).toBe(false);
});

// 🗣 A LINE ONLY WHEN IT TELLS YOU SOMETHING (24 Sep 2026, design library §30): the first good and the first spot-on cup of a
// shift speak, the ones after leave it to the float; a wrong cup speaks every time (nothing floats, the line says why); the
// cup that meets the day's tip limit says so once, and the capped cups after it say nothing.
test('the counter speaks at the moment a cup tells you something, and is quiet after', async ({ page }) => {
  const errors = await shift(page);
  const said = () => page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  const clear = () => page.evaluate(() => { document.getElementById('twToast').textContent = ''; });
  const cup = async (g) => {
    await page.evaluate(() => { const c = window.__town.room.cafe(); c.call(); c.arrive(); c.serve(); });
    await clear();
    return page.evaluate((x) => window.__town.room.cafe().gest().finish(x), g);
  };
  expect(await cup(2), 'a cup to make').toBe(true);
  expect(COPY.cup.perfect, 'the first spot-on cup speaks').toContain(await said());
  await cup(2);
  expect(await said(), 'the second is left to the float').toBe('');
  await cup(1);
  expect(COPY.cup.fine, 'the first good cup speaks, and says the middle tips more').toContain(await said());
  await cup(1);
  expect(await said(), 'the second good cup does not').toBe('');
  await cup(0);
  expect(COPY.cup.wrong, 'a wrong cup speaks').toContain(await said());
  await cup(0);
  expect(COPY.cup.wrong, 'every time: nothing floats, and the line is the only thing that says why').toContain(await said());
  // the day's tips run out: said once, at the cup that met the limit
  await page.evaluate(() => { const c = window.__town.room.cafe(); c.tip(c.left() - c.take().tips - 1, 2); });
  await cup(2);
  expect(await said(), 'the cup that meets the limit says the day’s tips are all earned').toBe(COPY.tipsAll);
  await cup(2);
  expect(await said(), 'and the capped cups after it say nothing').toBe('');
  await cup(2);
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  expect(await page.evaluate(() => document.getElementById('twToast').hidden), 'the receipt is the end of the shift: no line lingers under it').toBe(true);
  await page.evaluate(() => { const x = document.getElementById('twTillX'); if (x) x.click(); });
  // a new shift of wrong cups only: its receipt says every cup missed, not that the day's limit was met
  await page.evaluate(() => window.__town.room.cafe().clockIn());
  await page.waitForFunction(() => window.__town.room.cafe().on(), null, { timeout: 5000 });
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));   // the first shift's customers went off with their cups
  expect(await cup(0), 'a cup to spoil').toBe(true);
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  expect(await page.evaluate(() => document.getElementById('twCardBody').textContent), 'a shift of wrong cups says so').toContain(COPY.receipt.wrong);
  await page.screenshot({ path: 'test-results/cafe-said.png' });
  expect(errors).toEqual([]);
});
