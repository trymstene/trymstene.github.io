// 🌱 THE FIRST MINUTE IN TOWN — a new banana's arrival, with nothing to read (26 Sep 2026).
//
// Measured on the front door (GA4, 21–26 Sep): 13 newcomers walked into the town and 5 of them found Nib, who opens the
// story. On arrival your own banana was not marked, Nib was one of six by the fountain under a small "!", and the note
// said to talk to him without saying a tap is how. A text tutorial does nothing for a simple web game (Andersen et al.,
// CHI 2012) and a first task should be a sure win, so this says it without a word:
//   · YOU — a gold arrow over your own banana, until your first tap
//   · THREE COINS on the road from where you stand to Nib — the first reward, and the way to him (the homestead's trail)
//   · NIB WAVES at you, until you have met him
// Loaded only by a new banana, only in the town (banana-town.js). Rules: docs/design-library.md §42.
import { passStat, ruleUsed } from '../lib/banana-pass.js';
import { raiseHand } from '../lib/world-social.js';
import ARROW from '../icons/pixelart/arrow-down.svg?raw';

const TRAIL = 3;                 // coins, once per person (worker-pass RULES town.trail: a count of three; the buff cannot double it)
const PAY = 2;                   // each: six coins for walking to Nib, the homestead road's own rate
const DONE = 'tw-welcome-v1';    // the trail is picked up: this device never lays it again
const GRAB = 34;                 // world px: a banana walking over a coin picks it up (the homestead's reach)
// from where a new banana stands (SPAWN 1100,1230) up to where Nib waits for them (the fountain, 1160,985). ⚠️ BESIDE the
// banana, not over it: at a phone's scale the first coin sat on your own head and the arrow over you floated inside the
// trail (seen in the walk). So the trail runs up your right-hand side, 65 world pixels apart (a coin is a fixed 22 CSS px,
// so on the smallest phones they must still not touch), and stops short of Nib's feet.
const COINS = [[1145, 1150], [1150, 1085], [1155, 1020]];
const WAVE_EVERY = 3600;

// the pack's arrow, gold with a one-pixel outline: the look of the social layer's hand
const ARROW_D = (String(ARROW).match(/ d="([^"]+)"/) || [])[1] || '';
let arrowSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 26 26" shape-rendering="crispEdges">';
for (const t of ['-1 0', '1 0', '0 -1', '0 1']) arrowSvg += '<path fill="#111" transform="translate(' + t + ')" d="' + ARROW_D + '"/>';
arrowSvg += '<path fill="#ffe135" d="' + ARROW_D + '"/></svg>';

const CSS = `
.tww-coin { position:absolute; width:22px; height:22px; transform:translate(-50%,-50%); pointer-events:none;
  background:url(/assets/banana-stand/coin-spin.png) 0 0/132px 22px no-repeat; image-rendering:pixelated;
  filter:drop-shadow(0 0 4px rgba(255,225,53,.8)) drop-shadow(0 2px 1px rgba(20,40,10,.3)); animation:twwSpin .9s steps(6) infinite; }
@keyframes twwSpin { to { background-position:-132px 0; } }
.tww-you { position:absolute; left:50%; top:27%; width:26%; transform:translate(-50%,-100%); pointer-events:none; image-rendering:pixelated; animation:twwBob .9s ease-in-out infinite; }
@keyframes twwBob { 50% { transform:translate(-50%,-80%); } }
@media (prefers-reduced-motion:reduce) { .tww-coin { animation:none; background:url(/assets/banana-stand/coin.png) 0 0/22px 22px no-repeat; } .tww-you { animation:none; } }
`;

export function bootTownWelcome(ctx) {
  const { world, me, pos, W, H, pct, float, track, refresh } = ctx;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  track('town_welcome');

  // 👤 YOU, until the first tap anywhere (the town and the social layer both take taps in their own ways, so the
  // document hears it first)
  const you = document.createElement('img');
  you.className = 'tww-you';
  you.alt = '';
  you.src = 'data:image/svg+xml,' + encodeURIComponent(arrowSvg);
  if (me) me.appendChild(you);
  const dropYou = () => { you.remove(); document.removeEventListener('pointerdown', dropYou, true); };
  document.addEventListener('pointerdown', dropYou, true);

  // 🪙 the coins still owed to this person (the server's own count), whatever happened on another device
  let owed = 0;
  try { owed = localStorage.getItem(DONE) ? 0 : Math.max(0, TRAIL - (ruleUsed('town:trail').n || 0)); } catch (e) {}
  const coins = COINS.slice(TRAIL - owed).map(([x, y], i) => {
    const el = document.createElement('div');
    el.className = 'tww-coin';
    el.style.left = pct(x, W);
    el.style.top = pct(y, H);
    el.style.zIndex = String(100 + y);
    el.style.animationDelay = (i * 0.13) + 's';   // desynced spins
    world.appendChild(el);
    return { x, y, el };
  });
  if (!owed) { try { localStorage.setItem(DONE, '1'); } catch (e) {} }

  // 👋 NIB WAVES, until you have met him (the story's own record: bwq-c1 opens at his first scene), or stand beside him
  const met = () => { try { const q = JSON.parse(localStorage.getItem('bwq-c1') || 'null') || {}; return !!(q.in || q.s > 0 || q.done); } catch (e) { return true; } };
  const nibEl = () => world.querySelector('.tw-npc[data-k="nib"]:not([hidden])');
  let waveAt = performance.now() + 1500;
  const bornAt = performance.now();

  const timer = setInterval(() => {
    const now = performance.now();
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (Math.hypot(c.x - pos.x, c.y - pos.y) > GRAB) continue;
      c.el.remove();
      coins.splice(i, 1);
      passStat('coins_earned', PAY, 'trail');
      if (float) { const n = document.createElement('span'); n.innerHTML = '<img src="/assets/banana-stand/coin.png" width="14" height="14" style="vertical-align:-2px" alt=""> +' + PAY; float(c.x, c.y - 24, n); }
      if (refresh) refresh();
      dropYou();
      if (!coins.length) { try { localStorage.setItem(DONE, '1'); } catch (e) {} track('town_trail_done'); }
    }
    const nib = nibEl();
    const near = nib && Math.hypot(parseFloat(nib.style.left) / 100 * W - pos.x, parseFloat(nib.style.top) / 100 * H - pos.y) < 150;
    if (nib && now > waveAt && !near && !met()) { raiseHand(nib); waveAt = now + WAVE_EVERY; }
    if (!coins.length && (met() || now - bornAt > 180000)) clearInterval(timer);   // all picked up, and Nib found or given up on
  }, 100);

  return { seam: { coins: () => coins.map((c) => ({ x: c.x, y: c.y })), you: () => !!you.isConnected, owed: () => owed } };
}
