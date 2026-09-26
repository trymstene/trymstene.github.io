// 🧾 THE STORE'S COUNTER IS A TILL (26 Sep 2026). Trym: "when i enter the store its not very intuitive that you can click on
// the store counter for opening the inventory of the store - it should be solved visually with something rather than add
// another information message or textbox".
//
// What answers it, and what this walks: the counter carries the pack's own cash register; the WHOLE counter is one piece that
// answers a tap (its right third was a second single with no key, and a tap there found nothing); a tap walks the banana to the
// counter before its card opens (it opened from anywhere in the room, the one thing indoors that did not walk first); and a
// customer who has never opened it sees it lit with the town's own halo — until the first time, and never again after.
import { test, expect } from '@playwright/test';
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };

async function store(page, { job = '', band = 0, hour = 12 } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate((h) => { window.__town.room.curse('none'); window.__town.life.set(h); }, hour);
  // a fresh page has no job at all; the job seam arrives a moment after the square does, so it is waited for, never raced
  if (job) {
    await page.waitForFunction(() => window.__town.work && window.__town.work.set, null, { timeout: 20000 });
    await page.evaluate((j) => window.__town.work.set({ at: j }), job);
  }
  if (band) { await page.evaluate((b) => window.__town.room.set(b), band); await page.waitForTimeout(700); }
  await page.evaluate(() => window.__town.rooms.enter('store'));
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
const cardUp = (page) => page.evaluate(() => !document.getElementById('twPanel').hidden);
const invite = (page) => page.evaluate(() => window.__town.room.invite());

for (const [w, h] of [[375, 667], [1280, 800]]) {
  test(`a customer finds the counter lit, walks to it, and the shop opens there — once (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errs = await store(page, { band: 90 });
    const lit = await page.evaluate(() => {
      const e = document.querySelector('.tw-state.is-invite');
      return {
        keys: window.__town.room.invite(), hints: window.__town.room.hints(), n: document.querySelectorAll('.tw-state.is-invite').length,
        glow: !!e && /drop-shadow/.test(getComputedStyle(e).filter), seen: !!e && getComputedStyle(e).visibility === 'visible',
        z: e ? +e.style.zIndex : 0, plateZ: +getComputedStyle(document.querySelector('.tw-room')).zIndex,
      };
    });
    expect(lit.keys, '⭐ the counter is the invitation').toEqual(['overtill']);
    expect(lit.n, 'one lit thing').toBe(1);
    expect(lit.glow, 'wearing the town’s own halo').toBe(true);
    expect(lit.seen, '⚠️ and VISIBLE (design library §22: .is-in or the hide list blanks it)').toBe(true);
    expect(lit.z, '⚠️ above the room’s own plate').toBeGreaterThan(lit.plateZ);
    expect(lit.hints, 'the staff’s chore lights nothing for a customer').toEqual([]);
    await page.screenshot({ path: `test-results/store-till-lit-${w}.png` });

    // ── a REAL tap on the register itself, on the counter's right third, from the doorway
    const till = await page.evaluate(() => window.__town.rooms.of('store').spots.find((q) => q[0] === 'till'));
    expect(till[3] - till[1], 'the whole counter is one tap box, register and all').toBeGreaterThanOrEqual(140);
    const from = await page.evaluate(() => ({ x: window.__town.pos.x, y: window.__town.pos.y }));
    await tapWorld(page, till[3] - 18, till[2] + 22);
    await page.waitForTimeout(120);
    expect(await cardUp(page), '⭐ nothing opens on the tap itself: the banana walks to the counter first').toBe(false);
    await page.waitForFunction(() => !document.getElementById('twPanel').hidden, null, { timeout: 10000 });
    const at = await page.evaluate(() => ({ x: window.__town.pos.x, y: window.__town.pos.y }));
    expect(Math.hypot(at.x - from.x, at.y - from.y), 'it walked across the room').toBeGreaterThan(40);
    expect(at.y, '…to stand in front of the counter').toBeGreaterThan(till[4]);
    expect(Math.abs(at.y - (till[4] + 26)), '…right at it').toBeLessThan(6);
    expect(await page.locator('#twPanel [data-town-buy]').count(), 'and the shop is open there').toBeGreaterThan(0);
    expect(await invite(page), 'the invitation has done its work').toEqual([]);
    expect(await page.locator('.tw-state.is-invite').count(), 'and is gone from the room').toBe(0);
    await page.screenshot({ path: `test-results/store-till-open-${w}.png` });

    // ── and it stays done: out, and back in
    await page.click('#twCardX');
    await page.evaluate(() => window.__town.rooms.exit());
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__town.rooms.enter('store'));
    await page.waitForTimeout(600);
    expect(await invite(page), 'once is once: nothing lit the second time').toEqual([]);
    expect(errs).toEqual([]);
  });
}

test('the store’s own staff are never invited to their own counter', async ({ page }) => {
  const errs = await store(page, { job: 'store', band: 90 });
  expect(await invite(page), 'a place greets strangers, not its own staff (design library §32)').toEqual([]);
  expect(errs).toEqual([]);
});

test('a shut shop invites nobody', async ({ page }) => {
  const errs = await store(page, { band: 5 });
  expect(await page.evaluate(() => (window.__town.room.shelf() || []).length), 'the lowest band: nothing on the shelf').toBe(0);
  expect(await invite(page), 'an invitation only shines for somebody who can answer it').toEqual([]);
  expect(errs).toEqual([]);
});

// 🧾 PIP KEEPS THE STORE FROM BEHIND ITS COUNTER (26 Sep 2026, Trym: "maybe pip should be behind the counter, can sometimes walk
// out, but mainly is behind the counter. Feels organic if he has errands, but mostly behind the counter"). Every daytime beat on
// the store's floor but noon (the cash machine) and today's odd errand when it is his; the counter's front is drawn over him.
const pip = (page) => page.evaluate(() => window.__town.life.residents().find((q) => q.key === 'pip'));
const toast = (page) => page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());

test('Pip keeps the store from behind its counter, and the room names him', async ({ page }) => {
  const errs = await store(page, { hour: 6 });   // the morning
  const p = await pip(page);
  expect(p.inside, '⭐ in the store, not on the square').toBe(true);
  expect(p.hidden, 'and drawn while you are in it').toBe(false);
  const till = await page.evaluate(() => window.__town.rooms.of('store').spots.find((q) => q[0] === 'till'));
  expect(p.x > till[1] && p.x < till[3], 'behind the counter, across its width').toBe(true);
  expect(p.y > 752 && p.y < till[4], '…with his feet inside its footprint, so its front hides them').toBe(true);
  const z = await page.evaluate(() => ({
    front: +document.querySelector('.tw-state.is-front').style.zIndex,
    pip: +document.querySelector('.tw-npc[data-k="pip"]').style.zIndex,
  }));
  expect(z.front, '⚠️ the counter’s front is drawn OVER him — a plate cannot be in front of anybody').toBeGreaterThan(z.pip);
  expect(await toast(page), 'the room names who runs it: he is here').toBe(LIFE.rooms.store);
  await page.screenshot({ path: 'test-results/store-pip-in.png' });
  expect(errs).toEqual([]);
});

test('at noon Pip is out at the cash machine, and the room says so', async ({ page }) => {
  const errs = await store(page, { hour: 10 });
  const p = await pip(page);
  expect(p.inside, 'out on his errand').toBe(false);
  expect(p.place, 'the cash machine, as his own noon line says').toBe('bank');
  expect(await toast(page), 'the greeting does not send you to ask somebody who is not there (§3e)').toBe(LIFE.rooms.storeOut);
  expect(errs).toEqual([]);
});

test('a tap on Pip is Pip, and a tap on the counter under him is the shop', async ({ page }) => {
  const errs = await store(page, { hour: 6 });
  const p = await pip(page);
  // his chest, above the counter top: his card, after the banana has walked to the counter's front to talk across it
  await tapWorld(page, p.x, p.y - 50);
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden, null, { timeout: 10000 });
  const talked = await page.evaluate(() => ({ npc: document.querySelector('#twPanel .tw-card').classList.contains('tw-card--npc'), y: window.__town.pos.y }));
  expect(talked.npc, '⭐ his own card: the same one as outside').toBe(true);
  expect(talked.y, '…talked to across the counter, from its front').toBeGreaterThan(810);
  await page.click('#twCardX');
  await page.waitForTimeout(200);
  // the counter's front, straight under him: that is the till, never him
  await tapWorld(page, p.x, 792);
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden, null, { timeout: 10000 });
  expect(await page.locator('#twPanel [data-town-buy]').count(), 'the shop, not Pip').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('his own staff get the floor: Pip walks out round the end of his counter to the bank', async ({ page }) => {
  const errs = await store(page, { hour: 6, job: 'store' });
  const seen = [];
  for (let i = 0; i < 40; i++) {
    const p = await pip(page);
    seen.push([Math.round(p.x), Math.round(p.y), p.inside]);
    if (!p.inside && p.place === 'bank') break;
    await page.waitForTimeout(250);
  }
  const last = await pip(page);
  expect(last.inside, '⭐ he has left the room to the one working it').toBe(false);
  expect(last.place, 'for the bank’s step, his aside').toBe('bank');
  const through = seen.filter(([x, y, inside]) => inside && x > 630 && x < 774 && y > 812);
  expect(through, 'never through the counter’s front: round its end, like anybody').toEqual([]);
  expect(seen.some(([x, y, inside]) => inside && x < 630 && y > 780), 'the way out passes the counter’s left end').toBe(true);
  expect(errs).toEqual([]);
});
