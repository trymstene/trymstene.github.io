// Custom sticker PDP — the product page for a banana designed in the builder.
// Reuses the shop's .pdp look (one store, one feel) but the "product image" is
// rendered live from the design in the URL, and checkout runs the custom
// pipeline. All the heavy lifting lives in ../lib/sticker-core.js (shared with
// the builder) so config + render + checkout never drift between the two.
import { assetsReady, NFRAMES } from '../lib/banana-engine.js';
import {
  PRICE, parseDesign, composite, designStr, captionsClean, getProduct,
  bboxOf, pad, crop, renderPrintFile, makeStickerMockup, localizedPrice, uploadAndCheckout,
} from '../lib/sticker-core.js';

const el = (id) => document.getElementById(id);
const track = (name, p) => { if (window.gtag) window.gtag('event', name, p || {}); };
const state = parseDesign(new URLSearchParams(location.search));
// which product this page sells — from the route (shared/products.js drives it)
const product = getProduct((el('pdpRoot') || {}).dataset && el('pdpRoot').dataset.product) || getProduct('sticker');

// the trimmed "design" (banana + captions + bg), rendered once at preview res
function designCanvas() {
  const W = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const ctx = cv.getContext('2d');
  composite(ctx, W, state.frame, state, {
    // die-cut (transparent) = banana only; captions live on square stickers
    bg: state.bg, captions: state.bg !== 'transparent', effect: state.effect,
    hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
  });
  if (state.bg === 'transparent') {
    const data = ctx.getImageData(0, 0, W, W).data;
    return crop(cv, pad(bboxOf([data], W), W));
  }
  return cv;
}

function paintMockup() {
  const mock = makeStickerMockup(state, designCanvas(), 900, product.key);
  const main = el('pdpMock');
  main.width = mock.width; main.height = mock.height;
  main.getContext('2d').drawImage(mock, 0, 0);
}

async function boot() {
  el('pdpCut').textContent = state.bg === 'transparent'
    ? `${product.size} ${product.material}, die-cut along your design’s outline`
    : `${product.size} ${product.material}, square with your design`;
  // carry the exact design back to the editor
  const back = el('pdpBack'); if (back) back.href = '/make-a-banana/' + location.search;
  // die-cut can't hold a floating caption — tell the user their text was left
  // off, and how to keep it (pick a background = a square sticker)
  if (state.bg === 'transparent' && (state.top || state.bottom)) {
    const h = el('pdpHint');
    if (h) { h.hidden = false; h.textContent = '✎ Your caption prints on square stickers only — this die-cut is just the banana. Pick a background back in the editor to keep the text.'; }
  }
  await assetsReady();
  paintMockup();
  track('sticker_pdp_view', { product: product.key, design: designStr(state) });
  const lp = await localizedPrice(product);
  if (lp) {
    el('pdpPrice').innerHTML = '<small>from</small> ' + lp.display;
    el('pdpNote').textContent = lp.display + ' · free worldwide shipping · tax where applicable';
  }
}
boot().catch((e) => { console.error('PDP boot failed:', e); track('sticker_pdp_boot_fail', { message: String((e && e.message) || e).slice(0, 90) }); });

let busy = false;
el('pdpBuy').onclick = async () => {
  if (busy) return;
  if (!captionsClean(state)) {
    const s = el('pdpStock'); s.textContent = 'Let’s keep it family friendly \u{1F34C} — head back and try other words';
    s.className = 'pdp-stock pdp-stock--no'; return;
  }
  busy = true;
  const btn = el('pdpBuy'); const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Preparing your sticker…';
  el('pdpStock').textContent = '';
  track('sticker_pdp_checkout', { product: product.key, value: PRICE.amount, currency: PRICE.currency, design: designStr(state) });
  try {
    const { checkoutUrl } = await uploadAndCheckout(renderPrintFile(state), product);
    track('checkout_redirect', { value: PRICE.amount, currency: PRICE.currency });
    window.location.href = checkoutUrl;
  } catch (e) {
    console.error(e);
    track('sticker_order_fail', { message: String((e && e.message) || e).slice(0, 90) });
    const s = el('pdpStock'); s.textContent = 'Hmm, that didn’t work — give it another try?';
    s.className = 'pdp-stock pdp-stock--no';
    btn.disabled = false; btn.textContent = label; busy = false;
  }
};
