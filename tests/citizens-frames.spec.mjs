// 🏅 THE CITIZENS' FRAMES READ, AND WEAR WHAT THE WINNERS WEAR (29 Sep 2026). Trym, on the front page's frames: "the tiny
// name-badge-signs are a bit small and tight, they could be a bit more readable, and look visually a bit better. I think this
// also goes for the board in the Park … the titles like Farmer and Gardener … very small … not much space between title and
// name … also it doesnt look like their wearables are showing in the pictures of them … they are all clean bananas".
//
// The plate was baked into the picture at 15 px and read at 6 px on a 197-px frame. It is real text now, one brass plate
// (src/styles/citizen-plate.css) on both surfaces, sized off its frame. The bare bananas were the bake's renderer throwing on
// a wool scarf it had no art for (the whole outfit fell back); design library §49.
import { test, expect } from '@playwright/test';
import CIT from '../src/data/citizen.json' with { type: 'json' };
import { cleanName } from '../src/lib/player-name.js';

const TITLES = { citizen: 'Citizen of the week', gardener: 'Gardener', neighbour: 'Neighbour', farmer: 'Farmer', raver: 'Raver' };
const plates = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((p) => {
  const t = p.querySelector('small'), b = p.querySelector('b');
  return { title: t.textContent.trim(), tfs: parseFloat(getComputedStyle(t).fontSize), name: b.textContent.trim(), nfs: parseFloat(getComputedStyle(b).fontSize),
    cut: b.scrollWidth > b.clientWidth + 1 || t.scrollWidth > t.clientWidth + 1, gap: b.getBoundingClientRect().top - t.getBoundingClientRect().bottom };
}), sel);
const readable = (list, where) => {
  for (const p of list) {
    expect(p.tfs, where + ': "' + p.title + '" is read at 11.5 px or more').toBeGreaterThanOrEqual(11.5);
    expect(p.nfs, where + ': "' + p.name + '" is read at 11.5 px or more').toBeGreaterThanOrEqual(11.5);
    expect(p.cut, where + ': "' + p.name + '" is whole on its plate').toBe(false);
    expect(p.gap, where + ': air between "' + p.title + '" and the name').toBeGreaterThanOrEqual(2);
  }
};

for (const [w, h] of [[1280, 900], [393, 852]]) {
  test(`the front page's frames carry plates you can read (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
    await page.goto('/');
    await page.locator('.bwl-cit').scrollIntoViewIfNeeded();
    const list = await plates(page, '.bwl-cit .cit-plate');
    expect(list.map((p) => p.title), 'five plates, in order').toEqual(Object.values(TITLES));
    for (const [p, t] of Object.entries(TITLES)) {
      const won = CIT.winners && CIT.winners[p];
      expect(list.find((x) => x.title === t).name, t + ' names its winner').toBe(won ? cleanName(won.name) : '—');
    }
    readable(list, 'front page ' + w);
    const big = await page.evaluate(() => document.querySelector('.bwl-cit__frame--big').getBoundingClientRect().width);
    expect(big, '⚠️ the Citizen’s frame has its width (a size container between auto margins shrank to nothing)').toBeGreaterThan(200);
    expect(await page.evaluate(() => [...document.querySelectorAll('.bwl-cit img')].every((i) => i.getAttribute('alt') === '')), 'the picture is decoration: the plate says who').toBe(true);
    await page.screenshot({ path: `test-results/citizens-front-${w}.png`, clip: await page.evaluate(() => { const b = document.querySelector('.bwl-cit').getBoundingClientRect(); return { x: 0, y: b.top + scrollY - 20, width: innerWidth, height: b.height + 40 }; }), fullPage: true });
    expect(errs).toEqual([]);
  });
}

// the park's card reads the live board — here a fixed one: a long camel-cased name, a winner in a squid hat
const BOARD = {
  live: { week: '2026-W40', plaques: { gardener: [], neighbour: [], farmer: [], raver: [] }, citizen: [] },
  last: { week: '2026-W39', at: 1790653233216, unkept: {}, winners: {
    citizen: { name: 'KiwiRainbowRain', look: { hat: 'squidhat', glasses: 'none', extras: { woolscarf: true, balloondog: true, glowstick: true, bowtie: false } } },
    gardener: { name: 'Bananaman', look: { hat: 'djheadphones', glasses: 'shades', extras: { plushbanana: true } } },
    neighbour: { name: 'SirPeelsALotTheThird', look: { hat: 'none', glasses: 'none', extras: {} } },
    farmer: { name: 'Andoo', look: { hat: 'none', glasses: 'visor', extras: { daisypin: true, glowstick: true } } },
  } },
};
for (const [w, h] of [[393, 852], [1280, 900]]) {
  test(`the park's card wears the same plates, and the winners wear their things (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
    await page.route(/banana-pass\.trymstene\.workers\.dev\/citizen$/, (r) => r.fulfill({ json: BOARD, headers: { 'access-control-allow-origin': '*' } }));
    await page.addInitScript(() => { try { localStorage.setItem('tt-internal', '1'); } catch (e) {} });
    await page.goto('/park/?citizens');
    await page.waitForFunction(() => [...document.querySelectorAll('#pkCit .cit-plate b')].some((b) => b.textContent === 'Bananaman'), null, { timeout: 30000 });
    await page.waitForTimeout(1200);
    const list = await plates(page, '#pkCit .cit-plate');
    expect(list.map((p) => p.name), 'the board’s winners, and an empty frame says so').toEqual(['KiwiRainbowRain', 'Bananaman', 'SirPeelsALotTheThird', 'Andoo', '—']);
    readable(list.filter((p) => p.name !== '—'), 'park ' + w);
    // the Citizen's picture wears the squid hat: its lilac is on the canvas
    const lilac = await page.evaluate(() => {
      const cv = document.querySelector('#pkCit canvas[data-plaque="citizen"]'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - 0xc7) < 6 && Math.abs(d[i + 1] - 0x8b) < 6 && Math.abs(d[i + 2] - 0xe8) < 6) n++;
      return n;
    });
    expect(lilac, 'the winner is drawn in their squid hat, not as a bare banana').toBeGreaterThan(20);
    await page.screenshot({ path: `test-results/citizens-park-${w}.png` });
    expect(errs).toEqual([]);
  });
}
