// 💼 THE WEEK'S WORK, AS ARITHMETIC (22 Sep 2026; docs/town-jobs-plan.md §12). The one source both the pass
// worker and the town read: a cheque is the rate scaled by the share of the week's targets met, each
// duty counting up to its target and no further, and a job with no duties (the café) pays no cheque.
// Trym: "some variance in pay depending of how often the user has swept floors and fixed broken machines
// … the user gets the reasoning in the payslip why the pay is lower this time".
import { test, expect } from '@playwright/test';
import { JOB_PAY, DUTIES, NUDGE_DAY, FIRE_WEEKS, shareOf, payOf, rowsOf, dutiesOf } from '../src/data/town/jobs.js';

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
  expect(dutiesOf('store').map((d) => d[0]), 'the store counts crates and days').toEqual(['restock', 'days']);
  expect(payOf('store', { restock: 3, days: 3 }), 'a full week at the store').toBe(JOB_PAY.store);
  expect(payOf('store', { restock: 0, days: 3 }), 'only turning up is half the store’s week').toBe(Math.round(JOB_PAY.store / 2));
  // the café is tips: no duties, no cheque
  expect(dutiesOf('cafe'), 'the café has no week’s work to meet').toEqual([]);
  expect(payOf('cafe', { days: 7 }), 'and pays no cheque').toBe(0);
  // the rules the boss keeps
  expect(NUDGE_DAY, 'the boss writes from Thursday if nothing is done (Monday = 0)').toBe(3);
  expect(FIRE_WEEKS, 'two empty weeks and you are let go').toBe(2);
  for (const at of Object.keys(DUTIES)) expect(JOB_PAY[at], at + ' has a rate to scale').toBeGreaterThan(0);
});
