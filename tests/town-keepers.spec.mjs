// 🤝 A KEEPER AT THEIR POST ANSWERS FOR THEIR PLACE, WALKED (27 Sep 2026). Trym: "its a bit confusing that theres a different click
// between the actual stall, and the NPC responsible for the stall - this goes for all NPCs standing outside something - like the
// wheel of peel aswell".
//
// What has to hold, with real taps on the built site (banana-town.js KEEP):
//   · a stall's keeper at their post and the stall are ONE tap: the stall's card, the keeper at its head — their face beside the
//     stall's own line, and a button to them. They do not speak on it (design library §18): their card opens for that
//   · away from their post (lunch), the stall says its own line again
//   · a place with only a line to say hands the tap to its keeper standing at it (the Town Hall → Nib, the café's window → Bean)
import { test, expect } from '@playwright/test';
import NPCS from '../src/data/copy/town-npcs.json' with { type: 'json' };
import FRONTS from '../src/data/copy/town-fronts.json' with { type: 'json' };
import MARKET from '../src/data/copy/town-market.json' with { type: 'json' };
import LIFE from '../src/data/copy/town-life.json' with { type: 'json' };
import { CAFE_WIN } from '../src/scripts/town-geo.js';
import { tapResident as tapWhereFound } from './tap-resident.mjs';

const nameOf = (key) => (NPCS.residents.find((r) => r.key === key) || {}).name;
const json = (o) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
const stand = (page, x, y) => page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = t.tgt.x = px; t.pos.y = t.tgt.y = py; }, [x, y]);

async function town(page, hour) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  // a pass, no job, and chapter one behind them — a newcomer meets Nib at the fountain, not at his hall (world-quest.js step 0)
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); localStorage.removeItem('tw-job-v1'); localStorage.setItem('bwq-c1', JSON.stringify({ s: 16, k: {}, res: 0, done: 1, resSet: 1 })); localStorage.setItem('bwq-c2', JSON.stringify({ s: 11, done: 1 })); } catch (e) {} });
  await page.route('**/town/order', (r) => r.fulfill(json({ ok: true, day: 1, done: [] })));
  await page.route('**/town/wheel', (r) => r.fulfill(json({ ok: true, pot: 50, next: 'free', left: 30, cost: 3, wallet: { bal: 10, seq: 1 }, seen: [], slots: {} })));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.work.set, null, { timeout: 30000 });
  await page.evaluate((h) => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.work.set({ at: '' }); window.__town.life.set(h); }, hour);
  await page.waitForTimeout(300);
  return errs;
}
// a real tap on a resident, the way a player does it: stand beside them, then tap where the town finds them
async function tapResident(page, key) {
  const at = await page.evaluate((k) => { const n = window.__town.life.residents().find((r) => r.key === k); return { x: n.x, y: n.y }; }, key);
  await stand(page, at.x + 60, at.y + 30);
  await tapWhereFound(page, key);
}
// a real tap on a place's picture, at a fraction of its box (kept clear of whoever stands in front of it)
async function tapPlace(page, key, fx, fy) {
  const box = await page.evaluate((k) => { const p = window.__town.PROPS[k]; return { x: p.x, y: p.y, w: p.w, h: p.h }; }, key);
  await stand(page, box.x + box.w / 2, box.y + box.h + 50);
  await page.waitForTimeout(500);
  const hit = await page.evaluate(([k, a, b]) => { const r = document.querySelector('img.tw-ov[data-key="' + k + '"]').getBoundingClientRect(); return { x: r.left + r.width * a, y: r.top + r.height * b }; }, [key, fx, fy]);
  await page.mouse.click(hit.x, hit.y);
}
const head = (page) => page.evaluate(() => { const k = document.querySelector('#twCardBody .tw-keep'); return k ? { line: k.querySelector('.tw-keep__say').firstChild.textContent.trim(), talk: (k.querySelector('.tw-keep__open') || {}).textContent, quote: !!k.querySelector('q'), drawn: (() => { const cv = k.querySelector('canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })() } : null; });

test('a stall’s keeper at her post is the stall: tapping Tally opens the Exchange with her at its head, and Talk opens her card', async ({ page }) => {
  const errs = await town(page, 4.5);
  await tapResident(page, 'tally');
  await page.waitForSelector('#twCardBody .tw-keep', { timeout: 15000 });
  const h = await head(page);
  expect(h.drawn, 'her face is at the card’s head').toBeGreaterThan(300);
  expect(h.line, 'beside the stall’s own plain line').toBe(FRONTS.exchange);
  expect(h.quote, 'and not a word of hers: she speaks in her own card (§18)').toBe(false);
  expect(h.talk, 'the way to her, by name').toBe(MARKET.keep.talk.replace('{name}', nameOf('tally')));
  expect(await page.locator('#twCardBody .tw-ex__order').count(), 'the orders are right under her').toBe(3);
  await page.screenshot({ path: 'test-results/town-keepers/tally-head.png' });
  await page.locator('#twCardBody .tw-keep__open').click();
  await page.waitForFunction((n) => { const c = document.querySelector('.tw-card--npc'); return !!(c && c.textContent.includes(n)); }, nameOf('tally'), { timeout: 10000 });
  expect(errs).toEqual([]);
});

test('…and the stall itself, tapped while she stands at it, gives the same card', async ({ page }) => {
  const errs = await town(page, 4.5);
  await tapPlace(page, 'exchange', 0.3, 0.3);   // the awning's left: never Tally, who stands in front of the counter's middle
  await page.waitForSelector('#twCardBody .tw-keep', { timeout: 15000 });
  expect((await head(page)).talk).toBe(MARKET.keep.talk.replace('{name}', nameOf('tally')));
  expect(errs).toEqual([]);
});

test('away from her post — lunch by the statue — the stall says its own line again', async ({ page }) => {
  const errs = await town(page, 8.5);
  await page.waitForFunction(() => { const t = window.__town.life.residents().find((r) => r.key === 'tally'); return t && t.at === 'monument'; }, null, { timeout: 10000 });
  await tapPlace(page, 'exchange', 0.5, 0.3);
  await page.waitForSelector('#twCardBody .tw-ex__order', { timeout: 15000 });
  expect(await page.locator('#twCardBody .tw-keep').count(), 'nobody at its head').toBe(0);
  expect(((await page.locator('#twCardBody .tw-card__sub').textContent()) || '').trim()).toBe(FRONTS.exchange);
  expect(errs).toEqual([]);
});

test('Twirl at the wheel is the wheel: tapping her opens its card with her at its head', async ({ page }) => {
  const errs = await town(page, 4.5);
  await tapResident(page, 'twirl');
  await page.waitForSelector('#twCardBody .tw-keep', { timeout: 15000 });
  expect((await head(page)).talk).toBe(MARKET.keep.talk.replace('{name}', nameOf('twirl')));
  expect(await page.locator('#twCardBody #twSpin').count(), 'the wheel’s own button is right under her').toBe(1);
  expect((await head(page)).line, 'beside the wheel’s own line').toBe(FRONTS.wheel);
  await page.screenshot({ path: 'test-results/town-keepers/twirl-head.png' });
  expect(errs).toEqual([]);
});

test('a place with only a line hands the tap to its keeper: the Town Hall to Nib, the café’s window to Bean', async ({ page }) => {
  const errs = await town(page, 4.5);
  await page.waitForFunction(() => { const n = window.__town.life.residents().find((r) => r.key === 'nib'); return n && n.at === 'hall'; }, null, { timeout: 10000 });
  await tapPlace(page, 'hall', 0.3, 0.55);
  await page.waitForFunction((n) => { const c = document.querySelector('.tw-card--npc'); return !!(c && c.textContent.includes(n)); }, nameOf('nib'), { timeout: 15000 });
  await page.evaluate(() => document.getElementById('twCardX').click());
  // the café answers at its serving window (banana-town.js CAFE_WIN): Bean's card, where the job is asked
  await page.waitForFunction(() => { const n = window.__town.life.residents().find((r) => r.key === 'bean'); return n && n.at === 'cafe'; }, null, { timeout: 10000 });
  const win = await page.evaluate(() => { const p = window.__town.PROPS.cafe; return { x: p.x + p.w / 2, y: p.y + p.h }; });
  await stand(page, win.x, win.y + 40);
  await page.waitForTimeout(500);
  const pt = await page.evaluate(([x0, y0, x1, y1]) => {
    const t = window.__town, img = document.querySelector('img.tw-ov[data-key="cafe"]').getBoundingClientRect(), p = t.PROPS.cafe;
    const sx = img.width / p.w, sy = img.height / p.h;   // world px → screen px, from the kiosk's own picture
    return { x: img.left + ((x0 + x1) / 2 - p.x) * sx, y: img.top + ((y0 + y1) / 2 - p.y) * sy };
  }, CAFE_WIN.slice(3));
  await page.mouse.click(pt.x, pt.y);
  await page.waitForFunction((q) => [...document.querySelectorAll('#twCardBody .wd-q button')].some((b) => b.textContent === q), LIFE.work.ask, { timeout: 15000 });
  expect(errs).toEqual([]);
});

test('at lunch the Town Hall says its own line: Nib is on his bench', async ({ page }) => {
  const errs = await town(page, 8.5);
  await page.waitForFunction(() => { const n = window.__town.life.residents().find((r) => r.key === 'nib'); return n && n.at !== 'hall'; }, null, { timeout: 10000 });
  await tapPlace(page, 'hall', 0.3, 0.55);
  await page.waitForFunction((l) => (document.getElementById('twToast').textContent || '').trim() === l, FRONTS.hall, { timeout: 10000 });
  expect(await page.locator('.tw-card--npc').count()).toBe(0);
  expect(errs).toEqual([]);
});
