// 🏘️ TOWN LIFE — the bands, and how the town LOOKS in each (14 Sep 2026).
//
// Town Life is a number the TownRoom keeps (worker-rave, 0–100, drifting toward a set
// point). Nobody reads the number: a player walking in knows the band from the square.
// This table is the whole translation. town-room.js reads it; nothing here is a rule
// about play, only about what is lit, shut, littered and out. docs/town-life-plan.md §4.
//
// Every value is a COUNT or a FRACTION the client draws with a day-seeded pick, the same
// for everybody looking (a dark lamp is the same dark lamp for every player today).
export const BANDS = ['abandoned', 'struggling', 'recovering', 'lively', 'thriving'];
export const BAND_LO = { abandoned: 0, struggling: 15, recovering: 40, lively: 65, thriving: 85 };
// ⚠️ HYSTERESIS: a band is left only three points below where it was entered, so a town
// sitting on a line does not blink between two looks every poll
export const HYST = 3;

export const LOOK = {
  //             lamps that are dark at night · that stutter · homes whose window stays dark
  //             kiosks with the shutter down · litter level (town-life.js LITTER_MORE)
  //             full street bins (of three) · full dumpsters (of two) · the fountain
  //             share of residents out · crows · visitors · décor
  // ❌ `visitors` IS 0 EVERYWHERE NOW (21 Sep 2026). It used to bake one or three bananas beside the
  //  fountain, standing still all day — Trym: "these three suspects always stands there statically …
  //  looks very mechanical". Their head count moved into the LIVING crowd (town-folk.js CROWD), which
  //  walks in, shops, carries the bags home and sits on the benches. The column stays so the room's
  //  reader needs no change, and so nobody adds a statue back without reading this.
  // (rubbish piles and graffiti are not a shared look: they come only as a player's own
  //  problems, src/data/town/problems.js, so what you can fix is what you see)
  abandoned:  { lampsOut: 5, lampsFlicker: 2, windowsDark: 0.8, shut: ['cafe', 'info', 'store'], litter: 2,
                bins: 3, dumps: 2, fountain: 'dry', outside: 0.4, crows: 3, visitors: 0, dayghost: 1 },
  struggling: { lampsOut: 3, lampsFlicker: 2, windowsDark: 0.5, shut: ['cafe'], litter: 1,
                bins: 2, dumps: 1, fountain: 'on', outside: 0.7, crows: 2, visitors: 0, dayghost: 0 },
  recovering: { lampsOut: 1, lampsFlicker: 1, windowsDark: 0.2, shut: [], litter: 1,
                bins: 1, dumps: 1, fountain: 'on', outside: 0.9, crows: 1, visitors: 0, dayghost: 0 },
  lively:     { lampsOut: 0, lampsFlicker: 0, windowsDark: 0, shut: [], litter: 0,
                bins: 0, dumps: 0, fountain: 'on', outside: 1, crows: 0, visitors: 0, dayghost: 0 },
  thriving:   { lampsOut: 0, lampsFlicker: 0, windowsDark: 0, shut: [], litter: 0,
                bins: 0, dumps: 0, fountain: 'on', outside: 1, crows: 0, visitors: 0, dayghost: 0 },
};

// 🔁 HOW MUCH THERE IS TO DO — and it is the same at every band (19 Sep 2026).
//
// This used to fall away as the town got better (9 at Abandoned down to 2 at Thriving), which
// had two consequences nobody wanted. The square was at its most boring at its best, and the
// arithmetic made a solo climb impossible: above the set point the town loses 0.6 an hour, so
// 14.4 a day, while two fixes returned four. One player could never hold a good town up.
//
// So the number is flat, and the DAY'S WORK ARRIVES IN WAVES. About six of your own things are
// open at a time, and a fresh set is drawn roughly every six hours — which is what makes the
// town worth opening twice in a day (Trym, 19 Sep: "high repeatability play throughout a normal
// 24h human day"). Nothing accumulates while you are away: you always walk in to about six, never
// to a backlog.
//
//   six open × four waves  = 24 things a day within reach
//   the pass counts 12     = TOWN_FIX_CAP 24 ÷ TOWN_FIX 2.0 (worker-rave)
//   one player, one day    = +24 against −14.4 of decay, so about +9.6
//   42 (the set point) → 85 (Thriving) ≈ four or five days alone, far less with company
//
// The BAND still decides how the town LOOKS, and the look is where bleakness lives: Abandoned
// hands over every dark lamp and all three shut fronts on top of these six, so it is nearer
// sixteen. A Thriving town simply stops being broken — its six are upkeep, not repair, and
// because litter and crows are a player's OWN problems and never the shared look (see LOOK
// above), the square still reads pristine to everyone walking through it.
export const PROBLEM_OPEN = 6;
export const WAVES = 4;

// ⚠️ `shut` is THE TOWN'S LOCK and it is capped: three shopfronts at Abandoned, one at Struggling,
// none from the band above that (the day's `closed` event may still shut one more, and that one is
// always fixable) — a stranger must always find open doors. The store's shutter matches the
// shelf it already has (stock.js: nothing at Abandoned, the basics from Struggling up), so the front
// finally SHOWS what the data has always said. A player's own locks are a different look entirely
// (docs/town-jobs-plan.md §1: the shutter is the town's, the key is yours).
// the sky: the town's own twelve-minute day dims at evening and night so the lamps and
// the windows mean something; a Curse Night is darker than any night
// ⚠️ a deep night also brings the storm, whose own scrim (weather.css, 0.40) stacks on this one:
// 0.62 here read as a black screen (14 Sep). Dark enough to change the town, light enough to see it.
export const NIGHT = { evening: 0.2, night: 0.5, hush: 0.3, curse: 0.5 };   // a hush is cosmetic: dusk, not midnight; each a step darker 15 Sep (Trym)

// where visitors stand about (feet, world px), facing into the square
export const VISITOR_SPOTS = [[1010, 905], [1190, 905], [900, 1000], [1310, 1000], [1600, 1200]];

// 🌑 THE MORNING AFTER A CURSE NIGHT (21 Sep 2026).
//
// Trym: *"a cursed night wreaks too little havoc, towns been on over 90% all day, its been boring,
// and the ghosts and cursed nights dont feel impactful on the town health at all, streetlights been
// fine all day"*. He is right, and the arithmetic says exactly why:
//
//   · the bands above 65 have an IDENTICAL look. lively and thriving are both 0 lamps out, 0 litter,
//     0 full bins, 0 crows — they differ in `visitors` and nothing else.
//   · the hardest night in the game is a `deep`, which takes the meter down 18. From a town sitting
//     at 100 that is 82, which is still lively.
//   · so a deep Curse Night on a healthy town changes the number of wandering visitors and NOTHING
//     ELSE. No dark streetlight, no litter, no tipped bin. There was nothing to see and nothing to do.
//
// ⭐ SO THE NIGHT LEAVES ITS OWN MARK, on top of whatever the band says. It is not a band change and
// it is not a second meter: it is damage, it is shared (everyone sees the same square, because it
// hangs off the clock's own curse time), and — the part that matters — every dark lamp and every
// tipped bin is ALREADY one of your problems, so the morning after a curse night is a square with
// work in it even when the meter is at 100. That is the other half of his sentence: a thriving town
// with nothing to do is the boring one.
//
// ⚠️ `hush` LEAVES NOTHING. It is the gentle tier, it costs the meter nothing, and a night that is
// only atmosphere should stay only atmosphere.
export const NIGHT_AFTER = {
  hush: null,
  creep: { lampsOut: 2, lampsFlicker: 1, litter: 1, bins: 1, dumps: 0, crows: 1 },
  deep: { lampsOut: 4, lampsFlicker: 2, litter: 2, bins: 2, dumps: 1, crows: 2 },
};
// how long the square wears it. The curse window is 18:00–23:30 UTC, so twelve hours is "until the
// morning after" for a night at either end of it.
// ⚠️ a fix is gated on the UTC day (town-room fixed()), so a lamp relit before midnight comes back
// dark at midnight and needs relighting once more. That is the same rule every other problem in the
// square follows, and the night is not special enough to earn its own clock.
export const NIGHT_AFTER_MS = 12 * 3600000;
