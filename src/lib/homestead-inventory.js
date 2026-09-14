// 🏠 THE HOMESTEAD'S INVENTORY, FROM OUTSIDE THE HOMESTEAD (14 Sep 2026).
//
// The town sells furniture and decor for the player's yard (Town Life), and a cursed
// object found on a Curse Night goes home as the ordinary thing it is. Both need to put
// an item in the homestead's shed — or on the delivery van — without the homestead's
// script being loaded. This is the one door for that: the same localStorage record the
// homestead reads at boot (`hs-v1`), the same shapes it keeps (`shed: [{id}]`,
// `orders: [{id, at}]`), and `dirty: 1` so the next yard pull never overwrites the grant
// (banana-homestead.js: "the pull never overwrites unpushed work").
//
// The homestead itself calls the same functions with its in-memory `state`, so a buy on
// the phone and a buy in the town are one code path. ⚠️ a visitor's yard is never written
// here: the homestead passes its own state when it is at home, and the town writes the
// device's own record, which is always the player's own.
export const SHED_CAP = 40;   // the homestead publishes at most 40 shed pieces (yardBody); the town stops short of it
// 🚚 THE DELIVERY TIERS (Trym): commons build instantly, furniture and statement pieces
// take a van — short waits (hours, never days), and the arrival is an EVENT. Community
// pieces ride the van too (Trym, 7 Aug). One table for the phone and the town.
export const SHIP_MIN = { garden: 0, nature: 0, farm: 0, fun: 0, community: 60, lighting: 30, furniture: 60, display: 240,
  kitchen: 45, living: 45, bedroom: 45, bathroom: 45, hallway: 45, music: 45 };
export const shipMin = (d) => SHIP_MIN[d.cat] || 0;

export function readHome() {
  try {
    const s = JSON.parse(localStorage.getItem('hs-v1') || 'null');
    return s && s.v === 1 ? withInventory(s) : null;
  } catch (e) { return null; }
}
export function withInventory(s) {
  if (!Array.isArray(s.shed)) s.shed = [];
  if (!Array.isArray(s.orders)) s.orders = [];   // deliveries on the way
  return s;
}
const fresh = () => ({ v: 1, name: '', claimedAt: 0, stage: 0, items: [], shed: [], soil: [], orders: [] });
function write(s) {
  s.dirty = 1;
  try { localStorage.setItem('hs-v1', JSON.stringify(s)); } catch (e) {}
}
// read the device's record (or start one), change it, write it back — unless the caller
// handed in a live state, in which case it saves
function edit(state, fn) {
  if (state) return fn(withInventory(state));
  const s = readHome() || fresh();
  const out = fn(s);
  write(s);
  return out;
}

/** the house-ladder gate the shop's stage rule reads (0 = the plot) */
export function homeStage(state) { const s = state || readHome(); return s ? (s.stage | 0) : 0; }
export function shedCount(state) { const s = state || readHome(); return s ? withInventory(s).shed.length + withInventory(s).orders.length : 0; }
export function canHold(state) { return shedCount(state) < SHED_CAP; }
export function hasInShed(id, state) { const s = state || readHome(); return s ? withInventory(s).shed.filter((x) => x && x.id === id).length : 0; }

/** a piece lands in the shed now (commons, garden things, a cursed find) */
export function grantToShed(id, state) {
  return edit(state, (s) => { if (!state && s.shed.length + s.orders.length >= SHED_CAP) return false; s.shed.push({ id }); return true; });
}
/** a piece goes on the van: `mins` from now it is in the shed (the homestead's SHIP_MIN tiers) */
export function orderFor(id, mins, state) {
  const at = Date.now() + Math.max(0, mins | 0) * 60000;
  return edit(state, (s) => { if (!state && s.shed.length + s.orders.length >= SHED_CAP) return false; s.orders.push({ id, at }); return true; });
}
/** one piece leaves the shed (sold back, turned in) — false if there was none */
export function takeFromShed(id, state) {
  return edit(state, (s) => { const i = s.shed.findIndex((x) => x && x.id === id); if (i < 0) return false; s.shed.splice(i, 1); return true; });
}
/** the van arrives: every order due by `now` moves into the shed; returns what arrived */
export function dueOrders(state, now) {
  const t = now || Date.now();
  return edit(state, (s) => {
    const due = s.orders.filter((o) => o.at <= t);
    if (!due.length) return due;
    s.orders = s.orders.filter((o) => o.at > t);
    due.forEach((o) => s.shed.push({ id: o.id }));
    return due;
  });
}
