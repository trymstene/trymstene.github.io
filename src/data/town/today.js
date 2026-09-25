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
  // (no cursed thing by daylight since 15 Sep — the curse belongs to the dark: every night lays its own out, town-room.js)
  { id: 'crows',    w: { abandoned: 4, struggling: 3, recovering: 1 } },                               // crows on the square
  { id: 'dayghost', w: { abandoned: 3, struggling: 1 } },                                              // a small ghost, in daylight, when the town is low
];
export const TODAY_N = { abandoned: 3, struggling: 3, recovering: 2, lively: 3, thriving: 4 };

// where each resident stands when the day sends them somewhere odd (a place key of
// town-life.js's stations), and in which beat
// ⚠️ NEVER WHERE SOMEBODY ELSE STANDS AT THAT HOUR (25 Sep 2026): five of these stood on a resident's own station — Nib and
// Spinner on the noon terrace (Bean and Stamp's lunch), Pip on Stamp at the dawn bus, Stamp and Dot on the Figs in the
// orchard, Bean on Gran Fig's garden bench. tools/check-design.mjs fails one that does.
export const ODD_SPOTS = {
  nib: ['terrace', 4], stamp: ['monument', 3], moss: ['monument', 4], pip: ['bus', 3], bean: ['garden_e', 4],
  // ⚠️ Fig Jr.'s odd spot was the notice board, which no longer exists (20 Sep 2026). The fruit cart
  // is the nearest thing to it in kind — somewhere in the square he does not work, a few steps from
  // his own stall — and it is a place town-life already has a station for.
  figjr: ['cart', 3], spinner: ['exchange', 2], dot: ['orchard', 1], granfig: ['cafe', 2],   // 🕹 Spinner's on an outdoor beat: his morning is indoors
  twirl: ['monument', 1],
};
// ⚠️ THE ARCADE (`condo`) IS NEVER HERE and never in a band's `shut` list: five shipped games must
// answer on a stranger's worst day (docs/town-jobs-plan.md §1, enforced by tools/check-design.mjs).
// The post office is out too — the mail never stops.
export const CLOSABLE = ['cafe', 'info', 'store'];
