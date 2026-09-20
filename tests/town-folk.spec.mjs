// 🚶 THE TOWN'S VISITORS — the walk (20 Sep 2026).
//
// Trym, 20 Sep: the square is only the CENTRE of Banana Town, so bananas wander into it from the
// roads that leave the map, do something ordinary, and leave again. The nine residents are the
// town's fixtures; these are its traffic.
//
// ⚠️ WHAT COULD GO WRONG HERE IS MOSTLY INVISIBLE, which is why each of these exists:
//   · a visitor walking THROUGH a building, because the route left the streets
//   · a visitor sat on a PLANTER (the square has flower-box "benches") where only its hat shows
//   · a visitor that can be TAPPED, and answers with nothing, because it has no name and no card
//   · a visitor that survives walking into a room, painting over the shop's plate (design library §22)
import { test, expect } from '@playwright/test';
import { STREETS, SEATS } from '../src/scripts/town-geo.js';

async function town(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.waitForTimeout(300);
  return errors;
}
const folk = (page) => page.evaluate(() => window.__town.room.folk().folk());

test('visitors arrive from off the map, and never more than the cap', async ({ page }) => {
  const errors = await town(page);
  const gates = await page.evaluate(() => window.__town.room.folk().gates());
  expect(gates.length, 'the roads that leave the map').toBeGreaterThanOrEqual(3);
  // ⚠️ A GATE IS TWO POINTS. `at` is the edge of the map or a bus stop standing off the road, and
  // `on` is the step onto the street — and `on` is the one that must actually BE on a street, or
  // streetAt() falls back to the nearest by centre distance and the arrival sets off cross-country.
  // This walk caught exactly that: a visitor at 1995,152, over the grass between two roads.
  for (const g of gates) {
    expect(g.at && g.on, 'a gate has a place to appear and a step onto the road').toBeTruthy();
    const on = STREETS.some((r) => g.on.x >= r[0] && g.on.x <= r[2] && g.on.y >= r[1] && g.on.y <= r[3]);
    expect(on, `the step at ${g.on.x},${g.on.y} is ON a street, not near one`).toBe(true);
  }

  const max = await page.evaluate(() => window.__town.room.folk().max());
  await page.evaluate((n) => window.__town.room.folk().fill(n + 4, performance.now()), max);
  const n = (await folk(page)).length;
  expect(n, 'the cap holds even when asked for more').toBeLessThanOrEqual(max);
  expect(n, 'and the square is not empty').toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('they keep to the streets, and sit only on something that is a seat', async ({ page }) => {
  const errors = await town(page);
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));

  const seatXY = SEATS.map(([, x, base]) => ({ x, y: base }));
  // the last steps to a gate are off the road ON PURPOSE — the bus stop stands beside it, not on it
  const gates = await page.evaluate(() => window.__town.room.folk().gates());
  const seatKeys = SEATS.map(([k]) => k);
  expect(seatKeys, '⚠️ the square’s Flowers_Bench planters are NOT seats — a banana sat on one is a hat behind petals').not.toContain('benchh0');

  let sat = 0, seen = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1200);
    for (const v of await folk(page)) {
      if (v.hidden) continue;                     // gone into a shop: there is nothing to place
      seen++;
      // on a street, or on the last few steps to whatever it came here for
      const onStreet = STREETS.some((r) => v.x >= r[0] - 26 && v.x <= r[2] + 26 && v.y >= r[1] - 26 && v.y <= r[3] + 26);
      const atThing = seatXY.some((s) => Math.hypot(s.x - v.x, s.y - v.y) < 90);
      const atGate = gates.some((g) => Math.hypot(g.at.x - v.x, g.at.y - v.y) < 130);
      expect(onStreet || atThing || atGate, `a visitor at ${v.x},${v.y} (${v.job}) is on the streets, at what it came for, or on the last steps to a gate`).toBe(true);
      if (v.sitting) {
        sat++;
        // ⭐ the beach's sitting pair, and nothing else: a banana must not dance on a bench
        expect([0, 4], 'a sitter is locked on a side-facing frame').toContain(v.frame);
        const near = seatXY.some((s) => Math.hypot(s.x - v.x, s.y - v.y) < 40);
        expect(near, `sitting at ${v.x},${v.y} is on a declared seat`).toBe(true);
      }
    }
  }
  expect(seen, 'somebody was about').toBeGreaterThan(0);
  expect(sat, 'and at least one of them sat down').toBeGreaterThan(0);
  // ⚠️ THE ROOT CAUSE, ASSERTED DIRECTLY. route() draws a straight line when it cannot find a way
  // through the street graph, and that is the only way a visitor crosses a lawn. It happened because
  // the builder lays streets EDGE TO EDGE — the plaza's top edge is the north street's bottom edge at
  // y 660 exactly — so a strict overlap test made the whole middle of the square an island.
  expect(await page.evaluate(() => window.__town.room.folk().strays()), 'not one visitor had to improvise a route').toBe(0);
  expect(errors).toEqual([]);
});

test('a visitor is scenery: it cannot be tapped, and a room hides it', async ({ page }) => {
  const errors = await town(page);
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.waitForTimeout(1500);

  // ⚠️ NOT TAPPABLE. It has no name, no card and nothing to say — a tap that found one would open
  // nothing, or worse, steal a tap meant for the thing behind it.
  const hit = await page.evaluate(() => {
    const out = [];
    for (const v of window.__town.room.folk().folk()) out.push(window.__town.room.hit(v.x, v.y - 20));
    return out;
  });
  for (const h of hit) expect(h == null || (h[0] !== 'npc' && h[0] !== 'visitor'), 'a tap on a visitor finds no resident').toBe(true);

  // ⚠️ and they wear the classes both `.is-inside` hide lists name, so stepping into a shop blanks
  // them instead of painting a banana over the room's plate
  const classes = await page.evaluate(() => [...document.querySelectorAll('.tw-visitor')].map((e) => e.className));
  expect(classes.length).toBeGreaterThan(0);
  for (const c of classes) expect(c, 'a visitor is a .tw-npc .tw-visitor').toContain('tw-npc');

  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForTimeout(600);
  const shown = await page.evaluate(() => [...document.querySelectorAll('.tw-visitor')].filter((e) => getComputedStyle(e).visibility === 'visible' && !e.hidden).length);
  expect(shown, '⚠️ not one visitor paints over the shop’s plate').toBe(0);
  await page.evaluate(() => window.__town.rooms.exit());
  expect(errors).toEqual([]);
});

// ⭐ THE VISITORS READ THE TOWN (20 Sep 2026, design library §23). They are traffic, not fixtures —
// but traffic that ignored the clock and the band, so a blacked-out Curse Night square still had six
// party-hatted strangers strolling it and a 2% Abandoned town was as busy as a Thriving one. The
// town-wide rule was already written for the baked visitors and the travelling stall (Trym, 15 Sep:
// "aren't the townsbananas supposed to go inside in the night?"); these obey it too now.
test('the square empties at nightfall, and a poor town is a quiet one', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(12); });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__town.room.folk().count()), 'a Thriving square carries a crowd').toBeGreaterThan(3);

  // ── the lamps come on: everybody WALKS home. Not a blink — they cross the square at 96 px a second,
  // which is why this waits rather than measuring one frame.
  await page.evaluate(() => window.__town.life.set(23));
  await page.waitForTimeout(700);
  const heading = await page.evaluate(() => window.__town.room.folk().dump());
  expect(heading.every((v) => v.job === 'leave'), 'every one of them is on its way out at once').toBe(true);
  expect(heading.every((v) => !v.until), '⚠️ including the ones on a bench: a rest must not outlast the day').toBe(true);
  await page.waitForFunction(() => window.__town.room.folk().count() === 0, null, { timeout: 45000 });

  // ── and nobody new arrives in the dark
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => window.__town.room.folk().count()), 'the dark square stays empty').toBe(0);

  // ── an Abandoned town, by daylight, is quiet on purpose
  await page.evaluate(() => { window.__town.life.set(12); window.__town.room.set(10); });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.__town.room.folk().cap()), 'nobody strolls a 10% town').toBe(0);
  await page.evaluate(() => { window.__town.room.set(85); });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => window.__town.room.folk().cap()), 'and a Thriving one is busy again').toBeGreaterThan(3);
  expect(errors).toEqual([]);
});
