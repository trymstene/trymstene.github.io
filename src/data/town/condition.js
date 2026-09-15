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
  // (rubbish piles and graffiti are not a shared look: they come only as a player's own
  //  problems, src/data/town/problems.js, so what you can fix is what you see)
  abandoned:  { lampsOut: 5, lampsFlicker: 2, windowsDark: 0.8, shut: ['cafe', 'info'], litter: 2,
                bins: 3, dumps: 2, fountain: 'dry', outside: 0.4, crows: 3, visitors: 0, decor: 0, dayghost: 1 },
  struggling: { lampsOut: 3, lampsFlicker: 2, windowsDark: 0.5, shut: ['cafe'], litter: 1,
                bins: 2, dumps: 1, fountain: 'on', outside: 0.7, crows: 2, visitors: 0, decor: 0, dayghost: 0 },
  recovering: { lampsOut: 1, lampsFlicker: 1, windowsDark: 0.2, shut: [], litter: 1,
                bins: 1, dumps: 1, fountain: 'on', outside: 0.9, crows: 1, visitors: 0, decor: 0, dayghost: 0 },
  lively:     { lampsOut: 0, lampsFlicker: 0, windowsDark: 0, shut: [], litter: 0,
                bins: 0, dumps: 0, fountain: 'on', outside: 1, crows: 0, visitors: 1, decor: 1, dayghost: 0 },
  thriving:   { lampsOut: 0, lampsFlicker: 0, windowsDark: 0, shut: [], litter: 0,
                bins: 0, dumps: 0, fountain: 'on', outside: 1, crows: 0, visitors: 3, decor: 2, dayghost: 0 },
};

// how many things are wrong for ONE player today, by band. Never zero: a town with
// nothing to do is a picture (docs/town-life-plan.md §3)
export const PROBLEM_COUNT = { abandoned: 9, struggling: 7, recovering: 5, lively: 3, thriving: 2 };

// the sky: the town's own twelve-minute day dims at evening and night so the lamps and
// the windows mean something; a Curse Night is darker than any night
// ⚠️ a deep night also brings the storm, whose own scrim (weather.css, 0.40) stacks on this one:
// 0.62 here read as a black screen (14 Sep). Dark enough to change the town, light enough to see it.
export const NIGHT = { evening: 0.16, night: 0.4, hush: 0.26, curse: 0.45 };   // a hush is cosmetic: dusk, not midnight

// where the décor hangs (world px, the base of a lantern): the two stalls first, then
// the terrace and the gardens as the town climbs
export const DECOR_SPOTS = [
  [[742, 700], [858, 700], [1342, 700], [1458, 700]],                       // lively: the stalls
  [[1670, 1170], [1870, 1170], [1730, 700], [500, 700]],                    // thriving: the terrace and the gardens
];
// where visitors stand about (feet, world px), facing into the square
export const VISITOR_SPOTS = [[1010, 905], [1190, 905], [900, 1000], [1310, 1000], [1600, 1200]];
