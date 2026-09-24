// 📟 THE CALLS — when the town calls its on-call staff (23 Sep 2026; the staff card plan, slice 0b:
// https://claude.ai/artifact/Ub4HFW4zdQcDiCGrUZNJxH).
//
// Trym, 23 Sep: "the other type of job you can roam around in the world until you get a notification-job-quest that
// you need to clean up". So the arcade's litter and dark cabinet and the store's delivery no longer simply wait from
// midnight: each ARRIVES a few minutes into the worker's first visit of the day, and then stays open until midnight
// (UTC, the town's day). Which days carry which call is seeded per person per week and sized to the week's work
// (src/data/town/jobs.js DUTIES): litter and a delivery six days in seven, a dark cabinet five. The delays are short on
// purpose — a call that comes after the visit has ended is a call nobody feels arrive.
//
// ⚠️ THE DAY'S CLOCK IS THIS DEVICE'S (tw-calls-v1): it starts the first time any area of Banana World asks, with the job
// held. ⚠️ THE ANSWERS ARE THE ROOMS' OWN RECORDS (tw-arcade-v1, tw-restock-v1), read here exactly as town-room.js
// writes them (arcRead, restocked); tests/town-calls.spec.mjs proves the two agree.
import { unlocked } from '../data/town/jobs.js';
export const ONCALL_JOBS = { condo: ['sweep', 'fix'], store: ['restock', 'serve', 'deliver'] };   // 📦 deliver: a parcel to a resident's door (rank 3)   // 🛒 serve: customers at the till (23 Sep 2026)
const WEEKLY = { sweep: 6, fix: 5, restock: 6, serve: 5, deliver: 3 };                    // days in a week that carry the call
const DELAY = { sweep: [1, 4], fix: [3, 8], restock: [1, 5], serve: [2, 6], deliver: [3, 8] };      // minutes after the day's first visit
export const NEEDS = { sweep: 1, fix: 1, restock: 2, serve: 2, deliver: 1 };              // what answers it: the day's one piece of litter (23 Sep 2026: litter through the week), one cabinet, STAFF_FACES

const RANKED = { deliver: 'deliver' };   // the call kind → the unlock that brings it (jobs.js UNLOCKS)
export const dayOf = (t) => Math.floor(t / 86400000);
const get = (fn) => { try { return JSON.parse(fn() || 'null'); } catch (e) { return null; } };   // every key a literal at its read (the storage gate)
const mix = (x) => { x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); return (x ^ (x >>> 16)) >>> 0; };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// 🧪 a walk may pin the day's kinds (tw-calls-v1 `qa`), and only a walk: the flag is honoured under ?towntest alone
const QA = () => { try { return /[?&]towntest/.test(location.search); } catch (e) { return false; } };

export const jobAt = () => { const j = get(() => localStorage.getItem('tw-job-v1')); return (j && j.at) || ''; };
const who = () => { const l = get(() => localStorage.getItem('pass-link')); return (l && l.credId) || ''; };

// the day's calls on this person at this workplace, as [{ kind, after }]: `after` is ms from the day's first visit.
// Monday-based weeks (day 4 of the epoch was a Monday), the same weeks the payslip counts.
export function schedule(at, day, id) {
  const base = hash(String(id || '')), week = Math.floor((day + 3) / 7), dow = (day + 3) % 7;
  return (ONCALL_JOBS[at] || []).flatMap((kind, ki) => {
    const order = [0, 1, 2, 3, 4, 5, 6].map((d) => [mix(base ^ mix(week * 7919 + d * 131 + ki * 17 + 1)), d]).sort((a, b) => a[0] - b[0]);
    if (!order.slice(0, WEEKLY[kind]).some((x) => x[1] === dow)) return [];
    const [lo, hi] = DELAY[kind], r = mix(base ^ mix(day * 31 + ki * 7 + 3)) / 4294967296;
    return [{ kind, after: Math.round((lo + (hi - lo) * r) * 60000) }];
  });
}
// when this device's day began for the calls — started now if it has not
function dayStart(now) {
  const c = get(() => localStorage.getItem('tw-calls-v1')), d = dayOf(now);
  if (c && c.d === d && c.t0) return c;
  const fresh = { d, t0: now };
  try { localStorage.setItem('tw-calls-v1', JSON.stringify(fresh)); } catch (e) {}
  return fresh;
}
// how much of a call is answered today, from the room's own record of it
function got(kind, day) {
  if (kind === 'restock') { const r = get(() => localStorage.getItem('tw-restock-v1')); return r && r.d === day ? r.n | 0 : 0; }
  if (kind === 'deliver') { const r = get(() => localStorage.getItem('tw-deliver-v1')); return r && r.d === day && (r.n | 0) >= Math.max(1, r.of | 0) ? 1 : 0; }   // answered once EVERY parcel of the day is at its door
  if (kind === 'serve') { const r = get(() => localStorage.getItem('tw-serve-v1')); return r && r.d === day ? r.n | 0 : 0; }
  const a = get(() => localStorage.getItem('tw-arcade-v1'));
  if (!a || a.d !== day) return 0;
  return ((kind === 'sweep' ? a.swept : a.fixed) || []).length;
}
// 🧑‍🔧 THE FIRST DAY HAS ITS WORK WAITING (24 Sep 2026, the live job journey). A new hire is told "Inside Pip's store: fill
// shelves from the crates, serve customers at the till" — and the calls came one to eight minutes after the day's first
// visit, or not at all on the week's quiet days, so the new hire walked in and found NOTHING to do. On the day you are hired
// at an on-call workplace (hired() below, written by the take), every call its rank brings is in from the moment of the hire.
export function hired(at, now = Date.now()) {
  try { localStorage.setItem('tw-calls-v1', JSON.stringify({ d: dayOf(now), t0: now, h: at })); } catch (e) {}
}
// every call today at `at`, with where it stands: arrived, answered (done), open (arrived and not done), and how much is left
export function calls(at, now = Date.now()) {
  if (!ONCALL_JOBS[at]) return [];
  const day = dayOf(now), c = dayStart(now);
  const plan = QA() && Array.isArray(c.qa) ? c.qa.map((k) => ({ kind: k, after: 0 }))
    : c.h === at ? ONCALL_JOBS[at].map((k) => ({ kind: k, after: 0 }))   // the hire day: all of it, at once
      : schedule(at, day, who());
  // 🔓 a call a rank brings comes only once the rank is held (the store's parcel, rank 3) — a walk's own pin excepted
  const rk = Math.max(1, (((get(() => localStorage.getItem('tw-job-v1')) || {}).lad || {}).rank) | 0);
  return plan.filter((p) => NEEDS[p.kind] && (QA() && Array.isArray(c.qa) || !RANKED[p.kind] || unlocked(at, RANKED[p.kind], rk))).map((p) => {
    const left = Math.max(0, NEEDS[p.kind] - got(p.kind, day)), arrived = now >= c.t0 + p.after;
    return { kind: p.kind, at: c.t0 + p.after, arrived, done: left === 0, open: arrived && left > 0, left };
  });
}
// has today's call of this kind come in? (the rooms draw its work only once it has)
export const arrived = (at, kind, now) => calls(at, now).some((c) => c.kind === kind && c.arrived);
