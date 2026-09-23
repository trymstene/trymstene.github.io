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
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };

const town = async (page, life = 95) => {
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate((v) => { window.__town.room.curse('none'); window.__town.room.set(v); window.__town.life.set(11); }, life);
  await page.waitForTimeout(900);
};
// ⚠️ WAIT FOR THE SQUARE, never for a clock. A fixed sleep passed alone and failed in the full
// suite, where two workers share a machine and the re-render lands later than it does on its own.
// ⚠️ …and for the WHOLE mark: the lamps AND more problems than before. Waiting for the first lamp
// alone raced the reseed under two workers. ⚠️ NOT for the bins by name: a dark lamp is ALWAYS one of
// your problems (the closed-door rule), but a full bin is one candidate in a weighted, wave-capped
// draw (PROBLEM_OPEN = 6, and a deep night's six lamps can fill every slot) — so "bins to put right"
// was a coin toss on the seed, and it came up 0 once in three runs.
const settle = async (page, want, before = 0) => {
  await page.waitForFunction(([w, n0]) => {
    const s = window.__town.room, ps = s.problems();
    const lamps = ps.filter((p) => p.type === 'lamp').length;
    return w === 'marked' ? (lamps > 0 && ps.length > n0) : lamps === 0;
  }, [want, before], { timeout: 15000 }).catch(() => {});
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
  await settle(page, 'marked', before.problems);
  const after = await seen(page);

  // ⚠️ the band has NOT moved — which is the whole point. The square changed anyway.
  expect(after.band, 'the band is untouched').toBe(before.band);
  expect(after.curseNow, 'and no curse is happening NOW — this is the morning').toBe('none');
  expect(after.lamps, 'there are lamps to relight where there were none').toBeGreaterThan(0);
  expect(after.bins, '…and no bin was emptied by the night').toBeGreaterThanOrEqual(before.bins);
  expect(after.litter, '…and more on the ground').toBeGreaterThan(before.litter);
  expect(after.problems, 'so a thriving square has real work in it the morning after')
    .toBeGreaterThan(before.problems);

  // ── a creep is the lighter night, and it says so
  await page.evaluate(() => window.__town.room.morning('creep', 180));
  await settle(page, 'marked', before.problems);
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

// 👻 THE GHOSTS' DAMAGE COSTS THE TOWN (21 Sep 2026). Trym: *"just stood still by the fountain through
// a night - the town health didnt decrease a single percent while ghosts had fun for the whole night -
// the meter didnt move a bit - doesnt feel very scary then"*. The night he sat through was the town's
// own (one every twelve minutes) and only Curse Nights charged the meter. Now a lamp a ghost puts out
// and a bin it tips are a point each: at once on the bar, then on the room's word. Later that evening,
// after a second night: *"up to 10% off the town meter a night until its atleast 60% minimum"* — so a
// night takes ten at most, shared, and the ghosts never drag a town below 60 on their own.
// ⚠️ AND THEN THE NIGHTS WERE MADE TO BITE (23 Sep 2026). Trym: *"the nights still doesnt feel very scary - town health
// went to 99% and then we where right up to 100% again - its been 100% the whole day when ive dropped by"*. He chose
// "Hard": a wreck costs TWO (relighting pays two, so an answered night no longer leaves the town higher), a night may
// take FIFTEEN, never below FORTY-FIVE on its own — and every night takes its toll by itself (worker-rave's walk,
// proven in worker-rave/test/town-nights.test.mjs, where the clock can be held).
test('a ghost’s damage costs the town — two a wreck, at once and on the room’s word, fifteen a night, never below forty-five', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (kind, name, p) => window.__ev.push([name, p]); });
  await page.setViewportSize({ width: 393, height: 852 });
  await town(page, 95);
  const before = await page.evaluate(() => window.__town.room.life().life);
  expect(before, 'a healthy town').toBeGreaterThanOrEqual(90);

  // ── two things wrecked: the bar drops four, and the room agrees
  const j = await page.evaluate(() => window.__town.room.dark(2));
  expect(j && j.counted, 'the room counted both').toBe(2);
  const after = await page.evaluate(() => ({ life: window.__town.room.life().life, bar: document.querySelector('.tw-hbar').textContent }));
  expect(after.life, 'four points off the meter: two a wreck').toBeCloseTo(before - 4, 5);
  expect(after.bar, 'and the bar on screen says so').toContain(Math.round(before - 4) + '%');
  const ev = await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_dark'));
  expect(ev.length, 'Pulse hears about it once per batch').toBe(1);

  // ── the night's cap: fifteen points in all, then the town stops paying (the lamp stays yours to relight)
  const j2 = await page.evaluate(() => window.__town.room.dark(3));
  expect(j2 && j2.counted, 'three more, all counted').toBe(3);
  const j3 = await page.evaluate(() => window.__town.room.dark(5));
  expect(j3 && j3.counted, 'two more fit in the night’s fifteen, and no more').toBe(2);
  const capped = await page.evaluate(() => window.__town.room.life());
  expect(capped.life, '…and the meter stands where the cap left it').toBeCloseTo(before - 14, 5);
  expect(capped.dark && capped.dark.used, 'fourteen of the night’s fifteen spent: the last point is not a whole wreck').toBe(14);
  // ── the floor: a town at 49 loses four and not a point more, whatever the ghosts do
  await page.evaluate(() => window.__town.room.set(49));   // a set is a fresh night for the shim's take
  const j4 = await page.evaluate(() => window.__town.room.dark(5));
  expect(j4 && j4.counted, 'forty-five is the floor a plain night cannot cross').toBe(2);
  expect((await page.evaluate(() => window.__town.room.life())).life, 'the meter stops at 45').toBeCloseTo(45, 5);
  expect(errs, 'nothing threw').toEqual([]);
});

// 👻 THE HAUNTED NIGHT (23 Sep 2026): one of the town's own nights in ten — Trym: "i know we have some cursed nights or
// something but ive not seen any of those yet". It wears the Curse Night's look for its two minutes, and it does NOT shut
// the fronts: it comes too often to end somebody's shift at the café's hatch.
test('a haunted night: the curse’s look, bolder ghosts, a line said once — and the café keeps its shift', async ({ page }) => {
  test.setTimeout(90000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (kind, name, p) => window.__ev.push([name, p]); try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  await page.setViewportSize({ width: 393, height: 852 });
  await town(page, 85);
  // a shift running at the Coffee Cup when the night falls
  await page.evaluate(() => window.__town.room.folkReady());
  expect(await page.evaluate(() => window.__town.room.cafeReady())).toBe(true);
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__town.room.cafe().clockIn())).toBe(true);

  await page.evaluate(() => window.__town.room.curse('haunt'));
  // the square says it, once, in the town's own words
  await page.waitForFunction((l) => (document.getElementById('twToast').textContent || '').trim() === l, LIFE.toasts.haunt, { timeout: 5000 });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__town.room.night()), 'the curse’s dark').toBeGreaterThanOrEqual(0.45);
  expect((await page.evaluate(() => window.__town.life.kept())).length, 'the residents go indoors').toBeGreaterThanOrEqual(8);
  const g = await page.evaluate(() => window.__town.room.ghosts());
  expect(g.map((x) => x.id).sort(), 'the creeping night’s company').toEqual(['drift', 'knock', 'roam', 'roam2', 'sit', 'wisp']);
  expect(await page.evaluate(() => !!document.querySelector('.wx.is-heavy')), 'a cold rain').toBe(true);
  expect(await page.evaluate(() => window.__town.room.vendor()), 'no night vendor: that is a deep night’s').toBe(false);
  const shut = await page.evaluate(() => window.__town.room.shut());
  expect(shut.includes('cafe') || shut.includes('info'), '⭐ the fronts stay open').toBe(false);
  expect(await page.evaluate(() => window.__town.room.cafe().on()), '⭐ and the café’s shift goes on').toBe(true);
  const told = await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_curse').map((e) => e[1].tier));
  expect(told, 'Pulse hears one haunted night').toEqual(['haunt']);
  await page.screenshot({ path: 'test-results/night-haunted.png' });
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  expect(errs, 'nothing threw').toEqual([]);
});
