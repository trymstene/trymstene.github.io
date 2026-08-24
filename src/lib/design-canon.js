// 🎨 THE DESIGN CANON EXTRACTOR — build-time only (node:fs), imported solely by
// /dev/design/. Everything it returns is read from the live source files at
// `astro build`, so the library page cannot rot: if a selector moves or a
// constant is renamed, the build FAILS here instead of the page lying.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const cache = new Map();

export function src(rel) {
  if (!cache.has(rel)) cache.set(rel, readFileSync(join(ROOT, rel), 'utf8'));
  return cache.get(rel);
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripIndent = (text, indent) =>
  indent ? text.split('\n').map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l)).join('\n') : text;

/** The full CSS rule `selector { … }` lifted from a source file. Throws when
 *  the selector is gone — a moved rule must break the build, not ship a stale copy. */
export function cssRule(rel, selector, contains) {
  const text = src(rel);
  const re = new RegExp('(^|\\n)[ \\t]*' + escRe(selector) + '\\s*\\{', 'g');
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length;
    let i = text.indexOf('{', start);
    for (let depth = 0; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) break;
    }
    const rule = text.slice(start, i + 1);
    if (contains && !rule.includes(contains)) continue;
    return stripIndent(rule, /[ \t]*$/.exec(text.slice(0, start))[0]);
  }
  throw new Error(`design-canon: "${selector}" not found in ${rel}`);
}

export const cssRules = (rel, selectors) => selectors.map((s) => cssRule(rel, s)).join('\n');

/** The `const CSS = \`…\`` template literal a self-styling world module carries
 *  (world-travel.js, world-hud.js), unescaped back to plain CSS. */
export function jsCssConst(rel) {
  const m = /const CSS = `([\s\S]*?)\n`;/.exec(src(rel));
  if (!m) throw new Error(`design-canon: no CSS const in ${rel}`);
  return m[1].replace(/\\([\\`$])/g, '$1');
}

/** The travel DOOR svg, reassembled from its concatenated string literal. */
export function doorSvg() {
  const m = /const DOOR = ('[\s\S]*?<\/svg>');/.exec(src('src/scripts/world-travel.js'));
  if (!m) throw new Error('design-canon: DOOR not found in world-travel.js');
  return m[1].replace(/'\s*\+\s*'/g, '').replace(/^'|'$/g, '');
}

/** A single source line matching `pattern` (regex), trimmed — for showing a
 *  formula exactly as the code writes it. */
export function srcLine(rel, pattern) {
  const line = src(rel).split('\n').find((l) => pattern.test(l));
  if (!line) throw new Error(`design-canon: ${pattern} not found in ${rel}`);
  return line.trim();
}

// walk src/ for census scans (the library's own pages are excluded — it must
// count the world, not itself)
function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = dir + '/' + name;
    if (rel === 'src/pages/dev' || rel === 'src/icons') continue;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(astro|js)$/.test(name)) out.push(rel);
  }
  return out;
}

let allSrc;
export const sourceFiles = () => (allSrc ??= walk('src'));

/** Count occurrences of a regex across all src/ files → { total, files: {rel: n} } */
export function census(pattern) {
  const files = {};
  let total = 0;
  for (const rel of sourceFiles()) {
    const n = (src(rel).match(pattern) || []).length;
    if (n) { files[rel] = n; total += n; }
  }
  return { total, files };
}

// ---- PALETTE ----------------------------------------------------------------

const normHex = (h) => {
  h = h.toLowerCase();
  return h.length <= 5 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h;
};

/** Every hex colour in `rel` with its count. */
export function hexesIn(rel) {
  const out = new Map();
  for (const m of src(rel).matchAll(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g)) {
    const h = normHex(m[0]);
    out.set(h, (out.get(h) || 0) + 1);
  }
  return out;
}

/**
 * The world palette, grouped: `shared` = colours living in ≥3 of the 4 area
 * pages (the world-wide canon), then each area's own top colours.
 * areaFiles: { areaName: [files…] }
 */
export function palette(areaFiles) {
  const perArea = {};
  for (const [area, files] of Object.entries(areaFiles)) {
    const merged = new Map();
    for (const rel of files) {
      for (const [h, n] of hexesIn(rel)) merged.set(h, (merged.get(h) || 0) + n);
    }
    perArea[area] = merged;
  }
  const areas = Object.keys(areaFiles);
  const all = new Map(); // hex -> { total, areas: {area: count} }
  for (const area of areas) {
    for (const [h, n] of perArea[area]) {
      if (!all.has(h)) all.set(h, { total: 0, areas: {} });
      const e = all.get(h);
      e.total += n;
      e.areas[area] = n;
    }
  }
  const shared = [...all.entries()]
    .filter(([, e]) => Object.keys(e.areas).length >= 3)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([hex, e]) => ({ hex, ...e }));
  const sharedSet = new Set(shared.map((s) => s.hex));
  const own = {};
  for (const area of areas) {
    own[area] = [...perArea[area].entries()]
      .filter(([h, n]) => !sharedSet.has(h) && n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([hex, count]) => ({ hex, count }));
  }
  return { shared, own };
}

/** The :root design tokens from the global stylesheet → [{ name, value }] */
export function rootTokens() {
  const rule = cssRule('public/css/styles.css', ':root');
  return [...rule.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => ({ name: m[1], value: m[2].trim() }));
}

/** dark text on light swatches, light on dark */
export function inkFor(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 140 ? '#111' : '#fffdf5';
}

// ---- FRAME CONSTANTS --------------------------------------------------------

/**
 * Every `height:` declared for `selector` in a page's <style> blocks, each with
 * the @media conditions wrapping it (comments stripped, braces tracked).
 */
export function heightsOf(rel, selector) {
  const styles = [...src(rel).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const found = [];
  for (const css of styles.map((s) => s.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    const stack = [];
    const re = /([^{}]*)([{}])/g;
    let m;
    while ((m = re.exec(css))) {
      if (m[2] === '{') {
        const head = m[1].trim();
        stack.push(head.startsWith('@media') ? head.replace(/^@media\s*/, '') : null);
        if (head.split(',').map((s) => s.trim()).includes(selector)) {
          const body = css.slice(re.lastIndex, css.indexOf('}', re.lastIndex));
          const h = /height:\s*([^;]+);/.exec(body);
          if (h) found.push({ value: h[1].trim(), media: stack.filter(Boolean).join(' and ') });
        }
      } else stack.pop();
    }
  }
  if (!found.length) throw new Error(`design-canon: no height for "${selector}" in ${rel}`);
  return found;
}

// ---- OLD PEEL ---------------------------------------------------------------

/** Old Peel's talk content, read from park-npc.js: greeting, the question deck,
 *  one real answer, and the portrait draw calls. */
export function oldPeel() {
  const text = src('src/scripts/park-npc.js');
  const greet = /const OLD_GREET = '([^']+)';/.exec(text)?.[1];
  const topics = /const OLD_TOPICS = \[([\s\S]*?)\n\];/.exec(text)?.[1];
  const questions = [...topics.matchAll(/q: '([^']+)'/g)].map((m) => m[1]);
  const answer = /id: 'park', q: [^\n]*byPhase: \[\s*\n?\s*'([^']+)'/.exec(text)?.[1];
  const portrait = text.split('\n').filter((l) => /pc\.(scale|translate)|drawComposite\(pc/.test(l)).map((l) => l.trim());
  if (!greet || !questions.length || !answer) throw new Error('design-canon: Old Peel content not found in park-npc.js');
  return { greet, questions, answer, portrait };
}

// ---- TRAVEL AREAS -----------------------------------------------------------

/** The fast-travel destinations exactly as world-travel.js declares them. */
export function travelAreas() {
  const text = src('src/scripts/world-travel.js');
  const block = /const AREAS = \{([\s\S]*?)\};/.exec(text)?.[1];
  const rows = [...block.matchAll(/(\w+): \{ icon: '([^']+)', name: '([^']+)' \}/g)]
    .map((m) => ({ id: m[1], icon: m[2], name: m[3] }));
  if (rows.length < 3) throw new Error('design-canon: AREAS not found in world-travel.js');
  return rows;
}

/** A source comment block containing `needle`, for quoting doctrine verbatim. */
export function srcComment(rel, needle) {
  const m = new RegExp('/\\*[^*]*' + escRe(needle) + '[\\s\\S]*?\\*/').exec(src(rel));
  if (!m) throw new Error(`design-canon: comment "${needle}" not found in ${rel}`);
  return m[0].replace(/^\/\*\s?|\s*\*\/$/g, '').split('\n').map((l) => l.trim()).join('\n');
}

// ---- ICONS ------------------------------------------------------------------

/** The house-drawn PixelIcon set: every name in PixelIcon.astro's ICONS map. */
export function pixelIconNames() {
  const block = /const ICONS = \{([\s\S]*?)\n\};/.exec(src('src/components/PixelIcon.astro'))?.[1];
  const names = [...block.matchAll(/^ {2}([a-z][\w]*): `/gm)].map((m) => m[1]);
  if (!names.length) throw new Error('design-canon: ICONS not parsed from PixelIcon.astro');
  return names;
}

/** Where an icon name is referenced. House set = <PixelIcon> only; the Pro set
 *  is also reachable from scripts via iconSvg(). 0 = referenced dynamically
 *  (e.g. park-garden's PHASE_FACES array). */
export function iconRefs(component, name) {
  let pat = escRe(`<${component} name="${name}"`);
  if (component === 'PixelArtIcon') pat += '|' + escRe(`iconSvg('${name}'`);
  return census(new RegExp(pat, 'g')).total;
}

// ---- BUDGETS ----------------------------------------------------------------

export const budgets = () => JSON.parse(src('tools/budgets.json'));
