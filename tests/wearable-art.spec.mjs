// 🎨 THE ART IS THE ART (19 Sep 2026). 195 804 B of hand-authored pixel SVG moved out of
// src/lib/banana-engine.js and ships packed, about 17 KB, decoded back at import. The whole case for
// a change that wide rests on one property: the decoder reproduces the source string BYTE FOR BYTE.
//
// tools/check-wearart.mjs proves that in node against the source module. THIS proves it where it
// actually matters — in a browser, against the BUILT, minified chunk the player downloads, reached
// from a real page. If these two ever disagree, believe this one.
//
// ⚠️ the chunk's exports are minified to single letters, so the art dict is found by SHAPE rather
// than by name; do not "fix" that by reaching for m.SVG, which is undefined in the build.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const chunk = fs.readdirSync(path.join(ROOT, 'dist', '_astro')).find((f) => /^banana-engine\..*\.js$/.test(f));

test('the SHIPPED engine draws exactly the art the source says', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const src = await import(pathToFileURL(path.join(ROOT, 'tools', 'wearart-source.js')).href);
  const want = src.WEAR_ART_SOURCE;
  await page.goto('/park/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const got = await page.evaluate(async (c) => {
    const m = await import('/_astro/' + c);
    // the chunk's exports are minified to single letters, so find the art dict by SHAPE:
    // the one plain object that has a known wearable in it
    let dict = null;
    for (const k of Object.keys(m)) {
      const v = m[k];
      if (v && typeof v === 'object' && typeof v.shadesFront === 'string' && v.shadesFront.startsWith('<svg')) { dict = v; break; }
    }
    if (!dict) return { __none: Object.keys(m).join(',') };
    const out = {};
    for (const k of Object.keys(dict)) out[k] = dict[k];
    return out;
  }, chunk);
  if (got.__none !== undefined) throw new Error('no art dict among the chunk exports: ' + got.__none);
  const missing = Object.keys(want).filter((k) => !(k in got));
  const diff = Object.keys(want).filter((k) => k in got && got[k] !== want[k]);
  const extra = Object.keys(got).filter((k) => !(k in want));
  console.log('chunk:', chunk);
  console.log('source wearables:', Object.keys(want).length, '| engine dict keys:', Object.keys(got).length);
  console.log('missing from the engine:', missing.length ? missing.join(', ') : 'none');
  console.log('DIFFERENT from the source:', diff.length ? diff.join(', ') : 'none');
  console.log('extra (the three packs):', extra.length, extra.slice(0, 6).join(', '));
  console.log('errors:', errs.length ? errs.slice(0, 2).join(' | ') : 'none');
  expect(missing).toEqual([]);
  expect(diff).toEqual([]);
  expect(errs).toEqual([]);
});
