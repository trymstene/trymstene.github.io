// ✉️ THE MAILBOX — the post office's card (20 Sep 2026, docs/town-jobs-plan.md §6).
//
// ⚠️ THE THREE THINGS THAT COULD BE QUIETLY WRONG HERE, and each is a line below:
//   · A REFUSAL MAY NEVER SAY WHY (Trym's call). Whatever the server refused for — the filter, a cap,
//     the kill switch — the writer sees the same line, because a precise reason is a lesson in getting
//     round the filter next time. The reason rides the event for us, never the screen for them.
//   · A REPORTED LETTER LEAVES THE BOX ON THE TAP. "Held for review" means held for Trym; nobody sits
//     looking at something they have just reported while they wait for one person with a phone.
//   · THE CLOSED COUNTER IS THE NORMAL PATH TODAY. POST_OFF ships ON, so every player sees the shut
//     line — a card that showed an error for its own expected state would be wrong on day one.
import { test, expect } from '@playwright/test';

async function box(page, w, h) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  if (w) await page.setViewportSize({ width: w, height: h });
  // ⚠️ a claimed yard, because the mailbox is keyed by its slug: your house is your address
  await page.addInitScript(() => { try { localStorage.setItem('hs-v1', JSON.stringify({ slug: 'ada-yard', claimedAt: Date.now() })); } catch (e) {} });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.evaluate(() => window.__town.open('post'));
  await page.waitForFunction(() => !!document.querySelector('.tw-post'), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  return errs;
}
const put = (page, letters) => page.evaluate((ls) => window.__town.post().set({ letters: ls, unread: ls.filter((l) => !l.read).length }), letters);
const LETTERS = [
  { id: 'a1', from: 'pip-yard', at: Date.now(), read: false, text: 'Your sunflowers are enormous. Mine came to nothing again.' },
  { id: 'a2', from: 'moss-yard', at: Date.now() - 9e5, read: true, text: 'Thanks for the eggs.' },
];

test('the post office opens your mailbox, and says what it is when there is nothing in it', async ({ page }) => {
  const errs = await box(page);
  // the building no longer answers with a hand-written toast ending "Not built yet."
  const said = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  expect(said, 'the stale stub is gone').not.toContain('Not built yet');
  expect(await page.locator('.tw-post h2').count(), 'the mailbox card opened').toBe(1);
  // ⚠️ the rail ships SHUT, so this is what everybody sees today — and it has to read as a closed
  // counter rather than as something broken
  const bare = await page.evaluate(() => document.querySelector('.tw-post').textContent || '');
  expect(bare.toLowerCase()).not.toContain('error');
  expect(bare.toLowerCase()).not.toContain('server');
  expect(await page.locator('.tw-post .tw-card__sub').count(), 'and the building says what it is while the box is bare').toBe(1);
  expect(errs).toEqual([]);
});

test('a letter opens, and reporting it takes it out of the box on the tap', async ({ page }) => {
  const errs = await box(page);
  await put(page, LETTERS);
  await page.waitForTimeout(200);
  expect(await page.locator('.tw-post__let').count(), 'two letters in the stack').toBe(2);
  expect(await page.locator('.tw-post__let.is-new').count(), 'one of them unread').toBe(1);
  // ⚠️ the peek is one clipped line: three unread letters three lines deep turn a mailbox into a scroller
  const wraps = await page.evaluate(() => [...document.querySelectorAll('.tw-post__peek')].map((e) => e.getBoundingClientRect().height));
  for (const h of wraps) expect(h, 'a letter’s peek is one line').toBeLessThan(26);

  await page.evaluate(() => window.__town.post().tap('.tw-post__let'));
  await page.waitForTimeout(200);
  expect(await page.locator('.tw-post__body').count(), 'it opens').toBe(1);

  await page.evaluate(() => window.__town.post().tap('#twPostFlag'));
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__town.post().state());
  expect(after.letters.length, '⭐ gone from the box on the tap — nobody waits to stop looking at it').toBe(1);
  expect(after.open, 'and the card goes back to the stack').toBeFalsy();
  const toast = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  expect(toast.length, 'the world says it was taken').toBeGreaterThan(8);
  expect(toast.toLowerCase(), '…without saying what happens to whoever sent it').not.toMatch(/ban|block|punish|warn/);
  expect(errs).toEqual([]);
});

test('a refusal never says which rule it hit', async ({ page }) => {
  const errs = await box(page);
  await put(page, LETTERS);
  await page.evaluate(() => window.__town.post().tap('.tw-post__let'));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__town.post().tap('#twPostReply'));
  await page.waitForTimeout(200);
  expect(await page.locator('#twPostText').count(), 'the sheet opens, addressed to whoever wrote').toBe(1);
  expect(await page.evaluate(() => window.__town.post().state().writing), 'and it knows where it is going').toBe('pip-yard');

  // ⚠️ every one of these is refused for a DIFFERENT reason, and the player must not be able to tell
  const said = [];
  for (const text of ['come find me at trymstene.com', 'ring me on 555 123 4567', 'im @bobtheduck', 'you are a total bitch']) {
    await page.evaluate(() => { const t = document.getElementById('twPostText'); if (t) t.value = ''; });
    await page.evaluate((s) => window.__town.post().type(s), text);
    await page.evaluate(() => window.__town.post().tap('#twPostSend'));
    await page.waitForTimeout(250);
    said.push(await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim()));
  }
  expect(new Set(said).size, '⭐ four different reasons, one line — a precise reason teaches the next attempt').toBe(1);
  const line = said[0];
  expect(line.length, 'and it says something').toBeGreaterThan(8);
  expect(line.toLowerCase(), 'naming no rule').not.toMatch(/link|url|address|phone|number|word|filter|blocked|banned|rude/);
  expect(await page.evaluate(() => window.__town.post().state().writing), 'the sheet stays open so nothing is lost').toBe('pip-yard');
  expect(errs).toEqual([]);
});

// 📱 261 × 440 at the narrowest phone the house supports
for (const [w, h] of [[360, 640], [393, 852]]) {
  test(`the mailbox holds together at ${w}×${h}`, async ({ page }) => {
    const errs = await box(page, w, h);
    await put(page, [...LETTERS, { id: 'a3', from: 'stamp-yard', at: Date.now(), read: false, text: 'x'.repeat(400) }]);
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const c = document.querySelector('.tw-card'), b = document.getElementById('twCardBody');
      return { overflowX: b.scrollWidth - b.clientWidth, w: b.getBoundingClientRect().width, cardBot: c.getBoundingClientRect().bottom, viewBot: document.getElementById('twView').getBoundingClientRect().bottom };
    });
    expect(m.overflowX, 'nothing runs off the side of the card').toBeLessThanOrEqual(0);
    expect(m.cardBot, 'and the card stays inside the world frame').toBeLessThanOrEqual(m.viewBot + 1);

    // ⚠️ AN UNBROKEN 400-CHARACTER WORD IS A LETTER A PLAYER CAN SEND. Without break-anywhere it runs
    // straight off the side of the card and turns it into a horizontal scroller.
    await page.evaluate(() => { const els = [...document.querySelectorAll('.tw-post__let')]; els[els.length - 1].click(); });
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => {
      const b = document.getElementById('twCardBody');
      return { overflowX: b.scrollWidth - b.clientWidth, body: !!document.querySelector('.tw-post__body') };
    });
    expect(opened.body, 'the long letter opens').toBe(true);
    expect(opened.overflowX, 'and one unbroken word does not push the card sideways').toBeLessThanOrEqual(0);
    expect(errs).toEqual([]);
  });
}
