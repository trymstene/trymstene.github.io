// THE RAVE AT THE DROP: a beat before THE DROP our plain banana taps across the floor for the jelly the rig rained —
// a plain one on the way (+1), then the RAINBOW JELLY (+10, confetti, and the NYAN BANANA: our banana flies across the
// floor on a pixel rainbow) — while the drop lands around it: the LED wall goes hot, the floor strobes, the beams whip,
// the pyro fountains fire, every banana dances double-time in confetti.
// Staging, all through the game's own seams:
//  · the live room is never joined: noRoom() answers the socket here and hands the page a roster of FICTIONAL
//    regulars (outfits only, no names); their walking and emotes are the room's own move/emote messages.
//  · the take is fixed (stageStill: the clock stopped from the first instant, the dice seeded). Seed 2 rains a rainbow
//    jelly in the first run — a real roll of the game's dice (~1 in 60 per pellet), not a QA flag.
//  · the floor is staged TALL (760 px): the club's height is min(50vh, 440px), so on a phone the floor is portrait —
//    this is that shape at desktop width, for a 9:16 frame. The page re-measures it (resize) before the jelly lands.
//  · the walk is a real tap on the floor where the rainbow lies.
import { test } from '@playwright/test';
import { css } from './harness.mjs';
import { seed, noRoom, stageStill, until, rollSync, runTo, notes } from './areas-helpers.mjs';

test.use({ viewport: { width: 720, height: 1100 }, deviceScaleFactor: 2 });

const DROP = new Date('2026-10-01T22:00:00').getTime();   // wall clock % 180 s === 0: THE DROP lands
const PRE = 1000;                                          // ms of the ordinary floor before it
const FLOOR_H = 760;

// the regulars — fits real players wear, never a name
const CROWD = [
  { id: 'r01', x: 40, y: 20, outfit: { hat: 'party', glasses: 'shades', extras: {}, effect: 'none' } },
  { id: 'r02', x: 62, y: 15, outfit: { hat: 'crown', glasses: 'hearts', extras: {}, effect: 'sparkle' } },
  { id: 'r03', x: 83, y: 24, outfit: { hat: 'cowboy', glasses: 'none', extras: { mustache: true }, effect: 'none' } },
  { id: 'r04', x: 8, y: 40, outfit: { hat: 'viking', glasses: 'dwi', extras: {}, effect: 'none' } },
  { id: 'r05', x: 47, y: 38, outfit: { hat: 'sombrero', glasses: 'none', extras: { boombox: true }, effect: 'none' } },
  { id: 'r06', x: 70, y: 40, outfit: { hat: 'beanieprop', glasses: 'threed', extras: {}, effect: 'none' } },
  { id: 'r07', x: 88, y: 52, outfit: { hat: 'tophat', glasses: 'monocle', extras: { bowtie: true }, effect: 'none' } },
  { id: 'r08', x: 55, y: 60, outfit: { hat: 'djheadphones', glasses: 'visor', extras: { goldchain: true }, effect: 'disco' } },
  { id: 'r09', x: 76, y: 69, outfit: { hat: 'jester', glasses: 'googlyeyes', extras: {}, effect: 'none' } },
  { id: 'r10', x: 42, y: 79, outfit: { hat: 'halo', glasses: 'none', extras: { balloons: true }, effect: 'none' } },
  { id: 'r11', x: 88, y: 83, outfit: { hat: 'fishbowl', glasses: 'none', extras: {}, effect: 'confetti' } },
  { id: 'r12', x: 22, y: 70, outfit: { hat: 'none', glasses: 'groucho', extras: { ledsneakers: true }, effect: 'none' } },
];

test('rave-floor', async ({ page }) => {
  let room = null;
  const stub = (p) => noRoom(p, (ws, m) => {
    if (m.t !== 'hi') return;
    room = ws;
    const all = [{ id: 'me', outfit: m.outfit, name: '', joined: Date.now(), x: 29, y: 58 },
      ...CROWD.map((c) => ({ ...c, name: '', joined: Date.now() - 900000 }))];
    ws.send(JSON.stringify({ t: 'roster', you: 'me', all }));
  });
  await stageStill(page, {
    url: '/rave/', time: DROP - 10000, stub, init: seed, rand: 2,
    arg: { 'rv-hello': '1', 'rv-tour-v1': '1', 'rv-lz': '1' },   // a returning raver: no lesson, no tour, no DODGE! tag
  });
  await until(page, () => document.querySelectorAll('.rv-raver').length >= 13);
  await css(page, [
    `.rv-floor { height: ${FLOOR_H}px !important; }`,
    '.wh, .rv-dropflash, .rv-toasts, .rv-mixer, .rv-bubble, .rv-stagepop, .rv-questhint, .rv-hellotag, .rv-hellohint, .ccb { visibility: hidden !important; }',
  ].join(''));
  await page.evaluate(() => dispatchEvent(new Event('resize')));   // the club re-measures its floor (the trails canvas, the bar)
  await page.waitForTimeout(2500);   // real time: sprites and fonts arrive (the game's clock waits)
  await runTo(page, DROP - PRE);

  // the booth and the whole floor, down to the bar's counter at its bottom edge (the action bar below stays out)
  const booth = await page.locator('.rv-booth').boundingBox();
  const floorBox = await page.locator('#rvFloor').boundingBox();
  const clip = { x: booth.x, y: booth.y, width: booth.width, height: floorBox.y + floorBox.height - booth.y };
  // the jelly our banana goes for: the rainbow one if the rig rained one (seed 2 does), else the gold
  const goal = await page.evaluate(() => {
    const p = document.querySelector('#rvRun .rv-pellet--rainbow') || document.querySelector('#rvRun .rv-pellet--gold');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, kind: p.className, at: [p.style.left, p.style.top] };
  });
  console.log('goal', JSON.stringify(goal));
  const send = (o) => room && room.send(JSON.stringify(o));
  // the regulars who dance-walk somewhere, and who throws an emote when (the room relays both exactly like this)
  const walks = { r05: [0.9, 0.5], r09: [-0.8, -0.4], r03: [-0.6, 0.6] };
  const pos = Object.fromEntries(CROWD.map((c) => [c.id, { x: c.x, y: c.y }]));
  const EMOTES = { 4: ['r02', 'heart'], 12: ['r07', 'confetti'], 33: ['r01', 'heart'], 36: ['r11', 'confetti'], 40: ['r10', 'heart'],
    46: ['r06', 'confetti'], 58: ['r08', 'heart'], 70: ['r12', 'confetti'], 80: ['r09', 'heart'], 92: ['r04', 'heart'], 104: ['r03', 'confetti'],
    116: ['r07', 'heart'], 128: ['r02', 'confetti'], 140: ['r05', 'heart'] };

  await rollSync(page, {
    name: 'rave-floor', secs: 5, clip,
    each: async (i) => {
      if (i === 1 && goal) await page.mouse.click(goal.x, goal.y);    // tap: off he dances for the jelly
      if (i % 5 === 0 && i >= 20 && i <= 140) {
        for (const id in walks) { const p = pos[id]; p.x += walks[id][0]; p.y += walks[id][1]; send({ t: 'move', id, x: +p.x.toFixed(1), y: +p.y.toFixed(1) }); }
      }
      if (EMOTES[i]) send({ t: 'emote', id: EMOTES[i][0], k: EMOTES[i][1] });
    },
  });
  notes('rave-floor', {
    what: 'THE DROP lands (LED wall hot, strobing floor, pyro, fast beams, every banana double-time in confetti) as our plain banana grabs the RAINBOW JELLY and the nyan banana flies across the floor on a pixel rainbow',
    best: [
      { from: 24, to: 60, why: 'the drop hits (f31-32: pyro fires, the floor strobes) as our banana reaches the rainbow jelly: +10 pops (f40) and the nyan banana launches' },
      { from: 60, to: 140, why: 'the nyan banana flies the width of the strobing floor over the dancing crowd; fistbumps (f115-125); a laser sweep zaps a regular (f128-138, cartoon shock-blink)' },
      { from: 0, to: 30, why: 'the floor a beat before the drop: our banana dance-walks up through the crowd leaving a light trail; the LED wall flips to PEEL RESPONSIBLY. (f19)' },
    ],
    focus: [
      { frame: 32, x: 678, y: 150, what: 'the booth as the drop lands: LED wall, DJ, speakers, four pyro fountains' },
      { frame: 40, x: 282, y: 840, what: 'our banana (yellow glow) catches the rainbow jelly, +10' },
      { frame: 80, x: 522, y: 675, what: 'the nyan banana mid-flight, rainbow behind it' },
      { frame: 110, x: 1038, y: 675, what: 'the nyan banana near the right wall' },
    ],
    issues: "Floor staged tall (760 px; the game caps it at 440 on desktop, phones get a portrait floor like this). The crowd is a fictional local roster (outfits, no names); the live room is never joined. In-game words on screen: the LED wall (NO BAD DANCERS HERE. ONLY BRAVE ONES. until f18, then PEEL RESPONSIBLY.), the INVITE A FRIEND neon, the tonight's DJ desk label, the +10 / fistbump! floats. Hidden: world HUD, JELLY meter, toasts, Barty's speech bubble, the THE DROP banner. The drop tints every banana through the hues (that IS the drop). 32 ms of game time per frame.",
  });
});
