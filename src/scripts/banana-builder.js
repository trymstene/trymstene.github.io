// Dancing Banana builder — the banana ALWAYS dances (authentic 8-frame arm-wave
// from the original 1999 GIF, via /assets/banana-dance.png spritesheet); stills
// are only chosen at export time (sticker/meme card). One canvas render path
// (drawComposite) drives the live preview, the chat-size emoji preview, the
// frame-picker thumbnails and both exports, so what you see is what you get.
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

// ---- authentic dance frames ----
const SHEET_SRC = '/assets/banana-dance.png';
const FW = 469, FH = 498, NFRAMES = 8;
const BASE_CYCLE_S = 0.8; // 8 frames x 100ms = the original GIF timing
// Per-frame anchors measured from the sprite pixels (Pillow-verified):
// eye centre (glasses), head-top centre + tip Y (hat), and which way the face points.
const FRAMES = [
  { eyeCx: 232, eyeCy: 222, headCx: 256, tipY: 85, face: 'right' },
  { eyeCx: 232, eyeCy: 192, headCx: 256, tipY: 57, face: 'right' },
  { eyeCx: 234, eyeCy: 135, headCx: 242, tipY: 0,  face: 'front' },
  { eyeCx: 232, eyeCy: 156, headCx: 212, tipY: 28, face: 'front' },
  { eyeCx: 236, eyeCy: 222, headCx: 212, tipY: 85, face: 'left'  },
  { eyeCx: 236, eyeCy: 192, headCx: 212, tipY: 57, face: 'left'  },
  { eyeCx: 234, eyeCy: 135, headCx: 226, tipY: 0,  face: 'front' },
  { eyeCx: 237, eyeCy: 156, headCx: 256, tipY: 28, face: 'front' },
];

// ---- accessory art: hand-authored PIXEL SVGs on the banana's own 13px grid ----
// (generated from ASCII pixel maps + Pillow-verified against the real frames,
// so they share the sprite's chunky-pixel look; crispEdges keeps them sharp)
const SVG = {
  shadesFront: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 40" width="150" height="40" shape-rendering="crispEdges"><rect x="0" y="0" width="150" height="10" fill="#111111"/><rect x="10" y="10" width="10" height="10" fill="#111111"/><rect x="20" y="10" width="20" height="10" fill="#ffffff"/><rect x="40" y="10" width="30" height="10" fill="#111111"/><rect x="80" y="10" width="10" height="10" fill="#111111"/><rect x="90" y="10" width="20" height="10" fill="#ffffff"/><rect x="110" y="10" width="30" height="10" fill="#111111"/><rect x="10" y="20" width="60" height="10" fill="#111111"/><rect x="80" y="20" width="60" height="10" fill="#111111"/><rect x="20" y="30" width="40" height="10" fill="#111111"/><rect x="90" y="30" width="40" height="10" fill="#111111"/></svg>',
  shadesSide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 40" width="130" height="40" shape-rendering="crispEdges"><rect x="0" y="0" width="130" height="10" fill="#111111"/><rect x="0" y="10" width="10" height="10" fill="#111111"/><rect x="10" y="10" width="20" height="10" fill="#ffffff"/><rect x="30" y="10" width="50" height="10" fill="#111111"/><rect x="0" y="20" width="80" height="10" fill="#111111"/><rect x="10" y="30" width="60" height="10" fill="#111111"/></svg>',
  tophat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100" height="60" shape-rendering="crispEdges"><rect x="20" y="0" width="60" height="10" fill="#111111"/><rect x="20" y="10" width="10" height="10" fill="#111111"/><rect x="30" y="10" width="10" height="10" fill="#484848"/><rect x="40" y="10" width="40" height="10" fill="#111111"/><rect x="20" y="20" width="10" height="10" fill="#111111"/><rect x="30" y="20" width="10" height="10" fill="#484848"/><rect x="40" y="20" width="40" height="10" fill="#111111"/><rect x="20" y="30" width="10" height="10" fill="#111111"/><rect x="30" y="30" width="40" height="10" fill="#e22020"/><rect x="70" y="30" width="10" height="10" fill="#111111"/><rect x="20" y="40" width="60" height="10" fill="#111111"/><rect x="0" y="50" width="100" height="10" fill="#111111"/></svg>',
  crown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 70" width="110" height="70" shape-rendering="crispEdges"><rect x="0" y="0" width="10" height="10" fill="#f2c200"/><rect x="50" y="0" width="10" height="10" fill="#f2c200"/><rect x="100" y="0" width="10" height="10" fill="#f2c200"/><rect x="0" y="10" width="20" height="10" fill="#f2c200"/><rect x="50" y="10" width="20" height="10" fill="#f2c200"/><rect x="100" y="10" width="10" height="10" fill="#f2c200"/><rect x="0" y="20" width="20" height="10" fill="#f2c200"/><rect x="40" y="20" width="30" height="10" fill="#f2c200"/><rect x="90" y="20" width="20" height="10" fill="#f2c200"/><rect x="0" y="30" width="110" height="10" fill="#f2c200"/><rect x="0" y="40" width="50" height="10" fill="#f2c200"/><rect x="50" y="40" width="10" height="10" fill="#e22020"/><rect x="60" y="40" width="50" height="10" fill="#f2c200"/><rect x="0" y="50" width="110" height="10" fill="#f2c200"/><rect x="0" y="60" width="110" height="10" fill="#c49a00"/></svg>',
  party: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110" width="100" height="110" shape-rendering="crispEdges"><rect x="40" y="0" width="20" height="10" fill="#ffffff"/><rect x="30" y="10" width="40" height="10" fill="#ffffff"/><rect x="30" y="20" width="40" height="10" fill="#ffffff"/><rect x="40" y="30" width="20" height="10" fill="#ff4d6d"/><rect x="30" y="40" width="40" height="10" fill="#ff4d6d"/><rect x="30" y="50" width="10" height="10" fill="#ff4d6d"/><rect x="40" y="50" width="10" height="10" fill="#ffffff"/><rect x="50" y="50" width="20" height="10" fill="#ff4d6d"/><rect x="20" y="60" width="60" height="10" fill="#ff4d6d"/><rect x="20" y="70" width="30" height="10" fill="#ff4d6d"/><rect x="50" y="70" width="10" height="10" fill="#ffffff"/><rect x="60" y="70" width="20" height="10" fill="#ff4d6d"/><rect x="10" y="80" width="80" height="10" fill="#ff4d6d"/><rect x="10" y="90" width="60" height="10" fill="#ff4d6d"/><rect x="70" y="90" width="10" height="10" fill="#ffffff"/><rect x="80" y="90" width="10" height="10" fill="#ff4d6d"/><rect x="0" y="100" width="100" height="10" fill="#ff4d6d"/></svg>',
};

const BGS = ['transparent','#ffe135','#ff4d6d','#6c8cff','#37d67a','#ffffff','#111111','#ff9f1c','#b388ff'];
const GLASSES = [['none','None'],['shades','Deal with it']];
const HATS = [['none','None'],['party','Party'],['crown','Crown'],['tophat','Top hat']];
const MOVES = [['dance','Dance'],['spin','Spin'],['disco','Disco'],['still','Still']];

// The banana sprite's pixel unit is 13 source px; the pixel SVGs use 10 svg-px
// per unit. Sizing accessories in banana-pixels guarantees they match the
// sprite's resolution exactly (no mixed pixel densities).
const PX = 13;
const gridW = (key) => parseInt(key.match(/viewBox="0 0 (\d+)/)[1], 10) / 10;
const gridH = (key) => parseInt(key.match(/viewBox="0 0 \d+ (\d+)/)[1], 10) / 10;
// hat seating: on lean frames, shift toward the face + bite deeper so the hat
// sits ON the head mass instead of balancing on the very peak of the tip
const HAT_OVERLAP_FRONT = 1.6, HAT_OVERLAP_SIDE = 2.4, HAT_SHIFT_SIDE = 1.5; // in banana px
// square-canvas layout: headroom above the frame so hats fit at the tall frames
const FRAME_H_FRAC = 0.66, FRAME_TOP_FRAC = 0.20;

const el = (id) => document.getElementById(id);
if (el('bbStage')) init();

function init() {
  const stage = el('bbStage');
  const canvas = el('bbCanvas');
  const topIn = el('bbTopText'), botIn = el('bbBottomText'), speed = el('bbSpeed');

  const stillDefault = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    bg: 'transparent', top: '', bottom: '', glasses: 'none', hat: 'none',
    move: stillDefault ? 'still' : 'dance', spd: BASE_CYCLE_S, frame: 0, // frame = the sticker still
  };

  // ---- sprite + accessory image loading ----
  const sheet = new Image(); sheet.src = SHEET_SRC;
  const imgCache = {};
  function imgFor(key) { // key = inline SVG markup or an image URL
    if (imgCache[key]) return imgCache[key];
    const img = new Image();
    img.src = key.charAt(0) === '<' ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(key) : key;
    imgCache[key] = img; return img;
  }
  Object.values(SVG).forEach(imgFor); // prewarm
  async function assetsReady() {
    const imgs = [sheet, ...Object.values(imgCache)];
    await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth) ? Promise.resolve() : i.decode().catch(() => {})));
  }

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
  chips('bbMoveChips', MOVES, 'move');

  topIn.addEventListener('input', () => { state.top = topIn.value; onState(); });
  botIn.addEventListener('input', () => { state.bottom = botIn.value; onState(); });
  speed.addEventListener('input', () => { state.spd = parseFloat(speed.value); onState(); });

  el('bbRandom').onclick = () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const quips = [['HELLO YES',"IT'S THE BANANA GUY"],['B','A N A N A'],['IT IS','WEDNESDAY MY DUDES'],['','PEANUT BUTTER JELLY TIME'],['CERTIFIED','BANANA MOMENT'],['',''],['ME WHEN','THE BANANA']];
    const q = pick(quips);
    state.bg = pick(BGS); state.top = q[0]; state.bottom = q[1];
    state.glasses = pick(GLASSES)[0]; state.hat = pick(HATS)[0];
    state.move = pick(['dance','dance','spin','disco']); // dance twice as likely
    state.spd = Math.round((0.5 + Math.random() * 0.8) * 100) / 100;
    topIn.value = state.top; botIn.value = state.bottom; speed.value = state.spd;
    onState();
  };

  let toastT;
  function toast(msg) { const t = el('bbToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
  el('bbShare').onclick = async () => { sync(); try { await navigator.clipboard.writeText(location.href); toast('Share link copied!'); } catch (e) { toast('Copy this URL from the address bar'); } };

  function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

  // ---- URL state ----
  function sync() {
    const p = new URLSearchParams();
    if (state.bg !== 'transparent') p.set('bg', state.bg);
    if (state.top) p.set('t', state.top);
    if (state.bottom) p.set('b', state.bottom);
    if (state.glasses !== 'none') p.set('g', state.glasses);
    if (state.hat !== 'none') p.set('h', state.hat);
    if (state.move !== 'dance') p.set('m', state.move);
    if (state.spd !== BASE_CYCLE_S) p.set('s', state.spd);
    if (state.frame !== 0) p.set('f', state.frame);
    history.replaceState(null, '', p.toString() ? '?' + p.toString() : location.pathname);
  }
  function load() {
    const p = new URLSearchParams(location.search);
    if (p.get('bg')) state.bg = p.get('bg');
    state.top = p.get('t') || ''; state.bottom = p.get('b') || '';
    const g = p.get('g'); state.glasses = GLASSES.some(([v]) => v === g) ? g : (g ? 'shades' : 'none'); // old classic/cool links → shades
    const h = p.get('h'); state.hat = HATS.some(([v]) => v === h) ? h : 'none';
    const m = p.get('m'); if (m && MOVES.some(([v]) => v === m)) state.move = m;
    state.spd = p.get('s') ? parseFloat(p.get('s')) : BASE_CYCLE_S;
    const f = parseInt(p.get('f'), 10); if (f >= 0 && f < NFRAMES) state.frame = f;
    topIn.value = state.top; botIn.value = state.bottom; speed.value = state.spd;
  }

  // ---- the one render path ----
  // Draws frame `idx` composited into a W×W canvas.
  // o: { bg: css color|'transparent', captions: bool, rot: deg, hue: deg }
  function drawComposite(ctx, W, idx, o) {
    ctx.clearRect(0, 0, W, W);
    if (o.bg && o.bg !== 'transparent') { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, W); }
    const fh = W * FRAME_H_FRAC, scale = fh / FH, fw = FW * scale;
    const fx = (W - fw) / 2, fy = W * FRAME_TOP_FRAC;
    const F = FRAMES[idx];

    ctx.save();
    if (o.rot) { const cx = W / 2, cy = fy + fh / 2; ctx.translate(cx, cy); ctx.rotate(o.rot * Math.PI / 180); ctx.translate(-cx, -cy); }
    ctx.imageSmoothingEnabled = false;
    ctx.filter = o.hue ? `hue-rotate(${o.hue}deg)` : 'none';
    try { ctx.drawImage(sheet, idx * FW, 0, FW, FH, fx, fy, fw, fh); } catch (e) {}
    ctx.imageSmoothingEnabled = true;

    // accessories ride the head/eyes, style follows the face direction.
    // Sizes are in banana-pixels (grid units × PX × scale) so the pixel art
    // matches the sprite's resolution exactly; no rotation — axis-aligned
    // pixels are the authentic look (rotating pixel art blurs it).
    const unit = PX * scale;
    if (state.hat !== 'none') {
      const key = SVG[state.hat];
      const hw = gridW(key) * unit, hh = gridH(key) * unit;
      const side = F.face !== 'front';
      const shift = side ? (F.face === 'right' ? -HAT_SHIFT_SIDE : HAT_SHIFT_SIDE) * unit : 0;
      const hBottom = fy + F.tipY * scale + (side ? HAT_OVERLAP_SIDE : HAT_OVERLAP_FRONT) * unit;
      drawAcc(ctx, key, fx + F.headCx * scale + shift - hw / 2, hBottom - hh, hw, hh, false);
    }
    if (state.glasses !== 'none') {
      const key = F.face === 'front' ? SVG.shadesFront : SVG.shadesSide;
      const gw = gridW(key) * unit, gh = gridH(key) * unit;
      const gx = fx + F.eyeCx * scale, gy = fy + F.eyeCy * scale;
      drawAcc(ctx, key, gx - gw / 2, gy - gh / 2, gw, gh, F.face === 'left');
    }
    ctx.filter = 'none';
    ctx.restore();

    if (o.captions) { caption(ctx, W, state.top, true); caption(ctx, W, state.bottom, false); }
  }
  function drawAcc(ctx, key, dx, dy, dw, dh, flip) {
    const img = imgFor(key); if (!(img.complete && img.naturalWidth)) return;
    if (!flip) { ctx.drawImage(img, dx, dy, dw, dh); return; }
    ctx.save();
    ctx.translate(dx + dw / 2, dy + dh / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function caption(ctx, W, text, top) {
    if (!text) return;
    let fs = Math.round(W * 0.095);
    const font = (s) => '900 ' + s + 'px Impact, "Arial Black", "Franklin Gothic Bold", sans-serif';
    ctx.font = font(fs);
    while (ctx.measureText(text.toUpperCase()).width > W * 0.92 && fs > 14) { fs -= 2; ctx.font = font(fs); }
    ctx.textAlign = 'center'; ctx.textBaseline = top ? 'top' : 'bottom';
    ctx.lineWidth = fs * 0.29; ctx.strokeStyle = '#111'; ctx.fillStyle = '#fff'; ctx.lineJoin = 'round';
    const y = top ? W * 0.035 : W * 0.965;
    ctx.strokeText(text.toUpperCase(), W / 2, y); ctx.fillText(text.toUpperCase(), W / 2, y);
  }

  // motion params for a phase in [0,1) of one dance cycle
  const spinRot = (phase) => 360 * phase;
  const discoHue = (phase) => 360 * phase;

  // ---- live preview loop ----
  const pctx = canvas.getContext('2d');
  let lastIdx = -1, dirty = true;
  function tick(now) {
    const delay = Math.max(20, state.spd * 1000 / NFRAMES);
    let idx, rot = 0, hue = 0;
    if (state.move === 'still') { idx = state.frame; }
    else {
      const t = now % (delay * NFRAMES * 2); // 2 cycles so spin can do a full turn
      idx = Math.floor(now / delay) % NFRAMES;
      const phase = t / (delay * NFRAMES * 2);
      if (state.move === 'spin') rot = spinRot(phase);
      if (state.move === 'disco') hue = discoHue((now % (delay * NFRAMES)) / (delay * NFRAMES));
    }
    if (idx !== lastIdx || rot || hue || dirty) {
      const size = Math.min(720, Math.round(stage.clientWidth * (window.devicePixelRatio || 1)));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
      drawComposite(pctx, size, idx, { bg: state.bg, captions: true, rot, hue });
      lastIdx = idx; dirty = false;
      drawChat(idx, rot, hue);
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
      drawComposite(offCtx, W, i, { bg: 'transparent', captions: false });
      datas.push(offCtx.getImageData(0, 0, W, W).data);
    }
    emojiBB = pad(bboxOf(datas, W), W);
  }
  function drawChat(idx, rot, hue) {
    drawComposite(offCtx, 240, idx, { bg: 'transparent', captions: false, rot, hue });
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
  function drawPicker() {
    pickerCvs.forEach((c, i) => drawComposite(c.getContext('2d'), 96, i, { bg: 'transparent', captions: false }));
  }

  // ---- state change: repaint everything derived ----
  let bbT;
  function onState() {
    dirty = true;
    refreshUI(); sync();
    clearTimeout(bbT);
    bbT = setTimeout(() => { recomputeEmojiBB(); drawPicker(); dirty = true; }, 60);
  }
  function refreshUI() {
    if (state.bg === 'transparent') { stage.classList.add('bb-stage--transparent'); stage.style.background = ''; }
    else { stage.classList.remove('bb-stage--transparent'); stage.style.background = state.bg; }
    document.querySelectorAll('.bb-swatch').forEach((s) => s.setAttribute('aria-pressed', s.dataset.bg === state.bg));
    [['bbGlassesChips','glasses'],['bbHatChips','hat'],['bbMoveChips','move']].forEach(([host, key]) => {
      document.querySelectorAll('#' + host + ' .bb-chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.val === state[key]));
    });
    document.querySelectorAll('.bb-frame').forEach((f) => f.setAttribute('aria-pressed', String(parseInt(f.dataset.frame, 10) === state.frame)));
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
      const still = state.move === 'still';
      const N = still ? 1 : (state.move === 'spin' ? NFRAMES * 2 : NFRAMES);
      const frames = [];
      const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
      for (let i = 0; i < N; i++) {
        const idx = still ? state.frame : i % NFRAMES;
        const phase = N > 1 ? i / N : 0;
        drawComposite(ctx, W, idx, {
          bg: 'transparent', captions: false,
          rot: state.move === 'spin' ? spinRot(phase) : 0,
          hue: state.move === 'disco' ? discoHue(phase) : 0,
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
      for (let i = 0; i < N; i++) {
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
      toast('Emoji GIF downloaded! 🍌');
      track('gif_download', { file: 'builder-emoji.gif' });
    } catch (e) { toast('GIF export hiccup — try again'); console.error(e); }
    finally { btn.disabled = false; btn.textContent = label; }
  };

  // ---- meme/sticker PNG export: the PICKED frame, captions + background ----
  el('bbDownloadPng').onclick = async () => {
    await assetsReady();
    const W = 720;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
    drawComposite(ctx, W, state.frame, { bg: state.bg, captions: true });
    let out = cv;
    if (state.bg === 'transparent') {
      const data = ctx.getImageData(0, 0, W, W).data;
      out = crop(cv, pad(bboxOf([data], W), W));
    }
    download(out.toDataURL('image/png'), 'my-dancing-banana.png');
    toast('Image downloaded!');
    track('gif_download', { file: 'builder-meme.png' });
  };

  // expose for the sticker (print-res) flow later
  window.__bananaBuilder = { state, drawComposite, bboxOf, pad, crop, assetsReady, FRAMES };

  // ---- boot ----
  load();
  refreshUI();
  sheet.decode().catch(() => {}).finally(() => {
    recomputeEmojiBB(); drawPicker(); dirty = true;
    requestAnimationFrame(tick);
  });
}
