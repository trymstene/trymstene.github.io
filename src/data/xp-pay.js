// ✨ WHAT EVERY AREA PAYS IN WORLD XP (2 Oct 2026, the endgame plan's step 1c). Trym: "we are now building with all
// areas in mind … orchestrating for all areas, not just a couple of them".
//
// Before this, an hour of play paid about 8 700 XP on the rave's floor, 1 500–2 500 on the bay, 150–300 in the park,
// 20–40 in the town and nothing at the homestead, so a player who lived in the town or on the farm never levelled. The
// aim is ~1 500–3 000 an hour of play in every area, with the floor still the fastest. Every number is here so the band
// is tuned in one place, and the first cut is on the careful side: XP given can never be taken back. A source a reload
// can bring back (the town's flyers, the park's acorns and puddles, the bay's shells) is NOT raised. Pure data.
export const XP_PAY = {
  town: {
    workMul: 2,      // × the Work XP the server counted for a verb (already inside the workplace's day cap)
    fixMul: 5,       // × a fixed problem's own XP (1–3): a lamp, a bin, a tag, a dumpster…
    order: 30,       // one of Tally's orders delivered (server-confirmed, three a day)
    spin: 3,         // a turn of the Wheel of Peel (server-confirmed: one free a day, paid ones capped at thirty)
    best: 25,        // a new personal best at an arcade cabinet (the server says so)
    run: 5,          // an arcade run with a score — the first `runsPerDay` of a day on this device
    runsPerDay: 12,
    step: 25,        // a chapter step, once per player (a pass receipt, qxp_<step>)
    ghost: 15,       // a ghost caught, once per ghost a day
    curse: 25,       // a cursed thing found for the first time
  },
  homestead: {
    pet: 5,          // an animal hugged, once a day each
    feed: 10,        // the trough filled, once a day
    egg: 3, milk: 3, cheese: 4, wool: 6,   // produce as it is collected (drawn once a day)
    harvest: 6,      // a crop out of the bed
    cook: 10,        // a dish off the fire
    place: 10,       // a piece set out for the first time (a pass receipt, hsp_<id>)
    neighbour: 5,    // watering, a hug or a feed in somebody else's yard (the server allows one of each a day)
  },
  park: { choreMul: 3, starXp: 12 },   // the garden's chores × 3; a harvest pays its stars × 12 (was × 8)
  bay: { fish: { common: 4, uncommon: 6, rare: 12, legendary: 25 }, newFish: 10, treasure: 30 },
  forge: { approved: 100 },            // a piece of yours approved into the catalog, once per piece
};
