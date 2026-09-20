import { chromium } from '@playwright/test';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'C:/Web Development/trymstene.com/dist';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.woff2':'font/woff2', '.jpg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.ico':'image/x-icon' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = join(ROOT, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(4399, r));

const OUT = 'C:/Users/trym/AppData/Local/Temp/claude/C--Web-Development-trymstene-com/aef8f8b4-6bdc-40b9-830c-496f96a6f745/scratchpad/';
const b = await chromium.launch();

for (const [w, h, tag] of [[393, 852, '393'], [360, 740, '360']]) {
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
  await page.goto('http://localhost:4399/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.evaluate(() => window.__town.room.cafeReady());
  await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__town.room.open('cafe'));
  await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 8000 });
  await page.waitForTimeout(400);
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(400); }
  await page.evaluate(() => window.__town.room.cafe().arrive());
  await page.evaluate(() => window.__town.room.cafe().serve());
  await page.waitForTimeout(500);

  // measure
  const m = await page.evaluate(() => {
    const g = (s) => document.querySelector(s);
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    const cup = g('.tw-cup'), view = g('#twView'), hbar = g('.tw-hbar'), toast = g('#twToast');
    const z = (e) => e ? +getComputedStyle(e).zIndex : null;
    // fire a toast to see where it lands
    return {
      view: r(view), cup: r(cup), hbar: r(hbar), hbarZ: z(hbar), cupZ: z(cup),
      cupScroll: cup ? { sh: cup.scrollHeight, ch: cup.clientHeight } : null,
      go: r(g('.tw-cup__go')), goText: g('.tw-cup__go') ? g('.tw-cup__go').textContent : '',
      goScroll: g('.tw-cup__go') ? { sw: g('.tw-cup__go').scrollWidth, cw: g('.tw-cup__go').clientWidth } : null,
      note: r(g('.tw-cup__note')), bar: r(g('.tw-cup__bar')),
      toast: r(toast), toastZ: z(toast),
      needleLeft: g('.tw-cup__needle') ? g('.tw-cup__needle').style.left : null,
      hbarHidden: hbar && cup ? (r(hbar).top >= r(cup).top) : null,
      actions: r(g('.tw-actions')),
    };
  });
  console.log('=== ' + tag + ' ===');
  console.log(JSON.stringify(m, null, 1));
  await page.screenshot({ path: OUT + 'cafe-' + tag + '.png' });
  // now with a toast up
  await page.evaluate(() => window.__town.say ? window.__town.say('x') : null);
  await page.evaluate(() => { const t = document.getElementById('twToast'); t.textContent = 'Bean: “That is the one. Keep them coming.”'; t.hidden = false; });
  await page.waitForTimeout(200);
  const t2 = await page.evaluate(() => { const t = document.getElementById('twToast').getBoundingClientRect(); const c = document.querySelector('.tw-cup').getBoundingClientRect(); return { toastTop: Math.round(t.top), toastBottom: Math.round(t.bottom), cupTop: Math.round(c.top), overlaps: t.bottom > c.top }; });
  console.log('toast over tray:', JSON.stringify(t2));
  await page.screenshot({ path: OUT + 'cafe-toast-' + tag + '.png' });
  // pocket tray during a shift
  await page.evaluate(() => { document.getElementById('twToast').hidden = true; });
  await page.evaluate(() => { const p = document.getElementById('twPocket'); p.hidden = false; p.click(); });
  await page.waitForTimeout(250);
  const p3 = await page.evaluate(() => { const t = document.getElementById('twTray'); if (t.hidden) return 'tray still hidden'; const tr = t.getBoundingClientRect(), c = document.querySelector('.tw-cup').getBoundingClientRect(); return { trayTop: Math.round(tr.top), trayBottom: Math.round(tr.bottom), cupTop: Math.round(c.top), behind: tr.top > c.top, trayZ: getComputedStyle(t).zIndex, cupZ: getComputedStyle(document.querySelector('.tw-cup')).zIndex }; });
  console.log('pocket tray during shift:', JSON.stringify(p3));
  await page.screenshot({ path: OUT + 'cafe-pocket-' + tag + '.png' });
  console.log('errors:', errs);
  await page.close();
}
await b.close();
srv.close();
