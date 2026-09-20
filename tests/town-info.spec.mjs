// 🗺️ THE INFORMATION KIOSK — the rack of maps, an open map, and the rave's flyer.
//
// Trym asked for this on 20 Sep 2026: "world maps of all areas, thumbnails first, and you can click
// and zoom around on a bigger version … mobile friendlyness here is important." Four things can only
// be proven by measuring, and every one of them was wrong at least once while it was being built:
//   · the map's window had no height of its own, so the card showed a caption and no map at all
//   · the desktop card tied with `.tw-card`'s own max-width on source order and stayed 380 px
//   · a fixed window letterboxed every map into more black than map
//   · a card that overflows its 261 px on a phone looks finished right up until somebody holds one
import { test, expect } from '@playwright/test';

const town = async (page, band = 70) => {
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate((b) => { window.__town.room.curse('none'); window.__town.room.set(b); window.__town.life.set(11); }, band);
  await page.waitForTimeout(400);
};

for (const s of [{ n: 'a phone', w: 360, h: 640, cols: 2 }, { n: 'a desk', w: 1280, h: 900, cols: 3 }]) {
  test('the maps hold together on ' + s.n, async ({ page }) => {
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.setViewportSize({ width: s.w, height: s.h });
    await town(page);
    await page.evaluate(() => window.__town.open('info'));
    await page.waitForFunction(() => document.querySelector('.tw-info__rack'), null, { timeout: 8000 });
    await page.waitForTimeout(700);

    // ── the rack: five tiles, and nothing sticking out of the card
    expect(await page.locator('.tw-info__tile').count(), 'four maps and one flyer').toBe(5);
    const fit = await page.evaluate(() => {
      const c = document.querySelector('.tw-card'), r = c.getBoundingClientRect();
      const out = [];
      c.querySelectorAll('*').forEach((e) => { const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) out.push(e.className); });
      return { out, w: Math.round(r.width), sideways: c.scrollWidth - c.clientWidth, cols: getComputedStyle(document.querySelector('.tw-info__rack')).gridTemplateColumns.split(' ').length };
    });
    expect(fit.out, 'nothing breaks out of the card').toEqual([]);
    expect(fit.sideways, 'and the card never scrolls sideways').toBe(0);
    expect(fit.cols, 'the rack is ' + s.cols + ' tiles across').toBe(s.cols);
    // ⚠️ "a bigger popup for desktop" is the ask; a card that came out 380 px on both looked right
    if (s.w > 720) expect(fit.w, 'the desktop card is wider than a phone card').toBeGreaterThan(500);

    // ── an open map: it is VISIBLE, it fills its window, and it pans and zooms
    await page.evaluate(() => window.__town.info().go('town'));
    await page.waitForTimeout(900);
    const win = await page.evaluate(() => {
      const v = document.querySelector('.tw-info__view'), i = document.querySelector('.tw-info__map');
      const a = v.getBoundingClientRect(), b = i.getBoundingClientRect();
      return { vh: Math.round(a.height), vw: Math.round(a.width), ih: Math.round(b.height), iw: Math.round(b.width) };
    });
    expect(win.vh, 'the map window has a height of its own — 1fr is not one').toBeGreaterThan(80);
    // ⭐ THE WINDOW TAKES THE MAP'S SHAPE, so at rest the map covers it. ⚠️ measured as a SHARE of the
    // window, not in pixels: on a tall desktop card the row's own max-height clamps the box a few px
    // short of the aspect ratio and the map then fits by height, leaving about two pixels of ground
    // either side. That is not a letterbox — the letterbox this guards against was 40% of the window
    // black on a phone — and clamp() centres whatever slack there is, so it reads as a margin.
    expect(Math.abs(win.ih - win.vh) / win.vh, 'no letterbox above and below the map').toBeLessThan(0.03);
    expect(Math.abs(win.iw - win.vw) / win.vw, '…nor bars either side').toBeLessThan(0.03);

    const zoomed = await page.evaluate(() => window.__town.info().zoom(2.5));
    expect(zoomed.z, 'it zooms').toBeCloseTo(2.5, 1);
    const panned = await page.evaluate(() => window.__town.info().pan(-60, -40));
    expect(panned.ox, 'and it pans').toBeLessThan(zoomed.ox);
    // ⚠️ and never past its own edge, which is what makes it feel like paper rather than a bug
    const far = await page.evaluate(() => window.__town.info().pan(9000, 9000));
    expect(far.ox, 'a pan cannot drag the map off its own left edge').toBeLessThanOrEqual(0);
    expect(far.oy, '…nor off the top').toBeLessThanOrEqual(0);

    // ── the flyer
    await page.evaluate(() => window.__town.info().back());
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__town.info().go('rave'));
    await page.waitForTimeout(600);
    expect(await page.locator('.tw-info__acts li').count(), 'three acts on the bill').toBe(3);
    expect(await page.locator('.tw-info__dj').isVisible(), 'and the headliner has a face').toBe(true);
    expect(errs).toEqual([]);
  });
}

test('every map the rack offers is actually there', async ({ page }) => {
  const missing = [];
  page.on('response', (r) => { if (/\/assets\/world\/map-/.test(r.url()) && r.status() >= 400) missing.push(r.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await town(page);
  await page.evaluate(() => window.__town.open('info'));
  await page.waitForFunction(() => document.querySelector('.tw-info__rack'), null, { timeout: 8000 });
  for (const k of await page.evaluate(() => window.__town.info().maps())) {
    await page.evaluate((key) => window.__town.info().go(key), k);
    await page.waitForTimeout(500);
    const ok = await page.evaluate(() => { const i = document.querySelector('.tw-info__map'); return !!(i && i.complete && i.naturalWidth > 200); });
    expect(ok, 'the ' + k + ' map loaded').toBe(true);
    await page.evaluate(() => window.__town.info().back());
    await page.waitForTimeout(150);
  }
  expect(missing, 'no map 404s — the rack and tools/build-area-maps.py agree on the list').toEqual([]);
});

// ℹ️ SOMEBODY IS IN THE KIOSK WHEN IT IS OPEN, AND NOBODY IS WHEN IT IS NOT.
//
// Trym, 20 Sep 2026: "if we can make a banana sit inside the kiosk sprite-wise aswell that would be
// cool … half upper body-banana that sits inside the info kiosk in locked hands-up-frame, same size
// on the kiosk-banana as for the coffee shop-banana." It is the kiosk being open — a lit window — so
// it comes and goes with the shutter and with the clock, and it is never anybody at work.
test('the kiosk has somebody in it, and the kiosk overflows them', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  const at = async (band, beat) => {
    await page.evaluate(([b, t]) => { window.__town.room.curse('none'); window.__town.room.set(b); window.__town.life.set(t); }, [band, beat]);
    await page.waitForTimeout(650);
    return page.evaluate(() => {
      const el = document.querySelector('.tw-kiosker');
      if (!el) return null;
      const k = document.querySelector('img.tw-ov[data-key="info"]');
      const r = el.getBoundingClientRect(), q = k.getBoundingClientRect();
      return { clip: el.style.clipPath, z: +el.style.zIndex, kz: +k.style.zIndex, r: [r.left, r.top, r.right, r.bottom], q: [q.left, q.top, q.right, q.bottom] };
    });
  };
  const open = await at(70, 11);
  expect(open, 'an open kiosk has somebody in it').not.toBeNull();
  // ⭐ the kiosk overflows the banana, not the other way round: the counter's edge cuts it off
  expect(open.clip, 'the counter clips it — that is what makes it half a banana').toContain('inset(');
  expect(open.z, 'and it is drawn in front of the kiosk it is standing in').toBeGreaterThan(open.kz);
  // it is INSIDE the kiosk's own box, not beside it
  expect(open.r[0], 'inside the kiosk, on the left').toBeGreaterThan(open.q[0]);
  expect(open.r[2], '…and on the right').toBeLessThan(open.q[2]);
  expect(open.r[1], '…and below its roof').toBeGreaterThan(open.q[1]);
  // ⚠️ NEVER `tw-atwork`: that class means the player is at work, and nobody works in the kiosk
  expect(await page.locator('.tw-atwork').count(), 'nobody is at work in the kiosk').toBe(0);

  expect(await at(70, 23), 'everybody goes home at night').toBeNull();
  expect(await at(8, 11), 'and an Abandoned town has its shutter down').toBeNull();
  expect(await at(45, 11), 'a Recovering one is open again — the kiosk is an EARLY step').not.toBeNull();
  expect(errs).toEqual([]);
});

// 🎡 THE WHEEL ON THE WHEEL OF PEEL'S COUNTER TURNS.
//
// Trym, 20 Sep 2026: "the wheel of peel on the town view can spin a little aswell, to add some life
// to it when walking around in the town." ⚠️ the CANVAS is painted once and never again — the turn is
// a CSS transform on the element (design library §21.4: transform and opacity only), so a wheel that
// spins costs the same as a wheel that does not.
test('the stall wheel is the card\'s own wheel, and it turns', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.waitForTimeout(500);

  const d = await page.evaluate(() => {
    const el = document.querySelector('.tw-decal');
    if (!el) return null;
    const p = window.__town.PROPS.wheel, r = el.getBoundingClientRect();
    const stall = [...document.querySelectorAll('img.tw-ov')].find((e) => e.src.endsWith('/' + window.__town.OVERLAYS.find((o) => o[6] === 'wheel')[0]));
    const q = stall.getBoundingClientRect();
    const c = getComputedStyle(el);
    return { w: r.width, stallW: q.width, inside: r.left > q.left - 2 && r.right < q.right + 2, anim: c.animationName, dur: c.animationDuration, hits: c.pointerEvents };
  });
  expect(d, 'the stall carries a decal').not.toBeNull();
  // ⭐ a bit more than double what it first shipped at (0.17 of the stall): big enough to tell the two
  // identical market stands apart from across the square
  expect(d.w / d.stallW, 'the wheel is about 38% of the stall').toBeGreaterThan(0.3);
  expect(d.w / d.stallW, '…and not so big it stops being a stall').toBeLessThan(0.5);
  expect(d.inside, 'it sits on the stall, not beside it').toBe(true);
  expect(d.anim, 'it turns').toBe('twSpin');
  expect(parseFloat(d.dur), '…slowly enough to be life rather than a distraction').toBeGreaterThanOrEqual(12);
  expect(d.hits, 'and it is scenery: the stall under it is what answers a tap').toBe('none');

  const a = await page.evaluate(() => getComputedStyle(document.querySelector('.tw-decal')).transform);
  await page.waitForTimeout(1500);
  const b = await page.evaluate(() => getComputedStyle(document.querySelector('.tw-decal')).transform);
  expect(b, 'and it really is moving').not.toBe(a);
});
