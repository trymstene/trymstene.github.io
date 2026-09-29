// 🏡 THE FRONT PAGE'S HOMESTEADS (29 Sep 2026): real yards, drawn by the game itself, a new four every day.
//
// Trym: "they all look the same … probably all are very early snapshots of users homesteads and they all look
// empty … maybe it could look nicer with 4 updated homesteads, or most active ones so you see their content, and
// underneath is more stickerpills of other homesteads … shuffled amongst active homesteads so we dont show lots of
// inactive ones on the frontpage".
//
// ❌ What this replaced: tools/build-yard-cards.py drew each yard in PIL from its public doc (the house, the decor,
// the soil: no animals, no fences, no crops), and nothing ran it after 6 Sep, so the strip was eight tents from the
// first week.
//
// THE PICK (tools/yard-pick.mjs; the UTC day is the seed, so every deploy that day agrees):
//   active   a real yard (never testy/trym/qa), stage 1 or more, saved in the last 14 days, and saved again at
//            least 12 hours after it was made (one sitting is not a homestead yet); one yard per owner.
//   weight   what is in it (stage, things, animals, crops, fences) × how recently it was saved.
//   order    a seeded weighted shuffle: the first four that are furnished enough become PHOTOS, the next twelve
//            become pills. The liveliest yards come up most days, and every active one gets its turn.
//
// THE PHOTO: the live site's own visitor view (/homestead/?yard=<slug>) in headless Chromium, the world laid flat
// at scale 1 with the game's chrome hidden, then the 960×720 window where the most is going on (the house first,
// then animals, then things; the smallest window that holds nearly all of it), 1:1 pixels, as webp.
//   ⚠️ the network is shut except the site, the yard's public doc and the catalog: a photo must never count as a
//   visit (/yards/visit), mint a pass (/anon) or reach analytics.
//
// Writes public/assets/world/yard-<slug>.webp + src/data/yard-cards.json { day, featured, more }.
// Fail-soft: fewer than two photos and nothing is written (the committed set stays), exit 1.
// Run: node tools/build-yard-cards.mjs    (YARD_DAY=2026-10-01 previews another day's pick)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { activeRows, dayOrder, morePills, FURNISHED } from './yard-pick.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://banana-rave.trymstene.workers.dev';
const SITE = process.env.YARD_SITE || 'https://trymstene.com';
const DAY = process.env.YARD_DAY || new Date().toISOString().slice(0, 10);
const NOW = Date.now();
const OUT = path.join(ROOT, 'public', 'assets', 'world');
const MANIFEST = path.join(ROOT, 'src', 'data', 'yard-cards.json');

const FEATURED = 4, MORE = 12;
const SHOT = { w: 960, h: 720 };   // world pixels, drawn 1:1

async function get(url) {
  const r = await fetch(url, { headers: { Origin: 'https://trymstene.com' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

// ── the pick (tools/yard-pick.mjs) ───────────────────────────────────────────────────────────────
const stats = await get(API + '/yards/stats');
const live = activeRows(stats.list, NOW);
const docs = (await Promise.all(live.map((e) => get(API + '/yards/yard?slug=' + encodeURIComponent(e.slug))
  .then((d) => ({ e, d }), () => null)))).filter((x) => x && x.d && x.d.slug);
const pool = dayOrder(docs, DAY, NOW);
console.log(`${DAY}: ${stats.list ? stats.list.length : 0} in the census, ${live.length} active, ${pool.length} after one per owner`);

// ── the photos ───────────────────────────────────────────────────────────────────────────────────
// the bundled Chromium where it is installed (here), else the deploy runner's own Chrome: no browser download per deploy
async function launch() {
  const tries = [{}, { channel: 'chrome' }, { executablePath: '/usr/bin/google-chrome' }];
  let last;
  for (const o of tries) {
    try { return await chromium.launch(o); } catch (e) { last = e; }
  }
  throw last;
}

const bare = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// 📷 THE FRAMING: every 4:3 window of the flat yard is scored by what it holds (a thing half in counts half); the
// house is worth the most and a window that cuts it loses. The smallest window that keeps 90 % of what the biggest
// one holds wins, so a small yard is shown up close, and among equal windows the one centred on the yard's weight.
const SIZES = [[720, 540], [800, 600], [880, 660], [SHOT.w, SHOT.h]];
function frame(geo) {
  let house = null;
  for (const p of geo.pts) if (p.w * p.h > 20000 && (!house || p.w * p.h > house.w * house.h)) house = p;
  const pts = geo.pts.map((p) => (p === house ? { ...p, wt: 12 } : p));
  let sw = 0, cx = 0, cy = 0;
  for (const p of pts) { sw += p.wt; cx += p.wt * (p.x + p.w / 2); cy += p.wt * (p.y + p.h / 2); }
  cx = sw ? cx / sw : geo.W / 2; cy = sw ? cy / sw : geo.H / 2;
  const at = (w, h) => {
    const all = [];
    for (let y0 = 0; y0 <= geo.H - h; y0 += 16) {
      for (let x0 = 0; x0 <= geo.W - w; x0 += 16) {
        let s = 0;
        for (const p of pts) {
          const ix = Math.max(0, Math.min(p.x + p.w, x0 + w) - Math.max(p.x, x0));
          const iy = Math.max(0, Math.min(p.y + p.h, y0 + h) - Math.max(p.y, y0));
          s += p.wt * (ix * iy) / (p.w * p.h);
        }
        if (house && (house.x < x0 || house.y < y0 || house.x + house.w > x0 + w || house.y + house.h > y0 + h)) s -= 30;
        all.push({ s, x0, y0, w, h, off: Math.hypot(x0 + w / 2 - cx, y0 + h / 2 - cy) });
      }
    }
    const top = Math.max(...all.map((o) => o.s));
    return all.filter((o) => o.s >= top - 0.25).sort((a, b) => a.off - b.off)[0];
  };
  const widest = at(SHOT.w, SHOT.h);
  for (const [w, h] of SIZES) {
    const o = at(w, h);
    if (o.s >= widest.s * 0.9) return o;
  }
  return widest;
}

async function shoot(browser, slug, name) {
  const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    await page.route('**/*', (route) => {
      const req = route.request(), u = new URL(req.url());
      const ok = req.method() === 'GET' && (u.origin === new URL(SITE).origin
        || (u.hostname === 'banana-rave.trymstene.workers.dev' && u.pathname === '/yards/yard')
        || (u.hostname === 'banana-share.trymstene.workers.dev' && u.pathname.startsWith('/catalog/')));
      return ok ? route.continue() : route.abort();
    });
    await page.addInitScript(() => {
      try { localStorage.setItem('cookie-consent-v1', 'n'); } catch (e) {}
      try { navigator.sendBeacon = () => true; } catch (e) {}
    });
    await page.goto(`${SITE}/homestead/?yard=${encodeURIComponent(slug)}&hstest=photo`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForFunction(() => window.__hs && document.querySelector('#hsWorld .hs-signname'), null, { timeout: 20000 });
    // scale 1: a 900×760 view is exactly the art's own size (banana-homestead.js layout()), then the view grows to
    // the whole world WITHOUT a resize event, so the scale stays and nothing is off camera
    await page.evaluate(() => {
      const v = document.querySelector('#hsView');
      v.style.width = '900px'; v.style.height = '760px'; v.style.maxWidth = 'none';
      dispatchEvent(new Event('resize'));
      try { window.__hs.wx('clear'); } catch (e) {}
    });
    await page.waitForTimeout(300);
    await page.addStyleTag({ content: `
      html, body { overflow: hidden !important; }
      #hsView { position: fixed !important; left: 0 !important; top: 0 !important; width: 1800px !important; height: 1100px !important;
        max-width: none !important; margin: 0 !important; border: 0 !important; border-radius: 0 !important; z-index: 2147483000 !important; }
      #hsWorld { transform: none !important; }
      #hsView > :not(#hsWorld), #hsMe { display: none !important; }` });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);   // sprites are css backgrounds: nothing to await but time
    const geo = await page.evaluate(() => {
      const w = document.querySelector('#hsWorld'), o = w.getBoundingClientRect();
      const sign = (w.querySelector('.hs-signname') || {}).textContent || '';
      const pts = [];
      const add = (sel, wt) => w.querySelectorAll(sel).forEach((el) => {
        if (el.parentElement !== w) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width && r.height) pts.push({ x: r.x - o.x, y: r.y - o.y, w: r.width, h: r.height, wt });
      });
      add('.hs-hen', 3); add('.hs-it', 1.2); add('.hs-crop', 1); add('.hs-soil', 0.35); add('.hs-fpiece', 0.08); add('.hs-ov', 0.5);
      return { W: o.width, H: o.height, sign, pts };
    });
    // ⚠️ the sign must carry THIS yard's name: a doc that failed to load would leave a blank yard behind it
    const want = bare(name).slice(0, 6);
    if (geo.W !== 1800 || !want || !bare(geo.sign).startsWith(want)) throw new Error('the yard did not draw (' + geo.W + ', "' + geo.sign + '")');
    const best = frame(geo);
    const png = await page.screenshot({ clip: { x: best.x0, y: best.y0, width: best.w, height: best.h } });
    await sharp(png).webp({ quality: 80, effort: 6 }).toFile(path.join(OUT, 'yard-' + slug + '.webp'));
    return best;
  } finally {
    await ctx.close();
  }
}

const browser = await launch();
const featured = [];
const names = new Set();
const tried = new Set();
try {
  for (const y of pool) {
    if (featured.length >= FEATURED || tried.size >= FEATURED + 4) break;
    if (y.stuff < FURNISHED || names.has(y.name.toLowerCase())) continue;
    tried.add(y.slug);
    try {
      const at = await shoot(browser, y.slug, y.raw);
      featured.push({ slug: y.slug, name: y.name, stage: y.stage });
      names.add(y.name.toLowerCase());
      console.log(`photo  ${y.slug.padEnd(30)} ${y.name}  (${at.w}×${at.h} at ${at.x0},${at.y0}; weight ${y.stuff.toFixed(1)})`);
    } catch (e) {
      console.log(`skip   ${y.slug}: ${String(e.message || e).split('\n')[0]}`);
    }
  }
} finally {
  await browser.close();
}
if (featured.length < 2) {
  console.error('only ' + featured.length + ' photo(s): the committed homesteads stay');
  process.exit(1);
}
const more = morePills(pool, featured, MORE);

// the photos that are no longer picked leave with their yard (the .jpg ones are the old bake's)
const keep = new Set(featured.map((f) => 'yard-' + f.slug + '.webp'));
for (const fn of fs.readdirSync(OUT)) {
  if (/^yard-.+\.(jpg|webp)$/.test(fn) && !keep.has(fn)) fs.unlinkSync(path.join(OUT, fn));
}
fs.writeFileSync(MANIFEST, JSON.stringify({ day: DAY, featured, more }, null, 1) + '\n');
console.log(`manifest: ${featured.length} photos, ${more.length} pills`);
