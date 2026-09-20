// 🕯 RETURN TO SENDER — CHAPTER TWO: THE FOUR SIGNATURES (docs/town-jobs-plan.md §2).
//
// ⭐ MECHANICS ONLY, AND NOT ONE LINE OF PROSE. The plan asks for exactly this: "a copy key per
// step and not one line of prose". Chapter 1's dialogue is written into src/lib/world-quest.js,
// which predates the rule that GPT writes every player-facing word (CLAUDE.md, 12 Sep) — this
// file is what that rule looks like applied. `say` is a key into src/data/copy/town-quest.json,
// and there is nothing here a player could read.
//
// ⭐ THE SHAPE, FROM THE PLAN: "Each building is two steps: find the fault in the paper, then get
// it signed." Four buildings, eight steps, plus the one that starts it and the one that ends it.
// Four round trips across a square you are learning — which is why it is a chapter and not a list.
//
// ⭐ IT DOES NOT SIT BEHIND CHAPTER ONE, AND THAT IS A MEASUREMENT, NOT A PREFERENCE.
// The plan's one BLOCKING question (§8 q1) was "how many players finish chapter 1?", with the
// note that the answer is in Pulse and the instruction to measure it before step 1. Measured
// 21 Sep 2026 from GA4, 1 Jun onward: 4400 people met the questline, 116 started it, 76 cleared
// at least one step, and 409 steps were cleared in total. Sixteen steps a finisher means at most
// 22 people have ever finished — half a percent of everybody who met it. The plan's own
// recommendation for a small number is "gate less behind the chapter", so chapter 2 stands on
// its own in the town and asks nothing of chapter 1. The fiction still joins them (the works
// order is signed by the hand that scratched a name out of Nib's book), but the lock does not.
//
// ⚠️ NOTHING HERE DRAWS A BANANA, and that is the town's rule rather than a shortcut. The town's
// nine residents WALK — a twelve-minute day, six beats, a station each — so a marker pinned to
// where Nib stands is a marker pinned to where Nib stood at boot, and a second Nib drawn by the
// quest beside the real one is a bug you can see from across the square. Every mark in this
// chapter hangs on a BUILDING, which does not move, and the two voices are `paper` (the works
// order nailed to the front) and `nib` (the counter inside the hall). Tapping the real Nib out in
// the square opens the same conversation — banana-town.js honours window.bwqTalk the way the
// park honours it for Old Peel — so the chapter never has to say where he is standing.

// ---- where the marks hang -------------------------------------------------
// x and y come out as % of the town's own 2200×1300 plate, the same units chapter 1 uses, so
// place() needs no special case. ⚠️ DERIVED FROM src/scripts/town-geo.js, not eyeballed: x is the
// front's drawn centre (OVERLAYS x + w/2) and the notice hangs 60 px above the base it stands on.
//   condo  ov-0  370 + 220/2 = 480     hall  ov-1  963 + 275/2 = 1100
//   post   ov-2  1554 + 293/2 = 1700   store ov-4  389 + 183/2 = 480
//   cafe   ov-7  1751 + 158/2 = 1830
//
// ⚠️ AND A NOTICE NEEDS A DEPTH, WHICH IS NOT ITS OWN HEIGHT. Everything outdoors in this world
// sorts by z = 100 + y, so a mark hung at notice height (y 500) sorts BEHIND the very building it is
// nailed to (base 560) and the town hall paints straight over it — which is what happened the first
// time it was walked: the chip said where to go and there was nothing there when you got there.
// A thing ON a wall hangs at the wall's height and sorts at the wall's FOOT, the same +3 the
// hoarding's own signpost uses (town-room.js hoardings()).
const NORTH = 560, SOUTH = 1040;    // the two base lines the square's fronts stand on
const at = (x, base, up = 60) => ({
  x: +((x / 2200) * 100).toFixed(2),
  y: +(((base - up) / 1300) * 100).toFixed(2),
  z: 100 + base + 3,
});

export const HALL = at(1100, NORTH);

// ⚠️ THE KEYS AND THEIR ORDER ARE `SIGNATURES` FROM src/data/town/locks.js. That list is what the
// hoarding's signpost counts "the second of four" against, so the two cannot drift apart —
// tools/check-quest-c2.mjs holds them together rather than trusting this comment.
export const FRONTS = [
  { key: 'store', at: at(480, SOUTH) },    // the general store, west side of the square
  { key: 'condo', at: at(480, NORTH) },    // the arcade — a signature to collect, never boarded
  { key: 'post', at: at(1700, NORTH) },    // the post office, north-east
  { key: 'cafe', at: at(1830, SOUTH) },    // the Coffee Cup, south-east
];

/**
 * The chapter, as steps. Every field is a mechanic or a key — never a word:
 *   id     — the step's name, and the receipt the wage is paid against (qpay_<id>)
 *   kind   — 'talk' throughout: a mark you tap, and a sheet that opens
 *   who    — 'paper' (the works order on the front) or 'nib' (the counter inside the hall)
 *   at     — where the mark hangs, in % of the town plate
 *   say    — THE COPY KEY. src/data/copy/town-quest.json carries the chip line and the sheet.
 *   turnin — the ? glyph instead of the !: you are bringing something back
 *   opens  — the front this step unlocks, pushed into bwq-c2.open, which town-room.js already
 *            reads (openedSet → hoardNow): the lock half shipped on 19 Sep and has been waiting
 *   pay    — bananacoins, receipted once per player in the pass, never once per device
 */
export const STEPS = [
  { id: 'c2_open', kind: 'talk', who: 'nib', at: HALL, say: 'open' },
  ...FRONTS.flatMap((f) => [
    { id: 'c2_' + f.key + '_fault', kind: 'talk', who: 'paper', at: f.at, say: f.key + '_fault' },
    { id: 'c2_' + f.key + '_sign', kind: 'talk', who: 'nib', at: HALL, turnin: 1,
      say: f.key + '_sign', opens: f.key, pay: 15 },
  ]),
  // the certificate. ⚠️ THE PLAN PINS IT ON THE SQUARE REPORT and that board is gone — Trym had
  // the notice board taken out of the square on 20 Sep ("the Square Report sign is a bit
  // unnecessary now that we have the Town Health Meter popup") and its tallies moved under the
  // meter. So it is filed at the counter instead, which is also truer to the plan's own rule that
  // the certificate is worded as YOUR paperwork and never as town news — the meter's card is the
  // one surface in the town whose numbers are genuinely shared.
  { id: 'c2_done', kind: 'talk', who: 'nib', at: HALL, turnin: 1, say: 'done', pay: 40 },
];
