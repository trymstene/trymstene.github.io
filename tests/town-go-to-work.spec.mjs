// 💼 GO TO WORK FROM ANYWHERE IN THE TOWN, AND THE SHIFT HOLDS (24 Sep 2026, the job QA).
//
// The staff card has two doors: the workplace itself, and the work note, which is on screen from anywhere in the town.
// From the note, "Go to work" walks the banana to the counter and starts the shift when it gets there. A counter ends a
// shift when its worker stays off the mark for 8 s — so if the walk stopped short of the mark, a player who pressed the
// card's own button would be clocked in and, eight seconds later, out, with an empty receipt. The live job journey saw a
// shift end exactly like that, and this walk found why: from the corner by the Exchange the straight walk to the café met a
// wall 300 px short, and a stopped walk counts as arrived. The walk goes along the streets now (town-life's route), and a
// counter reached short of its mark says so instead of starting. Both counters, from across the square, held past 8 s.
import { test, expect } from '@playwright/test';
import STAFF from '../src/data/copy/town-staff.json' with { type: 'json' };
import CAFE from '../src/data/copy/town-cafe.json' with { type: 'json' };
import LEMON from '../src/data/copy/town-lemon.json' with { type: 'json' };

const WORDS = { cafe: CAFE, stand: LEMON };

async function square(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.staffOpen, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
  await page.waitForTimeout(600);
  return errors;
}

for (const [at, far, ready, seam] of [['cafe', [1500, 1000], 'cafeReady', 'cafe'], ['stand', [400, 700], 'lemonReady', 'lemon']]) {
  test(`${at}: Go to work on the note's staff card walks to the counter, and the shift is still on past the 8 s off-the-mark rule`, async ({ page }) => {
    test.setTimeout(90000);
    const errors = await square(page);
    await page.evaluate((a) => window.__town.work.set({ at: a }), at);
    expect(await page.evaluate((r) => window.__town.room[r](), ready), 'the counter’s chunk arrives').toBe(true);
    await page.evaluate((w) => { const c = window.__town.room[w](); if (c && c.quiet) c.quiet(true); }, seam);   // nobody queues: this is about the walk
    await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, far);
    await page.waitForTimeout(400);
    await page.evaluate((a) => window.__town.staffOpen(a, 'note'), at);
    await page.waitForSelector('#twsGo', { state: 'visible', timeout: 10000 });
    expect((await page.locator('#twsGo').textContent()).trim()).toBe(STAFF.go);
    await page.click('#twsGo');
    await page.waitForFunction((w) => { const c = window.__town.room[w](); return !!(c && c.on()); }, seam, { timeout: 40000 });
    const t0 = await page.evaluate(() => ({ x: Math.round(window.__town.pos.x), y: Math.round(window.__town.pos.y) }));
    await page.waitForTimeout(10500);
    const after = await page.evaluate((w) => ({ on: window.__town.room[w]().on(), folded: !!document.querySelector('.tw-cup.is-folded'), x: Math.round(window.__town.pos.x), y: Math.round(window.__town.pos.y) }), seam);
    await page.screenshot({ path: `test-results/go-to-work-${at}.png` });
    expect(after.on, `the shift at the ${at} is still on 10 s after it began (the banana clocked in at ${t0.x},${t0.y})`).toBe(true);
    expect(after.folded, 'and its tray is up, not folded away as if the worker had stepped off the mark').toBe(false);
    expect(errors).toEqual([]);
  });

  test(`${at}: a walk to work that stops short of the counter starts no shift, and the counter says to walk up`, async ({ page }) => {
    test.setTimeout(60000);
    const errors = await square(page);
    await page.evaluate((a) => window.__town.work.set({ at: a }), at);
    expect(await page.evaluate((r) => window.__town.room[r](), ready)).toBe(true);
    await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, far0(at));
    await page.evaluate((a) => window.__town.room.clockIn(a), at);   // what the walk's arrival calls, wherever it stopped
    await page.waitForFunction((l) => (document.getElementById('twToast').textContent || '').trim() === l, WORDS[at].far, { timeout: 5000 });
    expect(await page.evaluate((w) => window.__town.room[w]().on(), seam), 'no shift short of the counter').toBe(false);
    expect(errors).toEqual([]);
  });
}
function far0(at) { return at === 'cafe' ? [1536, 1035] : [890, 900]; }   // the café: where the straight walk from the Exchange used to stop
