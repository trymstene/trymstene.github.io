// 🧪 WEARABLES REVIEW — draws each preview candidate: the sprite alone
// (inline SVG from the engine's art dict) and the dancing banana wearing it
// (the wall page's shared-clock render pattern). CLIENT-ONLY.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S, SVG } from '../lib/banana-engine.js';

const rows = [...document.querySelectorAll('.dw-row[data-id]')];
// the preview background switcher — grey default so white gear stays visible
const bgBtns = [...document.querySelectorAll('.dw-bg')];
function setBg(hex) {
  document.documentElement.style.setProperty('--dw-bg', hex);
  bgBtns.forEach((b) => b.classList.toggle('is-on', b.dataset.bg === hex));
  try { localStorage.setItem('dw-bg', hex); } catch (e) {}
}
if (bgBtns.length) {
  let saved = '#888888';
  try { saved = localStorage.getItem('dw-bg') || saved; } catch (e) {}
  if (!bgBtns.some((b) => b.dataset.bg === saved)) saved = '#888888';
  setBg(saved);
  bgBtns.forEach((b) => b.addEventListener('click', () => setBg(b.dataset.bg)));
}
if (rows.length) init();

function init() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clockIdx = () => {
    const cycleMs = BASE_CYCLE_S * 1000;
    return reduced ? 2 : Math.floor((Date.now() % cycleMs) / (cycleMs / NFRAMES));
  };
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
    const p = { ctx: cv.getContext('2d'), outfit, paused: false, frame: 0, drawn: -1 };
    // ⏸/▶ + frame stepping — per tile, OUTSIDE the frame box (Trym's QoL:
    // hold a dance frame and walk through all 8 to check anchors)
    const ctrl = row.querySelector('.dw-ctrl');
    const playBtn = ctrl.querySelector('.dw-play');
    const frLabel = ctrl.querySelector('.dw-fr');
    const showFrame = () => { frLabel.textContent = 'frame ' + (p.frame + 1) + '/' + NFRAMES; };
    playBtn.addEventListener('click', () => {
      p.paused = !p.paused;
      if (p.paused) { p.frame = clockIdx(); showFrame(); }
      ctrl.classList.toggle('is-paused', p.paused);
      playBtn.textContent = p.paused ? '▶' : '⏸';
      playBtn.setAttribute('aria-label', p.paused ? 'play' : 'pause');
    });
    ctrl.querySelectorAll('.dw-step').forEach((b) => b.addEventListener('click', () => {
      p.frame = (p.frame + Number(b.dataset.step) + NFRAMES) % NFRAMES;
      showFrame();
    }));
    return p;
  });

  function tick() {
    const idx = clockIdx();
    for (const p of pieces) {
      const want = p.paused ? p.frame : idx;
      if (want !== p.drawn) {
        p.drawn = want;
        drawComposite(p.ctx, 200, want, p.outfit);
      }
    }
    requestAnimationFrame(tick);
  }
  assetsReady().then(() => requestAnimationFrame(tick));
}
