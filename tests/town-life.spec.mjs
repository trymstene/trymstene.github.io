// 🏘️ TOWN LIFE — the walk (14 Sep 2026). The town is walked as a player against the built
// site under ?towntest, where the TownRoom's arithmetic runs in memory and the QA seam
// (window.__town.room) can push the town to any band and force a Curse Night. What the
// design says in prose is asserted here: the band drives the look, a problem is fixed by
// tapping and pays, the shop lands a piece in the homestead's shed, a night has ghosts,
// residents indoors and a vendor, and it ends. Screenshots of every state land in
// test-results/ for the eye (docs/design-library.md §13).
import { test, expect } from '@playwright/test';
import { OBJECTS, WHERE } from '../src/data/town/objects.js';
import { GHOSTS, ROAM } from '../src/data/town/ghosts.js';
import * as decorMod from '../src/data/decor.js';
import { OVERLAYS } from '../src/scripts/town-geo.js';
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };

const SHOT = 'test-results/town-';

// 📌 THE SQUARE REPORT LIVES UNDER THE TOWN-HEALTH METER (20 Sep 2026). Trym: "the Square Report
// sign is a bit unnecessary now that we have the Town Health Meter popup — can we move the Square
// Report content into the Town Health popup? And remove the sign?" So there is no board to open: the
// meter's card mounts an empty host and town-shop.js paints the report into it when the chunk lands.
// ⚠️ every walk that reads the report therefore has to WAIT for that, not for the card.
async function openReport(page) {
  await page.evaluate(() => window.__town.room.cards.health());
  await page.waitForFunction(() => !!document.querySelector('#twReport .tw-board2'), null, { timeout: 10000 });
  await page.waitForTimeout(120);
}
// 🔭 the whole town at 1:1 for the eye: the camera's transform is switched off and the view
// opened to the world's size for one shot, then everything is put back
async function overview(page, name, clip) {
  await page.setViewportSize({ width: 2300, height: 1500 });
  await page.addStyleTag({ content: '.tw-wrap{max-width:none!important;padding:0!important}.tw-stage{box-shadow:none!important;border:0!important}.tw-view{width:2200px!important;height:1300px!important}#twWorld{width:2200px!important;height:1300px!important;transform:none!important}', id: 'qa-overview' });
  await page.waitForTimeout(250);
  const v = page.locator('#twView');
  // a clip is a window on the view (an element shot ignores clips): the page is shot around it, at twice the size for the eye
  if (clip) { await page.evaluate(() => document.querySelectorAll('.tw-toast').forEach((t) => t.remove())); const b = await v.boundingBox(); await page.screenshot({ path: SHOT + name + '.png', clip: { x: b.x + clip.x, y: b.y + clip.y, width: clip.width, height: clip.height } }); }
  else await v.screenshot({ path: SHOT + name + '.png' });
  await page.evaluate(() => { const t = document.getElementById('qa-overview'); if (t) t.remove(); });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForTimeout(250);
}
// 🕰 THE DRAW, PINNED ON REQUEST (23 Sep 2026). What the square seeds for a player — the day's problems, where rubbish
// lies — is drawn from the owner id, the UTC day and the six-hour wave, and a fresh browser brings a fresh owner, so every
// run of these walks sees a different town. Two walks flaked on that (the boot pickup, the rubbish probe). To prove a walk
// does not depend on the draw, run it pinned: TOWN_CLOCK = a time (epoch ms or ISO) installs Playwright's clock there and
// lets it run; TOWN_GID = an owner id. E.g. TOWN_CLOCK=2026-09-24T12:00:00Z TOWN_GID=0bd84937 put litter on s19, 28 px from
// the arrival point, and boot picked it up before the step rule (town-room.js autoPick).
async function pinned(page) {
  const t = process.env.TOWN_CLOCK, g = process.env.TOWN_GID;
  if (t) await page.clock.install({ time: /^\d+$/.test(t) ? +t : t });
  if (g) await page.addInitScript((id) => { try { localStorage.setItem('world-gid', id); } catch (e) {} }, g);
}
async function town(page) {
  await pinned(page);
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  // the clock may be running a real night this minute: the walk asks for calm first
  await page.evaluate(() => window.__town.room.curse('none'));
  await page.evaluate(() => window.__town.life.set(12));   // and noon: every night has ghosts now, a walk asks for its own night
  await stand(page, 1360, 880);
  await page.waitForTimeout(600);
}
const seam = (page, fn, arg) => page.evaluate(fn, arg);
// put the banana somewhere: walking onto things picks them up, so a walk stands it on a measured empty spot first
const stand = (page, x, y) => page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = t.tgt.x = px; t.pos.y = t.tgt.y = py; }, [x, y]);
const setBand = async (page, v) => { await seam(page, (x) => window.__town.room.set(x), v); await page.waitForTimeout(700); };
// ⚠️ a STRING passed to evaluate is an expression — every call here is a function
const room = (page, prop, ...args) => page.evaluate(([p, a]) => { const r = window.__town.room; const v = r[p]; return typeof v === 'function' ? v(...a) : v; }, [prop, args]);

test('the band drives the look: abandoned, recovering, thriving', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  // the shim opens at the set point: Recovering, six problems, one dark lamp and one that stutters
  expect(await room(page, 'band')).toBe('recovering');
  expect((await room(page, 'life')).life).toBe(42);
  const p0 = await room(page, 'problems');
  const shut0 = await room(page, 'shut');
  const lamps0 = await room(page, 'lamps');
  const dim0 = Object.values(lamps0).filter((s) => s !== 'ok').length;
  expect(p0.length).toBe(6 + shut0.length + dim0);   // six, a shutter on every shut front, and EVERY dark or stuttering lamp
  expect(Object.values(lamps0).filter((s) => s === 'out').length).toBe(1);
  expect(Object.values(lamps0).filter((s) => s === 'flicker').length).toBe(1);
  // one mark per problem (six, plus a shutter on every shut front) and one per
  // strange object lying about by daylight
  expect(await page.locator('.tw-mark').count()).toBe(p0.length + (await room(page, 'objects')).length);
  // the stalls' signs are world things: on a phone they must not outgrow their stalls (Trym, 15 Sep: on iOS "way too big")
  for (const f of await page.evaluate(() => ['exchange', 'wheel'].map((k) => { const s = document.querySelector('.tw-plank[data-key="' + k + '"]').getBoundingClientRect(); const r = window.__town.PROPS[k].el.getBoundingClientRect(); return { k, sign: s.width, stall: r.width }; }))) expect(f.sign, f.k + ' sign vs stall').toBeLessThan(f.stall);
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 930; t.pos.y = t.tgt.y = 860; });
  await page.waitForTimeout(800);
  await page.locator('#twView').screenshot({ path: SHOT + 'phone-stalls.png' });
  // …and at desktop scale, the print shop's metal sign over the sprite's own, and the lemonade stand's plank
  await page.setViewportSize({ width: 1470, height: 880 });
  await stand(page, 1560, 1110);   // shot spots keep clear of every reach: a stand here must not eat a seeded thing
  await page.waitForTimeout(800);
  await page.locator('#twView').screenshot({ path: SHOT + 'desk-printshop.png' });
  await stand(page, 860, 660);
  await page.waitForTimeout(800);
  await page.locator('#twView').screenshot({ path: SHOT + 'desk-lemonade.png' });
  await page.setViewportSize({ width: 393, height: 852 });
  await stand(page, 1360, 880);   // back on the neutral spot before any count below
  await page.waitForTimeout(300);
  // the repair icon rides only over lamps; everything smaller glows instead
  expect(await page.locator('.tw-mark__ic').count()).toBe(p0.filter((q) => q.type === 'lamp').length);
  expect(await page.locator('.tw-state.is-todo').count()).toBeGreaterThanOrEqual(p0.filter((q) => q.type !== 'lamp').length);
  await page.screenshot({ path: SHOT + 'recovering.png' });
  await overview(page, 'recovering-all');

  // pushed to the floor, at night so the lamps mean something: Abandoned — ten problems, all three
  // shopfronts shut, the bin full, the fountain dry, crows, five dark lamps, no visitors
  await seam(page, () => window.__town.life.set(21));
  await setBand(page, 5);
  expect(await room(page, 'band')).toBe('abandoned');
  const shutA = (await room(page, 'shut')).sort();
  expect(shutA).toEqual(['cafe', 'info', 'store']);   // the store joined the lock 19 Sep: its shut front now matches the empty shelf it already had
  // the day's six, ONE SHUTTER PER SHUT FRONT, and every dark or stuttering lamp on top. The
  // shutters are counted from `shut` rather than written as a number because that is the rule:
  // a front the town shut is always a front you can raise (19 Sep — before that only the front the
  // day's event shut was guaranteed a fix, so a band-shut kiosk could sit there with nothing to tap)
  const probA = await room(page, 'problems');
  expect(probA.length).toBe(6 + shutA.length + Object.values(await room(page, 'lamps')).filter((s) => s !== 'ok').length);
  for (const k of shutA) expect(probA.some((q) => q.id === 'shutter:' + k)).toBe(true);
  expect((await room(page, 'full')).length).toBe(5);   // three street bins and two dumpsters, all full
  expect(await page.locator('.tw-tape').count()).toBe(6);   // all three fronts taped off, two bands each
  expect(await room(page, 'fountain')).toBe('dry');
  expect(await room(page, 'crows')).toBeGreaterThanOrEqual(3);
  expect(Object.values(await room(page, 'lamps')).filter((s) => s === 'out').length).toBe(5);
  expect(await room(page, 'visitors')).toBe(0);
  expect(await room(page, 'shelf')).toBeNull();   // Pip's store is shut
  // and the dark lamps are DARK: at most the three that still work show a halo
  const halos = await page.evaluate(() => [...document.querySelectorAll('.tw-state')].filter((el) => /s-lamp-/.test((el.querySelector('img') || {}).src || '') && getComputedStyle(el).display !== 'none').length);   // display, not visibility: a frame's own visible beats a hidden parent
  expect(halos).toBeLessThanOrEqual(3);
  expect(halos).toBeGreaterThanOrEqual(1);
  expect(await page.locator('.tw-state').count()).toBeGreaterThan(8);
  await page.screenshot({ path: SHOT + 'abandoned.png' });
  await overview(page, 'abandoned-all');

  // and to the top: Thriving — six things to do, everything open and lit, visitors, the full shelf
  await setBand(page, 95);
  expect(await room(page, 'band')).toBe('thriving');
  // ⭐ SIX, THE SAME AS EVERY OTHER BAND (19 Sep). A thriving town used to offer two things and was
  // the most boring place in the game at its best; worse, two fixes a day could never out-pay the
  // 14.4 a day it loses above the set point, so a solo player could not hold a good town up. What
  // changes with the band is the KIND of work, not the amount — and litter and crows are a player's
  // own, never the shared look, so the square still reads pristine to everyone walking through.
  // Plus, if today's event shut a front, the shutter you can raise on it (a closed door is always fixable).
  const shutT = await room(page, 'shut');
  const probT = await room(page, 'problems');
  expect(probT.length).toBe(6 + shutT.length);
  expect(probT.every((q) => q.type !== 'lamp' && q.type !== 'graffiti' && q.type !== 'fountain')).toBe(true);   // upkeep, not repair: nothing in a thriving town is BROKEN
  for (const k of shutT) expect(probT.some((q) => q.id === 'shutter:' + k)).toBe(true);
  expect(shutT.length).toBeLessThanOrEqual(1);
  expect((await room(page, 'full')).length).toBe(0);
  expect(await page.locator('.tw-tape').count()).toBe(2 * shutT.length);   // only a kiosk the day's event shut is taped off in a thriving town
  expect(await room(page, 'fountain')).toBe('on');
  expect(await room(page, 'visitors'), 'no baked statue-visitors any more: the crowd is living traffic (town-folk.js), 21 Sep').toBe(0);
  expect((await room(page, 'shelf')).length).toBe(7);   // basic 2 + common 2 + good 2 + rare 1
  expect(Object.values(await room(page, 'lamps')).every((s) => s === 'ok')).toBe(true);
  // the town's night: the lamps light and the décor glows
  await seam(page, () => window.__town.life.set(21));
  await page.waitForTimeout(1500);
  expect(await room(page, 'lit')).toBe(true);
  expect(await room(page, 'night')).toBeGreaterThan(0.3);
  await page.screenshot({ path: SHOT + 'thriving-night.png' });
  await overview(page, 'thriving-night-all');
  // hysteresis: three points under the line is still the band it was
  await setBand(page, 83);
  expect(await room(page, 'band')).toBe('thriving');
  await setBand(page, 80);
  expect(await room(page, 'band')).toBe('lively');
  expect(errors, 'page errors: ' + errors.join(' | ')).toEqual([]);
});

test('a fix clears the mark, pays on the pass and counts on the room', async ({ page }) => {
  await town(page);
  const before = await room(page, 'coins');
  const before0 = (await room(page, 'problems')).length;
  const p = (await room(page, 'problems')).find((q) => q.type !== 'crows');   // crows flap off: their moment is the flight, not the burst
  expect(p).toBeTruthy();
  // walk up and tap it, the way a player does: the tap lands on the mark's world spot
  await seam(page, (id) => window.__town.room.fix(id), p.id);
  // the moment: a burst at the thing, not the puff (an overview here would scroll the page out from under the
  // clicks below — the shot of it is in the clean-up walk)
  expect(await page.locator('.tw-burst').count()).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(600);
  const after = await room(page, 'problems');
  expect(after.find((q) => q.id === p.id)).toBeUndefined();
  // the health bar moved (the park's bar, the town's number) and the clock reads m:ss
  const hb = await room(page, 'hbar');
  expect(hb.used).toBe(1);
  expect(parseFloat(hb.fill)).toBeGreaterThan(42);
  expect(hb.pct).toMatch(/^\d+%$/);
  // tap the bar: the park's health card, with the five bands as zones
  await page.click('.tw-hbar');
  await page.waitForTimeout(300);
  expect(await page.locator('.tw-bbar .tw-bzone').count()).toBe(5);
  expect(await page.locator('#twBnum').textContent()).toMatch(/^\d+%$/);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(400);
  await page.locator('.tw-card').screenshot({ path: SHOT + 'health-card.png' });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.evaluate(() => document.getElementById('twCardX').click());
  expect(await room(page, 'clock')).toMatch(/^\d+:\d\d$/);
  expect(after.length).toBe(before0 - 1);
  expect(await room(page, 'fixed')).toContain(p.id);
  expect(await room(page, 'coins')).toBeGreaterThan(before);
  const L = await room(page, 'life');
  expect(L.life).toBeCloseTo(44, 1);
  expect(L.cap.used).toBe(1);
  // a reload keeps the fix (the day's memory on this device)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  expect((await room(page, 'problems')).find((q) => q.id === p.id)).toBeUndefined();
});

test('a Curse Night: dark sky, everyone in, ghosts and the vendor — and it ends', async ({ page }) => {
  await town(page);
  // ⚠️ the sky after a curse is the CLOCK's again (world-weather.js setKind(null)), and the clock has storms of its own:
  // the walk flaked on a night the real weather was a storm. What must come back is the sky as it was before the curse.
  const stormBefore = await page.evaluate(() => !!document.querySelector('.wx.is-storm'));
  // ⚠️ THE NIGHT IS A LAZY CHUNK (src/scripts/town-night.js, split out 20 Sep). It loads on the
  // evening beat, a Curse Night, an omen or a day ghost — and this test plants a cursed object at
  // NOON, which is none of those. Ask for it first, the way the shop's card does (shopReady): a walk
  // cannot assert a ghost into being while its chunk is still on the wire.
  expect(await page.evaluate(() => window.__town.room.nightReady()), 'the night is in hand').toBe(true);
  // by day first: a planted cursed thing stands in its purple fire (the eye's crop), then it is taken
  expect(await page.evaluate((id) => !!window.__town.room.story.plantObject(id, [1100, 1000]), OBJECTS[0].id)).toBe(true);
  await page.waitForTimeout(500);
  await overview(page, 'object-day', { x: 950, y: 810, width: 300, height: 260 });
  expect(await page.evaluate((id) => window.__town.room.take(id), OBJECTS[0].id)).toBe(true);
  // …and the curse rides along: see-through, purple fire at the feet
  expect(await room(page, 'cursedMe')).toBe(true);
  expect(await page.locator('.tw-me.is-cursed-me').count()).toBe(1);
  expect(['purple', 'bluefire', 'mirror', 'giant', 'cold', 'blink', 'tiny', 'unseen', 'twin', 'blaze']).toContain(await room(page, 'meFx'));   // and its own way with you
  expect(await page.locator('.tw-aura').count()).toBe((await room(page, 'objects')).length);
  await seam(page, () => window.__town.life.set(3));   // dawn, so "in" is a change
  await page.waitForTimeout(400);
  // a low-ish town keeps a seeded few indoors on an ordinary day: remember how many, the night sends ALL in
  const kept0 = (await seam(page, () => window.__town.life.kept())).length;
  expect(kept0).toBeLessThanOrEqual(3);
  // the omens first: a night on its way shows in the world before it comes
  await seam(page, () => window.__town.room.curse('omen'));
  await page.waitForTimeout(900);
  expect(await room(page, 'omen')).toBe(true);
  expect(await room(page, 'crows')).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => [...document.querySelectorAll('.tw-state')].filter((el) => /s-crow-/.test((el.querySelector('img') || {}).src || '')).length)).toBeGreaterThanOrEqual(5);
  expect((await room(page, 'ghosts')).some((g) => g.id === 'wisp')).toBe(true);
  await openReport(page);
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(400);
  await page.locator('.tw-card').screenshot({ path: SHOT + 'board-omen.png' });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.evaluate(() => document.getElementById('twCardX').click());
  await seam(page, () => window.__town.room.curse('deep'));
  await page.waitForTimeout(1500);
  expect(await room(page, 'night')).toBeGreaterThanOrEqual(0.45);
  expect((await seam(page, () => window.__town.life.kept())).length).toBeGreaterThanOrEqual(8);
  const g = await room(page, 'ghosts');
  expect(g.map((x) => x.id).sort()).toEqual(['drift', 'knock', 'lead', 'repeat', 'roam', 'roam2', 'sit', 'wisp']);
  expect(await room(page, 'vendor')).toBe(true);
  expect((await room(page, 'shut')).sort()).toEqual(['cafe', 'info']);
  // the ghosts carry the purple too, weaker: every ghost is a haunt, and one is cropped for the eye
  const gh = await room(page, 'ghosts');
  expect(await page.locator('.tw-state.is-haunt').count()).toBeGreaterThanOrEqual(gh.length);
  for (const [i, g] of gh.slice(0, 4).entries()) await overview(page, 'ghost-' + i, { x: Math.max(0, g.x - 120), y: Math.max(0, g.y - 170), width: 240, height: 230 });
  // walked into, a ghost fades: stand on the one at the hall door, then step away
  const knock = gh.find((g) => g.id === 'knock');
  expect(knock, 'a deep night has the ghost at the hall door').toBeTruthy();
  await stand(page, knock.x, knock.y);
  await page.waitForTimeout(160);
  expect(await page.locator('.tw-state.is-gone').count(), 'a caught ghost un-forms').toBeGreaterThanOrEqual(1);   // the pack's forming frames, backwards
  await overview(page, 'catch', { x: Math.max(0, knock.x - 120), y: Math.max(0, knock.y - 170), width: 240, height: 230 });
  await page.waitForTimeout(500);
  expect((await room(page, 'ghosts')).find((g) => g.id === 'knock').hidden).toBe(true);
  await stand(page, 1360, 880);
  await room(page, 'nightSpawn');   // the night's things come through the night: the next one now (QA)
  await page.waitForTimeout(700);
  const objs = await room(page, 'objects');
  expect(new Set(objs.map((o) => o.x + ',' + o.y)).size).toBe(objs.length);   // never two on one spot
  // each stands in its purple fire: an aura on the ground, a flame behind, sparks in front
  expect(await page.locator('.tw-aura').count()).toBe(objs.length);
  expect(await page.locator('.tw-state.is-flame:not(.is-mefire)').count()).toBe(objs.length * 3);   // a flame behind, a lick in front, sparks (the fire at your own feet aside)
  for (const [i, o] of objs.slice(0, 2).entries()) await overview(page, 'object-' + i, { x: Math.max(0, o.x - 120), y: Math.max(0, o.y - 150), width: 240, height: 210 });
  expect(objs.length).toBeGreaterThanOrEqual(1);
  // the rain the night brings is the shared layer's storm
  expect(await page.evaluate(() => !!document.querySelector('.wx.is-storm'))).toBe(true);
  await page.waitForTimeout(2500);   // the residents cross to their doors
  await page.screenshot({ path: SHOT + 'curse-night.png' });
  await overview(page, 'curse-night-all');
  // a cursed object goes home as the ordinary thing it is, and the find is on the pass
  const o = objs[0];
  expect(await room(page, 'take', o.id)).toBe(true);
  expect(await room(page, 'found', o.id)).toBe(true);
  const hs = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1') || 'null'));
  expect(hs && hs.dirty).toBe(1);
  expect((hs.shed || []).length).toBeGreaterThanOrEqual(1);
  // the night ends: sky back, ghosts gone, vendor gone, residents out again
  await seam(page, () => window.__town.room.curse('none'));   // 'none' overrides a real night the clock may be running
  // ⚠️ POLLED, NEVER SLEPT. Ending a night is a chain — the next half-second tick sees the curse is
  // over, calls leaveCurse(), which clears the sky, the ghosts, the vendor AND the storm — and a fixed
  // 1500 ms was enough alone and not enough with a second worker on the machine. Same bug as the
  // lock walk, same fix: wait for the thing itself.
  await page.waitForFunction((sb) => window.__town.room.night() === 0
    && window.__town.room.ghosts().length === 0
    && !window.__town.room.vendor()
    && !!document.querySelector('.wx.is-storm') === sb, stormBefore, { timeout: 15000 });
  expect(await room(page, 'night')).toBe(0);
  expect((await room(page, 'ghosts')).length).toBe(0);
  expect(await room(page, 'vendor')).toBe(false);
  expect((await seam(page, () => window.__town.life.kept())).length).toBe(kept0);
  expect(await page.evaluate(() => !!document.querySelector('.wx.is-storm')), 'the curse’s storm is lifted: the sky is the clock’s again').toBe(stormBefore);
});

test('the store sells a piece for the homestead into the shed or onto the van', async ({ page }) => {
  await town(page);
  await setBand(page, 70);   // lively: six rows
  await seam(page, () => window.__town.room.rich());
  await seam(page, () => window.__town.room.cards.store());
  // ⚠️ POLLED, NEVER SLEPT. Pip's shelf is a LAZY CHUNK (town-shop.js) and 300 ms was enough alone
  // and not enough with the machine loaded — the rows had not been built yet and the count was 0.
  // toHaveCount retries by itself, which is the whole reason it exists.
  const rows = page.locator('[data-town-buy]');
  await expect(rows).toHaveCount(6, { timeout: 10000 });
  const enabled = page.locator('[data-town-buy]:not([disabled])');
  expect(await enabled.count()).toBeGreaterThan(0);
  const id = await enabled.first().getAttribute('data-town-buy');
  const coins0 = await room(page, 'coins');
  await page.screenshot({ path: SHOT + 'store.png' });
  await enabled.first().click();
  await page.waitForFunction((c) => window.__town.room.coins() < c, coins0, { timeout: 10000 });
  expect(await room(page, 'coins')).toBeLessThan(coins0);
  const hs = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1') || 'null'));
  const landed = [...(hs.shed || []).map((x) => x.id), ...(hs.orders || []).map((x) => x.id)];
  expect(landed).toContain(id);
  expect(hs.dirty).toBe(1);
  // the notice board opens with today's tally
  await openReport(page);
  await page.waitForTimeout(200);
  expect(await page.locator('.tw-tally b').count()).toBe(3);
  // the report lists what wants doing today, one entry per kind of thing open (or one line when nothing is)
  const kinds = new Set((await room(page, 'problems')).map((q) => q.type)).size;
  expect(((await page.locator('.tw-todo').textContent()) || '').split(' · ').length).toBe(Math.max(1, kinds));
  expect(await page.locator('.tw-stamp').count()).toBe(0);
  expect(await page.locator('.tw-paper--news').count()).toBe(0);   // an ordinary noon: no night notice; the nights are Moss's to tell
  expect(await page.locator('.tw-forsale').count()).toBe(0);   // 🏷 the Coffee Cup's FOR SALE sign came down (Trym, 22 Sep): nothing sells it
  expect((await page.evaluate(() => window.__town.life.talk('moss'))).topics.length).toBe(3);   // his two, and the nights
  expect(await page.locator('#twReport .tw-lamps').count()).toBe(1);   // 📌 the report is mounted under the meter now, not in a board card
  await page.screenshot({ path: SHOT + 'board.png' });
  // and the board at a desktop width, the card alone
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(400);
  await page.locator('.tw-card').screenshot({ path: SHOT + 'board-desktop.png' });
  await page.setViewportSize({ width: 393, height: 852 });
});

test('a container fixed is a clean-up: the litter round it goes too', async ({ page }) => {
  await town(page);
  await setBand(page, 5);   // abandoned: every container full
  const id = (await room(page, 'plant', 'bin')) || ((await room(page, 'problems')).find((q) => q.type === 'bin') || {}).id;
  expect(id).toBeTruthy();
  const c = (await room(page, 'problems')).find((q) => q.id === id);
  const near1 = await room(page, 'plant', 'litter', [c.x - 60, c.y - 40]);
  const near2 = await room(page, 'plant', 'litter', [c.x + 70, c.y + 10]);
  const far = await room(page, 'plant', 'litter', [c.x + 400, c.y]);
  const flyers = await page.evaluate(() => window.__town.life.flyers());
  const swept = flyers.filter((f) => Math.hypot(f.x - c.x, f.y - c.y) < 170).length;
  await seam(page, (x) => window.__town.room.fix(x), id);
  await overview(page, 'burst', { x: Math.max(0, c.x - 150), y: Math.max(0, c.y - 170), width: 300, height: 240 });   // mid-burst, for the eye
  await page.waitForTimeout(900);
  const ids = (await room(page, 'problems')).map((q) => q.id);
  expect(ids).not.toContain(id);
  expect(ids).not.toContain(near1);
  expect(ids).not.toContain(near2);
  expect(ids).toContain(far);
  expect(await room(page, 'full')).not.toContain(c.key);
  expect(await page.evaluate(() => window.__town.life.litter())).toBe(flyers.length - swept);
});

// 🔮 a cursed thing must be SEEN: every spot it can stand on is measured clear of every prop's box (15 Sep: the
// first spots sat under the dumpsters, the square benches, the garden boxes, a tree and the info kiosk)
test('every cursed-object spot stands clear of every prop', () => {
  for (const [place, spots] of Object.entries(WHERE)) for (const [sx, sy] of spots) {
    const hit = OVERLAYS.find(([fn, x, y, w, h]) => sx + 22 > x - 8 && sx - 22 < x + w + 8 && sy + 6 > y - 8 && sy - 72 < y + h + 8);
    expect(hit, place + ' ' + sx + ',' + sy + ' is under ' + (hit ? (hit[6] || hit[0]) : '')).toBeUndefined();
  }
});

// 👻 a ghost must be SEEN too: where it stands, walks or ends, no prop with a deeper foot covers its body
// (z, when a row has one, is the depth it is drawn at — a sitter drawn in front of its bench)
test('every ghost stands, walks and ends where it can be seen', () => {
  const covered = (x, y, z) => OVERLAYS.find(([fn, bx, by, bw, bh, base]) => base > z && x + 20 > bx && x - 20 < bx + bw && y > by && y - 70 < by + bh);
  for (const d of GHOSTS) {
    const pts = [];
    if (d.at) pts.push(d.at);
    if (d.from) pts.push(d.from);
    if (d.to) pts.push(d.to);
    if (d.path) { const [a, b] = d.path; const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 30); for (let i = 0; i <= n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); }
    for (const [x, y] of pts) { const hit = covered(x, y, d.z != null ? d.z : y); expect(hit, d.id + ' at ' + Math.round(x) + ',' + Math.round(y) + ' is under ' + (hit ? (hit[6] || hit[0]) : '')).toBeUndefined(); }
  }
  for (const [x, y] of ROAM) { const hit = covered(x, y, y); expect(hit, 'roam waypoint ' + x + ',' + y + ' is under ' + (hit ? (hit[6] || hit[0]) : '')).toBeUndefined(); }
});

// 🚶 walking onto a thing picks it up; a lamp is a repair and waits for the tap (Trym, 15 Sep)
test('walking onto a thing picks it up; a lamp waits for a tap', async ({ page }) => {
  await town(page);
  await setBand(page, 5);   // abandoned: plenty lying about
  const lit = await room(page, 'plant', 'litter', [1100, 1000]);
  await stand(page, 1100, 1004);
  await page.waitForTimeout(700);
  expect((await room(page, 'problems')).map((q) => q.id)).not.toContain(lit);
  // a lamp: stand at its foot and nothing happens
  const lampId = ((await room(page, 'problems')).find((q) => q.type === 'lamp') || {}).id || await room(page, 'plant', 'lamp');   // the day's seed may not have picked one: plant it
  const lamp = (await room(page, 'problems')).find((q) => q.id === lampId);
  expect(lamp, 'a dark lamp to fix').toBeTruthy();
  await stand(page, lamp.x, lamp.y + 26);
  await page.waitForTimeout(700);
  expect((await room(page, 'problems')).map((q) => q.id)).toContain(lamp.id);
  // a flyer under the feet goes too, and pays its point
  const fl = await page.evaluate(() => window.__town.life.flyers());
  expect(fl.length).toBeGreaterThan(0);
  await stand(page, fl[0].x, fl[0].y);
  await page.waitForTimeout(700);
  expect((await page.evaluate(() => window.__town.life.flyers())).find((q) => q.i === fl[0].i)).toBeUndefined();
  // a full bin: standing in front of it empties it
  const bin = (await room(page, 'problems')).find((q) => q.type === 'bin' || q.type === 'dumpster') || null;
  const bid = bin ? bin.id : await room(page, 'plant', 'bin');
  const b = (await room(page, 'problems')).find((q) => q.id === bid);
  await stand(page, b.x, b.y + 26);
  await page.waitForTimeout(900);
  expect(await room(page, 'full')).not.toContain(b.key);
});

// 👻 every night has its ghosts (Trym, 15 Sep), and dawn takes them
test('every night has its ghosts, and dawn takes them', async ({ page }) => {
  await town(page);
  await setBand(page, 90);   // Thriving — and no baked statue-visitor stands about by day any more (21 Sep: the crowd is living traffic)
  expect(await room(page, 'visitorsOut')).toBe(0);
  await seam(page, () => window.__town.life.set(21));   // the town's night
  await page.waitForTimeout(1400);   // the room looks twice a second
  const ids = (await room(page, 'ghosts')).map((g) => g.id);
  for (const id of ['roam', 'drift', 'sit', 'wisp']) expect(ids, 'the night set').toContain(id);
  expect(await room(page, 'night')).toBeGreaterThanOrEqual(0.5);
  expect(await room(page, 'visitorsOut')).toBe(0);   // nobody stands about at night
  // the night's things come through it: the next one now (QA), with its wisp and a blooming aura
  await room(page, 'nightSpawn');
  await page.waitForTimeout(700);
  expect((await room(page, 'objects')).filter((o) => !o.day).length, 'a plain night brings cursed things').toBeGreaterThanOrEqual(1);
  expect(await page.locator('.tw-aura.is-born').count()).toBeGreaterThanOrEqual(1);
  // the roamer roams, and faces the way it goes
  const r0 = (await room(page, 'ghosts')).find((g) => g.id === 'roam');
  await page.waitForTimeout(2500);
  const r1 = (await room(page, 'ghosts')).find((g) => g.id === 'roam');
  expect(Math.hypot(r1.x - r0.x, r1.y - r0.y)).toBeGreaterThan(10);
  expect(['right', 'left', 'front', 'back']).toContain(r1.face);
  await overview(page, 'roamer', { x: Math.max(0, r1.x - 120), y: Math.max(0, r1.y - 170), width: 240, height: 230 });
  await page.waitForTimeout(3000);
  const r2 = (await room(page, 'ghosts')).find((g) => g.id === 'roam');
  await overview(page, 'roamer2', { x: Math.max(0, r2.x - 120), y: Math.max(0, r2.y - 170), width: 240, height: 230 });
  // mischief: at rest a roamer makes work for you — one more problem than before, of a kind you can fix
  const n0 = (await room(page, 'problems')).length, mess0 = (await room(page, 'ghosts')).find((g) => g.id === 'roam').mess;   // it may have rested and messed already: every rest makes something now
  const did = await room(page, 'mischief');
  expect(['lamp', 'bin', 'dumpster', 'litter']).toContain(did);
  expect((await room(page, 'problems')).length).toBe(n0 + 1);
  expect((await room(page, 'ghosts')).find((g) => g.id === 'roam').mess).toBe(mess0 + 1);
  await overview(page, 'mischief', { x: Math.max(0, r2.x - 150), y: Math.max(0, r2.y - 170), width: 300, height: 240 });
  // and it keeps away: stand 90 px from it, and it puts ground between you.
  // ⚠️ POLL, DO NOT SLEEP. A roamer finishes the waypoint it is already walking to before it turns
  // away, so there is no fixed second by which it must have moved. A flat 2.2 s wait made this the one
  // flaky walk in the suite, and a flaky walk emails Trym a red build for nothing. The claim is that it
  // ends up farther away, not that it gets there inside any particular window.
  const r3 = (await room(page, 'ghosts')).find((g) => g.id === 'roam');
  await stand(page, r3.x + 90, r3.y);
  let away = 0;
  for (let i = 0; i < 12 && away <= 90; i++) {
    await page.waitForTimeout(600);
    const r = (await room(page, 'ghosts')).find((g) => g.id === 'roam');
    if (r) away = Math.hypot(r.x - (r3.x + 90), r.y - r3.y);
  }
  expect(away, 'a roamer keeps away from a banana').toBeGreaterThan(90);
  await stand(page, 1360, 880);
  await seam(page, () => window.__town.life.set(8));   // morning
  await page.waitForTimeout(1400);
  expect(await room(page, 'visitorsOut')).toBe(0);   // morning: still none baked — the living crowd is town-folk's to bring back
  const day = (await room(page, 'ghosts')).map((g) => g.id);
  expect(day).not.toContain('drift');
  expect(day).not.toContain('sit');
  expect((await room(page, 'objects')).filter((o) => !o.day).length, 'dawn takes the night\'s untaken thing').toBe(0);
});

// 🔮 every cursed object is a real piece of the homestead's decor, with a picture
test('every cursed object is a decor piece with a picture', () => {
  const rows = Object.values(decorMod).find(Array.isArray) || [];
  for (const o of OBJECTS) { const d = rows.find((r) => r.id === o.decor); expect(d, o.id + ' → ' + o.decor).toBeTruthy(); expect(typeof d.img).toBe('string'); }
});

// 🔁 THE DAY COMES IN WAVES (19 Sep 2026). A town you could empty and then had to leave until
// tomorrow was the whole repeatability problem (Trym: "high repeatability play throughout a normal
// 24h human day"). Six of your own things are open at a time and a fresh set is drawn about every
// six hours — but a thing you have already fixed must never be handed back, or the town is a
// treadmill rather than a place. The walk cannot wait six hours, so `nextWave` turns it by hand.
test('a new wave brings fresh work, and never hands back what you fixed', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await setBand(page, 95);   // thriving: no dark lamps, so the set is the drawn six alone
  // ⚠️ stand clear FIRST and read the two lists in ONE pass: walking onto a thing fixes it, so a
  // banana left near a front raises its shutter between the `shut` read and the `problems` read
  await stand(page, 1560, 1110);
  await page.waitForTimeout(400);
  const snap = () => page.evaluate(() => ({ shut: window.__town.room.shut(), ids: window.__town.room.problems().map((p) => p.id) }));
  const a = await snap();
  const first = a.ids;
  expect(first.length).toBe(6 + a.shut.length);

  // fix two of them, then turn the wave
  const done = first.filter((id) => !id.startsWith('shutter:')).slice(0, 2);
  for (const id of done) await seam(page, (x) => window.__town.room.fix(x), id);
  await page.waitForTimeout(400);
  const w0 = await room(page, 'wave');
  const w1 = await seam(page, () => window.__town.room.nextWave());
  expect(w1).toBe(w0 + 1);
  await page.waitForTimeout(600);

  const b = await snap();
  const second = b.ids;
  expect(second.length).toBe(6 + b.shut.length);   // six again, not a backlog of ten
  for (const id of done) expect(second).not.toContain(id);             // ⭐ what you fixed stays fixed
  expect(second.filter((id) => !first.includes(id)).length).toBeGreaterThan(0);   // and there is genuinely new work
  expect(errors).toEqual([]);
});

// 🚪 A SHUT DOOR SAYS WHY, and the two whys are not the same (19 Sep 2026). Today's event is a
// one-day fault with a name and somebody will see to it; the BAND is a town too low to keep its
// fronts open at all. Trym, on the whole gated town: "it must be well explained". A player who
// taps a dark shopfront and is told a bolt needs tightening has been told the wrong thing.
test('a shut door explains itself, and the reason picks the line', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await stand(page, 1560, 1110);   // clear of every reach: walking up to a front raises its shutter
  await setBand(page, 5);
  const copy = await page.evaluate(() => ({ low: window.__town.room.copyOf('lowShut'), day: window.__town.room.copyOf('closed') }));
  expect(copy.low.length).toBeGreaterThanOrEqual(3);
  // none of the town's own lines may name a number, a rate or an interval — the mystery rule
  for (const line of copy.low) expect(line).not.toMatch(/\d|hour|day|minute|week/i);

  const shut = await room(page, 'shut');
  expect(shut.length).toBeGreaterThanOrEqual(2);
  for (const k of shut) {
    const why = await room(page, 'shutWhy', k);
    await page.evaluate(() => { const t = document.getElementById('twToast'); t.textContent = ''; t.hidden = true; });
    await seam(page, (x) => window.__town.room.open(x), k);
    await page.waitForTimeout(250);
    const said = await page.evaluate(() => { const t = document.getElementById('twToast'); return t.hidden ? '' : t.textContent; });
    const pool = why === 'today' ? copy.day : copy.low;
    expect(pool.some((l) => said.includes(l)), `${k} (${why}) said: ${said}`).toBe(true);
  }
  expect(errors).toEqual([]);
});

// 🔧 A STREETLIGHT IS A JOB, AND THE REPORT MUST NOT LIE ABOUT ONE (19 Sep 2026). Three things Trym
// hit in live play, in one walk because they are one experience: he could not find where to tap, the
// repair was instant like a crisp packet, and fixing one of his two broken lamps made BOTH read as
// done on the Square Report ("both broken streetlight got fixed status-wise").
test('a streetlight: the whole lamp answers a tap, the repair takes time, and the report tells three states apart', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await seam(page, () => window.__town.life.set(21));   // night: the lamps mean something
  await stand(page, 1100, 1250);
  await setBand(page, 5);
  const lamp = (await room(page, 'problems')).find((q) => q.type === 'lamp');
  expect(lamp, 'an abandoned town has dark lamps').toBeTruthy();

  // ── the box has to cover what you can SEE. The tools icon bobs high on the post; before this the
  //    box stopped 64 px above the foot and the one visible affordance was not tappable at all.
  expect(await room(page, 'hit', lamp.x, lamp.y - 118)).toEqual(['room', 'p:' + lamp.id]);   // the icon
  expect(await room(page, 'hit', lamp.x, lamp.y)).toEqual(['room', 'p:' + lamp.id]);         // the foot
  expect(await room(page, 'hit', lamp.x + 50, lamp.y - 100)).toEqual(['room', 'p:' + lamp.id]);   // across the post
  // …and not the whole sky. ⚠️ NOT `toBeNull`: the square is full of other things, and a crow on a
  // bench 260 px up answered this about one run in four. What is being asserted is that the LAMP'S box
  // ends, not that the sky is empty.
  const sky = await room(page, 'hit', lamp.x, lamp.y - 260);
  expect(sky && sky[1]).not.toBe('p:' + lamp.id);

  // ── the repair is WORK: a bar fills, and the lamp is still broken while it does
  await room(page, 'tapAt', 'p:' + lamp.id);
  await seam(page, () => { window.__town.tgt.x = window.__town.pos.x; window.__town.tgt.y = window.__town.pos.y; });   // arrive, as a real walk does
  await page.waitForTimeout(500);
  expect(await page.locator('.tw-work').count()).toBe(1);
  expect((await room(page, 'problems')).some((q) => q.id === lamp.id), 'not fixed while the bar fills').toBe(true);
  const half = await room(page, 'work');
  expect(parseFloat(half.w)).toBeGreaterThan(0);
  expect(parseFloat(half.w)).toBeLessThan(60);
  await page.waitForTimeout(4400);
  expect((await room(page, 'problems')).some((q) => q.id === lamp.id), 'fixed once the bar is full').toBe(false);
  expect(await page.locator('.tw-work').count()).toBe(0);

  // ── walk away and the job stops where it stands: nothing spent, the lamp still there
  const next = (await room(page, 'problems')).find((q) => q.type === 'lamp');
  await room(page, 'tapAt', 'p:' + next.id);
  await seam(page, () => { window.__town.tgt.x = window.__town.pos.x; window.__town.tgt.y = window.__town.pos.y; });
  await page.waitForTimeout(300);
  expect(await page.locator('.tw-work').count()).toBe(1);
  await stand(page, 1100, 1250);
  await page.waitForTimeout(500);
  expect(await page.locator('.tw-work').count()).toBe(0);
  expect((await room(page, 'problems')).some((q) => q.id === next.id), 'the lamp is still there to come back to').toBe(true);

  // ── ⭐ THE REPORT TELLS THREE STATES APART. A stuttering lamp used to draw LIT with a fainter halo
  //    and no shading, which at sixteen pixels is indistinguishable from working.
  const lamps = await room(page, 'lamps');
  expect(Object.values(lamps).filter((s) => s === 'flicker').length, 'the walk needs a stuttering lamp').toBeGreaterThan(0);
  await openReport(page);
  await page.waitForTimeout(1200);
  const lum = await page.evaluate(() => {
    const cv = document.querySelector('.tw-lamps'), g = cv.getContext('2d');
    const st = window.__town.room.lamps(), keys = Object.keys(st), slot = cv.width / keys.length;
    const out = {};
    keys.forEach((k, i) => {
      const x = Math.round(i * slot + slot / 2);
      const d = g.getImageData(x - 16, 8, 32, cv.height - 16).data;
      let sum = 0, n = 0;
      for (let j = 0; j < d.length; j += 4) if (d[j + 3] > 8) { sum += 0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2]; n++; }
      (out[st[k]] = out[st[k]] || []).push(n ? sum / n : 0);
    });
    const avg = (a) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    return { ok: avg(out.ok), flicker: avg(out.flicker), out: avg(out.out) };
  });
  expect(lum.ok, 'a working lamp is the brightest cell').toBeGreaterThan(lum.flicker);
  expect(lum.flicker, 'a stuttering lamp still shows a halo, so it is not a dead one').toBeGreaterThan(lum.out);
  expect(errors).toEqual([]);
});

// 🚪 THE ARCADE, EXACTLY AS IT IS. Written before the rooms refactor and landed green on the old
// code on purpose: the arcade is the only interior the town has shipped, and the whole point of
// turning `inside` into a room key is that this walk does not notice. ⚠️ it sets `tgt` and lets the
// banana WALK — the spec's stand() helper writes pos directly and would teleport straight through
// the colliders this is here to prove.
test('the arcade: you step in, the walls hold you, and the door puts you back on the square', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  const box = await seam(page, () => window.__town.arcade.box());
  const spawn = await seam(page, () => window.__town.arcade.door() && window.__town.arcade.box());
  expect(box).toEqual([300, 120, 576, 432]);

  await seam(page, () => window.__town.arcade.enter());
  await page.waitForTimeout(800);
  const inState = await page.evaluate(() => ({
    inside: window.__town.arcade.inside(),
    marked: document.getElementById('twWorld').classList.contains('is-inside'),
    plate: !!document.querySelector('.tw-room:not([hidden])'),
    shade: !!document.querySelector('.tw-inshade:not([hidden])'),
    pos: { x: window.__town.pos.x, y: window.__town.pos.y },
    spots: window.__town.arcade.spots().length,
  }));
  expect(inState.inside).toBe(true);
  expect(inState.marked, 'the town wears .is-inside so its own props hide').toBe(true);
  expect(inState.plate && inState.shade, 'the plate floats over a shade').toBe(true);
  expect(inState.spots).toBe(11);
  // ⚠️ NOT equal to spawn: entering nudges the target a step into the room, so it is already walking
  expect(inState.pos.x).toBeGreaterThanOrEqual(box[0]);
  expect(inState.pos.x).toBeLessThanOrEqual(box[0] + box[2]);
  expect(inState.pos.y).toBeGreaterThanOrEqual(box[1]);
  expect(inState.pos.y).toBeLessThanOrEqual(box[1] + box[3]);

  // the room's own walls are the only colliders: aim at the back wall and stop short of it
  await seam(page, (b) => { window.__town.tgt.x = b[0] + b[2] / 2; window.__town.tgt.y = b[1] + 10; }, box);
  await page.waitForTimeout(1400);
  const atWall = await seam(page, () => ({ x: window.__town.pos.x, y: window.__town.pos.y }));
  expect(atWall.y, 'the wall band stops the banana').toBeGreaterThan(box[1] + 100);
  expect(atWall.y).toBeLessThan(box[1] + box[3]);

  // the doorway puts you back out on the square, at the arcade's own door
  const exit = await seam(page, () => window.__town.arcade.door());
  await seam(page, (e) => { window.__town.tgt.x = (e[0] + e[2]) / 2; window.__town.tgt.y = (e[1] + e[3]) / 2; }, exit);
  await page.waitForTimeout(2200);
  const outState = await page.evaluate(() => ({
    inside: window.__town.arcade.inside(),
    marked: document.getElementById('twWorld').classList.contains('is-inside'),
    pos: { x: window.__town.pos.x, y: window.__town.pos.y },
    door: { x: window.__town.SPOTS.condo.x, y: window.__town.SPOTS.condo.y },
  }));
  expect(outState.inside).toBe(false);
  expect(outState.marked).toBe(false);
  expect(Math.hypot(outState.pos.x - outState.door.x, outState.pos.y - (outState.door.y + 30)), 'back on the arcade’s own doorstep').toBeLessThan(60);
  expect(errors).toEqual([]);
});

// 🏪 PIP'S SHOP IS A PLACE YOU CAN STAND IN (19 Sep 2026). The second interior the town has ever
// had, and the one that proves `inside` becoming a room KEY was worth doing. Its first rule was "Pip's existing shelf
// card stays tappable at the door — the room is a gain, never a toll" (docs/town-jobs-plan.md §4).
// ⚠️ REVERSED 23 Sep 2026 (Trym: "right now when you click on the building, you get a popup with all the goods you can
// buy and a 'enter the store' button at the bottom of the popup - so this needs to move to inside the store instead since
// you can walk inside that store before anything happens"). A building with an inside is a DOOR (design library §22):
// a tap on the front opens nothing, walks the banana to the door and in, and the shelf is the counter's card.
test('the general store is a door: a tap walks you in with nothing at the front, and the shelf is on the counter inside', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await setBand(page, 70);   // lively: the store is open and the shelf has rows
  expect(await room(page, 'shut')).not.toContain('store');

  // ── the door: a REAL tap on the shopfront, from a few steps up the street
  const door = await seam(page, () => window.__town.SPOTS.store);
  await stand(page, door.x + 150, door.y + 70);
  await page.waitForTimeout(700);
  let front = null;
  for (let dy = 20; dy <= 160 && !front; dy += 10) {
    const hit = await seam(page, ([x, y]) => window.__town.thing(x, y), [door.x, door.y - dy]);
    if (hit && hit[1] === 'store') front = { x: door.x, y: door.y - dy };
  }
  expect(front, 'the shopfront answers a tap').not.toBeNull();
  const p = await page.evaluate(([x, y]) => { const w = document.getElementById('twWorld'), k = parseFloat(w.style.getPropertyValue('--ws')), r = w.getBoundingClientRect(); return { x: r.left + x * k, y: r.top + y * k }; }, [front.x, front.y]);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden), 'nothing opens at the front').toBe(true);
  expect(await page.locator('.tw-store').count(), 'no shelf at the door').toBe(0);
  expect(await seam(page, () => window.__town.rooms.now()), 'the banana walks to the door first').toBe('');
  await page.waitForFunction(() => window.__town.rooms.now() === 'store', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({
    now: window.__town.rooms.now(),
    marked: document.getElementById('twWorld').classList.contains('is-inside'),
    img: document.querySelector('.tw-room').style.backgroundImage,
    box: window.__town.rooms.of('store').box,
    pos: { x: window.__town.pos.x, y: window.__town.pos.y },
  }));
  expect(st.now).toBe('store');
  expect(st.marked).toBe(true);
  expect(st.img, '⚠️ the plate is re-dressed per room; it used to bake the first room in for ever').toContain('in-store.png');
  expect(st.pos.x).toBeGreaterThan(st.box[0]);
  expect(st.pos.x).toBeLessThan(st.box[0] + st.box[2]);
  expect(st.pos.y).toBeGreaterThan(st.box[1]);
  expect(st.pos.y).toBeLessThan(st.box[1] + st.box[3]);

  // ── the counter inside is where the shelf is, and its card carries no way "inside" any more
  await seam(page, () => window.__town.room.open('till'));
  await page.waitForTimeout(400);
  expect(await page.locator('.tw-store').count(), 'Pip’s shelf, on the counter').toBe(1);
  expect(await page.locator('.tw-card .tw-btn--in').count(), 'no "step inside" row: you are inside').toBe(0);
  // ⚠️ the store's arrival line was still up when the shelf opened, and sat on it: a line said before a card gives way
  const clash = await page.evaluate(() => { const t = document.getElementById('twToast'), c = document.querySelector('.tw-card').getBoundingClientRect(); if (t.hidden) return false; const r = t.getBoundingClientRect(); return r.bottom > c.top && r.top < c.bottom; });
  expect(clash, 'nothing said before the card sits on it').toBe(false);
  await seam(page, () => document.getElementById('twCardX').click());

  // ── the doorway puts you back on the shop's own doorstep
  const exit = await seam(page, () => window.__town.rooms.of('store').exit);
  await seam(page, (e) => { window.__town.tgt.x = (e[0] + e[2]) / 2; window.__town.tgt.y = (e[1] + e[3]) / 2; }, exit);
  await page.waitForTimeout(2400);
  const out = await page.evaluate(() => ({ now: window.__town.rooms.now(), pos: { x: window.__town.pos.x, y: window.__town.pos.y }, door: window.__town.SPOTS.store }));
  expect(out.now).toBe('');
  expect(Math.hypot(out.pos.x - out.door.x, out.pos.y - (out.door.y + 30)), 'back on the shop’s doorstep').toBeLessThan(60);

  // ── ⚠️ ONE PLATE, RE-KEYED: the arcade must still be the arcade after the store has worn it
  await seam(page, () => window.__town.arcade.enter());
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => document.querySelector('.tw-room').style.backgroundImage)).toContain('in-arcade.png');
  expect(await seam(page, () => window.__town.rooms.now())).toBe('condo');
  await seam(page, () => window.__town.rooms.exit());
  await page.waitForTimeout(600);

  // ── a shut front never offers the way in: it says why, and you stay on the street
  await setBand(page, 5);
  await page.waitForTimeout(600);
  expect(await room(page, 'shut')).toContain('store');
  await seam(page, () => window.__town.room.open('store'));
  await page.waitForTimeout(400);
  expect(await page.locator('.tw-btn--in').count(), 'a taped-off shop has no way in').toBe(0);
  expect(await seam(page, () => window.__town.rooms.now())).toBe('');
  expect(errors).toEqual([]);
});

// 📦 THE CARDS ARE A LAZY CHUNK (19 Sep 2026, Trym: "optimize and chunk things if needed for
// performance"). town-room had 2.2 KB left of its 56 000, so Pip's shelf, the stall, the vendor and
// the notice board moved into town-shop.js. It warms a beat after the square settles, so in normal
// play the tap takes the synchronous path — this walk holds the chunk back on the wire to prove the
// OTHER path, the one a player only meets on a bad connection: ⭐ a card must never silently do
// nothing, and a chunk that never arrives must not leave a blank card sitting there either.
test('a card opens even when its chunk is still on the wire, and a chunk that never comes closes its own frame', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let held = 0;
  await page.route('**/town-shop*.js', async (route) => { held++; await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
  await town(page);
  await setBand(page, 70);
  await seam(page, () => window.__town.room.open('store'));
  await page.waitForTimeout(120);
  // the frame is up on the same beat as the tap, and the shelf is not in it yet
  expect(await page.locator('#twPanel, .tw-panel').first().isVisible().catch(() => true)).toBeTruthy();
  expect(await page.locator('.tw-store').count(), 'the shelf has not arrived yet').toBe(0);
  // …and it fills itself the moment the chunk lands
  await page.waitForFunction(() => document.querySelectorAll('.tw-store').length === 1, null, { timeout: 8000 });
  expect(await page.locator('.tw-store').count()).toBe(1);
  expect(held, 'the chunk really was fetched over the wire').toBeGreaterThan(0);
  await seam(page, () => document.getElementById('twCardX').click());

  // once it is here, every later card is synchronous again
  await seam(page, () => window.__town.room.cards.health());
  await page.waitForTimeout(80);
  expect(await page.locator('.tw-board2').count(), 'the second card needs no wait at all').toBe(1);
  expect(errors).toEqual([]);
});

// …and the other half of that promise: a chunk that never arrives at all
test('a card whose chunk never arrives closes its own frame instead of sitting there blank', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/town-shop*.js', (route) => route.abort());
  await town(page);
  await setBand(page, 70);
  await seam(page, () => window.__town.room.open('store'));
  await page.waitForTimeout(1500);
  expect(await page.locator('.tw-store').count()).toBe(0);
  expect(await seam(page, () => document.getElementById('twPanel').hidden), 'the empty frame closed itself').toBe(true);
  expect(errors, 'a failed chunk is caught, never thrown at the page').toEqual([]);
});

// 🧺 HOW FULL THE SHOP LOOKS IS THE TOWN'S HEALTH (docs/town-jobs-plan.md §4). The store's plate was
// baked at its emptiest on purpose; the stocked faces are the pack's very same units with goods on
// them, laid over it. ONE FACE PER THING ON PIP'S SHELF TODAY, read from the same shelfFor() the card
// reads — so the room and the card cannot disagree, and there is no new state and no number anywhere.
// ⚠️ It also guards the invisible-sprite trap (design library §22): a sprite inside a room needs BOTH
// the .is-in class and the +2000 z, and getting either wrong shows nothing at all with no error.
test('the shop fills as the town heals, and its stock is the shelf', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  for (const band of [25, 50, 70, 95]) {
    await setBand(page, band);
    await seam(page, () => window.__town.rooms.enter('store'));
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.tw-state.is-in')];
      return {
        shelf: (window.__town.room.shelf() || []).length,
        faces: els.length,
        seen: els.filter((e) => getComputedStyle(e).visibility === 'visible').length,
        lowZ: Math.min(...els.map((e) => +e.style.zIndex)),
        plateZ: +getComputedStyle(document.querySelector('.tw-room')).zIndex,
      };
    });
    expect(st.faces, `band ${band}: one face per thing on the shelf`).toBe(st.shelf);
    expect(st.seen, `band ${band}: ⚠️ every face is actually VISIBLE — .is-in or the hide list blanks it`).toBe(st.faces);
    expect(st.lowZ, `band ${band}: ⚠️ above the room's own plate, or it is behind the picture`).toBeGreaterThan(st.plateZ);
    await seam(page, () => window.__town.rooms.exit());
    await page.waitForTimeout(300);
    expect(await page.locator('.tw-state.is-in').count(), 'the faces leave with the room').toBe(0);
  }
  // …and a town on its knees keeps its shop shut, so there is nothing to stock at all.
  // ⚠️ stand clear of the front first: leaving a room puts you on its doorstep, and a shutter is a
  // WALK-OVER fix, so a banana idling at the door raises the very shutter this is about to assert.
  await stand(page, 1100, 1250);
  await setBand(page, 5);
  await page.waitForTimeout(600);
  expect(await room(page, 'shut')).toContain('store');
  expect(await room(page, 'shelf')).toBeNull();
  expect(errors).toEqual([]);
});

// 🚧 YOUR LOCK, THE OTHER ONE (19 Sep 2026). The town has two kinds of closed door and a player
// must tell them apart without reading anything. The TOWN'S lock is the hazard belt and the red
// CLOSED sign: a bad day, and hands fix it. YOURS is a worksite fence and a signpost: the building
// is not built for you yet, and the STORY opens it (docs/town-jobs-plan.md §1).
//
// ⭐ THE FIRST ASSERTION IS THE IMPORTANT ONE. This ships OFF (`HOARD_ON = false` in
// src/data/town/locks.js) and must stay off until chapter 2 exists to open these fronts AND
// somebody has read how many players finish chapter 1. Flipping it early boards up the store, the
// post office and the café for everyone who never finished — the one outcome the plan forbids.
test('your lock: shipped off, and when it is on it wins the display and hands back cleanly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await setBand(page, 5);   // abandoned, so the town's own lock is up too and precedence is real
  expect(await room(page, 'hoarded'), '⭐ nothing is boarded in the shipped data').toEqual([]);
  const tapedNormally = await page.locator('.tw-tape').count();
  expect(tapedNormally, 'the town lock is doing its usual job').toBeGreaterThan(0);

  // ── switch it on with nothing opened: the three fronts board up, the arcade never
  // ⚠️ POLLED, NEVER SLEPT. Boarding a front reseeds the problems and redraws the tape, and a fixed
  // 700 ms was enough alone and not enough with a second worker on the machine — one run in three went
  // red and passed on retry. The ghost walk had exactly this bug and this is exactly its fix.
  const on = await seam(page, () => window.__town.room.locks(true, []));
  await page.waitForFunction(() => window.__town.room.hoarded().length === 3, null, { timeout: 10000 });
  expect(on.sort()).toEqual(['cafe', 'post', 'store']);
  expect(on, '⭐ the arcade is never boarded: five shipped games answer on a stranger’s worst day').not.toContain('condo');

  // ── precedence: your lock wins the display, so a boarded front wears no tape…
  expect(await page.locator('.tw-tape').count(), 'the tape gives way to the fence').toBeLessThan(tapedNormally);
  // …and hands out no shutter to fix, because you could not act on it either way.
  // ⚠️ EVERY WAVE, NOT JUST THIS ONE. The draw is weighted and seeded, so a boarded front that is
  // still a candidate only actually appears on the waves it happens to win — which is how this shipped
  // as a ONE-RUN-IN-THREE FLAKY WALK for a day instead of as the bug it was (fixed 20 Sep: the shutter
  // draw read cond.shut raw instead of shutNow, so the town's lock handed out a repair job on a
  // building behind your own worksite fence). Eight draws is enough that a surviving candidate cannot
  // hide behind the dice.
  for (let w = 0; w < 8; w++) {
    const probs = await room(page, 'problems');
    for (const k of on) expect(probs.some((q) => q.id === 'shutter:' + k), `${k} owes you no problem while it is yours to unlock (wave ${w})`).toBe(false);
    await seam(page, () => window.__town.room.nextWave());
  }

  // ── the signpost says three things, and the third is what makes it a hook
  await seam(page, () => window.__town.room.open('store'));
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden && (document.getElementById('twCardBody').textContent || '').length > 40, null, { timeout: 10000 });
  const card = await page.evaluate(() => document.getElementById('twCardBody').textContent);
  expect(await page.locator('.tw-lock').count()).toBe(1);
  expect(card.length).toBeGreaterThan(40);
  expect(card, 'how far along you are, not just a refusal').toMatch(/0\D+4/);
  await seam(page, () => document.getElementById('twCardX').click());

  // ── and once the story opens it, the front rejoins the shared weather like every other shop
  const left = await seam(page, () => window.__town.room.locks(true, ['store']));
  await page.waitForFunction(() => window.__town.room.hoarded().length === 2 && window.__town.room.problems().some((q) => q.id === 'shutter:store'), null, { timeout: 10000 });
  expect(left.sort()).toEqual(['cafe', 'post']);
  const probs2 = await room(page, 'problems');
  expect(probs2.some((q) => q.id === 'shutter:store'), 'the town’s lock takes over and it is fixable again').toBe(true);

  // ── and the switch really does put everything back
  await seam(page, () => window.__town.room.locks(null, null));
  await page.waitForFunction(() => window.__town.room.hoarded().length === 0, null, { timeout: 10000 });
  expect(await room(page, 'hoarded')).toEqual([]);
  expect(errors).toEqual([]);
});

// 💼 ASKING A BOSS FOR A JOB (19 Sep 2026, docs/town-jobs-plan.md §3). Five residents can hire
// you (Stamp and Fig Jr. since 22 Sep), and the question sits on their own dialogue card beside the two they already answer — no new
// card and no new button, because the world already had a way to ask somebody something.
//
// ⚠️ THE CARD TYPES A STRING, NEVER A PROMISE (world-dialogue.js). So the answer is chosen from a
// device-side MIRROR of the job while the request goes out behind it. The mirror picks the sentence
// and nothing else; worker-pass is the authority on the job and on every coin.
test('a boss can be asked for a job, and answers the right one of four lines', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  // ⚠️ NOT JUST `work`: the topic is null until the ROOM'S copy has landed too (topicFor returns
  // null without w.ask — a half-built question is worse than none), and under a parallel run that
  // second import can arrive a beat later. Waiting for the thing being asserted, not for its module.
  await page.waitForFunction(() => window.__town && window.__town.work && window.__town.work.ask('pip'), null, { timeout: 20000 });
  const bosses = await seam(page, () => window.__town.work.bosses());
  expect(bosses).toEqual({ pip: 'store', spinner: 'condo', bean: 'cafe', stamp: 'post', figjr: 'stand' });   // ✉️🍋 Stamp and Fig Jr. hire since 22 Sep 2026

  // ⭐ the invitation, not a refusal: a browser with no kept pass cannot be paid, and the line must
  // read as something you could keep rather than something you did wrong
  const noPass = await seam(page, () => window.__town.work.ask('pip'));
  expect(noPass.q).toMatch(/\?$/);
  expect(noPass.a.length).toBeGreaterThan(20);
  expect(noPass.a.toLowerCase()).not.toMatch(/account|anonymous|error|cannot/);
  expect(await seam(page, () => window.__town.work.ask('nib')), 'a resident who runs nothing is not a boss').toBeNull();

  // with a pass on the device the other three lines are reachable
  await seam(page, () => localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })));
  await seam(page, () => window.__town.work.set({ at: '' }));
  const hired = await seam(page, () => window.__town.work.ask('pip'));
  expect(hired.a, 'the building is named as the rig writes it, not as the sign plank shouts it').toContain('General Store');
  expect(hired.a).not.toContain('{where}');
  expect(await seam(page, () => window.__town.work.job())).toMatchObject({ at: 'store' });
  // 🧑‍🔧 the hire day of an on-call job has its work waiting: the store's calls are in from the moment of the hire (the job QA,
  // 24 Sep 2026 — they came one to eight minutes later, and a new hire walked in to find nothing to do)
  expect((await page.evaluate(() => window.__town.room.calls('store'))).map((c) => c.kind).sort(), 'every call the first rank brings, at once').toEqual(['restock', 'serve']);

  expect((await seam(page, () => window.__town.work.ask('pip'))).a, 'asking again is not a second job').toBe((await seam(page, () => window.__town.work.ask('pip'))).a);
  // 💼 ONE JOB AT A TIME, SAID OUT LOUD (Trym, 22 Sep): a second boss names the place you already work at and
  // nothing changes; the way out is your own boss's card, and only there
  const busy = await seam(page, () => window.__town.work.ask('spinner'));
  expect(busy.a, 'Spinner says you are the store’s').toContain('General Store');
  expect(busy.a).not.toContain('{where}');
  expect(await seam(page, () => window.__town.work.job()), 'and the job did not move').toMatchObject({ at: 'store' });
  expect(await page.evaluate(() => window.__town.work.topics('pip')), 'your own boss does not offer the job you already have').not.toContain(LIFE.work.ask);
  expect(await page.evaluate(() => window.__town.work.topics('spinner')), 'another boss still does').toContain(LIFE.work.ask);
  expect(await seam(page, () => window.__town.work.quit('spinner')), 'no way out on a boss who is not yours').toBeNull();
  const gone = await seam(page, () => window.__town.work.quit('pip'));
  expect(gone, 'your own boss carries the way out').toBeTruthy();
  expect(gone.q, '…as a question in your voice').toMatch(/\?$/);
  expect(gone.a.length, '…and lets you go in words').toBeGreaterThan(20);
  expect(await seam(page, () => window.__town.work.job()), 'no job now').toMatchObject({ at: '' });
  expect(await seam(page, () => window.__town.work.quit('pip')), 'and nothing to quit any more').toBeNull();
  const posted = await seam(page, () => window.__town.work.ask('stamp'));
  expect(posted.a, 'free again: Stamp names the post office as the rig writes it').toContain('Post Office');
  expect(await seam(page, () => window.__town.work.job())).toMatchObject({ at: 'post' });
  await seam(page, () => window.__town.work.quit('stamp'));
  const poured = await seam(page, () => window.__town.work.ask('figjr'));
  expect(poured.a, 'and Fig Jr. names the lemonade stand as the rig writes it').toContain('lemonade stand');
  expect(await seam(page, () => window.__town.work.job())).toMatchObject({ at: 'stand' });

  // ── and the question is really ON THE CARD, reached by walking up and tapping like a player
  await seam(page, () => window.__town.work.set({ at: '' }));
  const at = await seam(page, () => { const n = window.__town.life.residents().find((r) => r.key === 'pip'); return { x: n.x, y: n.y }; });
  await stand(page, at.x + 40, at.y + 20);
  await page.waitForTimeout(500);
  // ⚠️ PIP'S OWN ELEMENT, BY NAME. This used to take the resident nearest the view's CENTRE, which is
  // a different banana whenever the camera has not caught up with stand() yet — and since 20 Sep the
  // square also carries nameless VISITORS wearing the same class. It failed both its attempts in one
  // full-suite run and passed alone in six seconds: a guard that is a coin flip at two workers is
  // close to no guard. town-life.js stamps `data-k` on every resident for exactly this.
  await page.waitForFunction(() => { const e = document.querySelector('.tw-npc[data-k=\"pip\"]'); return !!(e && !e.hidden && e.getBoundingClientRect().width); }, null, { timeout: 15000 });
  const hit = await page.evaluate(() => {
    const e = document.querySelector('.tw-npc[data-k=\"pip\"]');
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height - 12 };
  });
  expect(hit, 'Pip is on screen to be tapped').toBeTruthy();
  await page.mouse.click(hit.x, hit.y);
  await page.waitForFunction(() => (document.getElementById('twCardBody').textContent || '').trim().length > 0, null, { timeout: 10000 });

  const said = await page.evaluate(() => document.getElementById('twCardBody').textContent || '');
  const q = await seam(page, () => (window.__town.work.ask('pip') || {}).q);
  expect(q, 'the question exists for a boss').toBeTruthy();
  expect(said, '…and a real tap on the boss puts it on their card').toContain(q);
  await seam(page, () => document.getElementById('twCardX').click());

  // ── turning up: standing at your own workplace is what marks the day
  await seam(page, () => window.__town.work.set({ at: 'store' }));
  await stand(page, 1100, 1250);
  await page.waitForTimeout(200);
  expect(await seam(page, () => window.__town.work.near()), 'the square is not your workplace').toBe(false);
  const sp = await seam(page, () => { const p = window.__town.PROPS.store; return { x: p.x + p.w / 2, y: p.base }; });
  await stand(page, sp.x, sp.y + 40);
  await page.waitForTimeout(200);
  expect(await seam(page, () => window.__town.work.near()), 'the shop door is').toBe(true);
  expect(errors).toEqual([]);
});

// 📦 THE RESTOCK CHORE (docs/town-jobs-plan.md §3 and §4). "The chore pays in the room, not in
// coins": carry a crate, the banana slows, the bare face fills, and the till ten steps away has
// that row on it before you leave. Every clause of that sentence is a line below.
//
// ⚠️ THE FOUR WAYS THIS COULD BE WRONG, and each one is asserted:
//   · a stranger could lift a shop's crate (it must be scenery to anybody who does not work there)
//   · the crate could be carried BEHIND the shop floor — the +2000 z trap of design library §22
//   · the deed could happen on the tap instead of on arrival, so a crate appears over your head
//     from across the room and the slow walk that IS the chore never happens
//   · the row could be in the room and not on the till, or gone on the next visit the same day
test('the restock chore: only for staff, carried slowly, and the till has the row before you leave', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await setBand(page, 25);   // struggling: a few faces stocked and the rest of the shop bare
  // the room asks who you work for when you walk in, so a change of employer is a walk back in
  const inside = async () => {
    await seam(page, () => window.__town.rooms.exit());
    await seam(page, () => window.__town.rooms.enter('store'));
    await page.waitForTimeout(500);
  };
  const bareOf = () => seam(page, () => window.__town.rooms.of('store').full[window.__town.room.bare()][0]);

  // ── a shop's crate is scenery to anybody who does not work there
  await seam(page, () => window.__town.work.set({ at: '' }));
  await inside();
  expect(await room(page, 'hints'), 'nothing is lit for somebody who does not work here').toEqual([]);
  expect(await room(page, 'open', 'cr1'), 'and the crate does not answer a tap').toBe(false);
  expect(await room(page, 'carrying')).toBe(false);
  await seam(page, () => window.__town.work.set({ at: 'condo' }));
  await inside();
  expect(await room(page, 'open', 'cr1'), 'nor to somebody who works at the arcade').toBe(false);
  expect(await room(page, 'hints'), 'and the arcade’s employee is invited to nothing here').toEqual([]);

  // ── you work here: the two stacks light up, and nothing else does
  await seam(page, () => window.__town.work.set({ at: 'store' }));
  await inside();
  const shelf0 = (await room(page, 'shelf')).length;
  expect(await room(page, 'bare'), 'there is a bare face to fill').toBe(shelf0);
  expect(await room(page, 'hints'), 'both crate stacks are the invitation').toEqual(['overcr1', 'overcr2']);
  // ⚠️ design library §22: a thing inside a room needs .is-in AND a z above the plate, or it is
  // invisible with no error at all. And a glow is a static filter, never an animated one (§21.4).
  const lit = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.tw-state.is-todo.is-in')];
    return {
      n: els.length,
      seen: els.filter((e) => getComputedStyle(e).visibility === 'visible').length,
      lowZ: Math.min(...els.map((e) => +e.style.zIndex)),
      plateZ: +getComputedStyle(document.querySelector('.tw-room')).zIndex,
      glow: els.every((e) => /drop-shadow/.test(getComputedStyle(e).filter)),
      animates: els.some((e) => /filter/.test(getComputedStyle(e).transitionProperty)),
    };
  });
  expect(lit.n, 'two glowing things in the room').toBe(2);
  expect(lit.seen, '⚠️ the invitation is actually VISIBLE').toBe(lit.n);
  expect(lit.lowZ, '⚠️ and above the room’s own plate').toBeGreaterThan(lit.plateZ);
  expect(lit.glow, 'it glows').toBe(true);
  expect(lit.animates, 'and the glow is not an animated filter (design library §21.4)').toBe(false);

  // ── a REAL tap on a lit crate, from across the aisle: the banana WALKS there, THEN lifts it.
  // ⚠️ the camera follows the banana, so where a thing is ON SCREEN depends on where the banana is
  // standing: it is stood in the aisle FIRST and the crate's rect read after, never the other way.
  await stand(page, 470, 972);   // the aisle, clear of the market table's collider and the doorway wall
  await page.waitForTimeout(250);
  const box = await page.evaluate(() => {
    const v = document.getElementById('twView').getBoundingClientRect();
    for (const e of document.querySelectorAll('.tw-state.is-todo.is-in')) {
      const r = e.getBoundingClientRect();
      if (r.left > v.left && r.right < v.right && r.top > v.top && r.bottom < v.bottom) return { x: r.left + r.width / 2, y: r.top + r.height - 10 };
    }
    return null;
  });
  expect(box, 'a lit crate is on screen to be tapped').not.toBeNull();
  await page.mouse.click(box.x, box.y);
  expect(await room(page, 'carrying'), 'the crate is NOT in your hands on the tap — you have to walk to it').toBe(false);
  await page.waitForFunction(() => window.__town.room.carrying(), null, { timeout: 8000 });
  const heldSlow = await seam(page, () => window.__town.slow());
  expect(heldSlow, 'and carrying it, the banana walks slower').toBeLessThan(1);
  await page.screenshot({ path: SHOT + 'chore-carry.png' });

  // the crate rides ON the banana, in front of the shop floor
  const held = await page.evaluate(() => {
    const e = [...document.querySelectorAll('.tw-state.is-in')].find((q) => q.firstChild && /s-crate-/.test(q.firstChild.src));
    if (!e) return null;
    const r = e.getBoundingClientRect(), v = document.getElementById('twView').getBoundingClientRect();
    return {
      seen: getComputedStyle(e).visibility === 'visible', z: +e.style.zIndex,
      plateZ: +getComputedStyle(document.querySelector('.tw-room')).zIndex,
      inView: r.left > v.left && r.right < v.right && r.top > v.top && r.bottom < v.bottom,
    };
  });
  expect(held, 'the carried crate is a real sprite in the room').not.toBeNull();
  expect(held.seen, '⚠️ and visible').toBe(true);
  expect(held.z, '⚠️ IN FRONT of the shop floor, not behind it (design library §22)').toBeGreaterThan(held.plateZ);
  expect(held.inView, 'and on screen, where the banana is').toBe(true);

  // ── now the bare face is the only lit thing, because that is the whole instruction
  const pointed = await room(page, 'hints');
  expect(pointed.length, 'one thing lit: the face about to fill').toBe(1);
  expect(pointed[0], 'and it is the BARE face, not a stocked one').toBe('over' + (await bareOf()));
  expect(await room(page, 'open', 'sh1'), 'a shelf that already has goods on it refuses the crate').toBe(false);

  // ── the drop, tapped for real on the lit face: the slow walk across the shop, then it lands
  const face = await page.evaluate(() => {
    const r = document.querySelector('.tw-state.is-todo.is-in').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height - 6 };
  });
  await page.mouse.click(face.x, face.y);
  expect(await room(page, 'carrying'), 'the face does not fill from across the room either').toBe(true);
  await page.waitForFunction(() => !window.__town.room.carrying(), null, { timeout: 5000 });
  await page.waitForTimeout(300);
  expect(await room(page, 'carrying'), 'your hands are empty again').toBe(false);
  expect(await seam(page, () => window.__town.slow()), 'and you walk at your own speed').toBe(1);
  expect(await room(page, 'restocked'), 'one face filled today').toBe(1);
  const shelf1 = await room(page, 'shelf');
  expect(shelf1.length, 'the shelf the TILL reads grew by exactly one').toBe(shelf0 + 1);
  const faces = await page.evaluate(() => [...document.querySelectorAll('.tw-state.is-in')].filter((e) => e.firstChild && /s-full/.test(e.firstChild.src)).length);
  expect(faces, 'and the room shows one more full face').toBe(shelf1.length);
  await page.screenshot({ path: SHOT + 'chore-stocked.png' });

  // the till's own card carries the row you just put out: the room and the card cannot disagree
  await room(page, 'open', 'till');
  await page.waitForFunction(() => !document.getElementById('twPanel').hidden && (document.getElementById('twCardBody').textContent || '').length > 20, null, { timeout: 9000 });
  const card = await page.evaluate(() => document.getElementById('twCardBody').textContent || '');
  await seam(page, () => document.getElementById('twCardX').click());
  const rows = await page.evaluate(() => (window.__town.room.shelf() || []).length);
  expect(rows, 'the card read the same shelf').toBe(shelf0 + 1);
  expect(card.length, 'and it is a card with the shop’s rows on it').toBeGreaterThan(20);

  // ── and the row is still there on the next visit the same day
  await seam(page, () => window.__town.rooms.exit());
  await page.waitForTimeout(300);
  expect(await page.locator('.tw-state.is-in').count(), 'nothing of the room is left outside it').toBe(0);
  await inside();
  expect(await room(page, 'restocked'), 'the day remembers').toBe(1);
  expect((await room(page, 'shelf')).length, 'and the row is still on the shelf').toBe(shelf0 + 1);

  // ── a shop stocked to its last face has nothing left to do, and says so rather than refusing
  await setBand(page, 95);
  await inside();
  while ((await room(page, 'bare')) >= 0) {
    await seam(page, () => window.__town.room.chore('cr1'));
    await page.waitForTimeout(120);
    await seam(page, (k) => window.__town.room.chore(k), await bareOf());
    await page.waitForTimeout(120);
  }
  expect(await room(page, 'hints'), 'a shop stocked to the last face invites nothing').toEqual([]);
  await seam(page, () => window.__town.room.chore('cr1'));
  await page.waitForTimeout(250);
  expect(await room(page, 'carrying'), 'and hands you no crate').toBe(false);
  expect((await page.locator('.tw-toast').first().textContent()).length, 'it tells you the work is done').toBeGreaterThan(0);
  await page.screenshot({ path: SHOT + 'chore-full.png' });
  await seam(page, () => window.__town.rooms.exit());
  expect(errors).toEqual([]);
});

// 🤫 THE TWO CHECKS THE DESIGN LIBRARY HAS CLAIMED SINCE 12 SEP AND NEVER HAD. Its own table of
// "which rule is enforced by what" named `the town walk's silence check` and `the town walk's
// standingPose check`, and neither string existed anywhere in tests/ or tools/ — so the Quiet Rule
// and the standing pose were paragraphs pretending to be gates. They are both honoured by the code
// already; what was missing was anything to stop them quietly stopping being honoured.
test('silence: not one word floats over a banana in this town', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await seam(page, () => window.__town.room.folkReady());
  await seam(page, () => window.__town.room.folk().fill(6, performance.now()));
  await page.waitForTimeout(1200);

  const said = await page.evaluate(() => {
    const bad = [];
    // every banana in the world: the nine residents, the visitors, the merchant, the night vendor
    for (const el of document.querySelectorAll('.tw-npc, .tw-visitor, .tw-me, .tw-atwork')) {
      const t = (el.textContent || '').trim();
      if (t) bad.push(el.className + ' says "' + t.slice(0, 40) + '"');
      for (const kid of el.children) if (kid.tagName !== 'CANVAS' && kid.tagName !== 'IMG') bad.push(el.className + ' carries a <' + kid.tagName.toLowerCase() + '>');
    }
    return bad;
  });
  expect(said, '⚠️ a banana is wearing words — the Quiet Rule is broken (design library, the Quiet Rule)').toEqual([]);

  // …and the town's own voice is a TOAST at the bottom, not a bubble on a head
  const toast = await page.evaluate(() => {
    const t = document.getElementById('twToast');
    if (!t) return null;
    const s = getComputedStyle(t);
    return { pos: s.position, bottom: s.bottom, events: s.pointerEvents };
  });
  expect(toast.pos, 'the world speaks from one docked strip').toBe('absolute');
  expect(toast.events, 'and it never eats a tap meant for the square').toBe('none');
  expect(errors).toEqual([]);
});

test('standingPose: a resident at their post stands sideways, never front-on', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  // ⚠️ frames 2, 3, 6 and 7 are the FRONT-FACING dance poses — arms up, the banana's party frame.
  // A resident standing at their own counter must not be caught in one; standFrame() only ever
  // returns 0, 1, 4 or 5 for exactly this reason (src/scripts/town-life.js).
  const FRONT = [2, 3, 6, 7];
  const bad = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(700);
    for (const r of await seam(page, () => window.__town.life.residents())) {
      if (r.hidden || r.walking || r.leg) continue;
      if (FRONT.includes(r.frame)) bad.push(`${r.key} stands front-on in frame ${r.frame} at ${r.place}`);
    }
  }
  expect(bad, '⚠️ somebody is posing at their own shop instead of standing at it').toEqual([]);
  expect(errors).toEqual([]);
});

// ⚠️ A SHUT DOOR'S REASON BELONGS TO THE DOOR (20 Sep 2026). `closed` was one flat deck of six lines
// indexed by `dayNum() + key.length`, so the line about the coffee propeller's bolt could hang on the
// general store — and 'cafe' and 'info' are both four characters, so those two printed the SAME reason
// on the same day. Only one of the six lines named a front that can shut at all; measured hit rate,
// about one in eighteen. The decks are keyed by front now, and no line may name a front.
test('a shut front says why in its OWN words, and only three fronts can shut', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await setBand(page, 85);

  const decks = await page.evaluate(() => window.__town.room.copyOf('closed'));
  expect(Object.keys(decks).sort(), 'one deck per front that can shut').toEqual(['cafe', 'info', 'store']);
  for (const k of ['cafe', 'info', 'store']) {
    expect(decks[k].length, `${k} has a deck, not one line`).toBeGreaterThanOrEqual(3);
  }
  // ⚠️ and no deck may name a front that can never shut: the arcade's five games must answer on a
  // stranger's worst day and the mail never stops, so a line naming them is a lie on a door
  for (const [k, deck] of Object.entries(decks)) {
    for (const l of deck) {
      expect(l.toLowerCase(), `${k}: a reason naming the arcade`).not.toContain('arcade');
      expect(l.toLowerCase(), `${k}: a reason naming the post office`).not.toContain('post office');
    }
  }

  // tap each shut front in turn and read what the town says
  for (const key of ['cafe', 'info', 'store']) {
    // ⚠️ shut as TODAY'S fault, which is the branch that names a reason. A front the BAND shut answers
    // with `lowShut`, which is deliberately front-agnostic: being too poor to open is nobody's bolt.
    await page.evaluate((k) => window.__town.room.shutShop(k, true), key);
    await page.waitForTimeout(400);
    await page.evaluate((k) => { const p = window.__town.PROPS[k], t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; }, key);
    await page.evaluate((k) => window.__town.room.open(k), key);
    await page.waitForTimeout(400);
    const said = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
    const mine = decks[key].some((l) => said && l.includes(said.slice(0, 20)));
    const others = ['cafe', 'info', 'store'].filter((k) => k !== key);
    const theirs = others.filter((k) => decks[k].some((l) => said && l.includes(said.slice(0, 20))));
    expect(said.length, `tapping the shut ${key} says something`).toBeGreaterThan(8);
    expect(mine, `and the ${key}'s reason comes from the ${key}'s own deck (got "${said}")`).toBe(true);
    expect(theirs, 'never from another front’s').toEqual([]);
  }
  expect(errors).toEqual([]);
});

// ⚠️ AND A FRONT YOU OPENED STAYS OPEN ACROSS A RELOAD. condition() restored only the day's LAMP
// fixes, so a reload put the tape back on a shutter you had already fixed — while isFixed() still
// said it was done, which made the forced "every shut front is one of your problems" loop skip it.
// A dark door with no way to open it until UTC midnight rolled, with its keeper shut in behind it.
// Found by a verifier that was refuting a different claim.
test('a shutter you fixed today is still open after a reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await setBand(page, 85);
  await page.evaluate(() => window.__town.room.today(['closed'], 'cafe'));   // today's event shuts the café — a front shut by TODAY is always one of your jobs (town-room.js)
  await page.waitForTimeout(500);
  expect(await room(page, 'shut'), 'the café is shut').toContain('cafe');
  expect((await room(page, 'problems')).map((j) => j.id), 'and that is one of your jobs').toEqual(expect.arrayContaining([expect.stringContaining('shutter:cafe')]));

  await page.evaluate(() => window.__town.room.fix('shutter:cafe'));
  await page.waitForTimeout(500);
  expect(await room(page, 'shut'), 'fixed: the front is open').not.toContain('cafe');

  await town(page);
  await setBand(page, 85);
  await page.evaluate(() => window.__town.room.today(['closed'], 'cafe'));   // the same day again: today's event shuts the café, and your fix must still hold
  await page.waitForTimeout(500);
  const after = await room(page, 'shut');
  const jobs = await room(page, 'problems');
  const owed = jobs.some((j) => String(j.id).includes('shutter:cafe'));
  expect(after.includes('cafe') && !owed, 'a reload may not re-tape a front you already opened and then refuse you the job').toBe(false);
  expect(errors).toEqual([]);
});

// 🗑 RUBBISH LIES WHERE YOU CAN SEE IT, AND NEVER IN A HEAP (Trym, 20 Sep 2026: "always one garbage bag
// by itself … but only one garbage bags-sprite at once each town location … small litter can overlap
// some no worries, but total overlap cant happen … for garbage its nice to use the whole town to spread
// it around, but not behind buildings where users cant see them").
//
// ⚠️ TWO DIFFERENT NUMBERS, because they are two different things. A bin bag is a 65px heap the eye
// reads as ONE object, so two on a patch read as a rendering fault; a crisp packet is small and a few
// together IS what litter looks like. The spots themselves are derived from the street rectangles now,
// thinned to 150px apart, so the seeded half cannot heap by construction — this proves it stays true
// across a day of waves and a night of ghosts throwing things down.
// 🚶 A PICKUP NEEDS A STEP (23 Sep 2026). The arrival point is 28 px from street spot s19, inside litter's reach, so on
// about one draw in twelve the square picked up rubbish (and paid for it) as the page loaded — and the band walk above read
// 44 where it expected 42. Nothing is picked up now until the banana has moved; the first step onto it picks it up.
test('nothing is picked up until the banana takes a step; the step picks it up', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await pinned(page);
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__town.room.nightReady()), 'the night module (it drops rubbish)').toBe(true);
  await page.evaluate(() => window.__town.room.curse('none'));
  const at = await page.evaluate(() => [window.__town.pos.x, window.__town.pos.y]);
  expect(at, 'the banana stands where the square receives it').toEqual([1100, 1230]);
  // rubbish right beside the standing banana, well inside litter's 30 px reach
  const id = await page.evaluate(([x, y]) => window.__town.room.litterAt(x + 12, y + 4, 'trash1', false), at);
  const life0 = (await room(page, 'life')).life;
  await page.waitForTimeout(900);
  let ids = (await room(page, 'problems')).map((p) => p.id);
  expect(ids, '⭐ standing still picks nothing up').toContain(id);
  expect((await room(page, 'life')).life, 'and the meter has not moved').toBe(life0);
  // one step onto it
  await stand(page, at[0] + 8, at[1] + 2);
  await page.waitForFunction((pid) => !(window.__town.room.problems() || []).some((p) => p.id === pid), id, { timeout: 3000 });
  ids = (await room(page, 'problems')).map((p) => p.id);
  expect(ids, 'the step picks it up').not.toContain(id);
  expect((await room(page, 'life')).life, 'and the square counts the fix').toBeGreaterThan(life0);
  expect(errors).toEqual([]);
});

test('rubbish is spread, never heaped, and never behind a building', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await town(page);
  await setBand(page, 30);   // a low town: the most rubbish there is

  // ⚠️ AND THE NIGHT, which is where the heap actually came from. The seeded waves draw from spots that
  // are 150px apart by construction, so they cannot heap — but a ghost threw its rubbish down at its own
  // waypoint ±20px whatever was already there, and one that rests twice at the same bench built a pile of
  // three bin bags on one patch. Driving waves alone proves nothing about that.
  await seam(page, () => window.__town.room.nightReady());
  await seam(page, () => window.__town.room.curse('deep'));
  await page.waitForTimeout(1600);
  for (let i = 0; i < 14; i++) { await seam(page, () => window.__town.room.mischief()); await page.waitForTimeout(90); }

  // ⚠️ MEASURED IN WORLD COORDINATES, from the problem list — not from the sprites on screen. The
  // camera shows a fraction of the town, so a screen-rect check saw two pieces of rubbish out of twenty
  // and proved nothing: it passed just as happily against the placement that built the heap.
  // ⚠️ AND A SNAPSHOT IS WHAT LIES ON THE SQUARE AT ONCE (23 Sep 2026). A new wave sweeps the cobbles and draws again, so
  // pieces from two waves never lie side by side — and comparing them failed a correct town: two ghost waypoints sit 14
  // and 19 px from street spots s11 and s2, so a ghost's drop in one wave could land within 20 px of where a seeded piece
  // lay in another. Every snapshot is checked as it stands (the night's own mess is one of them, first); the tally
  // across them is for the spread.
  const snaps = [], all = [];
  const snap = async () => {
    const rows = await page.evaluate(() => (window.__town.room.problems() || [])
      .filter((p) => p.type === 'litter' || p.type === 'leaves')
      .map((p) => ({ x: p.x, y: p.y, art: p.art, id: p.id })));
    snaps.push(rows);
    for (const r of rows) if (!all.some((q) => q.id === r.id)) all.push(r);
  };
  await snap();   // the night's own mess, before the first wave sweeps it
  for (let wave = 0; wave < 6; wave++) {
    await seam(page, () => window.__town.room.nextWave());
    await page.waitForTimeout(220);
    for (let i = 0; i < 6; i++) { await seam(page, () => window.__town.room.mischief()); await page.waitForTimeout(70); }
    await snap();
  }
  console.log('QA rubbish: ' + all.length + ' pieces in ' + snaps.length + ' snapshots :: ' + JSON.stringify(all.map((r) => r.art + '@' + r.x + ',' + r.y)));
  expect(all.length, 'a low town has rubbish in it').toBeGreaterThan(5);

  for (const rows of snaps) {
    // ⭐ ONE BIN BAG PER PATCH. A bag is a 65px heap the eye reads as ONE object, so two on a patch read
    // as a rendering fault rather than as a mess.
    const bags = rows.filter((r) => r.art === 'pile');
    for (let i = 0; i < bags.length; i++) {
      for (let k = i + 1; k < bags.length; k++) {
        const d = Math.hypot(bags[i].x - bags[k].x, bags[i].y - bags[k].y);
        expect(Math.round(d), 'two bin bags on one patch — a bag stands on its own').toBeGreaterThanOrEqual(100);
      }
    }
    // ⭐ AND NOTHING IS A TOTAL OVERLAP. Small litter may lie close together — that is what litter looks
    // like — but never on top of itself.
    for (let i = 0; i < rows.length; i++) {
      for (let k = i + 1; k < rows.length; k++) {
        const d = Math.hypot(rows[i].x - rows[k].x, rows[i].y - rows[k].y);
        expect(Math.round(d), 'two pieces of rubbish in the same place — that is a total overlap, not a mess').toBeGreaterThanOrEqual(20);
      }
    }
  }
  // ⭐ AND IT IS NEVER BEHIND A BUILDING, where the player can never find work they are paid for.
  const hidden = await page.evaluate((pts) => {
    const O = window.__town.OVERLAYS || [];
    return pts.filter((p) => O.some((o) => o[4] >= 90 && p.x > o[1] && p.x < o[1] + o[3] && p.y > o[2] && p.y < o[2] + o[4] - 10))
      .map((p) => [p.x, p.y]);
  }, all);
  expect(hidden, 'no rubbish is dropped behind something tall enough to hide it').toEqual([]);

  // ⭐ AND IT USES THE WHOLE TOWN rather than piling in one corner.
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  expect(Math.max(...xs) - Math.min(...xs), 'spread across the town').toBeGreaterThan(700);
  expect(Math.max(...ys) - Math.min(...ys), 'on both axes').toBeGreaterThan(250);
  // ⭐ AND THE RULE ITSELF, asked directly. The end-to-end heap needs a ghost to rest twice on one
  // waypoint, which is probabilistic and cannot be forced — so what the walk above proves is that a
  // realistic day and night stay clean, and what this proves is the mechanism that keeps them clean.
  // ⚠️ ASKED ABOUT A BAG THE WALK PUT DOWN (23 Sep 2026). It used to ask about whichever bag the last wave happened to
  // hold — so on a draw with no bag the six rules were skipped outright, and on one where another piece or a shopfront lay
  // 34 px from that bag, "small litter beside a bag" was refused, correctly, and the walk failed. The cobbles are swept,
  // one bin bag goes down on street spot s10 (measured: open, with room beside it on every side), and all six are asked
  // in the same breath — no ghost can move in between. The LIVE list still answers: the bag is in it.
  const BAG = [1391, 1077];
  const rule = await page.evaluate(([bx, by]) => {
    const R = window.__town.room;
    R.litterAt(bx, by, 'pile', true);
    const bag = (R.problems() || []).find((p) => p.art === 'pile' && p.x === bx && p.y === by);
    if (!bag) return { placed: false };
    return {
      placed: true, alone: (R.problems() || []).filter((p) => p.type === 'litter' || p.type === 'leaves').length,
      onTopOfABag: R.litterRoom(bag.x, bag.y, 'pile'),
      besideABag: R.litterRoom(bag.x + 40, bag.y, 'pile'),
      // SOMEWHERE well away, not one fixed point: bag.x + 260 is a shopfront from some spots, and then the rule is right
      // to refuse it — the check is that distance frees a spot at all
      wellAwayFromABag: [[260, 0], [-260, 0], [0, 260], [0, -260], [260, 260], [-260, -260], [260, -260], [-260, 260]]
        .some(([dx, dy]) => R.litterRoom(bag.x + dx, bag.y + dy, 'pile')),
      smallOnTop: R.litterRoom(bag.x, bag.y, 'trash1'),
      smallNearby: R.litterRoom(bag.x + 34, bag.y + 6, 'trash1'),
      behindAShopfront: R.litterRoom(window.__town.PROPS.post.x + 60, window.__town.PROPS.post.y + 120, 'trash1'),
    };
  }, BAG);
  expect(rule.placed, 'the walk’s bin bag lies on s10').toBe(true);
  expect(rule.alone, 'and it is the only rubbish on the cobbles').toBe(1);
  expect(rule.onTopOfABag, 'a second bin bag may not go where one already is').toBe(false);
  expect(rule.besideABag, 'nor a body’s length from it').toBe(false);
  expect(rule.wellAwayFromABag, 'but across the square is fine').toBe(true);
  expect(rule.smallOnTop, 'and nothing at all may go exactly on top of something').toBe(false);
  expect(rule.smallNearby, 'while small litter beside a bag is what a mess looks like').toBe(true);
  expect(rule.behindAShopfront, 'and nothing is dropped behind a building').toBe(false);
  expect(errors).toEqual([]);
});
