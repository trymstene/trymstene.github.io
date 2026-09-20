import { chromium } from '@playwright/test';
const B = 'http://127.0.0.1:4399';
const OUT = 'C:/Users/trym/AppData/Local/Temp/claude/C--Web-Development-trymstene-com/aef8f8b4-6bdc-40b9-830c-496f96a6f745/scratchpad/shots/';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(B + '/town/?towntest', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__town && window.__town.work, null, { timeout: 30000 });
await p.evaluate(() => window.__town.life.set(9));
await p.evaluate(() => window.__town.work.set({ at: 'cafe' }));
await p.evaluate(() => window.__town.room.cafeReady());
await p.waitForTimeout(800);
await p.evaluate(() => { window.__town.pos.x = 1830; window.__town.pos.y = 1100; window.__town.tgt.x = 1830; window.__town.tgt.y = 1100; });
await p.waitForTimeout(700);
async function click(wx, wy) {
  const pt = await p.evaluate(([x, y]) => { const w = document.getElementById('twWorld').getBoundingClientRect(); return [w.left + (x / 2200) * w.width, w.top + (y / 1300) * w.height]; }, [wx, wy]);
  console.log('  screen', pt.map(Math.round), 'viewport 393x852');
  await p.mouse.click(pt[0], pt[1]);
  await p.waitForTimeout(1400);
  const t = await p.evaluate(() => { const e = document.getElementById('twToast'); return e.hidden ? '' : e.textContent; });
  const on = await p.evaluate(() => { const c = window.__town.room.cafe(); return c ? c.on() : null; });
  console.log('  click world', wx, wy, '→ toast', JSON.stringify(t), '| on', on);
}
for (const y of [880, 940, 980, 1010, 1035]) await click(1830, y);
await p.screenshot({ path: OUT + '08-cafe-taps.png' });
console.log('ERRS', errs);
await b.close();
