// 🧪 WEARABLES REVIEW — draws each preview candidate: the sprite alone
// (inline SVG from the engine's art dict) and the dancing banana wearing it
// (the wall page's shared-clock render pattern). CLIENT-ONLY.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S, SVG } from '../lib/banana-engine.js';

const rows = [...document.querySelectorAll('.dw-row[data-id]')];
if (rows.length) init();

function init() {
  const pieces = rows.map((row) => {
    const spriteBox = row.querySelector('.dw-sprite');
    const art = row.dataset.art;
    spriteBox.innerHTML = SVG[art] || '<em>?</em>';
    const cv = row.querySelector('canvas');
    const slot = row.dataset.slot;
    const id = row.dataset.id;
    const outfit = {
      bg: 'transparent', captions: false,
      hat: slot === 'hat' ? id : 'none',
      glasses: slot === 'glasses' ? id : 'none',
      extras: slot === 'extra' ? { [id]: true } : {},
      effect: 'none', top: '', bottom: '',
    };
    return { ctx: cv.getContext('2d'), outfit };
  });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastIdx = -1;
  function tick() {
    const cycleMs = BASE_CYCLE_S * 1000;
    const idx = reduced ? 2 : Math.floor((Date.now() % cycleMs) / (cycleMs / NFRAMES));
    if (idx !== lastIdx) {
      lastIdx = idx;
      for (const p of pieces) drawComposite(p.ctx, 200, idx, p.outfit);
    }
    requestAnimationFrame(tick);
  }
  assetsReady().then(() => requestAnimationFrame(tick));
}
