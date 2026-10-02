// 🌗🌳 THE PARK AT NIGHT, walked on a phone (3 Oct 2026, design library §56).
//
// Trym: "Start with the park, not sure the park have many light-sources by default for the nights? Might need to make
// some?" It had none. The generator put eight lamp posts back (the town's own post) and the park hangs the world's night on
// its view with its lights (park-night.js). What must hold:
//   · by day there is no night and no lamp lit; through the dusk the lamps come on ONE BY ONE, the plaza's first
//   · at night every lamp is lit — its pool, its glass, its lit frames over the post — and the stand's counter and the
//     shop's glass glow
//   · the park keeps the night: every land animal under its tree, the squirrels in; the morning lets them out
//   · the fireflies come out under a clear sky and never in heavy rain
//   · what is written stays readable: a player's name takes its chip, a bubble its clear patch
//   · inside a shop there is no night (one door with the rain), and the door back out brings it back
// ⚠️ never a live room: workers.dev is aborted and the park's socket is answered here, with two stand-in visitors.
import { test, expect } from '@playwright/test';

async function park(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  await page.routeWebSocket(/workers\.dev/, (ws) => {
    ws.onMessage((m) => {
      let d; try { d = JSON.parse(String(m)); } catch (e) { return; }
      const o = { hat: 'none', glasses: 'none', extras: {} };
      if (d.t === 'hi' && /\/park/.test(ws.url())) ws.send(JSON.stringify({ t: 'roster', you: 'me1', all: [{ id: 'p1', x: 51, y: 66, name: 'Kiwi', outfit: o }] }));
    });
  });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookie-consent-v1', 'n'); localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); localStorage.setItem('bw-social-v1', JSON.stringify({ g: { none: 1 } })); } catch (e) {}
  });
  await page.goto('/park/?parktest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__park && window.__park.sky && window.__park.sky(), null, { timeout: 30000 });   // the night's chunk has landed
  await page.evaluate(() => { window.__park.wx('clear'); window.__park.warp(1380, 700); });
  await page.waitForTimeout(1500);
  return errs;
}
const at = async (page, h, wait = 700) => { await page.evaluate((x) => window.__park.skyHour(x), h); await page.waitForTimeout(wait); };
const read = (page) => page.evaluate(() => {
  const P = window.__park, L = P.lights();
  return {
    sky: P.sky(), lamps: P.lamps().filter(Boolean).length, first: P.lamps().indexOf(true),
    shown: getComputedStyle(document.querySelector('.wn--map')).display !== 'none',
    halos: [...document.querySelectorAll('.pk-lamp')].filter((e) => e.style.display !== 'none').length,
    pools: L.filter((l) => l.sq === 1.6 && l.c.join() === '255,168,84').length, panes: L.filter((l) => l.rect).length,
    flies: L.filter((l) => l.c.join() === '206,255,118').length,   // a firefly's green
    shelter: P.animals.filter((a) => !a.pond && a.shelter).length, land: P.animals.filter((a) => !a.pond).length, squirrels: P.squirrels.length,
  };
});

test('the park at night: the lamps come on one by one, the windows glow, the animals keep the night, the fireflies come out', async ({ page }) => {
  test.setTimeout(150000);
  const errs = await park(page);
  expect(await page.evaluate(() => [...document.querySelectorAll('.wn')].every((c) => c.parentElement && c.parentElement.id === 'pkView')), 'the night is on the view').toBe(true);
  expect(await page.evaluate(() => document.querySelectorAll('.pk-lamp').length), 'eight lamps, each with its lit frames').toBe(8);
  await at(page, 11);
  let r = await read(page);
  expect(r.sky.dark, 'noon: no night').toBe(0);
  expect(r.shown).toBe(false);
  expect(r.lamps + r.halos, 'and not a lamp lit').toBe(0);
  // ⭐ the dusk lights them one by one — they only ever come on, and the plaza's first
  let was = 0;
  for (const h of [16.5, 16.6, 16.7, 16.8, 16.9, 17, 17.1, 17.2, 17.3]) {
    await at(page, h, 450);
    r = await read(page);
    expect(r.lamps, 'lamps only ever come ON through the dusk (' + h + ')').toBeGreaterThanOrEqual(was);
    if (r.lamps) expect(r.first, 'the plaza lights first').toBe(0);
    was = r.lamps;
  }
  expect(was, 'all eight by 17:20').toBe(8);
  await at(page, 22, 3500);
  r = await read(page);
  expect(r.sky.dark).toBe(1);
  expect(r.shown, 'the night is drawn').toBe(true);
  expect(r.pools, '⭐ every lamp throws its pool').toBe(8);
  expect(r.halos, 'the lit frames over the posts in view').toBeGreaterThan(0);
  expect(r.panes, 'the stand’s counter and the shop’s glass').toBe(2);
  expect(r.shelter, '⭐ every land animal under its tree').toBe(r.land);
  expect(r.squirrels, 'the squirrels are in').toBe(0);
  let flies = 0;
  for (let k = 0; k < 8; k++) { flies = Math.max(flies, (await read(page)).flies); await page.waitForTimeout(400); }
  expect(flies, '✨ the fireflies are out').toBeGreaterThan(2);
  await page.screenshot({ path: 'test-results/park-night-1.png' });
  // 🌧 heavy rain: the lamps stay lit, the fireflies go in
  await page.evaluate(() => window.__park.wx('heavy'));
  await page.waitForTimeout(1500);
  r = await read(page);
  expect(r.lamps).toBe(8);
  expect(r.flies, 'no fireflies in heavy rain').toBe(0);
  await page.evaluate(() => window.__park.wx('clear'));
  // 🌅 morning: the night lifts and the animals come out from under their trees
  await at(page, 5, 2500);
  r = await read(page);
  expect(r.sky.dark).toBe(0);
  expect(r.lamps + r.halos, 'the lamps are out by day').toBe(0);
  expect(r.shelter, 'the animals are out again').toBe(0);
  expect(errs, 'no page errors').toEqual([]);
});

test('the park at night: names keep their chip, the shop’s door shuts the night out', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await park(page);
  await page.waitForFunction(() => document.querySelector('.pk-peer .bw-name'), null, { timeout: 15000 });
  await at(page, 11);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.pk-peer .bw-name')).backgroundColor), 'by day a name stands on the grass').toBe('rgba(0, 0, 0, 0)');
  await at(page, 22, 1500);
  const words = await page.evaluate(() => ({ dark: document.getElementById('pkView').classList.contains('wn-dark'), kept: window.__park.sky().kept,
    chip: getComputedStyle(document.querySelector('.pk-peer .bw-name')).backgroundColor }));
  expect(words.dark, 'the view knows it is dark').toBe(true);
  expect(words.chip, '🔤 at night a name takes its chip').not.toBe('rgba(0, 0, 0, 0)');
  expect(words.kept, 'and the name is kept clear of the night').toBeGreaterThan(0);
  // 🏠 in the shop there is no sky, and the door back out brings the night back
  await page.evaluate(() => window.__park.shop());
  await page.waitForFunction(() => document.body.classList.contains('pk-inside'), null, { timeout: 10000 });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__park.sky().hidden), 'no night inside the shop').toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.wn--map')).display)).toBe('none');
  await page.click('.pk-shop__x');
  await page.waitForFunction(() => !document.body.classList.contains('pk-inside'), null, { timeout: 10000 });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.wn--map')).display), 'back out under the night').not.toBe('none');
  expect(errs, 'no page errors').toEqual([]);
});
