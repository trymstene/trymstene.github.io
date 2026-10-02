// 🍞 THE AREAS' TOASTS COME FROM THE COPY FILES (23 Sep 2026).
//
// The park's garden, the bay's captain, the rave's big moments, the builder and the pass page had their words
// typed into toast('…') calls, and tools/check-literal-says.mjs carried them as owed. They live in
// src/data/copy/*-toasts.json now. This walk proves the other half on the built site: a moment in each place says
// the file's line, filled with the game's own numbers, and none of them prints a {placeholder}.
import { test, expect } from '@playwright/test';
import PARK from '../src/data/copy/park-toasts.json' with { type: 'json' };
import BEACH from '../src/data/copy/beach-toasts.json' with { type: 'json' };
import WL from '../src/data/copy/world-level.json' with { type: 'json' };
import BUILDER from '../src/data/copy/builder-toasts.json' with { type: 'json' };
import PASS from '../src/data/copy/pass-toasts.json' with { type: 'json' };

// a copy line with holes, as a pattern: the words exact, each {hole} any text
const shaped = (line) => new RegExp('^' + line.split(/\{\w+\}/).map((s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('.+?') + '$');
const watch = (page) => { const errs = []; page.on('pageerror', (e) => errs.push(String(e))); return errs; };
const textOf = (page, sel) => page.evaluate((s) => ((document.querySelector(s) || {}).textContent || '').trim(), sel);

test('the park: an egg and a golden egg say the file’s lines, filled', async ({ page }) => {
  const errs = watch(page);
  await page.goto('/park/?parktest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__park && window.__park.egg && window.__park.warp), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  // an egg laid just right of you, then walked onto
  const pick = async (golden) => {
    await page.evaluate((g) => window.__park.egg(g), golden ? 1 : 0);
    await page.waitForTimeout(300);
    await page.evaluate(() => { const p = window.__park.pos; window.__park.warp(p.x + 60, p.y + 6); });
    await page.waitForFunction(() => /🥚/.test((document.getElementById('pkToast') || {}).textContent || ''), null, { timeout: 8000 });
    const said = await textOf(page, '#pkToast');
    if (golden) await page.screenshot({ path: 'test-results/area-toasts/park-egg.png' });
    await page.evaluate(() => { document.getElementById('pkToast').textContent = ''; });
    return said;
  };
  const plain = await pick(false);
  // the shim pays coins three times in four and beach tickets otherwise
  const ok = shaped('🥚 ' + PARK.garden.eggCoins).test(plain) || shaped('🥚 ' + PARK.garden.eggTickets).test(plain);
  expect(ok, 'an egg says the file’s coin or ticket line: ' + plain).toBe(true);
  const gold = await pick(true);
  expect(gold, 'the golden egg: ' + gold).toMatch(shaped('🥚✨ ' + PARK.garden.eggGolden));
  for (const s of [plain, gold]) expect(s, 'no hole left open').not.toMatch(/\{\w+\}/);
  expect(errs).toEqual([]);
});

test('the bay: the captain points at today’s treasure in the file’s words', async ({ page }) => {
  const errs = watch(page);
  await page.goto('/beach/?beachtest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.__bay && window.__bay.pos), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  // his wreck (beach-geo BAR: 1700, 760, r 104) — walk into it and he greets you
  await page.evaluate(() => { const b = window.__bay; b.pos.x = b.tgt.x = 1700; b.pos.y = b.tgt.y = 800; });
  await page.waitForFunction(() => ((document.getElementById('bhCapBubble') || {}).textContent || '').trim().length > 0, null, { timeout: 8000 });
  const said = await textOf(page, '#bhCapBubble');
  const found = await page.evaluate(() => window.__bay.treasureFound());
  expect(said, 'the captain’s line').toBe(found ? BEACH.captain.lines[0] : '🗺 ' + BEACH.captain.treasure);
  await page.waitForTimeout(1500);   // the camera eases over to him
  await page.screenshot({ path: 'test-results/area-toasts/bay-captain.png' });
  expect(errs).toEqual([]);
});

// the rave's level-up, paid the floor's own way: a pass a heart short of a level, then one paid heart. A level is the
// world's now (src/lib/world-xp.js, design library §53), in src/data/copy/world-level.json's words. The room is answered
// here with a roster of one, you, so no real player sees this banana and none is seen.
async function raveAt(page, rep) {
  await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  await page.routeWebSocket(/workers\.dev/, (ws) => {
    ws.onMessage((m) => {
      let d = null; try { d = JSON.parse(String(m)); } catch (e) { return; }
      if (d && d.t === 'hi') ws.send(JSON.stringify({ t: 'roster', you: 'qa-me', all: [{ id: 'qa-me', outfit: d.outfit || {}, name: '', joined: Date.now(), lvl: d.lvl }] }));
    });
  });
  await page.addInitScript((r) => {
    try {
      if (!sessionStorage.getItem('qa-seeded')) {
        localStorage.clear();
        localStorage.setItem('pass-v1', JSON.stringify({ base: { rep: r } }));
        localStorage.setItem('rv-tour-v1', '1');
        localStorage.setItem('cookie-consent-v1', 'n');
        sessionStorage.setItem('qa-seeded', '1');
      }
    } catch (e) {}
  }, rep);
  await page.goto('/rave/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.rv-raver--me', { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.locator('.rv-emote-btn[data-emote="heart"]').click({ force: true });
}

test('the rave: a new title is the world’s big moment, in the world’s words', async ({ page }) => {
  const errs = watch(page);
  await raveAt(page, 1049);   // level 4, one heart from level 5 — "On the List"
  await page.waitForSelector('.wm-moment b', { timeout: 8000 });
  const big = await page.evaluate(() => { const d = document.querySelector('.wm-moment'); return { b: d.querySelector('b').textContent, s: d.querySelector('small').textContent }; });
  expect(big.b, 'the headline').toBe(WL.title.replace('{n}', '5'));
  expect(big.s, 'the title, then what comes next').toBe('On the List\n' + WL.next.replace('{at}', '10'));
  await page.waitForTimeout(700);   // it fades in
  await page.screenshot({ path: 'test-results/area-toasts/rave-title.png' });
  expect(errs).toEqual([]);
});

test('the rave: a plain level-up is "LVL N" off your banana, never a toast', async ({ page }) => {
  const errs = watch(page);
  await raveAt(page, 194);    // level 1, one heart from level 2 — same rank
  await page.waitForSelector('.wx-riser b', { timeout: 8000 });
  expect(await textOf(page, '.wx-riser b')).toBe(WL.riser.replace('{n}', '2'));
  expect(await textOf(page, '#passToast'), 'the level is the chip’s and the riser’s, never a toast').not.toMatch(/level|lvl/i);
  expect(errs).toEqual([]);
});

test.describe('the builder', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
  test('copying a share link says the file’s line', async ({ page }) => {
    const errs = watch(page);
    // the card worker is not what this proves: a refusal keeps the plain link
    await page.route('https://banana-share.trymstene.workers.dev/**', (r) => r.fulfill({ status: 503, body: '' }));
    await page.goto('/make-a-banana/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#bbShare', { timeout: 30000 });
    await page.waitForTimeout(800);
    // ⚠️ the page's markup ships the toast with a word already in it — empty it, so only the click can fill it
    await page.evaluate(() => { document.getElementById('bbToast').textContent = ''; });
    await page.locator('#bbShare').click();
    await page.waitForFunction(() => /\S/.test((document.getElementById('bbToast') || {}).textContent || ''), null, { timeout: 15000 });
    expect(await textOf(page, '#bbToast')).toBe(BUILDER.share.plain);
    await page.screenshot({ path: 'test-results/area-toasts/builder-share.png' });
    expect(errs).toEqual([]);
  });
});

test('the pass page: a new name is official in the file’s words', async ({ page }) => {
  const errs = watch(page);
  await page.goto('/pass/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#psNameEdit', { timeout: 30000 });
  await page.locator('#psNameEdit').click();
  await page.locator('#psNameInput').fill('Ziggy');
  await page.locator('#psNameInput').press('Enter');
  await page.waitForFunction(() => /\S/.test((document.getElementById('passToast') || {}).textContent || ''), null, { timeout: 8000 });
  expect(await textOf(page, '#passToast')).toBe('🎫 Ziggy — ' + PASS.name.official);
  await page.screenshot({ path: 'test-results/area-toasts/pass-name.png' });
  expect(errs).toEqual([]);
});
