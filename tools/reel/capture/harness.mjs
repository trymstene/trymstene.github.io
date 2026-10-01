// 🎬 FILMING THE REAL GAME (1 Oct 2026, the town trailer). The reel rig used to redraw the world in Python, which
// is how a claw machine that never existed got into v1. This films the BUILT site instead: Playwright's clock is
// installed before the page loads, paused once the area has booted, and stepped one video frame at a time
// (32 ms: exactly two of the fake clock's 16 ms animation ticks — 33/33/34 gave every 12th frame three, a 1.5x hitch
// every 0.4 s the arcade crew measured; play runs at 0.96x, which no eye sees) with a screenshot after each step — so every banana, ghost and pet moves exactly as it
// does in play, however slowly the screenshots run. Frames land in tools/reel/frames/cap/<shot>/ (git-ignored).
// ⚠️ CSS animations run on the REAL clock, not this one: a shot that leans on a CSS-animated card plays it too fast.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CAP = path.resolve(HERE, '..', 'frames', 'cap');
export const NOISE = /workers\.dev|googletagmanager|google-analytics|cloudflareinsights|facebook|clarity/;

// a page that never reaches a live worker or a tracker, a quest already met (no intro card over the shot), and a clock
// that starts at `time` (local) and runs normally until pause()
export async function stage(page, { url, time = '2026-10-01T14:30:00', init = null, arg = null, stub = null }) {
  await page.route(NOISE, (r) => r.abort());
  // ⚠️ page.route never sees a WebSocket, and the rave, the bay, the park, the town and the yards all open live rooms
  // on workers.dev: answered here and never connected to the server, so no real player can walk into a shot (the
  // montage crew's catch). A shot that needs a room fakes it in `stub` with its own routeWebSocket (added later, so
  // it answers first).
  await page.routeWebSocket(/workers\.dev/, () => {});
  if (stub) await stub(page);   // ⚠️ after the blanket abort: the LAST route added answers first
  await page.addInitScript(() => {
    if (sessionStorage.getItem('cap-seeded')) return;
    sessionStorage.setItem('cap-seeded', '1');
    try { localStorage.setItem('tt-internal', '1'); localStorage.setItem('cookie-consent-v1', 'n'); } catch (e) {}
  });
  if (init) await page.addInitScript(init, arg);
  await page.clock.install({ time: new Date(time) });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

// stop the clock where it is, so nothing moves between frames but what roll() lets happen
export async function pause(page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 50));
}

// hide everything but the world (and whatever `keep` names): the HUD, toasts, cards
export async function css(page, rules) { await page.addStyleTag({ content: rules }); }

// every CSS / Web Animation paused and moved to the GAME's clock (the community crew's fix: unstepped, the fountain's
// water ran ~4x fast) — and FINISHED at its end, so its onfinish runs as in play (the day crew's fix: a coin flight
// that only seeks to its end never pays in; and within 1 ms of the end is the end — Chromium reports 1696.0000000000002
// and drops an animation sought to exactly 1696 without finishing it). `reset`: keep what already runs where it is.
export async function cssStep(page, dt, reset = false) {
  await page.evaluate((reset) => {
    const now = performance.now();
    const M = window.__capM || (window.__capM = new WeakMap());
    for (const a of document.getAnimations()) {
      let r = M.get(a);
      if (r && r.done) continue;
      if (!r) {
        const ct = Number(a.currentTime) || 0;
        r = { t0: reset ? now - ct : now - Math.min(ct, 16) };
        M.set(a, r);
        try { a.pause(); } catch (e) {}
      }
      const t = now - r.t0;
      let end = Infinity;
      try { end = a.effect ? a.effect.getComputedTiming().endTime : Infinity; } catch (e) {}
      if (Number.isFinite(end) && t >= end - 1) {
        if (!r.fin) { r.fin = true; try { a.currentTime = Math.max(0, end - 1); } catch (e) {} }
        else { r.done = true; try { a.finish(); } catch (e) {} }
        continue;
      }
      try { a.currentTime = t; } catch (e) {}
    }
  }, reset);
}

// film `secs` of play: before each frame `each(i, t)` may steer the game, then the clock AND every CSS animation step
// one frame and the frame is shot (whole viewport, or `clip`). Returns the folder.
export async function roll(page, { name, secs, fps = 30, clip = null, each = null }) {
  const dir = path.join(CAP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(secs * fps);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    if (each) await each(i, i / fps);
    const dt = 32;
    await page.clock.runFor(dt);
    await cssStep(page, dt, i === 0);
    await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png'), clip: clip || undefined, animations: 'allow', caret: 'hide' });
  }
  const meta = { name, frames: n, fps, clip, secsReal: Math.round((Date.now() - t0) / 100) / 10 };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  return dir;
}

// let the clock run `ms` without filming (a walk to its mark, a card to settle)
export async function wait(page, ms) { await page.clock.runFor(ms); }
