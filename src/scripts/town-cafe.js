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
