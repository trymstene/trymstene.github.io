import { chromium } from '@playwright/test';
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const ROOT = 'C:/Web Development/trymstene.com/dist';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.woff2':'font/woff2', '.jpg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.ico':'image/x-icon' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); let f = join(ROOT, p);
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
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
await page.goto('http://localhost:4399/town/?towntest', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
await page.evaluate(() => window.__town.room.folkReady());
await page.evaluate(() => window.__town.room.cafeReady());
await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));
await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
await page.waitForTimeout(300);
await page.evaluate(() => window.__town.room.open('cafe'));
await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 8000 });
for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(300); }
await page.evaluate(() => window.__town.room.cafe().arrive());
await page.evaluate(() => window.__town.room.cafe().serve());
await page.waitForTimeout(400);
console.log('=== ' + tag + ' tray metrics ===', JSON.stringify(await page.evaluate(() => {
  const c = document.querySelector('.tw-cup'), v = document.getElementById('twView');
  const cs = getComputedStyle(c);
  return { sh: c.scrollHeight, ch: c.clientHeight, oh: c.offsetHeight, max: cs.maxHeight,
    view: Math.round(v.getBoundingClientRect().height), frac: +(c.offsetHeight / v.getBoundingClientRect().height).toFixed(3),
    goText: document.querySelector('.tw-cup__go').textContent,
    goOverflow: (() => { const g = document.querySelector('.tw-cup__go'); return { sw: g.scrollWidth, cw: g.clientWidth }; })(),
    hbarBehind: (() => { const hb = document.querySelector('.tw-hbar'); if (!hb) return 'none'; const r = hb.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return e ? (e.className || e.tagName) : null; })() };
})));
await page.screenshot({ path: OUT + 'shift-' + tag + '.png' });
// enter the arcade while clocked in
await page.evaluate(() => window.__town.arcade.enter());
await page.waitForTimeout(700);
console.log('=== ' + tag + ' arcade while on shift ===', JSON.stringify(await page.evaluate(() => {
  const c = document.querySelector('.tw-cup'); const r = c.getBoundingClientRect();
  const e = document.elementFromPoint(r.left + r.width / 2, r.top + 10);
  return { inside: window.__town.arcade.inside(), cupHidden: c.hidden, cupVis: getComputedStyle(c).visibility,
    onTop: e ? (e.className || e.tagName) : null, shiftOn: window.__town.room.cafe().on(),
    atWorkStill: !!document.querySelector('.tw-atwork'), meDisplay: getComputedStyle(document.querySelector('.tw-me')).display };
})));
await page.screenshot({ path: OUT + 'shift-arcade-' + tag + '.png' });
console.log('errors:', errs);
await page.close();
}
await b.close(); srv.close();
