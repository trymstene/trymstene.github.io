// 🕯 CHAPTER TWO — THE FOUR SIGNATURES, walked as a player (docs/town-jobs-plan.md §2).
//
// Four things about this chapter can only be proven by looking, and three of them were wrong at
// least once while it was being built:
//   · A MARK ON A WALL NEEDS THE WALL'S DEPTH. Everything outdoors sorts by z = 100 + y, so a
//     notice hung at chest height (y 500) loses to the building it is nailed to (base 560) — the
//     town hall painted clean over its own works order, and the chip said to go somewhere that
//     had nothing in it when you arrived.
//   · THE TOWN ALREADY HAS A NIB. He walks a twelve-minute day, so the quest must draw nobody:
//     a second Nib standing frozen at the hall while the real one crosses the square is a bug you
//     can see from anywhere in the town.
//   · …which means the real Nib has to hand over. Walking up to him while his step is live must
//     open the CHAPTER, not the weather — the park's rule for Old Peel, and the only reason the
//     chapter never has to say where he is standing.
//   · AND THE BOARDS HAVE TO COME OFF. The lock half shipped on 19 Sep and sat unused; a signature
//     that pays out and changes nothing on the front is the whole feature failing quietly.
//
// ⚠️ EVERY TAP HERE IS A RAW MOUSE CLICK. The marks bob, and Playwright waits forever for an
// element that animates to hold still (park-peel.spec.mjs taps them the same way).
import { test, expect } from '@playwright/test';
import { STEPS, FRONTS, HALL } from '../src/data/quest-c2.js';
import { SIGNATURES, HOARDABLE } from '../src/data/town/locks.js';

const W = 2200, H = 1300;

const town = async (page, qs = '') => {
  await page.goto('/town/?towntest&questreset' + qs, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(70); window.__town.life.set(11); });
  await page.waitForTimeout(400);
};
const stand = (page, x, y) => page.evaluate(([px, py]) => { const t = window.__town; t.pos.x = t.tgt.x = px; t.pos.y = t.tgt.y = py; }, [x, y]);
const save = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bwq-c2') || 'null'); } catch (e) { return null; } });
const tap = async (page, sel) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('nothing to tap at ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
};

// play one step to its end: tap the sheet until the saved step index moves on
const playStep = async (page) => {
  const from = (await save(page)).s;
  for (let i = 0; i < 40; i++) {
    const now = await save(page);
    if (now.s !== from) return now;
    // a reward receipt sits in front of the sheet and owns the tap until it is dismissed
    if (await page.locator('.bwq-reward button').count()) { await tap(page, '.bwq-reward button'); await page.waitForTimeout(250); continue; }
    // ⭐ YOUR OWN LINE IS A BUTTON, and while it is up the sheet's own tap is deliberately dead
    // ("your reply button is the only door") — so the walk has to press it, exactly as a thumb does.
    if (await page.locator('.bwq-ans:not([hidden]) button').count()) { await tap(page, '.bwq-ans:not([hidden]) button'); await page.waitForTimeout(260); continue; }
    if (await page.locator('.bwq-dlg').count()) { await tap(page, '.bwq-dlg'); await page.waitForTimeout(260); continue; }
    await page.waitForTimeout(200);
  }
  throw new Error('the step never advanced from ' + from);
};

// ⚠️ the receipt OUTLIVES the step. next() pays the reward and then advances, so the saved step
// index moves on while the veil is still up — which is right for a player (you dismiss it) and
// means the walk has to dismiss it too before it can reach anything in the world again.
const clearReceipt = async (page) => {
  for (let i = 0; i < 4 && await page.locator('.bwq-reward button').count(); i++) {
    await tap(page, '.bwq-reward button');
    await page.waitForTimeout(350);
  }
};

// walk to a step's mark and open it. Returns once the sheet is up.
const openStep = async (page, step) => {
  await clearReceipt(page);
  await stand(page, (step.at.x / 100) * W, Math.min(H - 60, (step.at.y / 100) * H + 140));
  await page.waitForTimeout(700);
  await page.waitForSelector('.bwq-mark', { timeout: 10000 });
  await tap(page, '.bwq-mark');
  // the chapter's title splash plays once, before the very first line
  await page.waitForTimeout(4200);
  await expect(page.locator('.bwq-dlg'), step.id + ': the sheet opens on a tap').toHaveCount(1);
};

test('the chapter opens, and it draws nobody', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await town(page);
  await stand(page, 1100, 640);
  await page.waitForTimeout(6200);   // the chip holds back ~5s on a first render

  // ── the chip is the compass, and it is on the glass rather than in the world
  const chip = await page.evaluate(() => {
    const h = document.querySelector('.bwq-hint');
    if (!h) return null;
    const r = h.getBoundingClientRect(), v = document.querySelector('#twView').getBoundingClientRect();
    return { text: h.querySelector('span').textContent, inView: r.left >= v.left - 1 && r.right <= v.right + 1 && r.top >= v.top - 1, waiting: h.classList.contains('bwq-hint--wait') };
  });
  expect(chip, 'the journal chip is up').not.toBeNull();
  expect(chip.waiting, 'and it is past its hold').toBe(false);
  expect(chip.inView, 'the chip rides the view, not the panning world').toBe(true);
  expect(chip.text.length, 'and it says where to go').toBeGreaterThan(3);

  // ⭐ THE ONE THAT MATTERS MOST: the town's nine walk their own day, so the chapter draws no cast.
  expect(await page.locator('.bwq-npc').count(), 'the quest draws no body in the town').toBe(0);
  expect(await page.locator('.tw-npc[data-k="nib"]').count(), 'and there is exactly one Nib').toBe(1);
  expect(errs, 'nothing threw').toEqual([]);
});

test('every mark hangs on its own building, and in front of it', async ({ page }) => {
  await town(page);
  // the hall and the four fronts, each checked where it stands
  const spots = [['hall', HALL], ...FRONTS.map((f) => [f.key, f.at])];
  for (const [key, at] of spots) {
    const step = STEPS.findIndex((s) => s.at.x === at.x && s.at.y === at.y);
    await page.goto('/town/?towntest&queststep=' + step, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
    await stand(page, (at.x / 100) * W, Math.min(H - 60, (at.y / 100) * H + 140));
    await page.waitForTimeout(900);
    const m = await page.evaluate((k) => {
      const el = document.querySelector('.bwq-mark');
      if (!el) return null;
      const r = el.getBoundingClientRect(), v = document.querySelector('#twView').getBoundingClientRect();
      const mid = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const hit = document.elementFromPoint(mid.x, mid.y);
      // the front's own element, and what it sorts at
      const p = document.querySelector('.tw-prop[data-key="' + k + '"]') || document.querySelector('[data-key="' + k + '"]');
      return {
        z: +getComputedStyle(el).zIndex,
        inView: r.top >= v.top - 1 && r.bottom <= v.bottom + 1 && r.left >= v.left - 1 && r.right <= v.right + 1,
        reaches: !!(hit && hit.closest('.bwq-mark')),
        propZ: p ? +getComputedStyle(p).zIndex : null,
      };
    }, key);
    expect(m, key + ': a mark exists').not.toBeNull();
    expect(m.inView, key + ': the mark is on screen when you are standing at the front').toBe(true);
    // ⚠️ THE BUG THIS TEST EXISTS FOR: a mark with no depth is painted over by its own building.
    expect(m.reaches, key + ': a thumb on the mark reaches the MARK, not the wall behind it').toBe(true);
    expect(m.z, key + ': the mark carries the front’s own depth').toBeGreaterThan(100);
    if (m.propZ != null) expect(m.z, key + ': …and sorts in front of the building it is nailed to').toBeGreaterThan(m.propZ);
  }
});

test('walking up to the real Nib opens the chapter, not the weather', async ({ page }) => {
  await town(page);
  // ⚠️ pin him where he lives, then tap HIM — this is the hand-over through window.bwqTalk, and
  // without it the one person the chapter is about answers with his ordinary day.
  const at = await page.evaluate(() => {
    const t = window.__town, n = t.life.residents().find((r) => r.key === 'nib');
    if (!n) return null;
    t.pos.x = t.tgt.x = n.x + 70; t.pos.y = t.tgt.y = n.y + 10;
    return n;
  });
  expect(at, 'Nib is somewhere in the square').not.toBeNull();
  await page.waitForTimeout(900);
  const handle = await page.evaluate(() => (window.bwqTalk ? { who: window.bwqTalk.who, mark: window.bwqTalk.mark } : null));
  expect(handle, 'the quest has published its handle').not.toBeNull();
  expect(handle.who, 'and it names the step’s speaker').toBe('nib');

  await tap(page, '.tw-npc[data-k="nib"]');
  await page.waitForTimeout(5200);   // walk up, then the splash, then the sheet
  const open = await page.evaluate(() => ({
    quest: !!document.querySelector('.bwq-dlg'),
    everyday: !!document.querySelector('#twPanel:not([hidden]) .tw-dlg, #twPanel:not([hidden]) .wd-dlg'),
  }));
  expect(open.quest, 'his tap opened the chapter').toBe(true);
  expect(open.everyday, 'and not his everyday card').toBe(false);
});

test('the whole chapter, and the boards come off as it goes', async ({ page }) => {
  test.slow();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  // ⭐ CATCH THE EVENTS. The finish line has to be readable BY EVENT NAME — that is the whole
  // reason it exists (quest_step's `id` is not a registered GA4 dimension, so on 21 Sep "how many
  // finish a chapter" could only be answered as a bound). An event nothing fires reads as zero
  // forever and looks exactly like nobody finishing, which is the failure this walk rules out.
  await page.addInitScript(() => { window.__ev = []; window.gtag = (kind, name, p) => window.__ev.push([name, p]); });
  await town(page);
  // 🚧 the lock is shipped OFF (HOARD_ON false, Trym's switch) — the walk turns it on for itself,
  // because a signature that pays out and changes nothing on the front is the feature failing.
  const hoardedNow = () => page.evaluate(() => window.__town.room.locks(true));
  expect(await hoardedNow(), 'every hoardable front starts boarded').toEqual(HOARDABLE);

  const opened = [];
  for (const step of STEPS) {
    await openStep(page, step);
    const after = await playStep(page);
    if (step.opens) {
      opened.push(step.opens);
      expect(after.open, step.id + ' wrote its signature into bwq-c2.open').toEqual(opened);
      // …and the boards are actually off this one now
      const still = await page.evaluate((o) => window.__town.room.locks(true, o), opened);
      expect(still, 'the boards are off ' + step.opens).toEqual(HOARDABLE.filter((k) => !opened.includes(k)));
    }
  }
  expect(opened, 'the four signatures, in the plan’s order').toEqual(SIGNATURES);
  const end = await save(page);
  expect(end.done, 'the chapter is finished').toBe(1);
  expect(errs, 'and nothing threw on the way').toEqual([]);

  const ev = await page.evaluate(() => (window.__ev || []).map((e) => e[0]));
  expect(ev, 'the finish fires an event of its own, which is the only way the rate is ever readable').toContain('quest_c2_done');
  expect(ev.filter((n) => n === 'quest_c2_done').length, 'and exactly once').toBe(1);
  expect(ev.filter((n) => n === 'quest_step').length, 'every step was counted').toBe(STEPS.length);

  // a finished chapter leaves the square alone: no chip, no marks
  await town(page.constructor === Object ? page : page, '');
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.waitForTimeout(6500);
  expect(await page.locator('.bwq-mark').count(), 'a finished chapter leaves no marks behind').toBe(0);
  expect(await page.locator('.bwq-hint').count(), 'and no chip').toBe(0);
});
