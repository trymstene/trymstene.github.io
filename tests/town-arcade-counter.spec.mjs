// 🎟 THE ARCADE'S PRIZE COUNTER (29 Sep 2026). Trym, in the arcade: "this part of the inside of the Arcade seems a bit random - a
// livingroom television-shelf with a tv, and two broken sprites of bar-stools maybe? … could we do something here and add some
// interior that matches an arcade? like a desk or reception for the arcade".
//
// The corner is a front desk now — the TV studio's neon news desk with a gold cup on it, the clothing store's cap stand behind
// (the Joy cap is one of the arcade's prizes) — and Spinner keeps it from BEHIND on his indoor beats, the way Pip keeps the
// store (design library §41): the desk's own front is drawn over him, a tap on him is him and a tap on the desk is the desk,
// and his staff's arrival sends him out round its end, never through it.
import { test, expect } from '@playwright/test';
import FRONTS from '../src/data/copy/town-fronts.json' with { type: 'json' };
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };

async function arcade(page, { job = '', hour = 5 } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.work.set, null, { timeout: 30000 });
  await page.evaluate((h) => { window.__town.room.curse('none'); window.__town.work.set({ at: '' }); window.__town.life.set(h); }, hour);   // 5: an indoor beat
  if (job) await page.evaluate((j) => window.__town.work.set({ at: j }), job);
  await page.evaluate(() => window.__town.rooms.enter('condo'));
  await page.waitForTimeout(800);
  return errs;
}
// a REAL tap on a world point: where it is on screen depends on where the camera is
async function tapWorld(page, x, y) {
  const p = await page.evaluate(([wx, wy]) => {
    const w = document.getElementById('twWorld'), sc = parseFloat(w.style.getPropertyValue('--ws')), r = w.getBoundingClientRect();
    return { x: r.left + wx * sc, y: r.top + wy * sc };
  }, [x, y]);
  await page.mouse.click(p.x, p.y);
}
const spinner = (page) => page.evaluate(() => window.__town.life.residents().find((q) => q.key === 'spinner'));
const desk = (page) => page.evaluate(() => window.__town.rooms.of('condo').spots.find((q) => q[0] === 'counter'));
const toast = (page) => page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());

for (const [w, h] of [[393, 852], [1280, 800]]) {
  test(`Spinner keeps the arcade from behind its prize desk, and the desk is drawn over him (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errs = await arcade(page);
    const sp = await spinner(page);
    expect(sp.inside, '⭐ in the arcade on his indoor beat').toBe(true);
    expect(sp.hidden, 'and drawn while you are in it').toBe(false);
    const d = await desk(page);
    expect(d[3] - d[1], 'the desk is one tap box, end to end').toBeGreaterThanOrEqual(180);
    expect(sp.x > d[1] + 20 && sp.x < d[3] - 20, 'behind the desk, across its width').toBe(true);
    expect(sp.y > 270 && sp.y < d[4], '…with his feet inside its footprint, so its front hides them').toBe(true);
    const f = await page.evaluate(() => {
      const e = document.querySelector('.tw-state.is-front'), n = document.querySelector('.tw-npc[data-k="spinner"]');
      return { front: e ? +e.style.zIndex : 0, him: +n.style.zIndex, src: e ? e.querySelector('img').getAttribute('src') : '', vis: e ? getComputedStyle(e).visibility : '' };
    });
    expect(f.src, 'the front is the desk’s own copy').toContain('s-overcounter-0.png');
    expect(f.vis, '⚠️ and VISIBLE indoors (§22: .is-in or the hide list blanks it)').toBe('visible');
    expect(f.front, '⚠️ drawn OVER him — a plate cannot be in front of anybody').toBeGreaterThan(f.him);
    expect(await toast(page), 'the room names who runs it: he is here').toBe(LIFE.rooms.condo);
    await page.screenshot({ path: `test-results/arcade-counter-${w}.png` });
    expect(errs).toEqual([]);
  });
}

test('a tap on Spinner is Spinner, talked to across the desk — and a tap on the desk under him is the desk', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  const errs = await arcade(page);
  const sp = await spinner(page), d = await desk(page);
  await tapWorld(page, sp.x, sp.y - 50);   // his chest, above the desk top
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden, null, { timeout: 10000 });
  const talked = await page.evaluate(() => ({ npc: document.querySelector('#twPanel .tw-card').classList.contains('tw-card--npc'), name: document.querySelector('#twCardBody h2').textContent, y: window.__town.pos.y }));
  expect(talked.npc && talked.name, '⭐ his own card').toBe('Spinner');
  expect(talked.y, '…talked to across the desk, from its front').toBeGreaterThan(d[4]);
  await page.screenshot({ path: 'test-results/arcade-counter-talk.png' });
  await page.click('#twCardX');
  await page.waitForTimeout(200);
  await tapWorld(page, sp.x, sp.y + 12);   // the desk's front, straight under him
  await page.waitForFunction((t) => (document.getElementById('twToast').textContent || '').trim() === t, FRONTS.counter, { timeout: 5000 });
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden), 'the desk says its line; nothing opens').toBe(true);
  await page.waitForTimeout(1500);
  const at = await page.evaluate(() => ({ x: window.__town.pos.x, y: window.__town.pos.y }));
  expect(Math.abs(at.y - (d[4] + 26)) < 8, 'and the banana walks up to the desk’s front: ' + at.y).toBe(true);
  expect(errs).toEqual([]);
});

test('his staff get the floor: Spinner walks out round the end of his desk, never through it', async ({ page }) => {
  const errs = await arcade(page, { job: 'condo' });
  const d = await desk(page);
  const seen = [];
  for (let i = 0; i < 40; i++) {
    const s = await spinner(page);
    seen.push([Math.round(s.x), Math.round(s.y), s.inside]);
    if (!s.inside) break;
    await page.waitForTimeout(200);
  }
  expect(seen[seen.length - 1][2], '⭐ he has left the room to the one working it').toBe(false);
  const through = seen.filter(([x, y, inside]) => inside && x > d[1] + 10 && x < d[3] - 10 && y > d[4]);
  expect(through, 'never through the desk’s front').toEqual([]);
  expect(seen.some(([x, y, inside]) => inside && x < d[1] && y > 250 && y < d[4]), 'the way out passes the desk’s left end').toBe(true);
  expect(errs).toEqual([]);
});
