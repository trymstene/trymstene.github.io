// 🌑 THE MORNING AFTER A CURSE NIGHT (21 Sep 2026).
//
// Trym: *"a cursed night wreaks too little havoc, towns been on over 90% all day, its been boring,
// and the ghosts and cursed nights dont feel impactful on the town health at all, streetlights been
// fine all day"*. The arithmetic said exactly why, and it was not a tuning problem:
//
//   · every band above 65 has an IDENTICAL look — lively and thriving are both 0 lamps out, 0
//     litter, 0 full bins, 0 crows, differing only in `visitors`.
//   · the hardest night in the game is a `deep` at −18, which takes a town sitting at 100 to 82.
//     Still lively.
//   · so a deep Curse Night on a healthy town changed the number of wandering visitors and NOTHING
//     ELSE. Nothing to see, and — the part that actually hurt — nothing to fix.
//
// So the night leaves its own mark on top of the band, and because every dark lamp is already one
// of your problems, the morning after has WORK in it even at 95%.
//
// ⚠️ IT ONLY WORKS IF THE SQUARE NOTICES. apply() re-ran the look on a BAND change alone, so a mark
// that arrives without moving the band changed nothing on screen — which was the same invisibility
// in a second place. That is what the last assertion here is really guarding.
import { test, expect } from '@playwright/test';
import { NIGHT_AFTER } from '../src/data/town/condition.js';

const town = async (page, life = 95) => {
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate((v) => { window.__town.room.curse('none'); window.__town.room.set(v); window.__town.life.set(11); }, life);
  await page.waitForTimeout(900);
};
// ⚠️ WAIT FOR THE SQUARE, never for a clock. A fixed sleep passed alone and failed in the full
// suite, where two workers share a machine and the re-render lands later than it does on its own.
// ⚠️ …and for the WHOLE mark. Waiting for the first lamp and then reading the bins raced the reseed
// under two workers: lamps were in, bins were not yet, and "bins to put right" read 0.
const settle = async (page, want, binsBefore = 0) => {
  await page.waitForFunction(([w, b0]) => {
    const s = window.__town.room, ps = s.problems();
    const lamps = ps.filter((p) => p.type === 'lamp').length;
    const bins = ps.filter((p) => p.type === 'bin' || p.type === 'dumpster').length;
    return w === 'marked' ? (lamps > 0 && bins > b0) : lamps === 0;
  }, [want, binsBefore], { timeout: 15000 }).catch(() => {});
};
const seen = (page) => page.evaluate(() => {
  const s = window.__town.room, ps = s.problems();
  return {
    band: s.band(),
    curseNow: s.life().curse,
    problems: ps.length,
    lamps: ps.filter((p) => p.type === 'lamp').length,
    bins: ps.filter((p) => p.type === 'bin' || p.type === 'dumpster').length,
    litter: document.querySelectorAll('.tw-litter').length,
  };
});

test('a curse night leaves work behind, even on a thriving square', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await town(page, 95);

  const before = await seen(page);
  expect(before.band, 'a healthy town').toBe('thriving');
  // ⭐ THE COMPLAINT, AS AN ASSERTION: at the top of the scale there is no lamp to relight.
  expect(before.lamps, 'a thriving square has no dark lamp of its own').toBe(0);

  // ── the morning after a deep night
  const door = await page.evaluate(() => window.__town.room.morning('deep', 180));
  expect(door && door.kind, 'the room says which night it was').toBe('deep');
  await settle(page, 'marked', before.bins);
  const after = await seen(page);

  // ⚠️ the band has NOT moved — which is the whole point. The square changed anyway.
  expect(after.band, 'the band is untouched').toBe(before.band);
  expect(after.curseNow, 'and no curse is happening NOW — this is the morning').toBe('none');
  expect(after.lamps, 'there are lamps to relight where there were none').toBeGreaterThan(0);
  expect(after.bins, '…and bins to put right').toBeGreaterThan(before.bins);
  expect(after.litter, '…and more on the ground').toBeGreaterThan(before.litter);
  expect(after.problems, 'so a thriving square has real work in it the morning after')
    .toBeGreaterThan(before.problems);

  // ── a creep is the lighter night, and it says so
  await page.evaluate(() => window.__town.room.morning('creep', 180));
  await settle(page, 'marked', before.bins);
  const creep = await seen(page);
  expect(creep.problems, 'a creep leaves less than a deep').toBeLessThan(after.problems);
  expect(creep.problems, '…and still more than a quiet night').toBeGreaterThan(before.problems);
  expect(NIGHT_AFTER.hush, 'and a hush leaves nothing at all — it costs the meter nothing either').toBeNull();

  // ── and the square puts itself right again
  await page.evaluate(() => window.__town.room.morning('deep', 60 * 20));   // long past the window
  await settle(page, 'clear');
  const later = await seen(page);
  expect(later.lamps, 'a night long past leaves no lamps out').toBe(0);
  expect(errs, 'nothing threw').toEqual([]);
});
