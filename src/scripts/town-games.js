// 🕹 THE ARCADE'S GAMES — five cabinets, one card, one board rail (12 Sep 2026).
//
// Loaded on demand the first time a cabinet is tapped (a dynamic import), so the
// town's own script stays under its budget. Every game is one factory that draws
// on the card's canvas, takes a tap or a drag, and reports ONE end with a score
// and how long the run took; the card does the rest — the best, the board, the
// submit to the pass worker, the prizes. Zero libraries; the loop runs only while
// the card is open; the player is their own banana, drawn once by the engine.
//
// The rules of a classic are free to reuse; its name, art, sounds and layouts are
// not. Every pixel here is ours: banana names, banana reasons, one twist each.
import { PASS_API, pullIfStale } from '../lib/banana-pass.js';
import { WEARABLE_PACKS } from '../data/wearables.js';

const track = (n, p) => { try { if (window.gtag) window.gtag('event', n, p || {}); } catch (e) {} };
const CW = 300, CH = 440;
const NAMES = {
  peelout: ['Peel Out', 'Tap to flap. Through the vines and over the crates; the vat is waiting.'],
  snake: ['Banana Snake', 'Tap the side you want to turn to. Eat jelly, grow a peel, never bite it.'],
  invaders: ['Banana Invaders', 'Drag to slide, tap to throw a peel. The flies come down in rows.'],
  pong: ['Banana Pong', 'Drag your peel. Spinner is on the other side, and he gets better.'],
  stack: ['Banana Stack', 'Tap to drop the crate. What hangs over is lost. Perfect drops grow it back.'],
};
const PRIZE = { peelout: ['the Arcade visor', 10], snake: ['the Pixel crown', 15], invaders: ['the Joystick', 25], pong: ['the Gold token', 5], stack: ['the Joy cap', 15] };
// 🎁 a prize is called what the WARDROBE calls it (src/data/wearables.js `phrase`: "an arcade visor"), never a
// second list of names typed here — the catalog is already in the engine chunk every area loads
const PRIZE_PHRASE = Object.fromEntries(Object.values(WEARABLE_PACKS).flatMap((p) => ['hats', 'glasses', 'extras'].flatMap((k) => p[k] || [])).map((it) => [it.id, it.phrase || '']));
// the rig's result lines with their holes filled (the words come through api.words(), from the town)
const fillIn = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
const bests = {};   // this visit's bests, per game (the server keeps the real ones)
let boardCache = {};

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function link() { try { return JSON.parse(localStorage.getItem('pass-link') || 'null'); } catch (e) { return null; } }

// ---- the card: canvas + hud + board, and the one handle the town keeps
export function openGame(key, api) {
  const [name, sub] = NAMES[key] || [key, ''];
  api.openCard('<h2>' + esc(name) + '</h2><p class="tw-card__sub">' + esc(sub) + '</p>'
    + '<div class="tw-arc"><canvas id="twArc" width="' + CW + '" height="' + CH + '"></canvas>'
    + '<div class="tw-arc__hud"><span id="twArcScore">0</span><span id="twArcBest">best ' + (bests[key] || 0) + '</span></div></div>'
    + '<div class="tw-board" id="twBoard"><div class="tw-board__tabs"><button type="button" class="is-on" data-t="top">All time</button><button type="button" data-t="week">This week</button></div>'
    + '<ol class="tw-board__list" id="twBoardList"><li class="tw-board__empty">reading the board…</li></ol><p class="tw-board__me" id="twBoardMe"></p></div>'
    + '<p class="tw-fine">' + (PRIZE[key] ? PRIZE[key][1] + ' on this board wins ' + PRIZE[key][0] + '. ' : '') + 'A score on every cabinet wins the Trophy; a top three, the Medal. No coins move.</p>');
  const cv = document.getElementById('twArc');
  const scoreEl = document.getElementById('twArcScore'), bestEl = document.getElementById('twArcBest');
  const banana = api.bananaCanvas();
  let ended = false, startedAt = 0, view = 'top', last = null;
  const g = GAMES[key](cv, {
    banana,
    score: (n) => { scoreEl.textContent = n; if (n > (bests[key] || 0)) { bests[key] = n; bestEl.textContent = 'best ' + n; } },
    begin: () => { startedAt = performance.now(); ended = false; track('arcade_run', { game: key }); },
    end: (score) => { if (ended) return; ended = true; submit(key, score, Math.max(0, performance.now() - startedAt)); },
  });
  track('arcade_board', { game: key });
  renderBoard(key, null);
  loadBoard(key).then((b) => { if (b) { boardCache[key] = b; renderBoard(key, last); } });
  document.getElementById('twBoard').addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]'); if (!t) return;
    view = t.dataset.t;
    t.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === t));
    renderBoard(key, last);
  });
  // a tap after the end is a new run — every game restarts itself the same way
  cv.addEventListener('pointerdown', (e) => { if (ended && g.restartable()) { e.stopPropagation(); ended = false; g.restart(); } }, true);
  g.start();

  function renderBoard(k, res) {
    const b = boardCache[k] || { top: [], week: [], players: 0 };
    const rows = (view === 'week' ? (res && res.week) || b.week : (res && res.top) || b.top) || [];
    const list = document.getElementById('twBoardList'); if (!list) return;
    list.innerHTML = rows.length
      ? rows.slice(0, 5).map((r, i) => '<li><span class="tw-board__rank">' + (i + 1) + '</span><span class="tw-board__name">' + esc(r.n) + '</span><span class="tw-board__score">' + r.s + '</span></li>').join('')
      : '<li class="tw-board__empty">' + (boardCache[k] ? 'nobody on this board yet. Be the first.' : 'reading the board…') + '</li>';
    const me = document.getElementById('twBoardMe'); if (!me) return;
    if (res && res.ok) {
      const r = view === 'week' ? res.wrank : res.rank;
      me.textContent = 'you: best ' + res.best + (r ? ' · #' + r + (view === 'week' ? ' this week' : ' of ' + res.players) : '');
    } else if (!link()) me.textContent = 'your best stays on this phone until you keep your pass';
    else me.textContent = b.players ? b.players + ' bananas on this board' : '';
  }
  async function submit(k, score, dur) {
    const L = link();
    track('arcade_score', { game: k, score });
    if (!L || !L.credId || !L.token || score <= 0) return;
    try {
      const r = await fetch(PASS_API + '/arcade/score', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credId: L.credId, token: L.token, game: k, score, dur: Math.round(dur) }) });
      const d = await r.json();
      if (!d || !d.ok) return;
      last = d;
      if (d.best > (bests[k] || 0)) { bests[k] = d.best; bestEl.textContent = 'best ' + d.best; }
      boardCache[k] = { top: d.top, week: d.week, players: d.players };
      renderBoard(k, d);
      for (const id of d.prizes || []) track('arcade_prize', { game: k, item: id });
      if (d.prizes && d.prizes.length) { try { pullIfStale(0); } catch (e) {} }   // the server granted it on the pass; this device reads it back
      const W = (api.words && api.words()) || {};
      const won = (d.prizes || []).map((id) => PRIZE_PHRASE[id]).filter(Boolean).join(', ');
      if (won && W.prize) api.say(fillIn(W.prize, { prizes: won }));
      else if (d.newBest && d.rank && W.best) api.say(fillIn(W.best, { best: d.best, rank: d.rank, players: d.players }));
    } catch (e) {}
  }
  return { stop() { g.stop(); }, state: () => g.state(), key, game: g, restart: () => { ended = false; g.restart(); }, ended: () => ended };
}
async function loadBoard(k) {
  try { const r = await fetch(PASS_API + '/arcade/board?game=' + k); return r.ok ? await r.json() : null; } catch (e) { return null; }
}

// ---- the shared loop: rAF while alive, a capped dt so a slow frame never teleports
function loop(step, draw) {
  let raf = 0, last = 0, alive = true;
  function f(now) { if (!alive) return; const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; step(dt); draw(); raf = requestAnimationFrame(f); }
  raf = requestAnimationFrame(f);
  return () => { alive = false; cancelAnimationFrame(raf); };
}
function text(ctx, s, x, y, size, color, align) {
  ctx.font = 'bold ' + size + 'px "Archivo Black", sans-serif'; ctx.textAlign = align || 'center'; ctx.fillStyle = color || '#fffdf5';
  ctx.shadowColor = '#000'; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.fillText(s, x, y); ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
}
function endCard(ctx, title, sub, t) {
  text(ctx, title, CW / 2, CH * 0.4, 26, '#ffe135');
  if (t > 0.7) text(ctx, sub || 'tap for another go', CW / 2, CH * 0.5, 13);
}
function drawBanana(ctx, banana, x, y, size, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(banana, -size / 2, -size / 2, size, size); ctx.restore();
}
// a tiny seeded generator, the daily banana's own (splitmix32), so a run is reproducible when seeded
function mix32(seed) { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const pointerX = (cv, e) => (e.clientX - cv.getBoundingClientRect().left) * (CW / cv.getBoundingClientRect().width);
const pointerY = (cv, e) => (e.clientY - cv.getBoundingClientRect().top) * (CH / cv.getBoundingClientRect().height);

const GAMES = {};

// ---- 1 · PEEL OUT: one thumb, a course built from pieces
GAMES.peelout = (cv, api) => {
  const ctx = cv.getContext('2d'); const FLOOR = CH - 46, B = 44;
  let st, stop = null; const rnd = mix32((Date.now() / 1000) | 0);
  function reset() { st = { y: CH * 0.42, vy: 0, x: 80, t: 0, speed: 150, pieces: [], next: 260, score: 0, dead: false, deadT: 0, started: false, mode: 0, modeLeft: 6, gapC: CH * 0.45 }; api.score(0); }
  function addPiece() {
    const gapH = Math.max(112, 160 - st.score * 1.4);
    if (--st.modeLeft <= 0) { st.mode = (st.mode + 1 + Math.floor(rnd() * 2)) % 4; st.modeLeft = 5 + Math.floor(rnd() * 4); }
    const lo = 70 + gapH / 2, hi = FLOOR - 40 - gapH / 2;
    let c = st.gapC;
    if (st.mode === 0) c += (rnd() - 0.5) * 120; else if (st.mode === 1) c = lo + rnd() * (hi - lo);
    else if (st.mode === 2) c = (st.pieces.length % 2 ? hi - 20 : lo + 20) + (rnd() - 0.5) * 30; else c += (rnd() - 0.5) * 50;
    c = Math.max(lo, Math.min(hi, c)); st.gapC = c;
    st.pieces.push({ x: CW + 40, top: c - gapH / 2 - (st.mode === 3 ? 8 : 0), bot: c + gapH / 2 - (st.mode === 3 ? 8 : 0), leaf: Math.floor(rnd() * 3), passed: false });
  }
  function flap() { if (st.dead) return; if (!st.started) { st.started = true; api.begin(); } st.vy = -400; }
  function die() { st.dead = true; st.deadT = 0; st.vy = -150; api.end(st.score); }
  function step(dt) {
    if (!st.started) return;
    if (st.dead) { st.deadT += dt; st.vy += 1500 * dt; st.y = Math.min(FLOOR + 10, st.y + st.vy * dt); return; }
    st.t += dt; st.vy += 1500 * dt; st.y += st.vy * dt;
    if (st.y < 20) { st.y = 20; st.vy = 0; }
    st.speed = Math.min(270, 150 + st.score * 4);
    st.next -= st.speed * dt;
    if (st.next <= 0) { addPiece(); st.next = Math.max(170, 230 - st.score * 2); }
    for (const p of st.pieces) { p.x -= st.speed * dt; if (!p.passed && p.x + 30 < st.x) { p.passed = true; st.score++; api.score(st.score); } }
    st.pieces = st.pieces.filter((p) => p.x > -60);
    const bx0 = st.x - B * 0.32, bx1 = st.x + B * 0.32, by0 = st.y - B * 0.36, by1 = st.y + B * 0.36;
    if (by1 >= FLOOR) { die(); return; }
    for (const p of st.pieces) { if (bx1 < p.x || bx0 > p.x + 30) continue; if (by0 < p.top || by1 > p.bot) { die(); return; } }
  }
  function draw() {
    ctx.fillStyle = '#17243a'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#243652'; for (let i = 0; i < 12; i++) ctx.fillRect(((i * 83 + 40 - st.t * 20) % (CW + 40) + CW + 40) % (CW + 40) - 20, 30 + (i * 37) % 200, 3, 3);
    for (const p of st.pieces) {
      ctx.fillStyle = '#4c7a2f'; ctx.fillRect(p.x + 13, 0, 4, p.top); ctx.fillStyle = '#6fae3f';
      for (let y = 14; y < p.top - 6; y += 26) { const s = (y / 26 + p.leaf) % 2 ? -1 : 1; ctx.fillRect(p.x + 15 + (s > 0 ? 3 : -13), y, 10, 5); ctx.fillRect(p.x + 15 + (s > 0 ? 5 : -11), y + 5, 6, 3); }
      ctx.fillStyle = '#e0c23a'; ctx.fillRect(p.x + 8, p.top - 10, 14, 10); ctx.fillStyle = '#b8951f'; ctx.fillRect(p.x + 8, p.top - 3, 14, 3);
      let y = FLOOR;
      while (y > p.bot) { const h = Math.min(30, y - p.bot); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(p.x, y - h, 30, h); ctx.fillStyle = '#5e3a1e'; ctx.fillRect(p.x, y - h, 30, 2); ctx.fillRect(p.x, y - 2, 30, 2); ctx.fillRect(p.x, y - h, 2, h); ctx.fillRect(p.x + 28, y - h, 2, h); ctx.fillStyle = '#a97a3e'; ctx.fillRect(p.x + 4, y - h + 6, 22, 2); y -= 30; }
    }
    ctx.fillStyle = '#7a2a6e'; ctx.fillRect(0, FLOOR, CW, CH - FLOOR); ctx.fillStyle = '#c33fae';
    for (let x = 0; x < CW; x += 12) ctx.fillRect(x, FLOOR - 2 + Math.round(Math.sin(st.t * 4 + x / 9) * 2), 12, 6);
    drawBanana(ctx, api.banana, st.x, st.y, B, st.dead ? Math.min(1.4, st.deadT * 2) : Math.max(-0.5, Math.min(0.9, st.vy / 700)));
    if (!st.started) text(ctx, 'tap to flap', CW / 2, CH * 0.68, 15);
    if (st.dead) endCard(ctx, 'SPLAT', null, st.deadT);
  }
  const onTap = (e) => { e.preventDefault(); flap(); };
  const onKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); } };
  return {
    start() { reset(); cv.addEventListener('pointerdown', onTap); addEventListener('keydown', onKey); stop = loop(step, draw); },
    stop() { if (stop) stop(); cv.removeEventListener('pointerdown', onTap); removeEventListener('keydown', onKey); },
    restart() { reset(); }, restartable: () => st.dead && st.deadT > 0.7, state: () => st, flap,
  };
};

// ---- 2 · BANANA SNAKE: a peel that grows, on a 15 by 22 grid
GAMES.snake = (cv, api) => {
  const ctx = cv.getContext('2d'); const C = 20, COLS = CW / C, ROWS = CH / C;
  let st, stop = null; const rnd = mix32((Date.now() / 1000) | 0);
  function place() { let p; do { p = { x: Math.floor(rnd() * COLS), y: Math.floor(rnd() * ROWS) }; } while (st.body.some((b) => b.x === p.x && b.y === p.y)); return p; }
  function reset() { st = { body: [{ x: 7, y: 11 }, { x: 6, y: 11 }, { x: 5, y: 11 }], dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, acc: 0, tick: 0.16, score: 0, dead: false, deadT: 0, started: false, jelly: null, gold: null, goldT: 0, t: 0 }; st.jelly = place(); api.score(0); }
  function turn(dx, dy) { if (st.dead) return; if (dx === -st.dir.x && dy === -st.dir.y) return; st.nextDir = { x: dx, y: dy }; if (!st.started) { st.started = true; api.begin(); } }
  function die() { st.dead = true; st.deadT = 0; api.end(st.score); }
  function step(dt) {
    st.t += dt;
    if (st.dead) { st.deadT += dt; return; }
    if (!st.started) return;
    if (st.gold) { st.goldT -= dt; if (st.goldT <= 0) st.gold = null; }
    st.acc += dt; if (st.acc < st.tick) return; st.acc -= st.tick;
    st.dir = st.nextDir;
    const h = { x: st.body[0].x + st.dir.x, y: st.body[0].y + st.dir.y };
    if (h.x < 0 || h.y < 0 || h.x >= COLS || h.y >= ROWS || st.body.some((b) => b.x === h.x && b.y === h.y)) { die(); return; }
    st.body.unshift(h);
    if (h.x === st.jelly.x && h.y === st.jelly.y) { st.score += 1; st.jelly = place(); if (!st.gold && rnd() < 0.18) { st.gold = place(); st.goldT = 6; } }
    else if (st.gold && h.x === st.gold.x && h.y === st.gold.y) { st.score += 3; st.gold = null; }
    else st.body.pop();
    api.score(st.score);
    st.tick = Math.max(0.07, 0.16 - st.body.length * 0.003);
  }
  function draw() {
    ctx.fillStyle = '#1b2a1d'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#213424'; for (let x = 0; x < CW; x += C) for (let y = (x / C) % 2 ? C : 0; y < CH; y += C * 2) ctx.fillRect(x, y, C, C);
    const jelly = (p, col, big) => { ctx.fillStyle = col; const w = Math.round(Math.sin(st.t * 6 + p.x) * 1.5); ctx.fillRect(p.x * C + 4 - w, p.y * C + 6, C - 8 + w * 2, C - 10); ctx.fillRect(p.x * C + 7, p.y * C + 3, C - 14, 4); if (big) { ctx.fillStyle = '#fff5b0'; ctx.fillRect(p.x * C + 8, p.y * C + 7, 3, 3); } };
    jelly(st.jelly, '#c33fae'); if (st.gold) jelly(st.gold, '#ffcf3a', true);
    for (let i = st.body.length - 1; i >= 1; i--) { const b = st.body[i]; ctx.fillStyle = i % 2 ? '#ffe135' : '#f2c012'; ctx.fillRect(b.x * C + 3, b.y * C + 3, C - 6, C - 6); ctx.fillStyle = '#b8951f'; ctx.fillRect(b.x * C + 3, b.y * C + C - 5, C - 6, 2); }
    const h = st.body[0]; const rot = st.dir.x === 1 ? 0 : st.dir.x === -1 ? Math.PI : st.dir.y === 1 ? Math.PI / 2 : -Math.PI / 2;
    drawBanana(ctx, api.banana, h.x * C + C / 2, h.y * C + C / 2, 30, rot);
    if (!st.started) text(ctx, 'tap a side to go', CW / 2, CH * 0.65, 15);
    if (st.dead) endCard(ctx, 'BITTEN', null, st.deadT);
  }
  const onTap = (e) => { e.preventDefault(); const x = pointerX(cv, e), y = pointerY(cv, e); const h = st.body[0]; const dx = x - (h.x * C + C / 2), dy = y - (h.y * C + C / 2); if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0); else turn(0, dy > 0 ? 1 : -1); };
  const onKey = (e) => { const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[e.code]; if (m) { e.preventDefault(); turn(m[0], m[1]); } };
  return {
    start() { reset(); cv.addEventListener('pointerdown', onTap); addEventListener('keydown', onKey); stop = loop(step, draw); },
    stop() { if (stop) stop(); cv.removeEventListener('pointerdown', onTap); removeEventListener('keydown', onKey); },
    restart() { reset(); }, restartable: () => st.dead && st.deadT > 0.7, state: () => st, turn,
  };
};

// ---- 3 · BANANA INVADERS: rows of fruit flies, a banana that throws peels
GAMES.invaders = (cv, api) => {
  const ctx = cv.getContext('2d'); const PY = 396;
  let st, stop = null; const rnd = mix32((Date.now() / 1000) | 0);
  function wave(n) { const flies = []; const cols = 6, rows = Math.min(5, 3 + Math.floor(n / 2)); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) flies.push({ x: 40 + c * 40, y: 40 + r * 32, alive: true }); return flies; }
  function reset() { st = { x: CW / 2, flies: wave(0), dir: 1, acc: 0, tick: 0.55, shots: [], bombs: [], score: 0, wave: 0, dead: false, deadT: 0, started: false, t: 0, cool: 0, win: 0 }; api.score(0); }
  function shoot() { if (st.dead) return; if (!st.started) { st.started = true; api.begin(); } if (st.cool > 0 || st.shots.length >= 2) return; st.shots.push({ x: st.x, y: PY - 24 }); st.cool = 0.32; }
  function die() { st.dead = true; st.deadT = 0; api.end(st.score); }
  function step(dt) {
    st.t += dt; if (st.dead) { st.deadT += dt; return; } if (!st.started) return;
    st.cool -= dt;
    for (const s of st.shots) s.y -= 420 * dt; st.shots = st.shots.filter((s) => s.y > -10);
    for (const b of st.bombs) b.y += (150 + st.wave * 15) * dt; st.bombs = st.bombs.filter((b) => b.y < CH);
    st.acc += dt;
    if (st.acc >= st.tick) {
      st.acc = 0;
      const alive = st.flies.filter((f) => f.alive);
      const minX = Math.min(...alive.map((f) => f.x)), maxX = Math.max(...alive.map((f) => f.x));
      if ((st.dir > 0 && maxX + 16 >= CW - 8) || (st.dir < 0 && minX - 16 <= 8)) { st.dir *= -1; for (const f of alive) f.y += 14; }
      else for (const f of alive) f.x += 16 * st.dir;
      if (rnd() < 0.35 + st.wave * 0.05) { const f = alive[Math.floor(rnd() * alive.length)]; if (f) st.bombs.push({ x: f.x, y: f.y + 10 }); }
    }
    for (const s of st.shots) for (const f of st.flies) if (f.alive && Math.abs(f.x - s.x) < 13 && Math.abs(f.y - s.y) < 12) { f.alive = false; s.y = -99; st.score++; api.score(st.score); }
    for (const b of st.bombs) if (Math.abs(b.x - st.x) < 16 && b.y > PY - 30 && b.y < PY + 10) { die(); return; }
    const alive = st.flies.filter((f) => f.alive);
    if (alive.some((f) => f.y >= PY - 34)) { die(); return; }
    if (!alive.length) { st.wave++; st.flies = wave(st.wave); st.tick = Math.max(0.22, 0.55 - st.wave * 0.06); st.bombs = []; st.win = 1.2; }
    if (st.win > 0) st.win -= dt;
  }
  function fly(f) {
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(f.x - 5, f.y - 3, 10, 7); ctx.fillStyle = '#f04a4a'; ctx.fillRect(f.x - 2, f.y - 1, 2, 2); ctx.fillRect(f.x + 1, f.y - 1, 2, 2);
    const w = Math.round(Math.sin(st.t * 30 + f.x) * 2); ctx.fillStyle = 'rgba(200,230,255,0.75)'; ctx.fillRect(f.x - 12, f.y - 6 - w, 7, 4); ctx.fillRect(f.x + 5, f.y - 6 - w, 7, 4);
  }
  function draw() {
    ctx.fillStyle = '#10161f'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#1b2433'; for (let i = 0; i < 16; i++) ctx.fillRect((i * 71) % CW, (i * 53 + (st.t * 10) | 0) % CH, 2, 2);
    for (const f of st.flies) if (f.alive) fly(f);
    ctx.fillStyle = '#ffe135'; for (const s of st.shots) { ctx.fillRect(s.x - 2, s.y - 8, 4, 12); ctx.fillStyle = '#b8951f'; ctx.fillRect(s.x - 2, s.y + 2, 4, 2); ctx.fillStyle = '#ffe135'; }
    ctx.fillStyle = '#7ed36a'; for (const b of st.bombs) { ctx.fillRect(b.x - 3, b.y - 3, 6, 6); }
    ctx.fillStyle = '#5a3d20'; ctx.fillRect(0, PY + 22, CW, 4);
    drawBanana(ctx, api.banana, st.x, PY, 44, 0);
    if (!st.started) text(ctx, 'tap to throw, drag to slide', CW / 2, CH * 0.62, 14);
    if (st.win > 0) text(ctx, 'wave ' + (st.wave + 1), CW / 2, CH * 0.5, 20, '#ffe135');
    if (st.dead) endCard(ctx, 'SWARMED', null, st.deadT);
  }
  let dragging = false, dragMoved = 0;
  const onDown = (e) => { e.preventDefault(); dragging = true; dragMoved = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  const onMove = (e) => { if (!dragging || st.dead) return; const x = pointerX(cv, e); dragMoved += Math.abs(x - st.x); st.x = Math.max(22, Math.min(CW - 22, x)); if (!st.started && dragMoved > 12) { st.started = true; api.begin(); } };
  const onUp = (e) => { if (!dragging) return; dragging = false; if (dragMoved < 12) shoot(); };
  const onKey = (e) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') st.x = Math.max(22, st.x - 14); if (e.code === 'ArrowRight' || e.code === 'KeyD') st.x = Math.min(CW - 22, st.x + 14); if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); shoot(); } };
  return {
    start() { reset(); cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); addEventListener('keydown', onKey); stop = loop(step, draw); },
    stop() { if (stop) stop(); cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp); removeEventListener('keydown', onKey); },
    restart() { reset(); }, restartable: () => st.dead && st.deadT > 0.7, state: () => st, shoot, moveTo: (x) => { st.x = Math.max(22, Math.min(CW - 22, x)); },
  };
};

// ---- 4 · BANANA PONG: your peel against Spinner's, a coin for a ball, three lives
GAMES.pong = (cv, api) => {
  const ctx = cv.getContext('2d'); const PW = 56, PH = 8, MY = 410, AY = 30;
  let st, stop = null; const rnd = mix32((Date.now() / 1000) | 0);
  function serve(toMe) { st.bx = CW / 2; st.by = CH / 2; const a = (rnd() - 0.5) * 1.2; st.speed = 220 + st.score * 8; st.vx = Math.sin(a) * st.speed; st.vy = Math.cos(a) * st.speed * (toMe ? 1 : -1); st.hold = 0.8; }
  function reset() { st = { mx: CW / 2, ax: CW / 2, bx: CW / 2, by: CH / 2, vx: 0, vy: 0, speed: 220, score: 0, lives: 3, dead: false, deadT: 0, started: false, t: 0, hold: 0, flash: 0 }; serve(true); api.score(0); }
  function die() { st.dead = true; st.deadT = 0; api.end(st.score); }
  function step(dt) {
    st.t += dt; if (st.dead) { st.deadT += dt; return; } if (!st.started) return;
    if (st.hold > 0) { st.hold -= dt; return; }
    // Spinner reaches for the ball; his reach grows with your score, his mistakes shrink
    const reach = 120 + st.score * 10; const err = Math.max(6, 40 - st.score * 3) * Math.sin(st.t * 3);
    const want = st.vy < 0 ? st.bx + err : CW / 2; st.ax += Math.max(-reach * dt, Math.min(reach * dt, want - st.ax));
    st.bx += st.vx * dt; st.by += st.vy * dt;
    if (st.bx < 8) { st.bx = 8; st.vx = Math.abs(st.vx); } if (st.bx > CW - 8) { st.bx = CW - 8; st.vx = -Math.abs(st.vx); }
    if (st.vy > 0 && st.by > MY - PH - 6 && st.by < MY + 6 && Math.abs(st.bx - st.mx) < PW / 2 + 6) { st.vy = -Math.abs(st.vy); const k = (st.bx - st.mx) / (PW / 2); st.vx += k * 140; st.speed += 8; norm(); st.flash = 0.15; }
    if (st.vy < 0 && st.by < AY + PH + 6 && st.by > AY - 6 && Math.abs(st.bx - st.ax) < PW / 2 + 4) { st.vy = Math.abs(st.vy); const k = (st.bx - st.ax) / (PW / 2); st.vx += k * 120; norm(); }
    if (st.by < -10) { st.score++; api.score(st.score); serve(true); }
    if (st.by > CH + 10) { st.lives--; if (st.lives <= 0) { die(); return; } serve(false); }
    if (st.flash > 0) st.flash -= dt;
  }
  function norm() { const m = Math.hypot(st.vx, st.vy) || 1; st.vx = st.vx / m * st.speed; st.vy = st.vy / m * st.speed; if (Math.abs(st.vy) < st.speed * 0.45) st.vy = Math.sign(st.vy || 1) * st.speed * 0.45; }
  function peel(x, y, mine) { ctx.fillStyle = mine ? '#ffe135' : '#f2c012'; ctx.fillRect(x - PW / 2, y, PW, PH); ctx.fillStyle = '#b8951f'; ctx.fillRect(x - PW / 2, y + PH - 2, PW, 2); ctx.fillRect(x - PW / 2, y, 3, PH); ctx.fillRect(x + PW / 2 - 3, y, 3, PH); }
  function draw() {
    ctx.fillStyle = '#1a1220'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#2a1e33'; for (let y = 0; y < CH; y += 16) ctx.fillRect(CW / 2 - 1, y, 2, 8);
    peel(st.ax, AY, false); peel(st.mx, MY, true);
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(st.bx - 5, st.by - 5, 10, 10); ctx.fillStyle = '#b8951f'; ctx.fillRect(st.bx - 2, st.by - 3, 4, 6);
    drawBanana(ctx, api.banana, st.mx, MY + 26, 28, 0);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < st.lives ? '#ffe135' : '#3a2f44'; ctx.fillRect(12 + i * 12, CH - 14, 8, 8); }
    text(ctx, 'Spinner', CW - 8, AY - 8, 11, '#c9a227', 'right');
    if (!st.started) text(ctx, 'drag to play', CW / 2, CH * 0.62, 15);
    if (st.dead) endCard(ctx, 'SPINNER WINS', null, st.deadT);
  }
  let dragging = false;
  const onDown = (e) => { e.preventDefault(); dragging = true; if (!st.dead && !st.started) { st.started = true; api.begin(); } st.mx = Math.max(PW / 2, Math.min(CW - PW / 2, pointerX(cv, e))); try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  const onMove = (e) => { if (!dragging || st.dead) return; st.mx = Math.max(PW / 2, Math.min(CW - PW / 2, pointerX(cv, e))); };
  const onUp = () => { dragging = false; };
  const onKey = (e) => { if (!st.started && !st.dead) { st.started = true; api.begin(); } if (e.code === 'ArrowLeft' || e.code === 'KeyA') st.mx = Math.max(PW / 2, st.mx - 16); if (e.code === 'ArrowRight' || e.code === 'KeyD') st.mx = Math.min(CW - PW / 2, st.mx + 16); };
  return {
    start() { reset(); cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); addEventListener('keydown', onKey); stop = loop(step, draw); },
    stop() { if (stop) stop(); cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp); removeEventListener('keydown', onKey); },
    restart() { reset(); }, restartable: () => st.dead && st.deadT > 0.7, state: () => st, moveTo: (x) => { st.mx = Math.max(PW / 2, Math.min(CW - PW / 2, x)); if (!st.started && !st.dead) { st.started = true; api.begin(); } },
  };
};

// ---- 5 · BANANA STACK: crates swing, tap to drop, the overhang is lost
GAMES.stack = (cv, api) => {
  const ctx = cv.getContext('2d'); const BASE = 120, CH_ = 26, FLOOR = CH - 40;
  const KINDS = [['#f3e9d2', 'eggs'], ['#e9f1ff', 'milk'], ['#d9d4c7', 'wool']];
  let st, stop = null;
  function reset() { st = { tower: [{ x: CW / 2 - BASE / 2, w: BASE }], cur: { x: 0, w: BASE, dir: 1 }, speed: 130, score: 0, dead: false, deadT: 0, started: false, t: 0, scroll: 0, perfect: 0, fall: null }; api.score(0); }
  function drop() {
    if (st.dead) return; if (!st.started) { st.started = true; api.begin(); }
    const top = st.tower[st.tower.length - 1]; const c = st.cur;
    const left = Math.max(c.x, top.x), right = Math.min(c.x + c.w, top.x + top.w); const over = right - left;
    if (over <= 4) { st.fall = { x: c.x, w: c.w, y: 0, vy: 0 }; st.dead = true; st.deadT = 0; api.end(st.score); return; }
    let w = over, x = left;
    if (Math.abs(c.x - top.x) <= 5) { w = Math.min(BASE, top.w + 6); x = top.x + (top.w - w) / 2; st.perfect = 0.6; }
    st.tower.push({ x, w }); st.score++; api.score(st.score);
    st.speed = Math.min(320, 130 + st.score * 7);
    st.cur = { x: st.score % 2 ? CW - w : 0, w, dir: st.score % 2 ? -1 : 1 };
  }
  function step(dt) {
    st.t += dt; if (st.dead) { st.deadT += dt; if (st.fall) { st.fall.vy += 900 * dt; st.fall.y += st.fall.vy * dt; } return; } if (!st.started) return;
    st.cur.x += st.cur.dir * st.speed * dt;
    if (st.cur.x + st.cur.w > CW + 20) st.cur.dir = -1; if (st.cur.x < -20) st.cur.dir = 1;
    const wantScroll = Math.max(0, (st.tower.length + 1) * CH_ - CH * 0.55); st.scroll += (wantScroll - st.scroll) * Math.min(1, dt * 6);
    if (st.perfect > 0) st.perfect -= dt;
  }
  function crate(x, y, w, i) { const k = KINDS[i % 3]; ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x, y, w, CH_); ctx.fillStyle = k[0]; ctx.fillRect(x + 4, y + 4, Math.max(0, w - 8), CH_ - 8); ctx.fillStyle = '#5e3a1e'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + CH_ - 2, w, 2); ctx.fillRect(x, y, 2, CH_); ctx.fillRect(x + w - 2, y, 2, CH_); }
  function draw() {
    ctx.fillStyle = '#20303d'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#2a3d4d'; for (let i = 0; i < 10; i++) ctx.fillRect((i * 97) % CW, ((i * 61) + st.scroll * 0.3) % CH, 3, 3);
    const yOf = (i) => FLOOR - (i + 1) * CH_ + st.scroll;
    ctx.fillStyle = '#5a3d20'; ctx.fillRect(0, FLOOR + st.scroll, CW, CH);
    st.tower.forEach((c, i) => crate(c.x, yOf(i), c.w, i));
    const n = st.tower.length;
    if (!st.dead) crate(st.cur.x, yOf(n), st.cur.w, n); else if (st.fall) crate(st.fall.x, yOf(n) + st.fall.y, st.fall.w, n);
    const top = st.tower[n - 1]; drawBanana(ctx, api.banana, top.x + top.w / 2, yOf(n - 1) - 18, 36, 0);
    if (st.perfect > 0) text(ctx, 'perfect', CW / 2, CH * 0.3, 16, '#ffe135');
    if (!st.started) text(ctx, 'tap to drop', CW / 2, CH * 0.3, 15);
    if (st.dead) endCard(ctx, 'TOPPLED', null, st.deadT);
  }
  const onTap = (e) => { e.preventDefault(); drop(); };
  const onKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowDown') { e.preventDefault(); drop(); } };
  return {
    start() { reset(); cv.addEventListener('pointerdown', onTap); addEventListener('keydown', onKey); stop = loop(step, draw); },
    stop() { if (stop) stop(); cv.removeEventListener('pointerdown', onTap); removeEventListener('keydown', onKey); },
    restart() { reset(); }, restartable: () => st.dead && st.deadT > 0.7, state: () => st, drop,
  };
};
