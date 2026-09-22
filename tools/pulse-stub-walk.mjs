// 🏢 THE HQ WALK — renders the built Banana HQ page with every worker stubbed, walks all eight
// floors at a desk width and a phone width, and says what it found. No inbox token, no GA4 key,
// no pass key leaves this machine: every door answers a synthetic body. Run after `npm run build`:
//
//   node tools/pulse-stub-walk.mjs      → screenshots in %TEMP%/pulse-shots/ (or $HQ_SHOTS), a JSON verdict on stdout
//
// The synthetic payloads mirror the `data` objects in worker-pulse/src/index.js (apiLive / apiRange)
// and the rollup day file in worker-pass — when a payload key is added there, add it here too.
//
// What it proves (22 Sep 2026, the rebuild):
//   · every floor renders with no page error, at 1440 and at 393, and the phone never scrolls sideways
//   · a tapped dot on the live map keeps its label until tapped again, and there is no labels toggle
//   · the Visitors floor lists pages with visits; the Business floor speaks the new words and none of the old
//   · the World floor prints no raw code — no `qa`, no `deny`, no `src` — only plain words
//   · Reported letters is drawn in all three states, and a clear removes a row
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
const OUT = process.env.HQ_SHOTS || join(tmpdir(), 'pulse-shots');
mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  let f = join(DIST, p);
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); const b = await readFile(f); res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(4398, r));

// ── the synthetic world ────────────────────────────────────────────────────
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
  // 📄 the page report (22 Sep): visits, views, people and engagement seconds per path
  pages: [
    { page: '/dancing-banana-gif-meme/', sessions: 610, views: 700, users: 540, secs: 42000 },
    { page: '/', sessions: 220, views: 260, users: 200, secs: 6500 },
    { page: '/make-a-banana/', sessions: 140, views: 190, users: 120, secs: 21000 },
    { page: '/town/', sessions: 31, views: 44, users: 25, secs: 9000 },
  ],
  events: [
    { name: 'offer_shown', v: 236, u: 205 }, { name: 'offer_pack', v: 23, u: 21 }, { name: 'offer_swap', v: 52, u: 30 }, { name: 'offer_skip', v: 174, u: 160 },
    { name: 'offer_world', v: 2, u: 2 }, { name: 'offer_support', v: 2, u: 2 },
    { name: 'gif_download', v: 176, u: 150 }, { name: 'builder_boot', v: 300, u: 250 }, { name: 'builder_start', v: 100, u: 90 },
    { name: 'shop_view', v: 50, u: 45 }, { name: 'select_item', v: 28, u: 24 }, { name: 'view_item', v: 33, u: 28 },
    { name: 'pass_ask_shown', v: 61, u: 40 }, { name: 'pass_ask_tap', v: 9, u: 8 }, { name: 'pass_mail_signin', v: 6, u: 5 }, { name: 'pass_mail_login', v: 3, u: 3 }, { name: 'pass_mail_attached', v: 1, u: 1 },
    { name: 'arcade_board', v: 14, u: 9 }, { name: 'arcade_run', v: 41, u: 9 }, { name: 'arcade_score', v: 37, u: 8 }, { name: 'arcade_prize', v: 2, u: 2 },
    { name: 'town_open', v: 11, u: 7 }, { name: 'town_fix', v: 38, u: 6 }, { name: 'town_buy', v: 3, u: 3 }, { name: 'town_curse', v: 4, u: 4 }, { name: 'town_dark', v: 5, u: 3 }, { name: 'town_multiplayer', v: 4, u: 3 }, { name: 'town_job', v: 5, u: 4 }, { name: 'town_chore', v: 12, u: 4 }, { name: 'town_sort', v: 24, u: 2 }, { name: 'town_shift', v: 9, u: 3 }, { name: 'town_cup', v: 31, u: 3 }, { name: 'town_duty', v: 9, u: 4 }, { name: 'town_ghost', v: 2, u: 2 }, { name: 'town_object', v: 3, u: 2 }, { name: 'town_merchant', v: 1, u: 1 },
    { name: 'post_open', v: 22, u: 14 }, { name: 'post_read', v: 17, u: 11 }, { name: 'post_send', v: 6, u: 5 }, { name: 'post_refused', v: 3, u: 3 }, { name: 'post_report', v: 1, u: 1 },
    { name: 'post_card', v: 9, u: 7 }, { name: 'rave_join', v: 40, u: 30 }, { name: 'park_join', v: 25, u: 20 },
    { name: 'homestead_save_refused', v: 1, u: 1 },
  ],
  eventMap: { gif_download: { US: 100, NO: 20, DE: 12 }, offer_pack: { US: 15, NO: 4 } },
  stepTimes: {},
};
const LIVE = {
  at: Date.now(), total: 3,
  // pins at the map's extremes so the tap sweep below meets every edge
  countries: [{ cc: 'US', name: 'United States', v: 2 }, { cc: 'NO', name: 'Norway', v: 1 },
    { cc: 'GL', name: 'Greenland', v: 1 }, { cc: 'CA', name: 'Canada', v: 1 }, { cc: 'RU', name: 'Russia', v: 1 },
    { cc: 'CL', name: 'Chile', v: 1 }, { cc: 'AU', name: 'Australia', v: 1 }, { cc: 'NZ', name: 'New Zealand', v: 1 }],
  cities: [{ city: 'Oslo', cc: 'NO', v: 1 }], pages: [{ page: 'The Dancing Banana GIF', v: 2 }, { page: 'Banana Town | Trym Stene', v: 1 }],
  events: [{ name: 'offer_shown', v: 2 }, { name: 'offer_pack', v: 1 }],
  spark: Array(30).fill(0), recent: [{ name: 'offer_pack', cc: 'US', v: 1 }, { name: 'offer_shown', cc: 'NO', v: 1 }, { name: 'gif_download', cc: 'US', v: 1 }],
  countryPages: { NO: [{ page: '/dancing-banana-gif-meme/' }, { page: '/' }, { page: '/shop/' }], GL: [{ page: '/' }, { page: '/rave/' }] },
  devices: { mobile: 2, desktop: 1 }, hot: {},
};
// the pass worker: three finished rollup days, with the codes the desk must translate (and the test
// coins it must keep off the charts), the Arcade's boards, and the people index
const rollDay = (d, i) => ({ day: d, done: true, refuse: { day: 3, deny: 7, src: 1, funds: 2 }, pages: 40, mau: 30 + i, passes: 44 + i, wau: 20 + i, anon: 12,
  born7: 4, born1: 1, scanned: 46, member: 2, quest: 15, named: 25, mailCreds: 9, unruled: 2, events: 400, dau: 8 + i,
  faucet: { wish: 200, weed: 60, spot: 120, road: 40, tips: 30, qa: 500 }, area: { park: 300, rave: 120, homestead: 90, town: 30, qa: 500 },
  ret: { c1: 30, r1: 12, c7: 25, r7: 8, c30: 20, r30: 5 }, coins: { earned: 3200, spent: 1100, held: 2400 } });
const ROLL = { days: [rollDay('2026-09-19', 0), rollDay('2026-09-20', 1), rollDay('2026-09-21', 2)], mail: { '2026-09-20': { sent: 4, opened: 3, expired: 1, used: 0, bad: 0, cooldown: 1 } } };
const BOARDS = { wk: '2026-37', boards: {
  peelout: { players: 6, runs: 40, top: [{ n: 'Kiwi', s: 31, at: 1 }], updated: 1 }, snake: { players: 4, runs: 22, top: [{ n: 'Gran Fig', s: 17, at: 1 }], updated: 1 },
  invaders: { players: 0, runs: 0, top: [], updated: 0 }, pong: { players: 2, runs: 9, top: [{ n: 'Spinner', s: 5, at: 1 }], updated: 1 }, stack: { players: 3, runs: 15, top: [{ n: 'DJ Cookie', s: 24, at: 1 }], updated: 1 } } };
const PEOPLE = { at: Date.now(), rows: [
  { id: 'abcd1234', name: 'Kiwi', coins: 120, coinsEarned: 300, coinsSpent: 180, rep: 40, jelly: 3, level: 3, badges: 2, shelf: 1, updated: Date.now(), created: Date.now() - 5 * 864e5, days: 5, devices: 1, mail: true, gear: ['tophat'], ev: 12, drift: 0 },
  { id: 'efgh5678', name: '', coins: 10, rep: 2, level: 1, badges: 0, updated: Date.now() - 864e5, created: Date.now() - 2 * 864e5, days: 2, devices: 1, mail: false, gear: [] },
] };
const YARDS = { yards: 12, day: 2, week: 5,
  list: [{ slug: 'kiwi', name: 'Kiwi’s farm', stage: 2, updated: Date.now(), owner: 't1' }, { slug: 'testy', name: 'Testy', stage: 0, updated: Date.now(), qa: true }],
  census: { animals: 7, withAnimals: 4, planted: 30, named: 9, stage: [3, 4, 3, 2], social: { visits: 20, signs: 5, waters: 8, hugs: 12, feeds: 6 } },
  wt: { ok: 40, miss: 0, none: 2 } };
const LETTERS = { rows: [
  { k: 'Q:1', kind: 'reported', from: 'Kiwi', to: 'Gran Fig', text: 'a letter somebody did not like', queuedAt: Date.now() - 600000 },
  { k: 'Q:2', kind: 'flagged', from: 'Spinner', to: 'Kiwi', text: 'a letter the filter was unsure about', queuedAt: Date.now() - 3600000 },
], n: 2 };

const browser = await chromium.launch();
const out = { errs: [], console: [], floors: {} };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
let lettersMode = 'closed';   // 'closed' (404) | 'ok' — flipped between navigations

async function openPage(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => out.errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text().slice(0, 160)); });
  await page.addInitScript((haveKey) => {
    localStorage.setItem('inbox-token', 'stub');
    localStorage.setItem('gallery-key', 'stub');
    if (haveKey) localStorage.setItem('pass-admin-key-v1', 'stub'); else localStorage.removeItem('pass-admin-key-v1');
    localStorage.removeItem('hq-floor-v1');
  }, opts.noKey ? false : true);
  await page.route('https://banana-contact.trymstene.workers.dev/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/messages') return json(route, [{ key: 'm:1', ts: Date.now() - 7200000, topic: 'general', name: 'A visitor', email: 'a@example.com', message: 'hello from the form', sender: 'abc' }]);
    if (u.pathname === '/spam') return json(route, []);
    if (u.pathname === '/dev/ping') return json(route, { pat: false });
    if (u.pathname === '/pulse') {
      const r = u.searchParams.get('r');
      if (r === 'live') return json(route, LIVE);
      if (r === 'range') return json(route, RANGE);
      if (r === 'analyst') return json(route, { verdict: 'quiet', headline: 'a quiet day', body: [], reads: [], recs: [], confidence: 'fine' });
      if (r === 'report') return json(route, { lines: [], notes: [] });
      return json(route, { err: 'stubbed out' }, 500);
    }
    return json(route, { err: 'stubbed out' }, 500);
  });
  await page.route('https://banana-pass.trymstene.workers.dev/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/admin/rollup') return json(route, ROLL);
    if (u.pathname === '/admin/arcade') return json(route, BOARDS);
    if (u.pathname === '/admin/people') return json(route, PEOPLE);
    return json(route, { err: 'stub' }, 500);
  });
  await page.route('https://banana-rave.trymstene.workers.dev/**', (route) => {
    const u = new URL(route.request().url());
    const counts = { '/count': 2, '/park-count': 1, '/beach-count': 0, '/town-count': 3 };
    if (u.pathname in counts) return json(route, { count: counts[u.pathname] });
    if (u.pathname === '/yards/stats') return json(route, YARDS);
    if (u.pathname === '/names') return json(route, { live: ['Kiwi'], names: [{ n: 'Kiwi', at: Date.now(), count: 1 }], strikes: [] });
    if (u.pathname === '/post-review') {
      if (route.request().method() === 'POST') return json(route, { ok: true, gone: 1 });
      return lettersMode === 'ok' ? json(route, LETTERS) : route.fulfill({ status: 404, body: 'nope' });
    }
    return json(route, { err: 'stub' }, 500);
  });
  await page.route('https://banana-share.trymstene.workers.dev/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/gallery/overrides') return json(route, {});
    return json(route, []);
  });
  await page.route('https://banana-sticker.trymstene.workers.dev/**', (route) => json(route, { buyable: {} }));
  await page.route('https://api.github.com/**', (route) => json(route, { workflow_runs: [] }));
  await page.route(/googletagmanager|google-analytics|connect\.facebook|fonts\.g/, (route) => route.abort());
  await page.goto('http://localhost:4398/inbox/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const FLOORS = ['now', 'visitors', 'business', 'players', 'world', 'mail', 'reviews', 'dev'];
const cap = (f) => f.charAt(0).toUpperCase() + f.slice(1);
const has = (txt, t) => String(txt || '').toLowerCase().includes(String(t).toLowerCase());
const missing = (txt, list) => list.filter((t) => !has(txt, t));
const found = (txt, list) => list.filter((t) => has(txt, t));
async function walkFloor(page, f, name) {
  await page.click('#bmTab' + cap(f), { timeout: 4000 });
  await page.waitForTimeout(f === 'now' ? 1600 : 1100);
  await page.screenshot({ path: `${OUT}/hq-${name}-${f}.png`, fullPage: true });
  return await page.locator('#bmPane' + cap(f)).innerText().catch(() => '');
}

// ── the desk, wide ─────────────────────────────────────────────────────────
{
  lettersMode = 'closed';
  const { ctx, page } = await openPage(1440, 900);
  out.deskVisible = await page.evaluate(() => { const t = document.getElementById('bmTabNow'); return !!t && t.offsetParent !== null; });
  out.tabs = await page.locator('.bm-tab').count();
  out.labelsToggle = await page.locator('[aria-label="show labels on the map"]').count();
  const T = {};
  for (const f of FLOORS) T[f] = await walkFloor(page, f, 'desk');
  out.floors.now = { missing: missing(T.now, ['on the site now', 'in Banana World now', 'Pages open now', 'Cities', 'In Banana World now', 'Status board', 'Doors', 'tap a dot']) };
  out.floors.visitors = { missing: missing(T.visitors, ['Visits in this window', 'visits', 'visitors', 'first-time visitors', 'Which pages they read', 'The GIF page', 'Where they came from', 'Where visitors were', 'What they did', 'visitors by country']) };
  out.floors.business = { missing: missing(T.business, ['Checkout works?', 'Money, as Google counts it', 'Free files', 'pack cards shown', 'tap rate', 'Files per day', 'Downloads by page', 'Downloads by country', 'The pack card', 'Which headline works', 'From a custom banana to an order', 'From the shop to a purchase', 'Where product clicks come from']),
    oldWords: found(T.business, ['The download business', 'old asks', 'take rate', 'Every surface that hands', 'Custom banana funnel', 'Official merch funnel']) };
  out.floors.players = { missing: missing(T.players, ['Passes and who is active', 'Growing?', 'Coming back?', 'From a pass to a kept pass', 'Login links', 'not saved', 'Every pass', 'Kiwi', 'Names on the floor', 'Find a pass by email']) };
  out.floors.world = { missing: missing(T.world, ['Each place, one question', 'The rave', 'Banana Town', 'bananas here now', 'The shops inside', 'The homesteads', 'Neighbours', 'The Arcade boards', 'Kiwi leads with 31', 'The economy', 'coins by place', 'coins by source', 'the wishing fountain', 'the park', 'Refusals', 'the daily cap', 'a test grant', 'test coins', 'Every homestead']),
    rawCodes: ['qa', 'deny', 'src', 'unruled', 'faucet'].filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(T.world)) };
  out.floors.mail = { missing: missing(T.mail, ['Letters to HQ', 'hello from the form', 'Reported letters', 'did not open with this key']) };
  out.floors.reviews = { missing: missing(T.reviews, ['GIFs for the gallery', 'Items for the catalog', 'The live gallery', 'The catalog']) };
  out.floors.dev = { missing: missing(T.dev, ['The rig', 'File something', 'Open issues', 'Open pull requests', 'Phones that could not save', 'Ledger checks', 'coin grants with no source']) };
  // the desk layout, measured with the Now floor open: a rail beside the floor, and the map wider
  // than any 820px column ever was
  await page.click('#bmTabNow');
  await page.waitForTimeout(1200);
  out.layout = await page.evaluate(() => {
    const rail = document.querySelector('.bm-rail').getBoundingClientRect();
    const stage = document.querySelector('.bm-stage').getBoundingClientRect();
    const cv = document.querySelector('#bmNow canvas.pm-cv');
    return { railW: Math.round(rail.width), stageX: Math.round(stage.x), railRight: Math.round(rail.right), mapW: cv ? Math.round(cv.getBoundingClientRect().width) : 0, secNav: document.querySelectorAll('#bmSecNav button').length };
  });
  // 📌 the pin: a tap on a dot keeps its label; a second tap lets go
  out.pins = await page.evaluate(() => {
    const cv = document.querySelector('#bmNow canvas.pm-cv');
    if (!cv) return { err: 'no canvas' };
    const r = cv.getBoundingClientRect();
    const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const pts = [];
    for (let y = 0; y < cv.height; y += 3) for (let x = 0; x < cv.width; x += 3) {
      const i = (y * cv.width + x) * 4;
      if (img[i] > 190 && img[i + 1] > 150 && img[i + 2] < 130) pts.push([x, y]);
    }
    const pins = [];
    for (const [x, y] of pts) if (!pins.some((q) => Math.hypot(q[0] - x, q[1] - y) < 30)) pins.push([x, y]);
    if (!pins.length) return { err: 'no pins painted', yellowPx: pts.length };
    const [x, y] = pins[0];
    const cx = r.left + x * (r.width / cv.width), cy = r.top + y * (r.height / cv.height);
    const tap = () => {
      cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, pointerType: 'mouse' }));
      cv.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true, pointerType: 'mouse' }));
    };
    tap();
    const after1 = window.__hq.pins();
    const unpinBtn = [...document.querySelectorAll('#bmNow .ps-zbtn')].find((b) => b.textContent === 'unpin all');
    const unpinShown = !!unpinBtn && !unpinBtn.hidden;
    // the label survives a live poll: push the same payload again and read the pins after
    tap();
    const after2 = window.__hq.pins();
    tap();
    return { pinsPainted: pins.length, after1, unpinShown, after2, after3: window.__hq.pins() };
  });
  await page.waitForTimeout(300);
  await page.locator('#bmNow .ps-mapcard').first().screenshot({ path: `${OUT}/hq-map-pinned.png` });
  await page.evaluate(() => window.__hq.pins().forEach((cc) => window.__hq.pin(cc)));
  await ctx.close();
}
// ── the letters, open: rows, and a clear that removes one ──────────────────
{
  lettersMode = 'ok';
  const { ctx, page } = await openPage(1440, 900);
  const t = await walkFloor(page, 'mail', 'desk-letters');
  const before = await page.locator('#bmLetters .hqp-let').count();
  await page.locator('#bmLetters .hqp-let .hqp-wipe').first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
  const after = await page.locator('#bmLetters .hqp-let').count();
  const badge = await page.locator('#bmMailBadge').innerText().catch(() => '');
  out.letters = { rows: before, afterClear: after, badge, text: missing(t, ['REPORTED', 'FLAGGED', 'a letter somebody did not like', 'Kiwi → Gran Fig']) };
  out.lettersTile = await page.locator('#bmWorldLetters').innerText().catch(() => '');
  await ctx.close();
}
// ── no pass key: every floor that needs it says so, and nothing throws ─────
{
  lettersMode = 'ok';
  const { ctx, page } = await openPage(1440, 900, { noKey: true });
  const m = await walkFloor(page, 'mail', 'desk-nokey');
  const p = await walkFloor(page, 'players', 'desk-nokey');
  const w = await walkFloor(page, 'world', 'desk-nokey');
  out.noKey = { mail: has(m, 'Needs the pass admin key'), players: has(p, 'Paste the pass admin key'), world: has(w, 'need the pass admin key') };
  await ctx.close();
}
// ── the phone: every floor, never sideways ─────────────────────────────────
{
  lettersMode = 'ok';
  const { ctx, page } = await openPage(393, 852);
  out.phone = {};
  for (const f of FLOORS) {
    await walkFloor(page, f, 'phone');
    out.phone[f] = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  }
  await ctx.close();
}
await browser.close(); server.close();
out.errs = [...new Set(out.errs)];
out.console = [...new Set(out.console)].slice(0, 12);
const bad = [];
if (out.errs.length) bad.push('page errors: ' + out.errs.join(' | '));
if (!out.deskVisible || out.tabs !== 8) bad.push('the desk did not open with 8 floors');
if (out.labelsToggle) bad.push('the labels toggle is still on the map');
for (const [f, v] of Object.entries(out.floors)) { if (v.missing.length) bad.push(f + ' is missing: ' + v.missing.join(', ')); if (v.oldWords && v.oldWords.length) bad.push(f + ' still says: ' + v.oldWords.join(', ')); if (v.rawCodes && v.rawCodes.length) bad.push(f + ' prints raw codes: ' + v.rawCodes.join(', ')); }
if (!out.pins || out.pins.err || !out.pins.after1 || !out.pins.after1.length || (out.pins.after2 && out.pins.after2.length) || !out.pins.unpinShown) bad.push('a tapped dot does not stick and let go: ' + JSON.stringify(out.pins));
if (out.layout.mapW < 900 || out.layout.stageX <= out.layout.railRight - 4 || out.layout.railW > 260) bad.push('the desk layout is not a rail beside a wide floor: ' + JSON.stringify(out.layout));
if (out.letters.rows !== 2 || out.letters.afterClear !== 1 || out.letters.text.length || out.letters.badge !== '3') bad.push('reported letters: ' + JSON.stringify(out.letters));
if (!out.noKey.mail || !out.noKey.players || !out.noKey.world) bad.push('the no-key states: ' + JSON.stringify(out.noKey));
for (const [f, w] of Object.entries(out.phone)) if (w > 393) bad.push('the phone scrolls sideways on ' + f + ' (' + w + 'px)');
out.verdict = bad.length ? bad : 'ok';
console.log(JSON.stringify(out, null, 1));
if (bad.length) process.exit(1);
