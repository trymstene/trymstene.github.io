// 🕹 THE ARCADE CREW'S KIT: the town staged at the arcade, a cabinet's game opened through the town's own QA seam
// (window.__town.arcade.play), and a player for each game. A player reads the screen (the game's own state(), the way
// the town's walks read it) and answers with REAL keys through Playwright's keyboard — the game never has a value set
// on it, so every run on film is a run the game itself played out. The clock is paused at a fixed instant before the
// game opens: the games seed their dice from Date.now(), so a take is the same take every time it is filmed.
import fs from 'node:fs';
import path from 'node:path';
import { stage, css, cssStep, CAP } from './harness.mjs';

// 🎞 TWO ANIMATION FRAMES PER FILM FRAME. Playwright's fake clock fires requestAnimationFrame on a 16 ms grid
// (getTimeToNextFrame = 16 - ticks % 16), so roll()'s 33/33/34 ms steps give the games two rAF steps per film frame and,
// every twelfth frame, three: a crate or a peel jumps half as far again, a hitch every 0.4 s. A 32 ms step is always
// exactly two, so motion is even; the cost is that 32 ms of play fills 33.3 ms of film (0.96x, invisible).
export const STEP = 32;
// roll()'s twin at 32 ms a frame — and, like roll(), every CSS animation (a lamp's glow breathing over 2.6 s) held and
// stepped with the clock by the harness's cssStep, so it moves at the speed a player sees
export async function rollEven(page, { name, secs, fps = 30, clip = null, each = null }) {
  const dir = path.join(CAP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(secs * fps);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    if (each) await each(i, i / fps);
    await page.clock.runFor(STEP);
    await cssStep(page, STEP);
    await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png'), clip: clip || undefined, animations: 'allow', caret: 'hide' });
  }
  const meta = { name, frames: n, fps, stepMs: STEP, clip, secsReal: Math.round((Date.now() - t0) / 100) / 10 };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  return dir;
}

export const PLAIN = () => {
  try {
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    localStorage.setItem('bb-last', JSON.stringify({ hat: 'none', glasses: 'none', extras: {}, effect: 'none', c: '' }));
  } catch (e) {}
};

// the board under the screen is the pass worker's (/arcade/board): a fictional one, initials only — none of them a resident's
// name (Pip, Dot…) or a known player's
const BOARD = {
  peelout: [['ZAP', 41], ['KOI', 33], ['MEL', 27], ['ACE', 19], ['RAY', 12]],
  snake: [['ZAP', 38], ['MEL', 31], ['KOI', 24], ['BUD', 17], ['RAY', 11]],
  invaders: [['KOI', 64], ['ZAP', 52], ['BUD', 40], ['MEL', 29], ['RAY', 18]],
  pong: [['MEL', 14], ['ZAP', 11], ['KOI', 9], ['BUD', 6], ['RAY', 4]],
  stack: [['BUD', 44], ['KOI', 37], ['ZAP', 30], ['MEL', 22], ['RAY', 15]],
};
export async function boardStub(page) {
  await page.route('**/arcade/board**', (r) => {
    const g = new URL(r.request().url()).searchParams.get('game') || 'snake';
    const rows = (BOARD[g] || BOARD.snake).map(([n, s], i) => ({ n, s, at: 1790000000000 + i * 3600000 }));
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ game: g, wk: '2026-W40', players: 23, runs: 312, top: rows, week: rows.slice(0, 4) }) });
  });
}

// 🎥 THE CABINET'S SCREEN, FILMED: the card stands in a tall view so nothing in it scrolls, the toast never crosses it, and
// the screen box is 306 px so its canvas shows at exactly 300 x 440 CSS px — one game pixel = 4 x 4 device pixels at DPR 4
// (the page's own 294 px would scale the game by 0.98 and leave a ragged pixel column every 50)
export const CARD_RULES = [
  '.tw-wrap{max-width:none!important;padding:0!important}', '.tw-stage{box-shadow:none!important;border:0!important}',
  '.tw-sign,.tw-tag{display:none!important}', '.tw-view{height:960px!important}',
  '.tw-toast{visibility:hidden!important}', '.tw-arc{max-width:306px!important}',
];
export const CARD_VIEW = { viewport: { width: 520, height: 1000 }, deviceScaleFactor: 4, hasTouch: true };   // hasTouch: the screen's words are a phone's ("tap…")
export async function screenClip(page) {
  const b = await page.locator('.tw-arc').boundingBox();
  return { x: Math.floor(b.x), y: Math.floor(b.y), width: Math.round(b.width), height: Math.round(b.height) };
}

// the town at the arcade: loaded, the day pinned, the door walked through
// (15:00 pinned: the afternoon beat, when Spinner keeps the arcade from behind its prize desk — town-life.js MECH)
export async function arcadeTown(page, { time = '2026-10-01T15:00:00', rules = [], enter = true } = {}) {
  await stage(page, { url: '/town/?towntest', time, init: PLAIN, stub: boardStub });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 60000 });
  await page.evaluate(() => { const t = window.__town; t.room.curse('none'); t.wx('clear'); t.room.set(90); t.life.set(15); });
  if (rules.length) await css(page, rules.join(''));
  await page.waitForTimeout(1500);   // real time: the chunks and pictures arrive
  if (!enter) return;
  await page.evaluate(() => window.__town.arcade.enter());
  await page.waitForTimeout(800);
}

// stop the clock at a FIXED instant (later than wherever loading left it), so the game's dice are the same every take
export async function freezeAt(page, iso) {
  const now = await page.evaluate(() => Date.now());
  const at = new Date(iso).getTime();
  if (at <= now) throw new Error('freezeAt: ' + iso + ' is already past (' + new Date(now).toISOString() + ')');
  await page.clock.pauseAt(new Date(at));
}

// a cabinet's game, opened the way a tap on it opens it once the banana is there
export async function openGame(page, spot) {
  await page.evaluate((k) => window.__town.arcade.play(k), spot);
  await page.waitForFunction(() => { const g = window.__town.arcade.game(); return !!(g && g.state && g.state()); }, null, { timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('#twBoardList li:not(.tw-board__empty)'), null, { timeout: 10000 }).catch(() => {});
}

export const gs = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__town.arcade.game().state())));

// play without filming: the same steps rollEven() takes, the player answering before each
export async function play(page, frames, player) {
  for (let i = 0; i < frames; i++) {
    if (player) { const r = await player(i); if (r === 'stop') return i; }
    await page.clock.runFor(STEP);
  }
  return frames;
}

// ---------------------------------------------------------------- the players

// 🐍 BANANA SNAKE (15 x 22): the shortest way to the jelly that still leaves the tail in reach; else the roomiest square
const COLS = 15, ROWS = 22;
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const keyOf = (dx, dy) => Object.keys(DIRS).find((k) => DIRS[k][0] === dx && DIRS[k][1] === dy);
const inGrid = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
function bfs(start, goal, blocked) {
  const prev = new Map(), k = (x, y) => x + ',' + y, q = [start];
  prev.set(k(start.x, start.y), null);
  while (q.length) {
    const c = q.shift();
    if (c.x === goal.x && c.y === goal.y) {
      const path = []; let p = c;
      while (p) { path.unshift(p); p = prev.get(k(p.x, p.y)); }
      return path;
    }
    for (const [dx, dy] of Object.values(DIRS)) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (!inGrid(n.x, n.y) || prev.has(k(n.x, n.y))) continue;
      if (blocked(n.x, n.y) && !(n.x === goal.x && n.y === goal.y)) continue;
      prev.set(k(n.x, n.y), c); q.push(n);
    }
  }
  return null;
}
const occ = (body) => { const s = new Set(body.map((b) => b.x + ',' + b.y)); return (x, y) => s.has(x + ',' + y); };
function flood(start, blocked) {
  const seen = new Set([start.x + ',' + start.y]), q = [start];
  while (q.length) { const c = q.shift(); for (const [dx, dy] of Object.values(DIRS)) { const n = { x: c.x + dx, y: c.y + dy }, kk = n.x + ',' + n.y; if (inGrid(n.x, n.y) && !seen.has(kk) && !blocked(n.x, n.y)) { seen.add(kk); q.push(n); } } }
  return seen.size;
}
// the body after walking `path` (path[0] is the head), eating at the end
function follow(body, path) {
  let b = body.slice();
  for (let i = 1; i < path.length; i++) { b.unshift(path[i]); if (i < path.length - 1) b.pop(); }
  return b;
}
export function snakeMove(s) {
  const body = s.body, head = body[0], dir = s.nextDir;
  const safeFrom = (b) => { const tail = b[b.length - 1]; return !!bfs(b[0], tail, occ(b.slice(0, -1))); };
  const goals = [];
  if (s.gold && s.goldT > 0.8) goals.push(s.gold);
  goals.push(s.jelly);
  let step = null;
  for (const g of goals) {
    const path = bfs(head, g, occ(body.slice(0, -1)));
    if (!path || path.length < 2) continue;
    if (s.gold && g === s.gold && path.length * s.tick > s.goldT - 0.3) continue;   // it would fade before we got there
    if (safeFrom(follow(body, path))) { step = path[1]; break; }
  }
  if (!step) {   // no safe meal: the move that keeps the most room, the tail in reach first
    let best = -1;
    for (const [dx, dy] of Object.values(DIRS)) {
      if (dx === -dir.x && dy === -dir.y) continue;
      const n = { x: head.x + dx, y: head.y + dy };
      if (!inGrid(n.x, n.y) || occ(body.slice(0, -1))(n.x, n.y)) continue;
      const nb = [n, ...body.slice(0, -1)];
      const room = flood(n, occ(nb.slice(1, -1))) + (safeFrom(nb) ? 1000 : 0);
      if (room > best) { best = room; step = n; }
    }
  }
  if (!step) return null;
  const dx = step.x - head.x, dy = step.y - head.y;
  return { dx, dy, key: keyOf(dx, dy) };
}
// one decision per frame: a key only when the next square wants a different way than the one already set
export function snakePlayer(page, { crashAt = Infinity } = {}) {
  return async () => {
    const s = await gs(page);
    if (s.dead) return 'stop';
    if (!s.started) { await page.keyboard.press('ArrowRight'); return; }
    if (s.turns.length) return;
    if (s.score >= crashAt) return;   // a run that ends: no more turns, straight on into the wall
    const m = snakeMove(s);
    if (!m) return;
    if (m.dx === s.nextDir.x && m.dy === s.nextDir.y) return;
    await page.keyboard.press(m.key);
  };
}

// 👾 BANANA INVADERS: dodge what falls, slide under the fly a peel will meet, throw (S), A and D held to slide
const PY = 396;
// where the block will have stepped fly `f` to in T seconds (its turns at the edges included)
function flyAt(s, f, T) {
  const alive = s.flies.filter((q) => q.alive);
  let minX = Math.min(...alive.map((q) => q.x)), maxX = Math.max(...alive.map((q) => q.x));
  let x = f.x, dir = s.dir, t = s.tick - s.acc;
  while (t <= T) {
    if ((dir > 0 && maxX + 16 >= 300 - 8) || (dir < 0 && minX - 16 <= 8)) dir *= -1;
    else { x += 16 * dir; minX += 16 * dir; maxX += 16 * dir; }
    t += s.tick;
  }
  return x;
}
export function invadersPlayer(page) {
  let held = 0;   // -1 A, 1 D, 0 none
  const hold = async (d) => {
    if (d === held) return;
    if (held < 0) await page.keyboard.up('KeyA');
    if (held > 0) await page.keyboard.up('KeyD');
    if (d < 0) await page.keyboard.down('KeyA');
    if (d > 0) await page.keyboard.down('KeyD');
    held = d;
  };
  const player = async () => {
    const s = await gs(page);
    if (s.dead) { await hold(0); return 'stop'; }
    if (!s.started) { await page.keyboard.press('KeyS'); return; }
    const v = 150 + s.wave * 15;
    // danger first: a drop that will reach the banana's body inside ~0.75 s, near enough to touch it — slide clear of it
    let want = null;
    const near = s.bombs.filter((b) => b.y < PY + 14 && b.y > PY - 0.75 * v && Math.abs(b.x - s.x) < 20);
    if (near.length) {
      const b = near.sort((p, q) => q.y - p.y)[0];
      const goRight = b.x < s.x || (b.x === s.x && s.x < 150);
      want = goRight ? Math.min(278, b.x + 26) : Math.max(22, b.x - 26);
      if ((goRight && s.x > 270) || (!goRight && s.x < 30)) want = goRight ? Math.max(22, b.x - 26) : Math.min(278, b.x + 26);
    }
    // the target: the lowest fly of the column the banana can meet soonest
    const alive = s.flies.filter((f) => f.alive);
    let aim = null;
    if (alive.length) {
      const cols = new Map();
      for (const f of alive) { const c = cols.get(f.x); if (!c || f.y > c.y) cols.set(f.x, f); }
      let bestCost = Infinity;
      for (const f of cols.values()) {
        const flight = Math.max(0, (PY - 24 - f.y)) / 420;
        const px = flyAt(s, f, Math.abs(f.x - s.x) / 250 + flight);
        const cost = Math.abs(px - s.x);
        if (cost < bestCost) { bestCost = cost; aim = { f, flight, px }; }
      }
    }
    if (want == null && aim) want = flyAt(s, aim.f, Math.abs(aim.px - s.x) / 250 + aim.flight);
    const dx = want == null ? 0 : want - s.x;
    await hold(Math.abs(dx) < 4 ? 0 : Math.sign(dx));
    if (aim && s.cool <= 0 && s.shots.length < 2) {   // throw when a peel thrown now meets that fly where it will be
      const px = flyAt(s, aim.f, aim.flight);
      if (Math.abs(px - s.x) < 9) await page.keyboard.press('KeyS');
    }
  };
  player.release = () => hold(0);
  return player;
}

// 📦 BANANA STACK: drop when the crate is square over the tower (a perfect), or `offs[n]` px wide of it for crate n; from
// crate `crashAt` on, drop it where it misses the tower altogether (only a narrow tower can be missed: a full one spans the swing)
export function stackPlayer(page, { offs = {}, crashAt = Infinity } = {}) {
  return async () => {
    const s = await gs(page);
    if (s.dead) return 'stop';
    const top = s.tower[s.tower.length - 1], c = s.cur, n = s.tower.length - 1;   // n: crates dropped so far
    if (n >= crashAt) {
      const over = Math.min(c.x + c.w, top.x + top.w) - Math.max(c.x, top.x);
      if (over <= 2) { await page.keyboard.press('Space'); return 'drop'; }
      return;
    }
    const want = offs[n] || 0;
    // the frame the crate is nearest its mark: within 5 px a perfect; at full speed (10 px a frame) the nearest can be 5.1 off,
    // and a player drops then anyway rather than wait out a whole swing
    const dx = c.x - (top.x + want), next = dx + c.dir * s.speed * STEP / 1000;
    if (Math.abs(dx) <= 5.5 && Math.abs(dx) <= Math.abs(next)) { await page.keyboard.press('Space'); return 'drop'; }
  };
}

// 📦 the stack take, shared by the screen shot and the whole-card shot: run one lost at 24 (two bad drops narrow the tower,
// the third misses it), another go, run two played up to `from` — the camera rolls from there with the returned player
export async function stackTake(page, { from = 19 } = {}) {
  await openGame(page, 'g5');
  await play(page, 6000, stackPlayer(page, { offs: { 22: 45, 23: -40 }, crashAt: 24 }));
  await play(page, 30);                    // the end card's beat
  await page.keyboard.press('Space');      // another go
  const p = stackPlayer(page, { offs: { 9: 12, 15: -11, 27: 12 } });
  await play(page, 6000, async (i) => ((await gs(page)).score >= from ? 'stop' : p(i)));
  return p;
}

// 🌿 PEEL OUT: ride the bottom of the next gap — a flap whenever the banana would sink to the crates' top
export function peelPlayer(page, { margin = 10, crashAt = Infinity } = {}) {
  return async () => {
    const s = await gs(page);
    if (s.dead) return 'stop';
    if (!s.started) { await page.keyboard.press('Space'); return; }
    if (s.score >= crashAt) return;   // a run that ends: no more flaps, down into the vat
    const R = 10;
    const next = s.pieces.filter((p) => p.x + 30 > s.x - R - 2).sort((a, b) => a.x - b.x)[0];
    const bot = next ? next.bot : 394 - 30;
    const dt = STEP / 1000, y1 = s.y + s.vy * dt + 0.5 * 1500 * dt * dt;
    if (y1 + R + margin > bot) await page.keyboard.press('Space');
  };
}
