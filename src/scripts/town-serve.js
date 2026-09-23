// 🛒 THE STORE'S CUSTOMERS (23 Sep 2026; the job ladder's slice 2 — Trym: "do the store's customer requests next").
//
// The general store's job was carrying a crate to a bare shelf and nothing else: the ladder plan called it a job with no
// skill in it. Now, on the days the town calls for it, customers come in while you work: one walks to the till and wants a
// thing from the shelves. The ticket on the tray shows what (the till's own picture of it) and how long they will wait;
// every stocked face wears a little picture of what is on it; you find the right one, carry it to the till and hand it
// over. Quick is perfect, in time is fine, and a customer left waiting too long gives up and goes — nothing counts.
//
// ⚠️ IT DECIDES NOTHING ABOUT THE SHOP. What is on which face is the room's (shelfFor, in the order the faces fill); the
// week's sheet is the pass worker's (a `serve` chore with its grade); the calls are work-calls.js. This is the customer,
// the tags, the thing in your hands and the tray. Unlike a counter it does NOT hold the banana: the walk is the job.
import { DECOR } from '../data/decor.js';
import { STORE } from './town-geo.js';
import { calls as callsAt } from '../lib/work-calls.js';
import { FRAME_H_FRAC, FRAME_TOP_FRAC } from '../lib/banana-geo.js';
const COPY_MODS = import.meta.glob('../data/copy/town-serve.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};
const DEX = {}; DECOR.forEach((d) => { DEX[d.id] = d; });

export const PATIENCE = 24000;     // how long a customer waits at the till
export const QUICK = 0.45;         // handed over inside this share of it: perfect
const SPOT = [704, 858];           // the customer's feet, in front of the till
const DOOR = [564, 994];           // where a customer walks in
const HAND = [646, 862];           // where you stand to hand it over, beside them
const WALK_MS = 1400;              // the customer's walk from the door to the till
const GAP = [2500, 5000];          // between one customer leaving and the next coming in
const HATS = ['party', 'tophat', 'cowboy', 'beanieprop', 'backwardscap', 'gradcap', 'none', 'none'];
const BAGS = ['shopbag_cream', 'shopbag_beige', 'shopbag_brown'];
const faceOf = (k) => (STORE.spots || []).find((s) => s[0] === k);

export function bootTownServe(ctx) {
  const { world, view, W, H, pct, pos, say, track, drawMe, walk, burst, items, job, chore } = ctx;
  const FOOT = (1 - FRAME_TOP_FRAC - FRAME_H_FRAC) * (0.045 * W);
  let inside = false, paused = false, cust = null, carry = null, tags = [], nextAt = 0, raf = 0, n = 0, tray = null, held = false;
  const staff = () => { const j = job(); return !!(j && j.at === 'store'); };
  const today = () => Math.floor(Date.now() / 864e5);
  const served = () => { try { const r = JSON.parse(localStorage.getItem('tw-serve-v1') || 'null'); return r && r.d === today() ? r.n | 0 : 0; } catch (e) { return 0; } };
  const wanted = () => { const c = callsAt('store').find((q) => q.kind === 'serve'); return !!(c && c.open); };

  // ---- the tray: what they want, and how long they will wait ----
  function mountTray() {
    const box = document.createElement('div');
    box.className = 'tw-cup tw-cup--serve';
    box.hidden = true;
    box.innerHTML = '<div class="tw-cup__top"><span class="tw-serve__want"><img alt=""><b></b></span><button type="button" class="tw-cup__leave"></button></div>'
      + '<div class="tw-cup__bar"><i class="tw-cup__fill"></i></div><p class="tw-cup__note"></p>';
    view.appendChild(box);
    const leave = box.querySelector('.tw-cup__leave');
    leave.textContent = COPY.leave || '';
    leave.hidden = !COPY.leave;
    leave.addEventListener('click', (e) => { e.stopPropagation(); paused = true; gone(0, 'leave'); });
    return { box, img: box.querySelector('img'), name: box.querySelector('b'), fill: box.querySelector('.tw-cup__fill'), note: box.querySelector('.tw-cup__note') };
  }
  // while the ticket is up, the town's lines stand at the top of the view, as over the café's tray (banana-town placeToast)
  // what to do next is said on the ticket itself: a toast stands at the top of the view, which in the store is the shelves you are searching
  const note = (line) => { if (tray) tray.note.textContent = line || ''; };
  // and the line said before the ticket rose (the store's welcome) gives way, as it does to a card that opens over it
  const trayShow = (on) => { if (!tray) return; tray.box.hidden = !on || held; const t = document.getElementById('twToast'); if (!t) return; if (!tray.box.hidden && !t.classList.contains('is-above-tray')) t.hidden = true; t.classList.toggle('is-above-tray', !tray.box.hidden); };

  // ---- the customer ----
  function bodyAt(x, y) {
    const el = document.createElement('div');
    el.className = 'tw-npc tw-visitor tw-serve__cust is-in';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 150;
    el.appendChild(cv);
    world.appendChild(el);
    const b = { el, g: cv.getContext('2d'), x, y };
    place(b, x, y);
    return b;
  }
  function place(b, x, y) { b.x = x; b.y = y; b.el.style.left = pct(x, W); b.el.style.top = pct(y + FOOT, H); b.el.style.zIndex = String(2100 + Math.round(y)); }
  function arrive() {
    const list = (items() || []).slice(0, (STORE.full || []).length);
    if (!list.length) return;
    const seed = (today() * 2654435761 + served() * 40503 + n * 97) >>> 0;
    const i = seed % list.length, id = list[i];
    if (!DEX[id]) return;
    n++;
    const b = bodyAt(DOOR[0], DOOR[1]);
    const outfit = { hat: HATS[seed % HATS.length], glasses: 'none', extras: { [BAGS[(seed >>> 3) % BAGS.length]]: true }, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
    try { drawMe(b.g, 150, 2, outfit); } catch (e) {}
    cust = { id, face: FACES()[i][0], b, t0: 0, walkAt: performance.now() };
    tagsShow();
    if (!tray) tray = mountTray();
    tray.img.src = DEX[id].img;
    tray.name.textContent = DEX[id].name || '';
    note(COPY.find);
    tray.fill.style.transform = 'scaleX(1)';
    trayShow(true);
    wake();
  }
  // the customer goes: served (g 1–2), given up (0), or turned away with Leave it
  function gone(g, why) {
    if (!cust) return;
    const c = cust;
    cust = null;
    carryOff();
    tagsClear();
    trayShow(false);
    c.b.el.classList.add('is-gone');
    setTimeout(() => c.b.el.remove(), 600);
    if (g > 0) {
      try { localStorage.setItem('tw-serve-v1', JSON.stringify({ d: today(), n: served() + 1 })); } catch (e) {}
      if (chore) chore('serve', g);
      if (burst) burst(c.b.x, c.b.y - 60);
      const line = (COPY.served || {})[g === 2 ? 'perfect' : 'fine'];
      if (line) say(line);
    } else if (why === 'late' && COPY.late) say(COPY.late);
    track('town_chore', { at: 'store', kind: g > 0 ? 'serve' : why === 'late' ? 'miss' : 'away', g: g | 0 });
    nextAt = performance.now() + GAP[0] + Math.random() * (GAP[1] - GAP[0]);
  }

  // ---- what is on each face: a little picture over it, while somebody is waiting ----
  const FACES = () => (STORE.full || []).slice(0, (items() || []).length);
  function tagsShow() {
    tagsClear();
    const list = items() || [];
    FACES().forEach(([k, , cx], i) => {
      const d = DEX[list[i]], f = faceOf(k); if (!d || !f) return;
      const el = document.createElement('i');
      el.className = 'tw-serve__tag is-in';
      el.innerHTML = '<img alt="" src="' + d.img + '">';
      // on the back wall's cases the ticket hangs on the case's top edge (above it, it reads as a picture on the wall); over a table it stands above the goods
      el.style.left = pct(cx, W); el.style.top = pct(k.startsWith('sh') ? f[2] + 24 : f[2] - 4, H); el.style.zIndex = String(2101 + f[4]);   // over its own face's goods (the room's sprites stand at 2100 + base), under a banana in front of it
      el.dataset.face = k;
      world.appendChild(el);
      tags.push(el);
    });
  }
  function tagsClear() { tags.forEach((t) => t.remove()); tags = []; }

  // ---- the thing in your hands ----
  function carryOn(id) {
    carryOff();
    const el = document.createElement('i');
    el.className = 'tw-serve__held is-in';
    el.innerHTML = '<img alt="" src="' + DEX[id].img + '">';
    world.appendChild(el);
    carry = { id, el };
    carryTick();
  }
  function carryOff() { if (carry) { carry.el.remove(); carry = null; } }
  function carryTick() { if (!carry) return; carry.el.style.left = pct(pos.x, W); carry.el.style.top = pct(pos.y - 22, H); carry.el.style.zIndex = String(2110 + Math.round(pos.y)); }

  // ---- the beat ----
  function frame(now) {
    raf = 0;
    if (!inside) return;
    carryTick();
    if (cust) {
      if (!cust.t0) {   // walking in from the door; the wait starts when they reach the till
        const k = Math.min(1, (now - cust.walkAt) / WALK_MS);
        place(cust.b, DOOR[0] + (SPOT[0] - DOOR[0]) * k, DOOR[1] + (SPOT[1] - DOOR[1]) * k);
        if (k >= 1) cust.t0 = now;
      } else {
        const left = 1 - (now - cust.t0) / PATIENCE;
        if (tray) tray.fill.style.transform = 'scaleX(' + Math.max(0, left).toFixed(3) + ')';
        if (tray) tray.box.classList.toggle('is-late', left < 1 - QUICK);
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
    carryOff(); tagsClear(); trayShow(false);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  // a tap on a fitting in the store while a customer waits: true = handled (the room's own answer does not run)
  function tap(key) {
    if (!inside || !cust || !cust.t0) return false;
    const f = faceOf(key);
    const onFace = FACES().some(([k]) => k === key);
    if (onFace && f && !carry) {
      walk((f[1] + f[3]) / 2, f[4] + 26, () => {
        if (!cust) return;
        const list = items() || [], i = FACES().findIndex(([k]) => k === key);
        if (list[i] === cust.id) { carryOn(cust.id); note(COPY.got); }
        else note(COPY.wrong);
      });
      return true;
    }
    if (key === 'till') {
      if (!carry) { note(COPY.find); return true; }
      walk(HAND[0], HAND[1], () => {
        if (!cust || !carry || carry.id !== cust.id) return;
        const took = performance.now() - cust.t0;
        gone(took <= PATIENCE * QUICK ? 2 : 1, 'served');
      });
      return true;
    }
    return false;
  }

  return {
    enter, leave, tap,
    on: () => !!cust,
    hold(v) { held = !!v; if (tray) trayShow(!!cust); },
    seam: {
      want: () => (cust ? { id: cust.id, face: cust.face, waiting: !!cust.t0, x: cust.b.x, y: cust.b.y } : null),
      carrying: () => (carry ? carry.id : ''),
      served,
      tags: () => tags.map((t) => t.dataset.face),
      age: (ms) => { if (cust && cust.t0) cust.t0 -= ms | 0; return !!cust; },   // the walk cannot wait 24 real seconds
      arriveNow: () => { if (!cust && inside) { nextAt = 0; paused = false; } return true; },
      tray: () => (tray ? { shown: !tray.box.hidden, name: tray.name.textContent, img: tray.img.getAttribute('src'), note: tray.note.textContent } : null),
    },
  };
}
