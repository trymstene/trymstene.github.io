// 🧺 THE RESIDENTS' ERRANDS (27 Sep 2026). Trym: "noone looks like they are out and about doing important town-things -
// they just stand there like dolls" — and on the live town each resident walked 3–16 s in five minutes. So once in a working
// beat a resident takes a short trip with the thing they carry, and comes back to their post: Stamp a letter to a door, Nib
// the hall's papers to the post office, Bean a coffee to a bench, Fig Jr. to the orchard for lemons, Gran Fig the watering can
// to the other garden, Dot a flyer to the monument lane or the bus stop, Twirl round the fountain calling people to the wheel,
// Spinner the ball out to the square. Still "mainly standing by their shops" (Trym, 20 Sep): never more than CAP out at
// once, never on the noon break or at night, never somebody kept in, pulled aside or standing somewhere odd, never the one
// you are walking up to (town-life.js holds them on a tap).
//
// ⭐ ITS OWN CHUNK, loaded a beat after the square settles (banana-town.js): the town's own script sits at its 70 000 line
// (tools/budgets.json) and nothing waits on an errand. town-life.js keeps the hooks — who is where, the tap's hold — and
// hands this module its reach (x = { res, route, poof, hourNow, beat }).
//
// ⚠️ EVERY SPOT WAS DRAWN ON THE BAKED PLATE before it went in: a resident stands ~46 × 86 on the point, and it must be open
// ground. The Hall Street lamps stand hard against the Exchange and Wheel stalls, so no errand goes to them.
const CAP = 3;
const AFTER = [9000, 50000];   // from reaching their post to setting off: min + spread
const PAUSE = [2600, 3400];    // how long they stay at the far end: min + spread
const ACTS = new Set(['counter', 'stand', 'water']);
const DAY_MS = 720000, HOUR_MS = 30000, WALK = 110;   // town-life.js's own clock and pace
// the far ends: the life module's doors (HOME) and stations (ST), named beside each
export const SPOTS = {
  stamp: [[1100, 590], [154, 590], [480, 592], [1620, 1068], [1770, 1068], [480, 1068]],   // doors: hall, clothes, arcade, print, café, store
  nib: [[1700, 590], [1012, 1210]],                                                      // the post office's door, the info kiosk
  bean: [[1215, 992], [995, 992], [1835, 1242]],                                         // behind the square's benches, the terrace
  figjr: [[792, 322]],                                                                   // the orchard
  granfig: [[1730, 698], [792, 322]],                                                    // the east garden, the orchard
  dot: [[1415, 482], [1962, 352], [716, 1046]],                                          // the monument lane, the bus stop, the ATM's lamp
  twirl: [[1260, 880], [960, 880]],                                                      // either side of the fountain
  spinner: [[962, 576], [1000, 950]],                                                    // the lemonade stand, the square
  tally: [[1060, 590], [1880, 1068]],                                                    // the hall's and the café's spare marks: slips to collect
};

// the life module's stable 0..1 (no Math.random anywhere in the town's clockwork)
function h01(a, b, c) {
  let q = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  q = Math.imul(q ^ (q >>> 16), 0x7feb352d); q = Math.imul(q ^ (q >>> 15), 0x846ca68b);
  return ((q ^ (q >>> 16)) >>> 0) / 4294967296;
}
const dayIdx = () => Math.floor(Date.now() / DAY_MS);

// standing at their post: this beat's errand gets its moment the first time they are seen there
export function tick(n, now, x) {
  const b = x.beat();
  if (n.errandBeat === b || !SPOTS[n.key]) return;
  if (!n.errandAt) n.errandAt = now + AFTER[0] + h01(n.idx + 1, b + 1 + dayIdx() * 7, 81) * AFTER[1];
  else if (now >= n.errandAt && !n.danceAt) send(n, now, x);
}

// set off — or wait a little (somebody walking up to them, CAP already out), or skip the beat (not at work here, or no time
// left to get there and back before it turns). `force` is the QA seam's.
export function send(n, now, x, force) {
  if (!n || !n.st || !SPOTS[n.key]) return false;
  const b = x.beat(), d = n.day[n.beat] || [];
  // ⚠️ never one the story INSISTS on (a chapter's scene holds them at a place, 28 Sep 2026: Gran Fig walked her errand to
  // the post office with the ! riding her head while the note said "find her in the west garden")
  const atWork = !n.hidden && !n.inside && !n.kept && !n.loop && !n.insist && n.beat !== 2 && n.beat !== 5
    && ACTS.has(n.act) && n.place === d[0] && n.at === n.place;
  if (!atWork && !force) { n.errandBeat = b; n.errandAt = 0; return false; }
  if (!force && (now < (n.holdUntil || 0) || x.res.filter((m) => m.errand).length >= CAP)) { n.errandAt = now + 4000; return false; }
  const spots = SPOTS[n.key];
  const to = spots[Math.floor(h01(n.idx + 1, b + 1 + dayIdx() * 7, 83) * spots.length) % spots.length];
  const out = x.route([n.x, n.y], to);
  let len = 0, p = [n.x, n.y];
  for (const q of out) { len += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
  const left = ((b + 1) * 4 - x.hourNow()) * HOUR_MS / 1000;   // seconds of this beat still to run
  if (!force && left < 2 * len / WALK + (PAUSE[0] + PAUSE[1]) / 1000 + 8) { n.errandBeat = b; n.errandAt = 0; return false; }
  n.errand = { phase: 'out', back: [n.st[0], n.st[1]], face: n.face };
  n.errandBeat = b; n.errandAt = 0;
  n.path = out; n.wait = 0; n.walking = false; n.at = ''; n.drift = null;
  return true;
}

// a leg ends: at the far end, the puff of the thing done, a moment there, and back (true: the life module stops there);
// home from it, facing the way they were (false: the life module carries on and they have arrived at their post)
export function arrive(n, x) {
  if (n.errand.phase === 'out') {
    x.poof(n.x, n.y - 6);
    n.face = n.dir === 'left' ? 'left' : n.dir === 'right' ? 'right' : (n.x > 1100 ? 'left' : 'right');
    n.errand.phase = 'back';
    n.path = x.route([n.x, n.y], n.errand.back);
    n.wait = PAUSE[0] + h01(n.idx + 1, n.beat + 1, 84) * PAUSE[1];
    return true;
  }
  n.face = n.errand.face; n.errand = null;
  return false;
}
