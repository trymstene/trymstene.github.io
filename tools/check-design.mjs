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
// ⚡ properties a compositor cannot animate: a shadow or a filter re-rasterises, a box metric re-lays-out
const KF_COSTLY = new Set(['filter', 'box-shadow', 'text-shadow', 'left', 'top', 'right', 'bottom',
  'width', 'height', 'margin', 'margin-top', 'margin-left', 'margin-right', 'margin-bottom', 'padding']);
// the ones that already shipped, each on a few elements rather than a world loop — THIS LIST MAY ONLY SHRINK
const KF_LEGACY = ['bhClaw', 'bhHookDrop', 'bhShellGlint', 'bwqBundleUp', 'bwtFill', 'bwtGlow',
  'hs-kglow', 'hs-signbob', 'pkStandFlicker', 'ps-sweep', 'rvFramePulse', 'rvHelloBob', 'rvNeonPulse',
  'rvPanelWash', 'rvScreenDrop', 'rvScreenGlitch', 'rvStagePopPulse', 'rvStrobe', 'rvTextBlink', 'swtGlow'];

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(astro|js|mjs|ts)$/.test(e)) out.push(f);
  }
  return out;
};
// ⚠️ AND THE STANDALONE STYLESHEETS, which this gate could not see for its whole life. §21.4 was written
// after a filter animation cost the town 57% of its frames — and the check only ever read src/, so every
// rule in public/css/ was exempt from it by accident. Found 20 Sep by a scout that PROVED the hole:
// a `filter: blur()` keyframe appended to public/css/town-cafe.css passed the gate green. There were no
// offenders when the hole was closed, so there is no legacy list for these: a new one is a red build.
const walkCss = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walkCss(f, out);
    else if (/\.css$/.test(e)) out.push(f);
  }
  return out;
};

// 🦶 §17 — pages that may sit without the footer: the desk and the dev pages. A
// VISITOR page never may, area pages included: the park shipped footerless and
// Trym had to ask for it ("make sure the footer is available on all our 400+
// pages, even banana world area pages").
const NO_FOOTER_OK = ['src/pages/inbox.astro', 'src/pages/dev-wearables.astro', 'src/pages/dev/design.astro', 'src/pages/dev/copy.astro', 'src/pages/dev/cafe.astro'];

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
// 📐 §20 — every walkable area is the SAME box, and the numbers live in
// /css/world-frame.css. Trym, 13 Sep 2026: "why does frame sizes differ? … homestead,
// park, banana bay and town should all have the same frame size". They had drifted into
// two pairs, 1000/0.8rem against 1100/1rem, because the second pair was a copy of a copy.
// ⚠️ THE RAVE IS DELIBERATELY NOT ONE OF THESE — it is a room, not a map.
const WORLD_PAGES = ['src/pages/park.astro', 'src/pages/beach.astro', 'src/pages/homestead.astro', 'src/pages/town.astro'];
const FRAME_CSS = '/css/world-frame.css';
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

  // 📐 a walkable area wears the world's frame, never its own — design library §20
  if (WORLD_PAGES.includes(rel)) {
    // ⚠️ the LINK, not the path: the wrap rule's own comment names the file, so a
    // page that dropped the <link> still "included" the string and passed.
    if (!new RegExp('<link[^>]+href=["\']' + FRAME_CSS + '["\']').test(src)) {
      problems.push([rel, `never links ${FRAME_CSS}, so its frame is whatever it happens to say — see design library §20`]);
    }
    for (const m of code.matchAll(/\.[\w-]*-view\s*\{([^}]*)\}/g)) {
      if (/height\s*:/.test(m[1]) && !m[1].includes('var(--world-h)')) {
        problems.push([rel, 'sets its own view height instead of var(--world-h) — every area is the same box, see design library §20']);
      }
    }
    for (const m of code.matchAll(/\.[\w-]*-wrap\s*\{([^}]*)\}/g)) {
      if (/max-width\s*:/.test(m[1]) && !m[1].includes('var(--world-w)')) {
        problems.push([rel, 'sets its own frame width instead of var(--world-w) — every area is the same box, see design library §20']);
      }
    }
  }

  // 🦶 the footer is on every page a visitor can reach — design library §17
  // 🏘️ THE RESIDENTS STAND BY THEIR OWN SHOPS (Trym, 18 and 20 Sep — stated twice, so it is a check
  // and not a paragraph). "mainly standing by their shops, to keep some consistency and not make it
  // too messy with tons of bananas always on the move everywhere, it can get chaotic." The town's
  // motion is the VISITORS' job now (town-folk.js); the nine residents are its fixtures.
  // ⚠️ MOSS IS EXEMPT AND MUST BE: he is the sweeper, and LITTER's fourth column is the beat each
  // flyer is swept on, so his route is load-bearing. One banana with a broom is character.
  if (rel === 'src/scripts/town-life.js') {
    const mech = (code.split('const MECH = [')[1] || '').split('\n];')[0];
    for (const m of mech.matchAll(/\{ key: '(\w+)'[\s\S]*?day: \[([\s\S]*?)\] \},/g)) {
      const who = m[1];
      if (who === 'moss') continue;
      const places = [...m[2].matchAll(/\['(\w+)',/g)].map((p) => p[1]);
      let walks = 0;
      for (let i = 1; i < places.length; i++) if (places[i] !== places[i - 1]) walks++;
      if (walks > 4) problems.push([rel, `${who} walks ${walks} times a day (${places.join(' → ')}) — a resident stands by their own shop: post, post, a break, post, post, home. The visitors are the traffic (town-folk.js), see design library §23`]);
    }
  }
  if (rel.startsWith('src/pages/') && rel.endsWith('.astro') && /showFooter\s*=\s*\{\s*false\s*\}/.test(code) && !NO_FOOTER_OK.includes(rel)) {
    problems.push([rel, 'opts out of the footer (showFooter={false}) — only the desk and the dev pages may, see design library §17']);
  }

  // ⚡ MOTION IS transform AND opacity — design library §21.4. A keyframe that animates a property the
  // compositor cannot take makes the browser re-rasterise (filter, a shadow) or re-lay-out (left, width,
  // margin) every element wearing it, on every frame, for as long as the loop runs. A glow is a STATIC
  // filter with an opacity animation over it: same look, one raster.
  //   This has cost the TOWN twice. Every is-todo mark, and paint became the largest cost at night
  //   (15 Sep). Then the very same file still had twHum animating a filter on the cursed objects, and on
  //   a phone-class CPU the night scene dropped 57% of its frames (19 Sep). Twice is a gate.
  // ⚠️ KF_LEGACY is the twenty that already shipped elsewhere, each on a handful of elements rather than
  // a world loop. IT MAY ONLY SHRINK. Nothing new joins it: a new one is a red build.
  for (const m of code.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    if (KF_LEGACY.includes(m[1])) continue;
    let i = m.index + m[0].length, depth = 1;
    while (depth && i < code.length) { const c = code[i++]; if (c === '{') depth++; else if (c === '}') depth--; }
    const body = code.slice(m.index + m[0].length, i - 1);
    const bad = [...new Set([...body.matchAll(/(?:^|[;{]\s*)([a-z-]+)\s*:/g)].map((x) => x[1]))].filter((prop) => KF_COSTLY.has(prop));
    if (bad.length) problems.push([rel, `@keyframes ${m[1]} animates ${bad.join(', ')} — the compositor cannot take that, so every element wearing it is re-rasterised or re-laid-out on every frame. Make the ${bad[0]} static and animate opacity instead (design library §21.4)`]);
  }

  // 🚪 A ROOM IS ONE SCREEN — design library §22. While a room is up, the area's world wears
  // .is-inside and these lists blank it. They name the very classes a room's own fittings are drawn
  // with, so a list with NO exemption renders every sprite inside that room invisible: no error, no
  // warning, nothing on screen, and hours spent hunting a z-index bug that is not there.
  // Two grammars are in the world and both are fine: the town exempts with a trailing :not(.is-in),
  // the homestead exempts per class inside the :is(...). What fails is exempting nothing.
  for (const m of code.matchAll(/\.is-inside\s+:is\(([^)]*(?:\([^)]*\)[^)]*)*)\)([^{]*)\{/g)) {
    if (!/:not\(/.test(m[1] + m[2])) {
      problems.push([rel, 'an .is-inside hide list exempts nothing — every sprite drawn inside a room would render invisible with nothing on screen to say why. End it in :not(.is-in), or exempt per class the way the homestead does (design library §22)']);
    }
  }

  // 🗣 an NPC dialogue uses the world's card, never a new one — design library §18
  if (/npcpop|npcsay\b|-npcq\b|__talk|tw-talk/.test(code) && !/mountDialogue|world-dialogue/.test(code) && !OWN_DIALOGUE_OK.includes(rel)) {
    problems.push([rel, 'builds its own NPC dialogue instead of the shared card (mountDialogue, /css/dialogue.css) — see design library §18']);
  }
}

// 🏘️ THE TOWN'S LOCK — a shut shopfront is the town's meter speaking, and it has three hard rules
// (docs/town-jobs-plan.md §1). Each has been argued more than once, so each is a grep now.
{
  const slurp = (rel) => { try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return ''; } };
  const today = slurp('src/data/town/today.js');
  const cond = slurp('src/data/town/condition.js');
  const room = slurp('src/scripts/town-room.js');
  const mC = today.match(/export const CLOSABLE\s*=\s*\[([^\]]*)\]/);
  const closable = mC ? [...mC[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  if (!closable.length) problems.push(['src/data/town/today.js', 'no CLOSABLE list found — the town-lock gate cannot read what is allowed to shut']);

  // 0. THE OTHER LOCK. A front the STORY has not opened wears a worksite fence, not the tape, and the
  //    arcade may never wear either: five shipped games must answer on a stranger's worst day. The
  //    plan asks for this as a grep rather than a paragraph (docs/town-jobs-plan.md §1).
  const locks = slurp('src/data/town/locks.js');
  const mH = locks.match(/export const HOARDABLE\s*=\s*\[([^\]]*)\]/);
  const hoardable = mH ? [...mH[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  if (locks && !mH) problems.push(['src/data/town/locks.js', 'no HOARDABLE list found — the town-lock gate cannot read what the story may board up']);
  if (hoardable.includes('condo')) problems.push(['src/data/town/locks.js', "HOARDABLE names 'condo' — the arcade is never boarded, whatever the story says: five shipped games must answer on a stranger's worst day (town-jobs-plan §1)"]);
  const geo = slurp('src/scripts/town-geo.js');
  if (/export const HOARD = \{/.test(geo)) {
    for (const k of hoardable) {
      if (!geo.includes('"' + k + '": {')) problems.push(['src/data/town/locks.js', `HOARDABLE names '${k}' but tools/build-town-scene.py baked no hoarding for it — the front would lock with nothing on screen to say so`]);
    }
  }

  // 1. THE ARCADE AND THE POST NEVER SHUT. Five shipped games must answer on a stranger's worst day,
  //    and the mail never stops. Neither key may appear in CLOSABLE or in any band's `shut`.
  for (const never of ['condo', 'post']) {
    if (closable.includes(never)) problems.push(['src/data/town/today.js', `CLOSABLE names '${never}' — the arcade and the post office never shut, whatever the meter says (town-jobs-plan §1)`]);
    for (const m of cond.matchAll(/shut:\s*\[([^\]]*)\]/g)) {
      if (m[1].includes(`'${never}'`)) problems.push(['src/data/town/condition.js', `a band shuts '${never}' — the arcade and the post office never shut, whatever the meter says (town-jobs-plan §1)`]);
    }
  }

  // 2. A BAND MAY ONLY SHUT WHAT CAN BE SHUT. A key in a band's `shut` that is not in CLOSABLE gets
  //    no shutter, no tape and no fix — it is shut in the data and open on the screen.
  for (const m of cond.matchAll(/shut:\s*\[([^\]]*)\]/g)) {
    for (const k of [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])) {
      if (closable.length && !closable.includes(k)) problems.push(['src/data/town/condition.js', `a band shuts '${k}', which is not in today.js CLOSABLE — it would be shut in the data and open on the screen`]);
    }
  }

  // 4. A LAMP'S HIT BOX LIVES IN ONE PLACE (design library §24, 20 Sep 2026). Trym, 18 Sep: "i see a
  //    broken streetlight in the square board, but i dont see any options to fix it … no fix icon on
  //    any streetlight". It was fixed once, in the reseed — and the ghosts' own path went on planting
  //    lamps with the default box, so a lamp a ghost put out could not be tapped where its icon was.
  //    Second time in one class, so it is a check: the numbers are LAMP_HIT in town-room.js and a
  //    literal copy of them anywhere in the town's scripts fails the build.
  const lampNums = room && room.match(/const LAMP_HIT = \{[^}]*\}/);
  if (room && !lampNums) problems.push(['src/scripts/town-room.js', "no LAMP_HIT constant — a lamp's repair icon and tap box must have exactly one home (design library §24)"]);
  // ⚠️ RELATIVE PATHS, because this block's own `slurp` joins them onto ROOT — handing it the
  // absolute paths that walk() returns silently read nothing at all and the check passed on air.
  const TOWN_JS = files.map((x) => String(x).replace(/\\/g, '/'))
    .filter((x) => /\/src\/scripts\/town-[^/]+\.js$/.test(x))
    .map((x) => x.slice(x.indexOf('/src/scripts/') + 1));
  for (const f of TOWN_JS) {
    const t = slurp(f);
    // ⚠️ BOTH SHAPES: `grab: 54` in an object literal and `p.grab = 54` on a line of its own. The
    // first version of this check only knew the colon, and the assignment form walked straight past it.
    for (const m of t.matchAll(/\b(?:grab|tall)\s*[:=]\s*(\d+)/g)) {
      // ⚠️ THE SAME LINE, not the neighbourhood: a lookback of 200 characters passed a literal that sat
      // two lines under the constant's own name, which is exactly the shape the bug had.
      const from = t.lastIndexOf('\n', m.index) + 1, to = t.indexOf('\n', m.index);
      if (!/LAMP_HIT/.test(t.slice(from, to < 0 ? t.length : to))) {
        problems.push([f, `a hard-coded problem hit box (${m[1]}) — a problem's tap box belongs to one named constant (LAMP_HIT for lamps), or the next path that plants one forgets it (design library §24)`]);
      }
    }
  }

  // 3. EVERY SHUT FRONT KEEPS ITS KEEPER IN. A cheerful resident standing outside their own taped-off
  //    door is the tell that the lock is skin-deep, so keepFn must ask about every closable key.
  for (const k of closable) {
    if (room && !room.includes(`cond.shut.has('${k}')`)) problems.push(['src/scripts/town-room.js', `keepFn never asks about '${k}' — its keeper would stand outside their own shut door (town-jobs-plan §1)`]);
  }
}

// ⚡ §21.4 IN THE STANDALONE STYLESHEETS. The loop above walks src/ only, so every rule in public/css/
// was exempt from this gate by accident for its whole life — proved on 20 Sep by appending a
// `filter: blur()` keyframe to public/css/town-cafe.css and watching the gate pass green. These files get
// THIS rule and no other: the checks above read JS and template semantics a stylesheet has none of
// (public/css/weather.css IS the shared rain layer, for one, and would fail the "rolls its own rain" rule).
// No legacy list — there were zero offenders when the hole was closed, so a new one is a red build.
let cssN = 0;
for (const f of walkCss(join(ROOT, 'public/css'))) {
  cssN++;
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    if (KF_LEGACY.includes(m[1])) continue;
    let i = m.index + m[0].length, depth = 1;
    while (depth && i < css.length) { const ch = css[i++]; if (ch === '{') depth++; else if (ch === '}') depth--; }
    const body = css.slice(m.index + m[0].length, i - 1);
    const bad = [...new Set([...body.matchAll(/(?:^|[;{]\s*)([a-z-]+)\s*:/g)].map((x) => x[1]))].filter((prop) => KF_COSTLY.has(prop));
    if (bad.length) problems.push([rel, `@keyframes ${m[1]} animates ${bad.join(', ')} — the compositor cannot take that, so every element wearing it is re-rasterised or re-laid-out on every frame. Make the ${bad[0]} static and animate opacity instead (design library §21.4)`]);
  }
}

if (problems.length) {
  console.error('\n❌ design gate\n');
  for (const [f, why] of problems) console.error(`   ${f}\n     ${why}\n`);
  console.error(`${problems.length} problem(s). See docs/design-library.md.\n`);
  process.exit(1);
}
console.log(`✅ design gate — ${files.length} files + ${cssN} stylesheets, no [hidden] traps, no stray payment hosts, every HUD strip has its bar, every visitor page its footer, one dialogue card, the town lock sound`);
