// 🌙 THE TOWN AT NIGHT, FILMED (1 Oct 2026, the trailer's curse shots). Shared by shot-town-night-*.spec.mjs.
// Unlike the reference shot, the SKY (.tw-night) and the WEATHER (.wx) stay on screen: both are children of the view,
// and hiding every child but the world turns the night back into day. The fx canvas stays hidden — it only carries
// fireworks, and nothing in these shots launches one. Pre-rolls step the CSS with the game's clock (waitSync), the
// way harness.roll does on film: the dusk fade, the rain, the lightning and the curse's glows run on CSS.
import fs from 'node:fs';
import path from 'node:path';
import { stage, css, cssStep, CAP } from './harness.mjs';

// the editor's notes beside the frames (roll() clears the folder, so this is written after it)
export function notes(name, o) { fs.writeFileSync(path.join(CAP, name, 'notes.json'), JSON.stringify({ shot: name, ...o }, null, 1)); }

export const W = 2200, H = 1300;

// our banana plain, both chapters met (no chapter marks, no intro card), one fixed world id so the square's own chores
// (seeded per player and day) lie in the same places on every take
export function nightInit() {
  try {
    localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
    localStorage.setItem('bwq-c2', JSON.stringify({ done: true }));
    localStorage.setItem('bb-last', JSON.stringify({ hat: 'none', glasses: 'none', extras: {}, effect: 'none', c: '' }));
    localStorage.setItem('park-sid', 'c4a7e2b1-0d3');
  } catch (e) {}
}

// /town/?towntest (no live room, no other players), the whole world at true size, the HUD and the toasts hidden —
// the sky and the weather kept. `hour` is the town's own (20–24 is night), `life` the room's number (100 = thriving,
// and high enough that a night of ghost damage cannot move the band mid-shot and re-light the lamps)
export async function stageTown(page, { time, hour, life = 100, wx = 'clear' }) {
  await stage(page, { url: '/town/?towntest', time, init: nightInit });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 60000 });
  await page.evaluate(([h, l, w]) => { const t = window.__town; t.room.curse('none'); t.wx(w); t.room.set(l); t.life.set(h); }, [hour, life, wx]);
  await page.evaluate(() => window.__town.room.nightReady());
  await css(page, [
    '.tw-wrap{max-width:none!important;padding:0!important}', '.tw-stage{box-shadow:none!important;border:0!important}',
    `.tw-view{width:${W}px!important;height:${H}px!important}`,
    `#twWorld{width:${W}px!important;height:${H}px!important;transform:none!important}`,
    '#twView>:not(#twWorld):not(.tw-night):not(.wx){visibility:hidden!important}', '.tw-toast{visibility:hidden!important}',
  ].join(''));
  await page.waitForTimeout(1500);   // real time: the chunks and pictures arrive
}

// run the game and its CSS together, a frame at a time, without filming (a pre-roll: a night settling, a ghost on its
// way) — 32 ms a frame, roll()'s own step (two of the fake clock's 16 ms animation ticks)
export async function waitSync(page, ms) {
  for (let t = 0; t < ms; t += 32) { await page.clock.runFor(32); await cssStep(page, 32); }
}

// a world point → device px in the captured PNG (clip origin `c` in CSS px of the view, DPR 2)
export const px = (c, x, y) => ({ x: Math.round((x - c.x) * 2), y: Math.round((y - c.y) * 2) });

// what the director reads every frame
export const peek = (page) => page.evaluate(() => {
  const t = window.__town, r = t.room;
  return { pos: { x: t.pos.x, y: t.pos.y }, ghosts: r.ghosts(), lamps: r.lamps(), objects: r.objects(), cursed: r.cursedMe(), fx: r.meFx(), beat: t.life.beat(), night: r.night(), problems: r.problems().length };
});
// your own chores inside a region are done already: a walk-over pickup pays a +2 float and a burst, which must not land
// in the middle of the moment being filmed (the game's own fix() and pick(), as if you had tidied up earlier; the
// bursts and floats are gone 1 s later, so pre-roll at least 1.2 s after)
export const tidy = (page, c) => page.evaluate(([r]) => {
  const t = window.__town, inside = (p) => p.x > r.x - 60 && p.x < r.x + r.w + 60 && p.y > r.y - 60 && p.y < r.y + r.h + 60;
  let n = 0;
  for (const q of t.room.problems()) if (q.type !== 'lamp' && inside(q)) { t.room.fix(q.id); n++; }
  for (const f of t.life.flyers()) if (inside(f)) { t.life.pick(f.i); n++; }
  return n;
}, [c]);
export const walkTo = (page, x, y) => page.evaluate(([a, b]) => { const t = window.__town; t.tgt.x = a; t.tgt.y = b; }, [x, y]);
export const placeMe = (page, x, y) => page.evaluate(([a, b]) => { const t = window.__town; t.pos.x = a; t.pos.y = b; t.tgt.x = a; t.tgt.y = b; }, [x, y]);
