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
  lists: [{ list: '(not set)', clicks: 12 }, { list: 'packs_gif_hero', clicks: 9 }, { list: 'shopstrip_gif_hub', clicks: 2 }, { list: 'packs_gif_hub', clicks: 4 }, { list: 'shop_custom_lane', clicks: 1 },
    { list: 'card_official', clicks: 3, views: 41 }, { list: 'card_only', clicks: 1, views: 12 }],
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
    // the save ask (6 Sep): the HUD pill -> the pass page's email row -> a kept pass
    { name: 'pass_ask_shown', v: 61, u: 40 }, { name: 'pass_ask_tap', v: 9, u: 8 }, { name: 'pass_mail_signin', v: 6, u: 5 }, { name: 'pass_mail_login', v: 3, u: 3 }, { name: 'pass_mail_attached', v: 1, u: 1 },
    // 🕹 the Arcade (12 Sep): cabinets opened -> runs -> scores posted -> prizes
    { name: 'arcade_board', v: 14, u: 9 }, { name: 'arcade_run', v: 41, u: 9 }, { name: 'arcade_score', v: 37, u: 8 }, { name: 'arcade_prize', v: 2, u: 2 },
    // 🏘️ Town Life (14 Sep): the door -> fixes -> a buy, a night, a ghost, a find
    { name: 'town_open', v: 11, u: 7 }, { name: 'town_fix', v: 38, u: 6 }, { name: 'town_buy', v: 3, u: 3 }, { name: 'town_curse', v: 4, u: 4 }, { name: 'town_dark', v: 5, u: 3 }, { name: 'town_ghost', v: 2, u: 2 }, { name: 'town_object', v: 3, u: 2 }, { name: 'town_merchant', v: 1, u: 1 },
    // ✉️ the post office (20 Sep): the mailbox opened -> a letter read -> a letter written back, and
    // the two that only exist here (a refusal's reason, and the review queue's own length)
    { name: 'post_open', v: 22, u: 14 }, { name: 'post_read', v: 17, u: 11 }, { name: 'post_send', v: 6, u: 5 }, { name: 'post_refused', v: 3, u: 3 }, { name: 'post_report', v: 1, u: 1 },
    { name: 'post_card', v: 9, u: 7 },
  ],
  eventMap: { gif_download: { US: 100, NO: 20, DE: 12 }, offer_pack: { US: 15, NO: 4 } },
  stepTimes: {},
};
const LIVE = {
  at: Date.now(), total: 3,
  // pins at the map's extremes so the tooltip sweep below meets every edge
  countries: [{ cc: 'US', name: 'United States', v: 2 }, { cc: 'NO', name: 'Norway', v: 1 },
    { cc: 'GL', name: 'Greenland', v: 1 }, { cc: 'CA', name: 'Canada', v: 1 }, { cc: 'RU', name: 'Russia', v: 1 },
    { cc: 'CL', name: 'Chile', v: 1 }, { cc: 'AU', name: 'Australia', v: 1 }, { cc: 'NZ', name: 'New Zealand', v: 1 }],
  cities: [], pages: [{ page: '/dancing-banana-gif-meme/', v: 2 }],
  events: [{ name: 'offer_shown', v: 2 }, { name: 'offer_pack', v: 1 }],
  spark: Array(30).fill(0), recent: [{ name: 'offer_pack', cc: 'US', v: 1 }, { name: 'offer_shown', cc: 'NO', v: 1 }, { name: 'gif_download', cc: 'US', v: 1 }],
  countryPages: { NO: [{ page: '/dancing-banana-gif-meme/' }, { page: '/' }, { page: '/shop/' }], GL: [{ page: '/' }, { page: '/rave/' }] },
  devices: { mobile: 2, desktop: 1 }, hot: {},
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
// 🕹 the pass worker answers the ledger room (12 Sep): one finished rollup day and the Arcade's boards
const ROLL = { days: [{"day": "2026-09-11", "done": true, "refuse": {}, "pages": 7, "mau": 7, "passes": 7, "wau": 7, "anon": 7, "born7": 7, "scanned": 7, "member": 7, "quest": 7, "faucet": 7, "events": 7, "area": 7, "dau": 7, "named": 7, "unruled": 7, "ret": {"c7": 3, "r30": 3, "r7": 3, "c1": 3, "r1": 3, "c30": 3}, "coins": {"earned": 3, "spent": 3, "held": 3}}] };
const BOARDS = { wk: '2026-37', boards: {
  peelout: { players: 6, runs: 40, top: [{ n: 'Kiwi', s: 31, at: 1 }], updated: 1 }, snake: { players: 4, runs: 22, top: [{ n: 'Gran Fig', s: 17, at: 1 }], updated: 1 },
  invaders: { players: 0, runs: 0, top: [], updated: 0 }, pong: { players: 2, runs: 9, top: [{ n: 'Spinner', s: 5, at: 1 }], updated: 1 }, stack: { players: 3, runs: 15, top: [{ n: 'DJ Cookie', s: 24, at: 1 }], updated: 1 } } };
await page.route('https://banana-pass.trymstene.workers.dev/**', (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === '/admin/rollup') return json(route, ROLL);
  if (u.pathname === '/admin/arcade') return json(route, BOARDS);
  return json(route, { err: 'stub' }, 500);
});
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
const has = (txt, t) => String(txt || '').toLowerCase().includes(String(t).toLowerCase());   // tile labels are uppercased by CSS, innerText honours it
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
  tiles: ['pack taps', 'take rate', 'browsed packs', 'no-thanks', 'old asks'].map((t) => [t, has(dl, t)]),
  cap: (dl.match(/Of every 100 people shown the card[^\n]*/) || [''])[0],
  cols: ['🎟 packs', 'take'].map((t) => [t, has(dl, t)]),
  oldWords: ['coffee clicks', 'willingness', 'warm-up', 'supported'].filter((t) => has(dl, t)),
};
const sh = await roomShot('SHOP', 'shop');
out.shop = {
  sections: ['Where product clicks come from', 'The pack card', 'Got the pack card', 'Tapped a pack'].map((t) => [t, has(sh, t)]),
  listRows: ['The shop grid', 'The GIF page · pack carousel, top', 'The GIF page · pack carousel, download hub', 'Shop strip · gif hub', 'The shop · custom lane'].map((t) => [t, has(sh, t)]),
  // 🎟 the per-headline table sits beside the pack funnel (6 Sep)
  heads: ['Which headline works', 'Official Banana sticker pack', '3 / 41 · 7.3%', 'needs 20', 'Download card · “Only here: official Banana stickers”'].map((t) => [t, has(sh, t)]),
  oldWords: ['support ask', 'buy-me-a-coffee'].filter((t) => has(sh, t)),
};
// ── the world room reads the save ask (6 Sep): the funnel from the blinking
// pill to a kept pass, in people, next to the sync-health tiles
const wd = await roomShot('WORLD', 'world');
out.world = {
  sections: ['The ask', 'Sync health'].map((t) => [t, has(wd, t)]),
  // 🕹 the Arcade area (12 Sep): the prefix reader lists its four events under its own heading
  arcade: ['The Arcade', 'opened an arcade cabinet', 'played an arcade run', 'posted an arcade score', 'WON an arcade prize'].map((t) => [t, has(wd, t)]),
  // 🏘️ the town's card (14 Sep): the prefix reader lists its events under its own heading
  town: ['Banana Town', 'walked into Banana Town', 'put something right in the town', 'bought a piece for home in the town', 'was in the town on a Curse Night', 'watched the ghosts cost the town'].map((t) => [t, has(wd, t)]),
  // ✉️ the post office (20 Sep): its own card, because its events are `post_*` and the town's reads
  // `town_*` — and because the question is different in kind (does anybody ANSWER, not do they return)
  post: ['The post office', 'opened their mailbox', 'read a letter', 'a letter did not go', 'reported a letter', 'started a postcard'].map((t) => [t, has(wd, t)]),
  tiles: ['saw the pill', 'tapped it', 'asked for a link', 'logged in'].map((t) => [t, has(wd, t)]),
  rate: (wd.match(/[0-9.]+% of them/) || [''])[0],
};
// ── 🕹 the ledger room reads the Arcade boards (12 Sep): a tile per cabinet, the leader, the wipe row
const lg = await roomShot('LEDGER', 'ledger');
out.ledger = {
  sections: ['The Arcade boards'].map((t) => [t, has(lg, t)]),
  tiles: ['Peel Out', 'Banana Snake', 'Banana Invaders', 'Banana Pong', 'Banana Stack'].map((t) => [t, has(lg, t)]),
  leads: ['Kiwi leads with 31', 'DJ Cookie leads with 24', 'nobody yet', 'wipe a board'].map((t) => [t, has(lg, t)]),
};
// ── the map tooltip must stay inside the card at every pin (it used to be
// drawn above the pin and clipped for countries high on the map)
await page.locator('.ps-room', { hasText: 'LIVE' }).first().click();
await page.waitForTimeout(1500);
const cv = page.locator('canvas.pm-cv').first();
const cb = await cv.boundingBox();
const card = await page.locator('.ps-mapcard').first().boundingBox();
out.tips = { seen: 0, distinct: [], clipped: 0, worst: null, topmost: null };
if (cb && card) {
  // find the pins by their paint (the pulses are yellow on a purple sea), then
  // hover each one with a synthetic pointermove — exact, and it also tells us
  // when a pin exists but the hit test misses it
  const res = await page.evaluate(({ card }) => {
    const cvs = [...document.querySelectorAll('canvas.pm-cv')]; const tips = [...document.querySelectorAll('.pm-tip')];
    const cv = cvs[cvs.length - 1]; const tip = tips[tips.length - 1];
    const diag = { canvases: cvs.length, tips: tips.length, w: cv.width, h: cv.height };
    const r = cv.getBoundingClientRect();
    const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const pts = [];
    for (let y = 0; y < cv.height; y += 3) for (let x = 0; x < cv.width; x += 3) {
      const i = (y * cv.width + x) * 4;
      if (img[i] > 190 && img[i + 1] > 150 && img[i + 2] < 130) pts.push([x, y]);
    }
    const pins = [];
    for (const [x, y] of pts) if (!pins.some((q) => Math.hypot(q[0] - x, q[1] - y) < 30)) pins.push([x, y]);
    diag.yellowPx = pts.length; diag.pins = pins.length;
    const found = [];
    for (const [x, y] of pins) {
      const cx = r.left + x * (r.width / cv.width), cy = r.top + y * (r.height / cv.height);
      cv.dispatchEvent(new PointerEvent('pointermove', { clientX: cx, clientY: cy, bubbles: true }));
      const rec = { x: Math.round(cx - r.left), y: Math.round(cy - r.top), head: null, over: 0 };
      if (!tip.hidden) {
        const b = tip.getBoundingClientRect();
        rec.head = tip.textContent.split(String.fromCharCode(10))[0];
        rec.lines = tip.textContent.split(String.fromCharCode(10)).length;
        rec.over = Math.round(Math.max(card.y - b.top, b.bottom - (card.y + card.height), card.x - b.left, b.right - (card.x + card.width)) * 10) / 10;
      }
      found.push(rec);
    }
    cv.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    return { diag, found };
  }, { card });
  out.tips.diag = res.diag;
  out.tips.seen = res.found.filter((h) => h.head).length;
  out.tips.missed = res.found.filter((h) => !h.head).length;
  out.tips.distinct = [...new Set(res.found.filter((h) => h.head).map((h) => h.head))];
  const clipped = res.found.filter((h) => h.over > 0.5);
  out.tips.clipped = clipped.length;
  out.tips.worst = clipped.sort((a, b) => b.over - a.over)[0] || null;
  out.tips.topmost = res.found.filter((h) => h.head).sort((a, b) => a.y - b.y)[0] || null;
  if (out.tips.topmost) {
    await page.mouse.move(cb.x + out.tips.topmost.x, cb.y + out.tips.topmost.y);
    await page.waitForTimeout(250);
    await page.locator('.ps-mapcard').first().screenshot({ path: `${OUT}/hq-map-tip.png` });
  } else {
    await page.locator('.ps-mapcard').first().screenshot({ path: `${OUT}/hq-map-tip.png` });
  }
}
await ctx.close(); await browser.close(); server.close();
console.log(JSON.stringify(out, null, 1));
