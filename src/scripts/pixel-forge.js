// THE PIXEL FORGE — Jasc Animation Shop reborn, the tool the dancing banana
// was born in (1999), rebuilt for the web. Mission: make the next dancing banana.
//
// THE CONSTRAINT IS THE PRODUCT: fixed small grids, four tools, one curated
// palette, frames + onion skin, a live chat preview, GIF out. When someone
// asks for layers, the answer is no.
//
// Creation format (the ecosystem interchange for pixel art): palette INDICES
// in a Uint8Array per frame (0 = transparent), square 32/48/64 for drawing,
// native W×H (≤112) for imports — the canvas adapts to the GIF, never the
// other way (full-truth doctrine). Serialized as base64 for autosave + Shelf.
import { GIFEncoder } from 'gifenc';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { shelfAdd, shelfList } from '../lib/banana-shelf.js';
import { passPatch, passStat, passVisit } from '../lib/banana-pass.js';
import { FORGE_PALETTE as PALETTE, FORGE_MAX_FRAMES as MAX_FRAMES, FORGE_CUSTOM_MAX, FORGE_SIZES, FORGE_DIM_MAX, b64, forgeParse, forgeGridToSVG } from '../lib/forge-format.js';
import { BANANA_REMIX } from '../data/banana-remix.js';
import { iconSvg } from '../lib/pixel-icons.js';
// ITEMS WORKSHOP mode — the dancing banana wears what you draw, in place (WYSIWYG)
import { drawComposite as engineDraw, assetsReady as engineReady, NFRAMES as ENG_NFRAMES, BASE_CYCLE_S as ENG_CYCLE, wearAnchor, FW as ENG_FW, FH as ENG_FH, FRAME_H_FRAC as ENG_HFRAC, FRAME_TOP_FRAC as ENG_TFRAC, PX as ENG_PX } from '../lib/banana-engine.js';

const el = (id) => document.getElementById(id);
const stage = el('fgCanvas');
if (stage) init();

function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

const MAX_UNDO = 60;

function init() {
  const state = {
    w: 32, h: 32, // squares (32/48/64) for hand-drawing; imports may keep a GIF's native W×H
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
    const m = Math.max(state.w, state.h);
    cell = Math.max(4, Math.floor(512 / m));
    stage.width = state.w * cell;
    stage.height = state.h * cell;
    prevCv.width = state.w;
    prevCv.height = state.h;
    // the chat preview renders contain-fit in its 32px box, like real chat
    prevCv.style.width = Math.max(1, Math.round((32 * state.w) / m)) + 'px';
    prevCv.style.height = Math.max(1, Math.round((32 * state.h) / m)) + 'px';
  }

  // ---- painting ----
  function paintCell(x, y, idx) {
    const B = state.brush;
    const o = -Math.floor((B - 1) / 2); // centre the B×B block on the cursor (any size)
    for (let dy = 0; dy < B; dy++) {
      for (let dx = 0; dx < B; dx++) {
        const px = x + dx + o, py = y + dy + o;
        if (px < 0 || py < 0 || px >= state.w || py >= state.h) continue;
        frame()[py * state.w + px] = idx;
      }
    }
  }

  function fill(x, y, idx) {
    const f = frame(), W = state.w, H = state.h;
    const from = f[y * W + x];
    if (from === idx) return;
    const q = [[x, y]];
    while (q.length) {
      const [cx, cy] = q.pop();
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      if (f[cy * W + cx] !== from) continue;
      f[cy * W + cx] = idx;
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
      Math.floor(((e.clientX - r.left) / r.width) * state.w),
      Math.floor(((e.clientY - r.top) / r.height) * state.h),
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
      const idx = frame()[y * state.w + x];
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
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const idx = f[y * state.w + x];
        if (!idx || !p[idx]) continue;
        c2.globalAlpha = dim || 1;
        c2.fillStyle = p[idx];
        c2.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    c2.globalAlpha = 1;
  }

  function drawEditor() {
    const W = state.w, H = state.h;
    ctx.clearRect(0, 0, stage.width, stage.height);
    // checkerboard = transparency
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#e8e4d8' : '#f4f1e8';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    if (state.onion && state.cur > 0 && mode !== 'items') drawGridInto(ctx, state.frames[state.cur - 1], cell, 0.3);
    if (mode === 'items' && itemsReady) { // the banana IS the canvas here — draw the item on it
      const bl = bananaLayer(); ctx.globalAlpha = 0.5; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(bl, (stage.width - bl.width) / 2, (stage.height - bl.height) / 2); ctx.globalAlpha = 1;
    }
    drawGridInto(ctx, frame(), cell, 1);
    if (mode === 'items') updateItemsStatus();
    // grid lines (light, every cell; stronger every 8)
    ctx.strokeStyle = 'rgba(17,17,17,0.08)';
    for (let i = 1; i < W; i++) {
      ctx.lineWidth = i % 8 === 0 ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(i * cell + 0.5, 0); ctx.lineTo(i * cell + 0.5, stage.height); ctx.stroke();
    }
    for (let i = 1; i < H; i++) {
      ctx.lineWidth = i % 8 === 0 ? 2 : 1;
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
      cv.width = state.w; cv.height = state.h;
      // thumbs contain-fit their box so non-square imports don't stretch
      const tm = Math.max(state.w, state.h);
      cv.style.width = Math.max(1, Math.round((56 * state.w) / tm)) + 'px';
      cv.style.height = Math.max(1, Math.round((56 * state.h) / tm)) + 'px';
      drawGridInto(cv.getContext('2d'), f, 1, 1);
      d.appendChild(cv);
      const n = document.createElement('span');
      n.textContent = i + 1;
      d.appendChild(n);
      d.onclick = () => { stopPlay(); state.cur = i; refreshAll(); };
      host.appendChild(d);
    });
    el('fgDelay').value = state.delays[state.cur];
    el('fgFrameInfo').textContent = `frame ${state.cur + 1}/${state.frames.length} · ${state.w}×${state.h}`;
    el('fgDup').disabled = el('fgAdd').disabled = state.frames.length >= MAX_FRAMES;
    el('fgDel').disabled = state.frames.length <= 1;
  }

  el('fgAdd').onclick = () => {
    stopPlay();
    state.frames.splice(state.cur + 1, 0, new Uint8Array(state.w * state.h));
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
  // ---- the banana-themed confirm (no stock dialogs in this house) ----
  // resolves true (yes), false (no/escape) or 'alt' (the optional third way)
  function fgConfirm({ title, body, yes, no, alt }) {
    return new Promise((resolve) => {
      const m = el('fgModal');
      el('fgModalTitle').textContent = title;
      el('fgModalBody').textContent = body;
      const yBtn = el('fgModalYes'), nBtn = el('fgModalNo'), aBtn = el('fgModalAlt');
      yBtn.textContent = yes || 'Do it';
      nBtn.textContent = no || 'Never mind';
      aBtn.hidden = !alt;
      if (alt) aBtn.textContent = alt;
      m.hidden = false;
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        else if (e.key === 'Enter') { e.preventDefault(); done(true); }
      };
      function done(v) {
        m.hidden = true;
        yBtn.onclick = nBtn.onclick = aBtn.onclick = m.onclick = null;
        removeEventListener('keydown', onKey, true);
        resolve(v);
      }
      yBtn.onclick = () => done(true);
      nBtn.onclick = () => done(false);
      aBtn.onclick = () => done('alt');
      m.onclick = (e) => { if (e.target === m) done(false); }; // tap outside = never mind
      addEventListener('keydown', onKey, true);
      nBtn.focus(); // the safe answer is one keypress away
    });
  }

  // ---- clear frame: hose the pixels off, keep the frame ----
  el('fgClear').onclick = async () => {
    if (!frame().some((v) => v)) return; // already spotless
    const ok = await fgConfirm({
      title: '🧹 Wipe this frame?',
      body: 'Every pixel on this frame gets hosed off. The other frames are safe — and Ctrl+Z can un-wipe it.',
      yes: '🧹 Wipe it', no: 'Keep it',
    });
    if (!ok) return;
    pushUndo();
    frame().fill(0);
    refreshAll(); save(); track('forge_frame_clear');
  };

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
    const f = frame(), W = state.w, H = state.h, n = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [nx, ny] = map(x, y, W, H);
        n[ny * W + nx] = f[y * W + x];
      }
    }
    state.frames[state.cur] = n;
    refreshAll(); save(); track('forge_transform');
  }
  el('fgFlipH').onclick = () => xform((x, y, W) => [W - 1 - x, y]);
  el('fgFlipV').onclick = () => xform((x, y, W, H) => [x, H - 1 - y]);
  const shift = (dx, dy) => xform((x, y, W, H) => [(x + dx + W) % W, (y + dy + H) % H]);
  el('fgShL').onclick = () => shift(-1, 0);
  el('fgShR').onclick = () => shift(1, 0);
  el('fgShU').onclick = () => shift(0, -1);
  el('fgShD').onclick = () => shift(0, 1);

  // ---- play/pause the big canvas: watch the animation where you draw ----
  let playing = false, playIdx = 0, playLast = 0;
  function drawPlayFrame() {
    ctx.clearRect(0, 0, stage.width, stage.height);
    if (mode === 'items') { // dance the BANANA wearing what you drew — the preview IS this canvas
      engineDraw(ctx, stage.width, playIdx % ENG_NFRAMES, { hat: 'none', glasses: 'none', extras: {}, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none', custom: computeWear() || undefined });
      return;
    }
    for (let y = 0; y < state.h; y++) for (let x = 0; x < state.w; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#e8e4d8' : '#f4f1e8';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    drawGridInto(ctx, state.frames[playIdx % state.frames.length], cell, 1);
  }
  function playTick(now) {
    if (!playing) return;
    if (mode === 'items') { // ride the banana's own 8-frame cadence
      const cyc = ENG_CYCLE * 1000, idx = Math.floor((now % cyc) / (cyc / ENG_NFRAMES));
      if (idx !== playIdx) { playIdx = idx; drawPlayFrame(); }
      requestAnimationFrame(playTick); return;
    }
    if (now - playLast >= state.delays[playIdx % state.frames.length]) {
      playLast = now;
      playIdx = (playIdx + 1) % state.frames.length;
      drawPlayFrame();
    }
    requestAnimationFrame(playTick);
  }
  function setPlayLabel(on) {
    const ic = iconSvg(on ? 'pause' : 'play', { size: 18 });
    el('fgPlay').innerHTML = ic + (on ? ' Pause' : ' Play');
    el('fgPlay').setAttribute('aria-pressed', String(on));
    const ip = el('fgItemsPlay'); if (ip) { ip.innerHTML = ic + (on ? ' Pause' : ' Play the dance'); ip.setAttribute('aria-pressed', String(on)); }
  }
  function stopPlay() {
    if (!playing) return;
    playing = false;
    setPlayLabel(false);
    drawEditor();
  }
  function togglePlay() {
    if (playing) { stopPlay(); return; }
    playing = true;
    playIdx = mode === 'items' ? 0 : state.cur; playLast = 0;
    setPlayLabel(true);
    drawPlayFrame();
    requestAnimationFrame(playTick);
    track('forge_play', { mode });
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
    if (!el('fgModal').hidden) return; // the banana confirm owns the keyboard
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
    // only the actual tool buttons toggle pressed — action buttons (undo/redo/
    // flip/nudge/brush/colour) share the .fg-tool class but carry no data-tool
    document.querySelectorAll('.fg-tool[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  }
  document.querySelectorAll('.fg-tool[data-tool]').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });

  function setBrush(n) {
    state.brush = Math.max(1, Math.min(8, n | 0));
    const lbl = el('fgBrushLbl'), val = el('fgBrushVal');
    if (lbl) lbl.textContent = state.brush;
    if (val) val.textContent = state.brush;
    track('forge_brush', { px: state.brush });
  }
  // brush-size + colour POPOVERS (one compact button each, opens on click)
  function closePops() { const bp = el('fgBrushPop'), cp = el('fgColorPop'); if (bp) bp.hidden = true; if (cp) cp.hidden = true; }
  const brushBtn = el('fgBrushBtn'), brushPop = el('fgBrushPop'), brushRange = el('fgBrushRange');
  if (brushBtn && brushPop) {
    brushBtn.onclick = (e) => { e.stopPropagation(); const open = brushPop.hidden; closePops(); brushPop.hidden = !open; };
    if (brushRange) brushRange.oninput = () => setBrush(+brushRange.value);
  }
  const colorBtn = el('fgColorBtn'), colorPop = el('fgColorPop');
  if (colorBtn && colorPop) colorBtn.onclick = (e) => { e.stopPropagation(); const open = colorPop.hidden; closePops(); colorPop.hidden = !open; };
  document.addEventListener('click', (e) => { if (!e.target.closest('.fg-pop, #fgBrushBtn, #fgColorBtn')) closePops(); });

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
    const cb = el('fgColorBtn'); if (cb) cb.style.background = pal()[idx] || 'transparent'; // the one swatch shows the pick
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
      prevCtx.clearRect(0, 0, state.w, state.h);
      drawGridInto(prevCtx, state.frames[pIdx], 1, 1);
    }
    requestAnimationFrame(previewTick);
  }

  // ---- autosave + shelf ----
  function serialize() {
    const sq = state.w === state.h && FORGE_SIZES.includes(state.w);
    const d = sq
      ? { v: state.cpal.length ? 2 : 1, size: state.w } // v1/v2 — stale renderers keep working
      : { v: 3, w: state.w, h: state.h }; // non-square imports carry their true dims
    d.frames = state.frames.map((f) => b64.enc(f));
    d.delays = state.delays;
    if (state.cpal.length) d.cpal = state.cpal;
    return JSON.stringify(d);
  }
  function deserialize(json) {
    const d = forgeParse(json);
    if (!d) return false;
    state.w = d.w;
    state.h = d.h;
    state.frames = d.frames;
    state.delays = d.delays;
    state.cpal = d.cpal;
    state.cur = 0;
    return true;
  }
  let saveT = null;
  function save() {
    if (mode === 'items') return; // the autosaved draft is the EMOJI one — items never overwrites it
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem('forge-draft', serialize()); } catch (e) {} }, 400);
  }

  // ---- size switch (destructive → confirm when pixels exist) ----
  document.querySelectorAll('.fg-size').forEach((b) => {
    b.onclick = async () => {
      const s = parseInt(b.dataset.size, 10);
      if (s === state.w && s === state.h) return;
      const hasArt = state.frames.some((f) => f.some((v) => v));
      let keep = false;
      if (hasArt) {
        const fits = s >= state.w && s >= state.h;
        const res = await fgConfirm(fits ? {
          // more canvas around existing art = the banana-on-a-horse move
          title: '⤢ Bigger canvas?',
          body: `Going ${s}×${s} — keep your art (centred, with room to draw around it) or start clean. Exports and shelf saves are safe either way.`,
          yes: '⤢ Keep my art', alt: '🌱 Start fresh', no: 'Cancel',
        } : {
          title: '🌱 Fresh canvas?',
          body: `A ${s}×${s} grid is smaller than your ${state.w}×${state.h} art, so it starts you clean. Anything you exported or saved to the shelf is safe.`,
          yes: 'Start fresh', no: 'Keep drawing',
        });
        if (!res) return;
        keep = fits && res === true;
      }
      stopPlay();
      if (keep) {
        const ow = state.w, oh = state.h;
        const ox = ((s - ow) / 2) | 0, oy = ((s - oh) / 2) | 0;
        state.frames = state.frames.map((f) => {
          const n = new Uint8Array(s * s);
          for (let y = 0; y < oh; y++) n.set(f.subarray(y * ow, (y + 1) * ow), (oy + y) * s + ox);
          return n;
        });
        applyDims(s, s);
        state.undo = []; state.redo = []; // undo data is dimension-bound
      } else {
        applyDims(s, s);
        state.frames = [new Uint8Array(s * s)];
        state.delays = [120];
        state.cur = 0; state.undo = []; state.redo = [];
      }
      refreshAll(); save();
      track('forge_size', { size: s, keep: keep ? 1 : 0 });
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
    const fctx = full.getContext('2d', { willReadFrequently: true });
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
  function entryImageData(entry) {
    if (entry.snapshot) return entry.snapshot;
    const c = document.createElement('canvas');
    c.width = entry.w; c.height = entry.h;
    const cc = c.getContext('2d', { willReadFrequently: true });
    cc.drawImage(entry.src, 0, 0);
    return cc.getImageData(0, 0, entry.w, entry.h);
  }
  // UPSCALE DETECTION — many "big" GIFs are small pixel art scaled up by a
  // clean factor (a 32px emote exported at 128, the 500px banana render).
  // Find the block pitch per axis (edges concentrate on the lattice), sample
  // block centres, and the TRUE pixels come back — full-truth import.
  function detectLattice(img) {
    const W = img.width, H = img.height, d = img.data;
    const key = new Int32Array(W * H);
    for (let i = 0, p = 0; p < W * H; p++, i += 4) {
      key[p] = d[i + 3] < 128 ? -1 : ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    }
    const colE = new Uint32Array(W), rowE = new Uint32Array(H);
    for (let y = 0; y < H; y++) {
      for (let x = 1; x < W; x++) if (key[y * W + x] !== key[y * W + x - 1]) colE[x]++;
    }
    for (let y = 1; y < H; y++) {
      for (let x = 0; x < W; x++) if (key[y * W + x] !== key[(y - 1) * W + x]) rowE[y]++;
    }
    // candidate pitches per axis: exact-line concentration for clean integer
    // upscales, ±1-tolerant for jittery hand-scaled art (the 500px banana's
    // masters carry ±1px hand jitter). The RECONSTRUCTION check below is the
    // real gate — these only nominate.
    function candidates(edges, N) {
      let total = 0;
      for (let i = 1; i < N; i++) total += edges[i];
      if (!total) return [];
      const out = [];
      for (let p = 3; p <= Math.min(64, N >> 3); p++) {
        let best = null;
        for (let ph = 0; ph < p; ph++) {
          let on = 0, win = 0;
          for (let i = ph === 0 ? p : ph; i < N; i += p) {
            on += edges[i];
            win += edges[i] + (edges[i - 1] || 0) + (edges[i + 1] || 0);
          }
          if (!best || on > best.on) best = { p, ph, on, win };
        }
        const exact = best.on / total;
        const winScore = Math.min(1, best.win / total);
        const quality = winScore / (3 / p); // concentration vs a uniform spread
        if (exact >= 0.85 || (p >= 8 && winScore >= 0.8 && quality >= 3)) {
          out.push({ ...best, rank: exact + winScore });
        }
      }
      return out.sort((a, b) => b.rank - a.rank).slice(0, 3);
    }
    function cells(p, ph, N) {
      const c = [];
      for (let v = ph + (p >> 1); v < N; v += p) c.push(v);
      return c;
    }
    const cellOf = (v, p, ph, n) => Math.min(n - 1, Math.max(0, Math.floor((v - ph) / p)));
    for (const cx of candidates(colE, W)) {
      for (const cy of candidates(rowE, H)) {
        const xs = cells(cx.p, cx.ph, W), ys = cells(cy.p, cy.ph, H);
        if (xs.length < 8 || ys.length < 8 || xs.length > FORGE_DIM_MAX || ys.length > FORGE_DIM_MAX) continue;
        // reconstruction: expand the sampled grid back and demand ≥92% match
        const samp = new Int32Array(xs.length * ys.length);
        for (let j = 0; j < ys.length; j++) {
          for (let i2 = 0; i2 < xs.length; i2++) samp[j * xs.length + i2] = key[ys[j] * W + xs[i2]];
        }
        let ok = 0;
        for (let y = 0; y < H; y++) {
          const j = cellOf(y, cy.p, cy.ph, ys.length);
          for (let x = 0; x < W; x++) {
            if (samp[j * xs.length + cellOf(x, cx.p, cx.ph, xs.length)] === key[y * W + x]) ok++;
          }
        }
        if (ok / (W * H) >= 0.92) return { xs, ys };
      }
    }
    return null;
  }
  function sampleLattice(img, lat) {
    const { xs, ys } = lat;
    const out = new ImageData(xs.length, ys.length);
    const o = out.data, d = img.data, W = img.width;
    let t = 0;
    for (const y of ys) {
      for (const x of xs) {
        const si = (y * W + x) * 4;
        o[t] = d[si]; o[t + 1] = d[si + 1]; o[t + 2] = d[si + 2]; o[t + 3] = d[si + 3];
        t += 4;
      }
    }
    return out;
  }
  // scale a too-big source down to target dims: nearest keeps thin pixel-art
  // details when near-native; a dominant-colour vote keeps outlines clean on
  // photos and unrecognized renders
  function sampleFrame(img, tw, th) {
    const iw = img.width, ih = img.height, d = img.data;
    if (tw === iw && th === ih) return img;
    const out = new ImageData(tw, th);
    const o = out.data;
    if (tw / iw >= 0.5) {
      for (let ty = 0; ty < th; ty++) {
        const sy = Math.min(ih - 1, (((ty + 0.5) * ih) / th) | 0);
        for (let tx = 0; tx < tw; tx++) {
          const sx = Math.min(iw - 1, (((tx + 0.5) * iw) / tw) | 0);
          const si = (sy * iw + sx) * 4;
          const ti = (ty * tw + tx) * 4;
          o[ti] = d[si]; o[ti + 1] = d[si + 1]; o[ti + 2] = d[si + 2]; o[ti + 3] = d[si + 3];
        }
      }
      return out;
    }
    for (let ty = 0; ty < th; ty++) {
      const sy0 = Math.floor((ty * ih) / th), sy1 = Math.max(sy0 + 1, Math.floor(((ty + 1) * ih) / th));
      for (let tx = 0; tx < tw; tx++) {
        const sx0 = Math.floor((tx * iw) / tw), sx1 = Math.max(sx0 + 1, Math.floor(((tx + 1) * iw) / tw));
        const stepY = Math.max(1, ((sy1 - sy0) / 6) | 0), stepX = Math.max(1, ((sx1 - sx0) / 6) | 0);
        const buckets = new Map();
        let clear = 0, total = 0;
        for (let sy = sy0; sy < sy1; sy += stepY) {
          for (let sx = sx0; sx < sx1; sx += stepX) {
            const si = (sy * iw + sx) * 4;
            total++;
            if (d[si + 3] < 128) { clear++; continue; }
            const bkey = ((d[si] >> 4) << 8) | ((d[si + 1] >> 4) << 4) | (d[si + 2] >> 4);
            let b = buckets.get(bkey);
            if (!b) { b = { n: 0, r: 0, g: 0, bl: 0 }; buckets.set(bkey, b); }
            b.n++; b.r += d[si]; b.g += d[si + 1]; b.bl += d[si + 2];
          }
        }
        const ti = (ty * tw + tx) * 4;
        let best = null;
        for (const b of buckets.values()) if (!best || b.n > best.n) best = b;
        if (!best || clear >= total / 2) { o[ti + 3] = 0; continue; }
        o[ti] = Math.round(best.r / best.n);
        o[ti + 1] = Math.round(best.g / best.n);
        o[ti + 2] = Math.round(best.bl / best.n);
        o[ti + 3] = 255;
      }
    }
    return out;
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
  function applyDims(w, h) {
    state.w = w;
    state.h = h;
    document.querySelectorAll('.fg-size').forEach((x) => x.setAttribute('aria-pressed', String(w === h && +x.dataset.size === w)));
    fitCanvas();
  }
  async function importImage(blob, srcName) {
    stopPlay();
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
    let images = entries.map(entryImageData);
    const iw = images[0].width, ih = images[0].height;
    // FULL-TRUTH doctrine (Trym, 15 Jul): the canvas adapts to the GIF, not
    // the GIF to the canvas. Three tiers:
    let mode;
    if (iw <= FORGE_DIM_MAX && ih <= FORGE_DIM_MAX) {
      mode = 'native'; // 1:1 — every pixel kept
    } else {
      const lat = iw * ih <= 1024 * 1024 ? detectLattice(images[0]) : null;
      if (lat) {
        mode = 'lattice'; // upscaled pixel art — recover the true pixels
        images = images.map((im) => sampleLattice(im, lat));
      } else {
        mode = 'resample'; // photos etc: contain-fit to the cap
        const sc = Math.min(FORGE_DIM_MAX / iw, FORGE_DIM_MAX / ih);
        const tw = Math.max(1, Math.round(iw * sc)), th = Math.max(1, Math.round(ih * sc));
        images = images.map((im) => sampleFrame(im, tw, th));
      }
    }
    const W = images[0].width, H = images[0].height;
    const hasArt = state.frames.some((f) => f.some((v) => v));
    if (hasArt && !(await fgConfirm({
      title: '🍌 Import over this?',
      body: mode === 'resample'
        ? `The import gets pixelated onto a ${W}×${H} canvas and replaces what you have here. Colours it can't match join your palette.`
        : `The import lands 1:1 on a ${W}×${H} canvas — every pixel kept — replacing what you have here.`,
      yes: '⬆ Import it', no: 'Cancel',
    }))) return false;
    applyDims(W, H);
    learnColors(images);
    const rgb = palRGB();
    state.frames = images.map((im) => {
      const f = new Uint8Array(W * H);
      const d = im.data;
      for (let i = 0, px = 0; i < d.length; i += 4, px++) {
        f[px] = d[i + 3] < 128 ? 0 : nearestIdx(d[i], d[i + 1], d[i + 2], rgb);
      }
      return f;
    });
    state.delays = entries.map((e2) => Math.min(1000, Math.max(50, Math.round(e2.delay))));
    state.cur = 0; state.undo = []; state.redo = [];
    renderPalette(); refreshAll(); save();
    track('forge_import', { src: srcName, frames: state.frames.length, mode, w: W, h: H });
    if (state.frames.length > 1) togglePlay(); // instant payoff: see it dance in pixels
    return true;
  }
  el('fgImportBtn').onclick = () => el('fgImportFile').click();
  el('fgImportFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importImage(f, 'upload');
    e.target.value = '';
  });
  // the banana never touches the GIF path: it loads its NATIVE pixel data
  // (generated from the 2000px masters by tools/build-banana-remix.py) —
  // pixel-perfect, authentic 1999 colours riding as customs
  function ensureCustom(hex) {
    const i = state.cpal.indexOf(hex);
    if (i >= 0) return PALETTE.length + i;
    if (state.cpal.length >= FORGE_CUSTOM_MAX) {
      return nearestIdx(...hexRGB(hex), palRGB()); // palette full — closest match
    }
    state.cpal.push(hex);
    return PALETTE.length + state.cpal.length - 1;
  }
  el('fgBanana').onclick = async () => {
    stopPlay();
    const hasArt = state.frames.some((f) => f.some((v) => v));
    if (hasArt && !(await fgConfirm({
      title: '🍌 Summon the banana?',
      body: 'The original 1999 dancing banana lands pixel-perfect at its native size — replacing what you have here. Then it\'s yours to remix.',
      yes: '🍌 Summon it', no: 'Cancel',
    }))) return;
    const B = BANANA_REMIX;
    const remap = B.cpal.map((hex) => ensureCustom(hex));
    applyDims(B.w, B.h);
    state.frames = B.frames.map((f64) => {
      const src = b64.dec(f64);
      const f = new Uint8Array(B.w * B.h);
      for (let i = 0; i < src.length; i++) {
        f[i] = src[i] >= PALETTE.length ? remap[src[i] - PALETTE.length] : src[i];
      }
      return f;
    });
    state.delays = B.delays.slice();
    state.cur = 0; state.undo = []; state.redo = [];
    renderPalette(); refreshAll(); save();
    track('forge_import', { src: 'banana', frames: state.frames.length });
    togglePlay(); // instant payoff: the banana dances where you draw
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
    const scale = Math.max(1, Math.ceil(target / Math.max(state.w, state.h)));
    const W = state.w * scale, H = state.h * scale;
    const gif = GIFEncoder();
    state.frames.forEach((f, i) => {
      const idx = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          idx[y * W + x] = f[((y / scale) | 0) * state.w + ((x / scale) | 0)];
        }
      }
      gif.writeFrame(idx, W, H, {
        palette: palRGB(), transparent: true, transparentIndex: 0,
        delay: state.delays[i], disposal: 2, first: i === 0,
      });
    });
    gif.finish();
    const px = Math.max(W, H);
    download(new Blob([gif.bytes()], { type: 'image/gif' }), `my-pixel-emoji-${px}px-trymstene.com.gif`);
    exportDone();
    track('forge_gif_export', { size: Math.max(state.w, state.h), frames: state.frames.length, px });
  }
  function exportPng(target) {
    const scale = Math.max(1, Math.ceil(target / Math.max(state.w, state.h)));
    const cv = document.createElement('canvas');
    cv.width = state.w * scale;
    cv.height = state.h * scale;
    drawGridInto(cv.getContext('2d'), frame(), scale, 1);
    cv.toBlob((blob) => {
      if (!blob) return;
      const px = Math.max(cv.width, cv.height);
      download(blob, `my-pixel-emoji-${px}px-trymstene.com.png`);
      exportDone();
      track('forge_png_export', { size: Math.max(state.w, state.h), px });
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
    track('forge_shelf_save', { size: Math.max(state.w, state.h), frames: state.frames.length });
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
    track('wall_submit', { kind: 'emoji', signed: by ? 1 : 0, size: Math.max(state.w, state.h), frames: state.frames.length });
    setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 4000);
  };

  // ---- the shelf strip on the forge ----
  function refreshAll() {
    drawEditor();
    drawFrames();
    refreshUndoBtn();
  }

  // ---- 🍌 ITEMS WORKSHOP (a MODE, not a second canvas) ----
  // The main canvas shows the banana; you draw the item right where it goes and
  // Play dances it wearing what you drew. Placement is read from WHERE you drew
  // (offset from the nearest body part), so it can never drift from the drawing.
  let mode = 'emoji';                         // 'emoji' | 'items'
  let itemsReady = false; engineReady().then(() => { itemsReady = true; if (mode === 'items') refreshAll(); });
  let underlayCv = null, underlayW = 0;

  function bananaLayer() {                     // reference banana (frame 2), cached at canvas size
    const S = Math.min(stage.width, stage.height);
    if (!underlayCv || underlayW !== S) {
      underlayCv = document.createElement('canvas'); underlayCv.width = underlayCv.height = S; underlayW = S;
      engineDraw(underlayCv.getContext('2d'), S, 2, { hat: 'none', glasses: 'none', extras: {}, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' });
    }
    return underlayCv;
  }
  // your drawing → an engine custom accessory: the offset from the nearest body
  // part + a scale so it renders the exact size you drew.
  function computeWear() {
    const out = forgeGridToSVG(frame(), state.w, state.h, pal());
    if (!out) return null;
    const S = Math.min(stage.width, stage.height);
    const scaleB = (S * ENG_HFRAC) / ENG_FH, fxB = (S - ENG_FW * scaleB) / 2, fyB = S * ENG_TFRAC;
    const cellPx = stage.width / state.w;
    const toSprite = (cx, cy) => ({ x: (cx - fxB) / scaleB, y: (cy - fyB) / scaleB });
    const center = toSprite((out.x + out.w / 2) * cellPx, (out.y + out.h / 2) * cellPx);
    const tl = toSprite(out.x * cellPx, out.y * cellPx);
    const cands = [['head', null], ['face', null], ['chest', null], ['hand', 'left'], ['hand', 'right'], ['feet', null]];
    let best = ['head', null], bestD = Infinity, bestAp = wearAnchor(2, 'head');
    for (const [k, h] of cands) { const ap = wearAnchor(2, k, h); const d = (ap.x - center.x) ** 2 + (ap.y - center.y) ** 2; if (d < bestD) { bestD = d; best = [k, h]; bestAp = ap; } }
    // SPREAD CHECK (Trym's QA 20 Jul: bat-in-each-hand read as "rides the
    // body"): every drawn pixel votes for its nearest anchor ZONE; if a real
    // minority lives in a different zone than the winner, the drawing spans
    // body parts that move independently through the dance — one sprite rides
    // ONE anchor, so the toast should teach, not just say "body". Head+face
    // count as one zone (they bob together, e.g. a helmet with a visor).
    // Non-blocking by design: save still rides the nearest anchor.
    const zoneAps = cands.map(([k, h]) => [(k === 'head' || k === 'face') ? 'head' : k + (h || ''), wearAnchor(2, k, h)]);
    const votes = {};
    let n = 0;
    const g = frame();
    for (let y = 0; y < state.h; y++) for (let x = 0; x < state.w; x++) {
      if (!g[y * state.w + x]) continue;
      const p = toSprite((x + 0.5) * cellPx, (y + 0.5) * cellPx);
      let bz = null, bd = Infinity;
      for (const [z, ap] of zoneAps) { const d = (ap.x - p.x) ** 2 + (ap.y - p.y) ** 2; if (d < bd) { bd = d; bz = z; } }
      votes[bz] = (votes[bz] || 0) + 1; n++;
    }
    const topVotes = Math.max(0, ...Object.values(votes));
    // share-based: a quick two-hand doodle (8 px, 50/50) must trip it, a wide
    // sombrero whose brim-edge strays a few px into a hand zone must not
    const spread = n >= 6 && (n - topVotes) >= Math.max(3, n * 0.25);
    return { art: out.svg, anchor: best[0], hand: best[1] || undefined, spread, ox: (tl.x - bestAp.x) / ENG_PX, oy: (tl.y - bestAp.y) / ENG_PX, scale: ENG_FH / (state.w * ENG_PX * ENG_HFRAC) };
  }
  const RIDE_LABEL = { head: 'head', face: 'face', chest: 'body', feet: 'feet' };
  // the status toast pinned to the top of the canvas. The "draw your item"
  // invite is STICKY (stays until the first stroke); each "rides the …"
  // confirmation flashes up and fades on its own.
  let toastTimer = null, lastRide = '__init__';
  function showToast(text, sticky, icon) {
    const t = el('fgCanvasToast'); if (!t) return;
    t.innerHTML = (icon ? iconSvg(icon, { size: 16 }) + ' ' : '') + text;
    t.classList.add('is-on');
    t.classList.toggle('is-sticky', sticky);
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => { const x = el('fgCanvasToast'); if (x) x.classList.remove('is-on'); }, 1900);
  }
  function hideToast() { const t = el('fgCanvasToast'); if (t) t.classList.remove('is-on'); clearTimeout(toastTimer); }
  function updateItemsStatus() {
    if (mode !== 'items') { hideToast(); lastRide = '__init__'; return; }
    const c = computeWear();
    const key = !c ? '__empty__' : (c.anchor + (c.hand || '') + (c.spread ? '!' : ''));
    if (key === lastRide) return; // placement unchanged — don't re-toast on every redraw
    lastRide = key;
    if (!c) { showToast('draw your item on the banana, where it goes', true, 'edit'); return; }
    if (c.spread) { // spans zones that move independently — teach, don't block
      showToast('an item rides ONE spot — want both hands? make two items 🍌', true, 'warning');
      return;
    }
    const label = c.anchor === 'hand' ? (c.hand === 'left' ? 'left hand' : 'right hand') : (RIDE_LABEL[c.anchor] || c.anchor);
    showToast('rides the ' + label, false, 'check');
  }
  // each mode keeps its OWN drawing — Emoji (frames) and Items (one item) are
  // separate documents, so a banana loaded in Emoji never leaks into Items.
  const modeDocs = { emoji: null, items: null };
  function freshDoc() { state.w = 32; state.h = 32; state.frames = [new Uint8Array(32 * 32)]; state.delays = [120]; state.cur = 0; state.cpal = []; }
  function setMode(m) {
    if (mode === m) return;
    if (playing) stopPlay();
    modeDocs[mode] = serialize();                 // stash the mode we're leaving
    mode = m;
    const doc = modeDocs[m];
    if (doc) deserialize(doc); else freshDoc();    // restore this mode's drawing (or a clean one)
    state.undo = []; state.redo = [];
    if (state.color >= PALETTE.length + state.cpal.length) state.color = 3; // banana yellow fallback
    document.body.classList.toggle('fg-mode-items', m === 'items');
    document.querySelectorAll('.fg-modetab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    fitCanvas();
    document.querySelectorAll('.fg-size').forEach((x) => x.setAttribute('aria-pressed', String(state.w === state.h && +x.dataset.size === state.w)));
    renderPalette(); setColor(state.color);
    refreshAll(); updateItemsStatus();
    track('forge_mode', { mode: m });
  }
  document.querySelectorAll('.fg-modetab').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  const itemsPlay = el('fgItemsPlay'); if (itemsPlay) itemsPlay.onclick = togglePlay;
  const itemsClear = el('fgItemsClear'); if (itemsClear) itemsClear.onclick = () => el('fgClear').click(); // reuse the confirm + wipe
  const itemsSave = el('fgItemsSave');
  if (itemsSave) itemsSave.onclick = () => {
    const label = itemsSave.textContent;
    const c = computeWear();
    if (!c) { itemsSave.textContent = 'Draw an item first 🎨'; setTimeout(() => { itemsSave.textContent = label; }, 2000); return; }
    shelfAdd({ kind: 'wearable', params: 'wear:' + JSON.stringify({ forge: serialize(), anchor: c.anchor, hand: c.hand, ox: c.ox, oy: c.oy, scale: c.scale }), data: null });
    if (el('fgItemsDone')) el('fgItemsDone').hidden = false;
    itemsSave.textContent = 'Saved to your shelf 🍌'; setTimeout(() => { itemsSave.textContent = label; }, 2500);
    track('forge_item_save', { anchor: c.anchor });
  };

  // ---- boot ----
  const pickId = new URLSearchParams(location.search).get('shelf');
  const pickedAny = pickId ? shelfList().find((c) => c.id === pickId) : null;
  let bootItems = false;
  if (pickedAny && pickedAny.kind === 'emoji') { deserialize(pickedAny.params); }
  else if (pickedAny && pickedAny.kind === 'wearable') { // re-open a saved ITEM in Items mode
    try { const wd = JSON.parse(pickedAny.params.replace(/^wear:/, '')); if (deserialize(wd.forge)) bootItems = true; } catch (e) {}
  } else {
    const draft = (() => { try { return localStorage.getItem('forge-draft'); } catch (e) { return null; } })();
    if (draft) deserialize(draft);
  }
  document.querySelectorAll('.fg-size').forEach((x) => x.setAttribute('aria-pressed', String(state.w === state.h && +x.dataset.size === state.w)));
  fitCanvas();
  setTool('pencil');
  renderPalette();
  setColor(state.color);
  setBrush(1);
  el('fgOnion').setAttribute('aria-pressed', String(state.onion));
  if (bootItems) { // start in Items mode with the re-opened item already loaded
    mode = 'items';
    document.body.classList.add('fg-mode-items');
    document.querySelectorAll('.fg-modetab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === 'items')));
  }
  refreshAll();
  if (bootItems) updateItemsStatus();
  requestAnimationFrame(previewTick);
  track('forge_open');
  passVisit();
}
