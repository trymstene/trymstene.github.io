// ✂️ The build strips the comments and indentation out of the CSS that scripts carry as strings (tools/css-strings.mjs,
// 24 Sep 2026, the budget trim). This proves the stripped CSS is the SAME CSS: every such string in src/, as written and
// as shipped, parsed by a real browser into the very same rules.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cssStrings, stripCss } from '../tools/css-strings.mjs';

const walk = (d, out = []) => { for (const e of readdirSync(d)) { const f = join(d, e); if (statSync(f).isDirectory()) walk(f, out); else if (e.endsWith('.js')) out.push(f); } return out; };
// the literal's value, the way the script sees it (its escapes resolved)
const value = (raw) => new Function('return `' + raw + '`')();

test('every CSS string a script carries parses to the same rules with its comments gone', async ({ page }) => {
  const found = [];
  for (const f of walk('src')) {
    const code = readFileSync(f, 'utf8');
    for (const [a, b] of cssStrings(code)) { const raw = code.slice(a, b); found.push({ f, before: value(raw), after: value(stripCss(raw)) }); }
  }
  expect(found.length, 'the twelve CSS strings (a new one is welcome — it is checked the same way)').toBeGreaterThanOrEqual(12);
  const res = await page.evaluate((list) => list.map(({ f, before, after }) => {
    const rules = (css) => { const s = new CSSStyleSheet(); s.replaceSync(css); return [...s.cssRules].map((r) => r.cssText); };
    const x = rules(before), y = rules(after);
    return { f, n: x.length, same: JSON.stringify(x) === JSON.stringify(y), smaller: after.length < before.length };
  }), found);
  for (const r of res) {
    expect(r.n, r.f + ' has rules').toBeGreaterThan(0);
    expect(r.same, r.f + ': the same rules before and after').toBe(true);
  }
  const saved = found.reduce((s, x) => s + x.before.length - x.after.length, 0);
  console.log('CSS strings', found.length, 'saved', saved, 'chars');
  expect(saved, 'and it is worth having').toBeGreaterThan(10000);
});
