// 🎉 THE FRONT PAGE'S PARTY (26 Sep 2026). Trym: "hello there, and welcome to BANANA WORLD … small text on top and
// banana world in a slight arc and big text", "some movement and animations are nice and lively overall", the hero
// buttons with "no icons", a crew you can tap, and a live ticker of the world's best numbers "based on popularity".
// Walked on the BUILT page: the words are the copy file's, the main door stays above the fold down to a 360×640 phone,
// the crew stands at whole device pixels, five coins turn the pill into a door into the town without covering the
// banana, the ticker's numbers are the stats file's read low, the live lines come only when the world answers, and
// nothing loops under reduced motion or off screen.
import { test, expect } from '@playwright/test';
import W from '../src/data/copy/home-hero.json' with { type: 'json' };
import STATS from '../src/data/home-stats.json' with { type: 'json' };

const RAVE = /banana-rave\.trymstene\.workers\.dev\/(count|town-count|park-count|beach-count|town-life)/;
const POT = /banana-pass\.trymstene\.workers\.dev\/town\/pot/;
const json = (o) => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
// the world's public counters, answered here: { rave, town, park, beach, fixes, people, pot } — or null to refuse them all
async function world(page, w) {
  await page.route(/googletagmanager|google-analytics|connect\.facebook|cloudflareinsights/, (r) => r.abort());
  await page.route(RAVE, (r) => {
    if (!w) return r.abort();
    const k = new URL(r.request().url()).pathname.slice(1);
    if (k === 'town-life') return r.fulfill(json({ life: 70, band: 'lively', today: { fixes: w.fixes, people: w.people } }));
    return r.fulfill(json({ count: w[{ count: 'rave', 'town-count': 'town', 'park-count': 'park', 'beach-count': 'beach' }[k]] }));
  });
  await page.route(POT, (r) => (w ? r.fulfill(json({ pot: w.pot })) : r.abort()));
}
const QUIET = { rave: 0, town: 0, park: 0, beach: 0, fixes: 0, people: 0, pot: 0 };
const fill = (line, holes) => line.replace(/\{(\w+)\}/g, (m, k) => holes[k]);
const EMOJI = /\p{Extended_Pictographic}/u;

test('the welcome: the hello over the arched name, the line under the dancers, and two doors with no icons', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await world(page, QUIET);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const h1 = page.locator('#hero h1');
  expect((await h1.textContent()).replace(/\s+/g, ' ').trim()).toBe(`${W.kicker} ${W.title}`);
  await expect(page.locator('.hw__kicker')).toHaveText(W.kicker);
  expect(await page.locator('.hw__l').count(), 'a letter per letter of the name').toBe(W.title.replace(/ /g, '').length);
  await expect(page.locator('.hw__tag')).toHaveText(W.tag);
  await expect(page.locator('.hw__banana')).toHaveAttribute('alt', W.alt);
  await expect(page.locator('.hw__banana')).toHaveAttribute('src', '/assets/dancing-banana-transparent.gif');
  // the doors: the words and a drawn arrow, and nothing else — no emoji, no pixel icon, no picture
  const go = page.locator('.hw__go');
  expect((await go.textContent()).trim()).toBe(W.enter + '→');
  await expect(go).toHaveAttribute('href', '/town/');
  await expect(page.locator('.hw__make')).toHaveText(W.make);
  for (const b of [go, page.locator('.hw__make')]) {
    expect(await b.locator('svg, img, .pai, .pxi').count(), 'no icon on a hero door').toBe(0);
    expect(await b.textContent()).not.toMatch(EMOJI);
  }
  // every door into the town on this page says the same words, with no globe
  for (const t of await page.locator('a[href="/town/"].btn').allTextContents()) expect(t).not.toMatch(EMOJI);
  expect(errors).toEqual([]);
});

for (const [w, h] of [[360, 640], [375, 667], [393, 852], [768, 1024], [1280, 720], [1440, 900]]) {
  test(`${w}×${h}: the main door is on the first screen and nothing scrolls sideways`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await world(page, QUIET);
    await page.goto('/', { waitUntil: 'load' });
    const m = await page.evaluate(() => ({ go: document.querySelector('.hw__go').getBoundingClientRect().bottom, vh: innerHeight, sw: document.documentElement.scrollWidth, vw: innerWidth }));
    expect(m.go, 'Enter Banana World is above the fold').toBeLessThanOrEqual(m.vh);
    expect(m.sw, 'no sideways scroll').toBeLessThanOrEqual(m.vw);
  });
}

test.describe('the crew at a 2.625 phone', () => {
  test.use({ deviceScaleFactor: 2.625, viewport: { width: 393, height: 852 } });
  test('one dancer a side on a phone, and every art pixel a whole number of device pixels', async ({ page }) => {
    await world(page, QUIET);
    await page.goto('/', { waitUntil: 'load' });
    const d = await page.evaluate(() => [...document.querySelectorAll('.hw__d')].filter((x) => getComputedStyle(x).display !== 'none')
      .map((x) => x.getBoundingClientRect().width * devicePixelRatio));
    expect(d).toHaveLength(2);
    // 35 art pixels wide: 2 × 2.625 = 5.25 device pixels an art pixel, snapped to 5 (design library §6, §25)
    for (const px of d) expect(Math.abs(px / 35 - Math.round(px / 35)), `${px} device px is not a whole number per art pixel`).toBeLessThan(0.01);
  });
});

test('a wide desk: four dancers a side, all dancing on the banana’s beat', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await world(page, QUIET);
  await page.goto('/', { waitUntil: 'load' });
  expect(await page.evaluate(() => [...document.querySelectorAll('.hw__d')].filter((x) => getComputedStyle(x).display !== 'none').length)).toBe(8);
  const dance = await page.evaluate(() => document.getAnimations().filter((a) => a.animationName === 'hwDance').map((a) => a.effect.getTiming().duration));
  expect(dance.length).toBeGreaterThanOrEqual(8);
  for (const ms of dance) expect(ms, 'eight frames in the GIF’s 0.8 s').toBe(800);
});

test('five taps on the dancers: the coins land in a pill under the banana, and the fifth makes it a door into the town', async ({ page }) => {
  await world(page, QUIET);
  await page.goto('/', { waitUntil: 'load' });
  const pill = page.locator('.hw__coins');
  await expect(pill).toBeHidden();
  const dancers = page.locator('.hw__d:visible');
  for (let i = 0; i < 5; i++) { await dancers.nth(i % 2).click(); await page.waitForTimeout(120); }
  await expect(pill.locator('b')).toHaveText('5', { timeout: 4000 });
  await expect(pill).toHaveClass(/is-done/);
  await expect(page.locator('.hw__hint'), 'the sticker goes once somebody taps').toBeHidden();
  await expect(pill).toHaveAttribute('href', '/town/');
  await expect(pill).toHaveAttribute('data-place', 'hero-game');
  expect((await pill.locator('.hw__done').textContent()).trim()).toBe(W.play.done + '→');
  // it sits under the stage, never over the banana's feet, and inside the screen
  const [p, s] = await Promise.all([pill.boundingBox(), page.locator('.hw__stage').boundingBox()]);
  expect(p.y, 'the pill is under the banana').toBeGreaterThanOrEqual(s.y + s.height - 1);
  expect(p.x).toBeGreaterThanOrEqual(0);
  expect(p.x + p.width).toBeLessThanOrEqual(393);
  await page.waitForTimeout(900);
  expect(await page.locator('.hw__fly').count(), 'every flying coin landed and was cleared').toBe(0);
  // ⚠️ the hero clips, it does not scroll: overflow:hidden made it a scroll container, and bringing a dancer or a door
  // into view slid the whole party sideways
  await page.locator('.hw__make').focus();
  expect(await page.evaluate(() => document.querySelector('#hero').scrollLeft), 'the hero never scrolls sideways').toBe(0);
});

test('a tap on the banana throws confetti, and the confetti clears itself', async ({ page }) => {
  await world(page, QUIET);
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('.hw__banana').click();
  expect(await page.locator('.hw__bit').count()).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.hw__bit')).toHaveCount(0, { timeout: 4000 });
});

// ⚠️ GA4 runs on the production host only (main.js returns before it on localhost), so the built site is served as
// http://trymstene.com here, the tests/world-door.spec.mjs way: every request for it answered by the local preview
test('the plays are counted once each, on the real analytics path', async ({ page }) => {
  await world(page, QUIET);
  await page.route('http://trymstene.com/**', async (route) => {
    const u = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: 'http://127.0.0.1:4321' + u.pathname + u.search }) });
  });
  await page.goto('http://trymstene.com/', { waitUntil: 'load' });
  expect(await page.evaluate(() => typeof window.gtag)).toBe('function');
  const dancers = page.locator('.hw__d:visible');
  for (let i = 0; i < 6; i++) { await dancers.nth(i % 2).click(); await page.waitForTimeout(120); }
  await page.locator('.hw__banana').click();
  await expect(page.locator('.hw__coins b')).toHaveText('6', { timeout: 4000 });
  const ev = await page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a)).filter((a) => a[0] === 'event').map((a) => a[1]));
  expect(ev.filter((e) => e === 'hero_play')).toHaveLength(1);
  expect(ev.filter((e) => e === 'hero_play_5')).toHaveLength(1);
});

test('the ticker: the stats file’s numbers read low with a plus, and the live lines in front when the world answers', async ({ page }) => {
  await world(page, { rave: 3, town: 2, park: 0, beach: 1, fixes: 80, people: 7, pot: 122 });
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('.tk__half').first().locator('.tk__i--live')).toHaveCount(3, { timeout: 8000 });
  const half = page.locator('.tk__half').first();
  const items = (await half.locator('.tk__i').allTextContents()).map((t) => t.trim());
  // the live three lead, in their order, with the spaces around each number kept
  expect(items.slice(0, 3)).toEqual([
    fill(W.ticker.world, { n: 6 }),
    fill(W.ticker.town, { fixes: 80, people: 7 }),
    fill(W.ticker.pot, { pot: 122 }),
  ]);
  // then every all-time number, from the stats file, read low with a plus; and the lines between them
  for (const s of W.ticker.stats) expect(items, s.key).toContain(fill(s.line, { n: STATS.n[s.key].toLocaleString('en-GB') + '+' }));
  for (const l of W.ticker.lines) expect(items).toContain(l);
  expect(items.join(' ')).not.toContain('{');
  // the two halves carry the same line, so the loop has no seam
  expect(await page.locator('.tk__half').nth(1).locator('.tk__i').allTextContents()).toEqual(await half.locator('.tk__i').allTextContents());
  // a number is a <b>, never markup from the copy file
  expect(await half.locator('.tk__i--live b').allTextContents()).toEqual(['6', '80', '7', '122']);
});

test('the ticker: one banana is one banana, and a quiet or unreachable world adds no live line', async ({ page, context }) => {
  await world(page, { ...QUIET, rave: 1, fixes: 1, people: 1, pot: 1 });
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('.tk__half').first().locator('.tk__i--live')).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('.tk__half').first().locator('.tk__i--live')).toHaveText(W.ticker.worldOne);
  for (const w of [QUIET, null]) {
    const p = await context.newPage();
    await world(p, w);
    await p.goto('/', { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    expect(await p.locator('.tk__i--live').count(), w ? 'a quiet world' : 'workers that do not answer').toBe(0);
    expect(await p.locator('.tk__i').count(), 'the all-time lines still run').toBeGreaterThan(10);
    await p.close();
  }
});

test('reduced motion: the rays, the letters, the crew and the confetti stand still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await world(page, QUIET);
  await page.goto('/', { waitUntil: 'load' });
  const names = await page.evaluate(() => document.getAnimations().map((a) => a.animationName).filter((n) => /^hw/.test(n)));
  for (const n of ['hwSpin', 'hwDance', 'hwWave', 'hwFall', 'hwShine', 'hwNudge']) expect(names, n).not.toContain(n);
  await expect(page.locator('.hw__conf')).toBeHidden();
});

test('off screen, the party rests; back on screen, it dances again', async ({ page }) => {
  await world(page, QUIET);
  await page.goto('/', { waitUntil: 'load' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#hero')).toHaveClass(/hw--rest/);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.hw__rays')).animationPlayState)).toBe('paused');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('#hero')).not.toHaveClass(/hw--rest/);
});
