// 👥 THE SQUARE'S OTHER PLAYERS, FOR THE TRAILER (1 Oct 2026). The town's crowd (src/scripts/town-crowd.js) rides a
// WebSocket to worker-rave's SquareRoom, and a capture must never stand in the live room or show a real player. So the
// socket is answered HERE: page.routeWebSocket takes every workers.dev socket before it leaves the browser (the square's
// is served a fake room, any other is closed, none is ever connected to a server), and the fake room speaks SquareRoom's
// own wire for a handful of made-up players: roster on hi, then join/move/wave/burst/leave, positions in percent of the
// plate rounded to 0.1 (sqClamp), a move at most every 150 ms and only when they moved (the client's own rate), one wave
// per banana per 1.5 s (WAVE_GAP), one firework per banana per 3 s (SQUARE_BURST_GAP).
//
// Two more things the shared harness.roll does not do, both needed here:
//   ⏱ CSS animations run on the REAL clock — a peer's glide (`.tw-peer` transition 0.18 s), the wave's hand (bwsWave
//      1.6 s), the fountain's water (tw-fount 0.9 s). film() pauses every one and steps it with the game's clock.
//   🎆 a firework is drawn on the VIEW's fx canvas through the game's camera, which the staging takes off the world
//      (transform:none). The canvas gets the same camera back, so the burst lands where the game puts it.
import fs from 'node:fs';
import path from 'node:path';
import { CAP } from './harness.mjs';

export const W = 2200, H = 1300;
const SPEED = 168;   // world px a second: a banana's walk (banana-town.js SPEED)
const SEND = 150;    // the client sends its position at most this often (town-crowd.js tick)
const pc = (v, n) => Math.min(100, Math.max(0, Math.round(v / n * 1000) / 10));

// ---- the fake SquareRoom ------------------------------------------------------------------------------------------
// peers: [{ id, name, nw, outfit, at: [x, y], late: true (joins on a 'join' cue instead of being in the roster),
//           cues: [[ms, 'walk', [x, y], …] | [ms, 'wave', toId] | [ms, 'burst'] | [ms, 'join'] | [ms, 'leave']] }]
// 'me' as a wave's target means our banana.
export function fakeRoom({ me = 'me000001', peers = [] } = {}) {
  const P = peers.map((p, i) => ({
    ...p, x: p.at[0], y: p.at[1], path: [], here: !p.late, sentX: p.at[0], sentY: p.at[1],
    nextSend: 40 + (i * 53) % SEND, lastWave: -1e9, lastBurst: -1e9,
    cues: (p.cues || []).slice().sort((a, b) => a[0] - b[0]),
  }));
  const strip = (p) => ({ id: p.id, outfit: { hat: 'none', glasses: 'none', extras: {}, effect: 'none', ...(p.outfit || {}) }, x: pc(p.x, W), y: pc(p.y, H), room: '', ...(p.name ? { name: p.name } : {}), ...(p.nw ? { nw: 1 } : {}) });
  const room = {
    me, T: 0, heard: [], sockets: [], real: [], blocked: [], errors: [], route: null, said: [],
    roster: (hi) => ({ t: 'roster', you: me, all: [{ id: me, outfit: hi.outfit || {}, x: pc(hi.x / 100 * W, W), y: pc(hi.y / 100 * H, H), room: '' }, ...P.filter((p) => p.here).map(strip)] }),
    peer: (id) => P.find((p) => p.id === id),
    where: () => P.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), here: p.here })),
    // advance the room to T (ms since it started being driven) and say what it would have broadcast meanwhile
    due(T) {
      const out = [];
      const dt = Math.max(0, T - room.T) / 1000;
      room.T = T;
      for (const p of P) {
        while (p.cues.length && p.cues[0][0] <= T) {
          const [, act, ...a] = p.cues.shift();
          if (act === 'walk') p.path = a.map((q) => [q[0], q[1]]);
          else if (act === 'join' && !p.here) { p.here = true; out.push({ t: 'join', p: strip(p) }); }
          else if (act === 'leave' && p.here) { p.here = false; out.push({ t: 'leave', id: p.id }); }
          else if (act === 'wave' && p.here && T - p.lastWave >= 1500) { p.lastWave = T; out.push({ t: 'wave', id: p.id, to: a[0] === 'me' ? me : a[0], name: p.name || '' }); }
          else if (act === 'burst' && p.here && T - p.lastBurst >= 3000) { p.lastBurst = T; out.push({ t: 'burst', id: p.id, x: pc(p.x, W), y: pc(p.y, H), name: p.name || '' }); }
        }
        // the player's own walk, at a banana's speed
        let step = SPEED * dt;
        while (step > 0 && p.path.length) {
          const [tx, ty] = p.path[0], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
          if (d <= step) { p.x = tx; p.y = ty; step -= d; p.path.shift(); }
          else { p.x += dx / d * step; p.y += dy / d * step; step = 0; }
        }
        // …and its client telling the room where it is, on its own beat
        while (p.nextSend <= T) {
          p.nextSend += SEND;
          if (p.here && (Math.abs(p.x - p.sentX) >= 1 || Math.abs(p.y - p.sentY) >= 1)) {
            p.sentX = p.x; p.sentY = p.y;
            out.push({ t: 'move', id: p.id, x: pc(p.x, W), y: pc(p.y, H), room: '' });
          }
        }
      }
      room.said.push(...out.map((m) => ({ T, ...m })));
      return out;
    },
  };
  return room;
}

// pass as stage()'s `stub` (it runs after the harness's blanket abort, before the page loads)
export function squareStub(room) {
  return async (page) => {
    await page.routeWebSocket(/workers\.dev/, (ws) => {
      room.sockets.push(ws.url());
      if (!/\/town(\?|$)/.test(ws.url())) { ws.close(); return; }
      room.route = ws;
      ws.onMessage((raw) => {
        let m = null;
        try { m = JSON.parse(String(raw)); } catch (e) { return; }
        room.heard.push(m);
        if (m && m.t === 'hi') ws.send(JSON.stringify(room.roster(m)));
      });
    });
    // after Playwright's mock is in: a handle on the square's socket, so the room speaks on the exact frame it means to
    await page.addInitScript(() => {
      const M = window.WebSocket;
      window.WebSocket = class WebSocket extends M {
        constructor(u, p) { super(u, p); if (/\/town(\?|$)/.test(String(u))) window.__capSquare = this; }
      };
    });
    // the proof: a socket the page really opened, or any answer from a worker, lands in `real` (it must stay empty);
    // what the page asked a worker for and the harness refused lands in `blocked`; a page error in `errors`
    page.on('websocket', (w) => room.real.push('socket ' + w.url()));
    page.on('response', (r) => { if (/workers\.dev/.test(r.url())) room.real.push('response ' + r.url()); });
    page.on('requestfailed', (r) => { if (/workers\.dev/.test(r.url())) room.blocked.push(r.method() + ' ' + r.url().split('?')[0]); });
    page.on('pageerror', (e) => room.errors.push(e.message));
  };
}

async function deliver(page, room, msgs) {
  const ok = await page.evaluate((ms) => {
    const s = window.__capSquare;
    if (!s || s.readyState !== 1) return false;
    for (const m of ms) s.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(m) }));
    return true;
  }, msgs);
  if (!ok && room.route) for (const m of msgs) room.route.send(JSON.stringify(m));
}

// ---- the camera ---------------------------------------------------------------------------------------------------
// every CSS animation paused and stepped with the clock, and the fx canvas given back the game's camera. One born since
// the last step is a step old (a peer's move lands mid-frame in play: starting it at 0 held every glide for a frame each
// time a move came in); the first call keeps whatever is already running where it is.
async function sync(page, dt) {
  await page.evaluate((dt) => {
    const first = !window.__capSeen;
    const seen = window.__capSeen || (window.__capSeen = new WeakMap());
    for (const a of document.getAnimations()) {
      let v = seen.get(a);
      v = v === undefined ? (first ? (a.currentTime || 0) : dt) : v + dt;
      seen.set(a, v);
      try { if (a.playState !== 'paused') a.pause(); a.currentTime = v; } catch (e) {}
    }
    const w = document.getElementById('twWorld'), fx = document.getElementById('twFx');
    if (w && fx) {
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(w.style.transform || '');
      fx.style.left = (m ? -parseFloat(m[1]) : 0) + 'px';
      fx.style.top = (m ? -parseFloat(m[2]) : 0) + 'px';
    }
  }, dt);
}
export const freeze = (page) => sync(page, 0);

let beat = 0;   // the 33/33/34 cadence runs on across pre-rolls and shots
// film `secs` of play after `preroll` seconds of the same stepping unfilmed. Per frame: each(i, t) steers → the clock
// steps one frame → the room says what it said in that frame → CSS steps too → the frame is shot (i >= 0 only).
export async function film(page, { name = null, secs = 0, preroll = 0, clip = null, each = null, room = null }) {
  const dir = name ? path.join(CAP, name) : null;
  if (dir) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }
  const pre = Math.round(preroll * 30), n = Math.round(secs * 30);
  const t0 = Date.now();
  for (let i = -pre; i < n; i++) {
    if (each) await each(i, i / 30);
    const dt = 32; beat++;   // two 16 ms animation ticks a frame, never three (the 33/33/34 hitch)
    await page.clock.runFor(dt);
    if (room) { const msgs = room.due(room.T + dt); if (msgs.length) await deliver(page, room, msgs); }
    await sync(page, dt);
    if (dir && i >= 0) await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png'), clip: clip || undefined, animations: 'allow', caret: 'hide' });
  }
  if (dir) fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ name, frames: n, fps: 30, clip, secsReal: Math.round((Date.now() - t0) / 100) / 10 }, null, 1));
  return dir;
}

// ---- the staging --------------------------------------------------------------------------------------------------
// what every shot here seeds before load: chapter one met (no intro card), our banana plain, and one fixed world id, so
// the square's problems (seeded per player and day) are the same on every take
export const seed = () => {
  try {
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    localStorage.setItem('bb-last', JSON.stringify({ hat: 'none', glasses: 'none', extras: {}, effect: 'none', c: '' }));
    localStorage.setItem('park-sid', 'c4a7e2b1-0d3');
  } catch (e) {}
};
// the town booted, the crowd's fake room answered, the day set (the reference shot's), the square's problems and litter
// inside `tidy` ([x0, y0, x1, y1]) put right the way a player does it (room.fix: the rubbish goes, the crows fly off;
// life.pick: a flyer picked up); then the
// game's own layout run once on a 1120×945 view — scale 1 (the world's true size), and a camera that stays above and
// left of the square's middle, so a firework there never runs off the fx canvas — and the view opened to the whole world
export async function standUp(page, { wait = 1500, tidy = null } = {}) {
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.crowd && window.__town.crowd.live(), null, { timeout: 60000 });
  await page.evaluate(() => { const t = window.__town; t.room.curse('none'); t.wx('clear'); t.room.set(90); t.life.set(15); });
  if (tidy) {
    await page.waitForTimeout(800);   // the problems are seeded once the band is read
    await page.evaluate(async (r) => {
      const t = window.__town, inside = (p) => p.x >= r[0] && p.x <= r[2] && p.y >= r[1] && p.y <= r[3];
      for (const p of t.room.problems()) if (inside(p)) await t.room.fix(p.id);
      for (const f of t.life.flyers()) if (inside(f)) t.life.pick(f.i);
    }, tidy);
  }
  await page.addStyleTag({ content: '.tw-wrap{max-width:none!important;padding:0!important}.tw-view{width:1120px!important;height:945px!important}' });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  const sc = await page.evaluate(() => document.getElementById('twWorld').style.width);
  if (sc !== W + 'px') throw new Error('the town did not lay out at scale 1: ' + sc);
  await page.addStyleTag({ content: [
    '.tw-wrap{max-width:none!important;padding:0!important}', '.tw-stage{box-shadow:none!important;border:0!important}',
    `.tw-view{width:${W}px!important;height:${H}px!important}`,
    `#twWorld{width:${W}px!important;height:${H}px!important;transform:none!important}`,
    '#twView>:not(#twWorld):not(#twFx){visibility:hidden!important}', '.tw-toast{visibility:hidden!important}',
  ].join('') });
  await page.waitForTimeout(wait);   // real time: the chunks and pictures arrive
}

// the shot's notes for the editor, beside its frames (film() clears the folder, so the spec writes them after every take)
export function notes(name, n) { fs.writeFileSync(path.join(CAP, name, 'notes.json'), JSON.stringify({ shot: name, ...n }, null, 1)); }

// a real tap on a banana in the world (the social layer hears it at the document; the town never sees it)
export async function tapPeer(page, id) {
  const r = await page.evaluate((id) => { const el = document.querySelector('[data-pid="' + id + '"]'); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.55 }; }, id);
  if (!r) return false;
  await page.mouse.click(r.x, r.y);
  return true;
}
