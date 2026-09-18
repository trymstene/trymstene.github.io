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

const SHOT = 'test-results/town-';
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
async function town(page) {
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
  // the shim opens at the set point: Recovering, five problems, one dark lamp and one that stutters
  expect(await room(page, 'band')).toBe('recovering');
  expect((await room(page, 'life')).life).toBe(42);
  const p0 = await room(page, 'problems');
  const shut0 = await room(page, 'shut');
  const lamps0 = await room(page, 'lamps');
  const dim0 = Object.values(lamps0).filter((s) => s !== 'ok').length;
  expect(p0.length).toBe(5 + shut0.length + dim0);   // five, the shutter today's event shut, and EVERY dark or stuttering lamp
  expect(Object.values(lamps0).filter((s) => s === 'out').length).toBe(1);
  expect(Object.values(lamps0).filter((s) => s === 'flicker').length).toBe(1);
  // one mark per problem (five, plus the shutter on any kiosk today's events shut) and one per
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

  // pushed to the floor, at night so the lamps mean something: Abandoned — nine problems,
  // both kiosks shut, the bin full, the fountain dry, crows, five dark lamps, no visitors
  await seam(page, () => window.__town.life.set(21));
  await setBand(page, 5);
  expect(await room(page, 'band')).toBe('abandoned');
  expect((await room(page, 'problems')).length).toBe(9 + Object.values(await room(page, 'lamps')).filter((s) => s !== 'ok').length);   // nine, and every dark or stuttering lamp on top
  expect((await room(page, 'shut')).sort()).toEqual(['cafe', 'info']);
  expect((await room(page, 'full')).length).toBe(5);   // three street bins and two dumpsters, all full
  expect(await page.locator('.tw-tape').count()).toBe(4);   // both kiosks taped off, two bands each
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

  // and to the top: Thriving — two problems, everything open and lit, visitors, the full shelf
  await setBand(page, 95);
  expect(await room(page, 'band')).toBe('thriving');
  // two problems — plus, if today's event shut a kiosk, the shutter you can raise on it (a closed
  // door is always fixable); nothing else is shut in a thriving town
  const shutT = await room(page, 'shut');
  const probT = await room(page, 'problems');
  expect(probT.length).toBe(2 + shutT.length);
  for (const k of shutT) expect(probT.some((q) => q.id === 'shutter:' + k)).toBe(true);
  expect(shutT.length).toBeLessThanOrEqual(1);
  expect((await room(page, 'full')).length).toBe(0);
  expect(await page.locator('.tw-tape').count()).toBe(2 * shutT.length);   // only a kiosk the day's event shut is taped off in a thriving town
  expect(await room(page, 'fountain')).toBe('on');
  expect(await room(page, 'visitors')).toBe(3);
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
  await seam(page, () => window.__town.room.cards.board());
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
  await page.waitForTimeout(1500);
  expect(await room(page, 'night')).toBe(0);
  expect((await room(page, 'ghosts')).length).toBe(0);
  expect(await room(page, 'vendor')).toBe(false);
  expect((await seam(page, () => window.__town.life.kept())).length).toBe(kept0);
  expect(await page.evaluate(() => !!document.querySelector('.wx.is-storm'))).toBe(false);
});

test('the store sells a piece for the homestead into the shed or onto the van', async ({ page }) => {
  await town(page);
  await setBand(page, 70);   // lively: six rows
  await seam(page, () => window.__town.room.rich());
  await seam(page, () => window.__town.room.cards.store());
  await page.waitForTimeout(300);
  const rows = page.locator('[data-town-buy]');
  expect(await rows.count()).toBe(6);
  const enabled = page.locator('[data-town-buy]:not([disabled])');
  expect(await enabled.count()).toBeGreaterThan(0);
  const id = await enabled.first().getAttribute('data-town-buy');
  const coins0 = await room(page, 'coins');
  await page.screenshot({ path: SHOT + 'store.png' });
  await enabled.first().click();
  await page.waitForTimeout(300);
  expect(await room(page, 'coins')).toBeLessThan(coins0);
  const hs = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1') || 'null'));
  const landed = [...(hs.shed || []).map((x) => x.id), ...(hs.orders || []).map((x) => x.id)];
  expect(landed).toContain(id);
  expect(hs.dirty).toBe(1);
  // the notice board opens with today's tally
  await seam(page, () => window.__town.room.cards.board());
  await page.waitForTimeout(200);
  expect(await page.locator('.tw-tally b').count()).toBe(3);
  // the report lists what wants doing today, one entry per kind of thing open (or one line when nothing is)
  const kinds = new Set((await room(page, 'problems')).map((q) => q.type)).size;
  expect(((await page.locator('.tw-todo').textContent()) || '').split(' · ').length).toBe(Math.max(1, kinds));
  expect(await page.locator('.tw-stamp').count()).toBe(0);
  expect(await page.locator('.tw-paper--news').count()).toBe(0);   // an ordinary noon: no night notice; the nights are Moss's to tell
  expect(await page.locator('.tw-forsale').count()).toBe(1);   // the Coffee Cup is for sale until it can be bought
  expect((await page.evaluate(() => window.__town.life.talk('moss'))).topics.length).toBe(3);   // his two, and the nights
  expect(await page.locator('.tw-card--board .tw-lamps').count()).toBe(1);
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
  await setBand(page, 90);   // Thriving: three visitors by day
  expect(await room(page, 'visitorsOut')).toBe(3);
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
  // and it keeps away: stand 90 px from it, and two seconds later it has put ground between you
  const r3 = (await room(page, 'ghosts')).find((g) => g.id === 'roam');
  await stand(page, r3.x + 90, r3.y);
  await page.waitForTimeout(2200);
  const r4 = (await room(page, 'ghosts')).find((g) => g.id === 'roam');
  expect(Math.hypot(r4.x - (r3.x + 90), r4.y - r3.y)).toBeGreaterThan(90);
  await stand(page, 1360, 880);
  await seam(page, () => window.__town.life.set(8));   // morning
  await page.waitForTimeout(1400);
  expect(await room(page, 'visitorsOut')).toBe(3);   // morning: they are back
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
