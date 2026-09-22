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
  // 📬 the read one is not under it any more: Fresh is what is new, and Kept is where opened post goes
  expect(await page.locator('.tw-post__thread').count(), 'the read one is not in Fresh').toBe(0);
  await page.evaluate(() => window.__town.post().tap('.tw-post__tab[data-drawer="kept"]'));
  await page.waitForTimeout(150);
  expect(await page.locator('.tw-post__thread').count(), 'it is in Kept, filed under who wrote it').toBe(1);
  // ⚠️ the peek is one clipped line: three unread letters three lines deep turn a mailbox into a scroller
  const wraps = await page.evaluate(() => [...document.querySelectorAll('.tw-post__peek')].map((e) => e.getBoundingClientRect().height));
  for (const h of wraps) expect(h, 'a row’s peek is one line').toBeLessThan(26);
  await page.evaluate(() => window.__town.post().tap('.tw-post__tab[data-drawer="fresh"]'));
  await page.waitForTimeout(150);

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
    await page.evaluate(() => document.querySelector('.tw-post__env[data-id="a3"]').click());
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

  expect(await page.locator('.tw-post__env').count(), 'the unopened letter is an envelope, and it is what the mailbox opens on').toBe(1);
  expect(await page.locator('.tw-post__thread').count(), '…with none of the old post over it').toBe(0);
  await page.evaluate(() => window.__town.post().tap('.tw-post__tab[data-drawer="kept"]'));
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => ({
    rows: document.querySelectorAll('.tw-post__thread').length,
    cardScroll: (() => { const c = document.querySelector('.tw-card'); return c.scrollHeight - c.clientHeight; })(),
    threads: window.__town.post().state().threads,
  }));
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

// 📮 THE POSTCARD (docs/town-jobs-plan.md §6, "Postcards v2").
//
// ⭐ A CARD IS AN OBJECT, NOT A MESSAGE. That is the plan's answer to "in a world with instant
// messaging": a picture with the sender's own banana standing in it, one line off an approved rack,
// and a stamp. Nothing on it was typed by anybody, which is why it has no moderation surface of its
// own and why it survives a letters shutdown.
//
// ⚠️ AND IT TRAVELS AS A RECIPE. Three template ids, an index into the deck, and an outfit — a few
// hundred bytes rather than forty kilobytes of PNG through a Durable Object, which is the whole
// reason it fits the $0 model. Every check below is on that shape.
const CARD_IN = { id: 'c1', from: 'moss-yard', at: Date.now(), read: false, kind: 'card',
  card: { tpl: 'rave', line: 3, look: { hat: 'tophat', glasses: 'shades', extras: {} } } };

test('a postcard arrives as a picture, and is not an envelope', async ({ page }) => {
  const errs = await box(page, 360, 640);
  await put(page, [LETTERS[0], CARD_IN]);
  await page.waitForTimeout(300);

  // in Fresh: one envelope and one card, and they do not look alike
  expect(await page.locator('.tw-post__env').count(), 'the letter is an envelope').toBe(1);
  expect(await page.locator('.tw-post__pctile').count(), 'the card is a card').toBe(1);
  expect(await page.locator('.tw-post__pctile img').getAttribute('src'), 'wearing its own picture').toContain('pc-rave');

  // opened, it is the picture with the SENDER's banana drawn in it
  await page.evaluate(() => document.querySelector('.tw-post__pctile').click());
  await page.waitForTimeout(700);
  const got = await page.evaluate(() => {
    const pc = document.querySelector('.tw-pc'), cv = pc && pc.querySelector('.tw-pc__me');
    return {
      bg: pc && pc.querySelector('.tw-pc__bg').getAttribute('src'),
      line: pc && pc.querySelector('.tw-pc__line').textContent,
      place: pc && pc.querySelector('.tw-pc__place').textContent,
      look: cv && cv.dataset.look, drawn: cv && cv.dataset.f,
      inside: !!(pc && cv && cv.getBoundingClientRect().bottom <= pc.getBoundingClientRect().bottom + 1),
    };
  });
  expect(got.bg, 'the rave template').toContain('pc-rave');
  expect(got.line, 'the line it was sent with, from the deck').toBe(COPY.card.lines[3]);
  expect(got.place, 'and the place it was sent from').toBe(COPY.card.places.rave);
  // ⭐ THE RECIPE, PUT BACK TOGETHER. The sender's outfit rode the rail and the receiver's own
  // browser drew it — so the banana in the picture is THEIRS, not the reader's.
  expect(JSON.parse(got.look || '{}').hat, 'the sender’s hat').toBe('tophat');
  expect(got.drawn, 'and the banana really was drawn').toBeTruthy();
  expect(got.inside, 'the banana stands inside the picture, not below it').toBe(true);
  expect(errs).toEqual([]);
});

test('making one: three places, eight lines, and the picture follows your thumb', async ({ page }) => {
  const errs = await box(page, 360, 640);
  await page.evaluate(() => { try { localStorage.setItem('bb-last', JSON.stringify({ hat: 'party', glasses: 'nerd', extras: { balloons: true } })); } catch (e) {} });
  await put(page, [LETTERS[0]]);
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.tw-post__env').click());
  await page.waitForTimeout(600);

  // ⚠️ TWO WAYS TO ANSWER, side by side, and NEITHER MAY BE CUT WITH AN ELLIPSIS. "Picture Postcard"
  // was used as this button's label and came out "Picture Post…" on a phone; buttons in this world
  // never line-break, and a label hidden behind an ellipsis is the same failure wearing a hat.
  const two = await page.evaluate(() => [...document.querySelectorAll('.tw-post__two .tw-btn--in')]
    .map((b) => ({ text: b.textContent, cut: b.scrollWidth > b.clientWidth + 1 })));
  expect(two.length, 'a letter and a card').toBe(2);
  for (const b of two) expect(b.cut, `"${b.text}" is cut off`).toBe(false);

  await page.evaluate(() => document.querySelector('#twPostCard').click());
  await page.waitForTimeout(700);
  expect(await page.locator('.tw-pc__pick').count(), 'three places').toBe(3);
  expect(await page.locator('.tw-pc__say').count(), 'and the whole deck').toBe(COPY.card.lines.length);

  // the picture follows the picks — which is the whole of the fun
  const shown = () => page.evaluate(() => ({
    bg: document.querySelector('.tw-pc__bg').getAttribute('src'),
    line: document.querySelector('.tw-pc__line').textContent,
  }));
  const before = await shown();
  await page.evaluate(() => document.querySelectorAll('.tw-pc__pick')[2].click());
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelectorAll('.tw-pc__say')[5].click());
  await page.waitForTimeout(250);
  const after = await shown();
  expect(after.bg, 'the place changed').not.toBe(before.bg);
  expect(after.line, 'and so did the line').toBe(COPY.card.lines[5]);

  // ⭐ AND IT IS YOUR BANANA IN IT, read when the sheet opened rather than when it is sent — so the
  // preview and the post can never disagree about what you had on.
  const look = JSON.parse(await page.evaluate(() => document.querySelector('.tw-pc__me').dataset.look) || '{}');
  expect(look.hat, 'your hat is in the picture').toBe('party');
  expect(errs).toEqual([]);
});

// ⚠️ EVERY FIELD ON A CARD IS AN INDEX OR AN ID, NEVER A STRING THE SENDER COMPOSED. Send prose
// instead and it is not a card, it is a letter wearing a picture.
test('the rail refuses a postcard that is not one', async () => {
  const { checkCard, CARD } = await import('../src/lib/letter-gate.js');
  expect(checkCard({ tpl: 'park', line: 0 }).ok, 'a real one').toBe(true);
  expect(checkCard({ tpl: 'somewhere-else', line: 0 }).reason, 'an unknown place').toBe('tpl');
  expect(checkCard({ tpl: 'park', line: CARD.lines }).reason, 'a line off the end of the deck').toBe('line');
  expect(checkCard({ tpl: 'park', line: '0' }).reason, 'a line that is not a number').toBe('line');
  expect(checkCard({ tpl: 'park', line: 1.5 }).reason, 'nor half of one').toBe('line');
  // ⚠️ the outfit is player data that will be drawn on somebody ELSE's screen: bounded, always
  const fat = checkCard({ tpl: 'park', line: 0, look: { extras: Object.fromEntries(Array.from({ length: 900 }, (_, i) => ['x' + i, true])) } });
  expect(Object.keys(fat.card.look.extras).length, 'the recipe has a ceiling').toBeLessThanOrEqual(CARD.extras);
  expect(checkCard({ tpl: 'park', line: 0, look: { hat: '<script>x</script>' } }).card.look.hat, 'and an id is an id').toBe('none');
  // …and the deck the copy file ships is exactly the length the gate judges against
  expect(COPY.card.lines.length, 'the deck and the gate agree').toBe(CARD.lines);
  expect(Object.keys(COPY.card.places).sort(), 'and so do the places').toEqual([...CARD.tpl].sort());
});

// 📱👍 THE THUMB WALK — every control of the post office, tapped for real, at four phone widths.
//
// docs/town-jobs-plan.md §7 line 26: "Pulse + the walk at 360/375/390/393 with raw taps". The raw
// part is the whole point. `element.click()` fires on a node whether or not a human could ever have
// reached it, so it passes on a button that is below the fold, under the HUD, or behind another
// element — which is exactly the failure this house has been caught by before (memory: the
// below-fold trap, the stand's buy box). A tap here is a real click at real coordinates, and it is
// refused unless the control is ON SCREEN and is the topmost thing at that point.
//
// ⚠️ WHAT IT DOES AND DOES NOT PROVE, because an overclaiming test is worse than none. It scrolls
// the control into view first, exactly as a player would — so a button below the fold of a card that
// SCROLLS is not a failure and is not caught (checked: stretching the deck to ten times its height
// still passes, and should). What it catches is a control that cannot be reached at all, and one that
// is covered: a translucent overlay laid over the two reply buttons turns this walk red at every
// width, which is how the probe itself was proven.
async function thumb(page, sel, what) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(90);
  const m = await page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      x, y, w: r.width, h: r.height,
      onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      topmost: !!(top && (top === e || e.contains(top) || top.contains(e))),
      covered: top ? top.className || top.tagName : 'nothing',
    };
  }, sel);
  expect(m, `${what} is on the page`).not.toBeNull();
  // ⚠️ 44 px is the house's own thumb target (design library), and a 2-px slice of a control is a
  // control nobody hits on the first try
  expect(Math.min(m.w, m.h), `${what} is big enough for a thumb`).toBeGreaterThan(17);
  expect(m.onScreen, `${what} is off the screen at this size — a player could never reach it`).toBe(true);
  expect(m.topmost, `${what} is covered by ${m.covered}`).toBe(true);
  await page.mouse.click(m.x, m.y);
  await page.waitForTimeout(260);
}

// ⚠️ 375×667 is an iPhone SE and the SHORTEST thing the house supports; 393×852 the tallest common
// Android. A card that holds at 360 and at 393 can still fail in between (memory: mobile viewport
// targets).
for (const [w, h] of [[360, 640], [375, 667], [390, 844], [393, 852]]) {
  test(`every control of the post office answers a real thumb at ${w}×${h}`, async ({ page }) => {
    const errs = await box(page, w, h);
    await put(page, [LETTERS[0], CARD_IN]);
    await page.waitForTimeout(250);

    // ── a sealed envelope opens
    await thumb(page, '.tw-post__env', 'the envelope');
    expect(await page.evaluate(() => window.__town.post().state().open), 'it opened').toBeTruthy();

    // ── write back, and send
    await thumb(page, '#twPostReply', 'Write back');
    await thumb(page, '.tw-post__sheet', 'the writing sheet');
    await page.keyboard.type('The hens are laying again.');
    await thumb(page, '#twPostSend', 'Send letter');

    // ── a postcard opens, and one can be made end to end
    await page.evaluate((ls) => window.__town.post().set({ letters: ls, unread: 2 }), [LETTERS[0], CARD_IN]);
    await page.waitForTimeout(250);
    await thumb(page, '.tw-post__pctile', 'the postcard in the box');
    await thumb(page, '#twPostCard', 'Send a card');
    await thumb(page, '.tw-pc__pick:nth-child(3)', 'the third place');
    await thumb(page, '.tw-pc__say:last-child', 'the last line of the deck');
    await thumb(page, '#twPostCardGo', 'Send postcard');

    // ── and the report, which is the one control that must never be hard to reach
    await page.evaluate((ls) => window.__town.post().set({ letters: ls, unread: 1 }), [LETTERS[0]]);
    await page.waitForTimeout(250);
    await thumb(page, '.tw-post__env', 'the envelope again');
    await thumb(page, '#twPostFlag', 'Report this letter');
    expect(await page.evaluate(() => window.__town.post().state().letters.length), 'the letter left the box on the tap').toBe(0);
    expect(errs).toEqual([]);
  });
}

// 📬 THE TWO DRAWERS (22 Sep 2026, Trym: "make sure it looks great visually in the mailbox when you have lots
// of letters so its not all in a long list, maybe a 'read' or 'archive' minitab for old letters, so you always
// see the fresh letters youve received from anyone, users and residents").
//
// ⭐ Fresh is everything not yet opened, as tiles that wrap and scroll inside themselves — so a boxful never
// pushes the card off the phone — and Kept is the opened post, the postcards as a strip of pictures and the
// letters as one row per person. What is new can never be under what is old.
const LOTS = (() => {
  const out = [], now = Date.now();
  for (let i = 0; i < 14; i++) out.push({ id: 'f' + i, from: 'house-' + i, name: 'Neighbour ' + i, at: now - i * 60000, read: false, text: 'a letter not yet opened, number ' + i });
  out.push({ id: 'nib1', from: 'nib', name: 'Nib', kind: 'note', note: 'fixed', at: now - 30000, read: false, text: 'The square is in order again.' });
  for (let i = 0; i < 2; i++) out.push({ id: 'fc' + i, from: 'card-' + i, at: now - i * 90000, read: false, kind: 'card', card: { tpl: ['park', 'rave'][i], line: i, look: {} } });
  for (let i = 0; i < 30; i++) out.push({ id: 'k' + i, from: 'old-' + (i % 6), at: now - 864e5 - i * 60000, read: true, text: 'an old letter, number ' + i });
  for (let i = 0; i < 3; i++) out.push({ id: 'kc' + i, from: 'old-' + i, at: now - 2 * 864e5 - i, read: true, kind: 'card', card: { tpl: 'home', line: i, look: {} } });
  return out;
})();
for (const [w, h] of [[360, 640], [393, 852]]) {
  test(`a boxful is two drawers, not a long list, at ${w}×${h}`, async ({ page }) => {
    const errs = await box(page, w, h);
    await put(page, LOTS);
    await page.waitForTimeout(300);
    const fresh = await page.evaluate(() => {
      const c = document.querySelector('.tw-card'), g = document.querySelector('.tw-post__grid'), d = document.querySelector('.tw-post__drawer');
      const tiles = [...g.children].map((e) => e.getBoundingClientRect());
      const tabs = [...document.querySelectorAll('.tw-post__tab')].map((t) => ({ k: t.dataset.drawer, on: t.getAttribute('aria-selected'), n: (t.querySelector('b') || {}).textContent || '' }));
      const write = document.getElementById('twPostNew').getBoundingClientRect(), cr = c.getBoundingClientRect();
      return {
        drawer: window.__town.post().state().drawer, tabs,
        env: document.querySelectorAll('.tw-post__grid .tw-post__env').length,
        cards: document.querySelectorAll('.tw-post__grid .tw-post__pctile').length,
        rows: document.querySelectorAll('.tw-post__thread').length,
        perRow: tiles.filter((r) => Math.abs(r.top - tiles[0].top) < 2).length,
        drawerScrolls: d.scrollHeight > d.clientHeight + 4,
        names: [...g.querySelectorAll('.tw-post__who')].map((e) => ({ t: e.textContent, cut: e.scrollHeight > e.clientHeight + 1 })),
        cardScroll: c.scrollHeight - c.clientHeight,
        writeOnCard: write.bottom <= cr.bottom + 1 && write.top >= cr.top,
        sideways: document.getElementById('twCardBody').scrollWidth - document.getElementById('twCardBody').clientWidth,
      };
    });
    expect(fresh.drawer, '⭐ the mailbox opens on Fresh').toBe('fresh');
    expect(fresh.tabs.map((t) => t.k), 'two drawers').toEqual(['fresh', 'kept']);
    expect(fresh.tabs[0].n, 'Fresh counts what is new').toBe('17');
    expect(fresh.tabs[1].n, 'Kept counts what is kept').toBe('33');
    expect(fresh.env, 'every unopened letter, the neighbours’ and the resident’s alike').toBe(15);
    expect(fresh.cards, 'and the new postcards, as pictures').toBe(2);
    expect(fresh.rows, 'nothing old in here').toBe(0);
    expect(fresh.perRow, 'tiles, not a list: at least three to a row').toBeGreaterThanOrEqual(3);
    expect(fresh.drawerScrolls, 'a boxful scrolls inside the drawer').toBe(true);
    expect(fresh.names.filter((n) => n.cut).map((n) => n.t), '⭐ every tile says who, whole — “From Ne…” said nobody').toEqual([]);
    expect(fresh.names.some((n) => n.t === 'Neighbour 0'), 'the bare name, the envelope says the rest').toBe(true);
    expect(fresh.cardScroll, '…so the card itself stays about one screen').toBeLessThan(60);
    expect(fresh.writeOnCard, 'and the way to write one is still on the card').toBe(true);
    expect(fresh.sideways, 'nothing runs off the side').toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/post-drawers-fresh-${w}.png` });

    await thumb(page, '.tw-post__tab[data-drawer="kept"]', 'the Kept drawer');
    const kept = await page.evaluate(() => ({
      drawer: window.__town.post().state().drawer,
      strip: document.querySelectorAll('.tw-post__cards .tw-post__pctile').length,
      rows: document.querySelectorAll('.tw-post__stack.is-kept .tw-post__thread').length,
      counts: [...document.querySelectorAll('.tw-post__thread .tw-post__n')].map((e) => e.textContent),
      env: document.querySelectorAll('.tw-post__env').length,
      write: (() => { const w = document.getElementById('twPostNew').getBoundingClientRect(), c = document.querySelector('.tw-card').getBoundingClientRect(); return w.bottom <= c.bottom + 1 && w.top >= c.top; })(),
      cardScroll: (() => { const c = document.querySelector('.tw-card'); return c.scrollHeight - c.clientHeight; })(),
    }));
    expect(kept.drawer).toBe('kept');
    expect(kept.write, 'Kept keeps the write button on the card too').toBe(true);
    expect(kept.cardScroll, '…because the drawer scrolls, not the card').toBeLessThan(60);
    expect(kept.strip, 'the kept postcards are a strip of pictures').toBe(3);
    expect(kept.rows, 'and thirty letters from six people are six rows').toBe(6);
    expect(kept.counts.every((n) => Number(n) === 5), 'each row says how many are in it').toBe(true);
    expect(kept.env, 'nothing sealed in Kept').toBe(0);
    await page.screenshot({ path: `test-results/post-drawers-kept-${w}.png` });

    // ⭐ open one from Fresh and it moves to Kept — new post is never filed under old
    await thumb(page, '.tw-post__tab[data-drawer="fresh"]', 'the Fresh drawer');
    await thumb(page, '.tw-post__env[data-id="f0"]', 'a sealed letter');
    await page.waitForTimeout(600);
    await thumb(page, '#twPostBack', 'Back');
    const after = await page.evaluate(() => ({
      env: document.querySelectorAll('.tw-post__grid .tw-post__env').length,
      fresh: (document.querySelector('.tw-post__tab[data-drawer="fresh"] b') || {}).textContent,
      kept: (document.querySelector('.tw-post__tab[data-drawer="kept"] b') || {}).textContent,
    }));
    expect(after.env, 'one fewer sealed letter').toBe(14);
    expect([after.fresh, after.kept], 'and the counts move with it').toEqual(['16', '34']);
    expect(errs).toEqual([]);
  });
}

// 🚪 THE KNOCK (22 Sep 2026). A house you have never had post from knocks: you see who, never what, until you
// let it in. Letting in and turning away are side by side and the same weight — both are ordinary.
test('a new house knocks: who and never what, let in or turned away', async ({ page }) => {
  const now = Date.now();
  const knock = (id, from, name, house, at) => ({ id, from, at, kind: 'knock', read: false, name, house });
  const LETTER = { id: 'a1', from: 'pip-yard', name: 'Pip', at: now - 5000, read: false, text: 'The hens are laying again.' };
  let letIn = false;
  const calls = { accept: [], away: [] };
  await page.route('**/post/box', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(letIn
    ? { letters: [LETTER, { id: 'kit1', from: 'kit-farm', name: 'Kit', at: now, read: false, text: 'Hello from the next plot over.' },
      { id: 'kit2', from: 'kit-farm', name: 'Kit', at: now - 9000, read: false, text: 'And a second one.' }, knock('rue1', 'rue-yard', 'Rue', 'Rue', now - 20000)], unread: 3, knocks: 1 }
    : { letters: [LETTER, knock('kit1', 'kit-farm', 'Kit', 'Kit’s Farm', now), knock('kit2', 'kit-farm', 'Kit', 'Kit’s Farm', now - 9000), knock('rue1', 'rue-yard', 'Rue', 'Rue', now - 20000)], unread: 1, knocks: 3 }) }));
  await page.route('**/post/accept', async (r) => { calls.accept.push(JSON.parse(r.request().postData() || '{}')); letIn = true; await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"n":2}' }); });
  await page.route('**/post/away', async (r) => { calls.away.push(JSON.parse(r.request().postData() || '{}')); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  const errs = await box(page, 360, 640);
  await page.waitForFunction(() => document.querySelectorAll('.tw-knock').length > 0, null, { timeout: 15000 });

  const door = await page.evaluate(() => ({
    knocks: [...document.querySelectorAll('.tw-knock')].map((k) => k.textContent),
    about: (document.querySelector('.tw-post__about') || {}).textContent || '',
    env: document.querySelectorAll('.tw-post__env').length,
    fresh: (document.querySelector('.tw-post__tab[data-drawer="fresh"] b') || {}).textContent,
    cut: [...document.querySelectorAll('.tw-knock__two button')].some((b) => b.scrollWidth > b.clientWidth + 1),
  }));
  expect(door.knocks.length, '⭐ one knock per house, however many times it knocked').toBe(2);
  expect(door.knocks[0], 'who is knocking').toContain('Kit');
  expect(door.knocks[0], 'and from which house, when it adds something').toContain('Kit’s Farm');
  expect(door.knocks[1], 'a house named for its owner is said once').not.toMatch(/Rue.*Rue/);
  expect(door.about, 'the door says what a knock is').toBe(COPY.knock.about);
  expect(door.env, 'the letter from a house you know is not held at the door').toBe(1);
  expect(door.fresh, 'Fresh counts the knocks with the post').toBe('3');
  expect(door.cut, 'neither answer is cut short').toBe(false);
  await page.screenshot({ path: 'test-results/post-knock-360.png' });

  // ── let Kit in: both letters come in to be opened, and the door answers the next time from the room
  await thumb(page, '.tw-knock[data-id="kit1"] [data-in]', 'Let in');
  // ⚠️ every path proves who is asking first, and a test page may wait out the proof's poll: wait on the door, not a clock
  await page.waitForFunction(() => document.querySelectorAll('.tw-knock').length === 1, null, { timeout: 20000 });
  expect(calls.accept.map((b) => b.id), 'the room is asked to let that house in').toEqual(['kit1']);
  expect(calls.accept[0].slug, '…by the box’s owner').toBe('ada-yard');
  const inside = await page.evaluate(() => ({ knocks: document.querySelectorAll('.tw-knock').length, env: document.querySelectorAll('.tw-post__env').length }));
  expect(inside.knocks, 'Kit is no longer at the door').toBe(1);
  expect(inside.env, 'Kit’s two letters are post now').toBe(3);

  // ── turn Rue away: gone on the tap, and said so
  await thumb(page, '.tw-knock[data-id="rue1"] [data-away]', 'Turn away');
  expect(await page.locator('.tw-knock').count(), 'the knock is gone at once').toBe(0);
  const said = await page.evaluate(() => (document.getElementById('twToast').textContent || '').trim());
  expect(said, 'the world says the knock is gone').toBe(COPY.knock.gone);
  await expect.poll(() => calls.away.map((b) => b.id), { message: 'and the room is told', timeout: 15000 }).toEqual(['rue1']);
  expect(errs).toEqual([]);
});
