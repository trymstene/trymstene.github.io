// 🪪 PROTECTED NAMES, on the built site (2 Oct 2026; src/lib/name-guard.js).
//
// Trym: "add protection on my name, its a bit silly if players thats using my name is sent letters and stuff". The servers
// decide (worker-pass leaves a pass that may not carry the name nameless; worker-rave lets it in only beside the owner's NAME
// TOKEN — both have their own tests). The pages' part, walked here: say no while the name is typed, and carry the token
// beside the name wherever a name goes. Nothing here reaches a worker or a real player.
import { test, expect } from '@playwright/test';
import NAMES from '../src/data/copy/names.json' with { type: 'json' };

const NOISE = /workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/;
const TOKEN = 'a1b2c3d4e5f60718.' + (Date.now() + 864e5) + '.' + 'ab'.repeat(32);   // a token's shape; the page cannot check its seal
async function open(page, url, token) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(NOISE, (r) => r.abort());
  const hellos = [];
  await page.routeWebSocket(/workers\.dev/, (ws) => { ws.onMessage((m) => { try { const d = JSON.parse(String(m)); if (d && d.t === 'hi') hellos.push(d); } catch (e) {} }); });
  await page.addInitScript((tk) => {
    if (sessionStorage.getItem('nm-seeded')) return;
    sessionStorage.setItem('nm-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('cookie-consent-v1', 'n');
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    localStorage.removeItem('ps-name-v1');
    if (tk) localStorage.setItem('bb-ntok', tk);
  }, token);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { errs, hellos };
}
async function nameAs(page, v) {
  await page.waitForSelector('#psNameEdit', { timeout: 30000 });
  await page.evaluate(() => { const t = document.getElementById('passToast'); if (t) t.textContent = ''; });
  await page.locator('#psNameEdit').click();
  await page.locator('#psNameInput').fill(v);
  await page.locator('#psNameInput').press('Enter');
  await page.waitForFunction(() => /\S/.test((document.getElementById('passToast') || {}).textContent || ''), null, { timeout: 8000 });
  return page.evaluate(() => ({ toast: document.getElementById('passToast').textContent.trim(), name: localStorage.getItem('ps-name-v1') }));
}

test('the pass: a name kept for somebody else is refused as it is typed, lookalikes too — and plain Trym is anybody’s', async ({ page }) => {
  const { errs } = await open(page, '/pass/');
  let r = await nameAs(page, 'Trym Stene');
  expect(r, '⭐ the name is said to be somebody else’s, and not taken').toEqual({ toast: NAMES.taken, name: null });
  await page.screenshot({ path: 'test-results/names-pass-taken.png' });
  await page.keyboard.press('Escape');
  r = await nameAs(page, 'Tryrn 5tene');
  expect(r.name, 'a lookalike is the same name').toBeNull();
  await page.keyboard.press('Escape');
  r = await nameAs(page, 'Trym');
  expect(r.name, 'a first name is anybody’s').toBe('Trym');
  expect(errs).toEqual([]);
});

test('the pass: its owner, holding the name token, names themself as usual', async ({ page }) => {
  const { errs } = await open(page, '/pass/', TOKEN);
  const r = await nameAs(page, 'Trym Stene');
  expect(r.name, 'taken, with the pass’s own words').toBe('Trym Stene');
  expect(errs).toEqual([]);
});

test('a room: the name token rides beside the name in the hello, and only when there is one', async ({ page, browser }) => {
  const a = await open(page, '/park/?parktest', TOKEN);
  await expect.poll(() => a.hellos.length, { timeout: 20000, message: 'the park says hello' }).toBeGreaterThan(0);
  expect(a.hellos[0].nt, '⭐ the owner’s token goes with them').toBe(TOKEN);
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  const b = await open(p2, '/park/?parktest');
  await expect.poll(() => b.hellos.length, { timeout: 20000 }).toBeGreaterThan(0);
  expect('nt' in b.hellos[0], 'and nobody else carries one').toBe(false);
  await ctx.close();
  expect(a.errs).toEqual([]);
});
