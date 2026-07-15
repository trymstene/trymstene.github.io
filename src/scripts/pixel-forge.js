// THE PIXEL FORGE — Jasc Animation Shop reborn, the tool the dancing banana
// was born in (1999), rebuilt for the web. Mission: make the next dancing banana.
//
// THE CONSTRAINT IS THE PRODUCT: fixed small grids, four tools, one curated
// palette, frames + onion skin, a live chat preview, GIF out. When someone
// asks for layers, the answer is no.
//
// Creation format (the ecosystem interchange for pixel art): palette INDICES
// in a Uint8Array per frame (0 = transparent), sizes 32/48/64, per-frame
// delays. Serialized as base64 for autosave + the Shelf.
import { GIFEncoder } from 'gifenc';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { shelfAdd, shelfList } from '../lib/banana-shelf.js';
import { passPatch, passStat, passVisit } from '../lib/banana-pass.js';
import { FORGE_PALETTE as PALETTE, FORGE_MAX_FRAMES as MAX_FRAMES, FORGE_CUSTOM_MAX, b64, forgeParse } from '../lib/forge-format.js';

const el = (id) => document.getElementById(id);
const stage = el('fgCanvas');
if (stage) init();

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

const MAX_UNDO = 60;

function init() {
  const state = {
    size: 32,
    frames: [new Uint8Array(32 * 32)],
    delays: [120],
    cur: 0,
    tool: 'pencil',
    color: 3, // banana yellow, obviously
    brush: 1,
    cpal: [], // this creation's custom colours — indices PALETTE.length..
    onion: true,
    undo: [],
    redo: [],
  };
  const pal = () => PALETTE.concat(state.cpal);
  const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const palRGB = () => pal().map((h) => (h ? hexRGB(h) : [0, 0, 0]));

  const ctx = stage.getContext('2d');
  const prevCv = el('fgPreview');
  const prevCtx = prevCv.getContext('2d');
  let cell = 16;

  function frame() { return state.frames[state.cur]; }

  function fitCanvas() {
    cell = Math.max(4, Math.floor(512 / state.size));
    stage.width = stage.height = state.size * cell;
    prevCv.width = prevCv.height = state.size;
  }

  // ---- painting ----
  function paintCell(x, y, idx) {
    const B = state.brush;
    const o = B === 3 ? -1 : 0; // 3px centres on the cursor, 2px extends right/down
    for (let dy = 0; dy < B; dy++) {
      for (let dx = 0; dx < B; dx++) {
        const px = x + dx + o, py = y + dy + o;
        if (px < 0 || py < 0 || px >= state.size || py >= state.size) continue;
        frame()[py * state.size + px] = idx;
      }
    }
  }

  function fill(x, y, idx) {
    const f = frame(), S = state.size;
    const from = f[y * S + x];
    if (from === idx) return;
    const q = [[x, y]];
    while (q.length) {
      const [cx, cy] = q.pop();
      if (cx < 0 || cy < 0 || cx >= S || cy >= S) continue;
      if (f[cy * S + cx] !== from) continue;
      f[cy * S + cx] = idx;
      q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  function pushUndo() {
    stopPlay();
    state.undo.push({ cur: state.cur, data: frame().slice() });
    if (state.undo.length > MAX_UNDO) state.undo.shift();
    state.redo = []; // a fresh action forks history — the redo branch dies
    refreshUndoBtn();
  }
  function undo() {
    const u = state.undo.pop();
    if (!u) return;
    stopPlay();
    const c = Math.min(u.cur, state.frames.length - 1);
    state.redo.push({ cur: c, data: state.frames[c].slice() });
    state.cur = c;
    state.frames[c] = u.data;
    refreshAll();
    save(); // an undone stroke must not resurrect from the autosave after a reload
  }
  function redo() {
    const r = state.redo.pop();
    if (!r) return;
    stopPlay();
    const c = Math.min(r.cur, state.frames.length - 1);
    state.undo.push({ cur: c, data: state.frames[c].slice() });
    if (state.undo.length > MAX_UNDO) state.undo.shift();
    state.cur = c;
    state.frames[c] = r.data;
    refreshAll();
    save();
  }
  function refreshUndoBtn() {
    el('fgUndo').disabled = !state.undo.length;
    el('fgRedo').disabled = !state.redo.length;
  }

  let drawing = false;
  let lastCell = null;
  function cellFromEvent(e) {
    const r = stage.getBoundingClientRect();
    return [
      Math.floor(((e.clientX - r.left) / r.width) * state.size),
      Math.floor(((e.clientY - r.top) / r.height) * state.size),
    ];
  }
  // Bresenham between two cells — fast strokes must leave a continuous line,
  // not a trail of gaps (pointermove only fires so often)
  function lineCells(x0, y0, x1, y1, cb) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      cb(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  stage.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stopPlay();
    const [x, y] = cellFromEvent(e);
    if (state.tool === 'picker') {
      const idx = frame()[y * state.size + x];
      if (idx) setColor(idx);
      setTool('pencil');
      return;
    }
    pushUndo();
    drawing = true;
    lastCell = [x, y];
    if (state.tool === 'fill') { fill(x, y, state.color); drawing = false; }
    else paintCell(x, y, state.tool === 'eraser' ? 0 : state.color);
    drawEditor(); save();
    try { stage.setPointerCapture(e.pointerId); } catch (err) {} // quirky webviews must not kill the stroke
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const [x, y] = cellFromEvent(e);
    const idx = state.tool === 'eraser' ? 0 : state.color;
    if (lastCell) lineCells(lastCell[0], lastCell[1], x, y, (cx, cy) => paintCell(cx, cy, idx));
    else paintCell(x, y, idx);
    lastCell = [x, y];
    drawEditor();
  });
  addEventListener('pointerup', () => { lastCell = null; if (drawing) { drawing = false; drawFrames(); save(); } });

  // ---- rendering ----
  function drawGridInto(c2, f, scale, dim) {
    const p = pal();
    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        const idx = f[y * state.size + x];
        if (!idx || !p[idx]) continue;
        c2.globalAlpha = dim || 1;
        c2.fillStyle = p[idx];
        c2.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    c2.globalAlpha = 1;
  }

  function drawEditor() {
    const S = state.size;
    ctx.clearRect(0, 0, stage.width, stage.height);
    // checkerboard = transparency
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#e8e4d8' : '#f4f1e8';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    if (state.onion && state.cur > 0) drawGridInto(ctx, state.frames[state.cur - 1], cell, 0.3);
    drawGridInto(ctx, frame(), cell, 1);
    // grid lines (light, every cell; stronger every 8)
    ctx.strokeStyle = 'rgba(17,17,17,0.08)';
    for (let i = 1; i < S; i++) {
      ctx.lineWidth = i % 8 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(i * cell + 0.5, 0); ctx.lineTo(i * cell + 0.5, stage.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell + 0.5); ctx.lineTo(stage.width, i * cell + 0.5); ctx.stroke();
    }
  }

  // ---- frames strip ----
  function drawFrames() {
    const host = el('fgFrames');
    host.innerHTML = '';
    state.frames.forEach((f, i) => {
      const d = document.createElement('div');
      d.className = 'fg-frame' + (i === state.cur ? ' fg-frame--cur' : '');
      const cv = document.createElement('canvas');
      cv.width = cv.height = state.size;
      drawGridInto(cv.getContext('2d'), f, 1, 1);
      d.appendChild(cv);
      const n = document.createElement('span');
      n.textContent = i + 1;
      d.appendChild(n);
      d.onclick = () => { stopPlay(); state.cur = i; refreshAll(); };
      host.appendChild(d);
    });
    el('fgDelay').value = state.delays[state.cur];
    el('fgFrameInfo').textContent = `frame ${state.cur + 1}/${state.frames.length}`;
    el('fgDup').disabled = el('fgAdd').disabled = state.frames.length >= MAX_FRAMES;
    el('fgDel').disabled = state.frames.length <= 1;
  }

  el('fgAdd').onclick = () => {
    stopPlay();
    state.frames.splice(state.cur + 1, 0, new Uint8Array(state.size * state.size));
    state.delays.splice(state.cur + 1, 0, state.delays[state.cur]);
    state.cur++;
    refreshAll(); save(); track('forge_frame_add');
  };
  el('fgDup').onclick = () => {
    stopPlay();
    state.frames.splice(state.cur + 1, 0, frame().slice());
    state.delays.splice(state.cur + 1, 0, state.delays[state.cur]);
    state.cur++;
    refreshAll(); save(); track('forge_frame_dup');
  };
  el('fgDel').onclick = () => {
    if (state.frames.length <= 1) return;
    stopPlay();
    state.frames.splice(state.cur, 1);
    state.delays.splice(state.cur, 1);
    state.cur = Math.max(0, state.cur - 1);
    state.undo = []; state.redo = []; refreshUndoBtn();
    refreshAll(); save();
  };
  el('fgDelay').addEventListener('change', () => {
    const v = Math.min(1000, Math.max(50, parseInt(el('fgDelay').value, 10) || 120));
    state.delays[state.cur] = v;
    el('fgDelay').value = v;
    save();
  });
  // ---- frame reorder: walk the current frame left/right through the strip ----
  function moveFrame(dir) {
    const to = state.cur + dir;
    if (to < 0 || to >= state.frames.length) return;
    stopPlay();
    [state.frames[state.cur], state.frames[to]] = [state.frames[to], state.frames[state.cur]];
    [state.delays[state.cur], state.delays[to]] = [state.delays[to], state.delays[state.cur]];
    state.undo = []; state.redo = []; // undo entries are frame-index-bound
    state.cur = to;
    refreshAll(); save(); track('forge_frame_move');
  }
  el('fgMoveL').onclick = () => moveFrame(-1);
  el('fgMoveR').onclick = () => moveFrame(1);

  // ---- flip & shift: whole-frame transforms (undo-able like a stroke) ----
  function xform(map) {
    pushUndo();
    const f = frame(), S = state.size, n = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const [nx, ny] = map(x, y, S);
        n[ny * S + nx] = f[y * S + x];
      }
    }
    state.frames[state.cur] = n;
    refreshAll(); save(); track('forge_transform');
  }
  el('fgFlipH').onclick = () => xform((x, y, S) => [S - 1 - x, y]);
  el('fgFlipV').onclick = () => xform((x, y, S) => [x, S - 1 - y]);
  const shift = (dx, dy) => xform((x, y, S) => [(x + dx + S) % S, (y + dy + S) % S]);
  el('fgShL').onclick = () => shift(-1, 0);
  el('fgShR').onclick = () => shift(1, 0);
  el('fgShU').onclick = () => shift(0, -1);
  el('fgShD').onclick = () => shift(0, 1);

  // ---- play/pause the big canvas: watch the animation where you draw ----
  let playing = false, playIdx = 0, playLast = 0;
  function drawPlayFrame() {
    const S = state.size;
    ctx.clearRect(0, 0, stage.width, stage.height);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#e8e4d8' : '#f4f1e8';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    drawGridInto(ctx, state.frames[playIdx % state.frames.length], cell, 1);
  }
  function playTick(now) {
    if (!playing) return;
    if (now - playLast >= state.delays[playIdx % state.frames.length]) {
      playLast = now;
      playIdx = (playIdx + 1) % state.frames.length;
      drawPlayFrame();
    }
    requestAnimationFrame(playTick);
  }
  function stopPlay() {
    if (!playing) return;
    playing = false;
    el('fgPlay').textContent = '▶ Play';
    el('fgPlay').setAttribute('aria-pressed', 'false');
    drawEditor();
  }
  function togglePlay() {
    if (playing) { stopPlay(); return; }
    playing = true;
    playIdx = state.cur; playLast = 0;
    el('fgPlay').textContent = '⏸ Pause';
    el('fgPlay').setAttribute('aria-pressed', 'true');
    drawPlayFrame();
    requestAnimationFrame(playTick);
    track('forge_play');
  }
  el('fgPlay').onclick = togglePlay;

  el('fgOnion').onclick = () => {
    state.onion = !state.onion;
    el('fgOnion').setAttribute('aria-pressed', String(state.onion));
    drawEditor();
  };
  el('fgUndo').onclick = undo;
  el('fgRedo').onclick = redo;
  addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (k === 'b' || k === 'p') setTool('pencil');
    else if (k === 'e') setTool('eraser');
    else if (k === 'f' || k === 'g') setTool('fill');
    else if (k === 'i') setTool('picker');
    else if (k === 'o') el('fgOnion').click();
  });

  // ---- tools + palette ----
  function setTool(t) {
    state.tool = t;
    document.querySelectorAll('.fg-tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  }
  document.querySelectorAll('.fg-tool').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });

  function setBrush(n) {
    state.brush = n;
    document.querySelectorAll('.fg-brush').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.brush === n)));
    track('forge_brush', { px: n });
  }
  document.querySelectorAll('.fg-brush').forEach((b) => { b.onclick = () => setBrush(+b.dataset.brush); });

  // Material-style palette UI over the FIXED indices (UI only — the shared
  // palette itself never changes): 8 hue mains, one shades strip for the
  // active family, plus your custom colours. Every one of the 32 shared
  // colours stays reachable; far fewer are on screen at once.
  const FAMILIES = [
    { shades: [2, 32, 31, 15, 1] },      // neutrals: white → greys → ink
    { shades: [3, 4, 29, 8] },           // banana yellows → gold → orange
    { shades: [27, 7, 14, 6, 20, 21] },  // pinks → reds → wine
    { shades: [17, 16, 18, 19, 5] },     // skins → tans → brown
    { shades: [28, 10, 9, 22, 30] },     // greens: mint → neon → forest → olive
    { shades: [24, 11, 12, 23, 25] },    // cyans → blues → teal → navy
    { shades: [13, 26] },                // purples
  ];
  const MAINS = [1, 2, 3, 6, 18, 9, 11, 26]; // ink, white, banana, red, skin, green, blue, purple
  const famShades = (idx) => {
    const f = FAMILIES.find((x) => x.shades.includes(idx));
    return f ? f.shades : null;
  };
  let activeShades = famShades(3); // banana family greets you

  function mkSwatch(idx, cls) {
    const hex = pal()[idx];
    const s = document.createElement('button');
    s.className = 'fg-swatch' + (cls ? ' ' + cls : '');
    s.dataset.idx = idx;
    s.style.background = hex;
    s.title = idx >= PALETTE.length ? hex + ' (yours — select, then ✎ to tweak)' : hex;
    s.setAttribute('aria-label', 'Colour ' + hex);
    s.setAttribute('aria-pressed', String(idx === state.color));
    s.onclick = () => setColor(idx);
    return s;
  }
  function renderPalette() {
    const mains = el('fgMains'), shades = el('fgShades'), customs = el('fgCustoms');
    mains.innerHTML = ''; shades.innerHTML = ''; customs.innerHTML = '';
    MAINS.forEach((idx) => {
      const s = mkSwatch(idx);
      if (famShades(idx) === activeShades) s.classList.add('fg-main--active');
      mains.appendChild(s);
    });
    (activeShades || []).forEach((idx) => shades.appendChild(mkSwatch(idx)));
    state.cpal.forEach((_, i) => customs.appendChild(mkSwatch(PALETTE.length + i)));
    el('fgPalAdd').hidden = state.cpal.length >= FORGE_CUSTOM_MAX;
  }
  function setColor(idx) {
    state.color = idx;
    if (idx < PALETTE.length) {
      const s = famShades(idx);
      if (s) activeShades = s;
    }
    el('fgPalEdit').hidden = idx < PALETTE.length; // only YOUR colours are editable
    renderPalette();
  }

  // custom colours: + opens the native picker to ADD, ✎ re-opens it to refine
  // the selected custom swatch (live palette swap — pixels using it recolour)
  const colorInput = el('fgColorInput');
  let pickerMode = 'add';
  el('fgPalAdd').onclick = () => {
    pickerMode = 'add';
    colorInput.value = pal()[state.color] || '#ffe135';
    colorInput.click();
  };
  el('fgPalEdit').onclick = () => {
    if (state.color < PALETTE.length) return;
    pickerMode = 'edit';
    colorInput.value = state.cpal[state.color - PALETTE.length];
    colorInput.click();
  };
  colorInput.addEventListener('change', () => {
    const hex = colorInput.value;
    if (pickerMode === 'edit' && state.color >= PALETTE.length) {
      state.cpal[state.color - PALETTE.length] = hex;
      renderPalette(); refreshAll(); save();
      track('forge_custom_color', { mode: 'edit' });
    } else {
      if (state.cpal.length >= FORGE_CUSTOM_MAX) return;
      state.cpal.push(hex);
      renderPalette();
      setColor(PALETTE.length + state.cpal.length - 1);
      save();
      track('forge_custom_color', { mode: 'add' });
    }
  });

  // ---- live chat preview (the killer feature: see it at REAL chat size) ----
  let pIdx = 0, pLast = 0;
  function previewTick(now) {
    if (now - pLast >= state.delays[pIdx % state.frames.length]) {
      pLast = now;
      pIdx = (pIdx + 1) % state.frames.length;
      prevCtx.clearRect(0, 0, state.size, state.size);
      drawGridInto(prevCtx, state.frames[pIdx], 1, 1);
    }
    requestAnimationFrame(previewTick);
  }

  // ---- autosave + shelf ----
  function serialize() {
    const d = {
      v: state.cpal.length ? 2 : 1, // v1 when no customs — stale renderers keep working
      size: state.size,
      frames: state.frames.map((f) => b64.enc(f)),
      delays: state.delays,
    };
    if (state.cpal.length) d.cpal = state.cpal;
    return JSON.stringify(d);
  }
  function deserialize(json) {
    const d = forgeParse(json);
    if (!d) return false;
    state.size = d.size;
    state.frames = d.frames;
    state.delays = d.delays;
    state.cpal = d.cpal;
    state.cur = 0;
    return true;
  }
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem('forge-draft', serialize()); } catch (e) {} }, 400);
  }

  // ---- size switch (destructive → confirm when pixels exist) ----
  document.querySelectorAll('.fg-size').forEach((b) => {
    b.onclick = () => {
      const s = parseInt(b.dataset.size, 10);
      if (s === state.size) return;
      const hasArt = state.frames.some((f) => f.some((v) => v));
      if (hasArt && !confirm('Changing the grid starts a fresh canvas. Your current draft will be replaced — continue?')) return;
      stopPlay();
      state.size = s;
      state.frames = [new Uint8Array(s * s)];
      state.delays = [120];
      state.cur = 0; state.undo = []; state.redo = [];
      document.querySelectorAll('.fg-size').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      fitCanvas(); refreshAll(); save();
      track('forge_size', { size: s });
    };
  });

  // ---- import: pixelate an existing GIF/image onto the grid (remix!) ----
  // gifuct-js decodes GIFs everywhere (incl. iOS Safari — no ImageDecoder bet);
  // static images ride createImageBitmap. Colours map to the nearest palette
  // entry, learning up to the custom-slot budget of dominant colours first.
  function decodeGifFrames(buf) {
    const gif = parseGIF(buf);
    const frames = decompressFrames(gif, true);
    if (!frames.length) return [];
    const W = gif.lsd.width, H = gif.lsd.height;
    const full = document.createElement('canvas');
    full.width = W; full.height = H;
    const fctx = full.getContext('2d');
    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d');
    // evenly sample long GIFs down to our frame cap
    const take = Math.min(MAX_FRAMES, frames.length);
    const wanted = new Set();
    for (let i = 0; i < take; i++) wanted.add(frames.length <= MAX_FRAMES ? i : Math.floor((i * frames.length) / take));
    const out = [];
    let prev = null;
    frames.forEach((fr, i) => {
      if (prev && prev.disposalType === 2) fctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
      tmp.width = fr.dims.width; tmp.height = fr.dims.height;
      tctx.putImageData(new ImageData(new Uint8ClampedArray(fr.patch), fr.dims.width, fr.dims.height), 0, 0);
      fctx.drawImage(tmp, fr.dims.left, fr.dims.top);
      if (wanted.has(i)) out.push({ src: full, w: W, h: H, delay: fr.delay || 120, snapshot: fctx.getImageData(0, 0, W, H) });
      prev = fr;
    });
    return out;
  }
  function rasterToGrid(entry) {
    const S = state.size;
    const cv2 = document.createElement('canvas');
    cv2.width = cv2.height = S;
    const c2 = cv2.getContext('2d', { willReadFrequently: true });
    let src = entry.src;
    if (entry.snapshot) { // GIF path: draw the composited snapshot, not the live canvas
      src = document.createElement('canvas');
      src.width = entry.w; src.height = entry.h;
      src.getContext('2d').putImageData(entry.snapshot, 0, 0);
    }
    const iw = entry.w, ih = entry.h;
    const sc = Math.min(S / iw, S / ih);
    const dw = Math.max(1, Math.round(iw * sc)), dh = Math.max(1, Math.round(ih * sc));
    c2.imageSmoothingEnabled = true;
    c2.drawImage(src, ((S - dw) / 2) | 0, ((S - dh) / 2) | 0, dw, dh);
    return c2.getImageData(0, 0, S, S);
  }
  function nearestIdx(r, g, b, rgb) {
    let best = 1, bd = Infinity;
    for (let i = 1; i < rgb.length; i++) {
      const p = rgb[i];
      const d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function learnColors(images) {
    // dominant-colour histogram (coarse 32-step buckets, averaged) → new
    // custom slots for anything the palette can't already say convincingly
    const buckets = new Map();
    images.forEach((im) => {
      const d = im.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
        let b = buckets.get(key);
        if (!b) { b = { n: 0, r: 0, g: 0, bl: 0 }; buckets.set(key, b); }
        b.n++; b.r += d[i]; b.g += d[i + 1]; b.bl += d[i + 2];
      }
    });
    const cands = [...buckets.values()].sort((a, z) => z.n - a.n);
    for (const c of cands) {
      if (state.cpal.length >= FORGE_CUSTOM_MAX) break;
      const r = Math.round(c.r / c.n), g = Math.round(c.g / c.n), b = Math.round(c.bl / c.n);
      const rgb = palRGB();
      const near = rgb[nearestIdx(r, g, b, rgb)];
      const dist = (r - near[0]) ** 2 + (g - near[1]) ** 2 + (b - near[2]) ** 2;
      if (dist > 3000) { // ~32/channel off — worth its own slot
        state.cpal.push('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''));
      }
    }
  }
  async function importImage(blob, srcName) {
    stopPlay();
    const hasArt = state.frames.some((f) => f.some((v) => v));
    if (hasArt && !confirm('Importing replaces your current canvas. Continue?')) return false;
    let entries = [];
    if (blob.type === 'image/gif') {
      try { entries = decodeGifFrames(await blob.arrayBuffer()); } catch (e) { entries = []; }
    }
    if (!entries.length) {
      try {
        const bmp = await createImageBitmap(blob);
        entries = [{ src: bmp, w: bmp.width, h: bmp.height, delay: 120 }];
      } catch (e) { return false; }
    }
    const images = entries.map(rasterToGrid);
    learnColors(images);
    const rgb = palRGB(), S = state.size;
    state.frames = images.map((im) => {
      const f = new Uint8Array(S * S);
      const d = im.data;
      for (let i = 0, px = 0; i < d.length; i += 4, px++) {
        f[px] = d[i + 3] < 128 ? 0 : nearestIdx(d[i], d[i + 1], d[i + 2], rgb);
      }
      return f;
    });
    state.delays = entries.map((e2) => Math.min(1000, Math.max(50, Math.round(e2.delay))));
    state.cur = 0; state.undo = []; state.redo = [];
    renderPalette(); refreshAll(); save();
    track('forge_import', { src: srcName, frames: state.frames.length });
    if (state.frames.length > 1) togglePlay(); // instant payoff: see it dance in pixels
    return true;
  }
  el('fgImportBtn').onclick = () => el('fgImportFile').click();
  el('fgImportFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importImage(f, 'upload');
    e.target.value = '';
  });
  el('fgBanana').onclick = async () => {
    const btn = el('fgBanana'); const label = btn.textContent;
    btn.disabled = true;
    try {
      const r = await fetch('/assets/dancing-banana-transparent.gif');
      if (!(await importImage(await r.blob(), 'banana'))) btn.textContent = label;
    } catch (e) {
      btn.textContent = 'The banana is shy — try again';
      setTimeout(() => { btn.textContent = label; }, 2500);
    } finally { btn.disabled = false; }
  };

  // ---- export: transparent GIF/PNG at platform-labeled sizes ----
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function exportDone() {
    shelfAdd({ kind: 'emoji', params: 'forge:' + serialize(), data: null });
    el('fgDone').hidden = false;
    passPatch('smith'); passStat('forges');
  }
  function exportGif(target) {
    const scale = Math.max(1, Math.ceil(target / state.size));
    const W = state.size * scale;
    const gif = GIFEncoder();
    state.frames.forEach((f, i) => {
      const idx = new Uint8Array(W * W);
      for (let y = 0; y < W; y++) {
        for (let x = 0; x < W; x++) {
          idx[y * W + x] = f[((y / scale) | 0) * state.size + ((x / scale) | 0)];
        }
      }
      gif.writeFrame(idx, W, W, {
        palette: palRGB(), transparent: true, transparentIndex: 0,
        delay: state.delays[i], disposal: 2, first: i === 0,
      });
    });
    gif.finish();
    download(new Blob([gif.bytes()], { type: 'image/gif' }), `my-pixel-emoji-${W}px-trymstene.com.gif`);
    exportDone();
    track('forge_gif_export', { size: state.size, frames: state.frames.length, px: W });
  }
  function exportPng(target) {
    const scale = Math.max(1, Math.ceil(target / state.size));
    const W = state.size * scale;
    const cv = document.createElement('canvas');
    cv.width = cv.height = W;
    drawGridInto(cv.getContext('2d'), frame(), scale, 1);
    cv.toBlob((blob) => {
      if (!blob) return;
      download(blob, `my-pixel-emoji-${W}px-trymstene.com.png`);
      exportDone();
      track('forge_png_export', { size: state.size, px: W });
    }, 'image/png');
  }
  document.querySelectorAll('.fg-exp').forEach((b) => {
    b.onclick = async () => {
      const label = b.textContent;
      b.disabled = true; b.textContent = 'Forging…';
      try {
        const px = parseInt(b.dataset.px, 10);
        if (b.dataset.fmt === 'png') exportPng(px);
        else exportGif(px);
      } finally {
        setTimeout(() => { b.disabled = false; b.textContent = label; }, 400);
      }
    };
  });

  // ---- save to shelf without exporting (park a draft, keep several going) ----
  el('fgSave').onclick = () => {
    const btn = el('fgSave'); const label = btn.textContent;
    if (!state.frames.some((f) => f.some((v) => v))) {
      btn.textContent = 'Draw something first 🎨';
      setTimeout(() => { btn.textContent = label; }, 2500);
      return;
    }
    shelfAdd({ kind: 'emoji', params: 'forge:' + serialize(), data: null });
    btn.textContent = 'Saved to your shelf 🗄';
    setTimeout(() => { btn.textContent = label; }, 2500);
    track('forge_shelf_save', { size: state.size, frames: state.frames.length });
  };

  // ---- submit to the Wall: first click reveals the optional signature ----
  // (free text is fine here — it rides Trym's human review gate)
  el('fgWallSubmit').onclick = () => {
    const btn = el('fgWallSubmit'); const label = btn.textContent;
    if (!state.frames.some((f) => f.some((v) => v))) { btn.textContent = 'Draw something first 🎨'; setTimeout(() => { btn.textContent = label; }, 2500); return; }
    const row = el('fgSignRow');
    row.hidden = !row.hidden;
    if (!row.hidden) el('fgSignName').focus();
  };
  el('fgSignSend').onclick = async () => {
    const btn = el('fgWallSubmit'); const label = btn.textContent;
    const by = el('fgSignName').value.trim().slice(0, 24);
    el('fgSignRow').hidden = true;
    btn.disabled = true;
    try {
      const res = await fetch('https://banana-share.trymstene.workers.dev/wall/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'emoji', params: 'forge:' + serialize(), by }),
      });
      btn.textContent = res.ok ? 'Submitted! 🖼 The banana guy hangs the best ones' : 'The wall is busy — try again later';
      if (res.ok) passPatch('exhibitor');
    } catch (e) { btn.textContent = 'The wall is busy — try again later'; }
    track('wall_submit', { kind: 'emoji', signed: by ? 1 : 0, size: state.size, frames: state.frames.length });
    setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 4000);
  };

  // ---- the shelf strip on the forge ----
  function refreshAll() {
    drawEditor();
    drawFrames();
    refreshUndoBtn();
  }

  // ---- boot ----
  const pickId = new URLSearchParams(location.search).get('shelf');
  const picked = pickId ? shelfList().find((c) => c.id === pickId && c.kind === 'emoji') : null;
  if (picked) deserialize(picked.params);
  else {
    const draft = (() => { try { return localStorage.getItem('forge-draft'); } catch (e) { return null; } })();
    if (draft) deserialize(draft);
  }
  document.querySelectorAll('.fg-size').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.size === state.size)));
  fitCanvas();
  setTool('pencil');
  renderPalette();
  setColor(state.color);
  document.querySelector('.fg-brush[data-brush="1"]').setAttribute('aria-pressed', 'true');
  el('fgOnion').setAttribute('aria-pressed', String(state.onion));
  refreshAll();
  requestAnimationFrame(previewTick);
  track('forge_open');
  passVisit();
}
