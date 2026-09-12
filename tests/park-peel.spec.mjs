// 🔒 OLD PEEL SAYS WHAT THE COPY FILE SAYS — the park's half of the locked-copy rule.
//
// His dialogue is the one part of src/data/copy that Trym wrote himself (13 Sep 2026:
// "ive already optimized old peels dialogue myself, no need to change it"). The rig is
// stopped from rewriting it by the lock in tools/copy-jobs.mjs, which tools/check-copy.mjs
// proves every run. This is the OTHER half, the one a gate cannot reach: that the words in
// the file are the words a player actually gets on screen.
//
// CLAUDE.md: a rule that cannot be grepped is covered by an assertion in that area's walk.
// This is that assertion. It fails if the wiring is cut, if a phase band stops following
// the park's health, or if the weather lines stop reaching him.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const COPY = JSON.parse(readFileSync(new URL('../src/data/copy/park-npcs.json', import.meta.url), 'utf8'));
const PEEL = COPY.peel;
const topic = (id) => PEEL.topics.find((t) => t.id === id);

// the park's view is a letterboxed box inside the page, and #pkWorld is scaled inside
// that, so a world coordinate reaches the screen only through the DOM itself
async function ready(page, query) {
  await page.goto('/park/' + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__park, null, { timeout: 30000 });
  await page.waitForSelector('.pk-old canvas', { timeout: 30000 });
  await page.waitForTimeout(2500);          // engines, first spawns, the garden shim
  await page.evaluate(() => {
    window.__w2s = (x, y) => {
      const w = document.getElementById('pkWorld');
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;width:0;height:0;left:' + (x / 2760 * 100) + '%;top:' + (y / 1100 * 100) + '%';
      w.appendChild(d);
      const r = d.getBoundingClientRect(); d.remove();
      return { x: Math.round(r.left), y: Math.round(r.top) };
    };
  });
}
// stand him at the bench, then tap Old Peel — no cross-park walk to go flaky
async function openPeel(page) {
  await page.evaluate(() => window.__park.warp(1583, 768));
  await page.waitForTimeout(400);
  for (let i = 0; i < 12; i++) {
    const p = await page.evaluate(() => window.__w2s(1583, 700));
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(400);
    if (await page.evaluate(() => !document.getElementById('pkOldPanel').hidden)) return true;
  }
  return false;
}
const ask = async (page, id) => {
  const i = PEEL.topics.findIndex((t) => t.id === id);
  await page.click(`#pkOldQs button:nth-child(${i + 1})`);
  await page.waitForTimeout(150);
  await page.click('#pkOldBox');                       // a tap skips the typing
  await page.waitForTimeout(200);
  return page.evaluate(() => document.getElementById('pkOldBoxText').textContent);
};

test('Old Peel greets with the copy file, and his deck is the file’s questions', async ({ page }) => {
  await ready(page, '?parktest&phase=0');
  expect(await openPeel(page), 'his card opened').toBe(true);
  expect(await page.textContent('#pkOldLine')).toBe(PEEL.greet);
  expect(await page.locator('#pkOldQs button').allTextContents()).toEqual(PEEL.topics.map((t) => t.q));
});

test('his answers follow the park’s health, and his life steps its beats', async ({ page }) => {
  await ready(page, '?parktest&phase=0');
  await openPeel(page);
  expect(await ask(page, 'park')).toBe(topic('park').byPhase[0]);

  await page.click('#pkOldBox');                       // back to the deck
  await page.waitForTimeout(200);
  const seq = topic('lore').seq;
  expect(await ask(page, 'lore')).toBe(seq[0]);
  await page.click('#pkOldBox'); await page.waitForTimeout(150);
  await page.click('#pkOldBox'); await page.waitForTimeout(200);
  expect(await page.textContent('#pkOldBoxText')).toBe(seq[1]);

  // the same question, the park at its best: a different answer, and the file's
  await page.evaluate(() => document.getElementById('pkOldClose').click());
  await page.evaluate(() => window.__park.setPhase(4));
  await page.waitForTimeout(400);
  await openPeel(page);
  const best = await ask(page, 'park');
  expect(best).toBe(topic('park').byPhase[4]);
  expect(best).not.toBe(topic('park').byPhase[0]);
});

test('goodbye says the file’s line and closes the card', async ({ page }) => {
  await ready(page, '?parktest&phase=0');
  await openPeel(page);
  expect(await ask(page, 'bye')).toBe(topic('bye').byPhase[0]);
  await page.waitForTimeout(2400);
  expect(await page.locator('#pkOldPanel').isHidden()).toBe(true);
});

// 🌦 the lines that lived in park-npc.js until 13 Sep and are now locked copy like the rest
test('the weather takes over his bench mutter, from the copy file', async ({ page }) => {
  await ready(page, '?parktest&phase=4');
  await page.evaluate(() => window.__park.warp(1583, 768));   // he only speaks when seen
  await page.waitForTimeout(1200);
  for (const tier of ['drizzle', 'heavy', 'storm']) {
    await page.evaluate((t) => window.__park.wx(t), tier);
    await page.waitForTimeout(900);
    const said = await page.textContent('.pk-oldsay');
    expect(PEEL.wx[tier].some((l) => said.includes(l)), `${tier}: "${said}" is not one of his ${tier} lines`).toBe(true);
  }
  await page.evaluate(() => window.__park.wx(null));
});
