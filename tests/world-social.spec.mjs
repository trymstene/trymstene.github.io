// 👋 THE SOCIAL LAYER — echoes, waves and the waves badge, walked on the built site (26 Sep 2026, design library §42).
//
// Trym: "build it as something that stretches throughout the whole world and waves ofcourse". What must hold, in every
// area that has it (the rave never does):
//   · an echo is a real player from the address book, drawn in the world under their own name, and a tap opens THEIR
//     card — which says plainly they are not here — with Wave and Visit farm
//   · a wave is one tap, costs no typing, lands with the server under the echo's house, and your hand goes up
//   · waves waiting for you ring a round badge in the top-left column, UNDER the quest note, and its list waves back
//   · an echo never queues at the café, and never breaks the town's Quiet Rule (a name tag is not a word said)
// The server is stubbed here (worker-rave's own test proves it: worker-rave/test/social.test.mjs).
import { test, expect } from '@playwright/test';
import W from '../src/data/copy/world-social.json' with { type: 'json' };

const SHOT = 'test-results/social-';
const FIT = { hat: 'tophat', glasses: 'shades', extras: { bowtie: 1 } };
const ECHOES = [
  { slug: 'kiwi-orchard', house: 'Kiwi Orchard', n: 'Kiwi', fit: FIT, d: 0 },
  { slug: 'moss-meadow', house: 'Moss Meadow', n: 'Mossy', fit: { hat: 'crown', glasses: '', extras: {} }, d: 1 },
  { slug: 'pip-patch', house: 'Pip Patch', n: 'Pipsqueak', fit: { hat: 'party', glasses: 'nerd', extras: { balloons: 1 } }, d: 4 },
];
const NOTICES = [
  { k: 'wave', n: 'Kiwi', s: 'kiwi-orchard', h: '', fit: FIT, t: Date.now() - 3 * 3600000 },
  { k: 'wave', n: '', s: '', h: 'a1b2c3d4e5f6', fit: { hat: 'party' }, t: Date.now() - 26 * 3600000 },
];
const GID = '0123456789abcdef';

async function area(page, url, opts = {}) {
  const errs = [], waves = [], seen = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  if (opts.w) await page.setViewportSize({ width: opts.w, height: opts.h || 740 });
  await page.addInitScript((gid) => {
    try {
      // a pass with a good proof, as every visitor has once they have done anything (the notices need it)
      localStorage.setItem('world-gid', gid);
      localStorage.setItem('world-wt', gid + '.' + (Date.now() + 86400000) + '..' + 'ab'.repeat(32));
      localStorage.setItem('ps-name-v1', 'Tester');
      localStorage.removeItem('bw-social-v1');
    } catch (e) {}
  }, GID);
  await page.route('**/yards/echoes*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ echoes: opts.echoes || ECHOES }) }));
  await page.route('**/yards/notices', (r) => { const b = JSON.parse(r.request().postData() || '{}'); if (b.seen) seen.push(1); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ notices: opts.notices || [], seen: 0, echo: 1 }) }); });
  await page.route('**/yards/wave', (r) => { waves.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ contentType: 'application/json', body: '{"ok":1}' }); });
  await page.route('**/yards/echo', (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":1,"echo":0}' }));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bws, null, { timeout: 30000 });
  return { errs, waves, seen };
}
// where your own banana stands, in world px: the park and the homestead keep it on the element (cx, cy), the bay as %
const mePos = (page, sel, W, H) => page.evaluate(([s, w, h]) => { const el = document.querySelector(s); if (el.cx != null) return { x: el.cx, y: el.cy }; return { x: parseFloat(el.style.left) / 100 * w, y: parseFloat(el.style.top) / 100 * h }; }, [sel, W, H]);
// a real tap (pointerdown, pointerup, click) in the middle of a banana's body
async function tapBanana(page, sel) {
  const r = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.6 }; }, sel);
  expect(r, sel + ' is on the page').not.toBeNull();
  await page.mouse.click(r.x, r.y);
}

test('the park: an echo stands about under its own name, and its card waves', async ({ page }) => {
  const { errs, waves } = await area(page, '/park/');
  await page.waitForFunction(() => window.__bws.echoes().length === 3, null, { timeout: 15000 });
  // ⚠️ the park sends its own echoes out on its own clock too, so this one is picked out by its house, never by being first
  const slug = await page.evaluate(() => { window.__bws.hold(); return window.__bws.spawn().at(-1); });
  const SEL = '.bws-echo[data-slug="' + slug + '"]';
  await page.waitForFunction((s) => !!document.querySelector(s + '.is-on'), SEL, { timeout: 5000 });
  await page.waitForTimeout(1400);
  const echo = await page.evaluate((s) => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); return { name: el.querySelector('.bws-tag').textContent, slug: el.dataset.slug, w: r.width, op: +getComputedStyle(el).opacity, shown: getComputedStyle(el).display !== 'none' }; }, SEL);
  expect(echo.shown, 'the echo is drawn (the park’s cull sweep leaves it alone)').toBe(true);
  expect(echo.w, 'a banana-sized banana').toBeGreaterThan(20);
  expect(echo.op, '⭐ an echo is see-through: not here, and it looks it').toBeLessThan(0.9);
  expect(ECHOES.map((e) => e.n)).toContain(echo.name);
  // stand it beside you, where the camera is, and tap it
  const me = await mePos(page, '#pkMe', 2760, 1100);
  await page.evaluate(([x, y, s]) => window.__bws.put(x, y, s), [me.x + 130, me.y, slug]);
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT + 'park-echo.png' });
  await tapBanana(page, SEL);
  await page.waitForFunction(() => !!document.querySelector('.bws-card'), null, { timeout: 4000 });
  await page.waitForTimeout(400);   // the card's own pop-in, so the picture is of the card and not of it arriving
  const card = await page.evaluate(() => { const c = document.querySelector('.bws-card'); return { h: c.querySelector('h2').textContent, say: c.querySelector('.bws-say').textContent, role: c.querySelector('.bws-role').textContent, visit: c.querySelector('.bws-alt').getAttribute('href') }; });
  expect(card.h).toBe(echo.name);
  expect(card.say, '⭐ the card says plainly they are not here, in one short line').toBe(W.card.away);
  expect(card.visit).toBe('/homestead/?yard=' + echo.slug);
  await page.screenshot({ path: SHOT + 'park-card.png' });
  // ⭐ Trym, 26 Sep: "buttons consistent in size and centered … dont take more view than needed" — the card's two
  // buttons are one row of two equal buttons, each one line, and the card is no bigger than it needs to be
  const geo = await page.evaluate(() => {
    const [g, a] = [...document.querySelectorAll('.bws-go, .bws-alt')].map((b) => b.getBoundingClientRect());
    const c = document.querySelector('.bws-card').getBoundingClientRect(), v = document.querySelector('#pkView').getBoundingClientRect();
    return { gw: g.width, aw: a.width, gh: g.height, ah: a.height, gt: g.top, at: a.top, cw: c.width, ch: c.height, vh: v.height, gap: (c.right - a.right) - (g.left - c.left) };
  });
  expect(Math.abs(geo.gw - geo.aw), 'the two buttons are the same width').toBeLessThan(1);
  expect(geo.gh, 'the same height').toBe(geo.ah);
  expect(geo.gh, 'one line each').toBeLessThan(44);
  expect(geo.gt, 'side by side on one row').toBe(geo.at);
  expect(Math.abs(geo.gap), 'and the row sits centred in the card').toBeLessThan(2);
  expect(geo.cw, 'the card is narrow').toBeLessThanOrEqual(300);
  expect(geo.ch, 'and short: well under a third of the world').toBeLessThan(geo.vh / 3);
  // ⭐ ONE CENTRE: the name and the line under it sit on the middle between the two buttons (Trym, 26 Sep: "it should
  // align with the center between the two buttons"); a NEW sticker hangs off the name and never moves it
  const mid = await page.evaluate(() => {
    const text = (el) => { const r = document.createRange(); r.setStart(el, 0); r.setEnd(el, el.childNodes.length); const b = r.getBoundingClientRect(); return b.left + b.width / 2; };
    const nm = document.querySelector('.bws-nm'), words = document.createRange();
    words.selectNodeContents(nm.firstChild); const w = words.getBoundingClientRect();
    const [g, a] = [...document.querySelectorAll('.bws-go, .bws-alt')].map((x) => x.getBoundingClientRect());
    return { name: w.left + w.width / 2, role: text(document.querySelector('.bws-role')), say: text(document.querySelector('.bws-say')), buttons: (g.left + a.right) / 2 };
  });
  expect(Math.abs(mid.name - mid.buttons), 'the name sits on the middle between the buttons').toBeLessThan(2);
  expect(Math.abs(mid.role - mid.buttons), '…and so does the line under it').toBeLessThan(2);
  expect(Math.abs(mid.say - mid.buttons), '…and the line below').toBeLessThan(2);
  const roleH = await page.evaluate(() => document.querySelector('.bws-role').getBoundingClientRect().height);
  expect(roleH, '…and is one line, never an orphan word under it').toBeLessThan(20);
  await page.click('.bws-go');
  await expect(page.locator('.bws-go span')).toHaveText(W.card.waved, { timeout: 4000 });
  expect(waves.length, 'the wave went to the server').toBe(1);
  expect(waves[0].to, '…addressed to the echo’s house').toBe(echo.slug);
  expect(waves[0].wt, '…with the sender’s proof').toMatch(/^0123456789abcdef\./);
  expect(waves[0].n, '…under the name they chose').toBe('Tester');
  expect(await page.locator('#pkMe .bws-hand').count(), 'and your own hand goes up').toBe(1);
  await page.screenshot({ path: SHOT + 'park-waved.png' });
  // the first wave you send brings Nib's welcome, so the badge has said what it is for
  await page.click('.bws-x');
  await expect(page.locator('.bws__b'), 'the badge shows (its anchor is a 0×0 point, like a folded note)').toBeVisible({ timeout: 3000 });
  expect(await page.locator('.bws__n').textContent()).toBe('1');
  expect(errs).toEqual([]);
});

test('the park: waves waiting ring the badge under the quest note, and its list waves back', async ({ page }) => {
  const { errs, waves, seen } = await area(page, '/park/', { notices: NOTICES });
  await page.waitForFunction(() => window.__bws.unread() >= 2, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const col = await page.evaluate(() => {
    const bb = document.querySelector('.bws__b'), b = bb.getBoundingClientRect(), q = document.querySelector('.bwq-hint');
    const qr = q && getComputedStyle(q).display !== 'none' ? (q.classList.contains('is-min') ? q.querySelector('.bwq-hint__badge') : q).getBoundingClientRect() : null;
    return { w: bb.offsetWidth, h: bb.offsetHeight, top: b.top, left: b.left, n: document.querySelector('.bws__n').textContent, under: qr ? b.top >= qr.bottom - 1 : true, qBottom: qr && qr.bottom };
  });
  expect(col.w, '§28: the same 32 px circle as the quest badge').toBe(32);
  expect(col.h).toBe(32);
  expect(col.n, 'three new: two waves and Nib’s welcome under them').toBe('3');
  expect(col.under, 'the badge sits UNDER the quest note, never on it').toBe(true);
  await page.screenshot({ path: SHOT + 'park-badge.png' });
  await page.click('.bws__b');
  await expect(page.locator('.bws-list')).toBeVisible();
  const rows = await page.evaluate(() => [...document.querySelectorAll('.bws-li')].map((li) => li.textContent));
  expect(rows.length).toBe(3);
  expect(rows[0], 'newest first, by name').toContain('Kiwi');
  expect(rows[1], 'a wave from a banana with no name yet').toContain(W.list.someone);
  expect(rows[2], 'Nib’s welcome at the bottom').toContain(W.list.welcome.slice(0, 20));
  expect(seen.length, 'opening the list tells the server you looked').toBe(1);
  expect(await page.locator('.bws-me input').isChecked(), 'the echo switch shows, on').toBe(true);
  await page.screenshot({ path: SHOT + 'park-list.png' });
  // wave back at the one with no house: by handle
  await page.locator('.bws-back').nth(1).click();
  await expect(page.locator('.bws-back').nth(1)).toHaveText(W.list.backed, { timeout: 4000 });
  expect(waves.at(-1).h, 'a wave back to a banana with no house goes by handle').toBe('a1b2c3d4e5f6');
  // ⭐ every Wave back is the same button in the same column, whatever the row says; every row is one height
  const grid = await page.evaluate(() => ({
    backs: [...document.querySelectorAll('.bws-back')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width), Math.round(r.height)]; }),
    rows: [...document.querySelectorAll('.bws-li:not(.is-hi)')].map((li) => Math.round(li.getBoundingClientRect().height)),
  }));
  expect(new Set(grid.backs.map((b) => b.join(','))).size, 'one column, one size: ' + JSON.stringify(grid.backs)).toBe(1);
  expect(new Set(grid.rows).size, 'every wave row the same height: ' + JSON.stringify(grid.rows)).toBe(1);
  // the list lays out at the house's narrowest phone too: every row one height band, nothing off the card
  const fit = await page.evaluate(() => { const l = document.querySelector('.bws-list').getBoundingClientRect(); return { right: l.right, vw: innerWidth }; });
  expect(fit.right, 'the list stays on screen').toBeLessThanOrEqual(fit.vw);
  // a tap elsewhere folds it away and does not walk the banana
  await page.mouse.click(250, 500);
  await expect(page.locator('.bws-list')).toBeHidden();
  expect(errs).toEqual([]);
});

test('the town: two of the visitors are echoes, named, silent otherwise, and never at the café', async ({ page }) => {
  const { errs } = await area(page, '/town/?towntest&social=1');
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.folkReady, null, { timeout: 30000 });
  await page.evaluate(() => window.__town.room.folkReady());
  await page.waitForFunction(() => window.__bws.echoes().length === 3, null, { timeout: 15000 });
  await page.evaluate(() => window.__town.room.folk().fill(5, performance.now()));
  await page.waitForTimeout(1200);
  const town = await page.evaluate(() => ({
    echoes: [...document.querySelectorAll('.tw-visitor.bws-echo')].map((el) => ({ tag: el.querySelector('.bws-tag') && el.querySelector('.bws-tag').textContent, kids: el.children.length })),
    plain: document.querySelectorAll('.tw-visitor:not(.bws-echo)').length,
    idle: window.__town.room.folk().idle(),
    walking: window.__town.room.folk().folk().filter((v) => !v.echo && !v.sitting && v.job !== 'leave' && !v.hidden).length,
  }));
  // ⚠️ how many visitors the town lets in depends on how it is doing (town-folk CROWD), so the count is relative
  const total = town.echoes.length + town.plain;
  expect(total, 'the town let visitors in').toBeGreaterThan(0);
  expect(town.echoes.length, '⭐ echoes come first, and never more than two in town at once').toBe(Math.min(2, total));
  for (const e of town.echoes) expect(e.kids, 'a canvas and a name tag, nothing else').toBe(2);
  expect(town.idle, 'the café may borrow the nameless ones and never a player’s echo').toBe(town.walking);
  // sit one down on a bench (the town's own hook for a sitter), stand beside it, and tap it
  const sat = await page.evaluate(() => {
    const f = window.__town.room.folk(), i = f.folk().findIndex((v) => v.echo);
    const b = f.benches().find((x) => !x.taken) || f.benches()[0];
    const at = f.seat(i, b.key);
    const t = window.__town; t.pos.x = t.tgt.x = at.x + 90; t.pos.y = t.tgt.y = at.y + 30;
    return { slug: f.folk()[i].echo, ...at };
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SHOT + 'town-echoes.png' });
  await tapBanana(page, '.tw-visitor.bws-echo[data-slug="' + sat.slug + '"]');
  await page.waitForFunction(() => !!document.querySelector('.bws-card'), null, { timeout: 4000 });
  await page.screenshot({ path: SHOT + 'town-card.png' });
  expect(errs).toEqual([]);
});

test('the homestead: an echo strolls the road past your gate', async ({ page }) => {
  const { errs } = await area(page, '/homestead/');
  await page.waitForFunction(() => window.__bws.echoes().length === 3, null, { timeout: 15000 });
  await page.evaluate(() => window.__bws.spawn());
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => { const el = document.querySelector('.bws-echo'); return el ? { top: parseFloat(el.style.top) } : null; });
  expect(s, 'an echo is out').not.toBeNull();
  expect(Math.abs(s.top - 900 / 1100 * 100), 'on the road').toBeLessThan(3);
  // ⭐ it walks on the frame, like every banana (Trym, 28 Sep 2026: "choppy in their movements, not fluid movement like
  // normal"): sampled on every animation frame it moves on nearly every one and never hops — the old stroll was 8.4 px
  // every 120 ms, and still for the seven frames between
  const film = await page.evaluate(() => new Promise((res) => {
    const el = document.querySelector('.bws-echo'), out = [], t0 = performance.now();
    const tick = () => { out.push(parseFloat(el.style.left) / 100 * 1800); if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(out); };
    requestAnimationFrame(tick);
  }));
  const steps = film.slice(1).map((x, i) => Math.abs(x - film[i]));
  expect(steps.filter((d) => d > 0.01).length / steps.length, 'it moves on nearly every frame (' + steps.length + ' frames)').toBeGreaterThan(0.8);
  expect(Math.max(...steps), 'and never hops').toBeLessThan(4);
  // bring it past the gate, where you can see it, and watch it walk on
  const me = await mePos(page, '#hsMe', 1800, 1100);
  await page.evaluate((x) => window.__bws.put(x, 900), me.x + 160);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOT + 'homestead-echo.png' });
  expect(errs).toEqual([]);
});

test('the beach: an echo stands on the sand', async ({ page }) => {
  const { errs } = await area(page, '/beach/');
  await page.waitForFunction(() => window.__bws.echoes().length === 3, null, { timeout: 15000 });
  for (let i = 0; i < 2; i++) await page.evaluate(() => window.__bws.spawn());
  await page.waitForTimeout(1500);
  expect(await page.locator('.bws-echo.is-on').count(), 'two echoes, the most an area has at once').toBe(2);
  const me = await mePos(page, '#bhMe', 2760, 1100);
  await page.evaluate(([x, y]) => window.__bws.put(x, y), [me.x + 140, me.y - 20]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + 'beach-echo.png' });
  expect(errs).toEqual([]);
});

// 🌱 A NEW BANANA (26 Sep 2026, Trym: "build the new banana markers so regulars can welcome newcomers"): an echo of a
// farm claimed in the last three days wears a small NEW chip after its name, and its card says so beside the name
test('the park: a new banana’s echo says NEW on its tag and its card', async ({ page }) => {
  const NEW = [{ slug: 'fresh-fields', house: 'Fresh Fields', n: 'Sprout', fit: { hat: 'party' }, d: 0, nw: 1 }];
  const { errs } = await area(page, '/park/', { echoes: NEW });
  await page.waitForFunction(() => window.__bws.echoes().length === 1, null, { timeout: 15000 });
  await page.evaluate(() => { window.__bws.hold(); window.__bws.spawn(); });
  await page.waitForFunction(() => !!document.querySelector('.bws-echo[data-new] .bws-tag'), null, { timeout: 5000 });
  const chip = await page.evaluate(() => getComputedStyle(document.querySelector('.bws-echo[data-new] .bws-tag'), '::after').content);
  expect(chip, 'the tag wears the word from the copy file').toBe(JSON.stringify(W.card.new));
  await page.evaluate(() => window.__bws.open('fresh-fields'));
  await expect(page.locator('.bws-card h2 .bws-new')).toHaveText(W.card.new);
  await page.waitForTimeout(400);
  const c = await page.evaluate(() => {
    const words = document.createRange(); words.selectNodeContents(document.querySelector('.bws-nm').firstChild);
    const w = words.getBoundingClientRect(), chip = document.querySelector('.bws-card .bws-new').getBoundingClientRect();
    const [g, a] = [...document.querySelectorAll('.bws-go, .bws-alt')].map((x) => x.getBoundingClientRect());
    return { name: w.left + w.width / 2, buttons: (g.left + a.right) / 2, chipLeft: chip.left, nameRight: w.right, chipH: chip.height };
  });
  expect(Math.abs(c.name - c.buttons), 'the sticker never moves the name off the middle').toBeLessThan(2);
  expect(c.chipLeft, 'it hangs just after the name').toBeGreaterThan(c.nameRight);
  expect(c.chipH, 'and it is small, one line of three letters (hung off the name it once stacked N-E-W)').toBeLessThan(14);
  const me = await mePos(page, '#pkMe', 2760, 1100);
  await page.evaluate(([x, y]) => window.__bws.put(x, y, 'fresh-fields'), [me.x + 120, me.y]);
  await page.locator('.bws-x').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOT + 'park-new-echo.png' });
  expect(errs).toEqual([]);
});
