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

// 🚪 THE DOOR — pixelarticons Pro "door-open", INLINED rather than imported.
// Every other icon in the world comes from pixel-icons.js, but that module
// eager-globs the whole icon directory, and the beach does not otherwise carry
// it: pulling ~70 inlined SVGs onto a game surface to draw ONE glyph is exactly
// the per-surface budget this project watches ([[banana-world-engineering]]).
// Self-contained is also what this module already is — it ships its own CSS for
// the same reason.
// ⚠️ `currentColor` on purpose: the trigger wears the HOST bar's button classes,
// so the door recolours itself in the park's greens, the bay's sands and the
// rave's neon without three copies of anything.
const DOOR = '<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" '
  + 'shape-rendering="crispEdges" aria-hidden="true" focusable="false">'
  + '<path d="M15 4h-4v16h4v2H9v-2H2v-2h2V6h2v12h3V6H6V4h3V2h6v2Zm4 14h3v2h-7v-2h2V6h-2V4h4v14Zm-5-6h-2v-2h2v2Z"/></svg>';

const CSS = `
.wt-btn { display:inline-flex; align-items:center; justify-content:center; gap:0.35rem; }
.wt-btn svg, .wt-card h2 svg { display:block; }
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
