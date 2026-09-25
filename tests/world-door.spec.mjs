// 🚪 EVERY DOOR INTO THE WORLD IS COUNTED, ONCE (25 Sep 2026). /town/ has been Banana World's front door since 21 Sep —
// every "Enter Banana World" links there — but public/js/main.js's world_door branch did not match it, so only the
// frontpage's own listener counted a town door and the nav, the builder and the language pages counted nothing. The
// frontpage's listener is gone, its links carry data-place, and main.js counts every door on every page: one tap, one
// world_door { area, from = the link's place }, sent as a beacon because the tap leaves the page.
import { test, expect } from '@playwright/test';

// ⚠️ GA4 runs on the PRODUCTION HOST ONLY (main.js returns before any of it on localhost), so the built site is served
// here as http://trymstene.com — every request for it is answered by the local preview — and the real code path runs.
// Google, Meta and Cloudflare are never reached. A spy on the dataLayer (main.js replaces window.gtag itself, so the
// function cannot be wrapped from outside) and a door held shut: a listener on WINDOW runs after main.js's on document,
// so the hit is in the dataLayer before the navigation is stopped.
const LOCAL = 'http://127.0.0.1:4321';
async function open(page, path) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(/googletagmanager|google-analytics|connect\.facebook|cloudflareinsights/, (r) => r.abort());
  await page.route('http://trymstene.com/**', async (route) => {
    const u = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: LOCAL + u.pathname + u.search }) });
  });
  await page.goto('http://trymstene.com' + path, { waitUntil: 'load' });
  expect(await page.evaluate(() => typeof window.gtag), 'the production analytics path is live').toBe('function');
  await page.evaluate(() => window.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a[href]')) e.preventDefault(); }));
  return errs;
}
const doors = (page) => page.evaluate(() => (window.dataLayer || []).map((a) => Array.from(a))
  .filter((a) => a[0] === 'event' && a[1] === 'world_door').map((a) => a[2]));
async function tap(page, selector) {
  const before = (await doors(page)).length;
  await page.evaluate((sel) => { const a = document.querySelector(sel); if (!a) throw new Error('no ' + sel); a.click(); }, selector);
  return (await doors(page)).slice(before);
}

test('the frontpage: each door into the town is one world_door — hero, the dancers’ coin pill, doors, nav — and another area still counts once', async ({ page }) => {
  const errs = await open(page, '/');
  const cases = [
    ['.hw__go', { area: 'town', from: 'hero' }],
    ['.hw__coins', { area: 'town', from: 'hero-game' }],
    ['.bwl-hero__cta', { area: 'town', from: 'doors' }],
    ['.bwl-card[href="/town/"]', { area: 'town', from: 'doors' }],
    ['.bwl-cta a[href="/town/"]', { area: 'town', from: 'doors' }],
    ['.nav a[href="/town/"]', { area: 'town', from: 'nav' }],
    ['.bwl-card[href="/rave/"]', { area: 'rave' }],
  ];
  for (const [sel, want] of cases) {
    const d = await tap(page, sel);
    expect(d, `${sel}: exactly one world_door`).toHaveLength(1);
    expect(d[0], sel).toMatchObject({ ...want, transport_type: 'beacon' });
  }
  expect(errs).toEqual([]);
});

test('a language page: the Enter button and every area door count once, from the page', async ({ page }) => {
  const errs = await open(page, '/nl/');
  for (const [sel, area] of [['#world .loc-world__go a[href="/town/"]', 'town'], ['#world .bb-door[href="/town/"]', 'town'], ['#world .bb-door[href="/beach/"]', 'beach']]) {
    const d = await tap(page, sel);
    expect(d, `${sel}: exactly one world_door`).toHaveLength(1);
    expect(d[0], sel).toMatchObject({ area, from: 'intl_nl', transport_type: 'beacon' });
  }
  expect(errs).toEqual([]);
});

test('the builder’s Banana World button counts as a door into the town', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await open(page, '/make-a-banana/');
  const d = await tap(page, 'a.bb-torave[href="/town/"]');
  expect(d).toHaveLength(1);
  expect(d[0]).toMatchObject({ area: 'town', from: 'builder-top', transport_type: 'beacon' });
  expect(errs).toEqual([]);
});
