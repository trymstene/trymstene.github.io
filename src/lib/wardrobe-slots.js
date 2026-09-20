// 👕 THE WARDROBE, AS DATA — which garments a banana may wear, and where what it wears is kept.
//
// ⭐ WHY THIS FILE EXISTS. Three things dress a banana in this world and each had its own hand-copy of
// the rules: the builder (src/scripts/banana-builder.js, inside a 1 000-line init() closure that
// exports nothing), the custom-product page (src/scripts/sticker-pdp.js, whose own comment says the
// gates were "copied from the builder so the shop and the workshop agree"), and now the town's
// dressing room. A third hand-copy is how the shop and the world start disagreeing about what you own.
//
// This file owns the two GATES and the one KEY. It draws nothing and knows nothing about a screen, so
// the town's card, the shop's page and the builder can all consume it without agreeing about anything
// else. The picture half already lives in src/lib/wardrobe-ui.js (chips, trays, tooltips) and the
// drawing half in src/lib/banana-engine.js (drawComposite).
//
// ⚠️ THE TWO GATES BEHAVE OPPOSITELY, and getting them the same way round is the whole point:
//   ownsWearable  → stand stock you have not bought: HIDDEN ENTIRELY. It is for sale over at the
//                   stand, not a thing you own, and a locked chip for it would read as a tease.
//   earned        → a drop you catch at the rave, the pier or the garden: SHOWN BUT LOCKED, because
//                   seeing it is the whole point — you learn it exists and where to go and get it.
//
// ⚠️ AND `c` IS NEVER CLOBBERED. The community slot holds visitor-made wearables that ride the engine's
// single custom slot; five separate resolvers already read it (drops.js says so out loud). Nothing here
// resolves one — a sixth copy of that resolver is exactly the drift this file exists to stop — but
// every write preserves whatever is in it, so dressing in town cannot undress a rave catch.
import { EXTRA_DEFS, HATS, GLASSES, HAT_BY_ID, SHADE_BY_ID } from './banana-engine.js';
import { ownsWearable } from '../data/wearables.js';

const WORN_KEY = 'bb-last';   // declared in tools/storage-keys.mjs, travels: 'pass'

// ── the earned gate ───────────────────────────────────────────────────────────────────────────────
const pass = () => { try { return JSON.parse(localStorage.getItem('pass-v1') || '{}') || {}; } catch (e) { return {}; } };

/** Has this player actually caught the drop a garment is gated behind? */
export function earnedUnlocked(d) {
  if (!d || !d.earned) return true;
  try {
    const p = pass();
    if (d.stat) return ((p.stats || {})[d.stat] || 0) > 0;
    if (d.flag) return localStorage.getItem(d.flag) === '1';
    if (d.patch) return !!((p.patches || {})[d.patch]);
  } catch (e) {}
  return false;
}

/** Where a locked garment is caught — a door, never a refusal. */
export function earnDoor(d) {
  const where = d && d.earned;
  return where === 'pier' ? { href: '/beach/', at: 'the pier' }
    : where === 'garden' ? { href: '/park/', at: 'the park garden' }
      : { href: '/rave/', at: 'the rave' };
}

// ── the slots ─────────────────────────────────────────────────────────────────────────────────────
// HATS and GLASSES arrive from the engine already filtered by ownsWearable and already carrying a
// leading ['none', 'None'] — the extras have no such list, so they are gated here the same way.
// ⚠️ THREE KINDS OF DEF NAME THEIR PICTURE DIFFERENTLY. A hat and an extra carry `art`; a pair of
// shades carries `front` and `side` instead, because it is drawn differently depending on which way the
// banana is facing, and has no single `art` at all. Falling back to the id gives a key that is in no art
// table, which renders as an empty chip with no error anywhere — measured, on the whole SPECS rail.
const row = (d) => ({ id: d.id, label: d.label, art: d.art || d.front || d.id, locked: !earnedUnlocked(d), door: earnDoor(d) });

/**
 * The three trays, as plain data. `pick` is the id to write into its slot; extras are a SET, so an
 * extra's pick toggles. Nothing here is a DOM node: the caller draws it.
 */
export function slots() {
  const hatOf = (id) => HAT_BY_ID[id] || { id, label: id, art: id };
  const shadeOf = (id) => SHADE_BY_ID[id] || { id, label: id, art: id };
  return [
    { key: 'hat', kind: 'one', items: HATS.map(([id, label]) => (id === 'none' ? { id, label, art: '', locked: false } : row({ ...hatOf(id), label }))) },
    { key: 'glasses', kind: 'one', items: GLASSES.map(([id, label]) => (id === 'none' ? { id, label, art: '', locked: false } : row({ ...shadeOf(id), label }))) },
    { key: 'extras', kind: 'many', items: EXTRA_DEFS.filter(ownsWearable).map(row) },
  ];
}

// ── the one key ───────────────────────────────────────────────────────────────────────────────────
/** What this banana is wearing, in the shape drawComposite takes. Never strips `c`. */
export function readWorn() {
  try {
    const s = JSON.parse(localStorage.getItem(WORN_KEY) || '{}') || {};
    return { hat: s.hat || 'none', glasses: s.glasses || 'none', extras: s.extras || {}, c: s.c || '', effect: s.effect || 'none' };
  } catch (e) { return { hat: 'none', glasses: 'none', extras: {}, c: '', effect: 'none' }; }
}

/**
 * Save an outfit. ⚠️ MERGED over whatever is there, exactly the way the builder does it
 * (banana-builder.js: "writing it back can never silently undress a rave catch") — so a surface that
 * does not offer the community row, like the town's dressing room, cannot take one off by saving.
 * @param {object} o  {hat, glasses, extras}
 * @param {function} [push]  the pass layer's passPush, if the caller has it: the outfit rides the sync
 *                           blob, and its last-write clock is stamped by collectBlob, not here.
 */
export function writeWorn(o, push) {
  try {
    let prev = {};
    try { prev = JSON.parse(localStorage.getItem(WORN_KEY) || '{}') || {}; } catch (e) {}
    localStorage.setItem(WORN_KEY, JSON.stringify({
      ...prev,
      hat: o.hat || 'none',
      glasses: o.glasses || 'none',
      extras: o.extras || {},
    }));
  } catch (e) {}
  try { if (typeof push === 'function') push(); } catch (e) {}
}

/**
 * The shape drawComposite wants for a preview: the garments, and nothing a builder adds.
 * ⚠️ drawComposite reads o.extras.<id> unguarded, so a PARTIAL outfit throws and every banana after it
 * silently never draws. This is the whole-outfit literal every surface in the world hands it.
 */
export function drawable(o) {
  return { hat: o.hat || 'none', glasses: o.glasses || 'none', extras: o.extras || {}, c: o.c || '', custom: o.custom, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
}
