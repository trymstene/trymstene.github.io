// 📋 TALLY'S EXCHANGE — the order board and the spare-produce rows (27 Sep 2026). Its own lazy chunk, loaded the first time
// the Exchange's card opens (town-market.js hands it the market's helpers), so a banana who only spins the wheel downloads
// none of it.
//
// Trym, of the stall: "the Exchange looks visually abandoned … can it be much more? more than selling eggs for a better
// price if you peek in at the right time" — then "yes order board, every area". Every UTC day three residents pin an order
// here, one for what each of the other areas makes: the farm's eggs, milk and wool, the bay's fish and shells, the park's
// crops and hidden eggs (src/data/town/orders.js). Tally keeps the stall (town-life.js) and pays for what you bring.
//
// ⚠️ THE MONEY IS THE PASS WORKER'S (worker-pass /town/order): it checks today's orders, takes a farm order out of the SAVED
// farm all or nothing, gives a bay or park order out of a pass count, and pays each order once. This side draws the board,
// asks, and says what the answer says. The words are src/data/copy/town-exchange.json.
import { passPost, walletKeep, passServerSlots, ensureAnon, passStat, passRaw, statTotal } from '../lib/banana-pass.js';
import { XP_PAY } from '../data/xp-pay.js';   // ✨ an order pays world XP (the endgame plan's step 1c)
import { goodsInHand, soldFromHome } from '../lib/homestead-inventory.js';
import { fillWords } from '../lib/fill-words.js';
import { GOODS, priceOf, saleOf, rumourOf, dayOf } from '../data/town/market.js';
import { ordersOf, WANTS, spareFrom, LADDER_STEP } from '../data/town/orders.js';
import { FISH } from './fish-data.js';
import { SHELLS } from './shell-data.js';
import WORDS from '../data/copy/town-exchange.json';

const X = WORDS.exchange, O = WORDS.orders;
// where a banana short of an order goes to get more: the area that makes it
const AREA_HREF = { farm: '/homestead/', bay: '/beach/', park: '/park/' };
const SPECIES = { fish: Object.fromEntries(FISH.map((f) => [f.id, f.name])), shell: Object.fromEntries(SHELLS.map((s) => [s.id, s.name])) };

export function bootExchange(ctx) {
  const { openCard, track, esc, FRONTS, life, keepLine, fly, face, head, wireHead } = ctx;
  let tab = 'orders', done = null, busy = '', asked = false;   // done: today's delivered order ids, as the server holds them
  let top = '';   // 🤝 Tally at the card's head while she is at her post (town-market.js keeperHead), taken once per opening
  // what the last answer said about each order, told IN ITS OWN ROW — the thing that changed (design library §3d) — and
  // not in a line under the card, which a 360×640 phone has no room for (a string, or { html } for the pass link)
  const said = {};
  const el = (id) => document.getElementById(id);
  const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const look = (key) => (life && life.look ? life.look(key) : null);
  const nameOf = (o) => (o.kind ? SPECIES[o.want][o.kind] || o.kind : O.goods[o.want] || X.goods[o.want] || o.want);
  // what this banana has towards an order: the farm's goods on this device (-1: no homestead), or a pass count less what
  // orders took before — the same sum the server makes (orders.js spareFrom), so the button and the answer agree
  function haveOf(o) {
    if (WANTS[o.want].take === 'yard') { const g = goodsInHand(); return g ? g[o.want] | 0 : -1; }
    const raw = passRaw();
    return spareFrom((k) => statTotal(raw, k), o);
  }

  // ---- 📋 today's orders: who asks (their face and name), for what and how many, what it pays, their own line, what you have
  function orderRows(day) {
    return ordersOf(day).map((o) => {
      const r = look(o.who), have = haveOf(o), isDone = !!(done && done.includes(o.id)), note = said[o.id];
      const act = isDone || busy === o.id ? '<button type="button" disabled>' + esc(isDone ? O.done : O.wait) + '</button>'
        : have >= o.n ? '<button type="button" data-order="' + o.id + '">' + esc(O.deliver) + '</button>'
        : '<a class="tw-ex__go" href="' + AREA_HREF[o.area] + '">' + esc(O.go[o.area]) + '</a>';
      // a small grid (town.astro): the face; the order, then its pay and what you have; the button — and across the row's whole
      // width the resident's own line, or what the last answer said about this order (it replaces the line until the next)
      const say = note ? '<small class="tw-ex__say tw-ex__said">' + (note.html || esc(note)) + '</small>'
        : '<small class="tw-ex__say"><span class="tw-who">' + esc(r ? r.name : '') + '</span> <q>' + esc((O.wants[o.who] || {})[o.want] || '') + '</q></small>';   // the name its own pill, the words a quote (Trym, 27 Sep)
      return '<div class="tw-row tw-ex__order' + (isDone ? ' is-done' : '') + '" data-area="' + o.area + '">'
        + '<canvas class="tw-ex__face" width="88" height="88" data-face="' + o.who + '" aria-hidden="true"></canvas>'
        + '<b class="tw-ex__ask">' + esc(fillWords(O.ask, { what: nameOf(o), n: o.n })) + '</b>'
        + '<small class="tw-ex__have"><b>' + esc(fillWords(O.pay, { coins: o.coins })) + '</b>' + (isDone ? '' : ' · <span class="tw-ex__n">' + esc(fillWords(O.have, { have: Math.max(0, have) })) + '</span>') + '</small>'
        + '<span class="tw-ex__act">' + act + '</span>' + say + '</div>';
    }).join('');
  }
  // ---- 📈 the spare produce: the rows the Exchange was before the orders (Tally buys what is left over at today's price)
  function sellRows(day) {
    const have = goodsInHand();
    let rows = '', total = 0;
    GOODS.forEach(([id], i) => {
      const p = priceOf(day, i), y = priceOf(day - 1, i), n = have ? have[id] : 0;
      total += saleOf(day, i, n);
      const move = p > y ? fillWords(X.up, { was: y }) : p < y ? fillWords(X.down, { was: y }) : X.same;
      rows += '<div class="tw-row"><div><b>' + esc(X.goods[id]) + ' · ' + esc(fillWords(X.each, { price: p })) + '</b><small>' + esc(move) + ' · ' + esc(fillWords(X.have, { n })) + '</small></div>'
        + '<button type="button" data-sell="' + id + '"' + (n ? '' : ' disabled') + '>' + esc(fillWords(X.sell, { n })) + '</button></div>';
    });
    return { rows, said: have ? (total ? fillWords(X.total, { n: total }) : X.none) : X.noFarm };
  }
  const tabBtn = (id, label) => '<button type="button" role="tab" data-tab="' + id + '" aria-selected="' + (tab === id) + '"' + (tab === id ? ' class="is-on"' : '') + '>' + esc(label) + '</button>';
  // the card, drawn whole each time it changes. `line` is what the last SALE said (the spare-produce tab keeps its result
  // line under the rows; an order's answer is in its own row); a string, or { html } for the pass link
  function card(line) {
    const day = dayOf(Date.now());
    let body, res = '', fine = '', out0 = line;
    if (tab === 'orders') {
      body = orderRows(day);
      if (done && ordersOf(day).every((o) => done.includes(o.id))) fine = O.allDone;
    } else {
      const s = sellRows(day);
      body = s.rows; res = 'twSellRes'; fine = rumourOf(day) === 'up' ? X.rumourUp : X.rumourDown;
      if (out0 == null) out0 = s.said;
    }
    openCard((top || '<h2>' + esc(X.title) + '</h2><p class="tw-card__sub">' + esc(FRONTS.exchange || '') + '</p>')
      + '<div class="tw-board__tabs tw-ex__tabs" role="tablist">' + tabBtn('orders', O.tab) + tabBtn('sell', X.tab) + '</div>'
      + '<div class="tw-rows">' + body + '</div>' + (res ? '<p class="tw-result" id="' + res + '"></p>' : '') + (fine ? '<p class="tw-fine">' + esc(fine) + '</p>' : ''));
    const out = res && el(res);
    if (out && out0 != null) { if (typeof out0 === 'object') out.innerHTML = out0.html; else out.textContent = out0; }
    const q = (s) => document.querySelectorAll('#twCardBody ' + s);
    q('[data-tab]').forEach((b) => b.addEventListener('click', () => { if (tab !== b.dataset.tab) { tab = b.dataset.tab; card(); } }));
    q('[data-order]').forEach((b) => b.addEventListener('click', () => deliver(b.dataset.order, b)));
    q('[data-sell]').forEach((b) => b.addEventListener('click', () => sell(b.dataset.sell, b)));
    // the face of whoever asks: the same head the stall's keeper wears (town-market.js face)
    q('[data-face]').forEach((cv) => { const r = look(cv.dataset.face); if (r && face) face(cv, r.outfit); });
    if (top && wireHead) wireHead();
  }
  // what the server says is delivered today (once per visit to the card; a delivery answer carries it after that)
  async function refresh() {
    asked = true;
    await ensureAnon();
    const r = await passPost('/town/order', { view: 1 });
    if (!(r && r.ok && Array.isArray(r.done))) { asked = false; return; }
    done = r.done;
    if (tab === 'orders' && document.querySelector('#twCardBody .tw-ex__order') && !busy) card();
  }
  function open() { top = head ? head('exchange', X.title) : ''; card(); if (!asked) refresh(); }

  async function deliver(id, btn) {
    const o = ordersOf(dayOf(Date.now())).find((x) => x.id === id);
    if (!o || busy || btn.disabled) return;
    busy = id;
    delete said[id];
    const at = btn.getBoundingClientRect(), from = { x: at.left + at.width / 2, y: at.top + at.height / 2 };
    card();
    await ensureAnon();
    const r = await passPost('/town/order', { id });
    busy = '';
    if (r && r.ok) {
      done = Array.isArray(r.done) ? r.done : [...(done || []), id];
      passServerSlots(r.slots);
      if (o.area === 'farm' && r.n) soldFromHome(o.want, r.n, r.yard);
      try { passStat('tw_met_' + o.who, LADDER_STEP); } catch (e) {}   // a delivery is a visit they remember (the meeting ladder)
      try { passStat('rep', XP_PAY.town.order); } catch (e) {}   // ✨ and world XP
      track('town_order', { area: o.area, who: o.who, n: r.n | 0, coins: r.coins | 0 });
      const r0 = look(o.who);
      said[id] = fillWords(O.paid, { who: r0 ? r0.name : '', coins: r.coins | 0 });
      if (tab === 'orders') card();
      // 🪙 the pay flies from the button into the purse, and the wallet is paid as the first coin lands (§30.2) — never later
      let paid = false;
      const pay = () => { if (!paid) { paid = true; walletKeep(r); } };
      if (!still() && fly && r.coins > 0) { fly(Math.min(14, 4 + Math.round(r.coins / 5)), pay, from); setTimeout(pay, 2600); } else pay();
      return;
    }
    const e = r && r.error;
    if (e === 'done') done = [...new Set([...(done || []), id])];
    said[id] = e === 'keep' || e === 'not linked' ? { html: keepLine(O.keep, O.keepLink) }
      : e === 'short' ? fillWords(O.short, { have: r.have | 0, n: o.n }) : e === 'done' ? O.already : e === 'gone' ? O.gone : e === 'nofarm' ? O.noFarm : O.busy;
    if (tab === 'orders') card();
    track('town_order_refused', { area: o.area, who: o.who, r: e || 'none' });   // its own name: the desk counts names, never params
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
      if (tab === 'sell') card(r.took ? fillWords(X.paid, { coins: r.coins, n: r.took, what: X.things[good] }) : X.none);
      return;
    }
    const e = r && r.error;
    if (tab === 'sell') card(e === 'keep' || e === 'not linked' ? { html: keepLine(X.keep, X.keepLink) }
      : e === 'cap' ? fillWords(X.cap, { what: X.things[good] }) : e === 'nofarm' ? X.noFarm : X.busy);
    track('town_sell', { good, n: 0, r: e || 'none' });
  }
  return { open, seam: { done: () => done, tab: () => tab, show: (t) => { tab = t; card(); } } };
}
