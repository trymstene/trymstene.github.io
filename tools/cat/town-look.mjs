// The cat in the real town, at the homestead animals' scale beside the banana (27 Sep 2026).
// Needs the built site served (preview "astro-dist", port 8802) and python tools/cat/preview.py run first (the frames).
// Run: node tools/cat/town-look.mjs [port]   → tools/cat/out/town-look-*.png
import { createRequire } from 'module';
import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const DIR = new URL('./out/', import.meta.url);
const port = process.argv[2] || '8802';
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(new URL(f, DIR)).toString('base64');
const PX = 55.8 / (104 / 3);   // art units per pack pixel: the homestead dog (3.1% of 1800 for a 104px-wide 48-scale strip)
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:' + port + '/town/?towntest', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__town && window.__town.room && window.__town.room.band(), null, { timeout: 30000 });
await page.evaluate(() => window.__town.life.set(12));
await page.evaluate(() => { const t = window.__town; t.pos.x = t.tgt.x = 955; t.pos.y = t.tgt.y = 962; });   // out onto the cobbles, below the fountain
await page.waitForTimeout(3000);
const shots = [
  { name: 'town-look-1', put: [{ f: 'look-walk.png', w: 32 * PX, dx: 62, dy: 6 }, { f: 'look-dog.png', w: 55.8, dx: -78, dy: 4 }] },
  { name: 'town-look-2', put: [{ f: 'look-down.png', w: 32 * PX, dx: 48, dy: 10 }, { f: 'look-sleep.png', w: 32 * PX, dx: -60, dy: 14 }] },
];
for (const s of shots) {
  const put = s.put.map((p) => ({ ...p, src: b64(p.f) }));
  await page.evaluate((put) => {
    document.querySelectorAll('.cat-look').forEach((e) => e.remove());
    const world = document.getElementById('twWorld'), me = document.querySelector('.tw-me');
    const W = 2200, H = 1300;
    const mx = parseFloat(me.style.left) / 100 * W, my = parseFloat(me.style.top) / 100 * H;
    for (const p of put) {
      const el = document.createElement('div');
      el.className = 'cat-look';
      const x = mx + p.dx, y = my + p.dy;
      el.style.cssText = 'position:absolute;left:' + (x / W * 100) + '%;top:' + (y / H * 100) + '%;width:' + (p.w / W * 100) + '%;transform:translate(-50%,-100%);z-index:' + (100 + Math.round(y)) + ';pointer-events:none;';
      const img = document.createElement('img');
      img.src = p.src;
      img.style.cssText = 'width:100%;height:auto;image-rendering:pixelated;display:block;';
      el.appendChild(img);
      world.appendChild(el);
    }
  }, put);
  await page.waitForTimeout(400);
  await page.screenshot({ path: fileURLToPath(new URL(s.name + '.png', DIR)) });
  const box = await page.evaluate(() => { const r = document.querySelector('.tw-me').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.screenshot({ path: fileURLToPath(new URL(s.name + '-zoom.png', DIR)), clip: { x: Math.max(0, box.x + box.w / 2 - 130), y: Math.max(0, box.y - 16), width: 260, height: box.h + 44 } });
}
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
