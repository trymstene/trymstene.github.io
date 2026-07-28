// ⛲ THE WISHING FOUNTAIN + the 🪙 coin window it stages. Split from
// banana-park.js (P5); wired through the shared ctx (+ the garden API for
// the shared panel). The seed VOUCHER lives here (the fountain grants it,
// the garden spends it — park-garden.js imports the helpers).
import { poofInto, seedRand, COIN_PERIOD, COIN_WAIT, COIN_OFFSET, coinAmountFor } from '../lib/world.js';
import { passStat } from '../lib/banana-pass.js';
import { FOUNTAIN } from './park-geo.js';
import { track } from './park-util.js';

// ⛲ the fountain's answers — banana-lore wisdom, 8-ball register: warm,
// cryptic, a little absurd. Lowercase world voice. DRY lines join the pool
// only while the fountain stands empty (phases 0-1).
const WISDOM = [
  'the peel remembers what the fruit forgets.',
  'even the greenest banana ripens.',
  'the bunch is stronger than the banana.',
  'a banana never slips on its own peel. almost never.',
  'brown spots are just stories the sun wrote.',
  'you were not born yellow. you got there.',
  'the sweetest fruit hangs from the tiredest tree.',
  'dance like the floor is watching. it is.',
  'what the rave takes, the park gives back.',
  'a coin sinks. a wish floats. that is the trade.',
  'the acorn does not hurry. and yet, the oak.',
  'stand tall. bend when the wind says so.',
  'the second banana is somebody’s first.',
  'ripeness is not a race.',
  'the pond asks no questions. that is why the ducks like it.',
  'every peel opens from one end or the other. both are correct.',
  'the weeds return. so do you. that is the whole arrangement.',
  'somewhere a shell is missing you back.',
  'the watered plant remembers who watered it.',
  'this fountain has kept every wish ever tossed. yours is safe here.',
];
const DRY_WISDOM = [
  'the water is gone but the wishing remains.',
  'your coin lands in dust. the wish gets there anyway.',
  'a dry fountain still listens. it just can’t splash back.',
  'wish for rain first. the rest can wait.',
];

// ⛲ a fountain voucher: one at a time, spends on plant (park-garden.js)
export const VOUCHER_KEY = 'pk-seed-voucher';
export const VOUCHER_MAX = 60;                  // the daisy/sunflower/tulip tier
export const hasVoucher = () => { try { return localStorage.getItem(VOUCHER_KEY) === '1'; } catch (e) { return false; } };
export const setVoucher = (on) => { try { if (on) localStorage.setItem(VOUCHER_KEY, '1'); else localStorage.removeItem(VOUCHER_KEY); } catch (e) {} };

export function initFountain(ctx, garden) {
  const { W, H, world, pct, depth, float, toast, pos, tgt, coinBal, refreshHud } = ctx;
  const gardenPanel = document.getElementById('pkGarden');
  const gardenBody = document.getElementById('pkGardenBody');

  // ---- ⛲ THE WISHING FOUNTAIN — wish card → coin arc → the answer ---------
  // ⚠️ NO action-bar button — the world grammar is TAP THE THING (beach
  // stalls, rides): tap the fountain, walking over first if far. The WISH
  // CARD is the accident guard (Trym: instant tosses fired too easily) —
  // nothing spends until [make a wish]. The answer lands 8-ball style, and
  // once in a while the fountain blesses back: coins, or a free-seed voucher.
  const TOSS_AT = { x: FOUNTAIN[0], y: FOUNTAIN[1] + 10 };
  let pendingToss = false;
  let tossTracked = false, tossBusy = false;
  let wishIdx = Math.floor(Math.random() * WISDOM.length);
  function tapFountain(wx, wy) {
    if (Math.hypot(wx - TOSS_AT.x, wy - TOSS_AT.y) > 80) return false;
    if (Math.hypot(pos.x - TOSS_AT.x, pos.y - TOSS_AT.y) < 120) { openWishCard(); return true; }
    pendingToss = true;
    tgt.x = TOSS_AT.x;
    tgt.y = TOSS_AT.y + 92;
    return true;
  }
  function tossTick() {
    if (pendingToss && Math.hypot(pos.x - TOSS_AT.x, pos.y - TOSS_AT.y) < 120) {
      pendingToss = false;
      openWishCard();
    }
  }
  function openWishCard() {
    if (tossBusy) return;
    const bal = coinBal();
    gardenBody.innerHTML = '<h2>⛲ the wishing fountain</h2>'
      + (bal < 1
        ? '<p class="pk-panel__sub">no coins — the rave floor drops them.</p>'
        : '<p class="pk-panel__sub">toss a coin and make a wish? (you have ' + bal + ' 🪙)</p>'
          + '<button class="pk-btn pk-gbtn" id="pkWishBtn" type="button">🪙 make a wish</button>');
    const wb = document.getElementById('pkWishBtn');
    if (wb) wb.addEventListener('click', () => { garden.closeGarden(); doWish(); });
    gardenPanel.hidden = false;
  }
  function doWish() {
    if (tossBusy) return;
    if (coinBal() < 1) { toast('no coins — the rave floor drops them'); return; }
    passStat('coins_spent', 1);
    refreshHud();
    if (!tossTracked) { tossTracked = true; track('park_toss'); }
    tossBusy = true;
    const c = document.createElement('div');
    c.className = 'pk-coinfly';
    c.innerHTML = '<img src="/assets/banana-stand/coin.png" width="16" height="16" alt="" />';
    c.style.left = pct(pos.x, W);
    c.style.top = pct(pos.y - 34, H);
    world.appendChild(c);
    const bx = FOUNTAIN[0] + (Math.random() * 36 - 18), by = FOUNTAIN[1] - 32;
    requestAnimationFrame(() => { c.style.left = pct(bx, W); c.style.top = pct(by, H); });
    setTimeout(() => {          // the timer takes its own element with it
      c.remove();
      coinSplash(bx, by + 12);
      float(bx, by, '✦');
      tossBusy = false;
      wishAnswer();
    }, 720);
  }
  // the answer + the blessing roll: 72% wisdom only · 15% +4-10 🪙 · 10% a
  // free-seed voucher (small seeds, one held at a time — falls through to
  // coins while one is pending) · 3% jackpot +25 🪙. A mild sink still.
  function wishAnswer() {
    const pool = ctx.phase() <= 1 ? WISDOM.concat(DRY_WISDOM) : WISDOM;
    const line = pool[wishIdx++ % pool.length];
    const r = Math.random();
    let bless = '', result = 'wisdom';
    if (r < 0.03) {
      passStat('coins_earned', 25);
      refreshHud();
      bless = 'the fountain overflows — +25 🪙';
      result = 'jackpot';
    } else if (r < 0.13 && !hasVoucher()) {
      setVoucher(true);
      bless = '🎁 blessed — your next small seed is free';
      result = 'seed';
    } else if (r < 0.28) {
      const n = 4 + Math.floor(Math.random() * 7);
      passStat('coins_earned', n);
      refreshHud();
      bless = 'the fountain returns your kindness — +' + n + ' 🪙';
      result = 'coins';
    }
    track('park_wish', { result });
    gardenBody.innerHTML = '<h2>⛲ the fountain answers</h2>'
      + '<p class="pk-wishline" id="pkWishLine">' + line + '</p>'
      + (bless ? '<p class="pk-wishbless" id="pkWishBless">' + bless + '</p>' : '');
    gardenPanel.hidden = false;
    setTimeout(() => { const el = document.getElementById('pkWishLine'); if (el) el.classList.add('is-on'); }, 480);
    if (bless) setTimeout(() => { const el = document.getElementById('pkWishBless'); if (el) el.classList.add('is-on'); }, 1500);
  }

  // ---- 🪙 THE COIN WINDOW — the world clock, staged diegetically ----------
  // Same clock, odds and `bc-win` claim key as the club floor / old stand /
  // bay (world.js — no double-dipping). Only the STAGING is the park's own:
  // the coin washes up on the FOUNTAIN'S RIM with a splash — a tossed wish
  // come back. Park sick (phases 0-1) = the fountain is dry: no splash, the
  // coin just glints in the dry bowl. Still walk-over to claim.
  const coinWinEl = document.createElement('div');
  coinWinEl.className = 'pk-coin';
  coinWinEl.noCull = true;      // owns its own display — the sweep keeps off it
  coinWinEl.style.display = 'none';
  world.appendChild(coinWinEl);
  let coinLive = null, coinShownWin = -1;
  let coinWinClaimed = -1;
  try { coinWinClaimed = parseInt(localStorage.getItem('bc-win') || '-1', 10); } catch (e) {}
  function rimSpotFor(w2) {   // a spot on the basin's front rim, per window
    return {
      x: FOUNTAIN[0] - 52 + seedRand(0x51ab + w2 * 2) * 104,
      y: FOUNTAIN[1] + 24 + seedRand(0x51ab + w2 * 2 + 1) * 12,
    };
  }
  function coinSplash(x, y) {
    if (ctx.phase() < 2) return;   // dry bowl — nothing to splash with
    const s = document.createElement('div');
    s.className = 'pk-splash';
    s.innerHTML = '<i></i><i></i><i></i>';
    s.style.left = pct(x, W);
    s.style.top = pct(y, H);
    depth(s, y + 1);
    world.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
  function coinWinTick() {
    const t = Date.now() / 1000;
    const cPh = (((t - COIN_OFFSET) % COIN_PERIOD) + COIN_PERIOD) % COIN_PERIOD;
    const cWin = Math.floor((t - COIN_OFFSET) / COIN_PERIOD);
    if (cPh < COIN_WAIT && coinWinClaimed !== cWin) {
      const cs = rimSpotFor(cWin);
      coinWinEl.className = 'pk-coin pk-coin--' + coinAmountFor(cWin);
      coinWinEl.style.display = '';
      coinWinEl.style.left = pct(cs.x, W);
      coinWinEl.style.top = pct(cs.y, H);
      depth(coinWinEl, cs.y);
      coinLive = { x: cs.x, y: cs.y, win: cWin };
      if (coinShownWin !== cWin) {   // fresh window → the wash-up moment
        coinShownWin = cWin;
        coinSplash(cs.x, cs.y);
        float(cs.x, cs.y - 14, '✦');
      }
    } else {
      // unclaimed windows leave in the smoke; claimed ones already vanished
      if (coinLive && coinWinClaimed !== coinLive.win && coinWinEl.style.display !== 'none') {
        poofInto(world, 'pk-poof', coinLive.x / W * 100, coinLive.y / H * 100);
      }
      coinWinEl.style.display = 'none';
      coinLive = null;
    }
    // the catch: walk into it — same monotonic wallet as everywhere
    if (coinLive && Math.hypot(pos.x - coinLive.x, pos.y - coinLive.y) < 44) {
      const n = coinAmountFor(coinLive.win);
      coinWinClaimed = coinLive.win;
      try { localStorage.setItem('bc-win', String(coinWinClaimed)); } catch (e) {}
      passStat('coins_earned', n);
      refreshHud();
      float(coinLive.x, coinLive.y - 16, '+' + n);
      toast(ctx.phase() >= 2 ? '🪙 someone’s wish washed up — yours now'
        : '🪙 an old wish in the dry bowl — yours now', 3000);
      track('rave_coin', { n, at: 'park' });
      coinWinEl.style.display = 'none';
      coinLive = null;
    }
  }

  return {
    tossTick, coinWinTick, tapFountain,
    clearPending: () => { pendingToss = false; },
  };
}
