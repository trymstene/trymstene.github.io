import { chromium } from '@playwright/test';
const B = 'http://127.0.0.1:4399';
const OUT = 'C:/Users/trym/AppData/Local/Temp/claude/C--Web-Development-trymstene-com/aef8f8b4-6bdc-40b9-830c-496f96a6f745/scratchpad/shots/';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto(B + '/town/?towntest', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__town && window.__town.work, null, { timeout: 30000 });
await p.evaluate(() => window.__town.life.set(9));
await p.waitForTimeout(800);
const shot = n => p.screenshot({ path: OUT + n + '.png' });

// ---- A: a stranger with NO pass asks all three bosses
for (const k of ['pip', 'spinner', 'bean']) console.log('ASK', k, '=', JSON.stringify(await p.evaluate(x => window.__town.work.ask(x), k)));

// ---- B: the restock chore, with the store job
await p.evaluate(() => window.__town.work.set({ at: 'store' }));
await p.evaluate(() => window.__town.rooms.enter('store'));
await p.waitForTimeout(1200);
await shot('10-store-job-hints');
console.log('hints =', await p.evaluate(() => window.__town.room.hints()), '| bare =', await p.evaluate(() => window.__town.room.bare()), '| shelf =', JSON.stringify(await p.evaluate(() => window.__town.room.shelf())));
// lift a crate and stock a shelf
console.log('chore cr1 =', await p.evaluate(() => window.__town.room.chore('cr1')));
await p.waitForTimeout(700);
await shot('11-carrying-crate');
console.log('carrying =', await p.evaluate(() => window.__town.room.carrying()));
const bare = await p.evaluate(() => window.__town.room.bare());
console.log('chore bare =', await p.evaluate(x => window.__town.room.chore(x), bare));
await p.waitForTimeout(700);
await shot('12-stocked');

// ---- C: with NO job, are the crates inert?
await p.evaluate(() => window.__town.work.set({ at: '' }));
await p.evaluate(() => window.__town.room.roomShow && 0);
await p.evaluate(() => { window.__town.rooms.exit(); });
await p.waitForTimeout(400);
await p.evaluate(() => window.__town.rooms.enter('store'));
await p.waitForTimeout(900);
console.log('NO JOB hints =', await p.evaluate(() => window.__town.room.hints()));
await shot('13-store-nojob');
console.log('ERRS', errs);
await b.close();
