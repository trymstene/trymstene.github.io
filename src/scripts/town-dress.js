// 👕 THE DRESSING ROOM — the clothes shop's card (Trym, 20 Sep 2026).
//
// "when a banana clicks the building a popup opens where users can dress their banana in the same way
// as on Make A Banana but more visually adapted to banana world … just a dressing room basically."
//
// ⭐ IT IS A CARD, NOT A ROOM AND NOT A TRAY. A room in this world is a walk-in plate you leave by
// stepping back onto the doorway (design library §22) and it is only worth its art when there is
// something to DO in there; this shop has one verb. A tray is out because the bottom of the screen
// already has two (§25: the pocket at z 901 and the café counter at z 1200) and a wardrobe does not fit
// in 150 px. So: the town's one card, filled the way every other card in the town is filled.
//
// ⭐ THE CARD IS TWO ZONES, PINNED AND SCROLLING, which no other town card does. Every card in the town
// is one block-flow column inside `overflow:auto`, so a tall one just scrolls — and for a dressing room
// that is fatal, because the whole point is watching the banana change while you pick. The mirror is
// pinned at the top and only the rails under it scroll.
//
// ⚠️ 261 × 440 CSS px. That is the measured content box of a town card at 360×640, the narrowest phone
// the house supports — not 380, which is the desktop max-width. Anything designed to a wider number is
// designed for a phone nobody tests.
//
// ⚠️ NOTHING HERE OWNS THE RULES ABOUT WHAT MAY BE WORN. Those are src/lib/wardrobe-slots.js, shared, so
// that the shop, the builder and the world cannot start disagreeing about what you own. This file is
// the picture and the thumb.
import { drawComposite, assetsReady, imgFor, SVG } from '../lib/banana-engine.js';
import { slots, readWorn, writeWorn, drawable } from '../lib/wardrobe-slots.js';
import { passPush } from '../lib/banana-pass.js';

// ⭐ THE WORDS ARE GLOBBED HERE, inside the shop's own lazy chunk — not onto town-life.json, which is
// eager-globbed into town-room.js. A player who never opens the wardrobe downloads none of them.
const COPY_MODS = import.meta.glob('../data/copy/town-dress.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

const CV = 180;              // the preview's drawing buffer; CSS scales it, the arcade's own grammar
const STAGE = 150;           // the mirror's height in CSS px — the tallest that leaves the rails room
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function bootTownDress(ctx) {
  const { openCard, card, closeCard, track } = ctx;
  let raf = 0, worn = null, cv = null, g = null, t0 = 0, saved = false;

  // ── the mirror ──────────────────────────────────────────────────────────────────────────────────
  // ⚠️ drawComposite wants a WHOLE outfit or it throws on the first extra it looks for, and every
  // banana after it silently never draws. `drawable()` is that literal, in one place.
  function paint(now) {
    raf = 0;
    if (!g || !worn) return;
    if (!t0) t0 = now;
    // the same four-frame walk the square uses, slowed: a banana turning in a mirror, not dancing
    const f = Math.floor(((now - t0) / 380) % 4);
    g.clearRect(0, 0, CV, CV);
    try { drawComposite(g, CV, f, drawable(worn)); } catch (e) {}
    raf = requestAnimationFrame(paint);
  }
  const wake = () => { if (!raf && g) raf = requestAnimationFrame(paint); };
  const sleep = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  // ── the rails ───────────────────────────────────────────────────────────────────────────────────
  // one rail per slot, each a horizontal scroller. ⚠️ a grid would be the obvious shape and it is the
  // wrong one: 261 px holds five 44 px targets across, and the extras alone run past forty — a grid of
  // forty is a wall of thumbnails that pushes the mirror off the top of the card on the first scroll.
  function rail(sl) {
    const w = worn[sl.key];
    // ⭐ BODY AND SHOES LIVE IN `extras` AND PICK LIKE A HAT. The builder does exactly this and says
    // why: one garment on the body, one pair on the feet. So `on` asks the saved outfit where the
    // slot actually keeps it, and `kind` says only how a tap behaves.
    const on = (it) => (sl.kind === 'one' ? w === it.id : !!(worn.extras || {})[it.id]);
    // ⚠️ THE ROW'S NAME IS NOT COPY. It is Make A Banana's own word, held in wardrobe-slots.js so
    // the builder and this room cannot drift apart (Trym, 20 Sep: "why isnt it Shades, Hats, Body,
    // Shoes, Extras like in the original Make A Banana for consistency?"). The copy file still carries
    // them so the game imports one file, but as a LOCKED section the rig may not redraft.
    const label = sl.label || '';
    return '<div class="tw-dress__rail">'
      + (label ? '<b class="tw-dress__of">' + esc(label) + '</b>' : '')
      + '<div class="tw-dress__row" role="group"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '>'
      + sl.items.map((it) => '<button type="button" class="tw-dress__chip'
        + (on(it) ? ' is-on' : '') + (it.locked ? ' is-locked' : '')
        + '" data-sl="' + esc(sl.key) + '" data-id="' + esc(it.id) + '"'
        + ' aria-pressed="' + (on(it) ? 'true' : 'false') + '"'
        + ' title="' + esc(it.label + (it.locked ? ' — ' + ((COPY.locked || '').replace('{where}', it.door.at)) : '')) + '">'
        + '<i class="tw-dress__art" data-art="' + esc(it.art) + '"></i>'
        + (it.locked ? '<i class="tw-dress__lock" aria-hidden="true"></i>' : '')
        + '</button>').join('')
      + '</div></div>';
  }

  // ⚠️ the chip art is SET FROM JS, never from a CSS url(): a wearable's picture is either an inline
  // pixel-SVG string or a real file, and only imgFor() knows which (src/lib/banana-engine.js). Packing
  // that into a stylesheet is how a chip ends up empty for exactly the items that were packed.
  function art(host) {
    host.querySelectorAll('.tw-dress__art').forEach((e) => {
      const k = e.dataset.art;
      if (!k) { e.classList.add('is-none'); return; }
      // ⚠️ imgFor() TAKES THE ART STRING, NOT THE KEY. SVG[k] is the packed pixel-SVG (or a real URL for
      // the few that are photographs); handing it the key name instead returns an Image pointing at a
      // path that does not exist, which renders as an empty chip with no error anywhere.
      const art = SVG[k];
      if (!art) { e.classList.add('is-none'); return; }
      const src = (imgFor(art) || {}).src;
      if (src) e.style.backgroundImage = 'url("' + src + '")';
    });
  }

  function html() {
    const w = COPY;
    return '<div class="tw-dress">'
      + (w.title ? '<h2>' + esc(w.title) + '</h2>' : '')
      + '<div class="tw-dress__stage"><canvas id="twDressCv" width="' + CV + '" height="' + CV + '" aria-label="' + esc(w.alt || '') + '"></canvas></div>'
      + '<div class="tw-dress__rails">' + slots().map(rail).join('') + '</div>'
      + (w.line ? '<p class="tw-card__sub">' + esc(w.line) + '</p>' : '')
      + '<button type="button" class="tw-cta tw-dress__ok" id="twDressOk"><span class="tw-cta__verb">' + esc(w.confirm || '') + '</span></button>'
      + '</div>';
  }

  function redraw() {
    const host = card.querySelector('.tw-dress__rails');
    if (!host) return;
    host.innerHTML = slots().map(rail).join('');
    art(host);
    wire(host);
  }

  function wire(host) {
    host.querySelectorAll('.tw-dress__chip').forEach((b) => b.addEventListener('click', () => {
      const sl = b.dataset.sl, id = b.dataset.id;
      // ⭐ A LOCKED CHIP IS A DOOR, NOT A REFUSAL. You are shown the thing you have not caught yet
      // BECAUSE seeing it is how you learn it exists — so a tap on one goes where it is caught.
      if (b.classList.contains('is-locked')) {
        const it = slots().find((x) => x.key === sl).items.find((x) => x.id === id);
        track('town_dress', { at: 'clothes', step: 'locked', id });
        if (it && it.door) location.href = it.door.href;
        return;
      }
      const row = slots().find((x) => x.key === sl) || { kind: 'many', items: [] };
      if (row.kind === 'one') {
        worn = { ...worn, [sl]: worn[sl] === id ? 'none' : id };   // tapping the worn one takes it off
      } else {
        const ex = { ...(worn.extras || {}) };
        const had = !!ex[id];
        // ⚠️ A SINGLE-SELECT ROW CLEARS ITS OWN SIBLINGS, AND ONLY ITS OWN. Body and shoes are kept in
        // the same `extras` bag as the balloons, so "one at a time" has to be enforced against THAT
        // ROW's items rather than against the bag — clearing the bag would take the party hat off too.
        if (row.kind === 'one-of') for (const it of row.items) delete ex[it.id];
        if (had) delete ex[id]; else ex[id] = true;   // and tapping the worn one takes it off, in both
        worn = { ...worn, extras: ex };
      }
      // ⭐ THE MIRROR CHANGES; NOTHING IS SAVED UNTIL YOU SAY SO. Trym, 20 Sep: "theres no Confirm
      // button at the end of the popup for UX? Its not logical that the user can click outside the
      // window and then the attire is saved." A changing room where walking out commits whatever you
      // happened to be holding is not a changing room. Every pick is a DRAFT: the only writeWorn in
      // this file is on the Confirm button, and closing any other way leaves `bb-last` exactly as it
      // was found — which is why `open()` never wrote either.
      track('town_dress', { at: 'clothes', step: 'try', sl });
      redraw();
      wake();
    }));
  }

  function open() {
    worn = readWorn();
    saved = false;
    openCard(html());
    card.classList.add('tw-card--dress');
    card.scrollTop = 0;   // ⚠️ openCard never resets it, so a tall card before this one leaves it scrolled
    cv = document.getElementById('twDressCv');
    g = cv ? cv.getContext('2d') : null;
    t0 = 0;
    const host = card.querySelector('.tw-dress__rails');
    if (host) { art(host); wire(host); }
    const ok = card.querySelector('#twDressOk');
    if (ok) ok.addEventListener('click', () => {
      // writeWorn MERGES, so a community item caught at the rave cannot be taken off by dressing here
      writeWorn(worn, passPush);
      saved = true;
      if (ctx.onWear) ctx.onWear();
      track('town_dress', { at: 'clothes', step: 'wear' });
      closeCard();
    });
    // the engine's art may still be loading on a cold open: paint once it is, and once now either way
    assetsReady().then(() => { wake(); }).catch(() => {});
    wake();
    track('town_dress', { at: 'clothes', step: 'open' });
    return true;
  }

  return { open, stop: sleep, seam: { open, worn: () => worn, saved: () => saved, slots: () => slots().map((s) => ({ key: s.key, n: s.items.length, locked: s.items.filter((i) => i.locked).length })), pick: (sl, id) => { const b = card.querySelector('.tw-dress__chip[data-sl="' + sl + '"][data-id="' + id + '"]'); if (b) b.click(); return !!b; } } };
}
