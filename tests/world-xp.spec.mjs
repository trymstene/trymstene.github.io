// ✨ XP YOU CAN FEEL, IN EVERY AREA (2 Oct 2026, design library §53). Trym: "i dont feel XP in banana world FEELS great";
// then, of the first cut's sparks: "its better with a soft pulsating golden glow around the banana when experience points
// are received, and that the XP-bar also glows up at the same time … and an animation showing the xp bar growing". Every
// grant goes passStat → 'pass:rep' → the world HUD → src/lib/world-xp.js. In each area: the LVL chip HOLDS until the beat,
// then a glow pulses round your banana as "+N XP" rises, the chip lights and its bar grows into the part just earned; a
// level crossed rides "LVL N" up off your banana, and a new title is the world's big moment in the words of
// src/data/copy/world-level.json. Nothing reaches a worker or a real player.
import { test, expect } from '@playwright/test';
import WL from '../src/data/copy/world-level.json' with { type: 'json' };

const NOISE = /workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/;
// levelStep(n) = 150 + 45n (pass-defs.js): LVL 11 starts at 3 975, LVL 20 ("The Regular") at 11 400
const NEAR_11 = 3960, NEAR_20 = 11390;
const AREAS = [
  { name: 'town', url: '/town/?towntest&xptest', ready: () => !!(window.__town && window.__town.room && window.__town.room.band()), me: '.tw-me' },
  { name: 'park', url: '/park/?parktest&xptest', ready: () => !!window.__park, me: '#pkMe' },
  { name: 'beach', url: '/beach/?beachtest&xptest', ready: () => !!window.__bay, me: '#bhMe' },
  { name: 'homestead', url: '/homestead/?hstest=rich&xptest', ready: () => !!window.__hs, me: '#hsMe' },
  { name: 'rave', url: '/rave/?xptest', ready: () => !!document.querySelector('.rv-raver--me'), me: '.rv-raver--me' },
];

async function open(page, a, rep) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(NOISE, (r) => r.abort());
  // no live room: no real player sees this banana, and none is seen. The club's floor puts you on it only when its room
  // names you, so its socket is answered here with a roster of one: you.
  await page.routeWebSocket(/workers\.dev/, (ws) => {
    ws.onMessage((m) => {
      let d = null; try { d = JSON.parse(String(m)); } catch (e) { return; }
      if (d && d.t === 'hi') ws.send(JSON.stringify({ t: 'roster', you: 'qa-me', all: [{ id: 'qa-me', outfit: d.outfit || {}, name: '', joined: Date.now(), lvl: d.lvl }] }));
    });
  });
  await page.addInitScript((rep) => {
    if (sessionStorage.getItem('xp-seeded')) return;
    sessionStorage.setItem('xp-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('cookie-consent-v1', 'n');
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    localStorage.setItem('rv-tour-v1', '1');   // the club's first-visit tour would hold the floor
    localStorage.setItem('pass-v1', JSON.stringify({ created: Date.now() - 10 * 864e5, patches: {}, stats: { rep }, days: [new Date().toISOString().slice(0, 10)] }));
  }, rep);
  await page.goto(a.url);
  await page.waitForFunction(a.ready, null, { timeout: 30000 });
  await page.waitForFunction(() => !!window.__xp, null, { timeout: 10000 });
  await page.waitForTimeout(900);
  return errs;
}
const lvl = (page) => page.evaluate(() => { const n = document.querySelector('.wh__lvln, [data-wh="lvln"]'); return n ? n.textContent.trim() : null; });

// the fill's scale on the bar (the HUD paints it as scaleX)
const fillOf = (page) => page.evaluate(() => {
  const f = document.querySelector('.wh__lvl .wh__lvlbar i, [data-wh="lvlfill"]');
  const m = f && getComputedStyle(f).transform.match(/matrix\(([-\d.e]+)/);
  return m ? Number(m[1]) : null;
});
for (const a of AREAS) {
  test(`${a.name}: XP glows round your banana, orbs fly into the pill and its bar counts up, and a level rides up off it`, async ({ page }) => {
    const errs = await open(page, a, 3900);   // LVL 10, 75 short of LVL 11 (3 975)
    expect(await lvl(page)).toBe('LVL 10');
    const f0 = await fillOf(page);
    await page.evaluate(() => window.__xp.grant(20));
    expect(await lvl(page), '⭐ the chip holds until the beat (§30.2)').toBe('LVL 10');
    // "+20 XP" beside the head — on the rave's floor its own trickle (a spotlight's +2 a beat) may come first or fold in
    const plusRe = new RegExp('^' + WL.plus.replace('+', '\\+').replace('{n}', '(\\d+)') + '$');
    await expect.poll(() => page.$$eval('.wx-plus', (ns) => ns.map((n) => n.textContent.trim())).then((ts) => ts.some((t) => {
      const m = t.match(plusRe); return !!m && (a.name === 'rave' ? Number(m[1]) >= 20 : Number(m[1]) === 20);
    })), { timeout: 5000, message: 'the label' }).toBe(true);
    // the beat: the glow hugging the banana, behind it, pulsing in, and orbs of the same light on their way to the pill
    await expect.poll(() => page.locator('.wx-orb').count(), { timeout: 5000, message: 'the orbs fly' }).toBeGreaterThan(0);
    expect(await lvl(page), 'the pill holds while they are out (§30.2)').toBe('LVL 10');
    await expect.poll(() => page.evaluate((sel) => { const g = document.querySelector(sel + ' > .wx-halo'); return g ? Number(getComputedStyle(g).opacity) : 0; }, a.me), { timeout: 4000, message: 'the banana glows' }).toBeGreaterThan(0.3);
    expect(await page.evaluate((sel) => getComputedStyle(document.querySelector(sel + ' > .wx-halo')).zIndex, a.me), 'behind the banana').toBe('-1');
    await page.waitForTimeout(120);
    await page.screenshot({ path: `test-results/world-xp-${a.name}-orbs.png` });
    // the last one in: the pill lit up, its bar flashing up to the new length
    await expect.poll(() => page.locator('.wx-gain').count(), { timeout: 4000, message: 'the part just earned is lit on the bar' }).toBeGreaterThan(0);
    expect(await page.locator('.wx-glow').count(), 'the pill glows').toBe(1);
    await expect.poll(() => fillOf(page), { timeout: 2000, message: 'the bar grows' }).toBeGreaterThan(f0 + 0.02);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `test-results/world-xp-${a.name}-glow.png` });
    // and a level: the bar fills to the top and starts again, "LVL 11" rides up off the banana
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__xp.grant(60));
    await expect.poll(() => lvl(page), { timeout: 5000 }).toBe('LVL 11');
    await expect.poll(() => page.locator('.wx-riser').count(), { timeout: 2000 }).toBeGreaterThan(0);
    expect((await page.locator('.wx-riser b').first().textContent()).trim()).toBe(WL.riser.replace('{n}', '11'));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/world-xp-${a.name}-level.png` });
    expect(errs).toEqual([]);
  });
}

for (const a of AREAS) {
  const name = a.name;
  test(`${name}: a new title is the world's big moment, in the world's words`, async ({ page }) => {
    const errs = await open(page, a, NEAR_20);
    expect(await lvl(page)).toBe('LVL 19');
    await page.evaluate(() => window.__xp.grant(20));
    await expect.poll(() => page.locator('.wm-moment b').count(), { timeout: 8000 }).toBe(1);
    expect((await page.locator('.wm-moment b').textContent()).trim()).toBe(WL.title.replace('{n}', '20'));
    expect((await page.locator('.wm-moment small').textContent()).trim()).toBe('The Regular\n' + WL.next.replace('{at}', '35'));
    expect(await page.locator('.wx-riser').count(), 'a title IS the bigger riser: never both').toBe(0);
    expect(await lvl(page)).toBe('LVL 20');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/world-xp-${name}-title.png` });
    expect(errs).toEqual([]);
  });
}

test('town: the last level is a big moment too, never only the riser', async ({ page }) => {
  const errs = await open(page, AREAS[0], 232985);   // LVL 98; level 99 starts at 232 995
  expect(await lvl(page)).toBe('LVL 98');
  await page.evaluate(() => window.__xp.grant(20));
  await expect.poll(() => page.locator('.wm-moment b').count(), { timeout: 5000 }).toBe(1);
  expect((await page.locator('.wm-moment b').textContent()).trim()).toBe(WL.title.replace('{n}', '99'));
  expect((await page.locator('.wm-moment small').textContent()).trim()).toBe('Practically Staff\n' + WL.max);
  expect(await page.locator('.wx-riser').count()).toBe(0);
  expect(await lvl(page)).toBe('LVL 99');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/world-xp-town-99.png' });
  expect(errs).toEqual([]);
});

test.describe('the smallest phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test('the longest title and what comes next are two lines, neither wrapped', async ({ page }) => {
    const errs = await open(page, AREAS[0], 88490);   // LVL 59; level 60 is "Legend of the Floor"
    await page.evaluate(() => window.__xp.grant(20));
    await expect.poll(() => page.locator('.wm-moment small').count(), { timeout: 5000 }).toBe(1);
    expect((await page.locator('.wm-moment small').textContent()).trim()).toBe('Legend of the Floor\n' + WL.next.replace('{at}', '90'));
    await page.waitForTimeout(400);   // in, at full size
    const lines = await page.evaluate(() => {
      const r = document.createRange(); r.selectNodeContents(document.querySelector('.wm-moment small'));
      return new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size;
    });
    expect(lines, 'the title, then the next one: two lines, never a phrase broken').toBe(2);
    await page.screenshot({ path: 'test-results/world-xp-town-360-title.png' });
    expect(errs).toEqual([]);
  });
});

// ⚠️ reduced motion is page.emulateMedia: `test.use({ reducedMotion })` is no test option, and this walk once passed
// while the sparks flew under it
test('reduced motion: the glows stand still, the chip says it in the beat, and the level still shows (§3d)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errs = await open(page, AREAS[0], NEAR_11);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'the page sees it').toBe(true);
  await page.evaluate(() => window.__xp.grant(20));
  let orbs = 0;
  await expect.poll(async () => { orbs = Math.max(orbs, await page.locator('.wx-orb').count()); return lvl(page); }, { timeout: 1500, intervals: [50] }).toBe('LVL 11');
  expect(orbs, 'no orb flies').toBe(0);
  const moving = await page.evaluate(() => [...document.querySelectorAll('.wx-halo, .wx-glow, .wx-gain, .wh__lvl, [data-wh="lvl"]')].reduce((n, e) => n + e.getAnimations().length, 0));
  expect(moving, 'nothing pulses, swells or shakes').toBe(0);
  expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.tw-me > .wx-halo')).opacity)), 'the glow is still there, still').toBeGreaterThan(0.3);
  expect(await page.locator('.wx-riser').count(), 'a still riser, never nothing').toBeGreaterThan(0);
  expect(await page.locator('.wx-plus').count(), 'and the amount, still').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('a pickup plays at once, and a trickle behind it merges: two beats for twelve grants, on the true total', async ({ page }) => {
  const errs = await open(page, AREAS[1], 1040);   // LVL 4; 24 more crosses into LVL 5 at 1 050
  // every "+N XP" the page puts up, in order (a label lives 1.4 s; the second comes after the first beat)
  await page.evaluate(() => { window.__labels = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('wx-plus')) window.__labels.push(n.textContent.trim()); }).observe(document.body, { childList: true, subtree: true }); });
  const t0 = Date.now();
  await page.evaluate(() => window.__xp.grant(2));
  // ⚡ the first one at once (Trym: "it takes some time from picking up garbage to the glow") — no merge window to wait out
  await expect.poll(() => page.locator('.wx-orb').count(), { timeout: 400, intervals: [20] }).toBeGreaterThan(0);
  expect(Date.now() - t0, 'the orbs leave within a few frames of the grant').toBeLessThan(400);
  for (let i = 0; i < 11; i++) { await page.evaluate(() => window.__xp.grant(2)); await page.waitForTimeout(25); }
  await expect.poll(() => page.evaluate(() => window.__labels.length), { timeout: 4000 }).toBe(2);
  expect(await page.evaluate(() => window.__labels), 'the pickup, then the rest of the trickle as one').toEqual([WL.plus.replace('{n}', '2'), WL.plus.replace('{n}', '22')]);
  await expect.poll(() => lvl(page), { timeout: 4000 }).toBe('LVL 5');
  expect(errs).toEqual([]);
});
