// 🚧 THE PLAYER'S OWN LOCK — a building the story has not opened for you yet (19 Sep 2026).
//
// ⭐ THE TOWN HAS TWO LOCKS AND THEY MUST NEVER BE CONFUSED (docs/town-jobs-plan.md §1).
//   · THE TOWN'S lock is the shared meter speaking: the yellow-black hazard belt, the dark front,
//     the red CLOSED sign. The square is having a bad day; hands fix it; it is nobody's fault.
//   · YOUR lock is this one: a red worksite fence and a signpost to tap. The building is not built
//     for you yet, and the STORY opens it. Nothing here borrows a colour or a shape from the tape,
//     so a player never has to read a card to tell which one they are looking at.
//
// ⭐ PRECEDENCE: YOUR LOCK WINS THE DISPLAY. A front can be both hoarded and health-shut at once.
// If you have not unlocked the store, the town's mood there is irrelevant to you — you could not
// use it either way — and the useful thing to tell you is how to open it. Once it is yours, the
// front joins the shared weather like every other shop. One building, one state, always the one
// whose action is available to you now.
//
// ⚠️ SHIPPED OFF, AND BOTH CONDITIONS ARE NOW ANSWERED — one yes and one no.
//   1. ✅ chapter 2 exists to open these fronts (src/data/quest-c2.js, 21 Sep).
//   2. ❌ the number was read on 21 Sep and it is small: of 4 400 people who met the questline,
//      116 started it and 76 cleared a step, 409 steps between them — at most 22 finishers ever.
// So the plan's answer for a small number holds (§8 q1: "gate less behind the chapter"), and
// chapter 2 gates nothing: it is town-only and asks nothing of chapter 1. Turning THIS on is a
// separate decision, because it boards up the store, the post office and the café for everyone who
// has not played chapter 2 either — which is still very nearly everybody.
// The whole system is built and walked; this line is the switch, and it is Trym's, by name.
// tools/check-quest-c2.mjs goes red if it changes, so it cannot drift on by accident.
export const HOARD_ON = false;

// the order chapter 2 opens them, which is what "the second of four signatures" counts.
// ⚠️ `condo` IS IN THIS LIST AND NOT IN THE NEXT ONE, on purpose: the arcade has a signature to
// collect but is NEVER boarded — five shipped games must answer on a stranger's worst day.
export const SIGNATURES = ['store', 'condo', 'post', 'cafe'];

// the fronts a hoarding can stand in front of. ⚠️ `condo` must never appear here and neither may
// anything whose absence would strand a player; tools/check-design.mjs greps for it rather than
// trusting this comment. The art is baked per front at its exact drawn width by
// tools/build-town-scene.py (HOARD in town-geo.js).
export const HOARDABLE = ['store', 'post', 'cafe'];

// where the signpost stands beside each hoarding: dx from the front's centre, and its foot.
// Measured so it clears the fence and does not sit on a door or a lamp.
export const SIGN_AT = { store: [104, 6], post: [158, 6], cafe: [92, 6] };
