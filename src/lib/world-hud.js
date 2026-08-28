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
import { passGet, coinsNow } from './banana-pass.js';
import { levelFor, gardenerLvlFor, GLVL_AT, GLVL_STARS } from './pass-defs.js';
import { iconSvg } from './pixel-icons.js';

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
.wh .wh__gard { background: none; border: 0; color: inherit; font: inherit; padding: 0;
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.wh .wh__lvlbar--s { width: 16px; }
.wh__gardart { height: 15px; width: auto; image-rendering: pixelated; }
/* 🧑‍🌾 the gardener card BODY — one game-style stat block, shared by the park
   panel and the homestead card. THE STAT IS THE VISUAL (a big number under a
   small-caps label), then one bar to the NEXT rung, then one line naming what
   that rung unlocks. Nothing else — no tier table (Trym, 28 Aug: no game
   lists every unreached level). */
.whg { text-align: center; padding: 0.3rem 0 0.1rem; }
.whg__art { width: 34px; height: auto; image-rendering: pixelated; }
.whg__label { margin: 0.25rem 0 0; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.65; }
.whg__num { margin: 0; font-family: "Archivo Black", "Space Grotesk", sans-serif; font-size: 2.7rem; line-height: 1.05; }
.whg__bar { width: min(220px, 82%); height: 10px; margin: 0.5rem auto 0.35rem; background: rgba(0, 0, 0, 0.45); border: 2px solid rgba(0, 0, 0, 0.55); border-radius: 4px; overflow: hidden; }
/* ⚠️ the card renders OUTSIDE .wh — the accent var needs its fallback */
.whg__bar i { display: block; height: 100%; background: var(--wh-accent, #ffe14d); }
.whg__count { margin: 0 0 0.55rem; font-size: 0.8rem; opacity: 0.8; }
.whg__next { margin: 0; font-size: 0.88rem; font-weight: 700; }
.whg__next svg { vertical-align: -2px; color: #ffd23f; }
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

// The wallet, derived not stored: earned + refunded − spent. Every counter is
// monotonic (see the ledger note in banana-pass.js), so refunds add rather than
// subtract. Exported because areas need the same number the strip shows; a
// second reader is how a HUD and a shop start disagreeing about your money.
// ⚠️ NO Math.max(0, …) HERE: clamping hid an overdraft as an empty purse, and
// every coin earned afterwards silently filled the hole instead of appearing.
// passSpend() refuses to dig one; if a negative ever shows up it is a bug and
// must be visible, not swallowed.
export const coinBalance = () => coinsNow();

/**
 * @param mount   the element the strip goes in (a map wrapper for 'overlay')
 * @param layout  'overlay' (default, over the map) | 'strip' (an in-flow band)
 * @param theme   { bg, border, text, accent } — any subset
 * @param chips   which to build, in order: 'lvl' 'coins' 'tix' 'slot' 'crowd'
 *                + 'gardener' — AREA-LOCAL (park + homestead opt in; the JELLY
 *                rule): 🧑‍🌾 level with a mini per-harvest fill, tap = onGardener
 * @param values  getters for what the pass cannot answer, e.g. { tix: () => n }
 * @param adopt   EXISTING nodes to place in the strip instead of building them.
 *                ⚠️ this is the club's path: its engine owns rvLvlRow/rvCount/
 *                rvStatus and writes to them from six places, so the HUD takes
 *                the nodes rather than the job. Same container, same CSS, same
 *                look — without rewriting the floor.
 * @returns { el, refresh, setCrowd, setSlot, stop }
 */
export function mountHud({ mount, layout = 'overlay', theme = {}, chips = ['lvl', 'coins', 'crowd'],
                          values = {}, adopt = [], onGardener = null } = {}) {
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
    } else if (c === 'gardener') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wh__gard';
      b.setAttribute('aria-label', 'Your gardener level');
      // pack art, never an OS emoji (Trym, 28 Aug — the doctrine exists for a
      // reason and this chip shipped violating it): the park's own sprout
      b.innerHTML = '<img class="wh__gardart" src="/assets/park/g-sprout2.png" alt="" />'
        + '<b>1</b><span class="wh__lvlbar wh__lvlbar--s"><i></i></span>';
      if (onGardener) b.addEventListener('click', onGardener);
      el.appendChild(b);
      made.gard = b;
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
  const gardN = made.gard && made.gard.querySelector('b');
  const gardFill = made.gard && made.gard.querySelector('.wh__lvlbar i');

  function refresh() {
    const s = passGet().stats || {};
    if (lvlN) {
      const lv = levelFor(s.rep || 0);
      lvlN.textContent = 'LVL ' + lv.level;
      if (lvlFill) lvlFill.style.width = Math.round((lv.into / lv.need) * 100) + '%';
    }
    if (coinN) coinN.textContent = coinBalance();
    if (gardN) {
      const g = gardenerLvlFor(s.garden_harvests || 0);
      gardN.textContent = g.lvl;
      if (gardFill) gardFill.style.width = (g.nextAt == null ? 100
        : Math.round(((g.n - g.prevAt) / (g.nextAt - g.prevAt)) * 100)) + '%';
    }
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

// the gardener card BODY (see the .whg CSS above) — each area wraps it in its
// own panel. `g` comes from gardenerLvlFor().
export function gardenerCardHtml(g) {
  injectCss();
  const top = g.nextAt == null;
  const nextIsExotic = !top && g.lvl + 1 === GLVL_AT.length;
  const pct = top ? 100 : Math.round(((g.n - g.prevAt) / (g.nextAt - g.prevAt)) * 100);
  return '<div class="whg">'
    + '<img class="whg__art" src="/assets/park/g-sprout2.png" alt="" />'
    + '<p class="whg__label">gardener</p>'
    + '<p class="whg__num">' + g.lvl + '</p>'
    + (top
      ? '<p class="whg__next">top of the ladder — every seed is yours</p>'
      : '<div class="whg__bar"><i style="width:' + pct + '%"></i></div>'
        + '<p class="whg__count">' + g.n + ' / ' + g.nextAt + ' harvests</p>'
        + '<p class="whg__next">next: ' + (nextIsExotic ? 'the exotic tier'
          : 'seeds up to ' + iconSvg('star', { size: 13 }).repeat(GLVL_STARS[g.lvl])) + '</p>')
    + '</div>';
}
