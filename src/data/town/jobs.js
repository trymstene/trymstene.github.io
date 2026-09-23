// 💼 THE JOBS — what a week of work is, and what it pays (22 Sep 2026; docs/town-jobs-plan.md §12).
//
// ⚠️ ONE SOURCE, TWO READERS. worker-pass imports this to pay the cheque and to answer the duties
// chip; the town imports it to draw the chip and to know which chores exist. Pure data and pure
// functions, no DOM — the pass-defs precedent. Change a number here and both sides change together.
//
// Trym, 22 Sep: "it should probably have some variance in pay depending of how often the user has
// swept floors and fixed broken machines … as long as the user gets the reasoning in the payslip why
// the pay is lower this time if they havent done much. after a while they should get fired if they fail
// to do anything in a week or something … Arcade: Swept floor 0/3, fixed Arcade machine 0/3".
//
// So a payslip job has THE WEEK'S WORK: a short list of duties, each with a target for the week. The
// cheque is the full rate scaled by the share of the targets met — nothing done, nothing paid, and the
// payslip prints the counts so the reasoning is on the paper. `days` is a duty the worker counts by
// itself (days you turned up); every other kind is a chore the town reports as it is done.

// 🪜 THE LADDER (23 Sep 2026; the plan https://claude.ai/artifact/BN3XdtMec5Q4BkvVh7FBht). Trym, 22 Sep: "you can level
// up and get promoted in all workplaces — some more than others … lemonade stand is the 'lowest' jobtype, then coffee
// shop, then arcade, then general store, and then post office". His four calls, 23 Sep: ANY boss hires (no gate) ·
// ranks 3·4·5·5·6 · ONE PAY SCALE · promotion AT THE BOSS.
//   `at`   the work XP each rank begins at (rank 1 at 0); the server counts the XP, the boss tells you the rank
//   `day`  the most work XP one day at that workplace can earn, so a little every day beats a grind
//   `week` what "a full week" is worth at rank 1 — every duty met, or a full tips cap on five days — and it rises
//          RISE a rank. The payslip jobs pay it as their cheque; the tips jobs' daily cap is a fifth of it.
export const LADDER = {
  stand: { at: [0, 200, 600], day: 60, week: 60 },
  cafe: { at: [0, 250, 750, 1500], day: 80, week: 90 },
  condo: { at: [0, 300, 900, 1800, 3000], day: 100, week: 120 },
  store: { at: [0, 300, 900, 1800, 3000], day: 100, week: 150 },
  post: { at: [0, 350, 1000, 2000, 3400, 5200], day: 120, week: 180 },
};
export const RISE = 1.2;        // each rank pays a fifth more than the one below it
export const TIPS_JOBS = ['cafe', 'stand'];   // paid a glass at a time, never by cheque
export const TIPS_DAYS = 5;     // a full tips cap on five days is a full week
export const DAY_XP = 10;       // turning up, once a day, at every workplace
// 🔓 THE DAY'S CAP RISES WITH THE RANK (23 Sep 2026). `day` is exactly a full day of a workplace's duties, so every unlock that
// earns work XP (the café's rush, a delivery, a lamp) was swallowed by the cap on any day the duties were done. A rank's day
// holds a sixth-or-so more for each rank climbed — room for the new things to do, and a little faster the higher you are.
export const CAP_RISE = 0.15;
export const dayCap = (at, rank) => Math.round(((LADDER[at] || {}).day || 0) * (1 + CAP_RISE * (Math.max(1, rank | 0) - 1)));
// the work XP a verb earns: an array is by the grade (wrong · fine · perfect) of a cup or a repair; a number is the most it
// can earn, and a chore that reports a `g` earns that much of it (a round of sorting reports its points: roundXp below).
// A verb reported with no grade at all earns its top: an older page that knew no grades is not docked for it.
export const XP = {
  stand: { cup: [0, 2, 4] },
  cafe: { cup: [0, 3, 6], rush: 15 },   // ☕ a rush served to the last customer (rank 2): a bonus on top of its cups
  condo: { sweep: 45, fix: [0, 30, 45], lamp: 20, litter: 10, ghost: 20 },   // the day's piece of litter and a cabinet woken fill the arcade's day; 🔧 a repair by its grade; 🕹 a lamp on the square (rank 3)
  store: { restock: 30, serve: [0, 10, 15], basket: [0, 15, 22], deliver: 30 },   // the delivery's two faces and 🛒 the day's two customers, by how quickly they were served, fill the store's; 🧺 a two-thing order (rank 2) is worth half again
  post: { sort: 60, letter: 15, bag: 30, reg: 15 },   // 🔴 registered post on time (rank 4): each sealed card's five again, outside the round's sixty   // two good rounds fill the post office's; ✉️ a letter of the round (rank 5), the morning's mail bag (rank 6)
};

// 🔓 THE UNLOCKS (23 Sep 2026; the ladder's slice 3 — Trym: "yes build it all"). Every rank from the second gives a new
// thing to DO, not only a bigger number: the rank it arrives at, per workplace. The town reads these to decide what a
// shift offers; the words for each live in town-staff.json `unlock`, told on the staff card and at the promotion.
export const UNLOCKS = {
  stand: { big: 2, jug: 3 },      // 🍋 big glasses: a longer squeeze, twice the tip; the jug, filled in a quiet moment
  cafe: { rush: 2, special: 3, keys: 4 },      // ☕ a rush: customers without a break, and a bonus for serving every one; special orders with syrup
  condo: { streak: 2, lamps: 3, litter: 4, ghosts: 5 },   // 🕹 a perfect repair lights its cabinet for the day, and perfect repairs in a row are counted; the square's lamps are yours too
  store: { basket: 2, deliver: 3, second: 4, keys: 5 },   // 🧺 some customers want two things; 📦 a parcel carried to a resident's door
  post: { fifth: 2, parcel: 3, registered: 4, round: 5, bus: 6 },     // ✉️ the town's own postmark, and a faster pile; 📦 parcels, weighed on the scale
};
export const unlocked = (at, key, rank) => { const r = (UNLOCKS[at] || {})[key]; return r != null && (rank | 0) >= r; };
export const unlocksAt = (at, rank) => Object.keys(UNLOCKS[at] || {}).filter((k) => UNLOCKS[at][k] === (rank | 0));
// 📜 THE LADDER'S TOP (24 Sep 2026; the plan's slice 4). The workplaces are rungs themselves, lowest first (Trym, 22 Sep: "lemonade
// stand is the 'lowest' jobtype, then coffee shop, then arcade, then general store, and then post office"). Reach the top rank
// at one and its boss's REFERENCE starts you at the second rank of the next one up; and each boss gives a MEMENTO for your
// homestead from the pack's own art (Trym's decision 5, the plan's recommendation: mementos first).
export const RUNGS = ['stand', 'cafe', 'condo', 'store', 'post'];
export const refFrom = (at) => { const i = RUNGS.indexOf(at); return i > 0 ? RUNGS[i - 1] : ''; };
export const refTo = (at) => { const i = RUNGS.indexOf(at); return i >= 0 && i < RUNGS.length - 1 ? RUNGS[i + 1] : ''; };
export const MEMENTO = { stand: 'crate', cafe: 'coffeemk', condo: 'arcade', store: 'displaycab', post: 'gclock' };   // src/data/decor.js ids
// a chore that counts on the week's sheet as another duty's: a basket is a customer served
export const COUNTS_AS = { basket: 'serve', lamp: 'fix', litter: 'sweep', ghost: 'fix' };   // 👻 …and a ghost caught at night (the arcade's rank 5)   // …and a lamp on the square is one of the arcade's repairs
export const roundXp = (right, late) => Math.min(XP.post.sort, (right | 0) * 5 + (late | 0) * 2);

export const JOB_PAY = { store: 150, condo: 120, post: 180, cafe: 0, stand: 0 };   // the cheque for a full week at rank 1 (LADDER.week); the café and the stand pay tips per glass instead
export const PAY_BACK = 2;                                  // whole weeks a cheque may walk back

// the week's work, per payslip job: [kind, target]. A job with no entry pays by tips (the café).
export const DUTIES = {
  condo: [['sweep', 3], ['fix', 3]],      // the arcade: litter on the floor, a cabinet gone dark
  store: [['restock', 3], ['serve', 3]],  // the general store: crates to the shelf, and 🛒 customers served at the till (23 Sep 2026: it was 'days', being there)
  post: [['sort', 3], ['days', 3]],       // the post office: rounds of sorting at the counter, and being there (22 Sep 2026)
};
export const NUDGE_DAY = 3;    // Thursday (Monday = 0): nothing done by then, and the boss writes
export const FIRE_WEEKS = 2;   // two finished weeks with nothing done, and the boss lets you go

export const dutiesOf = (at) => DUTIES[at] || [];
// the share of the week's targets met, 0–1: each duty counts up to its target, then no further
export function shareOf(at, done) {
  const d = dutiesOf(at);
  if (!d.length) return 0;
  let got = 0, of = 0;
  for (const [k, n] of d) { got += Math.min(n, ((done && done[k]) | 0)); of += n; }
  return of ? got / of : 0;
}
// ---- the ladder's arithmetic ----
export const ranksOf = (at) => (LADDER[at] ? LADDER[at].at.length : 0);
// the rank this much XP has EARNED (1 at 0). The rank you HOLD is the one your boss has told you: see worker-pass.
export function rankOf(at, xp) { let r = 0; for (const t of (LADDER[at] || {}).at || []) if ((xp || 0) >= t) r++; return r; }
// the XP a rank begins at, or null past the top
export const xpAt = (at, rank) => { const a = (LADDER[at] || {}).at || []; return rank >= 1 && rank <= a.length ? a[rank - 1] : null; };
// a full week at a rank; a tips job's cheque is still 0 — this is its yardstick
export const weekPay = (at, rank) => Math.round(((LADDER[at] || {}).week || 0) * Math.pow(RISE, Math.max(1, rank | 0) - 1));
// the most tips one banana takes home in a day at a rank — worker-pass RULES.town.tips refuses the rest
export const tipsCap = (at, rank) => (TIPS_JOBS.includes(at) ? Math.round(weekPay(at, rank) / TIPS_DAYS) : 0);
// the work XP one chore is worth, before the day's cap
export function xpFor(at, kind, g) {
  const v = (XP[at] || {})[kind];
  if (Array.isArray(v)) return (g == null ? v[v.length - 1] : v[Math.max(0, Math.min(v.length - 1, g | 0))]) | 0;
  if (typeof v !== 'number') return 0;
  return g == null ? v : Math.max(0, Math.min(v, Math.round(+g) || 0));
}

// ↕ THE WEEKLY REVIEW (23 Sep 2026). Trym: "you should also be able to be demoted, or fired … if you want to be great and
// stay great you must do a good job (and get more pay)" — and "if you get fired … you should loose your job, and have to
// start over". Every finished week at the job you hold is reviewed once, on the server:
//   full   the week's work all done (a payslip job) or three good days at the counter (a tips job): a day's XP extra
//   poor   under half the week's work, or more than half the cups spoiled: a day's XP taken back — and if that leaves you
//          under your rank's line, the boss warns you; the next poor week there costs one rank (never below the first)
//   empty  nothing done at all, or never came: two in a row and you are let go, and that workplace starts over from nothing
// Time without a job costs nothing, and quitting keeps your standing: only the job you hold is reviewed.
export function reviewOf(at, d) {
  if (DUTIES[at]) { const s = shareOf(at, d); return s >= 1 ? 'full' : s === 0 ? 'empty' : s < 0.5 ? 'poor' : 'ok'; }
  const c = (d && d.cups) || [], n = (c[0] | 0) + (c[1] | 0) + (c[2] | 0), days = (d && d.days) | 0;
  if (!days && !n) return 'empty';
  if (n >= 6 && (c[0] | 0) * 2 > n) return 'poor';
  if (days >= 3 && n >= 10 && (c[0] | 0) * 5 <= n) return 'full';
  return 'ok';
}
// the XP a review moves, in the workplace's own day's worth
export const reviewXp = (at, v) => (v === 'full' ? 1 : v === 'poor' ? -1 : 0) * ((LADDER[at] || {}).day || 0);

// what a week of that work pays: the rank's full week, scaled — and rounded once, so the slip's total is the ledger's
export const payOf = (at, done, rank) => (JOB_PAY[at] ? Math.round(weekPay(at, rank) * shareOf(at, done)) : 0);
// the rows a chip or a payslip prints: kind · done · of
export const rowsOf = (at, done) => dutiesOf(at).map(([k, n]) => ({ kind: k, done: Math.min(n, ((done && done[k]) | 0)), of: n }));
