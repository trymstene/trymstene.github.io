// 🧃🍌🏪 THE PARK'S SHOPS — Inka's merch kiosk (the one real-money thing)
// and the Banana Stand coin shop. Split from banana-park.js (P5); wired
// through the shared ctx (ME_DRAW/invalidateMe/sendOutfit = the equip seam).
import { drawComposite, assetsReady, outfitParams, SVG as ART } from '../lib/banana-engine.js';
import { WEARABLE_PACKS, DROPS } from '../data/wearables.js';
import { passStat, passGet, passPush } from '../lib/banana-pass.js';
import { catCustom } from '../lib/drops.js';
import { wearToCustom } from '../lib/wear-render.js';
import { MARKET } from './park-geo.js';
import { track, esc } from './park-util.js';

// 🧃 THE MERCH SHOP — keys are the PDP slugs (/make-a-banana/<key>/, from
// shared/products.js); prices are display hints, Shopify enforces the real one
const MERCH_PRODUCTS = [
  { key: 'sticker', name: 'kiss-cut sticker', price: '$11.99' },
  { key: 'mug', name: 'mug', price: '$22.99' },
  { key: 'tee', name: 'tee', price: '$26.99' },
];
// 🍌 INKA, keeper of the merch shop — monocle + a drawn print-shop apron
// (banana NPCs are our own art; the apron is painted over the composite)
const KEEPER_GREET = 'welcome in. everything on this wall is real — printed, packed and posted.';
const KEEPER_LINES = [
  'that wall is your banana, printed. tap one down and have a look.',
  'no coins in here. real things cost real money — that is what makes them real.',
  'stickers go everywhere. laptops, fridges, somebody’s forehead once.',
  'free shipping, anywhere on earth. i checked twice.',
];
// the apron, painted in 3px blocks on the 150 grid (inner-shadowed hem + a
// little banana on the pocket) — scaled to whatever canvas it lands on
function drawApron(ctx2d, S) {
  const u = S / 150;
  const px = (x, y, w, h, f) => { ctx2d.fillStyle = f; ctx2d.fillRect(x * u, y * u, w * u, h * u); };
  const BIB = '#3a5f8a', DARK = '#2a4668', HEM = '#22394f';
  px(63, 78, 3, 6, DARK); px(84, 78, 3, 6, DARK);       // straps
  px(63, 84, 24, 9, BIB);                                // bib
  px(57, 93, 36, 24, BIB);                               // skirt
  px(60, 117, 30, 5, DARK);                              // hem shadow
  px(63, 120, 24, 3, HEM);
  px(66, 99, 18, 12, DARK);                              // the pocket
  px(72, 102, 3, 6, '#ffe135'); px(75, 101, 3, 3, '#ffe135'); // pocket banana
  px(75, 107, 3, 2, '#c99a1e');
}

// 🍌🏪 THE BANANA STAND — the coin shop, ported from the old /park/ page
// (banana-stand.js). Same manifest stock, same DESC voice, same lock art.
const ST_HELLO = 'what can i get you? everything on the wall is for sale. finally.';
const ST_DESC = {
  potato: "it's a potato.",
  squidhat: "the squid. 120 coins. i don't make the rules. i am the rules.",
  medal: "you didn't participate in anything. congratulations.",
  sockssandals: 'open-toe. at a rave. bold.',
  buckethat: 'a bucket. worn confidently, it becomes a hat.',
  duckhat: 'the duck stays on your head at all times.',
  flamingoring: 'flotation certified. dance floor approved.',
};
const ST_SOLD = [
  (l) => `SOLD. the ${l} is yours. wear it loud.`,
  (l) => `the ${l}. excellent taste. probably.`,
  (l) => `one ${l}, no receipt. we don't do receipts.`,
];
const ST_LOCK_SVG = '<svg viewBox="0 0 8 9" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="4" height="1" fill="#b8781b"/><rect x="1" y="1" width="1" height="2" fill="#b8781b"/><rect x="6" y="1" width="1" height="2" fill="#b8781b"/><rect x="0" y="3" width="8" height="5" fill="#ffd23f"/><rect x="0" y="8" width="8" height="1" fill="#e6a817"/><rect x="3" y="4" width="2" height="2" fill="#7a4a21"/><rect x="3" y="6" width="1" height="1" fill="#7a4a21"/></svg>';
const ST_BACKCAT_PRICE = 50;

export function initShops(ctx) {
  const { W, H, world, pct, blink, pos, tgt, coinBal, refreshHud, ME_DRAW } = ctx;

  // ---- 🧃 THE MERCH CART — the one real thing in the park -----------------
  // The builder→merch bridge is dead; the cart IS merch's home now. Cards
  // show YOUR banana; a tap lands on the real PDP with the exact outfit
  // pre-built via the builder's own interchange params (h/g/ex/e — the same
  // string the gallery's merch CTAs ride).
  const CART_AT = { x: MARKET.cart[0], y: MARKET.cart[1] };
  const shopEl = document.getElementById('pkShop');
  const goodsEl = document.getElementById('pkGoods');
  const keeperCtx = document.getElementById('pkKeeperCv').getContext('2d');
  const keeperBubble = document.getElementById('pkKeeperBubble');
  const KEEPER_DRAW = {
    hat: 'none', glasses: 'monocle', extras: {},
    top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
  };
  let pendingShop = false;
  let sparkleAt = 0;
  let keeperTimer = null, keeperIdx = 0;
  function merchParams() {
    let o = {};
    try { o = JSON.parse(localStorage.getItem('bb-last') || '{}') || {}; } catch (e) {}
    return outfitParams(o).toString();
  }
  function keeperSay(text, ms) {
    keeperBubble.textContent = text;
    keeperBubble.classList.add('is-on');
    clearTimeout(keeperTimer);
    keeperTimer = setTimeout(() => keeperBubble.classList.remove('is-on'), ms || 5200);
  }
  function drawKeeper() {
    drawComposite(keeperCtx, 360, 2, KEEPER_DRAW);
    drawApron(keeperCtx, 360);
  }
  // 🍄 INKA IN THE KIOSK WINDOW, outdoors — the stand-keeper treatment on the
  // shop hut: chest-up in the cylinder's window band between the frame posts.
  // Set dressing only (pointer-events none — the hut stays the tap target),
  // unchanged across phases (keepers keep working). The ov-19 kiosk sprite is
  // 199×285 with its base on MARKET.cart, so the band derives from CART_AT.
  (() => {
    const KW = 199, KH = 285;
    const kL = CART_AT.x - KW / 2, kT = CART_AT.y - KH;
    const w = document.createElement('div');
    w.className = 'pk-standnpc';
    w.style.left = pct(kL + 68, W);
    w.style.top = pct(kT + 196, H);
    w.style.width = pct(64, W);
    w.style.height = pct(44, H);
    w.style.zIndex = String(100 + Math.round(CART_AT.y) + 1);
    const cv = document.createElement('canvas');
    cv.width = 150; cv.height = 150;
    cv.setAttribute('aria-hidden', 'true');
    w.appendChild(cv);
    world.appendChild(w);
    assetsReady().then(() => {
      const draw = () => {
        drawComposite(cv.getContext('2d'), 150, 2, KEEPER_DRAW);
        drawApron(cv.getContext('2d'), 150);
      };
      draw();
      setTimeout(draw, 700);
    });
  })();
  function openShop() {
    if (!shopEl.hidden) return;
    const q = merchParams();
    goodsEl.innerHTML = MERCH_PRODUCTS.map((pr) =>
      '<a class="pk-hang pk-hang--' + pr.key + '" href="/make-a-banana/' + pr.key + '/'
      + '?' + (q ? q + '&' : '') + 'from=parkshop" data-product="' + pr.key + '">'
      + '<span class="pk-hang__mock"><canvas width="150" height="150" aria-hidden="true"></canvas></span>'
      + '<i class="pk-hang__tag">' + pr.price + '</i>'
      + '<b>' + pr.name + '</b>'
      + '</a>').join('');
    goodsEl.querySelectorAll('.pk-hang').forEach((a) => {
      a.addEventListener('click', () => { track('stand_cart_click', { product: a.dataset.product }); });
    });
    // your banana on every wall good; the keeper behind the counter — with the
    // redraw belt, accessories decode async
    assetsReady().then(() => {
      const draw = () => {
        goodsEl.querySelectorAll('canvas').forEach((cv) => {
          drawComposite(cv.getContext('2d'), 150, 2,
            { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
        });
        drawKeeper();
      };
      draw();
      setTimeout(draw, 700);
    });
    blink(() => { shopEl.hidden = false; document.body.classList.add('pk-inside'); });
    keeperSay(KEEPER_GREET, 6000);
    // every open counts (Trym: visits ARE the metric — the money room's funnel
    // reads view → click {product} → PDP ?from=parkshop → purchase)
    track('stand_cart_view');
  }
  function closeShop() {
    if (shopEl.hidden) return;
    clearTimeout(keeperTimer);
    keeperBubble.classList.remove('is-on');
    blink(() => { shopEl.hidden = true; document.body.classList.remove('pk-inside'); });
  }
  // tap the HUT itself to enter (walk-then-open — the beach stall grammar)
  function tapShop(wx, wy) {
    if (!(Math.abs(wx - CART_AT.x) < 105 && CART_AT.y - 250 < wy && wy < CART_AT.y + 14)) return false;
    if (Math.hypot(pos.x - CART_AT.x, pos.y - CART_AT.y) < 110) { openShop(); return true; }
    pendingShop = true;
    tgt.x = CART_AT.x;
    tgt.y = CART_AT.y + 46;
    return true;
  }
  document.getElementById('pkKeeper').addEventListener('click', () => {
    keeperSay(KEEPER_LINES[keeperIdx++ % KEEPER_LINES.length]);
  });
  document.getElementById('pkShopClose').addEventListener('click', closeShop);
  document.getElementById('pkShopBack').addEventListener('click', closeShop);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !shopEl.hidden) closeShop(); });
  // proximity + the idle ✦ over the shop roof (rides the rAF step, so a
  // hidden tab sparkles nothing)
  function cartTick(now) {
    if (pendingShop && Math.hypot(pos.x - CART_AT.x, pos.y - CART_AT.y) < 110) {
      pendingShop = false;
      openShop();
    }
    if (now > sparkleAt) {
      sparkleAt = now + 6500 + Math.random() * 3000;
      const s = document.createElement('div');
      s.className = 'pk-sparkle';
      s.textContent = '✦';
      s.style.left = pct(CART_AT.x - 70 + Math.random() * 140, W);
      s.style.top = pct(CART_AT.y - 120 - Math.random() * 130, H);
      world.appendChild(s);
      setTimeout(() => s.remove(), 1500);
    }
  }

  // ---- 🍌🏪 THE BANANA STAND — the coin shop, walk-in edition -------------
  // Ported from banana-stand.js: the same manifest STOCK, lock/YOURS states,
  // back-catalog (curated drops + community items) and the buy flow writing
  // own_<id> pass stats + instant equip. LIVE COMMERCE — behavior identical
  // to the old /park/ page by construction (only the chrome moved).
  const STAND_AT = { x: MARKET.stand[0], y: MARKET.stand[1] };
  const standEl = document.getElementById('pkStand');
  const standBubble = document.getElementById('pkStandBubble');
  const standKeeperCtx = document.getElementById('pkStandKeeperCv').getContext('2d');
  const standWalletEl = document.getElementById('pkStandWallet');
  const ST_KEEPER_DRAW = {
    hat: 'none', glasses: 'none', extras: {},
    top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none',
  };
  const ST_KEEPER_FRAME = 3;   // he stands still — done dancing (Trym's call)
  // 🍌 the keeper IN THE WINDOW, outdoors — the old page's scene-1 look
  // (the same static frame-3 banana, chest-up behind the counter). Set
  // dressing only: pointer-events none, the whole hut stays the tap target.
  // The wrapper IS the window cutout (the generator's 22%/35%→78%/66%
  // backing rect on the ×2 hut box) and clips him; z = one above the hut.
  (() => {
    const HW = 176, HH = 172;                      // the placed hut, ×2
    const hutL = STAND_AT.x - HW / 2, hutT = STAND_AT.y - HH;
    const w = document.createElement('div');
    w.className = 'pk-standnpc';
    w.style.left = pct(hutL + HW * 0.22, W);
    w.style.top = pct(hutT + HH * 0.35, H);
    w.style.width = pct(HW * 0.56, W);
    w.style.height = pct(HH * 0.31, H);
    w.style.zIndex = String(100 + Math.round(STAND_AT.y) + 1);
    const cv = document.createElement('canvas');
    cv.width = 150; cv.height = 150;
    cv.setAttribute('aria-hidden', 'true');
    w.appendChild(cv);
    world.appendChild(w);
    assetsReady().then(() => {
      const draw = () => drawComposite(cv.getContext('2d'), 150, ST_KEEPER_FRAME, ST_KEEPER_DRAW);
      draw();
      setTimeout(draw, 700);
    });
  })();
  let pendingStand = false, standSparkleAt = 0, standCounterTracked = false;
  let standBuilt = false, standBubbleTimer = null, soldIdx = 0;
  const stStats = () => passGet().stats || {};
  const stOwned = (id) => (stStats()['own_' + id] || 0) > 0;
  function standSay(text) {
    standBubble.textContent = text;
    standBubble.classList.add('is-on');
    clearTimeout(standBubbleTimer);
    standBubbleTimer = setTimeout(() => standBubble.classList.remove('is-on'), 3200);
  }
  function refreshStandWallet() { standWalletEl.textContent = coinBal(); }

  // 👕 THE HUNG TEE — the way out of the coin shop, wearing the visitor's OWN
  // banana. It takes the wall's fourth hook so the door is part of the shop
  // rather than a panel under it.
  //
  // ⚠️ DYNAMIC IMPORT. sticker-core is the shop's brain (~31KB with its product
  // manifest and word filter) and the park is a game surface on a JS budget —
  // but buildStand() only ever runs once somebody actually walks to the
  // counter, so people who never shop never pay for it.
  //
  // ⚠️ RENDERED, NOT DRAWN. A hand-drawn shirt was the first attempt; the
  // engine already makes this exact garment for the builder's product tiles,
  // with the real banana on it. Reusing that means the wall can never disagree
  // with the shop, and it wears whatever hat you are wearing.
  function hangTheTee(stWin) {
    const a = document.createElement('a');
    a.className = 'pk-stand__tee';
    a.href = '/shop/';
    a.id = 'pkStandRealDoor';
    // smaller than the duck it hangs beside, tilted, and low enough that the
    // counter takes its hem
    a.style.cssText = 'left:72%;top:52%;width:22%;--tilt:-6deg;';
    a.setAttribute('aria-label', 'The Banana Shop — your banana printed on real things');
    const pill = document.createElement('span');
    pill.className = 'pk-stand__tee-pill';
    pill.textContent = 'REAL PRODUCT';
    a.appendChild(pill);
    stWin.appendChild(a);
    a.addEventListener('click', () => track('shop_door', { from: 'stand_tee' }));

    Promise.all([
      import('../lib/sticker-core.js'),
      import('../../shared/products.js'),
    ]).then(([core, mod]) => {
      const tee = (mod.default || []).find((p) => p.key === 'tee');
      if (!tee) return;
      let fit = {};
      try { fit = JSON.parse(localStorage.getItem('bb-last') || '{}') || {}; } catch (e) {}
      const cv = core.productMockup({
        hat: fit.hat || 'none', glasses: fit.glasses || 'none',
        extras: fit.extras || {}, c: fit.c,
        top: '', bottom: '', captions: false, effect: 'none',
        bg: 'transparent', frame: 3,
      }, tee, 360, { colorHex: '#ffffff', bare: true });
      // ⚠️ CROP TO THE GARMENT. The mockup is a SQUARE with transparent space
      // above and below the shirt — hung as-is, that dead space made the wall
      // item look small and pushed the pill off the bottom edge of the window.
      const W = cv.width;
      const d = cv.getContext('2d').getImageData(0, 0, W, W).data;
      a.insertBefore(core.crop(cv, core.bboxOf([d], W)), pill);
    }).catch(() => { a.remove(); });   // no shirt is better than a broken hook
  }

  // THE STOCK: every `preview: 'stand'` item, straight from the manifest
  const ST_STOCK = [];
  const stExtraSlot = (d) => (d.anchor === 'feet' ? 'shoes' : d.anchor === 'hand' ? 'hands' : 'body');
  Object.values(WEARABLE_PACKS).forEach((p) => {
    (p.hats || []).forEach((d) => { if (d.preview === 'stand') ST_STOCK.push({ ...d, artKey: d.art, slot: 'hat' }); });
    (p.shades || []).forEach((d) => { if (d.preview === 'stand') ST_STOCK.push({ ...d, artKey: d.front, slot: 'face' }); });
    (p.extras || []).forEach((d) => { if (d.preview === 'stand') ST_STOCK.push({ ...d, artKey: d.art, slot: stExtraSlot(d) }); });
  });
  ST_STOCK.sort((a, b) => (a.price || 0) - (b.price || 0));   // browse cheap → grail

  const standShelf = document.getElementById('pkStandShelf');
  const standSpot = document.getElementById('pkStandSpot');
  const standBuyBtn = document.getElementById('pkStandBuy');
  const stTileById = new Map();
  const ST_ALL = [];   // stand stock + back-catalog entries (added async)
  let stPicked = null;
  function stItemArt(item) { return item.artHtml || ART[item.artKey] || ''; }
  function stUpdateTiles() {
    const bal = coinBal();
    ST_ALL.forEach((item) => {
      const tile = stTileById.get(item.id);
      if (!tile) return;
      const owned = stOwned(item.id);
      tile.classList.toggle('is-owned', owned);
      tile.classList.toggle('is-locked', !owned && bal < item.price);
      tile.setAttribute('aria-label', owned
        ? item.label + ' — yours'
        : item.label + ' — ' + item.price + ' bananacoins' + (bal < item.price ? ' (not enough coins yet)' : ''));
    });
  }
  function stUpdateSpot(item) {
    if (!item) return;
    if (stOwned(item.id)) {
      standBuyBtn.textContent = '✓ yours';
      standBuyBtn.classList.add('is-owned');
      standBuyBtn.classList.remove('is-poor');
    } else {
      standBuyBtn.textContent = 'get it';
      standBuyBtn.classList.toggle('is-poor', coinBal() < item.price);
      standBuyBtn.classList.remove('is-owned');
    }
  }
  function stPick(item, tile) {
    standEl.querySelectorAll('.pk-tile').forEach((t) => t.classList.remove('is-picked'));
    tile.classList.add('is-picked');
    stPicked = item;
    track('stand_item_view', { item: item.id });
    document.getElementById('pkStandSpotArt').innerHTML = stItemArt(item);
    document.getElementById('pkStandSpotName').textContent = item.label;
    document.getElementById('pkStandSpotDesc').textContent = item.back ? item.desc : (ST_DESC[item.id] || item.phrase);
    document.getElementById('pkStandSpotPrice').textContent = item.price;
    stUpdateSpot(item);
    standSpot.hidden = false;
  }
  function stAddTile(item, container) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'pk-tile' + (item.back ? ' is-back' : '');
    tile.innerHTML =
      '<span class="pk-tile__art">' + stItemArt(item) + '</span>'
      + '<b>' + item.label + '</b>'
      // a community piece wears its MAKER where stock items wear their slot —
      // the credit is the point of the shelf
      + '<span class="pk-tile__slot">' + (item.made ? 'by ' + esc(item.made)
        : item.back ? 'drop' : item.slot) + '</span>'
      + '<span class="pk-price"><img src="/assets/banana-stand/coin.png" width="14" alt=""> ' + item.price + '</span>'
      + '<span class="pk-tile__lock" aria-hidden="true">' + ST_LOCK_SVG + '</span>'
      + '<span class="pk-tile__own" aria-hidden="true">YOURS</span>';
    tile.addEventListener('click', () => stPick(item, tile));
    stTileById.set(item.id, tile);
    ST_ALL.push(item);
    container.appendChild(tile);
  }
  // 🕰 THE BACK-CATALOG — drop nights you missed, flat-priced above floor gear
  const stCatOwned = () => { try { return JSON.parse(localStorage.getItem('cat-own-v1') || '{}') || {}; } catch (e) { return {}; } };
  function stAddBackItems(items) {
    if (!items.length) return;
    document.getElementById('pkStandBackHead').hidden = false;
    const backShelf = document.getElementById('pkStandBackShelf');
    backShelf.hidden = false;
    items.forEach((it) => stAddTile(it, backShelf));
    stUpdateTiles();
  }
  function buildStand() {   // lazy — the shelf exists once the door first opens
    if (standBuilt) return;
    standBuilt = true;
    ST_STOCK.forEach((item) => stAddTile(item, standShelf));
    stUpdateTiles();
    // wall dressing — the old page's four hung items, verbatim (Trym: bigger
    // beats many tiny ones); % widths so they scale with the window
    const ST_DECOR = [
      { id: 'buckethat', left: '2%', top: '8%', w: '21%', rot: -4 },
      { id: 'snorkelmask', left: '1%', top: '52%', w: '25%', rot: 3 },
      { id: 'duckhat', left: '76%', top: '6%', w: '23%', rot: 4 },
      // ⚠️ the fourth hook now carries the TEE (below) — the way out to real
      // merch, hung as scenery rather than announced in a panel
    ];
    const stWin = standEl.querySelector('.pk-stand__window');
    if (stWin) ST_DECOR.forEach((d) => {
      const def = ST_STOCK.find((s) => s.id === d.id);
      if (!def) return;
      const el = document.createElement('span');
      el.className = 'pk-stand__decor';
      el.style.cssText = 'left:' + d.left + ';top:' + d.top + ';width:' + d.w + ';transform:rotate(' + d.rot + 'deg);';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = ART[def.artKey] || '';
      stWin.appendChild(el);
    });
    if (stWin) hangTheTee(stWin);
    stAddBackItems(DROPS
      .filter((d) => !((d.flag && localStorage.getItem(d.flag) === '1') || stOwned(d.id)))
      .map((d) => ({
        id: d.id, label: d.label, slot: d.slot === 'glasses' ? 'face' : d.slot,
        price: ST_BACKCAT_PRICE, back: true, flag: d.flag,
        artHtml: ART[d.art] || '',
        desc: (d.by ? 'from ' + d.by + '’s booth. ' : '') + 'you missed the drop night. money fixes that.',
      })));
    fetch('https://banana-share.trymstene.workers.dev/catalog/items.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        if (!Array.isArray(items)) return;
        // ⭐ 7 Aug: EVERY approved community wearable lives here, newest first,
        // and the ones you already own STAY on the shelf greyed out (Trym: the
        // wall of what the community made is the point — and a rave drop was a
        // coin flip most makers never saw land). Furniture sells at the phone.
        stAddBackItems(items
          .filter((it) => it.kind !== 'decor')
          .sort((a, b) => (b.added || 0) - (a.added || 0))
          .map((it) => ({
            id: it.id, label: it.title || 'community item', slot: 'c',
            price: ST_BACKCAT_PRICE, back: true, made: it.by || '',
            artHtml: (wearToCustom(it.wear) || {}).art || '',
            desc: (it.by ? 'made by ' + it.by + ', drawn in the forge. ' : 'drawn in the forge by a visitor. ')
              + 'approved by the banana guy — yours for coins.',
          })));
      })
      .catch(() => { /* offline: the curated back-catalog stands */ });
  }
  // the purchase: spend coins, record the deed, wear it out the door.
  // Exclusivity mirrors the builder: one pair of shoes, one body garment.
  const ST_FEET_IDS = [], ST_BODY_IDS = [];
  Object.values(WEARABLE_PACKS).forEach((p) => (p.extras || []).forEach((d) => {
    if (d.anchor === 'feet') ST_FEET_IDS.push(d.id);
    if (d.zone === 'body') ST_BODY_IDS.push(d.id);
  }));
  function stEquip(item) {
    const wear = (o) => {
      if (item.slot === 'c') { o.c = item.id; return o; }   // community: the one custom slot
      if (item.slot === 'hat') { o.hat = item.id; return o; }
      if (item.slot === 'face') { o.glasses = item.id; return o; }
      const ex = { ...(o.extras || {}) };
      if (item.anchor === 'feet') ST_FEET_IDS.forEach((id) => delete ex[id]);
      if (item.zone === 'body') ST_BODY_IDS.forEach((id) => delete ex[id]);
      ex[item.id] = true;
      o.extras = ex;
      return o;
    };
    try {
      const saved = wear(JSON.parse(localStorage.getItem('bb-last') || '{}'));
      localStorage.setItem('bb-last', JSON.stringify(saved));
      passPush();   // bb-last rides the sync blob — nudge a push
    } catch (e) {}
    wear(ME_DRAW);   // the park banana wears it on the very next frame
    ctx.invalidateMe();
    ctx.sendOutfit();   // everyone else's view too
  }
  standBuyBtn.addEventListener('click', () => {
    const item = stPicked;
    if (!item) return;
    if (stOwned(item.id)) { standSay('you already own that one.'); return; }
    const bal = coinBal();
    if (bal < item.price) {
      // still the demand list — "wanted it, couldn't afford it"
      track('stand_buy_try', { item: item.id });
      standSay('that’s ' + item.price + '. you’ve got ' + bal + '. the floor pays in coins.');
      return;
    }
    passStat('coins_spent', item.price);
    passStat('own_' + item.id, 1);
    if (item.back) {
      // back-catalog buys also write the LEGACY stores so every flag/cat-own
      // reader (rave gift gate, builder chips) unlocks at once
      if (item.flag) { try { localStorage.setItem(item.flag, '1'); } catch (e) {} }
      if (item.slot === 'c') {
        try {
          const ownM = stCatOwned();
          ownM[item.id] = Date.now();
          localStorage.setItem('cat-own-v1', JSON.stringify(ownM));
        } catch (e) {}
      }
    }
    stEquip(item);
    refreshHud();
    refreshStandWallet();
    stUpdateTiles();
    stUpdateSpot(item);
    standSay(ST_SOLD[soldIdx++ % ST_SOLD.length](item.label.toLowerCase()));
    track('stand_buy', { item: item.id, price: item.price, kind: item.back ? 'drop' : 'stand' });
  });
  document.getElementById('pkStandKeeper').addEventListener('click', () => standSay('*polishes the counter*'));
  function openStand() {
    buildStand();
    refreshStandWallet();
    stUpdateTiles();
    if (stPicked) stUpdateSpot(stPicked);
    assetsReady().then(() => {
      const draw = () => drawComposite(standKeeperCtx, 360, ST_KEEPER_FRAME, ST_KEEPER_DRAW);
      draw();
      setTimeout(draw, 700);
    });
    // one place, one title: the stand's neon sign replaces the park heading
    blink(() => { standEl.hidden = false; standEl.scrollTop = 0; document.body.classList.add('pk-inside'); });
    standSay(ST_HELLO);
    if (!standCounterTracked) { standCounterTracked = true; track('stand_counter'); }
  }
  function closeStand() {
    if (standEl.hidden) return;
    clearTimeout(standBubbleTimer);
    standBubble.classList.remove('is-on');
    blink(() => { standEl.hidden = true; document.body.classList.remove('pk-inside'); });
  }
  document.getElementById('pkStandBack').addEventListener('click', closeStand);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !standEl.hidden) closeStand(); });
  // tap the STAND BUILDING (tap-the-thing) → walk up → the counter cuts in
  function tapStand(wx, wy) {
    if (!(Math.abs(wx - STAND_AT.x) < 80 && STAND_AT.y - 130 < wy && wy < STAND_AT.y + 16)) return false;
    if (Math.hypot(pos.x - STAND_AT.x, pos.y - STAND_AT.y) < 115) { openStand(); return true; }
    pendingStand = true;
    tgt.x = STAND_AT.x;
    tgt.y = STAND_AT.y + 48;
    return true;
  }
  function standTick(now) {
    if (pendingStand && Math.hypot(pos.x - STAND_AT.x, pos.y - STAND_AT.y) < 115) {
      pendingStand = false;
      openStand();
    }
    if (now > standSparkleAt) {   // the kiosk's ✦ treatment, stand edition
      standSparkleAt = now + 7000 + Math.random() * 3200;
      const s = document.createElement('div');
      s.className = 'pk-sparkle';
      s.textContent = '✦';
      s.style.left = pct(STAND_AT.x - 60 + Math.random() * 120, W);
      s.style.top = pct(STAND_AT.y - 60 - Math.random() * 60, H);
      world.appendChild(s);
      setTimeout(() => s.remove(), 1500);
    }
  }

  return {
    cartTick, standTick, tapShop, tapStand,
    clearPending: () => { pendingShop = false; pendingStand = false; },
    // the QA reach-in — the counter otherwise needs a walk + a tap on the hut,
    // which is a lot of choreography to look at one shelf
    qa: { stand: openStand, shop: openShop },
  };
}
