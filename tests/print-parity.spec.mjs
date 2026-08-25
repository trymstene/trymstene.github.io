// 🖨 PRINT PARITY (rig step 4, Dev Desk issue #4) — the browser half.
// Renders the fixed parity outfits through the REAL drawComposite on the
// built builder page and saves one PNG per (outfit, frame). The python half
// (tests/print_parity_compare.py) renders the same set through
// tools/banana_render.py — the compositor the actual print files come from —
// and pixel-diffs the pairs.
//
// Geometry: W=8300 is the one drawComposite canvas size whose layout lands on
// an INTEGER sprite scale (scale = W*FRAME_H_FRAC/FH = 8300*0.66/498 = 11)
// within Chromium's canvas limits. fx still comes out (8300-469*11)/2 = 1570.5,
// so the context is pre-translated +0.5px in x: the frame origin sits at
// exactly (1571, 1660), which the compare script mirrors. Runs under its own
// config (playwright.parity.config.mjs) — the player walk ignores this file.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPECS = JSON.parse(fs.readFileSync(path.join(HERE, 'print-parity-outfits.json'), 'utf8'));
const OUT = path.join(HERE, '..', 'test-results', 'print-parity', 'browser');

const outfitFor = (spec) => ({
  hat: spec.hat, glasses: spec.glasses,
  extras: Object.fromEntries(spec.extras.map((id) => [id, true])),
  bg: 'transparent', captions: false, effect: 'none', hue: 0,
});

test('drawComposite renders the parity set', async ({ page }) => {
  test.setTimeout(540000); // 32 renders of a 8300² canvas + PNG encodes
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/make-a-banana/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bananaBuilder && window.__bananaBuilder.drawComposite,
    null, { timeout: 30000 });

  // warm pass at a small W: drawing every (outfit, frame) queues every art —
  // side variants only load on side frames, the plush PNG only on first use —
  // then assetsReady() awaits the whole cache before the real renders.
  await page.evaluate((specs) => {
    const bb = window.__bananaBuilder;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 830;
    const ctx = cv.getContext('2d');
    for (const spec of specs) {
      const o = { hat: spec.hat, glasses: spec.glasses, extras: Object.fromEntries(spec.extras.map((id) => [id, true])), bg: 'transparent', captions: false, effect: 'none', hue: 0 };
      for (let f = 0; f < 8; f++) bb.drawComposite(ctx, 830, f, o);
    }
    return bb.assetsReady();
  }, SPECS.outfits);

  for (const spec of SPECS.outfits) {
    for (let f = 0; f < 8; f++) {
      const dataUrl = await page.evaluate(([o, frame, W]) => {
        let cv = window.__parityCv;
        if (!cv) { cv = window.__parityCv = document.createElement('canvas'); cv.width = cv.height = W; }
        const ctx = cv.getContext('2d');
        ctx.resetTransform();
        ctx.translate(0.5, 0); // fx = (W - 469*11)/2 = 1570.5 → integer frame origin
        window.__bananaBuilder.drawComposite(ctx, W, frame, o);
        return cv.toDataURL('image/png');
      }, [outfitFor(spec), f, SPECS.browserCanvas]);
      const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      expect(png.length, `${spec.name} f${f} produced a PNG`).toBeGreaterThan(1000);
      fs.writeFileSync(path.join(OUT, `${spec.name}-f${f}.png`), png);
    }
  }
});
