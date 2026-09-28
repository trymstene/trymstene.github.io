// 🐈 THE CAT (28 Sep 2026), walked as a player in the yard.
//
// Trym: *"the cat sprite you generated - can you add that to the farm/homestead? in the same way you can get a dog? … remember
// to triple check that the cat moves nicely with the different sprites and animation frames you made - it should be just like
// the dog, alltough the cat can also lie down and stuff"*, then *"give the cat a cat-style personality - make it feel like a
// cats behaviour"*.
//
// The first walk buys her on the Banana Phone and reads her card. The second lives a day with her: every strip she wears is
// sampled on every animation frame of the page — all of its frames, in order, at its own size, never a skip, her box never
// moving while she stands — and each mood is seen doing what it says (a nap in her spot that a tap does not end, a visit only
// once you stand still, a step away from a stranger, a meow when you walk in, a hunt that never catches, zoomies, the rain).
// Screenshots go to test-results/cat-*.png and a frame film of each mood to test-results/cat-film/.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import CATW from '../src/data/copy/homestead-cat.json' with { type: 'json' };

const SHOT = 'test-results/cat-';
const FILM = 'test-results/cat-film/';
const NF = { 'c-catidle.png': 6, 'c-cat.png': 6, 'c-catrun.png': 6, 'c-cateat.png': 6, 'c-catmeow.png': 3, 'c-cathappy.png': 6, 'c-catsleep.png': 8 };
const today = () => Math.floor(Date.now() / 86400000);
// sd 94: pace 1, patience 1, boldness 2 (neither shy nor nosy), favourite spot 2 (the house) — a cat the walk can predict
const CAT = (o) => ({ sp: 'cat', b: 0, pd: 0, name: '', wd: 0, id: 424242, ad: today(), gs: 0, sd: 94, ...o });
const HEN = (i) => ({ sp: 'hen', b: 0, pd: 0, name: '', wd: 0, id: 100100 + i, ad: today() - 10, gs: 0, sd: 11 + i });
const DOG = { sp: 'dog', b: 0, pd: 0, name: '', wd: 0, id: 200200, ad: today() - 5, gs: 0, sd: 5 };

async function open(page, animals, inItems) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(([an, room]) => {
    if (sessionStorage.getItem('cat-seeded')) return;
    sessionStorage.setItem('cat-seeded', '1');
    localStorage.setItem('bw-social-v1', JSON.stringify({ g: { none: 1 } }));   // Nib's present (45 s in) is not this walk's: it took a tap once
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: [], shed: [], orders: [],
      inItems: room || {}, bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 },
      animals: an, animalsV: 3, hens: an.filter((a) => a.sp === 'hen').length }));
  }, [animals, inItems || null]);
  await page.route('**/yards/echoes*', (r) => r.fulfill({ contentType: 'application/json', body: '{"echoes":[]}' }));   // nobody strolling the road
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.enter && window.__hs.wx, null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.wx('clear'));   // the real sky may be raining: she would be under the eaves
  await page.waitForTimeout(1500);
  return errs;
}
const cat = (page) => page.evaluate(() => window.__hs.cat());
const mood = (page, m, ms, o) => page.evaluate(([a, b, c]) => window.__hs.catMood(a, b, c), [m, ms || 0, o || null]);
const NO_VISIT = { visitAt: 1e12, calm: true };   // she will not come over, or go after a bird, while a mood is being looked at
// a world point on the screen, through the world element as it is drawn (its rect already carries the camera)
const screenAt = (page, wx, wy) => page.evaluate(([x, y]) => {
  const wr = document.getElementById('hsWorld').getBoundingClientRect(), k = wr.width / window.__hs.signGeo().W;
  return [wr.left + x * k, wr.top + y * k];
}, [wx, wy]);
const settle = async (page) => {
  let last = null;
  for (let i = 0; i < 40; i++) {
    const r = await page.evaluate(() => { const b = document.getElementById('hsWorld').getBoundingClientRect(); return Math.round(b.left * 4) + ',' + Math.round(b.top * 4); });
    if (r === last) return;
    last = r;
    await page.waitForTimeout(80);
  }
};
// every animation frame for ms: her strip, frame, size, position and box — the page's own clock, not the test's
const sample = (page, ms) => page.evaluate((dur) => new Promise((res) => {
  const out = [], t0 = performance.now();
  const tick = () => {
    const c = window.__hs.cat();
    if (c) out.push({ t: Math.round(performance.now() - t0), m: c.m, ph: c.ph, strip: c.strip, frame: c.frame, nf: c.nf, size: c.size,
      pos: c.pos, fl: c.fl, x: c.x, y: c.y, left: c.left, top: c.top, plot: c.plot, fr: c.fr, spd: c.spd });
    if (performance.now() - t0 < dur) requestAnimationFrame(tick); else res(out);
  };
  requestAnimationFrame(tick);
}), ms);
// the strip checks, on a sample: the size is the strip's own, the position is the frame's own, and the frames only ever step
// forward one at a time (a new strip starts at 0); returns the frames seen per strip
function checkStrips(s, label) {
  const seen = {};
  for (let i = 0; i < s.length; i++) {
    const r = s[i];
    expect(Number.isFinite(r.x) && Number.isFinite(r.y), label + ': her position is a number').toBe(true);
    if (!r.strip) continue;
    const nf = NF[r.strip];
    expect(nf, label + ': a strip the bake made (' + r.strip + ')').toBeTruthy();
    expect(r.nf, label + ': ' + r.strip + ' runs ' + nf + ' frames').toBe(nf);
    expect(r.size, label + ': ' + r.strip + ' is sized for ' + nf + ' frames').toBe(nf * 100 + '% 100%');
    (seen[r.strip] = seen[r.strip] || new Set()).add(r.frame);
    // the frame's own column: x = frame / (frames - 1) of the strip (the write lags the frame by at most one tick)
    const want = r.frame * 100 / (nf - 1), got = parseFloat(r.pos);
    if (i > 0 && s[i - 1].frame === r.frame && s[i - 1].strip === r.strip) {
      expect(Math.abs(got - want) < 0.01, label + ': ' + r.strip + ' frame ' + r.frame + ' drawn at ' + want + '% (got ' + r.pos + ')').toBe(true);
    }
    if (i > 0 && s[i - 1].strip === r.strip && s[i - 1].frame !== r.frame) {
      expect((s[i - 1].frame + 1) % nf, label + ': ' + r.strip + ' steps one frame at a time (' + s[i - 1].frame + '→' + r.frame + ')').toBe(r.frame);
    }
    const P = r.plot;
    expect(r.x > P[0] - 40 && r.x < P[2] + 40 && r.y > P[1] - 40 && r.y < P[3] + 40, label + ': she stays in the yard').toBe(true);
  }
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
}
// a short film of her, clipped round her feet: the frames go to test-results/cat-film/<name>-NN.png
async function film(page, name, ms, gap = 70) {
  mkdirSync(FILM, { recursive: true });
  const t0 = Date.now();
  let n = 0;
  while (Date.now() - t0 < ms) {
    const c = await cat(page);
    const [sx, sy] = await screenAt(page, c.x, c.y);
    const vw = page.viewportSize().width, vh = page.viewportSize().height;
    await page.screenshot({ path: FILM + name + '-' + String(n).padStart(3, '0') + '.png',
      clip: { x: Math.max(0, Math.min(vw - 180, sx - 90)), y: Math.max(0, Math.min(vh - 100, sy - 80)), width: 180, height: 100 } });
    n++;
    await page.waitForTimeout(gap);
  }
  return n;
}

test.describe('the cat', () => {
  test.use({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });

  test('she is sold on the Banana Phone like the dog, arrives grown, and her card reads like a cat', async ({ page }) => {
    test.setTimeout(90000);
    const errs = await open(page, [HEN(0), HEN(1), DOG]);
    await page.evaluate(() => window.__hs.shop('buy'));
    await page.waitForSelector('#hsShopList .hs-row', { timeout: 8000 });
    await page.waitForTimeout(500);
    const row = page.locator('#hsShopList .hs-row', { hasText: CATW.shop.name }).first();
    await expect(row, 'the cat has her row, beside the dog').toBeVisible();
    await expect(row).toContainText(CATW.shop.buy);
    await expect(row.locator('.hs-rowthumb i'), 'her row shows her own sprite').toHaveCSS('background-image', /c-catthumb\.png/);
    await page.screenshot({ path: SHOT + '01-market.png' });
    await row.locator('button', { hasText: /buy/ }).click();
    await expect(page.locator('#hsToast'), 'the toast says she is yours, in her own time').toContainText(CATW.arrive);
    await expect(page.locator('#hsShopList .hs-row', { hasText: CATW.shop.name }).first(), 'owned, her row says where she is').toContainText(CATW.shop.home);
    const flock = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1')).animals);
    const bought = flock.find((x) => x.sp === 'cat');
    expect(bought, 'the cat is in the flock').toBeTruthy();
    expect(bought.gd, 'she arrives grown, like the dog (the art has no kitten)').toBeUndefined();
    await page.screenshot({ path: SHOT + '02-bought.png' });
    // ✕ steps back to the phone's home screen first, then closes it
    for (let i = 0; i < 3 && await page.locator('#hsShop').isVisible(); i++) {
      await page.locator('#hsShopClose').click();
      await page.waitForTimeout(400);
    }
    await expect(page.locator('#hsShop'), 'the phone is put away').toBeHidden();
    await page.waitForTimeout(400);
    await expect(page.locator('.hs-hen--cat'), 'she is in the yard').toHaveCount(1);
    // her card: a double tap on her, out on open grass
    await page.evaluate(() => { window.__hs.catMood('sit', 60000, { visitAt: 1e12, at: [1000, 640] }); window.__hs.warp(1120, 670); });
    await page.waitForTimeout(900);
    await settle(page);
    const c = await cat(page);
    const [sx, sy] = await screenAt(page, c.x, c.y - 14);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(150);
    await page.mouse.click(sx, sy);
    await page.waitForSelector('#hsPetBody .hs-petname', { timeout: 8000 });
    const card = page.locator('#hsPetBody');
    await expect(card, 'her card counts purrs').toContainText(CATW.goods);
    await expect(card.locator('.hs-pettrait'), 'her traits are cat words').toBeVisible();
    const trait = await card.locator('.hs-pettrait').textContent();
    const CATWORDS = Object.values(CATW.traits).map((w) => w.replace(' {spot}', '').replace('{spot}', ''));
    expect(CATWORDS.some((w) => trait.includes(w.trim())), 'the trait line: ' + trait).toBe(true);
    await expect(card.locator('.hs-petnext'), 'no promise of the gate for a cat').not.toContainText('gate');
    await page.screenshot({ path: SHOT + '03-card.png' });
    await page.locator('#hsPetClose').click();
    // her row in My animals, and her place in the family tree, both in her own sprite
    await page.evaluate(() => window.__hs.shop('animals'));
    await page.waitForSelector('#hsShopList .hs-row', { timeout: 8000 });
    await expect(page.locator('#hsShopList .hs-rowthumb i[style*="c-catthumb"]'), 'she is in My animals').toHaveCount(1);
    await page.evaluate(() => window.__hs.shop('tree'));
    await page.waitForTimeout(800);
    await expect(page.locator('#hsShopList [style*="c-catthumb"]').first(), 'she is in the family tree').toBeAttached();
    await page.screenshot({ path: SHOT + '04-tree.png' });
    for (let i = 0; i < 3 && await page.locator('#hsShop').isVisible(); i++) { await page.locator('#hsShopClose').click(); await page.waitForTimeout(300); }
    // the kitchen: a cheese board is her favourite (the cow's too)
    await page.evaluate(() => window.__hs.cook());
    await expect(page.locator('#hsCookList'), 'her favourite dish says so').toContainText(CATW.fave + ' favourite');
    await page.locator('#hsCookClose').click();
    expect(errs, 'no page errors').toEqual([]);
  });

  test('she lives like a cat: every strip frame by frame, and each mood doing what it says', async ({ page }) => {
    test.setTimeout(240000);
    const errs = await open(page, [HEN(0), HEN(1), DOG, CAT({ b: 1 })]);
    await expect(page.locator('.hs-hen--cat')).toHaveCount(1);
    expect(Object.keys(NF), 'she wears one of her own strips').toContain((await cat(page)).strip);   // the real sky may have sent her under the eaves

    // ── SIT: the tail keeps going while she stands; every idle frame, in order, her box still
    await page.evaluate(() => window.__hs.warp(1110, 700));
    await page.waitForTimeout(1500);   // in from the road: she meows at you first (the meow walk below)
    await mood(page, 'sit', 6000, { ...NO_VISIT, at: [980, 620] });
    let s = await sample(page, 2500);
    let seen = checkStrips(s, 'sit');
    expect(seen['c-catidle.png'], 'all six idle frames').toEqual([0, 1, 2, 3, 4, 5]);
    const drift = Math.max(...s.map((r) => Math.hypot(r.x - s[0].x, r.y - s[0].y)));
    expect(drift, 'standing, she stays put').toBeLessThan(1.5);

    // ── NAP: she walks to her spot (by the house, sd 94) and lies down; eight sleep frames, slow; a tap does not wake her
    await mood(page, 'nap', 0, NO_VISIT);
    s = await sample(page, 15000);
    seen = checkStrips(s, 'nap');
    const asleep = s.filter((r) => r.strip === 'c-catsleep.png');
    expect(asleep.length, 'she fell asleep').toBeGreaterThan(20);
    expect(seen['c-catsleep.png'].length, 'the sleep row runs its frames').toBeGreaterThanOrEqual(6);
    const bed = asleep[asleep.length - 1];
    expect(Math.abs(bed.x - 760) < 110 && bed.y > 470 && bed.y < 560, 'she naps by the house: ' + bed.x + ',' + bed.y).toBe(true);
    // the strip swap from walking to sleeping never moves her feet: the box is the same box
    const lastWalk = s.filter((r) => r.strip === 'c-cat.png').pop();
    if (lastWalk) expect(Math.abs(lastWalk.y - asleep[0].y) < 3, 'no jump as she lies down').toBe(true);
    await page.evaluate(() => { const c = window.__hs.cat(); window.__hs.warp(c.x + 110, c.y + 40); });
    await page.waitForTimeout(900);
    await settle(page);
    await film(page, 'nap', 2600, 90);
    let c = await cat(page);
    const b0 = c.b;
    let [sx, sy] = await screenAt(page, c.x, c.y - 10);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(700);
    c = await cat(page);
    expect(c.strip, 'a tap does not wake her').toBe('c-catsleep.png');
    expect(c.b, 'the stroke is still the day’s hug').toBe(b0 + 1);
    await page.screenshot({ path: SHOT + '04-nap.png' });

    // ── PURR: awake and tapped, a cat who is not shy purrs at you (the front-facing row)
    await mood(page, 'sit', 20000, NO_VISIT);
    await page.waitForTimeout(900);
    c = await cat(page);
    [sx, sy] = await screenAt(page, c.x, c.y - 14);
    await page.mouse.click(sx, sy);
    s = await sample(page, 1800);
    seen = checkStrips(s, 'purr');
    expect(s.some((r) => r.m === 'purr' && r.strip === 'c-cathappy.png'), 'she purrs').toBe(true);
    expect(seen['c-cathappy.png'].length, 'the purr runs its frames').toBeGreaterThanOrEqual(5);
    await film(page, 'purr', 1200, 80);

    // ── STROLL: a walk; she faces the way she goes, and the walk row steps one frame at a time
    await mood(page, 'stroll', 0, NO_VISIT);
    s = await sample(page, 4000);
    seen = checkStrips(s, 'stroll');
    const walking = s.filter((r) => r.strip === 'c-cat.png');
    expect(walking.length, 'she walked').toBeGreaterThan(20);
    expect(seen['c-cat.png'], 'all six walk frames').toEqual([0, 1, 2, 3, 4, 5]);
    for (let i = 1; i < walking.length; i++) {
      const dx = walking[i].x - walking[i - 1].x;
      if (Math.abs(dx) > 0.5) expect(walking[i].fl, 'she faces the way she walks').toBe(dx < 0 ? 'scaleX(-1)' : '');
    }
    await mood(page, 'stroll', 0, NO_VISIT);
    await film(page, 'walk', 2200, 60);

    // ── ZOOMIES: dashes with dead stops between them, then a flop or a sit
    await mood(page, 'zoom', 0, { ...NO_VISIT, at: [1000, 640] });   // out on open grass
    s = await sample(page, 6000);
    seen = checkStrips(s, 'zoom');
    expect(seen['c-catrun.png'], 'all six run frames').toEqual([0, 1, 2, 3, 4, 5]);
    let dashes = 0;
    for (let i = 1; i < s.length; i++) if (s[i].strip === 'c-catrun.png' && s[i - 1].strip !== 'c-catrun.png') dashes++;
    expect(dashes, 'two to four dashes').toBeGreaterThanOrEqual(2);
    await mood(page, 'zoom', 0, NO_VISIT);
    await film(page, 'run', 2000, 50);

    // ── VISIT: only once you stand still — she walks over, purrs at your feet, and a purr is counted
    await mood(page, 'sit', 30000, { visitAt: 0, calm: true, at: [960, 640] });   // awake and sitting on open grass: a napping cat does not come over
    c = await cat(page);
    await page.evaluate(([x, y]) => window.__hs.warp(x + 180, y + 20), [c.x, c.y]);
    const gs0 = c.gs;
    s = await sample(page, 14000);
    checkStrips(s, 'visit');
    const moods = []; for (const r of s) { const k = r.m + '/' + r.ph + '/' + r.strip.replace('c-cat', '').replace('.png', ''); if (!moods.length || moods[moods.length - 1].k !== k) moods.push({ k, t: r.t, at: Math.round(r.x) + ',' + Math.round(r.y) }); }
    expect(s.some((r) => r.m === 'visit' && r.strip === 'c-cathappy.png'), 'she came and purred at your feet: ' + moods.map((m) => m.k + '@' + m.t + ' ' + m.at).join(' | ')).toBe(true);
    const first = s.find((r) => r.m === 'visit');
    expect(first && first.t >= 4500, 'not before you had stood still a while (' + (first && first.t) + ' ms)').toBe(true);
    c = await cat(page);
    expect(c.gs, 'a purr counted on her card').toBe(gs0 + 1);
    await page.screenshot({ path: SHOT + '05-visit.png' });

    // ── SHUN: a banana she does not know yet (Lv 1) walks straight at her — she steps away
    await mood(page, 'sit', 30000, NO_VISIT);
    await page.waitForTimeout(600);
    c = await cat(page);
    await page.evaluate(([x, y]) => window.__hs.warp(x + 40, y + 8), [c.x, c.y]);
    s = await sample(page, 2500);
    checkStrips(s, 'shun');
    expect(s.some((r) => r.m === 'shun'), 'she steps away').toBe(true);
    const away = s[s.length - 1];
    expect(Math.hypot(away.x - (c.x + 40), away.y - (c.y + 8)), 'further from you than she was').toBeGreaterThan(60);

    // ── MEOW: you walk in through the gate — she looks up and meows from where she is
    await mood(page, 'sit', 30000, NO_VISIT);
    const P = (await cat(page)).plot;
    await page.evaluate(([x, y]) => window.__hs.warp(x, y), [P[2] + 160, (P[1] + P[3]) / 2]);
    await page.waitForTimeout(500);
    await page.evaluate(([x, y]) => window.__hs.warp(x, y), [P[2] - 120, (P[1] + P[3]) / 2]);
    s = await sample(page, 1500);
    seen = checkStrips(s, 'meow');
    expect(seen['c-catmeow.png'], 'she meows: all three frames').toEqual([0, 1, 2]);
    expect(s.find((r) => r.strip === 'c-catmeow.png').fl, 'facing you (you are to her right)').toBe('');

    // ── HUNT (a hen): creep, freeze, pounce — the hen hops away, and she sniffs about as if nothing happened
    await mood(page, 'sit', 30000, NO_VISIT);
    // ⚠️ from 180 px off: a hen that had wandered within 58 of her made the creep one frame long, and the film missed it
    expect(await page.evaluate(() => window.__hs.catHunt('hen', 180)), 'she goes for a hen').toBe('hen');
    s = await sample(page, 26000);
    seen = checkStrips(s, 'hunt a hen');
    const phases = [...new Set(s.filter((r) => r.m === 'hunt').map((r) => r.ph))];
    expect(phases, 'creep, freeze, pounce, sniff').toEqual(expect.arrayContaining([0, 1, 2, 3]));
    expect(s.some((r) => r.m === 'hunt' && r.ph === 0 && r.strip === 'c-cat.png' && r.fr >= 160), 'the last stretch is a creep').toBe(true);
    expect(s.some((r) => r.m === 'hunt' && r.ph === 0 && r.strip === 'c-cat.png'), 'she creeps').toBe(true);
    expect(s.some((r) => r.m === 'hunt' && r.ph === 2 && r.strip === 'c-catrun.png'), 'she pounces').toBe(true);
    expect(s.some((r) => r.m === 'hunt' && r.ph === 3 && r.strip === 'c-cateat.png'), 'then sniffs about').toBe(true);
    expect(seen['c-cateat.png'].length, 'the sniff runs its frames').toBeGreaterThanOrEqual(5);

    // ── HUNT (a garden bird): the bird on the ground is gone over the trees when she pounces
    let got = '';
    for (let i = 0; i < 12 && !got; i++) {
      await page.evaluate(() => window.__hsBird && window.__hsBird());
      await page.waitForTimeout(2500);
      await mood(page, 'sit', 30000, NO_VISIT);
      got = await page.evaluate(() => window.__hs.catHunt('bird'));
    }
    expect(got, 'a bird landed and she went for it').toBe('bird');
    const preyId = (await cat(page)).preyId;
    s = await sample(page, 26000);
    checkStrips(s, 'hunt a bird');
    const birds1 = await page.evaluate(() => window.__hs.birds());
    // she pounced unless the bird left first (it flies off when bored, or when you come close)
    if (s.some((r) => r.m === 'hunt' && r.ph >= 2)) {
      expect(birds1.some((b) => b.id === preyId && b.mode === 'ground'), 'the bird she went for is off: ' + JSON.stringify(birds1)).toBe(false);
    }

    // ── RAIN: up and running for the eaves, then asleep there until it stops
    await mood(page, 'stroll', 0, NO_VISIT);
    await page.evaluate(() => window.__hs.wx('heavy'));
    s = await sample(page, 9000);
    checkStrips(s, 'rain');
    expect(s.some((r) => r.m === 'shelter' && r.strip === 'c-catrun.png'), 'she runs for it').toBe(true);
    const dry = s.filter((r) => r.m === 'shelter' && r.strip === 'c-catsleep.png');
    expect(dry.length, 'and sleeps under the eaves').toBeGreaterThan(10);
    const eaves = dry[dry.length - 1];
    expect(Math.abs(eaves.x - 760) < 90 && eaves.y > 430 + 20 && eaves.y < 430 + 55, 'by the house wall, clear of its door: ' + Math.round(eaves.x) + ',' + Math.round(eaves.y)).toBe(true);
    await page.screenshot({ path: SHOT + '06-rain.png' });
    await page.evaluate(() => window.__hs.wx('clear'));
    await page.waitForTimeout(1500);
    expect((await cat(page)).strip, 'she sleeps a while after the rain stops').toBe('c-catsleep.png');

    // the size beside the dog and the banana: one look for the eye
    await mood(page, 'sit', 30000, NO_VISIT);
    c = await cat(page);
    await page.evaluate(([x, y]) => window.__hs.warp(x + 70, y + 6), [c.x, c.y]);
    await page.waitForTimeout(1200);
    await settle(page);
    await page.screenshot({ path: SHOT + '07-size.png' });
    expect(errs, 'no page errors').toEqual([]);
  });

  test('indoors she naps on a rug or up on the couch, purrs, comes to you, and comes back out with you', async ({ page }) => {
    test.setTimeout(180000);
    // a house with a rug and a big couch and nothing warmer: her two spots
    const errs = await open(page, [HEN(0), HEN(1), CAT({ b: 3 })], { 3: [{ id: 'greyrug', x: 800, y: 640 }, { id: 'bigcouch', x: 980, y: 560 }] });
    await mood(page, 'sit', 60000, { ...NO_VISIT, at: [780, 520] });   // by the house: she will come in with you
    await page.evaluate(() => window.__hs.enter());
    await page.waitForTimeout(400);
    let r = await page.evaluate(() => window.__hs.catRoom());
    expect(r, 'she followed you in').toBeTruthy();
    // she walks to one of her spots and lies down there: on the rug, or up on the couch (a hop, drawn in front of it)
    const seen = new Set();
    for (let i = 0; i < 160; i++) {
      r = await page.evaluate(() => window.__hs.catRoom());
      seen.add(r.strip);
      if (r.strip === 'c-catsleep.png') break;
      await page.waitForTimeout(100);
    }
    expect([...seen], 'she walked in and lay down').toEqual(expect.arrayContaining(['c-cat.png', 'c-catsleep.png']));
    const onRug = Math.abs(r.x - 800) < 40 && Math.abs(r.y - (640 - 90 * 0.4)) < 12;
    const onCouch = r.up && Math.abs(r.x - 980) < 40;
    expect(onRug || onCouch, 'asleep on the rug or up on the couch: ' + JSON.stringify(r)).toBe(true);
    if (onCouch) expect(r.z, 'up on the couch she is drawn in front of it').toBe(562);
    // the sleep row runs its frames, at its own size
    const frames = new Set();
    for (let i = 0; i < 40; i++) {
      const q = await page.evaluate(() => window.__hs.catRoom());
      frames.add(q.frame);
      expect(q.size, 'the sleep row is sized for eight frames').toBe('800% 100%');
      await page.waitForTimeout(90);
    }
    expect(frames.size, 'the sleep row breathes').toBeGreaterThanOrEqual(7);
    await page.screenshot({ path: SHOT + '08-indoors.png' });
    // a tap: asleep she sleeps on, and it is still the day's hug
    const b0 = (await cat(page)).b;
    let [sx, sy] = await screenAt(page, r.x, r.y - 10);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(700);
    expect((await page.evaluate(() => window.__hs.catRoom())).strip, 'a tap does not wake her').toBe('c-catsleep.png');
    expect((await cat(page)).b, 'the hug counts indoors too').toBe(b0 + 1);
    // awake, a tap is a purr
    await page.evaluate(() => window.__hs.catRoomMood('sit', { calm: true, until: 1e12 }));
    await page.waitForTimeout(300);
    r = await page.evaluate(() => window.__hs.catRoom());
    [sx, sy] = await screenAt(page, r.x, r.y - 12);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(400);
    expect((await page.evaluate(() => window.__hs.catRoom())).strip, 'she purrs').toBe('c-cathappy.png');
    // stand still, and she comes to purr at your feet
    await page.evaluate(() => { window.__hs.catMood('sit', 0, { visitAt: 0 }); window.__hs.catRoomMood('sit', { calm: false, until: 1e12 }); });
    const gs0 = (await cat(page)).gs;
    let visited = false;
    for (let i = 0; i < 160 && !visited; i++) {
      const q = await page.evaluate(() => window.__hs.catRoom());
      visited = q.m === 'visit' && q.strip === 'c-cathappy.png';
      await page.waitForTimeout(100);
    }
    expect(visited, 'she came to purr at your feet').toBe(true);
    expect((await cat(page)).gs, 'a purr counted on her card').toBe(gs0 + 1);
    await page.screenshot({ path: SHOT + '09-indoor-visit.png' });
    // out through the door: she comes out with you and sits by it
    await page.evaluate(() => window.__hs.warp(900, 755));
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.__hs.catRoom()), 'nobody left indoors').toBeFalsy();
    const out = await cat(page);
    expect(Math.abs(out.x - 794) < 30 && Math.abs(out.y - 476) < 30, 'she came out by the door: ' + Math.round(out.x) + ',' + Math.round(out.y)).toBe(true);
    // off on her own business across the yard, she stays out
    await mood(page, 'sit', 60000, { ...NO_VISIT, at: [1250, 760] });
    await page.evaluate(() => window.__hs.enter());
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__hs.catRoom()), 'far from the house, she stays out').toBeFalsy();
    expect(errs, 'no page errors').toEqual([]);
  });

  test('she leaves a gift on the doorstep: a flower for the kitchen shelf', async ({ page }) => {
    test.setTimeout(90000);
    const errs = await open(page, [HEN(0), HEN(1), CAT({ b: 5 })]);
    // the day's own gift may already be there (Lv 5: most days); if not, she leaves one now
    let item;
    if (await page.locator('.hs-gift').count()) item = (await page.locator('.hs-gift').getAttribute('style')).match(/g-(\w+)\.png/)[1];
    else item = await page.evaluate(() => window.__hs.catGift());
    expect(['daisy', 'sunflower'], 'a flower a bouquet wants').toContain(item);
    await expect(page.locator('.hs-gift'), 'it lies by the door').toHaveCount(1);
    await page.evaluate(() => window.__hs.warp(760 + 52 + 80, 430 + 70));   // near the door, not on it yet
    await page.waitForTimeout(900);
    await settle(page);
    await page.screenshot({ path: SHOT + '10-gift.png' });
    await page.evaluate(() => window.__hs.warp(760 + 52, 430 + 46));        // and over it
    await page.waitForTimeout(500);
    await expect(page.locator('.hs-gift'), 'picked up').toHaveCount(0);
    await expect(page.locator('#hsToast')).toContainText(CATW.gift.got.replace('{item}', CATW.gift.items[item]));
    const pantry = await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1')).pantry || {});
    expect(pantry[item], 'on the kitchen shelf').toBe(1);
    expect(errs, 'no page errors').toEqual([]);
  });
});
