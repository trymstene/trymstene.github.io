// 🐕 THE DOG, UPGRADED (28 Sep 2026), walked as a player in the yard.
//
// Trym: *"upgrade the dog a bit aswell, we can probably do some more on the poor dog"*. She galloped everywhere on four of
// her six frames; now she walks when there is no hurry, runs when there is, barks, meets you at the gate, chases a bird
// off (and now and then the cat), naps in a doghouse of her own and drinks from her bowl — all off the pack's own rows.
// Every strip is sampled on every animation frame of the page (all its frames, in order, at its own size), and each new
// mood is seen doing what it says. Screenshots go to test-results/dog-*.png.
import { test, expect } from '@playwright/test';
import DOGW from '../src/data/copy/homestead-dog.json' with { type: 'json' };

const SHOT = 'test-results/dog-';
const NF = { 'c-dog-idle.png': 6, 'c-dog-walk.png': 6, 'c-dog-run.png': 6, 'c-dog-eat.png': 6, 'c-dog-bark.png': 3, 'c-dog-sleep.png': 8 };
const today = () => Math.floor(Date.now() / 86400000);
// sd 22: pace 1, patience 1, boldness 2 — a dog the walk can predict
const DOG = (o) => ({ sp: 'dog', b: 3, pd: 0, name: 'Biscuit', wd: 0, id: 200200, ad: today() - 5, gs: 0, sd: 22, ...o });
const HEN = (i) => ({ sp: 'hen', b: 0, pd: 0, name: '', wd: 0, id: 100100 + i, ad: today() - 10, gs: 0, sd: 11 + i });
const CAT = { sp: 'cat', b: 3, pd: 0, name: '', wd: 0, id: 424242, ad: today(), gs: 0, sd: 94 };

async function open(page, animals, items, inItems) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(([an, it, room]) => {
    if (sessionStorage.getItem('dog-seeded')) return;
    sessionStorage.setItem('dog-seeded', '1');
    localStorage.setItem('bw-social-v1', JSON.stringify({ g: { none: 1 } }));   // Nib's present (45 s in) is not this walk's: it took a tap once
    localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 3, items: it || [], shed: [], orders: [],
      inItems: room || {}, bed: [null, null, null, null], home: { x: 760, y: 430 }, bedAt: { x: 610, y: 700 },
      animals: an, animalsV: 3, hens: an.filter((a) => a.sp === 'hen').length }));
  }, [animals, items || null, inItems || null]);
  await page.route('**/yards/echoes*', (r) => r.fulfill({ contentType: 'application/json', body: '{"echoes":[]}' }));   // nobody strolling the road
  await page.goto('/homestead/?hstest=rich', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__hs && window.__hs.dog && window.__hs.dog(), null, { timeout: 30000 });
  await page.evaluate(() => window.__hs.wx('clear'));   // the real sky may be raining
  await page.waitForTimeout(1200);
  return errs;
}
const dog = (page) => page.evaluate(() => window.__hs.dog());
// hold off her own interruptions while a mood is looked at: the check-in clock, the greeting at the gate (a warp in from
// the road IS coming home) and the sit-by-you once the banana has stood still a while
const CALM = { heelAt: 1e12, greetAt: 1e12, pMoveAt: 1e12, wasIn: true };
const mood = (page, m, o) => page.evaluate(([a, b]) => window.__hs.dogMood(a, b), [m, o || null]);
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
const sample = (page, ms) => page.evaluate((dur) => new Promise((res) => {
  const out = [], t0 = performance.now();
  const tick = () => {
    const d = window.__hs.dog();
    if (d) out.push({ t: Math.round(performance.now() - t0), ...d });
    if (performance.now() - t0 < dur) requestAnimationFrame(tick); else res(out);
  };
  requestAnimationFrame(tick);
}), ms);
// all of a strip's frames, in order, at its own size; returns the frames seen per strip
function checkStrips(s, label) {
  const seen = {};
  for (let i = 0; i < s.length; i++) {
    const r = s[i];
    expect(Number.isFinite(r.x) && Number.isFinite(r.y), label + ': her position is a number').toBe(true);
    if (!r.strip || r.hidden) continue;
    const nf = NF[r.strip];
    expect(nf, label + ': a strip the bake made (' + r.strip + ')').toBeTruthy();
    expect(r.nf, label + ': ' + r.strip + ' runs ' + nf + ' frames').toBe(nf);
    expect(r.size, label + ': ' + r.strip + ' is sized for ' + nf + ' frames').toBe(nf * 100 + '% 100%');
    (seen[r.strip] = seen[r.strip] || new Set()).add(r.frame);
    if (i > 0 && s[i - 1].strip === r.strip && s[i - 1].frame === r.frame) {
      expect(Math.abs(parseFloat(r.pos) - r.frame * 100 / (nf - 1)) < 0.01, label + ': ' + r.strip + ' frame ' + r.frame + ' drawn').toBe(true);
    }
    if (i > 0 && s[i - 1].strip === r.strip && s[i - 1].frame !== r.frame) {
      expect((s[i - 1].frame + 1) % nf, label + ': ' + r.strip + ' steps one frame at a time').toBe(r.frame);
    }
  }
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
}

test.describe('the dog', () => {
  test.use({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });

  test('her rows frame by frame: a walk when there is no hurry, a run when there is, a bark, a sniff', async ({ page }) => {
    test.setTimeout(120000);
    const errs = await open(page, [HEN(0), HEN(1), DOG()]);
    await page.evaluate(() => window.__hs.warp(1150, 700));
    await page.waitForTimeout(800);
    // a rest spot a little way off: she walks there, then stands wagging
    await mood(page, 'rest', { ...CALM, at: [980, 640], until: 1e12, rx: 1030, ry: 650 });
    let s = await sample(page, 7000);
    let seen = checkStrips(s, 'rest');
    expect(seen['c-dog-walk.png'], 'all six walk frames').toEqual([0, 1, 2, 3, 4, 5]);
    expect(seen['c-dog-idle.png'], 'and the wag, all six').toEqual([0, 1, 2, 3, 4, 5]);
    const walkSpd = s.filter((r) => r.strip === 'c-dog-walk.png').map((r) => r.spd);
    expect(Math.max(...walkSpd), 'a walk, not a gallop').toBeLessThan(40);
    // zoomies: the gallop, with the sniff between dashes
    await mood(page, 'play', { ...CALM, at: [980, 640], dash: 3 });   // dashes counted: a landed bird would be a chase instead
    s = await sample(page, 6000);
    seen = checkStrips(s, 'play');
    expect(seen['c-dog-run.png'], 'all six run frames').toEqual([0, 1, 2, 3, 4, 5]);
    expect((seen['c-dog-eat.png'] || []).length, 'the sniff between dashes').toBeGreaterThanOrEqual(3);
    // a bark: three frames
    await mood(page, 'bark', { ...CALM, at: [980, 640], until: 1e12 });
    s = await sample(page, 1500);
    seen = checkStrips(s, 'bark');
    expect(seen['c-dog-bark.png'], 'all three bark frames').toEqual([0, 1, 2]);
    expect(errs, 'no page errors').toEqual([]);
  });

  test('she meets you at the gate with a bark, chases a bird off, and sends the cat bolting', async ({ page }) => {
    test.setTimeout(150000);
    const errs = await open(page, [HEN(0), HEN(1), DOG(), CAT]);
    // in from the road: she runs to meet you and barks hello
    const P = (await page.evaluate(() => window.__hs.cat && window.__hs.cat() && window.__hs.cat().plot)) || [0, 0, 1800, 1100];
    await mood(page, 'rest', { ...CALM, at: [900, 640], until: 1e12, greetAt: 0 });
    await page.evaluate(([x]) => window.__hs.warp(x, 690), [P[2] + 160]);
    await page.waitForTimeout(700);
    const gs0 = (await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1')).animals.find((a) => a.sp === 'dog').gs)) || 0;
    await page.evaluate(([x]) => window.__hs.warp(x, 690), [P[2] - 120]);
    let s = await sample(page, 6000);
    checkStrips(s, 'greet');
    expect(s.some((r) => r.m === 'greet' && r.strip === 'c-dog-run.png'), 'she runs to meet you').toBe(true);
    expect(s.some((r) => r.m === 'bark'), 'and barks hello').toBe(true);
    await page.screenshot({ path: SHOT + '01-greet.png' });
    // a garden bird on the ground: a dash and a bark, and it is off over the trees
    let bird = null;
    for (let i = 0; i < 10 && !bird; i++) {
      await page.evaluate(() => window.__hsBird && window.__hsBird());
      await page.waitForTimeout(2500);
      bird = (await page.evaluate(() => window.__hs.birds())).find((b) => b.mode === 'ground');
    }
    expect(bird, 'a bird landed').toBeTruthy();
    await mood(page, 'play', { ...CALM, at: [bird.x - 150, bird.y + 10] });
    s = await sample(page, 5000);
    expect(s.some((r) => r.m === 'chase'), 'she goes for it').toBe(true);
    const after = await page.evaluate(() => window.__hs.birds());
    expect(after.some((b) => b.id === bird.id && b.mode === 'ground'), 'the bird is off').toBe(false);
    // the cat, awake in the yard: the dog chases her, and she bolts — away from the dog
    await page.evaluate(() => window.__hs.catMood('sit', 60000, { at: [1000, 700], calm: true, visitAt: 1e12 }));
    await mood(page, 'chase', { ...CALM, at: [860, 700], preyCat: true });
    let bolted = false, catAt = null;
    for (let i = 0; i < 60 && !bolted; i++) {
      const c = await page.evaluate(() => window.__hs.cat());
      bolted = c.m === 'zoom';
      catAt = c;
      await page.waitForTimeout(80);
    }
    expect(bolted, 'the cat bolts').toBe(true);
    await page.waitForTimeout(900);
    const c2 = await page.evaluate(() => window.__hs.cat());
    expect(c2.x, 'away from the dog, who came from her left').toBeGreaterThan(catAt.x);
    expect(errs, 'no page errors').toEqual([]);
  });

  test('she naps in her doghouse, comes out wagging when you tap it, and sits the rain out in it', async ({ page }) => {
    test.setTimeout(150000);
    const errs = await open(page, [HEN(0), HEN(1), DOG()], [{ id: 'doghouse', x: 1000, y: 620 }]);
    await page.evaluate(() => window.__hs.warp(1150, 720));
    await page.waitForTimeout(300);
    await mood(page, 'nap', { ...CALM, at: [880, 660] });
    let d = null;
    for (let i = 0; i < 80; i++) { d = await dog(page); if (d.napping) break; await page.waitForTimeout(100); }
    expect(d.napping, 'she went in').toBe(true);
    expect(d.hidden, 'her sprite is inside').toBe(true);
    // the sleeping frames lie exactly over the doghouse: same left edge, same top, same width
    const boxes = await page.evaluate(() => {
      const house = [...document.querySelectorAll('.hs-it')].find((e) => (e.style.backgroundImage || '').includes('d-doghouse.png'));
      const zz = document.querySelector('.hs-dogsleep');
      const a = house.getBoundingClientRect(), b = zz.getBoundingClientRect();
      return { a: [a.left, a.top, a.width], b: [b.left, b.top, b.width], anim: getComputedStyle(zz).animationName, z: [+house.style.zIndex, +zz.style.zIndex] };
    });
    expect(Math.abs(boxes.a[0] - boxes.b[0]) < 0.6 && Math.abs(boxes.a[1] - boxes.b[1]) < 0.6 && Math.abs(boxes.a[2] - boxes.b[2]) < 0.6,
      'over the doghouse: ' + JSON.stringify(boxes)).toBe(true);
    expect(boxes.anim, 'breathing').toBe('hs-dogsleep');
    expect(boxes.z[1], 'in front of it').toBeGreaterThan(boxes.z[0]);
    await settle(page);
    await page.screenshot({ path: SHOT + '02-doghouse.png' });
    // a tap on the doghouse: out she comes, with a woof, and it is the day's hug
    const b0 = (await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1')).animals.find((a) => a.sp === 'dog').b)) || 0;
    const [sx, sy] = await screenAt(page, 1000, 580);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(400);
    d = await dog(page);
    expect(d.napping || d.hidden, 'she came out').toBe(false);
    expect(d.strip, 'with a bark').toBe('c-dog-bark.png');
    await page.waitForTimeout(600);
    expect((await page.evaluate(() => JSON.parse(localStorage.getItem('hs-v1')).animals.find((a) => a.sp === 'dog').b)), 'the hug counted').toBe(b0 + 1);
    // rain: into the doghouse, and out once it has stopped
    await mood(page, 'rest', { ...CALM, at: [880, 700], until: 1e12 });
    await page.evaluate(() => window.__hs.wx('heavy'));
    for (let i = 0; i < 80; i++) { d = await dog(page); if (d.napping) break; await page.waitForTimeout(100); }
    expect(d.m, 'rain sends her in').toBe('shelter');
    expect(d.napping, 'asleep in her doghouse').toBe(true);
    await page.evaluate(() => window.__hs.wx('clear'));
    await page.waitForTimeout(1500);
    expect((await dog(page)).napping, 'she sleeps a while after the rain').toBe(true);
    expect(errs, 'no page errors').toEqual([]);
  });

  test('she drinks from her bowl once a day; her card names her; the doghouse and the bowl are on the Banana Phone', async ({ page }) => {
    test.setTimeout(120000);
    const errs = await open(page, [HEN(0), HEN(1), DOG()], [{ id: 'dogbowl', x: 1040, y: 700 }, { id: 'doghouse', x: 900, y: 600 }]);
    const bowlImg = () => page.evaluate(() => { const e = [...document.querySelectorAll('.hs-it')].find((x) => /d-dogbowl/.test(x.style.backgroundImage)); return e && e.style.backgroundImage; });
    expect(await bowlImg(), 'full in the morning').toMatch(/d-dogbowl\.png/);
    await page.evaluate(() => window.__hs.warp(1180, 720));
    await page.waitForTimeout(300);
    await mood(page, 'drink', { ...CALM, at: [930, 690] });
    const s = await sample(page, 8000);
    checkStrips(s, 'drink');
    expect(s.some((r) => r.m === 'drink' && r.strip === 'c-dog-eat.png'), 'she drinks').toBe(true);
    expect(await bowlImg(), 'the bowl is empty').toMatch(/d-dogbowl-empty\.png/);
    await settle(page);
    await page.screenshot({ path: SHOT + '03-bowl.png' });
    // her card: dog words, and the doghouse she naps in
    await mood(page, 'linger', { ...CALM, at: [1000, 640], until: 1e12 });
    await page.evaluate(() => window.__hs.warp(1120, 670));
    await page.waitForTimeout(900);
    await settle(page);
    const d = await dog(page);
    const [sx, sy] = await screenAt(page, d.x, d.y - 16);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(150);
    await page.mouse.click(sx, sy);
    await page.waitForSelector('#hsPetBody .hs-pettrait', { timeout: 8000 });
    await expect(page.locator('#hsPetBody .hs-pettrait'), 'her card says where she naps').toContainText(DOGW.traits.house);
    await expect(page.locator('#hsPetBody .hs-petnext'), 'no gate promise for a dog').not.toContainText('gate');
    await page.screenshot({ path: SHOT + '04-card.png' });
    await page.locator('#hsPetClose').click();
    // the Banana Phone's order app, outdoors: both are on its shelves
    await page.evaluate(() => window.__hs.shop('order'));
    await page.waitForSelector('#hsShopList .hs-tile', { timeout: 8000 });
    const names = await page.locator('#hsShopList .hs-tile b').allTextContents();
    expect(names.some((n) => n.startsWith('Doghouse')), 'the doghouse is for sale').toBe(true);
    expect(names.some((n) => n.startsWith('Dog bowl')), 'the bowl is for sale').toBe(true);
    expect(errs, 'no page errors').toEqual([]);
  });

  test('with no doghouse she lies down on the grass: the sleeping row, where she stood; a tap and she is up', async ({ page }) => {
    test.setTimeout(90000);
    const errs = await open(page, [HEN(0), HEN(1), DOG()]);
    await page.evaluate(() => window.__hs.warp(1150, 720));
    await page.waitForTimeout(300);
    await mood(page, 'rest', { ...CALM, at: [1000, 660], until: 1e12, rx: 1000, ry: 660 });
    await page.waitForTimeout(500);
    const before = await dog(page);
    await mood(page, 'nap', { ...CALM });
    const s = await sample(page, 3500);
    const seen = checkStrips(s, 'grass nap');
    expect(seen['c-dog-sleep.png'], 'the sleeping row, all eight frames').toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const lying = s.filter((r) => r.strip === 'c-dog-sleep.png');
    expect(lying.every((r) => Math.abs(r.x - before.x) < 0.5 && Math.abs(r.y - before.y) < 0.5), 'she lies down where she stood').toBe(true);
    expect(lying.every((r) => r.fl === ''), 'facing you, as the pack draws her asleep').toBe(true);
    await settle(page);
    await page.screenshot({ path: SHOT + '05-grass-nap.png' });
    const [sx, sy] = await screenAt(page, before.x, before.y - 12);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(400);
    const d = await dog(page);
    expect(d.m, 'a tap: up she gets, wagging').toBe('linger');
    expect(d.strip).toBe('c-dog-idle.png');
    expect(errs, 'no page errors').toEqual([]);
  });

  test('indoors she follows you, sits by your leg, and lies down by the fire (not on the cat’s spot), then out with you', async ({ page }) => {
    test.setTimeout(180000);
    const room = { 3: [{ id: 'fireplace', x: 760, y: 470 }, { id: 'greyrug', x: 1000, y: 640 }] };
    const errs = await open(page, [HEN(0), HEN(1), DOG(), CAT], null, room);
    await mood(page, 'linger', { ...CALM, at: [800, 520], until: 1e12 });
    await page.evaluate(() => window.__hs.catMood('sit', 1e12, { at: [720, 520], calm: true, visitAt: 1e12 }));
    await page.evaluate(() => window.__hs.enter());
    await page.waitForTimeout(500);
    let r = await page.evaluate(() => window.__hs.dogRoom());
    expect(r, 'she followed you in').toBeTruthy();
    // the cat lies down by the fire first; the dog must find her own spot
    await page.evaluate(() => window.__hs.catRoomMood('nap', { calm: true }));
    for (let i = 0; i < 100; i++) { const c = await page.evaluate(() => window.__hs.catRoom()); if (c && c.strip === 'c-catsleep.png') break; await page.waitForTimeout(100); }
    // you walk across the room: she follows, walking
    await page.evaluate(() => window.__hs.warp(1080, 700));
    let followed = false;
    for (let i = 0; i < 60 && !followed; i++) {
      r = await page.evaluate(() => window.__hs.dogRoom());
      followed = r.strip === 'c-dog-walk.png';
      await page.waitForTimeout(100);
    }
    expect(followed, 'she follows you across the room').toBe(true);
    // stand still: she sits by your leg (a heart), and after a while lies down for a nap
    let slept = null;
    for (let i = 0; i < 260 && !slept; i++) {
      r = await page.evaluate(() => window.__hs.dogRoom());
      if (r.strip === 'c-dog-sleep.png') slept = r;
      await page.waitForTimeout(100);
    }
    expect(slept, 'she lay down for a nap').toBeTruthy();
    expect(slept.size, 'the sleep row, sized for eight frames').toBe('800% 100%');
    const cat = await page.evaluate(() => window.__hs.catRoom());
    expect(Math.hypot(slept.x - cat.x, slept.y - cat.y), 'not on the cat’s spot').toBeGreaterThan(40);
    const onRug = Math.abs(slept.x - 1000) < 40 && Math.abs(slept.y - (640 - 90 * 0.35)) < 14;
    const atFire = Math.abs(slept.x - 760) < 40 && Math.abs(slept.y - 490) < 14;
    expect(onRug || atFire, 'on the rug or by the fire, whichever the cat left her: ' + Math.round(slept.x) + ',' + Math.round(slept.y)).toBe(true);
    await page.screenshot({ path: SHOT + '06-indoors.png' });
    // a tap wakes her, wagging
    const [sx, sy] = await screenAt(page, slept.x, slept.y - 12);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(400);
    expect((await page.evaluate(() => window.__hs.dogRoom())).m, 'up, and with you').toBe('follow');
    // out through the door: both come out with you, one each side of it
    await page.evaluate(() => window.__hs.warp(900, 755));
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.__hs.dogRoom()), 'nobody left indoors').toBeFalsy();
    const d = await dog(page);
    expect(Math.abs(d.x - 726) < 30 && Math.abs(d.y - 476) < 30, 'she came out by the door: ' + Math.round(d.x) + ',' + Math.round(d.y)).toBe(true);
    expect(errs, 'no page errors').toEqual([]);
  });
});
