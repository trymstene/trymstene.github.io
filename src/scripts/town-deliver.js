// 📦 THE STORE'S HOME DELIVERY (23 Sep 2026; the job ladder's slice 3 — Trym: "yes build it all").
//
// The general store is an ON-CALL job, and Trym's frame for those is that they level up by reaching further into the
// world, not by adding a minigame. So from Pip's third rank the store sometimes has a parcel for a resident: Pip's call
// rings wherever you are, the parcel waits on the store's floor by the door, you walk onto it to pick it up (the town's
// walk-over rule), and you carry it across the square — a little slower, it is heavy — to the resident's own door, where a
// marker bounces. Arriving there delivers it: work XP. From the fourth rank a delivery day brings TWO parcels for two
// different doors: one pickup, two markers, either order.
//
// ⭐ WHAT THE PLAYER IS TOLD, AND WHEN (design library §30). The call says there is a parcel (the work note, the pager).
// Picking up says who each is for and where, in one line — the only moment that needs words — and from then on the markers
// over the doors are the signposts. Each arrival says it arrived; the first of two also says whose the other is. Nothing
// else speaks: no timer, no running commentary.
//
// ⚠️ IT DECIDES NOTHING ABOUT THE WEEK. The call is work-calls.js (`deliver`, answered by `tw-deliver-v1` once every parcel
// of the day is delivered), the XP is the pass worker's (`deliver` chore, jobs.js XP.store.deliver), the doors are
// town-life.js's (homeOf). This is the parcel.
import { unlocked } from '../data/town/jobs.js';
const COPY_MODS = import.meta.glob('../data/copy/town-deliver.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

export const TO = ['nib', 'stamp', 'moss', 'bean', 'figjr', 'spinner', 'dot', 'granfig'];   // everybody but Pip, whose store it is
const PARCEL_AT = [560, 884];   // on the store's floor, in the aisle just inside the door
const GRAB = 34, ARRIVE = 64;   // how near a foot must come to the parcel, and to a door
const KEY = 'tw-deliver-v1';
const IMG = '/assets/town/s-box1-0.png';

export function bootTownDeliver(ctx) {
  const { world, W, H, pct, pos, say, track, burst, job, chore, open, room, homeOf, setSlow } = ctx;
  const today = () => Math.floor(Date.now() / 864e5);
  const fresh = () => ({ d: today(), n: 0, of: 0, carry: 0, to: [], got: [] });
  const read = () => {
    try {
      const r = JSON.parse(localStorage.getItem('tw-deliver-v1') || 'null');
      if (!r || r.d !== today()) return fresh();
      if (!Array.isArray(r.to)) r.to = r.to ? [r.to] : [];   // a day begun before the fourth rank's two parcels
      if (!Array.isArray(r.got)) r.got = [];
      return r;
    } catch (e) { return fresh(); }
  };
  const write = (r) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} };
  const rank = () => { const j = job(); return Math.max(1, ((j && j.lad && j.lad.rank) | 0)); };
  const doorKey = (k) => String(homeOf(k) || '');
  // today's parcels: one, or two for two different doors from the fourth rank — the day's own draw, the same all day
  function recipients() {
    const n = unlocked('store', 'second', rank()) ? 2 : 1, seed = (today() * 2654435761) >>> 0, out = [];
    for (let i = 0; out.length < n && i < TO.length * 2; i++) {
      const k = TO[(seed + i * 3) % TO.length];
      if (!out.includes(k) && !out.some((o) => doorKey(o) === doorKey(k))) out.push(k);
    }
    return out;
  }
  const where = (to) => ((COPY.to || {})[to] || '');
  let box = null, held = [], markers = {};
  const el = (cls) => { const e = document.createElement('i'); e.className = cls; e.innerHTML = '<img alt="" src="' + IMG + '">'; world.appendChild(e); return e; };
  const put = (e, x, y, z) => { e.style.left = pct(x, W); e.style.top = pct(y, H); e.style.zIndex = String(z); };
  function clear(which) {
    if ((!which || which === 'box') && box) { box.remove(); box = null; }
    if (!which || which === 'held') { held.forEach((e) => e.remove()); held = []; }
    if (!which || which === 'markers') { Object.values(markers).forEach((e) => e.remove()); markers = {}; }
  }
  const left = (r) => r.to.filter((k) => !r.got.includes(k));

  // the frame: the parcel on the floor, in your hands, the markers over the doors — and the pickup and each arrival
  function tick() {
    const r = read(), j = job();
    const mine = !!(j && j.at === 'store');
    const done = r.of > 0 && r.n >= r.of;
    if (!mine || done || (!r.carry && !open())) { clear(); if (r.carry && !mine) { r.carry = 0; write(r); setSlow(1); } return; }
    const inside = room() === 'store';
    if (!r.carry) {
      clear('held'); clear('markers');
      if (!inside) { clear('box'); return; }
      if (!box) { box = el('tw-deliver__box is-in'); put(box, PARCEL_AT[0], PARCEL_AT[1], 2100 + PARCEL_AT[1]); }
      if (Math.hypot(pos.x - PARCEL_AT[0], pos.y - PARCEL_AT[1]) < GRAB) {   // picked up by walking onto it
        r.carry = 1; r.to = r.to.length ? r.to : recipients(); r.of = r.to.length; write(r);
        clear('box'); setSlow(0.8);
        const line = r.to.length > 1 ? (COPY.pickedTwo || '').replace('{to}', where(r.to[0])).replace('{to2}', where(r.to[1])) : (COPY.picked || '').replace('{to}', where(r.to[0]));
        if (line) say(line);
        track('town_chore', { at: 'store', kind: 'pickup', n: r.to.length });
      }
      return;
    }
    // carrying: the parcels over your head, stacked, wherever you are — and outdoors a marker over each door still to go
    const due = left(r);
    while (held.length > due.length) held.pop().remove();
    while (held.length < due.length) held.push(el('tw-deliver__held is-in'));
    held.forEach((e, k) => put(e, pos.x, pos.y - 22 - k * 16, 2110 + Math.round(pos.y) + k));
    if (inside) { clear('markers'); return; }
    for (const k of Object.keys(markers)) if (!due.includes(k)) { markers[k].remove(); delete markers[k]; }
    for (const k of due) {
      const door = homeOf(k); if (!door) continue;
      if (!markers[k]) { markers[k] = el('tw-deliver__to is-in'); put(markers[k], door[0], door[1] - 70, 2300); }
      if (room() === '' && Math.hypot(pos.x - door[0], pos.y - door[1]) < ARRIVE) {   // arrived at this door: delivered
        r.got.push(k); r.n = r.got.length;
        const rest = left(r);
        if (!rest.length) { r.carry = 0; setSlow(1); }
        write(r);
        if (markers[k]) { markers[k].remove(); delete markers[k]; }   // the drawing moves in the SAME frame as the words
        while (held.length > rest.length) held.pop().remove();
        if (burst) burst(door[0], door[1] - 40);
        if (chore) chore('deliver');
        const line = rest.length ? (COPY.deliveredOne || '').replace('{to}', where(k)).replace('{next}', where(rest[0])) : (COPY.delivered || '').replace('{to}', where(k));
        if (line) say(line);
        track('town_chore', { at: 'store', kind: 'deliver', to: k });
        if (!rest.length) clear();
        break;
      }
    }
  }
  return {
    tick,
    seam: {
      state: read, to: () => { const r = read(); return (r.to.length ? r.to : recipients()).slice(); },
      doors: () => { const r = read(); return (r.to.length ? r.to : recipients()).map((k) => homeOf(k)); },
      door: () => homeOf((read().to[0]) || recipients()[0]),
      parcelAt: () => PARCEL_AT.slice(),
      shown: () => ({ box: !!box, held: held.length, marker: Object.keys(markers).length }),
    },
  };
}
