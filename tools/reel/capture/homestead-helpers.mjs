// 🏡 THE HOMESTEAD'S CREW KIT (1 Oct 2026, the town trailer): a lived-in yard seeded the way the game stores one (hs-v1:
// a stage-3 house and its furnished ground floor, decor, a vegetable patch, the flock with the dog and the cat), the view
// sized so the game's own layout() lands on scale 1 (one world px = one CSS px, two device px at DPR 2), every HUD/toast
// layer hidden. Filming is the harness's roll(), which steps the game's CSS animations (the heart floats, the mood bubble,
// the doghouse nap) with its clock; waitSync() does the same while the clock runs unfilmed.
import fs from 'node:fs';
import path from 'node:path';
import { stage, pause, css, cssStep, CAP } from './harness.mjs';

export const TIME = '2026-10-01T15:10:00';   // an autumn afternoon (the homestead draws no hour; the cat zooms more after 19)
export const DAY0 = Math.floor(new Date(TIME).getTime() / 86400000);

// ⚠️ the view's size decides the game's scale (banana-homestead.js layout(): snapScale(min(1.7, w/520, max(…, w/900,
// h/760)))). 760 x 1100 at DPR 2 lands on exactly 1.0, and 1100 is the whole world's height, so the camera never moves
// vertically and follows the banana sideways only. 1000 x 940 lands on 1.0 too (the house's room, which is wide).
export const VIEW_W = 760, VIEW_H = 1100;

// an animal as the game keeps her (farmAnimals(): sp, b bond, pd last-hug day, name, wd wool days, id, ad arrival day,
// gs her tally, sd the personality seed: pace = sd%3, patience = (sd/3)%3, boldness = (sd/9)%4, spot = (sd/36)%5)
// ⚠️ b 5: a hug takes her to 6, inside Lv 4 — a level crossed would float a "⬆ Lv" label over her
const A = (sp, id, sd, o) => ({ sp, b: 5, pd: 0, name: '', wd: 0, id, ad: DAY0 - 20, gs: 3, sd, ...o });

// 🐾 the flock: the dog (sd 22: steady pace, middling patience, bold 2), the cat (sd 94: favourite spot the house), three
// hens and a rooster, two chicks, a goat, two woolly sheep and the cow. The farm animals keep to where they were set down
// (the ✥ move tool's pin, a.hm): the herd lives right of the trough, so the dog's run and the cat's corner stay clear.
// Unnamed on purpose: a name is a label over her head on a tap, and the trailer's words are the editor's.
// ⚠️ bonds sit mid-level (dog 11, cat 8, the rest 5): a hug's +1 crossing a level floats a "⬆ Lv" label over her.
export const FLOCK = (pins = {}) => withPins(pins, [
  A('dog', 200200, 22, { b: 11, ad: DAY0 - 33 }),   // ⚠️ not a multiple of 30 days: her yard-day doubles the hug heart
  A('cat', 424242, 94, { b: 8, ad: DAY0 - 12 }),
  A('hen', 100101, 11 + 108, { hm: { x: 1110, y: 590 } }),
  A('hen', 100102, 13 + 108, { hm: { x: 1210, y: 600 } }),
  A('hen', 100103, 16 + 108, { hm: { x: 1270, y: 650 } }),
  A('rooster', 100104, 4 + 108, { hm: { x: 1160, y: 630 } }),
  A('hen', 100105, 7 + 108, { gd: 2, ad: DAY0 - 2, hm: { x: 1090, y: 630 } }),   // chicks: young hens (gd < 5)
  A('hen', 100106, 8 + 108, { gd: 1, ad: DAY0 - 1, hm: { x: 1230, y: 690 } }),
  A('goat', 100107, 5, { hm: { x: 1200, y: 660 } }),
  A('sheep', 100108, 3, { wd: 3, hm: { x: 1010, y: 640 } }),
  A('sheep', 100109, 1, { wd: 3, hm: { x: 1110, y: 700 } }),
  A('cow', 100110, 9, { hm: { x: 1060, y: 660 } }),
]);

// a shot may set the herd down elsewhere (they are animals: where they stand differs from one visit to the next)
function withPins(pins, flock) {
  flock.forEach((a) => { if (pins[a.id]) a.hm = pins[a.id]; });
  return flock;
}

// the outdoor pieces (ids from src/data/decor.js; x,y = the piece's base). No fountain and no lit campfire: both are
// animated GIFs, which run on the real clock and would stutter in stepped footage.
export const TROUGH = { x: 900, y: 540 }, DOGHOUSE = { x: 540, y: 540 };
export const ITEMS = () => [
  { id: 'trough', ...TROUGH },
  { id: 'coop', x: 1150, y: 510 },
  { id: 'doghouse', ...DOGHOUSE },
  { id: 'dogbowl', x: 600, y: 552 },
  { id: 'sunflower', x: 585, y: 452 }, { id: 'sunflower', x: 612, y: 454 }, { id: 'redflower', x: 905, y: 452 },
  { id: 'blueflower', x: 930, y: 450 }, { id: 'whiteflower', x: 958, y: 452 }, { id: 'flowerbush', x: 996, y: 458 },
  { id: 'bush2', x: 470, y: 470 }, { id: 'bench', x: 1250, y: 470 }, { id: 'birdhouse', x: 1310, y: 472 },
  { id: 'scarecrow', x: 330, y: 560 }, { id: 'bananacrate', x: 1330, y: 600 }, { id: 'lantern2', x: 1080, y: 760 },
  { id: 'lantern2', x: 1230, y: 760 }, { id: 'stump', x: 420, y: 470 }, { id: 'mushrooms', x: 1360, y: 700 },
];
// a vegetable patch: soil cells {i, j} (48 px tiles), crops at stage 1 + waters (4 = ripe)
export const SOIL = () => {
  const out = [], crops = ['tomato', 'pumpkin', 'carrot', 'corn', 'strawberry', 'sunflower'];
  for (let i = 4; i <= 7; i++) for (let j = 13; j <= 14; j++) {
    const k = (i - 4) * 2 + (j - 13);
    out.push({ i, j, crop: crops[k % crops.length], waters: [3, 2, 3, 1, 2, 3, 3, 2][k], last: '', planted: '' });
  }
  return out;
};
// the house's ground floor (tier 3: room box x 588-1212, y 332-764; floor bounds x 606-1194, y 436-756). The living
// corner on the left (lamp, fireplace, a painting over it, tree, the rug before the fire, couch, armchair), the bookshelf,
// then the kitchen line along the back wall — stove, two oak counters butted (62 apart: the game's chain), the fridge —
// with the toaster and the coffee machine on the first counter and a sink on the second (things on a counter keep its
// base line, y 450), a dining table on the right. Every spot passes the game's own placement check (__hs.inOk).
export const ROOM = () => ({ 3: [
  { id: 'readlamp', x: 626, y: 470 }, { id: 'fireplace', x: 700, y: 470 }, { id: 'sunsetpic', x: 700, y: 398 },
  { id: 'parlorplant', x: 774, y: 470 }, { id: 'bookshelf', x: 850, y: 460 },
  { id: 'stove', x: 954, y: 462 }, { id: 'ctroak', x: 1000, y: 450 }, { id: 'ctroak', x: 1062, y: 450 },
  { id: 'fridge', x: 1108, y: 462 }, { id: 'pottedplant', x: 1166, y: 470 },
  { id: 'toaster', x: 984, y: 450 }, { id: 'coffeemachine', x: 1016, y: 450 }, { id: 'sink', x: 1062, y: 450 },
  { id: 'greyrug', x: 700, y: 585 }, { id: 'bigcouch', x: 700, y: 690 }, { id: 'whitechair', x: 800, y: 580 },
  { id: 'famtable', x: 1080, y: 660 }, { id: 'dinchair3', x: 1080, y: 700 },
] });

export function yard(o = {}) {
  const animals = o.animals || FLOCK();
  return {
    v: 1, name: 'Sunny Acres', claimedAt: (DAY0 - 40) * 86400000, stage: 3, style: { 3: 'country' }, look: '',
    items: o.items || ITEMS(), shed: [], orders: [], mail: [], pantry: {},
    inItems: o.inItems || ROOM(), soil: o.soil || SOIL(), fence: o.fence || [],
    home: { x: 760, y: 430 }, mailAt: { x: 1252, y: 850 },
    signAt: o.signAt || { x: 1480, y: 850 },   // the sign carries the yard's name in words: set down east, out of every frame
    animals, animalsV: 3, hens: animals.filter((a) => a.sp === 'hen').length,
    ...(o.extra || {}),
  };
}

// the page as a returning player opens it: our banana plain (no outfit), the quest and the tour already met, Nib's present
// already opened, the sowing lessons already learned — so no card, chip or glow lands on the shot
export async function openYard(page, y, { time = TIME, url = '/homestead/?hstest=rich', w = VIEW_W, h = VIEW_H } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await stage(page, {
    url, time, arg: y,
    init: (yd) => {
      if (sessionStorage.getItem('hs-cap-seeded')) return;
      sessionStorage.setItem('hs-cap-seeded', '1');
      try {
        localStorage.setItem('bb-last', JSON.stringify({ hat: 'none', glasses: 'none', extras: {}, effect: 'none', c: '' }));
        localStorage.setItem('bw-social-v1', JSON.stringify({ g: { none: 1 } }));
        localStorage.setItem('bwq-c1', JSON.stringify({ done: true }));
        localStorage.setItem('bwq-c2', JSON.stringify({ done: true }));
        localStorage.setItem('bw-tour-v1', '1');
        localStorage.setItem('bw-tour-inv', '1');
        localStorage.setItem('hs-seedhint-v1', JSON.stringify({ arrive: 1, planted: 1 }));
        localStorage.setItem('hs-roadcoins-v1', '1');   // the first visit's coin trail is long collected
        localStorage.setItem('hs-v1', JSON.stringify(yd));
      } catch (e) {}
    },
  });
  await page.waitForFunction(() => window.__hs && window.__hs.wx && window.__hs.animals, null, { timeout: 60000 });
  await page.evaluate(() => window.__hs.wx('clear'));   // the real sky may be raining: the animals would huddle
  // the frame: the view at w x h, nothing over it but the world (HUD, hint, toast, weather layer, exit strip)
  await css(page, [
    'header,nav,.site-nav,footer,.skip-link,.hs-sign,.hs-tag,.hs-actions,.ag,.area-guide{display:none!important}',
    'main{padding:0!important;margin:0!important}',
    '.hs-wrap{max-width:none!important;padding:0!important;margin:0!important}',
    '.hs-stage{border:0!important;box-shadow:none!important;width:' + w + 'px!important}',
    '.hs-view{width:' + w + 'px!important;height:' + h + 'px!important}',
    '#hsView>:not(#hsWorld){visibility:hidden!important}',
    '.hs-toast,.hs-hint,.hs-exit{visibility:hidden!important}',
  ].join(''));
  await page.evaluate(() => { window.scrollTo(0, 0); window.dispatchEvent(new Event('resize')); });
  await page.waitForFunction((w) => Math.abs(document.getElementById('hsWorld').getBoundingClientRect().width - w) < 1, 1800, { timeout: 20000 });
  return errs;
}

// the chunks and pictures arrive on real time; then the clock stops
export async function settleAndPause(page, ms = 2500) {
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#hsWorld *')].map((e) => getComputedStyle(e).backgroundImage).filter((b) => b && b !== 'none');
    return imgs.length > 10;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(ms);
  await pause(page);
}

// where a world point is on the screen (the world element's rect already carries the camera)
export const screenAt = (page, wx, wy) => page.evaluate(([x, y]) => {
  const wr = document.getElementById('hsWorld').getBoundingClientRect(), k = wr.width / window.__hs.signGeo().W;
  return [wr.left + x * k, wr.top + y * k];
}, [wx, wy]);
// a player's tap on a world point (the game maps it back through its own camera)
export async function tapWorld(page, wx, wy) {
  const [sx, sy] = await screenAt(page, wx, wy);
  await page.mouse.click(sx, sy);
}
// the view's rect, and the camera's x (how far the world is panned)
export const viewBox = (page) => page.evaluate(() => {
  const v = document.getElementById('hsView').getBoundingClientRect(), w = document.getElementById('hsWorld').getBoundingClientRect();
  return { x: v.left, y: v.top, width: v.width, height: v.height, camX: v.left - w.left, camY: v.top - w.top };
});

// run the clock without filming (a walk to its mark, the herd settling) with the CSS clock in step, the way roll() steps it
export async function waitSync(page, ms) {
  for (let t = 0; t < ms; t += 100) { const d = Math.min(100, ms - t); await page.clock.runFor(d); await cssStep(page, d); }
}

// a world point → pixels in the captured PNG (the clip is the view; DPR 2)
export const dev = (v, wx, wy) => ({ x: Math.round((wx - v.camX) * 2), y: Math.round((wy - v.camY) * 2) });
export function notes(name, o) {
  fs.writeFileSync(path.join(CAP, name, 'notes.json'), JSON.stringify({ shot: name, ...o }, null, 1));
}
