// ✋ TWO GLOVES, ONE THING EACH — WHATEVER THE THING IS (1 Oct 2026). Trym, on the Citizens' board: "on one hand
// boxing gloves and a lightstick, and the other hand boxing glove and miniature banana? It shouldnt be possible to
// have two wearable items in one hand at the same time." The game's own hand items were already one per glove; a
// COMMUNITY item worn on a hand (a Forge piece, `wear.anchor: 'hand'`) was drawn on top of whatever that glove held,
// and nothing that dressed a banana knew the two kinds shared the hands.
//
// ONE RULE decides every glove, here, for the engine and every surface that dresses a banana (they take it from
// src/data/wearables.js, which re-exports it: the catalog file every one of them already loads). The bake and print
// renderer (tools/banana_render.py `_resolve_hands`) mirrors it, and tools/check-hands.mjs holds both to one table
// of cases. In order:
//   1. what the moment put in your hand claims first — a beer at the rave, the broom at work (`raveOnly`);
//   2. then a community item, on the glove it was drawn for; the newest on a glove wins it. The caught or bought
//      thing wins, the same call the hat and the shoes make (banana-builder.js normalizeSpots);
//   3. then the game's own hand items in catalog order: their own glove, else the free one, else not drawn.
// "left" is the glove on the LEFT of the picture (the frame's hands[0]) everywhere: the engine, the Forge, the catalog.

export const gloveOf = (c) => (c && c.hand === 'left' ? 'left' : 'right');

/**
 * Who holds what. `defs`: the game's hand items that are on, in catalog order. `customs`: the community items worn,
 * in the order they were put on ({anchor, hand, …}; anything not on a hand is ignored).
 * Returns { left, right } (a game item per glove, or null) and `own` { left, right } (a community item per glove).
 */
export function resolveHands(defs, customs) {
  const out = { left: null, right: null, own: { left: null, right: null } };
  const free = (g) => !out[g] && !out.own[g];
  const put = (d) => {
    const pref = d.hand === 'left' ? 'left' : 'right';
    const other = pref === 'left' ? 'right' : 'left';
    if (free(pref)) out[pref] = d;
    else if (free(other)) out[other] = d;
  };
  const list = defs || [];
  list.filter((d) => d.raveOnly).forEach(put);
  for (const c of customs || []) if (c && c.anchor === 'hand' && !out[gloveOf(c)]) out.own[gloveOf(c)] = c;
  list.filter((d) => !d.raveOnly).forEach(put);
  return out;
}

const holds = (r, x) => r.left === x || r.right === x || r.own.left === x || r.own.right === x;

/**
 * PUT A THING IN A HAND, AND THAT HAND LETS GO OF WHAT IT HELD — the hat rule, for hands: the newest wins.
 * `on`: the game's hand items switched on (defs, catalog order, `put` among them if it is one). `worn`: the community
 * items worn as {id, anchor, hand}, in order (`put` among them if it is one). `put`: the one just put on, or null to
 * only tidy a loaded outfit. Returns what comes off — { off: [game item ids], drop: [community item ids] } — so what
 * is saved is exactly what is drawn.
 *   · a community item takes its own glove, and whatever that glove held lets go;
 *   · a game item takes a free glove if there is one, else its own glove lets go;
 *   · anything already hidden comes off too (it was not in the picture); a moment's item (`raveOnly`) never does,
 *     and neither does the thing just put on — if a moment's item is in the way, it shows when the moment is over.
 */
export function makeRoom(on, worn, put) {
  let defs = (on || []).slice(), cs = (worn || []).filter((c) => c && c.anchor === 'hand');
  const off = [], drop = [];
  const takeOff = (x) => {
    if (!x || x === put || x.raveOnly) return false;
    if (cs.includes(x)) { cs = cs.filter((c) => c !== x); drop.push(x.id); } else { defs = defs.filter((d) => d !== x); off.push(x.id); }
    return true;
  };
  const tidy = () => {
    const r = resolveHands(defs, cs);
    for (const x of [...defs, ...cs]) if (!holds(r, x)) takeOff(x);
    return resolveHands(defs, cs);
  };
  const isHand = !!(put && put.anchor === 'hand');
  const putOwn = isHand && cs.includes(put);
  // the picture before: what the hands held without the new thing (whatever was already hidden comes off here)
  if (isHand) { defs = defs.filter((d) => d !== put); cs = cs.filter((c) => c !== put); }
  const before = tidy();
  if (!isHand) return { off, drop };
  // the new thing goes on: a community item as the newest, a game item in its place in the catalog order
  if (putOwn) cs.push(put); else defs = (on || []).filter((d) => d === put || defs.includes(d));
  const pref = putOwn ? gloveOf(put) : (put.hand === 'left' ? 'left' : 'right');
  const full = (g) => !!(before[g] || before.own[g]);
  // a community item's glove always lets go; a game item makes room only when both hands are full
  if (putOwn || (full('left') && full('right'))) takeOff(before[pref] || before.own[pref]);
  // …and a game item blocked by the moment's item in its own glove takes the other one
  if (!putOwn && !holds(resolveHands(defs, cs), put)) {
    const r = resolveHands(defs, cs), other = pref === 'left' ? 'right' : 'left';
    takeOff(r[other] || r.own[other]);
  }
  tidy();
  return { off, drop };
}
