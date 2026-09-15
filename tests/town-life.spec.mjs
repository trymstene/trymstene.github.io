// 🏘️ TOWN LIFE — the walk (14 Sep 2026). The town is walked as a player against the built
// site under ?towntest, where the TownRoom's arithmetic runs in memory and the QA seam
// (window.__town.room) can push the town to any band and force a Curse Night. What the
// design says in prose is asserted here: the band drives the look, a problem is fixed by
// tapping and pays, the shop lands a piece in the homestead's shed, a night has ghosts,
// residents indoors and a vendor, and it ends. Screenshots of every state land in
// test-results/ for the eye (docs/design-library.md §13).
import { test, expect } from '@playwright/test';

const SHOT = 'test-results/town-';
// 🔭 the whole town at 1:1 for the eye: the camera's transform is switched off and the view
// opened to the world's size for one shot, then everything is put back
async function overview(page, name, clip) {
  await page.setViewportSize({ width: 2300, height: 1500 });
  await page.addStyleTag({ content: '.tw-wrap{max-width:none!important;padding:0!important}.tw-stage{box-shadow:none!important;border:0!important}.tw-view{width:2200px!important;height:1300px!important}#twWorld{width:2200px!important;height:1300px!important;transform:none!important}', id: 'qa-overview' });
  await page.waitForTimeout(250);
  const v = page.locator('#twView');
  await v.screenshot({ path: SHOT + name + '.png', ...(clip ? { clip } : {}) });
  await page.evaluate(() => { const t = document.getElementById('qa-overview'); if (t) t.remove(); });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForTimeout(250);
}
async function town(page) {
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  // the clock may be running a real night this minute: the walk asks for calm first
  await page.evaluate(() => window.__town.room.curse('none'));
  await page.waitForTimeout(600);
}
const seam = (page, fn, arg) => page.evaluate(fn, arg);
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
  expect(p0.length).toBe(5 + shut0.length);
  const lamps0 = await room(page, 'lamps');
  expect(Object.values(lamps0).filter((s) => s === 'out').length).toBe(1);
  expect(Object.values(lamps0).filter((s) => s === 'flicker').length).toBe(1);
  // one mark per problem — five, plus the shutter on any kiosk today's events shut (always fixable)
  expect(await page.locator('.tw-mark').count()).toBe(p0.length);
  await page.screenshot({ path: SHOT + 'recovering.png' });
  await overview(page, 'recovering-all');

  // pushed to the floor, at night so the lamps mean something: Abandoned — nine problems,
  // both kiosks shut, the bin full, the fountain dry, crows, five dark lamps, no visitors
  await seam(page, () => window.__town.life.set(21));
  await setBand(page, 5);
  expect(await room(page, 'band')).toBe('abandoned');
  expect((await room(page, 'problems')).length).toBe(9);
  expect((await room(page, 'shut')).sort()).toEqual(['cafe', 'info']);
  expect(await room(page, 'bin')).toBe(true);
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
  expect(await room(page, 'bin')).toBe(false);
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
  const [p] = await room(page, 'problems');
  expect(p).toBeTruthy();
  // walk up and tap it, the way a player does: the tap lands on the mark's world spot
  await seam(page, (id) => window.__town.room.fix(id), p.id);
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
  expect(after.length).toBe(4);
  expect(await room(page, 'fixed')).toContain(p.id);
  expect(await room(page, 'coins')).toBeGreaterThan(before);
  const L = await room(page, 'life');
  expect(L.life).toBeCloseTo(43.2, 1);
  expect(L.cap.used).toBe(1);
  // a reload keeps the fix (the day's memory on this device)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  expect((await room(page, 'problems')).find((q) => q.id === p.id)).toBeUndefined();
});

test('a Curse Night: dark sky, everyone in, ghosts and the vendor — and it ends', async ({ page }) => {
  await town(page);
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
  expect(g.map((x) => x.id).sort()).toEqual(['drift', 'knock', 'lead', 'repeat', 'sit', 'wisp']);
  expect(await room(page, 'vendor')).toBe(true);
  expect((await room(page, 'shut')).sort()).toEqual(['cafe', 'info']);
  const objs = await room(page, 'objects');
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
  expect(await page.locator('.tw-card--board .tw-lamps').count()).toBe(1);
  await page.screenshot({ path: SHOT + 'board.png' });
  // and the board at a desktop width, the card alone
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(400);
  await page.locator('.tw-card').screenshot({ path: SHOT + 'board-desktop.png' });
  await page.setViewportSize({ width: 393, height: 852 });
});
