// ✨ XP THAT LANDS LIKE COINS, IN EVERY AREA (2 Oct 2026, design library §53). Trym: "i dont feel XP in banana world FEELS
// great, in the way getting banana coins does when getting coins on the spinning wheel". Every grant goes passStat →
// 'pass:rep' → the world HUD → src/lib/world-xp.js. In each area: the LVL chip HOLDS when XP is granted, sparks fly from
// your banana into it, the level lands after them, a level crossed rides "LVL N" up off your banana, and a new title is
// the world's big moment in the words of src/data/copy/world-level.json. Nothing reaches a worker or a real player.
import { test, expect } from '@playwright/test';
import WL from '../src/data/copy/world-level.json' with { type: 'json' };

const NOISE = /workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/;
// levelStep(n) = 150 + 45n (pass-defs.js): LVL 11 starts at 3 975, LVL 20 ("The Regular") at 11 400
const NEAR_11 = 3960, NEAR_20 = 11390;
const AREAS = [
  { name: 'town', url: '/town/?towntest&xptest', ready: () => !!(window.__town && window.__town.room && window.__town.room.band()) },
  { name: 'park', url: '/park/?parktest&xptest', ready: () => !!window.__park },
  { name: 'beach', url: '/beach/?beachtest&xptest', ready: () => !!window.__bay },
  { name: 'homestead', url: '/homestead/?hstest=rich&xptest', ready: () => !!window.__hs },
  { name: 'rave', url: '/rave/?xptest', ready: () => !!document.querySelector('.rv-raver--me') },
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

for (const a of AREAS) {
  test(`${a.name}: XP flies from your banana into the LVL chip, and the level lands after it`, async ({ page }) => {
    const errs = await open(page, a, NEAR_11);
    expect(await lvl(page)).toBe('LVL 10');
    await page.evaluate(() => window.__xp.grant(20));
    expect(await lvl(page), '⭐ the chip holds where it stood (§30.2)').toBe('LVL 10');
    await expect.poll(() => page.locator('.wx-spark').count(), { timeout: 3500 }).toBeGreaterThan(0);
    expect(await lvl(page), 'still holding while the sparks are out').toBe('LVL 10');
    const plusText = (await page.locator('.wx-plus').first().textContent()).trim();
    if (a.name === 'rave') {
      // the floor pays on its own too (a spotlight's +2 per rhythm tick), and the merge window folds that in: correct
      const m = plusText.match(new RegExp('^' + WL.plus.replace('+', '\\+').replace('{n}', '(\\d+)') + '$'));
      expect(m && Number(m[1]), plusText).toBeGreaterThanOrEqual(20);
    } else {
      expect(plusText).toBe(WL.plus.replace('{n}', '20'));
    }
    await page.waitForTimeout(200);   // the label has faded in; the sparks are mid-swoop
    await page.screenshot({ path: `test-results/world-xp-${a.name}-flight.png` });
    await expect.poll(() => lvl(page), { timeout: 4000 }).toBe('LVL 11');
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
    await expect.poll(() => page.locator('.wm-moment b').count(), { timeout: 5000 }).toBe(1);
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

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the chip says it at once, no sparks fly, and the level still shows (§3d)', async ({ page }) => {
    const errs = await open(page, AREAS[0], NEAR_11);
    await page.evaluate(() => window.__xp.grant(20));
    await expect.poll(() => lvl(page), { timeout: 2000 }).toBe('LVL 11');
    expect(await page.locator('.wx-spark').count()).toBe(0);
    expect(await page.locator('.wx-riser').count(), 'a still riser, never nothing').toBeGreaterThan(0);
    expect(errs).toEqual([]);
  });
});

test('a trickle merges: many small grants fly as one batch, and the chip lands on the true total', async ({ page }) => {
  const errs = await open(page, AREAS[1], 1040);   // LVL 4; 24 more crosses into LVL 5 at 1 050
  for (let i = 0; i < 12; i++) { await page.evaluate(() => window.__xp.grant(2)); await page.waitForTimeout(25); }
  await expect.poll(() => page.locator('.wx-plus').count(), { timeout: 2500 }).toBeGreaterThan(0);
  expect(await page.locator('.wx-plus').count(), 'one label for the whole trickle').toBe(1);
  expect((await page.locator('.wx-plus').first().textContent()).trim()).toBe(WL.plus.replace('{n}', '24'));
  await expect.poll(() => lvl(page), { timeout: 4000 }).toBe('LVL 5');
  expect(errs).toEqual([]);
});
