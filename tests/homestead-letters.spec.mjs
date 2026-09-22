// ✉️🏡 LETTERS AT YOUR OWN MAILBOX (21 Sep 2026) — and since 22 Sep ONE mailbox.
//
// Trym: *"only letters in the mailbox at the homestead — the post office in town can send post
// cards"*, which is the plan's own split (docs/town-jobs-plan.md §6). And on 22 Sep: *"so you always
// see the fresh letters youve received from anyone, users and residents"* — so the world's own notes
// (Nib's big book, the payslips, a boss's letter) are in the same drawers as a neighbour's letter, and
// the old cream card with a door at its foot to "the post other players sent" is gone.
//
// Three things can only be proven by looking:
//   · the card renders at all on a page that is not the town (`.tw-card` lives in /css/world-card.css).
//   · no postcard button here, because a postcard is made where the pictures are.
//   · and no POST OFFICE line here either — at your own mailbox there is no building to describe.
import { test, expect } from '@playwright/test';

const FOLK = [
  { slug: 'ada-orchard', house: 'Ada Orchard', n: 'Ada', fit: { hat: 'tophat', glasses: 'shades', extras: {} } },
  { slug: 'bo-bottom', house: 'Bo Bottom', n: 'Bo', fit: { hat: 'strawhat', glasses: 'none', extras: {} } },
];
const NOTE = {
  id: 'n1', from: 'moss', name: 'Moss', at: Date.now(), read: false, kind: 'note', note: 'fixed',
  text: 'New sign up. It stays bright against the wet cobbles.', card: null,
};

test('one mailbox at home: a resident’s note and the world’s own notes in the same drawer, and no postcards', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/yards/folk*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ folk: FOLK }) }));
  await page.route('**/post/box', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ letters: [NOTE], unread: 1, knocks: 0 }) }));
  await page.route('**/post/read', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.post, null, { timeout: 30000 });
  // ⚠️ a mailbox is keyed to the SERVER slug, and ?hstest scenarios claim a yard locally without
  // one — so without this the walk only ever sees the world's own notes, never the post room's.
  await page.evaluate(() => window.__hs.slug('my-yard'));
  await page.waitForTimeout(400);

  // ── the mailbox opens straight onto the letters card: there is no second door any more
  await page.evaluate(() => window.__hs.post());
  await page.waitForFunction(() => {
    const c = document.querySelector('#hsLetters');
    return c && !c.hidden && document.querySelector('#hsLetters .tw-post__env[data-id="n1"]');
  }, null, { timeout: 20000 });
  const seen = await page.evaluate(() => {
    const c = document.querySelector('#hsLetters');
    const card = c.querySelector('.tw-card'), r = card.getBoundingClientRect();
    const out = [];
    c.querySelectorAll('*').forEach((e) => { const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 1 || q.left < r.left - 1)) out.push(e.className); });
    const env = [...c.querySelectorAll('.tw-post__grid .tw-post__env')];
    return {
      styled: getComputedStyle(card).backgroundColor,
      drawer: window.__hs.card().state().drawer,
      room: env.filter((e) => !e.dataset.id.startsWith('w:')).map((e) => e.textContent),
      world: env.filter((e) => e.dataset.id.startsWith('w:')).length,
      text: (c.querySelector('.tw-post') || {}).textContent || '',
      write: !!c.querySelector('#twPostNew'),
      postcard: !!c.querySelector('#twPostCard'),
      overflow: out, sideways: card.scrollWidth - card.clientWidth,
      onScreen: r.top >= -1 && r.bottom <= innerHeight + 1,
    };
  });
  expect(seen.styled, 'it wears the world card, not an unstyled box').toBe('rgb(26, 18, 12)');
  expect(seen.drawer, 'and opens on Fresh').toBe('fresh');
  // ⭐ the ask itself: fresh post from anyone, in one place
  expect(seen.room.join(' '), 'the resident’s note from the post room is in Fresh').toContain('Moss');
  expect(seen.world, '…beside the world’s own notes, sealed the same way').toBeGreaterThan(0);
  expect(seen.write, 'and the way to write one is here too').toBe(true);
  // ⭐ the two that make this the HOMESTEAD's mailbox rather than a copy of the counter
  expect(seen.postcard, 'a postcard is made at the post office, never here').toBe(false);
  expect(seen.text, 'and the post office does not describe itself at your own house').not.toContain('post office');
  expect(seen.overflow, 'nothing breaks out of the card').toEqual([]);
  expect(seen.sideways, 'and it never scrolls sideways').toBe(0);
  expect(seen.onScreen, 'the whole card fits a 360×640 phone').toBe(true);
  await page.screenshot({ path: 'test-results/homestead-letters-360.png' });

  // ── a world note opens on its own paper inside the same card, and back comes back to the drawer
  await page.locator('#hsLetters .tw-post__env[data-id^="w:"]').first().click();
  await page.waitForSelector('#hsLetters .tw-post__world .bw-paper', { timeout: 5000 });
  const paper = await page.evaluate(() => {
    const p = document.querySelector('#hsLetters .tw-post__world .bw-paper');
    return { font: getComputedStyle(p).fontFamily, text: p.textContent };
  });
  expect(paper.font, 'in the world’s own hand').toContain('Caveat');
  expect(paper.text, 'with every placeholder filled').not.toContain('{');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/homestead-letters-world-note.png' });
  await page.click('#twPostBack');
  await page.waitForTimeout(250);
  expect(await page.locator('#hsLetters .tw-post__tab[data-drawer="kept"] b').textContent(), 'and it is filed in Kept').toBe('1');

  // ── and the address book reaches the same people from here
  const w = await page.locator('#twPostNew').boundingBox();
  await page.mouse.click(w.x + w.width / 2, w.y + w.height / 2);
  await page.waitForTimeout(1200);
  expect(await page.locator('.tw-folk__row').count(), 'the address book opens at the homestead').toBe(FOLK.length);
  expect(errs, 'nothing threw').toEqual([]);
});

// 🏡 THE WORLD'S NOTES DO NOT WAIT ON THE POST ROOM. Offline, or with no address yet, Nib's letters and the
// payslips live in the yard and are still yours to read — only the write door waits for the room.
test('offline, the world’s own notes still show, and the write door waits', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/post/**', (r) => r.abort());
  await page.goto('/homestead/?hstest=claimed', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.post, null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.slug('my-yard'));
  await page.evaluate(() => window.__hs.post());
  await page.waitForFunction(() => { const c = document.querySelector('#hsLetters'); return c && !c.hidden && document.querySelector('#hsLetters .tw-post__env'); }, null, { timeout: 20000 });
  await page.waitForTimeout(4500);   // the room's answer (a refusal) has landed by now
  const st = await page.evaluate(() => ({
    world: document.querySelectorAll('#hsLetters .tw-post__env[data-id^="w:"]').length,
    write: !!document.querySelector('#hsLetters #twPostNew'),
    shut: !!document.querySelector('#hsLetters .tw-post__none'),
  }));
  expect(st.world, 'the notes are still in Fresh').toBeGreaterThan(0);
  expect(st.shut, 'and no closed-counter line stands over them').toBe(false);
  expect(st.write, 'the write door waits for the room').toBe(false);
  expect(errs, 'nothing threw').toEqual([]);
});
