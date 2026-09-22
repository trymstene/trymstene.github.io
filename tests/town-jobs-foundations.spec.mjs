// 💼 THE JOBS WORK ON ANY DAY (22 Sep 2026) — three holes the jobs audit found, each proven closed here.
//
// Trym: *"if we havent finished on quality stuff for all jobs we should probably fix that first, just to land
// that the jobs work well gameplay-wise"*. The audit (docs/town-jobs-plan.md §14) found work a player could be
// paid for and could not DO:
//   · the store's shelves are filled by the town's health, and a THRIVING town left no bare face — the
//     restock duty could not be done in exactly the town it is the reward for;
//   · the work note was hidden inside every room, so the arcade's and the store's staff worked blind;
//   · the post office's round hung off a mailbox that needs an address, so staff with no homestead (or a
//     post room that was down) had no way to start sorting.
import { test, expect } from '@playwright/test';
import POST from '../src/data/copy/town-post.json' with { type: 'json' };

const seam = (page, fn, arg) => page.evaluate(fn, arg);
const room = (page, prop, ...args) => page.evaluate(([p, a]) => { const r = window.__town.room; const v = r[p]; return typeof v === 'function' ? v(...a) : v; }, [prop, args]);

async function town(page, opts = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (!opts.noYard) await page.addInitScript(() => { try { localStorage.setItem('hs-v1', JSON.stringify({ slug: 'ada-yard', claimedAt: Date.now() })); } catch (e) {} });
  else await page.addInitScript(() => { try { localStorage.removeItem('hs-v1'); } catch (e) {} });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties && window.__town.PROPS, null, { timeout: 30000 });
  await seam(page, () => { window.__town.room.curse('none'); window.__town.life.set(12); });
  return errors;
}
const inside = async (page, key) => {
  await seam(page, () => window.__town.rooms.exit());
  await seam(page, (k) => window.__town.rooms.enter(k), key);
  await page.waitForTimeout(600);
};

test('a THRIVING town still leaves the store’s staff two faces to fill', async ({ page }) => {
  const errors = await town(page);
  await seam(page, () => window.__town.room.set(96));
  await page.waitForTimeout(700);
  expect(await room(page, 'band'), 'the town is thriving').toBe('thriving');
  // a customer's store is as full as the plate allows
  await seam(page, () => window.__town.work.set({ at: '' }));
  await inside(page, 'store');
  const full = await seam(page, () => window.__town.rooms.of('store').full.length);
  expect((await room(page, 'shelf')).length, 'a thriving store is full for a customer').toBe(full);
  expect(await room(page, 'bare'), 'with no bare face').toBe(-1);
  // ⭐ its staff find the day's delivery waiting
  await seam(page, () => window.__town.work.set({ at: 'store' }));
  await inside(page, 'store');
  expect((await room(page, 'shelf')).length, '⭐ two faces are left for the staff').toBe(full - 2);
  expect(await room(page, 'hints'), 'and the crates are lit').toEqual(['overcr1', 'overcr2']);
  // lift a crate and put it on the bare face — the week's count moves
  await room(page, 'open', 'cr1');
  await page.waitForFunction(() => window.__town.room.carrying(), null, { timeout: 8000 });
  const face = await seam(page, () => window.__town.rooms.of('store').full[window.__town.room.bare()][0]);
  await room(page, 'open', face);
  await page.waitForFunction(() => !window.__town.room.carrying(), null, { timeout: 8000 });
  const d = await seam(page, () => window.__town.work.job().duties);
  expect((d.find((q) => q.kind === 'restock') || {}).done, 'the restock is on the week’s sheet').toBe(1);
  expect((await room(page, 'shelf')).length, 'and the face is filled').toBe(full - 1);
  await page.screenshot({ path: 'test-results/store-thriving-staff.png' });
  expect(errors).toEqual([]);
});

test('the work note stays up inside your own workplace, and only there', async ({ page }) => {
  const errors = await town(page);
  const noteShown = () => page.evaluate(() => {
    const e = document.querySelector('.twd-chip');
    if (!e || e.hidden) return false;
    const r = e.getBoundingClientRect(), v = document.getElementById('twView').getBoundingClientRect();
    return getComputedStyle(e).display !== 'none' && r.width > 20 && r.top >= v.top && r.bottom <= v.bottom;
  });
  await seam(page, () => window.__town.work.set({ at: 'condo', pay: 60 }));
  await page.waitForTimeout(400);
  expect(await noteShown(), 'the note is up on the square').toBe(true);
  await inside(page, 'condo');
  expect(await noteShown(), '⭐ and inside the arcade, where the week’s work is').toBe(true);
  await page.screenshot({ path: 'test-results/arcade-note-inside.png' });
  await inside(page, 'store');
  expect(await noteShown(), 'but not in somebody else’s shop').toBe(false);
  await seam(page, () => window.__town.rooms.exit());
  await page.waitForTimeout(300);
  expect(await noteShown(), 'and back on the square it is up again').toBe(true);
  // the store's staff, in the store
  await seam(page, () => window.__town.work.set({ at: 'store' }));
  await inside(page, 'store');
  expect(await noteShown(), '⭐ the store’s staff see theirs inside the store').toBe(true);
  expect(errors).toEqual([]);
});

test('Stamp’s staff can start a round with no address and no post room', async ({ page }) => {
  const errors = await town(page, { noYard: true });
  await page.route('**/post/**', (r) => r.abort());
  await seam(page, () => window.__town.work.set({ at: 'post' }));
  await seam(page, () => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await seam(page, () => window.__town.open('post'));
  await page.waitForFunction(() => !!document.querySelector('.tw-post'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({ none: (document.querySelector('.tw-post__none') || {}).textContent || '', sort: (document.getElementById('twPostSort') || {}).textContent || '' }));
  expect(st.none.trim(), 'the mailbox says there is no address yet').toBe(String(POST.noaddress || '').trim());
  expect(st.sort.trim(), '⭐ and the round is still there for the staff').toBe(String((POST.round || {}).start || '').trim());
  expect(errors).toEqual([]);
});
