// 🌗🌳 THE PARK AT NIGHT, walked on a phone (3 Oct 2026, design library §56).
//
// Trym: "Start with the park, not sure the park have many light-sources by default for the nights? Might need to make
// some?" It had none. The generator put eight lamp posts back (the town's own post) and the park hangs the world's night on
// its view with its lights (park-night.js). What must hold:
//   · by day there is no night and no lamp lit; through the dusk the lamps come on ONE BY ONE, the plaza's first
//   · at night every lamp lights the GROUND and nothing else (Trym: "keep the one lighting up the ground and remove the one
//     on the lamp itself"); the stand's counter and the shop's glass glow
//   · the light lies still on the ground while the camera follows you (Trym: "the light on the ground should be completely
//     still")
//   · the park keeps the night: every land animal under its tree, the squirrels in; the morning lets them out
//   · the fireflies come out under a clear sky and never in heavy rain
//   · a name and an animal's emote stand ABOVE the night, with no light round them (Trym: "the nicknames can overflow the
//     dark, dont add light effect on it"), and go home to their owners by day
//   · an echo is never of a player who is here (Trym: "double player where one is an echo looks quite bad")
//   · inside a shop there is no night (one door with the rain), and the door back out brings it back
// ⚠️ never a live room: workers.dev is aborted and the park's socket and the echo list are answered here.
import { test, expect } from '@playwright/test';

async function park(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  await page.route('**/yards/echoes*', (r) => r.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ echoes: [{ slug: 'kiwi-farm', n: 'Kiwi', fit: { hat: 'cowboy' } }, { slug: 'plum-farm', n: 'Plum', fit: {} }] }) }));
  await page.routeWebSocket(/workers\.dev/, (ws) => {
    ws.onMessage((m) => {
      let d; try { d = JSON.parse(String(m)); } catch (e) { return; }
      const o = { hat: 'none', glasses: 'none', extras: {} };
      if (d.t === 'hi' && /\/park/.test(ws.url())) ws.send(JSON.stringify({ t: 'roster', you: 'me1', all: [{ id: 'p1', x: 51, y: 66, name: 'Kiwi', outfit: o }] }));
    });
  });
  await page.addInitScript(() => {
    try { localStorage.setItem('cookie-consent-v1', 'n'); localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); } catch (e) {}
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
    heads: L.filter((l) => l.sq !== 1.6 && l.c.join() === '255,168,84').length,   // a lamp's light that is not its pool
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
  expect(r.pools, '⭐ every lamp lights the ground').toBe(8);
  expect(r.heads, '⭐ …and nothing on the lamp itself').toBe(0);
  expect(await page.evaluate(() => { const c = document.createElement('canvas'), im = new Image(); return new Promise((res) => { im.onload = () => { c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let soft = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0 && d[i] < 255) soft++; res(soft); }; im.src = '/assets/park/n-lamp.png'; }); }),
    'the lit lamp has no soft halo round its head').toBe(0);
  expect(r.halos, 'the lit frames over the posts in view').toBeGreaterThan(0);
  expect(r.panes, 'the stand’s counter and the shop’s glass').toBe(2);
  expect(r.shelter, '⭐ every land animal under its tree').toBe(r.land);
  expect(r.squirrels, 'the squirrels are in').toBe(0);
  let flies = 0;
  for (let k = 0; k < 8; k++) { flies = Math.max(flies, (await read(page)).flies); await page.waitForTimeout(400); }
  expect(flies, '✨ the fireflies are out').toBeGreaterThan(2);
  await page.screenshot({ path: 'test-results/park-night-1.png' });
  // ⭐ THE LIGHT LIES STILL: one ground point in a plaza lamp's pool, read from the light map every frame while the camera
  // follows a walk — while it is on screen it must read the same every frame
  const still = await page.evaluate(async () => {
    const P = window.__park, at = { x: 1204, y: 700 };   // under the south-west lamp's lantern, on its pool
    P.warp(1300, 760);
    await new Promise((res) => setTimeout(res, 1500));
    const map = document.querySelector('.wn--map'), mc = map.getContext('2d'), world = document.getElementById('pkWorld');
    const seen = new Set();
    let moves = 0, lastT = '';
    P.tgt.x = 1560; P.tgt.y = 760;
    for (let f = 0; f < 80; f++) {
      await new Promise((res) => requestAnimationFrame(res));
      const wr = world.getBoundingClientRect(), k = wr.width / 2760, mr = map.getBoundingClientRect(), S = mr.width / map.width;
      const cx = Math.floor((wr.left + at.x * k - mr.left) / S), cy = Math.floor((wr.top + at.y * k - mr.top) / S);
      if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) continue;
      const d = mc.getImageData(cx, cy, 1, 1).data;
      seen.add(d[0] + ',' + d[1] + ',' + d[2]);
      if (world.style.transform !== lastT) { moves++; lastT = world.style.transform; }
    }
    return { moves, values: seen.size };
  });
  expect(still.moves, 'the camera moved').toBeGreaterThan(10);
  expect(still.values, '⭐ the light on the ground did not move with it').toBe(1);
  await page.evaluate(() => window.__park.warp(1380, 700));
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

test('the park at night: names and emotes stand above the dark, no echo of a player who is here, the shop’s door shuts the night out', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await park(page);
  await page.waitForFunction(() => document.querySelector('.pk-peer[data-pid] > .bw-name'), null, { timeout: 15000 });
  // 👥 the echoes come out on their own beat: Plum may stroll the park, Kiwi never — Kiwi is HERE
  await page.waitForTimeout(13000);
  const echoes = await page.evaluate(() => [...document.querySelectorAll('.bws-echo .bws-tag')].map((t) => t.textContent));
  expect(echoes, '⭐ no echo of a player who is in the park').not.toContain('Kiwi');
  // 🔤 by day a name is at home on its banana and the marks layer is down
  await at(page, 11);
  let w = await page.evaluate(() => ({ up: !document.querySelector('.wm').hidden, home: !!document.querySelector('#pkWorld .pk-peer > .bw-name') }));
  expect(w.up, 'by day the marks layer is down').toBe(false);
  expect(w.home, 'and the name is on its banana').toBe(true);
  // …at night it stands above the dark: in the marks layer over the night's canvases, unlit and unchanged
  await at(page, 22, 1500);
  await page.evaluate(() => window.__park.mood());
  await page.waitForTimeout(500);
  w = await page.evaluate(() => {
    const L = document.querySelector('.wm'), map = document.querySelector('.wn--map'), tag = document.querySelector('.wm .bw-name');
    return { up: !L.hidden, z: +getComputedStyle(L).zIndex, nightZ: +getComputedStyle(map).zIndex, name: tag && tag.textContent,
      chip: tag && getComputedStyle(tag).backgroundColor, inWorld: !!document.querySelector('#pkWorld .pk-peer > .bw-name'),
      bubbles: document.querySelectorAll('.wm .pk-mood.is-on').length };
  });
  expect(w.up, '⭐ at night the marks stand above the dark').toBe(true);
  expect(w.z, 'over the night').toBeGreaterThan(w.nightZ);
  expect(w.name).toBe('Kiwi');
  expect(w.inWorld, 'the name left the world for the night').toBe(false);
  expect(w.chip, 'no chip, no light: the name as it is by day').toBe('rgba(0, 0, 0, 0)');
  expect(w.bubbles, 'the animals’ hearts stand above the dark too').toBeGreaterThan(0);
  // 🏠 in the shop there is no sky, and the door back out brings the night back
  await page.evaluate(() => window.__park.shop());
  await page.waitForFunction(() => document.body.classList.contains('pk-inside'), null, { timeout: 10000 });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__park.sky().hidden), 'no night inside the shop').toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.wn--map')).display)).toBe('none');
  expect(await page.evaluate(() => document.querySelector('.wm').hidden), 'and the names are home').toBe(true);
  await page.click('.pk-shop__x');
  await page.waitForFunction(() => !document.body.classList.contains('pk-inside'), null, { timeout: 10000 });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.wn--map')).display), 'back out under the night').not.toBe('none');
  expect(errs, 'no page errors').toEqual([]);
});
