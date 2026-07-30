// 🎨 /shop/ CUSTOM LANE — paints the visitor's OWN banana onto the custom tiles.
//
// The shop is where people arrive intending to buy (shop_view beats every
// custom-flow event), but until now it only sold the official line — someone who
// wanted THEIR banana on a tee had to know the builder existed. The lane fixes
// that, and a tile showing a stranger's banana would undersell it, so each tile
// shows theirs.
//
// ⚠️ LOADED LAZILY ON PURPOSE. This pulls the sprite engine onto a page that is
// otherwise nearly JS-free, so the import only happens when the lane actually
// scrolls into view. Most shop visits never reach it and pay nothing.
import { drawComposite, assetsReady } from '../lib/banana-engine.js';

function myOutfit() {
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o && typeof o === 'object') return { ...o, mine: true };
  } catch (e) {}
  return { hat: 'party', glasses: 'shades', extras: { bowtie: true }, mine: false };
}

export async function paintLane(root) {
  const slots = [...root.querySelectorAll('[data-custom-preview]')];
  if (!slots.length) return;
  const fit = myOutfit();
  await assetsReady();
  const W = 320;
  for (const slot of slots) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = W;
    cv.className = 'shopcustom__cv';
    drawComposite(cv.getContext('2d'), W, 3, {
      bg: 'transparent', captions: false, top: '', bottom: '',
      hat: fit.hat, glasses: fit.glasses, extras: fit.extras || {}, c: fit.c,
      effect: 'none',
    });
    slot.innerHTML = '';
    slot.appendChild(cv);
  }
  // only claim it's theirs when it actually is — the fallback is a demo banana
  if (fit.mine) {
    root.querySelectorAll('[data-custom-yours]').forEach((e) => { e.hidden = false; });
  }
}
