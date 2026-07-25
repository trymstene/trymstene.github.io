// 🎁 BANANA WORLD — DROPS, an area-agnostic capability.
//
// Community wearables drop across the WHOLE world, not one place. This module
// owns the generic half — WHICH item is tonight's drop, WHO owns it, RECORDING
// the catch, and the world CLOCK. An area supplies only the local half: a salt,
// where the drop floats in ITS coordinate space, how it's drawn, the proximity
// test, and two tiny callbacks (equip + celebrate).
//
// ⚠️ THE WORKER NEEDS NO CHANGE — sanitizeOutfit already whitelists the `c`
// custom slot and every room rebroadcasts `t:'outfit'`, so a caught community
// item is already relayed to peers everywhere. The only per-area cost is
// teaching that area's drawMe/drawPeer to RENDER outfit.c (see catCustom).
//
// FUTURE-AREA RECIPE (build area → multiplayer on → gates open → drops NATURAL):
//   1. (once, to unlock community items) in drawMe/drawPeer pass
//      `custom: o.c ? catCustom(o.c) : undefined`; seed your outfit's `c` from
//      readSavedOutfit(); broadcast with fullOutfit(). (Skip + pass custom:false
//      below to ship CURATED drops only, zero render work.)
//   2. const drops = createDrops({ salt: 0xNEW, equip, celebrate });
//   3. scale drops.spot(drops.window(now)) {u,v} into your coords + guards.
//   4. in your loop: render while drops.live(now); proximity test → drops.tryCatch(now).
import { seedRand, worldSid } from './world.js';
import { DROPS, ownsDropStat } from '../data/wearables.js';
import { wearToCustom } from './wear-render.js';
import { passStat, passGet } from './banana-pass.js';

const CATALOG_URL = 'https://banana-share.trymstene.workers.dev/catalog/items.json';
const CAUGHT_URL = 'https://banana-share.trymstene.workers.dev/catalog/caught';

// ── The world drop clock (the rave's GIFT_* cadence, promoted verbatim) ──
export const DROP_TEST = typeof location !== 'undefined' && location.search.includes('droptest');
export const DROP_PERIOD = DROP_TEST ? 40 : 210;   // one window every 3.5 min
export const DROP_WAIT = DROP_TEST ? 24 : 22;      // it floats for 22s
export const DROP_OFFSET = 90;
export function dropWindow(now = Date.now()) { return Math.floor((now / 1000 - DROP_OFFSET) / DROP_PERIOD); }
export function dropPhase(now = Date.now()) { return (now / 1000 - DROP_OFFSET) - dropWindow(now) * DROP_PERIOD; }
export function dropLive(now = Date.now()) { const p = dropPhase(now); return p >= 0 && p < DROP_WAIT; }
// unitless seeded spot for a window; the AREA scales {u,v}∈[0,1) into its own space + guards
export function dropSpot(window, salt) { return { u: seedRand(salt + window * 2), v: seedRand(salt + window * 2 + 1) }; }

// ── The catalog layer (fetch once, cache, never-cache-a-miss) ──
let CATALOG = [];
let _catPromise = null;
const CAT_CUSTOM = {};
export function loadCatalog() {                          // idempotent; returns the ONE shared promise
  if (_catPromise) return _catPromise;
  _catPromise = fetch(CATALOG_URL).then((r) => (r.ok ? r.json() : []))
    .then((items) => { if (Array.isArray(items)) CATALOG = items; return CATALOG; })
    .catch(() => CATALOG);
  return _catPromise;
}
export function catalogItems() { return CATALOG; }
export function catCustom(id) {                          // id -> engine custom payload {art,...}
  if (id in CAT_CUSTOM) return CAT_CUSTOM[id] || undefined;   // ⚠️ NEVER cache a miss (the P4-D bug)
  const it = CATALOG.find((x) => x.id === id);
  if (!it) return undefined;
  CAT_CUSTOM[id] = wearToCustom(it.wear);
  return CAT_CUSTOM[id] || undefined;
}

// ── Tonight's drop: date-seeded from DROPS + the catalog, identical on every client ──
export function worldDay() { return Math.floor(Date.now() / 86400000); }
// custom:false → curated-only pool. An area that has NOT wired catCustom passes
// custom:false and can never be handed an item it would equip invisibly.
export function tonightDrop({ custom = true, day = worldDay() } = {}) {
  const pool = [
    ...DROPS.map((d) => ({ ...d, catalog: false })),
    ...(custom ? CATALOG.slice().sort((a, b) => (a.added || 0) - (b.added || 0))
      .map((it) => ({ id: it.id, label: it.title || 'community item', by: it.by || '', catalog: true, wear: it.wear })) : []),
  ];
  if (!pool.length) return null;
  return pool[Math.floor(seedRand(0xd20b + day) * pool.length)] || pool[0];
}

// ── Ownership: the "do I already own it" gate + the "record the deed" write ──
export function catOwned() { try { return JSON.parse(localStorage.getItem('cat-own-v1') || '{}') || {}; } catch (e) { return {}; } }
export function dropOwned(drop) {                        // == the rave's giftEarned(), room-agnostic
  if (!drop) return true;
  try {
    if (ownsDropStat(drop.id)) return true;             // synced truth (own_<id> pass stat)
    if (drop.catalog) return !!catOwned()[drop.id];
    return localStorage.getItem(drop.flag) === '1';     // legacy per-device flag
  } catch (e) { return true; }
}
// Run ONCE per load anywhere drops are read: legacy flag <-> own_<id> <-> cat-own reconciliation
// so ownership rides the synced pass blob across devices AND legacy flag-readers keep working.
export function runDropBridge() {
  try {
    const stats = passGet().stats || {};
    DROPS.forEach((d) => {
      const has = localStorage.getItem(d.flag) === '1';
      if (has && !((stats['own_' + d.id] || 0) > 0)) passStat('own_' + d.id, 1);
      else if (!has && (stats['own_' + d.id] || 0) > 0) localStorage.setItem(d.flag, '1');
    });
    const own = catOwned();
    let dirty = false;
    Object.keys(stats).forEach((k) => {
      if (k.startsWith('own_c_') && stats[k] > 0 && !own[k.slice(4)]) { own[k.slice(4)] = Date.now(); dirty = true; }
    });
    Object.keys(own).forEach((id) => {
      if (/^c_/.test(id) && !((stats['own_' + id] || 0) > 0)) passStat('own_' + id, 1);
    });
    if (dirty) localStorage.setItem('cat-own-v1', JSON.stringify(own));
  } catch (e) {}
}

// ── Equip helpers (generic slot assignment; guarantee the `c` slot survives) ──
export function applyDropToOutfit(outfit, drop) {
  if (!outfit || !drop) return outfit;
  if (drop.catalog) outfit.c = drop.id;                 // the ONE custom slot
  else if (drop.slot === 'hat') outfit.hat = drop.id;
  else if (drop.slot === 'glasses') outfit.glasses = drop.id;
  else outfit.extras = { ...(outfit.extras || {}), [drop.id]: true };
  return outfit;
}
export function fullOutfit(o) { return { hat: o.hat, glasses: o.glasses, extras: o.extras || {}, c: o.c }; } // never strip c
export function readSavedOutfit() {                     // bb-last INCLUDING c (park+beach drop it today)
  try { const s = JSON.parse(localStorage.getItem('bb-last') || '{}'); return { hat: s.hat, glasses: s.glasses, extras: s.extras || {}, c: s.c }; }
  catch (e) { return { extras: {} }; }
}

// ── THE CATCH (writes only): ownership + bb-last + own_stat + catch-count ping.
// Returns {had}. Does NOT equip, broadcast or celebrate — those are area callbacks. ──
export function claimDrop(drop) {
  if (!drop) return { had: true };
  let had = false;
  try {
    if (drop.catalog) { const own = catOwned(); had = !!own[drop.id]; own[drop.id] = Date.now(); localStorage.setItem('cat-own-v1', JSON.stringify(own)); }
    else { had = localStorage.getItem(drop.flag) === '1'; localStorage.setItem(drop.flag, '1'); }
  } catch (e) {}
  try { const s = JSON.parse(localStorage.getItem('bb-last') || '{}'); applyDropToOutfit(s, drop); localStorage.setItem('bb-last', JSON.stringify(s)); } catch (e) {}
  if (!had) { try { passStat('own_' + drop.id, 1); } catch (e) {} }
  if (!had && drop.catalog) {                           // warm vanity tally, fire-and-forget, once per device
    try { fetch(CAUGHT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: drop.id, sid: worldSid() }) }).catch(() => {}); } catch (e) {}
  }
  return { had };
}

// ── The orchestrator: the ONLY thing an area instantiates ──
export function createDrops({ salt, custom = true, equip, celebrate } = {}) {
  runDropBridge();
  loadCatalog();                                        // fire-and-forget; tonightDrop upgrades on land
  let claimedWin = -1, cacheKey = '', cacheDrop = null;
  return {
    get drop() {                                        // memoised per (day, catalog size) — cheap in a 60fps loop
      const k = worldDay() + ':' + CATALOG.length;
      if (k !== cacheKey) { cacheKey = k; cacheDrop = tonightDrop({ custom }); }
      return cacheDrop;
    },
    owned() { return dropOwned(this.drop); },
    window: dropWindow,
    live(now = Date.now()) { return !!this.drop && !this.owned() && dropLive(now); },
    spot(window) { return dropSpot(window, salt); },    // {u,v}; the area scales
    // The area calls this the frame its own proximity test passes:
    tryCatch(now = Date.now()) {
      const d = this.drop; if (!d) return null;
      const win = dropWindow(now);
      if (win === claimedWin || this.owned()) return null;   // in-window + permanent idempotence
      claimedWin = win;
      const res = claimDrop(d);                         // writes ownership FIRST (owned() flips true synchronously)
      if (equip) equip(d, res.had);                     // area sets its outfit + broadcasts
      if (celebrate) celebrate(d, res.had);             // area ceremony
      return { drop: d, ...res };
    },
  };
}
