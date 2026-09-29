// 📐 THE PASS PAGE KEEPS ITS BLOCKS IN THEIR PLACES (29 Sep 2026). Trym, on his own pass: "something weird showed up at the
// Pass page on my profile - maybe do a little review of the Pass page if theres some bugs here that does this". The week's
// standing ("This week you are 2nd for Neighbour, 1st for Farmer.") sat alone in the top-left corner above the card, behind a
// frame icon that read as an empty checkbox (a sparkle now). The page orders its blocks with CSS `order`, and one with none is order 0 —
// first. On a phone the membership card stood over the pass too. And a fresh pass said "1 DAYS ON THE PASS": its singular
// rule held a raw BACKSPACE where \b belonged. Design library §46; tools/check-design.mjs checks the spine and the bytes.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import WORDS from '../src/data/copy/pass-toasts.json' with { type: 'json' };
import { richPass } from './pass-fixture.mjs';

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

// 📐 THE PAGE BREATHES (29 Sep 2026, the redesign). Trym: "it looks a bit cramped, small text, not much space, its a bit tight
// view with small detailed text - i feel the gui need to breathe more on desktop and mobile … categorize the information
// better and make it less cluttery". One column in reading order on every screen — the card, the lines under it, the
// account, the news, the three tabs over your things, the membership, the doors, the newsletter — every section the
// column's own width, nothing outside the card under 12 px, and the tabs one row with their labels whole at 320.
const ORDER = ['.ps-card', '.ps-under', '#psKeep', '#psNewsSec', '#psNav', '#psPanes', '#psSup', '#psDoors', '#psAsk'];
for (const [w, h] of [[360, 740], [1280, 800]]) {
  test(`one column in reading order, the width of the page, and room between (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errs = await richPass(page);
    const boxes = [];
    for (const s of ORDER) boxes.push([s, await box(page, s)]);
    const seen = boxes.filter(([, b]) => b);
    expect(seen.map(([s]) => s), 'a busy pass shows every section').toEqual(ORDER);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i][1].y, seen[i][0] + ' comes after ' + seen[i - 1][0]).toBeGreaterThanOrEqual(seen[i - 1][1].b - 1);
      if (seen[i][0] !== '.ps-under') expect(seen[i][1].y - seen[i - 1][1].b, 'with room before ' + seen[i][0]).toBeGreaterThanOrEqual(18);   // the card's own lines tuck up under it
    }
    const col = seen.filter(([s]) => s !== '.ps-card').map(([s, b]) => [s, Math.round(b.x), Math.round(b.w)]);
    for (const [s, x, bw] of col) expect([s, x, bw], 'every section shares the one column').toEqual([s, col[0][1], col[0][2]]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'nothing wider than the screen').toBeLessThanOrEqual(w);
    expect(errs).toEqual([]);
  });

  test(`nothing outside the card is set small, and the tabs fit whole (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errs = await richPass(page);
    const small = async () => page.evaluate(() => {
      const out = [];
      const wrap = document.querySelector('.ps-wrap');
      const walk = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const t = walk.currentNode, e = t.parentElement;
        if (!t.textContent.trim() || !e || e.closest('.ps-card, .mir, [hidden]') || !e.getClientRects().length) continue;
        const px = parseFloat(getComputedStyle(e).fontSize);
        if (px < 12) out.push(px + 'px "' + t.textContent.trim().slice(0, 30) + '" (' + e.className + ')');
      }
      return out;
    });
    for (const tab of ['made', 'earned', 'numbers']) {
      await page.locator('.ps-tab[data-tab="' + tab + '"]').click();
      await page.waitForTimeout(250);
      expect(await small(), 'no text under 12 px outside the card, in ' + tab).toEqual([]);
    }
    await page.locator('#psKeep > summary').click();   // the account drawer's own small print too
    expect(await small(), 'nor in the open account drawer').toEqual([]);
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.ps-tab:not([hidden])')].map((t) => ({ t: t.textContent.trim(), fs: parseFloat(getComputedStyle(t).fontSize), clip: t.scrollWidth > t.clientWidth + 1, h: t.getBoundingClientRect().height, r: t.getBoundingClientRect().right })));
    for (const t of tabs) {
      expect(t.fs, t.t + ' is read at 16 px').toBeGreaterThanOrEqual(16);
      expect(t.clip, t.t + ' fits its tab whole').toBe(false);
      expect(t.h, t.t + ' is a real target').toBeGreaterThanOrEqual(48);
      expect(t.r, t.t + ' is on the screen').toBeLessThanOrEqual(w);
    }
    await page.screenshot({ path: `test-results/pass-layout-busy-${w}.png` });
    expect(errs).toEqual([]);
  });
}

test('a newcomer gets doors, not empty tabs — and the account row is right under the card', async ({ page }) => {
  const errs = await pass(page, { member: false, standing: false });
  expect(await page.evaluate(() => document.getElementById('psNav').hidden), 'no tabs to empty drawers').toBe(true);
  const card = await box(page, '.ps-card'), keep = await box(page, '#psKeep'), zero = await box(page, '#psZero');
  expect(zero, 'the doors stand in the tabs’ place').not.toBeNull();
  expect(keep.y, 'the account row').toBeGreaterThan(card.b);
  expect(keep.b, '…before the doors').toBeLessThanOrEqual(zero.y);
  expect(errs).toEqual([]);
});

test('a pass with things that is not logged in opens the account under the card, email box first', async ({ page }) => {
  const errs = await richPass(page, { member: false, logged: false });
  const card = await box(page, '.ps-card'), nav = await box(page, '#psNav');
  const keep = await page.evaluate(() => { const k = document.getElementById('psKeep'), i = document.getElementById('psMailIn').getBoundingClientRect(); return { open: k.open, y: i.top + scrollY }; });
  expect(keep.open, 'open by itself').toBe(true);
  expect(keep.y, 'the email box under the card').toBeGreaterThan(card.b);
  expect(keep.y, '…and above your things').toBeLessThan(nav.y);
  expect(errs).toEqual([]);
});

test('news you have read waits behind one row; the new stands', async ({ page }) => {
  const errs = await richPass(page);
  const n = await page.evaluate(() => ({
    fresh: [...document.querySelectorAll('#psNotices > .ps-notice')].length,
    old: document.querySelector('.ps-news__old') && document.querySelector('.ps-news__old > summary').textContent.trim(),
    closed: !(document.querySelector('.ps-news__old') || {}).open,
    folded: document.querySelectorAll('.ps-news__old .ps-notice').length,
  }));
  expect(n.fresh, 'the unread verdict stands').toBe(1);
  expect(n.old, 'the two read ones fold behind one row').toBe(WORDS.notices.earlier.replace('{n}', 2));
  expect(n.closed && n.folded, 'closed, holding both').toBe(2);
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
