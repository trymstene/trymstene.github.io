// 🛍 MAKE IT REAL — the offer card, wherever somebody has just made something.
//
// WHY THIS EXISTS (GA4, 28 days to 30 Jul): the site does not have a traffic
// problem. 6,119 sessions, and roughly half of every ad landing travels onward —
// almost all of it into /make-a-banana/, which is 56% of ALL pageviews. What it
// has is a LAST-CLICK problem: 336 people downloaded a banana they had just
// made, and 9 clicked a product tile. Zero purchases.
//
// ⭐ THE INSIGHT THIS IS BUILT ON: the free download was not losing to the
// product tile — it was SATISFYING THE SAME WISH FIRST and then the session
// ended. Nothing at all happened after a download: a toast, a shelf save, done.
// So the offer belongs at the moment the wish is freshly granted, not in a tile
// competing with it.
//
// ⚠️ IT MUST LOOK LIKE THE SHARE CARDS, NOT LIKE AN AD (Trym: "every time we
// pitch something it has to look good and punchy"). Same language as the park
// postcard and the pass card: banana yellow, 4px ink border, hard offset
// shadow, Archivo Black, and THE VISITOR'S OWN BANANA rendered as the actual
// die-cut product — not a stock photo, not a generic banner.
import {
  composite, makeStickerMockup, bboxOf, crop, pad, PRICE,
  stickerCaptions, stickerEffect, ensureCaptionFont,
  productMockup, getProduct,
} from './sticker-core.js';
import { assetsReady } from './banana-engine.js';

const CSS = `
.mir {
  --mir-ink: #111; --mir-paper: #fffdf5;
  display: grid; grid-template-columns: minmax(0, 148px) minmax(0, 1fr); gap: 0.9rem;
  align-items: center; text-align: left;
  background: linear-gradient(160deg, #ffe86b, #f5c400);
  border: 4px solid var(--mir-ink); box-shadow: 8px 8px 0 var(--mir-ink);
  padding: 0.9rem; color: var(--mir-ink); max-width: 560px;
}
.mir__shot {
  position: relative; aspect-ratio: 1; border: 3px solid var(--mir-ink);
  background: #e8e4da; overflow: hidden; box-shadow: 3px 3px 0 rgba(0,0,0,0.35);
}
.mir__shot canvas { display: block; width: 100%; height: 100%; }
/* the corner flash — the one bit of pure showmanship */
.mir__flag {
  position: absolute; top: 19px; left: -46px; width: 160px; transform: rotate(-38deg);
  text-align: center; padding: 3px 0;
  background: #e22020; color: #fff; font-family: "Archivo Black", sans-serif;
  font-size: 0.55rem; letter-spacing: 0.1em; box-shadow: 0 1px 0 rgba(0,0,0,0.4);
}
.mir__kicker {
  font-size: 0.58rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
  opacity: 0.72; margin: 0 0 0.15rem;
}
.mir__head {
  font-family: "Archivo Black", sans-serif; font-size: clamp(1.05rem, 4.6vw, 1.5rem);
  line-height: 1.02; margin: 0 0 0.4rem; text-wrap: balance;
}
.mir__pills { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0 0 0.6rem; }
.mir__pill {
  font-size: 0.62rem; font-weight: 800; letter-spacing: 0.04em; padding: 0.2rem 0.45rem;
  border-radius: 999px; background: rgba(0,0,0,0.09); box-shadow: inset 0 0 0 2px rgba(0,0,0,0.18);
}
.mir__pill--price { background: var(--mir-ink); color: #ffe135; box-shadow: none; }
.mir__go {
  display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none;
  background: var(--mir-ink); color: #ffe135; font-family: inherit; font-weight: 800;
  font-size: 0.92rem; padding: 0.62rem 1rem; border: 3px solid var(--mir-ink);
  box-shadow: 3px 3px 0 rgba(0,0,0,0.45); cursor: pointer; white-space: nowrap;
}
.mir__go:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 rgba(0,0,0,0.5); }
.mir__go:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 rgba(0,0,0,0.45); }
.mir__no {
  display: block; margin-top: 0.45rem; background: none; border: 0; padding: 0; cursor: pointer;
  font: inherit; font-size: 0.7rem; font-weight: 700; opacity: 0.6; text-decoration: underline;
  text-underline-offset: 3px; color: inherit; text-align: inherit; width: 100%;
}
@media (max-width: 430px) {
  .mir { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .mir__shot { width: 60%; }
  .mir__pills { justify-content: center; }
}
/* the post-download moment: the card arrives over the page, once */
.mir-veil {
  position: fixed; inset: 0; z-index: 80; display: grid; place-items: center;
  background: rgba(8, 6, 2, 0.72); padding: 1rem;
  animation: mirIn 0.22s ease-out;
}
.mir-veil[hidden] { display: none; }
@keyframes mirIn { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mir-veil { animation: none; } .mir__go:hover { transform: none; } }
`;

let styled = false;
function injectCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

// The banana the visitor last built. Same read as drops.js readSavedOutfit(),
// deliberately re-done here: this card mounts on shop pages, and importing
// drops.js would drag the whole catalog/clock machinery onto them for 6 lines.
export function myOutfit() {
  try {
    const o = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (o && typeof o === 'object') {
      return { hat: o.hat || 'none', glasses: o.glasses || 'none',
               extras: o.extras || {}, c: o.c, made: true };
    }
  } catch (e) {}
  return { hat: 'none', glasses: 'none', extras: {}, made: false };
}

// ⚠️ THE PRODUCT SHOT IS THE WHOLE PITCH, so it is the REAL mockup renderer the
// product page uses — same die-cut contour, same paper backdrop. A cheaper
// preview here would promise something the PDP then fails to match.
export async function stickerShot(outfit, size = 420) {
  await assetsReady();
  const state = {
    effect: 'none', bg: 'transparent', top: '', bottom: '', captions: false,
    frame: 3,   // the open-armed pose — the one that reads as "ta-da"
    ...outfit,
    extras: outfit.extras || {},
  };
  await ensureCaptionFont(state);
  const W = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const ctx = cv.getContext('2d');
  // ⚠️ same three opts the PDP's designCanvas() passes — the shot must be the
  // product, captions and all, or the card promises a sticker we won't print.
  composite(ctx, W, state.frame, state, {
    bg: 'transparent', captions: stickerCaptions(state), effect: stickerEffect(state),
  });
  const design = crop(cv, pad(bboxOf([ctx.getImageData(0, 0, W, W).data], W), W));
  return makeStickerMockup(state, design, size, 'sticker');
}

const money = () => '$' + PRICE.amount.toFixed(2);

/**
 * Build the card. Everything is optional except `href`.
 * @returns HTMLElement (append it wherever)
 */
export function offerCard({
  kicker = 'Make it real',
  head = 'Your banana, as a real sticker',
  pills = ['Die-cut vinyl', 'Free worldwide shipping'],
  cta = 'See it as a sticker →',
  href = '/make-a-banana/sticker/',
  flag = 'MADE BY YOU',
  outfit = null,
  product = 'sticker',
  price = true,          // ⚠️ money() is the STICKER price. A mug card showing
                         // $14.99 is a wrong price on a commerce card — worse
                         // than no price. Product-aware below; off for the
                         // official shop, which prices seven things itself.
  bare = false,          // ⚠️ the OFFICIAL lane shows the CLASSIC banana, not
                         // yours — it is what that shop actually sells
  onGo = null,
  onSkip = null,
  skipText = '',
} = {}) {
  injectCss();
  const o = bare ? { hat: 'none', glasses: 'none', extras: {} } : (outfit || myOutfit());
  const card = document.createElement('div');
  card.className = 'mir';

  const shot = document.createElement('div');
  shot.className = 'mir__shot';
  if (flag) {
    const f = document.createElement('span');
    f.className = 'mir__flag';
    f.textContent = flag;
    shot.appendChild(f);
  }
  card.appendChild(shot);
  // ⚠️ async and never blocking: the card is on screen immediately, the mockup
  // paints in when the sprite sheet is ready. A card that waits for a canvas is
  // a card the visitor has already scrolled past.
  productShot(o, product, 420).then((cv) => { shot.appendChild(cv); }).catch(() => {});

  const body = document.createElement('div');
  const k = document.createElement('p'); k.className = 'mir__kicker'; k.textContent = kicker;
  const h = document.createElement('p'); h.className = 'mir__head'; h.textContent = head;
  const ps = document.createElement('div'); ps.className = 'mir__pills';
  if (price) {
    const pr = document.createElement('span');
    pr.className = 'mir__pill mir__pill--price';
    const def = product && product !== 'sticker' ? getProduct(product) : null;
    pr.textContent = def && def.priceHint ? '$' + def.priceHint : money();
    ps.appendChild(pr);
  }
  pills.forEach((t) => {
    const s = document.createElement('span'); s.className = 'mir__pill'; s.textContent = t;
    ps.appendChild(s);
  });
  const go = document.createElement('a');
  go.className = 'mir__go';
  go.href = href;
  go.textContent = cta;
  if (onGo) go.addEventListener('click', onGo);
  body.append(k, h, ps, go);
  if (skipText) {
    const no = document.createElement('button');
    no.type = 'button'; no.className = 'mir__no'; no.textContent = skipText;
    if (onSkip) no.addEventListener('click', onSkip);
    body.appendChild(no);
  }
  card.appendChild(body);
  return card;
}

/**
 * The post-download moment. Shows ONCE per session — the offer is a thank-you,
 * and a thank-you repeated is nagging.
 * ⚠️ It never blocks the download: call it AFTER the file is on its way.
 */
let shownThisSession = false;
// ⚠️ read at module load, not at call time — callers sync() the design into the
// URL first, which rewrites the query string and would eat the flag.
const QA = typeof location !== 'undefined' && location.search.includes('offertest');
export function offerAfterDownload(opts = {}) {
  const qa = QA;   // QA handle, house pattern
  if (shownThisSession && !qa) return null;
  if (!qa) {
    try {
      if (sessionStorage.getItem('mir-seen')) { shownThisSession = true; return null; }
      sessionStorage.setItem('mir-seen', '1');
    } catch (e) {}
    shownThisSession = true;
  }
  injectCss();
  const veil = document.createElement('div');
  veil.className = 'mir-veil';
  const close = () => veil.remove();
  const card = offerCard({
    ...opts,
    skipText: opts.skipText || 'no thanks, just the GIF',
    onSkip: close,
    onGo: (e) => { if (opts.onGo) opts.onGo(e); },
  });
  veil.appendChild(card);
  veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
  addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); removeEventListener('keydown', esc); }
  });
  document.body.appendChild(veil);
  return { el: veil, close };
}


// ⭐ ONE CARD, MANY MOMENTS — the offer table.
//
// Trym, 1 Aug: "should be everywhere doesnt it? … can have different headlines
// and CRO-messaging in each case — but maybe front different products like
// mugs, tees and stickers … and front different products in the two types of
// shops we have custom and official".
//
// ⚠️ THE OFFER MUST MATCH WHAT THEY JUST TOOK. Someone who downloaded the
// 1999 ORIGINAL has not made anything — pitching "your banana on a sticker" to
// them is pitching a thing that does not exist yet, so those moments front the
// OFFICIAL shop (the classic banana on real merch). Someone who downloaded a
// banana THEY dressed gets the custom lane, because the card can show the exact
// thing they just made. Same card, two shops, honest either way.
//
// ⚠️ ONE PER SESSION, GLOBALLY (offerAfterDownload). A thank-you repeated is
// nagging — that rule is what keeps this from becoming a popup people hate.
export const OFFERS = {
  // ── CUSTOM LANE ── they made it, so we can show it
  yours: {
    kicker: 'Make it real', product: 'sticker',
    head: 'That banana, as a real sticker',
    pills: ['Die-cut vinyl', 'Free worldwide shipping'],
    cta: 'See it as a sticker →', href: '/make-a-banana/sticker/', flag: 'MADE BY YOU',
  },
  yoursMug: {
    kicker: 'Make it real', product: 'mug',
    head: 'Your banana, on your morning coffee',
    pills: ['11oz enamel camper mug', 'Free worldwide shipping'],
    cta: 'See it on a mug →', href: '/make-a-banana/mug/', flag: 'MADE BY YOU',
  },
  yoursTee: {
    kicker: 'Make it real', product: 'tee',
    head: 'Your banana, on a t-shirt',
    pills: ['Printed on demand', 'Free worldwide shipping'],
    cta: 'See it on a tee →', href: '/make-a-banana/tee/', flag: 'MADE BY YOU',
  },
  // ── OFFICIAL LANE ── they took the original; there is nothing of theirs to print
  original: {
    price: false,
    kicker: 'Since 1999', product: 'mug', bare: true,
    head: 'The original banana, on a real mug',
    pills: ['Official merch', 'Free worldwide shipping'],
    cta: 'See the official shop →', href: '/shop/', flag: 'THE ORIGINAL',
  },
  originalTee: {
    price: false,
    kicker: 'Since 1999', product: 'tee', bare: true,
    head: 'Wear the banana that started it',
    pills: ['Official tee', 'Free worldwide shipping'],
    cta: 'See the official shop →', href: '/shop/', flag: 'THE ORIGINAL',
  },
  // the wallpaper crowd took something for a SCREEN — offer the desk instead
  wallpaper: {
    price: false,
    kicker: 'Off the screen', product: 'mug', bare: true,
    head: 'It looks even better on a mug',
    pills: ['Official merch', 'Free worldwide shipping'],
    cta: 'See the official shop →', href: '/shop/', flag: 'THE ORIGINAL',
  },
  // an emoji is a small thing for chat — a sticker is the small thing for life
  emoji: {
    price: false,
    kicker: 'Make it real', product: 'sticker', bare: true,
    head: 'A banana for your laptop, not just your chat',
    pills: ['Die-cut vinyl', 'Free worldwide shipping'],
    cta: 'Make your own sticker →', href: '/make-a-banana/', flag: 'THE ORIGINAL',
  },
};

// render the banana onto the ACTUAL product the offer is fronting
export async function productShot(outfit, key, size = 420) {
  if (!key || key === 'sticker') return stickerShot(outfit, size);
  await assetsReady();
  const p = getProduct(key);
  if (!p) return stickerShot(outfit, size);
  const state = {
    effect: 'none', bg: 'transparent', top: '', bottom: '', captions: false,
    frame: 3, ...outfit, extras: (outfit && outfit.extras) || {},
  };
  await ensureCaptionFont(state);
  return productMockup(state, p, size, { colorHex: '#ffffff' });
}

/**
 * 🔗 Wire every download link inside `scope` to an offer.
 *
 * ⚠️ AFTER, NEVER INSTEAD. The listener does not preventDefault and does not
 * await anything — the file is already on its way before the card exists. An
 * offer that delays a free download would poison the one thing people came for.
 * @param {string} key   which OFFERS entry to show
 * @param {Element} scope defaults to the document
 */
export function wireDownloads(key, over, scope) {
  const root = scope || document;
  root.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[download], a[href$=".gif"], a[href$=".png"], a[href$=".webp"]');
    if (!a) return;
    const o = { ...(OFFERS[key] || OFFERS.yours), ...(over || {}) };
    // a beat of air: let the browser start the file before anything appears
    setTimeout(() => {
      const shown = offerAfterDownload(o);
      if (shown && window.gtag) window.gtag('event', 'offer_shown', { offer: key });
    }, 700);
  });
}
