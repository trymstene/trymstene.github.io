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
// So the offer belongs at the moment of the wish itself.
//
// ⭐⭐ ROUND 2 (Trym, 6 Aug): showing the card AFTER the file was already saved
// earned literally zero offer clicks — the wish was granted before the ask.
// So the card now comes FIRST: the download click opens the offer, and the
// free file is the card's own secondary button ("no thanks, just the GIF").
// Still once per session; after that every download flows free and instant.
//
// ⚠️ IT MUST LOOK LIKE THE SHARE CARDS, NOT LIKE AN AD (Trym: "every time we
// pitch something it has to look good and punchy"). Same language as the park
// postcard and the pass card: banana yellow, 4px ink border, hard offset
// shadow, Archivo Black, and THE VISITOR'S OWN BANANA rendered as the actual
// die-cut product — not a stock photo, not a generic banner.
// ⚡ NOTHING HEAVY AT MODULE SCOPE. sticker-core.js imports banana-engine, so a
// static import here dragged the ~200K compositor onto EVERY page that merely
// WIRES a download — including /dancing-banana-gif-meme/, the top organic page.
// The card only needs the engine once it actually SHOWS: after a download,
// behind a timeout, at most once a session. So the shot functions (already
// async) fetch it themselves, and the only thing left static is pure data.
//
// ⚠️ Same back-door that defeated the Forge's lazy import via banana-shelf.js.
// Verify by MEASURING the built page, never by reading the import list.
import PRODUCTS from '../../shared/products.js';   // plain catalog, no engine
import { STICKER_PACKS, PACK_PRICE, SET_PRICE, packCard as packShot, packThumb } from '../data/sticker-packs.js';

// ⚠️ was a hand-copied 14.99 "mirroring sticker-core" — a mirror nobody
// repolished when the sticker dropped to $4.99. Read the manifest instead.
const PRICE = {
  amount: parseFloat((PRODUCTS.find((p) => p.key === 'sticker') || {}).priceHint) || 4.99,
  currency: 'USD',
};
const getProduct = (key) => PRODUCTS.find((p) => p.key === key) || null;
const core = () => import('./sticker-core.js');

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
/* the free file lives HERE now — a real secondary button, not a shy link
   (paper ghost of the primary: same shape, quieter voice, never line-breaks) */
.mir__no {
  display: flex; align-items: center; justify-content: center; width: max-content;
  margin-top: 0.55rem; cursor: pointer;
  background: var(--mir-paper); color: var(--mir-ink);
  border: 3px solid var(--mir-ink); box-shadow: 3px 3px 0 rgba(0,0,0,0.25);
  font: inherit; font-size: 0.8rem; font-weight: 800;
  padding: 0.5rem 1rem; white-space: nowrap;
}
.mir__no:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 rgba(0,0,0,0.3); }
.mir__no:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 rgba(0,0,0,0.25); }
@media (max-width: 430px) {
  .mir { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .mir__shot { width: 60%; }
  .mir__pills { justify-content: center; }
  .mir__no { margin-inline: auto; }
}
/* 🌍💬 the warm-up card: ONE primary (world = ink, discord = blurple) over
   the no-thanks ghost — and both buttons span the same full width, so the
   column reads as one designed block, never a ragged stack (Trym). */
.mir--warm .mir__head { font-size: clamp(1.15rem, 5vw, 1.6rem); margin-bottom: 0.5rem; }
.mir--warm .mir__go, .mir--warm .mir__no {
  width: 100%; justify-content: center; box-sizing: border-box; text-align: center;
}
.mir--warm .mir__no { margin-top: 0.5rem; }
.mir__go--dc { background:#5865f2; color:#fff; }
/* 🎟 the pack card: the spread IS the shot; eight minis swap it */
.mir--pack { grid-template-columns: minmax(0, 176px) minmax(0, 1fr); max-width: 600px; }
.mir--pack .mir__shot { display: block; background: #fff; }
.mir--pack .mir__shot img { display: block; width: 100%; height: 100%; object-fit: cover; }
.mir--pack .mir__head { font-size: clamp(1.1rem, 4.6vw, 1.45rem); margin-bottom: 0.3rem; }
.mir__packname {
  font-size: 0.74rem; line-height: 1.3; margin: 0 0 0.45rem; opacity: 0.85;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.mir__minis { display: flex; gap: 4px; margin: 0 0 0.55rem; }
.mir__mini {
  width: 30px; height: 30px; padding: 0; flex: none; cursor: pointer;
  border: 2px solid var(--mir-ink); background: #fff; opacity: 0.55;
}
.mir__mini img { display: block; width: 100%; height: 100%; object-fit: cover; }
.mir__mini:hover, .mir__mini.on { opacity: 1; }
.mir__mini.on { outline: 3px solid #ff4d6d; outline-offset: -1px; }
.mir--pack .mir__go, .mir--pack .mir__no { width: 100%; justify-content: center; box-sizing: border-box; text-align: center; }
@media (max-width: 430px) {
  /* ⚠️ restated here: .mir--pack's two columns are declared AFTER the base
     phone rule and would otherwise win over it — the card must stack */
  .mir--pack { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .mir--pack .mir__shot { width: 62%; }
  .mir__minis { justify-content: center; flex-wrap: wrap; }
  .mir__packname { text-align: center; }
}
/* the post-download moment: the card arrives over the page, once */
.mir-veil {
  position: fixed; inset: 0; z-index: 80; display: grid; place-items: center;
  background: rgba(8, 6, 2, 0.72); padding: 1rem;
  animation: mirIn 0.22s ease-out;
}
.mir-veil[hidden] { display: none; }
@keyframes mirIn { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .mir-veil { animation: none; } .mir__go:hover, .mir__no:hover { transform: none; } }
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
  const { composite, makeStickerMockup, bboxOf, crop, pad,
    stickerCaptions, stickerEffect, ensureCaptionFont } = await core();
  const { assetsReady } = await import('./banana-engine.js');
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
export function offerCard(opts = {}) {
  // ⭐ rotate HERE, not in offerAfterDownload — the pass page and the park
  // share card build their cards straight from offerCard, so putting the
  // picker on the popup path alone left those two showing one fixed line.
  return buildCard({ ...opts, head: pickHead(opts) });
}

function buildCard({
  kicker = 'Make it real',
  head = 'Your banana, as a real sticker',
  pills = ['Die-cut vinyl', 'Ships worldwide'],
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
 * The download-moment card.
 * ⭐ INVERTED 6 Aug (Trym): the ask comes FIRST. Callers intercept the
 * download, show this, and hand the actual file over as `onSkip` — the
 * card's secondary button IS the download. Dismissing the veil skips the
 * file; the next download click simply opens the card again.
 */
// (the old ?offertest QA flag is retired with the session cap — the card
// shows on every download now, so QA is just… downloading.)
// the sync eligibility check — callers ask BEFORE intercepting a download.
// ⭐ EVERY download shows the card now (Trym, 12 Aug — the old once-per-
// session cap was merch-era nagware protection; a warm-up invitation rides
// every file). The skip button still delivers instantly, so the toll is one
// tap, never a wall.
export function offerWillShow() {
  return true;
}
// 🎣 ROTATING HEADLINES. Trym, 8 Aug — on "Want this sticker on your laptop?":
// "great headline for putting the product into a situation where people use
// stickers - more of that." So each offer carries a `heads` list of SITUATIONS,
// not descriptions: a lid, a bottle, a 7am coffee, leaving the house. One is
// picked per open, never the same one twice running, so the same visitor
// meeting the card on two different pages does not read the same line.
// `head` stays the safe default for any offer without a list.
let lastHead = '';
function pickHead(offer) {
  const list = (offer && offer.heads) || [];
  if (list.length < 2) return (offer && offer.head) || list[0];
  const pool = list.filter((h) => h !== lastHead);
  lastHead = pool[Math.floor(Math.random() * pool.length)];
  return lastHead;
}

// 🎟 THE PACK CARD (Trym, 5 Sep 2026: "swap the popup to the pack entirely,
// make it nice and visual"). Thirty days of the warm-up/coffee card on the GIF
// page: 231 shown, 174 skipped, 15 taken, and 3 merch clicks on the whole
// page. The download moment now shows the one thing this site sells that
// nobody else has: the Giphy bananas as real kiss-cut sticker packs.
// ONE ask (the pack on show) and the free file one honest tap away, same as
// before. The eight packs sit under the pitch as tappable minis — a tap swaps
// the big picture, so the card is a small shop window, not a poster.
// The world / Discord / coffee cards live in git (this commit's parent).
const PACK_HEADS = [
  'The banana you just took, as real stickers',
  'He also comes on paper',
  'Take him home for real',
  'Six of him, kiss-cut, in an envelope',
  'Real stickers of the 1999 banana',
];

function packCard({ pack, head, skipText, onGo, onSkip, onSwap }) {
  injectCss();
  const card = document.createElement('div');
  card.className = 'mir mir--pack';
  let cur = pack;
  // the shot IS the pack picture — it carries its own PACK N flair, so no sash
  const shot = document.createElement('a');
  shot.className = 'mir__shot mir__shot--pack';
  const im = document.createElement('img');
  im.alt = ''; im.loading = 'eager'; im.decoding = 'async'; im.width = 600; im.height = 600;
  shot.appendChild(im);
  const body = document.createElement('div');
  const k = document.createElement('p'); k.className = 'mir__kicker'; k.textContent = 'Now on paper · 8 sticker packs';
  const h = document.createElement('p'); h.className = 'mir__head'; h.textContent = head;
  const nm = document.createElement('p'); nm.className = 'mir__packname';
  const minis = document.createElement('div'); minis.className = 'mir__minis';
  const ps = document.createElement('div'); ps.className = 'mir__pills';
  ['6 kiss-cut stickers · $' + PACK_PRICE.toFixed(2), 'The Original in every pack', 'All eight $' + SET_PRICE.toFixed(2)]
    .forEach((t, i) => {
      const sp = document.createElement('span');
      sp.className = 'mir__pill' + (i === 0 ? ' mir__pill--price' : ''); sp.textContent = t;
      ps.appendChild(sp);
    });
  const go = document.createElement('a'); go.className = 'mir__go';
  const show = (p) => {
    cur = p;
    im.src = packShot(p.n);
    shot.href = '/shop/' + p.handle + '/';
    go.href = shot.href;
    go.textContent = 'See ' + p.name + ' →';
    nm.textContent = '';
    const b = document.createElement('b'); b.textContent = p.num + ' · ' + p.name;
    nm.append(b, document.createTextNode(' — ' + p.names.join(', ')));
    [...minis.children].forEach((m) => m.classList.toggle('on', Number(m.dataset.n) === p.n));
  };
  STICKER_PACKS.forEach((p) => {
    const m = document.createElement('button');
    m.type = 'button'; m.className = 'mir__mini'; m.dataset.n = String(p.n);
    m.setAttribute('aria-label', p.num + ', ' + p.name);
    const mi = document.createElement('img');
    mi.src = packThumb(p.n); mi.alt = ''; mi.width = 240; mi.height = 240; mi.decoding = 'async';
    m.appendChild(mi);
    m.addEventListener('click', () => { show(p); if (onSwap) onSwap(p); });
    minis.appendChild(m);
  });
  if (onGo) {
    go.addEventListener('click', () => onGo(cur));
    shot.addEventListener('click', () => onGo(cur));
  }
  const no = document.createElement('button');
  no.type = 'button'; no.className = 'mir__no'; no.textContent = skipText;
  if (onSkip) no.addEventListener('click', onSkip);
  body.append(k, h, nm, minis, ps, go, no);
  card.append(shot, body);
  show(pack);
  return card;
}

/**
 * The download-moment card — THE PACK CARD since 5 Sep 2026. Owns its own
 * tracking: offer_shown / offer_pack / offer_swap / offer_skip, all carrying
 * { from, variant } (+ any caller `params`); variant = which pack and which
 * headline showed, product = the pack tapped. Callers only supply the moment
 * (`from`) and the file (`onSkip`); `outfit` and `img` are accepted and
 * ignored so every caller keeps working unchanged.
 * Shows on EVERY download (Trym, 12 Aug) — offer_shown counts CARDS, not people.
 */
export function offerAfterDownload(opts = {}) {
  if (!offerWillShow()) return null;
  injectCss();
  const pack = STICKER_PACKS[Math.floor(Math.random() * STICKER_PACKS.length)];
  const head = PACK_HEADS[Math.floor(Math.random() * PACK_HEADS.length)];
  const P = { from: opts.from || 'unknown', variant: 'pack-' + pack.n + '/h' + (PACK_HEADS.indexOf(head) + 1), ...(opts.params || {}) };
  const hit = (name, extra) => {
    try { if (window.gtag) window.gtag('event', name, { ...P, ...(extra || {}) }); } catch (e) {}
  };
  const veil = document.createElement('div');
  veil.className = 'mir-veil';
  const close = () => veil.remove();
  const card = packCard({
    pack, head,
    skipText: opts.skipText || 'no thanks, just the GIF',
    // ⚠️ beacon transport: the pack link navigates THIS tab away instantly —
    // a plain gtag hit would be cancelled mid-flight with the page
    onGo: (p) => hit('offer_pack', { product: 'pack-' + p.n, transport_type: 'beacon' }),
    onSwap: (p) => hit('offer_swap', { product: 'pack-' + p.n }),
    onSkip: () => { close(); hit('offer_skip'); if (opts.onSkip) opts.onSkip(); },
  });
  veil.appendChild(card);
  veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
  addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); removeEventListener('keydown', esc); }
  });
  document.body.appendChild(veil);
  hit('offer_shown');
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
// (the download popup shows per-download since 12 Aug — these entries now
// serve only the EMBEDDED cards: pass page, park postcard.)
export const OFFERS = {
  // ── CUSTOM LANE ── they made it, so we can show it
  yours: {
    kicker: 'Make it real', product: 'sticker',
    head: 'That banana, as a real sticker',
    heads: [
      'That banana, as a real sticker',
      'Want this one on your laptop?',
      'This one belongs on a water bottle',
      'Stick this one on something',
      'Real vinyl. Your banana. Your laptop lid.',
    ],
    pills: ['Die-cut vinyl', 'Ships worldwide'],
    cta: 'See it as a sticker →', href: '/make-a-banana/sticker/', flag: 'MADE BY YOU',
  },
  yoursMug: {
    kicker: 'Make it real', product: 'mug',
    head: 'Your banana, on your morning coffee',
    heads: [
      'Your banana, on your morning coffee',
      'Want to drink out of this one?',
      'This one, holding your coffee at 7am',
      'Your banana, on the desk every morning',
    ],
    pills: ['11oz enamel camper mug', 'Ships worldwide'],
    cta: 'See it on a mug →', href: '/make-a-banana/mug/', flag: 'MADE BY YOU',
  },
  yoursTee: {
    kicker: 'Make it real', product: 'tee',
    head: 'Your banana, on a t-shirt',
    heads: [
      'Your banana, on a t-shirt',
      'Want to wear this one out of the house?',
      'This one, on your chest, in public',
      'Your banana, printed and worn',
    ],
    pills: ['Printed on demand', 'Ships worldwide'],
    cta: 'See it on a tee →', href: '/make-a-banana/tee/', flag: 'MADE BY YOU',
  },
  // ── OFFICIAL LANE ── they took the original; there is nothing of theirs to print
  original: {
    price: false,
    kicker: 'Since 1999', product: 'mug', bare: true,
    head: 'The original banana, on a real mug',
    heads: [
      'The original banana, on a real mug',
      'Want the 1999 one holding your coffee?',
      'The original, on your desk by morning',
    ],
    pills: ['Official merch', 'Ships worldwide'],
    cta: 'See the official shop →', href: '/shop/', flag: 'THE ORIGINAL',
  },
  originalTee: {
    price: false,
    kicker: 'Since 1999', product: 'tee', bare: true,
    head: 'Wear the banana that started it',
    heads: [
      'Wear the banana that started it',
      'Want to wear the 1999 original?',
      'The one everybody knows, on a shirt',
    ],
    pills: ['Official tee', 'Ships worldwide'],
    cta: 'See the official shop →', href: '/shop/', flag: 'THE ORIGINAL',
  },
  // 🖼 THE GALLERY: these are OUR bananas and every item carries the exact
  // params that rebuild it, so the ask can be specific — this one, printed.
  gallery: {
    kicker: 'Make it real', product: 'sticker',
    head: 'This one can be a real sticker',
    heads: [
      'This one can be a real sticker',
      'Want this one on your laptop?',
      'This one, stuck to your notebook',
      'Put this one on a water bottle',
    ],
    pills: ['Die-cut vinyl', 'Ships worldwide'],
    cta: 'Make it a sticker →', href: '/make-a-banana/sticker/', flag: 'FREE TO MAKE',
  },
  // ⚠⚠ THE REMIXES ARE NOT OURS TO SELL. Community GIFs, credited to their
  // makers (and some to nobody). Offering to print one would be offering to
  // sell somebody else's work. The offer here is the ORIGINAL banana — the one
  // thing on that page we actually own.
  remix: {
    price: false, kicker: 'Since 1999', product: 'mug', bare: true,
    head: 'The banana they remixed, on a real mug',
    heads: [
      'The banana they remixed, on a real mug',
      'The one they all started from, on your desk',
      'Want the original holding your coffee?',
    ],
    pills: ['Official merch', 'Ships worldwide'],
    cta: 'See the official shop →', href: '/shop/', flag: 'THE ORIGINAL',
  },
  // the wallpaper crowd took something for a SCREEN — offer the desk instead
  wallpaper: {
    price: false,
    kicker: 'Off the screen', product: 'mug', bare: true,
    head: 'It looks even better on a mug',
    heads: [
      'It looks even better on a mug',
      'Off the screen and onto your desk',
      'Want it holding your coffee instead?',
    ],
    pills: ['Official merch', 'Ships worldwide'],
    cta: 'See the official shop →', href: '/shop/', flag: 'THE ORIGINAL',
  },
  // an emoji is a small thing for chat — a sticker is the small thing for life
  emoji: {
    price: false,
    kicker: 'Make it real', product: 'sticker', bare: true,
    head: 'A banana for your laptop, not just your chat',
    heads: [
      'A banana for your laptop, not just your chat',
      'Want this one on your laptop?',
      'It works outside the chat window too',
      'Small enough for chat. Also for a laptop lid.',
    ],
    pills: ['Die-cut vinyl', 'Ships worldwide'],
    cta: 'Make your own sticker →', href: '/make-a-banana/', flag: 'THE ORIGINAL',
  },
};

// render the banana onto the ACTUAL product the offer is fronting
export async function productShot(outfit, key, size = 420) {
  if (!key || key === 'sticker') return stickerShot(outfit, size);
  const { productMockup, ensureCaptionFont } = await core();
  const { assetsReady } = await import('./banana-engine.js');
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

// name the file the skip button hands over — the button must say what it gives
function skipLabelFor(a) {
  const name = (a.getAttribute('download') || a.pathname || '').toLowerCase();
  const m = name.match(/\.(gif|png|webp|jpe?g)$/);
  const ext = m ? m[1] : '';
  return 'no thanks, just the ' + (ext === 'gif' ? 'GIF' : ext === 'png' ? 'PNG'
    : ext === 'webp' ? 'WebP' : 'image');
}

/**
 * 🔗 Wire every download link inside `scope` to an offer.
 *
 * ⭐ FIRST, NOT AFTER (Trym, 6 Aug — the after-the-file card earned ZERO
 * clicks): a download click opens the CARD instead; its secondary button
 * re-fires the link and the file flows. EVERY download (Trym, 12 Aug).
 *
 * ⚠️ CAPTURE + stopPropagation on the intercepted click: GA4's automatic
 * file_download (and any page-level tracker, e.g. the gallery's own
 * gallery_download) must not count a download that didn't happen. The skip
 * re-fires the ORIGINAL anchor, so every tracker fires exactly once, at the
 * moment the file actually flows.
 * ⚠️ Modified clicks (ctrl/cmd/shift/middle) always flow free — power users
 * saving into tabs are not an offer moment.
 * @param {string} key   which OFFERS entry to show
 * @param {Element} scope defaults to the document
 */
export function wireDownloads(key, over, scope) {
  const root = scope || document;
  const refired = new WeakSet();
  root.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[download], a[href$=".gif"], a[href$=".png"], a[href$=".webp"]');
    if (!a) return;
    if (refired.has(a)) { refired.delete(a); return; }   // the skip button sent it — let it flow
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!offerWillShow()) return;                        // (always true now — kept as the seam)
    e.preventDefault();
    e.stopPropagation();
    const fire = () => { refired.add(a); a.click(); };
    // 🌍 the card owns its copy (rotating world/discord variants) and its own
    // events now — `key` survives purely as the `from` dimension. `over` is
    // accepted and ignored so the pages that pass per-item merch overrides
    // (gallery, locales) keep working unchanged.
    const shown = offerAfterDownload({
      from: key,
      img: a.href,           // the card shows exactly what the tap is taking home
      skipText: skipLabelFor(a),
      onSkip: fire,
    });
    if (!shown) fire();   // belt and braces: no card, no toll — the file flows
  }, true);
}
