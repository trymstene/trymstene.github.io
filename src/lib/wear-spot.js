// 👕 PUT A THING ON, AND ITS SPOT LETS GO — FORGE PIECES INCLUDED (1 Oct 2026).
//
// The builder, the Banana Stand and the product page always knew that a hat takes a head-anchored Forge piece off and
// shoes take a feet one, and since today a held thing makes room in the hands (src/lib/hands.js, design library §52).
// The surfaces that put one of the game's own things on without the builder's catalog row — the town's dressing room,
// Nib's present, the beach's plush — did not: in the world the two stacked, or the new thing hid behind the old.
// This is that rule for them, in one place.
//
// ⚠️ It reads the Forge pieces' spots from the catalog (drops.js), so call it once loadCatalog() has landed. Before
// that no Forge piece comes off — and the hands rule still decides what is drawn, so nothing ever doubles up.
import { EXTRA_DEFS, HAT_BY_ID } from './banana-engine.js';
import { catCustom, catAnchorOf, anchorSlot } from './drops.js';
import { makeRoom } from '../data/wearables.js';

const EXTRA = Object.fromEntries(EXTRA_DEFS.map((d) => [d.id, d]));
const ids = (c) => String(c || '').split(',').map((t) => t.trim()).filter(Boolean);

/**
 * The outfit right after `id` (a hat or one of the game's extras) went on — `o` already wears it — with whatever its
 * spot held let go: a Forge piece on the head or the feet, and in the hands whatever the newest thing displaced.
 * Touches `extras` and `c` only, and says which Forge pieces came off (`dropped`) so a save can take off exactly those.
 */
export function letGo(o, id) {
  const c = ids(o && o.c);
  const d = EXTRA[id];
  const slot = HAT_BY_ID[id] ? 'hat' : d && d.anchor === 'feet' ? 'feet' : null;
  const dropped = slot ? c.filter((x) => anchorSlot(catAnchorOf(x)) === slot) : [];
  const extras = { ...((o && o.extras) || {}) };
  if (d && d.anchor === 'hand') {
    const worn = c.filter((x) => !dropped.includes(x))
      .map((x) => { const p = (catCustom(x) || [])[0]; return p ? { id: x, anchor: p.anchor, hand: p.hand } : null; }).filter(Boolean);
    const { off, drop } = makeRoom(EXTRA_DEFS.filter((h) => h.anchor === 'hand' && (extras[h.id] || h.id === id)), worn, d);
    off.forEach((k) => { delete extras[k]; });
    dropped.push(...drop);
  }
  return { ...o, extras, c: c.filter((x) => !dropped.includes(x)).join(','), dropped };
}
