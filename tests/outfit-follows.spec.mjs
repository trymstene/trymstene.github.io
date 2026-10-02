// 👕 THE OUTFIT FOLLOWS YOU, ON THE SCREEN YOU ARE LOOKING AT (2 Oct 2026, design library §54).
//
// Trym: *"on my laptop my banana is styled clean with only a pigeon hat on my head, im now on my phone many hours later and
// here my banana has the red scarf and top hat on … Even checked the clothes shop in the town and the preview in the
// clothes shop shows my banana with a pigeon hat. Why are my banana wearing different clothes and wearables across
// devices?"* Every area dressed its banana once, at load, from this device's save; the sync from the other device landed a
// moment later (it is a fetch, at load and whenever the tab comes back) and changed the save, but nothing put it on — so
// the banana, and what the room was told, kept the old clothes while the clothes shop, reading the save, had the new ones.
//
// This walk is the phone. It saves the phone's old outfit, holds the sync's answer until the area has dressed it, lets the
// laptop's outfit land through the real pull (only the pass worker's reply is played here), and then the banana on screen
// and the room must both wear the laptop's. Nothing reaches a worker or a real player.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const PHONE = { hat: 'tophat', glasses: 'none', extras: { scarf: true } };   // what the phone had saved
const LAPTOP = { hat: 'pigeon', glasses: 'none', extras: {} };              // what the laptop put on since
const NOISE = /workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/;
const AREAS = [
  { name: 'town', url: '/town/?towntest&crowd=1', ready: () => !!(window.__town && window.__town.room && window.__town.room.band()), hook: '__town', me: '.tw-me' },
  { name: 'park', url: '/park/?parktest', ready: () => !!window.__park, hook: '__park', me: '#pkMe' },
  { name: 'beach', url: '/beach/?beachtest', ready: () => !!window.__bay, hook: '__bay', me: '#bhMe' },
  { name: 'homestead', url: '/homestead/?hstest=rich', ready: () => !!window.__hs, hook: '__hs', me: '#hsMe' },
  { name: 'rave', url: '/rave/', ready: () => !!document.querySelector('.rv-raver--me'), hook: null, me: '.rv-raver--me' },
];

for (const a of AREAS) {
  test(`${a.name}: the outfit another device put on is on your banana the moment the sync lands, and the room sees it`, async ({ page }) => {
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    const sent = [];   // every message the page sends its rooms
    await page.route(NOISE, (r) => r.abort());
    let release;
    const held = new Promise((ok) => { release = ok; });
    // the pass worker's answer to the pull, held until the area has dressed the phone's outfit (registered last: it wins)
    await page.route(/banana-pass\.trymstene\.workers\.dev\/pull/, async (r) => {
      await held;
      await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ blob: {
        pass: { created: Date.now() - 30 * 864e5, patches: {}, base: {}, led: {} }, shelf: [], shelfDel: {},
        bbLast: LAPTOP, bbAt: Date.now(),
      } }) });
    });
    await page.routeWebSocket(/workers\.dev/, (ws) => {
      ws.onMessage((m) => {
        let d = null; try { d = JSON.parse(String(m)); } catch (e) { return; }
        sent.push(d);
        // the club puts you on its floor only when its room names you: a roster of one
        if (d && d.t === 'hi' && a.name === 'rave') ws.send(JSON.stringify({ t: 'roster', you: 'qa-me', all: [{ id: 'qa-me', outfit: d.outfit || {}, name: '', joined: Date.now(), lvl: d.lvl }] }));
      });
    });
    await page.addInitScript(([phone, area]) => {
      if (sessionStorage.getItem('fit-seeded')) return;
      sessionStorage.setItem('fit-seeded', '1');
      localStorage.setItem('tt-internal', '1');
      localStorage.setItem('cookie-consent-v1', 'n');
      localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
      localStorage.setItem('rv-tour-v1', '1');
      localStorage.setItem('pass-v1', JSON.stringify({ created: Date.now() - 30 * 864e5, patches: {}, stats: { rep: 500 }, days: [] }));
      // the phone: signed in, its old outfit saved and seen long ago
      localStorage.setItem('pass-link', JSON.stringify({ credId: 'qa-cred', token: 'qa-token' }));
      localStorage.setItem('bb-last', JSON.stringify(phone));
      localStorage.setItem('bb-seen', JSON.stringify(phone));
      localStorage.setItem('bb-at', '1000');
      // a yard has its room only once it has an address: a claimed test yard with one (the room is played here, never real)
      if (area === 'homestead') localStorage.setItem('hs-v1', JSON.stringify({ v: 1, name: 'Testy’s Homestead', claimedAt: Date.now(), stage: 1, items: [], shed: [], bed: [null, null, null, null], slug: 'qa-yard' }));
    }, [PHONE, a.name]);
    await page.goto(a.url);
    await page.waitForFunction(a.ready, null, { timeout: 30000 });
    await page.waitForTimeout(1200);

    // before the sync: the banana wears what the phone had saved
    const wears = () => page.evaluate((h) => (h ? window[h].wears() : null), a.hook);
    if (a.hook) expect((await wears()).hat, 'the phone dressed its own save first').toBe('tophat');
    const hiBefore = sent.find((d) => d.t === 'hi' && d.outfit);
    expect(hiBefore, 'the area joined its room').toBeTruthy();
    expect(hiBefore.outfit.hat, 'and told the room so').toBe('tophat');
    const box = await page.locator(a.me).first().boundingBox();
    const clip = box && { x: Math.max(0, box.x - 50), y: Math.max(0, box.y - 60), width: box.width + 100, height: box.height + 90 };
    if (clip) await page.screenshot({ path: `test-results/outfit-follows-${a.name}-before.png`, clip });

    // the laptop's outfit lands
    const n0 = sent.length;
    release();
    // the laptop's outfit is the save (on the rave's floor a gift drop caught where the banana stands may sit on its head: the game)
    await expect.poll(() => page.evaluate((rave) => { const o = JSON.parse(localStorage.getItem('bb-last') || '{}'); return !(o.extras || {}).scarf && (o.hat === 'pigeon' || (rave && o.hat === 'djheadphones')); }, a.name === 'rave'), { timeout: 8000 }).toBe(true);
    if (a.hook) {
      await expect.poll(async () => (await wears()).hat, { timeout: 3000 }).toBe('pigeon');
      expect((await wears()).extras.scarf, 'the scarf came off').toBeFalsy();
    }
    await expect.poll(() => sent.slice(n0).some((d) => d.t === 'outfit' && d.outfit && d.outfit.hat === 'pigeon'), { timeout: 3000, message: 'the room is told' }).toBe(true);
    await page.waitForTimeout(500);
    if (clip) await page.screenshot({ path: `test-results/outfit-follows-${a.name}-after.png`, clip });
    expect(errs).toEqual([]);
  });
}

// 🎁 …and in every area the same things: the square drew nobody's Forge pieces, yours included, while the town's clothes
// shop and the other areas did. Real catalog pieces (tests/catalog-hands-fixture.json): the pink bow on you, both boxing
// gloves on a player who walks up.
test('town: your Forge piece is on your banana on the square, and another player\'s on theirs', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(NOISE, (r) => r.abort());
  await page.route('https://banana-share.trymstene.workers.dev/catalog/items.json', (r) => r.fulfill({ contentType: 'application/json', body: readFileSync(new URL('./catalog-hands-fixture.json', import.meta.url), 'utf8') }));
  let square = null;
  await page.routeWebSocket(/workers\.dev/, (ws) => { if (/\/town(\?|$)/.test(ws.url())) square = ws; });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('fit-seeded')) return;
    sessionStorage.setItem('fit-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('cookie-consent-v1', 'n');
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    localStorage.setItem('bb-last', JSON.stringify({ hat: 'none', glasses: 'none', extras: {}, c: 'c_3e2d0938cb' }));
  });
  await page.goto('/town/?towntest&crowd=1');
  await page.waitForFunction(() => !!(window.__town && window.__town.room && window.__town.room.band()), null, { timeout: 30000 });
  await expect.poll(() => page.evaluate(() => window.__town.wears().art), { timeout: 8000, message: 'the bow is in the drawing' }).toBe(1);
  await expect.poll(() => !!square, { timeout: 8000, message: 'the square has its room' }).toBe(true);
  const at = await page.evaluate(() => ({ x: (window.__town.pos.x + 70) / 2200 * 100, y: window.__town.pos.y / 1300 * 100 }));
  square.send(JSON.stringify({ t: 'join', p: { id: 'qa-peer', name: 'Glove Fan', x: at.x, y: at.y, room: '', outfit: { hat: 'none', glasses: 'none', extras: {}, c: 'c_18d4a0daa0,c_e43111617c' } } }));
  await expect(page.locator('.tw-peer')).toHaveCount(1);
  await page.waitForTimeout(800);   // the catalog is in; the peer redraws in its gloves
  const box = await page.locator('.tw-me').boundingBox();
  await page.screenshot({ path: 'test-results/outfit-follows-town-forge.png', clip: { x: Math.max(0, box.x - 60), y: Math.max(0, box.y - 50), width: box.width + 200, height: box.height + 80 } });
  expect(errs).toEqual([]);
});

test('another tab dresses the banana: this tab wears it too', async ({ context }) => {
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await context.route(NOISE, (r) => r.abort());
  await page.routeWebSocket(/workers\.dev/, () => {});
  await context.addInitScript(([phone]) => {
    if (sessionStorage.getItem('fit-seeded')) return;
    sessionStorage.setItem('fit-seeded', '1');
    localStorage.setItem('tt-internal', '1');
    localStorage.setItem('cookie-consent-v1', 'n');
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    localStorage.setItem('bb-last', JSON.stringify(phone));
  }, [PHONE]);
  await page.goto('/park/?parktest');
  await page.waitForFunction(() => !!window.__park, null, { timeout: 30000 });
  expect((await page.evaluate(() => window.__park.wears())).hat).toBe('tophat');
  const other = await context.newPage();   // the same browser, another tab: it writes the save
  await other.goto('/park/?parktest');
  await other.evaluate((fit) => localStorage.setItem('bb-last', JSON.stringify(fit)), LAPTOP);
  await expect.poll(() => page.evaluate(() => window.__park.wears().hat), { timeout: 3000 }).toBe('pigeon');
  expect(errs).toEqual([]);
});
