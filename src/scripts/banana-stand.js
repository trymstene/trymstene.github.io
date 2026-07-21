// 🍌🏪 THE BANANA STAND — two scenes, old-videogame style.
// Scene 1: the room. YOUR banana (bb-last outfit, dancing on the same
// wall-clock beat as everywhere else) walks in at the bottom; tap the floor
// or hold WASD/arrows to steer it up to the kiosk. Reach the counter → CUT.
// Scene 2: the counter. The keeper fills the window — upper body behind the
// desk — and the options open. "Step back" cuts back to the room.
// The keeper is the dancing banana OFF DUTY: slow 3↔7 sway, coffee, tired
// half-lidded eyes fitted to the MEASURED eye whites of frame 3.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S, SVG } from '../lib/banana-engine.js';
import { WEARABLE_PACKS } from '../data/wearables.js';
import { passStat, passGet, passPush } from '../lib/banana-pass.js';

const room = document.getElementById('bsRoom');
if (room) init();

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

function init() {
  // ---- the keeper's outfit (shared by both scenes) ------------------------
  // Plain stock banana for now — Trym crafts the real shopkeeper look
  // himself later (tired-lids and the coffee both retired, his call 21 Jul).
  const KEEPER_OUTFIT = {
    hat: 'none', glasses: 'none', top: '', bottom: '', bg: 'transparent',
    captions: false, effect: 'none', extras: {},
  };
  const KEEPER_FRAME = 3; // he stands STILL (Trym's call) — done dancing

  // ---- your banana: dressed the way you left it in the builder ------------
  let myOutfit = { hat: 'none', glasses: 'none', extras: {} };
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o) myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {} };
  } catch (e) {}
  const ME_DRAW = {
    ...myOutfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
  };

  // ---- the wallet + the deed book: all pass stats -------------------------
  // balance = coins_earned − coins_spent; ownership = own_<id> > 0. Every one
  // of them is monotonic and max-merged by the sync blob, so cross-device
  // balances and purchases can never be lost. passStat is the only writer.
  const stats = () => passGet().stats || {};
  const coinBalance = () => {
    const s = stats();
    return Math.max(0, (s.coins_earned || 0) - (s.coins_spent || 0));
  };
  const isOwned = (id) => (stats()['own_' + id] || 0) > 0;
  const hudWallet = document.getElementById('bsWallet');
  const deskWallet = document.getElementById('bsDeskWallet');
  function refreshWallets() {
    const bal = coinBalance();
    if (hudWallet) hudWallet.textContent = bal;
    if (deskWallet) deskWallet.textContent = bal;
  }
  refreshWallets();

  const meEl = document.getElementById('bsMe');
  const meCtx = document.getElementById('bsMeCv').getContext('2d');
  const miniCtx = document.getElementById('bsMiniCv').getContext('2d');
  const keeperCtx = document.getElementById('bsKeeperCv').getContext('2d');

  // ---- scenes -------------------------------------------------------------
  const scene1 = document.getElementById('bsScene1');
  const scene2 = document.getElementById('bsScene2');
  const cut = document.getElementById('bsCut');
  let inShop = false;
  let cutAt = 0; // trigger cooldown — no re-cut while a cut is mid-flight
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let counterTracked = false;
  function cutTo(showShop) {
    inShop = showShop;
    cutAt = performance.now();
    // the park→counter funnel step: fired once per visit, on the first cut in
    if (showShop && !counterTracked) { counterTracked = true; track('stand_counter'); }
    // reposition IMMEDIATELY, not inside the delayed swap: with the banana
    // still AT the counter, the very next walk frame re-fired the proximity
    // trigger and cut straight back into the shop (Trym's double-click bug)
    if (!showShop) { pos.y = Math.max(pos.y, 54); tgt.x = pos.x; tgt.y = pos.y; }
    const swap = () => {
      scene1.hidden = showShop;
      scene2.hidden = !showShop;
      if (showShop) { drawKeeper(); say(COUNTER_HELLO); }
    };
    if (REDUCED) { swap(); return; }
    cut.classList.add('is-on');
    setTimeout(() => { swap(); cut.classList.remove('is-on'); }, 130);
  }

  // ---- scene 1: walking ---------------------------------------------------
  // positions in % of the room; feet at (x, y). The counter zone is where the
  // little kiosk's desk ends (~26% down, centered).
  const pos = { x: 50, y: 108 };  // walks IN from the park entrance below
  const tgt = { x: 50, y: 84 };
  // the hut sprite spans y 1.5%..35% — the counter zone sits just under it
  // ?counter = spawn a step from the desk (the rave's ?stagetest pattern —
  // lets tests and quick checks skip the walk)
  if (location.search.includes('counter')) { pos.x = 50; pos.y = 44; tgt.x = 50; tgt.y = 36; }
  const COUNTER = { x: 50, y: 38 };
  // the pond (park.png ellipse in room %) — bananas famously can't swim;
  // walking AROUND it is fine, so blocked moves slide along the shore
  const POND = { x: 81.9, y: 74.2, rx: 14.5, ry: 12.5 };
  const inPond = (x, y) => ((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2 < 1;
  const SPEED = 26; // %/s
  const keys = {};
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      keys[k] = true; e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  room.addEventListener('click', (e) => {
    const r = room.getBoundingClientRect();
    tgt.x = ((e.clientX - r.left) / r.width) * 100;
    tgt.y = ((e.clientY - r.top) / r.height) * 100;
    hint(false);
  });

  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!inShop) {
      const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      const ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
      if (kx || ky) { tgt.x = pos.x + kx * 6; tgt.y = pos.y + ky * 6; hint(false); }
      const dx = tgt.x - pos.x, dy = tgt.y - pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.5) {
        const m = Math.min(d, SPEED * dt);
        const nx = pos.x + (dx / d) * m, ny = pos.y + (dy / d) * m;
        if (!inPond(nx, ny)) { pos.x = nx; pos.y = ny; }
        else if (!inPond(nx, pos.y)) pos.x = nx;        // slide along the shore
        else if (!inPond(pos.x, ny)) pos.y = ny;
        else { tgt.x = pos.x; tgt.y = pos.y; }          // parked at the water's edge
      }
      pos.x = Math.max(8, Math.min(92, pos.x));
      pos.y = Math.max(32, Math.min(96, pos.y));
      meEl.style.left = pos.x + '%';
      meEl.style.top = pos.y + '%';
      meEl.style.transform = 'translateY(-100%)';
      // reached the counter → the scene cuts (cooldown: never mid-cut)
      if (now - cutAt > 400 && Math.hypot(pos.x - COUNTER.x, pos.y - COUNTER.y) < 13) cutTo(true);
    }
    requestAnimationFrame(step);
  }

  // dancing: everyone in Banana World shares the wall-clock beat
  const frameNow = () => {
    const cyc = BASE_CYCLE_S * 1000;
    return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES;
  };
  let lastMe = -1;
  function drawMe() {
    const f = frameNow();
    if (f === lastMe) return;
    lastMe = f;
    drawComposite(meCtx, 150, f, ME_DRAW);
  }

  // ---- the keeper (both sizes) --------------------------------------------
  function drawMini() { drawComposite(miniCtx, 150, KEEPER_FRAME, KEEPER_OUTFIT); }
  function drawKeeper() { drawComposite(keeperCtx, 360, KEEPER_FRAME, KEEPER_OUTFIT); }

  const hintEl = document.getElementById('bsHint');
  function hint(on) { if (hintEl) hintEl.classList.toggle('is-off', !on); }

  assetsReady().then(() => {
    drawMe(); drawMini(); drawKeeper();
    // redraw belt: mug + lids decode async, drawAcc skips silently
    setTimeout(() => { lastMe = -1; drawMe(); drawMini(); drawKeeper(); }, 500);
    setTimeout(() => { lastMe = -1; drawMe(); drawMini(); drawKeeper(); }, 1600);
    setInterval(drawMe, 120); // cheap: only redraws when the beat frame changes
    requestAnimationFrame((t) => { last = t; step(t); });
  });

  // ---- the keeper's floor call-outs (Barty-style) -------------------------
  // He greets you BY NAME if you've signed your pass (ps-name-v1 rides the
  // sync blob) — the little "this place knows me" beat.
  let passName = '';
  try { passName = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}
  const roomBubble = document.getElementById('bsRoomBubble');
  let roomTimer = null;
  function sayRoom(text) {
    if (!roomBubble) return;
    roomBubble.textContent = text;
    roomBubble.classList.add('is-on');
    clearTimeout(roomTimer);
    roomTimer = setTimeout(() => roomBubble.classList.remove('is-on'), 3600);
  }
  const GREETING = passName ? `welcome to the banana stand, ${passName}!` : 'welcome to the banana stand!';
  setTimeout(() => { if (!inShop) sayRoom(GREETING); }, 900);
  let callIdx = 0;
  setInterval(() => {
    if (inShop) return;
    sayRoom(LINES[callIdx % LINES.length]); callIdx++;
  }, 14000);

  // tapping the mini kiosk walks you there
  document.getElementById('bsMini').addEventListener('click', (e) => {
    e.stopPropagation();
    tgt.x = COUNTER.x; tgt.y = COUNTER.y + 4;
    hint(false);
  });

  // ---- scene 2: the counter — THE TILL IS OPEN ----------------------------
  const COUNTER_HELLO = 'what can i get you? everything on the wall is for sale. finally.';
  const LINES = [
    'the truck finally came. we are OPEN.',
    'coins from the floor spend just fine here.',
    "the squid is 120. nobody's bought the squid.",
    "there's always money in the banana stand.",
    "no refunds. we don't have the infrastructure.",
    'i used to dance, you know.',
  ];
  const bubble = document.getElementById('bsBubble');
  let lineIdx = 0, bubbleTimer = null;
  function say(text) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('is-on');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('is-on'), 3200);
  }
  document.getElementById('bsKeeper').addEventListener('click', () => say('*sips coffee*'));
  document.getElementById('bsBack').addEventListener('click', () => cutTo(false));

  // ---- THE STOCK: every `preview: 'stand'` item, straight from the manifest
  const STOCK = [];
  const extraSlot = (d) => (d.anchor === 'feet' ? 'shoes' : d.anchor === 'hand' ? 'hands' : 'body');
  Object.values(WEARABLE_PACKS).forEach((p) => {
    (p.hats || []).forEach((d) => { if (d.preview === 'stand') STOCK.push({ ...d, artKey: d.art, slot: 'hat' }); });
    (p.shades || []).forEach((d) => { if (d.preview === 'stand') STOCK.push({ ...d, artKey: d.front, slot: 'face' }); });
    (p.extras || []).forEach((d) => { if (d.preview === 'stand') STOCK.push({ ...d, artKey: d.art, slot: extraSlot(d) }); });
  });
  STOCK.sort((a, b) => (a.price || 0) - (b.price || 0)); // browse cheap → grail

  // keeper flavor for the spotlight (fallback = the daily phrase)
  const DESC = {
    potato: "it's a potato.",
    squidhat: "the squid. 120 coins. i don't make the rules. i am the rules.",
    medal: "you didn't participate in anything. congratulations.",
    sockssandals: 'open-toe. at a rave. bold.',
    buckethat: 'a bucket. worn confidently, it becomes a hat.',
    duckhat: 'the duck stays on your head at all times.',
    flamingoring: 'flotation certified. dance floor approved.',
  };
  const LOCK_SVG = '<svg viewBox="0 0 8 9" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="4" height="1" fill="#b8781b"/><rect x="1" y="1" width="1" height="2" fill="#b8781b"/><rect x="6" y="1" width="1" height="2" fill="#b8781b"/><rect x="0" y="3" width="8" height="5" fill="#ffd23f"/><rect x="0" y="8" width="8" height="1" fill="#e6a817"/><rect x="3" y="4" width="2" height="2" fill="#7a4a21"/><rect x="3" y="6" width="1" height="1" fill="#7a4a21"/></svg>';

  const shelf = document.getElementById('bsShelf');
  const spot = document.getElementById('bsSpot');
  const buyBtn = document.getElementById('bsSpotBuy');
  const tileById = new Map();
  let picked = null;

  // tile + spotlight states follow the wallet: owned = YOURS chip, too
  // expensive = the golden lock stays on, affordable = clean price tag
  function updateTileStates() {
    const bal = coinBalance();
    STOCK.forEach((item) => {
      const tile = tileById.get(item.id);
      if (!tile) return;
      const owned = isOwned(item.id);
      tile.classList.toggle('is-owned', owned);
      tile.classList.toggle('is-locked', !owned && bal < item.price);
      tile.setAttribute('aria-label', owned
        ? `${item.label} — yours`
        : `${item.label} — ${item.price} bananacoins${bal < item.price ? ' (not enough coins yet)' : ''}`);
    });
  }
  function updateSpot(item) {
    if (!item || !buyBtn) return;
    const bal = coinBalance();
    if (isOwned(item.id)) {
      buyBtn.textContent = '✓ yours — worn with pride';
      buyBtn.classList.add('is-owned');
      buyBtn.classList.remove('is-poor');
    } else if (bal >= item.price) {
      buyBtn.textContent = `buy — 🪙 ${item.price}`;
      buyBtn.classList.remove('is-owned', 'is-poor');
    } else {
      buyBtn.textContent = `🪙 ${item.price} — you have ${bal}`;
      buyBtn.classList.add('is-poor');
      buyBtn.classList.remove('is-owned');
    }
  }
  function pick(item, tile) {
    shelf.querySelectorAll('.bs-tile').forEach((t) => t.classList.remove('is-picked'));
    tile.classList.add('is-picked');
    picked = item;
    track('stand_item_view', { item: item.id });
    document.getElementById('bsSpotArt').innerHTML = SVG[item.artKey] || '';
    document.getElementById('bsSpotName').textContent = item.label;
    document.getElementById('bsSpotDesc').textContent = DESC[item.id] || item.phrase;
    document.getElementById('bsSpotPrice').textContent = item.price;
    updateSpot(item);
    spot.hidden = false;
  }
  if (shelf) {
    STOCK.forEach((item) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'bs-tile';
      tile.innerHTML =
        `<span class="bs-tile__art">${SVG[item.artKey] || ''}</span>` +
        `<b>${item.label}</b>` +
        `<span class="bs-tile__slot">${item.slot}</span>` +
        `<span class="bs-price"><img src="/assets/banana-stand/coin.png" width="14" alt=""> ${item.price}</span>` +
        `<span class="bs-tile__lock" aria-hidden="true">${LOCK_SVG}</span>` +
        `<span class="bs-tile__own" aria-hidden="true">YOURS</span>`;
      tile.addEventListener('click', () => pick(item, tile));
      tileById.set(item.id, tile);
      shelf.appendChild(tile);
    });
    updateTileStates();
  }

  // ---- the purchase: spend coins, record the deed, wear it out the door ----
  // exclusivity mirrors the builder: one pair of shoes, one body garment
  const FEET_IDS = [], BODY_IDS = [];
  Object.values(WEARABLE_PACKS).forEach((p) => (p.extras || []).forEach((d) => {
    if (d.anchor === 'feet') FEET_IDS.push(d.id);
    if (d.zone === 'body') BODY_IDS.push(d.id);
  }));
  function equip(item) {
    const wear = (o) => {
      if (item.slot === 'hat') { o.hat = item.id; return o; }
      if (item.slot === 'face') { o.glasses = item.id; return o; }
      const ex = { ...(o.extras || {}) };
      if (item.anchor === 'feet') FEET_IDS.forEach((id) => delete ex[id]);
      if (item.zone === 'body') BODY_IDS.forEach((id) => delete ex[id]);
      ex[item.id] = true;
      o.extras = ex;
      return o;
    };
    try {
      const saved = wear(JSON.parse(localStorage.getItem('bb-last') || '{}'));
      localStorage.setItem('bb-last', JSON.stringify(saved));
      passPush(); // bb-last rides the sync blob — nudge a push
    } catch (e) {}
    wear(ME_DRAW); // the park banana wears it on the very next frame
  }
  const SOLD_LINES = [
    (l) => `SOLD. the ${l} is yours. wear it loud.`,
    (l) => `the ${l}. excellent taste. probably.`,
    (l) => `one ${l}, no receipt. we don't do receipts.`,
  ];
  let soldIdx = 0;
  if (buyBtn) buyBtn.addEventListener('click', () => {
    const item = picked;
    if (!item) return;
    if (isOwned(item.id)) { say('you already own that one.'); return; }
    const bal = coinBalance();
    if (bal < item.price) {
      // still the demand list — now it means "wanted it, couldn't afford it"
      track('stand_buy_try', { item: item.id });
      say(`that's ${item.price}. you've got ${bal}. the floor pays in coins.`);
      return;
    }
    passStat('coins_spent', item.price);
    passStat('own_' + item.id, 1);
    equip(item);
    refreshWallets();
    updateTileStates();
    updateSpot(item);
    say(SOLD_LINES[soldIdx++ % SOLD_LINES.length](item.label.toLowerCase()));
    track('stand_buy', { item: item.id, price: item.price });
  });

  // ---- wall dressing: a FEW items at real wearable scale for the keeper
  // (Trym: bigger beats many tiny ones) — % widths so they scale with the
  // window on every screen
  const DECOR = [
    { id: 'buckethat', left: '2%', top: '8%', w: '21%', rot: -4 },
    { id: 'snorkelmask', left: '1%', top: '52%', w: '25%', rot: 3 },
    { id: 'duckhat', left: '76%', top: '6%', w: '23%', rot: 4 },
    { id: 'balloondog', left: '75%', top: '48%', w: '24%', rot: -3 },
  ];
  const win = document.querySelector('.bs-window');
  if (win) DECOR.forEach((d) => {
    const def = STOCK.find((s) => s.id === d.id);
    if (!def) return;
    const el = document.createElement('span');
    el.className = 'bs-decor';
    el.style.cssText = `left:${d.left};top:${d.top};width:${d.w};transform:rotate(${d.rot}deg);`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = SVG[def.artKey] || '';
    win.appendChild(el);
  });
}
