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
import COPY from '../src/data/copy/town-post.json' with { type: 'json' };

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
  expect(await page.locator('.tw-post__env').count(), 'the unread one is a sealed envelope').toBe(1);
  expect(await page.locator('.tw-post__thread').count(), 'and the read one is filed under who wrote it').toBe(1);
  // ⚠️ the peek is one clipped line: three unread letters three lines deep turn a mailbox into a scroller
  const wraps = await page.evaluate(() => [...document.querySelectorAll('.tw-post__peek')].map((e) => e.getBoundingClientRect().height));
  for (const h of wraps) expect(h, 'a row’s peek is one line').toBeLessThan(26);

  await page.evaluate(() => window.__town.post().tap('.tw-post__env'));
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
  await page.evaluate(() => window.__town.post().tap('.tw-post__env'));
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
    await page.evaluate(() => { const els = [...document.querySelectorAll('.tw-post__env')]; els[els.length - 1].click(); });
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

// ⭐ A MAILBOX THAT DOES NOT BECOME A SCROLL (Trym, 20 Sep: "letters need to be sorted well if a user
// receives and sends alot of letters, so you dont have to scroll forever through old stuff").
//
// Sixty letters from eight people is EIGHT rows, not sixty — letters are correspondence, so the
// correspondent is the unit, and every row is a conversation you can open. The new post stays separate
// and stays envelopes: that is the part you came to see.
test('sixty letters from eight people is eight rows, and the new post stays on top', async ({ page }) => {
  const errs = await box(page);
  const people = ['pip', 'moss', 'dot', 'nib', 'bean', 'stamp', 'spinner', 'figjr'];
  const many = [];
  for (let i = 0; i < 60; i++) {
    many.push({ id: 'L' + i, from: people[i % people.length] + '-yard', at: Date.now() - i * 60000, read: true, text: 'letter number ' + i + ', about the weather and the fountain' });
  }
  many.push({ id: 'new1', from: 'ada-far', at: Date.now(), read: false, text: 'a letter that has not been opened' });
  await put(page, many);
  await page.waitForTimeout(300);

  const m = await page.evaluate(() => ({
    envelopes: document.querySelectorAll('.tw-post__env').length,
    rows: document.querySelectorAll('.tw-post__thread').length,
    cardScroll: (() => { const c = document.querySelector('.tw-card'); return c.scrollHeight - c.clientHeight; })(),
    threads: window.__town.post().state().threads,
  }));
  expect(m.envelopes, 'the unopened letter is an envelope on top').toBe(1);
  expect(m.rows, '⭐ sixty letters become eight rows, one per person').toBe(8);
  expect(m.threads.reduce((a, t) => a + t.n, 0), 'and every letter is still in there').toBe(60);
  // ⚠️ 8 rows + 1 envelope in a 440px card still scrolls a little, and that is fine — what must never
  // happen is the sixty-row version, which is roughly seven screens deep
  expect(m.cardScroll, 'the whole mailbox is about one screen, not seven').toBeLessThan(440);

  // ── a row opens that person's letters, newest first, and back goes back one step
  await page.evaluate(() => window.__town.post().tap('.tw-post__thread'));
  await page.waitForTimeout(250);
  const inThread = await page.evaluate(() => window.__town.post().state());
  expect(inThread.thread, 'the row opened a conversation').toBeTruthy();
  const order = await page.evaluate(() => [...document.querySelectorAll('.tw-post__thread .tw-post__peek')].map((e) => e.textContent));
  expect(order.length, 'their letters are all in there').toBeGreaterThan(1);
  expect(order[0], 'newest first').toContain('letter number');

  await page.evaluate(() => window.__town.post().tap('#twPostBack'));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__town.post().state().thread), 'and back goes back to the mailbox').toBeFalsy();
  expect(errs).toEqual([]);
});

// ✉️ the envelope comes open and the letter comes out — once, and then the card is still
test('the envelope opens, and does not open again while you are reading', async ({ page }) => {
  const errs = await box(page);
  await put(page, LETTERS);
  await page.evaluate(() => window.__town.post().tap('.tw-post__env'));
  await page.waitForTimeout(80);
  const during = await page.evaluate(() => ({
    opening: window.__town.post().state().opening,
    flap: document.querySelectorAll('.tw-post__flap').length,
    anim: (() => { const e = document.querySelector('.tw-post__flap'); return e ? getComputedStyle(e).animationName : ''; })(),
  }));
  expect(during.opening, 'the envelope is coming open').toBe(true);
  expect(during.flap, 'and it is on screen while it does').toBe(1);
  expect(during.anim, '⚠️ transform and opacity only — the design gate reads this stylesheet now').toBe('twPostFlap');

  await page.waitForTimeout(700);
  // ⚠️ a re-render while you are reading — a reply, a report — must not play the envelope again over a
  // letter that is already open
  await page.evaluate(() => window.__town.post().tap('#twPostReply'));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__town.post().tap('#twPostBack'));
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ opening: window.__town.post().state().opening, flap: document.querySelectorAll('.tw-post__flap').length, body: document.querySelectorAll('.tw-post__body').length }));
  expect(after.opening, 'the envelope is done').toBe(false);
  expect(after.flap, 'and gone').toBe(0);
  expect(after.body, 'the letter is still open and readable').toBe(1);
  expect(errs).toEqual([]);
});

// 🏠 A PLAYER WITH NO YARD HAS NO ADDRESS, and the card has to say so rather than lie.
//
// A mailbox is keyed to the sign name on your homestead's fence, so somebody who has never claimed a
// yard has nowhere for a letter to land. The rail returned the kill switch's own error for that case,
// so the card said "the post counter is closed" — which is false: the post office is fine and the
// player has no door. ⭐ A DOOR, NOT A REFUSAL: the line names the homestead, the way a padlocked
// garment on the dressing room's rail names the place it is caught.
test('a player with no homestead is told they have no address, not that the post is shut', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  // ⚠️ NO hs-v1 at all — the one thing that separates this case from every other test in the file
  await page.addInitScript(() => { try { localStorage.removeItem('hs-v1'); } catch (e) {} });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { const p = window.__town.PROPS.post, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.evaluate(() => window.__town.open('post'));
  await page.waitForFunction(() => !!document.querySelector('.tw-post'), null, { timeout: 20000 });
  await page.waitForTimeout(500);

  const st = await page.evaluate(() => window.__town.post().state());
  expect(st.why, 'the rail says WHICH kind of nothing this is').toBe('noaddress');

  const said = (await page.locator('.tw-post__none').textContent()) || '';
  expect(said.length, 'it says something').toBeGreaterThan(10);
  // ⚠️ and NOT the closed-counter line: that WAS the bug, so the approved words are read from the
  // file the game reads rather than typed here, where they would rot the day the rig redrafts them
  expect(said.trim(), 'never the closed-counter line').not.toBe(String(COPY.shut || '').trim());
  expect(said.trim(), '…and it is the line written for this case').toBe(String(COPY.noaddress || '').trim());
  // it names the place an address comes from
  expect(/home|house|sign|fence|yard/i.test(said), 'it names where an address comes from: ' + said).toBe(true);
  // ⭐ and it is a door, not a telling-off
  expect(/sorry|cannot|can.t|error|unable|must/i.test(said), 'no refusal words: ' + said).toBe(false);
  expect(errs).toEqual([]);
});
