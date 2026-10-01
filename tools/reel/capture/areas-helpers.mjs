// 🎬 THE OTHER-AREAS CREW'S KIT (1 Oct 2026, the town trailer's montage: rave · bay · park · forge).
// What every one of these shots needs on top of the harness (harness.roll now steps CSS too — cssStep; rollSync here
// is the same idea plus the held and finished cases below, and keeps its own page globals so the two never collide):
//  1. NO LIVE ROOM. stage() aborts workers.dev HTTP, but a WebSocket never goes through page.route — the rave, the bay
//     and the park would join their real rooms and put real players on film. noRoom() answers every worker socket
//     right here (it is never connected to the server); a shot that wants a crowd hands it fictional bananas.
//  2. THE CSS CLOCK. Chromium runs CSS animations, transitions and el.animate() on REAL time, and a frame takes ~0.2 s
//     to shoot, so the rave's strobe, beams and pyro would race 6x and stutter. rollSync() pins every one of them to
//     the stepped clock: each is paused and set to the time it has been alive on the GAME's clock. One that was already
//     running when the clock stopped keeps its phase (the two beams stay out of step), a new one gets half a frame, one
//     its stylesheet holds still (animation-play-state: paused, a crab between darts) stays still, and a finite one that
//     reaches its end is finish()ed so animationend and .finished fire as they would in play.
//  3. notes.json beside the frames.
//  4. A TAKE THAT REPEATS. stageStill() is stage() with the clock already stopped when the page starts: the area boots
//     at exactly `time`, so its timers (the rave's LED rotation, a jelly run, a bite) fall on the same instants every
//     take, and Math.random is seeded, so its dice do too. The game is still the game — one fixed take of it.
import fs from 'node:fs';
import path from 'node:path';
import { CAP, NOISE } from './harness.mjs';

export const PLAIN = { hat: 'none', glasses: 'none', extras: {}, effect: 'none', c: '' };

export async function stageStill(page, { url, time, init = null, arg = null, stub = null, rand = 7 }) {
  await page.route(NOISE, (r) => r.abort());
  if (stub) await stub(page);   // after the blanket abort: the LAST route added answers first
  await page.addInitScript(() => {
    if (sessionStorage.getItem('cap-seeded')) return;
    sessionStorage.setItem('cap-seeded', '1');
    try { localStorage.setItem('tt-internal', '1'); localStorage.setItem('cookie-consent-v1', 'n'); } catch (e) {}
  });
  await page.addInitScript((s) => {   // mulberry32: the same dice every take
    let a = s >>> 0;
    Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, rand);
  if (init) await page.addInitScript(init, arg);
  const t = new Date(time).getTime();
  await page.clock.install({ time: t });
  await page.clock.pauseAt(t);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

// wait REAL time (the game's clock stays where it is) until fn(arg) is true in the page
export async function until(page, fn, arg = null, ms = 60000) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn, arg).catch(() => false)) return;
    if (Date.now() - t0 > ms) throw new Error('until: timed out');
    await page.waitForTimeout(150);
  }
}

// the classic banana, the questline's chapter one already met (no intro card), plus any per-area keys
export function seed(extra) {
  try {
    localStorage.setItem('bb-last', JSON.stringify({ hat: 'none', glasses: 'none', extras: {}, effect: 'none', c: '' }));
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    for (const k in (extra || {})) localStorage.setItem(k, extra[k]);
  } catch (e) {}
}

// every worker socket answered locally. onMsg(ws, msg) sees what the page sends (hi, move, emote…) and may answer.
export async function noRoom(page, onMsg) {
  await page.routeWebSocket(/workers\.dev/, (ws) => {
    ws.onMessage((raw) => {
      let m; try { m = JSON.parse(String(raw)); } catch (e) { return; }
      if (m && onMsg) onMsg(ws, m);
    });
  });
}

async function syncAnims(page) {
  await page.evaluate(() => {
    const T = Date.now();   // the game's clock (paused, stepped)
    const first = !window.__areaCssSeen;
    window.__areaCssSeen = true;   // ⚠️ not __capSeen: harness.cssStep keeps a WeakMap under that name
    for (const a of document.getAnimations()) {
      if (a.__capStart === undefined) {
        a.__capStart = T - (first ? (a.currentTime || 0) : 16);
        a.__capLast = T;
        try { a.pause(); } catch (e) {}
      }
      // a CSS animation its stylesheet has paused stays where it is
      let held = false;
      if (a.animationName && a.effect && a.effect.target) {
        try {
          const cs = getComputedStyle(a.effect.target, a.effect.pseudoElement || null);
          const names = cs.animationName.split(',').map((s) => s.trim());
          const states = cs.animationPlayState.split(',').map((s) => s.trim());
          const k = names.indexOf(a.animationName);
          held = (states[k >= 0 ? k % states.length : 0] || 'running') === 'paused';
        } catch (e) {}
      }
      if (held) a.__capStart += T - a.__capLast;
      a.__capLast = T;
      const t = T - a.__capStart;
      let end = Infinity;
      try { end = a.effect.getComputedTiming().endTime; } catch (e) {}
      try {
        if (Number.isFinite(end) && t >= end) { if (a.playState !== 'finished') a.finish(); }
        else a.currentTime = t;
      } catch (e) {}
    }
  });
}

// the harness's roll(): the same 32 ms step (exactly two of the fake clock's 16 ms animation ticks — the old 33/33/34
// gave every 12th frame three, a 1.5x hitch), the same frames, folder and meta, with the CSS clock synced as above
// (harness.cssStep would advance a CSS-held animation too: the bay's crabs would pedal standing still)
export async function rollSync(page, { name, secs, fps = 30, clip = null, each = null }) {
  const dir = path.join(CAP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(secs * fps);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    if (each) await each(i, i / fps);
    await page.clock.runFor(32);
    await syncAnims(page);
    await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png'), clip: clip || undefined, animations: 'allow', caret: 'hide' });
  }
  const meta = { name, frames: n, fps, dt: 32, clip, secsReal: Math.round((Date.now() - t0) / 100) / 10, cssClock: 'stepped' };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  return dir;
}

// run the game's clock without filming, the CSS clock with it (a walk to its mark, a card settling)
export async function waitSync(page, ms) {
  for (let t = 0; t < ms; t += 100) { await page.clock.runFor(Math.min(100, ms - t)); await syncAnims(page); }
}

// run the clock to an exact instant of the game's day (a drop, a tide)
export async function runTo(page, ms) {
  const now = await page.evaluate(() => Date.now());
  if (ms <= now) throw new Error('runTo: that moment is already past (' + new Date(now).toISOString() + ')');
  await waitSync(page, ms - now);
}

export function notes(name, o) {
  fs.writeFileSync(path.join(CAP, name, 'notes.json'), JSON.stringify({ shot: name, ...o }, null, 1));
}
