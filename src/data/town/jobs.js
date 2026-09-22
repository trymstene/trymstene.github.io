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

export const JOB_PAY = { store: 90, condo: 60, post: 75, cafe: 0, stand: 0 };   // the café and the lemonade stand pay tips per glass instead of a cheque; the post office's 75 sits between the two (Trym's to move)
export const PAY_BACK = 2;                                  // whole weeks a cheque may walk back

// the week's work, per payslip job: [kind, target]. A job with no entry pays by tips (the café).
export const DUTIES = {
  condo: [['sweep', 3], ['fix', 3]],      // the arcade: litter on the floor, a cabinet gone dark
  store: [['restock', 3], ['days', 3]],   // the general store: crates to the till, and being there
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
// what a week of that work pays: the rate, scaled — and rounded once, so the slip's total is the ledger's
export const payOf = (at, done) => Math.round((JOB_PAY[at] || 0) * shareOf(at, done));
// the rows a chip or a payslip prints: kind · done · of
export const rowsOf = (at, done) => dutiesOf(at).map(([k, n]) => ({ kind: k, done: Math.min(n, ((done && done[k]) | 0)), of: n }));
