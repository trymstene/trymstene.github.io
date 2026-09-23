// ✉️ THE POST OFFICE'S COUNTER — the sorting round (22 Sep 2026, docs/town-jobs-plan.md §11.4 and §12).
//
// Stamp hires you the way every boss does. Tap the post office and, for its own staff, the mailbox card
// carries one more button: the round. Your banana walks to the counter, the tray rises, and cards slide
// onto it one at a time, each with one of four postmarks — the park's flower, the bay's fish, a
// homestead's gate, the rave's note. Four pigeonholes wear the same marks; you tap the right one. A card
// sorted fresh is RIGHT, the right hole after a while is LATE, the wrong hole (or nobody at all) is
// WRONG. Twelve cards or two minutes, then a receipt — and a round where at least half the pile went
// where it was going counts on the week's sheet (`sort`, src/data/town/jobs.js). It never touches a real
// letter: delivery is instant (§6), the sort is theatre, and it pays on the weekly payslip like the store.
//
// ⭐ THE SAME TRAY AS THE CAFÉ, A SECOND DECK ON IT (Trym's shape, 19 Sep: the tray, not a card — the
// square stays alive behind it). `.tw-cup` is the café's box and its stylesheet; `.tw-cup--sort` is what
// this deck puts inside it. Everything above `mountSorter` is FORM-BLIND: a round is a pile, a clock and
// three grades, and nothing in it knows what draws them.
//
// ⚠️ THE THUMB IS JUDGED ON ITS OWN TIMESTAMP (the café's lesson): a tap carries an exact `now`, and a
// card's freshness is measured from the instant it landed, never from the last painted frame.
import { iconSvg } from '../lib/pixel-icons.js';
import { seedRand, burstInto } from '../lib/world.js';
import { roundXp, xpAt, unlocked } from '../data/town/jobs.js';   // 🪜 a round's points are its work XP (23 Sep 2026)

// ✉️ THE FIRST ROUND EXPLAINS ITSELF, ONCE (Trym, 22 Sep: "a small one-time notice by the sorting buttons that
// says something about what to do … Short and sweet"). One line under the pigeonholes through a device's
// first round, then never again — the flag lives here, the words are the rig's (`round.hint`).
const HINT_KEY = 'tw-sort-v1';
const hinted = () => { try { return !!(JSON.parse(localStorage.getItem(HINT_KEY) || 'null') || {}).hinted; } catch (e) { return false; } };
const setHinted = () => { try { localStorage.setItem(HINT_KEY, JSON.stringify({ hinted: 1 })); } catch (e) {} };

// ⭐ THE WORDS ARE GLOBBED HERE, in the round's own lazy chunk — town-post.json holds the post office's
// words, and its `round` block is this deck's (the mailbox chunk reads the rest of the file).
const COPY_MODS = import.meta.glob('../data/copy/town-post.json', { eager: true, import: 'default' });
const ALL = Object.values(COPY_MODS)[0] || {};
export const COPY = ALL.round || {};

// ---- the round, and nothing about a screen -----------------------------------------------------
// the four postmarks: where post from this counter goes. ⚠️ pixel icons from the bundled pack, never OS
// emoji, and each is a thing that area already owns (the park's beds, the bay's pier, a gate, the club).
// ✉️ THE FIFTH (rank 2, 23 Sep 2026; the ladder's slice 3): Stamp's senior sorters also sort the town's own post — a bell,
// the town hall's — and the pile comes faster (FAST). Rank 1 plays the first four, exactly as before.
export const MARKS = ['park', 'beach', 'home', 'rave', 'town'];
export const MARK_ICON = { park: 'flower-solid', beach: 'fish-solid', home: 'home', rave: 'music', town: 'bell' };
export const BASE = 4;             // the postmarks a first-rank round sorts
export const EACH = 3;             // cards of each postmark in a round
export const PILE = BASE * EACH;   // cards in a first-rank round: three of each postmark
export const FAST = { fresh: 3400, gone: 7500 };   // ✉️ the senior sorter's pile: a card goes stale and leaves sooner
export const ROUND_MS = 120000;    // a round is two minutes at most
export const FRESH_MS = 4200;      // sorted within this, a card is RIGHT; after it, the right hole is LATE
export const GONE_MS = 9000;       // a card nobody sorts leaves the counter as WRONG
export const COUNTS_AT = 0.5;      // the round counts on the week's sheet when this much of the pile went to the right hole
export const GRADES = ['wrong', 'late', 'right'];

export function newRound(seed, o = {}) {
  // a balanced pile — three of each postmark — shuffled by the seed, so every round teaches every hole
  const marks = o.marks || MARKS.slice(0, BASE), cards = [];
  for (let i = 0; i < marks.length * EACH; i++) cards.push(marks[i % marks.length]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(seedRand((seed | 0) * 31 + i * 7 + 11) * (i + 1));
    const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
  }
  return { seed: seed | 0, cards, holes: marks.slice(), fresh: o.fresh || FRESH_MS, gone: o.gone || GONE_MS, i: 0, t0: 0, at: 0, marks: [], right: 0, late: 0, wrong: 0, done: false, timeUp: false };
}
export const cardOf = (r) => (!r || r.done || r.i >= r.cards.length ? '' : r.cards[r.i]);
export function start(r, now) { r.t0 = now; r.at = now; return r; }
function land(r, g, now) {
  r.marks.push(g);
  if (g === 2) r.right++; else if (g === 1) r.late++; else r.wrong++;
  r.i++; r.at = now;
  if (r.i >= r.cards.length) r.done = true;
  return { g, i: r.i, done: r.done };
}
// the clock: a card left too long leaves the counter unsorted; the round's two minutes end it
export function tick(r, now) {
  if (!r || r.done || !r.t0) return null;
  if (now - r.t0 >= ROUND_MS) { r.done = true; r.timeUp = true; return { g: -1, i: r.i, done: true, timeUp: true }; }
  if (now - r.at >= (r.gone || GONE_MS)) return { ...land(r, 0, now), gone: true };
  return null;
}
export function sortInto(r, hole, now) {
  const c = cardOf(r);
  if (!c) return null;
  const g = hole !== c ? 0 : (now - r.at <= (r.fresh || FRESH_MS) ? 2 : 1);
  return land(r, g, now);
}
// how much of the card's time is left, 1 → 0 (for the tray to draw, and for nothing else)
export const fuse = (r, now) => (!r || r.done || !r.at ? 0 : Math.max(0, Math.min(1, 1 - (now - r.at) / (r.gone || GONE_MS))));
export const late = (r, now) => !!r && !r.done && !!r.at && now - r.at > (r.fresh || FRESH_MS);
// ⭐ the mail got where it was going: half the pile in the right hole, late or not, and the round counts
export const counts = (r) => !!r && r.right + r.late >= Math.ceil(r.cards.length * COUNTS_AT);

// ---- the tray: the one thing in here that knows about a screen ---------------------------------
const el = (tag, cls, host) => { const e = document.createElement(tag); if (cls) e.className = cls; if (host) host.appendChild(e); return e; };
const WAVE_MS = 700;   // the tally's wave at the end of a round, before the tray goes down (town-cafe.css twSortWave)

// mountSorter(host, opts) — the tray with the deck on it. It owns no state but the round in front of
// it: `opts.onLand(res, round)` on every card that lands, `opts.onDone(round, timeUp)` when the round ends.
// ⚠️ host must be a positioned, overflow-clipped box (#twView in the town) or the tray anchors to the page.
export function mountSorter(host, opts = {}) {
  const now = () => (opts.now ? opts.now() : performance.now());
  const box = el('div', 'tw-cup tw-cup--sort', host);
  box.hidden = true;
  const top = el('div', 'tw-cup__top', box);
  const pileEl = el('div', 'tw-sort__pile', top);     // the cards still to sort, as small sheets
  const tallyEl = el('div', 'tw-sort__tally');   // one mark per card of the pile, coloured as it lands — its own row, under the holes (placed below)
  // 🚪 the way out (Trym, 22 Sep): the round holds the banana at the counter, so the strip carries the one door out
  const leaveBtn = el('button', 'tw-cup__leave', top);
  leaveBtn.type = 'button';
  leaveBtn.textContent = opts.leave || '';
  leaveBtn.hidden = !opts.leave;
  leaveBtn.addEventListener('click', (e) => { e.stopPropagation(); if (opts.onLeave) opts.onLeave(); });
  const row = el('div', 'tw-sort__row', box);
  const cardEl = el('div', 'tw-sort__card', row);
  const stampEl = el('i', 'tw-sort__stamp', cardEl);
  const fuseEl = el('i', 'tw-sort__fuse', cardEl);
  const holes = el('div', 'tw-sort__holes', row);
  const names = (opts.holes && opts.holes()) || {};
  // the pigeonholes for the round's own postmarks: four at the first rank, five from the second
  let holeEls = [];
  function buildHoles(list) {
    if (holeEls.map((b) => b.dataset.mark).join() === list.join()) return;
    holes.innerHTML = '';
    holes.classList.toggle('is-five', list.length > 4);
    holeEls = list.map((m) => {
      const b = el('button', 'tw-sort__hole', holes);
      b.type = 'button'; b.dataset.mark = m;
      b.innerHTML = iconSvg(MARK_ICON[m], { size: 22 });
      if (names[m]) b.setAttribute('aria-label', names[m]);   // read out to somebody who cannot see the mark: the rig's word
      b.addEventListener('pointerdown', (e) => { if (e.cancelable) e.preventDefault(); hit(b); });
      return b;
    });
  }
  buildHoles(MARKS.slice(0, BASE));
  // ⚠️ THE TALLY HAS ITS OWN ROW. It shared the strip with the pile and the way out, and at the post office's second rank
  // (fifteen cards, 23 Sep 2026) the three needed ~560 px of a 360 phone's ~310: the pile folded into a column fifteen pips
  // tall and pushed the card and every pigeonhole out of the tray. Under the holes it has the tray's whole width.
  box.appendChild(tallyEl);
  const note = el('p', 'tw-cup__note', box);

  let r = null, raf = 0, ro = null;
  // ⚠️ the town's toast docks at the bottom and outranks the tray, so it steps up to the top of the view
  // for as long as the tray is up — the café's own recipe, measured off the HUD strip.
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

  function paintCard() {
    const c = cardOf(r);
    cardEl.hidden = !c;
    pileEl.innerHTML = '';
    if (!c) return;
    for (let i = r.i; i < r.cards.length; i++) el('i', 'tw-sort__pip', pileEl);
    stampEl.innerHTML = iconSvg(MARK_ICON[c], { size: 28 });
    cardEl.classList.remove('is-late', 'is-in');
    void cardEl.offsetWidth;   // so the next card slides in again
    cardEl.classList.add('is-in');
  }
  function paintTally() {
    tallyEl.innerHTML = '';
    tallyEl.classList.remove('is-done');
    for (let i = 0; i < r.cards.length; i++) {
      const m = el('i', 'tw-sort__mark', tallyEl);
      m.style.setProperty('--i', String(i));
      if (i < r.marks.length) m.className += ' is-g' + r.marks[i] + (i === r.marks.length - 1 ? ' is-new' : '');   // the one that just landed pops
    }
  }
  function paint() {
    raf = 0;
    if (!r || box.hidden) return;
    const t = now();
    fuseEl.style.transform = 'scaleX(' + fuse(r, t).toFixed(4) + ')';
    cardEl.classList.toggle('is-late', late(r, t));
    raf = requestAnimationFrame(paint);
  }
  const wake = () => { if (!raf && !box.hidden) raf = requestAnimationFrame(paint); };
  const sleep = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  function landed(res) {
    if (!res || !r) return;
    if (res.g >= 0) { paintTally(); if (opts.onLand) opts.onLand(res, r); }
    if (res.done) {
      // ⭐ THE FINISH (Trym, 22 Sep: "some effect or animation or something pleasing for finishing the sorting … it
      // feels good to finish a day's job"): the card leaves, the tally waves along its length, and only then does
      // the tray go down and the receipt come up — the counter's own beat before the paperwork.
      const done = r; sleep(); r = null; cardEl.hidden = true; pileEl.innerHTML = '';
      tallyEl.classList.add('is-done');
      setTimeout(() => { if (opts.onDone) opts.onDone(done, !!res.timeUp); }, WAVE_MS);
      return;
    }
    paintCard();
  }
  // step(now) — the round's clock, driven by the world's own tick so it keeps running while the tray is
  // folded: a card nobody sorts while you are off the mark is the cost, the café's rope rule
  function step(t) { if (!r) return; landed(tick(r, t)); }
  function hit(b) {
    if (!r) return;
    b.classList.add('is-hit'); setTimeout(() => b.classList.remove('is-hit'), 140);
    const res = sortInto(r, b.dataset.mark, now());
    if (res) { const c = 'is-g' + res.g; b.classList.add(c); setTimeout(() => b.classList.remove(c), 320); }   // the hole answers in the grade's colour
    landed(res);
  }

  return {
    el: box,
    deal(round) { r = round; buildHoles(round.holes || MARKS.slice(0, BASE)); note.textContent = ''; paintTally(); paintCard(); wake(); },
    step,
    say(text, hint) { note.textContent = text || ''; note.classList.toggle('is-hint', !!(text && hint)); },
    show() { box.hidden = false; box.classList.remove('is-folded'); toast(true); wake(); },
    fold() { box.classList.add('is-folded'); toast(false); sleep(); },
    hide() { box.hidden = true; toast(false); sleep(); },
    open: () => !box.hidden && !box.classList.contains('is-folded'),
    round: () => r,
    // ⚠️ the walk's door: a rAF fuse cannot be thumbed by Playwright at a real millisecond, so these sort
    // and tick at an exact instant
    seam: {
      card: () => cardOf(r),
      sort: (mark, t) => { const res = r ? sortInto(r, mark, t == null ? now() : t) : null; landed(res); return res; },
      step: (t) => { step(t == null ? now() : t); return r ? { i: r.i, marks: r.marks.slice() } : null; },
      at: () => (r ? r.at : 0),
      fuse: (t) => fuse(r, t == null ? now() : t),
      pile: () => pileEl.children.length,
      note: () => note.textContent,
      hint: () => note.classList.contains('is-hint') && !!note.textContent,
      tally: () => [...tallyEl.children].map((m) => (m.className.match(/is-g(\d)/) || [])[1] || ''),
      holes: () => holeEls.map((b) => b.dataset.mark),
    },
    destroy() { sleep(); toast(false); box.remove(); },
  };
}

// ---- the counter in the town ---------------------------------------------------------------------
// ⭐ THE COUNTER IS A MARK ON THE GROUND, and the round is a DISTANCE from it — the café's own rule and
// the café's own numbers. NEAR is town-work.js's radius for turning up at your workplace, so the round
// and the day are counted from the same spot.
const NEAR = 120, AWAY = 420, STAY = 8000;

export function bootTownSort(ctx) {
  const { host, PROPS, pos, say, track, openCard, closeCard, esc, inside, chore, world, W, H } = ctx;
  let tray = null, on = false, away = 0, held = false, rounds = 0, last = null, xpGot = 0;
  const mark = () => { const p = PROPS && PROPS.post; return p ? { x: p.x + p.w / 2, y: p.base } : null; };
  const seedNow = () => ((Math.floor(Date.now() / 60000) * 2654435761) ^ (rounds * 40503)) >>> 0;

  function clockIn() {
    if (on) return false;
    // ⚠️ NOT FROM ACROSS THE SQUARE: a round that begins far from the mark folds on its first frame and
    // runs unseen. The walk from the mailbox card can stop short of the counter (a planter in the way),
    // so the counter says it is a step away and waits — the tray only ever rises where it can be seen.
    const m = mark();
    if (m && pos && Math.hypot(pos.x - m.x, pos.y - m.y) > NEAR) { if (COPY.far) say(COPY.far); return false; }
    on = true; away = 0;
    if (!tray) tray = mountSorter(host, { onLand, onDone, holes: () => COPY.holes || {}, leave: COPY.leave || '', onLeave: () => clockOut() });
    const j = ctx.job ? ctx.job() : null, rk = Math.max(1, ((j && j.lad && j.lad.rank) | 0));
    const r = start(newRound(seedNow(), unlocked('post', 'fifth', rk) ? { marks: MARKS, ...FAST } : {}), performance.now());   // ✉️ rank 2: the fifth postmark, faster
    rounds++;
    tray.deal(r);
    // the first round on this device carries its notice under the holes; every later one runs wordless
    if (!hinted() && COPY.hint) tray.say(COPY.hint, true); else tray.say('');
    if (!held) tray.show();
    if (COPY.on) say(COPY.on);
    track('town_shift', { at: 'post', step: 'in' });
    return true;
  }
  function onLand(res) { track('town_sort', { at: 'post', r: res.gone ? 'gone' : (GRADES[res.g] || 'wrong') }); }
  function onDone(r) { finish(r); }
  function finish(r) {
    if (!on) return;
    on = false;
    last = r || (tray && tray.round()) || null;
    if (tray) tray.hide();
    const ok = counts(last);
    if (last && last.marks.length) setHinted();   // a round has been played through: the notice has done its job
    // 💼 the round is on the week's sheet: the town says "sorted", the pass worker counts it (up to the target)
    // 🪜 …and its points are work XP: five a card sorted fresh, two a card sorted late (roundXp), a round that made the sheet
    xpGot = 0;
    if (ok && chore) { const p = chore('sort', roundXp(last.right, last.late)); xpGot = (p && p.got) | 0; }
    if (ok) track('town_chore', { at: 'post', kind: 'sort' });   // 📡 Pulse reads the week's work by kind, as the arcade's chores do
    track('town_shift', { at: 'post', step: 'out', right: last ? last.right : 0, late: last ? last.late : 0, wrong: last ? last.wrong : 0, counted: ok ? 1 : 0 });
    receipt(last, ok);
  }
  function clockOut() {
    if (!on) return false;
    finish(tray && tray.round());
    if (COPY.off) say(COPY.off);
    return true;
  }
  // ⭐ THE RECEIPT is a card, and a card is right HERE and nowhere else in the round: it is over, so the
  // square no longer has to be visible behind it. The words are the rig's; the numbers are the round's.
  function receipt(r, ok) {
    const w = COPY.receipt || {};
    if (!openCard || !w.title || !r) return;
    const take = (w.take || '').replace('{n}', String(r.right)).replace('{of}', String(r.cards.length));
    const marks = r.marks.map((g) => '<i class="tw-sort__mark is-g' + g + '"></i>').join('')
      + r.cards.slice(r.marks.length).map(() => '<i class="tw-sort__mark"></i>').join('');
    const marksIn = r.marks.map((g, i) => '<i class="tw-sort__mark is-g' + g + '" style="--i:' + i + '"></i>').join('')
      + r.cards.slice(r.marks.length).map((_, i) => '<i class="tw-sort__mark" style="--i:' + (r.marks.length + i) + '"></i>').join('');
    void marks;
    openCard('<div class="tw-cup__till tw-sort__till' + (ok ? ' is-counted' : '') + '">'
      + (ok && COPY.stamp ? '<i class="tw-sort__seal" aria-hidden="true">' + esc(COPY.stamp) + '</i>' : '')
      + '<h2>' + esc(w.title) + '</h2>'
      + (take ? '<p class="tw-cup__take">' + esc(take) + '</p>' : '')
      + '<div class="tw-sort__marks" aria-hidden="true">' + marksIn + '</div>'
      + '<p class="' + (ok ? 'tw-cup__best' : 'tw-card__sub') + '">' + esc(ok ? (w.counted || '') : (w.short || '')) + '</p>'
      + (ok ? ladderHtml(w) : '')
      + (w.back ? '<button class="tw-cta" id="twSortX" type="button"><span class="tw-cta__verb">' + esc(w.back) + '</span></button>' : '')
      + '</div>');
    const b = document.getElementById('twSortX');
    if (b && closeCard) b.addEventListener('click', () => closeCard());
    // ✨ and the counter itself throws the moment up, the way a fix or a find does — twice for a round that
    // made the sheet, once for one that did not: the day's work happened either way
    const m = mark();
    if (world && W && H && m) {
      burstInto(world, 'tw-burst', m.x / W * 100, (m.y - 64) / H * 100, ok ? 18 : 10);
      if (ok) setTimeout(() => burstInto(world, 'tw-burst', (m.x + 40) / W * 100, (m.y - 96) / H * 100, 14), 260);
    }
  }
  // 🪜 the ladder as the receipt draws it: this round's XP, and a bar from this rank's line to the next one's
  function ladderHtml(w) {
    const j = ctx.job ? ctx.job() : null, l = j && j.lad;
    if (!w.xp || !l) return '';
    const a = xpAt('post', l.rank) | 0, b = xpAt('post', l.rank + 1);
    const k = b == null ? 1 : Math.max(0, Math.min(1, ((l.xp | 0) - a) / (b - a)));
    return '<p class="tw-cup__xp">' + esc(w.xp.replace('{n}', String(xpGot))) + '</p><div class="tw-cup__xpbar"><i style="transform:scaleX(' + k.toFixed(3) + ')"></i></div>';
  }
  // a round that ends with the page ends with its receipt written up — a counted round still counts
  const onHide = () => { if (on) clockOut(); };
  window.addEventListener('pagehide', onHide);

  function tick(now) {
    if (!on) return;
    if (inside && inside()) { clockOut(); return; }   // walking into a shop is walking away
    const m = mark();
    if (m && pos) {
      const d = Math.hypot(pos.x - m.x, pos.y - m.y);
      if (d > AWAY) { clockOut(); return; }
      if (d > NEAR) {
        if (!away) { away = now; if (tray) tray.fold(); }
        else if (now - away > STAY) { clockOut(); return; }
        if (tray) tray.step(now);   // the pile does not wait because you left: that IS the cost
        return;
      }
      if (away) { away = 0; if (tray && !held) tray.show(); }
    }
    if (tray) tray.step(now);
  }
  return {
    clockIn, clockOut, tick,
    // the bottom of the screen is not ours alone: the pocket opens there too, and the tray yields to it
    hold(v) { held = !!v; if (!tray || !on) return; if (held) tray.fold(); else if (!away) tray.show(); },
    on: () => on,
    tray: () => tray,
    seam: {
      on: () => on, clockIn, clockOut,
      round: () => { const r = tray && tray.round(); return r ? { i: r.i, cards: r.cards.slice(), holes: r.holes.slice(), fresh: r.fresh, gone: r.gone, marks: r.marks.slice(), right: r.right, late: r.late, wrong: r.wrong, done: r.done, at: r.at, t0: r.t0 } : null; },
      holes: () => (tray ? tray.seam.holes() : []),
      last: () => (last ? { right: last.right, late: last.late, wrong: last.wrong, marks: last.marks.slice(), counted: counts(last), timeUp: !!last.timeUp, xp: xpGot } : null),
      card: () => (tray ? tray.seam.card() : ''),
      sort: (mark2, t) => (tray ? tray.seam.sort(mark2, t) : null),
      step: (t) => (tray ? tray.seam.step(t) : null),
      fuse: (t) => (tray ? tray.seam.fuse(t) : 0),
      tally: () => (tray ? tray.seam.tally() : []),
      pile: () => (tray ? tray.seam.pile() : 0),
      mark, marks: () => MARKS.slice(),
      folded: () => !!(tray && tray.el.classList.contains('is-folded')),
      hint: () => !!(tray && tray.seam.hint()), note: () => (tray ? tray.seam.note() : ''), hinted,
      open: () => !!(tray && tray.open()),
    },
  };
}
