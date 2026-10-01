// 🎬 BANANA TOWN BY DAY — the film crew's helpers for the job, wheel and Exchange shots (1 Oct 2026, the town trailer).
//
// ⭐ THE GAME LAYS ITSELF OUT. The reference shot forces the 2200×1300 world to 1:1 with CSS after boot, which leaves the
// game's own camera and scale where they were — fine for the square, wrong for anything drawn in VIEW coordinates (the
// firework/served bursts on #twFx, a card, the tray). Here the view is sized BEFORE the town boots, at a size whose own
// layout() snaps to scale 1.0 at DPR 2 (any view up to 649 px wide: banana-town.js layout + world.js snapScale) — so the
// world is 2 device px per world px, exactly as the reference and as a phone draws it, and the game's own camera frames it.
//
// ⭐ CSS ANIMATIONS FOLLOW THE STEPPED CLOCK. CSS animations, transitions and element.animate() run on the browser's REAL
// clock, so unstepped the town's "+2" floats, poofs, glows, the wheel's win glow and its coin flights play 5–10× too fast
// (or not at all) on film. rollSync() pauses every animation the page has and sets its time from the stepped clock before
// each screenshot — and, unlike harness.cssStep, lets a finished one FINISH, so its own `finish` handlers run.
import fs from 'node:fs';
import path from 'node:path';
import { stage, CAP } from './harness.mjs';

// the plain classic banana, both quest chapters met (no intro card, no chapter marks), and — for the job and the wheel —
// a FAKE kept-pass link: the town asks for one before it hires you or spins, and every request it makes is stubbed or
// aborted (stage() aborts workers.dev), so nothing ever reaches a real record
export const SEED = (extra) => {
  try {
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    localStorage.setItem('bwq-c2', JSON.stringify({ done: true }));
    localStorage.setItem('bb-last', JSON.stringify({ hat: 'none', glasses: 'none', extras: {}, effect: 'none', c: '' }));
    localStorage.setItem('pass-link', JSON.stringify({ credId: 'reel-cap', token: 'reel-cap' }));
    localStorage.setItem('park-sid', 'd47e0a11-9c5');   // one fixed world id: the square's problems (seeded per player and day) repeat take to take
    for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  } catch (e) {}
};

// the view at `w`×`h`, at the top-left of the page, before the town measures it
export async function phone(page, w, h) {
  const rules = `header.nav,.skip-link,.tw-sign,.tw-tag,.tw-note,.ag,footer{display:none!important}`
    + `.tw-wrap{max-width:none!important;padding:0!important;margin:0!important}`
    + `.tw-stage{border:0!important;box-shadow:none!important;width:${w}px!important}`
    + `.tw-view{width:${w}px!important;height:${h}px!important}html,body{margin:0!important;overflow:hidden!important}`;
  await page.addInitScript((r) => {
    const add = () => { if (document.getElementById('cap-early')) return; const s = document.createElement('style'); s.id = 'cap-early'; s.textContent = r; (document.head || document.documentElement).appendChild(s); };
    document.addEventListener('readystatechange', add);
  }, rules);
}

// the page side of the animation sync: pause every animation on its first sight and drive its time from the stepped clock.
// One born before the roll keeps its phase; one born inside the step just run starts within it. A finite one holds its
// last keyframe for a frame and then finishes, so its own `finish` handlers run (a coin flight removes its coin then).
export async function syncInit(page) {
  await page.addInitScript(() => {
    window.__capSync = (reset) => {
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
        // ⚠️ WITHIN A MILLISECOND OF ITS END IS ITS END. Chromium reports an end of 1696.0000000000002 and already treats a
        // seek to 1696 as past it: a fill:'backwards' flight sought there drops out of getAnimations() unfinished, and the
        // coin it carried stood at its take-off point for the rest of the shot (the pot take, 1 Oct 2026)
        if (Number.isFinite(end) && t >= end - 1) {
          if (!r.fin) { r.fin = true; try { a.currentTime = Math.max(0, end - 1); } catch (e) {} }
          else { r.done = true; try { a.finish(); } catch (e) {} }
          continue;
        }
        try { a.currentTime = t; } catch (e) {}
      }
    };
  });
}

// 🎲 THE DICE, FIXED PER TAKE. The clock makes the motion repeatable; Math.random is the rest (which visitor answers the
// counter's call, where the day's litter lies, where in its wedge the wheel stops). A seeded Math.random makes a good take
// come out the same on every run, so a re-film after a fix films the same moment. The game's own randomness, unchanged.
export async function dice(page, n) {
  await page.addInitScript((s) => {
    let t = s >>> 0;
    Math.random = () => { t = (t + 0x6d2b79f5) >>> 0; let z = t; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  }, n);
}

// stage the town: the clock, the seeds, the stubs, and a calm afternoon (no curse, clear sky, a healthy square)
export async function town(page, { w = 640, h = 1138, time = '2026-10-01T15:00:00', seed = null, stub = null, hour = 15, health = 92, url = '/town/?towntest', rng = 1 } = {}) {
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await phone(page, w, h);
  await syncInit(page);
  if (rng != null) await dice(page, rng);
  await stage(page, { url, time, init: SEED, arg: seed, stub });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band() && window.__town.work, null, { timeout: 60000 });
  await page.evaluate(([hr, hp]) => { const t = window.__town; t.room.curse('none'); t.wx('clear'); t.room.set(hp); t.life.set(hr); }, [hour, health]);
  // ⚠️ AND THE HOUR PINNED AGAIN once the square's condition has landed: the first pin is re-planned as a walk by the
  // room's own refresh, and a resident waiting for "their moment to set off" (up to 74 s) stays where the boot put them —
  // Pip stood behind his till at noon instead of at the cash machine (town-life.js changeBeat)
  await page.waitForTimeout(1000);
  await page.evaluate((hr) => window.__town.life.set(hr), hour);
}

// inside [x0, y0, x1, y1] (world px) the square put right the way a player does it: room.fix (the rubbish goes, the
// crows fly off) and life.pick (a flyer picked up). Run it a beat before the roll so the puffs are over.
export const tidy = (page, r) => page.evaluate(async (b) => {
  const t = window.__town, inside = (p) => p.x >= b[0] && p.x <= b[2] && p.y >= b[1] && p.y <= b[3], out = [];
  for (const p of t.room.problems()) if (inside(p)) { await t.room.fix(p.id); out.push(p.type + '@' + Math.round(p.x) + ',' + Math.round(p.y)); }
  for (const f of t.life.flyers()) if (inside(f)) { t.life.pick(f.i); out.push('flyer@' + Math.round(f.x) + ',' + Math.round(f.y)); }
  return out;
}, r);

// everything in the view but the world, the fx canvas (bursts) and the sky — plus whatever `keep` names
export const hideUi = (page, keep = []) => page.addStyleTag({ content: '#twView>:not(#twWorld):not(#twFx):not(.tw-night)' + keep.map((k) => ':not(' + k + ')').join('') + '{visibility:hidden!important}.tw-toast{visibility:hidden!important}' });

// film `secs` at 30 fps on the stepped clock with the CSS animations synced to it. `views` shoots each frame more than once:
// [{ name, clip, cap }] — `cap` goes on <html data-cap> for that view's screenshot only (a pure visibility switch, so the
// game runs one timeline and every view is the same instant). Returns the folders.
// ⏱ 32 ms A FRAME, as harness.roll steps it: exactly two of the fake clock's 16 ms animation ticks, so nothing that moves
// per tick (confetti, bursts) hitches on the frames a 33/33/34 cadence gave three ticks to.
// ⚠️ NOT harness.cssStep: it never lets a finished element.animate() finish, so the wheel's and the Exchange's coin flights
// (which remove their coin and pay in `onfinish`) would leave every coin frozen where it took off. __capSync finishes them.
export const DT = 32;
export async function rollSync(page, { secs, fps = 30, views, each = null }) {
  const dirs = views.map((v) => { const d = path.join(CAP, v.name); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); return d; });
  const n = Math.round(secs * fps), t0 = Date.now();
  await page.evaluate(() => window.__capSync(true));
  for (let i = 0; i < n; i++) {
    if (each) await each(i, i / fps);
    await page.clock.runFor(DT);
    await page.evaluate(() => window.__capSync(false));
    for (let k = 0; k < views.length; k++) {
      const v = views[k];
      if (views.length > 1) await page.evaluate((c) => { document.documentElement.dataset.cap = c || ''; }, v.cap || '');
      await page.screenshot({ path: path.join(dirs[k], String(i).padStart(4, '0') + '.png'), clip: v.clip || undefined, animations: 'allow', caret: 'hide' });
    }
  }
  views.forEach((v, k) => fs.writeFileSync(path.join(dirs[k], 'meta.json'), JSON.stringify({ name: v.name, frames: n, fps, clip: v.clip || null, secsReal: Math.round((Date.now() - t0) / 100) / 10, dtMs: DT, cssSynced: true }, null, 1)));
  return dirs;
}

// the shot's notes for the editor, beside its frames — written by the spec after every take (rollSync clears the folder),
// from the frames and positions the take itself measured, so a re-film never leaves stale notes behind
export function notes(name, n) { fs.writeFileSync(path.join(CAP, name, 'notes.json'), JSON.stringify({ shot: name, ...n }, null, 1)); }
// a page element's box in the captured PNG's own pixels (device px of the clip), for the notes' focus points
export const boxPx = (page, sel, clip, dpr = 2) => page.evaluate(([s, c, d]) => {
  const e = typeof s === 'string' ? document.querySelector(s) : null; if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round((r.left + r.width / 2 - c.x) * d), y: Math.round((r.top + r.height / 2 - c.y) * d), w: Math.round(r.width * d), h: Math.round(r.height * d) };
}, [sel, clip, dpr]);
// a world point in the captured PNG's own pixels, through the game's own camera
export const worldPx = (page, x, y, clip, dpr = 2) => page.evaluate(([wx, wy, c, d]) => {
  const w = document.getElementById('twWorld').getBoundingClientRect(), s = parseFloat(document.getElementById('twWorld').style.getPropertyValue('--ws')) || 1;
  return { x: Math.round((w.left + wx * s - c.x) * d), y: Math.round((w.top + wy * s - c.y) * d) };
}, [x, y, clip, dpr]);

// where a world point is on the page, in CSS px (the world is translated by the game's own camera)
export const onPage = (page, x, y) => page.evaluate(([wx, wy]) => { const w = document.getElementById('twWorld').getBoundingClientRect(), s = parseFloat(document.getElementById('twWorld').style.getPropertyValue('--ws')) || 1; return { x: w.left + wx * s, y: w.top + wy * s }; }, [x, y]);
