// 📸 THE QA SWEEP — every state of the town, at a phone's width, FOR THE EYE.
//
// Not a gate: it asserts almost nothing. It walks the town into each of its states and takes a
// picture, because the standing rule in this repo is that a change is walked on the BUILT site and
// LOOKED AT before it is presented — and half the findings on 20 Sep were things no assertion would
// ever have caught (a queue piled into one banana, a toast landing on the barista's face, a green
// stub on an empty gauge). The pictures land in qa-shots/, which Playwright does not wipe.
//
// ⚠️ OPT-IN, so it does not add a minute and a half to every run:
//     QA_SHOTS=1 npx playwright test tests/town-qa-shots.spec.mjs
import { test, expect } from '@playwright/test';

test.skip(!process.env.QA_SHOTS, 'the sweep is for the eye: run it with QA_SHOTS=1');

// ⚠️ NOT test-results/: Playwright empties that directory on every run, and other agents are running
// the suite in parallel tonight — these are for the eye and have to survive that.
const SHOT = 'qa-shots/';
const errs = [];

async function town(page, opts = {}) {
  page.on('pageerror', (e) => errs.push(opts.name + ': ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(opts.name + ' [console] ' + m.text().slice(0, 120)); });
  if (opts.job) await page.addInitScript((j) => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); localStorage.setItem('tw-job-v1', JSON.stringify({ at: j, week: '', days: 0 })); } catch (e) {} }, opts.job);
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); });
  await page.evaluate((b) => window.__town.room.set(b), opts.band == null ? 85 : opts.band);
  await page.evaluate((h) => window.__town.life.set(h), opts.hour == null ? 12 : opts.hour);
  await page.waitForTimeout(900);
}

test('the square, day and night and a curse', async ({ page }) => {
  await town(page, { name: 'square' });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOT + '01-square-day.png' });

  await page.evaluate(() => window.__town.life.set(23));
  await page.waitForTimeout(2200);
  await page.screenshot({ path: SHOT + '02-square-night.png' });

  await page.evaluate(() => window.__town.room.nightReady());
  await page.evaluate(() => window.__town.room.curse('deep'));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOT + '03-curse-night.png' });
  expect(true).toBe(true);
});

test('a low town, and the board', async ({ page }) => {
  await town(page, { name: 'low', band: 15 });
  await page.screenshot({ path: SHOT + '04-town-abandoned.png' });
  await page.evaluate(() => window.__town.room.cards.health && window.__town.room.cards.health());   // 📌 the Square Report is under the meter now
  await page.waitForTimeout(900);
  await page.screenshot({ path: SHOT + '05-board-card.png' });
  await page.evaluate(() => { const x = document.getElementById('twCardX'); if (x) x.click(); });
  // the health bar's own card
  await page.evaluate(() => { const b = document.querySelector('.tw-hbar'); if (b) b.click(); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOT + '06-health-card.png' });
  expect(true).toBe(true);
});

test('the store, the chore, and a boss', async ({ page }) => {
  await town(page, { name: 'store', band: 55, job: 'store' });
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: SHOT + '07-store-inside.png' });
  await page.evaluate(() => window.__town.room.open('till'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOT + '08-store-till-card.png' });
  await page.evaluate(() => { const x = document.getElementById('twCardX'); if (x) x.click(); });
  await page.evaluate(() => window.__town.rooms.exit());
  await page.waitForTimeout(500);

  // a boss's card, with the job question on it
  // ⚠️ a REAL tap on the resident's own element, the way the town walk does it, and
  // :not(.tw-visitor) because the square is full of nameless bananas now
  const at = await page.evaluate(() => { const n = window.__town.life.residents().find((r) => r.key === 'pip'); return n ? { x: n.x, y: n.y } : null; });
  if (at) {
    await page.evaluate((p) => { const t = window.__town; t.pos.x = t.tgt.x = p.x + 46; t.pos.y = t.tgt.y = p.y + 16; }, at);
    await page.waitForTimeout(600);
    const hit = await page.evaluate(() => {
      let best = null, d = 1e9;
      // ⚠️ nearest to the PLAYER, not to the view's centre. Tapping a resident WALKS you to them and
      // the card opens on arrival, so picking the one across the square just sets off a long walk.
      const me = document.querySelector('.tw-me').getBoundingClientRect();
      for (const el of document.querySelectorAll('.tw-npc:not(.tw-visitor)')) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const k = Math.hypot(r.left + r.width / 2 - (me.left + me.width / 2), r.top + r.height - (me.top + me.height));
        if (k < d) { d = k; best = { x: r.left + r.width / 2, y: r.top + r.height - 14 }; }
      }
      return best;
    });
    if (hit) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(2000); }
    await page.screenshot({ path: SHOT + '09-boss-card.png' });
  }
  expect(true).toBe(true);
});

test('the cafe shift, the queue, the tray and the receipt', async ({ page }) => {
  await town(page, { name: 'cafe', band: 85, job: 'cafe' });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 5000 });
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(600); }
  await page.evaluate(() => window.__town.room.cafe().arrive());
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__town.room.cafe().serve());
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + '10-cafe-shift.png' });

  // at night, which is the whole argument for the tray
  await page.evaluate(() => window.__town.life.set(23));
  await page.waitForTimeout(2200);
  await page.screenshot({ path: SHOT + '11-cafe-night.png' });

  await page.evaluate(() => window.__town.room.cafe().clockOut());
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOT + '12-cafe-receipt.png' });
  expect(true).toBe(true);
});

test('360 wide: the narrowest phone the house supports', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await town(page, { name: '360', band: 85, job: 'cafe' });
  await page.screenshot({ path: SHOT + '13-360-square.png' });
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: SHOT + '14-360-tray.png' });
  // ⚠️ nothing may scroll sideways on a phone
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(over, 'nothing overflows sideways at 360').toBe(false);
  console.log('QA ERRORS ' + JSON.stringify(errs));
});

// 📸 the states the 20 Sep fixes created, walked as a player and looked at
test('the counter mark, a real cup, and the receipt that names it', async ({ page }) => {
  await town(page, { name: 'mark', band: 85, job: 'cafe' });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 5000 });
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(500); }
  await page.evaluate(() => window.__town.room.cafe().arrive());
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOT + '15-queue-on-the-pavement.png' });

  // ── a real cup, thumbed at the exact instant the way the walk does
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
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT + '16-cup-made.png' });

  // ── two body-lengths down the lane: the tray folds and the banana walks again
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2 - 230; t.pos.y = t.tgt.y = p.base + 60; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOT + '17-off-the-mark.png' });

  // ── and the receipt: the take, the work XP, and nothing lingering under it
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOT + '18-receipt-with-a-take.png' });
  expect(true).toBe(true);
});

test('a stranger taps the Coffee Cup, and a shut front says why', async ({ page }) => {
  await town(page, { name: 'front', band: 85 });
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: SHOT + '19-front-to-a-stranger.png' });

  await page.evaluate(() => window.__town.room.shutShop('store', true));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = window.__town.PROPS.store, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.evaluate(() => window.__town.room.open('store'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOT + '20-shut-store-says-why.png' });
  expect(true).toBe(true);
});

test('night: the visitors go home', async ({ page }) => {
  await town(page, { name: 'night', band: 85 });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.waitForTimeout(1200);
  const day = await page.evaluate(() => window.__town.room.folk().count());
  await page.evaluate(() => window.__town.life.set(23));
  // ⚠️ they WALK out, at 96 world px a second: a gate is a long way off and three seconds is not it
  await page.waitForTimeout(18000);
  const night = await page.evaluate(() => window.__town.room.folk().count());
  console.log(`QA visitors: ${day} by day, ${night} still walking home 18s after the lamps came on`);
  await page.screenshot({ path: SHOT + '21-night-empties.png' });
  expect(true).toBe(true);
});

// 📸 Trym's 20 Sep notes, walked: the cup that leaves with them, the body as patience, Bean off the
// window, and the three stations dressed.
test('the counter after the notes: the cup, the body, the stations', async ({ page }) => {
  await town(page, { name: 'notes', band: 85, job: 'cafe' });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 5000 });
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(500); }
  await page.evaluate(() => window.__town.room.cafe().arrive());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOT + '22-bean-off-the-window.png' });

  // ── the three stations, each caught mid-gesture
  for (const st of ['grind', 'pour', 'milk']) {
    await page.evaluate(async (want) => {
      const c = window.__town.room.cafe(), g = c.gest();
      if (!c.cup()) c.serve();
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let n = 0; n < 8 && c.cup() && g.station() !== want; n++) {
        const key = g.station();
        const t = g.best(performance.now());
        await wait(Math.max(0, t - performance.now()));
        if (key === 'pour') { g.press(performance.now()); await wait(30); g.release(g.best(performance.now())); }
        else g.press(g.best(performance.now()));
        await wait(20);
      }
      if (want === 'pour') g.press(performance.now());   // the stream only falls while the thumb is down
    }, st);
    await page.waitForTimeout(st === 'pour' ? 420 : 300);
    await page.screenshot({ path: SHOT + '23-station-' + st + '.png', clip: await page.evaluate(() => { const b = document.querySelector('.tw-cup').getBoundingClientRect(); return { x: Math.max(0, b.x - 4), y: Math.max(0, b.y - 4), width: b.width + 8, height: b.height + 8 }; }) });
  }

  // ── patience as the body, at the last rung
  await page.evaluate(() => window.__town.room.cafe().rung(2));
  await page.waitForTimeout(900);
  await page.screenshot({ path: SHOT + '24-patience-is-the-body.png' });

  // ── a cup made, and the customer walking off with it
  await page.evaluate(async () => {
    const c = window.__town.room.cafe(), g = c.gest();
    if (!c.cup()) c.serve();
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
  await page.waitForTimeout(1200);
  const held = await page.evaluate(() => (window.__town.room.folk().folk() || []).filter((v) => (v.held || []).includes('mug')).length);
  console.log('QA mugs in hand after one served cup: ' + held);
  await page.screenshot({ path: SHOT + '25-leaving-with-the-cup.png' });
  expect(true).toBe(true);
});

// 📸 the Thriving town's décor at night — the lanterns that stand by the stalls. They were sliced at the
// wrong cell width, so two of six frames held no lantern at all and the rest jumped half a cell: what was
// on screen half the time was a bare yellow ground-glow, which is the town's reserved "there is something
// to do here" colour. (Trym, 20 Sep: "the lantern that shows up as a pickup / cleaning-thing — not sure
// why its there, has a sprite thats glitchy.")
test('the lanterns by the stalls, at night', async ({ page }) => {
  await town(page, { name: 'decor', band: 95, hour: 23 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 800; t.pos.y = t.tgt.y = 780; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SHOT + '26-lanterns-at-night.png' });
  // ⚠️ clipped around the sprite ITSELF, measured: the whole point is whether it stays put
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.tw-state')].filter((e) => !e.hidden && /s-lantern/.test(getComputedStyle(e).backgroundImage + (e.src || '') + e.outerHTML));
    if (!els.length) return null;
    const r = els[0].getBoundingClientRect();
    return { x: Math.max(0, r.x - 40), y: Math.max(0, r.y - 30), width: r.width + 80, height: r.height + 60 };
  });
  console.log('QA lantern box: ' + JSON.stringify(box));
  // four frames, a quarter-second apart: a sprite sliced right does not jump or vanish
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(260); await page.screenshot({ path: SHOT + '27-lantern-frame-' + i + '.png', clip: box || { x: 60, y: 180, width: 260, height: 220 } }); }
  expect(true).toBe(true);
});

// 📸 👕 THE CLOTHES SHOP — the building, and the dressing room behind it.
test('the clothes shop and its dressing room', async ({ page }) => {
  await town(page, { name: 'dress', band: 85 });
  // ── the building, on the corner where the worksite hoarding stood
  await page.evaluate(() => { const t = window.__town, p = t.PROPS.clothes; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 60; });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: SHOT + '28-clothes-shop.png' });

  // ── the card
  await page.evaluate(() => window.__town.room && null);
  await page.evaluate(() => { const p = window.__town.PROPS.clothes, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.evaluate(() => window.__town.open('clothes'));
  await page.waitForFunction(() => !!document.querySelector('.tw-dress__stage canvas'), null, { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: SHOT + '29-dressing-room.png' });
  const card = await page.evaluate(() => { const c = document.querySelector('.tw-card').getBoundingClientRect(); return { x: c.x, y: c.y, width: c.width, height: c.height }; });
  await page.screenshot({ path: SHOT + '30-dressing-room-card.png', clip: card });

  // ── put a hat on and watch the mirror change
  await page.evaluate(() => { const b = [...document.querySelectorAll('.tw-dress__chip[data-sl="hat"]')].filter((x) => !x.classList.contains('is-locked'))[3]; if (b) b.click(); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOT + '31-dressed-card.png', clip: card });
  const worn = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bb-last') || '{}'); } catch (e) { return null; } });
  console.log('QA dressing room saved: ' + JSON.stringify(worn));
  expect(true).toBe(true);
});

test('the dressing room at 360 wide', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await town(page, { name: 'dress360', band: 85 });
  await page.evaluate(() => { const p = window.__town.PROPS.clothes, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.evaluate(() => window.__town.open('clothes'));
  await page.waitForFunction(() => !!document.querySelector('.tw-dress__stage canvas'), null, { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: SHOT + '32-dressing-room-360.png' });
  const m = await page.evaluate(() => {
    const c = document.querySelector('.tw-card'), b = document.getElementById('twCardBody');
    const st = document.querySelector('.tw-dress__stage'), rails = document.querySelector('.tw-dress__rails');
    const r = (e) => { const x = e.getBoundingClientRect(); return { w: Math.round(x.width), h: Math.round(x.height), top: Math.round(x.top), bot: Math.round(x.bottom) }; };
    return { card: r(c), body: r(b), stage: r(st), rails: r(rails), overflowX: b.scrollWidth - b.clientWidth, cardScroll: c.scrollHeight - c.clientHeight };
  });
  console.log('QA dress 360: ' + JSON.stringify(m));
  expect(true).toBe(true);
});

// 📸 ✉️ the mailbox: the stack, an open letter, and the sheet you write back on
test('the post office mailbox', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => { try { localStorage.setItem('hs-v1', JSON.stringify({ slug: 'ada-yard', claimedAt: Date.now() })); } catch (e) {} });
  await town(page, { name: 'post', band: 85 });
  await page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.evaluate(() => window.__town.open('post'));
  await page.waitForFunction(() => !!document.querySelector('.tw-post'), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + '33-mailbox-closed.png' });

  await page.evaluate(() => window.__town.post().set({ letters: [
    { id: 'a1', from: 'pip-yard', at: Date.now(), read: false, text: 'Your sunflowers are enormous this year. Mine came to nothing again, as usual.' },
    { id: 'a4', from: 'dot-yard', at: Date.now() - 1e4, read: false, text: 'The info point lost its map again. Nobody knows where anything is.' },
    { id: 'a2', from: 'moss-yard', at: Date.now() - 9e5, read: true, text: 'Thanks for the eggs. The hens send nothing back, but they never do.' },
    { id: 'a3', from: 'stamp-yard', at: Date.now() - 2e6, read: true, text: 'The scale is stuck at four again. It has opinions.' },
  ], unread: 2 }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOT + '34-mailbox-stack.png' });

  await page.evaluate(() => window.__town.post().tap('.tw-post__env'));
  await page.waitForTimeout(140);
  await page.screenshot({ path: SHOT + '35-letter-opening.png' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + '35b-letter-open.png' });

  await page.evaluate(() => window.__town.post().tap('#twPostReply'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__town.post().type('They only look like that because the fountain leaks all over that corner.'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: SHOT + '36-writing-back.png' });
  expect(true).toBe(true);
});
