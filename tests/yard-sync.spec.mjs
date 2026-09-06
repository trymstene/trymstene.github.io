// 🚨 THE HOMESTEAD WHEN BANANA WORLD SAYS NO (6 Sep 2026). Every yard route is
// stubbed, so nothing reaches the real workers; the QA scenario yard boots
// claimed. Three walls, three answers: a refused proof falls back to the
// browser id; a lost address is claimed again and the farm re-published;
// a dead network is SAID on screen. Before this all three were silent — a
// player farmed twelve days into a yard nobody could see.
import { test, expect } from '@playwright/test';

const YARDS = /banana-rave\.trymstene\.workers\.dev\/yards\//;

// script(path, body, calls) → { status, body } | 'abort'
async function boot(page, script) {
  const calls = [];
  await page.route(YARDS, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/yards', '');
    let body = {};
    try { body = req.postDataJSON() || {}; } catch (e) {}
    calls.push({ path, pass: body.pass, alt: body.alt, wt: body.wt, name: body.name });
    const r = script(path, body, calls);
    if (r === 'abort') return route.abort('failed');
    return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  });
  // the pass worker is not under test: its calls just fail quietly
  await page.route(/banana-pass\.trymstene\.workers\.dev/, (route) => route.abort('failed'));
  await page.addInitScript(() => {
    window.__ga = [];
    window.gtag = (...a) => window.__ga.push(a);
    // a phone that holds a pass id and a proof — the shape enforcement looks at
    localStorage.setItem('world-gid', 'deadbeefdeadbeef');
    localStorage.setItem('world-wt', 'deadbeefdeadbeef.' + (Date.now() + 86400000) + '..' + 'a'.repeat(64));
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('/homestead/?hstest=tent', { waitUntil: 'load' });   // tent = a CLAIMED QA yard (fresh is the unclaimed arrival)
  return { calls, errs };
}
const ok = (slug, extra) => ({ status: 200, body: { ok: 1, slug, updated: Date.now(), mark: null, ...(extra || {}) } });
const events = (page) => page.evaluate(() => window.__ga.map((a) => [a[1], a[2] || {}]));
const bar = (page) => page.evaluate(() => { const b = document.getElementById('hsSync'); return b && !b.hidden ? document.getElementById('hsSyncMsg').textContent : null; });

test('a refused proof falls back to the browser id and keeps saving', async ({ page }) => {
  const { calls, errs } = await boot(page, (path, body) => {
    if (path === '/claim') return { status: 200, body: { slug: 'testy-qa' } };
    if (path === '/news') return { status: 200, body: { waters: [], feeds: [] } };
    if (path === '/save') return body.pass !== body.alt || body.wt ? { status: 401, body: { err: 'token' } } : ok('testy-qa');
    return { status: 200, body: {} };
  });
  await page.waitForFunction(() => window.__ga.some((a) => a[1] === 'homestead_save_refused'), null, { timeout: 15000 });
  await page.waitForTimeout(3500);   // the plain retry rides the 2.5 s debounce
  const saves = calls.filter((c) => c.path === '/save');
  expect(saves.length).toBeGreaterThanOrEqual(2);
  expect(saves[0].pass).not.toBe(saves[0].alt);
  const plain = saves.find((c) => c.pass === c.alt && !c.wt);
  expect(plain).toBeTruthy();
  const ev = await events(page);
  expect(ev.find((e) => e[0] === 'homestead_save_refused')[1]).toMatchObject({ why: 'token', status: 401 });
  // the bar said it, then the accepted save cleared it
  await page.waitForFunction(() => document.getElementById('hsSync').hidden, null, { timeout: 8000 });
  expect(errs).toEqual([]);
});

test('a lost address is claimed again and the farm re-published', async ({ page }) => {
  let claims = 0;
  const { calls, errs } = await boot(page, (path, body) => {
    if (path === '/claim') { claims++; return { status: 200, body: { slug: claims === 1 ? 'testy-qa' : 'testy-qa-2' } }; }
    if (path === '/news') return { status: 200, body: { waters: [], feeds: [] } };
    if (path === '/save') {
      if (body.pass !== body.alt || body.wt) return { status: 401, body: { err: 'token' } };
      return claims < 2 ? { status: 404, body: { err: 'unclaimed' } } : ok('testy-qa-2');
    }
    return { status: 200, body: {} };
  });
  await page.waitForFunction(() => window.__ga.some((a) => a[1] === 'homestead_reattach'), null, { timeout: 20000 });
  await page.waitForTimeout(3500);
  const ev = await events(page);
  expect(ev.find((e) => e[0] === 'homestead_reattach')[1]).toMatchObject({ from: 'testy-qa', to: 'testy-qa-2' });
  expect(calls.filter((c) => c.path === '/claim').length).toBe(2);
  const last = calls.filter((c) => c.path === '/save').pop();
  expect(last.pass).toBe(last.alt);
  const slug = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1') || '{}').slug);
  expect(slug).toBe('testy-qa-2');
  expect(errs).toEqual([]);
});

test('a dead network is said on screen and the farm stays on the phone', async ({ page }) => {
  const { errs } = await boot(page, (path) => {
    if (path === '/claim') return { status: 200, body: { slug: 'testy-qa' } };
    if (path === '/news') return { status: 200, body: { waters: [], feeds: [] } };
    if (path === '/save') return 'abort';
    return { status: 200, body: {} };
  });
  await page.waitForFunction(() => window.__ga.some((a) => a[1] === 'homestead_save_refused'), null, { timeout: 15000 });
  const ev = await events(page);
  expect(ev.find((e) => e[0] === 'homestead_save_refused')[1]).toMatchObject({ why: 'offline' });
  expect(await bar(page)).toContain('can’t be reached');
  const kept = await page.evaluate(() => !!JSON.parse(localStorage.getItem('hs-v1') || '{}').claimedAt);
  expect(kept).toBe(true);
  expect(errs).toEqual([]);
});
