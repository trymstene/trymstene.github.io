#!/usr/bin/env node
// 🎨 THE DESIGN GATE — the mechanical half of docs/design-library.md.
//
// A rule nobody can check is a rule that gets broken again, and both of these
// have now shipped to production at least once. Everything else in the design
// library is judgement; these two are greppable, so they are enforced.
//
//   1. [hidden] LOSES to any author `display:`. A page that toggles `hidden`
//      from script and has no `[hidden] { display: none !important }` renders
//      the hidden thing. This shipped an empty supporter banner to every
//      visitor on the page that takes money.
//   2. PAYMENT URLS LIVE IN ONE CONSTANT (src/data/pay-rail.js). Ten links
//      across the site were still pointing at a platform abandoned months
//      earlier, including the download cards at the busiest moment on the site.
//
// Run: node tools/check-design.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ⚠️ a URL pathname keeps its %20 — this repo lives under "Web Development"
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'src');
// the one file allowed to name a payment host, plus the docs that explain why
const OWNER = ['src/data/pay-rail.js'];
const HOSTS = ['buymeacoffee.com', 'ko-fi.com', 'polar.sh/checkout'];

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(astro|js|mjs|ts)$/.test(e)) out.push(f);
  }
  return out;
};

const files = walk(SRC);
const problems = [];

// ⚠️ ONE guard, site-wide, in the stylesheet every page loads. This was patched
// per-selector five times before anyone wrote the general rule; the check is
// that the general rule is still there, not that ten pages each remembered.
const base = readFileSync(join(ROOT, 'public/css/styles.css'), 'utf8');
if (!/^\s*\[hidden\]\s*\{[^}]*display:\s*none\s*!important/m.test(base)) {
  problems.push(['public/css/styles.css', 'the site-wide `[hidden] { display: none !important }` guard is gone']);
}

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  const src = readFileSync(f, 'utf8');
  // strip comments before hunting for hosts — explaining the history is fine,
  // linking to it is not
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  if (!OWNER.includes(rel)) {
    for (const h of HOSTS) {
      if (code.includes(h)) {
        problems.push([rel, `hardcodes a payment host (${h}) — it belongs in src/data/pay-rail.js`]);
      }
    }
  }
}

if (problems.length) {
  console.error('\n❌ design gate\n');
  for (const [f, why] of problems) console.error(`   ${f}\n     ${why}\n`);
  console.error(`${problems.length} problem(s). See docs/design-library.md.\n`);
  process.exit(1);
}
console.log(`✅ design gate — ${files.length} files, no [hidden] traps, no stray payment hosts`);
