// 🏡 THE FRONT PAGE'S HOMESTEADS (29 Sep 2026). Trym: "they all look the same … probably all are very early snapshots of
// users homesteads and they all look empty … maybe it could look nicer with 4 updated homesteads, or most active ones so you
// see their content, and underneath is more stickerpills of other homesteads … shuffled amongst active homesteads so we dont
// show lots of inactive ones on the frontpage".
//
// The pick (tools/yard-pick.mjs) is held here without a browser; the photos are the deploy's (tools/build-yard-cards.mjs);
// the page is walked at a phone and a desktop. Design library §50.
import { test, expect } from '@playwright/test';
import YARDS from '../src/data/yard-cards.json' with { type: 'json' };
import { activeRows, dayOrder, morePills, shown, CAME_BACK } from '../tools/yard-pick.mjs';

const NOW = Date.UTC(2026, 8, 29, 12);
const H = 3600e3, D = 864e5;
const row = (slug, o = {}) => ({ slug, name: slug, stage: 2, created: NOW - 9 * D, updated: NOW - 2 * H, owner: 'o-' + slug, qa: 0, ...o });
const doc = (slug, o = {}) => ({ slug, name: slug, stage: 2, items: [{}, {}, {}], animals: [{}, {}], soil: [], fence: [], ...o });

test('the pick: only real yards that are lived in and were saved lately', () => {
  const list = [
    row('kept'),
    row('testy-proof-b-1'), row('trym-stene'), row('qa-walk'), row('proofy'), row('flagged', { qa: 1 }),
    row('tent-only', { stage: 0 }),
    row('gone-quiet', { updated: NOW - 15 * D }),
    row('one-sitting', { created: NOW - 3 * H, updated: NOW - 3 * H + CAME_BACK - 60e3 }),
  ];
  expect(activeRows(list, NOW).map((e) => e.slug)).toEqual(['kept']);
});

test('the pick: one yard per owner, the same order all day, a new one the next', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => ({ e: row(s), d: doc(s) }));
  rows.push({ e: row('a2', { owner: 'o-a' }), d: doc('a2', { items: new Array(30).fill({}) }) });   // a's second yard, fuller
  const one = dayOrder(rows, '2026-09-29', NOW);
  expect(one.map((y) => y.slug)).toContain('a2');
  expect(one.map((y) => y.slug), 'one per owner: the fuller yard stands for it').not.toContain('a');
  expect(dayOrder(rows, '2026-09-29', NOW).map((y) => y.slug), 'every deploy that day agrees').toEqual(one.map((y) => y.slug));
  const week = new Set(Array.from({ length: 7 }, (_, i) => dayOrder(rows, '2026-10-0' + (i + 1), NOW).slice(0, 4).map((y) => y.slug).join()));
  expect(week.size, 'the four change from day to day').toBeGreaterThan(3);
});

test('the pick: the fuller and fresher yard comes up more days, and the thin one still gets its turn', () => {
  const rows = [
    { e: row('rich'), d: doc('rich', { stage: 3, items: new Array(40).fill({}), animals: new Array(10).fill({}) }) },
    { e: row('stale', { updated: NOW - 12 * D }), d: doc('stale') },
    ...['p', 'q', 'r', 's', 't'].map((s) => ({ e: row(s), d: doc(s) })),
  ];
  const days = Array.from({ length: 60 }, (_, i) => new Date(NOW + i * D).toISOString().slice(0, 10));
  const top4 = (slug) => days.filter((d) => dayOrder(rows, d, NOW).slice(0, 4).some((y) => y.slug === slug)).length;
  expect(top4('rich')).toBeGreaterThan(50);
  expect(top4('stale')).toBeGreaterThan(0);
  expect(top4('stale')).toBeLessThan(top4('p') + 10);
});

test('the pick: names as the page prints them, and never the same name twice', () => {
  expect(shown("KiwiRainbowRain's Homest"), 'the 24-letter cap cut the default name mid-word').toBe('KiwiRainbowRain’s Homestead');
  expect(shown("Cyanide Banana's Homeste")).toBe('Cyanide Banana’s Homestead');
  expect(shown("Djcookie's Home"), 'a real word stays').toBe('Djcookie’s Home');
  expect(shown('𝐃𝐉𝐂𝐎𝐎𝐊𝐈𝐄'), 'the one name rule').toBe('DJCOOKIE');
  const order = [{ slug: 'x', name: 'My Homestead' }, { slug: 'y', name: 'My Homestead' }, { slug: 'z', name: 'Be’s Place' }, { slug: 'w', name: 'my homestead' }];
  expect(morePills(order, [{ slug: 'z', name: 'Be’s Place' }], 12).map((y) => y.slug)).toEqual(['x']);
});

for (const [w, h] of [[1280, 900], [393, 852], [360, 740]]) {
  test(`the front page shows the photographed homesteads and the pills (${w}×${h})`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.route(/workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/, (r) => r.abort());
    await page.goto('/');
    await page.locator('.bwl-yards').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelectorAll('.bwl-yard img').forEach((i) => { i.loading = 'eager'; }));
    await page.waitForFunction(() => [...document.querySelectorAll('.bwl-yard img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });

    expect(YARDS.featured.length, 'two to four photos').toBeGreaterThanOrEqual(2);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.bwl-yard')].map((a) => {
      const r = a.getBoundingClientRect(), tag = a.querySelector('.bwl-yard__tag'), name = tag.querySelector('span'), go = a.querySelector('.bwl-yard__go');
      const t = tag.getBoundingClientRect(), g = go.getBoundingClientRect(), img = a.querySelector('img');
      return { href: a.getAttribute('href'), name: name.textContent, cut: name.scrollWidth > name.clientWidth + 1, x: r.left, top: r.top, w: r.width,
        clear: t.bottom < g.top || t.right < g.left, inside: t.left >= r.left && t.right <= r.right && g.right <= r.right && g.bottom <= r.bottom,
        ratio: img.naturalWidth / img.naturalHeight, alt: img.alt };
    }));
    expect(cards.map((c) => c.href)).toEqual(YARDS.featured.map((y) => `/homestead/${y.slug}/`));
    for (const [i, c] of cards.entries()) {
      expect(c.name, 'the tag names the yard').toBe(YARDS.featured[i].name);
      expect(c.cut, `"${c.name}" is whole on its tag`).toBe(false);
      expect(c.clear && c.inside, `"${c.name}": the tag and the visit button sit apart, inside the photo`).toBe(true);
      expect(Math.abs(c.ratio - 4 / 3), 'a 4:3 photo').toBeLessThan(0.01);
      expect(c.alt).toContain(YARDS.featured[i].name);
    }
    if (w >= 700) {
      expect(cards[1].top, 'two photos to a row on a desktop').toBe(cards[0].top);
      expect(cards[0].w, 'big enough to see what is in them').toBeGreaterThan(400);
    } else {
      expect(cards[1].top, 'one photo to a row on a phone').toBeGreaterThan(cards[0].top + 100);
      expect(cards[0].w).toBeGreaterThan(w - 60);
    }

    const pills = await page.evaluate(() => [...document.querySelectorAll('.bwl-pill')].map((a) => {
      const s = a.querySelector('span'), r = a.getBoundingClientRect();
      return { href: a.getAttribute('href'), text: s.textContent, cut: s.scrollWidth > s.clientWidth + 1, h: a.offsetHeight, right: r.right, left: r.left };
    }));
    expect(pills.map((p) => p.href), 'the pills, then the plot to claim').toEqual([...YARDS.more.map((y) => `/homestead/${y.slug}/`), '/homestead/']);
    for (const p of pills) {
      expect(p.cut, `"${p.text}" is whole`).toBe(false);
      expect(p.h, `"${p.text}" never breaks onto two lines`).toBeLessThan(44);
      expect(p.left >= 0 && p.right <= w, `"${p.text}" stays on screen`).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'nothing pushes the page sideways').toBeLessThanOrEqual(w);
    const words = await page.evaluate(() => [...document.querySelectorAll('.bwl-yards, .bwl-yards-more')].map((e) => e.textContent).join(' '));
    expect(/\p{Extended_Pictographic}/u.test(words.replace(/[→+]/g, '')), 'pixel icons, never an OS emoji').toBe(false);

    await page.addStyleTag({ content: '.nav, .skip-link { visibility: hidden !important; }' });   // the sticky header paints over a full-page shot
    await page.screenshot({ path: `test-results/home-yards-${w}.png`, fullPage: true, clip: await page.evaluate(() => {
      const a = document.querySelector('.bwl-yards'), b = document.querySelector('.bwl-yards-more');
      const top = a.getBoundingClientRect().top + scrollY - 90, bottom = b.getBoundingClientRect().bottom + scrollY + 20;
      return { x: 0, y: top, width: innerWidth, height: bottom - top };
    }) });
    expect(errs).toEqual([]);
  });
}
