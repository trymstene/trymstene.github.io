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

// ---- accessory art ----
const SVG = {
  classic: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 44" width="120" height="44"><g fill="#111"><rect x="6" y="6" width="44" height="30" rx="9"/><rect x="70" y="6" width="44" height="30" rx="9"/><rect x="50" y="15" width="20" height="7"/></g></svg>',
  // side visor for the lean frames (face at an angle = one wide eye-block): two
  // foreshortened lenses + shine streak so it reads as glasses, not a blob.
  classicSide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60" width="120" height="60"><g fill="#111"><rect x="60" y="6" width="36" height="26" rx="10"/><rect x="8" y="16" width="62" height="38" rx="14"/><rect x="58" y="30" width="14" height="8" rx="3"/><rect x="92" y="14" width="20" height="9" rx="4"/></g><rect x="20" y="24" width="9" height="20" rx="3" fill="#fff" opacity="0.55" transform="rotate(18 24 34)"/></svg>',
  party:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 92" width="80" height="92"><polygon points="40,4 72,82 8,82" fill="#ff4d6d" stroke="#111" stroke-width="4" stroke-linejoin="round"/><circle cx="40" cy="6" r="7" fill="#ffe135" stroke="#111" stroke-width="3"/><circle cx="28" cy="40" r="4" fill="#fff"/><circle cx="50" cy="58" r="4" fill="#fff"/><circle cx="36" cy="66" r="4" fill="#fff"/></svg>',
  crown:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70" width="100" height="70"><path d="M10 62 L10 24 L30 40 L50 14 L70 40 L90 24 L90 62 Z" fill="#ffd400" stroke="#111" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="12" r="5" fill="#ff4d6d" stroke="#111" stroke-width="3"/></svg>',
  tophat:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 86" width="100" height="86"><rect x="28" y="4" width="44" height="56" fill="#111"/><rect x="8" y="58" width="84" height="13" rx="5" fill="#111"/><rect x="28" y="42" width="44" height="10" fill="#ff4d6d"/></svg>'
};
// Trym's real pixel-art "deal with it" shades — frontal frames only (the side
// crop never sat right on the angled head; side frames fall back to the visor).
const COOL_FRONT = { src: '/assets/cool-shades-trim.png?v=1', w: 844, h: 172 };

const BGS = ['transparent','#ffe135','#ff4d6d','#6c8cff','#37d67a','#ffffff','#111111','#ff9f1c','#b388ff'];
const GLASSES = [['none','None'],['classic','Classic'],['cool','Cool']];
const HATS = [['none','None'],['party','Party'],['crown','Crown'],['tophat','Top hat']];
const MOVES = [['dance','Dance'],['spin','Spin'],['disco','Disco'],['still','Still']];

// accessory sizing as fractions of the drawn frame width
const HAT_W = 0.34, GLASS_FRONT_W = 0.45, GLASS_SIDE_W = 0.37;
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
  Object.values(SVG).forEach(imgFor); imgFor(COOL_FRONT.src); // prewarm
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
    state.glasses = p.get('g') || 'none'; state.hat = p.get('h') || 'none';
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

    // accessories ride the head/eyes, style follows the face direction
    if (state.hat !== 'none') {
      const hw = HAT_W * fw, hh = hw * heightRatio(SVG[state.hat]);
      const hx = fx + F.headCx * scale - hw / 2;
      const hBottom = fy + (F.tipY + 18) * scale;
      drawAcc(ctx, SVG[state.hat], hx, hBottom - hh, hw, hh, false, 0);
    }
    if (state.glasses !== 'none') {
      const side = F.face !== 'front';
      let key, gw;
      if (side) { key = SVG.classicSide; gw = GLASS_SIDE_W * fw; }
      else if (state.glasses === 'cool') { key = COOL_FRONT.src; gw = GLASS_FRONT_W * fw; }
      else { key = SVG.classic; gw = GLASS_FRONT_W * fw; }
      const gh = gw * heightRatio(key);
      const gx = fx + F.eyeCx * scale, gy = fy + F.eyeCy * scale;
      drawAcc(ctx, key, gx - gw / 2, gy - gh / 2, gw, gh, F.face === 'left', side ? (F.face === 'left' ? -8 : 8) : 0);
    }
    ctx.filter = 'none';
    ctx.restore();

    if (o.captions) { caption(ctx, W, state.top, true); caption(ctx, W, state.bottom, false); }
  }
  function heightRatio(key) {
    if (key === COOL_FRONT.src) return COOL_FRONT.h / COOL_FRONT.w;
    const m = key.match(/viewBox="0 0 (\d+) (\d+)"/);
    return m ? m[2] / m[1] : 0.4;
  }
  function drawAcc(ctx, key, dx, dy, dw, dh, flip, rotDeg) {
    const img = imgFor(key); if (!(img.complete && img.naturalWidth)) return;
    if (!flip && !rotDeg) { ctx.drawImage(img, dx, dy, dw, dh); return; }
    ctx.save();
    const cx = dx + dw / 2, cy = dy + dh / 2;
    ctx.translate(cx, cy);
    if (flip) ctx.scale(-1, 1);
    if (rotDeg) ctx.rotate(rotDeg * Math.PI / 180);
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
