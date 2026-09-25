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
  const { openCard, closeCard, isOpen, say, track, esc, drawWheel, pocketPaint, burstAt, view, pos, PROPS, FRONTS, hud, pocketBtn, pocketIcon } = ctx;
  const labels = WEDGES.map(([id]) => W.wedges[id] || '');
  // the server's view of this banana's wheel: { pot, next: free | again | paid, left, cost }
  let st = null, angle = 0, spinning = false, last = null;
  const el = (id) => document.getElementById(id);
  const keepLine = (line, link) => esc(line) + ' <a href="' + KEEP_HREF + '">' + esc(link) + '</a>';
  const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

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
  let lit = -1;   // the wedge the last spin won, lit on the wheel until the next one
  function wheelCard() {
    openCard('<h2>' + esc(W.title) + '</h2><p class="tw-card__sub">' + esc(FRONTS.wheel || '') + '</p>'
      + '<p class="tw-pot" id="twPot"></p>'
      + '<div class="tw-wheelwrap" id="twWheelWrap"><div class="tw-wheel__pin"></div><canvas class="tw-wheel" id="twWheel" width="440" height="440"></canvas><canvas class="tw-wheelfx" id="twWheelFx" aria-hidden="true"></canvas></div>'
      + '<p class="tw-result" id="twSpinRes"></p>'
      + '<button class="tw-cta" id="twSpin" type="button"><span class="tw-cta__verb"></span><span class="tw-cta__rew"></span></button>');
    const cv = el('twWheel');
    drawWheel(cv, false, labels, lit);
    cv.style.transform = 'rotate(' + angle + 'deg)';
    paintPot();
    paintButton();
    el('twSpin').addEventListener('click', spin);
    refresh();
  }
  function saidOf(r) {
    if (r.full) return fillWords(W.full, { n: r.coins });
    if (r.id === 'pot') return fillWords(W.won.pot, { n: r.coins });
    if (r.coins) return fillWords(W.won.coins, { n: r.coins });
    if (r.item) return W.won[r.item] || '';
    return r.id === 'again' ? W.won.again : W.won.peel;
  }

  // ---- 🌀 THE SPIN (25 Sep 2026). Trym: "i click the button - it takes 3-4 seconds before anything happens, button is dark
  // - waiting - then if i've won i see my banana coins increase before the wheel has given me the result … i get half of
  // the answers on my spin by just watching my banana coins in my HUD … if im winning something there should be a bit more
  // 'wow'". The wheel waited for the server's roll before it moved, and the answer went into the wallet — which the HUD
  // reads every second — the moment it landed, three and a half seconds before the wheel stopped on it.
  // So: the wheel turns THE MOMENT you tap, a real wheel's wind-up, and keeps turning while the server rolls; the answer
  // plans a slow-down from wherever it is onto the wedge it names (never dead centre, never the same pace twice), the pin
  // flicking over every wedge that passes. NOTHING the answer carries is shown until the wheel STOPS: the coins, the
  // pocket and the pot arrive with the line that says so.
  const SPEED = 900, WIND = 280, MIN_RUN = 650;   // deg/s at full spin; ms to reach it; ms at speed before it may slow
  const PER = 360 / WEDGES.length;
  let motion = null, pinK = 0, pinAt = 0;
  const mod = (a, m) => ((a % m) + m) % m;
  function setAngle(a) { angle = a; const cv = el('twWheel'); if (cv) cv.style.transform = 'rotate(' + a.toFixed(2) + 'deg)'; }
  // the pin rides the pegs: each wedge edge that passes flicks it the way the wheel turns, and it springs back
  function pinTick(a, now, rest) {
    const k = Math.floor(a / PER);
    if (k !== pinK) { pinK = k; pinAt = now; }
    const bend = rest ? 0 : -18 * Math.max(0, 1 - (now - pinAt) / 150);
    const pin = document.querySelector('#twWheelWrap .tw-wheel__pin');
    if (pin) pin.style.transform = bend ? 'rotate(' + bend.toFixed(1) + 'deg)' : '';
  }
  function frame(now) {
    const m = motion;
    if (!m) return;
    let a;
    if (m.stop0 == null) {
      const t = now - m.t0;
      a = m.a0 + (t <= WIND ? SPEED * t * t / (2 * WIND) : SPEED * WIND / 2 + SPEED * (t - WIND)) / 1000;
      if (m.want != null && t >= MIN_RUN) {
        // from exactly here, at full speed: a quartic ease-out whose first step is the speed it already has
        m.stop0 = now; m.aS = a;
        m.D = m.fail ? 120 + mod(m.want - (a + 120), PER) : 360 + mod(m.want - (a + 360), 360);
        m.T = 4 * m.D / SPEED * 1000;
      }
    }
    if (m.stop0 != null) {
      const u = Math.min(1, (now - m.stop0) / m.T);
      a = m.aS + m.D * (1 - Math.pow(1 - u, 4));
      if (u >= 1) { setAngle(a); pinTick(a, now, true); motion = null; m.done(); return; }
    }
    setAngle(a);
    pinTick(a, now, false);
    requestAnimationFrame(frame);
  }
  // where to stop: inside the wedge the server rolled (somewhere in its middle three fifths), or — a spin that failed —
  // on a line between two wedges, so the wheel never seems to have said something it did not
  function stopOn(i, done) {
    const want = i == null ? 0 : mod(360 - (i * PER + PER * (0.5 + (Math.random() - 0.5) * 0.6)), 360);
    if (still() || !motion) { motion = null; setAngle(angle + mod(want - angle, 360)); done(); return; }
    motion.want = want; motion.fail = i == null; motion.done = done;
  }
  async function spin() {
    if (spinning) return;
    spinning = true;
    const res = el('twSpinRes');
    if (res) { res.textContent = ''; res.classList.remove('is-pop'); }
    if (lit !== -1) { lit = -1; const cv = el('twWheel'); if (cv) drawWheel(cv, false, labels, lit); }
    paintButton();
    // ⚡ it turns now — the server's roll takes its second while the wheel does what a wheel does
    if (!still()) { motion = { t0: performance.now(), a0: angle, want: null, stop0: null }; requestAnimationFrame(frame); }
    await ensureAnon();
    const n = nonce();
    let r = await passPost('/town/wheel', { n });
    // the answer lost on the way: ask for the SAME spin once more — the server answers its first roll again
    if (r && r.error === 'offline') r = await passPost('/town/wheel', { n });
    if (!r || !r.ok) { stopOn(null, () => refused(r)); return; }
    last = r;
    track('town_wheel', { kind: r.kind, w: r.id });
    stopOn(r.i, () => reveal(r));
  }
  function refused(r) {
    spinning = false;
    const e = r && r.error, res = el('twSpinRes');
    if (res) {
      if (e === 'keep' || e === 'not linked') res.innerHTML = keepLine(W.keep, W.keepLink);
      else res.textContent = e === 'funds' ? fillWords(W.funds, { n: r.cost || SPIN_COST, have: r.bal | 0 }) : e === 'cap' ? W.cap : W.busy;
    }
    if (e === 'cap' && st) st.left = 0;
    paintButton();
    track('town_wheel', { kind: 'refused', r: e || 'none' });
  }
  // 🛑 it has stopped: now, and only now, the answer is spent — the wallet the HUD reads, the pocket, the line
  function reveal(r) {
    spinning = false;
    // a coin win that flies spends its wallet as the first coin LANDS in the purse (celebrate); anything else, now
    const flying = !still() && r.coins > 0 && TIER(r) >= 2 && !!purse();
    let paid = false;
    const pay = () => { if (paid) return; paid = true; walletKeep(r); };
    if (flying) setTimeout(pay, 2600); else pay();   // …and never later than this, whatever the flight did
    passServerSlots(r.slots);
    st = { ...(st || {}), pot: r.pot, next: r.next, left: r.left };
    pocketPaint();
    const line = saidOf(r), out = el('twSpinRes');
    if (out) { out.textContent = line; out.classList.remove('is-pop'); void out.offsetWidth; out.classList.add('is-pop'); }
    else if (line) say(line);   // the card was shut mid-spin: the result is still told
    paintPot();
    paintButton();
    celebrate(r, pay);
    if (r.id === 'pot' && r.coins) {
      track('town_pot', { n: r.coins });
      // ⭐ THE POT: the card folds, then the square celebrates (the hired moment's order: the card first, then the splash)
      setTimeout(() => {
        if (isOpen()) closeCard();
        burstAt(pos.x, pos.y, '', true);
        bigMoment(view, W.wedges.pot, fillWords(W.won.pot, { n: r.coins }));
      }, 1600);
    }
  }

  // ---- 🎉 A WIN IS A MOMENT, and a bigger win a bigger one. A peel is the wheel's "nothing" (more than half of all
  // spins) and gets its line and no more, so the rest still mean something: spin-again bounces the button; an item or a
  // handful of coins lights the wedge, throws confetti off the wheel and flies the prize to where it lands — the item
  // into the pocket on the bar, the coins into the HUD's purse, which rises out of the card's shade to catch them; twenty
  // coins throws more of all of it; the pot the most, and then the square's own big moment.
  const TIER = (r) => (r.id === 'pot' && r.coins ? 4 : r.coins >= 20 ? 3 : r.coins > 0 || r.item ? 2 : r.id === 'again' ? 1 : 0);
  function celebrate(r, pay) {
    const tier = TIER(r);
    if (!tier) return;
    if (tier >= 2) { lit = r.i; const cv = el('twWheel'); if (cv) drawWheel(cv, false, labels, lit); }
    if (still()) return;
    const wrap = el('twWheelWrap');
    if (tier >= 2 && wrap) { wrap.classList.remove('is-win'); void wrap.offsetWidth; wrap.classList.add('is-win'); }
    if (tier === 1) { bump(el('twSpin'), 1.12); return; }
    confetti([0, 0, 46, 96, 150][tier]);
    if (r.coins > 0) flyCoins(Math.min(16, 4 + Math.round(r.coins / 2)), pay);
    else if (r.item) flyItem(r.item);
  }
  const bump = (node, s = 1.3) => { if (node && node.animate) node.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + s + ')' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' }); };
  // where a flight starts: the wheel's hub
  function hub() { const cv = el('twWheel'); if (!cv) return null; const b = cv.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
  function flyTo(node, from, to, i, onLand) {
    node.style.left = (from.x - 13) + 'px'; node.style.top = (from.y - 13) + 'px';
    document.body.appendChild(node);
    const sx = (Math.random() - 0.5) * 150, sy = -50 - Math.random() * 90;   // first out of the wheel, then the swoop
    const a = node.animate([
      { transform: 'translate(0, 0) scale(0.3)', opacity: 0 },
      { transform: 'translate(' + sx + 'px, ' + sy + 'px) scale(1.15)', opacity: 1, offset: 0.3, easing: 'cubic-bezier(.45,0,.85,.3)' },
      { transform: 'translate(' + (to.x - from.x) + 'px, ' + (to.y - from.y) + 'px) scale(0.6)', opacity: 1 },
    ], { duration: 820 + i * 18, delay: i * 55, easing: 'linear', fill: 'backwards' });
    a.onfinish = () => { node.remove(); if (onLand) onLand(i); };
  }
  // the HUD's purse, when it is on screen to fly into
  function purse() { const h = hud && hud(), chip = h && h.el && h.el.querySelector('.wh__coins'); return chip && chip.getBoundingClientRect().width ? chip : null; }
  function flyCoins(n, pay) {
    const from = hub(), h = hud && hud(), chip = purse();
    if (!from || !chip) { if (pay) pay(); return; }
    const cb = chip.getBoundingClientRect();
    const to = { x: cb.left + 12, y: cb.top + cb.height / 2 };
    h.el.classList.add('is-lit');   // the purse rises out of the card's shade to catch them
    let landed = 0;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('img');
      c.src = '/assets/banana-stand/coin.png'; c.alt = ''; c.className = 'tw-fly tw-fly--coin';
      flyTo(c, from, to, i, () => {
        landed++;
        if (landed === 1) { if (pay) pay(); try { h.refresh(); } catch (e) {} }
        bump(chip, 1.25);
        if (landed === n) setTimeout(() => h.el.classList.remove('is-lit'), 700);
      });
    }
  }
  function flyItem(kind) {
    const from = hub(), btn = pocketBtn && pocketBtn(), glyph = pocketIcon && pocketIcon(kind);
    if (!from || !btn || btn.hidden || !glyph) return;
    const b = btn.getBoundingClientRect();
    const node = document.createElement('div');
    node.className = 'tw-fly tw-fly--item'; node.innerHTML = glyph;
    flyTo(node, from, { x: b.left + b.width / 2, y: b.top + b.height / 2 }, 0, () => bump(btn, 1.35));
  }
  // the confetti: the wheel's own colours in the town's square pixels (the fireworks' grammar), off the rim
  function confetti(n) {
    const cv = el('twWheelFx');
    if (!cv || !n) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1), W0 = cv.clientWidth, H0 = cv.clientHeight;
    cv.width = Math.round(W0 * dpr); cv.height = Math.round(H0 * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = [...WEDGES.map((w) => w[1]), '#fffdf5', '#ffe135'];
    const cx = W0 / 2, cy = H0 / 2, parts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r0 = 70 + Math.random() * 30, s = 1.6 + Math.random() * 3.4;
      parts.push({ x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.6, c: cols[i % cols.length], z: Math.random() < 0.3 ? 6 : 4, life: 50 + Math.random() * 40 });
    }
    const step = () => {
      if (!cv.isConnected) return;
      g.clearRect(0, 0, W0, H0);
      let alive = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive++;
        p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.vx *= 0.99; p.life -= 1;
        g.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
        g.fillStyle = p.c;
        g.fillRect(Math.round(p.x), Math.round(p.y), p.z, p.z);
      }
      g.globalAlpha = 1;
      if (alive) requestAnimationFrame(step); else g.clearRect(0, 0, W0, H0);
    };
    requestAnimationFrame(step);
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

  return { wheel: wheelCard, exchange: () => exchangeCard(), pot: onPot, seam: { state: () => st, last: () => last, spinning: () => spinning, turning: () => !!motion, angle: () => angle, lit: () => lit, pot: onPot } };
}
