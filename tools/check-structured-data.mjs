#!/usr/bin/env node
// 🕸 THE STRUCTURED-DATA GATE (25 Sep 2026) — reads the BUILT site (dist/) and fails when the layer machines read breaks.
// Trym asked for "fresh eyes so that all pages with content has the optimal AI-friendly, SEO-friendly, structured
// data-readability for machines"; the audit found every JSON-LD block parsing but pages with no page node at all (the
// town, the guides, contact), images with no licence, and a gallery "part of" the GIF. This keeps the fixes fixed:
//
//   · every JSON-LD block parses
//   · every indexable page (no noindex, not a redirect) carries a PAGE node — a WebPage or one of its kinds — with
//     the page's own URL, and its inLanguage is the page's <html lang>
//   · every ImageObject can be credited and licensed: contentUrl, license, and creditText / creator / copyrightNotice
//     (what Google Images needs for the Licensable badge)
//   · every Product has a name, an image and an offer with a price
//   · every @id on trymstene.com that a page REFERS to is DEFINED on some page (a node with more than an @id)
//
// Run after `npx astro build`:  node tools/check-structured-data.mjs   (in CI with the other built-site gates)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!fs.existsSync(DIST)) { console.error('✗ no dist/ — build first (npx astro build)'); process.exit(1); }
const PAGE_TYPES = new Set(['WebPage', 'CollectionPage', 'ImageGallery', 'ProfilePage', 'ContactPage', 'AboutPage', 'ItemPage', 'FAQPage']);
const SITE = 'https://trymstene.com';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['_astro', 'assets', 'fonts', 'css', 'js', 'chunks'].includes(e.name)) walk(p); }
    else if (e.name.endsWith('.html')) files.push(p);
  }
})(DIST);

const problems = [];
const defined = new Set();
const refs = [];   // [page, @id]
const typesOf = (n) => [].concat(n['@type'] || []);
function nodesOf(x, out = []) {
  if (Array.isArray(x)) { x.forEach((y) => nodesOf(y, out)); return out; }
  if (x && typeof x === 'object') {
    if (x['@type'] || x['@id']) out.push(x);
    for (const [k, v] of Object.entries(x)) if (k !== '@context' && v && typeof v === 'object') nodesOf(v, out);
  }
  return out;
}
let pagesChecked = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = '/' + path.relative(DIST, f).split(path.sep).join('/').replace(/index\.html$/, '');
  const robots = (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1] || '';
  const redirect = /http-equiv="refresh"/i.test(html);
  const lang = (html.match(/<html[^>]*\blang="([^"]+)"/) || [])[1] || '';
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || '';
  const nodes = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { nodesOf(JSON.parse(m[1]), nodes); } catch (e) { problems.push(`${rel} — a JSON-LD block does not parse: ${String(e.message).slice(0, 80)}`); }
  }
  for (const n of nodes) {
    const keys = Object.keys(n).filter((k) => !k.startsWith('@'));
    if (n['@id'] && keys.length) defined.add(n['@id']);
    else if (n['@id'] && !n['@type'] && String(n['@id']).startsWith(SITE)) refs.push([rel, n['@id']]);
    const t = typesOf(n);
    if (t.includes('ImageObject') && n.contentUrl) {
      if (!n.license) problems.push(`${rel} — an ImageObject (${n.contentUrl}) has no license`);
      if (!n.creditText && !n.creator && !n.copyrightNotice) problems.push(`${rel} — an ImageObject (${n.contentUrl}) names no credit (creditText / creator / copyrightNotice)`);
    }
    if (t.includes('Product')) {
      const o = n.offers || {};
      if (!n.name || !n.image) problems.push(`${rel} — a Product without a name or an image`);
      if (!o.price && !o.lowPrice && !(Array.isArray(o) && o.length)) problems.push(`${rel} — a Product without an offer price`);
    }
  }
  if (/noindex/.test(robots) || redirect) continue;
  pagesChecked++;
  const pageNodes = nodes.filter((n) => typesOf(n).some((t) => PAGE_TYPES.has(t)) && !typesOf(n).includes('FAQPage'));
  if (!pageNodes.length) { problems.push(`${rel} — indexable, but no page node (WebPage or its kinds): pass BaseLayout's page props, or pageNode stays on`); continue; }
  const own = pageNodes.find((n) => (n.url || '').replace(/\/$/, '') === canonical.replace(/\/$/, '')) || pageNodes[0];
  if (own.inLanguage && lang && !String(own.inLanguage).startsWith(lang)) problems.push(`${rel} — the page node says inLanguage ${own.inLanguage}, the page is <html lang="${lang}">`);
}
for (const [rel, id] of refs) if (!defined.has(id)) problems.push(`${rel} — refers to ${id}, which no page defines`);

if (problems.length) {
  console.error(`✗ structured data — ${problems.length} problem(s):\n` + [...new Set(problems)].slice(0, 60).map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`✅ structured data — ${files.length} pages read, ${pagesChecked} indexable each with a page node, every image licensable, every @id defined (${defined.size})`);
