// 🐔 HOME-FARM — the yard alive: the house, the herd round the trough (hens, a rooster and two chicks, a goat, two woolly
// sheep, the cow), the dog at hand and the cat asleep by the house. Our banana walks up to the water trough and fills it,
// and a heart floats up over every animal in the yard at once — the game's own reward for the morning's chore
// (banana-homestead.js itemChip: "💧 fill the trough" → refreshItems() + a float over each of `hens`).
// The fill is the player's two taps (the trough, then its chip's button) made between two frames, so the chip — UI —
// is never on film; the water appearing and the hearts are. He fills it as he comes within reach (150 px), as a player
// does; the herd crowds round him, and a tap within 36 px of an animal is hers, so he waits for a clear spot.
import { test } from '@playwright/test';
import { roll } from './harness.mjs';
import { yard, FLOCK, openYard, settleAndPause, viewBox, waitSync, tapWorld, notes, dev, TROUGH, VIEW_W, VIEW_H } from './homestead-helpers.mjs';

test.use({ viewport: { width: VIEW_W + 40, height: VIEW_H + 60 }, deviceScaleFactor: 2 });

const NAME = 'home-farm';
const START = { x: 880, y: 820 }, STOP = { x: 880, y: 600 };   // up from the bottom of the yard to the trough, straight
// this visit the herd is about the trough, on both sides of it
const PINS = {
  100108: { x: 800, y: 640 }, 100109: { x: 990, y: 620 }, 100110: { x: 960, y: 680 }, 100107: { x: 1060, y: 640 },
  100101: { x: 1010, y: 570 }, 100102: { x: 1090, y: 600 }, 100103: { x: 780, y: 590 }, 100104: { x: 1040, y: 700 },
  100105: { x: 850, y: 700 }, 100106: { x: 1100, y: 680 },
};

// how far the nearest animal's tap point is from the best spot on the trough (a tap within 36 px of one is hers, and the
// yard tests every sprite it walks, the coop's three strollers too: herd() lists only the flock)
const troughClear = (page) => page.evaluate(([tx, ty]) => {
  const wr = document.getElementById('hsWorld').getBoundingClientRect(), k = wr.width / window.__hs.signGeo().W;
  const herd = [...document.querySelectorAll('.hs-hen')].filter((e) => e.style.visibility !== 'hidden').map((e) => {
    const r = e.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - wr.left) / k, y: (r.bottom - wr.top) / k };
  });
  let best = null, bd = -1;
  for (let x = tx - 28; x <= tx + 28; x += 4) for (let y = ty - 38; y <= ty + 8; y += 4) {
    const d = Math.min(...herd.map((h) => Math.hypot(x - h.x, y - (h.y - 14))));
    if (d > bd) { bd = d; best = [x, y]; }
  }
  return { at: best, clear: bd };
}, [TROUGH.x, TROUGH.y]);

test(NAME, async ({ page }) => {
  test.setTimeout(900000);
  const errs = await openYard(page, yard({ animals: FLOCK(PINS) }));
  await page.waitForFunction(() => window.__hs.dog() && window.__hs.cat(), null, { timeout: 60000 });
  await settleAndPause(page, 2500);
  await page.evaluate(([x, y]) => window.__hs.warp(x, y), [START.x, START.y]);
  await page.evaluate(() => window.__hs.dogMood('linger', { at: [760, 650], until: 1e12, heelAt: 1e12, greetAt: 1e12, cd: 1e12, pMoveAt: 1e12, calm: true }));
  await waitSync(page, 80000);   // the herd wanders out from the coop to where each was set down
  await page.evaluate(() => window.__hs.catMood('nap', 0, { visitAt: 1e12, calm: true, at: [745, 505] }));
  await page.evaluate(() => window.__hs.dogMood('linger', { at: [790, 660], until: 1e12, heelAt: 1e12, greetAt: 1e12, cd: 1e12, pMoveAt: 1e12, calm: true }));
  await waitSync(page, 4000);
  // the take starts at a moment the herd stands gathered round the trough and has left the trough itself free (they mill
  // about on their own random walk; this only picks the moment)
  const gathered = () => page.evaluate(() => window.__hs.herd().slice(2).every((h) => h.x > 700 && h.x < 1240 && h.y > 470 && h.y < 720));
  for (let k = 0; k < 150; k++) { if ((await troughClear(page)).clear > 64 && await gathered()) break; await waitSync(page, 400); }
  const v = await viewBox(page);
  let filled = -1;
  const log = [];
  await roll(page, {
    name: NAME, secs: 5.5,
    clip: { x: v.x, y: v.y, width: v.width, height: v.height },
    each: async (i) => {
      if (i === 8) await page.evaluate(([x, y]) => { window.__hs.tgt.x = x; window.__hs.tgt.y = y; }, [STOP.x, STOP.y]);
      const p = await page.evaluate(() => ({ x: window.__hs.pos.x, y: window.__hs.pos.y, tx: window.__hs.tgt.x, ty: window.__hs.tgt.y }));
      // in reach of the trough (the yard opens its chip within 150 px) he fills it — on arrival, as a player does
      if (filled < 0 && i > 8 && Math.hypot(p.x - TROUGH.x, p.y - TROUGH.y) < 140) {
        const at = await troughClear(page);
        if (at.clear > 44 || i > 75) {
          await tapWorld(page, at.at[0], at.at[1]);
          const btn = await page.evaluate(() => { const b = document.querySelector('.hs-chip .hs-btn'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.textContent }; });
          console.log('frame', i, 'trough tap', JSON.stringify(at), 'chip', JSON.stringify(btn));
          if (btn) { await page.mouse.click(btn.x, btn.y); filled = i; }
          else await page.evaluate(() => { const c = document.querySelector('.hs-chip'); if (c) c.remove(); });
        }
      }
      if (i % 10 === 0) log.push(i + ':' + Math.round(p.x) + ',' + Math.round(p.y) + ' floats ' + (await page.evaluate(() => document.querySelectorAll('.hs-float').length)));
    },
  });
  console.log(log.join(' | '));
  console.log('filled', filled, 'cam', v.camX, 'chip left', await page.evaluate(() => !!document.querySelector('.hs-chip')));
  console.log('herd', JSON.stringify(await page.evaluate(() => window.__hs.herd())));
  console.log('errors', JSON.stringify(errs));
  notes(NAME, {
    what: 'The yard alive: the house, the herd round the water trough (hens, a rooster, two chicks, a goat, two woolly sheep, the cow), the dog at hand, the cat asleep by the house. Our banana walks up among them and fills the trough: the water appears and a heart floats up over every animal at once.',
    frames: Math.round(5.5 * 30), fps: 30, camera: 'static (the game camera, centred on him); clip = the whole 760x1100 view at DPR 2',
    best: [
      { from: 0, to: filled + 45, why: 'he walks up through the herd to the trough, fills it: water, and a heart over every animal (dog and cat too)' },
      { from: filled - 12, to: filled + 30, why: 'the tight version: the hearts burst' },
      { from: filled + 30, to: 164, why: 'the yard potters on: hens, sheep, the cow, the trough full' },
    ],
    focus: [
      { frame: filled + 3, ...dev(v, TROUGH.x + 60, TROUGH.y + 60), what: 'the trough fills, hearts over the herd round him' },
      { frame: filled + 3, ...dev(v, 880, 470), what: 'a 9:16 window here takes the house roof down to the herd' },
    ],
    issues: "The hearts are the game's own small floats (they rise and fade in ~1 s, from frame " + filled + "). The trough-fill chip (UI) existed only between two frames and is never on film. Animals wander on their own random walk: their exact spots differ take to take.",
  });
});
