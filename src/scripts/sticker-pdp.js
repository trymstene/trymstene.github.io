// Custom sticker PDP — the product page for a banana designed in the builder.
// Reuses the shop's .pdp look (one store, one feel) but the "product image" is
// rendered live from the design in the URL, and checkout runs the custom
// pipeline. All the heavy lifting lives in ../lib/sticker-core.js (shared with
// the builder) so config + render + checkout never drift between the two.
import { assetsReady, NFRAMES } from '../lib/banana-engine.js';
import {
  PRICE, parseDesign, composite, designStr, captionsClean,
  bboxOf, pad, crop, renderPrintFile, makeStickerMockup, localizedPrice, uploadAndCheckout,
} from '../lib/sticker-core.js';

const el = (id) => document.getElementById(id);
const track = (name, p) => { if (window.gtag) window.gtag('event', name, p || {}); };
const state = parseDesign(new URLSearchParams(location.search));

// the trimmed "design" (banana + captions + bg), rendered once at preview res
function designCanvas() {
  const W = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = W;
  const ctx = cv.getContext('2d');
  composite(ctx, W, state.frame, state, {
    bg: state.bg, captions: true, effect: state.effect,
    hue: state.effect === 'disco' ? (360 * state.frame / NFRAMES) : 0,
  });
  if (state.bg === 'transparent') {
    const data = ctx.getImageData(0, 0, W, W).data;
    return crop(cv, pad(bboxOf([data], W), W));
  }
  return cv;
}

function paintMockup() {
  const mock = makeStickerMockup(state, designCanvas(), 900, 'sticker');
  const main = el('pdpMock');
  main.width = mock.width; main.height = mock.height;
  main.getContext('2d').drawImage(mock, 0, 0);
}

async function boot() {
  el('pdpCut').textContent = state.bg === 'transparent'
    ? '3″×3″ (7.5 cm) vinyl, die-cut along your design’s outline'
    : '3″×3″ (7.5 cm) square vinyl sticker with your design';
  // carry the exact design back to the editor
  const back = el('pdpBack'); if (back) back.href = '/make-a-banana/' + location.search;
  await assetsReady();
  paintMockup();
  track('sticker_pdp_view', { design: designStr(state) });
  const lp = await localizedPrice();
  if (lp) {
    el('pdpPrice').innerHTML = '<small>from</small> ' + lp.display;
    el('pdpNote').textContent = lp.display + ' · free worldwide shipping · tax where applicable';
  }
}
boot();

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
  track('sticker_pdp_checkout', { value: PRICE.amount, currency: PRICE.currency, design: designStr(state) });
  try {
    const { checkoutUrl } = await uploadAndCheckout(renderPrintFile(state));
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
