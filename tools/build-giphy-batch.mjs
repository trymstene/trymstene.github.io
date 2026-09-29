// 🎞 A GIPHY / TENOR BATCH, RENDERED BY THE BUILDER ITSELF (29 Sep 2026). Trym: "can you make 50 of these with fitting
// wearables and 2026 puns (or evergreen emotional puns - since people use these as reaction-gifs) in the captions? … give
// me a set of standard tags + emotional reaction tags pr gif".
//
// Every design is opened in /make-a-banana/ as a share link (bg, t, b, h, g, ex, e) and saved through the builder's own
// "Download meme GIF" — src/lib/meme-gif.js, the one render path the builder and the gallery share — so a batch GIF is
// pixel-identical to what a visitor makes and uploads. Then it writes, next to the GIFs, a TAGS.md (per GIF: title,
// caption, the tags to paste — the guide's 12-tag base plus its reactions, ≤ 20, a strongly themed one leading with its
// theme) and a TAGS.csv. Needs a current `npx astro build`. Output stays in giphy-tenor-pack/ (gitignored).
//
//   node tools/build-giphy-batch.mjs giphy-tenor-pack/batch-2026-09-29/designs.json [--only=slug,slug] [--sheets]
// (--sheets: only rewrite TAGS.md / TAGS.csv, render nothing)
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = createRequire(path.resolve('package.json'))('@playwright/test');
const spec = process.argv[2];
if (!spec) { console.error('usage: node tools/build-giphy-batch.mjs <designs.json> [--only a,b]'); process.exit(1); }
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const sheetsOnly = process.argv.includes('--sheets');
const { base, designs } = JSON.parse(fs.readFileSync(spec, 'utf8'));
const OUT = path.dirname(path.resolve(spec));
const PORT = 4397;
const FEET = new Set(['sneakers', 'sneakersblue', 'sneakersgold', 'skates', 'clownshoes', 'cowboyboots', 'discoboots', 'ledsneakers', 'flamekicks', 'flippers', 'sockssandals']);

// the tags to paste: a themed one leads with its theme (the guide: Giphy leans on the leading tag), then the base, then
// the rest of its reactions — never a repeat, never past Giphy's 20
function tagsOf(d) {
  const lead = d.lead ? [d.tags[0]] : [];
  const out = [];
  for (const t of [...lead, ...base, ...d.tags]) if (!out.includes(t)) out.push(t);
  return out.slice(0, 20);
}
const urlOf = (d) => {
  const p = new URLSearchParams();
  if (d.bg) p.set('bg', d.bg);
  if (d.top) p.set('t', d.top);
  if (d.bottom) p.set('b', d.bottom);
  p.set('g', d.g || 'none');
  p.set('h', d.h || 'none');
  if (d.ex && d.ex.length) p.set('ex', d.ex.join('.'));
  if (d.e) p.set('e', d.e);
  return '/make-a-banana/?' + p.toString();
};

const list = sheetsOnly ? [] : designs.map((d, i) => ({ ...d, n: i + 1 })).filter((d) => !only.length || only.includes(d.slug));
for (const d of list) {
  if ((d.ex || []).filter((x) => FEET.has(x)).length > 1) throw new Error(d.slug + ': two things on the feet');
  if (tagsOf(d).length > 20) throw new Error(d.slug + ': more than 20 tags');
}

const server = list.length ? spawn('npx.cmd', ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore', shell: true }) : null;
const stop = () => { if (server) try { execSync('taskkill /pid ' + server.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
if (list.length) try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/make-a-banana/`)).ok) break; } catch (e) {} await new Promise((r) => setTimeout(r, 400)); }
  const b = await chromium.launch();
  for (const d of list) {
    const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    // nothing of a render leaves the machine: no analytics, no pass, no worker calls
    await page.route(/googletagmanager|google-analytics|cloudflareinsights|facebook|clarity|workers\.dev/, (r) => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('tt-internal', '1'); } catch (e) {} });
    await page.goto(`http://127.0.0.1:${PORT}${urlOf(d)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#bbDownloadMemeGif', { state: 'attached', timeout: 30000 });
    await page.waitForTimeout(1500);   // the sheet and the caption font decode
    const file = path.join(OUT, String(d.n).padStart(2, '0') + '-' + d.slug + '.gif');
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      (async () => {
        await page.evaluate(() => document.getElementById('bbDownloadMemeGif').click());
        // the builder's warm-up card may come first: its "no thanks, just the GIF" hands the file over
        const no = page.locator('.mir__no');
        try { await no.first().waitFor({ state: 'visible', timeout: 6000 }); await no.first().click(); } catch (e) {}
      })(),
    ]);
    await dl.saveAs(file);
    // what the builder actually wore, read back from its own state in the URL (a gated item would have come off)
    const worn = await page.evaluate(() => Object.fromEntries(new URLSearchParams(location.search)));
    const want = { h: d.h || 'none', g: d.g || 'none', ex: (d.ex || []).join('.') };
    const got = { h: worn.h || 'none', g: worn.g || 'none', ex: worn.ex || '' };
    const same = want.h === got.h && want.g === got.g && want.ex.split('.').sort().join('.') === got.ex.split('.').sort().join('.');
    console.log(String(d.n).padStart(2, '0'), d.slug, fs.statSync(file).size + ' B', same ? '' : ('⚠️ WORE ' + JSON.stringify(got) + ' not ' + JSON.stringify(want)));
    await ctx.close();
  }
  await b.close();
} finally { stop(); }

// the paste sheets, for every design in the file (not only the ones just rendered)
const all = designs.map((d, i) => ({ ...d, n: i + 1 }));
const md = ['# Giphy / Tenor batch — ' + path.basename(OUT), '',
  'Per GIF: the title, the caption, and the tags to paste (the guide\'s 12-tag base + its reactions, ≤ 20; a strongly themed',
  'one leads with its theme). Source URL on Giphy: https://trymstene.com/dancing-banana-gif-meme/', ''];
for (const d of all) {
  md.push('## ' + String(d.n).padStart(2, '0') + ' — ' + d.title);
  md.push('File: `' + String(d.n).padStart(2, '0') + '-' + d.slug + '.gif` · Caption: ' + [d.top, d.bottom].filter(Boolean).join(' / '));
  md.push('Reaction tags: ' + d.tags.join(', '));
  md.push('Paste (base + reactions, ' + tagsOf(d).length + ' tags):', '```', tagsOf(d).join(', '), '```', '');
}
fs.writeFileSync(path.join(OUT, 'TAGS.md'), md.join('\n'), 'utf8');
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const csv = ['file,title,caption,reaction_tags,all_tags'].concat(all.map((d) => [String(d.n).padStart(2, '0') + '-' + d.slug + '.gif', d.title, [d.top, d.bottom].filter(Boolean).join(' / '), d.tags.join(', '), tagsOf(d).join(', ')].map(q).join(',')));
fs.writeFileSync(path.join(OUT, 'TAGS.csv'), '﻿' + csv.join('\r\n'), 'utf8');
console.log('wrote TAGS.md + TAGS.csv for', all.length, 'designs');
