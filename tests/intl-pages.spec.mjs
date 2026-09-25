// 🌍 THE LANGUAGE PAGES (25 Sep 2026). Trym: "upgrade all international pages … extend the FAQs … bring in sticker-packs
// … update the Banana World link - add thumbnails of the areas … add more big languages that probably searches for the
// banana". Every language page, on the built site: its own words in the title, snippet and h1, the whole hreflang mesh,
// the FAQ on the page and in the schema one for one, the four downloads, the builder, the eight packs and the carousel in
// its language, five windows into the world and the one entrance (Banana Town), the story, the remixes, no mark or hole
// left raw, and the download card speaking the page's language.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LOCALES, LANG_LINKS } from '../src/data/locale-codes.js';

const words = (code) => JSON.parse(readFileSync(new URL(`../src/data/copy/locale-${code}.json`, import.meta.url), 'utf8'));
const plainOf = (s) => String(s).replace(/\s*\[[^\]]+\]\(\w+\)\s*$/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\[([^\]]+)\]\(\w+\)/g, '$1');
const SHOTS = { nl: [393, 1280], ja: [393], pl: [393], es: [1280], ko: [393] };

for (const { code } of LOCALES) {
  test(`/${code}/ carries its own words, the world, the packs and a FAQ the schema matches`, async ({ page }) => {
    const W = words(code);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.route('**/arcade/**', (r) => r.abort());
    const res = await page.goto(`/${code}/`, { waitUntil: 'domcontentloaded' });
    expect(res.status()).toBe(200);
    expect(await page.getAttribute('html', 'lang')).toBe(code);
    expect(await page.title()).toBe(W.meta.title);
    expect(await page.getAttribute('meta[name="description"]', 'content')).toBe(W.meta.description);
    expect((await page.innerText('h1')).replace(/\s+/g, ' ').trim()).toBe(W.hero.h1.join(' '));

    // the mesh: every language and the English hub, plus x-default
    const alt = await page.$$eval('link[rel="alternate"][hreflang]', (ls) => ls.map((l) => [l.hreflang, l.getAttribute('href')]));
    expect(alt.length, 'one alternate per language + x-default').toBe(LANG_LINKS.length + 1);
    for (const l of LANG_LINKS) expect(alt).toContainEqual([l.code, 'https://trymstene.com' + l.href]);

    // the FAQ, on the page and in the schema, one for one
    const schemas = await page.$$eval('script[type="application/ld+json"]', (ss) => ss.map((s) => JSON.parse(s.textContent)));
    const faq = schemas.find((s) => s['@type'] === 'FAQPage');
    expect(faq.mainEntity.length).toBe(W.faq.items.length);
    expect(faq.mainEntity.map((q) => q.name)).toEqual(W.faq.items.map((f) => plainOf(f.q)));
    expect(await page.locator('#faq .faq__item').count()).toBe(W.faq.items.length);
    expect(schemas.some((s) => s['@type'] === 'ImageObject' && s.inLanguage === code && s.license)).toBe(true);

    // four downloads, named in this language
    const dl = await page.$$eval('#download .dl-buttons a[download]', (as) => as.map((a) => a.getAttribute('download')));
    expect(dl).toEqual([W.download.files.original, W.download.files.transparentGif, W.download.files.transparentPng, W.download.files.hd]);

    // the builder, the packs and the carousel in this language
    await expect(page.locator('#make a[href="/make-a-banana/"]')).toHaveText(new RegExp(W.make.cta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expect(await page.locator('#sticker-packs .pk-card').count()).toBe(8);
    await expect(page.locator('#sticker-packs .pkgrid__note')).toHaveText(W.packs.note);
    await expect(page.locator('.gifhero__packs .pkc__num').first()).toContainText(W.packs.count);

    // five windows into the world, each a real picture, and the one entrance: Banana Town
    const doors = page.locator('#world .bb-door');
    expect(await doors.count()).toBe(5);
    expect(await doors.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/town/', '/rave/', '/park/', '/beach/', '/homestead/']);
    await page.locator('#world').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('#world .bb-door img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 });
    await expect(page.locator('#world a.btn[href="/town/"]')).toContainText('Banana World');
    for (const k of ['town', 'rave', 'park', 'beach', 'homestead']) await expect(page.locator('#world')).toContainText(W.world.areas[k]);

    // no mark, hole or raw link left on the page
    const text = await page.locator('main').innerText();
    for (const raw of ['**', '](', '{n}', '<strong', '<a ']) expect(text, `raw “${raw}” on the page`).not.toContain(raw);

    // every language, in the switch
    const names = await page.$$eval('.langswitch a', (as) => as.map((a) => a.textContent.trim()));
    expect(names).toEqual(LANG_LINKS.map((l) => l.name));
    if (W.spot) await expect(page.locator('#spot h2')).toHaveText(W.spot.heading);

    for (const w of SHOTS[code] || []) {
      await page.setViewportSize({ width: w, height: w < 500 ? 852 : 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/intl-${code}-${w}.png`, fullPage: true });
    }
    expect(errs).toEqual([]);
  });
}

test('the download card speaks the page’s language, and a PNG’s way out says PNG', async ({ page }) => {
  const W = words('nl');
  await page.route('**/arcade/**', (r) => r.abort());
  await page.goto('/nl/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load');
  await page.locator('#download a[download$=".png"]').click();
  const card = page.locator('.mir--pack');
  await expect(card).toBeVisible({ timeout: 5000 });
  const head = (await card.locator('.mir__head').textContent()).trim();
  expect(Object.values(W.card.heads), 'one of the five headlines, in Dutch').toContain(head);
  await expect(card.locator('.mir__desc')).toHaveText(W.card.desc);
  await expect(card.locator('.mir__go')).toHaveText(W.card.go);
  await expect(card.locator('.mir__pill--price')).toContainText(W.card.count);
  await expect(card.locator('.mir__no')).toHaveText(W.card.skip.split('GIF').join('PNG'));
  await page.waitForTimeout(700);   // the card fades in over the page
  await page.screenshot({ path: 'test-results/intl-nl-card.png' });
});

test('the sitemap lists every language page, its picture titled in its own language', async ({ request }) => {
  const xml = await (await request.get('/sitemap-pages.xml')).text();
  for (const { code } of LOCALES) {
    expect(xml).toContain(`<loc>https://trymstene.com/${code}/</loc>`);
    expect(xml).toContain(`<image:title>${words(code).hero.alt.replace(/&/g, '&amp;')}</image:title>`);
  }
});
