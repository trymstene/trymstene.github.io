import { chromium } from '@playwright/test';
const OUT = 'C:/Users/trym/AppData/Local/Temp/claude/C--Web-Development-trymstene-com/aef8f8b4-6bdc-40b9-830c-496f96a6f745/scratchpad/shots/';
const B = 'http://127.0.0.1:4399';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(B + '/town/?towntest', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__town && window.__town.room && window.__town.work, null, { timeout: 30000 });
await p.evaluate(() => window.__town.life.set(9));
await p.waitForTimeout(1200);
const shot = (n) => p.screenshot({ path: OUT + n + '.png' });
const put = (x, y) => p.evaluate(([a, c]) => { window.__town.pos.x = a; window.__town.pos.y = c; window.__town.tgt.x = a; window.__town.tgt.y = c; }, [x, y]);
async function tapWorld(wx, wy) {
  const pt = await p.evaluate(([x, y]) => { const w = document.getElementById('twWorld').getBoundingClientRect(); return [w.left + (x / 2200) * w.width, w.top + (y / 1300) * w.height]; }, [wx, wy]);
  await p.mouse.click(pt[0], pt[1]);
}
await p.evaluate(() => window.__town.work.set({ at: 'cafe' }));
await p.evaluate(() => Promise.all([window.__town.room.cafeReady(), window.__town.room.folkReady()]));
await p.waitForTimeout(500);
await put(1830, 1100); await p.waitForTimeout(500);
console.log('open(cafe) =', await p.evaluate(() => window.__town.room.open('cafe')));
await p.waitForTimeout(1500);
console.log('clocked in =', await p.evaluate(() => window.__town.room.cafe().on()));
await shot('04-clockin');
await p.evaluate(() => window.__town.room.folk().fill(6));
await p.waitForTimeout(400);
await p.evaluate(() => { const c = window.__town.room.cafe(); c.call(); c.call(); c.call(); });
await p.waitForTimeout(6000);
await p.evaluate(() => window.__town.room.cafe().serve());
await p.waitForTimeout(600);
await shot('05-queue');
console.log('line =', JSON.stringify(await p.evaluate(() => window.__town.room.cafe().line())));
const tray = await p.evaluate(() => { const t = document.querySelector('.tw-cup'); if (!t) return null; const r = t.getBoundingClientRect(); const v = document.getElementById('twView').getBoundingClientRect(); return { h: r.height, viewH: v.height, frac: +(r.height / v.height).toFixed(2), btn: t.querySelector('.tw-cup__go').textContent, note: JSON.stringify(t.querySelector('.tw-cup__note').textContent) }; });
console.log('tray =', JSON.stringify(tray));
console.log('atwork =', JSON.stringify(await p.evaluate(() => window.__town.room.cafe().at())));

// the store, while clocked in
await p.evaluate(() => window.__town.rooms.enter('store'));
await p.waitForTimeout(1000);
await shot('06-clockedin-inside-store');
console.log('IN STORE: on =', await p.evaluate(() => window.__town.room.cafe().on()),
  '| tray on screen =', await p.evaluate(() => { const t = document.querySelector('.tw-cup'); const r = t.getBoundingClientRect(); return !t.hidden && r.height > 0 && getComputedStyle(t).visibility !== 'hidden'; }));
await p.evaluate(() => window.__town.rooms.exit());
await p.waitForTimeout(800);

// walk away from the counter while clocked in
await p.evaluate(() => { window.__town.tgt.x = 1100; window.__town.tgt.y = 880; });
await p.waitForTimeout(6000);
await shot('07-clockedin-walked-away');
console.log('WALKED AWAY: on =', await p.evaluate(() => window.__town.room.cafe().on()),
  '| me display =', await p.evaluate(() => getComputedStyle(document.querySelector('.tw-me')).display),
  '| tray folded =', await p.evaluate(() => document.querySelector('.tw-cup').classList.contains('is-folded')),
  '| pos =', JSON.stringify(await p.evaluate(() => ({ x: Math.round(window.__town.pos.x), y: Math.round(window.__town.pos.y) }))));
console.log('ERRS', errs);
await b.close();
