// Tally's Exchange (optional cut) — the day's order board: three residents' faces, what each wants and pays. Our banana
// has the shells Twirl asked for (a seeded beach count: the order reads the pass's sh_coquinas), taps Deliver, and the
// order is paid: the row says so in its own line and the coins fly from the button into the purse.
// ⚠️ NOT Fig Jr.'s crops (36 coins, more coins in the air): its paid line prints "Delivered to Fig Jr.. Tally paid…" — the
// name's own full stop and the line's (town-exchange.json orders.paid) — a real typo, reported, not filmed.
// ⚠️ THE ORDER IS THE SERVER'S (worker-pass /town/order), STUBBED with the answer's own shape — nothing reaches a record.
//   town-exchange        with the HUD strip (the purse that catches the coins)
//   town-exchange-clean  the same frames without it
import { test } from '@playwright/test';
import { pause, wait } from './harness.mjs';
import { town, rollSync, notes, boxPx } from './town-day-helpers.mjs';

const VW = 640, VH = 1138;
test.use({ viewport: { width: VW, height: VH + 100 }, deviceScaleFactor: 2 });
const json = (b) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });

test('town-exchange', async ({ page }) => {
  test.setTimeout(10 * 60000);
  const stub = async (p) => {
    await p.route('**/banana-pass.trymstene.workers.dev/town/order', (r) => {
      const b = JSON.parse(r.request().postData() || '{}');
      if (b.view) return r.fulfill(json({ ok: true, done: [] }));
      return r.fulfill(json({ ok: true, done: [b.id], n: 2, coins: 10, slots: {}, seen: [], wallet: { bal: 56, seq: 8 } }));
    });
  };
  const t0 = new Date('2026-10-01T15:00:00').getTime();
  await town(page, { w: VW, h: VH, hour: 15, health: 92, stub, seed: {
    'pass-wallet-v1': { bal: 46, seq: 7, at: t0 },
    'pass-v1': { created: t0 - 20 * 864e5, patches: {}, stats: { sh_coquinas: 3 }, base: { sh_coquinas: 3 }, led: {}, days: [] },   // three coquinas found at the bay
  } });
  await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 800; t.pos.y = t.tgt.y = 850; });
  await page.addStyleTag({ content: [
    '#twView>:not(#twWorld):not(#twFx):not(.tw-night):not(#twPanel):not(.wh){visibility:hidden!important}',
    '.tw-toast{visibility:hidden!important}',
    'html[data-cap="clean"] #twView>.wh{visibility:hidden!important}',
  ].join('') });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__town.cards.exchange());
  await page.waitForFunction(() => !!document.querySelector('#twCardBody .tw-ex__order[data-area="bay"] [data-order]'), null, { timeout: 15000 });
  await page.waitForTimeout(1200);   // real time: the faces are drawn
  await pause(page);
  await wait(page, 300);
  const btn = await page.locator('#twCardBody .tw-ex__order[data-area="bay"] [data-order]').boundingBox();
  const clip = { x: 0, y: 0, width: VW, height: VH };
  const log = [], ev = { tap: 18, fly: -1, paid: -1 };
  const purse = await boxPx(page, '.wh__coins', clip), card = await boxPx(page, '.tw-card', clip), row = await boxPx(page, '#twCardBody .tw-ex__order[data-area="bay"]', clip);
  await rollSync(page, {
    secs: 4,
    views: [{ name: 'town-exchange', clip, cap: '' }, { name: 'town-exchange-clean', clip, cap: 'clean' }],
    each: async (i) => {
      if (i === ev.tap) { await page.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2); log.push(i + ' tap deliver ' + JSON.stringify(btn)); }
      const st = await page.evaluate(() => ({ bay: (document.querySelector('#twCardBody .tw-ex__order[data-area="bay"]') || {}).textContent || '', flying: document.querySelectorAll('.tw-fly').length, coins: (document.querySelector('.wh__coins') || {}).textContent || '' }));
      if (ev.fly < 0 && st.flying) ev.fly = i;
      if (ev.paid < 0 && st.coins.trim() === '56') ev.paid = i;
      if (i % 15 === 0) log.push(i + ' ' + JSON.stringify(st));
    },
  });
  console.log([...log, JSON.stringify(ev)].join('\n'));
  if (ev.fly < 0) throw new Error('no coins flew on film');
  const n = {
    what: `Tally's Exchange on the square: the day's order board (Bean wants milk, Twirl shells, Fig Jr. crops — each with their face, the pay and their own line). Our banana has Twirl's two coquinas, taps Deliver, the row turns Delivered ("Delivered to Twirl. Tally paid you 10 coins.") and six coins fly from the button up into the purse (46 → 56).`,
    best: [{ from: Math.max(0, ev.tap - 10), to: Math.min(119, ev.paid + 12), why: 'Deliver tapped, the row flips to Delivered, the coins fly up into the purse' }],
    focus: [
      { frame: ev.tap - 2, x: Math.round((btn.x + btn.width / 2) * 2), y: Math.round((btn.y + btn.height / 2) * 2), what: `the Deliver button on Twirl's order` },
      { frame: ev.fly + 6, x: row ? row.x : card.x, y: row ? row.y : card.y, what: `the row: Delivered, and Tally's line` },
      { frame: ev.paid, x: purse ? purse.x : card.x, y: purse ? purse.y : 40, what: 'the coins landing in the purse' },
    ],
    issues: `Optional 1-second cut: a text-heavy card (UI) over the dimmed square; the payoff is the small coin flight. The order is STUBBED (/town/order answered with the real shape) and the two coquinas are a seeded pass count. Twirl's order rather than Fig Jr.'s (36 coins, more coins in the air) because the game prints Fig Jr.'s paid line as "Delivered to Fig Jr.. Tally paid…" (a real double full stop: the name ends in one and town-exchange.json orders.paid adds another). The card re-centres by a few px when the row changes (the game's own layout). town-exchange-clean has no HUD strip (the coins then fly to nothing).`,
  };
  notes('town-exchange', n);
  notes('town-exchange-clean', { ...n, focus: n.focus.slice(0, 2) });
});
