// 📦 TWO AREAS THAT MUST NOT CARRY THE ICON PACK (19 Sep 2026).
//
// src/lib/pixel-icons.js eager-globs the whole icon directory — 25 278 B built — and the shared World
// HUD used to import it to draw ONE star in the gardener card. That put the pack on the beach and the
// homestead, neither of which carries it for any other reason. The star is inlined in world-hud.js
// now, character for character what iconSvg('star', { size: 13 }) returned.
//
// world-travel.js already made this exact call for this exact reason, and wrote it down: "~70 SVGs to
// draw one glyph". Twice is a check. ⚠️ a FRESH CONTEXT per area or the cache answers for you — the
// first version of this measurement reported four areas as clean because the park had warmed them.
//
// The park, the town and the rave DO carry it, on purpose: they import iconSvg directly and use many.
import { test, expect } from '@playwright/test';

const LIGHT = ['/beach/', '/homestead/'];

test('the beach and the homestead do not carry the icon chunk', async ({ browser }) => {
  for (const p of ['/beach/', '/homestead/', '/park/', '/town/', '/rave/']) {
    const ctx = await browser.newContext();          // a fresh cache each time, or the answer is a lie
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(p, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => {
      const e = performance.getEntriesByType('resource').filter((x) => x.name.endsWith('.js'));
      const icons = e.find((x) => /pixel-icons/.test(x.name));
      return {
        icons: icons ? Math.round((icons.decodedBodySize || 0) / 1024) + ' KB' : 'NOT FETCHED',
        raw: Math.round(e.reduce((a, b) => a + (b.decodedBodySize || 0), 0) / 1024),
        n: e.length,
      };
    });
    if (LIGHT.includes(p)) expect(r.icons, p + ' must not pull pixel-icons.js').toBe('NOT FETCHED');
    expect(errs, p + ' booted clean').toEqual([]);
    console.log(p.padEnd(13), 'pixel-icons:', String(r.icons).padEnd(12), '| page raw', String(r.raw).padStart(4), 'KB in', r.n, 'files', '| errors', errs.length);
    await ctx.close();
  }
});
