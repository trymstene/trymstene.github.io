// 📈🎡 THE MARKET — the Wheel of Peel and the Exchange (23 Sep 2026). Its own lazy chunk, loaded the first time either
// card opens (or the square hears somebody win the pot), so a visitor who never spins or sells downloads none of it.
//
// ⚠️ THE MONEY IS THE PASS WORKER'S (worker-pass /town/wheel, /town/sell). The server rolls the wheel and pays it,
// and pays a sale only after the neighbourhood has taken the goods out of the SAVED farm. This side draws the
// card, asks, turns the wheel to the wedge the answer names and says what the answer says — nothing here decides
// a coin. The numbers both sides print are src/data/town/market.js; the words are src/data/copy/town-market.json.
import { passPost, walletKeep, passServerSlots, ensureAnon, PASS_API } from '../lib/banana-pass.js';
import { goodsInHand, soldFromHome } from '../lib/homestead-inventory.js';
import { fillWords } from '../lib/fill-words.js';
import { bigMoment } from '../lib/world-moment.js';
import { WEDGES, GOODS, priceOf, saleOf, rumourOf, dayOf, SPIN_COST } from '../data/town/market.js';
import WORDS from '../data/copy/town-market.json';

const W = WORDS.wheel, X = WORDS.exchange;
const KEEP_HREF = '/pass/?keep';
const nonce = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function bootMarket(ctx) {
  const { openCard, closeCard, isOpen, say, track, esc, drawWheel, pocketPaint, burstAt, view, pos, PROPS, FRONTS } = ctx;
  const labels = WEDGES.map(([id]) => W.wedges[id] || '');
  // the server's view of this banana's wheel: { pot, next: free | again | paid, left, cost }
  let st = null, angle = 0, spinning = false, last = null;
  const el = (id) => document.getElementById(id);
  const keepLine = (line, link) => esc(line) + ' <a href="' + KEEP_HREF + '">' + esc(link) + '</a>';

  // ---- 🎡 the wheel
  function paintPot() { const p = el('twPot'); if (p) p.textContent = st && st.pot != null ? fillWords(W.pot, { n: st.pot }) : ''; }
  function paintButton() {
    const b = el('twSpin');
    if (!b) return;
    const next = (st && st.next) || 'free';
    const verb = next === 'again' ? W.again : next === 'paid' ? W.paid : W.free;
    const note = next === 'again' ? W.againNote : next === 'paid' ? fillWords(W.paidNote, { n: (st && st.cost) || SPIN_COST }) : W.freeNote;
    b.querySelector('.tw-cta__verb').textContent = spinning ? W.wait : verb;
    b.querySelector('.tw-cta__rew').textContent = spinning ? '' : note;
    const capped = !!(st && next === 'paid' && st.left === 0);
    b.disabled = spinning || capped || !st;   // nothing to press until the server has said how the wheel stands
    if (capped && !spinning) { const r = el('twSpinRes'); if (r && !r.textContent) r.textContent = W.cap; }
  }
  async function refresh() {
    await ensureAnon();
    const r = await passPost('/town/wheel', { view: 1 });
    if (r && r.ok) { walletKeep(r); st = { pot: r.pot, next: r.next, left: r.left, cost: r.cost }; }
    else {
      // no pass on this device yet: the pot is still worth showing
      st = { ...(st || {}) };
      try { const p = await (await fetch(PASS_API + '/town/pot')).json(); st.pot = p.pot; } catch (e) {}
      if (r && r.error === 'keep') { const res = el('twSpinRes'); if (res) res.innerHTML = keepLine(W.keep, W.keepLink); }
    }
    paintPot();
    paintButton();
  }
  function wheelCard() {
    openCard('<h2>' + esc(W.title) + '</h2><p class="tw-card__sub">' + esc(FRONTS.wheel || '') + '</p>'
      + '<p class="tw-pot" id="twPot"></p>'
      + '<div class="tw-wheelwrap"><div class="tw-wheel__pin"></div><canvas class="tw-wheel" id="twWheel" width="440" height="440"></canvas></div>'
      + '<p class="tw-result" id="twSpinRes"></p>'
      + '<button class="tw-cta" id="twSpin" type="button"><span class="tw-cta__verb"></span><span class="tw-cta__rew"></span></button>');
    const cv = el('twWheel');
    drawWheel(cv, false, labels);
    cv.style.transform = 'rotate(' + angle + 'deg)';
    paintPot();
    paintButton();
    el('twSpin').addEventListener('click', () => spin(cv));
    refresh();
  }
  function saidOf(r) {
    if (r.full) return fillWords(W.full, { n: r.coins });
    if (r.id === 'pot') return fillWords(W.won.pot, { n: r.coins });
    if (r.coins) return fillWords(W.won.coins, { n: r.coins });
    if (r.item) return W.won[r.item] || '';
    return r.id === 'again' ? W.won.again : W.won.peel;
  }
  async function spin(cv) {
    if (spinning) return;
    spinning = true;
    const res = el('twSpinRes');
    if (res) res.textContent = '';
    paintButton();
    await ensureAnon();
    const n = nonce();
    let r = await passPost('/town/wheel', { n });
    // the answer lost on the way: ask for the SAME spin once more — the server answers its first roll again
    if (r && r.error === 'offline') r = await passPost('/town/wheel', { n });
    if (!r || !r.ok) {
      spinning = false;
      const e = r && r.error;
      if (res) {
        if (e === 'keep' || e === 'not linked') res.innerHTML = keepLine(W.keep, W.keepLink);
        else res.textContent = e === 'funds' ? fillWords(W.funds, { n: r.cost || SPIN_COST, have: r.bal | 0 }) : e === 'cap' ? W.cap : W.busy;
      }
      if (e === 'cap' && st) st.left = 0;
      paintButton();
      track('town_wheel', { kind: 'refused', r: e || 'none' });
      return;
    }
    walletKeep(r);
    passServerSlots(r.slots);
    last = r;
    // the wheel turns to the wedge the SERVER chose: always forward, never a snap back
    const per = 360 / WEDGES.length, want = (360 - (r.i * per + per / 2) + 360) % 360;
    angle += 5 * 360 + ((want - (angle % 360)) % 360 + 360) % 360;
    if (cv && cv.isConnected) cv.style.transform = 'rotate(' + angle + 'deg)';
    track('town_wheel', { kind: r.kind, w: r.id });
    setTimeout(() => {
      spinning = false;
      st = { ...(st || {}), pot: r.pot, next: r.next, left: r.left };
      pocketPaint();
      const line = saidOf(r), out = el('twSpinRes');
      if (out) out.textContent = line;
      paintPot();
      paintButton();
      if (r.id === 'pot' && r.coins) {
        track('town_pot', { n: r.coins });
        // ⭐ THE POT: the card folds, then the square celebrates (the hired moment's order: the card first, then the splash)
        setTimeout(() => {
          if (isOpen()) closeCard();
          burstAt(pos.x, pos.y, '', true);
          bigMoment(view, W.wedges.pot, fillWords(W.won.pot, { n: r.coins }));
        }, 1400);
      }
    }, 3500);
  }
  // 👥 the square's news (worker-rave SquareRoom): the pot moved, or somebody took it
  function onPot(pot, won, name) {
    st = { ...(st || {}), pot };
    paintPot();
    if (!won) return;
    const p = PROPS.wheel;
    if (p) burstAt(p.x + p.w / 2, p.y + p.h * 0.6, '', false);
    say(name ? fillWords(W.potWon, { name, n: won }) : fillWords(W.potWonAnon, { n: won }));
  }

  // ---- 📈 the Exchange
  function exchangeCard(line) {
    const day = dayOf(Date.now()), have = goodsInHand();
    let rows = '', total = 0;
    GOODS.forEach(([id], i) => {
      const p = priceOf(day, i), y = priceOf(day - 1, i), n = have ? have[id] : 0;
      total += saleOf(day, i, n);
      const move = p > y ? fillWords(X.up, { was: y }) : p < y ? fillWords(X.down, { was: y }) : X.same;
      rows += '<div class="tw-row"><div><b>' + esc(X.goods[id]) + ' · ' + esc(fillWords(X.each, { price: p })) + '</b><small>' + esc(move) + ' · ' + esc(fillWords(X.have, { n })) + '</small></div>'
        + '<button type="button" data-sell="' + id + '"' + (n ? '' : ' disabled') + '>' + esc(fillWords(X.sell, { n })) + '</button></div>';
    });
    const said = line != null ? line : have ? (total ? fillWords(X.total, { n: total }) : X.none) : X.noFarm;
    openCard('<h2>' + esc(X.title) + '</h2><p class="tw-card__sub">' + esc(FRONTS.exchange || '') + '</p>'
      + '<div class="tw-rows">' + rows + '</div>'
      + '<p class="tw-result" id="twSellRes"></p>'
      + '<p class="tw-fine">' + esc(rumourOf(day) === 'up' ? X.rumourUp : X.rumourDown) + '</p>');
    const out = el('twSellRes');
    if (out) { if (typeof said === 'object') out.innerHTML = said.html; else out.textContent = said; }
    document.querySelectorAll('#twCardBody [data-sell]').forEach((b) => b.addEventListener('click', () => sell(b.dataset.sell, b)));
  }
  async function sell(good, btn) {
    const have = goodsInHand(), n = have ? have[good] : 0;
    if (!n || btn.disabled) return;
    btn.disabled = true;
    await ensureAnon();
    const r = await passPost('/town/sell', { good, n });
    if (r && r.ok) {
      walletKeep(r);
      passServerSlots(r.slots);
      if (r.took) soldFromHome(good, r.took, r.yard);
      track('town_sell', { good, n: r.took | 0, coins: r.coins | 0 });
      exchangeCard(r.took ? fillWords(X.paid, { coins: r.coins, n: r.took, what: X.things[good] }) : X.none);
      return;
    }
    const e = r && r.error;
    exchangeCard(e === 'keep' || e === 'not linked' ? { html: keepLine(X.keep, X.keepLink) }
      : e === 'cap' ? fillWords(X.cap, { what: X.things[good] }) : e === 'nofarm' ? X.noFarm : X.busy);
    track('town_sell', { good, n: 0, r: e || 'none' });
  }

  return { wheel: wheelCard, exchange: () => exchangeCard(), pot: onPot, seam: { state: () => st, last: () => last, spinning: () => spinning, pot: onPot } };
}
