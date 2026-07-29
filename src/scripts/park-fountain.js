// ⛲ THE WISHING FOUNTAIN. Split from
// banana-park.js (P5); wired through the shared ctx (+ the garden API for
// the shared panel). The seed VOUCHER lives here (the fountain grants it,
// the garden spends it — park-garden.js imports the helpers).
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
    // ⚠️ THE BASIN, NOT AN 80px BUBBLE. The old radius reached halfway across
    // the plaza, so walking past the fountain kept opening the wish card and
    // you had to dismiss it every time (Trym). Now it is the bowl you can
    // actually reach over — the statue's tall stone is not a tap target.
    if (Math.abs(wx - TOSS_AT.x) > 46) return false;
    if (wy < TOSS_AT.y - 30 || wy > TOSS_AT.y + 32) return false;
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
  // 🪙 THE FOUNTAIN-RIM COIN WINDOW IS GONE (Trym: "the statue shouldnt drop
  // coins"). It staged a claimable coin on the basin every window, which made
  // the statue a faucet you could keep coming back to — and re-collect from,
  // since the claim rides one shared localStorage key across the whole world.
  // ⚠️ The park's coin income is now EGGS and weed roots only. If the park
  // ever needs a faucet again, put it somewhere that is not scenery: a thing
  // you find, not a thing you stand next to. The rave keeps its own window.
  const coinWinTick = () => {};

  // ✨ the splash a TOSSED wish makes — this is the fountain's own effect and
  // stays; it was only ever housed next to the coin window.
  function coinSplash(x, y) {
    if (ctx.phase() < 2) return;   // dry bowl — nothing to splash with
    const sp = document.createElement('div');
    sp.className = 'pk-splash';
    sp.innerHTML = '<i></i><i></i><i></i>';
    sp.style.left = pct(x, W);
    sp.style.top = pct(y, H);
    depth(sp, y + 1);
    world.appendChild(sp);
    setTimeout(() => sp.remove(), 800);
  }

  return {
    tossTick, coinWinTick, tapFountain,
    clearPending: () => { pendingToss = false; },
  };
}
