// 🌍 The world counter on the Pulse desk matches GA4 realtime page TITLES,
// because the realtime API has no page-path dimension. That makes a title a
// load-bearing string: rename a world page and the counter silently reads low
// forever, which is exactly how the old one sat at zero for its whole life.
import { readFileSync } from 'node:fs';
import { WORLD_TITLES } from '../src/data/pulse-dicts.js';
import { EV_LABEL, EV_EXPLAIN } from '../src/data/pulse-events.js';

const bad = [];
// an event the desk can explain but cannot NAME prints its raw GA4 key on
// screen, next to rows that read like English. 40 of them did.
const unnamed = Object.keys(EV_EXPLAIN).filter((k) => !EV_LABEL[k]);
if (unnamed.length) bad.push(unnamed.length + ' events have an explainer and no label: ' + unnamed.join(', '));
for (const w of WORLD_TITLES) {
  let html;
  try { html = readFileSync('dist/' + w.page + 'index.html', 'utf8'); }
  catch { bad.push(w.page + ' — no built page (run the build first)'); continue; }
  const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  if (!t.startsWith(w.title)) bad.push(w.page + ' — title is "' + t + '", expected it to start with "' + w.title + '"');
}
if (bad.length) {
  console.error('✗ pulse world titles drifted:\n  ' + bad.join('\n  ')
    + '\n  fix WORLD_TITLES in src/data/pulse-dicts.js');
  process.exit(1);
}
console.log('✓ pulse: ' + WORLD_TITLES.length + ' world titles match, all '
  + Object.keys(EV_EXPLAIN).length + ' explained events are named');
