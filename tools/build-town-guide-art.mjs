#!/usr/bin/env node
// 🪟 THE TOWN GUIDE'S PICTURES (25 Sep 2026) — the map and the windows under Banana Town's frame (src/pages/town.astro,
// #what, #do and #rumours). Trym: "make sure the Banana Town also has a nice, visually excellent, concrete explanation of
// what you can do in Banana Town and what place it is".
//
// ⚠️ NOTHING IS DRAWN HERE. Every picture is the BUILT town with its residents at their posts and the props the game
// paints at runtime (the wheel on Twirl's stall, the lamps, the kiosk shutters). The player, the HUD, the notes and the
// weather are hidden for the shot, and so are the passing visitors in the windows (a banana walking through a window is
// half a banana); everything else is the town exactly as a visitor sees it. Re-run it when the town's art or a
// resident's post changes:
//
//   npx astro build && node tools/build-town-guide-art.mjs
//
// Writes public/assets/town/guide/<key>.png, shot at 1× (one world pixel = one image pixel) and shown at 1× with
// `object-fit: none` — whole pixels, never resampled (design library §6) — and town.webp, the whole town at half size:
// a MAP, smooth like Dot's maps at her counter, not a sprite.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets', 'town', 'guide');
const PORT = 4337;

// the shots: where (world px, the centre), how big, and the town they need — the hour (life.set), the square's
// condition (room.set, 0–100: 70 is 'lively', 5 is 'abandoned') and whether the arcade's room is open. A card's window
// is 420 wide so the widest card (a phone's, one to a row) never shows the edge of its picture.
const MORNING = 6, NOON = 9, EVENING = 17;
const CARD = { w: 420, h: 170 }, ODD = { w: 150, h: 150 };
const SHOTS = [
  { key: 'town', map: true, hour: MORNING, band: 70 },                                   // the whole town, from above
  { key: 'work', x: 1830, y: 972, ...CARD, hour: MORNING, band: 70 },                    // the Coffee Cup, Bean at the hatch
  { key: 'arcade', x: 512, y: 236, ...CARD, hour: MORNING, band: 70, room: true },       // the five cabinets, inside
  { key: 'wheel', x: 1400, y: 712, ...CARD, hour: MORNING, band: 70 },                   // Twirl's stall and its wheel
  { key: 'post', x: 1700, y: 492, ...CARD, hour: MORNING, band: 70 },                    // the post office, Stamp at the door
  { key: 'store', x: 480, y: 972, ...CARD, hour: MORNING, band: 70 },                    // Pip's General Store
  { key: 'exchange', x: 800, y: 712, ...CARD, hour: MORNING, band: 70 },                 // the Exchange stall
  { key: 'folk', x: 1770, y: 1196, ...CARD, hour: NOON, band: 70 },                      // lunch on the terrace: Bean and Stamp
  { key: 'square', x: 1790, y: 985, ...CARD, hour: MORNING, band: 5 },                   // gone to seed: a shut kiosk, a tag, litter
  { key: 'statue', x: 1416, y: 236, ...ODD, hour: MORNING, band: 70 },
  { key: 'window', x: 1098, y: 452, ...ODD, hour: EVENING, band: 70 },                   // the hall's upper window, lit
  { key: 'fountain', x: 1100, y: 862, ...ODD, hour: MORNING, band: 70 },
  { key: 'north', x: 1944, y: 96, ...ODD, hour: MORNING, band: 70 },                     // the road north
];
const WORLD_W = 2200, WORLD_H = 1300;

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return true; } catch (e) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

if (!fs.existsSync(path.join(ROOT, 'dist', 'town', 'index.html'))) { console.error('✗ no built town — run npx astro build first'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
let code = 0;
try {
  if (!(await waitFor(`http://127.0.0.1:${PORT}/town/`, 60000))) throw new Error('the preview server did not come up');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WORLD_W + 100, height: WORLD_H + 200 }, deviceScaleFactor: 1 });
  // the story's first scene owns the screen on a first visit (design library §31): a shot is of the town, not the scene
  await page.addInitScript(() => { try { localStorage.setItem('bwq-c1', JSON.stringify({ done: true })); } catch (e) {} });
  await page.goto(`http://127.0.0.1:${PORT}/town/?towntest`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
  await page.evaluate(() => { window.__town.room.curse('none'); window.__town.wx('clear'); });
  // the whole town at 1×, no camera, nothing over it but the world itself
  await page.addStyleTag({ content: [
    '.tw-wrap{max-width:none!important;padding:0!important}',
    '.tw-stage{box-shadow:none!important;border:0!important}',
    `.tw-view{width:${WORLD_W}px!important;height:${WORLD_H}px!important}`,
    `#twWorld{width:${WORLD_W}px!important;height:${WORLD_H}px!important;transform:none!important}`,
    '#twView>:not(#twWorld){visibility:hidden!important}',
    '.tw-me,.tw-toast,.tw-peer,.tw-poof,.tw-burst{visibility:hidden!important}',
    // the passing visitors (they wear the residents' class, without a resident's key): out of the windows only
    'body.qa-nofolk .tw-npc:not([data-k]),body.qa-nofolk .tw-visitor{visibility:hidden!important}',
  ].join('') });
  const view = page.locator('#twView');
  let state = '';
  for (const s of SHOTS) {
    const want = [s.hour, s.band, !!s.room].join(':');
    if (want !== state) {
      await page.evaluate(({ hour, band, room }) => {
        const t = window.__town;
        if (!room && t.arcade.inside()) t.arcade.exit();
        t.room.set(band);
        t.life.set(hour);
        if (room && !t.arcade.inside()) t.arcade.enter();
      }, s);
      state = want;
      await page.waitForTimeout(1600);
    }
    await page.evaluate((map) => document.body.classList.toggle('qa-nofolk', !map), !!s.map);
    // a resident caught mid-dance or mid-step is a pose in a still: wait for the window to be still (a few seconds at most)
    const box = s.map ? { x: WORLD_W / 2, y: WORLD_H / 2, w: WORLD_W, h: WORLD_H } : s;
    for (let i = 0; i < 25; i++) {
      const busy = await page.evaluate(({ x, y, w, h }) => window.__town.life.residents().some((r) => !r.hidden && (r.dancing || r.walking) && Math.abs(r.x - x) < w / 2 + 40 && r.y > y - h / 2 && r.y - 110 < y + h / 2), box);
      if (!busy) break;
      await page.waitForTimeout(200);
    }
    const b = await view.boundingBox();
    if (s.map) {
      // the map: the whole town, halved smoothly in the page itself (a canvas at high quality), saved as WebP
      const png = await page.screenshot({ clip: { x: b.x, y: b.y, width: WORLD_W, height: WORLD_H } });
      const data = await page.evaluate(async ({ src, w, h }) => {
        const img = new Image(); img.src = src; await img.decode();
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        return c.toDataURL('image/webp', 0.86);
      }, { src: 'data:image/png;base64,' + png.toString('base64'), w: WORLD_W / 2, h: WORLD_H / 2 });
      const file = path.join(OUT, s.key + '.webp');
      fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
      console.log(`  ${s.key.padEnd(9)} ${WORLD_W / 2}×${WORLD_H / 2}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB  (the map)`);
      continue;
    }
    const file = path.join(OUT, s.key + '.png');
    await page.screenshot({ path: file, clip: { x: b.x + s.x - s.w / 2, y: b.y + s.y - s.h / 2, width: s.w, height: s.h } });
    console.log(`  ${s.key.padEnd(9)} ${s.w}×${s.h}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
  }
  await browser.close();
  console.log(`✅ ${SHOTS.length} pictures in public/assets/town/guide/`);
} catch (e) {
  console.error('✗', e.message);
  code = 1;
} finally {
  server.kill();
  if (process.platform === 'win32' && server.pid) { try { spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {} }
}
process.exit(code);
