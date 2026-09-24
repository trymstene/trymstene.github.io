// 🛒 THE STORE'S CUSTOMERS (23 Sep 2026; the job ladder's slice 2 — Trym: "do the store's customer requests next").
//
// The general store's job was carrying a crate to a bare shelf and nothing else: the ladder plan called it a job with no
// skill in it. Now, on the days the town calls for it, customers come in while you work: one walks up to the counter and
// wants a thing from the shelves. What they want GLOWS on the shelf; you take it and give it to them. Quick is perfect, in
// time is fine, and a customer left waiting too long gives up and goes — nothing counts.
//
// 👀 24 Sep 2026, Trym testing it: "the idea and mechanisms are OK" — and five things that were not: the customer slid in
// stiff (they WALK now, the town's own two-frame step, and walk out again); every ware sat in a big white square (the
// thing itself now); the tray's tiny icon was one more thing to read (the shelf glows instead, and the tray keeps a name
// and the wait); "till" was a weird word, and nobody knew whether to put it on the counter or give it to the customer (you
// tap the CUSTOMER, a lit square stands under them while you carry, and the first customer ever comes with a pointer and
// two plain lines); and the thing in your hands sat on your belly (it rides your right hand now — the second of a basket
// your left — and pumps with the dance, the engine's own hand anchors).
//
// ⚠️ IT DECIDES NOTHING ABOUT THE SHOP. What is on which face is the room's (shelfFor, in the order the faces fill); the
// week's sheet is the pass worker's (a `serve` chore with its grade); the calls are work-calls.js. This is the customer,
// the pictures on the shelf, the thing in your hands and the tray. Unlike a counter it does NOT hold the banana: the walk
// is the job.
//
// 🧺 THE BASKET (rank 2, 23 Sep 2026; the ladder's slice 3). From Pip's second rank some customers want TWO things: both
// glow, one goes in each hand, and the customer takes them together. A longer wait, more walking under the clock, and
// half again a customer's work XP (jobs.js XP.store.basket).
import { DECOR } from '../data/decor.js';
import { STORE } from './town-geo.js';
import { calls as callsAt } from '../lib/work-calls.js';
import { unlocked } from '../data/town/jobs.js';
import { FRAME_H_FRAC, FRAME_TOP_FRAC, FW, FH, NFRAMES, BASE_CYCLE_S } from '../lib/banana-geo.js';
import { wearAnchor } from '../lib/banana-engine.js';
import { once } from '../lib/once.js';
const COPY_MODS = import.meta.glob('../data/copy/town-serve.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};
const DEX = {}; DECOR.forEach((d) => { DEX[d.id] = d; });

export const PATIENCE = 24000;     // how long a customer waits at the counter
export const QUICK = 0.45;         // handed over inside this share of it: perfect
export const PATIENCE_BASKET = 36000;   // 🧺 two things take longer to find: half again the wait
const SPOT = [704, 858];           // the customer's feet, in front of the counter
const DOOR = [564, 994];           // where a customer walks in
const HAND = [646, 862];           // where you stand to hand it over, beside them
const WALK_MS = 1400;              // the customer's walk from the door to the counter
const STEP_MS = 260;               // a walking banana changes feet this often (town-folk's own step)
const GAP = [2500, 5000];          // between one customer leaving and the next coming in
const HATS = ['party', 'tophat', 'cowboy', 'beanieprop', 'backwardscap', 'gradcap', 'none', 'none'];
const BAGS = ['shopbag_cream', 'shopbag_beige', 'shopbag_brown'];
// ⚠️ the engine's `face` labels are inverted (town-folk.js): walking right is the 0/1 pair, walking left the 4/5, standing front 2
const F_RIGHT = 0, F_LEFT = 4, F_FRONT = 2;
const faceOf = (k) => (STORE.spots || []).find((s) => s[0] === k);

export function bootTownServe(ctx) {
  const { world, view, W, H, pct, pos, say, track, drawMe, walk, burst, items, job, chore } = ctx;
  const EL = 0.045 * W;   // a banana is 4.5% of the plate wide, and square (town.astro .tw-me / .tw-npc)
  const FOOT = (1 - FRAME_TOP_FRAC - FRAME_H_FRAC) * EL;
  let inside = false, paused = false, cust = null, hands = [], tags = [], nextAt = 0, raf = 0, n = 0, tray = null, held = false, force = null;
  let leavers = [], spot = null, point = null;
  const staff = () => { const j = job(); return !!(j && j.at === 'store'); };
  const rank = () => { const j = job(); return Math.max(1, ((j && j.lad && j.lad.rank) | 0)); };
  const today = () => Math.floor(Date.now() / 864e5);
  const served = () => { try { const r = JSON.parse(localStorage.getItem('tw-serve-v1') || 'null'); return r && r.d === today() ? r.n | 0 : 0; } catch (e) { return 0; } };
  const wanted = () => { const c = callsAt('store').find((q) => q.kind === 'serve'); return !!(c && c.open); };

  // ---- the tray: what they want (its name), and how long they will wait ----
  function mountTray() {
    const box = document.createElement('div');
    box.className = 'tw-cup tw-cup--serve';
    box.hidden = true;
    box.innerHTML = '<div class="tw-cup__top"><span class="tw-serve__want"><b></b></span><button type="button" class="tw-cup__leave"></button></div>'
      + '<div class="tw-cup__bar"><i class="tw-cup__fill"></i></div><p class="tw-cup__note"></p>';
    view.appendChild(box);
    const leave = box.querySelector('.tw-cup__leave');
    leave.textContent = COPY.leave || '';
    leave.hidden = !COPY.leave;
    leave.addEventListener('click', (e) => { e.stopPropagation(); paused = true; gone(0, 'leave'); if (COPY.stopped) say(COPY.stopped); });   // the customers stop until you come back in: said, not discovered
    return { box, name: box.querySelector('b'), fill: box.querySelector('.tw-cup__fill'), note: box.querySelector('.tw-cup__note') };
  }
  // what to do next is said on the ticket itself: a toast stands at the top of the view, which in the store is the shelves you are searching
  const note = (line) => { if (tray) tray.note.textContent = line || ''; };
  // and the line said before the ticket rose (the store's welcome) gives way, as it does to a card that opens over it
  const trayShow = (on) => { if (!tray) return; tray.box.hidden = !on || held; const t = document.getElementById('twToast'); if (!t) return; if (!tray.box.hidden && !t.classList.contains('is-above-tray')) t.hidden = true; t.classList.toggle('is-above-tray', !tray.box.hidden); };

  // ---- the customer: a banana that walks in, waits, fidgets when it has waited long, and walks out ----
  function bodyAt(x, y, outfit) {
    const el = document.createElement('div');
    el.className = 'tw-npc tw-visitor tw-serve__cust is-in';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 150;
    el.appendChild(cv);
    world.appendChild(el);
    const b = { el, g: cv.getContext('2d'), x, y, outfit, f: -1 };
    place(b, x, y);
    return b;
  }
  function place(b, x, y) { b.x = x; b.y = y; b.el.style.left = pct(x, W); b.el.style.top = pct(y + FOOT, H); b.el.style.zIndex = String(2100 + Math.round(y)); }
  function paint(b, f) { if (b.f === f) return; b.f = f; b.g.clearRect(0, 0, 150, 150); try { drawMe(b.g, 150, f, b.outfit); } catch (e) {} }
  const step = (now) => Math.floor(now / STEP_MS) % 2;

  function arrive() {
    const list = (items() || []).slice(0, (STORE.full || []).length);
    if (!list.length) return;
    const seed = (today() * 2654435761 + served() * 40503 + n * 97) >>> 0;
    const i = seed % list.length, id = list[i];
    if (!DEX[id]) return;
    const ids = [id];
    const basket = force != null ? force : unlocked('store', 'basket', rank()) && ((seed >>> 7) & 1) === 1;
    if (basket && list.length > 1) { const k = (i + 1 + ((seed >>> 9) % (list.length - 1))) % list.length; if (DEX[list[k]]) ids.push(list[k]); }
    force = null;
    n++;
    const outfit = { hat: HATS[seed % HATS.length], glasses: 'none', extras: { [BAGS[(seed >>> 3) % BAGS.length]]: true }, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
    const b = bodyAt(DOOR[0], DOOR[1], outfit);
    paint(b, F_RIGHT);
    // 🎓 the first customer this device ever sees comes with a lesson: a pointer over what they want, then over them (once)
    const learn = once('serve:learn');
    cust = { id, ids, faces: ids.map((x) => FACES()[list.indexOf(x)][0]), face: FACES()[i][0], b, t0: 0, walkAt: performance.now(), wait: ids.length > 1 ? PATIENCE_BASKET : PATIENCE, learn };
    tagsShow();
    if (!tray) tray = mountTray();
    tray.name.textContent = ids.map((x) => DEX[x].name || '').join(' + ');
    tray.box.classList.toggle('is-basket', ids.length > 1);
    note(learn && COPY.learnFind ? COPY.learnFind : ids.length > 1 ? COPY.basket || COPY.find : COPY.find);
    tray.fill.style.transform = 'scaleX(1)';
    trayShow(true);
    wake();
  }
  // the customer goes: served (g 1–2), given up (0), or turned away with Stop serving — and walks back out of the door
  function gone(g, why) {
    if (!cust) return;
    const c = cust;
    cust = null;
    carryOff();
    tagsClear();
    spotShow(false);
    pointOff();
    trayShow(false);
    leavers.push({ b: c.b, x0: c.b.x, y0: c.b.y, t0: performance.now() });
    if (g > 0) {
      try { localStorage.setItem('tw-serve-v1', JSON.stringify({ d: today(), n: served() + 1 })); } catch (e) {}
      if (chore) chore(c.ids.length > 1 ? 'basket' : 'serve', g);   // 🧺 the pass worker counts a basket as a customer served (jobs.js COUNTS_AS)
      if (burst) burst(c.b.x, c.b.y - 60);
      const line = (COPY.served || {})[g === 2 ? 'perfect' : 'fine'];
      if (line) say(line);
    } else if (why === 'late' && COPY.late) say(COPY.late);
    track('town_chore', { at: 'store', kind: g > 0 ? (c.ids.length > 1 ? 'basket' : 'serve') : why === 'late' ? 'miss' : 'away', g: g | 0 });
    nextAt = performance.now() + GAP[0] + Math.random() * (GAP[1] - GAP[0]);
    wake();
  }

  // ---- the wares: each stocked face shows what is on it while somebody waits — the thing itself, no card — and what the
  // customer wants GLOWS (Trym: "make the item on the shelf glow … better than adding more icons") ----
  const FACES = () => (STORE.full || []).slice(0, (items() || []).length);
  function tagsShow() {
    tagsClear();
    const list = items() || [];
    FACES().forEach(([k, , cx], i) => {
      const d = DEX[list[i]], f = faceOf(k); if (!d || !f) return;
      const el = document.createElement('i');
      el.className = 'tw-serve__tag is-in' + (cust && cust.ids.includes(list[i]) ? ' is-want' : '');
      el.innerHTML = '<img alt="" src="' + d.img + '">';
      // on the back wall's cases the thing stands on the case's top edge; over a table it stands on the table
      el.style.left = pct(cx, W); el.style.top = pct(k.startsWith('sh') ? f[2] + 24 : f[2] - 4, H); el.style.zIndex = String(2101 + f[4]);   // over its own face's goods (the room's sprites stand at 2100 + base), under a banana in front of it
      el.dataset.face = k; el.dataset.id = list[i];
      world.appendChild(el);
      tags.push(el);
    });
    if (cust && cust.learn) { const t = tags.find((x) => x.classList.contains('is-want')); if (t) pointOver(t); }
  }
  function tagsClear() { tags.forEach((t) => t.remove()); tags = []; }
  const unwant = (id) => tags.forEach((t) => { if (t.dataset.id === id) t.classList.remove('is-want'); });

  // ---- where to bring it: a lit square under the customer while you carry, and the first customer's pointer ----
  function spotShow(on) {
    if (!on || !cust) { if (spot) { spot.remove(); spot = null; } return; }
    if (!spot) { spot = document.createElement('i'); spot.className = 'tw-serve__spot'; world.appendChild(spot); }
    spot.style.left = pct(cust.b.x, W); spot.style.top = pct(cust.b.y, H); spot.style.zIndex = String(2099 + Math.round(cust.b.y));
  }
  function pointAt(x, y) {
    if (!point) { point = document.createElement('i'); point.className = 'tw-serve__point'; world.appendChild(point); }
    point.style.left = pct(x, W); point.style.top = pct(y, H); point.style.zIndex = '4000';
  }
  // over the thing's DRAWN top — a tall vase reaches far higher than a jar — measured, and measured again once its picture lands
  function pointOver(tag) {
    const place = () => {
      if (!tag.isConnected) return;
      const r = tag.getBoundingClientRect(), wr = world.getBoundingClientRect(), k = wr.width / W;
      const top = r.height > 4 && k > 0 ? (r.top - wr.top) / k : parseFloat(tag.style.top) / 100 * H - 0.035 * W;
      pointAt(parseFloat(tag.style.left) / 100 * W, top - 0.006 * W);
    };
    place();
    const img = tag.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', place, { once: true });
  }
  const pointOff = () => { if (point) { point.remove(); point = null; } };

  // ---- the thing in your hands: the RIGHT hand, then the left — the engine's own glove anchors, frame by frame, so it
  // pumps with the dance like every held thing in this world (banana-engine.js wearAnchor, FRAMES[].hands) ----
  function carryOn(id) {
    const el = document.createElement('i');
    el.className = 'tw-serve__held is-in';
    el.innerHTML = '<img alt="" src="' + DEX[id].img + '">';
    world.appendChild(el);
    hands.push({ id, el });
    carryTick();
  }
  function carryOff() { hands.forEach((h) => h.el.remove()); hands = []; }
  const frameNow = () => { const cyc = BASE_CYCLE_S * 1000; return Math.floor(((Date.now() % cyc) / cyc) * NFRAMES) % NFRAMES; };
  // a sprite point of YOUR banana → the plate: the element is EL wide and square with its bottom at pos.y, and the frame fills
  // FRAME_H_FRAC of it from FRAME_TOP_FRAC down, centred (the same geometry drawComposite draws with)
  function handAt(side) {
    const s = FRAME_H_FRAC / FH, a = wearAnchor(frameNow(), 'hand', side);
    return { x: pos.x - EL / 2 + EL * ((1 - FW * s) / 2 + a.x * s), y: pos.y - EL + EL * (FRAME_TOP_FRAC + a.y * s) };
  }
  function carryTick() {
    hands.forEach((h, k) => {
      const p = handAt(k ? 'left' : 'right');
      h.el.style.left = pct(p.x, W); h.el.style.top = pct(p.y, H); h.el.style.zIndex = String(2110 + Math.round(pos.y) + k);
    });
  }
  const holding = (id) => hands.some((h) => h.id === id);

  // ---- the beat ----
  function frame(now) {
    raf = 0;
    if (!inside) return;
    carryTick();
    // 🚶 the ones going: back to the door, walking, then they fade
    leavers = leavers.filter((l) => {
      const k = Math.min(1, (now - l.t0) / WALK_MS);
      place(l.b, l.x0 + (DOOR[0] - l.x0) * k, l.y0 + (DOOR[1] - l.y0) * k);
      paint(l.b, (DOOR[0] < l.x0 ? F_LEFT : F_RIGHT) + step(now));
      if (k < 1) return true;
      l.b.el.classList.add('is-gone');
      setTimeout(() => l.b.el.remove(), 600);
      return false;
    });
    if (cust) {
      if (!cust.t0) {   // walking in from the door; the wait starts when they reach the counter
        const k = Math.min(1, (now - cust.walkAt) / WALK_MS);
        place(cust.b, DOOR[0] + (SPOT[0] - DOOR[0]) * k, DOOR[1] + (SPOT[1] - DOOR[1]) * k);
        paint(cust.b, F_RIGHT + step(now));
        if (k >= 1) { cust.t0 = now; paint(cust.b, F_FRONT); }
      } else {
        const left = 1 - (now - cust.t0) / cust.wait;
        const late = left < 1 - QUICK;
        paint(cust.b, late ? F_FRONT + (Math.floor(now / 420) % 2) : F_FRONT);   // a customer who has waited long shifts their weight
        if (tray) tray.fill.style.transform = 'scaleX(' + Math.max(0, left).toFixed(3) + ')';
        if (tray) tray.box.classList.toggle('is-late', late);
        if (left <= 0) gone(0, 'late');
      }
    } else if (!paused && staff() && wanted() && (!nextAt || now >= nextAt)) {   // the call says how many it wants (work-calls.js NEEDS)
      nextAt = now + 999999;   // one at a time
      arrive();
    }
    raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && inside) raf = requestAnimationFrame(frame); };

  // ---- the town's doors ----
  function enter() {
    inside = true; paused = false; n = 0;
    nextAt = performance.now() + 3500;   // a moment to look round (and read the store's welcome) before the first comes in
    wake();
  }
  function leave() {
    inside = false;
    if (cust) { cust.b.el.remove(); cust = null; }
    leavers.forEach((l) => l.b.el.remove()); leavers = [];
    carryOff(); tagsClear(); spotShow(false); pointOff(); trayShow(false);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  // 🙋 the customer is a thing you tap (Trym: "I didnt understand if i was supposed to put the object on the counter, or give
  // it straight to the customer"): their body and the lit square under them both mean GIVE IT. banana-town asks this before
  // the room's fittings, because the customer stands in front of a table that is a shelf face of its own.
  function at(wx, wy) {
    if (!inside || !cust || !cust.t0) return false;
    const x = cust.b.x, y = cust.b.y;
    return wx > x - EL * 0.62 && wx < x + EL * 0.62 && wy > y - EL * 0.82 && wy < y + EL * 0.22;
  }
  // a tap on a fitting in the store (or on the customer) while a customer waits: true = handled (the room's own answer does not run)
  function tap(key) {
    if (!inside || !cust || !cust.t0) return false;
    const f = faceOf(key);
    const onFace = FACES().some(([k]) => k === key);
    const all = () => cust.ids.every(holding);
    if (onFace && f && !all()) {
      walk((f[1] + f[3]) / 2, f[4] + 26, () => {
        if (!cust) return;
        const list = items() || [], it = list[FACES().findIndex(([k]) => k === key)];
        if (cust.ids.includes(it) && !holding(it)) {
          carryOn(it);
          unwant(it);
          if (all()) {
            spotShow(true);
            if (cust.learn && COPY.learnGive) { note(COPY.learnGive); pointAt(cust.b.x, cust.b.y - EL * 0.86); }
            else note(COPY.got);
          } else {
            note(COPY.one || COPY.got);
            if (cust.learn) { const t = tags.find((x) => x.classList.contains('is-want')); if (t) pointOver(t); }
          }
        } else if (!holding(it)) note(COPY.wrong);
      });
      return true;
    }
    if (key === 'till' || key === 'cust') {
      if (!hands.length) { note(cust.ids.length > 1 ? COPY.basket || COPY.find : COPY.find); return true; }
      walk(HAND[0], HAND[1], () => {
        if (!cust || !hands.length) return;
        if (!all()) { note(COPY.more || COPY.find); return; }   // 🧺 half a basket is not an order
        const took = performance.now() - cust.t0;
        gone(took <= cust.wait * QUICK ? 2 : 1, 'served');
      });
      return true;
    }
    return false;
  }

  return {
    enter, leave, tap, at,
    on: () => !!cust,
    hold(v) { held = !!v; if (tray) trayShow(!!cust); },
    seam: {
      want: () => (cust ? { id: cust.id, ids: cust.ids.slice(), faces: cust.faces.slice(), face: cust.face, basket: cust.ids.length > 1, wait: cust.wait, waiting: !!cust.t0, x: cust.b.x, y: cust.b.y, learn: !!cust.learn, frame: cust.b.f } : null),
      carrying: () => hands.map((h) => h.id).join('+'),
      stack: () => hands.map((h) => { const r = h.el.getBoundingClientRect(); return { id: h.id, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; }),
      basket: (v) => { force = v == null ? null : !!v; return true; },   // the next customer is (or is not) a basket, whatever the draw
      served,
      tags: () => tags.map((t) => t.dataset.face),
      glowing: () => tags.filter((t) => t.classList.contains('is-want')).map((t) => t.dataset.face),
      spot: () => !!spot,
      point: () => !!point,
      leaving: () => leavers.length,
      age: (ms) => { if (cust && cust.t0) cust.t0 -= ms | 0; return !!cust; },   // the walk cannot wait 24 real seconds
      arriveNow: () => { if (!cust && inside) { nextAt = 0; paused = false; } return true; },
      tray: () => (tray ? { shown: !tray.box.hidden, name: tray.name.textContent, basket: tray.box.classList.contains('is-basket'), note: tray.note.textContent } : null),
    },
  };
}
