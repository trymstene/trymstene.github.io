// 🎁🌱 A NEW BANANA'S FIRST MINUTE AND FIRST RETURN (26 Sep 2026), walked on the built site (design library §42).
//
// Trym: "i believe in 1, 2, and 5" (the first minute without reading, something waiting tomorrow, answering the return)
// and "i believe in giving secret gifts or mystery chests". What must hold:
//   · a new banana is handed Nib's present — his portrait, one short line, one button — and it opens TOMORROW
//   · on a later day it opens by itself: "You came back, <name>!", what was inside, and Wear it puts it on the banana
//   · in town, a new banana's own banana is marked, five coins lead to Nib and pay out, and Nib waves until met
// The pass worker is stubbed here; worker-pass/test/gift.test.mjs proves the server half.
import { test, expect } from '@playwright/test';
import W from '../src/data/copy/world-social.json' with { type: 'json' };

const SHOT = 'test-results/gift-';
const GID = '0123456789abcdef';

async function passStubs(page, gift) {
  const calls = [];
  await page.route('**/banana-pass.trymstene.workers.dev/**', async (r) => {
    const u = new URL(r.request().url()), b = JSON.parse(r.request().postData() || '{}');
    calls.push({ path: u.pathname, b });
    if (u.pathname === '/gift') return r.fulfill({ contentType: 'application/json', body: JSON.stringify(gift(b.act)) });
    if (u.pathname === '/anon') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ credId: 'a:test', token: 't0k3n', gid: GID }) });
    return r.fulfill({ contentType: 'application/json', body: '{}' });
  });
  await page.route('**/yards/**', (r) => r.fulfill({ contentType: 'application/json', body: '{"echoes":[],"notices":[]}' }));
  return calls;
}

test('a new banana is handed Nib’s present, and it opens tomorrow', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const calls = await passStubs(page, (act) => (act === 'give' ? { ok: true, gift: { at: Date.now(), ready: false, opened: 0, item: '' } } : { ok: true, gift: null }));
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'a:test', token: 't0k3n' })); } catch (e) {} });
  await page.goto('/park/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bwg, null, { timeout: 30000 });   // ⭐ only a new banana downloads it
  await page.evaluate(() => window.__bwg.give());   // the walk cannot wait the 45 seconds a newcomer is given first
  await page.waitForFunction(() => !!document.querySelector('.bws-card'), null, { timeout: 8000 });
  await page.waitForTimeout(450);
  const c = await page.evaluate(() => { const k = document.querySelector('.bws-card'); return { h: k.querySelector('h2').textContent, say: k.querySelector('.bws-say').textContent.trim(), btns: [...k.querySelectorAll('.bws-go, .bws-alt')].map((b) => b.textContent) }; });
  expect(c.h).toBe(W.gift.give);
  expect(c.say, 'who it is from, and that it opens tomorrow').toBe(W.gift.from);
  expect(c.btns, 'one button').toEqual([W.gift.thanks]);
  expect(calls.some((x) => x.path === '/gift' && x.b.act === 'give'), 'the pass worker was asked to hand it over').toBe(true);
  await page.screenshot({ path: SHOT + 'give.png' });
  const g = await page.evaluate(() => (JSON.parse(localStorage.getItem('bw-social-v1') || '{}') || {}).g);
  expect(g && g.at > 0 && !g.o, 'the device remembers it is waiting').toBe(true);
  await page.click('.bws-go');
  await expect(page.locator('.bws-card')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('a later day, it opens by itself, says you came back, and Wear it puts it on', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const yesterday = Date.now() - 86400000 - 3600000;
  const calls = await passStubs(page, (act) => (act === 'open'
    ? { ok: true, gift: { at: yesterday, ready: false, opened: Date.now(), item: 'squidhat' }, own: ['squidhat'], wallet: { bal: 12, seq: 3 } }
    : { ok: true, gift: { at: yesterday, ready: true, opened: 0, item: '' } }));
  await page.addInitScript((y) => {
    try {
      localStorage.setItem('pass-link', JSON.stringify({ credId: 'a:test', token: 't0k3n' }));
      localStorage.setItem('ps-name-v1', 'Sprout');
      localStorage.setItem('bw-social-v1', JSON.stringify({ g: { at: y, o: 0 } }));
      localStorage.setItem('pass-v1', JSON.stringify({ created: Date.now() - 30 * 86400000, patches: {}, days: [] }));   // no longer new: it is the present that fetches the chunk
    } catch (e) {}
  }, yesterday);
  await page.goto('/park/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('.bws-card'), null, { timeout: 15000 });
  await page.waitForTimeout(450);
  const c = await page.evaluate(() => { const k = document.querySelector('.bws-card'); return { h: k.querySelector('h2').textContent, role: k.querySelector('.bws-role').textContent, say: k.querySelector('.bws-say').textContent.trim() }; });
  expect(c.h, '⭐ it greets them by name').toBe(W.gift.backName.replace('{name}', 'Sprout'));
  expect(c.role).toBe(W.gift.nib);
  expect(c.say, 'what was inside, by its wardrobe name').toBe(W.gift.inside.replace('{item}', 'Squid hat'));
  expect(calls.some((x) => x.path === '/gift' && x.b.act === 'open'), 'the pass worker rolled it').toBe(true);
  await page.screenshot({ path: SHOT + 'back.png' });
  await page.click('.bws-go');
  await expect(page.locator('.bws-go')).toHaveText(W.gift.worn);
  const fit = await page.evaluate(() => JSON.parse(localStorage.getItem('bb-last') || '{}'));
  expect(fit.hat, 'Wear it puts it on the banana').toBe('squidhat');
  const own = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('pass-v1') || '{}'); return (p.base || {}).own_squidhat || 0; });
  expect(own, 'and the device holds what the server says it owns').toBe(1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT + 'worn.png' });
  expect(errs).toEqual([]);
});

test('the town: a new banana is marked, three coins lead to Nib and pay, and Nib waves', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await passStubs(page, () => ({ ok: true, gift: null }));
  await page.goto('/town/?towntest&welcome=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.welcome, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(11); });
  await page.waitForTimeout(1200);
  const first = await page.evaluate(() => ({ coins: window.__town.welcome.coins(), you: window.__town.welcome.you(), onMe: !!document.querySelector('.tw-me .tww-you') }));
  expect(first.coins.length, 'three coins on the way to Nib').toBe(3);
  expect(first.you && first.onMe, 'your own banana is marked').toBe(true);
  await page.screenshot({ path: SHOT + 'town-arrive.png' });
  // walk the trail: each coin under the banana pays
  const before = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('pass-v1') || '{}'); return Object.values((p.led || {}).coins_earned || {}).reduce((a, b) => a + b, 0); });
  for (const c of first.coins) {
    await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [c.x, c.y]);
    await page.waitForTimeout(250);
  }
  const after = await page.evaluate(() => ({ left: window.__town.welcome.coins().length, you: window.__town.welcome.you(), done: localStorage.getItem('tw-welcome-v1'), ev: JSON.parse(localStorage.getItem('pass-ev-v1') || '[]').filter((e) => e.s === 'trail').length }));
  expect(after.left, 'every coin picked up').toBe(0);
  expect(after.ev, '…each a coin row from the trail, for the server to judge').toBe(3);
  expect(after.done, 'and the trail is never laid on this phone again').toBe('1');
  expect(after.you, 'the arrow has gone once they are moving').toBe(false);
  // Nib waves while you stand away from him
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 1100; t.pos.y = t.tgt.y = 1230; });
  await page.waitForFunction(() => !!document.querySelector('.tw-npc[data-k="nib"] .bws-hand'), null, { timeout: 9000 });
  await page.screenshot({ path: SHOT + 'town-nib-waves.png' });
  void before;
  expect(errs).toEqual([]);
});
