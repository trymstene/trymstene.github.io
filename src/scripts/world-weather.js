// 🌦 THE WORLD'S WEATHER — the same sky over every area, on one clock.
//
// Trym, 13 Sep 2026: "i want to add the weather from the Park, to Homestead,
// Banana Bay, and Town … The weather can follow the same clock for all areas."
//
// The clock (weatherAt in src/lib/world.js, mirrored in the worker) is a PURE
// FUNCTION OF TIME, so nothing here asks a server what the weather is. That is
// why rain starts on the same second for everyone, in every area, with no
// messages and no shared state — and why the beach and the town can have it for
// the cost of four elements.
//
// This module is the VISUALS and the tier switch. Everything an area DOES about
// the weather stays in that area: the park charges health, hides butterflies and
// shows the morning-after notice; the homestead gathers its animals. They get
// that through onKind. See docs/design-library.md §19.
import { weatherAt } from '../lib/world.js';

export const TIERS = ['clear', 'drizzle', 'heavy', 'storm'];

/**
 * Hang the weather on an area's viewport.
 *
 * @param host   the area's VIEW element — the fixed box, never the panning world
 * @param opts   { leaves = 5, onKind(kind), track(kind) }
 * @returns { tick, now, setKind, stop } — call tick(now) from the area's rAF loop
 */
export function mountWeather(host, opts = {}) {
  // ⚠️ the same SHAPE when it refuses, or an area that mounts on the wrong element
  // dies at its first weather.indoors() instead of just having no rain
  const dead = { tick: () => {}, now: () => 'clear', setKind: () => {}, indoors: () => {}, stop: () => {} };
  if (!host) return dead;
  // ⚠️ THE ONE MISTAKE THIS MODULE EXISTS TO PREVENT. Every area translates its
  // world element by the camera every frame. Rain parented there pans with the
  // map, which does not look like a bug — it looks like slightly wrong rain, and
  // it survives review. A host that is already being transformed is refused.
  const moved = getComputedStyle(host).transform;
  if (moved && moved !== 'none') {
    console.warn('[weather] refused: ' + (host.id || host.className)
      + ' is transformed, so rain would pan with the map. Mount on the VIEW, not the WORLD.');
    return dead;
  }

  const wrap = document.createElement('div');
  wrap.className = 'wx';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<i class="wx__scrim"></i>'
    + '<i class="wx__rain wx__rain--far"></i>'
    + '<i class="wx__rain wx__rain--near"></i>'
    + '<i class="wx__flash"></i>';

  // 🍂 the storm's debris, built ONCE and switched by class — nothing is created
  // or destroyed per storm. Each leaf gets its own duration and a negative delay
  // so they never march in step.
  const leaves = [];
  const n = opts.leaves == null ? 5 : opts.leaves;
  for (let i = 0; i < n; i++) {
    const l = document.createElement('i');
    l.className = 'wx-leaf';
    l.style.top = (8 + i * 17) + '%';
    l.style.animationDuration = (2.4 + i * 0.6) + 's';
    l.style.animationDelay = (-i * 1.3) + 's';
    if (i % 2) l.style.backgroundImage = "url('/assets/park/l-leaf2.png')";
    wrap.appendChild(l);
    leaves.push(l);
  }
  host.appendChild(wrap);

  let kind = 'clear';
  let force = null;
  let hidden = false;
  function setKind(k) {
    if (!TIERS.includes(k)) return;
    if (k === kind) return;
    kind = k;
    // ⚠️ KEEP is-indoors. This line rebuilt the whole class list, so rain that started while you stood in the store or
    // the arcade came down through the ceiling (Trym, 25 Sep 2026: "the rain weather is visible if youre inside the
    // store or the arcade") — and indoors(true) could not put it back: `hidden` still said it was.
    wrap.className = 'wx' + (k === 'clear' ? '' : ' is-' + k) + (hidden ? ' is-indoors' : '');
    leaves.forEach((l) => l.classList.toggle('is-on', k === 'storm'));
    if (opts.onKind) opts.onKind(k);
    if (k !== 'clear' && opts.track) opts.track(k);
  }

  // one cheap check a second — the clock is arithmetic, not a fetch
  let checkAt = 0;
  function tick(now) {
    if (now <= checkAt) return;
    checkAt = now + 1000;
    setKind(force || weatherAt(Date.now()).type);
  }

  return {
    tick,
    now: () => kind,
    /** QA and the park's own ?wx door: pass null to hand the sky back to the clock */
    setKind: (k) => { force = k || null; setKind(force || weatherAt(Date.now()).type); },
    /**
     * 🏠 Step inside. An area whose interior is appended to its PANNING world
     * (the town's arcade room, the homestead's house) seals that interior in its
     * own stacking context, so a sheet on the view outranks it however high the
     * room's z-index goes — and it rains in the kitchen. Those areas call this on
     * the way in and out. The tier keeps updating; only the sheet is hidden, so
     * walking back out shows the sky as it is now, not as it was.
     */
    indoors: (on) => {
      // cheap enough to call every frame: an area that has an inside() predicate
      // should not have to remember to fire this only on the transition
      const want = !!on;
      if (want === hidden) return;
      hidden = want;
      wrap.classList.toggle('is-indoors', want);
    },
    stop: () => { wrap.remove(); kind = 'clear'; },
  };
}
