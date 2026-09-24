// 📦 CARRYING THINGS ACROSS THE SQUARE — the store's parcels, the post office's round and its morning mail bag (23–24 Sep 2026;
// the job ladder's slice 3 — Trym: "yes build it all", then "keep on building all of it").
//
// Trym's frame for the jobs: an ON-CALL job levels up by reaching further into the world, and the top of the ladder is the
// job that connects everyone. So three runs share one engine, each a thing you walk onto (or are handed), carry — a little
// slower, it has weight — and bring to a door on the square where a marker bounces:
//   parcel   the store, rank 3: Pip's parcel on the store's floor for a resident's door (rank 4: two, for two doors)
//   round    the post office, rank 5: after a round of sorting that counts, a satchel of three letters for three doors
//   bus      the post office, rank 6: in the town's morning the mail bus leaves a bag at the bus stop; you bring the post in
//
// ⭐ WHAT THE PLAYER IS TOLD, AND WHEN (design library §30). The parcel's call says there is one (the work note, the pager);
// the mail bag says so once, the first time it is there. Picking up — or being handed the satchel — says who each is for and
// where, in one line; from then on the markers over the doors are the signposts. Each arrival says it arrived; the last one
// says the run is done. No timer, no running commentary.
//
// ⚠️ IT DECIDES NOTHING ABOUT THE WEEK: the XP is the pass worker's (`deliver`, `letter`, `bag` chores, jobs.js XP), the
// parcel's call is work-calls.js, the doors are town-life.js's (homeOf). This is the carrying.
import { unlocked } from '../data/town/jobs.js';
const COPY_MODS = import.meta.glob('../data/copy/town-deliver.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

export const TO = ['nib', 'stamp', 'moss', 'bean', 'figjr', 'spinner', 'dot', 'granfig', 'twirl'];   // everybody but Pip, whose store it is
const GRAB = 34, ARRIVE = 64;   // how near a foot must come to a thing, and to a door
const IMG = { parcel: '/assets/town/s-box1-0.png', round: '/assets/town/s-letterseal-0.png', bus: '/assets/town/s-bag2-0.png' };
export const RUNS = {
  parcel: { at: 'store', unlock: 'deliver', from: { room: 'store', xy: [560, 884] }, pool: TO, salt: 0, chore: 'deliver' },
  round: { at: 'post', unlock: 'round', handed: true, pool: [...TO.filter((k) => k !== 'stamp'), 'pip'], salt: 7, n: 3, chore: 'letter' },   // never Stamp: the satchel leaves HIS counter
  bus: { at: 'post', unlock: 'bus', from: { room: '', xy: [1962, 392] }, pool: ['stamp'], salt: 0, n: 1, chore: 'bag', morning: true },
};

// each run's own record on this device — every key a literal where it is read and written (the storage gate)
const KEYS = {
  parcel: { get: () => localStorage.getItem('tw-deliver-v1'), set: (v) => localStorage.setItem('tw-deliver-v1', v) },
  round: { get: () => localStorage.getItem('tw-round-v1'), set: (v) => localStorage.setItem('tw-round-v1', v) },
  bus: { get: () => localStorage.getItem('tw-bus-v1'), set: (v) => localStorage.setItem('tw-bus-v1', v) },
};

export function bootTownDeliver(ctx) {
  const { world, W, H, pct, pos, say, track, burst, job, chore, open, room, homeOf, setSlow, morning } = ctx;
  const today = () => Math.floor(Date.now() / 864e5);
  const fresh = () => ({ d: today(), n: 0, of: 0, carry: 0, to: [], got: [], said: 0 });
  // every run is asked every frame, so each is read from storage once and then kept here; every write goes through both
  const mem = {};
  const read = (run) => {
    if (mem[run] && mem[run].d === today()) return mem[run];
    let r;
    try {
      r = JSON.parse(KEYS[run].get() || 'null');
      if (!r || r.d !== today()) r = fresh();
      if (!Array.isArray(r.to)) r.to = r.to ? [r.to] : [];   // a day begun before the fourth rank's two parcels
      if (!Array.isArray(r.got)) r.got = [];
    } catch (e) { r = fresh(); }
    return (mem[run] = r);
  };
  const write = (run, r) => { mem[run] = r; try { KEYS[run].set(JSON.stringify(r)); } catch (e) {} };
  const rank = () => { const j = job(); return Math.max(1, ((j && j.lad && j.lad.rank) | 0)); };
  const doorKey = (k) => String(homeOf(k) || '');
  const words = (run) => (run === 'parcel' ? COPY : COPY[run] || {});
  const where = (to) => ((COPY.to || {})[to] || '');
  // the day's recipients for a run: its own draw, the same all day, each for a different door
  function recipients(run) {
    const R = RUNS[run], n = R.n || (unlocked('store', 'second', rank()) ? 2 : 1), seed = (today() * 2654435761 + R.salt * 40503) >>> 0, out = [];
    // ⚠️ A STRIDE THAT SHARES NO FACTOR WITH THE POOL (24 Sep 2026): stepping by 3 through nine names only ever reached three
    // of them, and two could share a door — a satchel of two letters on some days. Every name is reachable now.
    const L = R.pool.length, gcd = (a, b) => (b ? gcd(b, a % b) : a), stride = [3, 5, 7, 1].find((v) => gcd(v, L) === 1);
    for (let i = 0; out.length < n && i < L; i++) {
      const k = R.pool[(seed + i * stride) % L];
      if (!out.includes(k) && !out.some((o) => doorKey(o) === doorKey(k))) out.push(k);
    }
    return out;
  }
  const mine = (run) => { const j = job(), R = RUNS[run]; return !!(j && j.at === R.at && unlocked(R.at, R.unlock, rank())); };
  const left = (r) => r.to.filter((k) => !r.got.includes(k));
  const done = (r) => r.of > 0 && r.n >= r.of;

  // ---- what is drawn: a thing waiting, the things in your hands, a marker over each door still to go ----
  const el = (cls, run) => { const e = document.createElement('i'); e.className = cls; e.innerHTML = '<img alt="" src="' + IMG[run] + '">'; world.appendChild(e); return e; };
  const put = (e, x, y, z) => { e.style.left = pct(x, W); e.style.top = pct(y, H); e.style.zIndex = String(z); };
  const drawn = {};   // run → { box, held: [], markers: {} }
  const D = (run) => drawn[run] || (drawn[run] = { box: null, held: [], markers: {} });
  function clear(run, which) {
    const d = D(run);
    if ((!which || which === 'box') && d.box) { d.box.remove(); d.box = null; }
    if (!which || which === 'held') { d.held.forEach((e) => e.remove()); d.held = []; }
    if (!which || which === 'markers') { Object.values(d.markers).forEach((e) => e.remove()); d.markers = {}; }
  }

  // picked up (or handed over): who each is for, in one line
  function lift(run, r) {
    r.carry = 1; r.to = r.to.length ? r.to : recipients(run); r.of = r.to.length; write(run, r);
    clear(run, 'box');
    const w = words(run), names = r.to.map(where);
    const line = run === 'parcel' && names.length > 1 ? (w.pickedTwo || '').replace('{to}', names[0]).replace('{to2}', names[1])
      : run === 'round' ? (w.given || '').replace('{to}', names[0] || '').replace('{to2}', names[1] || '').replace('{to3}', names[2] || '')
      : (w.picked || '').replace('{to}', names[0] || '');
    if (line) say(line);
    track('town_chore', { at: RUNS[run].at, kind: 'pickup', run, n: r.to.length });
  }
  const carrying = () => Object.keys(RUNS).find((run) => mine(run) && read(run).carry) || '';

  function tickRun(run) {
    const R = RUNS[run], r = read(run);
    if (!mine(run) || done(r)) { clear(run); if (r.carry && !mine(run)) { r.carry = 0; write(run, r); } return; }
    const d = D(run), here = room();
    if (!r.carry) {
      clear(run, 'held'); clear(run, 'markers');
      if (R.handed) return;   // the satchel is handed over, not found (give)
      const want = R.from.room === here && (run !== 'parcel' || open()) && (!R.morning || (morning && morning()));
      if (!want) { clear(run, 'box'); return; }
      if (!d.box) {
        d.box = el('tw-deliver__box is-in', run); put(d.box, R.from.xy[0], R.from.xy[1], (here ? 2100 : 100) + R.from.xy[1]);
        if (R.morning && !r.said && (words(run).waiting)) { r.said = 1; write(run, r); say(words(run).waiting); }   // said once, the first time it is there
      }
      if (!carrying() && Math.hypot(pos.x - R.from.xy[0], pos.y - R.from.xy[1]) < GRAB) lift(run, r);   // picked up by walking onto it
      return;
    }
    // carrying: over your head, stacked, wherever you are — and outdoors a marker over each door still to go
    const due = left(r);
    while (d.held.length > due.length) d.held.pop().remove();
    while (d.held.length < due.length) d.held.push(el('tw-deliver__held is-in', run));
    d.held.forEach((e, k) => put(e, pos.x, pos.y - 22 - k * 16, 2110 + Math.round(pos.y) + k));
    if (here) { clear(run, 'markers'); return; }
    for (const k of Object.keys(d.markers)) if (!due.includes(k)) { d.markers[k].remove(); delete d.markers[k]; }
    for (const k of due) {
      const door = homeOf(k); if (!door) continue;
      if (!d.markers[k]) { d.markers[k] = el('tw-deliver__to is-in', run); put(d.markers[k], door[0], door[1] - 70, 2300); }
      if (Math.hypot(pos.x - door[0], pos.y - door[1]) < ARRIVE) {   // arrived at this door: delivered
        r.got.push(k); r.n = r.got.length;
        const rest = left(r);
        if (!rest.length) r.carry = 0;
        write(run, r);
        if (d.markers[k]) { d.markers[k].remove(); delete d.markers[k]; }   // the drawing moves in the SAME frame as the words
        while (d.held.length > rest.length) d.held.pop().remove();
        if (burst) burst(door[0], door[1] - 40);
        if (chore) chore(R.chore);
        const w = words(run);
        const line = rest.length ? (w.deliveredOne || '').replace('{to}', where(k)).replace('{next}', where(rest[0])).replace('{n}', String(rest.length))
          : (w.delivered || '').replace('{to}', where(k));
        if (line) say(line);
        track('town_chore', { at: R.at, kind: R.chore, to: k });
        if (!rest.length) clear(run);
        break;
      }
    }
  }
  // the weight is read off what is in your hands every frame, never set at a moment: a reload mid-carry, a new day or a job
  // let go while carrying can then never leave a banana walking slowly with empty hands
  function tick() { for (const run of Object.keys(RUNS)) tickRun(run); setSlow(carrying() ? 0.8 : 1); }
  // the satchel, handed over at the post office counter once a round that counts is done (and its receipt closed)
  function give(run) {
    if (!RUNS[run] || !RUNS[run].handed || !mine(run) || carrying()) return false;
    const r = read(run); if (done(r) || r.carry) return false;
    lift(run, r);
    return true;
  }
  const seamOf = (run) => ({
    state: () => read(run), to: () => { const r = read(run); return (r.to.length ? r.to : recipients(run)).slice(); },
    doors: () => { const r = read(run); return (r.to.length ? r.to : recipients(run)).map((k) => homeOf(k)); },
    door: () => homeOf((read(run).to[0]) || recipients(run)[0]),
    parcelAt: () => (RUNS[run].from ? RUNS[run].from.xy.slice() : null),
    shown: () => { const d = D(run); return { box: !!d.box, held: d.held.length, marker: Object.keys(d.markers).length }; },
  });
  return {
    tick, give,
    seam: { ...seamOf('parcel'), run: seamOf, give },
  };
}
