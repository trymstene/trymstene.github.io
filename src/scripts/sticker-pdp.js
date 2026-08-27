// Custom sticker PDP — the product page for a banana designed in the builder.
// Reuses the shop's .pdp look (one store, one feel) but the "product image" is
// rendered live from the design in the URL, and checkout runs the custom
// pipeline. All the heavy lifting lives in ../lib/sticker-core.js (shared with
// the builder) so config + render + checkout never drift between the two.
import {
  assetsReady, NFRAMES, HATS, GLASSES, EXTRA_DEFS, HAT_BY_ID, SHADE_BY_ID, SVG as ART,
} from '../lib/banana-engine.js';
import { ownsWearable, ownsDropStat } from '../data/wearables.js';
import { wearToCustom } from '../lib/wear-render.js';
import { passPatch } from '../lib/banana-pass.js';
import {
  PRICE, parseDesign, composite, designStr, captionsClean, getProduct,
  bboxOf, pad, crop, renderPrintFile, renderApparelPrint, renderMugPrint, makeStickerMockup,
  localizedPrice, uploadAndCheckout, stickerCaptions, stickerEffect, TEE_QUADS,
  ensureCaptionFont,
} from '../lib/sticker-core.js';

const el = (id) => document.getElementById(id);
const track = (name, p) => { if (window.gtag) window.gtag('event', name, p || {}); };
// funnel step clock — same sessionStorage key the builder uses, so the
// builder -> PDP -> ORDER -> checkout gaps are measured ACROSS pages;
// >30min = wandered off, send nothing (skews averages less than capping)
const stepSecs = () => {
  const now = Date.now(); let prev = 0;
  try { prev = +(sessionStorage.getItem('fk-t') || 0); sessionStorage.setItem('fk-t', String(now)); } catch (e) {}
  const s = prev ? Math.round((now - prev) / 1000) : -1;
  return (s >= 0 && s <= 1800) ? s : undefined;
};
const withSecs = (p) => {
  const s = stepSecs();
  p = p || {};
  if (s !== undefined) p.secs_since_prev = s;
  return p;
};
const state = parseDesign(new URLSearchParams(location.search));
// which product this page sells — from the route (shared/products.js drives it)
const product = getProduct((el('pdpRoot') || {}).dataset && el('pdpRoot').dataset.product) || getProduct('sticker');
const apparel = !!product.options;
// apparel selection (colour + size) — defaults: first colour, size M
const sel = apparel ? { color: product.options.colors[0].id, size: 'M' } : null;
const selHex = () => {
  const c = apparel && product.options.colors.find((x) => x.id === sel.color);
  return c ? c.hex : '#ffffff';
};
// MODEL/FLAT PHOTOS (Printful mockup shoots, self-hosted, per style × colour)
// loaded lazily with a cache — until a photo lands the pixel tee fills in.
// sel.mstyle picks the shoot: 'woman' (smiling — the default after the
// original catalog model was voted too melancholic), 'man', 'flat'.
if (sel) sel.mstyle = 'woman';
const photoCache = {};
// the mug has one shoot, not a style x colour grid — Printful's blank enamel
const mugPhoto = () => photoKey('enamel');
const photoFor = (style, color) => photoKey(style + '-' + color);
function photoKey(k) {
  if (!photoCache[k]) {
    const img = new Image();
    // repaint whenever a shot lands. The old guard compared it against the
    // current selection, but it read `sel` — which is NULL on the mug, whose
    // page has no colour or style to select. Repainting unconditionally is
    // also simply correct: paintMockup always draws the CURRENT state, so a
    // photo arriving late can never restore a stale one.
    img.onload = () => paintMockup();
    img.src = `/assets/${product.key}/${product.key}-${k}.jpg`;
    photoCache[k] = img;
  }
  return photoCache[k];
}

// the trimmed "design" (banana + captions + bg), rendered once at preview res
function designCanvas() {
  // apparel: the preview IS the print file (the full 12″×16″ area with the
  // design placed inside it) at preview res — WYSIWYG with the real print
  if (apparel) return renderApparelPrint(state, 640);   // ⚠️ multiple of 160 — 512 striped
  // mug: same deal — the preview IS the wrap print file, and the mockup shows
  // the half of it that faces you
  if (product.print === 'mug') return renderMugPrint(state, 1024);
  const W = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const ctx = cv.getContext('2d');
  composite(ctx, W, state.frame, state, {
    // die-cut (transparent) = banana only; captions + confetti/sparkle live on
    // square stickers (see sticker-core stickerCaptions / stickerEffect)
    bg: state.bg, captions: stickerCaptions(state), effect: stickerEffect(state),
    hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
  });
  if (state.bg === 'transparent') {
    const data = ctx.getImageData(0, 0, W, W).data;
    return crop(cv, pad(bboxOf([data], W), W));
  }
  return cv;
}

function paintMockup() {
  const mock = makeStickerMockup(state, designCanvas(), 900, product.key, {
    colorHex: selHex(),
    photo: apparel ? photoFor(sel.mstyle, sel.color)
      : (product.print === 'mug' ? mugPhoto() : null),
    quad: apparel ? TEE_QUADS[sel.mstyle] : null,
  });
  const main = el('pdpMock');
  main.width = mock.width; main.height = mock.height;
  main.getContext('2d').drawImage(mock, 0, 0);
}

// apparel option chips: colour repaints the tee, size just marks itself
function wireOptions() {
  if (!apparel) return;
  document.querySelectorAll('#pdpColors .pdp-swatch').forEach((b) => {
    b.onclick = () => {
      sel.color = b.dataset.color;
      document.querySelectorAll('#pdpColors .pdp-swatch').forEach((x) =>
        x.setAttribute('aria-pressed', String(x === b)));
      paintMockup();
      track('pdp_option_pick', { product: product.key, option: 'color', value: sel.color });
    };
  });
  document.querySelectorAll('#pdpSizes .pdp-sizebtn').forEach((b) => {
    b.onclick = () => {
      sel.size = b.dataset.size;
      document.querySelectorAll('#pdpSizes .pdp-sizebtn').forEach((x) =>
        x.setAttribute('aria-pressed', String(x === b)));
      track('pdp_option_pick', { product: product.key, option: 'size', value: sel.size });
    };
  });
  // mockup-style thumbnails: her / him / flat — same design, different shoot
  document.querySelectorAll('#pdpStyles button').forEach((b) => {
    b.onclick = () => {
      sel.mstyle = b.dataset.mstyle;
      document.querySelectorAll('#pdpStyles button').forEach((x) =>
        x.setAttribute('aria-pressed', String(x === b)));
      paintMockup();
      track('pdp_option_pick', { product: product.key, option: 'mockup', value: sel.mstyle });
    };
  });
  // size-guide unit toggle (same behaviour as /js/shop.js on the official PDPs)
  const toggle = document.querySelector('.size-toggle');
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      toggle.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      document.querySelectorAll('.size-table [data-unit]').forEach((c) => {
        c.style.display = (c.dataset.unit === btn.dataset.unit) ? '' : 'none';
      });
    });
  }
}

// last-minute pose change, right on the product page (Trym: you shouldn't have
// to go back to the editor just to pick a different move). state.frame feeds
// 👗 THE WARDROBE — the shop's tile says "Design it", so this page has to let
// you design. Before this it only offered a pose, which meant anyone arriving
// from /shop/ was shown a banana they had never chosen and given no way to
// change it: a broken promise at the highest-intent click in the shop.
//
// ⚠️ ONE STATE OBJECT. These write into the same `state` that paintMockup and
// renderPrintFile read, so the preview, the print file and the checkout image
// can never disagree about what you dressed.
//
// ⚠️ OWNERSHIP IS ALREADY BAKED IN: HATS/GLASSES are engine exports filtered by
// ownsWearable, so caught-only drops never appear here for someone who has not
// caught them. Extras are filtered the same way the builder does it.
function syncDesignUrl() {
  const q = new URLSearchParams(location.search);
  const set = (k, v) => (v ? q.set(k, v) : q.delete(k));
  set('h', state.hat !== 'none' ? state.hat : '');
  set('g', state.glasses !== 'none' ? state.glasses : '');
  set('ex', Object.keys(state.extras).filter((k) => state.extras[k]).join('.'));
  set('c', state.c || '');
  history.replaceState(null, '', location.pathname + '?' + q.toString());
  const back = el('pdpBack'); if (back) back.href = '/make-a-banana/' + location.search;
  document.querySelectorAll('[data-xsell]').forEach((a) => {
    a.href = a.href.split('?')[0] + location.search;
  });
}

function wardrobeRow(host, kicker, chips) {
  const row = document.createElement('div');
  row.className = 'pdp-ward__row';
  const k = document.createElement('div');
  k.className = 'pdp-ward__k'; k.textContent = kicker;
  const tray = document.createElement('div');
  tray.className = 'pdp-ward__tray';
  tray.setAttribute('role', 'group');
  tray.setAttribute('aria-label', kicker);
  chips.forEach(({ art, label, on, pick, locked }) => {
    // a LOCKED item is a door, not a dead chip: you can see the thing exists
    // and tapping tells you where to go and get it
    if (locked) {
      const a = document.createElement('a');
      a.className = 'pdp-ward__locked';
      a.href = locked.href;
      // ⚠️ no art ≠ print the label inline: not-yet-owned community pieces
      // have no wearable art, and their raw names side by side rendered as
      // overlapping garble. A locked tile looks like a tile.
      a.innerHTML = chipArt(art) || '<span class="pdp-ward__none">🔒</span>';
      a.title = label + ' — ' + locked.why;
      a.setAttribute('aria-label', label + ' (locked — ' + locked.why + ')');
      tray.appendChild(a);
      return;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', String(on()));
    b.innerHTML = chipArt(art) || '<span class="pdp-ward__none">none</span>';
    b.onclick = () => {
      pick();
      // the poses show the outfit, so they have to be redrawn with it
      buildPosePicker();
      paintMockup();
      syncDesignUrl();
      // ⚠️ index against the BUTTONS only — locked chips are <a>, so a naive
      // children[i] would pair the wrong chip with the wrong state
      const unlocked = chips.filter((c) => !c.locked);
      tray.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(unlocked[i].on())));
      track('pdp_dress', { product: product.key, slot: kicker.toLowerCase(), item: label });
    };
    tray.appendChild(b);
  });
  row.append(k, tray);
  host.appendChild(row);
}

// ⚠️ WEARABLES NAME THEIR ART TWO WAYS. Hats and held things carry a single
// `art`; anything worn on the FACE (shades, moustaches) is drawn per facing and
// carries `front`/`side` instead. Reading only `art` left every shade chip
// showing the empty "none" placeholder.
const artOf = (d) => (d && (ART[d.art] || ART[d.front])) || '';

// ⚠️ NOT ALL ART IS SVG. Most wearables are an inline pixel-SVG string, but a
// PNG-art item (the pier plush = the resized real banana) is a PATH — dropped
// into innerHTML it renders as the literal text "/assets/…png".
const chipArt = (art) => (!art ? '' : art.charAt(0) === '<' ? art
  : '<img src="' + art + '" alt="" style="max-width:100%;max-height:100%;image-rendering:pixelated">');

// ⚠️ TWO DIFFERENT GATES, and they behave oppositely — copied from the builder
// so the shop and the workshop agree about what you may wear:
//   ownsWearable  → STAND stock you have not bought: hidden entirely (it is for
//                   sale over at the stand, not a thing you own)
//   earned:       → drops you catch at the rave/pier/garden: SHOWN BUT LOCKED,
//                   because seeing it is the whole point — you learn it exists
const earnedUnlocked = (d) => {
  if (!d.earned) return true;
  try {
    const pass = JSON.parse(localStorage.getItem('pass-v1') || '{}');
    if (d.stat) return (((pass.stats) || {})[d.stat] || 0) > 0;
    if (d.flag) return localStorage.getItem(d.flag) === '1' || ownsDropStat(d.id);
    if (d.patch) return !!((pass.patches || {})[d.patch]);
  } catch (e) {}
  return false;
};
const earnDoor = (d) => (d.earned === 'pier' ? { href: '/beach/', at: 'the pier' }
  : d.earned === 'garden' ? { href: '/park/', at: 'the park garden' }
    : { href: '/rave/', at: 'the rave' });

// 🎁 THE COMMUNITY TRACK — visitor-made wearables. These are NOT in the
// wearables manifest: they are moderated into the catalog worker and ride the
// engine's single `c` custom slot, which is what lets a new one appear with no
// deploy. The builder has consumed them since P4-D; this page did not, so a
// caught item vanished the moment you went to buy something with it on.
const CATALOG_URL = 'https://banana-share.trymstene.workers.dev/catalog/items.json';
// 🧢 THE MISSING LOGIC STEP (Trym): a community piece and a built-in wearable
// on the same spot used to STACK — a community beanie drawn on top of a hat.
// The catalog knows each item's anchor; only the real collisions exclude:
// head ⟷ hat, feet ⟷ shoe extras. Reads THIS page's catalog instance —
// drops.js has its own copy and a cross-instance read would see [].
const catAnchor = (id) => { const it = CATALOG.find((x) => x.id === id); return (it && it.wear && it.wear.anchor) || ''; };
const anchorSlot = (a) => (a === 'head' ? 'hat' : a === 'feet' ? 'feet' : null);
let CATALOG = [];
const CAT_CUSTOM = {};
const catOwned = () => { try { return JSON.parse(localStorage.getItem('cat-own-v1') || '{}') || {}; } catch (e) { return {}; } };
const catStats = () => { try { return (JSON.parse(localStorage.getItem('pass-v1') || '{}').stats) || {}; } catch (e) { return {}; } };
const ownsCatalog = (id) => { try { return !!catOwned()[id] || (catStats()['own_' + id] || 0) > 0; } catch (e) { return false; } };
function catCustom(ids) {
  // 🧢 `ids` is ONE id or a COMMA LIST — a banana can wear several community
  // items since 2 Aug (a visitor wrote in asking for three). Returns an ARRAY;
  // the engine draws them in order.
  // ⚠️ THERE ARE FIVE COPIES OF THIS RESOLVER. Every one must understand the
  // comma form — one that cannot would leave that player wearing NOTHING in
  // that area, which is worse than the single-item limit it replaced.
  const one = (id) => {
    if (id in CAT_CUSTOM) return CAT_CUSTOM[id] || undefined;   // ⚠️ never cache a MISS (P4-D)
    const it = CATALOG.find((x) => x.id === id);
    if (!it || it.kind === 'decor') return undefined;   // decor = homestead goods, never worn
    CAT_CUSTOM[id] = wearToCustom(it.wear);
    return CAT_CUSTOM[id] || undefined;
  };
  const out = String(ids || '').split(',').map((t) => t.trim()).filter(Boolean)
    .map(one).filter(Boolean);
  return out.length ? out : undefined;

}
// `state.c` is an id; the renderer needs the wear payload. Resolving it onto
// state.custom is what makes the preview, the print file and the checkout
// image all agree — they every one read composite(), which reads state.custom.
function applyCustom() { state.custom = state.c ? catCustom(state.c) : undefined; }

function buildWardrobe() {
  const host = el('pdpWardrobe');
  if (!host) return;
  host.replaceChildren();
  const lockOf = (d) => {
    if (!d || earnedUnlocked(d)) return null;
    const door = earnDoor(d);
    return { href: door.href, why: d.lock || ('catch it at ' + door.at) };
  };
  // ⚠️ no "none" tile anywhere (Trym): extras and community already toggle
  // off by re-tapping, so a dedicated empty box on hat/shades was the odd row
  // out. Tap the worn one to take it off — one rule for every band.
  wardrobeRow(host, 'Hat', HATS.filter(([id]) => id !== 'none').map(([id, label]) => ({
    art: artOf(HAT_BY_ID[id]),
    label, locked: lockOf(HAT_BY_ID[id]),
    on: () => state.hat === id,
    pick: () => {
      state.hat = state.hat === id ? 'none' : id;
      // ⚠️ crossing rows must REPAINT rows: each tray only re-syncs itself,
      // so a cleared community piece would keep glowing pressed
      if (state.hat !== 'none' && state.c && anchorSlot(catAnchor(state.c)) === 'hat') { state.c = ''; applyCustom(); queueMicrotask(buildWardrobe); }
    },
  })));
  wardrobeRow(host, 'Shades', GLASSES.filter(([id]) => id !== 'none').map(([id, label]) => ({
    art: artOf(SHADE_BY_ID[id]),
    label, locked: lockOf(SHADE_BY_ID[id]),
    on: () => state.glasses === id,
    pick: () => { state.glasses = state.glasses === id ? 'none' : id; },
  })));
  // artOf() in the filter drops anything with no drawable chip — a tray of
  // blank "none" boxes is worse than a shorter tray
  const extras = EXTRA_DEFS.filter((d) => !d.raveOnly && ownsWearable(d) && artOf(d));
  if (extras.length) {
    wardrobeRow(host, 'Extras', extras.map((d) => ({
      art: artOf(d), label: d.label, locked: lockOf(d),
      on: () => !!state.extras[d.id],
      pick: () => {
        state.extras[d.id] = !state.extras[d.id];
        if (state.extras[d.id] && d.anchor === 'feet' && state.c && anchorSlot(catAnchor(state.c)) === 'feet') { state.c = ''; applyCustom(); queueMicrotask(buildWardrobe); }
      },
    })));
  }
  // 🎁 THE COMMUNITY ROW — hidden until the catalog lands, then owned items are
  // wearable and the rest are locked doors to the Banana Stand, where every
  // approved community piece is on sale (7 Aug: they no longer wait for a
  // rave drop). Only ONE can be worn at a time (the single `c` slot), so
  // picking is exclusive, not a toggle-set.
  if (CATALOG.length) {
    wardrobeRow(host, 'Community', CATALOG.filter((it) => it.kind !== 'decor')
      .sort((a, b) => (a.added || 0) - (b.added || 0))
      .map((it) => {
        const name = it.title || 'community item';
        const owned = ownsCatalog(it.id);
        return {
          art: ((catCustom(it.id) || [])[0] || {}).art,
          label: name + (it.by ? ' by ' + it.by : ''),
          locked: owned ? null : { href: '/park/', why: 'buy it at the Banana Stand' },
          on: () => state.c === it.id,
          pick: () => {
            state.c = state.c === it.id ? '' : it.id;
            applyCustom();
            if (state.c) {
              const slot = anchorSlot(catAnchor(state.c));
              if (slot === 'hat') state.hat = 'none';
              if (slot === 'feet') EXTRA_DEFS.forEach((d) => { if (d.anchor === 'feet') state.extras[d.id] = false; });
              if (slot) queueMicrotask(buildWardrobe);
            }
          },
        };
      }));
  }
}

// the mockup AND renderPrintFile, so what you pick here is what gets printed.
function buildPosePicker() {
  const host = el('pdpPoses');
  if (!host) return;
  const mark = () => host.querySelectorAll('button').forEach((b) =>
    b.setAttribute('aria-pressed', String(parseInt(b.dataset.frame, 10) === state.frame)));
  for (let i = 0; i < NFRAMES; i++) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.frame = i;
    b.setAttribute('aria-label', 'Dance frame ' + (i + 1));
    const c = document.createElement('canvas'); c.width = 96; c.height = 96;
    // thumbnails show the outfit, not effects/captions (same as the builder's strip)
    composite(c.getContext('2d'), 96, i, state, { bg: 'transparent', captions: false });
    b.appendChild(c);
    b.onclick = () => {
      state.frame = i;
      paintMockup(); mark();
      // keep the pose in the URL so back-to-editor, cross-sell and refresh all agree
      const q = new URLSearchParams(location.search); q.set('f', String(i));
      history.replaceState(null, '', location.pathname + '?' + q.toString());
      const back = el('pdpBack'); if (back) back.href = '/make-a-banana/' + location.search;
      document.querySelectorAll('[data-xsell]').forEach((a) => {
        a.href = a.href.split('?')[0] + location.search;
      });
      track('pdp_pose_pick', { product: product.key, frame: i });
    };
    host.appendChild(b);
  }
  mark();
}

// mockup zoom (all custom PDPs): desktop hover magnifies where the cursor
// points; touch taps to 2.2× at the tap point, drags to look around, taps
// again to reset. Pure CSS transform — repaints don't disturb it.
function wireZoom() {
  const wrap = document.getElementById('pdpZoom');
  const cv = el('pdpMock');
  if (!wrap || !cv) return;
  const Z = 2.2;
  const originAt = (ev) => {
    const r = wrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100));
    cv.style.transformOrigin = `${x}% ${y}%`;
  };
  // a small self-fading hint so the zoom is discoverable (both input worlds)
  const hover = window.matchMedia('(hover: hover)').matches;
  const hint = document.createElement('div');
  hint.className = 'pdp-zoomhint';
  hint.textContent = hover ? '🔍 hover to zoom' : '🔍 tap to zoom';
  wrap.appendChild(hint);
  setTimeout(() => hint.classList.add('fade'), 4200);
  setTimeout(() => hint.remove(), 5400);

  if (hover) {
    wrap.addEventListener('mouseenter', (ev) => { originAt(ev); cv.style.transform = `scale(${Z})`; });
    wrap.addEventListener('mousemove', (ev) => { wrap.classList.add('zooming'); originAt(ev); });
    wrap.addEventListener('mouseleave', () => {
      wrap.classList.remove('zooming'); cv.style.transform = ''; cv.style.transformOrigin = '50% 50%';
    });
    return;
  }
  // touch: tap toggles; while zoomed you DRAG THE IMAGE (swipe left → view
  // moves right, like grabbing a photo — Trym: the follow-the-finger version
  // felt inverted). Origin moves opposite the finger, scaled so the drag
  // feels 1:1 with the picture.
  let zoomed = false; let moved = false; let downAt = null; let startOrigin = null;
  const getOrigin = () => {
    const m = /([\d.]+)%\s+([\d.]+)%/.exec(cv.style.transformOrigin || '50% 50%');
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 50, y: 50 };
  };
  wrap.addEventListener('pointerdown', (ev) => {
    downAt = { x: ev.clientX, y: ev.clientY }; startOrigin = getOrigin(); moved = false;
  });
  wrap.addEventListener('pointermove', (ev) => {
    if (!downAt) return;
    const dx = ev.clientX - downAt.x, dy = ev.clientY - downAt.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
    if (zoomed && moved) {
      ev.preventDefault();
      wrap.classList.add('zooming');
      const r = wrap.getBoundingClientRect();
      const ox = Math.max(0, Math.min(100, startOrigin.x - (dx * 100) / ((Z - 1) * r.width)));
      const oy = Math.max(0, Math.min(100, startOrigin.y - (dy * 100) / ((Z - 1) * r.height)));
      cv.style.transformOrigin = `${ox}% ${oy}%`;
    }
  });
  wrap.addEventListener('pointerup', (ev) => {
    wrap.classList.remove('zooming');
    if (!moved) {
      zoomed = !zoomed;
      wrap.classList.toggle('zoomed', zoomed);
      wrap.style.touchAction = zoomed ? 'none' : '';
      if (zoomed) { originAt(ev); cv.style.transform = `scale(${Z})`; }
      else { cv.style.transform = ''; cv.style.transformOrigin = '50% 50%'; }
    }
    downAt = null;
  });
}

async function boot() {
  // ⚠️ the mug is neither apparel nor a cut sheet — without this it inherited
  // the sticker line and told buyers a ceramic mug was die-cut to their outline.
  // Its shape never changes with the background, so it says one thing always.
  if (product.print === 'mug') {
    el('pdpCut').textContent = `${product.size} ${product.material} — your banana wrapped around it`;
  } else if (!apparel) {
    el('pdpCut').textContent = state.bg === 'transparent'
      ? `${product.size} ${product.material}, die-cut along your design’s outline`
      : `${product.size} ${product.material}, square with your design`;
  }
  // carry the exact design back to the editor + across to the cross-sell PDPs
  const back = el('pdpBack'); if (back) back.href = '/make-a-banana/' + location.search;
  document.querySelectorAll('[data-xsell]').forEach((a) => { a.href = a.getAttribute('href') + location.search; });
  // die-cut can't hold floating bits — tell the user what was left off (caption
  // and/or confetti/sparkle) and how to keep it (pick a background = square).
  // Apparel has no die-cut: everything prints, so no hint needed.
  if (!apparel && state.bg === 'transparent') {
    const dropped = [];
    if (state.top || state.bottom) dropped.push('captions');
    if (state.effect === 'confetti' || state.effect === 'sparkle') dropped.push('effects');
    if (dropped.length) {
      const label = dropped.join(' and ');
      const h = el('pdpHint');
      if (h) { h.hidden = false; h.textContent = `✎ ${label[0].toUpperCase() + label.slice(1)} print on square stickers only — this die-cut is just the banana. Pick a background back in the editor to keep them.`; }
    }
  }
  await assetsReady();
  paintMockup();
  // once Anton decodes, repaint so the mockup matches what will print (no blocking)
  ensureCaptionFont(state).then(() => { try { paintMockup(); } catch (e) {} });
  buildPosePicker();
  buildWardrobe();
  wireOptions();
  wireZoom();
  // 🎁 the catalog lands late and never blocks the page: when it arrives the
  // community row appears and, if the visitor already wears one, the mockup
  // repaints WITH it (it was drawing without until now)
  fetch(CATALOG_URL)
    .then((r) => (r.ok ? r.json() : []))
    .then((items) => {
      if (!Array.isArray(items) || !items.length) return;
      CATALOG = items;
      applyCustom();
      buildWardrobe();
      buildPosePicker();
      paintMockup();
    })
    .catch(() => {});
  track('sticker_pdp_view', withSecs({ product: product.key, design: designStr(state) }));
  const lp = await localizedPrice(product);
  if (lp) {
    // the price lives ONLY in the badge — the note never repeats it (Trym)
    el('pdpPrice').innerHTML = '<small>from</small> ' + lp.display;
  }
}
boot().catch((e) => { console.error('PDP boot failed:', e); track('sticker_pdp_boot_fail', { message: String((e && e.message) || e).slice(0, 90) }); });

let busy = false;
// not-yet-live products render a disabled teaser button without the id
if (el('pdpBuy')) el('pdpBuy').onclick = async () => {
  if (busy) return;
  if (!captionsClean(state)) {
    const s = el('pdpStock'); s.textContent = 'Let’s keep it family friendly \u{1F34C} — head back and try other words';
    s.className = 'pdp-stock pdp-stock--no'; return;
  }
  busy = true;
  const btn = el('pdpBuy'); const label = btn.textContent;
  btn.disabled = true; btn.textContent = `Preparing your ${product.name.toLowerCase()}…`;
  el('pdpStock').textContent = '';
  track('sticker_pdp_checkout', withSecs({ product: product.key, value: PRICE.amount, currency: PRICE.currency, design: designStr(state) }));
  try {
    await ensureCaptionFont(state); // Anton must be decoded before we bake the print
    const { checkoutUrl } = await uploadAndCheckout(renderPrintFile(state, product), product, sel);
    // secs_since_prev here = upload+cart pipeline latency (ORDER click -> redirect)
    track('checkout_redirect', withSecs({ value: PRICE.amount, currency: PRICE.currency }));
    passPatch('patron', { quiet: true }); // pass badge for ordering — celebrate on return, not mid-redirect
    window.location.href = checkoutUrl;
  } catch (e) {
    console.error(e);
    const msg = String((e && e.message) || e);
    // the STAGE rides in the event NAME — event names are queryable in GA4
    // without registering custom dimensions (two real-user fails were opaque)
    const stage = msg.includes('upload') ? 'upload' : msg.includes('cart') ? 'cart'
      : msg.includes('render') ? 'render' : msg.includes('not available') ? 'product' : 'other';
    track('sticker_order_fail', { message: msg.slice(0, 90), stage });
    track('sticker_order_fail_' + stage, { message: msg.slice(0, 90) });
    const s = el('pdpStock'); s.textContent = 'Hmm, that didn’t work — give it another try?';
    s.className = 'pdp-stock pdp-stock--no';
    btn.disabled = false; btn.textContent = label; busy = false;
  }
};
