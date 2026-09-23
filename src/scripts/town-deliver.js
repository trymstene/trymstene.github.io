// 📦 THE STORE'S HOME DELIVERY (23 Sep 2026; the job ladder's slice 3 — Trym: "yes build it all").
//
// The general store is an ON-CALL job, and Trym's frame for those is that they level up by reaching further into the
// world, not by adding a minigame. So from Pip's third rank the store sometimes has a parcel for a resident: Pip's call
// rings wherever you are, the parcel waits on the store's floor by the door, you walk onto it to pick it up (the town's
// walk-over rule), and you carry it across the square — a little slower, it is heavy — to the resident's own door, where a
// marker bounces. Arriving there delivers it: work XP, and the call is answered.
//
// ⭐ WHAT THE PLAYER IS TOLD, AND WHEN. The call says there is a parcel (the work note, the pager). Picking it up says who it
// is for and where, in one line — the only moment that needs words — and from then on the marker over the door is the
// signpost. Arriving says it arrived. Nothing else speaks: no timer, no running commentary.
//
// ⚠️ IT DECIDES NOTHING ABOUT THE WEEK. The call is work-calls.js (`deliver`, answered by `tw-deliver-v1`), the XP is the
// pass worker's (`deliver` chore, jobs.js XP.store.deliver), the doors are town-life.js's (homeOf). This is the parcel.
const COPY_MODS = import.meta.glob('../data/copy/town-deliver.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

export const TO = ['nib', 'stamp', 'moss', 'bean', 'figjr', 'spinner', 'dot', 'granfig'];   // everybody but Pip, whose store it is
const PARCEL_AT = [560, 884];   // on the store's floor, in the aisle just inside the door
const GRAB = 34, ARRIVE = 64;   // how near a foot must come to the parcel, and to the door
const KEY = 'tw-deliver-v1';
const IMG = '/assets/town/s-box1-0.png';

export function bootTownDeliver(ctx) {
  const { world, W, H, pct, pos, say, track, burst, job, chore, open, room, homeOf, setSlow } = ctx;
  const today = () => Math.floor(Date.now() / 864e5);
  const read = () => { try { const r = JSON.parse(localStorage.getItem('tw-deliver-v1') || 'null'); return r && r.d === today() ? r : { d: today(), n: 0, carry: 0, to: '' }; } catch (e) { return { d: today(), n: 0, carry: 0, to: '' }; } };
  const write = (r) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} };
  let box = null, held = null, marker = null;
  const el = (cls) => { const e = document.createElement('i'); e.className = cls; e.innerHTML = '<img alt="" src="' + IMG + '">'; world.appendChild(e); return e; };
  const put = (e, x, y, z) => { e.style.left = pct(x, W); e.style.top = pct(y, H); e.style.zIndex = String(z); };
  // who today's parcel is for: the day's own draw, the same all day on this device
  const recipient = () => TO[(today() * 2654435761 >>> 0) % TO.length];
  const where = (to) => ((COPY.to || {})[to] || '');

  function clear(which) {
    if ((!which || which === 'box') && box) { box.remove(); box = null; }
    if ((!which || which === 'held') && held) { held.remove(); held = null; }
    if ((!which || which === 'marker') && marker) { marker.remove(); marker = null; }
  }
  // the frame: the parcel on the floor, in your hands, the marker over the door — and the pickup and the arrival
  function tick() {
    const r = read(), j = job();
    const mine = !!(j && j.at === 'store');
    if (!mine || r.n > 0 || (!r.carry && !open())) { clear(); if (r.carry && !mine) { r.carry = 0; write(r); setSlow(1); } return; }
    const inside = room() === 'store';
    if (!r.carry) {
      clear('held'); clear('marker');
      if (!inside) { clear('box'); return; }
      if (!box) { box = el('tw-deliver__box is-in'); put(box, PARCEL_AT[0], PARCEL_AT[1], 2100 + PARCEL_AT[1]); }
      if (Math.hypot(pos.x - PARCEL_AT[0], pos.y - PARCEL_AT[1]) < GRAB) {   // picked up by walking onto it
        r.carry = 1; r.to = r.to || recipient(); write(r);
        clear('box'); setSlow(0.8);
        const line = (COPY.picked || '').replace('{to}', where(r.to));
        if (line) say(line);
        track('town_chore', { at: 'store', kind: 'pickup', to: r.to });
      }
      return;
    }
    // carrying: over your head, wherever you are — and outdoors a marker over the door it is going to
    if (!held) { held = el('tw-deliver__held is-in'); setSlow(0.8); }
    put(held, pos.x, pos.y - 22, 2110 + Math.round(pos.y));
    const door = homeOf(r.to);
    if (!door) return;
    if (inside) { clear('marker'); return; }
    if (!marker) { marker = el('tw-deliver__to is-in'); put(marker, door[0], door[1] - 70, 2300); }
    if (room() === '' && Math.hypot(pos.x - door[0], pos.y - door[1]) < ARRIVE) {   // arrived: delivered
      r.carry = 0; r.n = 1; write(r);
      clear(); setSlow(1);
      if (burst) burst(door[0], door[1] - 40);
      if (chore) chore('deliver');
      const line = (COPY.delivered || '').replace('{to}', where(r.to));
      if (line) say(line);
      track('town_chore', { at: 'store', kind: 'deliver', to: r.to });
    }
  }
  return {
    tick,
    seam: { state: read, to: () => read().to || recipient(), door: () => homeOf(read().to || recipient()), parcelAt: () => PARCEL_AT.slice(), shown: () => ({ box: !!box, held: !!held, marker: !!marker }) },
  };
}
