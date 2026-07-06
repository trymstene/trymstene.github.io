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
import { shelfAdd, renderShelf, shelfList } from '../lib/banana-shelf.js';
import { passPatch, passStat, passVisit } from '../lib/banana-pass.js';
import { FORGE_PALETTE as PALETTE, FORGE_RGB as RGB, FORGE_MAX_FRAMES as MAX_FRAMES, b64, forgeParse } from '../lib/forge-format.js';

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
    onion: true,
    undo: [],
  };

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
    if (x < 0 || y < 0 || x >= state.size || y >= state.size) return;
    frame()[y * state.size + x] = idx;
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
    state.undo.push({ cur: state.cur, data: frame().slice() });
    if (state.undo.length > MAX_UNDO) state.undo.shift();
    refreshUndoBtn();
  }
  function undo() {
    const u = state.undo.pop();
    if (!u) return;
    state.cur = Math.min(u.cur, state.frames.length - 1);
    state.frames[state.cur] = u.data;
    refreshAll();
    save(); // an undone stroke must not resurrect from the autosave after a reload
  }
  function refreshUndoBtn() { el('fgUndo').disabled = !state.undo.length; }

  let drawing = false;
  function cellFromEvent(e) {
    const r = stage.getBoundingClientRect();
    return [
      Math.floor(((e.clientX - r.left) / r.width) * state.size),
      Math.floor(((e.clientY - r.top) / r.height) * state.size),
    ];
  }
  stage.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const [x, y] = cellFromEvent(e);
    if (state.tool === 'picker') {
      const idx = frame()[y * state.size + x];
      if (idx) setColor(idx);
      setTool('pencil');
      return;
    }
    pushUndo();
    drawing = true;
    stage.setPointerCapture(e.pointerId);
    if (state.tool === 'fill') { fill(x, y, state.color); drawing = false; }
    else paintCell(x, y, state.tool === 'eraser' ? 0 : state.color);
    drawEditor(); save();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const [x, y] = cellFromEvent(e);
    paintCell(x, y, state.tool === 'eraser' ? 0 : state.color);
    drawEditor();
  });
  addEventListener('pointerup', () => { if (drawing) { drawing = false; drawFrames(); save(); } });

  // ---- rendering ----
  function drawGridInto(c2, f, scale, dim) {
    for (let y = 0; y < state.size; y++) {
      for (let x = 0; x < state.size; x++) {
        const idx = f[y * state.size + x];
        if (!idx) continue;
        c2.globalAlpha = dim || 1;
        c2.fillStyle = PALETTE[idx];
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
      d.onclick = () => { state.cur = i; refreshAll(); };
      host.appendChild(d);
    });
    el('fgDelay').value = state.delays[state.cur];
    el('fgFrameInfo').textContent = `frame ${state.cur + 1}/${state.frames.length}`;
    el('fgDup').disabled = el('fgAdd').disabled = state.frames.length >= MAX_FRAMES;
    el('fgDel').disabled = state.frames.length <= 1;
  }

  el('fgAdd').onclick = () => {
    state.frames.splice(state.cur + 1, 0, new Uint8Array(state.size * state.size));
    state.delays.splice(state.cur + 1, 0, state.delays[state.cur]);
    state.cur++;
    refreshAll(); save(); track('forge_frame_add');
  };
  el('fgDup').onclick = () => {
    state.frames.splice(state.cur + 1, 0, frame().slice());
    state.delays.splice(state.cur + 1, 0, state.delays[state.cur]);
    state.cur++;
    refreshAll(); save(); track('forge_frame_dup');
  };
  el('fgDel').onclick = () => {
    if (state.frames.length <= 1) return;
    state.frames.splice(state.cur, 1);
    state.delays.splice(state.cur, 1);
    state.cur = Math.max(0, state.cur - 1);
    state.undo = []; refreshUndoBtn();
    refreshAll(); save();
  };
  el('fgDelay').addEventListener('change', () => {
    const v = Math.min(1000, Math.max(50, parseInt(el('fgDelay').value, 10) || 120));
    state.delays[state.cur] = v;
    el('fgDelay').value = v;
    save();
  });
  el('fgOnion').onclick = () => {
    state.onion = !state.onion;
    el('fgOnion').setAttribute('aria-pressed', String(state.onion));
    drawEditor();
  };
  el('fgUndo').onclick = undo;
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });

  // ---- tools + palette ----
  function setTool(t) {
    state.tool = t;
    document.querySelectorAll('.fg-tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  }
  document.querySelectorAll('.fg-tool').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });

  function setColor(idx) {
    state.color = idx;
    document.querySelectorAll('.fg-swatch').forEach((s) => s.setAttribute('aria-pressed', String(+s.dataset.idx === idx)));
  }
  const palHost = el('fgPalette');
  PALETTE.forEach((hex, idx) => {
    if (!idx) return;
    const s = document.createElement('button');
    s.className = 'fg-swatch';
    s.dataset.idx = idx;
    s.style.background = hex;
    s.title = hex;
    s.setAttribute('aria-label', 'Colour ' + hex);
    s.onclick = () => setColor(idx);
    palHost.appendChild(s);
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
    return JSON.stringify({
      v: 1, size: state.size,
      frames: state.frames.map((f) => b64.enc(f)),
      delays: state.delays,
    });
  }
  function deserialize(json) {
    const d = forgeParse(json);
    if (!d) return false;
    state.size = d.size;
    state.frames = d.frames;
    state.delays = d.delays;
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
      state.size = s;
      state.frames = [new Uint8Array(s * s)];
      state.delays = [120];
      state.cur = 0; state.undo = [];
      document.querySelectorAll('.fg-size').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      fitCanvas(); refreshAll(); save();
      track('forge_size', { size: s });
    };
  });

  // ---- export: transparent GIF, chat-platform ready ----
  el('fgExport').onclick = async () => {
    const btn = el('fgExport'); const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Forging…';
    try {
      const scale = Math.max(1, Math.ceil(128 / state.size)); // Discord wants ~128px
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
          palette: RGB, transparent: true, transparentIndex: 0,
          delay: state.delays[i], disposal: 2, first: i === 0,
        });
      });
      gif.finish();
      const blob = new Blob([gif.bytes()], { type: 'image/gif' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-pixel-emoji-trymstene.com.gif';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      shelfAdd({ kind: 'emoji', params: 'forge:' + serialize(), data: null });
      refreshShelfStrip();
      el('fgDone').hidden = false;
      track('forge_gif_export', { size: state.size, frames: state.frames.length });
      passPatch('smith'); passStat('forges');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
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
  function refreshShelfStrip() {
    renderShelf(el('fgShelf'), {
      limit: 6, // a strip, not the archive — the full shelf lives on the pass
      onPick: (c) => {
        if (c.kind === 'emoji') {
          if (deserialize(c.params)) {
            document.querySelectorAll('.fg-size').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.size === state.size)));
            fitCanvas(); refreshAll(); save();
            track('forge_shelf_pick');
          }
        } else {
          location.href = '/make-a-banana/?' + c.params; // bananas belong to the builder
        }
      },
    });
  }

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
  setColor(state.color);
  el('fgOnion').setAttribute('aria-pressed', String(state.onion));
  refreshAll();
  refreshShelfStrip();
  requestAnimationFrame(previewTick);
  track('forge_open');
  passVisit();
}
