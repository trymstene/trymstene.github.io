// 🕰 A WORKER TEST RUNS AT A FIXED MOMENT, NOT AT THE MOMENT IT HAPPENS TO RUN (27 Sep 2026).
//
// A test that reads the wall clock in two places ("today" in the test, "today" in the worker, or "this week") disagrees
// with itself when a run crosses UTC midnight, or a Monday, in between. A sweep that ran every worker test with the clock
// faked to each 50 ms of the last second before a Monday found five files that fail that way: citizen, qa-door, rollup,
// rules-areas and rules. The window is a fraction of a second a day, so CI would hit it only very rarely, but it is still
// the real clock deciding a verdict.
//
// Import this FIRST (before the worker, whose code must see the same clock): the process's clock then starts at noon
// UTC on a Wednesday and runs on in real time. Date.now() and new Date() both move, so anything that waits still waits,
// and no run shorter than half a day can cross a day or a week. A test that pins Date.now itself still does, on top.
// Not a test file (no .test.mjs): tools/run-worker-tests.mjs never runs it on its own.
export const ANCHOR = Date.UTC(2026, 8, 30, 12, 0, 0);   // Wednesday 30 Sep 2026, 12:00 UTC
const RealDate = Date;
const offset = ANCHOR - RealDate.now();
class AnchoredDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + offset); }
  static now() { return RealDate.now() + offset; }
}
globalThis.Date = AnchoredDate;
