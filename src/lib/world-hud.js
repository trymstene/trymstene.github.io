// 🌍 THE WORLD HUD — one strip, every area, and every area still to come.
//
// The pill strip (LVL · COINS · [TIX] · CROWD) was written three times: the rave
// invented it, the bay copied it, the park copied the bay. The two copies were
// byte-identical CSS and near-identical JS, which is exactly how three worlds
// stop looking like one world about a month after somebody tweaks one of them.
//
// ⚠️ IT BRINGS ITS OWN CSS, like world-travel.js and for the same reason: a
// WORLD-level widget that has to look identical in the park's greens, the bay's
// sands and the club's neon cannot live as three copies in three .astro files.
// One <style>, injected once. Per-area colour is four custom properties.
//
// ⚠️ LEVEL AND COINS ARE READ FROM THE PASS, NOT PASSED IN. rep and the coin
// wallet are world-wide stats; an area that computed its own would drift from
// the others the first time a rule changed. Anything the pass cannot answer
// (the bay's tickets) comes in through `values`.
import { passGet } from './banana-pass.js';
import { levelFor } from './pass-defs.js';

const CSS = `
.wh {
  display: flex; gap: 5px; align-items: center; justify-content: flex-end;
  flex-wrap: wrap;
  --wh-bg: rgba(14, 22, 14, 0.82);
  --wh-border: #000;
  --wh-text: #fffdf5;
  --wh-accent: #ffe135;
}
/* over the map (park, bay, and the default for anything new) */
.wh--overlay { position: absolute; top: 8px; right: 8px; z-index: 9; max-width: calc(100% - 16px); }
/* an in-flow band above the scene (the club, whose floor is too short to cover) */
.wh--strip { padding: 4px 7px; }
.wh > * {
  margin: 0; height: 27px; box-sizing: border-box; display: flex; align-items: center;
  gap: 5px; background: var(--wh-bg); border: 2px solid var(--wh-border);
  border-radius: 6px; padding: 0 9px; font-weight: 800; font-size: 0.76rem;
  line-height: 1; color: var(--wh-text); white-space: nowrap;
}
.wh__lvl { color: var(--wh-accent); border-color: var(--wh-accent) !important; }
.wh__lvlbar {
  flex: 0 0 42px; min-width: 42px; height: 6px; background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(0, 0, 0, 0.6); border-radius: 3px; overflow: hidden;
}
.wh__lvlbar i { display: block; height: 100%; width: 0; background: var(--wh-accent); transition: width 0.5s ease; }
/* the 44px stand coin smooth-downscaled — pixelated at 16px ate the emboss */
.wh__coins img { display: block; }
.wh__coins b, .wh__tix b { color: var(--wh-accent); }
.wh__crowd { color: #8affc0; }
/* a chip with nothing to say takes no room — the bay's rally line, mostly */
.wh__slot:empty { display: none; }
@media (prefers-reduced-motion: reduce) { .wh__lvlbar i { transition: none; } }
`;

let styled = false;
function injectCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

// The wallet, derived not stored: coins can only ever be REMOVED by writing
// coins_spent (see mergeBlob — stats merge by MAX, so a decrement would not
// survive a sync). Exported because areas need the same number the strip shows;
// a second reader is how a HUD and a shop start disagreeing about your money.
export const coinBalance = () => {
  const s = passGet().stats || {};
  return Math.max(0, (s.coins_earned || 0) - (s.coins_spent || 0));
};

/**
 * @param mount   the element the strip goes in (a map wrapper for 'overlay')
 * @param layout  'overlay' (default, over the map) | 'strip' (an in-flow band)
 * @param theme   { bg, border, text, accent } — any subset
 * @param chips   which to build, in order: 'lvl' 'coins' 'tix' 'slot' 'crowd'
 * @param values  getters for what the pass cannot answer, e.g. { tix: () => n }
 * @param adopt   EXISTING nodes to place in the strip instead of building them.
 *                ⚠️ this is the club's path: its engine owns rvLvlRow/rvCount/
 *                rvStatus and writes to them from six places, so the HUD takes
 *                the nodes rather than the job. Same container, same CSS, same
 *                look — without rewriting the floor.
 * @returns { el, refresh, setCrowd, setSlot, stop }
 */
export function mountHud({ mount, layout = 'overlay', theme = {}, chips = ['lvl', 'coins', 'crowd'],
                          values = {}, adopt = [] } = {}) {
  if (!mount) return null;
  injectCss();

  const el = document.createElement('div');
  el.className = 'wh wh--' + layout;
  if (theme.bg) el.style.setProperty('--wh-bg', theme.bg);
  if (theme.border) el.style.setProperty('--wh-border', theme.border);
  if (theme.text) el.style.setProperty('--wh-text', theme.text);
  if (theme.accent) el.style.setProperty('--wh-accent', theme.accent);

  const made = {};
  const add = (cls, html) => {
    const s = document.createElement('span');
    s.className = 'wh__' + cls;
    s.innerHTML = html;
    el.appendChild(s);
    return s;
  };
  for (const c of chips) {
    if (c === 'lvl') {
      made.lvl = add('lvl', '<span class="wh__lvln">LVL 1</span>'
        + '<span class="wh__lvlbar"><i></i></span>');
    } else if (c === 'coins') {
      made.coins = add('coins', '<img src="/assets/banana-stand/coin.png" width="16" height="16" alt="" />'
        + '<b>0</b>');
    } else if (c === 'tix') {
      made.tix = add('tix', '🎟 <b>0</b>');
    } else if (c === 'slot') {
      made.slot = add('slot', '');
    } else if (c === 'crowd') {
      made.crowd = add('crowd', '<span aria-hidden="true">◍</span> <span class="wh__crowdn">solo</span>');
    }
  }
  adopt.forEach((n) => { if (n) el.appendChild(n); });
  mount.appendChild(el);

  const lvlN = made.lvl && made.lvl.querySelector('.wh__lvln');
  const lvlFill = made.lvl && made.lvl.querySelector('.wh__lvlbar i');
  const coinN = made.coins && made.coins.querySelector('b');
  const tixN = made.tix && made.tix.querySelector('b');
  const crowdN = made.crowd && made.crowd.querySelector('.wh__crowdn');

  function refresh() {
    const s = passGet().stats || {};
    if (lvlN) {
      const lv = levelFor(s.rep || 0);
      lvlN.textContent = 'LVL ' + lv.level;
      if (lvlFill) lvlFill.style.width = Math.round((lv.into / lv.need) * 100) + '%';
    }
    if (coinN) coinN.textContent = coinBalance();
    if (tixN && values.tix) tixN.textContent = values.tix();
  }

  // ⚠️ THE FIRST REFRESH IS DEFERRED ONE TICK, ON PURPOSE. Callers mount this
  // from module scope while their own `const ticketBal = () => …` may still be
  // in the temporal dead zone below. A timeout runs after the caller's module
  // finishes evaluating, so the getters exist by the time they are called.
  setTimeout(refresh, 0);
  // one clock for every area — and it stops while the tab is hidden, like every
  // other loop in this world
  const timer = setInterval(() => { if (!document.hidden) refresh(); }, 1000);

  return {
    el,
    refresh,
    setCrowd: (t) => { if (crowdN) crowdN.textContent = t; },
    setSlot: (t) => { if (made.slot) made.slot.textContent = t || ''; },
    stop: () => clearInterval(timer),
  };
}
