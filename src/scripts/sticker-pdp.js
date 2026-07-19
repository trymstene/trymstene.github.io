// Custom sticker PDP — the product page for a banana designed in the builder.
// Reuses the shop's .pdp look (one store, one feel) but the "product image" is
// rendered live from the design in the URL, and checkout runs the custom
// pipeline. All the heavy lifting lives in ../lib/sticker-core.js (shared with
// the builder) so config + render + checkout never drift between the two.
import { assetsReady, NFRAMES } from '../lib/banana-engine.js';
import { passPatch } from '../lib/banana-pass.js';
import {
  PRICE, parseDesign, composite, designStr, captionsClean, getProduct,
  bboxOf, pad, crop, renderPrintFile, renderApparelPrint, makeStickerMockup,
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
function photoFor(style, color) {
  const k = style + '-' + color;
  if (!photoCache[k]) {
    const img = new Image();
    img.onload = () => { if (sel.mstyle === style && sel.color === color) paintMockup(); };
    img.src = `/assets/${product.key}/${product.key}-${k}.jpg`;
    photoCache[k] = img;
  }
  return photoCache[k];
}

// the trimmed "design" (banana + captions + bg), rendered once at preview res
function designCanvas() {
  // apparel: the preview IS the print file (the full 12″×16″ area with the
  // design placed inside it) at preview res — WYSIWYG with the real print
  if (apparel) return renderApparelPrint(state, 512);
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
    photo: apparel ? photoFor(sel.mstyle, sel.color) : null,
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
  if (!apparel) {
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
  wireOptions();
  wireZoom();
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
