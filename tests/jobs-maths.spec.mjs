// 💼 THE WEEK'S WORK, AS ARITHMETIC (22 Sep 2026; docs/town-jobs-plan.md §12). The one source both the pass
// worker and the town read: a cheque is the rate scaled by the share of the week's targets met, each
// duty counting up to its target and no further, and a job with no duties (the café) pays no cheque.
// Trym: "some variance in pay depending of how often the user has swept floors and fixed broken machines
// … the user gets the reasoning in the payslip why the pay is lower this time".
import { test, expect } from '@playwright/test';
import STAFF from '../src/data/copy/town-staff.json' with { type: 'json' };
import { LADDER_RANKS } from '../tools/copy-jobs.mjs';
import { JOB_PAY, DUTIES, NUDGE_DAY, FIRE_WEEKS, shareOf, payOf, rowsOf, dutiesOf, LADDER, RISE, TIPS_JOBS, DAY_XP, ranksOf, rankOf, xpAt, weekPay, tipsCap, xpFor, roundXp, reviewOf, reviewXp, UNLOCKS, unlocked, unlocksAt, COUNTS_AS, dayCap } from '../src/data/town/jobs.js';

test('a week of work pays by its share, duty by duty, and prints its own reasoning', () => {
  // the arcade: two duties of three
  expect(dutiesOf('condo').map((d) => d[0]), 'the arcade has a floor to sweep and machines to wake').toEqual(['sweep', 'fix']);
  expect(payOf('condo', {}), 'nothing done, nothing paid').toBe(0);
  expect(payOf('condo', { sweep: 3, fix: 3 }), 'the week’s work done, the full rate').toBe(JOB_PAY.condo);
  expect(payOf('condo', { sweep: 30, fix: 30 }), '…and no more than the full rate, however hard you sweep').toBe(JOB_PAY.condo);
  expect(shareOf('condo', { sweep: 2, fix: 1 }), 'three of six things is half').toBeCloseTo(0.5, 6);
  expect(payOf('condo', { sweep: 2, fix: 1 }), '…which is half the rate').toBe(Math.round(JOB_PAY.condo / 2));
  expect(rowsOf('condo', { sweep: 5, fix: 1 }), 'the rows a chip or a payslip prints, capped at the target').toEqual([{ kind: 'sweep', done: 3, of: 3 }, { kind: 'fix', done: 1, of: 3 }]);
  // the store: restocking, and being there
  expect(dutiesOf('store').map((d) => d[0]), '🛒 the store counts crates and customers (it was days turned up until 23 Sep 2026)').toEqual(['restock', 'serve']);
  expect(payOf('store', { restock: 3, serve: 3 }), 'a full week at the store').toBe(JOB_PAY.store);
  expect(payOf('store', { restock: 0, serve: 3 }), 'only the customers is half the store’s week').toBe(Math.round(JOB_PAY.store / 2));
  expect(payOf('store', { days: 5 }), 'and turning up alone is nothing there now').toBe(0);
  // the post office: rounds of sorting at the counter, and being there (22 Sep 2026)
  expect(dutiesOf('post').map((d) => d[0]), 'the post office counts rounds and days').toEqual(['sort', 'days']);
  expect(payOf('post', { sort: 3, days: 3 }), 'a full week at the post office').toBe(JOB_PAY.post);
  expect(payOf('post', { sort: 1, days: 0 }), 'one round of six things is a sixth').toBe(Math.round(JOB_PAY.post / 6));
  // 🪜 one pay scale (Trym, 23 Sep 2026): the rungs pay in the ladder's order, the post office at the top
  expect(JOB_PAY.condo).toBeLessThan(JOB_PAY.store);
  expect(JOB_PAY.store, 'the post office pays the most').toBeLessThan(JOB_PAY.post);
  // the café is tips: no duties, no cheque
  expect(dutiesOf('cafe'), 'the café has no week’s work to meet').toEqual([]);
  expect(payOf('cafe', { days: 7 }), 'and pays no cheque').toBe(0);
  // the rules the boss keeps
  expect(NUDGE_DAY, 'the boss writes from Thursday if nothing is done (Monday = 0)').toBe(3);
  expect(FIRE_WEEKS, 'two empty weeks and you are let go').toBe(2);
  for (const at of Object.keys(DUTIES)) expect(JOB_PAY[at], at + ' has a rate to scale').toBeGreaterThan(0);
});

// 🪜 THE LADDER (23 Sep 2026; Trym's four calls: any boss hires · ranks 3·4·5·5·6 · one pay scale · promotion at the boss)
test('the ladder: ranks by XP, one pay scale that rises a fifth a rank, and tips capped at a fifth of a week', () => {
  // the rungs, bottom to top, and how many ranks each has
  expect(Object.keys(LADDER), 'stand → café → arcade → store → post office').toEqual(['stand', 'cafe', 'condo', 'store', 'post']);
  expect(Object.keys(LADDER).map(ranksOf), '3 · 4 · 5 · 5 · 6').toEqual([3, 4, 5, 5, 6]);
  // the words have a title per rank, and the copy gate's mirror of the counts is the ladder's own (tools/copy-jobs.mjs LADDER_RANKS)
  for (const at of Object.keys(LADDER)) expect(STAFF.ranks[at].length, at + ': a title for every rank').toBe(ranksOf(at));
  expect(LADDER_RANKS, 'the copy gate counts the same ranks').toEqual(Object.fromEntries(Object.keys(LADDER).map((at) => [at, ranksOf(at)])));
  // "a full week" at rank 1 rises rung by rung: 60 · 90 · 120 · 150 · 180
  expect(Object.keys(LADDER).map((at) => weekPay(at, 1))).toEqual([60, 90, 120, 150, 180]);
  for (const at of Object.keys(LADDER)) {
    const a = LADDER[at].at;
    expect(a[0], at + ': rank 1 begins at nothing').toBe(0);
    for (let i = 1; i < a.length; i++) expect(a[i], at + ': every rank asks for more').toBeGreaterThan(a[i - 1]);
    // the first promotion arrives in three to five days of a full day's work, never on the first
    const days = a[1] / LADDER[at].day;
    expect(days, at + ': the first promotion takes a few days').toBeGreaterThanOrEqual(2.5);
    expect(days).toBeLessThanOrEqual(5);
    // the payslip jobs' cheque IS the full week at rank 1; the tips jobs pay no cheque
    expect(JOB_PAY[at], at + ': the cheque is the yardstick').toBe(TIPS_JOBS.includes(at) ? 0 : LADDER[at].week);
    // and each rank's week pays a fifth more
    for (let r = 2; r <= a.length; r++) expect(weekPay(at, r)).toBe(Math.round(LADDER[at].week * Math.pow(RISE, r - 1)));
  }
  // rankOf: the rank the XP has EARNED
  expect(rankOf('cafe', 0)).toBe(1);
  expect(rankOf('cafe', 249)).toBe(1);
  expect(rankOf('cafe', 250)).toBe(2);
  expect(rankOf('cafe', 99999), 'the top is the top').toBe(4);
  expect(xpAt('cafe', 2)).toBe(250);
  expect(xpAt('cafe', 5), 'nothing past the top').toBe(null);
  // the tips cap: a fifth of a full week a day — the stand drops from 120 to 12 (Trym accepted it by name)
  expect(tipsCap('stand', 1)).toBe(12);
  expect(tipsCap('cafe', 1)).toBe(18);
  expect(tipsCap('cafe', 2)).toBe(22);
  expect(tipsCap('store', 3), 'a payslip job has no tips').toBe(0);
  // a cheque scales with the rank
  expect(payOf('store', { restock: 3, serve: 3 }, 2), 'a full week at the store’s second rank').toBe(180);
  expect(payOf('store', { restock: 3, serve: 3 }), 'no rank given is the first').toBe(150);
  expect(payOf('cafe', { days: 7 }, 4), 'the café pays no cheque at any rank').toBe(0);
  // the XP a verb earns
  expect([0, 1, 2].map((g) => xpFor('stand', 'cup', g)), 'a glass by its grade').toEqual([0, 2, 4]);
  expect([0, 1, 2].map((g) => xpFor('cafe', 'cup', g)), 'a cup by its grade').toEqual([0, 3, 6]);
  expect(xpFor('cafe', 'cup', 9), 'a forged grade is a perfect cup').toBe(6);
  expect(xpFor('condo', 'sweep'), 'the day’s piece of litter (one a call day since 23 Sep 2026)').toBe(45);
  expect(xpFor('condo', 'fix'), 'a repair reported with no grade (an older page) earns its top').toBe(45);
  expect([0, 1, 2].map((g) => xpFor('condo', 'fix', g)), '🔧 a repair by its grade: spoiled, fine, perfect').toEqual([0, 30, 45]);
  expect(xpFor('store', 'restock')).toBe(30);
  expect([0, 1, 2].map((g) => xpFor('store', 'serve', g)), '🛒 a customer by how quickly: gave up, in time, quickly').toEqual([0, 10, 15]);
  expect(xpFor('post', 'sort', roundXp(12, 0)), 'a perfect round is the most a round earns').toBe(60);
  expect(xpFor('post', 'sort', roundXp(4, 3)), 'four fresh and three late').toBe(26);
  expect(xpFor('post', 'sort', 999), 'and no forged round earns more').toBe(60);
  expect(xpFor('store', 'sweep'), 'a verb another workplace owns earns nothing here').toBe(0);
  // a full day fills each workplace's cap from its own verbs
  expect(DAY_XP + xpFor('condo', 'sweep') + xpFor('condo', 'fix'), 'the arcade: the day’s piece of litter and a cabinet').toBe(LADDER.condo.day);
  expect(DAY_XP + 2 * xpFor('store', 'restock') + 2 * xpFor('store', 'serve', 2), 'the store: the delivery’s two faces and the day’s two customers').toBe(LADDER.store.day);
  expect(DAY_XP + 2 * xpFor('post', 'sort', roundXp(12, 0)), 'the post office: two perfect rounds').toBeGreaterThanOrEqual(LADDER.post.day);
});

// ↕ THE WEEKLY REVIEW (23 Sep 2026): what a week at each kind of job comes to, and what that moves
test('the review: full, ordinary, poor and empty weeks at a payslip job and at a counter', () => {
  expect(reviewOf('store', { restock: 3, serve: 3 }), 'every duty met').toBe('full');
  expect(reviewOf('store', { restock: 1, serve: 2 }), 'half the work').toBe('ok');
  expect(reviewOf('store', { serve: 1 }), 'a sixth of it').toBe('poor');
  expect(reviewOf('store', {}), 'nothing at all').toBe('empty');
  expect(reviewOf('condo', { days: 3 }), 'turning up at the arcade and sweeping nothing is nothing').toBe('empty');
  expect(reviewOf('cafe', { days: 3, cups: [1, 4, 8] }), 'three days, four cups in five good or better').toBe('full');
  expect(reviewOf('cafe', { days: 1, cups: [5, 0, 1] }), 'more than half the cups spoiled').toBe('poor');
  expect(reviewOf('cafe', { days: 1, cups: [1, 1, 2] }), 'a short, decent shift').toBe('ok');
  expect(reviewOf('stand', { days: 1 }), 'turning up at the stand is not nothing').toBe('ok');
  expect(reviewOf('stand', {}), 'never came').toBe('empty');
  expect(reviewXp('store', 'full'), 'a full week: a day of the store’s XP extra').toBe(LADDER.store.day);
  expect(reviewXp('cafe', 'poor'), 'a poor week: a day of the café’s taken back').toBe(-LADDER.cafe.day);
  expect(reviewXp('post', 'ok')).toBe(0);
});

test('🔓 the unlocks: nothing at the first rank, one new thing at the second everywhere, and each has its words', () => {
  for (const at of Object.keys(LADDER)) {
    expect(unlocksAt(at, 1), at + ': the first rank is the job as it is').toEqual([]);
    expect(unlocksAt(at, 2).length, at + ': the second rank brings one new thing').toBe(1);
    for (const k of Object.keys(UNLOCKS[at])) {
      expect(unlocked(at, k, UNLOCKS[at][k] - 1), at + '.' + k + ' is shut below its rank').toBe(false);
      expect(unlocked(at, k, UNLOCKS[at][k]), at + '.' + k + ' opens at its rank').toBe(true);
      expect(unlocked(at, k, ranksOf(at)), '…and stays open above it').toBe(true);
      expect((STAFF.unlock || {})[at] && STAFF.unlock[at][k], at + '.' + k + ': the staff card can name it').toBeTruthy();
    }
  }
  expect(unlocked('cafe', 'big', 4), 'an unlock belongs to its own workplace').toBe(false);
  expect(COUNTS_AS.basket, 'a basket is a customer served on the week’s sheet').toBe('serve');
  expect(xpFor('store', 'basket', 2), 'a perfect basket is half again a perfect customer, rounded down').toBe(Math.floor(xpFor('store', 'serve', 2) * 1.5));
  expect(xpFor('cafe', 'rush'), 'a rush served to the end').toBe(15);
});

test('🔓 the day’s work XP rises with the rank, so a rank’s new things are not swallowed by a full day', () => {
  for (const at of Object.keys(LADDER)) {
    expect(dayCap(at, 1), at + ': the first rank’s day is the ladder’s own').toBe(LADDER[at].day);
    for (let r = 2; r <= ranksOf(at); r++) expect(dayCap(at, r), at + ' rank ' + r + ' holds more than the one below').toBeGreaterThan(dayCap(at, r - 1));
  }
  expect(dayCap('store', 3) - LADDER.store.day, 'a rank-3 store day has room for a delivery').toBeGreaterThanOrEqual(xpFor('store', 'deliver'));
  expect(dayCap('condo', 3) - LADDER.condo.day, '…and a rank-3 arcade day for a lamp').toBeGreaterThanOrEqual(xpFor('condo', 'lamp'));
  expect(dayCap('cafe', 2) - LADDER.cafe.day, '…and a rank-2 café day for most of a rush').toBeGreaterThanOrEqual(12);
});
