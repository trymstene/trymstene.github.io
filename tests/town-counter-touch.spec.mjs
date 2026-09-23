// 📱 THE COUNTER ON A PHONE — the walk (23 Sep 2026).
//
// Trym, 23 Sep: the lemonade and coffee counters "struggled to work properly on my iphone (iOS Safari) … the visual
// indicators for hitting the correct moment … wasnt visible, and the action button … didnt work all the time. It
// looks like its working on PC / desktop with Chrome browser."
//
// Every counter walk before this one pressed with a MOUSE, so the phone's own gesture had never been walked. This
// walks it with a finger: real touch events through the browser, a thumb that wobbles while it holds, a second
// finger that lands and lifts mid-pour, and a phone too busy to run the handler on time. Then it opens the counter
// in WebKit — the engine inside every browser on an iPhone — at two iPhone sizes, and reads the gauge's own pixels.
//
// ⚠️ WebKit here is the desktop build, not iOS. It proves the engine paints the band and hears a finger; it cannot
// prove that UIKit's long-press and double-tap recognisers keep out of a hold. That half is a contract, and the
// first test reads it straight out of the stylesheet and the page.
import { test, expect, webkit, devices } from '@playwright/test';

const SHOT = 'test-results/counter-touch-';

async function bench(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));   // an area can look alive and be dead
  await page.goto('/dev/cafe/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__cafe && window.__cafe.counter, null, { timeout: 30000 });
  await page.waitForTimeout(400);
  return errors;
}
// ⚠️ on the bench the tray sits under a phone's fold: a touch off the screen lands on <html>, so bring it up first
const center = async (page, sel) => { const l = page.locator(sel); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(100); const b = await l.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

test.describe('with a finger', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 664 } });

  test('the tray is a control a phone leaves alone: no selection, no callout, no filter on the gauge', async ({ page }) => {
    const errors = await bench(page);
    // ── the contract, from the file: Chrome drops -webkit-touch-callout from the CSSOM, so it is read as text
    const css = await page.evaluate(() => fetch('/css/town-cafe.css').then((r) => r.text()));
    const tray = (css.match(/\n\.tw-cup \{[^}]*\}/) || [''])[0];
    for (const rule of ['touch-action: none', '-webkit-user-select: none', 'user-select: none', '-webkit-touch-callout: none']) {
      expect(tray, `📱 .tw-cup keeps "${rule}" — without it iOS turns a held pour into a text selection and cancels it`).toContain(rule);
    }
    const zone = (css.match(/\n\.tw-cup__zone \{[^}]*\}/) || [''])[0];
    expect(zone, 'the band the player aims at is drawn').toContain('background');
    expect(zone, '⚠️ never a filter on the band: Safari paints drop-shadow() unreliably').not.toMatch(/filter\s*:/);

    // ── the page: nothing the gauge draws goes through a filter, at any of the three stations
    await page.evaluate(() => window.__cafe.serve());
    const seen = [];
    for (let k = 0; k < 3; k++) {
      const st = await page.evaluate(() => window.__cafe.counter.seam.station());
      const f = await page.evaluate(() => {
        const out = {};
        for (const sel of ['.tw-cup__bar', '.tw-cup__zone', '.tw-cup__fill', '.tw-cup__needle', '.tw-cup__tap']) out[sel] = getComputedStyle(document.querySelector(sel)).filter;
        const bar = document.querySelector('.tw-cup__bar');
        out['::before'] = getComputedStyle(bar, '::before').filter;
        out['::after'] = getComputedStyle(bar, '::after').filter;
        return out;
      });
      for (const [sel, v] of Object.entries(f)) expect(v, `${st}: ${sel} is painted without a filter`).toBe('none');
      seen.push(st);
      // move on a station the way the walk always has: the solved instant, through the seam
      await page.evaluate(async () => {
        const sm = window.__cafe.counter.seam;
        if (sm.station() === 'pour') { sm.press(performance.now()); await new Promise((r) => setTimeout(r, 30)); sm.release(sm.best(performance.now())); }
        else { for (let i = 0; i < 3 && sm.station() && sm.station() !== 'pour'; i++) { const key = sm.station(); sm.press(sm.best(performance.now())); if (sm.station() !== key) break; } }
      });
    }
    expect(seen, 'all three stations were looked at').toEqual(['grind', 'pour', 'milk']);

    // ── and a touch that starts on the button is the counter's: its touchstart is cancelled, so Safari's own
    // long-press, selection and double-tap recognisers never get the touch
    await page.evaluate(() => window.__cafe.serve());
    await page.evaluate(() => { window.__ts = null; window.addEventListener('touchstart', (e) => { window.__ts = e.defaultPrevented; }); });
    const c = await center(page, '.tw-cup__go');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 0 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await page.evaluate(() => window.__ts), 'the touchstart on the button was cancelled').toBe(true);
    expect(errors).toEqual([]);
  });

  test('a thumb holds the pour through a wobble and a second finger, and it lands where it lets go', async ({ page }) => {
    const errors = await bench(page);
    // only the thumb's own cancels count: the other finger lands on the square, which may pan
    await page.evaluate(() => { window.__cancels = 0; window.addEventListener('pointercancel', (e) => { if (e.target.closest && e.target.closest('.tw-cup')) window.__cancels++; }, true); });
    await page.evaluate(() => window.__cafe.serve());
    await page.evaluate(() => { const sm = window.__cafe.counter.seam; sm.press(performance.now()); });   // the grinder, however it falls
    expect(await page.evaluate(() => window.__cafe.counter.seam.station()), 'the cup is at the pour').toBe('pour');

    const c = await center(page, '.tw-cup__go');
    const cdp = await page.context().newCDPSession(page);
    const thumb = (dx = 0, dy = 0) => ({ x: c.x + dx, y: c.y + dy, id: 0, radiusX: 11, radiusY: 11, force: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb()] });
    expect(await page.evaluate(() => !!window.__cafe.counter.cup().held), 'a finger on the button starts the pour').toBe(true);
    const until = await page.evaluate(() => { const sm = window.__cafe.counter.seam; return sm.best(performance.now()) - performance.now(); });

    // a thumb on glass is never still: small moves the whole way up
    const t0 = Date.now();
    let k = 0;
    while (Date.now() - t0 < 300) { k++; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [thumb(k % 2 ? 2 : -1, k % 3 ? -2 : 1)] }); await wait(40); }
    // …and the other hand touches the screen, well away from the counter, and lifts again
    const other = { x: c.x - 120, y: c.y - 200, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [thumb(), other] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [thumb(), { ...other, x: other.x + 40 }] });
    // ⚠️ the protocol lifts the fingers a touchEnd NAMES (an empty list lifts them all), so this lifts the other hand
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ ...other, x: other.x + 40 }] });
    const mid = await page.evaluate(() => ({ st: window.__cafe.counter.seam.station(), held: !!(window.__cafe.counter.cup() && window.__cafe.counter.cup().held) }));
    expect(mid.st, 'the other finger lifting did not end the pour').toBe('pour');
    expect(mid.held, 'the pour is still running under the thumb').toBe(true);

    // let go in the band
    await wait(until - (Date.now() - t0));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => ({ st: window.__cafe.counter.seam.station(), marks: window.__cafe.counter.cup() ? window.__cafe.counter.cup().marks.slice() : null, cancels: window.__cancels }));
    expect(after.st, 'the pour landed when the thumb let go').toBe('milk');
    expect(after.marks[1], 'and it landed in the band').toBeGreaterThanOrEqual(1);
    expect(after.cancels, 'nothing cancelled the touch').toBe(0);
    expect(errors).toEqual([]);
  });

  test('a thumb on a busy phone is judged where it landed, not when the phone got round to it', async ({ page }) => {
    const errors = await bench(page);
    await page.evaluate(() => window.__cafe.serve());
    expect(await page.evaluate(() => window.__cafe.counter.seam.station())).toBe('grind');
    await page.waitForTimeout(300);   // the station's clock has started
    const c = await center(page, '.tw-cup__go');
    const cdp = await page.context().newCDPSession(page);
    // the perfect instant on the grinder's needle, and a main thread made busy across it: the finger lands on
    // time, the handler runs ~120 ms late — which is exactly what a loaded phone does to a tap
    const until = await page.evaluate(() => {
      const sm = window.__cafe.counter.seam, now = performance.now();
      let t = sm.best(now);
      if (t - now < 250) t = sm.best(t + 1);   // leave the walk time to get there
      const lead = t - now;
      setTimeout(() => { const s = performance.now(); while (performance.now() - s < 180) { /* a phone busy drawing the town */ } }, lead - 60);
      return lead;
    });
    const sent = Date.now();
    await wait(until - 8);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 0 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    void sent;
    await page.waitForTimeout(150);
    const got = await page.evaluate(() => ({ st: window.__cafe.counter.seam.station(), marks: window.__cafe.counter.cup() ? window.__cafe.counter.cup().marks.slice() : null }));
    expect(got.st, 'the tap landed').toBe('pour');
    expect(got.marks[0], 'judged at the thumb’s own instant: a PERFECT grind, though the page was busy when it arrived').toBe(2);
    expect(errors).toEqual([]);
  });
});

// ⭐ THE IPHONE'S ENGINE. Launched by hand so the rest of the suite stays on Chromium; CI installs it (walk.yml).
test('in WebKit at two iPhone sizes, the gauge paints its band and needle, and a finger’s tap is heard', async ({ baseURL }) => {
  test.setTimeout(90000);
  const browser = await webkit.launch();
  try {
    for (const name of ['iPhone 13', 'iPhone SE']) {
      const ctx = await browser.newContext({ ...devices[name], baseURL });
      const page = await ctx.newPage();
      const errors = await bench(page);
      await page.evaluate(() => window.__cafe.serve());
      await page.waitForTimeout(500);
      await page.locator('.tw-cup__bar').scrollIntoViewIfNeeded();
      // ── read the gauge's own pixels, the way an eye would. The needle is stopped where it stands (the tray's
      // frame loop is paused) and the judder and the band's pulse are held, so the picture and the geometry agree
      // and the band is at its full strength.
      await page.evaluate(() => {
        window.__raf = window.requestAnimationFrame;
        window.requestAnimationFrame = () => 0;
        for (const s of ['.tw-cup__needle', '.tw-cup__zone']) document.querySelector(s).style.animation = 'none';
      });
      await page.waitForTimeout(150);
      const geo = await page.evaluate(() => {
        const bar = document.querySelector('.tw-cup__bar').getBoundingClientRect();
        const z = document.querySelector('.tw-cup__zone').getBoundingClientRect();
        const n = document.querySelector('.tw-cup__needle').getBoundingClientRect();
        return { bar: { x: bar.x, w: bar.width, h: bar.height }, zone: { x: z.x - bar.x, w: z.width }, needle: { x: n.x - bar.x, w: n.width } };
      });
      expect(geo.zone.w, `${name}: the band has a width`).toBeGreaterThan(20);
      expect(geo.needle.w, `${name}: the needle has a width`).toBeGreaterThan(3);
      const shot = await page.locator('.tw-cup__bar').screenshot({ path: `${SHOT}${name.replace(/\s+/g, '-')}.png` });
      await page.evaluate(() => { window.requestAnimationFrame = window.__raf; });
      const px = await page.evaluate(async ({ b64, geo }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        const g = cv.getContext('2d');
        g.drawImage(img, 0, 0);
        const k = img.naturalWidth / geo.bar.w;   // device pixels per CSS pixel
        // the middle of the bar's height, between two x's: how much greener than red it is, and how much of it is yellow
        const col = (x0, x1) => {
          let gr = 0, yellow = 0, all = 0;
          const d = g.getImageData(Math.round(x0 * k), Math.round(cv.height * 0.3), Math.max(1, Math.round((x1 - x0) * k)), Math.round(cv.height * 0.4)).data;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], gg = d[i + 1], b = d[i + 2];
            all++; gr += gg - r;
            if (r > 200 && gg > 170 && b < 130) yellow++;
          }
          return { gr: gr / all, yellow: yellow / all };
        };
        const widest = (spans) => spans.filter(([a, b]) => b - a > 6).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
        const nx0 = geo.needle.x - 4, nx1 = geo.needle.x + geo.needle.w + 4;
        // inside the band, clear of the needle; and the bar outside it, clear of the band's glow and the needle
        const zx0 = geo.zone.x + 3, zx1 = geo.zone.x + geo.zone.w - 3;
        const inside = widest([[zx0, Math.min(zx1, nx0)], [Math.max(zx0, nx1), zx1]]);
        const outs = [[6, geo.zone.x - 10], [geo.zone.x + geo.zone.w + 10, geo.bar.w - 6]].flatMap(([a, b]) => [[a, Math.min(b, nx0)], [Math.max(a, nx1), b]]);
        const outside = widest(outs);
        return {
          band: inside ? col(...inside).gr : -999,
          bar: outside ? col(...outside).gr : 0,
          needle: col(geo.needle.x + 1.5, geo.needle.x + geo.needle.w - 1.5).yellow,
        };
      }, { b64: shot.toString('base64'), geo });
      console.log(`[counter-touch] ${name}: band g-r ${px.band.toFixed(1)}, bar g-r ${px.bar.toFixed(1)}, needle yellow ${(px.needle * 100).toFixed(0)}%`);
      expect(px.band - px.bar, `${name}: the band is PAINTED green against the bar, not just laid out`).toBeGreaterThan(15);
      expect(px.needle, `${name}: the needle is painted yellow`).toBeGreaterThan(0.3);

      // ── and a finger's tap on the button is heard: the grinder lands and the cup moves to the pour
      const c = await center(page, '.tw-cup__go');
      await page.touchscreen.tap(c.x, c.y);
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => window.__cafe.counter.seam.station()), `${name}: a tap moved the cup on`).toBe('pour');
      expect(errors, `${name}: no page errors`).toEqual([]);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
});
