// THE SHELF — "my creations", travelling across the whole banana world.
//
// A localStorage registry, no accounts. A creation IS its share-params string —
// the same interchange format used by share links, the OG worker, the overlay
// and the rave, so anything on the shelf can be re-opened, re-shared, worn to
// the rave or ordered as a sticker without translation.
//
// CLIENT-ONLY module (renders thumbnails via the engine — never import from
// Astro frontmatter).
import { drawComposite, assetsReady } from './banana-engine.js';
import { forgeParse, forgeDrawFrame } from './forge-format.js';
import { passPush } from './banana-pass.js';

// a saved 'wearable' → its ITEM sprite, cropped to the painted pixels and
// centred, drawn into a 96px thumbnail. Shown ALONE (an item is an item, not a
// banana) so the "My items" shelf never looks like the "My bananas" one.
function drawItemThumb(cv, params) {
  try {
    const d = JSON.parse(params.replace(/^wear:/, ''));
    const f = forgeParse(d.forge);
    if (!f) return;
    const fr = f.frames[0];
    let mnX = f.w, mnY = f.h, mxX = -1, mxY = -1;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      if (fr[y * f.w + x] && f.palette[fr[y * f.w + x]]) { if (x < mnX) mnX = x; if (x > mxX) mxX = x; if (y < mnY) mnY = y; if (y > mxY) mxY = y; }
    }
    if (mxX < 0) return;
    const bw = mxX - mnX + 1, bh = mxY - mnY + 1, k = Math.max(1, Math.floor(80 / Math.max(bw, bh)));
    const c = cv.getContext('2d'); c.save();
    c.translate(((96 - bw * k) / 2) | 0, ((96 - bh * k) / 2) | 0);
    for (let y = mnY; y <= mxY; y++) for (let x = mnX; x <= mxX; x++) {
      const idx = fr[y * f.w + x]; if (!idx) continue; const col = f.palette[idx]; if (!col) continue;
      c.fillStyle = col; c.fillRect((x - mnX) * k, (y - mnY) * k, k, k);
    }
    c.restore();
  } catch (e) {}
}

const KEY = 'shelf-v1';
const CAP = 24; // oldest fall off the back — it's a shelf, not a warehouse

function read() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}
function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))); } catch (e) {}
}

export function shelfList() { return read(); }

// add or refresh a creation; dedupes on the params string so tweaking and
// re-downloading the same banana doesn't fill the shelf with clones
export function shelfAdd({ kind = 'banana', params = '', shareId = null }) {
  if (!params) return null;
  const prev = read().find((c) => c.params === params);
  const item = {
    id: prev ? prev.id : 'c' + Math.random().toString(36).slice(2, 10),
    kind,
    params,
    shareId: shareId || (prev && prev.shareId) || null,
    created: prev ? prev.created : Date.now(),
  };
  write([item, ...read().filter((c) => c.params !== params)]);
  return item;
}

// ---- deletions that STICK (tombstones) ----------------------------------
// A linked pass merges shelves by union, so a plain remove is resurrected on
// the next pull. We keep a small ledger of deleted params (with the delete
// time); the merge (here + in banana-pass.js + worker-pass) drops any item
// whose params were tombstoned AFTER it was created. Re-making the exact same
// banana later (newer created) beats its old tombstone, so nothing is trapped.
const DEL_KEY = 'shelf-del-v1';
const DEL_CAP = 200;
function readDel() {
  try { const o = JSON.parse(localStorage.getItem(DEL_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
  catch (e) { return {}; }
}
function writeDel(map) {
  const kept = Object.fromEntries(Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, DEL_CAP));
  try { localStorage.setItem(DEL_KEY, JSON.stringify(kept)); } catch (e) {}
}

export function shelfRemove(id) {
  const list = read();
  const gone = list.find((c) => c.id === id);
  write(list.filter((c) => c.id !== id));
  if (gone && gone.params) { const d = readDel(); d[gone.params] = Date.now(); writeDel(d); }
  passPush(); // the tombstone rides the sync blob so the delete sticks everywhere
}

// ---- the banana "are you sure?" — never the browser's confirm() ----------
function ensureConfirmCss() {
  if (document.getElementById('shelf-confirm-css')) return;
  const s = document.createElement('style');
  s.id = 'shelf-confirm-css';
  s.textContent = `
    .shelf-confirm { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center;
      justify-content: center; background: rgba(17,17,17,0.6); padding: 1rem; }
    .shelf-confirm__box { position: relative; max-width: min(90vw, 360px); width: 100%; text-align: center;
      background: var(--paper, #faf6ee); border: 4px solid var(--ink, #111); box-shadow: 8px 8px 0 var(--ink, #111);
      padding: 1.4rem 1.2rem 1.1rem; }
    .shelf-confirm__peel { font-size: 2.4rem; line-height: 1; margin-bottom: 0.3rem;
      display: inline-block; transform-origin: 50% 90%; animation: shelfWobble 1.4s ease-in-out infinite; }
    @keyframes shelfWobble { 0%,100% { transform: rotate(-9deg); } 50% { transform: rotate(9deg); } }
    @media (prefers-reduced-motion: reduce) { .shelf-confirm__peel { animation: none; } }
    .shelf-confirm__box h3 { margin: 0 0 0.35rem; font-size: 1.2rem; }
    .shelf-confirm__box p { margin: 0 0 1.1rem; font-size: 0.9rem; opacity: 0.8; line-height: 1.45; }
    .shelf-confirm__row { display: flex; gap: 0.6rem; }
    .shelf-confirm__row button { flex: 1; font: inherit; font-weight: 800; cursor: pointer;
      border: 3px solid var(--ink, #111); padding: 0.6rem 0.5rem; }
    .shelf-confirm__no { background: var(--paper, #faf6ee); color: var(--ink, #111); box-shadow: 3px 3px 0 var(--ink, #111); }
    .shelf-confirm__yes { background: var(--hot, #ff4d6d); color: #fff; box-shadow: 3px 3px 0 var(--ink, #111); }
    .shelf-confirm__row button:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--ink, #111); }
    .shelf-confirm__row button:focus-visible { outline: 3px solid var(--ink, #111); outline-offset: 2px; }
  `;
  document.head.appendChild(s);
}
function confirmBin(noun, onYes) {
  ensureConfirmCss();
  const ov = document.createElement('div');
  ov.className = 'shelf-confirm';
  ov.innerHTML = `
    <div class="shelf-confirm__box" role="alertdialog" aria-modal="true" aria-labelledby="shelfConfirmTitle">
      <span class="shelf-confirm__peel" aria-hidden="true">🍌</span>
      <h3 id="shelfConfirmTitle">Toss this ${noun}?</h3>
      <p>It leaves your shelf for good — there's no undo, on any device.</p>
      <div class="shelf-confirm__row">
        <button type="button" class="shelf-confirm__no">Keep it</button>
        <button type="button" class="shelf-confirm__yes">Yes, bin it</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('.shelf-confirm__no').addEventListener('click', close);
  ov.querySelector('.shelf-confirm__yes').addEventListener('click', () => { close(); onYes(); });
  ov.querySelector('.shelf-confirm__no').focus();
}

function outfitFrom(params) {
  const p = new URLSearchParams(params);
  const extras = {};
  (p.get('ex') || '').split('.').forEach((id) => { if (id) extras[id] = true; });
  return {
    hat: p.get('h') || 'none',
    glasses: p.get('g') || 'none',
    extras,
    bg: p.get('bg') || 'transparent',
    frame: Math.min(7, Math.max(0, parseInt(p.get('f') || '2', 10) || 2)),
  };
}

// render the shelf strip into a host element; onPick(creation) on click.
// opts.limit shows only the latest N (the tools show a strip; the full shelf
// lives on the pass).
export async function renderShelf(host, { onPick, limit, kinds, emptyMsg } = {}) {
  if (!host) return;
  await assetsReady();
  let list = read();
  if (kinds) list = list.filter((c) => kinds.includes(c.kind)); // one shelf per KIND (bananas / items / emotes)
  if (limit) list = list.slice(0, limit);
  host.innerHTML = '';
  if (!list.length) {
    host.innerHTML = '<p class="shelf-empty">' + (emptyMsg || 'Empty so far — download, share or order a banana and it lands here.') + '</p>';
    return;
  }
  list.forEach((c) => {
    const cell = document.createElement('div');
    cell.className = 'shelf-item';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    if (c.kind === 'emoji') {
      const f = forgeParse(c.params);
      if (f) {
        const k = Math.max(1, Math.floor(96 / Math.max(f.w, f.h)));
        const tctx = cv.getContext('2d');
        tctx.save();
        tctx.translate(((96 - f.w * k) / 2) | 0, ((96 - f.h * k) / 2) | 0);
        forgeDrawFrame(tctx, f.frames[0], f.w, f.h, k, 1, f.palette);
        tctx.restore();
      }
    } else if (c.kind === 'wearable') {
      drawItemThumb(cv, c.params); // the item, alone
    } else {
      const o = outfitFrom(c.params);
      drawComposite(cv.getContext('2d'), 96, o.frame, {
        bg: o.bg, captions: false,
        hat: o.hat, glasses: o.glasses, extras: o.extras, top: '', bottom: '', effect: 'none',
      });
    }
    cell.appendChild(cv);
    if (c.kind !== 'emoji' && c.kind !== 'wearable') {
      // the shop door on every creation: bananas can become real stickers
      const t = document.createElement('a');
      t.className = 'shelf-tag';
      t.href = '/make-a-banana/?' + c.params + '&go=sticker';
      t.textContent = '🏷';
      t.title = 'Make it a real sticker';
      t.setAttribute('aria-label', 'Order this banana as a sticker');
      t.onclick = (e) => { e.stopPropagation(); if (window.gtag) window.gtag('event', 'shelf_sticker_click'); };
      cell.appendChild(t);
    }
    const x = document.createElement('button');
    x.className = 'shelf-x';
    x.textContent = '×';
    x.title = 'Take it off the shelf';
    x.setAttribute('aria-label', 'Remove from shelf');
    x.onclick = (e) => {
      e.stopPropagation();
      const noun = c.kind === 'emoji' ? 'emote' : c.kind === 'wearable' ? 'item' : 'banana';
      confirmBin(noun, () => { shelfRemove(c.id); renderShelf(host, { onPick, limit, kinds, emptyMsg }); });
    };
    cell.appendChild(x);
    if (onPick) {
      cell.title = 'Bring this banana back';
      cell.onclick = () => onPick(c);
    }
    host.appendChild(cell);
  });
}
