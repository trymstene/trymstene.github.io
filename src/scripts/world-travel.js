// 🚪 FAST TRAVEL — the same door in all three worlds.
//
// The roads between areas stay: walking out of the park's east gate into the
// bay is how the world is supposed to feel, and that is not going anywhere.
// This is the shortcut for people who already know where they want to be, and
// it is the ONLY navigation that exists identically everywhere — so it ships as
// one module rather than three near-copies that drift apart in a month.
//
// ⚠️ IT BRINGS ITS OWN CSS. Every other stylesheet in this project lives in the
// page that owns it, and that is right for a page. This is a WORLD-LEVEL widget
// that has to look the same in the park's greens, the bay's sands and the
// rave's neon; three copies of the same rules in three .astro files is exactly
// how it would stop looking the same. One <style>, injected once.
const AREAS = {
  rave: { icon: '🪩', name: 'The Rave', line: 'the dance floor — always open' },
  park: { icon: '🌳', name: 'The Park', line: 'the shared garden' },
  beach: { icon: '🏖', name: 'Banana Bay', line: 'shells, fish and the pier' },
};
const ORDER = ['rave', 'park', 'beach'];

// ⚠️ the arrival params are load-bearing: each world spawns you at the door you
// came in by, so a fast travel has to say where it came FROM the same way the
// walked doors do (park reads ?rave / ?beach, beach reads ?park / ?from=rave).
function hrefFor(to, from) {
  if (to === 'park') return '/park/?' + from;
  if (to === 'beach') return from === 'rave' ? '/beach/?from=rave' : '/beach/?park';
  return '/rave/';
}

// 🚪 THE DOOR — drawn for this world, not borrowed from an icon pack (Trym: the
// pack's door "is actually bad"). A closed wooden door: two recessed panels, a
// brass-yellow handle, painted in the Banana Stand hut's OWN wood palette
// (#3a2918 outline, #8a5a2b slab, #a6713a lit panel) so it belongs here.
//
// ⚠️ EXACT 2× OR IT LOOKS BROKEN. The art is an 8×15 pixel grid; drawn at 22px
// (a 1.375× scale) some rows land on 1px and others on 2px, and the two panels
// come out visibly different sizes — checked by rasterising all three options
// side by side. viewBox is cropped to the door itself so there is no dead
// margin, and 16×30 is a clean doubling.
// ⚠️ NOT `currentColor` any more, and that is the trade: a brown door cannot
// also recolour per world. It reads fine on every bar (checked against the
// club's dark green and the bay's yellow), and "a brown door" was the ask.
// ⚠️ INLINE, not from pixel-icons.js — that module eager-globs the whole icon
// directory and the BEACH does not otherwise carry it; ~70 SVGs to draw one
// glyph is exactly the per-surface budget this project watches
// ([[banana-world-engineering]]). Self-contained is what this module already is.
const DOOR = '<svg viewBox="0 0 8 15" width="16" height="30" shape-rendering="crispEdges"'
  + ' class="wt-door" aria-hidden="true" focusable="false">'
  + '<path fill="#3a2918" d="M0 0h8v1h-8zM0 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM7 2h1v1h-1zM0 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM7 5h1v1h-1zM0 6h1v1h-1zM7 6h1v1h-1zM0 7h1v1h-1zM7 7h1v1h-1zM0 8h1v1h-1zM7 8h1v1h-1zM0 9h1v1h-1zM7 9h1v1h-1zM0 10h1v1h-1zM7 10h1v1h-1zM0 11h1v1h-1zM7 11h1v1h-1zM0 12h1v1h-1zM7 12h1v1h-1zM0 13h1v1h-1zM7 13h1v1h-1zM0 14h8v1h-8z"/>'
  + '<path fill="#5f3d1c" d="M2 2h4v1h-4zM2 3h1v1h-1zM5 3h1v1h-1zM2 4h1v1h-1zM5 4h1v1h-1zM2 5h4v1h-4zM2 9h4v1h-4zM2 10h1v1h-1zM5 10h1v1h-1zM2 11h1v1h-1zM5 11h1v1h-1zM2 12h4v1h-4z"/>'
  + '<path fill="#8a5a2b" d="M1 1h6v1h-6zM1 2h1v1h-1zM6 2h1v1h-1zM1 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM6 5h1v1h-1zM1 6h6v1h-6zM1 7h4v1h-4zM6 7h1v1h-1zM1 8h6v1h-6zM1 9h1v1h-1zM6 9h1v1h-1zM1 10h1v1h-1zM6 10h1v1h-1zM1 11h1v1h-1zM6 11h1v1h-1zM1 12h1v1h-1zM6 12h1v1h-1zM1 13h6v1h-6z"/>'
  + '<path fill="#a6713a" d="M3 3h2v1h-2zM3 4h2v1h-2zM3 10h2v1h-2zM3 11h2v1h-2z"/>'
  + '<path fill="#ffe135" d="M5 7h1v1h-1z"/></svg>';

const CSS = `
.wt-btn { display:inline-flex; align-items:center; justify-content:center; gap:0.35rem; }
.wt-btn svg, .wt-card h2 svg { display:block; }
/* ⚠️ THE DOOR'S SIZE IS NOT NEGOTIABLE. Host bars size their own icons — the
   rave squares every button SVG with \`.rv-emote-btn svg { width:1.25em;
   height:1.25em }\` — and an 8x15 door forced into a square is a squashed door.
   Two classes + a type out-specifies any one-class host rule, so this wins
   without !important and without the module knowing which bar it landed in.
   16x30 is an exact 2x of the art; anything else lands rows on half-pixels. */
.wt-btn svg.wt-door, .wt-card h2 svg.wt-door { width:16px; height:30px; }
.wt-card h2 { display:flex; align-items:center; gap:0.4rem; }
.wt-veil {
  position:fixed; inset:0; z-index:70; display:grid; place-items:center;
  background:rgba(4,8,4,0.74); padding:1rem;
}
.wt-veil[hidden] { display:none; }
.wt-card {
  width:min(420px,100%); background:#14240f; color:#fffdf5;
  border:4px solid #000; box-shadow:8px 8px 0 #000; padding:1rem 1rem 1.1rem;
}
.wt-card h2 {
  margin:0 0 0.15rem; font-size:1.05rem; color:#ffe135; letter-spacing:0.02em;
}
.wt-card p.wt-sub { margin:0 0 0.85rem; font-size:0.78rem; opacity:0.75; }
.wt-list { display:grid; gap:0.55rem; }
.wt-go {
  display:flex; align-items:center; gap:0.7rem; width:100%; cursor:pointer;
  padding:0.7rem 0.8rem; border:3px solid #000; box-shadow:3px 3px 0 #000;
  background:linear-gradient(#ffe14d,#f2c012); color:#241c00;
  font-family:inherit; text-align:left; text-decoration:none;
}
.wt-go:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
.wt-go__icon { font-size:1.5rem; line-height:1; }
.wt-go__name { display:block; font-size:1rem; font-weight:800; }
.wt-go__line { display:block; font-size:0.74rem; font-weight:700; opacity:0.72; }
.wt-go__arrow { margin-left:auto; font-size:1.1rem; font-weight:800; }
.wt-close {
  appearance:none; width:100%; margin-top:0.8rem; cursor:pointer; font-family:inherit;
  background:#182a16; color:#fffdf5; border:3px solid #000; box-shadow:3px 3px 0 #000;
  font-weight:800; font-size:0.86rem; padding:0.5rem;
}
.wt-close:active { transform:translate(2px,2px); box-shadow:1px 1px 0 #000; }
/* 🛍 THE SHOP is NOT an area — it is the way out of the world to a real thing,
   so it sits under a rule and wears paper instead of the areas' yellow. Reading
   it as a fourth place would blur the one line this project keeps sharp:
   bananacoins buy cosmetics, money buys objects. */
.wt-sep {
  margin:0.85rem 0 0.6rem; border:0; border-top:2px dashed rgba(255,253,245,0.22);
}
.wt-go--shop { background:#fffdf5; color:#141414; }
.wt-go--shop .wt-go__line { opacity:0.62; }
@media (prefers-reduced-motion:reduce) { .wt-go, .wt-close { transition:none; } }
`;

let styled = false;
function injectCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/**
 * @param here  'rave' | 'park' | 'beach'
 * @param mount the action bar to put the button in
 * @param btnClass the HOST world's own button classes, so the trigger looks
 *        native to the bar it sits in (the panel is the shared part, not this)
 * @param before an element to insert AHEAD of, or nothing to append.
 *        ⚠️ THE SOUND BUTTON STAYS RIGHTMOST (Trym: it is a setting, not an
 *        action). Each bar pins it with `margin-left:auto`, which only pushes
 *        past what comes BEFORE it — so appending the door quietly landed it to
 *        the right of the speaker in all three worlds. The bar knows its own
 *        order; the shared module should not have to guess it.
 * @param track  the world's analytics fn
 */
export function initTravel({ here, mount, before, btnClass, track }) {
  if (!mount) return;
  injectCss();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = (btnClass || '') + ' wt-btn';
  btn.id = 'wtBtn';
  btn.setAttribute('aria-label', 'travel to another area');
  btn.innerHTML = DOOR;

  const veil = document.createElement('div');
  veil.className = 'wt-veil';
  veil.hidden = true;
  const others = ORDER.filter((k) => k !== here);
  veil.innerHTML = '<div class="wt-card" role="dialog" aria-modal="true" aria-label="Travel">'
    + '<h2>' + DOOR + ' where to?</h2>'
    + '<p class="wt-sub">the roads still work — this is the shortcut.</p>'
    + '<div class="wt-list">'
    + others.map((k) => '<a class="wt-go" href="' + hrefFor(k, here) + '" data-to="' + k + '">'
      + '<span class="wt-go__icon">' + AREAS[k].icon + '</span>'
      + '<span><span class="wt-go__name">' + AREAS[k].name + '</span>'
      + '<span class="wt-go__line">' + AREAS[k].line + '</span></span>'
      + '<span class="wt-go__arrow">→</span></a>').join('')
    + '</div>'
    // 🛍 the one door that leaves the world. 28 days of data: the walked door to
    // the stand pulled 356, the LED billboard beside it pulled 24 — people go
    // through doors and ignore posters, so the shop gets a door too.
    + '<hr class="wt-sep">'
    + '<div class="wt-list">'
    + '<a class="wt-go wt-go--shop" href="/shop/" data-to="shop">'
    + '<span class="wt-go__icon">🛍</span>'
    + '<span><span class="wt-go__name">The Shop</span>'
    + '<span class="wt-go__line">your banana on real things — not coins</span></span>'
    + '<span class="wt-go__arrow">→</span></a>'
    + '</div>'
    + '<button class="wt-close" type="button">stay here</button>'
    + '</div>';

  const close = () => { veil.hidden = true; };
  btn.addEventListener('click', () => {
    veil.hidden = false;
    if (track) track('travel_open', { from: here });
  });
  veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
  veil.querySelector('.wt-close').addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !veil.hidden) close(); });
  veil.querySelectorAll('.wt-go').forEach((a) => {
    a.addEventListener('click', () => {
      if (track) track('travel_go', { from: here, to: a.dataset.to });
    });
  });

  mount.insertBefore(btn, (before && before.parentNode === mount) ? before : null);
  document.body.appendChild(veil);
  return { open: () => { veil.hidden = false; }, close };
}
