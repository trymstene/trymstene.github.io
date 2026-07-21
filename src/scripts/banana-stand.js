// 🍌🏪 THE BANANA STAND — two scenes, old-videogame style.
// Scene 1: the room. YOUR banana (bb-last outfit, dancing on the same
// wall-clock beat as everywhere else) walks in at the bottom; tap the floor
// or hold WASD/arrows to steer it up to the kiosk. Reach the counter → CUT.
// Scene 2: the counter. The keeper fills the window — upper body behind the
// desk — and the options open. "Step back" cuts back to the room.
// The keeper is the dancing banana OFF DUTY: slow 3↔7 sway, coffee, tired
// half-lidded eyes fitted to the MEASURED eye whites of frame 3.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';

const room = document.getElementById('bsRoom');
if (room) init();

function init() {
  // ---- the keeper's outfit (shared by both scenes) ------------------------
  // Face is STOCK for now — the tired-eyelid overlay didn't land (Trym's
  // call 21 Jul); he'll craft a proper shopkeeper banana himself later.
  const KEEPER_OUTFIT = {
    hat: 'none', glasses: 'none', top: '', bottom: '', bg: 'transparent',
    captions: false, effect: 'none',
    extras: { mug: true }, // the coffee is load-bearing
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
  function cutTo(showShop) {
    inShop = showShop;
    cutAt = performance.now();
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
        pos.x += (dx / d) * m; pos.y += (dy / d) * m;
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

  // ---- scene 2: the counter ----------------------------------------------
  const COUNTER_HELLO = "what can i get you? …oh. right. nothing's for sale yet.";
  const LINES = [
    "we're restocking. i've been dancing since 1999 — give me a minute.",
    "that one's not for sale yet.",
    'the grand opening is soon. probably.',
    "the truck hasn't come. the truck never comes on time.",
    "there's always money in the banana stand. just… not today.",
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
  document.getElementById('bsHooks').addEventListener('click', (e) => {
    if (!e.target.closest('.bs-hook')) return;
    say(LINES[lineIdx % LINES.length]); lineIdx++;
  });
  document.getElementById('bsKeeper').addEventListener('click', () => say('*sips coffee*'));
  document.getElementById('bsBack').addEventListener('click', () => cutTo(false));
}
