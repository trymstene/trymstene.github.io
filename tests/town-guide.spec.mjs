// 📖 THE TOWN EXPLAINS ITSELF UNDER ITS FRAME (25 Sep 2026, design library §37). Trym: "all other areas have a concrete
// explanation of what you can do in the area underneath its game-frame - the Banana Town page doesnt have this yet …
// and dont give it all away". And: "Nib shouldnt be part of the top description … Banana Town isnt all about Nib".
// Walked on the BUILT page: the line under the sign, the five blocks, every picture loaded and filling its box at whole
// pixels, the questions the search engines read being the questions on the page, and no sideways scroll on a phone.
import { test, expect } from '@playwright/test';
import GUIDE from '../src/data/copy/town-guide.json' with { type: 'json' };
import PAGE from '../src/data/copy/town-page.json' with { type: 'json' };
import { TOWN_NAMES } from '../tools/copy-jobs.mjs';

async function guide(page) {
  // the story's first scene owns the screen on a first visit (design library §31); this walk reads the page under it
  await page.addInitScript(() => { try { localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); } catch (e) {} });
  await page.goto('/town/', { waitUntil: 'domcontentloaded' });
  await page.locator('#guide').scrollIntoViewIfNeeded();
  // every picture is lazy: walk the guide through the viewport so each one is asked for
  for (const id of ['#what', '#do', '#rumours', '#faq', '#roads']) { await page.locator(id).scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
  await page.waitForFunction(() => [...document.querySelectorAll('#guide img')].every((i) => i.complete), null, { timeout: 15000 });
}

test('the line under the sign is the whole town’s, and names nobody', async ({ page }) => {
  await page.goto('/town/', { waitUntil: 'domcontentloaded' });
  const tag = (await page.locator('.tw-tag').textContent()).trim();
  expect(tag).toBe(PAGE.tag);
  for (const who of TOWN_NAMES) expect(tag.toLowerCase(), `the tag names ${who}`).not.toContain(who.toLowerCase());
});

test('the guide: what the town is, what you do, what nobody explains, the questions, the roads out', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await guide(page);
  // a card per place, a line per oddity, a door per road — the words the copy file holds, in its order
  expect(await page.locator('#do .ag__card h3').allTextContents()).toEqual(Object.values(GUIDE.do.cards).map((c) => c.name));
  expect(await page.locator('#rumours .ag__odd li').count()).toBe(Object.keys(GUIDE.rumours.items).length);
  expect(await page.locator('#roads .bb-door').count()).toBe(Object.keys(GUIDE.roads.lines).length);
  // the {gif} hole is filled with a link, never printed
  const what = await page.locator('#what').innerText();
  expect(what).not.toContain('{');
  await expect(page.locator('#what a[href="/dancing-banana-gif-meme/"]')).toHaveText(GUIDE.what.gif);
  // every picture arrived
  const broken = await page.evaluate(() => [...document.querySelectorAll('#guide img')].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
  expect(broken, 'a guide picture did not load').toEqual([]);
  expect(errors).toEqual([]);
});

test('a window is whole pixels and fills its box, on a phone and on a desk', async ({ page }) => {
  for (const vp of [{ width: 360, height: 780 }, { width: 393, height: 852 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(vp);
    await guide(page);
    const wins = await page.evaluate(() => [...document.querySelectorAll('#guide img.ag__win')].map((i) => {
      const r = i.getBoundingClientRect(), s = getComputedStyle(i);
      return { src: i.getAttribute('src'), fit: s.objectFit, w: Math.round(r.width), h: Math.round(r.height), nw: i.naturalWidth, nh: i.naturalHeight };
    }));
    expect(wins.length).toBeGreaterThan(8);
    for (const w of wins) {
      // object-fit: none — the picture is never scaled, only cropped (design library §6)
      expect(w.fit, `${w.src} is scaled to its box`).toBe('none');
      // …and the box never outgrows it: a picture narrower than its card showed dark bars down both sides
      expect(w.w, `${w.src} at ${vp.width}px: a ${w.w}px box round a ${w.nw}px picture`).toBeLessThanOrEqual(w.nw);
      expect(w.h, `${w.src} at ${vp.width}px: a ${w.h}px box round a ${w.nh}px picture`).toBeLessThanOrEqual(w.nh);
    }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `the page scrolls sideways at ${vp.width}px`).toBe(0);
  }
});

test('the questions the search engines read are the questions on the page', async ({ page }) => {
  await page.goto('/town/', { waitUntil: 'domcontentloaded' });
  const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((d) => d['@type'] === 'FAQPage'));
  expect(ld, 'no FAQPage on the town').toBeTruthy();
  const shown = await page.evaluate(() => [...document.querySelectorAll('#faq dt')].map((dt) => [dt.textContent.trim(), dt.nextElementSibling.textContent.trim()]));
  expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(shown);
  expect(shown.length).toBe(GUIDE.faq.items.length);
});
