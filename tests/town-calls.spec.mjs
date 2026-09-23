// 📟 THE CALLS — the walk (23 Sep 2026; the staff card plan, slice 0b).
//
// Trym, 23 Sep: "one job you are in a game, the other type of job you can roam around in the world until you get a
// notification-job-quest that you need to clean up … as long as we treat both jobs with the same amount of weight".
// So this walks the on-call half the way the café walk plays a cup: a day that starts quiet, a call that comes in and
// rings the note, the room drawing the work the moment the call lands, the calls answered one by one, the day's line
// for all of them — the store's delivery the same — and the call reaching the worker in the park, with the way back.
import { test, expect } from '@playwright/test';
import { playRepair } from './play-repair.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { schedule, NEEDS } from '../src/lib/work-calls.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DUTY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-duties.json'), 'utf8'));
const STAFF = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-staff.json'), 'utf8'));
const SHOT = 'test-results/calls-';
const DAY = () => Math.floor(Date.now() / 86400000);

async function town(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(11); });
  return errs;
}
// the day's call clock, pinned: which calls today, and whether they have come in yet
const pin = (page, kinds, inAlready) => page.evaluate(([k, on, d]) => localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: on ? Date.now() - 36e5 : Date.now() + 36e5, qa: k })), [kinds, inAlready, DAY()]);
const events = (page, name) => page.evaluate((n) => window.__ev.filter((e) => e[0] === n).map((e) => e[1]), name);
const note = (page) => page.evaluate(() => ({ kind: window.__town.duties.kind(), line: window.__town.duties.line(), rang: window.__town.duties.rang() }));

test('a week of calls is sized to the week’s work, per person, and each comes in within minutes', () => {
  // pure: the schedule alone, over a thousand people and a week each
  const days = { sweep: 0, fix: 0, restock: 0, serve: 0, deliver: 0 }, people = 1000;
  const monday = 20360;   // a Monday (day 4 of the epoch was one, and 20360 = 4 + 7 × 2908): (day + 3) % 7 === 0
  expect((monday + 3) % 7, 'the week starts on a Monday, the payslip’s week').toBe(0);
  let maxAfter = 0;
  for (let p = 0; p < people; p++) {
    const id = 'c' + p.toString(36) + 'x';
    const week = { sweep: 0, fix: 0, restock: 0, serve: 0, deliver: 0 };
    for (let d = monday; d < monday + 7; d++) {
      for (const at of ['condo', 'store']) for (const c of schedule(at, d, id)) { week[c.kind]++; maxAfter = Math.max(maxAfter, c.after); }
    }
    expect(week, 'every worker gets the same number of calls a week').toEqual({ sweep: 6, fix: 5, restock: 6, serve: 5, deliver: 3 });   // 📦 the parcel is a rank-3 store worker's (calls() holds it back below)
    for (const k of Object.keys(days)) days[k] += week[k];
  }
  // the targets on the payslip (src/data/town/jobs.js): sweep 3, fix 3, restock 3, serve 3 — every one can be met
  expect(days.sweep / people * NEEDS.sweep, 'litter to sweep in a week, against a target of 3').toBeGreaterThanOrEqual(3);
  expect(days.fix / people * NEEDS.fix, 'cabinets to wake in a week, against a target of 3').toBeGreaterThanOrEqual(3);
  expect(days.restock / people * NEEDS.restock, 'faces to fill in a week, against a target of 3').toBeGreaterThanOrEqual(3);
  expect(days.serve / people * NEEDS.serve, 'customers to serve in a week, against a target of 3').toBeGreaterThanOrEqual(3);
  expect(maxAfter, 'no call waits more than eight minutes into the day').toBeLessThanOrEqual(8 * 60000);
  // and two people are not called on the same days (the schedule is theirs, not the town's)
  const a = [0, 1, 2, 3, 4, 5, 6].map((i) => schedule('condo', monday + i, 'someone').length).join('');
  const b = [0, 1, 2, 3, 4, 5, 6].map((i) => schedule('condo', monday + i, 'someone else').length).join('');
  expect(a === b && a === [0, 1, 2, 3, 4, 5, 6].map((i) => schedule('condo', monday + i, 'a third').length).join(''), 'three people, three weeks of their own').toBe(false);
});

test('the arcade’s day: quiet, then a call rings the note and the room draws it, then answered call by call', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'condo', sofar: 0 }));
  await page.evaluate((d) => localStorage.setItem('tw-arcade-v1', JSON.stringify({ d, swept: [], fixed: [] })), DAY());
  await pin(page, ['sweep', 'fix'], false);

  // ── before the calls: the note is the week and the wage, the card says nothing needs you, the floor is clean
  await page.waitForFunction(() => window.__town.duties.line() && window.__town.duties.kind() !== 'call', null, { timeout: 5000 });
  expect((await note(page)).kind, 'no call yet').toBe('');
  await page.evaluate(() => window.__town.rooms.enter('condo'));
  await page.waitForTimeout(400);
  let a = await page.evaluate(() => window.__town.room.arcade());
  expect(a.litter.length, 'no litter before the call').toBe(0);
  expect(a.dead, 'no dark cabinet before the call').toBeNull();

  // ── the calls come in while the worker stands in the arcade: the note rings amber, and the room draws the work
  await pin(page, ['sweep', 'fix'], true);
  await page.waitForFunction(() => window.__town.duties.kind() === 'call', null, { timeout: 5000 });
  let n = await note(page);
  expect(n.line, 'Spinner calls, in the note’s own words').toBe(DUTY.call.sweep);
  expect(n.rang, 'and it rang').toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.twd-chip')).backgroundImage), 'amber, not the quest’s gold').toContain('rgb(255, 195, 107)');
  await page.waitForFunction(() => window.__town.room.arcade().litter.length === 1, null, { timeout: 5000 });   // 🗑 one piece a call day
  a = await page.evaluate(() => window.__town.room.arcade());
  expect(a.dead, 'the dark cabinet is in the room too').not.toBeNull();
  await page.screenshot({ path: SHOT + 'arcade-ringing.png' });

  // ── the card lists both calls, and says how long they stay open
  await page.click('.twd-chip__line');
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden && !!document.querySelector('.tws[data-at="condo"]'), null, { timeout: 10000 });
  const calls = await page.evaluate(() => [...document.querySelectorAll('.tws [data-call]')].map((li) => li.dataset.call));
  expect(calls).toEqual(['sweep', 'fix']);
  expect(await page.evaluate(() => document.querySelector('.tws').innerText), 'open until midnight').toContain(STAFF.until);
  await page.evaluate(() => document.getElementById('twCardX').click());

  // ── sweep the day's piece: the litter call is answered, and the note moves on to the cabinet
  for (const l of a.litter) await page.evaluate(([x, y]) => window.__town.room.sweepAt(x, y), [l.x, l.y]);
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.call.fix, { timeout: 5000 });

  // ── wake the cabinet: every call today is answered, and the note says so in one line
  const key = a.dead;
  const spot = await page.evaluate((k) => window.__town.arcade.spots().find((q) => q[0] === k), key);
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [(spot[1] + spot[3]) / 2, spot[4] + 26]);
  expect(await page.evaluate((k) => window.__town.room.cabinetRepair(k), key)).toBe(true);
  await playRepair(page, false);   // 🔧 the repair is the arcade's skill game now (town-repair.js)
  await page.waitForFunction(() => window.__town.room.arcade().dead === null, null, { timeout: 8000 });
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.answered, { timeout: 5000 });
  expect((await note(page)).kind, 'no longer calling').toBe('');
  const kinds = (await events(page, 'town_duty')).map((e) => e.kind);
  expect(kinds, 'Pulse heard the call and the day answered').toEqual(expect.arrayContaining(['call', 'answered']));
  expect(errs).toEqual([]);
});

test('the store’s delivery call opens two faces and lights the crates; two faces filled answer it', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.room.set(96));   // thriving: every face full for a customer
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  await page.evaluate((d) => localStorage.setItem('tw-restock-v1', JSON.stringify({ d, n: 0 })), DAY());
  await pin(page, ['restock'], false);
  const full = await page.evaluate(() => window.__town.rooms.of('store').full.length);
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForTimeout(500);
  expect((await page.evaluate(() => window.__town.room.shelf())).length, 'before the delivery, the shelf is full').toBe(full);
  expect(await page.evaluate(() => window.__town.room.bare()), 'nothing to fill').toBe(-1);

  await pin(page, ['restock'], true);
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.call.restock, { timeout: 5000 });
  await page.waitForFunction((f) => window.__town.room.shelf().length === f - 2, full, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.room.hints()), 'the crates are lit').toEqual(['overcr1', 'overcr2']);

  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.__town.room.open('cr1'));
    await page.waitForFunction(() => window.__town.room.carrying(), null, { timeout: 8000 });
    const face = await page.evaluate(() => window.__town.rooms.of('store').full[window.__town.room.bare()][0]);
    await page.evaluate((f) => window.__town.room.open(f), face);
    await page.waitForFunction(() => !window.__town.room.carrying(), null, { timeout: 8000 });
  }
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.answered, { timeout: 5000 });
  expect(errs).toEqual([]);
});

test('a call reaches the worker in the park, rings there, folds with the town’s own fold, and its tap offers the way back', async ({ page }) => {
  test.setTimeout(60000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript((d) => {
    window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]);
    try {
      localStorage.setItem('tw-job-v1', JSON.stringify({ at: 'condo', week: '', days: 0 }));
      localStorage.setItem('tw-arcade-v1', JSON.stringify({ d, swept: [], fixed: [] }));
      if (!sessionStorage.getItem('wkp-pinned')) { localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: ['sweep', 'fix'] })); sessionStorage.setItem('wkp-pinned', '1'); }
    } catch (e) {}
  }, DAY());
  await page.goto('/park/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__pager && !window.__pager.hidden(), null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__pager.line()), 'the town’s call, in the town’s words').toBe(DUTY.call.sweep);
  const ring = (await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_staff').map((e) => e[1])))[0];
  expect(ring, 'Pulse hears it ring in the park').toMatchObject({ door: 'pager', act: 'ring', kind: 'sweep', area: 'park' });
  await page.waitForTimeout(1000);
  const early = await page.evaluate(() => { const p = document.querySelector('.wkp').getBoundingClientRect(), q = document.querySelector('.bwq-hint'); return q ? { top: p.top, qBottom: q.getBoundingClientRect().bottom } : null; });
  if (early) expect(early.top, 'the quest note’s place is kept while it waits to pop in').toBeGreaterThan(early.qBottom);
  await page.waitForFunction(() => { const q = document.querySelector('.bwq-hint'); return !q || !q.classList.contains('bwq-hint--wait'); }, null, { timeout: 15000 });
  await page.waitForTimeout(900);   // the column settled
  const box = await page.evaluate(() => {
    const p = document.querySelector('.wkp').getBoundingClientRect(), q = document.querySelector('.bwq-hint');
    const qr = q && !q.hidden && getComputedStyle(q).display !== 'none' ? q.getBoundingClientRect() : null;
    return { top: p.top, qBottom: qr ? qr.bottom : null, z: getComputedStyle(document.querySelector('.wkp')).zIndex };
  });
  if (box.qBottom != null) expect(box.top, 'under the quest note, never on it').toBeGreaterThan(box.qBottom);
  expect(box.z, 'the quest chip’s layer: under every card').toBe('10');
  await page.screenshot({ path: SHOT + 'park.png' });

  // the briefcase folds it — the same fold the town's note reads
  await page.click('.wkp__b');
  expect(await page.evaluate(() => window.__pager.folded())).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tw-job-v1')).hm), 'folded for the town too').toBe(1);
  await page.click('.wkp__b');
  expect(await page.evaluate(() => window.__pager.folded())).toBe(false);

  // a tap on the paper opens the world's travel card: the way back to town
  await page.click('.wkp span');
  await page.waitForFunction(() => { const v = document.querySelector('.wt-veil'); return v && !v.hidden; }, null, { timeout: 5000 });
  const travel = (await page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_staff').map((e) => e[1].act)));
  expect(travel, 'Pulse hears the way back taken').toContain('travel');
  expect(errs).toEqual([]);
});
