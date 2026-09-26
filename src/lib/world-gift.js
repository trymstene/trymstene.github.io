// 🎁 NIB'S WELCOME PRESENT — handed to a new banana, opened on a later day (26 Sep 2026).
//
// Trym: "i believe in giving secret gifts or mystery chests … users get something others dont have". It is a new
// banana's reason to come back tomorrow (it will not open today) and the "you came back!" when they do. What is inside
// is rolled by the pass worker (/gift): a Banana Stand wearable they do not own yet, rarer the dearer, owned the way a
// purchase is — nothing here chooses it, and nothing here could forge one. It borrows the social layer's card
// (world-social.js loads this chunk only for somebody it can concern). Rules: docs/design-library.md §42.
import { HAT_BY_ID, SHADE_BY_ID, EXTRA_DEFS } from './banana-engine.js';
import { ensureAnon, passPost, walletKeep, passPush } from './banana-pass.js';
import { fillWords } from './fill-words.js';
import GIFT from '../icons/pixelart/gift-solid.svg?raw';
import W from '../data/copy/world-social.json';

const G = W.gift;
const GIVE_AFTER = 45000;   // not at the door: a newcomer who has been here two seconds has not met anybody yet
const day = (t) => new Date(t).toISOString().slice(0, 10);
const EXTRA = Object.fromEntries(EXTRA_DEFS.map((x) => [x.id, x]));
const icon = String(GIFT).replace('<svg ', '<svg class="bwg-ico" width="18" height="18" shape-rendering="crispEdges" aria-hidden="true" ');

// the outfit saved, with one more piece on: a hat or glasses replace their own; a thing worn on the feet or the body
// replaces what was there (the park stand's own rule); a thing held joins the hands and the engine sorts the hands
function withItem(o, id) {
  const out = { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: { ...(o.extras || {}) } };
  if (!id) return out;
  if (HAT_BY_ID[id]) out.hat = id;
  else if (SHADE_BY_ID[id]) out.glasses = id;
  else {
    const d = EXTRA[id] || {};
    for (const k of Object.keys(out.extras)) {
      const e = EXTRA[k];
      if (e && ((d.anchor === 'feet' && e.anchor === 'feet') || (d.zone === 'body' && e.zone === 'body'))) delete out.extras[k];
    }
    out.extras[id] = true;
  }
  return out;
}
const saved = () => { try { return JSON.parse(localStorage.getItem('bb-last') || 'null') || {}; } catch (e) { return {}; } };

export function bootGift(s) {
  const { area, read, write, track, esc, showCard, closeCard, portrait, DRAW, NIB, myName, busy } = s;
  let g = read().g || null;

  // 🎁 handed over once, a while into the first visit, and never over a card that is up
  function give() {
    if (read().g) return;
    if (busy() || document.hidden) { setTimeout(give, 8000); return; }
    ensureAnon().catch(() => false).then(() => passPost('/gift', { act: 'give' })).then((r) => {
      if (!r || !r.gift) { if (r && r.error === 'old') write({ g: { none: 1 } }); return; }
      g = { at: r.gift.at, o: r.gift.opened ? 1 : 0, item: r.gift.item || '' };
      write({ g });
      if (g.o) return;
      track('gift_give', { area });
      const c = showCard(G.give, '<h2><span class="bws-nm">' + esc(G.give) + '</span></h2>'
        + '<p class="bws-say">' + icon + ' ' + esc(G.from) + '</p>'
        + '<div class="bws-row"><button type="button" class="bws-go">' + esc(G.thanks) + '</button></div>');
      portrait(c.querySelector('canvas'), DRAW(NIB));
      c.querySelector('.bws-go').addEventListener('click', closeCard);
    });
  }

  // 🎉 a later day: it opens by itself, once — the "you came back!" is the whole point of the wait
  function open() {
    if (busy() || document.hidden) { setTimeout(open, 6000); return; }
    passPost('/gift', { act: 'open' }).then((r) => {
      if (!r || !r.gift || r.error === 'early') return;   // this phone's clock ran ahead of the server's day: later, then
      if (!r.gift.opened) return;
      walletKeep(r);   // the server says they own it now: the device takes its word (the purchase path, reconcileOwn)
      g = { at: r.gift.at, o: 1, item: r.gift.item || '' };
      write({ g });
      track('gift_open', { area, item: g.item || 'none' });
      reveal(g.item);
    });
  }
  function reveal(id) {
    const def = HAT_BY_ID[id] || SHADE_BY_ID[id] || EXTRA[id];
    const label = (def && def.label) || id;
    const nm = myName();
    const c = showCard(G.back, '<h2><span class="bws-nm">' + esc(nm ? fillWords(G.backName, { name: nm }) : G.back) + '</span></h2>'
      + '<p class="bws-role">' + esc(G.nib) + '</p>'
      + '<p class="bws-say">' + icon + ' ' + esc(id ? fillWords(G.inside, { item: label }) : G.none) + '</p>'
      + (id ? '<div class="bws-row"><button type="button" class="bws-go">' + esc(G.wear) + '</button></div>' : ''));
    portrait(c.querySelector('canvas'), DRAW(withItem(saved(), id)));
    const b = c.querySelector('.bws-go');
    if (b) b.addEventListener('click', () => {
      try { localStorage.setItem('bb-last', JSON.stringify({ ...saved(), ...withItem(saved(), id) })); } catch (e) {}
      passPush();   // bb-last rides the sync blob; its change-clock stamps itself
      try { document.dispatchEvent(new CustomEvent('world:rewear')); } catch (e) {}
      b.disabled = true;
      b.textContent = G.worn;
      track('gift_wear', { area, item: id });
    });
  }

  if (!g) setTimeout(give, GIVE_AFTER);
  else if (!g.o && day(Date.now()) > day(g.at)) setTimeout(open, 2500);

  return { seam: { state: () => read().g || null, give, open, reveal } };
}
