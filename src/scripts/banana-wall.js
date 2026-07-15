// THE WALL — the place's memory. Renders the curated creations from
// src/data/wall.json (server-rendered markup carries kind+params in data
// attributes; this script only draws). Bananas dance off the shared wall
// clock — the whole gallery moves together, like the rave. Forge emojis
// animate on their own frame delays.
//
// CLIENT-ONLY (imports the engines).
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S } from '../lib/banana-engine.js';
import { forgeParse, forgeDrawFrame } from '../lib/forge-format.js';

const frames = [...document.querySelectorAll('.wl-frame[data-kind]')];
if (frames.length) init();

function outfitFrom(params) {
  const p = new URLSearchParams(params);
  const extras = {};
  (p.get('ex') || '').split('.').forEach((id) => { if (id) extras[id] = true; });
  return {
    hat: p.get('h') || 'none',
    glasses: p.get('g') || 'none',
    extras,
    effect: p.get('e') || 'none',
    bg: p.get('bg') || 'transparent',
    top: p.get('t') || '',
    bottom: p.get('b') || '',
  };
}

function init() {
  const pieces = frames.map((f) => {
    const cv = f.querySelector('canvas');
    const kind = f.dataset.kind;
    const params = f.dataset.params || '';
    if (kind === 'emoji') {
      const d = forgeParse(params);
      if (!d) return null;
      cv.width = cv.height = d.size;
      return { kind, cv, ctx: cv.getContext('2d'), data: d, idx: 0, last: 0 };
    }
    cv.width = cv.height = 200;
    return { kind, cv, ctx: cv.getContext('2d'), outfit: outfitFrom(params) };
  }).filter(Boolean);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastIdx = -1;

  function tick(now) {
    const cycleMs = BASE_CYCLE_S * 1000;
    const idx = reduced ? 2 : Math.floor((Date.now() % cycleMs) / (cycleMs / NFRAMES));
    for (const p of pieces) {
      if (p.kind === 'banana') {
        if (idx !== lastIdx) {
          drawComposite(p.ctx, 200, idx, {
            bg: p.outfit.bg, captions: !!(p.outfit.top || p.outfit.bottom),
            hat: p.outfit.hat, glasses: p.outfit.glasses, extras: p.outfit.extras,
            top: p.outfit.top, bottom: p.outfit.bottom, effect: p.outfit.effect,
          });
        }
      } else if (!reduced) {
        if (now - p.last >= p.data.delays[p.idx]) {
          p.last = now;
          p.idx = (p.idx + 1) % p.data.frames.length;
          p.ctx.clearRect(0, 0, p.data.size, p.data.size);
          forgeDrawFrame(p.ctx, p.data.frames[p.idx], p.data.size, 1, 1, p.data.palette);
        }
      } else if (!p.drawn) {
        p.drawn = true;
        forgeDrawFrame(p.ctx, p.data.frames[0], p.data.size, 1, 1, p.data.palette);
      }
    }
    if (idx !== lastIdx) lastIdx = idx;
    requestAnimationFrame(tick);
  }

  assetsReady().then(() => requestAnimationFrame(tick));
}
