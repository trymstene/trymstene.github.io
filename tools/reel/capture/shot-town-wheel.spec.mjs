// "Spin the wheel." — Twirl's Wheel of Peel on the square: the card opens, our banana's free spin is tapped, the wheel
// winds up and runs (town-market.js: per-frame JS on the stepped clock, the pin flicking over every peg), slows onto a
// wedge, and the win plays as the game plays it: the wedge lights, the rim glows, confetti flies off it, the coins fly
// up into the purse and the line pops.
// ⚠️ THE ROLL IS THE SERVER'S (worker-pass /town/wheel), so it is STUBBED here with the answer's own shape: a plausible
// pot, a free spin, and the wedge this take wants. Nothing reaches a real record.
//   town-wheel      20 coins (a real 3% wedge) — with the HUD strip, whose purse rises to catch the coins
//   town-wheel-clean the same frames without the HUD strip
//   town-wheel-pot  THE POT (the rarest wedge, about one spin in four hundred): the card folds and the square's own big
//                   moment goes up over our banana — with the HUD strip; town-wheel-pot-clean without it
import { test } from '@playwright/test';
import { pause, wait } from './harness.mjs';
import { town, rollSync, notes, boxPx, worldPx } from './town-day-helpers.mjs';

const VW = 640, VH = 1138;
test.use({ viewport: { width: VW, height: VH + 100 }, deviceScaleFactor: 2 });

const POT = 214;
const json = (b) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
const stubWheel = (win) => async (page) => {
  await page.route('**/banana-pass.trymstene.workers.dev/town/pot', (r) => r.fulfill(json({ pot: POT })));
  await page.route('**/banana-pass.trymstene.workers.dev/town/wheel', (r) => {
    const b = JSON.parse(r.request().postData() || '{}');
    if (b.view) return r.fulfill(json({ ok: true, pot: POT, next: 'free', left: 30, cost: 3, wallet: { bal: 46, seq: 7 }, seen: [], slots: {} }));
    return r.fulfill(json({ ok: true, kind: 'free', item: '', full: false, next: 'paid', left: 30, slots: {}, seen: [], ...win }));
  });
};

async function spin(page, { name, win, secs, at, spinAt = -1, preSpin = 0, keepMoment }) {
  test.setTimeout(10 * 60000);
  await town(page, { w: VW, h: VH, hour: 15, health: 92, stub: stubWheel(win), seed: { 'pass-wallet-v1': { bal: 46, seq: 7, at: new Date('2026-10-01T15:00:00').getTime() } } });
  await page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, at);
  await page.addStyleTag({ content: [
    '#twView>:not(#twWorld):not(#twFx):not(.tw-night):not(#twPanel):not(.wh)' + (keepMoment ? ':not(.wm-moment)' : '') + '{visibility:hidden!important}',
    '.tw-toast{visibility:hidden!important}',
    'html[data-cap="clean"] #twView>.wh{visibility:hidden!important}',
  ].join('') });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__town.cards.wheel());
  await page.waitForFunction(() => { const b = document.getElementById('twSpin'); return b && !b.disabled; }, null, { timeout: 15000 });
  await page.waitForTimeout(1200);   // real time: the card's pictures and Twirl's face
  await pause(page);
  await wait(page, 300);
  const btn = await page.locator('#twSpin').boundingBox();
  const clip = { x: 0, y: 0, width: VW, height: VH };
  const log = [], ev = { tap: preSpin ? -1 : spinAt, stop: -1, paid: -1, closed: -1 };
  // a take that opens mid-spin: the tap and the wheel's first turns happen before the roll
  if (preSpin) { await page.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2); await wait(page, preSpin); }
  const wheel = await boxPx(page, '#twWheelWrap', clip), purse = await boxPx(page, '.wh__coins', clip), card = await boxPx(page, '.tw-card', clip);
  const coins0 = await page.evaluate(() => (document.querySelector('.wh__coins') || {}).textContent || '');
  let moment = null;
  await rollSync(page, {
    secs,
    views: [{ name, clip, cap: '' }, { name: name + '-clean', clip, cap: 'clean' }],
    each: async (i) => {
      if (i === spinAt) { await page.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2); log.push(i + ' tap ' + JSON.stringify(btn)); }
      const st = await page.evaluate(async () => { const m = await window.__town.market(); return { spinning: m.spinning(), turning: m.turning(), angle: Math.round(m.angle()), lit: m.lit(), res: (document.getElementById('twSpinRes') || {}).textContent || '', card: !document.getElementById('twPanel').hidden, coins: (document.querySelector('.wh__coins') || {}).textContent || '' }; });
      if (ev.stop < 0 && st.lit >= 0) ev.stop = i;   // stopped on its wedge in the step just shot: lit, glow, confetti
      if (ev.paid < 0 && st.coins !== coins0) ev.paid = i;   // the first coin lands in the purse
      if (ev.closed < 0 && !st.card) { ev.closed = i; moment = await boxPx(page, '.wm-moment', clip); }
      if (i % 15 === 0) log.push(i + ' ' + JSON.stringify(st));
    },
  });
  console.log([name, ...log, JSON.stringify(ev)].join('\n'));
  if (ev.stop < 0) throw new Error('the wheel never stopped on film');
  return { ev, wheel, purse, card, moment, me: await worldPx(page, at[0], at[1] - 45, clip) };
}

test('town-wheel', async ({ page }) => {
  const { ev, wheel, purse, card } = await spin(page, { name: 'town-wheel', win: { i: 3, id: 'c20', coins: 20, pot: POT, wallet: { bal: 66, seq: 8 } }, secs: 6, at: [1400, 850], spinAt: 12 });
  const n = {
    what: `The Wheel of Peel's card on the square (Twirl's face at its head): "Free spin" tapped, the wheel winds up and spins (the pin flicking over the pegs), slows and stops on 20 COINS — the wedge lights, the rim glows, confetti flies off it, the coins burst out and fly up into the purse, "You won 20 coins."`,
    best: [
      { from: Math.max(0, ev.tap - 6), to: Math.min(179, ev.stop + 50), why: 'tap, spin, slow-down, the stop on 20 coins and the confetti' },
      { from: Math.max(0, ev.stop - 20), to: Math.min(179, ev.stop + 55), why: 'the last turns, the stop, the glow, the coin flight' },
    ],
    focus: [
      { frame: ev.tap + 30, x: wheel.x, y: wheel.y, what: 'the wheel at full spin' },
      { frame: ev.stop + 4, x: wheel.x, y: wheel.y, what: 'stopped on 20 coins: lit wedge, rim glow, confetti' },
      { frame: Math.max(ev.stop + 12, ev.paid), x: purse ? purse.x : wheel.x, y: purse ? purse.y : 40, what: 'the coins landing in the purse (46 → 66)' },
    ],
    issues: `A card (UI) over the dimmed square, as the game shows it: the card is ${card.w}×${card.h} px of the 1280×2276 frame, so push in on it (the wheel itself is ${wheel.w} px across). The server's roll is STUBBED (a free spin answered with the real answer shape, landing on 20 coins — a real ~3% wedge); the pot shown (214) and the starting wallet (46) are plausible fakes. town-wheel keeps the HUD strip because its purse catches the flying coins (it reads LVL 1 · coins · the nightfall clock · solo); town-wheel-clean is the same frames without the HUD (the coins then fly off into nothing at the top right). The wheel is per-frame JS on the stepped clock; the glow, the coin flights and the text pop are CSS/WAAPI stepped with it (32 ms a frame).`,
  };
  notes('town-wheel', n);
  notes('town-wheel-clean', { ...n, what: n.what + ' (no HUD strip)', focus: n.focus.slice(0, 2) });
});

test('town-wheel-pot', async ({ page }) => {
  const { ev, wheel, purse, moment, me } = await spin(page, { name: 'town-wheel-pot', win: { i: 7, id: 'pot', coins: POT, pot: 100, wallet: { bal: 46 + POT, seq: 8 } }, secs: 6.5, at: [1400, 850], preSpin: 1500, keepMoment: true });
  const n = {
    what: `THE POT at the Wheel of Peel: the roll opens mid-spin, the wheel slows onto THE POT, the biggest win the wheel has — the most confetti, the coins pour into the purse (46 → 260), "THE POT! 214 coins, all yours." — then the card folds and the square's own big moment goes up over the wheel stall: "THE POT" in pixel type, with a burst over our banana standing in front of Twirl's stall.`,
    best: [
      { from: 0, to: Math.min(194, ev.stop + 45), why: 'the slow-down onto THE POT, the glow, confetti and the coin pour' },
      { from: Math.max(0, ev.closed - 6), to: 194, why: 'the card folds and THE POT goes up over the square, our banana and Twirl under it' },
    ],
    focus: [
      { frame: ev.stop + 4, x: wheel.x, y: wheel.y, what: 'stopped on THE POT' },
      { frame: Math.max(ev.stop + 12, ev.paid), x: purse ? purse.x : wheel.x, y: purse ? purse.y : 40, what: 'the purse filling' },
      ...(moment ? [{ frame: ev.closed + 10, x: moment.x, y: moment.y, what: 'THE POT moment over the square' }] : []),
      { frame: ev.closed + 4, x: me.x, y: me.y, what: `our banana under the burst, at Twirl's stall` },
    ],
    issues: `THE POT is the wheel's rarest wedge (about one spin in four hundred: worker-pass WHEEL_W pot 25/10000) — real, and the square announces it when it happens, but it is the jackpot, not the everyday spin (town-wheel is the everyday 20-coin win). The roll is STUBBED (a free spin answered with the real answer shape); the pot of 214 is a plausible fake. The big moment's words are the game's own (town-market.json). 6.5 s (195 frames): the moment holds to the end. town-wheel-pot-clean is the same frames without the HUD strip.`,
  };
  notes('town-wheel-pot', n);
  notes('town-wheel-pot-clean', { ...n, what: n.what + ' (no HUD strip)' });
});
