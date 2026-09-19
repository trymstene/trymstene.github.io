// ☕ THE COFFEE CUP'S COUNTER (19 Sep 2026, docs/town-cafe-plan.md §1 and §4, docs/town-jobs-plan.md §3).
//
// Bean hires you the way every boss does. You clock in by stepping behind the counter, townsbananas
// come to the rope, and you make each cup with three one-thumb gestures. Tips at clock-out.
//
// ⭐ THE COUNTER IS A TRAY, and the square stays alive behind it (Trym, 19 Sep). That is not
// decoration: an open card owns every tap and every key in this world, so behind a card the banana
// cannot be walked — and the one choice the whole café is built on, "serve the next cup, or step out
// and relight the lamp", could not physically be made. The cabinet card is the named fallback, and
// everything above `mountCounter` is written FORM-BLIND so swapping it stays a contained change: a
// station is a number from 0 to 1 and a band to land in, and nothing here knows what draws them.
//
// ⚠️ THE THUMB IS JUDGED ON ITS OWN TIMESTAMP, never on the last frame that happened to be painted.
// A pointerdown carries an exact `now` even at 15 fps; judging on the last rendered value quietly
// made the milk station all-or-nothing at 4× CPU, because the swell was only ever SAMPLED near its
// top. Measured 19 Sep, and the walk holds a PERFECT cup at an 8× throttled screen because of it.
//
// ⚠️ THE ONLY FAUCET THE SERVER KNOWS IS `tips`. There is no `shift` and no `cup` in RULES.town, and
// an unknown src is refused before the wallet with the coins evaporating at the next ack. A nominal
// cup may not exceed 6 either: the stew buff DOUBLES a faucet and 6 × 2 = 12 = RULES.town.tips.max,
// and a refusal is whole, never partial.

// ⭐ THE WORDS ARE GLOBBED HERE, inside the café's own lazy chunk — NOT onto town-life.json, which is
// eager-globbed into town-room.js and would have spent two kilobytes of the 2 447 B that chunk has
// left. The counter runs wordless until the rig approves them, the way every surface in this world
// does, and no player who never works a shift downloads a byte of them.
const COPY_MODS = import.meta.glob('../data/copy/town-cafe.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};
// a deck line, picked by a number the caller already has, so the same cup never says two things
export const deckLine = (deck, n) => { const d = (COPY.cup || {})[deck] || []; return d.length ? d[Math.abs(n | 0) % d.length] : ''; };

// ---- the three gestures, and nothing about a screen -------------------------------------------
export const GRADES = ['wrong', 'fine', 'perfect'];
export const ORDER = ['grind', 'pour', 'milk'];

// ⚠️ MEASURED AGAINST A THUMB, NOT GUESSED. A 1400 ms sweep with a 0.30 band puts ~420 ms of zone
// under the needle each pass, and a person taps inside ~150 ms of intent.
const STATIONS = {
  grind: { span: 1400, band: 0.30, floor: 0.16 },
  pour: { span: 1700, band: 0.28, floor: 0.15, at: 0.72 },   // the band sits high: the last of the water
  milk: { span: 640, band: 0.34, floor: 0.18, taps: 3 },
};

// ⭐ THE ZONES TIGHTEN THE LONGER YOU STAY ON (the plan). The band closes toward its floor on a
// curve that is generous early and never quite arrives: the tenth cup of a shift is work, the first
// is a welcome.
const bandFor = (st, n) => st.floor + (st.band - st.floor) / (1 + (n | 0) / 7);

export const zoneOf = (cup, key) => {
  const st = STATIONS[key], w = bandFor(st, cup.n);
  const at = key === 'pour' ? st.at : key === 'milk' ? 1 : cup.at;
  return { at, half: w / 2, from: Math.max(0, at - w / 2), to: Math.min(1, at + w / 2) };
};
const offBy = (v, z) => Math.abs(v - z.at) / (z.half || 1e-6);
const gradeOf = (off) => (off <= 0.34 ? 2 : off <= 1 ? 1 : 0);

// the drinks, as PICTURES on the ticket — the pips the tray draws, never a word (the plan §4)
export const DRINKS = {
  short: ['bean', 'milk'],
  tall: ['bean', 'bean', 'milk'],
  double: ['bean', 'bean', 'foam'],
};
export const DRINK_IDS = Object.keys(DRINKS);

// `at` is where this cup's grinder band sits, from the town's own seed: a reload never rerolls one
// customer's order into an easier one, and two cups in a row are not the same tap.
export function newCup(drink, n, seed) {
  return {
    drink: DRINKS[drink] ? drink : 'short', n: n | 0, at: 0.24 + ((seed | 0) % 50) / 100,
    i: 0, t0: 0, held: 0, v: 0, taps: [], marks: [], done: false, grade: 0,
  };
}
export const stationOf = (cup) => ORDER[cup.i] || '';

function vAt(cup, key, now) {
  const st = STATIONS[key], e = now - (cup.t0 || now);
  if (key === 'grind') { const p = (e % (st.span * 2)) / st.span; return p <= 1 ? p : 2 - p; }
  if (key === 'pour') return cup.held ? Math.min(1, (now - cup.held) / st.span) : 0;
  const p = (e % st.span) / st.span; return p <= 0.5 ? p * 2 : 2 - p * 2;
}

export function tick(cup, now) {
  if (cup.done) return cup;
  const key = stationOf(cup); if (!key) return cup;
  if (!cup.t0) cup.t0 = now;
  cup.v = vAt(cup, key, now);                      // for the tray to draw, and for nothing else
  if (key === 'pour' && cup.held && cup.v >= 1) return release(cup, now) && cup;   // held to the brim: it spills
  return cup;
}

export function press(cup, now) {
  if (cup.done) return null;
  const key = stationOf(cup);
  if (key === 'pour') { if (!cup.held) { cup.held = now; cup.t0 = now; cup.v = 0; } return null; }
  return land(cup, now, key);
}
export function release(cup, now) {
  if (cup.done || stationOf(cup) !== 'pour' || !cup.held) return null;
  return land(cup, now, 'pour');
}

function land(cup, now, key) {
  const v = vAt(cup, key, now);                    // ⚠️ the thumb's own instant, not the last painted frame
  const z = zoneOf(cup, key), g = gradeOf(offBy(v, z));
  if (key === 'milk') {
    cup.taps.push({ v, g });
    if (cup.taps.length < STATIONS.milk.taps) return { key, g, more: true };
    cup.marks.push(Math.min(...cup.taps.map((t) => t.g)));   // three taps, and the worst is the milk
  } else {
    cup.marks.push(g);
    if (key === 'pour') cup.held = 0;
  }
  cup.i++; cup.t0 = 0; cup.v = 0;
  // ⭐ the grade of a cup is its WORST station (the plan's word): one fumbled gesture is the cup.
  if (cup.i >= ORDER.length) { cup.done = true; cup.grade = Math.min(...cup.marks); }
  return { key, g, more: false, done: cup.done, grade: cup.grade };
}

// ⭐ THE CHORE PAYS IN THE ROOM; THE COUNTER PAYS IN TIPS (docs/town-jobs-plan.md §3). A cup is a
// tip, not a wage — and 4 + 1 is the ceiling on purpose, because 6 is where the stew buff would push
// a cup into a whole refusal.
export const TIP = [0, 2, 4];
export const tipFor = (grade, quick) => TIP[grade | 0] + (quick && grade ? 1 : 0);

// ---- the tray: the one thing in here that knows about a screen ---------------------------------
const el = (tag, cls, host) => { const e = document.createElement(tag); if (cls) e.className = cls; if (host) host.appendChild(e); return e; };
const HOLD_SLOP = 10;   // world-steer's own number: a thumb that moves less than this never meant to drag

// mountCounter(host, opts) — the tray, its gauge, and the thumb. It owns no state but the cup in
// front of it: `opts.onCup(cup)` when a cup is finished, `opts.onStep(r)` on every landed gesture.
// ⚠️ host must be a positioned, overflow-clipped box (#twView in the town) or the tray anchors to
// the page; .tw-stage and .tw-wrap are position:static.
export function mountCounter(host, opts = {}) {
  const now = () => (opts.now ? opts.now() : performance.now());
  const box = el('div', 'tw-cup', host);
  box.hidden = true;
  const top = el('div', 'tw-cup__top', box);
  const tickEl = el('div', 'tw-cup__tick', top);
  const steps = el('div', 'tw-cup__steps', top);
  const stepEls = ORDER.map(() => el('i', 'tw-cup__step', steps));
  const bar = el('div', 'tw-cup__bar', box);
  const zoneEl = el('i', 'tw-cup__zone', bar);
  const fillEl = el('i', 'tw-cup__fill', bar);
  const needle = el('i', 'tw-cup__needle', bar);
  const go = el('button', 'tw-cup__go', box);
  go.type = 'button';
  const note = el('p', 'tw-cup__note', box);

  let cup = null, raf = 0, holding = false, cx = 0, cy = 0;

  function paint() {
    raf = 0;
    if (!cup || box.hidden) return;
    tick(cup, now());
    const key = stationOf(cup);
    if (key) {
      const z = zoneOf(cup, key);
      zoneEl.style.left = (z.from * 100) + '%';
      zoneEl.style.width = ((z.to - z.from) * 100) + '%';
      const pour = key === 'pour';
      fillEl.hidden = !pour; needle.hidden = pour;
      if (pour) fillEl.style.transform = 'scaleX(' + cup.v.toFixed(4) + ')';
      else needle.style.left = (cup.v * 100).toFixed(2) + '%';
      stepEls.forEach((s, i) => { s.className = 'tw-cup__step' + (i < cup.i ? ' is-done' : i === cup.i ? ' is-now' : ''); });
    }
    raf = requestAnimationFrame(paint);
  }
  const wake = () => { if (!raf && !box.hidden) raf = requestAnimationFrame(paint); };
  const sleep = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  // ⚠️ THE POUR IS A HOLD, AND A HOLD IS FRAGILE. A vertical drag begun on a control inside anything
  // that can scroll gets `pointercancel` after two moves and the pour dies before it is written —
  // measured. So: touch-action:none in the CSS, a container that cannot scroll, release listened for
  // on the WINDOW (a thumb that slides off the button still finishes its pour), and world-steer's
  // own bail — if the event stops being cancelable a scroll won, and we let go rather than fight it.
  function down(e) {
    if (!cup || cup.done) return;
    if (e.cancelable) e.preventDefault();
    holding = true; cx = e.clientX; cy = e.clientY;
    go.classList.add('is-held');
    const r = press(cup, now());
    if (r) step(r);
  }
  function up() {
    if (!holding) return;
    holding = false;
    go.classList.remove('is-held');
    if (!cup || cup.done) return;
    const r = release(cup, now());
    if (r) step(r);
  }
  function move(e) {
    if (!holding) return;
    // a real scroll won, or the thumb wandered: let the pour go where it stands rather than hang on
    if (!e.cancelable || Math.hypot(e.clientX - cx, e.clientY - cy) > HOLD_SLOP * 12) up();
  }
  function step(r) {
    if (opts.onStep) opts.onStep(r, cup);
    if (!r.done) return;
    const done = cup;
    sleep(); cup = null;
    if (opts.onCup) opts.onCup(done);
  }
  go.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('pointermove', move, { passive: true });

  return {
    el: box,
    // the ticket is pictures: one pip per thing in the drink, and never a word
    serve(c, label) {
      cup = c;
      tickEl.textContent = '';
      for (const k of (DRINKS[c.drink] || [])) el('i', 'tw-cup__pip' + (k === 'bean' ? '' : ' tw-cup__pip--' + k), tickEl);
      go.textContent = label || '';
      go.disabled = false;
      wake();
    },
    idle(label) { cup = null; sleep(); tickEl.textContent = ''; go.textContent = label || ''; go.disabled = true; needle.hidden = true; fillEl.hidden = true; zoneEl.style.width = '0%'; stepEls.forEach((s) => { s.className = 'tw-cup__step'; }); },
    say(text) { note.textContent = text || ''; },
    show() { box.hidden = false; box.classList.remove('is-folded'); wake(); },
    fold() { box.classList.add('is-folded'); sleep(); },       // you stepped off the mark: the cup waits
    hide() { box.hidden = true; sleep(); },
    open: () => !box.hidden && !box.classList.contains('is-folded'),
    cup: () => cup,
    // ⚠️ the walk's door: nothing in tests/ has ever driven a canvas, and a rAF gauge cannot be
    // thumbed by Playwright at a real millisecond. These let it press at an exact instant.
    seam: {
      press: (t) => { const r = cup ? press(cup, t) : null; if (r) step(r); return r; },   // ⚠️ a pour's press STARTS a hold and grades nothing: stepping on null would log a phantom wrong
      release: (t) => { const r = cup ? release(cup, t) : null; if (r) step(r); return r; },
      at: (t) => (cup ? (tick(cup, t), cup.v) : -1),
      zone: () => (cup ? zoneOf(cup, stationOf(cup)) : null),
      station: () => (cup ? stationOf(cup) : ''),
      // the exact instant this station is PERFECT, so a walk can thumb it without waiting for a
      // real second — v is a pure function of (t - t0), so the moment can be solved rather than hunted
      best: (t) => {
        if (!cup) return 0;
        const key = stationOf(cup); tick(cup, t);
        const st = STATIONS[key], z = zoneOf(cup, key);
        if (key === 'pour') return (cup.held || t) + z.at * st.span;
        if (key === 'milk') return cup.t0 + st.span / 2 + Math.ceil((t - cup.t0 - st.span / 2) / st.span) * st.span;
        const c = cup.t0 + z.at * st.span;                       // the needle's first pass over the band
        return c >= t ? c : c + Math.ceil((t - c) / (st.span * 2)) * st.span * 2;
      },
    },
    destroy() { sleep(); go.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('pointermove', move); box.remove(); },
  };
}

// ---- the banana in the window ------------------------------------------------------------------
// ⭐ TRYM, 19 Sep: "the banana can be inside of that window … just have to make the banana sit
// inside, and let the coffee cup sprite overflow the banana — the locked banana frame can be the
// hands up pose". So a shift needs NO new prop and NO counter mark drawn on the cobbles: the kiosk
// already in the square has a serving hatch, and working it means standing in it.
//
// ⚠️ THE Z COMES FROM THE KIOSK'S BASE, NOT THE WINDOW'S FLOOR. Everything outdoors is ordered by
// its foot (100 + y), and the window's floor is 24 px ABOVE the kiosk's — so a banana placed by its
// own feet sorts behind the building it is standing inside, and the shift is invisible with nothing
// on screen to explain it. It is the painter's-algorithm trap the beach wrote down, in a new place.
const POSE = 2;          // frame 2: front-facing, both hands up — the pack's barista pose
// ⭐ SIZED TO THE WINDOW, the way the pack sizes its own barista, because the window is a window: you
// are looking into a kiosk from the square and the banana inside is further away. 46 px was tried first
// — a heroic banana at nearly the player's own height — and it does not fit: its arms reach past the
// arch on both sides and the ellipse below takes its face off. The pack's barista is 26 px (CAFE_WIN[2]);
// a banana stands a little taller than that and no taller.
const DRAWN = 28;
const FRAME_H_FRAC = 0.66, FRAME_TOP_FRAC = 0.20;   // src/lib/banana-geo.js — the drawn frame inside its square canvas

export function bootTownCafe(ctx) {
  const { world, W, H, pct, PROPS, CAFE_WIN, drawMe, outfit, say, track } = ctx;
  let atWork = null, tray = null, on = false;

  function standIn() {
    if (atWork || !CAFE_WIN) return;
    const [cx, floor, baristaH] = CAFE_WIN;
    void baristaH;
    const w = DRAWN / FRAME_H_FRAC;   // the ELEMENT is bigger than the banana: hats live in the headroom
    const el = document.createElement('div');
    el.className = 'tw-atwork';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 150;
    try { drawMe(cv.getContext('2d'), 150, POSE, outfit()); } catch (e) {}
    el.appendChild(cv);
    el.style.width = pct(w, W);
    el.style.left = pct(cx, W);
    // translate(-50%, -100%) puts the element's BOTTOM on `top`, and its feet sit a little above that
    el.style.top = pct(floor + (1 - FRAME_TOP_FRAC - FRAME_H_FRAC) * w, H);
    const p = PROPS && PROPS.cafe;
    el.style.zIndex = String(100 + Math.round(p ? p.base : floor) + 1);
    // ✂️ AND THE KIOSK OVERFLOWS THE BANANA, which is the whole of Trym's note. Clipped to the hatch's
    // own opening (baked, flood-filled from its middle), a banana too big for the window simply stops at
    // the arch — so it reads as leaning into a serving hatch instead of wearing the building. ⚠️ it is
    // not decoration: WITHOUT IT a viking helmet's horns run straight up the COFFEE AND TEA sign, which
    // is what the screenshot showed before this line existed.
    // ⚠️ AN ELLIPSE, NOT A RECTANGLE. The hatch is an arch, so a box clip cuts the crown flat and square
    // across the middle of the opening — the banana looks decapitated rather than framed. The ellipse
    // follows the arch, and a banana too tall for the window loses its hat to the curve, which is what
    // standing in a serving hatch looks like.
    const win = CAFE_WIN.length > 6 ? CAFE_WIN.slice(3) : null;
    if (win) {
      const l = cx - w / 2, t = floor - (FRAME_TOP_FRAC + FRAME_H_FRAC) * w;   // the element's own box, in world px
      const pc = (v) => (v / w * 100).toFixed(2) + '%';
      el.style.clipPath = 'ellipse(' + pc((win[2] - win[0]) / 2) + ' ' + pc((win[3] - win[1]) / 2)
        + ' at ' + pc((win[0] + win[2]) / 2 - l) + ' ' + pc((win[1] + win[3]) / 2 - t) + ')';
    }
    world.appendChild(el);
    atWork = el;
    const me = world.querySelector('.tw-me');
    if (me) me.classList.add('is-serving');   // ⚠️ a CLASS, never [hidden]: authored display beats it
  }
  function stepOut() {
    if (atWork) { atWork.remove(); atWork = null; }
    const me = world.querySelector('.tw-me');
    if (me) me.classList.remove('is-serving');
  }

  function clockIn(host) {
    if (on) return false;
    on = true;
    standIn();
    if (!tray) tray = mountCounter(host || world.parentElement, {});
    tray.show();
    tray.say(COPY.on || '');
    if (COPY.on) say(COPY.on);
    track('town_shift', { at: 'cafe', step: 'in' });
    return true;
  }
  function clockOut() {
    if (!on) return false;
    on = false;
    stepOut();
    if (tray) { tray.idle(''); tray.hide(); }
    if (COPY.off) say(COPY.off);
    track('town_shift', { at: 'cafe', step: 'out' });
    return true;
  }
  // the player's own picture changes (a new hat, a curse): redraw the one in the window
  function redraw() { if (atWork) { const g = atWork.firstChild.getContext('2d'); g.clearRect(0, 0, 150, 150); try { drawMe(g, 150, POSE, outfit()); } catch (e) {} } }

  return {
    clockIn, clockOut, redraw,
    on: () => on,
    tray: () => tray,
    seam: { on: () => on, at: () => (atWork ? { z: +atWork.style.zIndex, w: atWork.style.width, top: atWork.style.top } : null), clockIn, clockOut },
  };
}
