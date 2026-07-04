// Dancing Banana builder — the banana ALWAYS dances (authentic 8-frame arm-wave
// from the original 1999 GIF, via /assets/banana-dance.png spritesheet); stills
// are only chosen at export time (sticker/meme card). One canvas render path
// (drawComposite) drives the live preview, the chat-size emoji preview, the
// frame-picker thumbnails and both exports, so what you see is what you get.
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { dailyOutfit } from '../lib/banana-daily.js';
import { shelfAdd, renderShelf } from '../lib/banana-shelf.js';
import {
  SHEET_SRC, FW, FH, NFRAMES, BASE_CYCLE_S, FRAMES, SVG, EFFECTS,
  PACKS, HAT_DEFS, SHADE_DEFS, EXTRA_DEFS, HAT_BY_ID, SHADE_BY_ID, HATS, GLASSES,
  PX, HAT_OVERLAP, SH_DY, FRAME_H_FRAC, FRAME_TOP_FRAC,
  sheet, assetsReady, drawComposite as engineDraw,
} from '../lib/banana-engine.js';

const SPD_MIN = 0.35, SPD_MAX = 1.6;


const BGS = ['transparent','#ffe135','#ff4d6d','#6c8cff','#37d67a','#ffffff','#111111','#ff9f1c','#b388ff'];
// tiny monochrome pixel icons (currentColor) for the extras chips + pause button
const ICON_MUSTACHE = '<svg class="pxi" viewBox="0 0 90 30" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="0" y="0" width="40" height="10"/><rect x="50" y="0" width="40" height="10"/><rect x="0" y="10" width="90" height="10"/><rect x="10" y="20" width="20" height="10"/><rect x="60" y="20" width="20" height="10"/></svg>';
const ICON_BOWTIE = '<svg class="pxi" viewBox="0 0 140 110" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="0" width="30" height="10" fill="#262233"/><rect x="100" y="0" width="30" height="10" fill="#262233"/><rect x="0" y="10" width="10" height="10" fill="#262233"/><rect x="10" y="10" width="10" height="10" fill="#55aaff"/><rect x="20" y="10" width="10" height="10" fill="#b8dcff"/><rect x="30" y="10" width="10" height="10" fill="#262233"/><rect x="90" y="10" width="10" height="10" fill="#262233"/><rect x="100" y="10" width="10" height="10" fill="#b8dcff"/><rect x="110" y="10" width="10" height="10" fill="#55aaff"/><rect x="120" y="10" width="10" height="10" fill="#262233"/><rect x="0" y="20" width="10" height="10" fill="#262233"/><rect x="10" y="20" width="30" height="10" fill="#55aaff"/><rect x="40" y="20" width="10" height="10" fill="#262233"/><rect x="80" y="20" width="10" height="10" fill="#262233"/><rect x="90" y="20" width="30" height="10" fill="#55aaff"/><rect x="120" y="20" width="10" height="10" fill="#262233"/><rect x="0" y="30" width="10" height="10" fill="#262233"/><rect x="10" y="30" width="40" height="10" fill="#55aaff"/><rect x="50" y="30" width="10" height="10" fill="#262233"/><rect x="70" y="30" width="10" height="10" fill="#262233"/><rect x="80" y="30" width="40" height="10" fill="#55aaff"/><rect x="120" y="30" width="10" height="10" fill="#262233"/><rect x="0" y="40" width="10" height="10" fill="#262233"/><rect x="10" y="40" width="40" height="10" fill="#55aaff"/><rect x="50" y="40" width="30" height="10" fill="#262233"/><rect x="80" y="40" width="40" height="10" fill="#55aaff"/><rect x="120" y="40" width="10" height="10" fill="#262233"/><rect x="0" y="50" width="10" height="10" fill="#262233"/><rect x="10" y="50" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="50" width="20" height="10" fill="#55aaff"/><rect x="40" y="50" width="10" height="10" fill="#262233"/><rect x="50" y="50" width="30" height="10" fill="#6e4423"/><rect x="80" y="50" width="10" height="10" fill="#262233"/><rect x="90" y="50" width="20" height="10" fill="#55aaff"/><rect x="110" y="50" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="50" width="10" height="10" fill="#262233"/><rect x="0" y="60" width="10" height="10" fill="#262233"/><rect x="10" y="60" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="60" width="30" height="10" fill="#55aaff"/><rect x="50" y="60" width="30" height="10" fill="#262233"/><rect x="80" y="60" width="30" height="10" fill="#55aaff"/><rect x="110" y="60" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="60" width="10" height="10" fill="#262233"/><rect x="0" y="70" width="10" height="10" fill="#262233"/><rect x="10" y="70" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="70" width="30" height="10" fill="#55aaff"/><rect x="50" y="70" width="10" height="10" fill="#262233"/><rect x="70" y="70" width="10" height="10" fill="#262233"/><rect x="80" y="70" width="30" height="10" fill="#55aaff"/><rect x="110" y="70" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="70" width="10" height="10" fill="#262233"/><rect x="0" y="80" width="10" height="10" fill="#262233"/><rect x="10" y="80" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="80" width="20" height="10" fill="#55aaff"/><rect x="40" y="80" width="10" height="10" fill="#262233"/><rect x="80" y="80" width="10" height="10" fill="#262233"/><rect x="90" y="80" width="20" height="10" fill="#55aaff"/><rect x="110" y="80" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="80" width="10" height="10" fill="#262233"/><rect x="0" y="90" width="10" height="10" fill="#262233"/><rect x="10" y="90" width="10" height="10" fill="#2f6fd0"/><rect x="20" y="90" width="10" height="10" fill="#55aaff"/><rect x="30" y="90" width="10" height="10" fill="#262233"/><rect x="90" y="90" width="10" height="10" fill="#262233"/><rect x="100" y="90" width="10" height="10" fill="#55aaff"/><rect x="110" y="90" width="10" height="10" fill="#2f6fd0"/><rect x="120" y="90" width="10" height="10" fill="#262233"/><rect x="0" y="100" width="30" height="10" fill="#262233"/><rect x="100" y="100" width="30" height="10" fill="#262233"/></svg>';
const ICON_PAUSE = '<svg class="pxi" viewBox="0 0 70 80" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="10" y="10" width="20" height="60"/><rect x="40" y="10" width="20" height="60"/></svg>';
const ICON_PLAY = '<svg class="pxi" viewBox="0 0 70 80" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor"><rect x="15" y="10" width="15" height="60"/><rect x="30" y="20" width="15" height="40"/><rect x="45" y="30" width="15" height="20"/></svg>';




const el = (id) => document.getElementById(id);
if (el('bbStage')) init();

function init() {
  const stage = el('bbStage');
  const canvas = el('bbCanvas');
  const topIn = el('bbTopText'), botIn = el('bbBottomText'), speed = el('bbSpeed');

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    bg: 'transparent', top: '', bottom: '', glasses: 'none', hat: 'none',
    extras: {}, effect: 'none', // extras keyed by def id, e.g. { mustache: true }
    spd: BASE_CYCLE_S, frame: 0, // frame = the sticker still
    paused: reducedMotion,
  };

  // ---- sprite + accessory image loading ----

  // the engine draws from explicit outfit args; this page has ONE banana whose
  // outfit lives in `state`, so wrap it once and every old call site works.
  const drawComposite = (ctx, W, idx, o) =>
    engineDraw(ctx, W, idx, { hat: state.hat, glasses: state.glasses, extras: state.extras, top: state.top, bottom: state.bottom, ...o });
  const EXTRA_ICONS = { mustache: ICON_MUSTACHE, bowtie: ICON_BOWTIE };

  // ---- controls ----
  BGS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'bb-swatch'; b.dataset.bg = c; b.setAttribute('aria-label', c);
    if (c === 'transparent') b.classList.add('bb-swatch--none'); else b.style.background = c;
    b.onclick = () => { state.bg = c; onState(); };
    el('bbSwatches').appendChild(b);
  });
  function chips(host, items, key) {
    items.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.className = 'bb-chip'; b.textContent = label; b.dataset.val = val;
      b.onclick = () => { state[key] = val; onState(); };
      el(host).appendChild(b);
    });
  }
  chips('bbGlassesChips', GLASSES, 'glasses');
  chips('bbHatChips', HATS, 'hat');
  chips('bbEffectChips', EFFECTS, 'effect');
  // earned accessories: unlocked at the rave, remembered forever (localStorage)
  const earnedUnlocked = (d) => {
    if (!d.earned) return true;
    try { return localStorage.getItem('rv-glowstick') === '1'; } catch (e) { return false; }
  };
  // extras = independent toggles, not a single-choice row (labels carry pixel icons)
  EXTRA_DEFS.forEach((d) => {
    if (d.raveOnly) return; // session trophies (the happy-hour beer) are earned AT the rave, never dressed on
    if (!earnedUnlocked(d)) {
      // a locked souvenir is a DOOR: the chip links to where you earn it
      const a = document.createElement('a');
      a.className = 'bb-chip bb-chip--locked'; a.href = '/rave/'; a.dataset.place = 'builder-locked';
      a.innerHTML = '🔒 ' + d.label + ' — survive 30 min at the rave';
      a.title = 'Rave souvenir: stay 30 minutes on the dance floor and it’s yours forever';
      el('bbExtrasChips').appendChild(a);
      return;
    }
    const b = document.createElement('button');
    b.className = 'bb-chip'; b.innerHTML = (EXTRA_ICONS[d.id] ? EXTRA_ICONS[d.id] + ' ' : '') + d.label; b.dataset.val = d.id;
    b.onclick = () => { state.extras[d.id] = !state.extras[d.id]; onState(); };
    el('bbExtrasChips').appendChild(b);
  });

  topIn.addEventListener('input', () => { state.top = topIn.value; onState(); });
  botIn.addEventListener('input', () => { state.bottom = botIn.value; onState(); });
  // slider shows "faster to the right": invert into seconds-per-cycle
  speed.addEventListener('input', () => { state.spd = Math.round((SPD_MIN + SPD_MAX - parseFloat(speed.value)) * 100) / 100; onState(); });

  el('bbPause').onclick = () => { state.paused = !state.paused; refreshUI(); };

  el('bbRandom').onclick = () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const quips = [
      ['HELLO YES', "IT'S THE BANANA GUY"],
      ['IT IS', 'WEDNESDAY MY DUDES'],
      ['', 'PEANUT BUTTER JELLY TIME'],
      ['CERTIFIED', 'BANANA MOMENT'],
      ['NO THOUGHTS', 'JUST DANCE'],
      ['MOM SAID', "IT'S MY TURN TO DANCE"],
      ['CEO', 'OF DANCING'],
      ['ERROR 404', 'CHILL NOT FOUND'],
      ['LOCAL BANANA', 'REFUSES TO STOP'],
      ['ME AFTER', 'ONE COFFEE'],
      ['VIBE CHECK', 'PASSED'],
      ['5 AM', 'STILL DANCING'],
      ['THE FLOOR IS LAVA', 'ANYWAY'],
      ['BANANA', 'FOR SCALE'],
      ['UNLIMITED', 'POTASSIUM'],
      ['WHEN THE', 'BEAT DROPS'],
      ['MY LAST', 'BRAINCELL'],
      ['FRIDAY', 'ENERGY'],
      ['EMOTIONAL', 'SUPPORT BANANA'],
      ['GO', 'BANANAS'],
      ['DANCE LIKE NOBODY', 'IS WATCHING'],
      ['100%', 'RIPE'],
      ['POV:', 'YOU FOUND THE BANANA'],
      ['B', 'A N A N A'],
      ['ME WHEN', 'THE BANANA'],
      ['THIS IS', 'FINE'],
      ['ONE MORE DANCE', 'I PROMISE'],
      ['ABSOLUTE', 'UNIT'],
      ['PEEL', 'GOOD VIBES'],
      ['MAXIMUM', 'WIGGLE'],
      ['', ''],
    ];
    const q = pick(quips);
    state.bg = pick(BGS); state.top = q[0]; state.bottom = q[1];
    state.glasses = pick(GLASSES)[0]; state.hat = pick(HATS)[0];
    EXTRA_DEFS.forEach((d) => { state.extras[d.id] = !d.raveOnly && earnedUnlocked(d) && Math.random() < 0.3; });
    state.effect = pick(['none','none','disco','sparkle','confetti']);
    state.spd = Math.round((0.5 + Math.random() * 0.8) * 100) / 100;
    topIn.value = state.top; botIn.value = state.bottom;
    onState();
    track('surprise_me');
  };

  let toastT;
  function toast(msg) { const t = el('bbToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
  // ---- share: links that unfurl as YOUR banana ----
  // The browser renders a 1200x630 OG card (the only place the banana can be
  // rendered faithfully) and posts it to the share worker; the short /s/<id>
  // link serves crawler-readable og tags + bounces humans to the builder.
  // Any failure falls back to copying the plain builder URL.
  const SHARE_BASE = 'https://banana-share.trymstene.workers.dev';
  function renderShareCard() {
    const W = 1200, H = 630;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const cardBg = state.bg === 'transparent' ? '#ffe135' : state.bg;
    ctx.fillStyle = cardBg;
    ctx.fillRect(0, 0, W, H);
    // drawComposite clears its square first, so it must paint its own bg
    drawComposite(ctx, 630, state.frame, {
      bg: cardBg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    // the composite drew into the top-left 630px square; add the pitch right
    const ink = '#111111', paper = '#fffdf5';
    ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    const line = (txt, x, y, size, fill) => {
      ctx.font = '800 ' + size + 'px "Archivo Black", "Arial Black", sans-serif';
      ctx.strokeStyle = fill === ink ? paper : ink;
      ctx.lineWidth = size * 0.18;
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(txt, x, y);
    };
    line('I made a', 660, 240, 52, ink);
    line('dancing banana', 660, 310, 60, ink);
    line('make yours at', 660, 420, 30, ink);
    line('trymstene.com', 660, 466, 36, ink);
    return cv;
  }
  el('bbShare').onclick = async () => {
    sync();
    const plain = location.href;
    let copied = plain, mode = 'plain';
    try {
      await assetsReady();
      const blob = await new Promise((r) => renderShareCard().toBlob(r, 'image/png'));
      const res = await fetch(SHARE_BASE + '/share?p=' + encodeURIComponent(location.search.slice(1)), {
        method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob,
      });
      if (res.ok) { const d = await res.json(); if (d && d.url) { copied = d.url; mode = 'unfurl'; } }
    } catch (e) { /* plain fallback stands */ }
    try {
      await navigator.clipboard.writeText(copied);
      toast(mode === 'unfurl' ? 'Link copied — it unfurls with YOUR banana!' : 'Share link copied!');
    } catch (e) { toast('Copy this URL from the address bar'); }
    track('share_link_copy', { design: designStr(), mode });
    saveToShelf(mode === 'unfurl' ? (copied.split('/s/')[1] || null) : null);
  };
  el('bbOverlayLink').onclick = async () => {
    sync();
    const url = location.origin + '/overlay/' + location.search;
    try { await navigator.clipboard.writeText(url); toast('Overlay link copied — add it in OBS as a Browser Source!'); }
    catch (e) { toast(url); }
    track('overlay_link_copy');
  };

  function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

  // ---- the shelf: creations you kept (downloaded / shared / ordered) ----
  function refreshShelf() {
    renderShelf(el('bbShelf'), {
      onPick: (c) => {
        track('shelf_pick', { design: c.params.slice(0, 60) });
        if (c.kind === 'emoji') { location.href = '/forge/?shelf=' + c.id; return; } // pixel creations belong to the forge
        location.href = location.pathname + '?' + c.params; // full reload = every param (captions, bg, speed, frame) restored the proven way
      },
    });
  }
  function saveToShelf(shareId) {
    sync(); // make sure location.search reflects the current banana
    shelfAdd({ kind: 'banana', params: location.search.slice(1), shareId: shareId || null });
    refreshShelf();
  }
  // compact outfit fingerprint attached to downloads/orders — six months of
  // this tells us which accessories to build packs and pre-made stickers from
  function designStr() {
    const ex = Object.keys(state.extras).filter((k) => state.extras[k]).join('+') || 'none';
    return [state.hat, state.glasses, ex, state.effect, state.bg].join('|');
  }

  // ---- URL state ----
  function sync() {
    const p = new URLSearchParams();
    if (state.bg !== 'transparent') p.set('bg', state.bg);
    if (state.top) p.set('t', state.top);
    if (state.bottom) p.set('b', state.bottom);
    if (state.glasses !== 'none') p.set('g', state.glasses);
    if (state.hat !== 'none') p.set('h', state.hat);
    const exOn = EXTRA_DEFS.filter((d) => state.extras[d.id]).map((d) => d.id);
    if (exOn.length) p.set('ex', exOn.join('.'));
    if (state.effect !== 'none') p.set('e', state.effect);
    if (state.spd !== BASE_CYCLE_S) p.set('s', state.spd);
    if (state.frame !== 0) p.set('f', state.frame);
    history.replaceState(null, '', p.toString() ? '?' + p.toString() : location.pathname);
    // the rave (and future shelf) greet you with your latest banana
    try { localStorage.setItem('bb-last', JSON.stringify({ hat: state.hat, glasses: state.glasses, extras: state.extras, effect: state.effect })); } catch (e) {}
  }
  function load() {
    const p = new URLSearchParams(location.search);
    if (p.get('bg')) state.bg = p.get('bg');
    state.top = p.get('t') || ''; state.bottom = p.get('b') || '';
    const g = p.get('g'); state.glasses = GLASSES.some(([v]) => v === g) ? g : (g ? 'shades' : 'none'); // old classic/cool links → shades
    const h = p.get('h'); state.hat = HAT_BY_ID[h] ? h : 'none';
    state.extras = {};
    (p.get('ex') || '').split('.').forEach((id) => { if (EXTRA_DEFS.some((d) => d.id === id)) state.extras[id] = true; });
    if (p.get('mu') === '1') state.extras.mustache = true; // legacy params
    if (p.get('bt') === '1') state.extras.bowtie = true;
    const e = p.get('e') || p.get('m'); // old m=disco links still work
    if (EFFECTS.some(([v]) => v === e)) state.effect = e;
    state.spd = p.get('s') ? parseFloat(p.get('s')) : BASE_CYCLE_S;
    if (!(state.spd >= SPD_MIN && state.spd <= SPD_MAX)) state.spd = BASE_CYCLE_S;
    const f = parseInt(p.get('f'), 10); if (f >= 0 && f < NFRAMES) state.frame = f;
    topIn.value = state.top; botIn.value = state.bottom;
    speed.value = SPD_MIN + SPD_MAX - state.spd;
  }


  // ---- live preview loop (pausable clock) ----
  const pctx = canvas.getContext('2d');
  let lastIdx = -1, dirty = true, animT = 0, lastNow = 0;
  function tick(now) {
    if (!lastNow) lastNow = now;
    if (!state.paused) animT += now - lastNow;
    lastNow = now;
    const delay = Math.max(20, state.spd * 1000 / NFRAMES);
    const idx = Math.floor(animT / delay) % NFRAMES;
    const cyc = (animT % (delay * NFRAMES)) / (delay * NFRAMES);
    const hue = state.effect === 'disco' ? 360 * cyc : 0;
    if (idx !== lastIdx || hue || dirty) {
      const size = Math.min(720, Math.round(stage.clientWidth * (window.devicePixelRatio || 1)));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
      drawComposite(pctx, size, idx, { bg: state.bg, captions: true, hue, effect: state.effect });
      lastIdx = idx; dirty = false;
      drawChat(idx, hue);
    }
    requestAnimationFrame(tick);
  }

  // ---- chat-size emoji preview (the "this is how it looks in chat" moment) ----
  const chatCvs = [el('bbEmoji32'), el('bbEmoji48')].filter(Boolean);
  const OFF = document.createElement('canvas'); OFF.width = 240; OFF.height = 240;
  const offCtx = OFF.getContext('2d');
  let emojiBB = { x: 0, y: 0, w: 240, h: 240 };
  function recomputeEmojiBB() { // union across all frames = motion-aware crop
    const W = 240, datas = [];
    for (let i = 0; i < NFRAMES; i++) {
      drawComposite(offCtx, W, i, { bg: 'transparent', captions: false, effect: state.effect });
      datas.push(offCtx.getImageData(0, 0, W, W).data);
    }
    emojiBB = pad(bboxOf(datas, W), W);
  }
  function drawChat(idx, hue) {
    drawComposite(offCtx, 240, idx, { bg: 'transparent', captions: false, hue, effect: state.effect });
    for (const c of chatCvs) {
      const cctx = c.getContext('2d');
      cctx.clearRect(0, 0, c.width, c.height);
      cctx.imageSmoothingEnabled = true;
      const s = Math.min(c.width / emojiBB.w, c.height / emojiBB.h);
      const dw = emojiBB.w * s, dh = emojiBB.h * s;
      cctx.drawImage(OFF, emojiBB.x, emojiBB.y, emojiBB.w, emojiBB.h, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    }
  }

  // ---- frame picker (sticker card): freeze your favourite move ----
  const pickerHost = el('bbFrames');
  const pickerCvs = [];
  for (let i = 0; i < NFRAMES; i++) {
    const b = document.createElement('button');
    b.className = 'bb-frame'; b.dataset.frame = i; b.setAttribute('aria-label', 'Dance frame ' + (i + 1));
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    b.appendChild(c); pickerCvs.push(c);
    b.onclick = () => { state.frame = i; onState(); };
    pickerHost.appendChild(b);
  }
  function drawPicker() { // thumbnails show the outfit, not the effects
    pickerCvs.forEach((c, i) => drawComposite(c.getContext('2d'), 96, i, { bg: 'transparent', captions: false }));
  }

  // ---- live mini sticker mockup (buy card): see the physical thing update
  // as you build — same die-cut/square logic as the real print file, small.
  const miniMock = el('bbMiniMock');
  function drawMiniMock() {
    if (!miniMock) return;
    const W = 512;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
    const ctx = cv.getContext('2d');
    drawComposite(ctx, W, state.frame, {
      bg: state.bg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    let design = cv;
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      design = crop(cv, pad(bboxOf([data], W), W));
    }
    const mock = makeStickerMockup(design, 480);
    miniMock.width = mock.width; miniMock.height = mock.height;
    miniMock.getContext('2d').drawImage(mock, 0, 0);
  }

  // ---- state change: repaint everything derived ----
  let bbT;
  let bbStarted = false;
  function onState() {
    if (!bbStarted) { bbStarted = true; track('builder_start'); }
    dirty = true;
    refreshUI(); sync();
    clearTimeout(bbT);
    bbT = setTimeout(() => { recomputeEmojiBB(); drawPicker(); drawMiniMock(); dirty = true; }, 60);
  }
  function refreshUI() {
    if (state.bg === 'transparent') { stage.classList.add('bb-stage--transparent'); stage.style.background = ''; }
    else { stage.classList.remove('bb-stage--transparent'); stage.style.background = state.bg; }
    document.querySelectorAll('.bb-swatch').forEach((s) => s.setAttribute('aria-pressed', s.dataset.bg === state.bg));
    [['bbGlassesChips','glasses'],['bbHatChips','hat'],['bbEffectChips','effect']].forEach(([host, key]) => {
      document.querySelectorAll('#' + host + ' .bb-chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.val === state[key]));
    });
    document.querySelectorAll('#bbExtrasChips .bb-chip').forEach((c) => c.setAttribute('aria-pressed', String(!!state.extras[c.dataset.val])));
    document.querySelectorAll('.bb-frame').forEach((f) => f.setAttribute('aria-pressed', String(parseInt(f.dataset.frame, 10) === state.frame)));
    const pb = el('bbPause');
    pb.innerHTML = state.paused ? ICON_PLAY : ICON_PAUSE;
    pb.setAttribute('aria-label', state.paused ? 'Play the dance' : 'Pause the dance');
  }

  // ---- trim helpers ----
  function bboxOf(framesData, W) {
    let minX = W, minY = W, maxX = 0, maxY = 0, found = false;
    for (const data of framesData) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (!found) return { x: 0, y: 0, w: W, h: W };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
  function pad(bb, W) {
    const p = Math.round(Math.max(bb.w, bb.h) * 0.04);
    const x = Math.max(0, bb.x - p), y = Math.max(0, bb.y - p);
    return { x, y, w: Math.min(W - x, bb.w + p * 2), h: Math.min(W - y, bb.h + p * 2) };
  }
  function crop(cv, bb) {
    const o = document.createElement('canvas'); o.width = bb.w; o.height = bb.h;
    o.getContext('2d').drawImage(cv, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); return o;
  }
  function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  // ---- emoji GIF export: ALWAYS transparent, tight-trimmed, no captions ----
  el('bbDownloadGif').onclick = async () => {
    const btn = el('bbDownloadGif'); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Rendering…';
    try {
      await assetsReady();
      const W = 360;
      const frames = [];
      const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
      for (let i = 0; i < NFRAMES; i++) {
        drawComposite(ctx, W, i, {
          bg: 'transparent', captions: false, effect: state.effect,
          hue: state.effect === 'disco' ? (360 * i / NFRAMES) : 0,
        });
        frames.push(ctx.getImageData(0, 0, W, W));
      }
      const bb = pad(bboxOf(frames.map((f) => f.data), W), W);
      const TARGET = 220;
      const s = TARGET / Math.max(bb.w, bb.h);
      const tw = Math.max(2, Math.round(bb.w * s)), th = Math.max(2, Math.round(bb.h * s));
      const delay = Math.max(20, Math.round((state.spd * 1000) / NFRAMES));

      const gif = GIFEncoder();
      const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th; const tctx = tmp.getContext('2d');
      let palette = null;
      for (let i = 0; i < NFRAMES; i++) {
        const src = document.createElement('canvas'); src.width = W; src.height = W; src.getContext('2d').putImageData(frames[i], 0, 0);
        tctx.clearRect(0, 0, tw, th);
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(src, bb.x, bb.y, bb.w, bb.h, 0, 0, tw, th);
        const data = tctx.getImageData(0, 0, tw, th).data;
        for (let k = 3; k < data.length; k += 4) data[k] = data[k] < 110 ? 0 : 255; // 1-bit alpha
        if (!palette) palette = quantize(data, 128, { format: 'rgba4444', oneBitAlpha: true });
        const index = applyPalette(data, palette, 'rgba4444');
        gif.writeFrame(index, tw, th, { palette, delay, transparent: true, dispose: 2 });
      }
      gif.finish();
      const blob = new Blob([gif.bytes()], { type: 'image/gif' });
      download(URL.createObjectURL(blob), 'my-dancing-banana.gif');
      toast('Emoji GIF downloaded!');
      track('gif_download', { file: 'builder-emoji.gif', design: designStr() });
      saveToShelf();
    } catch (e) { toast('GIF export hiccup — try again'); console.error(e); }
    finally { btn.disabled = false; btn.textContent = label; }
  };

  // ---- meme/sticker PNG export: the PICKED frame, captions + background ----
  el('bbDownloadPng').onclick = async () => {
    await assetsReady();
    const W = 720;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
    drawComposite(ctx, W, state.frame, {
      bg: state.bg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    let out = cv;
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      out = crop(cv, pad(bboxOf([data], W), W));
    }
    download(out.toDataURL('image/png'), 'my-dancing-banana.png');
    toast('Image downloaded!');
    track('png_download', { file: 'builder-meme.png', design: designStr() });
    saveToShelf();
  };

  // ---- order it as a REAL printed sticker (Part B) ----
  // Renders a print-res PNG of the picked frame, uploads it to the fulfilment
  // worker (R2), then opens a Shopify checkout with the design attached as a
  // line-item attribute. After payment, the worker's orders/paid webhook
  // creates a DRAFT Printful order that Trym approves before printing.
  const STICKER = {
    workerBase: 'https://banana-sticker.trymstene.workers.dev',
    variantGid: 'gid://shopify/ProductVariant/48935555006683', // Custom Banana Sticker
    shopDomain: 'officialdancingbanana.myshopify.com',
    storefrontToken: '1032480366b6bf67760ba73ace4fe0f8', // public Storefront token, safe to embed
  };
  // what the visitor will actually pay — updated by the localized-price fetch
  const PRICE = { amount: 149, currency: 'NOK' };

  // ---- localized price: ask the Worker where the visitor is (Cloudflare
  // knows for free), then ask Shopify what THAT country pays via @inContext.
  // Whatever comes back is EXACTLY what checkout will charge — so the badge
  // never lies. Any failure leaves the static "149 kr" fallback in place.
  (async () => {
    try {
      const geo = await fetch(STICKER.workerBase + '/geo').then((r) => r.json());
      const cc = String(geo.country || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc)) return;
      const res = await fetch('https://' + STICKER.shopDomain + '/api/2024-10/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': STICKER.storefrontToken },
        body: JSON.stringify({
          query: 'query($id: ID!, $country: CountryCode!) @inContext(country: $country) { node(id: $id) { ... on ProductVariant { price { amount currencyCode } } } }',
          variables: { id: STICKER.variantGid, country: cc },
        }),
      }).then((r) => r.json());
      const p = res && res.data && res.data.node && res.data.node.price;
      if (!p) return;
      const txt = new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currencyCode, maximumFractionDigits: 0 }).format(parseFloat(p.amount));
      const badge = el('bbPrice'); if (badge) badge.textContent = txt;
      const modal = el('bbModalPrice'); if (modal) modal.textContent = txt + ', free shipping worldwide';
      PRICE.amount = parseFloat(p.amount); PRICE.currency = p.currencyCode; // analytics value matches checkout
    } catch (e) { /* static fallback stands */ }
  })();
  // Quick client-side caption screen. Deliberately blunt (substring match, a
  // few false positives are fine — the toast just asks to reword). The REAL
  // moderation gate is Trym approving every Printful draft before print.
  const BLOCKLIST = ['fuck','shit','bitch','cunt','nigg','fagg','retard','whore','slut','porn','rape','hitler','nazi','faen','jævla','jævel','fitte','kuk','pikk','hore','kneppe'];
  const captionsClean = () => { const t = (state.top + ' ' + state.bottom).toLowerCase(); return !BLOCKLIST.some((w) => t.includes(w)); };

  // Renders the print file (what actually gets printed). Two sticker styles
  // (Trym's call, 3 Jul): TRANSPARENT background → trimmed transparent PNG so
  // Printful DIE-CUTS along the design's outline (banana + captions included;
  // Trym's draft approval catches odd cases like floating confetti). A
  // COLOURED background → the full square canvas (square sticker).
  function renderPrintFile() {
    const W = 2048;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
    drawComposite(ctx, W, state.frame, {
      bg: state.bg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
    });
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      return crop(cv, pad(bboxOf([data], W), W));
    }
    return cv;
  }

  // Sticker MOCKUP matching the style: die-cut white contour border for
  // transparent designs, rounded white square for coloured ones. Soft shadow,
  // paper backdrop — so the buyer sees the physical thing.
  function makeStickerMockup(design, size = 900) {
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#e8e4da'; ctx.fillRect(0, 0, size, size); // paper backdrop
    const margin = size * 0.14;
    const s = Math.min((size - 2 * margin) / design.width, (size - 2 * margin) / design.height);
    const dw = design.width * s, dh = design.height * s;
    const dx = (size - dw) / 2, dy = (size - dh) / 2;
    const border = size * 0.02; // the white kiss-cut edge

    if (state.bg === 'transparent') {
      // white silhouette of the design, dilated in a ring = the die-cut border
      const sil = document.createElement('canvas'); sil.width = size; sil.height = size;
      const sctx = sil.getContext('2d');
      sctx.drawImage(design, dx, dy, dw, dh);
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = '#fff'; sctx.fillRect(0, 0, size, size);
      const outline = document.createElement('canvas'); outline.width = size; outline.height = size;
      const octx = outline.getContext('2d');
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * 2 * Math.PI;
        octx.drawImage(sil, Math.cos(a) * border, Math.sin(a) * border);
      }
      octx.drawImage(sil, 0, 0);
      ctx.save();
      ctx.shadowColor = 'rgba(17,17,17,0.28)'; ctx.shadowBlur = size * 0.03; ctx.shadowOffsetY = size * 0.012;
      ctx.drawImage(outline, 0, 0);
      ctx.restore();
      ctx.drawImage(outline, 0, 0); // crisp second pass over the shadowed one
      ctx.drawImage(design, dx, dy, dw, dh);
    } else {
      const r = size * 0.035;
      ctx.save();
      ctx.shadowColor = 'rgba(17,17,17,0.28)'; ctx.shadowBlur = size * 0.03; ctx.shadowOffsetY = size * 0.012;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.roundRect(dx - border, dy - border, dw + 2 * border, dh + 2 * border, r); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, r * 0.5); ctx.clip();
      ctx.drawImage(design, dx, dy, dw, dh);
      ctx.restore();
    }
    return cv;
  }

  // Step 1: the preview modal — see YOUR sticker before paying (trust!)
  let pendingPrint = null;
  el('bbOrderSticker').onclick = async () => {
    if (!captionsClean()) { toast('Let’s keep it family friendly \u{1F34C} — try other words'); return; }
    await assetsReady();
    pendingPrint = renderPrintFile();
    const mock = makeStickerMockup(pendingPrint);
    const mc = el('bbMockup');
    mc.width = mock.width; mc.height = mock.height;
    mc.getContext('2d').drawImage(mock, 0, 0);
    el('bbModalCut').textContent = state.bg === 'transparent'
      ? '3″×3″ (7.5 cm) vinyl sticker, die-cut along your design’s outline'
      : '3″×3″ (7.5 cm) square vinyl sticker with your design';
    el('bbOrderModal').hidden = false;
    document.body.style.overflow = 'hidden';
    track('sticker_order_click', { design: designStr() });
    saveToShelf();
  };
  function closeOrderModal() { el('bbOrderModal').hidden = true; document.body.style.overflow = ''; }
  el('bbOrderCancel').onclick = closeOrderModal;
  el('bbOrderModal').addEventListener('click', (e) => { if (e.target === el('bbOrderModal')) closeOrderModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el('bbOrderModal').hidden) closeOrderModal(); });

  // Step 2: confirmed — upload the print file + open the Shopify checkout
  el('bbOrderConfirm').onclick = async () => {
    const btn = el('bbOrderConfirm'); const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = 'Preparing your sticker…';
    // fired up front so the begin-checkout signal isn't lost to the redirect
    track('sticker_preview_confirm', { value: PRICE.amount, currency: PRICE.currency, design: designStr() });
    try {
      const blob = await new Promise((r) => pendingPrint.toBlob(r, 'image/png'));
      const up = await fetch(STICKER.workerBase + '/upload', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: blob });
      if (!up.ok) throw new Error('upload failed: ' + up.status);
      track('sticker_upload_ok');
      const { key, url } = await up.json();

      const mutation = 'mutation($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { checkoutUrl } userErrors { message } } }';
      const res = await fetch('https://' + STICKER.shopDomain + '/api/2024-10/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': STICKER.storefrontToken },
        body: JSON.stringify({
          query: mutation,
          variables: { lines: [{ merchandiseId: STICKER.variantGid, quantity: 1, attributes: [
            { key: '_design_key', value: key },   // machine-readable, hidden in checkout
            { key: 'Design', value: url },        // visible link so the customer sees THEIR banana
          ] }] },
        }),
      });
      const data = await res.json();
      const checkout = data && data.data && data.data.cartCreate && data.data.cartCreate.cart && data.data.cartCreate.cart.checkoutUrl;
      if (!checkout) throw new Error('cart failed: ' + JSON.stringify(data));
      track('checkout_redirect', { value: PRICE.amount, currency: PRICE.currency });
      window.location.href = checkout;
    } catch (e) {
      console.error(e);
      track('sticker_order_fail', { message: String(e && e.message || e).slice(0, 90) });
      toast('Hmm, that didn’t work — give it another try?');
      btn.disabled = false; btn.innerHTML = label;
    }
  };

  // exposed for debugging + future flows
  window.__bananaBuilder = { state, drawComposite, bboxOf, pad, crop, assetsReady, FRAMES, PACKS, STICKER, makeStickerMockup, renderPrintFile };

  // ---- boot ----
  load();

  // ---- OBS overlay mode (after load() so it can override the defaults) ----
  // ?overlay=1 (usually reached via /overlay/) strips all chrome via CSS on
  // <html> and leaves just the dancing banana on a transparent page — sized
  // for an OBS/streaming browser source. ?daily seeds the outfit from the
  // UTC date: same banana-of-the-day for everyone, changes at midnight.
  const urlP = new URLSearchParams(location.search);
  if (urlP.get('overlay') === '1') {
    document.documentElement.classList.add('bb-overlay');
    state.paused = false; // an overlay must dance, reduced-motion or not
    if (urlP.has('daily')) {
      // shared with /banana-of-the-day/ (built server-side) — same date,
      // same banana, everywhere. Algorithm lives in src/lib/banana-daily.js.
      const o = dailyOutfit();
      state.hat = o.hat; state.glasses = o.glasses;
      state.extras = o.extras; state.effect = o.effect;
    }
  }

  refreshUI();
  refreshShelf();
  sheet.decode().catch(() => {}).finally(() => {
    recomputeEmojiBB(); drawPicker(); drawMiniMock(); dirty = true;
    requestAnimationFrame(tick);
  });
}
