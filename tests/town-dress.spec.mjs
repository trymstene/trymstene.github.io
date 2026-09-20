// 👕 THE CLOTHES SHOP AND ITS DRESSING ROOM (20 Sep 2026).
//
// Trym: "the town needs a clothes-shop where when you click on it you get a miniature version of the
// make a banana where you can dress your banana … without all the image generation buttons and buy
// buttons … just a dressing room basically."
//
// ⚠️ THE THREE THINGS THAT COULD BE QUIETLY WRONG HERE, and each is a line below:
//   · IT MUST NOT BECOME A SHOP. No price, no coin, no buy — this is the one room in the world that
//     sells nothing, and the copy gate holds the words while this holds the card.
//   · WHAT YOU WEAR IS ONE THING, EVERYWHERE. It writes `bb-last`, the key the park, the bay, the
//     homestead, the rave and the builder all read — and it must MERGE, or dressing in town would
//     quietly take off a community item caught at the rave.
//   · THE MIRROR MUST NOT SCROLL AWAY. Every other card in the town is one scrolling column; this one
//     pins the preview, because watching the banana change is the whole point.
import { test, expect } from '@playwright/test';

async function shop(page, w, h) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (w) await page.setViewportSize({ width: w, height: h });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { const p = window.__town.PROPS.clothes, t = window.__town; t.pos.x = t.tgt.x = p.x + p.w / 2; t.pos.y = t.tgt.y = p.base + 30; });
  await page.evaluate(() => window.__town.open('clothes'));
  await page.waitForFunction(() => !!document.querySelector('.tw-dress__stage canvas'), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  return errors;
}

test('the shop stands where the worksite was, and it is a door with no job behind it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.PROPS, null, { timeout: 30000 });

  const geo = await page.evaluate(() => {
    const t = window.__town;
    return { prop: t.PROPS.clothes || null, spot: t.SPOTS.clothes || null, lot: t.PROPS.lot || t.SPOTS.lot || null };
  });
  expect(geo.prop, 'the clothes shop is a baked prop').toBeTruthy();
  expect(geo.spot, 'with a door spot to walk to').toBeTruthy();
  expect(geo.lot, 'and the worksite hoarding it replaced is gone').toBeNull();
  // ⚠️ 80–90% on screen was the rule Trym gave; wholly inside the world clears it
  expect(geo.prop.x, 'the sprite starts inside the world').toBeGreaterThanOrEqual(0);
  expect(geo.prop.x + geo.prop.w, 'and ends inside it').toBeLessThanOrEqual(2200);

  // it is NOT a workplace: no boss hires for it
  const bosses = await page.evaluate(() => { try { return window.__town.work ? window.__town.work.bosses() : {}; } catch (e) { return {}; } });
  expect(Object.values(bosses), 'the dressing room is not a job — nobody may be hired here').not.toContain('clothes');
  // and no room: you do not walk into it
  const rooms = await page.evaluate(() => window.__town.rooms.keys());
  expect(rooms, 'and it is not a walk-in room either').not.toContain('clothes');
  expect(errors).toEqual([]);
});

test('the dressing room dresses the banana, and saves it where the whole world reads', async ({ page }) => {
  // ⚠️ a community item caught elsewhere, and an effect, so the merge is a real test
  await page.addInitScript(() => { try { localStorage.setItem('bb-last', JSON.stringify({ hat: 'none', glasses: 'none', extras: {}, c: 'cat-test-item', effect: 'disco' })); } catch (e) {} });
  const errors = await shop(page);

  // ⭐ MAKE A BANANA'S OWN FIVE ROWS, IN ITS OWN ORDER AND ITS OWN WORDS. Trym, 20 Sep 2026: "why
  // isnt it Shades, Hats, Body, Shoes, Extras like in the original Make A Banana for consistency?"
  // It was three — and the neckwear and the shoes were tipped into a drawer with the balloons.
  const sl = await page.evaluate(() => window.__town.dress().slots());
  expect(sl.map((s) => s.key), "the builder’s five rows, in the builder’s order").toEqual(['glasses', 'hat', 'body', 'feet', 'extras']);
  expect(await page.evaluate(() => [...document.querySelectorAll('.tw-dress__of')].map((e) => e.textContent)),
    "and the builder’s own words, which tools/check-wardrobe-rows.mjs holds to make-a-banana.astro")
    .toEqual(['Shades', 'Hat', 'Body', 'Shoes', 'Extras']);
  for (const s of sl) expect(s.n, `the ${s.key} rail has something on it`).toBeGreaterThan(1);

  const hat = await page.evaluate(() => { const b = [...document.querySelectorAll('.tw-dress__chip[data-sl="hat"]')].filter((x) => !x.classList.contains('is-locked') && x.dataset.id !== 'none')[0]; if (b) b.click(); return b ? b.dataset.id : null; });
  expect(hat, 'a hat is pickable').toBeTruthy();
  await page.waitForTimeout(300);

  // ⭐ A PICK IS A DRAFT. Trym: "theres no Confirm button at the end of the popup for UX? Its not
  // logical that the user can click outside the window and then the attire is saved." The mirror
  // changes; `bb-last` does not, until the one button at the foot of the card.
  expect(await page.evaluate(() => window.__town.dress().worn().hat), 'the mirror is wearing it').toBe(hat);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bb-last') || '{}').hat), '…and nothing is saved yet').toBe('none');
  expect(await page.evaluate(() => window.__town.dress().saved()), 'the draft is uncommitted').toBe(false);

  await page.evaluate(() => document.querySelector('#twDressOk').click());
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bb-last') || '{}'));
  expect(saved.hat, 'Step Out is what dresses the banana').toBe(hat);
  // ⭐ THE MERGE. `c` is a community item caught at the rave and this card never offers one — saving
  // here must not be able to take it off.
  expect(saved.c, 'dressing in town may not undress a rave catch').toBe('cat-test-item');
  expect(saved.effect, 'nor drop an effect this card does not own').toBe('disco');
  expect(await page.evaluate(() => document.querySelector('#twPanel').hidden), 'and the card closes behind you').toBe(true);

  // ── and the banana in the square is wearing it, not just the mirror
  const me = await page.evaluate(() => { const c = document.querySelector('.tw-me canvas'); return c ? c.toDataURL().length : 0; });
  expect(me, 'the player is drawn').toBeGreaterThan(100);

  // ── ❌ AND WALKING OUT KEEPS WHAT YOU CAME IN WEARING
  await page.evaluate(() => window.__town.open('clothes'));
  await page.waitForTimeout(500);
  await page.evaluate((id) => { const b = document.querySelector('.tw-dress__chip[data-sl="hat"][data-id="' + id + '"]'); if (b) b.click(); }, hat);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__town.dress().worn().hat), 'a second tap takes it off in the mirror').toBe('none');
  await page.evaluate(() => document.querySelector('.tw-cardx').click());
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bb-last') || '{}').hat),
    '…but closing the card without Step Out changes nothing').toBe(hat);
  expect(errors).toEqual([]);
});

// ✖️ THE CLOSE BUTTON IS ON THE RIGHT, IN EVERY CARD. Trym, 20 Sep: "why is the X for closing the
// window on the wrong side of the popup?" It was `float: right`, which does nothing to a flex item —
// and this card is the one that makes the card a flex column, so the ✖ dropped to the left.
test('the close button is on the right of the card', async ({ page }) => {
  await shop(page, 360, 640);
  const m = await page.evaluate(() => {
    const x = document.querySelector('.tw-cardx').getBoundingClientRect();
    const c = document.querySelector('.tw-card').getBoundingClientRect();
    // ⚠️ THE TEXT'S OWN BOX, NOT THE HEADING'S. An h2 is a block and spans the whole card whatever its
    // padding, so its rect always reaches the ✖ — the question is whether the WORDS do.
    const h2 = document.querySelector('.tw-dress h2');
    const rng = document.createRange(); rng.selectNodeContents(h2);
    const h = rng.getBoundingClientRect();
    return { xMid: x.left + x.width / 2, cardMid: c.left + c.width / 2, cardRight: c.right, headRight: h.right, xLeft: x.left, pad: parseFloat(getComputedStyle(h2).paddingRight) };
  });
  expect(m.xMid, 'the ✖ sits in the right half of the card').toBeGreaterThan(m.cardMid);
  expect(m.cardRight - m.xMid, '…and up against its right edge').toBeLessThan(30);
  expect(m.headRight, 'the heading’s words keep clear of it').toBeLessThanOrEqual(m.xLeft + 1);
  expect(m.pad, '…and the heading reserves room for it whatever the title says').toBeGreaterThan(18);
});

// 📱 the card is 261 × 440 at the narrowest phone the house supports, and everything has to sit in it
for (const [w, h] of [[360, 640], [393, 852]]) {
  test(`the dressing room holds together at ${w}×${h}`, async ({ page }) => {
    const errors = await shop(page, w, h);
    const m = await page.evaluate(() => {
      const card = document.querySelector('.tw-card'), body = document.getElementById('twCardBody');
      const stage = document.querySelector('.tw-dress__stage'), rails = document.querySelector('.tw-dress__rails');
      const r = (e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, top: b.top, bot: b.bottom }; };
      return {
        cardScroll: card.scrollHeight - card.clientHeight,
        bodyOverflowX: body.scrollWidth - body.clientWidth,
        stage: r(stage), rails: r(rails), card: r(card),
        chips: [...document.querySelectorAll('.tw-dress__chip')].map((c) => { const b = c.getBoundingClientRect(); return { w: b.width, h: b.height }; }),
        blank: [...document.querySelectorAll('.tw-dress__art')].filter((e) => !e.classList.contains('is-none') && !e.style.backgroundImage).length,
      };
    });
    // ⭐ the mirror is PINNED: the card itself never scrolls, only the rails inside it
    expect(m.cardScroll, 'the card does not scroll — the mirror cannot be scrolled away').toBeLessThanOrEqual(1);
    expect(m.bodyOverflowX, 'and nothing runs off the side of it').toBeLessThanOrEqual(0);
    expect(m.stage.top, 'the mirror sits inside the card').toBeGreaterThanOrEqual(m.card.top - 1);
    expect(m.rails.bot, 'and the rails end inside it too').toBeLessThanOrEqual(m.card.bot + 1);
    // ⚠️ 44px is the floor for a rail of many small targets, not the 34px of a single row button
    for (const c of m.chips) { expect(c.w, 'a chip is a thumb target').toBeGreaterThanOrEqual(44); expect(c.h).toBeGreaterThanOrEqual(44); }
    // ⚠️ every chip has its picture: a wearable's art is keyed three different ways and a miss is silent
    expect(m.blank, 'every chip that should have a picture has one').toBe(0);
    expect(errors).toEqual([]);
  });
}
