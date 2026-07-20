// 🍌🏪 THE BANANA STAND — the shopkeeper and his very limited patience.
// The keeper is the dancing banana, off duty: front frames 3↔7 (the low-arm
// sway pair) on a slow interval — he still moves, he's just DONE. Tired
// half-lidded eyes ride the engine's custom channel; the coffee mug is the
// existing wearable. Deliberately setInterval, not rAF: two draws every
// couple of seconds need no frame budget (and stay verifiable in panes).
import { drawComposite, assetsReady } from '../lib/banana-engine.js';

const cv = document.getElementById('bsKeeperCv');
if (cv) init();

function init() {
  const ctx = cv.getContext('2d');

  // tired eyelids, fitted to the MEASURED eye whites of frame 3 (units rel.
  // the face anchor: left eye x −4.6…−1.4, right −0.5…2.9, both y −1.0…2.3).
  // Lids drop over the top ~60% of each eye, dark lash line, a sliver of
  // white left showing, muted bags underneath. 10 svg-px per unit.
  const LIDS =
    '<svg viewBox="0 0 75 41" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="0" y="0" width="32" height="19" fill="#ffe135"/>' +
    '<rect x="41" y="0" width="34" height="19" fill="#ffe135"/>' +
    '<rect x="0" y="19" width="32" height="4" fill="#111111"/>' +
    '<rect x="41" y="19" width="34" height="4" fill="#111111"/>' +
    '<rect x="8" y="34" width="18" height="6" fill="#9e94b8"/>' +
    '<rect x="49" y="34" width="18" height="6" fill="#9e94b8"/>' +
    '</svg>';

  // frame 3 and frame 7 are the two low-arm FRONT frames with opposite body
  // sway — alternating them slowly reads as an exhausted shuffle
  const SWAY = [3, 7];
  let idx = 0;

  const outfit = {
    hat: 'none', glasses: 'none', top: '', bottom: '', bg: 'transparent',
    captions: false, effect: 'none',
    extras: { mug: true }, // the coffee is load-bearing
    custom: { art: LIDS, anchor: 'face', ox: -4.6, oy: -1.0, scale: 1 },
  };

  const draw = () => drawComposite(ctx, 360, SWAY[idx % 2], outfit);
  assetsReady().then(() => {
    draw();
    // redraw belt: the lids + mug decode async and drawAcc skips silently
    setTimeout(draw, 500);
    setTimeout(draw, 1600);
    setInterval(() => { idx++; draw(); }, 1600);
  });

  // ---- the bubble: tired one-liners, never angry, never sad --------------
  const LINES = [
    'welcome to the banana stand.',
    "we're restocking. i've been dancing since 1999 — give me a minute.",
    "that one's not for sale yet.",
    'the grand opening is soon. probably.',
    "the truck hasn't come. the truck never comes on time.",
    "there's always money in the banana stand. just… not today.",
    'i used to dance, you know.',
  ];
  const SIP = '*sips coffee*';
  const bubble = document.getElementById('bsBubble');
  let lineIdx = 0, bubbleTimer = null;
  function say(text) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('is-on');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('is-on'), 3200);
  }
  const hooks = document.getElementById('bsHooks');
  if (hooks) hooks.addEventListener('click', (e) => {
    if (!e.target.closest('.bs-hook')) return;
    say(LINES[lineIdx % LINES.length]);
    lineIdx++;
  });
  const keeper = document.getElementById('bsKeeper');
  if (keeper) keeper.addEventListener('click', () => say(SIP));

  say(LINES[0]); lineIdx = 1; // the greeting
}
