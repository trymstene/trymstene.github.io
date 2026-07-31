// 🎨 /shop/ CUSTOM LANE — paints the visitor's OWN banana onto the custom tiles,
// as the actual product.
//
// The shop is where people arrive intending to buy, but it only sold the
// official line — someone who wanted THEIR banana on a tee had to know the
// builder existed. The lane fixes that, and a tile showing a stranger's banana
// would undersell it, so each tile shows theirs.
//
// ⚠️ IT MUST BE THE REAL MOCKUP. v1 of this drew a bare banana on a checkerboard
// while the official tiles beside it had Printful photo shoots — next to real
// merch that reads as a placeholder, and nobody clicks a placeholder. Everything
// here goes through productMockup(), the same call the product page makes, so a
// tile can never promise something its own PDP then fails to match.
//
// ⚠️ LOADED LAZILY ON PURPOSE. This pulls the sprite engine and the sticker
// brain onto a page that is otherwise nearly JS-free, so the import only happens
// when the lane actually scrolls into view. Most shop visits never reach it.
import { assetsReady } from '../lib/banana-engine.js';
import { productMockup, TEE_QUADS, ensureCaptionFont } from '../lib/sticker-core.js';
import PRODUCTS from '../../shared/products.js';

const BY_KEY = Object.fromEntries(PRODUCTS.map((p) => [p.key, p]));

function myOutfit() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem('bb-last') || 'null'); } catch (e) {}
  const mine = !!(o && typeof o === 'object');
  const fit = mine ? o : { hat: 'party', glasses: 'shades', extras: { bowtie: true } };
  return {
    hat: fit.hat || 'none', glasses: fit.glasses || 'none',
    extras: fit.extras || {}, c: fit.c,
    // no captions on a tile: bb-last does not carry them, and inventing one
    // would show a product the visitor never asked for
    top: '', bottom: '', captions: false,
    effect: 'none', bg: 'transparent', frame: 3,   // the open-armed "ta-da" pose
    mine,
  };
}

// the apparel shoot, so the tee tile is a photo like its official neighbours
// rather than the fallback pixel garment
function teePhoto(onLoad) {
  const img = new Image();
  img.onload = onLoad;
  img.src = '/assets/tee/tee-woman-white.jpg';
  return img;
}

export async function paintLane(root) {
  const slots = [...root.querySelectorAll('[data-custom-preview]')];
  if (!slots.length) return;
  const state = myOutfit();
  await assetsReady();
  await ensureCaptionFont(state);

  const paint = (slot, product, photo) => {
    try {
      const cv = productMockup(state, product, 420, {
        colorHex: '#ffffff',
        photo: product.options ? photo : null,
        quad: product.options ? TEE_QUADS.woman : null,
      });
      cv.className = 'shopcustom__cv';
      slot.replaceChildren(cv);
    } catch (e) { /* a tile is decoration; never take the shop down for one */ }
  };

  let photo = null;
  const apparel = slots.some((s) => (BY_KEY[s.closest('[data-custom]').dataset.custom] || {}).options);
  if (apparel) {
    // the photo arrives late; repaint the apparel tiles when it does rather
    // than blocking every other tile on one JPEG
    photo = teePhoto(() => slots.forEach((slot) => {
      const p = BY_KEY[slot.closest('[data-custom]').dataset.custom];
      if (p && p.options) paint(slot, p, photo);
    }));
  }
  for (const slot of slots) {
    const p = BY_KEY[slot.closest('[data-custom]').dataset.custom];
    if (p) paint(slot, p, photo);
  }

  // only claim it's theirs when it actually is — the fallback is a demo banana
  if (state.mine) root.querySelectorAll('[data-custom-yours]').forEach((e) => { e.hidden = false; });
}
