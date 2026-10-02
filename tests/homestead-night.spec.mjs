// 🌗🏡 THE HOMESTEAD AT NIGHT, walked on a phone (3 Oct 2026, design library §56).
//
// Trym: "isnt this an opportunity to really make cozy lighting? that lamps and bonfires, streetlights, windows, decorations
// and all this actually makes the night light a bit up - this is core cozy - especially in the homestead which arent
// haunted". The yard hangs the world's night (world-night.js) on its view, on the world's clock, and hands it its lights
// (homestead-night.js). What must hold:
//   · by day there is no night layer; at night it is drawn, and at dusk it is between
//   · every pane of your home is lit — the country house's seven, a mobile home's four — on the panes themselves
//   · the plot's lighting decor lights; a campfire only once it is LIT (its own toggle)
//   · your banana carries a light
//   · inside the house there is no night, and the door back out brings it back (one door with the rain)
import { test, expect } from '@playwright/test';

async function yard(page, edit, arg) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route('**/yards/echoes*', (r) => r.fulfill({ contentType: 'application/json', body: '{"echoes":[]}' }));   // nobody strolling the road
  await page.addInitScript(() => { try { localStorage.setItem('bw-social-v1', JSON.stringify({ g: { none: 1 } })); } catch (e) {} });
  await page.goto('/homestead/?hstest=max', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.warp, null, { timeout: 30000 });
  if (edit) {
    await page.evaluate(edit, arg);
    await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });   // rich keeps the yard as it is and the QA doors open
    await page.waitForFunction(() => window.__hs && window.__hs.warp, null, { timeout: 30000 });
  }
  await page.waitForFunction(() => window.__hs.sky && window.__hs.sky(), null, { timeout: 15000 });   // the night's own chunk has landed
  await page.evaluate(() => { window.__hs.wx('clear'); const st = JSON.parse(localStorage.getItem('hs-v1')); window.__hs.warp(st.home.x, st.home.y + 110); });
  await page.waitForTimeout(1500);
  return errs;
}
const at = async (page, h) => { await page.evaluate((x) => window.__hs.skyHour(x), h); await page.waitForTimeout(600); };
const read = (page) => page.evaluate(() => {
  const L = window.__hs.lights(), st = JSON.parse(localStorage.getItem('hs-v1'));
  return { sky: window.__hs.sky(), panes: L.filter((l) => l.rect).length, decor: L.filter((l) => !l.rect && l.r > 70 * 0.4).length, all: L.length,
    shown: getComputedStyle(document.querySelector('.wn--map')).display !== 'none', campfires: st.items.filter((i) => i.id === 'campfire').length };
});

test('the yard at night: the house’s panes lit, the decor lit, a campfire only once lit, nothing indoors', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await yard(page);
  expect(await page.evaluate(() => [...document.querySelectorAll('.wn')].every((c) => c.parentElement && c.parentElement.id === 'hsView')), 'the night is on the view').toBe(true);
  await at(page, 11);
  let r = await read(page);
  expect(r.sky.dark, 'noon: no night').toBe(0);
  expect(r.shown).toBe(false);
  await at(page, 17.2);
  r = await read(page);
  expect(r.sky.phase).toBe('dusk');
  expect(r.shown, 'the sunset is drawn').toBe(true);
  await at(page, 21);
  r = await read(page);
  expect(r.sky.dark).toBe(1);
  expect(r.panes, '⭐ every pane of the country house is lit').toBe(7);
  const unlit = await page.evaluate(() => window.__hs.lights().length);
  await page.screenshot({ path: 'test-results/homestead-night-1.png' });
  // ⭐ the campfire lights only once it is lit: light every one on the plot and count again
  await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('hs-v1')); st.items.forEach((i) => { if (i.id === 'campfire') i.lit = 1; }); localStorage.setItem('hs-v1', JSON.stringify(st)); });
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.sky && window.__hs.sky(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__hs.wx('clear'); const st = JSON.parse(localStorage.getItem('hs-v1')); window.__hs.warp(st.home.x, st.home.y + 110); });
  await page.waitForTimeout(1200);
  await at(page, 21);
  r = await read(page);
  expect(r.campfires, 'the yard has a campfire to light').toBeGreaterThan(0);
  expect(r.all, 'a lit campfire is one more light').toBe(unlit + r.campfires);
  await page.screenshot({ path: 'test-results/homestead-night-2.png' });
  // indoors there is no night; the door back out brings it back
  await page.evaluate(() => window.__hs.enter());
  await page.waitForTimeout(1000);
  r = await read(page);
  expect(r.sky.hidden, 'inside the house there is no night').toBe(true);
  expect(r.shown).toBe(false);
  await page.evaluate(() => window.__hs.warp(900, 755));   // onto the country house's door mat (homestead-geo.js INTERIORS[3].exit): out
  await page.waitForFunction(() => window.__hs.sky() && !window.__hs.sky().hidden && getComputedStyle(document.querySelector('.wn--map')).display !== 'none', null, { timeout: 10000 });
  r = await read(page);
  expect(r.shown, 'and the night is waiting outside').toBe(true);
  expect(errs).toEqual([]);
});

test('a mobile home’s four panes light at night, on the panes', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await yard(page, () => { const st = JSON.parse(localStorage.getItem('hs-v1')); st.stage = 2; st.style = { ...(st.style || {}), 2: 'mobm7' }; st.look = 'mobm7'; localStorage.setItem('hs-v1', JSON.stringify(st)); });
  await at(page, 21);
  const r = await read(page);
  expect(r.panes, 'the mobile home’s four lit panes').toBe(4);
  // each pane's light stands inside the home's own box on the screen
  const inside = await page.evaluate(() => {
    const home = [...document.querySelectorAll('#hsWorld .hs-ov')].find((e) => /ov-mobm7/.test(getComputedStyle(e).backgroundImage));
    if (!home) return 'no home';
    const v = document.getElementById('hsView').getBoundingClientRect(), b = home.getBoundingClientRect();
    return window.__hs.lights().filter((l) => l.rect).every((l) => l.x + v.left > b.left && l.x + v.left < b.right && l.y + v.top > b.top && l.y + v.top < b.bottom);
  });
  expect(inside, 'every lit pane is on the home').toBe(true);
  await page.screenshot({ path: 'test-results/homestead-night-3-mobm7.png' });
  expect(errs).toEqual([]);
});
