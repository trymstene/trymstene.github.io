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
// ⚠️ SHIPPED OFF. HOARD_ON is false and stays false until BOTH of these are true:
//   1. chapter 2 exists to open these fronts (docs/town-jobs-plan.md §2), and
//   2. somebody has read how many players finish chapter 1 (§8, question 1, still unanswered).
// Flipping it before then boards up the store, the post office and the café for every player who
// never finished chapter 1 — which is the one outcome the plan says out loud it must not cause.
// The whole system is built and walked; this line is the switch, and it is Trym's.
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
