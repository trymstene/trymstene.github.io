// 🏘️ TOWN LIFE — TODAY: the small things that are simply happening (14 Sep 2026).
//
// Two to four a day, picked with the day seed and weighted by the band, on top of the real
// weather and the real band — so two visits rarely resolve into the same sequence
// (docs/town-life-plan.md §6). A row is an event TYPE and its weight per band; a band that
// is not listed cannot draw it. town-room.js does the drawing and the staging.
export const TODAY = [
  { id: 'merchant', w: { lively: 3, thriving: 5 } },                                                  // the travelling stall is in
  { id: 'oddspot',  w: { abandoned: 1, struggling: 2, recovering: 3, lively: 3, thriving: 3 } },       // a resident stands somewhere they never stand
  { id: 'closed',   w: { struggling: 3, recovering: 3, lively: 2, thriving: 1 } },                     // a kiosk is shut today (fixing it reopens it)
  { id: 'object',   w: { abandoned: 3, struggling: 2, recovering: 1, lively: 1, thriving: 1 } },       // a strange object in an alley, by daylight
  { id: 'crows',    w: { abandoned: 4, struggling: 3, recovering: 1 } },                               // crows on the square
  { id: 'dayghost', w: { abandoned: 3, struggling: 1 } },                                              // a small ghost, in daylight, when the town is low
];
export const TODAY_N = { abandoned: 3, struggling: 3, recovering: 2, lively: 3, thriving: 4 };

// where each resident stands when the day sends them somewhere odd (a place key of
// town-life.js's stations), and in which beat
export const ODD_SPOTS = {
  nib: ['terrace', 2], stamp: ['orchard', 2], moss: ['monument', 4], pip: ['bus', 0], bean: ['garden_w', 4],
  figjr: ['board', 3], spinner: ['terrace', 1], dot: ['orchard', 3], granfig: ['cafe', 2],
};
export const CLOSABLE = ['cafe', 'info'];
