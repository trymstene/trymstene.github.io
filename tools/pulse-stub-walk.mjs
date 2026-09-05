// 📡 PULSE STUB WALK — renders the built HQ page's Pulse tab with every worker
// stubbed, so the DOWNLOADS and SHOP rooms can be looked at without the inbox
// token or a GA4 key. Run after `npm run build`:
//
//   node tools/pulse-stub-walk.mjs      → screenshots in %TEMP%/pulse-shots/, a JSON verdict on stdout
//
// The synthetic payloads mirror the `data` objects in worker-pulse/src/index.js
// (apiLive / apiRange) — when a payload key is added there, add it here too.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const OUT = join(tmpdir(), 'pulse-shots');
mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); const b = await readFile(f); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(4398, r));

const day = (i) => { const d = new Date(Date.UTC(2026, 8, 5 - i)); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const dlDaily = Array.from({ length: 7 }, (_, i) => ({ d: day(6 - i), files: 20 + i * 3, shown: 22 + i * 3, click: 0, skip: 16 + i * 2, world: i < 2 ? 1 : 0, disc: 0, coffee: i < 2 ? 1 : 0, pack: i < 2 ? 0 : 2 + i, swap: i < 2 ? 0 : 4 + i }));
const RANGE = {
  at: Date.now(), from: '6daysAgo', to: 'today',
  downloads: [
    { page: '/dancing-banana-gif-meme/', gif: 140, png: 0, wall: 0, files: 140, shown: 151, click: 0, skip: 110, world: 2, disc: 0, coffee: 2, pack: 19, swap: 41 },
    { page: '/make-a-banana/', gif: 30, png: 25, wall: 0, files: 55, shown: 60, click: 0, skip: 44, world: 0, disc: 0, coffee: 0, pack: 3, swap: 9 },
    { page: '/dancing-banana-wallpaper/', gif: 0, png: 0, wall: 18, files: 18, shown: 19, click: 0, skip: 15, world: 0, disc: 0, coffee: 0, pack: 1, swap: 2 },
    { page: '/banana-memes/viking-banana/', gif: 6, png: 0, wall: 0, files: 6, shown: 6, click: 0, skip: 5, world: 0, disc: 0, coffee: 0, pack: 0, swap: 0 },
  ],
  dlDaily,
  lists: [{ list: '(not set)', clicks: 12 }, { list: 'packs_gif_hero', clicks: 9 }, { list: 'shopstrip_gif_hub', clicks: 2 }, { list: 'packs_gif_hub', clicks: 4 }, { list: 'shop_custom_lane', clicks: 1 }],
  kpis: { sessions: 912, users: 700, newUsers: 520, engagementRate: 0.52, revenue: 0, transactions: 0 },
  daily: dlDaily.map((r) => ({ d: r.d, sessions: 130, users: 100, newUsers: 70, eng: 0.5, revenue: 0, tx: 0, a1: 100, a7: 400, a28: 900 })),
  countries: [{ cc: 'US', name: 'United States', sessions: 400, users: 300 }, { cc: 'NO', name: 'Norway', sessions: 60, users: 50 }],
  devices: [{ dev: 'mobile', sessions: 600, engaged: 300 }, { dev: 'desktop', sessions: 312, engaged: 170 }],
  sources: [{ source: 'google', medium: 'organic', sessions: 500, engaged: 260, views: 900 }],
  camps: [],
  events: [
    { name: 'offer_shown', v: 236, u: 205 }, { name: 'offer_pack', v: 23, u: 21 }, { name: 'offer_swap', v: 52, u: 30 }, { name: 'offer_skip', v: 174, u: 160 },
    { name: 'offer_world', v: 2, u: 2 }, { name: 'offer_support', v: 2, u: 2 },
    { name: 'gif_download', v: 176, u: 150 }, { name: 'builder_boot', v: 300, u: 250 }, { name: 'builder_start', v: 100, u: 90 },
    { name: 'shop_view', v: 50, u: 45 }, { name: 'select_item', v: 28, u: 24 }, { name: 'view_item', v: 33, u: 28 },
  ],
  eventMap: { gif_download: { US: 100, NO: 20, DE: 12 }, offer_pack: { US: 15, NO: 4 } },
  stepTimes: {},
};
const LIVE = {
  at: Date.now(), total: 3,
  countries: [{ cc: 'US', name: 'United States', v: 2 }, { cc: 'NO', name: 'Norway', v: 1 }],
  cities: [], pages: [{ page: '/dancing-banana-gif-meme/', v: 2 }],
  events: [{ name: 'offer_shown', v: 2 }, { name: 'offer_pack', v: 1 }],
  spark: Array(30).fill(0), recent: [{ name: 'offer_pack', cc: 'US', v: 1 }, { name: 'offer_shown', cc: 'NO', v: 1 }, { name: 'gif_download', cc: 'US', v: 1 }],
  countryPages: {}, devices: { mobile: 2, desktop: 1 }, hot: {},
};

const browser = await chromium.launch();
const out = { errs: [], console: [] };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => out.errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text().slice(0, 160)); });
await page.addInitScript(() => { localStorage.setItem('inbox-token', 'stub'); localStorage.setItem('pass-admin-key-v1', 'stub'); });
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
await page.route('https://banana-contact.trymstene.workers.dev/**', (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === '/messages') return json(route, []);
  if (u.pathname === '/spam') return json(route, []);
  if (u.pathname === '/pulse') {
    const r = u.searchParams.get('r');
    if (r === 'live') return json(route, LIVE);
    if (r === 'range') return json(route, RANGE);
    return json(route, { err: 'stubbed out' }, 500);
  }
  return json(route, { err: 'stubbed out' }, 500);
});
await page.route('https://banana-pass.trymstene.workers.dev/**', (route) => json(route, { err: 'stub' }, 500));
await page.route('https://banana-rave.trymstene.workers.dev/**', (route) => json(route, { err: 'stub' }, 500));
await page.route(/googletagmanager|google-analytics|connect\.facebook/, (route) => route.abort());

await page.goto('http://localhost:4398/inbox/', { waitUntil: 'load' });
await page.waitForTimeout(1200);
out.deskVisible = await page.evaluate(() => { const t = document.getElementById('bmTabPulse'); return !!t && t.offsetParent !== null; });
await page.click('#bmTabPulse');
await page.waitForTimeout(2500);
out.roomChips = await page.locator('.ps-room').count();
out.pulseText = (await page.locator('#bmPulse').innerText().catch(() => 'no #bmPulse')).slice(0, 300);
if (!out.roomChips) { console.log(JSON.stringify(out, null, 1)); await browser.close(); server.close(); process.exit(1); }
const roomShot = async (label, name) => {
  const chip = page.locator('.ps-room', { hasText: label }).first();
  await chip.click();
  await page.waitForTimeout(900);
  const host = page.locator('#bmPulse');
  await host.screenshot({ path: `${OUT}/hq-${name}.png` });
  return await host.innerText();
};
const dl = await roomShot('DOWNLOADS', 'downloads');
out.downloads = {
  tiles: ['pack taps', 'take rate', 'browsed packs', 'no-thanks', 'old asks'].map((t) => [t, dl.includes(t)]),
  cap: (dl.match(/Of every 100 people shown the card[^\n]*/) || [''])[0],
  cols: ['🎟 packs', 'take'].map((t) => [t, dl.includes(t)]),
  oldWords: ['coffee clicks', 'willingness', 'warm-up', 'supported'].filter((t) => dl.includes(t)),
};
const sh = await roomShot('SHOP', 'shop');
out.shop = {
  sections: ['Where product clicks come from', 'The pack card', 'Got the pack card', 'Tapped a pack'].map((t) => [t, sh.includes(t)]),
  listRows: ['The shop grid', 'The GIF page · pack carousel, top', 'The GIF page · pack carousel, download hub', 'Shop strip · gif hub', 'The shop · custom lane'].map((t) => [t, sh.includes(t)]),
  oldWords: ['support ask', 'buy-me-a-coffee'].filter((t) => sh.includes(t)),
};
await ctx.close(); await browser.close(); server.close();
console.log(JSON.stringify(out, null, 1));
