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

export function shelfRemove(id) {
  write(read().filter((c) => c.id !== id));
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
export async function renderShelf(host, { onPick, limit } = {}) {
  if (!host) return;
  await assetsReady();
  const list = limit ? read().slice(0, limit) : read();
  host.innerHTML = '';
  if (!list.length) {
    host.innerHTML = '<p class="shelf-empty">Empty so far — download, share or order a banana and it lands here.</p>';
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
    } else {
      const o = outfitFrom(c.params);
      drawComposite(cv.getContext('2d'), 96, o.frame, {
        bg: o.bg, captions: false,
        hat: o.hat, glasses: o.glasses, extras: o.extras, top: '', bottom: '', effect: 'none',
      });
    }
    cell.appendChild(cv);
    if (c.kind !== 'emoji') {
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
    x.onclick = (e) => { e.stopPropagation(); shelfRemove(c.id); renderShelf(host, { onPick }); };
    cell.appendChild(x);
    if (onPick) {
      cell.title = 'Bring this banana back';
      cell.onclick = () => onPick(c);
    }
    host.appendChild(cell);
  });
}
