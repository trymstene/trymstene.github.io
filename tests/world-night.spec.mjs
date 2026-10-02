// 🌗 THE WORLD'S NIGHT, walked in the town on a phone (2 Oct 2026, design library §56).
//
// Trym: "maybe nights and weather is something that should be on the world layer - except for 'inside' areas" … "isnt
// this an opportunity to really make cozy lighting? that lamps and bonfires, streetlights, windows … actually makes the
// night light a bit up" … "i think night should be longer … a minute or two longer". The sky is skyAt() in src/lib/world.js
// (the sun sets 16→18, night 18→2, it rises 2→4); src/scripts/world-night.js draws it on the view as a light map, and the
// town hands it its lamps, windows, ghosts and bananas. What must hold:
//   · by day there is no night layer at all; in the sunset it darkens and the lamps come on ONE BY ONE; at night it is dark
//     and every working lamp is lit — and a dead lamp gives no light
//   · the night is long: dark at 19 before the ghosts and at 1 after them, lighter again in the sunrise
//   · the nightfall clock counts to nightfall by day and to the morning by night
//   · inside a room there is no night, and stepping out brings it back (one door, shared with the rain)
//   · a Curse Night's sky is never lighter than the clock's, and wears its own colour
import { test, expect } from '@playwright/test';

const AT = [318, 652];   // by the clothes shop's lamp on the square's west side: a lamp and two windows in a phone's view

async function open(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.life && window.__town.sky && window.__town.sky(), null, { timeout: 30000 });   // the night's own chunk has landed
  // a forced calm (the real sky may be holding a Curse Night) and no rain to read through
  await page.evaluate(([x, y]) => { const t = window.__town; t.room.curse('none'); if (t.wx) t.wx('clear'); t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, AT);
  return errs;
}
const at = async (page, h, ms = 1800) => { await page.evaluate((x) => window.__town.life.set(x), h); await page.waitForTimeout(ms); };
const read = (page) => page.evaluate(() => {
  const t = window.__town, lamps = t.room.lamps(), lights = t.room.lights();
  const clock = (document.querySelector('.tw-clock b') || {}).textContent || '';
  const [m, s] = clock.split(':').map(Number);
  return { sky: t.sky(), lit: lights.filter((l) => l.kind === 'lamp').length, working: Object.values(lamps).filter((v) => v !== 'out').length,
    out: Object.entries(lamps).filter(([, v]) => v === 'out').map(([k]) => k), kinds: [...new Set(lights.map((l) => l.kind))], clockS: m * 60 + s,
    shown: getComputedStyle(document.querySelector('.wn--map')).display !== 'none' };
});

test('the town’s night: a long, lit dark between a sunset and a sunrise, the lamps coming on one by one', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await open(page);
  // the layer hangs on the VIEW, never the panning world (§19's rule, §56)
  expect(await page.evaluate(() => [...document.querySelectorAll('.wn')].every((c) => c.parentElement && c.parentElement.id === 'twView')), 'the night is on the view').toBe(true);

  await at(page, 11);
  let r = await read(page);
  expect(r.sky.dark, 'noon: no night at all').toBe(0);
  expect(r.shown, 'and no layer drawn').toBe(false);
  expect(r.lit, 'no lamp lit by day').toBe(0);
  expect(r.clockS, 'by day the clock counts to nightfall at 18 (seven town hours, 210 s)').toBeGreaterThan(180);
  expect(r.clockS).toBeLessThanOrEqual(210);
  await page.screenshot({ path: 'test-results/world-night-1-day.png' });

  await at(page, 16.75);
  r = await read(page);
  expect(r.sky.phase).toBe('dusk');
  expect(r.sky.dark, 'the sunset darkens').toBeGreaterThan(0.1);
  expect(r.sky.dark).toBeLessThan(0.9);
  expect(r.lit, '⭐ some lamps are on and some are not yet: one by one').toBeGreaterThan(0);
  expect(r.lit).toBeLessThan(r.working);
  await page.screenshot({ path: 'test-results/world-night-2-sunset.png' });

  await at(page, 19);
  r = await read(page);
  expect(r.sky, '19: night already, before the ghosts').toMatchObject({ dark: 1, phase: 'night' });
  expect(r.lit, 'every working lamp lit').toBe(r.working);
  expect(r.shown).toBe(true);
  expect(r.clockS, 'by night the clock counts to the morning at 4 (nine town hours, 270 s)').toBeGreaterThan(240);
  expect(r.clockS).toBeLessThanOrEqual(270);
  await page.screenshot({ path: 'test-results/world-night-3-evening.png' });

  await at(page, 21.2, 1000);
  await page.waitForFunction(() => window.__town.room.ghosts().length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  r = await read(page);
  expect(r.sky.dark).toBe(1);
  expect(r.kinds, 'the ghosts glow cold').toContain('ghost');
  await page.screenshot({ path: 'test-results/world-night-4-ghosts.png' });

  await at(page, 1);
  r = await read(page);
  expect(r.sky, '1: still night, after the ghosts').toMatchObject({ dark: 1, phase: 'night' });
  expect(r.lit).toBe(r.working);

  await at(page, 3);
  r = await read(page);
  expect(r.sky.phase).toBe('dawn');
  expect(r.sky.dark, 'the sunrise lifts it').toBeGreaterThan(0.1);
  expect(r.sky.dark).toBeLessThan(0.9);
  await page.screenshot({ path: 'test-results/world-night-5-sunrise.png' });

  await at(page, 5);
  r = await read(page);
  expect(r.sky.dark, 'and it is day again').toBe(0);
  expect(r.shown).toBe(false);
  expect(errs).toEqual([]);
});

test('a dead lamp is dark at night; inside a room there is no sky; a Curse Night darkens it in its own colour', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await open(page);
  // a struggling town has lamps out (condition.js LOOK) — every one of them stays dark in the night
  await page.evaluate(() => window.__town.room.set(20));
  await at(page, 21.5, 2400);
  let r = await read(page);
  expect(r.out.length, 'the struggling town has a dead lamp to look at').toBeGreaterThan(0);
  expect(r.lit, '⭐ only the working lamps light the night').toBe(r.working);
  const deadLit = await page.evaluate((out) => window.__town.room.lights().filter((l) => out.includes(l.key)).map((l) => l.key), r.out);
  expect(deadLit, 'no light stands at a dead lamp').toEqual([]);

  // one door: the arcade hides the night, the street shows it again
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(1200);
  r = await read(page);
  expect(r.sky.hidden, 'inside the arcade there is no night').toBe(true);
  expect(r.shown).toBe(false);
  await page.evaluate(() => window.__town.arcade.exit());
  await page.waitForTimeout(1200);
  r = await read(page);
  expect(r.shown, 'and it is waiting outside').toBe(true);

  // a Curse Night is never lighter than the clock, and wears its own colour — at noon too
  await at(page, 11);
  for (const [tier, dark] of [['hush', 0.45], ['deep', 1]]) {
    await page.evaluate((t) => window.__town.room.curse(t), tier);
    await page.waitForFunction((t) => window.__town.sky().mood === t, tier, { timeout: 10000 });
    await page.waitForTimeout(400);
    r = await read(page);
    expect(r.sky.dark, tier + ': its own dark over a noon sky').toBeGreaterThanOrEqual(dark);
    await page.screenshot({ path: 'test-results/world-night-6-' + tier + '.png' });
  }
  await page.evaluate(() => window.__town.room.curse('none'));
  await page.waitForFunction(() => window.__town.sky().mood === null, null, { timeout: 10000 });
  expect(errs).toEqual([]);
});
