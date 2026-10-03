// 🌗🏖 THE BAY AT NIGHT, walked on a phone (3 Oct 2026, design library §56).
//
// Trym: "Continue with the beach. not sure streetlights are the best solution, if there exist torches, or just use more
// bonfires for the beach maybe that fits the beach better for some extra lightning - the wooden bay area with the stalls
// all to the right could probably have some lightposts / fitting streetlight a couple of places". What must hold:
//   · by day the bonfire ring burns as it always has, the new fire pits are logs and the deck's lamps are dark
//   · through the dusk the pits catch and the deck's lamps come on ONE BY ONE — they only ever come on
//   · at night: four fires on the sand, four lamps lighting the deck's planks and nothing on their heads, the hut's window,
//     the stalls, the bar and the claw machine aglow
//   · the keepers' words and a player's name stand above the night (world-marks.js)
//   · morning puts the pits out and the lamps off
// ⚠️ never a live room: workers.dev is aborted and the bay's socket is answered here, with one stand-in visitor.
import { test, expect } from '@playwright/test';

async function bay(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  await page.routeWebSocket(/workers\.dev/, (ws) => {
    ws.onMessage((m) => {
      let d; try { d = JSON.parse(String(m)); } catch (e) { return; }
      const o = { hat: 'none', glasses: 'none', extras: {} };
      if (d.t === 'hi') ws.send(JSON.stringify({ t: 'roster', you: 'me1', all: [{ id: 'p1', x: 48, y: 62, name: 'Kiwi', outfit: o }] }));
    });
  });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookie-consent-v1', 'n'); localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); localStorage.setItem('bw-social-v1', JSON.stringify({ g: { none: 1 } })); } catch (e) {}
  });
  await page.goto('/beach/?beachtest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bay && window.__bay.sky && window.__bay.sky(), null, { timeout: 30000 });   // the night's chunk has landed
  await page.evaluate(() => { window.__bay.wx('clear'); window.__bay.pos.x = 1330; window.__bay.pos.y = 700; window.__bay.tgt.x = 1330; window.__bay.tgt.y = 700; });
  await page.waitForTimeout(1500);
  return errs;
}
const at = async (page, h, wait = 700) => { await page.evaluate((x) => window.__bay.skyHour(x), h); await page.waitForTimeout(wait); };
const read = (page) => page.evaluate(() => {
  const B = window.__bay, L = B.lights(), lit = B.lit();
  const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.style.display !== 'none').length;
  return {
    sky: B.sky(), pits: lit.pits.filter(Boolean).length, lamps: lit.lamps.filter(Boolean).length,
    pitFlames: [...document.querySelectorAll('.bh-fire')].filter((e) => e.noCull && e.style.display !== 'none').length,   // the pits' own (the ring's is culled off screen)
    litLamps: shown('.bh-lamp'),
    fires: L.filter((l) => l.flicker === 'fire').length,
    pools: L.filter((l) => l.sq === 1.6 && l.c.join() === '255,168,84').length,
    heads: L.filter((l) => l.sq !== 1.6 && l.c.join() === '255,168,84').length,
    glows: L.filter((l) => l.c.join() === '255,176,86').length, claw: L.filter((l) => l.c.join() === '214,196,255').length,
  };
});

test('the bay at night: the pits catch and the deck lamps come on one by one, everything that shines shines', async ({ page }) => {
  test.setTimeout(150000);
  const errs = await bay(page);
  expect(await page.evaluate(() => [...document.querySelectorAll('.wn')].every((c) => c.parentElement && c.parentElement.id === 'bhView')), 'the night is on the view').toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll('.bh-lamp').length), 'four deck lamps, each with its lit frames').toBe(4);
  await at(page, 11);
  let r = await read(page);
  expect(r.sky.dark, 'noon: no night').toBe(0);
  expect(r.pits + r.pitFlames, 'by day the pits are logs: only the bonfire ring burns').toBe(0);
  expect(r.litLamps, 'and the deck lamps are dark').toBe(0);
  let was = 0;
  for (const h of [16.5, 16.6, 16.7, 16.8, 16.9, 17, 17.1, 17.2, 17.3]) {
    await at(page, h, 450);
    r = await read(page);
    const n = r.pits + r.lamps;
    expect(n, 'pits and lamps only ever come ON through the dusk (' + h + ')').toBeGreaterThanOrEqual(was);
    was = n;
  }
  expect(was, 'all three pits and four lamps by 17:20').toBe(7);
  await at(page, 22, 3000);
  r = await read(page);
  expect(r.sky.dark).toBe(1);
  expect(r.pitFlames, '⭐ the three pits burning').toBe(3);
  expect(r.fires, '…four fires on the sand with the ring').toBe(4);
  expect(r.pools, '⭐ every deck lamp lights the planks').toBe(4);
  expect(r.heads, '…and nothing on its head').toBe(0);
  expect(r.glows, 'the hut window and its spill, the four stalls, the bar').toBe(7);
  expect(r.claw, 'the claw machine').toBe(1);
  await page.screenshot({ path: 'test-results/beach-night-1.png' });
  // 🔤 a name stands above the night
  await page.waitForFunction(() => document.querySelector('.wm .bw-name'), null, { timeout: 10000 });
  expect(await page.evaluate(() => document.querySelector('.wm .bw-name').textContent)).toBe('Kiwi');
  expect(await page.evaluate(() => +getComputedStyle(document.querySelector('.wm')).zIndex > +getComputedStyle(document.querySelector('.wn--map')).zIndex), 'the words over the night').toBe(true);
  // 🌅 morning: the pits go out, the deck goes dark, the ring burns on
  await at(page, 5, 2500);
  r = await read(page);
  expect(r.sky.dark).toBe(0);
  expect(r.pitFlames, 'the pits out: the ring alone again').toBe(0);
  expect(r.litLamps).toBe(0);
  expect(errs, 'no page errors').toEqual([]);
});
