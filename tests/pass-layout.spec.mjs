// 📐 THE PASS PAGE KEEPS ITS BLOCKS IN THEIR PLACES (29 Sep 2026). Trym, on his own pass: "something weird showed up at the
// Pass page on my profile - maybe do a little review of the Pass page if theres some bugs here that does this". The week's
// standing ("This week you are 2nd for Neighbour, 1st for Farmer.") sat alone in the top-left corner above the card, behind a
// frame icon that read as an empty checkbox (a sparkle now). The page orders its blocks with CSS `order`, and one with none is order 0 —
// first. On a phone the membership card stood over the pass too. And a fresh pass said "1 DAYS ON THE PASS": its singular
// rule held a raw BACKSPACE where \b belonged. Design library §46; tools/check-design.mjs checks the spine and the bytes.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import WORDS from '../src/data/copy/pass-toasts.json' with { type: 'json' };

const GID = 'qa-pass-layout-1';
const TAG = createHash('sha256').update(GID).digest('hex').slice(0, 8);

async function pass(page, { member = true, standing = true, made = false, manage = null } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  // nothing leaves the machine; the week's plaques are this pass 2nd for Neighbour and 1st for Farmer. ⚠️ the LAST route
  // added answers first, so every stub goes in after the blanket abort
  await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
  if (standing) await page.route(/banana-pass\.trymstene\.workers\.dev\/citizen/, (r) => r.fulfill({ json: { live: { plaques: { neighbour: [{ tag: 'aaaaaaaa', name: 'A' }, { tag: TAG, name: 'Me' }], farmer: [{ tag: TAG, name: 'Me' }] }, citizen: [] } } }));
  if (manage) await page.route(/\/pay\/manage/, (r) => r.fulfill({ json: manage }));
  await page.addInitScript(([gid, m, mk]) => {
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('world-gid', gid);
    if (m) localStorage.setItem('bb-member', JSON.stringify({ t: 'sup-t1', until: Date.now() + 10 * 86400000 }));
    // one banana on the shelf: something in a pile, so the tabs are up
    if (mk && !localStorage.getItem('shelf-v1')) localStorage.setItem('shelf-v1', JSON.stringify([{ id: 'cqalay1', kind: 'banana', params: 'g=shades&h=party', shareId: null, created: Date.now(), made: Date.now() }]));
  }, [GID, member, made]);
  await page.goto('/pass/');
  if (standing) await page.waitForSelector('#psWeek:not([hidden])', { timeout: 15000 });
  await page.waitForTimeout(600);
  return errs;
}
const box = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, b: r.bottom + scrollY, cx: r.left + r.width / 2 }; }, sel);

for (const [w, h] of [[393, 852], [1280, 800]]) {
  test(`the pass card comes first, and the week's standing sits under its promise, whole (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errs = await pass(page);
    const card = await box(page, '.ps-card'), promise = await box(page, '.ps-promise'), week = await box(page, '#psWeek');
    for (const s of ['.ps-promise', '#psWeek', '#psSup', '#psNewsSec', '#psPanes', '#psDoors', '#psKeep']) {
      const b = await box(page, s);
      if (b) expect(b.y, '⭐ ' + s + ' is below the pass card, never over it').toBeGreaterThanOrEqual(card.b - 1);
    }
    expect(week.y, 'the standing comes after the promise').toBeGreaterThan(promise.b - 1);
    expect(week.y - promise.b, '…right under it').toBeLessThan(40);
    expect(Math.abs(week.cx - card.cx), '…centred under the card, not in a corner').toBeLessThan(30);
    const line = await page.evaluate(() => {
      const e = document.getElementById('psWeek');
      return { text: e.textContent.trim(), icons: [...e.querySelectorAll('svg')].map((s) => Math.round(s.getBoundingClientRect().width)), link: (e.querySelector('a') || {}).textContent || '' };
    });
    const [pre] = WORDS.week.running.split('{places}');
    expect(line.text.startsWith(pre.trim()), 'the words are the copy file’s: ' + line.text).toBe(true);
    const first = WORDS.week.first.replace('{plaque}', 'Farmer'), second = WORDS.week.second.replace('{plaque}', 'Neighbour');
    expect(line.text.indexOf(first) >= 0 && line.text.indexOf(first) < line.text.indexOf(second), 'best place first: ' + line.text).toBe(true);
    expect(line.icons, 'one small sparkle in front — not the frame that read as a checkbox, not a badge that reads as a menu').toEqual([16]);
    expect(await page.evaluate(() => document.querySelector('#psWeek svg').innerHTML === document.querySelector('.ps-patch[data-patch="wk-gardener"] svg').innerHTML), 'the sparkle').toBe(true);
    expect(line.link, 'a pass that is not logged in is asked to log in').toBe(WORDS.week.login);
    await page.screenshot({ path: `test-results/pass-layout-${w}.png`, fullPage: true });
    expect(errs).toEqual([]);
  });
}

test('on a phone the membership card waits below the piles, above the doors — never over the pass', async ({ page }) => {
  const errs = await pass(page);
  const card = await box(page, '.ps-card'), sup = await box(page, '#psSup'), panes = await box(page, '#psPanes'), doors = await box(page, '#psDoors');
  expect(sup, 'a member sees it').not.toBeNull();
  expect(sup.y, 'below the pass card').toBeGreaterThan(card.b);
  expect(sup.y, 'after what you made and earned').toBeGreaterThan(panes.y);
  expect(sup.b, 'and before the doors').toBeLessThanOrEqual(doors.y + 1);
  expect(errs).toEqual([]);
});

test('on a laptop the membership card is in the rail, under the tabs and above the doors', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errs = await pass(page, { made: true });
  const nav = await box(page, '#psNav'), sup = await box(page, '#psSup'), panes = await box(page, '#psPanes'), doors = await box(page, '#psDoors');
  expect(nav, 'something in a pile: the tabs are up').not.toBeNull();
  expect(sup.x + sup.w, 'in the left rail').toBeLessThan(panes.x);
  expect(sup.y, 'under the tabs, the rail’s first thing').toBeGreaterThanOrEqual(nav.b - 1);
  expect(sup.b, 'above the doors').toBeLessThanOrEqual(doors.y + 1);
  await page.screenshot({ path: 'test-results/pass-layout-rail.png' });
  expect(errs).toEqual([]);
});

// 🚪 THE MEMBERSHIP CARD CLAIMS ONLY WHAT THE SERVER SAID (29 Sep 2026, the same review). Any failure of its status call —
// a dropped connection, a server error, no login at all — used to read as the server's "cannot see which subscription this
// is", and the card told a member their membership "was probably paid with a different email address".
const sup = (page) => page.evaluate(() => ({
  cancel: !document.getElementById('psSupCancel').hidden && document.getElementById('psSupCancel').textContent.trim(),
  door: document.getElementById('psSupPortal').textContent.trim(),
  miss: !document.getElementById('psSupMiss').hidden,
}));
for (const [what, answer, want] of [
  ['the call fails', null, { cancel: false, door: 'Manage or cancel on Polar →', miss: false }],
  ['the server cannot see which subscription it is', { ok: true, known: false }, { cancel: false, door: 'Manage or cancel on Polar →', miss: true }],
  ['the server matched it', { ok: true, known: true, ending: false }, { cancel: 'Cancel membership', door: 'Card & receipts →', miss: false }],
]) {
  test(`the membership card when ${what}`, async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('pass-link', JSON.stringify({ credId: 'e:qa-layout', token: 'qa-token' })); });
    const errs = await pass(page, { standing: false, manage: answer });
    await page.waitForTimeout(400);
    expect(await sup(page)).toEqual(want);
    expect(errs).toEqual([]);
  });
}

test('a fresh pass says "1 day on the pass", the way the shared card does', async ({ page }) => {
  const errs = await pass(page, { member: false, standing: false });
  const stats = await page.evaluate(() => document.getElementById('psCardStats').textContent.trim());
  expect(stats, 'one day is a day').toBe('1 day on the pass');
  expect(await page.evaluate(() => document.getElementById('psWeek').hidden), 'no standing, no line').toBe(true);
  expect(errs).toEqual([]);
});
