// 🏡 THE HOMESTEAD — your own clearing west of the park (task #106, M0).
//
// The world's first PERSONAL space: claim the plot, name it, buy decor at the
// mailbox, place it anywhere on your lawn (three verbs: place / move / put
// away), pitch the tent, grow the bed. M0 state is device-local (hs-v1);
// the YardRoom DO + slugs arrive with visiting (M1) — the shape below is
// already the DO's document so nothing migrates.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { passStat } from '../lib/banana-pass.js';
import { catCustom, loadCatalog } from '../lib/drops.js';
import { mountHud, coinBalance } from '../lib/world-hud.js';
import { initTravel } from './world-travel.js';
import { askName } from '../lib/banana-id.js';
import { WORLD, BOUND, ROAD, SPAWN, FENCE, PLOT, BED, TENT, MAILBOX, SIGN,
  OB_RECTS, OVERLAYS } from './homestead-geo.js';
import { DECOR } from '../data/decor.js';

const view = document.getElementById('hsView');

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

const HS_KEY = 'hs-v1';
const CAPS = [8, 16];            // placement spots per stage (the tent adds room)
const CROPS = [
  { id: 'tomato', name: 'Tomato', seed: 3, pay: 6 },
  { id: 'pumpkin', name: 'Pumpkin', seed: 3, pay: 6 },
  { id: 'wheat', name: 'Wheat', seed: 3, pay: 6 },
];
const TENT_PRICE = 50;
const dayStr = () => new Date().toISOString().slice(0, 10);

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(HS_KEY) || 'null');
    if (s && s.v === 1) return s;
  } catch (e) {}
  return { v: 1, name: '', claimedAt: 0, stage: 0, items: [], shed: [], bed: [null, null, null, null] };
}

function init() {
  const W = WORLD.w, H = WORLD.h;
  const world = document.getElementById('hsWorld');
  const meEl = document.getElementById('hsMe');
  const meCtx = document.getElementById('hsMeCv').getContext('2d');
  const hintEl = document.getElementById('hsHint');
  const exitEl = document.getElementById('hsExitStrip');
  const cutEl = document.getElementById('hsCut');
  const toastEl = document.getElementById('hsToast');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pct = (v, span) => (v / span * 100) + '%';

  const state = loadState();
  const save = () => { try { localStorage.setItem(HS_KEY, JSON.stringify(state)); } catch (e) {} };

  let myName = '';
  try { myName = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}

  let myOutfit = { hat: 'none', glasses: 'none', extras: {} };
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o) myOutfit = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {}, c: o.c };
  } catch (e) {}
  const ME_DRAW = { ...myOutfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
  loadCatalog().then(() => { try { lastF = -1; drawMe(); } catch (e) {} });

  // ---- camera (the park's, verbatim shape) --------------------------------
  const VIEW_ART_W = 900, VIEW_ART_V = 760, YARD_FIT = 640;
  let scale = 1, viewW = 0, viewH = 0, camX = 0, camY = 0;
  function layout() {
    const r = view.getBoundingClientRect();
    viewW = r.width; viewH = r.height;
    const want = Math.max(viewW / VIEW_ART_W, viewH / VIEW_ART_V);
    const fill = Math.max(viewW / W, viewH / H);
    scale = Math.min(1.7, viewW / YARD_FIT, Math.max(0.55, fill, want));
    world.style.width = (W * scale) + 'px';
    world.style.height = (H * scale) + 'px';
    replaceMovers();
  }
  addEventListener('resize', layout);
  layout();
  function camTarget() {
    return {
      x: Math.max(0, Math.min(Math.max(0, W * scale - viewW), pos.x * scale - viewW / 2)),
      y: Math.max(0, Math.min(Math.max(0, H * scale - viewH), pos.y * scale - viewH * 0.58)),
    };
  }
  let camWX = NaN, camWY = NaN;
  function cam() {
    const t = camTarget();
    camX += (t.x - camX) * 0.12;
    camY += (t.y - camY) * 0.12;
    if (Math.abs(t.x - camX) < 0.2) camX = t.x;
    if (Math.abs(t.y - camY) < 0.2) camY = t.y;
    if (camX === camWX && camY === camWY) return;
    camWX = camX; camWY = camY;
    world.style.transform = 'translate(' + (-camX) + 'px,' + (-camY) + 'px)';
  }

  const ME_ANCHOR = ' translate(-50%,-100%)';
  function place(el, x, y, tail) {
    el.cx = x; el.cy = y; el.cTail = tail || '';
    el.style.transform = 'translate(' + (x * scale) + 'px,' + (y * scale) + 'px)' + el.cTail;
  }
  function replaceMovers() {
    const kids = world ? world.children : [];
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i];
      if (el.cx === undefined) continue;
      el.style.transform = 'translate(' + (el.cx * scale) + 'px,' + (el.cy * scale) + 'px)' + el.cTail;
    }
  }
  const depth = (el, y) => { el.style.zIndex = String(100 + Math.round(y)); };

  // ---- baked fixture overlays (mailbox, sign) -----------------------------
  OVERLAYS.forEach((o) => {
    const d = document.createElement('div');
    d.className = 'hs-ov';
    d.style.left = pct(o[1], W); d.style.top = pct(o[2], H);
    d.style.width = pct(o[3], W); d.style.height = pct(o[4], H);
    d.style.backgroundImage = "url('/assets/homestead/" + o[0] + "')";
    depth(d, o[5]);
    world.appendChild(d);
  });

  // the sign carries the homestead's NAME — the whole point of the sign
  const signName = document.createElement('div');
  signName.className = 'hs-signname';
  signName.style.left = pct(SIGN.x, W); signName.style.top = pct(SIGN.y - 44, H);
  depth(signName, SIGN.y + 200);       // reads above nearby props
  world.appendChild(signName);
  function refreshSign() { signName.textContent = state.name || ''; signName.hidden = !state.name; }
  refreshSign();

  // ---- the tent (stage 1) -------------------------------------------------
  let tentEl = null;
  function refreshTent() {
    if (state.stage < 1) { if (tentEl) { tentEl.remove(); tentEl = null; } return; }
    if (tentEl) return;
    tentEl = document.createElement('div');
    tentEl.className = 'hs-ov';
    tentEl.style.left = pct(TENT.x - TENT.w / 2, W);
    tentEl.style.top = pct(TENT.y - TENT.h, H);
    tentEl.style.width = pct(TENT.w, W);
    tentEl.style.height = pct(TENT.h, H);
    tentEl.style.backgroundImage = "url('/assets/homestead/ov-tent.png')";
    depth(tentEl, TENT.y);
    world.appendChild(tentEl);
  }
  refreshTent();

  // ---- placed decor -------------------------------------------------------
  const DEX = {};
  DECOR.forEach((d) => { DEX[d.id] = d; });
  const itemEls = [];
  function itemDiv(it, ghost) {
    const d = DEX[it.id];
    const el = document.createElement('div');
    el.className = 'hs-it' + (ghost ? ' hs-it--ghost' : '');
    el.style.left = pct(it.x - d.w / 2, W);
    el.style.top = pct(it.y - d.h, H);
    el.style.width = pct(d.w, W);
    el.style.height = pct(d.h, H);
    el.style.backgroundImage = "url('" + d.img + "')";
    depth(el, it.y);
    world.appendChild(el);
    return el;
  }
  function refreshItems() {
    itemEls.forEach((el) => el.remove());
    itemEls.length = 0;
    state.items.forEach((it) => { if (DEX[it.id]) itemEls.push(itemDiv(it)); });
    rebuildSolids();
  }

  // ---- collision ----------------------------------------------------------
  let liveRects = [];
  function rebuildSolids() {
    liveRects = [];
    state.items.forEach((it) => {
      const d = DEX[it.id];
      if (d && d.solid) liveRects.push([it.x + d.solid[0], it.y + d.solid[1], it.x + d.solid[2], it.y + d.solid[3]]);
    });
    if (state.stage >= 1) liveRects.push([TENT.x + TENT.solid[0], TENT.y + TENT.solid[1], TENT.x + TENT.solid[2], TENT.y + TENT.solid[3]]);
    liveRects.push([BED[0] - 6, BED[1] - 6, BED[2] + 6, BED[3] + 6]);
  }
  const inRect = (x, y, r) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
  const inRoadLane = (y) => Math.abs(y - ROAD.y) < ROAD.hw - 6;
  function blocked(x, y) {
    if (x < BOUND || y < BOUND || y > H - BOUND) return true;
    if (x > W - BOUND && !inRoadLane(y)) return true;      // east = the road out
    for (const r of OB_RECTS) if (inRect(x, y, r)) return true;
    for (const r of liveRects) if (inRect(x, y, r)) return true;
    return false;
  }
  rebuildSolids();
  refreshItems();

  // ---- the bed ------------------------------------------------------------
  const slotEls = [null, null, null, null];
  function cropStage(b) { return !b ? 0 : Math.min(4, 1 + (b.waters | 0)); }
  function refreshBed() {
    BED.slots.forEach((s, i) => {
      if (slotEls[i]) { slotEls[i].remove(); slotEls[i] = null; }
      const b = state.bed[i];
      if (!b) return;
      const el = document.createElement('div');
      el.className = 'hs-crop' + (cropStage(b) >= 4 ? ' is-ripe' : '');
      el.style.left = pct(s[0] - 18, W); el.style.top = pct(s[1] - 40, H);
      el.style.width = pct(36, W); el.style.height = pct(40, H);
      el.style.backgroundImage = "url('/assets/park/c-" + b.crop + '-' + cropStage(b) + ".png')";
      depth(el, s[1]);
      world.appendChild(el);
      slotEls[i] = el;
    });
  }
  refreshBed();

  // ---- juice --------------------------------------------------------------
  function float(x, y, text) {
    const d = document.createElement('div');
    d.className = 'hs-float';
    d.textContent = text;
    d.style.left = pct(x, W); d.style.top = pct(y, H);
    world.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }
  let toastTimer = null;
  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), ms || 2400);
  }
  const hint = (on) => { if (hintEl) hintEl.classList.toggle('is-off', !on); };

  // ---- HUD + actions ------------------------------------------------------
  const hud = mountHud({
    mount: view,
    theme: { bg: 'rgba(16, 24, 12, 0.82)' },
    chips: ['lvl', 'coins'],
  });
  const refreshHud = () => hud && hud.refresh();
  document.getElementById('hsEmote').addEventListener('click', () => float(pos.x, pos.y - 44, '❤️'));
  initTravel({ here: 'homestead', mount: document.querySelector('.hs-actions'), btnClass: 'hs-act hs-act--icon', track });

  // ---- spawn + walking ----------------------------------------------------
  const pos = { x: SPAWN.x, y: SPAWN.y };
  const tgt = { x: SPAWN.x - 120, y: SPAWN.y };
  const c0 = camTarget(); camX = c0.x; camY = c0.y;
  track('homestead_open', { claimed: state.claimedAt ? 1 : 0 });

  const SPEED = 168;
  const keys = {};
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      if (panelOpen()) return;
      keys[k] = true; e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // ---- the east door: back to the park ------------------------------------
  const DOOR = { x: W - 40, y: ROAD.y };
  const DOOR_ZONE = 130, DOOR_GO = 40, DOOR_ARM = 200;
  let doorArmed = false, leaving = false, stripOn = false;
  function exitTo(href) {
    if (leaving) return;
    leaving = true;
    track('homestead_exit', { to: 'park' });
    if (REDUCED) { location.href = href; return; }
    cutEl.classList.add('is-on');
    setTimeout(() => { location.href = href; }, 170);
  }
  function doorTick() {
    const d = Math.hypot(pos.x - DOOR.x, pos.y - DOOR.y);
    if (!doorArmed) { if (d > DOOR_ARM) doorArmed = true; return; }
    if (d < DOOR_GO) { exitTo('/park/'); return; }
    const want = d < DOOR_ZONE;
    if (want !== stripOn) {
      stripOn = want;
      exitEl.textContent = 'keep walking → back to the park';
      exitEl.classList.toggle('is-on', want);
    }
  }

  // ---- panels -------------------------------------------------------------
  const claimEl = document.getElementById('hsClaim');
  const shopEl = document.getElementById('hsShop');
  const confirmEl = document.getElementById('hsConfirm');
  const panelOpen = () => !claimEl.hidden || !shopEl.hidden;

  // ---- 🪧 THE CLAIM — once, when you first walk through the gate ----------
  let claimShown = false;
  function offerClaim() {
    if (claimShown || state.claimedAt) return;
    claimShown = true;
    const inp = document.getElementById('hsClaimName');
    inp.value = myName ? myName + "'s Homestead" : 'My Homestead';
    claimEl.hidden = false;
    setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 40);
  }
  document.getElementById('hsClaimGo').addEventListener('click', async () => {
    const inp = document.getElementById('hsClaimName');
    const v = inp.value.trim().slice(0, 28);
    if (!v) { inp.focus(); return; }
    const btn = document.getElementById('hsClaimGo');
    btn.disabled = true;
    let ok = true;   // ⚠️ AWAITED — a promise is always truthy (the askName lesson)
    try { ok = await import('../lib/sticker-core.js').then((m) => m.captionsClean({ top: v })); } catch (e) {}
    btn.disabled = false;
    if (!ok) { toast('let’s keep the sign family friendly — try another name'); inp.focus(); return; }
    state.name = v;
    state.claimedAt = Date.now();
    save(); refreshSign();
    claimEl.hidden = true;
    toast('🏡 ' + v + ' — it’s yours');
    track('homestead_claim');
    // the naming moment, AFTER the deed (silent if already named/asked)
    askName({
      why: 'Your clearing has a sign now.',
      paint: (cv) => { try { drawComposite(cv.getContext('2d'), 72, 2, ME_DRAW); } catch (e) {} },
      clean: (v2) => import('../lib/sticker-core.js').then((m) => m.captionsClean({ top: v2 })).catch(() => true),
    }).then((nm) => { if (nm) myName = nm; });
  });

  // ---- 📬 the mailbox shop -------------------------------------------------
  const cap = () => CAPS[Math.min(state.stage, CAPS.length - 1)];
  function shopRow(d, verb, cb) {
    const row = document.createElement('div');
    row.className = 'hs-row';
    const im = document.createElement('img');
    im.src = d.img; im.alt = ''; im.loading = 'lazy';
    const meta = document.createElement('div');
    meta.className = 'hs-row__meta';
    meta.innerHTML = '<b></b><span></span>';
    meta.querySelector('b').textContent = d.name;
    meta.querySelector('span').textContent = verb === 'buy' ? d.price + ' 🪙' : 'in the shed';
    const btn = document.createElement('button');
    btn.className = 'hs-btn';
    if (verb === 'buy' && d.stage > state.stage) {
      btn.textContent = '🔒 needs the tent';
      btn.disabled = true;
    } else if (verb === 'buy') {
      btn.textContent = 'get it';
      btn.disabled = coinBalance() < d.price;
    } else {
      btn.textContent = 'place it';
    }
    btn.addEventListener('click', cb);
    row.append(im, meta, btn);
    return row;
  }
  function renderShop() {
    const list = document.getElementById('hsShopList');
    list.replaceChildren();
    const tab = shopEl.dataset.tab || 'order';
    const full = state.items.length >= cap();
    if (tab === 'order') {
      if (full) {
        const p = document.createElement('p');
        p.className = 'hs-note';
        p.textContent = state.stage < 1
          ? 'Your plot is full (' + cap() + ' spots) — the tent adds room.'
          : 'Your plot is full (' + cap() + ' spots) — pick something up to make space.';
        list.appendChild(p);
      }
      DECOR.forEach((d) => {
        list.appendChild(shopRow(d, 'buy', () => {
          if (full) { toast('the plot is full — ' + (state.stage < 1 ? 'the tent adds room' : 'put something away first')); return; }
          if (d.stage > state.stage || coinBalance() < d.price) return;
          passStat('coins_spent', d.price);
          refreshHud();
          track('homestead_buy', { id: d.id, price: d.price });
          closeShop();
          startPlacing(d.id);
        }));
      });
    } else if (tab === 'shed') {
      if (!state.shed.length) {
        const p = document.createElement('p');
        p.className = 'hs-note';
        p.textContent = 'Nothing in the shed — things you pick up land here.';
        list.appendChild(p);
      }
      state.shed.forEach((s, i) => {
        const d = DEX[s.id];
        if (!d) return;
        list.appendChild(shopRow(d, 'place', () => {
          if (state.items.length >= cap()) { toast('the plot is full'); return; }
          state.shed.splice(i, 1);
          save();
          closeShop();
          startPlacing(d.id);
        }));
      });
    } else {   // upgrades
      const card = document.createElement('div');
      card.className = 'hs-up';
      if (state.stage < 1) {
        card.innerHTML = '<img src="/assets/homestead/ov-tent.png" alt=""><div><b>Pitch a tent</b>'
          + '<span>' + TENT_PRICE + ' 🪙 — shelter, and the plot grows to ' + CAPS[1] + ' spots.'
          + ' Campfires and statues start arriving in the catalog.</span></div>';
        const btn = document.createElement('button');
        btn.className = 'hs-btn';
        btn.textContent = coinBalance() >= TENT_PRICE ? 'pitch it' : 'need ' + TENT_PRICE + ' 🪙';
        btn.disabled = coinBalance() < TENT_PRICE;
        btn.addEventListener('click', () => {
          passStat('coins_spent', TENT_PRICE);
          state.stage = 1;
          save(); refreshTent(); rebuildSolids(); refreshHud();
          closeShop();
          toast('⛺ the tent is up — home');
          float(TENT.x, TENT.y - TENT.h - 8, '⛺');
          track('homestead_tent');
        });
        card.appendChild(btn);
      } else {
        card.innerHTML = '<div><b>⛺ The tent is up</b><span>The cabin is being drawn — next upgrade coming soon.</span></div>';
      }
      list.appendChild(card);
    }
  }
  function openShop() {
    shopEl.hidden = false;
    renderShop();
    track('homestead_mailbox');
  }
  function closeShop() { shopEl.hidden = true; }
  shopEl.addEventListener('click', (e) => {
    if (e.target === shopEl) closeShop();
    const t = e.target.closest('[data-tab]');
    if (t && t.tagName === 'BUTTON') {
      shopEl.dataset.tab = t.dataset.tab;
      shopEl.querySelectorAll('.hs-tabs button').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.tab === t.dataset.tab)));
      renderShop();
    }
  });
  document.getElementById('hsShopClose').addEventListener('click', closeShop);

  // ---- 🪴 placing: the ghost + the confirm bar -----------------------------
  let placing = null;   // { id, x, y, el, moving }
  const snap = (v) => Math.round(v / 24) * 24;
  function spotOk(d, x, y) {
    if (x - d.w / 2 < PLOT[0] || x + d.w / 2 > PLOT[2]) return false;
    if (x < PLOT[0] + 10 || x > PLOT[2] - 10 || y < PLOT[1] + 24 || y > PLOT[3] - 6) return false;
    if (inRect(x, y, [BED[0] - 26, BED[1] - 46, BED[2] + 26, BED[3] + 16])) return false;
    if (Math.abs(x - TENT.x) < TENT.w * 0.55 + d.w * 0.3 && Math.abs(y - TENT.y + TENT.h * 0.3) < TENT.h * 0.55) return false;
    if (Math.hypot(x - MAILBOX.x, y - MAILBOX.y) < 50) return false;
    for (const it of state.items) {
      if (placing && placing.moving === it) continue;
      const o = DEX[it.id];
      if (Math.abs(x - it.x) < (d.w + o.w) * 0.32 && Math.abs(y - it.y) < 34) return false;
    }
    return true;
  }
  function startPlacing(id, moving) {
    cancelPlacing();
    const d = DEX[id];
    const x = snap(moving ? moving.x : Math.max(PLOT[0] + 60, Math.min(PLOT[2] - 60, pos.x)));
    const y = snap(moving ? moving.y : Math.max(PLOT[1] + 60, Math.min(PLOT[3] - 30, pos.y)));
    placing = { id, x, y, el: itemDiv({ id, x, y }, true), moving: moving || null };
    if (moving) { refreshItems(); }   // the original disappears while it moves
    updateGhost();
    confirmEl.hidden = false;
    hint(false);
    toast('tap the lawn to move it — then ✓', 3200);
  }
  function updateGhost() {
    if (!placing) return;
    const d = DEX[placing.id];
    placing.el.style.left = pct(placing.x - d.w / 2, W);
    placing.el.style.top = pct(placing.y - d.h, H);
    depth(placing.el, placing.y);
    const ok = spotOk(d, placing.x, placing.y);
    placing.el.classList.toggle('is-bad', !ok);
    document.getElementById('hsPlaceGo').disabled = !ok;
  }
  function cancelPlacing() {
    if (!placing) return;
    placing.el.remove();
    if (placing.moving) state.items.push(placing.moving);   // it never left
    const wasBuy = !placing.moving;
    const backId = placing.id;
    placing = null;
    confirmEl.hidden = true;
    if (wasBuy) { state.shed.push({ id: backId }); save(); toast('into the shed — place it any time'); }
    refreshItems();
  }
  document.getElementById('hsPlaceGo').addEventListener('click', () => {
    if (!placing) return;
    const it = { id: placing.id, x: placing.x, y: placing.y };
    placing.el.remove();
    const moved = !!placing.moving;
    placing = null;
    confirmEl.hidden = true;
    state.items.push(it);
    save();
    refreshItems();
    float(it.x, it.y - (DEX[it.id].h || 30) - 6, '✓');
    track(moved ? 'homestead_move' : 'homestead_place', { id: it.id });
  });
  document.getElementById('hsPlaceNo').addEventListener('click', cancelPlacing);

  // an existing item, tapped: move it or put it away
  let itChip = null;
  function itemChip(idx) {
    clearChip();
    const it = state.items[idx];
    const d = DEX[it.id];
    itChip = document.createElement('div');
    itChip.className = 'hs-chip';
    const mv = document.createElement('button');
    mv.className = 'hs-btn'; mv.textContent = '✥ move';
    const rm = document.createElement('button');
    rm.className = 'hs-btn hs-btn--ghost'; rm.textContent = '📦 put away';
    mv.addEventListener('click', () => {
      const moving = state.items.splice(idx, 1)[0];
      clearChip();
      startPlacing(moving.id, moving);
    });
    rm.addEventListener('click', () => {
      const gone = state.items.splice(idx, 1)[0];
      state.shed.push({ id: gone.id });
      save();
      clearChip();
      refreshItems();
      float(it.x, it.y - 40, '📦');
      track('homestead_pickup', { id: gone.id });
    });
    itChip.append(mv, rm);
    itChip.style.left = pct(it.x, W);
    itChip.style.top = pct(it.y - d.h - 14, H);
    itChip.style.zIndex = '3000';
    world.appendChild(itChip);
  }
  function clearChip() { if (itChip) { itChip.remove(); itChip = null; } }

  // the bed, tapped: plant / water / harvest
  let bedChip = null;
  function clearBedChip() { if (bedChip) { bedChip.remove(); bedChip = null; } }
  function bedTap(i) {
    clearBedChip();
    const s = BED.slots[i];
    const b = state.bed[i];
    if (!b) {
      bedChip = document.createElement('div');
      bedChip.className = 'hs-chip';
      CROPS.forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'hs-btn';
        btn.textContent = c.name + ' · ' + c.seed + ' 🪙';
        btn.disabled = coinBalance() < c.seed;
        btn.addEventListener('click', () => {
          passStat('coins_spent', c.seed);
          state.bed[i] = { crop: c.id, waters: 0, last: '', planted: dayStr() };
          save(); refreshBed(); refreshHud(); clearBedChip();
          float(s[0], s[1] - 44, '🌱');
          track('homestead_plant', { crop: c.id });
        });
        bedChip.appendChild(btn);
      });
      bedChip.style.left = pct(s[0], W);
      bedChip.style.top = pct(s[1] - 52, H);
      bedChip.style.zIndex = '3000';
      world.appendChild(bedChip);
      return;
    }
    if (cropStage(b) >= 4) {
      const c = CROPS.find((x) => x.id === b.crop) || CROPS[0];
      passStat('coins_earned', c.pay);
      state.bed[i] = null;
      save(); refreshBed(); refreshHud();
      float(s[0], s[1] - 46, '+' + c.pay + ' 🪙');
      track('homestead_harvest', { crop: c.id });
      return;
    }
    if (b.last === dayStr()) { float(s[0], s[1] - 44, '💤 tomorrow'); return; }
    b.last = dayStr();
    b.waters = (b.waters | 0) + 1;
    save(); refreshBed();
    float(s[0], s[1] - 44, '💧');
    track('homestead_water', { crop: b.crop });
  }

  // ---- taps ---------------------------------------------------------------
  view.addEventListener('click', (e) => {
    if (e.target.closest('.wh') || e.target.closest('.hs-actions') || e.target.closest('.hs-chip')) return;
    if (panelOpen()) return;
    const r = view.getBoundingClientRect();
    const wx = (e.clientX - r.left + camX) / scale;
    const wy = (e.clientY - r.top + camY) / scale;
    hint(false);
    clearChip(); clearBedChip();
    if (placing) {   // the ghost follows your taps
      const d = DEX[placing.id];
      placing.x = snap(Math.max(PLOT[0] + 12, Math.min(PLOT[2] - 12, wx)));
      placing.y = snap(Math.max(PLOT[1] + 26, Math.min(PLOT[3] - 8, wy)));
      updateGhost();
      return;
    }
    // the mailbox: near = open, far = walk to it
    if (Math.hypot(wx - MAILBOX.x, wy - (MAILBOX.y - 20)) < 46) {
      if (Math.hypot(pos.x - MAILBOX.x, pos.y - MAILBOX.y) < 110) { openShop(); return; }
      tgt.x = MAILBOX.x - 40; tgt.y = MAILBOX.y + 16;
      return;
    }
    // a bed slot
    for (let i = 0; i < BED.slots.length; i++) {
      const s = BED.slots[i];
      if (Math.hypot(wx - s[0], wy - (s[1] - 16)) < 32) {
        if (Math.hypot(pos.x - s[0], pos.y - s[1]) < 120) bedTap(i);
        else { tgt.x = s[0]; tgt.y = s[1] + 40; }
        return;
      }
    }
    // a placed item
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      const d = DEX[it.id];
      if (Math.abs(wx - it.x) < Math.max(24, d.w / 2) && wy > it.y - d.h - 8 && wy < it.y + 10) {
        if (Math.hypot(pos.x - it.x, pos.y - it.y) < 150) itemChip(i);
        else { tgt.x = it.x; tgt.y = it.y + 30; }
        return;
      }
    }
    tgt.x = wx; tgt.y = wy;
  });

  // ---- the banana ---------------------------------------------------------
  const frameNow = () => {
    const cyc = BASE_CYCLE_S * 1000;
    return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES;
  };
  let lastF = -1;
  function drawMe() {
    const f = frameNow();
    if (f === lastF) return;
    lastF = f;
    drawComposite(meCtx, 150, f, { ...ME_DRAW, custom: ME_DRAW.c ? catCustom(ME_DRAW.c) : undefined });
  }

  // ---- the loop -----------------------------------------------------------
  const FRAME_MS = 12;
  let last = 0, gateAt = 0, meWX = NaN, meWY = NaN;
  let seen = true;
  new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; },
    { threshold: 0 }).observe(view);
  function step(now) {
    requestAnimationFrame(step);
    if (now - gateAt < FRAME_MS) return;
    gateAt = now;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!seen || document.hidden) return;
    const kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (kx || ky) { tgt.x = pos.x + kx * 30; tgt.y = pos.y + ky * 30; hint(false); }
    const dx = tgt.x - pos.x, dy = tgt.y - pos.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5) {
      const m = Math.min(d, SPEED * dt);
      const nx = pos.x + (dx / d) * m, ny = pos.y + (dy / d) * m;
      if (!blocked(nx, ny)) { pos.x = nx; pos.y = ny; }
      else if (!blocked(nx, pos.y)) pos.x = nx;
      else if (!blocked(pos.x, ny)) pos.y = ny;
      else {
        const p1x = pos.x + (dy / d) * m, p1y = pos.y - (dx / d) * m;
        const p2x = pos.x - (dy / d) * m, p2y = pos.y + (dx / d) * m;
        if (!blocked(p1x, p1y)) { pos.x = p1x; pos.y = p1y; }
        else if (!blocked(p2x, p2y)) { pos.x = p2x; pos.y = p2y; }
        else { tgt.x = pos.x; tgt.y = pos.y; }
      }
      pos.x = Math.max(12, Math.min(W - 12, pos.x));
      pos.y = Math.max(12, Math.min(H - 12, pos.y));
    }
    if (pos.x !== meWX || pos.y !== meWY) {
      meWX = pos.x; meWY = pos.y;
      place(meEl, pos.x, pos.y, ME_ANCHOR);
      depth(meEl, pos.y);
    }
    if (!state.claimedAt && pos.x < ROAD.gateX - 24) offerClaim();
    drawMe();
    doorTick();
    cam();
  }
  assetsReady().then(() => {
    drawMe();
    place(meEl, pos.x, pos.y, ME_ANCHOR);
    depth(meEl, pos.y);
    requestAnimationFrame((t) => { last = t; step(t); });
  });
}

if (view) init();
