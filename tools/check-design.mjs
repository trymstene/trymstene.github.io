#!/usr/bin/env node
// 🎨 THE DESIGN GATE — the mechanical half of docs/design-library.md.
//
// A rule nobody can check is a rule that gets broken again, and every one of
// these has now shipped to production at least once. Everything else in the
// design library is judgement; these are greppable, so they are enforced.
//
// ⭐ THE RULE ABOUT RULES (Trym, 12 Sep 2026: "how can it be guaranteed without
// me having to think that i need to remind you?"). A doctrine in a .md file is
// advisory: it only works if it is read at the moment of the decision, and after
// a context compaction it often is not. What has held in this repo is the
// mechanical half. So: ANY RULE TRYM HAS TO STATE TWICE BECOMES A CHECK HERE —
// and if it cannot be checked, that is itself worth knowing (say so out loud
// rather than filing another paragraph). The footer and the dialogue template
// below are exactly that: both were prose, both drifted, both are greps now.
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

// 🦶 §17 — pages that may sit without the footer: the desk and the dev pages. A
// VISITOR page never may, area pages included: the park shipped footerless and
// Trym had to ask for it ("make sure the footer is available on all our 400+
// pages, even banana world area pages").
const NO_FOOTER_OK = ['src/pages/inbox.astro', 'src/pages/dev-wearables.astro', 'src/pages/dev/design.astro', 'src/pages/dev/copy.astro'];

// 🗣 §18 — the world has ONE NPC dialogue card (src/lib/world-dialogue.js +
// /css/dialogue.css). These two still run the hand-written copies it was lifted
// from; the list must only ever SHRINK. A new area hand-rolling one fails here.
// (dev/design.astro RENDERS the card as documentation of its own classes — it is the
// design system's showroom, not an area building a dialogue.)
const OWN_DIALOGUE_OK = ['src/scripts/park-npc.js', 'src/pages/park.astro', 'src/pages/beach.astro', 'src/scripts/banana-beach.js', 'src/pages/dev/design.astro'];

// 🌦 §19 — the world has ONE weather layer (src/scripts/world-weather.js +
// /css/weather.css). The park had rain first and every number in that CSS was paid
// for there; on 13 Sep 2026 the beach, the town and the homestead started rendering
// the same sky, and a second copy of those keyframes is exactly the drift this file
// exists to catch. An area that renders weather MOUNTS it and LINKS the stylesheet.
const WX_MODULE = 'src/scripts/world-weather.js';
const WX_CSS = '/css/weather.css';
// which page loads each script that mounts the weather. A new area adds a line here,
// which is the point: forgetting the stylesheet is a silent bug (rain with no art).
const WX_PAGE_OF = {
  'src/scripts/park-weather.js': 'src/pages/park.astro',
  'src/scripts/banana-beach.js': 'src/pages/beach.astro',
  'src/scripts/banana-town.js': 'src/pages/town.astro',
  'src/scripts/banana-homestead.js': 'src/pages/homestead.astro',
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

  // 🎛 a walkable area wears BOTH halves of the HUD: the strip (mountHud) and the
  // action bar with its travel door (initTravel). The town shipped with the strip
  // alone on 11 Sep 2026 — design library §15.
  if (rel.startsWith('src/scripts/') && /\bmountHud\(/.test(code) && !/\binitTravel\(/.test(code)) {
    problems.push([rel, "mounts the world HUD strip without the action bar's travel door (initTravel) — an area wears both, see design library §15"]);
  }

  // 🌦 nobody rolls their own rain — design library §19
  if (rel !== WX_MODULE && rel !== 'src/pages/dev/design.astro'
    && /rain-hard\.png|@keyframes\s+\w*Rain\w*|__rain--far/.test(code)) {
    problems.push([rel, 'renders its own rain instead of the shared layer (mountWeather, /css/weather.css) — see design library §19']);
  }
  // …and an area that mounts it must LINK the stylesheet, or it rains invisibly
  if (rel.startsWith('src/scripts/') && rel !== WX_MODULE && /\bmountWeather\(/.test(code)) {
    const page = WX_PAGE_OF[rel];
    if (!page) {
      problems.push([rel, 'mounts the weather but tools/check-design.mjs does not know which page loads it — add it to WX_PAGE_OF so the stylesheet can be checked']);
    } else {
      const html = readFileSync(join(ROOT, page), 'utf8');
      if (!html.includes(WX_CSS)) problems.push([page, `loads ${rel}, which mounts the weather, but never links ${WX_CSS} — the rain would be invisible, see design library §19`]);
    }
  }

  // 🦶 the footer is on every page a visitor can reach — design library §17
  if (rel.startsWith('src/pages/') && rel.endsWith('.astro') && /showFooter\s*=\s*\{\s*false\s*\}/.test(code) && !NO_FOOTER_OK.includes(rel)) {
    problems.push([rel, 'opts out of the footer (showFooter={false}) — only the desk and the dev pages may, see design library §17']);
  }

  // 🗣 an NPC dialogue uses the world's card, never a new one — design library §18
  if (/npcpop|npcsay\b|-npcq\b|__talk|tw-talk/.test(code) && !/mountDialogue|world-dialogue/.test(code) && !OWN_DIALOGUE_OK.includes(rel)) {
    problems.push([rel, 'builds its own NPC dialogue instead of the shared card (mountDialogue, /css/dialogue.css) — see design library §18']);
  }
}

if (problems.length) {
  console.error('\n❌ design gate\n');
  for (const [f, why] of problems) console.error(`   ${f}\n     ${why}\n`);
  console.error(`${problems.length} problem(s). See docs/design-library.md.\n`);
  process.exit(1);
}
console.log(`✅ design gate — ${files.length} files, no [hidden] traps, no stray payment hosts, every HUD strip has its bar, every visitor page its footer, one dialogue card`);
