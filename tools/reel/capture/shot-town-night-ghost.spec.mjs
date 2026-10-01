// 👻 A GHOST PUTS OUT A LAMP, AND OUR BANANA CHASES IT OFF. A plain town night (every night has its ghosts): the roamer
// drifts to the street lamp by the post office — it goes for lit lamps near you (town-night.js wayNearLamp) — and snuffs
// it: a puff, the lamp dark, its repair icon, a −1 off the town. Our banana charges; the ghost flees at its own pace and
// is caught when walked into: it un-forms in a purple burst (town-night.js catchGhost). No ghost and no mess is placed by
// hand: our banana stands near the lamp and the director waits, unfilmed, until the roamer is about a second from it
// with no mess made yet (a new night if it went elsewhere first).
import { test } from '@playwright/test';
import { pause, roll } from './harness.mjs';
import { W, H, stageTown, waitSync, placeMe, walkTo, notes, px, peek, tidy } from './town-night-helpers.mjs';

test.use({ viewport: { width: W + 100, height: H + 200 }, deviceScaleFactor: 2 });

const LAMP = 'lamp1', WAY = [1620, 680], ME = [1800, 640];
const C = { x: 1330, y: 190, w: 660, h: 960 };

// a fresh plain night: ghosts out from their own spots, the lamps whole, today's chores where the day put them
async function nightAgain(page) {
  await page.evaluate(() => { const t = window.__town; t.life.set(19.9); });
  await waitSync(page, 700);
  await page.evaluate(() => { const t = window.__town; t.room.set(100); t.room.today([]); t.life.set(20.02); });
  await waitSync(page, 800);
}

test('town-night-ghost', async ({ page }) => {
  await stageTown(page, { time: '2026-09-27T21:00:00', hour: 16 });
  await pause(page);
  await placeMe(page, ME[0], ME[1]);
  let ready = null;
  for (let take = 0; take < 8 && !ready; take++) {
    await nightAgain(page);
    await tidy(page, C);
    let prev = null;
    for (let t = 0; t < 60000 && !ready; t += 200) {
      await waitSync(page, 200);
      const p = await peek(page);
      if (p.lamps[LAMP] !== 'ok') break;   // it went out off camera: a new night
      const g = p.ghosts.find((q) => q.id === 'roam'), pg = prev && prev.ghosts.find((q) => q.id === 'roam');
      prev = p;
      if (!g || !pg || g.mess) { if (g && g.mess) break; continue; }   // its first mess must be this lamp
      const vx = g.x - pg.x, vy = g.y - pg.y, sp = Math.hypot(vx, vy), dx = WAY[0] - g.x, dy = WAY[1] - g.y, d = Math.hypot(dx, dy);
      if (t >= 1400 && sp > 1 && d > 45 && d < 80 && (vx * dx + vy * dy) / (sp * d) > 0.97) ready = { take, d: Math.round(d), at: t };   // 1.4 s: the tidy-up's bursts are gone
    }
  }
  if (!ready) throw new Error('the roamer never went for the lamp');
  const v = await page.locator('#twView').boundingBox();
  const ev = { out: -1, charge: -1, caught: -1, ready, pickups: [] };
  let at = null, nProb = (await peek(page)).problems;
  await roll(page, {
    name: 'town-night-ghost', secs: 5, clip: { x: v.x + C.x, y: v.y + C.y, width: C.w, height: C.h },
    each: async (i) => {
      const p = await peek(page), g = p.ghosts.find((q) => q.id === 'roam');
      if (ev.out < 0 && p.lamps[LAMP] !== 'ok') ev.out = i - 1;   // what each() sees happened in the step before (frame i - 1)
      if (ev.out >= 0 && ev.charge < 0 && i >= ev.out + 15) ev.charge = i;
      if (ev.charge >= 0 && ev.caught < 0 && g && g.hidden) { ev.caught = i - 1; at = g; await walkTo(page, p.pos.x, p.pos.y); }
      if (ev.charge >= 0 && ev.caught < 0 && g) await walkTo(page, g.x, g.y + 6);
      if (p.problems < nProb) ev.pickups.push(i - 1);   // a walk-over pickup (+coins) in the shot
      nProb = p.problems;
    },
  });
  if (ev.out < 0 || ev.caught < 0 || ev.pickups.length) throw new Error('a bad take (the lamp or the catch missed the roll): ' + JSON.stringify(ev));
  const lampHead = [1515, 590];
  notes('town-night-ghost', {
    what: 'A plain town night by the post office: a ghost drifts up to the street lamp and puts it out (a puff, the lamp goes dark, a repair icon and a −1 for the town); our banana charges in from the right, the ghost flees and is caught — it un-forms in a purple burst.',
    best: [
      { from: Math.max(0, ev.out - 25), to: Math.min(149, ev.caught + 30), why: 'the ghost reaches the lamp, puts it out, our banana charges, POOF' },
      { from: Math.max(0, ev.out - 8), to: ev.out + 20, why: 'the lamp going out' },
      { from: ev.charge, to: Math.min(149, ev.caught + 25), why: 'the charge and the catch' },
    ],
    focus: [
      { frame: ev.out + 2, ...px(C, lampHead[0], lampHead[1] + 60), what: 'the lamp just put out, the ghost under it' },
      { frame: ev.caught + 3, ...px(C, at ? at.x : 1540, (at ? at.y : 700) - 30), what: 'the catch: the ghost un-forms in purple' },
    ],
    events: ev,
    issues: 'Night-blue grade is the game\'s own (no storm: a plain night, chosen for clarity). The ghost\'s pale green with a violet edge is its real look. The yellow box over the dark lamp is the game\'s repair icon; the small −1 rising over the ghost is the town losing a point. The lamp\'s puff carries a flat white disc under it — that is how the town\'s puff renders today (two .tw-poof rules in town.astro), not a capture fault.',
  });
});
