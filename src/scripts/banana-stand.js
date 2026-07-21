// 🍌🏪 THE BANANA STAND — two scenes, old-videogame style.
// Scene 1: the room. YOUR banana (bb-last outfit, dancing on the same
// wall-clock beat as everywhere else) walks in at the bottom; tap the floor
// or hold WASD/arrows to steer it up to the kiosk. Reach the counter → CUT.
// Scene 2: the counter. The keeper fills the window — upper body behind the
// desk — and the options open. "Step back" cuts back to the room.
// The keeper is the dancing banana OFF DUTY: slow 3↔7 sway, coffee, tired
// half-lidded eyes fitted to the MEASURED eye whites of frame 3.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S, SVG } from '../lib/banana-engine.js';
import { WEARABLE_PACKS, DROPS } from '../data/wearables.js';
import { passStat, passGet, passPush } from '../lib/banana-pass.js';
import { wearToCustom } from '../lib/wear-render.js';

const room = document.getElementById('bsRoom');
if (room) init();

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// 🪙 the SAME coin faucet as the club — identical clock, seeds and odds
// (keep in sync with banana-rave.js: seedRand / COIN_* / coinAmountFor).
// The claimed-window key `bc-win` is SHARED with the rave, so a window
// caught in either room is caught everywhere — one faucet, no double-dip.
const COIN_TEST = location.search.includes('cointest');
const COIN_PERIOD = COIN_TEST ? 30 : 240, COIN_WAIT = COIN_TEST ? 24 : 18, COIN_OFFSET = 150;
function seedRand(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function coinAmountFor(w) { // 70% one / 25% three / 5% five — same everywhere
  const r = seedRand(0xc01e * 7 + w);
  return r < 0.70 ? 1 : r < 0.95 ? 3 : 5;
}
function parkCoinSpotFor(w) { // own salt — the park isn't a mirror of the floor
  const x = 12 + seedRand(0x9a4b + w * 2) * 76;
  const y = 28 + seedRand(0x9a4b + w * 2 + 1) * 64;
  return { x, y };
}

// the rave's three-frame smoke puff (copied from banana-rave.js POOF_FRAMES —
// exporting it would drag the whole rave module in here; keep the art in sync)
const POOF_FRAMES = ['<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="1" width="2" height="1" fill="#b8bcd0"/><rect x="3" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="4" y="2" width="2" height="1" fill="#e8eaf2"/><rect x="6" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="3" y="3" width="1" height="1" fill="#8890a8"/><rect x="4" y="3" width="2" height="1" fill="#e8eaf2"/><rect x="6" y="3" width="1" height="1" fill="#8890a8"/><rect x="4" y="4" width="2" height="1" fill="#8890a8"/></svg>', '<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="2" height="1" fill="#b8bcd0"/><rect x="7" y="0" width="1" height="1" fill="#b8bcd0"/><rect x="1" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="2" y="1" width="2" height="1" fill="#e8eaf2"/><rect x="4" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="6" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="7" y="1" width="1" height="1" fill="#8890a8"/><rect x="8" y="1" width="1" height="1" fill="#b8bcd0"/><rect x="0" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="1" y="2" width="1" height="1" fill="#8890a8"/><rect x="2" y="2" width="3" height="1" fill="#e8eaf2"/><rect x="5" y="2" width="1" height="1" fill="#b8bcd0"/><rect x="6" y="2" width="1" height="1" fill="#8890a8"/><rect x="7" y="2" width="1" height="1" fill="#e8eaf2"/><rect x="8" y="2" width="1" height="1" fill="#8890a8"/><rect x="1" y="3" width="1" height="1" fill="#8890a8"/><rect x="2" y="3" width="2" height="1" fill="#e8eaf2"/><rect x="4" y="3" width="1" height="1" fill="#8890a8"/><rect x="5" y="3" width="3" height="1" fill="#e8eaf2"/><rect x="8" y="3" width="1" height="1" fill="#8890a8"/><rect x="2" y="4" width="2" height="1" fill="#8890a8"/><rect x="4" y="4" width="1" height="1" fill="#b8bcd0"/><rect x="5" y="4" width="2" height="1" fill="#e8eaf2"/><rect x="7" y="4" width="1" height="1" fill="#8890a8"/><rect x="4" y="5" width="3" height="1" fill="#8890a8"/></svg>', '<svg viewBox="0 0 12 6" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="1" y="0" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="5" y="0" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="9" y="0" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="0" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="2" y="1" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="4" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="6" y="1" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="3" y="2" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="7" y="2" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="9" y="2" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="0" y="3" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="3" y="3" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="5" y="3" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="2" y="4" width="1" height="1" fill="#8890a8" opacity="0.6"/><rect x="7" y="4" width="1" height="1" fill="#b8bcd0" opacity="0.6"/><rect x="10" y="4" width="1" height="1" fill="#8890a8" opacity="0.6"/></svg>'];

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
    // step-back must land OUTSIDE the counter's re-trigger radius (COUNTER.y
    // 22 + r 9 → anything above y 31 re-cuts you into the shop next frame;
    // park v2's renumbering shrank the old margin and Trym hit the loop)
    if (!showShop) { pos.y = Math.max(pos.y, 35); tgt.x = pos.x; tgt.y = pos.y; }
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
  // positions in % of the PARK v2 room (320×420 art): the crossroad — up is
  // the stand, the bottom edge is the road back to the rave, left/right arms
  // end at the under-construction signs.
  const pos = { x: 50, y: 108 };  // walks IN from the rave road below
  const tgt = { x: 50, y: 66 };   // up to the crossroad
  // ?counter = spawn a step from the desk (the rave's ?stagetest pattern —
  // lets tests and quick checks skip the walk)
  if (location.search.includes('counter')) { pos.x = 50; pos.y = 26; tgt.x = 50; tgt.y = 23; }
  const COUNTER = { x: 50, y: 22 };
  // the pond (park.png ellipse in room %) — bananas famously can't swim;
  // walking AROUND it is fine, so blocked moves slide along the shore
  const POND = { x: 80.6, y: 48.8, rx: 14.5, ry: 7.4 };
  const inPond = (x, y) => ((x - POND.x) / POND.rx) ** 2 + ((y - POND.y) / POND.ry) ** 2 < 1;
  // 🪩 the rave road: walk off the BOTTOM of the map and you're back in the
  // club. Armed only after you've been properly inside the park — the walk-in
  // spawn passes through the zone and must not bounce straight back out.
  let raveRoadArmed = false, leaving = false;
  function exitToRave() {
    if (leaving) return;
    leaving = true;
    track('stand_exit_rave');
    if (REDUCED) { location.href = '/rave/'; return; }
    cut.classList.add('is-on');
    setTimeout(() => { location.href = '/rave/'; }, 170);
  }
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
      pos.x = Math.max(5, Math.min(95, pos.x));
      pos.y = Math.max(24, Math.min(99, pos.y));
      meEl.style.left = pos.x + '%';
      meEl.style.top = pos.y + '%';
      meEl.style.transform = 'translateY(-100%)';
      // reached the counter → the scene cuts (cooldown: never mid-cut)
      if (now - cutAt > 400 && Math.hypot(pos.x - COUNTER.x, pos.y - COUNTER.y) < 9) cutTo(true);
      // the rave road: leaving out the bottom (armed once you're inside)
      if (pos.y < 94) raveRoadArmed = true;
      if (raveRoadArmed && pos.y > 97.5 && Math.abs(pos.x - 50) < 9) exitToRave();
      parkSendMove(now); // tell the park where you walked (throttled)
      coinTick();
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
    setInterval(() => { if (document.hidden) return; drawMe(); peers.forEach((p) => drawPeer(p)); }, 120); // beat-frame redraws only, and never for a hidden tab
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
    if (inShop || document.hidden) return;
    sayRoom(LINES[callIdx % LINES.length]); callIdx++;
  }, 14000);

  // tapping the mini kiosk walks you there
  document.getElementById('bsMini').addEventListener('click', (e) => {
    e.stopPropagation();
    tgt.x = COUNTER.x; tgt.y = COUNTER.y + 4;
    hint(false);
  });

  // ---- 🌐 the park is MULTIPLAYER (S5) ------------------------------------
  // A tiny presence room on worker-rave (/park): join, walk, outfit, leave —
  // every banana here is a real visitor, same doctrine as the floor. Fails
  // silently: no socket, no crowd, the park still works solo.
  const PARK_WS = 'wss://banana-rave.trymstene.workers.dev/park';
  const peers = new Map(); // id → { el, ctx, outfit, lastF }
  const crowdEl = document.getElementById('bsCrowd');
  // a stable per-browser session id: rejoining SUPERSEDES your old socket in
  // the room (quick park→club→park roundtrips left ghost copies of you
  // standing around until the reaper — Trym counted three of himself)
  let parkSid = '';
  try {
    parkSid = localStorage.getItem('park-sid') || '';
    if (!parkSid) { parkSid = crypto.randomUUID().slice(0, 12); localStorage.setItem('park-sid', parkSid); }
  } catch (e) { parkSid = String(Math.random()).slice(2, 14); }
  let parkWs = null, myParkId = null, parkRetries = 0, parkSendAt = 0;
  const lastSent = { x: -1, y: -1 };
  const myParkOutfit = () => ({ hat: ME_DRAW.hat, glasses: ME_DRAW.glasses, extras: ME_DRAW.extras || {} });
  function refreshCrowd() {
    if (crowdEl) crowdEl.textContent = peers.size ? `· ${peers.size + 1} in the park` : '';
  }
  // ---- 🪙 coins drop HERE too (Trym: not just the club) -------------------
  // Same windows, same odds, same wallet; the park just has its own spots.
  const coinEl = document.createElement('div');
  coinEl.className = 'bs-coin';
  coinEl.style.display = 'none';
  room.appendChild(coinEl);
  let coinLive = null;
  let coinWinClaimed = -1;
  try { coinWinClaimed = parseInt(localStorage.getItem('bc-win') || '-1', 10); } catch (e) {}
  function coinFloat(x, y, n) {
    const d = document.createElement('div');
    d.className = 'bs-coinfloat';
    d.textContent = '+' + n;
    d.style.left = x + '%';
    d.style.top = y + '%';
    room.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
  function coinTick() {
    const t = Date.now() / 1000;
    const cPh = (((t - COIN_OFFSET) % COIN_PERIOD) + COIN_PERIOD) % COIN_PERIOD;
    const cWin = Math.floor((t - COIN_OFFSET) / COIN_PERIOD);
    if (cPh < COIN_WAIT && coinWinClaimed !== cWin) {
      const cs = parkCoinSpotFor(cWin);
      if (inPond(cs.x, cs.y)) cs.x -= 34; // coins don't float
      coinEl.className = 'bs-coin bs-coin--' + coinAmountFor(cWin);
      coinEl.style.display = '';
      coinEl.style.left = cs.x + '%';
      coinEl.style.top = cs.y + '%';
      coinLive = { x: cs.x, y: cs.y, win: cWin };
    } else {
      // unclaimed windows leave in the smoke; claimed ones already vanished
      if (coinLive && coinWinClaimed !== coinLive.win && coinEl.style.display !== 'none') poofPark(coinLive.x, coinLive.y + 4);
      coinEl.style.display = 'none';
      coinLive = null;
    }
    // the catch: walk into it — yours, same monotonic wallet as the club
    if (coinLive && Math.hypot(pos.x - coinLive.x, (pos.y - 4) - coinLive.y) < 8) {
      const n = coinAmountFor(coinLive.win);
      coinWinClaimed = coinLive.win;
      try { localStorage.setItem('bc-win', String(coinWinClaimed)); } catch (e) {}
      passStat('coins_earned', n);
      refreshWallets();
      coinFloat(coinLive.x, coinLive.y, n);
      track('rave_coin', { n, at: 'park' });
      coinEl.style.display = 'none';
      coinLive = null;
    }
  }

  // gone in a puff, not a blink — same smoke as the rave floor
  function poofPark(x, y) {
    const d = document.createElement('div');
    d.className = 'bs-poof';
    d.style.left = x + '%';
    d.style.top = (y - 4) + '%'; // peers anchor at their feet; smoke at the body
    d.innerHTML = '<span class="bs-poof__1">' + POOF_FRAMES[0] + '</span>' +
      '<span class="bs-poof__2">' + POOF_FRAMES[1] + '</span>' +
      '<span class="bs-poof__3">' + POOF_FRAMES[2] + '</span>';
    room.appendChild(d);
    setTimeout(() => d.remove(), 750);
  }
  function drawPeer(p, force) {
    const f = frameNow();
    if (!force && f === p.lastF) return;
    p.lastF = f;
    drawComposite(p.ctx, 150, f, { ...p.outfit, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' });
  }
  function addPeer(p) {
    if (!p || p.id === myParkId || peers.has(p.id)) return;
    const el = document.createElement('div');
    el.className = 'bs-peer';
    const cv = document.createElement('canvas');
    cv.width = 150; cv.height = 150;
    el.appendChild(cv);
    if (p.name) { const tag = document.createElement('span'); tag.textContent = p.name; el.appendChild(tag); }
    el.style.left = (p.x ?? 50) + '%';
    el.style.top = (p.y ?? 90) + '%';
    room.appendChild(el);
    const peer = { el, ctx: cv.getContext('2d'), outfit: p.outfit || {}, lastF: -1 };
    peers.set(p.id, peer);
    drawPeer(peer, true);
    refreshCrowd();
  }
  function parkConnect() {
    let ws;
    try { ws = new WebSocket(PARK_WS); } catch (e) { return; }
    parkWs = ws;
    ws.onopen = () => {
      parkRetries = 0;
      ws.send(JSON.stringify({ t: 'hi', sid: parkSid, outfit: myParkOutfit(), x: pos.x, y: pos.y, name: passName }));
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'roster') { myParkId = m.you; (m.all || []).forEach(addPeer); refreshCrowd(); }
      else if (m.t === 'join') addPeer(m.p);
      else if (m.t === 'move') { const p = peers.get(m.id); if (p) { p.el.style.left = m.x + '%'; p.el.style.top = m.y + '%'; } }
      else if (m.t === 'outfit') { const p = peers.get(m.id); if (p) { p.outfit = m.outfit || {}; drawPeer(p, true); } }
      else if (m.t === 'leave') {
        const p = peers.get(m.id);
        if (p) {
          poofPark(parseFloat(p.el.style.left) || 50, parseFloat(p.el.style.top) || 90);
          p.el.remove();
          peers.delete(m.id);
          refreshCrowd();
        }
      }
    };
    ws.onclose = (ev) => {
      if (parkWs !== ws) return;
      parkWs = null;
      peers.forEach((p) => p.el.remove());
      peers.clear();
      refreshCrowd();
      if (ev && ev.reason === 'superseded') return; // a newer you took over — don't fight it
      if (parkRetries++ < 5) setTimeout(parkConnect, 4000 * parkRetries);
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }
  parkConnect();
  // say goodbye on the way out — navigations otherwise leave the socket to
  // linger (the reaper catches it, but only after two silent minutes)
  addEventListener('pagehide', () => {
    parkRetries = 99;
    try { if (parkWs) parkWs.close(1000, 'bye'); } catch (e) {}
  });
  // the hibernation keepalive — the room auto-pongs without waking up
  setInterval(() => { if (parkWs && parkWs.readyState === 1) parkWs.send('{"t":"ping"}'); }, 25000);
  function parkSendMove(now) {
    if (!parkWs || parkWs.readyState !== 1 || now - parkSendAt < 150) return;
    if (Math.abs(pos.x - lastSent.x) < 0.3 && Math.abs(pos.y - lastSent.y) < 0.3) return;
    parkSendAt = now;
    lastSent.x = pos.x; lastSent.y = pos.y;
    parkWs.send(JSON.stringify({ t: 'move', x: pos.x, y: pos.y }));
  }

  // the under-construction signs: unreadable scribble up close, the popup
  // does the talking (stopPropagation — a sign tap is not a walk order)
  const roadPopup = document.getElementById('bsRoadPopup');
  document.querySelectorAll('.bs-roadsign').forEach((sign) => {
    sign.addEventListener('click', (e) => {
      e.stopPropagation();
      if (roadPopup) roadPopup.hidden = false;
      track('stand_sign');
    });
  });
  if (roadPopup) {
    roadPopup.addEventListener('click', (e) => {
      if (e.target === roadPopup || e.target.id === 'bsRoadOk') { roadPopup.hidden = true; e.stopPropagation(); }
    });
  }

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
  const ALL_ITEMS = []; // stand stock + back-catalog entries (added async)
  function updateTileStates() {
    const bal = coinBalance();
    ALL_ITEMS.forEach((item) => {
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
    // price + wallet are already on screen — the button just says the verb
    if (isOwned(item.id)) {
      buyBtn.textContent = '✓ yours';
      buyBtn.classList.add('is-owned');
      buyBtn.classList.remove('is-poor');
    } else {
      buyBtn.textContent = 'get it';
      buyBtn.classList.toggle('is-poor', bal < item.price);
      buyBtn.classList.remove('is-owned');
    }
  }
  function itemArt(item) { return item.artHtml || SVG[item.artKey] || ''; }
  function pick(item, tile) {
    document.querySelectorAll('.bs-tile').forEach((t) => t.classList.remove('is-picked'));
    tile.classList.add('is-picked');
    picked = item;
    track('stand_item_view', { item: item.id });
    document.getElementById('bsSpotArt').innerHTML = itemArt(item);
    document.getElementById('bsSpotName').textContent = item.label;
    document.getElementById('bsSpotDesc').textContent = item.back ? item.desc : (DESC[item.id] || item.phrase);
    document.getElementById('bsSpotPrice').textContent = item.price;
    updateSpot(item);
    spot.hidden = false;
  }
  function addTile(item, container) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'bs-tile';
    tile.innerHTML =
      `<span class="bs-tile__art">${itemArt(item)}</span>` +
      `<b>${item.label}</b>` +
      `<span class="bs-tile__slot">${item.back ? 'drop' : item.slot}</span>` +
      `<span class="bs-price"><img src="/assets/banana-stand/coin.png" width="14" alt=""> ${item.price}</span>` +
      `<span class="bs-tile__lock" aria-hidden="true">${LOCK_SVG}</span>` +
      `<span class="bs-tile__own" aria-hidden="true">YOURS</span>`;
    tile.addEventListener('click', () => pick(item, tile));
    tileById.set(item.id, tile);
    ALL_ITEMS.push(item);
    container.appendChild(tile);
  }
  if (shelf) {
    STOCK.forEach((item) => addTile(item, shelf));
    updateTileStates();
  }

  // ---- 🕰 S3: THE BACK-CATALOG — drop nights you missed, for coins --------
  // Curated drops + approved community items you don't own yet, at a flat
  // price ABOVE most floor gear: catching on the night stays the good deal.
  const BACKCAT_PRICE = 50;
  const backHead = document.getElementById('bsBackHead');
  const backShelf = document.getElementById('bsBackShelf');
  const catOwnedStand = () => { try { return JSON.parse(localStorage.getItem('cat-own-v1') || '{}') || {}; } catch (e) { return {}; } };
  function addBackItems(items) {
    if (!items.length || !backShelf) return;
    backHead.hidden = false;
    backShelf.hidden = false;
    items.forEach((it) => addTile(it, backShelf));
    updateTileStates();
  }
  addBackItems(DROPS
    .filter((d) => !((d.flag && localStorage.getItem(d.flag) === '1') || isOwned(d.id)))
    .map((d) => ({
      id: d.id, label: d.label, slot: d.slot === 'glasses' ? 'face' : d.slot,
      price: BACKCAT_PRICE, back: true, flag: d.flag,
      artHtml: SVG[d.art] || '',
      desc: (d.by ? `from ${d.by}’s booth. ` : '') + 'you missed the drop night. money fixes that.',
    })));
  fetch('https://banana-share.trymstene.workers.dev/catalog/items.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((items) => {
      if (!Array.isArray(items)) return;
      const own = catOwnedStand();
      addBackItems(items
        .filter((it) => !own[it.id] && !isOwned(it.id))
        .map((it) => ({
          id: it.id, label: it.title || 'community item', slot: 'c',
          price: BACKCAT_PRICE, back: true,
          artHtml: (wearToCustom(it.wear) || {}).art || '',
          desc: (it.by ? `made by ${it.by}. ` : '') + 'you missed the drop night. money fixes that.',
        })));
    })
    .catch(() => { /* offline: the curated back-catalog stands */ });

  // ---- the purchase: spend coins, record the deed, wear it out the door ----
  // exclusivity mirrors the builder: one pair of shoes, one body garment
  const FEET_IDS = [], BODY_IDS = [];
  Object.values(WEARABLE_PACKS).forEach((p) => (p.extras || []).forEach((d) => {
    if (d.anchor === 'feet') FEET_IDS.push(d.id);
    if (d.zone === 'body') BODY_IDS.push(d.id);
  }));
  function equip(item) {
    const wear = (o) => {
      if (item.slot === 'c') { o.c = item.id; return o; } // community item: the one custom slot
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
    // …and so does everyone else's view of you
    if (parkWs && parkWs.readyState === 1) parkWs.send(JSON.stringify({ t: 'outfit', outfit: myParkOutfit() }));
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
    if (item.back) {
      // back-catalog buys also write the LEGACY ownership stores, so every
      // flag/cat-own reader (rave gift gate, builder chips) unlocks at once
      if (item.flag) { try { localStorage.setItem(item.flag, '1'); } catch (e) {} }
      if (item.slot === 'c') {
        try {
          const ownM = catOwnedStand();
          ownM[item.id] = Date.now();
          localStorage.setItem('cat-own-v1', JSON.stringify(ownM));
        } catch (e) {}
      }
    }
    equip(item);
    refreshWallets();
    updateTileStates();
    updateSpot(item);
    say(SOLD_LINES[soldIdx++ % SOLD_LINES.length](item.label.toLowerCase()));
    track('stand_buy', { item: item.id, price: item.price, kind: item.back ? 'drop' : 'stand' });
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
