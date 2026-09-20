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
const page = await b.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => { try { localStorage.setItem('pass-link', JSON.stringify({ credId: 'c', token: 't' })); } catch (e) {} });
await page.goto('http://localhost:4399/town/?towntest', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
await page.evaluate(() => { window.__town.room.curse('none'); window.__town.life.set(12); window.__town.room.set(85); });
await page.evaluate(() => window.__town.room.folkReady());
await page.evaluate(() => window.__town.room.cafeReady());
await page.evaluate(() => window.__town.room.folk().fill(6, performance.now()));

// (1) tap the cafe with NO job: what does the town say?
await page.evaluate(() => { const p = window.__town.PROPS.cafe, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 40; });
await page.waitForTimeout(300);
await page.evaluate(() => window.__town.room.open('cafe'));
await page.waitForTimeout(400);
console.log('NO-JOB tap on the cafe toasts:', JSON.stringify(await page.evaluate(() => { const t = document.getElementById('twToast'); return { hidden: t.hidden, text: t.textContent }; })));
await page.screenshot({ path: OUT + 'cafe-nojob.png' });

// (2) clock in, then WALK AWAY
await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
await page.evaluate(() => window.__town.room.open('cafe'));
await page.waitForFunction(() => window.__town.room.cafe() && window.__town.room.cafe().on(), null, { timeout: 8000 });
for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__town.room.cafe().call()); await page.waitForTimeout(350); }
await page.evaluate(() => window.__town.room.cafe().arrive());
await page.waitForTimeout(300);
console.log('clocked in. state:', JSON.stringify(await page.evaluate(() => {
  const me = document.querySelector('.tw-me');
  return { meDisplay: getComputedStyle(me).display, atWork: !!document.querySelector('.tw-atwork'),
    trayOpen: window.__town.room.cafe() ? 'on' : '?', cupClass: document.querySelector('.tw-cup').className };
})));
// walk right across the square
await page.evaluate(() => { const t = window.__town; t.tgt.x = 1100; t.tgt.y = 1230; });
await page.waitForTimeout(6000);
console.log('after walking away:', JSON.stringify(await page.evaluate(() => {
  const me = document.querySelector('.tw-me'), t = window.__town;
  return { pos: { x: Math.round(t.pos.x), y: Math.round(t.pos.y) }, meDisplay: getComputedStyle(me).display,
    atWork: !!document.querySelector('.tw-atwork'), cupClass: document.querySelector('.tw-cup').className,
    cupFolded: document.querySelector('.tw-cup').classList.contains('is-folded'),
    shiftOn: window.__town.room.cafe().on(), line: window.__town.room.cafe().line().length };
})));
await page.screenshot({ path: OUT + 'cafe-walkedoff.png' });

// (3) enter the general store while clocked in
await page.evaluate(() => window.__town.room.open('store'));
await page.waitForTimeout(800);
console.log('after opening the store while on shift:', JSON.stringify(await page.evaluate(() => {
  const cup = document.querySelector('.tw-cup');
  const shade = document.querySelector('.tw-inshade');
  return { inside: document.getElementById('twWorld').className, cupHidden: cup.hidden,
    cupVisible: getComputedStyle(cup).visibility, shade: !!shade && !shade.hidden,
    shadeZ: shade ? getComputedStyle(shade).zIndex : null, cupZ: getComputedStyle(cup).zIndex,
    onTopAtTrayCentre: (() => { const r = cup.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e ? e.className || e.tagName : null; })(),
    shiftOn: window.__town.room.cafe().on() };
})));
await page.screenshot({ path: OUT + 'cafe-inside-store.png' });
console.log('errors:', errs);
await b.close(); srv.close();
