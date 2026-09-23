// 💼 THE STAFF CARD — the walk (23 Sep 2026; the plan https://claude.ai/artifact/Ub4HFW4zdQcDiCGrUZNJxH, slice 0a).
//
// Trym, 23 Sep: "click on the workplace to see your progress in a separate workplace badge thats standardized for all
// workplaces" — and "theres two different dynamics involved here … as long as we treat both jobs with the same amount
// of weight". So this walks BOTH halves with the same care: a round you play (the café here; the stand and the post
// office in their own walks) and the calls the town has for you (the arcade and the store), plus the note that opens
// the card from anywhere, a shut day, and a stranger whose taps must not change at all.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TIPS_DAY } from '../src/data/town/jobs.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAFF = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-staff.json'), 'utf8'));
const DUTY = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-duties.json'), 'utf8'));
const CAFE = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'copy', 'town-cafe.json'), 'utf8'));
const SHOT = 'test-results/staff-';

async function town(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));   // an area can look alive and be dead
  await page.addInitScript(() => { window.__ev = []; window.gtag = (k, n, p) => window.__ev.push([n, p]); });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work && window.__town.duties && window.__town.PROPS, null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.room.set(85); window.__town.life.set(11); });
  expect(await page.evaluate(() => window.__town.staffReady()), 'the card’s chunk arrives').toBe(true);
  return errs;
}
const stand = (page, x, y) => page.evaluate(([x, y]) => { const t = window.__town; t.pos.x = t.tgt.x = x; t.pos.y = t.tgt.y = y; }, [x, y]);
const events = (page, name) => page.evaluate((n) => window.__ev.filter((e) => e[0] === n).map((e) => e[1]), name);
// what the card on screen says, or null when no staff card is up
const card = (page) => page.evaluate(() => {
  const c = document.querySelector('.tws');
  if (!c || document.getElementById('twPanel').hidden) return null;
  const go = document.getElementById('twsGo'), sec = document.getElementById('twsSecond');
  return { at: c.dataset.at, kind: c.dataset.kind, text: c.innerText, go: go ? go.textContent.trim() : '', goOff: !!(go && go.disabled), second: sec ? sec.textContent.trim() : '', calls: [...c.querySelectorAll('[data-call]')].map((li) => li.dataset.call) };
});
const waitCard = (page, at) => page.waitForFunction((a) => !document.getElementById('twPanel').hidden && !!document.querySelector('.tws[data-at="' + a + '"]'), at, { timeout: 15000 });
const closeCard = (page) => page.evaluate(() => document.getElementById('twCardX').click());
// a real thumb on the square: world px to the screen, through the world's own box and scale
async function tapWorld(page, wx, wy) {
  const p = await page.evaluate(([x, y]) => { const w = document.getElementById('twWorld'), k = parseFloat(w.style.getPropertyValue('--ws')), r = w.getBoundingClientRect(), v = document.getElementById('twView').getBoundingClientRect(); const s = { x: r.left + x * k, y: r.top + y * k }; s.on = s.x > v.left && s.x < v.right && s.y > v.top && s.y < v.bottom; return s; }, [wx, wy]);
  expect(p.on, 'the thing is on screen — a thumb can only tap what it can see').toBe(true);
  await page.mouse.click(p.x, p.y);
}

test('your own workplace answers a real tap with your staff card; a stranger’s tap is what it always was', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  expect(await page.evaluate(() => window.__town.room.cafeReady()), 'the counter’s chunk arrives').toBe(true);
  const win = await page.evaluate(() => window.__town.room.cafe().window());
  const hatch = { x: (win.x0 + win.x1) / 2, y: (win.y0 + win.y1) / 2 };

  // ── a banana who works at the store taps the Coffee Cup's hatch: the café's own line, no card
  await page.evaluate(() => window.__town.work.set({ at: 'store' }));
  await stand(page, 1690, 1085);
  await page.waitForTimeout(900);
  await tapWorld(page, hatch.x, hatch.y);
  await page.waitForFunction((f) => (document.getElementById('twToast').textContent || '').trim() === f, CAFE.front, { timeout: 10000 });
  expect(await card(page), 'no staff card at somebody else’s workplace').toBe(null);

  // ── Bean's own staff tap the same hatch: the banana walks there, and the card opens on arrival
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await stand(page, 1690, 1085);   // a few steps along the pavement: the hatch is on screen, and a walk away
  await page.waitForTimeout(900);
  await tapWorld(page, hatch.x, hatch.y);
  await page.waitForTimeout(150);
  expect(await card(page), 'nothing opens over a walk').toBe(null);
  await waitCard(page, 'cafe');
  const c = await card(page);
  expect(c.kind, 'the café is a round you play').toBe('shift');
  expect(c.text, 'where, and for whom').toContain(STAFF.of.cafe.toUpperCase());
  expect(c.text, 'what you are called here').toContain(STAFF.title.cafe);
  expect(c.text, 'today’s tips against the day’s cap').toContain('/ ' + TIPS_DAY);
  expect(c.go).toBe(STAFF.go);
  expect(c.second, 'the café has no other use').toBe('');
  expect(await page.evaluate(() => window.__town.room.cafe().on()), 'looking is not working').toBe(false);
  await page.locator('.tw-card').screenshot({ path: SHOT + 'cafe.png' });

  // ── Go to work: the card goes, and the shift begins at the hatch
  await page.click('#twsGo');
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden), 'the card closed').toBe(true);
  await page.waitForFunction(() => window.__town.room.cafe().on(), null, { timeout: 15000 });
  const ev = await events(page, 'town_staff');
  expect(ev.map((e) => e.act), 'Pulse hears the card open and the shift chosen').toEqual(['open', 'go']);
  expect(ev[0].door, 'from the place').toBe('place');
  await page.evaluate(() => window.__town.room.cafe().clockOut());
  expect(errs).toEqual([]);
});

// 🚪 THE ARCADE AND THE STORE ARE DOORS (Trym, 23 Sep 2026: "you can walk inside that store before anything happens,
// the same goes for the arcade really, theres an inside of that building aswell"): their own staff walk in like anybody
// else, the work is lit inside, and the staff card is the work note's — which stays up inside your own workplace.
test('the arcade is a door for its staff too: in first, the calls lit inside, the card on the note; a quiet day says so', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'condo', sofar: 20 }));
  await page.evaluate(() => window.__town.room.arcadeReset('g2'));   // a fresh day with its calls in: three bits of litter, g2 dark
  await stand(page, 480, 600);

  // ── the tap on the arcade: no card at the door, the banana goes in, and the calls are there, lit
  await page.evaluate(() => window.__town.open('condo'));
  await page.waitForFunction(() => window.__town.rooms.now() === 'condo', null, { timeout: 15000 });
  expect(await card(page), 'nothing opened at the door').toBe(null);
  const a = await page.evaluate(() => window.__town.room.arcade());
  expect(a.litter.length, 'the litter on the floor').toBe(3);
  expect(a.dead, 'the dark cabinet').toBe('g2');

  // ── inside, the note is up, and it opens the card: today's calls, the week, the wage
  await page.waitForFunction(() => !window.__town.duties.hidden(), null, { timeout: 5000 });
  await page.click('.twd-chip__line');
  await waitCard(page, 'condo');
  let c = await card(page);
  expect(c.kind, 'the arcade is the town calling').toBe('oncall');
  expect(c.calls, 'the litter and the dark cabinet are today’s calls').toEqual(['sweep', 'fix']);
  expect(c.text, 'the litter is counted').toMatch(new RegExp(STAFF.call.sweep + '\\s*3'));
  expect(c.go).toBe(STAFF.answer);
  expect(c.text, 'the week').toContain(DUTY.kinds.sweep);
  expect(c.text, 'the wage').toContain(STAFF.wage);
  await page.locator('.tw-card').screenshot({ path: SHOT + 'arcade.png' });
  // Answer the calls, standing in the arcade already: the card closes and you are where the work is
  await page.click('#twsGo');
  expect(await page.evaluate(() => document.getElementById('twPanel').hidden)).toBe(true);
  expect(await page.evaluate(() => window.__town.rooms.now()), 'still in the arcade').toBe('condo');
  await page.evaluate(() => window.__town.rooms.exit());

  // ── every call answered: from the square, the note's card says nothing needs you, and its other use walks you in to play
  await page.evaluate(() => { const k = 'tw-arcade-v1', a = JSON.parse(localStorage.getItem(k)); a.swept = [0, 1, 2]; a.fixed = ['g2']; localStorage.setItem(k, JSON.stringify(a)); });
  await page.waitForTimeout(1400);
  await page.click('.twd-chip__line');
  await waitCard(page, 'condo');
  c = await card(page);
  expect(c.calls, 'no calls').toEqual([]);
  expect(c.text, 'said plainly').toContain(STAFF.quiet);
  expect(c.go, 'nothing to press').toBe('');
  expect(c.second, 'and the arcade is still a place to play').toBe(STAFF.second.condo);
  await page.click('#twsSecond');
  await page.waitForFunction(() => window.__town.rooms.now() === 'condo', null, { timeout: 15000 });
  const ev = await events(page, 'town_staff');
  expect(ev.map((e) => e.act)).toEqual(['open', 'answer', 'open', 'second']);
  expect(ev[0].door, 'the card came from the note').toBe('note');
  expect(ev[0].calls, 'an open says how many calls were waiting').toBe(2);
  expect(errs).toEqual([]);
});

test('the store is a door for its staff too: in first, the crates lit; Pip’s shelf is the counter’s, from the card as well', async ({ page }) => {
  test.setTimeout(90000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'store', sofar: 30 }));
  await page.evaluate(() => localStorage.setItem('tw-calls-v1', JSON.stringify({ d: Math.floor(Date.now() / 864e5), t0: Date.now() - 36e5, qa: ['restock'] })));   // the day's delivery call is in (slice 0b)
  expect(await page.evaluate(() => window.__town.room.shopReady()), 'the shop’s chunk arrives').toBe(true);
  await stand(page, 480, 1080);

  // ── the tap on the store: no shelf and no card at the door; the banana goes in and the crates are lit
  await page.evaluate(() => window.__town.open('store'));
  await page.waitForFunction(() => window.__town.rooms.now() === 'store', null, { timeout: 15000 });
  expect(await card(page), 'no staff card at the door').toBe(null);
  expect(await page.locator('.tw-store').count(), 'no shelf at the door').toBe(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.querySelectorAll('#twWorld .is-todo').length), 'the crates glow').toBeGreaterThan(0);

  // ── the note's card, inside: the delivery is today's call
  await page.click('.twd-chip__line');
  await waitCard(page, 'store');
  const c = await card(page);
  expect(c.kind).toBe('oncall');
  expect(c.calls, 'the bare faces are today’s call').toEqual(['restock']);
  expect(c.go).toBe(STAFF.answer);
  expect(c.second).toBe(STAFF.second.store);
  await page.locator('.tw-card').screenshot({ path: SHOT + 'store.png' });

  // ── its other use from out on the square: the banana walks in, and Pip's shelf opens on the counter
  await page.evaluate(() => document.getElementById('twCardX').click());
  await page.evaluate(() => window.__town.rooms.exit());
  await page.waitForTimeout(400);
  await page.click('.twd-chip__line');
  await waitCard(page, 'store');
  await page.click('#twsSecond');
  await page.waitForFunction(() => window.__town.rooms.now() === 'store' && !document.getElementById('twPanel').hidden && document.querySelectorAll('.tw-store').length === 1, null, { timeout: 15000 });
  expect(await card(page), 'the shelf, not the staff card').toBe(null);
  expect(errs).toEqual([]);
});

test('the work note opens the staff card from anywhere in the square, and only its briefcase folds it', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'post', sofar: 25, duties: [{ kind: 'sort', done: 1, of: 3 }, { kind: 'days', done: 2, of: 3 }] }));
  await stand(page, 1100, 780);   // the middle of the square, nowhere near the post office
  await page.waitForFunction(() => !window.__town.duties.hidden(), null, { timeout: 10000 });
  await page.click('.twd-chip__line');
  await waitCard(page, 'post');
  const c = await card(page);
  expect(c.text, 'the week’s rounds').toContain(DUTY.kinds.sort);
  expect(c.go).toBe(STAFF.go);
  expect(c.second, 'and the mailbox under it').toBe(STAFF.second.post);
  expect((await events(page, 'town_staff'))[0].door, 'from the note').toBe('note');
  expect(await page.evaluate(() => window.__town.duties.folded()), 'opening the card did not fold the note').toBe(false);
  await page.locator('.tw-card').screenshot({ path: SHOT + 'post.png' });
  await closeCard(page);

  // ── the briefcase folds it and brings it back
  await page.click('.twd-chip__badge');
  expect(await page.evaluate(() => window.__town.duties.folded())).toBe(true);
  await page.click('.twd-chip__badge');
  expect(await page.evaluate(() => window.__town.duties.folded())).toBe(false);

  // ── a café worker's note has today's tips on it at last
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.waitForFunction((t) => window.__town.duties.top() === t, DUTY.tips + ' 0/' + TIPS_DAY, { timeout: 5000 });
  expect(errs).toEqual([]);
});

test('a shut workplace still opens the card, and its button says why it cannot today', async ({ page }) => {
  test.setTimeout(60000);
  const errs = await town(page);
  await page.evaluate(() => window.__town.work.set({ at: 'cafe' }));
  await page.evaluate(() => window.__town.room.shutShop('cafe', true));
  expect(await page.evaluate(() => window.__town.room.shutNow('cafe')), 'the café is shut today').toBe(true);
  await stand(page, 1830, 1070);
  await page.evaluate(() => window.__town.open('cafe'));
  await waitCard(page, 'cafe');
  const c = await card(page);
  expect(c.text, 'your progress is still yours').toContain(STAFF.title.cafe);
  expect(c.text, 'and it says why').toContain(STAFF.shut);
  expect(c.goOff, 'Go to work cannot be pressed').toBe(true);
  expect(errs).toEqual([]);
});
