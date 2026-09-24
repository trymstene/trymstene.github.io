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
import { passStat, ruleUsed, coinsPaid } from '../lib/banana-pass.js';
import { tipsCap, xpAt, unlocked } from '../data/town/jobs.js';   // 🪜 the rank's tips cap and the shift's work XP (23 Sep 2026)
const COPY_MODS = import.meta.glob('../data/copy/town-cafe.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};
// a deck line, picked by a number the caller already has, so the same cup never says two things
export const deckLineOf = (copy, deck, n) => { const d = ((copy || {}).cup || {})[deck] || []; return d.length ? d[Math.abs(n | 0) % d.length] : ''; };
export const deckLine = (deck, n) => deckLineOf(COPY, deck, n);

// ---- the three gestures, and nothing about a screen -------------------------------------------
export const GRADES = ['wrong', 'fine', 'perfect'];
export const ORDER = ['grind', 'pour', 'milk'];

// ⚠️ MEASURED AGAINST A THUMB, NOT GUESSED. A 1400 ms sweep with a 0.30 band puts ~420 ms of zone
// under the needle each pass, and a person taps inside ~150 ms of intent.
export const STATIONS = {
  grind: { kind: 'sweep', span: 1400, band: 0.30, floor: 0.16 },
  pour: { kind: 'hold', span: 1700, band: 0.28, floor: 0.15, at: 0.72 },   // the band sits high: the last of the water
  // ⚠️ MEASURED AGAINST A THUMB A SECOND TIME, AND THE FIRST NUMBERS WERE WRONG. The swell used to
  // peak AT the bar's right edge (at: 1), so half of every band fell off the end of the gauge, and a
  // 640 ms up-and-down moved the needle so fast that the grade-2 window was ±18 ms — against ±75 ms
  // at the other two stations. Simulated over 20 000 cups against a gaussian thumb: a PERFECT cup
  // was 0–4% at every skill level, which is not a prize, it is a locked door. The band now sits
  // inside the bar and the pulse is slower, which puts the three stations within 10 ms of each other.
  // ⚠️ 0.74, NOT 0.78: at 0.78 the band's right border landed exactly ON the bar's inner edge on the
  // first cup of every shift (measured 0.0px of daylight at all four phone sizes) and was clipped away,
  // so the target read as open-ended — a zone with only one wall does not say "land inside me".
  milk: { kind: 'taps', span: 1000, band: 0.44, floor: 0.24, at: 0.74, taps: 3 },
  syrup: { kind: 'sweep', span: 1250, band: 0.26, floor: 0.14 },   // ☕ a special order's fourth step (rank 3): the grinder's needle, a narrower band
};

// ⭐ THE ZONES TIGHTEN THE LONGER YOU STAY ON (the plan). The band closes toward its floor on a
// curve that is generous early and never quite arrives: the tenth cup of a shift is work, the first
// is a welcome.
const bandFor = (st, n) => st.floor + (st.band - st.floor) / (1 + (n | 0) / 7);

export const zoneOf = (cup, key) => {
  const st = stationDef(cup, key), w = bandFor(st, cup.n);
  const at = st.kind === 'sweep' ? cup.at : st.at;
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

// ⭐ A DECK is what the tray plays: the stations in their order (each of a KIND — a needle to stop, a hold to
// let go of, taps on a pulse), their measured windows, and the drinks as pictures. The café's is the default
// everywhere below, so the bench and every caller that knows nothing of decks reads exactly as it did; the
// lemonade stand brings its own (town-lemon.js) and plays it on the same tray with the same thumb.
export const CAFE_DECK = { id: 'cafe', order: ORDER, stations: STATIONS, drinks: DRINKS };
const deckOf = (cup) => (cup && cup.deck) || CAFE_DECK;
// 🍋 a BIG glass (the stand's rank 2) plays one station longer — the deck says which, and how long (town-lemon.js)
const stationDef = (cup, key) => { const d = deckOf(cup), st = d.stations[key] || STATIONS[key]; return cup && cup.big && d.big && d.big.station === key ? { ...st, span: d.big.span } : st; };

// `at` is where this cup's grinder band sits, from the town's own seed: a reload never rerolls one
// customer's order into an easier one, and two cups in a row are not the same tap.
export function newCup(drink, n, seed, deck = CAFE_DECK) {
  const ids = Object.keys(deck.drinks);
  return {
    deck, drink: deck.drinks[drink] ? drink : ids[0], n: n | 0, at: 0.24 + ((seed >>> 0) % 50) / 100,
    i: 0, t0: 0, held: 0, v: 0, taps: [], marks: [], done: false, grade: 0,
  };
}
// 🔓 an order may carry its OWN steps (the ladder's rank 3): a glass poured from the jug skips the squeeze, a special order
// adds syrup — `cup.order` over the deck's, and `cup.pips` over the drink's pictures
const orderOf = (cup) => (cup && cup.order) || deckOf(cup).order;
export const stationOf = (cup) => orderOf(cup)[cup.i] || '';

function vAt(cup, key, now) {
  // ⚠️ never before the station began: a thumb's own instant can be a few ms older than the frame that started it
  const st = stationDef(cup, key), e = Math.max(0, now - (cup.t0 || now));
  if (st.kind === 'sweep') { const p = (e % (st.span * 2)) / st.span; return p <= 1 ? p : 2 - p; }
  if (st.kind === 'hold') return cup.held ? Math.min(1, Math.max(0, now - cup.held) / st.span) : 0;
  const p = (e % st.span) / st.span; return p <= 0.5 ? p * 2 : 2 - p * 2;
}

export function tick(cup, now) {
  if (cup.done) return cup;
  const key = stationOf(cup); if (!key) return cup;
  if (!cup.t0) cup.t0 = now;
  cup.v = vAt(cup, key, now);                      // for the tray to draw, and for nothing else
  if (stationDef(cup, key).kind === 'hold' && cup.held && cup.v >= 1) return release(cup, now) && cup;   // held to the brim: it spills
  return cup;
}

export function press(cup, now) {
  if (cup.done) return null;
  const key = stationOf(cup);
  if (stationDef(cup, key).kind === 'hold') { if (!cup.held) { cup.held = now; cup.t0 = now; cup.v = 0; } return null; }
  return land(cup, now, key);
}
// ⚠️ A TAP IS NOT A POUR, AND IT MAY NOT COST A CUP. The other two stations are taps and this one is
// a HOLD, and nothing on a phone can tell a thumb which is which — the tray's one button looks the
// same either way. A quick tap used to land a release at v ≈ 0.02, which graded WRONG and silently
// ruined the cup with no way to know what had gone wrong. A release this early is a slip, not a play:
// it puts the cup back to an unpoured state and grades nothing, so the bar simply refills. And the
// button SAYS it is held (Trym, 23 Sep 2026: "it isnt obvious that you have to press the button on
// mobile"): every station's word names its gesture, "Hold to pour" or "Tap to grind" — a rule the copy
// gate holds (tools/copy-jobs.mjs gestureLabels).
const POUR_MIN = 0.08;
export function release(cup, now) {
  const key = stationOf(cup);
  if (cup.done || !key || stationDef(cup, key).kind !== 'hold' || !cup.held) return null;
  if (vAt(cup, key, now) < POUR_MIN) { cup.held = 0; cup.t0 = 0; cup.v = 0; return null; }
  return land(cup, now, key);
}

function land(cup, now, key) {
  const v = vAt(cup, key, now);                    // ⚠️ the thumb's own instant, not the last painted frame
  const z = zoneOf(cup, key), g = gradeOf(offBy(v, z)), st = stationDef(cup, key);
  if (st.kind === 'taps') {
    cup.taps.push({ v, g });
    if (cup.taps.length < (st.taps || 3)) return { key, g, more: true };
    // ⚠️ THE MEAN OF THE THREE, NOT THE WORST. The cup's own grade is still its worst STATION (the
    // plan's rule, §3) — but making the milk station itself the worst of three taps turned it into
    // three gates in a row, and three gates cube the chance of passing: one fumble in three killed
    // every cup. The mean lets a good pour with one slip still be a good cup.
    const sum = cup.taps.reduce((a, t) => a + t.g, 0);
    cup.marks.push(Math.round(sum / cup.taps.length));
  } else {
    cup.marks.push(g);
    if (st.kind === 'hold') cup.held = 0;
  }
  cup.i++; cup.t0 = 0; cup.v = 0;
  // ⭐ the grade of a cup is its WORST station (the plan's word): one fumbled gesture is the cup.
  if (cup.i >= orderOf(cup).length) { cup.done = true; cup.grade = Math.min(...cup.marks); }
  return { key, g, more: false, done: cup.done, grade: cup.grade };
}

// ⭐ THE CHORE PAYS IN THE ROOM; THE COUNTER PAYS IN TIPS (docs/town-jobs-plan.md §3). A cup is a
// tip, not a wage. 🪜 ONE PAY SCALE (Trym, 23 Sep 2026): a day's tips stop at a fifth of the rank's full week —
// 12 at the stand's first rank, 18 at the café's — so a cup is 1 or 2 and a shift fills the day in a handful of
// good cups; after that the cups earn work XP alone (src/data/town/jobs.js tipsCap, XP).
export const TIP = [0, 1, 2];
export const tipFor = (grade) => TIP[grade | 0] || 0;

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
  const deck = opts.deck || CAFE_DECK;
  box.dataset.deck = deck.id;   // 🍋 the stylesheet dresses a deck's stations by name under this
  let stepEls = deck.order.map(() => el('i', 'tw-cup__step', steps));
  const bar = el('div', 'tw-cup__bar', box);
  const zoneEl = el('i', 'tw-cup__zone', bar);
  const fillEl = el('i', 'tw-cup__fill', bar);
  const needle = el('i', 'tw-cup__needle', bar);
  // ⚠️ THE MILK WANTS THREE TAPS AND USED TO SHOW NOTHING FOR THE FIRST TWO. The station landed a
  // tap, `more: true` came back, and the gauge looked exactly as it had a moment earlier — so the
  // only readable state was "still going", and a player could not tell a landed tap from a missed
  // one, or know how many were left. Each tap now leaves its own mark where it fell. No words: it is
  // a gauge, and the never-instruct rule holds.
  const tapEls = [0, 1, 2].map(() => { const t = el('i', 'tw-cup__tap', bar); t.hidden = true; return t; });
  const clearTaps = () => tapEls.forEach((t) => { t.hidden = true; });
  const go = el('button', 'tw-cup__go', box);
  go.type = 'button';
  const note = el('p', 'tw-cup__note', box);
  // 🪙 the shift's tips so far: a coin and a number in the tray's corner, nothing to read
  const tipsEl = el('i', 'tw-cup__tips', top);
  tipsEl.hidden = true;
  const jugEl = el('i', 'tw-cup__jug', top);   // 🍋 the glasses left in the jug (the stand's rank 3)
  jugEl.hidden = true;
  // 🚪 THE WAY OUT (Trym, 22 Sep: "better to lock it and have a button for leave work"): while a shift is on the banana
  // is held at its counter, so this is the one door out — on the strip, the rig's word on it, and it ends the shift.
  const leaveBtn = el('button', 'tw-cup__leave', top);
  leaveBtn.type = 'button';
  leaveBtn.textContent = opts.leave || '';
  leaveBtn.hidden = !opts.leave;
  leaveBtn.addEventListener('click', (e) => { e.stopPropagation(); if (opts.onLeave) opts.onLeave(); });
  const COIN = '<svg viewBox="0 0 8 8" width="12" height="12" shape-rendering="crispEdges" aria-hidden="true"><path fill="#111" d="M2 0h4v1h-4zM1 1h1v1h-1zM6 1h1v1h-1zM0 2h1v4h-1zM7 2h1v4h-1zM1 6h1v1h-1zM6 6h1v1h-1zM2 7h4v1h-4z"/><path fill="#f2c012" d="M2 1h4v1h-4zM1 2h6v4h-6zM2 6h4v1h-4z"/><path fill="#ffe97a" d="M2 2h2v1h-2zM2 3h1v1h-1z"/><path fill="#b8860b" d="M4 4h2v1h-2zM5 3h1v1h-1z"/></svg>';

  let cup = null, raf = 0, holding = false, cx = 0, cy = 0;
  // ⚠️ WHERE THE WORLD'S VOICE STANDS WHILE A SHIFT IS ON, and it has to be MEASURED. The toast docks
  // at the bottom and is z 2000, so it lands on the gauge; raised by a fixed 172 px it landed square on
  // the barista's own face in the serving window instead. The only clear band is the top of the view,
  // under the HUD strip — and the strip is not a fixed height: it grows a line when the save pill
  // appears. So it is measured, and watched for as long as the tray is up.
  let ro = null;
  const placeToast = () => {
    const t = document.getElementById('twToast'), v = t && t.parentElement;
    if (!t || !v) return;
    // under the HUD strip AND under the journal chips (the quest note, the work note): the strip alone put
    // the toast square on the notes (22 Sep). banana-town.js placeToast measures the same three on every say;
    // this copy is what the strip's ResizeObserver fires first, so it has to agree.
    const vt = v.getBoundingClientRect().top;
    let low = 0;
    for (const el of document.querySelectorAll('.wh, .bwq-hint, .bwq-hint__badge, .twd-chip, .twd-chip__badge')) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.bottom > vt) low = Math.max(low, r.bottom - vt); }
    t.style.setProperty('--tw-toast-top', Math.max(14, low ? Math.round(low) + 10 : 44) + 'px');
  };
  const toast = (up) => {
    const t = document.getElementById('twToast'); if (!t) return;
    if (up) {
      placeToast();
      const wh = document.querySelector('.wh');
      if (!ro && wh && typeof ResizeObserver === 'function') { ro = new ResizeObserver(placeToast); ro.observe(wh); }
    } else if (ro) { ro.disconnect(); ro = null; }
    t.classList.toggle('is-above-tray', !!up);
  };

  let shown = '';
  function paint() {
    raf = 0;
    if (!cup || box.hidden) return;
    tick(cup, now());
    const key = stationOf(cup);
    // the one button follows the cup from station to station — grind, pour, milk
    // ☕ the station is on the BOX, so the stylesheet can dress the gauge as a grinder, a pour or a
    // swelling foam without a line of per-frame JS. Set here in mountCounter, so /dev/cafe/ dresses too.
    if (key && key !== shown) { shown = key; box.dataset.st = key; if (opts.label) go.textContent = opts.label(key) || ''; }
    if (key) {
      const z = zoneOf(cup, key);
      zoneEl.style.left = (z.from * 100) + '%';
      zoneEl.style.width = ((z.to - z.from) * 100) + '%';
      const pour = stationDef(cup, key).kind === 'hold';
      fillEl.hidden = !pour; needle.hidden = pour;
      // ⭐ and the bar carries a SEED at its left edge before the first press, so the pour reads as a
      // level that fills from there rather than as an empty box with nothing happening in it
      if (pour) fillEl.style.transform = 'scaleX(' + Math.max(cup.held ? 0 : 0.02, cup.v).toFixed(4) + ')';
      else needle.style.left = (cup.v * 100).toFixed(2) + '%';
      stepEls.forEach((s, i) => { s.className = 'tw-cup__step' + (i < cup.i ? ' is-done' : i === cup.i ? ' is-now' : ''); });
      tapEls.forEach((t, i) => {
        const tap = stationDef(cup, key).kind === 'taps' ? cup.taps[i] : null;
        t.hidden = !tap;
        if (tap) { t.style.left = (tap.v * 100).toFixed(2) + '%'; t.className = 'tw-cup__tap is-g' + tap.g; }
      });
    }
    raf = requestAnimationFrame(paint);
  }
  const wake = () => { if (!raf && !box.hidden) raf = requestAnimationFrame(paint); };
  const sleep = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  // ⚠️ THE POUR IS A HOLD, AND A HOLD IS FRAGILE. A vertical drag begun on a control inside anything
  // that can scroll gets `pointercancel` after two moves and the pour dies before it is written —
  // measured. So: touch-action:none in the CSS, a container that cannot scroll, and release listened
  // for on the WINDOW (a thumb that slides off the button still finishes its pour). A scroll that wins
  // arrives as pointercancel, which lets the pour go where it stands.
  //
  // 📱 AND IT IS ONE THUMB (Trym, 23 Sep: the counter "struggled to work properly on my iphone … the action
  // button … didnt work all the time"). Only the finger that pressed can let go: a palm or a second finger
  // lifting anywhere on the screen used to end the pour, and so did any move from it. And the press is judged
  // at the thumb's own instant — the event's timestamp, not whenever a busy phone got round to running this —
  // which is what the top of this file always said it did.
  let pid = null;
  const stamp = (e) => {
    const n = now();
    if (opts.now || !e) return n;   // a caller with its own clock keeps it
    const t = e.timeStamp;
    return t > 0 && t <= n && n - t < 400 ? t : n;   // a stamp from another clock, or a stale one, is not an instant
  };
  function down(e) {
    if (!cup || cup.done) return;
    if (e.cancelable) e.preventDefault();
    holding = true; pid = e.pointerId; cx = e.clientX; cy = e.clientY;
    try { go.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic event has no pointer to capture */ }
    go.classList.add('is-held');
    const r = press(cup, stamp(e));
    box.classList.toggle('is-pouring', !!(cup && cup.held));   // ☕ the stream falls only while the thumb is down
    if (r) step(r);
  }
  function up(e) {
    if (!holding || (e && e.pointerId !== pid)) return;
    holding = false; pid = null;
    go.classList.remove('is-held');
    box.classList.remove('is-pouring');
    if (!cup || cup.done) return;
    const r = release(cup, stamp(e));
    if (r) step(r);
  }
  function move(e) {
    if (!holding || e.pointerId !== pid) return;
    // the thumb wandered right away from the counter: let the pour go where it stands rather than hang on
    if (Math.hypot(e.clientX - cx, e.clientY - cy) > HOLD_SLOP * 12) up(e);
  }
  // 📱 THE WHOLE TOUCH IS THE COUNTER'S. Cancelling pointerdown only stops the compatibility mouse events; iOS
  // runs its own long-press, selection and double-tap recognisers on the touch underneath, and any of them can
  // cancel a pour mid-hold. A cancelled touchstart tells Safari none of them apply. It needs a listener that is
  // allowed to cancel, so it is not passive.
  const own = (e) => { if (e.cancelable) e.preventDefault(); };
  function step(r) {
    if (opts.onStep) opts.onStep(r, cup);
    if (!r.done) return;
    const done = cup;
    sleep(); cup = null;
    if (opts.onCup) opts.onCup(done);
  }
  go.addEventListener('pointerdown', down);
  go.addEventListener('touchstart', own, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('pointermove', move, { passive: true });

  return {
    el: box,
    // the ticket is pictures: one pip per thing in the drink, and never a word
    serve(c, label) {
      cup = c;
      shown = stationOf(c);
      box.dataset.st = shown;
      box.classList.toggle('is-big', !!c.big);   // 🍋 a big glass: a bigger ticket
      const ord = orderOf(c);
      if (stepEls.length !== ord.length) { steps.innerHTML = ''; stepEls = ord.map(() => el('i', 'tw-cup__step', steps)); }   // one dot a step of THIS order
      clearTaps();
      note.textContent = '';
      tickEl.textContent = '';
      for (const k of (c.pips || deckOf(c).drinks[c.drink] || [])) el('i', 'tw-cup__pip' + (k === 'bean' ? '' : ' tw-cup__pip--' + k), tickEl);
      go.textContent = label || '';
      go.disabled = false;
      go.hidden = false;
      zoneEl.hidden = false;
      wake();
    },
    // ⚠️ AN EMPTY TRAY HAS TO SAY WHY. Clocked in with nobody at the rope, the player saw no ticket,
    // a still gauge and a dead button, with nothing to tell them the counter was working and merely
    // quiet rather than broken. (Seen on the QA sweep at 360 wide, 20 Sep.)
    // ⚠️ AND AN EMPTY TRAY SHOWS NOTHING THAT IS NOT TRUE. Seen on the 360 sweep: the zone kept its two
    // 2 px green borders at width 0, so a still gauge carried a green stub that read as a target; and the
    // one button sat there as a dead yellow slab with no word on it, which reads as broken rather than
    // quiet. The band goes away and the button goes with it — what is left is the line that says why.
    idle(label) { cup = null; sleep(); clearTaps(); delete box.dataset.st; box.classList.remove('is-big'); tickEl.textContent = ''; note.textContent = opts.idle ? opts.idle() : ''; go.textContent = label || ''; go.disabled = true; go.hidden = !label; needle.hidden = true; fillEl.hidden = true; zoneEl.hidden = true; zoneEl.style.width = '0%'; stepEls.forEach((s) => { s.className = 'tw-cup__step'; }); },
    // 🪙 the running total for the shift (0 hides it: a fresh shift has nothing to show yet)
    jugs(n) { n = n | 0; jugEl.hidden = n <= 0; jugEl.innerHTML = '<i></i>'.repeat(Math.max(0, n)); },
    tips(n) { n = n | 0; tipsEl.hidden = n <= 0; tipsEl.innerHTML = COIN + '<b>' + n + '</b>'; tipsEl.classList.remove('is-pop'); void tipsEl.offsetWidth; tipsEl.classList.add('is-pop'); },
    say(text) { note.textContent = text || ''; },
    // ⚠️ the town's toast docks at bottom 14 and outranks this by 800 of z-index, so it lands square
    // on the gauge unless it is moved. It steps up for as long as the tray is up, and back down after.
    show() { box.hidden = false; box.classList.remove('is-folded'); toast(true); wake(); },
    fold() { box.classList.add('is-folded'); toast(false); sleep(); },   // off the mark: the cup waits
    hide() { box.hidden = true; toast(false); sleep(); },
    open: () => !box.hidden && !box.classList.contains('is-folded'),
    cup: () => cup,
    // ⚠️ the walk's door: nothing in tests/ has ever driven a canvas, and a rAF gauge cannot be
    // thumbed by Playwright at a real millisecond. These let it press at an exact instant.
    seam: {
      finish: (g) => { if (!cup) return false; const done = cup; done.done = true; done.grade = g | 0; sleep(); cup = null; if (opts.onCup) opts.onCup(done); return true; },   // QA: the cup made at a chosen grade
      // ⚠️ the class too, or the bench and every walk show a pour with no stream while a real thumb shows one
      press: (t) => { const r = cup ? press(cup, t) : null; box.classList.toggle('is-pouring', !!(cup && cup.held)); if (r) step(r); return r; },   // ⚠️ a pour's press STARTS a hold and grades nothing: stepping on null would log a phantom wrong
      release: (t) => { const r = cup ? release(cup, t) : null; box.classList.remove('is-pouring'); if (r) step(r); return r; },
      at: (t) => (cup ? (tick(cup, t), cup.v) : -1),
      zone: () => (cup ? zoneOf(cup, stationOf(cup)) : null),
      station: () => (cup ? stationOf(cup) : ''),
      // the exact instant this station is PERFECT, so a walk can thumb it without waiting for a
      // real second — v is a pure function of (t - t0), so the moment can be solved rather than hunted
      best: (t) => {
        if (!cup) return 0;
        const key = stationOf(cup); tick(cup, t);
        const st = stationDef(cup, key), z = zoneOf(cup, key);
        if (st.kind === 'hold') return (cup.held || t) + z.at * st.span;
        // ⚠️ the swell's band no longer sits AT the top of the bar, so the perfect instant is where the
        // rising leg crosses it (v = 2p on the way up), not the peak — and it comes round every span
        if (st.kind === 'taps') { const c = cup.t0 + (z.at / 2) * st.span; return c >= t ? c : c + Math.ceil((t - c) / st.span) * st.span; }
        const c = cup.t0 + z.at * st.span;                       // the needle's first pass over the band
        return c >= t ? c : c + Math.ceil((t - c) / (st.span * 2)) * st.span * 2;
      },
    },
    destroy() { sleep(); toast(false); go.removeEventListener('pointerdown', down); go.removeEventListener('touchstart', own); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('pointermove', move); box.remove(); },
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
// ⭐ A WHOLE BANANA, SEEN FROM THE CHEST UP (Trym, 19 Sep: "bigger than that, but only upper body").
// That is the pack's own composition — its barista is a head and shoulders behind a counter — and it is
// what lets the banana be nearly full size at last. It does not stand ON the hatch floor: it stands
// BEHIND the counter, feet below the opening and out of sight, with its crown tucked just inside the
// arch. So the window frames the half of a banana that has a face in it, and the kiosk keeps the rest.
//
// ⚠️ 58 is a ceiling, and arithmetic rather than taste: the hands sit 0.729 of the height above the
// feet, which at 58 puts them level with the widest part of the arch — any taller and the ellipse takes
// the fingertips, any shorter and the legs come back into the window. 28 was too small and 35 was still
// small, both on screen.
const DRAWN = 58;
const LEAN = 3;          // how far inside the arch the crown sits, so the head is framed and not cropped
const FRAME_H_FRAC = 0.66, FRAME_TOP_FRAC = 0.20;   // src/lib/banana-geo.js — the drawn frame inside its square canvas

// ☕ THE ROPE — and the first three numbers here were wrong in all three ways a queue can be wrong.
//
// ⚠️ IT IS NOT A LANE BELOW THE COUNTER. Measured in the real town rather than derived on the bench:
// at 360×740 the whole 2200×1300 world FITS the view (scale 0.628), so the tray's 150 screen px own
// the world's bottom 239 — everything past world y 1061 is behind the counter UI, and at 393 past
// 1083. The old rope ran 1075 → 1135 straight down into that, so two of three customers stood behind
// the tray at 393 and all three at 360. The band that is actually visible is 1041 to 1061: twenty
// pixels, between the storefronts' feet and the fold. So the queue runs ALONG the pavement.
//
// ⚠️ AND IT IS 102 PX BETWEEN MARKS, because a body is drawn 99 world px wide and centred on its
// mark. Thirty px of spacing overlapped each banana with the next by 57%, measured — a pile, not a
// line. Three px of daylight is not much, but it is a queue.
//
// ⚠️ AND NOBODY STANDS IN FRONT OF THE HATCH. The serving window is x 1806–1852 and that is where
// your own banana's face is; a customer on the mark 1830 would span 1780–1880 and cover it. The head
// of the queue stands at the window's left shoulder, which is where a person stands at a hatch.
//
// Every mark is inside the south street's own rectangle (STREETS: 260,1040 → 2020,1140) so the
// router walks them there, and every foot is below the storefronts' base of 1040 so they are drawn
// in front of the buildings instead of inside them.
// ⚠️ AND EXACTLY ONE BODY BETWEEN MARKS, no more. At 102 the tail of the queue fell off the left edge
// of the view — the camera follows the player, who is standing at the kiosk, and only about 520 world
// px are on screen at a phone's width. 99 is what a banana is drawn at, so it is the tightest a queue
// can be and still be a line, and it brings the third customer back inside the frame.
// ⚠️ AND IT IS TWO MARKS, NOT THREE. Measured on four phones: the camera follows the player, who is
// standing at the kiosk, so only about 520 world px are on screen — and with bodies 99 px wide the third
// customer's left edge sat 37 to 43 px OUTSIDE the view at every size, including Trym's own 393. The
// arithmetic does not bend: three bodies that do not overlap need 297 px of a band that starts at the
// serving window and runs off the frame. A queue of two that you can see beats a queue of three you
// cannot, and two at a kiosk hatch is what a queue looks like anyway.
const ROPE = [[1752, 1052], [1653, 1048]];
const PATIENCE = 34000;          // how long a banana will stand there before it gives up
const NEXT = [5200, 12000];      // the gap between arrivals, while you are behind the counter

// ⭐ THE COUNTER IS A MARK ON THE GROUND, and the shift is a DISTANCE from it (the plan §7, and
// Trym's 19 Sep decision in the same words: "step off the mark and it folds; the customer keeps its
// ticket; step back and it rises"). Without this the shift had no geography at all: clocking in hid
// your banana with a class and nothing ever measured where you were, so you could walk the whole
// square as nobody, serving cups for a queue three screens away. Five separate critics found it.
//
// NEAR is town-work.js's own number for turning up at your workplace, so the radius that counts as
// "behind the counter" is the same one that counts as "at work". STAY is how long the world waits
// before it decides you meant to leave — and AWAY is far enough that it stops waiting and pays you.
const NEAR = 120, AWAY = 420, STAY = 8000;

export function bootTownCafe(ctx, cfg0) {
  const { world, W, H, pct, PROPS, CAFE_WIN, drawMe, outfit, say, track, folk, openCard, closeCard, esc, inside, shutHere, pos, float, hud } = ctx;
  // ⭐ ONE COUNTER ENGINE, TWO COUNTERS (22 Sep 2026): the queue, the patience, the cup, the tips and the till are
  // the same at the lemonade stand as here, so the stand CONFIGURES this rather than copying it — its own deck,
  // rope, words, held item, mark and way of standing behind the counter (town-lemon.js). The café's own are the
  // defaults, so everything below reads exactly as it did.
  const cfg = { at: 'cafe', deck: CAFE_DECK, copy: COPY, rope: ROPE, item: 'mug', special: { station: 'syrup', tip: 1 }, ...(cfg0 || {}) };   // ☕ special orders are the café's (UNLOCKS grants them nowhere else)
  const WORDS = cfg.copy;
  let atWork = null, tray = null, on = false;
  // ☕ THE QUEUE. Each entry is a visitor the counter has borrowed from town-folk.js, its drink, and
  // the moment it arrived — which is its patience clock. ⚠️ the counter does NOT own the body: it
  // borrows it, moves it, and hands it back, so a customer that gives up rejoins its own day.
  let line = [], cup = null, served = 0, tips = 0, best = 0, nextAt = 0, shiftAt = 0;
  let away = 0;   // the moment the player stepped off the counter mark; 0 while they are on it
  let held = false;   // something else asked for the bottom of the screen (the pocket): the tray yields
  let lastBest = '';   // which drink the last right cup was, for the receipt to name
  let grades = [], xpGot = 0;   // 🪜 the shift's cups by grade, reported once at clock-out, and the XP they came to
  let bigSaid = false, bigNext = null, jug = 0, jugSaid = false, specialSaid = false, specialNext = null;   // 🍋 the first big glass of a shift is announced, the rest are not; a walk may order the next one
  let saidGrade = {}, tipsAllSaid = false, cappedHit = false, qaQuiet = false;   // qaQuiet: a walk holds the ordinary arrivals   // 🗣 the first good and first spot-on cup of a shift speak; the day's last tip is said once
  // ☕ THE RUSH (the café's rank 2, 23 Sep 2026; the ladder's slice 3). Once a day, a little way into a shift, the customers
  // stop leaving gaps: RUSH_N come one straight after another, and serving every one of them is a bonus on top of the
  // cups (jobs.js XP.cafe.rush). ⚠️ NOT "THREE AT ONCE", which the plan said: the rope holds two because a third customer
  // stands off every phone's screen (ROPE, above), so a rush is a stream you can see rather than a crowd you cannot.
  // ⚠️ AND NOT A SHARED CLOCK: "the same moment for everyone" would be met by almost nobody at ten players a day.
  // 🍋 THE JUG (the stand's rank 3, 23 Sep 2026; the ladder's slice 3). When nobody is waiting, the tray offers the jug: hold to
  // fill it, and the next glasses skip the squeeze. It gives the quiet moments between customers something to do, and pays
  // for it in the busy ones. A customer who reaches the front first always wins: an untouched jug offer steps aside.
  const jugOn = () => !!cfg.jug && unlocked(cfg.at, 'jug', rank());
  function jugOffer() {
    const c = newCup('jug', 0, seedAt(served + 7), cfg.deck);
    c.order = [cfg.jug.station]; c.pips = ['jug']; c.jug = true;
    cup = c;
    tray.serve(c, (WORDS.go || {})[cfg.jug.station] || '');
    // ⚠️ said ONCE a shift, as the town's line — not under the tray: a tray with an order on it has no room for a note (150 px)
    if (!jugSaid && (WORDS.jug || {}).offer) { jugSaid = true; say(WORDS.jug.offer); }
  }
  // ☕ SPECIAL ORDERS (the café's rank 3): some orders add a syrup step, read off the ticket's own pictures, and tip a little more
  const specialOn = () => !!cfg.special && unlocked(cfg.at, 'special', rank());
  const RUSH_N = 4, RUSH_AFTER = 2;
  let rush = null, rushXp = 0;   // { left, got, lost } while one runs
  const today = () => Math.floor(Date.now() / 864e5);
  let rushDay = -1;   // the day already known to have had its rush: asked every idle frame, so it is read from storage once
  const rushed = () => { if (rushDay === today()) return true; try { const r = JSON.parse(localStorage.getItem('tw-rush-v1') || 'null'); if (r && r.d === today()) { rushDay = r.d; return true; } } catch (e) {} return false; };
  function rushStart() {
    rush = { left: RUSH_N, got: 0, lost: 0 };
    rushDay = today();
    try { localStorage.setItem('tw-rush-v1', JSON.stringify({ d: today() })); } catch (e) {}
    if ((WORDS.rush || {}).on) say(WORDS.rush.on);
    track('town_cup', { at: cfg.at, r: 'rush' });
  }
  function rushCheck() {
    if (!rush || rush.left > 0 || rush.got + rush.lost < RUSH_N) return;
    const ok = !rush.lost;
    rush = null;
    if (!ok) return;
    if ((WORDS.rush || {}).done) say(WORDS.rush.done);
    if (ctx.chore) { const p = ctx.chore('rush'); rushXp += (p && p.got) | 0; }
    track('town_chore', { at: cfg.at, kind: 'rush' });
  }
  // the mark is the workplace's own front, the same point town-work.js measures turning up against
  const mark = cfg.mark || (() => { const p = PROPS && PROPS.cafe; return p ? { x: p.x + p.w / 2, y: p.base } : null; });

  function cafeStandIn() {
    if (atWork || !CAFE_WIN) return;
    const [cx, , baristaH, , winTop] = CAFE_WIN;
    void baristaH;
    // the crown sits just inside the arch, and the feet fall wherever they fall — behind the counter
    const floor = (winTop || 0) + LEAN + DRAWN;
    const w = DRAWN / FRAME_H_FRAC;   // the ELEMENT is bigger than the banana: hats live in the headroom
    const el = document.createElement('div');
    el.className = 'tw-atwork';
    const cv = document.createElement('canvas');
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
    paint();   // ⚠️ only once it is IN the world, because the size it is drawn at is the size it lands at
    const me = world.querySelector('.tw-me');
    if (me) me.classList.add('is-serving');   // ⚠️ a CLASS, never [hidden]: authored display beats it
  }
  function cafeStepOut() {
    if (atWork) { atWork.remove(); atWork = null; }
    clearTimeout(rz);
    const me = world.querySelector('.tw-me');
    if (me) me.classList.remove('is-serving');
  }
  // the café stands its banana in the kiosk's window; the stand steps its banana round the back of the table
  const standIn = cfg.standIn || cafeStandIn, stepOut = cfg.stepOut || cafeStepOut;

  // ---- the queue ---------------------------------------------------------------------------------
  const seedAt = (n) => Math.abs(Math.floor(Date.now() / 60000) * 2654435761 + n * 40503) >>> 0;
  function callOne(now, inRush) {
    if (line.length >= cfg.rope.length || !folk) return null;
    const f = folk();
    if (!f) return null;
    const free = f.idle().filter((v) => !line.some((q) => q.v === v));
    if (!free.length) return null;
    const seed = seedAt(served + line.length);
    const v = free[seed % free.length];
    const spot = cfg.rope[line.length];
    const ids = Object.keys(cfg.deck.drinks);
    // 🍋 at the stand's second rank some orders are a big glass (the deck names its longer station)
    const big = !!cfg.deck.big && (bigNext != null ? bigNext : unlocked(cfg.at, 'big', rank()) && (seed >>> 5) % 3 === 0);
    bigNext = null;
    const special = !!cfg.special && (specialNext != null ? specialNext : specialOn() && seed % 3 === 1);
    specialNext = null;
    const row = { v, drink: ids[seed % ids.length], at: 0, seed, big, special, rush: !!inRush };
    line.push(row);
    f.take(v, { x: spot[0], y: spot[1] }, () => { row.at = performance.now(); });
    void now;
    return row;
  }
  // ⭐ PATIENCE IS THE BODY AND NOTHING ELSE (the Quiet Rule). Green, amber at half, red at a fifth,
  // and then they turn and go — a shadow under a banana, never a bubble over one.
  function patienceTick(now) {
    for (let i = line.length - 1; i >= 0; i--) {
      const row = line[i];
      if (!row.at) continue;
      const left = 1 - (now - row.at) / PATIENCE;
      folk().patience(row.v, left <= 0.2 ? 2 : left <= 0.5 ? 1 : 0);
      if (left > 0) continue;
      // gone. The body does the acting: it turns its back and walks off, and the town says so once.
      drop(i, false);
      if (row.rush && rush) { rush.lost++; rushCheck(); }
      if (WORDS.left) say(WORDS.left);
      track('town_cup', { at: cfg.at, r: 'left' });
    }
  }
  function drop(i, sit) {
    const row = line[i];
    line.splice(i, 1);
    if (folk()) { folk().patience(row.v, null); folk().release(row.v, sit); }
    if (cup && cup.row === row) { cup = null; if (tray) tray.idle(''); }
    // everyone behind shuffles up
    line.forEach((q, n) => { const spot = cfg.rope[n]; if (folk()) folk().take(q.v, { x: spot[0], y: spot[1] }, () => { if (!q.at) q.at = performance.now(); }); });
  }
  // the banana at the front puts its order on the tray, and nothing happens until it has
  function serveNext() {
    if (!tray || !on) return;
    const row = line.find((q) => q.at);
    if (cup && cup.jug && row && !cup.held && !cup.i) cup = null;   // 🍋 a customer first: the jug waits for the next quiet moment
    if (cup || !row) return;
    const c = newCup(row.drink, served, row.seed, cfg.deck);
    c.row = row; c.big = !!row.big;
    if (c.big && !bigSaid) { bigSaid = true; if (WORDS.big) say(WORDS.big); }
    if (jug > 0 && cfg.jug && !c.big) { c.order = cfg.deck.order.filter((k) => k !== cfg.jug.skip); c.fromJug = true; }   // 🍋 poured from the jug
    if (row.special) {
      c.order = [...cfg.deck.order, cfg.special.station]; c.pips = [...(cfg.deck.drinks[c.drink] || []), cfg.special.station]; c.special = true;
      if (!specialSaid) { specialSaid = true; if (WORDS.special) say(WORDS.special); }
    }
    cup = c;
    // ⚠️ NOT THE DRINK'S NAME. The ticket on the tray is pictures and the names are for the
    // receipt — the button said "Little Wake" for a day, which is the shop's word for a small
    // coffee and tells a thumb nothing at all. It carries the STATION now, and follows it.
    tray.serve(c, (WORDS.go || {})[stationOf(c)] || '');
  }
  function onCup(c) {
    if (c.jug) {   // 🍋 the jug, filled (or spilt): no customer, no tip — glasses without a squeeze
      cup = null; jug = c.grade ? cfg.jug.n : 0;
      const w = WORDS.jug || {};
      if (c.grade ? w.full : w.spilt) say(c.grade ? w.full : w.spilt);
      if (tray.jugs) tray.jugs(jug);
      track('town_cup', { at: cfg.at, r: 'jug', g: c.grade | 0 });
      tray.idle('');
      return;
    }
    if (c.fromJug) { jug = Math.max(0, jug - 1); if (tray.jugs) tray.jugs(jug); }
    const row = c.row, i = line.indexOf(row);
    // 🪜 a tip only while today's cap has room: past it the cup still counts — for its work XP — and floats nothing
    const full = tipFor(c.grade) * (c.big ? 2 : 1) + (c.special && c.grade ? cfg.special.tip : 0);   // 🍋 a big glass: twice the tip; ☕ a special: a little more
    const n = Math.min(full, Math.max(0, left() - tips));
    tips += n; served++; grades.push(c.grade | 0);
    if (c.big) grades.push(c.grade | 0);   // …and two glasses' worth of work XP
    // 🪙 THE TIP IS SEEN THE MOMENT IT IS EARNED (Trym, 21 Sep: "its not very obvious how i make tips while
    // working, so there needs to be some system to visualize how im making a couple of coins per coffee").
    // A +n floats up from the hatch, and the tray's own counter keeps the shift's total — numbers and the
    // coin, no words. The coins themselves still land at clock-out, through the one faucet the server knows.
    const m = mark();
    if (float && m && n > 0) float(m.x, m.y - 96, '+' + n);
    if (tray && tray.tips) tray.tips(tips);
    if (c.grade === 2) { best++; lastBest = c.drink; }
    // 🗣 A LINE ONLY WHEN IT TELLS YOU SOMETHING (24 Sep 2026, design library §30). The +n over the hatch already says a good
    // cup tipped, so a good cup and a spot-on cup each speak the FIRST time in a shift (what the grade was, and that the
    // middle of the band tips more) and then leave it to the float. A wrong cup speaks every time: nothing floats, and the
    // line is the only thing that says why. The day's last tip is said once, when it happens — the cups after it float
    // nothing and must not be read as wrong.
    const capped = full > n;
    if (capped) cappedHit = true;
    if (capped && !tipsAllSaid && WORDS.tipsAll) { tipsAllSaid = true; say(WORDS.tipsAll); }
    else if (!capped && (c.grade === 0 || !saidGrade[c.grade])) { saidGrade[c.grade] = 1; const deck = deckLineOf(WORDS, GRADES[c.grade], served); if (deck) say(deck); }
    track('town_cup', { at: cfg.at, r: GRADES[c.grade], big: c.big ? 1 : 0, special: c.special ? 1 : 0, jug: c.fromJug ? 1 : 0 });
    if (row && row.rush && rush) { rush.got++; rushCheck(); }
    cup = null;
    // ☕ THE CUP GOES WITH THEM, and it is the only thing on screen that says a coffee was made: the
    // toast is gone in four seconds and the terrace is across the square. `mug` is no longer carried by
    // random strangers, so one in the town now means exactly this (Trym, 20 Sep).
    if (i >= 0) { const f = folk && folk(); if (f && f.hand) f.hand(row.v, cfg.item); drop(i, true); }   // served: they go and sit with it
    tray.idle('');
  }

  function clockIn(host) {
    if (on) return false;
    on = true;
    saidGrade = {}; tipsAllSaid = false; cappedHit = false;
    served = 0; tips = 0; best = 0; lastBest = ''; shiftAt = performance.now(); nextAt = 0; line = []; away = 0; grades = []; xpGot = 0; bigSaid = false; rush = null; rushXp = 0; jug = 0; jugSaid = false; specialSaid = false;
    standIn();
    if (!tray) tray = mountCounter(host || world.parentElement, { onCup, deck: cfg.deck, label: (k) => (WORDS.go || {})[k] || '', idle: () => WORDS.idle || '', leave: WORDS.leave || '', onLeave: () => clockOut() });
    if (tray.tips) tray.tips(0);
    if (tray.jugs) tray.jugs(0);
    tray.show();
    tray.idle('');
    if (WORDS.on) say(WORDS.on);
    track('town_shift', { at: cfg.at, step: 'in' });
    return true;
  }
  function clockOut() {
    if (!on) return false;
    on = false;
    for (let i = line.length - 1; i >= 0; i--) drop(i, false);
    cup = null;
    stepOut();
    if (tray) { tray.idle(''); tray.hide(); }
    track('town_shift', { at: cfg.at, step: 'out', cups: served });
    // ⭐ THE TILL. Paid ONCE, at the end, through the only faucet the server knows — and `pay` reads
    // what today's cap still allows BEFORE it hands anything over, so the counter stops paying rather
    // than paying coins that evaporate at the next ack.
    const paid = tips > 0 ? pay(tips, { cups: served, best }) : 0;
    // 🪜 the shift's cups go on the ladder in ONE report (a list of grades), and the receipt shows what they earned
    xpGot = 0;
    if (grades.length && ctx.chore) { const p = ctx.chore('cup', grades.slice(0, 60)); xpGot = (p && p.got) | 0; }
    xpGot += rushXp;   // ☕ a rush's bonus is on the receipt too
    rush = null;   // a rush cut short by the end of the shift pays nothing
    if (ctx.hush) ctx.hush();   // the receipt IS the end of the shift: the last cup's line does not linger under it
    receipt(paid);
    return true;
  }
  // ⭐ THE TILL — moved here from town-room.js's context on 23 Sep 2026 (that chunk is at its cap, and the till is the
  // counter's own business). It reads the cap BEFORE it pays: RULES.town.tips allows 12 an event and, per day, the
  // RANK's cap (a fifth of its full week) — and a faucet over its cap is refused WHOLE, so a counter that just handed
  // over its total would watch the coins evaporate at the next ack. It pays in pieces the rule accepts, counts the
  // day's room in the coins that will LAND (the stew buff doubles them on the way in), and says what landed.
  const rank = () => { const j = ctx.job ? ctx.job() : null; return Math.max(1, ((j && j.lad && j.lad.rank) | 0)); };
  const buff = () => (coinsPaid(1) > 1 ? 2 : 1);
  function room() { let used = 0; try { used = ruleUsed('town:tips').used | 0; } catch (e) {} return Math.max(0, tipsCap(cfg.at, rank()) - used); }
  const left = () => Math.floor(room() / buff());   // today's room in the tips a cup is counted in
  function pay(n, how) {
    const x = buff();
    const give = Math.min(n | 0, left());
    const each = Math.floor(12 / x);              // the most one event may carry once the buff has doubled it
    for (let k = give; k > 0; k -= each) passStat('coins_earned', Math.min(each, k), 'tips');
    const landed = give * x;
    if (landed > 0) { float(pos.x, pos.y - 40, '+' + landed); if (hud && hud.refresh) hud.refresh(); }
    track('town_shift', { at: cfg.at, step: 'paid', n: landed, cups: (how && how.cups) | 0 });
    return landed;
  }
  // 🪜 the ladder as the receipt draws it: this shift's XP, and a bar from this rank's line to the next one's
  function ladderHtml(w) {
    const j = ctx.job ? ctx.job() : null, l = j && j.lad;
    if (!w.xp || !l || !grades.length) return '';
    const a = xpAt(cfg.at, l.rank) | 0, b = xpAt(cfg.at, l.rank + 1);
    const k = b == null ? 1 : Math.max(0, Math.min(1, ((l.xp | 0) - a) / (b - a)));
    return '<p class="tw-cup__xp">' + esc(w.xp.replace('{n}', String(xpGot))) + '</p><div class="tw-cup__xpbar"><i style="transform:scaleX(' + k.toFixed(3) + ')"></i></div>';
  }
  // ⭐ THE RECEIPT is a card, and a card is right HERE and nowhere else in the café: the shift is over,
  // so the square no longer has to be visible behind it. ⚠️ it shows WHAT THE CAP ALLOWED, not what the
  // grades came to — a receipt that promises coins the server refused would be a lie on a piece of paper.
  function receipt(paid) {
    const w = WORDS.receipt || {};
    if (!openCard || !w.title) return;
    // ⚠️ THREE OUTCOMES, NOT TWO. paid === 0 meant `none` — "the cups stayed stacked and dry" — and a
    // player who had served a full queue after the day's 120-coin tip cap was spent read exactly that.
    // A shift that served nothing and a shift the cap refused are different days, and the receipt says so.
    const line = paid > 0
      ? (w.take || '').replace('{n}', String(paid))
      : served > 0 ? ((cappedHit ? w.capped : w.wrong) || w.none || '') : (w.none || '');   // the day's limit, or every cup missed
    // 🧾 THE RECEIPT SAYS THE RESULT AND NOTHING ELSE (24 Sep 2026, the copy review): the take (or why there is none), the work
    // XP and its bar. It used to add a line of scenery and a drink's name the ticket never shows — and the shift's end was
    // said twice, a toast as the receipt opened. The receipt IS the end of the shift.
    openCard('<div class="tw-cup__till">'
      + '<h2>' + esc(w.title) + '</h2>'
      + (line ? '<p class="tw-cup__take">' + esc(line) + '</p>' : '')
      + ladderHtml(w)
      + (w.back ? '<button class="tw-cta" id="twTillX" type="button"><span class="tw-cta__verb">' + esc(w.back) + '</span></button>' : '')
      + '</div>');
    const b = document.getElementById('twTillX');
    if (b && closeCard) b.addEventListener('click', () => closeCard());
  }
  // ⚠️ A SHIFT THAT ENDS WITH THE PAGE ENDS WITH ITS TIPS PAID. Walking out of the town — the travel
  // door, the south road, the back button, a closed tab — used to throw the whole shift's earnings
  // away, because the only thing that ever called pay() was a clock-out the player had to perform.
  // passStat() writes to storage before it syncs, so a payout on pagehide is durable.
  const onHide = () => { if (on) clockOut(); };
  window.addEventListener('pagehide', onHide);

  function tick(now) {
    if (!on) return;
    // ⚠️ WALKING INTO A SHOP IS WALKING AWAY, and the brief says walking away IS clocking out. Without
    // this the tray stayed up over the store's plate and your own banana went on standing in the café's
    // window while you were inside somebody else's shop — the tray is a child of the VIEW, so neither of
    // the world's `.is-inside` hide lists can reach it. (Seen on the QA sweep, 20 Sep.)
    if (inside && inside()) { clockOut(); return; }
    // ⚠️ AND A FRONT CAN CLOSE UNDER YOU. enterCurse() adds the café to the town's shut set on every
    // creeping and deep night, and a band that falls far enough does the same — so a shift can end up
    // running behind a taped-up shutter in a dark window. The shut ENDS the shift and opens the
    // receipt, which is the one outcome that is never a silently dead counter.
    if (shutHere && shutHere()) { clockOut(); return; }
    // ⭐ AND THE MARK ITSELF. Off it: the tray goes down, your banana steps out of the window and
    // walks as itself again, and the rope keeps its clock — so "serve the next cup, or step out and
    // relight the lamp" is finally a choice with a cost on both sides. Stay off it, or go far
    // enough, and the shift is over and the receipt comes.
    const m = mark();
    if (m && pos) {
      const d = Math.hypot(pos.x - m.x, pos.y - m.y);
      if (d > AWAY) { clockOut(); return; }
      if (d > NEAR) {
        if (!away) { away = now; stepOut(); if (tray) tray.fold(); }
        else if (now - away > STAY) { clockOut(); return; }
        patienceTick(now);   // ⚠️ the queue does not pause because you left: that IS the cost
        return;
      }
      if (away) { away = 0; standIn(); if (tray && !held) tray.show(); }
    }
    if (!rush && served >= RUSH_AFTER && !line.length && !cup && unlocked(cfg.at, 'rush', rank()) && !rushed()) rushStart();
    if (rush && rush.left > 0) { if (callOne(now, true)) rush.left--; }
    else if (!rush && !qaQuiet && now > nextAt) { nextAt = now + NEXT[0] + Math.random() * (NEXT[1] - NEXT[0]); callOne(now); }
    patienceTick(now);
    serveNext();
    if (!cup && !rush && jug === 0 && jugOn() && !line.some((q) => q.at)) jugOffer();   // 🍋 nobody waiting: the jug
    void shiftAt;
  }
  // ⚠️ DRAWN AT THE SIZE IT IS SHOWN, never at 150 and scaled down. The town's own bananas live in a
  // 150 px canvas inside a 4.5% element — about a 3× downscale — but this one is a third of that width,
  // and nearest-neighbour throwing away seven pixels in eight is what "a bit low res" looks like
  // (Trym, 19 Sep). So the canvas is sized to the element's real pixels, device ratio and all, and
  // redrawn when the world's scale changes. A banana in a window is the smallest one on screen and it
  // has the least room to be sloppy.
  function paint() {
    if (!atWork) return;
    const cv = atWork.firstChild;
    const px = Math.max(24, Math.round(atWork.getBoundingClientRect().width * (window.devicePixelRatio || 1)));
    if (cv.width !== px) { cv.width = cv.height = px; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, px, px);
    try { drawMe(g, px, POSE, outfit()); } catch (e) {}
  }
  // the player's own picture changes (a new hat, a curse), or the world is resized: draw it again
  function redraw() { paint(); }
  let rz = 0;
  const onResize = () => { clearTimeout(rz); rz = setTimeout(paint, 120); };
  window.addEventListener('resize', onResize);

  return {
    clockIn, clockOut, redraw, tick,
    // ☕ what the front says to somebody who does not work here — the rig's line, and the reason the
    // town loads this chunk on a tap from a stranger
    front: () => WORDS.front || '',
    at: () => cfg.at,
    // ☕ THE BOTTOM OF THE SCREEN IS NOT OURS ALONE. The pocket opens there too and is drawn under us,
    // so it asks the counter to stand down; tick() honours it rather than fighting it back up.
    hold(v) { held = !!v; if (!tray || !on) return; if (held) tray.fold(); else if (!away) tray.show(); },
    on: () => on,
    tray: () => tray,
    take: () => ({ served, tips, best }),
    seam: {
      on: () => on, clockIn, clockOut, counter: () => cfg.at,   // which counter this is (`at` below is the café's window)
      at: () => (atWork ? { z: +atWork.style.zIndex, w: atWork.style.width, top: atWork.style.top, clip: atWork.style.clipPath } : null),
      // ⚠️ the walk must measure what is SEEN, not the element: the banana is deliberately bigger
      // than the window now, and getBoundingClientRect knows nothing about a clip-path
      window: () => (CAFE_WIN.length > 6 ? { x0: CAFE_WIN[3], y0: CAFE_WIN[4], x1: CAFE_WIN[5], y1: CAFE_WIN[6] } : null),
      // ☕ the walk cannot stand at a counter for two minutes waiting for a queue to form
      line: () => line.map((q) => ({ drink: q.drink, waiting: !!q.at, x: Math.round(q.v.x), y: Math.round(q.v.y) })),
      call: () => { callOne(performance.now()); return line.length; },
      quiet: (v) => { qaQuiet = !!v; return qaQuiet; },   // QA: nobody comes unless the walk calls them
      arrive: () => { line.forEach((q) => { if (!q.at) { q.at = performance.now(); q.v.path = []; q.v.job = 'queue'; } }); return line.length; },
      cup: () => (tray ? tray.cup() : null),
      serve: () => { serveNext(); return !!(tray && tray.cup()); },
      rope: () => cfg.rope.map((r) => ({ x: r[0], y: r[1] })),
      // ☕ age every waiting body to a patience rung: the walk cannot stand at a counter for 34 real
      // seconds. ⚠️ it moves their ARRIVAL, not the rung — patienceTick recomputes the rung from `at`
      // every frame, so poking the rung directly is undone before the next paint.
      rung: (k) => { const n = performance.now(), f = [0, 0.65, 0.85][k | 0] || 0; line.forEach((q) => { if (q.at) q.at = n - PATIENCE * f; }); patienceTick(n); return line.length; },
      take: () => ({ served, tips, best }),
      tip: (n, g) => { tips += n | 0; served++; grades.push(g == null ? 2 : g | 0); return tips; },   // QA: a long shift's takings without forty real cups
      grades: () => grades.slice(), xp: () => xpGot, left,   // 🪜 the shift's cups by grade, the XP the receipt showed, today's room
      rush: () => (rush ? { ...rush } : null), rushed, rushNow: () => { if (!rush) rushStart(); return true; },   // ☕ the café's rank 2
      jug: () => jug, special: () => !!(tray && tray.cup() && tray.cup().special), specialNext: (v) => { specialNext = v == null ? null : !!v; return true; },   // 🔓 rank 3
      order: () => (tray && tray.cup() ? orderOf(tray.cup()).slice() : null),
      big: () => !!(tray && tray.cup() && tray.cup().big), bigNext: (v) => { bigNext = v == null ? null : !!v; return true; },   // 🍋 the stand's
      receipt: (n) => receipt(n | 0),
      gest: () => (tray ? tray.seam : null),   // the tray’s own thumb-door, so a walk can make a real cup
    },
  };
}
