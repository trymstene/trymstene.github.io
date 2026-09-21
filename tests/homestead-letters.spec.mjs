// ✉️🏡 LETTERS AT YOUR OWN MAILBOX (21 Sep 2026).
//
// Trym: *"only letters in the mailbox at the homestead — the post office in town can send post
// cards"*, which is the plan's own split (docs/town-jobs-plan.md §6) and the one I had built wrong:
// everything, letters and postcards both, lived at the counter in town.
//
// It is ONE mailbox with two doors — the same letters, the same address book, the same paper — so
// the module is shared and told where it is standing (`at: 'home' | 'post'`) rather than handed a
// list of flags. Three things can only be proven by looking:
//   · the card renders at all on a page that is not the town. `.tw-card` was defined INLINE in
//     town.astro, so the homestead's copy would have been an unstyled div; the chrome was lifted
//     into /css/world-card.css for this, the way dialogue was lifted into /css/dialogue.css.
//   · no postcard button here, because a postcard is made where the pictures are.
//   · and no POST OFFICE line here either — "the post office keeps your letters in its mailbox" is
//     a line about a building, and at your own mailbox there is no building to describe. It was
//     rendering, and it was also 38 px of a card that has to fit a phone.
import { test, expect } from '@playwright/test';

const FOLK = [
  { slug: 'ada-orchard', house: 'Ada Orchard', n: 'Ada', fit: { hat: 'tophat', glasses: 'shades', extras: {} } },
  { slug: 'bo-bottom', house: 'Bo Bottom', n: 'Bo', fit: { hat: 'strawhat', glasses: 'none', extras: {} } },
];
const NOTE = {
  id: 'n1', from: 'moss', name: 'Moss', at: Date.now(), read: false, kind: 'note',
  text: 'New sign up. It stays bright against the wet cobbles.', card: null,
};

test('letters at your own mailbox, and no postcards', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/yards/folk*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ folk: FOLK }) }));
  await page.route('**/post/box*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ letters: [NOTE], unread: 1 }) }));
  await page.route('**/post/read*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.post, null, { timeout: 30000 });
  // ⚠️ a mailbox is keyed to the SERVER slug, and ?hstest scenarios claim a yard locally without
  // one — so without this the walk only ever sees the "you have no address yet" card, which is a
  // different screen doing its job correctly.
  await page.evaluate(() => window.__hs.slug('my-yard'));
  await page.waitForTimeout(400);

  // ── the door, at the foot of the mailbox the world writes to
  await page.evaluate(() => window.__hs.post());
  await page.waitForTimeout(500);
  const door = await page.evaluate(() => {
    const b = document.querySelector('.hs-post__door');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { label: (b.textContent || '').trim(), onScreen: r.bottom <= innerHeight + 1 && r.top >= 0, tall: Math.round(r.height) };
  });
  expect(door, 'the mailbox offers a way through to your letters').not.toBeNull();
  expect(door.label.length, 'and it is labelled').toBeGreaterThan(3);
  expect(door.onScreen, 'and a thumb can actually reach it').toBe(true);
  expect(door.tall, 'at a real tap size').toBeGreaterThanOrEqual(44);

  // ── the letters card itself
  const b = await page.locator('.hs-post__door').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(1500);
  const seen = await page.evaluate(() => {
    const c = document.querySelector('#hsLetters');
    if (!c || c.hidden) return null;
    const card = c.querySelector('.tw-card'), r = card.getBoundingClientRect();
    const out = [];
    c.querySelectorAll('*').forEach((e) => { const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) out.push(e.className); });
    return {
      styled: getComputedStyle(card).backgroundColor,
      from: (c.querySelector('.tw-post__who') || {}).textContent || '',
      text: (c.querySelector('.tw-post') || {}).textContent || '',
      write: !!c.querySelector('#twPostNew'),
      postcard: !!c.querySelector('#twPostCard'),
      overflow: out, sideways: card.scrollWidth - card.clientWidth,
      onScreen: r.top >= -1 && r.bottom <= innerHeight + 1,
    };
  });
  expect(seen, 'the letters card opens at the homestead').not.toBeNull();
  // ⚠️ the chrome came from /css/world-card.css — an unstyled div would be transparent
  expect(seen.styled, 'and it wears the world card, not an unstyled box').toBe('rgb(26, 18, 12)');
  expect(seen.from, 'the post is in it').toContain('Moss');
  expect(seen.write, 'and the way to write one is here too').toBe(true);
  // ⭐ the two that make this the HOMESTEAD's mailbox rather than a copy of the counter
  expect(seen.postcard, 'a postcard is made at the post office, never here').toBe(false);
  expect(seen.text, 'and the post office does not describe itself at your own house').not.toContain('post office');
  expect(seen.overflow, 'nothing breaks out of the card').toEqual([]);
  expect(seen.sideways, 'and it never scrolls sideways').toBe(0);
  expect(seen.onScreen, 'the whole card fits a 360×640 phone').toBe(true);

  // ── and the address book reaches the same people from here
  const w = await page.locator('#twPostNew').boundingBox();
  await page.mouse.click(w.x + w.width / 2, w.y + w.height / 2);
  await page.waitForTimeout(1200);
  expect(await page.locator('.tw-folk__row').count(), 'the address book opens at the homestead').toBe(FOLK.length);
  expect(errs, 'nothing threw').toEqual([]);
});
