// 📅 TODAY'S WORK TRAVELS, AT EVERY JOB (2 Oct 2026).
//
// Trym: *"i fixed the arcade machine on my phone, and when i jumped into the town now from my laptop, i had to do it again?
// … this feels just like the wearables not stored cross-device - the same for jobs and tasks in jobs you have?"* — and
// *"there is an hour or so inbetween my device switch"*.
//
// The pass worker keeps today's work at the job you hold (worker-pass jobToday: how many of each task, the best grade, the
// doors a delivery reached) and hands it to every device of the pass — with the job's answer, and on every push and pull
// (banana-pass.js jobHint). This page is the LAPTOP: its own records of the day are empty, and the pass says what the PHONE
// did. Every job surface must agree with it: the work note and the pager, the store's shelf, its customers and its parcels,
// the post office's satchel and mail bag, and the café's rush. The arcade has its own walk (town-arcade-chores.spec.mjs).
// Only the pass worker's answers are played here; nothing reaches a worker or a real player.
import { test, expect } from '@playwright/test';
import DUTY from '../src/data/copy/town-duties.json' with { type: 'json' };
import DELIVER from '../src/data/copy/town-deliver.json' with { type: 'json' };

const NOISE = /workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/;
const PASS = /banana-pass\.trymstene\.workers\.dev/;
const DAY = () => Math.floor(Date.now() / 86400000);
const ISO = () => new Date().toISOString().slice(0, 10);
const SHOT = 'test-results/day-travels-';

// the laptop: signed in, nothing of today done on this device. The pass worker is played: a chore is heard and answered with
// nothing to land (the job stays the walk's), and the rest of the worker is out of reach
async function laptop(page, pull) {
  const errs = [], chores = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(NOISE, (r) => r.abort());
  await page.route(/banana-pass\.trymstene\.workers\.dev\/job\/chore/, async (r) => {
    try { chores.push(JSON.parse(r.request().postData() || '{}')); } catch (e) {}
    await r.fulfill({ contentType: 'application/json', body: '{"error":"qa"}' });
  });
  if (pull) await page.route(/banana-pass\.trymstene\.workers\.dev\/pull/, pull);
  await page.routeWebSocket(/workers\.dev/, () => {});
  return { errs, chores };
}
async function town(page, pull) {
  const w = await laptop(page, pull);
  await page.addInitScript(() => {
    window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]);
    if (sessionStorage.getItem('day-seeded')) return;
    sessionStorage.setItem('day-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('cookie-consent-v1', 'n');
    localStorage.setItem('pass-link', JSON.stringify({ credId: 'qa-laptop', token: 'qa-token' }));
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(96); window.__town.life.set(12); });
  await page.waitForTimeout(600);
  return w;
}
// the job as the pass answers it: the rank, and (once the phone has worked) today's work at it
const answer = (page, at, lad, today) => page.evaluate(([a, l, t]) => window.__town.work.set({ at: a, lad: l, today: t }), [at, lad, today]);
const toast = (page, line, ms) => page.waitForFunction((l) => (document.getElementById('twToast').textContent || '').trim() === l, line, { timeout: ms || 8000 });
const goTo = (page, xy, dy) => page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [xy[0], xy[1] + (dy || 0)]);

test('🏪 the store: the rows the phone put out, its two customers and both parcels are done on the laptop too', async ({ page }) => {
  test.setTimeout(90000);
  const { errs } = await town(page);
  await page.evaluate((d) => {
    localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: ['restock', 'serve', 'deliver'] }));
    for (const k of ['tw-restock-v1', 'tw-serve-v1', 'tw-deliver-v1']) localStorage.removeItem(k);
  }, DAY());
  const lad = { xp: 1900, rank: 4, today: 0 };
  await answer(page, 'store', lad, null);
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  const open = () => page.evaluate(() => window.__town.room.calls('store').map((c) => c.kind));
  expect(await open(), 'before the pass has said anything: the day’s three calls are in').toEqual(['restock', 'serve', 'deliver']);
  const to = await page.evaluate(() => window.__town.deliver.to());
  expect(to.length, 'the fourth rank: two parcels').toBe(2);

  // ── inside, before the answer: two bare faces and the crates lit, the parcel on the floor, a customer comes in
  await page.evaluate(() => window.__town.rooms.enter('store'));
  const full = await page.evaluate(() => window.__town.rooms.of('store').full.length);
  await page.waitForFunction((f) => window.__town.room.shelf().length === f - 2, full, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.room.hints()), 'the crates are lit').toEqual(['overcr1', 'overcr2']);
  await page.waitForFunction(() => window.__town.deliver.shown().box, null, { timeout: 5000 });
  await page.waitForFunction(() => !!window.__town.serve, null, { timeout: 10000 });
  await page.evaluate(() => window.__town.serve.arriveNow());
  await page.waitForFunction(() => !!window.__town.serve.want(), null, { timeout: 8000 });

  // ── the answer lands while you stand there (a pull, an hour after the phone): the phone filled the faces, served the
  // day's two customers (one a basket) and took both parcels to their doors
  await answer(page, 'store', lad, { k: { restock: 2, serve: 1, basket: 1, deliver: 2 }, g: { serve: 2, basket: 2 }, to: { deliver: to }, up: true, d: ISO() });
  await page.waitForFunction((f) => window.__town.room.shelf().length === f, full, { timeout: 5000 });
  await page.waitForFunction(() => window.__town.room.hints().length === 0, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.room.hints()), '⭐ no crate is lit: the rows the phone put out are on this shelf').toEqual([]);
  await page.waitForFunction(() => !window.__town.deliver.shown().box, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.deliver.state()), '⭐ both parcels are at their doors here too').toMatchObject({ n: 2, of: 2, carry: 0 });
  expect(await open(), '⭐ nothing is open: the phone did the day').toEqual([]);
  await page.waitForFunction((l) => window.__town.duties.line() === l, DUTY.answered, { timeout: 5000 });
  await page.screenshot({ path: SHOT + 'store.png' });

  // ── out and back in: the customer who was waiting has gone, and nobody else comes for an answered call
  await page.evaluate(() => window.__town.rooms.exit());
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__town.serve.arriveNow());
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => window.__town.serve.want()), 'no customer: the day’s two were served on the phone').toBeNull();
  expect(await page.evaluate(() => window.__town.room.shelf().length), 'and the shelf is still full').toBe(full);
  expect(errs).toEqual([]);
});

test('📦 one of two parcels taken on the phone: the laptop picks up only the other, names its door, and tells the pass whose door', async ({ page }) => {
  test.setTimeout(90000);
  const { errs, chores } = await town(page);
  await page.evaluate((d) => { localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: ['deliver'] })); localStorage.removeItem('tw-deliver-v1'); }, DAY());
  const lad = { xp: 1900, rank: 4, today: 0 };
  await answer(page, 'store', lad, null);
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  const to = await page.evaluate(() => window.__town.deliver.to());
  await answer(page, 'store', lad, { k: { deliver: 1 }, g: {}, to: { deliver: [to[0]] }, up: true, d: ISO() });
  expect(await page.evaluate(() => window.__town.deliver.state()), 'the phone’s door is done here').toMatchObject({ n: 1, of: 2 });
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => window.__town.deliver.shown().box, null, { timeout: 5000 });
  await goTo(page, await page.evaluate(() => window.__town.deliver.parcelAt()));
  await page.waitForFunction(() => window.__town.deliver.shown().held === 1, null, { timeout: 5000 });
  await toast(page, DELIVER.picked.replace('{to}', DELIVER.to[to[1]]));
  await page.evaluate(() => window.__town.rooms.exit());
  await page.waitForFunction(() => window.__town.deliver.shown().marker === 1, null, { timeout: 5000 });
  await page.screenshot({ path: SHOT + 'parcel-rest.png' });
  const door = (await page.evaluate(() => window.__town.deliver.doors()))[1];
  await goTo(page, door, 20);
  await page.waitForFunction(() => window.__town.deliver.state().n === 2, null, { timeout: 5000 });
  await toast(page, DELIVER.delivered.replace('{to}', DELIVER.to[to[1]]));
  await expect.poll(() => chores.filter((c) => c.kind === 'deliver').map((c) => c.to), { timeout: 3000, message: 'the pass hears whose door' }).toEqual([to[1]]);
  expect(errs).toEqual([]);
});

test('📦 a parcel delivered from a page that did not say whose door (one loaded before the doors were kept) still counts', async ({ page }) => {
  test.setTimeout(90000);
  const { errs } = await town(page);
  await page.evaluate((d) => { localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: ['deliver'] })); localStorage.removeItem('tw-deliver-v1'); }, DAY());
  const lad = { xp: 950, rank: 3, today: 0 };
  await answer(page, 'store', lad, null);
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  await page.evaluate(() => window.__town.rooms.enter('store'));
  await page.waitForFunction(() => window.__town.deliver.shown().box, null, { timeout: 5000 });
  await answer(page, 'store', lad, { k: { deliver: 1 }, g: {}, to: {}, up: true, d: ISO() });
  await page.waitForFunction(() => !window.__town.deliver.shown().box, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.deliver.state()), 'the day’s one parcel is at its door').toMatchObject({ n: 1, of: 1, carry: 0 });
  expect(await page.evaluate(() => window.__town.room.calls('store')), 'and its call answered').toEqual([]);
  expect(errs).toEqual([]);
});

test('✉️ the post office: the letters the phone delivered are out of the satchel the laptop is handed', async ({ page }) => {
  test.setTimeout(90000);
  const { errs } = await town(page);
  await page.evaluate(() => localStorage.removeItem('tw-round-v1'));
  const lad = { xp: 3500, rank: 5, today: 0 };
  await answer(page, 'post', lad, null);
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  const to = await page.evaluate(() => window.__town.deliver.run('round').to());
  expect(to.length, 'a satchel is three letters').toBe(3);
  await answer(page, 'post', lad, { k: { sort: 1, letter: 1 }, g: { sort: 60 }, to: { letter: [to[0]] }, up: true, d: ISO() });
  expect(await page.evaluate(() => window.__town.deliver.give('round')), 'a round that counts on the laptop: the satchel is handed over').toBe(true);
  await page.waitForFunction(() => window.__town.deliver.run('round').shown().held === 2, null, { timeout: 5000 });
  await toast(page, DELIVER.round.givenRest.replace('{to}', DELIVER.to[to[1]]).replace('{to2}', DELIVER.to[to[2]]));
  await page.waitForFunction(() => window.__town.deliver.run('round').shown().marker === 2, null, { timeout: 5000 });
  await page.screenshot({ path: SHOT + 'satchel-rest.png' });
  expect(errs).toEqual([]);
});

test('✉️ …and with two of the three delivered on the phone, the satchel holds the last letter', async ({ page }) => {
  test.setTimeout(90000);
  const { errs } = await town(page);
  await page.evaluate(() => localStorage.removeItem('tw-round-v1'));
  const lad = { xp: 3500, rank: 5, today: 0 };
  await answer(page, 'post', lad, null);
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  const to = await page.evaluate(() => window.__town.deliver.run('round').to());
  await answer(page, 'post', lad, { k: { sort: 1, letter: 2 }, g: { sort: 60 }, to: { letter: [to[2], to[0]] }, up: true, d: ISO() });
  expect(await page.evaluate(() => window.__town.deliver.give('round'))).toBe(true);
  await page.waitForFunction(() => window.__town.deliver.run('round').shown().held === 1, null, { timeout: 5000 });
  await toast(page, DELIVER.round.givenLast.replace('{to}', DELIVER.to[to[1]]));
  // and once all three are at their doors on the phone, no satchel is handed over at all
  await answer(page, 'post', lad, { k: { sort: 1, letter: 3 }, g: { sort: 60 }, to: { letter: [to[2], to[0], to[1]] }, up: true, d: ISO() });
  await page.waitForFunction(() => window.__town.deliver.run('round').shown().held === 0, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.deliver.run('round').state()), 'the round is done here too').toMatchObject({ n: 3, of: 3, carry: 0 });
  expect(await page.evaluate(() => window.__town.deliver.give('round')), 'nothing left to hand over').toBe(false);
  expect(errs).toEqual([]);
});

test('🚌 the morning mail bag the phone brought in is not waiting at the bus stop on the laptop', async ({ page }) => {
  test.setTimeout(90000);
  const { errs } = await town(page);
  await page.evaluate(() => localStorage.removeItem('tw-bus-v1'));
  const lad = { xp: 5300, rank: 6, today: 0 };
  await answer(page, 'post', lad, null);
  await page.waitForFunction(() => !!window.__town.deliver, null, { timeout: 10000 });
  await page.evaluate(() => window.__town.life.set(1));   // the morning
  await page.waitForFunction(() => window.__town.deliver.run('bus').shown().box, null, { timeout: 5000 });
  await answer(page, 'post', lad, { k: { bag: 1 }, g: {}, to: { bag: ['stamp'] }, up: true, d: ISO() });
  await page.waitForFunction(() => !window.__town.deliver.run('bus').shown().box, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__town.deliver.run('bus').state()), '⭐ the post is in, here too').toMatchObject({ n: 1, of: 1, carry: 0 });
  await page.screenshot({ path: SHOT + 'bus.png' });
  expect(errs).toEqual([]);
});

test('☕ the café’s rush is once a day on every device: the phone had it, the laptop has none', async ({ page }) => {
  test.setTimeout(90000);
  const { errs } = await town(page);
  await page.evaluate(() => localStorage.removeItem('tw-rush-v1'));
  const lad = { xp: 300, rank: 2, today: 0 };
  await answer(page, 'cafe', lad, null);
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.waitForFunction(() => !!window.__town.room.cafe(), null, { timeout: 10000 });
  expect(await page.evaluate(() => window.__town.room.cafe().rushed()), 'before the pass has said anything: today’s rush is still to come').toBe(false);
  await answer(page, 'cafe', lad, { k: { cup: 6, rush: 1 }, g: { cup: 2, rush: 0 }, to: {}, up: true, d: ISO() });
  expect(await page.evaluate(() => window.__town.room.cafe().rushed()), '⭐ the phone had today’s rush').toBe(true);
  expect(errs).toEqual([]);
});

// the pager on another page has no job answer of its own: today's work reaches it on the pull every page makes on load
const PULL_BLOB = { pass: { created: Date.now() - 30 * 864e5, patches: {}, base: {}, led: {} }, shelf: [], shelfDel: {} };
const PHONE_SWEPT = { at: 'condo', fired: null, since: 1000, today: { k: { sweep: 1, fix: 1 }, g: { fix: 2 }, to: {}, up: true } };
async function park(page, pull) {
  const w = await laptop(page, pull);
  await page.addInitScript((d) => {
    window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]);
    if (sessionStorage.getItem('day-seeded')) return;
    sessionStorage.setItem('day-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('cookie-consent-v1', 'n');
    localStorage.setItem('pass-link', JSON.stringify({ credId: 'qa-laptop', token: 'qa-token' }));
    localStorage.setItem('tw-job-v1', JSON.stringify({ at: 'condo', week: '', days: 0 }));
    localStorage.setItem('tw-arcade-v1', JSON.stringify({ d, swept: [], fixed: [] }));
    localStorage.setItem('tw-calls-v1', JSON.stringify({ d, t0: Date.now() - 36e5, qa: ['sweep', 'fix'] }));
  }, DAY());
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/park/?towntest', { waitUntil: 'domcontentloaded' });
  return w;
}
const rings = (page) => page.evaluate(() => window.__ev.filter((e) => e[0] === 'town_staff' && e[1].act === 'ring').length);

test('📟 the pager in the park: the pull’s answer says the phone swept and repaired — the ring stops', async ({ page }) => {
  test.setTimeout(60000);
  let release;
  const held = new Promise((ok) => { release = ok; });
  const { errs } = await park(page, async (r) => { await held; await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ blob: PULL_BLOB, job: PHONE_SWEPT }) }); });
  await page.waitForFunction(() => window.__pager && !window.__pager.hidden(), null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__pager.line()), 'before the answer: the sweep call rings').toBe(DUTY.call.sweep);
  release();
  await page.waitForFunction(() => window.__pager.hidden(), null, { timeout: 5000 });
  const mirror = await page.evaluate(() => JSON.parse(localStorage.getItem('tw-job-v1')));
  expect(mirror.today, '⭐ the job’s mirror holds what the phone did today').toMatchObject({ k: { sweep: 1, fix: 1 }, up: true, d: new Date().toISOString().slice(0, 10) });
  await page.screenshot({ path: SHOT + 'pager-quiet.png' });
  expect(errs).toEqual([]);
});

test('📟 …and a page that loads after the phone’s work never rings at all: the first ring waits for the load’s answer', async ({ page }) => {
  test.setTimeout(60000);
  const { errs } = await park(page, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ blob: PULL_BLOB, job: PHONE_SWEPT }) }));
  await page.waitForFunction(() => !!window.__pager, null, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('tw-job-v1')) || {}).today ? 1 : 0), { timeout: 8000, message: 'the load’s pull answered' }).toBe(1);
  await page.waitForTimeout(4500);   // the pager's own beat, and then some
  expect(await page.evaluate(() => window.__pager.hidden()), 'no ring for work the phone did').toBe(true);
  expect(await rings(page), 'and Pulse heard none').toBe(0);
  expect(errs).toEqual([]);
});

// ── the calls themselves, read in node: the same days on every device of a person, and the hire day from the pass
test('🪪 two logins of one person draw the same days of calls; the hire day is the pass’s; a task the pass counted is answered', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.location = { search: '' };
  const { calls } = await import('../src/lib/work-calls.js');
  const fortnight = (cred, gid) => {
    store.clear();
    store.set('pass-link', JSON.stringify({ credId: cred, token: 't' }));
    if (gid) store.set('world-gid', gid);
    store.set('tw-job-v1', JSON.stringify({ at: 'condo', lad: { rank: 1 } }));
    const out = [];
    for (let i = 0; i < 14; i++) out.push(calls('condo', Date.UTC(2026, 9, 5 + i, 12)).map((c) => c.kind).join('+') || '-');
    return out.join(' ');
  };
  const phone = fortnight('qa-phone', 'a1b2c3d4e5f60718'), laptop = fortnight('qa-laptop', 'a1b2c3d4e5f60718');
  expect(phone, '⭐ the phone and the laptop: the same fortnight of calls').toBe(laptop);
  expect(phone.replace(/[ -]/g, ''), 'a fortnight with calls in it').not.toBe('');
  expect(fortnight('qa-phone') === fortnight('qa-laptop'), 'what each login drew before: a week of its own').toBe(false);

  // the hire day: the pass's own word for when the job began brings the day's calls at once, on a device that did not take it
  const now = Date.now();
  store.clear();
  store.set('tw-job-v1', JSON.stringify({ at: 'condo', since: now - 60000, lad: { rank: 1 } }));
  const hire = calls('condo', now);
  expect(hire.map((c) => c.kind), 'the hire day: all of it').toEqual(['sweep', 'fix']);
  expect(hire.every((c) => c.arrived), 'and in at once').toBe(true);
  // and what the pass counted today answers them here
  store.set('tw-job-v1', JSON.stringify({ at: 'condo', since: now - 60000, lad: { rank: 1 }, today: { k: { sweep: 1, fix: 1 }, g: {}, to: {}, up: true, d: new Date(now).toISOString().slice(0, 10) } }));
  expect(calls('condo', now).map((c) => c.done), 'both answered by the phone').toEqual([true, true]);
  // a mirror kept overnight says nothing about today
  store.set('tw-job-v1', JSON.stringify({ at: 'condo', since: now - 60000, lad: { rank: 1 }, today: { k: { sweep: 1, fix: 1 }, g: {}, to: {}, up: true, d: '2026-01-01' } }));
  expect(calls('condo', now).map((c) => c.done), 'yesterday’s word answers nothing').toEqual([false, false]);
  delete globalThis.localStorage; delete globalThis.location;
});

// 📅 THE TOWN'S DAY RIDES THE PASS (2 Oct 2026; Trym: "yes move those to the pass too"). Not job work, but the same complaint:
// the square's problems you put right, the ghosts you caught, the once-a-day lines and the arcade runs that paid world XP
// were this device's alone. The pull brings the phone's day (banana-pass.js joinTownDay); the square redraws without the
// problem the phone fixed, and this device's own fix goes back up with the next push (readTownDay).
test('🧹 the square: a problem put right on the phone comes off the board here, and the phone\'s ghosts, lines and runs count here too', async ({ page }) => {
  test.setTimeout(90000);
  let release;
  const held = new Promise((ok) => { release = ok; });
  let phoneDay = null;
  const { errs } = await town(page, async (r) => {
    await held;
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ blob: { ...PULL_BLOB, town: phoneDay } }) });
  });
  const pushes = [];
  await page.route(/banana-pass\.trymstene\.workers\.dev\/push/, async (r) => {
    try { pushes.push(JSON.parse(r.request().postData() || '{}')); } catch (e) {}
    await r.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.evaluate(() => { localStorage.removeItem('tw-fixed-v1'); localStorage.removeItem('tw-ghost-v1'); localStorage.removeItem('tw-told-v1'); localStorage.removeItem('tw-arcxp-v1'); window.__town.room.set(30); });
  await page.waitForFunction(() => window.__town.room.problems().length >= 2, null, { timeout: 10000 });
  const ids = await page.evaluate(() => window.__town.room.problems().map((q) => q.id));
  // ── the pull lands: the phone put the first one right, caught a ghost, heard a line, and played its dozen runs
  phoneDay = { d: Math.floor(Date.now() / 864e5), fixed: [ids[0]], ghosts: ['qa-ghost'], told: ['lamp'], arc: 12 };
  release();
  await page.waitForFunction((id) => !window.__town.room.problems().some((q) => q.id === id), ids[0], { timeout: 8000 });
  const kept = await page.evaluate(() => ({
    fixed: JSON.parse(localStorage.getItem('tw-fixed-v1') || '{}').ids || [],
    ghosts: JSON.parse(localStorage.getItem('tw-ghost-v1') || '{}').ids || [],
    told: JSON.parse(localStorage.getItem('tw-told-v1') || '{}').lamp || 0,
    arc: JSON.parse(localStorage.getItem('tw-arcxp-v1') || '{}').n || 0,
  }));
  expect(kept, '⭐ the phone\'s day is this device\'s day').toEqual({ fixed: [ids[0]], ghosts: ['qa-ghost'], told: 1, arc: 12 });
  expect(await page.evaluate((id) => window.__town.room.problems().some((q) => q.id === id), ids[1]), 'the rest of the board is still there').toBe(true);
  await page.screenshot({ path: SHOT + 'square.png' });
  // ── and this device's own fix goes up with the next push, beside the phone's
  await page.evaluate((id) => window.__town.room.fix(id), ids[1]);
  await expect.poll(() => pushes.map((b) => (b.blob && b.blob.town && b.blob.town.fixed) || []).pop() || [], { timeout: 20000, message: 'the push carries the day' })
    .toEqual([ids[0], ids[1]]);
  expect(errs).toEqual([]);
});
