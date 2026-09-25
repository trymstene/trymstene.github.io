// 🕹 THE ARCADE PLAYS FAIR (25 Sep 2026). Trym, after a run of Banana Invaders: "i got "swarmed" in this scenario - not
// close to a bullet, and the swarm was still high up … also, should be able to use S key to shoot so you dont have to tap
// mousepad to shoot. hopefully none of the other games has these kind of issues". It was a fly's drop: the zone that
// counted reached 30 px over the banana and 16 to each side, the drop was drawn UNDER the banana, and the end had one word
// for both ways to lose. Every game now ends only on what is drawn touching the banana, says which end it was, plays from
// the keyboard, and takes the press for another go as only that.
import { test, expect } from '@playwright/test';
import W from '../src/data/copy/town-games.json' with { type: 'json' };

const PY = 396;   // Banana Invaders: the banana's row
const st = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__town.arcade.game().state())));
const set = (page, fn) => page.evaluate((src) => { (0, eval)('(' + src + ')')(window.__town.arcade.game().state()); }, fn.toString());
const dead = (page) => page.waitForFunction(() => window.__town.arcade.game().state().dead, null, { timeout: 5000 });
const drawn = (page) => page.evaluate(() => window.__drawn.splice(0));   // every word the game canvas drew since the last read

async function arcade(page, spot) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/arcade/board**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ top: [], week: [], players: 0 }) }));
  await page.addInitScript(() => {
    window.__drawn = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (s, ...a) {
      if (this.canvas && this.canvas.id === 'twArc') { window.__drawn.push(String(s)); if (window.__drawn.length > 400) window.__drawn.shift(); }
      return fill.call(this, s, ...a);
    };
  });
  await page.goto('/town/?towntest', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(300);
  await page.evaluate((k) => window.__town.arcade.play(k), spot);
  await page.waitForFunction(() => { const g = window.__town.arcade.game(); return !!(g && g.state && g.state()); }, null, { timeout: 15000 });
  await page.waitForTimeout(250);
  return errs;
}

test('Banana Invaders: a drop falling past the banana misses, one landing on it is HIT! and ringed, the swarm is SWARMED; S throws, D slides', async ({ page }) => {
  const errs = await arcade(page, 'g3');
  expect(await drawn(page), 'a computer is told its keys').toContain(W.startKeys.invaders);
  await page.keyboard.press('KeyS');
  let s = await st(page);
  expect(s.started, 'S starts the run').toBe(true);
  expect(s.shots.length, 'and throws a peel').toBe(1);
  await set(page, (s) => { s.acc = -1e9; s.bombs = []; });   // the flies hold still and drop nothing: the only drops are this test's
  const x0 = s.x;
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  s = await st(page);
  expect(s.x - x0, 'D held slides at one steady speed (it was a 14-px jump per key repeat)').toBeGreaterThan(60);
  // Trym's case: a drop falling past the banana's side, 14 px left of its middle — 3 px clear of what is drawn
  await set(page, (s) => { s.x = 150; s.bombs = [{ x: 136, y: 300 }]; });
  await page.waitForFunction(() => { const s = window.__town.arcade.game().state(); return s.dead || !s.bombs.length; }, null, { timeout: 5000 });
  expect((await st(page)).dead, 'a drop that falls past the banana is a miss').toBe(false);
  // one straight over it lands, and the run ends where it met the banana, never in the air 30 px over it
  await set(page, (s) => { s.bombs = [{ x: s.x + 1, y: 330 }]; });
  await dead(page);
  s = await st(page);
  expect(s.deadBy).toBe('drop');
  expect(s.hit.y, 'the drop is on the banana').toBeGreaterThan(PY - 12);
  await drawn(page);
  await page.waitForTimeout(1400);
  const d = await drawn(page);
  expect(d, 'the end says what happened').toContain(W.end.invadersHit);
  expect(d, 'never the swarm’s word for a drop').not.toContain(W.end.invadersSwarmed);
  expect(d, 'and how to go again on a computer').toContain(W.againKeys);
  await page.locator('#twArc').screenshot({ path: 'test-results/arcade-invaders-hit.png' });
  // Space is another go — and only that: the same press throws nothing in the new run
  await page.keyboard.press('Space');
  s = await st(page);
  expect(s.dead, 'Space is another go').toBe(false);
  expect(s.started || s.shots.length > 0, 'and plays nothing in it').toBe(false);
  // the swarm: the flies come all the way down
  await page.keyboard.press('KeyS');
  await set(page, (s) => { s.acc = -1e9; s.bombs = []; s.flies.forEach((f) => { f.y = 364; }); });   // 32 px over the banana's row
  await dead(page);
  expect((await st(page)).deadBy).toBe('swarm');
  await page.waitForTimeout(300);
  expect(await drawn(page)).toContain(W.end.invadersSwarmed);
  expect(errs).toEqual([]);
});

test('Banana Snake: the edge and its own peel end it in their own words; two quick turns are both kept; the tail can be followed', async ({ page }) => {
  const errs = await arcade(page, 'g2');
  expect(await drawn(page)).toContain(W.startKeys.snake);
  await page.keyboard.press('ArrowRight');
  // up, then left, inside one step: both happen, a square apart (the second was refused as a U-turn)
  await set(page, (s) => { s.body = [{ x: 7, y: 11 }, { x: 6, y: 11 }, { x: 5, y: 11 }]; s.dir = s.nextDir = { x: 1, y: 0 }; s.turns = []; s.acc = 0; s.jelly = { x: 0, y: 0 }; s.gold = null; });
  await page.evaluate(() => { for (const code of ['ArrowUp', 'ArrowLeft']) window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true })); });
  await page.waitForFunction(() => { const s = window.__town.arcade.game().state(); return s.dead || s.body[0].x <= 6; }, null, { timeout: 3000 });
  let s = await st(page);
  expect(s.dead).toBe(false);
  expect(s.body[0].y, 'the first turn: a square up').toBe(10);
  expect(s.dir, 'the second: now going left').toEqual({ x: -1, y: 0 });
  // a ring chasing its own tail lives: the tail's square is free as the head comes in
  await set(page, (s) => { s.body = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }]; s.dir = s.nextDir = { x: 1, y: 0 }; s.turns = []; s.acc = 0; s.jelly = { x: 0, y: 0 }; s.gold = null; });
  await page.waitForFunction(() => { const s = window.__town.arcade.game().state(); return s.dead || s.body[0].x === 6; }, null, { timeout: 3000 });
  expect((await st(page)).dead, 'into the square its tail is leaving').toBe(false);
  // the edge
  await set(page, (s) => { s.body = [{ x: 14, y: 11 }, { x: 13, y: 11 }, { x: 12, y: 11 }]; s.dir = s.nextDir = { x: 1, y: 0 }; s.turns = []; });
  await dead(page);
  expect((await st(page)).deadBy).toBe('edge');
  await drawn(page);
  await page.waitForTimeout(900);
  let d = await drawn(page);
  expect(d).toContain(W.end.snakeEdge);
  expect(d, 'the edge is not a bite').not.toContain(W.end.snakeBit);
  await page.locator('#twArc').screenshot({ path: 'test-results/arcade-snake-edge.png' });
  // its own peel
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await set(page, (s) => { s.body = [{ x: 6, y: 5 }, { x: 6, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }]; s.dir = s.nextDir = { x: 0, y: 1 }; s.turns = []; s.jelly = { x: 0, y: 0 }; s.gold = null; });
  await dead(page);
  expect((await st(page)).deadBy).toBe('self');
  await page.waitForTimeout(900);
  d = await drawn(page);
  expect(d).toContain(W.end.snakeBit);
  expect(errs).toEqual([]);
});

test('Peel Out: a vine ends the run where it is drawn, never in the air beside it', async ({ page }) => {
  const errs = await arcade(page, 'g1');
  expect(await drawn(page)).toContain(W.startKeys.peelout);
  await page.keyboard.press('KeyW');
  expect((await st(page)).started, 'W flaps').toBe(true);
  // hold the banana level at y 200 and send one piece past it; no other piece comes
  await page.evaluate(() => { window.__hold = 200; const hold = () => { const s = window.__town.arcade.game().state(); if (!s.dead) { s.y = window.__hold; s.vy = 0; } requestAnimationFrame(hold); }; requestAnimationFrame(hold); });
  // the vine's tip 2 px over the banana's head: the old box reached 6 px over it and ended the run here
  await set(page, (s) => { s.next = 1e9; s.pieces = [{ x: 130, top: 188, bot: 380, leaf: 0, passed: false }]; });
  await page.waitForFunction(() => { const s = window.__town.arcade.game().state(); return s.dead || s.score >= 1; }, null, { timeout: 5000 });
  let s = await st(page);
  expect(s.dead, 'under the tip, clear of it: through').toBe(false);
  expect(s.score).toBe(1);
  // the bunch hanging into the banana: that is a hit
  await set(page, (s) => { s.pieces = [{ x: 130, top: 202, bot: 380, leaf: 1, passed: false }]; });
  await dead(page);
  await page.waitForTimeout(1000);
  expect(await drawn(page)).toContain(W.end.peelout);
  await page.locator('#twArc').screenshot({ path: 'test-results/arcade-peelout-splat.png' });
  expect(errs).toEqual([]);
});

test('Banana Pong: the coin turns back on your peel, not in the air over it; A and D slide it smoothly', async ({ page }) => {
  const errs = await arcade(page, 'g4');
  expect(await drawn(page)).toContain(W.startKeys.pong);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  const s = await st(page);
  expect(s.started, 'a key starts it').toBe(true);
  expect(s.mx - 150, 'D held slides the peel steadily').toBeGreaterThan(50);
  // a coin straight down onto the peel: the lowest its middle gets before it turns
  const low = await page.evaluate(() => new Promise((res) => {
    const g = window.__town.arcade.game(), t = g.state();
    t.hold = 0; t.bx = t.mx; t.by = 360; t.vx = 0; t.vy = 200; t.speed = 200;
    let max = 0; const watch = () => { const u = g.state(); max = Math.max(max, u.by); if (u.vy < 0) res(max); else requestAnimationFrame(watch); };
    requestAnimationFrame(watch);
  }));
  expect(low, 'its bottom edge (5 px under its middle) meets the peel’s top at 410; it turned 9 px over it before').toBe(404);
  expect(errs).toEqual([]);
});

test('Banana Stack: the crate swings before the first drop, a held key drops one crate, and the tap for another go drops nothing', async ({ page }) => {
  const errs = await arcade(page, 'g5');
  expect(await drawn(page)).toContain(W.startKeys.stack);
  const x0 = (await st(page)).cur.x;
  await page.waitForTimeout(300);
  expect((await st(page)).cur.x, 'swinging already: the first press is a real drop').not.toBe(x0);
  await set(page, (s) => { s.cur.x = 90; s.cur.dir = 1; });   // over the base
  await page.evaluate(() => { for (let i = 0; i < 12; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: i > 0, bubbles: true, cancelable: true })); });
  let s = await st(page);
  expect(s.tower.length, 'a held Space drops one crate, not the run').toBe(2);
  expect(s.tower[1].w, 'dropped where it was, over the base').toBeGreaterThan(100);
  await set(page, (s) => { s.cur.x = 260; s.cur.dir = 1; });   // far off the tower
  await page.keyboard.press('KeyS');
  await dead(page);
  await page.waitForTimeout(900);
  await page.locator('#twArc').click();
  s = await st(page);
  expect(s.dead, 'the tap is another go').toBe(false);
  expect(s.tower.length + ' crates, started: ' + s.started, 'and drops nothing in it').toBe('1 crates, started: false');
  await page.locator('#twArc').click();
  expect((await st(page)).tower.length, 'the next tap is the first drop').toBe(2);
  expect(errs).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('the games say tap, and a tap after the end is another go', async ({ page }) => {
    const errs = await arcade(page, 'g3');
    expect(await drawn(page), 'a thumb is told to tap').toContain(W.start.invaders);
    await page.locator('#twArc').tap();
    expect((await st(page)).started, 'a tap throws').toBe(true);
    await set(page, (s) => { s.acc = -1e9; s.bombs = [{ x: s.x, y: 330 }]; });
    await dead(page);
    await page.waitForTimeout(1400);
    const d = await drawn(page);
    expect(d).toContain(W.end.invadersHit);
    expect(d).toContain(W.again);
    await page.locator('#twArc').screenshot({ path: 'test-results/arcade-invaders-hit-phone.png' });
    await page.locator('#twArc').tap();
    expect((await st(page)).dead).toBe(false);
    expect(errs).toEqual([]);
  });
});
